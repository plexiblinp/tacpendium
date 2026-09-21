package combo

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"strings"

	dbinfra "github.com/plexiblinp/tacpendium/internal/infra/db"
	"github.com/plexiblinp/tacpendium/internal/model"
	comborepo "github.com/plexiblinp/tacpendium/internal/repository/combo"
	gamerepo "github.com/plexiblinp/tacpendium/internal/repository/game"
	"github.com/plexiblinp/tacpendium/internal/service/notation"
	setupsvc "github.com/plexiblinp/tacpendium/internal/service/setup"
	"github.com/plexiblinp/tacpendium/internal/service/validation"
)

// ===========================================================================
// 公開エラー
// ===========================================================================

// ErrNotFound は対象コンボが見つからない場合のセンチネル(リポジトリ層から伝播)。
var ErrNotFound = comborepo.ErrNotFound

// ErrConflict は楽観的排他衝突のセンチネル(リポジトリ層から伝播)。
var ErrConflict = comborepo.ErrConflict

// ErrDatabaseBusy は write lock を取れずに処理できなかった場合のセンチネル
// (M24-11 / CHANGE-136)。ハンドラは 503 database_busy へ翻訳する。
//
// ★入力の誤り(400)でも版の衝突(409)でもない。⇒ 混ぜないこと。
var ErrDatabaseBusy = errors.New("combo: database busy")

// busyOr は SQLite の busy / locked を ErrDatabaseBusy へ翻訳する。
// それ以外はそのまま返す(500 internal_error のまま)。
//
// ★BEGIN IMMEDIATE は開始時点で write lock を取りにいくため、混雑は BeginTx で出る。
// ⇒ VAL-C02 の適用面の BeginTx を通す。実測 5 か所——Create / UpdateMetadata(昇格) /
// UpdateWithKeyChange / Materialize / drainBasePunish(Materialize の 2 本目)。
//
// ★同じ combo パッケージ内でも Delete / Restore / PermanentDelete は未翻訳である
// (500 internal_error のまま)。★これは退行ではない——DEFERRED でも最初の書き込み文で
// SQLITE_BUSY は出ていた。射程を VAL-C02 の面に切った結果であり、完了報告 §10-4 に記録した。
func busyOr(err error, what string) error {
	if dbinfra.IsBusy(err) {
		return fmt.Errorf("%s: %w", what, ErrDatabaseBusy)
	}
	return fmt.Errorf("%s: %w", what, err)
}

// ErrComboNotInTrash は論理削除されていないコンボへの完全削除要求で返すセンチネル。
var ErrComboNotInTrash = errors.New("combo: not in trash")

// ErrInvalidTagID は存在しないタグ ID が tagIds に含まれていた場合のセンチネル(M3-02)。
var ErrInvalidTagID = errors.New("combo: invalid tag id")

// ErrInvalidSetupCarryMode は不正な setupCarryOptions.mode が指定された場合のセンチネル。
var ErrInvalidSetupCarryMode = errors.New("combo: invalid setup carry mode")

// ErrMissingSetupCarryOptions は KA 変更時に setupCarryOptions が未指定の場合のセンチネル。
var ErrMissingSetupCarryOptions = errors.New("combo: missing setup carry options")

// ErrMaterializeIneligibleHitType は materialize 対象外の hit_type(punish_counter 系)を
// 基底に持つコンボへ materialize が要求された場合のセンチネル(M18-03b §4.1)。
// ハンドラは 400 + 理由コードへ写像する(FE がボタンを出さないだけでは API 直叩きで
// 二重計上が起こるため BE でも弾く)。
var ErrMaterializeIneligibleHitType = errors.New("combo: materialize ineligible hit type")

// ===========================================================================
// 入出力 DTO(サービス層)
// ===========================================================================

// CreateInput は POST /api/combos と PUT /api/combos/:id(キー変更編集)で共通に使う入力。
//
// Q4 確定: Name フィールドは持たない(combos スキーマに name カラムなし)。
type CreateInput struct {
	CharacterID   int64
	IsDraft       bool
	Damage        *int
	StarterMoveID *int64
	Position      *string
	// StartPositionMass は始動位置のマス数(0〜160・M28-02a)。
	// ★★マス数と Position は normalizePositionAndMass で必ず整合させる(マス数が勝つ)。
	StartPositionMass *int
	// CarryDistanceMass は運び量(0〜160・M28-02a)。★区分へ丸めない。
	CarryDistanceMass *int
	OpponentStance    *string
	HitType           *string
	OpponentSize      *string
	// StarterMeaty は始動技を持続当てしたか(M37-07・重複判定キーの 8 つ目・D-874)。
	// ★省略は false(通常始動)。列は NOT NULL DEFAULT 0 である。
	StarterMeaty          bool
	DriveAvailableAtStart *float64
	SAAvailableAtStart    *int
	DriveDamage           *float64
	SAGaugeConsumed       *int     // 消費 SA(0〜6・M16-02)。VAL 非連動
	DriveGaugeConsumed    *float64 // 消費 drive(0〜20・0.5 刻み・M16-02)。VAL 非連動
	KnockdownAdvantage    *int
	// OkiVerified は起き攻めを一度でも調べたか(M27-02b)。★省略は false(未検証)。
	OkiVerified bool
	Memo        *string
	Situation   *string // JSON 文字列(API 層で受け取った生 JSON)
	Link        *string // 外部リンク URL(M17-01)。文字列参照のみ・dup/recipe 非対象
	VideoPath   *string // 動画の相対パス(M17-01)。本体は解決・再生しない
	ImagePath   *string // 画像の相対パス(M17-01)。本体は解決・表示読込しない
	Steps       []model.ComboStep
	// OkiOptions は起き攻めオプション(combo_oki_options・M16-03 正規化)。★M27-02b: 空/nil は「未検証」である(「オプションなし」ではない)。
	OkiOptions []model.OkiOption
	// TagIDs は作成と同時に紐付けるタグ ID 列(M3-02)。空/nil はタグなし。
	TagIDs []int64
	// UserID は「誰として保存するか」。コンボ本体の所有者ではない
	// ——コンボは全員で共有する(FR013 前半・契約 F-1)。タグの紐づけを
	// この利用者の分だけ入れ替えるために使う(M22-02 §4.5-14＝D-405)。
	UserID int64
	// SetupCarryOptions は knockdownAdvantage 変更時のセットプレイ引き継ぎ方式(M4-03)。
	// nil = 未指定(PUT パスでは既存挙動の全転写、PATCH パスでは無変更)。
	SetupCarryOptions *comborepo.SetupCarryOptionsInput
	// Setups は同時登録するセットプレイの入力列（M4-04）。nil/空配列は従来動作。
	Setups []setupsvc.CreateSetupInput
}

// UpdateMetadataInput はリポジトリ層と同型を使い回す。
type UpdateMetadataInput = comborepo.UpdateMetadataInput

// ListFilter はリポジトリ層と同型を使い回す。
type ListFilter = comborepo.ListFilter

// CheckDuplicateInput は POST /api/combos/check-duplicate の入力(M2-02)。
type CheckDuplicateInput struct {
	CharacterID    int64
	StarterMoveID  *int64
	Position       *string
	OpponentStance *string
	HitType        *string
	OpponentSize   *string
	StarterMeaty   bool // M37-07: 重複判定キーの 8 つ目。省略は false(通常始動)
	Steps          []model.ComboStep
	ExcludeComboID *int64
}

// CheckDuplicateResult は重複検知の結果。
//
// ★生きた側(Duplicates)と削除済み側(DeletedDuplicates)は別のキーで返す(M23-09 §4.1-1)。
// 混ぜないのは、画面が「生きた重複」と「ゴミ箱の重複」で違う振る舞いをするためである
// ——前者は既に VAL-C02 が ERROR で止めており、ダイアログを出すのは後者だけである(§4.1-4)。
type CheckDuplicateResult struct {
	Duplicates []DuplicateInfo
	// DeletedDuplicates は母集団も判定も VAL-C14 と同一である(M23-09 §4.1-1)。
	// ★findDeletedDuplicateRefsByKey を VAL-C14 と共有しているため、構造的にずれない。
	DeletedDuplicates []model.ComboRef
}

// DuplicateInfo は重複候補の構造化情報(M2-02 v1.1.0)。
type DuplicateInfo struct {
	ID             int64
	CharacterID    int64
	StarterMoveID  *int64
	Position       *string
	OpponentStance *string
	HitType        *string
	OpponentSize   *string
	StarterMeaty   bool // M37-07
	StepCount      int
	// Memo は「どのコンボか」を人が読める形で示す(M23-09 §4.1-3 / §3.3-4)。
	// ★キー項目が要求値のエコーバックであるのに対し、本フィールドは実際の行から来る。
	Memo *string
}

// MaterializeInput は POST /api/combos/{id}/materialize の入力(M18-03b §4.4)。
type MaterializeInput struct {
	BaseComboID    int64
	OpponentMoveID int64   // 必須。裁定7 により combo_punishes を同時作成する
	Note           *string // 任意。combo_punishes.note へ
	// UserID は「誰として保存するか」。コンボ本体の所有者ではない
	// ——コンボは全員で共有する(FR013 前半・契約 F-1)。タグの紐づけを
	// この利用者の分だけ入れ替えるために使う(M22-02 §4.5-14＝D-405)。
	UserID int64
}

// materialize 時にダメージを加算できなかった理由コード(§4.3 の縁の扱い)。
// 内部値と表示ラベルを分離し(L-7)、FE 側で文言へ写像する。空文字は「加算した / counter で不変」。
const (
	MaterializeDamageBaseNull        = "base_damage_null"           // 基底コンボの damage が NULL
	MaterializeDamageStarterNotSet   = "starter_move_not_set"       // 始動技が未設定
	MaterializeDamageStarterDmgNull  = "starter_move_damage_null"   // 始動技の moves.damage が NULL
	MaterializeDamageStarterUnscaled = "starter_move_not_pc_scaled" // SA / CA はパニッシュカウンター補正なし
)

// MaterializeResult は materialize の結果(M18-03b §4.4)。
type MaterializeResult struct {
	ComboID          int64  // 生成コンボ or 既存コンボ(FR301 一致時)の id
	AlreadyExisted   bool   // FR301 で既存が見つかり生成しなかった
	DamageAdded      bool   // 始動技ダメージ × 0.2 を加算した
	DamageSkipReason string // 加算しなかった理由コード(上記定数。空=加算した or counter で不変)
}

// ===========================================================================
// Service インタフェース
// ===========================================================================

// Service はコンボのビジネスロジックを提供する。
type Service interface {
	Create(ctx context.Context, input CreateInput) (*model.Combo, validation.ValidationResult, error)

	// CheckTrashDuplicate は VAL-C14(ゴミ箱に同じものがある)を判定する(M23-05 §4.1)。
	//
	// ★★POST /api/combos のハンドラからのみ呼ぶこと(M23-05 §4.5-1)。
	//   PUT / PATCH / CSV 取込 / materialize からは呼ばない。
	//   ⇒ PUT は旧行を論理削除して新行を積む方式であり、走らせると自分が積んだ旧行に
	//      当たって編集のたびに警告が出る。キーを変えない編集ではとくに確実に当たる。
	//   ⇒ CSV 取込・materialize は内部呼び出しであり、警告を返す先が無い(§1.4-4)。
	// ★Create の中へ入れないのは、Create 自体が CSV 取込からも呼ばれるためである
	//   (service/comboio/import.go)。ValidateComboForCreate へ入れないのは、同関数を
	//   POST と PUT が共用しているためである。どちらも「経路で絞る」が成立しない。
	//
	// 登録は既に成功している前提であり、判定に失敗しても登録を巻き戻さない。
	// 失敗時はログへ残して空の結果を返す(M23-04 の復元検証と同じ扱い)。
	CheckTrashDuplicate(ctx context.Context, comboID int64) validation.ValidationResult
	Get(ctx context.Context, id, userID int64) (*model.Combo, error)
	// GetDeleted はゴミ箱の行から開く読み取り専用のコンボ詳細を返す(M23-07 §4.2-2)。
	//
	// ★Get とは母集団が違う。Get は deleted_at IS NULL で締め出すため、ゴミ箱の
	// 行を引くと 404 になる。既存経路にフラグを足さず別の入口にしてあるのは、
	// 「求めている集合が違えば入口も別に要る」(M23-06 の教訓)ためである。
	// ⇒ Get にフラグを足すと、通常の詳細表示で削除済みが返る事故の余地が残る。
	//
	// ★削除済み行の recipe_cache は NULL のため、レシピ文字列は combo_steps から
	// 組み立てる。書き戻さない(DES-002 §4.2 の不変)。
	//
	// ★削除済みでない行も返す(M23-07 §5.1-7)。読み取り専用の詳細は生存行にも
	// 意味があり、ゴミ箱と通常詳細を跨いだ遷移で 404 を作らないためである。
	GetDeleted(ctx context.Context, id, userID int64) (*model.Combo, error)
	List(ctx context.Context, filter ListFilter) ([]*model.Combo, error)
	// Count は filter に一致する総数を返す(上限で切り捨てたかの判定に使う)。
	Count(ctx context.Context, filter ListFilter) (int, error)
	UpdateMetadata(ctx context.Context, id int64, version int, input UpdateMetadataInput) (*model.Combo, validation.ValidationResult, error)
	UpdateWithKeyChange(ctx context.Context, oldID int64, version int, input CreateInput) (*model.Combo, validation.ValidationResult, error)
	Delete(ctx context.Context, id int64) error
	// Restore はゴミ箱のコンボを復元する。
	//
	// ★戻り値の ValidationResult は「復元は成功したが注意がある」を表す(M23-04 §4.1)。
	// 復元を中止させる判定ではない——中身が空でなくても復元はコミット済みである。
	Restore(ctx context.Context, id int64) (validation.ValidationResult, error)

	// AcknowledgeGameVersion はコンボの基準を現在のデータバージョンへ進める
	// (FR702 の「確認した」・M28-02a §2.3-4)。更新後のコンボを返す。
	//
	// ★★これは「破綻していない」の断定ではない。利用者が中身を見たという記録である
	// (FR307: アプリは破綻も無事も自動で断定しない)。⇒ 利用者の明示操作でのみ動く。
	// ★1 件ずつ進められることが、基準をコンボ単位に置いた理由そのものである
	// (部分消化 = M28-overview §3.2.7 の軸 3)。
	// ★本サブでは API まで。★【2026-09-13・M37-01 で更新】旧記述「画面は M28-02b」は
	//   失効した —— M28-02b は実装しないまま完了しており(M-137)、画面は M37-01 が作った。
	AcknowledgeGameVersion(ctx context.Context, id int64) (*model.Combo, error)
	PermanentDelete(ctx context.Context, id int64) error
	CheckDuplicate(ctx context.Context, input CheckDuplicateInput) (*CheckDuplicateResult, error)
	// Materialize は基底コンボから確定反撃(パニッシュカウンター版)を別コンボとして生成し、
	// 既存があれば生成せず既存 id を返す。対象外の hit_type は ErrMaterializeIneligibleHitType。
	//
	// ★★M31-01: 戻り値に ValidationResult を足した。生成物は本登録になりうるため
	//   VAL-C15(本登録の必須 4 欄)が掛かる。⇒ 検証エラーは err ではなく結果で返し、
	//   ハンドラが 400 validation_failed へ落とす(Create / UpdateWithKeyChange と同型)。
	Materialize(ctx context.Context, input MaterializeInput) (*MaterializeResult, validation.ValidationResult, error)
}

// ===========================================================================
// 実装
// ===========================================================================

type service struct {
	db          *sql.DB
	repo        comborepo.Repository
	validDeps   validation.Dependencies
	notationSvc notation.Service
	setupSvc    setupsvc.Service
	// defaultPresetID は config の [defaults] preset_id の現在値を返す(M20-05・D-360)。
	//
	// ★固定値を持たず注入で受ける。持つと config を変えても表示が追随しない(D-313)。
	// preset サービスと同じ関数注入のイディオムで、config パッケージへ直接依存させない。
	defaultPresetID func() int64
}

// New は Service 実装を構築する。validation.Dependencies はバリデーション層のための
// 外部リポジトリ束(CharacterRepo / MoveRepo / ComboRepo)。
// setupSvc はコンボ同時登録用（M4-04）。nil 可（テスト用）。
//
// defaultPresetID が nil の場合は「既定プリセットが未注入」として扱い、defaultRecipe は
// 空文字になる(preset.New と同じ nil 扱い)。本番配線では必ず渡すこと。
func New(db *sql.DB, repo comborepo.Repository, validDeps validation.Dependencies, notationSvc notation.Service, setupSvc setupsvc.Service, defaultPresetID func() int64) Service {
	return &service{
		db:              db,
		repo:            repo,
		validDeps:       validDeps,
		notationSvc:     notationSvc,
		setupSvc:        setupSvc,
		defaultPresetID: defaultPresetID,
	}
}

// ---------------------------------------------------------------------------
// Create(POST /api/combos)
// ---------------------------------------------------------------------------

// txScopedDeps は validDeps の複製を返し、重複判定だけを tx 経由の読みへ差し替える
// (M24-11 / CHANGE-136)。
//
// ★★なぜ ComboRepo だけなのか———————————————————————————————
// tx の内側へ入れる必要があるのは「この tx が書いた行を見なければ判定が成立しない」
// ものだけである。VAL-C02 の候補抽出がそれに当たる。
// CharacterRepo(VAL-C01)と MoveRepo(VAL-C08 / VAL-C12)が読むのは characters /
// moves のマスタであり、コンボの書き込み tx はこれらを 1 行も書かない。
// ⇒ 未コミットの行を見る必要が無く、非 tx のままで判定は成立する。
// ★WAL では読みは writer と競合しないため、開いた書き込み tx の内側から読んでも
// SQLITE_BUSY にはならない(M24-11 §4.3 の実査。TestValidationReadsInsideWriteTx が固定)。
//
// ★★ComboRepo が *ComboDuplicateAdapter でない場合は差し替えない————————
// その場合、判定は従来どおり *sql.DB 直読みへ落ちる。★重複判定そのものは
// それでも成立する——BEGIN IMMEDIATE が書き込み tx を直列化するため、2 本目が
// 判定する時点で 1 本目は既に commit している。失われるのは D-360 の規約
// (「tx を取るならその tx を読みにも使う」)の側であり、tx が今まさに書いた行を
// 判定が取りこぼす形になる。
// ★本リポジトリの配線は全数が *ComboDuplicateAdapter である(実装は 1 つしかない)。
// 束ねが効いているときに未コミットの行が見えることは
// TestTxScopedDeps_BindsTxToDuplicateChecker が固定している。
func (s *service) txScopedDeps(tx *sql.Tx) validation.Dependencies {
	deps := s.validDeps
	a, ok := deps.ComboRepo.(*ComboDuplicateAdapter)
	if !ok {
		// ★★黙って落とさない(レビュー指摘 中-8)——————————————————————
		// 束ねが外れても VAL-C02 の正しさは BEGIN IMMEDIATE の直列化が保つため、
		// テストは緑のままである。⇒ 気づく契機が無い。
		// 「今日は必須でない」ものは、外れても誰も気づかない。だから外れたことを
		// 観測できる形にしておく。
		slog.WarnContext(context.Background(),
			"txScopedDeps: ComboRepo が *ComboDuplicateAdapter ではないため tx を束ねられない。"+
				"重複判定が *sql.DB 直読みへ落ちる(D-360 の規約が失われる)",
			slog.String("type", fmt.Sprintf("%T", deps.ComboRepo)))
		return deps
	}
	deps.ComboRepo = a.WithTx(tx)
	return deps
}

func (s *service) Create(ctx context.Context, input CreateInput) (*model.Combo, validation.ValidationResult, error) {
	// ★マス数と区分を整合させてから進む(重複判定より前であること)。
	normalizePositionAndMass(&input)
	combo, steps := buildComboFromInput(input)

	// 1. recipe_hash を計算(VAL-C02 で使う、SUPP-001 §2.2)
	hash := CalcRecipeHash(steps)

	// 2. ★★トランザクションを先に開く(M24-11 / CHANGE-136)————————————————
	// 旧実装はここでバリデーションを済ませてから BeginTx していた。VAL-C02 の判定と
	// INSERT の間に隙が空き、2 つの要求が両方「重複なし」を見て双方が INSERT できた
	// (M24-09c 設計伝達レポート §4-1 が決定論的な観測を持つ)。
	// DSN の _txlock=immediate により、この BeginTx は開始時点で write lock を取る
	// ⇒ 2 本目はここで 1 本目の commit を待ち、その後の判定は commit 済みの行を見る。
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, validation.ValidationResult{}, busyOr(err, "begin tx")
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	// 3. ★バリデーションを同じトランザクションの内側で実行する。
	// ★★判定ロジックは 1 文字も変えていない。変えたのは「いつ・どのハンドルで判定するか」
	// だけである(DES-006 §2.3 の 7 項 + recipe_hash / deleted_at IS NULL / is_draft = 0 は不変)。
	// ★M37-07 で列の側が 6 項 → 7 項になった(starter_meaty)。recipe_hash は不変である。
	result := validation.ValidateComboForCreate(ctx, combo, steps, input.IsDraft, hash, s.txScopedDeps(tx))
	if result.HasError() {
		_ = tx.Rollback()
		return nil, result, nil // ハンドラ側で 400 返却
	}

	combo.Version = 1
	combo.StepCount = len(steps)

	newID, err := s.repo.InsertCombo(ctx, tx, combo)
	if err != nil {
		return nil, result, fmt.Errorf("insert combo: %w", err)
	}
	combo.ID = newID

	if err = s.repo.InsertSteps(ctx, tx, newID, steps); err != nil {
		return nil, result, fmt.Errorf("insert steps: %w", err)
	}

	if len(input.OkiOptions) > 0 {
		if err = s.repo.ReplaceOkiOptions(ctx, tx, newID, input.OkiOptions); err != nil {
			return nil, result, fmt.Errorf("replace oki options: %w", err)
		}
	}

	if err = s.notationSvc.RecomputeComboCache(ctx, tx, newID); err != nil {
		return nil, result, fmt.Errorf("recompute cache: %w", err)
	}

	if len(input.TagIDs) > 0 {
		if err = s.repo.ReplaceTagAssociations(ctx, tx, newID, input.UserID, input.TagIDs); err != nil {
			if isInvalidTagIDErr(err) {
				err = ErrInvalidTagID
				return nil, result, err
			}
			return nil, result, fmt.Errorf("replace tag associations: %w", err)
		}
	}

	// M4-04: セットプレイ同時登録
	if len(input.Setups) > 0 && s.setupSvc != nil {
		for i, setupInput := range input.Setups {
			_, setupResult, setupErr := s.setupSvc.CreateSetupInTx(ctx, tx, newID, setupInput)
			if setupErr != nil {
				err = fmt.Errorf("create setup setups[%d]: %w", i, setupErr)
				return nil, result, err
			}
			if setupResult.HasError() {
				for _, issue := range setupResult.Issues {
					field := issue.Field
					if field != "" {
						field = fmt.Sprintf("setups[%d].%s", i, field)
					} else {
						field = fmt.Sprintf("setups[%d]", i)
					}
					result.Issues = append(result.Issues, validation.ValidationIssue{
						Code:     issue.Code,
						Severity: issue.Severity,
						Field:    field,
						Message:  issue.Message,
					})
				}
				_ = tx.Rollback()
				return nil, result, nil
			}
		}
	}

	if err = tx.Commit(); err != nil {
		return nil, result, fmt.Errorf("commit: %w", err)
	}

	// 4. 完成形を再取得して返す(タイムスタンプ等を埋めるため)
	saved, getErr := s.repo.FindByID(ctx, newID)
	if getErr != nil {
		// INSERT は成功しているのでここはほぼ来ない
		slog.WarnContext(ctx, "create: post-insert FindByID failed", slog.String("err", getErr.Error()))
		combo.ID = newID
		combo.Steps = steps
		return combo, result, nil
	}
	// ★応答も Get / List と同じ絞り込みを通す。ここだけ他人のタグが載ると、
	// 保存直後と再読込で見え方が変わる(M22-02 §4.5-13)。
	filterTagsByUser(saved, input.UserID)
	return saved, result, nil
}

// ---------------------------------------------------------------------------
// Get(GET /api/combos/:id)
// ---------------------------------------------------------------------------

func (s *service) Get(ctx context.Context, id, userID int64) (*model.Combo, error) {
	combo, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	combo.DefaultRecipe = s.extractDefaultRecipe(combo.RecipeCache)
	filterTagsByUser(combo, userID)
	return combo, nil
}

// ---------------------------------------------------------------------------
// GetDeleted(GET /api/combos/:id/deleted・M23-07 §4.2)
// ---------------------------------------------------------------------------

func (s *service) GetDeleted(ctx context.Context, id, userID int64) (*model.Combo, error) {
	combo, err := s.repo.FindByIDAllowDeletedWithChildren(ctx, id)
	if err != nil {
		return nil, err
	}
	combo.DefaultRecipe = s.resolveRecipeWithoutCache(ctx, combo)
	filterTagsByUser(combo, userID)
	return combo, nil
}

// resolveRecipeWithoutCache は combo_steps からレシピ表示文字列を組み立てる(M23-07 §4.2-4)。
//
// ★recipe_cache を読まない・書かない。論理削除の時点で combos.recipe_cache は NULL に
// なるため(service.Delete → notation.DeleteComboCache)、キャッシュ経由では出せない。
// combo_steps は論理削除で消えない(repository.SoftDelete は combos の 1 行しか触らない)
// ため、ステップからの再構成は構造的に成立する。
// ★書き戻さないのは DES-002 §4.2 の不変である(M23-06 がセットプレイ側で固定した)。
//
// ★解決に失敗しても詳細そのものを落とさない(DES-002 §4.2 の縮退の規則)。
// レシピ欄だけを空にしてログへ残す——完全削除は不可逆であり、中身を確認する
// 画面が開けないことのほうが、レシピ 1 欄が欠けることより悪い。
func (s *service) resolveRecipeWithoutCache(ctx context.Context, combo *model.Combo) string {
	if s.defaultPresetID == nil {
		return ""
	}
	// ★ComputeSingleCache は FindStepsForCombos → resolveRecipe の 2 段であり、
	// DB へ書き込まない(書き戻しは呼び出し元の ResolveComboRecipe 側にある)。
	// M23-06 がセットプレイ側で ResolveDeletedSetupRecipes を新設したのと同じ形を、
	// コンボ側は既存の計算本体を呼ぶだけで満たせる。
	text, err := s.notationSvc.ComputeSingleCache(ctx, combo.ID, s.defaultPresetID())
	if err != nil {
		slog.WarnContext(ctx, "resolve deleted combo recipe failed; falling back to empty",
			slog.Int64("comboId", combo.ID), slog.String("err", err.Error()))
		return ""
	}
	return text
}

// filterTagsByUser はコンボに紐づくタグを、いま見ている利用者のものだけへ絞る。
//
// ★コンボは全員で共有し(FR013 前半)、タグは利用者ごとに閉じている(D-402)。
// combo_tags は利用者の列を持たないため、読み出し(findTagsByComboIDs)は
// そのコンボに紐づく全員のタグを返す。ここで絞らないと 2 つのことが起きる——
//  1. A のタグが B の画面に出る
//  2. ★既定タグは利用者ごとに同名で生成されるため(UNIQUE (user_id, name) により
//     同名の並存は正常)、A の「使用中」が B 自身のステータスとして判定されうる。
//     ⇒ B が設定していない状態が、B のものとして表示される。
//
// ★userID が 0(解決できなかった)なら 1 件も返さない。緩めると「絞り忘れても
// 見た目は動く」形になり、破れても緑のままになるためである。
func filterTagsByUser(combo *model.Combo, userID int64) {
	if combo == nil || combo.Tags == nil {
		return
	}
	own := make([]model.Tag, 0, len(combo.Tags))
	for _, t := range combo.Tags {
		if t.UserID == userID {
			own = append(own, t)
		}
	}
	combo.Tags = own
}

// ---------------------------------------------------------------------------
// List(GET /api/combos)
// ---------------------------------------------------------------------------

func (s *service) List(ctx context.Context, filter ListFilter) ([]*model.Combo, error) {
	combos, err := s.repo.List(ctx, filter)
	if err != nil {
		return nil, err
	}
	for _, c := range combos {
		c.DefaultRecipe = s.extractDefaultRecipe(c.RecipeCache)
		filterTagsByUser(c, filter.UserID)
	}
	return combos, nil
}

// Count は filter に一致するコンボの総数を返す。
//
// ★List と違い LIMIT を掛けない。⇒ 「一覧に載った件数」と「本当は何件あるか」を
// 別々に持てるようにするための経路である(M29-02 §2.1)。上限は 1 つも変えていない。
func (s *service) Count(ctx context.Context, filter ListFilter) (int, error) {
	return s.repo.Count(ctx, filter)
}

// extractDefaultRecipe は既定プリセットのレシピ表示文字列を取り出す。
//
// ★M20-05(D-360)で、同内容の private 複製を廃して model.ExtractDefaultRecipe へ寄せた。
// 既定プリセット ID は注入された config の値から取る(固定値 "1" は撤去済み)。
func (s *service) extractDefaultRecipe(cache *string) string {
	if s.defaultPresetID == nil {
		return ""
	}
	return model.ExtractDefaultRecipe(cache, s.defaultPresetID())
}

// ---------------------------------------------------------------------------
// UpdateMetadata(PATCH /api/combos/:id)
// ---------------------------------------------------------------------------

// applyMetadataInput は current のコピーに input の Present なフィールドを適用した
// 「更新後の状態」を返す(current は変更しない)。バリデーション専用で、永続化には
// 使わない(永続化は repository.UpdateMetadata が SQL 側で同じ規則を適用する)。
// 空の current を渡すと「input の新値のみを持つ検証用プローブ」になる。
func applyMetadataInput(current *model.Combo, input UpdateMetadataInput) *model.Combo {
	merged := *current
	if input.IsDraft != nil {
		merged.IsDraft = *input.IsDraft
	}
	if input.Damage.Present {
		merged.Damage = input.Damage.Value
	}
	if input.DriveAvailableAtStart.Present {
		merged.DriveAvailableAtStart = input.DriveAvailableAtStart.Value
	}
	if input.SAAvailableAtStart.Present {
		merged.SAAvailableAtStart = input.SAAvailableAtStart.Value
	}
	if input.DriveDamage.Present {
		merged.DriveDamage = input.DriveDamage.Value
	}
	if input.SAGaugeConsumed.Present {
		merged.SAGaugeConsumed = input.SAGaugeConsumed.Value
	}
	if input.DriveGaugeConsumed.Present {
		merged.DriveGaugeConsumed = input.DriveGaugeConsumed.Value
	}
	if input.KnockdownAdvantage.Present {
		merged.KnockdownAdvantage = input.KnockdownAdvantage.Value
	}
	// ★M37-01: マス数 2 列。★検証(ValidateMetadataRanges)が新値を見るために要る。
	//   ★position は merge しない —— 区分をまたぐマス変更はフロントが PUT へ振り分ける。
	if input.StartPositionMass.Present {
		merged.StartPositionMass = input.StartPositionMass.Value
	}
	if input.CarryDistanceMass.Present {
		merged.CarryDistanceMass = input.CarryDistanceMass.Value
	}
	// ★M27-02b: NOT NULL の bool なので Value(*bool)の nil は「変更なし」ではなく
	//   present の有無で判定する。present + nil は起きない(zod / DTO とも bool を送る)。
	if input.OkiVerified.Present && input.OkiVerified.Value != nil {
		merged.OkiVerified = *input.OkiVerified.Value
	}
	if input.Memo.Present {
		merged.Memo = input.Memo.Value
	}
	if input.Situation.Present {
		merged.Situation = input.Situation.Value
	}
	// メディア 3 列(M17-01): 緩検証(VAL 非連動)だが、検証プローブの網羅性維持のため
	// memo と同様に merge しておく。
	if input.Link.Present {
		merged.Link = input.Link.Value
	}
	if input.VideoPath.Present {
		merged.VideoPath = input.VideoPath.Value
	}
	if input.ImagePath.Present {
		merged.ImagePath = input.ImagePath.Value
	}
	// 起き攻めオプション(M16-03): replace-set。nil=不変更 / 非 nil=全置換。
	// VAL-C11 は置換後の状態(merged.OkiOptions)に対して検証する。
	if input.OkiOptions != nil {
		merged.OkiOptions = *input.OkiOptions
	}
	return &merged
}

func (s *service) UpdateMetadata(ctx context.Context, id int64, version int, input UpdateMetadataInput) (*model.Combo, validation.ValidationResult, error) {
	result := validation.ValidationResult{}

	// ★★トランザクションを先に開く(M24-11 / CHANGE-136。★レビュー指摘 高-1 で追加)————
	// 本経路は VAL-C02 の 4 経路目である。仮登録→本登録の昇格(下記)は
	// 「is_draft を 0 にする」＝重複判定の母集団へ行を持ち込む操作であり、
	// POST / PUT / materialize と同型の check-then-act になる。
	//
	// ★同一識別キーの仮登録 2 件を同時に昇格させる、または昇格と POST を同時に走らせると、
	// 双方が「重複なし」を見て双方が本登録になりうる。
	//
	// ★★CHANGE-136 §2.3 の適用面は「POST / PUT / materialize の 3 経路」と書かれているが、
	// 実装の適用面は 4 経路である(設計卓は実装ソースを読めないため＝指示書 §1.1.4)。
	// ⇒ as-built は 4 経路。設計卓へ申し送る。
	//
	// ★昇格しない PATCH(メタデータのみの更新)では VAL-C02 は走らない。それでも tx を先に
	// 開くのは、経路ごとに開き方を選ぶと「次に足す経路が忘れる」ためである(§4.1.2 と同じ理由)。
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, result, busyOr(err, "begin tx")
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	// ★★本経路は「更新前の姿」を最大 4 か所で要る(昇格判定 / VAL-C15 / KA 変更 /
	//   M37-05 のマス数補完)。FindByID は attachComboChildren 経由で steps / tags /
	//   okiOptions / starterMoveCode まで読む重い呼び出しであり、そのたびに引くと
	//   PATCH 1 回あたりの往復が積み上がる。⇒ 1 回だけ引いて使い回す。
	//
	// ★★各呼び出し元のエラーの扱いは変えていない —— 本ヘルパは素の FindByID と
	//   同じ (値, エラー) を返すだけであり、握り潰し方の違い(KA 変更の分岐は
	//   findErr == nil のときだけ進む)は呼び出し側にそのまま残してある。
	// ★読むのは tx の外である(既存 3 か所と同じ)。版による楽観ロックが守る。
	var loadedCurrent *model.Combo
	currentBefore := func() (*model.Combo, error) {
		if loadedCurrent != nil {
			return loadedCurrent, nil
		}
		c, loadErr := s.repo.FindByID(ctx, id)
		if loadErr != nil {
			return nil, loadErr
		}
		loadedCurrent = c
		return c, nil
	}

	// M2-02: is_draft を true→false に変更する場合（本登録昇格）、フルバリデーションを実行。
	// 検証対象は「同一リクエストの新値を反映した後の状態」(applyMetadataInput)。DB 上の旧値に
	// 対して検証すると、昇格と同時に渡された範囲外メタデータが素通りする。
	promoting := false
	if input.IsDraft != nil && !*input.IsDraft {
		current, findErr := currentBefore()
		if findErr != nil {
			err = findErr
			return nil, result, findErr
		}
		if current.IsDraft {
			promoting = true
			merged := applyMetadataInput(current, input)
			hash := CalcRecipeHash(current.Steps)
			// ★判定を同じトランザクションの内側で、その tx を使って読む。
			result = validation.ValidateComboForCreate(ctx, merged, current.Steps, false, hash, s.txScopedDeps(tx))
			if result.HasError() {
				_ = tx.Rollback()
				return nil, result, nil
			}
		}
	}

	// 軽量バリデーション(範囲チェックのみ。重複判定や recipe バリデーションは PUT で扱う)。
	// 値ありのときのみ範囲チェック(present+null=NULL クリアは対象外)。範囲は Create 経路と
	// 同一基準(VAL-C04/C05/C13 = ERROR で保存中止、VAL-C10 = WARNING)。
	// 昇格時は上のフルバリデーションが merged に対して同じチェックを実施済みのためスキップ。
	// 注: drive_available_at_start は M16-01 で INTEGER→REAL 化済み(0.5 刻み・旧マイグレ 000019)。
	if !promoting {
		validation.ValidateMetadataRanges(&result, applyMetadataInput(&model.Combo{}, input))
		if result.HasError() {
			_ = tx.Rollback()
			return nil, result, nil
		}

		// ★★M27-02b(VAL-C15): 本登録の必須項目は PATCH でも守る。
		//
		// ★★ここを抜かすと、必須化を守るのがフロントの zod だけになる——
		//   **編集画面の保存は識別キーが変わらない限り PATCH である**
		//   (utils.hasKeyChanges)。⇒ PUT だけに掛けると主経路が素通りする。
		//   `DES-006` §1.1 は「BE が主たる責任者・FE は第一防衛線」と定めている。
		// ★★`UpdateMetadataInput` の 4 欄は Optional であり present+null は
		//   NULL クリアとして通る。⇒ 掛けないと **必須にしたばかりの欄を空にできる**。
		//
		// ★見るのは「更新後の姿」である。入力だけを見ると、今回触っていない欄が
		//   未入力に見えて誤って咎める。
		// ★仮登録のままなら掛けない(SUPP-001 §2.1)。本登録へ変わる場合は上の
		//   promoting 分岐がフルバリデーションを済ませているのでここへは来ない。
		current, findErr := currentBefore()
		if findErr != nil {
			err = findErr
			return nil, result, findErr
		}
		if !current.IsDraft {
			validation.ValidateRequiredForPublished(&result, applyMetadataInput(current, input))
			if result.HasError() {
				_ = tx.Rollback()
				return nil, result, nil
			}
		}
	}

	// M4-03: KA 変更(present。値更新・NULL クリアいずれも変更扱い)+ setupCarryOptions nil + 紐付き setup ≥ 1 → エラー
	if input.KnockdownAdvantage.Present && input.SetupCarryOptions == nil {
		current, findErr := currentBefore()
		if findErr == nil && !intPtrEqual(current.KnockdownAdvantage, input.KnockdownAdvantage.Value) {
			count, countErr := s.repo.CountComboSetupsByComboID(ctx, id)
			if countErr != nil {
				err = fmt.Errorf("count combo setups: %w", countErr)
				return nil, result, err
			}
			if count > 0 {
				err = ErrMissingSetupCarryOptions
				return nil, result, err
			}
		}
	}

	// ★★★M37-05: 不変条件 start_position_mass IS NULL ⇔ position = 不問 を PATCH でも守る
	//   (D-864)。★POST / PUT は着手前から normalizePositionAndMass で成り立っており、
	//   穴は本経路 1 本だけであった(CHANGE-195 §2.3 の「持たせなかった分岐 1」)。
	//
	// ★★normalizePositionAndMass はここから呼ばない —— 同関数は導出(マス数 → position)も
	//   行い、区分をまたぐマス数が届くと position が黙って変わるためである(指示書 §0.3 / §4.1)。
	//   ⇒ 補完の半分だけを持つ fillStartPositionMassForPatch を使う。
	//
	// ★current を引くのは「キー不在(= Present == false)のときの更新後の値」が DB 側にしか
	//   無いためである。★FindByID は行が無いとき ErrNotFound を返し、直後の
	//   repo.UpdateMetadata が返す値と同一である ⇒ エラー面は変わらない。
	currentForMass, findErr := currentBefore()
	if findErr != nil {
		err = findErr
		return nil, result, err
	}
	fillStartPositionMassForPatch(currentForMass, &input)

	if _, err = s.repo.UpdateMetadata(ctx, tx, id, version, input); err != nil {
		return nil, result, err // ErrNotFound / ErrConflict は呼出側で判別
	}

	if input.TagIDs != nil {
		if err = s.repo.ReplaceTagAssociations(ctx, tx, id, input.UserID, *input.TagIDs); err != nil {
			if isInvalidTagIDErr(err) {
				err = ErrInvalidTagID
				return nil, result, err
			}
			return nil, result, fmt.Errorf("replace tag associations: %w", err)
		}
	}

	// 起き攻めオプション(M16-03): replace-set。nil=不変更 / 非 nil(空含む)=全置換。
	if input.OkiOptions != nil {
		if err = s.repo.ReplaceOkiOptions(ctx, tx, id, *input.OkiOptions); err != nil {
			return nil, result, fmt.Errorf("replace oki options: %w", err)
		}
	}

	// M4-03: setupCarryOptions の処理
	if input.SetupCarryOptions != nil {
		switch input.SetupCarryOptions.Mode {
		case "carry_all":
			// combo_setups は変更しない
		case "unlink_all":
			if err = s.repo.DeleteComboSetupsByComboID(ctx, tx, id); err != nil {
				return nil, result, fmt.Errorf("unlink all setups: %w", err)
			}
		case "individual":
			if err = s.repo.DeleteComboSetupsByComboIDExcluding(ctx, tx, id, input.SetupCarryOptions.CarrySetupIDs); err != nil {
				return nil, result, fmt.Errorf("unlink excluded setups: %w", err)
			}
		default:
			err = ErrInvalidSetupCarryMode
			return nil, result, err
		}
	}

	if err = tx.Commit(); err != nil {
		return nil, result, fmt.Errorf("commit: %w", err)
	}

	saved, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, result, err
	}
	filterTagsByUser(saved, input.UserID)
	return saved, result, nil
}

// ---------------------------------------------------------------------------
// UpdateWithKeyChange(PUT /api/combos/:id、レシピ等の重複判定キー変更)
// ---------------------------------------------------------------------------

// HANDOVER-001 §3.1: キー変更編集は「旧コンボ論理削除 → 新コンボ作成 →
// combo_setups 引き継ぎ」をトランザクション内で実行。
func (s *service) UpdateWithKeyChange(ctx context.Context, oldID int64, version int, input CreateInput) (*model.Combo, validation.ValidationResult, error) {
	// ★マス数と区分を整合させてから進む(重複判定より前であること)。
	normalizePositionAndMass(&input)
	combo, steps := buildComboFromInput(input)
	hash := CalcRecipeHash(steps)

	// ★★トランザクションを先に開く(M24-11 / CHANGE-136)————————————————
	// POST と同じ理由である。開始時点で write lock を取り、判定と登録の間に
	// 割り込まれない 1 つの操作にする。
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, validation.ValidationResult{}, busyOr(err, "begin tx")
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	// バリデーション(重複判定では旧コンボを除外したいが、論理削除されると候補から
	// 自然に消えるため、旧コンボを先に削除してから VAL を実行する作りでも良い。
	// ここでは VAL 後に同一トランザクションで削除→挿入する素直な実装にする)。
	//
	// ★★判定は「旧行がまだ生きている」時点で行う。この順序は変えていない———————
	// 下の論理削除より前に置くことが要である。後ろへ動かすと旧行が候補から消え、
	// 「キーを変えない PUT は自分の旧行に当たる」という既存の挙動が黙って変わる。
	// その挙動自体は本サブの射程外であり、変えない(指示書 M24-11 §1.3-3)。
	result := validation.ValidateComboForCreate(ctx, combo, steps, input.IsDraft, hash, s.txScopedDeps(tx))
	if result.HasError() {
		// 旧コンボの id と一致する候補が VAL-C02 でヒットしている可能性を後で除外する余地あり。
		// 実装簡素化のため、現状は呼出側に「oldID が候補にいる場合はクライアント側で承認」を委ねる。
		// M1-03 の curl シナリオでは PUT は本質的にレシピ変更なので問題は起きにくい。
		_ = tx.Rollback()
		return nil, result, nil
	}

	// M4-03: KA 変更 + setupCarryOptions nil + 紐付き setup ≥ 1 → エラー
	//
	// ★バリデーションより後のままである(エラーの優先順位を変えない)。読むのは
	// コミット済みの旧行であり、非 tx のままで判定は成立する。
	if input.SetupCarryOptions == nil {
		oldCombo, findErr := s.repo.FindByID(ctx, oldID)
		if findErr == nil && !intPtrEqual(oldCombo.KnockdownAdvantage, input.KnockdownAdvantage) {
			count, countErr := s.repo.CountComboSetupsByComboID(ctx, oldID)
			if countErr != nil {
				err = fmt.Errorf("count combo setups: %w", countErr)
				return nil, result, err
			}
			if count > 0 {
				err = ErrMissingSetupCarryOptions
				return nil, result, err
			}
		}
	}

	// 1. 旧コンボの楽観的排他チェック(version 確認 + 論理削除を 1 文で)
	res, execErr := tx.ExecContext(ctx,
		`UPDATE combos SET deleted_at = datetime('now'), updated_at = datetime('now')
		 WHERE id = ? AND version = ? AND deleted_at IS NULL`, oldID, version)
	if execErr != nil {
		err = fmt.Errorf("soft delete old: %w", execErr)
		return nil, result, err
	}
	rows, raErr := res.RowsAffected()
	if raErr != nil {
		err = fmt.Errorf("rows affected: %w", raErr)
		return nil, result, err
	}
	if rows == 0 {
		// 存在しないか version 不一致
		var active int
		if scanErr := tx.QueryRowContext(ctx, "SELECT COUNT(*) FROM combos WHERE id = ? AND deleted_at IS NULL", oldID).Scan(&active); scanErr != nil {
			err = fmt.Errorf("scan active: %w", scanErr)
			return nil, result, err
		}
		if active == 0 {
			err = ErrNotFound
			return nil, result, err
		}
		err = ErrConflict
		return nil, result, err
	}

	// 2. 新コンボ INSERT
	combo.Version = 1
	combo.StepCount = len(steps)

	newID, insertErr := s.repo.InsertCombo(ctx, tx, combo)
	if insertErr != nil {
		err = fmt.Errorf("insert new combo: %w", insertErr)
		return nil, result, err
	}
	combo.ID = newID

	// 2-b. 旧行へ後継 id を書く(M23-01 §4.2)。
	//    上の 1 の論理削除の時点では新行 id がまだ確定していないため、1 文にまとめず
	//    id 確定後にここで書く。同一トランザクション内であることが要件であり(§4.2-5)、
	//    新行の作成が失敗した場合は本書き込みも巻き戻る。
	//    ★version は動かさない(旧行は論理削除済みで版を動かす経路が無い＝§4.2-3)。
	//    ★updated_at も触らない。上の 1 が論理削除と同時に更新済みであり、本サブで
	//      新しい規則を作らない(§4.2-4)。
	//    ★PATCH /api/combos/:id(メタデータ編集)は行を積まないため書かない(§4.2-6)。
	if _, supErr := tx.ExecContext(ctx,
		`UPDATE combos SET superseded_by_combo_id = ? WHERE id = ?`, newID, oldID); supErr != nil {
		err = fmt.Errorf("mark superseded: %w", supErr)
		return nil, result, err
	}

	if stepErr := s.repo.InsertSteps(ctx, tx, newID, steps); stepErr != nil {
		err = fmt.Errorf("insert steps: %w", stepErr)
		return nil, result, err
	}

	// 3. combo_setups の付け替え(セットプレイ引き継ぎ、HANDOVER-001 §3.1 / M4-03 拡張)
	if input.SetupCarryOptions != nil {
		switch input.SetupCarryOptions.Mode {
		case "carry_all":
			if linkErr := s.repo.UpdateSetupReferences(ctx, tx, oldID, newID); linkErr != nil {
				err = fmt.Errorf("update setup refs: %w", linkErr)
				return nil, result, err
			}
		case "unlink_all":
			// 生きたセットプレイの紐付けは転写しない。
			if delErr := s.repo.DeleteComboSetupsByComboID(ctx, tx, oldID); delErr != nil {
				err = fmt.Errorf("unlink all setups: %w", delErr)
				return nil, result, err
			}
			// ★M23-08 §4.5: 上の解除は生きたセットプレイの紐付けだけを落とす。
			//   残った「削除済みセットプレイの紐付け」を新コンボへ移す。移さないと、
			//   利用者に見えなかった紐付けが論理削除済みの旧行に取り残され、
			//   セットプレイを復元しても現役のコンボへ戻らない。
			//   ★individual 分岐が既に採っている形と同じである。
			if linkErr := s.repo.UpdateSetupReferences(ctx, tx, oldID, newID); linkErr != nil {
				err = fmt.Errorf("update setup refs: %w", linkErr)
				return nil, result, err
			}
		case "individual":
			if delErr := s.repo.DeleteComboSetupsByComboIDExcluding(ctx, tx, oldID, input.SetupCarryOptions.CarrySetupIDs); delErr != nil {
				err = fmt.Errorf("unlink excluded setups: %w", delErr)
				return nil, result, err
			}
			if linkErr := s.repo.UpdateSetupReferences(ctx, tx, oldID, newID); linkErr != nil {
				err = fmt.Errorf("update setup refs: %w", linkErr)
				return nil, result, err
			}
		default:
			err = ErrInvalidSetupCarryMode
			return nil, result, err
		}
	} else {
		if linkErr := s.repo.UpdateSetupReferences(ctx, tx, oldID, newID); linkErr != nil {
			err = fmt.Errorf("update setup refs: %w", linkErr)
			return nil, result, err
		}
	}

	// 3-b. セットプレイ成立条件の検証結果の引き継ぎ(M19-03 §4.2)。
	//    combo_setup_results の FK 親は combo_setups であり、上の 3 で親キー(combo_id)が
	//    UPDATE されるため、FK=ON の接続では ON UPDATE CASCADE が既に子行を追従させている
	//    (この呼び出しは 0 行更新の no-op になる)。
	//    それでも明示的に呼ぶのは、M19-03 当時 infra/db.Open が PRAGMA foreign_keys=ON を
	//    プール中の 1 接続にしか適用しておらず、FK=OFF の接続が混在する実測があったため。
	//    FK=OFF の接続がここを処理すると CASCADE が発火せず、ユーザーが実機で検証した
	//    成立条件が旧 combo_id 側に取り残されて画面から消える(データ消失)。
	//    ★M23-10 で全接続が FK=ON になり接続ごとの差は無くなったが、この明示呼び出しは
	//    二重の保険として残す(撤去は M23-10 の判断事項ではない)。
	//    必ず UpdateSetupReferences の「後」に呼ぶこと(先に呼ぶと FK=ON 下で移動先の
	//    (新 combo_id, setup_id) がまだ無く FK 違反になる)。
	//    unlink_all / individual で解除された組の結果行は、解除時に
	//    DeleteComboSetups* 側が落としているためここには残らない。
	//    ★M23-08 §4.5: 「解除された組」は生きたセットプレイの分だけになった。削除済み
	//      セットプレイの紐付けは解除されずに残るため、その結果行も本呼び出しが新
	//      combo_id へ移す(移さないと旧 combo_id 側に取り残される)。
	if resultErr := s.repo.MoveSetupResultReferences(ctx, tx, oldID, newID); resultErr != nil {
		err = fmt.Errorf("move setup result references: %w", resultErr)
		return nil, result, err
	}

	// 4. 確定反撃の採用引き継ぎ(M18-03b §4.6・裁定11)。
	//    combo_setups が SetupCarryOptions で新コンボへ引き継がれるのと同型に、
	//    combo_punishes / combo_punish_curations の combo_id を旧→新へ付け替える。
	//    これを行わないと識別キー変更編集で採用が全画面から silent に消える(followup §I-(b))。
	//    opponent_move_id・note は不変。同一トランザクションで実行し、片方だけ移る状態を作らない。
	if punishErr := s.repo.MovePunishReferences(ctx, tx, oldID, newID); punishErr != nil {
		err = fmt.Errorf("move punish references: %w", punishErr)
		return nil, result, err
	}

	if cacheErr := s.notationSvc.DeleteComboCache(ctx, tx, oldID); cacheErr != nil {
		err = fmt.Errorf("delete old cache: %w", cacheErr)
		return nil, result, err
	}
	if cacheErr := s.notationSvc.RecomputeComboCache(ctx, tx, newID); cacheErr != nil {
		err = fmt.Errorf("recompute cache: %w", cacheErr)
		return nil, result, err
	}

	if len(input.TagIDs) > 0 {
		if tagErr := s.repo.ReplaceTagAssociations(ctx, tx, newID, input.UserID, input.TagIDs); tagErr != nil {
			if isInvalidTagIDErr(tagErr) {
				err = ErrInvalidTagID
				return nil, result, err
			}
			err = fmt.Errorf("replace tag associations: %w", tagErr)
			return nil, result, err
		}
	}

	if len(input.OkiOptions) > 0 {
		if okiErr := s.repo.ReplaceOkiOptions(ctx, tx, newID, input.OkiOptions); okiErr != nil {
			err = fmt.Errorf("replace oki options: %w", okiErr)
			return nil, result, err
		}
	}

	if err = tx.Commit(); err != nil {
		return nil, result, fmt.Errorf("commit: %w", err)
	}

	saved, getErr := s.repo.FindByID(ctx, newID)
	if getErr != nil {
		slog.WarnContext(ctx, "key change: post-insert FindByID failed", slog.String("err", getErr.Error()))
		combo.Steps = steps
		return combo, result, nil
	}
	filterTagsByUser(saved, input.UserID)
	return saved, result, nil
}

// ---------------------------------------------------------------------------
// Delete(DELETE /api/combos/:id、論理削除)
// ---------------------------------------------------------------------------

func (s *service) Delete(ctx context.Context, id int64) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	if err = s.repo.SoftDelete(ctx, tx, id); err != nil {
		return err
	}

	if err = s.notationSvc.DeleteComboCache(ctx, tx, id); err != nil {
		return fmt.Errorf("delete cache: %w", err)
	}

	if err = tx.Commit(); err != nil {
		return fmt.Errorf("commit: %w", err)
	}
	return nil
}

// ---------------------------------------------------------------------------
// Restore(POST /api/combos/:id/restore)
// ---------------------------------------------------------------------------

// Restore はゴミ箱のコンボを復元する。
//
// ★M23-04: 復元の直後・同一トランザクション内で検証を走らせ、結果を戻り値へ載せる。
// ★検証の結果で復元を取り消さない(M23-04 §4.1)。VAL-C08 も VAL-R01 も WARNING だが、
// 仮に ERROR 種別が混ざっても中止しない——落とすと利用者は取り返す手段を失い、
// ゴミ箱が安全網でなくなる(D-463)。DES-006 §1.1「例外はブロッキング」に対する
// 明示的な例外である。★後から「ERROR なのに止めていない」を不具合として直さないこと。
//
// ★「削除済みでない行の復元は 404」は従来どおりである。これは検証ではなく前提条件で
// あり、本サブは触っていない(repo.Restore の WHERE deleted_at IS NOT NULL)。
func (s *service) Restore(ctx context.Context, id int64) (validation.ValidationResult, error) {
	var result validation.ValidationResult

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return result, fmt.Errorf("begin tx: %w", err)
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	if err = s.repo.Restore(ctx, tx, id); err != nil {
		return result, err
	}

	if err = s.notationSvc.RecomputeComboCache(ctx, tx, id); err != nil {
		return result, fmt.Errorf("recompute cache: %w", err)
	}

	// ★検証は Commit の直前・Tx の内側(M23-04 §4.2)。
	// ★戻り値の err へ代入しない——検証の失敗で defer がロールバックしてしまう。
	result = s.validateRestoredCombo(ctx, tx, id)

	if err = tx.Commit(); err != nil {
		return validation.ValidationResult{}, fmt.Errorf("commit: %w", err)
	}
	return result, nil
}

// ---------------------------------------------------------------------------
// AcknowledgeGameVersion(FR702 の「確認した」・M28-02a §2.3-4)
// ---------------------------------------------------------------------------

// AcknowledgeGameVersion は基準を現在のデータバージョンへ進める。
// 呼び出し規約は Service インタフェース側の godoc を参照。
func (s *service) AcknowledgeGameVersion(ctx context.Context, id int64) (*model.Combo, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, busyOr(err, "acknowledge game version begin tx")
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	if err = s.repo.AdvanceBaselineVersion(ctx, tx, id, gamerepo.CodeSF6); err != nil {
		return nil, err // ErrNotFound はハンドラで 404
	}

	if err = tx.Commit(); err != nil {
		return nil, fmt.Errorf("acknowledge game version commit: %w", err)
	}
	// ★コミット後に読み直す —— 判定(affected_by_game_update)は導出値であり、
	//   進めた結果それが false になったことを応答で返せるようにする。
	return s.repo.FindByID(ctx, id)
}

// ---------------------------------------------------------------------------
// CheckTrashDuplicate(VAL-C14・M23-05 §4.1)
// ---------------------------------------------------------------------------

// CheckTrashDuplicate は M23-05 §4.1 の VAL-C14 を判定する。呼び出し規約は
// Service インタフェース側の godoc を参照(★POST /api/combos の経路専用)。
func (s *service) CheckTrashDuplicate(ctx context.Context, comboID int64) validation.ValidationResult {
	var result validation.ValidationResult

	combo, err := s.repo.FindByID(ctx, comboID)
	if err != nil {
		slog.ErrorContext(ctx, "trash duplicate check: find combo",
			slog.Int64("comboId", comboID), slog.String("err", err.Error()))
		return validation.ValidationResult{}
	}

	// ★仮登録は判定しない。「仮登録と本登録の間では重複判定は行わない」は既定の方針で
	//   あり(DES-006 §2.3 / M23-05 §1.4-5)、VAL-C02 も draft を完全スキップしている。
	//   走らせると、試案を作るたびにゴミ箱の警告が出る形になる。
	// ★推測: 指示書は母集団側の is_draft = 0 しか明示していないため、「draft を作るとき
	//   判定するか」は VAL-C02 の先例に揃えると仮定した(M23-05 §9.2)。
	if combo.IsDraft {
		return result
	}

	candidates, err := s.findDeletedDuplicateCandidates(ctx, combo)
	if err != nil {
		slog.ErrorContext(ctx, "trash duplicate check: find deleted candidates",
			slog.Int64("comboId", comboID), slog.String("err", err.Error()))
		return validation.ValidationResult{}
	}

	steps, err := s.repo.FindStepsForCombos(ctx, []int64{comboID})
	if err != nil {
		slog.ErrorContext(ctx, "trash duplicate check: find own steps",
			slog.Int64("comboId", comboID), slog.String("err", err.Error()))
		return validation.ValidationResult{}
	}
	validation.ValidateC14DuplicateInTrash(&result, CalcRecipeHash(steps[comboID]), candidates)
	return result
}

// findDeletedDuplicateCandidates は VAL-C14 の候補を集め、各候補のレシピハッシュを埋める。
//
// ★VAL-C02 と同じ 2 段である——SQL でキー 7 項を絞り、候補ごとに steps を読んで
// CalcRecipeHash で比較する(M23-05 §4.4)。★SQL の近似で済ませないこと。
func (s *service) findDeletedDuplicateCandidates(ctx context.Context, combo *model.Combo) ([]validation.DuplicateComboRef, error) {
	return s.findDeletedDuplicateRefsByKey(ctx, duplicateKeyOf(combo))
}

// findDeletedDuplicateRefsByKey は判定キーからゴミ箱の候補を集める(M23-09 §4.1-1)。
//
// ★★VAL-C14(CheckTrashDuplicate)と保存前チェック(CheckDuplicate)が、必ずこの 1 本を通る。
// 母集団を 2 か所に書くと片方だけ直されて静かにずれるため、入口だけを分けてある——
// VAL-C14 は保存後なので combos の行から(duplicateKeyOf)、保存前チェックはまだ行が無いので
// 入力からキーを組んで渡す。★どちらも同じ述語・同じレシピ比較を通る。
func (s *service) findDeletedDuplicateRefsByKey(ctx context.Context, key comborepo.DuplicateKey) ([]validation.DuplicateComboRef, error) {
	candidates, err := s.repo.FindDeletedByDuplicateKey(ctx, key)
	if err != nil {
		return nil, fmt.Errorf("find deleted by duplicate key: %w", err)
	}
	return s.withRecipeHashes(ctx, candidates)
}

// withRecipeHashes は候補群の steps をバルク取得して DuplicateComboRef へ詰める。
func (s *service) withRecipeHashes(ctx context.Context, candidates []model.Combo) ([]validation.DuplicateComboRef, error) {
	if len(candidates) == 0 {
		return nil, nil
	}
	ids := make([]int64, len(candidates))
	for i, c := range candidates {
		ids[i] = c.ID
	}
	stepsByID, err := s.repo.FindStepsForCombos(ctx, ids)
	if err != nil {
		return nil, fmt.Errorf("find steps for candidates: %w", err)
	}
	refs := make([]validation.DuplicateComboRef, len(candidates))
	for i, c := range candidates {
		refs[i] = validation.DuplicateComboRef{
			ID:         c.ID,
			Memo:       c.Memo,
			RecipeHash: CalcRecipeHash(stepsByID[c.ID]),
		}
	}
	return refs, nil
}

// duplicateKeyOf は combos の 1 行から重複判定キー 7 項を組む(M23-05 §4.1-2 / M37-07)。
//
// ★validateC02Duplicate が組んでいるものと同じ定義である。別の定義を作らないこと——
// 2 つの「同じ」が並ぶと、片方だけ直されて静かにずれる。
func duplicateKeyOf(combo *model.Combo) comborepo.DuplicateKey {
	return comborepo.DuplicateKey{
		CharacterID:    combo.CharacterID,
		StarterMoveID:  combo.StarterMoveID,
		Position:       combo.Position,
		OpponentStance: combo.OpponentStance,
		HitType:        combo.HitType,
		OpponentSize:   combo.OpponentSize,
		StarterMeaty:   combo.StarterMeaty,
	}
}

// validateR03 は復元直後のコンボに VAL-R03 を適用する(M23-05 §4.1)。
//
// ★検証だけが失敗した場合は、その検証を捨てて復元を成功させる。ログには残す
// (M23-04 §4.2 末尾と同じ扱い)——検証は付加価値であり、それが壊れたことで復元という
// 利用者の主目的を巻き添えにしない。
func (s *service) validateR03(ctx context.Context, tx *sql.Tx, result *validation.ValidationResult, combo *model.Combo) {
	// ★仮登録は判定しない。CheckTrashDuplicate と同じ理由である(DES-006 §2.3)。
	if combo.IsDraft {
		return
	}

	// ★★復元対象自身を除外する。復元は deleted_at を NULL に戻してから検証するため
	//   (M23-04 §4.2)、除外しないと自分が自分の重複相手になり必ず 1 件ヒットする
	//   (M23-05 §4.3)。除外はリポジトリ層の `id <> ?` が担う。
	candidates, err := s.repo.FindActiveByDuplicateKeyExcludingTx(ctx, tx, duplicateKeyOf(combo), combo.ID)
	if err != nil {
		slog.ErrorContext(ctx, "restore validation: find alive duplicates",
			slog.Int64("comboId", combo.ID), slog.String("err", err.Error()))
		return
	}
	refs, err := s.withRecipeHashesTx(ctx, tx, candidates)
	if err != nil {
		slog.ErrorContext(ctx, "restore validation: hash alive duplicates",
			slog.Int64("comboId", combo.ID), slog.String("err", err.Error()))
		return
	}
	ownSteps, err := s.repo.FindStepsByComboIDTx(ctx, tx, combo.ID)
	if err != nil {
		slog.ErrorContext(ctx, "restore validation: find own steps",
			slog.Int64("comboId", combo.ID), slog.String("err", err.Error()))
		return
	}
	validation.ValidateR03DuplicateAliveCombo(result, CalcRecipeHash(ownSteps), refs)
}

// withRecipeHashesTx は withRecipeHashes の tx 版(M23-05)。
//
// ★バルク取得の FindStepsForCombos は tx を取らないため、候補ごとに tx 版を引く。
// 候補は同一の判定キー 7 項に絞られた集合であり、実データでは数件である。
func (s *service) withRecipeHashesTx(ctx context.Context, tx *sql.Tx, candidates []model.Combo) ([]validation.DuplicateComboRef, error) {
	if len(candidates) == 0 {
		return nil, nil
	}
	refs := make([]validation.DuplicateComboRef, len(candidates))
	for i, c := range candidates {
		steps, err := s.repo.FindStepsByComboIDTx(ctx, tx, c.ID)
		if err != nil {
			return nil, fmt.Errorf("find steps for candidate %d: %w", c.ID, err)
		}
		refs[i] = validation.DuplicateComboRef{ID: c.ID, Memo: c.Memo, RecipeHash: CalcRecipeHash(steps)}
	}
	return refs, nil
}

// validateRestoredCombo は復元直後のコンボに VAL-C08 / VAL-R01(M23-04 §4.7)と
// VAL-R03(M23-05 §4.1)を適用する。
//
// ★検証処理自体が失敗した場合は、その検証だけを捨てて空の結果を返す。500 にせず、
// 復元も巻き添えにしない(M23-04 §4.2 末尾)——検証は付加価値であり、それが壊れたことで
// 復元という利用者の主目的を落とさない。★ただしログには残す。
func (s *service) validateRestoredCombo(ctx context.Context, tx *sql.Tx, id int64) validation.ValidationResult {
	var result validation.ValidationResult

	combo, err := s.repo.FindByIDAllowDeletedTx(ctx, tx, id)
	if err != nil {
		slog.ErrorContext(ctx, "restore validation: find combo",
			slog.Int64("comboId", id), slog.String("err", err.Error()))
		return validation.ValidationResult{}
	}

	// VAL-C08: 各ステップの move_id がキャラに存在するか(既存の判定を再利用)。
	steps, err := s.repo.FindStepsByComboIDTx(ctx, tx, id)
	if err != nil {
		slog.ErrorContext(ctx, "restore validation: find combo steps",
			slog.Int64("comboId", id), slog.String("err", err.Error()))
		return validation.ValidationResult{}
	}
	validation.ValidateMoveExistence(ctx, &result, combo, steps, s.validDeps)

	// VAL-R03: 復元したことで、同じ判定キー + 同じレシピの生きたコンボと並んでいないか
	// (M23-05 §4.1)。★VAL-C02 は削除済み行を候補に入れないため、「削除 → 同じものを
	// 再登録 → 復元」の順で重複が成立する(M23-RESEARCH-01 H-2 / H-4)。
	// ★setupSvc を要さないので、下の VAL-R01 の nil ガードより前に置く。
	s.validateR03(ctx, tx, &result, combo)

	// VAL-R01: 紐付いているセットプレイに論理削除されたものが含まれるか。
	// ★setupSvc は nil 可(テスト用の最小構成)。本番配線では必ず入る。
	if s.setupSvc == nil {
		return result
	}
	deleted, err := s.setupSvc.FindDeletedSetupRefsByComboIDInTx(ctx, tx, id)
	if err != nil {
		slog.ErrorContext(ctx, "restore validation: find deleted setup refs",
			slog.Int64("comboId", id), slog.String("err", err.Error()))
		return result
	}
	validation.ValidateR01LinkedSetupsDeleted(&result, deleted)

	return result
}

// ---------------------------------------------------------------------------
// PermanentDelete(DELETE /api/combos/:id/permanent)
// ---------------------------------------------------------------------------

// PermanentDelete はゴミ箱のコンボを物理削除する。
//
// ★M23-08 §4.3: 前チェック(存在するか・ゴミ箱に居るか)をトランザクションの内側で行う。
// 以前は BeginTx の前に FindByIDAllowDeleted を呼んでおり、判定してから Tx を張るまでの
// 間に他の利用者がその行を復元しうる TOCTOU の窓があった(M23-RESEARCH-01 §D-6 が実測)。
// ⇒ 復元されたコンボが完全削除される、というデータの消失につながる。
// セットプレイ側(service/setup/restore.go の PermanentDelete)が M23-02 で採った形へ揃えた。
//
// ★応答は変えていない: 存在しない → ErrNotFound(404) / ゴミ箱に無い →
// ErrComboNotInTrash(409) / 成功 → 204。
func (s *service) PermanentDelete(ctx context.Context, id int64) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	// ★述語を持たない Tx 版で読む。完全削除の前チェックは「削除済みの行を引くこと」が
	// 目的であり、deleted_at IS NULL を足すと機能そのものが壊れる
	// (DES-002 §4.2「意図的に除外しない経路が 1 つ在る」)。
	combo, err := s.repo.FindByIDAllowDeletedTx(ctx, tx, id)
	if err != nil {
		return err // ErrNotFound をそのまま伝播
	}
	if combo.DeletedAt == nil {
		// ★センチネルも名前付き err へ代入してから返す。そうしないと defer の
		//   ロールバックが走らない。
		err = ErrComboNotInTrash
		return err
	}

	if err = s.repo.HardDelete(ctx, tx, id); err != nil {
		return fmt.Errorf("hard delete: %w", err)
	}

	if err = tx.Commit(); err != nil {
		return fmt.Errorf("commit: %w", err)
	}
	return nil
}

// ---------------------------------------------------------------------------
// CheckDuplicate(POST /api/combos/check-duplicate、M2-02)
// ---------------------------------------------------------------------------

// CheckDuplicate は入力内容が既存のコンボと重複するかを判定する。保存は行わない。
//
// 生きた側は M2-02 のまま(ComboDuplicateAdapter + CalcRecipeHash)。
// 削除済み側は M23-09 §4.1-1 で足した——★母集団も判定も VAL-C14 と同一であり、
// findDeletedDuplicateRefsByKey を共有している。判定を書き直していない(§2.2)。
//
// ★削除済み側は ExcludeComboID を見ない。同 id は「編集中の自分自身」を除くための
// ものであり、ゴミ箱に居る行は編集対象になりえない(VAL-C14 も除外していない)。
func (s *service) CheckDuplicate(ctx context.Context, input CheckDuplicateInput) (*CheckDuplicateResult, error) {
	hash := CalcRecipeHash(input.Steps)

	key := validation.DuplicateKey{
		CharacterID:    input.CharacterID,
		StarterMoveID:  input.StarterMoveID,
		Position:       input.Position,
		OpponentStance: input.OpponentStance,
		HitType:        input.HitType,
		OpponentSize:   input.OpponentSize,
		StarterMeaty:   input.StarterMeaty,
	}

	candidates, err := s.validDeps.ComboRepo.FindActivePublishedDuplicates(ctx, key)
	if err != nil {
		return nil, fmt.Errorf("find duplicates: %w", err)
	}

	// ★0 件でも nil ではなく空スライスを返す。API 層が JSON の空配列として出すためである
	//   (M23-09 §4.1-1＝画面は length で分岐する。キーの有無で分岐させない)。
	result := &CheckDuplicateResult{
		Duplicates:        make([]DuplicateInfo, 0),
		DeletedDuplicates: make([]model.ComboRef, 0),
	}
	for _, c := range candidates {
		if c.RecipeHash == hash {
			if input.ExcludeComboID != nil && c.ID == *input.ExcludeComboID {
				continue
			}
			result.Duplicates = append(result.Duplicates, DuplicateInfo{
				ID:             c.ID,
				CharacterID:    input.CharacterID,
				StarterMoveID:  input.StarterMoveID,
				Position:       input.Position,
				OpponentStance: input.OpponentStance,
				HitType:        input.HitType,
				OpponentSize:   input.OpponentSize,
				StarterMeaty:   input.StarterMeaty,
				StepCount:      c.StepCount,
				Memo:           c.Memo,
			})
		}
	}

	deletedRefs, err := s.findDeletedDuplicateRefsByKey(ctx, comborepo.DuplicateKey{
		CharacterID:    input.CharacterID,
		StarterMoveID:  input.StarterMoveID,
		Position:       input.Position,
		OpponentStance: input.OpponentStance,
		HitType:        input.HitType,
		OpponentSize:   input.OpponentSize,
		StarterMeaty:   input.StarterMeaty,
	})
	if err != nil {
		return nil, fmt.Errorf("find deleted duplicates: %w", err)
	}
	result.DeletedDuplicates = append(result.DeletedDuplicates,
		validation.ToComboRefs(validation.MatchDuplicatesByRecipeHash(hash, deletedRefs))...)

	return result, nil
}

// ---------------------------------------------------------------------------
// Materialize(POST /api/combos/{id}/materialize、M18-03b §4.4)
// ---------------------------------------------------------------------------

// Materialize は基底コンボから確定反撃(パニッシュカウンター版)を別コンボとして生成する。
//
// 処理順(§4.4): 基底読込 → 対象判定(§4.1) → FR301(§4.5) → ダメージ計算(§4.3) →
// combos INSERT → 子テーブル複製 → combo_punishes INSERT を単一トランザクションで行う。
// FR301 で既存が見つかった場合は生成せず既存 id を返す(AlreadyExisted=true)。
//
// 規則は BE に一元化する(FE はダメージ計算や hit_type 決定を持たない・DES-002 §4.2)。
// steps はサーバ内で基底の Steps をそのまま複製するため recipe_hash が構造的に基底と一致する。
func (s *service) Materialize(ctx context.Context, input MaterializeInput) (*MaterializeResult, validation.ValidationResult, error) {
	var vres validation.ValidationResult

	// 1. 基底読込(steps / tags / oki を含む)。
	base, err := s.repo.FindByID(ctx, input.BaseComboID)
	if err != nil {
		return nil, vres, err // ErrNotFound はハンドラで 404
	}

	// 2. 対象判定(§4.1)。NULL は normal と同じ扱い(取りこぼさない)。
	//    punish_counter 系は対象外＝BE でも弾く(FE がボタンを出さないだけでは API 直叩きで二重計上)。
	baseHit := ""
	if base.HitType != nil {
		baseHit = *base.HitType
	}
	switch baseHit {
	case "", model.HitTypeNormal, model.HitTypeCounter:
		// 対象
	case model.HitTypePunishCounter, model.HitTypeJustParryPunishCounter,
		// ★M27-01: 名前上すでにパニッシュカウンターであるため生成の対象外にする
		//   (開発者確定 2026-09-02)。★足したのは対象外判定だけであり、タブ分けや
		//   「始動技がインパクトのときだけ使う」制約は別サブの担当である。
		model.HitTypeDriveImpactPunishCounter:
		return nil, vres, ErrMaterializeIneligibleHitType
	default:
		// 未知値は取りこぼさず normal 相当で扱う(silent-drop 回避)。
		// ★M27-01 で足した壁やられ 2 種と stun はここへ落ちる。PC ではないため
		//   生成できてよい —— 対象外にするのは PC 系だけである。
	}

	// 3. FR301(§4.5): 同一キー + hit_type=punish_counter の既存を探す。
	//    HTTP を往復せず、CheckDuplicate と同じく ComboDuplicateAdapter + CalcRecipeHash を直接再利用する。
	pc := model.HitTypePunishCounter
	dupKey := validation.DuplicateKey{
		CharacterID:    base.CharacterID,
		StarterMoveID:  base.StarterMoveID,
		Position:       base.Position,
		OpponentStance: base.OpponentStance,
		HitType:        &pc,
		OpponentSize:   base.OpponentSize,
		// ★M37-07: 基底の値をそのまま引き継ぐ。生成物は基底と同じ始動であり、
		//   本探索が差し替えるのは hit_type だけである(§4.5・CHANGE-089)。
		StarterMeaty: base.StarterMeaty,
	}
	baseHash := CalcRecipeHash(base.Steps)

	// ★★トランザクションを先に開く(M24-11 / CHANGE-136)————————————————
	// この探索も check-then-act である——2 つの materialize が同じ基底に対して同時に
	// 走ると、双方が「既存なし」を見て双方が生成しうる(CHANGE-089・DES-006 §2.3)。
	// POST / PUT と同じ扱いにする。
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, vres, busyOr(err, "materialize begin tx")
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	candidates, err := s.txScopedDeps(tx).ComboRepo.FindActivePublishedDuplicates(ctx, dupKey)
	if err != nil {
		return nil, vres, fmt.Errorf("materialize find duplicates: %w", err)
	}
	for _, c := range candidates {
		if c.RecipeHash == baseHash {
			// 生成せず既存 id を返す(§4.5-3)。基底自身は hit_type が違うため衝突しない。
			// ただし入力キューは処理する(§5.3-A/§1.1): 基底の採用を解除し第3セクションから外す。
			//
			// ★★drainBasePunish を呼ぶ前に、必ず自分の tx を閉じること———————————
			// 同関数は自前で書き込みトランザクションを開く。BEGIN IMMEDIATE 下では
			// こちらが write lock を握ったままなので、内側で開くと自分自身のロックと
			// 衝突して busy_timeout ぶん待たされたうえで SQLITE_BUSY になる
			// (SUPP-001 §7.1.1-3 と同じ形)。ここまで 1 行も書いていないため
			// ロールバックで閉じてよい。
			if rbErr := tx.Rollback(); rbErr != nil {
				return nil, vres, fmt.Errorf("materialize rollback before drain: %w", rbErr)
			}
			if drainErr := s.drainBasePunish(ctx, input.BaseComboID, input.OpponentMoveID); drainErr != nil {
				return nil, vres, drainErr
			}
			return &MaterializeResult{ComboID: c.ID, AlreadyExisted: true}, vres, nil
		}
	}

	// 4. ダメージ計算(§4.3)。counter は不変、normal/NULL は始動技ダメージ × 0.2 を加算。
	//    縁の扱い(裁定2＝許して注記): 加算できなくても生成を止めず、理由を返す(silent 0 加算しない)。
	newDamage := base.Damage
	damageAdded := false
	skipReason := ""
	if baseHit != model.HitTypeCounter {
		switch {
		case base.Damage == nil:
			skipReason = MaterializeDamageBaseNull // damage は NULL のまま
		case base.StarterMoveID == nil:
			skipReason = MaterializeDamageStarterNotSet // 基底の値のまま
		default:
			starterDamage, starterCategory, dmgErr := s.getMaterializeStarter(ctx, *base.StarterMoveID)
			if dmgErr != nil {
				return nil, vres, fmt.Errorf("materialize get starter: %w", dmgErr)
			}
			if starterCategory == model.MoveCategorySuperArt || starterCategory == model.MoveCategoryCriticalArt {
				// Super Arts / Critical Arts はパニッシュカウンター補正が乗らない
				// (開発者インゲーム確認 2026-07-27)。damage は基底の値を維持する。
				skipReason = MaterializeDamageStarterUnscaled
			} else if starterDamage == nil {
				skipReason = MaterializeDamageStarterDmgNull // 基底の値のまま
			} else {
				// 始動技 damage × 0.2 を整数除算(/5)で加算する。丸め関数は持ち込まない(裁定1)。
				// 実測確認済(開発者インゲーム実測 2026-07-27): moves.damage が 5 の倍数でない技は
				// throw×3 / special(OD投げ)×1 / target_combo×6 の計 10 件のみで、いずれも
				// materialize の始動技(starter_move_id)になり得ない。よって × 0.2 は常に整数になり、
				// 丸め規則の適用面は存在しない(完了報告 §1・progress-log 参照)。
				added := *starterDamage / 5
				nd := *base.Damage + added
				newDamage = &nd
				damageAdded = true
			}
		}
	}

	// 5. 生成コンボの組立(コピー範囲・裁定9/10)。基底のスカラ列をコピーし、
	//    hit_type / damage / materialized_from_combo_id / 出自無関係な列を上書き/初期化する。
	gen := *base
	gen.ID = 0
	gen.Version = 1
	gen.HitType = &pc
	gen.Damage = newDamage
	gen.MaterializedFromComboID = &base.ID
	gen.RecipeCache = nil // RecomputeComboCache で再計算(基底と同一 steps のため同値)
	gen.StepCount = len(base.Steps)
	// ★★基準(FR702)は基底から引き継がない。⇒ nil にして INSERT の COALESCE に委ね、
	//   「生成した時点の最新」を入れる(M28-02a §2.3-5)。
	//   ★★`gen := *base` は構造体まるごとの複製である。⇒ combos に列が増えるたび、
	//     その列は既定で「基底の値を引き継ぐ」側に倒れる。基準は引き継いではいけない
	//     —— 基底が古い前提のまま登録されていた場合、生成物まで古い前提を名乗ってしまう。
	//   ★先例は `materialize-bypasses-required-fields`(followup)である。
	//     本経路は ValidateComboForCreate を通らないため、ここで明示しないと誰も直さない。
	//   ★★M31-01 追記: その先例そのものは下で塞いだ(VAL-C15 を通した)。
	//     ⇒ 「ValidateComboForCreate を通らない」は今も真だが、**必須 4 欄については
	//       もう穴ではない**。★ここで言う教訓は「列が増えるたび既定で基底を引き継ぐ側へ
	//       倒れる」ことであり、そちらは今も生きている。
	gen.BaselineVersion = nil
	// ★AffectedByGameUpdate は導出値であり保存しない。複製された値は INSERT に現れない。
	gen.AffectedByGameUpdate = false
	// version / created_at / updated_at / deleted_at は新規行の初期値。knockdown_advantage・
	// 状況系・ゲージ系・drive_damage・memo・メディア 3 列・is_draft は *base のコピーで引き継がれる。
	// combo_setups は複製しない(別コンボへの紐づけは意味が変わる)。

	// ★★M31-01(materialize-bypasses-required-fields): VAL-C15 を通す————————————
	// 着手前、本経路は ValidateComboForCreate を一度も呼ばず、内部で重複判定だけを
	// 行っていた。⇒ 必須 4 欄が空の【本登録】コンボが生成できた(段 1-1 の陽性対照で実測)。
	// ★★M38-01(射程 3): 当時の 4 欄の列挙は失効した(damage / knockdown_advantage /
	//   drive_gauge_consumed / sa_gauge_consumed)。⇒ 現在の 4 欄の正典は
	//   validation.requiredPublishedFields であり、ここでは列挙しない(写しを増やさない)。
	//
	// ★★呼ぶのは PATCH 経路と同じ 1 本である(ValidateRequiredForPublished)。
	//   条件を写した 2 本目を書かない——書くと片方だけが直って静かにずれる
	//   (DES-006 §2.1 / CHANGE-141 の作法)。
	// ★仮登録には掛からない。gen.IsDraft は基底からの複製であり、仮登録の基底から
	//   生成した物は仮登録である ⇒ 同関数の isDraft=false 前提を満たさないため、
	//   ここで明示的に分岐する(VAL-C15 は仮登録を完全スキップする・M27-02b)。
	// ★位置は「tx の内側・INSERT の前」。VAL-C02 の判定と同じ場所へ揃えてある
	//   (M24-11 / CHANGE-136)。判定と書き込みの間に隙を空けない。
	// ★値域は見ない。空かどうかだけを見る(DES-006 §2.5 は不変)。
	if !gen.IsDraft {
		validation.ValidateRequiredForPublished(&vres, &gen)
		if vres.HasError() {
			// ここまで 1 行も書いていないためロールバックで閉じてよい。
			// ★err へ代入しない——defer の二重ロールバックを避ける。
			if rbErr := tx.Rollback(); rbErr != nil {
				return nil, vres, fmt.Errorf("materialize rollback after validation: %w", rbErr)
			}
			return nil, vres, nil // ハンドラ側で 400 validation_failed
		}
	}

	// ★tx は上(重複探索の直前)で開いている。判定と登録を同じトランザクションに
	// 収めるためであり、ここで開き直さない。
	var newID int64
	newID, err = s.repo.InsertCombo(ctx, tx, &gen)
	if err != nil {
		return nil, vres, fmt.Errorf("materialize insert combo: %w", err)
	}

	if err = s.repo.InsertSteps(ctx, tx, newID, base.Steps); err != nil {
		return nil, vres, fmt.Errorf("materialize insert steps: %w", err)
	}

	if len(base.OkiOptions) > 0 {
		if err = s.repo.ReplaceOkiOptions(ctx, tx, newID, base.OkiOptions); err != nil {
			return nil, vres, fmt.Errorf("materialize replace oki options: %w", err)
		}
	}

	if err = s.notationSvc.RecomputeComboCache(ctx, tx, newID); err != nil {
		return nil, vres, fmt.Errorf("materialize recompute cache: %w", err)
	}

	// ★複製するのは「自分のタグの紐づけ」だけである(M22-02 §4.5-13)。
	// base は repo から無絞りで取っているため、絞らずに複製すると他人のタグ ID が
	// 混ざり、それを自分の置換集合として書き込むことになる。
	filterTagsByUser(base, input.UserID)
	if len(base.Tags) > 0 {
		tagIDs := make([]int64, len(base.Tags))
		for i, t := range base.Tags {
			tagIDs[i] = t.ID
		}
		if err = s.repo.ReplaceTagAssociations(ctx, tx, newID, input.UserID, tagIDs); err != nil {
			return nil, vres, fmt.Errorf("materialize replace tags: %w", err)
		}
	}

	// combo_punishes を同時作成(裁定7)。materialize は必ず「この相手技への反撃」から起動される。
	if err = s.repo.InsertPunish(ctx, tx, newID, input.OpponentMoveID, input.Note); err != nil {
		return nil, vres, fmt.Errorf("materialize insert punish: %w", err)
	}

	// 入力キューの処理(§5.3-A/§1.1・開発者裁定 2026-07-27): 基底コンボの採用(と同キー curation)を
	// 解除し、マイリスト第3セクション(区分を判定できない反撃)から外す。基底コンボ自体は残る
	// (独立フォーク)。探す画面の孫ツリーからの未採用変換では対象が無く no-op(冪等)。
	if err = s.repo.RemovePunishLink(ctx, tx, input.BaseComboID, input.OpponentMoveID); err != nil {
		return nil, vres, fmt.Errorf("materialize drain base punish: %w", err)
	}

	if err = tx.Commit(); err != nil {
		return nil, vres, fmt.Errorf("materialize commit: %w", err)
	}

	return &MaterializeResult{
		ComboID:          newID,
		AlreadyExisted:   false,
		DamageAdded:      damageAdded,
		DamageSkipReason: skipReason,
	}, vres, nil
}

// drainBasePunish は FR301 で既存が見つかった経路(生成しない)でも、基底の採用(と同キー
// curation)を解除して入力キューから外す(§5.3-A/§1.1)。生成経路は同一 Tx 内で
// RemovePunishLink を直接呼ぶため本ヘルパは使わない。単一の DELETE 対なので短い Tx で閉じる。
func (s *service) drainBasePunish(ctx context.Context, baseComboID, opponentMoveID int64) error {
	// ★本関数は Materialize の「既存 id を返す」経路から、呼出元が自分の tx を閉じた直後に
	// 呼ばれる(§4.3 の入れ子回避)。⇒ 同一リクエストの中で 2 回目の write lock 取得になるため、
	// ここも混雑に当たりうる。★busyOr を通さないと、同じエンドポイントの応答が
	// 503 と 500 の 2 通りに割れる(レビュー指摘 中-1)。
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return busyOr(err, "materialize drain begin tx")
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()
	if err = s.repo.RemovePunishLink(ctx, tx, baseComboID, opponentMoveID); err != nil {
		return fmt.Errorf("materialize drain base punish: %w", err)
	}
	if err = tx.Commit(); err != nil {
		return fmt.Errorf("materialize drain commit: %w", err)
	}
	return nil
}

// getMaterializeStarter は materialize のダメージ分岐に必要な始動技の damage と category を返す。
// moves は materialize では変更しない参照データのため tx 外の読み取りで十分。
func (s *service) getMaterializeStarter(ctx context.Context, moveID int64) (*int, string, error) {
	var damage sql.NullInt64
	var category string
	err := s.db.QueryRowContext(ctx, `SELECT damage, category FROM moves WHERE id = ?`, moveID).Scan(&damage, &category)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, "", ErrNotFound
		}
		return nil, "", fmt.Errorf("get materialize starter: %w", err)
	}
	if !damage.Valid {
		return nil, category, nil
	}
	d := int(damage.Int64)
	return &d, category, nil
}

// ---------------------------------------------------------------------------
// 内部ヘルパ: CreateInput → model.Combo + steps
// ---------------------------------------------------------------------------

// normalizePositionAndMass は始動位置の 2 表現(マス数と区分)を整合させる(M28-02a §2.4)。
//
// ★★保存する正本はマス数だが、区分(combos.position)も列として残っている
// —— 重複判定キーの 1 項であり、6 か所の SQL 述語が直接比較するためである。
// ⇒ 2 つがずれた状態を DB へ入れない。ずれると「一覧に出る区分」と
//
//	「重複判定に使われる区分」が食い違い、しかもエラーにならない。
//
// 規則は 3 つだけである。
//
//	マス数あり            … ★マス数が勝つ。区分を導出して上書きする
//	マス数なし・区分あり  … 区分の代表値をマス数へ入れる
//	                        ★既存のエディタはこの経路を通る ⇒ 現行画面は無改修で動く
//	どちらも無し          … 両方 NULL(不問)
//
// ★値域外のマス数はここでは弾かない。★弾くのは validation 層(validatePositionMassRange・
// ERROR / 400)であり、最後の砦として DB の CHECK が在る。CSV 取込は csvcore 側で見る。
// ⇒ 本関数は「整合させる」だけを持ち、値域は持たない
// (ここで黙って丸めると、利用者の入力ミスが「それらしい値」になって残る)。
// ★★区分が未知の値のときはマス数を入れない —— 代表値が定義できないためである。
// 区分そのものは既存どおり verbatim で通す(position に値域検証は無い＝既存挙動)。
//
// ★★呼ぶのは Create と UpdateWithKeyChange の入口である。重複判定より前に呼ぶこと
// —— 判定は input.Position を直接読む箇所が 3 つあり、正規化前に走ると
// 「マス数から導いた区分」ではなく「送られてきた区分」で重複を見てしまう。
func normalizePositionAndMass(input *CreateInput) {
	if input.StartPositionMass != nil {
		if code, ok := model.PositionFromMass(*input.StartPositionMass); ok {
			input.Position = &code
		}
		return
	}
	// ★補完の半分は representativeMassFor が持つ(M37-05)。ここで規則を書き直さない。
	if mass := representativeMassFor(input.Position, input.StartPositionMass); mass != nil {
		input.StartPositionMass = mass
	}
}

// representativeMassFor は「マス数が無いとき、区分の代表値を返す」半分だけを持つ
// (M37-05 / D-864。normalizePositionAndMass から切り出したもの)。
//
// ★★本関数は値を返すだけで代入しない。⇒ 代入は呼び出し側が行う。
//
// ★★★導出の半分(マス数 → 区分)は持たない —— PATCH 経路が要るのは補完だけだからである
// (指示書 §0.3)。position は重複判定キーであり、PATCH で動かすと
// 「識別キーが変わらない編集」という同経路の契約そのものが嘘になる。
//
// ★目指す不変条件は 1 行である: start_position_mass IS NULL ⇔ position = 不問。
//
// ★★★ただし PATCH で閉じるのは片方向だけである —— 「区分あり ⇒ マス数が入る」は
// 本関数が守るが、「マス数あり ⇒ 区分が決まっている」は守らない。
// ⇒ position が不問の行へ PATCH でマス数だけを送ると、position は NULL のまま値が入る。
// ★逆向きを閉じているのは (a) 画面が positionFromMass で区分を導出すること
// (b) 区分が変われば hasKeyChanges が PUT へ振り分けること —— の 2 つであり、
// API を直接叩く経路は射程外である(指示書 §0.4 / §7-2＝別の裁定が要る)。
//
// ★埋めないときは nil を返す。埋めない場合は 3 つ:
//
//	マス数が既に在る … 上書きしない(利用者の値が勝つ)
//	position が不問  … 代表値が定義されていない(nil。★NULL のままが正しい状態である)
//	未知の区分       … 同上。代表値表に無い
//
// ★★carry_distance_mass には使わない —— 運び量は区分を持たず、代表値という概念が
// 存在しない(D-731 不変条件 2)。★名前が似ているだけである(指示書 §4.3)。
func representativeMassFor(position *string, mass *int) *int {
	if mass != nil || position == nil {
		return nil
	}
	m, ok := model.RepresentativeMassOf(*position)
	if !ok {
		return nil
	}
	return &m
}

// fillStartPositionMassForPatch は PATCH(UpdateMetadata)の結果としてマス数が NULL に
// なるとき、DB 上の区分の代表値で埋める(M37-05 / D-864)。
//
// ★★★position は 1 バイトも書かない —— UpdateMetadataInput は Position 欄を持たない
// (repository.UpdateMetadataInput)。⇒ 構造的に不可能である。
// ★★carry_distance_mass も触らない(指示書 §0.5 / §4.3)。運び量の NULL は正常な状態である。
//
// ★「更新後のマス数」は 2 通りの入力から決まる。両方を含めること(指示書 §2.2-1):
//
//	present + 値   … 送られてきた値       ⇒ 埋めない
//	present + nil  … 明示クリア           ⇒ 埋める対象
//	キー不在       … DB の現在値のまま    ⇒ それが NULL なら埋める対象
//
// ★★帰結を承知して作ってある: メモだけを直す PATCH でも、元が NULL で position が
// 区分なら代表値が入る。⇒ これは意図した形である(D-864)。PUT は着手前からそう
// 振る舞っており(normalizePositionAndMass)、本関数はそこへ寄せるものである。
//
// ★★★呼ぶ位置＝検証より後、repo.UpdateMetadata の直前である。
// ⇒ 埋める値は必ず 0〜160 のため VAL-RANGE には当たらず、start_position_mass は
// requiredPublishedFields に無いため VAL-C15 とも無関係であり、現状は順序が効かない。
// ★★将来 start_position_mass が本登録の必須欄になるか、相関検証の対象になったら
// 順序が効き始める —— そのときは検証より前へ移すこと(検証が「保存される姿」を
// 見ないと、埋めれば通る入力を誤って咎める)。
func fillStartPositionMassForPatch(current *model.Combo, input *UpdateMetadataInput) {
	if current == nil || input == nil {
		return
	}
	after := current.StartPositionMass
	if input.StartPositionMass.Present {
		after = input.StartPositionMass.Value
	}
	if mass := representativeMassFor(current.Position, after); mass != nil {
		input.StartPositionMass = comborepo.Some(*mass)
	}
}

func buildComboFromInput(input CreateInput) (*model.Combo, []model.ComboStep) {
	combo := &model.Combo{
		CharacterID:           input.CharacterID,
		IsDraft:               input.IsDraft,
		Damage:                input.Damage,
		StarterMoveID:         input.StarterMoveID,
		Position:              input.Position,
		StartPositionMass:     input.StartPositionMass,
		CarryDistanceMass:     input.CarryDistanceMass,
		OpponentStance:        input.OpponentStance,
		HitType:               input.HitType,
		OpponentSize:          input.OpponentSize,
		StarterMeaty:          input.StarterMeaty,
		DriveAvailableAtStart: input.DriveAvailableAtStart,
		SAAvailableAtStart:    input.SAAvailableAtStart,
		DriveDamage:           input.DriveDamage,
		SAGaugeConsumed:       input.SAGaugeConsumed,
		DriveGaugeConsumed:    input.DriveGaugeConsumed,
		KnockdownAdvantage:    input.KnockdownAdvantage,
		OkiVerified:           input.OkiVerified,
		Memo:                  input.Memo,
		Situation:             input.Situation,
		Link:                  input.Link,
		VideoPath:             input.VideoPath,
		ImagePath:             input.ImagePath,
		OkiOptions:            input.OkiOptions,
	}
	return combo, input.Steps
}

// ===========================================================================
// バリデーション層 Dependencies の素朴な実装
// ===========================================================================

// 補助: バリデーション層が要求する 3 つのインタフェースを repository 経由で満たすアダプタ群を、
// 本パッケージ外(main.go)で組立てやすいように補助型を提供する。

// ComboDuplicateAdapter は repository.Repository を validation.ComboDuplicateChecker として
// 機能させるアダプタ。FindActivePublishedDuplicates の中で recipe_hash の計算を行う。
type ComboDuplicateAdapter struct {
	Repo comborepo.Repository

	// Tx は判定を行うトランザクション。nil なら *sql.DB 直読み(M24-11 / CHANGE-136)。
	//
	// ★★なぜ構造体に持つのか———————————————————————————————————
	// validation パッケージは database/sql を import しない DB 非依存の層である
	// (Dependencies がインタフェースだけで組まれているのはそのため)。判定の
	// トランザクション境界のためにその層を database/sql へ結び付けるのは、本サブの
	// 射程に対して代償が大きい。⇒ tx はアダプタ側が握り、validation の署名は変えない。
	//
	// ★D-360 の規約(「署名が *sql.Tx を取るなら、その tx を読みにも使うこと。
	// 使わないなら取らないこと」)には抵触しない——同規約が戒めているのは
	// 「tx を受け取りながら読みに使わない」形である。本フィールドは候補抽出と
	// steps 取得の両方に使われる。
	//
	// ★nil のまま使う経路が正当に在る: 保存前チェック(POST /api/combos/check-duplicate)は
	// 何も書かないためトランザクションを開かない。
	Tx *sql.Tx
}

// WithTx は tx を束ねた複製を返す。元のアダプタは変更しない。
//
// ★登録経路は BeginTx のあとにこれを呼び、判定を同じトランザクションの内側で行う。
func (a *ComboDuplicateAdapter) WithTx(tx *sql.Tx) *ComboDuplicateAdapter {
	return &ComboDuplicateAdapter{Repo: a.Repo, Tx: tx}
}

// FindActivePublishedDuplicates は同一キーの published コンボを取得し、各候補の steps を
// バルク取得して recipe_hash を計算した DuplicateCandidate を返す(SUPP-001 §2.2 文字通り解釈)。
//
// 引数の `validation.DuplicateKey` を `comborepo.DuplicateKey` に変換してリポジトリ層へ渡す。
// 両者は同じ 7 フィールド構造体だが、層独立性のため意図的に別パッケージで定義されている
// (M1-03 機械レビュー指摘・高優先の対応)。
func (a *ComboDuplicateAdapter) FindActivePublishedDuplicates(ctx context.Context, key validation.DuplicateKey) ([]validation.DuplicateCandidate, error) {
	repoKey := comborepo.DuplicateKey{
		CharacterID:    key.CharacterID,
		StarterMoveID:  key.StarterMoveID,
		Position:       key.Position,
		OpponentStance: key.OpponentStance,
		HitType:        key.HitType,
		OpponentSize:   key.OpponentSize,
		StarterMeaty:   key.StarterMeaty,
	}
	candidates, err := a.Repo.FindActiveByDuplicateKey(ctx, a.Tx, repoKey)
	if err != nil {
		return nil, err
	}
	if len(candidates) == 0 {
		return nil, nil
	}

	stepsByID, err := a.stepsForCandidates(ctx, candidates)
	if err != nil {
		return nil, err
	}

	results := make([]validation.DuplicateCandidate, 0, len(candidates))
	for _, c := range candidates {
		hash := CalcRecipeHash(stepsByID[c.ID])
		results = append(results, validation.DuplicateCandidate{
			ID:         c.ID,
			RecipeHash: hash,
			StepCount:  c.StepCount,
			Memo:       c.Memo,
		})
	}
	return results, nil
}

// stepsForCandidates は候補の steps を引く。
//
// ★★tx があるときにバルク取得を使わないのは意図である———————————————
// バルク版 FindStepsForCombos は tx を取らない(呼出元が 4 か所あり、いずれも
// トランザクション外である)。ここで *sql.DB 直読みへ落ちると、同じ tx が今まさに
// 書いた行の steps が見えず、判定を tx の内側へ移した意味が消える。
// ⇒ tx があるときは候補ごとに tx 版を引く。候補は判定キー 7 項で絞られた集合であり、
// 実データでは数件である(withRecipeHashesTx が M23-05 で採ったのと同じ判断)。
func (a *ComboDuplicateAdapter) stepsForCandidates(ctx context.Context, candidates []model.Combo) (map[int64][]model.ComboStep, error) {
	if a.Tx == nil {
		ids := make([]int64, len(candidates))
		for i, c := range candidates {
			ids[i] = c.ID
		}
		return a.Repo.FindStepsForCombos(ctx, ids)
	}

	stepsByID := make(map[int64][]model.ComboStep, len(candidates))
	for _, c := range candidates {
		steps, err := a.Repo.FindStepsByComboIDTx(ctx, a.Tx, c.ID)
		if err != nil {
			return nil, fmt.Errorf("find steps for candidate %d: %w", c.ID, err)
		}
		stepsByID[c.ID] = steps
	}
	return stepsByID, nil
}

// isInvalidTagIDErr は FK 制約違反(存在しないタグ ID)のエラーかを判定する(M3-02)。
// modernc.org/sqlite は "FOREIGN KEY constraint failed" を含むエラーメッセージを返す。
func isInvalidTagIDErr(err error) bool {
	return err != nil && strings.Contains(err.Error(), "FOREIGN KEY constraint failed")
}

func intPtrEqual(a, b *int) bool {
	if a == nil && b == nil {
		return true
	}
	if a == nil || b == nil {
		return false
	}
	return *a == *b
}

// 既存のセンチネルが repository 層と同期していることを保証する型チェック
var _ error = ErrNotFound
var _ error = ErrConflict
var _ = errors.Is

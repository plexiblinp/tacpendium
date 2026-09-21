package setup

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"

	"github.com/plexiblinp/tacpendium/internal/model"
	comborepo "github.com/plexiblinp/tacpendium/internal/repository/combo"
	setuprepo "github.com/plexiblinp/tacpendium/internal/repository/setup"
	"github.com/plexiblinp/tacpendium/internal/service/notation"
	"github.com/plexiblinp/tacpendium/internal/service/validation"
)

// ErrNotFound は対象セットプレイが見つからない場合のセンチネル。
var ErrNotFound = setuprepo.ErrNotFound

// ErrConflict は楽観的排他衝突のセンチネル。
var ErrConflict = setuprepo.ErrConflict

// ErrComboNotFound は親コンボが見つからない場合のセンチネル（M4-03: GetSetupCandidates で使用）。
var ErrComboNotFound = errors.New("setup: parent combo not found")

// ===========================================================================
// 入出力 DTO
// ===========================================================================

// CreateSetupInput はセットプレイ新規作成の入力。
type CreateSetupInput struct {
	CharacterID int64
	Name        *string
	Description *string
	Steps       []model.SetupStep
	// VerifiedConditions は提案の採用時に「確認できた条件」としてチェックされたセル
	// (M19-03 §4.5)。空でよい(チェックせずに採用できる)。記録されるのは成立(ok)のみで、
	// 不成立と note はここでは扱わない。combo_setups を作った後・同一 Tx で書く。
	VerifiedConditions []SetupResultCondition
}

// CheckSetupDuplicateInput は保存前チェックの入力(M23-09 §4.1-2)。
//
// ★名前は取らない。VAL-S04 / VAL-S07 とも名前を見ないためである(DES-006 §3)。
type CheckSetupDuplicateInput struct {
	CharacterID int64
	Steps       []model.SetupStep
}

// CheckSetupDuplicateResult は保存前チェックの結果(M23-09 §4.1-2)。
//
// ★生きた側と削除済み側を別のキーで返す。形はコンボ側(CheckDuplicateResult)に揃える
// (D-417＝新しい形を作らない)。
type CheckSetupDuplicateResult struct {
	// Duplicates は生きた一致。母集団は VAL-S04 と同一。
	// ★画面はこちらではダイアログを出さない。既に 409 duplicate_setup で止まる(§4.1-4)。
	Duplicates []model.SetupRef
	// DeletedDuplicates はゴミ箱に居る一致。母集団は VAL-S07 と同一。
	DeletedDuplicates []model.SetupRef
}

// UpdateSetupInput はセットプレイ編集の入力。
type UpdateSetupInput struct {
	Name        *string
	Description *string
	Steps       *[]model.SetupStep // nil: レシピ変更なし
	Version     int
}

// SetupResponse はセットプレイ詳細のレスポンス。
type SetupResponse struct {
	Setup         *model.Setup
	DefaultRecipe string
	// ParentComboIDs は「このセットプレイが使われている**生存**コンボ」の id。
	// ★論理削除済みのコンボは載らない(M23-03 §4.5)。判定の母集団には使えない——
	//   検証(重複チェック等)は repository/setup.FindComboIDsBySetupIDAllowDeleted を使うこと。
	ParentComboIDs []int64
}

// ===========================================================================
// Service インタフェース
// ===========================================================================

// Service はセットプレイのビジネスロジックを提供する。
type Service interface {
	CreateSetup(ctx context.Context, parentComboID int64, input CreateSetupInput) (*SetupResponse, validation.ValidationResult, error)

	// CheckTrashDuplicateSetup は VAL-S07(同一親コンボのゴミ箱に同じレシピがある)を判定する
	// (M23-05 §4.1)。
	//
	// ★★POST /api/combos/:comboId/setups のハンドラからのみ呼ぶこと(M23-05 §4.5)。
	//   CreateSetupInTx(コンボ同時登録)や PATCH からは呼ばない——前者は内部呼び出しで
	//   警告を返す先が無く、後者は重複判定キーを変えられないため重複が新しく生まれない。
	// ★CreateSetup の中へ入れないのは、同メソッドが CSV 取込経路からも使われうるためで
	//   あり、コンボ側の CheckTrashDuplicate と同じ「経路で絞る」方針である。
	//
	// 登録は既に成功している前提であり、判定に失敗しても登録を巻き戻さない。
	CheckTrashDuplicateSetup(ctx context.Context, parentComboID, setupID int64) validation.ValidationResult

	// CheckSetupDuplicate は保存する前に「同じ親コンボに同じレシピが在るか」を返す
	// (M23-09 §4.1-2)。★判定ではなく問い合わせである——VAL コードを 1 つも発火させない。
	//
	// ★母集団は M23-05 のものをそのまま使う。生きた側は VAL-S04 と同一
	// (FindLiveDuplicateRefsInCombo)、削除済み側は VAL-S07 と同一
	// (FindDeletedDuplicateRefsInCombo)。判定を書き直していない(M23-09 §2.2)。
	// ★CheckTrashDuplicateSetup は呼ばない。あちらは保存済みの setupID を要し、
	//   VAL-S07 を発火させる別の役目である(呼び出し元は POST ハンドラ 1 か所のまま)。
	//
	// ★親コンボの存在は確認しない。存在しなければどちらも 0 件になるだけであり、
	//   チェックの失敗で登録を巻き添えにしない規律(§4.2-3)と整合する。
	CheckSetupDuplicate(ctx context.Context, parentComboID int64, input CheckSetupDuplicateInput) (*CheckSetupDuplicateResult, error)
	// CreateSetupInTx は既存トランザクション内でセットプレイを作成する（M4-04: コンボ同時登録用）。
	// ComboExists チェックはスキップする（同一 tx 内でコンボが作成された直後であるため）。
	// トランザクション管理（Begin/Commit/Rollback）は呼び出し側の責務。
	CreateSetupInTx(ctx context.Context, tx *sql.Tx, parentComboID int64, input CreateSetupInput) (*SetupResponse, validation.ValidationResult, error)
	CreateSetupLink(ctx context.Context, comboID, setupID int64) error
	DeleteSetupLink(ctx context.Context, comboID, setupID int64) error
	GetSetup(ctx context.Context, setupID int64) (*SetupResponse, error)
	UpdateSetup(ctx context.Context, setupID int64, input UpdateSetupInput) (*SetupResponse, validation.ValidationResult, error)
	// DeleteSetup はセットプレイを論理削除する(ゴミ箱へ入れる)。
	//
	// ★★M31-01(P4M-019): unlinkFromComboID を渡すと、**そのコンボとの紐付けだけ**を
	//   同じトランザクションで併せて外す(開発者裁定 2026-09-08＝削除ダイアログの任意
	//   チェック)。nil のときは着手前と 1 バイトも変わらない挙動である。
	// ★★外した紐付けは復元で戻らない。⇒ 呼び出し側(画面)がその旨を利用者へ示すこと。
	DeleteSetup(ctx context.Context, setupID int64, unlinkFromComboID *int64) error
	GetSetupCandidates(ctx context.Context, comboID int64) ([]*SetupResponse, error)
	// GetSetupCandidatesByKnockdown は新規登録時(comboID 無し)の紐付け候補を返す(C-08)。
	GetSetupCandidatesByKnockdown(ctx context.Context, characterID int64, knockdownAdvantage *int) ([]*SetupResponse, error)
	// ListSetups は characterID でフィルタしたセットプレイ一覧を返す。nil は全件。
	ListSetups(ctx context.Context, characterID *int64) ([]*SetupResponse, error)
	// ListSetupsByComboID は comboID に紐付くセットプレイ一覧を返す。
	ListSetupsByComboID(ctx context.Context, comboID int64) ([]*SetupResponse, error)
	// ListSetupsByComboIDs は複数 comboID に紐付くセットプレイ一覧を返す。N+1 回避用バッチ取得。
	ListSetupsByComboIDs(ctx context.Context, comboIDs []int64) (map[int64][]*SetupResponse, error)

	// --- セットプレイ成立条件の検証結果(M19-03)。実装は setup_results.go ---

	// ListResultsByComboID は 1 コンボ分の検証結果を 1 クエリで返す(コンボ詳細への同梱用)。
	// 行が無いセル = 未検証。
	ListResultsByComboID(ctx context.Context, comboID int64) ([]model.ComboSetupResult, error)
	// UpsertResult は 1 セル分の検証結果を作成または更新する。
	UpsertResult(ctx context.Context, comboID, setupID int64, input UpsertResultInput) error
	// DeleteResult は 1 セル分を物理削除する(=「未検証へ戻す」)。
	DeleteResult(ctx context.Context, comboID, setupID int64, techType string, inCorner bool) error

	// --- ゴミ箱(M23-02)。実装は restore.go ---

	// Restore は論理削除されたセットプレイを復元する。
	//
	// ★戻り値の ValidationResult は「復元は成功したが注意がある」を表す(M23-04 §4.1)。
	// 復元を中止させる判定ではない——中身が空でなくても復元はコミット済みである。
	Restore(ctx context.Context, setupID int64) (validation.ValidationResult, error)
	// PermanentDelete はゴミ箱のセットプレイを物理削除する。
	// 生きたコンボから参照されている間は SetupInUseError で拒否する。
	PermanentDelete(ctx context.Context, setupID int64) error
	// ListDeletedSetups は論理削除済みのセットプレイ一覧を返す(ゴミ箱表示用)。
	ListDeletedSetups(ctx context.Context, characterID *int64) ([]*SetupResponse, error)

	// FindDeletedSetupRefsByComboIDInTx は指定コンボに紐付くセットプレイのうち論理削除
	// 済みのものを、既存トランザクション内で返す(M23-04 §4.7・VAL-R01 用)。
	//
	// コンボの復元サービスがこれを呼ぶ。CreateSetupInTx と同じく、トランザクション管理は
	// 呼び出し側の責務である。
	FindDeletedSetupRefsByComboIDInTx(ctx context.Context, tx *sql.Tx, comboID int64) ([]model.SetupRef, error)
}

// ===========================================================================
// 外部依存インターフェース
// ===========================================================================

// ComboReader はコンボの読み取り専用インターフェース。
// GetSetupCandidates で親コンボ情報（characterId, knockdownAdvantage）を取得するために使用。
type ComboReader interface {
	FindByID(ctx context.Context, id int64) (*model.Combo, error)
}

// ===========================================================================
// 実装
// ===========================================================================

type service struct {
	db          *sql.DB
	repo        setuprepo.Repository
	notationSvc notation.Service
	validDeps   ValidationDeps
	comboReader ComboReader
	// defaultPresetID は config の [defaults] preset_id の現在値を返す(M20-05・D-360)。
	//
	// ★固定値を持たず注入で受ける。コンボ側と同じ値を見る必要があるため、同じ形で受ける。
	defaultPresetID func() int64
}

// New は Service 実装を構築する。
//
// defaultPresetID が nil の場合は「既定プリセットが未注入」として扱い、defaultRecipe は
// 空文字になる(preset.New と同じ nil 扱い)。本番配線では必ず渡すこと。
func New(db *sql.DB, repo setuprepo.Repository, validDeps ValidationDeps, notationSvc notation.Service, comboReader ComboReader, defaultPresetID func() int64) Service {
	return &service{
		db:              db,
		repo:            repo,
		notationSvc:     notationSvc,
		validDeps:       validDeps,
		comboReader:     comboReader,
		defaultPresetID: defaultPresetID,
	}
}

// txScopedValidDeps は VAL-S04 の判定を tx の内側で行うための ValidationDeps を返す
// (M24-13 §4.6 / CHANGE-139)。★M24-11 の combo.txScopedDeps と同じ形である。
//
// ★★束ねが外れても VAL-S04 の「正しさ」は BEGIN IMMEDIATE の直列化が保つため、
// テストは緑のままである ⇒ 気づく契機が無い。だから外れたことを観測できる形にする
// (M24-11 のレビュー指摘 中-8 と同じ理由)。
func (s *service) txScopedValidDeps(ctx context.Context, tx *sql.Tx) ValidationDeps {
	deps := s.validDeps
	a, ok := deps.SetupRepo.(*SetupDuplicateAdapter)
	if !ok {
		slog.WarnContext(ctx,
			"txScopedValidDeps: SetupRepo が *SetupDuplicateAdapter ではないため tx を束ねられない。"+
				"VAL-S04 の判定が *sql.DB 直読みへ落ちる(D-360 の規約が失われる)",
			slog.String("type", fmt.Sprintf("%T", deps.SetupRepo)))
		return deps
	}
	deps.SetupRepo = a.WithTx(tx)
	return deps
}

// ---------------------------------------------------------------------------
// CreateSetup(POST /api/combos/{comboId}/setups)
// ---------------------------------------------------------------------------

func (s *service) CreateSetup(ctx context.Context, parentComboID int64, input CreateSetupInput) (*SetupResponse, validation.ValidationResult, error) {
	recipeHash := CalcSetupRecipeHash(input.Steps)

	// ★★M24-13 §4.6: VAL-S04 の判定を、登録と同じ書き込みトランザクションの内側で行う。
	//   以前は BeginTx の **前** に判定しており、2 つの要求が両方「重複なし」を見たあと
	//   順に書けた(VAL-C02 と同型の check-then-act。M24-11 / CHANGE-136 と同じ形)。
	//   ★DSN の _txlock=immediate により、この BeginTx は開始時点で write lock を取る。
	var result validation.ValidationResult
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, result, fmt.Errorf("begin tx: %w", err)
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	// ★渡した tx を判定が読みにも使うこと(D-360)。SetupDuplicateAdapter が束ねる。
	result = ValidateSetupCreate(ctx, parentComboID, input, recipeHash, s.txScopedValidDeps(ctx, tx))
	if result.HasError() {
		// ★検証エラーは err に載らない(業務エラーであって障害ではない)。
		//   ⇒ 上の defer は発火しないため、ここで明示的に閉じる。
		_ = tx.Rollback()
		return nil, result, nil
	}

	comboActive, err := s.repo.ComboExists(ctx, parentComboID)
	if err != nil {
		return nil, result, fmt.Errorf("check combo exists: %w", err)
	}
	if !comboActive {
		_ = tx.Rollback() // ★同上。ErrNotFound は err 変数に載らない。
		return nil, result, ErrNotFound
	}

	setup := &model.Setup{
		CharacterID: input.CharacterID,
		Name:        input.Name,
		Description: input.Description,
		StepCount:   len(input.Steps),
		Version:     1,
	}

	newID, err := s.repo.InsertSetup(ctx, tx, setup)
	if err != nil {
		return nil, result, fmt.Errorf("insert setup: %w", err)
	}
	setup.ID = newID

	for i := range input.Steps {
		input.Steps[i].StepOrder = i + 1
	}
	if err = s.repo.InsertSteps(ctx, tx, newID, input.Steps); err != nil {
		return nil, result, fmt.Errorf("insert steps: %w", err)
	}

	if err = s.repo.InsertComboSetup(ctx, tx, parentComboID, newID); err != nil {
		return nil, result, fmt.Errorf("insert combo_setup: %w", err)
	}

	// M19-03 §4.5: 提案の採用時にチェックされた「確認できた条件」を成立(ok)として記録する。
	// 紐付け(combo_setups)を作った後・同一トランザクション内でのみ書く
	// (紐付けが無い状態では複合 FK が成立しないため)。
	if err = s.insertVerifiedConditions(ctx, tx, parentComboID, newID, input.VerifiedConditions); err != nil {
		return nil, result, err
	}

	if err = s.notationSvc.RecomputeSetupCache(ctx, tx, newID); err != nil {
		return nil, result, fmt.Errorf("recompute setup cache: %w", err)
	}

	if err = tx.Commit(); err != nil {
		return nil, result, fmt.Errorf("commit: %w", err)
	}

	resp, getErr := s.buildResponse(ctx, newID)
	if getErr != nil {
		slog.WarnContext(ctx, "create setup: post-insert buildResponse failed", slog.String("err", getErr.Error()))
		return &SetupResponse{Setup: setup, ParentComboIDs: []int64{parentComboID}}, result, nil
	}
	return resp, result, nil
}

// ---------------------------------------------------------------------------
// CreateSetupInTx（M4-04: コンボ同時登録用）
// ---------------------------------------------------------------------------

func (s *service) CreateSetupInTx(ctx context.Context, tx *sql.Tx, parentComboID int64, input CreateSetupInput) (*SetupResponse, validation.ValidationResult, error) {
	recipeHash := CalcSetupRecipeHash(input.Steps)

	// ★★M24-13 §4.6: tx は元から在ったが、判定は s.validDeps(*sql.DB 直読み)を
	//   使っており、**同じ tx が今まさに書いた行が見えていなかった**(D-360)。
	//   ⇒ 同一リクエストで同梱された 2 本目の同一レシピが重複として検出されない。
	result := ValidateSetupCreate(ctx, parentComboID, input, recipeHash, s.txScopedValidDeps(ctx, tx))
	if result.HasError() {
		return nil, result, nil
	}

	// ComboExists チェックは意図的にスキップ。
	// 同一トランザクション内でコンボが作成された直後であり、
	// repo.ComboExists は committed data を読むため未コミットのコンボは見えない。

	setup := &model.Setup{
		CharacterID: input.CharacterID,
		Name:        input.Name,
		Description: input.Description,
		StepCount:   len(input.Steps),
		Version:     1,
	}

	newID, err := s.repo.InsertSetup(ctx, tx, setup)
	if err != nil {
		return nil, result, fmt.Errorf("insert setup: %w", err)
	}
	setup.ID = newID

	for i := range input.Steps {
		input.Steps[i].StepOrder = i + 1
	}
	if err = s.repo.InsertSteps(ctx, tx, newID, input.Steps); err != nil {
		return nil, result, fmt.Errorf("insert steps: %w", err)
	}

	if err = s.repo.InsertComboSetup(ctx, tx, parentComboID, newID); err != nil {
		return nil, result, fmt.Errorf("insert combo_setup: %w", err)
	}

	// M19-03 §4.5: CreateSetup と同じ経路。呼び出し側の Tx 内・紐付けの後で書く。
	if err = s.insertVerifiedConditions(ctx, tx, parentComboID, newID, input.VerifiedConditions); err != nil {
		return nil, result, err
	}

	if err = s.notationSvc.RecomputeSetupCache(ctx, tx, newID); err != nil {
		return nil, result, fmt.Errorf("recompute setup cache: %w", err)
	}

	return &SetupResponse{
		Setup:          setup,
		DefaultRecipe:  "",
		ParentComboIDs: []int64{parentComboID},
	}, result, nil
}

// ---------------------------------------------------------------------------
// CreateSetupLink(POST /api/combos/{comboId}/setup-links)
// ---------------------------------------------------------------------------

func (s *service) CreateSetupLink(ctx context.Context, comboID, setupID int64) error {
	exists, err := s.repo.ComboSetupExists(ctx, comboID, setupID)
	if err != nil {
		return fmt.Errorf("check combo_setup exists: %w", err)
	}
	if exists {
		return nil // 冪等
	}

	active, err := s.repo.SetupExistsActive(ctx, setupID)
	if err != nil {
		return fmt.Errorf("check setup active: %w", err)
	}
	if !active {
		return ErrNotFound
	}

	comboActive, err := s.repo.ComboExists(ctx, comboID)
	if err != nil {
		return fmt.Errorf("check combo exists: %w", err)
	}
	if !comboActive {
		return ErrNotFound
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	if err = s.repo.InsertComboSetup(ctx, tx, comboID, setupID); err != nil {
		return fmt.Errorf("insert combo_setup: %w", err)
	}
	if err = tx.Commit(); err != nil {
		return fmt.Errorf("commit: %w", err)
	}
	return nil
}

// ---------------------------------------------------------------------------
// DeleteSetupLink(DELETE /api/combos/{comboId}/setup-links/{setupId})
// ---------------------------------------------------------------------------

func (s *service) DeleteSetupLink(ctx context.Context, comboID, setupID int64) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	if err = s.repo.DeleteComboSetup(ctx, tx, comboID, setupID); err != nil {
		if errors.Is(err, setuprepo.ErrNotFound) {
			return ErrNotFound
		}
		return fmt.Errorf("delete combo_setup: %w", err)
	}
	if err = tx.Commit(); err != nil {
		return fmt.Errorf("commit: %w", err)
	}
	return nil
}

// ---------------------------------------------------------------------------
// GetSetup(GET /api/setups/{id})
// ---------------------------------------------------------------------------

func (s *service) GetSetup(ctx context.Context, setupID int64) (*SetupResponse, error) {
	return s.buildResponse(ctx, setupID)
}

// ---------------------------------------------------------------------------
// UpdateSetup(PATCH /api/setups/{id})
// ---------------------------------------------------------------------------

func (s *service) UpdateSetup(ctx context.Context, setupID int64, input UpdateSetupInput) (*SetupResponse, validation.ValidationResult, error) {
	var result validation.ValidationResult

	existing, err := s.repo.FindByID(ctx, setupID)
	if err != nil {
		if errors.Is(err, setuprepo.ErrNotFound) {
			return nil, result, ErrNotFound
		}
		return nil, result, fmt.Errorf("find setup: %w", err)
	}

	// ★★M24-13 §4.6: VAL-S04 の判定を、更新と同じ書き込みトランザクションの内側で行う。
	//   以前は BeginTx の **前** に判定していた(CreateSetup と同型の check-then-act)。
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, result, fmt.Errorf("begin tx: %w", err)
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	// レシピ変更時のバリデーション
	if input.Steps != nil {
		// ★★検証側は AllowDeleted を使う(M23-03 §4.5)。VAL-S04 の母集団は
		// 「復元されうるものも含む」必要があり、ここを表示用(Live)へ差し替えると
		// 「ゴミ箱へ入れる → 同じレシピを作る → 復元する」で重複が静かに並ぶ。
		parentComboIDs, findErr := s.repo.FindComboIDsBySetupIDAllowDeleted(ctx, setupID)
		if findErr != nil {
			err = findErr
			return nil, result, fmt.Errorf("find combo_ids: %w", findErr)
		}
		stepsForHash := *input.Steps
		recipeHash := CalcSetupRecipeHash(stepsForHash)
		// ★渡した tx を判定が読みにも使うこと(D-360)。
		result = ValidateSetupUpdate(ctx, setupID, parentComboIDs, input, existing.CharacterID, recipeHash, s.txScopedValidDeps(ctx, tx))
		if result.HasError() {
			// ★検証エラーは err に載らないため、上の defer は発火しない。明示的に閉じる。
			_ = tx.Rollback()
			return nil, result, nil
		}
	}

	// メタデータの決定
	name := existing.Name
	if input.Name != nil {
		name = input.Name
	}
	description := existing.Description
	if input.Description != nil {
		description = input.Description
	}
	stepCount := existing.StepCount
	if input.Steps != nil {
		stepCount = len(*input.Steps)
	}

	_, err = s.repo.UpdateSetup(ctx, tx, setupID, input.Version, name, description, stepCount)
	if err != nil {
		if errors.Is(err, setuprepo.ErrConflict) {
			return nil, result, ErrConflict
		}
		if errors.Is(err, setuprepo.ErrNotFound) {
			return nil, result, ErrNotFound
		}
		return nil, result, fmt.Errorf("update setup: %w", err)
	}

	// レシピ変更時: steps 置換 + cache 再計算
	if input.Steps != nil {
		if err = s.repo.DeleteStepsBySetupID(ctx, tx, setupID); err != nil {
			return nil, result, fmt.Errorf("delete steps: %w", err)
		}
		steps := *input.Steps
		for i := range steps {
			steps[i].StepOrder = i + 1
		}
		if err = s.repo.InsertSteps(ctx, tx, setupID, steps); err != nil {
			return nil, result, fmt.Errorf("insert steps: %w", err)
		}
		if err = s.notationSvc.RecomputeSetupCache(ctx, tx, setupID); err != nil {
			return nil, result, fmt.Errorf("recompute setup cache: %w", err)
		}
	}

	if err = tx.Commit(); err != nil {
		return nil, result, fmt.Errorf("commit: %w", err)
	}

	resp, getErr := s.buildResponse(ctx, setupID)
	if getErr != nil {
		return nil, result, fmt.Errorf("post-update buildResponse: %w", getErr)
	}
	return resp, result, nil
}

// ---------------------------------------------------------------------------
// DeleteSetup(DELETE /api/setups/{id})
// ---------------------------------------------------------------------------

func (s *service) DeleteSetup(ctx context.Context, setupID int64, unlinkFromComboID *int64) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	if err = s.repo.SoftDelete(ctx, tx, setupID); err != nil {
		if errors.Is(err, setuprepo.ErrNotFound) {
			return ErrNotFound
		}
		return fmt.Errorf("soft delete: %w", err)
	}

	// 案 P1(M4-01・フェーズ1)は M23-02(2026-08-20・D-483)で撤回した。
	// 当時は「論理削除されたセットプレイは二度と戻らない」前提だったため、紐付けを
	// 保つ意味が無かった。本 MS が復元を足したことでその前提が変わった。
	//
	// ⇒ 論理削除中も combo_setups / combo_setup_results を保ち、除外は参照側の
	//   deleted_at IS NULL に委ねる(setups 参照 SQL 14 本中 13 本が述語を持つ)。
	//   紐付けを消すと、同じセットプレイを共有している他の生きたコンボからも
	//   紐付けが失われ、復元しても戻せないため(D-484)。
	//
	// ★combo_setups の行が「必ず生きたセットプレイを指す」という不変条件はここで
	//   失われる。その不変条件に依存していた判定は M23-02 で是正済み
	//   (comborepo.CountComboSetupsByComboID / setuprepo.comboSetupExists)。

	// ★★M31-01(P4M-019): 任意で「このコンボとの紐付け」も外す—————————————
	// 逐語＝「セットプレイ削除時にコンボとの紐づきを一緒に外す方法をつけたい」
	// (phase4-memo.txt:63)。
	//
	// ★★消すのは指定された 1 組だけである。DeleteComboSetupsBySetupID(全消し)を
	//   呼んではならない——同じセットプレイを共有している他の生きたコンボからも
	//   紐付けが失われ、復元しても戻せなくなる(D-484 が撤回した案 P1 そのもの)。
	// ★★外した紐付けは復元しても戻らない。上の SoftDelete が紐付けを残すのは
	//   「復元で戻す」ためであり、ここで消したぶんはその対象から外れる。
	//   ⇒ 画面はそれを文面で言うこと(SetupAccordionItem の削除ダイアログ)。
	// ★同じトランザクションで行う。分けると、削除だけ通って解除が落ちる形が生まれる。
	// ★既に紐付いていない場合(ErrNotFound)は無視する——利用者の意図は
	//   「外れている状態にする」であり、冪等でよい。
	if unlinkFromComboID != nil {
		if uErr := s.repo.DeleteComboSetup(ctx, tx, *unlinkFromComboID, setupID); uErr != nil &&
			!errors.Is(uErr, setuprepo.ErrNotFound) {
			err = fmt.Errorf("unlink combo_setup: %w", uErr)
			return err
		}
	}

	// recipe_cache を物理削除（SUPP-001 §7.5.6）
	if err = s.notationSvc.DeleteSetupCache(ctx, tx, setupID); err != nil {
		return fmt.Errorf("delete setup cache: %w", err)
	}

	if err = tx.Commit(); err != nil {
		return fmt.Errorf("commit: %w", err)
	}
	return nil
}

// ---------------------------------------------------------------------------
// GetSetupCandidates(GET /api/combos/{comboId}/setup-candidates)
// FR011: 同一キャラ + 同一 knockdown_advantage の他コンボに紐付く setup を候補として返す。
// ---------------------------------------------------------------------------

func (s *service) GetSetupCandidates(ctx context.Context, comboID int64) ([]*SetupResponse, error) {
	combo, err := s.comboReader.FindByID(ctx, comboID)
	if err != nil {
		if errors.Is(err, comborepo.ErrNotFound) {
			return nil, ErrComboNotFound
		}
		return nil, fmt.Errorf("find combo: %w", err)
	}

	candidates, err := s.repo.FindCandidateSetups(ctx, combo.CharacterID, combo.KnockdownAdvantage, comboID)
	if err != nil {
		return nil, fmt.Errorf("find candidate setups: %w", err)
	}
	return s.buildCandidateResponses(ctx, candidates)
}

// GetSetupCandidatesByKnockdown(GET /api/setups/candidates?characterId=X&knockdownAdvantage=Y)
// C-08: 新規コンボ登録時の紐付け候補。保存前で comboID が無いため (characterID, knockdownAdvantage)
// を直接受け取り、同一キャラ + 同一 knockdown_advantage の他コンボに紐付く setup を候補として返す。
// excludeComboID=0(存在しない ID)を渡して GetSetupCandidates と同一の絞り込みを再利用する。
func (s *service) GetSetupCandidatesByKnockdown(ctx context.Context, characterID int64, knockdownAdvantage *int) ([]*SetupResponse, error) {
	candidates, err := s.repo.FindCandidateSetups(ctx, characterID, knockdownAdvantage, 0)
	if err != nil {
		return nil, fmt.Errorf("find candidate setups: %w", err)
	}
	return s.buildCandidateResponses(ctx, candidates)
}

// buildCandidateResponses は候補 setup に親コンボ ID・既定レシピを付与して SetupResponse 化する。
func (s *service) buildCandidateResponses(ctx context.Context, candidates []*model.Setup) ([]*SetupResponse, error) {
	if len(candidates) == 0 {
		return []*SetupResponse{}, nil
	}

	ids := make([]int64, len(candidates))
	for i, c := range candidates {
		ids[i] = c.ID
	}
	comboIDsMap, err := s.repo.FindLiveComboIDsBySetupIDs(ctx, ids)
	if err != nil {
		return nil, fmt.Errorf("find combo_ids: %w", err)
	}

	results := make([]*SetupResponse, len(candidates))
	for i, setup := range candidates {
		pComboIDs := comboIDsMap[setup.ID]
		if pComboIDs == nil {
			pComboIDs = []int64{}
		}
		results[i] = &SetupResponse{
			Setup:          setup,
			DefaultRecipe:  s.extractDefaultRecipe(setup.RecipeCache),
			ParentComboIDs: pComboIDs,
		}
	}
	return results, nil
}

// ---------------------------------------------------------------------------
// ListSetups(GET /api/setups?characterId=X)
// ---------------------------------------------------------------------------

func (s *service) ListSetups(ctx context.Context, characterID *int64) ([]*SetupResponse, error) {
	setups, err := s.repo.ListByCharacterID(ctx, characterID)
	if err != nil {
		return nil, fmt.Errorf("list setups: %w", err)
	}
	if len(setups) == 0 {
		return []*SetupResponse{}, nil
	}

	ids := make([]int64, len(setups))
	for i, s := range setups {
		ids[i] = s.ID
	}
	comboIDsMap, err := s.repo.FindLiveComboIDsBySetupIDs(ctx, ids)
	if err != nil {
		return nil, fmt.Errorf("find combo_ids: %w", err)
	}

	results := make([]*SetupResponse, len(setups))
	for i, setup := range setups {
		comboIDs := comboIDsMap[setup.ID]
		if comboIDs == nil {
			comboIDs = []int64{}
		}
		results[i] = &SetupResponse{
			Setup:          setup,
			DefaultRecipe:  s.extractDefaultRecipe(setup.RecipeCache),
			ParentComboIDs: comboIDs,
		}
	}
	return results, nil
}

// ---------------------------------------------------------------------------
// ListSetupsByComboID(コンボ詳細用)
// ---------------------------------------------------------------------------

func (s *service) ListSetupsByComboID(ctx context.Context, comboID int64) ([]*SetupResponse, error) {
	setups, err := s.repo.ListSetupsByComboID(ctx, comboID)
	if err != nil {
		return nil, fmt.Errorf("list setups by combo: %w", err)
	}
	if len(setups) == 0 {
		return []*SetupResponse{}, nil
	}

	ids := make([]int64, len(setups))
	for i, sv := range setups {
		ids[i] = sv.ID
	}
	comboIDsMap, err := s.repo.FindLiveComboIDsBySetupIDs(ctx, ids)
	if err != nil {
		return nil, fmt.Errorf("find combo_ids: %w", err)
	}

	results := make([]*SetupResponse, len(setups))
	for i, setup := range setups {
		pComboIDs := comboIDsMap[setup.ID]
		if pComboIDs == nil {
			pComboIDs = []int64{}
		}
		results[i] = &SetupResponse{
			Setup:          setup,
			DefaultRecipe:  s.extractDefaultRecipe(setup.RecipeCache),
			ParentComboIDs: pComboIDs,
		}
	}
	return results, nil
}

// ---------------------------------------------------------------------------
// ListSetupsByComboIDs(コンボ一覧用バッチ取得)
// ---------------------------------------------------------------------------

func (s *service) ListSetupsByComboIDs(ctx context.Context, comboIDs []int64) (map[int64][]*SetupResponse, error) {
	result := make(map[int64][]*SetupResponse)
	if len(comboIDs) == 0 {
		return result, nil
	}

	setupsByCombo, err := s.repo.ListSetupsByComboIDs(ctx, comboIDs)
	if err != nil {
		return nil, fmt.Errorf("list setups by combo ids: %w", err)
	}

	var allSetupIDs []int64
	for _, setups := range setupsByCombo {
		for _, setup := range setups {
			allSetupIDs = append(allSetupIDs, setup.ID)
		}
	}

	var comboIDsMap map[int64][]int64
	if len(allSetupIDs) > 0 {
		comboIDsMap, err = s.repo.FindLiveComboIDsBySetupIDs(ctx, allSetupIDs)
		if err != nil {
			return nil, fmt.Errorf("find combo_ids batch: %w", err)
		}
	}

	for comboID, setups := range setupsByCombo {
		responses := make([]*SetupResponse, len(setups))
		for i, setup := range setups {
			pComboIDs := comboIDsMap[setup.ID]
			if pComboIDs == nil {
				pComboIDs = []int64{}
			}
			responses[i] = &SetupResponse{
				Setup:          setup,
				DefaultRecipe:  s.extractDefaultRecipe(setup.RecipeCache),
				ParentComboIDs: pComboIDs,
			}
		}
		result[comboID] = responses
	}
	return result, nil
}

// ---------------------------------------------------------------------------
// ヘルパ
// ---------------------------------------------------------------------------

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

func (s *service) buildResponse(ctx context.Context, setupID int64) (*SetupResponse, error) {
	setup, err := s.repo.FindByID(ctx, setupID)
	if err != nil {
		return nil, err
	}

	// ★表示側は Live を使う(M23-03 §4.5)。応答の parentComboIds は
	// 「いま見えているコンボ」だけを載せる。
	comboIDs, err := s.repo.FindLiveComboIDsBySetupID(ctx, setupID)
	if err != nil {
		return nil, fmt.Errorf("find combo_ids: %w", err)
	}

	defaultRecipe := s.extractDefaultRecipe(setup.RecipeCache)

	return &SetupResponse{
		Setup:          setup,
		DefaultRecipe:  defaultRecipe,
		ParentComboIDs: comboIDs,
	}, nil
}

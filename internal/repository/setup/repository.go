// Package setup はセットプレイの DB アクセスを提供する。
//
// 設計参照: DES-003 §3.11〜§3.13、M4-01 指示書 §4。
package setup

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/plexiblinp/tacpendium/internal/model"
	"github.com/plexiblinp/tacpendium/internal/recipehash"
)

// ErrNotFound はセットプレイが見つからない場合のセンチネル。
var ErrNotFound = errors.New("setup: not found")

// ErrConflict は楽観的排他で version 不一致だった場合のセンチネル。
var ErrConflict = errors.New("setup: optimistic lock conflict")

// Repository はセットプレイ DB アクセスの公開インタフェース。
type Repository interface {
	// InsertSetup は setups に 1 行 INSERT し、新 id を返す。
	InsertSetup(ctx context.Context, tx *sql.Tx, setup *model.Setup) (int64, error)

	// InsertSteps は setup_steps に複数行 INSERT する。
	InsertSteps(ctx context.Context, tx *sql.Tx, setupID int64, steps []model.SetupStep) error

	// InsertComboSetup は combo_setups に 1 行 INSERT する。
	InsertComboSetup(ctx context.Context, tx *sql.Tx, comboID, setupID int64) error

	// DeleteComboSetup は combo_setups から 1 行 DELETE する。
	DeleteComboSetup(ctx context.Context, tx *sql.Tx, comboID, setupID int64) error

	// DeleteComboSetupsBySetupID は指定 setup の combo_setups を全行 DELETE する。
	// combo_setup_results を先に明示削除する(FK の効き方に依存せず残さない)。
	// ★M23-02(D-483)の案 P1 撤回により、論理削除の経路からは呼ばれなくなった。
	//   現在の本番呼び元は HardDelete(完全削除)のみである。
	DeleteComboSetupsBySetupID(ctx context.Context, tx *sql.Tx, setupID int64) error

	// --- M23-02: ゴミ箱(復元・完全削除・削除済み一覧) ---

	// FindByIDAllowDeleted は論理削除済みを含めて 1 件返す。完全削除の前チェック専用。
	FindByIDAllowDeleted(ctx context.Context, tx *sql.Tx, setupID int64) (*model.Setup, error)

	// Restore は論理削除を解除する。version には触れない(コンボ側と揃える)。
	Restore(ctx context.Context, tx *sql.Tx, setupID int64) error

	// FindLiveReferencingCombos は当該 setup を参照している生きたコンボを返す。
	FindLiveReferencingCombos(ctx context.Context, tx *sql.Tx, setupID int64) ([]model.ComboRef, error)

	// HardDelete は 4 表から明示削除する(CASCADE に委ねない)。
	HardDelete(ctx context.Context, tx *sql.Tx, setupID int64) error

	// ListDeletedByCharacterID は論理削除済みのセットプレイを返す(ゴミ箱一覧)。
	ListDeletedByCharacterID(ctx context.Context, characterID *int64) ([]*model.Setup, error)

	// FindByID は指定 ID のセットプレイを Steps 含めて返す。
	// 論理削除済みは返さない。見つからない場合は ErrNotFound。
	FindByID(ctx context.Context, setupID int64) (*model.Setup, error)

	// FindStepsBySetupID は setup_steps を取得する(moves.code JOIN 含む)。
	FindStepsBySetupID(ctx context.Context, setupID int64) ([]model.SetupStep, error)

	// FindStepsBySetupIDTx は tx 内で setup_steps を取得する。
	FindStepsBySetupIDTx(ctx context.Context, tx *sql.Tx, setupID int64) ([]model.SetupStep, error)

	// FindStepsBySetupIDs は複数セットプレイの setup_steps を IN 句 1 クエリで取得する
	// (M23-06 §4.3-3)。ゴミ箱一覧のレシピ解決が件数ぶんの問い合わせにならないようにする。
	//
	// ★deleted_at の述語を持たない。setup_steps は論理削除で消えないため、
	//   削除済みセットプレイのステップもそのまま返る(FindStepsBySetupID と同じ)。
	FindStepsBySetupIDs(ctx context.Context, setupIDs []int64) (map[int64][]model.SetupStep, error)

	// FindLiveComboIDsBySetupID は紐付きコンボ ID のうち、論理削除されていないものだけを返す。
	// 応答に載せる parentComboIds(利用者に見える「使われているコンボ」)はこちらを使う。
	// ★対になる検証用は FindComboIDsBySetupIDAllowDeleted。用途で使い分けること。
	FindLiveComboIDsBySetupID(ctx context.Context, setupID int64) ([]int64, error)

	// FindComboIDsBySetupIDAllowDeleted は紐付きコンボ ID を、論理削除済みも含めて返す。
	//
	// ★★これは「述語の書き漏らし」ではない(M23-03 §4.5)。VAL-S04(同一コンボ内の
	// レシピ重複)の母集団は「復元されうるものも含む」必要がある。緩めると
	// 「ゴミ箱へ入れる → 同じレシピを作る → 復元する」で同一レシピが 2 本並び、
	// DB 制約が無いため誰も気づかない(followup setup-restore-reintroduces-duplicate)。
	// ⇒ 表示用の FindLiveComboIDsBySetupID と統合しないこと。2 つとも現役である。
	FindComboIDsBySetupIDAllowDeleted(ctx context.Context, setupID int64) ([]int64, error)

	// FindLiveComboIDsBySetupIDTx / FindComboIDsBySetupIDAllowDeletedTx は上記 2 本の tx 版。
	// 復元の検証(VAL-R02・M23-04 §4.2)が復元と同じトランザクションの内側で読むために使う。
	// ★上と同じ使い分けが要る。VAL-R02 の母集団は AllowDeleted 側である。
	FindLiveComboIDsBySetupIDTx(ctx context.Context, tx *sql.Tx, setupID int64) ([]int64, error)
	FindComboIDsBySetupIDAllowDeletedTx(ctx context.Context, tx *sql.Tx, setupID int64) ([]int64, error)

	// FindReferencingCombosAllowDeletedTx は指定セットプレイを参照しているコンボを、
	// 論理削除済みも含めて memo 付きで返す(VAL-R02 の details 用・M23-04 §4.3-3)。
	// ★id だけの FindComboIDsBySetupIDAllowDeletedTx と併存する。用途が違う。
	FindReferencingCombosAllowDeletedTx(ctx context.Context, tx *sql.Tx, setupID int64) ([]model.ComboRef, error)

	// FindDeletedSetupRefsByComboID は指定コンボに紐付くセットプレイのうち、論理削除
	// 済みのものだけを返す(VAL-R01・M23-04 §4.7)。表示用の ListSetupsByComboID とは
	// 求める集合が正反対であり、統合しない。
	FindDeletedSetupRefsByComboID(ctx context.Context, tx *sql.Tx, comboID int64) ([]model.SetupRef, error)

	// SoftDelete は deleted_at を現在時刻に設定する。
	SoftDelete(ctx context.Context, tx *sql.Tx, setupID int64) error

	// UpdateSetup はメタデータを更新する。version で楽観的排他。
	// 戻り値は新しい version。version 不一致なら ErrConflict。
	UpdateSetup(ctx context.Context, tx *sql.Tx, setupID int64, version int, name, description *string, stepCount int) (int, error)

	// DeleteStepsBySetupID は setup_steps を全行 DELETE する。
	DeleteStepsBySetupID(ctx context.Context, tx *sql.Tx, setupID int64) error

	// GetRecipeCache は setups.recipe_cache を返す。NULL なら (*string)(nil)。
	// 論理削除済みセットプレイは対象外で ErrNotFound を返す(M23-03 §4.2)。
	GetRecipeCache(ctx context.Context, setupID int64) (*string, error)

	// UpdateRecipeCache は recipe_cache を更新する(非 tx)。
	UpdateRecipeCache(ctx context.Context, setupID int64, cacheJSON string) error

	// UpdateRecipeCacheTx は recipe_cache を tx 内で更新する。
	UpdateRecipeCacheTx(ctx context.Context, tx *sql.Tx, setupID int64, cacheJSON string) error

	// SetRecipeCacheNullTx は recipe_cache を NULL に設定する。
	SetRecipeCacheNullTx(ctx context.Context, tx *sql.Tx, setupID int64) error

	// ListAllActiveSetupsTx は deleted_at IS NULL の全セットプレイを返す。Steps はロードしない。
	// tx が nil なら DB ハンドルで読む。
	//
	// ★M20-05(§4.4-4・D-360)で tx を取る形へ変えた。理由は combo 側と同じ。
	ListAllActiveSetupsTx(ctx context.Context, tx *sql.Tx) ([]*model.Setup, error)

	// FindDuplicateInCombo は同一コンボ内で同一レシピハッシュの setup を探す(VAL-S04)。
	//
	// ★★書き込みトランザクションの内側からは呼ばないこと。FindDuplicateInComboTx を使う
	//   (M24-13 §4.6)。本関数は *sql.DB 直読みであり、同じ tx が今まさに書いた行が
	//   見えない ⇒ check-then-act の窓が開く(D-360)。
	// ★tx を開かない経路(保存前チェック・提案の採択判定)は本関数でよい。
	// excludeSetupID が非 nil なら自身を除外する(更新時用)。
	FindDuplicateInCombo(ctx context.Context, comboID int64, characterID int64, recipeHash string, excludeSetupID *int64) (*int64, error)

	// FindDuplicateInComboTx は上記を渡された tx の内側で行う(M24-13 §4.6)。
	// ★tx=nil なら FindDuplicateInCombo と同じ(*sql.DB 直読み)。
	FindDuplicateInComboTx(ctx context.Context, tx *sql.Tx, comboID int64, characterID int64, recipeHash string, excludeSetupID *int64) (*int64, error)

	// FindDeletedDuplicateRefsInCombo は VAL-S07(同一親コンボのゴミ箱に同じレシピがある)の
	// 一致行を返す(M23-05 §4.4)。
	//
	// ★FindDuplicateInCombo(VAL-S04)とは母集団が正反対である——あちらは
	//   s.deleted_at IS NULL、こちらは s.deleted_at IS NOT NULL。統合しないこと。
	// ★返すのが id ではなく SetupRef({id, name})なのは、警告の details へ「どれが問題か」を
	//   人が読める文字列付きで載せるためである(DES-002 §4.3 規則 1)。
	// ★FindDeletedSetupRefsByComboID(M23-04・VAL-R01)とも別物である。あちらは
	//   「紐付いている削除済みの全件」、こちらは「レシピが一致するものだけ」。
	FindDeletedDuplicateRefsInCombo(ctx context.Context, comboID int64, characterID int64, recipeHash string) ([]model.SetupRef, error)

	// FindLiveDuplicateRefsInComboTx は VAL-R04(復元したら生きた重複が居た)の一致行を返す
	// (M23-05 §4.4)。復元と同じトランザクションの内側から読むため tx を取る。
	//
	// ★★excludeSetupID は「復元しようとしている行そのもの」である。復元は deleted_at を
	//   NULL に戻してから検証するため(M23-04 §4.2)、除外しないと自分が自分の重複相手になる。
	// ★★本関数を足した当時、FindDuplicateInCombo は tx を取らなかった(r.db 直叩き)。
	//   その制約は M24-13 §4.6 で解消済みである(FindDuplicateInComboTx)。
	//   ★それでも本関数は残る——返す値(SetupRef)と母集団の向き(生きた側のみ)が違い、
	//     VAL-R04 は警告の details に「どれが問題か」を人が読める形で必要とするためである。
	FindLiveDuplicateRefsInComboTx(ctx context.Context, tx *sql.Tx, comboID int64, characterID int64, recipeHash string, excludeSetupID int64) ([]model.SetupRef, error)

	// FindLiveDuplicateRefsInCombo は保存前チェックの「生きた側」を返す(M23-09 §4.1-2)。
	//
	// ★母集団は VAL-S04(FindDuplicateInCombo)と同一である——同一親コンボ・同一キャラ・
	//   s.deleted_at IS NULL・レシピ一致。違うのは返す値だけで、id ではなく SetupRef を返す
	//   (ダイアログが「どれか」を人が読める形で出すため＝§4.1-3)。
	// ★除外 id を取らない。保存前チェックは新規登録の経路だけで使い、まだ行が無い。
	// ★Tx 版(FindLiveDuplicateRefsInComboTx)とは呼ばれる文脈が違う。あちらは復元 Tx の
	//   内側から読み、復元対象自身を除外する必要がある。
	FindLiveDuplicateRefsInCombo(ctx context.Context, comboID int64, characterID int64, recipeHash string) ([]model.SetupRef, error)

	// ComboSetupExists は combo_setups にエントリが存在するか返す。
	ComboSetupExists(ctx context.Context, comboID, setupID int64) (bool, error)

	// ComboSetupExistsTx は同一トランザクション内で紐付けの存在を確認する(M19-03)。
	ComboSetupExistsTx(ctx context.Context, tx *sql.Tx, comboID, setupID int64) (bool, error)

	// ComboExists は combos テーブルにアクティブなコンボが存在するか返す。
	ComboExists(ctx context.Context, comboID int64) (bool, error)

	// SetupExistsActive は setups テーブルにアクティブなセットプレイが存在するか返す。
	SetupExistsActive(ctx context.Context, setupID int64) (bool, error)

	// ListByCharacterID は characterID でフィルタしたアクティブな setup 一覧を返す。
	// characterID が nil のときは全件返す。Steps はロードしない(一覧用)。
	ListByCharacterID(ctx context.Context, characterID *int64) ([]*model.Setup, error)

	// FindLiveComboIDsBySetupIDs は setupIDs に対する combo_id 一覧のうち、
	// 論理削除されていないコンボだけを返す。結果は map[setupID][]comboID 形式。
	// ★単数版と同じく表示用である。呼び元は応答組み立てのみで、検証には使わない。
	// AllowDeleted の複数版は呼び元が無いため作っていない(必要になった時点で足す)。
	FindLiveComboIDsBySetupIDs(ctx context.Context, setupIDs []int64) (map[int64][]int64, error)

	// ListSetupsByComboID は comboID に紐付くアクティブな setup 一覧を返す。Steps はロードしない。
	ListSetupsByComboID(ctx context.Context, comboID int64) ([]*model.Setup, error)

	// ListSetupsByComboIDs は複数 comboID に紐付くアクティブな setup 一覧を返す。
	// 結果は map[comboID][]*model.Setup 形式。N+1 回避用バッチ取得。
	ListSetupsByComboIDs(ctx context.Context, comboIDs []int64) (map[int64][]*model.Setup, error)

	// FindCandidateSetups は FR011 転用候補を返す。
	// 同一キャラ + 同一 knockdown_advantage の他コンボに紐付いている setup を返す。
	// knockdownAdvantage が nil の場合は SQL の = 比較で候補 0 件になる。
	FindCandidateSetups(ctx context.Context, characterID int64, knockdownAdvantage *int, excludeComboID int64) ([]*model.Setup, error)

	// --- combo_setup_results(セットプレイ成立条件の検証結果・M19-03)。実装は setup_results.go ---

	// ListSetupResultsByComboID は 1 コンボ分の検証結果を 1 クエリで返す(N+1 回避)。
	ListSetupResultsByComboID(ctx context.Context, comboID int64) ([]model.ComboSetupResult, error)

	// UpsertSetupResult は 1 セル分の検証結果を作成または更新する。
	UpsertSetupResult(ctx context.Context, tx *sql.Tx, res model.ComboSetupResult) error

	// DeleteSetupResult は 1 セル分を物理削除する(=「未検証へ戻す」)。
	DeleteSetupResult(ctx context.Context, tx *sql.Tx, comboID, setupID int64, techType string, inCorner bool) error

	// InsertSetupResultsTx は複数セル分をまとめて書く(提案の採用時・同一 Tx 用)。
	InsertSetupResultsTx(ctx context.Context, tx *sql.Tx, results []model.ComboSetupResult) error
}

type repository struct {
	db *sql.DB
}

// New は Repository を構築する。
func New(db *sql.DB) Repository {
	return &repository{db: db}
}

// ---------------------------------------------------------------------------
// sqlRunner (tx/non-tx 切替、combo repository と同パターン)
// ---------------------------------------------------------------------------

type sqlRunner interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}

func (r *repository) runner(tx *sql.Tx) sqlRunner {
	if tx != nil {
		return tx
	}
	return r.db
}

// ---------------------------------------------------------------------------
// InsertSetup / InsertSteps
// ---------------------------------------------------------------------------

const insertSetupSQL = `
INSERT INTO setups (character_id, name, description, step_count, recipe_cache, version)
VALUES (?, ?, ?, ?, ?, ?)`

func (r *repository) InsertSetup(ctx context.Context, tx *sql.Tx, setup *model.Setup) (int64, error) {
	exec := r.runner(tx)
	result, err := exec.ExecContext(ctx, insertSetupSQL,
		setup.CharacterID, setup.Name, setup.Description,
		setup.StepCount, setup.RecipeCache, setup.Version,
	)
	if err != nil {
		return 0, fmt.Errorf("insert setup: %w", err)
	}
	id, err := result.LastInsertId()
	if err != nil {
		return 0, fmt.Errorf("last insert id: %w", err)
	}
	return id, nil
}

const insertStepSQL = `
INSERT INTO setup_steps (setup_id, step_order, move_id, modifiers)
VALUES (?, ?, ?, ?)`

func (r *repository) InsertSteps(ctx context.Context, tx *sql.Tx, setupID int64, steps []model.SetupStep) error {
	if len(steps) == 0 {
		return nil
	}
	exec := r.runner(tx)
	for _, step := range steps {
		modJSON, err := marshalModifiers(step.Modifiers)
		if err != nil {
			return fmt.Errorf("marshal modifiers: %w", err)
		}
		if _, err := exec.ExecContext(ctx, insertStepSQL,
			setupID, step.StepOrder, step.MoveID, modJSON,
		); err != nil {
			return fmt.Errorf("insert step %d: %w", step.StepOrder, err)
		}
	}
	return nil
}

// ---------------------------------------------------------------------------
// combo_setups 操作
// ---------------------------------------------------------------------------

func (r *repository) InsertComboSetup(ctx context.Context, tx *sql.Tx, comboID, setupID int64) error {
	exec := r.runner(tx)
	_, err := exec.ExecContext(ctx,
		`INSERT INTO combo_setups (combo_id, setup_id) VALUES (?, ?)`, comboID, setupID)
	if err != nil {
		return fmt.Errorf("insert combo_setup: %w", err)
	}
	return nil
}

func (r *repository) DeleteComboSetup(ctx context.Context, tx *sql.Tx, comboID, setupID int64) error {
	exec := r.runner(tx)
	// M19-03: 紐付けを消す前に成立条件の検証結果も消す。ON DELETE CASCADE でも消えるが、
	// M19-03 当時は FK=OFF の接続では発火しなかったため明示的に落とす(§4.1.3 の孤児行担保)。
	// ★M23-10 で全接続が FK=ON になった後も、二重の保険として明示削除を残す。
	if _, err := exec.ExecContext(ctx,
		`DELETE FROM combo_setup_results WHERE combo_id = ? AND setup_id = ?`, comboID, setupID); err != nil {
		return fmt.Errorf("delete combo_setup_results: %w", err)
	}
	res, err := exec.ExecContext(ctx,
		`DELETE FROM combo_setups WHERE combo_id = ? AND setup_id = ?`, comboID, setupID)
	if err != nil {
		return fmt.Errorf("delete combo_setup: %w", err)
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("rows affected: %w", err)
	}
	if rows == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *repository) DeleteComboSetupsBySetupID(ctx context.Context, tx *sql.Tx, setupID int64) error {
	exec := r.runner(tx)
	// M19-03: 上記 DeleteComboSetup と同じ理由で、検証結果を先に落とす。
	if _, err := exec.ExecContext(ctx,
		`DELETE FROM combo_setup_results WHERE setup_id = ?`, setupID); err != nil {
		return fmt.Errorf("delete combo_setup_results by setup_id: %w", err)
	}
	_, err := exec.ExecContext(ctx,
		`DELETE FROM combo_setups WHERE setup_id = ?`, setupID)
	if err != nil {
		return fmt.Errorf("delete combo_setups by setup_id: %w", err)
	}
	return nil
}

func (r *repository) ComboSetupExists(ctx context.Context, comboID, setupID int64) (bool, error) {
	return r.comboSetupExists(ctx, r.runner(nil), comboID, setupID)
}

// ComboSetupExistsTx は同一トランザクション内で紐付けの存在を確認する(M19-03)。
// 確認と書き込みの間に紐付けが解除される TOCTOU を塞ぐ用途。
func (r *repository) ComboSetupExistsTx(ctx context.Context, tx *sql.Tx, comboID, setupID int64) (bool, error) {
	return r.comboSetupExists(ctx, r.runner(tx), comboID, setupID)
}

func (r *repository) comboSetupExists(ctx context.Context, exec sqlRunner, comboID, setupID int64) (bool, error) {
	var n int
	// ★setups へ結合し deleted_at IS NULL を課す(M23-02・D-491)。
	// M23-02 が案 P1 を撤回したことで「combo_setups の行は必ず生きたセットプレイを
	// 指す」という不変条件が失われた。本ヘルパの呼び元 2 つはどちらもその不変条件に
	// 寄りかかっている:
	//   - requireComboSetupLinkTx: 結合しないとゴミ箱のセットプレイへ検証結果を書けてしまう
	//   - CreateSetupLink       : 結合しないと exists=true で冪等成功を返し、後続の
	//                             SetupExistsActive による ErrNotFound へ到達しない
	err := exec.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM combo_setups cs
		   JOIN setups s ON s.id = cs.setup_id AND s.deleted_at IS NULL
		  WHERE cs.combo_id = ? AND cs.setup_id = ?`,
		comboID, setupID).Scan(&n)
	if err != nil {
		return false, fmt.Errorf("combo_setup exists: %w", err)
	}
	return n > 0, nil
}

// ---------------------------------------------------------------------------
// FindByID
// ---------------------------------------------------------------------------

const selectSetupByIDSQL = `
SELECT id, character_id, name, description, step_count, recipe_cache,
       version, created_at, updated_at, deleted_at
FROM setups
WHERE id = ? AND deleted_at IS NULL`

func (r *repository) FindByID(ctx context.Context, setupID int64) (*model.Setup, error) {
	setup, err := r.scanSetup(r.db.QueryRowContext(ctx, selectSetupByIDSQL, setupID))
	if err != nil {
		return nil, err
	}
	steps, err := r.FindStepsBySetupID(ctx, setupID)
	if err != nil {
		return nil, fmt.Errorf("find steps: %w", err)
	}
	setup.Steps = steps
	return setup, nil
}

// ---------------------------------------------------------------------------
// FindStepsBySetupID
// ---------------------------------------------------------------------------

const selectStepsBySetupIDSQL = `
SELECT ss.id, ss.setup_id, ss.step_order, ss.move_id, ss.modifiers, m.code
FROM setup_steps ss
LEFT JOIN moves m ON m.id = ss.move_id
WHERE ss.setup_id = ?
ORDER BY ss.step_order`

func (r *repository) FindStepsBySetupID(ctx context.Context, setupID int64) ([]model.SetupStep, error) {
	return r.findStepsBySetupIDRunner(ctx, r.db, setupID)
}

func (r *repository) FindStepsBySetupIDTx(ctx context.Context, tx *sql.Tx, setupID int64) ([]model.SetupStep, error) {
	return r.findStepsBySetupIDRunner(ctx, r.runner(tx), setupID)
}

func (r *repository) findStepsBySetupIDRunner(ctx context.Context, runner sqlRunner, setupID int64) ([]model.SetupStep, error) {
	rows, err := runner.QueryContext(ctx, selectStepsBySetupIDSQL, setupID)
	if err != nil {
		return nil, fmt.Errorf("find steps: %w", err)
	}
	defer rows.Close()

	steps := make([]model.SetupStep, 0)
	for rows.Next() {
		s, err := scanStep(rows)
		if err != nil {
			return nil, err
		}
		steps = append(steps, s)
	}
	return steps, rows.Err()
}

// FindStepsBySetupIDs は複数セットプレイの setup_steps をまとめて取得する(M23-06 §4.3-3)。
//
// ★1 件ずつ FindStepsBySetupID を呼ぶ形にしないこと。ゴミ箱一覧はレシピ文字列を
//
//	件数ぶん解決するため、ステップ取得が N+1 になる。combo 側の FindStepsForCombos と同型。
func (r *repository) FindStepsBySetupIDs(ctx context.Context, setupIDs []int64) (map[int64][]model.SetupStep, error) {
	result := make(map[int64][]model.SetupStep, len(setupIDs))
	if len(setupIDs) == 0 {
		return result, nil
	}

	placeholders := make([]string, len(setupIDs))
	args := make([]any, len(setupIDs))
	for i, id := range setupIDs {
		placeholders[i] = "?"
		args[i] = id
	}

	query := `
SELECT ss.id, ss.setup_id, ss.step_order, ss.move_id, ss.modifiers, m.code
FROM setup_steps ss
LEFT JOIN moves m ON m.id = ss.move_id
WHERE ss.setup_id IN (` + strings.Join(placeholders, ",") + `)
ORDER BY ss.setup_id, ss.step_order`

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("find steps by setup ids: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		s, err := scanStep(rows)
		if err != nil {
			return nil, err
		}
		result[s.SetupID] = append(result[s.SetupID], s)
	}
	return result, rows.Err()
}

// FindLiveComboIDsBySetupID は紐付きコンボ ID のうち論理削除されていないものだけを返す(表示用)。
//
// ★M23-03 §4.5: 元は 1 本の FindComboIDsBySetupID が表示と検証の両方に使われていた。
// 2 つは同じ集合を求めていない——表示は「いま見えているものだけ」、検証は
// 「復元されうるものも含めて」を求める。述語を足して 1 本のまま揃えると検証側が
// 静かに破れるため、関数を 2 つに分けた。検証側は FindComboIDsBySetupIDAllowDeleted。
func (r *repository) FindLiveComboIDsBySetupID(ctx context.Context, setupID int64) ([]int64, error) {
	return r.findLiveComboIDsBySetupIDRunner(ctx, r.db, setupID)
}

// FindLiveComboIDsBySetupIDTx は FindLiveComboIDsBySetupID の tx 版。
// 復元の検証(VAL-R02)が復元と同じトランザクションの内側で読むために使う(M23-04 §4.2)。
func (r *repository) FindLiveComboIDsBySetupIDTx(ctx context.Context, tx *sql.Tx, setupID int64) ([]int64, error) {
	return r.findLiveComboIDsBySetupIDRunner(ctx, r.runner(tx), setupID)
}

func (r *repository) findLiveComboIDsBySetupIDRunner(ctx context.Context, exec sqlRunner, setupID int64) ([]int64, error) {
	rows, err := exec.QueryContext(ctx, `
SELECT cs.combo_id
FROM combo_setups cs
JOIN combos c ON c.id = cs.combo_id AND c.deleted_at IS NULL
WHERE cs.setup_id = ?
ORDER BY cs.combo_id`, setupID)
	if err != nil {
		return nil, fmt.Errorf("find live combo_ids: %w", err)
	}
	defer rows.Close()

	ids := make([]int64, 0)
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return nil, fmt.Errorf("scan combo_id: %w", err)
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

// FindComboIDsBySetupIDAllowDeleted は紐付きコンボ ID を、論理削除済みも含めて返す(検証用)。
//
// ★★述語が無いのは意図である(M23-03 §4.5)。VAL-S04(同一コンボ内のレシピ重複)の
// 母集団は「復元されうるものも含む」必要があり、ここを絞ると
// 「ゴミ箱へ入れる → 同じレシピのセットプレイを作る → 復元する」で同一レシピが
// 2 本並ぶ経路ができる。DB 制約が無いため、破れても誰も気づかない
// (followup setup-restore-reintroduces-duplicate ／ M23-05 の入力)。
// ⇒ 表示用の FindLiveComboIDsBySetupID と統合しないこと。片方が古い名残ではなく、
// 2 つとも現役であり、求めている集合が違う。
func (r *repository) FindComboIDsBySetupIDAllowDeleted(ctx context.Context, setupID int64) ([]int64, error) {
	return r.findComboIDsBySetupIDAllowDeletedRunner(ctx, r.db, setupID)
}

// FindComboIDsBySetupIDAllowDeletedTx は FindComboIDsBySetupIDAllowDeleted の tx 版。
//
// ★VAL-R02(M23-04 §4.7)の母集団を取るのはこちらである。表示用の
// FindLiveComboIDsBySetupIDTx を使うと、親が全部削除済みのとき母集団まで 0 件になり、
// 「すべて削除済み」の判定が永久に成立しなくなる——静かに壊れる形なので取り違えないこと。
func (r *repository) FindComboIDsBySetupIDAllowDeletedTx(ctx context.Context, tx *sql.Tx, setupID int64) ([]int64, error) {
	return r.findComboIDsBySetupIDAllowDeletedRunner(ctx, r.runner(tx), setupID)
}

func (r *repository) findComboIDsBySetupIDAllowDeletedRunner(ctx context.Context, exec sqlRunner, setupID int64) ([]int64, error) {
	rows, err := exec.QueryContext(ctx,
		`SELECT combo_id FROM combo_setups WHERE setup_id = ? ORDER BY combo_id`, setupID)
	if err != nil {
		return nil, fmt.Errorf("find combo_ids (allow deleted): %w", err)
	}
	defer rows.Close()

	ids := make([]int64, 0)
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return nil, fmt.Errorf("scan combo_id: %w", err)
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

// ---------------------------------------------------------------------------
// SoftDelete
// ---------------------------------------------------------------------------

func (r *repository) SoftDelete(ctx context.Context, tx *sql.Tx, setupID int64) error {
	exec := r.runner(tx)
	res, err := exec.ExecContext(ctx,
		`UPDATE setups SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND deleted_at IS NULL`,
		setupID)
	if err != nil {
		return fmt.Errorf("soft delete: %w", err)
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("rows affected: %w", err)
	}
	if rows == 0 {
		return ErrNotFound
	}
	return nil
}

// ---------------------------------------------------------------------------
// UpdateSetup
// ---------------------------------------------------------------------------

func (r *repository) UpdateSetup(ctx context.Context, tx *sql.Tx, setupID int64, version int, name, description *string, stepCount int) (int, error) {
	exec := r.runner(tx)
	res, err := exec.ExecContext(ctx, `
		UPDATE setups
		SET name = ?, description = ?, step_count = ?,
		    version = version + 1, updated_at = datetime('now')
		WHERE id = ? AND version = ? AND deleted_at IS NULL`,
		name, description, stepCount, setupID, version)
	if err != nil {
		return 0, fmt.Errorf("update setup: %w", err)
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return 0, fmt.Errorf("rows affected: %w", err)
	}
	if rows == 0 {
		var existsActive int
		row := r.runner(tx).QueryRowContext(ctx,
			"SELECT COUNT(*) FROM setups WHERE id = ? AND deleted_at IS NULL", setupID)
		if err := row.Scan(&existsActive); err != nil {
			return 0, fmt.Errorf("scan exists: %w", err)
		}
		if existsActive == 0 {
			return 0, ErrNotFound
		}
		return 0, ErrConflict
	}
	return version + 1, nil
}

// ---------------------------------------------------------------------------
// DeleteStepsBySetupID
// ---------------------------------------------------------------------------

func (r *repository) DeleteStepsBySetupID(ctx context.Context, tx *sql.Tx, setupID int64) error {
	exec := r.runner(tx)
	_, err := exec.ExecContext(ctx, `DELETE FROM setup_steps WHERE setup_id = ?`, setupID)
	if err != nil {
		return fmt.Errorf("delete steps: %w", err)
	}
	return nil
}

// ---------------------------------------------------------------------------
// recipe_cache 操作
// ---------------------------------------------------------------------------

// GetRecipeCache は setups.recipe_cache を返す。論理削除済みセットプレイは対象外(ErrNotFound)。
//
// ★M23-03 §4.2: combos 側(repository/combo.GetRecipeCache)とまったく同型であり、
// 2 つで 1 組として塞いである。片方だけ塞ぐと、同じ役割の同名関数が非対称になる。
func (r *repository) GetRecipeCache(ctx context.Context, setupID int64) (*string, error) {
	var cache sql.NullString
	err := r.db.QueryRowContext(ctx,
		`SELECT recipe_cache FROM setups WHERE id = ? AND deleted_at IS NULL`, setupID).Scan(&cache)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("get recipe cache: %w", err)
	}
	if !cache.Valid {
		return nil, nil
	}
	return &cache.String, nil
}

func (r *repository) UpdateRecipeCache(ctx context.Context, setupID int64, cacheJSON string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE setups SET recipe_cache = ?, updated_at = datetime('now') WHERE id = ?`,
		cacheJSON, setupID)
	if err != nil {
		return fmt.Errorf("update recipe cache: %w", err)
	}
	return nil
}

func (r *repository) UpdateRecipeCacheTx(ctx context.Context, tx *sql.Tx, setupID int64, cacheJSON string) error {
	_, err := tx.ExecContext(ctx,
		`UPDATE setups SET recipe_cache = ? WHERE id = ?`,
		cacheJSON, setupID)
	if err != nil {
		return fmt.Errorf("update recipe cache tx: %w", err)
	}
	return nil
}

func (r *repository) SetRecipeCacheNullTx(ctx context.Context, tx *sql.Tx, setupID int64) error {
	_, err := tx.ExecContext(ctx,
		`UPDATE setups SET recipe_cache = NULL WHERE id = ?`, setupID)
	if err != nil {
		return fmt.Errorf("set recipe cache null: %w", err)
	}
	return nil
}

// ---------------------------------------------------------------------------
// ListAllActiveSetups
// ---------------------------------------------------------------------------

const listAllActiveSetupsSQL = `
SELECT id, character_id, name, description, step_count, recipe_cache,
       version, created_at, updated_at, deleted_at
FROM setups
WHERE deleted_at IS NULL`

func (r *repository) ListAllActiveSetupsTx(ctx context.Context, tx *sql.Tx) ([]*model.Setup, error) {
	rows, err := r.runner(tx).QueryContext(ctx, listAllActiveSetupsSQL)
	if err != nil {
		return nil, fmt.Errorf("list all active setups: %w", err)
	}
	defer rows.Close()

	setups := make([]*model.Setup, 0)
	for rows.Next() {
		s, err := r.scanSetup(rows)
		if err != nil {
			return nil, err
		}
		setups = append(setups, s)
	}
	return setups, rows.Err()
}

// ---------------------------------------------------------------------------
// ListByCharacterID
// ---------------------------------------------------------------------------

func (r *repository) ListByCharacterID(ctx context.Context, characterID *int64) ([]*model.Setup, error) {
	const baseSQL = `
SELECT id, character_id, name, description, step_count, recipe_cache,
       version, created_at, updated_at, deleted_at
FROM setups
WHERE deleted_at IS NULL`

	var (
		rows *sql.Rows
		err  error
	)
	if characterID != nil {
		rows, err = r.db.QueryContext(ctx, baseSQL+` AND character_id = ? ORDER BY id DESC`, *characterID)
	} else {
		rows, err = r.db.QueryContext(ctx, baseSQL+` ORDER BY id DESC`)
	}
	if err != nil {
		return nil, fmt.Errorf("list setups by character: %w", err)
	}
	defer rows.Close()

	setups := make([]*model.Setup, 0)
	for rows.Next() {
		s, err := r.scanSetup(rows)
		if err != nil {
			return nil, err
		}
		setups = append(setups, s)
	}
	return setups, rows.Err()
}

// ---------------------------------------------------------------------------
// FindLiveComboIDsBySetupIDs
// ---------------------------------------------------------------------------

// FindLiveComboIDsBySetupIDs は setupIDs に対する combo_id 一覧のうち、論理削除されて
// いないコンボだけを返す(表示用のバッチ取得)。
//
// ★M23-03 §4.5: 単数版と同じ扱いにしてある。呼び元は応答の parentComboIds 組み立てのみで、
// 検証には使われていない。AllowDeleted の複数版は呼び元が無いため作っていない。
func (r *repository) FindLiveComboIDsBySetupIDs(ctx context.Context, setupIDs []int64) (map[int64][]int64, error) {
	if len(setupIDs) == 0 {
		return map[int64][]int64{}, nil
	}

	placeholders := strings.Repeat("?,", len(setupIDs))
	placeholders = placeholders[:len(placeholders)-1]
	query := fmt.Sprintf(`
SELECT cs.setup_id, cs.combo_id
FROM combo_setups cs
JOIN combos c ON c.id = cs.combo_id AND c.deleted_at IS NULL
WHERE cs.setup_id IN (%s)
ORDER BY cs.setup_id, cs.combo_id`,
		placeholders,
	)
	args := make([]any, len(setupIDs))
	for i, id := range setupIDs {
		args[i] = id
	}

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("find live combo_ids by setup_ids: %w", err)
	}
	defer rows.Close()

	result := make(map[int64][]int64, len(setupIDs))
	for rows.Next() {
		var setupID, comboID int64
		if err := rows.Scan(&setupID, &comboID); err != nil {
			return nil, fmt.Errorf("scan setup_id/combo_id: %w", err)
		}
		result[setupID] = append(result[setupID], comboID)
	}
	return result, rows.Err()
}

// ---------------------------------------------------------------------------
// ListSetupsByComboID
// ---------------------------------------------------------------------------

func (r *repository) ListSetupsByComboID(ctx context.Context, comboID int64) ([]*model.Setup, error) {
	const q = `
SELECT s.id, s.character_id, s.name, s.description, s.step_count, s.recipe_cache,
       s.version, s.created_at, s.updated_at, s.deleted_at
FROM setups s
JOIN combo_setups cs ON cs.setup_id = s.id
WHERE cs.combo_id = ? AND s.deleted_at IS NULL
ORDER BY s.id`

	rows, err := r.db.QueryContext(ctx, q, comboID)
	if err != nil {
		return nil, fmt.Errorf("list setups by combo: %w", err)
	}
	defer rows.Close()

	setups := make([]*model.Setup, 0)
	for rows.Next() {
		s, err := r.scanSetup(rows)
		if err != nil {
			return nil, err
		}
		setups = append(setups, s)
	}
	return setups, rows.Err()
}

// ---------------------------------------------------------------------------
// ListSetupsByComboIDs (バッチ取得、N+1 回避)
// ---------------------------------------------------------------------------

func (r *repository) ListSetupsByComboIDs(ctx context.Context, comboIDs []int64) (map[int64][]*model.Setup, error) {
	result := make(map[int64][]*model.Setup)
	if len(comboIDs) == 0 {
		return result, nil
	}

	placeholders := make([]string, len(comboIDs))
	args := make([]any, len(comboIDs))
	for i, id := range comboIDs {
		placeholders[i] = "?"
		args[i] = id
	}

	q := `
SELECT cs.combo_id, s.id, s.character_id, s.name, s.description, s.step_count, s.recipe_cache,
       s.version, s.created_at, s.updated_at, s.deleted_at
FROM setups s
JOIN combo_setups cs ON cs.setup_id = s.id
WHERE cs.combo_id IN (` + strings.Join(placeholders, ",") + `) AND s.deleted_at IS NULL
ORDER BY cs.combo_id, s.id`

	rows, err := r.db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, fmt.Errorf("list setups by combo ids: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var comboID int64
		s := &model.Setup{}
		if err := rows.Scan(
			&comboID,
			&s.ID, &s.CharacterID, &s.Name, &s.Description, &s.StepCount, &s.RecipeCache,
			&s.Version, &s.CreatedAt, &s.UpdatedAt, &s.DeletedAt,
		); err != nil {
			return nil, fmt.Errorf("scan setup by combo ids: %w", err)
		}
		result[comboID] = append(result[comboID], s)
	}
	return result, rows.Err()
}

// ---------------------------------------------------------------------------
// FindDuplicateInCombo (VAL-S04)
// ---------------------------------------------------------------------------

func (r *repository) FindDuplicateInCombo(ctx context.Context, comboID int64, characterID int64, recipeHash string, excludeSetupID *int64) (*int64, error) {
	return r.FindDuplicateInComboTx(ctx, nil, comboID, characterID, recipeHash, excludeSetupID)
}

// FindDuplicateInComboTx は VAL-S04 の判定を、渡された tx の内側で行う(M24-13 §4.6)。
//
// ★★tx が nil なら *sql.DB 直読みへ落ちる。判定を書き込みトランザクションの内側で
// 行う経路は tx を渡すこと——渡さないと、その tx が今まさに書いた行が見えず、
// check-then-act の窓が閉じない(SUPP-001 §7.1.1 の一般規約＝D-360)。
//
// ★★候補の steps も同じ runner で引く。ここで *sql.DB 直読みへ落ちると、
// 「候補は見えたがレシピが比較できない」形になり、判定を内側へ移した意味が消える
// (ComboDuplicateAdapter.stepsForCandidates が M24-11 で採ったのと同じ判断)。
//
// ★形は duplicateRefsInCombo(VAL-S07 / VAL-R04)と同じ 2 段である——SQL で候補を
// 絞り、候補ごとに steps を読んでハッシュを比較する。recipe_hash は列ではなく
// 計算値であるため、SQL 近似で済ませない。
func (r *repository) FindDuplicateInComboTx(ctx context.Context, tx *sql.Tx, comboID int64, characterID int64, recipeHash string, excludeSetupID *int64) (*int64, error) {
	query := `
		SELECT s.id
		FROM setups s
		JOIN combo_setups cs ON cs.setup_id = s.id
		WHERE cs.combo_id = ?
		  AND s.character_id = ?
		  AND s.deleted_at IS NULL`
	args := []any{comboID, characterID}

	if excludeSetupID != nil {
		query += ` AND s.id != ?`
		args = append(args, *excludeSetupID)
	}

	runner := r.runner(tx)
	rows, err := runner.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("find duplicate in combo: %w", err)
	}

	candidates := make([]int64, 0)
	for rows.Next() {
		var candidateID int64
		if scanErr := rows.Scan(&candidateID); scanErr != nil {
			rows.Close()
			return nil, fmt.Errorf("scan candidate: %w", scanErr)
		}
		candidates = append(candidates, candidateID)
	}
	if rowsErr := rows.Err(); rowsErr != nil {
		rows.Close()
		return nil, fmt.Errorf("iterate candidates: %w", rowsErr)
	}
	// ★steps を引く前に閉じる。同一接続で読みかけの Rows を残したまま次の
	//   QueryContext を投げると、tx 経路で接続待ちになりうる
	//   (duplicateRefsInCombo が同じ理由で同じ形を採っている)。
	rows.Close()

	for _, candidateID := range candidates {
		steps, stepsErr := r.findStepsBySetupIDRunner(ctx, runner, candidateID)
		if stepsErr != nil {
			return nil, fmt.Errorf("find steps for candidate %d: %w", candidateID, stepsErr)
		}
		if calcSetupRecipeHashFromSteps(steps) == recipeHash {
			id := candidateID
			return &id, nil
		}
	}
	return nil, nil
}

// ---------------------------------------------------------------------------
// M23-05: 重複判定の外側を見る問い合わせ(VAL-S07 / VAL-R04)
// ---------------------------------------------------------------------------

// duplicateRefsInCombo は「同一親コンボ配下でレシピハッシュが一致する setup」を
// SetupRef で返す(M23-05 §4.4)。VAL-S07 と VAL-R04 の共通部である。
//
// ★形は FindDuplicateInCombo(VAL-S04)を踏襲する——SQL で候補を絞り、候補ごとに
//
//	steps を読んで calcSetupRecipeHashFromSteps で比較する 2 段。
//	★group_concat 等の SQL 近似で済ませないこと(M23-05 §4.4)。recipe_hash は列ではなく
//	計算値であり、近似は CalcSetupRecipeHash と一致する保証が無い。
//
// ★deletedOnly は母集団の向きを決める。true=ゴミ箱の行だけ(VAL-S07)、
//
//	false=生きた行だけ(VAL-R04)。
//
// ★combos 側には述語を置かない。VAL-S04 と同じく、親コンボがゴミ箱に居ても候補は残す
//
//	(M23-03 §4.5＝母集団は「復元されうるものも含む」)。
func (r *repository) duplicateRefsInCombo(
	ctx context.Context,
	tx *sql.Tx,
	comboID int64,
	characterID int64,
	recipeHash string,
	deletedOnly bool,
	excludeSetupID *int64,
) ([]model.SetupRef, error) {
	deletedPredicate := "s.deleted_at IS NULL"
	if deletedOnly {
		deletedPredicate = "s.deleted_at IS NOT NULL"
	}
	query := `
		SELECT s.id, s.name
		FROM setups s
		JOIN combo_setups cs ON cs.setup_id = s.id
		WHERE cs.combo_id = ?
		  AND s.character_id = ?
		  AND ` + deletedPredicate
	args := []any{comboID, characterID}

	if excludeSetupID != nil {
		query += ` AND s.id <> ?`
		args = append(args, *excludeSetupID)
	}
	query += ` ORDER BY s.id`

	runner := r.runner(tx)
	rows, err := runner.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("find duplicate refs in combo: %w", err)
	}

	type candidate struct {
		id   int64
		name *string
	}
	candidates := make([]candidate, 0)
	for rows.Next() {
		var c candidate
		if scanErr := rows.Scan(&c.id, &c.name); scanErr != nil {
			rows.Close()
			return nil, fmt.Errorf("scan duplicate ref candidate: %w", scanErr)
		}
		candidates = append(candidates, c)
	}
	if rowsErr := rows.Err(); rowsErr != nil {
		rows.Close()
		return nil, fmt.Errorf("iterate duplicate ref candidates: %w", rowsErr)
	}
	// ★steps の取得より先に閉じる。同一接続で読みかけの Rows を残したまま次の
	//   QueryContext を投げると、tx 経路で接続待ちになりうる。
	rows.Close()

	refs := make([]model.SetupRef, 0)
	for _, c := range candidates {
		steps, stepsErr := r.findStepsBySetupIDRunner(ctx, runner, c.id)
		if stepsErr != nil {
			return nil, fmt.Errorf("find steps for candidate %d: %w", c.id, stepsErr)
		}
		if calcSetupRecipeHashFromSteps(steps) == recipeHash {
			refs = append(refs, model.SetupRef{ID: c.id, Name: c.name})
		}
	}
	return refs, nil
}

func (r *repository) FindDeletedDuplicateRefsInCombo(ctx context.Context, comboID int64, characterID int64, recipeHash string) ([]model.SetupRef, error) {
	return r.duplicateRefsInCombo(ctx, nil, comboID, characterID, recipeHash, true, nil)
}

func (r *repository) FindLiveDuplicateRefsInComboTx(ctx context.Context, tx *sql.Tx, comboID int64, characterID int64, recipeHash string, excludeSetupID int64) ([]model.SetupRef, error) {
	return r.duplicateRefsInCombo(ctx, tx, comboID, characterID, recipeHash, false, &excludeSetupID)
}

func (r *repository) FindLiveDuplicateRefsInCombo(ctx context.Context, comboID int64, characterID int64, recipeHash string) ([]model.SetupRef, error) {
	return r.duplicateRefsInCombo(ctx, nil, comboID, characterID, recipeHash, false, nil)
}

// ---------------------------------------------------------------------------
// ComboExists / SetupExistsActive
// ---------------------------------------------------------------------------

func (r *repository) ComboExists(ctx context.Context, comboID int64) (bool, error) {
	var n int
	err := r.db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM combos WHERE id = ? AND deleted_at IS NULL`, comboID).Scan(&n)
	if err != nil {
		return false, fmt.Errorf("combo exists: %w", err)
	}
	return n > 0, nil
}

func (r *repository) SetupExistsActive(ctx context.Context, setupID int64) (bool, error) {
	var n int
	err := r.db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM setups WHERE id = ? AND deleted_at IS NULL`, setupID).Scan(&n)
	if err != nil {
		return false, fmt.Errorf("setup exists active: %w", err)
	}
	return n > 0, nil
}

// ---------------------------------------------------------------------------
// FindCandidateSetups (FR011)
// ---------------------------------------------------------------------------

// FindCandidateSetups は同一キャラ + 同一 knockdown_advantage の他コンボに紐付く setup を返す。
func (r *repository) FindCandidateSetups(ctx context.Context, characterID int64, knockdownAdvantage *int, excludeComboID int64) ([]*model.Setup, error) {
	if knockdownAdvantage == nil {
		return []*model.Setup{}, nil
	}

	const q = `
SELECT DISTINCT s.id, s.character_id, s.name, s.description, s.step_count, s.recipe_cache,
       s.version, s.created_at, s.updated_at, s.deleted_at
FROM setups s
INNER JOIN combo_setups cs ON cs.setup_id = s.id
INNER JOIN combos c ON c.id = cs.combo_id
WHERE s.character_id = ?
  AND c.knockdown_advantage = ?
  AND c.id != ?
  AND s.deleted_at IS NULL
  AND c.deleted_at IS NULL
  AND s.id NOT IN (
    SELECT cs2.setup_id FROM combo_setups cs2 WHERE cs2.combo_id = ?
  )
ORDER BY s.id`

	rows, err := r.db.QueryContext(ctx, q, characterID, *knockdownAdvantage, excludeComboID, excludeComboID)
	if err != nil {
		return nil, fmt.Errorf("find candidate setups: %w", err)
	}
	defer rows.Close()

	setups := make([]*model.Setup, 0)
	for rows.Next() {
		s, err := r.scanSetup(rows)
		if err != nil {
			return nil, err
		}
		setups = append(setups, s)
	}
	return setups, rows.Err()
}

// ---------------------------------------------------------------------------
// スキャンヘルパ
// ---------------------------------------------------------------------------

type scannerRow interface {
	Scan(dest ...any) error
}

func (r *repository) scanSetup(row scannerRow) (*model.Setup, error) {
	s := &model.Setup{}
	err := row.Scan(
		&s.ID, &s.CharacterID, &s.Name, &s.Description,
		&s.StepCount, &s.RecipeCache,
		&s.Version, &s.CreatedAt, &s.UpdatedAt, &s.DeletedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("scan setup: %w", err)
	}
	return s, nil
}

func scanStep(row scannerRow) (model.SetupStep, error) {
	var s model.SetupStep
	var modifiersJSON sql.NullString
	if err := row.Scan(&s.ID, &s.SetupID, &s.StepOrder, &s.MoveID, &modifiersJSON, &s.MoveCode); err != nil {
		return s, fmt.Errorf("scan step: %w", err)
	}
	if modifiersJSON.Valid {
		mods, err := unmarshalModifiers(modifiersJSON.String)
		if err != nil {
			return s, fmt.Errorf("unmarshal modifiers: %w", err)
		}
		s.Modifiers = mods
	}
	return s, nil
}

func marshalModifiers(m *model.Modifiers) (any, error) {
	if m == nil {
		return nil, nil
	}
	bytes, err := json.Marshal(m)
	if err != nil {
		return nil, err
	}
	return string(bytes), nil
}

func unmarshalModifiers(jsonStr string) (*model.Modifiers, error) {
	if jsonStr == "" || jsonStr == "null" {
		return nil, nil
	}
	var m model.Modifiers
	if err := json.Unmarshal([]byte(jsonStr), &m); err != nil {
		return nil, err
	}
	return &m, nil
}

// calcSetupRecipeHashFromSteps は FindDuplicateInCombo 内で候補のハッシュを計算する。
//
// 計算そのものは internal/recipehash が持つ唯一の実装に委ねる。
//
// ★サービス層の setup.CalcSetupRecipeHash ではなく recipehash を直接呼ぶのは、
// リポジトリ層がサービス層を import すると依存の向きが逆転するためである。
// recipehash は両者より下に置いてあるので、どちらから呼んでも同じ値になる。
func calcSetupRecipeHashFromSteps(steps []model.SetupStep) string {
	return recipehash.CalcSetup(steps)
}

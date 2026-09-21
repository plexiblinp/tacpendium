package setup

// セットプレイのゴミ箱まわり(復元・完全削除・削除済み一覧)のサービス実装。
// M23-02 で新設。SUPP-001 §5.2 が予告していた配置である。

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"

	"github.com/plexiblinp/tacpendium/internal/model"
	setuprepo "github.com/plexiblinp/tacpendium/internal/repository/setup"
	"github.com/plexiblinp/tacpendium/internal/service/validation"
)

// ErrSetupNotInTrash はゴミ箱に無いセットプレイへ完全削除が要求された場合のセンチネル。
// ★ゴミ箱を経由しない削除の経路を作らないための多層防御(M23-02 §4.3-3)。
// コンボ側の ErrComboNotInTrash と同型。
var ErrSetupNotInTrash = errors.New("setup: not in trash")

// SetupInUseError は、生きたコンボから参照されているセットプレイの完全削除を
// 拒否したことを表す(M23-02 §4.4・D-484)。
//
// Combos に参照元を載せるのは、画面で列挙するためではない(D-485＝専用の表示は
// 作らない)。★M23-07 §4.3 が画面での列挙と紐付け解除の導線を作り、D-485 を
// 上書きした。この Combos がその導線の唯一の入力である。
//
// tagsvc.TagInUseError と同型。errors.As で取り出してハンドラが details へ写す。
type SetupInUseError struct {
	Combos []model.ComboRef
}

func (e *SetupInUseError) Error() string {
	return fmt.Sprintf("setup: in use by %d live combo(s)", len(e.Combos))
}

// ---------------------------------------------------------------------------
// Restore(POST /api/setups/{id}/restore)
// ---------------------------------------------------------------------------

// Restore は論理削除されたセットプレイを復元する(M23-02 §4.2)。
//
// 形はコンボ側の Restore に揃えてある——deleted_at を NULL に戻し、同一
// トランザクションで recipe_cache を作り直す。
//
// ★setup_steps に対しては何もしない。setup_steps は論理削除の対象ではなく
// (FK は ON DELETE CASCADE であり論理削除では発火しない)物理的に残っているため、
// 親の deleted_at を戻せば繋がったまま復帰する。★これは見落としではなく、
// 確認したうえで何もしていない(M23-02 §4.2-5)。
//
// ★紐付け(combo_setups)についても復旧処理を持たない。案 P1 の撤回により
// 論理削除中も保たれているためである(M23-02 §4.1)。ただしこれは M23-02 以降に
// 論理削除されたものに限る。本サブの適用前に論理削除されたセットプレイは
// 紐付けが既に失われており、遡って復旧することはできない(M23-02 §4.2-6)。
//
// ★M23-04: 復元の直後・同一トランザクション内で検証を走らせ、結果を戻り値へ載せる。
// ★検証の結果で復元を取り消さない(M23-04 §4.1)。VAL-S03 は WARNING であり、VAL-R02 も
// WARNING である。仮に ERROR 種別が混ざっても中止しない——落とすと利用者は取り返す
// 手段を失い、ゴミ箱が安全網でなくなる(D-463)。DES-006 §1.1「例外はブロッキング」に
// 対する明示的な例外である。
func (s *service) Restore(ctx context.Context, setupID int64) (validation.ValidationResult, error) {
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

	if err = s.repo.Restore(ctx, tx, setupID); err != nil {
		if errors.Is(err, setuprepo.ErrNotFound) {
			return result, ErrNotFound
		}
		return result, fmt.Errorf("restore: %w", err)
	}

	// 論理削除時に物理削除した recipe_cache を作り直す(SUPP-001 §7.5.6)。
	// コンボ側の Restore が RecomputeComboCache を同じ位置で呼ぶのと同型。
	if err = s.notationSvc.RecomputeSetupCache(ctx, tx, setupID); err != nil {
		return result, fmt.Errorf("recompute setup cache: %w", err)
	}

	// ★検証は Commit の直前・Tx の内側(M23-04 §4.2)。
	// ★戻り値の err へ代入しない——検証の失敗で defer がロールバックしてしまう。
	result = s.validateRestoredSetup(ctx, tx, setupID)

	if err = tx.Commit(); err != nil {
		return validation.ValidationResult{}, fmt.Errorf("commit: %w", err)
	}
	return result, nil
}

// validateRestoredSetup は復元直後のセットプレイに VAL-S03 / VAL-R02(M23-04 §4.7)と
// VAL-R04(M23-05 §4.1)を適用する。
//
// ★検証処理自体が失敗した場合は、その検証だけを捨てて空の結果を返す。500 にせず、
// 復元も巻き添えにしない(M23-04 §4.2 末尾)——検証は付加価値であり、それが壊れたことで
// 復元という利用者の主目的を落とさない。★ただしログには残す。
func (s *service) validateRestoredSetup(ctx context.Context, tx *sql.Tx, setupID int64) validation.ValidationResult {
	var result validation.ValidationResult

	setup, err := s.repo.FindByIDAllowDeleted(ctx, tx, setupID)
	if err != nil {
		slog.ErrorContext(ctx, "restore validation: find setup",
			slog.Int64("setupId", setupID), slog.String("err", err.Error()))
		return validation.ValidationResult{}
	}

	// VAL-S03: レシピ中の move_id が該当キャラに存在する技か(既存の判定を再利用)。
	steps, err := s.repo.FindStepsBySetupIDTx(ctx, tx, setupID)
	if err != nil {
		slog.ErrorContext(ctx, "restore validation: find setup steps",
			slog.Int64("setupId", setupID), slog.String("err", err.Error()))
		return validation.ValidationResult{}
	}
	ValidateSetupMoveExistence(ctx, &result, setup.CharacterID, steps, s.validDeps)

	// VAL-R02: 紐付いている親コンボがすべて論理削除されているか。
	// ★母集団は AllowDeleted 側から取る。Live 側だけを見ると、親が全部削除済みのとき
	// 母集団まで 0 件になり、警告が永久に出なくなる(M23-04 §3.3-6)。
	allParents, err := s.repo.FindReferencingCombosAllowDeletedTx(ctx, tx, setupID)
	if err != nil {
		slog.ErrorContext(ctx, "restore validation: find parent combos (allow deleted)",
			slog.Int64("setupId", setupID), slog.String("err", err.Error()))
		return result
	}
	liveParents, err := s.repo.FindLiveComboIDsBySetupIDTx(ctx, tx, setupID)
	if err != nil {
		slog.ErrorContext(ctx, "restore validation: find live parent combos",
			slog.Int64("setupId", setupID), slog.String("err", err.Error()))
		return result
	}
	validation.ValidateR02AllParentCombosDeleted(&result, allParents, liveParents)

	// VAL-R04: 復元したことで、同じ親コンボの下に同一レシピの生きたセットプレイと
	// 並んでいないか(M23-05 §4.1)。★VAL-S04 は削除済みの setup を候補に入れないため
	// (FindDuplicateInCombo の AND s.deleted_at IS NULL)、「削除 → 同じレシピを作る →
	// 復元」の順で重複が成立する。
	//
	// ★親コンボの母集団は AllowDeleted 側(上で取得済みの allParents)を使う。VAL-S04 が
	//   UpdateSetup で同じ選択をしている(M23-03 §4.5)——親がゴミ箱に居ても、復元されうる
	//   以上は重複として並びうる。
	s.validateR04(ctx, tx, &result, setupID, setup.CharacterID, steps, allParents)

	return result
}

// validateR04 は復元直後のセットプレイに VAL-R04 を適用する(M23-05 §4.1)。
//
// ★検証だけが失敗した場合は、その検証を捨てて復元を成功させる。ログには残す
// (M23-04 §4.2 末尾と同じ扱い)。
func (s *service) validateR04(
	ctx context.Context,
	tx *sql.Tx,
	result *validation.ValidationResult,
	setupID int64,
	characterID int64,
	steps []model.SetupStep,
	allParents []model.ComboRef,
) {
	if len(allParents) == 0 {
		return
	}
	recipeHash := CalcSetupRecipeHash(steps)

	// ★同じセットプレイが複数の親に紐付いていると、親ごとに一致が出うる。id で畳んで
	//   同じ行を二重に載せない(1 件の警告にまとめる)。
	seen := make(map[int64]struct{})
	alive := make([]model.SetupRef, 0)
	for _, parent := range allParents {
		// ★★復元対象自身を除外する。復元は deleted_at を NULL に戻してから検証するため
		//   (M23-04 §4.2)、除外しないと自分が自分の重複相手になる(M23-05 §4.3)。
		refs, err := s.repo.FindLiveDuplicateRefsInComboTx(ctx, tx, parent.ID, characterID, recipeHash, setupID)
		if err != nil {
			slog.ErrorContext(ctx, "restore validation: find alive duplicate setups",
				slog.Int64("setupId", setupID), slog.Int64("comboId", parent.ID),
				slog.String("err", err.Error()))
			return
		}
		for _, ref := range refs {
			if _, dup := seen[ref.ID]; dup {
				continue
			}
			seen[ref.ID] = struct{}{}
			alive = append(alive, ref)
		}
	}
	ValidateR04DuplicateAliveSetup(result, alive)
}

// FindDeletedSetupRefsByComboIDInTx はコンボの復元サービスが VAL-R01 の判定に使う
// (M23-04 §4.7)。トランザクション管理は呼び出し側の責務である。
func (s *service) FindDeletedSetupRefsByComboIDInTx(ctx context.Context, tx *sql.Tx, comboID int64) ([]model.SetupRef, error) {
	refs, err := s.repo.FindDeletedSetupRefsByComboID(ctx, tx, comboID)
	if err != nil {
		return nil, fmt.Errorf("find deleted setup refs: %w", err)
	}
	return refs, nil
}

// ---------------------------------------------------------------------------
// PermanentDelete(DELETE /api/setups/{id}/permanent)
// ---------------------------------------------------------------------------

// PermanentDelete はゴミ箱のセットプレイを物理削除する(M23-02 §4.3 / §4.4)。
//
// ★前チェックをトランザクション内で行う。コンボ側の PermanentDelete は前チェックが
// Tx 外にあり、判定してから BeginTx するまでの間に他の利用者が復元・紐付けしうる
// TOCTOU の窓を持つ(M23-RESEARCH-01 §D-6 が実測して記録している)。本サブは新しい
// 経路なのでその窓を作らない。★コンボ側に揃えない唯一の点である。
//
// 拒否の判定に使う述語は combos.deleted_at IS NULL だけである(D-486)。
// ゴミ箱に居るコンボからの参照は拒否の理由にしない。
func (s *service) PermanentDelete(ctx context.Context, setupID int64) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	setup, err := s.repo.FindByIDAllowDeleted(ctx, tx, setupID)
	if err != nil {
		if errors.Is(err, setuprepo.ErrNotFound) {
			return ErrNotFound
		}
		return fmt.Errorf("find setup: %w", err)
	}
	if setup.DeletedAt == nil {
		err = ErrSetupNotInTrash
		return err
	}

	refs, err := s.repo.FindLiveReferencingCombos(ctx, tx, setupID)
	if err != nil {
		return fmt.Errorf("find live referencing combos: %w", err)
	}
	if len(refs) > 0 {
		err = &SetupInUseError{Combos: refs}
		return err
	}

	if err = s.repo.HardDelete(ctx, tx, setupID); err != nil {
		return fmt.Errorf("hard delete: %w", err)
	}

	if err = tx.Commit(); err != nil {
		return fmt.Errorf("commit: %w", err)
	}
	return nil
}

// ---------------------------------------------------------------------------
// ListDeletedSetups(GET /api/setups?onlyDeleted=true)
// ---------------------------------------------------------------------------

// ListDeletedSetups は論理削除済みのセットプレイ一覧を返す(M23-02 §4.2-8)。
// ゴミ箱画面で復元・完全削除の対象を選べるようにするための最小の経路である。
func (s *service) ListDeletedSetups(ctx context.Context, characterID *int64) ([]*SetupResponse, error) {
	setups, err := s.repo.ListDeletedByCharacterID(ctx, characterID)
	if err != nil {
		return nil, fmt.Errorf("list deleted setups: %w", err)
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

	// ★★削除済み行の recipe_cache は論理削除の時点で NULL になっている(DES-002 §4.2)。
	//   ⇒ extractDefaultRecipe は必ず空文字を返し、名前の無いセットプレイは「(名称未設定)」
	//   でしか並ばず、識別手段がゼロになる。完全削除は不可逆であり、取り違えると
	//   取り返しがつかない(M23-06 §4.3-1)。
	// ⇒ setup_steps から組み立て直して defaultRecipe を埋める(M23-06 §4.3-3)。
	// ★論理削除の副作用は変えない。読み取り側で解いている(同 §4.3-4)。
	// ★1 クエリで一括解決する。件数ぶん問い合わせない(同 §4.3-3 の N+1)。
	recipes := map[int64]string{}
	if s.defaultPresetID != nil {
		recipes, err = s.notationSvc.ResolveDeletedSetupRecipes(ctx, ids, s.defaultPresetID())
		if err != nil {
			return nil, fmt.Errorf("resolve deleted setup recipes: %w", err)
		}
	}

	results := make([]*SetupResponse, len(setups))
	for i, setup := range setups {
		comboIDs := comboIDsMap[setup.ID]
		if comboIDs == nil {
			comboIDs = []int64{}
		}
		results[i] = &SetupResponse{
			Setup:          setup,
			DefaultRecipe:  recipes[setup.ID],
			ParentComboIDs: comboIDs,
		}
	}
	return results, nil
}

// ---------------------------------------------------------------------------
// CheckTrashDuplicateSetup(VAL-S07・M23-05 §4.1)
// ---------------------------------------------------------------------------

// CheckTrashDuplicateSetup は M23-05 §4.1 の VAL-S07 を判定する。呼び出し規約は
// Service インタフェース側の godoc を参照(★POST /api/combos/:comboId/setups 専用)。
func (s *service) CheckTrashDuplicateSetup(ctx context.Context, parentComboID, setupID int64) validation.ValidationResult {
	var result validation.ValidationResult

	setup, err := s.repo.FindByID(ctx, setupID)
	if err != nil {
		slog.ErrorContext(ctx, "trash duplicate check: find setup",
			slog.Int64("setupId", setupID), slog.String("err", err.Error()))
		return validation.ValidationResult{}
	}
	steps, err := s.repo.FindStepsBySetupID(ctx, setupID)
	if err != nil {
		slog.ErrorContext(ctx, "trash duplicate check: find setup steps",
			slog.Int64("setupId", setupID), slog.String("err", err.Error()))
		return validation.ValidationResult{}
	}

	// ★母集団は「同じ親コンボ配下の、論理削除済みで、レシピが一致するもの」。
	//   親が違えば同一レシピは正当である——VAL-S04 と同じ意味論を保つ(M23-05 §4.1-2)。
	deleted, err := s.repo.FindDeletedDuplicateRefsInCombo(ctx, parentComboID, setup.CharacterID, CalcSetupRecipeHash(steps))
	if err != nil {
		slog.ErrorContext(ctx, "trash duplicate check: find deleted duplicates",
			slog.Int64("setupId", setupID), slog.String("err", err.Error()))
		return validation.ValidationResult{}
	}
	ValidateS07DuplicateInTrash(&result, deleted)
	return result
}

package setup

// セットプレイ成立条件の検証結果(combo_setup_results)のビジネスロジック
// (M19-03 / CHANGE-087)。
//
// 「未検証／成立／不成立」の三値は「行の有無 ＋ result」で表す(§4.1.3)。
// 未検証へ戻す操作は DeleteResult(物理削除)であり、result に NULL や「未検証」を
// 意味する値を入れる経路は存在しない。

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/plexiblinp/tacpendium/internal/model"
)

// ErrInvalidResultValue は tech_type / result が値域外だった場合のセンチネル。
// 値域の正典は combo_setup_results の定義であり、DES-006 に VAL は足さない
// (CHANGE-087 §4-1 の裁定)。
var ErrInvalidResultValue = errors.New("setup: invalid setup result value")

// ErrSetupLinkNotFound は (comboID, setupID) の紐付けが存在しない場合のセンチネル。
// 複合 FK が構造的に防ぐが、サービス層でも明示的に弾く(多層防御・§4.3.2)。
var ErrSetupLinkNotFound = errors.New("setup: combo-setup link not found")

// SetupResultCondition は「どのセル(受け身種別 × 画面端)か」を指す座標。
// 提案の採用時に「確認できた条件」として渡される(§4.5)。
type SetupResultCondition struct {
	TechType string
	InCorner bool
}

// UpsertResultInput は 1 セル分の検証結果の更新入力。
type UpsertResultInput struct {
	TechType string
	InCorner bool
	Result   string
	Note     *string
}

// validateCondition はセル座標(受け身種別)の値域を検証する。
func validateCondition(techType string) error {
	if !model.IsValidOkiTechType(techType) {
		return fmt.Errorf("%w: techType=%q", ErrInvalidResultValue, techType)
	}
	return nil
}

// ListResultsByComboID は 1 コンボ分の検証結果を返す(コンボ詳細への同梱用)。
// 行が無いセルは戻り値にも現れない = 未検証。
func (s *service) ListResultsByComboID(ctx context.Context, comboID int64) ([]model.ComboSetupResult, error) {
	results, err := s.repo.ListSetupResultsByComboID(ctx, comboID)
	if err != nil {
		return nil, fmt.Errorf("list setup results: %w", err)
	}
	return results, nil
}

// UpsertResult は 1 セル分の検証結果を作成または更新する(§4.3.2)。
// 値域外は ErrInvalidResultValue、紐付けが無い組は ErrSetupLinkNotFound。
//
// note は全置換の契約である。Note を nil で渡すと既存のメモは消える(部分更新はしない)。
// 呼び出し側(FE)は状態遷移時に既存 note を読み直して同送する。
func (s *service) UpsertResult(ctx context.Context, comboID, setupID int64, input UpsertResultInput) error {
	if err := validateCondition(input.TechType); err != nil {
		return err
	}
	if !model.IsValidSetupResultValue(input.Result) {
		return fmt.Errorf("%w: result=%q", ErrInvalidResultValue, input.Result)
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

	// 紐付け確認は Tx 内で行う。複合 FK が構造的に防ぐ想定だが、確認と書き込みの間で
	// 紐付けが解除される TOCTOU を塞ぐため多層防御にする。
	// (M19-02 当時は FK=OFF の接続で複合 FK 自体が効かないことも理由だった。M23-10 で
	//  全接続が FK=ON になった後も、TOCTOU を塞ぐ役割は残る。)
	if err = s.requireComboSetupLinkTx(ctx, tx, comboID, setupID); err != nil {
		return err
	}

	if err = s.repo.UpsertSetupResult(ctx, tx, model.ComboSetupResult{
		ComboID:  comboID,
		SetupID:  setupID,
		TechType: input.TechType,
		InCorner: input.InCorner,
		Result:   input.Result,
		Note:     input.Note,
	}); err != nil {
		return err
	}

	if err = tx.Commit(); err != nil {
		return fmt.Errorf("commit: %w", err)
	}
	return nil
}

// DeleteResult は 1 セル分を物理削除する = 「未検証へ戻す」(§4.1.3)。
// 既に未検証(行なし)でもエラーにしない。
func (s *service) DeleteResult(ctx context.Context, comboID, setupID int64, techType string, inCorner bool) error {
	if err := validateCondition(techType); err != nil {
		return err
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

	if err = s.requireComboSetupLinkTx(ctx, tx, comboID, setupID); err != nil {
		return err
	}

	if err = s.repo.DeleteSetupResult(ctx, tx, comboID, setupID, techType, inCorner); err != nil {
		return err
	}

	if err = tx.Commit(); err != nil {
		return fmt.Errorf("commit: %w", err)
	}
	return nil
}

// requireComboSetupLinkTx は (comboID, setupID) の紐付け存在を同一 Tx 内で確認する。
// 複合 FK に加えたサービス層の多層防御(M19-02 §4.6-2 と同じ流儀)。
//
// Tx 内で行うのは、確認と書き込みの間に紐付けが解除されると孤児行が書けてしまうため
// (TOCTOU)。M19-02 当時は FK=OFF の接続で複合 FK 自体が効かないことも理由だったが、
// M23-10 で全接続が FK=ON になった後も TOCTOU を塞ぐ役割は残る。
func (s *service) requireComboSetupLinkTx(ctx context.Context, tx *sql.Tx, comboID, setupID int64) error {
	exists, err := s.repo.ComboSetupExistsTx(ctx, tx, comboID, setupID)
	if err != nil {
		return fmt.Errorf("check combo_setup exists: %w", err)
	}
	if !exists {
		return ErrSetupLinkNotFound
	}
	return nil
}

// insertVerifiedConditions は「確認できた条件」を成立(ok)として書く(§4.5)。
// 呼び出し側の Tx をそのまま使い、combo_setups を作った後に呼ぶこと。
// conditions が空なら何もしない(チェックせずに採用できる)。
func (s *service) insertVerifiedConditions(ctx context.Context, tx *sql.Tx, comboID, setupID int64, conditions []SetupResultCondition) error {
	results, err := buildVerifiedResults(comboID, setupID, conditions)
	if err != nil {
		return err
	}
	if len(results) == 0 {
		return nil
	}
	if err := s.repo.InsertSetupResultsTx(ctx, tx, results); err != nil {
		return fmt.Errorf("insert verified conditions: %w", err)
	}
	return nil
}

// buildVerifiedResults は「確認できた条件」(採用時のチェック)を成立(ok)の行へ変換する。
// 値域外は ErrInvalidResultValue。重複するセルは 1 行に畳む(upsert のため実害は無いが、
// 入力の素直さを保つ)。note はここでは扱わない(§4.5)。
func buildVerifiedResults(comboID, setupID int64, conditions []SetupResultCondition) ([]model.ComboSetupResult, error) {
	if len(conditions) == 0 {
		return nil, nil
	}
	seen := make(map[string]struct{}, len(conditions))
	results := make([]model.ComboSetupResult, 0, len(conditions))
	for _, cond := range conditions {
		if err := validateCondition(cond.TechType); err != nil {
			return nil, err
		}
		key := fmt.Sprintf("%s:%t", cond.TechType, cond.InCorner)
		if _, dup := seen[key]; dup {
			continue
		}
		seen[key] = struct{}{}
		results = append(results, model.ComboSetupResult{
			ComboID:  comboID,
			SetupID:  setupID,
			TechType: cond.TechType,
			InCorner: cond.InCorner,
			Result:   model.SetupResultOK, // 採用時は成立のみ記録する(不成立は項目10 側で後から)
		})
	}
	return results, nil
}

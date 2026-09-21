// Package setup はセットプレイのビジネスロジック(CRUD、VAL-S01〜S05)を集約する。
//
// 設計参照: DES-006 §3(VAL-S01〜S05)、SUPP-001 §7.5、M4-01 指示書 §4.3〜§4.4。
package setup

import (
	"context"
	"fmt"
	"strings"

	"github.com/plexiblinp/tacpendium/internal/model"
	"github.com/plexiblinp/tacpendium/internal/service/validation"
)

const (
	CodeS01CharacterExists = "VAL-S01"
	CodeS02RecipeNotEmpty  = "VAL-S02"
	CodeS03MoveExists      = "VAL-S03"
	CodeS04Duplicate       = "VAL-S04"
	CodeS05ParentRequired  = "VAL-S05"
	// VAL-S06: セットプレイ名必須(C-03、ERROR)。DES-006 の正式番号は設計担当が CHANGE で確定する。
	CodeS06NameRequired = "VAL-S06"
	// CodeS07DuplicateInTrash は、登録しようとしたセットプレイと同じ親コンボに、同一レシピの
	// 論理削除済みセットプレイが在ることを表す(M23-05 §4.1・WARNING)。
	// ★POST /api/combos/:comboId/setups でのみ走る。CreateSetupInTx(コンボ同時登録)や
	//   PATCH では走らせない(M23-05 §4.5)。
	CodeS07DuplicateInTrash = "VAL-S07"
	// CodeR04DuplicateAliveSetup は、復元するセットプレイと同じ親コンボに、同一レシピの
	// 生きたセットプレイが在ることを表す(M23-05 §4.1・WARNING)。
	// ★VAL-R 系だが、判定に必要な材料(親コンボ・レシピハッシュ)が setup パッケージに
	//   閉じているため、VAL-R01 / VAL-R02 と違って本パッケージで定義している。
	CodeR04DuplicateAliveSetup = "VAL-R04"
)

// CharacterReader は VAL-S01 用のキャラ存在確認インタフェース。
type CharacterReader interface {
	ExistsByID(ctx context.Context, id int64) (bool, error)
}

// MoveReader は VAL-S03 用の技存在確認インタフェース。
type MoveReader interface {
	ExistsForCharacter(ctx context.Context, characterID, moveID int64) (bool, error)
}

// SetupDuplicateChecker は VAL-S04 用の重複判定インタフェース。
type SetupDuplicateChecker interface {
	FindDuplicateInCombo(ctx context.Context, comboID int64, characterID int64, recipeHash string, excludeSetupID *int64) (*int64, error)
}

// ValidationDeps はバリデーション関数が依存する外部リポジトリの集合。
type ValidationDeps struct {
	CharacterRepo CharacterReader
	MoveRepo      MoveReader
	SetupRepo     SetupDuplicateChecker
}

// ValidateSetupMoveExistence は VAL-S03(技存在確認)だけを単独で実行する。
//
// 復元経路(M23-04 §1.5-2)が使う。★判定内容は登録・更新経路と同一である——
// 元は ValidateSetupCreate と ValidateSetupUpdate に同じループが 2 つ書かれており、
// 復元で 3 つ目を書くと片方だけ直されて静かにずれるため、1 本へ切り出した。
//
// ★復元でこれを走らせる理由は「削除中に技が消えた」を見るためではない(moves に
// アプリ操作での削除経路が無い＝M23-04 §3.3-4 実査)。検証の緩かった経路で
// 登録時から不整合だった行に気づくためである(同 §4.5-2)。
func ValidateSetupMoveExistence(
	ctx context.Context,
	result *validation.ValidationResult,
	characterID int64,
	steps []model.SetupStep,
	deps ValidationDeps,
) {
	validateS03MoveExists(ctx, result, characterID, steps, deps)
}

// validateS03MoveExists は VAL-S03 の本体(WARNING)。
// MoveRepo 未注入(テスト用の最小構成)では何もしない。
func validateS03MoveExists(
	ctx context.Context,
	result *validation.ValidationResult,
	characterID int64,
	steps []model.SetupStep,
	deps ValidationDeps,
) {
	if deps.MoveRepo == nil {
		return
	}
	for i, step := range steps {
		if step.MoveID == nil {
			continue
		}
		exists, err := deps.MoveRepo.ExistsForCharacter(ctx, characterID, *step.MoveID)
		if err == nil && !exists {
			result.AddWarning(CodeS03MoveExists,
				fmt.Sprintf("steps[%d].moveId", i),
				fmt.Sprintf("ステップ %d の技 ID(%d) はこのキャラクターに存在しません", i+1, *step.MoveID))
		}
	}
}

// ValidateSetupCreate は新規作成時のバリデーションを実行する(VAL-S01〜S05)。
func ValidateSetupCreate(ctx context.Context, parentComboID int64, input CreateSetupInput, recipeHash string, deps ValidationDeps) validation.ValidationResult {
	var result validation.ValidationResult

	// VAL-S05: 親コンボ ID 必須（CHANGE-012、SUPP-001 §7.5.3）
	if parentComboID == 0 {
		result.AddError(CodeS05ParentRequired, "parentComboId", "親コンボ ID は必須です（セットプレイは親コンボに紐付く形でのみ作成可能）")
	}

	// VAL-S01: character_id が存在するキャラクターか
	if input.CharacterID > 0 {
		exists, err := deps.CharacterRepo.ExistsByID(ctx, input.CharacterID)
		if err == nil && !exists {
			result.AddError(CodeS01CharacterExists, "characterId", "指定されたキャラクターが存在しません")
		}
	} else {
		result.AddError(CodeS01CharacterExists, "characterId", "キャラクター ID は必須です")
	}

	// VAL-S06: セットプレイ名必須(C-03)
	if input.Name == nil || strings.TrimSpace(*input.Name) == "" {
		result.AddError(CodeS06NameRequired, "name", "セットプレイ名は必須です")
	}

	// VAL-S02: レシピが空でないか
	if len(input.Steps) == 0 {
		result.AddError(CodeS02RecipeNotEmpty, "steps", "レシピは 1 ステップ以上必要です")
	}

	// VAL-S03: レシピ中の moveId が該当キャラに存在する技か（WARNING）
	validateS03MoveExists(ctx, &result, input.CharacterID, input.Steps, deps)

	// VAL-S04: 同一コンボ内の同一レシピ重複チェック
	if parentComboID != 0 && len(input.Steps) > 0 {
		existingID, err := deps.SetupRepo.FindDuplicateInCombo(ctx, parentComboID, input.CharacterID, recipeHash, nil)
		if err == nil && existingID != nil {
			result.AddError(CodeS04Duplicate, "", "同一レシピのセットプレイが既にこのコンボに紐付いています")
		}
	}

	return result
}

// ValidateSetupUpdate は更新時のバリデーションを実行する（レシピ変更時のみ VAL-S02/S03/S04）。
func ValidateSetupUpdate(ctx context.Context, setupID int64, parentComboIDs []int64, input UpdateSetupInput, characterID int64, recipeHash string, deps ValidationDeps) validation.ValidationResult {
	var result validation.ValidationResult

	// VAL-S06: セットプレイ名必須(C-03)。更新では Name 非 nil(変更指定)時のみ検証し、
	// 空文字へのクリアを禁止する。nil(名前を変更しない)はスキップ。レシピ未変更でも実行する。
	if input.Name != nil && strings.TrimSpace(*input.Name) == "" {
		result.AddError(CodeS06NameRequired, "name", "セットプレイ名は必須です")
	}

	if input.Steps == nil {
		return result
	}

	steps := *input.Steps

	// VAL-S02
	if len(steps) == 0 {
		result.AddError(CodeS02RecipeNotEmpty, "steps", "レシピは 1 ステップ以上必要です")
	}

	// VAL-S03
	validateS03MoveExists(ctx, &result, characterID, steps, deps)

	// VAL-S04: 各紐付きコンボで重複チェック
	if len(steps) > 0 {
		for _, comboID := range parentComboIDs {
			existingID, err := deps.SetupRepo.FindDuplicateInCombo(ctx, comboID, characterID, recipeHash, &setupID)
			if err == nil && existingID != nil {
				result.AddError(CodeS04Duplicate, "", "同一レシピのセットプレイが既にこのコンボに紐付いています")
				break
			}
		}
	}

	return result
}

// ---------------------------------------------------------------------------
// M23-05: 削除済み行と再登録の衝突(VAL-S07 / VAL-R04)
// ---------------------------------------------------------------------------
//
// ★★どちらも登録・復元を止めない WARNING である(M23-05 §4.1-1)。VAL-S04 の判定内容は
// 一切変えていない——あちらは ERROR で 409 duplicate_setup を返し続ける。

// ValidateS07DuplicateInTrash は VAL-S07 を判定する(M23-05 §4.1)。
//
// deleted は「同じ親コンボに紐付いており、論理削除済みで、レシピが一致する」セットプレイ。
// 母集団の絞り込みとレシピ比較はリポジトリ層が担う(FindDeletedDuplicateRefsInCombo)。
//
// ★親コンボが同じであることが条件である。異なる親への同一レシピは正当であり、
// VAL-S04 と同じ意味論を保つ(§4.1-2)。
func ValidateS07DuplicateInTrash(result *validation.ValidationResult, deleted []model.SetupRef) {
	if len(deleted) == 0 {
		return
	}
	result.AddWarningWithDetails(CodeS07DuplicateInTrash, "",
		fmt.Sprintf("同じレシピのセットプレイ %d 件が同じ親コンボのゴミ箱にもあります(登録は成功しています)", len(deleted)),
		validation.SetupRefDetails(deleted))
}

// ValidateR04DuplicateAliveSetup は VAL-R04 を判定する(M23-05 §4.1)。
//
// alive は「同じ親コンボに紐付いており、生きており、レシピが一致し、復元対象自身ではない」
// セットプレイ。★自分自身の除外はリポジトリ層(FindLiveDuplicateRefsInComboTx)が担う——
// 復元は deleted_at を NULL に戻してから検証するため、除外を落とすと必ずヒットする(§4.3)。
func ValidateR04DuplicateAliveSetup(result *validation.ValidationResult, alive []model.SetupRef) {
	if len(alive) == 0 {
		return
	}
	result.AddWarningWithDetails(CodeR04DuplicateAliveSetup, "",
		fmt.Sprintf("同じレシピのセットプレイ %d 件が既にこのコンボに紐付いています。復元したので重複して並んでいます", len(alive)),
		validation.SetupRefDetails(alive))
}

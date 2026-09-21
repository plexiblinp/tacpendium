// Package validation はコンボ等のバリデーションロジックを集約する。
//
// 設計参照:
//   - DES-006 §2(コンボ登録時のバリデーション、VAL-C01〜C12 / VAL-D01〜D03)
//   - SUPP-001 §2.1(仮登録の NULL 許容ルール)
//   - SUPP-001 §2.2(重複判定の完全一致ルール)
//   - 指示書 M1-03 §4.2(VAL の本登録/仮登録での適用差)
package validation

import (
	"context"
	"fmt"

	"github.com/plexiblinp/tacpendium/internal/model"
)

// VAL-ID 定数。
const (
	CodeC01CharacterExists     = "VAL-C01"
	CodeC02Duplicate           = "VAL-C02"
	CodeC03StarterMatchesStep1 = "VAL-C03"
	CodeC04DriveRange          = "VAL-C04"
	// CodePositionMassRange は始動位置マス数・運び量の値域(0〜160)。
	//
	// ★★`VAL-Cxx` の番号を自採番していない(D-293 と同じ理由)。DES-006 へ番号付きの
	//   検証コードが要るかは設計卓の手番であり、製造は docs/design/ を編集しない
	//   (指示書 §2.2-3-b)。⇒ 記述的コードを使う。
	//   ★先例＝csvcore の "VAL-ENUM" / "VAL-RANGE"(DES-006 に番号を持たない CSV 層のコード)。
	CodePositionMassRange = "VAL-RANGE"
	CodeC05SARange        = "VAL-C05"
	// VAL-C06 / VAL-C07(ゲージ消費量バリデーション)は CHANGE-019 で廃止。ID は欠番とし繰り上げない。
	CodeC08MoveExists          = "VAL-C08"
	CodeC09RecipeNotEmpty      = "VAL-C09"
	CodeC10KnockdownRange      = "VAL-C10"
	CodeC11OkiConsistency      = "VAL-C11"
	CodeC12RushVariantOriginal = "VAL-C12"
	// VAL-C13: drive_damage の範囲(-6〜6・小数許容、C-11)。DES-006 の正式番号は設計担当が CHANGE で確定する。
	CodeC13DriveDamageRange = "VAL-C13"
	// VAL-C15: 本登録の必須項目が未入力(M27-02b / P4M-009)。DES-006 の正式番号は
	// 設計担当が CHANGE で確定する(CodeC13 と同じ扱い)。
	//
	// ★C14 は既にゴミ箱の重複判定(DES-006 §2.1)が使っているため C15 から採った。
	CodeC15RequiredField = "VAL-C15"
)

// Dependencies はバリデーション関数群が依存する外部リポジトリの集合。
//
// テストではモック実装を渡す。本番ではサービス層が実リポジトリを束ねて渡す。
type Dependencies struct {
	CharacterRepo CharacterReader
	MoveRepo      MoveReader
	ComboRepo     ComboDuplicateChecker
}

// CharacterReader は VAL-C01 用のキャラ存在確認インタフェース。
type CharacterReader interface {
	ExistsByID(ctx context.Context, id int64) (bool, error)
}

// MoveReader は VAL-C08 / VAL-C12 用の技存在確認インタフェース。
type MoveReader interface {
	// ExistsForCharacter は (character_id, move_id) のペアが存在するか確認する(VAL-C08)。
	ExistsForCharacter(ctx context.Context, characterID, moveID int64) (bool, error)
	// FindOriginalMoveID は move_id がラッシュ版なら元技 move_id を、通常技なら nil を返す(VAL-C12)。
	// 存在しない move_id の場合は (nil, nil) を返す。
	FindOriginalMoveID(ctx context.Context, moveID int64) (*int64, error)
	// IsRushVariant は move_id が category=rush_variant か判定する(VAL-C12 補助)。
	IsRushVariant(ctx context.Context, moveID int64) (bool, error)
}

// ComboDuplicateChecker は VAL-C02 用の重複判定インタフェース。
type ComboDuplicateChecker interface {
	// FindActivePublishedDuplicates は重複候補(同一 character_id / starter_move_id /
	// position / opponent_stance / hit_type / opponent_size / starter_meaty の
	// published コンボ)を返す。
	// 各候補の Steps は呼び出し側が必要に応じてロードして recipe_hash 比較する。
	FindActivePublishedDuplicates(ctx context.Context, key DuplicateKey) ([]DuplicateCandidate, error)
}

// DuplicateKey は VAL-C02 の重複判定に使う照合キー(SUPP-001 §2.2)。
//
// 注: 同等のフィールドを持つ `internal/repository/combo.DuplicateKey` がリポジトリ層側にも
// 存在する。両者は意図的に別パッケージで定義されており、層独立性(リポジトリ層が
// サービス層を import しないこと)を保つために分離している(M1-03 機械レビュー指摘・
// 高優先の対応、案 A 採用)。両者の変換は `internal/service/combo/deps_adapter.go` の
// `ComboDuplicateAdapter.FindActivePublishedDuplicates` で行う。
type DuplicateKey struct {
	CharacterID    int64
	StarterMoveID  *int64
	Position       *string
	OpponentStance *string
	HitType        *string
	OpponentSize   *string
	// StarterMeaty は始動技を持続当てしたか(M37-07・重複判定キーの 8 つ目・D-874)。
	// ★列が NOT NULL DEFAULT 0 のためポインタにしない(NULL 一致の扱いが要らない)。
	StarterMeaty bool
}

// DuplicateCandidate は recipe_hash 比較用の最小情報を保持する候補レコード。
type DuplicateCandidate struct {
	ID         int64
	RecipeHash string
	StepCount  int
	// Memo は「どのコンボか」を人が読める形で示すための文字列(M23-09 §4.1-3)。
	// ★combos に name 列は無く、memo がその役割を負う(model.ComboRef と同じ扱い)。
	// ★VAL-C02 は本フィールドを見ない。判定には一切関与しない。
	Memo *string
}

// ValidateComboForCreate は本登録の適用面 3 経路で共通に使用するバリデーション。
// isDraft で本登録/仮登録の挙動を切り替える。
//
// ★★呼出元は 3 か所である(2026-08-27・M24-11 で実査。旧記述は POST と PUT の 2 つしか
// 挙げておらず、昇格経路が落ちていた):
//   - POST /api/combos                  combo.Create
//   - PUT  /api/combos/:id              combo.UpdateWithKeyChange(キー変更編集)
//   - PATCH /api/combos/:id             combo.UpdateMetadata の仮登録→本登録昇格のみ
//
// ★あわせて materialize が VAL-C02 相当の探索を本関数を通さず直接行う
// (combo.Materialize。CHANGE-089)。⇒ VAL-C02 の適用面は合計 4 経路である。
//
// ★★4 経路すべてが「書き込みトランザクションの内側で、その tx を使って」判定すること
// (M24-11 / CHANGE-136)。tx の外で判定すると check-then-act になり、同一識別キーの
// 本登録が 2 件生存しうる。新しい呼出元を足すときは同じ形にすること。
//
// 仮登録時のスキップ規則(指示書 M1-03 §4.2 + Q3 確定事項):
//   - VAL-C02: 完全スキップ(SUPP-001 §2.3 の「仮登録は試案、本登録と被っても問題なし」)
//   - VAL-C03: starter_move_id が NULL ならスキップ
//   - VAL-C04: NULL 許容(本登録は ERROR、仮登録は範囲チェックのみ)
//   - VAL-C05: 同上
//   - VAL-C09: ★★スキップしない(M24-13 / CHANGE-139)。仮登録でもレシピのステップ
//     1 本以上を要する。★同じ 1 本を呼ぶ(条件を写した 2 本目を書かない)。
//     ★数えるのはステップの本数だけであり、move_id の中身は見ない
//     ——move_id が NULL のステップには 2 つの目的がある(非技ステップの正規表現
//     =DES-004 §2.2 / 仮登録の「技が未指定」=VAL-D02)。どちらも 1 本として数える。
//   - VAL-C10: NULL 時スキップ
//   - VAL-C15: ★★仮登録は完全スキップ(M27-02b / P4M-009)。仮登録は「未確定でも
//     保存できる」入口として設計されているため(SUPP-001 §2.1)。
//     ★★ただし本登録への昇格時には走る——昇格は PATCH の中で isDraft=false として
//     本関数を呼ぶ経路であり(service/combo/service.go)、そこで必須が効く。
//
// newComboRecipeHash は呼び出し側が事前に CalcRecipeHash(steps) で計算した値。
// VAL-C02 で候補との比較に使う(本登録時のみ)。
func ValidateComboForCreate(
	ctx context.Context,
	combo *model.Combo,
	steps []model.ComboStep,
	isDraft bool,
	newComboRecipeHash string,
	deps Dependencies,
) ValidationResult {
	r := ValidationResult{}

	validateC01CharacterExists(ctx, &r, combo, deps)
	if !isDraft {
		validateC02Duplicate(ctx, &r, combo, newComboRecipeHash, deps)
	}
	validateC03StarterMatchesStep1(&r, combo, steps, isDraft)
	validateC04DriveRange(&r, combo, isDraft)
	validateC05SARange(&r, combo, isDraft)
	validateC13DriveDamageRange(&r, combo)
	validatePositionMassRange(&r, combo)
	validateC15RequiredFields(&r, combo, isDraft)
	validateC08MoveExists(ctx, &r, combo, steps, deps)
	validateC09RecipeNotEmpty(&r, steps)
	validateC10KnockdownRange(&r, combo)
	validateC11OkiConsistency(&r, combo)
	validateC12RushVariantOriginal(ctx, &r, combo, steps, deps)

	return r
}

// VAL-C01: character_id が存在するか(本登録/仮登録共通、ERROR)
func validateC01CharacterExists(ctx context.Context, r *ValidationResult, combo *model.Combo, deps Dependencies) {
	if deps.CharacterRepo == nil {
		return
	}
	exists, err := deps.CharacterRepo.ExistsByID(ctx, combo.CharacterID)
	if err != nil {
		r.AddError(CodeC01CharacterExists, "characterId",
			fmt.Sprintf("キャラクターの存在確認に失敗しました: %v", err))
		return
	}
	if !exists {
		r.AddError(CodeC01CharacterExists, "characterId",
			fmt.Sprintf("character_id=%d のキャラクターが存在しません", combo.CharacterID))
	}
}

// VAL-C02: 重複判定(本登録時のみ、ERROR、Q3 で確定)
//
// 候補(同一キーの published コンボ)を取得し、各候補の recipe_hash と比較。
// 一致するものがあれば重複としてエラー。仮登録は呼び出し側でスキップされる前提。
func validateC02Duplicate(
	ctx context.Context,
	r *ValidationResult,
	combo *model.Combo,
	newComboRecipeHash string,
	deps Dependencies,
) {
	if deps.ComboRepo == nil {
		return
	}
	key := DuplicateKey{
		CharacterID:    combo.CharacterID,
		StarterMoveID:  combo.StarterMoveID,
		Position:       combo.Position,
		OpponentStance: combo.OpponentStance,
		HitType:        combo.HitType,
		OpponentSize:   combo.OpponentSize,
		StarterMeaty:   combo.StarterMeaty,
	}
	candidates, err := deps.ComboRepo.FindActivePublishedDuplicates(ctx, key)
	if err != nil {
		r.AddError(CodeC02Duplicate, "",
			fmt.Sprintf("重複判定に失敗しました: %v", err))
		return
	}
	for _, c := range candidates {
		if c.RecipeHash == newComboRecipeHash {
			r.AddError(CodeC02Duplicate, "",
				fmt.Sprintf("同一キャラ・同一レシピ・同一状況のコンボが既に存在します(id=%d)", c.ID))
			return
		}
	}
}

// VAL-C03: starter_move_id がレシピ 1 ステップ目の move_id と一致するか(WARNING)
//
// starter_move_id が NULL の場合、本登録/仮登録共通でスキップする
// (1 ステップ目との比較対象が無いため)。レシピが空の場合も別 VAL(C09)が扱うのでスキップ。
func validateC03StarterMatchesStep1(r *ValidationResult, combo *model.Combo, steps []model.ComboStep, isDraft bool) {
	_ = isDraft // 本検証では isDraft の分岐は不要(starter NULL チェックで両モード共に early return)
	if combo.StarterMoveID == nil {
		return
	}
	if len(steps) == 0 {
		return
	}
	first := steps[0]
	if first.MoveID == nil || *first.MoveID != *combo.StarterMoveID {
		r.AddWarning(CodeC03StarterMatchesStep1, "starterMoveId",
			"始動技がレシピ 1 ステップ目の technique と一致しません")
	}
}

// ValidateMetadataRanges は PATCH(メタデータ編集)で更新される値の範囲を検証する。
// combo には検証したい値のみを設定する(nil のフィールドは各チェックがスキップする)。
// 適用範囲は Create 経路と同一: VAL-C04/C05/C13 = ERROR、VAL-C10 = WARNING。
// NULL 許容判定は不要(呼出側が「値あり」のフィールドだけを渡す)ため isDraft=true 相当で呼ぶ。
//
// ★★M37-01: マス数 2 列の範囲検証を足した。着手前は Create 経路(ValidateComboForCreate)
// にしか無く、PATCH は素通りしていた —— 着手前は PATCH がマス数を運べなかったため
// 露出しなかったが、M37-01 で運べるようにした時点で穴になる。
// ⇒ 無いと値域外が DB の CHECK 違反になり、ハンドラの既定分岐で 500 になる
//
//	(validatePositionMassRange の godoc がそう書いている)。
//
// ★VAL コードは既存の CodePositionMassRange をそのまま使う。⇒ DES-006 の VAL-C16 と
//
//	実装の VAL-RANGE の食い違いには手を付けていない(M37-01 §4.3・報告のみ)。
func ValidateMetadataRanges(r *ValidationResult, combo *model.Combo) {
	validateC04DriveRange(r, combo, true)
	validateC05SARange(r, combo, true)
	validateC13DriveDamageRange(r, combo)
	validateC10KnockdownRange(r, combo)
	validatePositionMassRange(r, combo)
}

// VAL-C04: drive_available_at_start が 0〜6 の範囲内か(ERROR、仮登録は NULL 許容、小数許容)。
// M16-01 で INTEGER→REAL 化(0.5 刻み)。範囲のみ検証し、0.5 刻みは UI 担保(VAL-C13 と同方針)。
func validateC04DriveRange(r *ValidationResult, combo *model.Combo, isDraft bool) {
	if combo.DriveAvailableAtStart == nil {
		if !isDraft {
			// 本登録で NULL でも可(SUPP-001 §2.1 で NULL 許容)、ただし設定されていれば範囲チェック
		}
		return
	}
	v := *combo.DriveAvailableAtStart
	if v < 0 || v > 6 {
		r.AddError(CodeC04DriveRange, "driveAvailableAtStart",
			fmt.Sprintf("ドライブゲージの開始残量は 0〜6 の範囲である必要があります(現在: %g)", v))
	}
}

// validatePositionMassRange は始動位置マス数・運び量が 0〜160 の範囲内かを見る(ERROR・M28-02a)。
//
// ★★これが無いと値域外は DB の CHECK 違反になり、ハンドラの既定分岐で 500 になる。
// 400 + validations で返すのが他の値域欄(VAL-C04 / C05 / C13)と同じ扱いである。
// ★物差しはトレーニングモードの床のマス(0〜160)。値域の正本は model.MaxPositionMass。
// ★NULL は不問/未入力であり、範囲チェックの対象外。
func validatePositionMassRange(r *ValidationResult, combo *model.Combo) {
	for _, f := range []struct {
		name  string
		value *int
		label string
	}{
		{"startPositionMass", combo.StartPositionMass, "始動位置"},
		{"carryDistanceMass", combo.CarryDistanceMass, "運び量"},
	} {
		if f.value == nil {
			continue
		}
		if v := *f.value; v < 0 || v > model.MaxPositionMass {
			r.AddError(CodePositionMassRange, f.name,
				fmt.Sprintf("%sは 0〜%d マスの範囲である必要があります(現在: %d)",
					f.label, model.MaxPositionMass, v))
		}
	}
}

// VAL-C05: sa_available_at_start が 0〜3 の範囲内か(ERROR、仮登録は NULL 許容)
func validateC05SARange(r *ValidationResult, combo *model.Combo, isDraft bool) {
	if combo.SAAvailableAtStart == nil {
		_ = isDraft
		return
	}
	v := *combo.SAAvailableAtStart
	if v < 0 || v > 3 {
		r.AddError(CodeC05SARange, "saAvailableAtStart",
			fmt.Sprintf("SAゲージの開始残量は 0〜3 の範囲である必要があります(現在: %d)", v))
	}
}

// VAL-C13: drive_damage が -6〜6 の範囲内か(ERROR、NULL 時スキップ、小数許容)。
// 相手ドライブゲージ削り量(本数)。回復で負値、1 本未満の増減で小数を許容する(C-11)。
// CHECK 制約は使わず(DES-003 L394)、BE 検証 + UI 制約で範囲を担保する。
func validateC13DriveDamageRange(r *ValidationResult, combo *model.Combo) {
	if combo.DriveDamage == nil {
		return
	}
	v := *combo.DriveDamage
	if v < -6 || v > 6 {
		r.AddError(CodeC13DriveDamageRange, "driveDamage",
			fmt.Sprintf("ドライブダメージは -6〜6 の範囲である必要があります(現在: %g)", v))
	}
}

// VAL-C06 / VAL-C07(ゲージ消費量バリデーション)は CHANGE-019 で廃止(消費量キャッシュ列の削除に伴う)。

// ValidateMoveExistence は VAL-C08(技存在確認)だけを単独で実行する。
//
// 復元経路(M23-04 §1.5-2)が使う。★判定内容は登録・更新経路と同一であり、
// 適用先を増やしているだけである——同じ検証を書き直すと、片方だけ直されて
// 静かにずれる。
//
// ★復元でこれを走らせる理由は「削除中に技が消えた」を見るためではない(そもそも
// moves にアプリ操作での削除経路が無い＝M23-04 §3.3-4 実査)。検証の緩かった経路
// (CSV 取込・API 直叩き)で登録時から不整合だった行に気づくためである(同 §4.5-2)。
func ValidateMoveExistence(
	ctx context.Context,
	r *ValidationResult,
	combo *model.Combo,
	steps []model.ComboStep,
	deps Dependencies,
) {
	validateC08MoveExists(ctx, r, combo, steps, deps)
}

// VAL-C08: 各ステップの move_id がキャラに存在するか(WARNING、本登録/仮登録共通)
func validateC08MoveExists(ctx context.Context, r *ValidationResult, combo *model.Combo, steps []model.ComboStep, deps Dependencies) {
	if deps.MoveRepo == nil {
		return
	}
	for _, step := range steps {
		if step.MoveID == nil {
			continue // 非技ステップ(modifiers.type 等)は move_id NULL 可
		}
		exists, err := deps.MoveRepo.ExistsForCharacter(ctx, combo.CharacterID, *step.MoveID)
		if err != nil {
			r.AddWarning(CodeC08MoveExists, fmt.Sprintf("steps[%d].moveId", step.StepOrder),
				fmt.Sprintf("技の存在確認に失敗しました: %v", err))
			continue
		}
		if !exists {
			r.AddWarning(CodeC08MoveExists, fmt.Sprintf("steps[%d].moveId", step.StepOrder),
				fmt.Sprintf("技 id=%d は character_id=%d に存在しません",
					*step.MoveID, combo.CharacterID))
		}
	}
}

// VAL-C09: レシピが空でないか(ERROR)。
//
// ★★M24-13 / CHANGE-139 で仮登録にも適用するようになった(以前は本登録時のみ)。
// 「ステップが入っていない仮登録は、何に使おうとしたものか後から分からない」ため。
// ★VAL-D02(move_id 未指定の許容)は変えていない。数えるのは本数だけである。
func validateC09RecipeNotEmpty(r *ValidationResult, steps []model.ComboStep) {
	if len(steps) == 0 {
		r.AddError(CodeC09RecipeNotEmpty, "steps",
			"レシピが空です。少なくとも 1 ステップ必要です")
	}
}

// VAL-C10: knockdown_advantage が現実的な範囲(-600〜+600)内か(WARNING、NULL 時スキップ)
func validateC10KnockdownRange(r *ValidationResult, combo *model.Combo) {
	if combo.KnockdownAdvantage == nil {
		return
	}
	v := *combo.KnockdownAdvantage
	if v < -600 || v > 600 {
		r.AddWarning(CodeC10KnockdownRange, "knockdownAdvantage",
			fmt.Sprintf("ダウン後の有利フレームは -600〜+600 の範囲が現実的です(現在: %d)", v))
	}
}

// requiredPublishedFields は本登録(is_draft=false)で必須になる欄の一覧(M27-02b・
// 開発者確定 2026-09-03)。
//
// ★★フロント側の正典は web/src/constants/field-requirement.ts の
// REQUIRED_PUBLISHED_COMBO_FIELDS。**片側だけ足すと、画面は通るのに保存で落ちる**
// (またはその逆)になる。⇒ 足すときは必ず両側を直す。
//
// ★field はフロントの DTO 名(camelCase)で入れる。エディタのタブ振り分け
// (web/src/features/combo/editorTabs.ts の tabOfIssueField)は field の前方一致で
// 見ており、ここに挙げた 2 件はいずれも許可リストに無いため既定の「基本情報」タブへ
// 落ちる。★2 欄とも基本情報タブの欄であり、既定の振り分けが正しい。
//
// ★★★【M38-01・射程 3】欄は 2 度動いた。**現在は 2 欄である。**
//
//	着手前:     damage / knockdownAdvantage / driveGaugeConsumed / saGaugeConsumed
//	追補1 まで: damage / knockdownAdvantage / driveAvailableAtStart / saAvailableAtStart
//	**現在:     damage / knockdownAdvantage の 2 欄だけ**(2026-09-18 追補2)
//
// ★★★開始残量 2 欄を必須から外した理由(2026-09-18 開発者裁定)。
// 必須化の狙いは値そのものではなく「意識的に不問にしたのか、面倒で入れなかったのか」を
// 区別することだった。⇒ UI が 3 状態(数値 / 不問 / 空のまま)を持つ一方、**DB は 2 状態
// (値 / NULL)しか持てず**、余った 1 状態が「不問」と見分けられない。開発者が実機で
// 「空欄と NULL の状態がわかりにくい」と判断し、**区別を諦めて UI を DB へ揃えた**。
// ⇒ 開始残量の NULL は「不問」1 つの意味しか持たない
// (先例 = CHANGE-200 / M37-05 の `start_position_mass IS NULL ⇔ position = 不問`)。
//
// ★★★指示書 M38-01 §2.4.1 は「「4 欄」という数を動かさない」と明示的に禁じているが、
// **開発者裁定がこれを上書きした**(CLAUDE.md §9 ハード列)。
// ⇒ DES-006 §2.1 の VAL-C15 を 2 欄へ改める CHANGE が要る(設計伝達レポート §2)。
//
// ★外した 4 欄(消費ゲージ 2 / 開始残量 2)は**空でも保存できる**。★値域の担保は
// 1 つも外していない —— 消費ゲージ 2 欄は DES-006 §2.5 が「範囲 VAL 非連動」と定めて
// おり担保は UI クランプ(clampNumericString)だけ、開始残量 2 欄は VAL-C04 / VAL-C05 が
// 引き続き範囲を見る(どちらも NULL はスキップする)。
// ⇒ 必須を外すのと値域を外すのは別である。
var requiredPublishedFields = []struct {
	field   string
	label   string
	present func(*model.Combo) bool
}{
	{"damage", "ダメージ", func(c *model.Combo) bool { return c.Damage != nil }},
	{"knockdownAdvantage", "有利フレーム", func(c *model.Combo) bool { return c.KnockdownAdvantage != nil }},
}

// VAL-C15: 本登録の必須項目が未入力でないか(ERROR、仮登録はスキップ・M27-02b)
//
// ★★値域は見ない。空かどうかだけを見る。範囲は VAL-C04/C05/C10/C13 の持ち場であり、
// 消費ゲージ 2 欄に至っては DES-006 §2.5 が「範囲 VAL 非連動」と定めている。
// ⇒ 必須化を口実に範囲チェックを足さない。
//
// ★★ERROR である。DES-006 §1.1 の「バリデーションは非ブロッキング」原則に対する
// 例外を 1 つ増やす変更であり、CHANGE のたたき台で設計担当へ申し送る。
// 開発者の逐語＝「ダメージは必須入力にしたい」(phase4-memo.txt:33)。
// ValidateRequiredForPublished は VAL-C15 だけを単独で呼ぶための入口
// (ValidateMetadataRanges と同じ位置づけ)。
//
// ★★呼び出し元は 2 本ある(M31-01 で 1 → 2 になった)。
//
//	(1) PATCH(仮登録→本登録の昇格を含む) … service/combo の UpdateMetadata
//	(2) materialize(確定反撃からの生成)  … service/combo の Materialize
//	★(2) は M31-01 で足した。着手前は本関数を通らず、必須欄が空の本登録が
//	  生成できた(followup `materialize-bypasses-required-fields`)。
//
// ★★PATCH は部分更新なので、**渡すのは「更新後の姿」でなければならない**
// (applyMetadataInput でマージしたもの)。入力だけを見ると、今回触っていない欄が
// 未入力に見えて誤って咎める。
func ValidateRequiredForPublished(r *ValidationResult, merged *model.Combo) {
	validateC15RequiredFields(r, merged, false)
}

func validateC15RequiredFields(r *ValidationResult, combo *model.Combo, isDraft bool) {
	if isDraft {
		return
	}
	for _, f := range requiredPublishedFields {
		if !f.present(combo) {
			r.AddError(CodeC15RequiredField, f.field,
				fmt.Sprintf("%sは本登録では必須です", f.label))
		}
	}
}

// VAL-C11: 起き攻めオプションの整合性(WARNING・M16-03 正規化後)
//
// ドライブラッシュ版(uses_dr=true)のオプションは、同じ (attack_type, tech_type) の
// ノーゲージ版(uses_dr=false)が存在する場合に意味を持つ。ノーゲージ版が無いのに
// ドライブラッシュ版のみが存在する状態は不整合(WARNING)。
//
// M16-03: シミー 4 区分化・打撃重ね追加に伴い、従来 meaty 2 ペアのみだった検証を
// 全 attack_type(throw_meaty / shimmy / strike_meaty)へ一様適用する(開発者確定 2026-07-05)。
func validateC11OkiConsistency(r *ValidationResult, combo *model.Combo) {
	// (attack_type, tech_type) ごとに uses_dr の有無を集計する。
	type key struct{ attackType, techType string }
	hasNoGauge := map[key]bool{}
	hasDR := map[key]bool{}
	for _, o := range combo.OkiOptions {
		k := key{o.AttackType, o.TechType}
		if o.UsesDR {
			hasDR[k] = true
		} else {
			hasNoGauge[k] = true
		}
	}
	for k := range hasDR {
		if !hasNoGauge[k] {
			r.AddWarning(CodeC11OkiConsistency, "okiOptions",
				fmt.Sprintf("起き攻め(%s / %s)のドライブラッシュ版がありますが、ノーゲージ版がありません。ノーゲージ版も設定してください", k.attackType, k.techType))
		}
	}
}

// VAL-C12: ラッシュ版 move の original_move_id 検証(ERROR)
//
// レシピ中に rush_variant カテゴリの技がある場合、その元技(original_move_id)が
// 該当キャラに存在することを確認する。存在しないラッシュ版指定はエラー。
func validateC12RushVariantOriginal(ctx context.Context, r *ValidationResult, combo *model.Combo, steps []model.ComboStep, deps Dependencies) {
	if deps.MoveRepo == nil {
		return
	}
	for _, step := range steps {
		if step.MoveID == nil {
			continue
		}
		isRush, err := deps.MoveRepo.IsRushVariant(ctx, *step.MoveID)
		if err != nil || !isRush {
			continue
		}
		origID, err := deps.MoveRepo.FindOriginalMoveID(ctx, *step.MoveID)
		if err != nil || origID == nil {
			r.AddError(CodeC12RushVariantOriginal, fmt.Sprintf("steps[%d].moveId", step.StepOrder),
				fmt.Sprintf("ラッシュ版 move id=%d に対応する元技が見つかりません", *step.MoveID))
			continue
		}
		exists, err := deps.MoveRepo.ExistsForCharacter(ctx, combo.CharacterID, *origID)
		if err != nil || !exists {
			r.AddError(CodeC12RushVariantOriginal, fmt.Sprintf("steps[%d].moveId", step.StepOrder),
				fmt.Sprintf("ラッシュ版 move id=%d の元技 id=%d は character_id=%d に存在しません",
					*step.MoveID, *origID, combo.CharacterID))
		}
	}
}

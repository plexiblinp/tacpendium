package model

import (
	"slices"
	"time"
)

// SetupStep はセットプレイのステップ(DES-003 §3.12)。
// 構造は ComboStep と同形式(`Modifiers *Modifiers`、SUPP-001 §3.3 準拠)。
type SetupStep struct {
	ID        int64      `db:"id"         json:"id"`
	SetupID   int64      `db:"setup_id"   json:"-"`
	StepOrder int        `db:"step_order" json:"stepOrder"`
	MoveID    *int64     `db:"move_id"    json:"moveId,omitempty"`
	MoveCode  *string    `db:"-"          json:"moveCode,omitempty"`
	Modifiers *Modifiers `db:"-"          json:"modifiers,omitempty"`
}

// Setup はセットプレイ(DES-003 §3.11)。
//
// セットプレイはコンボ完走後の起き攻めシーケンスを記録する。
// situation は持たない(前提条件はコンボ側に紐づくため)。
//
// Steps の規約は Combo.Steps と同じ(nil = 未ロード、リポジトリ層が IN 句バッチで注入)。
type Setup struct {
	ID          int64       `db:"id"            json:"id"`
	CharacterID int64       `db:"character_id"  json:"characterId"`
	Name        *string     `db:"name"          json:"name,omitempty"`
	Description *string     `db:"description"   json:"description,omitempty"`
	StepCount   int         `db:"step_count"    json:"stepCount"`
	RecipeCache *string     `db:"recipe_cache"  json:"-"` // JSON、サービス層がデコード
	Version     int         `db:"version"       json:"version"`
	CreatedAt   time.Time   `db:"created_at"    json:"createdAt"`
	UpdatedAt   time.Time   `db:"updated_at"    json:"updatedAt"`
	DeletedAt   *time.Time  `db:"deleted_at"    json:"-"`
	Steps       []SetupStep `db:"-"             json:"steps,omitempty"`
}

// ComboSetup は combos と setups の関連(DES-003 §3.13、多対多)。
//
// 1 コンボが複数のセットプレイに紐付き、同じセットプレイが複数のコンボに紐付き得る
// (位置違いのコンボはそれぞれ別レコードのため、紐付けも別)。
type ComboSetup struct {
	ComboID int64 `db:"combo_id" json:"comboId"`
	SetupID int64 `db:"setup_id" json:"setupId"`
}

// combo_setup_results.result の取り得る値(M19-03 / CHANGE-087)。
//
// BOOLEAN にせず文字列コード値とするのは、将来 unstable 等を足す余地を残すため
// (DES-003 の既存流儀)。「未検証」を意味する値は作らない —— 未検証は行が無いことで
// 表す(§4.1.3)。フロント側の対応定数は web/src/constants/setup-result.ts
// (CLAUDE.md §4 の列挙同期)。
const (
	SetupResultOK = "ok" // 成立
	SetupResultNG = "ng" // 不成立
)

// ComboSetupResult はセットプレイ成立条件の検証結果(DES-003・CHANGE-087 §2)。
//
// 帰属先は「コンボ × セットプレイの組」= combo_setups の組。setups は複数コンボに
// 紐づき得るが、転用先ではコンボの終わり際の距離が違うため成立条件も変わるため
// (CHANGE-087 §3.1)。
//
// 1 組あたり最大 4 行(TechType 2 種 × InCorner 2 値)で、PK が構造的に保証する。
// 行が無い = 未検証、行がある = Result が成立(SetupResultOK)/不成立(SetupResultNG)。
// 「未検証へ戻す」操作は行の物理削除であり、Result に NULL や「未検証」の値を入れない。
//
// 検証日時・timestamps は持たない(CHANGE-087 §2-e)。
type ComboSetupResult struct {
	ComboID  int64   `db:"combo_id"  json:"-"`        // 親のキー。API では URL 側で表現するため JSON に出さない
	SetupID  int64   `db:"setup_id"  json:"setupId"`  //
	TechType string  `db:"tech_type" json:"techType"` // OkiTechTypeNeutral / OkiTechTypeBack(第 3 の語彙を作らない)
	InCorner bool    `db:"in_corner" json:"inCorner"` // コンボ終了時に相手が画面端にいるか。combos.position とは意味が違う
	Result   string  `db:"result"    json:"result"`   // SetupResultOK / SetupResultNG
	Note     *string `db:"note"      json:"note,omitempty"`
}

// IsValidSetupResultValue は result の値域を判定する(DES-006 に VAL は足さない＝
// CHANGE-087 §4-1 の裁定により、値域の正典は本表の定義)。
func IsValidSetupResultValue(v string) bool {
	return v == SetupResultOK || v == SetupResultNG
}

// IsValidOkiTechType は tech_type の値域を判定する。combo_oki_options の値域を
// 再利用しており、combo_setup_results もこれに従う。
// 値域の正典は OkiTechTypes(値の追加時に判定側が取り残されないよう、列挙を唯一の源とする)。
func IsValidOkiTechType(v string) bool {
	return slices.Contains(OkiTechTypes, v)
}

// SetupResultUnverified は「未検証」を表す絞り込み専用の値(M19-06)。
//
// combo_setup_results.result には保存されない —— 未検証は行が無いことで表す
// (上の const ブロックのとおり)。一覧の絞り込みだけが「まだ確認していない」を
// 名前で指す必要があるため、絞り込みの語彙としてのみ定義する。
// フロント側の対応定数は web/src/constants/setup-result.ts の
// SETUP_RESULT_UNVERIFIED(第 3 の語彙を作らず、既存の UI 語彙に合わせる)。
const SetupResultUnverified = "unverified"

// IsValidSetupResultFilterValue は一覧の成立条件フィルタ(M19-06)の値域を判定する。
//
// 保存値の値域(IsValidSetupResultValue)とは別物である —— こちらは
// SetupResultUnverified を含み、保存値の判定には使えない。
func IsValidSetupResultFilterValue(v string) bool {
	return v == SetupResultOK || v == SetupResultNG || v == SetupResultUnverified
}

// ComboRef はコンボを指し示す最小の参照(M23-02 §4.4-3)。
//
// セットプレイの完全削除を拒否したときに、参照元のコンボを応答へ載せるために使う。
// ★画面はこれを列挙し、各行から紐付けを解除できる(M23-07 §4.3-1)。
// ⇒ D-485(M23-02＝列挙しない)は M23-07 が上書きした。不具合の切り分けにも効く。
//
// ★推測: combos に name 列が無いため、利用者が付けた唯一の自由記述である memo を
// 「名前」に相当するものとして載せると仮定した。空でもよい(omitempty)。
// 応答へ {id, memo} を載せる形そのものは開発者が承認している(2026-08-20・M23-02
// Plan Mode の未決事項 4)が、memo を名前に充てる読み替えは製造の判断である。
// ★memo は画面が参照元コンボを識別するための唯一の手がかりである(M23-07 §4.3-1)。
// 空のときは画面が「コンボ {id}」へ落とす。落とすこと自体は正常な状態である。
type ComboRef struct {
	ID   int64   `json:"id"`
	Memo *string `json:"memo,omitempty"`
}

// SetupRef はセットプレイを指し示す最小の参照(M23-04 §4.3-3)。
//
// コンボを復元したときに「紐付いていたが、まだゴミ箱に居るセットプレイ」を
// 警告の details へ載せるために使う。★形は ComboRef に揃えてある——M23-02 が
// details.combos へ {id, memo} を返しており、新しい見せ方を作らない(D-417)。
//
// ★ComboRef が memo を使うのに対しこちらが name を使うのは、setups が name 列を
// 持つためである(combos は name 列を持たない)。読み替えは要らない。
type SetupRef struct {
	ID   int64   `json:"id"`
	Name *string `json:"name,omitempty"`
}

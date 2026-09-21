package punishfinder

import "github.com/plexiblinp/tacpendium/internal/model"

// 走査判定の定数。マジックナンバー化せず 1 箇所に集約し根拠を明記する(指示書 §4.3.3)。
const (
	// DashMinSlack はダッシュ経由レーンの残り猶予の下限。
	// ダッシュ後に最速技(概ね 4F)が出せる下限として開発者が指定した足切り値。
	DashMinSlack = 4

	// JumpSlack はジャンプ経由レーンの猶予補正。
	// ジャンプ攻撃は攻撃判定が下方向に伸び着地前に着弾するため、素のジャンプ全体より
	// 4F ほど早く当たる、という経験則の近似値。実測値ではない。運用後に
	// combo_punish_starters.verdict の分布(unreachable=偽陽性/手動登録=偽陰性の兆候)を見て調整する。
	JumpSlack = 4
)

// jumpHeavyCodePart はジャンプ経由レーンで抽出する強攻撃(跳び込み)の code 部分文字列。
//
// 【E-21・実データで確定】is_aerial=1 は 70 件だが接頭辞は一様でない(9 件は jumping_ 以外:
// elbow_drop/flying_*/great_spin/step_up_*=unique、neutral_jumping_heavy_kick=normal)。
// 強攻撃の跳び込みは category=normal かつ code に jumping_heavy_ を含むもの。
// よって抽出は is_aerial=1 と category=normal を主条件とし、本部分文字列を補助にする。
// prefix 判定では neutral_jumping_heavy_kick を取りこぼし、is_aerial のみでは unique 系を巻き込む。
// jump_(移動 system move)とは別物(移動 move 自身は is_aerial=0)。
const jumpHeavyCodePart = "jumping_heavy_"

// movementSystemCodes は移動 system move の code 集合(seedgen の movementSystemCodes と同期・9 種)。
// 相手技側では前入力・後ろ入力・微歩き・ダッシュ・ジャンプはいずれも反撃対象にならないため、
// これらと空中攻撃(is_aerial=1)は走査から完全除外する(手動確認レーンにも出さない。開発者確定 2026-07-24)。
var movementSystemCodes = map[string]bool{
	"forward":       true,
	"back":          true,
	"micro_forward": true,
	"micro_back":    true,
	"dash_forward":  true,
	"dash_back":     true,
	"jump_neutral":  true,
	"jump_forward":  true,
	"jump_back":     true,
}

// justParryExcludedCodes はジャストパリィタブの走査から完全に外す相手技の code。
//
// ★★ブロックタブからは外さない。外すのはジャストパリィタブだけである。
//
// drive_reversal(M31-04 / SM-098): 開発者の逐語(2026-09-08)は
//
//	「ドライブリバーサルは一律ガードフレームが-6になる。ジャストパリィは27F(特殊な技のため、
//	 他の技と算出法が違う可能性があるため記載。ただこの技をジャストパリィすることは
//	 ないので取り扱わなくてもいい)」
//
// ⇒ 27F という事実は moves.recovery に残す(捨てると次に誰かが同じことを調べ直す)。
// ⇒ 走査には出さない。本集合がその「出さない」の実体である。
//
// ★recovery を NULL のままにする案は採らなかった。それでは「出ない」にならず、
// 手動確認レーンへ reason=data_missing として出る(pass 1 の d/e 分岐)。
// 事実を捨てたうえに画面へ出る、という最悪の組み合わせになる。
var justParryExcludedCodes = map[string]bool{
	model.MoveCodeDriveReversal: true,
}

// verdictWhitelist は combo_punish_starters.verdict の許容値(DB CHECK は新設せず Go 側で担保)。
var verdictWhitelist = map[string]bool{
	model.PunishVerdictAdopted:     true,
	model.PunishVerdictUnreachable: true,
}

// guardTypeWhitelist は走査タブの許容値。
var guardTypeWhitelist = map[string]bool{
	model.PunishGuardTypeBlock:     true,
	model.PunishGuardTypeJustParry: true,
}

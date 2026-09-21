package model

// 確定反撃サーチ(M18-02)の列挙的文字列定数。
//
// リテラル文字列を実装各所に散在させず本パッケージへ集約する(CLAUDE.md §4)。
// フロントエンド側の対応定数は web/src/constants/punish.ts に同期する
// (バックエンドとの表記揺れ防止。新規値追加時は両側を同時更新すること)。

// PunishVerdict は combo_punish_starters.verdict の許容値(CHANGE-083)。
// DB CHECK は新設せず、サービス層の whitelist で担保する(CHANGE-082 方針)。
const (
	PunishVerdictAdopted     = "adopted"     // 検証済み・採用(この始動技で反撃できる)
	PunishVerdictUnreachable = "unreachable" // 検証済み・到達不能(距離的に届かない)
)

// PunishGuardType は走査タブ(有利フレームの算出根拠)を表す。
//   - block     : ガード後。有利フレーム = -(opponent_move.on_block)
//   - just_parry : ジャストパリィ後。有利フレーム = opponent_move.recovery
const (
	PunishGuardTypeBlock     = "block"
	PunishGuardTypeJustParry = "just_parry"
)

// PunishLane は始動技候補の判定根拠レーン(§4.3.3)。判定基準が異なるため
// 画面上でも別レーン/別バッジとして区別する(silent に混ぜない)。
const (
	PunishLaneGround = "ground" // 地上: startup <= 有利フレーム
	PunishLaneDash   = "dash"   // ダッシュ経由: 残り猶予 = 有利 - dash_forward.total
	PunishLaneJump   = "jump"   // ジャンプ経由: 有利 >= jump_forward.total - JUMP_SLACK
)

// PunishReason は相手技が手動確認レーンへ落ちた理由(§4.3.2 b〜f)。
// 除外された技は消さず、理由バッジ付きで手動確認レーンに表示する。
const (
	PunishReasonDistanceDependent = "distance_dependent" // c: is_projectile=1(距離依存)
	PunishReasonDataMissing       = "data_missing"       // d/e: on_block/recovery が NULL(有利フレーム算出不能)
	PunishReasonUnknownDamage     = "unknown_damage"     // b: damage IS NULL(0 と NULL は意味が違う)
	PunishReasonZeroRecovery      = "zero_recovery"      // f: recovery=0 かつ is_projectile=0(JP タブ)
)

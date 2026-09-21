// DES-005 §6.2 論理ボタン一覧に対応する論理ボタン。
//
// 注(M21-01 の実査で是正): 旧コメントは「14種」としていたが、これは §6.2 の**表の行数**であって
// 論理ボタンの個数ではない(同表は direction_1〜9 を 1 行にまとめ、かつ direction_neutral と 5 が
// 重複する)。
//
// ★件数(2026-08-14・M21-04 時点): **§6.2 の実個数は 22、本 union の実体は 26。**
//   - M21-01 時点は §6.2 = 21 / union = 25 で、差分 +4 は throw_forward / throw_back /
//     dash_forward / dash_back(指摘14・15 で追加され SYSTEM_BUTTON_TO_MOVE_CODE が実参照)。
//   - **M21-04 が `shortcut_prefix` を 1 件足したため、両方が +1 された**(CHANGE-108 の反映材料)。
//     同ボタンは技を出さず、ショートカットの前置きにのみ使う(features/gamepad/shortcut.ts)。
//
// この過不足は CHANGE-106 / CHANGE-108 の as-built として設計卓へ報告済みであり、DES-005 §6.2
// 本体の改訂は設計卓が行う(製造は設計書を直接編集しない = CLAUDE.md §8)。
// ★**union に枝を足したら、この注記の 2 つの数も同じ手番で直すこと。** 型検査では検出できない。
export type LogicalButton =
  | "direction_neutral" // 方向なし(5)
  | "direction_1"
  | "direction_2"
  | "direction_3"
  | "direction_4"
  | "direction_6"
  | "direction_7"
  | "direction_8"
  | "direction_9"
  | "light_punch"
  | "medium_punch"
  | "heavy_punch"
  | "light_kick"
  | "medium_kick"
  | "heavy_kick"
  | "drive_impact" // 強P+強K
  | "drive_parry" // 中P+中K
  | "throw" // 弱P+弱K → throw_forward を解決(§4.2.2、後方互換)
  | "throw_forward" // 前投げ(指摘14)
  | "throw_back" // 後ろ投げ(指摘14)
  | "dash_forward" // 前ステップ(指摘15、system 技として解決)
  | "dash_back" // 後ろステップ(指摘15、system 技として解決)
  | "parry_drive_rush" // 中P+中K中に6
  | "step_commit" // 現在の入力をステップ確定(M2 では未使用)
  | "step_delete" // 最後のステップを削除
  | "shortcut_prefix"; // ショートカットの前置き(M21-04。後続ボタンと組で操作を起こす)

export interface ControllerInputEvent {
  button: LogicalButton;
  timestamp: number; // フェーズ2の同時押し判定用、M2 では未使用
}

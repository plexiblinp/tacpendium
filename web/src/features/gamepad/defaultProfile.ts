// 標準配置の既定プロファイル（2026-08-13 開発者判断で追加）。
//
// ★なぜ既定を持つか
//   当初はどの機体でも初回に必ず 10 件（方向 4 ＋ 攻撃 6）を押させていた。これは「機体ごとの
//   決め打ちをやめる」（D-328）を純粋に守った形だが、**PoC で実測した 2 機種はいずれも
//   `mapping: "standard"` を返していた**——標準配置を名乗る機体には既定を当てられ、全利用者へ
//   登録作業を課す必要は無かった。実機確認で「毎回させるものか」という指摘が出たため導入する。
//
// ★これは「決め打ちへの逆戻り」ではない
//   1. 鍵にしているのは **W3C Standard Gamepad の仕様**であって、機種名でも `Gamepad.id` でもない。
//      機種名のハードコードや「対応機種一覧」は従来どおり 1 件も持たない。
//   2. **標準を要件にしていない。** 標準でない機体は弾かれず、従来どおりキャリブレーションへ
//      倒れる（指示書 §4.2-3「必須条件にしない」／§4.2-8「未知の機体でも動く」）。
//   3. **既定が外れていても上書きできる。** キャリブレーションはそのまま残っている。
//
// ★`normalize.ts` は引き続き `mapping` を一切読まない。標準の判定はプロファイル解決層だけで行う。
//   標準は「速い経路」であって「要件」ではない、という形を保つため。

import type { GamepadProfile, PhysicalBinding } from "./types";

/** `Gamepad.mapping` が標準配置を名乗る値。 */
export const STANDARD_MAPPING = "standard";

/**
 * W3C Standard Gamepad の D-pad。
 *
 * ★左スティック（axes 0/1）は既定に含めない。`PhysicalBinding` は 1 論理入力＝1 物理入力であり
 * 両方は持てないため、レバー・レバーレス・D-pad を既定に採る（本アプリの主用途）。
 * **スティックで入力したい利用者はキャリブレーションで上書きできる。**
 */
const STANDARD_DIRECTIONS: Record<"up" | "down" | "left" | "right", PhysicalBinding> = {
  up: { kind: "button", index: 12 },
  down: { kind: "button", index: 13 },
  left: { kind: "button", index: 14 },
  right: { kind: "button", index: 15 },
};

/**
 * SF6 のクラシック既定配置（標準配置の機体に対して）。
 *
 * ★これは実測ではなく SF6 の既定に基づく推測である。両機種が `mapping: "standard"` を返すことは
 * PoC で実測済みだが、**standard の各 index にどの物理ボタンが割り当たるかは機体のファーム次第**
 * である。外れても弾かず、キャリブレーションで上書きできる形は維持している。
 *
 *   弱P = □(2) / 中P = △(3) / 強P = R1(5)
 *   弱K = ×(0) / 中K = ○(1) / 強K = R2(7)
 */
const STANDARD_ATTACKS: Record<string, PhysicalBinding> = {
  light_punch: { kind: "button", index: 2 },
  medium_punch: { kind: "button", index: 3 },
  heavy_punch: { kind: "button", index: 5 },
  light_kick: { kind: "button", index: 0 },
  medium_kick: { kind: "button", index: 1 },
  heavy_kick: { kind: "button", index: 7 },
};

/** 当該機体に標準配置の既定を当てられるか。 */
export function supportsStandardDefault(mapping: string): boolean {
  return mapping === STANDARD_MAPPING;
}

/**
 * 標準配置の既定プロファイルを作る。
 *
 * ★マクロ（DI / DP / 投げ）は**含めない**。コントローラ側・ゲーム側で利用者が任意に割り当てる
 * ものであり、推測で当てると誤った割当が黙って入る。**空のままにして「マクロだけ登録する」導線を
 * 用意する**（`GamepadCalibrationDialog` の部分キャリブレーション）。
 */
export function createStandardProfile(
  browserKey: string,
  padId: string,
): GamepadProfile {
  return {
    version: 1,
    padId,
    browserKey,
    directions: { ...STANDARD_DIRECTIONS },
    buttons: { ...STANDARD_ATTACKS },
  };
}

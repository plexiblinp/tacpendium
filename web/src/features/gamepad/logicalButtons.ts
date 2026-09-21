// 論理ボタンの定義と、キャリブレーションの案内順・表示ラベル（M21-01）。
//
// ★論理ボタンの型は新設せず、既存の仮想コントローラの LogicalButton を正本として再利用する。
// 理由: 物理側で別の内部表現を作ると、M21-03（レシピへのステップ追加）で 2 つを突き合わせる
// 羽目になるため（指示書 §3.3-2「既存に寄せられるなら寄せる」）。
//
// ★既存 LogicalButton の direction_* / 攻撃ボタン枝は、現行の仮想コントローラ UI からは参照が
// 無い（実査済み。消費されているのは useControllerInput.handleSystemButton のシステム技枝のみ）。
// 本サブがその枝の最初の消費者になる。

import type { LogicalButton } from "@/features/combo/components/VirtualController/controllerTypes";

import type {
  CalibrationButton,
  CalibrationTarget,
  DirectionCardinal,
} from "./types";
import {
  ACTION_BUTTONS,
  ATTACK_BUTTONS,
  DIRECTION_CARDINALS,
  OPTIONAL_BUTTONS,
} from "./types";

/**
 * テンキー方向（1P 側 = 右向き基準。6 = 前、4 = 後ろ）。
 * 既存 inputResolutionStage2.ts の NumpadDirection と同じ流儀で、左右反転（2P 側）は非対応。
 */
export type NumpadDigit = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

const NUMPAD_TO_LOGICAL: Record<NumpadDigit, LogicalButton> = {
  1: "direction_1",
  2: "direction_2",
  3: "direction_3",
  4: "direction_4",
  5: "direction_neutral",
  6: "direction_6",
  7: "direction_7",
  8: "direction_8",
  9: "direction_9",
};

export function numpadToLogicalButton(digit: NumpadDigit): LogicalButton {
  return NUMPAD_TO_LOGICAL[digit];
}

/**
 * 上下左右の押下状態 → テンキー方向。
 *
 * 斜めは 2 つの同時状態から導出する（1 スナップショット内の状態合成であり、M21-02 が持つ
 * 「時間窓」の判定ではない）。
 *
 * ★同時に相反する方向が来た場合（SOCD）の扱い＝**左右は相殺してニュートラル・上下は上優先**。
 *   M21-01 では「推測の既定」として置いていたが、**M21-02 がこれを規則として採った**
 *   （`stepDetection.ts` の `resolveDirection` が本関数へ委譲する。M21-02 指示書 §4.5-2）。
 *   採った理由は、SOCD クリーナの慣行として広く使われており実機の多くがハードウェア側で
 *   同じ処理を済ませていること、および処理済みの機体では発火せず未知の機体でだけ効く
 *   安全弁になることの 2 点。
 *
 *   ★**実測は無い**。PoC（`M21-RESEARCH-01`）は SOCD を課題に含めておらず、**未計測**である
 *   （「観測されなかった」ではない＝`E-84`）。
 */
export function cardinalsToNumpad(held: {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}): NumpadDigit {
  // 左右: 同時なら相殺
  const horizontal = held.left === held.right ? 0 : held.right ? 1 : -1;
  // 上下: 同時なら上優先
  const vertical = held.up ? 1 : held.down ? -1 : 0;

  if (vertical > 0) return horizontal < 0 ? 7 : horizontal > 0 ? 9 : 8;
  if (vertical < 0) return horizontal < 0 ? 1 : horizontal > 0 ? 3 : 2;
  return horizontal < 0 ? 4 : horizontal > 0 ? 6 : 5;
}

// ---------------------------------------------------------------------------
// キャリブレーションの案内順
// ---------------------------------------------------------------------------

/**
 * 必須区間 = 方向 4 ＋ 攻撃 6 の計 10。ここまで埋まれば実用になる。
 * ★指示書 §4.3-2「全部を埋めないと使えない形にしない」に対応する区切りである。
 */
export const REQUIRED_TARGETS: readonly CalibrationTarget[] = [
  ...DIRECTION_CARDINALS,
  ...ATTACK_BUTTONS,
] as const;

/**
 * 任意区間 = マクロ ＋ 操作用ボタン。専用ボタンを持つ機体だけが登録すればよい。
 *
 * ★M21-04 で `ACTION_BUTTONS`（ショートカットの前置き 1 件）が加わり、
 *   案内順の全体は 13 → **14** になった（`DES-005` §6.3.2 の件数が動く＝`CHANGE-108` の反映材料）。
 * ★**増えた分は必須ではない**（`REQUIRED_TARGETS` は方向 4 ＋ 攻撃 6 の 10 件のまま）。
 *   登録しなくても M21-03 までの入力は一切変わらない（指示書 §4.3-3 / §4.4-2）。
 */
export const OPTIONAL_TARGETS: readonly CalibrationTarget[] = [
  ...OPTIONAL_BUTTONS,
  ...ACTION_BUTTONS,
] as const;

/** 案内順の全体。必須 → 任意の順に並べる。 */
export const CALIBRATION_ORDER: readonly CalibrationTarget[] = [
  ...REQUIRED_TARGETS,
  ...OPTIONAL_TARGETS,
] as const;

export function isRequiredTarget(target: CalibrationTarget): boolean {
  return REQUIRED_TARGETS.includes(target);
}

export function isDirectionCardinal(
  target: CalibrationTarget,
): target is DirectionCardinal {
  return (DIRECTION_CARDINALS as readonly string[]).includes(target);
}

// ---------------------------------------------------------------------------
// 表示ラベル（日本語）
// ---------------------------------------------------------------------------

// ★案内は物理的な向き（左／右）で書く。前／後ろは 1P 側を向いているときだけ成り立つ
// 相対的な呼び方であり、利用者がいま押す物理ボタンを指す語としては曖昧なため
// （2026-08-13 開発者判断）。テンキーの 4 = 後ろ / 6 = 前 という内部規約は変えていない。
const DIRECTION_LABEL: Record<DirectionCardinal, string> = {
  up: "上",
  down: "下",
  left: "左",
  right: "右",
};

const BUTTON_LABEL: Record<CalibrationButton, string> = {
  light_punch: "弱パンチ",
  medium_punch: "中パンチ",
  heavy_punch: "強パンチ",
  light_kick: "弱キック",
  medium_kick: "中キック",
  heavy_kick: "強キック",
  drive_impact: "ドライブインパクト",
  drive_parry: "ドライブパリィ",
  throw: "投げ",
  // ★M21-04。技のボタンではなく「ショートカットを起こすために先に押すボタン」である。
  //   案内では「スタート/オプション等、技に使っていないボタン」を押させる想定
  //   （どのボタンを使うかは登録で決まり、機体ごとの決め打ちはしない＝指示書 §4.2′-6）。
  shortcut_prefix: "ショートカット前置き",
};

export function calibrationTargetLabel(target: CalibrationTarget): string {
  return isDirectionCardinal(target)
    ? DIRECTION_LABEL[target]
    : BUTTON_LABEL[target];
}

// 上の BUTTON_LABEL を「任意の論理ボタンで引ける表」として見るための別名。
// ★`as CalibrationButton` のアサーションを避けるために置く（アサーションは、対象外の論理ボタンを
//   渡したときに型が嘘をつく）。BUTTON_LABEL 自体は Record<CalibrationButton, string> のままで、
//   キャリブレーション対象が増えたらラベル漏れが型で赤くなる網羅性は保たれる。
const BUTTON_LABEL_BY_KEY: Readonly<Partial<Record<string, string>>> =
  BUTTON_LABEL;

/**
 * 論理ボタンの表示ラベル（M21-03 の読取表示で使う）。
 *
 * ★ラベル表は上の BUTTON_LABEL 1 つだけである。読取表示側に第 2 の表を作らない（`E-76`）。
 * ★方向は本関数の対象外——読取表示はテンキー数字で出す（仮想コントローラの方向ラベルを
 *   写すと 2 か所に同じ表を持つことになるため）。
 * ★ラベルを持たない論理ボタン（`throw_forward` / `dash_*` / `step_*` 等）は識別子をそのまま
 *   返す。**現状これらは押下集合に入らない**が、対象を広げるときはラベルを足すこと。
 * ★`shortcut_prefix` はラベルを持つ（キャリブレーションの案内で使う）が、**押下集合には
 *   入らない**——`normalizeSnapshot` が `states` ではなく `actions` へ入れるため、読取表示の
 *   「押している入力」には現れない（M21-04）。
 */
export function logicalButtonLabel(button: LogicalButton): string {
  return BUTTON_LABEL_BY_KEY[button] ?? button;
}

/** data-testid の識別子部分（既存の recipe-* 規約に合わせてケバブケース化）。 */
export function calibrationTargetSlug(target: CalibrationTarget): string {
  return target.replace(/_/g, "-");
}

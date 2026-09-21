// ショートカット（前置きボタン ＋ 後続ボタン）の定義（M21-04・`DES-005` §6.5）。
//
// ★方式は開発者裁定で確定している（**D-358**）——**前置きボタンを押してから後続ボタンを押す
//   順次入力**であり、**同時押しではない**。理由は、開始ボタン等が他のボタンより固いことが多く、
//   押し切りの遅れが `M21-02` の同時押し判定窓（90 ms）へそのまま出るため
//   （`DES-005` §6.4.2 の実測＝押し始めのズレ 中央値 8.30 ms / 最大 45.80 ms）。
//   ⇒ 本ファイルの定義は `stepDetection` の判定窓を一切通らない。
//
// ★本ファイルは純粋な定義だけを持つ。React にも navigator にも触らない。
//
// ★「1 ボタン ＝ 1 操作」の対応表ではない。物理側に登録するのは**前置き 1 件だけ**であり、
//   後続は**既に登録済みの攻撃ボタン**を流用する（`D-358` の利得 1＝登録の増分が最小になる）。

import { logicalButtonLabel } from "./logicalButtons";
import type { CalibrationButton, LogicalButton } from "./types";

/**
 * 物理入力から起こせる操作（**★4 値**。`M21-06` で 1 つ増えた）。
 *
 * ★**列挙はここ 1 か所だけである。** Gamepad（前置き ＋ 後続ボタン）とキーボード（キーへ直接
 *   割り当て）は**同じ型を参照する**——キーボード用の列挙を別に作ると、操作を 1 つ足すたびに
 *   2 か所を直すことになり、片方だけ古くなる（`E-76`。`DES-005` §6.5）。
 *
 * ★**`D-370` の「操作の種別は 3 値。増やさない」は `M21-05` 時点の as-built であって恒久の
 *   上限ではない**（**D-377**）。`M21-06` が `command_mode` を足したのは正当である。
 *   **守るべきは「1 か所で定義し、両側が同じものを参照する」ことのほうである。**
 *
 * ★対象外が 2 つある。**理由が違うので混ぜないこと**——
 * - **並び替え**: **機能そのものを本サブで作らない**（**D-358**）。後続は followup
 *   `controller-complete-input-reorder`。
 * - **ステップの追加確定**: **機能が要らないのではなく、既に別の形で実現されている**
 *   （**D-364**）。判定窓が閉じた時点の自動確定（`M21-02` / `M21-03`）に置き換わっており、
 *   明示的な確定は実機で 10 回とも空振りした。**⇒「落とした」ではなく「置き換わった」。**
 */
export type PhysicalInputActionKind =
  | "delete"
  | "save"
  | "modifier"
  /**
   * コマンド技入力モードの開始／終了（`M21-06` §4.1-1）。**切替である。**
   *
   * ★モードに入っていない間は今までどおり（方向 1 つ ＝ ステップ 1 つ）。
   * ★**時間で切れない**（§4.1-3）。`SHORTCUT_PREFIX_TIMEOUT_MS` のような値を持たせないこと——
   *   持たせると「非常にゆっくりでも解決される」という要件そのものが壊れる。
   */
  | "command_mode";

/**
 * 前置きに使う論理ボタン。★どの物理ボタンを当てるかは登録で決まる（決め打ちしない）。
 * ★`CalibrationButton` として持つ（`GamepadProfile.buttons` の索きに使うため）。
 */
export const SHORTCUT_PREFIX_BUTTON: CalibrationButton = "shortcut_prefix";

/**
 * 前置き状態が自動で解除されるまでの時間（ミリ秒）。
 *
 * ★前置きだけ押して止まったまま入力できなくなる形にしないための安全弁である
 *   （指示書 §4.2′-4）。抜ける経路は 3 つ＝**操作の実行 / 前置きの再押下 / 本タイムアウト**。
 * ★`M21-02` の判定窓（90 ms）とは無関係の別物である。混同して同じ値にしないこと。
 */
export const SHORTCUT_PREFIX_TIMEOUT_MS = 2000;

export interface ShortcutAssignment {
  /** 後続ボタン。★攻撃 6 ボタンから選ぶ（既にキャリブレーション済みであるため）。 */
  button: CalibrationButton;
  action: PhysicalInputActionKind;
}

/**
 * 前置きのあとに押すボタンと、起きる操作の対応（**唯一の表**）。
 *
 * ★**削除だけキック段へ離してある。** 削除は誤爆の被害が最も大きい操作であり（指示書 §4.2-2）、
 *   他をパンチ段に固めることで、隣接ボタンの押し間違いが削除へ落ちる確率を下げている。
 *   なお 2 段階入力であること自体も誤爆への防御になっている（`D-358` の利得 3）。
 * ★どのボタンを充てるかは指示書 §9.2-2 で製造へ委ねられている。変更するならこの表だけを直す。
 *
 * ★**弱P は意図的に空けてある**（**D-364** で「ステップの追加確定」を撤去したため）。
 *   **空いたからといって別の操作を入れないこと**（`M21-04` 指示書 §4.7-1）——**並び替えは
 *   対象外のままであり**（**D-358**）、**「空きがあるから何か入れる」形にすると当該サブの
 *   スコープを越える。** 前置き中に弱P を押しても何も起きないが、そのとき画面には割当一覧が
 *   出ているため読み取れる。
 *
 * ★**`M21-06` が弱K へ `command_mode` を足した。弱P は空けたままである**——
 *   「空いていたから埋めた」のではなく、`DES-005` §6.5 が定める新しい操作を 1 つ足したためで
 *   ある（`CHANGE-109`）。**弱K を選んだ理由**＝削除（強K）から最も遠いキック段の端であり、
 *   中K に置くと削除の隣になって**押し間違いが削除へ落ちる確率を上げる**（上記の配置意図）。
 */
export const SHORTCUT_ASSIGNMENTS: readonly ShortcutAssignment[] = [
  { button: "medium_punch", action: "modifier" },
  { button: "heavy_punch", action: "save" },
  { button: "heavy_kick", action: "delete" },
  { button: "light_kick", action: "command_mode" },
] as const;

/** 操作の表示名。★読取表示・案内文はここだけを引く（同じ語を 2 か所に置かない＝`E-76`）。 */
export const ACTION_LABEL: Record<PhysicalInputActionKind, string> = {
  delete: "削除",
  save: "保存",
  modifier: "修飾",
  command_mode: "コマンド技入力",
};

const FOLLOW_UP_TO_ACTION: Partial<Record<LogicalButton, PhysicalInputActionKind>> =
  Object.fromEntries(
    SHORTCUT_ASSIGNMENTS.map(({ button, action }) => [button, action]),
  );

/** 後続ボタンが起こす操作。ショートカットに割り当てていないボタンなら null。 */
export function actionForFollowUp(
  button: LogicalButton,
): PhysicalInputActionKind | null {
  return FOLLOW_UP_TO_ACTION[button] ?? null;
}

/**
 * 前置き中の案内文（「続けて何を押せばよいか」）。
 *
 * ★ボタン名と操作名はそれぞれ既存の 1 表から引く。案内用の第 2 の表を作らない（`E-76`）。
 */
export const SHORTCUT_FOLLOW_UP_HINT: string = SHORTCUT_ASSIGNMENTS.map(
  ({ button, action }) => `${logicalButtonLabel(button)}=${ACTION_LABEL[action]}`,
).join(" / ");

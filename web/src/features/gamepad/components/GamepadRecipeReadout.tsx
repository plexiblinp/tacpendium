// 物理入力の読取表示（M21-03 §4.3・`FR106`）。
//
// ★**現在 5 区画である**（区画は増えてきた。件数を書き写す側の記述を足さないこと）——
//   (1) いま押されている入力（生の状態） (2) 確定したステップ
//   (3) 解決できなかった入力（§9.2-1 の設計卓の見込みどおりの 3 区画）
//   (4) ショートカットの前置き状態と直前の操作の結果（M21-04）
//   (5) コマンド技入力モードの状態と、モードで確定／確定できなかった入力（M21-06）。
// ★**別の表示系を新設せず本コンポーネントへ足す**（同じ情報を 2 か所へ出さない＝`E-76`）。
// ★(3) が要件である。黙って捨てると、利用者は「入力されなかった」と「解決できなかった」を
//   区別できない（`E-84` の同型）。
// ★本コンポーネントは表示だけを持つ。解決は recipeInputResolution が済ませてある。

import type { Move } from "@/features/moves/types";

import { logicalButtonLabel } from "../logicalButtons";
import { numpadFromDirection } from "../recipeInputResolution";
import type { UnresolvedReason } from "../recipeInputResolution";
import type { MotionUnresolvedReason } from "@/features/physical-input/commandMotion";
import type {
  CommandModeState,
  HeldInput,
  ShortcutState,
} from "@/features/physical-input/PhysicalInputProvider";
import { ACTION_LABEL, SHORTCUT_FOLLOW_UP_HINT } from "../shortcut";
import type { PhysicalInputActionKind } from "../shortcut";
import type {
  MotionReadoutEntry,
  PhysicalInputActionOutcome,
  PhysicalInputActionResult,
  ReadoutEntry,
} from "@/features/physical-input/usePhysicalRecipeInput";

// 解決できなかった理由の説明。★「なぜ入らなかったか」が分かる語で書く。
const UNRESOLVED_LABEL: Record<UnresolvedReason, string> = {
  od_not_supported:
    "同じ種類のボタン 2 つ（OD）は、物理コントローラからは入れられません。必殺技タブから選んでください",
  mixed_strength: "強度の違うボタンの同時押しは技を特定できません",
  too_many_buttons: "3 つ以上の同時押しは技を特定できません",
  unknown_combination: "この組み合わせに対応する操作がありません",
  move_not_found: "このキャラクターに該当する技がありません",
  rush_not_available_in_air: "ラッシュ版は空中では出せません",
};

// ショートカット操作が効かなかった理由（M21-04 §4.5-3）。★黙って何も起きない形にしない。
// ★操作名（`ACTION_LABEL`）と連結して 1 文にする。
const ACTION_OUTCOME_LABEL: Record<PhysicalInputActionOutcome, string> = {
  done: "しました",
  no_target: "する対象がありません",
  unavailable: "はこの面では行えません",
  blocked: "できる状態ではありません",
};

// ★成功時だけは連結では正確にならない操作がある。
//   修飾は「修飾しました」だと**何かが適用された**と読まれるが、実際に起きるのは
//   既存の編集ダイアログを開いたことだけである（値を決めるのは利用者＝`DES-003` §3.5）。
const ACTION_DONE_LABEL: Partial<Record<PhysicalInputActionKind, string>> = {
  modifier: "修飾の編集を開きました",
};

function actionResultText(result: PhysicalInputActionResult): string {
  if (result.outcome === "done") {
    return (
      ACTION_DONE_LABEL[result.action] ??
      `${ACTION_LABEL[result.action]}${ACTION_OUTCOME_LABEL.done}`
    );
  }
  return `${ACTION_LABEL[result.action]}${ACTION_OUTCOME_LABEL[result.outcome]}`;
}

// コマンド技入力モードで解決できなかった理由（M21-06 §4.2-7）。
// ★「なぜ入らなかったか」が分かる語で書く。★文言は「物理入力」で書く（`DES-005` §6.4.3）。
const MOTION_UNRESOLVED_LABEL: Record<MotionUnresolvedReason, string> = {
  ambiguous:
    "同じコマンドの技が複数あるため 1 つに決められません（必殺技タブから選んでください）",
  no_match: "この方向の並びに一致するコマンドがありません",
  abandoned: "モードを抜けたため確定していません",
  // ★利用者の入力ミスではなくデータの不整合である。「一致しない」と書くと嘘になる。
  move_not_found: "コマンドは判別できましたが、このキャラクターに該当する技がありません",
};

interface Props {
  held: HeldInput;
  /** 確定したステップ（新しいものが先頭）。 */
  resolved: ReadoutEntry[];
  /** 解決できなかった入力（新しいものが先頭）。★上限は区画ごとに独立している。 */
  unresolved: ReadoutEntry[];
  moves: Move[];
  /** この面が物理入力の受け手か。受け手でなければその旨を出す。 */
  active: boolean;
  /** 前置き（ショートカット）の状態。 */
  shortcut: ShortcutState;
  /** 直前のショートカット操作の結果。 */
  lastAction: PhysicalInputActionResult | null;
  /** コマンド技入力モードの状態（M21-06）。 */
  commandMode: CommandModeState;
  /** モードが使えるか（＝索引を取得できているか）。★false は失敗ではなく状態である。 */
  commandModeAvailable: boolean;
  /** モードで確定した／確定できなかった入力（新しいものが先頭）。 */
  motionReadout: MotionReadoutEntry[];
}

function moveLabel(moves: Move[], moveId: number | undefined, fallback: string) {
  if (moveId == null) return fallback;
  const move = moves.find((m) => m.id === moveId);
  return move?.nameJa ?? move?.code ?? fallback;
}

export default function GamepadRecipeReadout({
  held,
  resolved: resolvedEntries,
  unresolved: unresolvedEntries,
  moves,
  active,
  shortcut,
  lastAction,
  commandMode,
  commandModeAvailable,
  motionReadout,
}: Props) {
  const heldDirection = numpadFromDirection(held.direction);

  return (
    <div
      className="space-y-1.5 rounded border border-gray-300 bg-white p-2 text-xs"
      data-testid="recipe-gamepad-readout"
    >
      {/* (1) いま押されている入力 */}
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="font-medium text-gray-700">押している入力</span>
        <span
          className="font-mono text-gray-900"
          data-testid="recipe-gamepad-readout-held"
        >
          {heldDirection}
          {held.buttons.length > 0
            ? ` ＋ ${held.buttons.map(logicalButtonLabel).join(" ＋ ")}`
            : ""}
        </span>
        {!active && (
          <span
            className="text-gray-500"
            data-testid="recipe-gamepad-readout-inactive"
          >
            （この面は受付中ではありません）
          </span>
        )}
      </div>

      {/* (2) 確定したステップ */}
      <div data-testid="recipe-gamepad-readout-resolved">
        <span className="font-medium text-gray-700">確定したステップ</span>
        {resolvedEntries.length === 0 ? (
          <span className="ml-2 text-gray-400">まだありません</span>
        ) : (
          <ol className="mt-0.5 space-y-0.5">
            {resolvedEntries.map((entry) => {
              const resolution = entry.resolution;
              if (resolution.status !== "resolved") return null;
              return (
                <li key={entry.key} className="font-mono text-gray-900">
                  {moveLabel(
                    moves,
                    resolution.step.moveId,
                    resolution.step.moveCode ?? "?",
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {/* (4) ショートカット（前置き ＋ 後続）。★前置き中であることを出さないと、利用者からは
              「前置きを押したあとの入力が消えた」ように見える（M21-04 §4.2′-5 / §4.5-1′） */}
      <div data-testid="recipe-gamepad-readout-shortcut">
        <span className="font-medium text-gray-700">ショートカット</span>
        {shortcut.active ? (
          <span className="ml-2 font-medium text-blue-700">
            前置き中 — 続けて {SHORTCUT_FOLLOW_UP_HINT}
          </span>
        ) : shortcut.available ? (
          <span className="ml-2 text-gray-500">
            前置きボタンを押すと {SHORTCUT_FOLLOW_UP_HINT}
          </span>
        ) : (
          /* ★「割り当てられるボタンが無い」ことを失敗ではなく状態として出す（§4.4-3）。
             ★★M37-02（B11）: 説明句〔（コントローラ設定で「ショートカット前置き」を
               登録すると使えます）〕を落とした。**状態そのものは残す** ——
               区画ごと消すと §4.4-3 の要件を破る（落とすのは説明であって状態ではない）。
               ⇒ 指示書 §2.3 の基準「*状態が変わらない*案内文」に忠実な形である。 */
          <span
            className="ml-2 text-gray-500"
            /* ★★M37-02 レビュー 中-4 の是正: 短縮で失われたのは「案内文」ではなく
                 **復旧手順**（どうすれば使えるようになるか）であった。⇒ 消さずに
                 `title` へ逃がす。縦は 1px も増えない。 */
            title="コントローラ設定で「ショートカット前置き」を登録すると使えます"
          >
            未登録
          </span>
        )}
        {lastAction !== null && (
          <span
            className="ml-2 text-gray-900"
            data-testid="recipe-gamepad-readout-action"
          >
            — {actionResultText(lastAction)}
          </span>
        )}
      </div>

      {/* (5) コマンド技入力モード（M21-06 §4.1-6）。★溜まっている列を出さないと、利用者は
              何が溜まっているか分からない。★モードは時間で切れないため、表示も勝手に消えない */}
      <div data-testid="recipe-gamepad-readout-command">
        <span className="font-medium text-gray-700">コマンド技入力</span>
        {!commandModeAvailable ? (
          /* ★「索引を取得できていない」ことを失敗ではなく状態として出す（§4.6-6）。
             ★★M37-02（B11）: 「このキャラクターの」を落として 1 行に収まる長さにした。
               **状態そのものは残す**（上の §4.4-3 と同じ理由）。 */
          <span
            className="ml-2 text-gray-500"
            title="このキャラクターのコマンド表を取得できていないため使えません"
          >
            コマンド表を取得できていないため使えません
          </span>
        ) : commandMode.active ? (
          <span className="ml-2 font-medium text-blue-700">
            入力中 —{" "}
            <span
              className="font-mono"
              data-testid="recipe-gamepad-readout-command-directions"
            >
              {commandMode.directions.length === 0
                ? "（方向を入力してください）"
                : commandMode.directions.join("")}
            </span>{" "}
            ＋ 攻撃ボタンで確定
          </span>
        ) : (
          <span className="ml-2 text-gray-500">
            {ACTION_LABEL.command_mode}の操作で切り替えます
          </span>
        )}
        {motionReadout.length > 0 && (
          <ol className="mt-0.5 space-y-0.5">
            {motionReadout.map((entry) => (
              <li
                key={entry.key}
                className={
                  entry.resolution.status === "resolved"
                    ? "text-gray-900"
                    : "text-amber-800"
                }
              >
                <span className="font-mono">
                  {entry.directions === "" ? "（方向なし）" : entry.directions}
                  {entry.button !== null
                    ? ` ＋ ${logicalButtonLabel(entry.button)}`
                    : ""}
                </span>
                <span className="ml-1">
                  {entry.resolution.status === "resolved"
                    ? `— ${entry.moveLabel ?? entry.resolution.moveCode}`
                    : /* ★理由は必ず出す。モードを抜けて捨てた列も `abandoned` として
                         同じ経路で出る（§4.1-7・`E-84`） */
                      `— ${MOTION_UNRESOLVED_LABEL[entry.resolution.reason]}`}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* (3) 解決できなかった入力。★黙って捨てない（§4.3-3） */}
      <div data-testid="recipe-gamepad-readout-unresolved">
        <span className="font-medium text-gray-700">
          解決できなかった入力
        </span>
        {unresolvedEntries.length === 0 ? (
          <span className="ml-2 text-gray-400">ありません</span>
        ) : (
          <ol className="mt-0.5 space-y-0.5">
            {unresolvedEntries.map((entry) => {
              const resolution = entry.resolution;
              if (resolution.status !== "unresolved") return null;
              return (
                <li key={entry.key} className="text-amber-800">
                  <span className="font-mono">
                    {resolution.direction}
                    {resolution.buttons.length > 0
                      ? ` ＋ ${resolution.buttons.map(logicalButtonLabel).join(" ＋ ")}`
                      : ""}
                  </span>
                  <span className="ml-1">
                    — {UNRESOLVED_LABEL[resolution.reason]}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}

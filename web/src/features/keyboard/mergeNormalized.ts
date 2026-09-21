// 2 つの供給元（Gamepad ／ キーボード）を 1 本の押下集合へ合流させる（M21-05 §4.6-3・§4.6-4）。
//
// ★**なぜ合流が要るか。** 判定層は「1 本の押下集合の**差分**」で立ち上がりを採る
//   （`stepDetection.ts` の `rising = current \ state.held`）。⇒ 2 つの供給元が各自の押下集合を
//   独立に push すると、**片方の push がもう片方を「離した」と見せる**。
//   パッドで強P を押したままキーを 1 つ叩くと、強P が離されたことになり、次にパッド側の
//   サンプルが来た瞬間に強P が**もう一度**立ち上がる——押していないステップが増える。
//
// ★**⇒ 供給側で形を合わせる**（§4.5-4）。判定層・受け手の調停・操作の配送は 1 組のままであり、
//   増えるのは供給元の数だけである。**「キーボードモード」を作らない**（§4.6-4／重大 14）——
//   どちらからでも入り、同時に使ってもよい。
//
// ★本ファイルは純粋関数だけで構成する。

import { cardinalsToNumpad, numpadToLogicalButton } from "@/features/gamepad/logicalButtons";
import type {
  CardinalState,
  DirectionCardinal,
  LogicalButton,
  LogicalButtonState,
  NormalizeResult,
} from "@/features/gamepad/types";
import { DIRECTION_CARDINALS } from "@/features/gamepad/types";

const DIRECTION_BUTTON_PREFIX = "direction_";

function isDirectionButton(button: LogicalButton): boolean {
  return button.startsWith(DIRECTION_BUTTON_PREFIX);
}

/** 同じ論理ボタンが両源から来た場合の合成（押されていれば押下、アナログ量は大きいほう）。 */
function mergeState(
  a: LogicalButtonState,
  b: LogicalButtonState,
): LogicalButtonState {
  return {
    button: a.button,
    pressed: a.pressed || b.pressed,
    value: Math.max(a.value, b.value),
    // ★由来は「押しているほう」を優先する。どちらも押していなければ先着を残す。
    source: b.pressed && !a.pressed ? b.source : a.source,
  };
}

function mergeStateLists(
  a: readonly LogicalButtonState[],
  b: readonly LogicalButtonState[],
): LogicalButtonState[] {
  const merged: LogicalButtonState[] = [];
  const indexByButton = new Map<LogicalButton, number>();

  for (const list of [a, b]) {
    for (const state of list) {
      const at = indexByButton.get(state.button);
      if (at === undefined) {
        indexByButton.set(state.button, merged.length);
        merged.push(state);
        continue;
      }
      merged[at] = mergeState(merged[at], state);
    }
  }
  return merged;
}

/** 上下左右を OR する。★どちらか一方だけが方向を持つ場合はその値をそのまま採る。 */
function mergeCardinals(
  a: Record<DirectionCardinal, CardinalState> | undefined,
  b: Record<DirectionCardinal, CardinalState> | undefined,
): Record<DirectionCardinal, CardinalState> | undefined {
  if (a === undefined) return b;
  if (b === undefined) return a;

  const merged = {} as Record<DirectionCardinal, CardinalState>;
  for (const cardinal of DIRECTION_CARDINALS) {
    const left = a[cardinal];
    const right = b[cardinal];
    merged[cardinal] = {
      pressed: left.pressed || right.pressed,
      value: Math.max(left.value, right.value),
      source: right.pressed && !left.pressed ? right.source : left.source,
    };
  }
  return merged;
}

/**
 * 2 つの正規化結果を 1 つへ合流させる。
 *
 * ★**方向は合流後の上下左右から採り直す**（両源の digit を比べて選ぶのではない）。
 *   理由——パッドで 6、キーボードで 2 を入れているとき、正しい答えは `3`（下前）であって
 *   「どちらかの digit」ではない。**SOCD と斜めの導出は `cardinalsToNumpad` の 1 か所のまま**であり、
 *   合流によって規則が 2 つに増えることはない。
 *
 * ★どちらも `resolved: false`（＝Gamepad 未キャリブレーション かつ キーボード未登録）なら、
 *   合流結果も未解決である。判定層はこれを空の押下集合として扱う。
 */
export function mergeNormalized(
  a: NormalizeResult | null,
  b: NormalizeResult | null,
): NormalizeResult {
  const left = a?.resolved === true ? a : null;
  const right = b?.resolved === true ? b : null;

  if (left === null && right === null) return { states: [], resolved: false };
  if (left === null) return right as NormalizeResult;
  if (right === null) return left;

  const cardinals = mergeCardinals(left.cardinals, right.cardinals);

  // 方向以外を先に合流する。方向は合流後の cardinals から作り直すため、ここでは落とす。
  const buttons = mergeStateLists(
    left.states.filter((s) => !isDirectionButton(s.button)),
    right.states.filter((s) => !isDirectionButton(s.button)),
  );

  const states: LogicalButtonState[] = [];
  if (cardinals !== undefined) {
    const held = {
      up: cardinals.up.pressed,
      down: cardinals.down.pressed,
      left: cardinals.left.pressed,
      right: cardinals.right.pressed,
    };
    const digit = cardinalsToNumpad(held);
    const anyHeld = held.up || held.down || held.left || held.right;
    const isDiagonal = digit === 1 || digit === 3 || digit === 7 || digit === 9;

    // ★**`normalize.ts` と同じ規則で採ること**（値の出どころを 2 通りにしない）。
    //   - `value`  : **押されている** cardinal のうち最大（押されていない軸の残留アナログ量を混ぜない）
    //   - `source` : 押された cardinal を順に見て**最後**に当たったもの（`normalize.ts` のループが
    //                `directionSource` を上書きしていく形と一致させる）
    //   ★食い違わせると、**キーボードが一度でもイベントを出したセッションだけ方向の値が変わる**。
    //     判定は今日この値を読まないが、読むようになった瞬間に再現困難な形で表面化する
    //     （§4.5-4 が塞いだ「as-built が 2 通りになる」ことの供給層側での再発）。
    const pressedCardinals = DIRECTION_CARDINALS.filter(
      (c) => cardinals[c].pressed,
    );
    const directionSource =
      pressedCardinals.length === 0
        ? undefined
        : cardinals[pressedCardinals[pressedCardinals.length - 1]].source;

    states.push({
      button: numpadToLogicalButton(digit),
      pressed: true,
      value: anyHeld
        ? Math.max(...pressedCardinals.map((c) => cardinals[c].value))
        : 0,
      source:
        !anyHeld || isDiagonal || directionSource === undefined
          ? "derived"
          : directionSource,
    });
  }
  states.push(...buttons);

  return {
    states,
    cardinals,
    actions: mergeStateLists(left.actions ?? [], right.actions ?? []),
    resolved: true,
  };
}

// Gamepad のスナップショット → 論理ボタン集合への正規化（M21-01 §4.2。★本サブの中核）。
//
// ★本ファイルは純粋関数だけで構成する。navigator にも window にも触らない（指示書 §4.2-2）。
//   ⇒ テストから Firefox 形の入力を直接食わせられる（§5.1(b)）。開発者の Firefox 実機確認は
//     M21 完了時の 1 回だけであり、Firefox 形の正しさを担保するのはこのテストだけである。
//
// ★buttons / axes の index はこのファイルに 1 つも直書きしない（指示書 §4.6-3）。
//   index はすべて GamepadProfile（＝キャリブレーションの結果）に由来する。
//
// ★mapping === "standard" を必須条件にしない（指示書 §4.2-3）。本ファイルは mapping を一切見ない。

import { cardinalsToNumpad, numpadToLogicalButton } from "./logicalButtons";
import type {
  CardinalState,
  DirectionCardinal,
  GamepadProfile,
  GamepadSnapshot,
  LogicalButtonState,
  NormalizeResult,
  PhysicalBinding,
} from "./types";
import { ACTION_BUTTONS, DIRECTION_CARDINALS } from "./types";

interface BindingReading {
  pressed: boolean;
  value: number;
  source: "button" | "axis";
}

/**
 * 1 つの物理バインディングを読む。
 *
 * ★index が範囲外なら null を返す（例外は投げない）。axes の本数は機体・ブラウザで変わり、
 * Firefox は Chrome / Edge に無い要素を 1 つ持つ場合があるため、範囲外は「未知の形」であって
 * 異常終了させる理由にはならない（指示書 §4.2-5 / §5.1(d)）。
 */
function readBinding(
  snapshot: GamepadSnapshot,
  binding: PhysicalBinding,
): BindingReading | null {
  if (binding.kind === "button") {
    const buttons = Array.isArray(snapshot.buttons) ? snapshot.buttons : [];
    const entry = buttons[binding.index];
    if (entry === undefined || entry === null) return null;
    const value = typeof entry.value === "number" ? entry.value : 0;
    return { pressed: entry.pressed === true, value, source: "button" };
  }

  const axes = Array.isArray(snapshot.axes) ? snapshot.axes : [];
  const raw = axes[binding.index];
  if (typeof raw !== "number" || Number.isNaN(raw)) return null;

  // sign 方向へ threshold 以上倒れていれば押下とみなす。
  const projected = raw * binding.sign;
  const pressed = projected >= binding.threshold;
  // アナログ量は 0..1 へ正規化して返す（デジタル扱いの機体でも 0/1 に落ちる）。
  const value = Math.min(1, Math.max(0, projected));
  return { pressed, value, source: "axis" };
}

/** プロファイルが実用に足るか（1 つでも割当があるか）。 */
function hasAnyBinding(profile: GamepadProfile): boolean {
  const directions = profile.directions ?? {};
  const buttons = profile.buttons ?? {};
  return Object.keys(directions).length > 0 || Object.keys(buttons).length > 0;
}

/**
 * スナップショットを論理ボタンの集合へ正規化する。
 *
 * @param snapshot 取得した Gamepad の状態
 * @param profile  当該機体のプロファイル。null / 未割当なら resolved: false を返す
 *
 * ★未知の機体・未知の形でも例外を投げない。解決できなかったことを resolved: false で返し、
 *   呼び出し側がキャリブレーションへ倒す（指示書 §4.2-8 / §5.1(d)(f)）。「対応機種一覧」で弾かない。
 */
export function normalizeSnapshot(
  snapshot: GamepadSnapshot,
  profile: GamepadProfile | null,
): NormalizeResult {
  if (!snapshot || profile === null || profile === undefined) {
    return { states: [], resolved: false };
  }
  // 別の機体のプロファイルを渡された場合は解決しない（呼び出し側の取り違え防止）。
  if (profile.padId !== snapshot.id) {
    return { states: [], resolved: false };
  }
  if (!hasAnyBinding(profile)) {
    return { states: [], resolved: false };
  }

  const states: LogicalButtonState[] = [];

  // --- 方向: 上下左右を読み、斜めを導出する ------------------------------------
  // ★buttons と axes のどちらで来ても同じ経路で読める（指示書 §4.2-4）。
  const cardinals: Record<DirectionCardinal, CardinalState> = {
    up: { pressed: false, value: 0, source: "button" },
    down: { pressed: false, value: 0, source: "button" },
    left: { pressed: false, value: 0, source: "button" },
    right: { pressed: false, value: 0, source: "button" },
  };
  let anyDirectionBound = false;
  let directionSource: "button" | "axis" = "button";

  for (const cardinal of DIRECTION_CARDINALS) {
    const binding = profile.directions?.[cardinal];
    if (binding === undefined) continue;
    anyDirectionBound = true;
    const reading = readBinding(snapshot, binding);
    if (reading === null) continue;
    // ★アナログ量を捨てない。レバーの倒し量は M21-02 が判定に使いうる（指示書 §4.2-6）。
    cardinals[cardinal] = {
      pressed: reading.pressed,
      value: reading.value,
      source: reading.source,
    };
    if (reading.pressed) directionSource = reading.source;
  }

  if (anyDirectionBound) {
    const held = {
      up: cardinals.up.pressed,
      down: cardinals.down.pressed,
      left: cardinals.left.pressed,
      right: cardinals.right.pressed,
    };
    const digit = cardinalsToNumpad(held);
    const anyHeld = held.up || held.down || held.left || held.right;
    const isDiagonal = digit === 1 || digit === 3 || digit === 7 || digit === 9;
    // 方向のアナログ量は、押されている cardinal のうち最大の倒し量を代表値とする。
    // 生の内訳は cardinals 側に残るため、ここでの畳み込みで情報は失われない。
    const value = anyHeld
      ? Math.max(
          ...DIRECTION_CARDINALS.filter((c) => cardinals[c].pressed).map(
            (c) => cardinals[c].value,
          ),
        )
      : 0;

    states.push({
      button: numpadToLogicalButton(digit),
      pressed: true,
      value: anyHeld ? value : 0,
      // 斜めは 2 入力の合成であるため由来を "derived" にする。
      source: !anyHeld ? "derived" : isDiagonal ? "derived" : directionSource,
    });
  }

  // --- ボタン: 割当のあるものだけ読む -----------------------------------------
  // ★pressed と value の両方を保持して上へ渡す（指示書 §4.2-6）。どちらを判定に使うかは
  //   本サブでは決めない——M21-02 の範囲である。
  // ★操作用ボタン（M21-04 のショートカット前置き）は states へ入れない。別配列で返す。
  //   同じ配列に混ぜると stepDetection の押下集合に入り、前置きを押しただけでステップ候補が
  //   立って `unknown_combination` として読取表示へ出る。分離しておけば M21-02 の判定は不変。
  const actions: LogicalButtonState[] = [];

  const buttonBindings = profile.buttons ?? {};
  for (const key of Object.keys(buttonBindings)) {
    const binding = buttonBindings[key as keyof typeof buttonBindings];
    if (binding === undefined) continue;
    const reading = readBinding(snapshot, binding);
    if (reading === null) continue;
    // アナログのみ動いている（pressed は false だが value > 0）状態も上へ渡す。
    if (!reading.pressed && reading.value <= 0) continue;
    const state: LogicalButtonState = {
      button: key as LogicalButtonState["button"],
      pressed: reading.pressed,
      value: reading.value,
      source: reading.source,
    };
    if (isActionButton(key)) actions.push(state);
    else states.push(state);
  }

  return {
    states,
    cardinals: anyDirectionBound ? cardinals : undefined,
    actions,
    resolved: true,
  };
}

/** 操作用ボタン（技を出さず、ショートカットを起こすためのボタン）か。 */
function isActionButton(key: string): boolean {
  return (ACTION_BUTTONS as readonly string[]).includes(key);
}

/**
 * DOM の Gamepad から GamepadSnapshot を作る。
 *
 * ★ここだけが DOM 型に触れる。normalizeSnapshot 側を DOM 非依存に保つための境界である。
 * 本関数も navigator には触らない（Gamepad オブジェクトを引数で受け取る）。
 */
export function toSnapshot(pad: Gamepad): GamepadSnapshot {
  return {
    id: pad.id,
    index: pad.index,
    mapping: pad.mapping ?? "",
    buttons: Array.from(pad.buttons ?? [], (b) => ({
      pressed: b.pressed === true,
      value: typeof b.value === "number" ? b.value : 0,
    })),
    axes: Array.from(pad.axes ?? []),
    timestamp: pad.timestamp,
  };
}

/**
 * スナップショットから「いま押されている物理入力」を 1 つ拾う（キャリブレーション用）。
 *
 * ★プロファイルを使わない。まだ対応表が無い状態で「何が押されたか」を知る唯一の経路であるため。
 * buttons を先に走査し、無ければ axes を見る。
 *
 * ★axes は「0 からの絶対値」ではなく「**静止値からの変位**」で判定する（`axesBaseline`）。
 *   静止時に -1 を返す軸を持つ機体（トリガーが axes として現れる形・一部の未使用軸）では、
 *   絶対値で見ると毎フレーム「押されている」と誤検出し、押下エッジ待ちのキャリブレーションが
 *   恒久的に進まなくなる。★この形は我々が所有していない機体でこそ起きやすく、所有 2 機種の
 *   動作確認では検出できないため、決め打ちの静止値 0 を仮定せず実測した静止値を使う。
 *   （「機体ごとの決め打ちをやめる」という本サブの方針と同じ考え方である。）
 *
 * @param axesBaseline 各軸の静止値。未指定なら 0 を静止値とみなす。
 */
export function detectPressedBinding(
  snapshot: GamepadSnapshot,
  axisThreshold: number,
  axesBaseline?: readonly number[] | null,
): PhysicalBinding | null {
  const buttons = Array.isArray(snapshot?.buttons) ? snapshot.buttons : [];
  for (let i = 0; i < buttons.length; i += 1) {
    if (buttons[i]?.pressed === true) return { kind: "button", index: i };
  }

  const axes = Array.isArray(snapshot?.axes) ? snapshot.axes : [];
  for (let i = 0; i < axes.length; i += 1) {
    const raw = axes[i];
    if (typeof raw !== "number" || Number.isNaN(raw)) continue;

    const rest = axesBaseline?.[i];
    const baseline = typeof rest === "number" && !Number.isNaN(rest) ? rest : 0;
    const displacement = raw - baseline;

    if (displacement >= axisThreshold) {
      return { kind: "axis", index: i, sign: 1, threshold: axisThreshold };
    }
    if (displacement <= -axisThreshold) {
      return { kind: "axis", index: i, sign: -1, threshold: axisThreshold };
    }
  }

  return null;
}

/** 2 つのバインディングが同じ物理入力を指すか（二重割当の検出用。指示書 §4.3-7）。 */
export function isSameBinding(a: PhysicalBinding, b: PhysicalBinding): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "button" && b.kind === "button") return a.index === b.index;
  if (a.kind === "axis" && b.kind === "axis") {
    return a.index === b.index && a.sign === b.sign;
  }
  return false;
}

// Gamepad の取得ループと接続イベントの購読（M21-01 §4.1・§4.4）。
//
// ★Gamepad API はイベント駆動ではない（gamepadconnected / gamepaddisconnected を除く）。
//   状態は requestAnimationFrame で毎フレーム読む必要がある。
// ★PoC の実測（D-324）: 全経路で user gesture が必須であり、入力面を開いた直後は
//   navigator.getGamepads() が空を返す。⇒ 「まだ 1 度も押されていない」は正常な初期状態であって
//   障害ではない。両者を別の状態として持つ（指示書 §4.4-4）。

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { toSnapshot } from "./normalize";
import type { GamepadSnapshot } from "./types";

/**
 * 接続状態の 3 値（指示書 §4.4-4。★「認識していません」と「まだ 1 度も押されていません」を
 * 同じ文言にしないため、状態そのものを分けてある）。
 */
export type GamepadConnectionStatus =
  /** まだ 1 度も Gamepad を観測していない。user gesture 前の正常な初期状態。 */
  | "idle"
  /** 観測できている。 */
  | "connected"
  /** 一度観測したあとに切断された。障害。 */
  | "disconnected";

/**
 * スナップショットが変化したフレームで呼ばれる観測コールバック（M21-02 が使う）。
 *
 * ★`at` は rAF のコールバック引数（`performance.now()` 起点・**単調増加**）である。
 *   `GamepadSnapshot.timestamp`（＝ `Gamepad.timestamp`）ではない——PoC B-3 の実測により、
 *   同フィールドはポーリングのたびではなく**パッドの状態が変化したときだけ**更新され
 *   （更新率 レバーレス 2.2% / パッド 4.2%）、かつブラウザ間の意味づけが未検証であるため。
 *
 * ★rAF ループの内側で同期に呼ばれる。**重い処理を書かないこと**（約 238 Hz の環境がある）。
 */
export type GamepadSampleListener = (
  snapshot: GamepadSnapshot,
  at: number,
) => void;

export interface GamepadPollingResult {
  status: GamepadConnectionStatus;
  /**
   * 使用中の 1 台のスナップショット。未観測なら null。
   *
   * ★入力が実際に変化したフレームでのみ新しい参照になる。静止している間は同じ参照を返すため、
   *   rAF ごとの再描画は起きない（約 238 Hz の環境で毎秒 200 回超の再描画を避けるため）。
   */
  snapshot: GamepadSnapshot | null;
  /** 使用中の機体の各軸の静止値。キャリブレーションの押下検出に使う。 */
  axesBaseline: readonly number[] | null;
  /**
   * rAF 間隔の観測値（ミリ秒・直近の中央値相当）を返す。
   * ★本サブは値を持つだけで判定には使わない（指示書 §4.1-4）。M21-02 が (β) 自己校正を採る
   *   場合にこの観測値を使う。PoC の計測環境は中央値 4.20 ms ＝ 約 238 Hz だった。
   * ★state ではなく getter である。観測値の更新で再描画を起こさないため。
   */
  getFrameIntervalMs: () => number | null;
}

/** rAF 間隔の観測に使う標本数。 */
const FRAME_SAMPLE_SIZE = 60;

/** 機体の選択時に「軸が動いた」とみなす静止値からの変位。 */
const AXIS_INPUT_THRESHOLD = 0.5;

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function readGamepads(): (Gamepad | null)[] {
  if (typeof navigator === "undefined") return [];
  if (typeof navigator.getGamepads !== "function") return [];
  try {
    return Array.from(navigator.getGamepads());
  } catch {
    // 一部環境で SecurityError 等を投げうる。取得できないことは障害として扱わない。
    return [];
  }
}

/**
 * その機体で何らかの入力があったか。
 * ★axes も静止値からの変位で見る。レバー操作だけの機体でも選ばれるようにするため。
 */
function hasAnyInput(pad: Gamepad, baseline: readonly number[] | null): boolean {
  for (const button of pad.buttons ?? []) {
    if (button?.pressed === true || (button?.value ?? 0) > 0) return true;
  }
  if (baseline !== null) {
    const axes = pad.axes ?? [];
    for (let i = 0; i < axes.length; i += 1) {
      const raw = axes[i];
      const rest = baseline[i];
      if (typeof raw !== "number" || Number.isNaN(raw)) continue;
      const base = typeof rest === "number" && !Number.isNaN(rest) ? rest : 0;
      if (Math.abs(raw - base) >= AXIS_INPUT_THRESHOLD) return true;
    }
  }
  return false;
}

/** 入力の内容が変わったか（参照ではなく値で比較する）。 */
function snapshotChanged(
  prev: GamepadSnapshot | null,
  next: GamepadSnapshot,
): boolean {
  if (prev === null) return true;
  if (prev.id !== next.id || prev.index !== next.index) return true;
  if (prev.buttons.length !== next.buttons.length) return true;
  if (prev.axes.length !== next.axes.length) return true;
  for (let i = 0; i < next.buttons.length; i += 1) {
    if (prev.buttons[i].pressed !== next.buttons[i].pressed) return true;
    if (prev.buttons[i].value !== next.buttons[i].value) return true;
  }
  for (let i = 0; i < next.axes.length; i += 1) {
    if (prev.axes[i] !== next.axes[i]) return true;
  }
  return false;
}

/**
 * Gamepad をポーリングする。
 *
 * @param enabled false の間はループを回さない。★入力面を表示していない間は回さないため
 *               （指示書 §4.1-2）、呼び出し側がマウント状態と連動させる。
 * @param onSample 省略可。入力が変化したフレームで `(snapshot, rAF の now)` を受け取る
 *               （M21-02 で追加。**省略時の挙動は従来どおり**）。
 *
 * ★複数の Gamepad が接続されている場合は「最初に入力があった 1 台」を使う（指示書 §4.1-5 の
 *   設計卓の見込みを採用）。切り替え導線は作っていない。
 *   ★**旧の保留理由「余りボタンへの機能割当（M21-04）と設計が絡むため」は失効している**——
 *   `D-358`（2026-08-14）で M21-04 は余りボタンへ割り当てず前置き方式を採ったため、切替導線と
 *   設計が絡む関係は無くなった。**⇒ 本件は「所有者不在の保留」であり、必要になった時点で
 *   改めて設計卓へ上げること**（現状 1 台運用で困っていないため未着手のまま残している）。
 *
 * ★M21-02 追記: `onSample` は**単調増加の時刻を要する判定**（同時押しの集約）のために足した。
 *   時刻は rAF のコールバック引数にしか存在せず、かつ **rAF ループを 2 本目にしない**
 *   （M21-02 指示書 §3.3-5）ためには、ループの内側から渡すほかない。
 *   `useEffect` で `snapshot` の変化を拾う形は、React の自動バッチングで中間スナップショットが
 *   落ちうる点と、入力が止まると窓を閉じる契機が無くなる点で採らなかった。
 */
export function useGamepadPolling(
  enabled = true,
  onSample?: GamepadSampleListener,
): GamepadPollingResult {
  const [status, setStatus] = useState<GamepadConnectionStatus>("idle");
  // ★入力が変化したときだけ新しい参照を入れる（rAF ごとの再描画を避ける）。
  const [snapshot, setSnapshot] = useState<GamepadSnapshot | null>(null);
  const [axesBaseline, setAxesBaseline] = useState<readonly number[] | null>(
    null,
  );

  // 選択済みの Gamepad.index。null なら未選択。
  const activeIndexRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);
  const samplesRef = useRef<number[]>([]);
  const snapshotRef = useRef<GamepadSnapshot | null>(null);
  // ★観測値は ref に持つ。更新のたびに再描画を起こさないため。
  const frameIntervalRef = useRef<number | null>(null);
  // 機体ごとの軸の静止値（Gamepad.index → 各軸の静止値）。
  const baselineRef = useRef<Map<number, readonly number[]>>(new Map());
  // ★観測コールバックは ref に持つ。useEffect の deps に入れると、呼び出し側が毎レンダリングで
  //   新しい関数を渡した瞬間に rAF ループが張り直されるため。
  const onSampleRef = useRef<GamepadSampleListener | undefined>(onSample);
  // ★代入はレンダリング中に行わない（React のレンダリングを純粋に保つ）。rAF は描画後に回るため、
  //   layout effect で更新すれば取りこぼしは起きない。
  useLayoutEffect(() => {
    onSampleRef.current = onSample;
  }, [onSample]);

  const getFrameIntervalMs = useCallback(() => frameIntervalRef.current, []);

  const reset = useCallback(() => {
    activeIndexRef.current = null;
    lastFrameRef.current = null;
    samplesRef.current = [];
    snapshotRef.current = null;
    frameIntervalRef.current = null;
    baselineRef.current = new Map();
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;

    let cancelled = false;

    const tick = (now: number) => {
      if (cancelled) return;

      // --- rAF 間隔の観測（判定には使わない） ---
      const previous = lastFrameRef.current;
      if (previous !== null) {
        const delta = now - previous;
        // タブ復帰直後の巨大な差分は標本から外す。
        if (delta > 0 && delta < 1000) {
          const samples = samplesRef.current;
          samples.push(delta);
          if (samples.length > FRAME_SAMPLE_SIZE) samples.shift();
          if (samples.length === FRAME_SAMPLE_SIZE) {
            // ★ref へ書くだけ。再描画は起こさない。
            frameIntervalRef.current = median(samples);
          }
        }
      }
      lastFrameRef.current = now;

      // --- Gamepad の読み取り ---
      const pads = readGamepads();
      const connected = pads.filter((pad): pad is Gamepad => pad !== null);

      if (connected.length === 0) {
        // user gesture 前は空が返る。まだ 1 度も観測していなければ idle のまま。
        if (activeIndexRef.current !== null) {
          activeIndexRef.current = null;
          snapshotRef.current = null;
          setSnapshot(null);
          setAxesBaseline(null);
          setStatus("disconnected");
        }
        rafRef.current = window.requestAnimationFrame(tick);
        return;
      }

      // ★機体を初めて見たフレームで軸の静止値を記録する。
      //   静止時に -1 を返す軸を持つ機体で押下検出が固まるのを防ぐ（決め打ちの 0 を仮定しない）。
      for (const pad of connected) {
        if (!baselineRef.current.has(pad.index)) {
          baselineRef.current.set(pad.index, Array.from(pad.axes ?? []));
        }
      }

      let active =
        activeIndexRef.current === null
          ? undefined
          : connected.find((pad) => pad.index === activeIndexRef.current);

      if (active === undefined) {
        // ★最初に入力があった 1 台を選ぶ。入力が無い間は選ばない（複数機体があるとき、
        //   利用者が実際に使う 1 台を取り違えないため）。
        active = connected.find((pad) =>
          hasAnyInput(pad, baselineRef.current.get(pad.index) ?? null),
        );
        if (active === undefined) {
          rafRef.current = window.requestAnimationFrame(tick);
          return;
        }
        activeIndexRef.current = active.index;
        setAxesBaseline(baselineRef.current.get(active.index) ?? null);
      }

      // ★入力が変化したフレームだけ state を更新する。静止中は再描画を起こさない。
      const next = toSnapshot(active);
      if (snapshotChanged(snapshotRef.current, next)) {
        snapshotRef.current = next;
        setSnapshot(next);
        // ★rAF の now を添えて観測を渡す（M21-02）。state 更新と違い、ここは同期に呼ばれるため
        //   中間フレームが落ちない。判定側は純粋関数であり、ここでは状態を進めるだけ。
        onSampleRef.current?.(next, now);
      }
      setStatus("connected");
      rafRef.current = window.requestAnimationFrame(tick);
    };

    rafRef.current = window.requestAnimationFrame(tick);

    // ★gamepadconnected は購読しない。user gesture 前は発火せず、発火しても採用の判断材料に
    //   ならないため（採用は tick 側の「最初に入力があった 1 台」で決まる）。購読の形だけを
    //   残すと「§4.1-3 を満たした」ように見えるデッドコードになる。
    //   切断は tick 側の列挙だけでは即座に分からないため、こちらは購読する。
    const handleDisconnected = (event: Event) => {
      const disconnected = (event as GamepadEvent).gamepad;
      if (
        disconnected !== undefined &&
        disconnected !== null &&
        disconnected.index === activeIndexRef.current
      ) {
        activeIndexRef.current = null;
        setSnapshot(null);
        setStatus("disconnected");
      }
    };

    window.addEventListener("gamepaddisconnected", handleDisconnected);

    return () => {
      // ★アンマウントでループを止める（指示書 §4.1-2）。
      cancelled = true;
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      window.removeEventListener("gamepaddisconnected", handleDisconnected);
      reset();
    };
  }, [enabled, reset]);

  return { status, snapshot, axesBaseline, getFrameIntervalMs };
}

// 同時押し判定の副作用層（M21-02）。
//
// ★rAF ループは持たない（指示書 §3.3-5「2 本目のループを作らない」）。判定そのものは
//   `stepDetection.ts` の純粋関数側にあり、本ファイルは「状態を持つ」「タイマーで窓を閉じる」
//   だけを担う。
//
// ★**M21-05 で本番の供給経路は `pushResult` へ移った。** `PhysicalInputProvider` が 2 つの
//   供給元（Gamepad の rAF ／ キーボードの `KeyboardEvent`）を合流させてから `pushResult` を
//   呼ぶ。**本番コードから {@link UseStepDetectionResult.onSample} を呼ぶ箇所はもう無い**
//   （残る呼出元は `useStepDetection.test.ts` だけである）。
//
// ★確定したステップだけを state に載せる。rAF ごとの再描画は起こさない
//   （M21-01 完了報告 §4 の申し送り 4 と同じ理由。約 238 Hz の環境がある）。

import { useCallback, useEffect, useRef, useState } from "react";

import { normalizeSnapshot } from "./normalize";
import {
  SIMULTANEOUS_PRESS_WINDOW_MS,
  createStepDetectionState,
  flushPendingStep,
  pendingStartedAt,
  pushSample,
  seedSample,
} from "./stepDetection";
import type {
  GamepadSample,
  StepCandidate,
  StepDetectionOptions,
} from "./stepDetection";
import type { GamepadSampleListener } from "./useGamepadPolling";
import type { GamepadProfile, NormalizeResult } from "./types";

/**
 * 保持する確定済みステップの件数。
 *
 * ★M21-03 で役割が変わった。当初は M21-02 の最小可視化（`GamepadStepPreview`）の表示件数
 *   だったが、**同可視化は M21-03 で撤去された**。現在の消費者は `PhysicalInputProvider` で、
 *   同 provider は本配列の**同一性**を頼りに「前回配送した候補より手前＝新着」を切り出し、
 *   受け手の入力面へ配送する。
 * ★**⇒ 本値は配送バッファの深さである。減らすと、1 レンダリングの間に確定した候補が
 *   黙って落ちうる**（表示件数だと思って下げないこと）。読取表示側の表示上限は
 *   `usePhysicalRecipeInput` が別に持つ。
 */
const MAX_RETAINED_STEPS = 5;

export interface UseStepDetectionResult {
  /** 確定したステップ候補。★新しいものが先頭。最大 {@link MAX_RETAINED_STEPS} 件。 */
  steps: StepCandidate[];
  /**
   * スナップショットを正規化してから {@link UseStepDetectionResult.pushResult} へ委譲する薄いラッパ。
   * ★識別子は安定している。
   *
   * ★**本番からは呼ばれない**（M21-05）。`PhysicalInputProvider` は 2 源を合流させる必要があるため、
   *   自前で正規化して `pushResult` を呼ぶ。**現在の呼出元は `useStepDetection.test.ts` だけである。**
   *
   * ★**それでも残しているのは、「スナップショット 1 本を食わせる」形が本フック単独の入口として
   *   自然であり、テストがこの経路で `pushResult` ごと通しているためである**（`onSample` は
   *   `pushResult` へ委譲するだけなので、ここを通るテストは判定本体の回帰も捕まえる）。
   *   **消すなら `useStepDetection.test.ts` を `pushResult` ベースへ寄せてから消すこと。**
   */
  onSample: GamepadSampleListener;
  /**
   * 正規化済みの結果を直接流す（M21-05）。
   *
   * ★**供給元が Gamepad だけではなくなったため要る**。キーボードは `KeyboardEvent` の経路であり
   *   `GamepadSnapshot` を持たない。一方、判定の本体（`stepDetection.ts`）が食うのは
   *   `NormalizeResult` であって `GamepadSnapshot` ではない。⇒ **正規化済みの形で受ける入口を
   *   開けば、判定層に「キーボードのときは」という分岐を入れずに済む**（M21-05 §4.5-4）。
   *
   * ★{@link onSample} は本関数へ委譲する。**正規化はどちらの経路でも 1 サンプルにつき 1 回**である
   *   （従来は provider 側と本フック側で 2 回走っていた）。
   */
  pushResult: (result: NormalizeResult, at: number) => void;
  /** 使用する機体のプロファイルを差し替える。 */
  setProfile: (profile: GamepadProfile | null) => void;
  /** 判定状態と確定済みステップを捨てる（切断時など）。 */
  reset: () => void;
  /**
   * 与えたサンプルで押下状態だけを取り込み直す（立ち上がりを出さない。M21-04）。
   *
   * ★前置き状態の間はサンプルを判定へ渡さないため、抜けた時点の押下状態が判定側とズレている。
   *   放置すると、押されたままのボタンが抜けた直後に「立ち上がり」として観測される。
   *
   * ★**「次の 1 サンプルを種にする」形にはしない。** それだと、抜けた直後に利用者が押した
   *   最初のボタンが種として食われて入力が 1 つ落ちる（前置きがタイムアウトで抜けた直後に顕著）。
   *   ⇒ **抜けたその場で、最後に観測済みのサンプルを使って同期する。**
   */
  seedNow: (sample: GamepadSample) => void;
}

/**
 * 正規化 → 同時押しの集約 を rAF ループ上で回す。
 *
 * @param options 判定窓の上書き。既定は {@link SIMULTANEOUS_PRESS_WINDOW_MS}。
 */
export function useStepDetection(
  options?: StepDetectionOptions,
): UseStepDetectionResult {
  const [steps, setSteps] = useState<StepCandidate[]>([]);

  const profileRef = useRef<GamepadProfile | null>(null);
  const stateRef = useRef(createStepDetectionState());
  // ★window.setTimeout の戻り値。ブラウザ環境では number。
  const timerRef = useRef<number | null>(null);
  const windowMs = options?.windowMs ?? SIMULTANEOUS_PRESS_WINDOW_MS;
  const windowMsRef = useRef(windowMs);
  // ★プロファイルが差し替わった直後の 1 サンプルは「種付け」に使う（立ち上がりを出さない）。
  const seedNextRef = useRef(false);
  // 張っているタイマーが閉じる予定の時刻。同じ窓に対して張り直さないための番兵。
  const scheduledForRef = useRef<number | null>(null);

  // ★ref への書き込みはレンダリング中に行わない（React のレンダリングを純粋に保つ）。
  useEffect(() => {
    windowMsRef.current = windowMs;
  }, [windowMs]);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    scheduledForRef.current = null;
  }, []);

  const emit = useCallback((emitted: readonly StepCandidate[]) => {
    if (emitted.length === 0) return;
    setSteps((previous) =>
      [...[...emitted].reverse(), ...previous].slice(0, MAX_RETAINED_STEPS),
    );
  }, []);

  /**
   * 窓が閉じる時刻にタイマーを張る。
   *
   * ★これが無いと、押しっぱなしのままステップが出ない。**サンプルは入力が変化したときにしか
   *   来ない**ため（Gamepad は変化したフレームだけ、キーボードは押下集合が変わったときだけ）、
   *   最後の立ち上がりのあと指を離すまで次のサンプルが来ない。
   *
   * ★**この性質は供給元が 2 つになっても変わらない**（M21-05）。どちらの経路も「変化したときだけ
   *   push する」形であり、窓を閉じるのは常に本タイマーである。
   */
  const scheduleFlush = useCallback(() => {
    const startedAt = pendingStartedAt(stateRef.current);
    if (startedAt === null) {
      clearTimer();
      return;
    }
    const closesAt = startedAt + windowMsRef.current;
    // ★同じ窓に対して張り直さない。アナログ値の揺れで `pushResult` が毎フレーム（約 238 Hz）
    //   呼ばれうるため、そのたびに clearTimeout + setTimeout を回さない。
    if (scheduledForRef.current === closesAt && timerRef.current !== null) return;

    clearTimer();
    scheduledForRef.current = closesAt;
    const remaining = Math.max(0, closesAt - (stateRef.current.lastAt ?? 0));

    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      scheduledForRef.current = null;
      // ★時刻は「窓が閉じる時刻」を使う。タイマーの発火揺らぎを判定へ持ち込まないため。
      const closed = flushPendingStep(stateRef.current, closesAt, {
        windowMs: windowMsRef.current,
      });
      stateRef.current = closed.state;
      emit(closed.emitted);
    }, remaining);
  }, [clearTimer, emit]);

  const pushResult = useCallback(
    (result: NormalizeResult, at: number) => {
      // ★プロファイル差し替え直後の 1 サンプルは押下状態の取り込みだけを行う。
      //   別の対応表で読まれていた直前の状態と比べても、立ち上がりを正しく取れないため。
      if (seedNextRef.current) {
        seedNextRef.current = false;
        stateRef.current = seedSample(stateRef.current, { result, at });
        clearTimer();
        return;
      }

      const next = pushSample(
        stateRef.current,
        { result, at },
        { windowMs: windowMsRef.current },
      );
      stateRef.current = next.state;
      emit(next.emitted);
      scheduleFlush();
    },
    [clearTimer, emit, scheduleFlush],
  );

  const onSample = useCallback<GamepadSampleListener>(
    (snapshot, at) => {
      pushResult(normalizeSnapshot(snapshot, profileRef.current), at);
    },
    [pushResult],
  );

  const setProfile = useCallback((profile: GamepadProfile | null) => {
    // ★**差し替え**（既にプロファイルがあった状態からの変更）のときだけ種付けする。
    //   初回の null → プロファイルでは種付けしない——M21-01 の導線は「ボタンを 1 度押してください」
    //   であり、そのとき押されたボタンこそが利用者の最初の入力だからである。
    if (profileRef.current !== null && profile !== profileRef.current) {
      seedNextRef.current = true;
    }
    profileRef.current = profile;
  }, []);

  const reset = useCallback(() => {
    clearTimer();
    seedNextRef.current = false;
    stateRef.current = createStepDetectionState();
    setSteps([]);
  }, [clearTimer]);

  const seedNow = useCallback(
    (sample: GamepadSample) => {
      // ★張ってあるタイマーも落とす。判定へ渡していない間に開いていた窓は、抜けた時点で
      //   もう「利用者が入力し続けている窓」ではない。
      clearTimer();
      seedNextRef.current = false;
      stateRef.current = seedSample(stateRef.current, sample);
    },
    [clearTimer],
  );

  useEffect(() => clearTimer, [clearTimer]);

  return { steps, onSample, pushResult, setProfile, reset, seedNow };
}

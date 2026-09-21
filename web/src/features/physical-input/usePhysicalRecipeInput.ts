// 物理入力をレシピ入力面へ接続する headless な部品（M21-03 §4.9-1）。
//
// ★**供給元に依存しない層である**（M21-06 §4.0・**D-375**）。旧名 `useGamepadRecipeInput` は
//   供給元が Gamepad だけだった時代の名前であり、`M21-05` がキーボードを合流させた時点で
//   実体と食い違った。⇒ `usePhysicalRecipeInput` へ改め `features/physical-input/` へ移した。
//
// ★描画を持たない。「入力 → 確定したステップ候補 → 既存の解決経路 → StepInput」だけを供給する。
// ★2 面（コンボのレシピ入力面 / セットプレイ入力面）がどちらも本フックを使う。
//   move_code の解決は recipeInputResolution の 1 か所であり、面ごとに書かない（§4.9-3）。
// ★面ごとのステップ型への写し替えは呼び出し元が行う（§4.9-2）。本フックの出口は、
//   仮想コントローラが既に使っている中立な形（StepInput）である。

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { StepInput } from "@/features/combo/components/VirtualController/useControllerInput";
import type {
  CommandIndexEntries,
  NumpadDirection,
} from "@/features/combo/inputResolutionStage2";
import type { Move } from "@/features/moves/types";

import { resolvePhysicalStep } from "@/features/gamepad/recipeInputResolution";
import type { PhysicalStepResolution } from "@/features/gamepad/recipeInputResolution";
import type { PhysicalInputActionKind } from "@/features/gamepad/shortcut";
import type { StepCandidate } from "@/features/gamepad/stepDetection";
import type { LogicalButton } from "@/features/gamepad/types";
import type { GamepadConnectionStatus } from "@/features/gamepad/useGamepadPolling";

import { resolveCommandMotion } from "./commandMotion";
import type { MotionCommand, MotionResolution } from "./commandMotion";
import {
  isMotionCandidate,
  usePhysicalInputContext,
  usePhysicalInputSurfaceId,
} from "./PhysicalInputProvider";
import type {
  CommandModeState,
  PhysicalInputActionEvent,
  PhysicalInputCandidate,
  HeldInput,
  ShortcutState,
} from "./PhysicalInputProvider";

/** 読取表示に出す 1 件（確定 / 解決できなかった のどちらも出す＝§4.3-2 / §4.3-3）。 */
export interface ReadoutEntry {
  /** 一意鍵。窓の起点は同値へクランプされうるため連番を混ぜる。 */
  key: string;
  candidate: StepCandidate;
  resolution: PhysicalStepResolution;
}

/**
 * コマンド技入力モードで確定した 1 件の読取表示（M21-06 §4.1-6・§4.2-7）。
 *
 * ★確定できたものも、できなかったものも出す。**黙って捨てない**（`E-84`）。
 */
export interface MotionReadoutEntry {
  key: string;
  /** 溜まっていた方向列（表示用に連結済み）。 */
  directions: string;
  /** 確定の契機になった攻撃ボタン。★モードを抜けて捨てた列は null。 */
  button: LogicalButton | null;
  resolution: MotionResolution;
  /** 解決できた場合の技名（`moves` から引いた表示名）。 */
  moveLabel: string | null;
}

/**
 * 読取表示に残す件数（**区画ごとに独立**）。★UI 都合の上限であり判定には関与しない。
 *
 * ★確定と解決不能で 1 本のバッファを共有しない。共有すると、解決できなかった入力が出た直後に
 *   成功入力が続いただけで理由の表示が押し出される——**素早く入力する利用者ほど押し出されやすく、
 *   告知が想定している利用者像とちょうど重なる**（レビュー指摘 中-5）。
 */
const MAX_READOUT_ENTRIES = 5;

const EMPTY_HELD: HeldInput = { buttons: [], direction: "direction_neutral" };

/**
 * ショートカット操作の結果（M21-04 §4.5-3）。
 *
 * ★**効かなかったことも出す。** 黙って何も起きない形にしない（`E-84`）。
 */
export type PhysicalInputActionOutcome =
  /** 効いた。 */
  | "done"
  /** 対象が無い（確定する窓が開いていない／削除・修飾するステップが無い）。 */
  | "no_target"
  /** この面にその導線が無い（例＝コンボへ同梱されたセットプレイ行には保存が無い）。 */
  | "unavailable"
  /** 導線はあるが、いま実行できる状態ではない（保存ボタンが非活性のときと同じ条件）。 */
  | "blocked";

export interface PhysicalInputActionResult {
  /** 一意鍵（同じ操作を続けて起こしても再描画されるように連番を混ぜる）。 */
  key: string;
  action: PhysicalInputActionKind;
  outcome: PhysicalInputActionOutcome;
}

export interface UsePhysicalRecipeInputParams {
  moves: Move[];
  entries: CommandIndexEntries;
  /**
   * コマンド技入力モード用の索引（M21-06 §4.6）。**キャラ選択時に 1 回取得したもの。**
   *
   * ★{@link entries}（段階2 の畳み済み解決表）**とは別物である。** あちらは単方向 ＋ ボタン
   *   だけに絞られており、236LP のような多方向コマンドは 1 件も載っていない。
   * ★**空でも壊れない。** モードに入れないだけで、既存の入力経路は今までどおり動く（§4.6-6）。
   */
  motionCommands: readonly MotionCommand[];
  rushOn: boolean;
  /** 解決できた入力をレシピへ 1 ステップ足す。★面ごとの型への写し替えは呼び出し元が行う。 */
  onStepAdd: (step: StepInput) => void;
  /**
   * 最後のステップを削除する（★既存の削除導線をそのまま渡すこと）。
   * ★物理側で新しい削除経路を書かない（指示書 §4.2-2）。
   */
  onStepDelete?: () => void;
  /** レシピ全体を保存する（★画面の保存ボタンが呼ぶ関数をそのまま渡すこと）。 */
  onSave?: () => void;
  /** いま保存できる状態か。★画面の保存ボタンの `disabled` と同じ式を渡すこと。 */
  canSave?: boolean;
  /** 直前に確定したステップの修飾情報の編集を開く（★既存ダイアログの入口をそのまま渡すこと）。 */
  onOpenLastStepModifiers?: () => void;
  /**
   * いまレシピに入っているステップ数。★削除・修飾の「対象が無い」判定に使う。
   *
   * ★**必須にしてある。** 省略できる形にすると、渡し忘れた面で削除・修飾が**常に「対象がない」**
   *   になり、型検査も lint も緑のまま静かに機能が死ぬ。
   */
  stepCount: number;
}

export interface UsePhysicalRecipeInputResult {
  /** 物理入力が使える環境か（provider があるか）。 */
  available: boolean;
  /**
   * 実際に機体を観測できているか。
   *
   * ★告知・読取表示の出し分けはこちらで行う。`available` は provider の内側にいるかを
   *   示すだけで、provider はアプリ全体に常設されるため**本番では常に true** である
   *   ——それだけで出し分けると、**物理コントローラを一度も接続していない利用者にも
   *   告知と読取表示が常設される**（レビュー指摘 中-1）。
   *
   * ★**これは Gamepad についての値である。** キーボードを含めた「物理入力が使えるか」は
   *   {@link inputActive} を見ること（M21-05）。
   */
  connected: boolean;
  /**
   * 物理入力（Gamepad **または** キーボード）が実際に使える状態か（M21-05）。
   *
   * ★読取表示・点灯の出し分けはこちらを使う。`connected` だけで出し分けると、
   *   **コントローラを持たずキーボードだけで入力する利用者に読取表示が出ない**——
   *   `FR106` は「正確にゆっくり入力できるよう読み取り表示する」ことを求めており、
   *   入力手段がキーボードでも要件は同じである。
   */
  inputActive: boolean;
  /** この面が受け手か。★受け手でない面はステップを足さない。 */
  active: boolean;
  /** この面を受け手にする（最後に触った面が受け手＝2026-08-13 開発者判断）。 */
  claim: () => void;
  status: GamepadConnectionStatus;
  /** 点灯の状態源（★確定したステップではない＝§4.4）。 */
  held: HeldInput;
  /** 確定したステップ（新しいものが先頭）。 */
  resolved: ReadoutEntry[];
  /** 解決できなかった入力（新しいものが先頭）。★黙って捨てない（§4.3-3）。 */
  unresolved: ReadoutEntry[];
  /** 前置き（ショートカット）の状態。★前置き中であることを画面に出す（§4.2′-5）。 */
  shortcut: ShortcutState;
  /** 直前のショートカット操作の結果。まだ 1 度も起きていなければ null。 */
  lastAction: PhysicalInputActionResult | null;
  /** コマンド技入力モードの状態（M21-06）。★溜まっている列を画面に出す（§4.1-6）。 */
  commandMode: CommandModeState;
  /**
   * モードが使えるか（＝索引を取得できているか）。
   *
   * ★false は失敗ではなく状態である（§4.6-6・`DES-005` §6.3.1 の流儀）。エラー表示にしない。
   */
  commandModeAvailable: boolean;
  /** モードで確定した／確定できなかった入力（新しいものが先頭）。★黙って捨てない。 */
  motionReadout: MotionReadoutEntry[];
}

export function usePhysicalRecipeInput({
  moves,
  entries,
  motionCommands,
  rushOn,
  onStepAdd,
  onStepDelete,
  onSave,
  canSave = true,
  onOpenLastStepModifiers,
  stepCount,
}: UsePhysicalRecipeInputParams): UsePhysicalRecipeInputResult {
  const surfaceId = usePhysicalInputSurfaceId();
  const context = usePhysicalInputContext();
  const {
    available,
    status,
    held,
    ownerId,
    shortcut,
    commandMode,
    setCommandModeActive,
    keyboard,
    registerSurface,
    unregisterSurface,
    claimSurface,
    setStepHandler,
    setActionHandler,
  } = context;

  const [resolved, setResolved] = useState<ReadoutEntry[]>([]);
  const [unresolved, setUnresolved] = useState<ReadoutEntry[]>([]);
  const [lastAction, setLastAction] = useState<PhysicalInputActionResult | null>(null);
  const [motionReadout, setMotionReadout] = useState<MotionReadoutEntry[]>([]);
  const seqRef = useRef(0);

  // ★索引を取得できていなければモードに入れない（§4.6-6）。失敗ではなく状態である。
  const commandModeAvailable = motionCommands.length > 0;

  // ★解決に要る文脈は ref で持つ。毎レンダリングで新しいハンドラを登録し直すと、
  //   provider 側の配送先が入れ替わる隙ができるため。
  const ctxRef = useRef({ moves, entries, rushOn });
  const motionCtxRef = useRef({ moves, motionCommands });
  const onStepAddRef = useRef(onStepAdd);
  useEffect(() => {
    ctxRef.current = { moves, entries, rushOn };
  }, [moves, entries, rushOn]);
  useEffect(() => {
    motionCtxRef.current = { moves, motionCommands };
  }, [moves, motionCommands]);
  useEffect(() => {
    onStepAddRef.current = onStepAdd;
  }, [onStepAdd]);

  // ★操作の導線も ref で持つ。理由はステップ側と同じ（毎レンダリングで登録し直すと、
  //   provider 側の配送先が入れ替わる隙ができる）。
  const actionCtxRef = useRef({
    onStepDelete,
    onSave,
    canSave,
    onOpenLastStepModifiers,
    stepCount,
  });
  useEffect(() => {
    actionCtxRef.current = {
      onStepDelete,
      onSave,
      canSave,
      onOpenLastStepModifiers,
      stepCount,
    };
  }, [onStepDelete, onSave, canSave, onOpenLastStepModifiers, stepCount]);

  // ★モードの入切に要る値も ref で持つ（理由は上と同じ＝ハンドラを登録し直さないため）。
  const commandModeActiveRef = useRef(commandMode.active);
  const commandModeAvailableRef = useRef(commandModeAvailable);
  const setCommandModeActiveRef = useRef(setCommandModeActive);
  useEffect(() => {
    commandModeActiveRef.current = commandMode.active;
  }, [commandMode.active]);
  useEffect(() => {
    commandModeAvailableRef.current = commandModeAvailable;
  }, [commandModeAvailable]);
  useEffect(() => {
    setCommandModeActiveRef.current = setCommandModeActive;
  }, [setCommandModeActive]);

  useEffect(() => {
    registerSurface(surfaceId);
    return () => unregisterSurface(surfaceId);
  }, [surfaceId, registerSurface, unregisterSurface]);

  /**
   * コマンド技入力モードで確定した 1 件を解決する（M21-06 §4.2）。
   *
   * ★**解決できなかった入力も必ず読取表示へ残す**（§4.2-7・チェックリスト重大 13）。
   *   モードを抜けて捨てた列（`button === null`）も同じ扱いである（`E-84`）。
   */
  const handleMotion = useCallback(
    (directions: readonly NumpadDirection[], button: LogicalButton | null, at: number) => {
      const { moves: currentMoves, motionCommands: table } = motionCtxRef.current;
      seqRef.current += 1;
      const key = `motion-${at}-${seqRef.current}`;
      const text = directions.join("");

      const push = (resolution: MotionResolution, moveLabel: string | null) => {
        setMotionReadout((prev) =>
          [
            { key, directions: text, button, resolution, moveLabel },
            ...prev,
          ].slice(0, MAX_READOUT_ENTRIES),
        );
      };

      // ★モードを抜けて捨てられた列。確定の契機が無いため解決そのものを試みない。
      if (button === null) {
        push({ status: "unresolved", reason: "abandoned", candidates: [] }, null);
        return;
      }

      const resolution = resolveCommandMotion(table, directions, button);
      if (resolution.status !== "resolved") {
        push(resolution, null);
        return;
      }

      // ★出口は必ず当該キャラの move_code である（§4.2-6・契約 F-3 の死守 3）。
      //   索引に載っていても当該キャラの moves に無ければ確定しない。
      //   ★この枝は**データの不整合**であり利用者の入力ミスではないため、理由を分けてある。
      const move = currentMoves.find((m) => m.code === resolution.moveCode);
      if (move === undefined) {
        push(
          { status: "unresolved", reason: "move_not_found", candidates: [] },
          null,
        );
        return;
      }

      onStepAddRef.current({ moveId: move.id, moveCode: move.code });
      push(resolution, move.nameJa ?? move.code);
    },
    [],
  );

  /** 判定窓を通った通常のステップ候補（M21-03 の経路。★1 行も変えていない）。 */
  const handleStepCandidate = useCallback((candidate: StepCandidate) => {
    const resolution = resolvePhysicalStep(candidate, ctxRef.current);
    seqRef.current += 1;
    const entry: ReadoutEntry = {
      key: `${candidate.startedAt}-${seqRef.current}`,
      candidate,
      resolution,
    };
    if (resolution.status === "resolved") {
      setResolved((prev) => [entry, ...prev].slice(0, MAX_READOUT_ENTRIES));
      onStepAddRef.current(resolution.step);
      return;
    }
    // ★解決できなかった入力も読取表示に残す。黙って捨てない（§4.3-3）。
    setUnresolved((prev) => [entry, ...prev].slice(0, MAX_READOUT_ENTRIES));
  }, []);

  /**
   * 配送された候補を振り分ける。
   *
   * ★**配送チャネルは 1 本のままである**（§4.4-2）。運ぶものがモードの有無で 2 形あるだけで、
   *   「登録・解除・owner 1 面への配送」の仕組みは増えていない。
   */
  const handleCandidate = useCallback(
    (candidate: PhysicalInputCandidate) => {
      if (isMotionCandidate(candidate)) {
        handleMotion(candidate.directions, candidate.button, candidate.at);
        return;
      }
      handleStepCandidate(candidate);
    },
    [handleMotion, handleStepCandidate],
  );

  useEffect(() => {
    setStepHandler(surfaceId, handleCandidate);
    return () => setStepHandler(surfaceId, null);
  }, [surfaceId, handleCandidate, setStepHandler]);

  /**
   * ショートカット操作を既存の導線へ流す（M21-04 §4.2）。
   *
   * ★**物理側は「どの操作を起こすか」までしか決めない。** 削除の中身も、保存の検証・エラー表示・
   *   遷移も、修飾の選択肢も、すべて呼び先の既存導線が持っている。ここで作り直さない。
   * ★導線が無い／実行できる状態でない場合は、黙って何も起こさずに理由を残す（§4.5-3）。
   */
  const handleAction = useCallback((event: PhysicalInputActionEvent) => {
    const ctx = actionCtxRef.current;
    let outcome: PhysicalInputActionOutcome;

    switch (event.action) {
      case "delete":
        if (ctx.onStepDelete === undefined) outcome = "unavailable";
        else if (ctx.stepCount <= 0) outcome = "no_target";
        else {
          ctx.onStepDelete();
          outcome = "done";
        }
        break;
      case "save":
        if (ctx.onSave === undefined) outcome = "unavailable";
        else if (!ctx.canSave) outcome = "blocked";
        else {
          ctx.onSave();
          outcome = "done";
        }
        break;
      case "modifier":
        if (ctx.onOpenLastStepModifiers === undefined) outcome = "unavailable";
        else if (ctx.stepCount <= 0) outcome = "no_target";
        else {
          ctx.onOpenLastStepModifiers();
          outcome = "done";
        }
        break;
      case "command_mode":
        // ★コマンド技入力モードの入切（M21-06 §4.1-1）。**切替である。**
        //
        // ★**可否ガードは「入るとき」だけに掛ける。** 索引を取得できていなければ入らないが
        //   （§4.6-6）、**抜ける操作は索引の有無に関わらず必ず通す**。
        //
        //   ★★両方に掛けると「入ったあとに索引が失われると抜けられない」状態が作れる
        //     （レビュー指摘 高-2）。到達経路は 3 つ——**キャラ切替中の再取得**（`data` が
        //     一時的に undefined になる）／**再取得の失敗** ／ **未 seed キャラへの切替**
        //     （BE は 200 ＋ 空配列を返すのが正常系）。そのとき利用者は
        //     「方向はステップにならず・解決もせず・抜けられない」状態に閉じ込められる。
        //     ⇒ チェックリスト重大 8「モードから抜けられない」の条件そのものである。
        //
        // ★状態そのものは provider が持つ（合流の後段＝§4.4-3）。ここは可否を決めて申告する
        //   だけで、溜まった列にも判定層にも触れない。
        if (commandModeActiveRef.current) {
          setCommandModeActiveRef.current(false);
          outcome = "done";
        } else if (!commandModeAvailableRef.current) {
          outcome = "unavailable";
        } else {
          setCommandModeActiveRef.current(true);
          outcome = "done";
        }
        break;
    }

    seqRef.current += 1;
    setLastAction({
      key: `action-${seqRef.current}`,
      action: event.action,
      outcome,
    });
  }, []);

  useEffect(() => {
    setActionHandler(surfaceId, handleAction);
    return () => setActionHandler(surfaceId, null);
  }, [surfaceId, handleAction, setActionHandler]);

  const claim = useCallback(() => {
    claimSurface(surfaceId);
  }, [claimSurface, surfaceId]);

  const connected = available && status === "connected";
  // ★キーボードは「接続」という概念を持たない。登録済みであることが使える条件である（M21-05）。
  const inputActive = available && (connected || keyboard.registered);
  const active = available && ownerId === surfaceId;

  // ★入力手段が無くなったら読取表示も捨てる。点灯（provider 側）だけが消えて「確定したステップ」が
  //   残ると、いつの入力なのか分からない中途半端な状態になる（レビュー指摘 低-4）。
  //   ★M21-05: 判定の条件を `connected` から `inputActive` へ広げた。`connected` のままだと、
  //     キーボードだけの利用者は**確定した直後に読取表示が消える**（パッドが未接続であるため）。
  useEffect(() => {
    if (inputActive) return;
    setResolved((prev) => (prev.length === 0 ? prev : []));
    setUnresolved((prev) => (prev.length === 0 ? prev : []));
    setLastAction((prev) => (prev === null ? prev : null));
    // ★モードの読取表示も対称に捨てる（M21-06）。片方だけ残すと、いつの入力なのか
    //   分からない中途半端な状態になる（レビュー指摘 低-4 と同じ理由）。
    setMotionReadout((prev) => (prev.length === 0 ? prev : []));
  }, [inputActive]);

  // ★索引が使えなくなったらモードを畳む（レビュー指摘 高-2 の後半）。
  //
  // ★**閉じ込めを作らないための処置である。** 索引が空のままモードが生き続けると、
  //   方向はステップにならず・解決もせず・読取表示は「取得できていない」枝が優先されて
  //   **溜まっている列が画面から消える**（§4.1-6 が破れる）。
  // ★畳むときは `setCommandModeActive(false)` を通す。**溜めた列は捨てられる前に
  //   読取表示へ出る**（`E-84`／§4.1-7）。黙って消さない。
  // ★キャラを切り替えると索引は取り直しになるが、**コマンドはキャラ別であるため
  //   溜めた列を持ち越す意味が無い。** ⇒ 畳むのが正しい。
  useEffect(() => {
    if (commandModeAvailable) return;
    if (!commandMode.active) return;
    setCommandModeActive(false);
  }, [commandModeAvailable, commandMode.active, setCommandModeActive]);

  // ★前置きへ入り直したら直前の操作結果を消す。残しておくと「削除しました」が出たまま
  //   次の操作を選ぶことになり、**古い結果がいまの状態に見える**（`E-84` の同型）。
  useEffect(() => {
    if (!shortcut.active) return;
    setLastAction((prev) => (prev === null ? prev : null));
  }, [shortcut.active]);

  return useMemo(
    () => ({
      available,
      connected,
      inputActive,
      active,
      claim,
      status,
      // ★点灯も `inputActive` で出し分ける。キーボードだけの利用者でもボタンが光る。
      held: inputActive ? held : EMPTY_HELD,
      resolved,
      unresolved,
      shortcut,
      lastAction,
      commandMode,
      commandModeAvailable,
      motionReadout,
    }),
    [
      available,
      connected,
      inputActive,
      active,
      claim,
      status,
      held,
      resolved,
      unresolved,
      shortcut,
      lastAction,
      commandMode,
      commandModeAvailable,
      motionReadout,
    ],
  );
}

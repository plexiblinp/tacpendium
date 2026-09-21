// キーボードの押下を購読する副作用層（M21-05 §4.4・§4.5）。
//
// ★本フックは**押下集合を保つだけ**である。正規化は `normalizeKeyboard`、判定は既存の
//   `useStepDetection`、配送は `PhysicalInputProvider` が持つ。ここに判定を書かないこと。
//
// ★**入力面が 1 つも表示されていない間は購読しない**（`enabled`）。Gamepad 側が
//   「入力面が無い間はポーリングを回さない」のと同じ規律である（`DES-005` §6.4.3 の項目 5）。

import { useEffect, useRef } from "react";

import type { PhysicalInputActionKind } from "@/features/gamepad/shortcut";

import { isEditableElementFocused } from "./editableFocus";
import { actionForKey, isMoveKey } from "./normalizeKeyboard";
import type { KeyboardBindings } from "./types";

export interface UseKeyboardInputParams {
  /** 入力面がマウントされているか。false の間は一切購読しない。 */
  enabled: boolean;
  bindings: KeyboardBindings;
  /** 押下集合が変わったときに呼ばれる。★呼び出し側が正規化して判定へ渡す。 */
  onHeldChange: (heldCodes: ReadonlySet<string>, at: number) => void;
  /** 操作キーが押されたときに呼ばれる。★受け手の調停は呼び出し側が行う。 */
  onAction: (action: PhysicalInputActionKind) => void;
}

/** 観測時刻。★`performance.now()` は rAF のコールバック引数と同じ起点であり、混ぜても破綻しない。 */
function now(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : 0;
}

export function useKeyboardInput({
  enabled,
  bindings,
  onHeldChange,
  onAction,
}: UseKeyboardInputParams): void {
  const heldRef = useRef<Set<string>>(new Set());

  // ★引数は ref 経由で読む。listener を毎レンダリング張り替えると、押下中に張り替わった場合に
  //   keyup を取り逃してキーが押しっぱなし扱いで残る。
  const bindingsRef = useRef(bindings);
  const onHeldChangeRef = useRef(onHeldChange);
  const onActionRef = useRef(onAction);

  useEffect(() => {
    bindingsRef.current = bindings;
  }, [bindings]);
  useEffect(() => {
    onHeldChangeRef.current = onHeldChange;
  }, [onHeldChange]);
  useEffect(() => {
    onActionRef.current = onAction;
  }, [onAction]);

  useEffect(() => {
    if (!enabled) return;

    const emit = () => {
      onHeldChangeRef.current(new Set(heldRef.current), now());
    };

    const releaseAll = () => {
      if (heldRef.current.size === 0) return;
      heldRef.current.clear();
      emit();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      // ★★最初に通すガード。**技入力も操作も同じ扱いである**（§4.4-1・§4.4-3）。
      //   メモ欄を打っている最中に保存キーの文字を打っても、保存は走らない。
      //   ★ここで抜けるため、テキスト欄では空白も矢印も従来どおり使える。
      if (isEditableElementFocused()) return;

      const code = event.code;
      const bound = bindingsRef.current;
      const action = actionForKey(bound, code);
      const isMove = isMoveKey(bound, code);

      // ★**登録されていないキーには一切触らない。** 触ると、利用者が割り当てていない
      //   矢印キーでのスクロールやブラウザのショートカットまで殺すことになる。
      if (action === null && !isMove) return;

      // ★★**自分のキーなら、リピートでも必ず既定動作を止める。**
      //
      //   ★2026-08-14 の実機確認で見つかった不具合の是正箇所である。**この行が下の
      //     `event.repeat` ガードより後ろにあったため、押し始めの 1 回しか抑止されず、
      //     OS のキーリピートが素通りしてブラウザがスクロールしていた。**
      //     方向入力は押しっぱなしが普通の使い方であるため、実質ほぼ毎回スクロールした。
      //   ★**「何を止めるか」はキー名で決めない**（§4.4-2 と同じ流儀）。「利用者が割り当てた
      //     キーかどうか」だけで決めるため、矢印・Space・PageUp/Down・Home/End など
      //     既定動作を持つキーが**まとめて**塞がる。
      event.preventDefault();

      // ★OS のキーリピートを新しい押下として扱わない（§4.5-3）。押下の継続である。
      if (event.repeat) return;

      // 操作キー。★前置きを挟まず、1 キーが直接 1 操作に対応する（§4.2-1・§4.2-2）。
      if (action !== null) {
        onActionRef.current(action);
        return;
      }

      // ★押下集合が既に持っているキーは無視する。`event.repeat` を報告しない環境でも
      //   ここで止まるため、同じキーの押しっぱなしが立ち上がりを繰り返すことはない。
      if (heldRef.current.has(code)) return;

      heldRef.current.add(code);
      emit();
    };

    // ★**keyup はガードを通さない。** 押下中にフォーカスがテキスト欄へ移ると keyup が
    //   ガードで捨てられ、そのキーが恒久的に「押されたまま」になる。
    const handleKeyUp = (event: KeyboardEvent) => {
      const code = event.code;
      const bound = bindingsRef.current;

      // ★keyup でも既定動作を止める。**ネイティブ `<button>` は Space の活性化を
      //   keyup で行う**ため、keydown だけ止めても取りこぼす経路がある。
      if (actionForKey(bound, code) !== null || isMoveKey(bound, code)) {
        event.preventDefault();
      }

      if (!heldRef.current.has(code)) return;
      heldRef.current.delete(code);
      emit();
    };

    // ★画面から離れた・タブが隠れたら押下を捨てる。押しっぱなしのまま戻ると、
    //   離した事実を観測できないため。
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") releaseAll();
    };

    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyUp, true);
    window.addEventListener("blur", releaseAll);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyUp, true);
      window.removeEventListener("blur", releaseAll);
      document.removeEventListener("visibilitychange", handleVisibility);
      // ★購読をやめるときは押下を捨てる。残すと、次に購読を始めた瞬間に
      //   「押されたままのキー」が判定へ混ざる。
      heldRef.current.clear();
    };
  }, [enabled]);
}

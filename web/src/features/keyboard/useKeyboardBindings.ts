// キーボード割当の読み書き（M21-05 §4.7）。
//
// ★`useGamepadProfiles` と同じ形にしてある（読み込み・保存・削除だけを持ち、判定には関わらない）。
// ★**既定を当てる経路が無い**（**D-370**）。保存が無ければ「未登録」がそのまま初期状態である。

import { useCallback, useMemo, useState } from "react";

import {
  clearKeyboardBindings,
  loadKeyboardBindings,
  saveKeyboardBindings,
} from "./keyboard-storage";
import { createEmptyBindings, hasAnyMoveBinding } from "./types";
import type { KeyboardBindings } from "./types";

export interface UseKeyboardBindingsResult {
  bindings: KeyboardBindings;
  /** 技側の割当が 1 つでもあるか。★false なら入力は 1 つも成立しない（＝未登録）。 */
  registered: boolean;
  /** 保存する。書込に失敗したら false（容量制限・プライベートブラウジング等）。 */
  save: (bindings: KeyboardBindings) => boolean;
  /** 全件消す（登録のやり直し）。 */
  clear: () => void;
}

export function useKeyboardBindings(): UseKeyboardBindingsResult {
  // ★初期値は関数形で渡す。毎レンダリングで localStorage を読まないため。
  const [bindings, setBindings] = useState<KeyboardBindings>(() =>
    loadKeyboardBindings(),
  );

  const save = useCallback((next: KeyboardBindings) => {
    // ★保存の成否に関わらず画面の状態は更新する。書けなかった場合でもその場のセッションでは
    //   使えるほうがよく、書込失敗は呼び出し側が利用者へ出す。
    setBindings(next);
    return saveKeyboardBindings(next);
  }, []);

  const clear = useCallback(() => {
    clearKeyboardBindings();
    setBindings(createEmptyBindings());
  }, []);

  return useMemo(
    () => ({
      bindings,
      registered: hasAnyMoveBinding(bindings),
      save,
      clear,
    }),
    [bindings, save, clear],
  );
}

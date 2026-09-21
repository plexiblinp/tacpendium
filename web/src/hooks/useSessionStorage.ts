import { useCallback, useMemo, useRef, useState } from "react";

import { createSessionStorageHelper } from "@/lib/browser-storage";

/**
 * セッション内だけ保持する UI 状態を読み書きするフック。
 *
 * ★保存経路は専用ヘルパ `web/src/lib/browser-storage.ts` に限る(`CLAUDE.md` §10.X /
 *   `web/CLAUDE.md` §1「実装ガイドライン」)。本フックは以前 `sessionStorage` を直に
 *   呼んでおり、台帳 §1 脚注が「#7 の非整合」として既知の負債に挙げていた(M40-02 で是正)。
 *
 * ★`storage.save()` は `setState` の updater の中では呼ばない。updater は純関数で
 *   なければならず(StrictMode は二重に実行する)、副作用を置くと書込みが二度走る。
 *   ⇒ 直前値を ref で追跡し、次の値を先に確定してから保存 → state 更新の順で行う。
 *
 * ★未保存・parse 失敗・読取例外はいずれも `load()` が `null` を返す(ヘルパの契約)。
 *   本フックはそれらをまとめて「未設定」とみなし `initialValue` を返す。
 *   ⇒ **`T` が `null` を含む場合、保存済みの `null` も未設定として扱われる**
 *   (M40-02 で持ち込んだ唯一の挙動差。旧実装は保存済みの `null` を値として返した)。
 *   既存の利用箇所(`combo-list-expanded-ids-v1` = `number[]`)は `null` を取らない。
 *   ★`useFilterPanelCollapsed` / `useRecipeFullView` は `typeof saved === "boolean"` の
 *   型ガードで畳んでおり、`null` だけでなく型の合わない値も既定へ落とす。**畳む点は同じだが
 *   述語は同じではない**(本フックは `T` が任意のため型ガードを書けない)。
 *
 * ★★不変条件: **`setStoredValue` を呼ぶ箇所では、かならず `latestValue.current` も
 *   同じ値へ更新すること。** 関数形式の `setValue` は直前値をこの ref から取るため、
 *   片方だけを更新すると **updater が静かに古い値を受け取る**。
 *   ⇒ 現在 `setStoredValue` の呼び出しは `setValue` の 1 箇所だけである。
 *   `reset` や `key` 変更時の再読込を足すときは、両方を更新すること。
 */
export function useSessionStorage<T>(
  key: string,
  initialValue: T,
): [T, (value: T | ((prev: T) => T)) => void] {
  const storage = useMemo(() => createSessionStorageHelper<T>(key), [key]);

  const [storedValue, setStoredValue] = useState<T>(() => {
    const saved = storage.load();
    return saved === null ? initialValue : saved;
  });

  // 直前値。updater を純粋に保つため、関数形式の引数へ渡す値はここから取る。
  const latestValue = useRef<T>(storedValue);

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      const nextValue =
        value instanceof Function ? value(latestValue.current) : value;
      latestValue.current = nextValue;
      storage.save(nextValue);
      setStoredValue(nextValue);
    },
    [storage],
  );

  return [storedValue, setValue];
}

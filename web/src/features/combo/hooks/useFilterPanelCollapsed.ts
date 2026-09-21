import { useCallback, useState } from "react";

import { createLocalStorageHelper } from "@/lib/browser-storage";

// 一覧のフィルタ欄の開閉状態(M24-02 §4.2 / CHANGE-133)。
//
// ★新しいキーを作った理由(既存キーへ相乗りしなかった理由):
//   - combo-list-filters-v1 は「生の URL クエリ文字列」を入れる器であり、
//     updateFilters がその内容を searchParams へ書き戻す。折りたたみは絞り込みでは
//     ないため、相乗りさせると開閉状態が URL に載る。
//   - combo-list-columns-v1 は ColumnVisibility(9 個の boolean)の型そのものである。
//   ⇒ 新キー。台帳(web/CLAUDE.md §1)へ登録済み。
//
// ★localStorage を選んだ理由: 列カスタマイズ(combo-list-columns-v1)と揃えた。
//   どちらも「セッションを跨いで覚えていてほしい UI の設定」である。
//   (combo-list-filters-v1 が sessionStorage なのは、絞り込みが in-app の一時保持だから)
const STORAGE_KEY = "combo-list-filters-collapsed-v1";
const storage = createLocalStorageHelper<boolean>(STORAGE_KEY);

/**
 * フィルタ欄の折りたたみ状態。
 *
 * ★既定は「開いた状態」(collapsed = false)。既定で閉じると
 *   「フィルタが効いているのに見えない」状態が初回から起きるため(指示書 §4.2)。
 */
export function useFilterPanelCollapsed() {
  const [collapsed, setCollapsedState] = useState<boolean>(() => {
    const saved = storage.load();
    return typeof saved === "boolean" ? saved : false;
  });

  const setCollapsed = useCallback((next: boolean) => {
    setCollapsedState(next);
    storage.save(next);
  }, []);

  return { collapsed, setCollapsed };
}

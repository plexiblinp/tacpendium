import { useCallback, useSyncExternalStore } from "react";

import { createLocalStorageHelper } from "@/lib/browser-storage";

// レシピの全文表示モード(M24-03 §4.1 / CHANGE-134)。
//
// ★★5 面(一覧・マイコンボ・詳細・比較・比較の追加モーダル)が「1 つの値」を共有する。
//   ★【M24-07 で是正】旧記述「4 面」は失効していた(マイコンボが漏れていた)。
//   同じ情報を 2 か所に持たない(E-76)。面ごとに useState を持たせてはならない——
//   /compare では CompareTable と AddComboToCompareModal が同時にマウントされるため、
//   別々の state だと比較表で切り替えてもモーダル側は再マウントまで古い値を見る。
//   ⇒ モジュールレベルの購読者集合 + useSyncExternalStore にしてある。
//
// ★新しいキーを作った理由(既存キーへ相乗りしなかった理由):
//   - combo-list-filters-v1 は「生の URL クエリ文字列」を入れる器であり、相乗りさせると
//     全文表示モードが URL に載る(M24-02 が #10 で同じ判定をした)。
//   - combo-list-columns-v1 は ColumnVisibility(9 個の boolean)の型そのものである。
//   ⇒ 新キー。台帳(web/CLAUDE.md §1 #11)へ登録済み。
//
// ★localStorage を選んだ理由: 列カスタマイズ(#1)・フィルタ折りたたみ(#10)と揃えた。
//   どれも「セッションを跨いで覚えていてほしい UI の設定」である。
const STORAGE_KEY = "recipe-full-view-v1";
const storage = createLocalStorageHelper<boolean>(STORAGE_KEY);

// null = 利用者がまだ一度も切り替えていない(⇒ 面ごとの既定が効く)。
// undefined = まだ localStorage を読んでいない(モジュール内のキャッシュ未初期化)。
let current: boolean | null | undefined = undefined;
const listeners = new Set<() => void>();

function getSnapshot(): boolean | null {
  if (current === undefined) {
    const saved = storage.load();
    current = typeof saved === "boolean" ? saved : null;
  }
  return current;
}

// SSR は無いが、useSyncExternalStore は third arg を要求しうるため素直に用意する。
function getServerSnapshot(): boolean | null {
  return null;
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/** 全文表示モードを切り替える(購読している面すべてへ即座に伝わる)。 */
export function setRecipeFullView(next: boolean): void {
  current = next;
  storage.save(next);
  for (const listener of listeners) listener();
}

/**
 * 全文表示モードの値を読む。
 *
 * @param surfaceDefault ★「面ごとの既定」。利用者が一度も切り替えていないときだけ効く。
 *   一覧・比較・追加モーダル = false(末尾省略＋ホバー。DES-005 §5.4 の既定を維持)、
 *   詳細 = true(SM-022 の要求は「詳細で縦に読みたい」である)。
 *   ★トグルそのものは 1 つしか無い。既定が面ごとに違うだけで、切り替えた後の値は共有される。
 */
export function useRecipeFullView(surfaceDefault: boolean): {
  fullView: boolean;
  setFullView: (next: boolean) => void;
  toggle: () => void;
} {
  const stored = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const fullView = stored ?? surfaceDefault;
  const setFullView = useCallback((next: boolean) => setRecipeFullView(next), []);
  const toggle = useCallback(() => setRecipeFullView(!fullView), [fullView]);
  return { fullView, setFullView, toggle };
}

/** テスト専用。モジュール内キャッシュと購読者を捨てる(テスト間の漏れを防ぐ)。 */
export function __resetRecipeFullViewForTest(): void {
  current = undefined;
  listeners.clear();
}

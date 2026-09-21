// 物理入力の告知の既読フラグと開閉状態（M37-02 / B10・`P-59` の決着）。
//
// ★台帳は `web/CLAUDE.md` §1 の **#12**（root `CLAUDE.md` §10.X）。台帳未記載のキーを使うことは
//   禁止事項であり、`bash scripts/check-browser-storage-keys.sh` が機械検査している。
//
// ★型は `setplay-notice-seen-v1` / `onboarding-seen-v1` と同じ `<feature>-seen-v1` である。
//   保持するのは boolean 1 個の UI 状態であり、DB 永続化対象のユーザー入力データを含まない。
//
// ★★`virtual-controller-layout-v1`（台帳 #2）へ相乗りしない。同キーは「未実装」であることを
//   lint が検査しており、実装コードへ書いた時点で赤になる（台帳の脚注）。
//   ⇒ #2 は「未実装」のまま残すのが正しい状態である。
//
// ★★★開閉状態をモジュールレベルで共有する理由＝**2 面が同時にマウントされるから**である。
//   `DES-005` §6.4.3 項目 4 が「入力面は同時に複数マウントされうる」と定めており、
//   実際に `gamepadRecipeInput.test.tsx` の床は 1 つの provider の下で
//   コンボ面とセットプレイ面を同時に描画して「告知が 2 面へ同文で出る」ことを主張している。
//   ⇒ 面ごとに `useState` を持たせると、**初回の 1 面目が既読を書いた直後に 2 面目が
//     それを読んで畳まれる**（＝片方だけ出る）。同じ情報を 2 か所に持たない（`E-76`）。
//   ★先例＝`useRecipeFullView`（台帳 #11）。同じ理由で `useSyncExternalStore` を使っている。

import { useCallback, useSyncExternalStore } from "react";

import { createLocalStorageHelper } from "@/lib/browser-storage";

/** ★台帳 #12。`-v1` の suffix は将来の構造変更に備えたもの（`CLAUDE.md` §10.X）。 */
export const GAMEPAD_NOTICE_STORAGE_KEY = "gamepad-input-notice-seen-v1";

const storage = createLocalStorageHelper<boolean>(GAMEPAD_NOTICE_STORAGE_KEY);

// undefined = まだ判定していない（モジュール内キャッシュ未初期化）。
let open: boolean | undefined = undefined;
let persisted = false;
const listeners = new Set<() => void>();

/**
 * 既読を書き、書けたかを返す。**★描画中に呼ばないこと**（マウント後の effect から呼ぶ）。
 *
 * ★★`getSnapshot` から呼んではならない。`useSyncExternalStore` は `getSnapshot` を
 *   描画中に（React 18 では同一描画内で複数回）呼ぶため、副作用を持たない純関数で
 *   なければならない。⇒ 書込みはここへ分離してある。
 * ★1 ページ読込につき 1 回しか書かない（2 面が同時にマウントされるため）。
 */
export function persistGamepadNoticeSeen(): boolean {
  if (persisted) return true;
  persisted = storage.save(true);
  return persisted;
}

/**
 * ★**読むだけ**で初回自動表示を決める（純粋）。1 ページ読込につき 1 回だけ評価し、
 *   以降はモジュール内キャッシュを返す。
 *
 * ★保存に失敗する環境（プライベートブラウジング等）で**非表示へ倒す**責務は
 *   呼び出し側の effect にある（`GamepadInputNotice`）。表示したまま既読を記録できないと
 *   毎回自動表示になり、`B10` の要求（常時表示をやめる）を満たさないためである。
 *   先例＝`SetplayLimitationNotice`。
 */
function getSnapshot(): boolean {
  if (open === undefined) open = storage.load() !== true;
  return open;
}

// SSR は無いが useSyncExternalStore が third arg を要求しうるため素直に用意する。
function getServerSnapshot(): boolean {
  return false;
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/** 告知の開閉を切り替える（購読している面すべてへ即座に伝わる）。 */
export function setGamepadNoticeOpen(next: boolean): void {
  open = next;
  // ★開いたときも既読を書く。⇒ 保存に失敗していた環境で明示的に開いたなら、
  //   それは「読んだ」ということであり、次回の自動表示は要らない。
  //   ★これはイベントハンドラであり描画中ではないため、ここから書いてよい。
  if (next) persistGamepadNoticeSeen();
  for (const listener of listeners) listener();
}

/** 告知の開閉状態を読む。★2 面で共有される。 */
export function useGamepadNoticeOpen(): {
  noticeOpen: boolean;
  setNoticeOpen: (next: boolean) => void;
} {
  const noticeOpen = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const setNoticeOpen = useCallback(
    (next: boolean) => setGamepadNoticeOpen(next),
    [],
  );
  return { noticeOpen, setNoticeOpen };
}

/** テスト専用。モジュール内キャッシュと購読者を捨てる（テスト間の漏れを防ぐ）。 */
export function __resetGamepadNoticeForTest(): void {
  open = undefined;
  persisted = false;
  listeners.clear();
}

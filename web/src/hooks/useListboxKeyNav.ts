import { useRef, type KeyboardEvent } from "react";

// 候補リスト(role="listbox")の中を ↑↓ で巡回する roving focus。
//
// ★★出所は SearchableSelect の handleListKeyDown である(M24-02 レビュー 中-4)。
//   M27-02a で TagSelector にも同じ操作が要ることになったため、実体を 1 本にした。
//   ⇒ 「SearchableSelect の handleListKeyDown を TagSelector へ広げる」という
//     追跡行の推奨(tag-field-keyboard-unreachable)を、複製ではなく共有で満たす。
//
// ★★ハイライト位置の state を持たない。実 DOM の focus をそのまま位置とする。
//   ⇒ 候補が検索で絞り込まれても、位置合わせのための同期が要らない。
//
// ★対象は listRef の中の [role="option"] だけである。
//   ⇒ 候補として扱ってほしい要素には role="option" を付けること。
//     (タグ欄の「〜を新規登録」行のように、候補と並んで押せるものを含めるかは
//      利用側が role を付けるかどうかで決まる)
//
// ★Enter は扱わない。候補は <button type="button"> であり、フォーカスさえ載れば
//   ブラウザ既定の活性化で onClick が撃たれる。
//   ⇒ 「選んで閉じるか/開いたままか」は利用側の onClick が決める。ここでは決めない。
//     単一選択は閉じ、複数選択は開いたままにする、という既存の作法をそのまま保てる。
export function useListboxKeyNav<T extends HTMLElement = HTMLUListElement>() {
  const listRef = useRef<T>(null);

  function optionButtons(): HTMLElement[] {
    return Array.from(
      listRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [],
    );
  }

  function moveFocus(delta: number, from?: HTMLElement) {
    const buttons = optionButtons();
    if (buttons.length === 0) return;
    const current = from ? buttons.indexOf(from) : -1;
    // 検索欄からの ↓ は先頭へ、↑ は末尾へ。
    const next =
      current === -1
        ? delta > 0
          ? 0
          : buttons.length - 1
        : (current + delta + buttons.length) % buttons.length;
    buttons[next]?.focus();
  }

  function handleListKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const active = document.activeElement;
      moveFocus(
        e.key === "ArrowDown" ? 1 : -1,
        active instanceof HTMLElement && active.getAttribute("role") === "option"
          ? active
          : undefined,
      );
    }
  }

  return { listRef, handleListKeyDown };
}

import { afterEach, describe, expect, it } from "vitest";

import { isEditableElementFocused } from "./editableFocus";

afterEach(() => {
  document.body.innerHTML = "";
});

function mountAndFocus(html: string): HTMLElement {
  document.body.innerHTML = html;
  const el = document.body.firstElementChild as HTMLElement;
  el.focus();
  return el;
}

describe("isEditableElementFocused", () => {
  it("どこにもフォーカスが無ければ false（＝入力を通す）", () => {
    document.body.innerHTML = "";
    expect(isEditableElementFocused(document)).toBe(false);
  });

  // ★実査で確認済みの対象（2026-08-14）。ここが本ガードの本体である。
  it("文字を入力できる要素にフォーカスがあれば true", () => {
    mountAndFocus(`<input type="text" />`);
    expect(isEditableElementFocused(document)).toBe(true);

    mountAndFocus(`<textarea></textarea>`);
    expect(isEditableElementFocused(document)).toBe(true);

    mountAndFocus(`<input type="number" />`);
    expect(isEditableElementFocused(document)).toBe(true);

    mountAndFocus(`<div contenteditable="true" tabindex="0"></div>`);
    expect(isEditableElementFocused(document)).toBe(true);
  });

  // ★「編集できるか」で判定しているため、書き換えられない欄は通る。
  //   要素の種類で分岐していたらここを取りこぼす。
  it("読み取り専用・無効の入力欄は false", () => {
    mountAndFocus(`<input type="text" readonly />`);
    expect(isEditableElementFocused(document)).toBe(false);

    mountAndFocus(`<input type="text" disabled />`);
    expect(isEditableElementFocused(document)).toBe(false);
  });

  // ★文字を入力しない操作子は通す。チェックボックスの上でキー入力が死ぬと、
  //   ラッシュトグルへフォーカスした瞬間に技が出せなくなる。
  it("文字入力ではない操作子・ただの要素は false", () => {
    mountAndFocus(`<input type="checkbox" />`);
    expect(isEditableElementFocused(document)).toBe(false);

    mountAndFocus(`<button>押す</button>`);
    expect(isEditableElementFocused(document)).toBe(false);

    mountAndFocus(`<div tabindex="0"></div>`);
    expect(isEditableElementFocused(document)).toBe(false);
  });
});

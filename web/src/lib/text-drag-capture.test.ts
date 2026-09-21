import type { PointerEvent as ReactPointerEvent } from "react";
import { describe, expect, it, vi } from "vitest";

import { handleTextDragPointerDown } from "./text-drag-capture";

// ★★ガードの条件そのものはここで固定する(実体が 1 本なので 1 度でよい)。
//   結線されていることは各部品のテストが見る
//   (SearchableSelect.test.tsx ／ TagSelector.test.tsx)。
//
// ★実体(枠外へドラッグしても文字選択が消えないこと)は E2E が測る
//   (web/e2e/m31-02-character-picker-drag.spec.ts ／ m31-02-tag-field-drag.spec.ts)。
//   jsdom には文字選択の実装が無く、ここでは測れない。
//
// ★★タッチ・ペンで張ると、これらの欄を持つ画面のタッチ挙動を変えることになる。
//   E2E は chromium 1 プロジェクトだけでタッチ文脈を持たないため、この分岐は単体で見るしかない。

function fakeEvent(
  pointerType: string,
  button: number,
  setPointerCapture: (id: number) => void,
): ReactPointerEvent<HTMLInputElement> {
  return {
    pointerType,
    button,
    pointerId: 7,
    currentTarget: { setPointerCapture } as unknown as HTMLInputElement,
  } as ReactPointerEvent<HTMLInputElement>;
}

describe("handleTextDragPointerDown", () => {
  it("マウスの主ボタンならキャプチャを張る", () => {
    const spy = vi.fn();
    handleTextDragPointerDown(fakeEvent("mouse", 0, spy));
    expect(spy).toHaveBeenCalledWith(7);
  });

  it("★タッチでは張らない（タッチ環境の挙動を変えないこと）", () => {
    const spy = vi.fn();
    handleTextDragPointerDown(fakeEvent("touch", 0, spy));
    expect(spy).not.toHaveBeenCalled();
  });

  it("★ペンでは張らない", () => {
    const spy = vi.fn();
    handleTextDragPointerDown(fakeEvent("pen", 0, spy));
    expect(spy).not.toHaveBeenCalled();
  });

  it("★右クリックでは張らない", () => {
    const spy = vi.fn();
    handleTextDragPointerDown(fakeEvent("mouse", 2, spy));
    expect(spy).not.toHaveBeenCalled();
  });

  it("★setPointerCapture が投げても落ちない（jsdom には実体が無い）", () => {
    const throwing = () => {
      throw new DOMException("not found", "NotFoundError");
    };
    expect(() =>
      handleTextDragPointerDown(fakeEvent("mouse", 0, throwing)),
    ).not.toThrow();
  });
});

import { renderHook, act } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { useSelectMode } from "./useSelectMode";

describe("useSelectMode", () => {
  it("初期状態は selectMode=false, selectedIds=[]", () => {
    const { result } = renderHook(() => useSelectMode(5));
    expect(result.current.isSelectMode).toBe(false);
    expect(result.current.selectedIds).toEqual([]);
    expect(result.current.isAtMax).toBe(false);
  });

  it("enterSelectMode で選択モードが有効になる", () => {
    const { result } = renderHook(() => useSelectMode(5));
    act(() => result.current.enterSelectMode());
    expect(result.current.isSelectMode).toBe(true);
  });

  it("toggle で ID を追加・除去できる", () => {
    const { result } = renderHook(() => useSelectMode(5));
    let ok: boolean;

    act(() => {
      ok = result.current.toggle(1);
    });
    expect(ok!).toBe(true);
    expect(result.current.selectedIds).toEqual([1]);

    act(() => {
      ok = result.current.toggle(2);
    });
    expect(ok!).toBe(true);
    expect(result.current.selectedIds).toEqual([1, 2]);

    act(() => {
      ok = result.current.toggle(1);
    });
    expect(ok!).toBe(true);
    expect(result.current.selectedIds).toEqual([2]);
  });

  it("上限到達時に toggle は false を返し追加しない", () => {
    const { result } = renderHook(() => useSelectMode(2));

    act(() => result.current.toggle(1));
    act(() => result.current.toggle(2));
    expect(result.current.isAtMax).toBe(true);

    let ok: boolean;
    act(() => {
      ok = result.current.toggle(3);
    });
    expect(ok!).toBe(false);
    expect(result.current.selectedIds).toEqual([1, 2]);
  });

  it("上限到達時でも既存 ID の除去は成功する", () => {
    const { result } = renderHook(() => useSelectMode(2));

    act(() => result.current.toggle(1));
    act(() => result.current.toggle(2));

    let ok: boolean;
    act(() => {
      ok = result.current.toggle(2);
    });
    expect(ok!).toBe(true);
    expect(result.current.selectedIds).toEqual([1]);
    expect(result.current.isAtMax).toBe(false);
  });

  it("clear で selectedIds がリセットされる", () => {
    const { result } = renderHook(() => useSelectMode(5));

    act(() => result.current.toggle(1));
    act(() => result.current.toggle(2));
    act(() => result.current.clear());

    expect(result.current.selectedIds).toEqual([]);
  });

  it("exitSelectMode で selectMode と selectedIds がリセットされる", () => {
    const { result } = renderHook(() => useSelectMode(5));

    act(() => result.current.enterSelectMode());
    act(() => result.current.toggle(1));
    act(() => result.current.exitSelectMode());

    expect(result.current.isSelectMode).toBe(false);
    expect(result.current.selectedIds).toEqual([]);
  });
});

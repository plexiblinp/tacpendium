import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { useColumnVisibility } from "./useColumnVisibility";
import { DEFAULT_COLUMN_VISIBILITY } from "@/constants/combo-list";

const STORAGE_KEY = "combo-list-columns-v1";

beforeEach(() => {
  localStorage.clear();
});

describe("useColumnVisibility", () => {
  it("loads initial state from localStorage", () => {
    const saved = { ...DEFAULT_COLUMN_VISIBILITY, damage: false, memo: false };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));

    const { result } = renderHook(() => useColumnVisibility());
    expect(result.current.visibility.damage).toBe(false);
    expect(result.current.visibility.memo).toBe(false);
    expect(result.current.visibility.recipe).toBe(true);
  });

  it("saves to localStorage when updateVisibility is called", () => {
    const { result } = renderHook(() => useColumnVisibility());

    const next = { ...DEFAULT_COLUMN_VISIBILITY, tags: false };
    act(() => {
      result.current.updateVisibility(next);
    });

    expect(result.current.visibility.tags).toBe(false);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.tags).toBe(false);
  });

  it("removes localStorage and resets to default on resetVisibility", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...DEFAULT_COLUMN_VISIBILITY, damage: false }),
    );
    const { result } = renderHook(() => useColumnVisibility());
    expect(result.current.visibility.damage).toBe(false);

    act(() => {
      result.current.resetVisibility();
    });

    expect(result.current.visibility).toEqual(DEFAULT_COLUMN_VISIBILITY);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("merges old structure with defaults for forward compatibility", () => {
    const partial = { damage: false, recipe: true };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(partial));

    const { result } = renderHook(() => useColumnVisibility());

    // ★保存されていたキーは保存値が勝つ。
    expect(result.current.visibility.damage).toBe(false);
    expect(result.current.visibility.recipe).toBe(true);

    // ★★保存に無かったキーは「既定へ落ちる」。
    //   ここは値をベタ書きしない——既定そのものが変わりうるためである
    //   (M24-03 で memo / setupCount が既定 OFF になったとき、literal の true を
    //    書いていた本テストが落ちた。M24-01 §7-8 の「数ではなく定義から導く」と同じ型)。
    expect(result.current.visibility).toEqual({
      ...DEFAULT_COLUMN_VISIBILITY,
      ...partial,
    });
  });
});

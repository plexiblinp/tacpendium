import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi, afterEach } from "vitest";

import { useIsMobile } from "./useIsMobile";

type ChangeListener = (e: MediaQueryListEvent) => void;

function createMockMatchMedia(initialMatches: boolean) {
  let matches = initialMatches;
  let listener: ChangeListener | null = null;

  const mql = {
    get matches() {
      return matches;
    },
    media: "(max-width: 639px)",
    addEventListener: vi.fn((_event: string, cb: ChangeListener) => {
      listener = cb;
    }),
    removeEventListener: vi.fn((_event: string, _cb: ChangeListener) => {
      listener = null;
    }),
  };

  const setMatches = (value: boolean) => {
    matches = value;
    if (listener) {
      listener({ matches: value } as MediaQueryListEvent);
    }
  };

  return { mql, setMatches };
}

describe("useIsMobile", () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it("returns true when viewport is below 640px", () => {
    const { mql } = createMockMatchMedia(true);
    window.matchMedia = vi.fn(() => mql as unknown as MediaQueryList);

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it("returns false when viewport is 640px or above", () => {
    const { mql } = createMockMatchMedia(false);
    window.matchMedia = vi.fn(() => mql as unknown as MediaQueryList);

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it("updates when media query change event fires", () => {
    const { mql, setMatches } = createMockMatchMedia(false);
    window.matchMedia = vi.fn(() => mql as unknown as MediaQueryList);

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    act(() => {
      setMatches(true);
    });
    expect(result.current).toBe(true);
  });

  it("cleans up event listener on unmount", () => {
    const { mql } = createMockMatchMedia(false);
    window.matchMedia = vi.fn(() => mql as unknown as MediaQueryList);

    const { unmount } = renderHook(() => useIsMobile());
    unmount();

    expect(mql.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });
});

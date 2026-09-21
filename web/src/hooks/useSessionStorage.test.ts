import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

import { useSessionStorage } from "./useSessionStorage";

beforeEach(() => {
  sessionStorage.clear();
});

describe("useSessionStorage", () => {
  it("初期値を返す（sessionStorage に値がない場合）", () => {
    const { result } = renderHook(() => useSessionStorage("test-key", [1, 2]));
    expect(result.current[0]).toEqual([1, 2]);
  });

  it("sessionStorage に保存された値を読み取る", () => {
    sessionStorage.setItem("test-key", JSON.stringify([3, 4, 5]));
    const { result } = renderHook(() => useSessionStorage<number[]>("test-key", []));
    expect(result.current[0]).toEqual([3, 4, 5]);
  });

  it("setValue で値を更新し sessionStorage に保存する", () => {
    const { result } = renderHook(() => useSessionStorage<number[]>("test-key", []));

    act(() => {
      result.current[1]([10, 20]);
    });

    expect(result.current[0]).toEqual([10, 20]);
    expect(JSON.parse(sessionStorage.getItem("test-key")!)).toEqual([10, 20]);
  });

  it("関数型の setValue でも正しく更新される", () => {
    const { result } = renderHook(() => useSessionStorage<number[]>("test-key", [1]));

    act(() => {
      result.current[1]((prev) => [...prev, 2]);
    });

    expect(result.current[0]).toEqual([1, 2]);
  });

  it("sessionStorage が使用不可でもクラッシュしない", () => {
    const getItemSpy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });

    const { result } = renderHook(() => useSessionStorage("test-key", "default"));
    expect(result.current[0]).toBe("default");

    act(() => {
      result.current[1]("new-value");
    });

    expect(result.current[0]).toBe("new-value");

    getItemSpy.mockRestore();
    setItemSpy.mockRestore();
  });

  it("不正な JSON が保存されている場合は初期値を返す", () => {
    sessionStorage.setItem("test-key", "not-valid-json");
    const { result } = renderHook(() => useSessionStorage("test-key", "fallback"));
    expect(result.current[0]).toBe("fallback");
  });
});

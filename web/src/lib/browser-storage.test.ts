import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createLocalStorageHelper,
  createSessionStorageHelper,
} from "./browser-storage";

describe("createLocalStorageHelper", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("save then load returns the same value (primitive)", () => {
    const helper = createLocalStorageHelper<number>("test-prim-v1");
    helper.save(42);
    expect(helper.load()).toBe(42);
  });

  it("save then load returns the same value (object)", () => {
    const helper = createLocalStorageHelper<{ a: number; b: string }>(
      "test-obj-v1",
    );
    const value = { a: 1, b: "hello" };
    helper.save(value);
    expect(helper.load()).toEqual(value);
  });

  it("save then load returns the same value (array)", () => {
    const helper = createLocalStorageHelper<number[]>("test-arr-v1");
    helper.save([1, 2, 3]);
    expect(helper.load()).toEqual([1, 2, 3]);
  });

  it("load returns null for a key that was never saved", () => {
    const helper = createLocalStorageHelper<string>("missing-v1");
    expect(helper.load()).toBeNull();
  });

  it("load returns null when stored JSON is invalid", () => {
    localStorage.setItem("corrupt-v1", "{{not-json");
    const helper = createLocalStorageHelper<unknown>("corrupt-v1");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(helper.load()).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("save returns false and warns on QuotaExceededError", () => {
    const helper = createLocalStorageHelper<string>("quota-v1");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const setItemSpy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("quota exceeded", "QuotaExceededError");
      });

    expect(helper.save("large-data")).toBe(false);
    expect(warnSpy).toHaveBeenCalled();

    setItemSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("remove then load returns null", () => {
    const helper = createLocalStorageHelper<string>("rm-v1");
    helper.save("value");
    expect(helper.load()).toBe("value");
    helper.remove();
    expect(helper.load()).toBeNull();
  });

  it("multiple keys do not interfere with each other", () => {
    const helperA = createLocalStorageHelper<number>("key-a-v1");
    const helperB = createLocalStorageHelper<number>("key-b-v1");
    helperA.save(10);
    helperB.save(20);
    expect(helperA.load()).toBe(10);
    expect(helperB.load()).toBe(20);
    helperA.remove();
    expect(helperA.load()).toBeNull();
    expect(helperB.load()).toBe(20);
  });
});

describe("createSessionStorageHelper", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("save then load round-trips via sessionStorage", () => {
    const helper = createSessionStorageHelper<string>("sess-v1");
    helper.save("character_id=2&sort=damage");
    expect(helper.load()).toBe("character_id=2&sort=damage");
    expect(sessionStorage.getItem("sess-v1")).not.toBeNull();
  });

  it("uses sessionStorage, not localStorage", () => {
    const helper = createSessionStorageHelper<string>("sess-isolation-v1");
    helper.save("x=1");
    expect(localStorage.getItem("sess-isolation-v1")).toBeNull();
  });

  it("load returns null for a key that was never saved", () => {
    const helper = createSessionStorageHelper<string>("sess-missing-v1");
    expect(helper.load()).toBeNull();
  });

  it("remove then load returns null", () => {
    const helper = createSessionStorageHelper<string>("sess-rm-v1");
    helper.save("value");
    helper.remove();
    expect(helper.load()).toBeNull();
  });
});

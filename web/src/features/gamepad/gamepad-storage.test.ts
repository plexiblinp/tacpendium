import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  GAMEPAD_PROFILES_STORAGE_KEY,
  loadProfileStore,
  saveProfileStore,
} from "./gamepad-storage";
import { profileKey } from "./profile";
import type { GamepadProfile, GamepadProfileStore } from "./types";

const PAD_ID = "Test Controller";

const profile: GamepadProfile = {
  version: 1,
  padId: PAD_ID,
  browserKey: "chromium",
  directions: { up: { kind: "button", index: 12 } },
  buttons: { light_punch: { kind: "button", index: 0 } },
};

const store: GamepadProfileStore = {
  [profileKey("chromium", PAD_ID)]: profile,
};

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("(j) ヘルパ経由の保存・復元", () => {
  it("(j) 保存した内容を復元できる", () => {
    expect(saveProfileStore(store)).toBe(true);
    expect(loadProfileStore()).toEqual(store);
  });

  it("(j') 台帳掲載どおりのキーで保存する", () => {
    // web/CLAUDE.md §1 #8。キー名がずれると check-browser-storage-keys.sh が赤になる。
    expect(GAMEPAD_PROFILES_STORAGE_KEY).toBe("gamepad-profiles-v1");

    saveProfileStore(store);
    expect(localStorage.getItem("gamepad-profiles-v1")).toBeTruthy();
  });

  it("(j'') 未保存なら空の store を返す", () => {
    expect(loadProfileStore()).toEqual({});
  });

  it("(j''') 壊れた JSON が入っていても空の store を返す", () => {
    localStorage.setItem(GAMEPAD_PROFILES_STORAGE_KEY, "{ not json");

    expect(() => loadProfileStore()).not.toThrow();
    expect(loadProfileStore()).toEqual({});
  });

  it("(j'''') 配列など想定外の形が入っていても空の store を返す", () => {
    localStorage.setItem(GAMEPAD_PROFILES_STORAGE_KEY, "[1,2,3]");

    expect(loadProfileStore()).toEqual({});
  });

});

describe("(k) 保存が失敗しても壊れない", () => {
  it("(k) setItem が例外を投げても throw せず false を返す", () => {
    // 容量制限・プライベートブラウジング等の再現。
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    expect(() => saveProfileStore(store)).not.toThrow();
    expect(saveProfileStore(store)).toBe(false);
  });

  it("(k') getItem が例外を投げても throw せず空を返す", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });

    expect(() => loadProfileStore()).not.toThrow();
    expect(loadProfileStore()).toEqual({});
  });

});

import { describe, expect, it } from "vitest";

import {
  EXCLUSION_MESSAGE,
  keyExclusionReason,
  keyLabel,
} from "./excludedKeys";
import type { KeyExclusionReason } from "./excludedKeys";

const NO_MODIFIERS = { ctrlKey: false, altKey: false, metaKey: false };

describe("keyExclusionReason", () => {
  it("通常のキーは登録できる", () => {
    for (const code of ["KeyW", "KeyJ", "Digit1", "Numpad4", "ArrowLeft", "Semicolon"]) {
      expect(keyExclusionReason(code, NO_MODIFIERS)).toBe(null);
    }
  });

  it("ファンクションキーは F1〜F24 まで除外する", () => {
    for (const n of [1, 5, 9, 10, 12, 24]) {
      expect(keyExclusionReason(`F${n}`, NO_MODIFIERS)).toBe("function_key");
    }
  });

  it("F25 以降・Fxx に似た通常キーは巻き込まない", () => {
    expect(keyExclusionReason("F25", NO_MODIFIERS)).toBe(null);
    expect(keyExclusionReason("KeyF", NO_MODIFIERS)).toBe(null);
  });

  it("Windows / Command キーを除外する", () => {
    expect(keyExclusionReason("MetaLeft", NO_MODIFIERS)).toBe("os_key");
    expect(keyExclusionReason("MetaRight", NO_MODIFIERS)).toBe("os_key");
    expect(keyExclusionReason("OSLeft", NO_MODIFIERS)).toBe("os_key");
  });

  it("修飾キー単体を除外する", () => {
    for (const code of [
      "ControlLeft",
      "AltLeft",
      "AltRight",
      "ShiftRight",
      "CapsLock",
      "NumLock",
    ]) {
      expect(keyExclusionReason(code, NO_MODIFIERS)).toBe("modifier_key");
    }
  });

  it("画面操作キー・実行キーを除外する", () => {
    expect(keyExclusionReason("Tab", NO_MODIFIERS)).toBe("navigation_key");
    expect(keyExclusionReason("Escape", NO_MODIFIERS)).toBe("navigation_key");
    expect(keyExclusionReason("Enter", NO_MODIFIERS)).toBe("activation_key");
    expect(keyExclusionReason("NumpadEnter", NO_MODIFIERS)).toBe("activation_key");
  });

  // ★2026-08-14 開発者要求。格闘ゲームの操作として Space を使う利用者が実在するため。
  //   代償（フォーカス中のボタンを Space で実行できなくなる）は excludedKeys.ts の注記を参照。
  it("★Space は登録できる（Enter は引き続き除外）", () => {
    expect(keyExclusionReason("Space", NO_MODIFIERS)).toBe(null);
    expect(keyExclusionReason("Enter", NO_MODIFIERS)).toBe("activation_key");
  });

  it("Space も既定動作を持つキーとして扱える（ラベルは code から導く）", () => {
    // `key` は " "（空白 1 文字）で印字できないため、code から構造的に導く。
    expect(keyLabel("Space", " ")).toBe("Space");
  });

  it("OS・ブラウザの専用キーを除外する", () => {
    expect(keyExclusionReason("PrintScreen", NO_MODIFIERS)).toBe("system_key");
    expect(keyExclusionReason("BrowserBack", NO_MODIFIERS)).toBe("system_key");
    expect(keyExclusionReason("AudioVolumeUp", NO_MODIFIERS)).toBe("system_key");
  });

  it("code が空の入力は識別子にならないため除外する", () => {
    expect(keyExclusionReason("", NO_MODIFIERS)).toBe("system_key");
  });

  it("修飾キーとの同時押しは、単体では登録できるキーでも除外する", () => {
    expect(keyExclusionReason("KeyJ", { ...NO_MODIFIERS, ctrlKey: true })).toBe(
      "modified_chord",
    );
    expect(keyExclusionReason("KeyJ", { ...NO_MODIFIERS, altKey: true })).toBe(
      "modified_chord",
    );
    expect(keyExclusionReason("KeyJ", { ...NO_MODIFIERS, metaKey: true })).toBe(
      "modified_chord",
    );
  });

  it("Shift の同時押しは除外しない（文字の大小であり、ブラウザ操作と衝突しない）", () => {
    expect(keyExclusionReason("KeyJ", NO_MODIFIERS)).toBe(null);
  });

  // ★修飾キーを単体で押すと、そのイベント自身が ctrlKey / altKey / metaKey を伴う。
  //   同時押し判定を先に置くと「Ctrl を押しながらのキー」と案内され、単独で押した利用者に
  //   噛み合わない（レビュー指摘 低-1）。
  it("修飾キー単体は、同時押しではなく修飾キー単体として拒否される", () => {
    expect(keyExclusionReason("ControlLeft", { ...NO_MODIFIERS, ctrlKey: true })).toBe(
      "modifier_key",
    );
    expect(keyExclusionReason("AltLeft", { ...NO_MODIFIERS, altKey: true })).toBe(
      "modifier_key",
    );
    expect(keyExclusionReason("MetaLeft", { ...NO_MODIFIERS, metaKey: true })).toBe(
      "os_key",
    );
  });

  it("ファンクションキーは修飾キーと同時でもファンクションキーとして拒否される", () => {
    expect(keyExclusionReason("F5", { ...NO_MODIFIERS, ctrlKey: true })).toBe(
      "function_key",
    );
  });

  // ★§4.3-2。無反応で弾かないための担保——すべての理由に利用者向けの文言がある。
  it("すべての除外理由に利用者向けの文言がある", () => {
    const reasons: KeyExclusionReason[] = [
      "function_key",
      "os_key",
      "modifier_key",
      "navigation_key",
      "activation_key",
      "system_key",
      "modified_chord",
    ];
    for (const reason of reasons) {
      expect(EXCLUSION_MESSAGE[reason].length).toBeGreaterThan(0);
    }
  });
});

describe("keyLabel", () => {
  it("刻印されている文字を優先する（配列が QWERTY でなくても正しい）", () => {
    expect(keyLabel("KeyJ", "j")).toBe("J");
    // AZERTY で KeyQ を押すと key は "a" になる。ラベルは実際の文字を出す。
    expect(keyLabel("KeyQ", "a")).toBe("A");
  });

  it("印字できないキーは code から構造的に導く", () => {
    expect(keyLabel("ArrowLeft", "ArrowLeft")).toBe("←");
    expect(keyLabel("Numpad4", "Unidentified")).toBe("テンキー4");
    expect(keyLabel("KeyW", "Unidentified")).toBe("W");
    expect(keyLabel("Digit1", "Unidentified")).toBe("1");
    expect(keyLabel("Backspace", "Backspace")).toBe("Backspace");
  });
});

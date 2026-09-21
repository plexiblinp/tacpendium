import { describe, it, expect } from "vitest";

import {
  dirtyKey,
  isChangedFromInitial,
  normalizeForDirtyCheck,
} from "./dirty";

// M24-04(CO-003): dirty の判定は「初期値と現在値の比較」で行う。
// ★空文字・null・未設定を同一視しないと、編集画面が開いた瞬間に dirty になる
//   (入力欄は未入力を "" で持ち、API から読んだ値は null で来るため)。
describe("normalizeForDirtyCheck(未設定の同一視)", () => {
  it("空文字・null・undefined はすべて未設定として同じになる", () => {
    expect(normalizeForDirtyCheck("")).toBeNull();
    expect(normalizeForDirtyCheck(null)).toBeNull();
    expect(normalizeForDirtyCheck(undefined)).toBeNull();
  });

  it("★0 と false は値である。未設定に丸めない", () => {
    expect(normalizeForDirtyCheck(0)).toBe(0);
    expect(normalizeForDirtyCheck(false)).toBe(false);
  });

  it("未設定のキーは落とす(「キーが無い」と「空文字」を同じに扱う)", () => {
    expect(dirtyKey({ memo: "", link: null })).toBe(dirtyKey({}));
  });

  it("キーの順序が違っても同じキーになる", () => {
    expect(dirtyKey({ a: 1, b: 2 })).toBe(dirtyKey({ b: 2, a: 1 }));
  });

  it("配列は順序を保つ(レシピの並べ替えは変更である)", () => {
    expect(dirtyKey([1, 2])).not.toBe(dirtyKey([2, 1]));
  });
});

describe("isChangedFromInitial", () => {
  it("読み込んだ値(null)を空欄(空文字)として描いても変更ではない", () => {
    const loaded = { memo: null, damage: null, tagIds: [] };
    const shown = { memo: "", damage: "", tagIds: [] };
    expect(isChangedFromInitial(loaded, shown)).toBe(false);
  });

  it("1 文字でも入力すれば変更である", () => {
    expect(isChangedFromInitial({ memo: "" }, { memo: "あ" })).toBe(true);
  });

  it("入力を消して元へ戻せば変更ではなくなる", () => {
    expect(isChangedFromInitial({ memo: "" }, { memo: "" })).toBe(false);
  });

  it("入れ子(レシピのステップ)の差分も見る", () => {
    const before = { steps: [{ moveId: 1, modifiers: undefined }] };
    const after = { steps: [{ moveId: 2, modifiers: undefined }] };
    expect(isChangedFromInitial(before, after)).toBe(true);
  });

  it("0 と空文字は別物である(ダメージ 0 は入力である)", () => {
    expect(isChangedFromInitial({ damage: "" }, { damage: "0" })).toBe(true);
  });
});

import { describe, expect, it } from "vitest";

import { PresetApiError } from "./api";
import { presetErrorMessage } from "./errorMessage";

function apiError(code: string, message: string, details?: Record<string, unknown>) {
  return new PresetApiError(409, { error: { code, message, details } }, "HTTP 409");
}

describe("presetErrorMessage", () => {
  it("サーバーが返したメッセージを優先する", () => {
    const err = apiError("preset_limit_exceeded", "プリセットは全体で 8 件までです");
    expect(presetErrorMessage(err, "失敗しました")).toBe(
      "プリセットは全体で 8 件までです",
    );
  });

  it("API エラーでなければフォールバックを返す", () => {
    expect(presetErrorMessage(new Error("boom"), "失敗しました")).toBe("失敗しました");
  });

  it("メッセージが空ならフォールバックを返す", () => {
    expect(presetErrorMessage(apiError("x", "  "), "失敗しました")).toBe("失敗しました");
  });
});

describe("PresetApiError", () => {
  it("★衝突した表記を details から取り出せる(fetchJSON では取れない情報)", () => {
    const err = apiError("alias_conflict", "「5LP」が重複しています", {
      aliasText: "5LP",
    });
    expect(err.code).toBe("alias_conflict");
    expect(err.conflictAliasText).toBe("5LP");
  });

  it("本体が読めなかった場合は undefined を返す", () => {
    const err = new PresetApiError(500, null, "HTTP 500");
    expect(err.code).toBeUndefined();
    expect(err.conflictAliasText).toBeUndefined();
    expect(err.serverMessage).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";

import { ApiError } from "./api";
import { classifySaveError, isConflictDialogKind } from "./saveError";
import type { ComboErrorResponse } from "./types";

function apiError(status: number, body: ComboErrorResponse | null): ApiError {
  return new ApiError(status, body, body?.error?.message ?? `HTTP ${status}`);
}

function errBody(code: string, message = "msg"): ComboErrorResponse {
  return { error: { code, message } };
}

describe("classifySaveError", () => {
  it("版不一致(409 + version_conflict)を versionConflict に分類する", () => {
    const r = classifySaveError(apiError(409, errBody("version_conflict")));
    expect(r.kind).toBe("versionConflict");
    expect(r.code).toBe("version_conflict");
  });

  // ★最重要ゲート 2 の網。409 は一意制約違反でも返るため、ステータスで分岐すると
  //   ここが versionConflict になり「ほかの人が変更しました」と表示される。
  //   ⇒ 破壊確認 B(判定を status === 409 だけへ戻す)は本ブロックを赤にする。
  describe("★同じ 409 でも、一意制約違反は versionConflict にならない", () => {
    const uniqueConflictCodes = [
      "alias_conflict",
      "preset_name_duplicate",
      "preset_limit_exceeded",
      "preset_in_use_by_config",
      "tag_name_duplicate",
      "user_name_duplicate",
      "combo_not_in_trash",
      "rush_variant_exists",
    ];

    for (const code of uniqueConflictCodes) {
      it(`${code} は versionConflict ではない`, () => {
        const r = classifySaveError(apiError(409, errBody(code)));
        expect(r.kind).not.toBe("versionConflict");
        expect(r.kind).toBe("other");
      });
    }

    it("duplicate_setup は duplicateSetup であって versionConflict ではない", () => {
      const r = classifySaveError(apiError(409, errBody("duplicate_setup")));
      expect(r.kind).toBe("duplicateSetup");
      expect(r.kind).not.toBe("versionConflict");
    });
  });

  it("404 + not_found を notFound に分類する(キー変更編集に負けた側の経路)", () => {
    const r = classifySaveError(apiError(404, errBody("not_found", "コンボが見つかりません")));
    expect(r.kind).toBe("notFound");
    expect(r.message).toBe("コンボが見つかりません");
  });

  it("400 + details.validations を validation に分類する", () => {
    const err = apiError(400, {
      error: {
        code: "validation_failed",
        message: "invalid",
        details: {
          validations: {
            issues: [{ code: "VAL-C02", severity: "error", field: "recipe", message: "重複" }],
          },
        },
      },
    });
    const r = classifySaveError(err);
    expect(r.kind).toBe("validation");
    expect(r.validations?.issues).toHaveLength(1);
  });

  it("5xx は other に分類する", () => {
    const r = classifySaveError(apiError(500, errBody("internal_error", "サーバーエラー")));
    expect(r.kind).toBe("other");
    expect(r.message).toBe("サーバーエラー");
  });

  it("応答本文が読めない場合(body=null)も other になり message はステータス由来", () => {
    const r = classifySaveError(apiError(503, null));
    expect(r.kind).toBe("other");
    expect(r.code).toBeNull();
    expect(r.message).toBe("HTTP 503");
  });

  it("ApiError でない Error(通信断など)は other になり message を保持する", () => {
    const r = classifySaveError(new Error("Failed to fetch"));
    expect(r.kind).toBe("other");
    expect(r.code).toBeNull();
    expect(r.message).toBe("Failed to fetch");
  });

  it("Error ですらない値は message が null(呼び出し元のフォールバックに委ねる)", () => {
    const r = classifySaveError("boom");
    expect(r.kind).toBe("other");
    expect(r.message).toBeNull();
  });
});

describe("isConflictDialogKind", () => {
  it("versionConflict と notFound だけが競合モーダルの対象である", () => {
    expect(isConflictDialogKind("versionConflict")).toBe(true);
    expect(isConflictDialogKind("notFound")).toBe(true);
    expect(isConflictDialogKind("duplicateSetup")).toBe(false);
    expect(isConflictDialogKind("validation")).toBe(false);
    expect(isConflictDialogKind("other")).toBe(false);
  });
});

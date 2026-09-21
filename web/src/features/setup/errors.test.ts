import { describe, it, expect } from "vitest";

import { ApiError } from "@/features/combo/api";
import { parseSetupApiError } from "./errors";

describe("parseSetupApiError", () => {
  it("400 + details.validations をバリデーションとして返す(バグ#6 VAL-S02)", () => {
    const validations = {
      issues: [
        { code: "VAL-S02", severity: "error" as const, field: "steps", message: "レシピが空です" },
      ],
    };
    const err = new ApiError(
      400,
      { error: { code: "validation_failed", message: "バリデーションエラーがあります", details: { validations } } },
      "バリデーションエラーがあります",
    );
    const parsed = parseSetupApiError(err);
    expect(parsed.validations).toEqual(validations);
    expect(parsed.kind).toBe("validation");
    expect(parsed.fatalMessage).toBeNull();
  });

  it("version_conflict を版不一致として返す", () => {
    const err = new ApiError(
      409,
      { error: { code: "version_conflict", message: "他で更新されています" } },
      "他で更新されています",
    );
    const parsed = parseSetupApiError(err);
    expect(parsed.validations).toBeNull();
    expect(parsed.kind).toBe("versionConflict");
  });

  // ★★M22-04(D-416)で主張を反転させた。Header.test.tsx / D-308 と同じ扱いである。
  //
  // 旧: 「409 の分類はエラーコード文字列に依存しない」。M22-03 が「409 の見せ方は
  //     M22-04 の担当」としてコード分岐を足さなかったことを守っていた。
  // ⇒ その結果、同一レシピ重複(duplicate_setup)まで版不一致と同じ扱いになり、
  //   画面には「他のタブで更新されています。ページを再読み込みして…」と出ていた。
  //   これは指示書 §1.3 が最重要ゲート 2 として名指しした取り違えそのものである。
  // 新: エラーコードで分岐する(§4.2-1・§4.2-5)。期待値を緩めるのではなく主張を
  //   作り替えた。
  //
  // ★本ブロックは破壊確認 B の的である——判定をステータス 409 だけへ戻すと赤くなる。
  it("★duplicate_setup は版不一致と別の分類になる(同じ 409 でも取り違えない)", () => {
    const err = new ApiError(
      409,
      { error: { code: "duplicate_setup", message: "同一レシピのセットプレイが既に紐付いています" } },
      "同一レシピのセットプレイが既に紐付いています",
    );
    const parsed = parseSetupApiError(err);
    expect(parsed.kind).toBe("duplicateSetup");
    expect(parsed.kind).not.toBe("versionConflict");
  });

  // ★対照実験: 版不一致でないコードは版不一致にしない。
  // これが無いと「常に versionConflict を返す」実装でも上の主張が緑になりうる。
  it("★対照: version_conflict 以外のコードは版不一致にならない", () => {
    const err = new ApiError(
      500,
      { error: { code: "internal_error", message: "サーバーエラー" } },
      "サーバーエラー",
    );
    expect(parseSetupApiError(err).kind).toBe("other");
  });

  // ★★判定にステータスは参加しない、を意図として固定する。
  //
  // 旧テストは「500 + version_conflict は衝突にしない」を主張していた
  // (M22-03 の分類がステータス由来だったため)。M22-04 でコード由来へ変えたので
  // その主張は成立しない——期待値を緩めるのではなく、実装の性質を正面から書く。
  // ⇒ 「ステータスも見ている」と後任が読まないための番人である。
  it("★ステータスは判定に参加しない(コードが version_conflict なら 500 でも版不一致)", () => {
    const err = new ApiError(
      500,
      { error: { code: "version_conflict", message: "衝突" } },
      "衝突",
    );
    expect(parseSetupApiError(err).kind).toBe("versionConflict");
  });

  it("500 等は fatalMessage を返す", () => {
    const err = new ApiError(500, null, "HTTP 500");
    const parsed = parseSetupApiError(err);
    expect(parsed.validations).toBeNull();
    expect(parsed.kind).toBe("other");
    expect(parsed.fatalMessage).toBe("HTTP 500");
  });

  it("ApiError 以外の Error は fatalMessage を返す", () => {
    const parsed = parseSetupApiError(new Error("ネットワークエラー"));
    expect(parsed.validations).toBeNull();
    expect(parsed.kind).toBe("other");
    expect(parsed.fatalMessage).toBe("ネットワークエラー");
  });
});

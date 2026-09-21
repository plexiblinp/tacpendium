import { describe, it, expect } from "vitest";

import { materializeErrorMessage } from "./materializeError";

// ★★M31-01 レビュー(高-1): materialize の失敗理由を画面へ届ける。
//   着手前は理由を捨てており、利用者は「なぜ作れないのか」を知る手段が無かった。
describe("materializeErrorMessage", () => {
  it("★VAL-C15 の検証エラーは、各 issue の message を並べて出す", () => {
    const body = JSON.stringify({
      error: {
        code: "validation_failed",
        details: {
          validations: {
            issues: [
              { code: "VAL-C15", severity: "error", field: "damage", message: "ダメージは本登録では必須です" },
              { code: "VAL-C15", severity: "error", field: "saGaugeConsumed", message: "SAゲージ消費は本登録では必須です" },
            ],
          },
        },
      },
    });
    const msg = materializeErrorMessage(new Error(`HTTP 400: ${body}`));
    expect(msg).toContain("ダメージは本登録では必須です");
    expect(msg).toContain("SAゲージ消費は本登録では必須です");
  });

  // ★警告は理由にならない。⇒ error だけを拾う。
  it("★warning は出さない", () => {
    const body = JSON.stringify({
      error: {
        details: {
          validations: {
            issues: [{ code: "VAL-C11", severity: "warning", field: "okiOptions", message: "ノーゲージ版がありません" }],
          },
        },
      },
    });
    const msg = materializeErrorMessage(new Error(`HTTP 400: ${body}`));
    expect(msg).not.toContain("ノーゲージ版がありません");
  });

  // ★JSON でない失敗(通信エラー等)でも握り潰さない。
  it("★JSON でない Error は元の message を残す", () => {
    const msg = materializeErrorMessage(new Error("Failed to fetch"));
    expect(msg).toContain("Failed to fetch");
  });

  it("★Error ですらない値でも文言を返す(落ちない)", () => {
    expect(materializeErrorMessage(undefined)).toContain("生成に失敗しました");
  });
});

import { describe, expect, it } from "vitest";

import ja from "./ja.json";
import en from "./en.json";

// ja↔en のキー集合が一致することを検証する(改善レーン F2)。
// fallbackLng="ja" のため、en に無いキーは英語設定でも日本語が混在表示される。
// 逆方向(en のみのキー)はデッドキーとして蓄積するため、両方向を機械的に禁止する。
// キー追加時は必ず両ロケールへ同時に追加すること。

function flattenKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([key, value]) =>
    typeof value === "object" && value !== null
      ? flattenKeys(value as Record<string, unknown>, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

describe("locales key parity", () => {
  it("ja のキーはすべて en に存在する(英語設定での日本語混在防止)", () => {
    const jaKeys = flattenKeys(ja);
    const enKeys = new Set(flattenKeys(en));
    const missing = jaKeys.filter((k) => !enKeys.has(k));
    expect(missing).toEqual([]);
  });

  it("en のキーはすべて ja に存在する(デッドキー蓄積防止)", () => {
    const enKeys = flattenKeys(en);
    const jaKeys = new Set(flattenKeys(ja));
    const missing = enKeys.filter((k) => !jaKeys.has(k));
    expect(missing).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";

import { defaultCopyName } from "./PresetCopyDialog";

describe("defaultCopyName", () => {
  it("「<ベース名> のコピー」を既定にする", () => {
    expect(
      defaultCopyName({
        id: 5,
        code: "srk",
        name: "SRK 記法",
        isBuiltin: true,
      }),
    ).toBe("SRK 記法 のコピー");
  });

  it("ベースが無ければ空文字", () => {
    expect(defaultCopyName(null)).toBe("");
  });
});

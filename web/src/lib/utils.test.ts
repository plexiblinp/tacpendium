import { describe, it, expect } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("複数クラスをマージできる", () => {
    expect(cn("px-2", "py-4")).toBe("px-2 py-4");
  });
  it("条件付きクラスを処理できる", () => {
    expect(cn("base", false && "hidden", "active")).toBe("base active");
  });
  it("Tailwind の衝突を解決できる", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
});

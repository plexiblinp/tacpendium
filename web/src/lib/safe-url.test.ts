import { describe, it, expect } from "vitest";

import { isSafeHttpUrl } from "./safe-url";

describe("isSafeHttpUrl (M17-01)", () => {
  it("http/https で始まる URL のみ true", () => {
    expect(isSafeHttpUrl("http://example.com")).toBe(true);
    expect(isSafeHttpUrl("https://example.com/guide?x=1#frag")).toBe(true);
  });

  it("大文字小文字・前後空白を許容する", () => {
    expect(isSafeHttpUrl("HTTPS://EXAMPLE.COM")).toBe(true);
    expect(isSafeHttpUrl("  https://example.com  ")).toBe(true);
  });

  it("危険スキーム・非 URL 文字列は false(非リンク化=XSS 無害化)", () => {
    expect(isSafeHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeHttpUrl("JavaScript:alert(1)")).toBe(false);
    expect(isSafeHttpUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(isSafeHttpUrl("file:///etc/passwd")).toBe(false);
    expect(isSafeHttpUrl("vbscript:msgbox(1)")).toBe(false);
    expect(isSafeHttpUrl("ftp://example.com")).toBe(false);
  });

  it("相対パス・スキームなし・偽装プレフィックスは false", () => {
    expect(isSafeHttpUrl("videos/ryu-bnb.mp4")).toBe(false);
    expect(isSafeHttpUrl("example.com")).toBe(false);
    expect(isSafeHttpUrl("httpx://example.com")).toBe(false);
    expect(isSafeHttpUrl("")).toBe(false);
    expect(isSafeHttpUrl("   ")).toBe(false);
  });
});

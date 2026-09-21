import { describe, it, expect } from "vitest";

import { interceptedHrefFromClick, type LinkClickLike } from "./linkClick";

const HERE = "https://app.example/combos/new";

function click(overrides: Partial<LinkClickLike> = {}): LinkClickLike {
  return {
    defaultPrevented: false,
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    anchor: {
      href: "https://app.example/combos",
      target: "",
      hasDownload: false,
    },
    ...overrides,
  };
}

// M24-04(CO-003): 画面内リンクのクリックだけを横取りする。
// ★横取りしすぎると「新しいタブで開く」やダウンロードが壊れる。
describe("interceptedHrefFromClick(横取りしてよいクリックか)", () => {
  it("画面内リンクの通常クリックは遷移先を返す", () => {
    expect(interceptedHrefFromClick(click(), HERE)).toBe("/combos");
  });

  it("クエリとハッシュも保つ", () => {
    const c = click({
      anchor: {
        href: "https://app.example/combos?character_id=1#top",
        target: "",
        hasDownload: false,
      },
    });
    expect(interceptedHrefFromClick(c, HERE)).toBe("/combos?character_id=1#top");
  });

  it.each([
    ["既に preventDefault 済み", { defaultPrevented: true }],
    ["中クリック", { button: 1 }],
    ["Ctrl 押下(新しいタブ)", { ctrlKey: true }],
    ["Meta 押下(新しいタブ)", { metaKey: true }],
    ["Shift 押下(新しいウィンドウ)", { shiftKey: true }],
    ["Alt 押下(ダウンロード)", { altKey: true }],
  ])("%s は横取りしない", (_label, overrides) => {
    expect(
      interceptedHrefFromClick(click(overrides as Partial<LinkClickLike>), HERE),
    ).toBeNull();
  });

  it("リンクの外側のクリックは横取りしない", () => {
    expect(interceptedHrefFromClick(click({ anchor: null }), HERE)).toBeNull();
  });

  it("別ウィンドウで開くリンクは横取りしない", () => {
    const c = click({
      anchor: {
        href: "https://app.example/combos",
        target: "_blank",
        hasDownload: false,
      },
    });
    expect(interceptedHrefFromClick(c, HERE)).toBeNull();
  });

  it("download 属性つきは横取りしない(エクスポートの保存を壊さない)", () => {
    const c = click({
      anchor: {
        href: "https://app.example/export.csv",
        target: "",
        hasDownload: true,
      },
    });
    expect(interceptedHrefFromClick(c, HERE)).toBeNull();
  });

  it("別オリジンは横取りしない", () => {
    const c = click({
      anchor: {
        href: "https://other.example/combos",
        target: "",
        hasDownload: false,
      },
    });
    expect(interceptedHrefFromClick(c, HERE)).toBeNull();
  });

  it.each(["mailto:a@example.com", "tel:0000"])(
    "%s はアプリ内遷移ではないので横取りしない",
    (href) => {
      const c = click({ anchor: { href, target: "", hasDownload: false } });
      expect(interceptedHrefFromClick(c, HERE)).toBeNull();
    },
  );

  it("いま居る場所と同じ URL は横取りしない(遷移が起きない)", () => {
    const c = click({
      anchor: { href: HERE, target: "", hasDownload: false },
    });
    expect(interceptedHrefFromClick(c, HERE)).toBeNull();
  });
});

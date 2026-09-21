import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildClipboardHtml,
  buildClipboardText,
  copyComboClipboard,
  copyPlainText,
} from "./clipboard";
import { DEFAULT_SELECTED_ITEMS, type ExportItemKey } from "./export-items";
import { makeCombo, TEST_CHARACTERS } from "./export-test-helpers";

const ALL = DEFAULT_SELECTED_ITEMS;

describe("buildClipboardHtml", () => {
  it("単独は 2 列(項目|値)の表になる", () => {
    const html = buildClipboardHtml([makeCombo()], TEST_CHARACTERS, ALL);
    expect(html).toContain("<table");
    expect(html).toContain("<th>ダメージ</th>");
    expect(html).toContain("<td>3000</td>");
    // 見出し行(コンボ)
    expect(html).toContain("リュウ");
  });

  it("複数は 列:各コンボ / 行:項目 の表になる(§5.8 同方向)", () => {
    const html = buildClipboardHtml(
      [makeCombo({ id: 1 }), makeCombo({ id: 2, damage: 2500 })],
      TEST_CHARACTERS,
      ALL,
    );
    // ヘッダに各コンボ
    expect(html).toContain("#1");
    expect(html).toContain("#2");
    // ダメージ行に両方の値
    expect(html).toContain("3000");
    expect(html).toContain("2500");
  });

  it("セットプレイが表に同梱される", () => {
    const html = buildClipboardHtml([makeCombo()], TEST_CHARACTERS, ALL);
    expect(html).toContain("セットプレイ");
    expect(html).toContain("起き攻めA");
  });

  it("表示項目選択が反映される(未選択は出ない)", () => {
    const html = buildClipboardHtml(
      [makeCombo()],
      TEST_CHARACTERS,
      new Set<ExportItemKey>(["damage"]),
    );
    expect(html).toContain("ダメージ");
    expect(html).not.toContain("セットプレイ");
    expect(html).not.toContain("備考");
  });

  it("HTML 特殊文字をエスケープする", () => {
    const html = buildClipboardHtml(
      [makeCombo({ memo: "<script>&危険" })],
      TEST_CHARACTERS,
      new Set<ExportItemKey>(["memo"]),
    );
    expect(html).toContain("&lt;script&gt;&amp;危険");
    expect(html).not.toContain("<script>");
  });
});

describe("buildClipboardText (TSV)", () => {
  it("単独はタブ区切りの 項目<TAB>値 行になる", () => {
    const text = buildClipboardText(
      [makeCombo()],
      TEST_CHARACTERS,
      new Set<ExportItemKey>(["damage", "memo"]),
    );
    expect(text).toContain("ダメージ\t3000");
    expect(text).toContain("備考\t画面端限定の備考");
  });

  it("複数はヘッダ + 各行に各コンボ値が並ぶ", () => {
    const text = buildClipboardText(
      [makeCombo({ id: 1 }), makeCombo({ id: 2, damage: 2500 })],
      TEST_CHARACTERS,
      new Set<ExportItemKey>(["damage"]),
    );
    const lines = text.split("\n");
    // ヘッダ行(先頭は空セル + 各コンボ)
    expect(lines[0].startsWith("\t")).toBe(true);
    // ダメージ行に 2 値(タブ区切り)
    const dmg = lines.find((l) => l.startsWith("ダメージ"));
    expect(dmg).toBe("ダメージ\t3000\t2500");
  });

  it("セル内改行(setups)は ' / ' に畳む(行崩れ防止)", () => {
    const combo = makeCombo({
      setups: [
        { id: 1, characterId: 7, name: "A", description: null, stepCount: 1, version: 1, defaultRecipe: "r1", parentComboIds: [1] },
        { id: 2, characterId: 7, name: "B", description: null, stepCount: 1, version: 1, defaultRecipe: "r2", parentComboIds: [1] },
      ],
    });
    const text = buildClipboardText(
      [combo],
      TEST_CHARACTERS,
      new Set<ExportItemKey>(["setups"]),
    );
    const setupLine = text.split("\n").find((l) => l.startsWith("セットプレイ"));
    expect(setupLine).toContain(" / ");
    expect(setupLine).not.toContain("\n");
  });
});

describe("copyComboClipboard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("ClipboardItem 対応時は text/html + text/plain を write する", async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const items: Record<string, unknown>[] = [];
    class FakeClipboardItem {
      data: Record<string, unknown>;
      constructor(data: Record<string, unknown>) {
        this.data = data;
        items.push(data);
      }
    }
    vi.stubGlobal("ClipboardItem", FakeClipboardItem);
    vi.stubGlobal("navigator", { clipboard: { write, writeText: vi.fn() } });

    await copyComboClipboard("<table></table>", "tsv");

    expect(write).toHaveBeenCalledTimes(1);
    expect(Object.keys(items[0])).toEqual(["text/html", "text/plain"]);
  });

  it("ClipboardItem 非対応時は writeText(text/plain)へフォールバック", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("ClipboardItem", undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    await copyComboClipboard("<table></table>", "プレーン TSV");

    expect(writeText).toHaveBeenCalledWith("プレーン TSV");
  });

  it("write 失敗時も writeText にフォールバックする", async () => {
    const write = vi.fn().mockRejectedValue(new Error("not allowed"));
    const writeText = vi.fn().mockResolvedValue(undefined);
    class FakeClipboardItem {
      constructor(public data: Record<string, unknown>) {}
    }
    vi.stubGlobal("ClipboardItem", FakeClipboardItem);
    vi.stubGlobal("navigator", { clipboard: { write, writeText } });

    await copyComboClipboard("<table></table>", "fallback");

    expect(writeText).toHaveBeenCalledWith("fallback");
  });

  it("クリップボード API が無い場合は例外を投げる", async () => {
    vi.stubGlobal("ClipboardItem", undefined);
    vi.stubGlobal("navigator", {});
    await expect(copyComboClipboard("<table></table>", "x")).rejects.toThrow();
  });
});

describe("copyPlainText(M17-04 プロンプトコピー)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("text/plain のみを writeText で書く(text/html を書かない)", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const write = vi.fn();
    vi.stubGlobal("navigator", { clipboard: { writeText, write } });

    await copyPlainText("プロンプト本文\n複数行");

    expect(writeText).toHaveBeenCalledWith("プロンプト本文\n複数行");
    expect(write).not.toHaveBeenCalled(); // ClipboardItem(text/html)を使わない
  });

  it("writeText が使えない場合は execCommand('copy')へフォールバックする", async () => {
    vi.stubGlobal("navigator", {});
    const execCommand = vi.fn().mockReturnValue(true);
    // jsdom の document に execCommand を生やす。
    (document as unknown as { execCommand: unknown }).execCommand = execCommand;

    await copyPlainText("fallback text");

    expect(execCommand).toHaveBeenCalledWith("copy");
  });
});

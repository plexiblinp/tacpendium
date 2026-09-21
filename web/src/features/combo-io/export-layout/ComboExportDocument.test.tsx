import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ComboExportDocument from "./ComboExportDocument";
import { DEFAULT_SELECTED_ITEMS, type ExportItemKey } from "../export-items";
import { makeCombo, TEST_CHARACTERS } from "../export-test-helpers";

const ALL = DEFAULT_SELECTED_ITEMS;

describe("ComboExportDocument", () => {
  it("単独コンボは詳細レイアウト(data-export-mode=single)で出力する", () => {
    const { container } = render(
      <ComboExportDocument
        combos={[makeCombo()]}
        characters={TEST_CHARACTERS}
        selected={ALL}
      />,
    );
    const root = container.querySelector("[data-export-mode]");
    expect(root?.getAttribute("data-export-mode")).toBe("single");
    expect(container.textContent).toContain("リュウ");
    expect(container.textContent).toContain("ダメージ");
    expect(container.textContent).toContain("3000");
    // セットプレイは名称のみ(M17-05c-fix)
    expect(container.textContent).toContain("セットプレイ");
    expect(container.textContent).toContain("起き攻めA");
    expect(container.textContent).not.toContain("5LP 重ね");
  });

  it("複数コンボは比較表レイアウトで、総題「コンボ比較」は無い(M17-05c-fix)", () => {
    const { container } = render(
      <ComboExportDocument
        combos={[makeCombo({ id: 1 }), makeCombo({ id: 2 })]}
        characters={TEST_CHARACTERS}
        selected={ALL}
      />,
    );
    const root = container.querySelector("[data-export-mode]");
    expect(root?.getAttribute("data-export-mode")).toBe("comparison");
    expect(container.textContent).toContain("#1");
    expect(container.textContent).toContain("#2");
    expect(container.querySelector("thead")).not.toBeNull();
    // 総題は削除済み
    expect(container.textContent).not.toContain("コンボ比較");
  });

  it("未選択の表示項目は出力に含まれない", () => {
    const { container } = render(
      <ComboExportDocument
        combos={[makeCombo()]}
        characters={TEST_CHARACTERS}
        selected={new Set<ExportItemKey>(["damage"])}
      />,
    );
    expect(container.textContent).toContain("ダメージ");
    expect(container.textContent).not.toContain("セットプレイ");
    expect(container.textContent).not.toContain("備考");
  });

  it("日本語のメモがレイアウトに正しく入る", () => {
    const { container } = render(
      <ComboExportDocument
        combos={[makeCombo({ memo: "日本語メモ確認" })]}
        characters={TEST_CHARACTERS}
        selected={ALL}
      />,
    );
    expect(container.textContent).toContain("日本語メモ確認");
  });

  it("全項目選択の単独出力は 28 行(項目数・内容は不変)", () => {
    const { container } = render(
      <ComboExportDocument
        combos={[makeCombo()]}
        characters={TEST_CHARACTERS}
        selected={ALL}
      />,
    );
    // buildComboFields は selected を描画(視覚除外は run-export 側の責務)。全選択=28 行。
    expect(container.querySelectorAll("tr[data-row]")).toHaveLength(28);
    // page 未指定 = フッタ(ページ番号)・注記は付かない = 従来出力と一致
    expect(container.querySelector("[data-field='page-footer']")).toBeNull();
    expect(container.querySelector("[data-field='overflow-note']")).toBeNull();
  });

  describe("ページモード(PDF・列分割)", () => {
    it("比較: 指定列のみ描画し、項目名列と thead を再掲、範囲ラベル・ページ番号を出す", () => {
      const combos = Array.from({ length: 6 }, (_, i) =>
        makeCombo({ id: i + 1 }),
      );
      const { container } = render(
        <ComboExportDocument
          combos={combos}
          characters={TEST_CHARACTERS}
          selected={ALL}
          page={{
            pageNumber: 1,
            pageCount: 2,
            columnStart: 0,
            columnEnd: 4,
          }}
        />,
      );
      // 見出し(項目名)列 + 対象 4 コンボ = 5 セル
      expect(container.querySelectorAll("thead th")).toHaveLength(5);
      expect(container.textContent).toContain("#1");
      expect(container.textContent).toContain("#4");
      expect(container.textContent).not.toContain("#5");
      // 範囲ラベル + ページ番号
      const footer = container.querySelector("[data-field='page-footer']");
      expect(footer?.textContent).toContain("コンボ 1–4 / 全 6");
      expect(footer?.textContent).toContain("1 / 2");
      // 全 28 行が載る(行分割は廃止)
      expect(container.querySelectorAll("tr[data-row]")).toHaveLength(28);
    });

    it("比較(2ページ目の列): 値が元の列インデックスから正しく引かれる", () => {
      const combos = [
        makeCombo({ id: 1, damage: 1111 }),
        makeCombo({ id: 2, damage: 2222 }),
        makeCombo({ id: 3, damage: 3333 }),
        makeCombo({ id: 4, damage: 4444 }),
        makeCombo({ id: 5, damage: 5555 }),
      ];
      const { container } = render(
        <ComboExportDocument
          combos={combos}
          characters={TEST_CHARACTERS}
          selected={new Set(["damage"] as const)}
          page={{
            pageNumber: 2,
            pageCount: 2,
            columnStart: 4,
            columnEnd: 5,
          }}
        />,
      );
      expect(container.textContent).toContain("5555");
      expect(container.textContent).not.toContain("1111");
      expect(container.textContent).toContain("#5");
      const footer = container.querySelector("[data-field='page-footer']");
      expect(footer?.textContent).toContain("コンボ 5–5 / 全 5");
    });

    it("overflowNote=true で用紙超過の注記を出す(縮小フィット下限未満)", () => {
      const { container } = render(
        <ComboExportDocument
          combos={[makeCombo()]}
          characters={TEST_CHARACTERS}
          selected={ALL}
          page={{ pageNumber: 1, pageCount: 1, overflowNote: true }}
        />,
      );
      const note = container.querySelector("[data-field='overflow-note']");
      expect(note).not.toBeNull();
      expect(note?.textContent).toContain("用紙に収まりきらない");
    });
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { CollapsibleFieldset } from "./CollapsibleFieldset";

describe("CollapsibleFieldset", () => {
  it("既定openで状態label、children、summary、ARIA対応を表示する", () => {
    render(
      <CollapsibleFieldset legend="基本情報" summary={<span>概要</span>}>
        <div data-testid="fieldset-child">入力欄</div>
      </CollapsibleFieldset>,
    );

    const button = screen.getByRole("button", { name: /基本情報.*隠す/ });
    const child = screen.getByTestId("fieldset-child");
    expect(button.getAttribute("aria-expanded")).toBe("true");
    // aria-controls が実在する content 要素を指し、その中に children があることまで確認する
    // (DOM の入れ子構造に依存しない形で対応関係を検証する)。
    const contentId = button.getAttribute("aria-controls");
    expect(contentId).toBeTruthy();
    const content = document.getElementById(contentId as string);
    expect(content).not.toBeNull();
    expect(content?.contains(child)).toBe(true);
    expect(screen.getByText("概要")).toBeTruthy();
    expect(child).toBeTruthy();
  });

  it("clickでclosedへ切り替えてsummaryを残し、再clickでopenへ戻る", () => {
    render(
      <CollapsibleFieldset legend="レシピ" summary={<span>レシピ概要</span>}>
        <div data-testid="fieldset-child">レシピ入力</div>
      </CollapsibleFieldset>,
    );

    fireEvent.click(screen.getByRole("button", { name: /レシピ.*隠す/ }));
    const closedButton = screen.getByRole("button", { name: /レシピ.*表示/ });
    expect(closedButton.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByTestId("fieldset-child")).toBeNull();
    expect(screen.getByText("レシピ概要")).toBeTruthy();

    fireEvent.click(closedButton);
    const openButton = screen.getByRole("button", { name: /レシピ.*隠す/ });
    expect(openButton.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByTestId("fieldset-child")).toBeTruthy();
    expect(screen.getByText("レシピ概要")).toBeTruthy();
  });

  it("defaultOpen=falseで初期closedとなり、summaryだけを表示する", () => {
    render(
      <CollapsibleFieldset
        legend="タグ"
        defaultOpen={false}
        summary={<span>タグ概要</span>}
      >
        <div data-testid="fieldset-child">タグ入力</div>
      </CollapsibleFieldset>,
    );

    const button = screen.getByRole("button", { name: /タグ.*表示/ });
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByTestId("fieldset-child")).toBeNull();
    expect(screen.getByText("タグ概要")).toBeTruthy();
  });
});

// -----------------------------------------------------------------------------
// M24-02 追補: summaryPlacement（開発者要望「縦の枠を確保する」）
// -----------------------------------------------------------------------------
describe("CollapsibleFieldset summaryPlacement", () => {
  it("★既定は below —— summary は見出し行の「下」に別行で出る(登録画面の従来どおり)", () => {
    render(
      <CollapsibleFieldset legend="レシピ" summary={<span>レシピ概要</span>}>
        <p>中身</p>
      </CollapsibleFieldset>,
    );
    const toggle = screen.getByRole("button", { name: /レシピ/ });
    const summary = screen.getByText("レシピ概要");
    // 見出しボタンと要約が同じ行(親)を共有していない = 別行である
    expect(summary.parentElement).not.toBe(toggle.parentElement);
    expect(toggle.contains(summary)).toBe(false);
  });

  it("★inline —— summary は見出し行と同じ行に出る", () => {
    render(
      <CollapsibleFieldset
        legend="フィルタ・ソート"
        summary={<span>絞り込みなし</span>}
        summaryPlacement="inline"
      >
        <p>中身</p>
      </CollapsibleFieldset>,
    );
    const toggle = screen.getByRole("button", { name: /フィルタ・ソート/ });
    const summary = screen.getByText("絞り込みなし");
    // 要約の入れ物と見出しボタンが同じ親(flex 行)を共有している
    expect(summary.parentElement?.parentElement).toBe(toggle.parentElement);
    // ★ボタンの中には入れない(アクセシブル名を汚さないため)
    expect(toggle.contains(summary)).toBe(false);
  });

  it("★★inline ではトグルが行の右端にある(見出し → 要約 → トグル の順)", () => {
    render(
      <CollapsibleFieldset
        legend="フィルタ・ソート"
        summary={<span>絞り込みなし</span>}
        summaryPlacement="inline"
      >
        <p>中身</p>
      </CollapsibleFieldset>,
    );
    const toggle = screen.getByRole("button", { name: /フィルタ・ソート/ });
    const row = toggle.parentElement!;
    const order = Array.from(row.children);
    // 行の子は 3 つ: 見出し / 要約 / トグル
    expect(order).toHaveLength(3);
    expect(order[0].textContent).toBe("フィルタ・ソート");
    expect(order[1].textContent).toBe("絞り込みなし");
    // ★トグルは最後 = 右端
    expect(order[2]).toBe(toggle);
  });

  it("★見出しがボタンの外へ出てもトグルの名前は「見出し + 隠す」のまま", () => {
    render(
      <CollapsibleFieldset
        legend="フィルタ・ソート"
        summary={<span>絞り込みなし</span>}
        summaryPlacement="inline"
      >
        <p>中身</p>
      </CollapsibleFieldset>,
    );
    // aria-labelledby で組み立てているため、見出し名で引ける
    const toggle = screen.getByRole("button", { name: /フィルタ・ソート/ });
    expect(toggle.getAttribute("aria-labelledby")).toBeTruthy();
    // ★要約(ピル)はボタンの中に入っていない = アクセシブル名を汚さない
    expect(toggle.textContent).not.toContain("絞り込みなし");
  });

  it("★inline でも開閉は従来どおり効く", async () => {
    const user = userEvent.setup();
    render(
      <CollapsibleFieldset
        legend="フィルタ・ソート"
        summary={<span>絞り込みなし</span>}
        summaryPlacement="inline"
      >
        <p>中身</p>
      </CollapsibleFieldset>,
    );
    const toggle = screen.getByRole("button", { name: /フィルタ・ソート/ });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    await user.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    // ★閉じても要約は残る
    expect(screen.getByText("絞り込みなし")).toBeDefined();
  });
});

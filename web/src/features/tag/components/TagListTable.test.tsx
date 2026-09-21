import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Tag } from "@/types/tag";

import "@/lib/i18n";
import { TagListTable } from "./TagListTable";

const sampleTags: Tag[] = [
  { id: 1, userId: 1, name: "使用中", category: "mycombo_status", color: "#10B981", usageCount: 3 },
  { id: 2, userId: 1, name: "練習中", category: "mycombo_status", color: "#3B82F6", usageCount: 0 },
  { id: 3, userId: 1, name: "カスタム" },
];

describe("TagListTable", () => {
  it("タグ配列の行数が正しく描画される", () => {
    render(<TagListTable tags={sampleTags} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText("使用中")).toBeTruthy();
    expect(screen.getByText("練習中")).toBeTruthy();
    expect(screen.getByText("カスタム")).toBeTruthy();
  });

  it("カテゴリ列が正しく表示される", () => {
    render(<TagListTable tags={sampleTags} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getAllByText("mycombo_status")).toHaveLength(2);
  });

  it("使用数列が正しく表示される", () => {
    render(<TagListTable tags={sampleTags} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText("3")).toBeTruthy();
  });

  it("システムタグ行では編集・削除ボタンが表示されない", () => {
    render(<TagListTable tags={sampleTags} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.queryByLabelText("使用中を編集")).toBeNull();
    expect(screen.queryByLabelText("使用中を削除")).toBeNull();
    expect(screen.queryByLabelText("練習中を編集")).toBeNull();
    expect(screen.queryByLabelText("練習中を削除")).toBeNull();
  });

  it("通常タグ行では編集・削除ボタンが表示される", () => {
    render(<TagListTable tags={sampleTags} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByLabelText("カスタムを編集")).toBeTruthy();
    expect(screen.getByLabelText("カスタムを削除")).toBeTruthy();
  });

  it("タグが空の場合にメッセージが表示される", () => {
    render(<TagListTable tags={[]} onEdit={vi.fn()} onDelete={vi.fn()} />);
    const msg = screen.getByText(/タグがありません/);
    expect(msg).toBeTruthy();
  });
});

// -----------------------------------------------------------------------------
// M24-02 §4.4: 0 件の 2 状態を区別する
// -----------------------------------------------------------------------------
describe("TagListTable 0 件の 2 状態(M24-02 §4.4)", () => {
  it("★そもそもタグが無いときは「新規作成してください」と案内する", () => {
    render(<TagListTable tags={[]} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByTestId("tag-list-empty")).toBeDefined();
    expect(screen.queryByTestId("tag-list-empty-filtered")).toBeNull();
  });

  it("★絞り込みで 0 件のときは別の案内を出す(「新規作成してください」と言わない)", () => {
    render(
      <TagListTable
        tags={[]}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        searchQuery="ぬ"
      />,
    );
    const el = screen.getByTestId("tag-list-empty-filtered");
    expect(el.textContent).toContain("ぬ");
    expect(el.textContent).not.toContain("新規作成");
    expect(screen.queryByTestId("tag-list-empty")).toBeNull();
  });

  it("★空白のみの検索語は「絞り込んでいない」として扱う", () => {
    render(
      <TagListTable
        tags={[]}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        searchQuery="   "
      />,
    );
    expect(screen.getByTestId("tag-list-empty")).toBeDefined();
  });

  it("検索の解除ボタンは onClearSearch を渡したときだけ出る", async () => {
    const onClearSearch = vi.fn();
    const user = userEvent.setup();
    render(
      <TagListTable
        tags={[]}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        searchQuery="ぬ"
        onClearSearch={onClearSearch}
      />,
    );
    await user.click(screen.getByText("検索を解除"));
    expect(onClearSearch).toHaveBeenCalled();
  });
});

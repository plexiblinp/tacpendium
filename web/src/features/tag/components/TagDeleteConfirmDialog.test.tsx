import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Tag } from "@/types/tag";

import "@/lib/i18n";
import { TagDeleteConfirmDialog } from "./TagDeleteConfirmDialog";

describe("TagDeleteConfirmDialog", () => {
  it("open=false のとき描画しない", () => {
    render(
      <TagDeleteConfirmDialog
        open={false}
        tag={null}
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("usage_count=0 のとき通常の確認メッセージが表示される", () => {
    const tag: Tag = { id: 1, userId: 1, name: "テストタグ", usageCount: 0 };
    render(
      <TagDeleteConfirmDialog
        open={true}
        tag={tag}
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByText("タグを削除")).toBeTruthy();
    expect(screen.getByText(/テストタグ/)).toBeTruthy();
    expect(screen.queryByText(/警告: 使用中のタグです/)).toBeNull();
  });

  it("usage_count > 0 のとき警告メッセージが表示される", () => {
    const tag: Tag = { id: 1, userId: 1, name: "使用タグ", usageCount: 5 };
    render(
      <TagDeleteConfirmDialog
        open={true}
        tag={tag}
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByText("警告: 使用中のタグです")).toBeTruthy();
    expect(screen.getByText(/5 件/)).toBeTruthy();
  });
});

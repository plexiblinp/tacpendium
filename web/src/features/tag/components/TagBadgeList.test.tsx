import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Tag } from "@/types/tag";
import "@/lib/i18n";
import { TagBadgeList } from "./TagBadgeList";

const makeTag = (overrides: Partial<Tag> & { id: number; name: string }): Tag => ({
  userId: 1,
  ...overrides,
});

describe("TagBadgeList", () => {
  it("タグが 0 件のとき null を返す", () => {
    const { container } = render(<TagBadgeList tags={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("タグを 1 件表示する", () => {
    const tags = [makeTag({ id: 1, name: "使用中", color: "#10B981" })];
    render(<TagBadgeList tags={tags} />);
    expect(screen.getByText("使用中")).toBeTruthy();
  });

  it("複数タグを表示する", () => {
    const tags = [
      makeTag({ id: 1, name: "tag-a" }),
      makeTag({ id: 2, name: "tag-b" }),
    ];
    render(<TagBadgeList tags={tags} />);
    expect(screen.getByText("tag-a")).toBeTruthy();
    expect(screen.getByText("tag-b")).toBeTruthy();
  });

  it("maxVisible を超えた分は +N で省略表示する", () => {
    const tags = [
      makeTag({ id: 1, name: "a" }),
      makeTag({ id: 2, name: "b" }),
      makeTag({ id: 3, name: "c" }),
    ];
    render(<TagBadgeList tags={tags} maxVisible={2} />);
    expect(screen.getByText("a")).toBeTruthy();
    expect(screen.getByText("b")).toBeTruthy();
    expect(screen.queryByText("c")).toBeNull();
    expect(screen.getByText("+1")).toBeTruthy();
  });

  it("excludeCategories で指定カテゴリを除外する", () => {
    const category = "mycombo_status";
    const tags = [
      makeTag({ id: 1, name: "使用中", category }),
      makeTag({ id: 2, name: "通常タグ" }),
    ];
    render(<TagBadgeList tags={tags} excludeCategories={[category]} />);
    expect(screen.queryByText("使用中")).toBeNull();
    expect(screen.getByText("通常タグ")).toBeTruthy();
  });

  it("maxVisible を超えたタグ名を +N の title と aria-label へ入力順で表示する", () => {
    const tags = [
      makeTag({ id: 1, name: "始動技" }),
      makeTag({ id: 2, name: "対空" }),
      makeTag({ id: 3, name: "端限定" }),
    ];
    render(<TagBadgeList tags={tags} maxVisible={1} />);
    expect(screen.getByText("始動技")).toBeTruthy();
    expect(screen.queryByText("対空")).toBeNull();
    expect(screen.queryByText("端限定")).toBeNull();
    const overflow = screen.getByText("+2");
    const expectedLabel = "省略されたタグ2件: 対空、端限定";
    expect(overflow.getAttribute("title")).toBe(expectedLabel);
    expect(overflow.getAttribute("aria-label")).toBe(expectedLabel);
  });

  it("category 除外後のタグだけを overflow 属性へ含める", () => {
    const category = "mycombo_status";
    const tags = [
      makeTag({ id: 1, name: "使用中", category }),
      makeTag({ id: 2, name: "通常タグA" }),
      makeTag({ id: 3, name: "通常タグB" }),
    ];
    render(
      <TagBadgeList tags={tags} excludeCategories={[category]} maxVisible={1} />,
    );
    expect(screen.queryByText("使用中")).toBeNull();
    expect(screen.getByText("通常タグA")).toBeTruthy();
    const overflow = screen.getByText("+1");
    const expectedLabel = "省略されたタグ1件: 通常タグB";
    expect(overflow.getAttribute("title")).toBe(expectedLabel);
    expect(overflow.getAttribute("aria-label")).toBe(expectedLabel);
    expect(overflow.getAttribute("title")).not.toContain("使用中");
  });

  it("overflow 0(maxVisible 未指定を含む)では +N badge と overflow 用 title を生成しない", () => {
    const tags = [
      makeTag({ id: 1, name: "tag-a" }),
      makeTag({ id: 2, name: "tag-b" }),
    ];
    // maxVisible 未指定
    const { container: noLimit } = render(<TagBadgeList tags={tags} />);
    expect(within(noLimit).queryByText(/^\+\d+$/)).toBeNull();
    expect(noLimit.querySelector('[title^="省略されたタグ"]')).toBeNull();
    // maxVisible が表示件数と一致(overflow 0)
    const { container: exact } = render(
      <TagBadgeList tags={tags} maxVisible={2} />,
    );
    expect(within(exact).queryByText(/^\+\d+$/)).toBeNull();
    expect(exact.querySelector('[title^="省略されたタグ"]')).toBeNull();
  });

  it("全タグが除外されたとき null を返す", () => {
    const tags = [makeTag({ id: 1, name: "使用中", category: "mycombo_status" })];
    const { container } = render(
      <TagBadgeList tags={tags} excludeCategories={["mycombo_status"]} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("color が null のときデフォルト色で表示する", () => {
    const tags = [makeTag({ id: 1, name: "no-color" })];
    render(<TagBadgeList tags={tags} />);
    const el = screen.getByText("no-color");
    expect(el.style.backgroundColor).toBe("rgb(156, 163, 175)"); // #9CA3AF
  });

  it("color が空文字列のときもデフォルト色で表示する(旧バグの回帰防止)", () => {
    const tags = [makeTag({ id: 1, name: "empty-color", color: "" })];
    render(<TagBadgeList tags={tags} />);
    const el = screen.getByText("empty-color");
    expect(el.style.backgroundColor).toBe("rgb(156, 163, 175)"); // #9CA3AF
  });
});

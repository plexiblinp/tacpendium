import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import "@/lib/i18n";
import { TagSelector } from "./TagSelector";
import type { Tag } from "@/types/tag";

vi.mock("@/features/tag/hooks/useTagsForSelector", () => ({
  useTagsForSelector: vi.fn(),
}));

import { useTagsForSelector } from "@/features/tag/hooks/useTagsForSelector";

const mockTags: Tag[] = [
  { id: 1, userId: 1, name: "使用中", category: "mycombo_status", color: "#10B981" },
  { id: 2, userId: 1, name: "初心者向け", color: "#3B82F6" },
  { id: 3, userId: 1, name: "コンボA", color: "#F59E0B" },
];

function setupMocks(filteredTags: Tag[] = mockTags) {
  vi.mocked(useTagsForSelector).mockReturnValue({
    tagsQuery: { data: filteredTags, isLoading: false } as ReturnType<typeof useTagsForSelector>["tagsQuery"],
    filteredTags,
  });
}

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient();
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const mockOnCreateTag = vi.fn().mockResolvedValue(99);

describe("TagSelector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  it("selectedTagIds が空のときプレースホルダーを表示する", () => {
    render(
      <TagSelector selectedTagIds={[]} onChange={vi.fn()} />,
      { wrapper },
    );
    expect(screen.getByText("タグを選択、または、新規登録")).toBeTruthy();
  });

  it("selectedTagIds のバッジが表示される", () => {
    render(
      <TagSelector selectedTagIds={[2]} onChange={vi.fn()} />,
      { wrapper },
    );
    expect(screen.getAllByText("初心者向け").length).toBeGreaterThan(0);
  });

  it("color が空文字列のタグはフォールバック色で表示される(旧バグの回帰防止)", async () => {
    const user = userEvent.setup();
    setupMocks([...mockTags, { id: 4, userId: 1, name: "無色タグ", color: "" }]);
    render(
      <TagSelector selectedTagIds={[]} onChange={vi.fn()} />,
      { wrapper },
    );

    await user.click(screen.getByRole("button", { name: /タグを選択/ }));
    const item = screen.getByText("無色タグ").closest("button");
    const swatch = item?.querySelector("span");
    expect(swatch?.style.backgroundColor).toBe("rgb(156, 163, 175)"); // #9CA3AF
  });

  it("タグをクリックすると onChange が発火する", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TagSelector selectedTagIds={[]} onChange={onChange} />,
      { wrapper },
    );

    await user.click(screen.getByRole("button", { name: /タグを選択/ }));
    await user.click(screen.getByText("初心者向け"));
    expect(onChange).toHaveBeenCalledWith([2]);
  });

  it("バッジの削除ボタンで選択解除される", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TagSelector selectedTagIds={[2]} onChange={onChange} />,
      { wrapper },
    );

    const allButtons = screen.getAllByRole("button");
    expect(allButtons.length).toBeGreaterThan(1);
    await user.click(allButtons[1]);
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("検索でタグを絞り込む", async () => {
    const user = userEvent.setup();
    render(
      <TagSelector selectedTagIds={[]} onChange={vi.fn()} />,
      { wrapper },
    );

    await user.click(screen.getByRole("button", { name: /タグを選択/ }));
    await user.type(screen.getByPlaceholderText("タグを検索、または新規登録"), "コンボ");

    expect(screen.getByText("コンボA")).toBeTruthy();
    expect(screen.queryByText("初心者向け")).toBeNull();
  });

  it("onCreateTag が渡されているとき、既存タグ名と一致しない入力で新規作成オプションが表示される", async () => {
    const user = userEvent.setup();
    render(
      <TagSelector selectedTagIds={[]} onChange={vi.fn()} onCreateTag={mockOnCreateTag} />,
      { wrapper },
    );

    await user.click(screen.getByRole("button", { name: /タグを選択/ }));
    await user.type(screen.getByPlaceholderText("タグを検索、または新規登録"), "新しいタグ");

    expect(screen.getByText(`「新しいタグ」を新規作成`)).toBeTruthy();
  });

  it("onCreateTag が未指定のとき、新規作成オプションは表示されない", async () => {
    const user = userEvent.setup();
    render(
      <TagSelector selectedTagIds={[]} onChange={vi.fn()} />,
      { wrapper },
    );

    await user.click(screen.getByRole("button", { name: /タグを選択/ }));
    await user.type(screen.getByPlaceholderText("タグを検索、または新規登録"), "新しいタグ");

    expect(screen.queryByText(/を新規作成/)).toBeNull();
  });

  it("既存タグ名と完全一致するとき新規作成オプションは表示されない", async () => {
    const user = userEvent.setup();
    render(
      <TagSelector selectedTagIds={[]} onChange={vi.fn()} onCreateTag={mockOnCreateTag} />,
      { wrapper },
    );

    await user.click(screen.getByRole("button", { name: /タグを選択/ }));
    await user.type(screen.getByPlaceholderText("タグを検索、または新規登録"), "初心者向け");

    expect(screen.queryByText(/を新規作成/)).toBeNull();
  });

  it("新規作成をクリックすると onCreateTag が呼ばれて onChange に追加される", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TagSelector selectedTagIds={[]} onChange={onChange} onCreateTag={mockOnCreateTag} />,
      { wrapper },
    );

    await user.click(screen.getByRole("button", { name: /タグを選択/ }));
    await user.type(screen.getByPlaceholderText("タグを検索、または新規登録"), "新タグ");
    await user.click(screen.getByText(`「新タグ」を新規作成`));

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith([99]);
    });
  });

  it("excludeCategories が適用されたタグは表示されない", () => {
    setupMocks(
      mockTags.filter((t) => t.category !== "mycombo_status"),
    );
    render(
      <TagSelector
        selectedTagIds={[]}
        onChange={vi.fn()}
        excludeCategories={["mycombo_status"]}
      />,
      { wrapper },
    );
    expect(vi.mocked(useTagsForSelector)).toHaveBeenCalledWith({
      excludeCategories: ["mycombo_status"],
    });
  });

  // ★★M27-02a(tag-field-keyboard-unreachable): 基本情報タブでマウスが要るのは
  //   タグ欄だけになっていた。着手前の実測 = onKeyDown / ArrowDown が 0 件、
  //   候補に role="option" も無く、選択が Tab 送りだった。
  describe("キーボード操作", () => {
    it("★候補が listbox / option として公開されている(着手前は role が 1 つも無かった)", async () => {
      const user = userEvent.setup();
      render(<TagSelector selectedTagIds={[]} onChange={vi.fn()} />, { wrapper });
      await user.click(screen.getByRole("button", { name: /タグを選択/ }));
      expect(screen.getByRole("listbox")).toBeTruthy();
      expect(screen.getAllByRole("option")).toHaveLength(mockTags.length);
    });

    it("検索欄から ↓ で先頭候補へ入れる", async () => {
      const user = userEvent.setup();
      render(<TagSelector selectedTagIds={[]} onChange={vi.fn()} />, { wrapper });
      await user.click(screen.getByRole("button", { name: /タグを選択/ }));
      await user.keyboard("{ArrowDown}");
      expect(document.activeElement).toBe(screen.getAllByRole("option")[0]);
    });

    it("↓↑ で候補を移動でき、端で回り込む", async () => {
      const user = userEvent.setup();
      render(<TagSelector selectedTagIds={[]} onChange={vi.fn()} />, { wrapper });
      await user.click(screen.getByRole("button", { name: /タグを選択/ }));
      const options = () => screen.getAllByRole("option");
      await user.keyboard("{ArrowDown}{ArrowDown}");
      expect(document.activeElement).toBe(options()[1]);
      await user.keyboard("{ArrowUp}{ArrowUp}");
      // 先頭からさらに ↑ で末尾へ回り込む。
      expect(document.activeElement).toBe(options()[options().length - 1]);
    });

    it("★Enter で選べる。★複数選択なので候補は開いたままにする(M27-02a §2.2.4-3 の決定)", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<TagSelector selectedTagIds={[]} onChange={onChange} />, { wrapper });
      await user.click(screen.getByRole("button", { name: /タグを選択/ }));
      await user.keyboard("{ArrowDown}{Enter}");
      expect(onChange).toHaveBeenCalledWith([mockTags[0].id]);
      // ★閉じない——タグは続けて複数選ぶのが普通である。
      expect(screen.getByRole("listbox")).toBeTruthy();
    });

    it("★絞り込んだ後は残った候補だけを移動する", async () => {
      const user = userEvent.setup();
      render(<TagSelector selectedTagIds={[]} onChange={vi.fn()} />, { wrapper });
      await user.click(screen.getByRole("button", { name: /タグを選択/ }));
      await user.keyboard("コンボ");
      const options = screen.getAllByRole("option");
      expect(options).toHaveLength(1);
      await user.keyboard("{ArrowDown}");
      expect(document.activeElement).toBe(options[0]);
    });

    it("★「新規登録」行も候補列に含まれる(0 件になった先でマウスが要らないこと)", async () => {
      const user = userEvent.setup();
      render(
        <TagSelector selectedTagIds={[]} onChange={vi.fn()} onCreateTag={mockOnCreateTag} />,
        { wrapper },
      );
      await user.click(screen.getByRole("button", { name: /タグを選択/ }));
      await user.keyboard("まったく新しいタグ");
      const options = screen.getAllByRole("option");
      expect(options).toHaveLength(1);
      await user.keyboard("{ArrowDown}{Enter}");
      await waitFor(() => expect(mockOnCreateTag).toHaveBeenCalledWith("まったく新しいタグ"));
    });

    // ★★M27-02a レビュー 中-5: 作成すると showCreateOption が false になり、
    //   フォーカスが載っていた「新規登録」ボタンが unmount される。React は
    //   フォーカスを親へ戻さないので document.body へ落ち、以後 ↓ も Enter も
    //   候補へ届かなくなる。★本サブの主題は「タグ欄にキーボードで到達できること」で
    //   あり、いちばん新しく作った導線が押した直後にキーボードから外れていた。
    it("★新規作成した直後もキーボードで続けられる(フォーカスが body へ落ちない)", async () => {
      const user = userEvent.setup();
      render(
        <TagSelector selectedTagIds={[]} onChange={vi.fn()} onCreateTag={mockOnCreateTag} />,
        { wrapper },
      );
      await user.click(screen.getByRole("button", { name: /タグを選択/ }));
      await user.keyboard("まったく新しいタグ");
      await user.keyboard("{ArrowDown}{Enter}");
      await waitFor(() => expect(mockOnCreateTag).toHaveBeenCalled());

      // 検索欄へ戻っていること。
      await waitFor(() =>
        expect(document.activeElement).toBe(
          screen.getByPlaceholderText("タグを検索、または新規登録"),
        ),
      );
      // そこから ↓ で候補列へ入れること(＝キーボードの導線が切れていない)。
      await user.keyboard("{ArrowDown}");
      expect(document.activeElement).toBe(screen.getAllByRole("option")[0]);
    });

    // ★★M27-02a レビュー 中-4: 作成中(creating)の「新規登録」行は disabled であり
    //   フォーカスを受け取れない。role="option" のまま残すと、この行が唯一の候補の
    //   とき ↓ が完全に無反応になる。⇒ 作成中は候補列から外す。
    it("★作成中の「新規登録」行は候補列に居ない(進んでも何も起きない場所を作らない)", async () => {
      const user = userEvent.setup();
      render(
        <TagSelector
          selectedTagIds={[]}
          onChange={vi.fn()}
          onCreateTag={mockOnCreateTag}
          creating
        />,
        { wrapper },
      );
      await user.click(screen.getByRole("button", { name: /タグを選択/ }));
      await user.keyboard("まったく新しいタグ");
      // 候補は 0 件(既存タグは絞り込みで消え、新規登録行は role を持たない)。
      expect(screen.queryAllByRole("option")).toHaveLength(0);
    });
  });
});

// ★★M31-02 追補: 検索欄の pointerdown が lib/text-drag-capture へ結線されていること。
//
//   ガードの条件そのもの(マウス主ボタンのみ／タッチ・ペン・右クリックは張らない)は
//   web/src/lib/text-drag-capture.test.ts が固定する。ここで見るのは結線だけである。
//   ★実体(枠外へドラッグしても文字選択が消えないこと)は
//     web/e2e/m31-02-tag-field-drag.spec.ts が測る。jsdom では測れない。
describe("TagSelector（検索欄のポインタキャプチャ / M31-02 追補）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  it("検索欄で押し下げるとキャプチャを張る（結線の確認）", async () => {
    const user = userEvent.setup();
    render(<TagSelector selectedTagIds={[]} onChange={vi.fn()} />, { wrapper });
    await user.click(screen.getByRole("button"));

    const search = screen.getByPlaceholderText("タグを検索、または新規登録");
    const spy = vi.fn();
    (search as HTMLInputElement).setPointerCapture = spy;

    // ★★jsdom には `PointerEvent` が無い(実測: `typeof PointerEvent === "undefined"`)。
    //   ⇒ `fireEvent.pointerDown(el, { pointerType, button, pointerId })` を使うと
    //     **3 つとも黙って落ちる**。そのまま書くと常に緑になり、結線を外しても気づけない。
    //   ⇒ `MouseEvent` を組み立てて、足りない属性を載せてから投げる。
    const ev = new MouseEvent("pointerdown", { bubbles: true, button: 0 });
    Object.assign(ev, { pointerType: "mouse", pointerId: 7 });
    fireEvent(search, ev);

    expect(spy).toHaveBeenCalledWith(7);
  });
});

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";

import CharacterSelector from "./CharacterSelector";

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(
      JSON.stringify({
        items: [{ id: 1, gameId: 1, code: "ryu", nameJa: "リュウ", nameEn: "Ryu" }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CharacterSelector", () => {
  it("renders a select element", () => {
    render(
      <CharacterSelector selectedCharacterId={1} onChange={vi.fn()} />,
      { wrapper: createWrapper() },
    );
    expect(screen.getByRole("combobox")).toBeDefined();
  });

  it("is disabled when only one character", async () => {
    render(
      <CharacterSelector selectedCharacterId={1} onChange={vi.fn()} />,
      { wrapper: createWrapper() },
    );
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    await waitFor(() => {
      expect(select.disabled).toBe(true);
    });
  });

  it("shows character name after loading", async () => {
    render(
      <CharacterSelector selectedCharacterId={1} onChange={vi.fn()} />,
      { wrapper: createWrapper() },
    );
    await waitFor(() => {
      expect(screen.getByText("リュウ")).toBeDefined();
    });
  });

  // M7-04-2: 複数キャラ時に select が有効化されること(MyComboPage のキャラ切替が依存する経路)。
  it("is enabled when multiple characters are available", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            { id: 1, gameId: 1, code: "ryu", nameJa: "リュウ", nameEn: "Ryu" },
            { id: 2, gameId: 1, code: "aki", nameJa: "AKI", nameEn: "A.K.I." },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    render(
      <CharacterSelector selectedCharacterId={1} onChange={vi.fn()} />,
      { wrapper: createWrapper() },
    );
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    await waitFor(() => {
      expect(select.disabled).toBe(false);
    });
  });

  // M12-04: pick モード(placeholder 指定)では未選択を表現でき、単一キャラでも無効化しない。
  // 技マスタ編集の「キャラ選択 → グリッド表示」フローが依存する経路。
  it("placeholder 指定 + selectedCharacterId=null で placeholder を表示する", () => {
    render(
      <CharacterSelector
        selectedCharacterId={null}
        onChange={vi.fn()}
        placeholder="キャラクターを選択"
      />,
      { wrapper: createWrapper() },
    );
    expect(screen.getByText("キャラクターを選択")).toBeDefined();
  });

  it("pick モードでは単一キャラでも無効化されない", async () => {
    render(
      <CharacterSelector
        selectedCharacterId={null}
        onChange={vi.fn()}
        placeholder="キャラクターを選択"
      />,
      { wrapper: createWrapper() },
    );
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    await waitFor(() => {
      expect(select.disabled).toBe(false);
    });
  });

  it("ariaLabel 指定でトリガにアクセシブル名が付く", () => {
    render(
      <CharacterSelector
        selectedCharacterId={null}
        onChange={vi.fn()}
        placeholder="キャラクターを選択"
        ariaLabel="キャラクター選択"
      />,
      { wrapper: createWrapper() },
    );
    expect(screen.getByLabelText("キャラクター選択")).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // M24-02 §4.3: 検索欄付きコンボボックス化とロケール依存の昇順
  // ---------------------------------------------------------------------------
  describe("M24-02 検索と並び順", () => {
    // ★取得順(= サーバの ORDER BY id = 登録順)がそのままでは昇順にならない並びを渡す。
    const ROSTER = [
      { id: 1, gameId: 1, code: "ryu", nameJa: "リュウ", nameEn: "Ryu" },
      { id: 2, gameId: 1, code: "ken", nameJa: "ケン", nameEn: "Ken" },
      { id: 3, gameId: 1, code: "dhalsim", nameJa: "ダルシム", nameEn: "Dhalsim" },
      { id: 4, gameId: 1, code: "guile", nameJa: "ガイル", nameEn: "Guile" },
    ];

    beforeEach(() => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ items: ROSTER }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    });

    async function openList() {
      const user = userEvent.setup();
      render(
        <CharacterSelector selectedCharacterId={1} onChange={vi.fn()} />,
        { wrapper: createWrapper() },
      );
      await waitFor(() => {
        expect((screen.getByRole("combobox") as HTMLButtonElement).disabled).toBe(false);
      });
      await user.click(screen.getByRole("combobox"));
      return user;
    }

    it("★取得順ではなくロケール依存の昇順で並ぶ(§4.3.1)", async () => {
      await openList();
      const names = within(screen.getByRole("listbox"))
        .getAllByRole("option")
        .map((el) => el.textContent?.replace("✓", "").trim());
      expect(names).toEqual(["ガイル", "ケン", "ダルシム", "リュウ"]);
      // 取得順(リュウ・ケン・ダルシム・ガイル)のままではない
      expect(names).not.toEqual(ROSTER.map((c) => c.nameJa));
    });

    it("★検索欄で name_ja から絞れる", async () => {
      const user = await openList();
      await user.type(
        screen.getByPlaceholderText("common.characterSearchPlaceholder"),
        "ダル",
      );
      const options = within(screen.getByRole("listbox")).getAllByRole("option");
      expect(options).toHaveLength(1);
      expect(options[0].textContent).toContain("ダルシム");
    });

    it("★検索欄で name_en / code からも絞れる", async () => {
      const user = await openList();
      const box = screen.getByPlaceholderText("common.characterSearchPlaceholder");
      await user.type(box, "Guile");
      expect(
        within(screen.getByRole("listbox")).getAllByRole("option"),
      ).toHaveLength(1);

      await user.clear(box);
      await user.type(box, "dhalsim");
      const byCode = within(screen.getByRole("listbox")).getAllByRole("option");
      expect(byCode).toHaveLength(1);
      expect(byCode[0].textContent).toContain("ダルシム");
    });

    it("★一致が無ければ空メッセージを出す", async () => {
      const user = await openList();
      await user.type(
        screen.getByPlaceholderText("common.characterSearchPlaceholder"),
        "存在しないキャラ",
      );
      expect(screen.queryAllByRole("option")).toHaveLength(0);
      expect(screen.getByText("common.characterNotFound")).toBeDefined();
    });

    it("選ぶと onChange にキャラ id が渡る", async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(
        <CharacterSelector selectedCharacterId={1} onChange={onChange} />,
        { wrapper: createWrapper() },
      );
      await waitFor(() => {
        expect((screen.getByRole("combobox") as HTMLButtonElement).disabled).toBe(false);
      });
      await user.click(screen.getByRole("combobox"));
      await user.click(screen.getByRole("option", { name: /ダルシム/ }));
      expect(onChange).toHaveBeenCalledWith(3);
    });
  });
});

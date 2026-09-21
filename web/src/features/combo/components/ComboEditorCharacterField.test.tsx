import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, it, expect, vi } from "vitest";
import React from "react";

import { ComboEditorCharacterField } from "./ComboEditorCharacterField";

vi.mock("@/features/character/hooks/useCharacters", () => ({
  useCharacters: () => ({
    data: [
      { id: 1, gameId: 1, code: "ryu", nameJa: "リュウ", nameEn: "Ryu" },
      { id: 3, gameId: 1, code: "ingrid", nameJa: "イングリッド", nameEn: "Ingrid" },
    ],
    isLoading: false,
  }),
  useCharacterName: (characterId: number | null | undefined) =>
    characterId === 1 ? "リュウ" : characterId === 3 ? "イングリッド" : "",
  DEFAULT_GAME_ID: 1,
}));

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

afterEach(() => vi.clearAllMocks());

describe("ComboEditorCharacterField", () => {
  it("新規モードはキャラクター選択プルダウンを表示する", () => {
    render(
      <ComboEditorCharacterField characterId={1} mode="new" onChange={vi.fn()} />,
      { wrapper: createWrapper() },
    );
    expect(screen.getByRole("combobox")).toBeDefined();
    // 情報バー + プルダウンの両方に表示されるため複数一致しうる
    expect(screen.getAllByText("リュウ").length).toBeGreaterThan(0);
  });

  it("コピーモードもキャラクター選択プルダウンを表示する", () => {
    render(
      <ComboEditorCharacterField characterId={1} mode="copy" onChange={vi.fn()} />,
      { wrapper: createWrapper() },
    );
    expect(screen.getByRole("combobox")).toBeDefined();
  });

  it("編集モードは固定表示でプルダウンを出さない", () => {
    render(
      <ComboEditorCharacterField characterId={3} mode="edit" onChange={vi.fn()} />,
      { wrapper: createWrapper() },
    );
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByText("イングリッド")).toBeDefined();
    expect(screen.getByText("(編集モードでは変更不可)")).toBeDefined();
  });

  it("遷移元がキャラクターを固定した場合は新規モードでもプルダウンを出さない", () => {
    render(
      <ComboEditorCharacterField
        characterId={1}
        mode="new"
        onChange={vi.fn()}
        lockedReason="確定反撃サーチからの登録では変更不可"
      />,
      { wrapper: createWrapper() },
    );
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByText("リュウ")).toBeDefined();
    expect(
      screen.getByText("(確定反撃サーチからの登録では変更不可)"),
    ).toBeDefined();
  });
});

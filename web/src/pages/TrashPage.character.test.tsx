import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TrashPage } from "./TrashPage";

// ★★M24-08 第 2 部 A（D-611 / D-617 ／ followup `trash-scoped-to-single-character`）。
//
// ゴミ箱はキャラ ID が 1 に固定されていた。本サブで選べるようにした。
//
// ★★本テストが守るのは「コンボ表とセットプレイ表の“両方”がキャラに追従すること」
//   である。指示書 §4.2 の「落としやすい点 2」＝コンボ表だけ直してセットプレイ表を
//   忘れる形になりやすい、に正面から対応する観測である。
//   ⇒ どちらか片方でも固定値に戻せば赤くなる（破壊確認 3）。

const trashCombosSpy = vi.fn();
const trashSetupsSpy = vi.fn();

vi.mock("@/features/combo/hooks/useTrashCombos", () => ({
  useTrashCombos: (characterId: number) => {
    trashCombosSpy(characterId);
    return { data: { items: [] }, isLoading: false, error: null, refetch: vi.fn() };
  },
}));

vi.mock("@/features/setup/hooks/useTrashSetups", () => ({
  useTrashSetups: (characterId: number) => {
    trashSetupsSpy(characterId);
    return { data: [], isLoading: false, error: null, refetch: vi.fn() };
  },
}));

// 既定キャラの解決は M24-01 の共通機構が持つ。ここでは「解決値が既定になること」
// だけを見たいので固定値を返させる。
vi.mock("@/features/combo/hooks/useResolvedCharacterId", () => ({
  useResolvedCharacterId: () => 3,
}));

vi.mock("@/components/Header", () => ({ default: () => null }));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

// CharacterSelector の中身（SearchableSelect + useCharacters）は本テストの射程外。
// 「選ばれた値が両方の hook へ流れるか」だけを見るため、素の button 群に置き換える。
vi.mock("@/features/mycombo/components/CharacterSelector", () => ({
  default: ({
    selectedCharacterId,
    onChange,
  }: {
    selectedCharacterId: number | null;
    onChange: (id: number) => void;
  }) => (
    <div data-testid="character-selector">
      <span data-testid="selected-character">{String(selectedCharacterId)}</span>
      <button type="button" onClick={() => onChange(9)}>
        キャラ 9 を選ぶ
      </button>
    </div>
  ),
}));

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <TrashPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ゴミ箱のキャラ切替(M24-08 第 2 部 A)", () => {
  beforeEach(() => {
    trashCombosSpy.mockClear();
    trashSetupsSpy.mockClear();
  });

  it("既定は共通機構が解決したキャラであり、固定値 1 ではない", () => {
    renderPage();
    expect(trashCombosSpy).toHaveBeenCalledWith(3);
    expect(trashSetupsSpy).toHaveBeenCalledWith(3);
    expect(screen.getByTestId("selected-character").textContent).toBe("3");
  });

  it("★キャラを切り替えると、コンボ表とセットプレイ表の両方が新しいキャラで引き直される", async () => {
    renderPage();
    trashCombosSpy.mockClear();
    trashSetupsSpy.mockClear();

    fireEvent.click(screen.getByText("キャラ 9 を選ぶ"));

    await waitFor(() => {
      expect(trashCombosSpy).toHaveBeenCalledWith(9);
    });
    // ★セットプレイ側も必ず追従すること。ここが本テストの主眼である。
    expect(trashSetupsSpy).toHaveBeenCalledWith(9);

    // 切替後に古いキャラで引き直していないこと。
    expect(trashCombosSpy).not.toHaveBeenCalledWith(3);
    expect(trashSetupsSpy).not.toHaveBeenCalledWith(3);
  });

  it("キャラ選択の UI が画面に出ている", () => {
    renderPage();
    expect(screen.queryByTestId("character-selector")).not.toBeNull();
  });
});

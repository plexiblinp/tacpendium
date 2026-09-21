import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";

import "@/lib/i18n";

// M24-01: 既定キャラの解決順(§4.1-2)。段 3b(config.toml の既定)を差し替えられるようにする。
// 段 1(URL)・段 2(sessionStorage)は比較画面に無く、jsdom の sessionStorage も空である。
const mockConfigCharacterId = vi.fn((): number | undefined => undefined);
vi.mock("@/features/config/useConfig", () => ({
  CONFIG_KEY: ["config"],
  useConfig: () => ({ data: { defaults: { characterId: mockConfigCharacterId() } } }),
}));

// 比較中コンボの取得は固定値スタブにし、defaultCharacterId 算出のみを検証する。
const mockUseCompareCombos = vi.fn();
vi.mock("@/features/combo/hooks/useCompareCombos", () => ({
  useCompareCombos: (ids: number[]) => mockUseCompareCombos(ids),
}));

// 子コンポーネントはレンダリング簡略化のためスタブ化。
vi.mock("@/components/Header", () => ({ default: () => <div /> }));
vi.mock("@/features/combo/components/CompareTable", () => ({
  default: () => <div />,
}));
vi.mock("@/features/combo/components/CompareTargetList", () => ({
  default: () => <div />,
}));

// モーダルは受け取った defaultCharacterId を観測できるようスタブ化。
vi.mock("@/features/combo/components/AddComboToCompareModal", () => ({
  default: ({ defaultCharacterId }: { defaultCharacterId?: number }) => (
    <div data-testid="add-modal" data-default-character-id={defaultCharacterId} />
  ),
}));

import ComparePage from "./ComparePage";

function renderAt(path: string) {
  // M24-01: ComparePage は既定キャラの解決順で useCharacters(React Query)を引くため
  // QueryClient が要る。jsdom では characters の fetch が失敗し、実在検査はスキップされる。
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <ComparePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function comboQuery(characterId: number) {
  return {
    data: { id: 1, characterId },
    error: null,
    isLoading: false,
  };
}

describe("ComparePage M10-02 コンボ追加モーダルの既定キャラ", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfigCharacterId.mockReturnValue(undefined);
  });

  it("比較リスト先頭コンボの characterId が defaultCharacterId として渡る", () => {
    mockUseCompareCombos.mockReturnValue([comboQuery(2)]);
    renderAt("/compare?ids=1");
    expect(
      screen.getByTestId("add-modal").getAttribute("data-default-character-id"),
    ).toBe("2");
  });

  it("比較リストが空で設定の既定キャラも無いときはフォールバック定数(1)", () => {
    // M24-01 §4.1-2 の段 4。M10-02 時点の主張(INITIAL_CHARACTER_ID = 1)と同じ値である。
    mockUseCompareCombos.mockReturnValue([]);
    renderAt("/compare");
    expect(
      screen.getByTestId("add-modal").getAttribute("data-default-character-id"),
    ).toBe("1");
  });

  it("比較リストが空のときは設定の既定キャラ(段 3b)へ落ちる", () => {
    // ★M24-01 で足した主張。以前は config の値がどの画面へも届いていなかった(SM-041)。
    mockConfigCharacterId.mockReturnValue(3);
    mockUseCompareCombos.mockReturnValue([]);
    renderAt("/compare");
    expect(
      screen.getByTestId("add-modal").getAttribute("data-default-character-id"),
    ).toBe("3");
  });

  it("先頭コンボのキャラは設定の既定キャラより優先される(文脈ロジックは不変)", () => {
    mockConfigCharacterId.mockReturnValue(3);
    mockUseCompareCombos.mockReturnValue([comboQuery(2)]);
    renderAt("/compare?ids=1");
    expect(
      screen.getByTestId("add-modal").getAttribute("data-default-character-id"),
    ).toBe("2");
  });
});

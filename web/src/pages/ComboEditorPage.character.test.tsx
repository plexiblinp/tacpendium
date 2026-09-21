import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

import "@/lib/i18n";

// ComboEditor をスタブし、受け取った initialCharacterId を観測できるようにする。
vi.mock("@/features/combo/components/ComboEditor", () => ({
  ComboEditor: ({
    mode,
    initialCharacterId,
  }: {
    mode: string;
    initialCharacterId?: number;
  }) => (
    <div data-testid="combo-editor">
      <span data-testid="mode">{mode}</span>
      <span data-testid="initial-character-id">
        {initialCharacterId ?? "none"}
      </span>
    </div>
  ),
}));

// useCombo は新規モードでは null 引数で呼ばれ取得しないが、import 解決のためスタブする。
vi.mock("@/features/combo/api", () => ({
  useCombo: () => ({ data: undefined, isLoading: false, isError: false }),
}));

import { ComboEditorPage } from "./ComboEditorPage";
import { NavigationGuardProvider } from "@/features/navigation-guard/NavigationGuardProvider";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      {/* M24-04(CO-003): 編集面は useUnsavedChangesGuard を呼ぶため離脱ガードの
          provider が要る。★provider を外すとここが落ちる。 */}
      <NavigationGuardProvider>
        <Routes>
          <Route path="/combos/new" element={<ComboEditorPage />} />
        </Routes>
      </NavigationGuardProvider>
    </MemoryRouter>,
  );
}

afterEach(() => vi.clearAllMocks());

describe("ComboEditorPage M10-02 文脈キャラ伝播(?character=)", () => {
  it("?character=5 を新規モードの initialCharacterId として ComboEditor へ渡す", () => {
    renderAt("/combos/new?character=5");
    expect(screen.getByTestId("mode").textContent).toBe("new");
    expect(screen.getByTestId("initial-character-id").textContent).toBe("5");
  });

  it("文脈なし(パラメータなし)では initialCharacterId を渡さない(INITIAL へフォールバック)", () => {
    renderAt("/combos/new");
    expect(screen.getByTestId("initial-character-id").textContent).toBe("none");
  });

  it("character=0 は無視される(正の整数のみ採用)", () => {
    renderAt("/combos/new?character=0");
    expect(screen.getByTestId("initial-character-id").textContent).toBe("none");
  });

  it("非数値の character は無視される", () => {
    renderAt("/combos/new?character=abc");
    expect(screen.getByTestId("initial-character-id").textContent).toBe("none");
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import "@/lib/i18n";
import type {
  ComboImportPreviewResponse,
  ComboPreviewRow,
} from "@/features/combo-io/types";

// Header は認証・設定など画面外の依存を引くため、本テストの対象外として差し替える。
vi.mock("@/components/Header", () => ({ default: () => null }));

vi.mock("@/features/combo-io/usePreviewNames", () => ({
  usePreviewNames: () => ({
    resolveCharacter: (code: string) => code,
    resolveMove: (_c: string, code: string) => code,
    resolveParent: () => "",
  }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

const previewMutate = vi.fn();
const commitMutate = vi.fn();
const previewState = {
  mutate: previewMutate,
  isPending: false,
  isError: false,
  isSuccess: false,
  data: undefined as ComboImportPreviewResponse | undefined,
};

vi.mock("@/features/combo-io/api", () => ({
  useImportComboPreview: () => previewState,
  useImportComboCommit: () => ({
    mutate: commitMutate,
    isPending: false,
    isError: false,
  }),
}));

import ComboImportPage from "./ComboImportPage";

function makeRow(over: Partial<ComboPreviewRow> = {}): ComboPreviewRow {
  return {
    rowNumber: 1,
    localId: "r1",
    characterCode: "ryu",
    starterMoveCode: "mk",
    isDraft: false,
    stepCount: 1,
    duplicate: false,
    warnings: [],
    errors: [],
    importable: true,
    ...over,
  };
}

function makePreview(combos: ComboPreviewRow[]): ComboImportPreviewResponse {
  return {
    combos,
    setups: [],
    summary: {
      comboTotal: combos.length,
      comboOk: combos.length,
      comboWarning: 0,
      comboError: 0,
      setupTotal: 0,
    },
  };
}

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

function renderPage() {
  return render(<ComboImportPage />, { wrapper: createWrapper() });
}

describe("ComboImportPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    previewState.isSuccess = false;
    previewState.data = undefined;
  });

  describe("プレビュー結果の反映(CO-023 / G-15 の StrictMode 対策の成立)", () => {
    // ★本ケースが固定しているもの: プレビュー結果は mutate の per-call onSuccess ではなく
    //   previewM.data の購読で反映される。dev の二重マウントで per-call コールバックが
    //   落ちても表示されることが、この経路の意味である(M17-04・followup G-15(a))。
    //   ★対策は着手時点で既に入っていた。実装せず、成立をここで固定する(指示書 §9.3)。
    it("mutate の onSuccess ではなく previewM.data を購読して表示する", () => {
      previewState.isSuccess = true;
      previewState.data = makePreview([makeRow()]);

      renderPage();

      // per-call の onSuccess は一度も呼ばれていないが、表は出ている。
      expect(previewMutate).not.toHaveBeenCalled();
      expect(screen.getByText(/1 行中 1 行を取込対象に選択中/)).toBeTruthy();
    });
  });

  describe("仮登録の除外(SM-071)", () => {
    it("仮登録の行を取込対象に数えない", () => {
      previewState.isSuccess = true;
      previewState.data = makePreview([
        makeRow(),
        makeRow({ rowNumber: 2, localId: "r2", isDraft: true }),
      ]);

      renderPage();

      expect(screen.getByText(/2 行中 1 行を取込対象に選択中/)).toBeTruthy();
    });

    it("除外件数を出す(黙って減らさない)", () => {
      previewState.isSuccess = true;
      previewState.data = makePreview([
        makeRow(),
        makeRow({ rowNumber: 2, localId: "r2", isDraft: true }),
        makeRow({ rowNumber: 3, localId: "r3", isDraft: true }),
      ]);

      renderPage();

      expect(
        screen.getByTestId("import-draft-excluded").textContent,
      ).toContain("仮登録の 2 行を取込対象から除外しました");
    });

    it("仮登録が無いときは除外件数を出さない", () => {
      previewState.isSuccess = true;
      previewState.data = makePreview([makeRow()]);

      renderPage();

      expect(screen.queryByTestId("import-draft-excluded")).toBeNull();
    });

    it("仮登録の行はチェックできない(行自体は消さない)", () => {
      previewState.isSuccess = true;
      previewState.data = makePreview([
        makeRow(),
        makeRow({ rowNumber: 2, localId: "r2", isDraft: true }),
      ]);

      renderPage();

      expect(
        screen.getByLabelText("1行目を取込対象にする").hasAttribute("disabled"),
      ).toBe(false);
      expect(
        screen.getByLabelText("2行目を取込対象にする").hasAttribute("disabled"),
      ).toBe(true);
    });
  });

  describe("0 件ファイル(SM-076)", () => {
    it("取り込める行が 0 件だと読める", () => {
      previewState.isSuccess = true;
      previewState.data = makePreview([]);

      renderPage();

      expect(
        screen.getByTestId("import-empty-preview").textContent,
      ).toContain("取り込めるコンボ行がありません(0 件)");
    });

    it("ファイル自体を拒否したときは 0 件表示を出さない(理由が別だから)", () => {
      previewState.isSuccess = true;
      previewState.data = {
        ...makePreview([]),
        comboFileError: "[VAL-I04] CSV の列構成が不正です",
      };

      renderPage();

      expect(screen.queryByTestId("import-empty-preview")).toBeNull();
    });

    it("取り込める行があるときは 0 件表示を出さない", () => {
      previewState.isSuccess = true;
      previewState.data = makePreview([makeRow()]);

      renderPage();

      expect(screen.queryByTestId("import-empty-preview")).toBeNull();
    });
  });

  describe("取込実行の確認ダイアログ(SM-121)", () => {
    it("押しただけでは取り込まず、確認を出す", async () => {
      previewState.isSuccess = true;
      previewState.data = makePreview([makeRow()]);
      renderPage();

      await userEvent.click(screen.getByRole("button", { name: "取込実行" }));

      expect(commitMutate).not.toHaveBeenCalled();
      expect(screen.getByRole("alertdialog")).toBeTruthy();
    });

    it("確認の本文に取込件数と除外件数を出す", async () => {
      previewState.isSuccess = true;
      previewState.data = makePreview([
        makeRow(),
        makeRow({ rowNumber: 2, localId: "r2", isDraft: true }),
      ]);
      renderPage();

      await userEvent.click(screen.getByRole("button", { name: "取込実行" }));

      const body = screen.getByRole("alertdialog").textContent ?? "";
      expect(body).toContain("1 件のコンボを取り込みます");
      expect(body).toContain("仮登録の 1 件は取り込みません");
    });

    it("キャンセルすると取り込まない", async () => {
      previewState.isSuccess = true;
      previewState.data = makePreview([makeRow()]);
      renderPage();

      await userEvent.click(screen.getByRole("button", { name: "取込実行" }));
      await userEvent.click(screen.getByRole("button", { name: "キャンセル" }));

      expect(commitMutate).not.toHaveBeenCalled();
    });
  });
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Combo } from "../types";
import { PromoteToFinalButton } from "./PromoteToFinalButton";

function makeCombo(overrides?: Partial<Combo>): Combo {
  return {
    id: 1,
    characterId: 1,
    isDraft: true,
    affectedByGameUpdate: false,
    affectedMoves: [],
    stepCount: 3,
    version: 1,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    tags: [],
    defaultRecipe: "",
    starterMoveCode: "",
    ...overrides,
  };
}

function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("PromoteToFinalButton", () => {
  it("isDraft=false なら何も描画しない", () => {
    const { container } = renderWithQuery(
      <PromoteToFinalButton combo={makeCombo({ isDraft: false })} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("isDraft=true なら昇格ボタンを描画する", () => {
    renderWithQuery(<PromoteToFinalButton combo={makeCombo()} />);
    expect(screen.getByRole("button")).toBeTruthy();
  });

  it("ボタンクリックで確認ダイアログが表示される", async () => {
    const user = userEvent.setup();
    renderWithQuery(<PromoteToFinalButton combo={makeCombo()} />);

    await user.click(screen.getByRole("button"));

    expect(screen.getByRole("alertdialog")).toBeTruthy();
  });

  it("確認ダイアログでキャンセルするとダイアログが閉じる", async () => {
    const user = userEvent.setup();
    renderWithQuery(<PromoteToFinalButton combo={makeCombo()} />);

    await user.click(screen.getByRole("button"));
    expect(screen.getByRole("alertdialog")).toBeTruthy();

    await user.click(screen.getByText("common.cancel"));
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("確認ダイアログで OK を押すと PATCH リクエストが送信される", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ id: 1, isDraft: false, version: 2, characterId: 1, stepCount: 3, createdAt: "2026-01-01", updatedAt: "2026-01-01" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const onPromoted = vi.fn();
    renderWithQuery(
      <PromoteToFinalButton combo={makeCombo()} onPromoted={onPromoted} />,
    );

    await user.click(screen.getByRole("button"));
    await user.click(screen.getByText("common.confirm"));

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/combos/1",
      expect.objectContaining({ method: "PATCH" }),
    );
    const body = JSON.parse(
      fetchSpy.mock.calls[0][1]?.body as string,
    );
    expect(body.isDraft).toBe(false);
    expect(body.version).toBe(1);

    fetchSpy.mockRestore();
  });

  it("400 バリデーションエラー時は onValidationError に内容を渡す(バグ #5)", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "validation_error",
            message: "バリデーションエラー",
            details: {
              validations: {
                issues: [
                  {
                    code: "VAL-C09",
                    severity: "error",
                    field: "steps",
                    message: "レシピが空です。少なくとも 1 ステップ必要です",
                  },
                ],
              },
            },
          },
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      ),
    );
    const onValidationError = vi.fn();
    renderWithQuery(
      <PromoteToFinalButton
        combo={makeCombo()}
        onValidationError={onValidationError}
      />,
    );

    await user.click(screen.getByRole("button"));
    await user.click(screen.getByText("common.confirm"));

    await waitFor(() => {
      expect(onValidationError).toHaveBeenCalledWith(
        expect.objectContaining({
          issues: expect.arrayContaining([
            expect.objectContaining({ code: "VAL-C09", severity: "error" }),
          ]),
        }),
      );
    });

    fetchSpy.mockRestore();
  });
});

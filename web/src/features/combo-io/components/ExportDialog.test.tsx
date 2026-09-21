import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";

import "@/lib/i18n";
import ExportDialog from "./ExportDialog";

vi.mock("@/features/character/hooks/useCharacters", () => ({
  useCharacters: vi.fn(() => ({ data: [], isLoading: false })),
}));

const mutateAsync = vi.fn(async () => {});
vi.mock("../api", () => ({
  useExportCombo: vi.fn(() => ({ mutateAsync })),
}));

const { runExportMock } = vi.hoisted(() => ({
  runExportMock: vi.fn(),
}));
vi.mock("../run-export", async () => {
  const actual = await vi.importActual<typeof import("../run-export")>(
    "../run-export",
  );
  return { ...actual, runExport: runExportMock };
});

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

import { toast } from "sonner";

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe("ExportDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runExportMock.mockResolvedValue({
      results: [{ format: "csv", status: "success" }],
    });
  });

  it("選択中コンボの件数を表示する", () => {
    render(
      <ExportDialog
        open={true}
        onOpenChange={vi.fn()}
        comboIds={[1, 2, 3]}
        comboTotalCount={3}
        isSelectionActive={true}
      />,
      { wrapper: createWrapper() },
    );
    expect(screen.getByText(/選択した 3 件/)).toBeTruthy();
  });

  it("選択ゼロ(現フィルタ全件)は全件表示になる", () => {
    render(
      <ExportDialog
        open={true}
        onOpenChange={vi.fn()}
        comboIds={[1, 2, 3, 4, 5]}
        comboTotalCount={5}
        isSelectionActive={false}
      />,
      { wrapper: createWrapper() },
    );
    expect(screen.getByText(/現在のフィルタ結果 全 5 件/)).toBeTruthy();
  });

  it("既定は CSV のみ選択・出力項目は非表示", () => {
    render(
      <ExportDialog
        open={true}
        onOpenChange={vi.fn()}
        comboIds={[1]}
        comboTotalCount={1}
        isSelectionActive={true}
      />,
      { wrapper: createWrapper() },
    );
    expect(
      screen.getByTestId("export-format-csv").getAttribute("data-state"),
    ).toBe("checked");
    expect(screen.queryByText("出力項目")).toBeNull();
  });

  it("PDF を選択すると出力項目が表示され、既定で全項目 ON", async () => {
    render(
      <ExportDialog
        open={true}
        onOpenChange={vi.fn()}
        comboIds={[1]}
        comboTotalCount={1}
        isSelectionActive={true}
      />,
      { wrapper: createWrapper() },
    );
    const user = userEvent.setup();
    await user.click(screen.getByTestId("export-format-pdf"));
    expect(screen.getByText("出力項目")).toBeTruthy();
    expect(
      screen.getByTestId("export-item-recipe").getAttribute("data-state"),
    ).toBe("checked");
  });

  it("クリップボードは他形式が選択中だと非活性、他形式もクリップボード選択中は非活性", async () => {
    const user = userEvent.setup();
    render(
      <ExportDialog
        open={true}
        onOpenChange={vi.fn()}
        comboIds={[1]}
        comboTotalCount={1}
        isSelectionActive={true}
      />,
      { wrapper: createWrapper() },
    );

    // 既定で csv が選択されているため、クリップボードは非活性
    expect(screen.getByTestId("export-format-clipboard").hasAttribute("disabled")).toBe(true);

    // csv を外すとクリップボードが活性化
    await user.click(screen.getByTestId("export-format-csv"));
    expect(screen.getByTestId("export-format-clipboard").hasAttribute("disabled")).toBe(false);

    // クリップボードを選択すると他形式が非活性
    await user.click(screen.getByTestId("export-format-clipboard"));
    expect(screen.getByTestId("export-format-csv").hasAttribute("disabled")).toBe(true);
    expect(screen.getByTestId("export-format-pdf").hasAttribute("disabled")).toBe(true);
    expect(screen.getByTestId("export-format-png").hasAttribute("disabled")).toBe(true);
  });

  it("対象0件では実行ボタンが非活性", () => {
    render(
      <ExportDialog
        open={true}
        onOpenChange={vi.fn()}
        comboIds={[]}
        comboTotalCount={0}
        isSelectionActive={false}
      />,
      { wrapper: createWrapper() },
    );
    expect(
      (screen.getByText("エクスポート実行") as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("実行ボタン押下で runExport が選択済みパラメータで呼ばれ、成功トーストが出る", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <ExportDialog
        open={true}
        onOpenChange={onOpenChange}
        comboIds={[10, 20]}
        comboTotalCount={2}
        isSelectionActive={true}
      />,
      { wrapper: createWrapper() },
    );

    await user.click(screen.getByText("エクスポート実行"));

    expect(runExportMock).toHaveBeenCalledWith(
      expect.objectContaining({
        exportParams: { range: "selected", ids: [10, 20] },
        exportCsv: mutateAsync,
      }),
    );
    expect(toast.success).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("一部形式が失敗すると警告トーストが出てダイアログは閉じない", async () => {
    runExportMock.mockResolvedValue({
      results: [
        { format: "csv", status: "success" },
        { format: "pdf", status: "error", error: new Error("boom") },
      ],
    });
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <ExportDialog
        open={true}
        onOpenChange={onOpenChange}
        comboIds={[1]}
        comboTotalCount={1}
        isSelectionActive={true}
      />,
      { wrapper: createWrapper() },
    );

    await user.click(screen.getByTestId("export-format-pdf"));
    await user.click(screen.getByText("エクスポート実行"));

    expect(toast.warning).toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("視覚形式のみ(PDF)選択時は video/image を出さない(15項目・案B)", async () => {
    const user = userEvent.setup();
    render(
      <ExportDialog
        open={true}
        onOpenChange={vi.fn()}
        comboIds={[1]}
        comboTotalCount={1}
        isSelectionActive={true}
      />,
      { wrapper: createWrapper() },
    );
    // 既定 csv を外し PDF のみにする → 視覚のみ = 15
    await user.click(screen.getByTestId("export-format-csv"));
    await user.click(screen.getByTestId("export-format-pdf"));
    expect(screen.getByTestId("export-item-recipe")).toBeTruthy();
    expect(screen.getByTestId("export-item-link")).toBeTruthy(); // link は視覚に残す
    expect(screen.queryByTestId("export-item-videoPath")).toBeNull();
    expect(screen.queryByTestId("export-item-imagePath")).toBeNull();
  });

  it("CSV を含む選択時は video/image も表示(17項目・案B)", async () => {
    const user = userEvent.setup();
    render(
      <ExportDialog
        open={true}
        onOpenChange={vi.fn()}
        comboIds={[1]}
        comboTotalCount={1}
        isSelectionActive={true}
      />,
      { wrapper: createWrapper() },
    );
    // 既定 csv ON のまま PDF を追加 → csv 含む = 17
    await user.click(screen.getByTestId("export-format-pdf"));
    expect(screen.getByTestId("export-item-videoPath")).toBeTruthy();
    expect(screen.getByTestId("export-item-imagePath")).toBeTruthy();
  });
  // ── ファイル名の自動命名(SM-075・M24-06 §4.4) ─────────────────────────
  describe("ファイル名の欄", () => {
    const NAME_RE = /^combos_(all|filtered|selected|mycombo)_\d+_\d{8}-\d{6}(_\d+)?$/;

    function nameInput(): HTMLInputElement {
      return screen.getByTestId("export-file-name") as HTMLInputElement;
    }

    it("自動生成値が初期値として入る(空欄で毎回入力させない)", () => {
      render(
        <ExportDialog
          open={true}
          onOpenChange={vi.fn()}
          comboIds={[1, 2, 3]}
          comboTotalCount={3}
          isSelectionActive={true}
        />,
        { wrapper: createWrapper() },
      );
      expect(nameInput().value).toMatch(NAME_RE);
    });

    it("件数と対象の種別が名前へ入る(選択中)", () => {
      render(
        <ExportDialog
          open={true}
          onOpenChange={vi.fn()}
          comboIds={[1, 2, 3]}
          comboTotalCount={3}
          isSelectionActive={true}
        />,
        { wrapper: createWrapper() },
      );
      expect(nameInput().value.startsWith("combos_selected_3_")).toBe(true);
    });

    it("選択ゼロ(現フィルタ全件)は filtered になる", () => {
      render(
        <ExportDialog
          open={true}
          onOpenChange={vi.fn()}
          comboIds={[1, 2]}
          comboTotalCount={2}
          isSelectionActive={false}
        />,
        { wrapper: createWrapper() },
      );
      expect(nameInput().value.startsWith("combos_filtered_2_")).toBe(true);
    });

    it("利用者が書き換えたら、その名前が出力へ渡る(入力済みを尊重する)", async () => {
      const user = userEvent.setup();
      render(
        <ExportDialog
          open={true}
          onOpenChange={vi.fn()}
          comboIds={[1]}
          comboTotalCount={1}
          isSelectionActive={true}
        />,
        { wrapper: createWrapper() },
      );
      await user.clear(nameInput());
      await user.type(nameInput(), "my-combos");
      await user.click(screen.getByRole("button", { name: "エクスポート実行" }));

      expect(runExportMock).toHaveBeenCalledTimes(1);
      expect(runExportMock.mock.calls[0][0].baseName).toBe("my-combos");
    });

    it("空にして実行したら自動値へ倒す(名前の無いファイルを作らない)", async () => {
      const user = userEvent.setup();
      render(
        <ExportDialog
          open={true}
          onOpenChange={vi.fn()}
          comboIds={[1]}
          comboTotalCount={1}
          isSelectionActive={true}
        />,
        { wrapper: createWrapper() },
      );
      await user.clear(nameInput());
      await user.click(screen.getByRole("button", { name: "エクスポート実行" }));

      expect(runExportMock.mock.calls[0][0].baseName).toMatch(NAME_RE);
    });

    it("開き直すと自動値へ戻る(書き換えた名前を使い回さない)", async () => {
      // ★ダイアログは常時マウントされているため、閉じても state は残る。
      //   一度触った名前が以後ずっと使われると、連続エクスポートで衝突する。
      const user = userEvent.setup();
      function Harness({ open }: { open: boolean }) {
        return (
          <ExportDialog
            open={open}
            onOpenChange={vi.fn()}
            comboIds={[1]}
            comboTotalCount={1}
            isSelectionActive={true}
          />
        );
      }
      const { rerender } = render(<Harness open={true} />, {
        wrapper: createWrapper(),
      });
      await user.clear(nameInput());
      await user.type(nameInput(), "my-combos");
      expect(nameInput().value).toBe("my-combos");

      rerender(<Harness open={false} />);
      rerender(<Harness open={true} />);

      expect(nameInput().value).toMatch(NAME_RE);
    });

    it("書き換えたあと同じ滞在中に 2 回実行しても、名前は衝突しない", async () => {
      const user = userEvent.setup();
      render(
        <ExportDialog
          open={true}
          onOpenChange={vi.fn()}
          comboIds={[1]}
          comboTotalCount={1}
          isSelectionActive={true}
        />,
        { wrapper: createWrapper() },
      );
      await user.clear(nameInput());
      await user.type(nameInput(), "my-combos");
      const run = screen.getByRole("button", { name: "エクスポート実行" });
      await user.click(run);
      await user.click(run);

      expect(runExportMock).toHaveBeenCalledTimes(2);
      // ★入力済みは尊重する(D-592)。2 回目も同じ名前で構わないが、
      //   「利用者が明示的に決めた名前」であることが観測に残っている必要がある。
      expect(runExportMock.mock.calls[0][0].baseName).toBe("my-combos");
      expect(runExportMock.mock.calls[1][0].baseName).toBe("my-combos");
    });

    it("書き換えていなければ、連続して実行しても同じ名前を渡さない", async () => {
      const user = userEvent.setup();
      render(
        <ExportDialog
          open={true}
          onOpenChange={vi.fn()}
          comboIds={[1]}
          comboTotalCount={1}
          isSelectionActive={true}
        />,
        { wrapper: createWrapper() },
      );
      const run = screen.getByRole("button", { name: "エクスポート実行" });
      await user.click(run);
      await user.click(run);

      expect(runExportMock).toHaveBeenCalledTimes(2);
      const first = runExportMock.mock.calls[0][0].baseName;
      const second = runExportMock.mock.calls[1][0].baseName;
      expect(second).not.toBe(first);
    });
  });

  // =========================================================================
  // ★★M29-02 §2.1: 上限で切り捨てるときは黙って出さず、件数を示して選ばせる
  //   (開発者選択の鳴らし方 (c))。
  //
  // ★実 ja.json を引く t で文面を主張する(チェックリスト §5-3)。キーをそのまま
  //   返すモックでは「何と書いてあるか」の主張が空振りする。
  // =========================================================================
  describe("行数上限の切り捨て", () => {
    it("★総数が出せる件数を超えるとき、実行しても即座に出力せず確認を出す", async () => {
      const user = userEvent.setup();
      render(
        <ExportDialog
          open={true}
          onOpenChange={vi.fn()}
          comboIds={[1, 2, 3]}
          comboTotalCount={250}
          isSelectionActive={false}
        />,
        { wrapper: createWrapper() },
      );

      await user.click(screen.getByRole("button", { name: "エクスポート実行" }));

      // ★★出力は始まっていない。黙って一部だけ出すことが事故の形である。
      expect(runExportMock).not.toHaveBeenCalled();
      const alert = screen.getByTestId("export-truncation-confirm");
      expect(alert.textContent).toContain("250");
      expect(alert.textContent).toContain("3");
      expect(alert.textContent).toContain("247"); // 落ちる件数
    });

    it("確認したうえで続けると出力する", async () => {
      const user = userEvent.setup();
      render(
        <ExportDialog
          open={true}
          onOpenChange={vi.fn()}
          comboIds={[1, 2, 3]}
          comboTotalCount={250}
          isSelectionActive={false}
        />,
        { wrapper: createWrapper() },
      );

      await user.click(screen.getByRole("button", { name: "エクスポート実行" }));
      await user.click(screen.getByRole("button", { name: "このまま出力する" }));

      expect(runExportMock).toHaveBeenCalledTimes(1);
    });

    it("確認を出している間のキャンセルは、出力を取りやめるがダイアログは閉じない", async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(
        <ExportDialog
          open={true}
          onOpenChange={onOpenChange}
          comboIds={[1, 2, 3]}
          comboTotalCount={250}
          isSelectionActive={false}
        />,
        { wrapper: createWrapper() },
      );

      await user.click(screen.getByRole("button", { name: "エクスポート実行" }));
      await user.click(screen.getByRole("button", { name: "キャンセル" }));

      expect(runExportMock).not.toHaveBeenCalled();
      expect(onOpenChange).not.toHaveBeenCalled();
      expect(screen.queryByTestId("export-truncation-confirm")).toBeNull();
    });

    // ★★境界。ちょうど出せる件数のときに確認を出すと、1 件も落ちていないのに
    //   利用者を止めることになる(偽陽性)。
    it("総数と出せる件数が等しいときは確認を出さずそのまま出力する", async () => {
      const user = userEvent.setup();
      render(
        <ExportDialog
          open={true}
          onOpenChange={vi.fn()}
          comboIds={[1, 2, 3]}
          comboTotalCount={3}
          isSelectionActive={false}
        />,
        { wrapper: createWrapper() },
      );

      await user.click(screen.getByRole("button", { name: "エクスポート実行" }));

      expect(screen.queryByTestId("export-truncation-confirm")).toBeNull();
      expect(runExportMock).toHaveBeenCalledTimes(1);
    });

    it("★出力後に BE が切り捨てを報告したら警告を出す(送信前の確認とは別経路)", async () => {
      const user = userEvent.setup();
      runExportMock.mockImplementation(async (params) => {
        params.onTruncated?.({ total: 1500, included: 1000, reimportBlocked: false });
        return { results: [{ format: "csv", status: "success" }] };
      });
      render(
        <ExportDialog
          open={true}
          onOpenChange={vi.fn()}
          comboIds={[1]}
          comboTotalCount={1}
          isSelectionActive={true}
        />,
        { wrapper: createWrapper() },
      );

      await user.click(screen.getByRole("button", { name: "エクスポート実行" }));

      expect(toast.warning).toHaveBeenCalledWith(
        expect.stringContaining("500"),
      );
    });

    it("★出力が取込の上限を超えるときも警告を出す(往復できないことを伝える)", async () => {
      const user = userEvent.setup();
      runExportMock.mockImplementation(async (params) => {
        params.onReimportBlocked?.({ total: 10, included: 10, reimportBlocked: true });
        return { results: [{ format: "csv", status: "success" }] };
      });
      render(
        <ExportDialog
          open={true}
          onOpenChange={vi.fn()}
          comboIds={[1]}
          comboTotalCount={1}
          isSelectionActive={true}
        />,
        { wrapper: createWrapper() },
      );

      await user.click(screen.getByRole("button", { name: "エクスポート実行" }));

      expect(toast.warning).toHaveBeenCalledWith(
        expect.stringContaining("取込"),
      );
    });
  });
});

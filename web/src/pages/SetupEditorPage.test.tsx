import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import React from "react";

import { SetupEditorPage } from "./SetupEditorPage";
import { ApiError } from "@/features/combo/api";
import { NavigationGuardProvider } from "@/features/navigation-guard/NavigationGuardProvider";

// 安定した参照で返すことで useEffect([setupQ.data]) の無限ループを防ぐ
const mockComboData = { id: 5, characterId: 1 };
const mockSetupData = {
  id: 3, characterId: 1, name: "既存セットプレイ", description: null,
  steps: [], version: 2, defaultRecipe: "", parentComboIds: [], stepCount: 0,
  createdAt: "", updatedAt: "",
};

const mockCreateMutate = vi.fn();
const mockUpdateMutate = vi.fn();

vi.mock("@/features/combo/api", async (importActual) => {
  // ApiError は parseSetupApiError の instanceof 判定に必要なため実体を温存する。
  const actual = await importActual<typeof import("@/features/combo/api")>();
  return {
    ...actual,
    useCombo: vi.fn(() => ({ data: mockComboData, isLoading: false, isError: false })),
  };
});

vi.mock("@/features/setup/hooks/useSetup", () => ({
  useSetup: vi.fn(() => ({ data: mockSetupData, isLoading: false, isError: false })),
}));

vi.mock("@/features/setup/hooks/useCreateSetup", () => ({
  useCreateSetup: vi.fn(() => ({ mutate: mockCreateMutate, isPending: false })),
}));

vi.mock("@/features/setup/hooks/useUpdateSetup", () => ({
  useUpdateSetup: vi.fn(() => ({ mutate: mockUpdateMutate, isPending: false })),
}));

vi.mock("@/features/setup/components/SetupBasicInfoForm", () => ({
  // M24-04(CO-003): dirty を立てる観測点。★名前を変える操作のスタブである。
  SetupBasicInfoForm: ({
    onChange,
  }: {
    onChange: (changes: { name?: string | null }) => void;
  }) => (
    <button
      type="button"
      data-testid="setup-set-name"
      onClick={() => onChange({ name: "m24-04-changed" })}
    >
      set name
    </button>
  ),
}));

vi.mock("@/features/setup/components/SetupRecipeEditor", () => ({
  SetupRecipeEditor: () => null,
}));

// M19-07 追補: VerifiedConditionsField は i18n を使うため、キーをそのまま返す。
// ★M24-07: 本画面を i18n 化した。モックはキーを返す形のままだが、補間値も
//   「キー#値」で見えるようにする——コピー元 ID が渡っていることを検証するため。
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { id?: number }) =>
      opts?.id === undefined ? key : `${key}#${opts.id}`,
  }),
}));

function renderAt(path: string, routePattern: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    React.createElement(
      QueryClientProvider, { client: qc },
      React.createElement(
        MemoryRouter, { initialEntries: [path] },
        // M24-04(CO-003): 編集面は useUnsavedChangesGuard を呼ぶため離脱ガードの
        // provider が要る。★provider を外すとここが落ちる。
        React.createElement(NavigationGuardProvider, null,
          React.createElement(Routes, null,
            React.createElement(Route, {
              path: routePattern,
              element: React.createElement(SetupEditorPage),
            }),
          ),
        ),
      ),
    ),
  );
}

afterEach(() => vi.clearAllMocks());

describe("SetupEditorPage", () => {
  it("新規作成モード: セットプレイ登録タイトルが表示される", () => {
    renderAt("/combos/5/setups/new", "/combos/:comboId/setups/new");
    expect(screen.getByText("setup.editor.createTitle")).toBeDefined();
  });

  it("編集モード: セットプレイ編集タイトルが表示される", () => {
    renderAt("/setups/3", "/setups/:setupId");
    expect(screen.getByText("setup.editor.editTitle")).toBeDefined();
  });

  // =========================================================================
  // ★★M31-01(P4M-004): 戻る導線の位置
  //
  // 逐語＝「セットプレイ編集画面で元の画面に戻るボタンが他と不統一で左上ではなく
  // 右上にある」(phase4-memo.txt:18)。
  // ★本プロジェクトの作法は **戻るが左端・見出しはその下** である
  //   (ComboDetailPage / TrashComboDetailPage)。⇒ DOM 順で固定する。
  // ★見た目の座標ではなく DOM 順で見るのは、jsdom がレイアウトを持たないためである。
  //   左右の位置は Tailwind の justify-between が決めており、そこは E2E の担当。
  // =========================================================================

  it("★戻る導線が見出しより前に出る(左上へ寄せた・両モード)", () => {
    for (const [path, pattern] of [
      ["/combos/5/setups/new", "/combos/:comboId/setups/new"],
      ["/setups/3", "/setups/:setupId"],
    ] as const) {
      const { unmount } = renderAt(path, pattern);
      const back = screen.getByText("setup.editor.backCancel");
      const heading = screen.getByRole("heading", { level: 1 });
      // Node.DOCUMENT_POSITION_FOLLOWING = 4 → back の後ろに heading が在る。
      expect(back.compareDocumentPosition(heading) & 4).toBeTruthy();
      unmount();
    }
  });

  it("新規作成モード: 保存ボタンで useCreateSetup が呼ばれる", async () => {
    renderAt("/combos/5/setups/new", "/combos/:comboId/setups/new");
    fireEvent.click(screen.getByText("setup.editor.save"));
    await waitFor(() => {
      expect(mockCreateMutate).toHaveBeenCalledWith(
        expect.objectContaining({ comboId: 5 }),
        expect.any(Object),
      );
    });
  });

  it("編集モード: 保存ボタンで useUpdateSetup が version 込みで呼ばれる", async () => {
    renderAt("/setups/3", "/setups/:setupId");
    fireEvent.click(screen.getByText("setup.editor.save"));
    await waitFor(() => {
      expect(mockUpdateMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 3,
          input: expect.objectContaining({ version: 2 }),
        }),
        expect.any(Object),
      );
    });
  });

  it("登録時の VAL-S02 バリデーションエラーが全幅表示される(バグ#6)", async () => {
    const validations = {
      issues: [
        { code: "VAL-S02", severity: "error" as const, field: "steps", message: "レシピが空です" },
      ],
    };
    const err = new ApiError(
      400,
      { error: { code: "validation_failed", details: { validations } } },
      "バリデーションエラーがあります",
    );
    mockCreateMutate.mockImplementationOnce(
      (_vars: unknown, opts: { onError?: (e: unknown) => void }) => opts.onError?.(err),
    );
    renderAt("/combos/5/setups/new", "/combos/:comboId/setups/new");
    fireEvent.click(screen.getByText("setup.editor.save"));
    await waitFor(() => {
      expect(screen.getByText("レシピが空です")).toBeDefined();
      expect(screen.getByText("VAL-S02")).toBeDefined();
    });
  });

  it("C-04: バリデーション警告が保存ボタンの直上(=DOM 上で前方)に描画される", async () => {
    const validations = {
      issues: [
        { code: "VAL-S02", severity: "error" as const, field: "steps", message: "レシピが空です" },
      ],
    };
    const err = new ApiError(
      400,
      { error: { code: "validation_failed", details: { validations } } },
      "バリデーションエラーがあります",
    );
    mockCreateMutate.mockImplementationOnce(
      (_vars: unknown, opts: { onError?: (e: unknown) => void }) => opts.onError?.(err),
    );
    renderAt("/combos/5/setups/new", "/combos/:comboId/setups/new");
    const saveButton = screen.getByText("setup.editor.save");
    fireEvent.click(saveButton);
    await waitFor(() => expect(screen.getByText("レシピが空です")).toBeDefined());
    const errorEl = screen.getByText("レシピが空です");
    // エラー表示が保存ボタンより DOM 上で前方(直上)にある。
    expect(
      errorEl.compareDocumentPosition(saveButton) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  // ★M19-07 追補: セットプレイ登録画面でも「確認できた条件」を入力できる。
  // この面は URL に comboId があり親が確定しているため v3 原則(DES-005 §5.6)を満たす。
  describe("成立条件の入力(M19-07 追補)", () => {
    const CELL = "setup-editor-confirmed";

    it("新規登録モードでは 2×2 の入力が出る", () => {
      renderAt("/combos/5/setups/new", "/combos/:comboId/setups/new");
      expect(screen.getByTestId(CELL)).toBeDefined();
      for (const key of [
        "neutral_tech:false",
        "neutral_tech:true",
        "back_tech:false",
        "back_tech:true",
      ]) {
        expect(screen.getByTestId(`${CELL}-${key}`)).toBeDefined();
      }
      // 既定は全セル未チェック。
      const boxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
      expect(boxes).toHaveLength(4);
      expect(boxes.every((b) => !b.checked)).toBe(true);
    });

    it("★編集モード(/setups/:id)には出さない(DES-005 §5.6 = 実装しない)", () => {
      renderAt("/setups/3", "/setups/:setupId");
      expect(screen.queryByTestId(CELL)).toBeNull();
      expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    });

    it("チェックしたセルだけが作成 payload の verifiedConditions に載る", async () => {
      renderAt("/combos/5/setups/new", "/combos/:comboId/setups/new");

      fireEvent.click(screen.getByTestId(`${CELL}-neutral_tech:false`));
      fireEvent.click(screen.getByTestId(`${CELL}-back_tech:true`));
      fireEvent.click(screen.getByText("setup.editor.save"));

      await waitFor(() => expect(mockCreateMutate).toHaveBeenCalled());
      const [payload] = mockCreateMutate.mock.calls[0];
      expect(payload.comboId).toBe(5);
      expect(payload.input.verifiedConditions).toEqual([
        { techType: "neutral_tech", inCorner: false },
        { techType: "back_tech", inCorner: true },
      ]);
    });

    it("1 つもチェックしなければ空配列で送る(チェックせずに登録できる)", async () => {
      renderAt("/combos/5/setups/new", "/combos/:comboId/setups/new");
      fireEvent.click(screen.getByText("setup.editor.save"));

      await waitFor(() => expect(mockCreateMutate).toHaveBeenCalled());
      expect(mockCreateMutate.mock.calls[0][0].input.verifiedConditions).toEqual([]);
    });
  });
});

// ★★M24-04(CO-003): セットプレイ編集にも離脱ガードが掛かる(指示書 §4.1 の対象 3 面目)。
//   ここは「保存の成功で dirty が落ちること」を守る唯一の機械的な網である
//   ——落ちないと、保存が済んでいるのに離脱の確認が出て、しかも番人の履歴エントリが
//   残るため遷移そのものが空振りする。
describe("M24-04 CO-003 セットプレイ編集の未保存ガード", () => {
  it("何も触っていなければガードは張られない", () => {
    renderAt("/setups/3", "/setups/:setupId");
    expect(screen.queryByTestId("unsaved-changes-armed")).toBeNull();
  });

  it("入力を変えるとガードが張られる", () => {
    renderAt("/setups/3", "/setups/:setupId");
    fireEvent.click(screen.getByTestId("setup-set-name"));
    expect(screen.getByTestId("unsaved-changes-armed")).toBeTruthy();
  });

  it("★保存が成功するとガードが外れる(dirty が落ちる)", async () => {
    renderAt("/setups/3", "/setups/:setupId");
    fireEvent.click(screen.getByTestId("setup-set-name"));
    expect(screen.getByTestId("unsaved-changes-armed")).toBeTruthy();

    fireEvent.click(screen.getByText("setup.editor.save"));
    await waitFor(() => expect(mockUpdateMutate).toHaveBeenCalled());
    const [, options] = mockUpdateMutate.mock.calls[0];
    await act(async () => {
      await options.onSuccess({ id: 3 });
    });

    expect(screen.queryByTestId("unsaved-changes-armed")).toBeNull();
  });

  it("入力があるとキャンセルで確認が出る(下部のボタンも塞がっている)", () => {
    renderAt("/setups/3", "/setups/:setupId");
    fireEvent.click(screen.getByTestId("setup-set-name"));

    // ★上部「← キャンセル」と保存ボタン隣の「キャンセル」の 2 つがある。
    //   ★下部だけ素通りしていた事故があったため、両方を数えて両方を押す。
    // ★M24-07: 文言を locale へ移したため、2 つの離脱導線は別キーになった
    //   (上部 backCancel / 下部 cancel)。**両方を数えて両方を押す**という
    //   本テストの主張は変えない——下部だけ素通りしていた事故を塞ぐものである。
    const cancels = screen.getAllByText(/^setup\.editor\.(backCancel|cancel)$/);
    expect(cancels.length).toBeGreaterThanOrEqual(2);
    for (const cancel of cancels) {
      fireEvent.click(cancel);
      expect(screen.getByTestId("unsaved-changes-dialog")).toBeTruthy();
      fireEvent.click(screen.getByText("このページに留まる"));
    }
  });
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import "@/lib/i18n";

import ja from "@/locales/ja.json";

import { SetupEditorPage } from "./SetupEditorPage";
import { NavigationGuardProvider } from "@/features/navigation-guard/NavigationGuardProvider";

// M23-09 §5.2: 保存前の重複ダイアログ(セットプレイ登録)。
//
// ★★i18n は実 ja.json を引く。キー返しモックでは §5.2-4 の主張が空振りする
//   (M23-04 教訓 2)。既存の SetupEditorPage.test.tsx はキー返しモックのため別ファイルにする。
//
// ★セットプレイに仮登録の概念は無いため、コンボ側の isDraft 分岐に相当する対照は無い。

const mockComboData = { id: 5, characterId: 1 };

const mockCreateMutate = vi.fn();
const mockRestoreMutate = vi.fn();
const mockNavigate = vi.fn();
const mockToastWarning = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    error: (...a: unknown[]) => mockToastError(...a),
    success: (...a: unknown[]) => mockToastSuccess(...a),
    warning: (...a: unknown[]) => mockToastWarning(...a),
  },
}));

vi.mock("react-router-dom", async (importActual) => {
  const actual = await importActual<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("@/features/combo/api", async (importActual) => {
  const actual = await importActual<typeof import("@/features/combo/api")>();
  return {
    ...actual,
    useCombo: vi.fn(() => ({
      data: mockComboData,
      isLoading: false,
      isError: false,
    })),
  };
});

vi.mock("@/features/setup/hooks/useSetup", () => ({
  useSetup: vi.fn(() => ({ data: null, isLoading: false, isError: false })),
}));
vi.mock("@/features/setup/hooks/useCreateSetup", () => ({
  useCreateSetup: vi.fn(() => ({ mutate: mockCreateMutate, isPending: false })),
}));
vi.mock("@/features/setup/hooks/useUpdateSetup", () => ({
  useUpdateSetup: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}));
vi.mock("@/features/setup/hooks/useRestoreSetup", () => ({
  useRestoreSetup: vi.fn(() => ({
    mutate: mockRestoreMutate,
    isPending: false,
  })),
}));

// ★入力の保持を観測するためのスタブ(§5.2-7)。
vi.mock("@/features/setup/components/SetupBasicInfoForm", () => ({
  SetupBasicInfoForm: ({
    name,
    onChange,
  }: {
    name: string | null;
    onChange: (c: { name?: string | null }) => void;
  }) => (
    <div>
      <span data-testid="setup-name">{name ?? ""}</span>
      <button
        type="button"
        data-testid="setup-type-name"
        onClick={() => onChange({ name: "利用者がじっくり書いた名前" })}
      >
        type name
      </button>
    </div>
  ),
}));
vi.mock("@/features/setup/components/SetupRecipeEditor", () => ({
  SetupRecipeEditor: () => null,
}));

function stubCheck(body: unknown, ok = true) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
    text: async () => JSON.stringify(body),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const NO_MATCH = { duplicates: [], deletedDuplicates: [] };
const ONE_DELETED = {
  duplicates: [],
  deletedDuplicates: [{ id: 22, name: "投げ後の重ね" }],
};

function renderCreatePage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/combos/5/setups/new"]}>
        {/* M24-04(CO-003): 編集面は useUnsavedChangesGuard を呼ぶため離脱ガードの
            provider が要る。★provider を外すとここが落ちる。 */}
        <NavigationGuardProvider>
          <Routes>
            <Route
              path="/combos/:comboId/setups/new"
              element={<SetupEditorPage />}
            />
          </Routes>
        </NavigationGuardProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** 保存できる最小状態を作って「保存」を押す。 */
function fillAndSave() {
  fireEvent.click(screen.getByTestId("setup-type-name"));
  fireEvent.click(screen.getByText("保存"));
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("M23-09 保存前の重複ダイアログ(セットプレイ)", () => {
  it("§5.2-1 削除済みの一致が在るとき、保存ボタン押下でダイアログが出る", async () => {
    stubCheck(ONE_DELETED);
    renderCreatePage();

    fillAndSave();

    expect(await screen.findByTestId("pre-save-duplicate-dialog")).toBeTruthy();
    expect(screen.getByTestId("pre-save-duplicate-single").textContent).toBe(
      "投げ後の重ね",
    );
    expect(mockCreateMutate).not.toHaveBeenCalled();
  });

  it("§5.2-2 生きた重複だけのときは、ダイアログが出ない", async () => {
    stubCheck({
      duplicates: [{ id: 11, name: "生きている重ね" }],
      deletedDuplicates: [],
    });
    renderCreatePage();

    fillAndSave();

    // ★生きた重複は VAL-S04 の 409 duplicate_setup で止まる。ダイアログは出さない。
    await waitFor(() => expect(mockCreateMutate).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId("pre-save-duplicate-dialog")).toBeNull();
  });

  it("§5.2-3 一致が無いときは、ダイアログが出ない(誤検知の防止)", async () => {
    stubCheck(NO_MATCH);
    renderCreatePage();

    fillAndSave();

    await waitFor(() => expect(mockCreateMutate).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId("pre-save-duplicate-dialog")).toBeNull();
  });

  it("★★§5.2-4 「復元する」を押す前に、入力内容が保存されないことが画面に書かれている", async () => {
    stubCheck(ONE_DELETED);
    renderCreatePage();

    fillAndSave();
    await screen.findByTestId("pre-save-duplicate-dialog");

    expect(
      screen.getByTestId("pre-save-duplicate-restore-caution").textContent,
    ).toBe(ja.trash.preSaveDuplicate.restoreCaution);
    expect(mockRestoreMutate).not.toHaveBeenCalled();
    const text =
      screen.getByTestId("pre-save-duplicate-dialog").textContent ?? "";
    expect(text).not.toContain("失敗");
    expect(text).not.toContain("エラー");
    expect(text).not.toContain("両方");
  });

  it("§5.2-5 「復元する」で復元 API が叩かれ、登録 API が叩かれない", async () => {
    stubCheck(ONE_DELETED);
    renderCreatePage();

    fillAndSave();
    await screen.findByTestId("pre-save-duplicate-dialog");
    fireEvent.click(screen.getByTestId("pre-save-duplicate-restore"));

    expect(mockRestoreMutate).toHaveBeenCalledTimes(1);
    expect(mockRestoreMutate.mock.calls[0][0]).toBe(22);
    expect(mockCreateMutate).not.toHaveBeenCalled();
  });

  it("§5.2-6 「新しく作る」で登録 API が叩かれ、復元 API が叩かれない", async () => {
    stubCheck(ONE_DELETED);
    renderCreatePage();

    fillAndSave();
    await screen.findByTestId("pre-save-duplicate-dialog");
    fireEvent.click(screen.getByTestId("pre-save-duplicate-create-new"));

    expect(mockCreateMutate).toHaveBeenCalledTimes(1);
    expect(mockRestoreMutate).not.toHaveBeenCalled();
  });

  it("§5.2-7 キャンセルで入力内容が失われない", async () => {
    stubCheck(ONE_DELETED);
    renderCreatePage();

    fillAndSave();
    await screen.findByTestId("pre-save-duplicate-dialog");
    fireEvent.click(screen.getByTestId("pre-save-duplicate-cancel"));

    await waitFor(() =>
      expect(screen.queryByTestId("pre-save-duplicate-dialog")).toBeNull(),
    );
    expect(screen.getByTestId("setup-name").textContent).toBe(
      "利用者がじっくり書いた名前",
    );
    expect(mockCreateMutate).not.toHaveBeenCalled();
  });

  it("§5.2-11 該当が複数のとき、どれを復元するか選べる(1 件目の決め打ちにしない)", async () => {
    stubCheck({
      duplicates: [],
      deletedDuplicates: [
        { id: 22, name: "投げ後の重ね" },
        { id: 23, name: "起き攻めシミー" },
      ],
    });
    renderCreatePage();

    fillAndSave();
    await screen.findByTestId("pre-save-duplicate-dialog");

    expect(
      screen.getByTestId("pre-save-duplicate-restore").hasAttribute("disabled"),
    ).toBe(true);
    fireEvent.click(screen.getByTestId("pre-save-duplicate-option-23"));
    fireEvent.click(screen.getByTestId("pre-save-duplicate-restore"));

    expect(mockRestoreMutate.mock.calls[0][0]).toBe(23);
  });

  it("★名前が空の行も選択肢に出る(落とすと復元できなくなる)", async () => {
    stubCheck({ duplicates: [], deletedDuplicates: [{ id: 22, name: null }] });
    renderCreatePage();

    fillAndSave();
    await screen.findByTestId("pre-save-duplicate-dialog");

    expect(screen.getByTestId("pre-save-duplicate-single").textContent).toBe(
      "セットプレイ 22",
    );
  });

  it("§5.2-12 ダイアログ表示中は保存ボタンを二重に押せない", async () => {
    stubCheck(ONE_DELETED);
    renderCreatePage();

    fillAndSave();
    await screen.findByTestId("pre-save-duplicate-dialog");

    const saveButton = screen.getByText("保存").closest("button");
    expect(saveButton?.hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByText("保存"));
    expect(mockCreateMutate).not.toHaveBeenCalled();
  });

  it("§5.2-10 保存前チェックが失敗しても保存が止まらない", async () => {
    stubCheck({ error: { code: "internal_error" } }, false);
    renderCreatePage();

    fillAndSave();

    await waitFor(() => expect(mockCreateMutate).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId("pre-save-duplicate-dialog")).toBeNull();
  });

  it("§4.2-1 入力中にはチェックを叩かない(押したときに 1 回だけ)", async () => {
    const fetchMock = stubCheck(NO_MATCH);
    renderCreatePage();

    fireEvent.click(screen.getByTestId("setup-type-name"));
    expect(
      fetchMock.mock.calls.filter((c) =>
        String(c[0]).includes("check-duplicate"),
      ).length,
    ).toBe(0);

    fireEvent.click(screen.getByText("保存"));
    await waitFor(() => expect(mockCreateMutate).toHaveBeenCalledTimes(1));
    expect(
      fetchMock.mock.calls.filter((c) =>
        String(c[0]).includes("check-duplicate"),
      ).length,
    ).toBe(1);
    // ★経路は親コンボ id を含む(VAL-S04 / VAL-S07 と同じ母集団を見る)。
    const call = fetchMock.mock.calls.find((c) =>
      String(c[0]).includes("check-duplicate"),
    );
    expect(String(call?.[0])).toBe("/api/combos/5/setups/check-duplicate");
  });

  it("★★復元応答の警告を捨てない(VAL-R04 等が静かに消えないこと)", async () => {
    stubCheck(ONE_DELETED);
    mockRestoreMutate.mockImplementation(
      (_id: number, opts: { onSuccess?: (d: unknown) => void }) => {
        opts.onSuccess?.({
          id: 22,
          warnings: [
            {
              code: "VAL-R04",
              severity: "warning",
              message: "サーバの診断文",
              details: { setups: [{ id: 11 }], totalCount: 1 },
            },
          ],
        });
      },
    );
    renderCreatePage();

    fillAndSave();
    await screen.findByTestId("pre-save-duplicate-dialog");
    fireEvent.click(screen.getByTestId("pre-save-duplicate-restore"));

    expect(mockToastWarning).toHaveBeenCalledTimes(1);
    expect(String(mockToastWarning.mock.calls[0][0])).toContain("既にこのコンボに紐付いています");
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it("★復元応答に警告が無ければ従来どおり完了トーストだけを出す", async () => {
    stubCheck(ONE_DELETED);
    mockRestoreMutate.mockImplementation(
      (_id: number, opts: { onSuccess?: (d: unknown) => void }) => {
        opts.onSuccess?.({ id: 22 });
      },
    );
    renderCreatePage();

    fillAndSave();
    await screen.findByTestId("pre-save-duplicate-dialog");
    fireEvent.click(screen.getByTestId("pre-save-duplicate-restore"));

    expect(mockToastSuccess).toHaveBeenCalledTimes(1);
    expect(mockToastWarning).not.toHaveBeenCalled();
  });

  it("★★復元に失敗してもダイアログを閉じない(導線が両方消えないこと)", async () => {
    stubCheck(ONE_DELETED);
    mockRestoreMutate.mockImplementation(
      (_id: number, opts: { onError?: () => void }) => {
        opts.onError?.();
      },
    );
    renderCreatePage();

    fillAndSave();
    await screen.findByTestId("pre-save-duplicate-dialog");
    fireEvent.click(screen.getByTestId("pre-save-duplicate-restore"));

    expect(screen.getByTestId("pre-save-duplicate-dialog")).toBeTruthy();
    expect(
      screen.getByTestId("pre-save-duplicate-restore-failed").textContent,
    ).toBe(ja.trash.preSaveDuplicate.restoreFailed);
    expect(screen.getByTestId("pre-save-duplicate-create-new")).toBeTruthy();
  });
});

describe("M23-09 保存後トーストの抑制(セットプレイ)", () => {
  const VAL_S07 = {
    code: "VAL-S07",
    severity: "warning" as const,
    message: "サーバの診断文",
    details: { setups: [{ id: 22 }], totalCount: 1 },
  };

  function succeedCreateWith(warnings: unknown[]) {
    mockCreateMutate.mockImplementation(
      (
        _vars: unknown,
        opts: { onSuccess?: (d: unknown) => void; onSettled?: () => void },
      ) => {
        opts.onSuccess?.({ id: 33, warnings });
        opts.onSettled?.();
      },
    );
  }

  it("★★§5.2-8 「新しく作る」を選んだ後、保存後トーストが出ない", async () => {
    stubCheck(ONE_DELETED);
    succeedCreateWith([VAL_S07]);
    renderCreatePage();

    fillAndSave();
    await screen.findByTestId("pre-save-duplicate-dialog");
    fireEvent.click(screen.getByTestId("pre-save-duplicate-create-new"));

    await waitFor(() => expect(mockCreateMutate).toHaveBeenCalledTimes(1));
    expect(mockToastWarning).not.toHaveBeenCalled();
  });

  it("★★§5.2-9 ダイアログを出さずに保存した場合は、保存後トーストが出る(抑制しすぎない)", async () => {
    stubCheck(NO_MATCH);
    succeedCreateWith([VAL_S07]);
    renderCreatePage();

    fillAndSave();

    await waitFor(() => expect(mockCreateMutate).toHaveBeenCalledTimes(1));
    expect(mockToastWarning).toHaveBeenCalledTimes(1);
    expect(String(mockToastWarning.mock.calls[0][0])).toContain("ゴミ箱");
  });

  it("★★抑制するのは VAL-C14 / VAL-S07 だけである(未知コードは出し続ける)", async () => {
    stubCheck(ONE_DELETED);
    succeedCreateWith([
      VAL_S07,
      {
        code: "VAL-FUTURE",
        severity: "warning" as const,
        message: "将来のコード",
        details: {},
      },
    ]);
    renderCreatePage();

    fillAndSave();
    await screen.findByTestId("pre-save-duplicate-dialog");
    fireEvent.click(screen.getByTestId("pre-save-duplicate-create-new"));

    await waitFor(() => expect(mockCreateMutate).toHaveBeenCalledTimes(1));
    expect(mockToastWarning).toHaveBeenCalledTimes(1);
    expect(String(mockToastWarning.mock.calls[0][0])).toContain("VAL-FUTURE");
  });
});

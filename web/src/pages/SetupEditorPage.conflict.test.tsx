import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import "@/lib/i18n";

import { SetupEditorPage } from "./SetupEditorPage";
import { ApiError } from "@/features/combo/api";
import { NavigationGuardProvider } from "@/features/navigation-guard/NavigationGuardProvider";

// M22-04: セットプレイ編集が競合で拒否されたときの見せ方(§4.1〜§4.3・§4.2-5)。
//
// ★既存の SetupEditorPage.test.tsx とは別ファイルにする。あちらは react-i18next を
//   「キーをそのまま返す」形でモックしており、文言そのものを主張できないため。
//   本ファイルは実物の i18n を読み込む。

const mockComboData = { id: 5, characterId: 1 };
const mockSetupData = {
  id: 3,
  characterId: 1,
  name: "既存セットプレイ",
  description: null,
  steps: [],
  version: 2,
  defaultRecipe: "",
  // ★「ほかの人の内容を見る」は親コンボの詳細画面を開く(§4.3-3)。
  parentComboIds: [5],
  stepCount: 0,
  createdAt: "",
  updatedAt: "",
};

const mockUpdateMutate = vi.fn();
const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: (...args: unknown[]) => mockToastSuccess(...args),
  },
}));

vi.mock("@/features/combo/api", async (importActual) => {
  // ApiError は classifySaveError の instanceof 判定に必要なため実体を温存する。
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
  useCreateSetup: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}));

vi.mock("@/features/setup/hooks/useUpdateSetup", () => ({
  useUpdateSetup: vi.fn(() => ({ mutate: mockUpdateMutate, isPending: false })),
}));

// ★入力の保持を観測するためのスタブ。
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

function renderEditPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/setups/3"]}>
        {/* M24-04(CO-003): 編集面は useUnsavedChangesGuard を呼ぶため離脱ガードの
            provider が要る。★provider を外すとここが落ちる。 */}
        <NavigationGuardProvider>
          <Routes>
            <Route path="/setups/:setupId" element={<SetupEditorPage />} />
          </Routes>
        </NavigationGuardProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => vi.clearAllMocks());

/** 利用者が入力し、保存を押し、サーバが err を返した状態まで進める。 */
async function saveAndFail(err: unknown) {
  fireEvent.click(screen.getByTestId("setup-type-name"));
  expect(screen.getByTestId("setup-name").textContent).toBe("利用者がじっくり書いた名前");

  mockUpdateMutate.mockImplementationOnce(
    (_vars: unknown, opts: { onError?: (e: unknown) => void }) => opts.onError?.(err),
  );
  fireEvent.click(screen.getByText("保存"));
  await waitFor(() => expect(mockUpdateMutate).toHaveBeenCalled());
}

const versionConflictError = () =>
  new ApiError(
    409,
    { error: { code: "version_conflict", message: "セットプレイが他で更新されています。最新版を取得してから再実行してください" } },
    "セットプレイが他で更新されています。最新版を取得してから再実行してください",
  );

const duplicateSetupError = () =>
  new ApiError(
    409,
    { error: { code: "duplicate_setup", message: "同一レシピのセットプレイが既にこのコンボに紐付いています" } },
    "同一レシピのセットプレイが既にこのコンボに紐付いています",
  );

describe("§5.1-1 ★版不一致で拒否されたとき、入力が保持されている(セットプレイ編集)", () => {
  it("利用者が打った名前がそのまま残る", async () => {
    renderEditPage();
    await saveAndFail(versionConflictError());
    expect(screen.getByTestId("setup-name").textContent).toBe("利用者がじっくり書いた名前");
  });

  it("初期値へ戻らない", async () => {
    renderEditPage();
    await saveAndFail(versionConflictError());
    expect(screen.getByTestId("setup-name").textContent).not.toBe("既存セットプレイ");
  });
});

describe("§5.1-3 ★「保存しました」が出ない", () => {
  it("成功トーストを出さない", async () => {
    renderEditPage();
    await saveAndFail(versionConflictError());
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });
});

describe("§5.1-7 拒否されたあとの導線(セットプレイ)", () => {
  it("セットプレイ向けの文言でモーダルが出る", async () => {
    renderEditPage();
    await saveAndFail(versionConflictError());
    expect(await screen.findByTestId("conflict-dialog")).toBeTruthy();
    expect(screen.getByText("ほかの人がこのセットプレイを変更しました")).toBeTruthy();
  });

  it("相手の内容を見る導線が親コンボの詳細画面へ別枠で開く", async () => {
    renderEditPage();
    await saveAndFail(versionConflictError());
    const link = await screen.findByTestId("conflict-dialog-view-theirs");
    expect(link.getAttribute("href")).toBe("/combos/5");
    expect(link.getAttribute("target")).toBe("_blank");
  });

  it("読み込み直すには確認が挟まる", async () => {
    renderEditPage();
    await saveAndFail(versionConflictError());
    fireEvent.click(await screen.findByTestId("conflict-dialog-reload"));
    expect(screen.getByTestId("conflict-dialog-reload-confirm")).toBeTruthy();
  });
});

// ★★§5.1-12 / §4.2-5。本サブが直した既存欠陥の網である。
//
// 着手前は features/setup/errors.ts が status === 409 だけで判定しており、
// 同一レシピ重複が「他のタブで更新されています。ページを再読み込みして
// やり直してください。」と版不一致の文言で表示されていた。
//
// ★破壊確認 B の的: 判定をステータス 409 だけへ戻すと本ブロックが赤くなる。
describe("§5.1-12 ★duplicate_setup が版不一致の文言で表示されない", () => {
  it("「ほかの人が変更しました」と出ない", async () => {
    renderEditPage();
    await saveAndFail(duplicateSetupError());
    expect(screen.queryByText("ほかの人がこのセットプレイを変更しました")).toBeNull();
    expect(screen.queryByTestId("conflict-dialog")).toBeNull();
  });

  it("「同じ手順のセットプレイが既に登録されている」旨が出る", async () => {
    renderEditPage();
    await saveAndFail(duplicateSetupError());
    const banner = await screen.findByTestId("setup-editor-duplicate-setup");
    expect(banner.textContent).toContain("同じ手順のセットプレイ");
    expect(banner.textContent).toContain("すでに登録されています");
  });

  it("入力は版不一致のときと同じく保持される", async () => {
    renderEditPage();
    await saveAndFail(duplicateSetupError());
    expect(screen.getByTestId("setup-name").textContent).toBe("利用者がじっくり書いた名前");
  });
});

describe("§5.1-9 ★非回帰: 版が一致するときは、いままでどおり保存できる", () => {
  it("成功時に競合モーダルも重複バナーも出ない", async () => {
    renderEditPage();
    mockUpdateMutate.mockImplementationOnce(
      (_vars: unknown, opts: { onSuccess?: () => void }) => opts.onSuccess?.(),
    );
    fireEvent.click(screen.getByText("保存"));
    await waitFor(() => expect(mockUpdateMutate).toHaveBeenCalled());
    expect(screen.queryByTestId("conflict-dialog")).toBeNull();
    expect(screen.queryByTestId("setup-editor-duplicate-setup")).toBeNull();
  });
});

// ★★セットプレイにはキー変更編集(PUT)が無い(routes.go は PATCH /setups/:id のみ)。
//   ⇒ この画面の 404 は「親コンボが見つからない」(POST /combos/:comboId/setups)か
//     「本当に削除された」かのどちらかであり、「作り直された」は構造的に起こらない。
//   ⇒ 競合モーダルへ寄せると、まだ 1 件も作られていないセットプレイについて
//     「作り直したか、削除した」と述べる形になる。寄せないことを固定する。
describe("★404 を競合モーダルへ寄せない(セットプレイにキー変更編集は無い)", () => {
  const notFoundError = () =>
    new ApiError(
      404,
      { error: { code: "not_found", message: "セットプレイが見つかりません" } },
      "セットプレイが見つかりません",
    );

  it("競合モーダルを出さない", async () => {
    renderEditPage();
    await saveAndFail(notFoundError());
    expect(screen.queryByTestId("conflict-dialog")).toBeNull();
  });

  it("★「作り直した」と述べない", async () => {
    renderEditPage();
    await saveAndFail(notFoundError());
    expect(screen.queryByText(/作り直した/)).toBeNull();
  });

  it("従来どおりサーバのメッセージを出す(黙って失敗しない)", async () => {
    renderEditPage();
    await saveAndFail(notFoundError());
    expect(await screen.findByText("セットプレイが見つかりません")).toBeTruthy();
  });

  it("★入力は消えない", async () => {
    renderEditPage();
    await saveAndFail(notFoundError());
    expect(screen.getByTestId("setup-name").textContent).toBe("利用者がじっくり書いた名前");
  });
});

describe("★エラーコードで分岐している(ステータスで分岐していない)", () => {
  it("5xx で競合モーダルを出さない", async () => {
    renderEditPage();
    await saveAndFail(
      new ApiError(500, { error: { code: "internal_error", message: "サーバーエラー" } }, "サーバーエラー"),
    );
    expect(screen.queryByTestId("conflict-dialog")).toBeNull();
    expect(screen.queryByTestId("setup-editor-duplicate-setup")).toBeNull();
  });
});

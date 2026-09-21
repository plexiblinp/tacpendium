import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import "@/lib/i18n";

import ja from "@/locales/ja.json";

import { ComboEditor } from "./ComboEditor";
import { NavigationGuardProvider } from "@/features/navigation-guard/NavigationGuardProvider";

// M23-09 §5.2: 保存前の重複ダイアログ(コンボ登録)。
//
// ★★本ファイルは既存の ComboEditor.test.tsx とは別に置く。あちらは 1000 行あり、
//   本サブの最重要ゲート(「復元を押す前に入力が失われることが伝わる」)を埋没させたくない。
//
// ★★i18n は実 ja.json を引く(@/lib/i18n を読み込む)。キーをそのまま返すモックでは
//   §5.2-4 の主張が空振りする——文面そのものを見たいのであって、キーの存在ではない
//   (M23-04 教訓 2)。
//
// ★★本サブの誤りは「出ること」より「出すぎること」「抑制しすぎること」で起きる。
//   ⇒ 非発火の対照(生きた重複だけ / 一致なし / チェック失敗)と、
//     抑制しすぎの対照(§5.2-9・未知コード)を必ず置く。

const mockNavigate = vi.fn();
const mockCreateMutate = vi.fn();
const mockRestoreMutate = vi.fn();
const mockToastWarning = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ state: null }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: (...a: unknown[]) => mockToastError(...a),
    success: (...a: unknown[]) => mockToastSuccess(...a),
    warning: (...a: unknown[]) => mockToastWarning(...a),
  },
}));

vi.mock("@/features/moves/api", () => ({
  useMovesByCharacter: () => ({ data: [], isLoading: false }),
}));
vi.mock("@/features/punish/api", () => ({
  useAddPunish: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/features/character/hooks/useCharacters", () => ({
  useCharacters: () => ({
    data: [{ id: 1, gameId: 1, code: "ryu", customStates: null }],
  }),
  DEFAULT_GAME_ID: 1,
}));

const { MockApiError } = vi.hoisted(() => {
  class MockApiError extends Error {
    status = 0;
    body = null;
    get validations() {
      return undefined;
    }
  }
  return { MockApiError };
});

vi.mock("../api", () => ({
  ApiError: MockApiError,
  useCreateCombo: () => ({ mutate: mockCreateMutate, isPending: false }),
  useUpdateComboMetadata: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateComboWithKeyChange: () => ({ mutate: vi.fn(), isPending: false }),
}));

// ★入力中のリアルタイム警告(表示専用)は本サブでは触っていない。
vi.mock("../hooks/useCheckDuplicate", () => ({
  useCheckDuplicate: () => ({ duplicates: [] }),
}));

vi.mock("../hooks/useRestoreCombo", () => ({
  useRestoreCombo: () => ({ mutate: mockRestoreMutate, isPending: false }),
}));

vi.mock("@/features/setup/hooks/useSetupLinks", () => ({
  useCreateSetupLink: () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));
vi.mock("@/features/setup/hooks/useCharacterSetups", () => ({
  useCharacterSetups: () => ({ data: [], isLoading: false }),
}));
vi.mock("@/features/setup/components/SetupRecipeEditor", () => ({
  SetupRecipeEditor: () => null,
}));

vi.mock("./RecipeBuilder", () => ({
  RecipeBuilder: ({
    steps,
    onChange,
  }: {
    steps: unknown[];
    onChange: (n: unknown[]) => void;
  }) => (
    <div>
      <button
        type="button"
        data-testid="recipe-add-step"
        onClick={() =>
          onChange([...steps, { stepOrder: steps.length + 1, moveId: 7 }])
        }
      >
        add step
      </button>
    </div>
  ),
}));
vi.mock("./ComboEditorCharacterField", () => ({
  ComboEditorCharacterField: () => null,
}));
vi.mock("./CharacterChangeConfirmDialog", () => ({
  CharacterChangeConfirmDialog: () => null,
}));
vi.mock("./SetupRegistrationSection", () => ({
  SetupRegistrationSection: () => null,
}));
vi.mock("./DuplicateRealtimeWarning", () => ({
  DuplicateRealtimeWarning: () => null,
}));
vi.mock("./DuplicateWarning", () => ({ DuplicateWarning: () => null }));
vi.mock("./ValidationDisplay", () => ({ ValidationDisplay: () => null }));
vi.mock("./PromoteToFinalButton", () => ({ PromoteToFinalButton: () => null }));
vi.mock("./KnockdownAdvantageChangeModal", () => ({
  KnockdownAdvantageChangeModal: () => null,
}));
vi.mock("./PutConfirmDialog", () => ({ PutConfirmDialog: () => null }));
vi.mock("./ComboDraftToggleField", () => ({
  ComboDraftToggleField: () => null,
}));

// ★入力の保持を観測するためのスタブ。打った memo が残るかを見る(§5.2-7)。
// ★あわせて保存前チェックが走る最小条件(状況 4 項)を埋める操作を持つ。
vi.mock("./ComboEditorBasicFields", () => ({
  ComboEditorBasicFields: ({
    value,
    onChange,
  }: {
    value: { memo: string; [k: string]: unknown };
    onChange: (next: unknown) => void;
  }) => (
    <div>
      <span data-testid="basic-memo">{String(value.memo ?? "")}</span>
      <button
        type="button"
        data-testid="basic-fill-situation"
        onClick={() =>
          onChange({
            ...value,
            position: "mid_screen",
            opponentStance: "standing",
            hitType: "normal",
            opponentSize: "standard",
            // ★M27-02b(P4M-009): 本登録の必須欄。**「保存できる最小状態」に含まれる**
            //   ——無いと zod で止まり、本ファイルが見ている保存前ダイアログまで進まない。
            // ★★★M38-01 追補2: 必須は damage / knockdownAdvantage の **2 欄だけ**。
            //   ★開始残量 2 欄は**任意**になったが、ここでは値を入れたまま残す ——
            //     本ファイルが見ているのは重複判定であり、埋まった状態を保つほうが素直である。
            damage: "1500",
            knockdownAdvantage: "30",
            driveAvailableAtStart: "3",
            saAvailableAtStart: "1",
            memo: "利用者がじっくり書いた内容",
          })
        }
      >
        fill
      </button>
      {/* ★★M27-02b: 必須欄だけを埋めるボタン。
          ★状況 4 項は埋めない——「状況が空でも保存前チェックを叩く」ケースが
            見ているのは状況の空であり、必須欄の空ではない。
          ★★★M38-01 追補2: **必須は damage / knockdownAdvantage の 2 欄だけ**である。
            ★以下は二重に失効した記述 ——(1)「消費ゲージ 2 欄は新規登録の既定で "0" が
              入っているため触らない」(2)「代わりに開始残量 2 欄が必須になった」。
            ⇒ 開始残量 2 欄は**空のまま保存できる**(空欄＝NULL＝「不問」)。
              ★★ここで空のまま残すこと自体が、必須から外れたことの破壊確認である。 */}
      <button
        type="button"
        data-testid="basic-fill-required"
        onClick={() =>
          onChange({
            ...value,
            damage: "1500",
            knockdownAdvantage: "30",
          })
        }
      >
        fill-required
      </button>
      <button
        type="button"
        data-testid="basic-set-draft"
        onClick={() => onChange({ ...value, isDraft: true })}
      >
        draft
      </button>
    </div>
  ),
}));

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // M24-04(CO-003): ComboEditor は useUnsavedChangesGuard を呼ぶため、離脱ガードの
  // provider が要る。★provider を外すとここが落ちる——ガードが黙って消えないようにしてある。
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(
      QueryClientProvider,
      { client: qc },
      React.createElement(NavigationGuardProvider, null, children),
    );
}

// stubCheck は保存前チェックの応答を差し替える。
// ★ここは fetch の stub である。⇒ サーバ側 SQL の誤りは本ファイルでは原理的に
//   検出できない(破壊確認 1 の期待とのずれ。完了報告 §7 に明記)。
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
  deletedDuplicates: [{ id: 91, memo: "画面端 中央運び" }],
};

/** 保存できる最小状態を作って「保存」を押す。 */
function fillAndSave() {
  fireEvent.click(screen.getByTestId("basic-fill-situation"));
  fireEvent.click(screen.getByTestId("recipe-add-step"));
  fireEvent.click(screen.getByText("保存"));
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("M23-09 保存前の重複ダイアログ(コンボ)", () => {
  it("§5.2-1 削除済みの一致が在るとき、保存ボタン押下でダイアログが出る", async () => {
    stubCheck(ONE_DELETED);
    render(<ComboEditor mode="new" />, { wrapper: createWrapper() });

    fillAndSave();

    expect(await screen.findByTestId("pre-save-duplicate-dialog")).toBeTruthy();
    // ★どれが該当したのかが人が読める形で見える(§4.1-3)。id だけではない。
    expect(screen.getByTestId("pre-save-duplicate-single").textContent).toBe(
      "画面端 中央運び",
    );
    // ★ダイアログを出した時点では登録 API を叩いていない。
    expect(mockCreateMutate).not.toHaveBeenCalled();
  });

  it("§5.2-2 生きた重複だけのときは、ダイアログが出ない", async () => {
    stubCheck({
      duplicates: [{ id: 17, memo: "生きているほう" }],
      deletedDuplicates: [],
    });
    render(<ComboEditor mode="new" />, { wrapper: createWrapper() });

    fillAndSave();

    // ★生きた重複は既に VAL-C02 が ERROR で止めている。そのまま保存へ進む。
    await waitFor(() => expect(mockCreateMutate).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId("pre-save-duplicate-dialog")).toBeNull();
  });

  it("§5.2-3 一致が無いときは、ダイアログが出ない(誤検知の防止)", async () => {
    stubCheck(NO_MATCH);
    render(<ComboEditor mode="new" />, { wrapper: createWrapper() });

    fillAndSave();

    await waitFor(() => expect(mockCreateMutate).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId("pre-save-duplicate-dialog")).toBeNull();
  });

  it("★★§5.2-4 「復元する」を押す前に、入力内容が保存されないことが画面に書かれている", async () => {
    stubCheck(ONE_DELETED);
    render(<ComboEditor mode="new" />, { wrapper: createWrapper() });

    fillAndSave();
    await screen.findByTestId("pre-save-duplicate-dialog");

    // ★実 ja.json の文面そのものを主張する。キー返しモックではここが空振りする。
    expect(
      screen.getByTestId("pre-save-duplicate-restore-caution").textContent,
    ).toBe(ja.trash.preSaveDuplicate.restoreCaution);
    // ★まだ何も押していない。押した後の通知ではないことの担保。
    expect(mockRestoreMutate).not.toHaveBeenCalled();
    // ★「失敗」「エラー」と読める形になっていない(DES-006 §11.2 の 4 点目)。
    const text =
      screen.getByTestId("pre-save-duplicate-dialog").textContent ?? "";
    expect(text).not.toContain("失敗");
    expect(text).not.toContain("エラー");
    // ★「両方入れる」は出さない(§1.4-1・D-518)。
    expect(text).not.toContain("両方");
  });

  it("§5.2-5 「復元する」で復元 API が叩かれ、登録 API が叩かれない", async () => {
    stubCheck(ONE_DELETED);
    render(<ComboEditor mode="new" />, { wrapper: createWrapper() });

    fillAndSave();
    await screen.findByTestId("pre-save-duplicate-dialog");
    fireEvent.click(screen.getByTestId("pre-save-duplicate-restore"));

    expect(mockRestoreMutate).toHaveBeenCalledTimes(1);
    expect(mockRestoreMutate.mock.calls[0][0]).toBe(91);
    expect(mockCreateMutate).not.toHaveBeenCalled();
  });

  it("§5.2-6 「新しく作る」で登録 API が叩かれ、復元 API が叩かれない", async () => {
    stubCheck(ONE_DELETED);
    render(<ComboEditor mode="new" />, { wrapper: createWrapper() });

    fillAndSave();
    await screen.findByTestId("pre-save-duplicate-dialog");
    fireEvent.click(screen.getByTestId("pre-save-duplicate-create-new"));

    expect(mockCreateMutate).toHaveBeenCalledTimes(1);
    expect(mockRestoreMutate).not.toHaveBeenCalled();
  });

  it("§5.2-7 キャンセルで入力内容が失われない", async () => {
    stubCheck(ONE_DELETED);
    render(<ComboEditor mode="new" />, { wrapper: createWrapper() });

    fillAndSave();
    await screen.findByTestId("pre-save-duplicate-dialog");
    fireEvent.click(screen.getByTestId("pre-save-duplicate-cancel"));

    await waitFor(() =>
      expect(screen.queryByTestId("pre-save-duplicate-dialog")).toBeNull(),
    );
    // ★打った文字がそのまま残っていること。ダイアログは state に触らない。
    expect(screen.getByTestId("basic-memo").textContent).toBe(
      "利用者がじっくり書いた内容",
    );
    expect(mockCreateMutate).not.toHaveBeenCalled();
    expect(mockRestoreMutate).not.toHaveBeenCalled();
  });

  it("§5.2-11 該当が複数のとき、どれを復元するか選べる(1 件目の決め打ちにしない)", async () => {
    stubCheck({
      duplicates: [],
      deletedDuplicates: [
        { id: 91, memo: "画面端 中央運び" },
        { id: 92, memo: "中央 スタン狙い" },
      ],
    });
    render(<ComboEditor mode="new" />, { wrapper: createWrapper() });

    fillAndSave();
    await screen.findByTestId("pre-save-duplicate-dialog");

    // ★既定選択が無いので、選ぶまで復元は押せない。
    expect(
      screen.getByTestId("pre-save-duplicate-restore").hasAttribute("disabled"),
    ).toBe(true);

    fireEvent.click(screen.getByTestId("pre-save-duplicate-option-92"));
    fireEvent.click(screen.getByTestId("pre-save-duplicate-restore"));

    expect(mockRestoreMutate).toHaveBeenCalledTimes(1);
    expect(mockRestoreMutate.mock.calls[0][0]).toBe(92);
  });

  it("★名前(memo)が空の行も選択肢に出る(落とすと復元できなくなる)", async () => {
    stubCheck({ duplicates: [], deletedDuplicates: [{ id: 91, memo: "" }] });
    render(<ComboEditor mode="new" />, { wrapper: createWrapper() });

    fillAndSave();
    await screen.findByTestId("pre-save-duplicate-dialog");

    expect(screen.getByTestId("pre-save-duplicate-single").textContent).toBe(
      "コンボ 91",
    );
  });

  it("§5.2-12 ダイアログ表示中は保存ボタンを二重に押せない", async () => {
    stubCheck(ONE_DELETED);
    render(<ComboEditor mode="new" />, { wrapper: createWrapper() });

    fillAndSave();
    await screen.findByTestId("pre-save-duplicate-dialog");

    const saveButton = screen.getByText("保存").closest("button");
    expect(saveButton?.hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByText("保存"));
    expect(mockCreateMutate).not.toHaveBeenCalled();

    // ★★ラベルは「保存中...」にしない。ダイアログを開いて選択を待っている間、
    //   押せはしないが**何も保存していない**。「押せない条件」と「保存中の表示」を
    //   分けること——本サブは「文面が実装のしないことを言っていないか」を主題に置いた
    //   サブであり、この 1 語もその規律にそのまま当たる。
    expect(screen.queryByText("保存中...")).toBeNull();
  });

  it("§5.2-10 保存前チェックが失敗しても保存が止まらない", async () => {
    stubCheck({ error: { code: "internal_error" } }, false);
    render(<ComboEditor mode="new" />, { wrapper: createWrapper() });

    fillAndSave();

    await waitFor(() => expect(mockCreateMutate).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId("pre-save-duplicate-dialog")).toBeNull();
  });

  it("★★状況が空でもチェックを叩く(VAL-C14 は NULL 同士を一致とみなすため)", async () => {
    // ★リアルタイム検知の門(isFormReadyForDuplicateCheck)を保存時の条件に流用しない。
    //   流用すると、状況を空のまま保存したときダイアログが出ないのに VAL-C14 だけが
    //   保存後に出る——保存前と保存後で見えるものがずれる。
    const fetchMock = stubCheck(ONE_DELETED);
    render(<ComboEditor mode="new" />, { wrapper: createWrapper() });

    // ★状況 4 項を埋めずにレシピだけ入れて保存する。
    // ★M27-02b: 必須欄は埋める(状況の空とは別の話であり、混ぜると
    //   本ケースが「必須欄が空だから止まった」のか判別できなくなる)。
    fireEvent.click(screen.getByTestId("recipe-add-step"));
    fireEvent.click(screen.getByTestId("basic-fill-required"));
    fireEvent.click(screen.getByText("保存"));

    expect(await screen.findByTestId("pre-save-duplicate-dialog")).toBeTruthy();
    const call = fetchMock.mock.calls.find((c) => String(c[0]).includes("check-duplicate"));
    expect(JSON.parse(String((call?.[1] as RequestInit).body)).position).toBeNull();
  });

  it("§4.2-1 入力中にはチェックを叩かない(押したときに 1 回だけ)", async () => {
    const fetchMock = stubCheck(NO_MATCH);
    render(<ComboEditor mode="new" />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByTestId("basic-fill-situation"));
    fireEvent.click(screen.getByTestId("recipe-add-step"));
    // ★まだ押していない。
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
  });

  it("★★復元応答の警告を捨てない(VAL-R03 等が静かに消えないこと)", async () => {
    // ★既存の復元導線 4 か所はすべて formatRestoreWarnings を通す。本サブが足した
    //   経路だけが握り潰すと、このダイアログから復元した利用者にだけ警告が届かない。
    // ★★このダイアログ経路では VAL-R03 が実際に起きうる——生きた重複が在るまま
    //   復元すれば必ず発火する。
    stubCheck(ONE_DELETED);
    mockRestoreMutate.mockImplementation(
      (_id: number, opts: { onSuccess?: (d: unknown) => void }) => {
        opts.onSuccess?.({
          id: 91,
          warnings: [
            {
              code: "VAL-R03",
              severity: "warning",
              message: "サーバの診断文",
              details: { combos: [{ id: 17 }], totalCount: 1 },
            },
          ],
        });
      },
    );
    render(<ComboEditor mode="new" />, { wrapper: createWrapper() });

    fillAndSave();
    await screen.findByTestId("pre-save-duplicate-dialog");
    fireEvent.click(screen.getByTestId("pre-save-duplicate-restore"));

    expect(mockToastWarning).toHaveBeenCalledTimes(1);
    // ★実 ja.json の復元側の文面が出ること(登録側の文面ではない)。
    expect(String(mockToastWarning.mock.calls[0][0])).toContain("既に登録されています");
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it("★復元応答に警告が無ければ従来どおり完了トーストだけを出す", async () => {
    stubCheck(ONE_DELETED);
    mockRestoreMutate.mockImplementation(
      (_id: number, opts: { onSuccess?: (d: unknown) => void }) => {
        opts.onSuccess?.({ id: 91 });
      },
    );
    render(<ComboEditor mode="new" />, { wrapper: createWrapper() });

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
    render(<ComboEditor mode="new" />, { wrapper: createWrapper() });

    fillAndSave();
    await screen.findByTestId("pre-save-duplicate-dialog");
    fireEvent.click(screen.getByTestId("pre-save-duplicate-restore"));

    // ★開いたままであり、「新しく作る」も「戻って編集を続ける」もまだ押せる。
    expect(screen.getByTestId("pre-save-duplicate-dialog")).toBeTruthy();
    expect(
      screen.getByTestId("pre-save-duplicate-restore-failed").textContent,
    ).toBe(ja.trash.preSaveDuplicate.restoreFailed);
    expect(screen.getByTestId("pre-save-duplicate-create-new")).toBeTruthy();
  });
});

describe("M23-09 保存後トーストの抑制(コンボ)", () => {
  const VAL_C14 = {
    code: "VAL-C14",
    severity: "warning" as const,
    message: "サーバの診断文",
    details: { combos: [{ id: 91 }], totalCount: 1 },
  };

  function succeedCreateWith(warnings: unknown[]) {
    mockCreateMutate.mockImplementation(
      (
        _payload: unknown,
        opts: { onSuccess?: (d: unknown) => void; onSettled?: () => void },
      ) => {
        opts.onSuccess?.({ id: 123, characterId: 1, warnings });
        opts.onSettled?.();
      },
    );
  }

  it("★★§5.2-8 「新しく作る」を選んだ後、保存後トーストが出ない", async () => {
    stubCheck(ONE_DELETED);
    succeedCreateWith([VAL_C14]);
    render(<ComboEditor mode="new" />, { wrapper: createWrapper() });

    fillAndSave();
    await screen.findByTestId("pre-save-duplicate-dialog");
    fireEvent.click(screen.getByTestId("pre-save-duplicate-create-new"));

    await waitFor(() => expect(mockCreateMutate).toHaveBeenCalledTimes(1));
    expect(mockToastWarning).not.toHaveBeenCalled();
  });

  it("★★§5.2-9 ダイアログを出さずに保存した場合は、保存後トーストが出る(抑制しすぎない)", async () => {
    stubCheck(NO_MATCH);
    succeedCreateWith([VAL_C14]);
    render(<ComboEditor mode="new" />, { wrapper: createWrapper() });

    fillAndSave();

    await waitFor(() => expect(mockCreateMutate).toHaveBeenCalledTimes(1));
    expect(mockToastWarning).toHaveBeenCalledTimes(1);
    expect(String(mockToastWarning.mock.calls[0][0])).toContain("ゴミ箱");
  });

  it("★チェックが失敗して保存したときも、保存後トーストが出る(抑制しない)", async () => {
    stubCheck({ error: { code: "internal_error" } }, false);
    succeedCreateWith([VAL_C14]);
    render(<ComboEditor mode="new" />, { wrapper: createWrapper() });

    fillAndSave();

    await waitFor(() => expect(mockCreateMutate).toHaveBeenCalledTimes(1));
    expect(mockToastWarning).toHaveBeenCalledTimes(1);
  });

  it("★★抑制するのは VAL-C14 / VAL-S07 だけである(未知コードは出し続ける)", async () => {
    stubCheck(ONE_DELETED);
    succeedCreateWith([
      VAL_C14,
      {
        code: "VAL-FUTURE",
        severity: "warning" as const,
        message: "将来のコード",
        details: {},
      },
    ]);
    render(<ComboEditor mode="new" />, { wrapper: createWrapper() });

    fillAndSave();
    await screen.findByTestId("pre-save-duplicate-dialog");
    fireEvent.click(screen.getByTestId("pre-save-duplicate-create-new"));

    await waitFor(() => expect(mockCreateMutate).toHaveBeenCalledTimes(1));
    // ★warnings を丸ごと捨てていたら 0 回になる。未知コードは出さなければならない。
    expect(mockToastWarning).toHaveBeenCalledTimes(1);
    expect(String(mockToastWarning.mock.calls[0][0])).toContain("VAL-FUTURE");
  });

  it("★抑制は 1 回きりである(次の保存では再びトーストが出る)", async () => {
    stubCheck(ONE_DELETED);
    succeedCreateWith([VAL_C14]);
    render(<ComboEditor mode="new" />, { wrapper: createWrapper() });

    fillAndSave();
    await screen.findByTestId("pre-save-duplicate-dialog");
    fireEvent.click(screen.getByTestId("pre-save-duplicate-create-new"));
    await waitFor(() => expect(mockCreateMutate).toHaveBeenCalledTimes(1));
    expect(mockToastWarning).not.toHaveBeenCalled();

    // 2 回目はチェックが一致なしを返す ⇒ ダイアログを出さない ⇒ トーストが出る。
    stubCheck(NO_MATCH);
    fireEvent.click(screen.getByText("保存"));
    await waitFor(() => expect(mockCreateMutate).toHaveBeenCalledTimes(2));
    expect(mockToastWarning).toHaveBeenCalledTimes(1);
  });
});

describe("M23-09 仮登録では保存前チェックを走らせない", () => {
  it("★仮登録では check-duplicate を叩かない(VAL-C14 が仮登録では判定されないため)", async () => {
    const fetchMock = stubCheck(ONE_DELETED);
    render(<ComboEditor mode="new" />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByTestId("basic-fill-situation"));
    fireEvent.click(screen.getByTestId("basic-set-draft"));
    fireEvent.click(screen.getByTestId("recipe-add-step"));
    fireEvent.click(screen.getByText("保存"));

    await waitFor(() => expect(mockCreateMutate).toHaveBeenCalledTimes(1));
    expect(
      fetchMock.mock.calls.filter((c) =>
        String(c[0]).includes("check-duplicate"),
      ).length,
    ).toBe(0);
    expect(screen.queryByTestId("pre-save-duplicate-dialog")).toBeNull();
  });
});

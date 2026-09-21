import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import "@/lib/i18n";

import { ComboEditor } from "./ComboEditor";
import type { ComboDetail } from "../types";
import { NavigationGuardProvider } from "@/features/navigation-guard/NavigationGuardProvider";

// ★★M24-04(CO-003): 保存後の遷移は離脱ガードの補正を通る。
//   ガードが履歴へ積んだ「番人」のエントリを遷移先で置き換えるため、
//   `navigate(dest, { replace: true })` の形で呼ばれる（番人が無ければ `navigate(dest)`）。
//   ★★遷移先そのものが契約であり（M24-01 / CHANGE-130）、第 2 引数は契約ではない。
//     ⇒ 遷移先だけを見る形にしてある。引数の形で固定すると、
//       履歴の補正を直すたびに遷移先の契約テストが巻き添えで落ちる。
function expectNavigatedTo(spy: { mock: { calls: unknown[][] } }, dest: unknown) {
  expect(spy.mock.calls.map((c) => c[0])).toContain(dest);
}

// M22-04: コンボ編集が競合で拒否されたときの見せ方(§4.1〜§4.3)。
//
// ★本ファイルは既存の ComboEditor.test.tsx とは別に置く。あちらは 1000 行あり、
//   本サブの主張(入力が消えないこと)を埋没させたくないため。
//
// ★★最重要ゲート 1 は「破っても画面上は正常に見える」型である。消えたことに
//   気づくのは利用者だけであり、テストと破壊確認 A だけが判定材料になる。

const mockNavigate = vi.fn();
const mockPatchMutate = vi.fn();
const mockCreateMutate = vi.fn();
const mockPutMutate = vi.fn();
const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastWarning = vi.fn();

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ state: null }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: (...args: unknown[]) => mockToastSuccess(...args),
    warning: (...args: unknown[]) => mockToastWarning(...args),
  },
}));

vi.mock("@/features/moves/api", () => ({
  useMovesByCharacter: () => ({ data: [], isLoading: false }),
}));

vi.mock("@/features/punish/api", () => ({
  useAddPunish: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/features/character/hooks/useCharacters", () => ({
  useCharacters: () => ({ data: [{ id: 1, gameId: 1, code: "ryu", customStates: null }] }),
  DEFAULT_GAME_ID: 1,
}));

// ★ApiError は本物と同じ形にする(status / body / validations ゲッタ)。
//   classifySaveError が body.error.code を読むため、body を持たないスタブでは
//   分類が常に "other" になり、本ファイルの主張が空振りする。
//
// ★vi.hoisted で包む理由: vi.mock は巻き上げられるため、通常の class 宣言を
//   ファクトリから参照すると「初期化前アクセス」で落ちる。
const { MockApiError } = vi.hoisted(() => {
  interface ErrBody {
    error: { code: string; message?: string; details?: { validations?: unknown } };
  }
  class MockApiError extends Error {
    status: number;
    body: ErrBody | null;
    constructor(status: number, body: ErrBody | null, message: string) {
      super(message);
      this.status = status;
      this.body = body;
    }
    get validations() {
      return this.body?.error?.details?.validations;
    }
  }
  return { MockApiError };
});

vi.mock("../api", () => ({
  ApiError: MockApiError,
  useCreateCombo: () => ({ mutate: mockCreateMutate, isPending: false }),
  useUpdateComboMetadata: () => ({ mutate: mockPatchMutate, isPending: false }),
  useUpdateComboWithKeyChange: () => ({ mutate: mockPutMutate, isPending: false }),
}));

vi.mock("../hooks/useCheckDuplicate", () => ({
  useCheckDuplicate: () => ({ duplicates: [] }),
}));

vi.mock("@/features/setup/hooks/useSetupLinks", () => ({
  useCreateSetupLink: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("./RecipeBuilder", () => ({
  RecipeBuilder: ({
    steps,
    onChange,
  }: {
    steps: unknown[];
    onChange: (next: unknown[]) => void;
  }) => (
    <div data-testid="recipe-builder">
      <span data-testid="recipe-steps-count">{steps.length}</span>
      <button
        type="button"
        data-testid="recipe-add-step"
        onClick={() => onChange([...steps, { stepOrder: steps.length + 1, moveId: 7 }])}
      >
        add step
      </button>
    </div>
  ),
}));

vi.mock("./ComboEditorCharacterField", () => ({
  ComboEditorCharacterField: () => <div data-testid="character-field" />,
}));

vi.mock("./CharacterChangeConfirmDialog", () => ({
  CharacterChangeConfirmDialog: () => null,
}));

// ★入力の保持を観測するためのスタブ。memo に打った文字がそのまま残るかを見る。
vi.mock("./ComboEditorBasicFields", () => ({
  ComboEditorBasicFields: ({
    value,
    onChange,
  }: {
    value: { memo: string; [k: string]: unknown };
    onChange: (next: unknown) => void;
  }) => (
    <div data-testid="basic-fields">
      <span data-testid="basic-memo">{String(value.memo ?? "")}</span>
      <span data-testid="basic-damage">{String(value.damage ?? "")}</span>
      {/* ★キー項目(ステップ・始動技・状況)は触らない。触ると hasKeyChanges が真になり
          PUT 経路(再登録の確認ダイアログ)へ分岐して PATCH の検証にならない。
          ⇒ リセットの検出はキー項目でない memo / damage の 2 本で行う。 */}
      <button
        type="button"
        data-testid="basic-type-input"
        onClick={() => onChange({ ...value, memo: "利用者がじっくり書いた内容", damage: "2800" })}
      >
        type input
      </button>
    </div>
  ),
}));

vi.mock("./SetupRegistrationSection", () => ({ SetupRegistrationSection: () => null }));
vi.mock("./DuplicateRealtimeWarning", () => ({ DuplicateRealtimeWarning: () => null }));
vi.mock("./DuplicateWarning", () => ({ DuplicateWarning: () => null }));
vi.mock("./ValidationDisplay", () => ({ ValidationDisplay: () => null }));
vi.mock("./PromoteToFinalButton", () => ({ PromoteToFinalButton: () => null }));
vi.mock("./KnockdownAdvantageChangeModal", () => ({ KnockdownAdvantageChangeModal: () => null }));
vi.mock("./PutConfirmDialog", () => ({ PutConfirmDialog: () => null }));
vi.mock("./ComboDraftToggleField", () => ({ ComboDraftToggleField: () => null }));
vi.mock("@/features/setup/components/SetupRecipeEditor", () => ({ SetupRecipeEditor: () => null }));
vi.mock("@/features/setup/hooks/useCharacterSetups", () => ({
  useCharacterSetups: () => ({ data: [], isLoading: false }),
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

const INITIAL: ComboDetail = {
  id: 42,
  characterId: 1,
  isDraft: false,
  affectedByGameUpdate: false,
  affectedMoves: [],
  stepCount: 1,
  version: 3,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  tags: [],
  defaultRecipe: "",
  starterMoveCode: "",
  memo: "元の内容",
  // ★M27-02b(P4M-009) / ★★★M38-01 追補2: 本登録の fixture が埋める欄。
  //   ★★以下は失効した記述:「本登録の必須 4 欄」——**必須は 2 欄である**
  //     (damage / knockdownAdvantage)。消費ゲージも開始残量も必須ではない。
  //   ★止めるのは zod である(追補1 まで在ったフロントの門は追補2 で消えた)。
  //   ⇒ damage / knockdownAdvantage を埋めないと保存が止まり、本ファイルが見ている
  //     「保存 → サーバが err を返す」まで進まない。
  //   ★damage は各ケースが 2800 へ上書きするが、初期値も埋めておく必要がある。
  damage: 1500,
  knockdownAdvantage: 30,
  driveGaugeConsumed: 1,
  saGaugeConsumed: 0,
  steps: [{ id: 1, stepOrder: 1, moveId: 5 }],
};

afterEach(() => {
  vi.clearAllMocks();
});

function renderEditor() {
  render(<ComboEditor mode="edit" initial={INITIAL} />, { wrapper: createWrapper() });
}

/**
 * 利用者が入力し、保存を押し、サーバが err を返した状態まで進める。
 *
 * ★入力はキー項目でない 2 本(memo / damage)へ入れる。初期値と違う値であることが
 *   「初期値へリセットする実装」の検出条件になる。
 */
function saveAndFail(err: unknown) {
  fireEvent.click(screen.getByTestId("basic-type-input"));
  expect(screen.getByTestId("basic-memo").textContent).toBe("利用者がじっくり書いた内容");
  expect(screen.getByTestId("basic-damage").textContent).toBe("2800");

  fireEvent.click(screen.getByText("保存"));
  expect(mockPatchMutate).toHaveBeenCalledTimes(1);

  const [, options] = mockPatchMutate.mock.calls[0];
  act(() => {
    options.onError(err);
  });
}

const versionConflictError = () =>
  new MockApiError(
    409,
    { error: { code: "version_conflict", message: "このコンボは他の処理で更新されました。再取得してください" } },
    "このコンボは他の処理で更新されました。再取得してください",
  );

const notFoundError = () =>
  new MockApiError(
    404,
    { error: { code: "not_found", message: "コンボが見つかりません" } },
    "コンボが見つかりません",
  );

describe("§5.1-1 ★版不一致で拒否されたとき、入力が保持されている", () => {
  it("利用者が打った memo がそのまま残る", () => {
    renderEditor();
    saveAndFail(versionConflictError());
    expect(screen.getByTestId("basic-memo").textContent).toBe("利用者がじっくり書いた内容");
  });

  it("2 本目の入力(damage)も消えない", () => {
    renderEditor();
    saveAndFail(versionConflictError());
    expect(screen.getByTestId("basic-damage").textContent).toBe("2800");
  });

  // ★本項が検出できるのは「レシピを空にする」実装だけである。「初期値へ戻す」実装は
  //   件数が変わらないため検出できない——それは上の memo / damage が受け持つ。
  //   ⇒ 破壊確認 A の 1 回目で、件数だけを見る主張が空振りしたことを受けて分けた。
  it("レシピ(ステップ)が空にならない", () => {
    renderEditor();
    saveAndFail(versionConflictError());
    expect(screen.getByTestId("recipe-steps-count").textContent).toBe("1");
  });
});

describe("§5.1-2 ★自動で読み込み直さない", () => {
  it("画面遷移しない(編集中の画面に留まる)", () => {
    renderEditor();
    saveAndFail(versionConflictError());
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("初期値へ戻らない —— 「安全側に倒す」つもりの自動リセットが無いこと", () => {
    renderEditor();
    saveAndFail(versionConflictError());
    expect(screen.getByTestId("basic-memo").textContent).not.toBe("元の内容");
  });
});

describe("§5.1-3 ★「保存しました」が出ない(409 を握りつぶしていない)", () => {
  it("成功トーストを出さない", () => {
    renderEditor();
    saveAndFail(versionConflictError());
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });
});

describe("§5.1-7 拒否されたあとの導線", () => {
  it("何が起きたかをモーダルで伝える。トーストだけで終わらせない", () => {
    renderEditor();
    saveAndFail(versionConflictError());
    expect(screen.getByTestId("conflict-dialog")).toBeTruthy();
    expect(screen.getByText("ほかの人がこのコンボを変更しました")).toBeTruthy();
  });

  it("相手の内容を見る導線が、編集中のコンボの詳細画面へ別枠で開く", () => {
    renderEditor();
    saveAndFail(versionConflictError());
    const link = screen.getByTestId("conflict-dialog-view-theirs");
    expect(link.getAttribute("href")).toBe("/combos/42");
    expect(link.getAttribute("target")).toBe("_blank");
  });

  it("読み込み直す導線が出る。★押す前に確認が挟まる", () => {
    renderEditor();
    saveAndFail(versionConflictError());
    fireEvent.click(screen.getByTestId("conflict-dialog-reload"));
    expect(screen.getByTestId("conflict-dialog-reload-confirm")).toBeTruthy();
  });
});

describe("§5.1-8 ★上書きの道を出していない(§4.4 案 A)", () => {
  it("自分の内容で保存する導線が無い", () => {
    renderEditor();
    saveAndFail(versionConflictError());
    expect(screen.queryByText(/自分の内容で保存/)).toBeNull();
    expect(screen.getByTestId("conflict-dialog").textContent ?? "").not.toContain("上書き");
  });
});

describe("§5.1-9 ★非回帰: 版が一致するときは、いままでどおり保存できる", () => {
  // ★これが無いと「常に拒否する」実装でも §5.1-1〜3 は緑になる。
  it("成功時は保存メッセージが出て、競合モーダルは出ない", () => {
    renderEditor();
    fireEvent.click(screen.getByText("保存"));
    const [, options] = mockPatchMutate.mock.calls[0];
    act(() => {
      options.onSuccess({ ...INITIAL, version: 4 });
    });
    expect(screen.queryByTestId("conflict-dialog")).toBeNull();
    expect(mockToastSuccess).toHaveBeenCalled();
  });
});

describe("§5.1-11 ★キー変更編集に負けたとき(404)も入力が保持されている", () => {
  it("memo が消えない", () => {
    renderEditor();
    saveAndFail(notFoundError());
    expect(screen.getByTestId("basic-memo").textContent).toBe("利用者がじっくり書いた内容");
  });

  it("導線を 409 と同じモーダルへ寄せてある(「コンボが見つかりません」で終わらせない)", () => {
    renderEditor();
    saveAndFail(notFoundError());
    expect(screen.getByTestId("conflict-dialog")).toBeTruthy();
    expect(screen.getByTestId("conflict-dialog-input-kept")).toBeTruthy();
  });

  // ★404 は「本当に削除された」場合にも来る。サーバは両者に同じコード・同じ
  //   メッセージを返すため区別できない ⇒ 断定しない文言であることを固定する。
  it("★「ほかの人が変更しました」と断定しない", () => {
    renderEditor();
    saveAndFail(notFoundError());
    expect(screen.queryByText("ほかの人がこのコンボを変更しました")).toBeNull();
    const text = screen.getByTestId("conflict-dialog").textContent ?? "";
    expect(text).toContain("作り直した");
    expect(text).toContain("削除した");
  });

  it("行がもう無いため、読み込み直す導線は出さない", () => {
    renderEditor();
    saveAndFail(notFoundError());
    expect(screen.queryByTestId("conflict-dialog-reload")).toBeNull();
  });
});

// ★★【追補・§4.7】404 の行き止まりを塞ぐ。
//
// ★v1.4.0 までの実装は「閉じる」だけを出しており、入力は保持されるのに
//   利用者は保存する道を 1 本も持たなかった。⇒ 指示書 §1.4-2 を満たしていなかった。
//
// ★本 describe は「ボタンが在る」ではなく「そこから先へ進めること」を主張する
//   (§5.1-15)。存在だけを見ると、行き止まりを緑で固定してしまう。
describe("§5.1-14 ★404 のモーダルから、保存する道と脱出路が出ている", () => {
  it("「閉じる」だけになっていない", () => {
    renderEditor();
    saveAndFail(notFoundError());
    expect(screen.getByTestId("conflict-dialog-save-as-new")).toBeTruthy();
    expect(screen.getByTestId("conflict-dialog-go-to-list")).toBeTruthy();
  });

  it("★版不一致では出さない(旧行が生きており、同じ内容で登録すると重複になるだけ)", () => {
    renderEditor();
    saveAndFail(versionConflictError());
    expect(screen.queryByTestId("conflict-dialog-save-as-new")).toBeNull();
    expect(screen.queryByTestId("conflict-dialog-go-to-list")).toBeNull();
  });

  it("「この内容で新しく登録する」は 2 段階である(1 回押しただけでは保存しない)", () => {
    renderEditor();
    saveAndFail(notFoundError());
    fireEvent.click(screen.getByTestId("conflict-dialog-save-as-new"));
    expect(screen.getByTestId("conflict-dialog-save-as-new-confirm")).toBeTruthy();
    expect(mockCreateMutate).not.toHaveBeenCalled();
  });

  it("「コンボ一覧へ」も 2 段階で、入力が失われることを押す前に伝える", () => {
    renderEditor();
    saveAndFail(notFoundError());
    fireEvent.click(screen.getByTestId("conflict-dialog-go-to-list"));
    const confirm = screen.getByTestId("conflict-dialog-go-to-list-confirm");
    expect(confirm.textContent).toContain("失われます");
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

describe("§5.1-15 ★★「この内容で新しく登録する」で保存が成立する(到達可能性)", () => {
  /** 404 のモーダルから 2 段階を通って「新しく登録する」を実行するまで進める。 */
  function proceedToSaveAsNew() {
    saveAndFail(notFoundError());
    fireEvent.click(screen.getByTestId("conflict-dialog-save-as-new"));
    fireEvent.click(screen.getByTestId("conflict-dialog-save-as-new-execute"));
  }

  it("POST 経路(useCreateCombo)が叩かれる", () => {
    renderEditor();
    proceedToSaveAsNew();
    expect(mockCreateMutate).toHaveBeenCalledTimes(1);
  });

  it("★入力していた内容が要求本文へ載っている(空の payload を送っていない)", () => {
    renderEditor();
    proceedToSaveAsNew();
    const [payload] = mockCreateMutate.mock.calls[0];
    expect(payload.memo).toBe("利用者がじっくり書いた内容");
    expect(payload.damage).toBe(2800);
    expect(payload.characterId).toBe(INITIAL.characterId);
    // ★version を載せない。新規登録であって更新ではない。
    expect(payload).not.toHaveProperty("version");
  });

  it("★保存が成立すると新しいコンボへ移り、「保存された」ことが分かる", () => {
    renderEditor();
    proceedToSaveAsNew();
    const [, options] = mockCreateMutate.mock.calls[0];
    act(() => {
      options.onSuccess({ ...INITIAL, id: 99, version: 1 });
    });
    expect(mockToastSuccess).toHaveBeenCalledWith("保存しました");
    expectNavigatedTo(mockNavigate, "/combos/99");
  });

  it("実行後は競合モーダルが閉じている(裏に隠れたまま残らない)", () => {
    renderEditor();
    proceedToSaveAsNew();
    expect(screen.queryByTestId("conflict-dialog")).toBeNull();
  });

  // ★§4.7.3: 重複になっても新しい見せ方を作らず、既存の経路へ落ちる。
  it("★重複(VAL-C02)になったら既存のバリデーション表示へ落ちる(新しいモーダルを作らない)", () => {
    renderEditor();
    proceedToSaveAsNew();
    const [, options] = mockCreateMutate.mock.calls[0];
    act(() => {
      options.onError(
        new MockApiError(
          400,
          {
            error: {
              code: "validation_failed",
              message: "重複",
              details: {
                validations: {
                  issues: [
                    { code: "VAL-C02", severity: "error", field: "recipe", message: "同じコンボが既にあります" },
                  ],
                },
              },
            },
          },
          "重複",
        ),
      );
    });
    expect(screen.queryByTestId("conflict-dialog")).toBeNull();
    expect(mockToastError).toHaveBeenCalledWith("保存できませんでした。");
  });
});

describe("§4.7.2-2 ★脱出路が実際に一覧へ着く", () => {
  it("2 段目を承諾すると一覧へ移動する", () => {
    renderEditor();
    saveAndFail(notFoundError());
    fireEvent.click(screen.getByTestId("conflict-dialog-go-to-list"));
    fireEvent.click(screen.getByTestId("conflict-dialog-go-to-list-execute"));
    expectNavigatedTo(mockNavigate, "/combos");
  });
});

describe("★エラーコードで分岐している(ステータスで分岐していない)", () => {
  // ★破壊確認 B の的の一部。判定を status === 409 だけへ戻すと、
  //   下記の 409 が競合モーダルを開いてしまい赤くなる。
  it("version_conflict 以外の 409 で競合モーダルを出さない", () => {
    renderEditor();
    saveAndFail(
      new MockApiError(
        409,
        { error: { code: "alias_conflict", message: "表記が重複しています" } },
        "表記が重複しています",
      ),
    );
    expect(screen.queryByTestId("conflict-dialog")).toBeNull();
    expect(mockToastError).toHaveBeenCalledWith("表記が重複しています");
  });

  // ★通信断(fetch が TypeError を投げる)では ApiError にならず message が
  //   "Failed to fetch" になる。そのまま出すと生の英語が利用者へ出る。
  //   ⇒ サーバ由来のメッセージが無いときは固定文言へ落ちることを固定する。
  it("★通信断のとき、生の英語メッセージを利用者へ出さない", () => {
    renderEditor();
    saveAndFail(new TypeError("Failed to fetch"));
    expect(mockToastError).toHaveBeenCalledWith("通信エラーが発生しました。");
    expect(mockToastError).not.toHaveBeenCalledWith("Failed to fetch");
  });

  it("★対照: サーバ由来のメッセージがあるときは、それを出す", () => {
    renderEditor();
    saveAndFail(
      new MockApiError(500, { error: { code: "internal_error", message: "サーバーエラーが発生しました" } }, "サーバーエラーが発生しました"),
    );
    expect(mockToastError).toHaveBeenCalledWith("サーバーエラーが発生しました");
  });

  it("5xx でも競合モーダルを出さない", () => {
    renderEditor();
    saveAndFail(
      new MockApiError(500, { error: { code: "internal_error", message: "サーバーエラー" } }, "サーバーエラー"),
    );
    expect(screen.queryByTestId("conflict-dialog")).toBeNull();
  });
});

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ComboEditor, SAVE_BLOCKED_EMPTY_RECIPE } from "./ComboEditor";
import type { ComboDetail } from "../types";
import { NavigationGuardProvider } from "@/features/navigation-guard/NavigationGuardProvider";
import { HIT_TYPE_NORMAL } from "@/constants/combo-list";

// ★★M24-04(CO-003): 保存後の遷移は離脱ガードの補正を通る。
//   ガードが履歴へ積んだ「番人」のエントリを遷移先で置き換えるため、
//   `navigate(dest, { replace: true })` の形で呼ばれる（番人が無ければ `navigate(dest)`）。
//   ★★遷移先そのものが契約であり（M24-01 / CHANGE-130）、第 2 引数は契約ではない。
//     ⇒ 遷移先だけを見る形にしてある。引数の形で固定すると、
//       履歴の補正を直すたびに遷移先の契約テストが巻き添えで落ちる。
function expectNavigatedTo(spy: { mock: { calls: unknown[][] } }, dest: unknown) {
  expect(spy.mock.calls.map((c) => c[0])).toContain(dest);
}

function expectNotNavigatedTo(spy: { mock: { calls: unknown[][] } }, dest: unknown) {
  expect(spy.mock.calls.map((c) => c[0])).not.toContain(dest);
}

const mockNavigate = vi.fn();
const mockPatchMutate = vi.fn();
const mockCreateMutate = vi.fn();
const mockAddPunishMutateAsync = vi.fn();
let mockLocationState: unknown = null;
const mockMovesByCharacter = vi.fn((_characterId: number) => ({
  data: [],
  isLoading: false,
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  // M18-02: ComboEditor は確定反撃サーチからの戻り先 state を useLocation で読む。
  useLocation: () => ({ state: mockLocationState }),
}));

vi.mock("@/features/moves/api", () => ({
  useMovesByCharacter: (characterId: number) => mockMovesByCharacter(characterId),
}));

// M24-01: 既定キャラの解決順。段の材料(config / characters / セッション)は本 spec の
// 主題ではないため、解決結果そのものを差し替えられるようにする。
// 既定の実装は本物と同じ形にする(段 1 = urlCharacterId、無ければ段 4 = 1)。
// 個別のテストは mockReturnValue で解決結果ごと差し替える。
const RESOLVED_DEFAULT = (opts?: { urlCharacterId?: number | null }) =>
  opts?.urlCharacterId ?? 1;
const mockResolvedCharacterId = vi.fn(RESOLVED_DEFAULT);
vi.mock("../hooks/useResolvedCharacterId", () => ({
  useResolvedCharacterId: (opts?: { urlCharacterId?: number | null }) =>
    mockResolvedCharacterId(opts),
}));

vi.mock("@/features/punish/api", () => ({
  useAddPunish: () => ({
    mutateAsync: mockAddPunishMutateAsync,
    isPending: false,
  }),
}));

// ComboEditor は内部で useCharacters() を呼び custom_states 定義を解決する(M11-01)。
// テストの堅牢性のため明示的にモックする(レビュー指摘 中-1)。
vi.mock("@/features/character/hooks/useCharacters", () => ({
  useCharacters: () => ({
    data: [
      {
        id: 1,
        gameId: 1,
        code: "ryu",
        nameJa: "リュウ",
        nameEn: "Ryu",
        customStates: JSON.stringify({
          states: [
            {
              code: "denjin_charge",
              name_ja: "電刃錬気",
              type: "flag",
              value_definition: { kind: "boolean" },
            },
          ],
        }),
      },
    ],
  }),
  DEFAULT_GAME_ID: 1,
}));

vi.mock("../api", () => ({
  ApiError: class extends Error {
    status = 0;
    body = null;
  },
  useCreateCombo: () => ({ mutate: mockCreateMutate, isPending: false }),
  useUpdateComboMetadata: () => ({ mutate: mockPatchMutate, isPending: false }),
  useUpdateComboWithKeyChange: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("../hooks/useCheckDuplicate", () => ({
  useCheckDuplicate: () => ({ duplicates: [] }),
}));

vi.mock("@/features/setup/hooks/useSetupLinks", () => ({
  useCreateSetupLink: () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("./RecipeBuilder", () => ({
  RecipeBuilder: ({
    characterId,
    steps,
    onChange,
  }: {
    characterId: number;
    steps: unknown[];
    onChange: (next: unknown[]) => void;
  }) => (
    <div data-testid="recipe-builder">
      <span data-testid="recipe-character-id">{characterId}</span>
      <span data-testid="recipe-steps-count">{steps.length}</span>
      <button
        type="button"
        data-testid="recipe-add-step"
        onClick={() => onChange([{ id: 1, stepOrder: 1, moveId: 5 }])}
      >
        add step
      </button>
      {/*
        ★M24-13: 「レシピタブ側で落ちる」状況を作るための入口。
        レシピが 0 件のままでは保存ボタンが押せなくなったため(VAL-C09 を仮登録へ
        適用した)、タブ見出しのエラー件数を見るテストは **1 本あるが不正** な
        ステップで作る。★modifiers.notes の上限 200 字を超えると
        `steps.0.modifiers.notes` で落ち、前方一致でレシピタブへ振り分けられる。
      */}
      <button
        type="button"
        data-testid="recipe-add-invalid-step"
        onClick={() =>
          onChange([
            { stepOrder: 1, moveId: 5, modifiers: { notes: "x".repeat(201) } },
          ])
        }
      >
        add invalid step
      </button>
    </div>
  ),
}));

vi.mock("./ComboEditorCharacterField", () => ({
  ComboEditorCharacterField: ({
    characterId,
    mode,
    onChange,
    lockedReason,
  }: {
    characterId: number;
    mode: string;
    onChange: (id: number) => void;
    lockedReason?: string;
  }) => (
    <div data-testid="character-field">
      <span data-testid="char-current">{characterId}</span>
      <span data-testid="char-mode">{mode}</span>
      <span data-testid="char-locked-reason">{lockedReason ?? ""}</span>
      {!lockedReason && (
        <button
          type="button"
          data-testid="char-change"
          onClick={() => onChange(3)}
        >
          change character
        </button>
      )}
    </div>
  ),
}));

vi.mock("./CharacterChangeConfirmDialog", () => ({
  CharacterChangeConfirmDialog: ({
    open,
    onConfirm,
    onCancel,
  }: {
    open: boolean;
    onConfirm: () => void;
    onCancel: () => void;
  }) =>
    open ? (
      <div data-testid="char-confirm">
        <button type="button" data-testid="char-confirm-discard" onClick={onConfirm}>
          変更して入力を破棄
        </button>
        <button type="button" data-testid="char-confirm-cancel" onClick={onCancel}>
          キャンセル
        </button>
      </div>
    ) : null,
}));

vi.mock("./ComboEditorBasicFields", () => ({
  ComboEditorBasicFields: ({
    value,
    onChange,
    hitTypeLockedReason,
  }: {
    value: { damage: string; customStates?: unknown; [k: string]: unknown };
    onChange: (next: unknown) => void;
    hitTypeLockedReason?: string;
  }) => (
    <div data-testid="basic-fields">
      <span data-testid="basic-damage">{value.damage}</span>
      <span data-testid="basic-hit-type">{String(value.hitType ?? "")}</span>
      <span data-testid="basic-hit-type-locked-reason">
        {hitTypeLockedReason ?? ""}
      </span>
      {/* M24-04(SM-093): 状態の既定の観測用 */}
      <span data-testid="basic-opponent-stance">
        {String(value.opponentStance ?? "")}
      </span>
      <span data-testid="basic-custom-states">
        {JSON.stringify(value.customStates ?? {})}
      </span>
      {/* M17-01: メディア 3 フィールドの観測・操作用スタブ */}
      <span data-testid="basic-link">{String(value.link ?? "")}</span>
      <span data-testid="basic-video-path">{String(value.videoPath ?? "")}</span>
      <span data-testid="basic-image-path">{String(value.imagePath ?? "")}</span>
      <button
        type="button"
        data-testid="basic-set-damage"
        onClick={() => onChange({ ...value, damage: "300" })}
      >
        set damage
      </button>
      {/* ★★M27-02b(P4M-009): 本登録の必須欄を埋める。
          ★★既に値が在る欄は上書きしない——mode="edit" の fixture が持つ値を
            壊すと、payload を見ているケースが何を検証しているのか変わる。
          ★★★M38-01 追補2: **必須は damage / knockdownAdvantage の 2 欄だけ**である。
            ★以下は失効した記述:「必須が開始残量 2 欄へ入れ替わり、4 欄とも実際に効く」。
            ⇒ 開始残量 2 欄は任意になった(空欄＝NULL＝「不問」)。
            ★同 2 欄はここでも埋める —— 本ボタンの目的は「保存が通る状態を作る」ことで
              あり、埋まっていて困るケースが無いためである。 */}
      <button
        type="button"
        data-testid="basic-fill-required"
        onClick={() =>
          onChange({
            ...value,
            damage: value.damage || "1500",
            knockdownAdvantage: value.knockdownAdvantage || "30",
            // ★M38-01: 消費ゲージ 2 欄はもう埋めなくてよい(必須から外れた)。
            //   ★開始残量 2 欄も追補2 で任意になったが、値は入れておく(上記の理由)。
            driveAvailableAtStart: value.driveAvailableAtStart || "3",
            saAvailableAtStart: value.saAvailableAtStart || "1",
          })
        }
      >
        fill required
      </button>
      <button
        type="button"
        data-testid="basic-clear-custom-states"
        onClick={() => onChange({ ...value, customStates: {} })}
      >
        clear custom states
      </button>
      <button
        type="button"
        data-testid="basic-set-link"
        onClick={() => onChange({ ...value, link: "https://example.com/guide" })}
      >
        set link
      </button>
      <button
        type="button"
        data-testid="basic-clear-link"
        onClick={() => onChange({ ...value, link: "" })}
      >
        clear link
      </button>
    </div>
  ),
}));

// セットプレイ登録セクションのスタブ。可視性テスト用に既存の見出しテキストを保ちつつ、
// 束ねセットプレイ(value)と既存紐付け(linkedSetups)を操作・観測できるようにする。
vi.mock("./SetupRegistrationSection", () => ({
  SetupRegistrationSection: ({
    value,
    onChange,
    linkedSetups,
    onLinkedSetupsChange,
  }: {
    value: unknown[];
    onChange: (next: unknown[]) => void;
    linkedSetups: unknown[];
    onLinkedSetupsChange: (next: unknown[]) => void;
  }) => (
    <div data-testid="setup-section">
      <span>このコンボに紐づくセットプレイ</span>
      <span data-testid="setups-count">{value.length}</span>
      <span data-testid="linked-count">{linkedSetups.length}</span>
      <button
        type="button"
        data-testid="setup-add"
        onClick={() =>
          onChange([{ characterId: 1, name: null, description: null, steps: [] }])
        }
      >
        add setup
      </button>
      <button
        type="button"
        data-testid="linked-add"
        onClick={() =>
          onLinkedSetupsChange([
            {
              id: 99,
              characterId: 1,
              name: "x",
              stepCount: 0,
              version: 1,
              defaultRecipe: "",
              parentComboIds: [],
            },
          ])
        }
      >
        add linked
      </button>
    </div>
  ),
}));

vi.mock("./DuplicateRealtimeWarning", () => ({
  DuplicateRealtimeWarning: () => null,
}));

vi.mock("./DuplicateWarning", () => ({
  DuplicateWarning: () => null,
}));

vi.mock("./ValidationDisplay", () => ({
  ValidationDisplay: () => null,
}));

vi.mock("./PromoteToFinalButton", () => ({
  PromoteToFinalButton: () => null,
}));

vi.mock("./KnockdownAdvantageChangeModal", () => ({
  KnockdownAdvantageChangeModal: () => null,
}));

vi.mock("./PutConfirmDialog", () => ({
  PutConfirmDialog: () => null,
}));

vi.mock("@/features/setup/components/SetupRecipeEditor", () => ({
  SetupRecipeEditor: () => <div data-testid="setup-recipe-editor" />,
}));

vi.mock("@/features/setup/hooks/useCharacterSetups", () => ({
  useCharacterSetups: () => ({ data: [], isLoading: false }),
}));

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  // M24-04(CO-003): ComboEditor は useUnsavedChangesGuard を呼ぶため、離脱ガードの
  // provider が要る。★provider を外すとここが落ちる——ガードが黙って消えないようにしてある。
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(
      QueryClientProvider,
      { client: qc },
      React.createElement(NavigationGuardProvider, null, children),
    );
}

/**
 * ★★M27-02b: 必須欄を埋めてから保存を押す(M38-01 追補2 の時点で必須は 2 欄)。
 *
 * ★本ファイルの多くのケースは「保存の動線」を見ており、必須欄の有無は主題ではない。
 *   ⇒ 埋める手順を 1 か所へ畳み、各ケースへ複製しない。
 * ★埋めるのは空の欄だけである(basic-fill-required)。既に値が在るケースは変わらない。
 */
function clickSave() {
  fireEvent.click(screen.getByTestId("basic-fill-required"));
  fireEvent.click(screen.getByText("保存"));
}

afterEach(async () => {
  vi.clearAllMocks();
  // ★clearAllMocks は実装も落とす。既定の解決実装を戻す(M24-01)。
  mockResolvedCharacterId.mockImplementation(RESOLVED_DEFAULT);
  mockLocationState = null;

  // ★★M24-12: テスト間の履歴の持ち越しを断つ。
  //   NavigationGuardProvider は unmount 時に「番人の上に居れば」`history.go(-1)` で
  //   戻す(M24-04 の意図的な後始末＝番人を残さない)。**jsdom の `history.go` は非同期**
  //   であり、RTL の自動 cleanup で unmount された後に popstate が発火する。
  //   ⇒ 何もしないとその popstate が**次のテスト**へ流れ込み、新しく張られたガードが
  //     「戻るが押された」と解釈して未保存の確認ダイアログを出す。
  //   ★実測: 本ファイルを通しで回すと 6 回に 1 回ほど
  //     「保存が成功すると dirty が落ちる」が落ちていた(単体実行では 6/6 緑)。
  //   ★★アプリの欠陥ではない——実ブラウザではエディタごとにページが独立しており、
  //     この後始末は正しい。テスト環境に固有の相互汚染である。
  //   ⇒ マクロタスクを 1 つ空けて、リスナが外れた状態で popstate を流し切る。
  await new Promise((resolve) => setTimeout(resolve, 0));
});

describe("ComboEditor M4-04 SetupRegistrationSection visibility", () => {
  it("mode=new でセットプレイ同時登録セクションが表示される", () => {
    render(<ComboEditor mode="new" />, { wrapper: createWrapper() });
    expect(
      screen.getByText("このコンボに紐づくセットプレイ"),
    ).toBeDefined();
  });

  it("mode=copy でセットプレイ同時登録セクションが表示される", () => {
    render(<ComboEditor mode="copy" />, { wrapper: createWrapper() });
    expect(
      screen.getByText("このコンボに紐づくセットプレイ"),
    ).toBeDefined();
  });

  it("mode=edit でセットプレイ同時登録セクションが表示されない", () => {
    render(
      <ComboEditor
        mode="edit"
        initial={{
          id: 1,
          characterId: 1,
          isDraft: false,
          affectedByGameUpdate: false,
          affectedMoves: [],
          stepCount: 1,
          version: 1,
          createdAt: "",
          updatedAt: "",
          steps: [],
          tags: [],
          setups: [],
          defaultRecipe: "",
          starterMoveCode: "",
        }}
      />,
      { wrapper: createWrapper() },
    );
    expect(
      screen.queryByText("このコンボに紐づくセットプレイ"),
    ).toBeNull();
  });
});

// ★M19-07 §2.4: コピー時は成立条件を引き継がない(全セル未検証で開始)。
// 引き継ぐと「元のコンボで確認した ok」が「このコンボで確認した ok」に見え、
// 未検証のものが検証済みに見える誤認のほうが害が大きい(開発者確定 2026-07-28)。
//
// ★このテストが固定しているのは「同梱セットプレイが 0 件」という構造的帰結である
// (DES-005 §5.7: コピーではセットプレイ自体を引き継がない)。現行仕様ではこれ以上
// 直接には書けないが、将来「copy でセットプレイを引き継ぐ」へ仕様変更した場合、
// 本テストは落ちるものの G-3 の本体(成立条件「だけ」を外す)のガードにはならない。
// そのときは「引き継いだセットプレイの verifiedConditions が空である」ことを
// 固定するテストへ張り替えること。
describe("ComboEditor M19-07 copy モードで成立条件を引き継がない", () => {
  // コピー元は成立条件つきのセットプレイを 1 本持つ。
  const copySource: ComboDetail = {
    id: 7,
    characterId: 1,
    isDraft: false,
    affectedByGameUpdate: false,
    affectedMoves: [],
    stepCount: 1,
    version: 3,
    createdAt: "",
    updatedAt: "",
    steps: [],
    tags: [],
    setups: [
      {
        id: 55,
        characterId: 1,
        name: "コピー元のセットプレイ",
        stepCount: 1,
        version: 1,
        defaultRecipe: "立ち弱P",
        parentComboIds: [7],
        results: [
          { setupId: 55, techType: "neutral_tech", inCorner: false, result: "ok" },
          { setupId: 55, techType: "back_tech", inCorner: true, result: "ok" },
        ],
      },
    ],
    defaultRecipe: "立ち弱P",
    starterMoveCode: "5LP",
  };

  it("★コピー元に成立条件つきセットプレイがあっても、同時登録は 0 件で開始する", () => {
    render(<ComboEditor mode="copy" initial={copySource} />, {
      wrapper: createWrapper(),
    });
    // 同梱セットプレイ自体が引き継がれない = 成立条件も構造的に引き継がれない。
    expect(screen.getByTestId("setups-count").textContent).toBe("0");
  });

  it("コピー元の既存セットプレイの紐付けも引き継がない(N-7 の現行挙動を維持)", () => {
    render(<ComboEditor mode="copy" initial={copySource} />, {
      wrapper: createWrapper(),
    });
    expect(screen.getByTestId("linked-count").textContent).toBe("0");
  });

  it("mode=new でも同時登録は 0 件で開始する(既定は未検証)", () => {
    render(<ComboEditor mode="new" />, { wrapper: createWrapper() });
    expect(screen.getByTestId("setups-count").textContent).toBe("0");
  });
});

describe("ComboEditor M12-02 C-15 仮登録トグル位置 / C-09 上部戻る導線", () => {
  const editInitial = {
    id: 1,
    characterId: 1,
    isDraft: false,
    affectedByGameUpdate: false,
    affectedMoves: [],
    stepCount: 1,
    version: 1,
    createdAt: "",
    updatedAt: "",
    steps: [],
    tags: [],
    setups: [],
    defaultRecipe: "",
    starterMoveCode: "",
  };

  it("C-15: mode=new で仮登録トグルがキャラクター欄より前に描画される", () => {
    render(<ComboEditor mode="new" />, { wrapper: createWrapper() });
    const draft = screen.getByTestId("combo-editor-draft-checkbox");
    const character = screen.getByTestId("character-field");
    // 仮登録トグルがキャラクター欄より DOM 上で前方にある(= 最上部寄り)。
    expect(
      draft.compareDocumentPosition(character) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  // ★★M24-12(§4.10・D-582): 編集モードも最上部へ統一した。
  //   ★`DES-005` §5.7 項目3 の「編集モードは本位置(基本情報フィールド群の末尾)を維持」を
  //     撤回した。**撤回の理由は「配置の根拠だったものが本サブで消えた」ことである**
  //     ——元の規則は「最上部の『← キャンセル』導線と同一行に置く」であり、
  //     編集モードにはその相手が無かったから末尾に残していた。本サブでタブ化した結果、
  //     最上部の行構成そのものが変わった(指示書 §4.10.1)。
  //   ★旧テストは「mode=edit では描画しない」を見ていた。意味が反転したので置換する。
  it("★★C-15 改め M24-12: mode=edit でも最上部に仮登録トグルを描画する", () => {
    render(<ComboEditor mode="edit" initial={editInitial} />, {
      wrapper: createWrapper(),
    });
    // 基本情報(ComboEditorBasicFields)はモックのため、見えているのは上部トグルだけである。
    const draft = screen.getByTestId("combo-editor-draft-checkbox");
    expect(draft).toBeTruthy();
    // ★「← キャンセル」と同じ行に居ること(最上部である、の実体)。
    const cancel = screen.getByText("← キャンセル");
    expect(cancel.parentElement?.contains(draft)).toBe(true);
  });

  it("★新規モードでも同じ場所に在る(モードで位置が変わらない)", () => {
    render(<ComboEditor mode="new" />, { wrapper: createWrapper() });
    const draft = screen.getByTestId("combo-editor-draft-checkbox");
    const cancel = screen.getByText("← キャンセル");
    expect(cancel.parentElement?.contains(draft)).toBe(true);
  });

  it("C-09: 最上部にキャンセル導線(← キャンセル)が描画され navigate(-1) を呼ぶ", () => {
    render(<ComboEditor mode="new" />, { wrapper: createWrapper() });
    const back = screen.getByText("← キャンセル");
    fireEvent.click(back);
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });
});

describe("M11-01 キャラ固有状態 round-trip", () => {
  const editInitial = (situation?: string) => ({
    id: 1,
    characterId: 1,
    isDraft: false,
    affectedByGameUpdate: false,
    affectedMoves: [],
    stepCount: 1,
    version: 1,
    createdAt: "",
    updatedAt: "",
    // ★M24-13: レシピが 0 本だと保存ボタンが押せない(VAL-C09 を仮登録へ適用した)。
    //   ここで見たいのは custom_states の往復なので、最小のレシピを持たせる。
    steps: [{ id: 1, stepOrder: 1, moveId: 5 }],
    tags: [],
    setups: [],
    defaultRecipe: "",
    starterMoveCode: "",
    situation,
  });

  it("(14) edit で既存 situation の custom_states が付与値へ復元される", () => {
    render(
      <ComboEditor
        mode="edit"
        initial={editInitial(
          JSON.stringify({ custom_states: { denjin_charge: true, sun_crest: 3 } }),
        )}
      />,
      { wrapper: createWrapper() },
    );
    const cs = JSON.parse(
      screen.getByTestId("basic-custom-states").textContent ?? "{}",
    );
    expect(cs).toEqual({ denjin_charge: true, sun_crest: 3 });
  });

  it("(15) copy でも custom_states が復元される", () => {
    render(
      <ComboEditor
        mode="copy"
        initial={editInitial(
          JSON.stringify({ custom_states: { denjin_charge: true } }),
        )}
      />,
      { wrapper: createWrapper() },
    );
    const cs = JSON.parse(
      screen.getByTestId("basic-custom-states").textContent ?? "{}",
    );
    expect(cs).toEqual({ denjin_charge: true });
  });

  it("(18) situation=NULL の既存コンボは付与値が空(後方互換)", () => {
    render(<ComboEditor mode="edit" initial={editInitial(undefined)} />, {
      wrapper: createWrapper(),
    });
    expect(screen.getByTestId("basic-custom-states").textContent).toBe("{}");
  });

  it("(19) edit で custom_states を全 off にすると PATCH payload.situation が null(NULL クリア)になる", () => {
    render(
      <ComboEditor
        mode="edit"
        initial={{
          ...editInitial(
            JSON.stringify({ custom_states: { denjin_charge: true } }),
          ),
          // 仮登録にして recipe 必須バリデーションを回避し PATCH まで到達させる。
          isDraft: true,
          affectedByGameUpdate: false,
          affectedMoves: [],
        }}
      />,
      { wrapper: createWrapper() },
    );
    // 前提: 既存 custom_states が復元されている。
    expect(
      JSON.parse(screen.getByTestId("basic-custom-states").textContent ?? "{}"),
    ).toEqual({ denjin_charge: true });

    // 全 off にする(あり→なし)。
    fireEvent.click(screen.getByTestId("basic-clear-custom-states"));
    // 識別キー不変のため PATCH 経路。
    clickSave();

    expect(mockPatchMutate).toHaveBeenCalledTimes(1);
    const [payload] = mockPatchMutate.mock.calls[0];
    // CHANGE-043: presence-detection 下では null=NULL クリア(旧 "" センチネルを置換)。
    expect(payload.situation).toBe(null);
  });

  // =========================================================================
  // ★★M29-02 §2.4: 編集モードの仮登録トグルが保存されること。
  //
  // 着手前、buildPatchPayload は isDraft を送らず、hasKeyChanges も isDraft を
  // 見ていなかった(= PUT にも回らない)。サーバは IsDraft == nil を「不変更」として
  // 扱うため、★トグルを切り替えて保存すると「保存しました」が出て詳細画面へ
  // 遷移するのに is_draft は 1 ビットも変わらなかった。
  //
  // ★★これは「成功の自動断定」である。動作は正常に見え、テストも型検査も緑のまま
  // 通っていた —— 送っていない値のことは、誰も何も言わないからである。
  // =========================================================================
  it("★(M29-02) edit で仮登録トグルを外すと PATCH payload に isDraft: false が載る", () => {
    render(
      <ComboEditor
        mode="edit"
        initial={{ ...editInitial(), isDraft: true }}
      />,
      { wrapper: createWrapper() },
    );

    // 前提: 仮登録として開いている。
    // ★Radix Switch はボタンである(input ではない)。状態は aria-checked に出る。
    const toggle = screen.getByTestId("combo-editor-draft-checkbox");
    expect(toggle.getAttribute("aria-checked")).toBe("true");

    // 本登録へ切り替えて保存する。
    fireEvent.click(toggle);
    clickSave();

    expect(mockPatchMutate).toHaveBeenCalledTimes(1);
    const [payload] = mockPatchMutate.mock.calls[0];
    // ★★ここが本テストの核心。載っていなければサーバは何も更新しない。
    expect(payload.isDraft).toBe(false);
  });

  it("★(M29-02) edit で仮登録へ戻すと PATCH payload に isDraft: true が載る", () => {
    // ★逆方向(本登録 → 仮登録)も同じ経路で黙っていた。片方だけ直さない。
    render(
      <ComboEditor mode="edit" initial={{ ...editInitial(), isDraft: false }} />,
      { wrapper: createWrapper() },
    );

    const toggle = screen.getByTestId("combo-editor-draft-checkbox");
    expect(toggle.getAttribute("aria-checked")).toBe("false");

    fireEvent.click(toggle);
    clickSave();

    expect(mockPatchMutate).toHaveBeenCalledTimes(1);
    const [payload] = mockPatchMutate.mock.calls[0];
    expect(payload.isDraft).toBe(true);
  });

  it("★(M29-02) トグルを触らなければ元の値がそのまま載る(勝手に変えない)", () => {
    render(
      <ComboEditor mode="edit" initial={{ ...editInitial(), isDraft: true }} />,
      { wrapper: createWrapper() },
    );
    clickSave();

    expect(mockPatchMutate).toHaveBeenCalledTimes(1);
    const [payload] = mockPatchMutate.mock.calls[0];
    expect(payload.isDraft).toBe(true);
  });
});

describe("M10-01 キャラクター選択化 / 切替挙動(CHANGE-036)", () => {
  it("初期状態(入力なし)はキャラ変更で確認ダイアログを出さず即時切替する", () => {
    render(<ComboEditor mode="new" />, { wrapper: createWrapper() });
    expect(screen.getByTestId("char-current").textContent).toBe("1");

    fireEvent.click(screen.getByTestId("char-change"));

    expect(screen.queryByTestId("char-confirm")).toBeNull();
    expect(screen.getByTestId("char-current").textContent).toBe("3");
  });

  it("キャラ切替で useMovesByCharacter が新 characterId で再取得される", () => {
    render(<ComboEditor mode="new" />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByTestId("char-change"));

    expect(mockMovesByCharacter).toHaveBeenCalledWith(3);
    expect(screen.getByTestId("recipe-character-id").textContent).toBe("3");
  });

  it("dirty(レシピ入力あり)時のキャラ変更で確認ダイアログが発火する", () => {
    render(<ComboEditor mode="new" />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByTestId("recipe-add-step"));
    expect(screen.getByTestId("recipe-steps-count").textContent).toBe("1");

    fireEvent.click(screen.getByTestId("char-change"));

    expect(screen.getByTestId("char-confirm")).toBeDefined();
    // ダイアログ確定前は選択キャラは変更前のまま
    expect(screen.getByTestId("char-current").textContent).toBe("1");
  });

  it("メタデータのみ入力(damage)でも dirty 判定されダイアログが発火する", () => {
    render(<ComboEditor mode="new" />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByTestId("basic-set-damage"));
    expect(screen.getByTestId("basic-damage").textContent).toBe("300");

    fireEvent.click(screen.getByTestId("char-change"));

    expect(screen.getByTestId("char-confirm")).toBeDefined();
    expect(screen.getByTestId("char-current").textContent).toBe("1");
  });

  it("「変更して入力を破棄」でキャラが切替わり全フォーム(レシピ/セットプレイ/メタデータ)がリセットされる", () => {
    render(<ComboEditor mode="new" />, { wrapper: createWrapper() });
    // レシピ・メタデータ・束ねセットプレイ・既存セットプレイ紐付けを一通り入力
    fireEvent.click(screen.getByTestId("recipe-add-step"));
    fireEvent.click(screen.getByTestId("basic-set-damage"));
    fireEvent.click(screen.getByTestId("setup-add"));
    fireEvent.click(screen.getByTestId("linked-add"));
    expect(screen.getByTestId("recipe-steps-count").textContent).toBe("1");
    expect(screen.getByTestId("basic-damage").textContent).toBe("300");
    expect(screen.getByTestId("setups-count").textContent).toBe("1");
    expect(screen.getByTestId("linked-count").textContent).toBe("1");

    fireEvent.click(screen.getByTestId("char-change"));
    fireEvent.click(screen.getByTestId("char-confirm-discard"));

    expect(screen.queryByTestId("char-confirm")).toBeNull();
    expect(screen.getByTestId("char-current").textContent).toBe("3");
    // §5.1: steps だけでなく setups / linkedSetups / メタデータも初期化されること
    expect(screen.getByTestId("recipe-steps-count").textContent).toBe("0");
    expect(screen.getByTestId("basic-damage").textContent).toBe("");
    expect(screen.getByTestId("setups-count").textContent).toBe("0");
    expect(screen.getByTestId("linked-count").textContent).toBe("0");
  });

  it("「キャンセル」でキャラ選択が変更前へ戻り入力内容が保持される", () => {
    render(<ComboEditor mode="new" />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByTestId("recipe-add-step"));
    fireEvent.click(screen.getByTestId("char-change"));

    fireEvent.click(screen.getByTestId("char-confirm-cancel"));

    expect(screen.queryByTestId("char-confirm")).toBeNull();
    expect(screen.getByTestId("char-current").textContent).toBe("1");
    expect(screen.getByTestId("recipe-steps-count").textContent).toBe("1");
  });

  // ★M23-09: 保存押下と登録要求の間に保存前の重複チェックが 1 段入った(§4.2-1)。
  //   ⇒ 押下直後に同期で数えると常に 0 件になる。待つ形へ改めるが、主張は変えていない。
  it("選択した characterId が CreateRequest.characterId に乗って送信される", async () => {
    render(<ComboEditor mode="new" />, { wrapper: createWrapper() });
    // 入力なしのうちにキャラを 3 へ切替(無確認)→ レシピを追加して保存
    fireEvent.click(screen.getByTestId("char-change"));
    fireEvent.click(screen.getByTestId("recipe-add-step"));

    clickSave();

    await waitFor(() => expect(mockCreateMutate).toHaveBeenCalledTimes(1));
    const [payload] = mockCreateMutate.mock.calls[0];
    expect(payload.characterId).toBe(3);
  });
});

describe("M10-02 新規モードの既定キャラ文脈追従(initialCharacterId)", () => {
  it("initialCharacterId 指定時、新規モードの既定キャラがその値になる", () => {
    render(<ComboEditor mode="new" initialCharacterId={5} />, {
      wrapper: createWrapper(),
    });
    expect(screen.getByTestId("char-current").textContent).toBe("5");
    expect(mockMovesByCharacter).toHaveBeenCalledWith(5);
  });

  it("initialCharacterId 不在時は既定キャラ解決の段 4(= 1)へ落ちる(後方互換)", () => {
    render(<ComboEditor mode="new" />, { wrapper: createWrapper() });
    expect(screen.getByTestId("char-current").textContent).toBe("1");
  });

  it("編集モードでは initialCharacterId が無視され initial.characterId が優先される", () => {
    render(
      <ComboEditor
        mode="edit"
        initialCharacterId={5}
        initial={{
          id: 1,
          characterId: 2,
          isDraft: false,
          affectedByGameUpdate: false,
          affectedMoves: [],
          stepCount: 0,
          version: 1,
          createdAt: "",
          updatedAt: "",
          steps: [],
          tags: [],
          setups: [],
          defaultRecipe: "",
          starterMoveCode: "",
        }}
      />,
      { wrapper: createWrapper() },
    );
    expect(screen.getByTestId("char-current").textContent).toBe("2");
  });
});

describe("C-1: PATCH 保存で暗黙引き継ぎトーストが表示されない", () => {
  it("setup 紐付き済みコンボのメタデータのみ変更で navigate に topMessage が含まれない", () => {
    render(
      <ComboEditor
        mode="edit"
        initial={{
          id: 42,
          characterId: 1,
          isDraft: true,
          affectedByGameUpdate: false,
          affectedMoves: [],
          stepCount: 1,
          version: 1,
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
          // ★M24-13: レシピ 0 本では保存ボタンが押せない。見たいのはトーストの有無である。
          steps: [{ id: 1, stepOrder: 1, moveId: 5 }],
          tags: [],
          defaultRecipe: "",
          starterMoveCode: "",
          setups: [
            { id: 10, characterId: 1, name: "setup1", stepCount: 1, version: 1, defaultRecipe: "", parentComboIds: [42] },
          ],
        }}
      />,
      { wrapper: createWrapper() },
    );

    // ★★M27-02b: ここは clickSave() を使わない。
    //   ★理由は 2 つある——(1) 本ケースは isDraft:true であり必須欄が掛からない、
    //     (2) 必須欄のうち有利フレームを埋めると、紐付き setup が在るコンボでは
    //     M4-03 の「起き攻め引き継ぎ」モーダルが開いて保存まで進まない。
    //   ⇒ 見たいのはトーストの有無であり、KA の変更ではない。
    fireEvent.click(screen.getByText("保存"));

    expect(mockPatchMutate).toHaveBeenCalledTimes(1);

    const [, options] = mockPatchMutate.mock.calls[0];
    act(() => {
      options.onSuccess({
        id: 42,
        characterId: 1,
        isDraft: true,
        stepCount: 0,
        version: 2,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
        tags: [],
        defaultRecipe: "",
        starterMoveCode: "",
      });
    });

    expectNavigatedTo(mockNavigate, "/combos/42");
    // ★こちらは「遷移先」ではなく「state に topMessage を載せていないこと」を見ている。
    //   引数の形そのものが主張なので、この 1 件は元の形のまま残す。
    expect(mockNavigate).not.toHaveBeenCalledWith(
      "/combos/42",
      expect.objectContaining({
        state: expect.objectContaining({
          topMessage: expect.anything(),
        }),
      }),
    );
  });
});

describe("M17-01 メディア 3 フィールド round-trip", () => {
  const editInitial = (media: {
    link?: string;
    videoPath?: string;
    imagePath?: string;
  }) => ({
    id: 1,
    characterId: 1,
    isDraft: true,
    affectedByGameUpdate: false,
    affectedMoves: [],
    stepCount: 1,
    version: 1,
    createdAt: "",
    updatedAt: "",
    // ★★M24-13: 「仮登録なら recipe 必須を回避できる」は撤回された
    //   (VAL-C09 を仮登録でも適用した)。⇒ 最小のレシピを持たせて PATCH まで到達させる。
    steps: [{ id: 1, stepOrder: 1, moveId: 5 }],
    tags: [],
    setups: [],
    defaultRecipe: "",
    starterMoveCode: "",
    ...media,
  });

  it("edit で既存メディア 3 フィールドがフォーム状態へ復元される(hydration)", () => {
    render(
      <ComboEditor
        mode="edit"
        initial={editInitial({
          link: "https://example.com/guide",
          videoPath: "videos/ryu-bnb.mp4",
          imagePath: "images/ryu-bnb.png",
        })}
      />,
      { wrapper: createWrapper() },
    );
    expect(screen.getByTestId("basic-link").textContent).toBe(
      "https://example.com/guide",
    );
    expect(screen.getByTestId("basic-video-path").textContent).toBe(
      "videos/ryu-bnb.mp4",
    );
    expect(screen.getByTestId("basic-image-path").textContent).toBe(
      "images/ryu-bnb.png",
    );
  });

  it("link 入力→保存で PATCH payload に link が乗る(他 2 フィールドは既存値を送る)", () => {
    render(
      <ComboEditor
        mode="edit"
        initial={editInitial({ videoPath: "videos/a.mp4" })}
      />,
      { wrapper: createWrapper() },
    );
    fireEvent.click(screen.getByTestId("basic-set-link"));
    clickSave();

    expect(mockPatchMutate).toHaveBeenCalledTimes(1);
    const [payload] = mockPatchMutate.mock.calls[0];
    expect(payload.link).toBe("https://example.com/guide");
    expect(payload.videoPath).toBe("videos/a.mp4");
    // 未入力(imagePath)は null 送信(トライステート: null=NULL クリア。元々 NULL のため実質不変)。
    expect(payload.imagePath).toBe(null);
  });

  it("空入力での保存は PATCH payload.link が null(NULL クリア・CHANGE-043)", () => {
    render(
      <ComboEditor
        mode="edit"
        initial={editInitial({ link: "https://example.com/old" })}
      />,
      { wrapper: createWrapper() },
    );
    // 前提: 既存値が復元されている。
    expect(screen.getByTestId("basic-link").textContent).toBe(
      "https://example.com/old",
    );
    fireEvent.click(screen.getByTestId("basic-clear-link"));
    clickSave();

    expect(mockPatchMutate).toHaveBeenCalledTimes(1);
    const [payload] = mockPatchMutate.mock.calls[0];
    expect(payload.link).toBe(null);
  });
});

describe("M18-03c 確定反撃サーチからの登録", () => {
  const createdCombo = {
    id: 321,
    characterId: 1,
    isDraft: false,
    stepCount: 1,
    version: 1,
    createdAt: "2026-07-28T00:00:00Z",
    updatedAt: "2026-07-28T00:00:00Z",
    tags: [],
    defaultRecipe: "弱P",
    starterMoveCode: "standing_light_punch",
  };

  it("hit_type をプリフィルし、保存後に既存 combo-punishes API へ紐づけて戻る", async () => {
    mockLocationState = {
      punishReturn: "/punish/search?self=1&opp=2&guard=just_parry",
      punishContext: { opponentLabel: "波動拳" },
      punishSelfCharacterId: 1,
      opponentMoveId: 20,
      hitType: "just_parry_punish_counter",
    };
    mockAddPunishMutateAsync.mockResolvedValue(undefined);
    render(<ComboEditor mode="new" />, { wrapper: createWrapper() });

    expect(screen.getByTestId("basic-hit-type").textContent).toBe(
      "just_parry_punish_counter",
    );
    expect(screen.queryByTestId("char-change")).toBeNull();
    expect(screen.getByTestId("char-locked-reason").textContent).toBe(
      "確定反撃サーチからの登録では変更不可",
    );
    expect(
      screen.getByTestId("basic-hit-type-locked-reason").textContent,
    ).toBe("確定反撃サーチからの登録では変更不可");
    fireEvent.click(screen.getByTestId("recipe-add-step"));
    clickSave();
    // ★M23-09: 保存前チェックが挟まるため、登録要求が飛ぶまで待つ(主張は不変)。
    await waitFor(() => expect(mockCreateMutate).toHaveBeenCalled());
    const [, options] = mockCreateMutate.mock.calls[0];
    await act(async () => {
      await options.onSuccess(createdCombo);
    });

    expect(mockAddPunishMutateAsync).toHaveBeenCalledWith({
      comboId: 321,
      opponentMoveId: 20,
    });
    expectNavigatedTo(
      mockNavigate,
      "/punish/search?self=1&opp=2&guard=just_parry",
    );
  });

  it("紐づけ失敗時は作成済みコンボを削除せず詳細へ退避する", async () => {
    mockLocationState = {
      punishReturn: "/punish/search?self=1&opp=2&guard=block",
      punishContext: { opponentLabel: "波動拳" },
      punishSelfCharacterId: 1,
      opponentMoveId: 20,
      hitType: "punish_counter",
    };
    mockAddPunishMutateAsync.mockRejectedValue(new Error("link failed"));
    render(<ComboEditor mode="new" />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByTestId("recipe-add-step"));
    clickSave();
    // ★M23-09: 保存前チェックが挟まるため、登録要求が飛ぶまで待つ(主張は不変)。
    await waitFor(() => expect(mockCreateMutate).toHaveBeenCalled());
    const [, options] = mockCreateMutate.mock.calls[0];
    await act(async () => {
      await options.onSuccess(createdCombo);
    });

    expect(mockAddPunishMutateAsync).toHaveBeenCalledTimes(1);
    expectNavigatedTo(mockNavigate, "/combos/321");
    expectNotNavigatedTo(
      mockNavigate,
      "/punish/search?self=1&opp=2&guard=block",
    );
  });

  it("未知の hit_type はプリフィルしない(新規の既定へ落ちる)", () => {
    mockLocationState = {
      punishSelfCharacterId: 1,
      opponentMoveId: 20,
      hitType: "unknown_hit_type",
    };
    render(<ComboEditor mode="new" />, { wrapper: createWrapper() });
    // ★★M38-01(射程 5): 落ち先が "" から「新規の既定」= "normal" へ変わった。
    //   ★見ているものは変わっていない —— **未知の値をそのまま入れない**ことである。
    //   ★以下は失効した記述: `toBe("")`(= 値域外の「不問」が既定だった時代)。
    expect(screen.getByTestId("basic-hit-type").textContent).toBe(
      HIT_TYPE_NORMAL,
    );
  });

  it("成立ツリー経由はコンボ保存だけを行い、確定反撃へ自動採用しない", async () => {
    mockLocationState = {
      punishReturn: "/punish/search?self=1&opp=2&guard=block",
      punishContext: { opponentLabel: "強P", starterLabel: "立ち弱P" },
      punishSelfCharacterId: 1,
      hitType: "punish_counter",
    };
    render(<ComboEditor mode="new" />, { wrapper: createWrapper() });

    expect(screen.getByTestId("basic-hit-type").textContent).toBe(
      "punish_counter",
    );
    expect(screen.queryByTestId("char-change")).toBeNull();
    expect(screen.getByTestId("char-locked-reason").textContent).toBe(
      "確定反撃サーチからの登録では変更不可",
    );
    expect(
      screen.getByTestId("basic-hit-type-locked-reason").textContent,
    ).toBe("確定反撃サーチからの登録では変更不可");
    fireEvent.click(screen.getByTestId("recipe-add-step"));
    clickSave();
    // ★M23-09: 保存前チェックが挟まるため、登録要求が飛ぶまで待つ(主張は不変)。
    await waitFor(() => expect(mockCreateMutate).toHaveBeenCalled());
    const [, options] = mockCreateMutate.mock.calls[0];
    await act(async () => {
      await options.onSuccess(createdCombo);
    });

    expect(mockAddPunishMutateAsync).not.toHaveBeenCalled();
    expectNavigatedTo(
      mockNavigate,
      "/punish/search?self=1&opp=2&guard=block",
    );
  });

  it("保存結果のキャラが検索条件と異なる場合は紐づけず詳細へ退避する", async () => {
    mockLocationState = {
      punishReturn: "/punish/search?self=1&opp=2&guard=block",
      punishContext: { opponentLabel: "波動拳" },
      punishSelfCharacterId: 1,
      opponentMoveId: 20,
      hitType: "punish_counter",
    };
    render(<ComboEditor mode="new" />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByTestId("recipe-add-step"));
    clickSave();
    // ★M23-09: 保存前チェックが挟まるため、登録要求が飛ぶまで待つ(主張は不変)。
    await waitFor(() => expect(mockCreateMutate).toHaveBeenCalled());
    const [, options] = mockCreateMutate.mock.calls[0];
    await act(async () => {
      await options.onSuccess({ ...createdCombo, characterId: 3 });
    });

    expect(mockAddPunishMutateAsync).not.toHaveBeenCalled();
    expectNavigatedTo(mockNavigate, "/combos/321");
  });
});

// ===========================================================================
// M22-03 §5.1-7: PATCH ペイロードの version が既定値ではなく実際の版であること
// ===========================================================================
//
// ★旧実装は `initial?.version ?? 0` を送っていた。combos.version は
// NOT NULL DEFAULT 1 で 0 の行は生成経路が無いため、0 が乗ると必ず版不一致になる。
// 既定値を 1 等へ差し替えるのは「必ず失敗する」を「静かに他人の編集を上書きしうる」
// に変えるだけで悪化である。⇒ 既定値そのものを置かない形へ直した。
describe("M22-03 PATCH payload の version", () => {
  const editInitial = (version: number) => ({
    id: 1,
    characterId: 1,
    isDraft: true,
    affectedByGameUpdate: false,
    affectedMoves: [],
    stepCount: 1,
    version,
    createdAt: "",
    updatedAt: "",
    // ★★M24-13: 「仮登録なら recipe 必須を回避できる」は撤回された
    //   (VAL-C09 を仮登録でも適用した)。⇒ 最小のレシピを持たせて PATCH まで到達させる。
    steps: [{ id: 1, stepOrder: 1, moveId: 5 }],
    tags: [],
    setups: [],
    defaultRecipe: "",
    starterMoveCode: "",
  });

  it("編集モードの PATCH は initial.version をそのまま載せる(既定値 0 を送らない)", () => {
    render(<ComboEditor mode="edit" initial={editInitial(7)} />, {
      wrapper: createWrapper(),
    });
    clickSave();

    expect(mockPatchMutate).toHaveBeenCalledTimes(1);
    const [payload] = mockPatchMutate.mock.calls[0];
    expect(payload.version).toBe(7);
  });

  // ★対照実験。版が 1 のときも「たまたま既定値と一致した」のではなく
  // initial 由来の値が乗っていることを、別の版で 2 度確かめる。
  it("別の版でも initial.version が追従する", () => {
    render(<ComboEditor mode="edit" initial={editInitial(42)} />, {
      wrapper: createWrapper(),
    });
    clickSave();

    const [payload] = mockPatchMutate.mock.calls[0];
    expect(payload.version).toBe(42);
    // 既定値のいずれとも一致しないことを明示(0 も 1 も出てこない)。
    expect(payload.version).not.toBe(0);
    expect(payload.version).not.toBe(1);
  });
});

// ── M24-01 §4.4(SM-084): 新規登録の保存後の遷移先 ──────────────────────────
describe("M24-01 SM-084 保存後の遷移先", () => {
  const savedCombo = (characterId: number) => ({
    id: 777,
    characterId,
    isDraft: false,
    affectedByGameUpdate: false,
    affectedMoves: [],
    stepCount: 1,
    version: 1,
    createdAt: "2026-08-25T00:00:00Z",
    updatedAt: "2026-08-25T00:00:00Z",
    tags: [],
    defaultRecipe: "弱P",
    starterMoveCode: "standing_light_punch",
  });

  it("新規登録は一覧へ戻り、いま保存したコンボのキャラが対象のままである", async () => {
    mockLocationState = null;
    render(<ComboEditor mode="new" initialCharacterId={3} />, {
      wrapper: createWrapper(),
    });
    fireEvent.click(screen.getByTestId("recipe-add-step"));
    clickSave();
    await waitFor(() => expect(mockCreateMutate).toHaveBeenCalled());
    const [, options] = mockCreateMutate.mock.calls[0];
    await act(async () => {
      await options.onSuccess(savedCombo(3));
    });

    // ★遷移先が一覧であることと、対象キャラが保たれていることの両方を主張する。
    //   段 1(URL クエリ)で保つ形なので、クエリに現れなければ保たれていない。
    expectNavigatedTo(mockNavigate, "/combos?character_id=3");
    expectNotNavigatedTo(mockNavigate, "/combos/777");
  });

  it("対照: 編集の遷移先は詳細のままで変えていない", () => {
    mockLocationState = null;
    mockPatchMutate.mockClear();
    render(
      <ComboEditor
        mode="edit"
        initial={{
          id: 777,
          characterId: 3,
          isDraft: true,
          affectedByGameUpdate: false,
          affectedMoves: [],
          stepCount: 1,
          version: 1,
          createdAt: "",
          updatedAt: "",
          // ★M24-13: レシピ 0 本では保存ボタンが押せない。見たいのは遷移先である。
          steps: [{ id: 1, stepOrder: 1, moveId: 5 }],
          tags: [],
          setups: [],
          defaultRecipe: "",
          starterMoveCode: "",
        }}
      />,
      { wrapper: createWrapper() },
    );
    clickSave();
    const [, options] = mockPatchMutate.mock.calls[0];
    act(() => {
      options.onSuccess(savedCombo(3));
    });

    expectNavigatedTo(mockNavigate, "/combos/777");
    expectNotNavigatedTo(mockNavigate, "/combos?character_id=3");
  });

  it("確定反撃サーチからの戻り先は一覧より優先される(既存の挙動を変えていない)", async () => {
    mockLocationState = {
      punishReturn: "/punish/search?self=1&opp=2&guard=block",
      punishContext: { opponentLabel: "波動拳" },
      punishSelfCharacterId: 1,
      hitType: "punish_counter",
    };
    render(<ComboEditor mode="new" />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByTestId("recipe-add-step"));
    clickSave();
    await waitFor(() => expect(mockCreateMutate).toHaveBeenCalled());
    const [, options] = mockCreateMutate.mock.calls[0];
    await act(async () => {
      await options.onSuccess(savedCombo(1));
    });

    expectNavigatedTo(
      mockNavigate,
      "/punish/search?self=1&opp=2&guard=block",
    );
  });
});

// ── M24-01 レビュー 中-2: キャラ一覧が遅れて届く経路 ─────────────────────
//
// ★遅延初期化子で 1 回だけ読む形だと、段 3b の実在検査が本画面では永久に効かない
//   (キャラ一覧は App.tsx のゲートに入っておらず、初回描画時点で未取得のため
//   実在検査がスキップされる)。一覧・マイコンボは毎描画で解決し直すため自己修復するが、
//   本画面は修復しない。⇒ 採り直しの useEffect を置いた。ここはそれが効くことの固定である。
describe("M24-01 中-2 既定キャラの採り直し(キャラ一覧が遅れて届く)", () => {
  it("解決値が後から変わったら、利用者が触れていない限り初期キャラを採り直す", () => {
    mockLocationState = null;
    mockResolvedCharacterId.mockReturnValue(99); // 実在検査がまだ効かない段階
    const view = render(<ComboEditor mode="new" />, { wrapper: createWrapper() });
    expect(screen.getByTestId("char-current").textContent).toBe("99");

    // キャラ一覧が届き、99 が実在しないと分かって段 4 へ落ちた。
    mockResolvedCharacterId.mockReturnValue(1);
    view.rerender(<ComboEditor mode="new" />);
    expect(screen.getByTestId("char-current").textContent).toBe("1");
  });

  it("★利用者がキャラを選び直したあとは採り直さない", () => {
    mockLocationState = null;
    mockResolvedCharacterId.mockReturnValue(99);
    const view = render(<ComboEditor mode="new" />, { wrapper: createWrapper() });

    // 利用者が 3 を選ぶ(未入力なので確認ダイアログは出ない)。
    fireEvent.click(screen.getByTestId("char-change"));
    expect(screen.getByTestId("char-current").textContent).toBe("3");

    mockResolvedCharacterId.mockReturnValue(1);
    view.rerender(<ComboEditor mode="new" />);
    expect(
      screen.getByTestId("char-current").textContent,
      "利用者の選択を解決順が上書きしている",
    ).toBe("3");
  });

  it("★段 1(?character= の文脈)が在るときは採り直さない", () => {
    mockLocationState = null;
    mockResolvedCharacterId.mockReturnValue(5);
    const view = render(<ComboEditor mode="new" initialCharacterId={5} />, {
      wrapper: createWrapper(),
    });
    expect(screen.getByTestId("char-current").textContent).toBe("5");

    mockResolvedCharacterId.mockReturnValue(1);
    view.rerender(<ComboEditor mode="new" initialCharacterId={5} />);
    expect(screen.getByTestId("char-current").textContent).toBe("5");
  });

  it("★編集モードでは採り直さない(initial.characterId が正である)", () => {
    mockLocationState = null;
    mockResolvedCharacterId.mockReturnValue(99);
    const editInitial = {
      id: 1,
      characterId: 2,
      isDraft: true,
      affectedByGameUpdate: false,
      affectedMoves: [],
      stepCount: 0,
      version: 1,
      createdAt: "",
      updatedAt: "",
      steps: [],
      tags: [],
      setups: [],
      defaultRecipe: "",
      starterMoveCode: "",
    };
    const view = render(<ComboEditor mode="edit" initial={editInitial} />, {
      wrapper: createWrapper(),
    });
    expect(screen.getByTestId("char-current").textContent).toBe("2");

    mockResolvedCharacterId.mockReturnValue(1);
    view.rerender(<ComboEditor mode="edit" initial={editInitial} />);
    expect(screen.getByTestId("char-current").textContent).toBe("2");
  });
});

// ★★M24-04(CO-003): 未保存のまま離れようとしたら確認する。
//   ここは「保存の成功で dirty が落ちること」を守る唯一の機械的な網である
//   ——落ちないと、保存直後の遷移で毎回確認が出て機能そのものが邪魔になる。
describe("M24-04 CO-003 未保存の変更の確認", () => {
  const savedCombo = {
    id: 900,
    characterId: 1,
    isDraft: false,
    affectedByGameUpdate: false,
    affectedMoves: [],
    stepCount: 1,
    version: 1,
    createdAt: "2026-08-27T00:00:00Z",
    updatedAt: "2026-08-27T00:00:00Z",
    tags: [],
    defaultRecipe: "弱P",
    starterMoveCode: "standing_light_punch",
  };

  it("入力が無ければキャンセルは確認なしで遷移する(触っただけで止めない)", () => {
    mockLocationState = null;
    mockNavigate.mockClear();
    render(<ComboEditor mode="new" />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByText("← キャンセル"));

    expect(screen.queryByTestId("unsaved-changes-dialog")).toBeNull();
    expect(mockNavigate).toHaveBeenCalled();
  });

  it("入力があるとキャンセルで確認が出て、遷移は止まる", () => {
    mockLocationState = null;
    mockNavigate.mockClear();
    render(<ComboEditor mode="new" />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByTestId("recipe-add-step"));
    fireEvent.click(screen.getByText("← キャンセル"));

    expect(screen.getByTestId("unsaved-changes-dialog")).toBeTruthy();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("★保存が成功すると dirty が落ち、そのあとの遷移で確認が出ない", async () => {
    mockLocationState = null;
    mockNavigate.mockClear();
    mockCreateMutate.mockClear();
    render(<ComboEditor mode="new" />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByTestId("recipe-add-step"));
    clickSave();
    await waitFor(() => expect(mockCreateMutate).toHaveBeenCalled());
    const [, options] = mockCreateMutate.mock.calls[0];
    await act(async () => {
      await options.onSuccess(savedCombo);
    });
    mockNavigate.mockClear();

    fireEvent.click(screen.getByText("← キャンセル"));

    expect(screen.queryByTestId("unsaved-changes-dialog")).toBeNull();
    expect(mockNavigate).toHaveBeenCalled();
  });

  it("保存のあとにさらに入力すると、また確認が出る", async () => {
    mockLocationState = null;
    mockNavigate.mockClear();
    mockCreateMutate.mockClear();
    render(<ComboEditor mode="new" />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByTestId("recipe-add-step"));
    clickSave();
    await waitFor(() => expect(mockCreateMutate).toHaveBeenCalled());
    const [, options] = mockCreateMutate.mock.calls[0];
    await act(async () => {
      await options.onSuccess(savedCombo);
    });
    mockNavigate.mockClear();

    // ★レシピ追加は使わない——モックの add step は常に同じ 1 ステップを入れるため、
    //   2 回目の押下では値が変わらず「変更なし」が正しい。別の欄を動かす。
    fireEvent.click(screen.getByTestId("combo-editor-draft-checkbox"));
    fireEvent.click(screen.getByText("← キャンセル"));

    expect(screen.getByTestId("unsaved-changes-dialog")).toBeTruthy();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

// ★★M24-04(SM-148 / SM-093): 入力面のタブ分けと、状態の既定。
describe("M24-04 SM-148 タブとエラーの在り処", () => {
  it("タブは「基本情報」「レシピ」の 2 枚である(3 つ以上に割らない)", () => {
    mockLocationState = null;
    render(<ComboEditor mode="new" />, { wrapper: createWrapper() });
    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(screen.getByTestId("combo-editor-tab-basic")).toBeTruthy();
    expect(screen.getByTestId("combo-editor-tab-recipe")).toBeTruthy();
  });

  it("タブを切り替えても両方の入力は DOM に残る(切替で入力が消えない)", () => {
    mockLocationState = null;
    render(<ComboEditor mode="new" />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByTestId("basic-set-damage"));
    fireEvent.click(screen.getByTestId("recipe-add-step"));

    fireEvent.click(screen.getByTestId("combo-editor-tab-recipe"));
    fireEvent.click(screen.getByTestId("combo-editor-tab-basic"));

    // ★どちらのタブの入力も残っている——出し分けは CSS で行い、アンマウントしない。
    expect(screen.getByTestId("basic-damage").textContent).toBe("300");
    expect(screen.getByTestId("recipe-steps-count").textContent).toBe("1");
  });

  it("★★エラーが「今見ていないタブ」に在ることが見出しから分かる", () => {
    mockLocationState = null;
    render(<ComboEditor mode="new" />, { wrapper: createWrapper() });

    // ★M24-13: レシピ 0 件では保存ボタンが押せなくなった(VAL-C09 を仮登録へ適用した)。
    //   ⇒ 見たいものは変わらない——「レシピタブ側で落ちたエラーが見出しから分かる」。
    //   ステップを 1 本置き、そのステップ自身が不正な状態を作る。
    fireEvent.click(screen.getByTestId("recipe-add-invalid-step"));
    clickSave();

    expect(
      screen.getByTestId("combo-editor-tab-errors-recipe").textContent,
    ).toBe("1");
    // ★基本情報側には出さない(どこを直せばよいか分からなくなる)。
    expect(screen.queryByTestId("combo-editor-tab-errors-basic")).toBeNull();
  });

  it("エラーが無いあいだは件数を出さない", () => {
    mockLocationState = null;
    render(<ComboEditor mode="new" />, { wrapper: createWrapper() });
    expect(screen.queryByTestId("combo-editor-tab-errors-recipe")).toBeNull();
    expect(screen.queryByTestId("combo-editor-tab-errors-basic")).toBeNull();
  });

  // ★★M24-12: 「メタデータを隠す」トグル(SM-118)は撤去した。役割が消えたためである
  //   ——タブに分けた時点でレシピタブは全幅であり、SM-118 の要求
  //   「隠したぶん、もう一方が広がってほしい」はタブそのものが満たす。
  //   ★削除ではなく置換である。トグルが担っていた保証(片方を隠しても他方の入力は
  //     生きている)は、タブの出し分けが同じ形で担う。
  it("★M24-12: 「メタデータを隠す」トグルは無い(タブが役割を引き継いだ)", () => {
    mockLocationState = null;
    render(<ComboEditor mode="new" />, { wrapper: createWrapper() });
    expect(screen.queryByTestId("combo-editor-metadata-toggle")).toBeNull();
  });

  // ★★M24-12(破壊確認 1 で判明した穴を塞ぐ): 「タブ切替でアンマウントしない」は
  //   **どのテストも守っていなかった**。フォーム state が ComboEditor へリフトアップ
  //   されているため、子をアンマウントしても親から再描画されて値が消えず、
  //   「入力が消えない」系のテストは条件付きレンダリングでも緑のままだった
  //   （E2E 17 件を含めて 1 件も赤くならないことを実測）。
  //
  //   ★★しかし機構としては「1 つの DOM を CSS で出し分ける」ことが契約である
  //     （DES-005 §5.7 / CHANGE-138 §2.5-5。⇒ 切替で入力が**原理的に**消えない）。
  //     アンマウントすると、リフトアップされていない状態——セクションの開閉、
  //     仮想コントローラの選択中カテゴリ、フォーカス、順送りの停止点の DOM——が
  //     切り替えのたびに失われる。
  //   ⇒ 機構そのものを直接押さえる: **見えていない側のタブの中身も DOM に在る**。
  it("★★M24-12: 見えていないタブの中身も DOM に在る(CSS で出し分けており、アンマウントしない)", () => {
    mockLocationState = null;
    render(<ComboEditor mode="new" />, { wrapper: createWrapper() });

    // 既定は基本情報タブ。★レシピ側は見えていないが、中身は DOM に在る。
    expect(screen.getByTestId("combo-editor-panel-recipe").className).toMatch(
      /\bhidden\b/,
    );
    expect(
      screen.queryByTestId("recipe-builder"),
      "★レシピタブの中身がアンマウントされている(条件付きレンダリングになっていないか)",
    ).not.toBeNull();

    // レシピタブへ切り替えると、今度は基本情報側が隠れるが中身は残る。
    fireEvent.click(screen.getByTestId("combo-editor-tab-recipe"));
    expect(screen.getByTestId("combo-editor-panel-basic").className).toMatch(
      /\bhidden\b/,
    );
    expect(
      screen.queryByTestId("basic-fields"),
      "★基本情報タブの中身がアンマウントされている",
    ).not.toBeNull();
  });

  // ★★M24-12: 幅による分岐を消したことの固定。
  //   jsdom は Tailwind のメディアクエリを評価しないため「lg 未満だけ出る」を
  //   直接は観測できない。⇒ 出し分けが activeTab だけで決まること、すなわち
  //   パネルの class に lg: 接頭辞の指定が残っていないことを見る。
  //   ★これが残っていると PC 幅で両方のパネルが同時に見え、タブが意味を失う。
  it("★★M24-12: パネルの出し分けに幅の分岐(lg:)が残っていない", () => {
    mockLocationState = null;
    render(<ComboEditor mode="new" />, { wrapper: createWrapper() });
    const basic = screen.getByTestId("combo-editor-panel-basic");
    const recipe = screen.getByTestId("combo-editor-panel-recipe");
    expect(basic.className).not.toMatch(/\blg:/);
    expect(recipe.className).not.toMatch(/\blg:/);
    // 既定は基本情報タブ。レシピ側は hidden で、activeTab だけがそれを決めている。
    expect(basic.className).not.toMatch(/\bhidden\b/);
    expect(recipe.className).toMatch(/\bhidden\b/);
  });

  // ★★指示書 §4.5 / チェックリスト 1-8。落とすと「重大」である。
  //   保存/キャンセル行は**両パネルの外**に置いてあり、どちらのタブでも押せる。
  //   ⇒ 「レシピタブの下」に見える位置でありながら、基本情報タブからも保存できる。
  it("★★M24-12: どちらのタブに居ても保存できる(保存ボタンはパネルの外)", () => {
    mockLocationState = null;
    render(<ComboEditor mode="new" />, { wrapper: createWrapper() });

    const saveButton = () => screen.getByRole("button", { name: "保存" });

    // ★M24-13: レシピ 0 本では押せない(VAL-C09 を仮登録へ適用した)。
    //   ここで見たいのは「どちらのタブに居ても同じボタンが押せる」ことなので、
    //   まずレシピを 1 本置いて押せる状態にする。★条件はタブに依存しない。
    fireEvent.click(screen.getByTestId("recipe-add-step"));

    // 基本情報タブ(既定)で押せる。
    expect(saveButton()).toBeTruthy();
    expect((saveButton() as HTMLButtonElement).disabled).toBe(false);

    // ★保存ボタンはどちらのタブパネルの中にも入っていない。
    const basic = screen.getByTestId("combo-editor-panel-basic");
    const recipe = screen.getByTestId("combo-editor-panel-recipe");
    expect(basic.contains(saveButton())).toBe(false);
    expect(recipe.contains(saveButton())).toBe(false);

    // レシピタブへ切り替えても同じボタンが押せる。
    fireEvent.click(screen.getByTestId("combo-editor-tab-recipe"));
    expect((saveButton() as HTMLButtonElement).disabled).toBe(false);
  });

  it("★★M24-12: タブ見出しは幅によらず出る(lg:hidden が残っていない)", () => {
    mockLocationState = null;
    render(<ComboEditor mode="new" />, { wrapper: createWrapper() });
    const tablist = screen.getByRole("tablist");
    expect(tablist.className).not.toMatch(/\blg:/);
  });
});

// ===========================================================================
// M24-13 (CHANGE-139): 仮登録もレシピのステップ 1 本以上を要する
// ===========================================================================
//
// ★★保存ボタンは **消さない**。押せなくして理由を出す(D-582)。
//   消すと「なぜ保存できないのか」の情報がゼロになり、M24-12 のキーボード順送りで
//   保存へ到達する経路そのものが消える。
describe("M24-13 レシピ 0 本では保存できない", () => {
  const save = () =>
    screen.getByRole("button", { name: "保存" }) as HTMLButtonElement;
  const reason = () => screen.queryByTestId("combo-editor-save-blocked-reason");

  it("★★レシピ 0 本のとき保存ボタンは押せず、理由が出る(ボタンは消さない)", () => {
    mockLocationState = null;
    render(<ComboEditor mode="new" />, { wrapper: createWrapper() });

    // ★ボタンは在る。消していない。
    expect(save()).toBeTruthy();
    expect(save().disabled).toBe(true);
    expect(reason()).not.toBeNull();
    expect(reason()!.textContent).toBe(SAVE_BLOCKED_EMPTY_RECIPE);
  });

  it("ステップを 1 本足すと押せるようになり、理由は消える", () => {
    mockLocationState = null;
    render(<ComboEditor mode="new" />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByTestId("recipe-add-step"));

    expect(save().disabled).toBe(false);
    expect(reason()).toBeNull();
  });

  // ★★破壊確認 4 の相手。タブ依存の条件を足すと、ここが赤くなる。
  //   タブ条件を足すと「レシピタブへ行けば保存できる」＝ M24-12 §4.5
  //   「どちらのタブに居ても保存できる」が禁じた形そのものになる。
  it("★★条件はタブ依存でない(基本情報タブでもレシピタブでも同じ)", () => {
    mockLocationState = null;
    render(<ComboEditor mode="new" />, { wrapper: createWrapper() });

    // 基本情報タブ(既定)
    expect(save().disabled).toBe(true);
    expect(reason()).not.toBeNull();

    // レシピタブ
    fireEvent.click(screen.getByTestId("combo-editor-tab-recipe"));
    expect(save().disabled).toBe(true);
    expect(reason()).not.toBeNull();

    // 1 本足したあとも、両タブで同じである。
    fireEvent.click(screen.getByTestId("recipe-add-step"));
    expect(save().disabled).toBe(false);
    fireEvent.click(screen.getByTestId("combo-editor-tab-basic"));
    expect(save().disabled).toBe(false);
    expect(reason()).toBeNull();
  });

  // ★仮登録トグルで分岐しない。本登録でも仮登録でも 0 本は保存できない。
  it("★仮登録トグルの状態で変わらない", () => {
    mockLocationState = null;
    render(<ComboEditor mode="new" />, { wrapper: createWrapper() });

    // 既定(本登録)で押せない。
    expect(save().disabled).toBe(true);

    // 仮登録へ切り替えても押せない。
    fireEvent.click(screen.getByTestId("combo-editor-draft-checkbox"));
    expect(save().disabled).toBe(true);
    expect(reason()).not.toBeNull();
  });

  // ★理由は保存ボタンの **直前** に在る(順送りで読める位置)。
  //   `disabled` なボタンはフォーカスを受けないため、ボタン自身に説明を持たせても
  //   キーボードだけでは読めない。⇒ 理由の側を停止点にしてある。
  it("★理由は保存ボタンの直前に在り、フォーカスを受けられる", () => {
    mockLocationState = null;
    render(<ComboEditor mode="new" />, { wrapper: createWrapper() });

    const el = reason()!;
    expect(el.getAttribute("tabindex")).toBe("0");
    // ★保存ボタンから見て前に在る(DOCUMENT_POSITION_PRECEDING = 2)。
    expect(save().compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING).
      toBeTruthy();
    // ★ボタンは理由を指している。
    expect(save().getAttribute("aria-describedby")).toBe(el.id);
  });

  // ★編集モードでも同じである(モードで分岐しない)。
  it("★編集モードでもレシピ 0 本なら押せない", () => {
    mockLocationState = null;
    render(
      <ComboEditor
        mode="edit"
        initial={
          {
            id: 9,
            characterId: 1,
            isDraft: true,
            stepCount: 0,
            version: 1,
            createdAt: "",
            updatedAt: "",
            steps: [],
            tags: [],
            setups: [],
            defaultRecipe: "",
            starterMoveCode: "",
          } as unknown as ComboDetail
        }
      />,
      { wrapper: createWrapper() },
    );
    expect(save().disabled).toBe(true);
    expect(reason()).not.toBeNull();
  });
});

describe("M24-04 SM-093 状態の既定は「不問」", () => {
  it("★新規登録の「相手の状態」は未指定ではなく不問が選ばれている", () => {
    mockLocationState = null;
    render(<ComboEditor mode="new" />, { wrapper: createWrapper() });
    // ★「選ばれて見える」ことは ComboEditorBasicFields のテストが押さえる
    //   (本ファイルでは基本情報の欄をモックしているため値までしか見えない)。
    expect(screen.getByTestId("basic-opponent-stance").textContent).toBe("any");
  });

  it("対照: 編集モードは読み込んだ値をそのまま出す(既存データに触れない)", () => {
    mockLocationState = null;
    render(
      <ComboEditor
        mode="edit"
        initial={{
          id: 1,
          characterId: 1,
          isDraft: false,
          stepCount: 1,
          version: 1,
          createdAt: "",
          updatedAt: "",
          steps: [],
          tags: [],
          setups: [],
          defaultRecipe: "",
          opponentStance: "standing",
        } as unknown as ComboDetail}
      />,
      { wrapper: createWrapper() },
    );
    expect(screen.getByTestId("basic-opponent-stance").textContent).toBe(
      "standing",
    );
  });

  // ★★M24-12(開発者の実 DB 確認・2026-08-29)。
  //   実 DB の 62 件は **すべて `opponent_stance IS NULL`** であり、空文字は 0 件だった。
  //   ⇒ 「M24-04 以前の旧データ」の実際の形は NULL であって空文字ではない。
  //   ★既存テストは BasicFields へ空文字を**直接**渡しており、
  //     `initial.opponentStance ?? ""` の写しを 1 度も踏んでいなかった。
  //     ⇒ ここが抜けると、62 件すべてが「不問」を選んだように見え、
  //       そのまま保存すると NULL が "any" へ化ける(重複判定キーと一覧フィルタが変わる)。
  it("★★NULL の相手の状態は空文字へ写す(実 DB の旧データはすべて NULL)", () => {
    render(
      <ComboEditor
        mode="edit"
        initial={{
          id: 1,
          characterId: 1,
          isDraft: false,
          stepCount: 1,
          version: 1,
          createdAt: "",
          updatedAt: "",
          steps: [],
          tags: [],
          setups: [],
          defaultRecipe: "",
          opponentStance: null,
        } as unknown as ComboDetail}
      />,
      { wrapper: createWrapper() },
    );
    // ★空文字であること。"any"(不問)へ化けていないこと。
    expect(screen.getByTestId("basic-opponent-stance").textContent).toBe("");
  });

  // ★対照: キーそのものが無い応答(omitempty)でも同じ結果になる。
  it("★相手の状態のキーが無い応答でも空文字になる", () => {
    render(
      <ComboEditor
        mode="edit"
        initial={{
          id: 1,
          characterId: 1,
          isDraft: false,
          stepCount: 1,
          version: 1,
          createdAt: "",
          updatedAt: "",
          steps: [],
          tags: [],
          setups: [],
          defaultRecipe: "",
        } as unknown as ComboDetail}
      />,
      { wrapper: createWrapper() },
    );
    expect(screen.getByTestId("basic-opponent-stance").textContent).toBe("");
  });
});

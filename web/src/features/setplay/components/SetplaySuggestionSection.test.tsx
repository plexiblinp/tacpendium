import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SetplaySuggestionSection } from "./SetplaySuggestionSection";
import type { SetplaySuggestionsResponse } from "../types";

const mockUseSuggestions = vi.fn();
vi.mock("../hooks/useSetplaySuggestions", () => ({
  useSetplaySuggestions: (...args: unknown[]) => mockUseSuggestions(...args),
}));

vi.mock("@/features/moves/api", () => ({
  useMovesByCharacter: () => ({
    data: [
      { id: 10, code: "standing_light_kick", category: "normal", nameJa: "立ち弱K" },
      { id: 11, code: "collarbone_breaker", category: "unique", nameJa: "鎖骨割り" },
    ],
  }),
}));

const mockCreate = vi.fn();
vi.mock("@/features/setup/api/setupApi", () => ({
  setupApi: { create: (...a: unknown[]) => mockCreate(...a) },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts && key === "setplay.hitOnActive") return `hit ${opts.n}`;
      if (opts && key === "setplay.gapBeforeWakeup") return `gap ${opts.g}`;
      if (opts && key === "setplay.adoptNameFormat") return `${opts.move} ${opts.n}`;
      if (opts && key === "setplay.countLabel") return `count ${opts.shown}/${opts.total}`;
      return key;
    },
  }),
}));

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

const oneItem: SetplaySuggestionsResponse = {
  items: [
    {
      steps: [
        { moveId: 10, code: "standing_light_kick", role: "filler", counted: true },
        { moveId: 11, code: "collarbone_breaker", role: "target", counted: true },
      ],
      s: 38,
      n: 4,
      landing: 41,
      targetActive: 4,
      alreadyAdopted: false,
      mode: "meaty",
      g: 0,
    },
  ],
  truncated: false,
  totalFound: 1,
};

// applied に渡された最後の値を取り出す(hook 第2引数)。
function lastApplied(): Record<string, unknown> | null {
  const calls = mockUseSuggestions.mock.calls;
  return (calls[calls.length - 1]?.[1] as Record<string, unknown>) ?? null;
}

function generate() {
  fireEvent.click(screen.getByTestId("setplay-generate"));
}

afterEach(() => vi.clearAllMocks());

describe("SetplaySuggestionSection", () => {
  it("KA null のとき提案リストを出さず理由を表示する", () => {
    mockUseSuggestions.mockReturnValue({ data: undefined, isLoading: false, isError: false });
    render(
      <SetplaySuggestionSection comboId={1} characterId={7} knockdownAdvantage={null} />,
      { wrapper: wrapper() },
    );
    expect(screen.getByTestId("setplay-no-knockdown")).toBeTruthy();
    expect(screen.queryByTestId("setplay-generate")).toBeNull();
  });

  it("提案を出す前は notSearched・行なし、押すと行が出る(#1)", () => {
    mockUseSuggestions.mockReturnValue({ data: oneItem, isLoading: false, isError: false });
    render(
      <SetplaySuggestionSection comboId={1} characterId={7} knockdownAdvantage={40} />,
      { wrapper: wrapper() },
    );
    expect(screen.getByText("setplay.notSearched")).toBeTruthy();
    expect(screen.queryByTestId("setplay-row")).toBeNull();
    generate();
    expect(screen.getByTestId("setplay-row")).toBeTruthy();
    expect(screen.getByText("hit 4")).toBeTruthy();
    expect(screen.getByText("立ち弱K > 鎖骨割り")).toBeTruthy();
  });

  it("発生(S)は表示しない(#5)", () => {
    mockUseSuggestions.mockReturnValue({ data: oneItem, isLoading: false, isError: false });
    render(
      <SetplaySuggestionSection comboId={1} characterId={7} knockdownAdvantage={40} />,
      { wrapper: wrapper() },
    );
    generate();
    // S(38)や「発生」表記が出ないこと。
    expect(screen.queryByText(/発生/)).toBeNull();
    expect(screen.queryByText(/\b38\b/)).toBeNull();
  });

  it("種別チェックの既定は normal/unique/special_projectile、生成時に applied へ反映(#2)", () => {
    mockUseSuggestions.mockReturnValue({ data: oneItem, isLoading: false, isError: false });
    render(
      <SetplaySuggestionSection comboId={1} characterId={7} knockdownAdvantage={40} />,
      { wrapper: wrapper() },
    );
    expect((screen.getByTestId("setplay-type-normal") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByTestId("setplay-type-unique") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByTestId("setplay-type-special_projectile") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByTestId("setplay-type-special") as HTMLInputElement).checked).toBe(false);
    expect((screen.getByTestId("setplay-type-throw") as HTMLInputElement).checked).toBe(false);
    // throw を追加して生成 → applied.targetTypes に throw が入る。
    fireEvent.click(screen.getByTestId("setplay-type-throw"));
    generate();
    expect(lastApplied()?.targetTypes).toContain("throw");
  });

  it("ラッシュ版種別が選択肢にあり既定 OFF・生成で applied へ反映(#1)", () => {
    mockUseSuggestions.mockReturnValue({ data: oneItem, isLoading: false, isError: false });
    render(
      <SetplaySuggestionSection comboId={1} characterId={7} knockdownAdvantage={40} />,
      { wrapper: wrapper() },
    );
    expect((screen.getByTestId("setplay-type-normal_rush") as HTMLInputElement).checked).toBe(false);
    expect((screen.getByTestId("setplay-type-unique_rush") as HTMLInputElement).checked).toBe(false);
    fireEvent.click(screen.getByTestId("setplay-type-normal_rush"));
    generate();
    expect(lastApplied()?.targetTypes).toContain("normal_rush");
  });

  it("N_min とソートが生成時に applied へ反映", () => {
    mockUseSuggestions.mockReturnValue({ data: oneItem, isLoading: false, isError: false });
    render(
      <SetplaySuggestionSection comboId={1} characterId={7} knockdownAdvantage={40} />,
      { wrapper: wrapper() },
    );
    fireEvent.change(screen.getByLabelText("setplay.nMinLabel"), { target: { value: "3" } });
    fireEvent.click(screen.getByText("setplay.sortByTarget"));
    generate();
    expect(lastApplied()?.nMin).toBe(3);
    expect(lastApplied()?.sort).toBe("target");
  });

  it("ダメージ0トグルが applied.includeZeroDamage へ反映(#3)", () => {
    mockUseSuggestions.mockReturnValue({ data: oneItem, isLoading: false, isError: false });
    render(
      <SetplaySuggestionSection comboId={1} characterId={7} knockdownAdvantage={40} />,
      { wrapper: wrapper() },
    );
    fireEvent.click(screen.getByTestId("setplay-include-zero-damage"));
    generate();
    expect(lastApplied()?.includeZeroDamage).toBe(true);
  });

  it("特定技を選ぶと種別欄が無効化、クリアボタンで再活性化(#3)", () => {
    mockUseSuggestions.mockReturnValue({ data: oneItem, isLoading: false, isError: false });
    render(
      <SetplaySuggestionSection comboId={1} characterId={7} knockdownAdvantage={40} />,
      { wrapper: wrapper() },
    );
    // ピッカーを開いて技を選ぶ。
    fireEvent.click(screen.getByText("setplay.pickTargetToggle"));
    fireEvent.change(screen.getByTestId("setplay-picker-move"), { target: { value: "10" } });
    // 種別欄(fieldset)が無効化され、クリアボタンが出る。
    expect((screen.getByTestId("setplay-type-fieldset") as HTMLFieldSetElement).disabled).toBe(true);
    const clearBtn = screen.getByTestId("setplay-clear-move");
    // クリア → 再活性化・ボタン消滅。
    fireEvent.click(clearBtn);
    expect((screen.getByTestId("setplay-type-fieldset") as HTMLFieldSetElement).disabled).toBe(false);
    expect(screen.queryByTestId("setplay-clear-move")).toBeNull();
  });

  it("alreadyAdopted 行は採択済み表示で採択ボタンを出さない", () => {
    const adopted: SetplaySuggestionsResponse = {
      items: [{ ...oneItem.items[0], alreadyAdopted: true }],
      truncated: false,
      totalFound: 1,
    };
    mockUseSuggestions.mockReturnValue({ data: adopted, isLoading: false, isError: false });
    render(
      <SetplaySuggestionSection comboId={1} characterId={7} knockdownAdvantage={40} />,
      { wrapper: wrapper() },
    );
    generate();
    expect(screen.getByTestId("setplay-adopted")).toBeTruthy();
    expect(screen.queryByTestId("setplay-adopt")).toBeNull();
  });

  it("不採用ボタンで行が結果から消える", () => {
    mockUseSuggestions.mockReturnValue({ data: oneItem, isLoading: false, isError: false });
    render(
      <SetplaySuggestionSection comboId={1} characterId={7} knockdownAdvantage={40} />,
      { wrapper: wrapper() },
    );
    generate();
    expect(screen.getByTestId("setplay-row")).toBeTruthy();
    fireEvent.click(screen.getByTestId("setplay-reject"));
    expect(screen.queryByTestId("setplay-row")).toBeNull();
    // 空表示になる。
    expect(screen.getByText("setplay.empty")).toBeTruthy();
  });

  it("採用で create が steps 付きで呼ばれる", async () => {
    mockCreate.mockResolvedValue({ id: 99 });
    mockUseSuggestions.mockReturnValue({ data: oneItem, isLoading: false, isError: false });
    render(
      <SetplaySuggestionSection comboId={5} characterId={7} knockdownAdvantage={40} />,
      { wrapper: wrapper() },
    );
    generate();
    fireEvent.click(screen.getByTestId("setplay-adopt"));
    const nameInput = screen.getByLabelText("setplay.adoptNameLabel") as HTMLInputElement;
    expect(nameInput.value).toBe("鎖骨割り 4");
    fireEvent.click(screen.getByTestId("setplay-adopt-save"));
    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
    const [comboId, input] = mockCreate.mock.calls[0];
    expect(comboId).toBe(5);
    expect(input.steps).toEqual([{ moveId: 10 }, { moveId: 11 }]);
    expect(input.characterId).toBe(7);
  });

  // ★★M24-05(SM-088) / レビュー 中-4: 自動生成が利用者の入力を上書きしないこと。
  //   チェックリスト §8 が最大の危険 2 件のうち 1 件として挙げた性質であり、
  //   指示書 v1.1.0 が破壊確認 5 を落とした結果、どの層にも観測が無くなっていた。
  //   ★実装上の根拠は「setName を呼ぶのは startAdopt の 1 か所だけ」であり、
  //     以後は利用者の onChange しか値を変えない。
  it("★入力済みのセットプレイ名を自動生成で上書きしない(SM-088)", () => {
    mockUseSuggestions.mockReturnValue({ data: oneItem, isLoading: false, isError: false });
    render(
      <SetplaySuggestionSection comboId={5} characterId={7} knockdownAdvantage={40} />,
      { wrapper: wrapper() },
    );
    generate();
    fireEvent.click(screen.getByTestId("setplay-adopt"));
    const nameInput = screen.getByLabelText("setplay.adoptNameLabel") as HTMLInputElement;
    // 自動で入っている(空欄を埋める形)。
    expect(nameInput.value).toBe("鎖骨割り 4");

    // 利用者が書き換える。
    fireEvent.change(nameInput, { target: { value: "自分で付けた名前" } });
    expect(nameInput.value).toBe("自分で付けた名前");

    // ★再描画が走っても書き戻されない(条件を変えて再生成しても同じ)。
    generate();
    expect(
      (screen.getByLabelText("setplay.adoptNameLabel") as HTMLInputElement).value,
    ).toBe("自分で付けた名前");
  });

  // --- M19-02(§5.4) ---

  it("負 KA は専用文言を表示し、KA NULL の文言とは区別する(§4.2)", () => {
    const negRes: SetplaySuggestionsResponse = {
      items: [],
      truncated: false,
      totalFound: 0,
      reason: "knockdown_advantage_negative",
    };
    mockUseSuggestions.mockReturnValue({ data: negRes, isLoading: false, isError: false });
    render(
      <SetplaySuggestionSection comboId={1} characterId={7} knockdownAdvantage={-5} />,
      { wrapper: wrapper() },
    );
    generate();
    expect(screen.getByTestId("setplay-negative-knockdown")).toBeTruthy();
    // KA NULL 用の noKnockdown 文言・汎用 empty 文言は出さない。
    expect(screen.queryByTestId("setplay-no-knockdown")).toBeNull();
    expect(screen.queryByText("setplay.empty")).toBeNull();
  });

  it("件数表示が出て、全件表示済みなら「さらに表示」が出ない(§4.3.4)", () => {
    mockUseSuggestions.mockReturnValue({ data: oneItem, isLoading: false, isError: false });
    render(
      <SetplaySuggestionSection comboId={1} characterId={7} knockdownAdvantage={40} />,
      { wrapper: wrapper() },
    );
    generate();
    expect(screen.getByText("count 1/1")).toBeTruthy();
    expect(screen.queryByTestId("setplay-show-more")).toBeNull();
  });

  it("totalFound>返却数なら「さらに表示」が出て、押すと limit が増える(§4.3.4)", () => {
    const partial: SetplaySuggestionsResponse = { ...oneItem, totalFound: 50 };
    mockUseSuggestions.mockReturnValue({ data: partial, isLoading: false, isError: false });
    render(
      <SetplaySuggestionSection comboId={1} characterId={7} knockdownAdvantage={40} />,
      { wrapper: wrapper() },
    );
    generate();
    const initialLimit = lastApplied()?.limit as number;
    expect(initialLimit).toBe(200);
    const more = screen.getByTestId("setplay-show-more");
    fireEvent.click(more);
    expect((lastApplied()?.limit as number)).toBe(initialLimit + 200);
  });

  it("安全上限到達(truncated)のときだけ「条件を絞ってください」が出る(§4.3.4)", () => {
    // limit で切っただけ(truncated=false・totalFound>返却)では truncated 文言は出ない。
    const cutOnly: SetplaySuggestionsResponse = { ...oneItem, totalFound: 50, truncated: false };
    mockUseSuggestions.mockReturnValue({ data: cutOnly, isLoading: false, isError: false });
    const { unmount } = render(
      <SetplaySuggestionSection comboId={1} characterId={7} knockdownAdvantage={40} />,
      { wrapper: wrapper() },
    );
    generate();
    expect(screen.queryByTestId("setplay-truncated")).toBeNull();
    unmount();
    // 安全上限到達(truncated=true)では出る。
    const capped: SetplaySuggestionsResponse = { ...oneItem, truncated: true };
    mockUseSuggestions.mockReturnValue({ data: capped, isLoading: false, isError: false });
    render(
      <SetplaySuggestionSection comboId={1} characterId={7} knockdownAdvantage={40} />,
      { wrapper: wrapper() },
    );
    generate();
    expect(screen.getByTestId("setplay-truncated")).toBeTruthy();
  });

  it("モード切替で applied.mode=gap になり、gap では G 表示・N 非表示、n_min が消え G 範囲が出る(§4.4)", () => {
    const gapRes: SetplaySuggestionsResponse = {
      items: [
        {
          steps: [
            { moveId: 10, code: "standing_light_kick", role: "filler", counted: true },
            { moveId: 11, code: "collarbone_breaker", role: "target", counted: true },
          ],
          s: 34,
          n: 7,
          landing: 41,
          targetActive: 4,
          alreadyAdopted: false,
          mode: "gap",
          g: 3, // = n − active（7−4。最終 active が起き上がりの 3F 前＝完全空振り）
        },
      ],
      truncated: false,
      totalFound: 1,
    };
    mockUseSuggestions.mockReturnValue({ data: gapRes, isLoading: false, isError: false });
    render(
      <SetplaySuggestionSection comboId={1} characterId={7} knockdownAdvantage={40} />,
      { wrapper: wrapper() },
    );
    // 既定は meaty: n_min 表示・G 範囲なし。
    expect(screen.getByLabelText("setplay.nMinLabel")).toBeTruthy();
    expect(screen.queryByTestId("setplay-gap-range")).toBeNull();
    // gap へ切替。
    fireEvent.click(screen.getByTestId("setplay-mode-gap"));
    expect(screen.getByTestId("setplay-gap-range")).toBeTruthy();
    expect(screen.queryByLabelText("setplay.nMinLabel")).toBeNull();
    generate();
    expect(lastApplied()?.mode).toBe("gap");
    // gap 行は G(=起き上がりのGF前に空振り)を表示し N は表示しない。
    expect(screen.getByText("gap 3")).toBeTruthy();
    expect(screen.queryByText("hit 7")).toBeNull();
  });

  it("meaty は最大持続(n_max)入力があり applied.nMax に反映、gap では出ない", () => {
    mockUseSuggestions.mockReturnValue({ data: oneItem, isLoading: false, isError: false });
    render(
      <SetplaySuggestionSection comboId={1} characterId={7} knockdownAdvantage={40} />,
      { wrapper: wrapper() },
    );
    // meaty(既定): n_max 入力が出る。
    fireEvent.change(screen.getByTestId("setplay-n-max"), { target: { value: "3" } });
    generate();
    expect(lastApplied()?.nMax).toBe(3);
    // gap へ切替 → n_max 入力は消える(n_min もろとも隠れ、G 範囲に置き換わる)。
    fireEvent.click(screen.getByTestId("setplay-mode-gap"));
    expect(screen.queryByTestId("setplay-n-max")).toBeNull();
  });

  it("n_max<n_min のとき注記が出る(押す前に 0 件になる理由を明示)", () => {
    mockUseSuggestions.mockReturnValue({ data: oneItem, isLoading: false, isError: false });
    render(
      <SetplaySuggestionSection comboId={1} characterId={7} knockdownAdvantage={40} />,
      { wrapper: wrapper() },
    );
    // 既定 (n_min=1, n_max=0) では注記なし。
    expect(screen.queryByTestId("setplay-n-max-hint")).toBeNull();
    // n_min=5, n_max=2 → 注記が出る。
    fireEvent.change(screen.getByLabelText("setplay.nMinLabel"), { target: { value: "5" } });
    fireEvent.change(screen.getByTestId("setplay-n-max"), { target: { value: "2" } });
    expect(screen.getByTestId("setplay-n-max-hint")).toBeTruthy();
    // n_max=6 (>=n_min) に直すと消える。
    fireEvent.change(screen.getByTestId("setplay-n-max"), { target: { value: "6" } });
    expect(screen.queryByTestId("setplay-n-max-hint")).toBeNull();
  });

  it("applied は mode/limit を含み条件変更で異なる(queryKey に条件が入る)(§4.3.4)", () => {
    mockUseSuggestions.mockReturnValue({ data: oneItem, isLoading: false, isError: false });
    render(
      <SetplaySuggestionSection comboId={1} characterId={7} knockdownAdvantage={40} />,
      { wrapper: wrapper() },
    );
    generate();
    const applied = lastApplied();
    expect(applied?.mode).toBe("meaty");
    expect(applied?.limit).toBe(200);
  });
});

// ===========================================================================
// M19-03 §5.3: 採用ダイアログの「確認できた条件」2×2 チェック(項目12)
// ===========================================================================

describe("採用時の「確認できた条件」(M19-03)", () => {
  function openAdopt() {
    mockCreate.mockResolvedValue({ id: 99 });
    mockUseSuggestions.mockReturnValue({ data: oneItem, isLoading: false, isError: false });
    render(
      <SetplaySuggestionSection comboId={5} characterId={7} knockdownAdvantage={40} />,
      { wrapper: wrapper() },
    );
    generate();
    fireEvent.click(screen.getByTestId("setplay-adopt"));
  }

  it("2×2(受け身 2 × 端 2 = 4)のチェックが出る", () => {
    openAdopt();
    expect(screen.getByTestId("setplay-confirmed-conditions")).toBeTruthy();
    for (const key of [
      "neutral_tech:false",
      "neutral_tech:true",
      "back_tech:false",
      "back_tech:true",
    ]) {
      expect(screen.getByTestId(`setplay-confirmed-${key}`)).toBeTruthy();
    }
  });

  it("既定は全て未チェック", () => {
    openAdopt();
    for (const key of [
      "neutral_tech:false",
      "neutral_tech:true",
      "back_tech:false",
      "back_tech:true",
    ]) {
      const box = screen.getByTestId(`setplay-confirmed-${key}`) as HTMLInputElement;
      expect(box.checked).toBe(false);
    }
  });

  it("★チェックせずに採用できる(verifiedConditions は空配列)", async () => {
    openAdopt();
    fireEvent.click(screen.getByTestId("setplay-adopt-save"));

    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
    const [, input] = mockCreate.mock.calls[0];
    expect(input.verifiedConditions).toEqual([]);
    // 名前の自動生成・steps など M19-02 の契約は不変。
    expect(input.steps).toEqual([{ moveId: 10 }, { moveId: 11 }]);
  });

  it("チェックしたセルだけが verifiedConditions に載る", async () => {
    openAdopt();
    fireEvent.click(screen.getByTestId("setplay-confirmed-neutral_tech:false"));
    fireEvent.click(screen.getByTestId("setplay-confirmed-back_tech:true"));
    fireEvent.click(screen.getByTestId("setplay-adopt-save"));

    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
    const [, input] = mockCreate.mock.calls[0];
    expect(input.verifiedConditions).toEqual([
      { techType: "neutral_tech", inCorner: false },
      { techType: "back_tech", inCorner: true },
    ]);
  });

  it("チェックを外すと verifiedConditions から消える", async () => {
    openAdopt();
    const box = screen.getByTestId("setplay-confirmed-neutral_tech:true");
    fireEvent.click(box);
    fireEvent.click(box);
    fireEvent.click(screen.getByTestId("setplay-adopt-save"));

    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
    expect(mockCreate.mock.calls[0][1].verifiedConditions).toEqual([]);
  });

  it("★不成立は選べない(成立のみを記録する)", () => {
    openAdopt();
    // チェックは「確認できた=成立」の 1 軸のみで、ng を選ぶ UI も note 入力も無い。
    const fieldset = screen.getByTestId("setplay-confirmed-conditions");
    expect(fieldset.querySelectorAll("input[type=checkbox]").length).toBe(4);
    expect(fieldset.querySelectorAll("input[type=text]").length).toBe(0);
    expect(fieldset.querySelectorAll("select").length).toBe(0);
    expect(fieldset.textContent).not.toContain("setupResult.state.ng");
    expect(screen.queryByTestId("setup-result-note-input")).toBeNull();
  });

  it("採用をやり直すとチェックは初期化される", async () => {
    openAdopt();
    fireEvent.click(screen.getByTestId("setplay-confirmed-neutral_tech:false"));
    fireEvent.click(screen.getByText("setplay.adoptCancel"));

    fireEvent.click(screen.getByTestId("setplay-adopt"));
    const box = screen.getByTestId("setplay-confirmed-neutral_tech:false") as HTMLInputElement;
    expect(box.checked).toBe(false);
  });
});

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ComboListFilters from "./ComboListFilters";
import {
  DEFAULT_COLUMN_VISIBILITY,
  HIT_TYPE_LABEL_KEYS,
  HIT_TYPE_SHORT_LABEL_KEYS,
  HIT_TYPE_VALUES,
  POSITION_LABEL_KEYS,
} from "@/constants/combo-list";
import { OKI_TECH_TYPE_LABEL_KEYS } from "@/constants/oki";
import { jaLabel } from "@/lib/ja-label";
import type { ComboListFiltersState } from "../hooks/useComboListFilters";

// ★M27-03(P4M-022): 始動技の選択肢は技マスタから引く。
//   ★本ファイルは実物の QueryClient を使うため、モックにしないと fetch が走る。
//   ★useMovesByCharacter は本部品の中でここでしか使われていない。
const mockMoves = vi.fn();
vi.mock("@/features/moves/api", () => ({
  useMovesByCharacter: (...args: unknown[]) => mockMoves(...args),
}));

const defaultFilters: ComboListFiltersState = {
  characterId: null,
  tagIds: [],
  position: null,
  hitType: null,
  starterMoveId: null,
  opponentStance: null,
  starterMeaty: null, // M37-07
  isDraft: null,
  setupResult: null,
  setupTechType: null,
  setupInCorner: null,
  // ★M24-02: 既定状態は DEFAULT_SORT_FIELD ("updated_at") である。
  //   "default" は「始動状況順」という別の並び順の値であり、既定ではない
  //   (useComboListFilters.ts:197 が URL 未指定時に DEFAULT_SORT_FIELD を入れる)。
  //   ここを "default" にしていると「既定状態の一覧」を表していないことになる。
  sort: "updated_at",
  order: "desc",
};

function setup(
  overrides?: Partial<ComboListFiltersState>,
  hasActiveFilters = false,
) {
  const onFilterChange = vi.fn();
  const onVisibilityChange = vi.fn();
  const onVisibilityReset = vi.fn();
  const onClearFilters = vi.fn();
  const filters = { ...defaultFilters, ...overrides };
  const tags = [
    { id: 1, userId: 1, name: "初心者向け" },
    { id: 2, userId: 1, name: "実戦用" },
  ];

  // タグ取得等で React Query を使うため QueryClient が必要。
  // ★M24-01: キャラクター選択は本部品から ComboListPage のヘッダ帯へ移した(SM-119)。
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <ComboListFilters
          filters={filters}
          characterId={1}
          onFilterChange={onFilterChange}
          availableTags={tags}
          visibility={DEFAULT_COLUMN_VISIBILITY}
          onVisibilityChange={onVisibilityChange}
          onVisibilityReset={onVisibilityReset}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={onClearFilters}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return {
    onFilterChange,
    onVisibilityChange,
    onVisibilityReset,
    onClearFilters,
  };
}

const MOVES = [
  { id: 11, code: "standing_light_punch", nameJa: "立ち弱P" },
  { id: 12, code: "crouching_heavy_kick", nameJa: "しゃがみ強K" },
];

beforeEach(() => {
  mockMoves.mockReturnValue({ data: MOVES, isLoading: false });
});

describe("ComboListFilters", () => {
  // ★折りたたみ状態は localStorage に残るため、テスト間で持ち越さない
  //   (本リポジトリの vitest は setupFiles を持たず、localStorage は自動で消えない)。
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders draft filter, sort, and situation filter selects", () => {
    // ★M24-01: キャラクター選択が抜けたぶん 1 本減る(SM-119 でヘッダ帯へ移動)。
    setup();
    const selects = screen.getAllByRole("combobox");
    expect(selects.length).toBeGreaterThanOrEqual(4);
  });

  it("★キャラクター選択は本部品に無い(ヘッダ帯へ移動済み・SM-119)", () => {
    setup();
    // 否定形の前に「フィルタが実際に描画された」ことを確かめる。
    expect(screen.getAllByRole("combobox").length).toBeGreaterThan(0);
    expect(screen.queryByTestId("combo-list-character-scope")).toBeNull();
  });

  it("fires onFilterChange when draft filter changes", async () => {
    const { onFilterChange } = setup();
    const user = userEvent.setup();
    // ★M24-01: キャラクター選択が抜けたため添字が 1 つずつ前へ寄った。
    const draftSelect = screen.getAllByRole("combobox")[0];
    await user.selectOptions(draftSelect, "draft");
    expect(onFilterChange).toHaveBeenCalledWith({ isDraft: true });
  });

  it("fires onFilterChange when position filter changes", async () => {
    const { onFilterChange } = setup();
    const user = userEvent.setup();
    const positionSelect = screen.getAllByRole("combobox")[1];
    await user.selectOptions(positionSelect, "mid_screen");
    expect(onFilterChange).toHaveBeenCalledWith({ position: "mid_screen" });
  });

  // ★M24-02 §4.1: タグフィルタは平坦なチップ列からドロップダウン + 検索へ移った。
  it("fires onFilterChange when a tag is picked from the dropdown", async () => {
    const { onFilterChange } = setup();
    const user = userEvent.setup();
    await user.click(screen.getByTestId("combo-list-tag-filter"));
    await user.click(screen.getByRole("option", { name: /初心者向け/ }));
    expect(onFilterChange).toHaveBeenCalledWith({ tagIds: [1] });
  });

  it("removes tag from tagIds when already selected", async () => {
    const { onFilterChange } = setup({ tagIds: [1] });
    const user = userEvent.setup();
    await user.click(screen.getByTestId("combo-list-tag-filter"));
    await user.click(screen.getByRole("option", { name: /初心者向け/ }));
    expect(onFilterChange).toHaveBeenCalledWith({ tagIds: [] });
  });

  it("★閉じた状態でも何件選ばれているかが分かる(§4.1)", () => {
    setup({ tagIds: [1, 2] });
    expect(screen.getByTestId("combo-list-tag-filter-count").textContent).toBe("2");
  });

  it("★未選択のときは件数バッジを出さない", () => {
    setup({ tagIds: [] });
    expect(screen.queryByTestId("combo-list-tag-filter-count")).toBeNull();
  });

  it("★検索欄でタグを絞り込める(§4.1)", async () => {
    setup();
    const user = userEvent.setup();
    await user.click(screen.getByTestId("combo-list-tag-filter"));
    // ★native の <select> の <option> も role="option" に当たるため、
    //   ドロップダウンの listbox の中だけを数える。
    const listbox = () => within(screen.getByRole("listbox"));
    const before = listbox().getAllByRole("option").length;
    await user.type(
      screen.getByPlaceholderText("comboList.filter.tagSearchPlaceholder"),
      "初心者",
    );
    const after = listbox().getAllByRole("option");
    expect(before).toBeGreaterThan(after.length);
    expect(after).toHaveLength(1);
    expect(after[0].textContent).toContain("初心者向け");
  });

  // native な <select> のラベル文言を集める(SearchableSelect のトリガは除く)。
  function nativeSelectLabels(): (string | null | undefined)[] {
    return Array.from(document.querySelectorAll("select")).map(
      (el) => el.closest("div")?.querySelector("label")?.textContent,
    );
  }

  it("hides order selector when sort is default", () => {
    setup({ sort: "default" });
    const labels = nativeSelectLabels();
    expect(labels).not.toContain("comboList.filter.order");
    expect(labels).not.toContain("順序");
    expect(labels).not.toContain("Order");
  });

  // ★M24-02 §5.2: 個数のベタ書きをやめ、「定義した項目がすべて出ているか」で見る。
  //   SearchableSelect のトリガも role="combobox" を持つため、個数比較は本部品の
  //   項目数を測っていない。native select のラベル集合で判定する。
  it("shows order selector when sort is not default", () => {
    setup({ sort: "damage" });
    expect(nativeSelectLabels()).toContain("comboList.filter.order");
  });

  // ★★M27-03(P4M-021): ヒット種別だけが native select ではなくなった。
  //   HTML の仕様上、閉じた表示は選択中 <option> のテキストそのものであり、
  //   「閉じたら短縮・開いたらフル」を 1 つの <select> では表現できないためである。
  //   ⇒ 本検査の対象から外し、代わりに専用の describe で押さえている。
  it("★定義したフィルタ項目がすべて native select として出る(ヒット種別を除く)", () => {
    setup();
    const labels = nativeSelectLabels();
    for (const key of [
      "comboList.filter.draft",
      "comboList.filter.position",
      "comboList.filter.opponentStance",
      "comboList.filter.setupResult",
      "comboList.filter.setupTechType",
      "comboList.filter.setupInCorner",
    ]) {
      expect(labels).toContain(key);
    }
    // ★破壊確認: ヒット種別が native select へ戻ったら気づけるようにする。
    expect(labels).not.toContain("comboList.filter.hitType");
    expect(screen.getByTestId("combo-list-hit-type-filter")).toBeTruthy();
  });

  // C-05: フィルタリセットボタンが常設され、hasActiveFilters に連動する。
  it("disables reset button when there are no active filters", () => {
    setup({}, false);
    const resetButton = screen
      .getByText("comboList.clearFilters")
      .closest("button");
    expect(resetButton).not.toBeNull();
    expect((resetButton as HTMLButtonElement).disabled).toBe(true);
  });

  it("enables reset and fires onClearFilters when filters are active", async () => {
    const { onClearFilters } = setup({ position: "mid_screen" }, true);
    const user = userEvent.setup();
    const resetButton = screen
      .getByText("comboList.clearFilters")
      .closest("button") as HTMLButtonElement;
    expect(resetButton.disabled).toBe(false);
    await user.click(resetButton);
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // 折りたたみ (M24-02 §4.2)
  // -------------------------------------------------------------------------

  it("★既定は開いた状態(閉じているとフィルタが効いているのに見えない)", () => {
    setup();
    const toggle = screen.getByRole("button", {
      name: /comboList\.filter\.panelLegend/,
    });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
  });

  it("★閉じてもフィルタが効いていることが分かる(要約が常時表示される)", async () => {
    setup({ isDraft: true, tagIds: [1, 2] }, true);
    const user = userEvent.setup();
    const toggle = screen.getByRole("button", {
      name: /comboList\.filter\.panelLegend/,
    });
    await user.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");

    // 閉じた後も要約は出ている
    const summary = screen.getByTestId("combo-list-filter-summary");
    expect(summary.textContent).toContain("comboList.filter.draft");
    expect(summary.textContent).toContain("comboList.filter.tagFilter");
    // 中身(native select)は畳まれている
    expect(document.querySelectorAll("select")).toHaveLength(0);
  });

  it("★絞り込みが無いときは要約が「絞り込みなし」になる", () => {
    setup();
    expect(
      screen.getByTestId("combo-list-filter-summary").textContent,
    ).toContain("comboList.filter.summaryNone");
  });

  it("★要約に出る軸は activeFilterKeys と一致する(hasActiveFilters と源が 1 つ)", () => {
    setup({ position: "mid_screen", setupResult: "ok" }, true);
    const summary = screen.getByTestId("combo-list-filter-summary");
    expect(summary.textContent).toContain("comboList.filter.position");
    expect(summary.textContent).toContain("comboList.filter.setupResult");
    // ★キャラ・ソートは「絞り込み」ではないので出ない
    expect(summary.textContent).not.toContain("comboList.filter.sortBy");
  });

  it("★★非既定のソートも閉じた状態で見える(レビュー 中-1)", () => {
    setup({ sort: "damage" });
    const summary = screen.getByTestId("combo-list-filter-summary");
    expect(summary.textContent).toContain("comboList.filter.sortAxis");
    expect(screen.getByTestId("combo-list-filter-summary-sort")).toBeDefined();
    // ★絞り込みが無くても「絞り込みなし」で塗りつぶさない
    expect(summary.textContent).not.toContain("comboList.filter.summaryNone");
  });

  it("★既定のソートでは並び順のピルを出さない", () => {
    setup({ sort: "updated_at" });
    expect(screen.queryByTestId("combo-list-filter-summary-sort")).toBeNull();
  });

  it("★ソートは activeFilterKeys へは足さない(「フィルタを解除」の対象ではないため)", () => {
    setup({ sort: "damage" }, false);
    // hasActiveFilters=false のまま = 解除ボタンは無効
    const clear = screen.getByRole("button", { name: "comboList.clearFilters" });
    expect((clear as HTMLButtonElement).disabled).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // 要約ピルの書式（M24-02 追補・開発者要望「{軸名}: {値} に揃える」）
  // ---------------------------------------------------------------------------

  it("★★ピルは {軸名}: {値} の形になる(軸名だけを出さない)", () => {
    setup({ isDraft: true }, true);
    const summary = screen.getByTestId("combo-list-filter-summary");
    // 軸名と値の両方が、この順で 1 つのピルに入っている
    expect(summary.textContent).toContain(
      "comboList.filter.draft: comboList.filter.draftOnly",
    );
  });

  it("★値のラベルは select の option と同じ式から採る(第 2 の語彙を作らない)", () => {
    setup(
      {
        position: "mid_screen",
        hitType: "counter",
        opponentStance: "standing",
        setupResult: "ok",
        setupTechType: "neutral_tech",
        setupInCorner: true,
      },
      true,
    );
    const text = screen.getByTestId("combo-list-filter-summary").textContent ?? "";
    // ★M24-07: 6 軸すべてが i18n を通るようになった(旧: 4 軸は定数の日本語が直接出ていた)。
    //   テストでは i18n 未初期化のためキーがそのまま出る。
    expect(text).toContain("comboList.filter.position: situation.position.mid_screen");
    expect(text).toContain("comboList.filter.hitType: situation.hitType.counter");
    expect(text).toContain(
      "comboList.filter.opponentStance: situation.opponentStance.standing",
    );
    expect(text).toContain("comboList.filter.setupTechType: oki.techType.neutral_tech");
    expect(text).toContain("comboList.filter.setupResult: setupResult.state.ok");
    expect(text).toContain(
      "comboList.filter.setupInCorner: setupResult.corner.inCorner",
    );
  });

  it("★★軸名の前置が「画面中央」の衝突を解消する", () => {
    // 始動位置と画面端はどちらも ja で「画面中央」。値だけを出すと見分けが付かない。
    //
    // ★★M24-07: 両者が i18n キーになったため、キー文字列を比べても衝突は再現しない。
    //   ⇒ 衝突そのものは「ja の実値が同一であること」を源泉で固定して観測する。
    //   ここを落とすと、軸名の前置が何を守っているのか分からなくなる。
    expect(jaLabel(POSITION_LABEL_KEYS.mid_screen)).toBe(
      jaLabel("setupResult.corner.midScreen"),
    );

    setup({ position: "mid_screen", setupInCorner: false }, true);
    const text = screen.getByTestId("combo-list-filter-summary").textContent ?? "";
    // 同じ「画面中央」でも軸名が前置されているので読み分けられる。
    expect(text).toContain("comboList.filter.position: situation.position.mid_screen");
    expect(text).toContain(
      "comboList.filter.setupInCorner: setupResult.corner.midScreen",
    );
  });

  it("★登録状態は true/false で値のラベルが変わる", () => {
    setup({ isDraft: false }, true);
    expect(
      screen.getByTestId("combo-list-filter-summary").textContent,
    ).toContain("comboList.filter.draft: comboList.filter.officialOnly");
  });

  it("★タグも {軸名}: {値} の形にする", () => {
    setup({ tagIds: [1, 2] }, true);
    expect(
      screen.getByTestId("combo-list-filter-summary").textContent,
    ).toContain("comboList.filter.tagFilter: comboList.filter.tagSelectedValue");
  });

  it("★★要約は見出し行と同じ行に置く(縦を 1 行ぶん節約する)", () => {
    setup({ isDraft: true }, true);
    const summary = screen.getByTestId("combo-list-filter-summary");
    const toggle = screen.getByRole("button", {
      name: /comboList\.filter\.panelLegend/,
    });
    // 見出しボタンと要約が同じ親(flex 行)を共有している
    expect(summary.parentElement?.parentElement).toBe(toggle.parentElement);
    // ★要約はボタンの中に入っていない(アクセシブル名を汚さない)
    expect(toggle.contains(summary)).toBe(false);
  });

  it("★開閉状態が localStorage へ保持される", async () => {
    setup();
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: /comboList\.filter\.panelLegend/ }),
    );
    expect(window.localStorage.getItem("combo-list-filters-collapsed-v1")).toBe(
      "true",
    );
  });

  // -------------------------------------------------------------------------
  // 成立条件フィルタ (M19-06)
  // -------------------------------------------------------------------------

  // ラベル文言経由で select を引く(index 依存だと項目追加のたびに壊れる)。
  // ★M24-02: 同じ文言が折りたたみ時の要約ピルにも出るため、getByText では複数当たる。
  //   「その文言のうち、兄弟に select を持つもの」を選ぶ。
  function selectByLabel(labelText: string): HTMLSelectElement {
    const candidates = screen.getAllByText(labelText);
    for (const node of candidates) {
      const select = node.parentElement?.querySelector("select");
      if (select) return select as HTMLSelectElement;
    }
    throw new Error(`select not found for label: ${labelText}`);
  }

  it("成立条件の 3 状態が native select の選択肢として並ぶ", () => {
    setup();
    const select = selectByLabel("comboList.filter.setupResult");
    expect(select.tagName).toBe("SELECT");
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toEqual(["", "ok", "ng", "unverified"]);
  });

  it("成立条件を選ぶと onFilterChange が呼ばれる", async () => {
    const { onFilterChange } = setup();
    const user = userEvent.setup();
    await user.selectOptions(
      selectByLabel("comboList.filter.setupResult"),
      "unverified",
    );
    expect(onFilterChange).toHaveBeenCalledWith({ setupResult: "unverified" });
  });

  // ★「全て」に戻すときは軸 2 つも一緒に落とす。軸だけが残ると disabled のせいで
  // ユーザーが個別に消せず、次に成立条件を選んだ瞬間に黙って復活する。
  it("成立条件を「全て」に戻すと軸 2 つも一緒に null になる", async () => {
    const { onFilterChange } = setup({
      setupResult: "ok",
      setupTechType: "back_tech",
      setupInCorner: true,
    });
    const user = userEvent.setup();
    await user.selectOptions(
      selectByLabel("comboList.filter.setupResult"),
      "",
    );
    expect(onFilterChange).toHaveBeenCalledWith({
      setupResult: null,
      setupTechType: null,
      setupInCorner: null,
    });
  });

  // 別の状態へ切り替えるだけなら軸は保つ(消すのは「全て」に戻すときだけ)。
  it("成立条件を ok から ng へ替えても軸は保たれる", async () => {
    const { onFilterChange } = setup({
      setupResult: "ok",
      setupTechType: "back_tech",
      setupInCorner: true,
    });
    const user = userEvent.setup();
    await user.selectOptions(
      selectByLabel("comboList.filter.setupResult"),
      "ng",
    );
    expect(onFilterChange).toHaveBeenCalledWith({ setupResult: "ng" });
  });

  // ★成立条件が未指定のあいだは軸だけ指定しても絞り込みにならない(指示書 §2.2)。
  it("成立条件が未指定のとき軸 2 つの select は無効", () => {
    setup();
    expect(selectByLabel("comboList.filter.setupTechType").disabled).toBe(true);
    expect(selectByLabel("comboList.filter.setupInCorner").disabled).toBe(true);
  });

  it("成立条件を指定すると軸 2 つの select が有効になる", () => {
    setup({ setupResult: "ok" });
    expect(selectByLabel("comboList.filter.setupTechType").disabled).toBe(false);
    expect(selectByLabel("comboList.filter.setupInCorner").disabled).toBe(false);
  });

  it("受け身種別は OKI_TECH_TYPES の値域と正典ラベルを使う", async () => {
    const { onFilterChange } = setup({ setupResult: "ok" });
    const select = selectByLabel("comboList.filter.setupTechType");
    expect(Array.from(select.options).map((o) => o.value)).toEqual([
      "",
      "neutral_tech",
      "back_tech",
    ]);
    expect(Array.from(select.options).map((o) => o.textContent)).toContain(
      OKI_TECH_TYPE_LABEL_KEYS.back_tech,
    );
    const user = userEvent.setup();
    await user.selectOptions(select, "back_tech");
    expect(onFilterChange).toHaveBeenCalledWith({ setupTechType: "back_tech" });
  });

  it("画面端は真偽値で渡り、「全て」で null に戻る", async () => {
    const { onFilterChange } = setup({ setupResult: "ok" });
    const user = userEvent.setup();
    const select = selectByLabel("comboList.filter.setupInCorner");
    await user.selectOptions(select, "true");
    expect(onFilterChange).toHaveBeenCalledWith({ setupInCorner: true });
    await user.selectOptions(select, "false");
    expect(onFilterChange).toHaveBeenCalledWith({ setupInCorner: false });
    await user.selectOptions(select, "");
    expect(onFilterChange).toHaveBeenCalledWith({ setupInCorner: null });
  });

  // N-4: 本サブは絞り込みだけであり、一覧に成立条件の列を足さない。
  it("表示列カスタマイズに成立条件の列を足していない", () => {
    setup();
    expect(screen.queryByText("comboList.columns.setupResult")).toBeNull();
  });
});

// ★★M27-01(指示書 §2.4-2): 到達点は「新しい値が絞り込みに出る」ところまでだった。
// ★★M27-03(P4M-021): 短縮の設計が入り、コントロールが native select から
//   SearchableSelect へ移った。⇒ 検査もその形に合わせて書き直してある。
//
// ★値域を回す形は維持する。値を 1 つずつ書くと、次に値が増えたときに素通しする。
describe("M27-03 ヒット種別の絞り込み(短縮表記 ＋ 値域の全値)", () => {
  // ★★候補は必ず popover の listbox の内側で数えること。
  //   ★素の `getAllByRole("option")` は**他の native <select> の <option> も拾う**
  //     (暗黙ロールが option であるため)。**M27-03 当時の実測で 9 件のはずが 39 件になった**
  //     (ヒット種別 8 値＋「全て」で 9 件)。★この数字は当時の実測の記録であり、
  //     判定には使っていない —— 下の assertion は HIT_TYPE_VALUES から導出しており、
  //     値域が増えても自動で追随する。
  //   ⇒ 範囲を絞らないと、この describe は「フィルタ欄ぜんぶ」を測ってしまう。
  async function openHitTypeFilter() {
    const user = userEvent.setup();
    await user.click(screen.getByTestId("combo-list-hit-type-filter"));
    return { user, list: within(screen.getByRole("listbox")) };
  }

  it("★開いた一覧はフル表記である(HIT_TYPE_VALUES の全値)", async () => {
    setup();
    const { list } = await openHitTypeFilter();

    const options = list.getAllByRole("option");
    const texts = options.map((o) => o.textContent);
    for (const v of HIT_TYPE_VALUES) {
      // ★本テスト環境の t() はキーをそのまま返す(既存テストと同じ前提)。
      expect(texts).toContain(HIT_TYPE_LABEL_KEYS[v]);
    }
    // 「全て」＋ 値域の全数。余分な選択肢が紛れていないこと。
    // ★件数はリテラルで書かない ——値を足したときに素通しするため、HIT_TYPE_VALUES から導く。
    expect(options.length).toBe(HIT_TYPE_VALUES.length + 1);
  });

  it("★★一覧の中に短縮表記は出さない(短縮はトリガだけ)", async () => {
    setup();
    const { list } = await openHitTypeFilter();

    const texts = list.getAllByRole("option").map((o) => o.textContent);
    // 短縮キーがフルキーと同一の値は無い(全値で別キーである)。
    for (const v of HIT_TYPE_VALUES) {
      expect(texts).not.toContain(HIT_TYPE_SHORT_LABEL_KEYS[v]);
    }
  });

  it("★★閉じているときは短縮表記を出す(横幅が値の長さで動かない)", () => {
    // 最長のフル表記を持つ値で見る。ここが短縮に置き換わることが本件の要求である。
    setup({ hitType: "just_parry_punish_counter" });
    const trigger = screen.getByTestId("combo-list-hit-type-filter");
    expect(trigger.textContent).toContain(
      HIT_TYPE_SHORT_LABEL_KEYS.just_parry_punish_counter,
    );
    expect(trigger.textContent).not.toContain(
      HIT_TYPE_LABEL_KEYS.just_parry_punish_counter,
    );
  });

  it("未選択のときは「全て」を出す", () => {
    setup();
    expect(
      screen.getByTestId("combo-list-hit-type-filter").textContent,
    ).toContain("comboList.filter.all");
  });

  it("値を選ぶと onFilterChange へ内部値が渡る(値の集合は変えていない)", async () => {
    const { onFilterChange } = setup();
    const { user, list } = await openHitTypeFilter();
    await user.click(
      list.getByRole("option", {
        name: HIT_TYPE_LABEL_KEYS.drive_impact_wall_splat_hit,
      }),
    );
    expect(onFilterChange).toHaveBeenCalledWith({
      hitType: "drive_impact_wall_splat_hit",
    });
  });

  it("★「全て」を選ぶと解除される(single モードの解除手段)", async () => {
    const { onFilterChange } = setup({ hitType: "counter" });
    const { user, list } = await openHitTypeFilter();
    await user.click(
      list.getByRole("option", { name: "comboList.filter.all" }),
    );
    expect(onFilterChange).toHaveBeenCalledWith({ hitType: null });
  });

  it("★短縮表記でも検索できる(トリガに出ている語で引ける)", async () => {
    setup();
    const { user, list } = await openHitTypeFilter();
    await user.type(
      screen.getByPlaceholderText("comboList.filter.hitTypeSearchPlaceholder"),
      HIT_TYPE_SHORT_LABEL_KEYS.stun,
    );
    const texts = list.getAllByRole("option").map((o) => o.textContent);
    expect(texts).toContain(HIT_TYPE_LABEL_KEYS.stun);
  });
});

// ★★M27-03(P4M-022): 始動技フィルタ。
//
// ★★P4M-020(一覧から始動技の表示を消す)と逆向きに見えるが両立する
//   ——消したのは「表示」であり、こちらは「絞り込み」である。混同しないこと。
describe("M27-03 始動技フィルタ", () => {
  async function openStarterFilter() {
    const user = userEvent.setup();
    await user.click(screen.getByTestId("combo-list-starter-move-filter"));
    // ★候補は popover の listbox の内側で数える(native <select> の option を拾わないため)。
    return { user, list: within(screen.getByRole("listbox")) };
  }

  it("★選択中キャラの技が選択肢に出る", async () => {
    setup();
    const { list } = await openStarterFilter();
    const texts = list.getAllByRole("option").map((o) => o.textContent);
    expect(texts).toContain("立ち弱P");
    expect(texts).toContain("しゃがみ強K");
    // 「全て」＋ 技の数
    expect(texts.length).toBe(MOVES.length + 1);
  });

  it("★選択肢を引くキャラは画面から渡された 1 体である", () => {
    setup();
    expect(mockMoves).toHaveBeenCalledWith(1);
  });

  it("技を選ぶと onFilterChange へ move id が渡る", async () => {
    const { onFilterChange } = setup();
    const { user, list } = await openStarterFilter();
    await user.click(list.getByRole("option", { name: "立ち弱P" }));
    expect(onFilterChange).toHaveBeenCalledWith({ starterMoveId: 11 });
  });

  it("★「全て」を選ぶと解除される", async () => {
    const { onFilterChange } = setup({ starterMoveId: 11 });
    const { user, list } = await openStarterFilter();
    await user.click(
      list.getByRole("option", { name: "comboList.filter.all" }),
    );
    expect(onFilterChange).toHaveBeenCalledWith({ starterMoveId: null });
  });

  it("★技名でもコードでも検索できる", async () => {
    setup();
    const { user, list } = await openStarterFilter();
    await user.type(
      screen.getByPlaceholderText("comboList.filter.starterMoveSearchPlaceholder"),
      "crouching",
    );
    const texts = list.getAllByRole("option").map((o) => o.textContent);
    expect(texts).toContain("しゃがみ強K");
    expect(texts).not.toContain("立ち弱P");
  });

  it("★要約ピルには技名を出す(内部の id を画面へ出さない)", () => {
    setup({ starterMoveId: 11 }, true);
    const summary = screen.getByTestId("combo-list-filter-panel").textContent;
    expect(summary).toContain("立ち弱P");
  });

  // ★キャラを切り替えた直後など、技マスタにまだ居ない id を持っている場合。
  //   ★隠さず id を出す(formatStarterStatus と同じ既存規約。無言で空にするより情報が多い)。
  it("★名前が引けないときは id のフォールバックを出す", () => {
    setup({ starterMoveId: 999 }, true);
    const summary = screen.getByTestId("combo-list-filter-panel").textContent;
    expect(summary).toContain("comboCommon.starterMoveFallback");
  });
});

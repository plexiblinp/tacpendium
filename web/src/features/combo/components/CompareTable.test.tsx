import { render as rtlRender, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";

import "@/lib/i18n";
import type { ComboDetail } from "../types";
import CompareTable from "./CompareTable";

// ★M24-03 §4.2(SM-003): 比較表が各コンボの詳細への <Link> を持つようになったため、
//   Router 文脈が要る。全 render 呼び出しへ wrapper を書き足す代わりに薄い shim を置く
//   (同じ数行を 13 箇所へ複製しない)。
const render = (ui: ReactElement) =>
  rtlRender(ui, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <MemoryRouter>{children}</MemoryRouter>
    ),
  });

// useCharacters は QueryClientProvider を要するため、custom_states 定義つきで固定モックする(M11-01)。
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
      {
        id: 2,
        gameId: 1,
        code: "ingrid",
        nameJa: "イングリッド",
        nameEn: "Ingrid",
        customStates: JSON.stringify({
          states: [
            {
              code: "sun_crest",
              name_ja: "サンシンボル",
              name_en: "Sun Crest",
              type: "level",
              value_definition: { kind: "integer", min: 0, max: 4 },
              show_delta: true,
            },
          ],
        }),
      },
    ],
  }),
}));

const makeCombo = (overrides: Partial<ComboDetail> = {}): ComboDetail => ({
  id: 1,
  characterId: 1,
  isDraft: false,
  affectedByGameUpdate: false,
  affectedMoves: [],
  damage: 250,
  starterMoveCode: "5LP",
  position: "mid_screen",
  opponentStance: "standing",
  hitType: "normal",
  knockdownAdvantage: 26,
  defaultRecipe: "5LP > 5MP > 236P",
  memo: "テスト備考",
  stepCount: 3,
  version: 1,
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
  tags: [{ id: 1, name: "基本", userId: 1 }],
  setups: [
    {
      id: 1,
      name: "前ステ重ね",
      defaultRecipe: "66 > 5LP",
      characterId: 1,
      parentComboIds: [1],
      description: null,
      version: 1,
      stepCount: 2,
    },
  ],
  okiOptions: [
    { attackType: "throw_meaty", techType: "neutral_tech", usesDr: false },
    { attackType: "throw_meaty", techType: "neutral_tech", usesDr: true },
    { attackType: "throw_meaty", techType: "back_tech", usesDr: false },
    { attackType: "shimmy", techType: "neutral_tech", usesDr: false },
  ],
  ...overrides,
});

const baseProps = {
  ids: [1],
  errors: [null],
  loadings: [false],
  onRemove: vi.fn(),
};

describe("CompareTable", () => {
  it("各行のラベルが表示される", () => {
    render(<CompareTable {...baseProps} combos={[makeCombo()]} />);

    const allText = document.body.textContent ?? "";
    expect(allText).toContain("始動状況");
    expect(allText).toContain("ルート");
    expect(allText).toContain("ダメージ");
    expect(allText).toContain("状況");
    expect(allText).toContain("キャラ固有状態");
    expect(allText).toContain("有利フレーム");
    // M16-02 追補(A-1): ゲージ始動・消費の 4 行を比較軸に掲載。始動/消費がラベルで判別できる。
    // M16-06(A-3): 始動ラベルを正典「コンボ開始時の◯◯ゲージ残量」へ統一(2 表記並立の解消)。
    expect(allText).toContain("コンボ開始時のドライブゲージ残量");
    expect(allText).toContain("コンボ開始時のSAゲージ残量");
    expect(allText).toContain("ドライブゲージ消費");
    expect(allText).toContain("SAゲージ消費");
    // M16-03: 正規化ラベル(constants/oki の okiOptionLabel)を 12 変種で行展開する。
    // ★M24-03 §4.5(SM-097): ノーゲージ版に「・ノーゲージ」が付いた(母集合は 12 変種のまま)。
    expect(allText).toContain("投げ重ね(その場受け身・ノーゲージ)");
    expect(allText).toContain("投げ重ね(その場受け身・ドライブラッシュ)");
    expect(allText).toContain("シミー(後ろ受け身・ドライブラッシュ)");
    expect(allText).toContain("打撃重ね(その場受け身・ノーゲージ)");
    expect(allText).toContain("セットプレイ");
    expect(allText).toContain("タグ");
    expect(allText).toContain("備考");
  });

  it("コンボデータが正しく表示される", () => {
    render(<CompareTable {...baseProps} combos={[makeCombo()]} />);

    expect(screen.getByText("250")).toBeTruthy();
    expect(screen.getByText("+26F")).toBeTruthy();
    expect(screen.getByText("テスト備考")).toBeTruthy();
    expect(screen.getByText("基本")).toBeTruthy();
    expect(screen.getByText("前ステ重ね")).toBeTruthy();
  });

  it("ゲージ始動・消費の 4 行が値そろって表示される(M16-02 追補 A-1)", () => {
    const combo = makeCombo({
      driveAvailableAtStart: 2.5,
      saAvailableAtStart: 3,
      driveGaugeConsumed: 3.5,
      saGaugeConsumed: 5,
    });
    render(<CompareTable {...baseProps} combos={[combo]} />);
    // 始動値(小数 2.5・整数 3)と消費値(小数 3.5・整数 5)が並ぶ。
    expect(screen.getByText("2.5")).toBeTruthy();
    expect(screen.getByText("3.5")).toBeTruthy();
    expect(screen.getByText("5")).toBeTruthy();
    // ラベルで始動と消費が判別できる(friend FB #11)。
    const allText = document.body.textContent ?? "";
    expect(allText).toContain("コンボ開始時のドライブゲージ残量");
    expect(allText).toContain("ドライブゲージ消費");
  });

  it("ゲージ未入力(NULL)のコンボは - で表示される(M16-02 追補)", () => {
    const combo = makeCombo({
      driveAvailableAtStart: undefined,
      saAvailableAtStart: undefined,
      driveGaugeConsumed: undefined,
      saGaugeConsumed: undefined,
    });
    render(<CompareTable {...baseProps} combos={[combo]} />);
    // 4 ゲージ行を含む null セルが - になる。
    expect(screen.getAllByText("-").length).toBeGreaterThanOrEqual(4);
  });

  it("メディア 3 行(リンク/動画パス/画像パス)が表示され、値なしは - になる(M17-01)", () => {
    const combo = makeCombo({
      link: "https://example.com/guide",
      videoPath: "videos/ryu-bnb.mp4",
      // imagePath は未設定(undefined)= "-" 表示
    });
    render(<CompareTable {...baseProps} combos={[combo]} />);

    const allText = document.body.textContent ?? "";
    expect(allText).toContain("リンク");
    expect(allText).toContain("動画パス");
    expect(allText).toContain("画像パス");
    expect(screen.getByText("https://example.com/guide")).toBeTruthy();
    expect(screen.getByText("videos/ryu-bnb.mp4")).toBeTruthy();
    // 比較表はテキスト表示のみ(リンク化しない・CHANGE-068 §2.3-j)。
    expect(document.querySelector('a[href="https://example.com/guide"]')).toBeNull();
    // imagePath 未設定セルは - 表示。
    expect(screen.getAllByText("-").length).toBeGreaterThanOrEqual(1);
  });

  it("キャラ固有状態が付与済みのコンボで名称が表示される(M11-01)", () => {
    const combo = makeCombo({
      situation: JSON.stringify({ custom_states: { denjin_charge: true } }),
    });
    render(<CompareTable {...baseProps} combos={[combo]} />);
    expect(screen.getByText("電刃錬気")).toBeTruthy();
  });

  it("M16-07: int custom_states を ①②③ の明示ラベル + 値で表示する(show_delta)", () => {
    const combo = makeCombo({
      characterId: 2, // ingrid(sun_crest・show_delta=true)
      situation: JSON.stringify({ custom_states: { sun_crest: { start_min: 1, end: 3 } } }),
    });
    render(<CompareTable {...baseProps} combos={[combo]} />);
    // ①②③ の明示ラベル + 値(③ は符号付き)。i18n 既定 = ja。
    expect(screen.getByText("サンシンボル：始動時に必要な最低のストック数: 1")).toBeTruthy();
    expect(screen.getByText("サンシンボル：終了時のストック数: 3")).toBeTruthy();
    expect(screen.getByText("サンシンボル：ストック増減: +2")).toBeTruthy();
  });

  it("null/undefined 値は - で表示される", () => {
    const combo = makeCombo({
      damage: undefined,
      knockdownAdvantage: undefined,
      memo: undefined,
      setups: [],
      tags: [],
    });
    render(<CompareTable {...baseProps} combos={[combo]} />);

    const dashCells = screen.getAllByText("-");
    expect(dashCells.length).toBeGreaterThan(0);
  });

  it("起き攻め 12 変種が ✓/✗ で個別表示される(M16-03 正規化)", () => {
    // 既定: meaty その場=true, meaty その場DR=true, meaty 後ろ=true,
    //       meaty 後ろDR=false, シミーその場=true, シミー後ろ=false → ✓×4, ✗×2
    const combo = makeCombo();
    render(<CompareTable {...baseProps} combos={[combo]} />);

    // M16-03: 12 変種を個別行で表示。fixture は 4 変種が利用可能 → 4 ✓、残り 8 → ✗。
    expect(screen.getAllByText("✓").length).toBe(4);
    expect(screen.getAllByText("✗").length).toBe(8);
  });

  it("起き攻めオプション未設定時は全 12 変種が ✗ で表示される", () => {
    const combo = makeCombo({ okiOptions: [] });
    render(<CompareTable {...baseProps} combos={[combo]} />);

    // sparse: 行が無い=利用不可 → 12 変種すべて ✗。
    expect(screen.getAllByText("✗").length).toBe(12);
  });

  it("エラー列は '取得失敗' と表示される", () => {
    render(
      <CompareTable
        combos={[undefined]}
        errors={[new Error("not found")]}
        loadings={[false]}
        ids={[99]}
        onRemove={vi.fn()}
      />,
    );

    const errorCells = screen.getAllByText("取得失敗");
    expect(errorCells.length).toBeGreaterThan(0);
  });

  it("状況行で始動位置・スタンス・ヒット種別がタグ表示される", () => {
    render(<CompareTable {...baseProps} combos={[makeCombo()]} />);

    expect(screen.getByText("画面中央")).toBeTruthy();
    expect(screen.getByText("立ち")).toBeTruthy();
    expect(screen.getByText("通常")).toBeTruthy();
  });

  it("始動状況が技名(starterMoveCode)で表示され、生 ID『始動技#』が出ない(FB②)", () => {
    // 真因(BE: FindByID が starterMoveCode を補完)修正後、詳細エンドポイント
    // 経由の比較データにも starterMoveCode が届く。共有ヘルパ formatStarterStatus
    // は code があれば技名を出すため、生 ID フォールバックは発火しない。
    render(
      <CompareTable
        {...baseProps}
        combos={[makeCombo({ starterMoveCode: "5LP", starterMoveId: 196 })]}
      />,
    );
    const allText = document.body.textContent ?? "";
    expect(allText).toContain("5LP");
    expect(allText).not.toContain("始動技#");
  });
});

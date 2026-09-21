import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Move } from "@/features/moves/types";

import "@/lib/i18n";
import type { CommandIndexEntries } from "../../inputResolutionStage2";
import { VirtualController } from "./VirtualController";

// ★M24-07(CO-020): 仮想コントローラを i18n 化したため実 ja.json を引く
//   (既存作法)。文言そのものは 1 文字も変えていないので、以下の主張は不変。

const CHAR_ID = 1;

function makeMove(id: number, code: string, category = "normal", extra: Partial<Move> = {}): Move {
  return {
    id,
    characterId: CHAR_ID,
    code,
    category,
    isAerial: code.startsWith("jumping_"),
    setupOnly: false,
    isDerived: false,
    ...extra,
  };
}

// code は正典(DES-004 §2.1 = 新形)。M15-03 でタブ式クイック入力へ拡張。
const MOVES: Move[] = [
  makeMove(1, "standing_light_punch"),
  makeMove(2, "standing_medium_punch"),
  makeMove(5, "standing_medium_kick"),
  makeMove(6, "standing_heavy_kick"),
  makeMove(13, "crouching_medium_kick"),
  makeMove(15, "jumping_heavy_punch", "normal", { isAerial: true }),
  makeMove(20, "rush_standing_medium_punch", "rush_variant", { originalMoveId: 2 }),
  // ★M30-01 追補: 共通技タブは nameJa をラベルに使う(実 DB には official_ja_move が付いている)。
  makeMove(7, "drive_impact", "drive_impact", { nameJa: "ドライブインパクト" }),
  makeMove(8, "drive_parry", "system", { nameJa: "ドライブパリィ" }),
  makeMove(9, "throw_forward", "throw", { nameJa: "前投げ" }),
  makeMove(10, "throw_back", "throw", { nameJa: "後ろ投げ" }),
  makeMove(11, "dash_forward", "system", { nameJa: "前方ステップ" }),
  makeMove(12, "dash_back", "system", { nameJa: "後方ステップ" }),
  makeMove(13, "forward", "system", { nameJa: "前入力" }),
  makeMove(14, "micro_forward", "system", { nameJa: "微歩き(前)" }),
  makeMove(15, "jump_neutral", "system", { nameJa: "垂直ジャンプ" }),
  makeMove(40, "collar_bone_breaker", "unique", { nameJa: "肘打ち" }),
  makeMove(30, "hadoken_light", "special", { nameJa: "波動拳・弱" }),
  makeMove(31, "hadoken_medium", "special", { nameJa: "波動拳・中" }),
  makeMove(32, "hadoken_heavy", "special", { nameJa: "波動拳・強" }),
  makeMove(33, "hadoken_od", "special", { nameJa: "OD波動拳" }),
  makeMove(50, "sa1_shinku_hadoken", "super_art", { nameJa: "真空波動拳" }),
  // ★M30-01: ターゲットコンボ(P4M-007)。派生・非派生の両方を置く——
  //   本タブは is_derived で絞らないため、両方が並ぶことを主張できる形にする。
  makeMove(160, "bitter_strikes", "target_combo", { nameJa: "鋭鍾打" }),
  makeMove(161, "bitter_strikes_2hits", "target_combo", { nameJa: "鋭鍾打(2発止め)" }),
  // ★M30-01: 未分類タブ(P4M-008 (a))の母集団。実測で出た区分をそのまま置く——
  //   区分 A(強度接尾辞なしの必殺技。★`_od` の兄弟が在るのに素の版が載らない形)/
  //   区分 E(共通技行の 6 code 以外の投げ)。
  makeMove(170, "sonic_break", "special", { nameJa: "ソニックブレイク" }),
  makeMove(171, "sonic_break_od", "special", { nameJa: "ODソニックブレイク" }),
  // ★★【2026-09-10 更新・M30-03】173 は「未分類に残る A2」の役だった。
  //   ⇒ 本サブで必殺技タブへ移った。**役を失ったので消すのではなく、
  //     「移ったこと」を主張する対照として残す。**
  makeMove(173, "lightning_beast_light_rolling_attack", "special", {
    nameJa: "[エレキ]弱ローリングアタック",
  }),
  makeMove(172, "german_suplex", "throw", { nameJa: "ジャーマンスープレックス" }),
  // ★M30-01: キャラ固有状態タブ(P4M-008 (b) の読み2)。ジェイミーの酔いレベル相当。
  makeMove(180, "drink_level_3_hermits_elbow", "unique", { nameJa: "[酔いLv3]仙掌" }),
];

// M17-03: VirtualController は useCommandIndex(解決表)を内部で呼ぶため QueryClientProvider が必要。
// setQueryData で解決表を注入する(staleTime 内 = 実 fetch は発火しない)。既定は空 entries(段階1 のみ)。
function renderVC(
  overrides: Partial<Parameters<typeof VirtualController>[0]> = {},
  entries: CommandIndexEntries = {},
  customStates: string | null = null,
) {
  const onStepAdd = vi.fn();
  const onStepDelete = vi.fn();
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 5 * 60 * 1000 } },
  });
  const characterId = overrides.characterId ?? CHAR_ID;
  qc.setQueryData(["command-index", characterId], { characterId, entries });
  // ★M30-01: キャラ固有状態タブは characters.customStates(生 JSON)を読む。
  //   実 fetch を起こさないよう setQueryData で注入する(解決表と同じ作法)。
  qc.setQueryData(["characters", { gameId: 1 }], [
    {
      id: CHAR_ID,
      gameId: 1,
      code: "jamie",
      nameJa: "ジェイミー",
      nameEn: "Jamie",
      customStates: customStates ?? undefined,
    },
  ]);
  render(
    <QueryClientProvider client={qc}>
      <VirtualController
        characterId={CHAR_ID}
        moves={MOVES}
        context="combo"
        onStepAdd={onStepAdd}
        onStepDelete={onStepDelete}
        stepCount={0}
        {...overrides}
      />
    </QueryClientProvider>,
  );
  return { onStepAdd, onStepDelete };
}

describe("VirtualController(タブ式クイック入力・M15-03)", () => {
  it("カテゴリタブと通常技/削除行が描画される", () => {
    renderVC();
    expect(screen.getByTestId("recipe-tab-normal")).toBeTruthy();
    expect(screen.getByTestId("recipe-tab-common")).toBeTruthy();
    expect(screen.getByTestId("recipe-tab-unique")).toBeTruthy();
    expect(screen.getByTestId("recipe-tab-special")).toBeTruthy();
    expect(screen.getByTestId("recipe-tab-super-art")).toBeTruthy();
    // 通常技タブ(既定): 方向ゾーン + 攻撃ボタン
    expect(screen.getByRole("button", { name: "弱パンチ" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "ニュートラル" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "下" })).toBeTruthy();
    // ★★M30-01 追補: 共通技はタブへ移設したため、既定タブでは出ない。
    expect(screen.queryByRole("button", { name: "前投げ" })).toBeNull();
    // ★削除だけはタブ外に残る(どのタブに居ても直前のステップを消せる必要がある)。
    expect(screen.getByRole("button", { name: "ステップ削除" })).toBeTruthy();
  });

  it("段階1: ニュートラル(既定)で弱パンチ → standing_light_punch を確定", async () => {
    const user = userEvent.setup();
    const { onStepAdd } = renderVC();
    await user.click(screen.getByRole("button", { name: "弱パンチ" }));
    expect(onStepAdd).toHaveBeenCalledOnce();
    expect(onStepAdd).toHaveBeenCalledWith(
      expect.objectContaining({ moveId: 1, moveCode: "standing_light_punch" }),
    );
  });

  it("段階1: 下ゾーン選択後に中キック → crouching_medium_kick を確定", async () => {
    const user = userEvent.setup();
    const { onStepAdd } = renderVC();
    await user.click(screen.getByRole("button", { name: "下" }));
    await user.click(screen.getByRole("button", { name: "中キック" }));
    expect(onStepAdd).toHaveBeenCalledWith(
      expect.objectContaining({ moveId: 13, moveCode: "crouching_medium_kick" }),
    );
  });

  it("段階1: 該当 variant が無い強度は非活性(データ駆動)", () => {
    renderVC();
    // standing_heavy_punch は MOVES に無い → 強パンチは disabled
    expect(screen.getByRole("button", { name: "強パンチ" })).toHaveProperty("disabled", true);
  });

  it("ラッシュトグル ON で rush_ を解決し、上ゾーンは無効化される", async () => {
    const user = userEvent.setup();
    const { onStepAdd } = renderVC();
    // ラッシュトグルは iOS 風 Switch(role="switch")(指摘1)
    await user.click(screen.getByRole("switch", { name: "ラッシュ版トグル" }));
    // 上ゾーンは空中ラッシュ不可で disabled
    expect(screen.getByRole("button", { name: "上" })).toHaveProperty("disabled", true);
    // ニュートラル + 中パンチ → rush_standing_medium_punch
    await user.click(screen.getByRole("button", { name: "中パンチ" }));
    expect(onStepAdd).toHaveBeenCalledWith(
      expect.objectContaining({ moveId: 20, moveCode: "rush_standing_medium_punch" }),
    );
  });

  it("段階2: 前(6)＋強P → 解決表の solar_plexus_strike を確定(M17-03)", async () => {
    const user = userEvent.setup();
    const moves = [...MOVES, makeMove(60, "solar_plexus_strike", "unique")];
    const { onStepAdd } = renderVC({ moves }, { "6HP": "solar_plexus_strike" });
    await user.click(screen.getByTestId("recipe-dir-6"));
    await user.click(screen.getByRole("button", { name: "強パンチ" }));
    expect(onStepAdd).toHaveBeenCalledWith(
      expect.objectContaining({ moveId: 60, moveCode: "solar_plexus_strike" }),
    );
  });

  it("段階2 ミス→段階1 縮約: 空 entries で前(6)＋中P → standing_medium_punch(一様フォールバック)", async () => {
    const user = userEvent.setup();
    const { onStepAdd } = renderVC();
    await user.click(screen.getByTestId("recipe-dir-6"));
    await user.click(screen.getByRole("button", { name: "中パンチ" }));
    expect(onStepAdd).toHaveBeenCalledWith(
      expect.objectContaining({ moveId: 2, moveCode: "standing_medium_punch" }),
    );
  });

  it("段階2: 斜め下(3)＋中K → 空 entries なら crouching_medium_kick へ縮約", async () => {
    const user = userEvent.setup();
    const { onStepAdd } = renderVC();
    await user.click(screen.getByTestId("recipe-dir-3"));
    await user.click(screen.getByRole("button", { name: "中キック" }));
    expect(onStepAdd).toHaveBeenCalledWith(
      expect.objectContaining({ moveId: 13, moveCode: "crouching_medium_kick" }),
    );
  });

  it("ラッシュ ON で上系方向(7/8/9)がすべて無効化される(M17-03)", async () => {
    const user = userEvent.setup();
    renderVC();
    await user.click(screen.getByRole("switch", { name: "ラッシュ版トグル" }));
    expect(screen.getByTestId("recipe-dir-7")).toHaveProperty("disabled", true);
    expect(screen.getByTestId("recipe-dir-8")).toHaveProperty("disabled", true);
    expect(screen.getByTestId("recipe-dir-9")).toHaveProperty("disabled", true);
    // 中段・下系は活性のまま
    expect(screen.getByTestId("recipe-dir-6")).toHaveProperty("disabled", false);
    expect(screen.getByTestId("recipe-dir-2")).toHaveProperty("disabled", false);
  });

  it("ラッシュ ON: 段階2 確定 code にもトグルが働く(rush_<解決済み技>)(§3.3-7)", async () => {
    const user = userEvent.setup();
    const moves = [
      ...MOVES,
      makeMove(61, "collarbone_breaker", "unique"),
      makeMove(62, "rush_collarbone_breaker", "rush_variant", { originalMoveId: 61 }),
    ];
    const { onStepAdd } = renderVC({ moves }, { "6MP": "collarbone_breaker" });
    await user.click(screen.getByTestId("recipe-dir-6"));
    await user.click(screen.getByRole("switch", { name: "ラッシュ版トグル" }));
    await user.click(screen.getByRole("button", { name: "中パンチ" }));
    expect(onStepAdd).toHaveBeenCalledWith(
      expect.objectContaining({ moveId: 62, moveCode: "rush_collarbone_breaker" }),
    );
  });

  it("特殊技タブのラッシュトグルも上系方向をリセットする(通常技タブと補正共有)", async () => {
    const user = userEvent.setup();
    const moves = [
      ...MOVES,
      makeMove(41, "rush_collar_bone_breaker", "rush_variant", { originalMoveId: 40 }),
    ];
    renderVC({ moves });
    // 通常技タブで上(8)を選択 → 特殊技タブで rush ON → 通常技タブへ戻ると 5 に戻っている。
    await user.click(screen.getByTestId("recipe-dir-8"));
    await user.click(screen.getByTestId("recipe-tab-unique"));
    await user.click(screen.getByTestId("recipe-unique-rush-toggle"));
    await user.click(screen.getByTestId("recipe-tab-normal"));
    expect(screen.getByTestId("recipe-dir-5").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("recipe-dir-8")).toHaveProperty("disabled", true);
  });

  it("必殺技タブ: 技名選択→強度選択で解決。OD 4種フラット、非プレーン OD は modifiers.flags を付与(指摘7/8)", async () => {
    const user = userEvent.setup();
    const { onStepAdd } = renderVC();
    await user.click(screen.getByTestId("recipe-tab-special"));

    // 技名(ファミリー)を選択(指摘7: 技名と強度を分離)
    await user.click(screen.getByTestId("recipe-special-family-hadoken"));

    // 弱 → hadoken_light
    await user.click(screen.getByTestId("recipe-special-strength-light"));
    expect(onStepAdd).toHaveBeenLastCalledWith(
      expect.objectContaining({ moveId: 30, moveCode: "hadoken_light" }),
    );

    // プレーン OD → hadoken_od、フラグなし
    await user.click(screen.getByTestId("recipe-special-od-plain"));
    expect(onStepAdd).toHaveBeenLastCalledWith(
      expect.objectContaining({ moveId: 33, moveCode: "hadoken_od", modifiers: undefined }),
    );

    // 弱中 OD → hadoken_od + flags:[od_lm]
    // ★M30-02(SD-020): 非プレーン OD は既定非表示になった。⇒ 先に展開する。
    await user.click(screen.getByRole("button", { name: /OD 強度組合せ/ }));
    await user.click(screen.getByTestId("recipe-special-od-lm"));
    expect(onStepAdd).toHaveBeenLastCalledWith(
      expect.objectContaining({ moveId: 33, modifiers: { flags: ["od_lm"] } }),
    );
  });

  it("★★M30-02(SD-020): 非プレーン OD 3 種は既定非表示で、展開すると 3 つとも出る", async () => {
    const user = userEvent.setup();
    renderVC();
    await user.click(screen.getByTestId("recipe-tab-special"));
    await user.click(screen.getByTestId("recipe-special-family-hadoken"));

    // プレーン OD は畳まない(既定で押せる)。
    expect(screen.getByTestId("recipe-special-od-plain")).toBeTruthy();
    for (const v of ["lm", "mh", "lh"]) {
      expect(screen.queryByTestId(`recipe-special-od-${v}`)).toBeNull();
    }

    await user.click(screen.getByRole("button", { name: /OD 強度組合せ/ }));
    // ★★3 つとも出る —— 「在るキャラだけ出す」ではない(D-722 の (b))。
    for (const v of ["lm", "mh", "lh"]) {
      expect(screen.getByTestId(`recipe-special-od-${v}`)).toBeTruthy();
    }
  });

  it("★★M30-02(P4M-016): 強度を持たない必殺技が『強度なし通常版』として押せる", async () => {
    const user = userEvent.setup();
    const { onStepAdd } = renderVC();
    await user.click(screen.getByTestId("recipe-tab-special"));
    // ★着手時点はファミリー行にボタンすら出ていなかった。
    await user.click(screen.getByTestId("recipe-special-family-sonic_break"));
    await user.click(screen.getByTestId("recipe-special-strength-none"));
    expect(onStepAdd).toHaveBeenLastCalledWith(
      expect.objectContaining({ moveId: 170, moveCode: "sonic_break" }),
    );
  });

  it("★強度なししか持たないファミリーでは弱中強の行を描かない(常に押せない 3 つを並べない)", async () => {
    const user = userEvent.setup();
    renderVC({
      // `sonic_break` は強度なし、`sonic_break_od` は OD。⇒ 弱中強は 1 つも無い。
      moves: MOVES.filter((m) => m.code.startsWith("sonic_break")),
    });
    await user.click(screen.getByTestId("recipe-tab-special"));
    await user.click(screen.getByTestId("recipe-special-family-sonic_break"));
    expect(screen.getByTestId("recipe-special-strength-none")).toBeTruthy();
    expect(screen.queryByTestId("recipe-special-strength-light")).toBeNull();
    // ★OD は在るので押せる(「_od だけ押せる」形はこれで解消している)。
    expect(screen.getByTestId("recipe-special-od-plain")).toBeTruthy();
  });

  it("特殊技タブ: unique 技をワンプッシュ直接指定", async () => {
    const user = userEvent.setup();
    const { onStepAdd } = renderVC();
    await user.click(screen.getByTestId("recipe-tab-unique"));
    await user.click(screen.getByTestId("recipe-direct-collar_bone_breaker"));
    expect(onStepAdd).toHaveBeenCalledWith(
      expect.objectContaining({ moveId: 40, moveCode: "collar_bone_breaker" }),
    );
  });

  // ★★M35-02: 「ryu の rush_axe_kick が入力面から選べない」という実害を、面の上で固定する。
  //   着手時点、基底技の move_code は `axe_kick_2` だった。DirectSpecPanel は
  //   resolveRushByCode(moves, m.code) が null のときボタンを disabled にするため、
  //   ラッシュ版が seed に実在していても **押せないボタンとして並ぶだけ**だった。
  //   ★エラーも警告も出ない。⇒ 人が実機で気づく以外に検出の経路が無かった。
  //   是正はデータ側(000108)であり、この面の実装は 1 行も変えていない。
  //
  // ★2 本に分けてあるのは、renderVC が unmount を返さないためである(1 テスト 1 レンダー)。
  //   ★前半が陽性対照、後半が是正後である。**片方だけだと「もともと押せたのか」が分からない。**
  //
  // ★★M35_02_SIBLING_RUSH を必ず混ぜること。ryu の実データを忠実に写すために要る——
  //   ryu は rush_collarbone_breaker 等を持つため hasUniqueRushVariant が true であり、
  //   **ラッシュトグル自体は着手時点から出ていた**。⇒ 壊れ方は「トグルが出ない」ではなく
  //   「トグルは出るが、かかと落としのボタンだけが押せない」である。
  //   ★これを混ぜないとトグルごと消え、**実際より分かりやすい壊れ方**を検査してしまう。
  //   ★綴りについて: 実 ryu の code は `collarbone_breaker` / `rush_collarbone_breaker` だが、
  //     ここでは既定の MOVES フィクスチャが持つ `collar_bone_breaker`(旧 000004_seed_moves_ryu
  //     由来の旧綴り。新系列の 000004_data_seed_moves は `collarbone_breaker` のみ)へ
  //     揃えている。**兄弟が「基底と rush 名が対応している unique」でありさえすればよい**ため、
  //     綴りの違いは本テストの主張に影響しない。
  const M35_02_SIBLING_RUSH = makeMove(41, "rush_collar_bone_breaker", "rush_variant", {
    originalMoveId: 40,
  });
  const M35_02_BASE = makeMove(90, "axe_kick", "unique", { nameJa: "かかと落とし" });
  const M35_02_BASE_BEFORE = makeMove(90, "axe_kick_2", "unique", {
    nameJa: "かかと落とし",
  });
  const M35_02_RUSH = makeMove(91, "rush_axe_kick", "rush_variant", {
    originalMoveId: 90,
  });

  it("★陽性対照: 基底 code が rush 版と対応していないとボタンは disabled のまま(M35-02 着手時点)", async () => {
    const user = userEvent.setup();
    const { onStepAdd } = renderVC({
      moves: [...MOVES, M35_02_SIBLING_RUSH, M35_02_BASE_BEFORE, M35_02_RUSH],
    });
    await user.click(screen.getByTestId("recipe-tab-unique"));
    // ★トグルは出る(兄弟の特殊技にラッシュ版が在るため)。⇒ 壊れているのは 1 ボタンだけである。
    await user.click(screen.getByTestId("recipe-unique-rush-toggle"));
    // ★兄弟のボタンは押せる。⇒ 「ラッシュ機能ごと死んでいた」のではない。
    expect(
      screen.getByTestId("recipe-direct-rush-collar_bone_breaker"),
    ).toHaveProperty("disabled", false);
    // ★ボタンは並ぶ。⇒ 「出ていない」のではなく「押しても何も起きない」形で壊れていた。
    expect(screen.getByTestId("recipe-direct-rush-axe_kick_2")).toHaveProperty(
      "disabled",
      true,
    );
    await user.click(screen.getByTestId("recipe-direct-rush-axe_kick_2"));
    expect(onStepAdd).not.toHaveBeenCalled();
  });

  it("★是正後: 基底 code が rush 版と対応していればラッシュ版を積める(M35-02)", async () => {
    const user = userEvent.setup();
    const { onStepAdd } = renderVC({
      moves: [...MOVES, M35_02_SIBLING_RUSH, M35_02_BASE, M35_02_RUSH],
    });
    await user.click(screen.getByTestId("recipe-tab-unique"));
    await user.click(screen.getByTestId("recipe-unique-rush-toggle"));
    expect(screen.getByTestId("recipe-direct-rush-axe_kick")).toHaveProperty(
      "disabled",
      false,
    );
    await user.click(screen.getByTestId("recipe-direct-rush-axe_kick"));
    expect(onStepAdd).toHaveBeenCalledWith(
      expect.objectContaining({ moveId: 91, moveCode: "rush_axe_kick" }),
    );
  });

  // ★★M35-02: テスト名から「ryu 相当」を外した。**ryu は反例である**——
  //   ryu は rush_collarbone_breaker 等を持つため hasUniqueRushVariant は true であり、
  //   ラッシュトグルは出る(上の M35-02 の 2 本が同じことを述べている)。
  //   ★既定の MOVES フィクスチャが unique ラッシュ版を持たないこと自体は正しいので、
  //     主張は変えずキャラ名だけを外した。
  it("特殊技タブ: unique ラッシュ版を持たないキャラではラッシュトグルが出ない", async () => {
    const user = userEvent.setup();
    renderVC();
    await user.click(screen.getByTestId("recipe-tab-unique"));
    expect(screen.queryByTestId("recipe-unique-rush-toggle")).toBeNull();
    // プレーン直接指定は常に可能
    expect(screen.getByTestId("recipe-direct-collar_bone_breaker")).toBeTruthy();
  });

  it("特殊技タブ: unique ラッシュ版が seed にあればトグルが出て rush_<unique> を解決", async () => {
    const user = userEvent.setup();
    const moves = [
      ...MOVES,
      makeMove(41, "rush_collar_bone_breaker", "rush_variant", { originalMoveId: 40 }),
    ];
    const { onStepAdd } = renderVC({ moves });
    await user.click(screen.getByTestId("recipe-tab-unique"));
    await user.click(screen.getByTestId("recipe-unique-rush-toggle"));
    await user.click(screen.getByTestId("recipe-direct-rush-collar_bone_breaker"));
    expect(onStepAdd).toHaveBeenCalledWith(
      expect.objectContaining({ moveId: 41, moveCode: "rush_collar_bone_breaker" }),
    );
  });

  it("SA タブ: super_art/critical_art を直接指定", async () => {
    const user = userEvent.setup();
    const { onStepAdd } = renderVC();
    await user.click(screen.getByTestId("recipe-tab-super-art"));
    await user.click(screen.getByTestId("recipe-direct-sa1_shinku_hadoken"));
    expect(onStepAdd).toHaveBeenCalledWith(
      expect.objectContaining({ moveId: 50, moveCode: "sa1_shinku_hadoken" }),
    );
  });

  it("死守2: モーション(236 等)を実演させる UI が存在しない", async () => {
    const user = userEvent.setup();
    renderVC();
    await user.click(screen.getByTestId("recipe-tab-special"));
    // 236/214/623 等のモーション表記を含むテキスト・ボタンが無い
    expect(screen.queryByText(/236|214|623/)).toBeNull();
  });

  it("共通技タブ: インパクト/パリィ/前投げ/後ろ投げ/前方ステップ/後方ステップ/ラッシュ ＋ タブ外の削除", async () => {
    const user = userEvent.setup();
    const { onStepAdd, onStepDelete } = renderVC();
    await user.click(screen.getByTestId("recipe-tab-common"));

    // ★★M30-01 追補: 移設前は常設行、いまは共通技タブ。ラベルは nameJa。
    await user.click(screen.getByRole("button", { name: "ドライブインパクト" }));
    expect(onStepAdd).toHaveBeenCalledWith(
      expect.objectContaining({ moveId: 7, moveCode: "drive_impact" }),
    );

    await user.click(screen.getByRole("button", { name: "ドライブパリィ" }));
    expect(onStepAdd).toHaveBeenCalledWith(
      expect.objectContaining({ moveId: 8, moveCode: "drive_parry" }),
    );

    // 指摘14: 投げ → 前投げ / 後ろ投げ
    await user.click(screen.getByRole("button", { name: "前投げ" }));
    expect(onStepAdd).toHaveBeenLastCalledWith(
      expect.objectContaining({ moveId: 9, moveCode: "throw_forward" }),
    );
    await user.click(screen.getByRole("button", { name: "後ろ投げ" }));
    expect(onStepAdd).toHaveBeenLastCalledWith(
      expect.objectContaining({ moveId: 10, moveCode: "throw_back" }),
    );

    // 指摘15/2: 前方ステップ / 後方ステップ(全技一覧の表記に統一。dash_forward/dash_back を system 技として解決)
    await user.click(screen.getByRole("button", { name: "前方ステップ" }));
    expect(onStepAdd).toHaveBeenLastCalledWith(
      expect.objectContaining({ moveId: 11, moveCode: "dash_forward" }),
    );
    await user.click(screen.getByRole("button", { name: "後方ステップ" }));
    expect(onStepAdd).toHaveBeenLastCalledWith(
      expect.objectContaining({ moveId: 12, moveCode: "dash_back" }),
    );

    await user.click(screen.getByRole("button", { name: "ラッシュ" }));
    expect(onStepAdd).toHaveBeenLastCalledWith(
      expect.objectContaining({ modifiers: { type: "parry_drive_rush" } }),
    );

    await user.click(screen.getByRole("button", { name: "ステップ削除" }));
    expect(onStepDelete).toHaveBeenCalledOnce();
  });

  it("★共通技タブは COMMON_MOVE_CODES の並び順で出す(seed の行順ではない)", async () => {
    const user = userEvent.setup();
    renderVC();
    await user.click(screen.getByTestId("recipe-tab-common"));
    const codes = Array.from(
      document.querySelectorAll('[data-testid^="recipe-common-"]'),
    ).map((el) => el.getAttribute("data-testid"));
    expect(codes).toEqual([
      "recipe-common-forward",
      "recipe-common-micro_forward",
      "recipe-common-jump_neutral",
      "recipe-common-drive_impact",
      "recipe-common-drive_parry",
      "recipe-common-throw_forward",
      "recipe-common-throw_back",
      "recipe-common-dash_forward",
      "recipe-common-dash_back",
    ]);
  });

  it("★移動系の技も共通技タブから積める(移設前はどの面にも出ていなかった)", async () => {
    const user = userEvent.setup();
    const { onStepAdd } = renderVC();
    await user.click(screen.getByTestId("recipe-tab-common"));
    await user.click(screen.getByRole("button", { name: "微歩き(前)" }));
    expect(onStepAdd).toHaveBeenLastCalledWith(
      expect.objectContaining({ moveId: 14, moveCode: "micro_forward" }),
    );
  });
});

// M21-03: 物理コントローラ入力の接続層は VirtualController が内部で持つ。
// ★M21-01 の headerSlot prop は撤去した(2 面へ同時に届かせるため接続を内部化した)。
// ★provider が無い環境では従来と 1 ピクセルも変わらないこと = 既存画面・既存テストの非回帰。
describe("物理コントローラ入力(M21-03)", () => {
  it("provider が無ければ物理入力の UI は一切出ない(従来と変わらない)", () => {
    renderVC();

    // 見出し行のテキストは従来どおり「クイック入力(ボタン)」だけである。
    expect(screen.getByText("クイック入力(ボタン)")).toBeTruthy();
    expect(screen.queryByTestId("recipe-gamepad-owner")).toBeNull();
    expect(screen.queryByTestId("recipe-gamepad-notice")).toBeNull();
    expect(screen.queryByTestId("recipe-gamepad-readout")).toBeNull();

    // 既存 test-id は不変(回帰ゲート)。
    expect(screen.getByTestId("recipe-tab-normal")).toBeTruthy();
    expect(screen.getByTestId("recipe-dir-5")).toBeTruthy();
    expect(screen.getByTestId("recipe-normal-light-punch")).toBeTruthy();
    expect(screen.getByTestId("recipe-tab-common")).toBeTruthy();
    expect(screen.getByTestId("recipe-system-delete")).toBeTruthy();
  });

  it("provider が無いときはどのボタンも点灯していない", () => {
    renderVC();
    expect(
      screen.getByTestId("recipe-normal-heavy-punch").getAttribute("data-held"),
    ).toBeNull();
    expect(screen.getByTestId("recipe-dir-5").getAttribute("data-held")).toBeNull();
  });
});

describe("★ターゲットコンボタブ(M30-01 / P4M-007・SM-135)", () => {
  it("特殊技タブの隣に置かれている(開発者の逐語)", () => {
    renderVC();
    const list = screen.getByTestId("recipe-tab-unique").parentElement;
    const ids = Array.from(list?.children ?? []).map((el) =>
      el.getAttribute("data-testid"),
    );
    expect(ids).toEqual([
      "recipe-tab-normal",
      "recipe-tab-unique",
      "recipe-tab-target-combo",
      "recipe-tab-special",
      "recipe-tab-super-art",
      "recipe-tab-unclassified",
      "recipe-tab-character-state",
      "recipe-tab-common",
    ]);
  });

  it("★category='target_combo' を is_derived で絞らずに全数並べる", async () => {
    const user = userEvent.setup();
    renderVC();
    await user.click(screen.getByTestId("recipe-tab-target-combo"));
    expect(screen.getByTestId("recipe-target-combo-bitter_strikes")).toBeTruthy();
    expect(
      screen.getByTestId("recipe-target-combo-bitter_strikes_2hits"),
    ).toBeTruthy();
  });

  it("押すとターゲットコンボの move が 1 ステップとして積まれる", async () => {
    const user = userEvent.setup();
    const { onStepAdd } = renderVC();
    await user.click(screen.getByTestId("recipe-tab-target-combo"));
    await user.click(screen.getByTestId("recipe-target-combo-bitter_strikes"));
    expect(onStepAdd).toHaveBeenCalledWith({
      moveId: 160,
      moveCode: "bitter_strikes",
      modifiers: undefined,
    });
  });

  it("ターゲットコンボが 1 件も無いキャラでは空状態の文言を出す", async () => {
    const user = userEvent.setup();
    renderVC({ moves: MOVES.filter((m) => m.category !== "target_combo") });
    await user.click(screen.getByTestId("recipe-tab-target-combo"));
    expect(screen.getByText("ターゲットコンボがありません")).toBeTruthy();
  });
});

describe("★M24-12 の入力の骨格に触れていないこと(M30-01 §0.2)", () => {
  it("★タブは数字キーで切り替わらない(数字キーは M24-12 のボタン群のものである)", async () => {
    const user = userEvent.setup();
    renderVC();
    const normalTab = screen.getByTestId("recipe-tab-normal");
    // ★click 経由でフォーカスを渡す(直接 .focus() すると Radix の roving focus が
    //   act() の外で状態を更新し、警告が出る)。
    await user.click(normalTab);
    for (const key of ["1", "2", "3", "4", "5"]) {
      await user.keyboard(key);
    }
    // 既定タブ(通常技)のまま。⇒ タブを増やしても数字キーの割当は 1 つも消費していない。
    expect(normalTab.getAttribute("data-state")).toBe("active");
    expect(
      screen.getByTestId("recipe-tab-target-combo").getAttribute("data-state"),
    ).toBe("inactive");
  });
});

describe("★★通常技タブの配置(M30-02 / SM-149 案 X′)", () => {
  it("★方向パッドと攻撃ボタンが横並びの兄弟になり、ラッシュは攻撃側の列に入る", () => {
    renderVC();
    const dir = screen.getByTestId("recipe-dir-5");
    const attack = screen.getByTestId("recipe-normal-light-punch");
    const rush = screen.getByTestId("recipe-rush-toggle");

    // 方向パッドの grid と、攻撃＋ラッシュを束ねる列は同じ親の子である。
    const dirGrid = dir.parentElement as HTMLElement;
    const attackGrid = attack.parentElement as HTMLElement;
    const rightColumn = attackGrid.parentElement as HTMLElement;
    expect(dirGrid.parentElement).toBe(rightColumn.parentElement);
    expect(rightColumn.className).toContain("flex-col");
    // ★ラッシュは攻撃ボタンと同じ列に居る(着手時点は方向パッドと攻撃の間に全幅で在った)。
    expect(rightColumn.contains(rush)).toBe(true);
    expect(dirGrid.contains(rush)).toBe(false);
  });

  it("★★タブ行が高さを固定していない(2026-09-09 開発者の実機確認・折り返しの崩れ)", () => {
    renderVC();
    const list = screen.getByTestId("recipe-tab-normal").parentElement as HTMLElement;
    // ★★jsdom はレイアウトを持たない。⇒ 実際にはみ出すかどうかは測れない。
    //   判定はクラスで行う —— 共通部品 ui/tabs.tsx の既定 `h-10` を呼び出し側で
    //   `h-auto` へ上書きしていること。★見た目そのものはスクリーンショットで確かめた。
    expect(list.className).toContain("h-auto");
    expect(list.className).toContain("flex-wrap");
    expect(list.className).not.toMatch(/\bh-10\b/);
  });

  it("★DOM 上の順序は 方向 → 攻撃 → ラッシュ である", () => {
    renderVC();
    const dir = screen.getByTestId("recipe-dir-1");
    const attack = screen.getByTestId("recipe-normal-light-punch");
    const rush = screen.getByTestId("recipe-rush-toggle");
    // Node.DOCUMENT_POSITION_FOLLOWING = 4
    expect(dir.compareDocumentPosition(attack) & 4).toBeTruthy();
    expect(attack.compareDocumentPosition(rush) & 4).toBeTruthy();
  });

  it("★★M24-12 の入力の骨格に触れていない(data-testid も aria 名も動かしていない)", () => {
    renderVC();
    // 方向 9 種・攻撃 6 種の data-testid が全数そのまま在る。
    for (const d of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      expect(screen.getByTestId(`recipe-dir-${d}`)).toBeTruthy();
    }
    for (const s of ["light", "medium", "heavy"]) {
      for (const b of ["punch", "kick"]) {
        expect(screen.getByTestId(`recipe-normal-${s}-${b}`)).toBeTruthy();
      }
    }
    // aria 名(単体テストのセレクタ)も据え置き。
    expect(screen.getByRole("button", { name: "ニュートラル" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "弱パンチ" })).toBeTruthy();
  });
});

describe("★★変種行(M30-02 / P4M-018 案 B)", () => {
  // 開発者の逐語(マリーザ)と同じ形。★plain / holding の両方が弱中強＋OD を持つ。
  const GLADIUS = [
    makeMove(200, "gladius_light", "special", { nameJa: "弱グラディウス" }),
    makeMove(201, "gladius_holding_light", "special", {
      nameJa: "【ホールド】弱グラディウス",
    }),
    makeMove(202, "gladius_medium", "special", { nameJa: "中グラディウス" }),
    makeMove(203, "gladius_holding_medium", "special", {
      nameJa: "【ホールド】中グラディウス",
    }),
  ];

  it("★★ファミリー行から【ホールド】が消える(逐語の「強度の外に 1 つ出ている」の是正)", async () => {
    const user = userEvent.setup();
    renderVC({ moves: GLADIUS });
    await user.click(screen.getByTestId("recipe-tab-special"));
    expect(screen.getByTestId("recipe-special-family-gladius")).toBeTruthy();
    expect(screen.queryByTestId("recipe-special-family-gladius_holding")).toBeNull();
    // ★ファミリー名からも強度語と装飾が落ちる。
    expect(screen.getByTestId("recipe-special-family-gladius").textContent).toBe(
      "グラディウス",
    );
  });

  it("★変種行でホールドを選ぶと、強度がホールド版へ切り替わる", async () => {
    const user = userEvent.setup();
    const { onStepAdd } = renderVC({ moves: GLADIUS });
    await user.click(screen.getByTestId("recipe-tab-special"));

    // 既定は通常。
    await user.click(screen.getByTestId("recipe-special-strength-light"));
    expect(onStepAdd).toHaveBeenLastCalledWith(
      expect.objectContaining({ moveId: 200, moveCode: "gladius_light" }),
    );

    await user.click(screen.getByTestId("recipe-special-variant-holding"));
    await user.click(screen.getByTestId("recipe-special-strength-light"));
    // ★★確定するステップは着手時点と同じである —— ホールド版は自分の move_id で入る。
    //   修飾フラグは足していない。
    expect(onStepAdd).toHaveBeenLastCalledWith(
      expect.objectContaining({ moveId: 201, moveCode: "gladius_holding_light" }),
    );
  });

  it("★変種を持たないファミリーでは変種行を出さない", async () => {
    const user = userEvent.setup();
    renderVC();
    await user.click(screen.getByTestId("recipe-tab-special"));
    await user.click(screen.getByTestId("recipe-special-family-hadoken"));
    expect(screen.queryByTestId("recipe-special-variant-plain")).toBeNull();
  });

  it("★★ファミリーを変えたら変種は通常へ戻る(押した覚えのない変種で確定させない)", async () => {
    const user = userEvent.setup();
    const { onStepAdd } = renderVC({
      moves: [
        ...GLADIUS,
        makeMove(210, "phalanx_light", "special", { nameJa: "弱ファランクス" }),
      ],
    });
    await user.click(screen.getByTestId("recipe-tab-special"));
    await user.click(screen.getByTestId("recipe-special-variant-holding"));
    await user.click(screen.getByTestId("recipe-special-family-phalanx"));
    await user.click(screen.getByTestId("recipe-special-strength-light"));
    expect(onStepAdd).toHaveBeenLastCalledWith(
      expect.objectContaining({ moveId: 210, moveCode: "phalanx_light" }),
    );
  });
});

describe("★未分類タブ(M30-01 / P4M-008 (a))", () => {
  it("SA の隣に置かれている(開発者の逐語)", () => {
    renderVC();
    const list = screen.getByTestId("recipe-tab-super-art").parentElement;
    const ids = Array.from(list?.children ?? []).map((el) =>
      el.getAttribute("data-testid"),
    );
    // ★SA の直後が未分類タブである(その後ろにキャラ固有状態タブが続く)。
    const saIndex = ids.indexOf("recipe-tab-super-art");
    expect(ids[saIndex + 1]).toBe("recipe-tab-unclassified");
  });

  it("★★他のどのタブからも入力できない技だけが並ぶ(区分 E のみ)", async () => {
    const user = userEvent.setup();
    renderVC();
    await user.click(screen.getByTestId("recipe-tab-unclassified"));
    // 区分 E: 共通技行が引く 6 code 以外の投げ。
    expect(screen.getByTestId("recipe-unclassified-german_suplex")).toBeTruthy();
    // ★★区分 A1 は M30-02(P4M-016)で、区分 A2 は M30-03 で必殺技タブへ移った。
    //   ⇒ **未分類タブに category='special' は 1 件も残らない。**
    expect(screen.queryByTestId("recipe-unclassified-sonic_break")).toBeNull();
    expect(screen.queryByTestId("recipe-unclassified-sonic_break_od")).toBeNull();
    expect(
      screen.queryByTestId(
        "recipe-unclassified-lightning_beast_light_rolling_attack",
      ),
    ).toBeNull();
  });

  it("★他のタブに載っている技は 1 件も混ざらない", async () => {
    const user = userEvent.setup();
    renderVC();
    await user.click(screen.getByTestId("recipe-tab-unclassified"));
    for (const code of [
      "standing_light_punch", // 通常技タブ(段階1)
      "collar_bone_breaker", // 特殊技タブ
      "hadoken_light", // 必殺技タブ
      "sa1_shinku_hadoken", // SA タブ
      "bitter_strikes", // ターゲットコンボタブ
      "throw_forward", // 共通技行
    ]) {
      expect(screen.queryByTestId(`recipe-unclassified-${code}`)).toBeNull();
    }
  });

  it("押すと未分類の move が 1 ステップとして積まれる", async () => {
    const user = userEvent.setup();
    const { onStepAdd } = renderVC();
    await user.click(screen.getByTestId("recipe-tab-unclassified"));
    // ★★M30-03 で A2 が必殺技タブへ移ったため、未分類に残る区分 E で見る。
    await user.click(screen.getByTestId("recipe-unclassified-german_suplex"));
    expect(onStepAdd).toHaveBeenCalledWith({
      moveId: 172,
      moveCode: "german_suplex",
      modifiers: undefined,
    });
  });

  it("未分類が 1 件も無いキャラでは空状態の文言を出す", async () => {
    const user = userEvent.setup();
    renderVC({
      // ★★M30-03 以後、未分類に残るのは `german_suplex`(区分 E)だけである。
      moves: MOVES.filter((m) => m.code !== "german_suplex"),
    });
    await user.click(screen.getByTestId("recipe-tab-unclassified"));
    expect(screen.getByText("未分類の技はありません")).toBeTruthy();
  });
});

describe("★キャラ固有状態タブ(M30-01 / P4M-008 (b)・読み2)", () => {
  const JAMIE_STATES = JSON.stringify({
    states: [
      { code: "drink_level", name_ja: "酔いレベル", type: "level" },
      { code: "the_devils_song", name_ja: "絶唱魔身", type: "flag" },
    ],
  });

  it("未分類タブとは別の 1 枚である(2 タブ)", () => {
    renderVC();
    expect(screen.getByTestId("recipe-tab-unclassified")).toBeTruthy();
    expect(screen.getByTestId("recipe-tab-character-state")).toBeTruthy();
  });

  it("★custom_states の code を含む move_code だけが並ぶ", async () => {
    const user = userEvent.setup();
    renderVC({}, {}, JAMIE_STATES);
    await user.click(screen.getByTestId("recipe-tab-character-state"));
    expect(
      screen.getByTestId("recipe-character-state-drink_level_3_hermits_elbow"),
    ).toBeTruthy();
    // 状態の語を持たない技は並ばない。
    expect(
      screen.queryByTestId("recipe-character-state-standing_light_punch"),
    ).toBeNull();
  });

  it("★他のタブにも並んでいる技を重ねて出す(経路であって区分ではない)", async () => {
    const user = userEvent.setup();
    renderVC({}, {}, JAMIE_STATES);
    // 同じ技が特殊技タブにも並ぶ(category='unique' のため)。
    await user.click(screen.getByTestId("recipe-tab-unique"));
    expect(
      screen.getByTestId("recipe-direct-drink_level_3_hermits_elbow"),
    ).toBeTruthy();
    // ★未分類タブの母集団は動かない。
    await user.click(screen.getByTestId("recipe-tab-unclassified"));
    expect(
      screen.queryByTestId("recipe-unclassified-drink_level_3_hermits_elbow"),
    ).toBeNull();
  });

  it("★custom_states を持たないキャラでもタブは出し、空状態の文言を出す", async () => {
    const user = userEvent.setup();
    renderVC();
    await user.click(screen.getByTestId("recipe-tab-character-state"));
    expect(
      screen.getByText("キャラ固有状態に紐づく技はありません"),
    ).toBeTruthy();
  });

  it("★custom_states が壊れた JSON でも落ちない(空状態になるだけ)", async () => {
    const user = userEvent.setup();
    renderVC({}, {}, "{ not json");
    await user.click(screen.getByTestId("recipe-tab-character-state"));
    expect(
      screen.getByText("キャラ固有状態に紐づく技はありません"),
    ).toBeTruthy();
  });
});

// ★★★M31-06 追補: 「どの配列をどのタブへ渡しているか」を測る（配線の床）。
//
//   ★★moveSurfacing.test.ts は surfaceBuckets の**出力**を測っており、
//     本コンポーネントが **buckets.inputMoves を各パネルへ配っているか**は見ていない。
//   ★★★実データの setup_only が 0 件のあいだは inputMoves === moves になるため、
//     配線を生の moves へ戻しても**全テストが緑のまま通る**。
//     ⇒ とくに通常技タブ（押下時に解決）と必殺技タブ（ファミリーへ畳む）は
//       バケットを持たないので、ここでしか捕まえられない。
//   ★★あわせて context の prop が効いていることも測る（セットプレイ側の面が
//     静かに減っていないこと＝本サブ最大の事故の形）。
describe("★★VirtualController — setup_only の配線(M31-06)", () => {
  // ★通常技タブ用: standing_light_punch は段階1 の正準 code である。
  //   ⇒ 外れると (5, light, punch) の解決先が消え、ボタンが disabled になる。
  const suNormal = makeMove(900, "standing_light_punch", "normal", {
    setupOnly: true,
  });
  // ★必殺技タブ用: 4 行で 1 ファミリー。⇒ 4 行とも外れるとファミリーごと消える。
  const suSpecials = [
    makeMove(910, "su_trap_light", "special", {
      setupOnly: true,
      nameJa: "弱トラップ",
    }),
    makeMove(911, "su_trap_medium", "special", {
      setupOnly: true,
      nameJa: "中トラップ",
    }),
    makeMove(912, "su_trap_heavy", "special", {
      setupOnly: true,
      nameJa: "強トラップ",
    }),
    makeMove(913, "su_trap_od", "special", {
      setupOnly: true,
      nameJa: "ODトラップ",
    }),
  ];
  // ★特殊技タブ用（list={buckets.unique} 経由の対照）。
  const suUnique = makeMove(920, "su_shoulder", "unique", {
    setupOnly: true,
    nameJa: "セットプレイ肩",
  });

  // ★対照は既存の MOVES がそのまま持っている
  //   （standing_medium_punch / hadoken ファミリー / collar_bone_breaker）。
  const MS: Move[] = [
    ...MOVES.filter((m) => m.code !== "standing_light_punch"),
    suNormal,
    ...suSpecials,
    suUnique,
  ];

  describe('context="combo"（コンボ登録）', () => {
    it("★通常技タブ: setup_only の技に割り当たるボタンが押せない", () => {
      renderVC({ moves: MS, context: "combo" });
      expect(screen.getByTestId("recipe-normal-light-punch")).toHaveProperty(
        "disabled",
        true,
      );
      // ★対照: setup_only でない通常技のボタンは押せる（タブごと死んでいない）。
      expect(screen.getByTestId("recipe-normal-medium-punch")).toHaveProperty(
        "disabled",
        false,
      );
    });

    it("★必殺技タブ: setup_only のファミリーが並ばない", async () => {
      const user = userEvent.setup();
      renderVC({ moves: MS, context: "combo" });
      await user.click(screen.getByTestId("recipe-tab-special"));
      expect(screen.queryByTestId("recipe-special-family-su_trap")).toBeNull();
      // ★対照: 通常のファミリーは並ぶ。
      expect(screen.getByTestId("recipe-special-family-hadoken")).toBeTruthy();
    });

    it("★特殊技タブと未分類タブにも並ばない", async () => {
      const user = userEvent.setup();
      renderVC({ moves: MS, context: "combo" });
      await user.click(screen.getByTestId("recipe-tab-unique"));
      expect(screen.queryByTestId("recipe-direct-su_shoulder")).toBeNull();
      expect(screen.getByTestId("recipe-direct-collar_bone_breaker")).toBeTruthy();

      await user.click(screen.getByTestId("recipe-tab-unclassified"));
      expect(
        screen.queryByTestId("recipe-unclassified-su_shoulder"),
      ).toBeNull();
      expect(
        screen.queryByTestId("recipe-unclassified-standing_light_punch"),
      ).toBeNull();
    });
  });

  describe('★★★context="setup"（セットプレイ・陽性対照）', () => {
    it("★通常技タブ: 同じボタンが押せる", () => {
      // ★★これが「元から居なかった」と「外した」を弁別する。
      renderVC({ moves: MS, context: "setup" });
      expect(screen.getByTestId("recipe-normal-light-punch")).toHaveProperty(
        "disabled",
        false,
      );
    });

    it("★必殺技タブ: 同じファミリーが並ぶ", async () => {
      const user = userEvent.setup();
      renderVC({ moves: MS, context: "setup" });
      await user.click(screen.getByTestId("recipe-tab-special"));
      expect(screen.getByTestId("recipe-special-family-su_trap")).toBeTruthy();
    });

    it("★特殊技タブ: 同じ技が並ぶ", async () => {
      const user = userEvent.setup();
      renderVC({ moves: MS, context: "setup" });
      await user.click(screen.getByTestId("recipe-tab-unique"));
      expect(screen.getByTestId("recipe-direct-su_shoulder")).toBeTruthy();
    });
  });

  // ★★drive_reversal は静的除外(M31-04)なので**面で分かれない**。
  //   ⇒ 「面で分ける」を入れた本サブが踏みうる唯一の後退である(チェックリスト C-3)。
  //   ★2 面を別の it に分ける —— 同一テスト内で 2 回 render すると
  //     Testing Library の自動 cleanup が挟まらず、同じ testId が二重に居る状態を測ることになる。
  it.each(["combo", "setup"] as const)(
    "★★drive_reversal は %s 面でも未分類タブに出ない(C-3 の後退検出)",
    async (context) => {
      const user = userEvent.setup();
      const withDr = [...MS, makeMove(930, "drive_reversal", "system")];
      renderVC({ moves: withDr, context });
      await user.click(screen.getByTestId("recipe-tab-unclassified"));
      expect(
        screen.queryByTestId("recipe-unclassified-drive_reversal"),
      ).toBeNull();
    },
  );
});

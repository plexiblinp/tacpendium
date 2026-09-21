import { describe, expect, it } from "vitest";

import type { Move } from "@/features/moves/types";

import {
  OD_VARIANT_FLAG,
  buildNormalMoveCode,
  buildRushMoveCode,
  deriveSpecialFamilies,
  hasUniqueRushVariant,
  isOdVariantApplicable,
  parseSpecialCode,
  resolveRushByCode,
  resolveRushMoveId,
  resolveStage1MoveId,
} from "./inputResolution";

// self-contained な moves フィクスチャ(seed 非依存)。ryu 相当の代表 move_code を並べる。
function move(id: number, code: string, category: string, extra: Partial<Move> = {}): Move {
  return {
    id,
    characterId: 1,
    code,
    category,
    isAerial: category === "normal" && code.startsWith("jumping_"),
    setupOnly: false,
    isDerived: false,
    ...extra,
  };
}

const MOVES: Move[] = [
  // 通常技(立ち/しゃがみ/ジャンプ × 弱中強 × P/K の代表)
  move(10, "standing_light_punch", "normal"),
  move(11, "standing_medium_punch", "normal"),
  move(12, "standing_heavy_kick", "normal"),
  move(13, "crouching_medium_kick", "normal"),
  move(14, "crouching_light_kick", "normal"),
  move(15, "jumping_heavy_punch", "normal", { isAerial: true }),
  // ラッシュ版(通常技のみ)
  move(20, "rush_standing_medium_punch", "rush_variant", { originalMoveId: 11 }),
  move(21, "rush_crouching_medium_kick", "rush_variant", { originalMoveId: 13 }),
  // 必殺技(<技名>_<強度> / <技名>_od)
  move(30, "hadoken_light", "special", { nameJa: "波動拳・弱" }),
  move(31, "hadoken_medium", "special", { nameJa: "波動拳・中" }),
  move(32, "hadoken_heavy", "special", { nameJa: "波動拳・強" }),
  move(33, "hadoken_od", "special", { nameJa: "OD波動拳" }),
  move(34, "shoryuken_light", "special", { nameJa: "昇龍拳・弱" }),
  move(35, "shoryuken_od", "special", { nameJa: "OD昇龍拳" }),
  // 特殊技・SA・システム・移動のみジャンプ
  move(40, "collar_bone_breaker", "unique"),
  move(50, "sa1_shinku_hadoken", "super_art"),
  move(60, "drive_impact", "drive_impact"),
  move(70, "jump_neutral", "system"),
];

describe("buildNormalMoveCode", () => {
  it("方向ゾーンを standing/crouching/jumping 接頭辞に写す(DES-004 §2.1)", () => {
    expect(buildNormalMoveCode("neutral", "medium", "punch")).toBe("standing_medium_punch");
    expect(buildNormalMoveCode("down", "light", "kick")).toBe("crouching_light_kick");
    expect(buildNormalMoveCode("up", "heavy", "punch")).toBe("jumping_heavy_punch");
  });
});

describe("resolveStage1MoveId(段階1 決定論引き当て)", () => {
  it("方向ゾーン×強度×ボタンの代表組で moveId を確定する", () => {
    expect(resolveStage1MoveId(MOVES, "neutral", "medium", "punch")).toBe(11);
    expect(resolveStage1MoveId(MOVES, "down", "medium", "kick")).toBe(13);
    expect(resolveStage1MoveId(MOVES, "up", "heavy", "punch")).toBe(15);
  });

  it("該当 variant が無ければ null(未定義フォールバック・誤引き当て/例外なし)", () => {
    // crouching_heavy_punch は MOVES に無い
    expect(resolveStage1MoveId(MOVES, "down", "heavy", "punch")).toBeNull();
    // moves 空でも安全に null
    expect(resolveStage1MoveId([], "neutral", "light", "punch")).toBeNull();
  });

  it("移動のみのジャンプ(jump_neutral 等)は段階1 の合成形と一致せず引き当てない", () => {
    // 段階1 は jumping_<強度>_<ボタン> しか合成しないため jump_neutral(system)は解決対象外。
    const hit = resolveStage1MoveId(MOVES, "up", "light", "punch"); // jumping_light_punch は無い
    expect(hit).toBeNull();
  });

  it("汚い/簡易入力(236LP 等)を解決しない — 方向ゾーンとボタンだけを見る(死守1)", () => {
    // 段階1 の入力は zone/strength/button のみ。文字列コマンドを受ける経路が存在しないことを、
    // 合成 code が常に standing_/crouching_/jumping_ 形であることで担保する。
    for (const zone of ["neutral", "down", "up"] as const) {
      const code = buildNormalMoveCode(zone, "light", "punch");
      expect(code).toMatch(/^(standing|crouching|jumping)_light_punch$/);
      expect(code).not.toContain("236");
    }
  });
});

describe("resolveRushMoveId(ラッシュ版)", () => {
  it("下/ニュートラルゾーンで rush_<元技code> を解決する", () => {
    expect(buildRushMoveCode("neutral", "medium", "punch")).toBe("rush_standing_medium_punch");
    expect(resolveRushMoveId(MOVES, "neutral", "medium", "punch")).toBe(20);
    expect(resolveRushMoveId(MOVES, "down", "medium", "kick")).toBe(21);
  });

  it("上ゾーン(空中)はラッシュ不可で null(is_aerial 除外)", () => {
    expect(resolveRushMoveId(MOVES, "up", "medium", "punch")).toBeNull();
  });

  it("該当 rush_variant が seed に無ければ null", () => {
    expect(resolveRushMoveId(MOVES, "neutral", "light", "punch")).toBeNull();
  });
});

describe("resolveRushByCode / hasUniqueRushVariant(特殊技ラッシュ・§4.2)", () => {
  it("rush_<元技code> を解決する。該当なしは null", () => {
    expect(resolveRushByCode(MOVES, "standing_medium_punch")).toBe(20);
    expect(resolveRushByCode(MOVES, "collar_bone_breaker")).toBeNull();
  });

  // ★★M35-02: ryu の `axe_kick` / `rush_axe_kick` が対で解決できることを固定する。
  //   着手時点、基底技の move_code は `axe_kick_2` だった。resolveRushByCode は
  //   `rush_` + 基底 code で探すため `rush_axe_kick_2` を探し、実在する `rush_axe_kick` に
  //   到達できなかった。★エラーにはならず null が返るだけで、呼び出し側
  //   (DirectSpecPanel / hasUniqueRushVariant / inputResolutionStage2)はそれを
  //   「データ駆動の非活性」として扱う。⇒ ラッシュ版が入力面に出ないだけで、
  //   テストも lint も型検査も緑のままだった。是正は 000108(データ側)。
  //   ★実装は正しい。誤っていたのはデータである(指示書 M35-02 §3-3)。
  it("★特殊技のラッシュ版を基底 code から解決する。★旧の綴りでは解決できない(M35-02)", () => {
    const ryuAxeKick = [
      move(50, "axe_kick", "unique"),
      move(51, "rush_axe_kick", "rush_variant", { originalMoveId: 50 }),
    ];
    // 是正後: 基底 code が `axe_kick` なので `rush_axe_kick` に当たる。
    expect(resolveRushByCode(ryuAxeKick, "axe_kick")).toBe(51);
    expect(hasUniqueRushVariant(ryuAxeKick)).toBe(true);

    // ★陽性対照。是正前の綴りでは `rush_axe_kick_2` を探すため外れる——
    //   ラッシュ版が実在していても到達できない、という壊れ方そのもの。
    expect(resolveRushByCode(ryuAxeKick, "axe_kick_2")).toBeNull();
    const beforeFix = [
      move(50, "axe_kick_2", "unique"),
      move(51, "rush_axe_kick", "rush_variant", { originalMoveId: 50 }),
    ];
    expect(hasUniqueRushVariant(beforeFix)).toBe(false);
  });

  it("特殊技(unique)のラッシュ版が seed にあれば true、無ければ false", () => {
    // MOVES の unique(collar_bone_breaker)にはラッシュ版が無い
    expect(hasUniqueRushVariant(MOVES)).toBe(false);
    const withUniqueRush = [
      move(40, "collar_bone_breaker", "unique"),
      move(41, "rush_collar_bone_breaker", "rush_variant", { originalMoveId: 40 }),
    ];
    expect(hasUniqueRushVariant(withUniqueRush)).toBe(true);
  });
});

describe("parseSpecialCode", () => {
  it("必殺技 code をファミリーと強度に分解する", () => {
    expect(parseSpecialCode("hadoken_light")).toEqual({ family: "hadoken", strength: "light" });
    expect(parseSpecialCode("hadoken_od")).toEqual({ family: "hadoken", strength: "od" });
  });

  it("★★強度接尾辞を持たない code は strength:'none' になる(M30-02 / P4M-016)", () => {
    // ★着手時点は null だった。⇒ 強度を持たない必殺技はファミリー UI に 1 件も
    //   出ていなかった(開発者の逐語＝「強度のない技のノーマル版が選択できない」)。
    expect(parseSpecialCode("collar_bone_breaker")).toEqual({
      family: "collar_bone_breaker",
      strength: "none",
    });
    expect(parseSpecialCode("tenshin")).toEqual({
      family: "tenshin",
      strength: "none",
    });
  });

  it("★★強度語が code の**途中**に在る形もファミリーへ載る(A2＝M30-03)", () => {
    // ★★陽性対照。着手時点は null であり、A2 の 105 件は必殺技タブに 1 件も
    //   出ていなかった(開発者の逐語＝「Jamie の必殺技に、酔いレベル4の流酔拳だけ
    //   固有状態技なのに出ていました」)。
    // ★ファミリー名は**その 1 トークンだけ**を抜いた残りを連結する。
    expect(parseSpecialCode("lightning_beast_light_rolling_attack")).toEqual({
      family: "lightning_beast_rolling_attack",
      strength: "light",
    });
    expect(parseSpecialCode("flame_od_kachousen")).toEqual({
      family: "flame_kachousen",
      strength: "od",
    });
    // ★★【2026-09-12 差し替え・M30-07】着手前はここに guile の
    //   `perfect_timing_light_sonic_boom` を置いていたが、**seed から消えた** ——
    //   同キャラの【ジャスト】版 10 件が接尾形 `<技>_perfect_<強度>` へ揃ったため、
    //   規則 2(強度語が途中)ではなく規則 1(末尾)で判定される側へ移ったからである。
    //   ⇒ 実在しない code を例に残すと、次の担当が「まだそう書ける」と読む。
    //     ★差し替え先は実在する A2 行である(c_viper・実測 96 件のうちの 1 件)。
    expect(parseSpecialCode("high_jump_light_aerial_burning_kick")).toEqual({
      family: "high_jump_aerial_burning_kick",
      strength: "light",
    });
  });

  it("★★対照: 末尾に強度を持つ形は着手時点の判定のまま動かない(規則 1 が最優先)", () => {
    // ★★指示書 §5-3 の対照。同じ「状態版の必殺技」でありながら、
    //   `move_code` の書き方の違いだけで扱いが割れていた側である。
    expect(parseSpecialCode("drink_level_4_freeflow_strikes_light")).toEqual({
      family: "drink_level_4_freeflow_strikes",
      strength: "light",
    });
  });

  it("★★強度語が 2 つ在るときの優先順位を固定する(§4.2)", () => {
    // ★★規則 1(末尾)が規則 2(途中)より**常に先**である。
    //   ⇒ seed 実測で強度語を 2 つ以上持つ special は 15 件あり、**うち 12 件は末尾にも
    //     強度語を持つ**。規則 1 が先である限り、着手時点の判定は 1 件も動かない。
    expect(parseSpecialCode("od_sun_shot_light")).toEqual({
      family: "od_sun_shot", // ★`od` は残る。末尾の `light` が採られるため。
      strength: "light",
    });
    expect(parseSpecialCode("lynx_whirl_od_spinning_scythe_heavy")).toEqual({
      family: "lynx_whirl_od_spinning_scythe",
      strength: "heavy",
    });
    expect(parseSpecialCode("cannon_strike_light_od_hooligan_combination_od")).toEqual({
      family: "cannon_strike_light_od_hooligan_combination",
      strength: "od",
    });

    // ★★残る 3 件(cammy の fatal_leg_twister)だけが規則 2 の優先順位で決まる。
    //   ⇒ 末尾に強度語が無く、途中に `light`/`medium`/`heavy` と `od` が両方在る。
    // ★★★`od` を先に採る。**位置順(最初に見つかった語)ではない。**
    //   理由＝既に載っている構造上の兄弟 `cannon_strike_<強度>_od_hooligan_combination_od`
    //   (上の行)と**同じ形になる**ため。どちらも「派生元フーリガンの強度ごとに 1 ファミリー、
    //   中身は OD だけ」に落ちる。位置順にすると、この 2 つが別々の畳まれ方をする。
    // ★JP 名は「フェイタルレッグツイスター(弱ODフーリガンコンビネーション派生)」であり、
    //   `light` も `od` も**派生元フーリガン側**を指す(技自身の強度ではない)。
    //   ⇒ どちらを採っても意味上は同点である。⇒ 兄弟との一貫性で決めた。
    expect(parseSpecialCode("fatal_leg_twister_light_od_hooligan_combination")).toEqual({
      family: "fatal_leg_twister_light_hooligan_combination",
      strength: "od",
    });
  });

  it("★強度語が語の一部でしかない code は 'none' である(部分一致で拾わない)", () => {
    // "lightning" は "light" を含むが、`_` で割ったトークンとしては別語である。
    expect(parseSpecialCode("lightning")).toEqual({
      family: "lightning",
      strength: "none",
    });
  });
});

describe("deriveSpecialFamilies", () => {
  it("special のみをファミリー別に集約し、存在する強度のみ埋める", () => {
    const fams = deriveSpecialFamilies(MOVES);
    const hadoken = fams.find((f) => f.family === "hadoken");
    const shoryuken = fams.find((f) => f.family === "shoryuken");

    expect(hadoken?.byVariant.plain).toEqual({
      light: 30,
      medium: 31,
      heavy: 32,
      od: 33,
    });
    // shoryuken は light と od のみ seed。中/強は未定義(データ駆動活性の材料)。
    expect(shoryuken?.byVariant.plain).toEqual({ light: 34, od: 35 });
    expect(shoryuken?.byVariant.plain?.medium).toBeUndefined();
    // ★変種を持たないファミリーは plain 1 つだけ(UI は変種行を出さない)。
    expect(hadoken?.variants).toEqual(["plain"]);
  });

  it("代表表示名は強度表記を落としたファミリー名(末尾形)", () => {
    const fams = deriveSpecialFamilies(MOVES);
    expect(fams.find((f) => f.family === "hadoken")?.nameJa).toBe("波動拳");
  });

  it("接頭形の強度表記(弱波動拳/OD竜巻旋風脚)も剥がして基底名にする(指摘8)", () => {
    const prefixMoves: Move[] = [
      move(100, "tatsu_light", "special", { nameJa: "弱竜巻旋風脚" }),
      move(101, "tatsu_od", "special", { nameJa: "OD竜巻旋風脚" }),
      move(102, "shoryuken_heavy", "special", { nameJa: "強昇龍拳" }),
    ];
    const fams = deriveSpecialFamilies(prefixMoves);
    expect(fams.find((f) => f.family === "tatsu")?.nameJa).toBe("竜巻旋風脚");
    expect(fams.find((f) => f.family === "shoryuken")?.nameJa).toBe("昇龍拳");
  });

  // ★★M30-05: 先頭装飾(【…】 / […])の直後に来る強度語を落とす。
  //   ★核は「落とすこと」ではなく「落としてはいけない行を見分けること」である(指示書 §0.3)。
  it("★先頭装飾の直後の強度語は落とす(装飾は残す)", () => {
    const moves: Move[] = [
      move(200, "bayani_light_alon", "special", { nameJa: "【バヤニ】弱アロン" }),
      move(201, "bayani_od_alon", "special", { nameJa: "【バヤニ】ODアロン" }),
      move(202, "flame_light_kachousen", "special", { nameJa: "[焔版]弱花蝶扇" }),
    ];
    const fams = deriveSpecialFamilies(moves);
    expect(fams.find((f) => f.family === "bayani_alon")?.nameJa).toBe("【バヤニ】アロン");
    expect(fams.find((f) => f.family === "flame_kachousen")?.nameJa).toBe("[焔版]花蝶扇");
  });

  it("★★丸括弧の中の強度語(派生元の強度)は落とさない", () => {
    // ★落とすと「どの派生元から出る技か」が読めなくなる。
    //   ★★`cannon_strike_{light,medium}_od_hooligan_combination` は別ファミリーであり、
    //     落とすと 2 行が同一表示になって区別できなくなる。
    const moves: Move[] = [
      move(210, "cannon_strike_light_hooligan_combination", "special", {
        nameJa: "キャノンストライク(弱フーリガンコンビネーション派生)",
      }),
      move(211, "cannon_strike_light_od_hooligan_combination_od", "special", {
        nameJa: "ODキャノンストライク(弱ODフーリガン派生)",
      }),
      move(212, "cannon_strike_medium_od_hooligan_combination_od", "special", {
        nameJa: "ODキャノンストライク(中ODフーリガン派生)",
      }),
    ];
    const fams = deriveSpecialFamilies(moves);
    expect(fams.find((f) => f.family === "cannon_strike_hooligan_combination")?.nameJa).toBe(
      "キャノンストライク(弱フーリガンコンビネーション派生)",
    );
    expect(
      fams.find((f) => f.family === "cannon_strike_light_od_hooligan_combination")?.nameJa,
    ).toBe("キャノンストライク(弱ODフーリガン派生)");
    expect(
      fams.find((f) => f.family === "cannon_strike_medium_od_hooligan_combination")?.nameJa,
    ).toBe("キャノンストライク(中ODフーリガン派生)");
  });

  it("★★先頭以外の装飾は見ない(括弧の中の【ホールド】直後の強度語を落とさない)", () => {
    const moves: Move[] = [
      move(220, "fatal_leg_twister_hooligan_combination_holding_heavy", "special", {
        nameJa: "フェイタルレッグツイスター(【ホールド】強フーリガンコンビネーション派生)",
      }),
    ];
    const fams = deriveSpecialFamilies(moves);
    expect(fams[0].nameJa).toBe(
      "フェイタルレッグツイスター(【ホールド】強フーリガンコンビネーション派生)",
    );
  });

  it("★★強度語でない字(空中の中 / 強化の強 / 付着中の中)は落とさない", () => {
    const moves: Move[] = [
      move(230, "aerial_tatsumaki_senpu_kyaku_od", "special", { nameJa: "空中竜巻旋風脚" }),
      move(231, "buffed_leopard_snap", "special", { nameJa: "【強化】レオパードスナップ" }),
      move(232, "mine_set_devil_reverse", "special", {
        nameJa: "[サイコマイン付着中]デビルリバース",
      }),
    ];
    const fams = deriveSpecialFamilies(moves);
    expect(fams.find((f) => f.family === "aerial_tatsumaki_senpu_kyaku")?.nameJa).toBe(
      "空中竜巻旋風脚",
    );
    expect(fams.find((f) => f.family === "buffed_leopard_snap")?.nameJa).toBe(
      "【強化】レオパードスナップ",
    );
    expect(fams.find((f) => f.family === "mine_set_devil_reverse")?.nameJa).toBe(
      "[サイコマイン付着中]デビルリバース",
    );
  });

  it("★装飾の直後に強度語が無ければ装飾ごとそのまま残す(既定は落とさない)", () => {
    const moves: Move[] = [
      move(240, "windclad_condor_spire_light", "special", {
        nameJa: "[風纏い]コンドルスパイア",
      }),
    ];
    expect(deriveSpecialFamilies(moves)[0].nameJa).toBe("[風纏い]コンドルスパイア");
  });

  it("special 以外(unique/super_art/system)は含めない", () => {
    const fams = deriveSpecialFamilies(MOVES);
    const families = fams.map((f) => f.family);
    expect(families).toContain("hadoken");
    expect(families).not.toContain("collar_bone_breaker");
    expect(families).not.toContain("sa1_shinku_hadoken");
  });
});

describe("OD_VARIANT_FLAG(OD 4 種フラット → modifiers.flags)", () => {
  it("非プレーン OD 3 種が固有 flag に対応(プレーンはフラグなし)", () => {
    expect(OD_VARIANT_FLAG.lm).toBe("od_lm");
    expect(OD_VARIANT_FLAG.mh).toBe("od_mh");
    expect(OD_VARIANT_FLAG.lh).toBe("od_lh");
    expect((OD_VARIANT_FLAG as Record<string, string>).plain).toBeUndefined();
  });
});

describe("★isOdVariantApplicable(SD-020 の活性条件・M30-02)", () => {
  it("必殺技の OD なら true", () => {
    expect(isOdVariantApplicable(move(1, "hadoken_od", "special"))).toBe(true);
  });

  it("★必殺技でも OD でなければ false", () => {
    expect(isOdVariantApplicable(move(1, "hadoken_light", "special"))).toBe(false);
  });

  it("★★通常技は false —— 着手時点はここが true 相当に振る舞い、しゃがみ弱P にも OD 組が付けられた", () => {
    expect(isOdVariantApplicable(move(1, "crouching_light_punch", "normal"))).toBe(false);
  });

  it("★★`od` が code の途中に在る OD 必殺技も true(レビュー 高-2)", () => {
    // ★seed 全 31 キャラで 37 行実在する。末尾だけを見ると、着手時点にできた入力が
    //   できなくなる(機能後退)。
    expect(isOdVariantApplicable(move(1, "flame_od_kachousen", "special"))).toBe(true);
    expect(
      isOdVariantApplicable(move(2, "lightning_beast_od_rolling_attack", "special")),
    ).toBe(true);
    expect(isOdVariantApplicable(move(3, "od_sun_shot_light", "special"))).toBe(true);
    expect(
      isOdVariantApplicable(move(4, "denjin_charge_od_hadoken", "special")),
    ).toBe(true);
  });

  it("★`od` を語の一部に含むだけの code は false(部分一致で拾わない)", () => {
    expect(isOdVariantApplicable(move(1, "odyssey_light", "special"))).toBe(false);
  });

  it("★`_od` で終わっても special でなければ false(SA 等の巻き添えを防ぐ)", () => {
    expect(isOdVariantApplicable(move(1, "some_od", "super_art"))).toBe(false);
    expect(isOdVariantApplicable(move(1, "some_od", "unique"))).toBe(false);
  });

  it("★move が無いステップ(非技ステップ・未選択)は false", () => {
    expect(isOdVariantApplicable(undefined)).toBe(false);
    expect(isOdVariantApplicable(null)).toBe(false);
  });
});

describe("★変種の畳み込み(M30-02 / P4M-018 案 B)", () => {
  // マリーザのグラディウス(開発者の逐語)と同じ形。
  const GLADIUS: Move[] = [
    move(1, "gladius_light", "special", { nameJa: "弱グラディウス" }),
    move(2, "gladius_holding_light", "special", { nameJa: "【ホールド】弱グラディウス" }),
    move(3, "gladius_medium", "special", { nameJa: "中グラディウス" }),
    move(4, "gladius_holding_medium", "special", { nameJa: "【ホールド】中グラディウス" }),
    move(5, "gladius_od", "special", { nameJa: "ODグラディウス" }),
    move(6, "gladius_holding_od", "special", { nameJa: "【ホールド】ODグラディウス" }),
  ];

  it("★★ホールドはファミリー行から消え、変種として畳まれる", () => {
    const fams = deriveSpecialFamilies(GLADIUS);
    expect(fams.map((f) => f.family)).toEqual(["gladius"]);
    expect(fams[0].variants).toEqual(["plain", "holding"]);
    expect(fams[0].byVariant.plain).toEqual({ light: 1, medium: 3, od: 5 });
    expect(fams[0].byVariant.holding).toEqual({ light: 2, medium: 4, od: 6 });
  });

  it("★★代表名は plain から採る(変種の name_ja は装飾と強度語を含む)", () => {
    expect(deriveSpecialFamilies(GLADIUS)[0].nameJa).toBe("グラディウス");
  });

  it("★★`_max_holding` は `_holding` より先に照合する(順序を誤ると 1 変種消える)", () => {
    const fams = deriveSpecialFamilies([
      move(1, "scutum_od", "special", { nameJa: "ODスクトゥム" }),
      move(2, "scutum_max_holding_od", "special", { nameJa: "【最大ホールド】ODスクトゥム" }),
    ]);
    expect(fams.map((f) => f.family)).toEqual(["scutum"]);
    expect(fams[0].variants).toEqual(["plain", "max_holding"]);
  });

  it("ジャスト版も同じ軸で畳まれる(luke/flash_knuckle_perfect)", () => {
    const fams = deriveSpecialFamilies([
      move(1, "flash_knuckle_light", "special", { nameJa: "弱フラッシュナックル" }),
      move(2, "flash_knuckle_holding_light", "special", { nameJa: "【ホールド】弱フラッシュナックル" }),
      move(3, "flash_knuckle_perfect_light", "special", { nameJa: "【ジャスト】弱フラッシュナックル" }),
    ]);
    expect(fams[0].variants).toEqual(["plain", "holding", "perfect"]);
  });

  it("★★基底が実在しない変種は独立ファミリーのまま残す(到達不能にしない)", () => {
    const fams = deriveSpecialFamilies([
      move(1, "orphan_holding_light", "special", { nameJa: "【ホールド】弱みなしご" }),
    ]);
    expect(fams.map((f) => f.family)).toEqual(["orphan_holding"]);
    expect(fams[0].variants).toEqual(["plain"]);
  });

  it("★必殺技以外は畳まない(通常技の `_holding` に触れない)", () => {
    const fams = deriveSpecialFamilies([
      move(1, "standing_heavy_punch", "normal"),
      move(2, "standing_heavy_punch_holding", "normal"),
    ]);
    expect(fams).toEqual([]);
  });
});

describe("★★派生変種を末尾へ回す(M30-04 / D-801)", () => {
  // ★ジェイミーの魔身と同じ形。素(酔い+1)だけが is_derived=false で、
  //   残りは true。着手時点はこの 3 件が**先頭側**に並んでいた。
  const JAMIE_LIKE: Move[] = [
    move(1, "the_devil_inside", "special", { nameJa: "魔身（酔い+1）" }),
    move(2, "the_devil_inside_up2", "special", {
      nameJa: "魔身（酔い+2）",
      isDerived: true,
    }),
    move(3, "the_devil_inside_up3", "special", {
      nameJa: "魔身（酔い+3）",
      isDerived: true,
    }),
    move(4, "swagger_step_light", "special", { nameJa: "弱酔疾歩" }),
    move(5, "arrow_kick_light", "special", { nameJa: "弱張弓腿" }),
  ];

  it("★★★is_derived のファミリーが末尾へ回る(陽性対照＝入れる前は先頭側に居た)", () => {
    // ★陽性対照: 入力の初出順では index 1・2 に derived が居る。
    //   ⇒ 「末尾に居る」だけを見ると、元から末尾だった並びでも緑になる。
    const inputOrder = [
      "the_devil_inside",
      "the_devil_inside_up2",
      "the_devil_inside_up3",
      "swagger_step",
      "arrow_kick",
    ];
    const derivedAtInput = ["the_devil_inside_up2", "the_devil_inside_up3"].map(
      (f) => inputOrder.indexOf(f),
    );
    expect(derivedAtInput).toEqual([1, 2]);
    expect(Math.min(...derivedAtInput)).toBeLessThan(inputOrder.length - 2);

    const fams = deriveSpecialFamilies(JAMIE_LIKE);
    expect(fams.map((f) => f.family)).toEqual([
      "the_devil_inside",
      "swagger_step",
      "arrow_kick",
      "the_devil_inside_up2",
      "the_devil_inside_up3",
    ]);
  });

  it("★★件数は変わらない(1 件も落とさない)", () => {
    expect(deriveSpecialFamilies(JAMIE_LIKE)).toHaveLength(5);
  });

  it("★★非 derived どうし・derived どうしの相対順は初出順のまま", () => {
    const fams = deriveSpecialFamilies(JAMIE_LIKE);
    const plain = fams.filter((f) => !f.isDerived).map((f) => f.family);
    const derived = fams.filter((f) => f.isDerived).map((f) => f.family);
    // 入力の初出順(the_devil_inside → swagger_step → arrow_kick)がそのまま残る。
    expect(plain).toEqual([
      "the_devil_inside",
      "swagger_step",
      "arrow_kick",
    ]);
    // derived 側も入力順(up2 → up3)のまま。
    expect(derived).toEqual(["the_devil_inside_up2", "the_devil_inside_up3"]);
  });

  it("★★★混在ファミリーは動かさない(素が押せるのに末尾へ沈めない)", () => {
    // akuma/gou_hadoken と同じ形。素の弱中強は false、ホールド変種だけ true。
    // ★変種は基底へ畳まれるため、AND を取らないとファミリーごと末尾へ落ちる。
    const fams = deriveSpecialFamilies([
      move(1, "gou_hadoken_light", "special", { nameJa: "弱豪波動" }),
      move(2, "gou_hadoken_holding_light", "special", {
        nameJa: "【ホールド】弱豪波動",
        isDerived: true,
      }),
      move(3, "zanku_hadoken_light", "special", {
        nameJa: "弱斬空波動",
        isDerived: true,
      }),
    ]);
    expect(fams.map((f) => f.family)).toEqual(["gou_hadoken", "zanku_hadoken"]);
    expect(fams[0].isDerived).toBe(false);
    expect(fams[0].variants).toEqual(["plain", "holding"]);
    expect(fams[1].isDerived).toBe(true);
  });

  it("★★★同じファミリーの中で強度ごとに割れていたら derived にしない(AND であって OR ではない)", () => {
    // ★★seed 実データには「同一 raw ファミリーの中で is_derived が割れる」組が 1 件も無い。
    //   ⇒ 段 1 の AND を OR に取り違えても、実データ由来のテストは緑のままである
    //     (レビュー 中-1 の取り込み時に変異注入で実測した)。**合成データで塞ぐ。**
    const fams = deriveSpecialFamilies([
      move(1, "split_light", "special", { nameJa: "弱スプリット" }),
      move(2, "split_medium", "special", {
        nameJa: "中スプリット",
        isDerived: true,
      }),
    ]);
    expect(fams.map((f) => f.family)).toEqual(["split"]);
    // 弱が押せる以上、末尾へ沈めない。
    expect(fams[0].isDerived).toBe(false);
  });

  it("★全ファミリーが derived でも、相対順は初出順のまま(全体が動かない)", () => {
    const fams = deriveSpecialFamilies([
      move(1, "a_light", "special", { isDerived: true }),
      move(2, "b_light", "special", { isDerived: true }),
      move(3, "c_light", "special", { isDerived: true }),
    ]);
    expect(fams.map((f) => f.family)).toEqual(["a", "b", "c"]);
  });
});

describe("★★M30-06 ファミリー行の代表名(強度語だけの差を畳む)", () => {
  it("★★★差が強度語だけなら畳む(陽性対照＝畳む前は最弱メンバーの名前だった)", () => {
    // cammy/silent_step と同じ形。3 メンバーとも丸括弧の中の強度語だけが違う。
    const moves = [
      move(1, "silent_step_light", "special", {
        nameJa: "サイレントステップ(弱フーリガン派生)",
        isDerived: true,
      }),
      move(2, "silent_step_medium", "special", {
        nameJa: "サイレントステップ(中フーリガン派生)",
        isDerived: true,
      }),
      move(3, "silent_step_heavy", "special", {
        nameJa: "サイレントステップ(強フーリガン派生)",
        isDerived: true,
      }),
    ];
    // ★陽性対照: 入力側には強度語が実在する。
    //   ⇒ 「出力に強度語が無い」だけを見ると、元から無かった行と区別がつかない。
    expect(moves.map((m) => m.nameJa)).toEqual([
      "サイレントステップ(弱フーリガン派生)",
      "サイレントステップ(中フーリガン派生)",
      "サイレントステップ(強フーリガン派生)",
    ]);

    const fams = deriveSpecialFamilies(moves);
    expect(fams).toHaveLength(1);
    expect(fams[0].family).toBe("silent_step");
    expect(fams[0].nameJa).toBe("サイレントステップ(フーリガン派生)");
    // ★★行の中で弱/中/強が選べること自体は変わっていない。
    expect(Object.keys(fams[0].byVariant.plain ?? {}).sort()).toEqual([
      "heavy",
      "light",
      "medium",
    ]);
  });

  it("★★★メンバーが 1 件なら畳まない(反例群＝OD だけの兄弟が区別できなくなる形)", () => {
    // cammy/cannon_strike_{light,medium,heavy}_od_hooligan_combination と同じ形。
    // ★★丸括弧の中の強度語を**位置**で落とすと、この 3 行は同一表示になる。
    //   ⇒ 本実装は「ファミリーの中で何が変わるか」しか見ないため、
    //     比較対象を持たないこれらの行には触れない。
    const fams = deriveSpecialFamilies([
      move(1, "cannon_strike_light_od_hooligan_combination_od", "special", {
        nameJa: "ODキャノンストライク(弱ODフーリガン派生)",
        isDerived: true,
      }),
      move(2, "cannon_strike_medium_od_hooligan_combination_od", "special", {
        nameJa: "ODキャノンストライク(中ODフーリガン派生)",
        isDerived: true,
      }),
      move(3, "cannon_strike_heavy_od_hooligan_combination_od", "special", {
        nameJa: "ODキャノンストライク(強ODフーリガン派生)",
        isDerived: true,
      }),
    ]);
    expect(fams).toHaveLength(3);
    const labels = fams.map((f) => f.nameJa);
    expect(labels).toEqual([
      "キャノンストライク(弱ODフーリガン派生)",
      "キャノンストライク(中ODフーリガン派生)",
      "キャノンストライク(強ODフーリガン派生)",
    ]);
    // ★区別できること自体を主張する(「変わっていない」より強い)。
    expect(new Set(labels).size).toBe(3);
  });

  it("★★★差が強度語以外を含むなら畳まない(空文字は強度語ではない)", () => {
    // c_viper/focus_force_forward_step と同じ形。差は "" と "OD" であり、
    // "" は強度語ではないため畳まない。⇒ 優先順の 1 件がそのまま代表名になる。
    const fams = deriveSpecialFamilies([
      move(1, "focus_force_forward_step_light", "special", {
        nameJa: "【セービングフォース】前方ステップ",
      }),
      move(2, "focus_force_forward_step_od", "special", {
        nameJa: "【ODセービングフォース】前方ステップ",
      }),
    ]);
    expect(fams).toHaveLength(1);
    expect(fams[0].nameJa).toBe("【セービングフォース】前方ステップ");
  });

  it("★差が強度語以外の語なら畳まない(語そのものが違う)", () => {
    // guile/sonic_cross と同じ形。差は "" と "１"。
    const fams = deriveSpecialFamilies([
      move(1, "sonic_cross_light", "special", { nameJa: "ソニッククロス" }),
      move(2, "sonic_cross_medium", "special", { nameJa: "ソニッククロス１" }),
    ]);
    expect(fams[0].nameJa).toBe("ソニッククロス");
  });

  it("★★畳んだ結果が空になる形では畳まない(名前を失わない)", () => {
    // 名前が強度語そのものしかない病的な形。⇒ 空の行名を作らない。
    const fams = deriveSpecialFamilies([
      move(1, "x_light", "special", { nameJa: "弱" }),
      move(2, "x_medium", "special", { nameJa: "中" }),
    ]);
    expect(fams[0].nameJa).toBeTruthy();
  });

  it("★★強度語 4 語すべてが畳める(STRENGTH_LABELS からの集合導出が壊れていないこと)", () => {
    // ★実装の強度語集合は `STRENGTH_LABELS.split("|")` で導く。
    //   ⇒ `(?:…)` や文字クラスを足すと、**正規表現としては動いたまま集合だけが静かに壊れる**。
    //   ★1 語でも集合から落ちると、その語を含む組は畳めなくなって本テストが赤くなる
    //     (レビュー 低-9)。
    for (const [a, b] of [
      ["弱", "中"],
      ["中", "強"],
      ["強", "OD"],
      ["OD", "弱"],
    ]) {
      const fams = deriveSpecialFamilies([
        move(1, "x_light", "special", { nameJa: `テスト(${a}派生)` }),
        move(2, "x_medium", "special", { nameJa: `テスト(${b}派生)` }),
      ]);
      expect(fams[0].nameJa, `${a} / ${b} が畳めない`).toBe("テスト(派生)");
    }
  });

  it("★メンバーの名前が全員同じなら何も起きない(大多数の形)", () => {
    // "弱波動拳"/"中波動拳"/"強波動拳" は stripStrengthLabel の時点で揃う。
    const fams = deriveSpecialFamilies([
      move(1, "hadoken_light", "special", { nameJa: "弱波動拳" }),
      move(2, "hadoken_medium", "special", { nameJa: "中波動拳" }),
      move(3, "hadoken_od", "special", { nameJa: "OD波動拳" }),
    ]);
    expect(fams[0].nameJa).toBe("波動拳");
  });
});

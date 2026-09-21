import { describe, expect, it } from "vitest";

import { MOVE_CODE_DRIVE_REVERSAL } from "@/constants/move-code";
import type { Move } from "@/features/moves/types";

import {
  ATTACKS,
  DIRECTIONS,
} from "./components/VirtualController/HitBoxLayout";
import { deriveSpecialFamilies } from "./inputResolution";
import type { CommandIndexEntries } from "./inputResolutionStage2";
import {
  ALL_BUTTONS,
  ALL_DIRECTIONS,
  ALL_STRENGTHS,
  COMMON_MOVE_CODES,
  LEGACY_SYSTEM_ROW_CODES,
  characterStateMoves,
  expandStateCodes,
  isOnCommonTab,
  isControllerSurfaced,
  isInputExcluded,
  isOnSpecialTab,
  normalTabMoveIds,
  surfaceBuckets,
  surfaceOf,
} from "./moveSurfacing";

function move(
  id: number,
  code: string,
  category: string,
  extra: Partial<Move> = {},
): Move {
  return {
    id,
    characterId: 1,
    code,
    category,
    isAerial: false,
    setupOnly: false,
    isDerived: false,
    ...extra,
  };
}

// ★フィクスチャは M30-01 §2.3 の実測で出た 5 区分を**1 件ずつ**含む(指示書 §2.6-2)。
//   ⇒ 「出る」だけでなく「出ない」も、理由の区分ごとに検査する。
const MOVES: Move[] = [
  // --- 出る側 ---
  move(10, "standing_light_punch", "normal"), // 段階1
  move(11, "crouching_medium_kick", "normal"), // 段階1
  move(12, "jumping_heavy_punch", "normal", { isAerial: true }), // 段階1
  move(20, "rush_standing_light_punch", "rush_variant", { originalMoveId: 10 }),
  move(30, "collarbone_breaker", "unique"), // 特殊技タブ
  move(31, "rush_collarbone_breaker", "rush_variant", { originalMoveId: 30 }),
  move(40, "hadoken_light", "special", { nameJa: "弱波動拳" }),
  move(41, "hadoken_od", "special", { nameJa: "OD波動拳" }),
  move(50, "sa1", "super_art"),
  move(51, "ca", "critical_art"),
  move(60, "drive_impact", "drive_impact"),
  move(61, "throw_forward", "throw"),
  move(62, "dash_back", "system"),
  // --- 出ない側(区分ごとに 1 件) ---
  // ★★【2026-09-10 更新・M30-03】区分 A は**両枝とも必殺技タブへ載るようになった**。
  //   ⇒ **出ない側に必殺技は 1 件も残っていない。**
  //   A1(強度語がどこにも無い) = M30-02(P4M-016)で載った。
  //   A2(強度語が code の途中に在る) = M30-03 で載った。⇒ 出る側へ移した。
  move(70, "sonic_break", "special", { nameJa: "ソニックブレイク" }),
  move(71, "sonic_break_od", "special", { nameJa: "ODソニックブレイク" }),
  // A2: 状態版の必殺技。`light` / `od` は在るが末尾ではない。
  // ★★2 件置いてあるのは、**同じファミリーへ合流すること**を見るためである
  //   (followup §CL『素は押せるが OD が押せない』の解消がこの形である)。
  move(72, "lightning_beast_light_rolling_attack", "special", {
    nameJa: "[エレキ]弱ローリングアタック",
  }),
  move(73, "lightning_beast_od_rolling_attack", "special", {
    nameJa: "[エレキ]ODローリングアタック",
  }),
  // B: ターゲットコンボ(本サブでタブを足すまで面が無かった)。
  move(80, "bitter_strikes", "target_combo"),
  // C: rush_variant の孤児(基底 code と rush_ 名が一致しない)。
  //
  // ★★★合成フィクスチャである。実データに「基底が unique の孤児」は現存しない——
  //   M35-02 が ryu の 1 件(`axe_kick_2` / `rush_axe_kick`)を是正した結果 0 件になった。
  //   ⇒ 区分 C の挙動(孤児は未分類バケットへ落ちる)を守るために合成した。
  //
  // ★★実在する未分類の rush_variant は 4 件あるが、ここには置けない——
  //   `alex/rush_standing_heavy_punch_holding` / `alex/rush_standing_heavy_kick_holding` /
  //   `jamie/rush_drink_level_1_standing_light_punch` / `zangief/rush_standing_heavy_punch_holding`
  //   (2026-09-10 実測)。**いずれも基底が normal であり、落ちる理由も違う**——
  //   基底は実在するが HitBoxLayout の方向×強度×ボタンから到達できないためである。
  //   ⇒ 本フィクスチャが守るのは「基底が unique として実在しない」形のほうである。
  //
  // ★★ingrid / lily / mai の `_1hits` 4 件をここへ置いてはならない(2026-09-10 是正)。
  //   同 4 件は `original_move_code` の dangling であって `move_code` は正しく対応しており、
  //   **入力面には出ている**。落ちるのは別名生成のほう(followup `rush-original-move-code-typo`)。
  move(90, "example_unique_1hits", "unique"),
  move(91, "rush_example_unique_1", "rush_variant"),
  // D: 段階1/2 のどちらでも解決しない normal。
  move(100, "standing_heavy_punch_holding", "normal"),
  // E: 共通技行の固定 6 code 以外の投げ。
  move(110, "german_suplex", "throw"),
];

const NO_ENTRIES: CommandIndexEntries = {};

describe("normalTabMoveIds", () => {
  it("段階1 で解決する通常技とそのラッシュ版を集める", () => {
    const ids = normalTabMoveIds(MOVES, NO_ENTRIES);
    expect(ids.has(10)).toBe(true); // standing_light_punch
    expect(ids.has(11)).toBe(true); // crouching_medium_kick
    expect(ids.has(12)).toBe(true); // jumping_heavy_punch
    expect(ids.has(20)).toBe(true); // rush_standing_light_punch
  });

  it("★段階2 の解決表に載った特殊技も通常技タブから拾う(特殊技優先の畳み込み)", () => {
    const ids = normalTabMoveIds(MOVES, { "6MP": "collarbone_breaker" });
    expect(ids.has(30)).toBe(true);
    // ラッシュ版も同じ経路で到達できる(resolveDirectionalRushInput)。
    expect(ids.has(31)).toBe(true);
  });

  it("★解決表が空でも壊れない(段階1 だけが動く)", () => {
    expect(normalTabMoveIds(MOVES, NO_ENTRIES).has(30)).toBe(false);
  });
});

describe("isControllerSurfaced — 出る側", () => {
  const cases: ReadonlyArray<[string, number]> = [
    ["段階1 の通常技", 10],
    ["通常技のラッシュ版", 20],
    ["特殊技タブ(unique)", 30],
    ["特殊技のラッシュ版", 31],
    ["必殺技ファミリー(強度あり)", 40],
    ["必殺技ファミリー(OD)", 41],
    ["SA", 50],
    ["CA", 51],
    ["共通技タブ(DI)", 60],
    ["共通技タブ(前投げ)", 61],
    ["共通技タブ(後ろステップ)", 62],
    ["ターゲットコンボタブ", 80],
    // ★★M30-02(P4M-016): 強度を持たない必殺技(A1)が載るようになった。
    ["必殺技ファミリー(強度なし・A1)", 70],
    ["必殺技ファミリー(強度語が code の途中・A2。M30-03)", 72],
  ];
  for (const [label, id] of cases) {
    it(`${label} は面に出る`, () => {
      const m = MOVES.find((x) => x.id === id) as Move;
      expect(isControllerSurfaced(m, MOVES, NO_ENTRIES)).toBe(true);
    });
  }
});

describe("★isControllerSurfaced — 出ない側(理由の区分ごとに 1 件)", () => {
  const cases: ReadonlyArray<[string, number]> = [
    // ★★M30-03 で区分 A2 はここから消えた。⇒ **出ない側に category='special' は無い。**
    ["区分 C: rush_variant の孤児(基底 code と rush_ 名が不一致)", 91],
    ["区分 D: 段階1/2 のどちらでも解決しない normal(_holding)", 100],
    ["区分 E: 共通技行の 6 code 以外の投げ", 110],
  ];
  for (const [label, id] of cases) {
    it(`${label} は面に出ない`, () => {
      const m = MOVES.find((x) => x.id === id) as Move;
      expect(isControllerSurfaced(m, MOVES, NO_ENTRIES)).toBe(false);
    });
  }

  it("★★A1 は `_od` の兄弟と同じファミリーへ合流する(M30-02 / P4M-016)", () => {
    // ★着手時点は「ファミリー名は出るが OD しか押せない」形であり、seed 実測で
    //   95 件在った(M30-01 §2.5)。⇒ 素の版が載ったことで 0 件になった。
    const plain = MOVES.find((m) => m.code === "sonic_break") as Move;
    const od = MOVES.find((m) => m.code === "sonic_break_od") as Move;
    expect(isControllerSurfaced(plain, MOVES, NO_ENTRIES)).toBe(true);
    expect(isControllerSurfaced(od, MOVES, NO_ENTRIES)).toBe(true);
    const fam = deriveSpecialFamilies(MOVES).find(
      (f) => f.family === "sonic_break",
    );
    expect(fam?.byVariant.plain?.none).toBe(70);
    expect(fam?.byVariant.plain?.od).toBe(71);
  });

  it("★★A2 も素と OD が同じファミリーへ合流する(M30-03)", () => {
    // ★★followup §CL『素は押せるが OD が押せない』(7 組)の解消がこの形である。
    //   ⇒ 強度語の位置が違うだけの 2 行が、1 つのファミリーの別々の強度になる。
    // ★ファミリー名は**強度語 1 トークンだけ**を抜いた残りである。
    const fam = deriveSpecialFamilies(MOVES).find(
      (f) => f.family === "lightning_beast_rolling_attack",
    );
    expect(fam?.byVariant.plain?.light).toBe(72);
    expect(fam?.byVariant.plain?.od).toBe(73);
    // ★★`lightning_beast_light_rolling_attack` が「強度なしの別技」として
    //   独立したファミリーになっていないこと(そうなるとファミリーが技数だけ増える)。
    expect(
      deriveSpecialFamilies(MOVES).some(
        (f) => f.family === "lightning_beast_light_rolling_attack",
      ),
    ).toBe(false);
  });
});

describe("surfaceOf", () => {
  it("載る面を 1 つ返し、未分類は null を返す", () => {
    const find = (code: string) => MOVES.find((m) => m.code === code) as Move;
    expect(surfaceOf(find("standing_light_punch"), MOVES, NO_ENTRIES)).toBe(
      "normal",
    );
    expect(surfaceOf(find("collarbone_breaker"), MOVES, NO_ENTRIES)).toBe(
      "unique",
    );
    expect(surfaceOf(find("hadoken_od"), MOVES, NO_ENTRIES)).toBe("special");
    expect(surfaceOf(find("ca"), MOVES, NO_ENTRIES)).toBe("super_art");
    // ★★M30-03: A2 も必殺技タブへ載る。
    expect(
      surfaceOf(find("lightning_beast_light_rolling_attack"), MOVES, NO_ENTRIES),
    ).toBe("special");
    expect(surfaceOf(find("bitter_strikes"), MOVES, NO_ENTRIES)).toBe(
      "target_combo",
    );
    expect(surfaceOf(find("drive_impact"), MOVES, NO_ENTRIES)).toBe("common");
    // ★★M30-02(P4M-016): 強度を持たない必殺技(A1)は必殺技タブへ載る。
    expect(surfaceOf(find("sonic_break"), MOVES, NO_ENTRIES)).toBe("special");
  });
});

describe("surfaceBuckets", () => {
  it("★必殺技タブの述語が deriveSpecialFamilies と一致する(規則を 2 か所に持たない)", () => {
    const fromFamilies = new Set<number>();
    for (const fam of deriveSpecialFamilies(MOVES)) {
      // ★★変種軸(M30-02 / P4M-018)を足したので、全変種の全強度を集める。
      //   ★plain だけを見ると、ホールド版が「押せるのに未分類扱い」になっていないかを見逃す。
      for (const byStrength of Object.values(fam.byVariant)) {
        for (const id of Object.values(byStrength)) fromFamilies.add(id as number);
      }
    }
    const fromPredicate = new Set(
      MOVES.filter((m) => isOnSpecialTab(m)).map((m) => m.id),
    );
    expect([...fromPredicate].sort()).toEqual([...fromFamilies].sort());
  });

  it("未分類バケットは isControllerSurfaced が false の move と完全に一致する", () => {
    const buckets = surfaceBuckets(MOVES, NO_ENTRIES);
    // ★★M30-02(P4M-016)で A1、M30-03 で A2 が必殺技タブへ移った。
    //   ⇒ **残るのは必殺技以外の 3 区分だけである。**
    expect(buckets.unclassified.map((m) => m.code)).toEqual([
      "rush_example_unique_1",
      "standing_heavy_punch_holding",
      "german_suplex",
    ]);
  });

  it("ターゲットコンボバケットは category='target_combo' の全行である", () => {
    expect(
      surfaceBuckets(MOVES, NO_ENTRIES).targetCombo.map((m) => m.code),
    ).toEqual(["bitter_strikes"]);
  });

  it("★特殊技バケットはボタンとして並ぶ category='unique' だけを持つ(ラッシュ版は含めない)", () => {
    expect(surfaceBuckets(MOVES, NO_ENTRIES).unique.map((m) => m.code)).toEqual([
      "collarbone_breaker",
      "example_unique_1hits",
    ]);
  });

  it("SA バケットは super_art と critical_art の両方を持つ", () => {
    expect(surfaceBuckets(MOVES, NO_ENTRIES).superArt.map((m) => m.code)).toEqual(
      ["sa1", "ca"],
    );
  });
});

describe("★入力面の母集合が HitBoxLayout と一致する(M30-01 レビュー 高-2)", () => {
  // ★★片方だけ方向やボタンが増えると、「押せるのに未分類扱い」または
  //   「未分類なのに押せる」が静かにずれる。⇒ 注記ではなく検査で守る。
  it("方向は HitBoxLayout の DIRECTIONS と同じ集合である", () => {
    expect([...ALL_DIRECTIONS].sort()).toEqual(
      DIRECTIONS.map((d) => d.dir).sort(),
    );
  });

  it("強度 × ボタンは HitBoxLayout の ATTACKS と同じ集合である", () => {
    const fromSurfacing = ALL_STRENGTHS.flatMap((s) =>
      ALL_BUTTONS.map((b) => `${s}_${b}`),
    ).sort();
    const fromLayout = ATTACKS.map((a) => `${a.strength}_${a.button}`).sort();
    expect(fromSurfacing).toEqual(fromLayout);
  });
});

describe("★共通技タブ(M30-01 追補・常設行からの移設)", () => {
  it("★移設前の常設行の 6 code は 1 つ残らず共通技タブに在る", () => {
    // ★★移設で押せなくなった code が出ないことを固定する。
    for (const code of LEGACY_SYSTEM_ROW_CODES) {
      expect(COMMON_MOVE_CODES).toContain(code);
    }
  });

  it("★移動系 7 code も共通技タブに在る(移設前はどの面にも出ていなかった)", () => {
    for (const code of [
      "forward",
      "back",
      "micro_forward",
      "micro_back",
      "jump_neutral",
      "jump_forward",
      "jump_back",
    ]) {
      expect(COMMON_MOVE_CODES).toContain(code);
    }
  });

  it("★生ラッシュは共通技タブの move には含めない(move ではなく modifiers.type)", () => {
    expect(COMMON_MOVE_CODES).not.toContain("parry_drive_rush");
  });

  it("バケットは COMMON_MOVE_CODES の並び順で返す(seed の行順ではない)", () => {
    const ms = [
      move(300, "dash_back", "system"),
      move(301, "forward", "system"),
      move(302, "drive_impact", "drive_impact"),
    ];
    expect(surfaceBuckets(ms, NO_ENTRIES).common.map((m) => m.code)).toEqual([
      "forward",
      "drive_impact",
      "dash_back",
    ]);
  });

  it("seed に無い共通技はバケットに入らない(データ駆動)", () => {
    expect(isOnCommonTab(move(303, "micro_forward", "system"))).toBe(true);
    expect(surfaceBuckets([], NO_ENTRIES).common).toEqual([]);
  });
});

describe("★キャラ固有状態タブは掲載済みに数える(2026-09-08 開発者判断・案 C)", () => {
  // ★★【2026-09-10 更新・M30-03】402 は `flame_od_kachousen`(special)だった。
  //   ⇒ 本サブで必殺技タブへ載るようになったため、「他のどのタブにも出ない」役を
  //     果たせなくなった。**緑にするために状態タブの主張を弱めない**——役だけ差し替える。
  //   ★★差し替え先は**合成 code である**。M30-03 後の実 seed には
  //     「未分類に残り、かつ状態 code を含む」行が 1 件も無いため(実測)。
  //     形は実在のものに寄せた —— mai の未分類は `air_throw`(共通技 13 code 以外の投げ)であり、
  //     状態 code は `flame_stock`(語幹 `flame`)である。
  const ms = [
    move(400, "standing_light_punch", "normal"),
    move(401, "drink_level_4_ransui_haze", "target_combo"),
    move(402, "flame_air_throw", "throw"),
  ];

  it("★状態 code を渡すと、その技は未分類へ落ちない", () => {
    // ★`flame_air_throw` は共通技 13 code に無い投げであり、どのタブにも出ない。
    //   ⇒ 案 C の前は未分類へ落ちていた。
    expect(surfaceBuckets(ms, NO_ENTRIES).unclassified.map((m) => m.code)).toEqual([
      "flame_air_throw",
    ]);
    expect(
      surfaceBuckets(ms, NO_ENTRIES, ["flame_stock"]).unclassified,
    ).toEqual([]);
  });

  it("★同じ技が未分類と固有状態の両方には出ない(重なりの解消)", () => {
    const b = surfaceBuckets(ms, NO_ENTRIES, ["flame_stock"]);
    const stateCodes = new Set(b.characterState.map((m) => m.code));
    for (const m of b.unclassified) expect(stateCodes.has(m.code)).toBe(false);
  });
});

describe("★expandStateCodes(舞の対応・案 A′)", () => {
  it("後置語を落とした語幹も照合対象に加える", () => {
    expect(expandStateCodes(["flame_stock"]).sort()).toEqual([
      "flame",
      "flame_stock",
    ]);
  });

  it("後置語を持たない code はそのまま 1 件", () => {
    expect(expandStateCodes(["drink_level"])).toEqual(["drink_level"]);
  });

  it("★★舞が拾えるようになる(状態 flame_stock / 技 flame_*)", () => {
    const ms = [move(500, "flame_light_kachousen", "special")];
    expect(characterStateMoves(ms, ["flame_stock"]).map((m) => m.code)).toEqual([
      "flame_light_kachousen",
    ]);
  });

  it("★それでも救えない形が在る(m_bison: 状態 psycho_mine_is_set / 技 mine_set_*)", () => {
    // ★この形が増えるなら状態定義に技の接頭辞を持たせる案 D へ移る(完了報告 §6)。
    // ★実データの逐語: 状態は `psycho_mine_is_set`、技は `mine_set_light_psycho_crusher_attack`。
    //   語幹 `psycho_mine` を作っても技側の語順が違うため当たらない。
    const ms = [move(501, "mine_set_light_psycho_crusher_attack", "special")];
    expect(characterStateMoves(ms, ["psycho_mine_is_set"])).toEqual([]);
  });
});

describe("characterStateMoves(M30-01 / P4M-008 (b))", () => {
  const STATE_MOVES: Move[] = [
    move(200, "standing_light_punch", "normal"),
    move(201, "drink_level_3_hermits_elbow", "unique"),
    move(202, "drink_level_4_senei_kick", "unique"),
    move(203, "sa2_feng_shui_engine", "super_art"),
  ];

  it("stateCodes が空なら空配列を返す(定義を持たないキャラ)", () => {
    expect(characterStateMoves(STATE_MOVES, [])).toEqual([]);
  });

  it("move_code が状態 code を含む行だけを部分一致で拾う", () => {
    expect(
      characterStateMoves(STATE_MOVES, ["drink_level"]).map((m) => m.code),
    ).toEqual(["drink_level_3_hermits_elbow", "drink_level_4_senei_kick"]);
  });

  it("★SA の偽陽性を意図的に落とさない(状態を発生させる技そのものであるため)", () => {
    // ★この判断をテストで固定する。★次の担当が「無関係な SA が混ざっている」として
    //   静かに落とさないようにするためであり、緩さではない(レビュー 中-3)。
    expect(
      characterStateMoves(STATE_MOVES, ["feng_shui_engine"]).map((m) => m.code),
    ).toEqual(["sa2_feng_shui_engine"]);
  });

  it("複数の状態 code のいずれかに当たれば拾う", () => {
    expect(
      characterStateMoves(STATE_MOVES, ["drink_level", "feng_shui_engine"]),
    ).toHaveLength(3);
  });
});

// ★★M31-05: 設置系 state の code の付け方を語幹の側から固定する。
//
//   ★★指示書 M31-05 §4.2 が名指しした危険がここに在る——**「足したのにタブに出ない」は
//     検査が緑のまま起きる**。⇒ 語幹化される後置語と、されない語を対で押さえる。
describe("★★M31-05: 設置系 state の後置語と語幹(指示書 §4.2)", () => {
  const DHALSIM: Move[] = [
    move(300, "yoga_arch_light", "special"),
    move(301, "yoga_arch_medium", "special"),
    move(302, "yoga_arch_heavy", "special"),
    move(303, "yoga_arch_od", "special"),
  ];

  it("`_is_set` は語幹化される(⇒ ファミリー全変種に当たる)", () => {
    expect(expandStateCodes(["yoga_arch_is_set"]).sort()).toEqual([
      "yoga_arch",
      "yoga_arch_is_set",
    ]);
    expect(characterStateMoves(DHALSIM, ["yoga_arch_is_set"]).map((m) => m.code)).toEqual([
      "yoga_arch_light",
      "yoga_arch_medium",
      "yoga_arch_heavy",
      "yoga_arch_od",
    ]);
  });

  // ★★`_set` は STATE_CODE_SUFFIXES に無い。⇒ `shuriken_bomb_set` のような命名は
  //   語幹を持たず、1 件も当たらない。実測で踏んだ落とし穴そのものである。
  it("★★`_set` 単独では語幹化されない(⇒ 1 件も当たらない)", () => {
    expect(expandStateCodes(["yoga_arch_set"])).toEqual(["yoga_arch_set"]);
    expect(characterStateMoves(DHALSIM, ["yoga_arch_set"])).toEqual([]);
  });

  // ★★案 (ii)(変種ごとに別 code)が壊す形。⇒ 案 (vi) を採った根拠の 1 本である。
  it("★★変種ごとに code を分けると 1 件も当たらない(案 (ii) の代償)", () => {
    expect(
      characterStateMoves(DHALSIM, [
        "yoga_arch_set_light",
        "yoga_arch_set_medium",
        "yoga_arch_set_heavy",
        "yoga_arch_set_od",
      ]),
    ).toEqual([]);
  });

  // ★発動中の状態は素の code を使う(先例＝lightning_beast / feng_shui_engine)。
  it("発動中の状態は素の code で SA の行に当たる", () => {
    const jp: Move[] = [move(310, "sa2_lovushka", "super_art")];
    expect(characterStateMoves(jp, ["lovushka"]).map((m) => m.code)).toEqual([
      "sa2_lovushka",
    ]);
  });
});

// ★★M31-04(SM-098): 入力面へ一切出さない技。
//
//   「どのタブにも載らない」と「入力面に出さない」は別物である。前者は未分類タブへ落ち、
//   結局は押せてしまう。⇒ 未分類からも外れて初めて「出さない」になる。
describe("★isInputExcluded — 入力面へ一切出さない技(M31-04)", () => {
  const driveReversal = move(900, MOVE_CODE_DRIVE_REVERSAL, "system");
  const ms: Move[] = [...MOVES, driveReversal];

  it("drive_reversal は入力面から外れている", () => {
    expect(isInputExcluded(driveReversal, "combo")).toBe(true);
  });

  it("★未分類タブにも並ばない(「何もしない」は「出さない」にならない)", () => {
    // ★前提の確認: 除外が無ければ未分類に落ちる形の技である。
    expect(isControllerSurfaced(driveReversal, ms, NO_ENTRIES)).toBe(false);
    const codes = surfaceBuckets(ms, NO_ENTRIES).unclassified.map((m) => m.code);
    expect(codes).not.toContain(MOVE_CODE_DRIVE_REVERSAL);
  });

  it("★共通技タブの固定 13 code には触っていない(指示書 §3-2)", () => {
    expect(COMMON_MOVE_CODES).not.toContain(MOVE_CODE_DRIVE_REVERSAL);
    expect(COMMON_MOVE_CODES).toHaveLength(13);
  });

  it("★対照: 同じ category=system の共通技は除外されない(code 単位である)", () => {
    const dashBack = MOVES.find((m) => m.code === "dash_back") as Move;
    expect(isInputExcluded(dashBack, "combo")).toBe(false);
  });
});

// ★★★M31-06(P4M-005 のフェーズ4 分): `setup_only` をコンボの入力面から外す経路。
//
//   ★★★本サブ最大の検査上の困難 —— 実 DB の `moves.setup_only = 1` は **0 件**である
//     (M31-RESEARCH-01 の実測)。⇒ 経路が 1 行も効いていなくても、既存のテストも E2E も
//     全部緑のままである。**「入れた」を「効く」の証拠と読ませないこと**(指示書 §4.4)。
//   ⇒ 以下は**テストの中だけででっち上げた 1 群**を使う陽性対照である。
//     migrations/ へは 1 行も入れていない。本番データは 0 件のままである(指示書 §2.3-3)。
//
//   ★★対照の作り方 —— **同じ入力を 2 つの面へ通す。**
//     コンボ側で「消えること」だけを測ると、**元から居なかった**場合と区別できない
//     (チェックリスト D-3)。⇒ セットプレイ側で「残ること」を必ず対にして測る。
describe("★★setup_only — コンボの入力面からだけ外す(M31-06)", () => {
  // でっち上げ: **タブに載る形を一通り**。★setup_only は任意の category に立ちうるため、
  //   「未分類に落ちる形」だけを試すと、タブ側に効いていない実装でも緑になる。
  const suNormal = move(1000, "crouching_light_kick", "normal", {
    setupOnly: true,
  });
  const suUnique = move(1010, "su_shoulder", "unique", { setupOnly: true });
  const suSpecial = move(1020, "su_trap_light", "special", {
    setupOnly: true,
    nameJa: "弱トラップ",
  });
  const suSuperArt = move(1030, "su_sa3", "super_art", { setupOnly: true });
  const suTargetCombo = move(1040, "su_tc", "target_combo", {
    setupOnly: true,
  });
  // ★共通技タブは固定 13 code の並びである。MOVES は dash_forward を持たない。
  const suCommon = move(1050, "dash_forward", "system", { setupOnly: true });
  // ★どのタブにも載らない形(未分類へ落ちる)。
  const suUnclassified = move(1060, "su_orphan_throw", "throw", {
    setupOnly: true,
  });
  const driveReversal = move(1090, MOVE_CODE_DRIVE_REVERSAL, "system");

  const SETUP_ONLY_MOVES: Move[] = [
    suNormal,
    suUnique,
    suSpecial,
    suSuperArt,
    suTargetCombo,
    suCommon,
    suUnclassified,
  ];
  const ms: Move[] = [...MOVES, ...SETUP_ONLY_MOVES, driveReversal];

  const comboBuckets = () => surfaceBuckets(ms, NO_ENTRIES, [], "combo");
  const setupBuckets = () => surfaceBuckets(ms, NO_ENTRIES, [], "setup");

  describe("判定そのもの", () => {
    it("★setup_only はコンボ側で外れ、セットプレイ側では外れない", () => {
      for (const m of SETUP_ONLY_MOVES) {
        expect(isInputExcluded(m, "combo"), `${m.code} / combo`).toBe(true);
        expect(isInputExcluded(m, "setup"), `${m.code} / setup`).toBe(false);
      }
    });

    it("★★drive_reversal は面に関係なく外れる(静的な code 列挙は面で分かれない)", () => {
      // ★★これが崩れると M31-04 の除外がセットプレイ側へ漏れる(チェックリスト C-3)。
      //   ⇒ 「面で分ける」を入れた本サブが踏みうる唯一の後退である。
      expect(isInputExcluded(driveReversal, "combo")).toBe(true);
      expect(isInputExcluded(driveReversal, "setup")).toBe(true);
    });

    it("★対照: setup_only が立っていない同 category の技は両面で残る", () => {
      const plainUnique = MOVES.find((m) => m.code === "collarbone_breaker") as Move;
      const plainSpecial = MOVES.find((m) => m.code === "hadoken_light") as Move;
      for (const m of [plainUnique, plainSpecial]) {
        expect(isInputExcluded(m, "combo"), `${m.code} / combo`).toBe(false);
        expect(isInputExcluded(m, "setup"), `${m.code} / setup`).toBe(false);
      }
    });
  });

  describe("仮想コントローラ 8 タブ(★未分類を含む)", () => {
    it("★★コンボ側: どのバケットにも母集団にも 1 件も出ない", () => {
      const b = comboBuckets();
      const everywhere = [
        ...b.inputMoves,
        ...b.unique,
        ...b.superArt,
        ...b.targetCombo,
        ...b.common,
        ...b.characterState,
        ...b.unclassified,
      ].map((m) => m.code);
      for (const m of SETUP_ONLY_MOVES) {
        expect(everywhere, `${m.code} が入力面に残っている`).not.toContain(
          m.code,
        );
      }
    });

    it("★★★陽性対照: セットプレイ側では同じ技が該当タブに出る", () => {
      // ★★これが無いと「コンボ側に出ない」は「元から居なかった」と区別できない
      //   (チェックリスト D-3)。⇒ タブごとに、出る先を名指しして測る。
      const b = setupBuckets();
      expect(b.unique.map((m) => m.code)).toContain("su_shoulder");
      expect(b.superArt.map((m) => m.code)).toContain("su_sa3");
      expect(b.targetCombo.map((m) => m.code)).toContain("su_tc");
      expect(b.common.map((m) => m.code)).toContain("dash_forward");
      expect(b.unclassified.map((m) => m.code)).toContain("su_orphan_throw");
      expect(b.inputMoves.map((m) => m.code)).toContain("su_trap_light");
    });

    it("★★通常技タブ(バケットを持たない・押下時に解決する面)にも効く", () => {
      // ★同タブは surfaceBuckets の配列ではなく resolveDirectionalInput が決める。
      //   ⇒ 母集団 inputMoves を絞らないと、ここにだけ除外が効かない。
      const comboIds = normalTabMoveIds(comboBuckets().inputMoves, NO_ENTRIES);
      const setupIds = normalTabMoveIds(setupBuckets().inputMoves, NO_ENTRIES);
      expect(comboIds.has(suNormal.id)).toBe(false);
      // ★陽性対照: セットプレイ側では押せる = 元から到達可能な形である。
      expect(setupIds.has(suNormal.id)).toBe(true);
    });

    it("★★必殺技タブ(ファミリー UI・同じくバケットを持たない)にも効く", () => {
      const comboFamilies = deriveSpecialFamilies(
        comboBuckets().inputMoves,
      ).map((f) => f.family);
      const setupFamilies = deriveSpecialFamilies(
        setupBuckets().inputMoves,
      ).map((f) => f.family);
      expect(comboFamilies).not.toContain("su_trap");
      // ★陽性対照: 外さなければファミリーとして立つ形である。
      expect(setupFamilies).toContain("su_trap");
    });

    it("★★キャラ固有状態タブにも効く", () => {
      const suState = move(1070, "flame_su_kachousen", "special", {
        setupOnly: true,
      });
      const withState = [...ms, suState];
      const stateCodes = ["flame_stock"];
      expect(
        surfaceBuckets(withState, NO_ENTRIES, stateCodes, "combo")
          .characterState.map((m) => m.code),
      ).not.toContain("flame_su_kachousen");
      // ★陽性対照。
      expect(
        surfaceBuckets(withState, NO_ENTRIES, stateCodes, "setup")
          .characterState.map((m) => m.code),
      ).toContain("flame_su_kachousen");
    });

    it("★★★drive_reversal は両面で未分類にも並ばない(C-3 の後退検出)", () => {
      for (const context of ["combo", "setup"] as const) {
        const b = surfaceBuckets(ms, NO_ENTRIES, [], context);
        const everywhere = [
          ...b.inputMoves,
          ...b.unclassified,
          ...b.common,
        ].map((m) => m.code);
        expect(everywhere, `${context} 面`).not.toContain(
          MOVE_CODE_DRIVE_REVERSAL,
        );
      }
    });
  });

  describe("既存の技を 1 件も減らしていないこと", () => {
    it("★setup_only が 0 件なら、面ごとの中身は両面で完全に同じである", () => {
      // ★★これが実 DB の状態である(setup_only = 1 は 0 件)。
      //   ⇒ 本サブを入れても画面の見え方は 1 か所も変わらない、の実測。
      const plain = [...MOVES, driveReversal];
      const asCombo = surfaceBuckets(plain, NO_ENTRIES, [], "combo");
      const asSetup = surfaceBuckets(plain, NO_ENTRIES, [], "setup");
      // ★★全バケットを比べる(M31-06 レビュー 低-3)。⇒ 2 バケットだけだと
      //   「面ごとの中身が完全に同じ」という主張よりテストの実物が狭い。
      const keys = [
        "inputMoves",
        "unique",
        "superArt",
        "targetCombo",
        "common",
        "characterState",
        "unclassified",
      ] as const;
      for (const key of keys) {
        expect(
          asCombo[key].map((m) => m.code),
          `バケット ${key}`,
        ).toEqual(asSetup[key].map((m) => m.code));
      }
    });

    it("★対照: setup_only を混ぜても、元から居た技の並びは 1 件も動かない", () => {
      const before = surfaceBuckets(
        [...MOVES, driveReversal],
        NO_ENTRIES,
        [],
        "combo",
      );
      const after = comboBuckets();
      expect(after.unclassified.map((m) => m.code)).toEqual(
        before.unclassified.map((m) => m.code),
      );
      expect(after.unique.map((m) => m.code)).toEqual(
        before.unique.map((m) => m.code),
      );
      expect(after.superArt.map((m) => m.code)).toEqual(
        before.superArt.map((m) => m.code),
      );
      expect(after.targetCombo.map((m) => m.code)).toEqual(
        before.targetCombo.map((m) => m.code),
      );
    });
  });
});

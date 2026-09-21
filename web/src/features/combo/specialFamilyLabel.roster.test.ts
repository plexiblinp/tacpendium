import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { deriveSpecialFamilies } from "./inputResolution";
import {
  CHARACTER_FILES,
  characterCode,
  loadCharacter,
} from "./seedRoster.fixture";

// ★★M30-05: ファミリー行の表示名に残る強度語を、seed CSV 全数で固定するテスト。
//
// ★★★本サブの核は「落とすこと」ではなく「落としてはいけない行を見分けること」である。
//   ⇒ (A) 群が落ちたことだけを主張しても足りない。(B) 群が残ったことも同じ強さで主張する。
//
// ★★★母集団は `character_data/*.csv`(31 キャラ 2743 行)である。実 DB の `moves` とは
//   一致しない —— **実測 3057 行 / 差 314 行**(2026-09-12・`schema_migrations` = 111 の
//   使い捨て DB で数えた)。**★`moveSurfacing.roster.test.ts` 冒頭の「3026 行 / 差 283 行」は
//   `M30-03` 時点の値であり、`000109`(drive_reversal × 31 キャラ)のぶん失効している。**
//   ⇒ 差はいずれもマイグレーションが直接投入する行であり、`category='special'` を含まない。
//   ★実測で `special` は DB 1024 行 = CSV 1024 行であり、ファミリー行の総数も一致する(372)。
//
// ★★判定の正規表現は**本ファイルで独自に書く**。実装(`stripStrengthLabel`)を import しない。
//   ⇒ 実装と同じ式を共有すると、実装が間違った方向へ動いたとき期待値も一緒に動いてしまい、
//     何も検出しなくなる(`M30-04` 教訓 §7-4＝陽性対照は実装と独立な軸から作る)。
const HEAD_BRACKET_STRENGTH = /^(?:【[^】]*】|\[[^\]]*\])(?:弱|中|強|OD)/u;
const PAREN_STRENGTH = /[(（][^)）]*(?:弱|中|強|OD)[^)）]*[)）]/u;
// ★★装飾集合そのものは実装の書き写しである(【】 と [])。⇒ 装飾に取りこぼしがあれば
//   実装もこの判定式も同じ盲点を持つ。そこで「開き括弧全般」で始まる行を別に数え、
//   新しい種類の括弧が seed へ入ったら件数と先頭文字の差として現れるようにする。
const DECORATION_START = /^\p{Ps}/u;

/** 全キャラのファミリー行を `{ character, family, nameJa, isDerived }` の平坦な配列にする。 */
function allFamilies() {
  return CHARACTER_FILES.flatMap((file) =>
    deriveSpecialFamilies(loadCharacter(file)).map((f) => ({
      character: characterCode(file),
      family: f.family,
      nameJa: f.nameJa,
      isDerived: f.isDerived,
    })),
  );
}

// ★★(A) 群＝先頭ブラケット直後の強度語がその技自身の強度である行(全 20 行)。
//   実査(M30-05 段 1)で全行が light+medium+heavy(+od) を持ち、
//   代表名の出どころも `_light` 側の行であることを確認している。
//   ⇒ 期待値は「ブラケットを残したまま強度語だけが落ちた形」である。
//
// ★★★【2026-09-12 更新・M30-07】23 → 20。**規則が緩んだのではない。**
//   guile の 3 行(`perfect_timing_sonic_boom` / `perfect_timing_somersault_kick` /
//   `perfect_timing_sonic_cross`)は、【ジャスト】版の `move_code` が接尾形へ揃った結果
//   **ファミリー行ではなくなった**——基底 `sonic_boom` / `somersault_kick` / `sonic_cross` の
//   **perfect 変種**として畳まれたからである。⇒ 「落ちる行」ではなく「行そのもの」が消えた。
//   ★★主張は 1 本も減らしていない。同じ 3 概念について、下の
//     EXPECTED_FOLDED_PERFECT が「基底の perfect 変種として在ること」を主張する。
//     ⇒ (A) 群 20 件 ＋ 畳まれた 3 件 = 23 件。着手前と同数である。
const EXPECTED_STRIPPED: ReadonlyArray<readonly [string, string, string]> = [
  ["blanka", "lightning_beast_rolling_attack", "【ライトニングビースト】ローリングアタック"],
  [
    "blanka",
    "lightning_beast_vertical_rolling_attack",
    "【ライトニングビースト】バーチカルローリングアタック",
  ],
  [
    "blanka",
    "lightning_beast_backstep_rolling_attack",
    "【ライトニングビースト】バックステップローリング",
  ],
  [
    "blanka",
    "lightning_beast_aerial_rolling_attack",
    "【ライトニングビースト】エリアルローリング",
  ],
  ["c_viper", "thunder_dash_feint", "【サンダースラップ】フェイント"],
  ["c_viper", "high_jump_aerial_burning_kick", "【ハイジャンプ】空中バーニングキック"],
  ["e_honda", "sumo_spirit_hundred_hand_slap", "[肩屋入り版]百裂張り手"],
  ["jamie", "drink_level_4_freeflow_strikes_1hit", "[酔いレベル4]流酔拳(単発)"],
  ["jamie", "drink_level_4_freeflow_strikes", "[酔いレベル4]流酔拳"],
  ["lily", "windclad_condor_spire", "[風纏い]コンドルスパイア"],
  ["lily", "windclad_tomahawk_buster", "[風纏い]トマホークバスター"],
  [
    "m_bison",
    "mine_set_psycho_crusher_attack",
    "[サイコマイン付着中]サイコクラッシャーアタック",
  ],
  ["m_bison", "mine_set_backfist_combo", "[サイコマイン付着中]バックフィストコンボ"],
  ["mai", "flame_kachousen", "[焔版]花蝶扇"],
  ["mai", "flame_ryuuenbu", "[焔版]龍炎舞"],
  ["mai", "flame_hissatsu_shinobi_bachi", "[焔版]必殺忍蜂"],
  ["mai", "flame_hishou_ryuuenjin", "[焔版]飛翔龍炎陣"],
  ["rashid", "buffed_spinning_mixer", "【強化】スピニング・ミキサー"],
  ["rashid", "buffed_eagle_spike", "【強化】イーグル・スパイク"],
  ["yasmine", "bayani_alon", "【バヤニ】アロン"],
];

// ★★(B) 群＝丸括弧の中の強度語が**派生元**の強度である行。落とすと意味が壊れる(指示書 §0.3)。
//   ★特に OD だけを持つ兄弟 3 行(`cannon_strike_{light,medium,heavy}_od_hooligan_combination`)は、
//     強度語を落とすと**3 行が同一表示になり区別できなくなる**。
//
// ★★★【2026-09-12・M30-06 更新】`cammy/cannon_strike_hooligan_combination` を本表から外した。
//   ⇒ 同行は **M30-06 の対象**であり、代表名が「弱…派生」で固定されていた 4 行の 1 つである。
//   ★落とし方が違う ——(B) 群の規則(丸括弧の中は見ない)は 1 文字も変えていない。
//     変わったのは**代表名の作り方**であり、ファミリーの中でメンバーの名前が
//     「強度語だけ」違うときに、その強度語を落とすようになった。
//   ★同行の新しい表示名は specialFamilyRepresentativeName.roster.test.ts が逐語で固定する。
const EXPECTED_PRESERVED: ReadonlyArray<readonly [string, string, string]> = [
  ["akuma", "demon_swoop_side_switch", "百鬼潜影(中強百鬼襲・裏回り)"],
  [
    "cammy",
    "cannon_strike_light_od_hooligan_combination",
    "キャノンストライク(弱ODフーリガン派生)",
  ],
  [
    "cammy",
    "cannon_strike_heavy_od_hooligan_combination",
    "キャノンストライク(強ODフーリガン派生)",
  ],
  // ★★先頭以外のブラケットは見ない —— 括弧の中の【ホールド】直後の「強」は落とさない。
  [
    "cammy",
    "fatal_leg_twister_hooligan_combination_holding",
    "フェイタルレッグツイスター(【ホールド】強フーリガンコンビネーション派生)",
  ],
  ["elena", "lynx_whirl_od_spinning_scythe", "リンクスワール(ODスピンサイズ派生)"],
  ["ken", "kasai_thrust_kick", "火砕蹴(OD風鎌蹴り派生)"],
];

// ★★★【2026-09-12 新設・M30-07】(A) 群から抜けた 3 概念の行き先を、同じ強さで主張する。
//   `[基底 family, 期待する基底の代表名, 変種側の move の name_ja]` の 3 つ組。
//
// ★★見るのは 3 つである——(i) 基底ファミリーが実在し代表名が正しいこと、
//   (ii) その基底が `perfect` 変種を持つこと、(iii) 変種側の move の表示名には
//   **【ジャスト】が残っていること**(本サブが触ったのは識別子だけであり `name_ja` ではない)。
//   ⇒ (iii) を落とすと「畳めたが名前も消えた」を通してしまう。
const EXPECTED_FOLDED_PERFECT: ReadonlyArray<
  readonly [string, string, string]
> = [
  ["sonic_boom", "ソニックブーム", "【ジャスト】弱ソニックブーム"],
  ["somersault_kick", "サマーソルトキック", "【ジャスト】弱サマーソルトキック"],
  ["sonic_cross", "ソニッククロス", "【ジャスト】弱ソニッククロス"],
];

// ★★(C)/(D) 群＝そもそも落としてはいけない形。
//   (C) 固有名の一部(ingrid の「ODサンシュート」。この行の強度は弱/中/強であり OD は技名側)。
//   (D) 強度語ではない誤検出(「空中」の中 / 「強化」の強 / 「付着中」の中)。
const EXPECTED_UNTOUCHED: ReadonlyArray<readonly [string, string, string]> = [
  ["ingrid", "od_sun_shot", "ODサンシュート"],
  ["ryu", "aerial_tatsumaki_senpu_kyaku", "空中竜巻旋風脚"],
  ["elena", "buffed_leopard_snap", "【強化】レオパードスナップ"],
  ["m_bison", "mine_set_devil_reverse", "[サイコマイン付着中]デビルリバース"],
];

describe("★M30-05 ファミリー行の表示名に残る強度語(seed CSV 全数)", () => {
  it("★★陽性対照: 入力側に「先頭ブラケット直後の強度語」を持つ special 行が 135 行実在する", () => {
    // ★★★「無い」だけを測ると、元から無かった行と区別できない(指示書 §4.2)。
    //   ⇒ 落とす前の入力に、その形が実在したことを先に固定する。
    // ★本主張は `deriveSpecialFamilies` の出力を見ていない —— CSV の生 `name_ja` だけを見る。
    const rows = CHARACTER_FILES.flatMap((file) => loadCharacter(file)).filter(
      (m) => m.category === "special" && HEAD_BRACKET_STRENGTH.test(m.nameJa ?? ""),
    );
    expect(rows.length).toBe(135);
  });

  it("★★装飾始まりの special 行は 157 行で、先頭は 【 と [ の 2 種だけである", () => {
    // ★★実装(LEADING_DECORATION)もこの spec の HEAD_BRACKET_STRENGTH も、装飾を
    //   「【…】 と […]」の 2 形だと決め打っている。⇒ 3 種目が seed へ入ったら、
    //   どちらも静かに取りこぼす(落とすべき行が落ちないまま緑になる)。
    //   本主張は開き括弧全般(\p{Ps})で数えるため、その取りこぼしが件数と
    //   先頭文字の差として必ず現れる。
    const leads = CHARACTER_FILES.flatMap((file) => loadCharacter(file))
      .filter((m) => m.category === "special" && DECORATION_START.test(m.nameJa ?? ""))
      .map((m) => (m.nameJa ?? "")[0]);
    expect(leads).toHaveLength(157);
    expect([...new Set(leads)].sort()).toEqual(["[", "【"]);
  });

  it("★★★(A) 群: 導出後のファミリー行に「先頭ブラケット直後の強度語」は 1 件も残らない", () => {
    const remaining = allFamilies().filter((f) =>
      HEAD_BRACKET_STRENGTH.test(f.nameJa ?? ""),
    );
    expect(remaining.map((f) => `${f.character}/${f.family} = ${f.nameJa}`)).toEqual([]);
  });

  it("★★★(A) 群 20 行の表示名は、ブラケットを残したまま強度語だけが落ちた形である", () => {
    const index = new Map(
      allFamilies().map((f) => [`${f.character}/${f.family}`, f.nameJa]),
    );
    for (const [character, family, expected] of EXPECTED_STRIPPED) {
      expect(index.get(`${character}/${family}`)).toBe(expected);
    }
    expect(EXPECTED_STRIPPED).toHaveLength(20);
  });

  it("★★★M30-07: (A) 群から抜けた 3 概念は、基底の perfect 変種として在る", () => {
    // ★★これが「23 → 20 は緩めたのではない」ことの対照である。
    //   ⇒ 行が消えたのではなく、基底ファミリーの変種軸へ移った。
    const fams = deriveSpecialFamilies(loadCharacter("guile.csv"));
    const moves = loadCharacter("guile.csv");
    for (const [family, expectedLabel, variantName] of EXPECTED_FOLDED_PERFECT) {
      const fam = fams.find((f) => f.family === family);
      expect(fam, `${family} がファミリー行に無い`).toBeDefined();
      // (i) 基底の代表名。★【ジャスト】は付かない(代表名は plain 側から採るため)。
      expect(fam?.nameJa).toBe(expectedLabel);
      // (ii) perfect 変種を持つこと。★これが畳まれたことの直接の証拠である。
      expect(fam?.variants).toContain("perfect");
      // (iii) 変種側の move の表示名には【ジャスト】が残っていること。
      //   ★本サブが触ったのは識別子だけであり `name_ja` は 1 文字も変えていない。
      const perfectIDs = new Set(Object.values(fam?.byVariant.perfect ?? {}));
      const names = moves.filter((m) => perfectIDs.has(m.id)).map((m) => m.nameJa);
      expect(names).toContain(variantName);
    }
    // ★空ループ避け。
    expect(EXPECTED_FOLDED_PERFECT).toHaveLength(3);
  });

  it("★★★(B) 群: 丸括弧の中の強度語(派生元の強度)は 18 行すべて残る", () => {
    // ★落とすと意味が壊れる(指示書 §0.3 / §3-3)。件数と逐語の両方で固定する。
    // ★★★【2026-09-12・M30-06 更新】22 → 18。減った 4 件は M30-06 の対象行であり、
    //   **丸括弧の中を見る規則が変わったのではない**。⇒ それらの行は代表名の作り方が
    //   変わった結果、そもそも「弱…派生」を代表名に採らなくなった。
    //   ★残る 18 件は 1 件も落ちていない(＝(B) 群の規則は不変である)。
    const families = allFamilies();
    expect(families.filter((f) => PAREN_STRENGTH.test(f.nameJa ?? ""))).toHaveLength(18);
    const index = new Map(families.map((f) => [`${f.character}/${f.family}`, f.nameJa]));
    for (const [character, family, expected] of EXPECTED_PRESERVED) {
      expect(index.get(`${character}/${family}`)).toBe(expected);
    }
  });

  it("★★(C)/(D) 群: 固有名の一部と、強度語でない字(空中/強化/付着中)は触らない", () => {
    const index = new Map(
      allFamilies().map((f) => [`${f.character}/${f.family}`, f.nameJa]),
    );
    for (const [character, family, expected] of EXPECTED_UNTOUCHED) {
      expect(index.get(`${character}/${family}`)).toBe(expected);
    }
  });

  it("★★ファミリー行の総数は 369 である", () => {
    // ★★★【2026-09-12 更新・M30-07】372 → 369。**本サブの成果そのものである。**
    //   guile の【ジャスト】版 3 ファミリーが基底へ畳まれた。⇒ 372 − 3 = 369。
    //   ★減った 3 件は名指しできる——`perfect_timing_sonic_boom` /
    //     `perfect_timing_somersault_kick` / `perfect_timing_sonic_cross` である
    //     (EXPECTED_FOLDED_PERFECT が行き先を主張している)。
    expect(allFamilies()).toHaveLength(369);
  });

  it("★★★ファミリー識別子を 369 件の digest で固定する", () => {
    // ★★識別子が変わると**保存済みのコンボが参照している先が変わりうる**(指示書 §4.3)。
    //   ⇒ 表示名の変更が識別子へ漏れていないことを、全数の digest で押さえる。
    // ★★★【2026-09-12 更新・M30-07】b54d1183… → 525b584c…。
    //   **本サブは識別子を動かす側である**(M30-05 / M30-06 は動かさない側だった)。
    //   ⇒ 目で差分を見て、動いたのが次の 3 件の**消滅**だけであることを確認してから貼り替えた:
    //     guile/perfect_timing_sonic_boom / guile/perfect_timing_somersault_kick /
    //     guile/perfect_timing_sonic_cross
    //   ★他の 369 行の識別子は 1 文字も動いていない(基底側の識別子は改名の対象外)。
    //   ★並び順に依存しないよう昇順に整列してから取る(並びは `M30-04` の持ち物であり、
    //     本サブが主張すべき軸ではない)。
    const ids = allFamilies()
      .map((f) => `${f.character}/${f.family}`)
      .sort();
    expect(new Set(ids).size).toBe(369);
    expect(createHash("sha256").update(ids.join("\n")).digest("hex")).toBe(
      "525b584c866af7cdcfa8c0f956d0d003168ee62efc72f806c87257c64532fdb5",
    );
  });

  it("★★★表示名 369 件の digest(意図しないラベル変化を必ず人の目に掛ける)", () => {
    // ★★★「(A) 群が落ちた」だけを見る主張では、**落としすぎ**を検出できない。
    //   規則は装飾の直後 1〜2 文字しか見ておらず語の境界を見ないため、将来
    //   `[X]中段○○` のような名前が入ると `[X]段○○` へ削れる。⇒ (A) 群の主張は
    //   「残っていない」なので通ってしまい、識別子 digest も動かない。
    // ★本主張は表示名そのものを全数で固定するため、意図しないラベル変化が必ず赤になる。
    //   ★キャラ追加・seed 修正でここが赤くなったときは、**差分を目で見てから**更新すること
    //   (自動で貼り替えると、この床は無いのと同じになる)。
    // ★★★【2026-09-12・M30-07 更新】a7ee6db5… → 6835bedf…。
    //   **本サブは行そのものを減らす側である。⇒ 目で差分を見て、動いたのが次の 3 行の
    //     消滅だけであることを確認してから貼り替えた:**
    //     guile/perfect_timing_sonic_boom      = 【ジャスト】ソニックブーム
    //     guile/perfect_timing_somersault_kick = 【ジャスト】サマーソルトキック
    //     guile/perfect_timing_sonic_cross     = 【ジャスト】ソニッククロス
    //   ★★証明の形＝**新しい 369 行へこの 3 行だけを足し戻すと、着手前の digest と
    //     バイト一致する**(完了報告 §段4 digest 監査に実測を貼ってある)。
    //     ⇒ 残る 369 行は 1 文字も動いていない。
    //   ★以下は前版の記述: 【2026-09-12・M30-06 更新】906378a0… → a7ee6db5…。
    //   **目で差分を見て、動いたのが下の 4 行だけであることを確認してから貼り替えた。**
    //     cammy/cannon_strike_hooligan_combination = キャノンストライク(フーリガンコンビネーション派生)
    //     cammy/reverse_edge_hooligan_combination  = リバースエッジ(フーリガンコンビネーション派生)
    //     cammy/fatal_leg_twister                  = フェイタルレッグツイスター(フーリガンコンビネーション派生)
    //     cammy/silent_step                        = サイレントステップ(フーリガン派生)
    //   ★他の 368 行は 1 文字も動いていない。★識別子 digest(上のテスト)も不変である。
    const labels = allFamilies()
      .map((f) => `${f.character}/${f.family} = ${f.nameJa ?? ""}`)
      .sort();
    expect(labels).toHaveLength(369);
    expect(createHash("sha256").update(labels.join("\n")).digest("hex")).toBe(
      "6835bedfb8a09d842b985b82b37170af740da686052d96834bee9a4b97724036",
    );
  });

  it("★`is_derived` の並び(M30-04)は保たれている(先頭群 194 / 末尾群 175)", () => {
    // ★★【2026-09-12 更新・M30-07】末尾群 178 → 175。**先頭群 194 は動いていない。**
    //   畳まれた 3 ファミリーはいずれも isDerived=true であり、合流先の分類は
    //   1 件も変わらなかった(`sonic_boom` / `somersault_kick` は false のまま、
    //   `sonic_cross` は true のまま)。⇒ 減るのは末尾群だけである。
    const families = allFamilies();
    expect(families.filter((f) => !f.isDerived)).toHaveLength(194);
    expect(families.filter((f) => f.isDerived)).toHaveLength(175);
    // ★キャラごとに「先頭群がすべて末尾群より前」であることも見る(群の連結が壊れていないこと)。
    for (const file of CHARACTER_FILES) {
      const flags = deriveSpecialFamilies(loadCharacter(file)).map((f) => f.isDerived);
      expect(flags).toEqual([...flags].sort((a, b) => Number(a) - Number(b)));
    }
  });
});

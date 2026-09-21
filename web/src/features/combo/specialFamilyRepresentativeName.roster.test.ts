import { describe, expect, it } from "vitest";

import { deriveSpecialFamilies, parseSpecialCode } from "./inputResolution";
import {
  CHARACTER_FILES,
  characterCode,
  loadCharacter,
} from "./seedRoster.fixture";

// ★★M30-06: ファミリー行の「代表名の作り方」を seed CSV 全数で固定するテスト。
//
// ★★★本サブの核は「4 行の名前が変わったこと」ではない。**落としすぎていないこと**である。
//   ⇒ チェックリスト束 A。「変わった」側だけを測ると、過剰除去が緑になる(`M30-05` 教訓 2)。
//   ★そこで本ファイルは主張を**対で**置く:
//     (1) 対象 4 行の代表名から強度語が落ちたこと
//     (2) 反例群 13 ファミリーが**区別できるまま**であること
//
// ★★★さらに (2) については「変わっていない」より強い主張を置く ——
//   **素朴な案 (a)(丸括弧の中の強度語を*位置*で落とす)を当てると実際に潰れること**を
//   同じテストの中で測る。⇒ 反例が机上の懸念ではなく実在することを、床が自分で証明する。
//
// ★★判定の正規表現は**本ファイルで独自に書く**。実装(`stripStrengthLabel` /
//   `collapseStrengthOnlyDifference`)を import しない。⇒ 実装と同じ式を共有すると、
//   実装が間違った方向へ動いたとき期待値も一緒に動いて何も検出しなくなる
//   (`M30-04` 教訓 §7-4＝陽性対照は実装と独立な軸から作る)。
const PAREN_STRENGTH = /[(（][^)）]*(?:弱|中|強|OD)[^)）]*[)）]/u;
// ★★`M30-05` の 3 形の規則を**本ファイルで独自に書き起こす**(実装を import しない)。
//   ⇒ 「メンバーの名前が割れているか」を実装と独立な軸で判定するために要る。
const STRIP_AFTER_DECORATION = /^(【[^】]*】|\[[^\]]*\])(?:弱|中|強|OD)[・･\s]*/u;
const STRIP_PREFIX = /^(?:弱|中|強|OD)[・･\s]*/u;
const STRIP_SUFFIX = /[・･\s]*(?:弱|中|強|OD)$/u;
const strip = (name: string) =>
  name
    .replace(STRIP_AFTER_DECORATION, "$1")
    .replace(STRIP_PREFIX, "")
    .replace(STRIP_SUFFIX, "")
    .trim() || name;

/**
 * 素朴な案 (a)＝丸括弧の中の強度語を位置で落とす。**採らなかった案**である。
 *
 * ★★ここでの (a) は「**丸括弧 1 組につき最初の強度語だけ**を落とす」形である
 *   (`g` と遅延量指定の組合せによる)。⇒ 件数は (a) の書き方に依存する。
 *   ★指示書 §0.4 の文言を素直に読んで**全部**落とす形にすると 6 組 17 件になり、
 *     対象行の `fatal_leg_twister` と `silent_step` 自身も衝突群に入る(実測)。
 *   ⇒ **どちらの定義でも (a) は成立しない**が、数値を写すときは定義ごと写すこと。
 */
const NAIVE_DROP = /([(（][^)）]*?)(?:弱|中|強|OD)/gu;
const naive = (name: string) => name.replace(NAIVE_DROP, "$1");

/** 全キャラのファミリー行を `{ character, family, nameJa }` の平坦な配列にする。 */
function allFamilies() {
  return CHARACTER_FILES.flatMap((file) =>
    deriveSpecialFamilies(loadCharacter(file)).map((f) => ({
      character: characterCode(file),
      family: f.family,
      nameJa: f.nameJa ?? "",
    })),
  );
}

/** raw ファミリー(変種を畳む前)ごとに、属する move の `name_ja` を集める。 */
function rawFamilyMemberNames(file: string) {
  const byFamily = new Map<string, string[]>();
  for (const m of loadCharacter(file)) {
    if (m.category !== "special" || !m.nameJa) continue;
    const { family } = parseSpecialCode(m.code);
    if (!byFamily.has(family)) byFamily.set(family, []);
    byFamily.get(family)!.push(m.nameJa);
  }
  return byFamily;
}

// ★★対象＝「弱/中/強が選べるのに代表名が最弱メンバーの名前で固定されていた」行。
//   実査(段 1・seed CSV 31 キャラ)の結果は 4 行であり、指示書 §0.2 の写しと一致した。
const TARGETS: ReadonlyArray<readonly [string, string, string]> = [
  ["cammy", "cannon_strike_hooligan_combination", "キャノンストライク(フーリガンコンビネーション派生)"],
  ["cammy", "reverse_edge_hooligan_combination", "リバースエッジ(フーリガンコンビネーション派生)"],
  ["cammy", "fatal_leg_twister", "フェイタルレッグツイスター(フーリガンコンビネーション派生)"],
  ["cammy", "silent_step", "サイレントステップ(フーリガン派生)"],
];

// ★★★反例群＝素朴な案 (a) を当てると同一表示になるファミリーの組(実測 5 組 13 件)。
//   丸括弧の中の強度語が「どの派生元から出る技か」を示す唯一の情報である
//   (`DES-004` §2.1 の規約そのもの)。
//
// ★★★これらが採った方式で潰れない理由は 2 つある。**「メンバーが 1 件だから」ではない** ——
//   13 件のうち **3 件は 3 メンバーを持つ**(実測。`cammy/reverse_edge_hooligan_combination` /
//   `elena/lynx_whirl_spinning_scythe` / `elena/lynx_whirl_od_spinning_scythe`)。
//   1. 畳む条件が見るのは「メンバー数」ではなく **strip 後の*相異なる*名前の数**である。
//      ⇒ elena の 2 件は弱/中/強が**接頭形**であり strip で揃うため、相異なる名前は 1 つしかない。
//   2. **反例の兄弟どうしは別ファミリーに居る。** 畳む判定はファミリーの**中**しか見ないため、
//      ファミリーをまたぐ区別(`OD` 等)に触れない。⇒ 畳んだ後も区別が残る。
//
// ★★★したがって `cammy/reverse_edge_hooligan_combination` は
//   **下の TARGETS(畳む対象)と本表の両方に載る。矛盾ではない** ——
//   同行は畳まれるが、隣の `reverse_edge`(「リバースエッジ(ODフーリガンコンビネーション派生)」)
//   とは `OD` で区別が残るため衝突しない。
//
// ★★★「落としすぎないこと」を担保しているのは、畳む条件そのものではなく
//   **本ファイル末尾の 372 行全数の重複組テスト**である。
const COUNTEREXAMPLE_GROUPS: ReadonlyArray<readonly [string, readonly string[]]> = [
  [
    "cammy",
    [
      "cannon_strike_light_od_hooligan_combination",
      "cannon_strike_medium_od_hooligan_combination",
      "cannon_strike_heavy_od_hooligan_combination",
    ],
  ],
  [
    "cammy",
    [
      "fatal_leg_twister_light_hooligan_combination",
      "fatal_leg_twister_medium_hooligan_combination",
      "fatal_leg_twister_heavy_hooligan_combination",
    ],
  ],
  [
    "cammy",
    [
      "silent_step_light_od_hooligan_combination",
      "silent_step_medium_od_hooligan_combination",
      "silent_step_heavy_od_hooligan_combination",
    ],
  ],
  ["cammy", ["reverse_edge_hooligan_combination", "reverse_edge"]],
  ["elena", ["lynx_whirl_spinning_scythe", "lynx_whirl_od_spinning_scythe"]],
];

// ★★【2026-09-12 更新・M30-07】`guile/perfect_timing_sonic_cross` → `guile/sonic_cross_perfect`。
//   【ジャスト】版の `move_code` が接尾形へ揃った結果、raw ファミリー名だけが変わった。
//   ★件数は 10 件のまま・畳む 4 件も不変である——`name_ja` を 1 文字も触っていないため、
//     「差が強度語だけか」の判定は 1 件も動かない。★本表は **raw** ファミリー
//     (段 2 で基底へ畳まれる前)を並べており、`sonic_cross_perfect` は畳まれる前の姿である。
// ★メンバー間で表示名が割れている raw ファミリーの全数(実測 10 件)。
//   ⇒ このうち「差が強度語だけ」の 4 件だけを畳む。残り 6 件は畳まない。
const DIVERGENT_FAMILIES: ReadonlyArray<readonly [string, string, boolean]> = [
  ["akuma", "demon_swoop_side_switch", false],
  ["c_viper", "focus_force_forward_step", false],
  ["cammy", "razors_edge_slicer", false],
  ["cammy", "cannon_strike_hooligan_combination", true],
  ["cammy", "reverse_edge_hooligan_combination", true],
  ["cammy", "fatal_leg_twister", true],
  ["cammy", "silent_step", true],
  ["guile", "sonic_cross", false],
  ["guile", "sonic_cross_perfect", false],
  ["luke", "flash_knuckle_holding", false],
];

describe("★★M30-06 ファミリー行の代表名(seed CSV 全数)", () => {
  it("★★★陽性対照(入力側)＝対象 4 行のメンバーは強度語を持つ名前で登録されている", () => {
    // ★実装の出力ではなく **seed CSV の `name_ja` そのもの**を見る。
    //   ⇒ 「出力に強度語が無い」だけを測ると、元から無かった行と区別がつかない。
    const byFamily = rawFamilyMemberNames("cammy.csv");
    let checked = 0;
    for (const [, family] of TARGETS) {
      const names = byFamily.get(family) ?? [];
      expect(names.length, `${family} のメンバーが取れていない`).toBeGreaterThanOrEqual(3);
      for (const n of names) {
        expect(PAREN_STRENGTH.test(n), `${family}: ${n}`).toBe(true);
        checked++;
      }
    }
    // ★空ループ防止。実測 12 行(4 ファミリー × 弱中強)。
    expect(checked).toBe(12);
  });

  it("★★★対象 4 行の代表名から強度語が落ちている(逐語)", () => {
    const all = allFamilies();
    for (const [character, family, expected] of TARGETS) {
      const row = all.find((f) => f.character === character && f.family === family);
      expect(row, `${character}/${family} が見つからない`).toBeDefined();
      expect(row?.nameJa).toBe(expected);
      // ★落ちたことを、期待値の一致とは別の軸でも測る。
      expect(PAREN_STRENGTH.test(row?.nameJa ?? "")).toBe(false);
    }
    expect(TARGETS).toHaveLength(4);
  });

  it("★★★反例群は区別できるまま(＝落としすぎていない)", () => {
    const all = allFamilies();
    let checked = 0;
    for (const [character, families] of COUNTEREXAMPLE_GROUPS) {
      const labels = families.map((family) => {
        const row = all.find((f) => f.character === character && f.family === family);
        expect(row, `${character}/${family} が見つからない`).toBeDefined();
        return row?.nameJa ?? "";
      });
      // ★組の中で 1 つも重複しないこと。
      expect(new Set(labels).size, `${character}: ${labels.join(" / ")}`).toBe(
        families.length,
      );
      checked += families.length;
    }
    expect(checked).toBe(13);
  });

  it("★★★反例は実在する＝素朴な案 (a) を当てると 5 組が同一表示になる", () => {
    // ★★この 1 本が「(a) を採らなかった理由」を床にしている。
    //   ⇒ 上のテストだけだと、反例が机上の懸念なのか実在するのかが判らない。
    const all = allFamilies();
    let collapsedGroups = 0;
    for (const [character, families] of COUNTEREXAMPLE_GROUPS) {
      const naiveLabels = families.map((family) =>
        naive(all.find((f) => f.character === character && f.family === family)?.nameJa ?? ""),
      );
      // 素朴な案では組の全員が同じ表示になる。
      expect(new Set(naiveLabels).size, `${character}: ${naiveLabels.join(" / ")}`).toBe(1);
      collapsedGroups++;
    }
    expect(collapsedGroups).toBe(5);
  });

  it("★★メンバー間で名前が割れる raw ファミリーは 10 件で、畳んだのは 4 件だけ", () => {
    // ★判定は独立な `strip` で行う。⇒ "弱波動拳"/"中波動拳" のように
    //   強度語を落とせば揃う大多数の組は、ここでは「割れている」に数えない。
    const divergent: Array<[string, string]> = [];
    for (const file of CHARACTER_FILES) {
      for (const [family, names] of rawFamilyMemberNames(file)) {
        if (new Set(names.map(strip)).size > 1) {
          divergent.push([characterCode(file), family]);
        }
      }
    }
    expect(divergent).toEqual(
      DIVERGENT_FAMILIES.map(([character, family]) => [character, family]),
    );

    // ★★「畳んだ」の判定軸＝代表名が**どのメンバーの名前(strip 後)とも一致しない**こと。
    //   ⇒ 畳んでいない行の代表名は、必ずどれか 1 メンバーの名前そのものである。
    const all = allFamilies();
    // ★★raw ファミリーのうち 2 件は**変種として基底へ畳まれる**ため行にならない ——
    //   `luke/flash_knuckle_holding` は `flash_knuckle` の `holding` 変種であり、
    //   `guile/sonic_cross_perfect` は `sonic_cross` の `perfect` 変種である。
    //   ⇒ 代表名は `plain` から採られるので、これらの raw ファミリーの名前は表に出ない。
    //   ★「見つからない」を握り潰さず、件数として固定する。
    // ★★【2026-09-12 更新・M30-07】1 件 → 2 件。**増えたのは本サブの成果である。**
    //   着手前の `guile/perfect_timing_sonic_cross` は接頭形だったため畳まれず、
    //   **独立したファミリー行として表に出ていた**。⇒ 接尾形へ揃えた結果、
    //   `luke/flash_knuckle_holding` と同じ側へ回った。★主張は 1 本も減っていない。
    const foldedAway: string[] = [];
    for (const [character, family, isCollapsed] of DIVERGENT_FAMILIES) {
      const row = all.find((f) => f.character === character && f.family === family);
      if (!row) {
        foldedAway.push(`${character}/${family}`);
        continue;
      }
      const memberNames = new Set(
        (rawFamilyMemberNames(`${character}.csv`).get(family) ?? []).map(strip),
      );
      expect(memberNames.has(row.nameJa), `${character}/${family}`).toBe(!isCollapsed);
    }
    expect(foldedAway).toEqual([
      "guile/sonic_cross_perfect",
      "luke/flash_knuckle_holding",
    ]);
    expect(DIVERGENT_FAMILIES.filter(([, , c]) => c)).toHaveLength(4);
  });

  it("★★丸括弧の中に強度語を持つファミリー行は 22 → 18 件(減ったのは対象 4 行だけ)", () => {
    const all = allFamilies();
    const withParen = all.filter((f) => PAREN_STRENGTH.test(f.nameJa));
    expect(withParen).toHaveLength(18);
    // ★対象 4 行が抜けたのであって、他が巻き込まれていないこと。
    for (const [character, family] of TARGETS) {
      expect(
        withParen.some((f) => f.character === character && f.family === family),
      ).toBe(false);
    }
    // ★残った 18 件のうち 11 件は反例群である(＝落としてはいけない側が残っている)。
    //   ★反例群 13 件すべてが丸括弧内に強度語を持つわけではない ——
    //     elena `lynx_whirl_spinning_scythe` は素の側であり元から持たない。
    //     ⇒ 「区別できること」は上の専用テストが測る。ここでは件数だけを見る。
    const counterexampleWithParen = COUNTEREXAMPLE_GROUPS.flatMap(([character, families]) =>
      families.filter((family) =>
        PAREN_STRENGTH.test(
          all.find((f) => f.character === character && f.family === family)?.nameJa ?? "",
        ),
      ),
    );
    expect(counterexampleWithParen).toHaveLength(11);
  });

  it("★★★落とした強度語は、そのメンバー自身の強度と対応している(12 行)", () => {
    // ★★★畳む判定は「差が強度語である」ことしか見ておらず、**その強度語が当該メンバーの
    //   `strength` と一致するか**を確かめていない。⇒ 対応がずれた seed が入ると、
    //   行名から情報が消えたうえにボタンの意味も食い違う
    //   (「弱」を押すと「中派生」の技が入る形)。**テストも型検査も緑のままである。**
    // ⇒ 現 seed で対応が成り立っていることを床として固定する(レビュー 中-1)。
    const WORD: Record<string, string> = { light: "弱", medium: "中", heavy: "強", od: "OD" };
    const byFamily = new Map<string, Array<{ strength: string; nameJa: string }>>();
    for (const m of loadCharacter("cammy.csv")) {
      if (m.category !== "special" || !m.nameJa) continue;
      const { family, strength } = parseSpecialCode(m.code);
      if (!byFamily.has(family)) byFamily.set(family, []);
      byFamily.get(family)!.push({ strength, nameJa: m.nameJa });
    }
    let checked = 0;
    for (const [, family] of TARGETS) {
      for (const { strength, nameJa } of byFamily.get(family) ?? []) {
        const word = WORD[strength];
        expect(word, `${family}: 未知の強度 ${strength}`).toBeDefined();
        // 丸括弧の中の強度語が、そのメンバー自身の強度と一致すること。
        const inParen = /[(（]([^)）]*)[)）]/u.exec(nameJa)?.[1] ?? "";
        expect(inParen.startsWith(word), `${family} / ${strength}: ${nameJa}`).toBe(true);
        checked++;
      }
    }
    expect(checked).toBe(12);
  });

  it("★★同一表示になるファミリーの組は増えていない(着手前から 1 組・lily)", () => {
    // ★★★lily の 1 組は**着手前から存在する**(実測)。⇒ 本サブが作った差ではない。
    //   `windclad_condor_dive_follow_up`(「ODコンドルダイブ(派生)」から OD が落ちる)と
    //   `condor_dive_follow_up`(「コンドルダイブ(派生)」)が同じ表示になる。
    //   ★seed の `name_ja` に `[風纏い]` が入っていないことが原因であり、本サブの射程外。
    //   ⇒ 完了報告 §6 で申し送る。**ここでは「増えていないこと」だけを固定する。**
    const dup: string[] = [];
    for (const file of CHARACTER_FILES) {
      const byName = new Map<string, string[]>();
      for (const f of deriveSpecialFamilies(loadCharacter(file))) {
        const n = f.nameJa ?? "";
        if (!byName.has(n)) byName.set(n, []);
        byName.get(n)!.push(f.family);
      }
      for (const [n, families] of byName) {
        if (families.length > 1) dup.push(`${characterCode(file)} 「${n}」 ${families.join(", ")}`);
      }
    }
    expect(dup).toEqual([
      "lily 「コンドルダイブ(派生)」 windclad_condor_dive_follow_up, condor_dive_follow_up",
    ]);
  });
});

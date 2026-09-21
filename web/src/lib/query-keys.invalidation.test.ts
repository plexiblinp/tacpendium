import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it } from "vitest";

import { queryKeys } from "./query-keys";

// ★★★M24-08 / CO-009 で足した、本サブで最も重要な観測。
//
// ── なぜ要るか ───────────────────────────────────────────────────────
// queryKey の形を変えて invalidateQueries が当たらなくなっても、
// **テストは緑のまま通りうる**。TanStack の既定は前方一致であり、
// 当たらなくなっても例外は出ず、画面は「更新されない」だけになる。
//
// 着手前の実測(母数付き):
//   * 本番の invalidateQueries は 58 件。exact / predicate は 0 件 ＝
//     全件が既定の前方一致で動いている。
//   * うち **39 件が前方一致に依存**している(invalidate キーが query キーの
//     真の前方部分列)。
//   * それが「実在の query に当たること」を観測していたのは **2 件 / 58 件
//     ≒ 3.4%** にすぎず、前方一致依存 39 件を守る E2E は **0 件**だった。
//   * 既存の vitest 3 本は spy に渡った引数のリテラルを見るだけで、
//     invalidate 側と query 側を**同時に**書き換えれば常に緑にできる。
//
// ⇒ 本ファイルは「渡した引数」ではなく **実物の QueryClient で実際に何に
//   当たるか** を表で固定する。片側だけずらせば必ず赤くなる。
//
// ── 使い方 ───────────────────────────────────────────────────────────
// queryKeys へキーを足したら、下の QUERIES か INVALIDATIONS のどちらかへ
// 必ず載せること。載せ忘れは最後の「網羅」テストが赤で知らせる。
//
// ── ★本テストの限界(過信しないこと) ─────────────────────────────────
// 本テストが見るのは「ファクトリが吐くキー同士の当たり方」である。
//   * ★呼び出し側のドリフトは検出しない —— 画面が combo.detail(id) の代わりに
//     combo.all() を呼ぶよう書き換えても、ここは緑のままである。
//     そちらは各 hook のテストと E2E の担当である。
//   * ★INVALIDATIONS に載っているキーが本番で実際に invalidate されている保証も
//     ここには無い(例: config は現在 setQueryData だけで invalidate されていない)。
//     載せているのは「もし無効化するならこう当たるべき」という対応表である。

/** 画面が実際に useQuery で登録するキー(＝キャッシュに載る実体)。 */
const QUERIES: ReadonlyArray<{ name: string; key: readonly unknown[] }> = [
  { name: "combos.list", key: queryKeys.combos.list({ characterId: 1 }) },
  { name: "combos.recent", key: queryKeys.combos.recent() },
  { name: "combos.trash", key: queryKeys.combos.trash(1) },
  { name: "combo.detail", key: queryKeys.combo.detail(1) },
  { name: "combo.recipe", key: queryKeys.combo.recipe(1, 2) },
  { name: "combo.deleted", key: queryKeys.combo.deleted(1) },
  {
    name: "combo.duplicateCheck",
    key: queryKeys.combo.duplicateCheck({ characterId: 1 }),
  },
  { name: "setups.byCharacter", key: queryKeys.setups.byCharacter(1) },
  { name: "setups.trash", key: queryKeys.setups.trash(1) },
  { name: "setup.detail", key: queryKeys.setup.detail(1) },
  { name: "setupCandidates.byCombo", key: queryKeys.setupCandidates.byCombo(1) },
  {
    name: "setupCandidates.byKnockdown",
    key: queryKeys.setupCandidates.byKnockdown(1, 30),
  },
  {
    name: "setplaySuggestions.list",
    key: queryKeys.setplaySuggestions.list(1, { mode: "auto" }),
  },
  { name: "tags.list(true)", key: queryKeys.tags.list(true) },
  { name: "tags.list(false)", key: queryKeys.tags.list(false) },
  {
    name: "tags.byCategory(false)",
    key: queryKeys.tags.byCategory(false, "mycombo_status"),
  },
  {
    name: "tags.statusCounts",
    key: queryKeys.tags.statusCounts("mycombo_status", 1),
  },
  { name: "presets.all", key: queryKeys.presets.all() },
  { name: "presets.aliases", key: queryKeys.presets.aliases(1, 2, 50) },
  { name: "moves.byCharacter", key: queryKeys.moves.byCharacter(1) },
  { name: "move.detail", key: queryKeys.move.detail(1) },
  { name: "commandIndex", key: queryKeys.commandIndex(1) },
  { name: "motionCommands", key: queryKeys.motionCommands(1) },
  {
    name: "punishFinder.byMatchup",
    key: queryKeys.punishFinder.byMatchup(1, 2, "block"),
  },
  {
    name: "punishList.byMatchup",
    key: queryKeys.punishList.byMatchup(1, 2, "block"),
  },
  { name: "characters.list", key: queryKeys.characters.list(1) },
  { name: "auth.status", key: queryKeys.auth.status() },
  { name: "config", key: queryKeys.config() },
  { name: "users", key: queryKeys.users() },
  {
    name: "notices.dataMigration",
    key: queryKeys.notices.dataMigration(),
  },
  {
    name: "notices.gameUpdate",
    key: queryKeys.notices.gameUpdate(),
  },
];

/**
 * 本番が実際に無効化するキーと、そのとき当たらねばならない query の全集合。
 * ★expects は「ちょうどこれだけ」である。多くても少なくても赤にする。
 */
const INVALIDATIONS: ReadonlyArray<{
  name: string;
  key: readonly unknown[];
  expects: string[];
  why?: string;
}> = [
  {
    name: "combos.all",
    key: queryKeys.combos.all(),
    expects: ["combos.list", "combos.recent", "combos.trash"],
    why: "コンボの作成・更新・削除・復元・取込・確定反撃の採用が一覧 3 種を巻き込む",
  },
  {
    name: "combo.detail",
    key: queryKeys.combo.detail(1),
    expects: ["combo.detail", "combo.recipe"],
    why:
      "★契約 F-2 の FE 側の実体。詳細を無効化するとレシピも同時に落ちる(D-291)。" +
      "★duplicateCheck は巻き込まない(1 件のコンボのキャッシュではないため)",
  },
  {
    name: "combo.all",
    key: queryKeys.combo.all(),
    expects: [
      "combo.detail",
      "combo.recipe",
      "combo.deleted",
      "combo.duplicateCheck",
    ],
    why:
      "プリセット更新時にレシピ表記を追従させる(preset/api.ts)。" +
      "★重複判定も巻き込むが、これは望ましい——コンボが増減すれば判定結果は古くなる",
  },
  {
    name: "setups.all",
    key: queryKeys.setups.all(),
    expects: ["setups.byCharacter", "setups.trash"],
  },
  {
    name: "setupCandidates.all",
    key: queryKeys.setupCandidates.all(),
    expects: ["setupCandidates.byCombo", "setupCandidates.byKnockdown"],
  },
  {
    name: "setupCandidates.byCombo",
    key: queryKeys.setupCandidates.byCombo(1),
    expects: ["setupCandidates.byCombo"],
    why: "★byKnockdown を巻き込まないこと。平坦化するとここが崩れる(query-keys.ts の注記 b)",
  },
  {
    name: "setup.detail",
    key: queryKeys.setup.detail(1),
    expects: ["setup.detail"],
  },
  {
    name: "setplaySuggestions.all",
    key: queryKeys.setplaySuggestions.all(),
    expects: ["setplaySuggestions.list"],
    why: "提案の採用・解除で提案一覧を引き直す(SetplaySuggestionSection)",
  },
  {
    name: "tags.all",
    key: queryKeys.tags.all(),
    expects: [
      "tags.list(true)",
      "tags.list(false)",
      "tags.byCategory(false)",
      "tags.statusCounts",
    ],
  },
  {
    name: "tags.byCategory(true)",
    key: queryKeys.tags.byCategory(true, "mycombo_status"),
    expects: ["tags.statusCounts"],
    why:
      "★★前方一致ではなく object の部分一致(partialDeepEqual)にのみ依存している唯一の経路。" +
      "flat へ展開すると代替できず、マイコンボの件数が静かに更新されなくなる(注記 a)",
  },
  {
    name: "presets.all",
    key: queryKeys.presets.all(),
    expects: ["presets.all", "presets.aliases"],
  },
  {
    name: "presets.aliasesRoot",
    key: queryKeys.presets.aliasesRoot(1),
    expects: ["presets.aliases"],
  },
  {
    name: "moves.byCharacter",
    key: queryKeys.moves.byCharacter(1),
    expects: ["moves.byCharacter"],
  },
  { name: "move.detail", key: queryKeys.move.detail(1), expects: ["move.detail"] },
  { name: "commandIndex", key: queryKeys.commandIndex(1), expects: ["commandIndex"] },
  {
    name: "motionCommands",
    key: queryKeys.motionCommands(1),
    expects: ["motionCommands"],
  },
  {
    name: "punishFinder.all",
    key: queryKeys.punishFinder.all(),
    expects: ["punishFinder.byMatchup"],
    why: "技を編集すると確定反撃の走査結果が古くなる(moves/api.ts・punish/api.ts の両方から)",
  },
  {
    name: "punishList.all",
    key: queryKeys.punishList.all(),
    expects: ["punishList.byMatchup"],
  },
  { name: "auth.status", key: queryKeys.auth.status(), expects: ["auth.status"] },
  { name: "users", key: queryKeys.users(), expects: ["users"] },
  { name: "config", key: queryKeys.config(), expects: ["config"] },
];

describe("invalidateQueries が実在の query に当たること(M24-08 / CO-009)", () => {
  let qc: QueryClient;

  beforeEach(() => {
    qc = new QueryClient();
    for (const q of QUERIES) {
      // setQueryData でキャッシュに実体を作る(fetch はしない)。
      qc.setQueryData(q.key, q.name);
    }
  });

  it("種となる query が全数キャッシュに載っている(検査が空振りしないこと)", () => {
    expect(qc.getQueryCache().getAll()).toHaveLength(QUERIES.length);
  });

  it.each(INVALIDATIONS)(
    "$name は expects の query にちょうど当たる",
    ({ key, expects, why }) => {
      const hit = qc
        .getQueryCache()
        .findAll({ queryKey: key })
        .map((q) => q.state.data as string)
        .sort();
      expect(hit, why ?? "").toEqual([...expects].sort());
    },
  );

  it("queryKeys の全 leaf が QUERIES か INVALIDATIONS で使われている", () => {
    const leaves: string[] = [];
    const walk = (node: unknown, path: string) => {
      if (typeof node === "function") {
        leaves.push(path);
        return;
      }
      if (node && typeof node === "object") {
        for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}.${k}` : k);
      }
    };
    walk(queryKeys, "");

    // 表に載っている名前から leaf 名を起こす(tags.list(true) → tags.list など)。
    const used = new Set(
      [...QUERIES, ...INVALIDATIONS].map((e) => e.name.replace(/\(.*\)$/, "")),
    );
    const unused = leaves.filter((l) => !used.has(l));
    expect(
      unused,
      "queryKeys へキーを足したら QUERIES か INVALIDATIONS へも載せること",
    ).toEqual([]);
  });
});

// ★★★契約 F-2(m20-contract §5 / m21-contract §5 / D-291)を固定する。
//
// F-2 が守っているのは「presetId が単一値である」というモデルであって、
// queryKey の表記法の凍結ではない(M24-08 §4.1.1 の裁定＝D-619。
// 実査 21 箇所のうちリテラル説を支持する記述は 0 件だった)。
// ⇒ 表記は揃えてよい。ただし次の 3 条件を落とさないこと。
describe("契約 F-2 の 3 面(M24-08 §4.1.1 / D-291)", () => {
  it("presetId が queryKey の構成要素として残っている", () => {
    const key = queryKeys.combo.recipe(42, 7);
    expect(key).toContain(7);
    expect(key).toEqual(["combo", 42, "recipe", 7]);
  });

  it("presetId ごとに別のキャッシュ実体になる", () => {
    expect(queryKeys.combo.recipe(42, 7)).not.toEqual(
      queryKeys.combo.recipe(42, 8),
    );
  });

  it("combo.detail(id) が combo.recipe(id, *) の前方部分列である", () => {
    // ★これが崩れると、コンボを更新してもレシピ表示が古いまま残る。
    //   invalidate 側 10 箇所がこの前方一致に依存している。
    const detail = queryKeys.combo.detail(42);
    const recipe = queryKeys.combo.recipe(42, 7);
    expect(recipe.slice(0, detail.length)).toEqual([...detail]);
  });
});

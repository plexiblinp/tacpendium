import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { MODIFIER_FLAGS } from "./labels";

// ============================================================================
// M37-06: flag の表示語が **Go とフロントで一致している**ことの機械検査。
//
// ★★★着手前はこの検査が存在しなかった。`DES-004` §2.3 は逐語で
//   「★★★機械検査は無い＝`scripts/check-enum-sync.sh` は flags を見ていない」
//   と書いており(フロント側の定義が `web/src/constants/` ではなく
//   `features/combo/` に在るため)、**片側だけ直しても表示は壊れるがテストも
//   型検査も緑のまま**という状態だった(followup
//   `modifier-flag-labels-triplicated-without-check`)。
//
// ★★★本サブでこれを塞ぐ理由は「あると良いから」ではなく、**問い (ii) の案 C が
//   両側の一致に依存するようになったから**である。⇒ `RecipeText` は Go が出した
//   `{表示語}` を、フロントの表示語表と照合してバッジへ描き替える
//   (recipeDisplay.splitStepSegments)。**両側がずれるとバッジが黙って出なくなる。**
//   ⇒ 依存が生まれた以上、その依存を検査で固定する。
//
// ★★本テストは `followup` が言う「定数の移設」ではない。移設(features/combo →
//   constants/)は波及が読めないため単独の手番が要るという判断は生きている。
//   ⇒ ここでやるのは**照合だけ**であり、定義の置き場は 1 文字も動かしていない。
//
// ★Go 側を正規表現で読む。ソースを読む検査は脆いが、代替が無い ——
//   Go の `flagText` は非公開の map リテラルであり、実行時に取り出す経路が無い
//   (公開すると「表示語の正本は 3 か所」の構図自体が変わる)。
//   ⇒ 読めなかった場合は**緑で素通りさせず落とす**(下記 expect)。素通りすると、
//     検査が壊れたことに誰も気づかないまま緑が返り続ける。
// ============================================================================

/**
 * リポジトリルートから Go 側のソースを引く。
 *
 * ★`import.meta.url` は使えない —— vitest の変換後は file スキームでないことがあり、
 *   `fileURLToPath` が `The URL must be of scheme file` で落ちる(実測)。
 * ★cwd 直書きもしない。`pnpm test` は `web/` で走るが、他所から呼ばれても
 *   壊れないよう `go.mod` を目印に上へ辿る。
 */
function repoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 10; i += 1) {
    if (existsSync(resolve(dir, "go.mod"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`リポジトリルート(go.mod)が見つからない: cwd=${process.cwd()}`);
}

const RESOLVER_PATH = resolve(
  repoRoot(),
  "internal/service/notation/resolver.go",
);

/** Go の `var flagText = map[string]string{ ... }` から `コード → 表示語` を取り出す。 */
function readGoFlagText(): Map<string, string> {
  const source = readFileSync(RESOLVER_PATH, "utf8");

  const start = source.indexOf("var flagText = map[string]string{");
  expect(start, "Go 側の flagText 宣言が見つからない ⇒ 本検査が壊れている").toBeGreaterThan(-1);

  const body = source.slice(start);
  const end = body.indexOf("\n}");
  expect(end, "flagText の閉じ括弧が見つからない ⇒ 本検査が壊れている").toBeGreaterThan(-1);

  const entries = new Map<string, string>();
  // 例: 	"link": "{目押し}",
  const line = /^\s*"([a-z0-9_]+)":\s*"\{(.+?)\}",\s*$/;
  for (const raw of body.slice(0, end).split("\n")) {
    const m = line.exec(raw);
    if (m !== null) entries.set(m[1], m[2]);
  }
  return entries;
}

describe("M37-06 flag 表示語の Go ⇄ フロント一致(CHANGE-199 の 3 か所のうち 2 か所)", () => {
  const goFlags = readGoFlagText();

  it("★検査そのものが生きている(Go 側から 17 件を読めた)", () => {
    // ★母数を先に主張する。正規表現が 1 件も拾えないと、以下の全数ループが
    //   0 回まわって**全部緑**になる ——「何も見ていない緑」を防ぐ床である。
    expect(goFlags.size).toBe(17);
  });

  it("★★★17 件すべてでコードと表示語が一致する", () => {
    const frontFlags = new Map(MODIFIER_FLAGS.map((f) => [f.value, f.label]));

    // ★両向きで見る。片向きだけだと「フロントにだけ在る値」を見逃す。
    expect([...frontFlags.keys()].sort()).toEqual([...goFlags.keys()].sort());

    for (const [code, goLabel] of goFlags) {
      expect(
        frontFlags.get(code),
        `flag ${code} の表示語が食い違っている(Go: ${goLabel})`,
      ).toBe(goLabel);
    }
  });

  it("★逆向き: Go 側の表示語に内部識別子がそのまま入っていない", () => {
    for (const [code, label] of goFlags) {
      expect(label, `flag ${code} の表示語が内部識別子のまま`).not.toBe(code);
    }
  });
});

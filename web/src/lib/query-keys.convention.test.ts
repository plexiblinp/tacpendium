import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

// ★★M24-08 / CO-009 で足したガード。
//
// 本サブは queryKey の定義を web/src/lib/query-keys.ts の 1 本へ寄せた。
// ⇒ **次の担当が画面側で配列リテラルを直書きしても、何も赤くならない**状態だった。
//   統一は「一度きれいにする」ことではなく「戻らないようにする」ことなので、
//   機械の網を残す(先例＝web/src/locales/retired-words.test.ts)。
//
// ★★なぜ直書きが危険か —— queryKey を書く側と invalidateQueries を書く側が
//   別ファイルに分かれるため、**片方だけ直すと静かにキャッシュが効かなくなる**。
//   TanStack の既定は前方一致であり、当たらなくなっても例外は出ない。
//   実測では本番 58 件の invalidate のうち 39 件が前方一致に依存していた。
//
// ★走査対象は本番コードだけである。テストは除く ——
//   既存テストのうち 3 本は spy に渡ったキーのリテラルを直接アサートしており
//   (useUpdateSetup / useDeleteSetup / useUpdateMyComboStatus)、
//   **あれは「値が変わっていないこと」を守る観測として有用なので残す**。
//   本サブ(第 1 部)は挙動を変えないため、その値は 1 つも動いていない。

const SRC_ROOT = join(process.cwd(), "src");
/** 正本。ここだけが配列リテラルを書いてよい。 */
const CANONICAL = join(SRC_ROOT, "lib", "query-keys.ts");

/** 走査対象: web/src 配下の .ts / .tsx(テスト・本ファイル自身・正本は除く)。 */
function collectSources(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      collectSources(p, out);
    } else if (
      /\.tsx?$/.test(e.name) &&
      !/\.test\.tsx?$/.test(e.name) &&
      p !== CANONICAL
    ) {
      out.push(p);
    }
  }
  return out;
}

/** 行コメント・ブロックコメントを落とす。★退けた経緯はコメントに残してよい。 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("queryKey の作法(M24-08 / CO-009)", () => {
  const files = collectSources(SRC_ROOT);

  it("走査対象が空でない(検査そのものが壊れていないこと)", () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it("queryKey の配列リテラルを lib/query-keys.ts の外に書かない", () => {
    const offenders: string[] = [];
    for (const f of files) {
      const src = stripComments(readFileSync(f, "utf-8"));
      // queryKey: [ ... / queryKey: [\n ... の両方を拾う
      if (/queryKey:\s*\[/.test(src)) {
        offenders.push(relative(SRC_ROOT, f));
      }
    }
    expect(
      offenders,
      `queryKey の配列リテラルは web/src/lib/query-keys.ts の queryKeys ファクトリへ置くこと。` +
        `直書きすると invalidateQueries 側とドリフトし、静かにキャッシュが効かなくなる。`,
    ).toEqual([]);
  });

  it("setQueryData / removeQueries へ配列リテラルを直接渡さない", () => {
    const offenders: string[] = [];
    for (const f of files) {
      const src = stripComments(readFileSync(f, "utf-8"));
      if (/(setQueryData|removeQueries)\s*\(\s*\[/.test(src)) {
        offenders.push(relative(SRC_ROOT, f));
      }
    }
    expect(offenders).toEqual([]);
  });
});

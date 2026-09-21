// テスト専用: seed CSV(`character_data/*.csv`)を `Move[]` へ写す最小ローダ。
//
// ★★本ファイルは実行時コードから import されない(テストだけが読む)。
//   vitest の include は `src/**/*.test.{ts,tsx}` であり、`.fixture.ts` はテストとして走らない。
//
// ★★★`moveSurfacing.roster.test.ts` が同型のローダをモジュール内に持っているが、
//   あちらへ寄せずに分けてある。理由は並列作業である(M30-05 §0.6)——
//   同ファイルは `M31-06` が触る共有テストであり、`DES-005` §6.1 が名指しで保全している。
//   ⇒ 本サブが同ファイルを構造変更すると、マージのときに片方の変更が黙って消えうる。
//   ★統合は `M31-06` が着地したあとの手番で行う(完了報告の横断課題)。
//
// ★★母集団の限界。ここが読むのは CSV であり、実 DB の `moves` と一致しない
//   —— **CSV 2743 行 / 実 DB 3057 行・差 314 行**(2026-09-12 実測)。
//   **★`moveSurfacing.roster.test.ts` 冒頭の「3026 行」は `M30-03` 時点の値であり、
//     `000109`(drive_reversal × 31 キャラ)のぶん失効している。写さないこと。**
//   差はいずれもマイグレーションが直接投入する行(大半は移動系 system 技)である。
//   ⇒ `category='special'` は CSV 側に全数在り(DB 1024 行 = CSV 1024 行・実測)、
//     ファミリー行の総数も実 DB と一致する(372)。

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import type { Move } from "@/features/moves/types";

// vitest の cwd は web/(vitest.config の root)。seed CSV はリポジトリルート直下。
export const SEED_DIR = join(process.cwd(), "..", "character_data");

/** RFC4180 の最小サブセット(引用符内のカンマ・改行・"" を扱う)。 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") field += c;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** 1 キャラ分の seed CSV を Move[] へ写す(id は行順＝moves.id の昇順に相当)。 */
export function loadCharacter(file: string): Move[] {
  const rows = parseCsv(readFileSync(join(SEED_DIR, file), "utf8"));
  const header = rows[0];
  const col = (name: string) => header.indexOf(name);
  const iCode = col("move_code");
  const iCat = col("category");
  const iAerial = col("is_aerial");
  const iDerived = col("is_derived");
  const iName = col("name_ja");
  return rows.slice(1).map((r, idx) => ({
    id: idx + 1,
    characterId: 1,
    code: r[iCode],
    category: r[iCat],
    isAerial: r[iAerial] === "true",
    setupOnly: false,
    isDerived: r[iDerived] === "true",
    nameJa: r[iName] || null,
  }));
}

/** seed CSV のファイル名一覧(キャラコードの昇順)。 */
export const CHARACTER_FILES = readdirSync(SEED_DIR)
  .filter((f) => f.endsWith(".csv"))
  .sort();

/** ファイル名からキャラコードを得る(`ryu.csv` → `ryu`)。 */
export function characterCode(file: string): string {
  return file.replace(/\.csv$/u, "");
}

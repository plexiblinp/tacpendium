import { readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";

import { describe, expect, it } from "vitest";

import type { Move } from "@/features/moves/types";

import { deriveSpecialFamilies, parseSpecialCode } from "./inputResolution";
import type { CommandIndexEntries } from "./inputResolutionStage2";
import {
  COMMON_MOVE_CODES,
  isOnSpecialTab,
  surfaceBuckets,
} from "./moveSurfacing";

// ★★M30-01 §2.1 の実測を回帰で固定するテスト(seed CSV 由来の行のみ)。
//
// ★★★母集団の限界を先に書く(2026-09-08 の是正)。本テストが読むのは
//   `character_data/*.csv` であり、**実 DB の moves と一致しない**。
//   実測: CSV 2743 行 / 実 DB 3026 行。差の 283 行は**マイグレーションが直接投入する行**で、
//   その大半は移動系の system 技(`forward` / `back` / `micro_*` / `jump_*` の 7 code ×
//   31 キャラ = 217 行。投入元は 000004_data_seed_moves)である。
//
// ★★この食い違いが実害を出した。初版の本テストは CSV を「seed の正本」と見なして
//   「未分類は 330 行」と固定したが、**実 DB では 551 行**であり、
//   開発者が実機で「システムの move が未分類に居る」と気づくまで誰も検出できなかった。
//   ⇒ 本テストの主張は「CSV 由来の行について」に限る。**実 DB 全体の件数は
//     `web/e2e/m30-01-controller-surfacing.spec.ts` が実サーバ越しに主張する。**
//
// ★★entries(段階2 の解決表)を空で渡すのは手抜きではない。
//   実測の結果、**段階2 の解決表は「どの技が面に出るか」を 1 件も増やしていない**
//   (解決表に載る候補が category normal / unique / special に限られ、そのいずれも
//   既に自分のタブを持つため)。⇒ 解決表は「同じ方向＋ボタンでどの技が出るか」を
//   変えるが、「出る技の集合」は変えない。
//
// ★★キャラ固有状態(`custom_states`)も CSV には無い(`characters` テーブル側)。
//   ⇒ 本テストは状態コードを渡さない。**案 C(固有状態タブを掲載済みに数える)の効果は
//     ここでは測れない**ため、その主張も E2E 側に置いてある。
//   ★したがって本ファイルの件数は「固有状態タブが無いとき」の基準である。
//     ★★【2026-09-10 更新・M30-03】実 DB・実設定での未分類は **41 行**である
//       (着手時点 87 行。M30-01 が測った 251 行は M30-02 着手前の値であり失効した)。
const NO_ENTRIES: CommandIndexEntries = {};

// vitest の cwd は web/(vitest.config の root)。seed CSV はリポジトリルート直下。
const SEED_DIR = join(process.cwd(), "..", "character_data");

/** RFC4180 の最小サブセット(引用符内のカンマ・改行・"" を扱う)。 */
function parseCsv(text: string): string[][] {
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
function loadCharacter(file: string): Move[] {
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
    // ★M30-04: 並び順の判定に使うため CSV の値を写す(旧版は false 固定だった)。
    isDerived: r[iDerived] === "true",
    nameJa: r[iName] || null,
  }));
}

const CHARACTER_FILES = readdirSync(SEED_DIR)
  .filter((f) => f.endsWith(".csv"))
  .sort();

describe("★M30-01 §2.1 実測の固定(seed CSV 由来の行のみ)", () => {
  it("走査対象は 31 キャラ / 2743 行である(★実 DB は 3026 行。差はマイグレ由来)", () => {
    expect(CHARACTER_FILES).toHaveLength(31);
    const total = CHARACTER_FILES.reduce(
      (n, f) => n + loadCharacter(f).length,
      0,
    );
    expect(total).toBe(2743);
  });

  it("★★共通技 13 code のうち CSV に在るのは 4 code だけである(残り 9 code はマイグレ由来)", () => {
    // ★★これが初版の測り違いを直接押さえる主張である。
    //   CSV だけを見ると「前入力・微歩き・ジャンプ・前方ステップ等は存在しない」と読めるが、
    //   実 DB には 31 キャラぶん在る。⇒ CSV を seed の正本と見なしてはいけない。
    const inCsv = new Set<string>();
    for (const f of CHARACTER_FILES) {
      for (const m of loadCharacter(f)) {
        if (COMMON_MOVE_CODES.includes(m.code)) inCsv.add(m.code);
      }
    }
    expect([...inCsv].sort()).toEqual([
      "drive_impact",
      "drive_parry",
      "throw_back",
      "throw_forward",
    ]);
    expect(COMMON_MOVE_CODES).toHaveLength(13);
  });

  it("★未分類(CSV 由来・固有状態タブ無しの基準)は 38 行である", () => {
    // ★★M30-02(P4M-016)で 330 → 144、M30-03 で 144 → 39 へ減った。
    //   **緑にするために合わせた値ではない。**
    //   M30-03 で落ちた 105 行はすべて A2(強度語が code の途中に在る形)であり、
    //   必殺技タブへ移った(144 - 105 = 39)。⇒ 数字が動くこと自体が検出したい変化である。
    // M35-02 の基底 code 是正で rush_axe_kick も解決され、さらに 1 件減る(39 - 1 = 38)。
    let n = 0;
    for (const f of CHARACTER_FILES) {
      n += surfaceBuckets(loadCharacter(f), NO_ENTRIES).unclassified.length;
    }
    expect(n).toBe(38);
  });

  it("★未分類の内訳は category で 3 種に割れる(special は 1 件も残らない)", () => {
    const byCategory: Record<string, number> = {};
    for (const f of CHARACTER_FILES) {
      for (const m of surfaceBuckets(loadCharacter(f), NO_ENTRIES).unclassified) {
        byCategory[m.category] = (byCategory[m.category] ?? 0) + 1;
      }
    }
    expect(byCategory).toEqual({
      // 段階1/2 のどちらでも解決しない normal。
      normal: 17,
      // 共通技 13 code 以外の投げ。
      throw: 17,
      // 未分類に残る rush_variant。
      // ★★M35-02 で 5 → 4 へ減った。ryu の 1 件(`axe_kick_2` / `rush_axe_kick`)を是正した——
      //   基底 code が `axe_kick_2` だったため isOnUniqueTab が false になっていた。
      //
      // ★★★残る 4 件の正体(2026-09-10 実測。★これは M35-02 の当初の記述の是正である):
      //     `alex/rush_standing_heavy_punch_holding` / `alex/rush_standing_heavy_kick_holding` /
      //     `jamie/rush_drink_level_1_standing_light_punch` /
      //     `zangief/rush_standing_heavy_punch_holding`
      //   **いずれも基底が normal として実在し、original_move_code も正しい。**
      //   落ちる理由は「HitBoxLayout の方向×強度×ボタンから到達できない」ことであり、
      //   ryu の「基底 code の対応が破れていた」形とは違う。
      //
      // ★★当初ここには「残る 4 件は ingrid / lily / mai の `_1` と `_1hits` の食い違い」と
      //   書いていたが**誤りである**。同 4 件は `original_move_code` の dangling であって
      //   `move_code` は正しく対応しており、**未分類バケットには入っていない**
      //   (入力面には出ている)。件数が同じ 4 だったのは偶然である。
      //   ⇒ 同件は followup `rush-original-move-code-typo` の射程で、本カウントとは無関係。
      //
      // ★★【2026-09-11・M35-03】その followup は解消した——`original_move_code` の 4 セルを
      //   是正し golden（旧 000026 / 000072 / 000073）を再生成した。
      //   ★本カウントは 4 のまま動いていない。⇒ これが「2 軸が交わらない」ことの
      //     機械的な裏づけである——`loadCharacter` は 17 列目(`original_move_code`)を読まず、
      //     `isOnUniqueTab` も `move.code` しか見ないため、軸 A の是正は本バケットへ
      //     構造上影響しない。★ここが動いたら、軸 B(HitBoxLayout から到達できない族)に
      //     手が入っているということである。
      rush_variant: 4,
    });
    // ★ターゲットコンボと system は 1 行も未分類に残っていない。
    expect(byCategory.target_combo).toBeUndefined();
    expect(byCategory.system).toBeUndefined();
    // ★★M30-03: special が 1 行も残らなくなった。
    //   着手時点 291 件(A1 186 ＋ A2 105)→ M30-02 で 105 件 → 本サブで 0 件。
    // ★★★ただし本行が守っているのは「A2 が載ったこと」ではない(レビュー 高-3)。
    //   `isOnSpecialTab` は `category==='special'` の 1 条件になったため、
    //   **special が未分類へ落ちないことは構造上そうなる**のであって、
    //   `parseSpecialCode` の中身に依存しない。
    //   ⇒ **A2 が実際にファミリーへ載ったことを守っているのは別の 2 本である**——
    //     (a) 下の「ファミリー衝突が 0 件である」(座標総数 == special 総数)、
    //     (b) 「『素は押せるが OD が押せない』7 組」(素と OD が同じファミリーへ合流)。
    expect(byCategory.special).toBeUndefined();
  });

  it("★★special は 1 件も未分類に残らない(M30-03。「いま 0」ではなく 0 であることを主張する)", () => {
    // ★★着手時点は A2 の 105 件が残っていた(強度語が code の途中に在る形＝
    //   `lightning_beast_light_rolling_attack`)。⇒ 本サブがそれを取り込んだ。
    // ★★空ループで素通りしないよう、走査した special の総数も主張する
    //   (件数を見ないと「1 件も見ていないから緑」と区別がつかない)。
    // ★★★本行も「述語が category だけを見る」ことの帰結であり、
    //   `parseSpecialCode` の中身には依存しない(レビュー 高-3)。
    //   ⇒ **実装が効いていることの証明は座標一致テストと 7 組テストが持つ。**
    //     本行が守るのは「未分類タブの母集団の定義が special を含まないこと」である。
    let specials = 0;
    const leftover: string[] = [];
    for (const f of CHARACTER_FILES) {
      const moves = loadCharacter(f);
      for (const m of moves) if (m.category === "special") specials += 1;
      for (const m of surfaceBuckets(moves, NO_ENTRIES).unclassified) {
        if (m.category === "special") leftover.push(`${basename(f, ".csv")}/${m.code}`);
      }
    }
    expect(specials).toBe(1024);
    expect(leftover).toEqual([]);
  });

  it("★★ファミリー衝突が 0 件である(2 つの違う技が同じ family+変種+強度へ落ちない)", () => {
    // ★★指示書 §4.1「最大の危険＝ファミリーの衝突」。
    //   `code` のどこかにある強度語で探すと、別々の技が同じ座標へ落ちて
    //   **片方が黙って上書きされうる**(deriveSpecialFamilies は後勝ちで代入する)。
    // ★★「いま 0 件」ではなく「0 件であること」を主張する形にする ——
    //   ⇒ **special の総数と、必殺技タブが持つ座標の総数が一致すること**を見る。
    //     1 件でも衝突すれば座標が減るため、必ず赤になる。
    for (const f of CHARACTER_FILES) {
      const moves = loadCharacter(f);
      const specials = moves.filter((m) => m.category === "special");
      let slots = 0;
      for (const fam of deriveSpecialFamilies(moves)) {
        for (const byStrength of Object.values(fam.byVariant)) {
          slots += Object.keys(byStrength ?? {}).length;
        }
      }
      expect(`${basename(f, ".csv")}:${slots}`).toBe(
        `${basename(f, ".csv")}:${specials.length}`,
      );
    }
  });

  it("★★着手時点の判定が 1 件も変わらない(段 1-3 の実測「既存の判定が変わる技 0 件」)", () => {
    // ★★実測を数字で残すのではなく、**規則として**固定する。
    //   着手時点の parseSpecialCode が非 null を返していたのは次の 2 通りだけである。
    //     (1) 末尾が強度接尾辞    → { family: 接尾辞を落とした残り, strength }
    //     (2) 強度語がどこにも無い → { family: code, strength: "none" }
    //   ⇒ その 2 通りが**いまも同じ答えを返すこと**を全数で主張すれば、
    //     「既存の判定が変わる技 0 件」は恒久的に固定される。
    // ★★規則 1 が規則 2 より先であることが、これを成り立たせている。
    //   順序を入れ替えると、強度語を 2 つ以上持つ 15 件のうち 12 件がここで落ちる。
    const tokens = ["od", "light", "medium", "heavy"];
    let checked = 0;
    for (const f of CHARACTER_FILES) {
      for (const m of loadCharacter(f)) {
        if (m.category !== "special") continue;
        const parts = m.code.split("_");
        const last = parts[parts.length - 1];
        if (tokens.includes(last)) {
          expect(parseSpecialCode(m.code)).toEqual({
            family: m.code.slice(0, -(last.length + 1)),
            strength: last,
          });
          checked += 1;
        } else if (!parts.some((t) => tokens.includes(t))) {
          expect(parseSpecialCode(m.code)).toEqual({
            family: m.code,
            strength: "none",
          });
          checked += 1;
        }
      }
    }
    // ★空ループ避け。規則 1 / 規則 3 で判定が付く special の総数
    //   ＝ special 全数 1024 − A2 96 ＝ 928。
    // ★★【2026-09-12 更新・M30-07】919 → 928。⇒ **本サブの成果そのものである。**
    //   guile の【ジャスト】版 9 件が接頭形 `perfect_timing_<強度>_<技>`(＝強度語が code の
    //   途中に在る A2)から接尾形 `<技>_perfect_<強度>`(＝末尾に強度語がある A1)へ移った。
    //   ⇒ A2 は 105 → 96 になり、規則 1 で判定が付く側が 9 件増えた。
    //   ★10 件目の `sonic_cross_perfect_od` は改名前(`perfect_timing_sonic_cross_od`)から
    //     末尾が `_od` であり、もともと規則 1 側に居た。⇒ 動いたのは 9 件である。
    expect(checked).toBe(928);
  });

  it("★★『素は押せるが OD が押せない』7 組が、素と OD で同じファミリーへ合流している", () => {
    // ★★2026-09-09 開発者の実機確認で見つかった —— 逐語＝「[電刃錬気]OD波動拳が
    //   必殺技タブのボタンから入力できないがこれは既存バグ?」。
    //   答え＝既存バグではないが、M30-02 が作った非対称である。
    //   素の `denjin_charge_hadoken` は A1 で P4M-016 により載り、
    //   `denjin_charge_od_hadoken` は A2 のままで載っていなかった。
    //
    // ★★★【2026-09-10・M30-03 レビュー 高-2 の是正】本テストは着手時点、
    //   「`isOnSpecialTab(兄弟)` が偽である組を数え、0 件を主張する」形だった。
    //   ⇒ 本サブで `isOnSpecialTab` が `category==='special'` の 1 条件になったため、
    //     **その形は恒真になった**(兄弟は同じキャラの moves から code 一致で引くので
    //     `category` は必ず `special` である)。
    //   ★実測(レビューと製造で独立に再現): 兄弟判定に到達する組 **102**、
    //     そのうち `category!=='special'` の兄弟 **0**。
    //   ⇒ `parseSpecialCode` を着手時点へ巻き戻しても緑のままだった。**式そのものが赤になれない。**
    //
    // ★★⇒ 主張を「述語」から「**ファミリーの座標**」へ移した。
    //   素と OD が**同じファミリーの同じ変種の中に、別々の強度として在ること**を見る。
    //   A2 が必殺技タブへ載っていなければ OD 側の座標そのものが存在せず、必ず赤になる。
    // ★★あわせて 7 組を**名指しで全数**残す(束 A-2)。集約の 0 件だけにしない。
    const PAIRS: ReadonlyArray<readonly [string, string, string]> = [
      ["blanka", "lightning_beast_electric_thunder", "lightning_beast_od_electric_thunder"],
      [
        "blanka",
        "lightning_beast_electric_thunder_holding",
        "lightning_beast_od_electric_thunder_holding",
      ],
      ["lily", "windclad_condor_dive", "windclad_od_condor_dive"],
      ["m_bison", "mine_set_devil_reverse", "mine_set_od_devil_reverse"],
      ["mai", "flame_musasabi_no_mai", "flame_od_musasabi_no_mai"],
      ["ryu", "denjin_charge_hadoken", "denjin_charge_od_hadoken"],
      ["ryu", "denjin_charge_hashogeki", "denjin_charge_od_hashogeki"],
    ];
    expect(PAIRS).toHaveLength(7);

    for (const [character, plainCode, odCode] of PAIRS) {
      const moves = loadCharacter(`${character}.csv`);
      const plain = moves.find((m) => m.code === plainCode);
      const od = moves.find((m) => m.code === odCode);
      // ★seed から消えたら気づけるようにする(code を名指ししている以上、必須)。
      expect(`${character}/${plainCode}`).toBe(
        `${character}/${plain?.code ?? "(見つからない)"}`,
      );
      expect(`${character}/${odCode}`).toBe(
        `${character}/${od?.code ?? "(見つからない)"}`,
      );

      const families = deriveSpecialFamilies(moves);
      const coordOf = (id: number): string | null => {
        for (const fam of families) {
          for (const [variant, byStrength] of Object.entries(fam.byVariant)) {
            for (const [strength, moveId] of Object.entries(byStrength ?? {})) {
              if (moveId === id) return `${fam.family}|${variant}|${strength}`;
            }
          }
        }
        return null;
      };
      const plainCoord = coordOf((plain as Move).id);
      const odCoord = coordOf((od as Move).id);

      // ★★どちらも必殺技タブのどこかに在る(着手時点は OD 側が null だった)。
      expect(`${odCode} => ${odCoord}`).not.toBe(`${odCode} => null`);
      expect(`${plainCode} => ${plainCoord}`).not.toBe(`${plainCode} => null`);

      // ★★同じファミリー・同じ変種で、強度だけが違うこと。
      const [plainFamily, plainVariant, plainStrength] = (plainCoord as string).split("|");
      const [odFamily, odVariant, odStrength] = (odCoord as string).split("|");
      expect(`${odCode}: ${odFamily}|${odVariant}`).toBe(
        `${odCode}: ${plainFamily}|${plainVariant}`,
      );
      expect(`${odCode}: ${odStrength}`).toBe(`${odCode}: od`);
      expect(`${plainCode}: ${plainStrength}`).not.toBe(`${plainCode}: od`);
    }
  });

  it("★★強度語を 2 つ以上持つ special の内訳を固定する(規則 2 の優先順位が効く範囲)", () => {
    // ★★レビュー 低-2 の是正。`inputResolution.ts` のコメントが根拠として挙げている
    //   「15 件 / うち末尾にも持つ 12 件 / 規則 2 で決まる 3 件」を、どのテストも
    //   数えていなかった。⇒ データが動くと静かに陳腐化する。
    // ★★★この 3 件は**規則 2 の優先順位(od 先)が実際に効く唯一の範囲**であり、
    //   完了報告 §2.2 と設計伝達レポートの製造判断の根拠そのものである。
    //   ⇒ 増えたら、その判断を測り直す必要がある。**赤で知らせる。**
    const tokens = ["od", "light", "medium", "heavy"];
    const byRule1: string[] = [];
    const byRule2: string[] = [];
    for (const f of CHARACTER_FILES) {
      for (const m of loadCharacter(f)) {
        if (m.category !== "special") continue;
        const parts = m.code.split("_");
        if (parts.filter((t) => tokens.includes(t)).length < 2) continue;
        const target = tokens.includes(parts[parts.length - 1]) ? byRule1 : byRule2;
        target.push(`${basename(f, ".csv")}/${m.code}`);
      }
    }
    expect(byRule1.length + byRule2.length).toBe(15);
    expect(byRule1).toHaveLength(12);
    // ★規則 2 の優先順位で決まる 3 件は名指しで固定する。
    expect(byRule2.sort()).toEqual([
      "cammy/fatal_leg_twister_heavy_od_hooligan_combination",
      "cammy/fatal_leg_twister_light_od_hooligan_combination",
      "cammy/fatal_leg_twister_medium_od_hooligan_combination",
    ]);
  });

  it("★ターゲットコンボタブは seed 全体で 126 行を引き受ける", () => {
    let tc = 0;
    for (const f of CHARACTER_FILES) {
      tc += surfaceBuckets(loadCharacter(f), NO_ENTRIES).targetCombo.length;
    }
    expect(tc).toBe(126);
  });

  it("★★ジェイミー(開発者が名指ししたキャラ)の未分類は 4 行で、顔ぶれが固定である", () => {
    const hidden = surfaceBuckets(
      loadCharacter("jamie.csv"),
      NO_ENTRIES,
    ).unclassified.map((m) => m.code);
    // ★並びは seed CSV の行順(＝moves.id 昇順)である。
    // ★★M30-02(P4M-016)で 13 → 4 になった。落ちたのは強度を持たない必殺技 9 件
    //   (`the_devil_inside` 系 7 ／ `tenshin` ／ `swagger_hermit_punch`)であり、
    //   **開発者の逐語が名指しした「点辰」はここから消えて必殺技タブへ移った**。
    expect(hidden).toEqual([
      "drink_level_1_standing_light_punch",
      "forward_throw_drink",
      "forward_throw_reach_drink_lv4",
      "rush_drink_level_1_standing_light_punch",
    ]);
  });

  it("★★`_od` だけが押せる形は 0 件になった(着手時点は 95 件・M30-01 §2.5)", () => {
    let onlyOd = 0;
    for (const f of CHARACTER_FILES) {
      const moves = loadCharacter(f);
      const codes = new Set(moves.map((m) => m.code));
      for (const m of moves) {
        if (
          m.category === "special" &&
          !isOnSpecialTab(m) &&
          codes.has(`${m.code}_od`)
        ) {
          onlyOd += 1;
        }
      }
    }
    // ★★M30-02(P4M-016)の副次的な帰結である。素の版(強度なし)が
    //   同じファミリーへ合流したため、「ファミリー名は出るが OD しか押せない」形が消えた。
    //   ★設計書が名指ししていた `guile/sonic_break` と `terry/quick_burn` も
    //     このうちの 2 件であった(M30-01 §2.5)。
    expect(onlyOd).toBe(0);
  });

  it("★キャラごとの未分類件数が固定である(1 キャラだけで済ませない)", () => {
    const actual: Record<string, number> = {};
    for (const f of CHARACTER_FILES) {
      actual[basename(f, ".csv")] = surfaceBuckets(
        loadCharacter(f),
        NO_ENTRIES,
      ).unclassified.length;
    }
    // ★★M30-03 後の実測。0 のキャラが 11 → 17 になった。
    // M35-02 の是正も合わせると ryu が 1 → 0 となり、0 のキャラは 18 になる。
    // ★★★special の寄与が消えたぶんは「述語が category だけを見る」ことの帰結である
    //   (レビュー 高-3)。**本表が守るのは必殺技以外の 3 区分の件数**であり、
    //   A2 が載ったことの証明ではない。
    //   ★大きく動いたのは A2 を多く持つキャラである
    //     (mai 22→1 / blanka 20→2 / cammy 13→1 / guile 11→2 / lily 10→0 / m_bison 9→0)。
    expect(actual).toEqual({
      aki: 0, akuma: 0, alex: 5, blanka: 2, c_viper: 1, cammy: 1,
      chun_li: 2, dee_jay: 0, dhalsim: 1, e_honda: 1, ed: 0, elena: 0,
      guile: 2, ingrid: 0, jamie: 4, jp: 1, juri: 2, ken: 1,
      kimberly: 0, lily: 0, luke: 0, m_bison: 0, mai: 1, manon: 0,
      marisa: 6, rashid: 1, ryu: 0, sagat: 0, terry: 0, yasmine: 0,
      zangief: 7,
    });
  });
});

describe("★★M30-04 派生変種を末尾へ回す(seed CSV 由来・31 キャラ)", () => {
  /**
   * 並べ替え**前**の順序を復元する。
   *
   * ★★実装を読み直して再現するのではなく、**move の id** から復元する。
   *   `loadCharacter` は CSV の行順で id を振っており(＝実 DB の `moves.id` 昇順に相当)、
   *   `deriveSpecialFamilies` の着手時点の出力順は「基底ファミリーの初出順」だった。
   *   ⇒ 各ファミリーが持つ move id の最小値で並べれば、着手時点の順序と一致する。
   * ★★【2026-09-11 追記・2 巡目レビュー 低-8】上の「一致する」は仮定ではなく**導出できる**。
   *   `inputResolution.ts` の `order.push(family)` は raw ファミリーの初出で 1 回だけ走り、
   *   `outOrder.push(base)` はその `order` を順に走るため、**基底ファミリーの初出インデックス
   *   ＝ そのファミリーに属する move の最小 id − 1** になる(`loadCharacter` が行順に
   *   `idx + 1` を振るため)。⇒ `minId` 昇順は着手時点の出力順と全域で一致する。
   * ★これが陽性対照の土台である。実装の中身をコピーすると、実装が間違っていても
   *   同じように間違えるため、対照にならない。
   */
  function originalOrder(fams: ReturnType<typeof deriveSpecialFamilies>) {
    const firstId = (f: (typeof fams)[number]) =>
      Math.min(
        ...Object.values(f.byVariant).flatMap((byStrength) =>
          Object.values(byStrength ?? {}),
        ),
      );
    return [...fams].sort((a, b) => firstId(a) - firstId(b));
  }

  it("★キャラ別のファミリー行数(総数 369)。並べ替えで 1 件も増減しない", () => {
    // ★★母集団を 1 行で書く: seed CSV 31 キャラ 2743 行のうち category='special' を
    //   `deriveSpecialFamilies` へ通した出力(変種畳み**後**)である。
    //   M30-03 完了報告 §6.2 は「342 → 372」と測った。
    //   ★★【2026-09-12 更新・M30-07】372 → 369。⇒ **本サブの成果そのものである。**
    //     guile の【ジャスト】版が接尾形へ揃い、`splitSpecialVariant` が
    //     `perfect_timing_sonic_boom` / `perfect_timing_somersault_kick` /
    //     `perfect_timing_sonic_cross` の 3 ファミリーを基底 `sonic_boom` /
    //     `somersault_kick` / `sonic_cross` の **perfect 変種**へ畳んだ。
    //     ⇒ 372 − 3 = 369。減った 3 件は**その 3 ファミリーそのもの**であり、
    //       他キャラは 1 件も動いていない(下の表で guile だけが 9 → 6)。
    const actual: Record<string, number> = {};
    for (const f of CHARACTER_FILES) {
      actual[basename(f, ".csv")] = deriveSpecialFamilies(loadCharacter(f)).length;
    }
    expect(actual).toEqual({
      aki: 13, akuma: 20, alex: 6, blanka: 21, c_viper: 12, cammy: 21,
      chun_li: 7, dee_jay: 12, dhalsim: 16, e_honda: 11, ed: 9, elena: 15,
      guile: 6, ingrid: 19, jamie: 21, jp: 9, juri: 10, ken: 15,
      kimberly: 16, lily: 10, luke: 10, m_bison: 11, mai: 12, manon: 6,
      marisa: 11, rashid: 10, ryu: 9, sagat: 8, terry: 7, yasmine: 10,
      zangief: 6,
    });
    expect(Object.values(actual).reduce((a, b) => a + b, 0)).toBe(369);

    // ★並べ替えの前後で件数が同じであること(§2.2-4「1 件も消さない」)。
    for (const f of CHARACTER_FILES) {
      const fams = deriveSpecialFamilies(loadCharacter(f));
      expect(originalOrder(fams)).toHaveLength(fams.length);
      // 顔ぶれも同じ(並べ替えであって入れ替えではない)。
      expect([...fams.map((x) => x.family)].sort()).toEqual(
        [...originalOrder(fams).map((x) => x.family)].sort(),
      );
    }
  });

  it("★★キャラ別の『末尾へ回った件数』(合計 175 / 369)", () => {
    // ★★★指示書 §2.3-2 が「実物で数え直すこと」と求めた値である。
    //   M30-02 が見積もった 66 件(A1 のみ)とは母集団が違う ——
    //   本サブは A1 / A2 を区別せず「そのファミリーの move が全部 is_derived」で判定する。
    //   ⇒ A2(強度語が code の途中に在る状態版必殺技。M30-03 が載せた 105 件)も含む。
    // ★★【2026-09-12 更新・M30-07】178 → 175(guile が 6 → 3)。
    //   畳まれた 3 ファミリーはいずれも isDerived=true であった。合流先は
    //   `sonic_boom` / `somersault_kick`(素が is_derived=false なので isDerived=false)と
    //   `sonic_cross`(全メンバー true なので isDerived=true)であり、**合流先の分類は
    //   1 件も動いていない**。⇒ 非 derived は 194 のまま、derived だけが 3 減る。
    const actual: Record<string, number> = {};
    for (const f of CHARACTER_FILES) {
      actual[basename(f, ".csv")] = deriveSpecialFamilies(
        loadCharacter(f),
      ).filter((x) => x.isDerived).length;
    }
    expect(actual).toEqual({
      aki: 6, akuma: 12, alex: 2, blanka: 13, c_viper: 8, cammy: 16,
      chun_li: 0, dee_jay: 5, dhalsim: 9, e_honda: 4, ed: 2, elena: 10,
      guile: 3, ingrid: 0, jamie: 15, jp: 3, juri: 4, ken: 9,
      kimberly: 7, lily: 5, luke: 5, m_bison: 7, mai: 8, manon: 2,
      marisa: 6, rashid: 5, ryu: 2, sagat: 3, terry: 0, yasmine: 4,
      zangief: 0,
    });
    expect(Object.values(actual).reduce((a, b) => a + b, 0)).toBe(175);
  });

  it("★★★陽性対照: 着手時点は 46 ファミリーが末尾に居なかった", () => {
    // ★★「末尾に居る」だけを測ると、元から末尾だったキャラで緑になる(指示書 §4.2)。
    //   ⇒ **並べ替え前**の順序で「末尾ブロックの外に居た derived」を数える。
    //   0 でないことが、次の it の主張を意味あるものにする。
    // ★★【2026-09-12 更新・M30-07】47 → 46(guile が 1 → 0)。
    //   guile で末尾ブロックの外に居た derived は `perfect_timing_sonic_cross` 1 件であり、
    //   それが基底 `sonic_cross`(isDerived=true・元から末尾側)へ畳まれて消えた。
    //   ★0 になったのは guile だけであり、合計は依然 46 で 0 ではない。
    //     ⇒ 本対照の意味(「元から末尾だったから緑」ではない)は保たれている。
    const actual: Record<string, number> = {};
    for (const f of CHARACTER_FILES) {
      const fams = deriveSpecialFamilies(loadCharacter(f));
      const before = originalOrder(fams);
      const d = fams.filter((x) => x.isDerived).length;
      const tailStart = before.length - d;
      actual[basename(f, ".csv")] = before.filter(
        (x, i) => x.isDerived && i < tailStart,
      ).length;
    }
    expect(actual).toEqual({
      aki: 1, akuma: 2, alex: 0, blanka: 4, c_viper: 2, cammy: 0,
      chun_li: 0, dee_jay: 0, dhalsim: 0, e_honda: 2, ed: 0, elena: 2,
      guile: 0, ingrid: 0, jamie: 5, jp: 3, juri: 2, ken: 2,
      kimberly: 6, lily: 2, luke: 2, m_bison: 1, mai: 3, manon: 0,
      marisa: 1, rashid: 2, ryu: 1, sagat: 0, terry: 0, yasmine: 3,
      zangief: 0,
    });
    expect(Object.values(actual).reduce((a, b) => a + b, 0)).toBe(46);

    // ★開発者が名指ししたキャラ(jamie)では、着手時点の derived の最も上は **2 行目**であった。
    const jamieBefore = originalOrder(
      deriveSpecialFamilies(loadCharacter("jamie.csv")),
    );
    expect(jamieBefore.findIndex((x) => x.isDerived)).toBe(1);
  });

  it("★★入れた後は、全キャラで derived が末尾に固まっている", () => {
    for (const f of CHARACTER_FILES) {
      const fams = deriveSpecialFamilies(loadCharacter(f));
      const firstDerived = fams.findIndex((x) => x.isDerived);
      if (firstDerived < 0) continue; // derived 0 件のキャラ(chun_li / ingrid / terry / zangief)
      // firstDerived 以降がすべて derived であること。
      expect(fams.slice(firstDerived).every((x) => x.isDerived)).toBe(true);
      expect(fams.length - firstDerived).toBe(
        fams.filter((x) => x.isDerived).length,
      );
    }
  });

  it("★★非 derived どうし・derived どうしの相対順が変わっていない", () => {
    for (const f of CHARACTER_FILES) {
      const fams = deriveSpecialFamilies(loadCharacter(f));
      const before = originalOrder(fams).map((x) => x.family);
      const keep = (want: boolean) =>
        before.filter((name) => {
          const fam = fams.find((x) => x.family === name);
          return fam != null && fam.isDerived === want;
        });
      expect(fams.filter((x) => !x.isDerived).map((x) => x.family)).toEqual(
        keep(false),
      );
      expect(fams.filter((x) => x.isDerived).map((x) => x.family)).toEqual(
        keep(true),
      );
    }
  });

  it("★★魔身のファミリーが 1 件も消えていない(入力手段が消える面が無い)", () => {
    const jamie = deriveSpecialFamilies(loadCharacter("jamie.csv"));
    const devil = jamie
      .filter((x) => x.family.startsWith("the_devil_inside"))
      .map((x) => x.family);
    expect(devil.sort()).toEqual([
      "the_devil_inside",
      "the_devil_inside_reach_drink_lv4",
      "the_devil_inside_up2",
      "the_devil_inside_up2_reach_drink_lv4",
      "the_devil_inside_up3",
      "the_devil_inside_up3_reach_drink_lv4",
      "the_devil_inside_up4",
    ]);
    // ★素(酔い+1)だけが先頭側に残り、残る 6 件が末尾へ回る。
    expect(jamie[0].family).toBe("the_devil_inside");
    expect(jamie.filter((x) => x.family.startsWith("the_devil_inside") && x.isDerived))
      .toHaveLength(6);
  });

  it("★★M30-03 が載せた A2 が、並べ替えで 1 件も消えていない", () => {
    // ★A2 の代表(blanka のライトニングビースト系・jamie の酔いレベル4 系)が
    //   ファミリーとして在り、強度も欠けていないこと。
    const blanka = deriveSpecialFamilies(loadCharacter("blanka.csv"));
    const lb = blanka.find(
      (x) => x.family === "lightning_beast_rolling_attack",
    );
    expect(lb).toBeDefined();
    expect(Object.keys(lb?.byVariant.plain ?? {}).sort()).toEqual([
      "heavy",
      "light",
      "medium",
      "od",
    ]);
    const jamie = deriveSpecialFamilies(loadCharacter("jamie.csv"));
    expect(
      jamie.filter((x) => x.family.startsWith("drink_level_4_")),
    ).toHaveLength(3);
  });

  it("★★★isDerived の分類そのものを全 369 ファミリーで独立に主張する", () => {
    // ★★★これが 1.3(178)と 1.4(47)の床である —— あの 2 つは `fam.isDerived` を
    //   数えているだけなので、分類が壊れていれば両方そろって同じだけ狂う。
    //   ⇒ ここでは `fam.byVariant` の move id から**元の move を引き直して** AND を
    //     取り、実装の出力と突き合わせる。実装の畳み込みを読み直してはいない。
    // ★★旧版は混在(anyD && !allD)のときだけ主張していた。⇒ 「段 2 の畳み込みから
    //   特定の変種が漏れる」型の壊れ方を、混在 5 件が偶然その形を含むかどうかに
    //   賭けていた(レビュー 中-1)。
    const wrong: string[] = [];
    const mixed: string[] = [];
    let checked = 0;
    for (const f of CHARACTER_FILES) {
      const code = basename(f, ".csv");
      const moves = loadCharacter(f).filter((m) => m.category === "special");
      const fams = deriveSpecialFamilies(moves);
      // ★★【2026-09-11 差し替え・2 巡目レビュー 低-6】守りたい主張は
      //   「**並べ替えで既定選択が動いていない**」である(SpecialMovePanel の
      //   `families[0]` フォールバック)。⇒ 見るべきは並べ替え**前**の先頭である。
      // ★旧版は `fams[0].isDerived` を見ていたが、段 3 が在る限り
      //   「全ファミリーが derived のキャラ」以外では構造上必ず false になり、
      //   **段 3 を外す変異注入でも緑のままだった**(near-tautological)。
      // ★実測: 31 キャラすべて、CSV の最初の `category=special` 行が
      //   `is_derived=false` である。⇒ 着手時点の先頭も非 derived であり、
      //   並べ替えの前後で `families[0]` は同じファミリーのままである。
      expect(
        originalOrder(fams)[0].isDerived,
        `${code} の並べ替え前の先頭ファミリー`,
      ).toBe(false);
      expect(fams[0].family, `${code} の既定選択`).toBe(
        originalOrder(fams)[0].family,
      );
      for (const fam of fams) {
        const ids = new Set(
          Object.values(fam.byVariant).flatMap((byStrength) =>
            Object.values(byStrength ?? {}),
          ),
        );
        const members = moves.filter((m) => ids.has(m.id));
        const anyD = members.some((m) => m.isDerived);
        const allD = members.every((m) => m.isDerived);
        checked += 1;
        if (fam.isDerived !== allD) {
          wrong.push(
            `${code}/${fam.family}(isDerived=${fam.isDerived} want ${allD})`,
          );
        }
        if (anyD && !allD) mixed.push(`${code}/${fam.family}`);
      }
    }
    expect(wrong).toEqual([]);
    expect(checked).toBe(369);

    // ★混在(素は false・変種だけ true)の全数。
    // ★★【2026-09-12 更新・M30-07】5 件 → 7 件。⇒ **増えたのは本サブの成果である。**
    //   guile の【ジャスト】版が基底へ畳まれた結果、`sonic_boom` / `somersault_kick` が
    //   「素 is_derived=false ＋ perfect 変種 is_derived=true」の混在になった
    //   (畳む前は別ファミリーだったため混在に数えられなかった)。
    //   ★`sonic_cross` は入らない——素も【ジャスト】版も全メンバー is_derived=true であり、
    //     混在ではないからである。⇒ 3 ファミリーのうち 2 件だけが増えるのが正しい。
    //   ★ホールド変種による既存 5 件は 1 件も動いていない。
    expect(mixed.sort()).toEqual([
      "akuma/gou_hadoken",
      "cammy/cannon_spike",
      "cammy/hooligan_combination",
      "cammy/spiral_arrow",
      "guile/somersault_kick",
      "guile/sonic_boom",
      "luke/flash_knuckle",
    ]);
  });
});

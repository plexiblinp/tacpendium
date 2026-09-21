// コマンド入力解決 段階1(決定論引き当て)＋必殺技ファミリー導出(M15-03、DES-004 §2.1)。
//
// 死守契約 3 点(command-resolution-request §1-1):
//   1. 公式表記のみ解決 — 方向ゾーン(ニュートラル/下/上)とボタンだけを見る決定論ルックアップ。
//      汚い入力・簡易入力(236LP 等)は解釈しない。
//   2. モーション解析なし — 236/214/623 の列・溜めを認識しない。
//   3. 出口は必ず move_code(= 当該キャラ moves から一致解決した moveId)。
//
// command 非依存(raw_data.command を参照しない。段階2 = M17 の領分)。すべて副作用なしの純関数。

import type { Move } from "@/features/moves/types";

export type DirectionZone = "neutral" | "down" | "up";
export type Strength = "light" | "medium" | "heavy";
export type AttackButton = "punch" | "kick";

// 方向ゾーン → move_code の variant 接頭辞(DES-004 §2.1)。
// neutral=立ち(standing) / down=しゃがみ(crouching) / up=ジャンプ攻撃(jumping)。
// 移動のみのジャンプ(jump_neutral 等)は別系統 seed のため段階1 の合成形と一致せず、対象外。
const ZONE_PREFIX: Record<DirectionZone, string> = {
  neutral: "standing",
  down: "crouching",
  up: "jumping",
};

// 方向ゾーン×強度×ボタン → 通常技 move_code を合成する(DES-004 §2.1)。
// 例: (down, medium, kick) → "crouching_medium_kick"。
export function buildNormalMoveCode(
  zone: DirectionZone,
  strength: Strength,
  button: AttackButton,
): string {
  return `${ZONE_PREFIX[zone]}_${strength}_${button}`;
}

// 段階1 引き当て: 合成した move_code を当該キャラの moves から完全一致で解決し moveId を返す。
// 該当 variant が seed に無ければ null(= ボタン非活性のフォールバック)。誤引き当て・例外送出はしない。
export function resolveStage1MoveId(
  moves: Move[],
  zone: DirectionZone,
  strength: Strength,
  button: AttackButton,
): number | null {
  const code = buildNormalMoveCode(zone, strength, button);
  const move = moves.find((m) => m.code === code);
  return move ? move.id : null;
}

// ラッシュ版通常技の move_code を合成する。rush_<元技code>(DES-004 §2.1)。
export function buildRushMoveCode(
  zone: DirectionZone,
  strength: Strength,
  button: AttackButton,
): string {
  return `rush_${buildNormalMoveCode(zone, strength, button)}`;
}

// 任意の元技 code から rush_<元技code> を引き当てる(通常技・特殊技共通の汎用ヘルパー)。
// seed に該当 rush_variant が無ければ null(データ駆動非活性)。
export function resolveRushByCode(moves: Move[], baseCode: string): number | null {
  const move = moves.find((m) => m.code === `rush_${baseCode}`);
  return move ? move.id : null;
}

// ラッシュ版引き当て(通常技): rush_<元技code> を解決する。
// 上ゾーン(ジャンプ=空中)はラッシュ不可(category∈{normal,unique}∧is_aerial=false、DES-003 §3.3)のため null。
export function resolveRushMoveId(
  moves: Move[],
  zone: DirectionZone,
  strength: Strength,
  button: AttackButton,
): number | null {
  if (zone === "up") return null;
  return resolveRushByCode(moves, buildNormalMoveCode(zone, strength, button));
}

// 当該キャラの moves に特殊技(unique)のラッシュ版(rush_<unique code>)が 1 件でも存在するか。
// 特殊技タブのラッシュトグル表示可否に用いる(存在しなければトグルを出さない=空状態の回避)。
//
// ★★M35-02: 例として挙げていた `ryu` を外した。**ryu は反例である**——
//   rush_collarbone_breaker / rush_solar_plexus_strike / rush_short_uppercut /
//   rush_axe_kick / rush_whirlwind_kick を持つため、本関数は着手時点から true を返していた。
//   ★ryu はむしろ「トグルは出るのに 1 ボタンだけ押せない」という M35-02 の実害そのものの例である
//     (基底 code が axe_kick_2 だったため resolveRushByCode が rush_axe_kick_2 を探して外れた)。
//   ★失効は M35-02 が起こしたのではなく、着手前から失効していた(実測で確認)。
export function hasUniqueRushVariant(moves: Move[]): boolean {
  return moves.some(
    (m) => m.category === "unique" && resolveRushByCode(moves, m.code) != null,
  );
}

// --- 必殺技ファミリー導出(必殺技直接指定 UI、DES-004 §2.1 の `<技名>_<強度>` / `<技名>_od`) ---

// ★★M30-02(P4M-016): "none" を足した。**強度の概念を持たない必殺技**を表す。
//   例＝`tenshin`(点辰) / `sonic_break` / `double_lariat` / `quick_burn`。
//   ★これは「強度が seed に無い」ではなく「その技に強度が存在しない」である。
export type SpecialStrength = "none" | "light" | "medium" | "heavy" | "od";

// 強度の表示順(強度なし→弱→中→強→OD)。UI のボタン並びに用いる。
export const SPECIAL_STRENGTH_ORDER: SpecialStrength[] = [
  "none",
  "light",
  "medium",
  "heavy",
  "od",
];

const SPECIAL_STRENGTH_SUFFIX: Array<[Exclude<SpecialStrength, "none">, string]> = [
  ["od", "_od"],
  ["light", "_light"],
  ["medium", "_medium"],
  ["heavy", "_heavy"],
];

// ★★強度語そのものの集合。**書き起こさない**——上の接尾辞表から導く。
//   2 か所に書くと、片方だけ直って静かにずれる(指示書 M30-03 §2.2 の警告)。
// ★★並びは SPECIAL_STRENGTH_SUFFIX と同一である(od → light → medium → heavy)。
//   ⇒ この並びが「強度語が複数在るときにどれを採るか」の優先順位そのものになる(§4.2)。
//     順序を持たない Set にしないこと —— 優先順位が消える。
const SPECIAL_STRENGTH_TOKENS: ReadonlyArray<
  [Exclude<SpecialStrength, "none">, string]
> = SPECIAL_STRENGTH_SUFFIX.map(([strength, suffix]) => [strength, suffix.slice(1)]);

// 必殺技 move_code をファミリーと強度に分解する。
//
// 1. 末尾が強度接尾辞               → { family, strength }  例 "hadoken_light"
// 2. ★強度語が code の**途中**に在る → { family, strength }  例 "lightning_beast_light_rolling_attack"
//                                      ⇒ family "lightning_beast_rolling_attack" / strength "light"
// 3. 強度語がどこにも無い           → { family: code, strength: "none" }  例 "tenshin"
//
// ★★【2026-09-10 更新・M30-03】本関数は**全域である**(null を返さない)。
//   ⇒ category==='special' の move は**全数が必殺技タブへ載る**。
//   ★実測(母集団 = `moves` テーブル 3026 行 / 31 キャラ): 案 (i) 適用後に未分類へ残る
//     special は **0 件**である。⇒ `isOnSpecialTab` は category だけを見れば足りる。
//
// ★★2 を足したのは M30-03(開発者の逐語＝「Jamie の必殺技に、酔いレベル4の流酔拳だけ
//   固有状態技なのに出ていました」)。着手時点は null を返しており、**同じ「状態版の必殺技」
//   なのに `move_code` の書き方の違いだけで扱いが割れていた**——
//   末尾に強度がある `drink_level_4_freeflow_strikes_light` は載り、
//   途中に強度がある `lightning_beast_light_rolling_attack` は載らなかった(A2・実測 105 件)。
//
// ★★★規則 1 が規則 2 より先であることが要である。**順序を入れ替えてはいけない。**
//   ⇒ 入れ替えると**着手時点の判定が動く**。実測で `code` に強度語を 2 つ以上持つ special が
//     **15 件**実在し(`cammy/cannon_strike_light_od_hooligan_combination_od` /
//     `elena/lynx_whirl_od_spinning_scythe_light` / `ingrid/od_sun_shot_light` 系)、
//     **その 15 件はすべて末尾にも強度語を持つ**。規則 1 が先である限り、
//     着手時点に載っていた技の family / strength は **1 件も動かない**(実測 0 件)。
//   ★この「動かないこと」は moveSurfacing.roster.test.ts が全数で固定している。
//
// ★★規則 2 が採るのは「最初に見つかった強度語」ではなく
//   **SPECIAL_STRENGTH_TOKENS の並び順(od → light → medium → heavy)で最初のもの**である(§4.2)。
//   ⇒ ファミリー名は**その 1 トークンだけ**を抜いた残りを連結する。
//     例 "flame_od_kachousen" → family "flame_kachousen" / strength "od"。
//     ★同じキャラの "flame_light_kachousen" も family "flame_kachousen" へ落ちる。
//       ⇒ 強度違いが 1 ファミリーへ合流する。これが本サブの目的そのものである。
//   ★実測でファミリー衝突は **0 件**(2 つの違う技が同じ family+strength へ落ちない)。
//
// ★★3 を足したのは P4M-016(開発者の逐語＝「強度のない技のノーマル版が選択できない」)。
//   着手時点では null を返しており、強度接尾辞を持たない A1(実測 187 件)は
//   必殺技タブに 1 件も出ていなかった(CHANGE-166 が明文化した設計)。
export function parseSpecialCode(
  code: string,
): { family: string; strength: SpecialStrength } {
  for (const [strength, suffix] of SPECIAL_STRENGTH_SUFFIX) {
    if (code.endsWith(suffix)) {
      return { family: code.slice(0, -suffix.length), strength };
    }
  }
  const tokens = code.split("_");
  for (const [strength, token] of SPECIAL_STRENGTH_TOKENS) {
    const i = tokens.indexOf(token);
    if (i >= 0) {
      return {
        family: [...tokens.slice(0, i), ...tokens.slice(i + 1)].join("_"),
        strength,
      };
    }
  }
  return { family: code, strength: "none" };
}

// --- 変種(ホールド / 最大ホールド / ジャスト)---
//
// ★★M30-02(P4M-018): 開発者の逐語＝「マリーザ:【ホールド】弱グラディウスが画面に出ている。
//   ただ強度を選ぶと、普通に弱中強のホールド版になる」。
//   ⇒ 着手時点は `gladius_holding` が **強度の外(ファミリー行)** に 1 つ出たうえで、
//     その中でまた弱中強を選ぶ形だった。同じものが 2 か所に見える。
//   ★開発者判断(2026-09-09)＝**案 B**: 強度の外からホールドを消し、修飾として選ばせる。
//   ★★射程は必殺技だけである。通常技・特殊技の `_holding` には触れない(同判断)。
export type SpecialVariant = "plain" | "holding" | "max_holding" | "perfect";

// 変種の表示順(通常→ホールド→最大ホールド→ジャスト)。
export const SPECIAL_VARIANT_ORDER: SpecialVariant[] = [
  "plain",
  "holding",
  "max_holding",
  "perfect",
];

// ★★照合は長い接尾辞から行う —— `_max_holding` は `_holding` でも終わる。
//   順序を入れ替えると「最大ホールド」が「ホールド」として畳まれ、静かに 1 変種消える。
const SPECIAL_VARIANT_SUFFIX: Array<[Exclude<SpecialVariant, "plain">, string]> = [
  ["max_holding", "_max_holding"],
  ["holding", "_holding"],
  ["perfect", "_perfect"],
];

/**
 * ファミリー識別子を「基底 ＋ 変種」に割る。
 *
 * ★★畳むのは、剥がした基底が**同じキャラの必殺技ファミリーとして実在するとき**だけである。
 *   実在しなければ独立したファミリーのまま残す。
 *   ⇒ seed 実測では孤児 0 件だが、データが動いたときに静かに壊れないようにする
 *     (基底が消えた変種を「基底の変種」として畳むと、ファミリー行から消えて到達不能になる)。
 *
 * ★★後退経路が 1 つある(2026-09-09 レビュー 低-2)。最初に一致した接尾辞で基底が実在しなければ、
 *   ループは**次の接尾辞へ進む**。⇒ `X_max_holding` は `X` が無く `X_max` が在れば
 *   「`X_max` のホールド版」として畳まれる。**現行 seed では発生しない**(衝突 0 件・孤児 0 件)が、
 *   命名が動いたときに起こりうる形として明記しておく。
 */
export function splitSpecialVariant(
  family: string,
  hasFamily: (name: string) => boolean,
): { base: string; variant: SpecialVariant } {
  for (const [variant, suffix] of SPECIAL_VARIANT_SUFFIX) {
    if (family.endsWith(suffix)) {
      const base = family.slice(0, -suffix.length);
      if (hasFamily(base)) return { base, variant };
    }
  }
  return { base: family, variant: "plain" };
}

export interface SpecialFamily {
  family: string; // ファミリー識別子(例: "hadoken")
  /**
   * 代表表示名。未登録なら null → UI は `family` を表示する。
   *
   * ★★【M30-06 更新】「plain 変種の最弱強度の `nameJa`」ではない。
   *   - メンバーの名前が**強度語だけ**違うファミリーでは、その強度語を落とした**共通形**になる。
   *     ⇒ この場合、どのメンバーの `nameJa` とも一致しない合成文字列である。
   *   - それ以外は従来どおり優先順(`light` → `none` → `medium` → `heavy` → `od`)の 1 件。
   */
  nameJa: string | null;
  /** 変種 → 強度 → moveId(seed に存在するもののみ)。 */
  byVariant: Partial<Record<SpecialVariant, Partial<Record<SpecialStrength, number>>>>;
  /** 存在する変種(SPECIAL_VARIANT_ORDER の順)。1 つだけなら UI は変種行を出さない。 */
  variants: SpecialVariant[];
  /**
   * そのファミリーに属する move が**すべて** `is_derived = true` か(M30-04)。
   *
   * ★★「全部」である。1 件でも false が混じるファミリーは false になる。
   *   ⇒ 素の強度が直接入力できるのに末尾へ沈める、を避けるためである。
   *   実測(seed CSV 31 キャラ)で混在は 5 件
   *   (akuma `gou_hadoken` / cammy `spiral_arrow` `cannon_spike` `hooligan_combination` /
   *    luke `flash_knuckle`。いずれも素は false・ホールド変種だけ true)。
   * ★★用途は**並び順だけ**である(§2.2)。入力面の可否判定には使わない(D-807)。
   *   `is_derived` は「単独入力が不可能」を意味しない(DES-003 §3.3 errata③)。
   */
  isDerived: boolean;
}

// category==="special" の move をファミリー・変種・強度の 3 軸へ分解して集約する。
// ★存在する強度のみ byVariant[variant] に入る(データ駆動活性の材料)。出現順を保持する。
//   ★★【2026-09-09 更新・M30-02】旧 `byStrength` は `byVariant` へ置き換わった。
//     フィールドとしての `byStrength` はもう存在しない(レビュー 高-1)。
//
// ★★★【2026-09-10 更新・M30-04】出力順は「初出順」そのものではなくなった。
//   段 3 で **isDerived のファミリーを末尾へ回す**(開発者判断 `D-801`＝削るのではなく
//   末尾へ出す)。⇒ 群の**中**の相対順は初出順(＝`moves.id` 昇順＝seed CSV の行順)のままである。
//   ★1 件も落とさない。前後でファミリー数は同じである。
export function deriveSpecialFamilies(moves: Move[]): SpecialFamily[] {
  // 段 1: code → (ファミリー識別子, 強度) を集める。変種はまだ独立している。
  const raw = new Map<string, Partial<Record<SpecialStrength, number>>>();
  const rawName = new Map<string, string>();
  const rawRank = new Map<string, number>();
  // ★raw ファミリーごとの「属する move の表示名(強度語を落とした形)」の集合(M30-06)。
  //   ⇒ 優先順の 1 件だけでは「メンバー間で名前が割れているか」が判らない。
  const rawNameVariants = new Map<string, Set<string>>();
  // ★raw ファミリーごとの「属する move がすべて is_derived か」(M30-04)。
  const rawDerived = new Map<string, boolean>();
  const order: string[] = [];
  // 代表名をどの強度から採るかの優先順。★"none" を "light" の次に置く(M30-02)——
  //   強度を持たない技の name_ja は強度語を含まないため、最も素直な代表名になる。
  const namePriority = (strength: SpecialStrength): number =>
    ["light", "none", "medium", "heavy", "od"].indexOf(strength);
  for (const m of moves) {
    if (m.category !== "special") continue;
    // ★★M30-03 以降 parseSpecialCode は全域である。⇒ special は 1 件も落ちない。
    //   (着手時点は A2 105 件がここで null になり、必殺技タブから漏れていた)
    const { family, strength } = parseSpecialCode(m.code);
    let byStrength = raw.get(family);
    if (!byStrength) {
      byStrength = {};
      raw.set(family, byStrength);
      order.push(family);
    }
    byStrength[strength] = m.id;
    rawDerived.set(family, (rawDerived.get(family) ?? true) && m.isDerived);
    const p = namePriority(strength);
    if (m.nameJa && (!rawName.has(family) || p < (rawRank.get(family) ?? 99))) {
      rawName.set(family, stripStrengthLabel(m.nameJa));
      rawRank.set(family, p);
    }
    if (m.nameJa) {
      let names = rawNameVariants.get(family);
      if (!names) {
        names = new Set<string>();
        rawNameVariants.set(family, names);
      }
      names.add(stripStrengthLabel(m.nameJa));
    }
  }

  // ★★M30-06: メンバー間で名前が割れているファミリーの代表名を作り直す。
  //   ⇒ 上の優先順(`light` → …)は 1 メンバーの名前をそのまま行名にするため、
  //     弱/中/強が選べる行なのに「弱…派生」で固定される行が実在した(cammy 4 行)。
  //   ★差が強度語だけのときにしか畳まない。⇒ 畳めなければ優先順の 1 件をそのまま使う。
  //
  // ★★射程は raw ファミリーである。⇒ `X_holding` などの**変種も回る**(段 2 で基底へ畳まれる前)。
  //   段 2 は「代表名は plain から採る」ため、変種側の結果が使われるのは
  //   **基底が名前を持たないとき**(`entry.nameJa == null`)だけである。
  //   ★実測でその経路に入る割れた変種は `luke/flash_knuckle_holding` の 1 件のみであり、
  //     同件は差が強度語でないため畳まれない。⇒ 現状 plain 以外に効いている行は 0 件である。
  for (const [family, names] of rawNameVariants) {
    if (names.size < 2) continue;
    const collapsed = collapseStrengthOnlyDifference([...names]);
    if (collapsed) rawName.set(family, collapsed);
  }

  // 段 2: 変種を基底へ畳む(P4M-018 案 B)。
  const map = new Map<string, SpecialFamily>();
  const outOrder: string[] = [];
  const hasFamily = (name: string) => raw.has(name);
  for (const family of order) {
    const { base, variant } = splitSpecialVariant(family, hasFamily);
    let entry = map.get(base);
    if (!entry) {
      entry = {
        family: base,
        nameJa: null,
        byVariant: {},
        variants: [],
        isDerived: true,
      };
      map.set(base, entry);
      outOrder.push(base);
    }
    // ★畳んだ変種も含めて AND を取る —— 素が入力できるファミリーを末尾へ沈めないため。
    // ★`?? true` は AND の単位元(段 1 と同じ向き)。`order` に載った family は必ず
    //   `rawDerived` を持つため**到達しない**が、欠損時の向きが段 1 と逆に見えると
    //   読み手が「どちらが正しいのか」を考えることになる(レビュー 中-5)。
    entry.isDerived = entry.isDerived && (rawDerived.get(family) ?? true);
    entry.byVariant[variant] = raw.get(family);
    // ★代表名は plain から採る —— 変種の name_ja は「【ホールド】弱グラディウス」の形であり、
    //   ファミリー名としては強度語も装飾も残ってしまう。
    if (variant === "plain" || entry.nameJa == null) {
      const name = rawName.get(family);
      if (name && (variant === "plain" || entry.nameJa == null)) entry.nameJa = name;
    }
  }
  for (const entry of map.values()) {
    entry.variants = SPECIAL_VARIANT_ORDER.filter((v) => entry.byVariant[v] != null);
  }

  // 段 3: isDerived のファミリーを末尾へ回す(M30-04 / D-801)。
  //
  // ★★`sort` を使わない —— 2 回の filter で群を作って連結する。安定ソートの有無に
  //   依らず、群の中の相対順が初出順のまま残ることが読んで分かる形にする。
  // ★連結なので件数は保存される(落ちない)。
  const families = outOrder.map((f) => map.get(f) as SpecialFamily);
  return [
    ...families.filter((f) => !f.isDerived),
    ...families.filter((f) => f.isDerived),
  ];
}

// ★★日本語の強度語を書くのはここ 1 か所だけである。下の 3 本はこの 1 本から組む。
//   ⇒ 2 か所以上に書くと、片方だけ直って静かにずれる(SPECIAL_STRENGTH_TOKENS と同じ理由)。
const STRENGTH_LABELS = "弱|中|強|OD";
// 強度語と技名のあいだに入りうる区切り(中黒・半角中黒・空白)。
const STRENGTH_SEPARATOR = "[・･\\s]*";
// ★先頭に付く状態装飾。実データに在るのは全角 【…】 と半角 […] の 2 形だけである
//   (実測・seed CSV 31 キャラ)。★ここに無い括弧は「落とさない」側へ落ちる(§4.4 の既定)。
// ★★この定数にキャプチャグループを足さないこと —— 下の `"$1"` が装飾を戻す前提が静かにずれる。
//   括弧で括る必要が出たら `(?:…)` を使う。
// ★装飾の種類が増えたら specialFamilyLabel.roster.test.ts の「装飾始まりの special 行は
//   157 行で、先頭は 【 と [ の 2 種だけである」が赤で知らせる(取りこぼしの床)。
const LEADING_DECORATION = "【[^】]*】|\\[[^\\]]*\\]";

// 先頭の状態装飾の**直後**に来る強度語(例 "【ジャスト】弱ソニックブーム")。装飾は残す。
const STRENGTH_AFTER_DECORATION = new RegExp(
  `^(${LEADING_DECORATION})(?:${STRENGTH_LABELS})${STRENGTH_SEPARATOR}`,
  "u",
);
const STRENGTH_PREFIX = new RegExp(`^(?:${STRENGTH_LABELS})${STRENGTH_SEPARATOR}`, "u");
const STRENGTH_SUFFIX = new RegExp(`${STRENGTH_SEPARATOR}(?:${STRENGTH_LABELS})$`, "u");

// 表示名の強度表記(弱/中/強/OD)を落としてファミリー名にする。
//
// 落とすのは次の 3 形だけである。
//   1. 接頭形               例 "弱波動拳"                    → "波動拳"
//   2. 末尾形               例 "波動拳・弱"                  → "波動拳"
//   3. ★先頭装飾の直後形   例 "【ジャスト】弱ソニックブーム" → "【ジャスト】ソニックブーム"
//
// ★★★3 を足したのは M30-05 である。**それ以外の位置の強度語は落とさない。**
//   ⇒ 同じ「名前の途中の強度語」でも意味が割れており、機械的に落とすと情報が消える(§0.3)。
//   - "【ライトニングビースト】弱ローリングアタック" の「弱」は**その技自身の強度**であり、
//     行の中で弱/中/強/OD を選ばせる以上、名前に残っていてはいけない(実測 23 行)。
//   - "キャノンストライク(弱ODフーリガン派生)" の「弱」は**派生元の強度**であり、
//     落とすと「どの派生元から出る技か」が読めなくなる
//     (ファミリー行として丸括弧の中に強度語が残るのは**実測 18 行**。
//      ★★M30-06 より前は 22 行であった —— 減った 4 行は本関数ではなく
//        **代表名の作り方**が変わったためであり、本関数の規則は 1 つも変えていない)。
//     ★特に `cannon_strike_{light,medium,heavy}_od_hooligan_combination` の 3 行は、
//       落とすと**3 行とも同一表示になり区別できなくなる**。
//     ★★例をあえて `_od_` の行にしてある —— "キャノンストライク(弱フーリガンコンビネーション派生)"
//       は M30-06 の対象行であり、**ファミリー行としては現在「弱」を含まない**
//       (本関数の出力には依然として含まれる)。⇒ 例に使うと読み手を誤らせる。
//   - "ODサンシュート"(ingrid)の「OD」は**技名の一部**である(この行の強度は弱/中/強)。
//     ★これが残るのは規則で守っているからではない。代表名の素は "弱ODサンシュート" であり、
//       **`.replace` が global ではないため接頭形が 1 回だけ落ちて OD が残る**。
//       ⇒ 3 本を global 化しないこと —— 落とすと `sun_shot` の表示名と衝突する。
//       この 1 行は specialFamilyLabel.roster.test.ts が逐語で固定している。
//   - "空中竜巻旋風脚" の「中」・"【強化】レオパードスナップ" の「強」は**強度語ですらない**。
//
// ★★丸括弧の中は見ない。先頭以外の装飾も見ない
//   —— "フェイタルレッグツイスター(【ホールド】強フーリガン…派生)" に当たってはいけない。
// ★★規則に当たらない形は**そのまま残す**のが既定である(§4.4＝壊すより残すほうがましである)。
// ★全数の回帰は specialFamilyLabel.roster.test.ts が seed CSV 31 キャラで固定している。
function stripStrengthLabel(nameJa: string): string {
  const stripped = nameJa
    .replace(STRENGTH_AFTER_DECORATION, "$1") // 先頭装飾の直後形(装飾は残す)
    .replace(STRENGTH_PREFIX, "") // 接頭形
    .replace(STRENGTH_SUFFIX, "") // 末尾形
    .trim();
  return stripped || nameJa;
}

// ★強度語そのものの集合。**書き起こさない** —— STRENGTH_LABELS から導く。
//   2 か所に書くと、片方だけ直って静かにずれる(SPECIAL_STRENGTH_TOKENS と同じ理由)。
// ★★ただし本導出は `STRENGTH_LABELS` が**純粋な交替のみ**であることに依存する。
//   ⇒ `(?:…)` や文字クラスを足すと、**正規表現としては動いたまま本集合だけが静かに壊れる**。
//   ★要素数 4 であることを specialFamilyRepresentativeName.roster.test.ts が固定している。
const STRENGTH_WORDS = new Set(STRENGTH_LABELS.split("|"));

// ★★M30-06: 同じファミリーに属する表示名が「強度語だけ」で違うとき、その強度語を
// 落とした形を返す。畳めないときは null を返し、呼び出し側は優先順の 1 件をそのまま使う
// (既定は「落とさない」＝ §4.4 と同じ向き。壊すより残すほうがましである)。
//
// 例: ["サイレントステップ(弱フーリガン派生)", "(中…)", "(強…)"]
//     → "サイレントステップ(フーリガン派生)"
//
// ★★★丸括弧という**位置を一切見ない**。⇒ 見るのは「そのファミリーの中で何が変わるか」だけである。
//   これが本関数の要である。位置で決めると `DES-004` §2.1 の規約(派生元の強度は丸括弧の中)に
//   真正面から反し、**落としてはいけない行を潰す**。
//   ★実測(seed CSV 31 キャラ): 丸括弧の中の強度語を位置で落とすと、
//     `cammy/cannon_strike_{light,medium,heavy}_od_hooligan_combination` のような兄弟が
//     同一表示になる組が新たに 5 組(13 ファミリー)できる。
//
// ★★★それらが本関数で潰れない理由は 2 つある。**「メンバーが 1 件だから」ではない**
//   (13 件のうち 3 件は 3 メンバーを持つ。実測)。
//   1. **`names.size` が数えるのは「メンバー数」ではなく「strip 後の*相異なる*名前の数」である。**
//      ⇒ elena `lynx_whirl_spinning_scythe` は 3 メンバーだが、弱/中/強が**接頭形**であり
//        stripStrengthLabel で揃うため、相異なる名前は 1 つしかない。⇒ 畳む条件に入らない。
//   2. **反例の兄弟どうしは別ファミリーに居る。** 本関数はファミリーの**中**しか見ないため、
//      ファミリーをまたぐ区別(`OD` 等)に触れない。⇒ 畳んだ後も区別が残る。
//      ⇒ cammy `reverse_edge_hooligan_combination` は**畳む対象でありながら**、
//        隣の `reverse_edge`(「リバースエッジ(ODフーリガンコンビネーション派生)」)と衝突しない。
//
// ★★★本関数単独は「落としすぎないこと」を保証しない。⇒ それを担保しているのは
//   specialFamilyRepresentativeName.roster.test.ts の**372 行全数の重複組テスト**である。
//
// ★★落とすのは「その行の中で既にボタンとして選べる情報」だけである。
//   行を区別している情報は、定義上ファミリーをまたぐので本関数には見えない。
//
// ★★★差が強度語**以外**を 1 つでも含むなら畳まない。空文字も強度語ではないので弾く。
//   ⇒ これが c_viper「【ODセービングフォース】前方ステップ」(差＝"" と "OD")や
//     cammy `razors_edge_slicer`(同型)を守っている。★実測でこの型は 6 件ある。
//
// ★★★`stripStrengthLabel` は 1 文字も変えていない。⇒ `DES-005` §6.1 の 3 形の規則は不変であり、
//   **表示名そのもの**(ステップに入る技名)も不変である。変えたのは*代表名の作り方*だけである。
//
// ★比較は**コードポイント単位**で行う(`Array.from`)。⇒ サロゲートペアを割らない。
function collapseStrengthOnlyDifference(names: string[]): string | null {
  const chars = names.map((n) => Array.from(n));
  const shortest = Math.min(...chars.map((c) => c.length));
  let prefix = 0;
  while (prefix < shortest && chars.every((c) => c[prefix] === chars[0][prefix])) prefix++;
  let suffix = 0;
  while (
    suffix < shortest - prefix &&
    chars.every((c) => c[c.length - 1 - suffix] === chars[0][chars[0].length - 1 - suffix])
  ) {
    suffix++;
  }
  const mids = chars.map((c) => c.slice(prefix, c.length - suffix).join(""));
  // 全員同じなら「割れている」ことにならない(呼び出し側の size>=2 と食い違う形は無いが、
  // 共通接頭辞・接尾辞の取り方に依らず成り立つ不変条件として書いておく)。
  if (new Set(mids).size < 2) return null;
  if (!mids.every((mid) => STRENGTH_WORDS.has(mid))) return null;
  const head = chars[0].slice(0, prefix).join("");
  const tail = chars[0].slice(chars[0].length - suffix).join("");
  return `${head}${tail}` || null;
}

// --- OD 4 種フラット(必殺技 OD の非プレーン変種 → modifiers.flags) ---

// OD の 4 種(プレーン/弱中/中強/弱強)。いずれも move は同一の <family>_od に解決し、
// 非プレーン 3 種のみ modifiers.flags を付与する(§4.4、値は labels.ts の MODIFIER_FLAGS と対応)。
export type OdVariant = "plain" | "lm" | "mh" | "lh";

export const OD_VARIANT_ORDER: OdVariant[] = ["plain", "lm", "mh", "lh"];

// 非プレーン OD 変種 → modifiers.flags 値。プレーン OD はフラグなし。
export const OD_VARIANT_FLAG: Record<Exclude<OdVariant, "plain">, string> = {
  lm: "od_lm",
  mh: "od_mh",
  lh: "od_lh",
};

/**
 * そのステップの move に OD 強度組合せ(od_lm / od_mh / od_lh)を付けてよいか。
 *
 * ★★M30-02(SD-020・射程拡大): 修飾フラグ側は着手時点で**この判定を持っていなかった**。
 *   MODIFIER_FLAGS は移動系・通常技を含むどのステップにも OD 組を出しており、
 *   「しゃがみ弱P に OD(弱中) を付ける」が実際に通った。
 *   ⇒ 開発者の指摘(2026-09-05・`A-6`)「OD 非活性で強度組み合わせだけ活性みたいに
 *      なっているパターンがないかは調査が必要」の答えは**「常にそうなっていた」**である。
 *
 * ★判定は「必殺技の OD である」= category==='special' かつ `code` を `_` で割ったトークンに
 *   `od` が在ること。OD 組は同一の `<family>_od` に解決したうえで flags を足すもの(§4.4)であり、
 *   OD でない move に付いた値は入力の再現として意味を持たない。
 *
 * ★★末尾の `_od` だけを見てはいけない(2026-09-09 レビュー 高-2)。
 *   `od` が `code` の途中に在る OD 必殺技が seed 全 31 キャラで **37 行**実在する
 *   (`mai/flame_od_kachousen` ／ `blanka/lightning_beast_od_rolling_attack` ／
 *    `ryu/denjin_charge_od_hadoken` ／ `ingrid/od_sun_shot_light` 等)。
 *   **⇒ 末尾だけで判定すると、着手時点にできた入力ができなくなる**(機能後退)。
 *   ★実測(2026-09-09)——`od` トークンを持つ `special` 行で `name_ja` に "OD" が
 *     含まれない行は **0**、`_od` 終わりで "OD" を含まない行も **0**、
 *     `special` 以外で `od` トークンを持つ行も **0**。⇒ トークン判定は取りこぼしも巻き添えも無い。
 *
 * ★★抑止するのは**新規付与だけ**である。既に値が入っている既存データからは
 *   外せるままにする(画面側で `disabled={!applicable && !checked}` とする)。
 *   ⇒ 「開いたら消えていた」を作らない。
 */
export function isOdVariantApplicable(move: Move | null | undefined): boolean {
  if (move == null) return false;
  return move.category === "special" && move.code.split("_").includes("od");
}

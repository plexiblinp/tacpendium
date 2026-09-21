import { describe, expect, it } from "vitest";

import ja from "@/locales/ja.json";
import en from "@/locales/en.json";
import { jaLabel } from "@/lib/ja-label";
import {
  HIT_TYPE_LABELS,
  HIT_TYPE_LABEL_KEYS,
  HIT_TYPE_SHORT_LABEL_KEYS,
  DRIVE_DAMAGE_DIRECTION_VALUES,
  DRIVE_DAMAGE_DIRECTION_LABEL_KEYS,
  HIT_TYPE_VALUES,
  OPPONENT_STANCE_LABELS,
  OPPONENT_STANCE_LABEL_KEYS,
  OPPONENT_STANCE_VALUES,
  OPPONENT_SIZE_LABELS,
  OPPONENT_SIZE_LABEL_KEYS,
  OPPONENT_SIZE_VALUES,
  STARTER_MEATY_LABELS,
  STARTER_MEATY_LABEL_KEY,
  STARTER_MEATY_LABEL_KEYS,
  STARTER_MEATY_VALUES,
  POSITION_LABELS,
  POSITION_LABEL_KEYS,
  POSITION_VALUES,
  SORT_FIELD_LABEL_KEYS,
  SORT_FIELD_VALUES,
} from "./combo-list";
import {
  GAUGE_AT_START_LABEL_JA,
  GAUGE_CONSUMED_LABEL_JA,
  HIT_TYPE_LABEL_JA,
  HIT_TYPE_OPTIONS,
  OPPONENT_SIZE_LABEL_JA,
  OPPONENT_STANCE_LABEL_JA,
  POSITION_LABEL_JA,
  POSITION_OPTIONS,
} from "@/features/combo/labels";
import {
  OKI_ATTACK_TYPES,
  OKI_ATTACK_TYPE_LABEL_KEYS,
  OKI_NO_GAUGE_LABEL_KEY,
  OKI_TECH_TYPES,
  OKI_TECH_TYPE_LABEL_KEYS,
  OKI_USES_DR_LABEL_KEY,
  okiOptionLabel,
} from "./oki";

// ★★M24-07: 表示ラベルの正典が「文字列」から「値 → i18n キーの対応表」へ移った。
//
// ★この形の壊れ方は静かである —— 存在しない i18n キーを指しても i18n は
//   キー文字列をそのまま返すため、画面には `situation.position.mid_screen` と出る。
//   型検査も lint も緑のまま通る。⇒ ここで機械的に押さえる。

function resolve(dict: unknown, key: string): string | undefined {
  let cur: unknown = dict;
  for (const part of key.split(".")) {
    if (typeof cur !== "object" || cur === null) return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return typeof cur === "string" ? cur : undefined;
}

const KEY_MAPS: ReadonlyArray<{
  name: string;
  values: readonly string[];
  keys: Readonly<Record<string, string>>;
}> = [
  { name: "POSITION", values: POSITION_VALUES, keys: POSITION_LABEL_KEYS },
  { name: "HIT_TYPE", values: HIT_TYPE_VALUES, keys: HIT_TYPE_LABEL_KEYS },
  // ★M27-03(P4M-021): 短縮表記も同じ値域と 1 対 1 である。
  //   ★HIT_TYPE_VALUES へ値を足したら短縮も足すこと——足し忘れると、
  //     閉じたフィルタにキー文字列がそのまま出る。
  {
    name: "HIT_TYPE_SHORT",
    values: HIT_TYPE_VALUES,
    keys: HIT_TYPE_SHORT_LABEL_KEYS,
  },
  {
    name: "OPPONENT_STANCE",
    values: OPPONENT_STANCE_VALUES,
    keys: OPPONENT_STANCE_LABEL_KEYS,
  },
  // ★M27-01 で登録した。それまで相手サイズだけ *_VALUES が無く、本表から外れていた
  //   ——「値域 ↔ キーの 1 対 1」が機械検査されない唯一の軸だった。
  {
    name: "OPPONENT_SIZE",
    values: OPPONENT_SIZE_VALUES,
    keys: OPPONENT_SIZE_LABEL_KEYS,
  },
  // ★M27-03(SD-009): ドライブダメージの符号の語。キー名を間違えると jaLabel の
  //   フォールバックでキー文字列がそのまま画面へ出る(M24-07 レビュー 高-2 の型)。
  {
    name: "DRIVE_DAMAGE_DIRECTION",
    values: DRIVE_DAMAGE_DIRECTION_VALUES,
    keys: DRIVE_DAMAGE_DIRECTION_LABEL_KEYS,
  },
  // ★M37-07: 始動技の持続当て(2 値)。「不問」を作らないため値域は yes / no だけである。
  {
    name: "STARTER_MEATY",
    values: STARTER_MEATY_VALUES,
    keys: STARTER_MEATY_LABEL_KEYS,
  },
  { name: "OKI_ATTACK_TYPE", values: OKI_ATTACK_TYPES, keys: OKI_ATTACK_TYPE_LABEL_KEYS },
  { name: "OKI_TECH_TYPE", values: OKI_TECH_TYPES, keys: OKI_TECH_TYPE_LABEL_KEYS },
];

describe("表示ラベルの i18n キー対応表", () => {
  it.each(KEY_MAPS)("$name: 値域のすべてにキーが在る", ({ values, keys }) => {
    expect(values.filter((v) => !keys[v])).toEqual([]);
  });

  it.each(KEY_MAPS)("$name: 余分なキーが無い(値域と 1 対 1)", ({ values, keys }) => {
    expect(Object.keys(keys).filter((k) => !values.includes(k))).toEqual([]);
  });

  it("★★すべてのキーが ja / en の両方で引ける(キー文字列がそのまま画面へ出ない)", () => {
    const allKeys = [
      ...KEY_MAPS.flatMap(({ keys }) => Object.values(keys)),
      OKI_USES_DR_LABEL_KEY,
      OKI_NO_GAUGE_LABEL_KEY,
      // ★M37-07: 欄そのものの語(値ではない)。ja / en の両方で引けること。
      STARTER_MEATY_LABEL_KEY,
      ...SORT_FIELD_VALUES.flatMap((f) =>
        [
          SORT_FIELD_LABEL_KEYS[f].asc,
          SORT_FIELD_LABEL_KEYS[f].desc,
          SORT_FIELD_LABEL_KEYS[f].default,
        ].filter((k): k is string => Boolean(k)),
      ),
    ];
    expect(allKeys.length).toBeGreaterThan(20); // 陽性対照
    expect(allKeys.filter((k) => resolve(ja, k) === undefined)).toEqual([]);
    expect(allKeys.filter((k) => resolve(en, k) === undefined)).toEqual([]);
  });

  // ★★i18n を通らない画面(エディタ / 確定反撃マイリスト / PDF・画像出力)へ配る
  //   日本語の写しが、同じ ja.json から導出されていること。
  //   ★ここが割れると「同じ語が 2 か所にある」状態へ逆戻りする(E-76)。
  it("★★*_LABELS は ja.json から導出されている(語を 2 か所に書いていない)", () => {
    const derived: ReadonlyArray<[Readonly<Record<string, string>>, Readonly<Record<string, string>>]> =
      [
        [POSITION_LABELS, POSITION_LABEL_KEYS],
        [HIT_TYPE_LABELS, HIT_TYPE_LABEL_KEYS],
        [OPPONENT_STANCE_LABELS, OPPONENT_STANCE_LABEL_KEYS],
        [OPPONENT_SIZE_LABELS, OPPONENT_SIZE_LABEL_KEYS],
        [STARTER_MEATY_LABELS, STARTER_MEATY_LABEL_KEYS],
      ];
    for (const [labels, keys] of derived) {
      for (const [value, key] of Object.entries(keys)) {
        expect(labels[value]).toBe(jaLabel(key));
      }
    }
  });

  // ★★M28-02a: POSITION_LABEL_JA(features/combo/labels.ts)も網に入れる。
  //   ★★着手前、本表だけが ja.json 由来ではなく**直書き**であり、上の derived 表にも
  //     載っていなかった。⇒ HIT_TYPE_LABEL_JA / OPPONENT_SIZE_LABEL_JA は守られていたのに、
  //     position だけが「語を 2 か所に書いている」状態のまま検査の外に在った。
  //   ★区分を 5 → 7 へ増やすにあたり、静かに落ちうる唯一の箇所だったのでここで塞ぐ。
  it("★★POSITION_LABEL_JA も ja.json から導出されている(エディタ専用の写し)", () => {
    for (const [value, key] of Object.entries(POSITION_LABEL_KEYS)) {
      expect(POSITION_LABEL_JA[value]).toBe(jaLabel(key));
    }
    // 値域と 1 対 1(余分な値が残っていない)。
    expect(
      Object.keys(POSITION_LABEL_JA).filter(
        (k) => !(POSITION_VALUES as readonly string[]).includes(k),
      ),
    ).toEqual([]);
  });

  // ★★M28-02a: エディタの選択肢が表示順の正本(POSITION_VALUES)に従っていること。
  //   ★着手前は POSITION_OPTIONS が独立した写しであり、一覧フィルタと エディタ で
  //     並び順が別々に定義されていた。⇒ 片方だけ直すと静かにずれる。
  it("★★POSITION_OPTIONS の並びが POSITION_VALUES と一致する", () => {
    expect(POSITION_OPTIONS.map((o) => o.value)).toEqual([...POSITION_VALUES]);
    expect(POSITION_OPTIONS.map((o) => o.label)).toEqual(
      POSITION_VALUES.map((v) => POSITION_LABEL_JA[v]),
    );
  });

  // ★★M37-03(レビュー 中-1): エディタの選択肢が値域の正本(HIT_TYPE_VALUES)に
  //   従っていること。POSITION_OPTIONS と同じ形の検査である。
  //   ★★並びが一致していることには意味がある —— エディタの数字キーは配列の順に
  //     割り当たる(optionButtons.ts の shortcutKeyForIndex)。⇒ 並びがずれると
  //     「一覧では 5 番目なのにエディタでは 7 番目」が起き、型検査もテストも通ったまま
  //     利用者の指が別の値を選ぶ。
  //   ★着手前は HIT_TYPE_OPTIONS の並びを見る検査が無く、labels.ts のコメントが
  //     「並びは HIT_TYPE_VALUES と同じにする」と散文で頼んでいるだけであった。
  it("★★HIT_TYPE_OPTIONS の並びが HIT_TYPE_VALUES と一致する", () => {
    expect(HIT_TYPE_OPTIONS.map((o) => o.value)).toEqual([...HIT_TYPE_VALUES]);
    expect(HIT_TYPE_OPTIONS.map((o) => o.label)).toEqual(
      HIT_TYPE_VALUES.map((v) => HIT_TYPE_LABEL_JA[v]),
    );
  });

  // ★既定引数が日本語固定であること。i18n を通らない画面はこの経路で描いている。
  it("★okiOptionLabel は既定で日本語を組み立てる", () => {
    expect(
      okiOptionLabel({ attackType: "throw_meaty", techType: "neutral_tech", usesDr: true }),
    ).toBe("投げ重ね(その場受け身・ドライブラッシュ)");
    expect(
      okiOptionLabel({ attackType: "shimmy", techType: "back_tech", usesDr: false }),
    ).toBe("シミー(後ろ受け身・ノーゲージ)");
  });

  // ★解決関数を差し替えれば別言語になる(i18n を通る画面はこちらを使う)。
  it("★okiOptionLabel は解決関数を差し替えると従う", () => {
    const enT = (key: string) => resolve(en, key) ?? key;
    expect(
      okiOptionLabel({ attackType: "shimmy", techType: "back_tech", usesDr: false }, enT),
      // ★★M24-07 レビュー(中-1): 区切りも locale から引くようにしたため、
      //   en では和文中黒ではなくスラッシュになる。★これは「たまたま現状を写して
      //   いた」側の主張であり、直すべきものだった。
    ).toBe("Shimmy(Back tech / No gauge)");
  });
});

// ★★M27-01: エディタ専用の日本語直書き(features/combo/labels.ts)と、
//   ja.json から導出した写し(constants/combo-list.ts の *_LABELS)が一致することを見る。
//
// ★★なぜ要るか —— 本リポジトリは「同じ値の呼び名を持つマップが 2 本ある」状態である
//   (labels.ts 冒頭の逐語)。エディタは i18n を通らないため labels.ts を読み、
//   一覧・詳細・比較・出力・フィルタ・重複警告・utils の 7 面は *_LABELS を読む。
//   ⇒ 片側だけ直しても tsc もテストも緑になり、**画面によって呼び名が違う**状態が残る。
//   M27-01 で labels.ts に「locale 側と 1 文字も違えないこと」と規約コメントを書いたが、
//   規約を書くだけでは運用にならない。ここで機械的に押さえる。
//
// ★2 本のマップの統合は横断リファクタであり本サブの射程外(labels.ts が自ら明記)。
//   ⇒ 統合はしないが、ズレたら赤くする。
describe("エディタ直書きラベルと ja.json の一致", () => {
  // ★★M29-01: OPPONENT_STANCE_LABEL_JA を足した。
  //   ★着手前は本表に HIT_TYPE と OPPONENT_SIZE しか載っておらず、
  //     **状況 4 軸のうち相手の状態だけがこの検査の外に在った**
  //     (M28-02a が POSITION で塞いだのと同型の穴)。
  //   ★stance は 4 値のうち any だけを *_LABELS から引いており、残り 3 値が
  //     直書きである。⇒ 片側だけ直しても tsc もテストも緑になる形だった。
  it.each([
    ["HIT_TYPE", HIT_TYPE_LABEL_JA, HIT_TYPE_LABELS],
    ["OPPONENT_SIZE", OPPONENT_SIZE_LABEL_JA, OPPONENT_SIZE_LABELS],
    ["OPPONENT_STANCE", OPPONENT_STANCE_LABEL_JA, OPPONENT_STANCE_LABELS],
  ])("%s: labels.ts の直書きが ja.json 由来の写しと一致する", (_name, direct, derived) => {
    expect(direct).toEqual(derived);
  });
});

// ★★M29-01: ゲージ欄のラベル 4 通りを網に入れた。
//
// ★★着手前、`labels.ts` の GAUGE_AT_START_LABEL_JA / GAUGE_CONSUMED_LABEL_JA と
//   ja.json の comboDetail.metadata.* / compare.row.* は**同じ語を持っているのに、
//   両者を突き合わせる検査が 1 つも無かった**。⇒ 片側だけ直しても緑のまま、
//   画面によって呼び名が違う状態が残る(E-76・上の describe と同じ理由)。
//   M29-01 で「消費 SA」「SAゲージ」等の第 3・第 4 の語幹を正典へ寄せたので、
//   戻らないようにここで固定する。
describe("ゲージ欄のラベルと ja.json の一致(M29-01)", () => {
  it.each([
    ["start.drive", GAUGE_AT_START_LABEL_JA.drive, "comboDetail.metadata.driveGauge"],
    ["start.sa", GAUGE_AT_START_LABEL_JA.sa, "comboDetail.metadata.saGauge"],
    ["consumed.drive", GAUGE_CONSUMED_LABEL_JA.drive, "comboDetail.metadata.driveGaugeConsumed"],
    ["consumed.sa", GAUGE_CONSUMED_LABEL_JA.sa, "comboDetail.metadata.saGaugeConsumed"],
  ])("%s: labels.ts の直書きが ja.json と一致する", (_name, direct, key) => {
    expect(direct).toBe(jaLabel(key));
  });

  // ★比較画面は別キーだが同じ語である(詳細と比較で呼び名が割れない)。
  it.each([
    ["driveGauge", "comboDetail.metadata.driveGauge", "compare.row.driveAvailableAtStart"],
    ["saGauge", "comboDetail.metadata.saGauge", "compare.row.saAvailableAtStart"],
    ["driveGaugeConsumed", "comboDetail.metadata.driveGaugeConsumed", "compare.row.driveGaugeConsumed"],
    ["saGaugeConsumed", "comboDetail.metadata.saGaugeConsumed", "compare.row.saGaugeConsumed"],
  ])("%s: 詳細と比較で同じ語である", (_name, detailKey, compareKey) => {
    expect(jaLabel(detailKey)).toBe(jaLabel(compareKey));
  });

  // ★★表記の割れ(半角スペースの有無)が戻らないようにする。
  //   M29-01 で詰め形「SAゲージ」へ寄せた。★retired-words.test.ts が
  //   「SA ゲージ」を禁則語として押さえているが、あちらは web/src だけを走査する。
  //   ⇒ 辞書そのものも見る(forbidden-words.test.ts と同じ考え方)。
  it("★★ja.json に「SA ゲージ」(半角スペース入り)が無い", () => {
    const flat = (obj: Record<string, unknown>, prefix = ""): Array<[string, string]> =>
      Object.entries(obj).flatMap(([k, v]) =>
        typeof v === "object" && v !== null
          ? flat(v as Record<string, unknown>, `${prefix}${k}.`)
          : [[`${prefix}${k}`, String(v)] as [string, string]],
      );
    const all = flat(ja as Record<string, unknown>);
    expect(all.length).toBeGreaterThan(500); // 陽性対照
    expect(all.filter(([, v]) => v.includes("SA ゲージ"))).toEqual([]);
    // ★陰性対照: 採った側の語は実在する(走査が空回りしていない)。
    expect(all.filter(([, v]) => v.includes("SAゲージ")).length).toBeGreaterThan(0);
  });
});

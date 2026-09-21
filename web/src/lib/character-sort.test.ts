import { describe, it, expect } from "vitest";

import {
  characterDisplayName,
  collationLocale,
  sortByLocale,
  sortCharactersByLocale,
  type SortableCharacter,
} from "./character-sort";

// ★実 seed を読まない固定データで検証する。
//   seed の表示名が変わっても本テストの主張(照合の規則)は変わらないため。
const ROSTER: SortableCharacter[] = [
  { nameJa: "リュウ", nameEn: "Ryu" },
  { nameJa: "ケン", nameEn: "Ken" },
  { nameJa: "ダルシム", nameEn: "Dhalsim" },
  { nameJa: "ジュリ", nameEn: "Juri" },
  { nameJa: "ガイル", nameEn: "Guile" },
  { nameJa: "舞", nameEn: "Mai" }, // ★漢字を含む
  { nameJa: "C.ヴァイパー", nameEn: "C.Viper" }, // ★ラテン文字で始まる
  { nameJa: "JP", nameEn: "JP" }, // ★全体がラテン文字
];

describe("collationLocale", () => {
  it("en 系は en へ、それ以外は ja へ畳む", () => {
    expect(collationLocale("en")).toBe("en");
    expect(collationLocale("en-US")).toBe("en");
    expect(collationLocale("EN")).toBe("en");
    expect(collationLocale("ja")).toBe("ja");
    expect(collationLocale("ja-JP")).toBe("ja");
    expect(collationLocale(undefined)).toBe("ja");
  });
});

describe("sortCharactersByLocale", () => {
  // ★★並べ替えのキーは「画面に出している値」= name_ja 固定である(レビュー 高-5)。
  //   name_en を表示している画面が 1 つも無いため、name_en で並べると
  //   「日本語名のリストが見えない英語名の順に並ぶ」= 無順序に見える。
  it("★name_ja の あ〜ん 昇順になる", () => {
    const got = sortCharactersByLocale(ROSTER).map((c) => c.nameJa);
    const kana = got.filter((n) => /^[ぁ-ヿー]+$/.test(n));
    expect(kana).toEqual(["ガイル", "ケン", "ジュリ", "ダルシム", "リュウ"]);
  });

  it("★★表示している値で並ぶ(ロケールでキーを変えない)", () => {
    // 引数はキャラ一覧だけ。言語を受け取らないので、表示と並びがずれる余地が無い。
    const got = sortCharactersByLocale(ROSTER).map((c) => c.nameJa);
    const expected = [...ROSTER]
      .map((c) => c.nameJa)
      .sort(new Intl.Collator("ja").compare);
    expect(got).toEqual(expected);
  });

  it("★★既知の受容挙動: name_ja に漢字を含むキャラは末尾に来る(characters に読み仮名の列が無いため)", () => {
    const got = sortCharactersByLocale(ROSTER).map((c) => c.nameJa);
    expect(got[got.length - 1]).toBe("舞");
  });

  it("★★既知の受容挙動: name_ja がラテン文字で始まるキャラは仮名より前に来る", () => {
    const got = sortCharactersByLocale(ROSTER).map((c) => c.nameJa);
    expect(got.slice(0, 2)).toEqual(["C.ヴァイパー", "JP"]);
  });

  it("入力配列を破壊しない", () => {
    const before = [...ROSTER];
    sortCharactersByLocale(ROSTER);
    expect(ROSTER).toEqual(before);
  });

  it("0 件・1 件でも落ちない", () => {
    expect(sortCharactersByLocale([])).toEqual([]);
    expect(sortCharactersByLocale([ROSTER[0]])).toEqual([ROSTER[0]]);
  });
});

// 汎用の sortByLocale は「ロケールでキーを切り替える」primitive として残してある。
// ★M24-07 でラベルをロケールに従わせたため、キャラ側も同じ考え方へ戻った。
describe("sortByLocale（汎用）", () => {
  it("日本語ロケールでは getJa をキーにする", () => {
    const got = sortByLocale(ROSTER, "ja", (c) => c.nameJa, (c) => c.nameEn);
    expect(got.map((c) => c.nameJa)).toEqual(
      [...ROSTER].map((c) => c.nameJa).sort(new Intl.Collator("ja").compare),
    );
  });

  it("英語ロケールでは getEn をキーにする", () => {
    const got = sortByLocale(ROSTER, "en", (c) => c.nameJa, (c) => c.nameEn);
    expect(got.map((c) => c.nameEn)).toEqual([
      "C.Viper",
      "Dhalsim",
      "Guile",
      "JP",
      "Juri",
      "Ken",
      "Mai",
      "Ryu",
    ]);
  });

  it("★言語を切り替えると並びが変わる", () => {
    const ja = sortByLocale(ROSTER, "ja", (c) => c.nameJa, (c) => c.nameEn);
    const en = sortByLocale(ROSTER, "en", (c) => c.nameJa, (c) => c.nameEn);
    expect(ja.map((c) => c.nameEn)).not.toEqual(en.map((c) => c.nameEn));
  });
});

// ★★M24-07(followup character-selector-label-is-ja-fixed): ラベルをロケールに
//   従わせた。★このとき**並べ替えキーも同時に**動かすことが要である ——
//   片方だけ変えると「日本語名のリストが、見えない英語名の順に並ぶ」形になり、
//   利用者の目には無順序に見える(M24-02 で実際に起きた = レビュー 高-5)。
describe("characterDisplayName / sortCharactersByLocale の対", () => {
  it("ja では日本語名を出す", () => {
    expect(characterDisplayName(ROSTER[0], "ja")).toBe(ROSTER[0].nameJa);
  });

  it("en では英語名を出す", () => {
    expect(characterDisplayName(ROSTER[0], "en")).toBe(ROSTER[0].nameEn);
  });

  it("en-US のような地域つきロケールも英語として扱う", () => {
    expect(characterDisplayName(ROSTER[0], "en-US")).toBe(ROSTER[0].nameEn);
  });

  it("ロケール未指定は日本語(既定)", () => {
    expect(characterDisplayName(ROSTER[0])).toBe(ROSTER[0].nameJa);
  });

  it("英語名が空なら日本語名へ落とす(ラベルが消えるより言語が揃わないほうがまし)", () => {
    expect(characterDisplayName({ nameJa: "リュウ", nameEn: "  " }, "en")).toBe("リュウ");
  });

  // ★★これが本サブの核心の観測である。表示と並びが同じ値で決まっていること。
  it("★★並びは「画面に出している値」の昇順になる(ja / en とも)", () => {
    for (const locale of ["ja", "en"] as const) {
      const sorted = sortCharactersByLocale(ROSTER, locale);
      const shown = sorted.map((c) => characterDisplayName(c, locale));
      const expected = [...shown].sort(new Intl.Collator(locale).compare);
      expect(shown).toEqual(expected);
    }
  });

  it("★言語を切り替えると並びが変わる(ja 固定に戻っていない)", () => {
    const ja = sortCharactersByLocale(ROSTER, "ja").map((c) => c.nameEn);
    const en = sortCharactersByLocale(ROSTER, "en").map((c) => c.nameEn);
    expect(ja).not.toEqual(en);
  });
});

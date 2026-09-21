// キャラクターの並び順(M24-02 §4.3.1)。
//
// ★★並べ替えのキーは「画面に出している値」である(開発者裁定 2026-08-26。レビュー 高-5)。
//   本アプリでキャラの表示名として出しているのは `name_ja` だけであり、
//   `name_en` を表示している画面は 1 つも無い(M24-02 の実査)。
//   ⇒ 英語ロケールで `name_en` をキーにすると、
//      「日本語名のリストが、見えない英語名の順に並ぶ」= 利用者の目には無順序に見える。
//   ⇒ 表示と並びを常に一致させる。ロケールに関わらず `name_ja` で並べる。
//
// ★★これにより指示書 §4.3.1 の「英語なら a〜z の昇順」は満たさない。
//   ラベルが ja 固定であるあいだは、その要件は原理的に満たせない。
//   撤回するか、ラベルもロケールに従わせるかは設計卓の手番である(完了報告 §12-6)。
//
// ★並べ替えは「表示時」に行い、データ取得時には固定しない。
//   サーバの ORDER BY(= characters.id)は変えない。
//
// ★★標準のロケール照合(Intl.Collator)だけを使う。自前の五十音テーブルは書かない。
//
// ────────────────────────────────────────────────────────────────
// ★★既知の例外 2 つ(2026-08-26 実測・開発者確認済み)。これは欠陥ではない。
//
//  (1) name_ja に漢字を含むキャラは、あ〜ん の並びの「最後」に来る。
//      characters に読み仮名の列が無く(id / game_id / code / name_ja / name_en /
//      custom_states)、照合器が音訓を解決できないため。
//      ★実測 2026-09-02(M14-03f・第四波 seed 後・31 体): 4 件
//        (mai="舞" / akuma="豪鬼" / chun_li="春麗" / e_honda="E.本田")。
//      ⇒ 「漢字キャラは一番下でよい」= 開発者判断(2026-08-26)。
//      〔2026-08-26 実測(19 体時点)は 1 件(mai)だった〕
//
//  (2) name_ja がラテン文字で始まるキャラは、仮名より「前」に来る。
//      ★実測 2026-09-02(31 体): 4 件
//        (c_viper="C.ヴァイパー" / jp="JP" / aki="AKI" / e_honda="E.本田")。
//      〔2026-08-26 実測(19 体時点)は 2 件(c_viper / jp)だった〕
//
//  ★★2026-09-02 追記(M14-03f)。★受容判断の母数が変わった。
//    開発者が「欠陥ではない」と裁定した 2026-08-26 時点の母数は 19 体中 3 件だったが、
//    第四波で 31 体になり 6 件(うち e_honda は (1)(2) の両方に当たる)へ増えた。
//    ★挙動は変わっていない。変わったのは「どれだけ目に付くか」である。
//    ⇒ 裁定を維持するか見直すかは開発者の手番。製造は数だけを更新した。
//
//  ★★後任へ: これを「バグ」と読んで読み仮名のマップをフロントへ持たせないこと。
//    それは「データを画面側に持つ」形であり seed の責務との境界を越える。
//    読み仮名の列を足すのはスキーマ変更であり、その判断は設計卓の手番である。
//    本挙動は character-sort.test.ts が固定している。
// ────────────────────────────────────────────────────────────────

/** i18n の言語コード(`en` / `en-US` / `ja` 等)を照合ロケールへ畳む。 */
export function collationLocale(language: string | undefined): "ja" | "en" {
  return language?.toLowerCase().startsWith("en") ? "en" : "ja";
}

/**
 * 表示名でロケール依存の昇順に並べ替える(入力配列は破壊しない)。
 *
 * @param getJa 日本語ロケールで並べ替えに使う文字列を返す
 * @param getEn 英語ロケールで並べ替えに使う文字列を返す
 */
export function sortByLocale<T>(
  items: readonly T[],
  language: string | undefined,
  getJa: (item: T) => string,
  getEn: (item: T) => string,
): T[] {
  const locale = collationLocale(language);
  const key = locale === "en" ? getEn : getJa;
  const collator = new Intl.Collator(locale);
  return [...items].sort((a, b) => collator.compare(key(a), key(b)));
}

/** 並べ替えに使う最小限のキャラ形。`Character` から必要な 2 列だけを要求する。 */
export interface SortableCharacter {
  nameJa: string;
  nameEn: string;
}

/**
 * キャラ一覧を「画面に出している値」の昇順に並べ替える。
 *
 * ★★M24-07: ロケールを引数に取る形へ戻した。ただし規約は変わっていない ——
 *   **並べ替えのキーは常に「画面に出している値」である**。
 *   M24-02 の時点でラベルが `name_ja` 固定だったため引数を落としていたが、本サブで
 *   ラベルをロケールに従わせた(`characterDisplayName`)。⇒ 並びも同じ値で決める。
 *
 * ★★呼び手はラベルと同じロケールを渡すこと。片方だけ変えると
 *   「日本語名のリストが、見えない英語名の順に並ぶ」= 利用者の目には無順序に見える
 *   (M24-02 の初回実装で実際に起きた = レビュー 高-5 / followup の警告)。
 *   ⇒ その事故を防ぐため、ラベルと並びは下の 2 関数を**必ず対で**使う。
 */
export function sortCharactersByLocale<T extends SortableCharacter>(
  characters: readonly T[],
  locale?: string,
): T[] {
  const useEn = isEnglishLocale(locale);
  const collator = new Intl.Collator(useEn ? "en" : "ja");
  return [...characters].sort((a, b) =>
    collator.compare(characterDisplayName(a, locale), characterDisplayName(b, locale)),
  );
}

/** ロケールが英語系か。`en` / `en-US` 等を拾う。 */
function isEnglishLocale(locale?: string): boolean {
  return (locale ?? "").toLowerCase().startsWith("en");
}

/**
 * キャラの表示名。★`sortCharactersByLocale` と**必ず対で**使うこと。
 *
 * ★`name_en` は全 19 体に投入済みであり(NOT NULL・M24-02 が全数突合)、
 *   空になる経路は無い。それでも空文字を踏んだときは `name_ja` へ落とす
 *   —— ラベルが消えるより、言語が揃わないほうがましである。
 */
export function characterDisplayName(
  character: SortableCharacter,
  locale?: string,
): string {
  if (isEnglishLocale(locale)) {
    return character.nameEn.trim() || character.nameJa;
  }
  return character.nameJa;
}

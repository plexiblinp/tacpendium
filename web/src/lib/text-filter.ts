// 検索語による絞り込みの単一正典(M24-02 §4.1 / §4.3 / §4.4)。
//
// タグフィルタ(一覧)・キャラ選択・タグ管理画面の 3 か所が本関数を通る。
// ★同じ絞り込みを 3 か所へ書き写さない(教訓 E-76 = 同じ規則が 2 か所にあると
//   片方だけ追随して他方が古い規則で動き続け、エラーにならない)。
//
// 正規化の順序: NFKC → trim → toLowerCase。
// ★NFKC を入れる理由: 本アプリのタグ名・キャラ名には全角英数と半角が混在しうる
//   (M20-07 の実測で preset_aliases に全角/半角の混在が 36 件あった)。
//   正規化しないと「ＳＡ３」と入力した利用者が「SA3」を引けない。
// ★trim を入れる理由: TagSelector(付与側)の既存実装は検索語を trim しておらず、
//   "foo " が 0 件になるのに「foo を新規作成」だけが出る不整合があった。
//   本関数へ寄せる側ではこれを解消する(付与側の振る舞いは変えない = 指示書 §2.2)。

/** 検索語・被検索文字列に共通で掛ける正規化。 */
export function normalizeForSearch(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase();
}

/**
 * items を検索語で絞り込む。
 *
 * - 判定は部分一致(前方一致でも曖昧一致でもない)。
 * - 検索語が空(空白のみを含む)なら全件を返す。
 * - getSearchTexts は 1 要素につき複数の検索対象を返してよい
 *   (例: キャラは name_ja / name_en / code の 3 つを対象にする)。
 *   いずれか 1 つでも一致すればその要素は残る。
 */
export function filterByText<T>(
  items: readonly T[],
  query: string,
  getSearchTexts: (item: T) => readonly string[],
): T[] {
  const q = normalizeForSearch(query);
  if (q === "") return [...items];
  return items.filter((item) =>
    getSearchTexts(item).some((text) => normalizeForSearch(text).includes(q)),
  );
}

// メディア link のリンク化可否判定(M17-01/CHANGE-068 §2.3-h)。
//
// 保存値は任意文字列(緩検証)だが、表示層でリンク化(<a href>)してよいのは
// スキームが http/https の場合のみ。それ以外(javascript: / data: / file: /
// 相対パス等)は非リンクのテキスト表示に落とし、危険スキームを無害化する(XSS 面)。
// VAL-I08(URL 非リンク化)は「明示リンク用途ではない文字列」の規定であり、
// 本判定は明示リンク用途(combos.link)の別枠スキーム制限(DES-006 §6)。

/** value が http:// または https:// で始まる(大文字小文字不問)場合のみ true。 */
export function isSafeHttpUrl(value: string): boolean {
  const v = value.trim().toLowerCase();
  return v.startsWith("http://") || v.startsWith("https://");
}

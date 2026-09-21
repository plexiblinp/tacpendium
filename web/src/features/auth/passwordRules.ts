/**
 * パスワードの入力規則（DES-006 `VAL-N05` / `VAL-N06`。CHANGE-119）。
 *
 * ★サーバ側と同じ値を持つ（`internal/service/auth/validate.go` の
 * `PasswordMinLength` / `PasswordMaxLength` / `passwordRuneMin` / `passwordRuneMax`）。
 * 片方だけ変えると必ずドリフトする。変えるときは両方を直すこと。
 *
 * ★画面側の検査は「エラーを未然に減らす」ためのものであり、最終的な判定は
 * サーバが行う（DES-006 §10）。画面が守るからサーバは要らない、としないこと——
 * `curl` で直接叩ける（M22-08 §4.1-7）。
 *
 * ★★本規則は「決めるとき」だけに掛ける（同 §4.1-2）。ログイン欄と
 * 「いまのパスワード」欄へ掛けてはならない。掛けると、既に非 ASCII や短い
 * パスワードで決めた利用者が入れなくなり、しかも変更もできなくなる。
 */

/** 前後の空白を除去したあとの最小文字数（`VAL-N06`）。 */
export const PASSWORD_MIN_LENGTH = 4;

/** 前後の空白を除去したあとの最大文字数（`VAL-N06`）。 */
export const PASSWORD_MAX_LENGTH = 128;

/**
 * 受け付けない文字（`VAL-N05` の裏）。印字可能な ASCII（`U+0020`〜`U+007E`）以外。
 *
 * ★半角スペース（`U+0020`）は受け付ける——合い言葉の形を残すため。
 *
 * ★★文字の範囲を書くのはこの 1 か所だけである。判定（`validateNewPassword`）も
 * 除去（`stripNonPrintableASCII`）も本定数から導く。範囲を二度書くと必ずドリフトする。
 */
const NON_PRINTABLE_ASCII = /[^\x20-\x7E]/g;

/** 規則に反した理由。文言の出し分けに使う。 */
export type PasswordRuleViolation = "charset" | "tooShort" | "tooLong";

/**
 * stripNonPrintableASCII は印字可能な ASCII 以外を取り除く。
 *
 * ★★これは「入力段階の補助」であって「照合の検査」ではない。
 * `PasswordField` が入力欄の値へ掛けるため、IME・貼り付け・表示切替のいずれでも
 * 非 ASCII が値に入らなくなる（2026-08-16 開発者要望）。
 * **⇒ サーバ側の照合は従来どおり無検査のままである**——`Service.Login` と
 * `SetPassword` の `current` には何も掛かっていない（M22-08 §4.1-2＝最重要ゲート 1）。
 * `curl` からは引き続き非 ASCII のパスワードで入れるため、復旧経路は残っている。
 *
 * ★★落とすのは「印字可能な ASCII 以外」だけである。長さ（`VAL-N06`）その他の規則には
 * 絶対に連動させないこと。連動させると、将来その規則を変えたときに
 * 「既に決めてあるパスワードを打てない」締め出しが発生する
 * （`CHANGE-119` §2-b が挙げた理由②）。
 */
export function stripNonPrintableASCII(raw: string): string {
  return raw.replace(NON_PRINTABLE_ASCII, "");
}

/**
 * normalizePassword は前後の空白を除去する。
 *
 * ★「決めるとき」と「入れるとき」の両方に掛ける（M22-08 §4.1-5）。
 * IME の確定操作で末尾に空白が入っても、マスク表示では気づけないためである。
 *
 * ★Go の `strings.TrimSpace` と空白の集合が完全には一致しない。
 * `U+0085`（NEL）は Go だけが落とし、`U+FEFF`（ZWNBSP / BOM）は JS だけが落とす。
 * ⇒ 末尾に `U+FEFF` を含む入力は、画面側の検査を通ってサーバ側で
 * `password_charset_invalid` になる（画面には汎用の「保存できませんでした」が出る）。
 * 実害は極小だが、**両者が同じ規則である」とは書かないこと**——後任がこの注記を
 * そのまま写す。
 */
export function normalizePassword(password: string): string {
  return password.trim();
}

/**
 * validateNewPassword は「これから決めるパスワード」を検査する。
 * 問題が無ければ `null` を返す。
 *
 * ★文字種を長さより先に見る。順序を入れ替えると、日本語のパスワードに対して
 * 「4 文字以上で決めてください」と出てしまい、利用者は日本語が原因だと分からない。
 *
 * ★★`"charset"` は画面からは到達しない防御的な分岐である（2026-08-16 以降）。
 * `PasswordField` が入力段階で非 ASCII を落とすため、貼り付けを含めて欄の値には
 * 入らない。**それでも残してある**——入力段階の除去が将来壊れたときの後ろ盾であり、
 * サーバ側（`VAL-N05`）も同じ理由で弾くためである。**デッドコードとして消さないこと。**
 */
export function validateNewPassword(password: string): PasswordRuleViolation | null {
  const normalized = normalizePassword(password);
  // ★除去と同じ 1 つの規則から導く（別の正規表現を持たない）。
  if (stripNonPrintableASCII(normalized) !== normalized) return "charset";
  // ★ここまで来れば ASCII のみであり、String.length（UTF-16 コード単位）は
  //   文字数と一致する。
  if (normalized.length < PASSWORD_MIN_LENGTH) return "tooShort";
  if (normalized.length > PASSWORD_MAX_LENGTH) return "tooLong";
  return null;
}

/** 規則違反に対応する i18n キーを返す。 */
export function passwordRuleMessageKey(violation: PasswordRuleViolation): string {
  switch (violation) {
    case "charset":
      return "auth.setPassword.errorCharset";
    case "tooShort":
      return "auth.setPassword.errorTooShort";
    case "tooLong":
      return "auth.setPassword.errorTooLong";
  }
}

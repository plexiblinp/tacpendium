// 日本語ラベルの解決(M24-07)。
//
// ★★なぜ要るか —— 表示ラベル定数(constants/combo-list.ts・constants/oki.ts)は
//   i18n を通る画面と、通らない画面の両方から引かれている。
//   通らない画面〔コンボ登録・編集エディタ / 確定反撃マイリスト / PDF・画像出力〕は
//   全面が直書き日本語であり、そこだけラベルが英語になると
//   「1 画面で 2 系統が混ざる」形になる(指示書 M24-07 §2.3・チェックリスト §2-4)。
//
// ⇒ 語の源泉は locale(ja.json)の 1 つに保ったまま、i18n を通らない画面へは
//   ここから日本語を固定で配る。**同じ語を 2 か所に書かない**(E-76)。
//
// ★i18next を経由しないのは初期化の副作用を避けるためである。読むのは同じ ja.json。
import ja from "@/locales/ja.json";

/** 補間変数。i18next の `t` の第 2 引数と同じ形。 */
export type LabelVars = Record<string, string | number>;

/** 文言の解決関数。i18next の `t` と同じ形(呼び手を差し替えられるようにするため)。 */
export type Translate = (key: string, vars?: LabelVars) => string;

// ★★M24-07 レビュー(高-2)で足した型。i18n キーは必ずドットを含む
//   (`situation.position.mid_screen` 等)のに対し、日本語ラベルの写し(*_LABELS)は
//   「画面中央」のようにドットを持たない。⇒ テンプレートリテラル型で分けておくと、
//   「キー表を渡すべき所へラベル表を渡した」誤りがコンパイルで止まる。
//   ★これを型で分けていなかったため、labelFor の契約が変わったのに呼び出し側 5 か所が
//     旧のまま残り、jaLabel の「引けなければキーを返す」フォールバックに偶然救われて
//     テストが緑のままだった(M24-07 レビュー 高-2)。
export type LabelKeyMap = Readonly<Record<string, `${string}.${string}`>>;

/**
 * ja.json のドット区切りキーを引く。未定義ならキーをそのまま返す
 * (i18next の既定と同じ挙動。隠さない＝それ自体が手がかりになる)。
 */
export const jaLabel: Translate = (key, vars) => {
  let cur: unknown = ja;
  for (const part of key.split(".")) {
    if (typeof cur !== "object" || cur === null) return key;
    cur = (cur as Record<string, unknown>)[part];
  }
  if (typeof cur !== "string") return key;
  if (!vars) return cur;
  // i18next と同じ {{name}} 形式の補間。未指定の変数はそのまま残す(欠落を隠さない)。
  return cur.replace(/\{\{(\w+)\}\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole,
  );
};

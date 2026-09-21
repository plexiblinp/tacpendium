// 入力欄の 3 状態(必須 / 任意 / 未検証)の列挙定数(M27-02b)。
//
// ★★本ファイルが「1 つの規則を 3 か所へ通す」の実体である(M27-overview §3 M27-02)。
//   `P4M-009`(必須化)・`P4M-010`(必須・任意ラベル)・`P4M-011`(起き攻めの未検証)は
//   同じ族であり、欄ごとに違う見せ方をしないために語彙を 1 か所へ置く。
//
// 2 状態の意味:
//   - required = 本登録に必須。空だと保存できない
//   - optional = 任意。空のまま保存できる
//
// ★★「未検証」はここに置かない。**欄の必須度とは別の概念だからである**——
//   「まだ確かめていない」は起き攻め 1 セルの状態であり、欄が必須かどうかとは軸が違う。
//   ⇒ 起き攻めの 3 状態は constants/oki.ts の `OkiState` が持つ。
//   ★★当初は本 enum に "unverified" を同居させたが、`setOkiState` が
//     `FieldRequirement | "on" | "off"` を受ける形になり、**`"required"` を渡しても
//     コンパイルが通って「検証済み・不成立」として保存される**穴ができた
//     (M27-02b レビュー 中-4 / E-2)。⇒ 軸ごとに型を分ける。
// ★語そのもの("未検証")は constants/setup-result.ts / constants/oki.ts と揃えてある。

import { jaLabel } from "@/lib/ja-label";

export const FIELD_REQUIREMENTS = ["required", "optional"] as const;
export type FieldRequirement = (typeof FIELD_REQUIREMENTS)[number];

export const FIELD_REQUIRED = "required" satisfies FieldRequirement;
export const FIELD_OPTIONAL = "optional" satisfies FieldRequirement;

// ★★文言は locale が正典。ここは「値 → i18n キー」の対応表だけを持つ
//   (constants/oki.ts と同じ形。語を 2 か所に書かない)。
export const FIELD_REQUIREMENT_LABEL_KEYS: Record<FieldRequirement, string> = {
  required: "fieldRequirement.required",
  optional: "fieldRequirement.optional",
};

// 節の先頭に 1 回だけ出す凡例。
//
// ★★文言は「**この節では**、印の無い欄は任意です。」である——**節に限定してある**。
//   ★理由＝印を出す経路は `Field` 部品 1 本だけであり、`Field` の外に在る欄
//     (キャラ＝節の外・画面上部 ／ レシピ＝別タブ)には印が出ない。
//     ⇒ 「印の無い欄は任意」と言い切ると、その 2 つについて嘘になる
//     (どちらも必須である)。M27-02b レビュー 中-1。
//   ★★印を `Field` の外へも配ることは採らなかった。配ると「印を出す経路は 1 本」
//     という規則そのものが崩れ、欄ごとに見せ方が割れる元になる。
//
// ★★「必須の欄にだけ印を付け、印の無い欄は任意」という規則を明示するためにある。
//   ⇒ 任意 15 欄すべてにバッジを付けると、任意バッジが並んで読めなくなる。
//   ★規則は 1 つ(FieldRequirement を単一部品で描く)のままであり、
//     `optional` の描画が「凡例に委ねる」なのである。
export const FIELD_REQUIREMENT_LEGEND_KEY = "fieldRequirement.legend";

// ★i18n を通らない画面(エディタ)向けの日本語の写し。源泉は同じ ja.json である
//   (constants/oki.ts の OKI_ATTACK_TYPE_LABELS と同じ考え方)。
export const FIELD_REQUIREMENT_LABELS: Record<FieldRequirement, string> = {
  required: jaLabel(FIELD_REQUIREMENT_LABEL_KEYS.required),
  optional: jaLabel(FIELD_REQUIREMENT_LABEL_KEYS.optional),
};

export const FIELD_REQUIREMENT_LEGEND = jaLabel(FIELD_REQUIREMENT_LEGEND_KEY);

/**
 * 本登録(is_draft=false)で必須になるコンボの欄(M27-02b・開発者確定 2026-09-03)。
 *
 * ★★仮登録(is_draft=true)には掛からない。仮登録は「未確定でも保存できる」入口として
 *   設計されている(SUPP-001 §2.1)。
 * ★★本配列がフロント側の正典である。サーバ側の対応は
 *   internal/service/validation/combo.go の requiredPublishedFields。
 *   **片側だけ足すと、画面は通るのに保存で落ちる(またはその逆)になる。**
 *
 * ★★★【M38-01・射程 3・2026-09-17 → **2026-09-18 追補2 で 2 欄へ**】
 *
 *   着手前:     damage / knockdownAdvantage / driveGaugeConsumed / saGaugeConsumed
 *   追補1 まで: damage / knockdownAdvantage / driveAvailableAtStart / saAvailableAtStart
 *   **現在:     damage / knockdownAdvantage の 2 欄だけ**
 *
 * ★★★開始残量 2 欄を必須から外した理由(2026-09-18 開発者裁定)。
 *   必須化の狙いは値そのものではなく「**意識的に不問にしたのか、面倒で入れなかったのか**」
 *   を区別することだった。⇒ そのために UI が 3 状態(数値 / 不問トグル ON / 空のまま)を
 *   持ったが、**DB は 2 状態(値 / NULL)しか持てない**。余った 1 状態が「不問」と
 *   見た目でほぼ区別できず、**開発者が実機で「空欄と NULL の状態がわかりにくい」と判断した**。
 *   ⇒ **区別することを諦め、UI の状態数を DB に揃えた**。空欄＝NULL＝「不問」の 1 状態である。
 *   ★区別を残すには列が要る(oki_verified / 旧マイグレ 000096 と同じ形)。M38-01 の射程外。
 *
 * ★★★指示書 M38-01 §2.4.1 は「★「4 欄」という数を動かさない」と明示的に禁じているが、
 *   **開発者裁定がこれを上書きした**(CLAUDE.md §9 ハード列＝ユーザー体験に影響する判断)。
 *   ⇒ DES-006 §2.1 の VAL-C15 を 2 欄へ改める CHANGE が要る(設計伝達レポート §2)。
 *
 * ★開始残量 2 欄は**任意**になったが、**値域の検査は生きている**
 *   (zod の optFloat(0,6) / optInt(0,3) ＋ BE の VAL-C04 / VAL-C05)。
 *   ⇒ 必須を外すことと値域を外すことは別である。
 */
export const REQUIRED_PUBLISHED_COMBO_FIELDS = [
  "damage",
  "knockdownAdvantage",
] as const;

export type RequiredPublishedComboField =
  (typeof REQUIRED_PUBLISHED_COMBO_FIELDS)[number];

/** その欄が本登録で必須かを返す。エディタのラベル描画が使う。 */
export function requirementOf(field: string): FieldRequirement {
  return (REQUIRED_PUBLISHED_COMBO_FIELDS as readonly string[]).includes(field)
    ? FIELD_REQUIRED
    : FIELD_OPTIONAL;
}

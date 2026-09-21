import { jaLabel, type Translate } from "@/lib/ja-label";

// 起き攻めオプションの列挙定数・ラベル(M16-03 正規化)。
// バックエンド internal/model/combo.go の OkiAttackType* / OkiTechType* 定数と同期する
// (CLAUDE.md §4 の列挙同期)。DB では combo_oki_options(attack_type, tech_type, uses_dr) 行。
// sparse: 行の存在＝そのオプションが成立する。
// ★M27-02b: 「調べたか」はコンボ単位の okiVerified が持つ(セル単位ではない)。
//
// 本ファイルが起き攻めラベルの単一の正典。従来 editor(labels.ts)・出力(export-model.ts)・
// 詳細/比較(i18n)に散在していたラベルを集約し、表記揺れ(「DR」略記等)を防ぐ。

export const OKI_ATTACK_TYPES = ["throw_meaty", "shimmy", "strike_meaty"] as const;
export type OkiAttackType = (typeof OKI_ATTACK_TYPES)[number];
export const OKI_ATTACK_THROW_MEATY = "throw_meaty" satisfies OkiAttackType;
export const OKI_ATTACK_SHIMMY = "shimmy" satisfies OkiAttackType;
export const OKI_ATTACK_STRIKE_MEATY = "strike_meaty" satisfies OkiAttackType;

export const OKI_TECH_TYPES = ["neutral_tech", "back_tech"] as const;
export type OkiTechType = (typeof OKI_TECH_TYPES)[number];
export const OKI_TECH_NEUTRAL = "neutral_tech" satisfies OkiTechType;
export const OKI_TECH_BACK = "back_tech" satisfies OkiTechType;

// ★★M24-07: 文言は locale が正典。ここは「値 → i18n キー」の対応表を持つ。
//   本ファイルが起き攻めラベルの単一の正典である役割は変わっていない。
export const OKI_ATTACK_TYPE_LABEL_KEYS: Record<OkiAttackType, string> = {
  throw_meaty: "oki.attackType.throw_meaty",
  shimmy: "oki.attackType.shimmy",
  strike_meaty: "oki.attackType.strike_meaty",
};

export const OKI_TECH_TYPE_LABEL_KEYS: Record<OkiTechType, string> = {
  neutral_tech: "oki.techType.neutral_tech",
  back_tech: "oki.techType.back_tech",
};

// uses_dr のラベル。「ドライブラッシュ」正式名称(DES-005 §5.6 正典・「DR」略記不可)。
export const OKI_USES_DR_LABEL_KEY = "oki.usesDr";
export const OKI_NO_GAUGE_LABEL_KEY = "oki.noGauge";

// ★i18n を通らない画面(エディタ / PDF・画像出力)向けの日本語の写し。
//   源泉は同じ ja.json であり、語を 2 か所に書いてはいない。
export const OKI_ATTACK_TYPE_LABELS: Record<OkiAttackType, string> = {
  throw_meaty: jaLabel(OKI_ATTACK_TYPE_LABEL_KEYS.throw_meaty),
  shimmy: jaLabel(OKI_ATTACK_TYPE_LABEL_KEYS.shimmy),
  strike_meaty: jaLabel(OKI_ATTACK_TYPE_LABEL_KEYS.strike_meaty),
};

export const OKI_TECH_TYPE_LABELS: Record<OkiTechType, string> = {
  neutral_tech: jaLabel(OKI_TECH_TYPE_LABEL_KEYS.neutral_tech),
  back_tech: jaLabel(OKI_TECH_TYPE_LABEL_KEYS.back_tech),
};

export const OKI_USES_DR_LABEL = jaLabel(OKI_USES_DR_LABEL_KEY);
export const OKI_NO_GAUGE_LABEL = jaLabel(OKI_NO_GAUGE_LABEL_KEY);

// ★★M27-02b(P4M-011): 「起き攻めを一度でも調べたか」の表示語。
//   ★源泉は ja.json。語を 2 か所に書かない(OKI_ATTACK_TYPE_LABELS と同じ考え方)。
export const OKI_VERIFIED_LABEL_KEY = "oki.verified.label";
export const OKI_VERIFIED_LABEL = jaLabel(OKI_VERIFIED_LABEL_KEY);

// ★★M27-02b 追補: 詳細画面に出す**状態名**(「検証済み」/「未検証」)。
//
// ★★上の OKI_VERIFIED_LABEL とは別キーである。あちらはエディタの**トグルの操作名**
//   (「起き攻めを調べた」)であり、こちらは詳細で読む**状態名**である。
//   ⇒ 同じ語を 2 用途へ兼ねると、片方の文言を直したとき他方が黙って変わる。
// ★語は constants/setup-result.ts の既存語(「未検証」)に揃えてある——新語を作らない
//   (用語統一は M29 の持ち物であり、ここで先取りしない)。
export const OKI_VERIFIED_STATE_LABEL_KEYS = {
  verified: "oki.verified.stateVerified",
  unverified: "oki.verified.stateUnverified",
} as const;

export const OKI_VERIFIED_STATE_LABELS = {
  verified: jaLabel(OKI_VERIFIED_STATE_LABEL_KEYS.verified),
  unverified: jaLabel(OKI_VERIFIED_STATE_LABEL_KEYS.unverified),
} as const;

// 起き攻めオプション 1 件の最小形(API 型 OkiOption と構造互換・key/label ヘルパの引数)。
export interface OkiOptionLike {
  attackType: string;
  techType: string;
  usesDr: boolean;
}

// 正準の 12 通り(attack_type × tech_type × uses_dr)。列挙値は狭い型で持つ。
export interface OkiOptionSpec {
  attackType: OkiAttackType;
  techType: OkiTechType;
  usesDr: boolean;
}

// editor のグリッド・表示の反復に使う正準の 12 通り。
export const OKI_OPTION_SPECS: readonly OkiOptionSpec[] = OKI_ATTACK_TYPES.flatMap(
  (attackType) =>
    OKI_TECH_TYPES.flatMap((techType) =>
      [false, true].map((usesDr): OkiOptionSpec => ({ attackType, techType, usesDr })),
    ),
);

/**
 * 起き攻めオプションの画面上の識別子(data-testid の末尾に使う)。
 *
 * ★★書式は `DES-005` §5.7 が定めている＝`combo-editor-oki-<attackType>-<techType>-<dr|nogauge>`。
 *   ⇒ 変えると既存の E2E / ユニットテストが空振りする。
 * ★`okiOptionKey`(`a:b:true`)とは別物である。あちらは set の一意キーで、
 *   こちらは画面の識別子である。**混ぜないこと**——区切り文字も真偽値の綴りも違う。
 */
export function okiOptionTestValue(o: OkiOptionLike): string {
  return `${o.attackType}-${o.techType}-${o.usesDr ? "dr" : "nogauge"}`;
}

// オプションの一意キー(重複判定・set 用)。
export function okiOptionKey(o: OkiOptionLike): string {
  return `${o.attackType}:${o.techType}:${o.usesDr}`;
}

// 受け身種別 ＋ ゲージ区分。例: "その場受け身・ノーゲージ" / "後ろ受け身・ドライブラッシュ"。
//
// ★★これを切り出してあるのは「攻撃種別を前置きしない面があるから」である——
//   エディタ(ComboEditorBasicFields)は攻撃種別ごとにグルーピングして見出しへ出すため、
//   チェックボックス行には受け身種別とゲージ区分しか出さない。
//   ⇒ okiOptionLabel をそのまま呼べない。だからといってインラインで組み立てると、
//     入力面と読む面で表記が割れる(M24-03 のレビュー 高-2 で実際に起きた)。
//   ★★ゲージ区分を足す・変えるときは本関数だけを直せば全面に効く。
//   ★★M24-07: 第 2 引数に文言の解決関数を取る。既定は日本語固定であり、
//     i18n を通らない画面(エディタ / PDF・画像出力)は呼び出しを変えなくてよい。
//     i18n を通る画面(詳細 / 比較)は react-i18next の `t` を渡す。
// 区切り記号。★locale が正典(ja = 和文中黒 / en = スラッシュ)。
export const OKI_SEPARATOR_KEY = "oki.separator";

export function okiTechAndGaugeLabel(o: OkiOptionLike, translate: Translate = jaLabel): string {
  const techKey = OKI_TECH_TYPE_LABEL_KEYS[o.techType as OkiTechType];
  const tech = techKey ? translate(techKey) : o.techType;
  const gauge = translate(o.usesDr ? OKI_USES_DR_LABEL_KEY : OKI_NO_GAUGE_LABEL_KEY);
  // ★★M24-07 レビュー(中-1): 区切りを直書きしていたため、解決関数に t を渡す
  //   i18n 経由の呼び出し(詳細 / 比較)でも和文の中黒「・」(U+30FB)だけが
  //   英語 UI に残っていた。本サブ自身が en.json 側の中黒をスラッシュへ直しており、
  //   「辞書に入っていれば直す / コードで合成すれば見逃す」という非対称だった。
  //   ⇒ 区切りも locale から引く(ja = 「・」/ en = " / ")。
  return `${tech}${translate(OKI_SEPARATOR_KEY)}${gauge}`;
}

// 表示ラベル。例: "投げ重ね(その場受け身・ノーゲージ)" / "シミー(後ろ受け身・ドライブラッシュ)"。
//
// ★★M24-03 §4.5(SM-097): ノーゲージ版にも「ノーゲージ」を付ける。
//   OKI_NO_GAUGE_LABEL は定義だけあって参照 0 件だった(実査で裏取り済み)。
//   ★付与は okiTechAndGaugeLabel の中で 1 回だけ行う。呼び元ごとに足さない(指示書 §4.5)。
//   ★★ラベルを組み立てている箇所は 4 件である(M24-03 レビュー 高-2 で 3 → 4 へ是正)——
//     詳細 ComboDetailMetadata / 比較 CompareTable / 出力 export-model が okiOptionLabel を、
//     エディタ ComboEditorBasicFields が okiTechAndGaugeLabel を通る。
//     ★「okiOptionLabel の呼び元」だけを数えるとエディタを取りこぼす。
//   ★★出力(エクスポート)にも効く。ラベルの生成規則は DES-005 §5.6 項目6 に逐語で
//     書かれているため、CHANGE-134 の射程が §5.6 へ及ぶものとして設計卓へ報告する。
//   ★日本語のまま足す。constants/oki.ts の i18n 化は M24-07 の手番である。
export function okiOptionLabel(o: OkiOptionLike, translate: Translate = jaLabel): string {
  const attackKey = OKI_ATTACK_TYPE_LABEL_KEYS[o.attackType as OkiAttackType];
  const attack = attackKey ? translate(attackKey) : o.attackType;
  return `${attack}(${okiTechAndGaugeLabel(o, translate)})`;
}

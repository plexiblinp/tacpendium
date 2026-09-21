import { jaLabel, type LabelKeyMap } from "@/lib/ja-label";

export const SORT_FIELD_VALUES = [
  "default",
  "updated_at",
  "damage",
  "starter_move_id",
] as const;
export type SortField = (typeof SORT_FIELD_VALUES)[number];

export type SortOrder = "asc" | "desc";

// C-02: 一覧・マイコンボの既定ソート。始動状況順(default)ではなく更新日時(降順=最近)を既定とする。
// "default"(始動状況順)は引き続き選択可能なソート項目として残す。
export const DEFAULT_SORT_FIELD: SortField = "updated_at";
export const DEFAULT_SORT_ORDER: SortOrder = "desc";

// ★M24-07: 文言は locale が正典。ここは「値 → i18n キー」の対応表だけを持つ。
//   本ファイルがラベルの単一の正典である、という従来の役割は変わっていない
//   —— 変わったのは「文字列そのもの」から「どのキーを引くか」へ、である。
export const SORT_FIELD_LABEL_KEYS: Record<
  SortField,
  { asc?: string; desc?: string; default?: string }
> = {
  // ★昇降を持たない項目。既存の選択肢キー(comboList.sort.default)を再利用し、
  //   同じ文言を 2 つのキーに持たせない。
  //   ★★M24-07 レビュー(低-4): 以前は asc/desc に空文字を番兵として置いていたが、
  //     「昇降を持たない」と「キーの付け忘れ」が区別できなかった。⇒ optional にして
  //     undefined を使う。消費側の `asc ? t(asc) : 既定` の分岐はそのまま働く。
  default: { default: "comboList.sort.default" },
  updated_at: {
    asc: "comboList.sortLabel.updated_at.asc",
    desc: "comboList.sortLabel.updated_at.desc",
  },
  damage: {
    asc: "comboList.sortLabel.damage.asc",
    desc: "comboList.sortLabel.damage.desc",
  },
  starter_move_id: {
    asc: "comboList.sortLabel.starter_move_id.asc",
    desc: "comboList.sortLabel.starter_move_id.desc",
  },
};

// ★★本配列の順序が「始動位置」の表示順の正本である(M28-02a・D-731 / D-733)。
//   並びは「不問」を先頭に置いた 8 値である。不問は値を持たない(空文字/NULL)ため
//   本配列には含まれない ——
//   不問 / 自分画面端 / 自分画面端寄り / 自分中央寄り / 画面中央 / 相手中央寄り /
//   相手画面端寄り / 相手画面端
//
// ★★M28-02a で 5 → 7 になった。★これは「間に 2 つ挿入するだけ」ではない ——
//   末尾 2 値の順序も入れ替わっている
//   (旧: corner_opponent, corner_opponent_near → 新: corner_opponent_near, corner_opponent)。
//
// ★バックエンド側の正典は internal/model/position.go の PositionBands(境界・代表値・表示順)。
//   区分の境界と代表値はフロントでは web/src/constants/position.ts が持つ。
export const POSITION_VALUES = [
  "corner_self",
  "corner_self_near",
  "mid_self",
  "mid_screen",
  "mid_opponent",
  "corner_opponent_near",
  "corner_opponent",
] as const;
export type Position = (typeof POSITION_VALUES)[number];

// ★★新しい値は必ず末尾へ足すこと。
//   本配列は punish.ts が **位置インデックス**で引いていた(M27-01 で名前参照へ是正済み)。
//   途中へ挿入すると確定反撃の写像が型検査もテストも通ったまま静かにずれる。
// バックエンド側の正典は internal/model/combo.go の HitType* 定数(8 値)。
export const HIT_TYPE_VALUES = [
  "normal",
  "counter",
  "punish_counter",
  "just_parry_punish_counter",
  // 以下 M27-01 追加(開発者確定 2026-09-02)。
  "drive_impact_wall_splat_hit",
  "drive_impact_wall_splat_block",
  // ★「名前だけパニッシュカウンター」である(開発者確定 2026-09-02)。
  //   生成の対象外にはした(PUNISH_COUNTER_HIT_TYPES に在る)が、タブ分けには
  //   入れていない。始動技がインパクトのときだけ使う制約と確定反撃ロジック本体は別サブ。
  "drive_impact_punish_counter",
  // ★DI に限らない一般の区分である(開発者確定 2026-09-02)。識別子に drive_impact を付けない。
  "stun",
] as const;
export type HitType = (typeof HIT_TYPE_VALUES)[number];

export const OPPONENT_STANCE_VALUES = [
  "standing",
  "crouching",
  "airborne",
  "any",
] as const;
export type OpponentStance = (typeof OPPONENT_STANCE_VALUES)[number];

// M27-01 で新設。それまで状況 4 軸のうち相手サイズだけ *_VALUES を持たず、
// label-keys.test.ts の「値域 ↔ キーの 1 対 1」検査から外れていた
// (ja / en で引けるかの検査にだけ手足しで入っていた)。
// バックエンド側の正典は internal/model/combo.go の OpponentSize* 定数(4 値)。
export const OPPONENT_SIZE_VALUES = [
  // M27-01: medium から改名(旧マイグレ 000081 で既存データを移行)。表示は「標準」。
  "standard",
  // M27-01 新設。既存行なし。
  "large",
  "large1",
  "large2",
] as const;
export type OpponentSize = (typeof OPPONENT_SIZE_VALUES)[number];

// M24-04(SM-093): 「不問」を表す値。新規登録の「相手の状態」の既定値でもある。
// ★空文字(未指定)とは別物である——保存時に空文字は NULL、"any" は文字列 "any" として入り、
//   重複判定キー(internal/service/combo/duplicate_keys.go)と一覧フィルタの等値比較で
//   別の値として扱われる。同一視しないこと。
// バックエンド側の正典は internal/model/combo.go の OpponentStanceAny。
export const OPPONENT_STANCE_ANY: OpponentStance = "any";

// ★★M38-01(射程 5): 新規登録の「ヒット種別」の既定値。
// ★着手前の既定は空文字(= 保存時 NULL)であり、`withUnspecifiedFirst` が足した
//   値域外の「不問」が選ばれた状態で開いていた。⇒ 値域(8 値)の先頭へ寄せた。
// ★★既定を変えると、以後の新規登録の**保存値が変わる**(NULL → "normal")。
//   これは表示だけの変更ではない —— `hit_type` は重複判定キーの 1 つであり
//   (SUPP-001 §2.2)、一覧フィルタの等値比較でも別の値になる。
// ★★★既存行は書き換えない(2026-09-17 開発者裁定)。⇒ 編集で読み込んだ NULL は
//   NULL のまま見せる(features/combo/labels.ts の hitTypeOptionsFor)。
// バックエンド側の正典は internal/model/combo.go の HitTypeNormal。
export const HIT_TYPE_NORMAL: HitType = "normal";

export interface ColumnVisibility {
  // ★★M27-03 追補(2026-09-05 開発者指示): 1 列だった「始動状況」を 3 列へ割った。
  //   ★語は「ポジション」ではなく **「始動位置」**(開発者指定)。
  //   ★★M28-02a(2026-09-06)で詳細・エディタ・一覧フィルタの語も「始動位置」へ揃えた。
  //     ⇒ M27-03 当時の「本サブでは一覧の列見出しだけを変えている」という限定は解消済み。
  hitType: boolean;
  position: boolean;
  opponentStance: boolean;
  damage: boolean;
  recipe: boolean;
  tags: boolean;
  draftStatus: boolean;
  memo: boolean;
  // 紐づくセットプレイの件数(M24-01 §4.5 / SM-012)。一覧応答の setups をそのまま数える。
  setupCount: boolean;
}

// ★既定で出す列(M24-03 §手動確認・開発者判断 2026-08-26)。
//
// ★★memo / setupCount を既定 OFF にしたのは「列を消した」のではない。
//   ColumnVisibility の型・COLUMN_DEFINITIONS・保存キー combo-list-columns-v1 は
//   一切変えていないため、利用者は「表示列」から従来どおり戻せる。
//   ⇒ 保存済みの設定を持つ環境では、その保存値が優先される(既定は初回のみ効く)。
export const DEFAULT_COLUMN_VISIBILITY: ColumnVisibility = {
  // ★3 列とも既定 ON。着手前の「始動状況」1 列が ON だったので情報量を保つ。
  hitType: true,
  position: true,
  opponentStance: true,
  damage: true,
  recipe: true,
  tags: true,
  draftStatus: true,
  // ★M24-03: SM-089 でメモの 1 行目がレシピ列の直上へ出るようになり、備考列と
  //   同じ文字列が 1 画面に 2 か所並ぶ状態になった。⇒ 既定は OFF(開発者判断)。
  memo: false,
  // ★M24-03: M24-01 が SM-012 に応えて追加した列(機能はそのまま)。
  //   一覧の情報量を絞るため既定だけ OFF にした(開発者判断)。
  //   ★列そのものを撤去したわけではない。M24-01 の成果物は生きている。
  setupCount: false,
};

export const COLUMN_DEFINITIONS: {
  key: keyof ColumnVisibility;
  labelKey: string;
}[] = [
  { key: "recipe", labelKey: "comboList.column.recipe" },
  { key: "damage", labelKey: "comboList.column.damage" },
  { key: "hitType", labelKey: "comboList.column.hitType" },
  { key: "position", labelKey: "comboList.column.position" },
  { key: "opponentStance", labelKey: "comboList.column.opponentStance" },
  { key: "tags", labelKey: "comboList.column.tags" },
  { key: "draftStatus", labelKey: "comboList.column.draftState" },
  { key: "memo", labelKey: "comboList.column.memo" },
  { key: "setupCount", labelKey: "comboList.column.setupCount" },
];

// ★★M31-03(開発者確定 2026-09-09): 一覧の行から詳細へ飛ぶ **行内リンクを持つ列**。
//
// ★★本定数が置き場の正本である。⇒ 列を並べ替えてもリンクは動かない。
//   これは M27-03 で実際に起きた事故を塞ぐためにある —— 当時の規則は
//   「詳細への導線は**先頭の 1 セル**だけに置く」であり、置き場が並び順に
//   従属していた。「始動状況」1 列を 3 列(ヒット種別 / 始動位置 / 相手の状態)へ
//   割った結果、リンクは誰も選んでいないヒット種別へ移り、
//   **テストも型検査も緑のまま**開発者が画面で気づくまで残った。
//
// ★リンクは 1 列だけである。2 列から張らないこと(同じ行き先が 2 本並ぶ)。
//   ★操作列の「詳細」は本定数の対象外であり、従来どおり常に在る。
// ★検査: ComboTableRow.test.tsx が「行内リンクが本定数の列にだけ在る」を固定する。
export const DETAIL_LINK_COLUMN: TestIdColumn = "recipe";

// ★testid を持たせている列。★型を union で固定してあるのは、下の表から
//   エントリが消えたときに**型検査で落とす**ためである(M31-03 レビュー 低-2)。
//   ⇒ Partial にすると `COLUMN_TEST_IDS.hitType` が undefined になり、
//     data-testid 属性ごと静かに消えて **E2E だけが落ちる**。
// ★★DETAIL_LINK_COLUMN の型をこれにしてあるのも同じ理由である ——
//   行内リンクを持つ列は、必ず掴める目印を持っていなければならない。
export type TestIdColumn = Extract<
  keyof ColumnVisibility,
  "hitType" | "position" | "opponentStance" | "recipe" | "setupCount"
>;

// ★★上記の列に対応する data-testid。テストと E2E が掴む目印である。
//   ★COLUMN_DEFINITIONS の key とは綴りが違う列が在る(opponentStance →
//     combo-opponent-stance)ため、機械的に導出せず表で持つ。
export const COLUMN_TEST_IDS: Record<TestIdColumn, string> = {
  hitType: "combo-hit-type",
  position: "combo-position",
  opponentStance: "combo-opponent-stance",
  recipe: "combo-recipe",
  setupCount: "combo-setup-count",
};

// ★★M24-07: 状況コードの表示ラベルも locale が正典になった。
//   *_LABEL_KEYS が「値 → i18n キー」の対応表(本ファイルが引き続き単一の正典)。
//   *_LABELS は同じ locale(ja)から導出した日本語の写しであり、
//   **i18n を通らない画面**〔エディタ / 確定反撃マイリスト / PDF・画像出力〕専用である。
//   ⇒ 語を 2 か所に書いていない。源泉は ja.json の 1 つだけ。
export const POSITION_LABEL_KEYS: LabelKeyMap = {
  corner_self: "situation.position.corner_self",
  corner_self_near: "situation.position.corner_self_near",
  mid_self: "situation.position.mid_self",
  mid_screen: "situation.position.mid_screen",
  mid_opponent: "situation.position.mid_opponent",
  corner_opponent_near: "situation.position.corner_opponent_near",
  corner_opponent: "situation.position.corner_opponent",
};

export const OPPONENT_STANCE_LABEL_KEYS: LabelKeyMap = {
  standing: "situation.opponentStance.standing",
  crouching: "situation.opponentStance.crouching",
  airborne: "situation.opponentStance.airborne",
  any: "situation.opponentStance.any",
};

export const HIT_TYPE_LABEL_KEYS: LabelKeyMap = {
  normal: "situation.hitType.normal",
  counter: "situation.hitType.counter",
  punish_counter: "situation.hitType.punish_counter",
  just_parry_punish_counter: "situation.hitType.just_parry_punish_counter",
  drive_impact_wall_splat_hit: "situation.hitType.drive_impact_wall_splat_hit",
  drive_impact_wall_splat_block: "situation.hitType.drive_impact_wall_splat_block",
  drive_impact_punish_counter: "situation.hitType.drive_impact_punish_counter",
  stun: "situation.hitType.stun",
};

// ★★M27-03(P4M-021): ヒット種別フィルタの短縮表記。
//
// 開発者の逐語＝「コンボ一覧のフィルターで、ヒット種別が非常に横長。
// 中身を変えずに短くできないか？」／「イメージとしては固定のサイズ＋短縮表記を表示。
// プルダウンメニュー内ではフルの長さを表示。」
//
// ★★値の集合は変えていない。変えたのは見せ方だけである(M27-01 が定めた 8 値)。
// ★8 値すべてに 1 対 1 で当てる。HIT_TYPE_VALUES へ値を足したら本表にも足すこと
//   (label-keys.test.ts の値域↔キー 1 対 1 検査が落とす)。
// ★語は案A(英略記中心・2026-09-05 開発者確定)。
export const HIT_TYPE_SHORT_LABEL_KEYS: LabelKeyMap = {
  normal: "situation.hitTypeShort.normal",
  counter: "situation.hitTypeShort.counter",
  punish_counter: "situation.hitTypeShort.punish_counter",
  just_parry_punish_counter: "situation.hitTypeShort.just_parry_punish_counter",
  drive_impact_wall_splat_hit:
    "situation.hitTypeShort.drive_impact_wall_splat_hit",
  drive_impact_wall_splat_block:
    "situation.hitTypeShort.drive_impact_wall_splat_block",
  drive_impact_punish_counter:
    "situation.hitTypeShort.drive_impact_punish_counter",
  stun: "situation.hitTypeShort.stun",
};

export const OPPONENT_SIZE_LABEL_KEYS: LabelKeyMap = {
  standard: "situation.opponentSize.standard",
  large: "situation.opponentSize.large",
  large1: "situation.opponentSize.large1",
  large2: "situation.opponentSize.large2",
};

// ★★M37-07: 始動技の持続当て(重複判定キーの 8 つ目・開発者裁定 D-874)。
//
// ★★2 値しか無い。「不問」を作らないこと —— DB 列が NOT NULL DEFAULT 0 であり、
//   3 値にすると「不明どうし」が別コンボへ分かれる意味の無い分岐が生まれる
//   (指示書 §0.5)。
// ★値の語は「はい / いいえ」である(開発者確定 2026-09-14)。
//   欄そのものの語は STARTER_MEATY_LABEL(「持続当て（始動技）」)が持つ。
// ★step の modifier `meaty`(中途の技の持続当て)とは別物であり、画面上で紛れるため
//   欄の語に「（始動技）」を付けている。⇒ modifier 側は 1 文字も変えていない。
export const STARTER_MEATY_VALUES = ["yes", "no"] as const;
export type StarterMeatyValue = (typeof STARTER_MEATY_VALUES)[number];

export const STARTER_MEATY_LABEL_KEYS: LabelKeyMap = {
  yes: "situation.starterMeaty.yes",
  no: "situation.starterMeaty.no",
};

// STARTER_MEATY_LABEL は欄そのものの表示語(「持続当て（始動技）」)。
// ★i18n を通らないエディタ側へ配るため ja.json から導出する(語を 2 か所に書かない)。
export const STARTER_MEATY_LABEL_KEY = "comboDetail.situation.starterMeaty";
export const STARTER_MEATY_LABEL = jaLabel(STARTER_MEATY_LABEL_KEY);

// ★★M27-03(SD-009): ドライブダメージの符号がどちらを表すかの語。
//
// ★`constants/` に置く理由＝`label-keys.test.ts` の「すべてのキーが ja / en の両方で
//   引ける」検査の網へ入れるためである。**キー名を間違えると `jaLabel` の
//   フォールバックでキー文字列がそのまま画面へ出る**（`M24-07` レビュー 高-2 で
//   一度踏んだ型）。★動作は「正しい」ままなので、テストも lint も型検査も緑になる。
export const DRIVE_DAMAGE_DIRECTION_VALUES = ["cut", "recover"] as const;
export type DriveDamageDirection = (typeof DRIVE_DAMAGE_DIRECTION_VALUES)[number];

export const DRIVE_DAMAGE_DIRECTION_LABEL_KEYS: LabelKeyMap = {
  cut: "comboDetail.driveDamageDirection.cut",
  recover: "comboDetail.driveDamageDirection.recover",
};

function jaMap(keys: LabelKeyMap): Readonly<Record<string, string>> {
  return Object.fromEntries(Object.entries(keys).map(([k, key]) => [k, jaLabel(key)]));
}

export const POSITION_LABELS = jaMap(POSITION_LABEL_KEYS);
export const OPPONENT_STANCE_LABELS = jaMap(OPPONENT_STANCE_LABEL_KEYS);
export const HIT_TYPE_LABELS = jaMap(HIT_TYPE_LABEL_KEYS);
export const OPPONENT_SIZE_LABELS = jaMap(OPPONENT_SIZE_LABEL_KEYS);
export const STARTER_MEATY_LABELS = jaMap(STARTER_MEATY_LABEL_KEYS);

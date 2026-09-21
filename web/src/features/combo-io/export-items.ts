// 表示項目選択(DES-005 §5.13-4)の単一の真実源。
// PDF/PNG の出力レイアウト(ComboExportDocument)とクリップボード builder(clipboard.ts)が
// 同じ項目定義・同じ順序を参照することで、選択した項目のみが全形式で一貫して反映される。
//
// 項目は DES-005 §5.6(詳細)/§5.8(比較表)に準拠する。
// キャラ名・始動状況は常時出力(ヘッダ)のため選択項目には含めない。

import {
  GAUGE_AT_START_LABEL_JA,
  GAUGE_CONSUMED_LABEL_JA,
} from "@/features/combo/labels";

export type ExportItemKey =
  | "recipe"
  | "damage"
  | "driveDamage"
  | "driveStart"
  | "saStart"
  | "driveConsumed"
  | "saConsumed"
  | "knockdownAdvantage"
  | "situation"
  | "customStates"
  | "oki"
  | "setups"
  | "tags"
  | "memo"
  // メディア 3 項目(M17-01)。URL/パスの文字列のみ出力(画像実体の埋め込みはしない)。
  | "link"
  | "videoPath"
  | "imagePath";

export interface ExportItem {
  key: ExportItemKey;
  /** 出力・UI に用いる日本語ラベル(§3.3 で英語ロケール参照不要のため固定値)。 */
  label: string;
}

// 出力順 = この配列順(詳細レイアウトの上から順・比較表の行順)。
export const EXPORT_ITEMS: ExportItem[] = [
  { key: "recipe", label: "レシピ" },
  { key: "damage", label: "ダメージ" },
  { key: "driveDamage", label: "ドライブダメージ" },
  { key: "driveStart", label: GAUGE_AT_START_LABEL_JA.drive },
  { key: "saStart", label: GAUGE_AT_START_LABEL_JA.sa },
  // M16-06(A-1): 消費エクスポート項目。始動 2 項目の直後に対称配置。既定 ON(全項目 Set)。
  { key: "driveConsumed", label: GAUGE_CONSUMED_LABEL_JA.drive },
  { key: "saConsumed", label: GAUGE_CONSUMED_LABEL_JA.sa },
  { key: "knockdownAdvantage", label: "有利フレーム" },
  { key: "situation", label: "状況" },
  { key: "customStates", label: "キャラ固有状態" },
  { key: "oki", label: "起き攻め情報" },
  { key: "setups", label: "セットプレイ" },
  { key: "tags", label: "タグ" },
  { key: "memo", label: "備考" },
  // メディア 3 項目(M17-01)。文字列出力のみ(実体埋め込みなし・CHANGE-068 §2.3-k)。
  { key: "link", label: "リンク" },
  { key: "videoPath", label: "動画パス" },
  { key: "imagePath", label: "画像パス" },
];

export const ALL_EXPORT_ITEM_KEYS: ExportItemKey[] = EXPORT_ITEMS.map(
  (i) => i.key,
);

// M17-05c-fix(CHANGE-073 §2.2-g): メディアのローカルパスは視覚出力(PDF/PNG/クリップボード)から除外する
// (共有先で無意味なため)。link(URL)は残す。CSV は BE 生成・往復インポート用に 3 列すべて維持(非波及)。
export const MEDIA_PATH_KEYS: readonly ExportItemKey[] = [
  "videoPath",
  "imagePath",
];

// 視覚出力の項目リスト(15)。ExportDialog は視覚形式のみ選択時にこれを表示し、
// CSV を含む選択時は EXPORT_ITEMS(17)を表示する(§5.13a・案B)。
export const VISUAL_EXPORT_ITEMS: ExportItem[] = EXPORT_ITEMS.filter(
  (i) => !MEDIA_PATH_KEYS.includes(i.key),
);

// selected から視覚出力に出さないメディアパス項目を除いた集合を返す(CSV には影響しない)。
export function toVisualSelected(
  selected: ReadonlySet<ExportItemKey>,
): Set<ExportItemKey> {
  const next = new Set(selected);
  for (const key of MEDIA_PATH_KEYS) next.delete(key);
  return next;
}

// 既定は全項目選択(DES-005 §5.13-4 は「絞れる」= 既定は全部入りで OK)。
export const DEFAULT_SELECTED_ITEMS: ReadonlySet<ExportItemKey> = new Set(
  ALL_EXPORT_ITEM_KEYS,
);

export function isItemSelected(
  selected: ReadonlySet<ExportItemKey>,
  key: ExportItemKey,
): boolean {
  return selected.has(key);
}

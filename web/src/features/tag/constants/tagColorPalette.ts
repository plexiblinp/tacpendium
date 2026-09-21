export interface TagColorOption {
  key: string;
  /**
   * 表示ラベルの i18n キー(M24-07)。本ファイルは「どの色があるか」の単一の正典を
   * 保ち続け、文言だけを locale へ出す。★key と labelKey を別々に散らさないこと。
   */
  labelKey: string;
  hex: string;
}

export const TAG_COLOR_PALETTE: readonly TagColorOption[] = [
  { key: "red", labelKey: "tag.color.red", hex: "#ef4444" },
  { key: "orange", labelKey: "tag.color.orange", hex: "#f97316" },
  { key: "yellow", labelKey: "tag.color.yellow", hex: "#eab308" },
  { key: "green", labelKey: "tag.color.green", hex: "#22c55e" },
  { key: "blue", labelKey: "tag.color.blue", hex: "#3b82f6" },
  { key: "indigo", labelKey: "tag.color.indigo", hex: "#6366f1" },
  { key: "purple", labelKey: "tag.color.purple", hex: "#a855f7" },
  { key: "pink", labelKey: "tag.color.pink", hex: "#ec4899" },
  { key: "brown", labelKey: "tag.color.brown", hex: "#92400e" },
  { key: "gray", labelKey: "tag.color.gray", hex: "#6b7280" },
];

// 新規タグ作成時の既定色(青系・固定・毎回同じ)。パレットの「青」エントリから導出し、
// 配色変更時に既定色が追従しないズレを防ぐ。
export const DEFAULT_TAG_COLOR = TAG_COLOR_PALETTE.find((c) => c.key === "blue")!.hex;

// 色未設定タグの表示用フォールバック(TagBadgeList/TagSelector で共有)
export const UNSET_TAG_COLOR_FALLBACK = "#9CA3AF";

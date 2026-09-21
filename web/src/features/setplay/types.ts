// M19-01: セットプレイ自動提案の API DTO 型(camelCase、バックエンド internal/api/setplay と対応)。

export type SetplayStepRole = "filler" | "target" | "parent";

export interface SetplaySuggestionStep {
  moveId: number;
  code: string;
  role: SetplayStepRole;
  counted: boolean;
}

export interface SetplaySuggestion {
  steps: SetplaySuggestionStep[];
  s: number; // 第 1 active の絶対フレーム
  n: number; // 起き上がりに重なる持続フレーム番号(gap では ≥2)
  landing: number; // = KA + 1
  targetActive: number;
  alreadyAdopted: boolean;
  mode: SetplayMode; // "meaty" | "gap"(M19-02)
  g: number; // gap のとき = n − 1(起き上がりの g フレーム前に第1activeが出る)。meaty では 0(M19-02)
}

export interface SetplaySuggestionsResponse {
  items: SetplaySuggestion[];
  truncated: boolean; // 安全上限到達(数え切れていない)ときのみ true
  totalFound: number; // ランキング対象の総解数(limit で切る前・M19-02)
  reason?: string; // 提案 0 件の理由コード(負 KA 等・M19-02)
}

// 提案の並び順。n: meaty=N 降順 / gap=G 昇順(既定)、target: 重ねる技順。
export type SetplaySort = "n" | "target";

// 提案モード。meaty=重ねる(既定)、gap=あえて重ねない(汚連携)(M19-02)。
export type SetplayMode = "meaty" | "gap";

// 負 KA の理由コード(BE の ReasonKnockdownNegative と対応)。
export const REASON_KNOCKDOWN_NEGATIVE = "knockdown_advantage_negative";

// gap モードの G 範囲(開発者確定・BE と同期)。
export const GAP_G_MIN = 1;
export const GAP_G_MAX = 13;

// 返却件数(「さらに表示」)。BE の defaultLimit=200 / maxLimit=3000 と同期。
export const SETPLAY_DEFAULT_LIMIT = 200;
export const SETPLAY_LIMIT_INCREMENT = 200;
export const SETPLAY_MAX_LIMIT = 3000;

// 当てたい技(target)の種別。BE で category + is_projectile(+ rush は元技 category)から算出される。
export type SetplayTargetType =
  | "normal"
  | "unique"
  | "special_projectile"
  | "special"
  | "throw"
  | "normal_rush"
  | "unique_rush";

// 既定 ON の種別(通常技・特殊技・必殺技(弾))。
export const DEFAULT_TARGET_TYPES: SetplayTargetType[] = [
  "normal",
  "unique",
  "special_projectile",
];

// UI に並べる種別(表示順)。ラッシュ版は既定 OFF。
export const TARGET_TYPE_ORDER: SetplayTargetType[] = [
  "normal",
  "unique",
  "special_projectile",
  "special",
  "throw",
  "normal_rush",
  "unique_rush",
];

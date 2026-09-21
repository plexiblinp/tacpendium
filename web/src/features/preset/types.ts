// プリセット API のドメイン型。Go 側 internal/api/preset/dto.go に対応。

export interface Preset {
  id: number;
  code: string;
  name: string;
  basePresetCode?: string;
  isBuiltin: boolean;
  userId?: number;
}

// 組み込みプリセットコード(DES-004 §3.1、SUPP-001 §3.4)。
// M20-01(旧 000069)で 5 種から 3 種へ整理した(D-288 / D-299 / D-300)。
// Go 側 internal/model/preset.go の PresetCode* と値を同期させる。
export const BUILTIN_PRESET_CODES = {
  officialJaMove: "official_ja_move",
  numeric: "numeric",
  srk: "srk",
} as const;

// 全体プリセット数の上限(DES-006 VAL-P05)。組み込み 3 + カスタム 5 = 8 件。
// Go 側 internal/service/preset/service.go の PresetTotalLimit と同期させる。
// ★1 ユーザーあたりの上限は設けない。数えるのは全体である。
export const PRESET_TOTAL_LIMIT = 8;

// PresetAliasDetail は編集画面(DES-005 §5.11)で扱う 1 件のエイリアス。
//
// ★aliasTextEn は表示専用である。編集欄を作らないこと——生成規則が入れる列で
// あり(DES-004 §5.4)、利用者が編集しても次の seed 波の再適用で消える。
// officialAliasText は official_ja_move の公式技名(どの技の欄かを判別する参照)。
export interface PresetAliasDetail {
  moveId: number;
  moveCode: string;
  moveCategory: string;
  characterId: number;
  aliasText: string;
  aliasTextEn?: string;
  officialAliasText?: string;
}

export interface CreatePresetInput {
  basePresetCode: string;
  name: string;
}

export interface UpdatePresetInput {
  name?: string;
  aliases?: { moveId: number; aliasText: string }[];
}

// API エラー本体(model.APIErrorResponse に対応)。
export interface PresetErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

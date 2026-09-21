// 他から引っ越し(M17-04)の API 型。バックエンド DTO `internal/api/intake/dto.go` のミラー。
// ② 照合(候補トークン列 → move_code)の結果と、解決済みコンボ → 取込 CSV 生成の入出力。

// ── POST /api/intake/resolve ────────────────────────────────────────────────

export interface IntakeResolveRequest {
  characterCode: string;
  text: string; // ① プロンプトの出力(TSV)をそのまま貼り付けたもの
}

export type ResolvedVia = "token" | "alias" | "";

export interface IntakeResolvedStep {
  stepOrder: number;
  rawText: string;
  tokens: string;
  nameCandidate: string;
  confidence: string;
  note: string;
  moveCode: string; // 確定 move_code(未解決は "")
  resolved: boolean;
  resolvedVia: ResolvedVia;
  // 候補 move_code 一覧(人レビュー・複数候補時の上書き用)。
  // 出どころは 3 系統(トークン索引 / 別名照合の複数件 / ハッジ分割)で、重複は除かれている。
  // ★空か否かに意味がある: 空でない = 1 件に決まらなかった、空 = 1 つも当たらなかった。
  // 判別は review.ts の unresolvedKind を使う(E-84)。
  candidates: string[];
}

export interface IntakeResolvedCombo {
  comboIndex: number;
  steps: IntakeResolvedStep[];
}

export interface IntakeResolveSummary {
  totalSteps: number;
  resolved: number;
  unresolved: number;
}

export interface IntakeResolveResponse {
  characterCode: string;
  movesAvailable: boolean; // false = 未投入キャラ・キャラ不明(全行未解決だが壊れない)
  combos: IntakeResolvedCombo[];
  summary: IntakeResolveSummary;
}

// ── POST /api/intake/csv ────────────────────────────────────────────────────

export interface IntakeBuildStep {
  moveCode: string;
}

export interface IntakeBuildCombo {
  memo: string;
  isDraft: boolean;
  steps: IntakeBuildStep[];
}

export interface IntakeBuildCsvRequest {
  characterCode: string;
  combos: IntakeBuildCombo[];
}

export interface IntakeBuildCsvResponse {
  csvText: string;
}

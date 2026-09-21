// コンボ CSV エクスポート(FR401)/インポート(FR405)の API DTO 型(camelCase)。
// バックエンド internal/api/comboio/dto.go と対応。

export type ExportRange = "all" | "filter" | "selected" | "mycombo";

// 重複時の動作(M17-05a B-6): skip(既定) / setups_only(コンボ本体は skip し配下セットプレイのみ
// 既存コンボへ親解決して取込)。「新規追加(add)」は必ず再衝突する死選択肢のため廃止。
// 将来「上書き(overwrite)」を足す場合はここに 1 要素追加する(M13-i 繰越)。
export type DupAction = "skip" | "setups_only";

export interface ComboPreviewRow {
  rowNumber: number;
  localId: string;
  characterCode: string;
  starterMoveCode: string;
  isDraft: boolean;
  stepCount: number;
  duplicate: boolean;
  duplicateComboId?: number;
  warnings: string[];
  errors: string[];
  importable: boolean;
}

export interface SetupPreviewRow {
  rowNumber: number;
  parentComboLocalId: string;
  name: string;
  stepCount: number;
  parentResolvable: boolean;
  warnings: string[];
  errors: string[];
  importable: boolean;
}

export interface PreviewSummary {
  comboTotal: number;
  comboOk: number;
  comboWarning: number;
  comboError: number;
  setupTotal: number;
}

export interface ComboImportPreviewResponse {
  combos: ComboPreviewRow[];
  setups: SetupPreviewRow[];
  comboFileError?: string;
  setupFileError?: string;
  summary: PreviewSummary;
}

export interface CommitRowResult {
  kind: "combo" | "setup";
  rowNumber: number;
  localId: string;
  status: "created" | "skipped" | "failed";
  reason?: string;
  comboId?: number;
}

export interface CommitSummary {
  success: number;
  skipped: number;
  failed: number;
}

export interface ComboImportCommitResponse {
  results: CommitRowResult[];
  summary: CommitSummary;
}

// rowNeedsConfirmation は要確認/エラー行の強調判定。
export function rowNeedsConfirmation(
  r: ComboPreviewRow | SetupPreviewRow,
): boolean {
  return r.warnings.length > 0 || r.errors.length > 0;
}

// データ移行の告知 DTO。バックエンド internal/api/notice の Response と対応する。
// ★キーは camelCase(CLAUDE.md §4)。
export interface DataMigrationNotice {
  status: "migrated" | "failed" | "skipped";
  /** Status を細分する理由コード。`old_data_stranded` だけ扱いが違う。 */
  reason?: string;
  message: string;
  from?: string;
  to?: string;
  retiredTo?: string;
  retireFailed: boolean;
  at?: string;
  acknowledged: boolean;
}

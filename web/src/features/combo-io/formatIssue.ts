// B-2(M17-05a): インポート検証エラー文字列を日本語へ写像する。
// バックエンドは各 issue を `[VAL-CODE] column: message` / `[VAL-CODE] message` の
// 単一文字列で返す(register 分離＝BE 不変・CHANGE-066)。ここでは FE で code/column を
// 取り出し、i18n の写像テーブル(comboImport.val.* / comboImport.col.*)へ流す。
// 未写像コード・角括弧なし(既に日本語の VAL-C02 や親未解決文言)は原文のままフォールバックする。

export interface ParsedIssue {
  code: string | null; // 例 "VAL-ENUM"。先頭が [CODE] でなければ null
  column: string | null; // 例 "opponent_size"。無ければ null
  message: string; // code/column を除いた本文(原文)
  raw: string; // 元の文字列(折りたたみ表示用に保持)
}

// 先頭の [CODE] と、続く「列名:」(任意)を分離する。列名は snake_case のみを許容し、
// 直後に「:」が来る場合だけ列とみなす(本文中のコロンを誤検出しない)。
const ISSUE_RE = /^\s*\[([A-Z0-9-]+)\]\s*(?:([a-z_][a-z0-9_]*):[ \t]*)?([\s\S]*)$/;

export function parseIssue(raw: string): ParsedIssue {
  const m = ISSUE_RE.exec(raw);
  if (!m) return { code: null, column: null, message: raw, raw };
  return {
    code: m[1],
    column: m[2] ?? null,
    message: (m[3] ?? "").trim(),
    raw,
  };
}

// i18next の t と同形の最小シグネチャ(テストでスタブ可能にするため)。
export type TFunc = (key: string, opts?: Record<string, unknown>) => string;

// formatIssue は 1 件の warnings/errors 文字列を日本語表示へ変換する。
// - code が無い(角括弧で始まらない)→ 原文をそのまま返す(既に日本語の行など)
// - code の写像が無い → 原文フォールバック(写像漏れで情報が消えない)
// - column は comboImport.col.* でラベル化(未定義は snake_case 原文)
export function formatIssue(raw: string, rowNumber: number, t: TFunc): string {
  const parsed = parseIssue(raw);
  if (!parsed.code) return raw;

  const colLabel = parsed.column
    ? t(`comboImport.col.${parsed.column}`, { defaultValue: parsed.column })
    : "";

  const translated = t(`comboImport.val.${parsed.code}`, {
    defaultValue: "",
    row: rowNumber,
    col: colLabel,
    message: parsed.message,
  });

  return translated ? translated : raw;
}

import { ApiError } from "./api";
import type { ValidationIssue, ValidationResult } from "./types";

// VAL-C02: 重複コンボ。専用の DuplicateWarning ダイアログで扱うため分離する。
const CODE_DUPLICATE = "VAL-C02";

// コンボ系 API エラーを画面表示用に分類した結果。
export interface ParsedComboError {
  // バリデーションエラー(HTTP 400)。ValidationDisplay にそのまま渡せる。
  validations: ValidationResult | null;
  // 重複(VAL-C02)エラー。専用ダイアログで扱う。
  duplicateIssue: ValidationIssue | null;
  // バリデーション以外の致命的エラー(通信エラー / 5xx / 楽観衝突等)のメッセージ。
  // Error 由来でない場合は null(呼び出し元が独自の i18n フォールバックを使う)。
  fatalMessage: string | null;
}

// コンボ系 API のエラーを画面表示用に分類する。
//
// 本登録昇格・コンボ保存・セットプレイ登録など、HTTP 400 のバリデーションエラーを
// 共通の見せ方(ValidationDisplay)で扱いたい箇所で再利用する。
// バグ #5(昇格時のエラー表示崩れ)修正で導入し、バグ #6(セットプレイ VAL-S02)も踏襲する想定。
export function parseComboApiError(err: unknown): ParsedComboError {
  if (err instanceof ApiError && err.validations) {
    const validations = err.validations;
    const duplicateIssue =
      validations.issues.find(
        (i) => i.code === CODE_DUPLICATE && i.severity === "error",
      ) ?? null;
    return { validations, duplicateIssue, fatalMessage: null };
  }
  return {
    validations: null,
    duplicateIssue: null,
    fatalMessage: err instanceof Error ? err.message : null,
  };
}

import { classifySaveError, type SaveErrorKind } from "@/features/combo/saveError";
import type { ValidationResult } from "@/features/combo/types";

// セットプレイ系 API エラーを画面表示用に分類した結果。
export interface ParsedSetupError {
  // バリデーションエラー(HTTP 400)。ValidationDisplay にそのまま渡せる。
  validations: ValidationResult | null;
  // ★分類の実体。判定は features/combo/saveError.ts に 1 本だけ置く。
  kind: SaveErrorKind;
  // 専用の見せ方を持たないエラー(通信エラー / 5xx / 404 等)のメッセージ。
  // Error 由来でない場合は null(呼び出し元が独自の i18n フォールバックを使う)。
  //
  // ★404 を含める。この画面の 404 は「親コンボが見つからない」か「本当に削除された」
  //   であり、競合モーダルへ寄せない(SetupEditorPage の handleError に理由がある)。
  //   ⇒ ここで null にすると、画面に何も出ないまま黙って失敗する。
  fatalMessage: string | null;
}

// セットプレイ系 API のエラーを画面表示用に分類する。
//
// ★M22-04 以前は `err.status === 409` だけで判定しており、同一レシピ重複
//   (duplicate_setup)まで「他のタブで更新されています」と版不一致の文言で
//   表示していた。409 は一意制約違反でも返るため、ステータスで分岐しては
//   ならない(DES-006 §11.2 / CHANGE-115 §2-c)。
//   ⇒ 判定は classifySaveError へ委譲し、ここには持たない。
export function parseSetupApiError(err: unknown): ParsedSetupError {
  const parsed = classifySaveError(err);
  return {
    validations: parsed.validations,
    kind: parsed.kind,
    fatalMessage:
      parsed.kind === "other" || parsed.kind === "notFound" ? parsed.message : null,
  };
}

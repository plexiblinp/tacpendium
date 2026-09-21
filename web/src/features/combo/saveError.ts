import {
  API_ERROR_CODE_DUPLICATE_SETUP,
  API_ERROR_CODE_NOT_FOUND,
  API_ERROR_CODE_VERSION_CONFLICT,
} from "@/constants/api-error";

import { ApiError } from "./api";
import type { ValidationResult } from "./types";

// 保存時 API エラーの分類(M22-04)。★この判断はここ 1 か所だけに置く。
//
// ★コンボ編集とセットプレイ編集が同じ判断を各々持つと必ずドリフトする(E-76)。
//   実際、本サブの着手時点で features/setup/errors.ts が `status === 409` だけで
//   判定しており、duplicate_setup(同一レシピ重複)が版不一致の文言で表示されていた。
//
// ★★ステータスではなくエラーコードで分岐する(CHANGE-115 §4 / DES-006 §11.2)。
//   409 は一意制約違反でも返るため、ステータスで分けるとプリセット別名の重複が
//   「ほかの人が変更しました」になる。しかも版不一致の方が先にテストされ、
//   一意制約違反の経路は別の画面にあるため、破っても大半の場面で動いてしまう。
export type SaveErrorKind =
  /** 版不一致。ほかの人が先に変更した(HTTP 409 + version_conflict)。 */
  | "versionConflict"
  /** 対象が見つからない(HTTP 404)。★キー変更編集に負けた側もここへ来る。 */
  | "notFound"
  /** 同一レシピのセットプレイが既に紐付いている(HTTP 409 + duplicate_setup)。 */
  | "duplicateSetup"
  /** 入力内容のバリデーションエラー(HTTP 400 + details.validations)。 */
  | "validation"
  /** 上記以外(通信エラー / 5xx / 未分類の 4xx)。 */
  | "other";

export interface ClassifiedSaveError {
  kind: SaveErrorKind;
  /** 応答本文の error.code。ApiError でない場合は null。 */
  code: string | null;
  /**
   * 画面に出せるメッセージ。Error 由来でない場合は null
   * (呼び出し元が独自の i18n フォールバックを使う)。
   */
  message: string | null;
  /** kind === "validation" のときのみ非 null。 */
  validations: ValidationResult | null;
}

/**
 * classifySaveError は保存時の API エラーを画面表示用に分類する。
 *
 * ★判定順に意味がある:
 *   1. version_conflict —— 最重要ゲート。ほかのどの分類より先に確定させる
 *   2. validations の有無 —— 400 の入力エラーは従来どおり ValidationDisplay へ流す
 *   3. duplicate_setup —— 版不一致と同じ 409 だが別物
 *   4. not_found —— 「本当に削除された」と「ほかの人が作り直した」の両方が来る。
 *      ★サーバは両者に同じ code / message を返すため、画面側で区別する手段は無い
 */
export function classifySaveError(err: unknown): ClassifiedSaveError {
  if (!(err instanceof ApiError)) {
    return {
      kind: "other",
      code: null,
      message: err instanceof Error ? err.message : null,
      validations: null,
    };
  }

  const code = err.body?.error?.code ?? null;
  const base = { code, message: err.message, validations: null } as const;

  if (code === API_ERROR_CODE_VERSION_CONFLICT) {
    return { ...base, kind: "versionConflict" };
  }
  if (err.validations) {
    return { ...base, kind: "validation", validations: err.validations };
  }
  if (code === API_ERROR_CODE_DUPLICATE_SETUP) {
    return { ...base, kind: "duplicateSetup" };
  }
  if (code === API_ERROR_CODE_NOT_FOUND) {
    return { ...base, kind: "notFound" };
  }
  // ★503 database_busy は意図的に "other" へ落とす(M24-11 / CHANGE-136)。
  //   分岐が漏れているのではない。利用者にできるのは「少し待って再試行」だけで
  //   入力の修正ではないため、専用の分類も専用の画面も作らない
  //   (指示書 M24-11 §4.3.1「汎用のエラー表示に載るところまででよい」)。
  //   ★1 人利用では busy_timeout(5 秒)を使い切ることは実質起きない。
  //   ⇒ ここへ API_ERROR_CODE_DATABASE_BUSY の分岐を足さないこと。
  return { ...base, kind: "other" };
}

/**
 * isConflictDialogKind は「競合モーダルで見せる分類か」を返す。
 *
 * ★版不一致と 404 の 2 つだけである。どちらも「利用者の入力は残したまま、
 *   何が起きたかと次にできることを伝える」対象(指示書 §4.1 / §4.3-7)。
 */
export function isConflictDialogKind(
  kind: SaveErrorKind,
): kind is "versionConflict" | "notFound" {
  return kind === "versionConflict" || kind === "notFound";
}

import type { ValidationResult } from "@/features/combo/types";

// ★★M31-01 レビュー(高-1): materialize の失敗理由を画面へ届ける。
//
// 着手前、確定反撃の 2 画面は `onError: () => toast.error("...失敗しました")` と書いて
// おり、**理由を捨てていた**。同じファイルの他のミューテーション(採用解除 / 非表示)は
// `e.message` を出しており、materialize だけが非対称だった。
//
// ★★M31-01 で materialize が VAL-C15(本登録の必須 4 欄)を通るようになったため、
//   400 は稀な異常系ではなくなった —— followup `required-fields-migration-burden` の
//   実測では、既存の本登録 83 件のうち 68 件が必須 4 欄のいずれかを空にしている
//   (`D-724`)。⇒ 理由が出ないと、利用者は「なぜ作れないのか」を知る手段が無い。
//   ★★M38-01(射程 3 / 追補2): **この 68 件は当時の必須 4 欄に対する数である。**
//     ⇒ `VAL-C15` は damage / knockdownAdvantage の **2 欄**になり、サーバが咎める
//       のもその 2 列だけである。★母数は減る方向であり、現在の件数は測っていない。
//     ★挙動(理由を捨てない)は正しいままである。⇒ 直す対象は数の解釈だけである。
//
// ★本関数は VAL コードで分岐しない。**検証エラー一般**を扱う——コードを名指しすると、
//   新しい VAL が足されたときに黙って素通りする。

// fetchJSON は失敗時に `HTTP <status>: <body>` という形の Error を投げる
// (web/src/lib/api-client.ts)。⇒ 本文はその後ろに素の JSON で入っている。
const HTTP_ERROR_PREFIX = /^HTTP \d+: /;

interface ErrorBody {
  error?: { message?: string; details?: { validations?: ValidationResult } };
}

/**
 * materializeErrorMessage は materialize の失敗を利用者向けの 1 行にする。
 *
 * 検証エラー(400 + details.validations)なら各 issue の message を並べ、
 * それ以外は元の message をそのまま返す(情報を捨てない)。
 */
export function materializeErrorMessage(err: unknown): string {
  const fallback = "パニッシュカウンター版の生成に失敗しました";
  if (!(err instanceof Error)) return fallback;

  const raw = err.message.replace(HTTP_ERROR_PREFIX, "");
  let body: ErrorBody | null = null;
  try {
    body = JSON.parse(raw) as ErrorBody;
  } catch {
    // JSON でない(通信エラー等)。★握り潰さず、元の message を出す。
    return `${fallback}: ${err.message}`;
  }

  const issues = body?.error?.details?.validations?.issues ?? [];
  const messages = issues
    .filter((i) => i.severity === "error")
    .map((i) => i.message)
    .filter((m) => m.length > 0);
  if (messages.length > 0) return `${fallback}: ${messages.join(" / ")}`;

  // ★検証エラー以外の API エラー(例: hit_type_not_materializable)は
  //   サーバの message をそのまま出す。
  const apiMessage = body?.error?.message ?? "";
  if (apiMessage.length > 0) return `${fallback}: ${apiMessage}`;

  // ★★ここまで来たら、本文は解釈できたが出せる理由が無い。
  //   ⇒ 生の JSON を利用者へ投げない(warning しか無い応答の本文などが漏れる)。
  return fallback;
}

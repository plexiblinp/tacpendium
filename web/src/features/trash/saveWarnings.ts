// 登録時の重複警告の表示用ロジック(M23-05 §4.6)。コンボ側・セットプレイ側の両方が使う。
//
// ★★restoreWarnings.ts と分けているのは、利用者にできることが違うからである
// (M23-05 §4.6)。登録側は「保存したものと同じものがゴミ箱にもある」を事後に告げ、
// 復元側は「もう並んでいる」を告げる。⇒ 文面を共有しないこと。共有すると、どちらかに
// 合わせた曖昧な文になる。
//
// ★★2026-08-23 是正(M23-09 / D-518)——本ファイルは当初「登録側は『作り直す前に』告げる」
// と書いていたが、その主張は撤回された。本モジュールが出すのは保存が成功した後のトースト
// であり、定義上「作り直す前」には告げられない。それが M23-05 の失敗そのものであり、
// M23-09(保存前の重複ダイアログ)が生まれた理由である。
// ★M23-09 以降、保存前ダイアログを出したうえで「新しく作る」を選んだ経路では、
// 本モジュールの文面は抑制される(M23-09 §4.5＝ダイアログで告げたことを二重に告げない)。
// 抑制は画面側で行い、サーバの契約は変えていない。dropAcknowledgedTrashDuplicates を参照。
//
// ★文面はここで組み立てる。サーバの ValidationIssue.message は日本語の診断文を持つが、
// 画面はそれを表示しない(DES-006 §11.3 が翻訳キー経由を求めている)。
// ⇒ 表示に使うのは code と details だけである。
//
// ★見せ方はトーストであり、モーダルではない(DES-006 §11.1 / M23-05 §4.6)。
// 本サブの警告は ERROR ではなく、登録は既に成功している。

import type { TFunction } from "i18next";

import type { ValidationIssue } from "@/features/combo/types";

import { warningRefCount } from "./warningDetails";

// 翻訳キーを持つ VAL コード。
// ★対応表は持たない。判定は formatSaveWarning の分岐そのものが唯一の台帳であり、
//   別に一覧を置くと VAL コードを足したとき片方だけ直しても何も壊れない状態になる
//   (restoreWarnings.ts と同じ方針)。
export const VAL_C14_DUPLICATE_IN_TRASH = "VAL-C14";
export const VAL_S07_DUPLICATE_SETUP_IN_TRASH = "VAL-S07";

/**
 * formatSaveWarning は登録時の警告 1 件を表示文面へ変換する。
 *
 * ★未知のコードでも黙って消さない。将来コードが足されたときに、画面が何も出さないと
 * 「警告が出ていない」と読まれてしまう(restoreWarnings.ts と同じ扱い)。
 */
export function formatSaveWarning(
  issue: ValidationIssue,
  t: TFunction,
): string {
  if (issue.code === VAL_C14_DUPLICATE_IN_TRASH) {
    return t("trash.warning.duplicateInTrash", {
      count: warningRefCount(issue, "combos"),
    });
  }
  if (issue.code === VAL_S07_DUPLICATE_SETUP_IN_TRASH) {
    return t("trash.warning.duplicateSetupInTrash", {
      count: warningRefCount(issue, "setups"),
    });
  }
  return t("trash.warning.unknown", { code: issue.code });
}

/**
 * formatSaveWarnings は 1 回の登録で返った警告をまとめた 1 本の文面にする。
 *
 * ★1 件ずつトーストを出さない。同じ文面は畳む(restoreWarnings.ts と同じ理由)。
 */
export function formatSaveWarnings(
  issues: ValidationIssue[],
  t: TFunction,
): string {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const issue of issues) {
    const line = formatSaveWarning(issue, t);
    if (seen.has(line)) continue;
    seen.add(line);
    lines.push(line);
  }
  return lines.join(" / ");
}

/**
 * dropAcknowledgedTrashDuplicates は「保存前ダイアログで既に告げた重複」だけを落とす
 * (M23-09 §4.5)。
 *
 * ★★落とすのは VAL-C14 / VAL-S07 の 2 コードだけである。warnings を丸ごと捨てないこと——
 * 本ファイルの formatSaveWarning は「未知のコードでも黙って消さない」方針であり、
 * 一括で捨てると将来コードが足されたときに画面が何も出さなくなる。
 *
 * ★呼ぶのは「ダイアログを出したうえで『新しく作る』を選んだとき」だけである
 * (§4.5-2)。チェックが失敗してダイアログを出さなかった場合は従来どおり全件出す。
 *
 * ★サーバの契約は変えていない。サーバは従来どおり VAL-C14 / VAL-S07 を返し続ける
 * (§4.5-1＝「確認済み」フラグをサーバへ送らない)。
 */
export function dropAcknowledgedTrashDuplicates(
  issues: ValidationIssue[],
): ValidationIssue[] {
  return issues.filter(
    (issue) =>
      issue.code !== VAL_C14_DUPLICATE_IN_TRASH &&
      issue.code !== VAL_S07_DUPLICATE_SETUP_IN_TRASH,
  );
}

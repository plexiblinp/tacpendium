// 復元警告の表示用ロジック(M23-04 §4.4)。コンボ側・セットプレイ側の両方が使う。
//
// ★文面はここで組み立てる。サーバの ValidationIssue.message は日本語の診断文を
// 持っているが、画面はそれを表示しない——DES-006 §11.3 が翻訳キー経由を求めており、
// M17-05a の「VAL エラーは FE 表示層で日本語化」と同じ形にしてある。
// ⇒ 表示に使うのは code と details だけである。
//
// ★見せ方はトーストであり、モーダルではない(DES-006 §11.1 / 指示書 §4.4)。
// 本サブの警告は ERROR ではなく、利用者の作業を遮る理由が無い。

import type { TFunction } from "i18next";

import type { ValidationIssue } from "@/features/combo/types";

import { warningRefCount, warningRefEntries } from "./warningDetails";

// 翻訳キーを持つ VAL コード。
// ★リテラルを画面側へ散在させないため、コードは本ファイルの定数を参照する
//   (CLAUDE.md §4)。
// ★対応表は持たない。判定は formatRestoreWarning の分岐そのものが唯一の台帳であり、
//   別に一覧を置くと VAL コードを足したとき片方だけ直しても何も壊れない状態になる。
export const VAL_R01_LINKED_SETUPS_DELETED = "VAL-R01";
export const VAL_R02_ALL_PARENT_COMBOS_DELETED = "VAL-R02";
export const VAL_C08_MOVE_EXISTS = "VAL-C08";
export const VAL_S03_MOVE_EXISTS = "VAL-S03";
// M23-05: 復元したら生きた重複が居た(§4.1)。
// ★登録側の VAL-C14 / VAL-S07 は saveWarnings.ts が持つ。文面を分けるのは、利用者に
//   できることが違うためである(M23-05 §4.6)。ここへ足さないこと。
export const VAL_R03_DUPLICATE_ALIVE_COMBO = "VAL-R03";
export const VAL_R04_DUPLICATE_ALIVE_SETUP = "VAL-R04";

/**
 * formatRestoreWarning は警告 1 件を表示文面へ変換する。
 *
 * ★未知のコードでも黙って消さない。将来 VAL-R03 以降が足されたときに、
 * 画面が何も出さないと「警告が出ていない」と読まれてしまう。
 */
export function formatRestoreWarning(issue: ValidationIssue, t: TFunction): string {
  if (issue.code === VAL_R01_LINKED_SETUPS_DELETED) {
    return t("trash.warning.linkedSetupsDeleted", {
      count: warningRefCount(issue, "setups"),
    });
  }
  if (issue.code === VAL_R02_ALL_PARENT_COMBOS_DELETED) {
    return t("trash.warning.allParentCombosDeleted", {
      count: warningRefCount(issue, "combos"),
    });
  }
  if (issue.code === VAL_R03_DUPLICATE_ALIVE_COMBO) {
    return t("trash.warning.duplicateAliveCombo", {
      count: warningRefCount(issue, "combos"),
    });
  }
  if (issue.code === VAL_R04_DUPLICATE_ALIVE_SETUP) {
    return t("trash.warning.duplicateAliveSetup", {
      count: warningRefCount(issue, "setups"),
    });
  }
  if (issue.code === VAL_C08_MOVE_EXISTS || issue.code === VAL_S03_MOVE_EXISTS) {
    return t("trash.warning.moveNotFound");
  }
  return t("trash.warning.unknown", { code: issue.code });
}

/**
 * formatRestoreWarnings は 1 件の復元で返った警告をまとめた 1 本の文面にする。
 *
 * ★1 件ずつトーストを出さない。1 つの復元で VAL-R01 と VAL-C08 が同時に付くことは
 * ありうるため、束ねないとトーストが積み上がる(§4.4 の表と同じ理由)。
 *
 * ★★終端の句点はここで付ける(M23-06 §4.6-2)。個々の文面へ持たせると、2 種類が
 * 同時に発火したときに「A。 / B。」となって連結が読めなくなる。区切りも終端も
 * 翻訳キー経由である——en は "." であり、句点を直書きすると英語側が壊れる。
 */
export function formatRestoreWarnings(issues: ValidationIssue[], t: TFunction): string {
  // ★同じ文面を連結しない。VAL-C08 / VAL-S03 はステップ単位で発火するため、
  //   3 ステップが不整合なら同一文が 3 回並ぶ(レシピの何行目かは警告文が持たない
  //   ので、繰り返しても利用者に増える情報が無い)。
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const issue of issues) {
    const line = formatRestoreWarning(issue, t);
    if (seen.has(line)) continue;
    seen.add(line);
    lines.push(line);
  }
  if (lines.length === 0) return "";
  return lines.join(t("trash.warning.warningSeparator")) + t("trash.warning.warningTerminator");
}

/**
 * formatBulkRestoreSummary は一括復元の結果を 1 枚のトースト文面へ畳む(M23-04 §4.4)。
 *
 * ★1 件ずつトーストを積み上げないこと——選択が 20 件のときトーストが 20 枚出る。
 * ★「どの件に警告が付いたか」はトーストへ入れない。M23-06 §4.6-3 で
 *   formatBulkRestoreDetail(下記)を作り、画面の内訳として出すようにした。
 *   ⇒ トーストは件数の要約に徹する。
 */
export function formatBulkRestoreSummary(
  restoredCount: number,
  warnedCount: number,
  t: TFunction,
): string {
  if (warnedCount === 0) {
    return t("trash.warning.bulkRestored", { count: restoredCount });
  }
  return t("trash.warning.bulkRestoredWithWarnings", {
    count: restoredCount,
    warned: warnedCount,
  });
}

/**
 * BulkRestoreWarnedItem は一括復元で警告が付いた 1 件(M23-06 §4.6-3)。
 *
 * ★label は「どの行に警告が付いたか」を利用者が判る文字列である。ゴミ箱の一覧に
 * 既に在るものを使う——新しくデータを取りに行かない(指示書 §4.6 の材料の節)。
 */
export interface BulkRestoreWarnedItem {
  /** 種別込みの一意キー("combo-12" / "setup-12")。★id だけだと種別をまたいで衝突する。 */
  key: string;
  label: string;
  warnings: ValidationIssue[];
}

/**
 * formatBulkRestoreDetail は一括復元の内訳 1 行を組み立てる(M23-06 §4.6-3)。
 *
 * ★★VAL コードで分岐しない。警告が指している行の抽出は warningRefEntries が
 * details のキー(setups / combos)で行う。⇒ 未知のコードが返っても、文面は
 * formatRestoreWarning の unknown フォールバックで出て、行は壊れない。
 */
export function formatBulkRestoreDetail(item: BulkRestoreWarnedItem, t: TFunction): string {
  const line = t("trash.warning.bulkDetailLine", {
    label: item.label,
    warnings: formatRestoreWarnings(item.warnings, t),
  });

  // ★参照先が名前を持っている場合だけ添える。持たない警告(VAL-C08 等)では何も足さない。
  const refs = item.warnings.flatMap((issue) => warningRefEntries(issue)).map((ref) => ref.label);
  if (refs.length === 0) return line;

  const unique = Array.from(new Set(refs));
  return line + t("trash.warning.bulkDetailRefs", { refs: unique.join(t("trash.warning.warningSeparator")) });
}

// 警告 details の読み取りヘルパ(M23-05 §9.2)。
//
// ★件数は details.totalCount を優先する。M23-05 の 4 件は details へ載せる参照を
// 上限で切るため(サーバ側 MaxDuplicateRefsInDetails)、配列長だけを見ると上限で
// 頭打ちになった件数を表示してしまう。
// ★M23-04 の VAL-R01 / VAL-R02 は上限を持たず totalCount も付かないので、
// フォールバックの配列長が正しい件数になる。

import type { ValidationIssue } from "@/features/combo/types";

/** warningRefCount は警告が指している行の件数を返す(上限で切られていても総数)。 */
export function warningRefCount(issue: ValidationIssue, key: "combos" | "setups"): number {
  return issue.details?.totalCount ?? issue.details?.[key]?.length ?? 0;
}

/**
 * warningRefEntry は警告 details が指している行 1 件の、人が読める識別子。
 *
 * ★VAL-R01 の details.setups は {id, name}、VAL-R02 / VAL-R03 の details.combos は
 * {id, memo} である(DES-002 §4.2)。どちらも人が読める文字列を持つ。
 */
export interface WarningRefEntry {
  id: number;
  label: string;
}

/**
 * warningRefEntries は警告が指している行を、VAL コードを見ずに取り出す(M23-06 §4.6-3)。
 *
 * ★★コードで分岐しないこと。復元経路が返す VAL コードは M23-04 の 2 件から M23-05 で
 * 4 件へ、さらに VAL-C08 / VAL-S03 を含めて 6 件へ増えている。コードを列挙する形にすると、
 * 次に 1 件足されたときに黙って何も出さなくなる。
 * ⇒ 分岐は details のキー(setups / combos)で行う。未知のコードでも details さえ在れば拾える。
 *
 * ★ラベルが空の行(name も memo も未設定)は取り違えの元なので落とす。件数は
 * warningRefCount 側が totalCount から出しており、本関数は「名前で示せるものだけ」を返す。
 */
export function warningRefEntries(issue: ValidationIssue): WarningRefEntry[] {
  const details = issue.details;
  if (!details) return [];

  const entries: WarningRefEntry[] = [];
  for (const ref of details.setups ?? []) {
    const label = (ref.name ?? "").trim();
    if (label) entries.push({ id: ref.id, label });
  }
  for (const ref of details.combos ?? []) {
    const label = (ref.memo ?? "").trim();
    if (label) entries.push({ id: ref.id, label });
  }
  return entries;
}

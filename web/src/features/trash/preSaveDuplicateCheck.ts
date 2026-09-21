// 保存前の重複チェック(M23-09 §4.1 / §4.2)。コンボ側・セットプレイ側の両方が使う。
//
// ★★命令的な関数である。React Query でも debounce つきフックでもない——ダイアログを
// 出すのは「保存ボタンを押したとき」だけであり、入力中には出さない(§4.2-1)。
// 入力中のリアルタイム警告は既存の useCheckDuplicate が担っており、本モジュールとは別物。
//
// ★★どの関数も例外を投げない。判別共用体で「ok かどうか」を返す。
// 理由＝§4.2-3「チェックが失敗しても保存を止めない」を、呼び出し側の try/catch 忘れが
// 起こりえない形で型に落とすためである。チェックは付加価値であり、それが壊れたことで
// 登録という利用者の主目的を巻き添えにしない。

import type { TFunction } from "i18next";

import type {
  CheckDuplicateRequest,
  CheckDuplicateResponse,
} from "@/features/combo/types";
import type {
  CheckSetupDuplicateRequest,
  CheckSetupDuplicateResponse,
} from "@/features/setup/types";
import { fetchJSON } from "@/lib/api-client";

/** PreSaveDuplicateCheck はチェックの結果。★失敗は例外ではなく ok:false で表す。 */
export type PreSaveDuplicateCheck =
  | { ok: true; deleted: DuplicateCandidate[] }
  | { ok: false };

/** DuplicateCandidate はダイアログが 1 行として見せる候補。 */
export interface DuplicateCandidate {
  id: number;
  /** ★人が読める文字列。空の行も id で表す(§4.1-3)。 */
  label: string;
}

/**
 * checkComboTrashDuplicates はコンボの保存前チェックを 1 回だけ叩く。
 *
 * ★生きた側(duplicates)は読み捨てる。生きた重複は既に VAL-C02 が ERROR で止めており、
 * 本サブはそこへ手を広げない(§4.1-4)。応答に載っているのは経路の形を素直にするためである。
 */
export async function checkComboTrashDuplicates(
  req: CheckDuplicateRequest,
  t: TFunction,
): Promise<PreSaveDuplicateCheck> {
  try {
    const res = await fetchJSON<CheckDuplicateResponse>(
      "/api/combos/check-duplicate",
      {
        method: "POST",
        body: JSON.stringify(req),
      },
    );
    return {
      ok: true,
      deleted: toComboCandidates(res.deletedDuplicates ?? [], t),
    };
  } catch (e) {
    // ★保存は止めない。ログだけ残す(§4.2-3)。console.log は使わない(CLAUDE.md §10)。
    console.warn("pre-save duplicate check failed (combo)", e);
    return { ok: false };
  }
}

/**
 * checkSetupTrashDuplicates はセットプレイの保存前チェックを 1 回だけ叩く。
 *
 * ★親コンボ id を要する。セットプレイの登録経路が POST /api/combos/{comboId}/setups で
 * あり、重複の母集団も「同じ親コンボ配下」だからである(VAL-S04 / VAL-S07 と同じ意味論)。
 */
export async function checkSetupTrashDuplicates(
  comboId: number,
  req: CheckSetupDuplicateRequest,
  t: TFunction,
): Promise<PreSaveDuplicateCheck> {
  try {
    const res = await fetchJSON<CheckSetupDuplicateResponse>(
      `/api/combos/${comboId}/setups/check-duplicate`,
      { method: "POST", body: JSON.stringify(req) },
    );
    return {
      ok: true,
      deleted: toSetupCandidates(res.deletedDuplicates ?? [], t),
    };
  } catch (e) {
    console.warn("pre-save duplicate check failed (setup)", e);
    return { ok: false };
  }
}

/**
 * toComboCandidates は応答をダイアログの選択肢へ写す。
 *
 * ★★名前(memo)が空の行も落とさない。落とすとその行はダイアログから選べなくなり、
 * どうやっても復元できない。warningRefEntries(件数表示用・空を落とす)とは目的が違う。
 */
export function toComboCandidates(
  refs: Array<{ id: number; memo?: string | null }>,
  t: TFunction,
): DuplicateCandidate[] {
  return refs.map((r) => ({
    id: r.id,
    label: nonEmpty(r.memo) ?? t("trash.warning.unnamedCombo", { id: r.id }),
  }));
}

/** toSetupCandidates はセットプレイ側の同型。空の名前は「セットプレイ {{id}}」へ倒す。 */
export function toSetupCandidates(
  refs: Array<{ id: number; name?: string | null }>,
  t: TFunction,
): DuplicateCandidate[] {
  return refs.map((r) => ({
    id: r.id,
    label: nonEmpty(r.name) ?? t("trash.warning.unnamedSetup", { id: r.id }),
  }));
}

function nonEmpty(v: string | null | undefined): string | null {
  if (v == null) return null;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : null;
}

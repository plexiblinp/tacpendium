import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { useRestoreCombo } from "../hooks/useRestoreCombo";
import { usePermanentDelete } from "../hooks/usePermanentDelete";
import { useRestoreSetup } from "@/features/setup/hooks/useRestoreSetup";
import { usePermanentDeleteSetup } from "@/features/setup/hooks/usePermanentDeleteSetup";
import { PermanentDeleteConfirm } from "./PermanentDeleteConfirm";
import {
  formatBulkRestoreDetail,
  formatBulkRestoreSummary,
  type BulkRestoreWarnedItem,
} from "@/features/trash/restoreWarnings";
import { formatStarterStatus } from "../utils";
import { ApiError } from "../api";
import {
  API_ERROR_CODE_SETUP_IN_USE,
  API_ERROR_CODE_SETUP_NOT_IN_TRASH,
} from "@/constants/api-error";
import type { ComboSummary, ValidationIssue, WarningDetails } from "../types";
import type { SetupResponse } from "@/features/setup/types";

// ゴミ箱の一括操作(M23-06 §4.4)。
//
// ★★選択はコンボ用とセットプレイ用の 2 本に分かれている(案 b)。1 本の id 配列に
//   混ぜない——id が衝突し、コンボの id でセットプレイの API を叩く経路が構造的に
//   作れてしまう。★取り違えると別のデータが消える。完全削除は不可逆である。
//   ⇒ 本コンポーネントでも、コンボの配列は combo 系の mutation にしか渡さず、
//   セットプレイの配列は setup 系の mutation にしか渡さない。
// ★選択状態はブラウザストレージへ保存しない(CLAUDE.md §10.X)。

type BlockingCombos = NonNullable<WarningDetails["combos"]>;

interface FailedItem {
  key: string;
  label: string;
  /** 診断用の生メッセージ。★画面へは出さない(下の reason を出す)。 */
  error: string;
  /**
   * 利用者へ見せる失敗の理由(M24-08 実機確認 / followup
   * `trash-bulk-permanent-delete-reason-hidden` の段 2)。
   *
   * ★★着手前は label しか描画しておらず「2 件失敗: ds2 / delse1」としか出なかった。
   *   理由(setup_in_use)も参照元コンボも捕捉はされていたのに捨てていたため、
   *   利用者からは「一切削除できない」に見えていた(開発者の実機確認で再現)。
   */
  reason: string;
  /**
   * `setup_in_use` のとき、そのセットプレイを掴んでいる生きたコンボ。
   * ★行単位(TrashSetupListRow)と同じ `details.combos` を読む。
   */
  blockingCombos: BlockingCombos | null;
}

interface Props {
  selectedCombos: ComboSummary[];
  selectedSetups: SetupResponse[];
  onComplete: () => void;
}

/** 復元 1 件の結果。どの行のものかを取り違えないよう、行のラベルと一緒に持つ。 */
interface RestoreOutcome {
  key: string;
  label: string;
  warnings: ValidationIssue[];
  error?: string;
  /** 失敗したときの、利用者へ見せる理由。★復元は「復元に失敗しました」を既定にする。 */
  reason?: string;
  blockingCombos?: BlockingCombos | null;
}

export function TrashBulkActions({ selectedCombos, selectedSetups, onComplete }: Props) {
  const { t } = useTranslation();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errors, setErrors] = useState<FailedItem[]>([]);
  const [warnedItems, setWarnedItems] = useState<BulkRestoreWarnedItem[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const restoreCombo = useRestoreCombo();
  const permanentDeleteCombo = usePermanentDelete();
  const restoreSetup = useRestoreSetup();
  const permanentDeleteSetup = usePermanentDeleteSetup();

  const totalCount = selectedCombos.length + selectedSetups.length;

  // ★ラベルは一覧に既に在るものから作る。新しくデータを取りに行かない(§4.6 の材料の節)。
  const comboLabel = (combo: ComboSummary) =>
    combo.memo?.trim() || formatStarterStatus(combo, t) || t("trash.warning.unnamedCombo", { id: combo.id });
  const setupLabel = (setup: SetupResponse) =>
    setup.name?.trim() || setup.defaultRecipe || t("trash.setup.unnamed");

  const handleBulkRestore = async () => {
    setIsProcessing(true);
    setErrors([]);
    setWarnedItems([]);

    // ★★種別ごとに別の mutation を回す。ここが本サブの最重要ゲートである
    //   (§4.4-1)——combo の id は restoreCombo にしか、setup の id は
    //   restoreSetup にしか渡らない。
    const comboOutcomes = await Promise.allSettled(
      selectedCombos.map((combo) => restoreCombo.mutateAsync(combo.id)),
    );
    const setupOutcomes = await Promise.allSettled(
      selectedSetups.map((setup) => restoreSetup.mutateAsync(setup.id)),
    );

    const outcomes: RestoreOutcome[] = [
      ...comboOutcomes.map((result, i): RestoreOutcome => {
        const combo = selectedCombos[i];
        const base = { key: `combo-${combo.id}`, label: comboLabel(combo) };
        return result.status === "fulfilled"
          ? { ...base, warnings: result.value.warnings ?? [] }
          : {
              ...base,
              warnings: [],
              error: errorMessage(result.reason),
              ...resolveFailure(result.reason, t, "trash.setup.restoreError"),
            };
      }),
      ...setupOutcomes.map((result, i): RestoreOutcome => {
        const setup = selectedSetups[i];
        const base = { key: `setup-${setup.id}`, label: setupLabel(setup) };
        return result.status === "fulfilled"
          ? { ...base, warnings: result.value.warnings ?? [] }
          : {
              ...base,
              warnings: [],
              error: errorMessage(result.reason),
              ...resolveFailure(result.reason, t, "trash.setup.restoreError"),
            };
      }),
    ];

    setErrors(
      outcomes
        .filter((o) => o.error !== undefined)
        .map((o) => ({
          key: o.key,
          label: o.label,
          error: o.error as string,
          reason: o.reason ?? t("trash.setup.restoreError"),
          blockingCombos: o.blockingCombos ?? null,
        })),
    );

    const restored = outcomes.filter((o) => o.error === undefined);
    const warned = restored
      .filter((o) => o.warnings.length > 0)
      .map((o) => ({ key: o.key, label: o.label, warnings: o.warnings }));
    setWarnedItems(warned);

    // ★件数を畳んで 1 枚のトーストにまとめる(M23-04 §4.4)。1 件ずつ積み上げない——
    //   選択が 20 件のときトーストが 20 枚出る。
    // ★「どの件に警告が付いたか」はトーストではなく、下の内訳で出す(M23-06 §4.6-3)。
    if (restored.length > 0) {
      const message = formatBulkRestoreSummary(restored.length, warned.length, t);
      if (warned.length > 0) {
        toast.warning(message);
      } else {
        toast.success(message);
      }
    }

    setIsProcessing(false);
    onComplete();
  };

  const handleBulkPermanentDelete = async () => {
    setConfirmOpen(false);
    setIsProcessing(true);
    setErrors([]);
    setWarnedItems([]);

    // ★★復元と同じく種別ごとに分ける(§4.4-1)。
    const comboResults = await Promise.allSettled(
      selectedCombos.map((combo) => permanentDeleteCombo.mutateAsync(combo.id)),
    );
    const setupResults = await Promise.allSettled(
      selectedSetups.map((setup) => permanentDeleteSetup.mutateAsync(setup.id)),
    );

    const failed: FailedItem[] = [
      ...comboResults.flatMap((result, i) =>
        result.status === "rejected"
          ? [{
              key: `combo-${selectedCombos[i].id}`,
              label: comboLabel(selectedCombos[i]),
              error: errorMessage(result.reason),
              ...resolveFailure(result.reason, t, "trash.setup.permanentDeleteError"),
            }]
          : [],
      ),
      ...setupResults.flatMap((result, i) =>
        result.status === "rejected"
          ? [{
              key: `setup-${selectedSetups[i].id}`,
              label: setupLabel(selectedSetups[i]),
              error: errorMessage(result.reason),
              ...resolveFailure(result.reason, t, "trash.setup.permanentDeleteError"),
            }]
          : [],
      ),
    ];
    setErrors(failed);
    setIsProcessing(false);
    onComplete();
  };

  // ★★選択が空でも、結果(失敗一覧・警告の内訳)が残っている間は描画を続ける。
  //
  //   一括操作の末尾で onComplete() を呼ぶと、親(TrashPage)が選択状態を空にする。
  //   ⇒ totalCount が 0 になる。ここで無条件に null を返すと、直前に立てた
  //   setErrors / setWarnedItems の結果が、利用者の目に入る前に消える。
  //   ★これは実際に起きていた——§4.6-3 の内訳を実装しても 1 フレームも表示されず、
  //   既存の「N 件失敗」も M23-02 期からずっと見えていなかった(レビュー高-1)。
  //   ★★テストでは検出できなかった。onComplete を no-op のモックにすると選択が
  //   空にならないためである。⇒ テスト側も親と同じ「選択を空にする」形にしてある。
  const hasResult = errors.length > 0 || warnedItems.length > 0;
  if (totalCount === 0 && !hasResult) return null;

  return (
    // ★M23-07 §4.4-2: 画面下部への sticky 固定。両方の表から届く。
    // ★sticky はこのコンポーネント自身が持つ。親でラップすると、null を返している
    //   間も枠だけが残る。
    <div className="sticky bottom-0 z-20 mt-6 flex flex-wrap items-center gap-3 rounded border border-slate-300 bg-white/95 px-4 py-2 shadow-lg backdrop-blur">
      {/* ★選択が残っている間だけ操作を出す。結果だけを見せている間はボタンを隠す
          ——選択が空なのに「選択を復元」が押せる状態を作らない。 */}
      {totalCount > 0 && (
        <>
          <span className="text-sm text-slate-600">
            {t("trash.bulk.selectedCount", { count: totalCount })}
          </span>
          <button
            type="button"
            onClick={handleBulkRestore}
            disabled={isProcessing}
            className="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {t("trash.bulk.restoreSelected")}
          </button>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={isProcessing}
            className="rounded bg-red-600 px-3 py-1 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {t("trash.bulk.permanentDeleteSelected")}
          </button>
        </>
      )}
      {isProcessing && (
        <span className="text-sm text-slate-500">{t("trash.bulk.processing")}</span>
      )}
      {/* ★★失敗は「件数とラベル」ではなく「行ごとの理由」で出す
          (M24-08 実機確認 / followup `trash-bulk-permanent-delete-reason-hidden` の段 2)。
          着手前は「2 件失敗: ds2 / delse1」としか出ず、理由も参照元も捕捉済みなのに
          捨てていたため、利用者からは「一切削除できない」に見えていた。
          ★解除ボタンまでは作らない(段 3)。理由を読んで行の「完全削除」へ移り、
            そこで解除する——行単位には M23-07 が導線を作ってある。 */}
      {errors.length > 0 && (
        <div role="alert" className="w-full text-sm text-red-600">
          <p className="font-medium">
            {t("trash.bulk.failedHeading", { count: errors.length })}
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {errors.map((e) => (
              <li key={e.key}>
                <span className="break-all">{e.label}</span>
                {"："}
                {e.reason}
                {e.blockingCombos && e.blockingCombos.length > 0 && (
                  <div className="mt-0.5 text-xs">
                    {t("trash.bulk.blockingCombos", {
                      labels: e.blockingCombos
                        .map(
                          (c) =>
                            c.memo?.trim() ||
                            t("trash.warning.unnamedCombo", { id: c.id }),
                        )
                        .join(t("trash.bulk.failedSeparator")),
                    })}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {warnedItems.length > 0 && (
        <div role="status" className="w-full text-sm text-amber-700">
          <p className="font-medium">
            {t("trash.warning.bulkDetailHeading", { count: warnedItems.length })}
          </p>
          <ul className="list-disc pl-5">
            {warnedItems.map((item) => (
              <li key={item.key}>{formatBulkRestoreDetail(item, t)}</li>
            ))}
          </ul>
        </div>
      )}
      {/* ★結果は次の一括操作まで残る。閉じる手段が無いと、利用者は消し方が判らない。 */}
      {hasResult && (
        <button
          type="button"
          onClick={() => {
            setErrors([]);
            setWarnedItems([]);
          }}
          className="text-sm text-slate-500 underline hover:text-slate-700"
        >
          {t("trash.warning.dismissResult")}
        </button>
      )}
      <PermanentDeleteConfirm
        open={confirmOpen}
        count={totalCount}
        onConfirm={handleBulkPermanentDelete}
        onOpenChange={(open) => { if (!open) setConfirmOpen(false); }}
      />
    </div>
  );
}

// ★i18n 化しない。ここで組み立てた文字列は FailedItem.error に入るだけで画面へは
// 出ない(表示されるのは reason である)。診断用の値である。
function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : "unknown error";
}

/**
 * 拒否応答から「利用者へ見せる理由」と「掴んでいるコンボ」を取り出す。
 *
 * ★★行単位(TrashSetupListRow.tsx の handlePermanentDelete)と同じ分岐にしてある。
 *   409 は 2 種類あり、ステータスではなく code で分けること
 *   (DES-006 §11.2 / CHANGE-115 §2-c)。文言も行単位と同じ鍵を使う——
 *   同じ拒否が画面の場所によって違う言葉で出ると、利用者は別の事象だと読む。
 */
function resolveFailure(
  reason: unknown,
  t: (key: string) => string,
  /** どの操作の失敗かで既定の文言が変わる。★新しい汎用鍵を作らず既存を使う。 */
  fallbackKey: string,
): { reason: string; blockingCombos: BlockingCombos | null } {
  const code = reason instanceof ApiError ? reason.body?.error?.code : undefined;

  if (code === API_ERROR_CODE_SETUP_IN_USE) {
    const details =
      reason instanceof ApiError
        ? (reason.body?.error?.details as WarningDetails | undefined)
        : undefined;
    return {
      reason: t("trash.setup.inUse"),
      blockingCombos: details?.combos ?? null,
    };
  }
  if (code === API_ERROR_CODE_SETUP_NOT_IN_TRASH) {
    return { reason: t("trash.setup.notInTrash"), blockingCombos: null };
  }
  return { reason: t(fallbackKey), blockingCombos: null };
}

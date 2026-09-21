import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { TableCell, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { ApiError } from "@/features/combo/api";
import {
  API_ERROR_CODE_SETUP_IN_USE,
  API_ERROR_CODE_SETUP_NOT_IN_TRASH,
} from "@/constants/api-error";
import type { WarningDetails } from "@/features/combo/types";
import type { SetupResponse } from "../types";
import { useRestoreSetup } from "../hooks/useRestoreSetup";
import { useDeleteSetupLink } from "../hooks/useSetupLinks";
import { usePermanentDeleteSetup } from "../hooks/usePermanentDeleteSetup";
import { TrashSetupDeleteConfirm } from "./TrashSetupDeleteConfirm";
import { formatRestoreWarnings } from "@/features/trash/restoreWarnings";

// コンボ側 TrashListRow の formatDeletedAt と同じ書式に揃える。
function formatDeletedAt(deletedAt: string): string {
  const d = new Date(deletedAt);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface Props {
  setup: SetupResponse;
  selected: boolean;
  onSelectionChange: (id: number, selected: boolean) => void;
  onSetupChanged: () => void;
}

export function TrashSetupListRow({
  setup,
  selected,
  onSelectionChange,
  onSetupChanged,
}: Props) {
  const { t } = useTranslation();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);
  // ★解除の完了は「エラー」ではない。rowError(赤)へ混ぜると、成功した操作が
  //   失敗のように見える。別の状態として持つ。
  const [rowNotice, setRowNotice] = useState<string | null>(null);
  // ★★M23-07 §4.3: 完全削除を拒まれたときの逃げ道。
  //   拒否応答の details.combos をそのまま持つ(新しくデータを取りに行かない)。
  //   ★解除して空になっても自動で完全削除を再実行しない(§4.3-3)。利用者にもう一度
  //   押させる——解除の結果を見てから決められるようにするためである。
  const [blockingCombos, setBlockingCombos] = useState<
    NonNullable<WarningDetails["combos"]> | null
  >(null);
  const restoreMutation = useRestoreSetup();
  const permanentDeleteMutation = usePermanentDeleteSetup();
  const unlinkMutation = useDeleteSetupLink();

  const deletedAt = setup.deletedAt ?? null;
  // ★★defaultRecipe へのフォールバックが、ここで初めて到達する(M23-06 §4.3)。
  //   論理削除時に recipe_cache を物理削除しているため、削除済み行の defaultRecipe は
  //   従来ずっと空文字であり、名前の無いセットプレイは全部「(名称未設定)」で並んでいた。
  //   ⇒ サーバ側が setup_steps から組み立て直して defaultRecipe を埋めるようにした
  //   (ListDeletedSetups)。★フロントで組み立て直さないこと——表記はプリセット・
  //   エイリアスに依存し(DES-004)、規則を 2 か所に持つと必ずドリフトする(E-76)。
  // ★★ここがコンボの「ルート列」と答えが分かれる箇所である。コンボは memo と始動状況で
  //   識別できるが、セットプレイは名前が空だと識別手段がゼロになる。完全削除は不可逆
  //   であり、取り違えは取り返しがつかない。
  // ★steps が 0 件のセットプレイでは defaultRecipe が空文字で返る。そのときは従来どおり
  //   「(名称未設定)」へ落ちる——行は壊れない。
  // ★判定と描画で同じ値を使う(trim 後)。分けると、前後に空白のある名前で
  //   行の表示と一括復元の内訳のラベル(TrashBulkActions.setupLabel)が食い違う。
  const trimmedName = setup.name?.trim();
  const label = trimmedName || setup.defaultRecipe || t("trash.setup.unnamed");

  const handleRestore = async () => {
    try {
      setRowError(null);
      setRowNotice(null);
      const restored = await restoreMutation.mutateAsync(setup.id);
      // ★警告はエラーではない。復元は成功しているので、完了トーストと一緒に出す
      //   (DES-006 §11.1 / 指示書 §4.4)。★モーダルにしない。
      // ★0 件のときは warnings キー自体が無い。空配列で来ることはない(§4.3-2)。
      // ★★警告が無くても完了トーストを出す(M23-06 §4.6-1)。コンボ側の単件復元と揃える。
      // ★警告があるときは 1 枚に畳む。完了と警告で 2 枚出さない。
      const warnings = restored.warnings ?? [];
      if (warnings.length > 0) {
        toast.warning(
          t("trash.warning.restoredWithWarnings", {
            warnings: formatRestoreWarnings(warnings, t),
          }),
        );
      } else {
        toast.success(t("trash.warning.restored"));
      }
      onSetupChanged();
    } catch {
      setRowError(t("trash.setup.restoreError"));
    }
  };

  // ★拒否されたことは必ず利用者へ届ける(M23-02 §4.4-3c)。押しても無反応だと、削除できたのか
  //   壊れたのか判別できず、同じ操作を繰り返すことになる。
  //
  // ★★M23-07 §4.3-1 で参照元コンボを列挙するようにした(D-485 の上書き)。
  //   D-485 は「拒否されたことが伝われば足りる」としたが、★拒否されたあとに
  //   紐付けを解除する導線が画面に無く、拒否された利用者は詰んでいた。
  //   ⇒ どのコンボが参照しているかを見せ、そこから解除できるようにする。
  const handlePermanentDelete = async () => {
    try {
      setRowError(null);
      setRowNotice(null);
      setBlockingCombos(null);
      await permanentDeleteMutation.mutateAsync(setup.id);
      setConfirmOpen(false);
      onSetupChanged();
    } catch (err: unknown) {
      setConfirmOpen(false);
      // ★409 は 2 種類ある。ステータスで分岐せず code で分ける
      //   (DES-006 §11.2 / CHANGE-115 §2-c)。
      const code = err instanceof ApiError ? err.body?.error?.code : undefined;
      if (code === API_ERROR_CODE_SETUP_IN_USE) {
        setRowError(t("trash.setup.inUse"));
        const details = err instanceof ApiError
          ? (err.body?.error?.details as WarningDetails | undefined)
          : undefined;
        setBlockingCombos(details?.combos ?? []);
      } else if (code === API_ERROR_CODE_SETUP_NOT_IN_TRASH) {
        setRowError(t("trash.setup.notInTrash"));
      } else {
        setRowError(t("trash.setup.permanentDeleteError"));
      }
    }
  };

  // ★★解除は「そのコンボからの紐付けを外す」であって「そのコンボを消す」ではない
  //   (§4.3-2)。既存の紐付け解除 API を使う(新しい API を作らない・§4.3)。
  // ★解除の後に完全削除を自動で再実行しない(§4.3-3)。
  const handleUnlink = (comboId: number) => {
    unlinkMutation.mutate(
      { comboId, setupId: setup.id },
      {
        onSuccess: () => {
          setBlockingCombos((prev) => (prev ?? []).filter((c) => c.id !== comboId));
          setRowError(null);
          // ★もう一度押させる。自動で完全削除を再実行しない(§4.3-3)——解除の結果を
          //   見てから決められるようにするためである。
          setRowNotice(t("trash.setup.unlinkDoneRetryHint"));
        },
        onError: () => {
          setRowNotice(null);
          setRowError(t("trash.setup.unlinkError"));
        },
      },
    );
  };

  return (
    <>
      <TableRow>
        <TableCell className="align-middle">
          <Checkbox
            checked={selected}
            onCheckedChange={(checked) => onSelectionChange(setup.id, checked === true)}
            aria-label={t("trash.setup.columnSelect", { id: setup.id })}
          />
        </TableCell>
        <TableCell className="break-all text-slate-700">{label}</TableCell>
        <TableCell className="tabular-nums text-slate-600">
          {deletedAt ? formatDeletedAt(deletedAt) : "-"}
        </TableCell>
        <TableCell className="whitespace-nowrap">
          <button
            type="button"
            onClick={handleRestore}
            disabled={restoreMutation.isPending}
            className="mr-3 text-blue-600 hover:underline disabled:opacity-50"
          >
            {t("trash.setup.restore")}
          </button>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={permanentDeleteMutation.isPending}
            className="text-red-600 hover:underline disabled:opacity-50"
          >
            {t("trash.setup.permanentDelete")}
          </button>
        </TableCell>
      </TableRow>
      {rowError && (
        <TableRow>
          <TableCell colSpan={4}>
            <div role="alert" className="px-3 py-1 text-sm text-red-600">
              {rowError}
            </div>
          </TableCell>
        </TableRow>
      )}
      {rowNotice && (
        <TableRow>
          <TableCell colSpan={4}>
            <div role="status" className="px-3 py-1 text-sm text-slate-700">
              {rowNotice}
            </div>
          </TableCell>
        </TableRow>
      )}
      {blockingCombos && blockingCombos.length > 0 && (
        <TableRow>
          <TableCell colSpan={4}>
            <div
              className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
              data-testid="setup-in-use-combos"
            >
              {/* ★文言で「コンボを消すのではない」ことを伝える(§4.3-2)。 */}
              <p className="mb-2">{t("trash.setup.unlinkHeading")}</p>
              <ul className="space-y-1">
                {blockingCombos.map((combo) => (
                  <li key={combo.id} className="flex items-center justify-between gap-3">
                    <span className="break-all">
                      {combo.memo?.trim() || t("trash.warning.unnamedCombo", { id: combo.id })}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleUnlink(combo.id)}
                      disabled={unlinkMutation.isPending}
                      className="whitespace-nowrap rounded border border-amber-400 px-2 py-0.5 text-xs text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                    >
                      {t("trash.setup.unlinkAction")}
                    </button>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-amber-800">
                {t("trash.setup.unlinkNote")}
              </p>
            </div>
          </TableCell>
        </TableRow>
      )}
      <TrashSetupDeleteConfirm
        open={confirmOpen}
        onConfirm={handlePermanentDelete}
        onOpenChange={(open) => {
          if (!open) setConfirmOpen(false);
        }}
      />
    </>
  );
}

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCharacters } from "@/features/character/hooks/useCharacters";
import { useExportCombo } from "../api";
import {
  formatExportBaseName,
  issueExportBaseName,
  sanitizeExportBaseName,
} from "../export-filename";
import { EXPORT_IMAGE_WARN_COUNT } from "../export-data";
import {
  EXPORT_ITEMS,
  VISUAL_EXPORT_ITEMS,
  DEFAULT_SELECTED_ITEMS,
  type ExportItemKey,
} from "../export-items";
import { runExport, type ExportFormat } from "../run-export";
import {
  droppedCount,
  isTruncated,
  type ExportObservation,
} from "../export-truncation";

const FORMAT_VALUES: ExportFormat[] = ["csv", "pdf", "png", "clipboard"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** エクスポート対象のコンボ ID(呼び出し側で「選択中」/「現フィルタ全件」を解決済み)。 */
  comboIds: number[];
  /** true = 選択中コンボを対象、false = 現フィルタ結果の全件を対象(WYSIWYG)。ダイアログの説明文に使う。 */
  isSelectionActive: boolean;
  /**
   * 対象範囲に一致する総数(上限を掛けない数)。
   *
   * ★★comboIds.length と別に受け取る理由(M29-02 §2.1) —— 一覧は BE 側で
   * 上限にクランプされるため、comboIds は「載った分」でしかない。
   * 総数を知らないと「全件のつもりが一部だった」を検出できず、黙って切り捨てる。
   */
  comboTotalCount: number;
}

// 本ダイアログは既存の生成関数(resolveExportCombos/exportComboImage/clipboard.ts/useExportCombo)を
// そのまま呼び出す呼び出し元であり、生成ロジック自体は新規実装しない(M17-05b)。
// ★M24-06 でエクスポート画面(ComboExportPage・/export/combo)を廃止したため、
//   出力の入口は本ダイアログだけになった(旧「温存対象のため変更しない」は失効)。
export default function ExportDialog({
  open,
  onOpenChange,
  comboIds,
  isSelectionActive,
  comboTotalCount,
}: Props) {
  const { t } = useTranslation();
  const [formats, setFormats] = useState<Set<ExportFormat>>(
    () => new Set(["csv"]),
  );
  const [selectedItems, setSelectedItems] = useState<Set<ExportItemKey>>(
    () => new Set(DEFAULT_SELECTED_ITEMS),
  );
  const [busy, setBusy] = useState(false);
  // ★上限で切り捨てるときに出す確認(開発者選択の鳴らし方 (c)「件数を示して選ばせる」)。
  //   null = 確認待ちではない。
  const [truncationConfirm, setTruncationConfirm] =
    useState<ExportObservation | null>(null);
  // 外側のファイル名(拡張子を除く。SM-075・M24-06 §4.4)。
  // ★自動生成値を初期値として入れた編集可能な欄にする(D-592)。
  //   「毎回入力させる」でも「後で OS 上で変えてもらう」でもない。
  // ★利用者が書き換えたら尊重する(SM-088 と同じ作法)。書き換えていない間は
  //   対象・件数の変化に追従し、出力のたびに採り直して衝突を避ける。
  const [baseNameEdited, setBaseNameEdited] = useState(false);
  const [baseName, setBaseName] = useState("");

  const { data: characters } = useCharacters();
  const exportCsv = useExportCombo();

  // 名前に載せる対象の種別。★ワイヤ値は常に "selected"(§5.13a の WYSIWYG 契約)だが、
  //   利用者から見た対象は「選択中」か「現フィルタ結果」かで違うため、名前はそれを表す。
  const namingRange = isSelectionActive ? "selected" : "filter";

  // ★ダイアログは常時マウントされている(一覧が open だけを切り替える)。
  //   ⇒ 開くたびに「書き換えた」印を落とさないと、一度触った名前が以後ずっと
  //     使い回され、連続エクスポートで衝突し、対象・件数にも追従しなくなる。
  useEffect(() => {
    if (!open) return;
    setBaseNameEdited(false);
  }, [open]);

  useEffect(() => {
    if (!open || baseNameEdited) return;
    setBaseName(
      formatExportBaseName({ range: namingRange, count: comboIds.length }),
    );
  }, [open, baseNameEdited, namingRange, comboIds.length]);

  const hasClipboard = formats.has("clipboard");
  const hasNonClipboard = FORMAT_VALUES.some(
    (f) => f !== "clipboard" && formats.has(f),
  );
  const isVisualFormat =
    formats.has("pdf") || formats.has("png") || formats.has("clipboard");
  // M17-05c-fix(§5.13a・案B): 視覚形式のみ選択時は 15 項目(video/image を出さない)、
  // CSV を含む選択時は 17 項目(CSV には出るため)。「チェック ON なのに視覚出力に出ない」不一致を避ける。
  const visibleItems = formats.has("csv") ? EXPORT_ITEMS : VISUAL_EXPORT_ITEMS;

  const formatLabel: Record<ExportFormat, string> = {
    csv: t("export.dialog.formatCsv"),
    pdf: t("export.dialog.formatPdf"),
    png: t("export.dialog.formatPng"),
    clipboard: t("export.dialog.formatClipboard"),
  };

  const toggleFormat = (format: ExportFormat) => {
    setFormats((prev) => {
      const next = new Set(prev);
      if (next.has(format)) {
        next.delete(format);
      } else {
        next.add(format);
      }
      return next;
    });
  };

  const toggleItem = (key: ExportItemKey) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleOpenChange = (next: boolean) => {
    if (!next && busy) return; // 実行中は閉じない
    if (!next) {
      // ★閉じたら確認を捨てる(レビュー 中)。捨てないと、次に開いたときに
      //   「確認済み」の状態が残っていて、切り捨てるのに黙って出力してしまう。
      setTruncationConfirm(null);
    }
    onOpenChange(next);
  };

  // 送信前の観測。★対象範囲の総数と、実際に出せる件数を比べる。
  //   ここで比べないと、切り捨ては出力が終わったあとにしか分からない。
  const preflight: ExportObservation = {
    total: comboTotalCount,
    included: comboIds.length,
    reimportBlocked: false,
  };

  const handleRun = async () => {
    if (formats.size === 0) {
      toast.error(t("export.dialog.noFormatSelected"));
      return;
    }
    // ★★(c) 件数を示して選ばせる —— 黙って切り捨てず、続けるかを利用者が決める。
    //   確認済み(truncationConfirm が立っている)なら素通しする。
    if (isTruncated(preflight) && truncationConfirm === null) {
      setTruncationConfirm(preflight);
      return;
    }
    setTruncationConfirm(null);
    setBusy(true);
    // 書き換えられていれば尊重し、そうでなければその場で採り直す。
    // ★採り直すのは、ダイアログを開いたまま 2 回出したときに同じ名前になるのを避けるため
    //   (書式は秒までしか持たない。issueExportBaseName が同一秒の連番を見分ける)。
    const typed = sanitizeExportBaseName(baseName);
    const effectiveBaseName =
      baseNameEdited && typed !== ""
        ? typed
        : issueExportBaseName({ range: namingRange, count: comboIds.length });
    // 実際に使った名前を欄へ戻す(何という名前で保存されたかを読めるようにする)。
    setBaseName(effectiveBaseName);
    try {
      const { results } = await runExport({
        formats,
        exportParams: { range: "selected", ids: comboIds },
        selectedItems,
        characters,
        baseName: effectiveBaseName,
        exportCsv: exportCsv.mutateAsync,
        imageWarnCount: EXPORT_IMAGE_WARN_COUNT,
        onImageWarn: (count) =>
          toast.warning(t("export.toast.imageWarnCount", { count })),
        // ★出力後の観測。送信前の確認とは別に必ず残す —— 送信前に見えるのは
        //   FE が知っている数だけであり、BE 側の上限は BE しか知らない。
        onTruncated: (o) =>
          toast.warning(
            t("export.toast.truncated", {
              dropped: droppedCount(o),
              total: o.total,
              included: o.included,
            }),
          ),
        onReimportBlocked: () =>
          toast.warning(t("export.toast.reimportBlocked")),
      });

      const succeeded = results
        .filter((r) => r.status === "success")
        .map((r) => formatLabel[r.format]);
      const failed = results
        .filter((r) => r.status === "error")
        .map((r) => formatLabel[r.format]);
      const allEmpty =
        results.length > 0 && results.every((r) => r.status === "empty");

      if (allEmpty) {
        toast.error(t("export.toast.empty"));
      } else if (failed.length === 0) {
        toast.success(t("export.toast.success", { formats: succeeded.join("・") }));
        onOpenChange(false);
      } else if (succeeded.length > 0) {
        toast.warning(
          t("export.toast.partialFailure", { formats: failed.join("・") }),
        );
      } else {
        toast.error(t("export.toast.allFailed"));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("export.dialog.title")}</DialogTitle>
          <DialogDescription>
            {isSelectionActive
              ? t("export.dialog.targetSelected", { count: comboIds.length })
              : t("export.dialog.targetAll", { count: comboIds.length })}
          </DialogDescription>
        </DialogHeader>

        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">
            {t("export.dialog.formatLabel")}
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {FORMAT_VALUES.map((format) => {
              const disabled =
                format === "clipboard" ? hasNonClipboard : hasClipboard;
              return (
                <label
                  key={format}
                  className="flex items-center gap-2 text-sm"
                  title={
                    disabled
                      ? t("export.dialog.clipboardExclusiveHint")
                      : undefined
                  }
                >
                  <Checkbox
                    checked={formats.has(format)}
                    disabled={disabled}
                    onCheckedChange={() => toggleFormat(format)}
                    data-testid={`export-format-${format}`}
                  />
                  <span className={disabled ? "text-slate-400" : undefined}>
                    {formatLabel[format]}
                  </span>
                </label>
              );
            })}
          </div>
          {formats.has("png") && (
            <p className="text-xs text-slate-500" data-testid="export-png-limit-hint">
              {t("export.dialog.pngLimitHint")}
            </p>
          )}
        </fieldset>

        <div className="space-y-1">
          <Label htmlFor="export-file-name" className="text-sm font-semibold">
            {t("export.dialog.fileNameLabel")}
          </Label>
          <Input
            id="export-file-name"
            value={baseName}
            onChange={(e) => {
              setBaseNameEdited(true);
              setBaseName(e.target.value);
            }}
            data-testid="export-file-name"
            className="font-mono text-xs"
          />
          <p className="text-xs text-slate-500">
            {t("export.dialog.fileNameHint")}
          </p>
        </div>

        {isVisualFormat && (
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold">
              {t("export.dialog.itemsLabel")}
            </legend>
            <div className="grid gap-1 sm:grid-cols-2 max-h-48 overflow-y-auto">
              {visibleItems.map((item) => (
                <label
                  key={item.key}
                  className="flex items-center gap-2 text-sm cursor-pointer"
                >
                  <Checkbox
                    checked={selectedItems.has(item.key)}
                    onCheckedChange={() => toggleItem(item.key)}
                    data-testid={`export-item-${item.key}`}
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {/* ★★上限で切り捨てるときの確認(鳴らし方 (c))。黙って一部だけ出さない。
            ダイアログの中に出すのは、出力ボタンのすぐ手前で読ませるためである。 */}
        {truncationConfirm !== null && (
          <div
            role="alert"
            data-testid="export-truncation-confirm"
            className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
          >
            {t("export.truncation.body", {
              total: truncationConfirm.total,
              included: truncationConfirm.included,
              dropped: droppedCount(truncationConfirm),
            })}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              if (truncationConfirm !== null) {
                // ★確認を出している間の「キャンセル」は出力の取りやめであって
                //   ダイアログを閉じることではない。選び直せるようにする。
                setTruncationConfirm(null);
                return;
              }
              handleOpenChange(false);
            }}
            disabled={busy}
          >
            {t("export.dialog.cancel")}
          </Button>
          <Button
            type="button"
            onClick={handleRun}
            disabled={busy || formats.size === 0 || comboIds.length === 0}
          >
            {busy
              ? t("export.dialog.running")
              : truncationConfirm !== null
                ? t("export.truncation.proceed")
                : t("export.dialog.run")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

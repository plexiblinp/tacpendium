import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";

import Header from "@/components/Header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useImportComboCommit,
  useImportComboPreview,
} from "@/features/combo-io/api";
import { ImportCommitConfirmDialog } from "@/features/combo-io/components/ImportCommitConfirmDialog";
import { formatIssue } from "@/features/combo-io/formatIssue";
import {
  countExcludedDrafts,
  isDraftExcluded,
  isImportSelectable,
} from "@/features/combo-io/import-draft";
import {
  rowNeedsConfirmation,
  type ComboImportCommitResponse,
  type ComboImportPreviewResponse,
  type ComboPreviewRow,
  type DupAction,
} from "@/features/combo-io/types";
import { usePreviewNames } from "@/features/combo-io/usePreviewNames";

// 重複時の選択肢(B-6)。配列 map で描画するため要素数に依存しない。
// 将来「上書き(M13-i 繰越)」を足す場合は DupAction 型(types.ts)に "overwrite" を加え、
// ここに 1 要素 push するだけで 3 択化できる(現状は UI 非表示=構造のみ予約)。
const DUP_OPTIONS: { value: DupAction; label: string }[] = [
  { value: "skip", label: "スキップ(既定)" },
  { value: "setups_only", label: "セットプレイのみ取込" },
];

// 画面14: インポート(DES-005 §5.14)。入口は「zip または コンボ CSV(セットプレイ CSV 同時可)」に
// 一本化(B-1)。セットプレイ CSV はコンボ CSV に添付する従属欄で、単独取込はできない
// (parent_combo_local_id はコンボを指すため単独では必ず失敗する成立しない入力)。
export default function ComboImportPage() {
  const { t } = useTranslation();
  const [comboFile, setComboFile] = useState<File | null>(null);
  const [setupFile, setSetupFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ComboImportPreviewResponse | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [dupAction, setDupAction] = useState<DupAction>("skip");
  const [report, setReport] = useState<ComboImportCommitResponse | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const previewM = useImportComboPreview();
  const commitM = useImportComboCommit();
  const names = usePreviewNames(preview);

  // プレビュー結果は mutate の per-call onSuccess ではなく previewM.data を購読して反映する。
  // 他から引っ越しからの自動プレビューは StrictMode の二重マウントで per-call コールバックが
  // 落ちることがあるため、成功データを直接見て state に反映する(手動プレビューも同経路)。
  const lastPreviewData = useRef<ComboImportPreviewResponse | null>(null);
  useEffect(() => {
    if (previewM.isSuccess && previewM.data && previewM.data !== lastPreviewData.current) {
      lastPreviewData.current = previewM.data;
      setPreview(previewM.data);
      const init: Record<string, boolean> = {};
      // 既定で取込可能行を全チェック。★仮登録は外す(SM-071・M24-06 §4.1)。
      for (const r of previewM.data.combos) init[r.localId] = isImportSelectable(r);
      setChecked(init);
    }
  }, [previewM.isSuccess, previewM.data]);

  // 他から引っ越し(M17-04)から navigate 経由で渡された CSV を、開いた直後に一度だけ
  // 自動プレビューする(既存の検証・重複判定 UI をそのまま再利用する連携口)。
  // 発火は setTimeout + cleanup 越しに行う: StrictMode(dev)の二重マウントで、
  // 使い捨てされる 1 回目のマウントで mutation を撃つと observer が外れて isPending が
  // 固まるため、cleanup で撃ち直し、生き残るマウントの mutation だけを走らせる。
  // previewM は ref 経由で参照し、effect の依存を安定な intakeCsvText のみにする。
  const location = useLocation();
  const [intakeCsvText] = useState<string | null>(
    () => (location.state as { intakeCsvText?: string } | null)?.intakeCsvText ?? null,
  );
  const previewMRef = useRef(previewM);
  previewMRef.current = previewM;
  useEffect(() => {
    if (!intakeCsvText) return;
    const file = new File([intakeCsvText], "intake-combos.csv", { type: "text/csv" });
    setComboFile(file);
    setSetupFile(null);
    setReport(null);
    const id = setTimeout(() => {
      previewMRef.current.mutate({ comboFile: file, setupFile: null });
    }, 0);
    return () => clearTimeout(id);
  }, [intakeCsvText]);

  const resetResults = () => {
    setPreview(null);
    setChecked({});
    setReport(null);
    lastPreviewData.current = null;
  };

  const handlePreview = () => {
    if (!comboFile) return; // 送信前ガード: コンボ CSV 必須(セットプレイ単独は成立しない)
    setReport(null);
    previewM.mutate({ comboFile, setupFile });
  };

  const selectedLocalIds = useMemo(
    () =>
      preview
        ? preview.combos
            .filter((r) => isImportSelectable(r) && checked[r.localId])
            .map((r) => r.localId)
        : [],
    [preview, checked],
  );

  // 仮登録のため除外した行数(画面へ出す。判定は import-draft.ts に閉じている)。
  const excludedDraftCount = useMemo(
    () => (preview ? countExcludedDrafts(preview.combos) : 0),
    [preview],
  );

  // 取込完了レポートへ自動スクロールする(B-5)。
  const reportRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (report) {
      reportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [report]);

  // ★確認ダイアログ(SM-121・§4.6)を通ってから走る。ボタンの押下では直接呼ばない。
  const handleCommit = () => {
    setConfirmOpen(false);
    if (!comboFile || selectedLocalIds.length === 0) return; // 送信前ガード
    commitM.mutate(
      { comboFile, setupFile, selected: selectedLocalIds, dupAction },
      {
        onSuccess: (data) => {
          setReport(data);
          // B-5: 完了トースト(成功/スキップ/エラーの件数要約)。
          toast.success(
            `取込完了: 成功 ${data.summary.success} 件 / スキップ ${data.summary.skipped} 件 / エラー ${data.summary.failed} 件`,
          );
        },
      },
    );
  };

  const toggleAll = (next: boolean) => {
    if (!preview) return;
    const updated: Record<string, boolean> = {};
    for (const r of preview.combos) updated[r.localId] = isImportSelectable(r) && next;
    setChecked(updated);
  };

  // 親 local_id(B-4 で非表示)の代わりに、セットプレイの親コンボを表示名で示す。
  const comboByLocal = useMemo(() => {
    const m = new Map<string, ComboPreviewRow>();
    for (const c of preview?.combos ?? []) m.set(c.localId, c);
    return m;
  }, [preview]);

  const parentLabel = (parentLocalId: string): string => {
    const c = comboByLocal.get(parentLocalId);
    if (!c) return parentLocalId; // 解決不可時のみ生の親参照(B-3 と一貫=手がかり)
    const chara = names.resolveCharacter(c.characterCode);
    const starter = c.starterMoveCode
      ? names.resolveMove(c.characterCode, c.starterMoveCode)
      : "";
    return starter ? `${chara} / ${starter}` : chara;
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <Header />
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold">取込(CSV)</h1>
          <p className="text-sm text-slate-600 mt-1">
            コンボ CSV(または zip)を読み込み、プレビューで確認してから取り込みます。
            エクスポートした zip をそのままコンボ CSV 欄に指定すると自動展開します。
            セットプレイ CSV はコンボ CSV に添付して同時に取り込めます。
          </p>
        </div>

        {/* ファイル選択(入口は「zip または コンボ CSV(+ 任意でセットプレイ CSV)」に一本化) */}
        <div className="grid gap-3 sm:grid-cols-2 max-w-3xl">
          <div className="space-y-1">
            <Label htmlFor="comboFile">コンボ CSV / zip(必須)</Label>
            <Input
              id="comboFile"
              type="file"
              accept=".csv,.zip"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setComboFile(f);
                if (!f) setSetupFile(null); // コンボ CSV 無しでセットプレイ単独を残さない
                resetResults();
              }}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="setupFile">セットプレイ CSV(コンボ CSV に添付・任意)</Label>
            <Input
              id="setupFile"
              type="file"
              accept=".csv"
              disabled={!comboFile}
              onChange={(e) => {
                setSetupFile(e.target.files?.[0] ?? null);
                resetResults();
              }}
            />
            {!comboFile && (
              <p className="text-xs text-slate-500">
                コンボ CSV を選ぶと添付できます(セットプレイのみの取込はできません)。
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handlePreview} disabled={!comboFile || previewM.isPending}>
            {previewM.isPending ? "解析中…" : "プレビュー"}
          </Button>
          {/* コンボ CSV 未選択時はプレビュー不可。理由を明示する(無音の無効化を避ける)。 */}
          {!comboFile && (
            <p className="text-sm text-amber-700" role="status">
              コンボ CSV(または zip)を選択するとプレビューできます。
            </p>
          )}
        </div>

        {previewM.isError && (
          <p className="text-sm text-red-600" role="alert">
            プレビューに失敗しました: {previewM.error.message}
          </p>
        )}
        {preview?.comboFileError && (
          <p className="text-sm text-red-600" role="alert">
            コンボ CSV を取り込めません: {formatIssue(preview.comboFileError, 0, t)}
          </p>
        )}
        {preview?.setupFileError && (
          <p className="text-sm text-red-600" role="alert">
            セットプレイ CSV を取り込めません: {formatIssue(preview.setupFileError, 0, t)}
          </p>
        )}

        {/* コンボプレビュー */}
        {preview && preview.combos.length > 0 && (
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-600">
                {preview.combos.length} 行中 {selectedLocalIds.length} 行を取込対象に選択中
                (OK {preview.summary.comboOk} / 警告 {preview.summary.comboWarning} / エラー{" "}
                {preview.summary.comboError})
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => toggleAll(true)}>
                  全選択
                </Button>
                <Button variant="outline" size="sm" onClick={() => toggleAll(false)}>
                  全解除
                </Button>
                <Button
                  onClick={() => setConfirmOpen(true)}
                  disabled={selectedLocalIds.length === 0 || commitM.isPending}
                >
                  {commitM.isPending ? "取込中…" : "取込実行"}
                </Button>
              </div>
            </div>

            {/* 仮登録の除外件数(SM-071・M24-06 §4.1)。★黙って減らさない
                = 出さないと「取り込んだつもりの行が入っていない」が起きる。 */}
            {excludedDraftCount > 0 && (
              <p
                className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800"
                data-testid="import-draft-excluded"
              >
                仮登録の {excludedDraftCount} 行を取込対象から除外しました(仮登録は取り込みません)。
              </p>
            )}

            {/* 実行中の進行表示(B-5・無音にしない) */}
            {commitM.isPending && (
              <p className="text-sm text-slate-600" role="status">
                取込中… 完了までお待ちください。
              </p>
            )}

            {/* 重複時の動作(B-6。skip / セットプレイのみ取込。配列 map=要素数非依存) */}
            <fieldset className="flex flex-wrap items-center gap-4 text-sm">
              <legend className="sr-only">重複時の動作</legend>
              <span className="text-slate-600">重複時:</span>
              {DUP_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-1">
                  <input
                    type="radio"
                    name="dupAction"
                    checked={dupAction === opt.value}
                    onChange={() => setDupAction(opt.value)}
                  />
                  {opt.label}
                </label>
              ))}
            </fieldset>

            <div className="overflow-x-auto rounded border border-slate-200 bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" aria-label="選択" />
                    <TableHead>キャラ</TableHead>
                    <TableHead>始動技</TableHead>
                    <TableHead className="text-right">ステップ</TableHead>
                    <TableHead>仮登録</TableHead>
                    <TableHead>要確認 / エラー</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.combos.map((r) => {
                    const highlight = rowNeedsConfirmation(r) || r.duplicate;
                    return (
                      <TableRow
                        key={r.localId}
                        data-needs-confirmation={highlight}
                        className={highlight ? "bg-amber-50" : undefined}
                      >
                        <TableCell>
                          <Checkbox
                            checked={!!checked[r.localId]}
                            disabled={!isImportSelectable(r)}
                            onCheckedChange={(v) =>
                              setChecked((prev) => ({ ...prev, [r.localId]: v === true }))
                            }
                            aria-label={`${r.rowNumber}行目を取込対象にする`}
                          />
                        </TableCell>
                        <TableCell>{names.resolveCharacter(r.characterCode)}</TableCell>
                        <TableCell>
                          {r.starterMoveCode
                            ? names.resolveMove(r.characterCode, r.starterMoveCode)
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right">{r.stepCount}</TableCell>
                        <TableCell>{r.isDraft ? "○" : "—"}</TableCell>
                        <TableCell className="space-x-1 space-y-1">
                          {isDraftExcluded(r) && (
                            <Badge variant="secondary">仮登録のため取込対象外</Badge>
                          )}
                          {r.duplicate && (
                            <IssueBadge
                              raw={
                                r.warnings.find((w) => w.includes("VAL-C02")) ??
                                `既存コンボ(ID ${r.duplicateComboId ?? "?"})と重複(VAL-C02)`
                              }
                              row={r.rowNumber}
                              variant="secondary"
                              label={`既存コンボ(ID ${r.duplicateComboId ?? "?"})と重複`}
                            />
                          )}
                          {/* 重複警告(VAL-C02)は上の専用バッジで表示済みのため一般 warnings からは除く */}
                          {r.warnings
                            .filter((w) => !w.includes("VAL-C02"))
                            .map((w, i) => (
                              <IssueBadge key={`w${i}`} raw={w} row={r.rowNumber} variant="secondary" />
                            ))}
                          {r.errors.map((err, i) => (
                            <IssueBadge key={`e${i}`} raw={err} row={r.rowNumber} variant="destructive" />
                          ))}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </section>
        )}

        {/* 0 件ファイル(SM-076・M24-06 §4.2)。
            ★「0 件」の定義 = コンボ CSV 自体は受理された(comboFileError なし)が、
              取り込める行が 1 行も無い状態。空ファイルとヘッダ行だけの CSV は
              どちらも BE が FileError を立てずに 0 行を返すため、ここへ落ちる。
            ★全行エラーは 0 件ではない(行は返るので上の表が理由を説明する)。 */}
        {preview && !preview.comboFileError && preview.combos.length === 0 && (
          <section
            className="rounded border border-dashed border-slate-300 bg-white px-4 py-6 text-center"
            data-testid="import-empty-preview"
          >
            <p className="text-sm font-medium text-slate-700">
              取り込めるコンボ行がありません(0 件)。
            </p>
            <p className="mt-1 text-xs text-slate-500">
              ファイルが空か、見出し行だけの可能性があります。
            </p>
          </section>
        )}

        {/* セットプレイプレビュー(親コンボに追従して取り込まれる・参照表示) */}
        {preview && preview.setups.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-base font-semibold">
              セットプレイ({preview.setups.length} 件・選択コンボに紐づいて取込)
            </h2>
            <div className="overflow-x-auto rounded border border-slate-200 bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>親コンボ</TableHead>
                    <TableHead>名称</TableHead>
                    <TableHead className="text-right">ステップ</TableHead>
                    <TableHead>親解決</TableHead>
                    <TableHead>要確認 / エラー</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.setups.map((r) => {
                    const highlight = rowNeedsConfirmation(r) || !r.parentResolvable;
                    return (
                      <TableRow
                        key={`${r.rowNumber}`}
                        className={highlight ? "bg-amber-50" : undefined}
                      >
                        <TableCell>{parentLabel(r.parentComboLocalId)}</TableCell>
                        <TableCell>{r.name || "—"}</TableCell>
                        <TableCell className="text-right">{r.stepCount}</TableCell>
                        <TableCell>{r.parentResolvable ? "○" : "×"}</TableCell>
                        <TableCell className="space-x-1 space-y-1">
                          {r.warnings.map((w, i) => (
                            <IssueBadge key={`w${i}`} raw={w} row={r.rowNumber} variant="secondary" />
                          ))}
                          {r.errors.map((err, i) => (
                            <IssueBadge key={`e${i}`} raw={err} row={r.rowNumber} variant="destructive" />
                          ))}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </section>
        )}

        {commitM.isError && (
          <p className="text-sm text-red-600" role="alert">
            取込に失敗しました: {commitM.error.message}
          </p>
        )}

        {/* 行単位レポート */}
        {report && (
          <section className="space-y-2" aria-label="取込結果" ref={reportRef}>
            <h2 className="text-lg font-semibold">取込結果</h2>
            <p className="text-sm text-slate-700">
              成功 {report.summary.success} / スキップ {report.summary.skipped} / 失敗{" "}
              {report.summary.failed}
            </p>
            <div className="overflow-x-auto rounded border border-slate-200 bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>種別</TableHead>
                    <TableHead className="text-right">行</TableHead>
                    <TableHead>結果</TableHead>
                    <TableHead>理由</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.results.map((res, i) => (
                    <TableRow key={`${res.kind}-${res.rowNumber}-${i}`}>
                      <TableCell>{res.kind === "combo" ? "コンボ" : "セットプレイ"}</TableCell>
                      <TableCell className="text-right">{res.rowNumber}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            res.status === "created"
                              ? "default"
                              : res.status === "failed"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {res.status === "created"
                            ? "取込"
                            : res.status === "failed"
                              ? "失敗"
                              : "スキップ"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{res.reason || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        )}
      </div>

      {/* 取込実行の確認(SM-121・M24-06 §4.6)。DB へ行を作る取り消せない操作のため。 */}
      <ImportCommitConfirmDialog
        open={confirmOpen}
        targetCount={selectedLocalIds.length}
        excludedDraftCount={excludedDraftCount}
        onOpenChange={setConfirmOpen}
        onConfirm={handleCommit}
      />
    </main>
  );
}

// IssueBadge は検証メッセージを日本語で表示し、折りたたみ(詳細)で VAL コードの原文を残す(B-2)。
// label 指定時はそれを表示ラベルにし、raw(VAL コードを含む原文)は折りたたみに残す
// (BE が日本語で埋め込んだ重複警告など、[VAL-CODE] 形式でない文言の VAL コードを畳むため)。
function IssueBadge({
  raw,
  row,
  variant,
  label,
}: {
  raw: string;
  row: number;
  variant: "secondary" | "destructive";
  label?: string;
}) {
  const { t } = useTranslation();
  const shown = label ?? formatIssue(raw, row, t);
  return (
    <details className="inline-block align-top" data-testid="import-issue">
      <summary className="list-none cursor-pointer">
        <Badge variant={variant}>{shown}</Badge>
      </summary>
      <div className="mt-1 font-mono text-[10px] text-slate-500 break-all">{raw}</div>
    </details>
  );
}

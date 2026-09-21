import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

import { withExtension } from "./export-filename";
import {
  parseExportObservation,
  type ExportObservation,
} from "./export-truncation";

import type {
  ComboImportCommitResponse,
  ComboImportPreviewResponse,
  DupAction,
  ExportRange,
} from "./types";

// multipart/form-data の POST。api-client の fetchJSON は Content-Type を固定するため
// FormData(境界をブラウザが設定)では使えない。生 fetch を使う(import 機能と同方針)。
async function postMultipart<T>(path: string, body: FormData): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    body,
    credentials: "same-origin",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

// ExportParams は export 対象指定(クエリパラメータへ変換)。
//
// ★M24-06 で /export/combo を廃止したため、FE から実際に発行されるのは
//   { range: "selected", ids } だけになった(§5.13a のダイアログが唯一の呼び出し元)。
//   range=all/filter/mycombo と characterId / tagIds / position / hitType /
//   opponentStance / isDraft は FE からは到達しない。
// ★それでも残すのは、これが DES-002 §4.2 の GET /api/export/csv の契約そのものであり、
//   BE 側(internal/service/comboio/export.go)が今も 4 値を受理するためである。
//   ⇒ 型を削ると「BE が受けるのに FE から表現できない」非対称が見えなくなる。
export interface ExportParams {
  range: ExportRange;
  characterId?: number | null;
  tagIds?: number[];
  position?: string | null;
  hitType?: string | null;
  opponentStance?: string | null;
  isDraft?: boolean | null;
  ids?: number[]; // range=selected 時
}

function buildExportQuery(params: ExportParams): string {
  const q = new URLSearchParams();
  q.set("range", params.range);
  if (params.characterId != null) q.set("characterId", String(params.characterId));
  if (params.tagIds && params.tagIds.length > 0)
    q.set("tagIds", params.tagIds.join(","));
  if (params.position) q.set("position", params.position);
  if (params.hitType) q.set("hitType", params.hitType);
  if (params.opponentStance) q.set("opponentStance", params.opponentStance);
  if (params.isDraft != null) q.set("isDraft", String(params.isDraft));
  if (params.ids && params.ids.length > 0) q.set("ids", params.ids.join(","));
  return q.toString();
}

// ExportCsvVariables は zip ダウンロードの入力。
// ★baseName は拡張子を除いた外側のファイル名(SM-075・M24-06 §4.4)。
//   ZIP の中のエントリ名(combos.csv / setups.csv)には及ぼさない
//   = DES-002 §7.6 の契約であり、変えると往復対称が壊れる。
export interface ExportCsvVariables {
  params: ExportParams;
  baseName: string;
}

// useExportCombo は対象コンボ + 紐づくセットプレイを zip でダウンロードする。
//
// ★★戻り値に観測を載せる(M29-02 §2.1) —— 着手前は上限で切り捨てても
// サーバ側の slog にしか出ず、利用者は一部だけのファイルを完全なものと信じていた。
// 本体は zip のバイト列で JSON の警告欄を混ぜられないため、BE は応答ヘッダで運ぶ。
export function useExportCombo() {
  return useMutation<ExportObservation | null, Error, ExportCsvVariables>({
    mutationFn: async ({ params, baseName }) => {
      const res = await fetch(`/api/export/csv?${buildExportQuery(params)}`, {
        method: "GET",
        credentials: "same-origin",
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      // ★blob() より前にヘッダを読む(本文を読み切ったあとでも読めるが、
      //   順序を固定して「読み忘れ」が起きにくい形にする)。
      const observation = parseExportObservation(res.headers);
      const blob = await res.blob();
      // ★BE も Content-Disposition を返すが FE は読んでいない(a.download が優先される)。
      //   ここが外側のファイル名を決める唯一の場所である。
      triggerDownload(blob, withExtension(baseName, "zip"));
      return observation;
    },
  });
}

// triggerDownload は Blob をブラウザのダウンロードとして発火する。
// PDF/PNG エクスポート(M13-02)でも再利用するため公開する。
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// useImportComboPreview はコンボ CSV(+任意セットプレイ CSV / zip)をプレビュー取得する(DB 書込なし)。
export function useImportComboPreview() {
  return useMutation<
    ComboImportPreviewResponse,
    Error,
    { comboFile: File; setupFile?: File | null }
  >({
    mutationFn: ({ comboFile, setupFile }) => {
      const fd = new FormData();
      fd.append("combo_file", comboFile);
      if (setupFile) fd.append("setup_file", setupFile);
      return postMultipart<ComboImportPreviewResponse>(
        "/api/import/csv/preview",
        fd,
      );
    },
  });
}

// useImportComboCommit は選択 local_id を取り込み、行単位レポートを得る。成功後に combos キャッシュを無効化する。
export function useImportComboCommit() {
  const qc = useQueryClient();
  return useMutation<
    ComboImportCommitResponse,
    Error,
    {
      comboFile: File;
      setupFile?: File | null;
      selected: string[];
      dupAction: DupAction;
    }
  >({
    mutationFn: ({ comboFile, setupFile, selected, dupAction }) => {
      const fd = new FormData();
      fd.append("combo_file", comboFile);
      if (setupFile) fd.append("setup_file", setupFile);
      fd.append("selected", JSON.stringify(selected));
      fd.append("dupAction", dupAction);
      return postMultipart<ComboImportCommitResponse>("/api/import/csv", fd);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.combos.all() });
    },
  });
}

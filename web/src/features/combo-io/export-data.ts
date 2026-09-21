// PDF/PNG/クリップボード出力の対象コンボ(ComboDetail[])をフロント側で取得する。
// 対象選択(全/フィルタ/選択/マイコンボ)は M13-01(CSV)と共通だが、CSV はバックエンド生成
// (/api/export/csv)であるのに対し、本サブは「フロント生成」のため、既存の参照系エンドポイント
// (GET /api/combos で ID 解決 → GET /api/combos/{id} で setups/steps 込みの詳細)から取得する。
// 新規 BE エンドポイント・サーバ FS 書込は作らない(DES-002 §4.2 / M13-RESEARCH-02 含意)。

import { fetchJSON } from "@/lib/api-client";
import { MAX_EXPORT_SELECTION } from "@/constants/export";
import type { ComboDetail, ComboListResponse } from "@/features/combo/types";
import type { ExportParams } from "./api";
import type { ExportObservation } from "./export-truncation";

// PNG 出力で、これを超える件数は canvas 上限(16384px)に達しうる(= PNG 生成が失敗する)。
// M17-05c 実測(2026-07-18・Chromium): 比較表は幅 = max(720, 160 + n*360)CSS px・pixelRatio=2 で
// n=23 のとき canvas 幅 16880px > 16384px となり capture がスローする(n=22 は 16160px で可)。
// 単独出力(1 件)は 720×~1121px で上限に届かない。よってハードエラーの手前 22 で事前警告し、
// PDF(M17-05c で自動ページ分割・上限に当たらない)での出力を促す。
// なお PDF はページ分割されるため本警告は PNG 選択時のみ発火させる(run-export.ts の needsImageWarn)。
export const EXPORT_IMAGE_WARN_COUNT = 22;

// list 応答は setups を含まない(combo dto: 詳細取得時のみ)。同梱には詳細取得が必須。
function buildListQuery(params: ExportParams): string {
  const q = new URLSearchParams();
  switch (params.range) {
    case "filter":
      if (params.characterId != null)
        q.set("character_id", String(params.characterId));
      if (params.position) q.set("position", params.position);
      if (params.hitType) q.set("hit_type", params.hitType);
      if (params.opponentStance)
        q.set("opponent_stance", params.opponentStance);
      if (params.isDraft != null) q.set("is_draft", String(params.isDraft));
      break;
    case "mycombo":
      if (params.tagIds && params.tagIds.length > 0)
        q.set("tag_ids", params.tagIds.join(","));
      break;
    case "all":
    default:
      break;
  }
  return q.toString();
}

/**
 * 対象選択(range)から対象コンボ ID と、上限を掛けない総数を解決する。
 *
 * ★★limit を明示して送る理由(M29-02 §2.1) —— 送らないと BE のリポジトリ既定
 * 100 件が効き、「全件」出力のつもりが黙って 100 件で切れていた。これは
 * 上限の変更ではない: 設計上の上限は MAX_EXPORT_SELECTION = BE の
 * exportRowLimit = csvcore.DefaultMaxRows で 1000 に揃っており、100 は
 * 「limit を送り忘れた結果たまたま効いていたリポジトリ既定」である。
 * ⇒ 意図した上限を実際に効かせ、超過分は total との差で観測する。
 */
export async function resolveComboIds(
  params: ExportParams,
): Promise<{ ids: number[]; observation: ExportObservation }> {
  if (params.range === "selected") {
    const ids = params.ids ?? [];
    // ★選択経路の総数は「利用者が選んだ数」である。選択自体が
    //   MAX_EXPORT_SELECTION で頭打ちされる(useSelectMode)ため通常は一致する。
    return {
      ids,
      observation: {
        total: ids.length,
        included: ids.length,
        reimportBlocked: false,
      },
    };
  }
  const qs = buildListQuery(params);
  const sep = qs ? "&" : "";
  const path = `/api/combos?${qs}${sep}limit=${MAX_EXPORT_SELECTION}`;
  const res = await fetchJSON<ComboListResponse>(path);
  const ids = res.items.map((item) => item.id);
  return {
    ids,
    observation: {
      // ★total が無い応答(古い BE)では ids の数へ倒す。嘘の「切り捨てました」を
      //   出さないためである。⇒ 観測できないことを「切り捨て無し」と断定はするが、
      //   それは BE 側のヘッダ観測(parseExportObservation)が別に効く。
      total: res.total ?? ids.length,
      included: ids.length,
      reimportBlocked: false,
    },
  };
}

/** 対象コンボの詳細(setups/steps 込み)を取得する。 */
export async function fetchComboDetails(
  ids: number[],
): Promise<ComboDetail[]> {
  return Promise.all(
    ids.map((id) => fetchJSON<ComboDetail>(`/api/combos/${id}`)),
  );
}

/**
 * range → ID 解決 → 詳細取得 をまとめて行う。
 *
 * ★観測(observation)も返す。返さないと FE 生成の書出(PDF/PNG/クリップボード)は
 * 切り捨てに気づけないままになる —— 着手前がその状態だった(M29-02 §2.1)。
 */
export async function resolveExportCombos(
  params: ExportParams,
): Promise<{ combos: ComboDetail[]; observation: ExportObservation }> {
  const { ids, observation } = await resolveComboIds(params);
  const combos = await fetchComboDetails(ids);
  return { combos, observation };
}

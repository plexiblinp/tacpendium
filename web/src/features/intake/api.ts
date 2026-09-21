import { useMutation } from "@tanstack/react-query";

import { fetchJSON } from "@/lib/api-client";

import type {
  IntakeBuildCsvRequest,
  IntakeBuildCsvResponse,
  IntakeResolveRequest,
  IntakeResolveResponse,
} from "./types";

// useIntakeResolve は貼付テキスト(① プロンプト出力)を ② 厳密照合する(POST /api/intake/resolve)。
// 未解決は未解決のまま返る(フォールバックしない)。未投入・不明キャラでも 200(壊れない)。
export function useIntakeResolve() {
  return useMutation<IntakeResolveResponse, Error, IntakeResolveRequest>({
    mutationFn: (req) =>
      fetchJSON<IntakeResolveResponse>("/api/intake/resolve", {
        method: "POST",
        body: JSON.stringify(req),
      }),
  });
}

// useIntakeBuildCsv は解決済みコンボ群から取込 CSV(combos.csv)を生成する(POST /api/intake/csv)。
// 返った CSV を既存 import プレビュー動線へ乗せる(検証・重複判定を迂回しない)。
export function useIntakeBuildCsv() {
  return useMutation<IntakeBuildCsvResponse, Error, IntakeBuildCsvRequest>({
    mutationFn: (req) =>
      fetchJSON<IntakeBuildCsvResponse>("/api/intake/csv", {
        method: "POST",
        body: JSON.stringify(req),
      }),
  });
}

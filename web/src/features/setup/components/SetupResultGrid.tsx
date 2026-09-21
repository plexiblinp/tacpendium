import { useTranslation } from "react-i18next";
import { Check, Minus, X } from "lucide-react";

import { OKI_TECH_TYPES, OKI_TECH_TYPE_LABEL_KEYS, type OkiTechType } from "@/constants/oki";
import {
  SETUP_IN_CORNER_VALUES,
  SETUP_RESULT_NG,
  SETUP_RESULT_OK,
  SETUP_RESULT_UNVERIFIED,
  setupResultCellKey,
  type SetupResultState,
} from "@/constants/setup-result";
import type { SetupResultCell } from "../types";

// セットプレイ成立条件の 2×2 グリッド(表示専用・M19-03 §4.4.2)。
//
//                その場受け身    後ろ受け身
//   画面中央         ○             ×
//   相手が画面端     ○             —
//
// - 全 4 セルが未検証なら要素自体を出さない(hidden-when-empty＝項目9 と同じ流儀)。
// - 記号直書きではなくアイコンで描く(○/× は日本語圏の慣習で英語圏では ✓/✗ が自然＝
//   i18n サーフェスとして扱う)。読み上げ用のラベルは i18n から解決する。
// - 4 セルの集計は出さない(条件ごとの可否が意味を持ち、集計値に意味はない)。

// resultStateOf は 1 セルの表示状態を返す。行が無い = 未検証。
export function resultStateOf(
  results: SetupResultCell[] | undefined,
  techType: string,
  inCorner: boolean,
): SetupResultState {
  const hit = results?.find((r) => r.techType === techType && r.inCorner === inCorner);
  return hit ? hit.result : SETUP_RESULT_UNVERIFIED;
}

// noteOf は 1 セルの note を返す(未検証・note なしは null)。
export function noteOf(
  results: SetupResultCell[] | undefined,
  techType: string,
  inCorner: boolean,
): string | null {
  const hit = results?.find((r) => r.techType === techType && r.inCorner === inCorner);
  return hit?.note ?? null;
}

// hasAnyResult は 4 セルのうち 1 つでも検証済みかを返す(hidden-when-empty の判定)。
export function hasAnyResult(results: SetupResultCell[] | undefined): boolean {
  return (results?.length ?? 0) > 0;
}

interface StateIconProps {
  state: SetupResultState;
}

// SetupResultStateIcon は 3 状態のアイコン。凡例・グリッド・編集で共用する。
export function SetupResultStateIcon({ state }: StateIconProps) {
  const { t } = useTranslation();
  if (state === SETUP_RESULT_OK) {
    return (
      <Check
        className="h-4 w-4 text-emerald-600"
        role="img"
        aria-label={t("setupResult.state.ok")}
        data-testid="setup-result-icon-ok"
      />
    );
  }
  if (state === SETUP_RESULT_NG) {
    return (
      <X
        className="h-4 w-4 text-red-600"
        role="img"
        aria-label={t("setupResult.state.ng")}
        data-testid="setup-result-icon-ng"
      />
    );
  }
  return (
    <Minus
      className="h-4 w-4 text-slate-400"
      role="img"
      aria-label={t("setupResult.state.unverified")}
      data-testid="setup-result-icon-unverified"
    />
  );
}

// LEGEND_STATES_ALL は凡例の既定の並び(三値)。
const LEGEND_STATES_ALL: SetupResultState[] = [
  SETUP_RESULT_OK,
  SETUP_RESULT_NG,
  SETUP_RESULT_UNVERIFIED,
];

// SetupResultLegend は凡例(初見で読めないため近くに置く＝§4.4.2)。
//
// states は出す状態を絞るための任意指定。既定は三値で、コンボ詳細の表示・編集
// (項目10)はこれを使う。登録時の入力(M19-07)は不成立を選べないため
// [ok, unverified] を渡す ——選べない状態を凡例に出すと「不成立も付けられる」
// と誤読される。
export function SetupResultLegend({
  states = LEGEND_STATES_ALL,
}: { states?: SetupResultState[] } = {}) {
  const { t } = useTranslation();
  return (
    <p
      className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500"
      data-testid="setup-result-legend"
    >
      {states.map((state) => (
        <span key={state} className="flex items-center gap-1">
          <SetupResultStateIcon state={state} />
          {t(`setupResult.state.${state}`)}
        </span>
      ))}
    </p>
  );
}

// cornerLabelKey は画面端ラベルの i18n キー。combos.position の表示ラベル
// (画面中央 / 相手画面端 …)と矛盾しない表現にする(§4.6 / §3.3-6)。
export function cornerLabelKey(inCorner: boolean): string {
  return inCorner ? "setupResult.corner.inCorner" : "setupResult.corner.midScreen";
}

interface Props {
  results?: SetupResultCell[];
}

export function SetupResultGrid({ results }: Props) {
  const { t } = useTranslation();

  // hidden-when-empty: 全 4 セル未検証なら本要素を出さない。
  if (!hasAnyResult(results)) return null;

  return (
    <div className="space-y-1" data-testid="setup-result-grid">
      <p className="text-xs text-gray-500">{t("setupResult.heading")}</p>
      <table className="text-xs">
        <thead>
          <tr>
            <th className="px-2 py-1 text-left font-normal text-slate-500">
              <span className="sr-only">{t("setupResult.axisLabel")}</span>
            </th>
            {OKI_TECH_TYPES.map((techType: OkiTechType) => (
              <th key={techType} className="px-2 py-1 font-normal text-slate-500">
                {t(OKI_TECH_TYPE_LABEL_KEYS[techType])}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SETUP_IN_CORNER_VALUES.map((inCorner) => (
            <tr key={String(inCorner)}>
              <th className="px-2 py-1 text-left font-normal text-slate-500">
                {t(cornerLabelKey(inCorner))}
              </th>
              {OKI_TECH_TYPES.map((techType: OkiTechType) => {
                const state = resultStateOf(results, techType, inCorner);
                const note = noteOf(results, techType, inCorner);
                return (
                  <td
                    key={setupResultCellKey({ techType, inCorner })}
                    className="px-2 py-1"
                    data-testid={`setup-result-cell-${setupResultCellKey({ techType, inCorner })}`}
                    data-state={state}
                    title={note ?? undefined}
                  >
                    <span className="flex items-center gap-1">
                      <SetupResultStateIcon state={state} />
                      {note && (
                        <span
                          className="text-[10px] text-slate-400"
                          data-testid="setup-result-note-mark"
                          aria-label={t("setupResult.noteMark")}
                        >
                          *
                        </span>
                      )}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <SetupResultLegend />
    </div>
  );
}

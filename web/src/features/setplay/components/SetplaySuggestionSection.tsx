import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ApiError } from "@/features/combo/api";
import { useMovesByCharacter } from "@/features/moves/api";
import { setupApi } from "@/features/setup/api/setupApi";
import type { CreateSetupInput, SetupResultCondition } from "@/features/setup/types";
// M19-03 §4.5: 採用時の「確認できた条件」。M19-07 追補で、項目10 と同じ 2×2 グリッドを
// 描く共有コンポーネントへ寄せた(語彙・セルの組・i18n キーはそちらが正典を参照する)。
import { VerifiedConditionsField } from "@/features/setup/components/VerifiedConditionsField";
import { queryKeys } from "@/lib/query-keys";

import { buildAdoptedSetupName } from "../adoptName";

import type { GetSuggestionsParams } from "../api/setplayApi";
import { useSetplaySuggestions } from "../hooks/useSetplaySuggestions";
import {
  DEFAULT_TARGET_TYPES,
  GAP_G_MAX,
  GAP_G_MIN,
  REASON_KNOCKDOWN_NEGATIVE,
  SETPLAY_DEFAULT_LIMIT,
  SETPLAY_LIMIT_INCREMENT,
  SETPLAY_MAX_LIMIT,
  TARGET_TYPE_ORDER,
  type SetplayMode,
  type SetplaySort,
  type SetplaySuggestion,
  type SetplayTargetType,
} from "../types";
import { SetplayLimitationNotice } from "./SetplayLimitationNotice";
import { SetplayTargetPicker } from "./SetplayTargetPicker";

interface Props {
  comboId: number;
  characterId: number;
  // KA(未入力=null)。null のときは提案セクションを出さず理由のみ表示する(§4.6.1)。
  knockdownAdvantage: number | null;
  onAdopted?: () => void;
}

export function SetplaySuggestionSection({
  comboId,
  characterId,
  knockdownAdvantage,
  onAdopted,
}: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // 条件(未適用)。適用は「提案を出す」で applied へ確定する(#1)。
  const [nMin, setNMin] = useState(1);
  const [nMax, setNMax] = useState(0); // 0 = 上限なし(meaty のみ)。
  const [sort, setSort] = useState<SetplaySort>("n");
  const [selectedTypes, setSelectedTypes] = useState<Set<SetplayTargetType>>(
    () => new Set(DEFAULT_TARGET_TYPES),
  );
  const [includeZeroDamage, setIncludeZeroDamage] = useState(false);
  const [targetMoveId, setTargetMoveId] = useState<number | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  // モード(重ねる/あえて重ねない)と gap の G 範囲(§4.4)。
  const [mode, setMode] = useState<SetplayMode>("meaty");
  const [gMin, setGMin] = useState(GAP_G_MIN);
  const [gMax, setGMax] = useState(GAP_G_MAX);
  const [applied, setApplied] = useState<GetSuggestionsParams | null>(null);
  // 不採用にした提案(結果から消す)。検索(提案を出す)ごとにリセットする。
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const hasKnockdown = knockdownAdvantage != null;
  const suggestionsQ = useSetplaySuggestions(comboId, hasKnockdown ? applied : null);
  const movesQ = useMovesByCharacter(characterId);

  const nameByMoveId = useMemo(() => {
    const map = new Map<number, string>();
    for (const m of movesQ.data ?? []) {
      map.set(m.id, m.nameJa ?? m.code);
    }
    return map;
  }, [movesQ.data]);

  const displayName = (moveId: number, code: string) =>
    nameByMoveId.get(moveId) ?? code;

  if (!hasKnockdown) {
    return (
      <section
        className="rounded-lg border border-slate-200 bg-white p-4"
        data-testid="setplay-section"
      >
        <h2 className="mb-2 text-lg font-semibold">{t("setplay.heading")}</h2>
        <p className="text-sm text-slate-500" data-testid="setplay-no-knockdown">
          {t("setplay.noKnockdown")}
        </p>
      </section>
    );
  }

  const toggleType = (type: SetplayTargetType) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const runSearch = () => {
    setDismissed(new Set()); // 新しい検索では不採用をリセット。
    setApplied({
      nMin,
      nMax,
      sort,
      targetTypes: Array.from(selectedTypes),
      includeZeroDamage,
      targetMoveId,
      mode,
      gMin,
      gMax,
      limit: SETPLAY_DEFAULT_LIMIT,
    });
  };

  // 「さらに表示」: limit を増やして再取得(不採用状態は維持)。
  const showMore = () => {
    setApplied((prev) =>
      prev == null
        ? prev
        : { ...prev, limit: Math.min(prev.limit + SETPLAY_LIMIT_INCREMENT, SETPLAY_MAX_LIMIT) },
    );
  };

  const data = suggestionsQ.data;
  const items = data?.items ?? [];
  const visibleItems = items.filter((s) => !dismissed.has(suggestionKey(s)));
  const usingSpecificMove = targetMoveId != null;
  const isGap = mode === "gap";
  const isNegativeKnockdown = data?.reason === REASON_KNOCKDOWN_NEGATIVE;
  const totalFound = data?.totalFound ?? 0;
  // 全件表示済みでなく、上限にも達していないときだけ「さらに表示」を出す。
  const canShowMore =
    applied != null && items.length < totalFound && applied.limit < SETPLAY_MAX_LIMIT;

  return (
    <section
      className="rounded-lg border border-slate-200 bg-white p-4"
      data-testid="setplay-section"
    >
      <h2 className="mb-2 text-lg font-semibold">{t("setplay.heading")}</h2>
      <p className="mb-2 text-xs text-slate-500">{t("setplay.description")}</p>

      <SetplayLimitationNotice />

      {/* 条件パネル(#1: 提案を出すまで検索しない) */}
      <div className="mb-3 space-y-3 rounded border border-slate-100 bg-slate-50 p-3 text-sm">
        {/* 種別チェック(#2)。特定の技を選択中は無効化(明示指定が優先)。 */}
        <fieldset
          disabled={usingSpecificMove}
          data-testid="setplay-type-fieldset"
          className={usingSpecificMove ? "opacity-50" : ""}
        >
          <legend className="mb-1 text-xs font-medium text-slate-600">
            {t("setplay.targetTypeLegend")}
          </legend>
          <div className="flex flex-wrap gap-3">
            {TARGET_TYPE_ORDER.map((type) => (
              <label key={type} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={selectedTypes.has(type)}
                  onChange={() => toggleType(type)}
                  data-testid={`setplay-type-${type}`}
                />
                {t(`setplay.targetType.${type}`)}
              </label>
            ))}
          </div>
          <label className="mt-2 flex items-center gap-1">
            <input
              type="checkbox"
              checked={includeZeroDamage}
              onChange={(e) => setIncludeZeroDamage(e.target.checked)}
              data-testid="setplay-include-zero-damage"
            />
            {t("setplay.includeZeroDamage")}
          </label>
        </fieldset>

        {/* 特定の技から探す(#4) */}
        <div>
          <button
            type="button"
            className="text-xs text-blue-700 hover:underline"
            onClick={() => setShowPicker((v) => !v)}
          >
            {t("setplay.pickTargetToggle")}
          </button>
          {showPicker && (
            <div className="mt-1">
              <SetplayTargetPicker
                characterId={characterId}
                value={targetMoveId}
                onChange={setTargetMoveId}
              />
            </div>
          )}
        </div>

        {/* モード切替(重ねる/あえて重ねない)。既定は重ねる(既存挙動)。 */}
        <div className="flex items-center gap-1" data-testid="setplay-mode">
          <span className="text-slate-600">{t("setplay.modeLabel")}</span>
          <button
            type="button"
            onClick={() => setMode("meaty")}
            aria-pressed={mode === "meaty"}
            data-testid="setplay-mode-meaty"
            className={`rounded px-2 py-1 ${mode === "meaty" ? "bg-blue-600 text-white" : "border border-slate-300 text-slate-700"}`}
          >
            {t("setplay.modeMeaty")}
          </button>
          <button
            type="button"
            onClick={() => setMode("gap")}
            aria-pressed={mode === "gap"}
            data-testid="setplay-mode-gap"
            className={`rounded px-2 py-1 ${mode === "gap" ? "bg-blue-600 text-white" : "border border-slate-300 text-slate-700"}`}
          >
            {t("setplay.modeGap")}
          </button>
        </div>

        {/* N_min(meaty)/ G 範囲(gap)/ ソート */}
        <div className="flex flex-wrap items-center gap-4">
          {isGap ? (
            <div className="flex items-center gap-1" data-testid="setplay-gap-range">
              <span className="text-slate-600">{t("setplay.gapRangeLabel")}</span>
              <input
                type="number"
                min={GAP_G_MIN}
                max={GAP_G_MAX}
                value={gMin}
                onChange={(e) =>
                  setGMin(Math.min(GAP_G_MAX, Math.max(GAP_G_MIN, Number(e.target.value) || GAP_G_MIN)))
                }
                className="w-16 rounded border border-slate-300 px-2 py-1"
                aria-label={t("setplay.gapMinLabel")}
              />
              <span className="text-slate-400">–</span>
              <input
                type="number"
                min={GAP_G_MIN}
                max={GAP_G_MAX}
                value={gMax}
                onChange={(e) =>
                  setGMax(Math.min(GAP_G_MAX, Math.max(GAP_G_MIN, Number(e.target.value) || GAP_G_MAX)))
                }
                className="w-16 rounded border border-slate-300 px-2 py-1"
                aria-label={t("setplay.gapMaxLabel")}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1">
                  <span className="text-slate-600">{t("setplay.nMinLabel")}</span>
                  <input
                    type="number"
                    min={1}
                    value={nMin}
                    onChange={(e) => setNMin(Math.max(1, Number(e.target.value) || 1))}
                    className="w-16 rounded border border-slate-300 px-2 py-1"
                    aria-label={t("setplay.nMinLabel")}
                  />
                </label>
                <label className="flex items-center gap-1">
                  <span className="text-slate-600">{t("setplay.nMaxLabel")}</span>
                  <input
                    type="number"
                    min={0}
                    value={nMax}
                    onChange={(e) => setNMax(Math.max(0, Number(e.target.value) || 0))}
                    className="w-16 rounded border border-slate-300 px-2 py-1"
                    aria-label={t("setplay.nMaxLabel")}
                    data-testid="setplay-n-max"
                    placeholder="—"
                  />
                </label>
              </div>
              {/* n_max<n_min は受理帯が空になり結果 0 件。押す前に理由を明示する。 */}
              {nMax > 0 && nMax < nMin && (
                <p className="text-xs text-amber-600" data-testid="setplay-n-max-hint">
                  {t("setplay.nMaxBelowMinHint")}
                </p>
              )}
            </div>
          )}
          <div className="flex items-center gap-1">
            <span className="text-slate-600">{t("setplay.sortLabel")}</span>
            <button
              type="button"
              onClick={() => setSort("n")}
              aria-pressed={sort === "n"}
              className={`rounded px-2 py-1 ${sort === "n" ? "bg-blue-600 text-white" : "border border-slate-300 text-slate-700"}`}
            >
              {t("setplay.sortByN")}
            </button>
            <button
              type="button"
              onClick={() => setSort("target")}
              aria-pressed={sort === "target"}
              className={`rounded px-2 py-1 ${sort === "target" ? "bg-blue-600 text-white" : "border border-slate-300 text-slate-700"}`}
            >
              {t("setplay.sortByTarget")}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={runSearch}
            data-testid="setplay-generate"
            className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            {t("setplay.generate")}
          </button>
          {/* 特定技選択中のみ表示。押すと種別欄が再活性化する(#3)。 */}
          {usingSpecificMove && (
            <button
              type="button"
              onClick={() => setTargetMoveId(null)}
              data-testid="setplay-clear-move"
              className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
            >
              {t("setplay.clearSelectedMove")}
            </button>
          )}
        </div>
      </div>

      {applied == null && (
        <p className="text-sm text-slate-500">{t("setplay.notSearched")}</p>
      )}

      {applied != null && suggestionsQ.isLoading && (
        <p className="text-sm text-slate-500">{t("setplay.loading")}</p>
      )}
      {applied != null && suggestionsQ.isError && (
        <p className="text-sm text-red-600">{t("setplay.error")}</p>
      )}
      {/* 負 KA(有利フレームがマイナス)は専用文言(KA NULL の noKnockdown とは区別)。 */}
      {applied != null && !suggestionsQ.isLoading && !suggestionsQ.isError && isNegativeKnockdown && (
        <p className="text-sm text-slate-500" data-testid="setplay-negative-knockdown">
          {t("setplay.negativeKnockdown")}
        </p>
      )}
      {applied != null &&
        !suggestionsQ.isLoading &&
        !suggestionsQ.isError &&
        !isNegativeKnockdown &&
        visibleItems.length === 0 && (
          <p className="text-sm text-slate-500">{t("setplay.empty")}</p>
        )}

      {applied != null && visibleItems.length > 0 && (
        <>
          {/* 件数表示(§4.3.4)。totalFound = ランキング対象の総解数。 */}
          <p className="mb-2 text-xs text-slate-500" data-testid="setplay-count">
            {t("setplay.countLabel", { total: totalFound, shown: visibleItems.length })}
          </p>
          <ul className="space-y-2">
            {visibleItems.map((s) => {
              const key = suggestionKey(s);
              return (
                <SuggestionRow
                  key={key}
                  suggestion={s}
                  comboId={comboId}
                  characterId={characterId}
                  displayName={displayName}
                  onAdopted={() => {
                    void queryClient.invalidateQueries({
                      queryKey: queryKeys.setplaySuggestions.all(),
                    });
                    onAdopted?.();
                  }}
                  onReject={() =>
                    setDismissed((prev) => {
                      const next = new Set(prev);
                      next.add(key);
                      return next;
                    })
                  }
                />
              );
            })}
          </ul>
          {/* さらに表示(全件表示済み・上限到達時は出さない)。 */}
          {canShowMore && (
            <button
              type="button"
              onClick={showMore}
              data-testid="setplay-show-more"
              className="mt-2 rounded border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
            >
              {t("setplay.showMore")}
            </button>
          )}
        </>
      )}

      {/* 安全上限到達(数え切れていない)ときのみ。limit で切っただけの状態とは区別する。 */}
      {applied != null && data?.truncated && (
        <p className="mt-2 text-xs text-amber-600" data-testid="setplay-truncated">
          {t("setplay.truncated")}
        </p>
      )}
    </section>
  );
}

// suggestionKey は不採用の識別・React key 用の安定キー(レシピの moveId 列 + N)。
function suggestionKey(s: SetplaySuggestion): string {
  return s.steps.map((st) => st.moveId).join("-") + "#" + s.n;
}

interface RowProps {
  suggestion: SetplaySuggestion;
  comboId: number;
  characterId: number;
  displayName: (moveId: number, code: string) => string;
  onAdopted: () => void;
  onReject: () => void;
}

function SuggestionRow({
  suggestion,
  comboId,
  characterId,
  displayName,
  onAdopted,
  onReject,
}: RowProps) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [duplicate, setDuplicate] = useState(false);
  // M19-03 §4.5: 「確認できた条件」。既定は全て未チェックで、チェックせずに採用できる。
  // 記録するのは成立(ok)のみ ——「使えたから登録する」動作であり、不成立の記録と note は
  // 後から項目10 側で行う。
  const [confirmed, setConfirmed] = useState<SetupResultCondition[]>([]);

  const recipe = suggestion.steps
    .map((st) => displayName(st.moveId, st.code))
    .join(" > ");

  // ★★M24-05(SM-088): 規則そのものは変えていない。adoptName.ts へ切り出しただけである
  //   ——指示書 §5.1 が純粋関数テストを、§5.3 の破壊確認 3 が「止めると赤くなる」ことを
  //   求めており、インラインのままではどちらも書けなかった(＝成立が固定されない)。
  const generatedName = buildAdoptedSetupName(suggestion, displayName, (vars) =>
    t("setplay.adoptNameFormat", vars),
  );

  const createMutation = useMutation({
    mutationFn: (input: CreateSetupInput) => setupApi.create(comboId, input),
    onSuccess: () => {
      setEditing(false);
      setDuplicate(false);
      onAdopted();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) {
        setDuplicate(true);
      }
    },
  });

  const startAdopt = () => {
    setName(generatedName);
    setDuplicate(false);
    setConfirmed([]); // 既定は全て未チェック
    setEditing(true);
  };

  const confirmAdopt = () => {
    createMutation.mutate({
      characterId,
      name: name.trim(),
      description: null,
      steps: suggestion.steps.map((st) => ({ moveId: st.moveId })),
      // チェックされたセルのみを成立(ok)として同送する。空配列でも採用できる。
      // 保存はセットプレイ作成(setups + setup_steps + combo_setups)と同一トランザクション
      // で行われる ——紐付けが作られる前に結果行は書かれない(§4.5)。
      // VerifiedConditionsField が SETUP_RESULT_CELLS 順で組むため並びは従来と同一。
      verifiedConditions: confirmed,
    });
  };

  return (
    <li
      className="rounded border border-slate-200 px-3 py-2 text-sm"
      data-testid="setplay-row"
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <span className="font-mono">{recipe}</span>
          {/* meaty は N(持続番号)、gap は G(起き上がり後の隙間)を表示。S は非表示のまま。 */}
          <span className="ml-2 text-xs text-blue-700" data-testid="setplay-frame-label">
            {suggestion.mode === "gap"
              ? t("setplay.gapBeforeWakeup", { g: suggestion.g })
              : t("setplay.hitOnActive", { n: suggestion.n })}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {suggestion.alreadyAdopted ? (
            <span
              className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500"
              data-testid="setplay-adopted"
            >
              {t("setplay.adopted")}
            </span>
          ) : (
            !editing && (
              <button
                type="button"
                onClick={startAdopt}
                data-testid="setplay-adopt"
                className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
              >
                {t("setplay.adopt")}
              </button>
            )
          )}
          {!editing && (
            <button
              type="button"
              onClick={onReject}
              data-testid="setplay-reject"
              className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
            >
              {t("setplay.reject")}
            </button>
          )}
        </div>
      </div>

      {editing && !suggestion.alreadyAdopted && (
        <div className="mt-2 space-y-1">
          <label className="block text-xs text-slate-600">
            {t("setplay.adoptNameLabel")}
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
              aria-label={t("setplay.adoptNameLabel")}
            />
          </label>
          {/* M19-03 §4.5: 「確認できた条件」。既定は全て未チェックで、チェックせずに
              採用できる。成立(ok)のみを記録し、不成立と note はここでは扱わない。
              M19-07 追補: 項目10(コンボ詳細の「成立条件を編集」)と同じ 2×2 グリッドへ
              統一した。fieldset の testid は既存契約のため据え置く。 */}
          <VerifiedConditionsField
            value={confirmed}
            onChange={setConfirmed}
            testIdPrefix="setplay-confirmed"
            fieldsetTestId="setplay-confirmed-conditions"
          />
          {duplicate && (
            <p className="text-xs text-red-600">{t("setplay.adoptDuplicate")}</p>
          )}
          {createMutation.isError && !duplicate && (
            <p className="text-xs text-red-600">{t("setplay.adoptError")}</p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={confirmAdopt}
              disabled={createMutation.isPending || name.trim() === ""}
              data-testid="setplay-adopt-save"
              className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {t("setplay.adoptSave")}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700"
            >
              {t("setplay.adoptCancel")}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

// コンボ詳細画面ヘッダ。
// 指示書 v1.3.0 §1: combos に name カラムは存在しない(DES-003 §3.4)。
// コンボ識別は「キャラ + 状況 + レシピ」で行う。ニックネーム的な情報は memo で表示する。

import { useTranslation } from "react-i18next";

import { useCharacterName, useCharacters } from "@/features/character/hooks/useCharacters";
import type { ComboDetail } from "../types";
import {
  HIT_TYPE_LABEL_KEYS,
  STARTER_MEATY_LABEL_KEYS,
  OPPONENT_SIZE_LABEL_KEYS,
  OPPONENT_STANCE_LABEL_KEYS,
  POSITION_LABEL_KEYS,
  formatPositionMass,
  labelFor,
} from "../utils";
import {
  customStateValueText,
  parseCustomStateDefs,
  resolveCustomStatesForDisplay,
  toCustomStateLocale,
} from "../customStates";

interface ComboDetailHeaderProps {
  combo: ComboDetail;
}

export default function ComboDetailHeader({ combo }: ComboDetailHeaderProps) {
  const { t, i18n } = useTranslation();
  // M7-04-2: 複数キャラ対応。キャラ名は API 由来の動的リストから引く(リュウ固定を解消)。
  // C-1: キャラ名が未取得(ロード中等)の場合のフォールバックは汎用文言を使う。
  const characterName = useCharacterName(combo.characterId);
  const displayName = characterName || t("common.unknown");

  // キャラ固有状態(custom_states)の表示。対象コンボのキャラ定義で code→name_ja を解決する(M11-01)。
  const { data: characters } = useCharacters();
  const customStateDefs = parseCustomStateDefs(
    characters?.find((c) => c.id === combo.characterId)?.customStates,
  );
  // M16-07: 詳細は i18n サーフェス。int state ラベルは locale に応じ ja/en(M16-06 境界)。
  const resolvedCustomStates = resolveCustomStatesForDisplay(
    combo.situation,
    customStateDefs,
    toCustomStateLocale(i18n.language),
  );

  return (
    <header className="bg-white border border-slate-200 rounded-lg p-4">
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center text-lg font-bold text-slate-500">
          {displayName.charAt(0)}
        </div>
        <div>
          <div className="text-lg font-bold">{displayName}</div>
          <div className="text-xs text-slate-500">
            {t("comboDetail.idLabel")}: #{combo.id}
          </div>
        </div>
        <div className="ml-auto">
          {combo.isDraft ? (
            <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-xs">
              {t("comboList.draftBadge")}
            </span>
          ) : (
            <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-xs">
              {t("comboList.officialBadge")}
            </span>
          )}
        </div>
      </div>

      <h3 className="text-sm font-semibold text-slate-700 mb-2">
        {t("comboDetail.situation.heading")}
      </h3>
      <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 text-sm">
        <div>
          <dt className="text-xs text-slate-500">
            {t("comboDetail.situation.position")}
          </dt>
          <dd>
            {labelFor(POSITION_LABEL_KEYS, combo.position, t)}
            {/* ★M37-01: 3 方式のうちマス数とパーセントを後置する。
                ★区分と同じ場所に出すのは、3 つが同じ 1 つの値を表すからである。
                ★未入力なら何も足さない(区分だけの旧データが大半である)。 */}
            {combo.startPositionMass != null && (
              <span
                className="ml-1 text-xs text-slate-400 not-italic"
                data-testid="combo-detail-start-position-mass"
              >
                {formatPositionMass(combo.startPositionMass)}
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">
            {t("comboDetail.situation.opponentStance")}
          </dt>
          <dd>{labelFor(OPPONENT_STANCE_LABEL_KEYS, combo.opponentStance, t)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">
            {t("comboDetail.situation.hitType")}
          </dt>
          <dd>{labelFor(HIT_TYPE_LABEL_KEYS, combo.hitType, t)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">
            {t("comboDetail.situation.opponentSize")}
          </dt>
          <dd>{labelFor(OPPONENT_SIZE_LABEL_KEYS, combo.opponentSize, t)}</dd>
        </div>
        {/* ★M37-07: 始動技の持続当て(指示書 §2.4-5＝詳細画面には必ず出す)。
            ★列は NOT NULL であり「不問」が無いため、常に はい / いいえ のどちらかが出る。
            ★md:grid-cols-4 のため本項は 2 行目の 1 項目として並ぶ。 */}
        <div>
          <dt className="text-xs text-slate-500">
            {t("comboDetail.situation.starterMeaty")}
          </dt>
          <dd data-testid="combo-detail-starter-meaty">
            {labelFor(
              STARTER_MEATY_LABEL_KEYS,
              combo.starterMeaty ? "yes" : "no",
              t,
            )}
          </dd>
        </div>
      </dl>

      {resolvedCustomStates.length > 0 && (
        <>
          <h3 className="text-sm font-semibold text-slate-700 mb-2 mt-4">
            {t("comboDetail.customStates.heading")}
          </h3>
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 text-sm">
            {resolvedCustomStates.map((s) => (
              <div key={`${s.code}-${s.kind}`}>
                <dt className="text-xs text-slate-500">{s.label}</dt>
                <dd>
                  {typeof s.value === "number"
                    ? customStateValueText(s)
                    : t("comboDetail.customStates.on")}
                </dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </header>
  );
}

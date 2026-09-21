import { useTranslation } from "react-i18next";

import { OKI_TECH_TYPES, OKI_TECH_TYPE_LABEL_KEYS, type OkiTechType } from "@/constants/oki";
import {
  SETUP_IN_CORNER_VALUES,
  SETUP_RESULT_CELLS,
  SETUP_RESULT_OK,
  SETUP_RESULT_UNVERIFIED,
  setupResultCellKey,
} from "@/constants/setup-result";

import { SetupResultLegend, SetupResultStateIcon, cornerLabelKey } from "./SetupResultGrid";
import type { SetupResultCondition } from "../types";

// 「確認できた条件」のステージング入力(受け身種別 × 画面端の 2×2)。
//
// ★このコンポーネントは API を一切呼ばない。値は呼び出し側が保持し、親レコード
// (コンボ／セットプレイ)の保存と同一トランザクションで永続化される
// (DES-005 §5.6「保存 UI を置ける面の原則 v3」)。親が未発番の面で即時保存すると
// M19-01 の失敗を再演するため、ここで保存してはならない。
//
// ★見た目は コンボ詳細の「成立条件を編集」(SetupResultEditor)と揃える
// (DES-005 §5.6 項目10 と同じ 2×2 グリッド。新しい操作モデルを作らない)。
// テーブル構造・行/列ラベル・状態アイコン・凡例は同じものを使い、セルだけを
// チェックボックスにする。編集画面はセル選択＋3 択だが、こちらは複数選択なので
// セル自体がトグルになる ——選べる状態が 2 つしかないため 3 択の受け皿が要らない。
//
// - セルの組は SETUP_RESULT_CELLS(値域の正典)を使う。自前で組み立てない。
// - 語彙は OKI_TECH_TYPE_LABELS(項目6 由来)と、端は項目10 のグリッドと同じ i18n キー
//   (cornerLabelKey)。第 3 の語彙を作らない。
// - 記録されるのは成立(ok)のみで、不成立と note はここでは扱わない
//   (DES-005 §5.6 項目12 の採用ダイアログと同じ非対称・意図的)。凡例も 2 値だけ出す。
// - 既定は全セル未チェック = 未検証で開始。

// セルの見た目は SetupResultEditor のセルボタンと同一にする。
// checkbox を sr-only にしているため、focus リングは label 側へ出す
// (そうしないとキーボード操作でどのセルにいるか分からない)。
const CELL_BASE =
  "flex cursor-pointer items-center justify-center rounded border px-2 py-1 hover:bg-slate-50 focus-within:ring-2 focus-within:ring-blue-400";
const CELL_CHECKED = "border-blue-500 bg-blue-50 ring-1 ring-blue-300";
const CELL_UNCHECKED = "border-slate-200";

interface Props {
  // 既定は空配列(全セル未チェック)。undefined も未チェック扱い。
  value: SetupResultCondition[] | undefined;
  onChange: (value: SetupResultCondition[]) => void;
  // セルの data-testid の接頭辞(`${testIdPrefix}-${key}`)。呼び出し面ごとに一意にする。
  testIdPrefix: string;
  // fieldset 自身の data-testid。既定は testIdPrefix。
  // 採用パネルのように「セルの接頭辞と fieldset 名が別」の既存契約がある面で使う。
  fieldsetTestId?: string;
  // 外枠の変種。inline=入れ子のカード内(コンボ登録の各セットプレイ行)、
  // section=ページ直下のセクション(セットプレイ登録画面。同ページの他の
  // fieldset と枠を揃える)。
  variant?: "inline" | "section";
}

export function VerifiedConditionsField({
  value,
  onChange,
  testIdPrefix,
  fieldsetTestId,
  variant = "inline",
}: Props) {
  const { t } = useTranslation();
  const checked = new Set((value ?? []).map(setupResultCellKey));

  const toggle = (key: string) => {
    // SETUP_RESULT_CELLS の順で組み直す(入力順に依存しない安定した並び)。
    const next = SETUP_RESULT_CELLS.filter((c) => {
      const k = setupResultCellKey(c);
      return k === key ? !checked.has(k) : checked.has(k);
    }).map((c) => ({ techType: c.techType, inCorner: c.inCorner }));
    onChange(next);
  };

  const isSection = variant === "section";

  return (
    <fieldset
      className={
        // section の border-gray-300 は同ページの他 fieldset と揃えるためのもの。
        // それ以外の配色は中身のテーブル(SetupResultEditor 由来＝slate)に合わせる。
        isSection
          ? "space-y-2 rounded-lg border border-gray-300 p-4"
          : "space-y-1 rounded border border-slate-200 p-2"
      }
      data-testid={fieldsetTestId ?? testIdPrefix}
    >
      <legend className={isSection ? "px-2 text-sm font-semibold" : "px-1 text-xs text-slate-600"}>
        {t("setplay.confirmedConditionsLegend")}
      </legend>
      <p className="text-[11px] text-slate-500">{t("setplay.confirmedConditionsHint")}</p>

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
                const key = setupResultCellKey({ techType, inCorner });
                const isChecked = checked.has(key);
                const state = isChecked ? SETUP_RESULT_OK : SETUP_RESULT_UNVERIFIED;
                return (
                  <td key={key} className="px-1 py-1">
                    {/* ネイティブの checkbox を視覚的に隠し、label へ編集画面のセルと
                        同じクラスを当てる(見た目は揃え、複数選択のセマンティクスは保つ)。 */}
                    <label
                      className={`${CELL_BASE} ${isChecked ? CELL_CHECKED : CELL_UNCHECKED}`}
                      aria-label={t("setupResult.selectCellLabel", {
                        tech: t(OKI_TECH_TYPE_LABEL_KEYS[techType]),
                        corner: t(cornerLabelKey(inCorner)),
                        state: t(`setupResult.state.${state}`),
                      })}
                      data-state={state}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={isChecked}
                        onChange={() => toggle(key)}
                        data-testid={`${testIdPrefix}-${key}`}
                      />
                      <SetupResultStateIcon state={state} />
                    </label>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* 不成立は選べないため凡例も 2 値だけ出す。 */}
      <SetupResultLegend states={[SETUP_RESULT_OK, SETUP_RESULT_UNVERIFIED]} />
    </fieldset>
  );
}

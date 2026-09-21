import { useState } from "react";
import { useTranslation } from "react-i18next";

import { OKI_TECH_TYPES, OKI_TECH_TYPE_LABEL_KEYS, type OkiTechType } from "@/constants/oki";
import {
  SETUP_IN_CORNER_VALUES,
  SETUP_RESULT_NG,
  SETUP_RESULT_OK,
  SETUP_RESULT_UNVERIFIED,
  setupResultCellKey,
  type SetupResultState,
} from "@/constants/setup-result";
import { useSetupResultMutations } from "../hooks/useSetupResults";
import type { SetupResultCell } from "../types";
import {
  SetupResultLegend,
  SetupResultStateIcon,
  cornerLabelKey,
  noteOf,
  resultStateOf,
} from "./SetupResultGrid";

// セットプレイ成立条件の編集 UI(M19-03 §4.4.3)。
//
// comboId と setupId を両方受け取る。成立条件は「コンボ × セットプレイの組」に紐づくため、
// 片方だけでは保存先の行を特定できない(§4.4.1)。
//
// 操作モデル(2026-07-28 実機確認の指摘で「巡回トグル」から変更):
//   - セルのクリックは **選択のみ**。状態は変わらない
//     → メモ欄を開くために押したら状態が変わってしまう問題を解消
//   - 状態は「未検証 / 成立 / 不成立」の 3 択を直接押して **1 クリックで確定**
//     → ある状態にするのに 2 回押す必要があった問題を解消
//   - メモは選択中のセルに対して常に編集でき、**未検証へ戻しても画面から消えない**
//
// メモの下書きについて:
//   「未検証＝行が無い」は CHANGE-087 §2-d の正典で、result に NULL も「未検証」値も入れられない。
//   つまり **DB には未検証セルのメモを保存できない**。そこでメモはセル単位のローカル下書きとして
//   保持し、未検証の間は保存を無効化して注記を出す。成立／不成立に戻せばその下書きが保存される。
//   (永続化が必要になったら三値の表現方式そのものの変更＝別 CHANGE が要る)

interface Props {
  comboId: number;
  setupId: number;
  results?: SetupResultCell[];
  onChanged: () => void;
}

interface CellRef {
  techType: string;
  inCorner: boolean;
}

export function SetupResultEditor({ comboId, setupId, results, onChanged }: Props) {
  const { t } = useTranslation();
  const { upsert, remove, isPending, isError } = useSetupResultMutations(
    comboId,
    setupId,
    onChanged,
  );
  // 既定で左上のセルを選択しておく(編集を開いた直後から状態変更・メモ入力ができる)。
  const [selected, setSelected] = useState<CellRef>({
    techType: OKI_TECH_TYPES[0],
    inCorner: SETUP_IN_CORNER_VALUES[0],
  });
  // セル単位のメモ下書き。未検証へ戻しても消さない(＝画面に残す)。
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  const selectedKey = setupResultCellKey(selected);
  const selectedState: SetupResultState = resultStateOf(
    results,
    selected.techType,
    selected.inCorner,
  );
  // 下書きがあればそれを、無ければ保存済みの note を出す。
  const savedNote = noteOf(results, selected.techType, selected.inCorner) ?? "";
  const noteValue = noteDrafts[selectedKey] ?? savedNote;

  const setState = (next: SetupResultState) => {
    if (next === selectedState) return;
    if (next === SETUP_RESULT_UNVERIFIED) {
      // 未検証へ戻す = 行の物理削除(§4.1.3)。
      // 削除するとサーバ側の note も消えるため、**表示中の内容を下書きへ退避**してから消す。
      // これをしないと、保存済みメモしか持っていないセルでは入力欄が空になってしまう
      // (開発者要望「未検証に戻してもメモは画面に残ってほしい」)。
      setNoteDrafts((prev) => ({ ...prev, [selectedKey]: noteValue }));
      remove(selected.techType, selected.inCorner);
      return;
    }
    upsert({
      techType: selected.techType,
      inCorner: selected.inCorner,
      result: next,
      // 状態を変えてもメモは失わない。下書きがあれば下書きを優先する。
      note: noteValue.trim() === "" ? null : noteValue,
    });
  };

  const saveNote = () => {
    if (selectedState === SETUP_RESULT_UNVERIFIED) return; // 未検証のセルには保存先の行が無い
    upsert({
      techType: selected.techType,
      inCorner: selected.inCorner,
      result: selectedState,
      note: noteValue.trim() === "" ? null : noteValue,
    });
  };

  const stateChoices: SetupResultState[] = [
    SETUP_RESULT_UNVERIFIED,
    SETUP_RESULT_OK,
    SETUP_RESULT_NG,
  ];

  const selectedCellName = `${t(OKI_TECH_TYPE_LABEL_KEYS[selected.techType as OkiTechType])} / ${t(
    cornerLabelKey(selected.inCorner),
  )}`;

  return (
    <div className="space-y-2" data-testid="setup-result-editor">
      <p className="text-xs text-gray-500">{t("setupResult.editHeading")}</p>

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
                const key = setupResultCellKey({ techType, inCorner });
                const isSelected = key === selectedKey;
                return (
                  <td key={key} className="px-1 py-1">
                    {/* クリックは選択のみ。状態は下の 3 択で変える。 */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelected({ techType, inCorner });
                      }}
                      data-testid={`setup-result-cell-select-${key}`}
                      data-state={state}
                      aria-pressed={isSelected}
                      aria-label={t("setupResult.selectCellLabel", {
                        tech: t(OKI_TECH_TYPE_LABEL_KEYS[techType]),
                        corner: t(cornerLabelKey(inCorner)),
                        state: t(`setupResult.state.${state}`),
                      })}
                      className={`flex items-center justify-center rounded border px-2 py-1 hover:bg-slate-50 ${
                        isSelected ? "border-blue-500 bg-blue-50 ring-1 ring-blue-300" : "border-slate-200"
                      }`}
                    >
                      <SetupResultStateIcon state={state} />
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <SetupResultLegend />

      {/* 選択中セルの状態を 1 クリックで直接指定する。 */}
      <div className="space-y-1 rounded border border-slate-200 p-2" data-testid="setup-result-cell-panel">
        <p className="text-xs text-slate-600">
          {t("setupResult.selectedCell", { cell: selectedCellName })}
        </p>
        <div className="flex flex-wrap gap-1" role="group" aria-label={t("setupResult.stateGroupLabel")}>
          {stateChoices.map((choice) => {
            const active = choice === selectedState;
            return (
              <button
                key={choice}
                type="button"
                disabled={isPending}
                onClick={(e) => {
                  e.stopPropagation();
                  setState(choice);
                }}
                data-testid={`setup-result-state-${choice}`}
                aria-pressed={active}
                className={`flex items-center gap-1 rounded border px-2 py-1 text-xs disabled:opacity-50 ${
                  active
                    ? "border-blue-500 bg-blue-50 font-medium text-blue-800"
                    : "border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
              >
                <SetupResultStateIcon state={choice} />
                {t(`setupResult.state.${choice}`)}
              </button>
            );
          })}
        </div>

        {/* メモは未検証でも入力欄を出す(下書きとして画面に残す)。保存だけ抑止する。 */}
        <label className="block text-xs text-slate-600" data-testid="setup-result-note-field">
          {t("setupResult.noteLabelSimple")}
          <input
            type="text"
            value={noteValue}
            onChange={(e) =>
              setNoteDrafts((prev) => ({ ...prev, [selectedKey]: e.target.value }))
            }
            onClick={(e) => e.stopPropagation()}
            aria-label={t("setupResult.noteAriaLabel")}
            data-testid="setup-result-note-input"
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isPending || selectedState === SETUP_RESULT_UNVERIFIED}
            onClick={(e) => {
              e.stopPropagation();
              saveNote();
            }}
            data-testid="setup-result-note-save"
            className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {t("setupResult.noteSave")}
          </button>
          {selectedState === SETUP_RESULT_UNVERIFIED && (
            <p className="text-xs text-slate-500" data-testid="setup-result-note-unsaved-hint">
              {t("setupResult.noteUnsavedHint")}
            </p>
          )}
        </div>
      </div>

      {isError && (
        <p className="text-xs text-red-600" data-testid="setup-result-error">
          {t("setupResult.saveError")}
        </p>
      )}
    </div>
  );
}

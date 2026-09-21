import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { InfoMark } from "@/components/InfoMark";
import {
  MODIFIER_NON_MOVE_TYPES,
  MOVE_SELECT_PLACEHOLDER_JA,
  NON_MOVE_FILTER,
  NON_MOVE_GROUP_LABEL_JA,
} from "@/features/combo/labels";
import { RECIPE_STEPS_EMPTY_LABEL } from "@/features/combo/recipeDisplay";
import type { Modifiers } from "@/features/combo/types";
import { ControllerInputOmissionToggle } from "@/features/combo/components/ControllerInputOmissionToggle";
import {
  useClearHiddenSelection,
  useControllerInputOmission,
} from "@/features/combo/hooks/useControllerInputOmission";
import { ModifiersEditor } from "@/features/combo/components/ModifiersEditor";
import { ModifiersSummary } from "@/features/combo/components/ModifiersSummary";
import { VirtualController } from "@/features/combo/components/VirtualController/VirtualController";
import type { StepInput } from "@/features/combo/components/VirtualController/useControllerInput";
import {
  MOVE_CATEGORY_LABEL_JA,
  MOVE_CATEGORY_ORDER,
} from "@/features/moves/types";
import type { Move } from "@/features/moves/types";
import { useMovesByCharacter } from "@/features/moves/api";

import type { SetupStepInput } from "../types";

interface Props {
  characterId: number;
  steps: SetupStepInput[];
  onChange: (newSteps: SetupStepInput[]) => void;
  /**
   * セットプレイ全体を保存する（M21-04）。★保存導線は SetupEditorPage が持つため上から渡す。
   *
   * ★**コンボ編集画面へ同梱されるセットプレイ行（`SetupInputRow`）では渡さない。**
   *   同梱の行に保存導線は存在せず（親コンボの保存に含まれる）、渡すものが無いためである。
   *   その場合、物理からの保存は「この面では行えません」として読取表示に出る（§4.5-3）。
   */
  onSave?: () => void;
  /** いま保存できる状態か。★画面の保存ボタンの `disabled` と同じ式を渡すこと。 */
  canSave?: boolean;
}

// ModifiersEditor が期待する Step 型に合わせた内部変換用
interface InternalStep {
  moveId?: number;
  modifiers?: Modifiers;
}

const NOTES_MAX_LENGTH = 50;

function renderStepLabel(step: SetupStepInput, movesById: Map<number, Move>): string {
  if (step.moveId == null) {
    const typeLabel = MODIFIER_NON_MOVE_TYPES.find((t) => t.value === step.modifiers?.type)?.label;
    // M16-06(FB⑥): M15-03 で確立した user 語彙に揃える。
    // M24-04(SM-112): 旧称「共通システム（移動・その他）」は optgroup と同じ 1 本の定数へ寄せた。
    return typeLabel ?? NON_MOVE_GROUP_LABEL_JA;
  }
  const move = movesById.get(step.moveId);
  return move?.nameJa ?? move?.code ?? `技 #${step.moveId}`;
}

function groupMovesByCategory(moves: Move[]) {
  const map = new Map<string, typeof moves>();
  for (const m of moves) {
    const list = map.get(m.category) ?? [];
    list.push(m);
    map.set(m.category, list);
  }
  return map;
}

// setup 用レシピエディタ。SF6 仮想コントローラ + 技セレクタ + ステップリスト(M4-02)。
export function SetupRecipeEditor({
  characterId,
  steps,
  onChange,
  onSave,
  canSave,
}: Props) {
  const { t } = useTranslation();
  const movesQ = useMovesByCharacter(characterId);
  const moves = movesQ.data ?? [];
  const movesLoading = movesQ.isLoading;

  // 全技プルダウンは既定折りたたみ(指摘16)。
  const [pulldownOpen, setPulldownOpen] = useState(false);
  // 技/非技ステップを 1 セレクタへ統合(指摘17)。値は moveId(数値文字列)or "nonmove:<type>"、未選択は ""。
  const [selectedValue, setSelectedValue] = useState<string>("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  // プルダウンの区分絞り込み(FB④)。"all"=全カテゴリ、NON_MOVE_FILTER=非技ステップのみ。
  const [filterCategory, setFilterCategory] = useState<string>("all");

  useEffect(() => {
    steps.forEach((step, i) => {
      if (step.modifiers?.notes && step.modifiers.notes.length > NOTES_MAX_LENGTH) {
        console.warn(
          `setup_steps[${i}].modifiers.notes が 50 文字を超えています: ${step.modifiers.notes.length} 文字`,
        );
      }
    });
  }, [steps]);

  const movesById = useMemo(() => {
    const m = new Map<number, Move>();
    for (const mv of moves) m.set(mv.id, mv);
    return m;
  }, [moves]);

  // ★★M30-01(SM-100): 全技一覧から「ボタンで入力できる技」を省く切替。
  //   述語は moveSurfacing の isControllerSurfaced の裏返し 1 本である。
  // ★★面は "setup" である(M31-06)。⇒ setup_only の技はこの面**だけ**に出る。
  //   ★"combo" へ倒すと、本サブが作った経路の意味そのものが消える。
  const { omitSurfaced, setOmitSurfaced, visibleMoves, omittedCount } =
    useControllerInputOmission(characterId, moves, "setup");
  const grouped = useMemo(
    () => groupMovesByCategory(visibleMoves),
    [visibleMoves],
  );
  // ★M30-01(レビュー 高-4): 一覧から消えた技が選ばれたままだと、画面に出ていない技を
  //   ［追加］で積めてしまう。⇒ 消えた時点で選択を外す。
  useClearHiddenSelection(visibleMoves, selectedValue, setSelectedValue);

  const reorder = (arr: SetupStepInput[]) => arr.map((s, i) => ({ ...s, _order: i + 1 }));

  const handleAdd = () => {
    if (selectedValue === "") return;
    const nonMoveType = selectedValue.startsWith("nonmove:")
      ? selectedValue.slice("nonmove:".length)
      : null;

    // dash は M16-04 で system move へ一本化。「システム」optgroup(moveId)から選ぶと
    // 下の moveId 経路で system move step として追加される(modifiers.type dash は撤去済み)。
    const newStep: SetupStepInput =
      nonMoveType != null
        ? { moveId: undefined, modifiers: { type: nonMoveType } }
        : { moveId: Number(selectedValue), modifiers: undefined };
    onChange(reorder([...steps, newStep]));
  };

  const handleVCStepAdd = (partial: StepInput) => {
    const newStep: SetupStepInput = {
      moveId: partial.moveId ?? undefined,
      modifiers: partial.modifiers ?? undefined,
    };
    onChange(reorder([...steps, newStep]));
  };

  const handleVCStepDelete = () => {
    if (steps.length === 0) return;
    onChange(reorder(steps.slice(0, -1)));
  };

  // 物理コントローラのショートカットから、直前に確定したステップの修飾情報を開く(M21-04 §4.2 の 4)。
  // ★既存の編集ダイアログの入口(editingIndex)をそのまま使う。修飾の選択肢は物理側に持たない。
  const handleVCOpenLastStepModifiers = () => {
    if (steps.length === 0) return;
    setEditingIndex(steps.length - 1);
  };

  const handleMoveUp = (idx: number) => {
    if (idx === 0) return;
    const next = [...steps];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    onChange(reorder(next));
  };

  const handleMoveDown = (idx: number) => {
    if (idx === steps.length - 1) return;
    const next = [...steps];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    onChange(reorder(next));
  };

  const handleDelete = (idx: number) => {
    onChange(reorder(steps.filter((_, i) => i !== idx)));
  };

  const handleModifiersSave = (idx: number, newMods: Modifiers | undefined) => {
    onChange(steps.map((s, i) => (i === idx ? { ...s, modifiers: newMods } : s)));
    setEditingIndex(null);
  };

  // ModifiersEditor が期待する Step 型に変換
  const toInternalStep = (s: SetupStepInput): InternalStep => ({
    moveId: s.moveId ?? undefined,
    modifiers: s.modifiers,
  });

  return (
    <fieldset className="space-y-3 rounded-lg border border-gray-300 p-4">
      <legend className="px-2 text-sm font-semibold">レシピ</legend>

      <VirtualController
        characterId={characterId}
        moves={moves}
        context="setup"
        onStepAdd={handleVCStepAdd}
        onStepDelete={handleVCStepDelete}
        onSave={onSave}
        canSave={canSave}
        onOpenLastStepModifiers={handleVCOpenLastStepModifiers}
        stepCount={steps.length}
      />

      {/* 全技から選ぶプルダウン(既定折りたたみ・網羅フォールバック、指摘16/17) */}
      <div className="space-y-2 rounded bg-gray-50 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPulldownOpen((v) => !v)}
            aria-expanded={pulldownOpen}
            className="rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium hover:bg-gray-100"
            data-testid="recipe-pulldown-toggle"
          >
            {pulldownOpen ? "▼ 全技一覧を閉じる" : "▶ 全技一覧から選ぶ"}
          </button>
          <span className="text-xs text-gray-500">
            ボタンで入れられない細かい技名はこちら
          </span>
        </div>

        {pulldownOpen && (
          <div className="space-y-2">
            {/* ★M30-01(SM-100): 既定 OFF。省かれるのはコントローラのどれかの面から
                押せる技だけであり、残る集合は未掲載タブと完全に一致する。 */}
            <ControllerInputOmissionToggle
              checked={omitSurfaced}
              onChange={setOmitSurfaced}
              omittedCount={omittedCount}
            />
            {/* 区分で絞り込み(FB④、非技ステップ統合=指摘17) */}
            <label className="flex items-center gap-2 text-xs text-gray-600">
              区分で絞り込み:
              <select
                className="rounded border border-gray-300 px-2 py-1 text-xs"
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                data-testid="recipe-category-filter"
              >
                <option value="all">すべて</option>
                {MOVE_CATEGORY_ORDER.map((cat) => {
                  const list = grouped.get(cat);
                  if (!list || list.length === 0) return null;
                  return (
                    <option key={cat} value={cat}>
                      {MOVE_CATEGORY_LABEL_JA[cat] ?? cat}
                    </option>
                  );
                })}
                <option value={NON_MOVE_FILTER}>{NON_MOVE_GROUP_LABEL_JA}</option>
              </select>
            </label>
            <select
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              value={selectedValue}
              onChange={(e) => setSelectedValue(e.target.value)}
              disabled={movesLoading}
              data-testid="recipe-move-select"
            >
              <option value="">
                {movesLoading ? "技を読み込み中..." : MOVE_SELECT_PLACEHOLDER_JA}
              </option>
              {MOVE_CATEGORY_ORDER.filter(
                (cat) => filterCategory === "all" || cat === filterCategory,
              ).map((cat) => {
                const list = grouped.get(cat);
                if (!list || list.length === 0) return null;
                return (
                  <optgroup key={cat} label={MOVE_CATEGORY_LABEL_JA[cat] ?? cat}>
                    {list.map((mv) => (
                      <option key={mv.id} value={String(mv.id)}>
                        {mv.nameJa ?? mv.code}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
              {(filterCategory === "all" || filterCategory === NON_MOVE_FILTER) && (
                <optgroup label={NON_MOVE_GROUP_LABEL_JA}>
                  {MODIFIER_NON_MOVE_TYPES.map((tp) => (
                    <option key={tp.value} value={`nonmove:${tp.value}`}>
                      {tp.label}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>

            <button
              type="button"
              className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-40"
              onClick={handleAdd}
              disabled={selectedValue === ""}
              data-testid="recipe-add-step"
            >
              ステップ追加
            </button>
          </div>
        )}
      </div>

      {steps.length > 0 && (
        <div className="flex items-center gap-1 px-1 text-xs text-gray-600">
          <span>編集ボタンについて</span>
          <InfoMark
            topic="setup-recipe-modifier"
            text={t("help.recipeModifier")}
            ariaLabel="編集ボタン(ステップ補足設定)の説明"
          />
        </div>
      )}

      <ul className="space-y-1">
        {steps.map((step, idx) => (
          <li
            key={idx}
            className="flex items-center gap-2 rounded border border-gray-200 bg-white px-3 py-2 text-sm"
          >
            <span className="w-6 text-right font-mono text-gray-500">{idx + 1}.</span>
            <span className="flex-1 text-gray-900">
              {renderStepLabel(step, movesById)}
            </span>
            {/* ★★M24-05(SM-052): コンボ側と同じ 1 本を通す。
                旧実装はこの場のインラインで、flags を内部コードのまま出し
                (`just` / `link`)、notes を本文ごと行内へ展開し、type も内部コードで
                並べていた——memo の「セットプレイの modify(メモの方)の表示が
                コンボと不一致」の実体である。
                ★★型だけのステップ(ドライブラッシュ類)では、主ラベルが下の
                  renderStepLabel で「パリィドライブラッシュ」と日本語で出している
                  のと同じ情報が、灰バッジに内部コードで二重に出ていた。
                  ⇒ 本部品に替えてバッジ側が消え、主ラベルの日本語だけが残る。
                ★編集ダイアログ(ModifiersEditor)は元から共有されており、
                  食い違っていたのは要約表示だけだった。 */}
            <ModifiersSummary modifiers={step.modifiers} />
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="rounded px-1.5 py-0.5 text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                onClick={() => handleMoveUp(idx)}
                disabled={idx === 0}
                aria-label="上に移動"
              >
                ▲
              </button>
              <button
                type="button"
                className="rounded px-1.5 py-0.5 text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                onClick={() => handleMoveDown(idx)}
                disabled={idx === steps.length - 1}
                aria-label="下に移動"
              >
                ▼
              </button>
              <button
                type="button"
                className="rounded px-1.5 py-0.5 text-xs text-blue-600 hover:bg-blue-50"
                onClick={() => setEditingIndex(idx)}
              >
                編集
              </button>
              <button
                type="button"
                className="rounded px-1.5 py-0.5 text-xs text-red-600 hover:bg-red-50"
                onClick={() => handleDelete(idx)}
              >
                削除
              </button>
            </div>
          </li>
        ))}
        {steps.length === 0 && (
          <li
            className="py-3 text-center text-sm text-gray-400"
            data-testid="setup-recipe-steps-empty"
          >
            {RECIPE_STEPS_EMPTY_LABEL}
          </li>
        )}
      </ul>

      <ModifiersEditor
        open={editingIndex !== null}
        step={editingIndex !== null ? toInternalStep(steps[editingIndex]) as any : undefined}
        stepIndex={editingIndex}
        movesById={movesById}
        onSave={handleModifiersSave}
        onOpenChange={(open) => { if (!open) setEditingIndex(null); }}
      />

      {steps.length > 0 && (
        <div className="flex justify-end">
          <span className="text-xs text-gray-400">{steps.length} ステップ</span>
        </div>
      )}
    </fieldset>
  );
}

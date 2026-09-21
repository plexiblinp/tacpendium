import type { Move } from "@/features/moves/types";
import type {
  CreateSetupInput,
  SetupResultCondition,
  SetupStepInput,
} from "@/features/setup/types";
import { SetupRecipeEditor } from "@/features/setup/components/SetupRecipeEditor";
import { VerifiedConditionsField } from "@/features/setup/components/VerifiedConditionsField";

import { formatRecipeLine } from "../utils";
import { RECIPE_EMPTY_LABEL } from "../recipeDisplay";

interface Props {
  value: CreateSetupInput;
  onChange: (value: CreateSetupInput) => void;
  onRemove: () => void;
  characterId: number;
  index: number;
  // M15-05 追補: 技名 1 行プレビュー用(省略時は空)。
  moves?: Move[];
}

export function SetupInputRow({
  value,
  onChange,
  onRemove,
  characterId,
  index,
  moves = [],
}: Props) {
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    onChange({ ...value, name: v.length === 0 ? null : v });
  };

  const handleDescriptionChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    const v = e.target.value;
    onChange({ ...value, description: v.length === 0 ? null : v });
  };

  const handleStepsChange = (newSteps: SetupStepInput[]) => {
    onChange({ ...value, steps: newSteps });
  };

  // M19-07: 成立条件はステージングするだけで、ここでは保存しない。
  // コンボ作成 API の setups[].verifiedConditions に載り、コンボと同一 Tx で書かれる。
  const handleVerifiedConditionsChange = (next: SetupResultCondition[]) => {
    onChange({ ...value, verifiedConditions: next });
  };

  // M15-05 追補: セットプレイのレシピを技名 1 行で常時プレビュー(一目で分かる欄)。
  const recipeLine = formatRecipeLine(value.steps, moves);

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">
          セットプレイ {index + 1}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
        >
          削除
        </button>
      </div>

      <p
        data-testid={`setup-input-recipe-summary-${index}`}
        className="truncate font-mono text-xs text-gray-500"
        title={recipeLine || undefined}
      >
        {recipeLine || (
          <span className="text-gray-400">{RECIPE_EMPTY_LABEL}</span>
        )}
      </p>

      <div className="space-y-2">
        <label className="block">
          {/* C-03: セットプレイ名を必須化(VAL-S06)。SetupBasicInfoForm と表記を揃える。 */}
          <span className="text-xs text-gray-600">
            名前 <span className="font-normal text-red-500">必須</span>
          </span>
          <input
            type="text"
            value={value.name ?? ""}
            onChange={handleNameChange}
            placeholder="セットプレイ名"
            required
            aria-required="true"
            className="mt-0.5 w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
          />
          {(value.name == null || value.name.trim() === "") && (
            <span className="mt-0.5 block text-xs text-red-500">
              セットプレイ名は必須です
            </span>
          )}
        </label>

        <label className="block">
          <span className="text-xs text-gray-600">説明</span>
          <textarea
            value={value.description ?? ""}
            onChange={handleDescriptionChange}
            placeholder="説明（省略可）"
            rows={2}
            className="mt-0.5 w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
          />
        </label>
      </div>

      {/*
        ★onSave / canSave は意図的に渡していない(M21-04)。コンボへ同梱されるセットプレイ行に
        保存導線は存在せず、親コンボの保存に含まれるためである。⇒ 物理コントローラからの
        保存操作はこの面では「行えません」と読取表示に出る(指示書 §4.5-3)。
        ★ここへ親コンボの保存を繋がないこと。利用者はセットプレイ行を編集しているつもりで
        コンボ全体を保存してしまう。
      */}
      <SetupRecipeEditor
        characterId={characterId}
        steps={value.steps}
        onChange={handleStepsChange}
      />

      <VerifiedConditionsField
        value={value.verifiedConditions}
        onChange={handleVerifiedConditionsChange}
        testIdPrefix={`setup-input-confirmed-${index}`}
      />
    </div>
  );
}

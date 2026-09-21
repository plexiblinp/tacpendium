import { useState } from "react";

import type { Move } from "@/features/moves/types";
import type {
  CreateSetupInput,
  SetupSummary,
} from "@/features/setup/types";

import RecipeText from "./RecipeText";
import { CollapsibleFieldset } from "./CollapsibleFieldset";
import { SetupInputRow } from "./SetupInputRow";
import { SetupSelectorModal } from "./SetupSelectorModal";

interface Props {
  value: CreateSetupInput[];
  onChange: (setups: CreateSetupInput[]) => void;
  characterId: number;
  // C-08: 紐付け候補を knockdown_advantage 一致に絞るため現フォームの値を受け取る(null=未入力)。
  knockdownAdvantage: number | null;
  linkedSetups: SetupSummary[];
  onLinkedSetupsChange: (setups: SetupSummary[]) => void;
  // M15-05 追補: 各セットプレイ行の技名 1 行プレビュー用(steps→技名解決)。省略時は空。
  moves?: Move[];
}

export function SetupRegistrationSection({
  value,
  onChange,
  characterId,
  knockdownAdvantage,
  linkedSetups,
  onLinkedSetupsChange,
  moves = [],
}: Props) {
  const [selectorOpen, setSelectorOpen] = useState(false);

  const handleAdd = () => {
    onChange([
      ...value,
      { characterId, name: null, description: null, steps: [] },
    ]);
  };

  const handleChange = (index: number, updated: CreateSetupInput) => {
    onChange(value.map((v, i) => (i === index ? updated : v)));
  };

  const handleRemove = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const handleSelectExisting = (setup: SetupSummary) => {
    onLinkedSetupsChange([...linkedSetups, setup]);
    setSelectorOpen(false);
  };

  const handleUnlink = (setupId: number) => {
    onLinkedSetupsChange(linkedSetups.filter((s) => s.id !== setupId));
  };

  const excludeSetupIds = linkedSetups.map((s) => s.id);

  return (
    <CollapsibleFieldset
      legend="このコンボに紐づくセットプレイ"
      contentClassName="space-y-3"
      data-testid="combo-editor-setup-section"
    >
      {value.map((setup, i) => (
        <SetupInputRow
          key={i}
          value={setup}
          onChange={(v) => handleChange(i, v)}
          onRemove={() => handleRemove(i)}
          characterId={characterId}
          index={i}
          moves={moves}
        />
      ))}

      {linkedSetups.length > 0 && (
        <div className="space-y-1">
          <span className="text-xs font-medium text-gray-500">
            紐付け予定の既存セットプレイ
          </span>
          {linkedSetups.map((setup) => (
            <div
              key={setup.id}
              className="flex items-center justify-between rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm"
            >
              <div>
                <span className="font-medium">
                  {setup.name ?? `セットプレイ #${setup.id}`}
                </span>
                {/* ★M24-05 §4.2: RecipeText を通す。★本箇所は followup の
                    「5 か所」に入っていなかった(実査で見つけた 6 か所目)。 */}
                <RecipeText
                  recipe={setup.defaultRecipe}
                  fullView={false}
                  className="ml-2 inline-block max-w-[22rem] align-bottom font-mono text-xs text-gray-400"
                />
              </div>
              <button
                type="button"
                onClick={() => handleUnlink(setup.id)}
                className="rounded px-2 py-0.5 text-xs text-red-600 hover:bg-red-50"
              >
                取消
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleAdd}
          className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          + セットプレイを追加
        </button>
        <button
          type="button"
          onClick={() => setSelectorOpen(true)}
          className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          既存のセットプレイを紐付け
        </button>
      </div>

      <SetupSelectorModal
        open={selectorOpen}
        characterId={characterId}
        knockdownAdvantage={knockdownAdvantage}
        excludeSetupIds={excludeSetupIds}
        onSelect={handleSelectExisting}
        onOpenChange={(open) => { if (!open) setSelectorOpen(false); }}
      />
    </CollapsibleFieldset>
  );
}

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSetupCandidatesByKnockdown } from "@/features/setup/hooks/useSetupCandidatesByKnockdown";
import type { SetupSummary } from "@/features/setup/types";

import RecipeText from "./RecipeText";

interface Props {
  open: boolean;
  characterId: number;
  // C-08: 紐付け候補は knockdown_advantage 一致のものに限定する。null(未入力)時は候補なし。
  knockdownAdvantage: number | null;
  excludeSetupIds: number[];
  onSelect: (setup: SetupSummary) => void;
  onOpenChange: (open: boolean) => void;
}

export function SetupSelectorModal({
  open,
  characterId,
  knockdownAdvantage,
  excludeSetupIds,
  onSelect,
  onOpenChange,
}: Props) {
  const setupsQ = useSetupCandidatesByKnockdown(
    open ? characterId : null,
    open ? knockdownAdvantage : null,
  );

  const candidates = (setupsQ.data ?? []).filter(
    (s) => !excludeSetupIds.includes(s.id),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>既存セットプレイから紐付け</DialogTitle>
          <DialogDescription className="sr-only">
            既存のセットプレイを選択して紐付けます
          </DialogDescription>
        </DialogHeader>

        {setupsQ.isLoading && (
          <p className="text-sm text-gray-500">読み込み中...</p>
        )}

        {!setupsQ.isLoading && candidates.length === 0 && (
          <p className="text-sm text-gray-500">
            {/* C-08: 候補は同一キャラ + 同一有利フレームで絞り込む。有利フレーム未入力時も 0 件になる。 */}
            同一有利フレームの紐付け候補がありません
          </p>
        )}

        {candidates.length > 0 && (
          <ul className="max-h-[60vh] space-y-2 overflow-y-auto">
            {candidates.map((setup) => (
              <li key={setup.id}>
                <button
                  type="button"
                  className="w-full rounded border border-gray-200 px-4 py-2.5 text-left text-sm hover:border-blue-300 hover:bg-blue-50"
                  onClick={() => onSelect(setup)}
                >
                  <span className="font-medium">
                    {setup.name ?? `セットプレイ #${setup.id}`}
                  </span>
                  {setup.description && (
                    <span className="block text-xs text-gray-500">
                      {setup.description}
                    </span>
                  )}
                  {/* ★M24-05 §4.2: RecipeText を通す。★本面は候補カード全体が
                      <button> であり、RecipeText は span で組まれているため
                      入れ子として不正にならない(RecipeText の設計理由そのもの)。 */}
                  <RecipeText
                    recipe={setup.defaultRecipe}
                    fullView={false}
                    className="font-mono text-xs text-gray-400"
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

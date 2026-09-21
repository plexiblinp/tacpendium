import { useNavigate } from "react-router-dom";
import { TableCell, TableRow } from "@/components/ui/table";
import type { SetupSummary } from "@/features/setup/types";

import RecipeText from "./RecipeText";

interface SetupTreeRowProps {
  setups: SetupSummary[];
  colSpan: number;
  onSetupClick?: (setupId: number) => void;
}

export default function SetupTreeRow({ setups, colSpan, onSetupClick }: SetupTreeRowProps) {
  const navigate = useNavigate();

  if (setups.length === 0) return null;

  const handleClick = (setupId: number) => {
    if (onSetupClick) {
      onSetupClick(setupId);
    } else {
      navigate(`/setups/${setupId}`);
    }
  };

  return (
    <TableRow className="bg-slate-50">
      <TableCell colSpan={colSpan} className="px-4 py-2 pl-12 text-sm">
        {setups.map((setup) => (
          <div
            key={setup.id}
            className="flex items-center gap-2 py-1 cursor-pointer hover:underline text-slate-700"
            role="button"
            tabIndex={0}
            onClick={() => handleClick(setup.id)}
            onKeyDown={(e) => e.key === "Enter" && handleClick(setup.id)}
          >
            <span className="text-slate-400">└</span>
            <span className="font-medium">{setup.name ?? `セットプレイ #${setup.id}`}</span>
            {/* ★M24-05 §4.2: RecipeText を通す。★角括弧は本行固有の装飾なので
                呼び手に残す(共通部品へ持ち込むとコンボ側の面にも括弧が付く)。
                ★compact では RecipeText 自身が title に全文を入れる。 */}
            <span className="text-slate-500 font-mono text-xs">
              [
              <RecipeText
                recipe={setup.defaultRecipe}
                fullView={false}
                className="inline-block max-w-[20rem] align-bottom"
              />
              ]
            </span>
          </div>
        ))}
      </TableCell>
    </TableRow>
  );
}

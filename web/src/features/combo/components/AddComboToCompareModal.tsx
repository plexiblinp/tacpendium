import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import CharacterSelector from "@/features/mycombo/components/CharacterSelector";
import { useResolvedCharacterId } from "../hooks/useResolvedCharacterId";
import { useCombos } from "../api";
import { useRecipeFullView } from "../hooks/useRecipeFullView";
import RecipeText from "./RecipeText";
import RecipeViewToggle from "./RecipeViewToggle";
import { formatStarterStatus, formatDamage } from "../utils";

interface Props {
  open: boolean;
  currentIds: number[];
  // 既定キャラ(M10-02 文脈追従)。比較リスト先頭コンボのキャラ等を呼び出し側が渡す。
  // 不在時は既定キャラの解決順(M24-01 §4.1-2)へ落ちる。モーダル内セレクタでの手動切替は維持される。
  defaultCharacterId?: number;
  onAdd: (id: number) => void;
  onOpenChange: (open: boolean) => void;
}

export default function AddComboToCompareModal({
  open,
  currentIds,
  defaultCharacterId,
  onAdd,
  onOpenChange,
}: Props) {
  const { t } = useTranslation();
  // ★★M24-03 §4.3(SM-018): 本モーダルはクラスタ A の 4 面目である。
  //   機序は「手数が多い」ではなく「子ウィンドウが狭くてレシピが短くしか出ない」
  //   (開発者回答 2026-08-26)。実測でも候補のレシピ幅は 200px = 一覧(320px)の 62.5% しか
  //   無く、40 文字で 48% しか見えていなかった。⇒ §4.1 の規則をこの面にも通す。
  const { fullView } = useRecipeFullView(false);
  // M24-01 §4.1-5: 定数の直接参照を解決順の呼び出しへ畳む。
  // ★文脈優先のロジック(呼び出し側が渡す defaultCharacterId が最優先)は変えていない。
  const resolvedCharacterId = useResolvedCharacterId();
  const [characterId, setCharacterId] = useState<number>(
    defaultCharacterId ?? resolvedCharacterId,
  );

  // モーダルが開いた瞬間(立ち上がりエッジ)のみ既定キャラを現在の文脈へ同期する。
  // open のまま defaultCharacterId が変化しても手動選択を上書きしない(再利用時の安全性)。
  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setCharacterId(defaultCharacterId ?? resolvedCharacterId);
    }
    prevOpenRef.current = open;
  }, [open, defaultCharacterId, resolvedCharacterId]);
  const combosQuery = useCombos(
    open ? { characterId } : { characterId: -1 },
  );

  const combos = combosQuery.data?.items ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* M24-03 §4.3: 器も広げる。★ただし §4.1 の規則より優先しない——
          全文表示モードで読めるようになることが第一手であり、幅はその補助である。 */}
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("compare.addCombo")}</DialogTitle>
          <DialogDescription className="sr-only">
            {t("compare.addCombo")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-end">
          <RecipeViewToggle surfaceDefault={false} />
        </div>

        <div className="flex items-center gap-2">
          <Label className="text-sm shrink-0">キャラクター:</Label>
          <CharacterSelector
            selectedCharacterId={characterId}
            onChange={setCharacterId}
          />
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {combosQuery.isLoading && (
            <p className="text-sm text-gray-500">{t("common.loading")}</p>
          )}

          {!combosQuery.isLoading && combos.length === 0 && (
            <p className="text-sm text-gray-500">
              {t("comboList.empty")}
            </p>
          )}

          {combos.length > 0 && (
            <ul className="space-y-2">
              {combos.map((combo) => {
                const isSelected = currentIds.includes(combo.id);
                return (
                  // ★候補行に安定した目印を置く(M24-03)。レシピの見せ方が切り替わると
                  //   行の文字列が変わるため、文字列で行を特定すると掴めなくなる。
                  <li
                    key={combo.id}
                    data-testid="compare-candidate"
                    data-combo-id={combo.id}
                  >
                    <button
                      type="button"
                      className={`w-full rounded border px-4 py-2.5 text-left text-sm ${
                        isSelected
                          ? "border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed"
                          : "border-gray-200 hover:border-blue-300 hover:bg-blue-50"
                      }`}
                      onClick={() => {
                        if (!isSelected) onAdd(combo.id);
                      }}
                      disabled={isSelected}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">
                          {formatStarterStatus(combo, t)}
                        </span>
                        {isSelected && (
                          <span className="text-xs bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">
                            {t("compare.alreadySelected")}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        <span>
                          {t("compare.row.damage")}:{" "}
                          {formatDamage(combo.damage)}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        <RecipeText
                          recipe={combo.defaultRecipe}
                          fullView={fullView}
                          compactClassName="sm:max-w-[380px]"
                        />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

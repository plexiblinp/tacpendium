import { useState, useCallback } from "react";

export interface SelectModeState {
  isSelectMode: boolean;
  selectedIds: number[];
  isAtMax: boolean;
  enterSelectMode: () => void;
  exitSelectMode: () => void;
  toggle: (id: number) => boolean;
  clear: () => void;
}

export function useSelectMode(maxItems: number): SelectModeState {
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const isAtMax = selectedIds.length >= maxItems;

  const toggle = useCallback(
    (id: number): boolean => {
      if (selectedIds.includes(id)) {
        setSelectedIds((prev) => prev.filter((x) => x !== id));
        return true;
      }
      if (selectedIds.length >= maxItems) {
        return false;
      }
      setSelectedIds((prev) => [...prev, id]);
      return true;
    },
    [selectedIds, maxItems],
  );

  const clear = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const enterSelectMode = useCallback(() => {
    setIsSelectMode(true);
  }, []);

  const exitSelectMode = useCallback(() => {
    setIsSelectMode(false);
    setSelectedIds([]);
  }, []);

  return {
    isSelectMode,
    selectedIds,
    isAtMax,
    enterSelectMode,
    exitSelectMode,
    toggle,
    clear,
  };
}

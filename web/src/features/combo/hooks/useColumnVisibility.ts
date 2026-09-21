import { useState, useCallback } from "react";
import { createLocalStorageHelper } from "@/lib/browser-storage";
import {
  DEFAULT_COLUMN_VISIBILITY,
  type ColumnVisibility,
} from "@/constants/combo-list";

const STORAGE_KEY = "combo-list-columns-v1";
const storage = createLocalStorageHelper<ColumnVisibility>(STORAGE_KEY);

export function useColumnVisibility() {
  const [visibility, setVisibility] = useState<ColumnVisibility>(() => {
    const loaded = storage.load();
    return loaded
      ? { ...DEFAULT_COLUMN_VISIBILITY, ...loaded }
      : DEFAULT_COLUMN_VISIBILITY;
  });

  const updateVisibility = useCallback((next: ColumnVisibility) => {
    setVisibility(next);
    storage.save(next);
  }, []);

  const resetVisibility = useCallback(() => {
    setVisibility(DEFAULT_COLUMN_VISIBILITY);
    storage.remove();
  }, []);

  return { visibility, updateVisibility, resetVisibility };
}

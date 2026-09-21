import { useState } from "react";
import { useTagManagement } from "./useTagManagement";
import { DEFAULT_TAG_COLOR } from "@/features/tag/constants/tagColorPalette";

export function useTagSelectorForm() {
  const { createMutation } = useTagManagement();
  const [creating, setCreating] = useState(false);

  const handleCreateTag = async (name: string): Promise<number | null> => {
    if (!name || creating) return null;
    setCreating(true);
    try {
      const newTag = await createMutation.mutateAsync({ name, color: DEFAULT_TAG_COLOR });
      return newTag.id;
    } catch {
      return null;
    } finally {
      setCreating(false);
    }
  };

  return { handleCreateTag, creating };
}

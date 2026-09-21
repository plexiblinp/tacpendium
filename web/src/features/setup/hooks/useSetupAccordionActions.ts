import { useDeleteSetupLink } from "./useSetupLinks";

export function useSetupAccordionActions(comboId: number, onUnlinked?: () => void) {
  const unlinkMutation = useDeleteSetupLink();

  const handleUnlink = (setupId: number) => {
    unlinkMutation.mutate(
      { comboId, setupId },
      { onSuccess: onUnlinked },
    );
  };

  return {
    handleUnlink,
    isDeleting: unlinkMutation.isPending,
  };
}

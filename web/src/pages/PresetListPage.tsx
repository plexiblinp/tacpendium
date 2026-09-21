import { useMemo, useState } from "react";
import { toast } from "sonner";

import Header from "@/components/Header";
import { useConfig } from "@/features/config/useConfig";
import { useUpdateConfig } from "@/features/config/useUpdateConfig";
import {
  useCreatePreset,
  useDeletePreset,
  usePresets,
} from "@/features/preset/api";
import PresetCopyDialog from "@/features/preset/components/PresetCopyDialog";
import PresetDeleteConfirmDialog from "@/features/preset/components/PresetDeleteConfirmDialog";
import PresetListTable from "@/features/preset/components/PresetListTable";
import { useCurrentUser } from "@/features/user/CurrentUserProvider";
import { useUsers } from "@/features/user/useUsers";
import { presetErrorMessage } from "@/features/preset/errorMessage";
import { PRESET_TOTAL_LIMIT, type Preset } from "@/features/preset/types";

/**
 * PresetListPage はプリセット一覧画面(DES-005 §5.10 / ルート /presets)。
 *
 * M20-04 で新設。それまで /presets は router.tsx に定義が無く、Header の
 * リンクは disabled だった。
 */
export default function PresetListPage() {
  const presetsQuery = usePresets();
  const configQuery = useConfig();
  // ★FR013 後半: 他の利用者が作ったプリセットは「見えるが編集できない」。
  // 誰のものかを示すために現在の利用者と一覧を引く(CHANGE-113 §3.10)。
  const { current } = useCurrentUser();
  const { data: users } = useUsers();
  const createMutation = useCreatePreset();
  const deleteMutation = useDeletePreset();
  const updateConfig = useUpdateConfig();

  const [copyBase, setCopyBase] = useState<Preset | null>(null);
  const [copyError, setCopyError] = useState<string | undefined>();
  const [deleting, setDeleting] = useState<Preset | null>(null);

  const presets = useMemo(() => presetsQuery.data ?? [], [presetsQuery.data]);
  const builtins = useMemo(() => presets.filter((p) => p.isBuiltin), [presets]);
  const customs = useMemo(() => presets.filter((p) => !p.isBuiltin), [presets]);
  const limitReached = presets.length >= PRESET_TOTAL_LIMIT;

  const currentPresetId = configQuery.data?.defaults.presetId;
  const sampleCharacterId = configQuery.data?.defaults.characterId;

  const handleCopySubmit = (name: string) => {
    if (!copyBase) return;
    setCopyError(undefined);
    createMutation.mutate(
      { basePresetCode: copyBase.code, name },
      {
        onSuccess: (created) => {
          setCopyBase(null);
          toast.success(`「${created.name}」を作成しました`);
        },
        onError: (err) =>
          setCopyError(presetErrorMessage(err, "プリセットの作成に失敗しました")),
      },
    );
  };

  const handleDeleteConfirm = () => {
    if (!deleting) return;
    deleteMutation.mutate(deleting.id, {
      onSuccess: () => {
        toast.success(`「${deleting.name}」を削除しました`);
        setDeleting(null);
      },
      onError: (err) =>
        toast.error(presetErrorMessage(err, "プリセットの削除に失敗しました")),
    });
  };

  const handleUse = (preset: Preset) => {
    updateConfig.mutate(
      { defaults: { presetId: preset.id } },
      {
        onSuccess: () => toast.success(`「${preset.name}」を既定にしました`),
        onError: () => toast.error("既定プリセットの変更に失敗しました"),
      },
    );
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <Header />
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-lg font-bold text-slate-800">プリセット管理</h1>
          <span className="text-xs text-slate-500" data-testid="preset-count">
            {presets.length} / {PRESET_TOTAL_LIMIT} 件
          </span>
        </div>

        {presetsQuery.isLoading && (
          <p className="text-sm text-slate-500">読み込み中...</p>
        )}
        {presetsQuery.isError && (
          <p className="text-sm text-red-600">プリセット一覧の取得に失敗しました。</p>
        )}

        {limitReached && (
          <p
            className="mb-4 rounded border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800"
            data-testid="preset-limit-notice"
          >
            プリセットは全体で {PRESET_TOTAL_LIMIT} 件までです。新しく作るには、
            不要なカスタムプリセットを削除してください。
          </p>
        )}

        {presetsQuery.data && (
          <PresetListTable
            builtins={builtins}
            customs={customs}
            sampleCharacterId={sampleCharacterId}
            currentPresetId={currentPresetId}
            limitReached={limitReached}
            onCopy={(base) => {
              setCopyError(undefined);
              setCopyBase(base);
            }}
            onDelete={setDeleting}
            onUse={handleUse}
            isApplying={updateConfig.isPending}
            currentUserId={current?.id}
            ownerName={(userId) => users?.find((u) => u.id === userId)?.name}
          />
        )}

        <PresetCopyDialog
          open={copyBase != null}
          base={copyBase}
          onOpenChange={(open) => {
            if (!open) {
              setCopyBase(null);
              setCopyError(undefined);
            }
          }}
          onSubmit={handleCopySubmit}
          isSubmitting={createMutation.isPending}
          errorMessage={copyError}
        />

        <PresetDeleteConfirmDialog
          open={deleting != null}
          preset={deleting}
          isDefaultPreset={deleting != null && deleting.id === currentPresetId}
          onOpenChange={(open) => {
            if (!open) setDeleting(null);
          }}
          onConfirm={handleDeleteConfirm}
          isDeleting={deleteMutation.isPending}
        />
      </div>
    </main>
  );
}

import { useState } from "react";

import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { useTagManagement } from "@/features/tag/hooks/useTagManagement";
import { filterByText } from "@/lib/text-filter";
import type { Tag } from "@/types/tag";

import { TagDeleteConfirmDialog } from "./TagDeleteConfirmDialog";
import { TagFormDialog } from "./TagFormDialog";
import { TagListTable } from "./TagListTable";

export function TagManagementPage() {
  const { t } = useTranslation();
  const { tagsQuery, createMutation, updateMutation, deleteMutation } =
    useTagManagement();

  // M24-02 §4.4(SM-127-(a)): タグ管理画面の検索。クライアント側の絞り込みで足りる
  // (タグは 1 利用者ぶんであり、一覧取得は既存の ["tags"] で済む)。
  // ★絞り込みの対象はタグ名だけ。カテゴリ・色・使用コンボ数では絞らない(要求に無い)。
  const [search, setSearch] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [deletingTag, setDeletingTag] = useState<Tag | null>(null);

  const handleCreateClick = () => {
    setEditingTag(null);
    setFormOpen(true);
  };

  const handleEditClick = (tag: Tag) => {
    setEditingTag(tag);
    setFormOpen(true);
  };

  const handleDeleteClick = (tag: Tag) => {
    setDeletingTag(tag);
  };

  const handleFormSubmit = async (values: {
    name: string;
    category?: string;
    color?: string;
  }) => {
    // ★空文字 -> undefined の正規化は useTagFormDialog.ts:57-58 の `|| undefined` が既に済ませている。
    // ここに在った `?? undefined` は完全な no-op であったため外した(M35-01 段 3)。
    // ★`??` は空文字を透過するので、フック側の正規化が外れてもガードにはならない。
    // ⇒ 正規化を足すならフック側であり、ここではない。
    if (editingTag) {
      await updateMutation.mutateAsync({
        id: editingTag.id,
        input: {
          name: values.name,
          category: values.category,
          color: values.color,
        },
      });
      toast.success(t("tag.management.updated"));
    } else {
      await createMutation.mutateAsync({
        name: values.name,
        category: values.category,
        color: values.color,
      });
      toast.success(t("tag.management.created"));
    }
  };

  const handleDeleteConfirm = () => {
    if (!deletingTag) return;
    const usageCount = deletingTag.usageCount ?? 0;
    deleteMutation.mutate(
      { id: deletingTag.id, force: usageCount > 0 },
      { onSuccess: () => setDeletingTag(null) },
    );
  };

  const filteredTags = filterByText(tagsQuery.data ?? [], search, (tag) => [
    tag.name,
  ]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold text-slate-800">{t("tag.management.title")}</h1>
        <button
          type="button"
          onClick={handleCreateClick}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          {t("tag.management.create")}
        </button>
      </div>

      {tagsQuery.isLoading && (
        <p className="text-sm text-slate-500">{t("tag.management.loading")}</p>
      )}
      {tagsQuery.isError && (
        <p className="text-sm text-red-600">{t("tag.management.loadError")}</p>
      )}
      {tagsQuery.data && (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <Input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("tag.management.searchPlaceholder")}
              aria-label={t("tag.management.searchPlaceholder")}
              data-testid="tag-search"
              className="w-56"
            />
            {/* ★絞り込んだ結果の件数を出す。母数も併記しないと
                「0 件」がタグ 0 件なのか絞り込み結果なのか読み取れない。 */}
            <span className="text-sm text-slate-500" data-testid="tag-search-hits">
              {t("tag.management.count", {
                shown: filteredTags.length,
                total: tagsQuery.data.length,
              })}
            </span>
          </div>
          <TagListTable
            tags={filteredTags}
            onEdit={handleEditClick}
            onDelete={handleDeleteClick}
            searchQuery={search}
            onClearSearch={() => setSearch("")}
          />
        </>
      )}

      <TagFormDialog
        open={formOpen}
        tag={editingTag}
        onOpenChange={(open) => { if (!open) setFormOpen(false); }}
        onSubmit={handleFormSubmit}
      />

      <TagDeleteConfirmDialog
        open={deletingTag != null}
        tag={deletingTag}
        onOpenChange={(open) => { if (!open) setDeletingTag(null); }}
        onConfirm={handleDeleteConfirm}
        isDeleting={deleteMutation.isPending}
      />
    </div>
  );
}

import { useTranslation } from "react-i18next";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import type { Tag } from "@/types/tag";
import { TAG_CATEGORY_MYCOMBO_STATUS } from "@/constants/mycombo";

interface Props {
  tags: Tag[];
  onEdit: (tag: Tag) => void;
  onDelete: (tag: Tag) => void;
  /**
   * 絞り込み中の検索語(M24-02 §4.4)。空文字なら絞り込んでいない。
   *
   * ★0 件には 2 つの意味があり、区別しないと誤った案内をする:
   *   (a) そもそもタグが 1 件も無い → 「新規作成してください」
   *   (b) 絞り込みの結果 0 件      → 「検索条件を変えてください」
   *   本 prop が無かったときは (a) の文言を (b) にも出しており、
   *   タグを持っている利用者に「タグがありません」と言ってしまう形だった。
   */
  searchQuery?: string;
  onClearSearch?: () => void;
}

export function TagListTable({
  tags,
  onEdit,
  onDelete,
  searchQuery = "",
  onClearSearch,
}: Props) {
  const { t } = useTranslation();
  if (tags.length === 0) {
    // (b) 絞り込みで 0 件
    if (searchQuery.trim() !== "") {
      return (
        <p
          className="rounded border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800"
          data-testid="tag-list-empty-filtered"
          role="status"
        >
          {t("tag.table.emptyFiltered", { query: searchQuery })}
          {onClearSearch && (
            <button
              type="button"
              onClick={onClearSearch}
              className="ml-2 text-blue-600 underline"
            >
              {t("tag.table.clearSearch")}
            </button>
          )}
        </p>
      );
    }
    // (a) そもそもタグが無い
    return (
      <p className="text-sm text-slate-500 py-4" data-testid="tag-list-empty">
        {t("tag.table.empty")}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("tag.table.name")}</TableHead>
            <TableHead>{t("tag.table.category")}</TableHead>
            <TableHead>{t("tag.table.color")}</TableHead>
            <TableHead className="text-right">{t("tag.table.usageCount")}</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tags.map((tag) => (
            <TableRow key={tag.id}>
              <TableCell className="font-medium text-slate-900">{tag.name}</TableCell>
              <TableCell className="text-slate-600">{tag.category ?? t("tag.table.none")}</TableCell>
              <TableCell>
                {tag.color ? (
                  <span className="flex items-center gap-1.5">
                    <span
                      className="inline-block w-4 h-4 rounded-full border border-slate-200"
                      style={{ backgroundColor: tag.color }}
                      aria-hidden="true"
                    />
                    <span className="text-slate-600 text-xs">{tag.color}</span>
                  </span>
                ) : (
                  <span className="text-slate-400">{t("tag.table.none")}</span>
                )}
              </TableCell>
              <TableCell className="text-right text-slate-700">
                {tag.usageCount ?? 0}
              </TableCell>
              <TableCell>
                {tag.category !== TAG_CATEGORY_MYCOMBO_STATUS && (
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs text-blue-600"
                      onClick={() => onEdit(tag)}
                      aria-label={t("tag.table.editAria", { name: tag.name })}
                    >
                      {t("tag.table.edit")}
                    </Button>
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs text-red-500"
                      onClick={() => onDelete(tag)}
                      aria-label={t("tag.table.deleteAria", { name: tag.name })}
                    >
                      {t("tag.table.delete")}
                    </Button>
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

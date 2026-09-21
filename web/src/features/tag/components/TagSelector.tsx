import { useRef, useState } from "react";
import { X, ChevronDown } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { useListboxKeyNav } from "@/hooks/useListboxKeyNav";
import { handleTextDragPointerDown } from "@/lib/text-drag-capture";
import type { Tag } from "@/types/tag";
import { useTagsForSelector } from "@/features/tag/hooks/useTagsForSelector";
import { UNSET_TAG_COLOR_FALLBACK } from "@/features/tag/constants/tagColorPalette";
// ★★M24-07: 本部品の利用者はコンボ登録・編集エディタ 1 面だけであり、その画面は
//   全面が直書き日本語である(useTranslation 0)。t を通すと同じ画面に英語が 1 個混ざる
//   ——指示書 §2.3 が禁じる「1 画面で 2 系統が混ざる」形になる。
//   ⇒ 語の源泉は locale(tag.selector.*)のまま、ここでは日本語を固定で引く。
//   ★エディタが i18n 化されたら jaLabel を t へ差し替えるだけでよい。
import { jaLabel } from "@/lib/ja-label";
import { TagBadgeList } from "./TagBadgeList";

interface TagSelectorProps {
  selectedTagIds: number[];
  onChange: (tagIds: number[]) => void;
  excludeCategories?: string[];
  disabled?: boolean;
  onCreateTag?: (name: string) => Promise<number | null>;
  creating?: boolean;
}

export function TagSelector({
  selectedTagIds,
  onChange,
  excludeCategories,
  disabled = false,
  onCreateTag,
  creating = false,
}: TagSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  // ★★M27-02a(tag-field-keyboard-unreachable): 候補の矢印キー移動。
  //   実体は SearchableSelect と共有している(useListboxKeyNav)。
  //   ★本部品は SearchableSelect を使っていない別実装だが、キーボード操作だけは
  //     同じものを通す。⇒ 「キャラ選択では ↓ で候補へ入れるのにタグ欄では入れない」
  //     という同一画面内の非対称を作らない。
  const { listRef, handleListKeyDown } = useListboxKeyNav<HTMLUListElement>();
  const searchRef = useRef<HTMLInputElement>(null);

  const { filteredTags } = useTagsForSelector({ excludeCategories });

  const lowerSearch = search.toLowerCase();
  const matchingTags = filteredTags.filter((t) =>
    t.name.toLowerCase().includes(lowerSearch),
  );
  const showCreateOption =
    onCreateTag &&
    search.trim().length > 0 &&
    !filteredTags.some((t) => t.name.toLowerCase() === lowerSearch);

  function toggle(tag: Tag) {
    if (selectedTagIds.includes(tag.id)) {
      onChange(selectedTagIds.filter((id) => id !== tag.id));
    } else {
      onChange([...selectedTagIds, tag.id]);
    }
  }

  function remove(tagId: number) {
    onChange(selectedTagIds.filter((id) => id !== tagId));
  }

  async function handleCreate() {
    if (!onCreateTag) return;
    const name = search.trim();
    const newTagId = await onCreateTag(name);
    if (newTagId != null) {
      onChange([...selectedTagIds, newTagId]);
      setSearch("");
      // ★★作成すると showCreateOption が false になり、フォーカスが載っていた
      //   「新規登録」ボタンが unmount される。React はフォーカスを親へ戻さないので
      //   document.body へ落ち、以後 ↓ も Enter も候補へ届かなくなる。
      //   ⇒ 検索欄へ戻し、キーボードだけで続けて選べる状態を保つ。
      searchRef.current?.focus();
    }
  }

  const selectedTagObjects = filteredTags.filter((t) =>
    selectedTagIds.includes(t.id),
  );

  return (
    <div>
      <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearch(""); }}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className="flex min-h-[2.25rem] w-full flex-wrap items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1 text-left text-sm hover:border-gray-400 disabled:cursor-not-allowed disabled:bg-gray-50"
          >
            {selectedTagObjects.length === 0 ? (
              <span className="text-gray-400">{jaLabel("tag.selector.placeholder")}</span>
            ) : (
              <TagBadgeList tags={selectedTagObjects} size="sm" />
            )}
            <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-gray-400" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <div className="border-b border-gray-100 p-2">
            <Input
              autoFocus
              type="text"
              placeholder={jaLabel("tag.selector.searchPlaceholder")}
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleListKeyDown}
              // ★★M31-02 追補: 検索欄で始めたドラッグの文字選択が枠外で消える件の回避。
              //   実体は SearchableSelect と共有している(lib/text-drag-capture)。
              //   ★開発者が実機で確認して残っていた最後の 1 件である(2026-09-08)。
              onPointerDown={handleTextDragPointerDown}
            />
          </div>

          <ul
            ref={listRef}
            role="listbox"
            aria-multiselectable="true"
            onKeyDown={handleListKeyDown}
            className="max-h-48 overflow-y-auto"
          >
            {matchingTags.map((tag) => {
              const selected = selectedTagIds.includes(tag.id);
              return (
                <li key={tag.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => toggle(tag)}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 ${
                      selected ? "font-semibold" : ""
                    }`}
                  >
                    <span
                      className="inline-block h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: tag.color || UNSET_TAG_COLOR_FALLBACK }}
                    />
                    <span className="flex-1 text-left">{tag.name}</span>
                    {selected && <span className="text-blue-500">✓</span>}
                  </button>
                </li>
              );
            })}

            {matchingTags.length === 0 && !showCreateOption && (
              <li className="px-3 py-2 text-sm text-gray-400">
                {jaLabel("tag.selector.notFound")}
              </li>
            )}

            {showCreateOption && (
              <li>
                <button
                  type="button"
                  // ★「新規登録」行も候補列に含める——含めないと、検索して 0 件に
                  //   なったとき ↓ の行き先が無くなり、そこだけマウスが要る。
                  //   ★選べる対象ではないので aria-selected は常に false。
                  // ★★ただし作成中は候補列から外す。disabled な <button> は
                  //   フォーカスを受け取れないため、role="option" のまま残すと
                  //   「候補列に居るのに、進んでも何も起きない」場所になる
                  //   (この行が唯一の候補のとき ↓ が完全に無反応になる)。
                  role={creating ? undefined : "option"}
                  aria-selected={creating ? undefined : false}
                  disabled={creating}
                  onClick={handleCreate}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 disabled:text-gray-400"
                >
                  {creating
                    ? jaLabel("tag.selector.creating", { name: search.trim() })
                    : jaLabel("tag.selector.createNew", { name: search.trim() })}
                </button>
              </li>
            )}
          </ul>
        </PopoverContent>
      </Popover>

      {selectedTagObjects.length > 0 && !disabled && (
        <div className="mt-1 flex flex-wrap gap-1">
          {selectedTagObjects.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => remove(tag.id)}
              className="flex items-center gap-0.5 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-700 hover:bg-gray-200"
            >
              {tag.name}
              <X className="h-3 w-3" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

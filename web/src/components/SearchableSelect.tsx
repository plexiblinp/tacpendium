import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { useListboxKeyNav } from "@/hooks/useListboxKeyNav";
import { handleTextDragPointerDown } from "@/lib/text-drag-capture";
import { filterByText } from "@/lib/text-filter";
import { cn } from "@/lib/utils";

// 検索欄付きドロップダウンの単一正典(M24-02 §4.1 / §4.3)。
//
// ★同じ画面に 2 種類のドロップダウンを作らないため、選択系はここを通す。
//
// ★★利用箇所は増える。件数を本文へ書かないこと——書くと必ず失効する。
//   2026-09-08(M31-02)時点の実測: CharacterSelector(キャラ選択の共有部品。14 コントロール
//   / **12 ファイル**が使う) ／ コンボ一覧のタグフィルタ ／ 同・ヒット種別フィルタ ／
//   同・始動技フィルタ。⇒ **コンボ一覧の画面だけで 3 コントロールが本部品を通る**。
//   ⇒ **本部品を直したときに動く実 UI の総数 = 17 コントロール / 13 ファイル**
//     (CharacterSelector の 12 ファイル + ComboListFilters の 1 ファイル)。
//   ★★M27-03 時点の記述は CharacterSelector の欄に「13 ファイル」と書いていたが、
//     13 は**総数**の値である。⇒ CharacterSelector 単体では 12 が正しい
//     (CharacterSelector.tsx:25 が警告している「本コメント自身が grep に当たる」分)。
//   現在の利用箇所は `grep -rn "<SearchableSelect" web/src --include=*.tsx` で数えること。
//
// ★土台に Radix の DropdownMenu ではなく Popover を選んだ理由:
//   DropdownMenu.Content は typeahead(打鍵で項目へフォーカスを移す)を持っており、
//   中にテキスト入力を置くと検索語の打鍵を奪う。抑止すると矢印キー移動も死ぬ。
//   検索欄付きの実績は付与側 TagSelector(Popover + Input + ul)にあり、そこへ揃えた。
//   cmdk / command.tsx は未導入であり、入れると新規依存の提案になる(CLAUDE.md §6)。
//
// ★見た目と作法は列カスタマイズ(ColumnVisibilityMenu)に合わせてある:
//   トリガのクラス・複数選択時に連続トグルで閉じないこと・末尾のリセット行。
//   ColumnVisibilityMenu の実装そのものは触らない(指示書 §1.3-4 / §2.2)。

export type SearchableSelectValue = number | string;

export interface SearchableSelectOption<V extends SearchableSelectValue> {
  value: V;
  /** 一覧・トリガに出す表示名。 */
  label: string;
  /**
   * ★★M27-03(P4M-021): **閉じているとき(トリガ)にだけ**出す短縮表記。省略時は label。
   *
   * ★一覧の中は常に `label`(フル)である。⇒ 「閉じたら短縮・開いたらフル」を作る。
   * ★native `<select>` では作れない形である——HTML の仕様上、閉じた表示は
   *   選択中 `<option>` のテキストそのものだからである。
   * ★単一選択のトリガにのみ効く。複数選択のトリガは `triggerLabel` + 件数バッジであり、
   *   個々の option のラベルを出さない。
   */
  shortLabel?: string;
  /**
   * 検索の対象にする文字列群。省略時は [label, shortLabel]。
   * 例: キャラは [name_ja, name_en, code] を渡して「ryu」でも「リュウ」でも引けるようにする。
   */
  searchTexts?: readonly string[];
  /** 行頭に出す色ドット(タグの色など)。省略時は出さない。 */
  colorDot?: string;
}

interface BaseProps<V extends SearchableSelectValue> {
  options: readonly SearchableSelectOption<V>[];
  searchPlaceholder: string;
  /** 検索に一致するものが無いときの文言。 */
  emptyMessage: string;
  triggerAriaLabel?: string;
  disabled?: boolean;
  align?: "start" | "end";
  triggerClassName?: string;
  /** ポップオーバーの幅。既定はトリガ幅ではなく内容に応じた固定幅。 */
  contentClassName?: string;
  "data-testid"?: string;
}

interface MultiProps<V extends SearchableSelectValue> extends BaseProps<V> {
  mode: "multi";
  selected: readonly V[];
  onChange: (next: V[]) => void;
  /** トリガに常時出す見出し(例:「タグ」)。件数バッジがこの右に付く。 */
  triggerLabel: string;
  /** 末尾のリセット行の文言。省略すると行を出さない。 */
  clearLabel?: (count: number) => string;
}

interface SingleProps<V extends SearchableSelectValue> extends BaseProps<V> {
  mode: "single";
  selected: V | null;
  onChange: (next: V) => void;
  /** 未選択のときトリガに出す文言。 */
  placeholder: string;
}

type Props<V extends SearchableSelectValue> = MultiProps<V> | SingleProps<V>;

const TRIGGER_CLASS =
  "flex items-center gap-1 border border-slate-300 rounded px-2 py-1 text-sm bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed";

export function SearchableSelect<V extends SearchableSelectValue>(
  props: Props<V>,
) {
  const {
    options,
    searchPlaceholder,
    emptyMessage,
    triggerAriaLabel,
    disabled = false,
    align = "start",
    triggerClassName,
    contentClassName,
  } = props;
  const testId = props["data-testid"];

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // ★候補間の矢印キー移動(M24-02 レビュー 中-4)。
  //   旧実装は Radix Select であり ↑↓ で候補を移動できた。Popover + button の並びへ
  //   移した時点でその挙動が消えていたため、明示的に戻してある。
  //   検索欄からも ↓ で候補列へ入れる(検索して 1 件に絞ってから Enter、という流れを壊さない)。
  //
  // ★★M27-02a: 実体は useListboxKeyNav へ移した。現時点の DOM では挙動差は出ない
  //   (端での巡回・検索欄からの進入を含めて既存テストがそのまま緑である)。
  //   ★「1 つも変えていない」とは書かない——フック側の判定は HTMLButtonElement から
  //     HTMLElement へ 1 段広い。候補が <button> 以外になった日に差が出る。
  //   ⇒ 移した理由は、タグ欄が同じ操作を要求したためである
  //     (tag-field-keyboard-unreachable)。複製ではなく共有にした。
  const { listRef, handleListKeyDown } = useListboxKeyNav<HTMLUListElement>();

  const matching = filterByText(
    options,
    search,
    // ★短縮表記も検索に当てる。トリガに "PC" と出ているのに "PC" で引けないのは
    //   利用者から見て一貫しない(M27-03)。
    (o) => o.searchTexts ?? [o.label, o.shortLabel].filter((x): x is string => !!x),
  );

  const isSelected = (value: V) =>
    props.mode === "multi"
      ? props.selected.includes(value)
      : props.selected === value;

  function handlePick(value: V) {
    if (props.mode === "multi") {
      // ★選択のたびに閉じない(列カスタマイズの C-23 と同じ作法)。
      props.onChange(
        props.selected.includes(value)
          ? props.selected.filter((v) => v !== value)
          : [...props.selected, value],
      );
    } else {
      props.onChange(value);
      setOpen(false);
    }
  }

  let triggerContent: ReactNode;
  if (props.mode === "multi") {
    const count = props.selected.length;
    triggerContent = (
      <>
        <span>{props.triggerLabel}</span>
        {/* ★閉じた状態でも「何件選ばれているか」が分かること(指示書 §4.1)。
            選択が隠れると「絞り込んだまま忘れる」事故が起きる。 */}
        {count > 0 && (
          <span
            data-testid={testId ? `${testId}-count` : undefined}
            className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-blue-600 px-1.5 text-[11px] font-bold leading-none text-white"
          >
            {count}
          </span>
        )}
      </>
    );
  } else {
    const current = options.find((o) => o.value === props.selected);
    triggerContent = current ? (
      // ★★M27-03: 閉じているときは短縮表記(あれば)。一覧の中は常にフル。
      //
      // ★★`truncate` は `shortLabel` を持つ選択肢のときだけ当てる。
      //   無条件に当てると `overflow:hidden` が flex item の自動最小サイズを 0 にし、
      //   **幅を指定していない既存の利用箇所(CharacterSelector)が、狭い容器で
      //   従来は伸びていたのに省略記号で切られうる**。⇒ 挙動を変えない側へ倒す
      //   (M27-03 レビュー 中-6)。
      <span className={current.shortLabel ? "truncate" : undefined}>
        {current.shortLabel ?? current.label}
      </span>
    ) : (
      <span className="text-slate-400">{props.placeholder}</span>
    );
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-label={triggerAriaLabel}
          disabled={disabled}
          data-testid={testId}
          className={cn(TRIGGER_CLASS, triggerClassName)}
        >
          {triggerContent}
          <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align={align}
        className={cn("w-64 p-0", contentClassName)}
      >
        <div className="border-b border-slate-100 p-2">
          <Input
            autoFocus
            type="text"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleListKeyDown}
            onPointerDown={handleTextDragPointerDown}
          />
        </div>

        <ul
          ref={listRef}
          role="listbox"
          // ★M27-02a: 複数選択であることを支援技術へ出す(TagSelector と揃える)。
          aria-multiselectable={props.mode === "multi" ? true : undefined}
          onKeyDown={handleListKeyDown}
          className="max-h-48 overflow-y-auto"
        >
          {matching.map((option) => {
            const selected = isSelected(option.value);
            return (
              // role="option" は実際に押せる要素へ付ける。
              // li 側へ付けると支援技術・テストの双方でクリック対象と役割がずれる。
              <li key={String(option.value)}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => handlePick(option.value)}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50",
                    selected && "bg-blue-50 font-semibold text-blue-800",
                  )}
                >
                  {option.colorDot && (
                    <span
                      aria-hidden="true"
                      className="inline-block h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: option.colorDot }}
                    />
                  )}
                  <span className="flex-1 text-left">{option.label}</span>
                  {selected && <span aria-hidden="true" className="text-blue-600">✓</span>}
                </button>
              </li>
            );
          })}

          {matching.length === 0 && (
            <li className="px-3 py-2 text-sm text-slate-400">{emptyMessage}</li>
          )}
        </ul>

        {props.mode === "multi" &&
          props.clearLabel &&
          props.selected.length > 0 && (
            <div className="border-t border-slate-100 p-1.5">
              {/* ★閉じた状態から解除へ至る経路を 1 つ残す(指示書 §4.1)。 */}
              <button
                type="button"
                onClick={() => props.onChange([])}
                className="w-full px-2 py-1 text-left text-xs text-blue-600 hover:underline"
              >
                {props.clearLabel(props.selected.length)}
              </button>
            </div>
          )}
      </PopoverContent>
    </Popover>
  );
}

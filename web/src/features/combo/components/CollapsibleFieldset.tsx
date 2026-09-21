import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

interface Props {
  /** 見出し(従来の <legend> 相当)。 */
  legend: string;
  /** 初期表示状態。既定は展開(true)。M15-05 の要件で全節を初期展開とする。 */
  defaultOpen?: boolean;
  /**
   * 見出し直下に**開閉状態に関わらず常時表示**するサマリ(M15-05 追補)。
   * レシピ節で「畳んでも一目で内容が分かる」1行プレビューを出すために用いる。
   */
  summary?: ReactNode;
  children: ReactNode;
  /** 展開時のコンテンツラッパに付与するクラス(従来 fieldset の space-y-* を踏襲)。 */
  contentClassName?: string;
  /**
   * 制御モード(M24-02 §4.2)。open を渡すと開閉の状態は呼び出し側が持つ。
   * 未指定なら従来どおり内部 state(defaultOpen 起点)で動く。
   * ★一覧のフィルタ欄は開閉状態をブラウザストレージへ保持するため制御モードを使う。
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** 開閉トグルの文言。既定は登録画面の「隠す」「表示」。i18n 面から差し替えるために開けてある。 */
  openLabel?: string;
  closedLabel?: string;
  /**
   * summary をどこへ描くか(M24-02 追補・開発者要望)。
   *
   * - "below"(既定) = 見出し行の**下に別行**で描く。登録画面の従来どおりの形。
   * - "inline"       = 見出し行の**隣**に描く。★1 行ぶん縦が減る。
   *   逐語＝「少しでも縦の枠を確保するのが目的」(2026-08-26 開発者確認)。
   *
   * ★"inline" でも summary は <button> の外に置く。中へ入れると
   *   ボタンのアクセシブル名が summary の全文を含んで冗長になり、押下領域の意味も濁る。
   */
  summaryPlacement?: "below" | "inline";
  /**
   * summary を包む要素のクラス（M37-02 / B12）。既定は従来どおり `"mt-1"`。
   *
   * ★★なぜ prop が要るのか —— summary は下でハードコードの `<div className="mt-1">` に
   *   包まれており、**呼び出し側の要素へ `sticky` を付けても包みの高さぶんしか動けない**
   *   （sticky の移動量は包含ブロックが決める）。⇒ 包み側へクラスを届ける口が要る。
   * ★`summary` を渡す呼び出し元は `RecipeBuilder` の 1 つだけである（実測）。
   *   ⇒ 既定を今と同じ `"mt-1"` にしてあるため、他の呼び出し元は 1 つも動かない。
   */
  summaryClassName?: string;
  /** 外枠のクラス(既定は登録画面の枠)。フィルタ欄など別の面へ載せるときに差し替える。 */
  className?: string;
  "data-testid"?: string;
}

/**
 * CollapsibleFieldset は従来の `<fieldset>`+`<legend>` の見た目を保ったまま、
 * 見出しクリックで開閉できる折りたたみセクション。M15-05/FB① の登録画面整理で、
 * 使用頻度の低い節(起き攻め・マイコンボ・タグ)を畳めるようにするために用いる。
 * 中身のコンポーネント(TagSelector 等)は不変で、外枠のみをラップする。
 */
export function CollapsibleFieldset({
  legend,
  defaultOpen = true,
  summary,
  children,
  contentClassName = "space-y-2",
  open: controlledOpen,
  onOpenChange,
  openLabel = "隠す",
  closedLabel = "表示",
  summaryPlacement = "below",
  summaryClassName = "mt-1",
  className,
  ...rest
}: Props) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const headingId = useId();
  const contentId = useId();
  const toggleTextId = useId();

  const inline = summaryPlacement === "inline";

  function toggle() {
    const next = !open;
    if (!isControlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
  }

  return (
    <section
      aria-labelledby={headingId}
      className={cn("rounded-lg border border-gray-300 p-4", className)}
      {...rest}
    >
      {inline ? (
        // ★inline: 見出し / 要約 / トグル の 3 分割。
        //   要約を見出しと同じ行へ置いて縦を 1 行ぶん節約しつつ、
        //   「隠す/表示」は従来どおり行の右端に置く(2026-08-26 開発者要望)。
        <div className="flex items-center gap-2">
          <span id={headingId} className="shrink-0 text-sm font-semibold">
            {legend}
          </span>
          {summary != null && <div className="min-w-0 flex-1">{summary}</div>}
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            aria-controls={contentId}
            // ★見出しがボタンの外へ出たぶん、アクセシブル名を明示で組み立てる。
            //   これが無いとトグルの名前が「隠す」だけになり、
            //   どの節のトグルなのかが読み上げから落ちる。
            aria-labelledby={`${headingId} ${toggleTextId}`}
            className="ml-auto flex shrink-0 items-center gap-1"
          >
            <span
              id={toggleTextId}
              className="text-xs font-normal text-gray-500"
            >
              {open ? openLabel : closedLabel}
            </span>
            <ChevronDown
              aria-hidden="true"
              className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`}
            />
          </button>
        </div>
      ) : (
        // "below"(既定): 従来どおり全幅ボタン ＋ 見出し行の下に要約。
        <>
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            aria-controls={contentId}
            className="flex w-full items-center justify-between text-sm font-semibold"
          >
            <span id={headingId}>{legend}</span>
            <span className="ml-2 flex shrink-0 items-center gap-1">
              <span className="text-xs font-normal text-gray-500">
                {open ? openLabel : closedLabel}
              </span>
              <ChevronDown
                aria-hidden="true"
                className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`}
              />
            </span>
          </button>
          {summary != null && <div className={summaryClassName}>{summary}</div>}
        </>
      )}
      {open && (
        <div id={contentId} className={`mt-2 ${contentClassName}`}>
          {children}
        </div>
      )}
    </section>
  );
}

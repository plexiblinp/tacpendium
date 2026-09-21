import { useRef, type KeyboardEvent, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import { indexForShortcutKey, shortcutKeyForIndex } from "../optionButtons";

// M24-12: 選択肢のボタン群。**汎用部品として 1 つだけ置く**(指示書 §4.3)。
//
// ★★同じ形を各欄へ複製しない。複製すると選択肢の見た目がすぐ割れる
//   (M24-03 レビュー 高-2 が起き攻めラベルで指摘したのと同じ型)。
//
// ★単一選択(状況の 4 欄・マイコンボ)と複数選択(起き攻め)の両方をここが受ける。
//   見分けが付くよう、複数選択にはチェック記号を出す。
//
// ★数字キーのショートカットは**この群にフォーカスがある間だけ**効く。
//   ⇒ 大域のキーハンドラを増やさない。第 3 段の順送りはフォーカスを群から群へ
//     移すだけでよく、ショートカットの仕組みには触らない。
//
// ★★`role="radiogroup"` の ARIA 慣習では矢印キーで候補を移るが、**本部品は採っていない**。
//   矢印（↑↓）は順送りが「次の欄へ」に使っており、群の中の移動と衝突するためである。
//   ⇒ 群の中で別の選択肢を選ぶのは**数字キー**の役割にした（roving tabindex と対）。
//   ★この差は意図的である。ARIA 慣習に寄せるなら順送りのキーごと設計し直す必要がある。

interface OptionItem {
  value: string;
  label: string;
}

type Props = {
  options: readonly OptionItem[];
  /** 読み上げ用のラベル(どの欄の選択肢かを示す)。 */
  ariaLabel: string;
  /**
   * data-testid の接頭辞。個々のボタンは `${testIdPrefix}-${value}` になる。
   * ★★**空文字の値だけは例外で `${testIdPrefix}-unspecified` になる**
   *   (下の描画を参照。`value || "unspecified"`)。⇒ testid は空にできないためである。
   * ★E2E がこの変換に依存している(「中立の選択肢が在る / 無い」を testid で見る)。
   */
  testIdPrefix: string;
  disabled?: boolean;
  /** 非活性の理由(確定反撃サーチ経由でヒット種別を固定している等)。 */
  disabledReason?: string;
  /**
   * 列数。指定すると N 列のグリッドに並べる。
   * ★起き攻めで「その場受け身の行 / 後ろ受け身の行」に分けるために使う
   *   (2026-08-28 開発者指示)。未指定なら折り返しの自然な並び。
   */
  columns?: number;
  /** 群の右肩に出す小さな注記(例「複数選択可」)。 */
  hint?: ReactNode;
  /**
   * 見た目の種類。
   *
   * ★★`"pill"` は **M37-01(2026-09-13 開発者選択・案 B)** で足した。
   *   用途は「**値**を選ぶ群」と「**入力方式**を選ぶ群」を見分けさせることである
   *   —— 同じ見た目で 2 段並ぶと、どこまでが方式でどこからが値か読めない。
   *   ⇒ 方式側を **一回り小さい丸ピル・選択色は青ではなく slate** にして役割を分ける。
   *   ★★挙動は 1 つも変えない —— 数字キー・roving tabindex・`radiogroup` は共通である。
   *     ⇒ 見た目だけの分岐であり、分岐を増やすのはこの className の 2 か所だけ。
   */
  variant?: "default" | "pill";
} & (
  | { mode: "single"; value: string; onChange: (value: string) => void }
  | {
      mode: "multiple";
      values: readonly string[];
      onToggle: (value: string) => void;
    }
);

export function OptionButtonGroup(props: Props) {
  const {
    options,
    ariaLabel,
    testIdPrefix,
    disabled = false,
    disabledReason,
    columns,
    hint,
    variant = "default",
  } = props;
  const isPill = variant === "pill";
  const containerRef = useRef<HTMLDivElement>(null);

  const isOn = (value: string): boolean =>
    props.mode === "single"
      ? props.value === value
      : props.values.includes(value);

  // roving tabindex の受け手。選ばれているものがあればそれ、無ければ先頭。
  // ★複数選択では最初に選ばれているものを受け手にする(先頭固定だと、選んだ位置と
  //   Tab で戻ってくる位置が食い違う)。
  const rovingIndex = Math.max(
    0,
    options.findIndex((o) => isOn(o.value)),
  );

  const activate = (value: string) => {
    if (disabled) return;
    if (props.mode === "single") props.onChange(value);
    else props.onToggle(value);
  };

  // ★数字キーで n 番目を選ぶ/トグルする。
  //   ★★単一選択でも「押したら次の欄へ進む」はしない——複数選択(起き攻め)では
  //     続けて何個も押すため進めては困る。**挙動を 2 種類作らない**ために、
  //     どちらも数字では進まない形に揃えてある(進むのは Tab / Enter / ↓)。
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    // ★★他のハンドラが既に自分のキーとして扱ったなら触らない。
    //   ★物理キーボード入力(M21-05)は window の capture 段で動き、利用者が
    //     割り当てたキーに対して `preventDefault()` を呼ぶ。ここで見ないと、
    //     数字を技へ割り当てている利用者では**レシピにステップが入ると同時に
    //     選択肢もトグルされる**（二重発火）。
    if (event.defaultPrevented) return;
    // ★修飾キー付きはブラウザ/OS の割当なので奪わない。
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const index = indexForShortcutKey(event.key);
    if (index === null || index >= options.length) return;
    event.preventDefault();
    const target = options[index];
    activate(target.value);
    // ★押した選択肢へフォーカスを移す。押した結果がどれかを目で追えるようにするため。
    containerRef.current
      ?.querySelector<HTMLButtonElement>(`[data-option-index="${index}"]`)
      ?.focus();
  };

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <div
        ref={containerRef}
        role={props.mode === "single" ? "radiogroup" : "group"}
        aria-label={ariaLabel}
        data-testid={testIdPrefix}
        onKeyDown={handleKeyDown}
        className={cn(
          "gap-1",
          columns ? "grid" : "flex flex-wrap",
          disabled && "opacity-60",
        )}
        style={
          columns
            ? { gridTemplateColumns: `repeat(${columns}, minmax(0, max-content))` }
            : undefined
        }
      >
        {options.map((option, index) => {
          const on = isOn(option.value);
          const shortcut = shortcutKeyForIndex(index);
          return (
            <button
              key={option.value}
              type="button"
              data-option-index={index}
              // ★★M24-12(第 3 段): roving tabindex。群の中で Tab できるのは 1 つだけに
              //   する ⇒ **群全体が順送りの 1 停止**になる。
              //   ★これが無いと Tab が選択肢の数だけ止まり、「Tab で次の欄へ」が
              //     成立しない(始動位置だけで 6 回押すことになる)。
              //   ★群の中で別の選択肢を選ぶのは数字キーの役割である。
              tabIndex={index === rovingIndex ? 0 : -1}
              // ★`-unspecified` は**空文字の値を testid にするための識別子**であり、
              //   画面の呼び名ではない（画面では「不問」と出る）。
              //   ★呼び名が変わっても**この識別子は変えないこと**——E2E が指している。
              data-testid={`${testIdPrefix}-${option.value || "unspecified"}`}
              disabled={disabled}
              title={disabled ? disabledReason : undefined}
              // 単一選択はラジオ、複数選択はチェックボックスとして読み上げる。
              role={props.mode === "single" ? "radio" : "checkbox"}
              aria-checked={on}
              onClick={() => activate(option.value)}
              className={cn(
                "inline-flex items-center border",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "disabled:cursor-not-allowed",
                isPill
                  ? "gap-1 rounded-full px-2.5 py-0.5 text-xs"
                  : "gap-1.5 rounded px-2 py-1 text-sm",
                on
                  ? isPill
                    ? "border-slate-700 bg-slate-700 font-semibold text-white"
                    : "border-blue-600 bg-blue-600 font-semibold text-white"
                  : isPill
                    ? "border-input bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
                    : "border-input bg-background text-foreground hover:bg-accent",
              )}
            >
              {shortcut && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "font-mono text-[10px] leading-tight",
                    // ★pill は枠を持たない —— 小さい丸の中に囲みを入れると窮屈で、
                    //   「数字も押せるもの」に見えてしまう。⇒ 見出しの数字として置く。
                    isPill
                      ? on
                        ? "text-white/80"
                        : "text-muted-foreground"
                      : cn(
                          "rounded border px-1",
                          on
                            ? "border-white/60 text-white"
                            : "border-input text-muted-foreground",
                        ),
                  )}
                >
                  {shortcut}
                </span>
              )}
              {/* ★複数選択は記号で見分ける——単一選択と同じ見た目にすると
                  「1 つしか選べない」と誤読される。 */}
              {props.mode === "multiple" && (
                <span aria-hidden="true">{on ? "☑" : "☐"}</span>
              )}
              {option.label}
            </button>
          );
        })}
      </div>
      {hint && (
        <span className="text-xs text-muted-foreground">{hint}</span>
      )}
      {disabled && disabledReason && (
        <span className="text-xs text-muted-foreground">{disabledReason}</span>
      )}
    </div>
  );
}

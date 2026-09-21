interface Props {
  open: boolean;
  onToggle: () => void;
  /** 開閉に関わらず出す見出し語。★アクセシブル名になる。 */
  label: string;
  /** 制御対象の id(aria-controls)。省略可。 */
  controls?: string;
  "data-testid"?: string;
}

/**
 * 「▶ / ▼ ＋ 見出し語」の折りたたみトグル。
 *
 * ★★M30-02 追補(2026-09-09 開発者の実機確認): OD 強度組合せの見出しが
 *   「押下可能なエリアであることが現状のデザインではわかりにくい」と指摘された。
 *   着手時点は CollapsibleFieldset の「表示 ▼」であり、枠も背景も持たない薄い文字だった。
 *
 * ★★見た目は**同じ画面に既に在るトグル**から採った —— 全技一覧の
 *   `recipe-pulldown-toggle`(`RecipeBuilder.tsx` ／ `SetupRecipeEditor.tsx:209-217`)。
 *   ⇒ 新しい流儀を作っていない。**画面内の 2 つ目の流儀へ寄せただけである。**
 *   ★上記 2 か所は本部品を使っていない(着手時点の記述のまま)。**⇒ 見た目を変えるときは
 *     3 か所を同じ手番で動かすこと。** 本部品へ寄せる整理は別の手番の候補である。
 *
 * ★`CollapsibleFieldset` は置き換えない —— 同部品は登録画面の 5 節とコンボ一覧の
 *   フィルタ欄が使っており、見た目を変えると 6 面へ波及する。
 */
export function DisclosureToggleButton({
  open,
  onToggle,
  label,
  controls,
  ...rest
}: Props) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={controls}
      className="rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium hover:bg-gray-100"
      {...rest}
    >
      {open ? "▼" : "▶"} {label}
    </button>
  );
}

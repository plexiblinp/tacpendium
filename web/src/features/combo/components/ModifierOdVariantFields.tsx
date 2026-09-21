import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";

import { Checkbox } from "@/components/ui/checkbox";
import type { Move } from "@/features/moves/types";

import { isOdVariantApplicable } from "../inputResolution";
import { MODIFIER_OD_VARIANT_FLAGS } from "../labels";
import { DisclosureToggleButton } from "./DisclosureToggleButton";

// ★★M30-02(SD-020): OD 強度組合せ(od_lm / od_mh / od_lh)の選択欄。
//
// ★2 面が同じ部品を描く —— RecipeBuilder(これから足すステップのインライン行)と
//   ModifiersEditor(既存ステップのダイアログ。コンボ登録とセットプレイが共有)。
//   ★★片面だけ直すともう片面が残る(followup `sd-020-od-variants-two-surfaces`)。
//   ⇒ 条件を画面側へ散らさず、本部品 1 つに持たせる。
//
// 本部品が守るのは 2 つである。
//   (1) ★★そもそも出さない —— そのステップが必殺技の OD でなければ節ごと描かない
//       (2026-09-09 開発者の判断。逐語＝「そもそも必殺技以外なら OD 強度組合せを
//        出さない事はできませんか?」)。★着手時点は「常に出して中身を disabled」だった。
//   (2) 既定は畳む —— 出す場合も既定非表示にし、展開で 3 つとも出す(D-722 の (b))。
//
// ★★★例外が 1 つだけある —— **既に値が入っているときは、非適用でも出す**。
//   出さないと外せなくなり、「開いたら消えていた」状態を作る。
//   ⇒ そのときは自動で展開し、チェックも操作できるままにする。
//   ★抑止しているのは新規付与だけである、という方針は着手時点から変えていない。
//
// ★★M30-02 レビュー 中-5: 文言は locale が正典である。
//   ★仮想コントローラ側の折りたたみと**同じ語**を出すため、同じキーを共有する
//     (`controller.special.odVariantsLegend`)。**2 つの経路を持たせない**——
//     片方だけ直すと、単体・E2E が共有している名前セレクタが片面だけ通る。

interface Props {
  /** 現在選択されている modifiers.flags。 */
  flags: string[];
  /** チェックの反転。呼び出し側の既存 toggle をそのまま渡す。 */
  onToggle: (flag: string) => void;
  /** 対象ステップの move。非技ステップ・未選択なら undefined / null。 */
  move: Move | null | undefined;
  /** "dialog" = 縦並び(shadcn Checkbox) ／ "inline" = 横並び(素の input)。 */
  layout: "dialog" | "inline";
}

export function ModifierOdVariantFields({ flags, onToggle, move, layout }: Props) {
  const { t } = useTranslation();
  const applicable = isOdVariantApplicable(move);
  const hasSelected = MODIFIER_OD_VARIANT_FLAGS.some((f) => flags.includes(f.value));
  const [open, setOpen] = useState(false);
  const contentId = useId();

  // ★値が入っているときは自動で開く。閉じたまま出すと「付けた覚えのある値が消えた」に見える。
  //   ★開く方向にしか働かせない —— 利用者が自分で閉じたものを開き直さない。
  useEffect(() => {
    if (hasSelected) setOpen(true);
  }, [hasSelected]);

  // ★★必殺技の OD でなく、値も入っていなければ節ごと出さない。
  if (!applicable && !hasSelected) return null;

  return (
    <div className="space-y-1" data-testid={`recipe-od-variant-section-${layout}`}>
      <DisclosureToggleButton
        open={open}
        onToggle={() => setOpen((v) => !v)}
        label={t("controller.special.odVariantsLegend")}
        controls={contentId}
        data-testid={`recipe-od-variant-toggle-${layout}`}
      />
      {open && (
        <div
          id={contentId}
          className={
            layout === "inline"
              ? "flex flex-wrap items-center gap-2"
              : "space-y-1"
          }
        >
          {MODIFIER_OD_VARIANT_FLAGS.map((f) => {
            const checked = flags.includes(f.value);
            // ★既に入っている値は外せる。抑止するのは新規付与だけである。
            const disabled = !applicable && !checked;
            return layout === "dialog" ? (
              <label
                key={f.value}
                className="flex items-center gap-2 text-sm text-gray-800"
              >
                <Checkbox
                  checked={checked}
                  disabled={disabled}
                  onCheckedChange={() => onToggle(f.value)}
                />
                {f.label}
              </label>
            ) : (
              <label key={f.value} className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => onToggle(f.value)}
                />
                {f.label}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { useId, useState, type CSSProperties } from "react";

import type { Move } from "@/features/moves/types";

import type {
  OdVariant,
  SpecialStrength,
  SpecialVariant,
} from "../../inputResolution";
import {
  OD_VARIANT_FLAG,
  OD_VARIANT_ORDER,
  deriveSpecialFamilies,
} from "../../inputResolution";
import { DisclosureToggleButton } from "../DisclosureToggleButton";
import type { ButtonTone } from "./ControllerButton";
import { ControllerButton } from "./ControllerButton";
import { useTranslation } from "react-i18next";

// 必殺技クイック入力面(直接指定、DES-004 §2.1)。
//
// ★★【2026-09-09 更新・M30-02】段が 2 つから 3 つになった(レビュー 高-1)。
//   上段 = 技名(ファミリー)選択
//   中段 = **変種**(通常 / ホールド / 最大ホールド / ジャスト)。★変種が 1 つなら行ごと出さない
//          (P4M-018 案 B。着手時点はホールド版が**上段に別ファミリーとして**並んでいた)
//   下段 = 選択ファミリー × 選択変種の強度。**★「強度なし通常版」を含む**(P4M-016)。
//          ★弱中強の行は、そのいずれかが在るときだけ描く。
//          ★非プレーン OD 3 種は**既定非表示・展開で出す**(SD-020)。
// 存在する強度のみ活性(データ駆動)。非プレーン OD は同一 <family>_od に解決し modifiers.flags を付与。
// 死守2: 236 等のモーションを実演させない(技名→強度を押すだけ)。

// ★M24-07(CO-020): 文言は locale が正典。ここは i18n キーだけを持つ。
const PLAIN_STRENGTHS: ReadonlyArray<{
  s: Exclude<SpecialStrength, "od" | "none">;
  labelKey: string;
  tone: ButtonTone;
}> = [
  { s: "light", labelKey: "controller.special.light", tone: "light" },
  { s: "medium", labelKey: "controller.special.medium", tone: "medium" },
  { s: "heavy", labelKey: "controller.special.heavy", tone: "heavy" },
];

// ★plain だけは記号表記そのもの(翻訳しない)。他は locale キー。
const OD_LABEL_KEY: Record<Exclude<OdVariant, "plain">, string> = {
  lm: "controller.special.odLm",
  mh: "controller.special.odMh",
  lh: "controller.special.odLh",
};

const OD_PLAIN_LABEL = "OD";

// ★★M37-02(B13): OD 組合せの**見えるラベル**を短縮する。
//   見出し(`odVariantsLegend` = 「OD 強度組合せ」)が真上に在るため、各ボタンが
//   もう一度「OD(」を名乗るのは重複であり、右カラムでは折り返しの原因になる。
//   ★★読み上げ名(`aria`)は従来どおり `OD(弱中)` の完全形を渡す。⇒ 目で見える字数だけを削る。
//   ★`labels.ts` の `MODIFIER_OD_VARIANT_FLAGS` と Go の `flagText` は**別物であり触らない**
//     —— あちらは modifier の表示語(`DES-004` §2.3 の正典)である。
const OD_SHORT_LABEL_KEY: Record<Exclude<OdVariant, "plain">, string> = {
  lm: "controller.special.odLmShort",
  mh: "controller.special.odMhShort",
  lh: "controller.special.odLhShort",
};

/**
 * 1 行に必ず収める列数。
 *
 * ★★★`B13` の要求は開発者の逐語で「強度はなし、弱、中、強、OD が 1 行で並ぶ程度の横幅」。
 *   ⇒ `flex-wrap` だと幅次第で折り返すため、**項目数そのものを列数にした grid** にする。
 *   列が狭くなっても `size="chip"` が `whitespace-nowrap` を持つので折り返さない。
 */
function oneRow(count: number): CSSProperties {
  // ★`repeat(0, ...)` は CSS として無効である。0 になる経路は現状無いが安く塞げる。
  return {
    gridTemplateColumns: `repeat(${Math.max(1, count)}, minmax(0, 1fr))`,
  };
}

// ★★M30-02(P4M-018 案 B): 変種(ホールド / 最大ホールド / ジャスト)の i18n キー。
//   ★文言は locale が正典(M24-07 / CO-020)。ここはキーだけを持つ。
// ★レビュー 低-1: `data-testid` は小文字ケバブケース(testid-convention.md)。
//   ⇒ 列挙値 `max_holding` をそのまま埋めない。**本サブで新設した id であり、
//     まだどこへも配布されていないうちに規約へ合わせる。**
const VARIANT_TESTID: Record<SpecialVariant, string> = {
  plain: "plain",
  holding: "holding",
  max_holding: "max-holding",
  perfect: "perfect",
};

const VARIANT_LABEL_KEY: Record<SpecialVariant, string> = {
  plain: "controller.special.variantPlain",
  holding: "controller.special.variantHolding",
  max_holding: "controller.special.variantMaxHolding",
  perfect: "controller.special.variantPerfect",
};

interface Props {
  moves: Move[];
  onAdd: (moveId: number, flags?: string[]) => void;
}

export function SpecialMovePanel({ moves, onAdd }: Props) {
  const { t } = useTranslation();
  const families = deriveSpecialFamilies(moves);
  const [selectedFamily, setSelectedFamily] = useState<string | null>(null);
  // ★変種の選択はファミリーごとに独立している。★ファミリーを変えたら通常へ戻す
  //   —— 前のファミリーで選んだ「ホールド」が、次のファミリーへ持ち越されると
  //   「押した覚えのない変種で確定する」ことになる。
  const [selectedVariant, setSelectedVariant] = useState<SpecialVariant>("plain");
  // OD 強度組合せの折りたたみ(SD-020。既定は畳む)。
  const [odVariantsOpen, setOdVariantsOpen] = useState(false);
  const odVariantsId = useId();

  if (families.length === 0) {
    return (
      <p className="rounded border border-dashed border-gray-300 p-3 text-center text-xs text-gray-500">
        {t("controller.special.empty")}
      </p>
    );
  }

  // 選択中ファミリー(未選択/キャラ切替で不整合なら先頭にフォールバック)。
  // ★★【2026-09-10・M30-04】並び順は `deriveSpecialFamilies` が決める(非 derived の群 →
  //   derived の群。群の中は初出順)。⇒ ここで並べ替えないこと。
  //   ★フォールバック先の `families[0]` は非 derived の群の先頭になる。31 キャラの実測で
  //     index 0 が derived になるキャラは 0 件であり、既定選択は M30-04 で動いていない。
  const selected =
    families.find((f) => f.family === selectedFamily) ?? families[0];
  const selectedName = selected.nameJa ?? selected.family;
  // 選択中の変種(そのファミリーに無ければ通常へフォールバック)。
  const variant = selected.variants.includes(selectedVariant)
    ? selectedVariant
    : "plain";
  const byStrength = selected.byVariant[variant] ?? {};
  const odId = byStrength.od;
  const noneId = byStrength.none;
  const hasPlainStrength = PLAIN_STRENGTHS.some(({ s }) => byStrength[s] != null);
  // ★1 行に並べる項目数(なし / 弱中強 / OD)。列数をこの数に合わせて折り返しを起こさない。
  const strengthCount =
    (noneId != null ? 1 : 0) +
    (hasPlainStrength ? PLAIN_STRENGTHS.length : 0) +
    (odId != null ? 1 : 0);
  const odVariants = OD_VARIANT_ORDER.filter(
    (v): v is Exclude<OdVariant, "plain"> => v !== "plain",
  );

  return (
    <div
      className="rounded border border-gray-300 bg-gray-50 p-2.5"
      // ★M37-02 段 1: 縦寸法の計測アンカー(描画には影響しない)。
      data-testid="recipe-special-panel"
    >
      {/*
        ★★★M37-02(B08 / B09 / B13): 縦積み 3 段 → 左右 2 カラムへ組み替えた。
          着手前は family / 変種 / 強度 が**すべて縦に積まれ、上限も無かった**ため、
          blanka(family 21)では必殺技パネルだけで 1086px あった(段 1 の実測・幅 390)。

        ★`sm` で分ける。通常技(`HitBoxLayout`)が既に使っている境目に揃えてある
          —— タブを跨いで折り返し方が違うと、幅を変えたときの挙動が読めなくなる。
        ★狭い幅では**分けないほうが縦が短い**。右カラムを 100px 級まで詰めると
          チップが 1 個ずつ縦に並び、左右に分けた意味が消えるためである。
      */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
        {/*
          左: ファミシー一覧。★★**このパネルで唯一のスクロール容器**である。

          ★★★パネル全体を 1 つのスクローラにしないこと —— 末尾の family を選ぶと
            右上の強度ボタンが箱の外へ出て往復が生まれ、`B09` が消そうとしている
            「レシピが視界から出る」形が 1 階層内側で再現する(指示書 §2.4)。
          ★★上限は `rem` で置く。`vh` にすると**モバイルで URL バーの開閉に合わせて
            パネルが伸縮し、操作中にボタンが指の下で動く**。`B09` の逐語は
            「区画を固定して」であり、ビューポート相対は固定ではない。
          ★★`overscroll-contain` は必須。無いと末尾でスクロールがページへ連鎖し、
            レシピが画面外へ出る —— 防ごうとしている当のものが戻る。
          ★`min-w-0` を落とすと flex 子が縮まず横へ溢れる。
        */}
        <div
          className="max-h-[11.5rem] min-w-0 flex-1 overflow-y-auto overscroll-contain pr-1 sm:max-h-[16rem] md:max-h-[18rem]"
          /* ★接頭辞走査(`[data-testid^="recipe-special-family-"]`)を汚さない別名前空間。
               `m30-04` の E2E と本サブの計測 spec がその形で family を数えている。 */
          data-testid="recipe-scroll-special-family"
        >
          {/* ★並びは deriveSpecialFamilies の出力順そのもの(M30-04: is_derived のファミリーが
              末尾へ回る)。ここで sort しない。★`.map` を 1 つの容れ物に 1 回だけ保つ ——
              `m30-04` の床が DOM 順で全 21 件を読んでいる。 */}
          <div className="grid grid-cols-3 gap-1.5">
            {families.map((fam) => {
              const name = fam.nameJa ?? fam.family;
              return (
                <ControllerButton
                  key={fam.family}
                  label={name}
                  aria={name}
                  size="move"
                  active={fam.family === selected.family}
                  onClick={() => {
                    setSelectedFamily(fam.family);
                    setSelectedVariant("plain");
                  }}
                  testId={`recipe-special-family-${fam.family}`}
                />
              );
            })}
          </div>
        </div>

        {/* 右: 選択中ファミリーの 種類 / 強度 / OD 組合せ。 */}
        <div className="w-full shrink-0 border-t border-gray-200 pt-2 sm:w-60 sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0">
          {/*
            ★★★技名は**ここで 1 回だけ**出す。
              着手前は見出しが `{{name}} の種類` / `{{name}} の強度` と技名を 2 回補間しており、
              右カラム幅では「【ライトニングビースト】ローリングアタック の強度」が
              4 行に折り返した。⇒ 見出し 2 本だけで `B08` の利得を食い潰す。
              ⇒ 技名は 1 行に truncate し、見出しは静的な短ラベルにした。
          */}
          <p
            className="truncate text-xs font-medium text-gray-700"
            title={selectedName}
            data-testid="recipe-special-selected-name"
          >
            {selectedName}
          </p>

          {selected.variants.length > 1 && (
            <div className="mt-1.5">
              <p className="text-[0.7rem] leading-tight text-gray-500">
                {t("controller.special.variantLabel")}
              </p>
              <div
                className="mt-1 grid gap-1.5"
                style={oneRow(selected.variants.length)}
              >
                {selected.variants.map((v) => (
                  <ControllerButton
                    key={v}
                    label={t(VARIANT_LABEL_KEY[v])}
                    aria={`${selectedName} ${t(VARIANT_LABEL_KEY[v])}`}
                    size="chip"
                    active={v === variant}
                    onClick={() => setSelectedVariant(v)}
                    testId={`recipe-special-variant-${VARIANT_TESTID[v]}`}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="mt-1.5">
            <p className="text-[0.7rem] leading-tight text-gray-500">
              {t("controller.special.strengthLabel")}
            </p>
            {/*
              ★★★なし / 弱 / 中 / 強 / OD を**1 行に並べる**(2026-09-13 開発者の逐語)。
                ⇒ `flex-wrap` ではなく「項目数 = 列数」の grid にする。幅が狭まっても
                  列が細くなるだけで折り返さない(`size="chip"` が `whitespace-nowrap`)。
              ★★M30-02(P4M-016)の「強度なし通常版」は残す —— 強度接尾辞を持たない 187 件が
                これでしか出せない。★ただしラベルは 1 行に収めるため短縮せず、
                `chip` の nowrap に任せる。
              ★強度色(弱=水色 / 中=黄 / 強=赤 / OD=灰)は**維持する**
                (2026-09-13 開発者の指示)。
            */}
            <div className="mt-1 grid gap-1.5" style={oneRow(strengthCount)}>
              {noneId != null && (
                <ControllerButton
                  label={t("controller.special.none")}
                  aria={`${selectedName} ${t("controller.special.none")}`}
                  size="chip"
                  onClick={() => onAdd(noneId)}
                  testId="recipe-special-strength-none"
                />
              )}
              {hasPlainStrength &&
                PLAIN_STRENGTHS.map(({ s: st, labelKey, tone }) => {
                  const id = byStrength[st];
                  return (
                    <ControllerButton
                      key={st}
                      label={t(labelKey)}
                      aria={`${selectedName} ${t(labelKey)}`}
                      size="chip"
                      tone={tone}
                      disabled={id == null}
                      onClick={() => id != null && onAdd(id)}
                      testId={`recipe-special-strength-${st}`}
                    />
                  );
                })}
              {odId != null && (
                <ControllerButton
                  label={OD_PLAIN_LABEL}
                  aria={`${selectedName} ${OD_PLAIN_LABEL}`}
                  size="chip"
                  tone="od"
                  onClick={() => onAdd(odId)}
                  testId="recipe-special-od-plain"
                />
              )}
            </div>
          </div>

          {odId != null && (
            <div className="mt-1.5" data-testid="recipe-special-od-variants">
              {/*
                弱中/中強/弱強 の OD。
                ★★M30-02(SD-020): **既定非表示・展開で全部出す**(D-722 の (b))。
                  属性を足さず、キャラによる出し分けもしない —— どのキャラに弱中/中強/弱強が
                  在るかを示すデータがどこにも無いためである(M30-overview §2.3)。
                ★★2026-09-09 開発者の実機確認: 押下可能なエリアと分かりにくい、との指摘。
                  ⇒ 全技一覧のトグルと同じ見た目へ揃えてある(DisclosureToggleButton)。
                ★★OD_VARIANT_ORDER の値の集合は変えていない。変えたのは「いつ出すか」と
                  「見えるラベルの字数」だけである。
              */}
              <DisclosureToggleButton
                open={odVariantsOpen}
                onToggle={() => setOdVariantsOpen((v) => !v)}
                label={t("controller.special.odVariantsLegend")}
                controls={odVariantsId}
                data-testid="recipe-special-od-variants-toggle"
              />
              {odVariantsOpen && (
                <div
                  id={odVariantsId}
                  className="mt-1 grid gap-1.5"
                  style={oneRow(odVariants.length)}
                >
                  {odVariants.map((v) => (
                    <ControllerButton
                      key={v}
                      label={t(OD_SHORT_LABEL_KEY[v])}
                      aria={`${selectedName} ${t(OD_LABEL_KEY[v])}`}
                      size="chip"
                      tone="od"
                      onClick={() => onAdd(odId, [OD_VARIANT_FLAG[v]])}
                      testId={`recipe-special-od-${v}`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

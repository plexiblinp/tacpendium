// レシピ表示の共通部品(M24-03 §4.1 / §4.4・CHANGE-134)。
//
// ★★5 面(一覧・マイコンボ・詳細・比較・比較の追加モーダル)が通る唯一の描画部品である。
//   面ごとに truncate クラスと title 属性を書かない——それが M24-03 が終わらせた状態そのもの
//   (指示書 §1.2: 面ごとに直すと面の数だけ見せ方ができて次の不満を生む)。
//   ★★【M24-07 で是正】旧記述「4 面」は失効していた。マイコンボは一覧と同じ表部品
//     (ComboTableRow)を共有しており、共通部品を直した時点で自動的に及んでいる。
//     DES-005 §5.4 は正しく 5 面と書いている。
//
// ★★【M24-05・CHANGE-140 で更新】旧記述「セットプレイ側の 5 か所は通していない」は
//   失効した。実査で数え直すと未経由は 5 ではなく 12 か所あり、そのうち
//   LinkExistingSetupModal は M24-05 で撤去、残る本文表示 5 か所を本部品へ通した
//   〔SetupAccordionItem / SetupCandidateList / SetupTreeRow / SetupSelectorModal /
//     SetupRegistrationSection〕。★SetupRegistrationSection は旧記述の 5 か所に
//   入っていなかった——「5 か所」を信じて数え直さないと 1 か所取り残す。
//
// ★通していない箇所は現在 6 か所ある。いずれも通せない理由がある:
//   (a) 名前の代替として描く 3 か所〔CompareTable / TrashSetupListRow /
//       TrashBulkActions〕——レシピではなく「名前が無いときの代替表示」であり、
//       getSetupDisplayName が持つ文字数切り詰め規則(CSS truncate ではない)に従う。
//   (b) 未保存の steps から自前で組み立てる 3 か所〔SetupInputRow /
//       SetupRecipeEditor / SetplaySuggestionSection〕——本部品が要求する
//       recipe_cache 由来の文字列がまだ存在しない。SetplaySuggestionSection は
//       加えて DES-005 §5.6 項目12(自動提案)であり別系統である。
//
// ★セットプレイ側は共有トグル(recipe-full-view-v1)へ繋いでいない。fullView は
//   面ごとの固定値で渡す——同キーは「コンボ側の面が 1 つの値を共有する」ものであり、
//   読み手を増やすには web/CLAUDE.md §1 の台帳と DES-005 の変更が要る。
//   ★SetupAccordionItem だけ fullView 固定 true(DES-005 §5.6 項目10 が全文表示と定める)。

import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";
import {
  RECIPE_EMPTY_LABEL_KEY,
  firstMemoLine,
  RECIPE_STEP_CONNECTOR,
  splitRecipeSteps,
  splitStepParts,
} from "../recipeDisplay";

/**
 * 修飾(`{目押し}` 等)をバッジとして描く(M37-06・問い (ii)・開発者裁定 2026-09-14「案 C」)。
 *
 * ★★★**修飾は技の「左」に出す**(2026-09-14 開発者指示)。
 *   逐語＝「modifier の情報を見てから技を見るという順番の方が自然です」。
 *   ⇒ サーバ文字列は `技 {修飾}` の順だが、**描画は `[修飾] 技` の順**にする。
 *   ★★サーバ側(`applyFlags`)は 1 行も変えていない —— 文字列そのものは
 *     エクスポート・コピー・ホバー・確定反撃サーチが従来どおり使うためである。
 *     **⇒ 変えたのは本部品の描画順だけである。**
 *
 * ★★★見た目は `ModifiersSummary`(編集画面のバッジ)と同じ配色にしてある —— 開発者の要望が
 *   「新規登録、編集の段階で modifier をつけた時の見た目と一致させたい」だからである。
 *   ⇒ 配色を変えるときは両方を同時に動かすこと(片方だけ変えると要望が元へ戻る)。
 *
 * ★★本部品は**一覧・マイコンボ・詳細・比較・比較の追加モーダル ＋ セットプレイ 5 面**が
 *   通る唯一の描画部品である。⇒ ここで揃えると全面が同時に揃う(指示書 §5-7)。
 *   ★確定反撃サーチ(`PunishList` / `PunishTree`)は本部品を通らず `combo.recipe` を
 *     素の文字列で直描きしている。⇒ あちらは従来どおり `{}` 付きの平文である。
 *
 * ★未知の `{...}` はバッジにせず素のまま出す。理由は recipeDisplay.splitStepParts の注記。
 */
function StepContent({ step }: { step: string }) {
  const { flags, rest } = splitStepParts(step);
  return (
    <>
      {flags.map((label, i) => (
        <span
          key={`${i}-${label}`}
          data-testid="recipe-modifier-badge"
          // ★右にだけ余白を置く。★左は置かない —— 直前がステップ区切り(` > `)か
          //   行頭であり、そこには既に空白が在るためである。
          className="mr-1 rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700"
        >
          {label}
        </span>
      ))}
      {rest}
    </>
  );
}

/**
 * 省略表示(1 行)の中身。
 *
 * ★★★ステップごとに分けてから組み直す。**レシピ全体を 1 本の文字列として
 *   処理してはならない** —— 修飾を左へ出すのは*そのステップの中での*並べ替えであり、
 *   全体で処理すると `中足 > 中P {目押し}` の修飾が**先頭の「中足」の前へ飛ぶ**。
 * ★区切りは `RECIPE_STEP_CONNECTOR`(サーバ側 `connector` と同じ ` > `)を挟み直す。
 */
function CompactContent({ recipe }: { recipe: string }) {
  const steps = splitRecipeSteps(recipe);
  return (
    <>
      {steps.map((step, i) => (
        <span key={`${i}-${step}`}>
          {i > 0 && RECIPE_STEP_CONNECTOR}
          <StepContent step={step} />
        </span>
      ))}
    </>
  );
}

interface RecipeTextProps {
  /** サーバが組み立て済みのレシピ文字列(recipe_cache 由来)。 */
  recipe: string | null | undefined;
  /** 全文表示モード。useRecipeFullView から受け取る(コンボ側の面で共有された 1 つの値)。 */
  fullView: boolean;
  /**
   * 省略表示のときに適用する**面ごとの表示制御クラス**。面ごとに要求が違うため
   * 呼び手が渡す(`D-628`。**幅制御に限らない**)。
   *
   * ★as-built で渡っている値は 2 種類ある:
   *   - **幅**       … `max-w-xs`(一覧・比較) ／ `sm:max-w-[380px]`(比較の追加モーダル)
   *   - **折返し**   … `whitespace-pre-wrap break-words`(コンボ詳細)
   *
   * ★★prop 名を「幅」へ狭め直さないこと。`DES-005` §5.4 が as-built として
   *   「**コンボ詳細だけ折返し制御クラスを渡しており、幅の制約が無い**」を
   *   **意図として**記録している——狭めるとその意図と逆行する。
   *
   * ★全文表示(`fullView=true`)のときは適用しない。省略表示のための制御だからである。
   */
  compactClassName?: string;
  className?: string;
}

/**
 * レシピ 1 本の表示。
 *
 * - fullView=false: 1 行で末尾省略し、全文は title(ホバー)へ入れる。従来の見た目。
 * - fullView=true : ステップごとに改行して縦へ展開し、**title は付けない**。
 *   ★同じ情報が 2 か所に出るのを避ける(指示書 §4.1 のツールチップ規則)。
 *     SM-014「比較のツールチップが見にくい」はこれで解ける。
 */
export default function RecipeText({
  recipe,
  fullView,
  compactClassName,
  className,
}: RecipeTextProps) {
  // ★★M29-01: 空状態を t() 経由へ移した。本部品は i18n を通る 11 面が共有して
  //   おり、着手前は直書き定数を描いていたため**英語表示でも和文が出ていた**。
  //   ★エディタ側の 2 面(SetupInputRow / RecipeBuilder)は
  //     RECIPE_EMPTY_LABEL(ja.json 由来の写し)のままである——**あの 2 部品が
  //     自分で描く文字列を日本語固定で揃えているため**。
  //     ★★【是正・2026-09-06】旧記述「i18n を通さない設計(M24-07 の意図)」は
  //       事実に反していたので撤回した。**M24-07 自身が同じ画面の VirtualController を
  //       i18n 化しており**(`899c4e1`)、レシピタブは着手前から和英混在である。
  //       理由は recipeDisplay.ts の RECIPE_STEPS_EMPTY_KEY の項に書いた。
  const { t } = useTranslation();
  const steps = splitRecipeSteps(recipe);

  if (steps.length === 0) {
    return (
      // ★data-recipe-view は空のときも付ける(M24-03 レビュー 低-3)。E2E はこの属性で
      //   表示モードを判定するため、付いていないとレシピ無しの行を掴んだときに
      //   「モードが分からない」ではなく「属性が無い」で落ちて原因が読めない。
      <span
        className={cn("text-slate-400", className)}
        data-testid="recipe-text"
        data-recipe-view="empty"
      >
        {t(RECIPE_EMPTY_LABEL_KEY)}
      </span>
    );
  }

  if (!fullView) {
    return (
      <span
        className={cn("block truncate", compactClassName, className)}
        title={recipe ?? undefined}
        data-testid="recipe-text"
        data-recipe-view="compact"
      >
        {/*
          ★★title(ホバー)は**波括弧つきの生文字列のまま**にしてある。
            バッジにできない面では波括弧が修飾を示す唯一の代替である(`D-867`)。
          ★★★一方で、描画された **textContent からは波括弧が落ちる**
            (`中P {目押し}` → `中P` ＋ バッジ「目押し」)。⇒ 画面から目で読む分には
            バッジが修飾を示すため情報は減らないが、**textContent を読む側は影響を受ける**。
            ★エクスポート・コピー・API 応答は本部品を通らないため無関係である
            (いずれも `recipe_cache` 由来の文字列を直接使う)。
        */}
        <CompactContent recipe={recipe ?? ""} />
      </span>
    );
  }

  // ★★span で組む(ol/li ではない)。理由は「置き場のうち 1 つが button の中だから」である——
  //   比較の追加モーダルは候補カード全体が <button> であり(disabled で選択済みを表す)、
  //   button の内容モデルは phrasing content のため ol/li を入れると不正な入れ子になる。
  //   ⇒ どの面でも同じ部品が使えるよう、番号は自前で振って span で積む。
  return (
    <span
      className={cn("block", className)}
      data-testid="recipe-text"
      data-recipe-view="full"
    >
      {steps.map((step, i) => (
        // レシピは同じ技が複数回出るため index をキーに含める(順序が意味を持つ列)。
        <span key={`${i}-${step}`} className="block leading-relaxed">
          <span className="mr-1.5 tabular-nums text-slate-400">{i + 1}.</span>
          <StepContent step={step} />
        </span>
      ))}
    </span>
  );
}

interface MemoFirstLineProps {
  memo: string | null | undefined;
  className?: string;
}

/**
 * メモの 1 行目をレシピの上に薄く出す(SM-089・指示書 §4.4)。
 *
 * ★★M15-05 の「技名 1 行サマリ」(utils.ts の formatRecipeLine)と混ざらないこと。
 *   あちらは**レシピ由来**であってメモ由来ではない(ledger の注記)。
 *   実査(M24-03 §3.3-10)では formatRecipeLine の呼び元は編集面 3 本のみで、
 *   /combos と /combos/:id には 0 件だった——現状では同じ面に並ばない。
 *   それでも将来の混同を防ぐため、本部品は ✎ 記号 + 専用 testid + aria-label を持つ。
 *
 * ★メモが空(または 1 行目が空白のみ)なら要素自体を出さない。空の行を作らない(§4.4)。
 */
export function MemoFirstLine({ memo, className }: MemoFirstLineProps) {
  const { t } = useTranslation();
  const line = firstMemoLine(memo);
  if (line === "") return null;
  // ★ホバーには「切り詰める前の 1 行目」を入れる(M24-03 レビュー 低-2)。
  //   切り詰め後を入れると、ホバーしても続きが読めずツールチップの意味が無い。
  //   レシピ側(compact)が title に全文を入れているのと形を揃える。
  const fullLine = firstMemoLine(memo, Number.MAX_SAFE_INTEGER);
  return (
    // ★role="note" を付ける(M24-03 レビュー 中-5)。aria-label はロールを持つ要素に
    //   しか確実に効かないため、ロール無しの div では読み上げられない実装があり得る。
    //   ⇒ 支援技術にも「これはメモ由来の 1 行である」が届く(§4.4 の読み分け)。
    <div
      role="note"
      className={cn("text-xs text-slate-400 truncate", className)}
      data-testid="memo-first-line"
      aria-label={t("comboCommon.memoFirstLine")}
      title={fullLine}
    >
      <span aria-hidden="true" className="mr-1 text-slate-300">
        ✎
      </span>
      {line}
    </div>
  );
}

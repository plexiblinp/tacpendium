// レシピ表示の純粋関数(M24-03 §4.1 / §4.4・CHANGE-134)。
//
// ★★本モジュールは「見せ方」だけを持つ。レシピ文字列そのものの生成規則は
//   DES-004(内部表現仕様)の領域であり、サーバ側 internal/service/notation/ が正典である
//   (契約 F-1 の凍結パッケージ)。ここで文字列を組み立て直したり、綴りを直したりしない。

import { jaLabel } from "@/lib/ja-label";
import { MODIFIER_FLAGS } from "./labels";

// ステップの区切り。
//
// ★出所は internal/service/notation/resolver.go:11 の `connector` である
//   (`const connector = " > "` を strings.Join で挟む)。Go 側は非公開定数のため
//   import できない。値を変えるときは両側を同時に動かすこと。
//   ★同じ区切りは features/combo/utils.ts の formatRecipeLine(M15-05 の技名 1 行
//   サマリ)も使っているが、あちらは「編集中の steps から近似表記を組み立てる」側で
//   あり、本モジュールは「サーバが組み立て済みの文字列を分解する」側である。
export const RECIPE_STEP_CONNECTOR = " > ";

// レシピが空のときの表示。従来は 9 本の実装ファイルへ同じリテラルが散在していた
// (CLAUDE.md §4「マジックストリングは定数化」)。
// ★★M24-07: 直書きで残っていた `(レシピ未入力)` 2 か所(RecipeBuilder / SetupInputRow)を
//   本定数へ寄せた。半角括弧と全角括弧で割れていたのも同時に解消している。
//   ⇒ 「表示すべきレシピが無い」の文言はこの 1 本になった。
//
// ★★M29-01(開発者裁定 1-B・2026-09-06): 源泉を ja.json へ移した。
//   ★着手前は本定数が i18n キーを持たない直書きであり、**英語表示でも和文
//     「（レシピなし）」が出ていた**(到達 14 面)。一方でゴミ箱詳細だけは
//     `trash.detail.recipeUnavailable`(「レシピを表示できませんでした」)という
//     **別の文**を出していた。★両者は同じ真偽値 `!defaultRecipe` から出ており、
//     ゴミ箱詳細の側は**起きていない失敗を主張していた**。
//   ⇒ キーを 1 本(`comboCommon.recipeEmpty`)へ寄せ、`trash.detail.recipeUnavailable`
//     は参照 0 になったため ja / en の両方から削除した。
//   ★i18n を通る面は `t(RECIPE_EMPTY_LABEL_KEY)` を使う(RecipeText)。本定数は
//     i18n を通らない面(エディタ側)向けの日本語の写しであり、源泉は同じ ja.json
//     である——語を 2 か所に書いていない(E-76・constants/oki.ts と同じ流儀)。
export const RECIPE_EMPTY_LABEL_KEY = "comboCommon.recipeEmpty";
export const RECIPE_EMPTY_LABEL = jaLabel(RECIPE_EMPTY_LABEL_KEY);

// エディタの空状態(「まだステップが無い」)。**上の「表示すべきレシピが無い」とは
// 別の意味**であり、1 本へ畳んでいない(M24-07 の実測。followup は「4 種を 1 本へ」と
// 書いていたが、意味が 2 群に分かれていた)。
//
// ★★M29-01: **この 2 群の区別はそのままに、群の中の割れだけを直した。**
//   着手前は RecipeBuilder が「まだステップがありません。技を選んで「追加」して
//   ください。」、SetupRecipeEditor が「ステップがありません」で割れていた。
//   ★★文面から鉤括弧のボタン名を落としてある——**RecipeBuilder のボタンは「追加」だが
//     SetupRecipeEditor のボタンは「ステップ追加」であり、ボタン名を引用すると
//     片方の画面で嘘になる。** ⇒ 「技を選んで追加してください。」とした。
//   ★★エディタ 2 面は `t()` を通さない。`RECIPE_EMPTY_LABEL` と同じく
//     `jaLabel` 経由の日本語固定である。
//     **理由は「その部品の中で揃えるため」であって「エディタは i18n を通さない設計だから」ではない**
//     ——`RecipeBuilder` / `SetupRecipeEditor` は legend「レシピ」・「追加」/「ステップ追加」・
//     「全技から選ぶ」・「編集ボタンについて」を日本語で直書きしており、
//     空レシピ(`RECIPE_EMPTY_LABEL`)も日本語固定である。⇒ ここだけ `t()` にすると
//     **同じ部品の中で空レシピは日本語・空ステップは英語**になり、かえって割れる。
//
//   ★★【是正・2026-09-06 開発者の実画面確認より】旧記述「1 画面で 2 系統が混ざるのを
//     避ける(M24-07 の意図)」は**事実に反していたので撤回した**。
//     **`M24-07` 自身が同じ画面の `VirtualController` を i18n 化している**
//     (コミット `899c4e1`「仮想コントローラ 70 本を i18n 化」)。`RecipeBuilder:179` /
//     `SetupRecipeEditor:180` がそれを内包するため、**レシピタブは着手前から和英混在である**
//     (英語表示で "Quick input (buttons)" / "Common moves" 等が出る)。
//     ⇒ 「エディタは i18n を通さない面である」と読まないこと。**通していないのは
//     この 2 部品が自分で描く文字列だけ**である。
//     ★根本解決は 2 部品の直書きも i18n 化することだが、それは語彙の統一ではなく
//     i18n 化であり `M29-01` の射程外。横断課題として progress-log へ残してある。
export const RECIPE_STEPS_EMPTY_KEY = "comboCommon.recipeStepsEmpty";
export const RECIPE_STEPS_EMPTY_LABEL = jaLabel(RECIPE_STEPS_EMPTY_KEY);

// メモ 1 行目の既定の省略閾値(M24-03 §9.2 の裁量として製造が置いた値)。
//
// ★utils.ts の formatMemo(30 文字)とは別物である。あちらは一覧の「備考」列専用で
//   あり、こちらはレシピの直上に薄く出す 1 行(SM-089)である。レシピの上に長い行が
//   来ると本末転倒になるため、備考列より短くはしないが同じ値にも寄せない。
export const MEMO_FIRST_LINE_MAX_LENGTH = 40;

/**
 * レシピ文字列をステップごとに分解する(全文表示モードの縦展開に使う)。
 *
 * 空文字・空白のみ・undefined は空配列を返す(呼び手が「レシピなし」を出す)。
 */
export function splitRecipeSteps(recipe: string | null | undefined): string[] {
  if (!recipe) return [];
  const trimmed = recipe.trim();
  if (trimmed === "") return [];
  return trimmed
    .split(RECIPE_STEP_CONNECTOR)
    .map((s) => s.trim())
    .filter((s) => s !== "");
}

/**
 * メモの 1 行目を取り出す(SM-089)。
 *
 * - 最初の改行まで(CRLF / LF の双方)。
 * - 前後の空白は落とす。結果が空なら空文字を返す(呼び手は要素自体を出さない)。
 * - maxLength を超えたら切って「…」を付ける。
 */
export function firstMemoLine(
  memo: string | null | undefined,
  maxLength: number = MEMO_FIRST_LINE_MAX_LENGTH,
): string {
  if (!memo) return "";
  const line = memo.split(/\r?\n/, 1)[0].trim();
  if (line === "") return "";
  // ★コードポイント単位で数える。UTF-16 の slice はサロゲートペア(絵文字等)を
  //   途中で割りうる。メモは自由入力なので実際に起こる(M24-03 レビュー 低-5)。
  const chars = Array.from(line);
  if (chars.length <= maxLength) return line;
  return chars.slice(0, maxLength).join("") + "…";
}

// ===== 修飾バッジ(M37-06・問い (ii)) =====

/**
 * ステップ 1 本を「修飾」と「それ以外」へ分けた結果。
 *
 * `flags` は**表示語**(「目押し」等)であり、波括弧は含まない。呼び手がバッジとして描く。
 * `rest` は技名・ステップメモ・**未知の波括弧**を含む残りの文字列である。
 */
export interface RecipeStepParts {
  flags: string[];
  rest: string;
}

/**
 * 既知の flag 表示語(波括弧の中身)の集合。
 *
 * ★★★選択肢 14 値だけでなく、選択肢から外した 3 値(MODIFIER_FLAGS_RETIRED)も含む
 *   —— 既存行はそれらを持っており、バッジにならないと「片方だけ見た目が違う」が残る。
 */
const KNOWN_FLAG_LABELS: ReadonlySet<string> = new Set(
  MODIFIER_FLAGS.map((f) => f.label),
);

/** 波括弧 1 組。★入れ子は取らない(表示語に `{` は現れない)。 */
const BRACED = /\{([^{}]*)\}/g;

/**
 * サーバが組み立てたステップ文字列を、修飾とそれ以外へ分ける(M37-06・問い (ii))。
 *
 * ★★★これは「編集画面のバッジと、一覧・詳細の平文を一致させたい」という開発者の要望
 *   (`M37-02` の `B04` の積み残し)への回答である。⇒ 2026-09-14 開発者裁定で**案 C** を採った。
 *
 * ★★なぜこの形か(3 案の比較)。
 *     案 A … 揃えるのを諦めて請求する(指示書 §3-1 の既定の分岐)
 *     案 B … recipe_cache をステップ構造の JSON へ作り直す
 *            ⇒ `DES-002` §4.11 の N+1 回避の作り直しであり、指示書 §3-1 が禁じている
 *     案 C … **サーバが既に出している `{表示語}` を、描画時にバッジへ替える** ← 採用
 *   ⇒ 案 C は追加のクエリも `recipe_cache` の形式変更も伴わない。**`RecipeText` は
 *     一覧・詳細・比較など全面が通る唯一の描画部品**であり、1 か所で全面が同時に揃う
 *     (⇒ 指示書 §5-7「片方だけ変えていないこと」が構造から満たされる)。
 *
 * ★★★**修飾を技より前に出すための分解である**(2026-09-14 開発者指示)。
 *   逐語＝「modifier の情報を見てから技を見るという順番の方が自然です」。
 *   ⇒ サーバ文字列は `技 {修飾}` の順だが、**描画は `{修飾} 技` の順**にする。
 *   ★だから「断片の列」ではなく「修飾の配列 ＋ 残り」を返す形にしてある ——
 *     断片の列のまま並べ替えると、修飾を抜いた跡の空白の始末が呼び手側に散る。
 *
 * ★★★既知の表示語だけを取り出す。未知の `{...}` は **`rest` に残す**。
 *   ⇒ 理由が 2 つある:
 *     (1) 技名など、修飾でない文字列がたまたま波括弧を含んでも誤ってバッジにしない。
 *     (2) **表示語の取り違え・埋め忘れを隠さない。** Go 側に表示語が無いと
 *         `{od_lm}` のような内部識別子が出るが(`M37-02` / `B04` が消したかった状態)、
 *         それを勝手にバッジで飾ると**壊れているのに整って見える**。
 *         ⇒ 素のまま出して、壊れていることを見えるようにする。
 *
 * ★波括弧は残す判断(`D-867`)と衝突しない —— バッジにできない面(エクスポート・
 *   コピー・title 属性のホバー)では文字列がそのまま使われ、波括弧が修飾を示し続ける。
 *   本関数が変えるのは**描画のときだけ**である。
 */
export function splitStepParts(step: string): RecipeStepParts {
  const flags: string[] = [];

  // ★グローバル正規表現は lastIndex を持ち回る。関数をまたいで共有すると 2 回目の
  //   呼び出しが途中から走る。⇒ 呼び出しごとに 0 へ戻す。
  BRACED.lastIndex = 0;

  const rest = step
    .replace(BRACED, (whole, label: string) => {
      if (!KNOWN_FLAG_LABELS.has(label)) return whole; // 未知はそのまま残す
      flags.push(label);
      return "";
    })
    // ★修飾を抜いた跡に連続した空白が残る。⇒ 1 つへ畳んで前後を落とす。
    //   これをしないと `中P  ` のように末尾が空いたまま出る。
    .replace(/\s+/g, " ")
    .trim();

  return { flags, rest };
}

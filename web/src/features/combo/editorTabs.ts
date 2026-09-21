import type { ValidationIssue } from "./types";

// M24-04(SM-148): コンボ登録/編集の入力面を「基本情報」と「レシピ」の 2 つに分ける。
//
// ★★落とせない条件——保存に失敗したとき、エラーが「今見ていないタブ」に在ることが
//   分かること(指示書 §4.2.1)。分からないと利用者は何が悪いか分からない。
//   ⇒ タブの見出しにエラー件数を出す。ここはその振り分けの正典である。
//
// ★エラーのリスト本体(ValidationDisplay)はタブの外・保存ボタンの直上に据え置く。
//   位置は M12-02 の統一のままで、SM-067(自動スクロール方式)は採らない
//   (2026-08-27 開発者裁定＝変えない)。

export type ComboEditorTab = "basic" | "recipe";

export const COMBO_EDITOR_TABS: readonly ComboEditorTab[] = ["basic", "recipe"];

export const COMBO_EDITOR_TAB_LABEL_JA: Record<ComboEditorTab, string> = {
  basic: "基本情報",
  recipe: "レシピ",
};

// レシピ側で直すフィールド。
// ★starterMoveId はレシピ側である——始動技は入力欄ではなくレシピ先頭から自動で決まり、
//   直すにはレシピを触るしかない(基本情報では読み取り専用で表示しているだけ)。
// 値はバックエンドの Add(Error|Warning) の field と FE zod の path で共通(どちらも camelCase)。
const RECIPE_TAB_FIELDS: ReadonlySet<string> = new Set([
  "steps",
  "starterMoveId",
]);

// ★★ステップ配下は添字付きで来る。完全一致だけで判定すると取りこぼす。
//   - バックエンド: `steps[0].moveId`（`internal/service/validation/combo.go` の
//     VAL-C08 / VAL-C12 は `fmt.Sprintf("steps[%d].moveId", …)` で組む）
//   - フロント zod: `steps.0.moveId`（`i.path.map(String).join(".")`）
//   ★取りこぼすと「基本情報」タブへ誤って計上され、利用者を直す欄の無いタブへ誘導する。
//     これは指示書 §4.2.1 が落とせない条件とした「エラーがどのタブに在るか分かること」を
//     満たさないどころか、間違ったタブを指す。
//
// ★★M27-02a: 同梱セットプレイ(`setups[…]`)も同じ形で取りこぼしていた。
//   - バックエンド: `setups[1].steps` / `setups[1]`
//     (`internal/service/combo/service.go` が同梱 setups の issue を
//      `fmt.Sprintf("setups[%d].%s", …)`、field が空なら `setups[%d]` で組み直す)
//   ★直す欄は「レシピ」タブのセットプレイ登録の節に在る(D-593 の裁定どおり)。
//     取りこぼすと「基本情報」タブのバッジに計上され、直す欄の無いタブを指していた。
//   ★★「欄の無いタブを指す」形は起きない——同梱セットプレイの入力欄は
//     mode === "new" | "copy" でしか描かれず、編集モードでは `setupsToCreate` が
//     空のまま `buildCreatePayload()` が `setups: undefined` を送るため、
//     編集モードで `setups[*]` の ERROR が出る経路が無い(M27-02a の実測)。
//     ⇒ 前方一致を足すだけで足りる(指示書 §2.1.2-1 の分岐 1)。
//   ★FE zod は setups を検証しない。`setups.` を併記してあるのは steps と同じ理由で
//     あり、将来 zod 側が検証を持ったときに基点の書式差で再発させないためである。
const RECIPE_TAB_FIELD_PREFIXES = [
  "steps[",
  "steps.",
  "setups[",
  "setups.",
] as const;

/**
 * issue の field がどちらのタブで直せるかを返す。
 * ★どちらとも言えないもの(field 無し＝コンボ全体の重複など)は null。
 *   その場合でもリスト本体には出るため、利用者から隠れることはない。
 */
export function tabOfIssueField(
  field: string | null | undefined,
): ComboEditorTab | null {
  if (!field) return null;
  if (RECIPE_TAB_FIELDS.has(field)) return "recipe";
  if (RECIPE_TAB_FIELD_PREFIXES.some((prefix) => field.startsWith(prefix))) {
    return "recipe";
  }
  return "basic";
}

/**
 * タブごとのエラー件数。
 * ★数えるのは severity=error だけである——警告は保存を止めないため、
 *   「保存できなかった原因がどこにあるか」を指す用途には混ぜない。
 */
export function countErrorsByTab(
  issues: readonly ValidationIssue[] | undefined,
): Record<ComboEditorTab, number> {
  const counts: Record<ComboEditorTab, number> = { basic: 0, recipe: 0 };
  for (const issue of issues ?? []) {
    if (issue.severity !== "error") continue;
    const tab = tabOfIssueField(issue.field);
    if (tab) counts[tab] += 1;
  }
  return counts;
}

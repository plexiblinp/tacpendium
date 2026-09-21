import { expect, type APIRequestContext, type Locator, type Page } from "@playwright/test";

// レシピ可読性(M24-03)の E2E 共通の下ごしらえ。
//
// ★同じ数行を複数 spec へ複製しない(E-232)。D-553 が support/ への集約を運用の型として
//   承認済みである。
// ★本ファイルは spec ではない(playwright の既定 testMatch は *.spec.ts / *.test.ts のみ)。

/** 全文表示モードのブラウザストレージキー(web/CLAUDE.md §1 台帳 #11)。 */
export const RECIPE_FULL_VIEW_KEY = "recipe-full-view-v1";

/** 指定 code のキャラ ID を取る。 */
export async function characterIdByCode(
  request: APIRequestContext,
  code: string,
): Promise<number> {
  const res = await request.get("/api/games/1/characters");
  expect(res.ok(), `キャラ一覧の取得に失敗: ${res.status()}`).toBeTruthy();
  const items = (await res.json()).items as Array<{ id: number; code: string }>;
  const hit = items.find((c) => c.code === code);
  if (!hit) throw new Error(`seed に ${code} が見つからない(配布クリーン状態の前提崩れ)`);
  return hit.id;
}

/** そのキャラの技 ID 列を取る(レシピを任意の長さで組むため)。 */
export async function moveIdsOf(
  request: APIRequestContext,
  characterId: number,
): Promise<number[]> {
  const res = await request.get(`/api/moves?character_id=${characterId}`);
  expect(res.ok(), `技一覧の取得に失敗: ${res.status()}`).toBeTruthy();
  const items = (await res.json()).items as Array<{ id: number }>;
  expect(items.length, `character_id=${characterId} の技が 0 件`).toBeGreaterThan(0);
  return items.map((m) => m.id);
}

/**
 * ステップ数を指定してコンボを 1 本作る(API 経由)。
 *
 * ★UI 経路でレシピを組む手順は move セレクタに安定した test-id が無く脆いため採らない
 *   (m15-02 / m23-01 と同じ方針)。本サブが見るのは「作られたレシピの見せ方」である。
 */
export async function createComboWithSteps(
  request: APIRequestContext,
  opts: {
    characterId: number;
    moveIds: number[];
    stepCount: number;
    memo?: string;
    position?: string;
  },
): Promise<{ id: number }> {
  const { characterId, moveIds, stepCount, memo, position = "mid_screen" } = opts;
  const res = await request.post("/api/combos", {
    data: {
      characterId,
      isDraft: true, // レシピ以外を埋めずに作れる(VAL-C09 は本登録時のみ)
      position,
      memo,
      steps: Array.from({ length: stepCount }, (_, i) => ({
        stepOrder: i + 1,
        moveId: moveIds[i % moveIds.length],
      })),
    },
  });
  expect(
    res.ok(),
    `fixture 作成失敗: ${res.status()} ${await res.text()}`,
  ).toBeTruthy();
  return { id: (await res.json()).id as number };
}

/** 作った fixture を片付ける(1 回の走行内では全 spec が DB を共有する)。 */
export async function deleteCombos(
  request: APIRequestContext,
  ids: number[],
): Promise<void> {
  for (const id of [...ids].reverse()) {
    await request.delete(`/api/combos/${id}`).catch(() => undefined);
  }
}

/** レシピ表示の要素(省略/全文の別は data-recipe-view が持つ)。 */
export function recipeTexts(scope: Page | Locator): Locator {
  return scope.getByTestId("recipe-text");
}

/** 作成したコンボの現在のレシピ文字列(表示の期待値を実データから採るため)。 */
export async function recipeOf(
  request: APIRequestContext,
  comboId: number,
): Promise<string> {
  const res = await request.get(`/api/combos/${comboId}`);
  expect(res.ok(), `コンボ取得に失敗: ${res.status()}`).toBeTruthy();
  return ((await res.json()).defaultRecipe as string) ?? "";
}

/**
 * 全文表示モードを目的の状態にする(トグルを押す)。
 *
 * @param scope トグルを探す範囲。/compare のようにページとダイアログの両方にある面では
 *              呼び出し側が絞って渡す。
 */
export async function setRecipeFullView(
  scope: Page | Locator,
  on: boolean,
): Promise<void> {
  const toggle = scope.getByTestId("recipe-view-toggle").first();
  await expect(toggle).toBeVisible();
  const pressed = (await toggle.getAttribute("aria-pressed")) === "true";
  if (pressed !== on) await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", String(on));
}

/** ページ本体が横へ溢れていないこと(SM-096 の成立確認に使う)。 */
export async function pageOverflowsHorizontally(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth > doc.clientWidth;
  });
}

import { test, expect } from "@playwright/test";

import {
  characterIdByCode,
  createComboWithSteps,
  deleteCombos,
  moveIdsOf,
  pageOverflowsHorizontally,
  recipeOf,
  recipeTexts,
  setRecipeFullView,
} from "./support/recipe-view";

// M24-03: レシピの見せ方をコンボ側の面へ 1 つの規則で通す(CHANGE-134)。
//
// 指示書 §5.1 の E2E 5 ケース + §9.3 の「既に解消していた項目の成立固定」1 ケース。
//   (1) 一覧でモードを切り替えると全ルートが見える     …… SM-130 / SM-096
//   (2) 詳細でレシピが縦に読める                       …… SM-022
//   (3) 比較から詳細へ行ける                           …… SM-003
//   (4) 比較にキャラ名が出ている                       …… SM-061
//   (5) 比較の追加モーダルでもモードが効いている       …… SM-018
//   (6) ★長いレシピでも画面が横へ溢れない(成立の固定)  …… SM-096
//
// ★共通の下ごしらえは e2e/support/recipe-view.ts へ寄せてある(D-553 / E-232)。

const LONG_STEPS = 16; // 実測で 16 ステップ ≒ 122 文字。省略表示では 24% しか見えない長さ。

const createdIDs: number[] = [];

let characterId = 0;
let longComboId = 0;
let shortComboId = 0;
let longRecipe = "";

test.beforeAll(async ({ request }) => {
  characterId = await characterIdByCode(request, "ryu");
  const moveIds = await moveIdsOf(request, characterId);
  const long = await createComboWithSteps(request, {
    characterId,
    moveIds,
    stepCount: LONG_STEPS,
    memo: "M24-03 長いレシピ\n2 行目は出さない",
  });
  const short = await createComboWithSteps(request, {
    characterId,
    moveIds,
    stepCount: 2,
  });
  longComboId = long.id;
  shortComboId = short.id;
  createdIDs.push(long.id, short.id);
  longRecipe = await recipeOf(request, long.id);
  expect(longRecipe, "fixture のレシピが空(前提崩れ)").not.toBe("");
});

test.afterAll(async ({ request }) => {
  await deleteCombos(request, createdIDs);
});

// 全文表示モードは localStorage に残る。ケース間で持ち越さない。
test.beforeEach(async ({ page }) => {
  await page.goto("/combos");
  await page.evaluate(() => window.localStorage.removeItem("recipe-full-view-v1"));
});

test("(1) 一覧でモードを切り替えると、省略されていたレシピが全部読める(SM-130)", async ({
  page,
}) => {
  await page.goto(`/combos?character_id=${characterId}`);
  const row = page.locator("tr", {
    has: page.locator(`a[href="/combos/${longComboId}"]`),
  });
  const recipe = recipeTexts(row).first();

  // 既定は省略表示(開発者裁定 案A)。全文は title(ホバー)にしか入っていない。
  await expect(recipe).toHaveAttribute("data-recipe-view", "compact");
  const full = await recipe.getAttribute("title");
  expect(full, "省略表示のときは title に全文が入る").toBeTruthy();
  const clipped = await recipe.evaluate((e) => e.scrollWidth > e.clientWidth);
  expect(clipped, "この長さなら省略表示では切れているはず").toBe(true);

  await setRecipeFullView(page, true);

  // 全文表示ではステップごとに縦へ展開され、切れていない。
  await expect(recipe).toHaveAttribute("data-recipe-view", "full");
  const nowClipped = await recipe.evaluate((e) => e.scrollWidth > e.clientWidth);
  expect(nowClipped, "全文表示なのに切れている").toBe(false);
  // ★全ステップが読める(母数 = 作成したステップ数)。
  const shown = await recipe.evaluate((e) => e.textContent ?? "");
  for (const step of (full ?? "").split(" > ")) {
    expect(shown, `ステップ「${step}」が出ていない`).toContain(step);
  }
  // ★全文表示のときはツールチップを出さない(同じ情報が 2 か所に出る・SM-014)。
  await expect(recipe).not.toHaveAttribute("title", /./);

  // ★★一覧側の SM-089 もここで固定する(M24-03 レビュー 中-6)。
  //   これが無いと、次のサブが一覧の行を触ってメモ 1 行目を落としても気づけない
  //   (詳細側はケース (2) が見ているが、一覧側を見ているものが無かった)。
  //   ★メモ 1 行目は「レシピ列のセルの中」に置いてある(レシピの直上＝§4.4)。
  //     ⇒ 列カスタマイズでレシピ列を隠すとメモ 1 行目も消える。仕様である。
  const memo = row.getByTestId("memo-first-line");
  await expect(memo).toHaveCount(1);
  await expect(memo).toContainText("M24-03 長いレシピ");
  await expect(memo).not.toContainText("2 行目は出さない");

  // ★★M24-03 手動確認(開発者判断 2026-08-26): 備考列は既定 OFF。
  //   メモがレシピの直上と備考列の 2 か所に出る状態を作らない。
  //   ⇒ 既定を true へ戻すとここが赤くなる(破壊確認 6)。
  await expect(
    page.getByRole("columnheader", { name: "備考" }),
    "備考列が既定で出ている(メモが 1 画面に 2 か所並ぶ)",
  ).toHaveCount(0);
});

test("(2) 詳細でレシピがステップごとに縦に読める(SM-022)", async ({ page }) => {
  await page.goto(`/combos/${longComboId}`);
  await expect(page.getByRole("heading", { name: "レシピ" })).toBeVisible();

  const recipe = page
    .locator("section", { has: page.getByRole("heading", { name: "レシピ" }) })
    .getByTestId("recipe-text");

  // ★詳細は全文表示が既定(面ごとの既定・§4.1)。
  await expect(recipe).toHaveAttribute("data-recipe-view", "full");
  const lineCount = await recipe.evaluate((e) => e.childElementCount);
  expect(lineCount, "ステップごとに行が分かれていない").toBe(LONG_STEPS);

  // ★メモの 1 行目がレシピの上に出る。2 行目は出さない(SM-089)。
  const memo = page.getByTestId("memo-first-line").first();
  await expect(memo).toContainText("M24-03 長いレシピ");
  await expect(memo).not.toContainText("2 行目は出さない");
});

test("(3)(4) 比較にキャラ名が出て、そこから詳細へ行ける(SM-061 / SM-003)", async ({
  page,
}) => {
  await page.goto(`/compare?ids=${longComboId},${shortComboId}`);
  await expect(page.getByText("ルート").first()).toBeVisible();

  // (4) キャラ名(name_ja)が各列に出ている。
  const names = page.getByTestId("compare-character-name");
  await expect(names).toHaveCount(2);
  await expect(names.first()).toHaveText("リュウ");

  // (3) 詳細への導線があり、押すと詳細へ行く。
  const links = page.getByTestId("compare-open-detail");
  await expect(links).toHaveCount(2);

  // ★★取り違えの防止(M23-07 の教訓)。比較表の ✕ の aria-label は「比較から外す」で
  //   あり、そもそも「削除」ではない(実査で確認)。そのうえで位置でも分けてある——
  //   ✕ はセル右上、詳細リンクはセル最下段で、あいだにキャラ名と始動状況の 2 行が入る。
  //   ★ここが縮むと「押し間違えたら消える」に近づくため、距離を機械で固定する。
  const removeButton = page.getByRole("button", { name: "比較から外す" }).first();
  await expect(removeButton).toBeVisible();
  const linkBox = await links.first().boundingBox();
  const removeBox = await removeButton.boundingBox();
  expect(linkBox && removeBox, "位置を測れない").toBeTruthy();
  expect(
    linkBox!.y - (removeBox!.y + removeBox!.height),
    "詳細リンクが ✕ の直下に隣接している(取り違えの距離が足りない)",
  ).toBeGreaterThan(8);

  await links.first().click();
  await expect(page).toHaveURL(new RegExp(`/combos/${longComboId}$`));
});

test("(5) 比較の追加モーダルでも全文表示モードが効く(SM-018)", async ({ page }) => {
  await page.goto(`/compare?ids=${shortComboId}`);
  await page.getByRole("button", { name: "コンボを追加" }).first().click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  // ★★候補は「自分が作ったコンボの行」に固定する。1 回の走行では全 spec が DB を
  //   共有するため(E-232)、first() だと他 spec が作ったレシピ無しの行を掴む。
  //   ★目印は data-combo-id にする。レシピ文字列で行を選ぶと、全文表示へ切り替えた
  //     瞬間に行の文字列が変わって掴めなくなる(実際に踏んだ)。
  const candidateRow = dialog.locator(`[data-combo-id="${longComboId}"]`);
  await expect(candidateRow, "作成したコンボが候補に出ていない").toHaveCount(1);
  const candidate = recipeTexts(candidateRow).first();
  await expect(candidate).toHaveAttribute("data-recipe-view", "compact");

  // ★ダイアログの中のトグルで切り替える。
  await setRecipeFullView(dialog, true);
  await expect(candidate).toHaveAttribute("data-recipe-view", "full");

  // ★★面をまたいで 1 つの値を共有している——ダイアログを閉じると比較表側も全文になっている。
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(recipeTexts(page).first()).toHaveAttribute("data-recipe-view", "full");
});

test("(6) ★長いレシピでも画面は横へ溢れない(SM-096 の成立を固定する)", async ({
  page,
}) => {
  // ★★本ケースは「直した」ではなく「既に成立している」ことの固定である(指示書 §9.3)。
  //   実測(§3.3-3)では、レシピを 5 文字から 263 文字まで伸ばしても表の幅は変わらず
  //   (truncate が効いて列幅が動かない)、ページ本体は 1280/768/390 のいずれでも
  //   横へ溢れなかった。⇒ 崩れの原因はレシピ長ではない。
  //   次に同じ要望が再登場したときに、ここが答えになる。
  for (const width of [1280, 768, 390]) {
    await page.setViewportSize({ width, height: 800 });

    await page.goto(`/combos?character_id=${characterId}`);
    await expect(page.locator("tbody tr").first()).toBeVisible();
    expect(
      await pageOverflowsHorizontally(page),
      `一覧(省略表示・幅 ${width})でページが横へ溢れた`,
    ).toBe(false);

    await setRecipeFullView(page, true);
    expect(
      await pageOverflowsHorizontally(page),
      `一覧(全文表示・幅 ${width})でページが横へ溢れた`,
    ).toBe(false);

    await page.goto(`/combos/${longComboId}`);
    await expect(page.getByRole("heading", { name: "レシピ" })).toBeVisible();
    expect(
      await pageOverflowsHorizontally(page),
      `詳細(幅 ${width})でページが横へ溢れた`,
    ).toBe(false);

    await page.evaluate(() => window.localStorage.removeItem("recipe-full-view-v1"));
  }
});

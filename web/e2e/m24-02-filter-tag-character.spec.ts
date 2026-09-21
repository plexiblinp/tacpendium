import { test, expect, type Page } from "@playwright/test";

import { fetchCharacters } from "./support/characters";
import { createTags, deleteTags, type CreatedTag } from "./support/tags";

// M24-02: 一覧のタグフィルタ(§4.1) / フィルタ欄の折りたたみ(§4.2) /
//         キャラ選択の検索と並び順(§4.3) / タグ管理画面の検索(§4.4)。
//
// ★判定キーは本 spec 固有にする(教訓 E-232)。E2E は DB を 1 本共有する。
const STAMP = `m2402-${Date.now()}`;

const TAG_NAMES = [
  `${STAMP}-起き攻め`,
  `${STAMP}-画面端`,
  `${STAMP}-高難度`,
  `${STAMP}-本命`,
];

const TAG_FILTER = "combo-list-tag-filter";
const FILTER_SUMMARY = "combo-list-filter-summary";

/** ドロップダウンの中の選択肢だけを数える(native select の option と混ざらないため)。 */
function listboxOptions(page: Page) {
  return page.getByRole("listbox").getByRole("option");
}

test.describe("M24-02 フィルタ・タグ・キャラ選択", () => {
  let tags: CreatedTag[] = [];

  test.beforeAll(async ({ request }) => {
    tags = await createTags(request, TAG_NAMES);
  });

  test.afterAll(async ({ request }) => {
    await deleteTags(request, tags);
  });

  // (1) タグフィルタを開いて検索で絞り、選んで閉じ、件数が出ること
  test("1: タグフィルタを検索で絞って選ぶと、閉じた状態でも件数が分かる", async ({
    page,
  }) => {
    await page.goto("/combos");

    const trigger = page.getByTestId(TAG_FILTER);
    await expect(trigger).toBeVisible();
    // ★未選択のときは件数バッジを出さない
    await expect(page.getByTestId(`${TAG_FILTER}-count`)).toHaveCount(0);

    await trigger.click();
    const before = await listboxOptions(page).count();
    expect(before).toBeGreaterThan(1);

    // 検索で絞る
    await page.getByPlaceholder("タグを検索").fill(`${STAMP}-高難度`);
    await expect(listboxOptions(page)).toHaveCount(1);
    await listboxOptions(page).first().click();

    // ★複数選択では 1 件選んでも閉じない(列カスタマイズと同じ作法)
    await expect(page.getByPlaceholder("タグを検索")).toBeVisible();

    // 閉じる
    await page.keyboard.press("Escape");
    await expect(page.getByPlaceholder("タグを検索")).toHaveCount(0);

    // ★閉じた状態でも「何件選ばれているか」が分かる
    await expect(page.getByTestId(`${TAG_FILTER}-count`)).toHaveText("1");
    await expect(page).toHaveURL(/tag_ids=/);
  });

  // (2) フィルタを閉じても絞り込みが効き続け、それが分かること
  test("2: フィルタ欄を閉じても絞り込みは効き続け、効いていることが分かる", async ({
    page,
  }) => {
    await page.goto("/combos");

    // 絞り込みを 1 つ掛ける(登録状態 = 仮登録のみ)
    const draftSelect = page.locator("select").first();
    await draftSelect.selectOption("draft");
    await expect(page).toHaveURL(/is_draft=true/);

    const panelToggle = page.getByRole("button", { name: /フィルタ・ソート/ });
    await expect(panelToggle).toHaveAttribute("aria-expanded", "true"); // ★既定は開いている

    // 閉じる
    await panelToggle.click();
    await expect(panelToggle).toHaveAttribute("aria-expanded", "false");
    // 中身(native select)は畳まれている
    await expect(page.locator("select")).toHaveCount(0);

    // ★閉じていても「効いている」ことが分かる
    const summary = page.getByTestId(FILTER_SUMMARY);
    await expect(summary).toBeVisible();
    // ★★軸名だけでなく「値」まで読めること(2026-08-26 開発者要望の書式)
    await expect(summary).toContainText("登録状態: 仮登録のみ");
    // ★絞り込みは効き続けている(URL が保たれている)
    await expect(page).toHaveURL(/is_draft=true/);

    // ★開閉状態は読み直しても残る
    await page.reload();
    await expect(
      page.getByRole("button", { name: /フィルタ・ソート/ }),
    ).toHaveAttribute("aria-expanded", "false");

    // 後始末(localStorage を次のテストへ持ち越さない)
    await page.getByRole("button", { name: /フィルタ・ソート/ }).click();
  });

  // (3) タグ管理画面で検索して 0 件になったとき「タグが無い」と区別できること
  test("3: タグ管理の検索で 0 件になっても「タグがありません」とは言わない", async ({
    page,
  }) => {
    await page.goto("/tags/manage");

    const search = page.getByTestId("tag-search");
    await expect(search).toBeVisible();
    // 母数つきの件数が出ている
    await expect(page.getByTestId("tag-search-hits")).toContainText("全");

    // 一致するものがある検索
    await search.fill(`${STAMP}-起き攻め`);
    await expect(
      page.getByRole("cell", { name: `${STAMP}-起き攻め`, exact: true }),
    ).toBeVisible();

    // ★一致しない検索 → 0 件。「そもそも無い」とは別の案内が出る
    await search.fill(`${STAMP}-存在しないタグ`);
    const filteredEmpty = page.getByTestId("tag-list-empty-filtered");
    await expect(filteredEmpty).toBeVisible();
    await expect(filteredEmpty).not.toContainText("新規作成");
    await expect(page.getByTestId("tag-list-empty")).toHaveCount(0);
    await expect(page.getByTestId("tag-search-hits")).toContainText("0 件");

    // 検索を解除すると戻る
    await filteredEmpty.getByText("検索を解除").click();
    await expect(page.getByTestId("tag-list-empty-filtered")).toHaveCount(0);
    await expect(
      page.getByRole("cell", { name: `${STAMP}-起き攻め`, exact: true }),
    ).toBeVisible();
  });

  // (4) キャラ選択で検索して絞れること、および並びが昇順であること
  test("4: キャラ選択は検索で絞れ、並びはロケール依存の昇順になる", async ({
    page,
    request,
  }) => {
    const apiOrder = await fetchCharacters(request);
    expect(apiOrder.length).toBeGreaterThan(2);

    await page.goto("/combos");
    const selector = page.getByTestId("combo-list-character-scope");
    await expect(selector).toBeVisible();
    await selector.click();

    const rendered = (await listboxOptions(page).allTextContents()).map((s) =>
      s.replace("✓", "").trim(),
    );
    expect(rendered).toHaveLength(apiOrder.length);

    // ★(a) 取得順(サーバの ORDER BY id = 登録順)のままではない
    expect(rendered).not.toEqual(apiOrder.map((c) => c.nameJa));

    // ★(b) ロケール依存の昇順になっている
    const collator = new Intl.Collator("ja");
    const expected = apiOrder.map((c) => c.nameJa).sort(collator.compare);
    expect(rendered).toEqual(expected);

    // ★(c) 検索で絞れる(name_ja でも code でも)
    const target = apiOrder.find((c) => c.code === "dhalsim") ?? apiOrder[0];
    const search = page.getByPlaceholder("キャラクターを検索");
    await search.fill(target.nameJa);
    await expect(listboxOptions(page)).toHaveCount(1);
    await expect(listboxOptions(page).first()).toContainText(target.nameJa);

    await search.fill(target.code);
    await expect(listboxOptions(page)).toHaveCount(1);
    await expect(listboxOptions(page).first()).toContainText(target.nameJa);

    // 選ぶと閉じて URL が変わる(単一選択は選び終わり)
    await listboxOptions(page).first().click();
    await expect(page.getByPlaceholder("キャラクターを検索")).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`character_id=${target.id}`));
  });
});

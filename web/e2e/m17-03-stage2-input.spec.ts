import { test, expect } from "@playwright/test";

import { gotoNewComboRecipeFor, openRecipeTab } from "./support/editor-input";

// M17-03: 段階2 UI(仮想コントローラの方向入力拡張＋解決表の消費)の実データ E2E。
//
// 目的: 3×3 テンキーパッド(方向 1〜9)× ボタンで、解決表(M17-02 API)→ 段階1 の
//       一様フォールバック(DES-004 §2.4.5)が実 seed データで機能することを検証する。
//       キー構築・縮約の網羅は Vitest 純関数側(inputResolutionStage2.test.ts)に委譲。
//
// 前提: E2E 使い捨て DB(全マイグレ適用済み=新系列 000009 が終端)。ryu が既定キャラ。
//       コンボは保存しない(作成データを残さない)ため後始末不要。
//       方向ボタンは testId(recipe-dir-N)で触る(Playwright の name は部分一致のため
//       「下」/「下後ろ」等の accessible name 衝突を避ける)。

// キャラ code → id 解決(?character= は数値 id を取る。m14-03b の流儀)。
async function characterIdOf(
  page: import("@playwright/test").Page,
  code: string,
): Promise<number> {
  const res = await page.request.get("/api/games/1/characters");
  expect(res.ok()).toBeTruthy();
  const chars = (await res.json()).items as Array<{ id: number; code: string }>;
  const c = chars.find((x) => x.code === code);
  expect(c, `character ${code} not seeded`).toBeTruthy();
  return c!.id;
}

test.describe("M17-03 段階2 UI(テンキーパッド × 解決表)", () => {
  test("ryu: 単方向特殊技(段階2)と立ち/しゃがみ通常技(縮約→段階1 経路の非侵食)", async ({
    page,
  }) => {
    await gotoNewComboRecipeFor(page, "ryu");

    const steps = page.locator("ol > li");

    // 前(6)+ 強P → 解決表ヒットで solar_plexus_strike(鳩尾砕き)。
    await page.getByTestId("recipe-tab-normal").click();
    await page.getByTestId("recipe-dir-6").click();
    await page.getByRole("button", { name: "強パンチ" }).click();
    await expect(steps).toHaveCount(1);
    await expect(steps.nth(0)).toContainText("鳩尾砕き");

    // 前(6)+ 中P → collarbone_breaker(鎖骨割り)= 単方向特殊技。
    await page.getByRole("button", { name: "中パンチ" }).click();
    await expect(steps).toHaveCount(2);
    await expect(steps.nth(1)).toContainText("鎖骨割り");

    // 立ち(5)+ 中P → standing_medium_punch(ジャンプ攻撃が奪っていない)。
    await page.getByTestId("recipe-dir-5").click();
    await page.getByRole("button", { name: "中パンチ" }).click();
    await expect(steps).toHaveCount(3);
    await expect(steps.nth(2)).toContainText("立ち中P");

    // しゃがみ(2)+ 中P → crouching_medium_punch。
    await page.getByTestId("recipe-dir-2").click();
    await page.getByRole("button", { name: "中パンチ" }).click();
    await expect(steps).toHaveCount(4);
    await expect(steps.nth(3)).toContainText("しゃがみ中P");
  });

  test("lily: 下(2)+ 強P → crouching_heavy_punch(great_spin〔空中特殊技〕が出たら重大)", async ({
    page,
  }) => {
    const lilyId = await characterIdOf(page, "lily");
    await page.goto(`/combos/new?character=${lilyId}`);
    await openRecipeTab(page);
    await expect(page.getByTestId("recipe-tab-normal")).toBeVisible();

    const steps = page.locator("ol > li");
    await page.getByTestId("recipe-dir-2").click();
    await page.getByRole("button", { name: "強パンチ" }).click();
    await expect(steps).toHaveCount(1);
    // is_aerial 除外の実データ検証: 2HP はしゃがみ強P であり グレートスピン ではない。
    await expect(steps.nth(0)).toContainText("しゃがみ強P");
    await expect(steps.nth(0)).not.toContainText("グレートスピン");
  });

  // ★★本テストは 2026-09-02(M14-03f・第四波 seed)で書き換えた。
  //
  // 旧テストは「未 seed キャラ(c_viper): 解決表が空でも画面が壊れない」だった。
  // c_viper は characters 行だけが入り(000003_data_seed_characters)、moves は移動 system 技 9 種のみという
  // 仮登録の状態が長く続いていたため、それを「解決表が空のキャラ」として使っていた。
  // ⇒ 第四波で 31 キャラすべてが本 seed 済みになり、配布 DB から
  //   「moves を持たないキャラ」が消えた。前提そのものが無くなった。
  //
  // ★「解決表が空でも壊れない」という不変条件は今も要る(ゲーム更新で新キャラが増えると
  //   characters 行だけが先に入る期間が必ずできる)。★ただし E2E スタックは debug ビルドを
  //   使わないため、spec からキャラを差し込む手段が無い。
  //   ⇒ バックエンド側の同じ不変条件は Go のテストが fixture 付きで守っている
  //     (internal/api/intake/handler_test.go の TestResolve_MovelessCharacter_AllUnresolved)。
  //   ⇒ 画面側の E2E 被覆は失われた。完了報告 §15 に followup 候補として記録した。
  //
  // ★本テストは代わりに「第四波 seed が画面まで届いたか」を主張する。
  //   仮登録のまま取り残されていたら、ここが赤くなる。
  test("c_viper(第四波で本 seed 済み): 解決表が効き、しゃがみ通常技が出る", async ({
    page,
  }) => {
    const viperId = await characterIdOf(page, "c_viper");
    await page.goto(`/combos/new?character=${viperId}`);
    await openRecipeTab(page);

    // 通常技タブとテンキーパッドが描画され、方向クリックが例外なく動作する。
    await expect(page.getByTestId("recipe-tab-normal")).toBeVisible();
    await expect(page.getByTestId("recipe-dir-5")).toBeVisible();

    const steps = page.locator("ol > li");

    // しゃがみ(2)+ 弱P → crouching_light_punch。★第四波より前は解決表が空で非活性だった。
    await page.getByTestId("recipe-dir-2").click();
    await page.getByRole("button", { name: "弱パンチ" }).click();
    await expect(steps).toHaveCount(1);
    await expect(steps.nth(0)).toContainText("しゃがみ弱P");

    // 立ち(5)+ 中P → standing_medium_punch。
    await page.getByTestId("recipe-dir-5").click();
    await page.getByRole("button", { name: "中パンチ" }).click();
    await expect(steps).toHaveCount(2);
    await expect(steps.nth(1)).toContainText("立ち中P");

    // 既存タブ群も健在(温存の非回帰スモーク)。
    await expect(page.getByTestId("recipe-tab-unique")).toBeVisible();
    await expect(page.getByTestId("recipe-tab-special")).toBeVisible();
    await expect(page.getByTestId("recipe-tab-super-art")).toBeVisible();
  });
});

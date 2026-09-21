import { test, expect } from "@playwright/test";

import { gotoNewComboRecipeFor } from "./support/editor-input";

// M15-03: 入力方式ボタン化(FB④)＋コマンド入力解決 段階1 のレシピ入力スモーク。
//
// 目的: カテゴリタブ式クイック入力で、通常技(段階1 = 方向ゾーン×ボタン)と
//       必殺技(直接指定)がステップに確定することを、実装方式に依存しない DOM 操作で検証する。
//       段階1 の網羅(方向ゾーン×強度×ボタンの全組)は Vitest 純関数側(inputResolution.test.ts)に委譲。
//
// 前提: `make e2e` / `make e2e-only` が起動する使い捨てスタックで実行される
//      (既定はバックエンド :47390 / Vite :5273。worktree ごとに決定的にオフセットされる)。
//      DB は毎回作り直す seed 済みの使い捨て DB であり、dev DB・dev サーバには影響しない。ryu が既定キャラ。
// DB 前提: /combos/new のフォーム DOM + ryu の基盤 seed(M14-03c の旧 000029/000030 で手入力 CSV 由来へ再 seed 済み)のみを対象とする
//          seed 非依存 self-contained。コンボは保存しない(作成データを残さない)ため後始末不要。
//          永続 dev DB 残渣には一切依存しない。


test.describe("M15-03 入力方式ボタン化 + 段階1 レシピ入力", () => {
  test("通常技(段階1)と必殺技(直接指定)でステップが確定する", async ({ page }) => {
    await gotoNewComboRecipeFor(page, "ryu");

    // ★★M29-01: 文言ではなく data-testid で掴む(M27-03 教訓 7)。着手前は
    //   本行が空状態の文面そのものを主張しており、語を直すと赤くなっていた。
    const emptyMsg = page.getByTestId("combo-recipe-steps-empty");
    await expect(emptyMsg).toBeVisible();

    // 通常技タブ(既定): ニュートラル(既定ゾーン)+ 弱パンチ → standing_light_punch を段階1 で確定。
    await page.getByTestId("recipe-tab-normal").click();
    await page.getByRole("button", { name: "弱パンチ" }).click();
    await expect(emptyMsg).toHaveCount(0);
    await expect(page.locator("ol > li")).toHaveCount(1);

    // 下(2)へ切替 + 中キック → crouching_medium_kick(方向合成。M17-03 で testId が recipe-dir-2 へ)。
    await page.getByTestId("recipe-dir-2").click();
    await page.getByRole("button", { name: "中キック" }).click();
    await expect(page.locator("ol > li")).toHaveCount(2);

    // 必殺技タブ: 技名(波動拳)→ 弱 を選んで hadoken_light を解決(指摘7: 技名/強度分離)。モーション実演なし。
    await page.getByTestId("recipe-tab-special").click();
    await page.getByTestId("recipe-special-family-hadoken").click();
    await page.getByTestId("recipe-special-strength-light").click();
    await expect(page.locator("ol > li")).toHaveCount(3);
  });
});

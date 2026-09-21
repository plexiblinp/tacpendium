import { test, expect } from "@playwright/test";

import { gotoNewComboRecipeFor } from "./support/editor-input";

// M30-06: ファミリー行の代表名の実データ E2E。
//
// 前提: `make e2e` / `make e2e-only` が起動する使い捨てスタックで実行される
//       (既定はバックエンド :47390 / Vite :5273)。DB は毎回作り直す seed 済みの
//       使い捨て DB であり、dev DB・dev サーバには影響しない。
//
// ★本 spec はコンボを 1 件も保存しない。⇒ サーバ状態を 1 バイトも書き換えない(D-431)。
//
// ★★母集団が違う。Vitest 側(specialFamilyRepresentativeName.roster.test.ts)が読むのは
//   seed CSV であり、本 spec は実 DB の preset_aliases(official_ja_move)を API 越しに
//   引いた結果を見る。⇒ 両方を見ないと CSV と DB のずれが検出できない。
//
// ★★★本 spec の核は 2 本目・3 本目である ——「対象 4 行が変わった」だけを測ると
//   **落としすぎ**が緑になる(`M30-05` 教訓 2 / チェックリスト束 A)。

test.describe("M30-06 ファミリー行の代表名", () => {
  test("★★★対象 4 行の行名から、派生元の強度語が落ちている", async ({ page }) => {
    await gotoNewComboRecipeFor(page, "cammy");
    await page.getByTestId("recipe-tab-special").click();

    await expect(
      page.getByTestId("recipe-special-family-silent_step"),
    ).toHaveText("サイレントステップ(フーリガン派生)");
    await expect(
      page.getByTestId("recipe-special-family-cannon_strike_hooligan_combination"),
    ).toHaveText("キャノンストライク(フーリガンコンビネーション派生)");
    await expect(
      page.getByTestId("recipe-special-family-reverse_edge_hooligan_combination"),
    ).toHaveText("リバースエッジ(フーリガンコンビネーション派生)");
    await expect(
      page.getByTestId("recipe-special-family-fatal_leg_twister"),
    ).toHaveText("フェイタルレッグツイスター(フーリガンコンビネーション派生)");
  });

  test("★★★陽性対照: 技そのものの名前には強度語が在る(消えたのは行の表示名だけ)", async ({
    page,
  }) => {
    // ★★落ちたのは**代表名**であって表示名そのものではない(指示書 §3-1)。
    //   ⇒ 行の中で弱/中/強を選べば、従来どおり強度語つきの技名がステップに入る。
    await gotoNewComboRecipeFor(page, "cammy");
    const steps = page.locator("ol > li");

    await page.getByTestId("recipe-tab-special").click();
    await page.getByTestId("recipe-special-family-silent_step").click();
    await page.getByTestId("recipe-special-strength-medium").click();

    await expect(steps).toHaveCount(1);
    await expect(steps.nth(0)).toContainText("サイレントステップ(中フーリガン派生)");
  });

  test("★★★反例群: 丸括弧の中の派生元の強度は残り、兄弟が区別できる", async ({
    page,
  }) => {
    // ★★★素朴な案(丸括弧の中の強度語を位置で落とす)を採っていたら、
    //   この 3 組は組ごとに同一表示になり区別できなくなる。
    await gotoNewComboRecipeFor(page, "cammy");
    await page.getByTestId("recipe-tab-special").click();

    // (1) OD だけを持つ兄弟 3 行。
    await expect(
      page.getByTestId("recipe-special-family-silent_step_light_od_hooligan_combination"),
    ).toHaveText("サイレントステップ(弱ODフーリガン派生)");
    await expect(
      page.getByTestId("recipe-special-family-silent_step_medium_od_hooligan_combination"),
    ).toHaveText("サイレントステップ(中ODフーリガン派生)");
    await expect(
      page.getByTestId("recipe-special-family-silent_step_heavy_od_hooligan_combination"),
    ).toHaveText("サイレントステップ(強ODフーリガン派生)");

    // (2) 対象行と紛れうる隣(OD 派生元)。⇒ 対象行と別物のまま残る。
    await expect(
      page.getByTestId("recipe-special-family-reverse_edge"),
    ).toHaveText("リバースエッジ(ODフーリガンコンビネーション派生)");

    // (3) 先頭以外の装飾の直後の強度語も残る。
    await expect(
      page.getByTestId(
        "recipe-special-family-fatal_leg_twister_hooligan_combination_holding",
      ),
    ).toHaveText("フェイタルレッグツイスター(【ホールド】強フーリガンコンビネーション派生)");
  });
});

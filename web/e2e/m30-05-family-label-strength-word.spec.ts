import { test, expect } from "@playwright/test";

import { gotoNewComboRecipeFor } from "./support/editor-input";

// M30-05: 必殺技ファミリー行の表示名に残る強度語の実データ E2E。
//
// 前提: `make e2e` / `make e2e-only` が起動する使い捨てスタックで実行される
//       (既定はバックエンド :47390 / Vite :5273。worktree ごとに決定的にオフセットされる)。
//       DB は毎回作り直す seed 済みの使い捨て DB であり、dev DB・dev サーバには影響しない。
//       ⇒ dev 側の状態(既存データ件数・開発者が最後に選んだ既定キャラ等)を仮定しないこと。
//
// ★本 spec はコンボを 1 件も保存しない。⇒ サーバ状態を 1 バイトも書き換えないため、
//   他ファイルと資源を取り合わない(D-431)。
//
// ★★母集団が違う。Vitest 側(specialFamilyLabel.roster.test.ts)が読むのは
//   seed CSV であり、本 spec は実 DB の preset_aliases(official_ja_move)を
//   API 越しに引いた結果を見る。⇒ 両方を見ないと、CSV と DB のずれが検出できない。

test.describe("M30-05 ファミリー行の表示名に残る強度語", () => {
  test("★★★(A) 群: 先頭装飾の直後の強度語が落ちている(装飾は残る)", async ({ page }) => {
    await gotoNewComboRecipeFor(page, "blanka");
    await page.getByTestId("recipe-tab-special").click();

    await expect(
      page.getByTestId("recipe-special-family-lightning_beast_rolling_attack"),
    ).toHaveText("【ライトニングビースト】ローリングアタック");
    await expect(
      page.getByTestId("recipe-special-family-lightning_beast_aerial_rolling_attack"),
    ).toHaveText("【ライトニングビースト】エリアルローリング");

    await gotoNewComboRecipeFor(page, "mai");
    await page.getByTestId("recipe-tab-special").click();
    await expect(page.getByTestId("recipe-special-family-flame_kachousen")).toHaveText(
      "[焔版]花蝶扇",
    );

    // ★★【2026-09-12 差し替え・M30-07】着手前はここで guile の
    //   `perfect_timing_sonic_boom` 行(「【ジャスト】ソニックブーム」)を見ていたが、
    //   **その行は無くなった** —— 同キャラの【ジャスト】版 `move_code` が接尾形へ揃い、
    //   基底 `sonic_boom` の **perfect 変種**として畳まれたからである。
    //   ⇒ 主張は 2 本へ差し替えた(減らしていない):
    //     (1) 基底行の表示名から強度語が落ちていること(本 spec 本来の軸。装飾は元から無い行)
    //     (2) その行が【ジャスト】変種を持つこと(M30-07 の成果の陽性対照)
    await gotoNewComboRecipeFor(page, "guile");
    await page.getByTestId("recipe-tab-special").click();
    await expect(page.getByTestId("recipe-special-family-sonic_boom")).toHaveText(
      "ソニックブーム",
    );
    await page.getByTestId("recipe-special-family-sonic_boom").click();
    await expect(page.getByTestId("recipe-special-variant-perfect")).toHaveText(
      "ジャスト",
    );
  });

  test("★★★M30-07: ルークとガイルの【ジャスト】版が同じ形で選べる", async ({ page }) => {
    // ★★本 spec で唯一「2 キャラを並べて見る」主張である。
    //   ⇒ 着手前はここが割れていた —— luke は変種軸で選べ、guile は別ファミリー 3 行として
    //     並んでいた。★実機で 2 キャラを並べる以外に気づく経路が無かった欠陥である。
    for (const [character, family] of [
      ["luke", "flash_knuckle"],
      ["guile", "sonic_boom"],
      ["guile", "somersault_kick"],
      ["guile", "sonic_cross"],
    ] as const) {
      await gotoNewComboRecipeFor(page, character);
      await page.getByTestId("recipe-tab-special").click();
      await page.getByTestId(`recipe-special-family-${family}`).click();
      await expect(
        page.getByTestId("recipe-special-variant-perfect"),
        `${character}/${family} に【ジャスト】変種が無い`,
      ).toHaveText("ジャスト");
    }

    // ★★★陰性対照: 旧の接頭形ファミリー行は 1 つも残っていない。
    //   ⇒ 「畳めた」だけでなく「二重に出ていない」ことも見る。
    await gotoNewComboRecipeFor(page, "guile");
    await page.getByTestId("recipe-tab-special").click();
    for (const family of [
      "perfect_timing_sonic_boom",
      "perfect_timing_somersault_kick",
      "perfect_timing_sonic_cross",
    ]) {
      await expect(
        page.getByTestId(`recipe-special-family-${family}`),
      ).toHaveCount(0);
    }
  });

  test("★★★陽性対照: 技そのものの名前には強度語が在る(消えたのは行の表示名だけ)", async ({
    page,
  }) => {
    await gotoNewComboRecipeFor(page, "blanka");
    const steps = page.locator("ol > li");

    await page.getByTestId("recipe-tab-special").click();
    await page
      .getByTestId("recipe-special-family-lightning_beast_rolling_attack")
      .click();
    await page.getByTestId("recipe-special-strength-light").click();

    await expect(steps).toHaveCount(1);
    await expect(steps.nth(0)).toContainText(
      "【ライトニングビースト】弱ローリングアタック",
    );
  });

  test("★★★(B) 群 対照: 丸括弧の中の派生元の強度は残り、兄弟 3 行が区別できる", async ({
    page,
  }) => {
    await gotoNewComboRecipeFor(page, "cammy");
    await page.getByTestId("recipe-tab-special").click();

    await expect(
      page.getByTestId("recipe-special-family-cannon_strike_light_od_hooligan_combination"),
    ).toHaveText("キャノンストライク(弱ODフーリガン派生)");
    await expect(
      page.getByTestId(
        "recipe-special-family-cannon_strike_medium_od_hooligan_combination",
      ),
    ).toHaveText("キャノンストライク(中ODフーリガン派生)");
    await expect(
      page.getByTestId("recipe-special-family-cannon_strike_heavy_od_hooligan_combination"),
    ).toHaveText("キャノンストライク(強ODフーリガン派生)");
  });
});

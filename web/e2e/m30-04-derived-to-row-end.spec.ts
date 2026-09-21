import { test, expect } from "@playwright/test";

import { gotoNewComboRecipeFor } from "./support/editor-input";

// M30-04: 必殺技ファミリー行の派生変種を末尾へ回す(開発者判断 D-801)の実データ E2E。
//
// ★★なぜ E2E が要るか: Vitest 側(moveSurfacing.roster.test.ts)が読むのは
//   `character_data/*.csv` の 2743 行であり、**実 DB の 3026 行と一致しない**。
//   差の 283 行はマイグレーションが直接投入する移動系 system 技であり必殺技ではないが、
//   「一致しているはず」は推測である。⇒ 実サーバ越しの並びはここでしか主張できない。
//
// ★★もう 1 つの理由: 単体テストは `deriveSpecialFamilies` の**戻り値**を見るが、
//   画面が実際にその順で描いているかは見ていない。本 spec は DOM の並びを見る。
//
// 前提: E2E 使い捨て DB。コンボは保存しない = サーバ状態を 1 バイトも書き換えない。

/** 必殺技タブのファミリー行を、画面に並んでいる順で返す。 */
async function familyOrder(page: import("@playwright/test").Page) {
  await page.getByTestId("recipe-tab-special").click();
  const ids = await page
    .locator('[data-testid^="recipe-special-family-"]')
    .evaluateAll((els) =>
      els.map((e) => e.getAttribute("data-testid") ?? ""),
    );
  return ids.map((id) => id.replace("recipe-special-family-", ""));
}

test.describe("M30-04 必殺技ファミリー行の並び", () => {
  test("★★ジェイミー: 魔身(酔い+1)以外の魔身と酔い系が末尾へ回り、素の技が先頭側に残る", async ({
    page,
  }) => {
    await gotoNewComboRecipeFor(page, "jamie");
    const order = await familyOrder(page);

    // ★★★全数を固定する。「末尾に derived が居る」だけでは、元から末尾だった並びでも
    //   緑になる(指示書 §4.2)。⇒ 先頭側 6 件が何であるかまで書く。
    expect(order).toEqual([
      // --- is_derived=false の群(初出順＝moves.id 昇順のまま) ---
      "the_devil_inside",
      "swagger_step",
      "arrow_kick",
      "luminous_dive_kick",
      "bakkai",
      "tenshin",
      // --- is_derived=true の群(初出順のまま末尾へ回った) ---
      "the_devil_inside_up2",
      "the_devil_inside_up3",
      "the_devil_inside_up4",
      "the_devil_inside_reach_drink_lv4",
      "the_devil_inside_up2_reach_drink_lv4",
      "the_devil_inside_up3_reach_drink_lv4",
      "freeflow_strikes_1hit",
      "freeflow_strikes_2hits",
      "freeflow_strikes",
      "freeflow_kicks_2hit",
      "freeflow_kicks",
      "swagger_hermit_punch",
      "drink_level_4_freeflow_strikes_1hit",
      "drink_level_4_freeflow_strikes_2hits",
      "drink_level_4_freeflow_strikes",
    ]);

    // ★開発者の逐語が名指しした形: 着手時点は「魔身（酔い+2）」が **2 行目**に居た。
    //   ⇒ いまは 2 行目が魔身ではない。
    expect(order[1]).not.toContain("the_devil_inside");

    // ★★1 件も消えていない(削るのではなく末尾へ回す＝D-801)。
    expect(order).toHaveLength(21);
    expect(order.filter((f) => f.startsWith("the_devil_inside"))).toHaveLength(7);
  });

  test("★★ブランカ: ライトニングビースト系とローリングキャノン 8 方向が末尾へ回る", async ({
    page,
  }) => {
    await gotoNewComboRecipeFor(page, "blanka");
    const order = await familyOrder(page);

    expect(order).toEqual([
      "electric_thunder",
      "rolling_attack",
      "vertical_rolling_attack",
      "backstep_rolling_attack",
      "aerial_rolling_attack",
      "wild_hunt",
      "blanka_chan_bomb",
      "blanka_chan_bomb_activated",
      "lightning_beast_electric_thunder",
      "lightning_beast_rolling_attack",
      "lightning_beast_vertical_rolling_attack",
      "lightning_beast_backstep_rolling_attack",
      "lightning_beast_aerial_rolling_attack",
      "rolling_cannon",
      "rolling_cannon_down",
      "rolling_cannon_down_forward",
      "rolling_cannon_back",
      "rolling_cannon_forward",
      "rolling_cannon_up_back",
      "rolling_cannon_up",
      "rolling_cannon_up_forward",
    ]);
  });

  test("★末尾へ回っても押せる(入力手段が消えていない)", async ({ page }) => {
    // ★★D-801 が「削る」ではなく「末尾へ出す」を選んだ理由そのものを面の上で確かめる。
    await gotoNewComboRecipeFor(page, "jamie");
    await page.getByTestId("recipe-tab-special").click();

    const steps = page.locator('[data-testid^="recipe-step-"]');
    await expect(steps).toHaveCount(0);

    // 末尾へ回った魔身（酔い+2）を選び、強度なし通常版で入力する。
    await page.getByTestId("recipe-special-family-the_devil_inside_up2").click();
    await page.getByTestId("recipe-special-strength-none").click();
    await expect(steps).toHaveCount(1);
  });

  test("★並べ替えは既定選択を動かさない(先頭は is_derived=false のファミリー)", async ({
    page,
  }) => {
    // ★実測: 31 キャラのいずれも index 0 は非 derived である。
    //   ⇒ SpecialMovePanel の `families[0]` フォールバックは本サブで動かない。
    await gotoNewComboRecipeFor(page, "jamie");
    await page.getByTestId("recipe-tab-special").click();
    // 既定選択のファミリーの強度行に「強度なし通常版」があること(魔身は強度を持たない)。
    await expect(page.getByTestId("recipe-special-strength-none")).toBeVisible();
    const order = await familyOrder(page);
    expect(order[0]).toBe("the_devil_inside");
  });
});

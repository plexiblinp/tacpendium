import { test, expect } from "@playwright/test";

import { gotoNewComboRecipeFor } from "./support/editor-input";

// M30-01: 仮想コントローラの技の出し分け(P4M-017 / P4M-007 / P4M-008 / SM-100)の実データ E2E。
//
// 目的: 実 seed で「何が出て何が出ていないか」が画面の側でも成り立つことを確かめる。
//       区分ごとの網羅は Vitest 側(moveSurfacing.test.ts / moveSurfacing.roster.test.ts)に委譲する。
//
// 前提: E2E 使い捨て DB。ジェイミー(開発者が P4M-017 で名指ししたキャラ)を使う。
//       コンボは保存しない = サーバ状態を 1 バイトも書き換えないため、他 spec と資源を取り合わない。

test.describe("M30-01 仮想コントローラの出し分け", () => {
  test("タブは 8 枚で、ターゲットコンボは特殊技の隣・未分類は SA の隣・共通技は一番右に並ぶ", async ({
    page,
  }) => {
    await gotoNewComboRecipeFor(page, "jamie");

    const tabs = page.locator('[data-testid^="recipe-tab-"]');
    await expect(tabs).toHaveCount(8);

    const ids = await tabs.evaluateAll((els) =>
      els.map((el) => el.getAttribute("data-testid")),
    );
    expect(ids).toEqual([
      "recipe-tab-normal",
      "recipe-tab-unique",
      "recipe-tab-target-combo",
      "recipe-tab-special",
      "recipe-tab-super-art",
      "recipe-tab-unclassified",
      "recipe-tab-character-state",
      "recipe-tab-common",
    ]);
  });

  test("ターゲットコンボタブから 1 ステップ積める(P4M-007 / SM-135)", async ({
    page,
  }) => {
    await gotoNewComboRecipeFor(page, "jamie");
    const steps = page.locator("ol > li");

    await page.getByTestId("recipe-tab-target-combo").click();
    await page.getByTestId("recipe-target-combo-bitter_strikes").click();
    await expect(steps).toHaveCount(1);
    await expect(steps.nth(0)).toContainText("鋭鍾打");

    // 派生行も同じタブに並ぶ(is_derived で絞っていない)。
    await page.getByTestId("recipe-target-combo-full_moon_kick").click();
    await expect(steps).toHaveCount(2);
    await expect(steps.nth(1)).toContainText("円月脚");
  });

  test("未分類タブに残るのは区分 E だけで、必殺技タブに載る技は混ざらない(P4M-008 (a))", async ({
    page,
  }) => {
    await gotoNewComboRecipeFor(page, "jamie");
    const steps = page.locator("ol > li");

    await page.getByTestId("recipe-tab-unclassified").click();

    // 区分 E: 共通技タブが引く 13 code 以外の投げ。
    await expect(
      page.getByTestId("recipe-unclassified-forward_throw_drink"),
    ).toBeVisible();

    // ★★M30-02(P4M-016): 強度を持たない必殺技は必殺技タブへ移った。
    //   ⇒ 着手時点はここに並んでいた `tenshin`(点辰)と `the_devil_inside` が消える。
    await expect(page.getByTestId("recipe-unclassified-tenshin")).toHaveCount(0);
    await expect(
      page.getByTestId("recipe-unclassified-the_devil_inside"),
    ).toHaveCount(0);
    // 対照: 強度接尾辞を持つ必殺技は従来どおり必殺技タブに載る。
    await expect(
      page.getByTestId("recipe-unclassified-freeflow_strikes_1hit_light"),
    ).toHaveCount(0);
    // 対照: ターゲットコンボは自分のタブが引き受けたため、ここには出ない。
    await expect(page.getByTestId("recipe-unclassified-bitter_strikes")).toHaveCount(0);

    await page.getByTestId("recipe-unclassified-forward_throw_drink").click();
    await expect(steps).toHaveCount(1);
  });

  test("★★M30-02(P4M-016): 点辰が必殺技タブのファミリーへ出て『強度なし通常版』で押せる", async ({
    page,
  }) => {
    await gotoNewComboRecipeFor(page, "jamie");
    const steps = page.locator("ol > li");

    await page.getByTestId("recipe-tab-special").click();
    // ★開発者の逐語(P4M-017)が名指しした技である。着手時点はファミリー行に出ていなかった。
    await page.getByTestId("recipe-special-family-tenshin").click();
    // ★`tenshin` と `tenshin_od` が 1 ファミリーへ合流する。
    //   ⇒ 着手時点は「ファミリー名も出ない」であり、OD すら押せなかった。
    await expect(page.getByTestId("recipe-special-od-plain")).toBeVisible();
    // ★弱中強は 1 つも無いので行ごと出ない。
    await expect(page.getByTestId("recipe-special-strength-light")).toHaveCount(0);

    await page.getByTestId("recipe-special-strength-none").click();
    await expect(steps).toHaveCount(1);
    await expect(steps.nth(0)).toContainText("点辰");
  });

  test("★★M30-03: 強度語が code の途中に在る必殺技(A2)が必殺技タブから押せる", async ({
    page,
  }) => {
    // ★★陽性対照(指示書 §5-3)。着手時点は必殺技タブに 1 件も出ておらず、
    //   `lightning_beast_*` は未分類タブか固有状態タブからしか押せなかった。
    await gotoNewComboRecipeFor(page, "blanka");
    const steps = page.locator("ol > li");

    await page.getByTestId("recipe-tab-special").click();
    // ★ファミリー名は強度語 1 トークンを抜いた残りである
    //   (`lightning_beast_light_rolling_attack` → `lightning_beast_rolling_attack`)。
    await page
      .getByTestId("recipe-special-family-lightning_beast_rolling_attack")
      .click();

    // ★★弱中強 ＋ OD が 1 ファミリーへ合流する。⇒ 着手時点はファミリー行すら出なかった。
    await expect(page.getByTestId("recipe-special-strength-light")).toBeVisible();
    await expect(page.getByTestId("recipe-special-strength-medium")).toBeVisible();
    await expect(page.getByTestId("recipe-special-strength-heavy")).toBeVisible();
    await expect(page.getByTestId("recipe-special-od-plain")).toBeVisible();

    await page.getByTestId("recipe-special-strength-light").click();
    await expect(steps).toHaveCount(1);

    // ★★followup §CL『素は押せるが OD が押せない』の解消。
    //   `lightning_beast_electric_thunder` は素(A1)が M30-02 で載り、
    //   その OD(A2)は載っていなかった。⇒ いまは同じファミリーの中に両方在る。
    await page.getByTestId("recipe-tab-special").click();
    await page
      .getByTestId("recipe-special-family-lightning_beast_electric_thunder")
      .click();
    await expect(page.getByTestId("recipe-special-od-plain")).toBeVisible();
  });

  test("★舞は状態 code の語幹で拾える(案 A′。flame_stock ↔ flame_*)", async ({
    page,
  }) => {
    await gotoNewComboRecipeFor(page, "mai");
    await page.getByTestId("recipe-tab-character-state").click();
    // ★語幹照合を入れる前は 0 件だった(開発者の実機確認で判明)。
    // ★★M31-05(マイグレ 000110)で 26 -> 35 になった。**緑にするために合わせた値ではない。**
    //   舞へ `kachousen`(花蝶扇バウンド中)の state を足したぶんそのままである——
    //   語幹 `kachousen` が焔なしの 9 件(`kachousen_light` / `kachousen_holding_*` /
    //   `midare_kachousen`)を新たに拾う(26 + 9 = 35)。既存の `flame_stock` が拾っていた
    //   26 件は 1 件も減っていない。⇒ 数字が動くこと自体が検出したい変化である。
    await expect(
      page.locator('[data-testid^="recipe-character-state-"]'),
    ).toHaveCount(35);
  });

  test("キャラ固有状態タブに酔いレベルの技が並ぶ(P4M-008 (b))", async ({ page }) => {
    await gotoNewComboRecipeFor(page, "jamie");

    await page.getByTestId("recipe-tab-character-state").click();
    const listed = page.locator('[data-testid^="recipe-character-state-"]');
    await expect(listed.first()).toBeVisible();

    await expect(
      page.getByTestId("recipe-character-state-drink_level_3_hermits_elbow"),
    ).toBeVisible();
    // 対照: 状態の語を持たない技は並ばない。
    await expect(
      page.getByTestId("recipe-character-state-standing_light_punch"),
    ).toHaveCount(0);
  });

  test("★共通技タブに 13 種の共通技と生ラッシュが並ぶ(常設行からの移設)", async ({
    page,
  }) => {
    await gotoNewComboRecipeFor(page, "jamie");
    const steps = page.locator("ol > li");

    await page.getByTestId("recipe-tab-common").click();
    const listed = page.locator('[data-testid^="recipe-common-"]');
    // ★実 DB には 13 code すべてが 31 キャラぶん在る(CSV には 4 code しか無い)。
    await expect(listed).toHaveCount(13);
    // 生ラッシュは move ではないため別ボタン。
    await expect(
      page.getByTestId("recipe-system-parry-drive-rush"),
    ).toBeVisible();

    // ★移設前はどの面にも出ていなかった移動系。
    await page.getByTestId("recipe-common-micro_forward").click();
    await expect(steps).toHaveCount(1);
    await expect(steps.nth(0)).toContainText("微歩き");

    // ★常設行が持っていた 6 code も引き続き押せる。
    await page.getByTestId("recipe-common-dash_forward").click();
    await expect(steps).toHaveCount(2);
  });

  test("★★未分類タブの件数が実 DB で固定である(CSV では測れない面)", async ({
    page,
  }) => {
    // ★★単体テスト(moveSurfacing.roster.test.ts)は seed CSV しか読めず、
    //   マイグレーションが投入する 283 行を母集団に含められない。
    //   ⇒ 実 DB・実設定での件数はここでしか主張できない。
    // ★★M30-02(P4M-016)で大きく減った(着手時点 jamie 11 / mai 3 / blanka 12 / manon 0)。
    //   減ったぶんはすべて「強度を持たない必殺技」であり、必殺技タブへ移っている。
    //   ⇒ 緑にするために合わせた値ではなく、新しい実測である。
    // ★★★【2026-09-10 追加・M30-03】**上の 4 キャラは本サブで 1 件も動かない。**
    //   ⇒ 動かないことの確認にはなるが、**本サブの変化を捕まえられない。**
    //     指示書 §2.3-3 は「この件数が動く」と見込んでいたが、実測は動かなかった
    //     (4 キャラの残り 5 件はいずれも投げ・normal・rush_variant であり A2 ではない)。
    //   ⇒ **実際に動く 2 キャラを足す。** 全体では実 DB の未分類が 87 → 41 行になった。
    //     cammy 13 → 1(A2 を 12 件持つ) / m_bison 9 → 0(同 9 件)。
    const cases: ReadonlyArray<[string, number]> = [
      ["jamie", 2],
      ["mai", 1],
      ["blanka", 2],
      ["manon", 0],
      ["cammy", 1],
      ["m_bison", 0],
    ];
    for (const [code, expected] of cases) {
      await gotoNewComboRecipeFor(page, code);
      await page.getByTestId("recipe-tab-unclassified").click();
      await expect(
        page.locator('[data-testid^="recipe-unclassified-"]'),
        `${code} の未分類件数`,
      ).toHaveCount(expected);
    }
  });

  test("全技一覧の「ボタンで入力できる技を省く」は既定 OFF で、ON でも未分類の技は残る(SM-100)", async ({
    page,
  }) => {
    await gotoNewComboRecipeFor(page, "jamie");

    await page.getByTestId("recipe-pulldown-toggle").click();
    const select = page.getByTestId("recipe-move-select");
    const toggle = page.getByTestId("recipe-omit-surfaced-toggle");

    await expect(toggle).not.toBeChecked();
    await expect(select.getByRole("option", { name: "立ち弱P", exact: true })).toHaveCount(1);
    // ★★M31-04: 入力面へ一切出さない技は、トグル OFF(既定)でも選択肢に現れない。
    //   ★実 DB でしか測れない —— drive_reversal は全キャラに 1 行ずつ在る(000109)。
    //   ★件数を見ている検査(:156 の未分類タブ)はタブ側しか守らない。プルダウンは
    //     技名を名指しして数える形なので、選択肢が増えても他の行は緑のままである。
    await expect(
      select.getByRole("option", { name: /ドライブリバーサル/ }),
    ).toHaveCount(0);
    await expect(
      select.getByRole("option", { name: "前投げ(飲酒)", exact: true }),
    ).toHaveCount(1);

    await toggle.check();

    // 省かれる側: 通常技タブから押せる。
    await expect(select.getByRole("option", { name: "立ち弱P", exact: true })).toHaveCount(0);
    // ★★M30-02(P4M-016): 点辰は必殺技タブから押せるようになった。⇒ 省かれる側へ移った。
    await expect(select.getByRole("option", { name: "点辰", exact: true })).toHaveCount(0);
    // ★残る側: どのタブにも載らない技は入力手段が消えてはならない。
    await expect(
      select.getByRole("option", { name: "前投げ(飲酒)", exact: true }),
    ).toHaveCount(1);

    await toggle.uncheck();
    await expect(select.getByRole("option", { name: "立ち弱P", exact: true })).toHaveCount(1);
  });
});

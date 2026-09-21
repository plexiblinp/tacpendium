import { test, expect } from "@playwright/test";

import { gotoNewComboRecipeFor } from "./support/editor-input";

// M30-02: 仮想コントローラの「どう選ばせるか」の実データ E2E。
//   P4M-016(強度なし通常版) / P4M-018(変種行) / SD-020(OD 強度組合せの既定非表示)。
//
// 前提: `make e2e` / `make e2e-only` が起動する使い捨てスタックで実行される
//       (既定はバックエンド :47390 / Vite :5273。worktree ごとに決定的にオフセットされる)。
//       DB は毎回作り直す seed 済みの使い捨て DB であり、dev DB・dev サーバには影響しない。
//       ⇒ dev 側の状態(既存データ件数・開発者が最後に選んだ既定キャラ等)を仮定しないこと。
//
// ★本 spec はコンボを 1 件も保存しない。⇒ サーバ状態を 1 バイトも書き換えないため、
//   他ファイルと資源を取り合わない(D-431)。

test.describe("M30-02 仮想コントローラの選び方", () => {
  test("★★P4M-018: ホールドはファミリー行から消え、変種として選ぶ(マリーザ)", async ({
    page,
  }) => {
    await gotoNewComboRecipeFor(page, "marisa");
    const steps = page.locator("ol > li");

    await page.getByTestId("recipe-tab-special").click();

    await expect(page.getByTestId("recipe-special-family-gladius")).toHaveText(
      "グラディウス",
    );
    await expect(
      page.getByTestId("recipe-special-family-gladius_holding"),
    ).toHaveCount(0);

    await page.getByTestId("recipe-special-family-gladius").click();
    await expect(page.getByTestId("recipe-special-variant-plain")).toBeVisible();
    await expect(page.getByTestId("recipe-special-variant-holding")).toBeVisible();

    await page.getByTestId("recipe-special-strength-light").click();
    await expect(steps).toHaveCount(1);
    await expect(steps.nth(0)).toContainText("弱グラディウス");

    await page.getByTestId("recipe-special-variant-holding").click();
    await page.getByTestId("recipe-special-strength-light").click();
    await expect(steps).toHaveCount(2);
    await expect(steps.nth(1)).toContainText("【ホールド】弱グラディウス");
  });

  test("★最大ホールド・ジャストも同じ軸で選ぶ(マリーザ / ルーク)", async ({ page }) => {
    await gotoNewComboRecipeFor(page, "marisa");
    await page.getByTestId("recipe-tab-special").click();
    await page.getByTestId("recipe-special-family-scutum").click();
    await expect(
      page.getByTestId("recipe-special-variant-max-holding"),
    ).toBeVisible();
    await expect(
      page.getByTestId("recipe-special-family-scutum_max_holding"),
    ).toHaveCount(0);

    await gotoNewComboRecipeFor(page, "luke");
    await page.getByTestId("recipe-tab-special").click();
    await page.getByTestId("recipe-special-family-flash_knuckle").click();
    await expect(page.getByTestId("recipe-special-variant-holding")).toBeVisible();
    await expect(page.getByTestId("recipe-special-variant-perfect")).toBeVisible();
  });

  test("★変種を持たないファミリーでは変種行を出さない(対照)", async ({ page }) => {
    await gotoNewComboRecipeFor(page, "marisa");
    await page.getByTestId("recipe-tab-special").click();
    await page.getByTestId("recipe-special-family-phalanx").click();
    await expect(page.getByTestId("recipe-special-variant-plain")).toHaveCount(0);
    await expect(page.getByTestId("recipe-special-variant-holding")).toHaveCount(0);
  });

  test("★★P4M-016: 強度を持たない必殺技が『強度なし通常版』で押せる(テリー)", async ({
    page,
  }) => {
    await gotoNewComboRecipeFor(page, "terry");
    const steps = page.locator("ol > li");

    await page.getByTestId("recipe-tab-special").click();
    await page.getByTestId("recipe-special-family-quick_burn").click();
    await expect(page.getByTestId("recipe-special-strength-light")).toHaveCount(0);

    await page.getByTestId("recipe-special-strength-none").click();
    await expect(steps).toHaveCount(1);
    await expect(steps.nth(0)).toContainText("クイックバーン");
  });

  test("★★逐語 (b): ラウンドウェイブもデータ是正後は『強度なし通常版』で押せる", async ({
    page,
  }) => {
    // ★開発者のインゲーム確認(2026-09-09)＝「ラウンドウェイブの強度はなしです」を受けて
    //   move_code を round_wave_heavy → round_wave へ是正した(マイグレ 000107)。
    //   ⇒ 着手時点は「強だけが押せる」形であり、本テストはその対照だった。
    await gotoNewComboRecipeFor(page, "terry");
    const steps = page.locator("ol > li");

    await page.getByTestId("recipe-tab-special").click();
    await page.getByTestId("recipe-special-family-round_wave").click();
    // ★弱中強の行は 1 つも無いので出ない(強度の概念が無い技である)。
    await expect(page.getByTestId("recipe-special-strength-heavy")).toHaveCount(0);
    await expect(page.getByTestId("recipe-special-strength-light")).toHaveCount(0);

    await page.getByTestId("recipe-special-strength-none").click();
    await expect(steps).toHaveCount(1);
    await expect(steps.nth(0)).toContainText("ラウンドウェイブ");
  });

  test("★★SD-020: OD 強度組合せは既定で畳まれ、展開すると 3 つとも出る", async ({
    page,
  }) => {
    await gotoNewComboRecipeFor(page, "ryu");

    await page.getByTestId("recipe-tab-special").click();
    await page.getByTestId("recipe-special-family-hadoken").click();

    await expect(page.getByTestId("recipe-special-od-plain")).toBeVisible();
    for (const v of ["lm", "mh", "lh"]) {
      await expect(page.getByTestId(`recipe-special-od-${v}`)).toHaveCount(0);
    }

    await page.getByTestId("recipe-special-od-variants-toggle").click();
    for (const v of ["lm", "mh", "lh"]) {
      await expect(page.getByTestId(`recipe-special-od-${v}`)).toBeVisible();
    }
  });

  test("★★SD-020: 全技一覧の補足では OD 技のときだけ OD 強度組合せを付けられる", async ({
    page,
  }) => {
    await gotoNewComboRecipeFor(page, "ryu");

    await page.getByTestId("recipe-pulldown-toggle").click();
    const section = page.getByTestId("recipe-od-variant-section-inline");
    const select = page.getByTestId("recipe-move-select");

    // ★★2026-09-09 開発者判断: 必殺技の OD でなければ節ごと出さない。
    await expect(section).toHaveCount(0);
    await select.selectOption({ label: "しゃがみ弱P" });
    await expect(section).toHaveCount(0);

    // 対照: OD 技を選ぶと現れる。★既定は畳まれている。
    await select.selectOption({ label: "OD波動拳" });
    await expect(section).toHaveCount(1);
    await expect(section.getByText("OD(弱中)")).toHaveCount(0);
    await page.getByTestId("recipe-od-variant-toggle-inline").click();
    await expect(section.getByText("OD(弱中)").locator("input")).toBeEnabled();

    // ★★レビュー 高-2: `od` が code の途中に在る OD 必殺技も対象である
    //   (`denjin_charge_od_hadoken`)。末尾だけを見ると 37 行が弾かれる。
    await select.selectOption({ label: "[電刃錬気]OD波動拳" });
    await expect(section).toHaveCount(1);

    // 対照: 必殺技でも OD でなければ節ごと消える。
    await select.selectOption({ label: "弱波動拳" });
    await expect(section).toHaveCount(0);
  });
});

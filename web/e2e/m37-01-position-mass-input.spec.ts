import { test, expect, type Page } from "@playwright/test";

import { gotoNewComboFor } from "./support/character";
import { addMinimalRecipeStep } from "./support/editor-input";
import { completeNewComboSave } from "./support/new-combo";

// M37-01: 始動位置・運び量の入力(D-730 / D-731 ＋ 2026-09-13 開発者裁定)。
//
// ★★2026-09-13 に作りが変わった —— 3 方式を並べて連動させる形から、
//   **入力方式を選んで 1 項目だけ入力させる**形へ。⇒ 連動は「方式を切り替えると
//   同じ値が別の単位で見える」ことで確かめる(保存される値はマス数 1 本＝D-731)。
//
// ★★本 spec が押さえるのは「往復して保存されること」である。単体テストは
//   画面の中しか見ない —— ★着手前に見つかった穴はまさにそこにあった:
//   PATCH の契約に 2 列が無く、**編集モードでマス数だけを直すと黙って落ちた**。

const positionMode = (page: Page, mode: "band" | "mass" | "percent") =>
  page.getByTestId(`combo-editor-position-mode-${mode}`).click();
const carryMode = (page: Page, mode: "mass" | "percent") =>
  page.getByTestId(`combo-editor-carry-mode-${mode}`).click();

const startMass = (page: Page) =>
  page.getByTestId("combo-editor-start-position-mass");
const startPct = (page: Page) =>
  page.getByTestId("combo-editor-start-position-mass-percent");
const carryMass = (page: Page) =>
  page.getByTestId("combo-editor-carry-distance-mass");

/** 仮登録で最小のコンボを 1 件作る(本 spec は状況の値そのものが主題ではない)。 */
async function createMinimalCombo(page: Page): Promise<number> {
  await gotoNewComboFor(page, "ryu");
  await page.getByTestId("combo-editor-draft-checkbox").click();
  await addMinimalRecipeStep(page);
  return completeNewComboSave(page, () =>
    page.getByRole("button", { name: "保存" }).click(),
  );
}

test.describe("M37-01 始動位置・運び量の入力", () => {
  test("既定は通常入力で、方式を選ぶと入力欄が 1 つだけ入れ替わる", async ({
    page,
  }) => {
    await gotoNewComboFor(page, "ryu");

    // 既定＝通常入力(D-731「既定の入力方式は従来型のまま」)。
    await expect(
      page.getByTestId("combo-editor-position-mode-band"),
    ).toHaveAttribute("aria-checked", "true");
    await expect(page.getByTestId("combo-editor-position-mid_screen")).toBeVisible();
    await expect(startMass(page)).toHaveCount(0);

    await positionMode(page, "mass");
    await expect(page.getByTestId("combo-editor-position-mid_screen")).toHaveCount(0);
    await expect(startMass(page)).toBeVisible();
    await expect(startPct(page)).toHaveCount(0);

    await positionMode(page, "percent");
    await expect(startMass(page)).toHaveCount(0);
    await expect(startPct(page)).toBeVisible();
  });

  test("方式を切り替えても値は 1 本のまま(3 方向とも)", async ({ page }) => {
    await gotoNewComboFor(page, "ryu");

    // 区分 → マス目 / パーセンテージ
    await page.getByTestId("combo-editor-position-mid_screen").click();
    await positionMode(page, "mass");
    await expect(startMass(page)).toHaveValue("80");
    await positionMode(page, "percent");
    await expect(startPct(page)).toHaveValue("50");

    // マス目 → 区分 / パーセンテージ
    await positionMode(page, "mass");
    await startMass(page).fill("100");
    await positionMode(page, "band");
    await expect(
      page.getByTestId("combo-editor-position-mid_opponent"),
    ).toHaveAttribute("aria-checked", "true");
    await positionMode(page, "percent");
    await expect(startPct(page)).toHaveValue("62.5");

    // パーセンテージ → マス目 / 区分
    await startPct(page).fill("25");
    await positionMode(page, "mass");
    await expect(startMass(page)).toHaveValue("40");
    await positionMode(page, "band");
    await expect(
      page.getByTestId("combo-editor-position-corner_self_near"),
    ).toHaveAttribute("aria-checked", "true");
  });

  test("★★運び量に区分の入力が無い(D-731 不変条件 2)", async ({ page }) => {
    await gotoNewComboFor(page, "ryu");

    // ★入力方式は 2 択であり、「通常入力(区分)」が無い。
    await expect(page.getByTestId("combo-editor-carry-mode-mass")).toBeVisible();
    await expect(page.getByTestId("combo-editor-carry-mode-percent")).toBeVisible();
    await expect(page.getByTestId("combo-editor-carry-mode-band")).toHaveCount(0);

    // ★区分ボタン群は始動位置のぶん 1 組しか存在しない。
    //   ★exact を付ける —— 既定は部分一致であり、「始動位置の入力方式」まで拾う。
    await expect(
      page.getByRole("radiogroup", { name: "始動位置", exact: true }),
    ).toHaveCount(1);
    await expect(
      page.getByRole("radiogroup", { name: "運び量", exact: true }),
    ).toHaveCount(0);

    // ★運び量を動かしても始動位置は 1 つも動かない(不変条件 1)。
    await page.getByTestId("combo-editor-position-mid_screen").click();
    await carryMass(page).fill("155");
    await positionMode(page, "mass");
    await expect(startMass(page)).toHaveValue("80");
  });

  test("ⓘ にトレーニングモードの物差しの定義が出る", async ({ page }) => {
    await gotoNewComboFor(page, "ryu");
    await page.getByTestId("info-mark-position-mass").click();
    await expect(
      page.getByText(
        "トレーニングモードで、自分が画面端にいる状態を 0、相手が画面端にいる状態を 160（100%）とします。",
      ),
    ).toBeVisible();
  });

  test("新規登録(POST)で両方が保存され、詳細に出る", async ({ page }) => {
    await gotoNewComboFor(page, "ryu");
    await page.getByTestId("combo-editor-draft-checkbox").click();
    await addMinimalRecipeStep(page);
    await positionMode(page, "mass");
    await startMass(page).fill("100");
    await carryMass(page).fill("45");

    const id = await completeNewComboSave(page, () =>
      page.getByRole("button", { name: "保存" }).click(),
    );
    await page.goto(`/combos/${id}`);

    await expect(
      page.getByTestId("combo-detail-start-position-mass"),
    ).toHaveText("100 マス (62.5%)");
    await expect(
      page.getByTestId("combo-detail-carry-distance-mass"),
    ).toHaveText("45 マス (28.1%)");
  });

  // ★★★本 spec の中心。着手前はここが落ちていた。
  test("★★編集で運び量だけを直しても保存される(PATCH 経路)", async ({ page }) => {
    const id = await createMinimalCombo(page);

    await page.goto(`/combos/${id}/edit`);
    await carryMass(page).fill("64");

    // ★運び量は重複判定キーではない。⇒ PATCH で飛び、コンボ id は変わらない。
    const [res] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.request().method() === "PATCH" &&
          new URL(r.url()).pathname === `/api/combos/${id}`,
      ),
      page.getByRole("button", { name: "保存" }).click(),
    ]);
    expect(res.status()).toBe(200);

    await page.goto(`/combos/${id}`);
    await expect(
      page.getByTestId("combo-detail-carry-distance-mass"),
    ).toHaveText("64 マス (40%)");
  });

  test("★区分内のマス変更は PATCH に留まる(コンボ id が変わらない)", async ({
    page,
  }) => {
    await gotoNewComboFor(page, "ryu");
    await page.getByTestId("combo-editor-draft-checkbox").click();
    await addMinimalRecipeStep(page);
    await positionMode(page, "mass");
    await startMass(page).fill("80"); // mid_screen(70〜90)
    const id = await completeNewComboSave(page, () =>
      page.getByRole("button", { name: "保存" }).click(),
    );

    await page.goto(`/combos/${id}/edit`);
    await positionMode(page, "mass");
    await startMass(page).fill("85"); // 同じ区分の中で動かす
    const [res] = await Promise.all([
      page.waitForResponse(
        (r) =>
          ["PATCH", "PUT"].includes(r.request().method()) &&
          new URL(r.url()).pathname === `/api/combos/${id}`,
      ),
      page.getByRole("button", { name: "保存" }).click(),
    ]);
    // ★区分が変わっていないので、再登録(PUT)にはならない。
    expect(res.request().method()).toBe("PATCH");

    await page.goto(`/combos/${id}`);
    await expect(
      page.getByTestId("combo-detail-start-position-mass"),
    ).toContainText("85 マス");
  });

  // ★★2026-09-13 開発者裁定(要望 1a): 値域外は画面に入らない。
  //   ⇒ 着手時の「入れられるが保存で拒否される」から差し戻した。
  test("★値域外は画面に入らない(161 → 160 / -1 → 0)", async ({ page }) => {
    await gotoNewComboFor(page, "ryu");
    await positionMode(page, "mass");

    await startMass(page).fill("0");
    await positionMode(page, "percent");
    await expect(startPct(page)).toHaveValue("0");

    await positionMode(page, "mass");
    await startMass(page).fill("160");
    await positionMode(page, "percent");
    await expect(startPct(page)).toHaveValue("100");

    // ★161 / -1 はその場で丸められ、そもそも保存まで到達しない。
    await positionMode(page, "mass");
    await startMass(page).fill("161");
    await expect(startMass(page)).toHaveValue("160");
    await startMass(page).fill("-1");
    await expect(startMass(page)).toHaveValue("0");

    // パーセント欄も同じ。
    await positionMode(page, "percent");
    await startPct(page).fill("101");
    await expect(startPct(page)).toHaveValue("100");
  });

  test("未入力(空)を保存でき、詳細では「-」になる(§5-3)", async ({ page }) => {
    await gotoNewComboFor(page, "ryu");
    await page.getByTestId("combo-editor-draft-checkbox").click();
    await addMinimalRecipeStep(page);
    // 何も入れずに保存する。
    const id = await completeNewComboSave(page, () =>
      page.getByRole("button", { name: "保存" }).click(),
    );
    await page.goto(`/combos/${id}`);
    await expect(
      page.getByTestId("combo-detail-carry-distance-mass"),
    ).toHaveText("-");
  });
});

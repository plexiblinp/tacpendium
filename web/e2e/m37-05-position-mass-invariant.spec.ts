import { test, expect, type Page } from "@playwright/test";

import { gotoNewComboFor } from "./support/character";
import { addMinimalRecipeStep } from "./support/editor-input";
import { completeNewComboSave } from "./support/new-combo";

// M37-05: 始動位置のマス数の不変条件(`P-60` の決着・`D-864`)。
//
// ★★★不変条件は 1 行である:
//
//     start_position_mass IS NULL  ⇔  position = 不問
//
// ⇒ 区分が決まっているならマス数は必ず値を持ち、マス数が空なら区分は不問である。
//
// ★★着手前、この不変条件は POST / PUT では成り立っていた(両経路が
//   normalizePositionAndMass を呼ぶ)。★穴は PATCH 経路 1 本だけであった。
//
// ★★★本 spec が押さえるのは 2 つである。
//   (1) **保存より前に**画面上で代表値が戻ること(指示書 §0.6)——
//       サーバ側も同じ補完を行うため、画面が埋めなくても保存結果は同じになる。
//       ⇒ **単体テストも型検査も何も言わない。人が見る以外に経路が無い。**
//   (2) 運び量が 1 行も埋まらないこと(`D-731` 不変条件 2)。

const positionMode = (page: Page, mode: "band" | "mass" | "percent") =>
  page.getByTestId(`combo-editor-position-mode-${mode}`).click();

const startMass = (page: Page) =>
  page.getByTestId("combo-editor-start-position-mass");
const startPct = (page: Page) =>
  page.getByTestId("combo-editor-start-position-mass-percent");
const carryMass = (page: Page) =>
  page.getByTestId("combo-editor-carry-distance-mass");

test.describe("M37-05 始動位置のマス数の不変条件", () => {
  test("★★★マス目: 空にして離れると、保存より前に代表値が戻る", async ({
    page,
  }) => {
    await gotoNewComboFor(page, "ryu");
    await page.getByTestId("combo-editor-draft-checkbox").click();
    await addMinimalRecipeStep(page);

    // 通常入力で区分を選ぶ ⇒ 代表値 80 が入る(D-730 の従来型)。
    await page.getByTestId("combo-editor-position-mid_screen").click();
    await positionMode(page, "mass");
    await expect(startMass(page)).toHaveValue("80");

    // 空にする。★入力中は空のままであること(打ち直せること)。
    await startMass(page).fill("");
    await expect(startMass(page)).toHaveValue("");

    // 欄から離れる ⇒ ★保存していないのに代表値が戻る。
    await page.getByTestId("combo-editor-position-mode-band").focus();
    await expect(startMass(page)).toHaveValue("80");
  });

  test("★パーセンテージからも同じ結果になる(方式で挙動が割れない)", async ({
    page,
  }) => {
    await gotoNewComboFor(page, "ryu");
    await page.getByTestId("combo-editor-draft-checkbox").click();
    await addMinimalRecipeStep(page);

    await page.getByTestId("combo-editor-position-corner_self").click();
    await positionMode(page, "percent");
    await startPct(page).fill("");
    await expect(startPct(page)).toHaveValue("");

    await page.getByTestId("combo-editor-position-mode-band").focus();
    // corner_self の代表値 12 マス = 7.5%
    await expect(startPct(page)).toHaveValue("7.5");
  });

  test("★★不問なら空のままである(代表値が定義されていない)", async ({
    page,
  }) => {
    await gotoNewComboFor(page, "ryu");
    await page.getByTestId("combo-editor-draft-checkbox").click();
    await addMinimalRecipeStep(page);

    // 既定は不問。⇒ マス目へ切り替えて離れても空のまま。
    await positionMode(page, "mass");
    await startMass(page).click();
    await page.getByTestId("combo-editor-position-mode-band").focus();
    await expect(startMass(page)).toHaveValue("");

    const id = await completeNewComboSave(page, () =>
      page.getByRole("button", { name: "保存" }).click(),
    );
    await page.goto(`/combos/${id}`);
    // ★始動位置のマス数は NULL のとき要素ごと出ない(ComboDetailHeader)。
    //   ⇒ 運び量の「-」とは見せ方が違う。★要素が無いことが NULL の証拠である。
    await expect(
      page.getByTestId("combo-detail-start-position-mass"),
    ).toHaveCount(0);
  });

  // ★★★見ているのは「画面が*送信の時点で既に*代表値を載せていること」である。
  //
  // ★★保存ボタンを押すと、クリックより前に blur が発火し、画面側の
  //   fillStartPositionMassOnBlur が先に埋める。⇒ **本 spec はサーバ側の
  //   fillStartPositionMassForPatch を検証していない**(外しても緑のままである)。
  //   ★サーバ側の補完は Go 側で見ている
  //   (internal/service/combo/m37_05_position_mass_invariant_test.go)。
  //
  // ★★★だからこそ要求本文を直接見る —— 指示書 §0.6 が求めているのは
  //   「保存してから値が生えてくる見え方にしない」ことであり、その証拠は
  //   **PATCH の本文に null ではなく 102 が載っていること**そのものである。
  //   ⇒ 画面が埋めなくなれば本文が null になり、本 spec は赤くなる。
  test("★★★編集でマス数を空にして保存すると、代表値が要求本文に載る(PATCH)", async ({
    page,
  }) => {
    await gotoNewComboFor(page, "ryu");
    await page.getByTestId("combo-editor-draft-checkbox").click();
    await addMinimalRecipeStep(page);
    await page.getByTestId("combo-editor-position-mid_opponent").click(); // 代表値 102
    await positionMode(page, "mass");
    await startMass(page).fill("95"); // 区分内(91〜112)
    const id = await completeNewComboSave(page, () =>
      page.getByRole("button", { name: "保存" }).click(),
    );

    await page.goto(`/combos/${id}/edit`);
    await positionMode(page, "mass");
    await startMass(page).fill("");

    const [res] = await Promise.all([
      page.waitForResponse(
        (r) =>
          ["PATCH", "PUT"].includes(r.request().method()) &&
          new URL(r.url()).pathname === `/api/combos/${id}`,
      ),
      page.getByRole("button", { name: "保存" }).click(),
    ]);
    // ★区分は動いていないので PATCH に留まる。
    expect(res.request().method()).toBe("PATCH");

    // ★★★要求本文に 102 が載っていること。⇒ 画面が保存より前に埋めた証拠である。
    //   ★null だったら「サーバが後から埋めた」ことになり、指示書 §0.6 に反する。
    const sent = JSON.parse(res.request().postData() ?? "{}");
    expect(sent.startPositionMass).toBe(102);

    await page.goto(`/combos/${id}`);
    await expect(
      page.getByTestId("combo-detail-start-position-mass"),
    ).toContainText("102 マス");
  });

  // ★★★運び量は区分を持たない(`D-731` 不変条件 2)。⇒ 代表値という概念が無い。
  //   ★名前が似ているだけである。**埋まったら不合格**。
  test("★★★運び量は、区分が決まっていても空のまま保存される", async ({
    page,
  }) => {
    await gotoNewComboFor(page, "ryu");
    await page.getByTestId("combo-editor-draft-checkbox").click();
    await addMinimalRecipeStep(page);
    await page.getByTestId("combo-editor-position-mid_screen").click();
    await carryMass(page).click();
    await page.getByTestId("combo-editor-carry-mode-percent").focus();
    await expect(carryMass(page)).toHaveValue("");

    const id = await completeNewComboSave(page, () =>
      page.getByRole("button", { name: "保存" }).click(),
    );
    await page.goto(`/combos/${id}`);

    // 始動位置は代表値が入り、運び量は「-」のままであること。
    await expect(
      page.getByTestId("combo-detail-start-position-mass"),
    ).toContainText("80 マス");
    await expect(
      page.getByTestId("combo-detail-carry-distance-mass"),
    ).toHaveText("-");
  });
});

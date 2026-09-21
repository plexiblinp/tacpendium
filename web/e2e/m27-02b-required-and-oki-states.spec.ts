import { test, expect } from "@playwright/test";

import {
  fillRequiredComboFields,
  gotoNewComboRecipeFor,
  openRecipeTab,
  switchEditorTab,
} from "./support/editor-input";

// M27-02b: 入力仕様の 3 状態(必須・任意・未検証)の回帰固定。
//
// ★★固定するのは 3 つである。
//   (1) 本登録の必須欄(★M38-01 追補2 時点で 2 欄)が空だと保存が止まり、
//       理由が画面に届く(P4M-009 / VAL-C15)
//   (2) 仮登録では止まらない —— 仮登録は「未確定でも保存できる」入口である
//       (SUPP-001 §2.1)。**ここを塞ぐと仮登録の存在意義が消えるため、
//       「止まらないこと」を明示的に固定する**
//   (3) 起き攻めの 3 状態が保存され、読み直せる(P4M-011 / 旧マイグレ 000096)
//
// ★★(3) は E2E でなければ確かめられない —— ユニットテストは編集画面の state か
//   API のどちらか片方しか見ない。**「画面で入れた 3 状態が DB を往復して戻る」は
//   経路全体を通さないと分からない**(DTO の *bool、リポジトリの列、zod の 3 つを跨ぐ)。
//
// DB 前提: E2E 使い捨て DB。作成したコンボは各ケースで削除して残渣を残さない
//   (共有 DB のため。教訓 E-232)。

const CODE = "ryu";

/** 保存を完了させ、作成された combo id を返す。 */
async function saveAndGetId(page: import("@playwright/test").Page): Promise<number> {
  const [res] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().endsWith("/api/combos") && r.request().method() === "POST",
    ),
    page.getByRole("button", { name: "保存" }).click(),
  ]);
  expect(res.status(), `保存に失敗: ${await res.text()}`).toBe(201);
  return (await res.json()).id as number;
}

/** 本 spec が作ったコンボの後始末。 */
async function deleteCombo(page: import("@playwright/test").Page, id: number) {
  await page.request.delete(`/api/combos/${id}`);
}

test.describe("M27-02b 本登録の必須項目(P4M-009 / VAL-C15)", () => {
  test("★必須欄が空だと保存が止まり、どの欄かが画面に出る", async ({ page }) => {
    await gotoNewComboRecipeFor(page, CODE);
    await page.getByTestId("recipe-tab-normal").click();
    await page.getByRole("button", { name: "弱パンチ" }).click();
    await expect(page.locator("ol > li")).toHaveCount(1);

    // ★必須欄を埋めずに保存する。
    await page.getByRole("button", { name: "保存" }).click();

    // ★★保存が通っていないこと —— 一覧へ遷移しない(成功時は一覧へ戻る＝M24-01 §4.4)。
    await expect(page).not.toHaveURL(/\/combos\?character_id=\d+/);

    // ★理由が画面に届いていること。**「止まる」だけでは利用者は直せない。**
    //
    // ★★★M38-01 追補2: **必須は damage / knockdownAdvantage の 2 欄だけ**である。
    //   ★以下は二重に失効した記述:
    //     (1)「消費ゲージ 2 欄は既定値 0 が入っているため、空なのはダメージと有利フレーム」
    //     (2)「必須 4 欄が入れ替わり、空なのは 4 欄すべてになった」
    //   ⇒ 開始残量 2 欄は追補2 で**任意**になった(空欄＝NULL＝「不問」)。
    // ★★★`body` 全体では見ないこと —— 「コンボ開始時のドライブゲージ残量」は
    //   **欄のラベルとして常に画面に在る**。⇒ 課題一覧だけへ絞る。
    const issues = page.locator("li", { hasText: "本登録では入力が必要です" });
    await expect(issues).toHaveCount(2);
    const texts = (await issues.allInnerTexts()).join("\n");
    expect(texts).toContain("ダメージ");
    expect(texts).toContain("有利フレーム");

    // ★★★開始残量は咎められない。⇒ 必須から外れたことの実ブラウザでの証跡。
    expect(texts).not.toContain("コンボ開始時のドライブゲージ残量");
    expect(texts).not.toContain("コンボ開始時のSAゲージ残量");
  });

  test("★必須欄を埋めれば保存できる", async ({ page }) => {
    await gotoNewComboRecipeFor(page, CODE);
    await page.getByTestId("recipe-tab-normal").click();
    await page.getByRole("button", { name: "中パンチ" }).click();
    await expect(page.locator("ol > li")).toHaveCount(1);

    await fillRequiredComboFields(page);
    await openRecipeTab(page);

    const [res] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().endsWith("/api/combos") && r.request().method() === "POST",
      ),
      page.getByRole("button", { name: "保存" }).click(),
    ]);
    expect(res.status(), `保存に失敗: ${await res.text()}`).toBe(201);
    const id = (await res.json()).id as number;

    // ★消費ゲージ 2 欄の既定値 0 が実際に保存されていること(開発者指示)。
    //   ★★M38-01: 同 2 欄は必須から外れたが、**先入れの挙動は残している**
    //     (逐語の要求は必須化と独立している)。⇒ 本主張は不変である。
    const saved = await (await page.request.get(`/api/combos/${id}`)).json();
    expect(saved.damage).toBe(1500);
    expect(saved.knockdownAdvantage).toBe(30);
    expect(saved.saGaugeConsumed).toBe(0);
    expect(saved.driveGaugeConsumed).toBe(0);
    // ★★M38-01 追補2: 開始残量 2 欄は fillRequiredComboFields が**触らない**
    //   (必須ではないため)。⇒ 空のまま保存され、DB は NULL＝「不問」になる。
    expect(saved.driveAvailableAtStart ?? null).toBeNull();
    expect(saved.saAvailableAtStart ?? null).toBeNull();

    await deleteCombo(page, id);
  });

  test("★★仮登録では必須にならない(SUPP-001 §2.1 を塞がない)", async ({ page }) => {
    await gotoNewComboRecipeFor(page, CODE);
    await switchEditorTab(page, "basic");
    await page.getByTestId("combo-editor-draft-checkbox").click();
    await openRecipeTab(page);
    await page.getByTestId("recipe-tab-normal").click();
    await page.getByRole("button", { name: "強パンチ" }).click();
    await expect(page.locator("ol > li")).toHaveCount(1);

    // ★ダメージも有利フレームも空のまま保存する。
    const [res] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().endsWith("/api/combos") && r.request().method() === "POST",
      ),
      page.getByRole("button", { name: "保存" }).click(),
    ]);
    expect(res.status(), `仮登録が保存できていない: ${await res.text()}`).toBe(201);
    const id = (await res.json()).id as number;

    const saved = await (await page.request.get(`/api/combos/${id}`)).json();
    expect(saved.isDraft).toBe(true);
    expect(saved.damage ?? null).toBeNull();

    await deleteCombo(page, id);
  });

  test("★必須・任意の印は本登録のときだけ出る(P4M-010)", async ({ page }) => {
    await gotoNewComboRecipeFor(page, CODE);
    await switchEditorTab(page, "basic");

    // 本登録(既定)では印と凡例が出る。
    await expect(page.getByTestId("field-requirement-damage")).toBeVisible();
    await expect(
      page.getByTestId("combo-editor-requirement-legend"),
    ).toBeVisible();

    // ★★★M38-01 追補2: 印が出るのは **damage / knockdownAdvantage の 2 欄だけ**。
    //   ⇒ 印の正典(constants/field-requirement.ts)と画面が割れていないことの実測である。
    //   ★以下は失効した主張:「印が入れ替わった側(開始残量)に出る」。
    await expect(
      page.getByTestId("field-requirement-knockdownAdvantage"),
    ).toBeVisible();
    for (const field of [
      "driveAvailableAtStart",
      "saAvailableAtStart",
      "driveGaugeConsumed",
      "saGaugeConsumed",
    ]) {
      await expect(page.getByTestId(`field-requirement-${field}`)).toHaveCount(0);
    }

    // ★★仮登録へ切り替えると消える —— 印は「今のこの保存に要るか」を表すためである。
    await page.getByTestId("combo-editor-draft-checkbox").click();
    await expect(page.getByTestId("field-requirement-damage")).toHaveCount(0);
    await expect(
      page.getByTestId("combo-editor-requirement-legend"),
    ).toHaveCount(0);
  });

  test("★基本情報がコンボ開始時の状態であることが画面に出る(P4M-024)", async ({
    page,
  }) => {
    await gotoNewComboRecipeFor(page, CODE);
    await switchEditorTab(page, "basic");
    await expect(
      page.getByTestId("combo-editor-basic-start-state-note"),
    ).toContainText("コンボ開始時");
  });
});

test.describe("M27-02b 起き攻めを調べたかのフラグ(P4M-011 / 旧マイグレ 000096)", () => {
  // ★★本サブの中心。**「チェック 0 件 かつ 調べた」が保存でき、詳細で
  //   「まだ調べていない」と区別して読めること**を固定する。
  //   ⇒ これが成り立たないなら、フラグを足した意味が無い。
  test("★★調べたが成立するものが無い、を保存して詳細で読める", async ({ page }) => {
    await gotoNewComboRecipeFor(page, CODE);
    await page.getByTestId("recipe-tab-normal").click();
    await page.getByRole("button", { name: "弱キック" }).click();
    await expect(page.locator("ol > li")).toHaveCount(1);

    await fillRequiredComboFields(page);
    // ★チェックは 1 つも付けず、トグルだけを押す。
    await page.getByTestId("combo-editor-oki-verified").check();

    await openRecipeTab(page);
    const id = await saveAndGetId(page);

    const saved = await (await page.request.get(`/api/combos/${id}`)).json();
    expect(saved.okiVerified).toBe(true);
    expect(saved.okiOptions ?? []).toHaveLength(0);

    // ★詳細では「調べたが無かった」と読める(「まだ調べていない」ではない)。
    await page.goto(`/combos/${id}`);
    await expect(page.locator("body")).toContainText("調べましたが");

    await deleteCombo(page, id);
  });

  test("★対照: 触っていないコンボは「まだ調べていない」と出る", async ({ page }) => {
    await gotoNewComboRecipeFor(page, CODE);
    await page.getByTestId("recipe-tab-normal").click();
    await page.getByRole("button", { name: "中キック" }).click();
    await expect(page.locator("ol > li")).toHaveCount(1);

    await fillRequiredComboFields(page);
    await openRecipeTab(page);
    const id = await saveAndGetId(page);

    const saved = await (await page.request.get(`/api/combos/${id}`)).json();
    expect(saved.okiVerified).toBe(false);

    await page.goto(`/combos/${id}`);
    await expect(page.locator("body")).toContainText("まだ調べていません");

    await deleteCombo(page, id);
  });

  // ★★チェックに触れると自動で就く(開発者確定)。⇒ 明示的に押さなくてよい。
  test("★チェックに触れると「調べた」が自動で就き、保存される", async ({ page }) => {
    await gotoNewComboRecipeFor(page, CODE);
    await page.getByTestId("recipe-tab-normal").click();
    await page.getByRole("button", { name: "強キック" }).click();
    await expect(page.locator("ol > li")).toHaveCount(1);

    await fillRequiredComboFields(page);
    await page
      .getByTestId("combo-editor-oki-throw_meaty-neutral_tech-nogauge")
      .click();
    // ★トグルは押していないが、就いている。
    await expect(page.getByTestId("combo-editor-oki-verified")).toBeChecked();

    await openRecipeTab(page);
    const id = await saveAndGetId(page);

    const saved = await (await page.request.get(`/api/combos/${id}`)).json();
    expect(saved.okiVerified).toBe(true);
    // ★★M31-01(SD-006): ノーゲージ版を押すと、同じ (attackType, techType) の
    //   ドライブラッシュ版にも自動でチェックが付く(片方向・付けるときだけ)。
    //   ⇒ **1 回の操作で対の 2 件が保存される**。着手前は 1 件だった
    //     (2026-09-08 に本 spec が実測で捉えた。★本 spec の主題は
    //      「触れると『調べた』が就く」であり、そこは変わっていない)。
    //   ★連動そのものの検証は ComboEditorBasicFields.test.tsx が 3 挙動を別々に持つ。
    expect(saved.okiOptions).toHaveLength(2);
    expect(saved.okiOptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          attackType: "throw_meaty",
          techType: "neutral_tech",
          usesDr: false,
        }),
        expect.objectContaining({
          attackType: "throw_meaty",
          techType: "neutral_tech",
          usesDr: true,
        }),
      ]),
    );

    // ★★行があるときも詳細に「検証済み」が出る(2026-09-05 追補)。
    //   ★ここが不可視だった——行があれば自明に見えるが、解除ガードを通せば
    //     「行あり ＋ 未検証」は作れる。⇒ 実際に踏む経路で印が出ることを固定する。
    await page.goto(`/combos/${id}`);
    await expect(page.getByTestId("combo-detail-oki-verified")).toHaveAttribute(
      "data-state",
      "verified",
    );

    await deleteCombo(page, id);
  });

  // ★★開発者の要求そのもの——チェックが付いた状態での解除は一度止める。
  test("★★チェックが付いた状態で解除しようとすると確認を挟む", async ({ page }) => {
    await gotoNewComboRecipeFor(page, CODE);
    await switchEditorTab(page, "basic");
    await page
      .getByTestId("combo-editor-oki-throw_meaty-neutral_tech-nogauge")
      .click();
    await expect(page.getByTestId("combo-editor-oki-verified")).toBeChecked();

    // ★★`uncheck()` は使えない —— 同 API は「押した結果 state が変わること」を
    //   前提にしており、**ガードが効いている（変わらない）のが正しい**本ケースでは
    //   `Clicking the checkbox did not change its state` で落ちる。
    //   ⇒ 素の click で押し、変わらないことをこちらで確かめる。
    await page.getByTestId("combo-editor-oki-verified").click();

    // ★押しただけでは外れない。確認が出る。
    await expect(
      page.getByTestId("combo-editor-oki-verified-confirm"),
    ).toBeVisible();
    await expect(page.getByTestId("combo-editor-oki-verified")).toBeChecked();

    await page.getByTestId("combo-editor-oki-verified-confirm-ok").click();
    await expect(page.getByTestId("combo-editor-oki-verified")).not.toBeChecked();
  });

  // ★編集画面でも出る(開発者確定 2026-09-03。当初「新規のみ」だったが見直された)。
  test("★編集画面でもトグルが出て、値が復元される", async ({ page }) => {
    await gotoNewComboRecipeFor(page, CODE);
    await page.getByTestId("recipe-tab-normal").click();
    await page.getByRole("button", { name: "弱パンチ" }).click();
    await expect(page.locator("ol > li")).toHaveCount(1);
    await fillRequiredComboFields(page);
    await page.getByTestId("combo-editor-oki-verified").check();
    await openRecipeTab(page);
    const id = await saveAndGetId(page);

    await page.goto(`/combos/${id}/edit`);
    await switchEditorTab(page, "basic");
    await expect(page.getByTestId("combo-editor-oki-verified")).toBeChecked();

    await deleteCombo(page, id);
  });
});

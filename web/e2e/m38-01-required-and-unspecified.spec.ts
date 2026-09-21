import { test, expect, type Page } from "@playwright/test";

import { gotoNewComboFor } from "./support/character";
import {
  addMinimalRecipeStep,
  fillRequiredComboFields,
} from "./support/editor-input";
import { completeNewComboSave } from "./support/new-combo";

// M38-01: 新規登録・編集の必須と値域の是正(射程 5 件のうち、実サーバを通さないと
// 確かめられないもの)。
//
// ★★★本 spec の中心は 1 つである(**追補2・2026-09-18 で変わった**) ——
//
//     開始残量を**空のまま**本登録でき、DB は NULL になり、読み直すと
//     placeholder の「不問」として復元される。
//
//   ⇒ 実サーバを往復しないと「NULL が入った」ことは示せない
//     (画面上は保存前も保存後も同じ空欄に見える)。
//
// ★★★以下は失効した契約である(**元に戻さないこと**):
//   ・「開始残量 2 欄は VAL-C15 の必須であり、空のままでは保存できない」
//   ・「不問トグル(`-any`)を押して不問にする / 数値欄の Space で切り替える」
//   ⇒ 開発者裁定(2026-09-18)＝「空欄と NULL の状態がわかりにくい」。
//     UI が 3 状態・DB が 2 状態で数が合っていなかったため、**区別を諦めて畳んだ**。
//
// ★★あわせて「必須から外れた」両側を押さえる ——
//   消費ゲージ 2 欄も開始残量 2 欄も空のまま本登録でき、**damage /
//   knockdown-advantage の 2 欄だけが空だと止まる**。
//
// ★新規ファイルにしてある。既存 spec へ相乗りしない(教訓 E-225)。

const driveAvailable = (page: Page) =>
  page.getByTestId("combo-editor-drive-available");
const saAvailable = (page: Page) => page.getByTestId("combo-editor-sa-available");
const driveConsumed = (page: Page) =>
  page.getByTestId("combo-editor-drive-consumed");
const saConsumed = (page: Page) => page.getByTestId("combo-editor-sa-consumed");

/**
 * 保存できる最小状態のうち、開始残量以外を埋める。
 *
 * ★★`hitType` を必ず指定すること —— E2E は DB を 1 本共有しており(教訓 E-232)、
 *   同じキャラ・同じ最小レシピ・同じ状況で 2 件保存すると **VAL-C02(重複)**で
 *   400 になる。★`hit_type` は重複判定キーの 1 つ(`SUPP-001` §2.2)なので、
 *   保存するテストごとに別の値を選べばキーが割れる。
 *   ★本サブで新規の既定が `normal` になったため、**指定しないと全部が同じキーになる**。
 */
async function fillExceptStartGauges(
  page: Page,
  hitType: string,
): Promise<void> {
  await page.getByTestId("combo-editor-damage").fill("1500");
  await page.getByTestId("combo-editor-knockdown-advantage").fill("30");
  await page.getByTestId(`combo-editor-hit-type-${hitType}`).click();
  await addMinimalRecipeStep(page);
}

test.describe("M38-01 開始残量は任意で、空欄が「不問」である", () => {
  // ★★★本 spec の中心。**保存された値が NULL であること**は、実サーバを
  //   往復しないと示せない(画面上は保存前も保存後も同じ空欄に見える)。
  test("★★★空のまま保存できて DB は NULL になり、再編集で「不問」として復元される", async ({
    page,
  }) => {
    await gotoNewComboFor(page, "ryu");
    await fillExceptStartGauges(page, "normal");

    // ★空欄には常に placeholder「不問」が出ている。⇒ 空欄の意味が画面に在る。
    await expect(driveAvailable(page)).toHaveValue("");
    await expect(driveAvailable(page)).toHaveAttribute("placeholder", "不問");
    await expect(saAvailable(page)).toHaveAttribute("placeholder", "不問");

    const id = await completeNewComboSave(page, () =>
      page.getByRole("button", { name: "保存", exact: true }).click(),
    );

    // ★API で実値を見る。⇒ 画面ではなく保存された値そのものを確かめる。
    const res = await page.request.get(`/api/combos/${id}`);
    expect(res.ok(), `GET /api/combos/${id}: ${res.status()}`).toBeTruthy();
    const body = (await res.json()) as Record<string, unknown>;
    // ★`omitempty` なので、NULL のときはキーごと落ちる。⇒ null と undefined の両方を許す。
    expect(body.driveAvailableAtStart ?? null).toBeNull();
    expect(body.saAvailableAtStart ?? null).toBeNull();

    // ★読み直すと「不問」として復元される(指示書 §5-2)。
    await page.goto(`/combos/${id}/edit`);
    await expect(driveAvailable(page)).toHaveAttribute("placeholder", "不問");
    await expect(driveAvailable(page)).toHaveValue("");
    await expect(saAvailable(page)).toHaveAttribute("placeholder", "不問");
  });

  // ★★対照。**止まるのは damage / 有利フレームが空のときだけ**である。
  //   ★以下は失効した主張(**元に戻さないこと**):「開始残量が空のままでは保存できず、
  //     VAL-C15 が出る」。⇒ 追補2 で同 2 欄は必須から外れた。
  //   ⇒ 本ケースが無いと「空のまま保存できた」は「門が全部壊れた」と区別できない。
  test("★★★必須 2 欄が空だと保存が止まり、開始残量は咎められない", async ({
    page,
  }) => {
    await gotoNewComboFor(page, "ryu");
    // ★damage / 有利フレームを埋めずにレシピだけ用意する。
    await addMinimalRecipeStep(page);

    let posted = false;
    page.on("request", (r) => {
      if (r.method() === "POST" && new URL(r.url()).pathname === "/api/combos") {
        posted = true;
      }
    });
    await page.getByRole("button", { name: "保存", exact: true }).click();

    // ★画面に必須の課題が出て、**POST が飛んでいない**。
    //   ★★★`body` 全体では見ないこと —— 「コンボ開始時のドライブゲージ残量」は
    //     **欄のラベルとして常に画面に在る**。⇒ 課題一覧だけへ絞る必要がある。
    //   ★文言は zod の `requiredMessage`。⇒ 保存経路は zod だけに戻っている。
    const issues = page.locator("li", { hasText: "本登録では入力が必要です" });
    await expect(issues).toHaveCount(2);
    const texts = (await issues.allInnerTexts()).join("\n");
    expect(texts).toContain("ダメージ");
    expect(texts).toContain("有利フレーム");
    expect(posted, "★保存が止まっていない(POST が飛んだ)").toBe(false);

    // ★★★開始残量は 1 度も咎められない。⇒ 必須から外れたことの直接の証跡である。
    expect(texts).not.toContain("コンボ開始時のドライブゲージ残量");
    expect(texts).not.toContain("コンボ開始時のSAゲージ残量");
    await expect(page).not.toHaveURL(/\/combos\?character_id=\d+/);
  });

  test("数値を入れれば保存でき、その値が入る", async ({ page }) => {
    await gotoNewComboFor(page, "ryu");
    await fillExceptStartGauges(page, "counter");
    await driveAvailable(page).fill("3");
    await saAvailable(page).fill("1");

    const id = await completeNewComboSave(page, () =>
      page.getByRole("button", { name: "保存", exact: true }).click(),
    );
    const body = (await (await page.request.get(`/api/combos/${id}`)).json()) as
      Record<string, unknown>;
    expect(body.driveAvailableAtStart).toBe(3);
    expect(body.saAvailableAtStart).toBe(1);
  });

  // ★★★**マウスに持ち替えずに本登録まで通せること。**
  //
  // ★開発者の逐語＝「キーボードからマウスに持ち変えずに入力できる、という良さが、
  //   トグルボタンで切り替える作りだと消えてしまう」。
  // ★★追補1 はトグルを数値欄と同じ停止点へ戻し、切り替えを数値欄の中の Space にした。
  //   **追補2 でトグルも Space も消えた** —— 開始残量を空のまま通すだけでよくなり、
  //   打鍵は 1 つも要らない。⇒ 指摘された劣化は根元から無くなった。
  //
  // ★★★本テストは `page.keyboard` しか使わない。**1 度もクリックしない。**
  //   ⇒ 「マウスに持ち替えない」を実ブラウザで固定する。単体テストでは示せない。
  test("★★★マウスを 1 度も使わず、キーボードだけで本登録できる", async ({
    page,
  }) => {
    await gotoNewComboFor(page, "ryu");
    // レシピだけは別タブなので先に用意する(本テストの主題ではない)。
    await addMinimalRecipeStep(page);

    // ★ここから先はキーボードだけ。起点の 1 回だけ focus() する
    //   (利用者が最初の欄をクリックする、に相当)。
    await page.getByTestId("combo-editor-damage").focus();
    await page.keyboard.type("1500");

    // ↓ で有利フレームへ。
    await page.keyboard.press("ArrowDown");
    await expect(
      page.getByTestId("combo-editor-knockdown-advantage"),
    ).toBeFocused();
    await page.keyboard.type("30");

    // ↓ で開始ドライブへ。★空のまま通り過ぎる(＝「不問」で保存される)。
    await page.keyboard.press("ArrowDown");
    await expect(page.getByTestId("combo-editor-drive-available")).toBeFocused();
    await expect(page.getByTestId("combo-editor-drive-available")).toHaveAttribute(
      "placeholder",
      "不問",
    );
    // ★★Space を押しても何も起きない(トグルが消えたため)。フォーカスも動かない。
    await page.keyboard.press("Space");
    await expect(page.getByTestId("combo-editor-drive-available")).toHaveValue("");
    await expect(page.getByTestId("combo-editor-drive-available")).toBeFocused();

    // ↓ で開始SAへ。★ここも空のまま通り過ぎる。
    await page.keyboard.press("ArrowDown");
    await expect(page.getByTestId("combo-editor-sa-available")).toBeFocused();

    // ★重複判定キーを他のケースと割る(E2E は DB を 1 本共有する＝教訓 E-232)。
    //   ★数字キーは**その群にフォーカスがある間だけ**効くので、群へ入ってから押す。
    //   ★4 番目 = パニッシュカウンター(ジャストパリィ反撃)。他のケースと重ならない値を選ぶ。
    await page.getByTestId("combo-editor-hit-type-normal").focus();
    await page.keyboard.press("4");
    await expect(
      page.getByTestId("combo-editor-hit-type-just_parry_punish_counter"),
    ).toBeChecked();

    const id = await completeNewComboSave(page, () =>
      page.getByRole("button", { name: "保存", exact: true }).click(),
    );
    const body = (await (await page.request.get(`/api/combos/${id}`)).json()) as
      Record<string, unknown>;
    expect(body.driveAvailableAtStart ?? null).toBeNull();
    expect(body.saAvailableAtStart ?? null).toBeNull();
    expect(body.damage).toBe(1500);
    expect(body.knockdownAdvantage).toBe(30);
    expect(body.hitType).toBe("just_parry_punish_counter");
  });

  // ★★★不問トグルが**消えている**ことの破壊確認。⇒ 残っていると 3 状態へ戻る。
  test("★★★不問トグルは画面に存在しない", async ({ page }) => {
    await gotoNewComboFor(page, "ryu");
    await expect(
      page.getByTestId("combo-editor-drive-available-any"),
    ).toHaveCount(0);
    await expect(page.getByTestId("combo-editor-sa-available-any")).toHaveCount(0);
    // ★順送りは開始ドライブ → 開始SA と、数値欄だけを踏む(+2 停止が無い)。
    await page.getByTestId("combo-editor-drive-available").focus();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByTestId("combo-editor-sa-available")).toBeFocused();
  });

  // ★値を入れれば placeholder が消え、消せば戻る。⇒ 空欄の意味が常に画面に在る。
  test("★値を入れると placeholder が消え、空へ戻すと「不問」が戻る", async ({
    page,
  }) => {
    await gotoNewComboFor(page, "ryu");
    await expect(driveAvailable(page)).toHaveAttribute("placeholder", "不問");
    await driveAvailable(page).fill("2");
    await expect(driveAvailable(page)).toHaveValue("2");
    await expect(driveAvailable(page)).not.toHaveAttribute("placeholder", "不問");
    await driveAvailable(page).fill("");
    await expect(driveAvailable(page)).toHaveAttribute("placeholder", "不問");
  });

  // ★★★開始残量の**値域の担保は生きている**。⇒ 必須を外すのと値域を外すのは別である。
  test("★★★開始残量の UI クランプが生きている", async ({ page }) => {
    await gotoNewComboFor(page, "ryu");
    await driveAvailable(page).fill("99"); // 上限 6
    await expect(driveAvailable(page)).toHaveValue("6");
    await saAvailable(page).fill("9"); // 上限 3
    await expect(saAvailable(page)).toHaveValue("3");
  });
});

test.describe("M38-01 VAL-C15 から外れた欄", () => {
  // ★★外した 2 欄(消費ゲージ)は空のまま本登録できる。
  test("★★消費ゲージ 2 欄は空のままでも本登録できる", async ({ page }) => {
    await gotoNewComboFor(page, "ryu");
    await fillRequiredComboFields(page);
    // ★重複判定キーを他のケースと割る(上の fillExceptStartGauges の注記)。
    await page.getByTestId("combo-editor-hit-type-punish_counter").click();
    await addMinimalRecipeStep(page);

    // ★既定で "0" が入っているので、明示的に空へ戻してから保存する。
    await driveConsumed(page).fill("");
    await saConsumed(page).fill("");

    const id = await completeNewComboSave(page, () =>
      page.getByRole("button", { name: "保存", exact: true }).click(),
    );
    const body = (await (await page.request.get(`/api/combos/${id}`)).json()) as
      Record<string, unknown>;
    expect(body.driveGaugeConsumed ?? null).toBeNull();
    expect(body.saGaugeConsumed ?? null).toBeNull();
  });

  // ★★★外した 2 欄の**値域の担保は生きている**(指示書 §5-5 / チェックリスト B-2)。
  //   ⇒ 同 2 欄は BE にも zod にも範囲 ERROR が無く(DES-006 §2.5「範囲 VAL 非連動」)、
  //     担保は UI クランプだけである。**必須を外すのと値域を外すのは別である。**
  test("★★★外した 2 欄の UI クランプが生きている", async ({ page }) => {
    await gotoNewComboFor(page, "ryu");
    await driveConsumed(page).fill("25"); // 上限 20
    await expect(driveConsumed(page)).toHaveValue("20");
    await saConsumed(page).fill("9"); // 上限 6
    await expect(saConsumed(page)).toHaveValue("6");
  });
});

test.describe("M38-01 ヒット種別と矢印キー", () => {
  test("★★選択肢に「不問」が無く、既定が「通常」である", async ({ page }) => {
    await gotoNewComboFor(page, "ryu");
    await expect(
      page.getByTestId("combo-editor-hit-type-unspecified"),
    ).toHaveCount(0);
    await expect(page.getByTestId("combo-editor-hit-type-normal")).toBeChecked();
  });

  // ★★矢印キーは実ブラウザでしか確かめられない —— jsdom は number の
  //   ネイティブな増減を実装しないため、単体テストでは「値が変わらないこと」を
  //   主張できない(preventDefault が呼ばれたことしか見られない)。
  test("★★★数値欄で ↑↓ しても値が変わらず、フォーカスが動く", async ({ page }) => {
    await gotoNewComboFor(page, "ryu");
    // ★★対象は「有利フレーム」にする —— ダメージは並び替え後に**先頭の停止点**であり、
    //   ↑ の戻り先が無い。⇒ 先頭で試すと「奪っていない」のか「戻り先が無い」のかを
    //   区別できない(実際、ダメージで書いて 1 度そう取り違えた)。
    const kd = page.getByTestId("combo-editor-knockdown-advantage");
    const damage = page.getByTestId("combo-editor-damage");
    await kd.fill("30");
    await kd.focus();

    // ★↑ で前の欄(ダメージ)へ。値は変わらない。
    await page.keyboard.press("ArrowUp");
    await expect(kd).toHaveValue("30");
    await expect(damage).toBeFocused();

    // ★↓ で戻る。⇒ 片方向だけ塞いでいないこと。
    await page.keyboard.press("ArrowDown");
    await expect(kd).toHaveValue("30");
    await expect(kd).toBeFocused();
  });

  // ★★スピナーは M24-12 で既に全撤去済みである。⇒ 本サブで消す作業は無かった。
  //   ★「押せるのに効かないボタン」が生じていないことを 1 本で固定しておく。
  test("★数値欄にスピナーが描かれていない", async ({ page }) => {
    await gotoNewComboFor(page, "ryu");
    const appearance = await page
      .getByTestId("combo-editor-damage")
      .evaluate((el) => getComputedStyle(el).appearance);
    expect(appearance).toBe("textfield");
  });
});

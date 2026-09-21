import { test, expect, type Page } from "@playwright/test";

import {
  fillRequiredComboFields,
  gotoNewComboRecipeFor,
  openRecipeTab,
} from "./support/editor-input";

// M23-05: 削除済み行と再登録の衝突(落とさずに知らせる)。
//
// ★本 spec が守るのは「衝突が起きたことが画面へ届くこと」と「届いても登録・復元が
// 止まらないこと」の 2 つである。片方だけでは足りない——警告のために登録を落とせば、
// 利用者は作るすべを失う(指示書 §4.1-1)。
//
// ★★シナリオは指示書 §5.4 のとおり:
//   本登録のコンボを作る → 削除 → 同じものを新規登録 → VAL-C14 が画面に出る
//   → 削除したほうを復元 → VAL-R03 が画面に出る。
//
// 方式:
//   - 登録 = UI(/combos/new)。★警告の表示はここでしか見られない。
//     ★★API で作らないこと——判定キー 7 項(M37-07 で 6 → 7)が UI の作る値と 1 つでも違うと、
//     衝突が成立せず「警告が出ない」ように見える(spec が黙って無意味になる)。
//   - 削除 = API(UI の削除ダイアログは本サブの対象ではない)。
//   - 復元 = UI(/trash の「復元」ボタン)。
//
// ★★2026-08-23 追随(M23-09)——登録側の衝突が出る場所がトーストから「保存前ダイアログ」へ
// 移った。⇒ 2 回目の登録では保存を押すとダイアログが開き、そこで「新しく作る」を選んでから
// POST が飛ぶ。あわせて、ダイアログで告げた重複は保存後トーストで二重に告げない
// (M23-09 §4.5・チェックリスト N-5)。
// ★★これを「警告が消えた」と読んで直さないこと。意図である。
// ★本 spec の主張(登録が落ちない / 復元が落ちない / VAL-R03 が出る)は 1 つも落としていない。
//
// 前提: E2E 使い捨て DB。バックエンド + Vite dev が起動。ウィザード完了済み。
// ★件数を絶対値で数えない。作成した id の在・不在だけを見る。
// ★afterEach で作成行を全部落とす(m23-01 / m23-02 / m23-04 の慣行に揃える)。

const TRASH_CHARACTER_ID = 1; // ゴミ箱画面の既定キャラ(useResolvedCharacterId の解決値。E2E 環境では 1)

const createdComboIDs: number[] = [];

async function ryuCharacterId(page: Page): Promise<number> {
  const res = await page.request.get("/api/games/1/characters");
  expect(res.ok()).toBeTruthy();
  const chars = (await res.json()).items as Array<{ id: number; code: string }>;
  const ryu = chars.find((c) => c.code === "ryu");
  if (!ryu) throw new Error("seed に ryu が見つからない(配布クリーン状態の前提崩れ)");
  return ryu.id;
}

/**
 * createPublishedComboViaUI は /combos/new から本登録のコンボを 1 件作る。
 *
 * ★仮登録ではなく本登録で作る。VAL-C14 / VAL-R03 は仮登録を判定しない
 * (「仮登録と本登録の間では重複判定は行わない」＝DES-006 §2.3)。
 * ⇒ m23-04 spec の createCombo(isDraft: true)をそのまま流用すると、判定が
 *   1 度も走らないまま緑になる。
 *
 * ★レシピを 1 ステップ入れる。本登録は空レシピを許さない(VAL-C09)。
 * 入力方式は m15-03 spec と同じ「通常技タブ + 弱パンチ」である。
 */
async function createPublishedComboViaUI(
  page: Page,
  opts: { expectTrashDialog?: boolean } = {},
): Promise<number> {
  await gotoNewComboRecipeFor(page, "ryu");

  await page.getByTestId("recipe-tab-normal").click();
  await page.getByRole("button", { name: "弱パンチ" }).click();
  await expect(page.locator("ol > li")).toHaveCount(1);

  // ★M27-02b(VAL-C15): 本登録の必須欄を埋める。埋めないと保存が通らず、
  //   本 spec が見たい重複判定まで到達しない。
  await fillRequiredComboFields(page);
  await openRecipeTab(page);

  // ★M23-09: ゴミ箱に同じものがあると、保存を押した時点でダイアログが開く。
  //   POST はそこで「新しく作る」を押してから飛ぶ。⇒ 先に待ちを張ると外れる。
  if (opts.expectTrashDialog) {
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByTestId("pre-save-duplicate-dialog")).toBeVisible();
    const [created] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().endsWith("/api/combos") && r.request().method() === "POST",
      ),
      page.getByTestId("pre-save-duplicate-create-new").click(),
    ]);
    expect(created.status(), `コンボ作成失敗: ${await created.text()}`).toBe(201);
    const createdID = (await created.json()).id as number;
    createdComboIDs.push(createdID);
    return createdID;
  }

  // ★id は応答から取る。保存後に遷移するとは限らない(検証警告があると確認ダイアログが
  //   開いてページに留まる)ため、URL から取ると経路によって落ちる。
  const [res] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().endsWith("/api/combos") && r.request().method() === "POST",
    ),
    page.getByRole("button", { name: "保存" }).click(),
  ]);
  expect(res.status(), `コンボ作成失敗: ${await res.text()}`).toBe(201);

  const id = (await res.json()).id as number;
  createdComboIDs.push(id);
  return id;
}

async function comboIsAlive(page: Page, comboID: number): Promise<boolean> {
  const res = await page.request.get(`/api/combos/${comboID}`);
  return res.ok();
}

test.afterEach(async ({ request }) => {
  for (const id of [...createdComboIDs].reverse()) {
    await request.delete(`/api/combos/${id}`).catch(() => undefined);
  }
  for (const id of createdComboIDs) {
    await request.delete(`/api/combos/${id}/permanent`).catch(() => undefined);
  }
  createdComboIDs.length = 0;
});

test.describe("M23-05 削除済み行と再登録の衝突: 落とさずに知らせる", () => {
  // ★本サブの価値をそのまま表す spec(指示書 §5.4)。
  test("削除 → 同じものを新規登録 → VAL-C14 → 削除したほうを復元 → VAL-R03", async ({
    page,
  }) => {
    const characterId = await ryuCharacterId(page);
    expect(characterId, "ゴミ箱画面の既定キャラは解決値(E2E 環境では 1)").toBe(TRASH_CHARACTER_ID);

    // ── 本登録のコンボ A を作り、ゴミ箱へ入れる ─────────────────────────
    const trashedID = await createPublishedComboViaUI(page);
    expect((await page.request.delete(`/api/combos/${trashedID}`)).status()).toBe(204);

    // ── 同じものを新規登録する ───────────────────────────────────────────
    // ★VAL-C02 は削除済み行を候補に入れないため、これは通る(M23-RESEARCH-01 H-2)。
    //   通ること自体は仕様であり、欠陥ではない——外すと PUT が壊れる(DES-006 §2.3)。
    // ★★M23-09 以降、ここで保存前ダイアログが開く。ヘルパの中で
    //   「ゴミ箱に同じものがあります」を確認したうえで「新しく作る」を押している。
    const newID = await createPublishedComboViaUI(page, { expectTrashDialog: true });

    // ── ★衝突が画面に届いている ──────────────────────────────────────────
    // ★★届く場所が「保存後のトースト」から「保存前のダイアログ」へ移った(M23-09)。
    //   ⇒ ダイアログで告げたことを保存後にもう一度告げない(§4.5)。
    //   ★これは意図であり、警告が消えたのではない。ダイアログの表示は上で確認済みである。
    await expect(
      page.getByText(/同じ内容のコンボ .* 件がゴミ箱にもあります/),
      "★ダイアログで告げた重複を、保存後トーストでも二重に告げている(M23-09 §4.5)",
    ).toHaveCount(0);

    // ★最重要ゲート: 警告が付いても登録は成功している(§4.1-1)。
    expect(
      await comboIsAlive(page, newID),
      "★警告が付いたせいで登録が落ちている",
    ).toBeTruthy();

    // ── ゴミ箱から A を復元する ──────────────────────────────────────────
    await page.goto("/trash");
    await expect(page.getByRole("heading", { name: "ゴミ箱" })).toBeVisible();
    const row = page.locator(`tr:has(a[href="/trash/combos/${trashedID}"])`);
    await expect(row, "ゴミ箱のコンボ表に行が出ていない").toHaveCount(1);

    await row.getByRole("button", { name: "復元" }).click();

    // ── ★VAL-R03 が画面に出る ────────────────────────────────────────────
    await expect(
      page.getByText(/同じ内容のコンボ .* 件が既に登録されています/),
      "★復元したことで重複が並んだことが画面へ届いていない",
    ).toBeVisible();
    await expect(page.getByRole("alertdialog"), "警告をモーダルで出している").toHaveCount(0);

    // ★警告が付いても復元は成功している(§4.1-1 / D-463)。
    await expect(row, "復元後もゴミ箱に残っている(復元が中止された)").toHaveCount(0);
    expect(
      await comboIsAlive(page, trashedID),
      "★警告が付いたせいで復元が落ちている",
    ).toBeTruthy();
  });

  // ★誤検知の側も 1 本で見る。出ることだけを確認すると「常に出る」状態と区別できず、
  //   無視される警告になる(指示書 §5 前文)。
  test("ゴミ箱に同じものが無ければ、登録でも復元でも警告が出ない", async ({ page }) => {
    const comboID = await createPublishedComboViaUI(page);

    // ★登録の時点でゴミ箱は空である。VAL-C14 が出てはならない。
    //
    // ★★否定のアサーションの前に「正の待機」を挟む(レビュー 低-3)。応答を待った直後に
    //   toHaveCount(0) を評価すると、**警告が出る実装であってもトーストの描画前に 0 件で
    //   通ってしまう**——誤検知を捕まえるための対照が、何も検査していない状態になる。
    //   ここでは「保存が画面へ反映しきった」ことを遷移で待つ。
    // ★M24-01 §4.4: 新規登録の遷移先が詳細から一覧へ変わった。待ちの目的は変わらない。
    //   ★キャラ ID までは主張できる(本 spec のコンボはすべてリュウ＝TRASH_CHARACTER_ID)。
    await expect(page).toHaveURL(
      new RegExp(`/combos\\?character_id=${TRASH_CHARACTER_ID}$`),
    );
    await expect(page.getByText(/ゴミ箱にもあります/)).toHaveCount(0);

    // 削除 → そのまま復元。生きた重複は 1 件も無い。
    expect((await page.request.delete(`/api/combos/${comboID}`)).status()).toBe(204);

    await page.goto("/trash");
    const row = page.locator(`tr:has(a[href="/trash/combos/${comboID}"])`);
    await expect(row).toHaveCount(1);
    await row.getByRole("button", { name: "復元" }).click();
    await expect(row).toHaveCount(0);

    // ★★復元対象自身を数えていると、ここで必ず警告が出る(§4.3)。
    await expect(
      page.getByText(/既に登録されています/),
      "★重複相手が居ないのに VAL-R03 が出た(復元対象自身を数えている)",
    ).toHaveCount(0);
    expect(await comboIsAlive(page, comboID)).toBeTruthy();
  });
});

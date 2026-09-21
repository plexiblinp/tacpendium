import { test, expect, type Page } from "@playwright/test";
import { minimalDraftSteps } from "./support/draft-combo";

// M23-07: ゴミ箱の未達の導線(入口と出口をつなぐ)。
//
// ★★本 spec の要は「画面操作だけで通すこと」である。
//   M23-02 以来、セットプレイをゴミ箱へ入れる導線は画面に 1 つも無く、既存 spec は
//   すべて API で状態を作っていた。⇒ 「入れる導線が無い」という欠落を E2E は
//   1 件も検出できなかった。本 spec が最初に通す経路である。
//
// 方式:
//   - fixture 作成・紐付け = API(UI の登録フローは本サブの関心外であり、長い)。
//   - ★削除・復元・完全削除・紐付け解除 = UI。ここが本サブの成果物そのものである。
//   - 判定 = UI(画面に出ているか)＋ API(サーバ側の状態)。
//
// 前提: E2E 使い捨て DB。バックエンド + Vite dev が起動。
// ★件数を絶対値で数えない。作成した id の在・不在だけを見る。
// ★afterEach で作成行を全部落とす(既存 m23-0x の慣行に揃える)。

const TRASH_CHARACTER_ID = 1; // ゴミ箱画面の既定キャラ(useResolvedCharacterId の解決値。E2E 環境では 1)

const createdComboIDs: number[] = [];
const createdSetupIDs: number[] = [];

async function ryuCharacterId(page: Page): Promise<number> {
  const res = await page.request.get("/api/games/1/characters");
  expect(res.ok()).toBeTruthy();
  const chars = (await res.json()).items as Array<{ id: number; code: string }>;
  const ryu = chars.find((c) => c.code === "ryu");
  if (!ryu) throw new Error("seed に ryu が見つからない(配布クリーン状態の前提崩れ)");
  return ryu.id;
}

async function firstMoveID(page: Page, characterId: number): Promise<number> {
  const res = await page.request.get(`/api/moves?character_id=${characterId}`);
  expect(res.ok()).toBeTruthy();
  const moves = (await res.json()).items as Array<{ id: number; code: string }>;
  const move = moves.find((m) => m.code === "standing_light_punch") ?? moves[0];
  if (!move) throw new Error("seed に技が見つからない(配布クリーン状態の前提崩れ)");
  return move.id;
}

async function createCombo(page: Page, characterId: number, memo: string): Promise<number> {
  const res = await page.request.post("/api/combos", {
    // ★M24-13: 仮登録でもレシピのステップ 1 本以上が要る(VAL-C09)。
    data: {
      characterId,
      isDraft: true,
      position: "mid_screen",
      memo,
      steps: minimalDraftSteps(),
    },
  });
  expect(res.ok(), `コンボ作成失敗: ${res.status()} ${await res.text()}`).toBeTruthy();
  const id = (await res.json()).id as number;
  createdComboIDs.push(id);
  return id;
}

async function createComboWithStep(
  page: Page,
  characterId: number,
  moveID: number,
  memo: string,
): Promise<number> {
  const res = await page.request.post("/api/combos", {
    data: {
      characterId,
      isDraft: true,
      position: "mid_screen",
      memo,
      starterMoveId: moveID,
      steps: [{ stepOrder: 1, moveId: moveID }],
    },
  });
  expect(res.ok(), `コンボ作成失敗: ${res.status()} ${await res.text()}`).toBeTruthy();
  const id = (await res.json()).id as number;
  createdComboIDs.push(id);
  return id;
}

async function createSetup(
  page: Page,
  comboID: number,
  characterId: number,
  moveID: number,
  name: string,
): Promise<number> {
  const res = await page.request.post(`/api/combos/${comboID}/setups`, {
    data: { characterId, name, steps: [{ moveId: moveID }] },
  });
  expect(res.ok(), `セットプレイ作成失敗: ${res.status()} ${await res.text()}`).toBeTruthy();
  const id = (await res.json()).id as number;
  createdSetupIDs.push(id);
  return id;
}

async function trashSetupIDs(page: Page): Promise<number[]> {
  const res = await page.request.get(
    `/api/setups?characterId=${TRASH_CHARACTER_ID}&onlyDeleted=true`,
  );
  expect(res.ok(), `ゴミ箱一覧取得失敗: ${res.status()}`).toBeTruthy();
  return ((await res.json()).items as Array<{ id: number }>).map((s) => s.id);
}

async function setupIDsOfCombo(page: Page, comboID: number): Promise<number[]> {
  const res = await page.request.get(`/api/combos/${comboID}`);
  expect(res.ok(), `コンボ詳細取得失敗: ${res.status()}`).toBeTruthy();
  return (((await res.json()).setups ?? []) as Array<{ id: number }>).map((s) => s.id);
}

test.afterEach(async ({ request }) => {
  for (const id of [...createdComboIDs].reverse()) {
    await request.delete(`/api/combos/${id}`).catch(() => undefined);
  }
  for (const id of [...createdSetupIDs].reverse()) {
    await request.delete(`/api/setups/${id}`).catch(() => undefined);
    await request.delete(`/api/setups/${id}/permanent`).catch(() => undefined);
  }
  for (const id of createdComboIDs) {
    await request.delete(`/api/combos/${id}/permanent`).catch(() => undefined);
  }
  createdComboIDs.length = 0;
  createdSetupIDs.length = 0;
});

test.describe("M23-07 ゴミ箱の未達の導線", () => {
  // ★★本サブの主目的。M23-02 以来、画面操作だけでは 1 度も通せなかった経路である。
  test("画面操作だけで セットプレイを削除 → ゴミ箱に出る → 復元", async ({ page }) => {
    const characterId = await ryuCharacterId(page);
    expect(characterId, "ゴミ箱画面の既定キャラは解決値(E2E 環境では 1)").toBe(TRASH_CHARACTER_ID);
    const moveID = await firstMoveID(page, characterId);
    const stamp = Date.now();
    const setupName = `e2e-m2307-setup-${stamp}`;

    const comboID = await createCombo(page, characterId, `e2e-m2307-combo-${stamp}`);
    const setupID = await createSetup(page, comboID, characterId, moveID, setupName);

    expect(await setupIDsOfCombo(page, comboID), "前提: コンボから見える").toContain(setupID);

    // ── UI: コンボ詳細のセットプレイカードから削除する ────────────────────
    await page.goto(`/combos/${comboID}`);
    const card = page.locator("div").filter({ hasText: setupName });
    await expect(card.first()).toBeVisible();

    // ★確認を挟む(§4.1-2)。押しただけでは消えない。
    await page.getByTestId("setup-soft-delete").click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    // ★参照しているコンボの件数が出る。
    await expect(dialog).toContainText("1 件のコンボ");
    await dialog.getByRole("button", { name: "ゴミ箱へ移動" }).click();

    // ★★これがサーバ側に届いていること。UI だけ変わって API が別物、を防ぐ。
    await expect
      .poll(async () => await trashSetupIDs(page), {
        message: "画面から削除したのにゴミ箱へ入っていない",
      })
      .toContain(setupID);
    expect(
      await setupIDsOfCombo(page, comboID),
      "★コンボまで消えている/紐付けが壊れている",
    ).not.toContain(setupID);

    // ★§4.1-3: トーストからゴミ箱へ行ける。
    await page.getByRole("button", { name: "ゴミ箱を開く" }).click();
    await expect(page).toHaveURL(/\/trash$/);

    // ── UI: ゴミ箱から復元する ──────────────────────────────────────────
    const trashRow = page.locator(`tr:has-text("${setupName}")`);
    await expect(trashRow, "ゴミ箱のセットプレイ表に行が出ていない").toHaveCount(1);
    await trashRow.getByRole("button", { name: "復元" }).click();

    await expect
      .poll(async () => await setupIDsOfCombo(page, comboID), {
        message: "復元したのにコンボから見えない",
      })
      .toContain(setupID);
  });

  // ★§4.2: 行クリック → 読み取り専用詳細。従来は 404 に落ちていた。
  test("ゴミ箱のコンボ行をクリック → 読み取り専用詳細 → 復元", async ({ page }) => {
    const characterId = await ryuCharacterId(page);
    const moveID = await firstMoveID(page, characterId);
    const stamp = Date.now();
    const comboID = await createComboWithStep(page, characterId, moveID, `e2e-m2307-detail-${stamp}`);

    expect((await page.request.delete(`/api/combos/${comboID}`)).status()).toBe(204);

    await page.goto("/trash");
    const row = page.locator(`tr:has(a[href="/trash/combos/${comboID}"])`);
    await expect(row, "ゴミ箱のコンボ表に行が出ていない").toHaveCount(1);

    await row.locator("a").first().click();

    // ★404 に落ちない。読み取り専用であることが URL からも分かる。
    await expect(page).toHaveURL(new RegExp(`/trash/combos/${comboID}$`));
    await expect(page.getByRole("note")).toBeVisible();

    // ★§4.2-3: 編集・削除の操作は出ない。押せないボタンも並べない。
    await expect(page.locator(`a[href="/combos/${comboID}/edit"]`)).toHaveCount(0);
    await expect(page.locator(`a[href*="copyFrom=${comboID}"]`)).toHaveCount(0);

    // ★§4.2-4: レシピが出る(削除済み行の recipe_cache は NULL だが combo_steps は残る)。
    await expect(
      page.getByText("レシピ", { exact: false }).first(),
      "読み取り専用詳細にレシピ欄が無い",
    ).toBeVisible();

    // ★出すもの: 復元 / 完全削除 / ゴミ箱へ戻る。
    await page.getByRole("button", { name: "復元" }).click();
    await expect(page).toHaveURL(/\/trash$/);

    const restored = await page.request.get(`/api/combos/${comboID}`);
    expect(restored.status(), "復元したのに通常の詳細から引けない").toBe(200);
  });

  // ★§4.3: 完全削除を拒まれたときの逃げ道。従来は拒否された時点で詰んでいた。
  test("参照中セットプレイの完全削除 → 拒否 → 紐付けを解除 → 完全削除が通る", async ({ page }) => {
    const characterId = await ryuCharacterId(page);
    const moveID = await firstMoveID(page, characterId);
    const stamp = Date.now();
    const setupName = `e2e-m2307-inuse-${stamp}`;
    const comboMemo = `e2e-m2307-holder-${stamp}`;

    const comboID = await createCombo(page, characterId, comboMemo);
    const setupID = await createSetup(page, comboID, characterId, moveID, setupName);

    // セットプレイだけをゴミ箱へ入れる(コンボは生きたまま)。
    expect((await page.request.delete(`/api/setups/${setupID}`)).status()).toBe(204);

    await page.goto("/trash");
    const row = page.locator(`tr:has-text("${setupName}")`);
    await expect(row).toHaveCount(1);

    // ── 完全削除 → 拒否される ───────────────────────────────────────────
    await row.getByRole("button", { name: "完全削除" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "完全削除" }).click();

    await expect(page.getByRole("alert")).toBeVisible();
    // ★★どのコンボが参照しているのかが見える(§4.3-1。D-485 の上書き)。
    const inUsePanel = page.getByTestId("setup-in-use-combos");
    await expect(inUsePanel, "参照元コンボが画面に出ていない(拒否されたら詰む)").toBeVisible();
    await expect(inUsePanel).toContainText(comboMemo);
    // ★§4.3-2: 「コンボを消す」ではないことが文言で伝わる。
    await expect(inUsePanel).toContainText("コンボそのものは削除されません");

    expect(await trashSetupIDs(page), "拒否されたのに消えている").toContain(setupID);

    // ── 紐付けを解除する ────────────────────────────────────────────────
    await inUsePanel.getByRole("button", { name: "紐付けを外す" }).click();

    // ★§4.3-3: 解除しても完全削除は自動で再実行されない。もう一度押させる。
    await expect(page.getByRole("status").filter({ hasText: "もう一度" })).toBeVisible();
    expect(
      await trashSetupIDs(page),
      "★紐付け解除で完全削除が自動再実行されている(§4.3-3 違反)",
    ).toContain(setupID);

    // コンボそのものは消えていない。
    const holder = await page.request.get(`/api/combos/${comboID}`);
    expect(holder.status(), "★紐付け解除でコンボまで消えている").toBe(200);

    // ── もう一度押すと通る ──────────────────────────────────────────────
    await row.getByRole("button", { name: "完全削除" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "完全削除" }).click();

    await expect
      .poll(async () => await trashSetupIDs(page), {
        message: "紐付けを外したのに完全削除が通らない",
      })
      .not.toContain(setupID);
  });
});

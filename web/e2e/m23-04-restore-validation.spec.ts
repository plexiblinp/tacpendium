import { test, expect, type Page } from "@playwright/test";
import { minimalDraftSteps } from "./support/draft-combo";

// M23-04: 復元時のバリデーション(落とさずに戻して警告する)。
//
// ★本 spec が守るのは「復元が止まらないこと」と「戻りきっていないことが画面へ届くこと」
// の 2 つである。片方だけでは足りない——警告を出すために復元を落としてしまえば、
// ゴミ箱が安全網でなくなる(D-463 / 指示書 §4.1)。
//
// 方式:
//   - fixture 作成・紐付け・削除 = API(UI にセットプレイ作成の安定セレクタが無い)。
//   - 復元 = UI(/trash の「復元」ボタン)。警告の表示はここでしか見られない。
//   - 判定 = UI(トースト)と API(復元応答の warnings / コンボが生きていること)の両方。
//
// 前提: E2E 使い捨て DB。バックエンド + Vite dev が起動。
// ★件数を絶対値で数えない。作成した id の在・不在だけを見る。
// ★afterEach で作成行を全部落とす(m23-01 / m23-02 の慣行に揃える)。

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

async function comboIsAlive(page: Page, comboID: number): Promise<boolean> {
  const res = await page.request.get(`/api/combos/${comboID}`);
  return res.ok();
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

test.describe("M23-04 復元時のバリデーション: 落とさずに戻して警告する", () => {
  // ★本サブの価値をそのまま表す spec(指示書 §5.4)。
  test("セットプレイを削除 → 親コンボを削除 → 親コンボを復元 → 警告が画面に出る", async ({ page }) => {
    const characterId = await ryuCharacterId(page);
    expect(characterId, "ゴミ箱画面の既定キャラは解決値(E2E 環境では 1)").toBe(TRASH_CHARACTER_ID);
    const moveID = await firstMoveID(page, characterId);
    const stamp = Date.now();

    const comboID = await createCombo(page, characterId, `e2e-m2304-${stamp}`);
    const setupID = await createSetup(page, comboID, characterId, moveID, `e2e-m2304-${stamp}`);

    // ── セットプレイを先にゴミ箱へ入れる ──────────────────────────────────
    expect((await page.request.delete(`/api/setups/${setupID}`)).status()).toBe(204);
    // ── 続けて親コンボもゴミ箱へ入れる ───────────────────────────────────
    expect((await page.request.delete(`/api/combos/${comboID}`)).status()).toBe(204);

    // ── UI から復元する ──────────────────────────────────────────────────
    await page.goto("/trash");
    await expect(page.getByRole("heading", { name: "ゴミ箱" })).toBeVisible();
    const row = page.locator(`tr:has(a[href="/trash/combos/${comboID}"])`);
    await expect(row, "ゴミ箱のコンボ表に行が出ていない").toHaveCount(1);

    await row.getByRole("button", { name: "復元" }).click();

    // ── ★警告が画面に出る ────────────────────────────────────────────────
    // ★トーストである。モーダルではない(DES-006 §11.1 / 指示書 §4.4)。
    await expect(
      page.getByText(/セットプレイ .* 件がゴミ箱にあります/),
      "★復元したのに「戻りきっていない」ことが画面へ届いていない",
    ).toBeVisible();
    await expect(page.getByRole("alertdialog"), "警告をモーダルで出している").toHaveCount(0);

    // ── ★最重要ゲート: 警告が付いても復元は成功している(§4.1) ────────────
    await expect(row, "復元後もゴミ箱に残っている(復元が中止された)").toHaveCount(0);
    expect(
      await comboIsAlive(page, comboID),
      "★警告が付いたせいで復元が落ちている(D-463 の原則の破壊)",
    ).toBeTruthy();
  });

  // ★誤検知の側も 1 本で見る。出ることだけを確認すると「常に出る」状態と区別できず、
  //   無視される警告になる(指示書 §5 前文)。
  test("健全なコンボの復元では警告が出ない", async ({ page }) => {
    const characterId = await ryuCharacterId(page);
    const moveID = await firstMoveID(page, characterId);
    const stamp = Date.now();

    const comboID = await createCombo(page, characterId, `e2e-m2304-clean-${stamp}`);
    // セットプレイは作るが削除しない(生きたまま紐付いている)。
    await createSetup(page, comboID, characterId, moveID, `e2e-m2304-clean-${stamp}`);

    expect((await page.request.delete(`/api/combos/${comboID}`)).status()).toBe(204);

    await page.goto("/trash");
    const row = page.locator(`tr:has(a[href="/trash/combos/${comboID}"])`);
    await expect(row).toHaveCount(1);
    await row.getByRole("button", { name: "復元" }).click();

    await expect(row, "復元されていない").toHaveCount(0);
    await expect(
      page.getByText(/件がゴミ箱にあります/),
      "健全なコンボの復元で警告が出た(誤検知)",
    ).toHaveCount(0);
  });

  // ★API の契約も 1 本で押さえる。UI は「出たこと」しか見られず、
  //   「0 件のときキーごと出ないこと」(§4.3-2)は本文でしか判定できない。
  test("復元応答: 警告 0 件のとき warnings キー自体が出ない", async ({ page }) => {
    const characterId = await ryuCharacterId(page);
    const stamp = Date.now();
    const comboID = await createCombo(page, characterId, `e2e-m2304-api-${stamp}`);

    expect((await page.request.delete(`/api/combos/${comboID}`)).status()).toBe(204);
    const res = await page.request.post(`/api/combos/${comboID}/restore`);
    expect(res.ok(), `復元失敗: ${res.status()}`).toBeTruthy();

    const body = (await res.json()) as Record<string, unknown>;
    expect(
      Object.prototype.hasOwnProperty.call(body, "warnings"),
      "★警告 0 件なのに warnings キーが出ている(空配列だとフロントが誤って分岐する)",
    ).toBeFalsy();
  });
});

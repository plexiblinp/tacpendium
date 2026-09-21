import { test, expect, type Page } from "@playwright/test";
import { minimalDraftSteps } from "./support/draft-combo";

// M23-03: 参照側の deleted_at 除外(指示書 §5-9)。
//
// 見るのは「コンボをゴミ箱へ入れると、そのコンボがセットプレイ側の
// 『使われているコンボ』(parentComboIds)から消え、復元すると戻る」ことである。
// ★対で確認する。消えるだけを見ると「常に空」の状態と区別できない。
//
// 方式:
//   - fixture 作成・紐付け・削除・復元 = API(セットプレイ共有の安定セレクタが UI に無い)。
//   - 判定 = API(GET /api/setups/:id ／ GET /api/setups?characterId=…)。
//     ★parentComboIds は画面に文字列として出ないため、判定は API 側に置く。
//     画面については「ゴミ箱の id が混ざらないこと」を /trash の表示で担保する。
//
// 前提: E2E 使い捨て DB。バックエンド + Vite dev が起動。
// ★件数を絶対値で数えない。作成した id の在・不在だけを見る(既存 spec の慣行)。
// ★afterEach で作成行を全部落とす(m22-03 / m23-01 / m23-02 に揃える)。

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

// parentComboIdsOfSetup はセットプレイ詳細が返す「使われているコンボ」の id 集合。
// ★これが本サブで表示用(FindLiveComboIDsBySetupID)へ切り替わった経路である。
async function parentComboIdsOfSetup(page: Page, setupID: number): Promise<number[]> {
  const res = await page.request.get(`/api/setups/${setupID}`);
  expect(res.ok(), `セットプレイ詳細取得失敗: ${res.status()}`).toBeTruthy();
  return ((await res.json()).parentComboIds ?? []) as number[];
}

// parentComboIdsOfSetupInList は一覧(複数版の SQL)側の同じ値。
async function parentComboIdsOfSetupInList(page: Page, characterId: number, setupID: number) {
  const res = await page.request.get(`/api/setups?characterId=${characterId}`);
  expect(res.ok(), `セットプレイ一覧取得失敗: ${res.status()}`).toBeTruthy();
  const items = (await res.json()).items as Array<{ id: number; parentComboIds: number[] }>;
  const target = items.find((s) => s.id === setupID);
  expect(target, `一覧に setup ${setupID} が出ていない`).toBeTruthy();
  return target!.parentComboIds ?? [];
}

test.afterEach(async ({ request }) => {
  for (const id of [...createdSetupIDs].reverse()) {
    await request.delete(`/api/setups/${id}`).catch(() => undefined);
  }
  for (const id of [...createdComboIDs].reverse()) {
    await request.delete(`/api/combos/${id}`).catch(() => undefined);
    await request.delete(`/api/combos/${id}/permanent`).catch(() => undefined);
  }
  for (const id of [...createdSetupIDs].reverse()) {
    await request.delete(`/api/setups/${id}/permanent`).catch(() => undefined);
  }
  createdComboIDs.length = 0;
  createdSetupIDs.length = 0;
});

test.describe("M23-03 参照側の除外: ゴミ箱のコンボは parentComboIds から消える", () => {
  test("2 コンボで共有 → 片方をゴミ箱へ → 消える → 復元 → 戻る", async ({ page }) => {
    // ★本テストは /trash 画面を開かない。判定はすべて API 側にあるため、
    //   ここで固定したいのは「同一キャラのコンボ 2 件とセットプレイを組める」ことだけである。
    const characterId = await ryuCharacterId(page);
    const moveID = await firstMoveID(page, characterId);
    const stamp = Date.now();

    const comboA = await createCombo(page, characterId, `e2e-m2303-a-${stamp}`);
    const comboB = await createCombo(page, characterId, `e2e-m2303-b-${stamp}`);
    const setupID = await createSetup(page, comboA, characterId, moveID, `e2e-m2303-${stamp}`);

    const linkRes = await page.request.post(`/api/combos/${comboB}/setup-links`, {
      data: { setupId: setupID },
    });
    expect(linkRes.ok(), `紐付け失敗: ${linkRes.status()} ${await linkRes.text()}`).toBeTruthy();

    // ── 前提: 両方が「使われているコンボ」に載っている ──────────────────
    let parents = await parentComboIdsOfSetup(page, setupID);
    expect(parents, "前提: A が載っている").toContain(comboA);
    expect(parents, "前提: B が載っている").toContain(comboB);

    // ── コンボ A をゴミ箱へ ────────────────────────────────────────────
    expect((await page.request.delete(`/api/combos/${comboA}`)).status()).toBe(204);

    parents = await parentComboIdsOfSetup(page, setupID);
    expect(parents, "ゴミ箱のコンボ id が詳細に残っている").not.toContain(comboA);
    expect(parents, "生きているコンボまで落ちている").toContain(comboB);

    // 一覧側(複数版の SQL)も同じ扱いであること。
    const listParents = await parentComboIdsOfSetupInList(page, characterId, setupID);
    expect(listParents, "ゴミ箱のコンボ id が一覧に残っている").not.toContain(comboA);
    expect(listParents, "生きているコンボまで落ちている(一覧)").toContain(comboB);

    // ── 復元したら戻る(★対で確認する) ─────────────────────────────────
    const restoreRes = await page.request.post(`/api/combos/${comboA}/restore`);
    expect(restoreRes.ok(), `復元失敗: ${restoreRes.status()} ${await restoreRes.text()}`).toBeTruthy();

    parents = await parentComboIdsOfSetup(page, setupID);
    expect(parents, "復元しても A が戻っていない").toContain(comboA);
    expect(parents, "復元で B が落ちた").toContain(comboB);
  });

  test("ゴミ箱画面がゴミ箱のコンボを出し、復元すると消える(画面が壊れていないこと)", async ({
    page,
  }) => {
    const characterId = await ryuCharacterId(page);
    // ★ゴミ箱画面の既定キャラは useResolvedCharacterId の解決値(E2E 環境では 1)。
    //   ここで前提を固定しないと、行が出ない理由が「除外の穴」なのか
    //   「別キャラを見ている」なのか切り分けられない。
    expect(characterId, "ゴミ箱画面の既定キャラは解決値(E2E 環境では 1)").toBe(TRASH_CHARACTER_ID);
    const stamp = Date.now();
    const comboID = await createCombo(page, characterId, `e2e-m2303-trash-${stamp}`);

    expect((await page.request.delete(`/api/combos/${comboID}`)).status()).toBe(204);

    // ★行の同定は m23-01 spec と同じく行リンクで行う(memo は表に出ない列である)。
    await page.goto("/trash");
    await expect(page.getByRole("heading", { name: "ゴミ箱" })).toBeVisible();
    await expect(
      page.locator(`a[href="/trash/combos/${comboID}"]`),
      "ゴミ箱へ入れたコンボが画面に出ていない",
    ).toHaveCount(1);

    const restoreRes = await page.request.post(`/api/combos/${comboID}/restore`);
    expect(restoreRes.ok()).toBeTruthy();

    await page.goto("/trash");
    await expect(
      page.locator(`a[href="/trash/combos/${comboID}"]`),
      "復元したコンボがゴミ箱に残っている",
    ).toHaveCount(0);
  });
});

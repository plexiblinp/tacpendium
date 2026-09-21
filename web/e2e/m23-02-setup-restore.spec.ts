import { test, expect, type Page } from "@playwright/test";
import { minimalDraftSteps } from "./support/draft-combo";

// M23-02: セットプレイの復元・完全削除と、案 P1 の撤回(D-483 / D-484 / D-491)。
//
// ★本 spec の要は「共有の状態で見る」ことである。セットプレイが 1 つのコンボにだけ
// 紐付いている状態では、本サブが直した壊れ方が再現しない——撤回前は論理削除で
// combo_setups が物理削除され、共有していたコンボ A・B の両方が紐付けを失っていた。
// 指示書 §5-10 が求めるのは、紐付け 2 本 → 論理削除 → 復元 → 両方から見える、を
// 1 本で通すことである。
//
// 方式:
//   - fixture 作成・紐付け・削除・復元 = API(UI にセットプレイ共有の安定セレクタが無い)。
//   - 判定 = API(コンボ詳細の setups[])と UI(/trash のセットプレイ表)の両方。
//   - 完全削除の拒否(§4.4)も同じ spec で見る。拒否だけを確認すると「常に拒否される」
//     状態と区別できないため、参照元をゴミ箱へ入れると通ることまで対で確認する。
//
// 前提: E2E 使い捨て DB(全マイグレ適用済み=新系列 000009 が終端)。バックエンド + Vite dev が起動。
// ★件数を絶対値で数えない。作成した id の在・不在だけを見る。
// ★afterEach で作成行を全部落とす(既存の m22-03 / m22-04 / m23-01 の慣行に揃える)。

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

async function firstMoveID(page: Page, characterId: number): Promise<number> {
  const res = await page.request.get(`/api/moves?character_id=${characterId}`);
  expect(res.ok()).toBeTruthy();
  const moves = (await res.json()).items as Array<{ id: number; code: string }>;
  const move = moves.find((m) => m.code === "standing_light_punch") ?? moves[0];
  if (!move) throw new Error("seed に技が見つからない(配布クリーン状態の前提崩れ)");
  return move.id;
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

// setupIDsOfCombo はコンボ詳細が返す setups[] の id 集合。
// ★これは ListSetupsByComboID(s.deleted_at IS NULL を持つ)由来である。
async function setupIDsOfCombo(page: Page, comboID: number): Promise<number[]> {
  const res = await page.request.get(`/api/combos/${comboID}`);
  expect(res.ok(), `コンボ詳細取得失敗: ${res.status()}`).toBeTruthy();
  const body = await res.json();
  return ((body.setups ?? []) as Array<{ id: number }>).map((s) => s.id);
}

async function trashSetupIDs(page: Page): Promise<number[]> {
  const res = await page.request.get(
    `/api/setups?characterId=${TRASH_CHARACTER_ID}&onlyDeleted=true`,
  );
  expect(res.ok(), `ゴミ箱一覧取得失敗: ${res.status()}`).toBeTruthy();
  const body = await res.json();
  return (body.items as Array<{ id: number }>).map((s) => s.id);
}

test.afterEach(async ({ request }) => {
  // セットプレイ → コンボ の順に落とす。セットプレイの完全削除は生きたコンボから
  // 参照されている間は拒否されるため、コンボを先に消してから完全削除する。
  for (const id of createdComboIDs.reverse()) {
    await request.delete(`/api/combos/${id}`).catch(() => undefined);
  }
  for (const id of createdSetupIDs.reverse()) {
    await request.delete(`/api/setups/${id}`).catch(() => undefined);
    await request.delete(`/api/setups/${id}/permanent`).catch(() => undefined);
  }
  for (const id of createdComboIDs) {
    await request.delete(`/api/combos/${id}/permanent`).catch(() => undefined);
  }
  createdComboIDs.length = 0;
  createdSetupIDs.length = 0;
});

test.describe("M23-02 セットプレイのゴミ箱: 共有された紐付けを壊さず復元する", () => {
  // ★本サブの価値をそのまま表す spec(指示書 §5-10)。
  test("2 コンボで共有 → 論理削除 → 復元 → 両方から見える", async ({ page }) => {
    const characterId = await ryuCharacterId(page);
    expect(characterId, "ゴミ箱画面の既定キャラは解決値(E2E 環境では 1)").toBe(TRASH_CHARACTER_ID);
    const moveID = await firstMoveID(page, characterId);
    const stamp = Date.now();

    // ── 共有の状態を作る ────────────────────────────────────────────────
    const comboA = await createCombo(page, characterId, `e2e-m2302-a-${stamp}`);
    const comboB = await createCombo(page, characterId, `e2e-m2302-b-${stamp}`);
    const setupID = await createSetup(page, comboA, characterId, moveID, `e2e-m2302-${stamp}`);

    const linkRes = await page.request.post(`/api/combos/${comboB}/setup-links`, {
      data: { setupId: setupID },
    });
    expect(linkRes.ok(), `紐付け失敗: ${linkRes.status()} ${await linkRes.text()}`).toBeTruthy();

    expect(await setupIDsOfCombo(page, comboA), "前提: A から見える").toContain(setupID);
    expect(await setupIDsOfCombo(page, comboB), "前提: B から見える").toContain(setupID);

    // ── 論理削除 ────────────────────────────────────────────────────────
    expect((await page.request.delete(`/api/setups/${setupID}`)).status()).toBe(204);

    // 生きたコンボの画面からは消える(除外は参照側に委ねている＝§4.1-5)。
    expect(await setupIDsOfCombo(page, comboA), "論理削除後に A から見えている").not.toContain(setupID);
    expect(await setupIDsOfCombo(page, comboB), "論理削除後に B から見えている").not.toContain(setupID);
    // ただしゴミ箱には出る。
    expect(await trashSetupIDs(page), "ゴミ箱に出ていない").toContain(setupID);

    // ── UI: ゴミ箱のセットプレイ表に出ていること ─────────────────────────
    await page.goto("/trash");
    await expect(page.getByRole("heading", { name: "ゴミ箱" })).toBeVisible();
    const setupRow = page.locator(`tr:has-text("e2e-m2302-${stamp}")`);
    await expect(setupRow, "ゴミ箱のセットプレイ表に行が出ていない").toHaveCount(1);
    // ★セットプレイの表は 4 列(選択 / 名前 / 削除日時 / 操作)。コンボ表とは別テーブルである。
    //   ★M23-06 §4.4 で選択列が足された(一括操作をセットプレイにも効かせるため)。
    //   本テストの意図は「コンボ表と混ぜていないこと」であり、列が増えても損なわれない。
    await expect(setupRow.locator("td")).toHaveCount(4);

    // ── 復元(UI から押す) ───────────────────────────────────────────────
    await setupRow.getByRole("button", { name: "復元" }).click();
    await expect(setupRow, "復元後もゴミ箱に残っている").toHaveCount(0);

    // ── ★最重要ゲート: A と B の両方へ一斉に戻る ────────────────────────
    expect(
      await setupIDsOfCombo(page, comboA),
      "★復元後に A から見えない(共有された紐付けが壊れている)",
    ).toContain(setupID);
    expect(
      await setupIDsOfCombo(page, comboB),
      "★復元後に B から見えない(片方だけ戻っている＝D-484 の要求が守られていない)",
    ).toContain(setupID);

    // recipe_cache が作り直されている(§4.2-4)。
    const detail = await page.request.get(`/api/setups/${setupID}`);
    expect(detail.ok()).toBeTruthy();
    expect(
      ((await detail.json()).defaultRecipe as string).length,
      "復元後の defaultRecipe が空(recipe_cache が作り直されていない)",
    ).toBeGreaterThan(0);
  });

  // ★拒否と、通る側を対で見る(§5-4 / §5-5)。片方だけでは
  //   「常に拒否される」状態と区別できない。
  test("完全削除: 生きたコンボから参照中は拒否され、参照元をゴミ箱へ入れると通る", async ({ page }) => {
    const characterId = await ryuCharacterId(page);
    const moveID = await firstMoveID(page, characterId);
    const stamp = Date.now();

    const comboA = await createCombo(page, characterId, `e2e-m2302-del-a-${stamp}`);
    const setupID = await createSetup(page, comboA, characterId, moveID, `e2e-m2302-del-${stamp}`);
    expect((await page.request.delete(`/api/setups/${setupID}`)).status()).toBe(204);

    // ── 拒否 ────────────────────────────────────────────────────────────
    const rejected = await page.request.delete(`/api/setups/${setupID}/permanent`);
    expect(rejected.status(), "生きたコンボから参照中なのに完全削除が通った").toBe(409);
    const body = await rejected.json();
    expect(body.error.code).toBe("setup_in_use");
    // ★応答には参照元コンボが入る(画面は列挙しないが、切り分けの材料として載せる)。
    expect(
      (body.error.details.combos as Array<{ id: number }>).map((c) => c.id),
      "拒否の応答に参照元コンボが入っていない",
    ).toContain(comboA);

    // 拒否された以上、ゴミ箱に残ったままである。
    expect(await trashSetupIDs(page), "拒否されたのにゴミ箱から消えている").toContain(setupID);

    // ── 参照元をゴミ箱へ入れると通る(D-486) ─────────────────────────────
    expect((await page.request.delete(`/api/combos/${comboA}`)).status()).toBe(204);
    const accepted = await page.request.delete(`/api/setups/${setupID}/permanent`);
    expect(
      accepted.status(),
      "参照元が全てゴミ箱なのに拒否された(述語は combos.deleted_at IS NULL だけのはず)",
    ).toBe(204);
    expect(await trashSetupIDs(page), "完全削除したのにゴミ箱に残っている").not.toContain(setupID);
  });

  // ★M23-01 の撤去を巻き戻していないこと(D-490 / チェックリスト §3)。
  //   本サブはゴミ箱画面へ配線を足すため、コンボ表を崩していないかを同じ場所で見る。
  // ★M23-06 §4.1 でルート列を撤去したため 7 → 6。本テストの意図は「セットプレイを
  //   コンボ表へ混ぜていないこと」であり、列数が減る向きの更新はそれを損なわない。
  test("コンボ表は 6 列のまま(セットプレイを混ぜていない)", async ({ page }) => {
    const characterId = await ryuCharacterId(page);
    const stamp = Date.now();
    const comboID = await createCombo(page, characterId, `e2e-m2302-cols-${stamp}`);
    expect((await page.request.delete(`/api/combos/${comboID}`)).status()).toBe(204);

    await page.goto("/trash");
    // ★M23-07 §4.2 で行の遷移先が /trash/combos/:id へ変わった(読み取り専用詳細)。
    const row = page.locator(`tr:has(a[href="/trash/combos/${comboID}"])`);
    await expect(row).toHaveCount(1);
    await expect(row.locator("td"), "コンボ表の列数が 6 から動いている").toHaveCount(6);
    await expect(page.getByRole("columnheader", { name: "残日数" })).toHaveCount(0);
    await expect(page.getByText(/90 日/)).toHaveCount(0);
  });
});

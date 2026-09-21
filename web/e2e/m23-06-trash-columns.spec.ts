import { test, expect, type Page } from "@playwright/test";
import { minimalDraftSteps } from "./support/draft-combo";

// M23-06: ゴミ箱の列と見せ方。
//
// ★本 spec が守るのは 2 点である(指示書 §5.4)。
//   1. 名無しセットプレイがレシピ文字列で識別できること(§4.3＝本サブの中心)
//   2. コンボとセットプレイを混ぜて一括選択し、それぞれ正しく復元されること(§4.4)
//
// ★★2 が最重要ゲートである。種別を取り違えると別のデータが消える。完全削除は
// 不可逆であり、UI の見た目では取り違えに気づけない。
//
// 方式:
//   - fixture 作成・ゴミ箱へ入れる = API。★UI 導線は M23-07 §4.1 で配線済みだが、
//     本 spec の関心は列構成であり前提づくりを短くする。指示書 §5.4 も API 経由を許している。
//     (画面操作だけで入れて戻せることは m23-07-trash-missing-paths.spec.ts が通す。)
//   - 判定 = UI(/trash の表)。列と見え方が主題であるため、ここは画面で見る。
//
// 前提: E2E 使い捨て DB。バックエンド + Vite dev が起動。
// ★件数を絶対値で数えない。作成した id の在・不在だけを見る。

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

// setupDefaultRecipe は生きているうちにサーバが返すレシピ文字列を控える。
// ★削除後にゴミ箱へ出る文字列と一致することを見るための「期待値の出どころ」である。
//   ★★画面と同じ組み立てをテスト側で書かない。それをやると、実装が間違っていても
//   同じ間違いをテストが再現して緑になる。
async function setupDefaultRecipe(page: Page, setupID: number): Promise<string> {
  const res = await page.request.get(`/api/setups/${setupID}`);
  expect(res.ok(), `セットプレイ取得失敗: ${res.status()}`).toBeTruthy();
  const recipe = (await res.json()).defaultRecipe as string;
  expect(recipe, "生きているセットプレイの defaultRecipe が空(前提崩れ)").not.toBe("");
  return recipe;
}

// trashSetupRecipe は削除済み一覧が返すレシピ文字列を取る。
//
// ★★ここが本サブの中心の観測点である。従来この値は常に空文字だった——論理削除の
// 時点で recipe_cache を物理削除しているためであり、名前が空のセットプレイは
// 「(名称未設定)」でしか並べなかった。⇒ setup_steps から組み立てて埋める。
async function trashSetupRecipe(page: Page, setupID: number): Promise<string> {
  const res = await page.request.get(
    `/api/setups?characterId=${TRASH_CHARACTER_ID}&onlyDeleted=true`,
  );
  expect(res.ok(), `ゴミ箱一覧取得失敗: ${res.status()}`).toBeTruthy();
  const items = (await res.json()).items as Array<{ id: number; defaultRecipe: string }>;
  const row = items.find((s) => s.id === setupID);
  expect(row, `ゴミ箱に setup ${setupID} が居ない`).toBeTruthy();
  return row!.defaultRecipe;
}

const createdTagIDs: number[] = [];

async function createTag(page: Page, name: string): Promise<number> {
  const res = await page.request.post("/api/tags", { data: { name, color: "#3B82F6" } });
  expect(res.ok(), `タグ作成失敗: ${res.status()} ${await res.text()}`).toBeTruthy();
  const id = (await res.json()).id as number;
  createdTagIDs.push(id);
  return id;
}

async function attachTag(page: Page, comboID: number, tagID: number): Promise<void> {
  // ★PATCH は楽観ロックのため version が要る(M22-03)。現在値を読んでから送る。
  const cur = await page.request.get(`/api/combos/${comboID}`);
  expect(cur.ok(), `コンボ取得失敗: ${cur.status()}`).toBeTruthy();
  const version = (await cur.json()).version as number;

  const res = await page.request.patch(`/api/combos/${comboID}`, {
    data: { version, tagIds: [tagID] },
  });
  expect(res.ok(), `タグ紐付け失敗: ${res.status()} ${await res.text()}`).toBeTruthy();
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
  for (const id of createdTagIDs) {
    await request.delete(`/api/tags/${id}`).catch(() => undefined);
  }
  createdComboIDs.length = 0;
  createdSetupIDs.length = 0;
  createdTagIDs.length = 0;
});

test.describe("M23-06 ゴミ箱の列と見せ方", () => {
  // ★本サブの中心(§4.3)。完全削除は不可逆であり、識別できないまま押させない。
  //
  // ★★名前が空のセットプレイを E2E から作ることはできない——VAL-S06 が登録
  // (ValidateSetupCreate)と更新(ValidateSetupUpdate)の両方で空名を弾く。
  // ⇒ 名無しの行は VAL-S06 導入前の既存データだけである(実装実査・完了報告に記載)。
  // ⇒ E2E が届く境界は「削除済み一覧のレシピ文字列が埋まっていること」である。
  //   画面のフォールバック(name → defaultRecipe → (名称未設定))はコンポーネント
  //   テスト側で名無しの行を作って確かめてある(TrashSetupListRow.test.tsx §5.1-6)。
  test("削除済みセットプレイの応答にレシピ文字列が載る(識別手段の供給元)", async ({ page }) => {
    const characterId = await ryuCharacterId(page);
    expect(characterId, "ゴミ箱画面の既定キャラは解決値(E2E 環境では 1)").toBe(TRASH_CHARACTER_ID);
    const moveID = await firstMoveID(page, characterId);
    const stamp = Date.now();

    const comboID = await createCombo(page, characterId, `e2e-m2306-recipe-${stamp}`);
    const name = `e2e-m2306-${stamp}`;
    const setupID = await createSetup(page, comboID, characterId, moveID, name);
    // ★期待値は「生きているうちにサーバが返した文字列」である。画面と同じ組み立てを
    //   テスト側で書かない——同じ間違いを再現して緑になる形を避ける。
    const aliveRecipe = await setupDefaultRecipe(page, setupID);

    // ★UI 導線は M23-07 §4.1 で配線済み(コンボ詳細のセットプレイカード)。
    // ここで API を使うのは本 spec の関心が列構成であり、前提づくりを短くするためである
    // (画面操作だけで入れて戻せることは m23-07 の spec が通している)。
    expect((await page.request.delete(`/api/setups/${setupID}`)).status()).toBe(204);

    // ★★従来はここが空文字だった。埋まっていることが「識別できる」の実体である。
    expect(
      await trashSetupRecipe(page, setupID),
      "削除済みセットプレイの defaultRecipe が空(名無しの行を識別する手段がゼロのまま)",
    ).toBe(aliveRecipe);

    // 画面にも行が出ていること(名前があるので名前で並ぶ)。
    await page.goto("/trash");
    await expect(page.locator("tr").filter({ hasText: name })).toHaveCount(1);
  });

  // ★★最重要ゲート(§4.4-1 / §5.4)。種別を取り違えると別のデータが消える。
  test("コンボとセットプレイを混ぜて一括選択すると、それぞれ正しく復元される", async ({ page }) => {
    const characterId = await ryuCharacterId(page);
    const moveID = await firstMoveID(page, characterId);
    const stamp = Date.now();

    const holderID = await createCombo(page, characterId, `e2e-m2306-holder-${stamp}`);
    const setupID = await createSetup(page, holderID, characterId, moveID, `e2e-m2306-set-${stamp}`);
    const comboID = await createCombo(page, characterId, `e2e-m2306-mix-${stamp}`);

    expect((await page.request.delete(`/api/combos/${comboID}`)).status()).toBe(204);
    expect((await page.request.delete(`/api/setups/${setupID}`)).status()).toBe(204);

    await page.goto("/trash");

    // コンボ側の行を選ぶ。
    const comboRow = page.locator(`tr:has(a[href="/trash/combos/${comboID}"])`);
    await expect(comboRow).toHaveCount(1);
    await comboRow.getByRole("checkbox").check();

    // セットプレイ側の行を選ぶ(名前で特定する)。
    const setupRow = page.locator("tr").filter({ hasText: `e2e-m2306-set-${stamp}` });
    await expect(setupRow).toHaveCount(1);
    await setupRow.getByRole("checkbox").check();

    await page.getByRole("button", { name: "選択を復元" }).click();

    // ★両方が復元されている。片方だけ、あるいは取り違えて別の行が消える形でない。
    await expect
      .poll(async () => (await page.request.get(`/api/combos/${comboID}`)).status())
      .toBe(200);
    await expect
      .poll(async () => (await page.request.get(`/api/setups/${setupID}`)).status())
      .toBe(200);

    // ★ゴミ箱からは両方が消えている。
    await page.goto("/trash");
    await expect(page.locator(`tr:has(a[href="/trash/combos/${comboID}"])`)).toHaveCount(0);
    await expect(page.locator("tr").filter({ hasText: `e2e-m2306-set-${stamp}` })).toHaveCount(0);
  });

  // ★§4.1 / §4.2: 列の確定。撤去(ルート)と描画(タグ)を同じ場所で見る。
  //
  // ★★タグは実際に 1 件付けて、行に出るところまで見る。列見出しの存在だけを見ると
  //   「列は在るが中身が常に空」という、まさに本サブが直した状態を見逃す。
  test("ルート列が無く、タグ列が実際にタグを描画する", async ({ page }) => {
    const characterId = await ryuCharacterId(page);
    const stamp = Date.now();
    const comboID = await createCombo(page, characterId, `e2e-m2306-cols-${stamp}`);
    const tagName = `e2e-m2306-tag-${stamp}`;
    await attachTag(page, comboID, await createTag(page, tagName));
    expect((await page.request.delete(`/api/combos/${comboID}`)).status()).toBe(204);

    await page.goto("/trash");
    const row = page.locator(`tr:has(a[href="/trash/combos/${comboID}"])`);
    await expect(row).toHaveCount(1);

    // 7 列 → 6 列(ルートの列を撤去した)。
    await expect(row.locator("td")).toHaveCount(6);
    await expect(page.getByRole("columnheader", { name: "ルート" })).toHaveCount(0);
    await expect(page.getByText("(レシピ表示なし)")).toHaveCount(0);
    // タグ列は残る(描画する側である)。
    await expect(page.getByRole("columnheader", { name: "タグ" })).toHaveCount(1);
    // ★★中身が出ていること。従来は常に「-」で、データは応答に届いていた。
    await expect(row.getByText(tagName), "ゴミ箱の行にタグが描画されていない").toHaveCount(1);
  });
});

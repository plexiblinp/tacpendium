import { test, expect, type Page } from "@playwright/test";

import {
  fillRequiredComboFields,
  gotoNewComboRecipeFor,
  openRecipeTab,
} from "./support/editor-input";
import { minimalDraftSteps } from "./support/draft-combo";

// M23-09: 登録前の重複ダイアログ(保存する前に、ゴミ箱に同じものがあることを知らせて選ばせる)。
//
// ★★本 spec が守るのは「保存する前に選べること」である。M23-05 は同じ目的を
// 「保存が成功した後のトースト」で果たそうとして達成できなかった(D-518)——
// 保存後に告げるものは、定義上「作り直す前」に告げられない。
//
// ★★シナリオは指示書 §5.4 のとおり:
//   コンボを削除 → 同じものを新規登録しようとする → ダイアログが出る
//     → 「復元する」→ 復元されて詳細画面へ行き、新しいコンボは作られていない
//     → 「新しく作る」→ 新しいコンボが作られ、ゴミ箱の行も残っている
//   ＋ 誤検知の対照(ゴミ箱に同じものが無ければ出ない)。
//
// ★★判定キーを m23-05 spec と分けてある(中パンチ + 強パンチ の 2 手)。
//   playwright は fullyParallel: false でも**ファイル単位では並行**に走り、DB を 1 本
//   共有する。m23-05 と同じ「弱パンチ 1 手」で作ると、片方がゴミ箱へ入れた行が
//   もう片方の「ゴミ箱に同じものが無ければ出ない」を壊す。
//   ★afterEach の後片付けでは埋められない——並行実行中は「まだ消していない時間」が必ず在る。
//   ★ゴミ箱を作る spec が増えるほど当たりやすくなるため、後続サブは先に他 spec の
//     判定キーを確認すること。
//
// ★★「新しいコンボが作られていない」を一覧の件数で判定しない。/api/combos の一覧は
//   ページングされるため、1 件増えても総数が変わらないことがある。
//   ⇒ 登録要求(POST /api/combos)の発生回数を見る。
//
// 前提: E2E 使い捨て DB。バックエンド + Vite dev が起動。ウィザード完了済み。

const createdComboIDs: number[] = [];
const createdSetupIDs: number[] = [];

/** ★m23-05 spec と重ならない判定キーにする(上記の理由)。 */
const RECIPE = ["中パンチ", "強パンチ"] as const;

async function buildRecipe(page: Page) {
  await gotoNewComboRecipeFor(page, "ryu");
  await page.getByTestId("recipe-tab-normal").click();
  for (const move of RECIPE) {
    await page.getByRole("button", { name: move }).click();
  }
  await expect(page.locator("ol > li")).toHaveCount(RECIPE.length);

  // ★M27-02b(VAL-C15): 本登録の必須欄を埋める。埋めないと保存が通らず、
  //   本 spec が見たい保存前ダイアログまで到達しない。
  await fillRequiredComboFields(page);
  await openRecipeTab(page);
}

/** createComboViaUI は本登録のコンボを 1 件作る(ゴミ箱に同じものが無い前提)。 */
async function createComboViaUI(page: Page): Promise<number> {
  await buildRecipe(page);
  const [res] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith("/api/combos") && r.request().method() === "POST"),
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

// ---------------------------------------------------------------------------
// セットプレイ側(§4.1-2)
//
// ★★判定キーの衝突対策が要らない。コンボ側と非対称である——セットプレイの重複判定は
//   同一親コンボ配下に閉じており(VAL-S04 / VAL-S07 とも combo_setups で絞る)、
//   本 spec はテストごとに親コンボを新規作成するため、他 spec と構造的に衝突しない。
//   ⇒ 「判定キーを spec ごとに分ける」の申し送りはコンボ側だけに当たる。
//
// ★fixture 作成は API(m23-07 の作法)。登録の UI 操作だけが本テストの関心である。
// ---------------------------------------------------------------------------

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

async function createParentCombo(page: Page, characterId: number): Promise<number> {
  const res = await page.request.post("/api/combos", {
    // ★M24-13: 仮登録でもレシピのステップ 1 本以上が要る(VAL-C09)。
    data: {
      characterId,
      isDraft: true,
      position: "mid_screen",
      memo: "e2e-m23-09-setup-parent",
      steps: minimalDraftSteps(),
    },
  });
  expect(res.ok(), `親コンボ作成失敗: ${res.status()} ${await res.text()}`).toBeTruthy();
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

async function setupIsAlive(page: Page, setupID: number): Promise<boolean> {
  const res = await page.request.get(`/api/setups/${setupID}`);
  return res.ok();
}

/**
 * countSetupCreateRequests は POST /api/combos/{id}/setups の発生回数を数え始める。
 *
 * ★★`/setups/check-duplicate` を数えないこと。同 URL は `/setups` を接頭辞に持つため、
 *   includes で数えると保存前チェックまで登録要求として数えてしまう。
 */
function countSetupCreateRequests(page: Page): () => number {
  let n = 0;
  page.on("request", (req) => {
    if (req.method() === "POST" && /\/api\/combos\/\d+\/setups$/.test(new URL(req.url()).pathname)) {
      n += 1;
    }
  });
  return () => n;
}

/** countCreateRequests は POST /api/combos の発生回数を数え始める。 */
function countCreateRequests(page: Page): () => number {
  let n = 0;
  page.on("request", (req) => {
    if (req.method() === "POST" && req.url().endsWith("/api/combos")) n += 1;
  });
  return () => n;
}

test.afterEach(async ({ request }) => {
  // ★セットプレイを先に落とす。親コンボを完全削除すると紐付けが消え、
  //   セットプレイ側の後片付けが辿れなくなる。
  for (const id of [...createdSetupIDs].reverse()) {
    await request.delete(`/api/setups/${id}`).catch(() => undefined);
    await request.delete(`/api/setups/${id}/permanent`).catch(() => undefined);
  }
  createdSetupIDs.length = 0;

  for (const id of [...createdComboIDs].reverse()) {
    await request.delete(`/api/combos/${id}`).catch(() => undefined);
  }
  for (const id of createdComboIDs) {
    await request.delete(`/api/combos/${id}/permanent`).catch(() => undefined);
  }
  createdComboIDs.length = 0;
});

test.describe("M23-09 登録前の重複ダイアログ", () => {
  test("削除 → 同じものを登録しようとする → ダイアログ → 「復元する」で戻り、新しいコンボは作られない", async ({
    page,
  }) => {
    const trashedID = await createComboViaUI(page);
    expect((await page.request.delete(`/api/combos/${trashedID}`)).status()).toBe(204);

    const createCount = countCreateRequests(page);
    await buildRecipe(page);
    await page.getByRole("button", { name: "保存" }).click();

    // ── ★★保存する前にダイアログが出る(ここが本サブの全部である) ──────────
    const dialog = page.getByTestId("pre-save-duplicate-dialog");
    await expect(dialog, "★保存する前に選ばせる導線が出ていない").toBeVisible();

    // ★★最重要ゲート: 「復元する」を押す前に、入力が保存されないことが書かれている(§4.4)。
    await expect(page.getByTestId("pre-save-duplicate-restore-caution")).toHaveText(
      "復元すると、いま入力した内容は保存されません。",
    );
    // ★「両方入れる」は出さない(§1.4-1・D-518)。
    await expect(dialog).not.toContainText("両方");

    await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().endsWith(`/api/combos/${trashedID}/restore`) && r.request().method() === "POST",
      ),
      page.getByTestId("pre-save-duplicate-restore").click(),
    ]);

    // ★復元して詳細画面へ行く。編集画面へは行かない(§4.3-3)。
    await expect(page).toHaveURL(new RegExp(`/combos/${trashedID}$`));
    expect(await comboIsAlive(page, trashedID), "★復元されていない").toBeTruthy();

    // ★★新しいコンボは作られていない。件数ではなく登録要求の回数で見る。
    expect(createCount(), "★「復元する」を選んだのに登録 API が叩かれている").toBe(0);
  });

  test("同じ流れで「新しく作る」を選ぶ → 新しいコンボが作られ、ゴミ箱の行も残っている", async ({
    page,
  }) => {
    const trashedID = await createComboViaUI(page);
    expect((await page.request.delete(`/api/combos/${trashedID}`)).status()).toBe(204);

    await buildRecipe(page);
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByTestId("pre-save-duplicate-dialog")).toBeVisible();

    const [res] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().endsWith("/api/combos") && r.request().method() === "POST",
      ),
      page.getByTestId("pre-save-duplicate-create-new").click(),
    ]);
    expect(res.status(), `コンボ作成失敗: ${await res.text()}`).toBe(201);
    const newID = (await res.json()).id as number;
    createdComboIDs.push(newID);

    expect(await comboIsAlive(page, newID), "★新しいコンボが作られていない").toBeTruthy();

    // ★ゴミ箱の行はそのまま残る(文面 createNewCaution が約束していること)。
    await page.goto("/trash");
    await expect(page.locator(`tr:has(a[href="/trash/combos/${trashedID}"])`)).toHaveCount(1);
  });

  // ★★セットプレイ側を画面から 1 度通す。
  //
  //   本テストが足された理由: サーバ 13 本・単体 18 本が緑でも、
  //   **画面 → API → DB を貫いた経路が 1 度も通っていなかった**。
  //   単体テストは応答を stub するため「経路が繋がっていないこと」を構造的に検出できない
  //   (実際、コンボ側でも isFormReadyForDuplicateCheck の流用という欠陥は E2E を書く段で
  //    初めて見つかった)。⇒ 面が 2 つあるサブは、面ごとに E2E の有無を数えること。
  test("セットプレイ: 削除 → 同じレシピで登録しようとする → ダイアログ → 「復元する」で戻り、新しいセットプレイは作られない", async ({
    page,
  }) => {
    const characterId = await ryuCharacterId(page);
    const moveID = await firstMoveID(page, characterId);
    const comboID = await createParentCombo(page, characterId);
    const trashedID = await createSetup(page, comboID, characterId, moveID, "e2e-m23-09-setup");

    // ゴミ箱へ入れる(削除の導線は本サブの対象外なので API で作る)。
    expect((await page.request.delete(`/api/setups/${trashedID}`)).status()).toBe(204);
    expect(await setupIsAlive(page, trashedID), "前提が崩れている: 削除できていない").toBeFalsy();

    const setupCreateCount = countSetupCreateRequests(page);

    // ── 画面から同じレシピのセットプレイを登録しようとする ──────────────────
    // ★操作手順は m19-07 spec(UI でセットプレイを作る唯一の先例)に揃える。
    await page.goto(`/combos/${comboID}/setups/new`);
    await page.getByPlaceholder("セットプレイ名").fill("e2e-m23-09-setup-again");
    await page.getByTestId("recipe-pulldown-toggle").click();
    await page.getByTestId("recipe-move-select").selectOption(String(moveID));
    await page.getByTestId("recipe-add-step").click();
    await page.getByRole("button", { name: "保存" }).click();

    // ── ★★保存する前にダイアログが出る ────────────────────────────────────
    const dialog = page.getByTestId("pre-save-duplicate-dialog");
    await expect(dialog, "★セットプレイ側で保存前に選ばせる導線が出ていない").toBeVisible();

    // ★★最重要ゲート: 「復元する」を押す前に、入力が保存されないことが読める(§4.4)。
    await expect(page.getByTestId("pre-save-duplicate-restore-caution")).toHaveText(
      "復元すると、いま入力した内容は保存されません。",
    );
    // ★「両方入れる」は出さない(§1.4-1・D-518)。
    await expect(dialog).not.toContainText("両方");

    await Promise.all([
      page.waitForResponse(
        (r) => r.url().endsWith(`/api/setups/${trashedID}/restore`) && r.request().method() === "POST",
      ),
      page.getByTestId("pre-save-duplicate-restore").click(),
    ]);

    // ★復元して親コンボの詳細画面へ行く(§4.3-3。/setups/:id は編集画面なので行かない)。
    await expect(page).toHaveURL(new RegExp(`/combos/${comboID}$`));
    expect(await setupIsAlive(page, trashedID), "★復元されていない").toBeTruthy();

    // ★★新しいセットプレイは作られていない。件数ではなく登録要求の回数で見る。
    expect(
      setupCreateCount(),
      "★「復元する」を選んだのにセットプレイの登録 API が叩かれている",
    ).toBe(0);
  });

  // ★誤検知の側も 1 本で見る。「出ること」だけを確かめると「常に出る」状態と区別できない。
  test("ゴミ箱に同じものが無ければ、ダイアログは出ない", async ({ page }) => {
    const createCount = countCreateRequests(page);
    await buildRecipe(page);

    await Promise.all([
      page.waitForResponse(
        (r) => r.url().endsWith("/api/combos") && r.request().method() === "POST",
      ),
      page.getByRole("button", { name: "保存" }).click(),
    ]);

    // ★保存が通っている＝ダイアログで止まっていない。
    expect(createCount()).toBe(1);
    await expect(page.getByTestId("pre-save-duplicate-dialog")).toHaveCount(0);

    // 後片付けのため id を拾う(URL 遷移後に取れる)。
    const m = page.url().match(/\/combos\/(\d+)$/);
    if (m) createdComboIDs.push(Number(m[1]));
  });
});

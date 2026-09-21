import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import { minimalDraftSteps } from "./support/draft-combo";

// M19-07 追補: セットプレイ登録画面(/combos/:comboId/setups/new)での「確認できた条件」の入力。
//
// この面は URL に comboId があり親コンボが確定しているため、DES-005 §5.6 の
// 「保存 UI を置ける面の原則(v3)」を満たす。記録は POST /api/combos/{comboId}/setups の
// verifiedConditions として、セットプレイ作成と同一トランザクションで書かれる。
//
// ★編集画面(/setups/:setupId)には出さない —— 親が複数あり得るため「実装しない」
// (開発者判断 2026-07-28・DES-005 §5.6)。両ルートは同一コンポーネントなので、
// 分岐を誤ると即座に違反する。本 spec の B がそのガードである。

const FIELD = "setup-editor-confirmed";

// セルの checkbox は sr-only で、利用者が押すのは見た目を持つ label のほうである。
// 実際の操作に合わせて label をクリックし、状態は input 側で確認する。
const cellInput = (page: Page, key: string) => page.getByTestId(`${FIELD}-${key}`);
const cellLabel = (page: Page, key: string) => cellInput(page, key).locator("xpath=..");

async function ryuCharacterId(page: Page): Promise<number> {
  const res = await page.request.get("/api/games/1/characters");
  expect(res.ok()).toBeTruthy();
  const chars = (await res.json()).items as Array<{ id: number; code: string }>;
  const ryu = chars.find((c) => c.code === "ryu");
  if (!ryu) throw new Error("seed に ryu が見つからない(配布クリーン前提崩れ)");
  return ryu.id;
}

async function starterMoveId(request: APIRequestContext, characterId: number): Promise<number> {
  const res = await request.get(`/api/moves?character_id=${characterId}`);
  expect(res.ok()).toBeTruthy();
  const moves = (await res.json()).items as Array<{ id: number; code: string }>;
  const m = moves.find((x) => x.code === "standing_light_punch") ?? moves[0];
  return m.id;
}

async function createCombo(page: Page, characterId: number, memo: string): Promise<number> {
  const res = await page.request.post("/api/combos", {
    // ★M24-13: 仮登録でもレシピのステップ 1 本以上が要る(VAL-C09)。
    data: {
      characterId,
      isDraft: true,
      knockdownAdvantage: 40,
      memo,
      steps: minimalDraftSteps(),
    },
  });
  expect(res.ok(), `combo 作成失敗: ${res.status()} ${await res.text()}`).toBeTruthy();
  return (await res.json()).id as number;
}

// resultsOf はコンボ詳細レスポンスから指定 setup の成立条件を取り出す(同梱＝M19-03 §4.3.1)。
async function resultsOf(
  request: APIRequestContext,
  comboId: number,
): Promise<Array<{ techType: string; inCorner: boolean; result: string }>> {
  const res = await request.get(`/api/combos/${comboId}`);
  expect(res.ok()).toBeTruthy();
  const combo = await res.json();
  const setup = (combo.setups ?? [])[0];
  return setup?.results ?? [];
}

test.describe("M19-07 セットプレイ登録画面の成立条件", () => {
  test.beforeEach(async ({ page }) => {
    const res = await page.request.put("/api/config", { data: {} });
    expect(res.ok(), `config 初期化失敗: ${res.status()} ${await res.text()}`).toBeTruthy();
  });

  test("A: 登録画面で 2×2 にチェック → 保存 → チェックしたセルだけが成立で記録される", async ({
    page,
  }) => {
    const characterId = await ryuCharacterId(page);
    const comboId = await createCombo(page, characterId, `e2e-m19-07-a-${Date.now()}`);
    const move = await starterMoveId(page.request, characterId);

    await page.goto(`/combos/${comboId}/setups/new`);

    // 2×2 グリッドが出ており、既定は全セル未チェック。
    await expect(page.getByTestId(FIELD)).toBeVisible();
    for (const key of [
      "neutral_tech:false",
      "neutral_tech:true",
      "back_tech:false",
      "back_tech:true",
    ]) {
      await expect(cellInput(page, key)).not.toBeChecked();
    }

    // 名前(必須)とレシピ(VAL-S02)を入れる。
    await page.getByPlaceholder("セットプレイ名").fill(`e2e-m19-07-${Date.now()}`);
    await page.getByTestId("recipe-pulldown-toggle").click();
    await page.getByTestId("recipe-move-select").selectOption(String(move));
    await page.getByTestId("recipe-add-step").click();

    // 対角 2 セルだけチェックする(片方の軸に広く当てる誤りを検出できる組)。
    await cellLabel(page, "neutral_tech:false").click();
    await cellLabel(page, "back_tech:true").click();
    await expect(cellInput(page, "neutral_tech:false")).toBeChecked();
    await expect(cellInput(page, "back_tech:true")).toBeChecked();
    await expect(cellInput(page, "neutral_tech:true")).not.toBeChecked();

    await page.getByRole("button", { name: "保存" }).click();
    await page.waitForURL(`**/combos/${comboId}`);

    // ★渡したセルと渡さなかったセルを対で確認する。
    const results = await resultsOf(page.request, comboId);
    const key = (r: { techType: string; inCorner: boolean }) => `${r.techType}:${r.inCorner}`;
    expect(results.map(key).sort()).toEqual(["back_tech:true", "neutral_tech:false"]);
    // 記録されるのは成立(ok)のみ。
    expect(results.every((r) => r.result === "ok")).toBeTruthy();

    // コンボ詳細のグリッドにも反映されている。
    await expect(page.getByTestId("setup-result-grid")).toBeVisible();
    await expect(page.getByTestId("setup-result-cell-neutral_tech:false")).toHaveAttribute(
      "data-state",
      "ok",
    );
    await expect(page.getByTestId("setup-result-cell-back_tech:false")).toHaveAttribute(
      "data-state",
      "unverified",
    );
  });

  test("B: ★編集画面(/setups/:id)には成立条件の入力が無い", async ({ page }) => {
    const characterId = await ryuCharacterId(page);
    const comboId = await createCombo(page, characterId, `e2e-m19-07-b-${Date.now()}`);
    const move = await starterMoveId(page.request, characterId);
    const created = await page.request.post(`/api/combos/${comboId}/setups`, {
      data: { characterId, name: "e2e-m19-07-b-setup", steps: [{ moveId: move }] },
    });
    expect(created.ok()).toBeTruthy();
    const setupId = (await created.json()).id as number;

    await page.goto(`/setups/${setupId}`);
    // 登録画面と同一コンポーネントだが、編集モードでは出さない。
    await expect(page.getByTestId(FIELD)).toHaveCount(0);
  });

  test("C: チェックせずに登録できる(既定は未検証)", async ({ page }) => {
    const characterId = await ryuCharacterId(page);
    const comboId = await createCombo(page, characterId, `e2e-m19-07-c-${Date.now()}`);
    const move = await starterMoveId(page.request, characterId);

    await page.goto(`/combos/${comboId}/setups/new`);
    await page.getByPlaceholder("セットプレイ名").fill(`e2e-m19-07-c-${Date.now()}`);
    await page.getByTestId("recipe-pulldown-toggle").click();
    await page.getByTestId("recipe-move-select").selectOption(String(move));
    await page.getByTestId("recipe-add-step").click();
    await page.getByRole("button", { name: "保存" }).click();
    await page.waitForURL(`**/combos/${comboId}`);

    // 行が 1 つも入らない = 未検証は行の有無で表現する。
    expect(await resultsOf(page.request, comboId)).toEqual([]);
    // 全セル未検証ならグリッド自体を出さない(hidden-when-empty)。
    await expect(page.getByTestId("setup-result-grid")).toHaveCount(0);
  });
});

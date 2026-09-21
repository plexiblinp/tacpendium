import { test, expect, type Page } from "@playwright/test";
import { minimalDraftSteps } from "./support/draft-combo";

// M19-02: セットプレイ自動提案テコ入れ(filler 是正・打ち切り是正・gap・負 KA)の E2E。
// 前提: ウィザード完了済みの E2E 環境。使い捨て DB は ryu を seed 済み。
// 提案 UI は ComboDetailPage に相乗り(M19-01 と同一の載せ先。採用挙動は不変)。

async function ryuCharacterId(page: Page): Promise<number> {
  const res = await page.request.get("/api/games/1/characters");
  expect(res.ok()).toBeTruthy();
  const chars = (await res.json()).items as Array<{ id: number; code: string }>;
  const ryu = chars.find((c) => c.code === "ryu");
  if (!ryu) throw new Error("seed に ryu が見つからない(配布クリーン前提崩れ)");
  return ryu.id;
}

async function createCombo(
  page: Page,
  characterId: number,
  ka: number | null,
  memo: string,
): Promise<number> {
  // ★M24-13: 仮登録でもレシピのステップ 1 本以上が要る(VAL-C09)。
  const data: Record<string, unknown> = {
    characterId,
    isDraft: true,
    memo,
    steps: minimalDraftSteps(),
  };
  if (ka != null) data.knockdownAdvantage = ka;
  const res = await page.request.post("/api/combos", { data });
  expect(res.ok(), `combo 作成失敗: ${res.status()} ${await res.text()}`).toBeTruthy();
  return (await res.json()).id as number;
}

test.describe("M19-02 セットプレイ提案テコ入れ", () => {
  test.beforeEach(async ({ page }) => {
    const res = await page.request.put("/api/config", { data: {} });
    expect(res.ok(), `config 初期化失敗: ${res.status()} ${await res.text()}`).toBeTruthy();
  });

  // A: 提案 → 「さらに表示」で件数が増える → 1 件採用 → 保存(採用挙動は M19-01 のまま不変)。
  test("A: さらに表示で件数が増え、採用で保存できる", async ({ page }) => {
    const characterId = await ryuCharacterId(page);
    const comboId = await createCombo(page, characterId, 40, `e2e-m19-02-a-${Date.now()}`);
    await page.goto(`/combos/${comboId}`);
    await expect(page.getByTestId("setplay-section")).toBeVisible();

    // 候補が 200 を超える条件(全種別 ON)にして「提案を出す」(実データで打ち切りが起きる帯)。
    for (const type of ["special", "throw", "normal_rush", "unique_rush"]) {
      await page.getByTestId(`setplay-type-${type}`).check();
    }
    await page.getByTestId("setplay-generate").click();

    // 件数表示が出て、さらに表示が出る(totalFound > 既定 limit)。
    await expect(page.getByTestId("setplay-count")).toBeVisible();
    const showMore = page.getByTestId("setplay-show-more");
    await expect(showMore).toBeVisible();
    const before = await page.getByTestId("setplay-row").count();
    await showMore.click();
    await expect
      .poll(async () => page.getByTestId("setplay-row").count())
      .toBeGreaterThan(before);

    // 未採用の 1 件を採用 → 保存(M19-01 と同じ導線)。
    await page.getByTestId("setplay-adopt").first().click();
    await page.getByLabel("セットプレイ名").fill(`e2e-a-${Date.now()}`);
    await page.getByTestId("setplay-adopt-save").click();
    await expect(page.getByTestId("setplay-adopted").first()).toBeVisible();

    const comboRes = await page.request.get(`/api/combos/${comboId}`);
    const combo = await comboRes.json();
    expect((combo.setups ?? []).length).toBeGreaterThanOrEqual(1);
  });

  // B: 負 KA のコンボ → 専用文言が出て提案 0 件 → 既存 FR011 候補 API は従来どおり動く。
  test("B: 負 KA は専用文言で 0 件、FR011 候補は不変", async ({ page }) => {
    const characterId = await ryuCharacterId(page);
    const comboId = await createCombo(page, characterId, -5, `e2e-m19-02-b-${Date.now()}`);
    await page.goto(`/combos/${comboId}`);

    await page.getByTestId("setplay-generate").click();
    await expect(page.getByTestId("setplay-negative-knockdown")).toBeVisible();
    await expect(page.getByTestId("setplay-row")).toHaveCount(0);
    // KA NULL 用の文言は出ない(区別されている)。
    await expect(page.getByTestId("setplay-no-knockdown")).toHaveCount(0);

    // 負 KA でも提案 API は 200 + 専用理由コードで返る。
    const sugRes = await page.request.get(`/api/combos/${comboId}/setplay-suggestions`);
    expect(sugRes.status()).toBe(200);
    const sug = await sugRes.json();
    expect(sug.reason).toBe("knockdown_advantage_negative");
    expect(sug.items.length).toBe(0);

    // 既存 FR011 候補 API は従来どおり応答する(非破壊)。
    const cand = await page.request.get(`/api/combos/${comboId}/setup-candidates`);
    expect(cand.ok()).toBeTruthy();
  });

  // C: モードを「あえて重ねない」に切替 → 提案が出て各行に G が表示 → 1 件採用 → 保存。
  test("C: gap モードで G 表示・採用保存", async ({ page }) => {
    const characterId = await ryuCharacterId(page);
    const comboId = await createCombo(page, characterId, 40, `e2e-m19-02-c-${Date.now()}`);
    await page.goto(`/combos/${comboId}`);

    await page.getByTestId("setplay-mode-gap").click();
    await expect(page.getByTestId("setplay-gap-range")).toBeVisible();
    await page.getByTestId("setplay-generate").click();

    await expect(page.getByTestId("setplay-row").first()).toBeVisible();
    // gap 行のフレーム表記は「起き上がりの…後」(G 表示)。
    await expect(page.getByTestId("setplay-frame-label").first()).toContainText("起き上がり");

    await page.getByTestId("setplay-adopt").first().click();
    await page.getByLabel("セットプレイ名").fill(`e2e-c-${Date.now()}`);
    await page.getByTestId("setplay-adopt-save").click();
    await expect(page.getByTestId("setplay-adopted").first()).toBeVisible();
  });

  // E: 最大持続(n_max)で候補が減る。持続の長い技の深い N を切り落とす(§06)。
  test("E: n_max で候補件数が減る", async ({ page }) => {
    const characterId = await ryuCharacterId(page);
    const comboId = await createCombo(page, characterId, 40, `e2e-m19-02-e-${Date.now()}`);
    await page.goto(`/combos/${comboId}`);

    // 候補が多い条件(全種別 ON)で総数を得る。
    for (const type of ["special", "throw", "normal_rush", "unique_rush"]) {
      await page.getByTestId(`setplay-type-${type}`).check();
    }
    await page.getByTestId("setplay-generate").click();
    await expect(page.getByTestId("setplay-count")).toBeVisible();
    const totalOf = async (): Promise<number> => {
      const txt = (await page.getByTestId("setplay-count").textContent()) ?? "";
      const m = txt.match(/\d[\d,]*/); // 「全N件中…」の最初の数値 = totalFound
      return m ? Number(m[0].replace(/,/g, "")) : 0;
    };
    const before = await totalOf();
    expect(before).toBeGreaterThan(0);

    // 最大持続を 2 に絞って再取得 → 総数が減る。
    await page.getByTestId("setplay-n-max").fill("2");
    await page.getByTestId("setplay-generate").click();
    await expect
      .poll(async () => totalOf())
      .toBeLessThan(before);
    // それでも候補は残る(深い N を切っただけ)。
    await expect(page.getByTestId("setplay-row").first()).toBeVisible();
  });

  // D: 提案 1 件を採用 → 同じ行が alreadyAdopted で採用済み表示になり再採用が抑止される(非回帰)。
  test("D: 採用済みは再採用が抑止される", async ({ page }) => {
    const characterId = await ryuCharacterId(page);
    const comboId = await createCombo(page, characterId, 40, `e2e-m19-02-d-${Date.now()}`);
    await page.goto(`/combos/${comboId}`);

    await page.getByTestId("setplay-generate").click();
    await page.getByTestId("setplay-adopt").first().click();
    await page.getByLabel("セットプレイ名").fill(`e2e-d-${Date.now()}`);
    await page.getByTestId("setplay-adopt-save").click();

    // 採用後、いずれかの行が「採用済み」になる。
    await expect(page.getByTestId("setplay-adopted").first()).toBeVisible();

    // 再検索しても同一レシピは採用済み表示(再採用抑止)。
    await page.getByTestId("setplay-generate").click();
    await expect(page.getByTestId("setplay-adopted").first()).toBeVisible();
  });
});

import { test, expect, type Page } from "@playwright/test";
import { minimalDraftSteps } from "./support/draft-combo";

// M19-01: セットプレイ自動提案(提案→採択→保存)の E2E。
// 前提: ウィザード完了済みのローカル/E2E 環境(未完了だと /wizard へリダイレクト)。
// E2E 使い捨て DB は seed 済み(ryu の 立ち弱K total=18 / 鎖骨割り startup=20 active=4 を含む)。
// 提案 UI は ComboDetailPage に相乗り(§4.6.1、開発者確認済みの載せ先)。

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

test.describe("M19-01 セットプレイ自動提案", () => {
  // E2E 使い捨て DB は config.toml 未作成=未初期化のため /wizard へリダイレクトされる。
  // ウィザード相当(PUT /api/config)で初期化し、UI 遷移を可能にする(config.toml は gitignore)。
  test.beforeEach(async ({ page }) => {
    const res = await page.request.put("/api/config", { data: {} });
    expect(res.ok(), `config 初期化失敗: ${res.status()} ${await res.text()}`).toBeTruthy();
  });

  // シナリオ A: KA を持つコンボ → 提案 → N_min 変更で絞り込み → 1 件採択 → 保存。
  test("A: 提案表示 → N_min 絞り込み → 採択保存", async ({ page }) => {
    const characterId = await ryuCharacterId(page);
    const comboId = await createCombo(page, characterId, 40, `e2e-m19-a-${Date.now()}`);

    await page.goto(`/combos/${comboId}`);

    const section = page.getByTestId("setplay-section");
    await expect(section).toBeVisible();

    // #1: 条件を指定して「提案を出す」を押すまで候補は出ない。
    await expect(page.getByTestId("setplay-row")).toHaveCount(0);
    await page.getByTestId("setplay-generate").click();

    // 提案が 1 件以上(鎖骨割り=特殊技は既定 ON)。
    await expect(page.getByTestId("setplay-row").first()).toBeVisible();
    const before = await page.getByTestId("setplay-row").count();
    expect(before).toBeGreaterThan(0);

    // N_min を 3 に上げて再生成 → 候補は増えない(N<3 が落ちる)。
    await page.getByLabel("最小持続").fill("3");
    await page.getByTestId("setplay-generate").click();
    await expect
      .poll(async () => page.getByTestId("setplay-row").count())
      .toBeLessThanOrEqual(before);

    // N_min を 1 に戻して再生成。
    await page.getByLabel("最小持続").fill("1");
    await page.getByTestId("setplay-generate").click();
    await expect(page.getByTestId("setplay-row").first()).toBeVisible();

    // 未採択の 1 件を採択 → 名前欄 → 保存。
    const adoptBtn = page.getByTestId("setplay-adopt").first();
    await adoptBtn.click();
    await page.getByLabel("セットプレイ名").fill(`e2e-adopt-${Date.now()}`);
    await page.getByTestId("setplay-adopt-save").click();

    // 採択後、いずれかの行が「採択済み」になる。
    await expect(page.getByTestId("setplay-adopted").first()).toBeVisible();

    // 保存されたセットプレイがコンボに紐付いたことを API で確認。
    const setupsRes = await page.request.get(`/api/combos/${comboId}/setup-candidates`);
    expect(setupsRes.ok()).toBeTruthy();
    // コンボ本体の setups に 1 件以上(採択で作成+紐付け)。
    const comboRes = await page.request.get(`/api/combos/${comboId}`);
    const combo = await comboRes.json();
    expect((combo.setups ?? []).length).toBeGreaterThanOrEqual(1);
  });

  // シナリオ B: KA が NULL のコンボ → 提案セクションは理由のみ・既存表示は不変。
  test("B: KA NULL は提案を出さず理由を表示", async ({ page }) => {
    const characterId = await ryuCharacterId(page);
    const comboId = await createCombo(page, characterId, null, `e2e-m19-b-${Date.now()}`);

    await page.goto(`/combos/${comboId}`);

    await expect(page.getByTestId("setplay-no-knockdown")).toBeVisible();
    await expect(page.getByTestId("setplay-row")).toHaveCount(0);
  });

  // シナリオ C: 採択済みレシピの再採択が VAL-S04(ERROR)で拒否される(UI は事前抑止)。
  test("C: 同一レシピの再採択は VAL-S04 で拒否される", async ({ page }) => {
    const characterId = await ryuCharacterId(page);
    const comboId = await createCombo(page, characterId, 40, `e2e-m19-c-${Date.now()}`);

    // 提案 API から 1 件取得し、その steps でセットプレイを作成する。
    const sugRes = await page.request.get(`/api/combos/${comboId}/setplay-suggestions?n_min=1`);
    expect(sugRes.ok()).toBeTruthy();
    const sug = await sugRes.json();
    expect(sug.items.length).toBeGreaterThan(0);
    const steps = (sug.items[0].steps as Array<{ moveId: number }>).map((s) => ({
      moveId: s.moveId,
    }));

    // 1 回目: 成功。
    const first = await page.request.post(`/api/combos/${comboId}/setups`, {
      data: { characterId, name: "e2e-c-setup", steps },
    });
    expect(first.ok(), `1回目採択が失敗: ${first.status()}`).toBeTruthy();

    // 2 回目: 同一レシピ → VAL-S04(409)。
    const second = await page.request.post(`/api/combos/${comboId}/setups`, {
      data: { characterId, name: "e2e-c-setup-dup", steps },
    });
    expect(second.status()).toBe(409);

    // 詳細を開いて提案を出すと、その提案行は alreadyAdopted で「採択済み」表示になる。
    await page.goto(`/combos/${comboId}`);
    await page.getByTestId("setplay-generate").click();
    await expect(page.getByTestId("setplay-adopted").first()).toBeVisible();
  });
});

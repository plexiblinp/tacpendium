import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import { minimalDraftSteps } from "./support/draft-combo";

// M19-03: セットプレイ成立条件の記録(受け身種別 × 画面端 の 2×2)の E2E。
//
// 前提: ウィザード完了済みの E2E 環境(未完了だと /wizard へリダイレクト)。
// 表示・編集導線はコンボ詳細(DES-005 §5.6 項目10)。セットプレイ編集画面には無い
// —— あの画面は setup 単位で comboId を持たず保存先の行を特定できないため(§4.4.1)。

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

// createSetup は API 経由でセットプレイを 1 本作り、コンボへ紐付ける。
async function createSetup(
  page: Page,
  comboId: number,
  characterId: number,
  name: string,
): Promise<number> {
  const move = await starterMoveId(page.request, characterId);
  const res = await page.request.post(`/api/combos/${comboId}/setups`, {
    data: { characterId, name, steps: [{ moveId: move }] },
  });
  expect(res.ok(), `setup 作成失敗: ${res.status()} ${await res.text()}`).toBeTruthy();
  return (await res.json()).id as number;
}

// resultsOf はコンボ詳細レスポンスから指定 setup の成立条件を取り出す(同梱＝§4.3.1)。
async function resultsOf(
  request: APIRequestContext,
  comboId: number,
  setupId: number,
): Promise<Array<{ techType: string; inCorner: boolean; result: string; note?: string }>> {
  const res = await request.get(`/api/combos/${comboId}`);
  expect(res.ok()).toBeTruthy();
  const combo = await res.json();
  const setup = (combo.setups ?? []).find((s: { id: number }) => s.id === setupId);
  return setup?.results ?? [];
}

test.describe("M19-03 セットプレイ成立条件の記録", () => {
  test.beforeEach(async ({ page }) => {
    const res = await page.request.put("/api/config", { data: {} });
    expect(res.ok(), `config 初期化失敗: ${res.status()} ${await res.text()}`).toBeTruthy();
  });

  // シナリオ A: 項目10 で成立条件を編集 → 再読込して保持されている。
  test("A: コンボ詳細で成立条件を編集 → 再読込で保持される", async ({ page }) => {
    const characterId = await ryuCharacterId(page);
    const comboId = await createCombo(page, characterId, 40, `e2e-m19-03-a-${Date.now()}`);
    const setupId = await createSetup(page, comboId, characterId, "e2e-a-setup");

    await page.goto(`/combos/${comboId}`);

    // 全 4 セル未検証なので、まだグリッドは出ていない(hidden-when-empty＝シナリオ E)。
    await expect(page.getByTestId("setup-result-grid")).toHaveCount(0);

    // 編集導線を開く。
    await page.getByTestId("setup-result-edit-toggle").click();
    await expect(page.getByTestId("setup-result-editor")).toBeVisible();

    // その場受け身(中央) = 成立。セルを選んでから状態を 1 クリックで指定する
    // (セル選択では状態は変わらない)。
    await page.getByTestId("setup-result-cell-select-neutral_tech:false").click();
    await expect(
      page.getByTestId("setup-result-cell-select-neutral_tech:false"),
    ).toHaveAttribute("data-state", "unverified");
    await page.getByTestId("setup-result-state-ok").click();
    await expect(
      page.getByTestId("setup-result-cell-select-neutral_tech:false"),
    ).toHaveAttribute("data-state", "ok");

    // 後ろ受け身(中央) = 不成立。**1 クリックで直接指定できる**(巡回不要)。
    await page.getByTestId("setup-result-cell-select-back_tech:false").click();
    await page.getByTestId("setup-result-state-ng").click();
    await expect(
      page.getByTestId("setup-result-cell-select-back_tech:false"),
    ).toHaveAttribute("data-state", "ng");

    // 不成立のセルに note を書く。
    await page.getByTestId("setup-result-note-input").fill("後ろ受け身では距離が足りない");
    await page.getByTestId("setup-result-note-save").click();

    // ★再読込しても保持されている。
    await page.reload();
    await expect(page.getByTestId("setup-result-grid")).toBeVisible();
    await expect(page.getByTestId("setup-result-cell-neutral_tech:false")).toHaveAttribute(
      "data-state",
      "ok",
    );
    await expect(page.getByTestId("setup-result-cell-back_tech:false")).toHaveAttribute(
      "data-state",
      "ng",
    );
    // 未検証のセルは未検証のまま(勝手に埋まらない)。
    await expect(page.getByTestId("setup-result-cell-neutral_tech:true")).toHaveAttribute(
      "data-state",
      "unverified",
    );

    // API 上も 2 行だけで、result に NULL は無い。
    const results = await resultsOf(page.request, comboId, setupId);
    expect(results.length).toBe(2);
    for (const r of results) {
      expect(["ok", "ng"]).toContain(r.result);
    }
    expect(results.find((r) => r.techType === "back_tech")?.note).toBe(
      "後ろ受け身では距離が足りない",
    );

    // 未検証へ戻せる(行の物理削除)。ここも 1 クリック。
    await page.getByTestId("setup-result-edit-toggle").click();
    await page.getByTestId("setup-result-cell-select-neutral_tech:false").click();
    await page.getByTestId("setup-result-state-unverified").click();
    await expect(
      page.getByTestId("setup-result-cell-select-neutral_tech:false"),
    ).toHaveAttribute("data-state", "unverified");

    const after = await resultsOf(page.request, comboId, setupId);
    expect(after.length).toBe(1);
    expect(after[0].techType).toBe("back_tech");

    // ★未検証へ戻してもメモは画面に残る(保存はされない旨の注記が出る)。
    await page.getByTestId("setup-result-cell-select-back_tech:false").click();
    await expect(page.getByTestId("setup-result-note-input")).toHaveValue(
      "後ろ受け身では距離が足りない",
    );
    await page.getByTestId("setup-result-state-unverified").click();
    await expect(page.getByTestId("setup-result-note-input")).toHaveValue(
      "後ろ受け身では距離が足りない",
    );
    await expect(page.getByTestId("setup-result-note-unsaved-hint")).toBeVisible();
  });

  // シナリオ B: 提案から採用(条件を 1 つチェック) → 項目10 に成立として出る。
  test("B: 提案から採用 → チェックした条件が項目10 に成立として表示される", async ({ page }) => {
    const characterId = await ryuCharacterId(page);
    const comboId = await createCombo(page, characterId, 40, `e2e-m19-03-b-${Date.now()}`);

    await page.goto(`/combos/${comboId}`);
    await page.getByTestId("setplay-generate").click();
    await expect(page.getByTestId("setplay-row").first()).toBeVisible();

    await page.getByTestId("setplay-adopt").first().click();
    await expect(page.getByTestId("setplay-confirmed-conditions")).toBeVisible();

    // 既定は全て未チェック。
    for (const key of [
      "neutral_tech:false",
      "neutral_tech:true",
      "back_tech:false",
      "back_tech:true",
    ]) {
      await expect(page.getByTestId(`setplay-confirmed-${key}`)).not.toBeChecked();
    }

    // 1 つだけチェックして採用。
    // M19-07 追補で 2×2 グリッド化し checkbox は sr-only になったため、
    // 利用者と同じく見た目を持つ label 側をクリックする(状態は input 側で確認する)。
    await page.getByTestId("setplay-confirmed-neutral_tech:true").locator("xpath=..").click();
    await expect(page.getByTestId("setplay-confirmed-neutral_tech:true")).toBeChecked();
    await page.getByTestId("setplay-adopt-save").click();

    // 項目10 にその条件が成立として出る。
    await expect(page.getByTestId("setup-result-grid").first()).toBeVisible();
    await expect(
      page.getByTestId("setup-result-cell-neutral_tech:true").first(),
    ).toHaveAttribute("data-state", "ok");
    // チェックしていないセルは未検証のまま。
    await expect(
      page.getByTestId("setup-result-cell-back_tech:false").first(),
    ).toHaveAttribute("data-state", "unverified");

    // 記録されるのは成立(ok)のみ。
    const detail = await (await page.request.get(`/api/combos/${comboId}`)).json();
    const setup = (detail.setups ?? [])[0];
    expect(setup, "採用でセットプレイが作られていない").toBeTruthy();
    expect((setup.results ?? []).length).toBe(1);
    expect(setup.results[0].result).toBe("ok");
  });

  // シナリオ B2: チェックせずに採用できる(§4.5)。
  test("B2: 「確認できた条件」を 1 つもチェックせずに採用できる", async ({ page }) => {
    const characterId = await ryuCharacterId(page);
    const comboId = await createCombo(page, characterId, 40, `e2e-m19-03-b2-${Date.now()}`);

    await page.goto(`/combos/${comboId}`);
    await page.getByTestId("setplay-generate").click();
    await expect(page.getByTestId("setplay-row").first()).toBeVisible();
    await page.getByTestId("setplay-adopt").first().click();
    await page.getByTestId("setplay-adopt-save").click();

    // セットプレイは作られ、結果行は 0 行(＝全 4 セル未検証でグリッドも出ない)。
    const detail = await (await page.request.get(`/api/combos/${comboId}`)).json();
    expect((detail.setups ?? []).length).toBeGreaterThanOrEqual(1);
    expect((detail.setups[0].results ?? []).length).toBe(0);
    await expect(page.getByTestId("setup-result-grid")).toHaveCount(0);
  });

  // ★シナリオ C: 識別キー変更編集で成立条件が引き継がれる(§4.2・必須)。
  test("C: 識別キー変更編集で成立条件が引き継がれる", async ({ page }) => {
    const request = page.request;
    const characterId = await ryuCharacterId(page);
    const starter = await starterMoveId(request, characterId);

    // 識別キーを持つコンボを作る(PUT で position を変えられるよう本登録相当の形にする)。
    const createRes = await request.post("/api/combos", {
      data: {
        characterId,
        isDraft: true,
        memo: `e2e-m19-03-c-${Date.now()}`,
        knockdownAdvantage: 40,
        position: "mid_screen",
        opponentStance: "standing",
        hitType: "normal",
        opponentSize: "standard",
        starterMoveId: starter,
        steps: [{ stepOrder: 1, moveId: starter }],
      },
    });
    expect(createRes.ok(), await createRes.text()).toBeTruthy();
    const created = await createRes.json();
    const oldId = created.id as number;
    const version = created.version as number;

    const setupId = await createSetup(page, oldId, characterId, "e2e-c-setup");

    // 成立条件を 2 セル記録する(note 付き)。
    const put1 = await request.put(`/api/combos/${oldId}/setups/${setupId}/results`, {
      data: { techType: "neutral_tech", inCorner: false, result: "ok" },
    });
    expect(put1.ok(), await put1.text()).toBeTruthy();
    const put2 = await request.put(`/api/combos/${oldId}/setups/${setupId}/results`, {
      data: { techType: "back_tech", inCorner: true, result: "ng", note: "端では届かない" },
    });
    expect(put2.ok(), await put2.text()).toBeTruthy();
    expect((await resultsOf(request, oldId, setupId)).length).toBe(2);

    // 識別キー変更(position 変更)を伴う編集 = 旧を論理削除して新コンボを作る経路。
    const putRes = await request.put(`/api/combos/${oldId}`, {
      data: {
        version,
        characterId,
        isDraft: true,
        knockdownAdvantage: 40,
        position: "corner_self",
        opponentStance: "standing",
        hitType: "normal",
        opponentSize: "standard",
        starterMoveId: starter,
        steps: [{ stepOrder: 1, moveId: starter }],
        setupCarryOptions: { mode: "carry_all" },
      },
    });
    expect(putRes.ok(), await putRes.text()).toBeTruthy();
    const newId = (await putRes.json()).id as number;
    expect(newId).not.toBe(oldId);

    // ★成立条件が新コンボ側で引ける(編集しただけで消えていない)。
    const carried = await resultsOf(request, newId, setupId);
    expect(carried.length, "識別キー変更編集で成立条件が失われている(§4.2 未達)").toBe(2);
    expect(carried.find((r) => r.techType === "back_tech")?.result).toBe("ng");
    expect(carried.find((r) => r.techType === "back_tech")?.note).toBe("端では届かない");

    // 画面でも新コンボ側に出る。
    await page.goto(`/combos/${newId}`);
    await expect(page.getByTestId("setup-result-grid").first()).toBeVisible();
    await expect(
      page.getByTestId("setup-result-cell-back_tech:true").first(),
    ).toHaveAttribute("data-state", "ng");
  });

  // シナリオ D: 紐付け解除 → 結果行が消える。
  test("D: 紐付け解除で成立条件の行が消える", async ({ page }) => {
    const request = page.request;
    const characterId = await ryuCharacterId(page);
    const comboId = await createCombo(page, characterId, 40, `e2e-m19-03-d-${Date.now()}`);
    const setupId = await createSetup(page, comboId, characterId, "e2e-d-setup");

    const put = await request.put(`/api/combos/${comboId}/setups/${setupId}/results`, {
      data: { techType: "neutral_tech", inCorner: false, result: "ok" },
    });
    expect(put.ok()).toBeTruthy();
    expect((await resultsOf(request, comboId, setupId)).length).toBe(1);

    const unlink = await request.delete(`/api/combos/${comboId}/setup-links/${setupId}`);
    expect(unlink.ok(), await unlink.text()).toBeTruthy();

    // 紐付けごと消えるので、詳細にセットプレイも結果も残らない。
    const detail = await (await request.get(`/api/combos/${comboId}`)).json();
    expect((detail.setups ?? []).length).toBe(0);

    // 再度同じセットプレイを紐付け直しても、以前の結果は復活しない(孤児が残っていない)。
    const relink = await request.post(`/api/combos/${comboId}/setup-links`, {
      data: { setupId },
    });
    expect(relink.ok(), await relink.text()).toBeTruthy();
    expect(
      (await resultsOf(request, comboId, setupId)).length,
      "解除時に消えず孤児として残っていた成立条件が復活している",
    ).toBe(0);
  });

  // シナリオ E: 全セル未検証のセットプレイではグリッドが表示されない。
  test("E: 全 4 セル未検証ならグリッドを表示しない(hidden-when-empty)", async ({ page }) => {
    const characterId = await ryuCharacterId(page);
    const comboId = await createCombo(page, characterId, 40, `e2e-m19-03-e-${Date.now()}`);
    const setupId = await createSetup(page, comboId, characterId, "e2e-e-setup");

    await page.goto(`/combos/${comboId}`);
    // セットプレイ行自体は出る(既存の項目10 の挙動は不変)。
    await expect(page.getByText("e2e-e-setup")).toBeVisible();
    await expect(page.getByText("紐付け解除")).toBeVisible();
    // グリッドだけが出ない。
    await expect(page.getByTestId("setup-result-grid")).toHaveCount(0);

    // 1 セル記録すると出るようになる。
    const put = await page.request.put(`/api/combos/${comboId}/setups/${setupId}/results`, {
      data: { techType: "back_tech", inCorner: true, result: "ng" },
    });
    expect(put.ok()).toBeTruthy();
    await page.reload();
    await expect(page.getByTestId("setup-result-grid")).toBeVisible();
  });

  // §4.4.1: セットプレイ編集画面(/setups/:id)には成立条件 UI が無い。
  //
  // ★根拠は「画面名による禁止」ではない(それは撤回された v1 の書き方であり、
  // DES-005 §5.6 の撤回表に記録が残っている)。現行の根拠は次の 2 点:
  //   (1) v3 原則 = 保存 UI を置く面は、保存先の親が確定しているか、親と同一
  //       トランザクションでコミットできること。この画面は親コンボが複数あり得るため
  //       保存先が確定しない。
  //   (2) 確定させれば実装は可能だが「実装しない」= 開発者判断 2026-07-28
  //       (DES-005 §5.6 の v3 判定表)。
  // ★同じコンボエディタ上でも、親と同一 Tx でコミットできる面(コンボ新規登録の
  // 同梱セットプレイ = M19-07)は v3 で ○ である。画面名で判定しないこと。
  test("F: セットプレイ編集画面には成立条件 UI が無い", async ({ page }) => {
    const characterId = await ryuCharacterId(page);
    const comboId = await createCombo(page, characterId, 40, `e2e-m19-03-f-${Date.now()}`);
    const setupId = await createSetup(page, comboId, characterId, "e2e-f-setup");
    const put = await page.request.put(`/api/combos/${comboId}/setups/${setupId}/results`, {
      data: { techType: "neutral_tech", inCorner: false, result: "ok" },
    });
    expect(put.ok()).toBeTruthy();

    await page.goto(`/setups/${setupId}`);
    await expect(page.getByTestId("setup-result-grid")).toHaveCount(0);
    await expect(page.getByTestId("setup-result-editor")).toHaveCount(0);
    await expect(page.getByTestId("setup-result-edit-toggle")).toHaveCount(0);
  });

  // 値域外・紐付け不在は API で弾かれる(多層防御の実経路確認)。
  test("G: 値域外は 400、紐付け不在の組は 404", async ({ page }) => {
    const request = page.request;
    const characterId = await ryuCharacterId(page);
    const comboId = await createCombo(page, characterId, 40, `e2e-m19-03-g-${Date.now()}`);
    const setupId = await createSetup(page, comboId, characterId, "e2e-g-setup");
    const otherComboId = await createCombo(page, characterId, 40, `e2e-m19-03-g2-${Date.now()}`);

    const badTech = await request.put(`/api/combos/${comboId}/setups/${setupId}/results`, {
      data: { techType: "quick_rise", inCorner: false, result: "ok" },
    });
    expect(badTech.status()).toBe(400);

    const badResult = await request.put(`/api/combos/${comboId}/setups/${setupId}/results`, {
      data: { techType: "neutral_tech", inCorner: false, result: "unverified" },
    });
    expect(badResult.status()).toBe(400);

    const noLink = await request.put(`/api/combos/${otherComboId}/setups/${setupId}/results`, {
      data: { techType: "neutral_tech", inCorner: false, result: "ok" },
    });
    expect(noLink.status(), "紐付けが無い組への書き込みが通っている").toBe(404);
  });
});

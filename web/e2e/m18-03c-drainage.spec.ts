import { expect, test, type Page } from "@playwright/test";
import { addMinimalRecipeStep } from "./support/editor-input";

// M18-03c: M18 の入力キューを最後まで処理できることを確認する。
// A: 探すで normal を採用 → 第3セクション → materialize → 探すの孫で変換済みに畳む → PC 一覧。
// B: 自動判定できない相手技 → 新規コンボ保存 → combo_punishes 登録 → 登録済み表示。
// C: 成立ツリー → 検索キャラ/hit_type 固定 → 保存時の自動採用はしない。
// D: 第3セクションで curation → 隠したもの管理 → 解除 → 第3セクションへ復帰。
// E: 同種の永続通知は最新 1 件へ置換し、「開く」も最新生成物を指す。
// F: モバイル幅でも通常／要注意の最大 2 件に収まり、後続操作を妨げない。
//
// 決定論性は read-only の走査結果と hadoken_light の既存属性から得る。moves への書込みはしない。

type Req = import("@playwright/test").APIRequestContext;
type Char = { id: number; code: string };
type Move = {
  id: number;
  code: string;
  category: string;
  isAerial: boolean;
};
type ScanTree = {
  nodes: Array<{
    moveId: number;
    code: string;
    nameJa?: string;
    starters: Array<{ moveId: number; code: string; nameJa?: string }>;
  }>;
  manualReviewNodes: Array<{
    moveId: number;
    code: string;
    nameJa?: string;
  }>;
};
type PunishListResponse = {
  nodes: Array<{ moveId: number; combos: Array<{ comboId: number }> }>;
  unclassifiedNodes: Array<{
    moveId: number;
    combos: Array<{ comboId: number }>;
  }>;
  hiddenCurations: Array<{ comboId: number; opponentMoveId: number }>;
};

async function initialize(request: Req) {
  const cfg = await (await request.get("/api/config")).json();
  if (!cfg.isInitialized) {
    await request.put("/api/config", {
      data: {
        server: { mode: cfg.server?.mode ?? "local" },
        defaults: {
          characterId: cfg.defaults?.characterId ?? 1,
          presetId: cfg.defaults?.presetId ?? 1,
        },
      },
    });
  }
}

async function characters(request: Req): Promise<Char[]> {
  const res = await request.get("/api/games/1/characters");
  expect(res.ok(), await res.text()).toBeTruthy();
  return (await res.json()).items as Char[];
}

async function moves(request: Req, characterId: number): Promise<Move[]> {
  const res = await request.get(`/api/moves?character_id=${characterId}`);
  expect(res.ok(), await res.text()).toBeTruthy();
  return (await res.json()).items as Move[];
}

async function scan(
  request: Req,
  self: number,
  opponent: number,
  guard: "block" | "just_parry",
): Promise<ScanTree> {
  const res = await request.get(
    `/api/punish-finder?self_character_id=${self}` +
      `&opponent_character_id=${opponent}&guard_type=${guard}`,
  );
  expect(res.ok(), await res.text()).toBeTruthy();
  return (await res.json()) as ScanTree;
}

async function list(
  request: Req,
  self: number,
  guard: "block" | "just_parry" = "block",
): Promise<PunishListResponse> {
  const res = await request.get(`/api/punish-list?self=${self}&guard=${guard}`);
  expect(res.ok(), await res.text()).toBeTruthy();
  return (await res.json()) as PunishListResponse;
}

function comboIDs(
  nodes: PunishListResponse["nodes"] | PunishListResponse["unclassifiedNodes"],
) {
  return nodes.flatMap((node) => node.combos.map((combo) => combo.comboId));
}

function moveLabel(move: { code: string; nameJa?: string }) {
  return move.nameJa || move.code;
}

async function createNormalCombo(
  request: Req,
  characterId: number,
  starterMoveId: number,
  suffix: string,
): Promise<number> {
  return createCombo(request, characterId, suffix, {
    starterMoveId,
    damage: 1000,
  });
}

async function createCombo(
  request: Req,
  characterId: number,
  suffix: string,
  options: {
    starterMoveId: number;
    damage?: number;
    hitType?: "normal" | "counter";
  },
): Promise<number> {
  const res = await request.post("/api/combos", {
    data: {
      characterId,
      isDraft: true,
      hitType: options.hitType ?? "normal",
      ...(options.damage === undefined ? {} : { damage: options.damage }),
      memo: `e2e-m18-03c-${suffix}-${Date.now()}`,
      starterMoveId: options.starterMoveId,
      steps: [{ stepOrder: 1, moveId: options.starterMoveId }],
    },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  return (await res.json()).id as number;
}

async function adoptCombo(
  request: Req,
  comboId: number,
  opponentMoveId: number,
) {
  const res = await request.post("/api/combo-punishes", {
    data: { comboId, opponentMoveId },
  });
  expect(res.status(), await res.text()).toBe(204);
}

async function materializeFromList(page: Page, comboId: number) {
  const responsePromise = page.waitForResponse(
    (res) =>
      res.url().includes(`/api/combos/${comboId}/materialize`) &&
      res.request().method() === "POST",
  );
  await rowForCombo(page, comboId)
    .getByRole("button", { name: "パニッシュカウンター版を作る" })
    .click();
  const response = await responsePromise;
  expect(response.ok(), await response.text()).toBeTruthy();
  return (await response.json()) as {
    comboId: number;
    alreadyExisted: boolean;
    damageAdded: boolean;
    damageSkipReason?: string;
  };
}

// 開いて新しい子が現れるツリーにも対応して、現在の expand を先頭から順に開く。
async function expandAll(page: Page) {
  // page.goto 直後は React Query の読み込み中で 0 件に見えるため、最初のノードを待つ。
  await expect(page.getByLabel("expand").first()).toBeVisible({
    timeout: 15_000,
  });
  for (let i = 0; i < 200; i++) {
    const expanders = page.getByLabel("expand");
    if ((await expanders.count()) === 0) return;
    await expanders.first().click();
  }
  throw new Error("expand controls did not converge");
}

async function expandSearchPath(
  page: Page,
  opponentLabel: string,
  starterLabel: string,
) {
  const topList = page
    .getByRole("heading", { name: "反撃候補" })
    .locator("xpath=following-sibling::ul[1]");
  const opponentRow = topList
    .locator(":scope > li")
    .filter({ hasText: opponentLabel })
    .first();
  await expect(opponentRow).toBeVisible({ timeout: 15_000 });
  await opponentRow.getByLabel("expand").first().click();
  const starterRow = opponentRow
    .locator(":scope > ul > li")
    .filter({ hasText: starterLabel })
    .first();
  await expect(starterRow).toBeVisible();
  await starterRow.getByLabel("expand").click();
  return starterRow;
}

function rowForCombo(page: Page, comboId: number) {
  return page.locator("li").filter({ hasText: `コンボ #${comboId}` }).last();
}

test.describe("M18-03c drainage", () => {
  test.beforeEach(async ({ page }) => {
    await initialize(page.request);
  });

  test("A: 採用→第3セクション→変換→探すで変換済みに畳む→PC一覧", async ({
    page,
  }) => {
    const request = page.request;
    const cs = await characters(request);
    const ryu = cs.find((c) => c.code === "ryu")!.id;
    const ken = cs.find((c) => c.code === "ken")!.id;
    const tree = await scan(request, ryu, ken, "just_parry");
    const candidate = tree.nodes.find((node) => node.starters.length > 0);
    expect(candidate, "read-only 走査に始動技候補が無い").toBeTruthy();
    const starter = candidate!.starters[0];
    const opponentLabel = moveLabel(candidate!);
    const starterLabel = moveLabel(starter);
    const base = await createNormalCombo(request, ryu, starter.moveId, "A");

    // 探す画面の孫から採用する。
    await page.goto(`/punish/search?self=${ryu}&opp=${ken}&guard=just_parry`);
    const initialStarterRow = await expandSearchPath(
      page,
      opponentLabel,
      starterLabel,
    );
    const baseRow = initialStarterRow
      .locator("li")
      .filter({ hasText: `コンボ #${base}` })
      .first();
    await expect(baseRow).toBeVisible();
    await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().endsWith("/api/combo-punishes") &&
          res.request().method() === "POST",
      ),
      baseRow
        .getByRole("button", { name: "確定反撃に採用", exact: true })
        .click(),
    ]);

    let current = await list(request, ryu);
    expect(comboIDs(current.unclassifiedNodes)).toContain(base);

    // 第3セクションの UI から変換する。
    await page.goto(`/punish/list?self=${ryu}&guard=block`);
    await page.getByText(/区分を判定できない反撃/).click();
    await expandAll(page);
    const unclassifiedRow = rowForCombo(page, base);
    const materializeResponse = page.waitForResponse(
      (res) =>
        res.url().includes(`/api/combos/${base}/materialize`) &&
        res.request().method() === "POST",
    );
    await unclassifiedRow
      .getByRole("button", { name: "パニッシュカウンター版を作る" })
      .click();
    const materialized = await materializeResponse;
    expect(materialized.ok(), await materialized.text()).toBeTruthy();
    const generated = ((await materialized.json()) as { comboId: number }).comboId;
    await expect(
      page.getByText(
        "通常版の合計ダメージに、始動技ダメージの20%を加えて登録しました。",
      ),
    ).toBeVisible();
    await expect(page.getByText("生成後に実測値へ調整してください。")).toBeVisible();
    const closeMaterializeToast = page.getByRole("button", {
      name: "Close toast",
    });
    await expect(closeMaterializeToast).toBeVisible();
    const materializeToast = page
      .locator("[data-sonner-toast]")
      .filter({ hasText: "パニッシュカウンター版を作成しました" });
    await expect(materializeToast).toHaveClass(/materialize-result-toast/);
    expect(
      await materializeToast.evaluate((element) =>
        getComputedStyle(element)
          .getPropertyValue("--toast-close-button-start")
          .trim(),
      ),
    ).toBe("auto");
    expect(
      await materializeToast.evaluate((element) =>
        getComputedStyle(element)
          .getPropertyValue("--toast-close-button-end")
          .trim(),
      ),
    ).toBe("0");
    const toastBox = await materializeToast.boundingBox();
    const closeBox = await closeMaterializeToast.boundingBox();
    expect(toastBox).not.toBeNull();
    expect(closeBox).not.toBeNull();
    // ×の中心が通知の右半分・上半分にあることを固定し、左上への退行を検出する。
    expect(closeBox!.x + closeBox!.width / 2).toBeGreaterThan(
      toastBox!.x + toastBox!.width / 2,
    );
    expect(closeBox!.y + closeBox!.height / 2).toBeLessThan(
      toastBox!.y + toastBox!.height / 2,
    );
    // Sonner の既定自動消去時間を越えても残り、利用者が読み終えてから閉じられる。
    await page.waitForTimeout(5_000);
    await expect(page.getByText("生成後に実測値へ調整してください。")).toBeVisible();
    await closeMaterializeToast.click();
    await expect(
      page.getByText("生成後に実測値へ調整してください。"),
    ).toHaveCount(0);

    // 基底は消えず、探す画面の孫の末尾で畳まれる。
    await page.goto(`/punish/search?self=${ryu}&opp=${ken}&guard=just_parry`);
    const materializedStarterRow = await expandSearchPath(
      page,
      opponentLabel,
      starterLabel,
    );
    await expect(page.getByText(`コンボ #${base}`)).toHaveCount(0);
    await materializedStarterRow
      .getByRole("button", { name: /変換済み \(\d+ 件\)/ })
      .click();
    const foldedBaseRow = materializedStarterRow
      .locator("li")
      .filter({ hasText: `コンボ #${base}` })
      .last();
    await expect(foldedBaseRow).toBeVisible();
    await expect(foldedBaseRow.getByText("PC 版を作成済み")).toBeVisible();

    // 生成物は PC 系のマイリストへ出る。
    await page.goto(`/punish/list?self=${ryu}&guard=block`);
    await expandAll(page);
    await expect(page.getByText(`コンボ #${generated}`)).toBeVisible();
  });

  test("B: 手動確認レーンから保存すると当該相手技の登録済みに現れる", async ({
    page,
  }) => {
    const request = page.request;
    const cs = await characters(request);
    const ryu = cs.find((c) => c.code === "ryu")!.id;
    const ken = cs.find((c) => c.code === "ken")!.id;
    const hadoken = (await moves(request, ken)).find(
      (move) => move.code === "hadoken_light",
    );
    expect(hadoken, "ken.hadoken_light が未 seed").toBeTruthy();
    const tree = await scan(request, ryu, ken, "block");
    const manual = tree.manualReviewNodes.find(
      (node) => node.moveId === hadoken!.id,
    );
    expect(manual, "hadoken_light が手動確認レーンに無い").toBeTruthy();
    const label = manual!.nameJa || manual!.code;

    await page.goto(`/punish/search?self=${ryu}&opp=${ken}&guard=block`);
    const manualRow = page.locator("li").filter({ hasText: label }).last();
    await manualRow
      .getByRole("button", { name: "手動で確定反撃を登録" })
      .click();
    await expect(page).toHaveURL(/\/combos\/new\?character=\d+/);
    await expect(
      page.getByText("(確定反撃サーチからの登録では変更不可)"),
    ).toHaveCount(2);
    // ★M24-12: ヒット種別は select からボタン群になった。見ているものは同じ——
    //   「プリフィル値が選ばれたまま、変更できない」。
    await expect(
      page.getByTestId("combo-editor-hit-type-punish_counter"),
    ).toBeChecked();
    await expect(
      page.getByTestId("combo-editor-hit-type-punish_counter"),
    ).toBeDisabled();

    // ★★M24-13: 「仮登録ならレシピ無しで保存可能」は撤回された(VAL-C09 を仮登録へ
    //   適用した)。⇒ 最小のレシピを 1 本置く。保存後の combo-punishes 登録まで待つ。
    await page.getByTestId("combo-editor-draft-checkbox").click();
    await addMinimalRecipeStep(page);
    const createResponse = page.waitForResponse(
      (res) =>
        res.url().endsWith("/api/combos") &&
        res.request().method() === "POST",
    );
    const linkResponse = page.waitForResponse(
      (res) =>
        res.url().endsWith("/api/combo-punishes") &&
        res.request().method() === "POST",
    );
    await page.getByRole("button", { name: "保存" }).click();
    const created = await createResponse;
    expect(created.ok(), await created.text()).toBeTruthy();
    const comboId = ((await created.json()) as { id: number }).id;
    expect((await linkResponse).status()).toBe(204);

    await expect(page).toHaveURL(
      `/punish/search?self=${ryu}&opp=${ken}&guard=block`,
    );
    const refreshedManualRow = page
      .locator("li")
      .filter({ hasText: label })
      .last();
    await expect(
      refreshedManualRow.getByText("登録済みの確定反撃"),
    ).toBeVisible();
    await expect(refreshedManualRow.getByText(`コンボ #${comboId}`)).toBeVisible();
  });

  test("C: 成立ツリー側も検索キャラとhit_typeを固定する", async ({
    page,
  }) => {
    const request = page.request;
    const cs = await characters(request);
    const ryu = cs.find((c) => c.code === "ryu")!.id;
    const ken = cs.find((c) => c.code === "ken")!.id;
    const tree = await scan(request, ryu, ken, "just_parry");
    const candidate = tree.nodes.find((node) => node.starters.length > 0);
    expect(candidate, "read-only 走査に始動技候補が無い").toBeTruthy();

    await page.goto(`/punish/search?self=${ryu}&opp=${ken}&guard=just_parry`);
    const starterRow = await expandSearchPath(
      page,
      moveLabel(candidate!),
      moveLabel(candidate!.starters[0]),
    );
    await starterRow
      .getByRole("button", { name: "このコンボを新規登録する" })
      .click();

    await expect(page).toHaveURL(/\/combos\/new\?character=\d+/);
    await expect(
      page.getByText("(確定反撃サーチからの登録では変更不可)"),
    ).toHaveCount(2);
    // ★M24-12: ヒット種別は select からボタン群になった。見ているものは同じ——
    //   「プリフィル値が選ばれたまま、変更できない」。
    await expect(
      page.getByTestId("combo-editor-hit-type-just_parry_punish_counter"),
    ).toBeChecked();
    await expect(
      page.getByTestId("combo-editor-hit-type-just_parry_punish_counter"),
    ).toBeDisabled();
  });

  test("D: 第3セクションで使わない→隠したもの管理→解除→戻る", async ({
    page,
  }) => {
    const request = page.request;
    const cs = await characters(request);
    const ryu = cs.find((c) => c.code === "ryu")!.id;
    const ken = cs.find((c) => c.code === "ken")!.id;
    const opponent = (await moves(request, ken)).find(
      (move) => move.code === "hadoken_light",
    )!;
    const tree = await scan(request, ryu, ken, "just_parry");
    const candidate = tree.nodes.find((node) => node.starters.length > 0);
    expect(candidate, "read-only 走査に始動技候補が無い").toBeTruthy();
    const base = await createNormalCombo(
      request,
      ryu,
      candidate!.starters[0].moveId,
      "C",
    );
    const adopt = await request.post("/api/combo-punishes", {
      data: { comboId: base, opponentMoveId: opponent.id },
    });
    expect(adopt.status()).toBe(204);

    await page.goto(`/punish/list?self=${ryu}&guard=block`);
    await page.getByText(/区分を判定できない反撃/).click();
    await expandAll(page);
    const row = rowForCombo(page, base);
    await row.getByLabel("隠す理由(任意)").fill("e2e では使わない");
    await row.getByRole("button", { name: "使わない", exact: true }).click();
    await expect(page.getByText(`コンボ #${base}`)).toHaveCount(0);

    let current = await list(request, ryu);
    expect(
      current.hiddenCurations.some(
        (entry) =>
          entry.comboId === base && entry.opponentMoveId === opponent.id,
      ),
    ).toBe(true);

    await page.goto(`/punish/list?self=${ryu}&tab=hidden`);
    const hiddenRow = rowForCombo(page, base);
    await expect(hiddenRow).toBeVisible();
    await hiddenRow
      .getByRole("button", { name: "解除して再表示" })
      .click();
    await expect(page.getByText(`コンボ #${base}`)).toHaveCount(0);

    current = await list(request, ryu);
    expect(comboIDs(current.unclassifiedNodes)).toContain(base);
    expect(
      current.hiddenCurations.some((entry) => entry.comboId === base),
    ).toBe(false);
  });

  test("E: 同種の永続通知は最新結果へ置換され、開くも最新生成物を指す", async ({
    page,
  }) => {
    const request = page.request;
    const cs = await characters(request);
    const ryu = cs.find((c) => c.code === "ryu")!.id;
    const ken = cs.find((c) => c.code === "ken")!.id;
    const ryuMoves = (await moves(request, ryu)).filter(
      (move) => move.category === "normal" && !move.isAerial,
    );
    expect(
      ryuMoves.length,
      "通常／counter の別レシピに使う地上通常技が不足",
    ).toBeGreaterThanOrEqual(2);
    const opponent = (await moves(request, ken)).find(
      (move) => move.code === "hadoken_light",
    );
    expect(opponent, "ken.hadoken_light が未 seed").toBeTruthy();

    const counterBase = await createCombo(request, ryu, "E-counter", {
      starterMoveId: ryuMoves[0].id,
      damage: 1000,
      hitType: "counter",
    });
    const normalBase = await createCombo(request, ryu, "E-normal", {
      starterMoveId: ryuMoves[1].id,
      damage: 1000,
    });
    await adoptCombo(request, counterBase, opponent!.id);
    await adoptCombo(request, normalBase, opponent!.id);

    await page.goto(`/punish/list?self=${ryu}&guard=block`);
    await page.getByText(/区分を判定できない反撃/).click();
    await expandAll(page);

    await materializeFromList(page, counterBase);
    await expect(
      page.getByText(
        /カウンター版からの変換のため、PC版のダメージは元の値で登録しました/,
      ),
    ).toBeVisible();

    const normalResult = await materializeFromList(page, normalBase);
    await expect(
      page.getByText(
        /通常版の合計ダメージに、始動技ダメージの20%を加えて登録しました/,
      ),
    ).toBeVisible();
    await expect(
      page.getByText(
        /カウンター版からの変換のため、PC版のダメージは元の値で登録しました/,
      ),
    ).toHaveCount(0);
    await expect(page.locator(".materialize-result-toast")).toHaveCount(1);

    const latestToast = page
      .locator(".materialize-result-toast")
      .filter({ hasText: "通常版の合計ダメージ" });
    await latestToast.getByRole("button", { name: "開く" }).click();
    await expect(page).toHaveURL(`/combos/${normalResult.comboId}`);
  });

  test("F: モバイル幅でも通常／要注意の最大2件に収まり、後続操作を妨げない", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const request = page.request;
    const cs = await characters(request);
    const ryu = cs.find((c) => c.code === "ryu")!.id;
    const ken = cs.find((c) => c.code === "ken")!.id;
    const ryuMoves = await moves(request, ryu);
    const groundNormals = ryuMoves.filter(
      (move) => move.category === "normal" && !move.isAerial,
    );
    expect(
      groundNormals.length,
      "通常／要注意の別レシピに使う地上通常技が不足",
    ).toBeGreaterThanOrEqual(2);
    const superArt = ryuMoves.find(
      (move) =>
        (move.category === "super_art" ||
          move.category === "critical_art") &&
        !move.isAerial,
    );
    expect(superArt, "要注意通知を確認する SA／CA が未 seed").toBeTruthy();
    const opponent = (await moves(request, ken)).find(
      (move) => move.code === "hadoken_light",
    );
    expect(opponent, "ken.hadoken_light が未 seed").toBeTruthy();

    const superArtBase = await createCombo(request, ryu, "F-sa", {
      starterMoveId: superArt!.id,
      damage: 1000,
    });
    const normalBase = await createCombo(request, ryu, "F-normal", {
      starterMoveId: groundNormals[0].id,
      damage: 1000,
    });
    const noDamageBase = await createCombo(request, ryu, "F-no-damage", {
      starterMoveId: groundNormals[1].id,
    });
    await adoptCombo(request, superArtBase, opponent!.id);
    await adoptCombo(request, normalBase, opponent!.id);
    await adoptCombo(request, noDamageBase, opponent!.id);

    await page.goto(`/punish/list?self=${ryu}&guard=block`);
    await page.getByText(/区分を判定できない反撃/).click();
    await expandAll(page);

    await materializeFromList(page, superArtBase);
    await expect(
      page.getByText(
        /Super Arts／Critical Arts は補正対象外のため、加算していません/,
      ),
    ).toBeVisible();
    await materializeFromList(page, normalBase);
    await expect(page.locator(".materialize-result-toast")).toHaveCount(2);
    await expect(page.getByText(/通常版の合計ダメージに/)).toBeVisible();

    // 永続通知が 2 件ある状態でも第3セクションを操作でき、次の要注意結果へ更新できる。
    await materializeFromList(page, noDamageBase);
    await expect(page.locator(".materialize-result-toast")).toHaveCount(2);
    await expect(
      page.getByText(/基底コンボにダメージが未入力のため、加算していません/),
    ).toBeVisible();
    await expect(
      page.getByText(
        /Super Arts／Critical Arts は補正対象外のため、加算していません/,
      ),
    ).toHaveCount(0);
    await expect(page.getByText(/通常版の合計ダメージに/)).toBeVisible();

    const toasterBox = await page
      .locator("[data-sonner-toaster]")
      .boundingBox();
    expect(toasterBox).not.toBeNull();
    expect(toasterBox!.height).toBeLessThan(844 / 2);
  });
});

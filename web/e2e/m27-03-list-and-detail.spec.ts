import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

// M27-03: 一覧・詳細の 5 項目。
//
//   1: P4M-020 一覧の始動状況欄から始動技の表示を除く
//   2: P4M-021 ヒット種別フィルタの短縮表記(閉じたら短縮・開いたらフル・幅が動かない)
//   3: P4M-022 始動技フィルタ
//   4: SD-009  ドライブダメージの符号(+ と 削り/回復)と ⓘ
//   5: combo-detail-back-link-is-hardcoded 「戻る」が来た画面へ帰る
//
// ★判定キーは本 spec 固有にする(教訓 E-232)。E2E は DB を 1 本共有し、
//   ファイル単位では並行に走るため、他ファイルが作った行を掴まないようにする。
const STAMP = `m2703-${Date.now()}`;

const HIT_TYPE_FILTER = "combo-list-hit-type-filter";
const STARTER_FILTER = "combo-list-starter-move-filter";

// 一覧のヒット種別のフル表記と短縮表記(ja)。★ここは実物の文言と一致させる。
const HIT_TYPE_FULL_JP_PC = "パニッシュカウンター(ジャストパリィ反撃)";
const HIT_TYPE_SHORT_JP_PC = "PC(JP)";
const HIT_TYPE_FULL_NORMAL = "通常";

type Char = { id: number; code: string; nameJa: string };
type Move = { id: number; code: string; nameJa: string; category: string };

/** ドロップダウンの中の選択肢だけを数える(native select の option と混ざらないため)。 */
function listboxOptions(page: Page) {
  return page.getByRole("listbox").getByRole("option");
}

async function ryu(request: APIRequestContext): Promise<Char> {
  const res = await request.get("/api/games/1/characters");
  expect(res.ok()).toBeTruthy();
  const chars = (await res.json()).items as Char[];
  const found = chars.find((c) => c.code === "ryu");
  if (!found) throw new Error("seed に ryu が居ない(配布クリーン状態の前提崩れ)");
  return found;
}

async function normalMoves(
  request: APIRequestContext,
  characterId: number,
): Promise<Move[]> {
  const res = await request.get(`/api/moves?character_id=${characterId}`);
  expect(res.ok()).toBeTruthy();
  const moves = (await res.json()).items as Move[];
  const normals = moves.filter((m) => m.category === "normal" && m.nameJa);
  expect(normals.length, "ryu の通常技が 2 本以上要る").toBeGreaterThan(1);
  return normals;
}

async function createCombo(
  request: APIRequestContext,
  data: Record<string, unknown>,
): Promise<number> {
  const res = await request.post("/api/combos", { data });
  expect(res.ok(), `コンボ作成に失敗: ${res.status()} ${await res.text()}`).toBeTruthy();
  return ((await res.json()) as { id: number }).id;
}

test.describe("M27-03 一覧・詳細", () => {
  let characterId: number;
  let starterA: Move;
  let starterB: Move;
  // A: 最長のヒット種別 ＋ 正のドライブダメージ。B: 別の始動技 ＋ 通常ヒット。
  let comboA: number;
  let comboB: number;

  test.beforeAll(async ({ request }) => {
    const character = await ryu(request);
    characterId = character.id;
    const normals = await normalMoves(request, characterId);
    starterA = normals[0];
    starterB = normals[1];

    comboA = await createCombo(request, {
      characterId,
      isDraft: false,
      memo: `${STAMP}-A`,
      steps: [{ stepOrder: 1, moveId: starterA.id }],
      starterMoveId: starterA.id, // レシピ 1 手目と一致(VAL-C03)
      hitType: "just_parry_punish_counter",
      position: "corner_opponent",
      // ★★「不問」を明示的に入れる。着手前は不問を画面から隠していたため、
      //   3 列化で**出るようになった**ことを見るにはこの値が要る。
      opponentStance: "any",
      // ★★M27-02b(VAL-C15): 本登録は 4 欄が必須である
      //   (ダメージ / 有利フレーム / ドライブゲージ消費 / SA ゲージ消費)。
      damage: 2800,
      knockdownAdvantage: 30,
      driveGaugeConsumed: 2,
      saGaugeConsumed: 0,
      // ★★2026-09-05 開発者指示で符号の意味が入れ替わった(負 = 削り / 正 = 回復)。
      //   ★負の値。詳細で「-2.5 削り」と出ることを見る(SD-009)。
      driveDamage: -2.5,
    });

    comboB = await createCombo(request, {
      characterId,
      isDraft: false,
      memo: `${STAMP}-B`,
      steps: [{ stepOrder: 1, moveId: starterB.id }],
      starterMoveId: starterB.id,
      hitType: "normal",
      position: "mid_screen",
      damage: 2000,
      knockdownAdvantage: 20,
      driveGaugeConsumed: 1,
      saGaugeConsumed: 0,
      // ★正の値。「+1 回復」と出ることを見る。
      driveDamage: 1,
    });
  });

  test.afterAll(async ({ request }) => {
    for (const id of [comboA, comboB]) {
      if (id) await request.delete(`/api/combos/${id}`);
    }
  });

  // ─────────────────────────────────────────────────────────────────────
  // 1: P4M-020 一覧の始動状況欄から始動技を除く
  // ─────────────────────────────────────────────────────────────────────
  test("1: 状況は 3 列(ヒット種別 / 始動位置 / 相手の状態)で、始動技は出さない", async ({
    page,
  }) => {
    await page.goto(`/combos?character_id=${characterId}`);

    const row = page.locator("tr", { hasText: `${STAMP}-A` });
    await expect(row).toHaveCount(1);

    // ★★見るのは状況の各欄であって行ぜんぶではない。
    //   ★行にはレシピ列があり、そこに技名が出ている。それは本件の前提そのものである
    //     ——開発者の逐語＝「レシピが綺麗に表示されているので、始動技を始動状況欄に
    //     出す必要はなくなった」。⇒ 行で見ると常に一致して空振りする(実際に一度した)。
    //
    // ★★M27-03 追補: 1 列だった「始動状況」は 3 列へ割れた
    //   (ヒット種別 / 始動位置 / 相手の状態)。
    // ★★M31-03: testid を combo-starter-situation → combo-hit-type へ改名した
    //   (「始動状況」列は存在しないため。行内リンクもこの欄から外れてルート列へ移った)。
    const hitTypeCell = row.getByTestId("combo-hit-type");
    const positionCell = row.getByTestId("combo-position");
    const stanceCell = row.getByTestId("combo-opponent-stance");

    // ★★始動技はどの欄にも出ない。着手前は先頭に技名が並んでいた。
    for (const cell of [hitTypeCell, positionCell, stanceCell]) {
      await expect(cell).not.toContainText(starterA.nameJa);
    }
    // ★残ったこと。「消しすぎていない」ことを欄ごとに見る。
    await expect(hitTypeCell).toContainText(HIT_TYPE_FULL_JP_PC);
    await expect(positionCell).toContainText("相手画面端");
    // ★★相手の状態は独立列なので「不問」も出す(着手前は不問を隠していた)。
    await expect(stanceCell).toHaveText("不問");

    // 見出しも 3 本出ている。
    for (const head of ["ヒット種別", "始動位置", "相手の状態"]) {
      await expect(
        page.getByRole("columnheader", { name: head, exact: true }),
      ).toBeVisible();
    }

    // ★レシピ列には技名が出ている(消えたのは状況の欄だけである)。
    await expect(row).toContainText(starterA.nameJa);

    // ★詳細画面は変えていない(指示書 §2.1-3)。同じ始動技がそちらには出る。
    await page.goto(`/combos/${comboA}`);
    await expect(page.getByText(starterA.nameJa).first()).toBeVisible();
  });

  // ─────────────────────────────────────────────────────────────────────
  // 2: P4M-021 ヒット種別フィルタの短縮表記
  // ─────────────────────────────────────────────────────────────────────
  test("2: ヒット種別は閉じたら短縮・開いたらフル、幅は値で動かない", async ({
    page,
  }) => {
    await page.goto(`/combos?character_id=${characterId}`);

    const trigger = page.getByTestId(HIT_TYPE_FILTER);
    await expect(trigger).toBeVisible();
    const widthUnselected = (await trigger.boundingBox())!.width;

    // 開いた一覧はフル表記
    await trigger.click();
    await expect(
      listboxOptions(page).filter({ hasText: HIT_TYPE_FULL_JP_PC }),
    ).toHaveCount(1);
    await listboxOptions(page)
      .filter({ hasText: HIT_TYPE_FULL_JP_PC })
      .click();

    // ★★閉じたら短縮表記。フル表記は出ない。
    await expect(trigger).toContainText(HIT_TYPE_SHORT_JP_PC);
    await expect(trigger).not.toContainText(HIT_TYPE_FULL_JP_PC);

    // ★★幅が値の長さで動かないこと——これが本件の要求そのものである。
    //   最長の値を選んでも、未選択のときと同じ幅であること。
    const widthLongest = (await trigger.boundingBox())!.width;
    expect(Math.round(widthLongest)).toBe(Math.round(widthUnselected));

    // 絞り込みは効いている(A だけが残る)
    await expect(page.locator("tr", { hasText: `${STAMP}-A` })).toHaveCount(1);
    await expect(page.locator("tr", { hasText: `${STAMP}-B` })).toHaveCount(0);

    // 一番短い値へ替えても幅は同じ
    await trigger.click();
    await listboxOptions(page)
      .filter({ hasText: new RegExp(`^${HIT_TYPE_FULL_NORMAL}$`) })
      .click();
    const widthShortest = (await trigger.boundingBox())!.width;
    expect(Math.round(widthShortest)).toBe(Math.round(widthUnselected));
  });

  // ─────────────────────────────────────────────────────────────────────
  // 3: P4M-022 始動技フィルタ
  // ─────────────────────────────────────────────────────────────────────
  test("3: 始動技で絞り込める(表示を消したことと両立する)", async ({ page }) => {
    await page.goto(`/combos?character_id=${characterId}`);

    const trigger = page.getByTestId(STARTER_FILTER);
    await expect(trigger).toBeVisible();
    await trigger.click();

    // 選択中キャラの技が出る。検索で 1 件へ絞る。
    await page.getByPlaceholder("技を検索").fill(starterA.nameJa);
    await listboxOptions(page)
      .filter({ hasText: new RegExp(`^${starterA.nameJa}$`) })
      .first()
      .click();

    await expect(page.locator("tr", { hasText: `${STAMP}-A` })).toHaveCount(1);
    await expect(page.locator("tr", { hasText: `${STAMP}-B` })).toHaveCount(0);

    // ★絞り込みは URL に載る(戻り時の保持は既存機構に相乗りしている)。
    await expect(page).toHaveURL(new RegExp(`starter_move_id=${starterA.id}`));

    // ★★一覧の状況の欄からは始動技が消えているのに、「絞り込み」では使える。
    //   P4M-020 と P4M-022 が両立していることを 1 本の test で押さえる。
    const row = page.locator("tr", { hasText: `${STAMP}-A` });
    await expect(
      row.getByTestId("combo-hit-type"),
    ).not.toContainText(starterA.nameJa);
  });

  // ─────────────────────────────────────────────────────────────────────
  // 4: SD-009 ドライブダメージの符号
  // ─────────────────────────────────────────────────────────────────────
  test("4: ドライブダメージの符号がどちらを表すか画面から読める", async ({
    page,
  }) => {
    await page.goto(`/combos/${comboA}`);
    // 負 = 削り
    const dd = page.locator("div", { has: page.getByText("ドライブダメージ", { exact: true }) });
    await expect(dd.last()).toContainText("-2.5");
    await expect(dd.last()).toContainText("削り");

    // ⓘ に「マイナスを許容している理由」が出る
    await page.getByTestId("info-mark-drive-damage").click();
    await expect(
      page.getByTestId("info-mark-drive-damage-content"),
    ).toContainText("負が削り");

    // 正 = 回復
    await page.goto(`/combos/${comboB}`);
    const ddB = page.locator("div", { has: page.getByText("ドライブダメージ", { exact: true }) });
    await expect(ddB.last()).toContainText("+1");
    await expect(ddB.last()).toContainText("回復");
  });

  // ─────────────────────────────────────────────────────────────────────
  // 5: combo-detail-back-link-is-hardcoded 「戻る」の行き先
  // ─────────────────────────────────────────────────────────────────────
  test("5: 比較から開いた詳細の「戻る」は比較へ帰る", async ({ page }) => {
    // ★★これが followup の逐語そのものである
    //   ——「比較 → 詳細 →『戻る』→ 一覧」に違和感がある(2026-08-26)。
    await page.goto(`/compare?ids=${comboA},${comboB}`);
    await expect(page).toHaveURL(/\/compare\?ids=/);

    await page.locator(`a[href="/combos/${comboA}"]`).first().click();
    await expect(page).toHaveURL(new RegExp(`/combos/${comboA}$`));

    await page.getByTestId("combo-detail-back").click();

    // ★着手前はここが /combos(一覧)だった。
    await expect(page).toHaveURL(/\/compare\?ids=/);
  });

  // ★★段 1: 開発者の実機確認で「保存 → 詳細 →『戻る』で真っ白」が報告された。
  //   本ケースは望ましい着地(一覧へ帰る)を書いてある。⇒ 直す前は赤になり、
  //   そのとき Playwright が実際の URL を出すので、機序の確定に使う。
  test("6: 編集 → 保存 → 詳細 →「戻る」は一覧へ帰る(編集画面を履歴へ残さない)", async ({
    page,
  }) => {
    await page.goto(`/combos?character_id=${characterId}`);
    await page.locator("tr", { hasText: `${STAMP}-A` }).getByRole("link", { name: "編集" }).click();
    await expect(page).toHaveURL(new RegExp(`/combos/${comboA}/edit$`));

    // 何か 1 つ変えて保存する(dirty にしないと離脱ガードが張られない)。
    const damage = page.getByTestId("combo-editor-damage");
    await damage.fill("2810");
    await Promise.all([
      page.waitForResponse(
        (r) => r.request().method() === "PUT" || r.request().method() === "PATCH",
      ),
      page.getByRole("button", { name: "保存" }).click(),
    ]);
    await expect(page).toHaveURL(new RegExp(`/combos/${comboA}$`));

    await page.getByTestId("combo-detail-back").click();

    // ★★着手前はここで編集画面へ戻り、画面が真っ白になっていた。
    await expect(page).toHaveURL(/\/combos(\?|$)/);
    await expect(page.getByTestId("combo-list-filter-panel")).toBeVisible();
  });

  // ★★開発者裁定(2026-09-05)＝「両方直す」。保存後にフォームを履歴へ残さない作法は
  //   コンボ編集だけでなくセットプレイ編集の保存後にも効く。⇒ そちらにも 1 本置く。
  test("7: セットプレイを作って保存 → コンボ詳細 →「戻る」は一覧へ帰る", async ({
    page,
  }) => {
    // 一覧 → 詳細 と辿ってから、詳細の下のセットプレイ登録画面へ入る。
    await page.goto(`/combos?character_id=${characterId}`);
    // ★★M31-03: 詳細への行内リンクはルート列が持つ(開発者確定 2026-09-09)。
    //   着手前はヒット種別の欄に在った。
    await page
      .locator("tr", { hasText: `${STAMP}-B` })
      .getByTestId("combo-recipe")
      .getByRole("link")
      .click();
    await expect(page).toHaveURL(new RegExp(`/combos/${comboB}$`));

    await page.goto(`/combos/${comboB}/setups/new`);
    await page.getByPlaceholder("セットプレイ名").fill(`${STAMP}-setup`);
    await page.getByTestId("recipe-pulldown-toggle").click();
    await page.getByTestId("recipe-move-select").selectOption(String(starterB.id));
    await page.getByTestId("recipe-add-step").click();
    await page.getByRole("button", { name: "保存" }).click();
    await page.waitForURL(`**/combos/${comboB}`);

    await page.getByTestId("combo-detail-back").click();

    // ★セットプレイ登録画面が履歴に残っていれば、ここで /setups/new へ戻ってしまう。
    await expect(page).toHaveURL(/\/combos(\?|$)/);
    await expect(page.getByTestId("combo-list-filter-panel")).toBeVisible();
  });

  test("5b: 直接 URL で開いた詳細の「戻る」は一覧へ落ちる(履歴が無いとき)", async ({
    page,
  }) => {
    // ★新しいタブで詳細だけを開いた状態。戻り先が無いので <Link> の href が効く。
    await page.goto(`/combos/${comboA}`);
    await page.getByTestId("combo-detail-back").click();
    await expect(page).toHaveURL(/\/combos(\?|$)/);
  });
});

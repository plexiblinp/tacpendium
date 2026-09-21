import { test, expect, type APIRequestContext } from "@playwright/test";

import {
  clearGameUpdatePostpone,
  currentDataVersion,
  gameUpdateNotice,
  setComboBaselineVersion,
  setMoveGameVersion,
} from "./support/game-update";

// M28-02c: ゲーム更新の影響コンボ(FR702 / CHANGE-162)。
//
//   test 1: バナー → 専用画面 →「問題なし」→ 件数が減る、の往復
//           ★破壊確認 (a) 画面を開いただけで基準が進まないこと と
//             破壊確認 (c) 640px 以上でもバナーが出ること は、この 1 本に同居している
//             (どちらも同じ往復の途中で主張できるため、test を分けていない)。
//   test 2: 破壊確認 (b) 延期してもバナーだけが消え、一覧のボタンは消えないこと
//   test 3: 専用画面の行アクション ——［コピー］は出さず［削除］を出す。
//           削除で件数が減り、復元すると基準はそのままで件数が戻る
//
// ★★初回は必ず 0 件である(D-725 により既存コンボの基準は最新)。
//   ⇒ 「0 件だったから正しい」は証拠にならない。人工的に古い基準を作ってから確かめる。
//
// ★判定キーは本 spec 固有にする(教訓 E-232)。E2E は DB を 1 本共有し、
//   ファイル単位では並行に走るため、他ファイルが作った行を掴まないようにする。
const STAMP = `m2802c-${Date.now()}`;

// 人工的に作る「古い基準」と、その直後に立てるマーカー。
//
// ★★どちらも現在版(既定 2026.08.03.01)より **古い** 値にしてある。理由は分離である ——
//   マーカーは技に立つので、同じ技を使う全コンボへ及ぶ。現在版より新しいマーカーを立てると
//   **他 spec が作ったコンボまで一斉に影響ありになり**、件数も行の並びも当てにならなくなる
//   (E2E は DB を 1 本共有する = 教訓 E-232)。
// ★マーカー < 現在版 にしておけば、基準が現在版のままのコンボ(= 他 spec のもの)は
//   「マーカー ≦ 基準」で影響なしのままである。⇒ 本 spec が作った 1 件だけが出る。
const OLD_BASELINE = "2020.01.01.00";
const MARKER = "2020.06.01.00";

type Char = { id: number; code: string; nameJa: string };
type Move = { id: number; code: string; category: string };

async function ryu(request: APIRequestContext): Promise<Char> {
  const res = await request.get("/api/games/1/characters");
  expect(res.ok()).toBeTruthy();
  const chars = (await res.json()).items as Char[];
  const found = chars.find((c) => c.code === "ryu");
  if (!found) throw new Error("seed に ryu が居ない(配布クリーン状態の前提崩れ)");
  return found;
}

/**
 * 本 spec が使う通常技を 3 本返す。
 *
 * ★★重複判定キーは (キャラ / 始動技 / 始動位置 / 相手の状態 / ヒット種別 / 相手の大きさ)
 *   ＋ 持続当て(M37-07)の 7 項目である。⇒ 他 spec と同じ組を作ると VAL-C02 で作成が落ちる
 *   (E2E は DB を 1 本共有し、ファイル単位では並行に走る = 教訓 E-232)。
 * ★★**末尾から取る**のが要である —— 他 spec は先頭を使う(実測: m27-03 は
 *   normals[0] / normals[1])。⇒ 始動技が違えばキーが被らない。
 * ★実際にこれで落ちた: 位置だけを変えていた版は corner_opponent が他 spec と衝突し、
 *   単独実行では通るのに make e2e で赤になった。
 */
async function tailNormalMoves(
  request: APIRequestContext,
  characterId: number,
): Promise<[Move, Move, Move]> {
  const res = await request.get(`/api/moves?character_id=${characterId}`);
  expect(res.ok()).toBeTruthy();
  const moves = (await res.json()).items as Move[];
  const normals = moves.filter((m) => m.category === "normal");
  expect(normals.length, "ryu の通常技が 3 本以上要る").toBeGreaterThan(2);
  const tail = normals.slice(-3);
  return [tail[0], tail[1], tail[2]];
}

async function createCombo(
  request: APIRequestContext,
  data: Record<string, unknown>,
): Promise<number> {
  const res = await request.post("/api/combos", { data });
  expect(
    res.ok(),
    `コンボ作成に失敗: ${res.status()} ${await res.text()}` +
      "\n★VAL-C02 なら他 spec のコンボと重複判定キーが衝突している(教訓 E-232)。" +
      "⇒ tailNormalMoves の注記を読むこと",
  ).toBeTruthy();
  return ((await res.json()) as { id: number }).id;
}

async function baselineOf(
  request: APIRequestContext,
  comboId: number,
): Promise<string | undefined> {
  const res = await request.get(`/api/combos/${comboId}`);
  expect(res.ok()).toBeTruthy();
  return ((await res.json()) as { baselineVersion?: string }).baselineVersion;
}

test.describe("M28-02c ゲーム更新の影響コンボ", () => {
  let characterId: number;
  // ★3 本とも別の始動技にする(重複判定キーを test ごとに分ける)。
  let moves: [Move, Move, Move];
  let comboId: number;

  test.beforeAll(async ({ request }) => {
    const character = await ryu(request);
    characterId = character.id;
    moves = await tailNormalMoves(request, characterId);

    comboId = await createCombo(request, {
      characterId,
      isDraft: false,
      memo: STAMP,
      steps: [{ stepOrder: 1, moveId: moves[0].id }],
      starterMoveId: moves[0].id,
      hitType: "normal",
      position: "mid_screen",
      opponentStance: "standing",
      opponentSize: "standard",
      damage: 1200,
      knockdownAdvantage: 25,
      driveGaugeConsumed: 1,
      saGaugeConsumed: 0,
    });

    // ★★ここが本 spec の要 —— 素のデータでは何も検証できない。
    //   マーカーは技に立つので同じ技を使う全コンボへ及ぶ。⇒ 本 spec のコンボだけを
    //   影響ありにするため、基準の側を下げる(判定は「基準 < マーカー」で対称)。
    // ★分離の前提を明示的に確かめる(崩れたら件数も行の並びも当てにならない)。
    const current = await currentDataVersion(request);
    expect(
      MARKER < current,
      `★前提が崩れている: マーカー(${MARKER})は現在版(${current})より古くなければならない`,
    ).toBeTruthy();

    // ★3 本とも同じマーカーを立てる(どの test のコンボも点けられるようにする)。
    for (const m of moves) {
      await setMoveGameVersion(request, m.id, MARKER);
    }
    await setComboBaselineVersion(request, comboId, OLD_BASELINE);
  });

  test.afterAll(async ({ request }) => {
    // ★共有 DB を元へ戻す(D-399 (1))。マーカーは他 spec の判定にも効く。
    for (const m of moves) {
      await setMoveGameVersion(request, m.id, null);
    }
    if (comboId) await request.delete(`/api/combos/${comboId}`);
    // ★延期の記録も戻す —— 残すと、告知を見る spec が後から増えたときに
    //   実行順で黙って落ちる(rm -rf web/e2e/.tmp は run ごとにしか効かない)。
    await clearGameUpdatePostpone(request);
  });

  test("バナー → 専用画面 →「問題なし」→ 件数が減る", async ({ page, request }) => {
    const before = await gameUpdateNotice(request);
    expect(
      before.affectedCount,
      "★人工的に古い基準を作ったのに 0 件である(前提が崩れている)",
    ).toBeGreaterThan(0);

    // ★★640px 以上でもバナーが出ること(破壊確認 c)。
    //   HomePage だけにマウントすると、ここで消える。
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/combos?character_id=${characterId}`);
    await expect(page.getByTestId("game-update-banner")).toBeVisible();
    // ★バナーとボタンは同時に出る。
    await expect(page.getByTestId("game-update-button")).toBeVisible();

    await page.getByTestId("game-update-banner").getByRole("link").click();
    await expect(page).toHaveURL(/\/game-update\/combos$/);

    // ★★破壊確認 (a): 画面を開いただけでは基準は進まない。
    //   進むと利用者が見る前に警告が消える。★表が描画されてから読む。
    await expect(page.getByTestId("combo-affected-moves").first()).toBeVisible();
    expect(
      await baselineOf(request, comboId),
      "★専用画面を開いただけで基準が進んでいる",
    ).toBe(OLD_BASELINE);

    // ★本 spec が作った 1 件だけが出ていること(分離の確認)。
    await expect(page.getByTestId("combo-acknowledge")).toHaveCount(1);
    // ★どの技が変わったかが出ていること —— これが FR702 の目的そのものである。
    await expect(page.getByTestId("combo-affected-moves")).not.toHaveText("-");

    // 「問題なし」を押す。★1 件ずつだけである(一括の入口は無い)。
    await page.getByTestId("combo-acknowledge").click();

    // 件数が減ること。
    await expect
      .poll(async () => (await gameUpdateNotice(request)).affectedCount, {
        message: "「問題なし」を押しても件数が減らない",
      })
      .toBeLessThan(before.affectedCount);
    // 基準が現在版まで進んでいること。
    expect(await baselineOf(request, comboId)).toBe(
      await currentDataVersion(request),
    );
  });

  test("★★破壊確認 (b): 延期してもバナーだけが消え、一覧のボタンは消えない", async ({
    page,
    request,
  }) => {
    // 別のコンボで影響ありの状態を作り直す(前のテストで基準を進めたため)。
    const second = await createCombo(request, {
      characterId,
      isDraft: false,
      memo: `${STAMP}-b`,
      steps: [{ stepOrder: 1, moveId: moves[1].id }],
      starterMoveId: moves[1].id,
      hitType: "normal",
      position: "corner_self",
      opponentStance: "standing",
      opponentSize: "standard",
      damage: 1300,
      knockdownAdvantage: 26,
      driveGaugeConsumed: 1,
      saGaugeConsumed: 0,
    });
    await setComboBaselineVersion(request, second, OLD_BASELINE);

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/combos?character_id=${characterId}`);
    await expect(page.getByTestId("game-update-banner")).toBeVisible();

    await page.getByTestId("game-update-postpone").click();

    // バナーは消える。
    await expect(page.getByTestId("game-update-banner")).toBeHidden();
    // ★★ボタンは消えない —— ここが分水嶺である。LAN では 1 人の延期が全員に効くため、
    //   ボタンまで消すと他の利用者が入口を失う。
    await expect(page.getByTestId("game-update-button")).toBeVisible();

    // ★リロードしても同じであること(抑止はサーバ側のファイルが持つ)。
    await page.reload();
    await expect(page.getByTestId("game-update-button")).toBeVisible();
    await expect(page.getByTestId("game-update-banner")).toBeHidden();

    await request.delete(`/api/combos/${second}`);
  });

  test("専用画面の行アクション: コピーは出さず、削除で件数が減り、復元で戻る", async ({
    page,
    request,
  }) => {
    const third = await createCombo(request, {
      characterId,
      isDraft: false,
      memo: `${STAMP}-c`,
      steps: [{ stepOrder: 1, moveId: moves[2].id }],
      starterMoveId: moves[2].id,
      hitType: "normal",
      position: "corner_opponent",
      opponentStance: "standing",
      opponentSize: "standard",
      damage: 1400,
      knockdownAdvantage: 27,
      driveGaugeConsumed: 1,
      saGaugeConsumed: 0,
    });
    await setComboBaselineVersion(request, third, OLD_BASELINE);
    const before = (await gameUpdateNotice(request)).affectedCount;

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/game-update/combos");

    // ★★［コピー］は出さない —— コピーで生まれる行は基準が現在版で埋まるため
    //   「影響なし」として生まれ、元の行は影響ありのまま残る。
    //   ⇒ 直すための画面に置く操作ではない(2026-09-07 開発者判断)。
    await expect(page.getByRole("link", { name: "コピー" })).toHaveCount(0);

    // 対象の行は［詳細］リンクの href で特定する(レシピは他の行と同じ文字列になるため)。
    const row = page.locator("tr", {
      has: page.locator(`a[href="/combos/${third}"]`),
    });
    await expect(row).toHaveCount(1);

    // ★★［削除］は押すと確認が出る(押しても何も起きないボタンにしない)。
    await row.getByRole("link", { name: "削除" }).or(row.getByRole("button", { name: "削除" })).click();
    await expect(
      page.getByText("このコンボを削除しますか?(論理削除されます)"),
    ).toBeVisible();
    await page.getByRole("button", { name: "削除" }).last().click();

    // 行が消え、件数も減る。★件数と行数が別々に動かないこと。
    await expect(row).toHaveCount(0);
    await expect
      .poll(async () => (await gameUpdateNotice(request)).affectedCount, {
        message: "削除しても件数が減らない",
      })
      .toBe(before - 1);
    // ★打ち切りの注記が誤って出ないこと(上限に達していないため)。
    await expect(page.getByTestId("game-update-page-truncated")).toHaveCount(0);

    // ★★復元しても基準は最新化されない ⇒ 影響ありのまま戻る。
    const restore = await request.post(`/api/combos/${third}/restore`);
    expect(restore.ok(), `復元に失敗: ${restore.status()}`).toBeTruthy();
    const detail = await (await request.get(`/api/combos/${third}`)).json();
    expect(detail.baselineVersion, "★復元で基準が動いた").toBe(OLD_BASELINE);
    expect(detail.affectedByGameUpdate).toBe(true);
    await expect
      .poll(async () => (await gameUpdateNotice(request)).affectedCount)
      .toBe(before);

    await request.delete(`/api/combos/${third}`);
  });
});

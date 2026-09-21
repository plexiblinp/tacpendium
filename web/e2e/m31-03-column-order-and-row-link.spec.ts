import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

import { setComboBaselineVersion, setMoveGameVersion } from "./support/game-update";

// M31-03: 一覧の列の並び(案C)＋ 詳細への行内リンクの位置(ルート列)。
//
//   1: コンボ一覧          — 並びが案C どおり / 行内リンクはルート列にだけ在る
//   2: マイコンボ          — 同じ並び(共通部品を共有している)
//   3: 影響コンボ専用画面  — 同じ並び ＋ 専用の 3 列が後ろに続く
//   4: 【破壊確認】保存済みの列設定を持つ環境
//   5: キーボードで詳細へ到達できる
//
// ★★本 spec の中心は test 4 である。並びを変えるとき唯一重い問いは
//   「既に保存されている利用者の列設定に何が起きるか」であった(指示書 §0.2)。
//   ★★実装事実 = combo-list-columns-v1 に入るのは **boolean 9 個だけ**であり、
//     並びの情報を持たない。⇒ 並びは全員に届き、ON/OFF は無傷で残る。
//     ★「新規の利用者では正しい」だけでは示せない。localStorage を実際に汚してから見る。
//
// ★★破壊確認の区分の割り方 = 「ComboTable を import している面」で数えた 3 面から
//   1 件ずつ(指示書 §4.3 / SUPP-001 §5.5.4 (10))。★専用画面は列設定の扱いが違う ——
//   利用者の設定を読まず DEFAULT_COLUMN_VISIBILITY を渡す(CHANGE-164 §3)。⇒ 区分が別。
//
// ★判定キーは本 spec 固有にする(教訓 E-232)。E2E は DB を 1 本共有し、
//   ファイル単位では並行に走るため、他ファイルが作った行を掴まないようにする。
const STAMP = `m3103-${Date.now()}`;

/** 案C の並び(既定表示。★備考 / セットプレイ数 は既定 OFF なので出ない)。 */
const EXPECTED_DEFAULT_ORDER = [
  "ルート",
  "ダメージ",
  "ヒット種別",
  "始動位置",
  "相手の状態",
  "タグ",
  "登録状態",
];

const STORAGE_KEY = "combo-list-columns-v1";

// 人工的に作る「古い基準」とマーカー。★どちらも現在版より古くする ——
// マーカーは技に立つので、現在版より新しくすると他 spec のコンボまで影響ありになる。
const OLD_BASELINE = "2020.01.01.00";
const MARKER = "2020.06.01.00";

type Char = { id: number; code: string; nameJa: string };
type Move = { id: number; code: string; nameJa: string; category: string };
type Tag = { id: number; name: string; category?: string };

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
  expect(normals.length, "ryu の通常技が 3 本以上要る").toBeGreaterThan(2);
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

async function attachTag(
  request: APIRequestContext,
  comboId: number,
  tagId: number,
): Promise<void> {
  // ★PATCH は楽観ロックのため version が要る(M22-03)。現在値を読んでから送る。
  const cur = await request.get(`/api/combos/${comboId}`);
  expect(cur.ok(), `コンボ取得失敗: ${cur.status()}`).toBeTruthy();
  const version = (await cur.json()).version as number;
  const res = await request.patch(`/api/combos/${comboId}`, {
    data: { version, tagIds: [tagId] },
  });
  expect(res.ok(), `タグ紐付け失敗: ${res.status()} ${await res.text()}`).toBeTruthy();
}

/**
 * 表の見出しを左から読む。
 *
 * ★空の見出し(展開アイコン列 / 選択チェックボックス列)は落とす。
 *   ⇒ 戻り値は [ ...表示列, ...面ごとの追加列, "操作" ] になる。
 */
async function columnHeaders(page: Page): Promise<string[]> {
  const ths = page.locator("table thead th");
  await expect(ths.first()).toBeAttached();
  const texts = await ths.allTextContents();
  return texts.map((s) => s.trim()).filter((s) => s !== "");
}

test.describe("M31-03 列の並び(案C)と行内リンクの位置", () => {
  let characterId: number;
  let moves: Move[];
  let comboList: number;   // 一覧・保存済み設定の確認に使う
  let comboMy: number;     // マイコンボの確認に使う
  let comboUpdate: number; // 専用画面の確認に使う
  let statusTagId: number;
  let createdStatusTag = false;

  test.beforeAll(async ({ request }) => {
    const character = await ryu(request);
    characterId = character.id;
    moves = await normalMoves(request, characterId);

    // ★★重複判定(VAL-C02 = 同一キャラ・同一レシピ・同一状況)に当たらないよう、
    //   レシピと始動位置の両方を 3 件で違えている。★単発のレシピは seed の行と
    //   衝突する(実測 = 1 手だけのコンボは配布 seed に既に在る)。
    const base = (memo: string, steps: Move[], position: string) => ({
      characterId,
      isDraft: false,
      memo,
      steps: steps.map((m, i) => ({ stepOrder: i + 1, moveId: m.id })),
      starterMoveId: steps[0].id, // レシピ 1 手目と一致(VAL-C03)
      hitType: "punish_counter",
      position,
      opponentStance: "standing",
      opponentSize: "standard",
      // ★★M27-02b(VAL-C15): 本登録は 4 欄が必須である。
      damage: 3210,
      knockdownAdvantage: 30,
      driveGaugeConsumed: 2,
      saGaugeConsumed: 0,
    });

    // ★comboUpdate は moves[0] を含むこと —— 専用画面へ出すマーカーを
    //   moves[0] に立てるためである(下の setMoveGameVersion)。
    comboList = await createCombo(
      request,
      base(`${STAMP}-list`, [moves[0], moves[1]], "corner_opponent"),
    );
    comboMy = await createCombo(
      request,
      base(`${STAMP}-my`, [moves[1], moves[0]], "mid_screen"),
    );
    comboUpdate = await createCombo(
      request,
      base(`${STAMP}-upd`, [moves[0], moves[2]], "corner_self"),
    );

    // マイコンボへ出すには mycombo_status のタグが要る(既定の絞り込みは「使用中」)。
    //
    // ★★初期タグ「使用中 / 練習中 / 頻度低下」は **初回起動ウィザードが作る**
    //   (SUPP-001 §3.5)。⇒ seed には無く、E2E の使い捨て DB では居ないことがある。
    //   ★居なければ作る。★作ったときだけ afterAll で消す(既存のものは消さない ——
    //     利用者のデータを E2E が持ち去らないため)。
    const tagsRes = await request.get("/api/tags?category=mycombo_status");
    expect(tagsRes.ok(), `タグ取得失敗: ${tagsRes.status()}`).toBeTruthy();
    // ★GET /api/tags は **裸の配列**を返す({ items: [...] ではない)。
    const tags = (await tagsRes.json()) as Tag[];
    const inUse = tags.find((t) => t.name === "使用中");
    if (inUse) {
      statusTagId = inUse.id;
    } else {
      const created = await request.post("/api/tags", {
        data: { name: "使用中", category: "mycombo_status", color: "#10B981" },
      });
      expect(
        created.ok(),
        `mycombo_status タグの作成に失敗: ${created.status()} ${await created.text()}`,
      ).toBeTruthy();
      statusTagId = ((await created.json()) as { id: number }).id;
      createdStatusTag = true;
    }
    await attachTag(request, comboMy, statusTagId);

    // 専用画面へ 1 件出す。★基準を下げてから技へマーカーを立てる。
    await setComboBaselineVersion(request, comboUpdate, OLD_BASELINE);
    await setMoveGameVersion(request, moves[0].id, MARKER);
  });

  test.afterAll(async ({ request }) => {
    // ★共有状態(技のマーカー)を必ず戻す。戻さないと後続の spec が影響ありを拾う。
    await setMoveGameVersion(request, moves[0].id, null).catch(() => undefined);
    for (const id of [comboList, comboMy, comboUpdate]) {
      if (id) await request.delete(`/api/combos/${id}`).catch(() => undefined);
    }
    // ★本 spec が作ったときだけ消す。
    if (createdStatusTag && statusTagId) {
      await request.delete(`/api/tags/${statusTagId}`).catch(() => undefined);
    }
  });

  // ───────────────────────────────────────────────────────────────
  // 1: コンボ一覧(区分 1 / 3)
  // ───────────────────────────────────────────────────────────────
  test("1: 一覧の列が案C の並びで、行内リンクはルート列にだけ在る", async ({ page }) => {
    await page.goto(`/combos?character_id=${characterId}`);

    const headers = await columnHeaders(page);
    expect(
      headers.slice(0, EXPECTED_DEFAULT_ORDER.length),
      "一覧の列の並びが案C と違う",
    ).toEqual(EXPECTED_DEFAULT_ORDER);
    // ★末尾は操作列である(表示列の後ろに何も紛れていないこと)。
    expect(headers.at(-1)).toBe("操作");

    const row = page.locator("tr", { hasText: `${STAMP}-list` });
    await expect(row).toHaveCount(1);

    // ★★リンクは「移した」のであって「増やした」のではない。
    //   ⇒ ルート列に 1 本在ることと、状況 3 列に 0 本であることを両方見る。
    await expect(row.getByTestId("combo-recipe").getByRole("link")).toHaveCount(1);
    for (const id of ["combo-hit-type", "combo-position", "combo-opponent-stance"]) {
      await expect(
        row.getByTestId(id).getByRole("link"),
        `${id} にリンクが残っている`,
      ).toHaveCount(0);
    }

    // ★踏むと詳細へ行く。
    await row.getByTestId("combo-recipe").getByRole("link").click();
    await expect(page).toHaveURL(new RegExp(`/combos/${comboList}$`));
  });

  // ───────────────────────────────────────────────────────────────
  // 2: マイコンボ(区分 2 / 3)
  // ───────────────────────────────────────────────────────────────
  test("2: マイコンボも同じ並びである(共通部品を共有している)", async ({ page }) => {
    await page.goto(`/mycombo?character_id=${characterId}`);

    const row = page.locator("tr", { hasText: `${STAMP}-my` });
    await expect(row).toHaveCount(1);

    const headers = await columnHeaders(page);
    expect(
      headers.slice(0, EXPECTED_DEFAULT_ORDER.length),
      "マイコンボの列の並びが案C と違う",
    ).toEqual(EXPECTED_DEFAULT_ORDER);
    // ★マイコンボはステータス列を 1 本足す。表示列の後ろに来ること。
    expect(headers.slice(EXPECTED_DEFAULT_ORDER.length)).toEqual([
      "ステータス",
      "操作",
    ]);

    await expect(row.getByTestId("combo-recipe").getByRole("link")).toHaveCount(1);
  });

  // ───────────────────────────────────────────────────────────────
  // 3: 影響コンボの専用画面(区分 3 / 3)
  // ───────────────────────────────────────────────────────────────
  test("3: 専用画面も同じ並びで、専用の 3 列が後ろに続く", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/game-update/combos");

    const row = page.locator("tr", { hasText: `${STAMP}-upd` });
    await expect(row).toHaveCount(1);

    const headers = await columnHeaders(page);
    // ★★専用画面は利用者の列設定を読まず DEFAULT_COLUMN_VISIBILITY を渡す
    //   (CHANGE-164 §3)。⇒ 既定の並びがそのまま出る。
    expect(
      headers.slice(0, EXPECTED_DEFAULT_ORDER.length),
      "専用画面の列の並びが案C と違う",
    ).toEqual(EXPECTED_DEFAULT_ORDER);
    expect(headers.slice(EXPECTED_DEFAULT_ORDER.length)).toEqual([
      "変わった技",
      "前提バージョン",
      "問題なし",
      "操作",
    ]);

    await expect(row.getByTestId("combo-recipe").getByRole("link")).toHaveCount(1);
  });

  // ───────────────────────────────────────────────────────────────
  // 4: 【破壊確認】保存済みの列設定を持つ環境(★本 spec の中心)
  // ───────────────────────────────────────────────────────────────
  test("4: 保存済みの列設定を持つ環境で、ON/OFF は保たれ 並びは新しい既定になる", async ({
    page,
  }) => {
    // ★★実際に localStorage を汚してから開く。テストの既定値では再現しない。
    //   ★旧キー starterSituation を混ぜてある —— M27-03 がキーを上げなかったため、
    //     実環境にはこの形の保存値が残っている(useColumnVisibility の
    //     { ...DEFAULT, ...loaded } マージで余分なプロパティとして生き延びる)。
    await page.addInitScript(
      ([key, value]) => window.localStorage.setItem(key, value),
      [
        STORAGE_KEY,
        JSON.stringify({
          starterSituation: true, // ★存在しない旧キー
          hitType: true,
          position: true,
          opponentStance: true,
          damage: true,
          recipe: true,
          tags: false, // ★利用者が消したもの
          draftStatus: true,
          memo: true, // ★利用者が出したもの(既定は OFF)
          setupCount: false,
        }),
      ] as const,
    );

    await page.goto(`/combos?character_id=${characterId}`);
    await expect(page.locator("tr", { hasText: `${STAMP}-list` })).toHaveCount(1);

    const headers = await columnHeaders(page);

    // ★★並びは案C(新しい既定)。★ON/OFF は保存値どおり —— タグが消え、備考が出る。
    //
    // ★表示列は 7 本になる(タグを落とし、備考を足したため既定と同数)。
    //   ★★後ろに続く「ステータス / 操作」は表示列カスタマイズの対象外である ——
    //     コンボ一覧も onStatusChange を渡しており、マイコンボ専用の列ではない
    //     (実測。ここを取り違えると母集団を誤る = M-145 の一般形)。
    const EXPECTED_WITH_SAVED = [
      "ルート",
      "ダメージ",
      "ヒット種別",
      "始動位置",
      "相手の状態",
      "登録状態",
      "備考",
    ];
    expect(
      headers.slice(0, EXPECTED_WITH_SAVED.length),
      "保存済みの設定を持つ環境で、並びか ON/OFF のどちらかが期待と違う",
    ).toEqual(EXPECTED_WITH_SAVED);
    expect(headers.slice(EXPECTED_WITH_SAVED.length)).toEqual([
      "ステータス",
      "操作",
    ]);

    // ★★保存値は壊していない —— キーのバージョンを上げていないので読み書きは続く。
    const stored = await page.evaluate(
      (key) => window.localStorage.getItem(key),
      STORAGE_KEY,
    );
    expect(stored, "保存値が消えている(キーを上げてしまっていないか)").toBeTruthy();
    expect(JSON.parse(stored!).tags, "利用者の OFF が失われた").toBe(false);
    expect(JSON.parse(stored!).memo, "利用者の ON が失われた").toBe(true);
  });

  // ───────────────────────────────────────────────────────────────
  // 5: キーボード到達(リンクを移すと順送りの停止点が変わりうる)
  // ───────────────────────────────────────────────────────────────
  test("5: キーボードの順送りでルート列のリンクへ到達し、Enter で詳細へ行ける", async ({
    page,
  }) => {
    await page.goto(`/combos?character_id=${characterId}`);

    const row = page.locator("tr", { hasText: `${STAMP}-list` });
    await expect(row).toHaveCount(1);
    const link = row.getByTestId("combo-recipe").getByRole("link");
    await expect(link).toHaveCount(1);

    // ★★Tab の順送りだけで到達できることを見る(focus() を直接呼ばない ——
    //   それでは「順送りの停止点になっているか」を確かめたことにならない)。
    await page.locator("body").press("Tab");
    let reached = false;
    for (let i = 0; i < 80; i += 1) {
      if (await link.evaluate((el) => el === document.activeElement)) {
        reached = true;
        break;
      }
      await page.keyboard.press("Tab");
    }
    expect(reached, "Tab の順送りでルート列のリンクへ到達できない").toBe(true);

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/combos/${comboList}$`));
  });
});

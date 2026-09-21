import { test, expect, type Page } from "@playwright/test";

// M20-05: 既定プリセットへの追随と config の実在検査(カスタムプリセットを作らない面)。
//
// ★★ カスタムプリセットを作るテストは本ファイルに置いていない ★★
// `m20-04-preset-management.spec.ts` の「上限 8 件」テストとグローバル資源
// (プリセット総数)を奪い合うためである。playwright.config は `fullyParallel: false`
// だが **ファイル単位では並列に走る**ので、別ファイルに置くと両者が同時に
// プリセットを持ち、上限テストが 5 件目を作れずに落ちる(実測)。
// ⇒ プリセットを作る 2 本は同一ファイル(m20-04 spec)へ寄せて直列化した。
// 横断課題として followup `e2e-shared-global-resource-parallel` に記録してある。
//
// ★config.toml の初期状態を仮定しない。既定プリセットは開発者ごとに異なるため
// (`.gitignore` 管理外)、必要な値は明示的に設定し、最後に元へ戻す
// (M20-04 spec が同じ理由で開発者機だけ落ちた＝2026-08-13)。

interface PresetJSON {
  id: number;
  code: string;
  name: string;
  isBuiltin: boolean;
}

interface AliasJSON {
  moveId: number;
  moveCode: string;
  aliasText: string;
}

let originalPresetId: number;
let officialPresetId: number;

async function listPresets(page: Page): Promise<PresetJSON[]> {
  const res = await page.request.get("/api/presets");
  expect(res.ok(), `プリセット一覧取得失敗: ${res.status()}`).toBeTruthy();
  return (await res.json()) as PresetJSON[];
}

/** createComboWithStep は 1 ステップのコンボを作り、その id を返す。 */
async function createComboWithStep(page: Page, moveId: number): Promise<number> {
  const res = await page.request.post("/api/combos", {
    data: {
      characterId: 1,
      isDraft: true,
      memo: "m20-05",
      steps: [{ stepOrder: 1, moveId }],
    },
  });
  expect(res.ok(), `combo 作成失敗: ${res.status()} ${await res.text()}`).toBeTruthy();
  return (await res.json()).id as number;
}

async function recipeText(page: Page, comboId: number, presetId: number): Promise<string> {
  const res = await page.request.get(`/api/combos/${comboId}/recipe?preset_id=${presetId}`);
  expect(res.ok(), `recipe 取得失敗: ${res.status()} ${await res.text()}`).toBeTruthy();
  return (await res.json()).text as string;
}

test.describe("M20-05 recipe_cache 再計算の配線", () => {
  test.beforeAll(async ({ request }) => {
    const cfgRes = await request.get("/api/config");
    expect(cfgRes.ok(), `config 取得失敗: ${cfgRes.status()}`).toBeTruthy();
    originalPresetId = (await cfgRes.json()).defaults.presetId as number;

    // ★既定プリセットの id を直書きしない。`presets.id` は 1 / 3 / 5 と欠番があり
    // (migrations/000007_seed_presets)、番号を直書きすると本サブが撤去した「既定 = ID 1」の
    // 暗黙前提がテスト側で復活する(main.go は code から解決している)。
    const res = await request.get("/api/presets");
    expect(res.ok(), `プリセット一覧取得失敗: ${res.status()}`).toBeTruthy();
    const official = ((await res.json()) as PresetJSON[]).find(
      (p) => p.code === "official_ja_move",
    );
    if (!official) throw new Error("seed に official_ja_move が無い(配布クリーン前提崩れ)");
    officialPresetId = official.id;
  });

  test.afterAll(async ({ request }) => {
    // ★spec が config を書き換えたので元の値へ復元する。
    await request.put("/api/config", { data: { defaults: { presetId: originalPresetId } } });
  });

  // ★カスタムプリセットには触れない(作りも消しもしない)。
  // 本ファイルは組み込みプリセットだけで完結する面を持ち、`m20-04-preset-management.spec.ts`
  // とグローバル資源(プリセット総数)を奪い合わない。**消す側も同じ罠である**
  // ——上限 8 件のテストがカスタムを保持している最中に全削除を撃つと、そちらが数え損ねる。
  // プリセットを作る M20-05 のテストは m20-04 spec と同一ファイルに置いてある。
  test.beforeEach(async ({ page }) => {
    const res = await page.request.put("/api/config", {
      data: { defaults: { presetId: officialPresetId } },
    });
    expect(res.ok(), `config 初期化失敗: ${res.status()}`).toBeTruthy();
  });

  test.afterEach(async ({ page }) => {
    await page.request.put("/api/config", {
      data: { defaults: { presetId: officialPresetId } },
    });
  });

  test("★既定プリセットを切り替えると一覧の表記が切替先のものになる(D-313)", async ({
    page,
  }) => {
    const presets = await listPresets(page);
    const numeric = presets.find((p) => p.code === "numeric");
    expect(numeric, "組み込みプリセット numeric が無い").toBeTruthy();

    const aliasRes = await page.request.get(
      `/api/presets/${officialPresetId}/aliases?character_id=1&limit=1`,
    );
    const alias = ((await aliasRes.json()) as AliasJSON[])[0];
    const comboId = await createComboWithStep(page, alias.moveId);

    const asOfficial = await page.request.get(`/api/combos/${comboId}`);
    const officialRecipe = (await asOfficial.json()).defaultRecipe as string;

    const sw = await page.request.put("/api/config", {
      data: { defaults: { presetId: numeric!.id } },
    });
    expect(sw.ok(), `既定プリセット切替失敗: ${sw.status()} ${await sw.text()}`).toBeTruthy();

    const asNumeric = await page.request.get(`/api/combos/${comboId}`);
    const numericRecipe = (await asNumeric.json()).defaultRecipe as string;

    expect(numericRecipe, "切替後の表記が空になった").not.toBe("");
    expect(
      numericRecipe,
      `config を変えても表記が変わらない(${officialRecipe})。固定値を読んでいる`,
    ).not.toBe(officialRecipe);

    // ★グローバル資源(config)を握る時間を最小化する。afterEach でも戻すが、
    // ファイル単位で並列に走る他 spec の待ち時間を縮める。
    await page.request.put("/api/config", {
      data: { defaults: { presetId: officialPresetId } },
    });
  });

  test("★config が実在しないプリセットを指す更新は拒否される(§4.3-1)", async ({ page }) => {
    const res = await page.request.put("/api/config", {
      data: { defaults: { presetId: 999999 } },
    });
    expect(res.status(), "実在しないプリセットを指す更新が通ってしまった").toBe(422);

    // ★拒否されたあとも既定プリセットは元のままで、表示は壊れていない。
    const cfg = await page.request.get("/api/config");
    expect((await cfg.json()).defaults.presetId).not.toBe(999999);
  });

});

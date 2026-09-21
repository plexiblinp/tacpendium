import { test, expect, type Page } from "@playwright/test";
import { minimalDraftSteps } from "./support/draft-combo";

// M20-04: プリセット管理 UI の 1 周(一覧 → コピー → 編集 → 保存 → 削除)。
//
// ★本サブは「書き込み経路をはじめて作る」サブである。preset_aliases へ
// INSERT する本番コードは 2026-08-13 まで 1 つも存在しなかった(M20-03 実査)。
// したがって本 spec が守るのは画面の見た目ではなく、
//   (1) コピーでエイリアスが実体化され character_id が入ること
//   (2) 組み込みが API 直叩きでも 403 で守られること
//   (3) 削除で孤児行が残らないこと
// である。いずれも「無くてもアプリは動く」ため、検査が無いと気づけない。

const PRESETS_URL = "/presets";

// 使い捨て DB は毎回クリーンな seed 済みなので、組み込み 3 種だけが存在する。
const BUILTIN_COUNT = 3;
const PRESET_TOTAL_LIMIT = 8;

interface PresetJSON {
  id: number;
  code: string;
  name: string;
  isBuiltin: boolean;
  basePresetCode?: string;
}

interface CharacterJSON {
  id: number;
  code: string;
  nameJa: string;
}

// ★エイリアスを見るキャラは seed の code から解決する。id を直書きしない
// (`character_id=1` の直書きが本 spec の初回失敗の原因だった。下記 beforeEach の注記)。
let ryu: CharacterJSON;
// 開発者の config を壊さないため、既定プリセットの元の値を退避して最後に戻す。
let originalPresetId: number;

async function listPresets(page: Page): Promise<PresetJSON[]> {
  const res = await page.request.get("/api/presets");
  expect(res.ok(), `プリセット一覧取得失敗: ${res.status()}`).toBeTruthy();
  return (await res.json()) as PresetJSON[];
}

async function deleteCustomPresets(page: Page) {
  for (const p of await listPresets(page)) {
    if (!p.isBuiltin) {
      await page.request.delete(`/api/presets/${p.id}`);
    }
  }
}

/**
 * selectEditorCharacter は編集画面のキャラクターを明示的に選ぶ。
 *
 * ★これを省いてはならない。編集画面の初期キャラは `config` の
 * `[defaults] character_id` である(`PresetEditPage` が `useConfig` から初期化する)。
 * ★`config.toml` は `.gitignore` 管理外で開発者ごとに異なるため、
 * 「初期表示は ryu である」と仮定した spec は**その開発者の設定でだけ落ちる**。
 * 実際にそれで落ちた(2026-08-13・開発者機。`character_id = 5` で再現確認済み)。
 * ⇒ 画面が出すキャラを仮定せず、利用者と同じ操作で選ぶ(`moves-edit.spec.ts` と同型)。
 */
async function selectEditorCharacter(page: Page, character: CharacterJSON) {
  await page.getByLabel("編集するキャラクター").click();
  await page.getByRole("option", { name: character.nameJa, exact: true }).click();
}

test.describe("M20-04 プリセット管理", () => {
  test.beforeAll(async ({ request }) => {
    const charsRes = await request.get("/api/games/1/characters");
    expect(charsRes.ok(), `キャラ一覧取得失敗: ${charsRes.status()}`).toBeTruthy();
    const chars = (await charsRes.json()).items as CharacterJSON[];
    const found = chars.find((c) => c.code === "ryu");
    if (!found) throw new Error("seed に ryu が見つからない(配布クリーン前提崩れ)");
    ryu = found;

    const cfgRes = await request.get("/api/config");
    expect(cfgRes.ok(), `config 取得失敗: ${cfgRes.status()}`).toBeTruthy();
    originalPresetId = (await cfgRes.json()).defaults.presetId as number;
  });

  test.afterAll(async ({ request }) => {
    // ★開発者の既定プリセットを元へ戻す。E2E が利用者の設定を書き換えたままに
    // しない(既存 m18-* spec が `cfg.defaults?.presetId ?? 1` で保存しているのと同趣旨)。
    await request.put("/api/config", {
      data: { defaults: { presetId: originalPresetId } },
    });
  });

  test.beforeEach(async ({ page }) => {
    // 既定プリセットを 1(official_ja_move)へ一時的に戻す。config が削除対象を
    // 指していると削除が 409 で拒否されるため(D-313)。元の値は afterAll で復元する。
    // ★characterId は送らない。config の部分更新は nil のフィールドを触らないため
    // (`internal/service/config/service.go`)、開発者の既定キャラは保持される。
    const res = await page.request.put("/api/config", {
      data: { defaults: { presetId: 1 } },
    });
    expect(res.ok(), `config 初期化失敗: ${res.status()}`).toBeTruthy();
    await deleteCustomPresets(page);
  });

  test.afterEach(async ({ page }) => {
    await deleteCustomPresets(page);
  });

  test("一覧 → コピー → 編集 → 保存 → 削除の 1 周", async ({ page }) => {
    await page.goto(PRESETS_URL);

    // ── 一覧(DES-005 §5.10) ──────────────────────────────────────────
    await expect(page.getByRole("heading", { name: "プリセット管理" })).toBeVisible();
    // ★組み込みは 3 種である(M20-01 で 5 種 → 3 種)。
    await expect(page.getByTestId("preset-count")).toHaveText(
      `${BUILTIN_COUNT} / ${PRESET_TOTAL_LIMIT} 件`,
    );
    await expect(page.getByTestId("preset-custom-empty")).toBeVisible();

    const srk = (await listPresets(page)).find((p) => p.code === "srk");
    expect(srk, "seed に srk が無い").toBeTruthy();

    // ── コピー(§4.3) ────────────────────────────────────────────────
    await page.getByTestId(`preset-copy-${srk!.id}`).click();
    const nameInput = page.getByTestId("preset-copy-name-input");
    await expect(nameInput).toHaveValue("SRK 記法 のコピー");
    await nameInput.fill("E2E カスタム");
    await page.getByTestId("preset-copy-submit").click();

    await expect(page.getByTestId("preset-count")).toHaveText(
      `${BUILTIN_COUNT + 1} / ${PRESET_TOTAL_LIMIT} 件`,
    );

    const created = (await listPresets(page)).find((p) => p.name === "E2E カスタム");
    expect(created, "カスタムプリセットが作成されていない").toBeTruthy();
    expect(created!.isBuiltin).toBe(false);
    expect(created!.basePresetCode).toBe("srk");

    // ★エイリアスが実体化されていること。参照ではなく複製である(DES-004 §6.1)。
    const aliasRes = await page.request.get(
      `/api/presets/${created!.id}/aliases?character_id=${ryu.id}`,
    );
    expect(aliasRes.ok()).toBeTruthy();
    const aliases = (await aliasRes.json()) as Array<{
      moveId: number;
      characterId: number;
      aliasText: string;
    }>;
    expect(aliases.length, "コピー後にエイリアスが 0 件").toBeGreaterThan(0);
    // ★character_id が全行に入っていること(§4.3-2)。nullable であり、
    // 入れ忘れても INSERT は通るうえ UNIQUE にも当たらない = 落ちないバグ。
    for (const a of aliases) {
      expect(
        a.characterId,
        `moveId=${a.moveId} の characterId が ${ryu.id} でない`,
      ).toBe(ryu.id);
    }

    // ── 編集(DES-005 §5.11) ─────────────────────────────────────────
    await page.getByTestId(`preset-edit-${created!.id}`).click();
    await expect(page).toHaveURL(new RegExp(`/presets/${created!.id}/edit$`));
    await expect(page.getByTestId("preset-name-input")).toHaveValue("E2E カスタム");
    await expect(page.getByTestId("preset-base-code")).toHaveText("srk");
    // ★組み込みではないので読み取り専用の告知は出ない。
    await expect(page.getByTestId("preset-readonly-notice")).toHaveCount(0);

    // ★上で API から引いたのと同じキャラを画面でも選ぶ。初期表示のキャラは
    // config 依存であり、仮定すると開発者の設定次第で落ちる(関数の注記を参照)。
    await selectEditorCharacter(page, ryu);

    const target = aliases[0];
    const aliasInput = page.getByTestId(`alias-input-${target.moveId}`);
    await expect(aliasInput).toBeVisible();
    await aliasInput.fill("E2E表記");
    await expect(page.getByTestId("preset-dirty-count")).toBeVisible();

    // ── 保存 ────────────────────────────────────────────────────────
    await page.getByTestId("preset-save").click();
    await expect(page.getByTestId("preset-save")).toBeDisabled(); // 差分が消える

    const afterRes = await page.request.get(
      `/api/presets/${created!.id}/aliases?character_id=${ryu.id}`,
    );
    const after = (await afterRes.json()) as Array<{
      moveId: number;
      aliasText: string;
      characterId: number;
    }>;
    const saved = after.find((a) => a.moveId === target.moveId);
    expect(saved?.aliasText).toBe("E2E表記");
    // ★編集で character_id を巻き込んでいないこと。
    expect(saved?.characterId).toBe(ryu.id);

    // ── 削除(§4.5) ─────────────────────────────────────────────────
    await page.goto(PRESETS_URL);
    await page.getByTestId(`preset-delete-${created!.id}`).click();
    await page.getByTestId("preset-delete-confirm").click();

    await expect(page.getByTestId("preset-count")).toHaveText(
      `${BUILTIN_COUNT} / ${PRESET_TOTAL_LIMIT} 件`,
    );
    await expect(page.getByTestId("preset-custom-empty")).toBeVisible();

    // ★ここで確認しているのは「親が消えたこと」だけである。
    //
    // ListAliases は先に親の存在を見る(service.ListAliases → Get)ため、
    // ★子行が全件残っていても 404 が返る。この assertion で孤児行は検出できない。
    // 孤児 0 件は Go 側の 2 本が守っている——
    //   internal/service/preset/service_test.go Test_Delete_LeavesNoOrphanAliases
    //   （＋ Test_Delete_DeletesChildrenExplicitly が削除の呼び出し順を固定）
    const goneRes = await page.request.get(
      `/api/presets/${created!.id}/aliases?character_id=${ryu.id}`,
    );
    expect(goneRes.status(), "削除したプリセットがまだ引ける").toBe(404);
  });

  test("★組み込みプリセットは API 直叩きでも 403 で守られる", async ({ page }) => {
    // UI で操作を出さないだけでは、API を直接叩かれたときに組み込みが壊れる
    // (指示書 §4.4-4 の多層防御 / チェックリスト差し戻し事由 2)。
    const builtins = (await listPresets(page)).filter((p) => p.isBuiltin);
    expect(builtins).toHaveLength(BUILTIN_COUNT);

    for (const b of builtins) {
      const putRes = await page.request.put(`/api/presets/${b.id}`, {
        data: { name: "書き換え" },
      });
      expect(putRes.status(), `PUT /api/presets/${b.id} (${b.code})`).toBe(403);

      const delRes = await page.request.delete(`/api/presets/${b.id}`);
      expect(delRes.status(), `DELETE /api/presets/${b.id} (${b.code})`).toBe(403);
    }

    // 3 種とも無傷であること
    const after = await listPresets(page);
    expect(after.filter((p) => p.isBuiltin)).toHaveLength(BUILTIN_COUNT);
    for (const b of builtins) {
      expect(after.find((p) => p.id === b.id)?.name).toBe(b.name);
    }
  });

  test("組み込みプリセットの編集画面は読み取り専用になる", async ({ page }) => {
    const official = (await listPresets(page)).find(
      (p) => p.code === "official_ja_move",
    );
    await page.goto(`/presets/${official!.id}/edit`);

    await expect(page.getByTestId("preset-readonly-notice")).toBeVisible();
    await expect(page.getByTestId("preset-name-input")).toBeDisabled();
    await expect(page.getByTestId("preset-save")).toBeDisabled();
  });

  test("★上限 8 件を超えると作成できない(VAL-P05)", async ({ page }) => {
    // カスタム 5 件まで作れる(組み込み 3 + カスタム 5 = 8)。
    for (let i = 1; i <= PRESET_TOTAL_LIMIT - BUILTIN_COUNT; i++) {
      const res = await page.request.post("/api/presets", {
        data: { basePresetCode: "srk", name: `上限検証${i}` },
      });
      expect(res.status(), `${i} 件目`).toBe(201);
    }

    // 9 件目は拒否される。★5xx ではない。
    const over = await page.request.post("/api/presets", {
      data: { basePresetCode: "srk", name: "9件目" },
    });
    expect(over.status()).toBe(409);
    expect((await over.json()).error.code).toBe("preset_limit_exceeded");

    // 画面でも上限が伝わり、コピーが押せないこと。
    await page.goto(PRESETS_URL);
    await expect(page.getByTestId("preset-count")).toHaveText(
      `${PRESET_TOTAL_LIMIT} / ${PRESET_TOTAL_LIMIT} 件`,
    );
    await expect(page.getByTestId("preset-limit-notice")).toBeVisible();
    const srk = (await listPresets(page)).find((p) => p.code === "srk");
    await expect(page.getByTestId(`preset-copy-${srk!.id}`)).toBeDisabled();
  });

  test("★同一キャラ内の表記衝突は 409 で返り、500 にならない", async ({ page }) => {
    // 利用者の入力誤りであり、監視から見ると偽の障害になる(D-275 と同型)。
    const createRes = await page.request.post("/api/presets", {
      data: { basePresetCode: "numeric", name: "衝突検証" },
    });
    expect(createRes.status()).toBe(201);
    const created = (await createRes.json()) as PresetJSON;

    const aliasRes = await page.request.get(
      `/api/presets/${created.id}/aliases?character_id=${ryu.id}`,
    );
    const aliases = (await aliasRes.json()) as Array<{
      moveId: number;
      aliasText: string;
    }>;
    expect(aliases.length).toBeGreaterThan(1);

    const conflictRes = await page.request.put(`/api/presets/${created.id}`, {
      data: {
        aliases: [{ moveId: aliases[1].moveId, aliasText: aliases[0].aliasText }],
      },
    });
    expect(conflictRes.status(), "衝突を 5xx で返してはならない").toBe(409);
    const body = await conflictRes.json();
    expect(body.error.code).toBe("alias_conflict");
    // ★どの表記が衝突したかを伝えていること
    expect(body.error.details.aliasText).toBe(aliases[0].aliasText);
  });

  test("既定プリセットに設定中のカスタムは削除できない(D-313)", async ({ page }) => {
    const createRes = await page.request.post("/api/presets", {
      data: { basePresetCode: "srk", name: "既定にする" },
    });
    expect(createRes.status()).toBe(201);
    const created = (await createRes.json()) as PresetJSON;

    const cfgRes = await page.request.put("/api/config", {
      data: { defaults: { presetId: created.id } },
    });
    expect(cfgRes.ok()).toBeTruthy();

    const delRes = await page.request.delete(`/api/presets/${created.id}`);
    expect(delRes.status()).toBe(409);
    expect((await delRes.json()).error.code).toBe("preset_in_use_by_config");

    // 参照を外せば削除できる(afterEach の掃除もこれに依存する)。
    await page.request.put("/api/config", { data: { defaults: { presetId: 1 } } });
    const retry = await page.request.delete(`/api/presets/${created.id}`);
    expect(retry.status()).toBe(204);
  });

  test("★カスタムプリセットを選んでもレシピ表示が壊れない(§3.3-5)", async ({ page }) => {
    // ★M20-05 の配線後は作成時点で recipe_cache に当該 preset_id のエントリが入る。
    // 仮にエントリが無くても notation.ResolveComboRecipe がキャッシュミス時に
    // 遅延計算するため、どちらの経路でも表示は成立する(本 spec はその不変を見る)。
    const createRes = await page.request.post("/api/presets", {
      data: { basePresetCode: "srk", name: "表示検証" },
    });
    expect(createRes.status()).toBe(201);
    const created = (await createRes.json()) as PresetJSON;

    const comboRes = await page.request.post("/api/combos", {
      // ★M24-13: 仮登録でもレシピのステップ 1 本以上が要る(VAL-C09)。
      data: {
        characterId: 1,
        isDraft: true,
        knockdownAdvantage: 40,
        memo: "m20-04",
        steps: minimalDraftSteps(),
      },
    });
    expect(comboRes.ok(), `combo 作成失敗: ${comboRes.status()}`).toBeTruthy();
    const comboId = (await comboRes.json()).id as number;

    const recipeRes = await page.request.get(
      `/api/combos/${comboId}/recipe?preset_id=${created.id}`,
    );
    expect(
      recipeRes.ok(),
      `新規カスタムプリセットでレシピが引けない: ${recipeRes.status()} ${await recipeRes.text()}`,
    ).toBeTruthy();
    const recipe = await recipeRes.json();
    expect(recipe.presetId).toBe(created.id);
    expect(typeof recipe.text).toBe("string");

    await page.request.delete(`/api/combos/${comboId}`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// M20-05: recipe_cache 再計算の配線(★本ファイルに置く理由)
//
// 下の 2 本は**カスタムプリセットを作る**。上の「上限 8 件」テストと
// グローバル資源(プリセット総数)を奪い合うため、別ファイルへ置くと
// **ファイル単位の並列実行**で両者が同時にプリセットを持ち、上限テストが
// 5 件目を作れずに落ちる(2026-08-14 実測)。同一ファイル内は直列に走るため、
// ここへ置くことで衝突しない。
// ★プリセットを作らない M20-05 のテストは `m20-05-recipe-cache-wiring.spec.ts` にある。
// ─────────────────────────────────────────────────────────────────────────────

interface AliasJSON {
  moveId: number;
  moveCode: string;
  aliasText: string;
}

const M20_05_NEW_ALIAS = "M20-05検証表記";

test.describe("M20-05 recipe_cache 再計算の配線(プリセットを作る面)", () => {
  let m2005OriginalPresetId: number;

  test.beforeAll(async ({ request }) => {
    const cfgRes = await request.get("/api/config");
    expect(cfgRes.ok(), `config 取得失敗: ${cfgRes.status()}`).toBeTruthy();
    m2005OriginalPresetId = (await cfgRes.json()).defaults.presetId as number;
  });

  test.afterAll(async ({ request }) => {
    await request.put("/api/config", {
      data: { defaults: { presetId: m2005OriginalPresetId } },
    });
  });

  test.beforeEach(async ({ page }) => {
    const res = await page.request.put("/api/config", { data: { defaults: { presetId: 1 } } });
    expect(res.ok(), `config 初期化失敗: ${res.status()}`).toBeTruthy();
    await deleteCustomPresets(page);
  });

  test.afterEach(async ({ page }) => {
    await deleteCustomPresets(page);
  });

  async function firstAlias(page: Page, presetId: number): Promise<AliasJSON> {
    const res = await page.request.get(`/api/presets/${presetId}/aliases?character_id=1&limit=1`);
    expect(res.ok(), `エイリアス取得失敗: ${res.status()}`).toBeTruthy();
    const alias = ((await res.json()) as AliasJSON[])[0];
    expect(alias, "エイリアスが 1 件も無い(コピーが効いていない)").toBeTruthy();
    return alias;
  }

  async function createComboWithStep(page: Page, moveId: number): Promise<number> {
    const res = await page.request.post("/api/combos", {
      data: { characterId: 1, isDraft: true, memo: "m20-05", steps: [{ stepOrder: 1, moveId }] },
    });
    expect(res.ok(), `combo 作成失敗: ${res.status()} ${await res.text()}`).toBeTruthy();
    return (await res.json()).id as number;
  }

  async function recipeText(page: Page, comboId: number, presetId: number): Promise<string> {
    const res = await page.request.get(`/api/combos/${comboId}/recipe?preset_id=${presetId}`);
    expect(res.ok(), `recipe 取得失敗: ${res.status()} ${await res.text()}`).toBeTruthy();
    return (await res.json()).text as string;
  }

  test("★エイリアス編集 → コンボ表示が実際に追従する(stale が解消する)", async ({ page }) => {
    const created = await page.request.post("/api/presets", {
      data: { basePresetCode: "srk", name: "追従検証" },
    });
    expect(created.status()).toBe(201);
    const preset = (await created.json()) as PresetJSON;

    const alias = await firstAlias(page, preset.id);
    const comboId = await createComboWithStep(page, alias.moveId);
    const before = await recipeText(page, comboId, preset.id);
    expect(before, "作成直後にレシピが空である").not.toBe("");

    const upd = await page.request.put(`/api/presets/${preset.id}`, {
      data: { aliases: [{ moveId: alias.moveId, aliasText: M20_05_NEW_ALIAS }] },
    });
    expect(upd.ok(), `エイリアス更新失敗: ${upd.status()} ${await upd.text()}`).toBeTruthy();

    const after = await recipeText(page, comboId, preset.id);
    expect(
      after,
      `エイリアスを編集したのに表記が古いまま(${before})。再計算が配線されていない`,
    ).toContain(M20_05_NEW_ALIAS);
  });

  test("★プリセット削除で当該 preset_id のキーが孤児として残らない", async ({ page }) => {
    const created = await page.request.post("/api/presets", {
      data: { basePresetCode: "srk", name: "孤児検証" },
    });
    expect(created.status()).toBe(201);
    const preset = (await created.json()) as PresetJSON;

    const alias = await firstAlias(page, preset.id);
    const comboId = await createComboWithStep(page, alias.moveId);
    expect(await recipeText(page, comboId, preset.id)).not.toBe("");

    const del = await page.request.delete(`/api/presets/${preset.id}`);
    expect(del.status()).toBe(204);

    // ★キーが孤児として残っていないことは Go 側のテストが JSON を直接見て固定している。
    // ここでは利用者から見える帰結だけを見る: 削除したプリセットは引けず、
    // 既定プリセットの表示は巻き添えで壊れていない。
    const gone = await page.request.get(`/api/combos/${comboId}/recipe?preset_id=${preset.id}`);
    expect(gone.status(), "削除したプリセットでレシピが引けてしまう").toBe(404);

    const stillOk = await page.request.get(`/api/combos/${comboId}`);
    expect(stillOk.ok()).toBeTruthy();
    expect(
      (await stillOk.json()).defaultRecipe,
      "削除の巻き添えで既定プリセットの表記まで消えた",
    ).not.toBe("");
  });
});

import { test, expect, type APIRequestContext } from "@playwright/test";

// M22-03: 楽観排他が実際に効いていることを、通信の層で確かめる。
//
// ★本サブは「作る」サブではなく「固定する」サブである。利用者から見た挙動は
// 変わらないのが正しい。⇒ シナリオ A(非回帰)は既存 spec 群が担保しており、
// 本ファイルはシナリオ B(後から保存した側が拒否される)だけを持つ。
//
// ★見せ方は見ない。409 を利用者へどう伝えるか(画面・文言・再読込の導線)は
// M22-04 の担当である(指示書 §1.6-3)。ここで確かめるのは「拒否されること」と
// 「どの衝突かがエラーコードで読めること」までである。
//
// ★エラーコードまで見る理由(指示書 §1.4)——409 は一意制約違反でも返る
// (プリセットの表記衝突 alias_conflict 等)。ステータスだけを見ると、版の
// 突き合わせを外しても別の理由の 409 で緑になりうる。
//
// ★サーバの共有状態を書き換えない(D-399 (1))。本 spec が触るのは自分で作った
// コンボ・セットプレイだけである。config・プリセット・タグには一切触れない。
//
// ★後始末は完全ではない。コンボは物理削除できるが、本 spec はセットプレイ行を
// 残したまま終わる—— DELETE /api/combos/:id/permanent は combo_setup_results /
// combo_setups / combos を消すが setups は消さない(repository.go の HardDelete)。
// ⇒ 使い捨て DB の中に論理削除済みの setups 行が残る。GET /api/setups を
// 数える spec を将来足すときは、この残留を前提にすること。
//
// ★M23-02(2026-08-20)で DELETE /api/setups/:id/permanent が入り、
// 「現行 API でセットプレイ行を物理削除する手段が無い」という前提は失効した。
// 本 spec は後始末を足していない(本 spec の関心は楽観排他であり、残留は
// 上記のとおり既知の前提として引き継ぐ)。物理削除まで行う後片付けの実例は
// e2e/m23-02-setup-restore.spec.ts の afterEach にある。

const VERSION_CONFLICT = "version_conflict";

interface ComboJSON {
  id: number;
  version: number;
}

interface SetupJSON {
  id: number;
  version: number;
}

const CHARACTER_ID = 1;

/** starterMoveId は seed から 1 ステップぶんの技 id を引く(id を直書きしない)。 */
async function starterMoveId(request: APIRequestContext): Promise<number> {
  const res = await request.get(`/api/moves?character_id=${CHARACTER_ID}`);
  expect(res.ok(), `moves 取得失敗: ${res.status()}`).toBeTruthy();
  const moves = (await res.json()).items as Array<{ id: number; code: string }>;
  const m = moves.find((x) => x.code === "standing_light_punch") ?? moves[0];
  if (!m) throw new Error("seed に技が 1 件も無い(配布クリーン前提崩れ)");
  return m.id;
}

/**
 * createDraftCombo は仮登録のコンボを 1 件作り、その id と version を返す。
 *
 * ★1 ステップを持たせる。レシピが空のコンボは `GET /combos/:id/recipe` が 400 を返し、
 * キャッシュの経路まで到達できない(§5.1-9 の網が空振りする)。
 */
async function createDraftCombo(request: APIRequestContext, memo: string): Promise<ComboJSON> {
  const moveId = await starterMoveId(request);
  const res = await request.post("/api/combos", {
    data: {
      characterId: CHARACTER_ID,
      isDraft: true,
      memo,
      steps: [{ stepOrder: 1, moveId }],
    },
  });
  expect(res.ok(), `combo 作成失敗: ${res.status()} ${await res.text()}`).toBeTruthy();
  const body = (await res.json()) as ComboJSON;
  // 新規行は version = 1 から始まる(migrations/000001 の NOT NULL DEFAULT 1)。
  expect(body.version, "新規コンボの version").toBe(1);
  return body;
}

/**
 * destroyCombo は作ったコンボを論理削除 → 物理削除する。
 *
 * ★紐付いた setups 行は残る(冒頭の注記のとおり、本 spec は後始末を足していない)。
 */
async function destroyCombo(request: APIRequestContext, id: number): Promise<void> {
  await request.delete(`/api/combos/${id}`);
  await request.delete(`/api/combos/${id}/permanent`);
}

async function errorCode(res: { json: () => Promise<unknown> }): Promise<string> {
  const body = (await res.json()) as { error?: { code?: string } };
  return body.error?.code ?? "";
}

test.describe("M22-03 楽観排他 — 後から保存した側が拒否される", () => {
  test("PATCH /api/combos/:id: 2 つの文脈が同じ版を持ち、後の保存が 409 version_conflict になる", async ({
    request,
  }) => {
    const combo = await createDraftCombo(request, "m22-03 patch");
    try {
      // 2 つの文脈が同じコンボを開いた状態を作る(どちらも version = 1 を持つ)。
      const contextA = combo.version;
      const contextB = combo.version;

      // 先に保存した側は通る。
      // ★これが対照実験である。拒否側だけを見ると「常に拒否する」実装でも緑になる。
      const first = await request.patch(`/api/combos/${combo.id}`, {
        data: { version: contextA, memo: "A が保存した" },
      });
      expect(first.ok(), `先の保存が通らない: ${first.status()} ${await first.text()}`).toBeTruthy();
      expect((await first.json()).version, "保存で版が上がること").toBe(contextA + 1);

      // 後から保存した側は、古い版を持っているため拒否される。
      const second = await request.patch(`/api/combos/${combo.id}`, {
        data: { version: contextB, memo: "B が保存した" },
      });
      expect(second.status(), "後の保存は 409").toBe(409);
      expect(await errorCode(second), "版不一致のエラーコード").toBe(VERSION_CONFLICT);

      // B の編集内容は入っていない(上書き事故が起きていない)。
      const after = await request.get(`/api/combos/${combo.id}`);
      expect((await after.json()).memo).toBe("A が保存した");
    } finally {
      await destroyCombo(request, combo.id);
    }
  });

  test("PUT /api/combos/:id: キー変更編集でも後の保存が 409 version_conflict になる", async ({
    request,
  }) => {
    const combo = await createDraftCombo(request, "m22-03 put");
    const moveId = await starterMoveId(request);
    let replacementID: number | null = null;
    try {
      const stale = combo.version;

      // 先に PATCH で版を進める(別の文脈が保存した状況)。
      const bump = await request.patch(`/api/combos/${combo.id}`, {
        data: { version: stale, memo: "先に保存された" },
      });
      expect(bump.ok(), `事前の版更新に失敗: ${bump.status()} ${await bump.text()}`).toBeTruthy();

      // 古い版のまま PUT を撃つと拒否される。
      const put = await request.put(`/api/combos/${combo.id}`, {
        data: {
          version: stale,
          characterId: CHARACTER_ID,
          isDraft: true,
          memo: "古い版からの PUT",
          steps: [{ stepOrder: 1, moveId }],
        },
      });
      expect(put.status(), "古い版の PUT は 409").toBe(409);
      expect(await errorCode(put), "版不一致のエラーコード").toBe(VERSION_CONFLICT);

      // ★対照実験: 最新の版を渡せば通る。
      const current = (await (await request.get(`/api/combos/${combo.id}`)).json()) as ComboJSON;
      const ok = await request.put(`/api/combos/${combo.id}`, {
        data: {
          version: current.version,
          characterId: CHARACTER_ID,
          isDraft: true,
          memo: "最新の版からの PUT",
          steps: [{ stepOrder: 1, moveId }],
        },
      });
      expect(ok.ok(), `最新の版の PUT が通らない: ${ok.status()} ${await ok.text()}`).toBeTruthy();
      // PUT は旧行を論理削除して新しい行を作る。後始末のため新 id を控える。
      replacementID = (await ok.json()).id as number;
    } finally {
      await destroyCombo(request, combo.id);
      if (replacementID !== null) await destroyCombo(request, replacementID);
    }
  });

  test("PATCH /api/setups/:id: セットプレイでも後の保存が 409 version_conflict になる", async ({
    request,
  }) => {
    const combo = await createDraftCombo(request, "m22-03 setup");
    try {
      const created = await request.post(`/api/combos/${combo.id}/setups`, {
        data: {
          characterId: CHARACTER_ID,
          name: "m22-03 セットプレイ",
          steps: [{ moveId: await starterMoveId(request) }],
        },
      });
      expect(
        created.ok(),
        `セットプレイ作成失敗: ${created.status()} ${await created.text()}`,
      ).toBeTruthy();
      const setup = (await created.json()) as SetupJSON;

      const stale = setup.version;

      const first = await request.patch(`/api/setups/${setup.id}`, {
        data: { name: "A が保存した", version: stale },
      });
      expect(first.ok(), `先の保存が通らない: ${first.status()} ${await first.text()}`).toBeTruthy();

      const second = await request.patch(`/api/setups/${setup.id}`, {
        data: { name: "B が保存した", version: stale },
      });
      expect(second.status(), "後の保存は 409").toBe(409);
      expect(await errorCode(second), "版不一致のエラーコード").toBe(VERSION_CONFLICT);
    } finally {
      await destroyCombo(request, combo.id);
    }
  });

  // M22-03 §4.5 / §5.1-9 の as-built を通信の層でも固定する。
  //
  // ★「直っていない」ことを固定するのが目的である。recipe_cache の更新は
  // combos.updated_at を進めるが version は進めない(契約 F-5 で凍結)。
  // ⇒ updated_at が進んでいても版が同じ状態が正常に起こりうる。
  // 次の担当が「ずれている = バグだ」と読んで直すのを防ぐ。
  test("recipe_cache の再計算を挟んでも版は据え置かれ、再計算前に取った版で保存できる", async ({
    request,
  }) => {
    const combo = await createDraftCombo(request, "m22-03 cache");
    try {
      const before = combo.version;

      // レシピを読むとキャッシュの遅延計算が走る(combos.recipe_cache を更新する経路)。
      // ★preset_id は必須。id を直書きせず組み込みプリセットから引く
      //   (presets.id には欠番があり、直書きすると「既定 = ID 1」の暗黙前提が復活する)。
      const presets = (await (await request.get("/api/presets")).json()) as Array<{
        id: number;
        code: string;
      }>;
      const official = presets.find((p) => p.code === "official_ja_move") ?? presets[0];
      expect(official, "組み込みプリセットが 1 件も無い(配布クリーン前提崩れ)").toBeTruthy();

      const recipe = await request.get(
        `/api/combos/${combo.id}/recipe?preset_id=${official!.id}`,
      );
      expect(
        recipe.ok(),
        `recipe 取得失敗: ${recipe.status()} ${await recipe.text()}`,
      ).toBeTruthy();
      // ★対照: 解決が実際に走ったこと(空振りしていないこと)を確かめる。
      // これが無いと「キャッシュ経路を通っていないから版が上がらなかった」でも緑になる。
      expect(((await recipe.json()).text as string).length, "レシピが解決されている").toBeGreaterThan(0);

      const after = (await (await request.get(`/api/combos/${combo.id}`)).json()) as ComboJSON;
      expect(after.version, "キャッシュ更新で版を上げてはならない").toBe(before);

      // 再計算前に取った版のまま保存できる。
      const save = await request.patch(`/api/combos/${combo.id}`, {
        data: { version: before, memo: "キャッシュ後も旧版で保存できる" },
      });
      expect(save.ok(), `旧版での保存が通らない: ${save.status()} ${await save.text()}`).toBeTruthy();
    } finally {
      await destroyCombo(request, combo.id);
    }
  });
});

import { test, expect } from "@playwright/test";

// M17-02: 段階2 解決表配信 API(GET /api/characters/:characterId/command-index)の疎通(BE 範囲・UI なし)。
// 畳み済み解決表(token_key → move_code)が seed 実データで返ること・空中特殊技/モーションの
// 非混入(死守契約=スコープ遵守)・未 seed キャラの空応答(壊れない)を確認する。
// UI 消費(仮想コントローラ)は M17-03 で別途 E2E 化する。
//
// 前提: E2E 使い捨て DB(全マイグレ適用済み=新系列 000009 が終端)。バックエンドおよび Vite dev が起動していること。

const STAGE2_KEY_PATTERN = /^[1-9]?(LP|MP|HP|LK|MK|HK)$/;

test.describe("M17-02 command 索引 解決表配信 API", () => {
  test("seed 済みキャラの解決表・未 seed 空応答・不正 ID 400", async ({
    page,
  }) => {
    // ── キャラ id 解決 ──────────────────────────────────────────────────
    const charsRes = await page.request.get("/api/games/1/characters");
    expect(charsRes.ok()).toBeTruthy();
    const chars = (await charsRes.json()).items as Array<{
      id: number;
      code: string;
    }>;
    const idOf = (code: string) => {
      const c = chars.find((x) => x.code === code);
      expect(c, `character ${code} not seeded`).toBeTruthy();
      return c!.id;
    };

    // ── ryu: 単方向特殊技・しゃがみ通常・スコープ遵守 ──────────────────
    const ryuRes = await page.request.get(
      `/api/characters/${idOf("ryu")}/command-index`,
    );
    expect(ryuRes.status()).toBe(200);
    const ryu = (await ryuRes.json()) as {
      characterId: number;
      entries: Record<string, string>;
    };
    expect(ryu.entries["2MP"]).toBe("crouching_medium_punch");
    expect(ryu.entries["6HP"]).toBe("solar_plexus_strike");
    expect(ryu.entries["236LP"]).toBeUndefined();
    for (const key of Object.keys(ryu.entries)) {
      expect(key, `段階2 形状外のキーが混入: ${key}`).toMatch(
        STAGE2_KEY_PATTERN,
      );
    }

    // ── lily: 空中特殊技(great_spin)の非混入 ───────────────────────────
    const lilyRes = await page.request.get(
      `/api/characters/${idOf("lily")}/command-index`,
    );
    expect(lilyRes.status()).toBe(200);
    const lily = (await lilyRes.json()) as {
      entries: Record<string, string>;
    };
    expect(lily.entries["2HP"]).toBe("crouching_heavy_punch");

    // ── 索引を持たないキャラ id は 200 + 空(壊れない) ─────────────────
    const emptyRes = await page.request.get(
      "/api/characters/999999/command-index",
    );
    expect(emptyRes.status()).toBe(200);
    const empty = (await emptyRes.json()) as {
      entries: Record<string, string>;
    };
    expect(Object.keys(empty.entries)).toHaveLength(0);

    // ── 不正 ID は 400 ──────────────────────────────────────────────────
    const badRes = await page.request.get("/api/characters/abc/command-index");
    expect(badRes.status()).toBe(400);
  });
});

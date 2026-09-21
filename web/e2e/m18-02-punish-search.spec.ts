import { test, expect } from "@playwright/test";
import { minimalDraftSteps } from "./support/draft-combo";

// M18-02: 確定反撃サーチ(探す画面)の E2E。
// A: 走査 → 始動技を採用 → コンボを採用 → 採用が永続化される(主軸=ジャストパリィタブ)。
// B: 既存機能の非回帰(hit_type 4 値の表示=E-14)。
//
// テストは決定論性のため、走査前に相手技の recovery / 始動技のあるコンボを API で用意する
// (使い捨て DB・全マイグレ+seed 適用済み。ジャストパリィタブは有利=相手技の recovery)。

type Char = { id: number; code: string };
type Move = { id: number; code: string; category: string };
type MoveDetail = {
  id: number;
  code: string;
  category: string;
  damage: number | null;
  startup: number | null;
  isAerial: boolean;
};

type Req = import("@playwright/test").APIRequestContext;

async function chars(request: Req) {
  const res = await request.get("/api/games/1/characters");
  expect(res.ok()).toBeTruthy();
  return (await res.json()).items as Char[];
}

async function movesOf(request: Req, characterId: number) {
  const res = await request.get(`/api/moves?character_id=${characterId}`);
  expect(res.ok()).toBeTruthy();
  return (await res.json()).items as Move[];
}

// pickAttack は damage>0(必要なら startup<=maxStartup)の通常技を 1 件返す。
// GET /api/moves は damage を投影しないため、候補ごとに GET /api/moves/:id で確認する。
async function pickAttack(
  request: Req,
  moves: Move[],
  maxStartup?: number,
): Promise<MoveDetail | null> {
  for (const m of moves) {
    if (m.category !== "normal") continue;
    const res = await request.get(`/api/moves/${m.id}`);
    if (!res.ok()) continue;
    const d = (await res.json()) as MoveDetail;
    if ((d.damage ?? 0) <= 0) continue;
    if (d.isAerial) continue; // 空中攻撃は走査対象外(相手技として除外される)
    if (maxStartup != null && (d.startup ?? 999) > maxStartup) continue;
    return d;
  }
  return null;
}

test.describe("M18-02 確定反撃サーチ", () => {
  // UI 遷移前に初期設定(ウィザード)完了状態を保証する。単独実行でも /wizard へ
  // リダイレクトされないようにする(フルスイートでは初期化済みのため冪等にスキップ)。
  test.beforeEach(async ({ page }) => {
    const req = page.request;
    const cfg = await (await req.get("/api/config")).json();
    if (!cfg.isInitialized) {
      await req.put("/api/config", {
        data: {
          server: { mode: cfg.server?.mode ?? "local" },
          defaults: {
            characterId: cfg.defaults?.characterId ?? 1,
            presetId: cfg.defaults?.presetId ?? 1,
          },
        },
      });
    }
  });

  test("A: 走査→始動技採用→コンボ採用→永続化(ジャストパリィ)", async ({
    page,
  }) => {
    const request = page.request;
    const cs = await chars(request);
    const idOf = (code: string) => {
      const c = cs.find((x) => x.code === code);
      expect(c, `character ${code} not seeded`).toBeTruthy();
      return c!.id;
    };
    const ryu = idOf("ryu");
    const ken = idOf("ken");

    // ── 決定論セットアップ ───────────────────────────────────────────────
    // 相手技(ken の通常技・damage>0)の recovery を 30 に設定 → ジャストパリィ有利=30。
    const kenMoves = await movesOf(request, ken);
    const oppMove = await pickAttack(request, kenMoves);
    expect(oppMove, "ken の通常攻撃技が見つからない").toBeTruthy();
    const patchRes = await request.patch(`/api/moves/${oppMove!.id}`, {
      data: { recovery: 30 },
    });
    expect(patchRes.ok()).toBeTruthy();

    // 自技(ryu の速い通常技・startup <= 30)を始動技に使う。
    const ryuMoves = await movesOf(request, ryu);
    const starter = await pickAttack(request, ryuMoves, 30);
    expect(starter, "ryu の速い通常攻撃技が見つからない").toBeTruthy();

    // 始動技を 1 手目に持つコンボを作成(孫として現れる)。
    const createRes = await request.post("/api/combos", {
      data: {
        characterId: ryu,
        isDraft: true,
        memo: `e2e-punish-${Date.now()}`,
        starterMoveId: starter!.id, // レシピ 1 手目と一致(VAL-C03)。BE はこの値で starter を保持
        steps: [{ stepOrder: 1, moveId: starter!.id }],
      },
    });
    expect(createRes.ok(), await createRes.text()).toBeTruthy();
    const comboId = (await createRes.json()).id as number;

    // ── 走査(GET /api/punish-finder) ─────────────────────────────────────
    const scan = async () => {
      const res = await request.get(
        `/api/punish-finder?self_character_id=${ryu}&opponent_character_id=${ken}&guard_type=just_parry`,
      );
      expect(res.ok()).toBeTruthy();
      return (await res.json()) as {
        nodes: Array<{
          moveId: number;
          starters: Array<{
            moveId: number;
            verdict?: string;
            combos: Array<{ comboId: number; adopted: boolean }>;
          }>;
        }>;
      };
    };

    let tree = await scan();
    const node = tree.nodes.find((n) => n.moveId === oppMove!.id);
    expect(node, "PATCH した相手技が成立レーンに出ていない").toBeTruthy();
    const st = node!.starters.find((s) => s.moveId === starter!.id);
    expect(st, "始動技候補が出ていない").toBeTruthy();
    expect(st!.verdict, "初期は未検証(verdict なし)").toBeUndefined();
    const grandchild = st!.combos.find((c) => c.comboId === comboId);
    expect(grandchild, "作成したコンボが孫に現れていない").toBeTruthy();
    expect(grandchild!.adopted).toBe(false);

    // ── 始動技を採用 ─────────────────────────────────────────────────────
    const adoptStarter = await request.post("/api/combo-punish-starters", {
      data: {
        selfCharacterId: ryu,
        opponentMoveId: oppMove!.id,
        starterMoveId: starter!.id,
        verdict: "adopted",
      },
    });
    expect(adoptStarter.status()).toBe(204);

    // ── コンボを採用 ─────────────────────────────────────────────────────
    const adoptCombo = await request.post("/api/combo-punishes", {
      data: { comboId, opponentMoveId: oppMove!.id },
    });
    expect(adoptCombo.status()).toBe(204);

    // ── 永続化の確認(再走査) ─────────────────────────────────────────────
    tree = await scan();
    const node2 = tree.nodes.find((n) => n.moveId === oppMove!.id)!;
    const st2 = node2.starters.find((s) => s.moveId === starter!.id)!;
    expect(st2.verdict, "始動技の採用が永続化されていない").toBe("adopted");
    const gc2 = st2.combos.find((c) => c.comboId === comboId)!;
    expect(gc2.adopted, "コンボの採用が永続化されていない").toBe(true);

    // ── UI スモーク: 画面が 3 階層ツリーを描画する ───────────────────────
    await page.goto(
      `/punish/search?self=${ryu}&opp=${ken}&guard=just_parry`,
    );
    await expect(
      page.getByRole("heading", { name: "確定反撃サーチ" }),
    ).toBeVisible();
    // 成立レーンに候補(有利フレーム表示)が出る。
    await expect(page.getByText(/有利 \+/).first()).toBeVisible();
  });

  test("B: hit_type 4 値の表示 非回帰(E-14)", async ({ page }) => {
    const request = page.request;
    const cs = await chars(request);
    const ryu = cs.find((x) => x.code === "ryu")!.id;

    // just_parry_punish_counter を持つコンボを作成し、詳細画面でラベルが表示されることを確認。
    const createRes = await request.post("/api/combos", {
      data: {
        characterId: ryu,
        isDraft: true,
        hitType: "just_parry_punish_counter",
        memo: `e2e-hittype-${Date.now()}`,
        // ★M24-13: 仮登録でもレシピのステップ 1 本以上が要る(VAL-C09)。
        steps: minimalDraftSteps(),
      },
    });
    expect(createRes.ok(), await createRes.text()).toBeTruthy();
    const comboId = (await createRes.json()).id as number;

    // BE 4 値 non-regression: hit_type が API で往復すること。
    const getRes = await request.get(`/api/combos/${comboId}`);
    expect(getRes.ok()).toBeTruthy();
    expect((await getRes.json()).hitType).toBe("just_parry_punish_counter");

    // UI 表示 non-regression(E-14): 詳細画面に 4 値目のラベルが表示される。
    await page.goto(`/combos/${comboId}`);
    await expect(
      page.getByText(/パニッシュカウンター.*ジャストパリィ反撃/),
    ).toBeVisible();
  });
});

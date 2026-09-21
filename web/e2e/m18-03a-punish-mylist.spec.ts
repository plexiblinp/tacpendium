import { test, expect } from "@playwright/test";
import { minimalDraftSteps } from "./support/draft-combo";

// M18-03a: 確定反撃マイリスト(使う画面)＋隠したもの管理の E2E。
// A: 1 本動線(E-20) 探す→採用→マイリストに出る→隠す→消える→隠したもの管理で解除→戻る。
// B: 片道操作の解消 探す画面で pruning→消える→マイリストの隠したもの管理で解除→戻る。
// C: 区分を判定できない反撃(hit_type が normal/counter/NULL)がどちらのタブにも出ず、
//    第3セクションに出る(開発者確定 2026-07-26)。
//
// M18-02 spec と同じく、決定論性のため相手技の recovery と始動技付きコンボを API で用意する
// (使い捨て DB・全マイグレ+seed 適用済み)。

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

type ListedCombo = { comboId: number; hitType?: string; recipe?: string };

type PunishListResponse = {
  nodes: Array<{ moveId: number; combos: ListedCombo[] }>;
  unclassifiedNodes: Array<{ moveId: number; combos: ListedCombo[] }>;
  hiddenPrunings: Array<{ opponentMoveId: number }>;
  hiddenCurations: Array<{ comboId: number; opponentMoveId: number }>;
};

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
// 自技(始動技)の選択にのみ使う read-only ヘルパー。
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
    if (d.isAerial) continue; // 空中攻撃は走査対象外
    if (maxStartup != null && (d.startup ?? 999) > maxStartup) continue;
    return d;
  }
  return null;
}

// OPPONENT_MOVE_CODE は相手技として使う ken の飛び道具。
//
// 飛び道具は damage>0 かつ is_projectile=1 のため、走査では必ず「自動判定できない相手技」
// (distance_dependent)に落ちる＝フレームデータを書き換えずに結果を固定できる。
// m18-02 spec が PATCH する通常技とは別の技なので、ファイル並列時にも版衝突しない
// (相手技へ一切書き込まないため、そもそも競合対象にならない)。
const OPPONENT_MOVE_CODE = "hadoken_light";

// pickByCode は code 指定で 1 件返す(書き込みなしで決定論を得るため)。
function pickByCode(moves: Move[], code: string): Move {
  const m = moves.find((x) => x.code === code);
  expect(m, `move ${code} not seeded`).toBeTruthy();
  return m!;
}

async function fetchList(
  request: Req,
  self: number,
  guard = "just_parry",
): Promise<PunishListResponse> {
  const res = await request.get(`/api/punish-list?self=${self}&guard=${guard}`);
  expect(res.ok(), await res.text()).toBeTruthy();
  return (await res.json()) as PunishListResponse;
}

function listedCombos(nodes: PunishListResponse["nodes"]): number[] {
  return nodes.flatMap((n) => n.combos.map((c) => c.comboId));
}

test.describe("M18-03a 確定反撃マイリスト", () => {
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

  test("A: 採用→マイリストに出る→隠す→消える→解除→戻る(1 本動線)", async ({
    page,
  }) => {
    const request = page.request;
    const cs = await chars(request);
    const ryu = cs.find((x) => x.code === "ryu")!.id;
    const ken = cs.find((x) => x.code === "ken")!.id;

    // ── 決定論セットアップ ───────────────────────────────────────────────
    // マイリストの母集合は combo_punishes であり、フレーム判定に依存しない。
    // よって相手技のフレームデータを書き換える必要は無い(PATCH を一切しない)。
    const kenMoves = await movesOf(request, ken);
    const oppMove = pickByCode(kenMoves, OPPONENT_MOVE_CODE);

    const ryuMoves = await movesOf(request, ryu);
    const starter = await pickAttack(request, ryuMoves, 30);
    expect(starter, "ryu の速い通常攻撃技が見つからない").toBeTruthy();

    // マイリストのジャストパリィタブに出るよう hit_type を just_parry_punish_counter にする。
    const createRes = await request.post("/api/combos", {
      data: {
        characterId: ryu,
        isDraft: true,
        hitType: "just_parry_punish_counter",
        memo: `e2e-mylist-${Date.now()}`,
        starterMoveId: starter!.id,
        steps: [{ stepOrder: 1, moveId: starter!.id }],
      },
    });
    expect(createRes.ok(), await createRes.text()).toBeTruthy();
    const comboId = (await createRes.json()).id as number;

    // 採用前はマイリストに出ない。
    let list = await fetchList(request, ryu);
    expect(listedCombos(list.nodes)).not.toContain(comboId);

    // ── 探す画面で確定反撃に採用 ─────────────────────────────────────────
    expect(
      (
        await request.post("/api/combo-punishes", {
          data: { comboId, opponentMoveId: oppMove!.id },
        })
      ).status(),
    ).toBe(204);

    // ── マイリストに出る ─────────────────────────────────────────────────
    list = await fetchList(request, ryu);
    expect(listedCombos(list.nodes), "採用したコンボがマイリストに出ない").toContain(
      comboId,
    );

    // UI スモーク: 画面が 2 階層ツリーを描画する。
    await page.goto(`/punish/list?self=${ryu}&guard=just_parry`);
    await expect(
      page.getByRole("heading", { name: "確定反撃マイリスト" }),
    ).toBeVisible();
    await expect(page.getByText(/コンボ \d+件/).first()).toBeVisible();
    // 相手技ノードを展開するとコンボ行が出る。
    // retry 安全性: 残存行があると対象コンボが先頭ノード配下に無いことがあるため、
    // 「先頭を 1 つ」ではなく出ているノードをすべて展開する(クリックで aria-label が
    // collapse に変わり locator 集合から外れるので、初期件数を上限にループする)。
    const initialExpanders = await page.getByLabel("expand").count();
    for (let i = 0; i < initialExpanders; i++) {
      const remaining = page.getByLabel("expand");
      if ((await remaining.count()) === 0) break;
      await remaining.first().click();
    }
    await expect(page.getByText(`コンボ #${comboId}`)).toBeVisible();

    // レシピが行に出る(2026-07-26 開発者フィードバック 7)。
    // recipe_cache はサーバがレシピから生成するため、実値は API の返却値を正とする
    // (文字列をテスト側にベタ書きせず、BE と FE が同じ値を出していることを見る)。
    const listedRecipe = list.nodes
      .flatMap((n) => n.combos)
      .find((c) => c.comboId === comboId)?.recipe;
    expect(listedRecipe, "マイリスト API がレシピを返していない").toBeTruthy();
    // 1 手コンボではレシピ文字列が始動技名と一致する。
    // ★★M24-07 レビュー(中-6)の取り込みで locator を変えた —— 以前は行内の完全一致で
    //   見ていたが、それは「始動技名の span が『自分の始動技 立ち弱P』という連結文字列
    //   だから完全一致では当たらない」ことに依存していた。帰属ラベルをバッジへ揃えて
    //   技名が単独の span になった時点で、この前提は消えた(strict mode 違反で赤くなった)。
    // ★主張は変えていない —— レシピが行に出ており、その値が API の返却値と一致すること。
    //   ⇒ 「どの span を見るか」を testid で名指しし、偶然の一致に頼らない形にする。
    await expect(
      page
        .locator("li")
        .filter({ hasText: `コンボ #${comboId}` })
        .last()
        .getByTestId("punish-mylist-recipe"),
    ).toHaveText(listedRecipe!);

    // PC 系のマイリスト本体には curation 導線を出さない。
    // M18-03c で第3セクションにだけ「使わない」を追加した裁定を維持する。
    await expect(
      page
        .locator("li")
        .filter({ hasText: `コンボ #${comboId}` })
        .last()
        .getByRole("button", { name: "使わない", exact: true }),
    ).toHaveCount(0);

    // ── curation で隠す(API 経由)→ マイリストから消える ─────────────────
    // UI 導線は撤去したが BE の表示制御は生きている。API で作って挙動を検証する。
    expect(
      (
        await request.post("/api/combo-punish-curations", {
          data: { comboId, opponentMoveId: oppMove!.id, note: "使わない" },
        })
      ).status(),
    ).toBe(204);

    list = await fetchList(request, ryu);
    expect(listedCombos(list.nodes), "隠した反撃がマイリストに残っている").not.toContain(
      comboId,
    );
    expect(
      list.hiddenCurations.some((c) => c.comboId === comboId),
      "隠したもの管理に curation が出ていない",
    ).toBe(true);

    // ── 「隠したもの管理」で解除 → マイリストに戻る ─────────────────────
    await page.goto(`/punish/list?self=${ryu}&tab=hidden`);
    await expect(page.getByRole("heading", { name: "使わない反撃" })).toBeVisible();
    await expect(page.getByText(`コンボ #${comboId}`)).toBeVisible();
    // 対象行にスコープして解除する(残存行があっても別行を操作しない)。
    await page
      .locator("li")
      .filter({ hasText: `コンボ #${comboId}` })
      .last()
      .getByRole("button", { name: "解除して再表示" })
      .click();
    await expect(page.getByText(`コンボ #${comboId}`)).toBeHidden();

    list = await fetchList(request, ryu);
    expect(listedCombos(list.nodes), "解除後にマイリストへ戻っていない").toContain(
      comboId,
    );
    expect(list.hiddenCurations.some((c) => c.comboId === comboId)).toBe(false);

    // ── 採用解除で curation が孤児にならない(§4.1) ───────────────────────
    expect(
      (
        await request.post("/api/combo-punish-curations", {
          data: { comboId, opponentMoveId: oppMove!.id },
        })
      ).status(),
    ).toBe(204);
    expect(
      (
        await request.delete("/api/combo-punishes", {
          data: { comboId, opponentMoveId: oppMove!.id },
        })
      ).status(),
    ).toBe(204);
    list = await fetchList(request, ryu);
    expect(
      list.hiddenCurations.some((c) => c.comboId === comboId),
      "採用解除後に curation が孤児として残っている",
    ).toBe(false);
  });

  test("B: pruning で隠す→探す画面から消える→マイリストで解除→戻る(片道操作の解消)", async ({
    page,
  }) => {
    const request = page.request;
    const cs = await chars(request);
    const ryu = cs.find((x) => x.code === "ryu")!.id;
    const ken = cs.find((x) => x.code === "ken")!.id;

    // 飛び道具なので、書き込みなしで必ず「自動判定できない相手技」に出る。
    const kenMoves = await movesOf(request, ken);
    const oppMove = pickByCode(kenMoves, OPPONENT_MOVE_CODE);

    const scanMoveIds = async () => {
      const res = await request.get(
        `/api/punish-finder?self_character_id=${ryu}&opponent_character_id=${ken}&guard_type=just_parry`,
      );
      expect(res.ok()).toBeTruthy();
      const tree = (await res.json()) as {
        nodes: Array<{ moveId: number }>;
        manualReviewNodes: Array<{ moveId: number }>;
      };
      return [
        ...tree.nodes.map((n) => n.moveId),
        ...tree.manualReviewNodes.map((n) => n.moveId),
      ];
    };

    // retry 安全性: 前回の試行で pruning が残っていると前提 assert が落ちるため、
    // 先に解除して既知の状態から始める(存在しないキーの DELETE は 204 で壊れない)。
    await request.delete("/api/combo-punish-prunings", {
      data: { selfCharacterId: ryu, opponentMoveId: oppMove!.id },
    });
    expect(await scanMoveIds(), "前提: 相手技が探す画面に出ている").toContain(
      oppMove!.id,
    );

    // 探す画面で pruning。
    expect(
      (
        await request.post("/api/combo-punish-prunings", {
          data: { selfCharacterId: ryu, opponentMoveId: oppMove!.id, note: "届かない" },
        })
      ).status(),
    ).toBe(204);
    expect(await scanMoveIds(), "pruning 後も探す画面に残っている").not.toContain(
      oppMove!.id,
    );

    // マイリストの「隠したもの管理」に出て、解除できる(片道操作にならない)。
    let list = await fetchList(request, ryu);
    expect(list.hiddenPrunings.some((p) => p.opponentMoveId === oppMove!.id)).toBe(true);

    await page.goto(`/punish/list?self=${ryu}&tab=hidden`);
    await expect(
      page.getByRole("heading", { name: "確定反撃のない技" }),
    ).toBeVisible();
    const pruningRow = page.locator("li").filter({ hasText: "理由: 届かない" }).last();
    // 直前に API で作った行の初回描画を待つ。E2E 実行環境は並列 worker からの SQLite
    // 書き込み競合でバックエンドが詰まることがあり、既定 5s では足りない場合がある
    // (競合そのものは本サブ以前からの既知事象・完了報告 §4.2)。
    await expect(pruningRow).toBeVisible({ timeout: 15_000 });
    await pruningRow.getByRole("button", { name: "解除して再表示" }).click();
    await expect(page.getByText("理由: 届かない")).toBeHidden();

    list = await fetchList(request, ryu);
    expect(list.hiddenPrunings.some((p) => p.opponentMoveId === oppMove!.id)).toBe(false);
    expect(await scanMoveIds(), "解除後に探す画面へ戻っていない").toContain(
      oppMove!.id,
    );
  });

  test("C: 区分を判定できない反撃(hit_type が normal/NULL)が第3セクションに出る", async ({
    page,
  }) => {
    const request = page.request;
    const cs = await chars(request);
    const ryu = cs.find((x) => x.code === "ryu")!.id;
    const ken = cs.find((x) => x.code === "ken")!.id;

    const kenMoves = await movesOf(request, ken);
    const oppMove = pickByCode(kenMoves, OPPONENT_MOVE_CODE);

    // hit_type=normal と hit_type 未設定(NULL)の 2 件を採用する。
    const mk = async (hitType?: string) => {
      const res = await request.post("/api/combos", {
        data: {
          characterId: ryu,
          isDraft: true,
          ...(hitType ? { hitType } : {}),
          memo: `e2e-unclassified-${hitType ?? "null"}-${Date.now()}`,
          // ★M24-13: 仮登録でもレシピのステップ 1 本以上が要る(VAL-C09)。
          steps: minimalDraftSteps(),
        },
      });
      expect(res.ok(), await res.text()).toBeTruthy();
      return (await res.json()).id as number;
    };
    const normalCombo = await mk("normal");
    const nullCombo = await mk();
    // retry 安全性: 毎回新しいコンボを作るため id は衝突しないが、assert は
    // 「その id が含まれる/含まれない」だけを見る(件数に依存させない)。

    for (const id of [normalCombo, nullCombo]) {
      expect(
        (
          await request.post("/api/combo-punishes", {
            data: { comboId: id, opponentMoveId: oppMove!.id },
          })
        ).status(),
      ).toBe(204);
    }

    // どちらのタブでも nodes に出ず、unclassifiedNodes に出る。
    for (const guard of ["block", "just_parry"]) {
      const list = await fetchList(request, ryu, guard);
      const inTab = listedCombos(list.nodes);
      const unclassified = listedCombos(list.unclassifiedNodes);
      for (const id of [normalCombo, nullCombo]) {
        expect(inTab, `guard=${guard}: 区分不明がタブ側に出ている`).not.toContain(id);
        expect(
          unclassified,
          `guard=${guard}: 区分不明が第3セクションに出ていない`,
        ).toContain(id);
      }
    }

    // UI: 件数付きの見出しが出て、展開すると次のアクションが読める。
    await page.goto(`/punish/list?self=${ryu}&guard=just_parry`);
    const heading = page.getByText(/区分を判定できない反撃\(\d+ 件\)/);
    await expect(heading).toBeVisible();
    await heading.click();
    // M18-03b 実装時に告知文言を書き換え済み(旧「変換機能は M18-03b で対応予定です。」は
    // web/src に存在しない＝DES-005 §5.21 に記録あり)。現行の変換導線の案内へ追随させる。
    await expect(
      page.getByText(/「パニッシュカウンター版を作る」/),
    ).toBeVisible();
  });
});

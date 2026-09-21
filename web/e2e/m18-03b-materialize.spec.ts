import { test, expect } from "@playwright/test";

// M18-03b: materialize(確定反撃のパニッシュカウンター版を別コンボとして生成)の E2E。
// A: 1 本動線(E-20 の完成) 探す→normal を採用→第3セクションに出る→変換→
//    上の一覧(punish_counter タブ=guard block)に生成元バッジ付きで出る→第3セクションから消える。
// B: FR301 同じ変換をもう一度→生成されず既存 id を返す(件数不変)。
// C: 編集経路の引き継ぎ(§4.6) 採用済みコンボの識別キーを変更して編集→マイリストから消えない。
// D: 既存機能の非回帰は既存 spec 群(combo-crud / combo-csv-io 等)が同一スイートでカバーする。
//    ここでは materialize 後もコンボ CRUD(作成→取得)が壊れていないことを軽くスモークする。
//
// 決定論性のため、マイリストの母集合 combo_punishes を API で直接用意する(フレーム判定に
// 依存しない)。相手技のフレームデータは書き換えない(moves へ書き込まない=SQLite 競合回避)。

type Char = { id: number; code: string };
type Move = { id: number; code: string; category: string };
type MoveDetail = { id: number; damage: number | null; startup: number | null; isAerial: boolean };
type Req = import("@playwright/test").APIRequestContext;

type ListedCombo = { comboId: number; hitType?: string; materializedFromComboId?: number };
type PunishListResponse = {
  nodes: Array<{ moveId: number; combos: ListedCombo[] }>;
  unclassifiedNodes: Array<{ moveId: number; combos: ListedCombo[] }>;
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

function pickByCode(moves: Move[], code: string): Move {
  const m = moves.find((x) => x.code === code);
  expect(m, `move ${code} not seeded`).toBeTruthy();
  return m!;
}

// 始動技: damage>0 の地上通常技(× 0.2 加算の対象になるものを 1 件)。
async function pickStarter(request: Req, moves: Move[]): Promise<MoveDetail> {
  for (const m of moves) {
    if (m.category !== "normal") continue;
    const res = await request.get(`/api/moves/${m.id}`);
    if (!res.ok()) continue;
    const d = (await res.json()) as MoveDetail;
    if ((d.damage ?? 0) <= 0 || d.isAerial) continue;
    return d;
  }
  throw new Error("no ground normal starter found");
}

async function fetchList(request: Req, self: number, guard: string): Promise<PunishListResponse> {
  const res = await request.get(`/api/punish-list?self=${self}&guard=${guard}`);
  expect(res.ok(), await res.text()).toBeTruthy();
  return (await res.json()) as PunishListResponse;
}

const idsIn = (nodes: PunishListResponse["nodes"]) =>
  nodes.flatMap((n) => n.combos.map((c) => c.comboId));
const combosFlat = (r: PunishListResponse) => [
  ...r.nodes.flatMap((n) => n.combos),
  ...r.unclassifiedNodes.flatMap((n) => n.combos),
];

// createNormalCombo は normal ヒットの基底コンボを作る。
// VAL-C02(同一キー+同一レシピの重複)は published にのみ効くため、既定は isDraft=true にして
// seed 済みコンボ(id=1)や他テストとのキー衝突を避ける。FR301 を検証する経路のみ
// published(isDraft=false)+ 一意な position を渡す(生成物も published になり dup 判定に載る)。
async function createNormalCombo(
  request: Req,
  ryu: number,
  starterId: number,
  memo: string,
  opts: { isDraft?: boolean; position?: string } = {},
) {
  const res = await request.post("/api/combos", {
    data: {
      characterId: ryu,
      isDraft: opts.isDraft ?? true,
      hitType: "normal",
      position: opts.position ?? "corner_self",
      opponentStance: "standing",
      opponentSize: "standard",
      damage: 1000,
      // ★M27-02b(VAL-C15) / ★★M38-01: 本登録(isDraft:false)で呼ぶケースがあるため入れる。
      //   ★仮登録のときは掛からないが、同じ payload を使うので常に入れておく。
      //   ★★M38-01 で必須欄が 2 欄になり、サーバが咎めるのは
      //     damage / knockdownAdvantage だけになった。⇒ 消費ゲージは余分である。
      knockdownAdvantage: 30,
      driveGaugeConsumed: 1,
      saGaugeConsumed: 0,
      memo,
      starterMoveId: starterId,
      steps: [{ stepOrder: 1, moveId: starterId }],
    },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  return (await res.json()).id as number;
}

test.describe("M18-03b materialize", () => {
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

  test("A: 採用→第3セクション→変換→生成元バッジ付きで一覧に出る→第3セクションから消える", async ({
    page,
  }) => {
    const request = page.request;
    const cs = await chars(request);
    const ryu = cs.find((x) => x.code === "ryu")!.id;
    const ken = cs.find((x) => x.code === "ken")!.id;
    const opp = pickByCode(await movesOf(request, ken), "hadoken_light");
    const starter = await pickStarter(request, await movesOf(request, ryu));

    const base = await createNormalCombo(request, ryu, starter.id, `e2e-mat-A-${Date.now()}`);
    // 採用 → normal なので guard=block タブには出ず、第3セクション(unclassified)に出る。
    expect(
      (await request.post("/api/combo-punishes", { data: { comboId: base, opponentMoveId: opp.id } })).status(),
    ).toBe(204);

    let list = await fetchList(request, ryu, "block");
    expect(idsIn(list.unclassifiedNodes), "採用直後は第3セクションに出る").toContain(base);
    expect(idsIn(list.nodes)).not.toContain(base);

    // 変換(materialize)。
    const matRes = await request.post(`/api/combos/${base}/materialize`, {
      data: { opponentMoveId: opp.id },
    });
    expect(matRes.ok(), await matRes.text()).toBeTruthy();
    const mat = (await matRes.json()) as { comboId: number; alreadyExisted: boolean; damageAdded: boolean };
    expect(mat.alreadyExisted).toBe(false);
    expect(mat.damageAdded, "normal 始動なのでダメージが加算される").toBe(true);
    const gen = mat.comboId;

    list = await fetchList(request, ryu, "block");
    // 生成物は punish_counter タブ(guard=block)に、生成元バッジ(materializedFromComboId)付きで出る。
    const genNode = combosFlat(list).find((c) => c.comboId === gen);
    expect(idsIn(list.nodes), "生成物が punish_counter タブに出ない").toContain(gen);
    expect(genNode?.materializedFromComboId, "生成元 id が付いていない(バッジ根拠)").toBe(base);
    // 基底は第3セクションから消える(入力キューを処理した)。
    expect(idsIn(list.unclassifiedNodes), "基底が第3セクションに残っている").not.toContain(base);

    // UI スモーク: マイリスト(block タブ)に生成元バッジが出る。
    await page.goto(`/punish/list?self=${ryu}&guard=block`);
    // データ読込を待ってから展開する(未読込のまま件数 0 で展開ループを素通りするのを防ぐ)。
    await expect(page.getByText(/コンボ \d+件/).first()).toBeVisible({ timeout: 15_000 });
    const expanders = await page.getByLabel("expand").count();
    for (let i = 0; i < expanders; i++) {
      const remaining = page.getByLabel("expand");
      if ((await remaining.count()) === 0) break;
      await remaining.first().click();
    }
    await expect(page.getByText(`コンボ #${gen}`)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("PC版(生成)").first()).toBeVisible();
  });

  test("B: FR301 同じ変換をもう一度→生成されず既存 id を返す", async ({ page }) => {
    const request = page.request;
    const cs = await chars(request);
    const ryu = cs.find((x) => x.code === "ryu")!.id;
    const ken = cs.find((x) => x.code === "ken")!.id;
    const opp = pickByCode(await movesOf(request, ken), "hadoken_light");
    const starter = await pickStarter(request, await movesOf(request, ryu));

    // FR301 は published(is_draft=0)にのみ効くため base/gen とも published にする。
    // 他テスト(draft)・seed と衝突しない一意な position を使う。
    const base = await createNormalCombo(request, ryu, starter.id, `e2e-mat-B-${Date.now()}`, {
      isDraft: false,
      position: "corner_opponent",
    });

    const first = await request.post(`/api/combos/${base}/materialize`, { data: { opponentMoveId: opp.id } });
    expect(first.ok(), await first.text()).toBeTruthy();
    const firstJson = (await first.json()) as { comboId: number; alreadyExisted: boolean };
    expect(firstJson.alreadyExisted).toBe(false);

    const listAfterFirst = await fetchList(request, ryu, "block");
    const countAfterFirst = idsIn(listAfterFirst.nodes).length;

    const second = await request.post(`/api/combos/${base}/materialize`, { data: { opponentMoveId: opp.id } });
    expect(second.ok(), await second.text()).toBeTruthy();
    const secondJson = (await second.json()) as { comboId: number; alreadyExisted: boolean };
    expect(secondJson.alreadyExisted, "2 回目は既存扱い").toBe(true);
    expect(secondJson.comboId, "同じ生成物 id を返す").toBe(firstJson.comboId);

    const listAfterSecond = await fetchList(request, ryu, "block");
    expect(idsIn(listAfterSecond.nodes).length, "2 回目で件数が増えていない").toBe(countAfterFirst);
  });

  test("C: 識別キー変更編集で採用が引き継がれる(§4.6・マイリストから消えない)", async ({
    page,
  }) => {
    const request = page.request;
    const cs = await chars(request);
    const ryu = cs.find((x) => x.code === "ryu")!.id;
    const ken = cs.find((x) => x.code === "ken")!.id;
    const opp = pickByCode(await movesOf(request, ken), "hadoken_light");
    const starter = await pickStarter(request, await movesOf(request, ryu));

    // just_parry_punish_counter で作り、guard=just_parry タブに出す。
    // 再実行(retry)や seed とのキー衝突を避けるため draft(VAL-C02 は published のみ)。
    const createRes = await request.post("/api/combos", {
      data: {
        characterId: ryu,
        isDraft: true,
        hitType: "just_parry_punish_counter",
        position: "mid_screen",
        opponentStance: "standing",
        opponentSize: "standard",
        damage: 1500,
        memo: `e2e-mat-C-${Date.now()}`,
        starterMoveId: starter.id,
        steps: [{ stepOrder: 1, moveId: starter.id }],
      },
    });
    expect(createRes.ok(), await createRes.text()).toBeTruthy();
    const created = await createRes.json();
    const oldId = created.id as number;
    const version = created.version as number;

    expect(
      (await request.post("/api/combo-punishes", { data: { comboId: oldId, opponentMoveId: opp.id } })).status(),
    ).toBe(204);
    let list = await fetchList(request, ryu, "just_parry");
    expect(idsIn(list.nodes), "採用がタブに出る").toContain(oldId);

    // 識別キー変更(position 変更)を伴う編集 = 旧を論理削除して新コンボを作る経路。
    const putRes = await request.put(`/api/combos/${oldId}`, {
      data: {
        version,
        characterId: ryu,
        isDraft: true,
        hitType: "just_parry_punish_counter",
        position: "corner_self",
        opponentStance: "standing",
        opponentSize: "standard",
        damage: 1500,
        starterMoveId: starter.id,
        steps: [{ stepOrder: 1, moveId: starter.id }],
        setupCarryOptions: { mode: "carry_all" },
      },
    });
    expect(putRes.ok(), await putRes.text()).toBeTruthy();
    const newId = (await putRes.json()).id as number;
    expect(newId).not.toBe(oldId);

    // 採用は新コンボへ引き継がれ、マイリストから消えない(旧 id は消え、新 id が出る)。
    list = await fetchList(request, ryu, "just_parry");
    const ids = idsIn(list.nodes);
    expect(ids, "編集で採用が silent に消えている(§4.6 未達)").toContain(newId);
    expect(ids, "旧コンボ id は残らない").not.toContain(oldId);
  });

  test("D: materialize 後もコンボ CRUD が壊れていない(非回帰スモーク)", async ({ page }) => {
    const request = page.request;
    const cs = await chars(request);
    const ryu = cs.find((x) => x.code === "ryu")!.id;
    const ken = cs.find((x) => x.code === "ken")!.id;
    const opp = pickByCode(await movesOf(request, ken), "hadoken_light");
    const starter = await pickStarter(request, await movesOf(request, ryu));

    const base = await createNormalCombo(request, ryu, starter.id, `e2e-mat-D-${Date.now()}`);
    expect(
      (await request.post(`/api/combos/${base}/materialize`, { data: { opponentMoveId: opp.id } })).ok(),
    ).toBeTruthy();

    // materialize 後に別のコンボを普通に作成→取得できる(CRUD 非回帰)。
    const other = await createNormalCombo(request, ryu, starter.id, `e2e-mat-D2-${Date.now()}`);
    const getRes = await request.get(`/api/combos/${other}`);
    expect(getRes.ok(), await getRes.text()).toBeTruthy();
    expect((await getRes.json()).id).toBe(other);
  });
});

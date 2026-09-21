import { test, expect, type APIRequestContext } from "@playwright/test";
import { minimalDraftSteps } from "./support/draft-combo";

// M37-03: ゴミ箱の並び(B01)。
//
// ★★本サブは着手時 3 件(B01 / B03 / B15)だったが、2 件が開発者判断で落ちた。
//   ★B03(マイコンボのタグ固定表示)＝2026-09-13 に本 MS から除外。
//   ★★B15(ヒット種別に空中ヒット)＝2026-09-13 に **差し戻し**。
//     逐語＝「相手の状態で『空中』はこちらがあれば充分で、ヒット区分はいらなかった」。
//     ⇒ 相手の状態(opponent_stance)の airborne＝「空中」と区分が重複していた。
//     経緯と差戻の全数は完了報告 §0 を見ること。
//
// ★判定キーは本 spec 固有にする(教訓 E-232)。E2E は DB を 1 本共有し、
//   ファイル単位では並行に走るため、他ファイルが作った行を掴まないようにする。
const STAMP = `m3703-${Date.now()}`;

type Char = { id: number; code: string; nameJa: string };

async function ryu(request: APIRequestContext): Promise<Char> {
  const res = await request.get("/api/games/1/characters");
  expect(res.ok()).toBeTruthy();
  const chars = (await res.json()).items as Char[];
  const found = chars.find((c) => c.code === "ryu");
  if (!found) throw new Error("seed に ryu が居ない(配布クリーン状態の前提崩れ)");
  return found;
}

async function createCombo(
  request: APIRequestContext,
  data: Record<string, unknown>,
): Promise<number> {
  const res = await request.post("/api/combos", { data });
  expect(
    res.ok(),
    `コンボ作成に失敗: ${res.status()} ${await res.text()}`,
  ).toBeTruthy();
  return ((await res.json()) as { id: number }).id;
}

// ─────────────────────────────────────────────────────────────────────────────
// B01: ゴミ箱を削除日時で並べる
//
// ★★要求は「削除日時の表示」ではなく「並び順」である(指示書 §0.3)。
//   ⇒ 削除日時が画面に出ていることで閉じない。
//
// ★本番の SoftDelete は datetime('now') の **秒精度**であるため、2 件の削除の間に
//   1 秒より長い待ちを挟む。⇒ 日時が同着にならず、並びが日時で決まる。
//   (秒未満の同着時に id 降順へ落ちることは Go 側 TestList_TrashDefaultOrder_TieBreaksByIDDesc
//    が固定している。ここでは待ちを入れて日時そのものを見る。)
// ─────────────────────────────────────────────────────────────────────────────
test.describe("B01: ゴミ箱が削除日時の降順で並ぶ", () => {
  test("後から消したコンボが上に来る(画面で判定)", async ({ page }) => {
    const characterId = (await ryu(page.request)).id;

    const first = await createCombo(page.request, {
      characterId,
      isDraft: true,
      position: "mid_screen",
      memo: `${STAMP}-trash-first`,
      steps: minimalDraftSteps(),
    });
    const second = await createCombo(page.request, {
      characterId,
      isDraft: true,
      position: "mid_screen",
      memo: `${STAMP}-trash-second`,
      steps: minimalDraftSteps(),
    });

    // ★★先に作った行(id 小)を *後から* 消す。
    //   ⇒ 削除日時の降順なら first が上、旧挙動(id 昇順)なら first が下になる。
    //     どちらの答えになるかで並びが判別できる。
    const delSecond = await page.request.delete(`/api/combos/${second}`);
    expect(delSecond.ok()).toBeTruthy();

    // 秒精度のため 1 秒より長く待つ(同着を避ける)。
    await page.waitForTimeout(1200);

    const delFirst = await page.request.delete(`/api/combos/${first}`);
    expect(delFirst.ok()).toBeTruthy();

    await page.goto("/trash");

    // ★行の識別は詳細リンクの href で行う(ゴミ箱の行はメモを出さないため)。
    const firstLink = page.locator(`a[href="/trash/combos/${first}"]`);
    const secondLink = page.locator(`a[href="/trash/combos/${second}"]`);
    await expect(firstLink).toHaveCount(1);
    await expect(secondLink).toHaveCount(1);

    // 画面に出ている全リンクの並びの中で、どちらが先に現れるかを見る。
    // ★★他の spec が残したゴミ箱の行が混ざりうるため、件数では判定しない。
    //   自分が作った 2 件の **相対順序**だけを見る(教訓 E-232 と同じ構え)。
    const hrefs = await page
      .locator('a[href^="/trash/combos/"]')
      .evaluateAll((els) => els.map((e) => e.getAttribute("href")));
    const idxFirst = hrefs.indexOf(`/trash/combos/${first}`);
    const idxSecond = hrefs.indexOf(`/trash/combos/${second}`);
    expect(idxFirst, "first のリンクが画面に在る").toBeGreaterThanOrEqual(0);
    expect(idxSecond, "second のリンクが画面に在る").toBeGreaterThanOrEqual(0);
    expect(
      idxFirst,
      `後から消した ${first} が先に消した ${second} より上に来る(削除日時の降順)`,
    ).toBeLessThan(idxSecond);

    // ★削除日時の列が出ていること自体は従来どおり(B01 はこれを要求していないが、
    //   並びを直した結果として壊していないことを見る)。
    await expect(
      page.getByRole("columnheader", { name: "削除日時" }).first(),
    ).toBeVisible();
  });
});

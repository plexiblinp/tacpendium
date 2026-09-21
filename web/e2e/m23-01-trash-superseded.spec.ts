import { test, expect, type Page } from "@playwright/test";
import { minimalDraftSteps } from "./support/draft-combo";

// M23-01: PUT(キー変更編集)が積む旧行をゴミ箱の既定から外す(D-460)。
//
// ★本 spec の要は「対で見る」ことである。「編集で積まれた旧行が出ない」だけを確認すると、
// 述語が広すぎて全部隠れている状態と区別できない。同じ spec の中で手動削除も行い、
// そちらはこれまでどおりゴミ箱に出ることを必ず確認する(指示書 §5-7)。
//
// 方式:
//   - fixture 作成・キー変更編集・手動削除 = API(UI 経路にキー変更の安定セレクタが無いため)。
//   - 判定 = API(GET /api/combos?only_deleted=true)と UI(/trash の行リンク)の両方。
//   - 併せて 90 日の残日数が画面から消えていること(列 7 の撤去)を否定形で確認する(§4.4)。
//
// 前提: E2E 使い捨て DB(全マイグレ適用済み=新系列 000009 が終端)。バックエンド + Vite dev が起動していること。
// ★件数を絶対値で数えない。作成した id の在・不在だけを見る。
// ★あわせて afterEach で作成行を全部落とす(下記)。実査では「ゴミ箱の件数」も
//   「コンボ一覧の行数」も絶対値で数える spec は 0 件だが、後片付けまでやって初めて
//   「今後そういう spec が足されても壊れない」が言える。

// ★M24-08 でゴミ箱はキャラを選べるようになった。1 は「固定値」ではなく
//   既定キャラの解決値(useResolvedCharacterId)であり、E2E 環境ではこれが 1 になる。
const TRASH_CHARACTER_ID = 1;

type ComboLite = { id: number; version: number };

async function ryuCharacterId(page: Page): Promise<number> {
  const res = await page.request.get("/api/games/1/characters");
  expect(res.ok()).toBeTruthy();
  const chars = (await res.json()).items as Array<{ id: number; code: string }>;
  const ryu = chars.find((c) => c.code === "ryu");
  if (!ryu) throw new Error("seed に ryu が見つからない(配布クリーン状態の前提崩れ)");
  return ryu.id;
}

function payload(characterId: number, memo: string, position: string) {
  return {
    characterId,
    isDraft: true,
    // ★★M24-13: 「仮登録ならレシピ無しで作成できる」は撤回された(VAL-C09 を
    //   仮登録へ適用した)。⇒ 最小のレシピを持たせる。
    steps: minimalDraftSteps(),
    position,
    memo,
  };
}

async function createCombo(
  page: Page,
  characterId: number,
  memo: string,
  position: string,
): Promise<ComboLite> {
  const res = await page.request.post("/api/combos", {
    data: payload(characterId, memo, position),
  });
  expect(res.ok(), `fixture 作成失敗: ${res.status()} ${await res.text()}`).toBeTruthy();
  const body = await res.json();
  createdIDs.push(body.id as number);
  return { id: body.id as number, version: body.version as number };
}

// trashIDs はゴミ箱一覧 API が返す id 集合。画面と一括操作の対象はこの集合と同一である。
async function trashIDs(page: Page): Promise<number[]> {
  const res = await page.request.get(
    `/api/combos?character_id=${TRASH_CHARACTER_ID}&only_deleted=true`,
  );
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return (body.items as Array<{ id: number }>).map((c) => c.id);
}

// ★後片付け(M23-01 レビュー M-3)。`make e2e` は使い捨て DB だが、1 回の走行内では
// 全 spec が同一 DB を共有する。本 spec は PUT で現役の後継コンボを 1 行増やすため、
// 将来「一覧の件数を数える spec」が足されたときに実行順依存の不安定さを持ち込む。
// 既存の慣行(m22-03 / m22-04 が完全削除を後片付けに使う)へ揃えて、作った行を全部落とす。
// ★完全削除は「ゴミ箱にある行」しか受け付けないため、現役行は先に論理削除する。
const createdIDs: number[] = [];

test.afterEach(async ({ request }) => {
  // 逆順に落とす。後継を先に完全削除すると、FK=ON の接続では旧行の
  // superseded_by_combo_id が SET NULL される(§3.3-7 の実測)が、後片付けの時点では
  // どちらの順でも結果は同じ(両方消す)。失敗しても本体の判定へ影響させない。
  for (const id of createdIDs.reverse()) {
    await request.delete(`/api/combos/${id}`).catch(() => undefined);
    await request.delete(`/api/combos/${id}/permanent`).catch(() => undefined);
  }
  createdIDs.length = 0;
});

test.describe("M23-01 ゴミ箱: 編集で積まれた旧行を隠し、手動削除は残す", () => {
  test("キー変更編集の旧行は出ない / 手動削除の行は出る(対で確認)", async ({ page }) => {
    const characterId = await ryuCharacterId(page);
    expect(
      characterId,
      "ゴミ箱画面の既定キャラは解決値であり、E2E 環境では ryu(=1) になる前提",
    ).toBe(TRASH_CHARACTER_ID);

    const stamp = Date.now();

    // ── (a) キー項目(position)を変える編集 → 旧行が積まれる ──────────────
    const edited = await createCombo(page, characterId, `e2e-m2301-edited-${stamp}`, "mid_screen");
    const putRes = await page.request.put(`/api/combos/${edited.id}`, {
      data: {
        version: edited.version,
        ...payload(characterId, `e2e-m2301-edited-${stamp}`, "corner_self"),
      },
    });
    expect(
      putRes.status(),
      `キー変更編集が 201 を返さない: ${await putRes.text()}`,
    ).toBe(201);
    const successorID = (await putRes.json()).id as number;
    createdIDs.push(successorID); // ★PUT は新 id を採番するため、後片付けの対象へ足す

    expect(successorID, "PUT は新 id を採番し直す(D-413)").not.toBe(edited.id);

    // ── (b) 手動削除 ────────────────────────────────────────────────────
    const manual = await createCombo(page, characterId, `e2e-m2301-manual-${stamp}`, "corner_opponent");
    const delRes = await page.request.delete(`/api/combos/${manual.id}`);
    expect(delRes.status()).toBe(204);

    // ── API での判定 ────────────────────────────────────────────────────
    const ids = await trashIDs(page);
    expect(ids, "編集で積まれた旧行がゴミ箱に出ている").not.toContain(edited.id);
    expect(ids, "★手動で消した行がゴミ箱から消えている(最重要ゲート)").toContain(manual.id);
    expect(ids, "現役の後継行がゴミ箱に出ている").not.toContain(successorID);

    // ── UI での判定 ─────────────────────────────────────────────────────
    await page.goto("/trash");
    await expect(page.getByRole("heading", { name: "ゴミ箱" })).toBeVisible();

    const manualRow = page.locator(`a[href="/trash/combos/${manual.id}"]`);
    await expect(manualRow, "手動で消した行が画面に出ていない").toHaveCount(1);
    await expect(
      page.locator(`a[href="/trash/combos/${edited.id}"]`),
      "編集で積まれた旧行が画面に出ている",
    ).toHaveCount(0);

    // 旧行は物理削除されていない(隠しただけであり、消したわけではない)。
    const stillThere = await page.request.get(`/api/combos/${edited.id}`);
    expect(
      stillThere.status(),
      "旧行は論理削除のままで、詳細取得は 404(現役行として復活していない)",
    ).toBe(404);
  });

  test("残日数の列・90 日の告知が画面から消えている(§4.4 の否定形)", async ({ page }) => {
    const characterId = await ryuCharacterId(page);
    const stamp = Date.now();
    const combo = await createCombo(page, characterId, `e2e-m2301-cols-${stamp}`, "mid_screen");
    expect((await page.request.delete(`/api/combos/${combo.id}`)).status()).toBe(204);

    await page.goto("/trash");
    const row = page.locator(`tr:has(a[href="/trash/combos/${combo.id}"])`);
    await expect(row).toHaveCount(1);

    // 8 列 → 7 列(残日数の列を撤去した)。
    // ★M23-06 §4.1 で「ルート」列も撤去したため 7 → 6 になった。数を減らす向きの
    //   更新であり、この主張が守っている意図(列を足して撤去を巻き戻さない)は変わらない。
    await expect(row.locator("td")).toHaveCount(6);
    // 列見出しと本文告知が消えている。代わりの告知も足していない(§4.4-5)。
    await expect(page.getByRole("columnheader", { name: "残日数" })).toHaveCount(0);
    await expect(page.getByText(/90 日/)).toHaveCount(0);
    await expect(page.getByText("期限切れ")).toHaveCount(0);
    await expect(page.getByText(/あと \d+ 日/)).toHaveCount(0);
  });
});

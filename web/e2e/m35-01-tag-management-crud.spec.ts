import { test, expect, type APIRequestContext, type Locator, type Page } from "@playwright/test";

import { characterIdOf } from "./support/character";
import { minimalDraftSteps } from "./support/draft-combo";
import { createTag, deleteTags, type CreatedTag } from "./support/tags";

// 前提: `make e2e` / `make e2e-only` が起動する使い捨てスタックで実行される
//       (既定はバックエンド :47390 / Vite :5273。worktree ごとに決定的にオフセットされる)。
//       DB は毎回作り直す seed 済みの使い捨て DB であり、dev DB・dev サーバには影響しない。
//       ⇒ dev 側の状態(既存データ件数・開発者が最後に選んだ既定キャラ等)を仮定しないこと。
//
// M35-01: タグ管理画面の作成・編集・削除。着手時点でこの経路を通る spec は 1 本も無く、
//         TagManagementPage.tsx は単体テストも持たない。
//
// ★判定キーは本 spec 固有にする(教訓 E-232)。E2E は DB を 1 本共有する。
const STAMP = `m3501-${Date.now()}`;

/** 一覧からタグ名で行を引く。 */
function rowOf(page: Page, name: string) {
  return page.getByRole("row").filter({ hasText: name });
}

/**
 * 削除を確定し、実際に飛んだ DELETE を返す。
 *
 * ★★ダイアログが開いている間は背後が aria-hidden になり `getByRole("row")` が 0 件を返す。
 *   ⇒ 「行が消えたこと」だけを見ると、削除に失敗してダイアログが開いたままでも緑になる
 *   (本 spec の破壊確認 D-2 で実測した偽陽性)。応答そのものを見ること。
 */
async function confirmDelete(page: Page, dialog: Locator, tagId: number) {
  const [res] = await Promise.all([
    page.waitForResponse(
      (r) => r.request().method() === "DELETE" && r.url().includes(`/api/tags/${tagId}`),
    ),
    dialog.getByRole("button", { name: "削除" }).click(),
  ]);
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  return res;
}

/** 名前から id を引く(UI で作ったタグを後片付けするため)。 */
async function tagIdOf(
  request: APIRequestContext,
  name: string,
): Promise<number | null> {
  const body = (await (await request.get("/api/tags")).json()) as Array<{
    id: number;
    name: string;
  }>;
  return body.find((t) => t.name === name)?.id ?? null;
}

test.describe("M35-01 タグ管理の作成・編集・削除", () => {
  const created: CreatedTag[] = [];
  const comboIds: number[] = [];

  test.afterAll(async ({ request }) => {
    for (const id of comboIds) {
      await request.delete(`/api/combos/${id}?permanent=true`).catch(() => undefined);
    }
    await deleteTags(request, created);
  });

  // ---------------------------------------------------------------------------
  // 1: カテゴリを空のまま作ると「未設定」になる(空文字が入らない)
  // ---------------------------------------------------------------------------
  //
  // ★空文字と未設定は一覧で区別できる —— TagListTable は `tag.category ?? "―"` で
  //   描くため、空文字は「―」ではなく空セルとして出る。
  test("1: カテゴリを空のまま作成すると、一覧のカテゴリが「―」になる", async ({
    page,
    request,
  }) => {
    const name = `${STAMP}-空カテゴリ`;

    await page.goto("/tags/manage");
    await page.getByRole("button", { name: "+ 新規作成" }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("タグ名").fill(name);
    await dialog.getByRole("button", { name: "作成" }).click();

    await expect(page.getByText("タグを作成しました")).toBeVisible();

    const row = rowOf(page, name);
    await expect(row).toBeVisible();
    await expect(row.getByRole("cell").nth(1)).toHaveText("―");

    const id = await tagIdOf(request, name);
    expect(id).not.toBeNull();
    created.push({ id: id as number, name });
  });

  // ---------------------------------------------------------------------------
  // 2: カテゴリ・色は保存でき、名前だけの編集では保たれる
  // ---------------------------------------------------------------------------
  //
  // ★対照実験を兼ねる —— 1 の「―」が「そもそもカテゴリを保存できない」ことの結果では
  //   ないことを、同じ画面で示す。
  test("2: カテゴリと色を保存でき、名前だけ編集しても保たれる", async ({
    page,
    request,
  }) => {
    const name = `${STAMP}-保持`;
    const renamed = `${name}-改`;
    const category = `${STAMP}-cat`;
    const color = "#10B981";

    created.push(await createTag(request, name));

    await page.goto("/tags/manage");
    await page.getByRole("button", { name: `${name}を編集` }).click();

    let dialog = page.getByRole("dialog");
    await dialog.getByLabel("カテゴリ").fill(category);
    await dialog.getByTestId("color-input").fill(color);
    await dialog.getByRole("button", { name: "保存" }).click();
    await expect(rowOf(page, name).getByRole("cell").nth(1)).toHaveText(category);
    await expect(rowOf(page, name)).toContainText(color);

    await page.getByRole("button", { name: `${name}を編集` }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("タグ名").fill(renamed);
    await dialog.getByRole("button", { name: "保存" }).click();
    const row = rowOf(page, renamed);
    await expect(row.getByRole("cell").nth(1)).toHaveText(category);
    await expect(row).toContainText(color);
  });

  // ---------------------------------------------------------------------------
  // 3: カテゴリ・色は未設定へ戻せない(★仕様である)
  // ---------------------------------------------------------------------------
  //
  // ★★これは欠陥ではなく仕様である(2026-09-08 開発者判断)。機序は 3 層 ——
  //   useTagFormDialog の `|| undefined` が空文字を落とし、JSON.stringify がキーを落とし、
  //   リポジトリの動的 SET が nil を「変更なし」として飛ばす。
  //   ★`null` を送っても救えない(Go の encoding/json は省略と明示的 null を区別しない)。
  // ★★消せるようにする契約変更を入れるときは、本テストも同じ手番で直すこと。
  test("3: カテゴリ欄・色欄を空にして保存しても、元の値が残る", async ({
    page,
    request,
  }) => {
    const name = `${STAMP}-消せない`;
    const category = `${STAMP}-keep`;
    const color = "#F59E0B";

    created.push(await createTag(request, name, color));

    await page.goto("/tags/manage");
    await page.getByRole("button", { name: `${name}を編集` }).click();

    let dialog = page.getByRole("dialog");
    await dialog.getByLabel("カテゴリ").fill(category);
    await dialog.getByRole("button", { name: "保存" }).click();
    await expect(rowOf(page, name).getByRole("cell").nth(1)).toHaveText(category);

    await page.getByRole("button", { name: `${name}を編集` }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("カテゴリ").fill("");
    await dialog.getByTestId("color-input").fill("");

    // ★保存が届かなくても値は変わらない。⇒ PATCH が実際に成功したことを先に主張しないと、
    //   このテストは「何も起きなかったこと」を見て緑になりうる。
    const [saved] = await Promise.all([
      page.waitForResponse(
        (r) => r.request().method() === "PATCH" && /\/api\/tags\/\d+$/.test(r.url()),
      ),
      dialog.getByRole("button", { name: "保存" }).click(),
    ]);
    expect(saved.status()).toBe(200);

    await page.goto("/tags/manage");
    const row = rowOf(page, name);
    await expect(row.getByRole("cell").nth(1)).toHaveText(category);
    await expect(row).toContainText(color);
  });

  // ---------------------------------------------------------------------------
  // 4: 削除の 2 経路(使用中は件数が出る / 未使用は出ない)
  // ---------------------------------------------------------------------------
  test("4: 使用中タグの削除は使用件数を示し、未使用タグでは示さない", async ({
    page,
    request,
  }) => {
    const inUse = `${STAMP}-使用中`;
    const unused = `${STAMP}-未使用`;

    const inUseTag = await createTag(request, inUse);
    const unusedTag = await createTag(request, unused);
    created.push(inUseTag, unusedTag);

    const characterId = await characterIdOf(request, "ryu");
    const res = await request.post("/api/combos", {
      data: {
        characterId,
        isDraft: true,
        steps: minimalDraftSteps(),
        memo: `${STAMP}-fixture`,
        tagIds: [inUseTag.id],
      },
    });
    expect(res.ok(), `fixture 作成に失敗: ${res.status()} ${await res.text()}`).toBeTruthy();
    comboIds.push(((await res.json()) as { id: number }).id);

    await page.goto("/tags/manage");
    await expect(rowOf(page, inUse).getByRole("cell").nth(3)).toHaveText("1");

    await page.getByRole("button", { name: `${unused}を削除` }).click();
    const unusedDialog = page.getByRole("alertdialog");
    await expect(unusedDialog).toContainText("を削除しますか?");
    await expect(unusedDialog).not.toContainText("使用中です");
    const unusedRes = await confirmDelete(page, unusedDialog, unusedTag.id);
    expect(unusedRes.status()).toBe(204);
    expect(unusedRes.url()).not.toContain("force=true");
    await expect(rowOf(page, unused)).toHaveCount(0);

    await page.getByRole("button", { name: `${inUse}を削除` }).click();
    const inUseDialog = page.getByRole("alertdialog");
    await expect(inUseDialog).toContainText("1 件");
    await expect(inUseDialog).toContainText("使用中です");
    const inUseRes = await confirmDelete(page, inUseDialog, inUseTag.id);
    expect(inUseRes.url()).toContain("force=true");
    expect(inUseRes.status()).toBe(204);
    await expect(rowOf(page, inUse)).toHaveCount(0);
  });
});

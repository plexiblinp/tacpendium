import { test, expect } from "@playwright/test";

import { characterIdOf, gotoNewComboFor } from "./support/character";
import { minimalDraftSteps } from "./support/draft-combo";
import {
  addMinimalRecipeStep,
  openRecipeTab,
  switchEditorTab,
} from "./support/editor-input";
import { completeNewComboSave } from "./support/new-combo";

/**
 * M24-13(CHANGE-139): 仮登録もレシピのステップ 1 本以上を要する。
 *
 * ★★核心＝既存の VAL-C09 を仮登録でも適用するだけであり、新しい VAL は作らない。
 *   VAL-D02(move_id 未指定の許容)は 1 文字も変えていない。
 */
test.describe("M24-13 仮登録もレシピのステップ 1 本以上を要する", () => {
  const createdComboIDs: number[] = [];

  test.afterEach(async ({ request }) => {
    while (createdComboIDs.length > 0) {
      const id = createdComboIDs.pop()!;
      await request.delete(`/api/combos/${id}`);
    }
  });

  // ---------------------------------------------------------------------------
  // (1a) フロント側: ステップ 0 本では保存ボタンが押せない
  // ---------------------------------------------------------------------------
  //
  // ★★(1a) と (1b) を 2 本に割るのは意図である———————————————————————
  //   フロントが先に塞ぐため、サーバ側の VAL-C09 を外しても (1a) は緑のままである。
  //   1 本にまとめると「サーバが守っている」ことをどのテストも見なくなる
  //   (M24-12 で破壊確認が 3 件空振りしたのと同じ形)。
  test("(1a) 仮登録でレシピ 0 本のとき、保存ボタンが押せず理由が出る", async ({
    page,
  }) => {
    await gotoNewComboFor(page, "ryu");
    await page.getByTestId("combo-editor-draft-checkbox").click();

    const save = page.getByRole("button", { name: "保存" });
    // ★ボタンは在る。消していない(D-582)。
    await expect(save).toBeVisible();
    await expect(save).toBeDisabled();

    const reason = page.getByTestId("combo-editor-save-blocked-reason");
    await expect(reason).toBeVisible();
    await expect(reason).toContainText("レシピを 1 つ以上入力してください");

    // ★レシピタブへ移っても同じである(タブ依存の条件を足していない)。
    await openRecipeTab(page);
    await expect(save).toBeDisabled();
    await expect(reason).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // (1b) サーバ側: ステップ 0 本の仮登録は 400 で弾かれる
  // ---------------------------------------------------------------------------
  //
  // ★★これが「サーバが守っている」ことを見る唯一の観測である。画面を経由しない。
  test("(1b) API: 仮登録でレシピ 0 本の POST は 400 VAL-C09 になる", async ({
    request,
  }) => {
    const characterId = await characterIdOf(request, "ryu");
    const res = await request.post("/api/combos", {
      data: { characterId, isDraft: true, memo: `e2e-m24-13-${Date.now()}` },
    });

    expect(res.status(), await res.text()).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("validation_failed");
    const issues = body.error.details.validations.issues as Array<{
      code: string;
      severity: string;
    }>;
    expect(
      issues.some((i) => i.code === "VAL-C09" && i.severity === "error"),
      `VAL-C09 が issues[] に無い: ${JSON.stringify(issues)}`,
    ).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // (2) ★★最も大事: 「うろ覚え」は守られている
  // ---------------------------------------------------------------------------
  //
  // ★★数えるのはステップの本数だけであり、move_id の中身は見ていない。
  //   これが VAL-D02 を巻き添えで壊していないかを見る観測である。
  test("(2) 仮登録でステップ 1 本(技は未指定)なら保存できる", async ({ page }) => {
    await gotoNewComboFor(page, "ryu");
    await page.getByTestId("combo-editor-draft-checkbox").click();

    const memo = `e2e-m24-13-vague-${Date.now()}`;
    await page.getByPlaceholder("このコンボに関するメモ(任意)").fill(memo);

    // ★技を選ばないステップを 1 本だけ置く。
    await addMinimalRecipeStep(page);

    const save = page.getByRole("button", { name: "保存" });
    await expect(save).toBeEnabled();
    await expect(
      page.getByTestId("combo-editor-save-blocked-reason"),
    ).toHaveCount(0);

    const id = await completeNewComboSave(page, () => save.click());
    createdComboIDs.push(id);

    // ★保存されたものが「ステップ 1 本の仮登録」であることを API で確かめる。
    const res = await page.request.get(`/api/combos/${id}`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.isDraft).toBe(true);
    expect(body.stepCount).toBe(1);
  });

  // ★API 経路でも同じこと——★こちらは modifiers も持たない純粋な「技が未指定」である。
  //   UI からは非技ステップしか置けないため、VAL-D02 の逐語(「move_id は未指定なら
  //   許容」)そのものはここでしか観測できない。
  test("(2b) API: move_id も modifiers も無いステップ 1 本の仮登録は通る", async ({
    request,
  }) => {
    const characterId = await characterIdOf(request, "ryu");
    const res = await request.post("/api/combos", {
      data: {
        characterId,
        isDraft: true,
        memo: `e2e-m24-13-nullmove-${Date.now()}`,
        steps: [{ stepOrder: 1 }],
      },
    });
    expect(res.status(), await res.text()).toBe(201);
    const body = await res.json();
    createdComboIDs.push(body.id as number);
    expect(body.stepCount).toBe(1);
  });

  // ---------------------------------------------------------------------------
  // (3) 理由が順送りで読める位置に在る
  // ---------------------------------------------------------------------------
  //
  // ★★`disabled` なボタンはフォーカスを受けない。⇒ ボタン自身に説明を持たせても
  //   キーボードだけでは読めない。理由の側を順送りの停止点にしてある。
  test("(3) 保存できない理由が順送りで読める位置に在る", async ({ page }) => {
    await gotoNewComboFor(page, "ryu");
    await page.getByTestId("combo-editor-draft-checkbox").click();

    const reason = page.getByTestId("combo-editor-save-blocked-reason");
    await expect(reason).toBeVisible();
    await expect(reason).toHaveAttribute("tabindex", "0");

    // ★理由へフォーカスが乗る。
    await reason.focus();
    await expect(reason).toBeFocused();

    // ★★理由の次の停止点がボタン行である——つまり利用者は保存へ向かう順送りの
    //   途中で必ず理由を通る。保存ボタン自身は `disabled` で飛ばされる。
    await page.keyboard.press("Tab");
    // ★exact 指定が要る——最上部にも「← キャンセル」導線が在る(M12-02/C-09)。
    await expect(
      page.getByRole("button", { name: "キャンセル", exact: true }),
    ).toBeFocused();
    await expect(page.getByRole("button", { name: "保存" })).toBeDisabled();
  });

  // ---------------------------------------------------------------------------
  // 対照: 本登録側の挙動は変わっていない
  // ---------------------------------------------------------------------------
  test("対照: 本登録でもステップ 0 本は保存できない(従来どおり)", async ({ page }) => {
    await gotoNewComboFor(page, "ryu");
    // ★仮登録トグルを押さない = 本登録。
    await expect(page.getByRole("button", { name: "保存" })).toBeDisabled();
    await expect(
      page.getByTestId("combo-editor-save-blocked-reason"),
    ).toBeVisible();

    // ★1 本足せば押せる。ここまでは以前から同じである。
    await switchEditorTab(page, "recipe");
    await addMinimalRecipeStep(page, "recipe");
    await expect(page.getByRole("button", { name: "保存" })).toBeEnabled();
  });

  // ---------------------------------------------------------------------------
  // 対照: 共通ヘルパが作る fixture が実際に通ること
  // ---------------------------------------------------------------------------
  //
  // ★minimalDraftSteps は 26 ファイルの fixture が使う。壊れたら広範囲が赤くなるが、
  //   原因が「ヘルパ」だと分かる観測をここに 1 本置いておく。
  test("対照: minimalDraftSteps で作った仮登録は警告なしで通る", async ({ request }) => {
    const characterId = await characterIdOf(request, "ryu");
    const res = await request.post("/api/combos", {
      data: {
        characterId,
        isDraft: true,
        memo: `e2e-m24-13-helper-${Date.now()}`,
        steps: minimalDraftSteps(),
      },
    });
    expect(res.status(), await res.text()).toBe(201);
    const body = await res.json();
    createdComboIDs.push(body.id as number);
    expect(body.stepCount).toBe(1);
    // ★★fixture へ新しい警告を増やしていない(VAL-C03 / C08 / C12 が発火していない)。
    //   ★見る先は `validations` である。`warnings` ではない——
    //     `warnings` は CheckTrashDuplicate(VAL-C14)専用の欄であり
    //     (internal/api/combo/handler.go)、検証結果の WARNING はここに載らない。
    //     ⇒ `warnings` を見る形だと、何本警告が出ても常に真になる。
    //   ★`toComboResponse` は issues が 0 件なら Validations 自体を出さない
    //     (json:"validations,omitempty")。
    expect(
      body.validations,
      `警告が出ている: ${JSON.stringify(body.validations)}`,
    ).toBeUndefined();
  });
});

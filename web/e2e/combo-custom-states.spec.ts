import { test, expect } from "@playwright/test";

import { gotoNewComboFor } from "./support/character";
import { saveNewComboAndOpenDetail } from "./support/new-combo";
import { addMinimalRecipeStep } from "./support/editor-input";

// 前提: `make e2e` / `make e2e-only` が起動する使い捨てスタックで実行される
//      (既定はバックエンド :47390 / Vite :5273。worktree ごとに決定的にオフセットされる)。
//      DB は毎回作り直す seed 済みの使い捨て DB であり、dev DB・dev サーバには影響しない。
//
// 既定キャラ ryu は custom_states に電刃錬気(denjin_charge / flag)を持つ(000003_data_seed_characters)。
// 回帰対象: 電刃錬気「あり」で登録 → 編集で外して保存 → 詳細で「なし」が永続化されること
// (PATCH の custom_states クリアが NULL 保存される)。

test.describe("custom_states 編集の永続化(電刃錬気 あり→なし)", () => {
  test("電刃錬気ありで登録 → 編集で外して保存 → 詳細でなしになる", async ({
    page,
  }) => {
    const memo = `e2e-custom-states-${Date.now()}`;

    // ── 登録(電刃錬気あり) ──────────────────────────────────────────────
    // ★電刃錬気(denjin_charge)は ryu 固有の custom_state である(000003_data_seed_characters)。
    //   画面が出す既定キャラを仮定せず、ryu を明示して開く(M24-09c 追補 段 2)。
    await gotoNewComboFor(page, "ryu");

    await page.getByTestId("combo-editor-draft-checkbox").click();
    // ★M24-13: 仮登録でもレシピのステップ 1 本以上が要る(VAL-C09)。
    await addMinimalRecipeStep(page);
    await page
      .getByPlaceholder("このコンボに関するメモ(任意)")
      .fill(memo);
    // ★M24-12(§4.12): Switch からボタン群へ替えたので「はい」を押す。
    await page.getByTestId("combo-editor-custom-state-denjin_charge-yes").click();

    await saveNewComboAndOpenDetail(page, () =>
      page.getByRole("button", { name: "保存" }).click(),
    );

    // ── 詳細確認(電刃錬気あり) ──────────────────────────────────────────
    // ★M24-03 §4.4(SM-089): メモの 1 行目がレシピの上にも出るため、同じ文字列が
    //   1 画面に 2 か所ある。exact 一致で「メモ欄そのもの」を指す(1 行目は ✎ を伴う)。
    await expect(page.getByText(memo, { exact: true })).toBeVisible();
    await expect(page.getByText("電刃錬気")).toBeVisible();

    // ── 編集(電刃錬気を外す) ────────────────────────────────────────────
    await page.getByRole("link", { name: "編集", exact: true }).click();
    await expect(page).toHaveURL(/\/combos\/\d+\/edit$/);

    // ★M24-12(§4.12): 外すのは「いいえ」を押す(トグルの 2 度押しではない)。
    //   ★★保存されるのは `false` ではなく `undefined`＝キーごと消える(§4.12.2)。
    await page.getByTestId("combo-editor-custom-state-denjin_charge-no").click();
    await page.getByRole("button", { name: "保存" }).click();

    // ── 詳細確認(電刃錬気なし = クリアが永続化) ────────────────────────
    await expect(page).toHaveURL(/\/combos\/\d+$/);
    // ★M24-03 §4.4(SM-089): メモの 1 行目がレシピの上にも出るため、同じ文字列が
    //   1 画面に 2 か所ある。exact 一致で「メモ欄そのもの」を指す(1 行目は ✎ を伴う)。
    await expect(page.getByText(memo, { exact: true })).toBeVisible();
    await expect(page.getByText("電刃錬気")).not.toBeVisible();

    // ── 後始末 ──────────────────────────────────────────────────────────
    await page.getByRole("button", { name: "削除" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "削除" }).click();
    await expect(page).toHaveURL(/\/combos(\?character_id=\d+)?$/);
  });
});

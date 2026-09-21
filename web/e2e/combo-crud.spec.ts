import { test, expect } from "@playwright/test";

import { gotoNewComboFor } from "./support/character";
import { saveNewComboAndOpenDetail } from "./support/new-combo";
import { addMinimalRecipeStep } from "./support/editor-input";

// 前提: ウィザードが完了済みのローカル開発環境で実行すること。
// 未完了環境では /wizard へリダイレクトされ spec が失敗する。
//
// DB 前提: spec が自前でデータを作成・削除するため、既存コンボ件数に依存しない。
// ★★M24-13: 「仮登録モードで保存するためステップ入力は不要」は撤回された
//   (VAL-C09 を仮登録へ適用した)。⇒ 最小のレシピを 1 本置いてから保存する。

test.describe("コンボ CRUD スモーク", () => {
  test("コンボ登録 → 詳細確認 → 編集 → 削除", async ({ page }) => {
    const memo = `e2e-smoke-${Date.now()}`;
    const memoEdited = `${memo}-edited`;

    // ── 登録 ────────────────────────────────────────────────────────────
    await page.goto("/combos/new");

    // ★仮登録モードを有効化する(★M24-13 以降、レシピなしでは保存できない)
    await page.getByTestId("combo-editor-draft-checkbox").click();
    // ★M24-13: 仮登録でもレシピのステップ 1 本以上が要る(VAL-C09)。
    await addMinimalRecipeStep(page);

    // メモにユニーク値を入力(登録後の同定に使う)
    await page
      .getByPlaceholder("このコンボに関するメモ(任意)")
      .fill(memo);

    // 保存 → 詳細ページへ遷移
    // M24-01 §4.4: 新規登録の保存後は一覧へ戻る。詳細は id を解決して開く。
    await saveNewComboAndOpenDetail(page, () =>
      page.getByRole("button", { name: "保存" }).click(),
    );

    // ── 詳細確認 ────────────────────────────────────────────────────────
    // ★M24-03 §4.4(SM-089): メモの 1 行目がレシピの上にも出るため、同じ文字列が
    //   1 画面に 2 か所ある。exact 一致で「メモ欄そのもの」を指す(1 行目は ✎ を伴う)。
    await expect(page.getByText(memo, { exact: true })).toBeVisible();

    // ── 編集 ────────────────────────────────────────────────────────────
    // exact: true — 「編集」を含む別リンクと部分一致で衝突しないようにする。
    // ★M38-02(2026-09-17)是正: 旧記述は根拠を「ヘッダーの『技編集』ナビ(M9-03 #5)」
    //   1 点に置いていたが、同ナビは M38-02 で外れた(D-892)。⇒ その根拠はもう無い。
    //   ★それでも exact は外さない —— 画面本文側にも「編集」を含むラベルが増えうるため
    //   であり、緩めると「どれを押したか」が実行時まで分からない指定に戻る。
    await page.getByRole("link", { name: "編集", exact: true }).click();
    await expect(page).toHaveURL(/\/combos\/\d+\/edit$/);

    const memoArea = page.getByPlaceholder("このコンボに関するメモ(任意)");
    await memoArea.clear();
    await memoArea.fill(memoEdited);

    await page.getByRole("button", { name: "保存" }).click();

    // 更新後の詳細ページで新しいメモが表示される
    await expect(page).toHaveURL(/\/combos\/\d+$/);
    // ★M24-03 §4.4(SM-089): メモの 1 行目がレシピの上にも出るようになったため、
    //   同じ文字列が 1 画面に 2 か所ある。exact 一致で「メモ欄そのもの」を指す
    //   (1 行目の表示は ✎ 記号を伴うため exact では一致しない)。
    await expect(page.getByText(memoEdited, { exact: true })).toBeVisible();
    await expect(page.getByText(memo, { exact: true })).not.toBeVisible();

    // ── 削除 ────────────────────────────────────────────────────────────
    await page.getByRole("button", { name: "削除" }).click();

    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "削除" }).click();

    // 削除後はコンボ一覧へ戻る
    await expect(page).toHaveURL(/\/combos(\?character_id=\d+)?$/);
  });

  // E-1(M11-02 非回帰): presence-detection 化後、1 項目だけ編集しても
  // 触っていないメタデータが誤クリアされないこと。custom_states(situation)は
  // 今回 ""→null へ移行した項目のため、メモのみ編集で温存されることを確認する。
  // (buildPatchPayload は全フィールドを毎回送るため、未編集項目は present+値で再送=同値更新となる)
  test("(E-1) メモのみ編集しても custom_states が温存される(誤クリア非回帰)", async ({
    page,
  }) => {
    const memo = `e2e-preserve-${Date.now()}`;
    const memoEdited = `${memo}-edited`;

    // ── 登録(メモ + 電刃錬気 の複数メタデータ) ──────────────────────────
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

    // ── 詳細(メモ・電刃錬気の両方が見える) ────────────────────────────
    // ★M24-03 §4.4(SM-089): メモの 1 行目がレシピの上にも出るため、同じ文字列が
    //   1 画面に 2 か所ある。exact 一致で「メモ欄そのもの」を指す(1 行目は ✎ を伴う)。
    await expect(page.getByText(memo, { exact: true })).toBeVisible();
    await expect(page.getByText("電刃錬気")).toBeVisible();

    // ── 編集: メモだけ変更(custom_states は一切触らない) ──────────────
    await page.getByRole("link", { name: "編集", exact: true }).click();
    await expect(page).toHaveURL(/\/combos\/\d+\/edit$/);
    const memoArea = page.getByPlaceholder("このコンボに関するメモ(任意)");
    await memoArea.clear();
    await memoArea.fill(memoEdited);
    await page.getByRole("button", { name: "保存" }).click();

    // ── 詳細: メモは更新、電刃錬気は温存(= E-1 の核心) ────────────────
    await expect(page).toHaveURL(/\/combos\/\d+$/);
    // ★M24-03 §4.4(SM-089): 上と同じ理由で exact 一致にする。
    await expect(page.getByText(memoEdited, { exact: true })).toBeVisible();
    await expect(page.getByText("電刃錬気")).toBeVisible();

    // ── 後始末 ──────────────────────────────────────────────────────────
    await page.getByRole("button", { name: "削除" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "削除" }).click();
    await expect(page).toHaveURL(/\/combos(\?character_id=\d+)?$/);
  });
});

import { test, expect } from "@playwright/test";
import { saveNewComboAndOpenDetail } from "./support/new-combo";
import { addMinimalRecipeStep } from "./support/editor-input";

// M12-03 E2E: R-1 起き攻めラベル統一 / C-12 始動技自動化 / C-10/C-11 drive_damage。
//
// 前提: `make e2e` / `make e2e-only` が起動する使い捨てスタックで実行される
//      (既定はバックエンド :47390 / Vite :5273。worktree ごとに決定的にオフセットされる)。
//      DB は毎回作り直す seed 済みの使い捨て DB であり、dev DB・dev サーバには影響しない。
// ★★M24-13: 「仮登録モードで保存するためステップ入力は不要」は撤回された
//   (VAL-C09 を仮登録へ適用した)。⇒ 最小のレシピを 1 本置いてから保存する。
// spec は自前でデータを作成・削除し既存コンボ件数に依存しない。


test.describe("M12-03 起き攻め/始動技/drive_damage", () => {
  test("(A/B) 編集画面: 起き攻めラベル統一 + 始動技プルダウン廃止", async ({
    page,
  }) => {
    await page.goto("/combos/new");

    // R-1: 正典ラベル(M16-03 正規化・constants/oki.ts)が表示され、誤訳・表記揺れが消えている。
    // 起き攻め節(CollapsibleFieldset)は既定展開。attack_type 見出しラベルは一意。
    await expect(page.getByText("投げ重ね", { exact: true })).toBeVisible();
    await expect(page.getByText("シミー", { exact: true })).toBeVisible();
    await expect(page.getByText("打撃重ね", { exact: true })).toBeVisible();
    // uses_dr は「ドライブラッシュ」正式名称で表示(「DR」略記不可・DES-005 §5.6)。
    await expect(page.getByText("ドライブラッシュ").first()).toBeVisible();
    // 旧誤訳・旧統合ラベルは消えている(表記揺れ排除)。
    await expect(page.getByText("中段攻め")).toHaveCount(0);
    await expect(page.getByText("中央受け身")).toHaveCount(0);
    await expect(page.getByText("重ね(その場受け身/投げ)")).toHaveCount(0);

    // C-12: 始動技のプルダウン(=select)が無い。
    //
    // ★★★M38-01 追補2(2026-09-18 開発者指示): **読み取り専用表示ごと消えた。**
    //   逐語＝「始動技は削除（レシピの方で見れるのでわざわざ基本情報タブで見る
    //   必要がない）」。
    //   ★以下は失効した主張:「始動技の欄が在る／『レシピ先頭から自動設定』が見える」。
    //   ★★★C-12 の主張そのもの(=手動選択 UI を廃止した)は**より強く満たされている** ——
    //     プルダウンが無いどころか、欄そのものが無い。
    //   ★★保存される値は 1 バイトも変わらない —— 始動技の自動推定
    //     (`effectiveStarterMoveId`)は `ComboEditor` に残っており、重複判定キーの
    //     `starter_move_id` を作り続ける。⇒ 消えたのは表示だけである。
    await expect(page.getByText("始動技", { exact: true })).toHaveCount(0);
    await expect(page.getByText("レシピ先頭から自動設定")).toHaveCount(0);
    // ★「持続当て（始動技）」は別の欄であり、**残っている**(M37-07)。
    await expect(page.getByText("持続当て（始動技）", { exact: true })).toBeVisible();
  });

  test("(E) drive_damage に -2.5 を入力 → 詳細で表示(C-10/C-11)", async ({
    page,
  }) => {
    const memo = `e2e-dd-${Date.now()}`;

    await page.goto("/combos/new");
    await page.getByTestId("combo-editor-draft-checkbox").click();
    // ★M24-13: 仮登録でもレシピのステップ 1 本以上が要る(VAL-C09)。
    await addMinimalRecipeStep(page);
    await page.getByTestId("combo-editor-drive-damage").fill("-2.5");
    await page
      .getByPlaceholder("このコンボに関するメモ(任意)")
      .fill(memo);
    await saveNewComboAndOpenDetail(page, () =>
      page.getByRole("button", { name: "保存" }).click(),
    );

    // 詳細: drive_damage(小数・負値)が表示される。
    // ★M24-03 §4.4(SM-089): メモの 1 行目がレシピの上にも出るため、同じ文字列が
    //   1 画面に 2 か所ある。exact 一致で「メモ欄そのもの」を指す(1 行目は ✎ を伴う)。
    await expect(page.getByText(memo, { exact: true })).toBeVisible();
    await expect(page.getByText("ドライブダメージ")).toBeVisible();
    await expect(page.getByText("-2.5")).toBeVisible();

    // 後始末。
    await page.getByRole("button", { name: "削除" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "削除" }).click();
    await expect(page).toHaveURL(/\/combos(\?character_id=\d+)?$/);
  });
});

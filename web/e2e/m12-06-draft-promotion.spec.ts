import { test, expect } from "@playwright/test";

import {
  fillRequiredComboFields,
  gotoNewComboRecipeFor,
  openRecipeTab,
} from "./support/editor-input";
import { saveNewComboAndOpenDetail } from "./support/new-combo";

// M12-06 統合 E2E 穴埋め: 仮登録 →本登録昇格(§4.2 主要フロー)。
//
// 棚卸し(§3.4.1)の結果、既存 spec は draft 作成までで draft→非draft の「昇格」操作
// (PromoteToFinalButton 経由 PATCH isDraft:false + 本登録バリデーション)が未検証だった。
// 本フローのスモークを最小限で補う(過剰作成回避 §10-5: 1 ケースのみ)。
//
// 方式: 既存の安定セレクタのみ(draft=既存 testid / 仮想コントローラ=role / 保存=role / 昇格=role)。
//       昇格は本登録バリデーションを通すため、ryu の実在技 2 ステップ(弱パンチ + 投げ)で
//       VAL-C09(レシピ非空)を満たす valid なコンボを作ってから昇格する。
//       昇格結果は API GET(isDraft=false)で確認(DOM 非依存)。
//
// 前提: `make e2e` / `make e2e-only` が起動する使い捨てスタックで実行される
//      (既定はバックエンド :47390 / Vite :5273。worktree ごとに決定的にオフセットされる)。
//      DB は毎回作り直す seed 済みの使い捨て DB であり、dev DB・dev サーバには影響しない。

test.describe("M12-06 仮登録 →本登録昇格 スモーク", () => {
  test("draft 作成(2ステップ)→ 詳細で本登録に昇格 → isDraft=false が永続化", async ({
    page,
  }) => {
    // ── draft + レシピ2ステップで作成 ───────────────────────────────────
    await gotoNewComboRecipeFor(page, "ryu");
    await page.getByTestId("combo-editor-draft-checkbox").click();

    // 仮想コントローラで実在技を 2 件追加(弱パンチ→standing_light_punch / 前投げ→throw_forward)。
    await page.getByRole("button", { name: "弱パンチ" }).click();
    await expect(page.locator("ol > li")).toHaveCount(1);
    // ★★M30-01 追補: 共通技は共通技タブへ移設した。⇒ 先にタブを開く。
    await page.getByTestId("recipe-tab-common").click();
    await page.getByRole("button", { name: "前投げ" }).click();
    await expect(page.locator("ol > li")).toHaveCount(2);

    // ★★M27-02b(VAL-C15): 昇格は本登録バリデーションを通すため、必須欄が要る
    //   (★M38-01 追補2 の時点で damage / knockdown_advantage の 2 欄)。
    //   ★仮登録での保存自体には要らない(VAL-C15 は仮登録をスキップする)が、
    //     **埋めずに作った仮登録は昇格できない**。⇒ 昇格を見る本 spec では先に埋める。
    //   ★これは実利用でも同じである(§本サブ完了報告 §2.2)。
    await fillRequiredComboFields(page);
    await openRecipeTab(page);

    // M24-01 §4.4: 保存後は一覧へ戻る。id は POST の応答から取り、詳細を開く。
    const id = await saveNewComboAndOpenDetail(page, () =>
      page.getByRole("button", { name: "保存" }).click(),
    );

    // 作成直後は draft であること(昇格前の前提)。
    const before = await (await page.request.get(`/api/combos/${id}`)).json();
    expect(before.isDraft).toBe(true);

    // ── 本登録に昇格(詳細ページの PromoteToFinalButton)──────────────────
    await page.getByRole("button", { name: "本登録に昇格" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "OK" }).click();

    // 昇格ボタンは isDraft=false で消える(UI 反映の確認)。
    await expect(
      page.getByRole("button", { name: "本登録に昇格" }),
    ).toHaveCount(0);

    // 再取得: isDraft=false が永続化されていること(= 昇格の核心)。
    const after = await (await page.request.get(`/api/combos/${id}`)).json();
    expect(after.isDraft).toBe(false);

    // ── 後始末(published コンボを残さず C02 重複の温床を避ける)──────────
    await page.request.delete(`/api/combos/${id}`);
  });
});

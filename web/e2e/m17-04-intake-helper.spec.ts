import { test, expect } from "@playwright/test";
import { pickCharacterByCode } from "./support/characters";

// M17-04 他から引っ越し(M24-07 で「取込ヘルパー」→「引っ越し取込」、M38-02 で「他から引っ越し」へ再改称): ① プロンプト出力(TSV)を貼付 → ② 厳密照合 → 人レビューで未解決を解決 →
// 取込 CSV を生成し既存 import プレビューへ連携、の一気通貫を確認する。
//
// DB 前提: 使い捨て DB・件数非依存。ryu は最古から moves seed を持つ安定基準。
// 照合は決定論(トークン "2MP" → crouching_medium_punch)。未解決は人レビューで解決する。

const PASTE_LABEL = "AI が出力した表(Markdown のパイプ表)をそのまま貼り付けてください";

// Markdown パイプ表の 1 行を作る(AI チャットが安定生成する主形式)。
function row(...cols: string[]): string {
  return `| ${cols.join(" | ")} |`;
}

test.describe("他から引っ越し(M17-04)", () => {
  test("貼付 → 照合 → 未解決を解決 → 取込プレビューへ連携", async ({ page }) => {
    await page.goto("/import/combo/helper");

    // キャラ選択(ryu)。
    await pickCharacterByCode(page.getByTestId("intake-helper-character"), "ryu");

    // AI 出力を模した TSV を貼り付け。1 行目は "2MP"(解決可)、2 行目は "?"(未解決)。
    const text = [
      row("1", "1", "屈中P", "2MP", "しゃがみ中P", "高", ""),
      row("1", "2", "謎技", "?", "?", "低", ""),
    ].join("\n");
    await page.getByPlaceholder(PASTE_LABEL).fill(text);

    await page.getByRole("button", { name: "照合" }).click();

    // 照合結果セクションが表示され、1 行目はトークンで解決される。
    await expect(
      page.getByRole("heading", { name: "3. 照合結果を確認・解決" }),
    ).toBeVisible();
    await expect(page.getByText("トークンで解決")).toBeVisible();

    // 未解決が残るため、取込プレビューへ進むボタンは無効。
    const proceed = page.getByRole("button", { name: "取込プレビューへ進む" });
    await expect(proceed).toBeDisabled();

    // 未解決の 1 行(ステップ2)を「除外」にすると、解決不要で進めるようになる。
    await page.getByLabel("ステップ 2 を取込から除外").check();
    await expect(proceed).toBeEnabled();
    // 除外を外すと再び無効。
    await page.getByLabel("ステップ 2 を取込から除外").uncheck();
    await expect(proceed).toBeDisabled();

    // 未解決の 1 行(ステップ2)を技セレクタで解決する。
    await page
      .getByLabel("ステップ 2 の技を指定")
      .selectOption("crouching_medium_punch");

    // 全ステップ解決 → ボタンが有効化 → クリックで既存 import へ連携。
    await expect(proceed).toBeEnabled();
    await proceed.click();

    // 既存 import 画面へ遷移し、自動でプレビューが表示される。
    // (連携後の初回プレビューはサーバのコールドスタートを含むため待ち時間を長めに取る)。
    await expect(page).toHaveURL(/\/import\/combo$/);
    await expect(page.getByText(/行を取込対象に選択中/)).toBeVisible({ timeout: 20000 });
  });

  // ★★本テストは 2026-09-02(M14-03f・第四波 seed)で書き換えた。
  //
  // 旧テストは「未投入キャラは全行未解決として提示される(壊れない)」で、c_viper を
  // 「characters に居るが moves 未 seed」のキャラとして使っていた。⇒ 第四波で 31 キャラ
  // すべてが本 seed 済みになり、配布 DB から該当するキャラが消えた。
  //
  // ★不変条件そのもの(未投入キャラでもエラーで止まらない)は Go のテストが fixture 付きで
  //   守っている(internal/api/intake/handler_test.go の TestResolve_MovelessCharacter_AllUnresolved)。
  //   E2E スタックは debug ビルドを使わないため spec からキャラを差し込めない。
  //   ⇒ 画面側の E2E 被覆は失われた。完了報告 §15 に followup 候補として記録した。
  //
  // ★本テストは代わりに「第四波 seed が取込ヘルパまで届いたか」を主張する。
  test("c_viper(第四波で本 seed 済み): 照合が通り、未投入の案内は出ない", async ({ page }) => {
    await page.goto("/import/combo/helper");

    await pickCharacterByCode(page.getByTestId("intake-helper-character"), "c_viper");

    await page
      .getByPlaceholder(PASTE_LABEL)
      .fill(row("1", "1", "屈中P", "2MP", "しゃがみ中P", "高", ""));

    await page.getByRole("button", { name: "照合" }).click();

    // ★第四波より前はここで「技データ未投入」の案内が出ていた。出なくなったことを主張する。
    await expect(
      page.getByRole("button", { name: "取込プレビューへ進む" }),
    ).toBeEnabled();
    await expect(page.getByText("技データ未投入")).toHaveCount(0);
  });
});

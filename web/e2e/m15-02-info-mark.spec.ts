import { test, expect } from "@playwright/test";

// M15-02: 選択モードボタン改称(FB③)の実画面スモーク。
//
// 目的: FB③「選択モード」ボタンのラベル曖昧性を根治する改称(「選択モード」→「比較対象選択」
//       →M17-05b でエクスポート導線も同じ選択を使うようになったため「比較/エクスポート対象選択」)が
//       コンボ一覧・マイコンボの両画面で反映され、押下で従来どおり選択モードへ入れる
//       (既存導線が非回帰)ことを実画面で検証する。
//
// 前提: ウィザードが完了済みのローカル開発環境で実行すること(未完了だと /wizard へリダイレクト)。
// DB 前提: ヘッダのモード切替 UI のみを対象とする seed 非依存 self-contained。
//          既存コンボ seed・永続 dev DB 残渣に一切依存しない(コンボの作成・保存はしない)。
//
// 注: FB⑤ modifier の info-mark 表示は Vitest(ModifiersEditor 直接描画)で担保する。
//     レシピ手順を E2E で組む方式は move セレクタに test-id が無く脆いため採らない。

test.describe("M15-02 選択モードボタン改称スモーク", () => {
  for (const { name, path } of [
    { name: "コンボ一覧", path: "/combos" },
    { name: "マイコンボ", path: "/mycombo" },
  ]) {
    test(`${name}: ボタンが「比較/エクスポート対象選択」表示で、押下で選択モードへ入る`, async ({
      page,
    }) => {
      await page.goto(path);

      // 現行ラベルのボタンが存在する(旧「選択モード」「比較対象選択」ではない)
      const enterButton = page.getByRole("button", {
        name: "比較/エクスポート対象選択",
      });
      await expect(enterButton).toBeVisible();
      await expect(
        page.getByRole("button", { name: "選択モード", exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "比較対象選択", exact: true }),
      ).toHaveCount(0);

      // 押下 → 選択モードへ入る(件数バッジ + 選択解除ボタンが出る)
      await enterButton.click();
      await expect(page.getByText(/件選択中/)).toBeVisible();
      const exitButton = page.getByRole("button", { name: "選択解除" });
      await expect(exitButton).toBeVisible();

      // 選択解除で元に戻る(非破壊・従来導線が機能)
      await exitButton.click();
      await expect(
        page.getByRole("button", { name: "比較/エクスポート対象選択" }),
      ).toBeVisible();
    });
  }
});

// 注: ⑤ modifier の info-mark(レシピの「編集ボタンについて」+ ダイアログ内タイトル横)は
//     Vitest で担保する(RecipeBuilder.test / ModifiersEditor.test)。
//     レシピにステップを組む手順は move セレクタに test-id が無く E2E では脆いため採らない。

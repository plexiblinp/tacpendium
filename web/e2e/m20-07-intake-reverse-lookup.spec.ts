import { test, expect } from "@playwright/test";
import { pickCharacterByCode } from "./support/characters";

// M20-07 逆引きの活用: 前段の正規化 / alias_text と alias_text_en の両引き /
// 多候補ハッジの分割 / 「解けなかった」と「そもそも候補に挙がらなかった」の出し分け。
//
// DB 前提: 使い捨て DB・件数非依存。本 spec はプリセットを作らない・消さないため、
// グローバル資源(プリセット総数)を奪い合わない(D-362)。
//
// 使う実データ(seed 済み・全キャラ共通の形):
//   - ingrid `サンバニッシュ（上）` … 辞書側が全角括弧。利用者は半角で打つ(D-307)
//   - ryu    `236236P (SA1)`      … 注記を省いた `236236P` は 1 件に解ける
//   - ryu    `236236K (CA)` / `236236K (SA3)` … 注記を省くと 2 件へ割れる(全 17 キャラで同じ形)

const PASTE_LABEL = "AI が出力した表(Markdown のパイプ表)をそのまま貼り付けてください";

function row(...cols: string[]): string {
  return `| ${cols.join(" | ")} |`;
}

// resolve は 1 キャラ・複数行を貼って照合し、結果テーブルが出るまで待つ。
async function resolve(page: import("@playwright/test").Page, charCode: string, rows: string[]) {
  await page.goto("/import/combo/helper");
  await pickCharacterByCode(page.getByTestId("intake-helper-character"), charCode);
  await page.getByPlaceholder(PASTE_LABEL).fill(rows.join("\n"));
  await page.getByRole("button", { name: "照合" }).click();
  await expect(page.getByRole("heading", { name: "3. 照合結果を確認・解決" })).toBeVisible();
}

test.describe("逆引きの正規化と両引き(M20-07)", () => {
  test("全角括弧の技を半角で書いても解決する", async ({ page }) => {
    await resolve(page, "ingrid", [
      // 辞書は `サンバニッシュ（上）`(全角)。利用者は半角で打つ。
      row("1", "1", "サンバニッシュ", "?", "サンバニッシュ(上)", "高", ""),
      // ★対照実験: 存在しない表記は解決しない(正規化が何にでも当たる状態ではない)。
      row("1", "2", "架空技", "?", "サンバニッシュ(下)", "低", ""),
    ]);

    const rows = page.locator("tbody tr");
    await expect(rows.nth(0)).toHaveAttribute("data-resolved", "true");
    await expect(rows.nth(0).getByText("別名で解決")).toBeVisible();
    await expect(rows.nth(1)).toHaveAttribute("data-resolved", "false");
  });

  test("SA 注記を省いた入力は 1 件に解ければ確定し、割れれば候補として出る", async ({ page }) => {
    await resolve(page, "ryu", [
      // `236236P (SA1)` の注記を省いた入力 → 第 2 段で 1 件に解ける。
      row("1", "1", "真空波動", "?", "236236P", "中", ""),
      // `236236K` は CA と SA3 の 2 件へ割れる → ★勝手に選ばず未解決のまま候補を出す。
      row("1", "2", "SA3?", "?", "236236K", "低", ""),
    ]);

    const rows = page.locator("tbody tr");
    await expect(rows.nth(0)).toHaveAttribute("data-resolved", "true");
    await expect(rows.nth(0).getByText("別名で解決")).toBeVisible();

    await expect(rows.nth(1)).toHaveAttribute("data-resolved", "false");
    await expect(rows.nth(1)).toHaveAttribute("data-unresolved-kind", "ambiguous");
    await expect(rows.nth(1).getByText("未解決(候補 2 件)")).toBeVisible();

    // 候補が選択肢として実際に出ており、人が選べること。
    const select = page.getByLabel("ステップ 2 の技を指定");
    await expect(select.locator('optgroup[label="候補(2 件)"] option')).toHaveCount(2);
    await select.selectOption("sa3_shin_shoryuken");
    await expect(rows.nth(1)).toHaveAttribute("data-resolved", "true");
  });

  test("「候補あり」と「候補なし」を別の顔で出す", async ({ page }) => {
    await resolve(page, "ryu", [
      // 候補あり(CA と SA3 に割れる)。
      row("1", "1", "SA3?", "?", "236236K", "低", ""),
      // 候補なし(辞書に無い技名)。
      row("1", "2", "架空技", "?", "存在しない技XYZ", "低", ""),
    ]);

    const rows = page.locator("tbody tr");
    await expect(rows.nth(0)).toHaveAttribute("data-unresolved-kind", "ambiguous");
    await expect(rows.nth(1)).toHaveAttribute("data-unresolved-kind", "no-match");

    // ★同じ「未解決」でも文言が違うこと(E-84。同じ顔で出すと次に何をすべきか分からない)。
    await expect(rows.nth(0).getByText("未解決(候補 2 件)")).toBeVisible();
    await expect(rows.nth(1).getByText("未解決(候補なし)")).toBeVisible();

    // 候補なしの行には候補グループそのものが出ない。
    await expect(
      page.getByLabel("ステップ 2 の技を指定").locator("optgroup").first(),
    ).toHaveAttribute("label", "すべての技");
  });

  test("多候補ハッジは分割され、候補として出る(確定にはならない)", async ({ page }) => {
    await resolve(page, "ryu", [
      row("1", "1", "中P", "?", "立ち中P or しゃがみ中P", "低", ""),
    ]);

    const step = page.locator("tbody tr").nth(0);
    // ★分割の結果を確定にしない。どれが正しいかはメモの書き手しか知らない。
    await expect(step).toHaveAttribute("data-resolved", "false");
    await expect(step).toHaveAttribute("data-unresolved-kind", "ambiguous");
    await expect(step.getByText("未解決(候補 2 件)")).toBeVisible();

    const select = page.getByLabel("ステップ 1 の技を指定");
    await expect(select.locator('optgroup[label="候補(2 件)"] option')).toHaveCount(2);

    // 取込プレビューへは進めない(未解決が残っているため)。
    await expect(page.getByRole("button", { name: "取込プレビューへ進む" })).toBeDisabled();
  });

  test("技名の中の or では分割しない(対照)", async ({ page }) => {
    await resolve(page, "ryu", [
      // "or" を含むが前後に空白を伴う区切りではない → 分割されず、辞書にも無いので候補なし。
      row("1", "1", "架空技", "?", "Order of the Sun", "低", ""),
    ]);

    const step = page.locator("tbody tr").nth(0);
    await expect(step).toHaveAttribute("data-unresolved-kind", "no-match");
  });
});

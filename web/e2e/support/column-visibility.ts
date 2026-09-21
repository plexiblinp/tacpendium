import { expect, type Page } from "@playwright/test";

// 一覧の「表示列」カスタマイズを操作する E2E ヘルパ。
//
// ★M24-03 の手動確認(開発者判断 2026-08-26)で「備考」「セットプレイ数」が既定 OFF に
//   なった。列そのものは残っており、利用者は「表示列」から戻せる。
//   ⇒ その列を前提にする spec は、明示的に ON にしてから確かめること。
//     (命題は「列が機能するか」であって「既定で出るか」ではない)
// ★同じ数行を複数 spec へ複製しない(E-232)。
// ★本ファイルは spec ではない(playwright の既定 testMatch は *.spec.ts / *.test.ts のみ)。

/**
 * 「表示列」メニューを開いて、指定した列の表示を切り替える。
 *
 * ★メニューは 1 つ切り替えるたびに閉じない作りになっている(C-23)ため、
 *   複数の列名をまとめて渡せる。最後に Escape で閉じる。
 *
 * @param columnLabels 列の表示名(例: "セットプレイ数" / "備考")
 */
export async function toggleListColumns(
  page: Page,
  ...columnLabels: string[]
): Promise<void> {
  await page.getByRole("button", { name: "表示列" }).click();
  for (const label of columnLabels) {
    const item = page.getByRole("menuitemcheckbox", { name: label });
    await expect(item, `「表示列」に「${label}」が無い`).toHaveCount(1);
    await item.click();
  }
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menuitemcheckbox").first()).toHaveCount(0);
}

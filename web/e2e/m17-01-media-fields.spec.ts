import { test, expect } from "@playwright/test";
import { saveNewComboAndOpenDetail } from "./support/new-combo";
import { addMinimalRecipeStep } from "./support/editor-input";

// 前提: ウィザードが完了済みのローカル開発環境で実行すること。
// 未完了環境では /wizard へリダイレクトされ spec が失敗する。
//
// DB 前提: spec が自前でデータを作成・削除するため、既存コンボ件数に依存しない。
// ★★M24-13: 「仮登録モードで保存するためステップ入力は不要」は撤回された
//   (VAL-C09 を仮登録へ適用した)。⇒ 最小のレシピを 1 本置いてから保存する。

test.describe("M17-01 メディア 3 フィールド", () => {
  test("メディア入力 → 詳細表示(link リンク化・path テキスト)→ link 空クリア → 削除", async ({
    page,
  }) => {
    const unique = Date.now();
    const link = `https://example.com/e2e-${unique}`;
    const videoPath = `videos/e2e-${unique}.mp4`;
    const imagePath = `images/e2e-${unique}.png`;

    // ── 登録 ────────────────────────────────────────────────────────────
    await page.goto("/combos/new");
    await page.getByTestId("combo-editor-draft-checkbox").click();
    // ★M24-13: 仮登録でもレシピのステップ 1 本以上が要る(VAL-C09)。
    await addMinimalRecipeStep(page);

    await page
      .getByPlaceholder("解説ページ等の URL(任意・http/https のみリンク化)")
      .fill(link);
    await page
      .getByPlaceholder("動画ファイルの相対パス(任意・表示のみ)")
      .fill(videoPath);
    await page
      .getByPlaceholder("画像ファイルの相対パス(任意・表示のみ)")
      .fill(imagePath);

    await saveNewComboAndOpenDetail(page, () =>
      page.getByRole("button", { name: "保存" }).click(),
    );

    // ── 詳細確認: link はアンカー・path 2 種はテキスト ──────────────────
    const anchor = page.getByRole("link", { name: link });
    await expect(anchor).toBeVisible();
    await expect(anchor).toHaveAttribute("href", link);
    await expect(anchor).toHaveAttribute("rel", "noopener noreferrer");
    await expect(anchor).toHaveAttribute("target", "_blank");

    await expect(page.getByTestId("combo-detail-video-path")).toHaveText(
      videoPath,
    );
    await expect(page.getByTestId("combo-detail-image-path")).toHaveText(
      imagePath,
    );
    await expect(page.getByRole("link", { name: videoPath })).toHaveCount(0);
    await expect(page.getByRole("link", { name: imagePath })).toHaveCount(0);

    // ── 編集: link を空クリア(path 2 種は触らない) ──────────────────────
    await page.getByRole("link", { name: "編集", exact: true }).click();
    await expect(page).toHaveURL(/\/combos\/\d+\/edit$/);

    const linkInput = page.getByPlaceholder(
      "解説ページ等の URL(任意・http/https のみリンク化)",
    );
    await expect(linkInput).toHaveValue(link);
    await linkInput.clear();
    await page.getByRole("button", { name: "保存" }).click();

    // ── 詳細: link は消え、未編集の path 2 種は温存(トライステート) ──────
    await expect(page).toHaveURL(/\/combos\/\d+$/);
    await expect(page.getByTestId("combo-detail-video-path")).toHaveText(
      videoPath,
    );
    await expect(page.getByTestId("combo-detail-link")).toHaveCount(0);
    await expect(page.getByRole("link", { name: link })).toHaveCount(0);

    // ── 後始末 ──────────────────────────────────────────────────────────
    await page.getByRole("button", { name: "削除" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "削除" }).click();
    await expect(page).toHaveURL(/\/combos(\?character_id=\d+)?$/);
  });

  test("危険スキーム(javascript:)の link は詳細で非リンクのテキスト表示(XSS 無害化)", async ({
    page,
  }) => {
    const payload = `javascript:alert(${Date.now()})`;

    // ── 登録 ────────────────────────────────────────────────────────────
    await page.goto("/combos/new");
    await page.getByTestId("combo-editor-draft-checkbox").click();
    // ★M24-13: 仮登録でもレシピのステップ 1 本以上が要る(VAL-C09)。
    await addMinimalRecipeStep(page);
    await page
      .getByPlaceholder("解説ページ等の URL(任意・http/https のみリンク化)")
      .fill(payload);
    await saveNewComboAndOpenDetail(page, () =>
      page.getByRole("button", { name: "保存" }).click(),
    );

    // ── 詳細: 値はテキスト表示され、アンカーは生成されない ────────────────
    await expect(page.getByTestId("combo-detail-link")).toHaveText(payload);
    await expect(page.getByRole("link", { name: payload })).toHaveCount(0);

    // ── 後始末 ──────────────────────────────────────────────────────────
    await page.getByRole("button", { name: "削除" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "削除" }).click();
    await expect(page).toHaveURL(/\/combos(\?character_id=\d+)?$/);
  });
});

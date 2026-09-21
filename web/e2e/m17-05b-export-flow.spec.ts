import { test, expect } from "@playwright/test";

import { expectExportFilename } from "./support/combo-io";

import { characterIdOf, gotoComboListFor } from "./support/character";
import { saveNewComboAndOpenDetail } from "./support/new-combo";
import { minimalDraftSteps } from "./support/draft-combo";
import { addMinimalRecipeStep } from "./support/editor-input";

// 前提: ウィザードが完了済みのローカル開発環境で実行すること。
// 未完了環境では /wizard へリダイレクトされ spec が失敗する。
//
// DB 前提: spec が自前でデータを作成・削除するため、既存コンボ件数に依存しない。
// 仮登録(is_draft=true)モードで保存する(VAL-C02 重複判定は仮登録では非実行のため、
// レシピ・状況を揃えたまま複数件作成しても衝突しない)。
//
// ★M24-06 でエクスポート画面(§5.13。ComboExportPage・/export/combo)を廃止した。
// 出力の入口は本 spec が踏む §5.13a のダイアログだけである(旧「温存対象」は失効)。
// CSV ダウンロードの非回帰は combo-csv-io.spec.ts と m24-06-import-export-ux.spec.ts の
// (4)(往復対称)が `make e2e` 実行の一部として担保しているため、本 spec では重複して
// 再検証しない。★m17-01-media-fields.spec.ts は download にも export にも触れていない
// (grep 0 件)。旧記述の誤りを M24-06 で是正した。

test.describe("M17-05b エクスポート動線・形式(選択→エクスポート/複数形式)", () => {
  test("一覧: 2件選択 → ダイアログ → CSV+PDF 同時ダウンロード", async ({ page }) => {
    const ts = Date.now();
    const memoA = `e2e-export-a-${ts}`;
    const memoB = `e2e-export-b-${ts}`;

    // ── コンボ2件を作成(メモで同定) ─────────────────────────────────────
    await page.goto("/combos/new");
    await page.getByTestId("combo-editor-draft-checkbox").click();
    // ★M24-13: 仮登録でもレシピのステップ 1 本以上が要る(VAL-C09)。
    await addMinimalRecipeStep(page);
    await page.getByPlaceholder("このコンボに関するメモ(任意)").fill(memoA);
    // M24-01 §4.4: 保存後は一覧へ戻る。id は POST の応答から取る。
    const idA = await saveNewComboAndOpenDetail(page, () =>
      page.getByRole("button", { name: "保存" }).click(),
    );

    await page.goto("/combos/new");
    await page.getByTestId("combo-editor-draft-checkbox").click();
    // ★M24-13: 仮登録でもレシピのステップ 1 本以上が要る(VAL-C09)。
    await addMinimalRecipeStep(page);
    await page.getByPlaceholder("このコンボに関するメモ(任意)").fill(memoB);
    // M24-01 §4.4: 保存後は一覧へ戻る。id は POST の応答から取る。
    const idB = await saveNewComboAndOpenDetail(page, () =>
      page.getByRole("button", { name: "保存" }).click(),
    );

    // ── 一覧: 比較対象選択モード → 2件チェック ──────────────────────────
    await page.goto("/combos");
    // ★★M24-03: 備考列は既定 OFF になり(開発者判断 2026-08-26)、メモはレシピ列の
    //   直上の 1 行目としてだけ出る。⇒ 「どの列がメモを表示しているか」に依存しない
    //   形にする。本ケースの命題は「fixture が一覧に出ている」ことである。
    await expect(page.locator("tr", { hasText: memoA })).toHaveCount(1);
    await expect(page.locator("tr", { hasText: memoB })).toHaveCount(1);

    await page.getByRole("button", { name: "比較/エクスポート対象選択" }).click();
    await page.getByRole("checkbox", { name: `コンボ #${idA} を選択` }).click();
    await page.getByRole("checkbox", { name: `コンボ #${idB} を選択` }).click();

    // ── エクスポートボタン(選択件数を明示) → ダイアログ ─────────────────
    await expect(page.getByTestId("export-open-button")).toHaveText(
      "2 件をエクスポート",
    );
    await page.getByTestId("export-open-button").click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/選択した 2 件/)).toBeVisible();

    // ── CSV(既定 ON)+ PDF を同時選択して実行 ────────────────────────────
    await dialog.getByTestId("export-format-pdf").click();

    const downloads: import("@playwright/test").Download[] = [];
    page.on("download", (d) => downloads.push(d));

    await dialog.getByRole("button", { name: "エクスポート実行" }).click();

    await expect.poll(() => downloads.length, { timeout: 15_000 }).toBe(2);
    const filenames = downloads.map((d) => d.suggestedFilename()).sort();
    // ★M24-06: 拡張子だけでなく自動命名(SM-075)の形と件数まで見る = 緩めていない。
    const zip = filenames.find((f) => f.endsWith(".zip"));
    const pdf = filenames.find((f) => f.endsWith(".pdf"));
    expect(zip, "zip が 1 本ダウンロードされる").toBeTruthy();
    expect(pdf, "pdf が 1 本ダウンロードされる").toBeTruthy();
    expectExportFilename(zip!, { extension: "zip", count: 2 });
    expectExportFilename(pdf!, { extension: "pdf", count: 2 });

    // ── 完了トースト・ダイアログ自動クローズ(全形式成功) ────────────────
    await expect(page.getByText(/エクスポートが完了しました/)).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // ── 後始末 ──────────────────────────────────────────────────────────
    for (const id of [idA, idB]) {
      await page.goto(`/combos/${id}`);
      await page.getByRole("button", { name: "削除" }).click();
      const confirm = page.getByRole("alertdialog");
      await expect(confirm).toBeVisible();
      await confirm.getByRole("button", { name: "削除" }).click();
      await expect(page).toHaveURL(/\/combos(\?character_id=\d+)?$/);
    }
  });

  // レビュー指摘(M17-05b レビュー報告書・高): 比較対象選択(M15-02)の上限は 5 件、
  // エクスポート選択の上限は 1000 件(MAX_EXPORT_SELECTION)と分離されている。
  // 5 件を超えて選択した際、比較専用の即時フィードバック(「比較対象は最大 5 件までです」)が
  // 正しく出て、かつエクスポート側は件数どおり有効なままであることを確認する
  // (toggle() 自体の上限=1000 に頼った旧実装は 6 件目でこのメッセージを出さない回帰があった)。
  test("一覧: 6件選択で比較は上限メッセージ(5件)・エクスポートは件数どおり有効", async ({
    page,
  }) => {
    const ts = Date.now();
    const ids: number[] = [];
    // ★キャラは code から解決する。id を直書きしない(M24-09c 追補 段 2)。
    //   ループの外で 1 回だけ引く(6 件とも同じキャラのため。レビュー L-6)。
    const characterId = await characterIdOf(page.request, "ryu");
    for (let i = 0; i < 6; i++) {
      const res = await page.request.post("/api/combos", {
        data: {
          characterId,
          isDraft: true,
          memo: `e2e-cap-${ts}-${i}`,
          // ★M24-13: 仮登録でもレシピのステップ 1 本以上が要る(VAL-C09)。
          steps: minimalDraftSteps(),
        },
      });
      expect(res.ok()).toBeTruthy();
      const combo = (await res.json()) as { id: number };
      ids.push(combo.id);
    }

    // ★一覧は既定キャラで絞られる。作った行と同じキャラを明示して開く(段 2)。
    await gotoComboListFor(page, "ryu");
    await page.getByRole("button", { name: "比較/エクスポート対象選択" }).click();
    for (const id of ids) {
      await page.getByRole("checkbox", { name: `コンボ #${id} を選択` }).click();
    }

    // 6件目で比較上限(5件)の即時フィードバックが正しく出る(エクスポート上限〔1000〕ではない)。
    await expect(page.getByText("比較対象は最大 5 件までです")).toBeVisible();
    await expect(page.getByTestId("export-open-button")).toHaveText(
      "6 件をエクスポート",
    );
    await expect(page.getByTestId("export-open-button")).not.toBeDisabled();
    await expect(page.getByRole("button", { name: "比較" })).toBeDisabled();

    // ── 後始末 ──────────────────────────────────────────────────────────
    for (const id of ids) {
      const res = await page.request.delete(`/api/combos/${id}`);
      expect(res.ok()).toBeTruthy();
    }
  });

  test("マイコンボ: 選択ゼロ(現フィルタ全件)から CSV エクスポートできる", async ({
    page,
  }) => {
    const ts = Date.now();
    // 一覧の備考列は 30 文字超で省略表示(formatMemo)されるため、行の hasText 一致用に短く保つ。
    const memo = `e2e-myc-${ts}`;

    // ── コンボ作成 ──────────────────────────────────────────────────────
    await page.goto("/combos/new");
    await page.getByTestId("combo-editor-draft-checkbox").click();
    // ★M24-13: 仮登録でもレシピのステップ 1 本以上が要る(VAL-C09)。
    await addMinimalRecipeStep(page);
    await page.getByPlaceholder("このコンボに関するメモ(任意)").fill(memo);
    // M24-01 §4.4: 保存後は一覧へ戻る。id は POST の応答から取る。
    const id = await saveNewComboAndOpenDetail(page, () =>
      page.getByRole("button", { name: "保存" }).click(),
    );

    // ── 一覧の行から「使用中」タグを付与(マイコンボ既定タブに載せる) ─────
    await page.goto("/combos");
    const row = page.locator("tr", { hasText: memo });
    await row.getByRole("combobox").click();
    await page.getByRole("option", { name: "使用中" }).click();

    // ── マイコンボ(既定タブ=使用中): 未選択のままエクスポート ────────────
    await page.goto("/mycombo");
    // ★M24-03: 上と同じ理由で、列に依存しない行の存在で確かめる。
    await expect(page.locator("tr", { hasText: memo })).toHaveCount(1);
    await expect(page.getByTestId("export-open-button")).not.toBeDisabled();

    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("export-open-button").click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/現在のフィルタ結果 全/)).toBeVisible();

    await dialog.getByRole("button", { name: "エクスポート実行" }).click();
    const download = await downloadPromise;
    expectExportFilename(download.suggestedFilename(), { extension: "zip" });

    // ── 後始末 ──────────────────────────────────────────────────────────
    await page.goto(`/combos/${id}`);
    await page.getByRole("button", { name: "削除" }).click();
    const confirm = page.getByRole("alertdialog");
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "削除" }).click();
    await expect(page).toHaveURL(/\/combos(\?character_id=\d+)?$/);
  });
});

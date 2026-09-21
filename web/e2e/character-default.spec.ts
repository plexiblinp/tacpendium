import { test, expect } from "@playwright/test";
import { saveNewComboAndOpenDetail } from "./support/new-combo";
import { pickCharacter } from "./support/characters";
import { addMinimalRecipeStep } from "./support/editor-input";

// 前提: `make e2e` / `make e2e-only` が起動する使い捨てスタックで実行される
//      (既定はバックエンド :47390 / Vite :5273。worktree ごとに決定的にオフセットされる)。
//      DB は毎回作り直す seed 済みの使い捨て DB であり、dev DB・dev サーバには影響しない。
// クラシック5体(ryu/ken/ingrid/c_viper/dhalsim)が seed 済みであること。
// DB 前提: spec が自前でデータを作成・削除するため、既存コンボ件数に依存しない。

test.describe("M10-02 既定キャラの文脈追従", () => {
  test("一覧でキャラ選択 → 新規登録の既定が文脈キャラ / 文脈なしはリュウ", async ({
    page,
  }) => {
    // ── 文脈あり: 一覧でダルシム選択 → 新規登録 ──────────────────────────
    await page.goto("/combos");

    // ★M24-02 §4.3: キャラ選択は native select からコンボボックスへ変わった。
    await pickCharacter(page.getByTestId("combo-list-character-scope"), "ダルシム");

    await expect(page).toHaveURL(/character_id=/);

    await page.getByRole("link", { name: "新規登録" }).click();

    await expect(page).toHaveURL(/\/combos\/new\?character=/);
    await expect(page.getByText("ダルシム").first()).toBeVisible();

    // ── 文脈なし(?character= 無し)────────────────────────────────────────
    // ★M24-01 §4.1-2 で解決順が入った。URL 文脈が無いときは
    //   段 2(同一セッションで最後に選んだキャラ)が効く。
    //   ⇒ 直前にダルシムを選んでいるので、ここはダルシムのままになる。
    //   これは M10-02 の「文脈なしはリュウ」を置き換える後状態である(SM-041)。
    await page.goto("/combos/new");
    await expect(page.getByText("ダルシム").first()).toBeVisible();

    // ── 段 2 も無いとき: 設定の既定キャラ(段 3b)/ フォールバック(段 4)へ落ちる ──
    // E2E の config.toml.example には [defaults] が無く、既定値は 1(= リュウ)である。
    await page.evaluate(() => sessionStorage.clear());
    await page.goto("/combos/new");
    await expect(page.getByText("リュウ").first()).toBeVisible();
  });

  test("コンボ追加モーダルの既定が比較中コンボのキャラに追従する", async ({
    page,
  }) => {
    const memo = `e2e-cmp-${Date.now()}`;

    const charsRes = await page.request.get("/api/games/1/characters");
    expect(charsRes.ok()).toBeTruthy();
    const chars = (await charsRes.json()).items as Array<{
      id: number;
      code: string;
    }>;
    const dhalsimId = chars.find((c) => c.code === "dhalsim")?.id;
    expect(dhalsimId).toBeTruthy();

    // ── ダルシムの仮登録コンボを1件作成 ─────────────────────────────────
    await page.goto(`/combos/new?character=${dhalsimId}`);
    await expect(page.getByText("ダルシム").first()).toBeVisible();

    await page.getByTestId("combo-editor-draft-checkbox").click();
    // ★M24-13: 仮登録でもレシピのステップ 1 本以上が要る(VAL-C09)。
    await addMinimalRecipeStep(page);
    await page
      .getByPlaceholder("このコンボに関するメモ(任意)")
      .fill(memo);
    // M24-01 §4.4: 保存後は一覧へ戻る。id は POST の応答から取る。
    const comboId = await saveNewComboAndOpenDetail(page, () =>
      page.getByRole("button", { name: "保存" }).click(),
    );

    try {
      // ── 比較画面でコンボ追加モーダルを開く ──────────────────────────
      await page.goto(`/compare?ids=${comboId}`);
      await page.getByRole("button", { name: "コンボを追加" }).click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText("ダルシム")).toBeVisible();
    } finally {
      await page.request.delete(`/api/combos/${comboId}`);
    }
  });
});

import { test, expect } from "@playwright/test";
import { saveNewComboAndOpenDetail } from "./support/new-combo";
import { addMinimalRecipeStep } from "./support/editor-input";

// M14-03b: 第一波 seed の custom_states(int・show_delta)実データ反映を確認する。
// ingrid の sun_crest(level 0-4・show_delta=true。000003_data_seed_characters)で ①始動最低 / ②終了 / ③増減 の
// 3 欄が editor に表示され、③=②−① が計算表示されることを実 seed データで検証する。
// M16-07 は単体/コンポーネントで担保済。本 spec はキャラ選択フロー + move seed 前提が要る実データ確認。
//
// 代表担保: int(level/stock)×show_delta の ①②③ UI 機構は全キャラ共通(def の値域のみ相違)のため、
// ingrid の sun_crest を代表として UI E2E で行使する。M14-03b(旧 000027)で新規投入した
// lily(windclad)/kimberly(shuriken_bomb_stock)/juri(fuha_stock)/mai(flame_stock) の def は
// migrate 整合テスト(TestRun_M1403b_SeedIntegrity・show_delta=5 等)で担保する。
//
// 前提: E2E 使い捨て DB(全マイグレ適用済み)。ingrid の id を API で解決し editor へ直接遷移する。

test.describe("M14-03b custom_states int ①②③(ingrid sun_crest 実データ)", () => {
  test("ingrid editor で ①②③ 欄表示・③=②−① 計算 → 保存で永続化", async ({
    page,
  }) => {
    const memo = `e2e-m1403b-cs-${Date.now()}`;

    // ingrid の character id を解決(?character= は数値 id を取る)。
    const res = await page.request.get("/api/games/1/characters");
    expect(res.ok()).toBeTruthy();
    const chars = (await res.json()).items as Array<{
      id: number;
      code: string;
    }>;
    const ingrid = chars.find((c) => c.code === "ingrid");
    expect(ingrid, "ingrid が seed 済みであること").toBeTruthy();

    await page.goto(`/combos/new?character=${ingrid!.id}`);

    // int state ①②③ の 3 欄が表示される(show_delta=true のため ③増減も出る)。
    await expect(
      page.getByTestId("combo-editor-custom-state-sun_crest-group"),
    ).toBeVisible();
    const start = page.getByTestId("combo-editor-custom-state-sun_crest-start");
    const end = page.getByTestId("combo-editor-custom-state-sun_crest-end");
    const delta = page.getByTestId("combo-editor-custom-state-sun_crest-delta");

    await start.fill("1");
    await end.fill("4");
    // ③増減 = ② − ① = 3。
    await expect(delta).toContainText("3");

    // 下書き保存 → 詳細で永続化を確認。
    await page.getByTestId("combo-editor-draft-checkbox").click();
    // ★M24-13: 仮登録でもレシピのステップ 1 本以上が要る(VAL-C09)。
    await addMinimalRecipeStep(page);
    await page
      .getByPlaceholder("このコンボに関するメモ(任意)")
      .fill(memo);
    await saveNewComboAndOpenDetail(page, () =>
      page.getByRole("button", { name: "保存" }).click(),
    );
    // ★M24-03 §4.4(SM-089): メモの 1 行目がレシピの上にも出るため、同じ文字列が
    //   1 画面に 2 か所ある。exact 一致で「メモ欄そのもの」を指す(1 行目は ✎ を伴う)。
    await expect(page.getByText(memo, { exact: true })).toBeVisible();

    // 後始末。
    await page.getByRole("button", { name: "削除" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "削除" }).click();
    await expect(page).toHaveURL(/\/combos(\?character_id=\d+)?$/);
  });
});

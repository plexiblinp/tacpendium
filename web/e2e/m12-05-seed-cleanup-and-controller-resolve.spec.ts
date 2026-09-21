import { test, expect } from "@playwright/test";

import { gotoNewComboRecipeFor } from "./support/editor-input";

// M12-05 E2E: seed 整理(配布クリーン)+ B-7 仮想コントローラ move_code 新形化の回帰。
//
// 前提: `make e2e` / `make e2e-only` が起動する使い捨てスタックで実行される
//      (既定はバックエンド :47390 / Vite :5273。worktree ごとに決定的にオフセットされる)。
//      DB は毎回作り直す seed 済みの使い捨て DB であり、dev DB・dev サーバには影響しない。
// 本 spec はコンボを保存せず、ロースター読取と編集画面のステップ追加操作のみ行う
// (作成データを残さないため後始末不要)。


test.describe("M12-05 配布クリーン + B-7 仮想コントローラ回帰", () => {
  // ★★2026-09-02(M14-03f・第四波 seed)で書き換えた。aki は旧 000082 で再追加され、
  // ロースターは 31 体で充足した。旧テストは「aki は出ず」を主張していたが、
  // 旧 000017 で除去された 3 体(aki / guile / jamie)はいずれも正式な手入力 CSV seed として
  // 戻ってきたため、その主張は失効した。
  // ⇒ 本テストが今も守っているのは「旧 000017 の除去と、後続波での再追加が両立している」ことである。
  test("(配布クリーン) 旧 000017 で除いた 3 体は後続 seed で再追加され、ロースターは 31 体", async ({
    page,
  }) => {
    const res = await page.request.get("/api/games/1/characters");
    expect(res.ok()).toBeTruthy();
    const chars = (await res.json()).items as Array<{
      id: number;
      code: string;
    }>;
    const codes = chars.map((c) => c.code);

    // 旧 000017 で除去された 3 体は、いずれも正式な手入力 CSV seed として再追加された。
    //   guile … M14-03b(旧 000024) / jamie … M14-03e(旧 000053) / aki … M14-03f(旧 000082)
    // ⇒ 旧 seed の除去と、正規 seed での再追加は両立する。
    for (const readded of ["guile", "jamie", "aki"]) {
      expect(codes, `${readded} は後続波で再追加されているはず`).toContain(readded);
    }
    // ryu + 先行リリース5体 + 第四波で本 seed 済みになった仮登録 2 体。
    for (const present of ["ryu", "ken", "ingrid", "c_viper", "dhalsim"]) {
      expect(codes, `${present} は存在するはず`).toContain(present);
    }
    // ★第四波(M14-03f)で全ロースターが充足した。重複が無いことも同時に見る。
    expect(codes.length, "ロースターは 31 体").toBe(31);
    expect(new Set(codes).size, "code の重複が無い").toBe(31);
  });

  test("(B-7 回帰) ryu の仮想コントローラで通常技・投げがステップに追加される", async ({
    page,
  }) => {
    // ryu(旧 000017 で seed code を新形へ統一済み)の新規コンボ編集を開く。
    await gotoNewComboRecipeFor(page, "ryu");

    // 初期状態: レシピは空(空状態メッセージが見える)。
    // ★★M29-01: 文言ではなく data-testid で掴む(M27-03 教訓 7)。着手前は
    //   本行が空状態の文面そのものを主張しており、語を直すと赤くなっていた。
    const emptyMsg = page.getByTestId("combo-recipe-steps-empty");
    await expect(emptyMsg).toBeVisible();

    // 弱パンチ → standing_light_punch に解決され、ステップが 1 件追加される。
    // (B-7 修正前は旧形 stand_light_punch を探して解決できず無反応だった)
    await page.getByRole("button", { name: "弱パンチ" }).click();
    await expect(emptyMsg).toHaveCount(0);
    await expect(page.locator("ol > li")).toHaveCount(1);

    // 前投げ → throw_forward に解決され、ステップが 2 件目として追加される(指摘14 で「投げ」→「前投げ」)。
    // ★★M30-01 追補: 共通技はタブ外の常設行から共通技タブへ移設した。⇒ 先にタブを開く。
    await page.getByTestId("recipe-tab-common").click();
    await page.getByRole("button", { name: "前投げ" }).click();
    await expect(page.locator("ol > li")).toHaveCount(2);
  });
});

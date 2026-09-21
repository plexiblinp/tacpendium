import { test, expect } from "@playwright/test";

import {
  fillRequiredComboFields,
  gotoNewComboRecipeFor,
  openRecipeTab,
  switchEditorTab,
} from "./support/editor-input";
import { saveNewComboAndOpenDetail } from "./support/new-combo";

// M21-05: キーボード入力（既定を持たない全キー登録制）の E2E スモーク。
//
// 目的: **キーボードだけでレシピを 1 本入力し、保存できる**こと（指示書 §7.1）を機械で固定する。
//
// ★**Gamepad と違い、キーボードは E2E で実入力できる。** M21-01〜M21-04 が E2E を持たないのは、
//   実機コントローラと user gesture を要して模擬できないためであり（M21-02 で確認済み）、
//   キーボードにその制約は無い。⇒ ここだけは実ブラウザで通せる。
//
// ★グローバル資源の扱い（**D-362**）。キー割当は localStorage にだけ入るため**ブラウザ
//   コンテキストごとに独立**しており、他 spec と奪い合わない。
//   **★ただし「保存できる」ケースだけは共有 DB にコンボを 1 件作る。** 後始末で削除するが、
//   **後始末があること ≠ 触っていないこと**である（D-362 は「作る側だけでなく消す側も
//   資源を触る」と明記している）。⇒ 本 spec は**コンボ件数に依存しない形**にしてあり、
//   作ったものは spec 内で必ず削除する。**件数に依存するテストを本ファイルへ足さないこと。**
//
// 前提: ウィザード完了済みのローカル開発環境（未完了だと /wizard へリダイレクト）。ryu が既定キャラ。
// DB 前提: 保存を伴うケースは**作成したコンボを spec 内で削除する**ため、既存件数に依存せず残渣も残さない。

const STORAGE_KEY = "keyboard-bindings-v1";

// ★保存キーの形は `web/CLAUDE.md` §1 の #9 と対。code が同一性、label は表示専用。
const BINDINGS = {
  version: 1,
  moves: {
    light_punch: { code: "KeyU", label: "U" },
    medium_punch: { code: "Space", label: "Space" },
    heavy_punch: { code: "KeyO", label: "O" },
    light_kick: { code: "KeyJ", label: "J" },
    medium_kick: { code: "KeyK", label: "K" },
    heavy_kick: { code: "KeyL", label: "L" },
    // ★方向は矢印キーにも割り当てる（スクロール抑止の回帰テスト用）。
    up: { code: "ArrowUp", label: "↑" },
    down: { code: "ArrowDown", label: "↓" },
    left: { code: "ArrowLeft", label: "←" },
    right: { code: "ArrowRight", label: "→" },
  },
  actions: {
    delete: { code: "Backspace", label: "Backspace" },
    save: { code: "KeyP", label: "P" },
    modifier: { code: "KeyM", label: "M" },
  },
};

// ★判定窓（90ms）より確実に長く空ける。窓の内側で続けて押すと 1 ステップにまとまる。
const AFTER_WINDOW_MS = 250;

/**
 * ★レシピのステップ一覧だけを指す。
 *
 * 素の `ol > li` は使えない——**読取表示（`GamepadRecipeReadout`）も `ol > li` を描画する**ため、
 * キーボード登録済み（＝読取表示が出る状態）では両者が混ざって数を誤る。
 * M21-04 までは読取表示がパッド接続時にしか出なかったため、既存 spec では露見しなかった。
 */
function stepItems(page: import("@playwright/test").Page) {
  return page.getByTestId("recipe-step-list").locator("> li");
}

/**
 * ★キーを「押しっぱなし」にする（**OS のキーリピートを実際に発生させる**）。
 *
 * ★**`keyboard.down()` を 1 回呼んで待つだけでは足りない。** Playwright は待っている間に
 *   自動でリピートを送らないため、**keydown は 1 回しか飛ばない**。それでは
 *   「押し始めの 1 回だけ抑止されていた」という今回の不具合を**素通ししてしまう**
 *   （実際に、この形で書いた初版は不具合を復元しても緑のままだった）。
 * ★Playwright は **`down()` を繰り返し呼ぶと 2 回目以降に `repeat: true` を立てる**。
 *   ⇒ それを使って OS のリピートを再現する。
 */
async function holdWithRepeat(
  page: import("@playwright/test").Page,
  key: string,
  repeats = 8,
) {
  await page.keyboard.down(key);
  for (let i = 0; i < repeats; i += 1) {
    await page.keyboard.down(key); // ★2 回目以降は repeat: true
  }
  await page.keyboard.up(key);
}

async function seedBindings(page: import("@playwright/test").Page) {
  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key as string, value as string);
    },
    [STORAGE_KEY, JSON.stringify(BINDINGS)] as const,
  );
}

test.describe("M21-05 キーボード入力", () => {
  // ★§4.1-3。**開発者の手元では通らない経路である**（登録済みの状態で確認するため）。
  test("未登録では「登録すると使えます」と出る（エラーではなく状態）", async ({
    page,
  }) => {
    await page.goto("/combos/new");
    await openRecipeTab(page);

    const status = page.getByTestId("recipe-keyboard-status").first();
    await expect(status).toBeVisible();
    await expect(status).toHaveAttribute("data-state", "unregistered");
    // 登録導線が同じ場所にある。
    await expect(
      page.getByTestId("recipe-keyboard-configure").first(),
    ).toBeVisible();
  });

  test("登録ダイアログで除外キーが理由つきで拒否される", async ({ page }) => {
    await page.goto("/combos/new");
    await openRecipeTab(page);
    await page.getByTestId("recipe-keyboard-configure").first().click();

    const dialog = page.getByTestId("recipe-keyboard-dialog");
    await expect(dialog).toBeVisible();
    // 最初の対象は「上」。
    await expect(page.getByTestId("recipe-keyboard-step-up")).toBeVisible();

    // ★ファンクションキーは登録できない。**無反応にしない**（§4.3-2）。
    await page.keyboard.press("F5");
    const excluded = page.getByTestId("recipe-keyboard-excluded");
    await expect(excluded).toBeVisible();
    await expect(excluded).toContainText("登録できません");
    // 進んでいない＝同じ対象を待ち続ける。
    await expect(page.getByTestId("recipe-keyboard-step-up")).toBeVisible();

    // ★「除外」と「未登録」は別の表示である（§4.3-3）。
    await expect(
      page.getByTestId("recipe-keyboard-assigned-up"),
    ).toHaveAttribute("data-state", "unassigned");

    // 通常のキーなら登録できる。
    await page.keyboard.press("w");
    await expect(page.getByTestId("recipe-keyboard-excluded")).toHaveCount(0);
    await expect(page.getByTestId("recipe-keyboard-assigned-up")).toHaveText("W");
    await expect(page.getByTestId("recipe-keyboard-step-down")).toBeVisible();
  });

  test("キーボードだけでレシピを 1 本入力して保存できる", async ({ page }) => {
    await seedBindings(page);
    await gotoNewComboRecipeFor(page, "ryu");

    const status = page.getByTestId("recipe-keyboard-status").first();
    await expect(status).toHaveAttribute("data-state", "ready");

    // ★★M29-01: 文言ではなく data-testid で掴む(M27-03 教訓 7)。着手前は
    //   本行が空状態の文面そのものを主張しており、語を直すと赤くなっていた。
    const emptyMsg = page.getByTestId("combo-recipe-steps-empty");
    await expect(emptyMsg).toBeVisible();

    // ★入力面を受け手にする（最後に触った面が受け手＝DES-005 §6.4.3 項目 4）。
    await page.getByTestId("recipe-tab-normal").click();

    // 弱パンチ（立ち）。
    await page.keyboard.press("u");
    await page.waitForTimeout(AFTER_WINDOW_MS);
    await expect(stepItems(page)).toHaveCount(1);

    // しゃがみ中キック（下を押しながら中キック）。★方向は矢印キーに割り当ててある。
    await page.keyboard.down("ArrowDown");
    await page.keyboard.press("k");
    await page.waitForTimeout(AFTER_WINDOW_MS);
    await page.keyboard.up("ArrowDown");
    await expect(stepItems(page)).toHaveCount(2);

    // ★削除キー（前置き不要の直接割当＝§4.2-1）で最後のステップが消える。
    await page.keyboard.press("Backspace");
    await expect(stepItems(page)).toHaveCount(1);

    // もう 1 本足してから保存する。
    await page.keyboard.press("o");
    await page.waitForTimeout(AFTER_WINDOW_MS);
    await expect(stepItems(page)).toHaveCount(2);

    // ★★M27-02b(VAL-C15): 本登録の必須欄を埋める。埋めないと保存が通らない。
    //   ★★本 spec の主題は「レシピ入力と保存がキーボードだけで完結すること」であり、
    //     必須欄の入力方法はその主題ではない。⇒ 補助として fill で埋め、
    //     **保存そのものは従来どおり保存キーで起こす**(下記)。
    await fillRequiredComboFields(page);
    await openRecipeTab(page);

    // ★保存キーで保存する（キーボードだけで完結する＝§7.1）。
    // M24-01 §4.4: 保存後は一覧へ戻るようになった。後始末で削除するため詳細を開き直す。
    // ★M21-05 当時ここには明示の { timeout: 15000 } が積んであった（既定 5s では
    //   物理入力経由の保存が間に合わないことがあったため）。いまは待ちを
    //   waitForResponse が担うため明示の延長は落としてあるが、**将来ここが flaky に
    //   なったら真っ先に疑う場所**である。
    await saveNewComboAndOpenDetail(page, () => page.keyboard.press("p"));

    // ── 後始末 ──────────────────────────────────────────────────────────
    // ★作成したコンボを消す。**本 spec は E2E の共有 DB に残渣を残さない**
    //   （`m15-03` 等が「作成データを残さない」運用であり、件数に依存する spec を壊さないため）。
    await page.getByRole("button", { name: "削除" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "削除" }).click();
    await expect(page).toHaveURL(/\/combos(\?character_id=\d+)?$/);
  });

  // ★§4.4。**落とすと利用者は原因を言語化できない**——文字を打つたびにステップが入り、
  //   しかも文字は正しく入る。
  test("テキスト入力欄にフォーカスがある間は技入力も操作も発火しない", async ({
    page,
  }) => {
    await seedBindings(page);
    await gotoNewComboRecipeFor(page, "ryu");

    // 先に 1 ステップ入れておく（削除キーが効かないことを見るため）。
    await page.getByTestId("recipe-tab-normal").click();
    await page.keyboard.press("u");
    await page.waitForTimeout(AFTER_WINDOW_MS);
    await expect(stepItems(page)).toHaveCount(1);

    // ★★M24-12: メモ欄は基本情報タブにある(レシピは別タブ)。⇒ タブを切り替える。
    //   ★これは検証内容を緩めたのではなく、実際の利用状況に近づいたものである——
    //     利用者がメモを打っているときは基本情報タブに居る。
    //   ★以降の `stepItems(page)` はレシピタブ側にあり画面上は隠れているが、
    //     `toHaveCount` は可視性を要求しない。見たいのは「ステップが増えていないこと」
    //     という DOM の状態であって、見えているかどうかではない。
    await switchEditorTab(page, "basic");

    // メモ欄へフォーカスして、技キー・操作キーを含む文字列を打つ。
    const memo = page.getByTestId("combo-editor-memo");
    await memo.click();
    await memo.fill("");
    await memo.type("uok");

    // ★ステップは 1 本のまま増えない。
    await expect(stepItems(page)).toHaveCount(1);
    await expect(memo).toHaveValue("uok");

    // ★操作キー（削除）も発火しない。
    await page.keyboard.press("Backspace");
    await expect(stepItems(page)).toHaveCount(1);
    await expect(memo).toHaveValue("uo");
  });

  // ★★2026-08-14・開発者の実機確認で発覚した不具合の回帰テスト。
  //
  //   **症状**: 矢印キーを方向に割り当てると、ブラウザがスクロールしてしまう。
  //   **原因**: `preventDefault()` がリピート判定より後ろにあり、**押し始めの 1 回しか
  //             既定動作を抑止していなかった**。方向入力は押しっぱなしが普通であるため、
  //             実質ほぼ毎回スクロールした。
  //
  //   ★**実際にスクロールしないことを確かめられるのは実ブラウザだけである。** 単体テストは
  //     `defaultPrevented` までしか見られない。⇒ 本ケースが本命の回帰テストである。
  test("★割り当てたキーを押しっぱなしにしてもページがスクロールしない", async ({
    page,
  }) => {
    await seedBindings(page);
    await gotoNewComboRecipeFor(page, "ryu");
    await page.getByTestId("recipe-tab-normal").click();

    const scrollY = () => page.evaluate(() => window.scrollY);

    // ★**途中までスクロールさせてから測る。** 先頭（`scrollY === 0`）で ↑ を押しても
    //   そもそも上へは動けないため、**先頭を起点にすると ↑ の検証が空振りになる**。
    //   ⇒ 上下どちらへも動ける位置を起点にする。
    const START = 300;
    await page.evaluate((y) => window.scrollTo(0, y), START);
    expect(await scrollY()).toBe(START);

    // ★方向キーを押しっぱなしにする——リピートが素通りしてスクロールしていた経路そのもの。
    for (const key of ["ArrowUp", "ArrowDown", "Space"]) {
      await holdWithRepeat(page, key);
      expect(await scrollY()).toBe(START);
    }

    // ★左右も（横スクロールは起きないが、既定動作を止めていることの確認）。
    for (const key of ["ArrowLeft", "ArrowRight"]) {
      await page.keyboard.press(key);
    }
    expect(await scrollY()).toBe(START);
  });

  // ★★対照実験。**同じキー・同じ画面で、割り当てていないときは従来どおりスクロールする。**
  //   これが無いと「実は全キーの既定動作を殺しているだけ」でも上のテストは緑になる。
  //   ⇒ 抑止が**利用者の割当に紐づいている**ことまで主張する。
  test("★対照: 割り当てていなければ矢印キーは従来どおりスクロールする", async ({
    page,
  }) => {
    // ★seedBindings を呼ばない（＝未登録の状態）。
    await gotoNewComboRecipeFor(page, "ryu");
    await expect(
      page.getByTestId("recipe-keyboard-status").first(),
    ).toHaveAttribute("data-state", "unregistered");

    const scrollY = () => page.evaluate(() => window.scrollY);
    expect(await scrollY()).toBe(0);

    await holdWithRepeat(page, "ArrowDown");
    await page.waitForTimeout(200);

    // ★未登録なら抑止の対象外であり、ブラウザ既定のスクロールが起きる。
    expect(await scrollY()).toBeGreaterThan(0);
  });

  // ★Space が登録可能になったこと（2026-08-14 開発者要求）。
  test("Space を技に割り当てて入力できる", async ({ page }) => {
    await seedBindings(page);
    await gotoNewComboRecipeFor(page, "ryu");
    await page.getByTestId("recipe-tab-normal").click();

    // Space = 中パンチ（BINDINGS 参照）。表示は内部表記（立ち中P）。
    await page.keyboard.press("Space");
    await page.waitForTimeout(AFTER_WINDOW_MS);
    await expect(stepItems(page)).toHaveCount(1);
    await expect(stepItems(page).first()).toContainText("立ち中P");
  });
});

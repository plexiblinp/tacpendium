import { test, expect } from "@playwright/test";

import { gotoNewComboRecipeFor } from "./support/editor-input";

// M21-06: コマンド技入力モード（必殺技の方向連続入力）の E2E スモーク。
//
// 目的: **物理入力だけで必殺技を 1 つ入力し、レシピへ入れられる**こと（指示書 §7.1）を
//       実ブラウザで固定する。
//
// ★**Gamepad は E2E で実入力できない**（実機と user gesture を要する）。キーボードは
//   その制約が無いため、モードの検証はキーボード経路で行う。★モードそのものは合流層に
//   乗っており、供給元によらず同じ状態機械を通る（単体テストで両方から入れることを固定済み）。
//
// ★**対照実験を必ず添える**（**D-375**）——「モード中はステップが増えない」だけを見ると、
//   **モードに入れていなくても緑になる**。⇒ 同じ画面・同じ入力で「モードでなければ
//   ステップが増える」ことまで主張する。
//
// ★グローバル資源（**D-362** ／ followup `e2e-shared-global-resource-parallel`）——
//   本 spec は**コンボを 1 件も作らない**（保存しない）。キー割当は localStorage にだけ入るため
//   ブラウザコンテキストごとに独立しており、他 spec と奪い合わない。
//   **★件数に依存するテスト・コンボを作るテストを本ファイルへ足さないこと。**
//
// 前提: ウィザード完了済みのローカル開発環境。ryu が既定キャラ（236LP＝波動拳が索引に載っている）。

const STORAGE_KEY = "keyboard-bindings-v1";

// ★保存キーの形は `web/CLAUDE.md` §1 の #9 と対。★M21-06 で actions が 4 件になった。
const BINDINGS = {
  version: 1,
  moves: {
    light_punch: { code: "KeyU", label: "U" },
    medium_punch: { code: "KeyI", label: "I" },
    heavy_punch: { code: "KeyO", label: "O" },
    light_kick: { code: "KeyJ", label: "J" },
    medium_kick: { code: "KeyK", label: "K" },
    heavy_kick: { code: "KeyL", label: "L" },
    up: { code: "ArrowUp", label: "↑" },
    down: { code: "ArrowDown", label: "↓" },
    left: { code: "ArrowLeft", label: "←" },
    right: { code: "ArrowRight", label: "→" },
  },
  actions: {
    delete: { code: "Backspace", label: "Backspace" },
    save: { code: "KeyP", label: "P" },
    modifier: { code: "KeyM", label: "M" },
    // ★M21-06 で加わった 4 つ目の操作。
    command_mode: { code: "KeyC", label: "C" },
  },
};

// ★判定窓（90ms）より確実に長く空ける。
const AFTER_WINDOW_MS = 250;

/** ★レシピのステップ一覧だけを指す（読取表示も `ol > li` を描画するため）。 */
function stepItems(page: import("@playwright/test").Page) {
  return page.getByTestId("recipe-step-list").locator("> li");
}

function commandPane(page: import("@playwright/test").Page) {
  return page.getByTestId("recipe-gamepad-readout-command").first();
}

async function seedBindings(page: import("@playwright/test").Page) {
  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key as string, value as string);
    },
    [STORAGE_KEY, JSON.stringify(BINDINGS)] as const,
  );
}

/**
 * 方向列を実際のレバー操作として流す（★中間の方向が紛れ込まないように差分だけ動かす）。
 *
 * ★素朴に「各方向を押して離す」と、3（下前）を出す途中で 2 が観測されて列が汚れる。
 *   ⇒ 離してから押す順で差分だけを動かす。中立は列に溜まらない。
 */
const DIR_KEYS: Record<string, readonly string[]> = {
  "1": ["ArrowDown", "ArrowLeft"],
  "2": ["ArrowDown"],
  "3": ["ArrowDown", "ArrowRight"],
  "4": ["ArrowLeft"],
  "6": ["ArrowRight"],
  "8": ["ArrowUp"],
};

async function roll(
  page: import("@playwright/test").Page,
  sequence: string,
  pauseMs = 0,
) {
  let held: readonly string[] = [];
  for (const digit of sequence) {
    const next = DIR_KEYS[digit];
    for (const key of held) if (!next.includes(key)) await page.keyboard.up(key);
    for (const key of next)
      if (!held.includes(key)) await page.keyboard.down(key);
    held = next;
    if (pauseMs > 0) await page.waitForTimeout(pauseMs);
  }
  for (const key of held) await page.keyboard.up(key);
}

test.describe("M21-06 コマンド技入力モード", () => {
  test("★モードでなければ方向 ＋ ボタンでステップが増える（対照実験）", async ({
    page,
  }) => {
    await seedBindings(page);
    await gotoNewComboRecipeFor(page, "ryu");
    await page.getByTestId("recipe-tab-normal").click();

    // ★モードに入らずに 236 と同じ方向を振り、弱P を押す。
    //   通常経路では方向はステップにならず、ボタンで 1 ステップ確定する。
    await page.keyboard.down("ArrowDown");
    await page.keyboard.press("u");
    await page.waitForTimeout(AFTER_WINDOW_MS);
    await page.keyboard.up("ArrowDown");

    await expect(stepItems(page)).toHaveCount(1);
  });

  test("★モード中は確定ボタンが通常のステップを生まない（同じ入力で 1 本だけ）", async ({
    page,
  }) => {
    await seedBindings(page);
    await gotoNewComboRecipeFor(page, "ryu");
    await page.getByTestId("recipe-tab-normal").click();

    // モードへ入る。
    await page.keyboard.press("c");
    await expect(commandPane(page)).toContainText("入力中");

    // 236 を振ってから弱P。
    await roll(page, "236");
    await page.keyboard.press("u");
    await page.waitForTimeout(AFTER_WINDOW_MS);

    // ★モードで解決した 1 本だけ。判定層由来の 2 本目が混ざっていない。
    await expect(stepItems(page)).toHaveCount(1);
    await expect(stepItems(page).first()).toContainText("波動拳");
  });

  test("★非常にゆっくり入力しても解決する（モードは時間で切れない）", async ({
    page,
  }) => {
    await seedBindings(page);
    await gotoNewComboRecipeFor(page, "ryu");
    await page.getByTestId("recipe-tab-normal").click();

    await page.keyboard.press("c");
    await expect(commandPane(page)).toContainText("入力中");

    // ★判定窓（90ms）はもちろん、前置きの 2 秒タイムアウトも超える間隔を空ける。
    //   実装が時間で切る形なら、ここで列が捨てられて解決しなくなる。
    await roll(page, "236", 2500);
    await page.keyboard.press("u");
    await page.waitForTimeout(AFTER_WINDOW_MS);

    await expect(stepItems(page)).toHaveCount(1);
    await expect(stepItems(page).first()).toContainText("波動拳");
  });

  test("溜まっている列が画面に出る（§4.1-6）", async ({ page }) => {
    await seedBindings(page);
    await gotoNewComboRecipeFor(page, "ryu");
    await page.getByTestId("recipe-tab-normal").click();

    await page.keyboard.press("c");
    await roll(page, "236");

    await expect(
      page.getByTestId("recipe-gamepad-readout-command-directions").first(),
    ).toHaveText("236");
    // ★方向を振ってもステップは増えていない。
    await expect(stepItems(page)).toHaveCount(0);
  });

  test("★モードを抜けると溜めた列が黙って消えず、通常入力へ戻る（§4.1-7 / §4.1-8）", async ({
    page,
  }) => {
    await seedBindings(page);
    await gotoNewComboRecipeFor(page, "ryu");
    await page.getByTestId("recipe-tab-normal").click();

    await page.keyboard.press("c");
    await roll(page, "236");
    // 抜ける（同じ操作でトグル）。
    await page.keyboard.press("c");

    // ★捨てた列が読取表示に残る（E-84）。
    await expect(commandPane(page)).toContainText("236");
    await expect(commandPane(page)).toContainText(
      "モードを抜けたため確定していません",
    );

    // ★抜けたあとは方向 1 つ ＝ ステップ 1 つに戻る。
    await page.keyboard.down("ArrowDown");
    await page.keyboard.press("u");
    await page.waitForTimeout(AFTER_WINDOW_MS);
    await page.keyboard.up("ArrowDown");
    await expect(stepItems(page)).toHaveCount(1);
  });

  test("解決できなかった入力が理由つきで出る（§4.2-7）", async ({ page }) => {
    await seedBindings(page);
    await gotoNewComboRecipeFor(page, "ryu");
    await page.getByTestId("recipe-tab-normal").click();

    await page.keyboard.press("c");
    // ★先頭にゴミ（4 から始める）。4 で始まるコマンドが無い ⇒ 補正せず解決しない。
    await roll(page, "4236");
    await page.keyboard.press("u");
    await page.waitForTimeout(AFTER_WINDOW_MS);

    await expect(stepItems(page)).toHaveCount(0);
    await expect(commandPane(page)).toContainText(
      "この方向の並びに一致するコマンドがありません",
    );
  });

  // ★§6.5.1 (3)。M21-06 は方向キーを更に多用するため、モード中も抑止が効いていることを見る。
  test("★モード中も割り当てたキーの既定動作が抑止される", async ({ page }) => {
    await seedBindings(page);
    await gotoNewComboRecipeFor(page, "ryu");
    await page.getByTestId("recipe-tab-normal").click();

    await page.keyboard.press("c");
    await expect(commandPane(page)).toContainText("入力中");

    const scrollY = () => page.evaluate(() => window.scrollY);
    const START = 300;
    await page.evaluate((y) => window.scrollTo(0, y), START);
    expect(await scrollY()).toBe(START);

    // ★押しっぱなし（リピート）でもスクロールしない。
    for (const key of ["ArrowUp", "ArrowDown"]) {
      await page.keyboard.down(key);
      for (let i = 0; i < 8; i += 1) await page.keyboard.down(key);
      await page.keyboard.up(key);
      expect(await scrollY()).toBe(START);
    }
  });
});

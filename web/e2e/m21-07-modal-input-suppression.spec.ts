import { test, expect } from "@playwright/test";

import { gotoNewComboRecipeFor } from "./support/editor-input";

// M21-07: モーダル表示中の物理入力の遮断（指示書 §5.2 の A / B / C）。
//
// 目的: **修飾情報の編集ダイアログを表示中に物理入力を行っても、モーダルの裏でレシピに
//   ステップが入らない**ことを実ブラウザで固定する（欠陥 = ボード **D-383**）。
//
// ★**A（抑止）と B（対照）は 1 組である。** A だけを見ると、全部を抑止していても緑になる
//   （**D-375** ／ `SUPP-001` §5.5 (10′)）。⇒ 同じ画面・同じキーで「ダイアログを開かなければ
//   従来どおり入る」ことまで主張する。
//
// ★**ダイアログ内の「ボタン」にフォーカスを当てて押す。** メモ欄にフォーカスがあると
//   `DES-005` §6.5.1 (1) の編集可能ガードが先に効き、**本サブの軸を外しても緑になる**
//   （報告された非対称そのもの＝キーボードは裏へ流れないがコントローラは流れる）。
//
// ★グローバル資源の扱い（**D-362**）。**本 spec は DB を 1 行も触らない**——コンボを保存せず、
//   `/combos/new` 上の未保存の編集状態だけで完結する。キー割当は localStorage であり
//   ブラウザコンテキストごとに独立している。⇒ 他 spec と資源を奪い合わない。
//   **保存を伴うケースを本ファイルへ足さないこと。**
//
// 前提: ウィザード完了済みのローカル開発環境（未完了だと /wizard へリダイレクト）。ryu が既定キャラ。

const STORAGE_KEY = "keyboard-bindings-v1";

const BINDINGS = {
  version: 1,
  moves: {
    light_punch: { code: "KeyU", label: "U" },
    medium_punch: { code: "KeyI", label: "I" },
    heavy_punch: { code: "KeyO", label: "O" },
    light_kick: { code: "KeyJ", label: "J" },
    medium_kick: { code: "KeyK", label: "K" },
    heavy_kick: { code: "KeyL", label: "L" },
    up: { code: "KeyW", label: "W" },
    down: { code: "KeyS", label: "S" },
    left: { code: "KeyA", label: "A" },
    right: { code: "KeyD", label: "D" },
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
 * 素の `ol > li` は使えない——**読取表示も `ol > li` を描画する**ため、キーボード登録済み
 * （＝読取表示が出る状態）では両者が混ざって数を誤る（`m21-05` の実測）。
 */
function stepItems(page: import("@playwright/test").Page) {
  return page.getByTestId("recipe-step-list").locator("> li");
}

/**
 * ★キーを「押しっぱなし」にする（**OS のキーリピートを実際に発生させる**）。
 *
 * ★**`keyboard.down()` を 1 回呼んで待つだけでは足りない。** Playwright は待っている間に
 *   自動でリピートを送らないため keydown は 1 回しか飛ばず、**押し始めの 1 回だけを扱う
 *   実装を素通りさせる**（`m21-05` の実測）。⇒ `down()` を繰り返し呼んで `repeat: true` を立てる。
 * ★**解放は呼び出し側が行う。** 本関数の中で離すと、C が見たい「開いている間ずっと押している」
 *   状態を作れない。
 */
async function holdWithRepeat(
  page: import("@playwright/test").Page,
  key: string,
  repeats = 8,
) {
  await page.keyboard.down(key);
  for (let i = 0; i < repeats; i += 1) {
    await page.keyboard.down(key);
  }
}

async function seedBindings(page: import("@playwright/test").Page) {
  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key as string, value as string);
    },
    [STORAGE_KEY, JSON.stringify(BINDINGS)] as const,
  );
}

/** レシピ入力面を受け手にし、弱P を 1 本入れた状態まで進める。 */
async function openEditorWithOneStep(page: import("@playwright/test").Page) {
  await seedBindings(page);
  await gotoNewComboRecipeFor(page, "ryu");

  // ★入力面を受け手にする（最後に触った面が受け手＝`DES-005` §6.4.3 項目 4）。
  await page.getByTestId("recipe-tab-normal").click();

  await page.keyboard.press("u");
  await page.waitForTimeout(AFTER_WINDOW_MS);
  await expect(stepItems(page)).toHaveCount(1);
}

/** 先頭ステップの「編集」から修飾情報の編集ダイアログを開き、内側のボタンへフォーカスを移す。 */
async function openModifiersDialog(page: import("@playwright/test").Page) {
  await stepItems(page).first().getByRole("button", { name: "編集" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  // ★メモ欄ではなくボタンへフォーカスする（編集可能ガードを先に効かせない）。
  await dialog.getByRole("button", { name: "キャンセル" }).focus();
  return dialog;
}

test.describe("M21-07 モーダル表示中の物理入力の遮断", () => {
  // ── A: モーダルの裏でステップが入らない ────────────────────────────────
  test("A: 修飾情報の編集ダイアログを開いている間、技キーを押してもステップが増えない", async ({
    page,
  }) => {
    await openEditorWithOneStep(page);
    const dialog = await openModifiersDialog(page);

    await page.keyboard.press("o");
    await page.waitForTimeout(AFTER_WINDOW_MS);

    await expect(stepItems(page)).toHaveCount(1);

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(stepItems(page)).toHaveCount(1);
  });

  // ── B: 対照 — ダイアログを開かなければ従来どおり入る ───────────────────
  test("B: 対照 — 同じ画面・同じキーで、ダイアログを開かずに押すとステップが増える", async ({
    page,
  }) => {
    await openEditorWithOneStep(page);

    await page.keyboard.press("o");
    await page.waitForTimeout(AFTER_WINDOW_MS);

    await expect(stepItems(page)).toHaveCount(2);
  });

  // ── C: 閉じたあとに押しっぱなしが残らない ──────────────────────────────
  test("C: 押しっぱなしのままダイアログを閉じて離しても、ステップが増えず後続の入力が効く", async ({
    page,
  }) => {
    await openEditorWithOneStep(page);
    const dialog = await openModifiersDialog(page);

    await holdWithRepeat(page, "KeyO");
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await page.keyboard.up("KeyO");
    await page.waitForTimeout(AFTER_WINDOW_MS);

    await expect(stepItems(page)).toHaveCount(1);

    // ★その後の通常入力が正しく効く（観測まで止めていると、ここで「押されたまま」が残る）。
    await page.keyboard.press("o");
    await page.waitForTimeout(AFTER_WINDOW_MS);
    await expect(stepItems(page)).toHaveCount(2);
  });

  // ── ★操作も起きない（§4.4-4。A は技ステップしか見ていない）─────────────
  test("★ダイアログを開いている間は操作キー（削除）も効かない（対照つき）", async ({
    page,
  }) => {
    await openEditorWithOneStep(page);
    const dialog = await openModifiersDialog(page);

    await page.keyboard.press("Backspace");
    await expect(stepItems(page)).toHaveCount(1);

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);

    // 対照: 閉じれば従来どおり削除できる。
    await page.keyboard.press("Backspace");
    await expect(stepItems(page)).toHaveCount(0);
  });
});

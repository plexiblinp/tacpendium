import { test, expect } from "@playwright/test";
import { createTags, deleteTags } from "./support/tags";
import {
  gotoNewComboRecipeFor,
  addRecipeStep,
  selectableMoveIds,
  fillRequiredComboFields,
  openRecipeTab,
  switchEditorTab,
} from "./support/editor-input";
import { characterIdOf } from "./support/character";

// M27-02a: 届かないものを届かせる。束 B(候補選択の操作)の回帰固定。
//
// ★★本 spec は「今直したこと」だけでなく「調べた結果 直っていたこと」も固定する。
//   SD-016 は 6 通りのジェスチャで再現せず、開発者裁定で対応不要になった
//   (逐語の操作＝検索用に手入力したキャラ名をマウスでドラッグ選択する、は
//    そもそも要らない操作だと開発者が判断した)。★それでも閉じる条件は Radix
//   DismissableLayer の pointerdown 判定に全面的に依存している(自前の外側クリック
//   判定も blur ハンドラも 0 件)。⇒ 実装を差し替えたときに黙って再発しうるため固定する。

const STAMP = "M27E2E";
// ★束 A のテストで使うキャラ。利用の少ないものを選ぶ(重複判定を避けるため。下記参照)。
const CODE = "c_viper";

test.describe("M27-02a 束 B: 候補選択に操作が届く", () => {
  test("タグ欄: ↓ で候補へ入り Enter で選べ、複数選択なので開いたまま続けられる", async ({
    page,
    request,
  }) => {
    const tags = await createTags(request, [
      `${STAMP}-alpha`,
      `${STAMP}-beta`,
      `${STAMP}-gamma`,
    ]);
    try {
      await page.goto("/combos/new");
      await page
        .getByRole("button", { name: /タグを選択、または、新規登録/ })
        .click();

      // ★着手前はここに listbox / option が 1 つも無く、選択が Tab 送りだった。
      await expect(page.getByRole("listbox")).toBeVisible();
      await page.getByPlaceholder(/タグを検索/).fill(STAMP);
      await expect(page.getByRole("option")).toHaveCount(tags.length + 1); // +1 は「新規登録」行

      // 検索欄からの ↓ で先頭候補へ入る。
      await page.keyboard.press("ArrowDown");
      await expect(page.getByRole("option").first()).toBeFocused();
      await page.keyboard.press("ArrowDown");
      await expect(page.getByRole("option").nth(1)).toBeFocused();

      await page.keyboard.press("Enter");
      await expect(
        page.locator('[role="option"][aria-selected="true"]'),
      ).toHaveCount(1);

      // ★★複数選択なので閉じない(M27-02a §2.2.4-3 の決定)。
      await expect(page.getByRole("listbox")).toBeVisible();
      // ★候補選択の Enter が保存の Enter を兼ねていないこと(§2.2.2-3)。
      await expect(page).toHaveURL(/\/combos\/new/);

      // 続けて 2 件目を選べる。
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
      await expect(
        page.locator('[role="option"][aria-selected="true"]'),
      ).toHaveCount(2);
    } finally {
      await deleteTags(
        request,
        tags.map((t) => t.id),
      );
    }
  });

  test("キャラ選択: 外側クリックで閉じる / 検索欄を起点にしたドラッグでは閉じない", async ({
    page,
  }) => {
    await page.goto("/combos");
    await page.getByTestId("combo-list-character-scope").click();
    const search = page.getByPlaceholder("キャラクターを検索");
    await search.fill("ダルシム");
    const box = (await search.boundingBox())!;

    // ★SD-016: テキストボックス内で押し下げ → 大きく外へドラッグ → 外で離す。
    //   閉じる判定は pointerdown で行われ、押下起点が内側なら無視される。
    await page.mouse.move(box.x + box.width - 8, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 8, box.y + box.height / 2, { steps: 8 });
    await page.mouse.move(box.x - 260, box.y + 300, { steps: 12 });
    await page.mouse.up();

    await expect(page.getByRole("listbox")).toBeVisible();
    // 検索語も失われないこと(閉じると setSearch("") で消える)。
    await expect(search).toHaveValue("ダルシム");

    // ★★閉じない部品は閉じすぎる部品より使いにくい(§2.2.3-3)。
    //   外側クリックでは必ず閉じること。
    await page.mouse.click(box.x - 260, box.y + 340);
    await expect(page.getByRole("listbox")).toHaveCount(0);
  });
});

test.describe("M27-02a 束 A: 保存が通らないときに理由へ届く", () => {
  // ★★指示書 §2.1.4「動線として通す」。3 件を直したことではなく、
  //   「保存が通らない → 理由が分かる → 直す欄へ行ける」が 1 本につながることを見る。
  //
  // ★使う経路は同梱セットプレイのレシピ未入力(VAL-S02 → field="setups[0].steps")。
  //   ★これは BE だけが持つ検証である —— FE の zod スキーマは setups を検証しない。
  //     ⇒ 「BE 検証が発火したとき応答が画面へ届くか」(§2.1.1-2 の (a) の前提)を
  //       同時に確かめる経路でもある。
  test("同梱セットプレイのエラーが、読める文言で出て、直す欄のあるタブを指す", async ({
    page,
    request,
  }) => {
    // ★★親コンボは「他の spec と重複しない」形で作らなければならない。
    //   理由＝`VAL-C02`(重複)は検証段階で走り、ERROR になると
    //   `internal/service/combo/service.go:382` の同梱セットプレイのループまで
    //   到達しない。⇒ 親が重複すると `VAL-S02` が出ず、本テストが見たいものが消える。
    //
    //   ★これは実際に起きた —— 初版は ryu ＋ 先頭技 1 ステップで書いており、
    //     **単独実行では通るのに `make e2e` の全数では落ちた**
    //     (E2E の DB は spec 間で共有され、ryu は 97 か所で使われている)。
    //
    //   ⇒ 重複判定キー(キャラ ＋ レシピ ＋ 状況 4 項)のうち、**キャラとレシピの
    //     2 つで他と離す**: 利用の少ないキャラ ＋ 末尾の技を含む 2 ステップ。
    //     他の spec はいずれも `firstMoveIdOf`(先頭技)の 1 ステップである。
    const characterId = await characterIdOf(request, CODE);
    const res = await request.get(`/api/moves?character_id=${characterId}`);
    expect(res.ok(), `技一覧の取得に失敗: ${res.status()}`).toBeTruthy();
    const moves = (await res.json()).items as Array<{ id: number }>;
    expect(moves.length, `${CODE} の技が 2 件未満`).toBeGreaterThan(1);

    await gotoNewComboRecipeFor(page, CODE);

    // ★★★「末尾の技」は **API の最後**ではなく **プルダウンが選べる最後**から採る
    //   (2026-09-12 是正)。API の最後は `drive_reversal` である ——
    //   マイグレ `000109`(`M31-04`)が全キャラへ最後に入れたため `moves.id` が最大だが、
    //   同 code は入力面から外されており(`INPUT_EXCLUDED_MOVE_CODES`)プルダウンに出ない。
    //   ⇒ `selectOption` が該当 option を見つけられず落ちていた。
    // ★本ケースが「末尾の技」を使う理由は**他 spec と重複しないレシピを作ること**であって、
    //   その技が API 一覧の最後であること自体ではない。⇒ 選べる中の最後で目的を満たす。
    const selectable = await selectableMoveIds(page);
    expect(
      selectable.length,
      `${CODE} のプルダウンに選べる技が 2 件未満`,
    ).toBeGreaterThan(1);

    await addRecipeStep(page, moves[0].id);
    await addRecipeStep(page, selectable[selectable.length - 1]);

    // ★★M27-02b(VAL-C15): 本登録の必須欄を埋める。
    //   ★埋めないと VAL-C15 が **基本情報タブ側** に立ち、下記 (2) の
    //     「基本情報タブのバッジは 0 件」が成り立たなくなる。
    //   ⇒ 本ケースが見たいのは「同梱セットプレイのエラーがレシピタブを指すこと」
    //     であり、必須欄の未入力はその主題ではない。
    await fillRequiredComboFields(page);
    await openRecipeTab(page);

    // レシピ未入力のセットプレイを 1 件足す(名前だけ入れて VAL-S02 に絞る)。
    await page.getByRole("button", { name: "+ セットプレイを追加" }).click();
    await page.getByPlaceholder("セットプレイ名").fill("レシピを入れ忘れた");

    await page.getByRole("button", { name: "保存" }).click();

    // (1) 理由が分かる —— リスト本体に出る。
    //     ★★着手前はここが「setups[0].steps: レシピは 1 ステップ以上必要です」と
    //       生のまま出ていた。日本語のラベルが付くこと。
    const errors = page.getByText("レシピは 1 ステップ以上必要です");
    await expect(errors).toBeVisible();
    await expect(page.getByText("setups[0].steps")).toHaveCount(0);
    await expect(page.getByText("セットプレイ:").first()).toBeVisible();

    // (2) 直す欄のあるタブを指す —— レシピタブのバッジに計上される。
    //     ★★着手前は「基本情報」タブのバッジに計上され、直す欄の無いタブへ誘導していた。
    await expect(page.getByTestId("combo-editor-tab-errors-recipe")).toHaveText("1");
    await expect(page.getByTestId("combo-editor-tab-errors-basic")).toHaveCount(0);

    // (3) 直す欄へ行ける —— そのタブにセットプレイ登録の節が在る。
    await switchEditorTab(page, "recipe");
    await expect(page.getByTestId("combo-editor-setup-section")).toBeVisible();
  });
});

import { test, expect } from "@playwright/test";
import { createTags, deleteTags } from "./support/tags";
import {
  DIRECTIONS,
  EDGE,
  expectSelectionSurvivesDragOut,
  popoverBox,
} from "./support/drag-selection";

// M31-02 追補: タグ欄(TagSelector)の検索欄で始めたドラッグの、文字選択の維持。
//
// ★★ファイル名に `m31-02b` を使わないこと(追補レビュー 中-5)。
//   本リポジトリの e2e spec の `mNN-NN<英字>` は**例外なく実在するサブ**を指しており
//   (M14-03b / M19-04b / M24-09a ...)、`M31-02b` というサブは存在しない。
//   ⇒ 名乗ると番号の自採番に当たる(D-293 / 指示書 §3-5)。
//   ★`m31-02-` 始まりなら `make e2e-only P=m31-02` が姉妹 spec ごと拾う。
//
// ★★開発者が実機で確認して残っていた最後の 1 件である(2026-09-08)。
//   逐語＝「唯一の取り残しとして、新規登録・編集等のタグ欄だけ問題が残っていました」。
//   ⇒ 本体サブは SearchableSelect だけを直しており、TagSelector は
//     「未実測・射程外」の申し送りになっていた。開発者の指示で射程を広げた。
//
// ★★着手前の実測(本 spec を修正前の実装に対して回した結果。★赤は 2 件):
//     左: 枠内=[0, 9] → 枠外=[9, 9]  ★消えた
//     上: 枠内=[0, 9] → 枠外=[9, 9]  ★消えた
//     右・下: 枠内=[0, 9] → 枠外=[0, 9]  維持
//   ⇒ **キャラ選択とまったく同じ形である**(あちらは [0, 4] → [4, 4])。
//
// ★TagSelector は SearchableSelect を import していない別実装だが、
//   Popover + Input + ul[role=listbox] の構造が 1:1 である。
//   ⇒ 部品は統合せず、回避だけを lib/text-drag-capture で共有した
//     (M27-02a が useListboxKeyNav でやったのと同じ形)。

const STAMP = "M31TE2E";
const TAG_TRIGGER = /タグを選択、または、新規登録/;
const TAG_SEARCH = /タグを検索/;

async function openTagField(page: import("@playwright/test").Page, word: string) {
  await page.goto("/combos/new");
  await page.getByRole("button", { name: TAG_TRIGGER }).click();
  const search = page.getByPlaceholder(TAG_SEARCH);
  await expect(search).toBeVisible();
  await search.fill(word);
  return search;
}

test.describe("M31-02 追補: タグ欄で始めたドラッグの文字選択", () => {
  for (const dir of DIRECTIONS) {
    test(`${dir.name}へ枠外までドラッグしても文字選択が消えない`, async ({
      page,
      request,
    }) => {
      const tags = await createTags(request, [`${STAMP}-alpha`, `${STAMP}-beta`]);
      try {
        const search = await openTagField(page, STAMP);
        await expectSelectionSurvivesDragOut(page, search, dir);
      } finally {
        // ★`deleteTags` は `CreatedTag[]` を取る(中で `tag.id` を読む)。
        //   id の配列を渡すと URL が `/api/tags/undefined` になり、`.catch()` に
        //   飲まれて**後片付けが黙って空振りする**。⇒ そのまま渡すこと。
        await deleteTags(request, tags);
      }
    });
  }

  // ★★破壊確認。M27-02a が確定した「タグ欄はキーボードで届く」を壊していないこと。
  //   ⇒ 本追補が触ったのは検索欄の pointerdown だけであり、キー操作の経路は
  //     useListboxKeyNav のまま不変であることを実測で示す。
  test("破壊確認: ↓ で候補へ入り Enter で選べ、複数選択なので開いたまま続けられる", async ({
    page,
    request,
  }) => {
    const tags = await createTags(request, [
      `${STAMP}-x`,
      `${STAMP}-y`,
      `${STAMP}-z`,
    ]);
    try {
      const search = await openTagField(page, STAMP);
      await expect(page.getByRole("listbox")).toBeVisible();
      // ★`getByRole("option")` を素で使わないこと —— 画面に native <select> の <option> が
      //   在ると hidden のまま当たる(姉妹 spec の pickFromPicker が初版で実際に踏んだ)。
      //   ★いま通るのはレシピ欄が display:none だからであり、外部条件に依存している。
      const options = page.getByRole("listbox").getByRole("option");
      await expect(options).toHaveCount(tags.length + 1); // +1 は「新規登録」行

      await page.keyboard.press("ArrowDown");
      await expect(options.first()).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(
        page.locator('[role="option"][aria-selected="true"]'),
      ).toHaveCount(1);

      // ★複数選択なので閉じない(M27-02a §2.2.4-3 の決定)。
      await expect(page.getByRole("listbox")).toBeVisible();
      // ★候補選択の Enter が保存の Enter を兼ねていないこと。
      await expect(page).toHaveURL(/\/combos\/new/);

      // 続けて 2 件目を選べる。
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
      await expect(
        page.locator('[role="option"][aria-selected="true"]'),
      ).toHaveCount(2);

      // ★★マウスでも従来どおり「選べる」こと(pointerdown を足した影響を見る)。
      //   ⇒ listbox が見えているだけでは足りない —— **クリックが何も起こさなくても緑になる**
      //     (M31-02 追補レビュー 中-3)。選択数が増えたことで判定する。
      await search.fill(`${STAMP}-z`);
      const remaining = page.getByRole("listbox").getByRole("option").first();
      await expect(remaining).toBeVisible();
      await remaining.click();
      await expect(
        page.locator('[role="option"][aria-selected="true"]'),
      ).toHaveCount(1); // 絞り込み後の候補は 1 件で、それが選択済みになる
      await expect(page.getByRole("listbox")).toBeVisible();
    } finally {
      await deleteTags(request, tags);
    }
  });

  // ★★popover の寿命。キャラ側の spec には在るがタグ欄には無かった(追補レビュー 中-4)。
  //   ★本追補は pointerup の配送先を変える修正であり、**その真上にある挙動である**。
  //   ⇒ 「枠外で離しても閉じない」と「外側クリックでは閉じる」を対で固定する。
  //     片方だけだと、閉じなくなった部品も閉じすぎる部品も緑になる。
  test("枠外へドラッグして離しても閉じず検索語も残る / 外側クリックでは閉じる", async ({
    page,
    request,
  }) => {
    const tags = await createTags(request, [`${STAMP}-live`]);
    try {
      const search = await openTagField(page, STAMP);
      const b = (await search.boundingBox())!;
      const pop = (await popoverBox(search))!;

      await page.mouse.move(b.x + b.width - EDGE, b.y + b.height / 2);
      await page.mouse.down();
      await page.mouse.move(pop.x - 260, pop.y + pop.height + 120, { steps: 12 });
      await page.mouse.up();

      await expect(page.getByRole("listbox")).toBeVisible();
      await expect(search).toHaveValue(STAMP);

      // ★閉じない部品は閉じすぎる部品より使いにくい。外側クリックでは必ず閉じること。
      await page.mouse.click(pop.x - 260, pop.y + pop.height + 160);
      await expect(page.getByRole("listbox")).toHaveCount(0);
    } finally {
      await deleteTags(request, tags);
    }
  });
});

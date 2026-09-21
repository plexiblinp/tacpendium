import { test, expect, type Page, type Locator } from "@playwright/test";
import { createTags, deleteTags } from "./support/tags";
import {
  DIRECTIONS,
  EDGE,
  expectSelectionSurvivesDragOut,
} from "./support/drag-selection";

// M31-02(P4M-013): キャラ選択の検索欄で始めたドラッグの、文字選択の維持。
//
// ★★測り方は web/e2e/support/drag-selection.ts へ出してある。
//   同じ欠陥がタグ欄(TagSelector)にも在り、m31-02-tag-field-drag.spec.ts が同じ道具で測る。
//   ⇒ 片方の spec だけを直して、もう片方が古い測り方のまま残る形を作らない。
//
// ★★本 spec が測る量は m27-02a-reachability.spec.ts が測っていない量である。
//   あちらの assert は「listbox が見えていること」と「検索欄の value が残ること」だけであり、
//   **文字選択(selectionStart / selectionEnd)は 1 度も見ていない。**
//   ⇒ M27-02a の「6 ジェスチャで再現せず」は別の観測対象についての真であり、本件を否定しない。
//   ★両方が要る。片方だけでは、popover が閉じないのに選択だけ消える状態を見逃す。
//
// ★開発者の逐語(2026-09-08)＝「テキストボックス上にマウスを合わせて左クリックする。
//   そのままドラッグしてポインタがテキストボックスの外に出ると、文字選択(青色になる)が消える現象だった。」
//   ⇒ 「正しい挙動」＝枠内で押下して始めたドラッグは、ポインタが枠外へ出ても文字選択が維持されること。
//
// ★★着手前の実測(本 spec を修正前の実装に対して回した結果。★赤は 2 件):
//     左: 枠内=[0, 4] → 枠外=[4, 4]  ★消えた
//     上: 枠内=[0, 4] → 枠外=[4, 4]  ★消えた
//     右・下: 枠内=[0, 4] → 枠外=[0, 4]  維持
//   ★上が赤なのは、上方向の脱出点の x を左端へ寄せているためである
//     (脱出点を横中央に置いた調査では上も維持された)。
//     ⇒ **再現条件は方向ではなく「popover の枠外へ出ること」である。**
//   ⇒ 4 方向すべてを見る。左だけを見ると、直し方が他を壊す形でも緑になる。

const WORD = "ダルシム";
const SEARCH = "キャラクターを検索";

test.describe("M31-02 P4M-013: 検索欄で始めたドラッグの文字選択", () => {
  for (const dir of DIRECTIONS) {
    test(`${dir.name}へ枠外までドラッグしても文字選択が消えない`, async ({ page }) => {
      await page.goto("/combos");
      await page.getByTestId("combo-list-character-scope").click();
      const search = page.getByPlaceholder(SEARCH);
      await expect(search).toBeVisible();
      await search.fill(WORD);

      await expectSelectionSurvivesDragOut(page, search, dir);
    });
  }

  test("M27-02a が固定した挙動を壊していない(検索欄起点のドラッグでは閉じず、検索語も残る)", async ({
    page,
  }) => {
    // ★同趣旨の assert は m27-02a-reachability.spec.ts にもある。
    //   ここへ置くのは「本サブの修正が、あちらの前提を壊していないこと」を
    //   本サブの spec 単独でも見えるようにするためである。
    await page.goto("/combos");
    await page.getByTestId("combo-list-character-scope").click();
    const search = page.getByPlaceholder(SEARCH);
    await search.fill(WORD);
    const b = (await search.boundingBox())!;

    await page.mouse.move(b.x + b.width - EDGE, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x - 260, b.y + 300, { steps: 12 });
    await page.mouse.up();

    await expect(page.getByRole("listbox")).toBeVisible();
    await expect(search).toHaveValue(WORD);

    // 外側クリックでは必ず閉じること(閉じない部品は閉じすぎる部品より使いにくい)。
    await page.mouse.click(b.x - 260, b.y + 340);
    await expect(page.getByRole("listbox")).toHaveCount(0);
  });
});

// ★★破壊確認。区分は「画面名」ではなく **呼び出しの形** で割る
//   (SUPP-001 §5.5.4 (10) / 計測点 M-139。守られている区分ばかりを試すと
//    「機構は生きている」の証拠にできてしまう)。
//
//   区分と、その区分を立てた理由:
//     1. pick モード(placeholder あり・未選択を許す) —— disabled の分岐が別
//     2. 通常モード(選択済み前提)                   —— 上の裏
//     3. 1 画面に 2 コントロール                     —— 相互干渉が起きうる唯一の形
//     4. モーダル内                                  —— popover が入れ子になる
//     5. CharacterSelector を経由しない直接利用      —— ★キャラ 14 の外。
//        SearchableSelect を直すと波及先は 17 コントロールであり、キャラだけではない。
async function pickFromPicker(page: Page, trigger: Locator, word: string) {
  await trigger.click();
  const search = page.getByPlaceholder(SEARCH);
  await expect(search).toBeVisible();
  await search.fill(word);
  // ★`getByRole("option")` を素で使わないこと —— コンボ一覧には native <select> の
  //   <option> が在り、hidden のまま先頭に当たる(初版で実際に踏んだ)。
  const option = page.getByRole("listbox").getByRole("option").first();
  await expect(option).toBeVisible();
  const label = (await option.textContent())!.trim();
  await option.click();
  await expect(page.getByRole("listbox")).toHaveCount(0);
  return label;
}

test.describe("M31-02 破壊確認: 区分から 1 件ずつ", () => {
  test("区分1 pick モード(技マスタ編集 / DES-005 §5.18)", async ({ page }) => {
    await page.goto("/moves/edit");
    const trigger = page.getByRole("combobox", { name: "キャラクター選択" });
    const label = await pickFromPicker(page, trigger, WORD);
    await expect(trigger).toContainText(label);
  });

  test("区分2 通常モード(コンボ一覧 / DES-005 §5.4)", async ({ page }) => {
    await page.goto("/combos");
    const trigger = page.getByTestId("combo-list-character-scope");
    const label = await pickFromPicker(page, trigger, WORD);
    await expect(trigger).toContainText(label);
  });

  test("区分3 1 画面に 2 コントロール(確定反撃サーチ / DES-005 §5.20)", async ({ page }) => {
    await page.goto("/punish/search");
    const self = page.getByRole("combobox", { name: "自キャラ" });
    const opp = page.getByRole("combobox", { name: "相手キャラ" });

    const selfLabel = await pickFromPicker(page, self, WORD);
    await expect(self).toContainText(selfLabel);

    // ★相手側を選んでも自キャラ側が巻き添えにならないこと(2 コントロールを立てた理由)。
    const oppLabel = await pickFromPicker(page, opp, "リュウ");
    await expect(opp).toContainText(oppLabel);
    await expect(self).toContainText(selfLabel);
  });

  test("区分4 モーダル内(比較の追加ダイアログ / DES-005 §5.8)", async ({ page }) => {
    await page.goto("/compare");
    await page.getByRole("button", { name: "コンボを追加" }).first().click();
    const trigger = page.getByRole("dialog").getByRole("combobox").first();
    const label = await pickFromPicker(page, trigger, WORD);
    await expect(trigger).toContainText(label);
    // ★モーダルは開いたまま(popover を閉じただけでダイアログまで閉じない)。
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("区分5 CharacterSelector を経由しない直接利用(コンボ一覧のタグフィルタ / mode=multi)", async ({
    page,
    request,
  }) => {
    // ★タグ欄は `availableTags.length > 0` が条件であり、タグが 0 件だと**描画されない**。
    //   ⇒ 作ってから開く(初版は素で開こうとして要素が見つからなかった)。
    const tags = await createTags(request, ["M31E2E-alpha", "M31E2E-beta"]);
    try {
      await page.goto("/combos");
      const trigger = page.getByTestId("combo-list-tag-filter");
      await expect(trigger).toBeVisible();
      await trigger.click();
      await expect(page.getByRole("listbox")).toBeVisible();

      const options = page.getByRole("listbox").getByRole("option");
      await expect(options.first()).toBeVisible();
      await options.first().click();

      // ★複数選択は選んでも閉じない(M27-02a が確定した作法)。ここが壊れていないこと。
      await expect(page.getByRole("listbox")).toBeVisible();
      await expect(page.getByTestId("combo-list-tag-filter-count")).toHaveText("1");
    } finally {
      // ★`deleteTags` は `CreatedTag[]` を取る(中で `tag.id` を読む)。
      //   id の配列を渡すと URL が `/api/tags/undefined` になり、`.catch()` に
      //   飲まれて**後片付けが黙って空振りする**。⇒ そのまま渡すこと。
      //   ★`web/e2e/` はどの経路でも型検査されない(web/CLAUDE.md §3)ため、
      //     この誤りはビルドでも実行時でも赤くならない。
      await deleteTags(request, tags);
    }
  });
});

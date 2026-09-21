import { expect, test } from "@playwright/test";

import {
  addRecipeStep,
  fillRequiredComboFields,
  firstMoveIdOf,
  gotoNewComboRecipeFor,
  switchEditorTab,
  unsavedDialog,
} from "./support/editor-input";
import { gotoNewComboFor } from "./support/character";
import { completeNewComboSave } from "./support/new-combo";

// M24-12: エディタの作り替え(1 カラム縦積み ＋ タブ ＋ キーボード中心の入力)。
//
// ★★指示書 v1.2.0 §5.1 の E2E 7 ケースのうち、本ファイルは (3)(5)(6)(7) を持つ。
//   ★見出しは「6 ケース」と書いているが列挙は (1)〜(7) の 7 件である
//     (チェックリスト 5-1 も「7 ケース」。⇒ 7 が正。playbook §4.40 で数え直した)。
//   (1) タブを切り替えても入力が消えない …… m24-04 spec (3) / (8)
//   (2) 入力途中で画面内リンクを踏むと確認が出る …… m24-04 spec (1)
//   (4) 別タブにエラーがある状態で保存 …… m24-04 spec (4)
//   ⇒ 既にあるものを複製しない(E-232)。ここには無いものだけを置く。
//
// ★本 spec は共有 DB にコンボを 1 件作る。件数に依存しない形にし、作ったものは削除する。

const STAMP = `m2412-${Date.now()}`;

test.describe("M24-12 エディタの作り替え", () => {
  // ★★指示書 §5.1 (3)。M24-04 の手動確認で初めて出た欠陥の再発防止である。
  //   ★「確認が出ない」だけを見ると通ってしまう。**「編集画面へ戻らない」まで見る。**
  test("(3) 保存直後の遷移では確認が出ず、かつ編集画面へ戻らない", async ({
    page,
  }) => {
    // ★戻るの行き先を確定させるため、編集画面より前に 1 ページ置く。
    //   ★★`/` を起点にしてはいけない——`web/src/App.tsx:32-34` が
    //     デスクトップ幅(`max-width:639px` 以外)で `/` → `/combos` へ
    //     `<Navigate replace>` する。**起点の URL が自分で動くため、
    //     最後の「起点へ戻れたか」が競り合いになる。**
    //   ⇒ リダイレクトを持たない `/settings` を起点にし、
    //     **着いたことを確かめてから**編集画面へ進む。
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/settings$/);
    const characterId = await gotoNewComboRecipeFor(page, "ryu");
    const moveId = await firstMoveIdOf(page, characterId);

    // 警告の出ない素直なレシピにする(先頭が技＝始動技と食い違わない)。
    await addRecipeStep(page, moveId);

    await switchEditorTab(page, "basic");
    await page
      .getByPlaceholder("このコンボに関するメモ(任意)")
      .fill(`${STAMP}-save`);
    // ★M27-02b(VAL-C15): 本登録の必須欄を埋める。埋めないと保存が止まり、
    //   本ケースが見たい「保存直後の遷移」まで到達しない。
    await fillRequiredComboFields(page);

    const comboId = await completeNewComboSave(page, () =>
      page.getByRole("button", { name: "保存", exact: true }).click(),
    );

    // ★① 確認は出ない(保存の成功で dirty が落ちている)。
    await expect(
      unsavedDialog(page),
      "★保存が成功したのに未保存の確認が出ている",
    ).toBeHidden();
    await expect(
      page.getByTestId("unsaved-changes-armed"),
      "★保存が成功したのに離脱ガードが張られたままである",
    ).toHaveCount(0);

    // ★★② 編集画面へ戻っていない。ここが M24-04 の欠陥そのものである——
    //   保存後の遷移が離脱ガードの補正を通っていないと、番人の履歴エントリぶんしか
    //   進めず「離れたつもりで編集画面自身へ着地する」。
    await expect(
      page,
      "★★保存したのに新規登録画面へ着地している(保存後の遷移が補正を通っていない)",
    ).not.toHaveURL(/\/combos\/new/);

    // ★★③ 履歴に編集画面の複製が残っていない。
    //   ★ここが破壊確認 2 を捕まえる唯一の観測である——素の navigate() でも
    //     遷移先には着くため、「確認が出ない」「URL が編集画面でない」だけでは
    //     補正の有無を区別できない。**違いは履歴の枚数に出る**:
    //     補正あり … 番人のエントリを遷移先で置き換える(replace)ので、
    //                戻る 1 回で編集画面、2 回目で編集画面より前へ抜ける。
    //     補正なし … 番人が残るので、戻るを 1 回多く押すことになる
    //                (2 回戻ってもまだ編集画面に居る)。
    await page.goBack();
    await page.goBack();
    // ★★否定形だけにしない——`not.toHaveURL(/combos\/new/)` は about:blank や
    //   エラーページ、履歴が尽きて動かない状態でも通ってしまう。
    //   ⇒ 冒頭で置いた起点（設定画面）へ着いたことを**肯定形で**押さえる。
    await expect(
      page,
      "★★戻るを 2 回押しても起点(設定画面)へ戻れない＝履歴に編集画面の複製が残っている(保存後の遷移が離脱ガードの補正を通っていない)",
    ).toHaveURL(/\/settings$/);

    // 後始末。
    await page.goto(`/combos/${comboId}`);
    await page.getByRole("button", { name: "削除" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "削除" }).click();
    await expect(page).toHaveURL(/\/combos(\?character_id=\d+)?$/);
  });

  // ★★指示書 §5.1 (5) / §7.1-5。
  test("(5) キーボードだけで基本情報タブを最後まで進められる", async ({ page }) => {
    await gotoNewComboFor(page, "ryu");

    // 先頭の欄(ダメージ)から始める。
    const damage = page.getByTestId("combo-editor-damage");
    await damage.focus();
    await expect(damage).toBeFocused();

    // ★Enter で順に送る。★★途中で詰まったらここで失敗する
    //   ——畳まれたセクションを飛ばす/そこで止まる実装だと最後まで届かない。
    const memo = page.getByTestId("combo-editor-memo");
    // ★★M24-12 v1.2.0(§4.11): タグ欄に到達したら候補が開いていること。
    //   ★★破壊確認 7 の受け皿である——**開くのをやめても「止まらない」は成立してしまう**
    //     ため、「止まらない」だけでは §4.11 を守れない(2026-08-29 の実測で空振りした)。
    const tagTrigger = page.getByRole("button", {
      name: /タグを選択、または、新規登録/,
    });
    let sawTagOpen = false;
    for (let i = 0; i < 40; i += 1) {
      if (await memo.evaluate((el) => el === document.activeElement)) break;
      if (!sawTagOpen && (await tagTrigger.getAttribute("aria-expanded")) === "true") {
        sawTagOpen = true;
      }
      await page.keyboard.press("Enter");
    }
    expect(
      sawTagOpen,
      "★★順送りでタグ欄に到達しても候補が開かなかった(§4.11)",
    ).toBe(true);
    await expect(
      memo,
      "★キーボードだけで基本情報タブの末尾(メモ欄)まで到達できていない",
    ).toBeFocused();

    // ★★メモ欄では順送りが効かない(Enter は改行になる)。
    await page.keyboard.press("Enter");
    await expect(
      memo,
      "★メモ欄で順送りが効いてしまっている(Enter は改行であるべき)",
    ).toBeFocused();

    // ★出口は「レシピへ」ボタンである(D-578(5))。
    await page.getByTestId("combo-editor-go-to-recipe").click();
    await expect(page.getByTestId("combo-editor-panel-recipe")).toBeVisible();
    await expect(page.getByTestId("combo-editor-panel-basic")).toBeHidden();
  });

  // ★★畳まれたセクションへ順送りが移るとき、開いてから移る(§4.4.2)。
  //   ★飛ばすと利用者は「入力できない欄」に到達したことに気づけない。
  //   ★開かずに止めると順送りが詰まる。
  test("★畳まれたセクションへ進むと、そのセクションが開いてから移る", async ({
    page,
  }) => {
    await gotoNewComboFor(page, "ryu");

    // 「その他情報」を畳む。
    const otherSection = page.getByTestId("combo-editor-other-section");
    await otherSection.getByRole("button").first().click();
    await expect(page.getByTestId("combo-editor-memo")).toHaveCount(0);

    // 起き攻めの最後の停止点から Enter で進む。
    const okiGroups = page
      .getByTestId("combo-editor-oki-section")
      .locator('[data-seq-stop]');
    await okiGroups.last().locator("button").first().focus();
    await page.keyboard.press("Enter");

    // ★開いたうえで、その先頭へフォーカスが移っている。
    await expect(
      page.getByTestId("combo-editor-memo"),
      "★畳まれたセクションが開いていない(飛ばしたか、止まった)",
    ).toBeVisible();
    await expect(page.getByTestId("combo-editor-link")).toBeFocused();
  });

  // ★★指示書 v1.2.0 §5.1 (6)（2026-08-29 追加・D-582）。
  //   `DES-005` §5.7 項目3 の「編集モードは末尾を維持」を撤回した結果を固定する。
  //   ★破壊確認 6＝編集モードだけ末尾へ戻すと、ここが赤くなる。
  test("(6) 編集モードでも仮登録トグルが最上部に在る", async ({ page }) => {
    const memo = `${STAMP}-draft-pos`;
    const characterId = await gotoNewComboRecipeFor(page, "ryu");
    const moveId = await firstMoveIdOf(page, characterId);
    // ★★ステップを 2 本入れる。1 本だと本ファイルの (3) と重複判定キー(VAL-C02)が
    //   一致し、保存が 400 で止まる——**メモは判定キーに入らない**ため、メモを
    //   変えても区別されない(DES-006 §2.3)。
    await addRecipeStep(page, moveId);
    await addRecipeStep(page, moveId);
    await switchEditorTab(page, "basic");
    await page.getByPlaceholder("このコンボに関するメモ(任意)").fill(memo);
    // ★M27-02b(VAL-C15): 本登録の必須欄を埋める。埋めないと保存が止まる。
    await fillRequiredComboFields(page);
    // ★保存後の遷移先は一覧である(M24-01 / SM-084)。詳細は id で開く。
    const comboId = await completeNewComboSave(page, () =>
      page.getByRole("button", { name: "保存" }).click(),
    );
    await page.goto(`/combos/${comboId}/edit`);
    await expect(page).toHaveURL(/\/combos\/\d+\/edit$/);

    // ★「最上部」の実体＝「← キャンセル」と同じ行に在ること。
    const draft = page.getByTestId("combo-editor-draft-checkbox");
    await expect(draft).toBeVisible();
    const sameRow = await page.evaluate(() => {
      const sw = document.querySelector('[data-testid="combo-editor-draft-checkbox"]');
      const cancel = Array.from(document.querySelectorAll("button")).find(
        (b) => b.textContent?.trim() === "← キャンセル",
      );
      return !!(sw && cancel && cancel.parentElement?.contains(sw));
    });
    expect(sameRow).toBe(true);

    // ★★ラベルが 2 つの版で同一であること(§4.10.2)。inline 版でも補足が出る。
    //   ★M24-13: 括弧の中から「レシピ未入力」を落とした(仮登録でもレシピが要る
    //     ようになり、事実でなくなったため)。★見ている命題は変えていない。
    await expect(page.getByText("重複コンボの登録等を許容")).toBeVisible();

    // ★後始末: 作ったコンボを消す(本 spec は件数に依存しない形にしてある)。
    const del = await page.request.delete(`/api/combos/${comboId}`);
    expect(del.ok(), `後始末の削除に失敗: ${del.status()}`).toBeTruthy();
  });

  // ★★指示書 v1.2.0 §5.1 (7)（2026-08-29 追加・D-583）。
  //   `type=flag` が数字キーだけで選べ、他の 5 欄と同じ作法になっていること。
  //   ★破壊確認 8＝「いいえ」で `false` を書く形にすると、コンポーネントテストが赤くなる
  //     （こちらは作法＝数字で選べることを見る）。
  test("(7) キャラ固有状態(type=flag)が数字キーだけで選べる", async ({ page }) => {
    await gotoNewComboRecipeFor(page, "ryu");
    await switchEditorTab(page, "basic");

    const yes = page.getByTestId("combo-editor-custom-state-denjin_charge-yes");
    const no = page.getByTestId("combo-editor-custom-state-denjin_charge-no");

    // ★初期は「いいえ」が選択済みに見える(第 3 の見た目を作らない＝§4.12.2)。
    await expect(no).toHaveAttribute("aria-checked", "true");
    await expect(yes).toHaveAttribute("aria-checked", "false");

    // ★他の 5 欄と同じ作法＝群にフォーカスして数字キー。
    await no.focus();
    await page.keyboard.press("Digit1");
    await expect(yes).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("Digit2");
    await expect(no).toHaveAttribute("aria-checked", "true");

    // ★対照: 単一選択 5 欄のうち 1 つが同じ打鍵で動くこと(作法が割れていない)。
    const posUnspecified = page.getByTestId("combo-editor-position-unspecified");
    await posUnspecified.focus();
    await page.keyboard.press("Digit2");
    await expect(posUnspecified).toHaveAttribute("aria-checked", "false");
  });
});

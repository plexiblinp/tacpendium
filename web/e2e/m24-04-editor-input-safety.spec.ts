import { test, expect } from "@playwright/test";

import { characterIdOf, gotoNewComboFor } from "./support/character";
import {
  NARROW_VIEWPORT,
  addMinimalRecipeStep,
  addNonMoveRecipeStep,
  addRecipeStep,
  createSetupViaApi,
  fillRequiredComboFields,
  firstMoveIdOf,
  switchEditorTab,
  unsavedDialog,
  waitForGuardArmed,
} from "./support/editor-input";

// M24-04: 入力事故の防止(CO-003)と入力面のタブ分け(SM-148)。
//
// ★判定キーは本 spec 固有にする(教訓 E-232)。playwright は fullyParallel: false でも
//   ファイル単位では並行に走り、E2E は DB を 1 本共有する。
//
// ★★【M24-12 で更新】タブは幅によらず常に出る(CHANGE-138)。
//   M24-04 当時は lg(1024px)未満でだけ出ており、「PC 幅の既存 spec が無傷なのは
//   このためである」と書いてあったが、その前提は本サブで消えた。
//   ⇒ 狭い幅を使うのは「フッタのナビ(画面内リンク)を出すため」だけである
//     (フッタは sm(640px)未満でだけ出る)。

const STAMP = `m2404-${Date.now()}`;

test.describe("M24-04 未保存のまま離れようとしたときの確認(CO-003)", () => {
  // ★ケース(1): 画面内のリンクを踏む。
  //   ★実査で分かったこと——コンボ登録/編集画面は Header を描画していない
  //     (ComboEditorPage は Header を呼ばない)。PC 幅では画面内のリンクが無く、
  //     離脱導線は「キャンセル」ボタンとブラウザバックだけである。
  //   ⇒ リンク経路は、フッタのナビが出る狭い幅で踏む。
  test("(1) 入力途中で画面内のリンクを踏むと確認が出て、遷移は止まる", async ({
    page,
  }) => {
    await page.setViewportSize(NARROW_VIEWPORT);
    await gotoNewComboFor(page, "ryu");

    await page
      .getByPlaceholder("このコンボに関するメモ(任意)")
      .fill(`${STAMP}-link`);
    await waitForGuardArmed(page);

    await page.getByRole("link", { name: "コンボ", exact: true }).click();

    await expect(
      unsavedDialog(page),
      "★未保存のまま画面内リンクを踏んだのに確認が出ていない",
    ).toBeVisible();
    // ★遷移は止まっている(入力を失っていない)。
    await expect(page).toHaveURL(/\/combos\/new/);
    await expect(
      page.getByPlaceholder("このコンボに関するメモ(任意)"),
    ).toHaveValue(`${STAMP}-link`);

    // 「このページに留まる」で元の画面に残る。
    await page.getByRole("button", { name: "このページに留まる" }).click();
    await expect(unsavedDialog(page)).toBeHidden();
    await expect(page).toHaveURL(/\/combos\/new/);
  });

  test("(1b) 「保存せずに離れる」を選ぶと実際に離れる", async ({ page }) => {
    await page.setViewportSize(NARROW_VIEWPORT);
    await gotoNewComboFor(page, "ryu");
    await page
      .getByPlaceholder("このコンボに関するメモ(任意)")
      .fill(`${STAMP}-leave`);
    await waitForGuardArmed(page);

    await page.getByRole("link", { name: "コンボ", exact: true }).click();
    await page.getByRole("button", { name: "保存せずに離れる" }).click();

    await expect(page).toHaveURL(/\/combos(\?|$)/);
    await expect(unsavedDialog(page)).toBeHidden();
  });

  // ★★ケース(2): 保存の成功で dirty が落ちること。
  //   落ちないと、保存が済んでいるのに「保存していない変更があります」と言われる。
  //
  // ★★観測できる経路を選ぶ必要がある(教訓 D-572)。
  //   通常の保存は成功すると自動で一覧へ遷移し、エディタごと消える。
  //   その遷移はプログラム側から呼ぶもので離脱ガードを通らないため、
  //   dirty が落ちていようがいまいが確認は出ない——つまり何も観測できない。
  //   ⇒ 「保存は成功したが警告があるので画面に留まる」分岐を使う。
  //     留まったあとに離れようとしたとき、確認が出れば dirty が落ちていない。
  test("(2) 保存が成功したら、そのあと離れようとしても確認は出ない", async ({
    page,
  }) => {
    await page.setViewportSize(NARROW_VIEWPORT);
    const characterId = await gotoNewComboFor(page, "ryu");
    const moveId = await firstMoveIdOf(page, characterId);

    await page
      .getByPlaceholder("このコンボに関するメモ(任意)")
      .fill(`${STAMP}-save`);
    // ★M27-02b(VAL-C15): 本登録の必須欄を埋める。埋めないと保存が ERROR で止まり、
    //   本ケースが使う「保存は成功したが警告があるので画面に留まる」分岐へ入らない。
    await fillRequiredComboFields(page);

    // 1 ステップ目を技以外にすると、始動技(先頭の技)と食い違い VAL-C03 の警告が出る。
    await switchEditorTab(page, "recipe");
    await addNonMoveRecipeStep(page);
    await addRecipeStep(page, moveId);

    await Promise.all([
      page.waitForResponse(
        (r) =>
          r.request().method() === "POST" &&
          new URL(r.url()).pathname === "/api/combos",
      ),
      page.getByRole("button", { name: "保存" }).click(),
    ]);

    // 保存は成功し、警告つきの案内が出て画面に留まっている。
    await page.getByRole("button", { name: "このページに留まる" }).click();
    await expect(page).toHaveURL(/\/combos\/new/);

    // ★★ここが本題——保存が済んでいるのだから、離れようとしても確認は出ない。
    await expect(
      page.getByTestId("unsaved-changes-armed"),
      "★保存が成功したのに離脱ガードが張られたままである(dirty が落ちていない)",
    ).toHaveCount(0);

    await switchEditorTab(page, "basic");
    await page.getByRole("link", { name: "コンボ", exact: true }).click();
    await expect(
      unsavedDialog(page),
      "★保存が成功したのに未保存の確認が出ている(dirty が落ちていない)",
    ).toBeHidden();
    await expect(page).toHaveURL(/\/combos(\?|$)/);
  });

  // ★ブラウザバック(チェックリスト 4-2)。
  test("(5) ブラウザバックでも確認が出る", async ({ page }) => {
    await page.setViewportSize(NARROW_VIEWPORT);
    // 戻り先を履歴に積んでから編集画面へ入る。
    await page.goto("/combos");
    await page.goto("/combos/new");
    await expect(page.getByTestId("combo-editor-tab-basic")).toBeVisible();

    await page
      .getByPlaceholder("このコンボに関するメモ(任意)")
      .fill(`${STAMP}-back`);
    // ★ガードが張られるのを待ってから戻る(待たずに押すと本当に戻る＝flaky の原因)。
    await waitForGuardArmed(page);

    await page.goBack();

    await expect(
      unsavedDialog(page),
      "★ブラウザバックで確認が出ていない",
    ).toBeVisible();
    await expect(page).toHaveURL(/\/combos\/new/);
  });

  // ★★レビュー指摘（重大-3）で足したケース。
  //   「キャンセル」ボタンはリンクではないため click キャプチャに掛からず、
  //   ガードが積んだ番人の履歴エントリぶんの補正も別経路になる。
  //   ★ここを踏む E2E が無かったため、「離れるを選んでも離れない」状態が緑のまま通っていた。
  test("(9) キャンセル →「保存せずに離れる」で実際に離れる", async ({ page }) => {
    await page.setViewportSize(NARROW_VIEWPORT);
    await page.goto("/combos");
    await page.goto("/combos/new");
    await expect(page.getByTestId("combo-editor-tab-basic")).toBeVisible();

    await page
      .getByPlaceholder("このコンボに関するメモ(任意)")
      .fill(`${STAMP}-cancel`);
    await waitForGuardArmed(page);

    await page.getByRole("button", { name: "← キャンセル" }).click();
    await expect(unsavedDialog(page)).toBeVisible();
    await page.getByRole("button", { name: "保存せずに離れる" }).click();

    await expect(
      page,
      "★「保存せずに離れる」を選んだのに編集画面へ留まっている",
    ).toHaveURL(/\/combos(\?|$)/);
    await expect(unsavedDialog(page)).toBeHidden();
  });

  // ★★レビュー指摘（重大-3）で足したケース。
  //   ガードは張られると番人の履歴エントリを 1 枚積む。dirty を打ち消しただけで
  //   その 1 枚が残ると、次の「戻る」が同じ URL のエントリへ着地して空振りする
  //   ——本サブ以前には無かった挙動になる。
  test("(10) 入力して消したあとのブラウザバックが空振りしない", async ({
    page,
  }) => {
    await page.setViewportSize(NARROW_VIEWPORT);
    await page.goto("/combos");
    await page.goto("/combos/new");
    await expect(page.getByTestId("combo-editor-tab-basic")).toBeVisible();

    const memo = page.getByPlaceholder("このコンボに関するメモ(任意)");
    await memo.fill(`${STAMP}-toggle`);
    await waitForGuardArmed(page);
    await memo.fill("");
    // ガードが外れたこと（＝番人の後始末が済んだこと）を待つ。
    await expect(page.getByTestId("unsaved-changes-armed")).toHaveCount(0);

    await page.goBack();

    await expect(
      page,
      "★戻るが 1 回空振りしている(番人の履歴エントリが残っている)",
    ).toHaveURL(/\/combos(\?|$)/);
    await expect(unsavedDialog(page)).toBeHidden();
  });

  test("(6) 何も入力していなければ確認は出ない(触っただけで止めない)", async ({
    page,
  }) => {
    await page.setViewportSize(NARROW_VIEWPORT);
    await gotoNewComboFor(page, "ryu");

    await page.getByRole("link", { name: "コンボ", exact: true }).click();

    await expect(unsavedDialog(page)).toBeHidden();
    await expect(page).toHaveURL(/\/combos(\?|$)/);
  });
});

// ★★2026-08-28 の開発者手動確認で見つかった 2 件。どちらも「番人の履歴エントリ」の
//   扱いが原因で、既存のどのケースも踏んでいなかった経路である。
test.describe("M24-04 手動確認で見つかった離脱の穴", () => {
  // ★手動確認 ④-1: セットプレイ編集で保存したのに確認が出て、離れられなかった。
  //   機序＝dirty を落とすのは state 更新(非同期)なのに navigate(-1) は同期実行される。
  //   その時点ではガードが張られたままで、しかも番人が残っているため
  //   編集画面自身のエントリへ戻り、popstate が確認を出していた。
  test("(11) セットプレイ編集で保存すると、確認は出ずに離れる", async ({ page }) => {
    const characterId = await characterIdOf(page.request, "ryu");
    const moveId = await firstMoveIdOf(page, characterId);
    const { comboId, setupId } = await createSetupViaApi(
      page,
      characterId,
      moveId,
      `${STAMP}-setup`,
    );

    await page.goto(`/combos/${comboId}`);
    await page.goto(`/setups/${setupId}`);
    await page.getByPlaceholder("セットプレイ名").fill(`${STAMP}-renamed`);
    await waitForGuardArmed(page);

    await page.getByRole("button", { name: "保存" }).click();

    await expect(
      unsavedDialog(page),
      "★保存が成功したのに未保存の確認が出ている",
    ).toBeHidden();
    await expect(
      page,
      "★保存したのにセットプレイ編集画面に留まっている",
    ).not.toHaveURL(new RegExp(`/setups/${setupId}$`));
  });

  // ★手動確認で報告された手順: リロードを挟むと「保存せずに離れる」で一発で戻れない。
  //   機序＝pushState の state はリロードを跨いで残るため、前のインスタンスが積んだ
  //   番人の上で復帰する。そこへもう 1 枚積むと番人が 2 枚になり、go(-2) では足りない。
  test("(12) リロードを挟んでも「保存せずに離れる」で一発で一覧へ戻る", async ({
    page,
  }) => {
    await page.setViewportSize(NARROW_VIEWPORT);
    await page.goto("/combos");
    await page.goto("/combos/new");
    await expect(page.getByTestId("combo-editor-tab-basic")).toBeVisible();

    const memo = page.getByPlaceholder("このコンボに関するメモ(任意)");
    await memo.fill(`${STAMP}-reload-1`);
    await waitForGuardArmed(page);

    // ★ここが再現の要——番人の上でリロードする。
    await page.reload();
    await expect(page.getByTestId("combo-editor-tab-basic")).toBeVisible();

    await page
      .getByPlaceholder("このコンボに関するメモ(任意)")
      .fill(`${STAMP}-reload-2`);
    await waitForGuardArmed(page);

    await page.goBack();
    await expect(unsavedDialog(page)).toBeVisible();
    await page.getByRole("button", { name: "保存せずに離れる" }).click();

    await expect(
      page,
      "★一発で戻れていない(番人が 2 枚たまっている)",
    ).toHaveURL(/\/combos(\?|$)/);
  });

  // ★リロード後に一度も入力しないまま戻る経路。番人が取り残されると 1 回空振りする。
  test("(13) リロード後、入力せずに戻っても空振りしない", async ({ page }) => {
    await page.setViewportSize(NARROW_VIEWPORT);
    await page.goto("/combos");
    await page.goto("/combos/new");
    await expect(page.getByTestId("combo-editor-tab-basic")).toBeVisible();

    await page
      .getByPlaceholder("このコンボに関するメモ(任意)")
      .fill(`${STAMP}-reload-3`);
    await waitForGuardArmed(page);

    await page.reload();
    await expect(page.getByTestId("combo-editor-tab-basic")).toBeVisible();

    // 何も入力せずに戻る。
    await page.goBack();

    await expect(
      page,
      "★戻るが空振りしている(リロードで取り残された番人が残っている)",
    ).toHaveURL(/\/combos(\?|$)/);
    await expect(unsavedDialog(page)).toBeHidden();
  });
});

test.describe("M24-04 入力面のタブ分け(SM-148)", () => {
  // ★ケース(3): 本サブは「入力を失う」を減らすサブである。
  test("(3) タブを切り替えても入力が消えない", async ({ page }) => {
    await page.setViewportSize(NARROW_VIEWPORT);
    const characterId = await gotoNewComboFor(page, "ryu");
    const moveId = await firstMoveIdOf(page, characterId);
    const memo = `${STAMP}-tab`;

    await page.getByPlaceholder("このコンボに関するメモ(任意)").fill(memo);

    await switchEditorTab(page, "recipe");
    await addRecipeStep(page, moveId);
    await expect(page.getByTestId("recipe-step-list")).toContainText("1");

    await switchEditorTab(page, "basic");
    await expect(
      page.getByPlaceholder("このコンボに関するメモ(任意)"),
      "★基本情報の入力がタブ切替で消えている",
    ).toHaveValue(memo);

    await switchEditorTab(page, "recipe");
    await expect(
      page.getByTestId("recipe-step-list"),
      "★レシピの入力がタブ切替で消えている",
    ).toContainText("1");
  });

  // ★ケース(4): 落とせない条件。エラーが「今見ていないタブ」に在ることが分かる。
  //
  // ★★M24-13 で「エラーの作り方」だけを差し替えた。命題も主張も 1 文字も変えていない。
  //   元は「基本情報タブに居たまま、レシピ 0 件で保存する」形だった。M24-13 が
  //   VAL-C09 を仮登録へ広げたため、レシピ 0 件では **保存ボタンが押せない**。
  //   ★★あわせて、画面から到達できる検証エラーは 1 件も無くなった——
  //     memo / ステップメモ / 数値欄はすべて UI 側で maxLength ないしクランプが
  //     掛かっており、zod の上限を UI からは超えられない。
  //   ⇒ サーバ応答だけを差し替えて、エラーが返ってきたときの **画面の振る舞い** を見る。
  //     ★assert しているものは元と同一である(レシピ側にバッジ 1 / 基本情報側は無し)。
  //     ★先例＝m22-01 / m22-02 の page.route。
  test("(4) 別タブにエラーがある状態で保存すると、そのタブが分かる", async ({
    page,
  }) => {
    await page.setViewportSize(NARROW_VIEWPORT);

    // ★POST /api/combos の応答だけを差し替える。レシピ側の欄を指す ERROR を 1 件返す。
    //   ★振り分けは添字付きの前方一致で行われる(バックエンドは `steps[0].moveId`)。
    await page.route(/\/api\/combos$/, async (route) => {
      if (route.request().method() !== "POST") {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code: "validation_failed",
            message: "バリデーションエラーがあります",
            details: {
              validations: {
                issues: [
                  {
                    code: "VAL-C08",
                    severity: "error",
                    field: "steps[0].moveId",
                    message: "テスト用に差し替えたレシピ側のエラー",
                  },
                ],
              },
            },
          },
        }),
      });
    });

    await gotoNewComboFor(page, "ryu");

    // ★基本情報のタブに居たまま保存する(保存ボタンは両パネルの外＝M24-12 §4.5)。
    await page
      .getByPlaceholder("このコンボに関するメモ(任意)")
      .fill(`${STAMP}-err`);
    // ★M24-13: レシピが 0 本だと保存ボタンが押せない。1 本置いてから押す。
    await addMinimalRecipeStep(page);
    // ★★M27-02b(VAL-C15): 必須欄を埋める。埋めないと **FE の zod が先に止め**、
    //   基本情報タブ側にエラーが立つ。⇒ 本ケースが見たい「差し替えたレシピ側の
    //   エラーだけがバッジに出る」が観測できなくなる(基本情報側が 0 でなくなる)。
    await fillRequiredComboFields(page);
    await page.getByRole("button", { name: "保存" }).click();

    // ★レシピ側にエラーがあることが、タブの見出しから分かる。
    await expect(
      page.getByTestId("combo-editor-tab-errors-recipe"),
      "★エラーが今見ていないタブに在ることが見出しから分からない",
    ).toHaveText("1");
    // ★基本情報側には出さない(どこを直せばよいか分からなくなる)。
    await expect(page.getByTestId("combo-editor-tab-errors-basic")).toHaveCount(
      0,
    );
  });

  // ★★M24-12: (7) は「PC 幅ではタブを出さない」を見ていた。本サブで幅による分岐が
  //   消えたため、前提が反転した。⇒ 削除ではなく置換する——見る対象は同じ
  //   「PC 幅でエディタがどういう形か」であり、答えが変わっただけである。
  test("(7) PC 幅でもタブが出る(幅による分岐が消えた)", async ({ page }) => {
    await gotoNewComboFor(page, "ryu");
    // ★既定のビューポート(1280 幅)。M24-04 当時ここでタブは隠れていた。
    await expect(page.getByTestId("combo-editor-tab-basic")).toBeVisible();
    await expect(page.getByTestId("combo-editor-tab-recipe")).toBeVisible();
    // ★「メタデータを隠す」は役割が消えたので撤去した(タブが全幅を与える)。
    await expect(
      page.getByTestId("combo-editor-metadata-toggle"),
    ).toHaveCount(0);
    // ★片方だけが見えている＝2 カラムではない。
    await expect(page.getByTestId("combo-editor-panel-basic")).toBeVisible();
    await expect(page.getByTestId("combo-editor-panel-recipe")).toBeHidden();
  });

  // ★★M24-12: (8) は「メタデータを畳んでもレシピ側が残り、入力は消えない」を
  //   見ていた。トグルは撤去したが、★守っている保証は同じである——
  //   「片方を隠しても、もう片方の入力は生きたまま残る」。
  //   ⇒ その保証をタブの出し分けで見る形へ置換する。
  test("(8) PC 幅でタブを切り替えても両側の入力が消えない(旧 SM-118 の保証)", async ({
    page,
  }) => {
    const characterId = await gotoNewComboFor(page, "ryu");
    const moveId = await firstMoveIdOf(page, characterId);
    const memo = `${STAMP}-collapse`;

    await page.getByPlaceholder("このコンボに関するメモ(任意)").fill(memo);
    await switchEditorTab(page, "recipe");
    await addRecipeStep(page, moveId);

    // レシピ側が見えているとき、メタデータ側は隠れている。
    await expect(page.getByTestId("combo-editor-panel-basic")).toBeHidden();
    await expect(page.getByTestId("combo-editor-panel-recipe")).toBeVisible();

    // ★戻すと入力はそのまま(アンマウントしていない)。
    await switchEditorTab(page, "basic");
    await expect(
      page.getByPlaceholder("このコンボに関するメモ(任意)"),
    ).toHaveValue(memo);
    // ★レシピ側の入力も生きている。
    await switchEditorTab(page, "recipe");
    await expect(page.getByTestId("recipe-step-list")).toContainText("1");
  });
});

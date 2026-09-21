import { test, expect, type Page } from "@playwright/test";

import {
  addRecipeStep,
  gotoNewComboRecipeFor,
  selectableMoveIds,
} from "./support/editor-input";

/**
 * M37-02 段 1 / 段 6: 仮想コントローラの**縦寸法**の前後比較。
 *
 * ★★本 spec の目的は「合否」ではなく「実測値を出すこと」である(指示書 §2.1)。
 *   `B14`〔縦スクロールせずに全レシピを入力したい〕の達成は開発者の実機確認で決まり
 *   (`D-855`)、製造は判定しない。⇒ ここが出すのは判定材料である。
 *
 * ★★★段 1(変更前)と段 6(変更後)で**同じ条件・同じキャラ**を測ること。条件が違えば
 *   比較になっていない(チェックリスト A-2)。
 *
 * ★実行は `make e2e-only P=m37-02-controller-height`。
 *   `pnpm exec playwright test` を直接叩かないこと —— `PW_EXECUTABLE_PATH` が渡らず
 *   UI を使う spec が全滅する(`CLAUDE.md` §11 / `D-599`)。
 *
 * ★★測定は 2 系列に分ける。告知・読取欄は `gamepad.inputActive` でしか描画されず
 *   (`usePhysicalRecipeInput.ts` の `available && (connected || keyboard.registered)`)、
 *   `B10` がそこを畳むと前後の数値が比較不能になるためである。
 *     系列 A = inputActive false(E2E の既定)。⇒ **段 1 と段 6 を比較する正本**。
 *     系列 B = inputActive true(キーボード割当を仕込む)。⇒ 告知・読取の寄与の切り出し。
 */

/** キーボード割当の保持キー(`web/CLAUDE.md` §1 #9)。★台帳のキー名を直書きしない。 */
const KEYBOARD_BINDINGS_KEY = "keyboard-bindings-v1";

/** 告知の既読フラグ（`web/CLAUDE.md` §1 #12）。系列 C で「2 回目以降」を作るのに使う。 */
const NOTICE_SEEN_KEY = "gamepad-input-notice-seen-v1";

/**
 * 系列 B 用。`keyboard.registered` を立てるだけが目的である。
 *
 * ★★形は `web/CLAUDE.md` §1 #9 と対の `{ version, moves, actions }` でなければならない。
 *   `keyboard-storage.ts` の `sanitizeBindings` が `version !== 1` を**黙って捨てる**ため、
 *   平たいオブジェクトを入れても `registered` は立たない —— 初版はそれで系列 B が
 *   系列 A と同一値になり、告知・読取が 0 のまま「測れていない」ことに気づけなかった。
 * ★`registered` は `hasAnyMoveBinding` なので moves が 1 件でも立つが、
 *   実運用に近づけるため必須 10 件を入れる。
 */
const MINIMAL_BINDINGS = {
  version: 1,
  moves: {
    up: { code: "ArrowUp", label: "↑" },
    down: { code: "ArrowDown", label: "↓" },
    left: { code: "ArrowLeft", label: "←" },
    right: { code: "ArrowRight", label: "→" },
    light_punch: { code: "KeyU", label: "U" },
    medium_punch: { code: "KeyI", label: "I" },
    heavy_punch: { code: "KeyO", label: "O" },
    light_kick: { code: "KeyJ", label: "J" },
    medium_kick: { code: "KeyK", label: "K" },
    heavy_kick: { code: "KeyL", label: "L" },
  },
  actions: {},
};

/**
 * 測るキャラ。
 * ★★`character_data/*.csv` の special 行数は **family 集約後の数ではない**。
 *   ⇒ 実際の family 数は本 spec が実測して出す(下記 familyCount)。
 */
const CHARACTERS = ["blanka", "ryu", "manon"] as const;

/** 幅。★1366x600 は「背の低いノート PC」——固定上限が救えない場合を検出する。 */
const VIEWPORTS = [
  { name: "390x844", width: 390, height: 844 },
  { name: "1280x720", width: 1280, height: 720 },
  { name: "1366x600", width: 1366, height: 600 },
] as const;

interface Row {
  series:
    | "A(inputActive=false)"
    | "B(inputActive=true,初回)"
    | "C(inputActive=true,既読)";
  character: string;
  viewport: string;
  familyCount: number;
  controllerRoot: number;
  specialPanel: number;
  tabsList: number;
  notice: number;
  readout: number;
  /** ページ全体のはみ出し量。★目的に直結するのはパネル高ではなくこれである。 */
  pageOverflow: number;
  /** ページ先頭でレシピ一覧が viewport 内にあるか。 */
  stepListInViewport: boolean;
  /**
   * ★★★必殺技パネルまでスクロールした状態で、レシピのサマリ行が viewport 内にあるか。
   *
   * ★これが「レシピが見えたまま入力できる」(B09 / B14)の直接の表現である。
   *   ステップ一覧はエディタ下部に在り、その上にセットプレイ節・タグ節も載るため、
   *   **コントローラを縮めても viewport には入らない**。⇒ 視界に残すのは sticky な
   *   サマリ行の役目であり(B12)、測るべきはそちらである。
   */
  recipeVisibleWhileInputting: boolean;
}

// ★`playwright.config.ts` は `workers: 1` である。本 spec の `rows` はワーカーごとの
//   モジュール状態であり、並列化すると afterAll の表がワーカー数だけ分割される。
//   ⇒ 計測の再現性のため、ここでも直列を明示しておく。
test.describe.configure({ mode: "serial" });

const rows: Row[] = [];

/** heightOf は要素の高さを返す。存在しなければ 0(=その区画が描画されていない)。 */
async function heightOf(page: Page, testId: string): Promise<number> {
  const el = page.getByTestId(testId).first();
  if ((await el.count()) === 0) return 0;
  const box = await el.boundingBox();
  return box === null ? 0 : Math.round(box.height);
}

/**
 * レシピへ 12 ステップ入れる。
 *
 * ★★ステップ 0 件では `recipe-step-list` が描画されず、`stepListInViewport` が
 *   常に false になり指標として意味を持たない —— 初版がそれで測れていなかった。
 * ★12 件なのは「縦スクロールせずに全レシピを入力したい」(B14)が想定する
 *   現実的なコンボ長だからである。★段 1 と段 6 で同じ数にすること。
 */
const RECIPE_STEPS = 12;

/** localStorage を読込前に仕込む。先例＝`m21-05-keyboard-input.spec.ts` の `seedBindings`。 */
async function seedStorage(
  page: Page,
  entries: ReadonlyArray<readonly [string, unknown]>,
): Promise<void> {
  await page.addInitScript((pairs) => {
    for (const [key, value] of pairs as Array<[string, unknown]>) {
      window.localStorage.setItem(key, JSON.stringify(value));
    }
  }, entries as unknown as Array<[string, unknown]>);
}

async function fillRecipe(page: Page): Promise<void> {
  const ids = await selectableMoveIds(page);
  expect(ids.length, "選択できる技が 1 つも無い").toBeGreaterThan(0);
  for (let i = 0; i < RECIPE_STEPS; i += 1) {
    await addRecipeStep(page, ids[i % ids.length]);
  }
  await expect(page.getByTestId("recipe-step-list").locator("> li")).toHaveCount(
    RECIPE_STEPS,
  );
}

async function measure(
  page: Page,
  series: Row["series"],
  character: string,
  viewport: string,
): Promise<Row> {
  // 必殺技タブを開く。★縦を支配するのはここである(`M37-RESEARCH-01` §5.4)。
  await page.getByTestId("recipe-tab-special").click();
  await expect(page.getByTestId("recipe-special-panel")).toBeVisible();

  // ★★スクロール位置を必ず先頭へ戻してから測る。
  //   `getBoundingClientRect()` はスクロール位置に依存するため、ステップ追加中の
  //   自動スクロールが残っていると `stepListInViewport` が run ごとに揺れる
  //   —— 初版は実際にこれで系列 A と B が逆の結果を返した。
  await page.evaluate(() => window.scrollTo(0, 0));

  const familyCount = await page
    .locator('[data-testid^="recipe-special-family-"]')
    .count();

  const pageOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollHeight - document.documentElement.clientHeight,
  );

  // ★「レシピが見えたまま入力できる」の直接の表現。
  //   `isVisible()` では足りない —— DOM に在って CSS でも表示されているが
  //   viewport の外にある、が本サブで問題にしている当の状態だからである。
  const stepList = page.getByTestId("recipe-step-list");
  const stepListInViewport =
    (await stepList.count()) === 0
      ? false
      : await stepList.evaluate((el) => {
          const r = el.getBoundingClientRect();
          return r.top < window.innerHeight && r.bottom > 0;
        });

  // ★必殺技パネルまでスクロールしてから、sticky なサマリ行が残っているかを見る。
  await page.getByTestId("recipe-special-panel").scrollIntoViewIfNeeded();
  const recipeVisibleWhileInputting = await page
    .getByTestId("combo-editor-recipe-summary")
    .evaluate((el) => {
      const r = el.getBoundingClientRect();
      return r.top >= 0 && r.bottom <= window.innerHeight && r.height > 0;
    });
  await page.evaluate(() => window.scrollTo(0, 0));

  return {
    series,
    character,
    viewport,
    recipeVisibleWhileInputting,
    familyCount,
    controllerRoot: await heightOf(page, "recipe-controller-root"),
    specialPanel: await heightOf(page, "recipe-special-panel"),
    tabsList: await heightOf(page, "recipe-tab-special").then(async (h) =>
      // TabsList 自体に testid が無いため、トリガの親を測る。
      h === 0
        ? 0
        : Math.round(
            (await page
              .getByTestId("recipe-tab-special")
              .locator("xpath=..")
              .boundingBox())?.height ?? 0,
          ),
    ),
    notice: await heightOf(page, "recipe-gamepad-notice"),
    readout: await heightOf(page, "recipe-gamepad-readout"),
    pageOverflow,
    stepListInViewport,
  };
}

test.describe("M37-02 仮想コントローラの縦寸法(実測)", () => {
  for (const vp of VIEWPORTS) {
    for (const code of CHARACTERS) {
      test(`系列A ${code} @ ${vp.name}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await gotoNewComboRecipeFor(page, code);
        await fillRecipe(page);
        const row = await measure(page, "A(inputActive=false)", code, vp.name);
        rows.push(row);

        // ★弱い不変条件だけを主張する。数値そのものを床にしない ——
        //   段 1 では「変更前の値」であり、段 6 では変わるのが正しいからである。
        expect(row.controllerRoot).toBeGreaterThan(0);
        expect(row.specialPanel).toBeGreaterThan(0);
        expect(row.familyCount).toBeGreaterThan(0);
        // ★★これは主張してよい床である —— 「レシピが見えたまま入力できる」は
        //   B09 / B12 が達成すべきことであり、段 6 の時点では真であるはずである。
        expect(row.recipeVisibleWhileInputting).toBe(true);
      });

      test(`系列B ${code} @ ${vp.name}`, async ({ page }) => {
        await seedStorage(page, [[KEYBOARD_BINDINGS_KEY, MINIMAL_BINDINGS]]);
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await gotoNewComboRecipeFor(page, code);
        await fillRecipe(page);
        const rowB = await measure(page, "B(inputActive=true,初回)", code, vp.name);
        rows.push(rowB);
        // ★★押し下げが最も強いのは告知と読取欄が出ている系列 B である。
        //   守りたい条件をいちばん危ない側で守らないと床の意味が無い(レビュー 中-3)。
        expect(rowB.recipeVisibleWhileInputting).toBe(true);
      });

      // ★★系列 C＝告知を既読にした状態。**B10 の payoff はここでしか測れない** ——
      //   E2E は毎回まっさらなコンテキストで始まるため、系列 B は常に「初回」であり
      //   告知は展開されたままである。⇒ 畳んだ状態の縦は別系列で測る。
      test(`系列C ${code} @ ${vp.name}`, async ({ page }) => {
        await seedStorage(page, [
          [KEYBOARD_BINDINGS_KEY, MINIMAL_BINDINGS],
          [NOTICE_SEEN_KEY, true],
        ]);
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await gotoNewComboRecipeFor(page, code);
        await fillRecipe(page);
        const rowC = await measure(page, "C(inputActive=true,既読)", code, vp.name);
        rows.push(rowC);
        expect(rowC.recipeVisibleWhileInputting).toBe(true);
      });
    }
  }

  test.afterAll(() => {
    // ★実測値は stdout へ出す。報告へはこの出力を貼る。
    const header =
      "series\tcharacter\tviewport\tfamilies\troot\tspecial\ttabs\tnotice\treadout\toverflow\tstepListTop\t★レシピ可視(入力中)";
    const body = rows
      .map(
        (r) =>
          `${r.series}\t${r.character}\t${r.viewport}\t${r.familyCount}\t${r.controllerRoot}\t${r.specialPanel}\t${r.tabsList}\t${r.notice}\t${r.readout}\t${r.pageOverflow}\t${r.stepListInViewport}\t${r.recipeVisibleWhileInputting}`,
      )
      .join("\n");
    console.log(`\n=== M37-02 CONTROLLER HEIGHT ===\n${header}\n${body}\n=== END ===\n`);
  });
});

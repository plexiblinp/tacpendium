import { expect, type Page } from "@playwright/test";

import { gotoNewComboFor } from "./character";

// M24-04(CO-003 / SM-148) / M24-12: エディタまわりの E2E で共通に使う下ごしらえ。
//
// ★同じ数行を複数 spec へ複製しない(教訓 E-232 / D-553)。
//
// ★本ファイルは spec ではない(playwright の既定 testMatch は *.spec.ts / *.test.ts のみ)。

/**
 * 狭い幅。
 * ★★M24-12 で「タブが出る幅」ではなくなった——タブは幅によらず常に出る。
 *   M24-04 当時は lg(1024px)未満でだけタブが出ていたが、その分岐は消えた。
 * ★現在この定数が意味を持つのは「フッタのナビ(画面内リンク)が出る幅」としてである
 *   ——フッタは sm(640px)未満でだけ出るため、離脱ガードの「画面内リンク」経路を
 *   踏むにはこの幅が要る。
 */
export const NARROW_VIEWPORT = { width: 390, height: 844 } as const;

/** 未保存の変更の確認ダイアログ。 */
export function unsavedDialog(page: Page) {
  return page.getByTestId("unsaved-changes-dialog");
}

/**
 * 離脱ガードが実際に張られるまで待つ。
 *
 * ★ガードは「dirty になった次の描画」で張られる(番人の履歴エントリを積むのは
 *   useEffect である)。待たずにブラウザバックを押すと、まだ番人が無いため本当に
 *   戻ってしまう。⇒ 待ってから押す。
 */
export async function waitForGuardArmed(page: Page): Promise<void> {
  await expect(
    page.getByTestId("unsaved-changes-armed"),
    "★離脱ガードが張られていない(dirty になっていない可能性)",
  ).toBeAttached();
}

/**
 * ★★M27-02b(`P4M-009`): 本登録に必須の欄を埋める。
 *
 * ★★本登録(is_draft=false)で保存する spec は、これを呼ばないと保存が通らない。
 * ★仮登録で保存する spec には要らない(VAL-C15 は仮登録をスキップする)。
 *
 * ★★★【M38-01・射程 3 → 追補2】**埋めるのは damage / knockdown-advantage の 2 欄だけ**である。
 *
 *   ★以下は二重に失効した記述:
 *     (1)「必須は 4 欄だが、ここで埋めるのは 2 欄だけでよい —— 消費ゲージ 2 欄は
 *        新規登録の既定値が "0" で入っているためである」(M38-01 本体で必須が入れ替わった)
 *     (2)「4 欄すべてをここで埋めるようになった。開始残量は不問トグルで満たす」
 *        (追補2 で開始残量 2 欄が**任意**になり、トグルごと消えた)
 *   ⇒ `VAL-C15` の必須は damage / knockdownAdvantage の 2 欄である。
 *     **開始残量を空のまま残すこと自体が、必須から外れたことの実証になっている。**
 *
 * ★基本情報タブに居ることを前提にしない——欄が隠れていれば先にタブを切り替える。
 */
export async function fillRequiredComboFields(page: Page): Promise<void> {
  const damage = page.getByTestId("combo-editor-damage");
  if (!(await damage.isVisible())) {
    await switchEditorTab(page, "basic");
  }
  await page.getByTestId("combo-editor-damage").fill("1500");
  await page.getByTestId("combo-editor-knockdown-advantage").fill("30");
}

/** そのキャラの技 ID を 1 つ取る(レシピを 1 ステップだけ組むため)。 */
export async function firstMoveIdOf(
  page: Page,
  characterId: number,
): Promise<number> {
  const res = await page.request.get(`/api/moves?character_id=${characterId}`);
  expect(res.ok(), `技一覧の取得に失敗: ${res.status()}`).toBeTruthy();
  const items = (await res.json()).items as Array<{ id: number }>;
  expect(items.length, `character_id=${characterId} の技が 0 件`).toBeGreaterThan(
    0,
  );
  return items[0].id;
}

/**
 * 全技プルダウンを開く。★既に開いていれば何もしない。
 *   トグルは開閉を反転するだけなので、続けて 2 ステップ足すときに素朴に押すと閉じてしまう。
 */
async function openRecipePulldown(page: Page): Promise<void> {
  const toggle = page.getByTestId("recipe-pulldown-toggle");
  if ((await toggle.getAttribute("aria-expanded")) !== "true") {
    await toggle.click();
  }
  await expect(page.getByTestId("recipe-move-select")).toBeVisible();
}

/**
 * 全技プルダウンが**実際に選べる** move id を、表示順で返す。
 *
 * ★★`GET /api/moves` の一覧と一致しない。⇒ 入力面から外している code があるためである
 *   (`web/src/features/combo/moveSurfacing.ts` の `INPUT_EXCLUDED_MOVE_CODES`。
 *    現在は `drive_reversal` の 1 件)。
 * ★★★これを使わずに「API の最後の技」を選ぶと静かに落ちる —— `drive_reversal` は
 *   マイグレ `000109` が全キャラへ最後に入れたため `moves.id` が最大であり、
 *   `moves[moves.length - 1]` はほぼ必ずそれに当たる。にもかかわらずプルダウンには
 *   出ないので `selectOption` が該当 option を見つけられない(`M31-04` のマージで
 *   実際に `m27-02a` が落ちた)。
 * ★除外の集合が将来変わっても、本関数を経由していれば spec 側は追随不要である。
 *
 * 実装: option の value は move が数値文字列、非技ステップが `nonmove:*`、
 * 先頭のプレースホルダが空文字である。⇒ 数値のものだけを拾う。
 */
export async function selectableMoveIds(page: Page): Promise<number[]> {
  await openRecipePulldown(page);
  const values = await page
    .getByTestId("recipe-move-select")
    .locator("option")
    .evaluateAll((els) =>
      els.map((e) => (e as HTMLOptionElement).value),
    );
  return values.filter((v) => /^\d+$/.test(v)).map(Number);
}

/**
 * レシピへ 1 ステップ足す(プルダウン経路)。
 * ★手順は m19-07 / m23-09 spec に揃えてある(UI でレシピを組む先例)。
 */
export async function addRecipeStep(page: Page, moveId: number): Promise<void> {
  await openRecipePulldown(page);
  await page.getByTestId("recipe-move-select").selectOption(String(moveId));
  await page.getByTestId("recipe-add-step").click();
}

/**
 * レシピの先頭へ「技以外」のステップ(パリィドライブラッシュ)を足す。
 *
 * ★これを 1 ステップ目に置くと、始動技(レシピ先頭の *技* から自動で決まる)と
 *   1 ステップ目が食い違い、保存時にサーバが VAL-C03 の警告を返す。
 *   ⇒ 「保存は成功したが警告があるので画面に留まる」分岐へ入れる。
 *   これは「保存の成功で dirty が落ちたか」を画面から見られる唯一の経路である
 *   ——通常の保存は一覧へ自動で遷移してしまい、エディタが消えるため観測できない。
 */
export async function addNonMoveRecipeStep(page: Page): Promise<void> {
  await openRecipePulldown(page);
  await page
    .getByTestId("recipe-move-select")
    .selectOption("nonmove:parry_drive_rush");
  await page.getByTestId("recipe-add-step").click();
}

/**
 * エディタのタブを切り替える。
 * ★★M24-12: タブは幅によらず常に出る(M24-04 の「狭い幅のタブ」ではなくなった)。
 */
export async function switchEditorTab(
  page: Page,
  tab: "basic" | "recipe",
): Promise<void> {
  await page.getByTestId(`combo-editor-tab-${tab}`).click();
  await expect(page.getByTestId(`combo-editor-panel-${tab}`)).toBeVisible();
}

/**
 * レシピタブを開く。
 *
 * ★★M24-12 で幅による分岐が消え、どの幅でも 2 タブになった。既定は基本情報タブ
 *   なので、レシピ側の要素——仮想コントローラ(`recipe-tab-*` / 技ボタン)・
 *   全技プルダウン・ステップ一覧(`ol > li`)・セットプレイ節——へ触る前に必ず通す。
 * ★何度呼んでもよい(既に開いていれば選び直すだけ)。
 */
export async function openRecipeTab(page: Page): Promise<void> {
  await switchEditorTab(page, "recipe");
}

/**
 * 新規コンボ画面を開き、レシピタブまで開いた状態にする。
 *
 * ★`gotoNewComboFor` ＋ `openRecipeTab` の 2 行を各 spec へ複製しないための入口
 *   (D-553)。UI でレシピを組む spec はどれもこの 2 行から始まる。
 */
export async function gotoNewComboRecipeFor(
  page: Page,
  code: string,
): Promise<number> {
  const characterId = await gotoNewComboFor(page, code);
  await openRecipeTab(page);
  return characterId;
}

/**
 * 親コンボ 1 件とそれに紐づくセットプレイ 1 件を API で作り、セットプレイ id を返す。
 *
 * ★UI で作らないのは、見たいのが「作る手順」ではなく
 *   「セットプレイ編集画面で保存したら離れるか」だからである。
 */
export async function createSetupViaApi(
  page: Page,
  characterId: number,
  moveId: number,
  name: string,
): Promise<{ comboId: number; setupId: number }> {
  const comboRes = await page.request.post("/api/combos", {
    data: {
      characterId,
      isDraft: true,
      steps: [{ stepOrder: 1, moveId }],
    },
  });
  expect(comboRes.ok(), `コンボ作成に失敗: ${comboRes.status()}`).toBeTruthy();
  const comboId = (await comboRes.json()).id as number;

  const setupRes = await page.request.post(`/api/combos/${comboId}/setups`, {
    data: { characterId, name, steps: [{ moveId }] },
  });
  expect(setupRes.ok(), `セットプレイ作成に失敗: ${setupRes.status()}`).toBeTruthy();
  const setupId = (await setupRes.json()).id as number;

  return { comboId, setupId };
}

/**
 * ★★M24-13(CHANGE-139): レシピへ最小のステップを 1 本足して、元のタブへ戻る。
 *
 * 仮登録でもレシピのステップ 1 本以上が要るようになったため、「UI で仮登録を作って
 * 保存する」spec はレシピを 1 本置く必要がある。★各 spec が見ているものは変わらない
 * ので、下ごしらえだけをここへ寄せる(D-553)。
 *
 * ★足すのは非技ステップ(パリィドライブラッシュ)である。技を選ばないため move の
 *   解決が要らず、始動技も決まらないので VAL-C03 の警告も出ない
 *   (addNonMoveRecipeStep の注記は「技のステップと混ぜたとき」の話である)。
 *
 * @param returnTo 足したあとに開いておくタブ。既定は "basic"(多くの spec は
 *   基本情報タブで入力を続けるため)。
 */
export async function addMinimalRecipeStep(
  page: Page,
  returnTo: "basic" | "recipe" = "basic",
): Promise<void> {
  await openRecipeTab(page);
  await addNonMoveRecipeStep(page);
  await switchEditorTab(page, returnTo);
}

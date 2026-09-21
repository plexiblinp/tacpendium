import { test, expect, type Page } from "@playwright/test";

import {
  addRecipeStep,
  gotoNewComboRecipeFor,
  selectableMoveIds,
} from "./support/editor-input";

/**
 * M37-06 段 1 / 段 4: modifier の flag 欄の**縦寸法**の前後比較。
 *
 * ★★本 spec の目的は「合否」ではなく**実測値を出すこと**である(指示書 §2.4-3 / §5-6)。
 *   `M37-02` は縦の消費を減らすサブであり、flags を 7 → 11 にして縦が伸びると
 *   その成果を食う(指示書 §4.5)。⇒ 前後を同じ条件で測って報告へ出す。
 *
 * ★★★段 1(変更前)と段 4(変更後)で**同じ要素・同じ幅・同じキャラ**を測ること。
 *   計測アンカー(`modifier-flags-inline` / `modifier-flags-dialog`)は
 *   コードを 1 行も変える前に先入れしてある —— 無いと同じ要素を測れない
 *   (先例＝`M37-02` の `recipe-controller-root`)。
 *
 * ★実行は `make e2e-only P=m37-06-modifier-height`。
 *   `pnpm exec playwright test` を直接叩かないこと(`CLAUDE.md` §11 / `D-599`)。
 *
 * ★★測る面は 2 つある。**形が違うため片方だけでは判断できない**:
 *     inline … `RecipeBuilder` のステップ追加欄。`flex-wrap` の**横並び**
 *               ⇒ 増えた分は折り返して縦へ効く。
 *     dialog … `ModifiersEditor` のステップ編集ダイアログ。**縦 1 列**
 *               ⇒ 増えた分がそのまま行数になる。★危ないのはこちらである。
 */

/** 測るキャラ。★1 体でよい —— flag の欄はキャラに依存しない(技の数と無関係)。 */
const CHARACTER = "ryu";

/** 幅。★390 は狭幅で折返しが最も起きる条件、1280 は通常のデスクトップ。 */
const VIEWPORTS = [
  { name: "390x844", width: 390, height: 844 },
  { name: "1280x720", width: 1280, height: 720 },
] as const;

interface Row {
  viewport: string;
  /** `RecipeBuilder` の flag 欄(横並び・折返し)の高さ px。 */
  inline: number;
  /** `ModifiersEditor` の flag 欄(縦 1 列 or 2 列グリッド)の高さ px。 */
  dialog: number;
  /** 選択肢として描かれた flag の数。★14 値のうち常時出る分(OD 3 値は既定非表示)。 */
  inlineCount: number;
  dialogCount: number;
}

// ★`playwright.config.ts` は `workers: 1` だが、rows はモジュール状態なので直列を明示する
//   (`M37-02` と同じ理由)。
test.describe.configure({ mode: "serial" });

const rows: Row[] = [];

async function heightOf(page: Page, testId: string): Promise<number> {
  const el = page.getByTestId(testId).first();
  if ((await el.count()) === 0) return 0;
  const box = await el.boundingBox();
  return box === null ? 0 : Math.round(box.height);
}

test.describe("M37-06 modifier flag 欄の縦寸法(実測)", () => {
  for (const vp of VIEWPORTS) {
    test(`flag 欄の縦 @ ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await gotoNewComboRecipeFor(page, CHARACTER);

      // --- inline(ステップ追加欄) ---
      const ids = await selectableMoveIds(page);
      expect(ids.length, "選択できる技が 1 つも無い").toBeGreaterThan(0);

      const inlineArea = page.getByTestId("modifier-flags-inline");
      await expect(inlineArea).toBeVisible();
      const inline = await heightOf(page, "modifier-flags-inline");
      const inlineCount = await inlineArea.locator("label").count();

      // --- dialog(ステップ編集) ---
      await addRecipeStep(page, ids[0]);
      // ★`exact: true` が要る —— 既定の名前照合は部分一致であり、同じ面に在る
      //   InfoMark「編集ボタン(ステップ補足設定)の説明」を先に掴んで、
      //   ステップ編集ではなく説明ダイアログが開く(実測で踏んだ)。
      await page
        .getByRole("button", { name: "編集", exact: true })
        .first()
        .click();

      const dialogArea = page.getByTestId("modifier-flags-dialog");
      await expect(dialogArea).toBeVisible();
      const dialog = await heightOf(page, "modifier-flags-dialog");
      const dialogCount = await dialogArea.locator("label").count();

      rows.push({ viewport: vp.name, inline, dialog, inlineCount, dialogCount });

      // ★弱い不変条件だけを主張する。数値そのものを床にしない ——
      //   段 1 では「変更前の値」であり、段 4 では変わるのが正しいからである。
      expect(inline).toBeGreaterThan(0);
      expect(dialog).toBeGreaterThan(0);
      expect(inlineCount).toBe(dialogCount);
    });
  }

  test.afterAll(() => {
    const header = "viewport\tinline(px)\tdialog(px)\tinline件数\tdialog件数";
    const body = rows
      .map(
        (r) =>
          `${r.viewport}\t${r.inline}\t${r.dialog}\t${r.inlineCount}\t${r.dialogCount}`,
      )
      .join("\n");
    console.log(`\n=== M37-06 MODIFIER HEIGHT ===\n${header}\n${body}\n=== END ===\n`);
  });
});

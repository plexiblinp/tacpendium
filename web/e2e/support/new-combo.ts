import { expect, type Page } from "@playwright/test";

// M24-01 §4.4(SM-084): 新規登録の保存後の遷移先が「詳細」から「一覧」へ変わった。
//
// それまで各 spec は保存後の URL(`/combos/:id`)から作成された combo id を読んでいたが、
// 一覧へ戻るようになったため URL には id が現れない。★代わりに「一覧の一番新しい行」を
// 使ってはならない——playwright は fullyParallel: false でもファイル単位では並行に走り、
// E2E は DB を 1 本共有する(教訓 E-232)。他ファイルが作った行を掴む。
//
// ⇒ POST /api/combos の応答そのものから id を取る。これは並行実行に影響されない。
//
// ★本ファイルは spec ではない(playwright の既定 testMatch は *.spec.ts / *.test.ts のみ)。

/**
 * 新規コンボの保存を完了させ、作成された combo id を返す。
 *
 * @param save 保存を起こす操作(保存ボタンのクリック、キーボードショートカット等)。
 *             ★保存の起こし方は spec ごとに違うため、呼び出し側から渡す。
 */
export async function completeNewComboSave(
  page: Page,
  save: () => Promise<unknown>,
): Promise<number> {
  const [response] = await Promise.all([
    page.waitForResponse(
      (r) =>
        r.request().method() === "POST" &&
        new URL(r.url()).pathname === "/api/combos",
    ),
    save(),
  ]);
  const created = (await response.json()) as { id: number };
  expect(created.id, "POST /api/combos の応答に id が無い").toBeTruthy();
  // 保存後は一覧へ戻り、いま保存したコンボのキャラが対象になっている(M24-01 §4.4)。
  await expect(page).toHaveURL(/\/combos\?character_id=\d+/);
  return created.id;
}

/** 保存を完了させたうえで、作成されたコンボの詳細を開く。 */
export async function saveNewComboAndOpenDetail(
  page: Page,
  save: () => Promise<unknown>,
): Promise<number> {
  const id = await completeNewComboSave(page, save);
  await page.goto(`/combos/${id}`);
  await expect(page).toHaveURL(new RegExp(`/combos/${id}$`));
  return id;
}

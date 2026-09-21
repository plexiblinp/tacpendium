import { expect, type APIRequestContext, type Locator } from "@playwright/test";

// キャラ選択の E2E ヘルパ（M24-02 §4.3）。
//
// ★M24-02 で共有部品が native `<select>` からコンボボックスへ変わったため、
//   `selectOption()` では選べなくなった。既存 spec はここを通す。
//   （同じ数行を各 spec へ複製しない ＝ 教訓 `E-232`）
// ★spec ではないので *.spec.ts / *.test.ts 以外の名前にしてある。

/** キャラ一覧を API から取る(並び順は取得順 = サーバの ORDER BY id)。 */
export async function fetchCharacters(
  request: APIRequestContext,
): Promise<Array<{ id: number; code: string; nameJa: string; nameEn: string }>> {
  const res = await request.get("/api/games/1/characters");
  expect(res.ok(), `キャラ一覧の取得に失敗: ${res.status()}`).toBeTruthy();
  return (await res.json()).items;
}

/**
 * キャラ選択（検索欄付きコンボボックス）で 1 件選ぶ。
 *
 * ★M24-02 §4.3 で共有部品が native `<select>` からコンボボックスへ変わったため、
 *   `selectOption()` では選べなくなった。既存 spec はここを通す。
 *   （同じ数行を各 spec へ複製しない ＝ 教訓 `E-232`）
 *
 * @param trigger 対象のコンボボックス（`getByTestId(...)` などで特定して渡す）
 * @param name    選びたいキャラの表示名（`name_ja`）
 */
export async function pickCharacter(
  trigger: Locator,
  name: string,
): Promise<void> {
  const page = trigger.page();
  await trigger.click();
  // 件数が増えても探せるよう検索欄で絞ってから選ぶ。
  await page.getByPlaceholder("キャラクターを検索").fill(name);
  await page
    .getByRole("listbox")
    .getByRole("option", { name, exact: true })
    .click();
  // 単一選択は選び終わりで閉じる。
  await expect(page.getByPlaceholder("キャラクターを検索")).toHaveCount(0);
}

/**
 * キャラ選択を「キャラ code」で選ぶ。
 *
 * ★共有部品の検索欄は `name_ja` / `name_en` / `code` を対象にしているため、
 *   code をそのまま打てば 1 件に絞れる（M24-02 §4.3）。
 *   他から引っ越しのように、画面が id ではなく code で状態を持つ面の spec で使う。
 */
export async function pickCharacterByCode(
  trigger: Locator,
  code: string,
): Promise<void> {
  const page = trigger.page();
  await trigger.click();
  await page.getByPlaceholder("キャラクターを検索").fill(code);
  const options = page.getByRole("listbox").getByRole("option");
  await expect(options, `code=${code} が 1 件に絞れない`).toHaveCount(1);
  await options.first().click();
  await expect(page.getByPlaceholder("キャラクターを検索")).toHaveCount(0);
}

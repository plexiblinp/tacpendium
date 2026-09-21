import { test, expect } from "@playwright/test";

function rowNameRe(code: string): RegExp {
  const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped}\\b`);
}

// ★★【2026-09-12 更新】全キャラ +1。マイグレ `000109`(`M31-04` / SM-098)が
//   `FROM characters c` で **全キャラへ `drive_reversal` を 1 行ずつ**投入したためである。
//   ⇒ 本 spec は `M31-04` のマージ以降ずっと赤だった(同サブは E2E spec を 1 本も
//     触っておらず、全数 `make e2e` も回していなかった)。
// ★★次に「全キャラへ 1 行足すマイグレ」を書く担当へ: 本表と
//   `m14-03d-manon-seed.spec.ts` の件数、および「API 一覧の最後の技」を選ぶ spec
//   (`m27-02a`)は、いずれも +1 で静かに壊れる。⇒ 的撃ちではなく全数 `make e2e` を 1 回回すこと。
const THIRD_WAVE = [
  { code: "m_bison", moves: 89 },
  { code: "rashid", moves: 109 },
  { code: "jamie", moves: 137 },
  { code: "luke", moves: 93 },
  { code: "marisa", moves: 118 },
  { code: "jp", moves: 85 },
] as const;

test.describe("M14-03e 第三波 seed", () => {
  test("6キャラのmoves/aliasが対で入り、過長codeを画面18のスクロール領域内に収める", async ({
    page,
  }) => {
    const charsRes = await page.request.get("/api/games/1/characters");
    expect(charsRes.ok()).toBeTruthy();
    const chars = (await charsRes.json()) as {
      items: { id: number; code: string; nameJa: string }[];
    };

    for (const expected of THIRD_WAVE) {
      const character = chars.items.find((c) => c.code === expected.code);
      expect(character, `${expected.code} の characters 行`).toBeTruthy();

      const movesRes = await page.request.get(
        `/api/moves?character_id=${character!.id}`,
      );
      expect(movesRes.ok()).toBeTruthy();
      const moves = (await movesRes.json()) as {
        items: { code: string; category: string; nameJa?: string | null }[];
      };
      expect(moves.items.length).toBe(expected.moves);
      expect(
        moves.items.filter((move) => !move.nameJa).map((move) => move.code),
        `${expected.code} の official_ja_move alias 欠落`,
      ).toEqual([]);
      expect(
        moves.items.filter(
          (move) =>
            move.category === "system" &&
            [
              "forward",
              "back",
              "micro_forward",
              "micro_back",
              "dash_forward",
              "dash_back",
              "jump_neutral",
              "jump_forward",
              "jump_back",
            ].includes(move.code),
        ),
      ).toHaveLength(9);
    }

    const jamie = chars.items.find((c) => c.code === "jamie")!;
    await page.goto("/moves/edit");
    await page.getByLabel("キャラクター選択").click();
    await page.getByRole("option", { name: jamie.nameJa }).click();

    const longestCode =
      "drink_level_4_ransui_haze_3_drink_while_retreating";
    const row = page.getByRole("row", { name: rowNameRe(longestCode) });
    await expect(row).toBeVisible();
    await expect(
      row.getByRole("cell", { name: longestCode, exact: true }),
    ).toBeVisible();
    await expect(
      row.getByRole("cell", {
        name: "[酔いレベル4]乱酔旋（3段目/後退飲酒）",
        exact: true,
      }),
    ).toBeVisible();

    // Table の親 div が overflow-auto を持つため、50 字 code でもページ全体を押し広げず
    // 画面18の専用スクロール領域へ収まることを実ブラウザで確認する。
    const tableScroller = row.locator("xpath=ancestor::table/parent::div");
    await expect(tableScroller).toHaveCSS("overflow-x", "auto");
    expect(
      await tableScroller.evaluate(
        (el) => el.scrollWidth >= el.clientWidth && el.clientWidth > 0,
      ),
    ).toBeTruthy();

    // 編集可能性は値を一時変更するところまで。保存せず seed DB を汚さない。
    const recovery = row.getByLabel("硬直");
    const original = await recovery.inputValue();
    await recovery.fill("99");
    await expect(recovery).toHaveValue("99");
    await page.reload();
    await page.getByLabel("キャラクター選択").click();
    await page.getByRole("option", { name: jamie.nameJa }).click();
    await expect(
      page.getByRole("row", { name: rowNameRe(longestCode) }).getByLabel("硬直"),
    ).toHaveValue(original);
  });
});

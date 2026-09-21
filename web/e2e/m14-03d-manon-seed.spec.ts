import { test, expect } from "@playwright/test";

// M14-03d(第二波 seed = manon): 指示書 §5.2 の E2E 要件。
//   「manon の moves が画面18 で表示・編集できる(**alias が効いて生 code フォールバックが出ない**ことを含む)」
//
// 画面18(moves 編集グリッド・FR703)の表示名は `nameJa`(= preset_aliases.official_ja_move の
// alias_text を LEFT JOIN したもの)で、**alias が無い move は `—` になる**
// (web/src/features/moves/MoveEditGrid.tsx の名称セル)。したがって
// 「alias が対で入っている」ことは **名称セルに `—` が 1 つも出ない**ことで観測できる。
//
// 冪等性: 本 spec は **一切保存しない**(read-only)。入力欄の編集可能性は「値を入れて反映される」
// ところまでで確認し、保存せずに再読込して元に戻ることを確かめる。共有 seed を汚さないため、
// 何度実行しても他の spec / Go テストに影響しない。

// 行マッチ用の正規表現(moves-edit.spec.ts と同じ考え方)。グリッドの第 1 セルが raw code のため
// 行のアクセシブル名は code から始まる。`^code\b` で rush_ 版などの部分一致を防ぐ。
function rowNameRe(code: string): RegExp {
  const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped}\\b`);
}

test.describe("M14-03d 第二波 seed(manon)", () => {
  test("画面18 で manon の技が表示・編集でき、alias 欠落(生 code フォールバック)が無い", async ({
    page,
  }) => {
    // ── manon が seed されていること(000003_data_seed_characters の行) ───────
    const charsRes = await page.request.get("/api/games/1/characters");
    expect(charsRes.ok()).toBeTruthy();
    const chars = (await charsRes.json()) as {
      items: { id: number; code: string; nameJa: string }[];
    };
    const manon = chars.items.find((c) => c.code === "manon");
    expect(manon, "manon が seed されているはず(000003_data_seed_characters)").toBeTruthy();

    // ── moves が 82 件(CSV 72 + 移動 system move 9 + drive_reversal 1)で、全件に alias がある ──
    // ★★【2026-09-12 更新】81 → 82。マイグレ `000109`(`M31-04` / SM-098)が
    //   `FROM characters c` で **全キャラへ `drive_reversal` を 1 行ずつ**投入したためである。
    //   ⇒ 本 spec は `M31-04` のマージ以降ずっと赤だった(同サブは E2E spec を 1 本も
    //     触っておらず、全数 `make e2e` も回していなかった)。
    // ★内訳で書いておくこと —— 数字だけを +1 すると、次に全キャラ行が増えたとき
    //   「なぜこの数なのか」が辿れなくなる。
    const movesRes = await page.request.get(
      `/api/moves?character_id=${manon!.id}`,
    );
    expect(movesRes.ok()).toBeTruthy();
    const moves = (await movesRes.json()) as {
      items: { code: string; category: string; nameJa?: string | null }[];
    };
    expect(moves.items.length).toBe(82);

    // alias 欠落 = nameJa が欠落/空の move。1 件でもあると画面で `—` になる。
    const missingAlias = moves.items.filter((m) => !m.nameJa);
    expect(
      missingAlias.map((m) => m.code),
      "official_ja_move alias は moves と対で入っているはず",
    ).toEqual([]);

    // 移動 system move 9 種が入っていること(投入元は 000004_data_seed_moves。CSV 由来ではない)。
    for (const code of [
      "forward",
      "back",
      "micro_forward",
      "micro_back",
      "dash_forward",
      "dash_back",
      "jump_neutral",
      "jump_forward",
      "jump_back",
    ]) {
      expect(
        moves.items.some((m) => m.code === code && m.category === "system"),
        `移動 system move ${code} が manon に入っているはず`,
      ).toBeTruthy();
    }

    // ── 画面18 で manon を選択 → 技が表示される ────────────────────────────
    await page.goto("/moves/edit");
    await page.getByLabel("キャラクター選択").click();
    await page.getByRole("option", { name: manon!.nameJa }).click();

    // 代表行: reverence(レベランス)。name_ja の誤字是正(ひらがな「べ」→ カタカナ「ベ」)も
    // ここで固定する。alias が効いていれば日本語名がセルに出る。
    const row = page.getByRole("row", { name: rowNameRe("reverence") });
    await expect(row).toBeVisible();
    await expect(row.getByRole("cell", { name: "レベランス" })).toBeVisible();

    // アクセント由来の技名も生 code ではなく日本語名で出る(§4.3 の判定を UI 側で裏取り)。
    for (const [code, nameJa] of [
      ["a_terre", "ア・テール"],
      ["manege_dore_light", "弱マネージュ・ドレ"],
      ["sa2_etoile", "SA2 エトワール"],
      ["temps_lie", "タン・リエ"],
    ] as const) {
      await expect(
        page
          .getByRole("row", { name: rowNameRe(code) })
          .getByRole("cell", { name: nameJa }),
      ).toBeVisible();
    }

    // 生 code フォールバック(alias 無し = `—`)がグリッド上に 1 つも無いこと。
    await expect(page.getByRole("cell", { name: "—", exact: true })).toHaveCount(
      0,
    );

    // ── 編集できること(保存はしない = 共有 seed を汚さない) ──────────────────
    const recovery = row.getByLabel("硬直");
    await expect(recovery).toBeEnabled();
    const original = await recovery.inputValue();
    await recovery.fill("99");
    await expect(recovery).toHaveValue("99");
    await expect(row.getByRole("button", { name: "保存" })).toBeEnabled();

    // 保存せずに再読込 → 元の値へ戻る(= 本 spec は永続変更を起こしていない)。
    await page.reload();
    await page.getByLabel("キャラクター選択").click();
    await page.getByRole("option", { name: manon!.nameJa }).click();
    await expect(
      page.getByRole("row", { name: rowNameRe("reverence") }).getByLabel("硬直"),
    ).toHaveValue(original);
  });
});

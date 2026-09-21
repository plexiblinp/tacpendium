import { test, expect } from "@playwright/test";

// move_code を行マッチ用の正規表現へ埋め込む際、メタ文字をエスケープする。
// 現 seed の code は単語文字(`[a-z_]`)のみ(DES-004 §2.1 の命名規則)だが、将来 seed に
// 記号を含む code が加わっても誤マッチしないよう防御する。行末は `\b`(単語境界)で
// 区切るため、code が単語文字終端であること(= 現命名規則)に依存する点に留意。
function rowNameRe(code: string): RegExp {
  const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped}\\b`);
}

// 前提: ウィザード完了済みのローカル開発環境で実行(combo-crud.spec.ts と同じ前提)。
//
// M14-03a: 画面18(moves 編集グリッド・FR703)の E2E 回帰安全網。
// M14-02 で取込パイプライン(画面17・movesimport)を削除したため、旧 spec が編集対象 move を
// /import/moves 経由で seed する手前が失われ skip されていた。本 spec は import 非依存へ書き換え、
// **既存 seed 済みの ryu 技**(M14-03c の旧 000030 で手入力 CSV 由来へ再 seed 済み・84 技+移動 9 種)を
// 編集対象にする(move 新規作成 API は無い)。
//
// DB 前提: 対象は migrate seed により常に存在する ryu(M14-03a Plan Mode 確定。M14-03b で ken 等の
// moves も seed 済みになったが対象は ryu のまま)。combo-csv-io.spec.ts と同じ API 起点で対象行を取得する。
//
// 冪等性: 本 spec は共有 seed(ryu)の 1 技の recovery/total を永続的に書き換え、その技の rush 版を
// 1 件生成する(move を作れないため副作用は不可避)。対象は id 昇順で決まる **決め打ちの 1 技**なので
// 再実行しても同じ行を操作し、rush 版は 2 回目以降「既存」で握られる(UI が 409 を info 化・CHANGE-032)。
// 検証はトーストに依存せず GET /api/moves の最終状態を toPass で確認するため、何度実行しても通る。
// 他 E2E / Go テストはこれら特定値に依存しない(Go テストは dbtest の一時 DB で独立)。

test.describe("moves 編集グリッド(FR703)", () => {
  test("既存 seed 技を編集(recovery/total 手入力)→ 保存 → GET 反映 → ラッシュ版生成", async ({
    page,
  }) => {
    // ── ryu(常に seed されるキャラ)の id / 表示名を取得 ──────────────────
    const charsRes = await page.request.get("/api/games/1/characters");
    expect(charsRes.ok()).toBeTruthy();
    const chars = (await charsRes.json()) as {
      items: { id: number; code: string; nameJa: string }[];
    };
    const ryu = chars.items.find((c) => c.code === "ryu");
    expect(ryu, "seed で ryu が存在するはず").toBeTruthy();

    // ── ryu の技一覧を取得し、編集 + ラッシュ生成の対象を決め打ちで選ぶ ──────
    // 対象条件: category ∈ {normal, unique} かつ is_aerial=false(= isRushEligible)。
    // id 昇順の先頭を選ぶことで、再実行しても常に同じ技を操作する(冪等)。
    const movesRes = await page.request.get(
      `/api/moves?character_id=${ryu!.id}`,
    );
    expect(movesRes.ok()).toBeTruthy();
    const moves = (await movesRes.json()) as {
      items: {
        id: number;
        code: string;
        category: string;
        isAerial: boolean;
      }[];
    };
    const target = moves.items
      .filter(
        (m) =>
          !m.isAerial && (m.category === "normal" || m.category === "unique"),
      )
      .sort((a, b) => a.id - b.id)[0];
    expect(target, "ラッシュ版生成可能な ryu 技が seed に存在するはず").toBeTruthy();
    const code = target.code;
    const rushCode = `rush_${code}`;

    // ── 編集グリッドで ryu を選択 → 対象行の recovery / total を手入力 → 保存 ──
    // ★★M38-02(2026-09-17・D-892): ナビ導線を外したため、本画面へは URL 直打ちでしか
    //   着けない。⇒ 下の goto は「導線が無いので仕方なく」ではなく**仕様である**。
    //   この spec が緑であること自体が「ルートを消していない」ことの証拠になる。
    await page.goto("/moves/edit");

    // ★M38-02: ヘッダに技編集の導線が無いこと(ナビから外したのは本画面だけである)。
    //   ここで一緒に見るのは、導線の有無を見る spec を別に増やさないためである。
    await expect(page.getByRole("link", { name: "技編集" })).toHaveCount(0);
    // ★改名(M38-02)がナビへ届いていること。旧名が残っていないことも同時に見る。
    await expect(page.getByRole("link", { name: "他から引っ越し" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "引っ越し取込" })).toHaveCount(0);

    await page.getByLabel("キャラクター選択").click();
    await page.getByRole("option", { name: ryu!.nameJa }).click();

    const row = page.getByRole("row", { name: rowNameRe(code) });
    await expect(row).toBeVisible();

    // recovery(硬直・M14-01 で追加した手入力列)を NULL から設定し、total も手入力する。
    await row.getByLabel("硬直").fill("8");
    await row.getByLabel("全体").fill("25");
    await row.getByRole("button", { name: "保存" }).click();

    // ── GET /api/moves に recovery=8 / total=25 が反映されること ──────────
    await expect(async () => {
      const res = await page.request.get(`/api/moves?character_id=${ryu!.id}`);
      const list = (await res.json()) as {
        items: { code: string; total?: number | null; recovery?: number | null }[];
      };
      const m = list.items.find((x) => x.code === code);
      expect(m?.recovery).toBe(8);
      expect(m?.total).toBe(25);
    }).toPass();

    // ── ラッシュ版生成(初回のみ。既存時はボタン無効 → 生成済みを検証するのみ)──
    const rushBtn = row.getByRole("button", { name: "ラッシュ版" });
    await expect(rushBtn).toBeVisible();
    if (!(await rushBtn.isDisabled())) {
      await rushBtn.click();
    }

    // rush_<code> 行が GET に出現(category=rush_variant・originalMoveId あり)すること。
    await expect(async () => {
      const res = await page.request.get(`/api/moves?character_id=${ryu!.id}`);
      const list = (await res.json()) as {
        items: {
          code: string;
          category: string;
          originalMoveId?: number | null;
        }[];
      };
      const rush = list.items.find((x) => x.code === rushCode);
      expect(rush, "ラッシュ版 move が存在する").toBeTruthy();
      expect(rush!.category).toBe("rush_variant");
      expect(rush!.originalMoveId).toBeTruthy();
    }).toPass();

    // グリッドにも rush_variant 行が出現すること。
    await expect(
      page.getByRole("row", { name: rowNameRe(rushCode) }),
    ).toBeVisible();
  });
});

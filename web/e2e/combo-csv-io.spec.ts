import { readFileSync } from "node:fs";

import { test, expect } from "@playwright/test";

import {
  COMBO_CSV_HEADER as HEADER,
  comboCsvRow as csvRow,
  commitImport,
  deleteCombosByMemoPrefix,
  expectExportFilename,
  openExportDialog,
} from "./support/combo-io";

// ★語彙の正本は ja.json である。spec へ写さない(M29-01)。
//   `import ja from ...` は使えない —— Playwright は Vite を通らない Node ESM で
//   走るため、import attribute 無しの JSON 取込みで起動前に落ちる。
const JA = JSON.parse(
  readFileSync(new URL("../src/locales/ja.json", import.meta.url), "utf-8"),
) as { comboImport: { col: Record<string, string>; val: Record<string, string> } };
const VAL_ENUM_TEMPLATE = JA.comboImport.val["VAL-ENUM"];

// 前提: ウィザード完了済みのローカル開発環境で実行(combo-crud.spec.ts と同じ前提)。
//
// DB 前提: seed 再生成方針のため件数非依存・self-contained(SUPP §4.5)。
// ★M24-06(SM-071)で仮登録は取込対象から外れたため、取り込むコンボは **本登録
// (is_draft=false)** である。従来 仮登録を使っていた理由は VAL-C02 の重複判定を避けて
// 再実行を冪等にすることだったので、代わりに前後で fixture を掃除して冪等性を保つ
// (deleteCombosByMemoPrefix。論理削除した行は重複判定の母集団から外れる)。
// メモにユニーク値を付与し、本 spec が作成した行のみを GET /api/combos で同定する。

test.describe("コンボ CSV エクスポート/インポート(FR401/405)", () => {
  test("CSV インポート(プレビュー → 一部除外 → 実行 → レポート → 一覧反映)+ エクスポート DL", async ({
    page,
  }) => {
    const ts = Date.now();

    // ── 実在する character_code / move_code を取得(ryu の最初の技)──────────
    // ryu を使う: ryu は最古から moves seed を持つ安定基準(M14-03c の旧 000029/000030 で
    // 手入力 CSV 由来へ再 seed 済み)。M14-03b(旧 000026)で ken 等も seed 済みになったが、
    // 本 spec は特定キャラに依存せず ryu で件数非依存(>0)に確認する。
    const charsRes = await page.request.get("/api/games/1/characters");
    expect(charsRes.ok()).toBeTruthy();
    const chars = (await charsRes.json()) as {
      items: { id: number; code: string; nameJa: string }[];
    };
    const ryu = chars.items.find((c) => c.code === "ryu");
    expect(ryu, "seed で ryu が存在するはず").toBeTruthy();

    const movesRes = await page.request.get(`/api/moves?character_id=${ryu!.id}`);
    expect(movesRes.ok()).toBeTruthy();
    const moves = (await movesRes.json()) as { items: { code: string }[] };
    expect(moves.items.length, "ryu の moves seed が存在するはず").toBeGreaterThan(0);
    const moveCode = moves.items[0].code;

    const memoImport = `e2e-io-${ts}`;
    // ★取り込む行は本登録にする。M24-06(SM-071)で仮登録は取込対象から外れたため、
    //   従来の is_draft=true では 1 行も取り込めない。
    // ★従来 仮登録を使っていた理由は VAL-C02 の重複判定を避けて再実行を冪等にすること
    //   だった。代わりに前後で fixture を掃除して冪等性を保つ(retry: 1 への備え)。
    //   論理削除した行は FindActivePublishedDuplicates の母集団から外れる。
    await deleteCombosByMemoPrefix(page.request, "e2e-io-");
    const recipe = `[{"move_code":"${moveCode}","modifiers":{}}]`;

    const csv = [
      HEADER,
      csvRow({
        local_id: "x1",
        character_code: "ryu",
        is_draft: "false",
        // ★M27-02b(VAL-C15) / ★★M38-01: 本登録行が埋める欄。
        //   ★M38-01 で必須欄が 2 欄になり、**CSV が咎めるのは
        //     damage / knockdown_advantage の 2 列だけ**になった。
        //   ⇒ 消費ゲージ 2 列は余分であって害は無い。★そのまま写さないこと。
        damage: "1500",
        knockdown_advantage: "30",
        sa_gauge_consumed: "0",
        drive_gauge_consumed: "1",
        memo: memoImport,
        recipe,
      }),
      csvRow({
        local_id: "x2",
        character_code: "ryu",
        is_draft: "false",
        // ★M27-02b(VAL-C15) / ★★M38-01: 本登録行が埋める欄。
        //   ★M38-01 で必須欄が 2 欄になり、**CSV が咎めるのは
        //     damage / knockdown_advantage の 2 列だけ**になった。
        //   ⇒ 消費ゲージ 2 列は余分であって害は無い。★そのまま写さないこと。
        damage: "1500",
        knockdown_advantage: "30",
        sa_gauge_consumed: "0",
        drive_gauge_consumed: "1",
        memo: `${memoImport}-skip`,
        recipe,
      }),
    ].join("\n");

    // ── インポート画面: ファイル選択 + プレビュー ──────────────────────────
    await page.goto("/import/combo");

    // B-1: 入口一本化。セットプレイ CSV 欄はコンボ CSV 未選択時は無効(単独取込不可)。
    await expect(page.getByLabel(/セットプレイ CSV/)).toBeDisabled();

    await page.getByLabel("コンボ CSV / zip(必須)").setInputFiles({
      name: "e2e-combos.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv, "utf-8"),
    });
    // B-1: コンボ CSV を選ぶとセットプレイ欄が有効化される(添付=従属)。
    await expect(page.getByLabel(/セットプレイ CSV/)).toBeEnabled();

    await page.getByRole("button", { name: "プレビュー" }).click();

    // 2 行とも取込可能・既定で全選択。
    await expect(page.getByText(/2 行中 2 行を取込対象に選択中/)).toBeVisible();

    // B-4: local_id 列は非表示(列ヘッダが無い)。
    await expect(page.getByRole("columnheader", { name: "local_id" })).toHaveCount(0);
    // B-3: キャラは内部コード ryu ではなく表示名(nameJa)で表示される。
    await expect(
      page.getByRole("cell", { name: ryu!.nameJa, exact: true }).first(),
    ).toBeVisible();
    // B-6: 重複時は skip / セットプレイのみ取込 の 2 択。「新規追加」は廃止。
    await expect(page.getByText("新規追加")).toHaveCount(0);
    await expect(page.getByText("セットプレイのみ取込")).toBeVisible();
    await expect(page.locator('input[name="dupAction"]')).toHaveCount(2);

    // ── x2(2 行目)を除外(一部除外) ────────────────────────────────────
    await page.getByLabel("2行目を取込対象にする").click();
    await expect(page.getByText(/2 行中 1 行を取込対象に選択中/)).toBeVisible();

    // ── 取込実行(M24-06 §4.6: 確認ダイアログを通る) ──────────────────────
    await commitImport(page);

    // B-5: 完了トースト(成功/スキップ/エラー件数)。
    await expect(page.getByText(/取込完了/)).toBeVisible();

    // ── 行単位レポート(1 行目が取込) ───────────────────────────────────
    const report = page.getByLabel("取込結果");
    await expect(report).toBeVisible();
    await expect(report.getByText(/成功 1/)).toBeVisible();
    await expect(
      report.getByRole("row", { name: /取込/ }).first(),
    ).toBeVisible();

    // ── 一覧反映(GET /api/combos に memoImport のコンボが存在) ─────────────
    const listRes = await page.request.get("/api/combos?is_draft=false");
    expect(listRes.ok()).toBeTruthy();
    const list = (await listRes.json()) as { items: { memo?: string }[] };
    expect(
      list.items.some((c) => c.memo === memoImport),
      "取込んだコンボが一覧に反映される",
    ).toBeTruthy();
    // 除外した x2(memo-skip)は取り込まれていない。
    expect(
      list.items.some((c) => c.memo === `${memoImport}-skip`),
      "除外行は取り込まれない",
    ).toBeFalsy();

    // ── エクスポート: 一覧のダイアログ → zip ダウンロード ─────────────────
    // ★M24-06 で /export/combo を廃止したため、出力の入口は §5.13a のダイアログだけになった。
    await page.goto(`/combos?character_id=${ryu!.id}`);
    const dialog = await openExportDialog(page);
    const downloadPromise = page.waitForEvent("download");
    await dialog.getByRole("button", { name: "エクスポート実行" }).click();
    const download = await downloadPromise;
    // ★旧アサートは `.toContain(".zip")` だった。自動命名(SM-075)の形まで見る
    //   = 検証内容を緩めていない(M24-06 §5.2)。
    expectExportFilename(download.suggestedFilename(), { extension: "zip" });

    // ── 後始末(retry・後続 spec への持ち越しを避ける) ────────────────────
    await deleteCombosByMemoPrefix(page.request, "e2e-io-");
  });

  test("B-2: 検証エラーが日本語表示され VAL コードは折りたたみで残る", async ({
    page,
  }) => {
    const charsRes = await page.request.get("/api/games/1/characters");
    expect(charsRes.ok()).toBeTruthy();
    const chars = (await charsRes.json()) as { items: { id: number; code: string }[] };
    const ryu = chars.items.find((c) => c.code === "ryu");
    expect(ryu, "seed で ryu が存在するはず").toBeTruthy();
    const movesRes = await page.request.get(`/api/moves?character_id=${ryu!.id}`);
    const moves = (await movesRes.json()) as { items: { code: string }[] };
    const moveCode = moves.items[0].code;
    const recipe = `[{"move_code":"${moveCode}","modifiers":{}}]`;

    // opponent_size に未知値 → [VAL-ENUM] WARNING(取込可能・プレビューに出る)。
    const csv = [
      HEADER,
      csvRow({
        local_id: "b2",
        character_code: "ryu",
        is_draft: "true",
        opponent_size: "xl",
        recipe,
      }),
    ].join("\n");

    await page.goto("/import/combo");
    await page.getByLabel("コンボ CSV / zip(必須)").setInputFiles({
      name: "e2e-b2.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv, "utf-8"),
    });
    await page.getByRole("button", { name: "プレビュー" }).click();
    await expect(page.getByText(/1 行中/)).toBeVisible();

    // 日本語写像(列ラベル + 行番号)が表示される。
    //
    // ★★M29-01: 着手前は列ラベルの語そのものを spec へ直書き
    //   (`/相手の体格に未知の値があります/`)しており、語彙統一で赤くなった
    //   ＝**文言で判定していた証拠**である(M27-03 教訓 7)。
    //   ⇒ testid で掴み、**語彙に依存しない形**で主張し直した。
    //     見たいのは「列ラベルが日本語へ写像されたこと」であって、
    //     その語が何であるかではない(語の正本は ja.json であり、
    //     web/src 側の label-keys.test.ts / retired-words.test.ts が押さえる)。
    //   ★spec から ja.json を import しない —— Playwright は Vite を通らない
    //     Node ESM で動くため、import attribute 無しの JSON 取込みが落ちる。
    // ★語も文型も源泉(ja.json)から引く。★spec から `import` はしない ——
    //   Playwright は Vite を通らない Node ESM で走るため、import attribute 無しの
    //   JSON 取込みが起動前に落ちる。⇒ readFileSync + JSON.parse で読む。
    // ★行番号は fixture 依存なので固定しない。列ラベルと文型だけを源泉から作る。
    const expected = VAL_ENUM_TEMPLATE.replace(
      "{{col}}",
      JA.comboImport.col.opponent_size,
    ).split("(")[0];
    const issue = page.getByTestId("import-issue").filter({ hasText: expected });
    await expect(issue).toBeVisible();
    // ★写像されている ＝ 生の列名 `opponent_size` が表バッジに出ていない。
    await expect(issue.locator("summary")).not.toContainText("opponent_size");
    // VAL コード原文は折りたたみ(details)内に残る(サポート・レビュー用)。
    await expect(page.getByText(/\[VAL-ENUM\]/)).toBeAttached();
  });
});

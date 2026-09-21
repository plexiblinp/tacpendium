import { expect, type APIRequestContext, type Locator, type Page } from "@playwright/test";

// 取込・出力の E2E の下ごしらえ(D-553: 共通の下ごしらえは support/ へ寄せる)。
//
// ★ここへ寄せた理由: 着手時点で CSV アップロードの共通ヘルパは存在せず、
//   setInputFiles を使っているのは combo-csv-io.spec.ts の 2 か所だけだった。
//   M24-06 で取込・出力の spec が増えるため、ヘッダ定義と手順をここへ集約する。

/**
 * コンボ CSV のヘッダ(local_id を含む)。
 *
 * ★★csvcore.CSVColumns の**部分集合**である(全列ではない)——起き攻めは旧 6 列だけを
 *   持ち、M16-03 で増えた 6 列(シミー DR / 打撃重ね)は載せていない。
 *   未記載の列は optionalImportColumns 側なので取込は通る。
 * ★M27-02b: 当時の本登録の必須 4 欄が揃うよう消費ゲージ 2 列を足した
 *   (★M38-01 追補2 の時点で必須は damage / knockdown_advantage の 2 欄。列はそのまま残す)。
 * ★★M38-01(射程 3): その根拠は失効した(消費ゲージは必須から外れた)。
 *   ⇒ 列は**残す**。取込側で任意列であり、外すと往復の主張が狭まるだけである。
 */
export const COMBO_CSV_COLUMNS = [
  "local_id",
  "character_code",
  "is_draft",
  "damage",
  "drive_available_at_start",
  "sa_available_at_start",
  "drive_damage",
  "position",
  "opponent_stance",
  "hit_type",
  "opponent_size",
  "situation",
  "oki_meaty_neutral_tech_throw",
  "oki_meaty_neutral_tech_throw_dr",
  "oki_meaty_back_tech_throw",
  "oki_meaty_back_tech_throw_dr",
  "oki_shimmy_neutral_tech",
  "oki_shimmy_back_tech",
  // ★M27-02b(VAL-C15): 本登録の必須欄。消費ゲージ 2 列は csvcore の
  //   optionalImportColumns 側であり、本ヘッダには載っていなかった。
  //   ⇒ 本登録行を取り込む spec が必須検証で落ちるため足した。
  // ★★★M38-01(射程 3): **必須ではなくなった。列はそのまま残す。**
  //   ⇒ 現在の必須 2 欄＝ CSV が咎めるのも damage / knockdown_advantage の
  //     2 列であり、どちらも上の方に既に載っている(開始残量 2 列も載っている)。
  //   ★列を外すと「消費ゲージを往復できる」という主張まで消える。⇒ 残す。
  "sa_gauge_consumed",
  "drive_gauge_consumed",
  "knockdown_advantage",
  "memo",
  "tags",
  "recipe",
] as const;

export const COMBO_CSV_HEADER = COMBO_CSV_COLUMNS.join(",");

/** 1 行を RFC4180 で組み立てる(未指定の列は空セル)。 */
export function comboCsvRow(cols: Record<string, string>): string {
  return COMBO_CSV_COLUMNS.map((c) => {
    const v = cols[c] ?? "";
    if (v.includes(",") || v.includes('"') || v.includes("\n")) {
      return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
  }).join(",");
}

/** ヘッダ + 行から CSV 本文を作る(行 0 件ならヘッダだけの CSV になる)。 */
export function buildComboCsv(rows: Record<string, string>[]): string {
  return [COMBO_CSV_HEADER, ...rows.map(comboCsvRow)].join("\n");
}

/** 取込画面でコンボ CSV(または zip)を選び、プレビューまで進める。 */
export async function previewComboFile(
  page: Page,
  file: { name: string; mimeType: string; buffer: Buffer },
): Promise<void> {
  await page.goto("/import/combo");
  await page.getByLabel("コンボ CSV / zip(必須)").setInputFiles(file);
  await page.getByRole("button", { name: "プレビュー" }).click();
}

/** CSV 本文を取込画面へ流してプレビューする。 */
export async function previewComboCsv(
  page: Page,
  csv: string,
  name = "e2e-combos.csv",
): Promise<void> {
  await previewComboFile(page, {
    name,
    mimeType: "text/csv",
    buffer: Buffer.from(csv, "utf-8"),
  });
}

/**
 * 取込を実行する(M24-06 §4.6 で確認ダイアログを通るようになった)。
 * ★共有プリミティブの AlertDialog を土台にしているため role は alertdialog である。
 */
export async function commitImport(page: Page): Promise<void> {
  await page.getByRole("button", { name: "取込実行" }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "取り込む" }).click();
}

/** 一覧・マイコンボからエクスポートダイアログを開く。 */
export async function openExportDialog(page: Page): Promise<Locator> {
  await page.getByTestId("export-open-button").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  return dialog;
}

/**
 * 自動命名されたファイル名の形(SM-075・M24-06 §4.4)。
 *   combos_{all|filtered|selected|mycombo}_{件数}_{YYYYMMDD-HHmmss}[_連番].{拡張子}
 * ★連番は同一秒に 2 回出したときだけ付く。
 */
export function exportFilenamePattern(extension: string): RegExp {
  return new RegExp(
    `^combos_(all|filtered|selected|mycombo)_\\d+_\\d{8}-\\d{6}(_\\d+)?\\.${extension}$`,
  );
}

/** ファイル名が自動命名の形であり、件数セグメントが期待どおりかを確かめる。 */
export function expectExportFilename(
  filename: string,
  opts: { extension: string; count?: number },
): void {
  expect(filename).toMatch(exportFilenamePattern(opts.extension));
  if (opts.count !== undefined) {
    // ★件数は「単独 / 複数」を表していた旧ファイル名(combomgr-combo(s).pdf)の
    //   区別を引き継ぐ位置である。落とさずに明示的に確かめる。
    expect(filename.split("_")[2]).toBe(String(opts.count));
  }
}

/** memo が接頭辞で始まる本登録コンボを消す(retry で残った fixture への備え)。 */
export async function deleteCombosByMemoPrefix(
  request: APIRequestContext,
  prefix: string,
): Promise<void> {
  const res = await request.get("/api/combos?is_draft=false");
  if (!res.ok()) return;
  const body = (await res.json()) as { items: { id: number; memo?: string }[] };
  for (const c of body.items) {
    if (c.memo?.startsWith(prefix)) {
      await request.delete(`/api/combos/${c.id}`).catch(() => undefined);
    }
  }
}

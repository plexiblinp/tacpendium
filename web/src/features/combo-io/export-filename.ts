import type { ExportRange } from "./types";

// エクスポートのファイル名の自動命名(SM-075 / M24-06 §4.4・規則は D-592 で確定)。
//
//   combos_{対象の種別}_{件数}_{YYYYMMDD-HHmmss}.{拡張子}
//   例: combos_filtered_42_20260830-143512.zip
//
// ★及ぼす範囲は「外側」= 利用者がダウンロードするファイルの名前だけである。
//   ZIP の中のエントリ名(combos.csv / setups.csv)は DES-002 §7.6 の契約であり、
//   変えると「export した ZIP をそのまま受理して自動展開する」往復対称が壊れる。
//   取込側は internal/api/comboio/handler.go の switch でエントリ名を完全一致で探している。
//   ⇒ 本モジュールの出力を ZIP のエントリ名へ渡してはならない。

/**
 * 対象の種別(ExportRange の 4 値。契約は DES-002 §4.2 の GET /api/export/csv)に対応する英字。
 * ★DES-005 §5.13(エクスポート画面)は M24-06 で廃止したため参照先にしない。
 * ★日本語をファイル名に入れない(OS・ツールによって化ける)。
 * ★ワイヤ値の "filter" だけ綴りが変わる(指示書 §4.4 の例 combos_filtered_… に合わせる)。
 */
export const EXPORT_RANGE_SLUG: Record<ExportRange, string> = {
  all: "all",
  filter: "filtered",
  selected: "selected",
  mycombo: "mycombo",
};

/** 払い出し済みの名前を覚えておく上限(同一秒の衝突を見分けるためだけに使う)。 */
const ISSUED_NAME_MEMORY = 100;

export interface ExportBaseNameParams {
  range: ExportRange;
  /** 出力対象の件数。連続出力で「目的のほう」を見分ける材料(D-592)。 */
  count: number;
  /** 省略時は現在時刻。テストと破壊確認のために注入できるようにしてある。 */
  now?: Date;
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, "0");
}

/** ローカル時刻を YYYYMMDD-HHmmss にする。 */
export function formatExportTimestamp(now: Date): string {
  return (
    `${now.getFullYear()}${pad(now.getMonth() + 1, 2)}${pad(now.getDate(), 2)}` +
    `-${pad(now.getHours(), 2)}${pad(now.getMinutes(), 2)}${pad(now.getSeconds(), 2)}`
  );
}

/**
 * 拡張子を除いたベース名を組み立てる(純粋)。
 * ★拡張子は呼び出し側が付ける。ダイアログは複数形式を同時に出せるため、
 *   1 つのベース名に対して .zip / .pdf / .png がそれぞれ付く。
 */
export function formatExportBaseName({
  range,
  count,
  now = new Date(),
}: ExportBaseNameParams): string {
  return `combos_${EXPORT_RANGE_SLUG[range]}_${count}_${formatExportTimestamp(now)}`;
}

/**
 * 重複しないベース名を払い出す関数を作る。
 *
 * ★これが要る理由: 書式は秒までしか持たない。同じ秒のうちに 2 回出すと
 *   formatExportBaseName だけでは同じ名前になり、連続エクスポートで衝突する。
 *   §4.4 の核心は「連続エクスポートでファイル名が衝突しない形にすること」であり、
 *   衝突しないことは書式ではなくここで守られている。
 */
export function createExportBaseNameIssuer(): (
  params: ExportBaseNameParams,
) => string {
  // ★「直前の 1 件」ではなく払い出し済みを全部覚える。
  //   直前だけだと A → B → A の順で同じ秒に出したとき、3 回目が 1 回目と衝突する。
  const issued = new Map<string, number>();
  return (params) => {
    const base = formatExportBaseName(params);
    const count = (issued.get(base) ?? 0) + 1;
    // 名前は秒を含むため、秒が進めば古い項目が再び要求されることはない。
    // 際限なく溜めないよう上限で捨てる(同じ秒に 100 回出すことは無い)。
    if (issued.size > ISSUED_NAME_MEMORY) issued.clear();
    issued.set(base, count);
    return count === 1 ? base : `${base}_${count}`;
  };
}

/** アプリ全体で 1 つの払い出し口(同一秒の連続出力をここで見分ける)。 */
export const issueExportBaseName = createExportBaseNameIssuer();

/**
 * 利用者が書き換えたベース名を、ファイル名として使える形へ均す。
 * ★パス区切り・制御文字・Windows で使えない文字を落とす(a.download はブラウザ任せのため、
 *   環境によって黙って別名になるのを避ける)。空になったら "" を返し、呼び出し側が自動値へ倒す。
 */
export function sanitizeExportBaseName(input: string): string {
  const replaced = input
    // eslint-disable-next-line no-control-regex -- 制御文字はファイル名に入れられない
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    // 先頭・末尾のドットと空白は環境によって落ちるため自分で落とす。
    .replace(/^[.\s]+|[.\s]+$/g, "");
  // ★切り詰めで末尾に空白やドットが再び現れうるため、切ったあとにもう一度均す。
  return replaced.slice(0, 120).replace(/[.\s]+$/g, "");
}

/** ベース名へ拡張子を付ける。ベース名に "." を含めない前提を 1 か所に閉じ込める。 */
export function withExtension(baseName: string, extension: string): string {
  return `${baseName}.${extension}`;
}

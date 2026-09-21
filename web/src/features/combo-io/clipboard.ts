// FR404 クリップボード(新規): Excel/スプレッドシートへ貼り付けると「表」として展開される
// text/html(表構造)+ text/plain(TSV)を ClipboardItem で navigator.clipboard.write する。
// 列=各コンボ(複数時)/行=表示項目(DES-005 §5.8 と同方向)。setups は行として同梱(§5.13)。
// 表構造・整形は export-model を共有し、画像出力と項目選択を一致させる。

import type { Character } from "@/features/character/hooks/useCharacters";
import type { ComboDetail } from "@/features/combo/types";
import type { ExportItemKey } from "./export-items";
import {
  buildComboFields,
  buildComboHeader,
  type ExportFieldRow,
} from "./export-model";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// HTML セル値: エスケープし、改行(setups 等)は <br> へ。
function htmlValue(s: string): string {
  return escapeHtml(s).replace(/\n/g, "<br>");
}

// TSV セル値: タブ/改行はセル境界を壊すため無害化(改行は " / " に畳む)。
function tsvValue(s: string): string {
  return s.replace(/\t/g, " ").replace(/\n/g, " / ");
}

/**
 * クリップボード用 HTML(表)を生成する。
 * 単独 = 2 列(項目 | 値)、複数 = 列:各コンボ / 行:項目。
 */
export function buildClipboardHtml(
  combos: ComboDetail[],
  characters: Character[] | undefined,
  selected: ReadonlySet<ExportItemKey>,
): string {
  if (combos.length === 0) return "";
  const headers = combos.map((c) => buildComboHeader(c, characters));
  const fieldsPerCombo: ExportFieldRow[][] = combos.map((c) =>
    buildComboFields(c, characters, selected),
  );

  if (combos.length === 1) {
    const h = headers[0];
    const rows = [
      `<tr><th>コンボ</th><td>${escapeHtml(`${h.title}（${h.subtitle}）`)}</td></tr>`,
      ...fieldsPerCombo[0].map(
        (r) => `<tr><th>${escapeHtml(r.label)}</th><td>${htmlValue(r.value)}</td></tr>`,
      ),
    ].join("");
    return `<table border="1"><tbody>${rows}</tbody></table>`;
  }

  const headRow = `<tr><th></th>${headers
    .map((h) => `<th>${escapeHtml(h.title)}<br>${escapeHtml(h.subtitle)}</th>`)
    .join("")}</tr>`;
  const base = fieldsPerCombo[0];
  const bodyRows = base
    .map((r, ri) => {
      const cells = combos
        .map((_, ci) => `<td>${htmlValue(fieldsPerCombo[ci][ri]?.value ?? "-")}</td>`)
        .join("");
      return `<tr><th>${escapeHtml(r.label)}</th>${cells}</tr>`;
    })
    .join("");
  return `<table border="1"><thead>${headRow}</thead><tbody>${bodyRows}</tbody></table>`;
}

/** クリップボード用 text/plain(TSV)を生成する(HTML 非対応の貼付先のフォールバック表示)。 */
export function buildClipboardText(
  combos: ComboDetail[],
  characters: Character[] | undefined,
  selected: ReadonlySet<ExportItemKey>,
): string {
  if (combos.length === 0) return "";
  const headers = combos.map((c) => buildComboHeader(c, characters));
  const fieldsPerCombo = combos.map((c) =>
    buildComboFields(c, characters, selected),
  );

  if (combos.length === 1) {
    const h = headers[0];
    const lines = [
      `コンボ\t${tsvValue(`${h.title}（${h.subtitle}）`)}`,
      ...fieldsPerCombo[0].map((r) => `${r.label}\t${tsvValue(r.value)}`),
    ];
    return lines.join("\n");
  }

  const headLine = `\t${headers.map((h) => tsvValue(h.title)).join("\t")}`;
  const base = fieldsPerCombo[0];
  const bodyLines = base.map((r, ri) => {
    const cells = combos
      .map((_, ci) => tsvValue(fieldsPerCombo[ci][ri]?.value ?? "-"))
      .join("\t");
    return `${r.label}\t${cells}`;
  });
  return [headLine, ...bodyLines].join("\n");
}

/**
 * HTML(表)+ TSV をクリップボードへ書き込む。
 * - ClipboardItem 対応ブラウザ: text/html + text/plain を書く(貼付で表化)。
 * - 非対応/権限不可: text/plain(TSV)のみを writeText でフォールバック。
 * - いずれも不可: 例外を投げる(呼び出し側で失敗トースト)。
 */
export async function copyComboClipboard(
  html: string,
  text: string,
): Promise<void> {
  const clip =
    typeof navigator !== "undefined" ? navigator.clipboard : undefined;

  if (clip && typeof ClipboardItem !== "undefined") {
    try {
      const item = new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([text], { type: "text/plain" }),
      });
      await clip.write([item]);
      return;
    } catch {
      // 権限不可・write 非対応等 → text/plain フォールバックへ。
    }
  }

  if (clip && typeof clip.writeText === "function") {
    await clip.writeText(text);
    return;
  }

  throw new Error("このブラウザではクリップボードへの書き込みができません");
}

/**
 * プレーンテキストのみをクリップボードへ書き込む(M17-04 プロンプトのコピー用)。
 * 他から引っ越しのプロンプトは複数行のプレーンテキストで、貼付先が Web AI チャットの
 * contenteditable 入力欄のため、text/html を書くと空/整形崩れになる。text/plain だけを書く。
 * - navigator.clipboard.writeText を優先。
 * - 非セキュアコンテキスト(LAN http 等)で clipboard API が使えない場合は
 *   一時 textarea + execCommand('copy') でフォールバックする。
 * - いずれも不可なら例外を投げる(呼び出し側で失敗トースト)。
 */
export async function copyPlainText(text: string): Promise<void> {
  const clip =
    typeof navigator !== "undefined" ? navigator.clipboard : undefined;
  if (clip && typeof clip.writeText === "function") {
    try {
      await clip.writeText(text);
      return;
    } catch {
      // セキュアコンテキスト外・権限不可 → execCommand フォールバックへ。
    }
  }

  if (typeof document !== "undefined") {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      const ok = document.execCommand("copy");
      if (ok) return;
    } finally {
      ta.remove();
    }
  }

  throw new Error("このブラウザではクリップボードへの書き込みができません");
}

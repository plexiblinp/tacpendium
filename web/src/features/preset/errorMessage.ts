import { PresetApiError } from "./api";

/**
 * presetErrorMessage は API エラーを利用者向けの日本語文へ写像する。
 *
 * ★サーバーが返したメッセージを優先する。上限件数や衝突表記のような
 * 「サーバーしか知らない値」が本文に埋まっており、フロントで組み直すと
 * 値が二重管理になるためである。
 *
 * ⇒ この方針を採った結果、フロント側にエラーコード別の分岐は要らなくなった。
 * コード（`err.code`）や衝突表記（`err.conflictAliasText`）を個別に読む必要が
 * 出たときは PresetApiError から取れる。
 */
export function presetErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof PresetApiError) {
    const msg = err.serverMessage;
    if (msg && msg.trim() !== "") return msg;
  }
  return fallback;
}

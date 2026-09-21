// キーボード割当の保存（M21-05 §4.7）。
//
// ★台帳は `web/CLAUDE.md` §1 の **#9**（root `CLAUDE.md` §10.X）。台帳未記載のキーを使うことは
//   禁止事項であり、`bash scripts/check-browser-storage-keys.sh` が機械検査している。
//
// ★保持するのは **`KeyboardEvent.code`（物理位置）と表示ラベルだけ**である。DB 永続化対象の
//   ユーザー入力データ（コンボ本体・タグ・プリセットエイリアス・セットプレイ）は含まない。
//   割当は「利用者 × その PC のキーボード」で決まるため、DB へ持つと別 PC から同一 DB を
//   使ったときに他環境の割当を引く——**localStorage の粒度が用途と一致している**（#8 と同じ理由）。
//
// ★`gamepad-profiles-v1` へ相乗りしない。同レコードは `version: 1` ＋ `browserKey::padId` 鍵で
//   組まれており、`profile.ts` の `KNOWN_BUTTONS` サニタイザが**未知のキーを黙って捨てる**。
//   相乗りすると「登録できたのに次回起動で消えている」形で壊れる。

import { createLocalStorageHelper } from "@/lib/browser-storage";

import { keyLabel } from "./excludedKeys";
import {
  KEYBOARD_REGISTRATION_ORDER,
  createEmptyBindings,
  isActionTarget,
} from "./types";
import type { KeyBinding, KeyboardBindings } from "./types";

/** ★台帳 #9。`-v1` の suffix は将来の構造変更に備えたもの（`CLAUDE.md` §10.X）。 */
export const KEYBOARD_BINDINGS_STORAGE_KEY = "keyboard-bindings-v1";

const helper = createLocalStorageHelper<KeyboardBindings>(
  KEYBOARD_BINDINGS_STORAGE_KEY,
);

function sanitizeBinding(raw: unknown): KeyBinding | null {
  if (typeof raw !== "object" || raw === null) return null;
  const candidate = raw as Partial<KeyBinding>;
  if (typeof candidate.code !== "string" || candidate.code === "") return null;
  const label =
    typeof candidate.label === "string" && candidate.label !== ""
      ? candidate.label
      : keyLabel(candidate.code, "");
  return { code: candidate.code, label };
}

/**
 * 保存された値を検証して取り出す。
 *
 * ★**未知の対象名は落とす**（`KEYBOARD_REGISTRATION_ORDER` に無いものは採らない）。手で書き換えた
 *   localStorage や、将来の版で消えた対象がそのまま入ってくるのを防ぐ。
 * ★`version` が違う値は**捨てる**（キーバージョニングの方針どおり、旧データは無視する）。
 */
export function sanitizeBindings(raw: unknown): KeyboardBindings {
  if (typeof raw !== "object" || raw === null) return createEmptyBindings();
  const candidate = raw as Partial<KeyboardBindings>;
  if (candidate.version !== 1) return createEmptyBindings();

  const result = createEmptyBindings();
  const moves = (candidate.moves ?? {}) as Record<string, unknown>;
  const actions = (candidate.actions ?? {}) as Record<string, unknown>;

  for (const target of KEYBOARD_REGISTRATION_ORDER) {
    const source = isActionTarget(target) ? actions : moves;
    const binding = sanitizeBinding(source[target]);
    if (binding === null) continue;
    if (isActionTarget(target)) result.actions[target] = binding;
    else result.moves[target] = binding;
  }
  return result;
}

/** 保存済みの割当。★未保存・壊れた値は「未登録」として返す（既定を当てない）。 */
export function loadKeyboardBindings(): KeyboardBindings {
  return sanitizeBindings(helper.load());
}

/** 割当を保存する。書込に失敗しても例外は投げず false を返す。 */
export function saveKeyboardBindings(bindings: KeyboardBindings): boolean {
  return helper.save(bindings);
}

/** 割当をすべて消す（登録のやり直し用）。 */
export function clearKeyboardBindings(): void {
  helper.remove();
}

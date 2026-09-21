// キャリブレーション結果の永続化（M21-01 §4.5）。
//
// ★台帳掲載キー: web/CLAUDE.md §1 #8 `gamepad-profiles-v1`
//   （CHANGE-106 addendum = docs/change-notes/CHANGE-106-addendum-gamepad-localstorage-key.md）。
// ★専用ヘルパ経由で読み書きする。直接 localStorage を叩かない（web/CLAUDE.md §1 実装ガイドライン）。
// ★保持するのは物理 index とその読み取り方だけである。DB 永続化対象のユーザー入力データ
//   （コンボ本体・タグ・プリセットエイリアス・セットプレイ）は入れない（CLAUDE.md §10.X）。

import { createLocalStorageHelper } from "@/lib/browser-storage";

import type { GamepadProfileStore } from "./types";

export const GAMEPAD_PROFILES_STORAGE_KEY = "gamepad-profiles-v1";

const helper = createLocalStorageHelper<GamepadProfileStore>(
  GAMEPAD_PROFILES_STORAGE_KEY,
);

/**
 * 保存済みプロファイルを読む。
 * ★読めない・壊れている場合は空の store を返す（helper が try-catch 済み）。画面は壊さない。
 */
export function loadProfileStore(): GamepadProfileStore {
  const loaded = helper.load();
  if (!loaded || typeof loaded !== "object" || Array.isArray(loaded)) return {};
  return loaded;
}

/**
 * プロファイルを保存する。
 * ★戻り値は成否。保存に失敗しても例外は投げない（容量制限・プライベートブラウジング等）。
 * 呼び出し側は失敗しても操作を続行できるようにする（指示書 §5.1(k)）。
 */
export function saveProfileStore(store: GamepadProfileStore): boolean {
  return helper.save(store);
}

// 注: 全機体の登録を一括で消す用途は無い（画面の「初期化」＝当該機体のみの削除は
// useGamepadProfiles.removeProfile が withoutProfile ＋ saveProfileStore で行う）。
// 使わないヘルパは置かない。

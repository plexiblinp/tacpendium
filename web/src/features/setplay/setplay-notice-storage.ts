import { createLocalStorageHelper } from "@/lib/browser-storage";

// M19-01 §4.6.3: 制約告知の「初回のみ自動表示」フラグ。
// CLAUDE.md §10.X の公認3キー外の新規キーであり、設計担当確認(CHANGE メモ)対象。
// onboarding-seen-v1 と同じ <feature>-seen-v1 命名・boolean 保持のパターンに合わせる。
export const SETPLAY_NOTICE_STORAGE_KEY = "setplay-notice-seen-v1";
export const setplayNoticeStorage =
  createLocalStorageHelper<boolean>(SETPLAY_NOTICE_STORAGE_KEY);

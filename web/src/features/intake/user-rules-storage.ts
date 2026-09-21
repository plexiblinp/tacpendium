import { createLocalStorageHelper } from "@/lib/browser-storage";

// 他から引っ越し(§5.19)の「あなた独自のルール」自由入力欄の保存先(M17-05d (c))。
// localStorage を採用: config(TOML)は固定 struct で可変長テキスト欄が無く、足すと
// スキーマ変更=承認ゲートになるため触らない。他から引っ越しは他画面と共有しない単一画面の
// ローカル設定で、前例(onboarding-seen-v1 / combo-list-columns-v1)と同型。CLAUDE.md §10.X。
// 端末ローカルで妥当(自由ルールは個人の入力癖。LAN 越し別端末では共有されないが仕様上許容)。
export const INTAKE_USER_RULES_STORAGE_KEY = "intake-helper-user-rules-v1";
export const intakeUserRulesStorage = createLocalStorageHelper<string>(
  INTAKE_USER_RULES_STORAGE_KEY,
);

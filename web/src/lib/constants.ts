// UI 定数。

export const APP_NAME = "Tacpendium";

// 表示名長の上限(将来拡張用、暫定値)。
export const MAX_DISPLAY_NAME_LENGTH = 64;

// セットプレイ名 NULL 時のフォールバック表示文字数(SUPP-001 §2.4)。
// 詳細はコンボ詳細画面・将来のセットプレイ表示で利用する。
export const SETUP_FALLBACK_NAME_LENGTH = {
  pc: 30,
  mobile: 20,
} as const;

// 既定キャラ解決の最終フォールバック(M24-01 §4.1-2 の段 4)。
// 元はフェーズ1キャラスコープ(SUPP-001 §3.1)の「リュウ1キャラのみ運用」に由来する固定値だが、
// 現在は「どの段も値を出せなかったときの落ち先」として生きている。
//
// ★呼び出し元は features/combo/defaultCharacter.ts の 1 か所だけである。
//   画面から直接参照しないこと——参照すると「いま対象にしているキャラ」を決める規則が
//   その画面の分だけ増える(本サブが畳んだのがまさにその状態である)。
export const INITIAL_CHARACTER_ID = 1;

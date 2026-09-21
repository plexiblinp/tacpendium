// コマンド入力解決 段階2(解決表の消費)＋段階1 への一様フォールバック(M17-03、DES-004 §2.4)。
//
// 死守契約 3 点(command-resolution-request §1-1)は段階1 と同じ:
//   1. 公式表記のみ解決 — 単方向(テンキー 1〜9)とボタンだけを見る決定論ルックアップ。
//   2. モーション解析なし — 236/214/623 の列・溜めを認識しない(方向は常に 1 個)。
//   3. 出口は必ず move_code(= 当該キャラ moves から一致解決した moveId)。
//
// FE は規則を持たない(DES-002 §4.2): 正規化・特殊技優先・タイブレークは BE が畳み済みで、
// ここでは解決表 entries[token_key] を 1 回引くだけ。ミスなら段階1 の構造引きへ縮約フォールバック
// (DES-004 §2.4.5 = 方向ゾーンで経路を分けない一様規則)。すべて副作用なしの純関数。

import type { Move } from "@/features/moves/types";

import type { AttackButton, DirectionZone, Strength } from "./inputResolution";
import {
  buildNormalMoveCode,
  resolveRushByCode,
  resolveStage1MoveId,
} from "./inputResolution";

// テンキー方向(1P 側 = 右向き基準。6 = 前、4 = 後ろ)。左右反転(2P 側)は現行流儀どおり非対応。
// 段階1 の DirectionZone(3 値)は不変に保ち、本型は段階2 の入力面(9 方向)専用とする。
export type NumpadDirection = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

// 解決表(BE が畳み済みの token_key → move_code。GET /api/characters/:id/command-index の entries)。
export type CommandIndexEntries = Record<string, string>;

const STRENGTH_LETTER: Record<Strength, "L" | "M" | "H"> = {
  light: "L",
  medium: "M",
  heavy: "H",
};

const BUTTON_LETTER: Record<AttackButton, "P" | "K"> = {
  punch: "P",
  kick: "K",
};

// token_key 構築(DES-002 §4.2 の FE キー構築契約): 方向テンキー数字＋ボタン名(LP/MP/HP/LK/MK/HK)。
// ニュートラル(5)は数字なし(例: "MP")。索引の実キー(migrations/000005)と一致する表記。
export function buildTokenKey(
  dir: NumpadDirection,
  strength: Strength,
  button: AttackButton,
): string {
  const buttonName = `${STRENGTH_LETTER[strength]}${BUTTON_LETTER[button]}`;
  return dir === 5 ? buttonName : `${dir}${buttonName}`;
}

// 9 方向 → 3 ゾーン縮約(DES-004 §2.4.5): 上系 7/8/9 → up(jumping)/ 下系 1/2/3 → down(crouching)
// / 中段 4/5/6 → neutral(standing)。段階1 フォールバックの入口。
export function contractToZone(dir: NumpadDirection): DirectionZone {
  if (dir >= 7) return "up";
  if (dir <= 3) return "down";
  return "neutral";
}

// 解決結果: 確定 moveId と move_code(死守契約 3 の出口。ラッシュ解決の基底 code にも使う)。
export interface ResolvedInput {
  moveId: number;
  code: string;
}

// 一様フォールバック(DES-004 §2.4.5)。すべての「方向＋ボタン」入力が同一経路を通る:
//   (a) token_key を組む → (b) 解決表を引く → ヒット = その move_code で確定(特殊技優先は BE 畳み込みの結果)
//   → (c) ミスなら 3 ゾーンへ縮約して段階1 の構造引き(既存・不変)
//   → (d) 段階1 でもミス = null(ボタン非活性)。
// 注: entries がヒットしても moves に該当 code が無い場合(データ不整合)は (c) へ縮退する(壊れない優先)。
export function resolveDirectionalInput(
  moves: Move[],
  entries: CommandIndexEntries,
  dir: NumpadDirection,
  strength: Strength,
  button: AttackButton,
): ResolvedInput | null {
  const resolvedCode = entries[buildTokenKey(dir, strength, button)];
  if (resolvedCode !== undefined) {
    const move = moves.find((m) => m.code === resolvedCode);
    if (move) return { moveId: move.id, code: move.code };
  }
  const zone = contractToZone(dir);
  const moveId = resolveStage1MoveId(moves, zone, strength, button);
  if (moveId == null) return null;
  return { moveId, code: buildNormalMoveCode(zone, strength, button) };
}

// ラッシュ版: 上系(7/8/9 = 空中)はラッシュ不可(現行 up 無効の一般化、DES-003 §3.3)。
// それ以外は一様解決した code に rush_<元技code> を引く(既存 resolveRushByCode を流用)ため、
// 段階2 で確定した特殊技(例: collarbone_breaker)にもラッシュトグルが従来どおり働く(§3.3-7)。
export function resolveDirectionalRushInput(
  moves: Move[],
  entries: CommandIndexEntries,
  dir: NumpadDirection,
  strength: Strength,
  button: AttackButton,
): ResolvedInput | null {
  if (dir >= 7) return null;
  const base = resolveDirectionalInput(moves, entries, dir, strength, button);
  if (base == null) return null;
  const rushId = resolveRushByCode(moves, base.code);
  if (rushId == null) return null;
  return { moveId: rushId, code: `rush_${base.code}` };
}

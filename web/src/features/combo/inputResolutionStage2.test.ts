import { describe, expect, it } from "vitest";

import type { Move } from "@/features/moves/types";

import type { AttackButton, Strength } from "./inputResolution";
import { resolveRushMoveId } from "./inputResolution";
import type { CommandIndexEntries, NumpadDirection } from "./inputResolutionStage2";
import {
  buildTokenKey,
  contractToZone,
  resolveDirectionalInput,
  resolveDirectionalRushInput,
} from "./inputResolutionStage2";

// self-contained な moves フィクスチャ(seed 非依存)。ryu 相当の代表 move_code を並べる。
function move(id: number, code: string, category: string, extra: Partial<Move> = {}): Move {
  return {
    id,
    characterId: 1,
    code,
    category,
    isAerial: category === "normal" && code.startsWith("jumping_"),
    setupOnly: false,
    isDerived: false,
    ...extra,
  };
}

const MOVES: Move[] = [
  // 通常技(立ち/しゃがみ/ジャンプ × 代表)
  move(10, "standing_medium_punch", "normal"),
  move(11, "standing_heavy_punch", "normal"),
  move(12, "crouching_medium_punch", "normal"),
  move(13, "crouching_medium_kick", "normal"),
  move(14, "jumping_medium_punch", "normal", { isAerial: true }),
  move(15, "jumping_heavy_punch", "normal", { isAerial: true }),
  // 単方向特殊技(段階2 で解決表から引かれる)
  move(40, "solar_plexus_strike", "unique"),
  move(41, "collarbone_breaker", "unique"),
  // ラッシュ版(通常技・特殊技)
  move(20, "rush_standing_medium_punch", "rush_variant", { originalMoveId: 10 }),
  move(21, "rush_crouching_medium_kick", "rush_variant", { originalMoveId: 13 }),
  move(22, "rush_collarbone_breaker", "rush_variant", { originalMoveId: 41 }),
];

// ryu 相当の解決表(BE 畳み済み想定。DES-002 §4.2 のレスポンス entries 形)。
const ENTRIES: CommandIndexEntries = {
  "6HP": "solar_plexus_strike",
  "6MP": "collarbone_breaker",
  MP: "standing_medium_punch",
  "2MP": "crouching_medium_punch",
};

const ALL_DIRECTIONS: NumpadDirection[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const ALL_BUTTONS: Array<{ strength: Strength; button: AttackButton; name: string }> = [
  { strength: "light", button: "punch", name: "LP" },
  { strength: "medium", button: "punch", name: "MP" },
  { strength: "heavy", button: "punch", name: "HP" },
  { strength: "light", button: "kick", name: "LK" },
  { strength: "medium", button: "kick", name: "MK" },
  { strength: "heavy", button: "kick", name: "HK" },
];

describe("buildTokenKey", () => {
  it("9 方向 × 6 ボタンで「方向数字＋ボタン名」を組む(ニュートラル 5 は数字なし = DES-002 §4.2)", () => {
    for (const dir of ALL_DIRECTIONS) {
      for (const { strength, button, name } of ALL_BUTTONS) {
        const expected = dir === 5 ? name : `${dir}${name}`;
        expect(buildTokenKey(dir, strength, button)).toBe(expected);
      }
    }
  });

  it("ニュートラルは 5MP でなく MP(索引の実キー表記と一致)", () => {
    expect(buildTokenKey(5, "medium", "punch")).toBe("MP");
    expect(buildTokenKey(5, "heavy", "kick")).toBe("HK");
  });
});

describe("contractToZone", () => {
  it("上系 7/8/9 → up、下系 1/2/3 → down、中段 4/5/6 → neutral(DES-004 §2.4.5)", () => {
    expect(contractToZone(7)).toBe("up");
    expect(contractToZone(8)).toBe("up");
    expect(contractToZone(9)).toBe("up");
    expect(contractToZone(1)).toBe("down");
    expect(contractToZone(2)).toBe("down");
    expect(contractToZone(3)).toBe("down");
    expect(contractToZone(4)).toBe("neutral");
    expect(contractToZone(5)).toBe("neutral");
    expect(contractToZone(6)).toBe("neutral");
  });
});

describe("resolveDirectionalInput(一様フォールバック)", () => {
  it("段階2 ヒット: 前(6)＋強P → 解決表の solar_plexus_strike で確定", () => {
    expect(resolveDirectionalInput(MOVES, ENTRIES, 6, "heavy", "punch")).toEqual({
      moveId: 40,
      code: "solar_plexus_strike",
    });
  });

  it("段階2 ヒット: 前(6)＋中P → collarbone_breaker(単方向特殊技)", () => {
    expect(resolveDirectionalInput(MOVES, ENTRIES, 6, "medium", "punch")).toEqual({
      moveId: 41,
      code: "collarbone_breaker",
    });
  });

  it("段階1 フォールバック: 解決表に無い 3MK → 下系縮約で crouching_medium_kick", () => {
    expect(resolveDirectionalInput(MOVES, ENTRIES, 3, "medium", "kick")).toEqual({
      moveId: 13,
      code: "crouching_medium_kick",
    });
  });

  it("段階1 フォールバック: 斜め下 2 種(1/3)は同じ crouching へ縮約される", () => {
    const left = resolveDirectionalInput(MOVES, ENTRIES, 1, "medium", "kick");
    const right = resolveDirectionalInput(MOVES, ENTRIES, 3, "medium", "kick");
    expect(left).toEqual(right);
    expect(left?.code).toBe("crouching_medium_kick");
  });

  it("段階1 フォールバック: 後ろ(4)＋強P → 中段縮約で standing_heavy_punch", () => {
    expect(resolveDirectionalInput(MOVES, ENTRIES, 4, "heavy", "punch")).toEqual({
      moveId: 11,
      code: "standing_heavy_punch",
    });
  });

  it("空 entries(未 seed キャラ・取得失敗相当)でも段階1 だけで動く(壊れない)", () => {
    expect(resolveDirectionalInput(MOVES, {}, 5, "medium", "punch")).toEqual({
      moveId: 10,
      code: "standing_medium_punch",
    });
    expect(resolveDirectionalInput(MOVES, {}, 8, "heavy", "punch")).toEqual({
      moveId: 15,
      code: "jumping_heavy_punch",
    });
  });

  it("段階2・段階1 とも引けない場合は null(ボタン非活性・例外なし)", () => {
    expect(resolveDirectionalInput(MOVES, ENTRIES, 6, "light", "kick")).toBeNull();
    expect(resolveDirectionalInput([], ENTRIES, 6, "heavy", "punch")).toBeNull();
  });

  it("データ不整合縮退: entries ヒットだが moves に code 不在 → 段階1 へフォールバック", () => {
    const broken: CommandIndexEntries = { "2MP": "no_such_move" };
    expect(resolveDirectionalInput(MOVES, broken, 2, "medium", "punch")).toEqual({
      moveId: 12,
      code: "crouching_medium_punch",
    });
  });

  it("FE は規則を持たない: 解決表が言う code にそのまま従う(特殊技優先を再実装しない証跡)", () => {
    // BE 畳み込みの結果 2MP がある unique を指すなら、moves に crouching_medium_punch が
    // あっても表が正(FE 側で category を見て優先判定しない)。
    const table: CommandIndexEntries = { "2MP": "solar_plexus_strike" };
    expect(resolveDirectionalInput(MOVES, table, 2, "medium", "punch")).toEqual({
      moveId: 40,
      code: "solar_plexus_strike",
    });
  });
});

describe("resolveDirectionalRushInput", () => {
  it("上系(7/8/9)は空中ラッシュ不可で null", () => {
    expect(resolveDirectionalRushInput(MOVES, ENTRIES, 7, "medium", "punch")).toBeNull();
    expect(resolveDirectionalRushInput(MOVES, ENTRIES, 8, "medium", "punch")).toBeNull();
    expect(resolveDirectionalRushInput(MOVES, ENTRIES, 9, "medium", "punch")).toBeNull();
  });

  it("段階2 確定 code のラッシュ版があれば rush_<code> を返す(§3.3-7)", () => {
    expect(resolveDirectionalRushInput(MOVES, ENTRIES, 6, "medium", "punch")).toEqual({
      moveId: 22,
      code: "rush_collarbone_breaker",
    });
  });

  it("段階2 確定 code のラッシュ版が無ければ null(データ駆動非活性)", () => {
    // 6HP → solar_plexus_strike は解決するが rush_solar_plexus_strike は seed に無い。
    expect(resolveDirectionalRushInput(MOVES, ENTRIES, 6, "heavy", "punch")).toBeNull();
  });

  it("段階1 経由の code でも既存 resolveRushMoveId と同じ結果になる(現行挙動の一般化)", () => {
    // 2MK は解決表に無い → crouching_medium_kick → rush_crouching_medium_kick。
    const viaStage2 = resolveDirectionalRushInput(MOVES, ENTRIES, 2, "medium", "kick");
    const viaStage1 = resolveRushMoveId(MOVES, "down", "medium", "kick");
    expect(viaStage2?.moveId).toBe(viaStage1);
    expect(viaStage2).toEqual({ moveId: 21, code: "rush_crouching_medium_kick" });
  });

  it("基底が解決できなければ null", () => {
    expect(resolveDirectionalRushInput([], ENTRIES, 6, "medium", "punch")).toBeNull();
  });
});

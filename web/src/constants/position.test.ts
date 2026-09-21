import { describe, expect, it } from "vitest";

import { POSITION_VALUES } from "@/constants/combo-list";
import {
  MAX_POSITION_MASS,
  POSITION_BANDS,
  isValidPositionMass,
  massToPercent,
  percentToMass,
  positionFromMass,
  representativeMassOf,
} from "@/constants/position";

describe("始動位置の区分表(M28-02a)", () => {
  // ★★設計卓の検算(指示書 §2.4.1)を固定する。境界を 1 つ動かすと赤くなる。
  // ★v1.2.0 が載せていた 91〜111 / 112〜134 は開発者の入力ミスであり失効した(D-731)。
  it("境界と代表値が確定値どおり", () => {
    expect(
      POSITION_BANDS.map((b) => [
        b.code,
        b.minMass,
        b.maxMass,
        b.representativeMass,
      ]),
    ).toEqual([
      ["corner_self", 0, 25, 12],
      ["corner_self_near", 26, 47, 36],
      ["mid_self", 48, 69, 58],
      ["mid_screen", 70, 90, 80],
      ["mid_opponent", 91, 112, 102],
      ["corner_opponent_near", 113, 134, 124],
      ["corner_opponent", 135, 160, 148],
    ]);
  });

  it("並び順が表示順の正本(POSITION_VALUES)と一致する", () => {
    expect(POSITION_BANDS.map((b) => b.code)).toEqual([...POSITION_VALUES]);
  });

  it("連続しており隙間も重複も無い", () => {
    expect(POSITION_BANDS[0].minMass).toBe(0);
    expect(POSITION_BANDS[POSITION_BANDS.length - 1].maxMass).toBe(
      MAX_POSITION_MASS,
    );
    let covered = 0;
    POSITION_BANDS.forEach((b, i) => {
      expect(b.minMass).toBeLessThanOrEqual(b.maxMass);
      if (i > 0) {
        expect(b.minMass).toBe(POSITION_BANDS[i - 1].maxMass + 1);
      }
      expect(b.representativeMass).toBeGreaterThanOrEqual(b.minMass);
      expect(b.representativeMass).toBeLessThanOrEqual(b.maxMass);
      covered += b.maxMass - b.minMass + 1;
    });
    expect(covered).toBe(MAX_POSITION_MASS + 1);
  });

  // ★鏡像 mirror(x) = 160 - x が全区分で一致すること。
  //   ★代表値を丸めで計算していると、ここが必ず崩れる。
  it("左右対称である(代表値を丸めで計算していない)", () => {
    const n = POSITION_BANDS.length;
    for (let i = 0; i < n; i++) {
      const a = POSITION_BANDS[i];
      const b = POSITION_BANDS[n - 1 - i];
      expect(a.minMass).toBe(MAX_POSITION_MASS - b.maxMass);
      expect(a.representativeMass).toBe(
        MAX_POSITION_MASS - b.representativeMass,
      );
    }
  });

  it("マス数 → 区分の導出(境界値)", () => {
    const cases: ReadonlyArray<[number, string]> = [
      [0, "corner_self"],
      [25, "corner_self"],
      [26, "corner_self_near"],
      [47, "corner_self_near"],
      [48, "mid_self"],
      [69, "mid_self"],
      [70, "mid_screen"],
      [80, "mid_screen"],
      [90, "mid_screen"],
      [91, "mid_opponent"],
      [112, "mid_opponent"],
      [113, "corner_opponent_near"],
      [134, "corner_opponent_near"],
      [135, "corner_opponent"],
      [160, "corner_opponent"],
    ];
    for (const [mass, want] of cases) {
      expect(positionFromMass(mass)).toBe(want);
    }
    for (const mass of [-1, 161, 1000, 12.5]) {
      expect(positionFromMass(mass)).toBeNull();
      expect(isValidPositionMass(mass)).toBe(false);
    }
  });

  // ★チェックリスト §8-4 の破壊確認に対応する。
  it("区分 → 代表値(自分画面端は 12。13 なら丸めで計算している)", () => {
    expect(representativeMassOf("corner_self")).toBe(12);
    expect(representativeMassOf("corner_opponent")).toBe(148);
    expect(representativeMassOf("mid_screen")).toBe(80);
    expect(representativeMassOf("bogus")).toBeNull();
    expect(representativeMassOf("")).toBeNull();
  });
});

describe("マス ⇄ パーセントの変換(M28-02a §2.4.4)", () => {
  it("端点が一致する", () => {
    expect(massToPercent(0)).toBe(0);
    expect(massToPercent(160)).toBe(100);
    expect(percentToMass(0)).toBe(0);
    expect(percentToMass(100)).toBe(160);
  });

  // ★★保存する正本をマス数 1 本にした理由そのものを固定する(D-731)。
  //   端数を落とさなければ往復は不変だが、パーセントを整数へ丸めた瞬間に壊れる。
  it("★端数を保てば マス → % → マス は不変である", () => {
    for (let mass = 0; mass <= MAX_POSITION_MASS; mass++) {
      expect(percentToMass(massToPercent(mass))).toBe(mass);
    }
  });

  it("★★パーセントを整数へ丸めると往復で値が動く(だからマス数を正本にした)", () => {
    // 1% = 1.6 マス。⇒ 整数 % では 160 通りを表しきれない。
    const broken: number[] = [];
    for (let mass = 0; mass <= MAX_POSITION_MASS; mass++) {
      const roundTripped = percentToMass(Math.round(massToPercent(mass)));
      if (roundTripped !== mass) broken.push(mass);
    }
    // ★陽性対照: 実際に壊れることを示す。0 件なら前提が変わっている。
    expect(broken.length).toBeGreaterThan(0);
    // ★利用者から見ると「触っていないのに数字が動く」。
    //   ⇒ パーセントは表示・入力の補助にとどめ、保存しない。
    expect(broken).toContain(1);
  });
});

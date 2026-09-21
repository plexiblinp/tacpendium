import { describe, expect, it } from "vitest";

import {
  HIT_TYPE_VALUES,
  type HitType,
} from "./combo-list";
import {
  materializeDamageDescription,
  materializeResultToastBehavior,
  MATERIALIZE_ATTENTION_TOAST_ID,
  MATERIALIZE_RESULT_TOAST_BEHAVIOR,
  MATERIALIZE_RESULT_TOAST_ID,
  PUNISH_COUNTER_HIT_TYPES,
  PUNISH_HIT_TYPE_BY_GUARD,
  PUNISH_GUARD_TYPE_BLOCK,
  PUNISH_GUARD_TYPE_JUST_PARRY,
} from "./punish";

// ★★M27-01: hit_type が 4 → 8 値になった。確定反撃側の 2 つの集合が
//   値の追加に釣られて動いていないことを固定する。
describe("M27-01 hit_type の追加が確定反撃の写像を動かしていない", () => {
  it("★PUNISH_HIT_TYPE_BY_GUARD は名前で引いている(位置インデックスではない)", () => {
    // 着手前は HIT_TYPE_VALUES[2] / [3] と添字で引いていた。
    // ⇒ 正典配列の途中へ値を挿入すると、型検査もテストも緑のまま別の値を指す。
    expect(PUNISH_HIT_TYPE_BY_GUARD[PUNISH_GUARD_TYPE_BLOCK]).toBe(
      "punish_counter",
    );
    expect(PUNISH_HIT_TYPE_BY_GUARD[PUNISH_GUARD_TYPE_JUST_PARRY]).toBe(
      "just_parry_punish_counter",
    );
  });

  it("★★drive_impact_punish_counter は PC 版生成の対象外である", () => {
    // ★★本集合は「対象外リスト」であり、ここに無い値は **既定で生成の対象になる**。
    //   ⇒ 新しい値を足しただけでは「安全側」にならない。逆である。
    //   名前上すでにパニッシュカウンターであるものに「パニッシュカウンター版を作る」
    //   ボタンが出て実際に作れてしまうため、M27-01 で対象外へ入れた
    //   (開発者確定 2026-09-02＝「生成の対象外にするだけ入れる」)。
    expect(PUNISH_COUNTER_HIT_TYPES.has("drive_impact_punish_counter")).toBe(
      true,
    );
    // 既存 2 値は入っていること(挙動不変の確認)。
    expect(PUNISH_COUNTER_HIT_TYPES.has("punish_counter")).toBe(true);
    expect(PUNISH_COUNTER_HIT_TYPES.has("just_parry_punish_counter")).toBe(true);
    expect(PUNISH_COUNTER_HIT_TYPES.size).toBe(3);
  });

  it("★壁やられ 2 種と stun は対象外にしない(PC ではないので生成できてよい)", () => {
    for (const v of [
      "drive_impact_wall_splat_hit",
      "drive_impact_wall_splat_block",
      "stun",
    ]) {
      expect(PUNISH_COUNTER_HIT_TYPES.has(v)).toBe(false);
    }
  });

  it("正典配列は 8 値で、新しい 4 値は末尾に在る", () => {
    // ★末尾であることに意味がある —— 途中挿入は添字参照を静かに壊す形だった。
    expect(HIT_TYPE_VALUES.length).toBe(8);
    expect(HIT_TYPE_VALUES.slice(4)).toEqual([
      "drive_impact_wall_splat_hit",
      "drive_impact_wall_splat_block",
      "drive_impact_punish_counter",
      "stun",
    ] satisfies HitType[]);
  });
});

describe("materializeDamageDescription", () => {
  it("始動技ダメージの20%を加えた前提と実測調整を説明する", () => {
    const got = materializeDamageDescription(true);
    expect(got).toContain("通常版の合計ダメージ");
    expect(got).toContain("始動技ダメージの20%");
    expect(got).toContain("生成後に実測値へ調整してください");
  });

  it("既知のスキップ理由と元の値を登録したことを説明する", () => {
    const got = materializeDamageDescription(
      false,
      "starter_move_not_pc_scaled",
    );
    expect(got).toContain("Super Arts／Critical Arts は補正対象外");
    expect(got).toContain("元の値で登録しました");
    expect(got).toContain("生成後に実測値へ調整してください");
  });

  it("counter 版からの変換は元の値を使うと説明する", () => {
    const got = materializeDamageDescription(false);
    expect(got).toContain("カウンター版からの変換");
    expect(got).toContain("元の値で登録しました");
  });

  it("未知のスキップ理由を silent にせず内部コードを表示する", () => {
    const got = materializeDamageDescription(false, "future_reason");
    expect(got).toContain("未対応の理由コード: future_reason");
    expect(got).toContain("元の値で登録しました");
  });

  it("長文の生成結果は自動で消さず、閉じるボタンを出す", () => {
    expect(MATERIALIZE_RESULT_TOAST_BEHAVIOR).toEqual({
      duration: Infinity,
      closeButton: true,
      className: "materialize-result-toast",
    });
  });

  it("通常加算と counter 変換は通常 ID、加算スキップは要注意 ID へ分ける", () => {
    expect(materializeResultToastBehavior()).toEqual({
      ...MATERIALIZE_RESULT_TOAST_BEHAVIOR,
      id: MATERIALIZE_RESULT_TOAST_ID,
    });
    expect(
      materializeResultToastBehavior("starter_move_not_pc_scaled"),
    ).toEqual({
      ...MATERIALIZE_RESULT_TOAST_BEHAVIOR,
      id: MATERIALIZE_ATTENTION_TOAST_ID,
    });
    expect(materializeResultToastBehavior("future_reason")).toEqual({
      ...MATERIALIZE_RESULT_TOAST_BEHAVIOR,
      id: MATERIALIZE_ATTENTION_TOAST_ID,
    });
  });
});

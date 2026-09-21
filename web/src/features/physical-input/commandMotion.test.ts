// コマンド技入力モードの解決の仕様（M21-06 §5 の (b)〜(f)）。
//
// ★索引の値は実 seed（migrations/000005_data_seed_move_commands.up.sql）から採ってある。
//   作り物の表で通しても、実データで最長一致が必要になる形を取り逃す。

import { describe, expect, it } from "vitest";

import type { NumpadDirection } from "@/features/combo/inputResolutionStage2";

import { resolveCommandMotion } from "./commandMotion";
import type { MotionCommand } from "./commandMotion";

// ryu の実 seed から抜粋（token_key はそのまま）。
const RYU: MotionCommand[] = [
  { tokenKey: "2LP", moveCode: "crouching_light_punch" },
  { tokenKey: "2MP", moveCode: "crouching_medium_punch" },
  { tokenKey: "2HP", moveCode: "crouching_heavy_punch" },
  { tokenKey: "6MP", moveCode: "collarbone_breaker" },
  { tokenKey: "6HP", moveCode: "solar_plexus_strike" },
  { tokenKey: "236LP", moveCode: "hadoken_light" },
  { tokenKey: "236MP", moveCode: "hadoken_medium" },
  { tokenKey: "236HP", moveCode: "hadoken_heavy" },
  { tokenKey: "236P+P", moveCode: "hadoken_od" },
  { tokenKey: "236236P", moveCode: "sa1_shinku_hadoken" },
  { tokenKey: "623LP", moveCode: "shoryuken_light" },
  { tokenKey: "623MP", moveCode: "shoryuken_medium" },
  { tokenKey: "623HP", moveCode: "shoryuken_heavy" },
  { tokenKey: "214HP", moveCode: "hashogeki_heavy" },
  // ★強度を問わない token（空中竜巻）と強度指定 token（地上竜巻）が同じ方向列で共存する。
  //   実 seed そのままの形であり、ボタン具体度の同点判定が無いとどちらも入らない。
  { tokenKey: "214K", moveCode: "aerial_tatsumaki_senpu_kyaku" },
  { tokenKey: "214LK", moveCode: "tatsumaki_senpu_kyaku_light" },
  { tokenKey: "214MK", moveCode: "tatsumaki_senpu_kyaku_medium" },
  { tokenKey: "214HK", moveCode: "tatsumaki_senpu_kyaku_heavy" },
  { tokenKey: "214214P", moveCode: "sa2_shin_hashogeki_lv1" },
  // ★CA と SA3 が同一コマンド（実データ。13 キャラで同型）。
  { tokenKey: "236236K", moveCode: "ca_shin_shoryuken" },
  { tokenKey: "236236K", moveCode: "sa3_shin_shoryuken" },
  // 立ち技・マクロ（★方向部が空。モードの解決には参加しない）。
  { tokenKey: "LP", moveCode: "standing_light_punch" },
  { tokenKey: "HP", moveCode: "standing_heavy_punch" },
  { tokenKey: "HP+HK", moveCode: "drive_impact" },
  { tokenKey: "5/6LP+LK", moveCode: "throw_forward" },
];

// guile / zangief の実 seed から（溜め・一回転）。
const GUILE: MotionCommand[] = [
  { tokenKey: "[4]6LP", moveCode: "sonic_boom_light" },
  { tokenKey: "[4]6HP", moveCode: "sonic_boom_heavy" },
  { tokenKey: "[4]646HP", moveCode: "sa1_sonic_hurricane_up" },
];
const ZANGIEF: MotionCommand[] = [
  { tokenKey: "360P", moveCode: "screw_piledriver" },
  { tokenKey: "63214K", moveCode: "russian_suplex" },
];

const dirs = (s: string): NumpadDirection[] =>
  [...s].map((c) => Number(c) as NumpadDirection);

describe("resolveCommandMotion — §4.2 前方一致 ＋ 最長一致", () => {
  // §5 (b)
  it("236 ＋ 弱P が波動拳として解決する", () => {
    const got = resolveCommandMotion(RYU, dirs("236"), "light_punch");
    expect(got).toMatchObject({ status: "resolved", moveCode: "hadoken_light" });
  });

  // §5 (c) — 末尾の余りは無視する（開発者の例そのもの）。
  it("2369 ＋ 弱P も波動拳として解決する（末尾の余りを無視する）", () => {
    const got = resolveCommandMotion(RYU, dirs("2369"), "light_punch");
    expect(got).toMatchObject({ status: "resolved", moveCode: "hadoken_light" });
  });

  it("強度は区別される（236 ＋ 強P は強波動拳）", () => {
    const got = resolveCommandMotion(RYU, dirs("236"), "heavy_punch");
    expect(got).toMatchObject({ status: "resolved", moveCode: "hadoken_heavy" });
  });

  // §5 (d) — ★本サブで最も落ちやすい。
  describe("最長一致（§4.2-3）", () => {
    it("236236 ＋ 弱P は SA になる（波動拳へ落ちない）", () => {
      const got = resolveCommandMotion(RYU, dirs("236236"), "light_punch");
      expect(got).toMatchObject({
        status: "resolved",
        moveCode: "sa1_shinku_hadoken",
      });
    });

    it("強度を問わないコマンド（236236P）は任意のパンチで出る", () => {
      for (const button of [
        "light_punch",
        "medium_punch",
        "heavy_punch",
      ] as const) {
        expect(resolveCommandMotion(RYU, dirs("236236"), button)).toMatchObject({
          status: "resolved",
          moveCode: "sa1_shinku_hadoken",
        });
      }
    });

    it("236 ＋ 弱P はしゃがみ弱P（2LP）へ落ちない", () => {
      // ★方向 2 は 236 の先頭でもある。最長一致が無いと 2LP が採られる。
      const got = resolveCommandMotion(RYU, dirs("236"), "light_punch");
      expect(got).toMatchObject({ moveCode: "hadoken_light" });
    });

    it("623 ＋ 強P は昇龍拳になる（6HP へ落ちない）", () => {
      // ★方向 6 は 623 の先頭でもある。
      const got = resolveCommandMotion(RYU, dirs("623"), "heavy_punch");
      expect(got).toMatchObject({
        status: "resolved",
        moveCode: "shoryuken_heavy",
      });
    });

    it("214214 ＋ 弱P は SA2 になる（214HP 系へ落ちない）", () => {
      const got = resolveCommandMotion(RYU, dirs("214214"), "light_punch");
      expect(got).toMatchObject({
        status: "resolved",
        moveCode: "sa2_shin_hashogeki_lv1",
      });
    });

    it("方向 1 つのコマンドも解決できる（2 ＋ 中P はしゃがみ中P）", () => {
      const got = resolveCommandMotion(RYU, dirs("2"), "medium_punch");
      expect(got).toMatchObject({
        status: "resolved",
        moveCode: "crouching_medium_punch",
      });
    });
  });

  // §5 (e)
  describe("同じ長さで複数残るなら解決しない（§4.2-4）", () => {
    it("236236 ＋ K は CA と SA3 が同長で残り、解決しない", () => {
      const got = resolveCommandMotion(RYU, dirs("236236"), "heavy_kick");
      expect(got.status).toBe("unresolved");
      if (got.status !== "unresolved") throw new Error("unreachable");
      expect(got.reason).toBe("ambiguous");
      expect(got.candidates.map((c) => c.moveCode).sort()).toEqual([
        "ca_shin_shoryuken",
        "sa3_shin_shoryuken",
      ]);
    });

    it("★どちらか一方を選んで確定しない（重大 11）", () => {
      const got = resolveCommandMotion(RYU, dirs("236236"), "light_kick");
      expect(got.status).not.toBe("resolved");
    });
  });

  // §5 (f)
  describe("先頭のゴミは解決しない（§4.2-5）", () => {
    it("1236 ＋ 弱P は波動拳にしない", () => {
      const got = resolveCommandMotion(RYU, dirs("1236"), "light_punch");
      expect(got).toMatchObject({ status: "unresolved", reason: "no_match" });
    });

    it("★立ち技へも落ちない（方向部が空のコマンドは参加しない）", () => {
      // ★長さ 0 は常に前方一致するため、参加させると 1236 が standing_light_punch になる。
      const got = resolveCommandMotion(RYU, dirs("1236"), "light_punch");
      if (got.status !== "unresolved") throw new Error("解決されてしまった");
      expect(got.reason).toBe("no_match");
    });

    it("方向を 1 つも入れていない入力も解決しない", () => {
      const got = resolveCommandMotion(RYU, [], "light_punch");
      expect(got).toMatchObject({ status: "unresolved", reason: "no_match" });
    });
  });

  describe("参加しないコマンドの形（§4.4 の製造判断）", () => {
    it("OD（236P+P）は単一ボタンでは解決しない", () => {
      // 236 ＋ 弱P は 236LP が当たるため、OD 行が混ざっていないことを code で確かめる。
      const got = resolveCommandMotion(RYU, dirs("236"), "light_punch");
      expect(got).toMatchObject({ moveCode: "hadoken_light" });
    });

    it("or 記法（5/6LP+LK）は解決に参加しない", () => {
      const got = resolveCommandMotion(
        [{ tokenKey: "5/6LP+LK", moveCode: "throw_forward" }],
        dirs("5"),
        "light_punch",
      );
      expect(got).toMatchObject({ status: "unresolved", reason: "no_match" });
    });

    it("一回転（360P）は解決に参加しない", () => {
      const got = resolveCommandMotion(ZANGIEF, dirs("360"), "light_punch");
      expect(got).toMatchObject({ status: "unresolved", reason: "no_match" });
    });

    it("連鎖（MP>HP）・ホールド（2HP(hold)）は解決に参加しない", () => {
      const table: MotionCommand[] = [
        { tokenKey: "MP>HP", moveCode: "tc" },
        { tokenKey: "2HP(hold)", moveCode: "held" },
      ];
      expect(resolveCommandMotion(table, dirs("2"), "heavy_punch")).toMatchObject(
        { status: "unresolved", reason: "no_match" },
      );
    });
  });

  describe("溜め記法（★製造判断）", () => {
    it("[4]6HP は方向列 46 として解決する", () => {
      const got = resolveCommandMotion(GUILE, dirs("46"), "heavy_punch");
      expect(got).toMatchObject({
        status: "resolved",
        moveCode: "sonic_boom_heavy",
      });
    });

    it("[4]646HP も最長一致で SA が採られる", () => {
      const got = resolveCommandMotion(GUILE, dirs("4646"), "heavy_punch");
      expect(got).toMatchObject({
        status: "resolved",
        moveCode: "sa1_sonic_hurricane_up",
      });
    });

    it("保持時間は見ない（同じ方向列なら同じ結果になる）", () => {
      const a = resolveCommandMotion(GUILE, dirs("46"), "light_punch");
      const b = resolveCommandMotion(GUILE, dirs("46"), "light_punch");
      expect(a).toEqual(b);
      expect(a).toMatchObject({ moveCode: "sonic_boom_light" });
    });
  });

  // ★★開発者判断で足した規則（2026-08-14）。指示書 §4.2 には無い。
  describe("ボタン具体度の同点判定（★指示書に無い・開発者判断）", () => {
    it("★214 ＋ 弱K は地上の竜巻旋風脚になる（空中版に食われない）", () => {
      const got = resolveCommandMotion(RYU, dirs("214"), "light_kick");
      expect(got).toMatchObject({
        status: "resolved",
        moveCode: "tatsumaki_senpu_kyaku_light",
      });
    });

    it("★中K・強K も同様に地上版の各強度になる", () => {
      expect(
        resolveCommandMotion(RYU, dirs("214"), "medium_kick"),
      ).toMatchObject({ moveCode: "tatsumaki_senpu_kyaku_medium" });
      expect(resolveCommandMotion(RYU, dirs("214"), "heavy_kick")).toMatchObject(
        { moveCode: "tatsumaki_senpu_kyaku_heavy" },
      );
    });

    it("強度指定の候補が無ければ強度不問の候補が採られる（従来どおり）", () => {
      // 236236P は強度不問だけであり、絞る対象が無い。
      expect(
        resolveCommandMotion(RYU, dirs("236236"), "light_punch"),
      ).toMatchObject({ moveCode: "sa1_shinku_hadoken" });
    });

    it("★本当に同一コマンドの組は依然として解決しない（§4.2-4 は生きている）", () => {
      // CA と SA3 はどちらも 236236K（強度不問）であり、具体度で絞れない。
      const got = resolveCommandMotion(RYU, dirs("236236"), "heavy_kick");
      expect(got).toMatchObject({ status: "unresolved", reason: "ambiguous" });
    });

    it("★入力を「直して」いない——押した強度に一致するものを選ぶだけである", () => {
      // 弱K を押したのに中K の技が出ることは無い。
      const got = resolveCommandMotion(RYU, dirs("214"), "light_kick");
      if (got.status !== "resolved") throw new Error("解決しなかった");
      expect(got.moveCode).not.toBe("tatsumaki_senpu_kyaku_medium");
      expect(got.moveCode).not.toBe("tatsumaki_senpu_kyaku_heavy");
    });
  });

  it("索引が空なら解決しない（取得失敗でも壊れない＝§4.6-6）", () => {
    const got = resolveCommandMotion([], dirs("236"), "light_punch");
    expect(got).toMatchObject({ status: "unresolved", reason: "no_match" });
  });

  it("方向の並び順を持つコマンド（63214K）も解決できる", () => {
    const got = resolveCommandMotion(ZANGIEF, dirs("63214"), "light_kick");
    expect(got).toMatchObject({
      status: "resolved",
      moveCode: "russian_suplex",
    });
  });
});

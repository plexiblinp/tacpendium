// ショートカットの割当表（M21-04 §4.2′ / §4.2）。
//
// ★どのボタンにどの操作を割り当てるかは指示書 §9.2-2 で製造へ委ねられている。
//   本スイートが固定するのは「委ねられた結果として何を選んだか」と、その**設計上の制約**である。

import { describe, expect, it } from "vitest";

import { OPTIONAL_BUTTONS, ATTACK_BUTTONS } from "./types";
import {
  ACTION_LABEL,
  SHORTCUT_ASSIGNMENTS,
  SHORTCUT_FOLLOW_UP_HINT,
  SHORTCUT_PREFIX_BUTTON,
  SHORTCUT_PREFIX_TIMEOUT_MS,
  actionForFollowUp,
} from "./shortcut";
import { SIMULTANEOUS_PRESS_WINDOW_MS } from "./stepDetection";

describe("割当表", () => {
  it("★`DES-005` §6.5 の 4 操作を過不足なく持つ（並び替え＝D-358 / 確定＝D-364 で対象外）", () => {
    // ★M21-06 で 3 → 4 になった（`command_mode` を追加＝CHANGE-109）。
    //   D-370 の「3 値。増やさない」は M21-05 時点の as-built であって恒久の上限ではない。
    expect(SHORTCUT_ASSIGNMENTS.map((a) => a.action).sort()).toEqual([
      "command_mode",
      "delete",
      "modifier",
      "save",
    ]);
  });

  it("★弱P は意図的に空けてある（D-364 で確定を撤去した。空きを埋めない）", () => {
    // ★「空きがあるから何か入れる」形にしないことの主張（指示書 §4.7-1）。
    //   並び替えは対象外のままであり、埋めると本サブのスコープを越える。
    expect(actionForFollowUp("light_punch")).toBeNull();
  });

  it("★後続ボタンは攻撃 6 ボタンから選ぶ（既に登録済みであり、登録の増分を増やさない）", () => {
    for (const { button } of SHORTCUT_ASSIGNMENTS) {
      expect(ATTACK_BUTTONS).toContain(button);
    }
  });

  it("★後続ボタンが重複していない（1 ボタンが 2 操作を起こさない）", () => {
    const buttons = SHORTCUT_ASSIGNMENTS.map((a) => a.button);
    expect(new Set(buttons).size).toBe(buttons.length);
  });

  it("★削除だけキック段の端へ離してある（誤爆の被害が最も大きい操作＝§4.2-2）", () => {
    const deleteButton = SHORTCUT_ASSIGNMENTS.find(
      (a) => a.action === "delete",
    )?.button;
    expect(deleteButton).toBe("heavy_kick");

    // ★M21-06 が足した `command_mode` は**弱K**である（中K ではない）。
    //   中K に置くと削除（強K）の隣になり、押し間違いが削除へ落ちる確率を上げる。
    //   ⇒ キック段の反対の端へ置いた。
    expect(actionForFollowUp("medium_kick")).toBeNull();
    expect(actionForFollowUp("light_kick")).toBe("command_mode");

    // 削除・モード以外はパンチ段に固めてある。
    for (const { button, action } of SHORTCUT_ASSIGNMENTS) {
      if (action === "delete" || action === "command_mode") continue;
      expect(button.endsWith("_punch")).toBe(true);
    }
  });

  it("割り当てていないボタンは操作を起こさない", () => {
    expect(actionForFollowUp("light_punch")).toBeNull(); // D-364 で空けた
    expect(actionForFollowUp("medium_kick")).toBeNull();
    expect(actionForFollowUp("direction_6")).toBeNull();
    expect(actionForFollowUp("drive_impact")).toBeNull();
  });

  it("割り当てたボタンは対応する操作を返す", () => {
    expect(actionForFollowUp("medium_punch")).toBe("modifier");
    expect(actionForFollowUp("heavy_punch")).toBe("save");
    expect(actionForFollowUp("heavy_kick")).toBe("delete");
    expect(actionForFollowUp("light_kick")).toBe("command_mode");
  });
});

describe("前置きボタン", () => {
  it("★マクロ（DI / DP / 投げ）とは別物である——技のボタンを潰さない", () => {
    expect(OPTIONAL_BUTTONS).not.toContain(SHORTCUT_PREFIX_BUTTON);
  });

  it("★前置きのタイムアウトは同時押しの判定窓とは無関係の別値である", () => {
    // 混同して判定窓と同じ値にすると、前置きが実質使えなくなる（90ms で抜けてしまう）。
    expect(SHORTCUT_PREFIX_TIMEOUT_MS).toBeGreaterThan(
      SIMULTANEOUS_PRESS_WINDOW_MS * 10,
    );
  });
});

describe("案内文", () => {
  it("★割当表から生成する（案内用の第 2 の表を持たない＝E-76）", () => {
    for (const { action } of SHORTCUT_ASSIGNMENTS) {
      expect(SHORTCUT_FOLLOW_UP_HINT).toContain(ACTION_LABEL[action]);
    }
    // ボタン名も既存のラベル表から引いている。
    expect(SHORTCUT_FOLLOW_UP_HINT).toContain("強キック=削除");
  });
});

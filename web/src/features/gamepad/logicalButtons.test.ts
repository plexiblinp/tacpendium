import { describe, expect, it } from "vitest";

import {
  CALIBRATION_ORDER,
  OPTIONAL_TARGETS,
  REQUIRED_TARGETS,
  calibrationTargetLabel,
} from "./logicalButtons";
import { OPTIONAL_BUTTONS } from "./types";

describe("キャリブレーションの対象集合", () => {
  it("必須は方向 4 ＋ 攻撃 6 の 10 件", () => {
    expect(REQUIRED_TARGETS).toHaveLength(10);
  });

  it("★マクロは 1 ボタンで出せる 3 件だけ（DI / DP / 投げ）", () => {
    expect(OPTIONAL_BUTTONS).toEqual(["drive_impact", "drive_parry", "throw"]);
  });

  it("★任意区間はマクロ 3 ＋ ショートカット前置き 1 の 4 件（M21-04）", () => {
    // M21-04 で操作用ボタンが 1 件加わった。★マクロ自体は 3 件のままである（上のテスト）。
    expect(OPTIONAL_TARGETS).toEqual([
      "drive_impact",
      "drive_parry",
      "throw",
      "shortcut_prefix",
    ]);
  });

  it("★1 ボタンでは出せない入力を案内順に含めない", () => {
    // 前投げ / 後ろ投げ（方向 ＋ 投げ）、前後ステップ（方向 2 回）、ラッシュ（中P+中K のあと 6）。
    // 設定に出すこと自体が無意味であるため対象から外している（2026-08-13 開発者判断）。
    for (const excluded of [
      "throw_forward",
      "throw_back",
      "dash_forward",
      "dash_back",
      "parry_drive_rush",
      // ★M21-04 は「1 ボタン ＝ 1 操作」を採らなかった（D-358 で前置き方式へ確定）ため、
      //   この 2 件には物理バインディングを与えていない。登録するのは前置き 1 件だけである。
      "step_commit",
      "step_delete",
    ]) {
      expect(CALIBRATION_ORDER).not.toContain(excluded);
    }
  });

  it("案内順は必須 10 → 任意 4 の計 14 件", () => {
    // ★M21-04 で 13 → 14（`DES-005` §6.3.2 の件数が動く＝`CHANGE-108` の反映材料）。
    expect(CALIBRATION_ORDER).toHaveLength(14);
  });
});

describe("方向のラベル", () => {
  it("★前／後ろではなく左／右で案内する", () => {
    // 前／後ろは 1P 側を向いているときだけ成り立つ相対的な呼び方であり、
    // いま押す物理ボタンを指す語としては曖昧なため（2026-08-13 開発者判断）。
    expect(calibrationTargetLabel("left")).toBe("左");
    expect(calibrationTargetLabel("right")).toBe("右");
    expect(calibrationTargetLabel("up")).toBe("上");
    expect(calibrationTargetLabel("down")).toBe("下");
  });
});

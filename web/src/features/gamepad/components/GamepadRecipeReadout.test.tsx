import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { UnresolvedReason } from "@/features/gamepad/recipeInputResolution";
import type { ReadoutEntry } from "@/features/physical-input/usePhysicalRecipeInput";

import GamepadRecipeReadout from "./GamepadRecipeReadout";

// M37-02 / B11 の非退行（指示書 §5-4 / チェックリスト D-1・D-2）。
//
// ★★★`DES-005` §6.4.3 は 3 区画〔押している入力 / 確定したステップ /
//   解決できなかった入力〕を**設計要件**として名指ししている。B11 で情報量を減らす際に
//   これらを消していないことを、区画の外側から見る。
//
// ★★解決できなかった理由の **6 値**が消えていないことも見る。とくに
//   `rush_not_available_in_air` を `move_not_found` へ丸めないこと ——
//   `DES-005` §6.4.3 が「最後の 1 つを『技が無い』へ丸めないこと」と明記しており、
//   理由文は `CHANGE-111` 経由で設計書へ写るためである。

/**
 * 解決できなかった理由の全数と、**期待する理由文**。
 *
 * ★★★実装の `UNRESOLVED_LABEL` を import しないこと。import すると
 *   「実装が実装と一致する」ことしか言えず、文言が丸められても緑のままになる。
 *   ⇒ ここは `DES-005` §6.4.3 が要求する 6 理由を**独立に書き写した対照表**である。
 *
 * ★とくに `rush_not_available_in_air` は `move_not_found` へ丸めないことが
 *   設計要件として名指しされている（同§「★最後の 1 つを『技が無い』へ丸めないこと」）。
 */
const EXPECTED_REASON_TEXT: Record<UnresolvedReason, string> = {
  od_not_supported:
    "同じ種類のボタン 2 つ（OD）は、物理コントローラからは入れられません。必殺技タブから選んでください",
  mixed_strength: "強度の違うボタンの同時押しは技を特定できません",
  too_many_buttons: "3 つ以上の同時押しは技を特定できません",
  unknown_combination: "この組み合わせに対応する操作がありません",
  move_not_found: "このキャラクターに該当する技がありません",
  rush_not_available_in_air: "ラッシュ版は空中では出せません",
};

const ALL_UNRESOLVED_REASONS = Object.keys(
  EXPECTED_REASON_TEXT,
) as UnresolvedReason[];

function unresolvedEntry(reason: UnresolvedReason, index: number): ReadoutEntry {
  return {
    key: `k${index}`,
    candidate: {
      direction: "direction_neutral",
      buttons: ["light_punch"],
      startedAt: 0,
      closedAt: 0,
      mergedCount: 1,
    },
    resolution: {
      status: "unresolved",
      reason,
      buttons: ["light_punch"],
      direction: 5,
    },
  };
}

function renderReadout(unresolved: ReadoutEntry[] = []) {
  return render(
    <GamepadRecipeReadout
      held={{ direction: "direction_neutral", buttons: [] }}
      resolved={[]}
      unresolved={unresolved}
      moves={[]}
      active={true}
      shortcut={{ active: false, available: false }}
      lastAction={null}
      commandMode={{ active: false, directions: [] }}
      commandModeAvailable={false}
      motionReadout={[]}
    />,
  );
}

describe("M37-02 B11: DES-005 §6.4.3 の 3 区画が残っている", () => {
  it("★押している入力 / 確定したステップ / 解決できなかった入力 の 3 区画が出る", () => {
    renderReadout();

    expect(screen.getByTestId("recipe-gamepad-readout-held")).toBeTruthy();
    expect(screen.getByTestId("recipe-gamepad-readout-resolved")).toBeTruthy();
    expect(screen.getByTestId("recipe-gamepad-readout-unresolved")).toBeTruthy();
  });
});

describe("M37-02 B11: 解決できなかった理由 6 値が消えていない", () => {
  // ★母数を先に固定する。片方だけ増減したら落ちる。
  it("★理由は 6 値である", () => {
    expect(ALL_UNRESOLVED_REASONS).toHaveLength(6);
  });

  for (const reason of ALL_UNRESOLVED_REASONS) {
    it(`★${reason} に固有の理由文が出る`, () => {
      renderReadout([unresolvedEntry(reason, 0)]);

      const pane = screen.getByTestId("recipe-gamepad-readout-unresolved");
      // ★★理由文そのものを見る。空表示や `undefined` では通らない。
      expect(pane.textContent).toContain(EXPECTED_REASON_TEXT[reason]);
    });
  }

  it("★★6 理由がすべて互いに異なる（丸めていないことの対照）", () => {
    const texts = ALL_UNRESOLVED_REASONS.map((r) => {
      const { unmount } = renderReadout([unresolvedEntry(r, 0)]);
      const text =
        screen.getByTestId("recipe-gamepad-readout-unresolved").textContent ??
        "";
      unmount();
      return text;
    });
    // ★とくに rush_not_available_in_air を move_not_found へ丸めていないこと
    //   （DES-005 §6.4.3 が名指しで禁じている）。
    expect(new Set(texts).size).toBe(ALL_UNRESOLVED_REASONS.length);
  });

  it("★★空のときは理由文が 1 つも出ない（上の検査が空振りでないことの対照）", () => {
    renderReadout([]);
    const pane = screen.getByTestId("recipe-gamepad-readout-unresolved");
    for (const reason of ALL_UNRESOLVED_REASONS) {
      expect(pane.textContent).not.toContain(EXPECTED_REASON_TEXT[reason]);
    }
  });
});

describe("M37-02 B11: 畳んだのは案内文だけであり状態は残っている", () => {
  it("★ショートカット未登録は「未登録」として出続ける（区画ごと消していない）", () => {
    renderReadout();
    expect(
      screen.getByTestId("recipe-gamepad-readout-shortcut").textContent,
    ).toContain("未登録");
  });

  it("★コマンド表未取得は状態として出続ける（区画ごと消していない）", () => {
    renderReadout();
    expect(
      screen.getByTestId("recipe-gamepad-readout-command").textContent,
    ).toContain("取得できていない");
  });
});

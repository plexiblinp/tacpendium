import { describe, expect, it } from "vitest";

import {
  OKI_NO_GAUGE_LABEL,
  OKI_OPTION_SPECS,
  OKI_USES_DR_LABEL,
  okiOptionLabel,
} from "./oki";

// M24-03 §4.5(SM-097): ノーゲージ版の起き攻めオプションに「ノーゲージ」を付ける。
//
// ★本テストは破壊確認 4 の赤経路である——okiOptionLabel の付与を外すと落ちる。
describe("okiOptionLabel のゲージ区分ラベル(M24-03 §4.5 / SM-097)", () => {
  it("ノーゲージ版に「・ノーゲージ」が付く", () => {
    expect(
      okiOptionLabel({
        attackType: "throw_meaty",
        techType: "neutral_tech",
        usesDr: false,
      }),
    ).toBe(`投げ重ね(その場受け身・${OKI_NO_GAUGE_LABEL})`);
  });

  it("ドライブラッシュ版は従来どおり「・ドライブラッシュ」のまま", () => {
    expect(
      okiOptionLabel({
        attackType: "shimmy",
        techType: "back_tech",
        usesDr: true,
      }),
    ).toBe(`シミー(後ろ受け身・${OKI_USES_DR_LABEL})`);
  });

  it("★12 変種すべてがゲージ区分を名乗る(どちらか一方が必ず付く)", () => {
    // ★母集合は 12 変種のまま。数ではなく「定義した全 spec が名乗る」形で見る
    //   (M24-01 §7-8: 表示項目数のベタ書きを避ける)。
    for (const spec of OKI_OPTION_SPECS) {
      const label = okiOptionLabel(spec);
      const named = spec.usesDr ? OKI_USES_DR_LABEL : OKI_NO_GAUGE_LABEL;
      expect(label, `${JSON.stringify(spec)} のラベルが区分を名乗っていない`).toContain(
        `・${named}`,
      );
    }
  });

  it("★ノーゲージ版とドライブラッシュ版のラベルが衝突しない", () => {
    // ★M24-07: okiOptionLabel は第 2 引数に文言の解決関数を取るようになった。
    //   point-free の .map(okiOptionLabel) は index を解決関数として渡してしまう。
    const labels = OKI_OPTION_SPECS.map((o) => okiOptionLabel(o));
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("未知のコード値はそのまま出す(フォールバックは不変)", () => {
    expect(
      okiOptionLabel({ attackType: "unknown", techType: "mystery", usesDr: false }),
    ).toBe(`unknown(mystery・${OKI_NO_GAUGE_LABEL})`);
  });
});

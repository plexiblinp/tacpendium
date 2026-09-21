import { describe, expect, it } from "vitest";

import { jaLabel } from "./ja-label";

// ★本ヘルパは「i18n を通らない画面へ日本語を配る」唯一の経路である。
//   ここが壊れると、直書き画面のラベルが静かにキー文字列になる。
describe("jaLabel", () => {
  it("ドット区切りのキーを ja.json から引く", () => {
    expect(jaLabel("situation.position.mid_screen")).toBe("画面中央");
    expect(jaLabel("oki.usesDr")).toBe("ドライブラッシュ");
    expect(jaLabel("oki.noGauge")).toBe("ノーゲージ");
  });

  it("未定義のキーはキーをそのまま返す(隠さない)", () => {
    expect(jaLabel("situation.position.no_such_value")).toBe(
      "situation.position.no_such_value",
    );
    expect(jaLabel("no.such.namespace")).toBe("no.such.namespace");
  });

  it("{{name}} 形式の補間を行う(i18next と同じ形)", () => {
    expect(jaLabel("tag.selector.createNew", { name: "コンボ" })).toBe(
      "「コンボ」を新規作成",
    );
  });

  it("未指定の変数はそのまま残す(欠落を隠さない)", () => {
    expect(jaLabel("tag.selector.createNew", {})).toBe("「{{name}}」を新規作成");
  });

  it("葉ではなく中間ノードを指したときもキーを返す", () => {
    expect(jaLabel("situation.position")).toBe("situation.position");
  });
});

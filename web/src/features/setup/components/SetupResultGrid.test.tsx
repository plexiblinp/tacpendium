import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SetupResultGrid, hasAnyResult, noteOf, resultStateOf } from "./SetupResultGrid";
import type { SetupResultCell } from "../types";
import { OKI_TECH_TYPE_LABEL_KEYS } from "@/constants/oki";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const results: SetupResultCell[] = [
  { setupId: 1, techType: "neutral_tech", inCorner: false, result: "ok" },
  { setupId: 1, techType: "back_tech", inCorner: false, result: "ng", note: "後ろ受け身では届かない" },
  { setupId: 1, techType: "neutral_tech", inCorner: true, result: "ok" },
  // (back_tech, inCorner=true) は行が無い = 未検証
];

describe("SetupResultGrid", () => {
  it("三値(成立/不成立/未検証)を区別して描画する", () => {
    render(<SetupResultGrid results={results} />);

    const stateOf = (key: string) =>
      screen.getByTestId(`setup-result-cell-${key}`).getAttribute("data-state");

    expect(stateOf("neutral_tech:false")).toBe("ok");
    expect(stateOf("back_tech:false")).toBe("ng");
    expect(stateOf("neutral_tech:true")).toBe("ok");
    // 行が無いセルは未検証として描かれる(NULL 行ではなく「行なし」で表現)。
    expect(stateOf("back_tech:true")).toBe("unverified");
  });

  it("記号直書きではなくアイコンで描かれる", () => {
    const { container } = render(<SetupResultGrid results={results} />);

    // lucide-react の svg アイコンが使われている。
    expect(screen.getAllByTestId("setup-result-icon-ok").length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("setup-result-icon-ng").length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("setup-result-icon-unverified").length).toBeGreaterThan(0);
    expect(container.querySelectorAll("svg").length).toBeGreaterThan(0);

    // 日本語圏の記号を直接埋め込んでいない(i18n サーフェスとして扱う)。
    expect(container.textContent).not.toContain("○");
    expect(container.textContent).not.toContain("×");
    expect(container.textContent).not.toContain("—");
  });

  it("凡例を近くに置く", () => {
    render(<SetupResultGrid results={results} />);
    expect(screen.getByTestId("setup-result-legend")).toBeTruthy();
  });

  it("全 4 セルが未検証なら要素自体を出さない(hidden-when-empty)", () => {
    const { container } = render(<SetupResultGrid results={[]} />);
    expect(screen.queryByTestId("setup-result-grid")).toBeNull();
    expect(container.innerHTML).toBe("");
  });

  it("results 未定義でも要素を出さない", () => {
    render(<SetupResultGrid />);
    expect(screen.queryByTestId("setup-result-grid")).toBeNull();
  });

  it("1 セルでも検証済みなら表示する", () => {
    render(
      <SetupResultGrid
        results={[{ setupId: 1, techType: "back_tech", inCorner: true, result: "ng" }]}
      />,
    );
    expect(screen.getByTestId("setup-result-grid")).toBeTruthy();
  });

  it("4 セルの集計を出さない", () => {
    const { container } = render(<SetupResultGrid results={results} />);
    // 「n 条件中 m 条件で成立」のような集計表現・分数表記が無いこと。
    expect(container.textContent).not.toMatch(/\d\s*\/\s*4/);
    expect(container.textContent).not.toMatch(/[0-4]\s*条件/);
    expect(container.textContent).not.toContain("setupResult.summary");
  });

  it("note があるセルに印を出す", () => {
    render(<SetupResultGrid results={results} />);
    const ngCell = screen.getByTestId("setup-result-cell-back_tech:false");
    expect(ngCell.getAttribute("title")).toBe("後ろ受け身では届かない");
    expect(screen.getAllByTestId("setup-result-note-mark").length).toBe(1);
  });

  it("受け身種別のラベルは既存 SSOT(OKI_TECH_TYPE_LABEL_KEYS)を使う", () => {
    render(<SetupResultGrid results={results} />);
    // ★M24-07: 正典は「値 → i18n キー」の対応表になった。第 3 の語彙を作っていない
    //   ことは「同じキーを引いていること」で示す(t はモックでキーを返す)。
    expect(screen.getByText(OKI_TECH_TYPE_LABEL_KEYS.neutral_tech)).toBeTruthy();
    expect(screen.getByText(OKI_TECH_TYPE_LABEL_KEYS.back_tech)).toBeTruthy();
  });
});

describe("resultStateOf / noteOf / hasAnyResult", () => {
  it("行が無ければ未検証を返す", () => {
    expect(resultStateOf(results, "back_tech", true)).toBe("unverified");
    expect(resultStateOf(undefined, "neutral_tech", false)).toBe("unverified");
    expect(resultStateOf([], "neutral_tech", false)).toBe("unverified");
  });

  it("行があれば result を返す", () => {
    expect(resultStateOf(results, "neutral_tech", false)).toBe("ok");
    expect(resultStateOf(results, "back_tech", false)).toBe("ng");
  });

  it("端の真偽を取り違えない", () => {
    expect(resultStateOf(results, "neutral_tech", true)).toBe("ok");
    expect(resultStateOf(results, "back_tech", true)).toBe("unverified");
  });

  it("note はセル単位で引ける", () => {
    expect(noteOf(results, "back_tech", false)).toBe("後ろ受け身では届かない");
    expect(noteOf(results, "neutral_tech", false)).toBeNull();
    expect(noteOf(results, "back_tech", true)).toBeNull();
  });

  it("hasAnyResult は 1 セルでも検証済みなら true", () => {
    expect(hasAnyResult(results)).toBe(true);
    expect(hasAnyResult([])).toBe(false);
    expect(hasAnyResult(undefined)).toBe(false);
  });
});

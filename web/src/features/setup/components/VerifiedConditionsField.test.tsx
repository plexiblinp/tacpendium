import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { VerifiedConditionsField } from "./VerifiedConditionsField";
import type { SetupResultCondition } from "../types";
import { OKI_TECH_TYPE_LABEL_KEYS } from "@/constants/oki";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// ★M19-07: 親が未発番の面で使う「確認できた条件」のステージング入力。
// 最重要は「既定が全セル未チェック」と「即時保存しない」の 2 点
// (DES-005 §5.6 の v3 原則。即時保存は M19-01 の再発になる)。

const PREFIX = "test-confirmed";
const cellId = (key: string) => `${PREFIX}-${key}`;
const ALL_CELLS = [
  "neutral_tech:false",
  "neutral_tech:true",
  "back_tech:false",
  "back_tech:true",
];

function checkbox(key: string): HTMLInputElement {
  return screen.getByTestId(cellId(key)) as HTMLInputElement;
}

describe("VerifiedConditionsField", () => {
  it("受け身種別 × 画面端の 2×2 = 4 セルを出す(セルの組は SETUP_RESULT_CELLS 由来)", () => {
    render(<VerifiedConditionsField value={[]} onChange={vi.fn()} testIdPrefix={PREFIX} />);
    for (const key of ALL_CELLS) {
      expect(checkbox(key)).toBeDefined();
    }
    // 4 セルより多く出していないこと(自前でセルを組み立てていないことの裏づけ)。
    expect(screen.getAllByRole("checkbox")).toHaveLength(4);
  });

  it("★既定は全セル未チェック(未検証で開始する)", () => {
    render(<VerifiedConditionsField value={[]} onChange={vi.fn()} testIdPrefix={PREFIX} />);
    for (const key of ALL_CELLS) {
      expect(checkbox(key).checked).toBe(false);
    }
  });

  it("value が undefined でも全セル未チェックで描画する", () => {
    render(
      <VerifiedConditionsField value={undefined} onChange={vi.fn()} testIdPrefix={PREFIX} />,
    );
    for (const key of ALL_CELLS) {
      expect(checkbox(key).checked).toBe(false);
    }
  });

  it("チェックしたセルだけが onChange に載る", () => {
    const onChange = vi.fn();
    render(<VerifiedConditionsField value={[]} onChange={onChange} testIdPrefix={PREFIX} />);

    fireEvent.click(checkbox("back_tech:true"));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toEqual([{ techType: "back_tech", inCorner: true }]);
  });

  it("★渡したセルと渡さなかったセルが対で決まる(2 セルだけ載る)", () => {
    const onChange = vi.fn();
    const value: SetupResultCondition[] = [{ techType: "neutral_tech", inCorner: false }];
    render(<VerifiedConditionsField value={value} onChange={onChange} testIdPrefix={PREFIX} />);

    fireEvent.click(checkbox("back_tech:true"));

    const next = onChange.mock.calls[0][0] as SetupResultCondition[];
    expect(next).toEqual([
      { techType: "neutral_tech", inCorner: false },
      { techType: "back_tech", inCorner: true },
    ]);
    // 触っていない 2 セルは含まれない。
    expect(next.some((c) => c.techType === "neutral_tech" && c.inCorner)).toBe(false);
    expect(next.some((c) => c.techType === "back_tech" && !c.inCorner)).toBe(false);
  });

  it("チェックを外すとそのセルが消える", () => {
    const onChange = vi.fn();
    const value: SetupResultCondition[] = [
      { techType: "neutral_tech", inCorner: false },
      { techType: "back_tech", inCorner: true },
    ];
    render(<VerifiedConditionsField value={value} onChange={onChange} testIdPrefix={PREFIX} />);

    expect(checkbox("neutral_tech:false").checked).toBe(true);
    fireEvent.click(checkbox("neutral_tech:false"));

    expect(onChange.mock.calls[0][0]).toEqual([{ techType: "back_tech", inCorner: true }]);
  });

  it("不成立(ng)もメモも入力できない(§2.2 の非対称は意図的)", () => {
    render(<VerifiedConditionsField value={[]} onChange={vi.fn()} testIdPrefix={PREFIX} />);
    // 三値のラジオ・メモ欄が無く、チェックボックス 4 つだけであること。
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
  });

  it("語彙は OKI_TECH_TYPE_LABEL_KEYS と 項目10 の端の i18n キー(第 3 の語彙を作らない)", () => {
    render(<VerifiedConditionsField value={[]} onChange={vi.fn()} testIdPrefix={PREFIX} />);
    // t() はモックでキーをそのまま返すため、ラベルはキー文字列で現れる。
    // ★M24-07: 受け身種別も i18n を通るようになった(旧: 定数の日本語が直接出ていた)。
    expect(screen.getByText(OKI_TECH_TYPE_LABEL_KEYS.neutral_tech)).toBeDefined();
    expect(screen.getByText(OKI_TECH_TYPE_LABEL_KEYS.back_tech)).toBeDefined();
    expect(screen.getByText("setupResult.corner.midScreen")).toBeDefined();
    expect(screen.getByText("setupResult.corner.inCorner")).toBeDefined();
  });

  // ★M19-07 追補: 見た目をコンボ詳細の「成立条件を編集」と揃える
  // (DES-005 §5.6 項目10 と同じ 2×2 グリッド)。
  describe("2×2 グリッドの構造(項目10 と同一)", () => {
    it("列が受け身種別 2・行が画面端 2 のテーブルになっている", () => {
      const { container } = render(
        <VerifiedConditionsField value={[]} onChange={vi.fn()} testIdPrefix={PREFIX} />,
      );
      const table = container.querySelector("table");
      expect(table).not.toBeNull();

      // 見出し行: 軸ラベル(sr-only)＋受け身種別 2 列。
      const headCols = table!.querySelectorAll("thead th");
      expect(headCols).toHaveLength(3);
      expect(headCols[1].textContent).toBe(OKI_TECH_TYPE_LABEL_KEYS.neutral_tech);
      expect(headCols[2].textContent).toBe(OKI_TECH_TYPE_LABEL_KEYS.back_tech);

      // 本体: 画面端 2 行。各行の先頭が行見出し、残り 2 セルが入力。
      const rows = table!.querySelectorAll("tbody tr");
      expect(rows).toHaveLength(2);
      for (const row of rows) {
        expect(row.querySelectorAll("th")).toHaveLength(1);
        expect(row.querySelectorAll("td")).toHaveLength(2);
      }
      // 行見出しは端の語彙(項目10 と同じ i18n キー)。
      expect(rows[0].querySelector("th")!.textContent).toBe("setupResult.corner.midScreen");
      expect(rows[1].querySelector("th")!.textContent).toBe("setupResult.corner.inCorner");
    });

    it("セルのアイコンは 成立/未検証 の 2 種のみ(不成立のアイコンを出さない)", () => {
      render(
        <VerifiedConditionsField
          value={[{ techType: "neutral_tech", inCorner: false }]}
          onChange={vi.fn()}
          testIdPrefix={PREFIX}
        />,
      );
      // チェック済み 1 セル → ok アイコン、残り 3 セル → 未検証アイコン。
      expect(screen.getAllByTestId("setup-result-icon-ok")).toHaveLength(1 + 1); // セル + 凡例
      expect(screen.getAllByTestId("setup-result-icon-unverified")).toHaveLength(3 + 1);
      expect(screen.queryAllByTestId("setup-result-icon-ng")).toHaveLength(0);
    });

    it("★凡例に「不成立」を出さない(選べない状態を凡例に出すと誤読される)", () => {
      render(<VerifiedConditionsField value={[]} onChange={vi.fn()} testIdPrefix={PREFIX} />);
      const legend = screen.getByTestId("setup-result-legend");
      expect(legend.textContent).toContain("setupResult.state.ok");
      expect(legend.textContent).toContain("setupResult.state.unverified");
      expect(legend.textContent).not.toContain("setupResult.state.ng");
    });

    it("fieldsetTestId は既定で testIdPrefix、指定すればそちらが fieldset に付く", () => {
      const { unmount } = render(
        <VerifiedConditionsField value={[]} onChange={vi.fn()} testIdPrefix={PREFIX} />,
      );
      expect(screen.getByTestId(PREFIX).tagName).toBe("FIELDSET");
      unmount();

      // 採用パネルはセルの接頭辞と fieldset 名が別という既存契約を持つ。
      render(
        <VerifiedConditionsField
          value={[]}
          onChange={vi.fn()}
          testIdPrefix="setplay-confirmed"
          fieldsetTestId="setplay-confirmed-conditions"
        />,
      );
      expect(screen.getByTestId("setplay-confirmed-conditions").tagName).toBe("FIELDSET");
      expect(screen.getByTestId("setplay-confirmed-neutral_tech:false")).toBeDefined();
      expect(screen.queryByTestId("setplay-confirmed")).toBeNull();
    });

    it("variant=section ではページ直下のセクションと同じ枠になる", () => {
      const { container } = render(
        <VerifiedConditionsField
          value={[]}
          onChange={vi.fn()}
          testIdPrefix={PREFIX}
          variant="section"
        />,
      );
      const fieldset = container.querySelector("fieldset")!;
      expect(fieldset.className).toContain("rounded-lg");
      expect(fieldset.className).toContain("border-gray-300");
      // セルの構造は variant に依らず同じ。
      expect(screen.getAllByRole("checkbox")).toHaveLength(4);
    });
  });
});

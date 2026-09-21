import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { COLUMN_DEFINITIONS, DEFAULT_COLUMN_VISIBILITY } from "@/constants/combo-list";
import i18n from "@/lib/i18n";

import type { ComboSummary } from "../types";
import type { SetupSummary } from "@/features/setup/types";
import ComboTable from "./ComboTable";

const baseProps = {
  combos: [],
  onDelete: vi.fn(),
  visibility: DEFAULT_COLUMN_VISIBILITY,
};

function renderComboTable(props: Partial<React.ComponentProps<typeof ComboTable>> = {}) {
  return render(
    <MemoryRouter>
      <ComboTable {...baseProps} {...props} />
    </MemoryRouter>,
  );
}

// M24-01 §4.5(SM-012): セットプレイ数の列。一覧応答の setups をそのまま数える。
function setupSummary(id: number): SetupSummary {
  return {
    id,
    characterId: 1,
    name: `setup-${id}`,
    stepCount: 1,
    version: 1,
    defaultRecipe: "5LP",
    parentComboIds: [],
  };
}

function combo(id: number, setups: SetupSummary[] | undefined): ComboSummary {
  return {
    id,
    characterId: 1,
    isDraft: false,
    affectedByGameUpdate: false,
    affectedMoves: [],
    stepCount: 1,
    defaultRecipe: "5LP",
    starterMoveCode: "5LP",
    version: 1,
    createdAt: "2026-08-25T00:00:00Z",
    updatedAt: "2026-08-25T00:00:00Z",
    tags: [],
    setups,
  };
}

describe("ComboTable", () => {
  it("空のコンボ一覧でデフォルトの空状態メッセージを表示する", () => {
    renderComboTable();
    expect(
      screen.getByText(
        "コンボが登録されていません。「新規登録」から追加してください。",
      ),
    ).toBeTruthy();
  });

  it("newComboHref が無い場合、CTA リンクは表示しない", () => {
    renderComboTable();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("newComboHref がある場合、CTA リンクを正しい href で表示する", () => {
    renderComboTable({ newComboHref: "/combos/new?character=ryu" });
    const cta = screen.getByRole("link", { name: "コンボを登録する" });
    expect(cta).toBeTruthy();
    expect(cta.getAttribute("href")).toBe("/combos/new?character=ryu");
  });

  it("hasActiveFilters が true のとき、フィルタ空状態メッセージとフィルタ解除ボタンを表示する(CTAは表示しない)", () => {
    renderComboTable({
      hasActiveFilters: true,
      onClearFilters: vi.fn(),
      newComboHref: "/combos/new?character=ryu",
    });
    expect(
      screen.getByText("フィルタ条件にマッチするコンボがありません"),
    ).toBeTruthy();
    expect(screen.getByText("フィルタを解除")).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("フィルタ解除ボタンをクリックすると onClearFilters が呼ばれる", async () => {
    const user = userEvent.setup();
    const onClearFilters = vi.fn();
    renderComboTable({
      hasActiveFilters: true,
      onClearFilters,
    });
    await user.click(screen.getByText("フィルタを解除"));
    expect(onClearFilters).toHaveBeenCalledOnce();
  });

  describe("セットプレイ数の列(M24-01 §4.5 / SM-012)", () => {
    // ★★M24-03 の手動確認(開発者判断 2026-08-26)で本列は「既定 OFF」になった。
    //   列そのものは残っており、表示列カスタマイズで戻せる。
    //   ⇒ 本 describe の命題は「列が機能するか」であって「既定で出るか」ではないため、
    //     明示的に ON にしてから確かめる。母集合(0 件・1 件・複数件)は変えていない。
    const shown = { ...DEFAULT_COLUMN_VISIBILITY, setupCount: true };

    it("0 件・1 件・複数件をそのまま出す(0 件も空欄にしない)", () => {
      renderComboTable({
        visibility: shown,
        combos: [
          combo(1, []),
          combo(2, [setupSummary(11)]),
          combo(3, [setupSummary(12), setupSummary(13), setupSummary(14)]),
        ],
      });
      // ★件数を数える前に、対象の列が実際に描画されたことを確かめる(M23-07 の型)。
      expect(screen.getByRole("columnheader", { name: "セットプレイ数" })).toBeTruthy();
      const cells = screen.getAllByTestId("combo-setup-count");
      expect(cells.map((c) => c.textContent)).toEqual(["0", "1", "3"]);
    });

    it("setups キー自体が無くても 0 と出す", () => {
      renderComboTable({ visibility: shown, combos: [combo(1, undefined)] });
      expect(screen.getByTestId("combo-setup-count").textContent).toBe("0");
    });

    // ★M24-03: 既定 OFF になったこと自体を固定する(戻したら赤になる網)。
    it("★既定では出ない(M24-03 の開発者判断)", () => {
      renderComboTable({ combos: [combo(1, [setupSummary(11)])] });
      expect(
        screen.queryByRole("columnheader", { name: "セットプレイ数" }),
      ).toBeNull();
      expect(screen.queryByTestId("combo-setup-count")).toBeNull();
    });

    it("表示列カスタマイズで非表示にできる", () => {
      renderComboTable({
        combos: [combo(1, [setupSummary(11)])],
        visibility: { ...DEFAULT_COLUMN_VISIBILITY, setupCount: false },
      });
      expect(
        screen.queryByRole("columnheader", { name: "セットプレイ数" }),
      ).toBeNull();
      expect(screen.queryByTestId("combo-setup-count")).toBeNull();
    });

    it("非表示にすると展開行の colSpan が 1 減る(E-192)", async () => {
      // ★展開行の colSpan は「失敗時にしか描画されない行」と同じく通常の描画では
      //   目に触れない。列を 1 本足したときに最も落ちやすい箇所である。
      const colSpanOf = async (setupCount: boolean) => {
        // 展開状態は sessionStorage(combo-list-expanded-ids-v1)に残るため毎回消す。
        sessionStorage.clear();
        const user = userEvent.setup();
        const view = renderComboTable({
          combos: [combo(1, [setupSummary(11)])],
          visibility: { ...DEFAULT_COLUMN_VISIBILITY, setupCount },
        });
        await user.click(screen.getByRole("button", { name: "expand" }));
        const cell = view.container.querySelector("td[colspan]");
        expect(cell, "展開行が描画されていない").toBeTruthy();
        const n = Number(cell!.getAttribute("colspan"));
        view.unmount();
        return n;
      };

      const shown = await colSpanOf(true);
      const hidden = await colSpanOf(false);
      expect(shown).toBeGreaterThan(0);
      expect(hidden).toBe(shown - 1);
    });
  });

  // ★★M31-03: 列の並びの正本は **3 か所に分かれている** ——
  //   (1) constants の COLUMN_DEFINITIONS(表示列メニューの並びと colSpan の計数)
  //   (2) ComboTable の見出し JSX
  //   (3) ComboTableRow のセル JSX
  //   ⇒ 1 つだけ直すと見出しとセルがずれるが、**tsc もテストも検出しない**。
  //     実際、M31-03 の段 1 実査までこの分岐は誰にも見えていなかった。
  //   ★本 describe はその 3 つが一致することだけを見る。並びの良し悪しは見ない。
  describe("列の並び(3 か所が一致すること)", () => {
    // 各列を一意に見分けられる値を持つコンボ。
    // ★備考はレシピ列の上にも 1 行目が出る(MemoFirstLine)。⇒ 「含む」で見る。
    const orderProbe: ComboSummary = {
      ...combo(1, []),
      defaultRecipe: "PROBE_RECIPE",
      damage: 3210,
      hitType: "punish_counter",
      position: "corner_opponent",
      opponentStance: "standing",
      isDraft: true,
      memo: "PROBE_MEMO",
      // ★件数は他列の値と重ならない数にする(低-1)。damage "3210" は "2" を含む。
      setups: [setupSummary(1), setupSummary(2), setupSummary(3), setupSummary(4)],
      tags: [
        { id: 9, userId: 1, name: "PROBE_TAG", category: "free", color: "#1D4ED8" },
      ],
    };

    // COLUMN_DEFINITIONS の key → その列にだけ出る文字列。
    //
    // ★★値は互いに部分文字列にならないものを使うこと(低-1)。
    //   ⇒ 部分文字列だと、その 2 列が入れ替わっても toContain が通ってしまい、
    //     検出力が静かに落ちる。★列を足すときもこの規則を守ること。
    const PROBE: Record<string, string> = {
      recipe: "PROBE_RECIPE",
      damage: "3210",
      hitType: "パニッシュカウンター",
      position: "相手画面端",
      opponentStance: "立ち",
      tags: "PROBE_TAG",
      draftStatus: "仮登録",
      memo: "PROBE_MEMO",
      setupCount: "4",
    };

    // 既定で OFF の 2 列も出して、全列を並びの検査に載せる。
    const allVisible = { ...DEFAULT_COLUMN_VISIBILITY, memo: true, setupCount: true };

    it("検査の母集団が全列であること(列を足したら、ここが先に落ちる)", () => {
      // ★列を足したのに allVisible へ足し忘れると、その列は並びの検査から漏れる。
      //   ⇒ 漏れを黙って許さないための番人である(M-145 の一般形 = 母集団を疑う)。
      const missing = COLUMN_DEFINITIONS.filter((c) => !allVisible[c.key]);
      expect(missing.map((c) => c.key)).toEqual([]);
    });

    it("見出しの並びが COLUMN_DEFINITIONS の並びと一致する", () => {
      renderComboTable({ combos: [orderProbe], visibility: allVisible });

      const headers = Array.from(
        document.querySelectorAll("thead th"),
      ).map((th) => th.textContent?.trim() ?? "");

      // 先頭の展開アイコン列(空)と末尾の操作列を落とす。
      const columnHeaders = headers.slice(1, 1 + COLUMN_DEFINITIONS.length);
      const expected = COLUMN_DEFINITIONS.map((c) => i18n.t(c.labelKey));

      expect(columnHeaders).toEqual(expected);
    });

    it("セルの並びが COLUMN_DEFINITIONS の並びと一致する", () => {
      renderComboTable({ combos: [orderProbe], visibility: allVisible });

      const row = screen.getAllByRole("row")[1];
      const cells = Array.from(row.querySelectorAll("td"));
      // 先頭の展開アイコン列と末尾の操作列を落とす。
      const columnCells = cells.slice(1, 1 + COLUMN_DEFINITIONS.length);

      expect(columnCells).toHaveLength(COLUMN_DEFINITIONS.length);
      COLUMN_DEFINITIONS.forEach((col, i) => {
        expect(
          columnCells[i].textContent,
          `${i} 番目のセルは ${col.key} のはずである`,
        ).toContain(PROBE[col.key]);
      });
    });

    it("案C の並びそのものを固定する(変えるなら DES-005 §5.4 の CHANGE が要る)", () => {
      expect(COLUMN_DEFINITIONS.map((c) => c.key)).toEqual([
        "recipe",
        "damage",
        "hitType",
        "position",
        "opponentStance",
        "tags",
        "draftStatus",
        "memo",
        "setupCount",
      ]);
    });
  });
});

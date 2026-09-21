import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MoveEditGrid } from "./MoveEditGrid";
import type { Move } from "./types";

const mockUpdate = vi.fn();
const mockRush = vi.fn();

vi.mock("./api", () => ({
  useUpdateMove: () => ({ mutate: mockUpdate, isPending: false }),
  useGenerateRushVariant: () => ({ mutate: mockRush, isPending: false }),
  useMoveDetail: () => ({ data: undefined, isLoading: false }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

function makeMove(overrides: Partial<Move> = {}): Move {
  return {
    id: 1,
    characterId: 7,
    code: "st_mp",
    category: "normal",
    total: 20,
    startup: 5,
    active: 3,
    onHit: 2,
    onBlock: -1,
    isAerial: false,
    setupOnly: false,
    isDerived: false,
    nameJa: "立ち中P",
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("MoveEditGrid", () => {
  it("total を編集して保存すると変更フィールドのみが PATCH される", () => {
    render(<MoveEditGrid characterId={7} moves={[makeMove()]} />);
    fireEvent.change(screen.getByLabelText("全体"), {
      target: { value: "99" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate.mock.calls[0][0]).toEqual({
      id: 1,
      input: { total: 99 },
    });
  });

  it("is_aerial をトグルして保存すると isAerial が送られる", () => {
    render(<MoveEditGrid characterId={7} moves={[makeMove()]} />);
    fireEvent.click(screen.getByLabelText("空中"));
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(mockUpdate.mock.calls[0][0]).toEqual({
      id: 1,
      input: { isAerial: true },
    });
  });

  it("変更が無い場合は PATCH を呼ばない", () => {
    render(<MoveEditGrid characterId={7} moves={[makeMove()]} />);
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("通常技かつ非空中ならラッシュ版ボタンが活性", () => {
    render(
      <MoveEditGrid
        characterId={7}
        moves={[makeMove({ category: "normal", isAerial: false })]}
      />,
    );
    const btn = screen.getByRole("button", { name: "ラッシュ版" }) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    expect(mockRush.mock.calls[0][0]).toEqual({ id: 1 });
  });

  it("投げ技ではラッシュ版ボタンが非活性", () => {
    render(
      <MoveEditGrid characterId={7} moves={[makeMove({ category: "throw" })]} />,
    );
    const btn = screen.getByRole("button", { name: "ラッシュ版" }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("空中技に切り替えるとラッシュ版ボタンが非活性になる", () => {
    render(
      <MoveEditGrid
        characterId={7}
        moves={[makeMove({ category: "normal", isAerial: false })]}
      />,
    );
    fireEvent.click(screen.getByLabelText("空中"));
    const btn = screen.getByRole("button", { name: "ラッシュ版" }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute("title")).toBe(
      "空中設定を変更したら先に保存してください",
    );
    expect(btn.getAttribute("title")).not.toContain("is_aerial");
  });

  it("空中技から is_aerial を外しても未保存ならラッシュ版ボタンは非活性のまま(デシンク防止)", () => {
    // 永続値 isAerial=true(本来ラッシュ不可)。ローカルで false にトグルしても、
    // サーバは永続値で判定するため未保存中はボタンを非活性に保つ(レビュー #2)。
    render(
      <MoveEditGrid
        characterId={7}
        moves={[makeMove({ category: "normal", isAerial: true })]}
      />,
    );
    const btn = screen.getByRole("button", { name: "ラッシュ版" }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true); // 初期(aerial=true)で非活性
    fireEvent.click(screen.getByLabelText("空中")); // false へトグル(未保存)
    expect(btn.disabled).toBe(true); // dirty ガードで非活性のまま
    expect(btn.getAttribute("title")).toBe(
      "空中設定を変更したら先に保存してください",
    );
    expect(btn.getAttribute("title")).not.toContain("is_aerial");
  });

  it("recovery を編集して保存すると recovery が整数で送られる(M14-01)", () => {
    render(<MoveEditGrid characterId={7} moves={[makeMove()]} />);
    fireEvent.change(screen.getByLabelText("硬直"), {
      target: { value: "13" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(mockUpdate.mock.calls[0][0]).toEqual({
      id: 1,
      input: { recovery: 13 },
    });
  });

  it("入力の aria-label に内部値(is_aerial 等)が露出せず日本語ラベルになっている(C-20)", () => {
    render(<MoveEditGrid characterId={7} moves={[makeMove()]} />);
    // 内部値ラベルは存在しない。
    for (const internal of [
      "is_aerial",
      "total",
      "startup",
      "active",
      "onHit",
      "onBlock",
      "recovery",
    ]) {
      expect(screen.queryByLabelText(internal)).toBeNull();
    }
    // ユーザー向け日本語ラベルで取得できる(列ヘッダと一致)。
    expect(screen.getByLabelText("全体")).toBeDefined();
    expect(screen.getByLabelText("空中")).toBeDefined();
    expect(screen.getByLabelText("硬直")).toBeDefined();
  });

  it("warnings を持つ行は要確認として強調され、ラベルが表示される", () => {
    // サーバ再導出の warnings を §5.17 と同じラベルで強調する(M9-04、§4.1)。
    // M14-01 で unknown_properties / unknown_combo_scaling_key は撤去され再導出されない。
    render(
      <MoveEditGrid
        characterId={7}
        moves={[
          makeMove({
            total: null,
            warnings: ["total_null", "extra_throw"],
          }),
        ]}
      />,
    );
    const row = screen.getByText("st_mp").closest("tr");
    expect(row).not.toBeNull();
    expect(row?.getAttribute("data-needs-confirmation")).toBe("true");
    const cell = within(row as HTMLElement);
    expect(cell.getByText("total 未算出")).toBeDefined();
    expect(cell.getByText("3 件目以降の投げ")).toBeDefined();
  });

  it("warnings が空の行は要確認として強調されない", () => {
    render(<MoveEditGrid characterId={7} moves={[makeMove({ warnings: [] })]} />);
    const row = screen.getByText("st_mp").closest("tr");
    expect(row?.getAttribute("data-needs-confirmation")).toBe("false");
  });

  it("ラッシュ版が既に存在する元技ではボタンが非活性", () => {
    // 元技(id=1)と、その rush_variant(originalMoveId=1)が同一覧に存在する状態。
    render(
      <MoveEditGrid
        characterId={7}
        moves={[
          makeMove({ id: 1, code: "st_mp", category: "normal", isAerial: false }),
          makeMove({
            id: 2,
            code: "rush_st_mp",
            category: "rush_variant",
            originalMoveId: 1,
          }),
        ]}
      />,
    );
    const srcRow = screen.getByText("st_mp").closest("tr") as HTMLElement;
    const btn = within(srcRow).getByRole("button", {
      name: "ラッシュ版",
    }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("列ヘッダのクリックで表示順が変わり、API は呼ばれない(表示のみ)", () => {
    render(
      <MoveEditGrid
        characterId={7}
        moves={[
          makeMove({ id: 1, code: "b_move", total: 30 }),
          makeMove({ id: 2, code: "a_move", total: 10 }),
        ]}
      />,
    );
    // 初期(受領順): b_move が a_move より前。
    const before = screen.getByText("b_move");
    expect(
      before.compareDocumentPosition(screen.getByText("a_move")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    // 「全体」(total)で昇順ソート → a_move(10) が b_move(30) より前へ。
    fireEvent.click(screen.getByRole("button", { name: "全体 で並び替え" }));
    const a = screen.getByText("a_move");
    expect(
      a.compareDocumentPosition(screen.getByText("b_move")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    // 表示のみ: 保存・ラッシュ生成 API を一切呼ばない。
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockRush).not.toHaveBeenCalled();
  });

  it("並び替えクリアで受領順に戻り、クリアボタンは sort 時のみ表示される", () => {
    render(
      <MoveEditGrid
        characterId={7}
        moves={[
          makeMove({ id: 1, code: "b_move", total: 30 }),
          makeMove({ id: 2, code: "a_move", total: 10 }),
        ]}
      />,
    );
    // 初期(sort なし)はクリアボタン非表示。
    expect(screen.queryByRole("button", { name: /並び替えをクリア/ })).toBeNull();

    // ソートすると a_move が前へ ＆ クリアボタンが出現。
    fireEvent.click(screen.getByRole("button", { name: "全体 で並び替え" }));
    expect(
      screen
        .getByText("a_move")
        .compareDocumentPosition(screen.getByText("b_move")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    const clearBtn = screen.getByRole("button", { name: /並び替えをクリア/ });

    // クリアで受領順(b_move が前)に復帰し、ボタンは再び消える。API 不呼出。
    fireEvent.click(clearBtn);
    expect(
      screen
        .getByText("b_move")
        .compareDocumentPosition(screen.getByText("a_move")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /並び替えをクリア/ })).toBeNull();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockRush).not.toHaveBeenCalled();
  });
});

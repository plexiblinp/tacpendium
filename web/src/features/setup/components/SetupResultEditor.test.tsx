import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SetupResultEditor } from "./SetupResultEditor";
import type { SetupResultCell } from "../types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockUpsert = vi.fn();
const mockDelete = vi.fn();
vi.mock("../api/setupApi", () => ({
  setupApi: {
    upsertResult: (...a: unknown[]) => mockUpsert(...a),
    deleteResult: (...a: unknown[]) => mockDelete(...a),
  },
}));

function wrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

function renderEditor(results?: SetupResultCell[]) {
  const onChanged = vi.fn();
  render(
    <SetupResultEditor comboId={42} setupId={7} results={results} onChanged={onChanged} />,
    { wrapper: wrapper() },
  );
  return { onChanged };
}

const stateOf = (key: string) =>
  screen.getByTestId(`setup-result-cell-select-${key}`).getAttribute("data-state");

afterEach(() => {
  mockUpsert.mockReset();
  mockDelete.mockReset();
});

// ===========================================================================
// 選択と状態変更の分離(2026-07-28 実機確認の指摘への対応)
// ===========================================================================

describe("セル選択は状態を変えない", () => {
  it("★セルを押しても upsert / delete が呼ばれない(メモ欄を開くために押せる)", () => {
    renderEditor([{ setupId: 7, techType: "neutral_tech", inCorner: true, result: "ok" }]);

    fireEvent.click(screen.getByTestId("setup-result-cell-select-neutral_tech:true"));

    expect(mockUpsert).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
    expect(stateOf("neutral_tech:true")).toBe("ok");
  });

  it("選択したセルが aria-pressed で示される", () => {
    renderEditor([]);
    const target = screen.getByTestId("setup-result-cell-select-back_tech:true");
    fireEvent.click(target);
    expect(target.getAttribute("aria-pressed")).toBe("true");
    expect(
      screen.getByTestId("setup-result-cell-select-neutral_tech:false").getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("編集を開いた直後から状態変更・メモ入力ができる(既定で 1 セル選択済み)", () => {
    renderEditor([]);
    expect(screen.getByTestId("setup-result-cell-panel")).toBeTruthy();
    expect(screen.getByTestId("setup-result-note-input")).toBeTruthy();
    expect(screen.getByTestId("setup-result-state-ok")).toBeTruthy();
  });

  it("4 セルすべてを選択できる", () => {
    renderEditor([]);
    for (const key of [
      "neutral_tech:false",
      "neutral_tech:true",
      "back_tech:false",
      "back_tech:true",
    ]) {
      expect(screen.getByTestId(`setup-result-cell-select-${key}`)).toBeTruthy();
    }
  });
});

describe("状態は 1 クリックで直接指定できる", () => {
  it("★未検証 → 不成立が 1 クリックで済む(巡回不要)", async () => {
    mockUpsert.mockResolvedValue({});
    renderEditor([]);

    fireEvent.click(screen.getByTestId("setup-result-state-ng"));

    await waitFor(() => expect(mockUpsert).toHaveBeenCalledTimes(1));
    expect(mockUpsert).toHaveBeenCalledWith(42, 7, {
      techType: "neutral_tech",
      inCorner: false,
      result: "ng",
      note: null,
    });
  });

  it("★成立 → 未検証が 1 クリックで済む(行の削除)", async () => {
    mockDelete.mockResolvedValue(undefined);
    renderEditor([{ setupId: 7, techType: "neutral_tech", inCorner: false, result: "ok" }]);

    fireEvent.click(screen.getByTestId("setup-result-state-unverified"));

    await waitFor(() => expect(mockDelete).toHaveBeenCalledTimes(1));
    expect(mockDelete).toHaveBeenCalledWith(42, 7, "neutral_tech", false);
    // 「未検証」を意味する値で upsert していない(行の有無で表す)。
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("現在の状態のボタンが押下済みとして示される", () => {
    renderEditor([{ setupId: 7, techType: "neutral_tech", inCorner: false, result: "ng" }]);
    expect(screen.getByTestId("setup-result-state-ng").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("setup-result-state-ok").getAttribute("aria-pressed")).toBe("false");
    expect(
      screen.getByTestId("setup-result-state-unverified").getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("同じ状態を押しても無駄な保存をしない", () => {
    renderEditor([{ setupId: 7, techType: "neutral_tech", inCorner: false, result: "ok" }]);
    fireEvent.click(screen.getByTestId("setup-result-state-ok"));
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("選択セルを変えてから状態を指定すると、そのセルに書かれる", async () => {
    mockUpsert.mockResolvedValue({});
    renderEditor([]);

    fireEvent.click(screen.getByTestId("setup-result-cell-select-back_tech:true"));
    fireEvent.click(screen.getByTestId("setup-result-state-ok"));

    await waitFor(() => expect(mockUpsert).toHaveBeenCalledTimes(1));
    expect(mockUpsert.mock.calls[0][2].techType).toBe("back_tech");
    expect(mockUpsert.mock.calls[0][2].inCorner).toBe(true);
  });

  it("状態遷移で既存のメモを失わない", async () => {
    mockUpsert.mockResolvedValue({});
    renderEditor([
      { setupId: 7, techType: "neutral_tech", inCorner: false, result: "ok", note: "距離がシビア" },
    ]);

    fireEvent.click(screen.getByTestId("setup-result-state-ng"));

    await waitFor(() => expect(mockUpsert).toHaveBeenCalledTimes(1));
    expect(mockUpsert.mock.calls[0][2].note).toBe("距離がシビア");
  });
});

// ===========================================================================
// メモ
// ===========================================================================

describe("メモ", () => {
  it("★成立(ok)のセルの メモを ok のまま編集できる", async () => {
    mockUpsert.mockResolvedValue({});
    renderEditor([{ setupId: 7, techType: "neutral_tech", inCorner: false, result: "ok" }]);

    fireEvent.change(screen.getByTestId("setup-result-note-input"), {
      target: { value: "端では距離がシビア" },
    });
    fireEvent.click(screen.getByTestId("setup-result-note-save"));

    await waitFor(() => expect(mockUpsert).toHaveBeenCalledTimes(1));
    expect(mockUpsert.mock.calls[0][2].result).toBe("ok");
    expect(mockUpsert.mock.calls[0][2].note).toBe("端では距離がシビア");
  });

  it("不成立(ng)のセルも ng のままメモを編集できる", async () => {
    mockUpsert.mockResolvedValue({});
    renderEditor([{ setupId: 7, techType: "neutral_tech", inCorner: false, result: "ng" }]);

    fireEvent.change(screen.getByTestId("setup-result-note-input"), {
      target: { value: "後ろ受け身だと外れる" },
    });
    fireEvent.click(screen.getByTestId("setup-result-note-save"));

    await waitFor(() => expect(mockUpsert).toHaveBeenCalledTimes(1));
    expect(mockUpsert.mock.calls[0][2].result).toBe("ng");
  });

  it("保存済みのメモが入力欄に出る", () => {
    renderEditor([
      { setupId: 7, techType: "neutral_tech", inCorner: false, result: "ng", note: "届かない" },
    ]);
    const input = screen.getByTestId("setup-result-note-input") as HTMLInputElement;
    expect(input.value).toBe("届かない");
  });

  it("メモはセル単位(選択を切り替えると別の内容になる)", () => {
    renderEditor([
      { setupId: 7, techType: "neutral_tech", inCorner: false, result: "ok", note: "こっちのメモ" },
      { setupId: 7, techType: "back_tech", inCorner: true, result: "ng", note: "あっちのメモ" },
    ]);
    const input = () => screen.getByTestId("setup-result-note-input") as HTMLInputElement;

    expect(input().value).toBe("こっちのメモ");
    fireEvent.click(screen.getByTestId("setup-result-cell-select-back_tech:true"));
    expect(input().value).toBe("あっちのメモ");
  });

  it("空文字のメモは null で保存する", async () => {
    mockUpsert.mockResolvedValue({});
    renderEditor([
      { setupId: 7, techType: "neutral_tech", inCorner: false, result: "ok", note: "消す" },
    ]);

    fireEvent.change(screen.getByTestId("setup-result-note-input"), { target: { value: "  " } });
    fireEvent.click(screen.getByTestId("setup-result-note-save"));

    await waitFor(() => expect(mockUpsert).toHaveBeenCalledTimes(1));
    expect(mockUpsert.mock.calls[0][2].note).toBeNull();
  });
});

describe("未検証セルのメモは画面に残る(保存はされない)", () => {
  it("★未検証へ戻してもメモが入力欄から消えない", async () => {
    mockDelete.mockResolvedValue(undefined);
    // 保存済みのメモを持つ成立セル。
    const { rerender } = renderEditorWithRerender([
      { setupId: 7, techType: "neutral_tech", inCorner: false, result: "ok", note: "残ってほしい" },
    ]);
    expect(
      (screen.getByTestId("setup-result-note-input") as HTMLInputElement).value,
    ).toBe("残ってほしい");

    // 未検証へ戻す → サーバ側では行が消えるので results から当該行が無くなる。
    fireEvent.click(screen.getByTestId("setup-result-state-unverified"));
    await waitFor(() => expect(mockDelete).toHaveBeenCalled());
    rerender([]); // 再取得後の状態を再現

    // 画面のメモは消えない。
    expect(
      (screen.getByTestId("setup-result-note-input") as HTMLInputElement).value,
    ).toBe("残ってほしい");
  });

  it("未検証のあいだは保存が無効で、その旨の注記が出る", () => {
    renderEditor([]);
    const save = screen.getByTestId("setup-result-note-save") as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    expect(screen.getByTestId("setup-result-note-unsaved-hint")).toBeTruthy();
  });

  it("検証済みなら保存が有効で注記は出ない", () => {
    renderEditor([{ setupId: 7, techType: "neutral_tech", inCorner: false, result: "ok" }]);
    const save = screen.getByTestId("setup-result-note-save") as HTMLButtonElement;
    expect(save.disabled).toBe(false);
    expect(screen.queryByTestId("setup-result-note-unsaved-hint")).toBeNull();
  });

  it("下書きを書いてから成立にすると、その下書きが保存される", async () => {
    mockUpsert.mockResolvedValue({});
    renderEditor([]); // 未検証

    fireEvent.change(screen.getByTestId("setup-result-note-input"), {
      target: { value: "先に書いたメモ" },
    });
    fireEvent.click(screen.getByTestId("setup-result-state-ok"));

    await waitFor(() => expect(mockUpsert).toHaveBeenCalledTimes(1));
    expect(mockUpsert.mock.calls[0][2].result).toBe("ok");
    expect(mockUpsert.mock.calls[0][2].note).toBe("先に書いたメモ");
  });
});

describe("エラー表示", () => {
  it("保存に失敗したらエラーを出す", async () => {
    mockUpsert.mockRejectedValue(new Error("boom"));
    renderEditor([]);

    fireEvent.click(screen.getByTestId("setup-result-state-ok"));

    await waitFor(() => expect(screen.getByTestId("setup-result-error")).toBeTruthy());
  });
});

// results を差し替えて再描画できる版(サーバ再取得後の状態を再現する用)。
function renderEditorWithRerender(initial?: SetupResultCell[]) {
  const onChanged = vi.fn();
  const view = render(
    <SetupResultEditor comboId={42} setupId={7} results={initial} onChanged={onChanged} />,
    { wrapper: wrapper() },
  );
  return {
    onChanged,
    rerender: (next?: SetupResultCell[]) =>
      view.rerender(
        <SetupResultEditor comboId={42} setupId={7} results={next} onChanged={onChanged} />,
      ),
  };
}

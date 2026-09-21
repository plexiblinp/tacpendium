// 登録ダイアログ（M21-05 §5 (b) (c)）。
//
// ★(b) 除外キーは**理由つきで**拒否される（無反応にしない＝§4.3-2 / 重大 10）
// ★(c) 「除外」と「未登録」が**別の表示**になる（§4.3-3・`E-84` / 重大 11）

import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import KeyboardBindingDialog from "./KeyboardBindingDialog";
import { createEmptyBindings, withBinding } from "../types";
import type { KeyboardBindings } from "../types";

function renderDialog(bindings: KeyboardBindings = createEmptyBindings()) {
  const onSave = vi.fn((_bindings: KeyboardBindings) => true);
  const onClear = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <KeyboardBindingDialog
      open
      onOpenChange={onOpenChange}
      bindings={bindings}
      onSave={onSave}
      onClear={onClear}
      onCapturingChange={() => {}}
    />,
  );
  return { onSave, onClear, onOpenChange };
}

function press(code: string, key = code, modifiers: Record<string, boolean> = {}) {
  fireEvent.keyDown(window, { code, key, ...modifiers });
}

describe("(b) 除外キーの拒否", () => {
  it("ファンクションキーは理由つきで拒否される", () => {
    renderDialog();

    press("F5");

    const excluded = screen.getByTestId("recipe-keyboard-excluded");
    expect(excluded.textContent).toContain("F5");
    expect(excluded.textContent).toContain("ブラウザ");
    // 進んでいない＝同じ対象を待ち続ける。
    expect(screen.getByTestId("recipe-keyboard-step-up")).toBeTruthy();
  });

  it("Windows キーも理由つきで拒否される", () => {
    renderDialog();

    press("MetaLeft", "Meta");

    expect(
      screen.getByTestId("recipe-keyboard-excluded").textContent,
    ).toContain("OS");
  });

  it("修飾キーとの同時押しは拒否される", () => {
    renderDialog();

    press("KeyJ", "j", { ctrlKey: true });

    expect(
      screen.getByTestId("recipe-keyboard-excluded").textContent,
    ).toContain("Ctrl");
  });

  // ★無反応でないことの担保。拒否のあと正しいキーを押せば普通に進む。
  it("拒否のあと正しいキーを押せば登録できる", () => {
    renderDialog();

    press("F5");
    expect(screen.queryByTestId("recipe-keyboard-excluded")).toBeTruthy();

    press("KeyW", "w");

    expect(screen.queryByTestId("recipe-keyboard-excluded")).toBe(null);
    expect(
      screen.getByTestId("recipe-keyboard-assigned-up").textContent,
    ).toBe("W");
    // 次の対象へ進んでいる。
    expect(screen.getByTestId("recipe-keyboard-step-down")).toBeTruthy();
  });
});

describe("(c) 「除外」と「未登録」は別の表示である", () => {
  it("未登録は一覧の状態、除外は理由つきの通知として出る", () => {
    renderDialog();

    // 未登録の表示（まだ何も押していない）。
    const unassigned = screen.getByTestId("recipe-keyboard-assigned-up");
    expect(unassigned.getAttribute("data-state")).toBe("unassigned");
    expect(unassigned.textContent).toBe("未登録");
    // このとき除外の通知は出ていない。
    expect(screen.queryByTestId("recipe-keyboard-excluded")).toBe(null);

    // 除外キーを押すと、未登録とは**別の要素**に理由が出る。
    press("F5");

    const excluded = screen.getByTestId("recipe-keyboard-excluded");
    expect(excluded).not.toBe(unassigned);
    // 「未登録」は依然として未登録のままで、文言も違う。
    expect(
      screen.getByTestId("recipe-keyboard-assigned-up").getAttribute("data-state"),
    ).toBe("unassigned");
    expect(excluded.textContent).not.toContain("未登録");
    expect(excluded.textContent).toContain("登録できません");
  });
});

describe("登録の進行", () => {
  it("17 件すべてが一覧に出る（操作 4 件を含む）", () => {
    renderDialog();

    expect(screen.getByTestId("recipe-keyboard-assigned-up")).toBeTruthy();
    expect(screen.getByTestId("recipe-keyboard-assigned-heavy-punch")).toBeTruthy();
    expect(screen.getByTestId("recipe-keyboard-assigned-delete")).toBeTruthy();
    expect(screen.getByTestId("recipe-keyboard-assigned-save")).toBeTruthy();
    expect(screen.getByTestId("recipe-keyboard-assigned-modifier")).toBeTruthy();
    // ★M21-06 で加わったコマンド技入力モードの操作。
    expect(
      screen.getByTestId("recipe-keyboard-assigned-command-mode"),
    ).toBeTruthy();
    expect(screen.getByTestId("recipe-keyboard-progress").textContent).toContain(
      "0 / 17",
    );
  });

  it("二重割当は確認を求める", () => {
    renderDialog();

    press("KeyW", "w"); // up
    press("KeyW", "w"); // down に同じキー

    const conflict = screen.getByTestId("recipe-keyboard-conflict");
    expect(conflict.textContent).toContain("上");

    fireEvent.click(screen.getByTestId("recipe-keyboard-conflict-confirm"));

    expect(
      screen.getByTestId("recipe-keyboard-assigned-up").getAttribute("data-state"),
    ).toBe("unassigned");
    expect(
      screen.getByTestId("recipe-keyboard-assigned-down").textContent,
    ).toBe("W");
  });

  it("飛ばせる（全部埋めないと使えない形にしない）", () => {
    renderDialog();

    fireEvent.click(screen.getByTestId("recipe-keyboard-skip"));

    expect(screen.getByTestId("recipe-keyboard-step-down")).toBeTruthy();
  });

  it("既に登録済みなら未割当の対象から再開する", () => {
    const bindings = withBinding(createEmptyBindings(), "up", {
      code: "KeyW",
      label: "W",
    });
    renderDialog(bindings);

    expect(screen.getByTestId("recipe-keyboard-step-down")).toBeTruthy();
    expect(screen.getByTestId("recipe-keyboard-progress").textContent).toContain(
      "1 / 17",
    );
  });

  it("保存すると割当が渡る", () => {
    const { onSave } = renderDialog();

    press("KeyW", "w");
    fireEvent.click(screen.getByTestId("recipe-keyboard-save"));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0].moves.up).toEqual({
      code: "KeyW",
      label: "W",
    });
  });
});

// ===========================================================================
// ★キーリピート（2026-08-14・実機確認で発覚した不具合の回帰テスト）
// ===========================================================================
//
// ★**症状**: 案内中にキーを押しっぱなしにすると、**押していない次の対象に対して同じキーが
//   記録されようとし、身に覚えのない二重割当の確認が出る**——「W は『上』に割り当て済みです」。
//   17 件を順に登録する導線であるため、押しっぱなしは実際に起こる。
//
// ★**当初は「次々と別の対象へ割り当たる」と見立てたが、実測したら違った**——2 件目で
//   二重割当が検出され、以後は未解決の衝突が次の記録を止めるため、暴走はそこで止まる。
//   **⇒ 実際に利用者が見るのは「勝手に出る確認ダイアログ」である。**
//   ★**この差は重要である。** 「暴走しないこと」だけを主張するテストは、**リピートガードを
//     外しても緑のまま通る**（衝突検出が代わりに止めるため）。**衝突が出ないことまで
//     主張して初めて、ガードを固定できる。**

describe("キーリピート", () => {
  function pressWithRepeat(code: string, key: string, times: number) {
    fireEvent.keyDown(window, { code, key, repeat: false });
    for (let i = 0; i < times; i += 1) {
      fireEvent.keyDown(window, { code, key, repeat: true });
    }
  }

  it("★押しっぱなしでも割り当たるのは 1 件だけ", () => {
    renderDialog();

    pressWithRepeat("KeyW", "w", 5);

    // 「上」だけが登録され、次の対象（下）で待っている。
    expect(screen.getByTestId("recipe-keyboard-assigned-up").textContent).toBe("W");
    expect(
      screen.getByTestId("recipe-keyboard-assigned-down").getAttribute("data-state"),
    ).toBe("unassigned");
    expect(screen.getByTestId("recipe-keyboard-step-down")).toBeTruthy();
    expect(screen.getByTestId("recipe-keyboard-progress").textContent).toContain(
      "1 / 17",
    );
    // ★★ここが要。**身に覚えのない二重割当の確認が出ていないこと。**
    //   これを主張しないと、リピートガードを外しても緑のまま通る。
    expect(screen.queryByTestId("recipe-keyboard-conflict")).toBe(null);
  });

  it("除外キーを押しっぱなしにしても、拒否の表示は 1 つのまま", () => {
    renderDialog();

    pressWithRepeat("F5", "F5", 5);

    expect(screen.getByTestId("recipe-keyboard-excluded")).toBeTruthy();
    // 進んでいない＝同じ対象を待ち続ける。
    expect(screen.getByTestId("recipe-keyboard-step-up")).toBeTruthy();
  });

  // ★Space が登録可能になったため、案内中の Space でページがスクロールしないこと。
  it("Space を登録でき、その押下は既定動作を止める", () => {
    renderDialog();

    const event = new KeyboardEvent("keydown", {
      code: "Space",
      key: " ",
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      window.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(true);
    expect(screen.getByTestId("recipe-keyboard-assigned-up").textContent).toBe(
      "Space",
    );
  });

  // ★Esc は拒否対象であり、既定動作を奪わない（ダイアログを閉じられる状態を保つ）。
  it("Esc の既定動作は奪わない", () => {
    renderDialog();

    const event = new KeyboardEvent("keydown", {
      code: "Escape",
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      window.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(false);
  });
});

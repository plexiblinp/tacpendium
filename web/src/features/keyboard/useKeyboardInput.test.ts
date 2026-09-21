// 供給層の押下集合（M21-05 §4.5-3・§4.4）。
//
// ★**なぜ統合テストと別に要るのか。** §5 (f)（キーリピートで同じステップが並ばない）は
//   統合レベルでは**供給層のガードを両方外しても緑のまま**である。判定層が押下集合の
//   **差分**で立ち上がりを採るため、同じ集合を何度 push しても新しいステップは生まれない
//   ——**「テストが弱い」のではなく、より深い機構が代わりに守っている**
//   （`SUPP-001` §5.5 (10) の想定どおりの形）。
//
// ★⇒ 統合テストは利用者に見える挙動を固定し、**本ファイルは供給層の契約そのものを固定する**。
//   これが無いと、供給層のガードは「外しても誰も気づかない」状態になる。

import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useKeyboardInput } from "./useKeyboardInput";
import { createEmptyBindings, withBinding } from "./types";
import type { KeyboardBindings } from "./types";

function bindings(): KeyboardBindings {
  let b = createEmptyBindings();
  b = withBinding(b, "heavy_punch", { code: "KeyO", label: "O" });
  b = withBinding(b, "light_punch", { code: "KeyU", label: "U" });
  b = withBinding(b, "delete", { code: "Backspace", label: "BS" });
  return b;
}

function setup(enabled = true) {
  const onHeldChange = vi.fn();
  const onAction = vi.fn();
  const view = renderHook(() =>
    useKeyboardInput({
      enabled,
      bindings: bindings(),
      onHeldChange,
      onAction,
    }),
  );
  return { onHeldChange, onAction, view };
}

// ★`cancelable: true` を必ず付ける。付けないと `preventDefault()` を呼んでも
//   `defaultPrevented` が false のままになり、**テストが常に緑になってしまう**。
//   実ブラウザの keydown / keyup は cancelable である。
function down(code: string, repeat = false): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    code,
    key: code,
    repeat,
    bubbles: true,
    cancelable: true,
  });
  window.dispatchEvent(event);
  return event;
}

function up(code: string): KeyboardEvent {
  const event = new KeyboardEvent("keyup", {
    code,
    key: code,
    bubbles: true,
    cancelable: true,
  });
  window.dispatchEvent(event);
  return event;
}

afterEach(() => {
  (document.activeElement as HTMLElement | null)?.blur();
  document.body.innerHTML = "";
});

describe("押下集合", () => {
  it("割り当てたキーの押下で集合が増える", () => {
    const { onHeldChange } = setup();

    down("KeyO");

    expect(onHeldChange).toHaveBeenCalledTimes(1);
    expect([...onHeldChange.mock.calls[0][0]]).toEqual(["KeyO"]);
  });

  it("割り当てていないキーは無視する", () => {
    const { onHeldChange } = setup();

    down("KeyZ");

    expect(onHeldChange).not.toHaveBeenCalled();
  });

  it("離すと集合から抜ける", () => {
    const { onHeldChange } = setup();

    down("KeyO");
    up("KeyO");

    expect(onHeldChange).toHaveBeenCalledTimes(2);
    expect([...onHeldChange.mock.calls[1][0]]).toEqual([]);
  });

  // ★§4.5-3。**ここが供給層のガードを固定している唯一の場所である。**
  it("OS のキーリピートは新しい押下として扱わない", () => {
    const { onHeldChange } = setup();

    down("KeyO");
    expect(onHeldChange).toHaveBeenCalledTimes(1);

    for (let i = 0; i < 5; i += 1) down("KeyO", true);

    // ★1 回のまま。リピートはサンプルを 1 つも増やさない。
    expect(onHeldChange).toHaveBeenCalledTimes(1);
  });

  it("repeat を報告しない環境でも、同じキーの再押下はサンプルを増やさない", () => {
    const { onHeldChange } = setup();

    down("KeyO");
    for (let i = 0; i < 5; i += 1) down("KeyO", false);

    expect(onHeldChange).toHaveBeenCalledTimes(1);
  });

  it("離して押し直せば新しいサンプルになる", () => {
    const { onHeldChange } = setup();

    down("KeyO");
    up("KeyO");
    down("KeyO");

    expect(onHeldChange).toHaveBeenCalledTimes(3);
  });
});

describe("操作キー", () => {
  it("前置きなしで直接 1 操作になる", () => {
    const { onAction, onHeldChange } = setup();

    down("Backspace");

    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction.mock.calls[0][0]).toBe("delete");
    // ★押下集合には入らない（§4.2-4）。
    expect(onHeldChange).not.toHaveBeenCalled();
  });
});

describe("編集可能な要素にフォーカスがあるとき（§4.4）", () => {
  function focusEditable(html: string): HTMLElement {
    document.body.innerHTML = html;
    const el = document.body.firstElementChild as HTMLElement;
    el.focus();
    return el;
  }

  it("技入力も操作も発火しない", () => {
    const { onHeldChange, onAction } = setup();

    focusEditable(`<textarea></textarea>`);
    down("KeyO");
    down("Backspace");

    expect(onHeldChange).not.toHaveBeenCalled();
    expect(onAction).not.toHaveBeenCalled();
  });

  // ★keyup はガードを通さない。通すと、押下中にフォーカスが移ったキーが
  //   恒久的に「押されたまま」になる。
  it("押下中にテキスト欄へフォーカスが移っても、離した事実は取りこぼさない", () => {
    const { onHeldChange } = setup();

    down("KeyO");
    expect([...onHeldChange.mock.calls[0][0]]).toEqual(["KeyO"]);

    focusEditable(`<input type="text" />`);
    up("KeyO");

    expect(onHeldChange).toHaveBeenCalledTimes(2);
    expect([...onHeldChange.mock.calls[1][0]]).toEqual([]);
  });
});

describe("購読の停止", () => {
  it("enabled=false の間は購読しない（入力面が無い間は動かない）", () => {
    const { onHeldChange } = setup(false);

    down("KeyO");

    expect(onHeldChange).not.toHaveBeenCalled();
  });

  it("アンマウント後は購読しない", () => {
    const { onHeldChange, view } = setup();

    view.unmount();
    down("KeyO");

    expect(onHeldChange).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// ★既定動作の抑止（2026-08-14・開発者の実機確認で発覚した不具合の回帰テスト）
// ===========================================================================
//
// ★**症状**: 矢印キーを方向に割り当てると、ブラウザがスクロールしてしまう。
// ★**原因**: `preventDefault()` を呼ぶ**前に** early-return していたため、
//   **押し始めの 1 回だけ抑止され、OS のキーリピートが素通りしていた**。
//   方向入力は押しっぱなしが普通の使い方であるため、実質ほぼ毎回スクロールした。
//
// ★**なぜ既存テストが緑だったのか**——**`defaultPrevented` を一度も見ていなかった**。
//   「押下集合が正しく増減するか」しか確かめておらず、「既定動作を止めているか」は
//   誰も見ていなかった。**動くことと守れていることは別である。**

describe("既定動作の抑止（スクロール等）", () => {
  it("割り当てたキーの押下で既定動作を止める", () => {
    setup();
    expect(down("KeyO").defaultPrevented).toBe(true);
  });

  // ★★これが今回の不具合そのもの。押しっぱなしのリピートが素通りしてスクロールしていた。
  it("★リピートの押下でも既定動作を止める（押しっぱなしでスクロールしない）", () => {
    setup();

    expect(down("KeyO").defaultPrevented).toBe(true);
    for (let i = 0; i < 5; i += 1) {
      expect(down("KeyO", true).defaultPrevented).toBe(true);
    }
  });

  it("押下集合が既に持つキーの再押下でも既定動作を止める", () => {
    setup();

    down("KeyO");
    // `repeat` を報告しない環境でも、既定動作は止まり続けなければならない。
    expect(down("KeyO", false).defaultPrevented).toBe(true);
  });

  it("操作キーでも既定動作を止める", () => {
    setup();
    expect(down("Backspace").defaultPrevented).toBe(true);
  });

  it("割り当てたキーの keyup でも既定動作を止める", () => {
    setup();

    down("KeyO");
    expect(up("KeyO").defaultPrevented).toBe(true);
  });

  // ★登録していないキーに触ってはならない。触ると、利用者が割り当てていない
  //   矢印キーでのスクロールやブラウザのショートカットまで殺してしまう。
  it("割り当てていないキーの既定動作は止めない", () => {
    setup();

    expect(down("KeyZ").defaultPrevented).toBe(false);
    expect(down("ArrowDown").defaultPrevented).toBe(false);
    expect(up("KeyZ").defaultPrevented).toBe(false);
  });

  // ★テキスト欄では従来どおり文字が打てること（空白・矢印を奪わない）。
  it("編集可能な要素にフォーカスがある間は既定動作を止めない", () => {
    setup();

    document.body.innerHTML = `<textarea></textarea>`;
    (document.body.firstElementChild as HTMLElement).focus();

    expect(down("KeyO").defaultPrevented).toBe(false);
    expect(down("Backspace").defaultPrevented).toBe(false);
  });

  it("購読していない間（入力面が無い）は既定動作を止めない", () => {
    setup(false);
    expect(down("KeyO").defaultPrevented).toBe(false);
  });
});

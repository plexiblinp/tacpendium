import { describe, expect, it } from "vitest";

import {
  cancelConflict,
  clearTarget,
  confirmOverwrite,
  currentTarget,
  dismissRejection,
  isFinished,
  recordKey,
  registrationProgress,
  skipCurrent,
  startRegistration,
  startRetake,
} from "./keyboardRegistration";
import {
  KEYBOARD_REGISTRATION_ORDER,
  KEYBOARD_REQUIRED_TARGETS,
  bindingOf,
  createEmptyBindings,
} from "./types";

const NO_MODIFIERS = { ctrlKey: false, altKey: false, metaKey: false };

describe("登録対象の並び", () => {
  // ★§4.2-5。Gamepad の 14 件とは別の理由で決まる件数であるため、ここで固定する。
  //   ★M21-06 で 16 → 17 になった（操作が 3 → 4）。**Gamepad 側は 14 件のまま動いていない**
  //     ——増えたのは後続ボタンであって、登録する前置きボタンではないためである。
  //     ⇒ 片方の件数を見て他方を「合わせて」直さないこと。
  it("17 件（必須 10 ＋ 任意 7）である", () => {
    expect(KEYBOARD_REGISTRATION_ORDER).toHaveLength(17);
    expect(KEYBOARD_REQUIRED_TARGETS).toHaveLength(10);
  });

  it("操作 4 件が含まれる（前置き 1 件ではない）", () => {
    expect(KEYBOARD_REGISTRATION_ORDER).toContain("delete");
    expect(KEYBOARD_REGISTRATION_ORDER).toContain("save");
    expect(KEYBOARD_REGISTRATION_ORDER).toContain("modifier");
    expect(KEYBOARD_REGISTRATION_ORDER).toContain("command_mode");
    expect(KEYBOARD_REGISTRATION_ORDER).not.toContain("shortcut_prefix");
  });
});

describe("startRegistration", () => {
  it("既定を当てない（開始時点で 0 件）", () => {
    const state = startRegistration(createEmptyBindings());
    expect(registrationProgress(state.bindings).assigned).toBe(0);
    expect(currentTarget(state)).toBe("up");
  });

  it("未割当の最初の対象から再開できる", () => {
    let state = startRegistration(createEmptyBindings());
    state = recordKey(state, "KeyW", "w", NO_MODIFIERS);
    const resumed = startRegistration(state.bindings, true);
    expect(currentTarget(resumed)).toBe("down");
  });
});

describe("recordKey", () => {
  it("押したキーを記録し、次の対象へ進む", () => {
    let state = startRegistration(createEmptyBindings());
    state = recordKey(state, "KeyW", "w", NO_MODIFIERS);
    expect(bindingOf(state.bindings, "up")).toEqual({ code: "KeyW", label: "W" });
    expect(currentTarget(state)).toBe("down");
  });

  // ★§5 (b)・チェックリスト重大 10。無反応にならないこと。
  it("除外キーは理由つきで拒否し、対象を進めない", () => {
    let state = startRegistration(createEmptyBindings());
    state = recordKey(state, "F5", "F5", NO_MODIFIERS);

    expect(state.rejection).not.toBe(null);
    expect(state.rejection?.reason).toBe("function_key");
    // 進んでいない＝同じ対象を待ち続ける。
    expect(currentTarget(state)).toBe("up");
    expect(bindingOf(state.bindings, "up")).toBeUndefined();
  });

  it("拒否のあと正しいキーを押せば登録できる", () => {
    let state = startRegistration(createEmptyBindings());
    state = recordKey(state, "MetaLeft", "Meta", NO_MODIFIERS);
    expect(state.rejection?.reason).toBe("os_key");
    state = recordKey(state, "KeyW", "w", NO_MODIFIERS);
    expect(state.rejection).toBe(null);
    expect(bindingOf(state.bindings, "up")?.code).toBe("KeyW");
  });

  it("拒否の表示は明示的に消せる", () => {
    let state = startRegistration(createEmptyBindings());
    state = recordKey(state, "Tab", "Tab", NO_MODIFIERS);
    expect(state.rejection).not.toBe(null);
    state = dismissRejection(state);
    expect(state.rejection).toBe(null);
  });

  it("同じキーの二重割当を検出し、確認するまで進めない", () => {
    let state = startRegistration(createEmptyBindings());
    state = recordKey(state, "KeyW", "w", NO_MODIFIERS); // up
    state = recordKey(state, "KeyW", "w", NO_MODIFIERS); // down に同じキー

    expect(state.conflict).not.toBe(null);
    expect(state.conflict?.existing).toBe("up");
    expect(currentTarget(state)).toBe("down");
  });

  it("上書きを承知すると、元の対象からは割当が外れる", () => {
    let state = startRegistration(createEmptyBindings());
    state = recordKey(state, "KeyW", "w", NO_MODIFIERS);
    state = recordKey(state, "KeyW", "w", NO_MODIFIERS);
    state = confirmOverwrite(state);

    expect(bindingOf(state.bindings, "up")).toBeUndefined();
    expect(bindingOf(state.bindings, "down")?.code).toBe("KeyW");
  });

  it("二重割当を取り消すと元の割当が残る", () => {
    let state = startRegistration(createEmptyBindings());
    state = recordKey(state, "KeyW", "w", NO_MODIFIERS);
    state = recordKey(state, "KeyW", "w", NO_MODIFIERS);
    state = cancelConflict(state);

    expect(state.conflict).toBe(null);
    expect(bindingOf(state.bindings, "up")?.code).toBe("KeyW");
    expect(currentTarget(state)).toBe("down");
  });

  // ★技用と操作用をまたいだ衝突。またがないと 1 打鍵で技と保存が同時に起きる。
  it("技用と操作用をまたいで二重割当を検出する", () => {
    let state = startRegistration(createEmptyBindings());
    state = recordKey(state, "KeyO", "o", NO_MODIFIERS); // up に KeyO
    state = startRetake(state.bindings, "save");
    state = recordKey(state, "KeyO", "o", NO_MODIFIERS);

    expect(state.conflict?.existing).toBe("up");
  });
});

describe("skip / retake / clear", () => {
  it("必須の対象も飛ばせる（全部埋めないと使えない形にしない）", () => {
    let state = startRegistration(createEmptyBindings());
    state = skipCurrent(state);
    expect(currentTarget(state)).toBe("down");
    expect(bindingOf(state.bindings, "up")).toBeUndefined();
  });

  it("1 件だけ取り直せる", () => {
    let state = startRegistration(createEmptyBindings());
    state = recordKey(state, "KeyW", "w", NO_MODIFIERS);
    let retake = startRetake(state.bindings, "up");
    expect(currentTarget(retake)).toBe("up");
    retake = recordKey(retake, "ArrowUp", "ArrowUp", NO_MODIFIERS);
    expect(bindingOf(retake.bindings, "up")?.code).toBe("ArrowUp");
    expect(isFinished(retake)).toBe(true);
  });

  it("割当を外せる", () => {
    let state = startRegistration(createEmptyBindings());
    state = recordKey(state, "KeyW", "w", NO_MODIFIERS);
    state = clearTarget(state, "up");
    expect(bindingOf(state.bindings, "up")).toBeUndefined();
  });
});

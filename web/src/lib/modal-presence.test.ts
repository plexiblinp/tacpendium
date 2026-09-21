// 登録ストアの契約（M21-07）。
//
// ★本ファイルはストア単体のみを見る。「共有プリミティブが登録すること」「モーダルでない
//   重なりが登録しないこと」は `modal-presence.components.test.tsx` が実物の描画で見る。

import { describe, expect, it } from "vitest";

import { isAnyModalOpen, registerModalOpen } from "./modal-presence";

describe("modal-presence ストア", () => {
  it("登録すると開いている扱いになり、解除で戻る", () => {
    expect(isAnyModalOpen()).toBe(false);
    const release = registerModalOpen();
    expect(isAnyModalOpen()).toBe(true);
    release();
    expect(isAnyModalOpen()).toBe(false);
  });

  // ★boolean ではなく計数である理由の固定（確認ダイアログの上にさらに確認ダイアログ）。
  it("★重なって開いた場合、内側を閉じても外側が残っている間は開いている扱いのまま", () => {
    const outer = registerModalOpen();
    const inner = registerModalOpen();
    inner();
    expect(isAnyModalOpen()).toBe(true);
    outer();
    expect(isAnyModalOpen()).toBe(false);
  });

  // ★解除が二重に呼ばれても計数が負へ振れない（振れると、以後どれだけ開いても false になる）。
  it("★解除を二重に呼んでも計数が壊れない", () => {
    const release = registerModalOpen();
    release();
    release();
    expect(isAnyModalOpen()).toBe(false);

    const again = registerModalOpen();
    expect(isAnyModalOpen()).toBe(true);
    again();
    expect(isAnyModalOpen()).toBe(false);
  });
});

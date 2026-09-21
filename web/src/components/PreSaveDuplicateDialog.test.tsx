import { render, screen, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import "@/lib/i18n";

import ja from "@/locales/ja.json";

import { PreSaveDuplicateDialog } from "./PreSaveDuplicateDialog";

// M23-09: 保存前ダイアログ部品そのもののテスト。
//
// ★★実 ja.json を引く。文面そのものを主張したいのであって、キーの存在ではない。

const ONE = [{ id: 91, label: "画面端 中央運び" }];
const TWO = [
  { id: 91, label: "画面端 中央運び" },
  { id: 92, label: "中央 スタン狙い" },
];

function renderDialog(
  props: Partial<React.ComponentProps<typeof PreSaveDuplicateDialog>> = {},
) {
  const onRestore = vi.fn();
  const onCreateNew = vi.fn();
  const onCancel = vi.fn();
  render(
    <PreSaveDuplicateDialog
      candidates={ONE}
      kind="combo"
      busy={false}
      onRestore={onRestore}
      onCreateNew={onCreateNew}
      onCancel={onCancel}
      {...props}
    />,
  );
  return { onRestore, onCreateNew, onCancel };
}

afterEach(() => vi.clearAllMocks());

describe("PreSaveDuplicateDialog", () => {
  it("★候補が 0 件では開かない", () => {
    renderDialog({ candidates: [] });
    expect(screen.queryByTestId("pre-save-duplicate-dialog")).toBeNull();
  });

  it("★★復元ボタンの直上に「入力内容は保存されない」が常時見えている(§4.4)", () => {
    renderDialog();
    // ★開いた瞬間から見えている。何も押していない。
    expect(
      screen.getByTestId("pre-save-duplicate-restore-caution").textContent,
    ).toBe(ja.trash.preSaveDuplicate.restoreCaution);
  });

  it("★★最重要の一文が読み上げ対象(aria-describedby)に含まれている", () => {
    // ★見えているだけでは足りない。Radix は既定で Description だけを読むため、
    //   外に置いた caution を明示的に describedby へ足さないと、スクリーンリーダー
    //   利用者は「押す前に」この一文を聞けない(§4.4 が視覚利用者にしか成立しない)。
    renderDialog();
    const describedBy =
      screen
        .getByTestId("pre-save-duplicate-dialog")
        .getAttribute("aria-describedby") ?? "";
    const cautionId = screen.getByTestId("pre-save-duplicate-restore-caution").id;
    expect(cautionId).not.toBe("");
    expect(describedBy.split(/\s+/)).toContain(cautionId);
  });

  it("選択肢は「復元する」「新しく作る」＋キャンセルの 3 つで、「両方入れる」が無い", () => {
    renderDialog();
    expect(screen.getByTestId("pre-save-duplicate-restore").textContent).toBe(
      ja.trash.preSaveDuplicate.restore,
    );
    expect(
      screen.getByTestId("pre-save-duplicate-create-new").textContent,
    ).toBe(ja.trash.preSaveDuplicate.createNew);
    expect(screen.getByTestId("pre-save-duplicate-cancel").textContent).toBe(
      ja.trash.preSaveDuplicate.cancel,
    );
    expect(
      screen.getByTestId("pre-save-duplicate-dialog").textContent,
    ).not.toContain("両方");
  });

  it("★「新しく作る」を押すとゴミ箱の行が残ることが書かれている", () => {
    renderDialog();
    expect(
      screen.getByTestId("pre-save-duplicate-create-new-caution").textContent,
    ).toBe(ja.trash.preSaveDuplicate.createNewCaution);
  });

  it("★該当が 1 件のときは選択させず、そのまま復元できる", () => {
    const { onRestore } = renderDialog();
    fireEvent.click(screen.getByTestId("pre-save-duplicate-restore"));
    expect(onRestore).toHaveBeenCalledWith(91);
  });

  it("★該当が複数のときは既定選択が無く、選ぶまで復元を押せない(1 件目の決め打ちにしない)", () => {
    const { onRestore } = renderDialog({ candidates: TWO });
    expect(
      screen.getByTestId("pre-save-duplicate-restore").hasAttribute("disabled"),
    ).toBe(true);
    expect(
      screen.getByTestId("pre-save-duplicate-select-prompt").textContent,
    ).toBe(ja.trash.preSaveDuplicate.selectPrompt);

    fireEvent.click(screen.getByTestId("pre-save-duplicate-option-92"));
    fireEvent.click(screen.getByTestId("pre-save-duplicate-restore"));
    expect(onRestore).toHaveBeenCalledWith(92);
  });

  it("★busy のとき全ボタンが押せない(§4.6-1)", () => {
    const { onRestore, onCreateNew } = renderDialog({ busy: true });
    expect(
      screen.getByTestId("pre-save-duplicate-restore").hasAttribute("disabled"),
    ).toBe(true);
    expect(
      screen
        .getByTestId("pre-save-duplicate-create-new")
        .hasAttribute("disabled"),
    ).toBe(true);
    fireEvent.click(screen.getByTestId("pre-save-duplicate-restore"));
    fireEvent.click(screen.getByTestId("pre-save-duplicate-create-new"));
    expect(onRestore).not.toHaveBeenCalled();
    expect(onCreateNew).not.toHaveBeenCalled();
  });

  it("★復元に失敗したときだけ restoreFailed が出る。既定では出ない", () => {
    const { onCancel } = renderDialog();
    expect(
      screen.queryByTestId("pre-save-duplicate-restore-failed"),
    ).toBeNull();
    fireEvent.click(screen.getByTestId("pre-save-duplicate-cancel"));
    expect(onCancel).toHaveBeenCalled();
  });

  it("★kind でコンボ / セットプレイの本文が切り替わる", () => {
    const { unmount } = render(
      <PreSaveDuplicateDialog
        candidates={ONE}
        kind="setup"
        busy={false}
        onRestore={vi.fn()}
        onCreateNew={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(
      screen.getByTestId("pre-save-duplicate-dialog").textContent,
    ).toContain("セットプレイ");
    unmount();
  });
});

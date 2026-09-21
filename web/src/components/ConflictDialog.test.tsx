import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import "@/lib/i18n";

import { ConflictDialog } from "./ConflictDialog";

function renderDialog(overrides: Partial<Parameters<typeof ConflictDialog>[0]> = {}) {
  const onReload = vi.fn();
  const onClose = vi.fn();
  const onSaveAsNew = vi.fn();
  const onGoToList = vi.fn();
  render(
    <ConflictDialog
      open
      kind="versionConflict"
      resource="combo"
      viewTheirsHref="/combos/42"
      onReload={onReload}
      onSaveAsNew={null}
      onGoToList={null}
      onClose={onClose}
      {...overrides}
    />,
  );
  return { onReload, onClose, onSaveAsNew, onGoToList };
}

describe("ConflictDialog — 版不一致(コンボ)", () => {
  it("何が起きたかを伝える。★「エラー」とだけ書かない(§4.3-1)", () => {
    renderDialog();
    expect(screen.getByText("ほかの人がこのコンボを変更しました")).toBeTruthy();
    expect(
      screen.getByText(/ほかの人がこのコンボを変更しています/),
    ).toBeTruthy();
  });

  it("★入力が残っていることを伝える(§4.3-2)", () => {
    renderDialog();
    expect(screen.getByTestId("conflict-dialog-input-kept").textContent).toBe(
      "入力した内容はこのまま残っています。",
    );
  });

  it("★「防いだ」と読める文言である。「失敗」「エラー」と書かない(§4.3-6 / FR501)", () => {
    renderDialog();
    const text = screen.getByTestId("conflict-dialog").textContent ?? "";
    expect(text).toContain("いったん止めました");
    expect(text).not.toContain("失敗");
    expect(text).not.toContain("エラー");
  });

  it("★「バージョン」「排他」「競合」「コンフリクト」を使わない(§4.5-5)", () => {
    renderDialog();
    const text = screen.getByTestId("conflict-dialog").textContent ?? "";
    for (const word of ["バージョン", "排他", "競合", "コンフリクト"]) {
      expect(text).not.toContain(word);
    }
  });

  it("★「安全です」と書かない(契約 F-3)", () => {
    renderDialog();
    expect(screen.getByTestId("conflict-dialog").textContent ?? "").not.toContain("安全");
  });

  it("進む道が 2 つ示される —— 相手の内容を見る / 読み込み直す(§4.3-3)", () => {
    renderDialog();
    expect(screen.getByTestId("conflict-dialog-view-theirs")).toBeTruthy();
    expect(screen.getByTestId("conflict-dialog-reload")).toBeTruthy();
  });

  it("★「ほかの人の内容を見る」は別枠で開く。編集中の画面を離れない(§4.3-3)", () => {
    renderDialog();
    const link = screen.getByTestId("conflict-dialog-view-theirs");
    expect(link.getAttribute("href")).toBe("/combos/42");
    expect(link.getAttribute("target")).toBe("_blank");
  });

  // ★上書きの道は出さない(§4.4 案 A)。「片手落ちだ」として足させないための固定。
  it("★自分の内容で上書きする道を出さない(§4.4 案 A)", () => {
    renderDialog();
    const text = screen.getByTestId("conflict-dialog").textContent ?? "";
    expect(text).not.toContain("上書き");
    expect(screen.queryByText(/自分の内容で保存/)).toBeNull();
  });

  it("差分の自動提示を作らない(§1.6-1 / D-415)", () => {
    renderDialog();
    const text = screen.getByTestId("conflict-dialog").textContent ?? "";
    expect(text).not.toContain("差分");
  });
});

describe("ConflictDialog — 読み込み直しは 2 段階(§4.3-3)", () => {
  it("★1 回押しただけでは読み込み直さない。先に「入力が失われる」ことを伝える", async () => {
    const user = userEvent.setup();
    const { onReload } = renderDialog();

    await user.click(screen.getByTestId("conflict-dialog-reload"));

    expect(onReload).not.toHaveBeenCalled();
    expect(screen.getByTestId("conflict-dialog-reload-confirm")).toBeTruthy();
    expect(
      screen.getByText("ほかの人の内容を読み込みます。いま入力している内容は失われます。"),
    ).toBeTruthy();
  });

  it("2 段目で承諾して初めて onReload が呼ばれる", async () => {
    const user = userEvent.setup();
    const { onReload } = renderDialog();

    await user.click(screen.getByTestId("conflict-dialog-reload"));
    await user.click(screen.getByTestId("conflict-dialog-reload-execute"));

    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it("2 段目で「やめる」を押すと読み込み直さない", async () => {
    const user = userEvent.setup();
    const { onReload } = renderDialog();

    await user.click(screen.getByTestId("conflict-dialog-reload"));
    await user.click(screen.getByTestId("conflict-dialog-reload-cancel"));

    expect(onReload).not.toHaveBeenCalled();
  });
});

describe("ConflictDialog — 404(キー変更編集に負けた側。§4.3-7 / §1.3.1)", () => {
  // ★★本 describe は v1.4.0 まで onSaveAsNew / onGoToList を渡さない形で書かれており、
  //   「閉じるだけ」の絵姿を部品層で緑のまま保存していた(D-417 で塞いだ状態そのもの)。
  //   ⇒ ComboEditor が実際に渡す形(§4.7.2)へ合わせる。部品を単体で見るテストでも、
  //     アプリでの使われ方から外れた構成を固定すると、行き止まりを検出できない。
  const onSaveAsNew = vi.fn();
  const onGoToList = vi.fn();
  const notFoundProps = {
    kind: "notFound" as const,
    viewTheirsHref: null,
    onReload: null,
    onSaveAsNew,
    onGoToList,
  };

  it("入力が残っていることは 409 と同じく必ず伝える", () => {
    renderDialog(notFoundProps);
    expect(screen.getByTestId("conflict-dialog-input-kept")).toBeTruthy();
  });

  // ★404 は「本当に削除された」場合にも来る。サーバは両者に同じコード・同じ
  //   メッセージを返すため区別できない ⇒ 区別しない文言であることを固定する。
  it("★「ほかの人が変更しました」と断定しない。作り直し／削除の両方を書く", () => {
    renderDialog(notFoundProps);
    const text = screen.getByTestId("conflict-dialog").textContent ?? "";
    expect(text).toContain("作り直した");
    expect(text).toContain("削除した");
    expect(text).not.toContain("ほかの人がこのコンボを変更しました");
  });

  // ★出さないのは「旧行を指す 2 本」だけである。ここを「閉じるだけ」と読み替えないこと。
  it("行がもう無いため、相手の内容を見る／読み込み直すの導線は出さない", () => {
    renderDialog(notFoundProps);
    expect(screen.queryByTestId("conflict-dialog-view-theirs")).toBeNull();
    expect(screen.queryByTestId("conflict-dialog-reload")).toBeNull();
  });

  // ★★【追補・§4.7.2 / §5.1-14】部品層でも「閉じるだけ」にならないことを固定する。
  //   ★消去法で 2 本が消えた結果、選択肢が「閉じる」1 つになる形を防ぐ番人である。
  it("★保存する道と脱出路が出ており、「閉じる」だけになっていない", () => {
    renderDialog(notFoundProps);
    expect(screen.getByTestId("conflict-dialog-save-as-new")).toBeTruthy();
    expect(screen.getByTestId("conflict-dialog-go-to-list")).toBeTruthy();
  });

  it("★「この内容で新しく登録する」は 2 段階で、通すと呼び出し元へ届く", async () => {
    const user = userEvent.setup();
    renderDialog(notFoundProps);

    await user.click(screen.getByTestId("conflict-dialog-save-as-new"));
    expect(onSaveAsNew).not.toHaveBeenCalled();

    await user.click(screen.getByTestId("conflict-dialog-save-as-new-execute"));
    expect(onSaveAsNew).toHaveBeenCalledTimes(1);
  });

  it("★「コンボ一覧へ」も 2 段階で、やめれば呼ばれない", async () => {
    const user = userEvent.setup();
    renderDialog(notFoundProps);

    await user.click(screen.getByTestId("conflict-dialog-go-to-list"));
    expect(screen.getByTestId("conflict-dialog-go-to-list-confirm").textContent).toContain(
      "失われます",
    );

    await user.click(screen.getByTestId("conflict-dialog-go-to-list-cancel"));
    expect(onGoToList).not.toHaveBeenCalled();
  });
});

describe("ConflictDialog — セットプレイの文言", () => {
  it("資源に応じて「セットプレイ」と出る", () => {
    renderDialog({ resource: "setup" });
    expect(screen.getByText("ほかの人がこのセットプレイを変更しました")).toBeTruthy();
  });
});

describe("ConflictDialog — 閉じる", () => {
  it("閉じるボタンで onClose が呼ばれる", async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog();
    await user.click(screen.getByTestId("conflict-dialog-close"));
    expect(onClose).toHaveBeenCalled();
  });

  it("open=false のときは何も出さない", () => {
    renderDialog({ open: false });
    expect(screen.queryByTestId("conflict-dialog")).toBeNull();
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import "@/lib/i18n";
import Step05Network from "./Step05Network";

// Step 5 の警告(DES-005 §5.1「Step 5 の要件」1〜4 / CHANGE-185)。
//
// ★着手前、本コンポーネントにテストは 1 本も無かった。

const WARNING = "wizard-lan-warning";

function renderStep(lanEnabled: boolean, onChange = vi.fn()) {
  return render(
    <Step05Network
      lanEnabled={lanEnabled}
      onChange={onChange}
      onNext={vi.fn()}
      onPrev={vi.fn()}
    />,
  );
}

describe("Step05Network の LAN 警告", () => {
  it("★LAN 有効のときは警告が出る(要件 1・2)", () => {
    renderStep(true);

    const warning = screen.getByTestId(WARNING);
    // 要件 1: 何をされうるかを述べる。「アクセスできます」では足りない。
    expect(warning.textContent).toContain("追加・変更・削除");
    // 要件 2: 届かない範囲も述べる。恐怖だけ与えて判断材料を与えない形にしない。
    expect(warning.textContent).toContain("別の回線からは開けません");
  });

  it("★★LAN 無効のときは警告も同意も 1 つも出ない(要件 3)", () => {
    renderStep(false);

    // ★公開していない人に「誰でも変更できます」と告げないこと(指示書 §4.3)。
    expect(screen.queryByTestId(WARNING)).toBeNull();
    expect(screen.queryByText(/追加・変更・削除/)).toBeNull();
  });

  it("★警告はヒントと同じ見え方にしない(要件 4)", () => {
    renderStep(true);

    // ★設定画面(SettingsSectionNetwork)は見出しを警告色で出している。同じ強さにする。
    const heading = screen.getByText("ほかの機器から使えるようにします");
    expect(heading.className).toContain("text-yellow-700");
    // ★ヒントの 1 行は据え置き。こちらは警告色を持たない。
    const hint = screen.getByText(/LAN モードでは同一ネットワーク上の/);
    expect(hint.className).not.toContain("text-yellow-700");
  });

  it("★★LAN を選び直すと警告の出方が切り替わる(陰性対照)", async () => {
    // ★「無効のとき出ない」だけでは、警告が常に出ないだけかもしれない(E-84)。
    //   ⇒ 同じマウントのまま出る側・出ない側の両方を通す。
    //   ★rerender を使うこと。render を 2 回呼ぶと 2 インスタンスが同時に
    //     document.body へ載り、「切り替わった」ではなく「2 つ在る」を見てしまう。
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = renderStep(false, onChange);

    expect(screen.queryByTestId(WARNING)).toBeNull();

    // 選択そのものは親へ上げる(本コンポーネントは lanEnabled を持たない)。
    await user.click(screen.getByText("LAN モードを有効にする"));
    expect(onChange).toHaveBeenCalledWith(true);

    // 親が受け取った結果を返した体で、同じマウントを描き直す。
    rerender(
      <Step05Network lanEnabled onChange={onChange} onNext={vi.fn()} onPrev={vi.fn()} />,
    );
    expect(screen.getAllByTestId(WARNING).length).toBe(1);

    // ★戻す向きも通す。片道だけだと「一度出たら消えない」作りでも緑になる。
    rerender(
      <Step05Network
        lanEnabled={false}
        onChange={onChange}
        onNext={vi.fn()}
        onPrev={vi.fn()}
      />,
    );
    expect(screen.queryByTestId(WARNING)).toBeNull();
  });

  it("★警告は読み上げ環境にも届く(role=alert)", () => {
    // ★枠は操作のあとに DOM へ入る。role が無いと、読み上げ環境では警告が
    //   存在しないのと同じになる。要件は「告げること」そのものである。
    renderStep(true);

    expect(screen.getByRole("alert")).toBe(screen.getByTestId(WARNING));
  });
});

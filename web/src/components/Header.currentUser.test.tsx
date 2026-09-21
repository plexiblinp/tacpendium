import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@/lib/i18n";

import Header from "./Header";
import { useCurrentUser } from "@/features/user/CurrentUserProvider";

// ★開発者の実機確認 ⑤(2026-08-16): 選択中の利用者がどこにも出ていなかった。
// 表示は設定画面の中だけで、ふだん見る画面からは分からない状態だった。
//
// ★出すのは 2 人以上のときだけである(開発者裁定)。1 人しかいない環境では
// 選択画面も出ない(FR502)。同じ考え方で、ヘッダの見た目もいままでと変えない。
// ⇒ 本ファイルは「出る」と「出ない」を対で固定する。片方だけでは守れない。
//
// Provider ごと差し替えるのは、context の値を外から与えるためである
// (Provider 本体は利用者一覧の問い合わせを持つため、ここでは通したくない)。
vi.mock("@/features/user/CurrentUserProvider", () => ({
  useCurrentUser: vi.fn(),
}));

const mockedUseCurrentUser = vi.mocked(useCurrentUser);

const reselect = vi.fn();

function setCurrentUser(value: Partial<ReturnType<typeof useCurrentUser>>) {
  mockedUseCurrentUser.mockReturnValue({
    current: null,
    multiUser: false,
    reselect,
    ...value,
  });
}

function renderHeader() {
  return render(
    <MemoryRouter initialEntries={["/combos"]}>
      <Header />
    </MemoryRouter>,
  );
}

describe("Header の利用者表示", () => {
  beforeEach(() => {
    reselect.mockClear();
  });

  it("2 人以上いるときは、選択中の利用者の名前を出す", () => {
    setCurrentUser({ current: { id: 2, name: "あきら" }, multiUser: true });
    renderHeader();

    const chip = screen.getByTestId("header-current-user");
    expect(chip.textContent).toContain("あきら");
    // ★何のための表示かが読み上げでも分かること。
    expect(chip.getAttribute("aria-label")).toContain("あきら");
  });

  it("利用者が 1 人なら出さない(1 人運用の非回帰)", () => {
    setCurrentUser({ current: { id: 1, name: "default" }, multiUser: false });
    renderHeader();

    expect(screen.queryByTestId("header-current-user")).toBeNull();
  });

  it("押すと使う人を選び直せる", async () => {
    const user = userEvent.setup();
    setCurrentUser({ current: { id: 2, name: "あきら" }, multiUser: true });
    renderHeader();

    await user.click(screen.getByTestId("header-current-user"));
    expect(reselect).toHaveBeenCalledTimes(1);
  });

  // ★既存のナビゲーションを壊していないこと(表示を足しただけである)。
  it("ナビゲーションのリンクはそのまま出る", () => {
    setCurrentUser({ current: { id: 2, name: "あきら" }, multiUser: true });
    renderHeader();

    expect(screen.getByText("コンボ一覧")).toBeTruthy();
    expect(screen.getByText("設定")).toBeTruthy();
  });
});

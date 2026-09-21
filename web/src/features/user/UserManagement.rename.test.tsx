import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@/lib/i18n";

// ★userApi だけを差し替える。フック(useUsers / useRenameUser)と
// CurrentUserProvider は実物を通す——ヘッダ追随はこの配線の上で成り立つため、
// フックを差し替えると「追随するか」を見られない(M22-02 横断課題 9/10 と同じ面)。
vi.mock("./userApi", () => ({
  userApi: {
    list: vi.fn(),
    create: vi.fn(),
    rename: vi.fn(),
  },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import Header from "@/components/Header";
import CurrentUserProvider from "./CurrentUserProvider";
import UserManagement from "./UserManagement";
import { userApi } from "./userApi";
import type { User } from "./types";

const mockedApi = vi.mocked(userApi);

/** users は list() が返す配列。改名が通ったらここを書き換える。 */
let users: User[];

function renderWithProvider() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/combos"]}>
        <CurrentUserProvider>
          <Header />
          <UserManagement />
        </CurrentUserProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  users = [{ id: 1, name: "ひとりめ" }];
  mockedApi.list.mockImplementation(() => Promise.resolve(users));
});

// ===========================================================================
// M22-08 §5.1-10 / §5.1-11: 利用者の改名
// ===========================================================================

describe("M22-08 利用者の改名", () => {
  it("名前を変えられる", async () => {
    const user = userEvent.setup();
    mockedApi.rename.mockImplementation((id, req) => {
      users = users.map((u) => (u.id === id ? { ...u, name: req.name } : u));
      return Promise.resolve(users[0]);
    });

    renderWithProvider();
    await screen.findByTestId("settings-user-rename");

    await user.click(screen.getByTestId("settings-user-rename"));
    const input = screen.getByTestId("settings-user-rename-name") as HTMLInputElement;
    // ★いまの名前が初期値として入っている(打ち直しを強いない)。
    expect(input.value).toBe("ひとりめ");

    await user.clear(input);
    await user.type(input, "あたらしいなまえ");
    await user.click(screen.getByTestId("settings-user-rename-submit"));

    await waitFor(() => {
      expect(mockedApi.rename).toHaveBeenCalledWith(1, { name: "あたらしいなまえ" });
    });
  });

  // ★★これが §4.5-4 である。追随しないと、改名したのにヘッダへ古い名前が出たままになる。
  // ★仕組みは「USERS_KEY を引き直すと CurrentUserProvider の current が導出し直される」。
  // 自動でそうなる形だからこそ、壊れても気づけない。ここで固定する。
  it("選択中の利用者を改名すると、ヘッダの表示が追随する", async () => {
    const user = userEvent.setup();
    // ★ヘッダの利用者表示は 2 人以上のときだけ出る(CHANGE-113 §2-m)。
    users = [
      { id: 1, name: "ひとりめ" },
      { id: 2, name: "ふたりめ" },
    ];
    mockedApi.rename.mockImplementation((id, req) => {
      users = users.map((u) => (u.id === id ? { ...u, name: req.name } : u));
      return Promise.resolve(users.find((u) => u.id === id)!);
    });

    renderWithProvider();

    // 2 人いるので選択画面が出る。ひとりめを選ぶ。
    const pick = await screen.findByTestId("user-select-item-1");
    await user.click(pick);

    const header = await screen.findByTestId("header-current-user");
    expect(header.textContent).toContain("ひとりめ");

    await user.click(screen.getByTestId("settings-user-rename"));
    const input = screen.getByTestId("settings-user-rename-name");
    await user.clear(input);
    await user.type(input, "あらため");
    await user.click(screen.getByTestId("settings-user-rename-submit"));

    await waitFor(() => {
      expect(screen.getByTestId("header-current-user").textContent).toContain("あらため");
    });
    // 古い名前が残っていないこと。
    expect(screen.getByTestId("header-current-user").textContent).not.toContain("ひとりめ");
  });

  // ★サーバ側の検証を作り直さず、返ってきた理由を見せるだけである(指示書 §4.5-3)。
  it("重複名(409)は「すでに使われています」と出る", async () => {
    const user = userEvent.setup();
    mockedApi.rename.mockRejectedValue(new Error("HTTP 409: {}"));

    renderWithProvider();
    await screen.findByTestId("settings-user-rename");

    await user.click(screen.getByTestId("settings-user-rename"));
    const input = screen.getByTestId("settings-user-rename-name");
    await user.clear(input);
    await user.type(input, "ふたりめ");
    await user.click(screen.getByTestId("settings-user-rename-submit"));

    const error = await screen.findByTestId("settings-user-rename-error");
    expect(error.textContent).toContain("すでに使われています");
  });

  it("空名(400)は「名前を入れてください」と出る", async () => {
    const user = userEvent.setup();
    // ★画面側でも空は押せないため、サーバが 400 を返す形を直接与えて確かめる
    //   (curl 相当の経路で 400 が返ったときに、その理由が見えること)。
    mockedApi.rename.mockRejectedValue(new Error("HTTP 400: {}"));

    renderWithProvider();
    await screen.findByTestId("settings-user-rename");

    await user.click(screen.getByTestId("settings-user-rename"));
    const input = screen.getByTestId("settings-user-rename-name");
    await user.clear(input);
    await user.type(input, "  ");
    // 空白だけでは押せない。実在する名前へ替えてから送り、応答側の 400 を見る。
    await user.clear(input);
    await user.type(input, "なにか");
    await user.click(screen.getByTestId("settings-user-rename-submit"));

    const error = await screen.findByTestId("settings-user-rename-error");
    expect(error.textContent).toContain("名前を入れてください");
  });

  it("空のままでは送れない", async () => {
    const user = userEvent.setup();
    renderWithProvider();
    await screen.findByTestId("settings-user-rename");

    await user.click(screen.getByTestId("settings-user-rename"));
    await user.clear(screen.getByTestId("settings-user-rename-name"));

    expect(
      (screen.getByTestId("settings-user-rename-submit") as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(mockedApi.rename).not.toHaveBeenCalled();
  });

  // ★削除は作らない(指示書 §1.5-5)。tags / presets が ON DELETE CASCADE で
  // users を参照しており、消すとその人のタグ・プリセットが一括で消える。
  it("削除の導線を作っていない", async () => {
    renderWithProvider();
    await screen.findByTestId("settings-user-rename");

    expect(screen.queryByTestId("settings-user-delete")).toBeNull();
    expect(screen.queryByText(/削除/)).toBeNull();
  });
});

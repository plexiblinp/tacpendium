import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { ReactNode } from "react";

import "@/lib/i18n";

vi.mock("./useUsers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./useUsers")>();
  return { ...actual, useUsers: vi.fn() };
});

import CurrentUserProvider, { useCurrentUser } from "./CurrentUserProvider";
import { useUsers } from "./useUsers";
import { setUserIdProvider } from "@/lib/http-interceptor";
import type { User } from "./types";

const mockedUseUsers = vi.mocked(useUsers);

function setUsers(users: User[] | undefined, isLoading = false) {
  mockedUseUsers.mockReturnValue({
    data: users,
    isLoading,
  } as unknown as ReturnType<typeof useUsers>);
}

/** 選択中の利用者と選び直しボタンを出すだけの覗き窓。 */
function Probe() {
  const { current, reselect } = useCurrentUser();
  return (
    <div>
      <span data-testid="current">{current?.name ?? "(なし)"}</span>
      <button type="button" onClick={reselect}>
        選び直す
      </button>
    </div>
  );
}

function renderProvider(children: ReactNode = <Probe />) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <CurrentUserProvider>{children}</CurrentUserProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  setUserIdProvider(null);
});

describe("CurrentUserProvider", () => {
  // ★§5.1-9（重大 §9-3）: 利用者が 1 人なら選択画面を出さない(FR502)。
  // ⇒ 無効かつ 1 人なら、いままでと 1 バイトも変わらない。
  it("利用者が 1 人なら選択画面を出さず、自動で選ぶ", async () => {
    setUsers([{ id: 1, name: "default" }]);
    renderProvider();

    expect(screen.queryByTestId("user-select-title")).toBeNull();
    expect(await screen.findByTestId("current")).toBeTruthy();
    expect(screen.getByTestId("current").textContent).toBe("default");
  });

  // §5.1-10
  it("利用者が 2 人以上なら選択画面を出す", () => {
    setUsers([
      { id: 1, name: "A" },
      { id: 2, name: "B" },
    ]);
    renderProvider();

    expect(screen.getByTestId("user-select-title")).toBeTruthy();
    expect(screen.queryByTestId("current")).toBeNull();
  });

  // §5.1-16: 選んだあとは選択画面へ戻らない。
  it("選ぶとアプリ本体が出て、選択画面へは戻らない", async () => {
    const user = userEvent.setup();
    setUsers([
      { id: 1, name: "A" },
      { id: 2, name: "B" },
    ]);
    renderProvider();

    await user.click(screen.getByTestId("user-select-item-2"));

    expect(screen.getByTestId("current").textContent).toBe("B");
    expect(screen.queryByTestId("user-select-title")).toBeNull();
  });

  // ★「選び直す」導線として意図して出すのは別である(指示書 §4.8-5)。
  it("選び直しを押したときだけ選択画面へ戻る", async () => {
    const user = userEvent.setup();
    setUsers([
      { id: 1, name: "A" },
      { id: 2, name: "B" },
    ]);
    renderProvider();

    await user.click(screen.getByTestId("user-select-item-1"));
    expect(screen.getByTestId("current").textContent).toBe("A");

    await user.click(screen.getByRole("button", { name: "選び直す" }));
    expect(screen.getByTestId("user-select-title")).toBeTruthy();
  });

  // ★CHANGE-113 §7-1 の案 (α): 選んだ利用者は保持しない。
  // 作り直す(＝再読み込みに相当する)と選択画面へ戻る。★これは仕様である。
  it("作り直すと選択が消えて選択画面へ戻る", async () => {
    const user = userEvent.setup();
    setUsers([
      { id: 1, name: "A" },
      { id: 2, name: "B" },
    ]);
    const first = renderProvider();
    await user.click(screen.getByTestId("user-select-item-2"));
    expect(screen.getByTestId("current").textContent).toBe("B");
    first.unmount();

    renderProvider();
    expect(screen.getByTestId("user-select-title")).toBeTruthy();
  });

  // ★一覧が読めなくてもアプリを止めない。サーバ側は X-User-Id が無ければ
  // users.id の最小値へ倒すため、いままでどおり動く。
  it("一覧が読めなくてもアプリを止めない", () => {
    setUsers(undefined);
    renderProvider();

    expect(screen.getByTestId("current")).toBeTruthy();
    expect(screen.queryByTestId("user-select-title")).toBeNull();
  });
});

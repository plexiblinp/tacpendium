import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation } from "react-router-dom";

import ja from "@/locales/ja.json";
import { TrashListRow } from "./TrashListRow";
import type { ComboSummary } from "../types";

// ★i18n は「キーをそのまま返す」モックにしない(M23-04 教訓 2 / M23-06 §5.1)。
//   本ファイルはチェックボックスの aria-label など文面を引くため、実 ja.json を使う。
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) => {
      const raw = key
        .split(".")
        .reduce<unknown>((acc, k) => (acc as Record<string, unknown> | undefined)?.[k], ja);
      if (typeof raw !== "string") return key;
      return raw.replace(/\{\{(\w+)\}\}/g, (_m, name: string) => String(vars?.[name] ?? ""));
    },
  }),
}));

// ★★M23-06 §4.7: 不活性だったアサーションの作り替え。
//
// 元のケースは `expect(link.closest("td")?.onclick).toBeDefined;` と書かれており、
// (a) 関数として呼ばれていない (b) React は onClick を委譲で付けるため DOM の
// td.onclick は null であり、括弧を足しても `null !== undefined` で緑のまま通る、
// という二重の意味で何も検証していなかった。★括弧を足すだけでは直らない。
//
// ⇒ テスト名が主張しているそのもの——「遷移がちょうど 1 回だけ起きる」——を検証する。
//   行には 2 つの遷移源がある。始動状況セルの <Link>(ルータが遷移する)と、行(tr)の
//   onClick(useNavigate で遷移する)である。始動状況セルは stopPropagation で tr へ
//   伝播させておらず、外すと 1 クリックで両方が発火して 2 回遷移する。
//   ⇒ ルータの遷移先を記録する見張りと、useNavigate のモックの両方を置き、
//     「どちらが何回発火したか」を分けて主張する。
const navigateMock = vi.hoisted(() => vi.fn());
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

// ルータが実際に移った先を、変化したときだけ記録する。
const visitedPaths: string[] = [];
function LocationRecorder() {
  const location = useLocation();
  if (visitedPaths[visitedPaths.length - 1] !== location.pathname) {
    visitedPaths.push(location.pathname);
  }
  return null;
}

function makeCombo(id: number, deletedAt: string): ComboSummary {
  return {
    id,
    characterId: 1,
    isDraft: false,
    affectedByGameUpdate: false,
    affectedMoves: [],
    stepCount: 2,
    version: 1,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    tags: [],
    defaultRecipe: "",
    starterMoveCode: "",
    deletedAt,
  };
}

function renderRow(
  combo: ComboSummary,
  overrides?: {
    selected?: boolean;
    onSelectionChange?: ReturnType<typeof vi.fn>;
    onComboChanged?: ReturnType<typeof vi.fn>;
  },
) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <LocationRecorder />
        <table>
          <tbody>
            <TrashListRow
              combo={combo}
              selected={overrides?.selected ?? false}
              onSelectionChange={overrides?.onSelectionChange ?? vi.fn()}
              onComboChanged={overrides?.onComboChanged ?? vi.fn()}
            />
          </tbody>
        </table>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("TrashListRow", () => {
  beforeEach(() => {
    navigateMock.mockClear();
    visitedPaths.length = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("始動状況セルクリックで navigate が1回のみ呼ばれる", async () => {
    const user = userEvent.setup();
    renderRow(makeCombo(1, "2026-04-09T00:00:00Z"));

    await user.click(screen.getByRole("link"));

    // ★遷移したのは Link 側だけである。tr の onClick は stopPropagation で
    //   止まっており、useNavigate は呼ばれていない。
    //   ⇒ stopPropagation を外すと、ここが 1 回呼ばれて赤くなる。
    expect(navigateMock).not.toHaveBeenCalled();
    // ★ルータが移った先は /combos/1 ちょうど 1 回である。
    expect(visitedPaths).toEqual(["/", "/trash/combos/1"]);
  });

  it("行(始動状況セル以外)のクリックでは useNavigate で 1 回だけ遷移する", async () => {
    const user = userEvent.setup();
    renderRow(makeCombo(1, "2026-04-09T00:00:00Z"));

    // ダメージのセルは stopPropagation を持たないので、行の onClick が効く。
    const [dataRow] = screen.getAllByRole("row");
    await user.click(dataRow.querySelectorAll("td")[2]);

    expect(navigateMock).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenCalledWith("/trash/combos/1");
  });

  // ★★M23-07 §3.3-8 / §5.2-5: 遷移リンクは 2 か所ある(行全体の onClick と
  //   始動状況セルの <Link>)。★両方が同じ行き先を向いていること——片方だけ直すと、
  //   クリックした場所によって 404 になったりならなかったりする。
  it("遷移リンクの全数(2 か所)が同じ行き先を向いている", async () => {
    const user = userEvent.setup();
    const { container } = renderRow(makeCombo(1, "2026-04-09T00:00:00Z"));

    // 行の中の遷移手段を数える。<a> は 1 本だけである。
    const anchors = Array.from(container.querySelectorAll("a"));
    expect(anchors.length).toBe(1);
    const linkTarget = anchors[0].getAttribute("href");

    // 行クリック側の行き先を取る。
    const [dataRow] = screen.getAllByRole("row");
    await user.click(dataRow.querySelectorAll("td")[2]);
    expect(navigateMock).toHaveBeenCalledTimes(1);
    const rowTarget = navigateMock.mock.calls[0][0];

    expect(rowTarget).toBe(linkTarget);
    expect(rowTarget).toBe("/trash/combos/1");
  });

  it("チェックボックスのクリックでは遷移しない", async () => {
    const user = userEvent.setup();
    renderRow(makeCombo(1, "2026-04-09T00:00:00Z"));

    await user.click(screen.getByRole("checkbox"));

    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("復元失敗時に role=alert でエラーメッセージが表示される", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network error"));
    renderRow(makeCombo(1, "2026-04-09T00:00:00Z"));

    await user.click(screen.getByRole("button", { name: "復元" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
    });
    expect(screen.getByRole("alert").textContent).toMatch(/復元に失敗しました/);
  });

  it("完全削除失敗時に role=alert でエラーメッセージが表示される", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("server error"));
    renderRow(makeCombo(1, "2026-04-09T00:00:00Z"));

    await user.click(screen.getByRole("button", { name: "完全削除" }));
    await user.click(screen.getByRole("button", { name: "完全削除する" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
    });
    expect(screen.getByRole("alert").textContent).toMatch(/完全削除に失敗しました/);
  });

  it("完全削除成功時にエラーが表示されない", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    );
    renderRow(makeCombo(1, "2026-04-09T00:00:00Z"));

    await user.click(screen.getByRole("button", { name: "完全削除" }));
    await user.click(screen.getByRole("button", { name: "完全削除する" }));

    await waitFor(() => {
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });

  it("復元成功時にエラーが表示されない", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    );
    renderRow(makeCombo(1, "2026-04-09T00:00:00Z"));

    await user.click(screen.getByRole("button", { name: "復元" }));

    await waitFor(() => {
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });
});

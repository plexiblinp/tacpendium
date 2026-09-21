import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

import ja from "@/locales/ja.json";
import { TAG_CATEGORY_MYCOMBO_STATUS } from "@/constants/mycombo";
import { TrashList } from "./TrashList";
import type { ComboSummary } from "../types";

// ★M23-04 で TrashListRow が useTranslation を使うようになり、i18n インスタンスが
//   無いことの警告(NO_I18NEXT_INSTANCE)が出るようになった。
//   ★キーをそのまま返すモックにはしない——このテストへ将来「文面」の主張を足したとき、
//   キー文字列が返って通ってしまう(M23-04 完了報告の横断課題 4 と同じ落とし穴)。
//   ⇒ 実 ja.json を引いて {{var}} を差し込む最小の t を使う。
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

function mockFetchResponse(body: unknown, status = 200) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(body), { status }),
  );
}

function renderList(
  combos: ComboSummary[],
  selectedIds: number[] = [],
  onSelectionChange = vi.fn(),
  onComboChanged = vi.fn(),
) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <TrashList
          combos={combos}
          selectedIds={selectedIds}
          onSelectionChange={onSelectionChange}
          onComboChanged={onComboChanged}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("TrashList", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("コンボ一覧を2行表示する", () => {
    const deletedAt = "2026-04-09T00:00:00Z";
    renderList([makeCombo(1, deletedAt), makeCombo(2, deletedAt)]);
    expect(screen.getAllByRole("row")).toHaveLength(3); // ヘッダ + 2行
  });

  it("空リスト: 「ゴミ箱は空です」が表示される", () => {
    renderList([]);
    expect(screen.getByText("ゴミ箱は空です")).toBeTruthy();
  });

  // M23-01 §4.4: 残日数の撤回。保持は無期限で確定しており(D-458)、90 日の自動完全削除は
  // サーバ側に機構が存在しない。列そのものを撤去したことを否定形で固定する。
  // ★★M23-06 §4.1 で「ルート」列も撤去したため 7 → 6 になった。数を減らす向きの
  //   更新であり、この主張が守っている意図(列を足して撤去を巻き戻さない)は変わらない。
  it("行が 6 列である(残日数の列もルートの列も無い)", () => {
    renderList([makeCombo(1, "2026-04-09T00:00:00Z")]);
    const [, dataRow] = screen.getAllByRole("row");
    expect(dataRow.querySelectorAll("td")).toHaveLength(6);
  });

  it("ヘッダに「残日数」が無い", () => {
    renderList([makeCombo(1, "2026-04-09T00:00:00Z")]);
    expect(screen.queryByText("残日数")).toBeNull();
  });

  it("削除日時が30日前でも「あと N 日」を表示しない", () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    renderList([makeCombo(1, thirtyDaysAgo)]);
    expect(screen.queryByText(/あと \d+ 日/)).toBeNull();
  });

  it("削除日時が91日前でも「期限切れ」を表示しない", () => {
    const ninetyOneDaysAgo = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000).toISOString();
    renderList([makeCombo(1, ninetyOneDaysAgo)]);
    expect(screen.queryByText("期限切れ")).toBeNull();
  });

  it("チェックボックス選択で onSelectionChange が呼ばれる", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    renderList([makeCombo(1, "2026-04-09T00:00:00Z")], [], onSelectionChange);
    await user.click(screen.getByLabelText("コンボ 1 を選択"));
    expect(onSelectionChange).toHaveBeenCalledWith([1]);
  });

  it("全選択チェックボックスで全 ID が選択される", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    const deletedAt = "2026-04-09T00:00:00Z";
    renderList([makeCombo(1, deletedAt), makeCombo(2, deletedAt)], [], onSelectionChange);
    await user.click(screen.getByLabelText("全選択"));
    expect(onSelectionChange).toHaveBeenCalledWith([1, 2]);
  });

  it("復元ボタンクリックで POST /api/combos/:id/restore が呼ばれる", async () => {
    const user = userEvent.setup();
    const fetchSpy = mockFetchResponse({});
    renderList([makeCombo(1, "2026-04-09T00:00:00Z")]);
    await user.click(screen.getByRole("button", { name: "復元" }));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const url = fetchSpy.mock.calls[0][0] as string;
    const method = (fetchSpy.mock.calls[0][1] as RequestInit).method;
    expect(url).toBe("/api/combos/1/restore");
    expect(method).toBe("POST");
  });

  it("完全削除ボタンクリックで確認ダイアログが表示される", async () => {
    const user = userEvent.setup();
    renderList([makeCombo(1, "2026-04-09T00:00:00Z")]);
    await user.click(screen.getByRole("button", { name: "完全削除" }));
    expect(screen.getByRole("alertdialog")).toBeTruthy();
  });
  // =========================================================================
  // M23-06 §4.1: ルート列の撤去
  //
  // ★★「空表示に変えた」ではなく「列ごと消した」ことを固定する。論理削除の時点で
  //   combos.recipe_cache が NULL になるため、削除済み行に出せるレシピは構造的に
  //   存在せず、列を残す限り常に定数になる(D-458 の残日数と同じ論理)。
  // ★セットプレイ側のレシピは逆に「出す」(§4.3)。根が同じでも答えは違う——
  //   コンボは memo と始動状況で識別できるが、セットプレイは名前が空だと
  //   識別手段がゼロになる。この非対称は意図である。
  // =========================================================================
  it("§5.1-1 ヘッダに「ルート」が無い", () => {
    renderList([makeCombo(1, "2026-04-09T00:00:00Z")]);
    expect(screen.queryByText("ルート")).toBeNull();
  });

  it("§5.1-1 セルに「(レシピ表示なし)」が無い", () => {
    renderList([makeCombo(1, "2026-04-09T00:00:00Z")]);
    expect(screen.queryByText("(レシピ表示なし)")).toBeNull();
  });

  // =========================================================================
  // M23-06 §4.2: タグ列の描画
  //
  // ★応答には元から載っている(一覧 API がタグを IN 句で一括取得している)。
  //   描画していなかっただけである。⇒ 新しくデータを取りに行かない。
  // =========================================================================
  it("§5.1-2 応答に載っているタグを描画する", () => {
    const combo = {
      ...makeCombo(1, "2026-04-09T00:00:00Z"),
      tags: [
        { id: 1, userId: 1, name: "実戦用", color: "#3B82F6" },
        { id: 2, userId: 1, name: "画面端", color: "#10B981" },
      ],
    };
    renderList([combo]);

    expect(screen.getByText("実戦用")).toBeTruthy();
    expect(screen.getByText("画面端")).toBeTruthy();
  });

  it("§5.1-2 マイコンボ状態のタグは一覧画面と同じく除外される", () => {
    const combo = {
      ...makeCombo(1, "2026-04-09T00:00:00Z"),
      tags: [
        { id: 1, userId: 1, name: "実戦用", color: "#3B82F6" },
        { id: 3, userId: 1, name: "練習中", color: "#F59E0B", category: TAG_CATEGORY_MYCOMBO_STATUS },
      ],
    };
    renderList([combo]);

    expect(screen.getByText("実戦用")).toBeTruthy();
    expect(screen.queryByText("練習中")).toBeNull();
  });

  it("§5.1-3 タグ 0 件のとき、ゴミ箱専用の空表示を作らない(一覧画面と同じく何も出さない)", () => {
    renderList([makeCombo(1, "2026-04-09T00:00:00Z")]);
    const [, dataRow] = screen.getAllByRole("row");
    const tagCell = dataRow.querySelectorAll("td")[3];

    // ★一覧画面(ComboTableRow)は TagBadgeList をそのまま置いており、0 件では
    //   null を返すのでセルが空になる。ゴミ箱もそれに揃える——以前の「-」は
    //   ゴミ箱だけの見せ方だった(D-417＝専用の見せ方を作らない)。
    expect(tagCell.textContent).toBe("");
  });

  // =========================================================================
  // M23-06 §4.4-2: 「全選択」の対象は、表示中のこの表の中だけである
  // =========================================================================
  it("§5.1-5 全選択の対象は、この表に出ているコンボだけである", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    const deletedAt = "2026-04-09T00:00:00Z";
    renderList([makeCombo(1, deletedAt), makeCombo(2, deletedAt)], [], onSelectionChange);

    await user.click(screen.getByLabelText("全選択"));

    // ★セットプレイの id は 1 件も混ざらない。セットプレイ表は独立した選択を持つ。
    expect(onSelectionChange).toHaveBeenCalledWith([1, 2]);
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
  });

  // ★★「この表に出ているものだけ」を独立に主張する。上のケースは「全 ID が選ばれる」
  //   という既存の主張と重なるため、こちらで「表に出ていない id を触らない」を見る。
  //   ★TrashList は combos props に無い id を返してはならない——返せるとしたら、
  //   それは選択状態がテーブルをまたいで共有されているということである。
  it("§5.1-5 全選択は combos props に在る id しか返さない", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    const deletedAt = "2026-04-09T00:00:00Z";
    // 一部だけ選ばれている状態(indeterminate)から全選択を押す。
    renderList([makeCombo(1, deletedAt), makeCombo(2, deletedAt)], [1], onSelectionChange);

    await user.click(screen.getByLabelText("全選択"));

    // ★返るのは combos props の id ちょうどである。セットプレイ表の id は
    //   この配列へ入りようが無い——選択状態が表ごとに分かれているためである。
    const returned = onSelectionChange.mock.calls[0][0] as number[];
    expect(returned).toEqual([1, 2]);
  });
});

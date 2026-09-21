import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import ja from "@/locales/ja.json";
import { TrashBulkActions } from "./TrashBulkActions";
import type { ComboSummary } from "../types";
import type { SetupResponse } from "@/features/setup/types";

// ★i18n は「キーをそのまま返す」モックにしない。本ファイルは文面の主張を持つため、
//   キー返しでは空振りする(M23-04 教訓 2)。実 ja.json を引いて {{var}} を差し込む。
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

function makeCombo(id: number, memo?: string): ComboSummary {
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
    memo,
    deletedAt: "2026-04-09T00:00:00Z",
  };
}

function makeSetup(id: number, name?: string): SetupResponse {
  return {
    id,
    characterId: 1,
    name: name ?? null,
    description: null,
    stepCount: 2,
    version: 1,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    deletedAt: "2026-04-09T00:00:00Z",
    steps: [],
    defaultRecipe: "",
    parentComboIds: [],
  };
}

function renderBulkActions(
  selectedCombos: ComboSummary[],
  selectedSetups: SetupResponse[] = [],
  onComplete = vi.fn(),
) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <TrashBulkActions
        selectedCombos={selectedCombos}
        selectedSetups={selectedSetups}
        onComplete={onComplete}
      />
    </QueryClientProvider>,
  );
}

// ★★実アプリの親と同じ形で描画する(レビュー高-1)。
//
//   TrashPage の onComplete は選択状態を空にする。⇒ 一括操作の直後に
//   selectedCombos / selectedSetups が空になって再描画される。
//   ★no-op の onComplete で描画すると、この再描画が起きず、
//   「結果が表示される前にコンポーネントが消える」不具合を検出できない。
//   実際にそれで空振りし、実装した内訳が 1 フレームも出ない状態で緑になっていた。
//   ⇒ 結果表示を主張するテストは必ずこちらを使うこと。
function renderWithRealParent(
  initialCombos: ComboSummary[],
  initialSetups: SetupResponse[] = [],
) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  function Parent() {
    const [combos, setCombos] = useState(initialCombos);
    const [setups, setSetups] = useState(initialSetups);
    return (
      <TrashBulkActions
        selectedCombos={combos}
        selectedSetups={setups}
        onComplete={() => {
          setCombos([]);
          setSetups([]);
        }}
      />
    );
  }

  return render(
    <QueryClientProvider client={qc}>
      <Parent />
    </QueryClientProvider>,
  );
}

function okResponse(body: unknown = {}) {
  return new Response(JSON.stringify(body), { status: 200 });
}

describe("TrashBulkActions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("選択が空のとき null を返す", () => {
    const { container } = renderBulkActions([], []);
    expect(container.firstChild).toBeNull();
  });

  it("選択があるとき操作ボタンが表示される", () => {
    renderBulkActions([makeCombo(1), makeCombo(2)]);
    expect(screen.getByRole("button", { name: "選択を復元" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "選択を完全削除" })).toBeTruthy();
  });

  it("一括復元: 3件分の POST /api/combos/:id/restore が呼ばれる", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse());
    renderBulkActions([makeCombo(1), makeCombo(2), makeCombo(3)]);
    await user.click(screen.getByRole("button", { name: "選択を復元" }));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(3));
    const urls = fetchSpy.mock.calls.map((c) => c[0] as string);
    expect(urls).toContain("/api/combos/1/restore");
    expect(urls).toContain("/api/combos/2/restore");
    expect(urls).toContain("/api/combos/3/restore");
  });

  it("一括完全削除: 確認ダイアログ → 確認後に DELETE が呼ばれる", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse());
    renderBulkActions([makeCombo(1), makeCombo(2)]);
    await user.click(screen.getByRole("button", { name: "選択を完全削除" }));
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "完全削除する" }));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
    const urls = fetchSpy.mock.calls.map((c) => c[0] as string);
    expect(urls).toContain("/api/combos/1/permanent");
    expect(urls).toContain("/api/combos/2/permanent");
  });

  it("一部失敗: role=alert にエラーメッセージが表示される", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(okResponse())
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "サーバーエラー" }), { status: 500 }),
      )
      .mockResolvedValueOnce(okResponse());
    renderWithRealParent([makeCombo(1), makeCombo(2), makeCombo(3)]);
    await user.click(screen.getByRole("button", { name: "選択を復元" }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(screen.getByRole("alert").textContent).toContain("1 件失敗");
  });

  // ★★M24-08 の実機確認で足した(followup `trash-bulk-permanent-delete-reason-hidden` の段 2)。
  //
  //   着手前は「N 件失敗: 〈名前〉」としか出ず、理由(setup_in_use)も参照元コンボも
  //   捕捉されているのに描画していなかった。⇒ 開発者の実機確認で
  //   「セットプレイの削除が一切できない」と読まれた。
  //   ★行単位(TrashSetupListRow)は M23-07 で解消済みであり、残っていたのはバルク経路だけ。
  it("★完全削除が参照中で拒まれたら、理由と掴んでいるコンボを出す", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "setup_in_use",
            message: "in use",
            details: {
              combos: [{ id: 40, memo: "画面端コンボ" }, { id: 41 }],
            },
          },
        }),
        { status: 409 },
      ),
    );
    renderWithRealParent([], [makeSetup(7, "ds2")]);
    await user.click(screen.getByRole("button", { name: "選択を完全削除" }));
    // 確認ダイアログを通す
    await user.click(await screen.findByRole("button", { name: "完全削除する" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("1 件失敗");
    expect(alert.textContent).toContain("ds2");
    // ★理由が出ること。着手前はここが出ていなかった。
    expect(alert.textContent).toContain(ja.trash.setup.inUse);
    // ★どのコンボが掴んでいるかが出ること。memo が空の行は id で示す。
    expect(alert.textContent).toContain("画面端コンボ");
    expect(alert.textContent).toContain("41");
  });

  // =========================================================================
  // §5.1-4(最重要ゲート): 一括操作が、選んだ種別に応じて正しい API を叩く
  //
  // ★★コンボの id でセットプレイの API を叩く経路が存在しないことを守る。
  //   取り違えると別のデータが消える。完全削除は不可逆である。
  // ★破壊確認 1: TrashBulkActions の振り分けを逆にすると、本ケースが赤くなる。
  // =========================================================================
  describe("§5.1-4 種別ごとの API 振り分け", () => {
    // ★★id は必ず別の値にすること。コンボ 7 とセットプレイ 7 のように衝突させると、
    //   振り分けを逆にしても URL の集合が同じになり、取り違えを検出できない
    //   (実際に破壊確認 1 でこのケースが緑のまま通り、作り直した)。
    //   ⇒ 「どの id が、どちらの経路へ渡ったか」を対で主張する。
    it("一括復元: コンボ id は combos の経路へ、セットプレイ id は setups の経路へ渡る", async () => {
      const user = userEvent.setup();
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        okResponse({ parentComboIds: [] }),
      );
      renderBulkActions([makeCombo(7)], [makeSetup(8)]);
      await user.click(screen.getByRole("button", { name: "選択を復元" }));

      await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
      const urls = (fetchSpy.mock.calls.map((c) => c[0] as string)).sort();
      // ★★集合ではなく対応で主張する。振り分けを逆にすると
      //   ["/api/combos/8/restore", "/api/setups/7/restore"] になって赤くなる。
      expect(urls).toEqual(["/api/combos/7/restore", "/api/setups/8/restore"]);
    });

    it("一括完全削除: コンボ id は combos の経路へ、セットプレイ id は setups の経路へ渡る", async () => {
      const user = userEvent.setup();
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse());
      renderBulkActions([makeCombo(7)], [makeSetup(8)]);
      await user.click(screen.getByRole("button", { name: "選択を完全削除" }));
      await user.click(screen.getByRole("button", { name: "完全削除する" }));

      await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
      const urls = (fetchSpy.mock.calls.map((c) => c[0] as string)).sort();
      expect(urls).toEqual(["/api/combos/7/permanent", "/api/setups/8/permanent"]);
    });

    it("コンボだけを選んだとき、セットプレイの API を 1 度も叩かない", async () => {
      const user = userEvent.setup();
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse());
      renderBulkActions([makeCombo(3), makeCombo(4)], []);
      await user.click(screen.getByRole("button", { name: "選択を復元" }));

      await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
      const urls = fetchSpy.mock.calls.map((c) => c[0] as string);
      expect(urls.some((u) => u.startsWith("/api/setups/"))).toBe(false);
    });

    it("セットプレイだけを選んだとき、コンボの API を 1 度も叩かない", async () => {
      const user = userEvent.setup();
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        okResponse({ parentComboIds: [] }),
      );
      renderBulkActions([], [makeSetup(3), makeSetup(4)]);
      await user.click(screen.getByRole("button", { name: "選択を復元" }));

      await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
      const urls = fetchSpy.mock.calls.map((c) => c[0] as string);
      expect(urls.some((u) => u.startsWith("/api/combos/"))).toBe(false);
    });
  });

  // =========================================================================
  // §5.1-10 / §5.1-11: 一括復元の内訳と、未知の VAL コード
  // =========================================================================
  describe("§4.6-3 一括復元の警告の内訳", () => {
    it("§5.1-10 どの件に警告が付いたかが出る", async () => {
      const user = userEvent.setup();
      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(
          okResponse({
            warnings: [
              {
                code: "VAL-R01",
                severity: "warning",
                message: "diag",
                details: { setups: [{ id: 9, name: "起き攻めA" }] },
              },
            ],
          }),
        )
        .mockResolvedValueOnce(okResponse({}));

      renderWithRealParent([makeCombo(1, "画面端 中央始動"), makeCombo(2, "無警告のコンボ")]);
      await user.click(screen.getByRole("button", { name: "選択を復元" }));

      const detail = await screen.findByRole("status");
      // ★警告が付いた件だけが出る。付いていない件は出ない。
      expect(detail.textContent).toContain("画面端 中央始動");
      expect(detail.textContent).not.toContain("無警告のコンボ");
      // ★参照先は details のキーから拾う(VAL コードで分岐していない証拠の一部)。
      expect(detail.textContent).toContain("起き攻めA");
    });

    it("§5.1-11 未知の VAL コードの警告が返っても表示が壊れない", async () => {
      const user = userEvent.setup();
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        okResponse({
          warnings: [
            {
              code: "VAL-R99",
              severity: "warning",
              message: "diag",
              details: { combos: [{ id: 5, memo: "将来のコンボ" }] },
            },
          ],
        }),
      );

      renderWithRealParent([makeCombo(1, "画面端 中央始動")]);
      await user.click(screen.getByRole("button", { name: "選択を復元" }));

      const detail = await screen.findByRole("status");
      // ★コードを列挙していないので、未知のコードでも行が出る。
      expect(detail.textContent).toContain("画面端 中央始動");
      expect(detail.textContent).toContain("VAL-R99");
      // ★details のキーで参照先を拾うため、未知コードでも対象が示せる。
      expect(detail.textContent).toContain("将来のコンボ");
      // ★エラー扱いになっていないこと(復元は成功している)。
      expect(screen.queryByRole("alert")).toBeNull();
    });
    // ★★高-1 の回帰ガード。onComplete が選択を空にしても結果が残ること。
    it("★選択が空になっても、警告の内訳が消えない(実アプリの親と同じ条件)", async () => {
      const user = userEvent.setup();
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        okResponse({
          warnings: [
            {
              code: "VAL-R01",
              severity: "warning",
              message: "diag",
              details: { setups: [{ id: 9, name: "起き攻めA" }] },
            },
          ],
        }),
      );

      renderWithRealParent([makeCombo(1, "画面端 中央始動")]);
      await user.click(screen.getByRole("button", { name: "選択を復元" }));

      // 選択は空になっている(操作ボタンが消える)。
      await waitFor(() =>
        expect(screen.queryByRole("button", { name: "選択を復元" })).toBeNull(),
      );
      // ★それでも内訳は残っている。
      expect(screen.getByRole("status").textContent).toContain("画面端 中央始動");
    });

    it("★選択が空になっても、失敗の一覧が消えない", async () => {
      const user = userEvent.setup();
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ message: "サーバーエラー" }), { status: 500 }),
      );

      renderWithRealParent([makeCombo(1, "画面端 中央始動")]);
      await user.click(screen.getByRole("button", { name: "選択を復元" }));

      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toContain("1 件失敗");
      expect(alert.textContent).toContain("画面端 中央始動");
    });

    it("結果は「結果を閉じる」で消せる(消し方が判らない状態にしない)", async () => {
      const user = userEvent.setup();
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        okResponse({
          warnings: [
            { code: "VAL-R01", severity: "warning", message: "diag", details: { setups: [{ id: 9, name: "起き攻めA" }] } },
          ],
        }),
      );

      renderWithRealParent([makeCombo(1, "画面端 中央始動")]);
      await user.click(screen.getByRole("button", { name: "選択を復元" }));
      await screen.findByRole("status");

      await user.click(screen.getByRole("button", { name: ja.trash.warning.dismissResult }));

      expect(screen.queryByRole("status")).toBeNull();
    });
  });
});

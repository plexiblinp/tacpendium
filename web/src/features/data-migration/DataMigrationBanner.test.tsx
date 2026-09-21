import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import "@/lib/i18n";

import DataMigrationBanner from "./DataMigrationBanner";
import type { DataMigrationNotice } from "./types";

// 告知の取得(GET)と ack(POST)を、経路ごとに応答を変えてモックする。
// ★呼び出しごとに新しい Response を作る。Response のボディは 1 度しか読めない。
function mockNotice(notice: DataMigrationNotice | null) {
  const post = vi.fn();
  vi.spyOn(globalThis, "fetch").mockImplementation(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === "POST") {
        post(url);
        return new Response(null, { status: 204 });
      }
      if (notice === null) {
        return new Response(null, { status: 204 });
      }
      return new Response(JSON.stringify(notice), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  );
  return post;
}

function renderBanner() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <DataMigrationBanner />
    </QueryClientProvider>,
  );
}

const base: DataMigrationNotice = {
  status: "migrated",
  message: "データの保存場所を移しました",
  retireFailed: false,
  acknowledged: false,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DataMigrationBanner", () => {
  it("告知が無ければ何も出さない(204)", async () => {
    mockNotice(null);
    const { container } = renderBanner();
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(container.textContent).toBe("");
  });

  it("移行できたときは移行の題と本文が出る", async () => {
    mockNotice({ ...base, retiredTo: "/home/u/.local/share/combomgr.migrated-20260905" });
    renderBanner();

    expect(await screen.findByText("データの保存場所が変わりました")).toBeTruthy();
    expect(screen.getByText("データの保存場所を移しました")).toBeTruthy();
    // 移行前のデータの在処が出ること(利用者が消してよいか判断するのに要る)
    expect(
      screen.getByText(/combomgr\.migrated-20260905/),
    ).toBeTruthy();
  });

  it("★検証に失敗したときは、移行の題ではなく中止の題が出る", async () => {
    mockNotice({
      ...base,
      status: "failed",
      message: "データの移行を検証できなかったため、何も移動せずに中止しました",
    });
    renderBanner();

    expect(await screen.findByText("データの移行を中止しました")).toBeTruthy();
    expect(screen.queryByText("データの保存場所が変わりました")).toBeNull();
  });

  it("★★データが取り残されているときは、良性形と違う題で出る", async () => {
    // 新が空で旧に実データが在る状態。良性形(旧はただの控え)と同じ題で出すと
    // 見分けがつかず、「開いているデータが空である」ことに気づけない。
    mockNotice({
      ...base,
      status: "skipped",
      reason: "old_data_stranded",
      message: "いま開いているデータは空です。以前のデータ(4 件)は /old に残っています",
    });
    renderBanner();

    expect(await screen.findByText("以前のデータが取り残されています")).toBeTruthy();
    expect(screen.queryByText("移行前のデータが残っています")).toBeNull();
    expect(screen.queryByText("データの保存場所が変わりました")).toBeNull();
  });

  it("★何も移していないとき(skipped)に「移りました」と出さない", async () => {
    mockNotice({
      ...base,
      status: "skipped",
      reason: "new_db_exists",
      message: "移行先に既存のデータがあるため移行しません",
    });
    renderBanner();

    expect(await screen.findByText("移行前のデータが残っています")).toBeTruthy();
    expect(screen.queryByText("データの保存場所が変わりました")).toBeNull();
  });

  it("退避できなかったときはその旨が出る", async () => {
    mockNotice({ ...base, retireFailed: true, from: "/home/u/.local/share/combomgr" });
    renderBanner();

    await screen.findByText("データの保存場所が変わりました");
    expect(screen.getByText(/退避できませんでした/)).toBeTruthy();
  });

  it("閉じると ack を投げ、バナーが消える", async () => {
    const post = mockNotice(base);
    renderBanner();
    await screen.findByText("データの保存場所が変わりました");

    await userEvent.click(screen.getByRole("button", { name: "閉じる" }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        expect.stringContaining("/api/notices/data-migration/ack"),
      ),
    );
    await waitFor(() =>
      expect(screen.queryByText("データの保存場所が変わりました")).toBeNull(),
    );
  });

  it("既に閉じられた告知は出さない", async () => {
    mockNotice({ ...base, acknowledged: true });
    const { container } = renderBanner();
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(container.textContent).toBe("");
  });
});

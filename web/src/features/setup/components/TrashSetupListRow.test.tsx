import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

import ja from "@/locales/ja.json";
import { TrashSetupListRow } from "./TrashSetupListRow";
import { ApiError } from "@/features/combo/api";
import type { SetupResponse } from "../types";

const mockRestore = vi.fn();
const mockPermanentDelete = vi.fn();
const mockDeleteSetupLink = vi.fn(
  (_vars: { comboId: number; setupId: number }, opts?: { onSuccess?: () => void }) => {
    opts?.onSuccess?.();
  },
);
const toastCalls = vi.hoisted(() => ({ warning: [] as string[], success: [] as string[] }));

vi.mock("../hooks/useRestoreSetup", () => ({
  useRestoreSetup: () => ({ mutateAsync: mockRestore, isPending: false }),
}));
vi.mock("../hooks/usePermanentDeleteSetup", () => ({
  usePermanentDeleteSetup: () => ({ mutateAsync: mockPermanentDelete, isPending: false }),
}));
// ★M23-07 §4.3: 既存の紐付け解除 API を使う(新しい API を作らない)。
//   mutate の第 2 引数(onSuccess/onError)を実際に呼ぶモックにしないと、
//   解除後の画面の振る舞い(§5.2-9)を主張できない。
vi.mock("../hooks/useSetupLinks", () => ({
  useDeleteSetupLink: () => ({ mutate: mockDeleteSetupLink, isPending: false }),
}));
// ★i18n は「キーをそのまま返す」モックにしない(M23-04 教訓 2 / M23-06 §5.1)。
//   本ファイルは M23-06 でレシピ表示の文面を主張するようになったため、キー返しでは
//   「(名称未設定)」とレシピ文字列の区別が付かず、主張が空振りする。
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

// トーストの枚数を数えるためモジュールをモックする(M23-06 §4.6-1)。
vi.mock("sonner", () => ({
  toast: {
    warning: (m: string) => toastCalls.warning.push(m),
    success: (m: string) => toastCalls.success.push(m),
    error: (m: string) => void m,
  },
}));

// 確認ダイアログは Radix のポータルを噛むため、押下 = 即実行に置き換える。
// 本テストの関心はダイアログの挙動ではなく「拒否が利用者に届くか」である。
vi.mock("./TrashSetupDeleteConfirm", () => ({
  TrashSetupDeleteConfirm: ({ open, onConfirm }: { open: boolean; onConfirm: () => void }) =>
    open ? (
      <button type="button" onClick={onConfirm}>
        confirm
      </button>
    ) : null,
}));

const setup: SetupResponse = {
  id: 7,
  characterId: 1,
  name: "起き攻めA",
  description: null,
  stepCount: 2,
  version: 1,
  createdAt: "2026-08-01T00:00:00Z",
  updatedAt: "2026-08-01T00:00:00Z",
  deletedAt: "2026-08-20T10:30:00Z",
  steps: [],
  defaultRecipe: "↓↘→P",
  parentComboIds: [12, 34],
};

function renderRow(onSetupChanged = vi.fn(), row: SetupResponse = setup, selected = false, onSelectionChange = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    React.createElement(
      QueryClientProvider,
      { client: qc },
      <table>
        <tbody>
          <TrashSetupListRow
            setup={row}
            selected={selected}
            onSelectionChange={onSelectionChange}
            onSetupChanged={onSetupChanged}
          />
        </tbody>
      </table>,
    ),
  );
}

afterEach(() => {
  toastCalls.warning.length = 0;
  toastCalls.success.length = 0;
  vi.clearAllMocks();
});

describe("TrashSetupListRow", () => {
  it("名前と削除日時と操作を描画する", () => {
    renderRow();
    expect(screen.getByText("起き攻めA")).toBeTruthy();
    // ★時刻はローカルタイムゾーンで描画されるため、絶対値で照合しない
    //   (CI と開発機で TZ が違うと落ちる)。書式だけを見る。
    expect(screen.getByText(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)).toBeTruthy();
    expect(screen.getByText(ja.trash.setup.restore)).toBeTruthy();
    expect(screen.getByText(ja.trash.setup.permanentDelete)).toBeTruthy();
  });

  it("復元を押すと復元が呼ばれ、親へ変更が伝わる", async () => {
    mockRestore.mockResolvedValueOnce(setup);
    const onSetupChanged = vi.fn();
    renderRow(onSetupChanged);

    fireEvent.click(screen.getByText(ja.trash.setup.restore));

    await waitFor(() => expect(mockRestore).toHaveBeenCalledWith(7));
    await waitFor(() => expect(onSetupChanged).toHaveBeenCalled());
  });

  // ★§5-9 の本体。指示書 §4.4-3c＝「何も起きない」形にしないこと。
  //   押しても無反応だと、利用者には削除できたのか壊れたのか判別できず、
  //   同じ操作を繰り返すことになる。
  it("完全削除が 409 setup_in_use で拒否されたら、拒否されたことが利用者に伝わる", async () => {
    mockPermanentDelete.mockRejectedValueOnce(
      new ApiError(
        409,
        {
          error: {
            code: "setup_in_use",
            message: "サーバの文言",
            details: { combos: [{ id: 12, memo: "対空から拾うルート" }] },
          },
        } as never,
        "setup in use",
      ),
    );
    const onSetupChanged = vi.fn();
    renderRow(onSetupChanged);

    fireEvent.click(screen.getByText(ja.trash.setup.permanentDelete));
    fireEvent.click(await screen.findByText("confirm"));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(ja.trash.setup.inUse);

    // 拒否されたのだから、一覧を更新しに行かない(消えたように見せない)。
    expect(onSetupChanged).not.toHaveBeenCalled();
  });

  // ★★M23-07 §4.3-1 / §5.2-8: 拒否のとき、参照元コンボを列挙して紐付けを解除できる。
  //
  // ★これは D-485(M23-02＝「参照元コンボを列挙する専用の表示は作らない」)の上書きで
  //   ある。旧テストは「列挙しないこと」を主張していた。上書きの理由——★拒否された
  //   あとに紐付けを解除する導線が画面に無く、拒否された利用者は詰んでいた。
  //   ⇒ 「拒否されたことが伝わる」だけでは足りない。逃げ道が要る。
  // ★新しくデータを取りに行かない。材料は拒否応答の details.combos に既に在る。
  it("拒否のとき、参照元コンボが見え、紐付けを解除できる", async () => {
    mockPermanentDelete.mockRejectedValueOnce(
      new ApiError(
        409,
        {
          error: {
            code: "setup_in_use",
            message: "サーバの文言",
            details: { combos: [{ id: 12, memo: "対空から拾うルート" }] },
          },
        } as never,
        "setup in use",
      ),
    );
    renderRow();

    fireEvent.click(screen.getByText(ja.trash.setup.permanentDelete));
    fireEvent.click(await screen.findByText("confirm"));
    await screen.findByRole("alert");

    // 参照元コンボが memo で見える(id だけでは、どのコンボか利用者に分からない)。
    expect(await screen.findByText(/対空から拾うルート/)).toBeTruthy();

    // ★解除の導線が在る。文言が「コンボを消す」ではないこと。
    const unlinkButton = screen.getByRole("button", { name: ja.trash.setup.unlinkAction });
    expect(unlinkButton).toBeTruthy();
    expect(screen.getByText(ja.trash.setup.unlinkNote)).toBeTruthy();

    fireEvent.click(unlinkButton);

    await waitFor(() => {
      // ★コンボ id(12)とセットプレイ id(7)は別の値である。同値の fixture だと
      //   引数を取り違えた実装でもテストが通る(M23-06 の破壊確認が空振りした型)。
      expect(mockDeleteSetupLink).toHaveBeenCalledWith(
        { comboId: 12, setupId: 7 },
        expect.anything(),
      );
    });
  });

  // ★★§4.3-3 / §5.2-9: 紐付けを解除しても完全削除が自動で再実行されない。
  //   理由＝解除の結果を見てから決められるようにするためである。
  it("紐付けを解除しても完全削除が自動で再実行されない", async () => {
    mockPermanentDelete.mockRejectedValueOnce(
      new ApiError(
        409,
        {
          error: {
            code: "setup_in_use",
            message: "サーバの文言",
            details: { combos: [{ id: 12, memo: "対空から拾うルート" }] },
          },
        } as never,
        "setup in use",
      ),
    );
    renderRow();

    fireEvent.click(screen.getByText(ja.trash.setup.permanentDelete));
    fireEvent.click(await screen.findByText("confirm"));
    await screen.findByRole("alert");

    expect(mockPermanentDelete).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: ja.trash.setup.unlinkAction }));
    await waitFor(() => expect(mockDeleteSetupLink).toHaveBeenCalledTimes(1));

    // ★解除が成功しても完全削除は再実行されない。利用者にもう一度押させる。
    expect(mockPermanentDelete).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(ja.trash.setup.unlinkDoneRetryHint)).toBeTruthy();
  });

  // ★409 は 2 種類ある。ステータスではなく code で分岐していること。
  it("409 でも setup_not_in_trash なら別の文言になる", async () => {
    mockPermanentDelete.mockRejectedValueOnce(
      new ApiError(
        409,
        { error: { code: "setup_not_in_trash", message: "x" } } as never,
        "not in trash",
      ),
    );
    renderRow();

    fireEvent.click(screen.getByText(ja.trash.setup.permanentDelete));
    fireEvent.click(await screen.findByText("confirm"));

    expect((await screen.findByRole("alert")).textContent).toContain(
      ja.trash.setup.notInTrash,
    );
  });

  it("その他のエラーでも無反応にならない", async () => {
    mockPermanentDelete.mockRejectedValueOnce(new Error("network down"));
    renderRow();

    fireEvent.click(screen.getByText(ja.trash.setup.permanentDelete));
    fireEvent.click(await screen.findByText("confirm"));

    expect((await screen.findByRole("alert")).textContent).toContain(
      ja.trash.setup.permanentDeleteError,
    );
  });
  // =========================================================================
  // M23-06 §4.3: 名無しセットプレイをレシピ文字列で識別できるようにする
  //
  // ★★これがコンボの「ルート列」と答えが分かれる箇所である。コンボは memo と
  //   始動状況で識別できるが、セットプレイは名前が空だと識別手段がゼロになる。
  //   完全削除は不可逆であり、取り違えは取り返しがつかない。
  // ★レシピ文字列はサーバが setup_steps から組み立てて defaultRecipe に載せている。
  //   フロントで組み立て直さない(表記規則を 2 か所に持たない＝E-76)。
  // =========================================================================
  it("§5.1-6 名前が空のセットプレイは、レシピ文字列で識別できる", () => {
    renderRow(vi.fn(), { ...setup, name: null, defaultRecipe: "↓↘→P > 中P" });

    expect(screen.getByText("↓↘→P > 中P")).toBeTruthy();
    expect(screen.queryByText(ja.trash.setup.unnamed)).toBeNull();
  });

  it("§5.1-6 名前が空白だけのときもレシピ文字列へ落ちる", () => {
    renderRow(vi.fn(), { ...setup, name: "   ", defaultRecipe: "↓↘→P" });

    expect(screen.getByText("↓↘→P")).toBeTruthy();
  });

  it("§5.1-7 レシピ文字列が空でも行が壊れない(steps 0 件のセットプレイ)", () => {
    // ★setup_steps が 0 件のセットプレイは在りうる。サーバは空文字を返す。
    renderRow(vi.fn(), { ...setup, name: null, defaultRecipe: "" });

    // 「(名称未設定)」へ落ちるだけで、行そのものは出る。
    expect(screen.getByText(ja.trash.setup.unnamed)).toBeTruthy();
    expect(screen.getByText(ja.trash.setup.restore)).toBeTruthy();
  });

  it("名前があるときはレシピではなく名前を出す", () => {
    renderRow(vi.fn(), { ...setup, name: "起き攻めA", defaultRecipe: "↓↘→P" });

    expect(screen.getByText("起き攻めA")).toBeTruthy();
    expect(screen.queryByText("↓↘→P")).toBeNull();
  });

  // =========================================================================
  // M23-06 §4.4: 一括選択(セットプレイ側)
  // =========================================================================
  it("チェックボックスを押すと、そのセットプレイの id で選択が伝わる", () => {
    const onSelectionChange = vi.fn();
    renderRow(vi.fn(), setup, false, onSelectionChange);

    fireEvent.click(screen.getByRole("checkbox"));

    // ★セットプレイの id が、セットプレイ用の選択へ渡ること。
    expect(onSelectionChange).toHaveBeenCalledWith(7, true);
  });

  // =========================================================================
  // M23-06 §4.6-1: 単件復元の完了トースト
  // =========================================================================
  it("§5.1-8 警告が無くても完了トーストが出る", async () => {
    mockRestore.mockResolvedValueOnce({ ...setup, parentComboIds: [] });
    renderRow();

    fireEvent.click(screen.getByText(ja.trash.setup.restore));

    await waitFor(() => expect(toastCalls.success.length).toBe(1));
    expect(toastCalls.success[0]).toBe(ja.trash.warning.restored);
    expect(toastCalls.warning.length).toBe(0);
  });

  it("§5.1-9 警告があるとき、トーストは 1 枚に畳まれる", async () => {
    mockRestore.mockResolvedValueOnce({
      ...setup,
      parentComboIds: [],
      warnings: [
        {
          code: "VAL-R02",
          severity: "warning",
          message: "サーバ側の診断文(画面はこれを表示しない)",
          details: { combos: [{ id: 12, memo: "対空から拾うルート" }] },
        },
      ],
    });
    renderRow();

    fireEvent.click(screen.getByText(ja.trash.setup.restore));

    await waitFor(() => expect(toastCalls.warning.length).toBe(1));
    // ★完了と警告で 2 枚出さない。
    expect(toastCalls.success.length).toBe(0);
    expect(toastCalls.warning[0]).toContain("復元しました");
    // ★M23-06 §4.6-2: 連結した文面が句点で終わる。
    expect(toastCalls.warning[0].endsWith("。")).toBe(true);
    // ★サーバの診断文は出さない(DES-006 §11.3)。
    expect(toastCalls.warning[0]).not.toContain("サーバ側の診断文");
  });

  // ★★M23-07 §4.2-5 / §5.2-7: セットプレイ行はクリックで遷移しない。
  //
  //   セットプレイは親コンボ経由でしか画面に出ない(VAL-S05＝親に紐付かない
  //   単独作成は禁止)ため、単独の詳細という概念が無い。
  // ★遷移しないことが見た目で分かること——cursor-pointer を付けない。
  it("行はクリックで遷移しない。遷移しないことが見た目で分かる", () => {
    const { container } = renderRow();

    // 遷移の手段が 1 つも無いこと。
    expect(container.querySelectorAll("a").length).toBe(0);

    const row = container.querySelector("tr") as HTMLElement;
    expect(row).toBeTruthy();
    expect(row.className).not.toContain("cursor-pointer");

    // クリックしても何も起きない(エラーにもならない)。
    fireEvent.click(row);
    expect(container.querySelectorAll("a").length).toBe(0);
  });
});

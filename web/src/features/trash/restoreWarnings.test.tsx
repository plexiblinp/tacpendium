import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import ja from "@/locales/ja.json";

import { TrashBulkActions } from "@/features/combo/components/TrashBulkActions";
import { TrashListRow } from "@/features/combo/components/TrashListRow";
import type { ComboSummary } from "@/features/combo/types";

// ★M23-04 §5.3: 復元警告の表示。
//
// ★見ているのは 2 点である。
//   1. 警告付きの復元応答を受け取ったときに表示されること
//   2. 一括復元で複数件に警告が付いても、トーストが件数分積み上がらないこと
//
// トーストの実体は sonner。呼び出し回数を数えたいのでモジュールをモックする
// (Toaster を描画して DOM を数えると、sonner 側のアニメーション・重複抑制に
//  依存した検査になり、「積み上がらないこと」の根拠として弱い)。
const toastCalls = vi.hoisted(() => ({ warning: [] as string[], success: [] as string[] }));
vi.mock("sonner", () => ({
  toast: {
    warning: (m: string) => toastCalls.warning.push(m),
    success: (m: string) => toastCalls.success.push(m),
    error: (m: string) => void m,
  },
}));

// ★i18n は「キーをそのまま返す」モックにしない。本サブが見たいのは
//   「サーバの日本語文をそのまま出していないこと」と「件数が畳まれていること」であり、
//   キーを返すモックではどちらも判定できない(実際に一度それで空振りした)。
//   ⇒ 実ロケール(ja.json)を引いて {{var}} を差し込む最小の t を使う。
//   これにより「翻訳キーが ja.json に実在すること」も同時に守られる。
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

vi.mock("react-router-dom", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="#">{children}</a>,
  useNavigate: () => () => {},
}));

function warningBody(id: number) {
  return JSON.stringify({
    id,
    characterId: 1,
    isDraft: false,
    warnings: [
      {
        code: "VAL-R01",
        severity: "warning",
        message: "サーバ側の診断文(画面はこれを表示しない)",
        details: { setups: [{ id: 7, name: "起き攻めA" }] },
      },
    ],
  });
}

function cleanBody(id: number) {
  return JSON.stringify({ id, characterId: 1, isDraft: false });
}

function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const sampleCombo: ComboSummary = {
  id: 1,
  characterId: 1,
  isDraft: false,
  affectedByGameUpdate: false,
  affectedMoves: [],
  stepCount: 1,
  version: 1,
  createdAt: "2026-08-22T00:00:00Z",
  updatedAt: "2026-08-22T00:00:00Z",
  deletedAt: "2026-08-22T00:00:00Z",
  tags: [],
  defaultRecipe: "",
  starterMoveCode: "",
};

function makeCombo(id: number): ComboSummary {
  return { ...sampleCombo, id, memo: `コンボ${id}` };
}

describe("復元警告の表示(M23-04 §5.3)", () => {
  afterEach(() => {
    toastCalls.warning.length = 0;
    toastCalls.success.length = 0;
    vi.restoreAllMocks();
  });

  it("単件復元: 警告付きの応答を受け取ると警告が表示される", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(warningBody(1), { status: 200 }),
    );
    renderWithQuery(
      <table><tbody>
        <TrashListRow
          combo={sampleCombo}
          selected={false}
          onSelectionChange={() => {}}
          onComboChanged={() => {}}
        />
      </tbody></table>,
    );

    await user.click(screen.getByRole("button", { name: "復元" }));
    await waitFor(() => expect(toastCalls.warning.length).toBe(1));
    // ★サーバの message ではなく翻訳キー経由の文面が出ること(§4.3-4)。
    expect(toastCalls.warning[0]).not.toContain("サーバ側の診断文");
    expect(toastCalls.warning[0]).toContain("ゴミ箱");
    // ★M23-06 §4.6-1: 完了と警告で 2 枚出さない。1 枚に畳む。
    expect(toastCalls.success.length).toBe(0);
    expect(toastCalls.warning[0]).toContain("復元しました");
    // ★M23-06 §4.6-2: 連結した文面が句点で終わる。
    expect(toastCalls.warning[0].endsWith("。")).toBe(true);
  });

  // ★M23-06 §4.6-1 で挙動が変わった。以前は「警告が無ければトーストが 1 枚も出ない」
  //   だったが、一括復元は 0 件でも完了トーストを出しており、単件だけ黙っていた。
  //   ⇒ 単件でも完了トーストを出す。★警告トーストが出ないことは引き続き守る。
  it("単件復元: 警告が無ければ完了トーストのみ(警告トーストは出ない)", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(cleanBody(1), { status: 200 }),
    );
    renderWithQuery(
      <table><tbody>
        <TrashListRow
          combo={sampleCombo}
          selected={false}
          onSelectionChange={() => {}}
          onComboChanged={() => {}}
        />
      </tbody></table>,
    );

    await user.click(screen.getByRole("button", { name: "復元" }));
    await waitFor(() => expect(toastCalls.success.length).toBe(1));
    expect(toastCalls.warning.length).toBe(0);
    expect(toastCalls.success[0]).toBe(ja.trash.warning.restored);
  });

  it("一括復元: 3 件中 3 件に警告が付いてもトーストは 1 枚に畳まれる", async () => {
    const user = userEvent.setup();
    let n = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(new Response(warningBody(++n), { status: 200 })),
    );
    renderWithQuery(
      <TrashBulkActions
        selectedCombos={[makeCombo(1), makeCombo(2), makeCombo(3)]}
        selectedSetups={[]}
        onComplete={() => {}}
      />,
    );

    await user.click(screen.getByRole("button", { name: "選択を復元" }));
    await waitFor(() => expect(toastCalls.warning.length).toBe(1));
    // ★件数分(3 枚)積み上がっていないこと。選択が 20 件ならトーストが 20 枚出る形の防止。
    expect(toastCalls.warning.length).toBe(1);
    expect(toastCalls.warning[0]).toContain("3");
  });

  it("一括復元: 警告 0 件なら完了トーストのみ(警告トーストは出ない)", async () => {
    const user = userEvent.setup();
    let n = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(new Response(cleanBody(++n), { status: 200 })),
    );
    renderWithQuery(
      <TrashBulkActions
        selectedCombos={[makeCombo(1), makeCombo(2)]}
        selectedSetups={[]}
        onComplete={() => {}}
      />,
    );

    await user.click(screen.getByRole("button", { name: "選択を復元" }));
    await waitFor(() => expect(toastCalls.success.length).toBe(1));
    expect(toastCalls.warning.length).toBe(0);
  });
});

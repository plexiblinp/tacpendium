import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

import ja from "@/locales/ja.json";
import { NavigationGuardProvider } from "@/features/navigation-guard/NavigationGuardProvider";
import type { ComboDetail } from "@/features/combo/types";
import ComboDetailPage from "./ComboDetailPage";

// ★★M23-07 §5.2-1〜3(最重要ゲート)。
//
// セットプレイをゴミ箱へ入れる導線が「セットプレイの API」を叩くこと。
// ★コンボの削除 API を叩かないこと——取り違えると利用者のコンボが消える。
//
// ★★fetch を実際に観測する。フックをモックにすると「どのフックを呼んだか」しか
// 見られず、フックの中で URL を取り違えている形を検出できない。本テストが守るのは
// 「どの URL へ、どのメソッドで飛んだか」である。
//
// ★fixture の id は全部別の値にする(combo=10 / setup=7)。同値だと、id を
// 取り違えた実装でも URL が偶然一致してテストが空振りする(M23-06 の破壊確認が
// 実際にこれで空振りした)。

const COMBO_ID = 10;
const SETUP_ID = 7;

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: String(COMBO_ID) }),
  };
});

// ★キー返しモックにしない(M23-04 教訓 2)。実 ja.json を引く。
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) => {
      const raw = key
        .split(".")
        .reduce<unknown>((acc, k) => (acc as Record<string, unknown> | undefined)?.[k], ja);
      if (typeof raw !== "string") return key;
      return raw.replace(/\{\{(\w+)\}\}/g, (_m, name: string) => String(vars?.[name] ?? ""));
    },
    // ★ComboDetailHeader が i18n.language を読む。t だけのモックだと落ちる。
    i18n: { language: "ja" },
  }),
}));

const toastCalls = vi.hoisted(() => ({
  success: [] as { message: string; action?: { label: string; onClick: () => void } }[],
  error: [] as string[],
}));
vi.mock("sonner", () => ({
  toast: {
    success: (message: string, opts?: { action?: { label: string; onClick: () => void } }) =>
      toastCalls.success.push({ message, action: opts?.action }),
    error: (message: string) => toastCalls.error.push(message),
    warning: (message: string) => void message,
    info: (message: string) => void message,
  },
}));

// 提案セクションは本テストの関心外(独自に大量の取得を行う)。
vi.mock("@/features/setplay/components/SetplaySuggestionSection", () => ({
  SetplaySuggestionSection: () => null,
}));

const combo: ComboDetail = {
  id: COMBO_ID,
  characterId: 1,
  isDraft: false,
  affectedByGameUpdate: false,
  affectedMoves: [],
  stepCount: 2,
  defaultRecipe: "弱P > 弱K",
  starterMoveCode: "standing_light_punch",
  version: 1,
  createdAt: "2026-08-20T00:00:00Z",
  updatedAt: "2026-08-20T00:00:00Z",
  tags: [],
  setups: [
    {
      id: SETUP_ID,
      characterId: 1,
      name: "起き攻めA",
      description: null,
      stepCount: 2,
      version: 1,
      defaultRecipe: "↓↘→P",
      parentComboIds: [COMBO_ID],
    },
  ],
};

/** 観測した fetch の記録。URL とメソッドの両方を残す。 */
let requests: { url: string; method: string }[] = [];

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

beforeEach(() => {
  requests = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      requests.push({ url, method });

      if (method === "GET" && url === `/api/combos/${COMBO_ID}`) {
        return jsonResponse(combo);
      }
      if (method === "DELETE" && url === `/api/setups/${SETUP_ID}`) {
        return { ok: true, status: 204, json: async () => ({}), text: async () => "" } as unknown as Response;
      }
      // 候補・プリセット等の副次的な取得は空で返す。
      return jsonResponse([]);
    }),
  );
});

afterEach(() => {
  toastCalls.success.length = 0;
  toastCalls.error.length = 0;
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        {/* ★M27-03: 「戻る」が useLeaveWithoutConfirm を通るため Provider の内側で描く。 */}
        <NavigationGuardProvider>
          <ComboDetailPage />
        </NavigationGuardProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function deleteTheSetup(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByTestId("setup-soft-delete");
  await user.click(screen.getByTestId("setup-soft-delete"));
  await user.click(screen.getByRole("button", { name: ja.setup.delete.confirmAction }));
}

describe("ComboDetailPage — セットプレイをゴミ箱へ入れる導線(M23-07 §4.1)", () => {
  // ★★§5.2-1: 最重要ゲート。
  it("セットプレイの削除 API を叩く。コンボの削除 API を叩かない", async () => {
    const user = userEvent.setup();
    renderPage();
    await deleteTheSetup(user);

    await waitFor(() => {
      expect(requests.some((r) => r.method === "DELETE")).toBe(true);
    });

    // ★★危険な側を先に見る。宛先を取り違えた実装では、ここが「セットプレイを
    //   消したはずがコンボが消えた」を名指しで報告する。
    //   ★id を取り違えて setup の id でコンボを消しに行く形も塞ぐ。
    const destructiveComboCalls = requests.filter(
      (r) =>
        r.method === "DELETE" &&
        (r.url === `/api/combos/${COMBO_ID}` ||
          r.url === `/api/combos/${COMBO_ID}/permanent` ||
          r.url === `/api/combos/${SETUP_ID}` ||
          r.url === `/api/combos/${SETUP_ID}/permanent`),
    );
    expect(destructiveComboCalls, "★コンボの削除 API を叩いている").toEqual([]);

    // そのうえで、正しい宛先へ飛んでいること。
    expect(requests).toContainEqual({
      url: `/api/setups/${SETUP_ID}`,
      method: "DELETE",
    });
  });

  // ★§5.2-2: 確認の前に API が飛ばない。参照コンボ件数が出ることは
  //   SetupAccordionItem.test.tsx が主張している(材料は parentComboIds)。
  it("確認する前にはセットプレイの削除 API が飛ばない", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByTestId("setup-soft-delete");
    await user.click(screen.getByTestId("setup-soft-delete"));

    expect(requests.filter((r) => r.method === "DELETE")).toEqual([]);
  });

  // ★§5.2-3 / §4.1-3: 消したあとにゴミ箱へ行ける。
  //   「消した → 間違えた → 戻す」が 1 画面で完結する。
  it("削除後のトーストからゴミ箱へ行ける", async () => {
    const user = userEvent.setup();
    renderPage();
    await deleteTheSetup(user);

    await waitFor(() => expect(toastCalls.success.length).toBe(1));

    const toastCall = toastCalls.success[0];
    expect(toastCall.message).toBe(ja.setup.delete.done);
    expect(toastCall.action?.label).toBe(ja.setup.delete.openTrash);

    toastCall.action?.onClick();
    expect(mockNavigate).toHaveBeenCalledWith("/trash");
  });
});

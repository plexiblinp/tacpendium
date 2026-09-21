import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

import ja from "@/locales/ja.json";
import TrashComboDetailPage from "./TrashComboDetailPage";
import type { ComboDetail } from "@/features/combo/types";

// ★M23-07 §4.2 / §5.2-4・6: ゴミ箱の読み取り専用コンボ詳細。
//
// ★守るのは 3 点。
//  1. 読み取り専用の経路(GET /api/combos/:id/deleted)を引くこと——通常詳細の
//     経路を引くと 404 になり、行クリックが直っていないのと同じである。
//  2. レシピが出ること(完全削除は不可逆であるため、押す前に中身を見せる)。
//  3. ★編集・削除の操作が出ないこと。押せないボタンを並べるのではなく、出さない。

const COMBO_ID = 42;

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => vi.fn(),
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
    i18n: { language: "ja" },
  }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const deletedCombo: ComboDetail = {
  id: COMBO_ID,
  characterId: 1,
  isDraft: false,
  affectedByGameUpdate: false,
  affectedMoves: [],
  stepCount: 2,
  // ★削除済み行の recipe_cache は NULL だが、サーバが combo_steps から組み立てて返す。
  defaultRecipe: "弱P > 弱K > 波動拳",
  starterMoveCode: "standing_light_punch",
  version: 1,
  createdAt: "2026-08-20T00:00:00Z",
  updatedAt: "2026-08-20T00:00:00Z",
  deletedAt: "2026-08-21T09:00:00Z",
  memo: "ゴミ箱のコンボ",
  tags: [],
};

let requests: string[] = [];

function jsonResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

beforeEach(() => {
  requests = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : String(input);
      requests.push(url);
      if (url === `/api/combos/${COMBO_ID}/deleted`) return jsonResponse(deletedCombo);
      return jsonResponse([]);
    }),
  );
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <TrashComboDetailPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("TrashComboDetailPage(M23-07 §4.2)", () => {
  // ★§5.2-4: 404 にならない。読み取り専用の経路を引く。
  it("読み取り専用の経路(/deleted)を引く。通常の詳細経路を引かない", async () => {
    renderPage();
    await waitFor(() => {
      expect(requests).toContain(`/api/combos/${COMBO_ID}/deleted`);
    });
    // ★通常詳細の経路を引くと削除済み行では 404 になる。混ぜないこと。
    expect(requests).not.toContain(`/api/combos/${COMBO_ID}`);
    // ★レシピ専用経路も削除済みを締め出す(M23-03)。引かないこと。
    expect(requests.some((u) => u.startsWith(`/api/combos/${COMBO_ID}/recipe`))).toBe(false);
  });

  // ★§4.2-4 / §1.3: 一覧のルート列は消したが、詳細ではレシピを出す。
  //   一覧は識別、詳細は確認であり目的が違う。完全削除は不可逆である。
  it("レシピが出る", async () => {
    renderPage();
    expect(await screen.findByText("弱P > 弱K > 波動拳")).toBeTruthy();
  });

  // ★§4.2-3 / §5.2-6: 編集・削除の操作が出ない。押せないボタンも並べない。
  it("編集・コピー・削除・セットプレイの操作が出ない", async () => {
    renderPage();
    await screen.findByText("弱P > 弱K > 波動拳");

    // ★このコンボに対する編集・コピー・セットプレイ追加の導線が無いこと。
    //   ★共通ヘッダの汎用ナビ(/moves/edit 等)まで拾わないよう、対象コンボの
    //   URL で照合する——ヘッダごと消えていることを主張したいわけではない。
    const links = Array.from(document.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(links).not.toContain(`/combos/${COMBO_ID}/edit`);
    expect(links.some((h) => h?.includes(`copyFrom=${COMBO_ID}`))).toBe(false);
    expect(links.some((h) => h?.includes(`/combos/${COMBO_ID}/setups/new`))).toBe(false);

    // ★「押せないボタン」を並べていないこと(disabled で潰す形を採らない)。
    expect(screen.queryByText(ja.comboDetail.setups.heading)).toBeNull();
    expect(document.querySelectorAll("button[disabled]").length).toBe(0);
  });

  // ★出すもの: 復元 / 完全削除 / ゴミ箱へ戻る(§4.2-3)。
  it("復元・完全削除・ゴミ箱へ戻るは出る", async () => {
    renderPage();
    await screen.findByText("弱P > 弱K > 波動拳");

    expect(screen.getByRole("button", { name: ja.trash.combo.restore })).toBeTruthy();
    expect(screen.getByRole("button", { name: ja.trash.combo.permanentDelete })).toBeTruthy();
    expect(screen.getByText(ja.trash.detail.backToTrash, { exact: false })).toBeTruthy();
  });

  // ★§4.2-4-2: レシピ解決に失敗しても詳細そのものは落ちない。
  //   サーバは空文字で返す(縮退)。画面はレシピ欄だけを空にする。
  it("レシピが空でも詳細は開く", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : String(input);
        if (url === `/api/combos/${COMBO_ID}/deleted`) {
          return jsonResponse({ ...deletedCombo, defaultRecipe: "" });
        }
        return jsonResponse([]);
      }),
    );
    renderPage();

    expect(await screen.findByText(ja.comboCommon.recipeEmpty)).toBeTruthy();
    expect(screen.getByRole("button", { name: ja.trash.combo.restore })).toBeTruthy();
  });

  // ★★レビュー中-3: 本経路は §5.1-7 の裁定により生存行も返す。
  //   画面が deletedAt を見ないと、生きたコンボに「ゴミ箱にあるコンボです」と出し、
  //   復元・完全削除まで並ぶ。★到達経路は実在する——読み取り専用詳細から復元すると
  //   /trash へ遷移するが、ブラウザバックで同じ URL へ戻れる。
  it("生存コンボを開いたときはゴミ箱の文面と操作を出さない", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : String(input);
        if (url === `/api/combos/${COMBO_ID}/deleted`) {
          // 生存行（deletedAt を持たない）。
          return jsonResponse({ ...deletedCombo, deletedAt: null });
        }
        return jsonResponse([]);
      }),
    );
    renderPage();

    await screen.findByText("弱P > 弱K > 波動拳");

    // ★事実と食い違う文面を出さない。
    expect(screen.queryByText(ja.trash.detail.readOnlyNotice)).toBeNull();
    // ★サーバ側で弾かれる操作を並べない。
    expect(screen.queryByRole("button", { name: ja.trash.combo.restore })).toBeNull();
    expect(screen.queryByRole("button", { name: ja.trash.combo.permanentDelete })).toBeNull();

    // ★代わりに通常詳細への導線を出す(行き止まりにしない)。
    expect(screen.getByText(ja.trash.detail.notInTrashNotice)).toBeTruthy();
    const links = Array.from(document.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(links).toContain(`/combos/${COMBO_ID}`);
  });
});

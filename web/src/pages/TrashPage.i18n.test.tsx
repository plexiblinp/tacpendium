import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

import ja from "@/locales/ja.json";
import { TrashPage } from "./TrashPage";
import { PermanentDeleteConfirm } from "@/features/combo/components/PermanentDeleteConfirm";

// ★★M23-07 §4.4-1 / §5.2-10: ゴミ箱画面に日本語直書きが残っていないこと。
//
// ★★本ファイルだけは「キーを目印に置き換える t」を使う。他のテストが実 ja.json を
// 引くのとは逆であり、意図的である——ここで主張したいのは「文面が正しいこと」では
// なく「表示される文字列がすべて t() を通っていること」だからである。
// ⇒ t が翻訳を返さない状態にして、それでも日本語が残っていれば、それは直書きである。
// ★文面そのものは他のテスト(TrashListRow / TrashSetupListRow / PermanentDeleteConfirm)が
// 実 ja.json を引いて主張している。2 つを合わせて「キーが通っている ＋ 文面がある」になる。

const I18N_MARKER = "[[i18n]]";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => `${I18N_MARKER}${key}`,
    i18n: { language: "ja" },
  }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

// ヘッダは全画面共通であり、ゴミ箱画面の射程ではない(指示書 §1.5-8)。
vi.mock("@/components/Header", () => ({
  default: () => null,
}));

const combo = {
  id: 1,
  characterId: 1,
  isDraft: false,
  stepCount: 2,
  defaultRecipe: "弱P > 弱K",
  starterMoveCode: "standing_light_punch",
  version: 1,
  createdAt: "2026-08-20T00:00:00Z",
  updatedAt: "2026-08-20T00:00:00Z",
  deletedAt: "2026-08-21T09:00:00Z",
  tags: [],
};

const setup = {
  id: 7,
  characterId: 1,
  name: "起き攻めA",
  description: null,
  stepCount: 2,
  version: 1,
  defaultRecipe: "↓↘→P",
  parentComboIds: [1],
  deletedAt: "2026-08-21T09:30:00Z",
  createdAt: "2026-08-20T00:00:00Z",
  updatedAt: "2026-08-20T00:00:00Z",
};

/** 日本語(ひらがな・カタカナ・漢字)を含むか。 */
function hasJapanese(text: string): boolean {
  return /[぀-ゟ゠-ヿ一-鿿]/.test(text);
}

/**
 * 描画結果から「t() を通っていない日本語」を拾う。
 * ★fixture 由来の値(セットプレイ名・レシピ)は利用者データであり翻訳対象ではない。
 */
function hardcodedJapaneseTexts(root: HTMLElement): string[] {
  const fixtureValues = [setup.name, setup.defaultRecipe, combo.defaultRecipe];
  const found: string[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const text = (node.textContent ?? "").trim();
    if (
      text &&
      hasJapanese(text) &&
      !text.includes(I18N_MARKER) &&
      !fixtureValues.includes(text)
    ) {
      found.push(text);
    }
    node = walker.nextNode();
  }
  return found;
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : String(input);
      // ★どちらの経路も {items, count} 形である(setupApi.listDeletedByCharacter は
      //   r.items を取り出す)。素の配列で返すと一覧が空になり、直書き検査が
      //   「描画されていないから日本語が無い」で通ってしまう。
      const body = url.includes("/api/setups")
        ? { items: [setup], count: 1 }
        : { items: [combo], count: 1 };
      return {
        ok: true,
        status: 200,
        json: async () => body,
        text: async () => JSON.stringify(body),
      } as unknown as Response;
    }),
  );
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("ゴミ箱画面の i18n(M23-07 §4.4-1)", () => {
  it("ゴミ箱画面に日本語の直書きが残っていない", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <TrashPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // 両方の表が描画されるまで待つ。
    await waitFor(() => {
      expect(screen.getByText(`${I18N_MARKER}trash.combo.columnStarter`)).toBeTruthy();
      expect(screen.getByText(`${I18N_MARKER}trash.setup.columnName`)).toBeTruthy();
    });

    expect(hardcodedJapaneseTexts(container)).toEqual([]);
  });

  // ★★一括操作バーは選択が空だと null を返すため、上のテストでは 1 文字も
  //   描画されない(レビュー中-4)。★§3.3-9 の実測ではバーが 22 リテラルのうち
  //   6 件を占める面であり、その面が回帰テストの射程外だった。
  //   ⇒ 選択を作ってからもう一度走査する。
  //   ★M23-06 横断課題 4 と同型である——「描画されない条件」を確かめないと、
  //   テストは緑のまま何も検査しない。
  it("一括操作バーを出した状態でも日本語の直書きが残っていない", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <TrashPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(`${I18N_MARKER}trash.combo.columnStarter`)).toBeTruthy();
    });

    // コンボ行のチェックボックスを選ぶ(全選択のヘッダではなく行の側)。
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[1]);

    // ★バーが実際に描画されたことを先に確かめる。出ていなければ走査は無意味である。
    await waitFor(() => {
      expect(screen.getByText(`${I18N_MARKER}trash.bulk.restoreSelected`)).toBeTruthy();
    });
    expect(screen.getByText(`${I18N_MARKER}trash.bulk.permanentDeleteSelected`)).toBeTruthy();

    expect(hardcodedJapaneseTexts(container)).toEqual([]);
  });

  // ★完全削除の確認ダイアログはゴミ箱画面の一部(行と一括バーの両方が使う)。
  //   ポータルで body 直下へ出るため、ページの描画結果には含まれず別に見る。
  it("完全削除の確認ダイアログに日本語の直書きが残っていない", () => {
    render(
      <PermanentDeleteConfirm open count={3} onOpenChange={vi.fn()} onConfirm={vi.fn()} />,
    );
    expect(hardcodedJapaneseTexts(document.body)).toEqual([]);
  });

  // ★ja / en の両方が揃っていることは locales.test.ts が双方向で検査している。
  //   ここでは M23-07 が足したキーが ja に実在することだけを確かめる
  //   (キーが無いと上のテストはマーカー付きで通ってしまうため)。
  it("M23-07 が足したキーが ja.json に実在する", () => {
    expect(ja.trash.heading).toBeTruthy();
    expect(ja.trash.loading).toBeTruthy();
    expect(ja.trash.combo.empty).toBeTruthy();
    expect(ja.trash.combo.loadError).toBeTruthy();
    expect(ja.trash.combo.restore).toBeTruthy();
    expect(ja.trash.combo.permanentDelete).toBeTruthy();
    expect(ja.trash.combo.confirmTitle).toBeTruthy();
    expect(ja.trash.bulk.selectedCount).toBeTruthy();
    expect(ja.trash.bulk.restoreSelected).toBeTruthy();
    expect(ja.trash.bulk.permanentDeleteSelected).toBeTruthy();
    expect(ja.trash.bulk.failed).toBeTruthy();
    expect(ja.trash.detail.readOnlyNotice).toBeTruthy();
    expect(ja.setup.delete.action).toBeTruthy();
  });
});

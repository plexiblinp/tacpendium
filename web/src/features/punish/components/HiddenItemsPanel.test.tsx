import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { HiddenItemsPanel } from "./HiddenItemsPanel";
import type { PunishList as PunishListData } from "../types";

const removePruning = vi.fn();
const removeCuration = vi.fn();

vi.mock("../api", () => ({
  useRemovePruning: () => ({ mutate: removePruning }),
  useRemoveCuration: () => ({ mutate: removeCuration }),
}));

function renderPanel(list: PunishListData) {
  const qc = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <HiddenItemsPanel list={list} selfCharacterId={1} />
    </QueryClientProvider>,
  );
}

function listWith(over: Partial<PunishListData> = {}): PunishListData {
  return {
    selfCharacterId: 1,
    guardType: "just_parry",
    hitType: "just_parry_punish_counter",
    nodes: [],
    unclassifiedNodes: [],
    hiddenPrunings: [],
    hiddenCurations: [],
    ...over,
  };
}

beforeEach(() => {
  removePruning.mockReset();
  removeCuration.mockReset();
});

describe("HiddenItemsPanel", () => {
  it("pruning と curation を別セクションで出す", () => {
    renderPanel(
      listWith({
        hiddenPrunings: [
          {
            opponentMoveId: 20,
            code: "fireball",
            nameJa: "波動拳",
            opponentCharacterId: 2,
            opponentCharacterNameJa: "ケン",
            note: "届かない",
          },
        ],
        hiddenCurations: [
          {
            comboId: 77,
            opponentMoveId: 21,
            code: "shoryuken",
            nameJa: "昇龍拳",
            opponentCharacterId: 2,
            opponentCharacterNameJa: "ケン",
            starterMoveCode: "standing_light_punch",
            starterMoveNameJa: "立ち弱P",
            note: "難しい",
          },
        ],
      }),
    );

    // 見出しが 2 系統に分かれている。
    expect(screen.getByText("確定反撃のない技")).toBeTruthy();
    expect(screen.getByText("使わない反撃")).toBeTruthy();
    // 括弧書きの粒度説明は 2026-07-26 開発者フィードバック 5 で削除した。
    expect(screen.queryByText(/コンボによらない/)).toBeNull();
    expect(screen.queryByText(/このコンボだけ/)).toBeNull();
    expect(
      screen.getByText("この相手技には確定反撃がないとして、探す画面から隠したものです。"),
    ).toBeTruthy();
    expect(
      screen.getByText("この反撃は使わないとして、マイリストから隠したものです。"),
    ).toBeTruthy();

    expect(screen.getByText("波動拳")).toBeTruthy();
    expect(screen.getByText("理由: 届かない")).toBeTruthy();
    expect(screen.getByText("昇龍拳")).toBeTruthy();
    expect(screen.getByText("コンボ #77")).toBeTruthy();
    // ★M24-07(SM-133): 帰属ラベルを足したため「始動」→「自分の始動技」。
    //   ★主張は変えていない —— 始動技が**行の属性として**出ていること(階層を切らない)。
    //   ★★M24-07 レビュー(中-6): 自分側もバッジへ揃えたため 2 要素に分かれた。
    expect(screen.getByText("自分の始動技")).toBeTruthy();
    expect(screen.getByText("立ち弱P")).toBeTruthy();
  });

  it("pruning の解除が自キャラ × 相手技のキーで呼ばれる(BE は既存 endpoint)", () => {
    renderPanel(
      listWith({
        hiddenPrunings: [
          {
            opponentMoveId: 20,
            code: "fireball",
            opponentCharacterId: 2,
            opponentCharacterNameJa: "ケン",
          },
        ],
      }),
    );
    fireEvent.click(screen.getByText("解除して再表示"));
    expect(removePruning).toHaveBeenCalledTimes(1);
    expect(removePruning.mock.calls[0][0]).toEqual({
      selfCharacterId: 1,
      opponentMoveId: 20,
    });
    expect(removeCuration).not.toHaveBeenCalled();
  });

  it("curation の解除がコンボ × 相手技のキーで呼ばれる", () => {
    renderPanel(
      listWith({
        hiddenCurations: [
          {
            comboId: 77,
            opponentMoveId: 21,
            code: "shoryuken",
            opponentCharacterId: 2,
            opponentCharacterNameJa: "ケン",
          },
        ],
      }),
    );
    fireEvent.click(screen.getByText("解除して再表示"));
    expect(removeCuration).toHaveBeenCalledTimes(1);
    expect(removeCuration.mock.calls[0][0]).toEqual({
      comboId: 77,
      opponentMoveId: 21,
    });
    expect(removePruning).not.toHaveBeenCalled();
  });

  it("どちらも 0 件のとき空メッセージを出す(片道操作の説明が消えない)", () => {
    renderPanel(listWith());
    expect(screen.getByText("隠している相手技はありません。")).toBeTruthy();
    expect(screen.getByText("隠している反撃はありません。")).toBeTruthy();
  });
});

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MOVE_CODE_DRIVE_REVERSAL } from "@/constants/move-code";
import type { Move } from "@/features/moves/types";
import { queryKeys } from "@/lib/query-keys";

import type { CommandIndexEntries } from "../inputResolutionStage2";
import type { RecipeInputContext } from "../moveSurfacing";
import { surfaceBuckets } from "../moveSurfacing";
import { useControllerInputOmission } from "./useControllerInputOmission";

// ★★M31-04: 「入力面へ一切出さない技」がプルダウンからも落ちることを固定する。
//
//   ★本サブの段 4 は 2 面(未分類タブ / 全技一覧プルダウン)をまたぐ。moveSurfacing.test.ts が
//     見ているのは前者だけであり、**このファイルが無いと後者は filter を消しても全緑で通る**
//     (レビュー 中-1)。E2E のプルダウン検査も技名を名指しして数える形なので、
//     選択肢が 1 つ増えても緑のままである。
//
//   ★フックは useCommandIndex / useCharacters を引くが、いずれも取得に失敗しても
//     壊れない設計である(空 entries = 段階1 だけで判定 / customStates 無し)。
//     ⇒ QueryClient を素で与えれば、ネットワークを持たないまま除外の効き目だけを測れる。

function createWrapper(entries?: CommandIndexEntries) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 5 * 60 * 1000 } },
  });
  if (entries !== undefined) {
    // ★段階2 の解決表を注入する(実 fetch を起こさない。VirtualController.test.tsx と同じ作法)。
    qc.setQueryData(queryKeys.commandIndex(1), { characterId: 1, entries });
  }
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

function move(
  id: number,
  code: string,
  category: string,
  extra: Partial<Move> = {},
): Move {
  return {
    id,
    characterId: 1,
    code,
    category,
    isAerial: false,
    setupOnly: false,
    isDerived: false,
    ...extra,
  };
}

const MOVES: Move[] = [
  move(1, "standing_light_punch", "normal"),
  move(2, "dash_back", "system"),
  move(3, MOVE_CODE_DRIVE_REVERSAL, "system"),
];

describe("useControllerInputOmission — 入力面から外す技(M31-04)", () => {
  it("★トグル OFF(既定)でもプルダウンに drive_reversal は並ばない", () => {
    const { result } = renderHook(() => useControllerInputOmission(1, MOVES, "combo"), {
      wrapper: createWrapper(),
    });
    expect(result.current.omitSurfaced).toBe(false);
    const codes = result.current.visibleMoves.map((m) => m.code);
    expect(codes).not.toContain(MOVE_CODE_DRIVE_REVERSAL);
    // ★対照: 同じ category=system の共通技は既定で残る(除外は code 単位である)。
    expect(codes).toContain("dash_back");
  });

  it("★常時除外は omittedCount に数えない(トグルの効き目ではない)", () => {
    const { result } = renderHook(() => useControllerInputOmission(1, MOVES, "combo"), {
      wrapper: createWrapper(),
    });
    // ★トグルが省く側は 2 件 —— standing_light_punch(通常技タブ)と dash_back(共通技タブ)。
    //   drive_reversal は「押せる技」ではないので、この数には入らない。
    expect(result.current.omittedCount).toBe(2);
  });
});

// ★★★M31-06: `setup_only` はコンボ側のプルダウンからだけ落ちる。
//
//   ★★同フックは 2 面(コンボのレシピ入力 / セットプレイのレシピ入力)が共有している。
//     ⇒ 面を取り違えると、セットプレイから技が静かに消える —— 本サブ最大の事故の形である
//       (チェックリスト §0 / C-1)。
//   ★★★実 DB の setup_only は 0 件なので、**でっち上げ 1 件だけが効き目の証拠**である。
describe("★★useControllerInputOmission — setup_only の面わけ(M31-06)", () => {
  // ★掲載される形にしてある(category='special' = 必殺技タブに載る)。
  //   ⇒ omittedCount の数え過ぎを検出できるのは、この形だけである。
  const setupOnlySpecial = move(4, "su_trap_light", "special", {
    setupOnly: true,
  });
  const MS: Move[] = [...MOVES, setupOnlySpecial];

  it("★コンボ側: トグル OFF(既定)でも ON でもプルダウンに並ばない", () => {
    const { result } = renderHook(
      () => useControllerInputOmission(1, MS, "combo"),
      { wrapper: createWrapper() },
    );
    expect(result.current.omitSurfaced).toBe(false);
    expect(result.current.visibleMoves.map((m) => m.code)).not.toContain(
      "su_trap_light",
    );
    act(() => result.current.setOmitSurfaced(true));
    expect(result.current.omitSurfaced).toBe(true);
    expect(result.current.visibleMoves.map((m) => m.code)).not.toContain(
      "su_trap_light",
    );
  });

  it("★★★陽性対照: セットプレイ側では OFF でも ON でも並ぶ", () => {
    // ★★「コンボ側に出ない」だけでは、元から居なかった場合と区別できない(D-3)。
    //   ★ON でも残るのは、必殺技タブが**セットプレイの面にも在る**ためではなく、
    //     トグルが省くのは「掲載済み」だからである。⇒ ここは OFF 側が本質。
    const { result } = renderHook(
      () => useControllerInputOmission(1, MS, "setup"),
      { wrapper: createWrapper() },
    );
    expect(result.current.visibleMoves.map((m) => m.code)).toContain(
      "su_trap_light",
    );
  });

  it("★★omittedCount に常時除外を数えない(掲載される形でも増えない)", () => {
    // ★★drive_reversal はどのタブにも載らないため、旧実装(moves を走査)でも
    //   偶然 0 件しか差が出なかった。**setup_only は掲載される形に立ちうる**ので、
    //   走査対象を selectableMoves へ移していないとここで 3 になる。
    const combo = renderHook(
      () => useControllerInputOmission(1, MS, "combo"),
      { wrapper: createWrapper() },
    );
    expect(combo.result.current.omittedCount).toBe(2);
    // ★対照: セットプレイ側では掲載済みとして数えられる(3 件目が加わる)。
    const setup = renderHook(
      () => useControllerInputOmission(1, MS, "setup"),
      { wrapper: createWrapper() },
    );
    expect(setup.result.current.omittedCount).toBe(3);
  });

  it("★★drive_reversal は面に関係なく落ちる(セットプレイ側へ漏らさない)", () => {
    for (const context of ["combo", "setup"] as const) {
      const { result } = renderHook(
        () => useControllerInputOmission(1, MS, context),
        { wrapper: createWrapper() },
      );
      expect(
        result.current.visibleMoves.map((m) => m.code),
        `${context} 面`,
      ).not.toContain(MOVE_CODE_DRIVE_REVERSAL);
    }
  });
});

// ★★★M31-06 レビュー 高-2: 「トグル ON で残る集合 ＝ 当該面の未分類タブ」を固定する。
//
//   ★★この等式は `moveSurfacing.ts` ヘッダ（規則を 2 か所へ書かない）／`CHANGE-176` §2.5 ／
//     `DES-005` §6 が共通の前提にしているが、**実データ以外で固定しているテストが無かった。**
//   ★★★崩れ方は「述語が違う」ではなく「**述語へ渡す材料が違う**」である。⇒ 走査対象だけ
//     揃えても足りない。母集団（第 2 引数と normalTabMoveIds の入力）まで揃える必要がある。
describe("★★★プルダウンが省く集合 ＝ 当該面の未分類タブ(M31-06 レビュー 高-2)", () => {
  // ★★でっち上げの肝＝**段階2 の解決表が setup_only の技を指している**こと。
  //   ⇒ コンボ側では母集団から消えるので段階1 へフォールバックし、
  //     `standing_light_punch` が「押せる技」へ変わる。
  //   ★母集団を揃えていないと、フック側だけが entries を当ててこの変化を見落とす。
  const setupOnlyUnique = move(5, "su_shoulder_ram", "unique", {
    setupOnly: true,
  });
  const MS: Move[] = [...MOVES, setupOnlyUnique];
  // ★中段ゾーン(4 / 5 / 6)は 3 方向とも `neutral` へ縮約されるため、**3 つとも**差し替える。
  //   ⇒ 1 つだけだと残り 2 方向の段階1 フォールバックで standing_light_punch に到達でき、
  //     両面で差が出ない(＝対照が対照にならない)。★実測して 3 つに直した。
  const ENTRIES: CommandIndexEntries = {
    "4LP": "su_shoulder_ram",
    LP: "su_shoulder_ram",
    "6LP": "su_shoulder_ram",
  };

  function expectEquivalence(context: RecipeInputContext) {
    const { result } = renderHook(
      () => useControllerInputOmission(1, MS, context),
      { wrapper: createWrapper(ENTRIES) },
    );
    act(() => result.current.setOmitSurfaced(true));
    const remaining = result.current.visibleMoves.map((m) => m.code).sort();
    const unclassified = surfaceBuckets(MS, ENTRIES, [], context)
      .unclassified.map((m) => m.code)
      .sort();
    expect(remaining, `${context} 面`).toEqual(unclassified);
  }

  it("★コンボ側で一致する", () => {
    expectEquivalence("combo");
  });

  it("★セットプレイ側でも一致する", () => {
    expectEquivalence("setup");
  });

  it("★前提の確認: この解決表では両面で「押せる技」が食い違う", () => {
    // ★★この 1 本が無いと、上の 2 本は「そもそも差が出ない入力」でも緑になる。
    //   ⇒ コンボ側は段階1 へ落ちて standing_light_punch が押せるようになり、
    //     セットプレイ側は entries が当たるので押せないまま未分類に残る。
    const combo = surfaceBuckets(MS, ENTRIES, [], "combo")
      .unclassified.map((m) => m.code);
    const setup = surfaceBuckets(MS, ENTRIES, [], "setup")
      .unclassified.map((m) => m.code);
    expect(combo).not.toContain("standing_light_punch");
    expect(setup).toContain("standing_light_punch");
  });
});

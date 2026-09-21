import { describe, it, expect } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { PunishTree } from "./PunishTree";
import type { PunishTree as PunishTreeData } from "../types";

function LocationProbe() {
  const loc = useLocation();
  const state = loc.state as {
    punishReturn?: string;
    punishSelfCharacterId?: number;
    opponentMoveId?: number;
    hitType?: string;
  } | null;
  return (
    <div>
      <span data-testid="probe-path">{loc.pathname}</span>
      <span data-testid="probe-search">{loc.search}</span>
      <span data-testid="probe-return">{state?.punishReturn ?? "none"}</span>
      <span data-testid="probe-self-character">
        {state?.punishSelfCharacterId ?? "none"}
      </span>
      <span data-testid="probe-opponent-move">
        {state?.opponentMoveId ?? "none"}
      </span>
      <span data-testid="probe-hit-type">{state?.hitType ?? "none"}</span>
    </div>
  );
}

function renderTree(tree: PunishTreeData, guardType = "just_parry") {
  const qc = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/punish/search"]}>
        <Routes>
          <Route
            path="/punish/search"
            element={<PunishTree tree={tree} guardType={guardType} />}
          />
          <Route path="/combos/new" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const treeWithJumpStarterNoCombos: PunishTreeData = {
  selfCharacterId: 1,
  opponentCharacterId: 2,
  guardType: "just_parry",
  nodes: [
    {
      moveId: 10,
      code: "hp",
      nameJa: "強P",
      advantage: 40,
      starters: [
        {
          moveId: 100,
          code: "jumping_heavy_punch",
          nameJa: "ジャンプ強P",
          lane: "jump",
          startup: 9,
          combos: [], // 孫 0 件
        },
      ],
    },
  ],
  manualReviewNodes: [
    {
      moveId: 20,
      code: "fireball",
      nameJa: "波動拳",
      reasonCode: "distance_dependent",
      registeredCombos: [],
    },
  ],
};

const treeWithGrandchildCombos: PunishTreeData = {
  selfCharacterId: 1,
  opponentCharacterId: 2,
  guardType: "just_parry",
  nodes: [
    {
      moveId: 10,
      code: "hp",
      nameJa: "強P",
      advantage: 40,
      starters: [
        {
          moveId: 100,
          code: "cr_mp",
          nameJa: "しゃがみ中P",
          lane: "ground",
          startup: 6,
          combos: [
            { comboId: 201, damage: 2000, stepCount: 3, hitType: "normal", adopted: false, hasMaterializedVersion: false },
            {
              comboId: 202,
              damage: 3000,
              stepCount: 4,
              hitType: "punish_counter",
              adopted: false,
              hasMaterializedVersion: false,
            },
          ],
        },
      ],
    },
  ],
  manualReviewNodes: [],
};

// ★★M24-07(SM-133): 確定反撃サーチは相手の技(第 1 階層)と自分の始動技(第 2 階層)を
//   同じ形で並べており、太さの差(font-semibold / font-medium)しか手掛かりが無かった。
//   ⇒ 帰属ラベルを両方へ足した。片方だけだと読み分けの役に立たない。
//
// ★★M24-07 レビュー(中-6): 語(「自分の技」/「自分の始動技」)と形(バッジ/プレーン
//   テキスト)が 3 面で割れていた。⇒ constants/punish.ts と PunishAttributionBadge へ
//   1 本化した。本ファイルにその観測が無かったため下の it を足す。

describe("PunishTree", () => {
  it("孫コンボ行に変換ボタンを出す(punish_counter 系には出さない・§4.8)", () => {
    renderTree(treeWithGrandchildCombos);
    fireEvent.click(screen.getAllByLabelText("expand")[0]); // 相手技を展開
    fireEvent.click(screen.getAllByLabelText("expand")[0]); // 始動技を展開
    expect(screen.getByText("コンボ #201")).toBeTruthy();
    expect(screen.getByText("コンボ #202")).toBeTruthy();
    // normal の 201 にのみ出て、punish_counter の 202 には出ない → 合計 1 個。
    expect(screen.getAllByText("パニッシュカウンター版を作る").length).toBe(1);
  });

  it("★帰属ラベルは相手側・自分側とも同じ語と形で出る(M24-07 レビュー 中-6)", () => {
    renderTree(treeWithGrandchildCombos);
    // 第 1 階層(相手の技)は展開前から出ている。
    expect(screen.getAllByText("相手の技").length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByLabelText("expand")[0]); // 相手技を展開
    // 第 2 階層(自分の始動技)。★語は「自分の技」ではない —— 3 面で 1 本に揃えてある。
    expect(screen.getAllByText("自分の始動技").length).toBeGreaterThan(0);
    expect(screen.queryByText("自分の技")).toBeNull();
  });

  it("相手技→始動技→(孫 0 でも)新規登録リンクの 3 階層を描画し、レーンバッジを出す", () => {
    renderTree(treeWithJumpStarterNoCombos);

    // 親: 相手技 + 有利フレーム。
    expect(screen.getByText("強P")).toBeTruthy();
    expect(screen.getByText("有利 +40F")).toBeTruthy();

    // 親を展開 → 子(始動技)とレーンバッジ。
    fireEvent.click(screen.getAllByLabelText("expand")[0]);
    expect(screen.getByText("ジャンプ強P")).toBeTruthy();
    expect(screen.getByText("ジャンプ経由")).toBeTruthy();

    // 子を展開 → 孫 0 件でも「新規登録」リンクが出る。
    fireEvent.click(screen.getAllByLabelText("expand")[0]);
    expect(screen.getByText("このコンボを新規登録する")).toBeTruthy();
  });

  it("手動確認レーンに理由バッジ(距離依存)を出す", () => {
    renderTree(treeWithJumpStarterNoCombos);
    expect(screen.getByText("波動拳")).toBeTruthy();
    expect(screen.getByText("距離依存")).toBeTruthy();
  });

  it("成立ツリーの新規登録はキャラと hit_type を固定するが、自動採用用の相手技は渡さない", () => {
    renderTree(treeWithJumpStarterNoCombos);
    fireEvent.click(screen.getAllByLabelText("expand")[0]); // 親展開
    fireEvent.click(screen.getAllByLabelText("expand")[0]); // 子展開
    fireEvent.click(screen.getByText("このコンボを新規登録する"));

    expect(screen.getByTestId("probe-path").textContent).toBe("/combos/new");
    expect(screen.getByTestId("probe-search").textContent).toBe("?character=1");
    expect(screen.getByTestId("probe-return").textContent).toBe(
      "/punish/search?self=1&opp=2&guard=just_parry",
    );
    expect(screen.getByTestId("probe-self-character").textContent).toBe("1");
    expect(screen.getByTestId("probe-opponent-move").textContent).toBe("none");
    expect(screen.getByTestId("probe-hit-type").textContent).toBe(
      "just_parry_punish_counter",
    );
  });

  it("ガードタブの手動登録へ自キャラ・opponentMoveId・punish_counter を渡す", () => {
    renderTree(treeWithJumpStarterNoCombos, "block");
    fireEvent.click(screen.getByText("手動で確定反撃を登録"));
    expect(screen.getByTestId("probe-self-character").textContent).toBe("1");
    expect(screen.getByTestId("probe-opponent-move").textContent).toBe("20");
    expect(screen.getByTestId("probe-hit-type").textContent).toBe(
      "punish_counter",
    );
  });

  it("相手技行に『確定反撃のない技なので隠す』と隠す理由入力欄を出す", () => {
    renderTree(treeWithJumpStarterNoCombos);
    expect(screen.getByText("確定反撃のない技なので隠す")).toBeTruthy();
    expect(screen.getByLabelText("隠す理由(任意)")).toBeTruthy();
  });

  it("始動技行に『採用/不採用』トグルと不採用理由入力欄を出す", () => {
    renderTree(treeWithJumpStarterNoCombos);
    fireEvent.click(screen.getAllByLabelText("expand")[0]); // 親展開 → 始動技表示
    expect(screen.getByText("ジャンプ経由")).toBeTruthy();
    expect(screen.getByText("採用")).toBeTruthy();
    expect(screen.getByText("不採用")).toBeTruthy();
    expect(screen.getByLabelText("不採用理由(任意)")).toBeTruthy();
  });

  it("採用済みの verdict はトグルボタンが押下状態(aria-pressed)になる", () => {
    const tree: PunishTreeData = {
      selfCharacterId: 1,
      opponentCharacterId: 2,
      guardType: "just_parry",
      nodes: [
        {
          moveId: 10,
          code: "hp",
          nameJa: "強P",
          advantage: 40,
          starters: [
            {
              moveId: 100,
              code: "slp",
              nameJa: "立ち弱P",
              lane: "ground",
              startup: 5,
              verdict: "adopted",
              combos: [],
            },
          ],
        },
      ],
      manualReviewNodes: [],
    };
    renderTree(tree);
    fireEvent.click(screen.getAllByLabelText("expand")[0]);
    expect(screen.getByText("採用").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("不採用").getAttribute("aria-pressed")).toBe("false");
  });

  it("始動技を一時的に隠すと消え、再表示で戻る", () => {
    renderTree(treeWithJumpStarterNoCombos);
    fireEvent.click(screen.getAllByLabelText("expand")[0]); // 親展開
    expect(screen.getByText("ジャンプ強P")).toBeTruthy();
    // 一時的に隠す。
    fireEvent.click(screen.getByLabelText("この始動技を一時非表示にする"));
    expect(screen.queryByText("ジャンプ強P")).toBeNull();
    // 再表示コントロールが出る。
    fireEvent.click(screen.getByText("すべて再表示"));
    expect(screen.getByText("ジャンプ強P")).toBeTruthy();
  });

  it("始動技にコンボが紐づく場合、行を増やさず件数バッジ(コンボ N件)を出す", () => {
    const tree: PunishTreeData = {
      selfCharacterId: 1,
      opponentCharacterId: 2,
      guardType: "just_parry",
      nodes: [
        {
          moveId: 10,
          code: "hp",
          nameJa: "強P",
          advantage: 40,
          starters: [
            {
              moveId: 100,
              code: "slp",
              nameJa: "立ち弱P",
              lane: "ground",
              startup: 5,
              combos: [
                { comboId: 1, adopted: false, stepCount: 3, hasMaterializedVersion: false },
                { comboId: 2, adopted: true, stepCount: 4, hasMaterializedVersion: false },
              ],
            },
          ],
        },
      ],
      manualReviewNodes: [],
    };
    renderTree(tree);
    fireEvent.click(screen.getAllByLabelText("expand")[0]); // 親展開 → 始動技表示
    // 展開前(始動技行ヘッダー内)に件数バッジが出る。
    expect(screen.getByText("コンボ 2件")).toBeTruthy();
  });

  // 2026-07-26 開発者フィードバック 7: 成立ツリーの孫コンボにレシピを出す。
  it("成立ツリーの孫コンボにレシピを出し、無ければ出さない", () => {
    const tree: PunishTreeData = {
      selfCharacterId: 1,
      opponentCharacterId: 2,
      guardType: "just_parry",
      nodes: [
        {
          moveId: 10,
          code: "hp",
          nameJa: "強P",
          advantage: 40,
          starters: [
            {
              moveId: 100,
              code: "slp",
              nameJa: "立ち弱P",
              lane: "ground",
              startup: 5,
              combos: [
                { comboId: 77, stepCount: 3, adopted: false, hasMaterializedVersion: false, recipe: "弱P > 中K > 波動拳" },
                { comboId: 78, stepCount: 2, adopted: false, hasMaterializedVersion: false },
              ],
            },
          ],
        },
      ],
      manualReviewNodes: [],
    };
    renderTree(tree);
    fireEvent.click(screen.getAllByLabelText("expand")[0]); // 相手技
    fireEvent.click(screen.getAllByLabelText("expand")[0]); // 始動技

    expect(screen.getByText("弱P > 中K > 波動拳")).toBeTruthy();
    // recipe 未設定の行はコンボ自体は出るがレシピ行は出さない。
    expect(screen.getByText("コンボ #78")).toBeTruthy();
  });

  // M18-03a §4.5: 自動判定できない相手技への既登録表示。
  it("自動判定できない相手技の配下に『登録済みの確定反撃』を出す", () => {
    const tree: PunishTreeData = {
      selfCharacterId: 1,
      opponentCharacterId: 2,
      guardType: "just_parry",
      nodes: [],
      manualReviewNodes: [
        {
          moveId: 20,
          code: "fireball",
          nameJa: "波動拳",
          reasonCode: "distance_dependent",
          registeredCombos: [
            {
              comboId: 77,
              damage: 2800,
              stepCount: 5,
              starterMoveCode: "standing_light_punch",
              starterMoveNameJa: "立ち弱P",
              recipe: "弱K > 強P",
            },
          ],
        },
      ],
    };
    renderTree(tree);
    // フレーム判定の結果ではないと分かる見出しを置き、成立ツリーの候補と混ぜない。
    expect(screen.getByText("登録済みの確定反撃")).toBeTruthy();
    expect(screen.getByText("コンボ #77")).toBeTruthy();
    expect(screen.getByText("始動 立ち弱P")).toBeTruthy();
    expect(screen.getByText("ダメージ 2800")).toBeTruthy();
    expect(screen.getByText("弱K > 強P")).toBeTruthy();
  });

  it("既登録が無い相手技には『登録済みの確定反撃』の見出しを出さない", () => {
    renderTree(treeWithJumpStarterNoCombos);
    expect(screen.queryByText("登録済みの確定反撃")).toBeNull();
    // 既存の理由バッジ・手動登録導線は不変。
    expect(screen.getByText("距離依存")).toBeTruthy();
    expect(screen.getByText("手動で確定反撃を登録")).toBeTruthy();
  });

  it("PC版作成済みの基底だけを末尾の『変換済み』へ畳み、展開時に理由バッジを出す", () => {
    const tree: PunishTreeData = {
      ...treeWithGrandchildCombos,
      nodes: [
        {
          ...treeWithGrandchildCombos.nodes[0],
          starters: [
            {
              ...treeWithGrandchildCombos.nodes[0].starters[0],
              combos: [
                {
                  comboId: 201,
                  stepCount: 3,
                  adopted: false,
                  hasMaterializedVersion: false,
                },
                {
                  comboId: 202,
                  stepCount: 4,
                  adopted: false,
                  hasMaterializedVersion: true,
                },
              ],
            },
          ],
        },
      ],
    };
    renderTree(tree);
    fireEvent.click(screen.getAllByLabelText("expand")[0]);
    fireEvent.click(screen.getAllByLabelText("expand")[0]);

    expect(screen.getByText("コンボ #201")).toBeTruthy();
    expect(screen.queryByText("コンボ #202")).toBeNull();
    fireEvent.click(screen.getByText("変換済み (1 件)"));
    expect(screen.getByText("コンボ #202")).toBeTruthy();
    expect(screen.getByText("PC 版を作成済み")).toBeTruthy();
  });

  it("変換済みが 0 件なら折りたたみを出さない", () => {
    renderTree(treeWithGrandchildCombos);
    fireEvent.click(screen.getAllByLabelText("expand")[0]);
    fireEvent.click(screen.getAllByLabelText("expand")[0]);
    expect(screen.queryByText(/変換済み/)).toBeNull();
  });

  it("レーン名が『その場/前方ステップ』で表示される", () => {
    const tree: PunishTreeData = {
      selfCharacterId: 1,
      opponentCharacterId: 2,
      guardType: "just_parry",
      nodes: [
        {
          moveId: 10,
          code: "hp",
          nameJa: "強P",
          advantage: 40,
          starters: [
            { moveId: 100, code: "slp", nameJa: "立ち弱P", lane: "ground", startup: 5, combos: [] },
            { moveId: 100, code: "slp", nameJa: "立ち弱P", lane: "dash", startup: 5, slack: 10, combos: [] },
          ],
        },
      ],
      manualReviewNodes: [],
    };
    renderTree(tree);
    fireEvent.click(screen.getAllByLabelText("expand")[0]);
    expect(screen.getByText("その場")).toBeTruthy();
    expect(screen.getByText("前方ステップ")).toBeTruthy();
  });
});

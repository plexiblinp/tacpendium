import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import {
  MATERIALIZE_ATTENTION_TOAST_ID,
  MATERIALIZE_RESULT_TOAST_ID,
} from "@/constants/punish";
import { PunishList } from "./PunishList";
import type {
  PunishList as PunishListData,
  PunishListComboNode,
} from "../types";

const toastSuccess = vi.hoisted(() => vi.fn());
const toastInfo = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());

const removePunish = vi.fn();
const materialize = vi.fn();
const addCuration = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccess,
    info: toastInfo,
    error: toastError,
  },
}));

// api モジュールをモックし、mutate 呼び出しだけを観測する(fetch を張らない)。
vi.mock("../api", () => ({
  useRemovePunish: () => ({ mutate: removePunish }),
  useMaterialize: () => ({ mutate: materialize, isPending: false }),
  useAddCuration: () => ({ mutate: addCuration, isPending: false }),
}));

function renderList(list: PunishListData) {
  const qc = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/punish/list"]}>
        <PunishList list={list} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function combo(over: Partial<PunishListComboNode> = {}): PunishListComboNode {
  return {
    comboId: 77,
    damage: 2800,
    stepCount: 5,
    hitType: "just_parry_punish_counter",
    starterMoveId: 100,
    starterMoveCode: "standing_light_punch",
    starterMoveNameJa: "立ち弱P",
    ...over,
  };
}

function baseList(over: Partial<PunishListData> = {}): PunishListData {
  return {
    selfCharacterId: 1,
    guardType: "just_parry",
    hitType: "just_parry_punish_counter",
    nodes: [
      {
        moveId: 20,
        code: "fireball",
        nameJa: "波動拳",
        opponentCharacterId: 2,
        opponentCharacterNameJa: "ケン",
        combos: [combo()],
      },
    ],
    unclassifiedNodes: [],
    hiddenPrunings: [],
    hiddenCurations: [],
    ...over,
  };
}

beforeEach(() => {
  removePunish.mockReset();
  materialize.mockReset();
  addCuration.mockReset();
  toastSuccess.mockReset();
  toastInfo.mockReset();
  toastError.mockReset();
});

describe("PunishList", () => {
  it("相手技→コンボの 2 階層を描画し、始動技は行の属性として出す(階層を切らない)", () => {
    renderList(baseList());

    // 第1階層: 相手技 + 相手キャラ名 + 件数。
    expect(screen.getByText("波動拳")).toBeTruthy();
    expect(screen.getByText("ケン")).toBeTruthy();
    expect(screen.getByText("コンボ 1件")).toBeTruthy();
    // 展開前は第2階層が出ない。
    expect(screen.queryByText("コンボ #77")).toBeNull();

    fireEvent.click(screen.getAllByLabelText("expand")[0]);

    // 第2階層: コンボ行に始動技・ダメージ・手数・hit_type バッジが並ぶ。
    expect(screen.getByText("コンボ #77")).toBeTruthy();
    // ★M24-07(SM-133): 帰属ラベルを足したため「始動」→「自分の始動技」。
    //   ★主張は変えていない —— 始動技が**行の属性として**出ていること(階層を切らない)。
    //   ★★M24-07 レビュー(中-6): 自分側もバッジへ揃えたため、ラベルと技名は別要素に
    //     なった。⇒ 逐語の連結ではなく 2 つに分けて主張する(主張は同じ)。
    expect(screen.getByText("自分の始動技")).toBeTruthy();
    expect(screen.getByText("立ち弱P")).toBeTruthy();

    // ★★M24-07(SM-133): 相手の技と自分の始動技が同じ形で並び、太さの差しか手掛かりが
    //   無かった。⇒ 帰属ラベルが**両方に**出ていること。片方だけでは読み分けられない。
    expect(screen.getByText("相手の技")).toBeTruthy();
    expect(screen.getByText("ダメージ 2800")).toBeTruthy();
    expect(screen.getByText("5 ステップ")).toBeTruthy();
    expect(
      screen.getByText("パニッシュカウンター(ジャストパリィ反撃)"),
    ).toBeTruthy();
  });

  it("materializedFromComboId が非 NULL の行に生成元バッジを出す(NULL なら出さない)", () => {
    renderList(
      baseList({
        nodes: [
          {
            moveId: 20,
            code: "fireball",
            nameJa: "波動拳",
            opponentCharacterId: 2,
            opponentCharacterNameJa: "ケン",
            combos: [
              combo({ comboId: 77, materializedFromComboId: 5 }),
              combo({ comboId: 78 }), // 出自なし
            ],
          },
        ],
      }),
    );
    fireEvent.click(screen.getAllByLabelText("expand")[0]);
    // 生成物 1 件だけにバッジが出る(タブ側でもバッジは出す。変換ボタンはタブ側には出さない)。
    expect(screen.getAllByText("PC版(生成)").length).toBe(1);
    expect(screen.queryByText("パニッシュカウンター版を作る")).toBeNull();
  });

  it("レシピがあればコンボ行に出し、無ければ出さない", () => {
    renderList(
      baseList({
        nodes: [
          {
            moveId: 20,
            code: "fireball",
            nameJa: "波動拳",
            opponentCharacterId: 2,
            opponentCharacterNameJa: "ケン",
            combos: [
              combo({ comboId: 77, recipe: "弱P > 中K > 波動拳" }),
              combo({ comboId: 78, recipe: undefined }),
            ],
          },
        ],
      }),
    );
    fireEvent.click(screen.getAllByLabelText("expand")[0]);
    expect(screen.getByText("弱P > 中K > 波動拳")).toBeTruthy();
    // recipe 未設定の行はレシピ span を持たない(コンボ #78 は出るがレシピは出ない)。
    expect(screen.getByText("コンボ #78")).toBeTruthy();
  });

  it("空状態で確定反撃サーチへのリンクを出す", () => {
    renderList(baseList({ nodes: [] }));
    const link = screen.getByText("確定反撃サーチ").closest("a");
    expect(link).toBeTruthy();
    expect(link?.getAttribute("href")).toBe("/punish/search");
  });

  it("PC 系のマイリスト本体には curation 登録導線を出さない", () => {
    renderList(baseList());
    fireEvent.click(screen.getAllByLabelText("expand")[0]);

    expect(screen.queryByText("使わない")).toBeNull();
    expect(screen.queryByLabelText("隠す理由(任意)")).toBeNull();
  });

  it("「確定反撃の採用を解除」が既存の DELETE /api/combo-punishes を叩く", () => {
    renderList(baseList());
    fireEvent.click(screen.getAllByLabelText("expand")[0]);
    fireEvent.click(screen.getByText("確定反撃の採用を解除"));

    expect(removePunish).toHaveBeenCalledTimes(1);
    expect(removePunish.mock.calls[0][0]).toEqual({
      comboId: 77,
      opponentMoveId: 20,
    });
  });

  it("区分を判定できない反撃を件数付きで出し、展開すると中身と次のアクションが読める", () => {
    renderList(
      baseList({
        unclassifiedNodes: [
          {
            moveId: 21,
            code: "shoryuken",
            nameJa: "昇龍拳",
            opponentCharacterId: 2,
            opponentCharacterNameJa: "ケン",
            combos: [
              combo({ comboId: 88, hitType: "normal" }),
              combo({ comboId: 89, hitType: undefined }),
            ],
          },
        ],
      }),
    );

    // 3 つ目のタブにはせず、両タブ共通のセクションとして件数を出す。
    expect(screen.getByText("区分を判定できない反撃(2 件)")).toBeTruthy();

    // 見出しをクリックすると中身が見える(件数だけで終わらせない)。
    fireEvent.click(screen.getByText("区分を判定できない反撃(2 件)"));
    expect(screen.getByText("昇龍拳")).toBeTruthy();
    // M18-03b で変換機能が実装され、告知文は変換導線の案内へ書き換わっている。
    expect(
      screen.getByText(/で変換すると、別コンボとして生成され、上の一覧に出ます/),
    ).toBeTruthy();
    // 相手技ノードを展開すると各コンボ行に変換ボタンが出る(区分不明＝normal/未設定は生成対象)。
    fireEvent.click(screen.getByText("昇龍拳"));
    expect(
      screen.getAllByText("パニッシュカウンター版を作る").length,
    ).toBe(2);
  });

  it("区分不明セクションの行の変換ボタンで materialize を呼ぶ", () => {
    materialize.mockClear();
    renderList(
      baseList({
        unclassifiedNodes: [
          {
            moveId: 21,
            code: "shoryuken",
            nameJa: "昇龍拳",
            opponentCharacterId: 2,
            opponentCharacterNameJa: "ケン",
            combos: [combo({ comboId: 88, hitType: "normal" })],
          },
        ],
      }),
    );
    fireEvent.click(screen.getByText("区分を判定できない反撃(1 件)"));
    fireEvent.click(screen.getByText("昇龍拳"));
    fireEvent.click(screen.getByText("パニッシュカウンター版を作る"));
    expect(materialize).toHaveBeenCalledWith(
      { baseComboId: 88, opponentMoveId: 21 },
      expect.anything(),
    );

    const [, options] = materialize.mock.calls[0];
    act(() =>
      options.onSuccess({
        comboId: 99,
        alreadyExisted: false,
        damageAdded: true,
      }),
    );
    expect(toastSuccess).toHaveBeenCalledWith(
      "パニッシュカウンター版を作成しました",
      expect.objectContaining({
        duration: Infinity,
        closeButton: true,
        id: MATERIALIZE_RESULT_TOAST_ID,
      }),
    );
  });

  it("加算スキップは要注意 ID で通知し、既存一致では永続通知を出さない", () => {
    renderList(
      baseList({
        unclassifiedNodes: [
          {
            moveId: 21,
            code: "shoryuken",
            nameJa: "昇龍拳",
            opponentCharacterId: 2,
            opponentCharacterNameJa: "ケン",
            combos: [combo({ comboId: 88, hitType: "normal" })],
          },
        ],
      }),
    );
    fireEvent.click(screen.getByText("区分を判定できない反撃(1 件)"));
    fireEvent.click(screen.getByText("昇龍拳"));
    fireEvent.click(screen.getByText("パニッシュカウンター版を作る"));

    const [, options] = materialize.mock.calls[0];
    act(() =>
      options.onSuccess({
        comboId: 99,
        alreadyExisted: false,
        damageAdded: false,
        damageSkipReason: "starter_move_not_pc_scaled",
      }),
    );
    expect(toastSuccess).toHaveBeenLastCalledWith(
      "パニッシュカウンター版を作成しました",
      expect.objectContaining({
        duration: Infinity,
        closeButton: true,
        id: MATERIALIZE_ATTENTION_TOAST_ID,
      }),
    );

    toastSuccess.mockClear();
    act(() =>
      options.onSuccess({
        comboId: 100,
        alreadyExisted: true,
        damageAdded: false,
      }),
    );
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(toastInfo).toHaveBeenCalledWith(
      "この確定反撃は既に登録されています",
      expect.objectContaining({
        action: expect.objectContaining({ label: "開く" }),
      }),
    );
  });

  it("区分不明セクションの行からも採用解除できる(他に解除できる UI が無いため)", () => {
    renderList(
      baseList({
        nodes: [],
        unclassifiedNodes: [
          {
            moveId: 21,
            code: "shoryuken",
            nameJa: "昇龍拳",
            opponentCharacterId: 2,
            opponentCharacterNameJa: "ケン",
            combos: [combo({ comboId: 88, hitType: "normal" })],
          },
        ],
      }),
    );
    fireEvent.click(screen.getByText("区分を判定できない反撃(1 件)"));
    fireEvent.click(screen.getAllByLabelText("expand")[0]);

    // curation は入力キューである区分不明セクションだけに出る。
    expect(screen.getByText("使わない")).toBeTruthy();
    // 「確定反撃の採用を解除」は出す。
    fireEvent.click(screen.getByText("確定反撃の採用を解除"));
    expect(removePunish).toHaveBeenCalledTimes(1);
    expect(removePunish.mock.calls[0][0]).toEqual({
      comboId: 88,
      opponentMoveId: 21,
    });
  });

  it("区分不明セクションだけで理由付き curation を登録できる", () => {
    renderList(
      baseList({
        nodes: [],
        unclassifiedNodes: [
          {
            moveId: 21,
            code: "shoryuken",
            nameJa: "昇龍拳",
            opponentCharacterId: 2,
            opponentCharacterNameJa: "ケン",
            combos: [combo({ comboId: 88, hitType: "normal" })],
          },
        ],
      }),
    );
    fireEvent.click(screen.getByText("区分を判定できない反撃(1 件)"));
    fireEvent.click(screen.getAllByLabelText("expand")[0]);
    fireEvent.change(screen.getByLabelText("隠す理由(任意)"), {
      target: { value: "距離が合わない" },
    });
    fireEvent.click(screen.getByText("使わない"));

    expect(addCuration).toHaveBeenCalledWith(
      {
        comboId: 88,
        opponentMoveId: 21,
        note: "距離が合わない",
      },
      expect.anything(),
    );

    const [, options] = addCuration.mock.calls[0];
    act(() => options.onSuccess());
    expect(
      (screen.getByLabelText("隠す理由(任意)") as HTMLInputElement).value,
    ).toBe("");
  });

  it("タブ内 0 件でも区分不明があるときは「まだ登録されていません」を出さない", () => {
    renderList(
      baseList({
        nodes: [],
        unclassifiedNodes: [
          {
            moveId: 21,
            code: "shoryuken",
            nameJa: "昇龍拳",
            opponentCharacterId: 2,
            opponentCharacterNameJa: "ケン",
            combos: [combo({ comboId: 88, hitType: "normal" })],
          },
        ],
      }),
    );
    expect(screen.queryByText("まだ確定反撃が登録されていません。")).toBeNull();
    expect(
      screen.getByText("このタブに該当する確定反撃はありません。"),
    ).toBeTruthy();
  });

  it("同一 moveId が両セクションにあっても展開が連動しない", () => {
    const node = {
      moveId: 20,
      code: "fireball",
      nameJa: "波動拳",
      opponentCharacterId: 2,
      opponentCharacterNameJa: "ケン",
    };
    renderList(
      baseList({
        nodes: [{ ...node, combos: [combo({ comboId: 77 })] }],
        unclassifiedNodes: [
          { ...node, combos: [combo({ comboId: 88, hitType: "normal" })] },
        ],
      }),
    );
    fireEvent.click(screen.getByText("区分を判定できない反撃(1 件)"));

    // 通常セクション側だけを展開する。
    fireEvent.click(screen.getAllByLabelText("expand")[0]);
    expect(screen.getByText("コンボ #77")).toBeTruthy();
    // 区分不明セクション側は閉じたまま(キーがセクション別なので連動しない)。
    expect(screen.queryByText("コンボ #88")).toBeNull();
  });

  it("区分を判定できない反撃が 0 件ならセクションを出さない", () => {
    renderList(baseList());
    expect(screen.queryByText(/区分を判定できない反撃/)).toBeNull();
  });
});

// ===========================================================================
// ★★M31-01(P4M-014): 「区分を判定できない反撃」の内側を ①② に割る
//
// 開発者の逐語(phase4-memo.txt:41-48)＝
//   「①反撃に転用可能なコンボの一覧（パニッシュカウンター、パニッシュカウンター
//     （ジャストパリィ）以外 / ②再利用可能なコンボの一覧（…だけ
//    ①はパニッシュカウンター版を作りつつ登録する。②はそのまま登録。
//    ①はすでにパニッシュカウンター版が作られているコンボはそのそも出さない。」
//
// ★★DES-005 §5.21 の骨格(両タブ共通・画面下部・折りたたみ・3 つ目のタブにしない)は
//   一つも壊していない。⇒ 割ったのは中身だけである。
// ===========================================================================

// ★タブ側(nodes)は空にする。両方に「expand」があると getByLabelText が曖昧になり、
//   本テストの主題(①② の割れ方)とは無関係な理由で落ちるため。
function unclassifiedList(combos: PunishListComboNode[]): PunishListData {
  return baseList({
    nodes: [],
    unclassifiedNodes: [
      {
        moveId: 30,
        code: "sweep",
        nameJa: "足払い",
        opponentCharacterId: 2,
        opponentCharacterNameJa: "ケン",
        combos,
      },
    ],
  });
}

describe("PunishList 区分不明セクションの ①② 分割(P4M-014)", () => {
  it("★通常・カウンター始動は ①(反撃に転用可能)へ入る", () => {
    renderList(
      unclassifiedList([
        combo({ comboId: 101, hitType: "normal" }),
        combo({ comboId: 102, hitType: "counter" }),
      ]),
    );
    fireEvent.click(screen.getByLabelText("expand"));

    const section = screen.getByTestId("punish-unclassified-convertible");
    expect(section.textContent).toContain("① 反撃に転用可能なコンボ(2 件)");
    expect(screen.queryByTestId("punish-unclassified-reusable")).toBeNull();
  });

  it("★パニッシュカウンター系(インパクト)は ②(再利用可能)へ入る", () => {
    renderList(
      unclassifiedList([combo({ comboId: 103, hitType: "drive_impact_punish_counter" })]),
    );
    fireEvent.click(screen.getByLabelText("expand"));

    const section = screen.getByTestId("punish-unclassified-reusable");
    expect(section.textContent).toContain("② 再利用可能なコンボ(1 件)");
    expect(screen.queryByTestId("punish-unclassified-convertible")).toBeNull();
  });

  // ★★② は既にパニッシュカウンターである。⇒ 変換導線を出してはならない。
  it("★② には「パニッシュカウンター版を作る」を出さない", () => {
    renderList(
      unclassifiedList([combo({ comboId: 103, hitType: "drive_impact_punish_counter" })]),
    );
    fireEvent.click(screen.getByLabelText("expand"));
    fireEvent.click(
      within(screen.getByTestId("punish-unclassified-reusable")).getByLabelText("expand"),
    );

    expect(screen.queryByText("パニッシュカウンター版を作る")).toBeNull();
  });

  it("★① には「パニッシュカウンター版を作る」を出す", () => {
    renderList(unclassifiedList([combo({ comboId: 101, hitType: "normal" })]));
    fireEvent.click(screen.getByLabelText("expand"));
    fireEvent.click(
      within(screen.getByTestId("punish-unclassified-convertible")).getByLabelText("expand"),
    );

    expect(screen.getByText("パニッシュカウンター版を作る")).toBeTruthy();
  });

  it("★同じ相手技に ① と ② のコンボが混ざっていたら両方に出る", () => {
    renderList(
      unclassifiedList([
        combo({ comboId: 101, hitType: "normal" }),
        combo({ comboId: 103, hitType: "drive_impact_punish_counter" }),
      ]),
    );
    fireEvent.click(screen.getByLabelText("expand"));

    expect(
      screen.getByTestId("punish-unclassified-convertible").textContent,
    ).toContain("① 反撃に転用可能なコンボ(1 件)");
    expect(
      screen.getByTestId("punish-unclassified-reusable").textContent,
    ).toContain("② 再利用可能なコンボ(1 件)");
  });

  // ★★「そもそも出さない」——ただし黙って消さず、件数を述べる。
  it("★PC 版が既にあるコンボは ① から外し、件数を述べる", () => {
    renderList(
      unclassifiedList([
        combo({ comboId: 101, hitType: "normal" }),
        combo({ comboId: 102, hitType: "normal", hasMaterializedVersion: true }),
      ]),
    );
    fireEvent.click(screen.getByLabelText("expand"));

    expect(
      screen.getByTestId("punish-unclassified-convertible").textContent,
    ).toContain("① 反撃に転用可能なコンボ(1 件)");
    expect(
      screen.getByTestId("punish-unclassified-already-materialized").textContent,
    ).toContain("1 件");
  });

  // ★★除外は「解除手段の剥奪」を意味してはならない（M31-01 レビュー 中）。
  //   本セクションは「そこにしか現れないコンボの解除手段を残す」ために在る。
  it("★① から外した行も、採用の解除はできる", () => {
    renderList(
      unclassifiedList([
        combo({ comboId: 102, hitType: "normal", hasMaterializedVersion: true }),
      ]),
    );
    fireEvent.click(screen.getByLabelText("expand"));
    const block = screen.getByTestId("punish-unclassified-already-materialized");
    fireEvent.click(within(block).getByLabelText("expand"));

    expect(within(block).getByText("確定反撃の採用を解除")).toBeTruthy();
    // ★変換導線は出さない(既に PC 版が在るため作る必要が無い)。
    expect(within(block).queryByText("パニッシュカウンター版を作る")).toBeNull();
  });

  // ★0 件のときに「0 件は出していません」と述べない(ノイズにしない)。
  it("★外したものが無ければ件数の行を出さない", () => {
    renderList(unclassifiedList([combo({ comboId: 101, hitType: "normal" })]));
    fireEvent.click(screen.getByLabelText("expand"));

    expect(screen.queryByTestId("punish-unclassified-already-materialized")).toBeNull();
  });

  // ★★見出しの総件数は着手前と同じ母集団を数える(外したぶんも含む)。
  //   ⇒ 「4 件」と言いながら中に 3 件しか無い状態を、件数の行が説明する。
  it("★節見出しの件数は unclassifiedNodes の全件である", () => {
    renderList(
      unclassifiedList([
        combo({ comboId: 101, hitType: "normal" }),
        combo({ comboId: 102, hitType: "normal", hasMaterializedVersion: true }),
        combo({ comboId: 103, hitType: "drive_impact_punish_counter" }),
      ]),
    );
    expect(screen.getByText("区分を判定できない反撃(3 件)")).toBeTruthy();
  });
});

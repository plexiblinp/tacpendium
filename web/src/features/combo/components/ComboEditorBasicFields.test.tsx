import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi } from "vitest";
import type { KeyboardEvent, ReactNode } from "react";
import React from "react";

import {
  ComboEditorBasicFields,
  blockNonNumericKeys,
  clampNumericString,
  type BasicFieldsValue,
} from "./ComboEditorBasicFields";
import {
  OKI_NO_GAUGE_LABEL,
  OKI_OPTION_SPECS,
  okiOptionTestValue,
  okiTechAndGaugeLabel,
} from "@/constants/oki";
import { HIT_TYPE_NORMAL, HIT_TYPE_VALUES } from "@/constants/combo-list";
import { POSITION_LABEL_JA, gaugeFieldLabelJa } from "../labels";
import type { CustomStateDef } from "../customStates";
import {
  ComboDraftToggleField,
  DRAFT_TOGGLE_LABEL,
} from "./ComboDraftToggleField";

// 起き攻めオプションの test-id(M16-03): combo-editor-oki-<attackType>-<techType>-<dr|nogauge>。
// ★M24-12(レビュー 中-8): 書式の正典は constants/oki.ts の okiOptionTestValue である。
//   手書きのコピーを持つと、書式を変えたときにテストだけが古い形を指す。
function okiTestId(spec: {
  attackType: string;
  techType: string;
  usesDr: boolean;
}): string {
  return `combo-editor-oki-${okiOptionTestValue(spec)}`;
}
const FIRST_OKI_TESTID = okiTestId(OKI_OPTION_SPECS[0]);

function fakeEvent(key: string) {
  return {
    key,
    preventDefault: vi.fn(),
  } as unknown as KeyboardEvent<HTMLInputElement> & { preventDefault: ReturnType<typeof vi.fn> };
}

function baseValue(): BasicFieldsValue {
  return {
    characterId: 1,
    isDraft: false,
    damage: "",
    position: "",
    startPositionMass: "",
    carryDistanceMass: "",
    starterMeaty: false, // M37-07
    opponentStance: "",
    // ★★M38-01(射程 5): 新規登録の既定は「通常」になった(HIT_TYPE_NORMAL)。
    //   ★空文字は「hit_type が NULL の既存行を読み込んだ状態」を表すようになり、
    //     それを渡したテストだけが末尾の「(未指定)」を見る。
    hitType: HIT_TYPE_NORMAL,
    opponentSize: "",
    driveAvailableAtStart: "",
    saAvailableAtStart: "",
    driveDamage: "",
    saGaugeConsumed: "",
    driveGaugeConsumed: "",
    knockdownAdvantage: "",
    memo: "",
    link: "",
    videoPath: "",
    imagePath: "",
    tagIds: [],
    customStates: {},
    okiOptions: [],
  okiVerified: false,
  };
}

const flagDef: CustomStateDef = {
  code: "denjin_charge",
  name_ja: "電刃錬気",
  type: "flag",
  value_definition: { kind: "boolean" },
};
const intDef: CustomStateDef = {
  code: "sun_crest",
  name_ja: "サンシンボル",
  type: "level",
  value_definition: { kind: "integer", min: 0, max: 4 },
};
// M16-07: 増減表示あり(方向可変・Ingrid 相当)。
const intDeltaDef: CustomStateDef = { ...intDef, show_delta: true };
const compositeDef: CustomStateDef = {
  code: "drunk_level",
  name_ja: "酔いレベル",
  type: "composite",
  value_definition: { kind: "object" },
};

/** ★QueryClientProvider の包み。onChange を観測したいケースが直接 render するため切り出した。 */
function qcWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

function renderFields(
  defs: CustomStateDef[],
  value: BasicFieldsValue = baseValue(),
  hitTypeLockedReason?: string,
) {
  const wrapper = qcWrapper();
  return render(
    <ComboEditorBasicFields
      value={value}
      customStateDefs={defs}
      onChange={vi.fn()}
      hitTypeLockedReason={hitTypeLockedReason}
    />,
    { wrapper },
  );
}

describe("ComboEditorBasicFields ヒット種別固定", () => {
  // ★★M24-12: ヒット種別は select からボタン群になった(指示書 §4.3)。
  //   ★見ているものは変えていない——「プリフィル値が選ばれたまま、変更できない」。
  it("固定理由がある場合はプリフィル値を選んだままボタンを非活性にする", () => {
    renderFields(
      [],
      { ...baseValue(), hitType: "punish_counter" },
      "確定反撃サーチからの登録では変更不可",
    );

    // プリフィル値が選ばれて見える。
    expect(
      screen
        .getByTestId("combo-editor-hit-type-punish_counter")
        .getAttribute("aria-checked"),
    ).toBe("true");
    // ★どのボタンも押せない。
    //   ★★M38-01(射程 5): 対象から "" (不問)を外した —— 選択肢から消えたためである。
    //     ⇒ 代わりに**値域 8 値の全数**を数える。「全部 disabled」の主張は強くなっている。
    for (const value of HIT_TYPE_VALUES) {
      const button = screen.getByTestId(
        `combo-editor-hit-type-${value}`,
      ) as HTMLButtonElement;
      expect(button.disabled).toBe(true);
    }
    expect(
      screen.getByText("(確定反撃サーチからの登録では変更不可)"),
    ).toBeDefined();
  });

  it("固定理由がなければ従来どおり変更できる", () => {
    renderFields([], { ...baseValue(), hitType: "normal" });
    expect(
      (screen.getByTestId("combo-editor-hit-type-counter") as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });
});

describe("blockNonNumericKeys", () => {
  it("非負欄では e/E/+/-/. を抑止する", () => {
    const guard = blockNonNumericKeys(false);
    for (const key of ["e", "E", "+", "-", "."]) {
      const ev = fakeEvent(key);
      guard(ev);
      expect(ev.preventDefault).toHaveBeenCalledTimes(1);
    }
  });

  it("非負欄でも数字・編集キーは許可する", () => {
    const guard = blockNonNumericKeys(false);
    for (const key of ["0", "5", "9", "Backspace", "ArrowLeft"]) {
      const ev = fakeEvent(key);
      guard(ev);
      expect(ev.preventDefault).not.toHaveBeenCalled();
    }
  });

  it("負値許可欄では - を通し e/E/+/. は抑止する", () => {
    const guard = blockNonNumericKeys(true);

    const minus = fakeEvent("-");
    guard(minus);
    expect(minus.preventDefault).not.toHaveBeenCalled();

    for (const key of ["e", "E", "+", "."]) {
      const ev = fakeEvent(key);
      guard(ev);
      expect(ev.preventDefault).toHaveBeenCalledTimes(1);
    }
  });

  it("負値+小数許可欄(drive_damage)では -/. を通し e/E/+ は抑止する", () => {
    const guard = blockNonNumericKeys(true, true);

    for (const key of ["-", ".", "0", "6"]) {
      const ev = fakeEvent(key);
      guard(ev);
      expect(ev.preventDefault).not.toHaveBeenCalled();
    }
    for (const key of ["e", "E", "+"]) {
      const ev = fakeEvent(key);
      guard(ev);
      expect(ev.preventDefault).toHaveBeenCalledTimes(1);
    }
  });

  it("非負+小数許可欄(drive_available・M16-01)では . を通し -/e/E/+ は抑止する", () => {
    const guard = blockNonNumericKeys(false, true);

    for (const key of [".", "0", "2", "6"]) {
      const ev = fakeEvent(key);
      guard(ev);
      expect(ev.preventDefault).not.toHaveBeenCalled();
    }
    for (const key of ["-", "e", "E", "+"]) {
      const ev = fakeEvent(key);
      guard(ev);
      expect(ev.preventDefault).toHaveBeenCalledTimes(1);
    }
  });
});

// ★★M24-12(§4.9・D-582 ＋ 2026-08-29 開発者裁定): スピナーを撤廃し、
//   0.5 刻みの不変条件を手放した。**適用は 9 欄すべて**(指示書が名指しした 4 欄より広い)。
describe("M24-12 数値欄のスピナー撤廃(§4.9)", () => {
  const GAUGE_TESTIDS = [
    "combo-editor-drive-available",
    "combo-editor-sa-available",
    "combo-editor-sa-consumed",
    "combo-editor-drive-consumed",
  ] as const;

  // ★★母数で押さえる。**「4 欄だけ直した」に戻ったらここが落ちる。**
  //   ★testid を並べるのではなく「描かれている number 欄を全部数える」形にした
  //     ——欄が増えたときに、テストを直さないと気づけない形にしないため。
  it("★★描かれている数値欄すべてからスピナーが消えている(母数で押さえる)", () => {
    const { container } = renderFields([intDef]);
    const numbers = Array.from(
      container.querySelectorAll<HTMLInputElement>('input[type="number"]'),
    );
    // 内訳: ダメージ / ドライブ始動 / SA 始動 / ドライブダメージ / SA 消費 /
    //       ドライブ消費 / 有利フレーム / キャラ固有状態 int ①② ＝ 9 欄。
    // ★★M37-01(2026-09-13 の作り替え後)は 10 である —— 既定の入力方式が
    //   始動位置＝通常入力(区分ボタン。数値欄 0)／ 運び量＝マス目(数値欄 1)であり、
    //   **方式ごとに 1 欄しか描かれない**ため。★方式を切り替えても総数は 10 のまま。
    //   ★本テストは「欄が増えたら気づく」ための母数であり、意図どおり赤くなった。
    expect(numbers).toHaveLength(10);
    const withSpinner = numbers.filter(
      (el) =>
        !el.className.includes("appearance-none") ||
        !el.className.includes("[appearance:textfield]"),
    );
    expect(
      withSpinner.map((el) => el.getAttribute("data-testid")),
    ).toEqual([]);
  });

  it("★4 欄ともスピナーを消すクラスが付いている", () => {
    renderFields([]);
    for (const id of GAUGE_TESTIDS) {
      const input = screen.getByTestId(id) as HTMLInputElement;
      expect(input.className).toContain("appearance-none");
      expect(input.className).toContain("[appearance:textfield]");
    }
  });

  // ★★`step="any"` を付けるのは「小数を打てる欄」だけである。
  //   ★整数欄へ `any` を付けると「小数を許す」と宣言することになり、意味が逆になる。
  it("★★step=\"any\" は小数を打てる 3 欄だけに付く", () => {
    const { container } = renderFields([intDef]);
    const anyStep = Array.from(
      container.querySelectorAll<HTMLInputElement>('input[type="number"][step="any"]'),
    ).map((el) => el.getAttribute("data-testid"));
    expect(anyStep.sort()).toEqual(
      [
        "combo-editor-drive-available",
        "combo-editor-drive-consumed",
        "combo-editor-drive-damage",
      ].sort(),
    );
  });

  // ★ドライブダメージも 0.5 刻みを外した(2026-08-29 開発者裁定(b))。
  //   `VAL-C13` は「-6〜6・小数許容」で刻みを見ておらず、UI だけが主張していた。
  it("★ドライブダメージで 1.3 が正しい値として扱われる(0.5 刻みを外した)", () => {
    renderFields([]);
    const input = screen.getByTestId(
      "combo-editor-drive-damage",
    ) as HTMLInputElement;
    input.value = "1.3";
    expect(input.validity.stepMismatch).toBe(false);
  });

  // ★★`step` を消していたら `0.5` すら不正になっていた(既定 1 のため)。
  //   ⇒ 「刻み無し」は属性で明示する必要がある。
  it("★★小数欄では 0.5 も 1.3 も正しい値である", () => {
    renderFields([]);
    for (const id of [
      "combo-editor-drive-available",
      "combo-editor-drive-consumed",
      "combo-editor-drive-damage",
    ]) {
      const input = screen.getByTestId(id) as HTMLInputElement;
      for (const v of ["0.5", "1.3"]) {
        input.value = v;
        expect(
          input.validity.stepMismatch,
          `${id} で ${v} が刻み違反になっている`,
        ).toBe(false);
      }
    }
  });

  // ★★`type="number"` は外さない(開発者確認 2026-08-29＝案 A)。外すと携帯の数値
  //   キーボード・min/max 属性・既存 E2E の fill() の前提がまとめて変わる。
  it("★`type=\"number\"` と min/max は残っている(案 A の要点)", () => {
    renderFields([]);
    const expected: Record<string, [string, string]> = {
      "combo-editor-drive-available": ["0", "6"],
      "combo-editor-sa-available": ["0", "3"],
      "combo-editor-sa-consumed": ["0", "6"],
      "combo-editor-drive-consumed": ["0", "20"],
    };
    for (const id of GAUGE_TESTIDS) {
      const input = screen.getByTestId(id) as HTMLInputElement;
      expect(input.type).toBe("number");
      expect([input.min, input.max]).toEqual(expected[id]);
    }
  });

  // ★★`step` を消すと既定 1 になり、開発者が許容と裁定した `1.3` が
  //   `stepMismatch`(=不正な値)になる。⇒ ドライブ 2 欄は `any` を明示する。
  //   ★SA 2 欄は整数欄なので `step` を持たせない(既定 1 が整数を守る)。
  it("★★ドライブ 2 欄は step=\"any\"、SA 2 欄は step 無し", () => {
    renderFields([]);
    for (const id of ["combo-editor-drive-available", "combo-editor-drive-consumed"]) {
      expect((screen.getByTestId(id) as HTMLInputElement).step).toBe("any");
    }
    for (const id of ["combo-editor-sa-available", "combo-editor-sa-consumed"]) {
      expect((screen.getByTestId(id) as HTMLInputElement).step).toBe("");
    }
  });

  // ★0.5 刻みが消えたことを実際の値で押さえる(属性だけでなく検証結果で見る)。
  it("★★ドライブ欄では 1.3 が正しい値として扱われる(0.5 刻みの不変条件は無い)", () => {
    renderFields([]);
    const input = screen.getByTestId(
      "combo-editor-drive-available",
    ) as HTMLInputElement;
    input.value = "1.3";
    expect(input.validity.stepMismatch).toBe(false);
  });
});

// ★★M24-04(SM-093): 「状態はデフォルトで不問であるべき」。
//   既定値を決めるのは ComboEditor 側だが、「不問として選ばれて見える」ことは
//   実物の select が要るためここで押さえる。
describe("ComboEditorBasicFields 相手の状態(M24-04 SM-093)", () => {
  // ★★M24-12: 呼び名を「どちらでも可」から「不問」へ寄せた(2026-08-28 開発者指示)。
  //   ★これは新しい命名ではない——一覧・詳細・比較・出力・フィルタ・重複警告・utils の
  //     7 面は元から constants/combo-list.ts の「不問」を表示しており、
  //     「どちらでも可」はエディタだけの呼び名だった。⇒ 割れを正典へ寄せた。
  //   ★このテストの名前は M24-04 当時から「不問(any)」と書いてあり、
  //     名前と期待値が食い違っていた。
  it("不問(any)を渡すと「不問」が選ばれて見える", () => {
    renderFields([], { ...baseValue(), opponentStance: "any" });
    const any = screen.getByTestId("combo-editor-opponent-stance-any");
    expect(any.getAttribute("aria-checked")).toBe("true");
    expect(any.textContent).toContain("不問");
    // ★★新規登録では空の選択肢を出さない(中立は any が兼ねる)。
    expect(
      screen.queryByTestId("combo-editor-opponent-stance-unspecified"),
    ).toBeNull();
  });

  // ★★空文字と "any" が別物であることの確認は落とさない。保存時に空文字は NULL、
  //   "any" は文字列 "any" として入り、重複判定キーと一覧フィルタで別の値になる
  //   (DES-006 §2.4)。⇒ 同一視しないこと。
  it("対照: 空文字のとき(M24-04 以前の旧データ)だけ「(未指定)」が出て選ばれる", () => {
    renderFields([], { ...baseValue(), opponentStance: "" });
    const legacy = screen.getByTestId(
      "combo-editor-opponent-stance-unspecified",
    );
    expect(legacy.getAttribute("aria-checked")).toBe("true");
    expect(legacy.textContent).toContain("(未指定)");
    // ★読込値は書き換えない——"any" が選ばれた状態にしてはならない。
    expect(
      screen
        .getByTestId("combo-editor-opponent-stance-any")
        .getAttribute("aria-checked"),
    ).toBe("false");
  });

  // ★★M24-12(③): 中立の選択肢が一番左であること。
  it("★「不問」が一番左にある", () => {
    renderFields([], { ...baseValue(), opponentStance: "any" });
    const group = screen.getByTestId("combo-editor-opponent-stance");
    const first = group.querySelector('[role="radio"]');
    expect(first?.getAttribute("data-testid")).toBe(
      "combo-editor-opponent-stance-any",
    );
  });
});

// ★★M24-12(③): 中立(空文字＝不問)が一番左・かつ既定である。
//
// ★★★【M38-01・射程 5】**ヒット種別を対象から外した** —— 同欄の値域
//   (`SUPP-001` §3.2)は 8 値であり「不問」を含まない。⇒ 選択肢から消し、
//   既定を「通常」にした。ヒット種別の契約は直下の describe が見る。
// ★残る 2 欄(始動位置 / 相手の大きさ)は本サブの射程外である
//   (2026-09-17 開発者裁定＝「報告のみ。触らない」)。⇒ 契約は不変。
describe("M24-12 中立の選択肢は一番左・かつ既定", () => {
  it.each([
    ["combo-editor-position", "position"],
    ["combo-editor-opponent-size", "opponentSize"],
  ])("%s の先頭は「不問」で、既定でそれが選ばれている", (testId) => {
    renderFields([]);
    const group = screen.getByTestId(testId);
    const first = group.querySelector('[role="radio"]');
    expect(first?.getAttribute("data-testid")).toBe(`${testId}-unspecified`);
    expect(first?.getAttribute("aria-checked")).toBe("true");
    expect(first?.textContent).toContain("不問");
  });
});

// ★★★【M38-01・射程 5】ヒット種別から「不問」を消し、既定を「通常」にした。
//
// ★開発者が画面で見た「1 不問」の正体は `withUnspecifiedFirst(HIT_TYPE_OPTIONS)` が
//   先頭へ足していた空文字の選択肢である(「1」は数字キーの表示)。
// ★★★既存の NULL 行を寄せるマイグレは作らない(2026-09-17 開発者裁定)。
//   ⇒ だから「読み込んだ値が空のときだけ末尾へ (未指定) を出す」分岐が要る。
//     **これが無いと、NULL の既存行を開いたとき何も選ばれていない状態になる。**

// ★★★M38-01 追補2(2026-09-18): 開始残量 2 欄は**任意**であり、**空欄＝「不問」**である。
//
// ★★★以下は失効した契約である(**元に戻さないこと**):
//   ・「開始残量 2 欄は VAL-C15 の必須である」
//   ・「不問トグル(`-any`)が在り、数値欄の Space で切り替わる」
//   ・「不問のときだけ placeholder に『不問』が出る(空のままでは出さない)」
//   ・「必須の印が先頭 4 欄に連続する」
//
// ★★★撤回の理由＝**UI が 3 状態(数値 / 不問 / 空のまま)、DB が 2 状態(値 / NULL)で
//   数が合っていなかった**。余った 1 状態が「不問」と見分けられず、開発者が実機で
//   「空欄と NULL の状態がわかりにくい」と判断した。⇒ 区別を諦めて UI を DB へ揃えた。
// ★区別を残すには列が要る(oki_verified / 旧マイグレ 000096 と同じ形)。射程外である。
describe("M38-01 開始残量は任意で、空欄が「不問」である", () => {
  // ★★★逐語=「画面上、null の場合はテキストボックス上に薄く不問と見えると良いです」。
  //   ⇒ **空なら常に出す**。空欄が 1 種類しか無いので、その意味が常に画面に在る。
  it.each([
    ["combo-editor-drive-available"],
    ["combo-editor-sa-available"],
  ])("★★★%s が空のとき placeholder に「不問」が出る", (testId) => {
    renderFields([]);
    const input = screen.getByTestId(testId) as HTMLInputElement;
    expect(input.value).toBe("");
    expect(input.placeholder).toBe("不問");
  });

  // ★★対照: 値が入っていれば placeholder は出ない(そもそも見えない欄になる)。
  it("★★値が入っていれば placeholder は出ない", () => {
    renderFields([], { ...baseValue(), driveAvailableAtStart: "3" });
    const input = screen.getByTestId(
      "combo-editor-drive-available",
    ) as HTMLInputElement;
    expect(input.value).toBe("3");
    expect(input.placeholder).toBe("");
  });

  // ★★★不問トグルが**消えている**ことの破壊確認。⇒ 残っていると 3 状態へ戻る。
  it("★★★不問トグルは存在しない", () => {
    renderFields([]);
    expect(screen.queryByTestId("combo-editor-drive-available-any")).toBeNull();
    expect(screen.queryByTestId("combo-editor-sa-available-any")).toBeNull();
  });

  // ★★Space の割当も消えている。⇒ 数値欄の Space は誰も奪わない。
  it("★★数値欄に aria-keyshortcuts も「(Space)」の案内も無い", () => {
    renderFields([]);
    for (const testId of [
      "combo-editor-drive-available",
      "combo-editor-sa-available",
    ]) {
      // ★jest-dom の matcher は本プロジェクトで読み込んでいない。⇒ 素の getAttribute で見る。
      expect(
        screen.getByTestId(testId).getAttribute("aria-keyshortcuts"),
      ).toBeNull();
    }
    expect(screen.queryAllByText("(Space)")).toHaveLength(0);
  });

  it("★Space を押しても onChange は呼ばれない(トグルが消えたため)", () => {
    const onChange = vi.fn();
    render(
      <ComboEditorBasicFields
        value={baseValue()}
        customStateDefs={[]}
        onChange={onChange}
      />,
      { wrapper: qcWrapper() },
    );
    fireEvent.keyDown(screen.getByTestId("combo-editor-drive-available"), {
      key: " ",
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  // ★★値域の担保は 1 つも外していない。⇒ 必須を外すのと値域を外すのは別である。
  //   (UI クランプ。BE 側は VAL-C04 / VAL-C05 が引き続き見る)
  it("★★上限を超える入力は UI でクランプされる(値域は生きている)", () => {
    const onChange = vi.fn();
    render(
      <ComboEditorBasicFields
        value={baseValue()}
        customStateDefs={[]}
        onChange={onChange}
      />,
      { wrapper: qcWrapper() },
    );
    fireEvent.change(screen.getByTestId("combo-editor-drive-available"), {
      target: { value: "99" },
    });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ driveAvailableAtStart: "6" }),
    );
    fireEvent.change(screen.getByTestId("combo-editor-sa-available"), {
      target: { value: "9" },
    });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ saAvailableAtStart: "3" }),
    );
  });

  // ★★Space 以外の抑止は従来どおり(既存・維持)。
  it("★数値として不正なキーは従来どおり抑止される", () => {
    renderFields([]);
    const input = screen.getByTestId("combo-editor-sa-available");
    // sa は整数・非負なので e / E / + / - / . が抑止される。
    for (const key of ["e", "E", "+", "-", "."]) {
      expect(fireEvent.keyDown(input, { key })).toBe(false);
    }
    expect(fireEvent.keyDown(input, { key: "1" })).toBe(true);
  });

  // ★★★入力欄を disabled / readOnly にしないこと(順送りの着地点であるため)。
  it("★★★入力欄は disabled / readOnly にしない", () => {
    renderFields([]);
    for (const testId of [
      "combo-editor-drive-available",
      "combo-editor-sa-available",
    ]) {
      const input = screen.getByTestId(testId) as HTMLInputElement;
      expect(input.disabled).toBe(false);
      expect(input.readOnly).toBe(false);
    }
  });
});

// ★★★M38-01(射程 2 / 追補2): 必須欄が基本情報の**先頭に連続して**並んでいること。
//
// ★★開発者の要望は「必須項目を基本情報の上の方へまとめる」であり、
//   上に在ることが「必須である」の手掛かりになる(指示書 §2.3)。
//
// ★★★追補2(2026-09-18)で**必須は先頭 2 欄になった**。⇒ 3・4 番目(開始残量)は任意である。
//   ★開発者裁定＝「位置は維持する」。⇒ 欄の並びは動かさず、必須の印だけが 2 つに減った。
//   ★★★**その結果「上にあるものが必須」という手掛かりは成立しなくなった**
//     (指示書 §2.3-3 の落とせない条件を、開発者の判断で緩めた)。
//     ⇒ 手掛かりは節の凡例「この節では、印の無い欄は任意です。」だけが担う。
// ★★並びは DOM 順で見る。⇒ CSS で見た目だけ動かしても検出できないが、
//   本節は 1 カラム縦積みであり DOM 順がそのまま画面の順である(M24-12)。
describe("M38-01 必須項目が基本情報の上にまとまっている", () => {
  function basicSection(container: HTMLElement): HTMLElement {
    return container.querySelector<HTMLElement>(
      '[data-testid="combo-editor-basic-section"]',
    )!;
  }

  /** 各**欄**のラベル要素を DOM 順に返す。 */
  function fieldLabels(container: HTMLElement): HTMLElement[] {
    return [...basicSection(container).querySelectorAll<HTMLElement>("label")].filter(
      (l) => l.querySelector('[role="switch"]') === null,
    );
  }

  it("★★先頭 4 欄はこの順で並んでいる(位置は追補2 でも動かしていない)", () => {
    const { container } = renderFields([]);
    const labels = fieldLabels(container).map((l) => l.textContent ?? "");
    expect(labels[0]).toContain("ダメージ");
    expect(labels[1]).toContain("有利フレーム");
    expect(labels[2]).toContain(gaugeFieldLabelJa("start", "drive"));
    expect(labels[3]).toContain(gaugeFieldLabelJa("start", "sa"));
  });

  // ★★★必須の印は上から **2 つ**連続で出て、その後は 1 つも出ない。
  //   ★以下は失効した主張:「4 つ連続し、それ以降には 1 つも無い」。
  //     ⇒ 開始残量 2 欄が必須から外れたためである(追補2)。
  it("★★★必須の印が先頭に 2 つ連続し、それ以降には 1 つも無い", () => {
    const { container } = renderFields([]);
    const marks = fieldLabels(container).map((l) =>
      l.querySelector('[data-testid^="field-requirement-"]') ? 1 : 0,
    );
    expect(marks.slice(0, 2)).toEqual([1, 1]);
    expect(marks.slice(2).every((m) => m === 0)).toBe(true);
  });
});

// ★★★M38-01(射程 3 / 追補2): 必須の印が付く欄。**現在は 2 欄だけである。**
describe("M38-01 必須の印は 2 欄だけ", () => {
  it("★★ダメージと有利フレームに必須の印が出る", () => {
    renderFields([]);
    expect(screen.getByTestId("field-requirement-damage")).toBeDefined();
    expect(screen.getByTestId("field-requirement-knockdownAdvantage")).toBeDefined();
  });

  // ★★★追補2 の証跡: 開始残量 2 欄から印が**消えた**。
  //   ★以下は失効した主張:「開始残量 2 欄に必須の印が出る」。
  it("★★★開始残量 2 欄には必須の印が出ない(追補2 で必須から外れた)", () => {
    renderFields([]);
    expect(screen.queryByTestId("field-requirement-driveAvailableAtStart")).toBeNull();
    expect(screen.queryByTestId("field-requirement-saAvailableAtStart")).toBeNull();
  });

  // ★★対照: 消費ゲージ 2 欄にも印は無い(M38-01 本体で外れたまま)。
  it("★★消費ゲージ 2 欄にも必須の印は無い", () => {
    renderFields([]);
    expect(screen.queryByTestId("field-requirement-driveGaugeConsumed")).toBeNull();
    expect(screen.queryByTestId("field-requirement-saGaugeConsumed")).toBeNull();
  });

  // ★仮登録では必須が掛からないので印も出さない(既存の規則・不変)。
  it("仮登録ではダメージにも印を出さない", () => {
    renderFields([], { ...baseValue(), isDraft: true });
    expect(screen.queryByTestId("field-requirement-damage")).toBeNull();
  });
});

describe("M38-01 ヒット種別の選択肢と既定", () => {
  it("★★新規では選択肢に「不問」が無い", () => {
    renderFields([]);
    const group = screen.getByTestId("combo-editor-hit-type");
    expect(
      group.querySelector('[data-testid="combo-editor-hit-type-unspecified"]'),
    ).toBeNull();
    expect(group.textContent).not.toContain("不問");
  });

  it("★★選択肢は値域の 8 値ちょうどである(値域を動かしていない)", () => {
    renderFields([]);
    const group = screen.getByTestId("combo-editor-hit-type");
    expect(group.querySelectorAll('[role="radio"]')).toHaveLength(
      HIT_TYPE_VALUES.length,
    );
  });

  it("★既定は「通常」であり、先頭に在る(数字キー 1)", () => {
    renderFields([]);
    const group = screen.getByTestId("combo-editor-hit-type");
    const first = group.querySelector('[role="radio"]');
    expect(first?.getAttribute("data-testid")).toBe(
      "combo-editor-hit-type-normal",
    );
    expect(first?.getAttribute("aria-checked")).toBe("true");
  });

  // ★★破壊確認: `hitTypeOptionsFor` の空文字分岐を落とすと、この 2 本が赤くなる。
  it("★★★hit_type が NULL の既存行を開くと、末尾に「(未指定)」が出て選ばれている", () => {
    renderFields([], { ...baseValue(), hitType: "" });
    const group = screen.getByTestId("combo-editor-hit-type");
    const radios = group.querySelectorAll('[role="radio"]');
    expect(radios).toHaveLength(HIT_TYPE_VALUES.length + 1);
    const last = radios[radios.length - 1];
    expect(last.getAttribute("data-testid")).toBe(
      "combo-editor-hit-type-unspecified",
    );
    expect(last.getAttribute("aria-checked")).toBe("true");
    // ★呼び名は「不問」ではない —— 値域に無い値を「不問」と呼ぶと、消したはずの
    //   選択肢が戻ったように見える。
    expect(last.textContent).toContain("(未指定)");
    expect(last.textContent).not.toContain("不問");
  });

  it("★値の入っている既存行では「(未指定)」を出さない", () => {
    renderFields([], { ...baseValue(), hitType: "counter" });
    const group = screen.getByTestId("combo-editor-hit-type");
    expect(group.querySelectorAll('[role="radio"]')).toHaveLength(
      HIT_TYPE_VALUES.length,
    );
    expect(
      group.querySelector('[data-testid="combo-editor-hit-type-unspecified"]'),
    ).toBeNull();
  });
});

// ★★M27-01: 相手の大きさの注意書き(InfoMark)。
//
// 見るのは 3 点である。
//   (1) ⓘ が「相手の大きさ」の欄に在り、クリックで説明が開くこと
//   (2) ★★ⓘ がボタン群より **DOM 上で後ろ** に在ること
//       —— useFieldSequence の focusableIn は querySelector(単数)で
//          [data-seq-stop] 内の最初の focusable を拾う。ⓘ が前に在ると
//          順送りで欄に来たときフォーカスが ⓘ に載り、群にフォーカスが無くなる。
//          結果 OptionButtonGroup の onKeyDown が発火せず **数字キーが効かなくなる**。
//   (3) 4 区分すべてがボタンとして出ていること
//
// ★破壊確認: InfoMark を hint ではなく Field の children 先頭へ移すと (2) が赤くなる。
describe("M27-01 相手の大きさの注意書き(InfoMark)", () => {
  it("ⓘ が在り、クリックすると『タグかメモ』の案内が出る", async () => {
    renderFields([]);
    const trigger = screen.getByTestId("info-mark-opponent-size");
    expect(trigger).toBeTruthy();
    expect(screen.queryByTestId("info-mark-opponent-size-content")).toBeNull();

    fireEvent.click(trigger);
    await waitFor(() => {
      const content = screen.getByTestId("info-mark-opponent-size-content");
      expect(content.textContent).toContain("タグかメモ");
    });
  });

  it("★ⓘ はボタン群より DOM 上で後ろに在る(数字キーを奪わない)", () => {
    renderFields([]);
    const group = screen.getByTestId("combo-editor-opponent-size");
    const trigger = screen.getByTestId("info-mark-opponent-size");
    // 同じ [data-seq-stop] の中で、群 → ⓘ の順であること。
    const stop = group.closest("[data-seq-stop]");
    expect(stop).toBeTruthy();
    expect(stop!.contains(trigger)).toBe(true);
    const pos = group.compareDocumentPosition(trigger);
    // Node.DOCUMENT_POSITION_FOLLOWING === 4
    expect(pos & 4).toBeTruthy();

    // ★focusableIn と同じセレクタで最初の focusable を引くと、ⓘ ではなく
    //   ボタン群の中のボタンが取れること(順送りが群へ入る)。
    const first = stop!.querySelector<HTMLElement>(
      'input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]):not([tabindex="-1"]), [tabindex="0"]',
    );
    expect(first).toBeTruthy();
    expect(group.contains(first!)).toBe(true);
    expect(first).not.toBe(trigger);
  });

  it("4 区分がすべてボタンとして出る(標準 / 大 / 大1 / 大2)", () => {
    renderFields([]);
    const group = screen.getByTestId("combo-editor-opponent-size");
    for (const [value, label] of [
      ["standard", "標準"],
      ["large", "大"],
      ["large1", "大1(ザンギエフ等)"],
      ["large2", "大2(マリーザ等)"],
    ]) {
      const btn = screen.getByTestId(`combo-editor-opponent-size-${value}`);
      expect(btn.textContent).toContain(label);
    }
    // 不問 ＋ 4 区分 = 5 ボタン(上限 10 の内側なのでボタン群のまま)。
    expect(group.querySelectorAll('[role="radio"]').length).toBe(5);
  });
});

describe("ComboEditorBasicFields ゲージ消費(M16-02)", () => {
  it("sa-consumed 入力は整数(min=0・max=6)で始動と別項目", () => {
    renderFields([]);
    const input = screen.getByTestId(
      "combo-editor-sa-consumed",
    ) as HTMLInputElement;
    expect(input.type).toBe("number");
    expect(input.min).toBe("0");
    expect(input.max).toBe("6");
  });

  // M24-04(SM-007 / SM-101): 4 通りのラベルは gaugeFieldLabelJa() が正典。
  // ★上限をラベルに書くのは根拠が説明できるときだけ(ドライブ消費の 20 は書かない)。
  //   ★実際の上限 20 は上のテストが input.max で押さえている(ラベルと上限は別物)。
  it("消費欄はラベルで「消費」を明示し始動残量と判別できる", () => {
    renderFields([]);
    expect(screen.getByText("SAゲージ消費(0〜6本)")).toBeTruthy();
    // ★★M24-12(D-582): 注記が空になったので括弧ごと出ない。
    expect(screen.getByText("ドライブゲージ消費")).toBeTruthy();
    // M16-06(A-3): 始動残量ラベルは正典「コンボ開始時の◯◯ゲージ残量」へ統一(消費と判別可能)。
    // ★★M29-01(3-A): SA 始動側にも「本」が付いた(始動と消費で単位が割れない)。
    expect(screen.getByText("コンボ開始時のSAゲージ残量(0〜3本)")).toBeTruthy();
    // ★★M24-12(D-582): 「0.5刻み」→「6.0」で小数を示す。
    expect(
      screen.getByText("コンボ開始時のドライブゲージ残量(0〜6.0本)"),
    ).toBeTruthy();
  });

  // ★描かれているラベルが正典の出力そのものであることを固定する。
  //   直書きへ戻したら(あるいは正典を変えたら)ここが落ちる。
  it("4 通りのラベルはすべて gaugeFieldLabelJa() の出力である", () => {
    renderFields([]);
    for (const side of ["start", "consumed"] as const) {
      for (const kind of ["drive", "sa"] as const) {
        expect(screen.getByText(gaugeFieldLabelJa(side, kind))).toBeTruthy();
      }
    }
  });
});

describe("ComboEditorBasicFields 始動入力欄クランプ(F-1(a)・M16-06)", () => {
  it("drive 始動欄は上限超過値を max(6)へクランプして onChange する", () => {
    const onChange = vi.fn();
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);
    render(
      <ComboEditorBasicFields
        value={baseValue()}
        customStateDefs={[]}
        onChange={onChange}
      />,
      { wrapper },
    );
    fireEvent.change(screen.getByTestId("combo-editor-drive-available"), {
      target: { value: "9" },
    });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ driveAvailableAtStart: "6" }),
    );
  });

  it("SA 始動欄は上限超過値を max(3)へクランプして onChange する", () => {
    const onChange = vi.fn();
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);
    render(
      <ComboEditorBasicFields
        value={baseValue()}
        customStateDefs={[]}
        onChange={onChange}
      />,
      { wrapper },
    );
    fireEvent.change(screen.getByTestId("combo-editor-sa-available"), {
      target: { value: "5" },
    });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ saAvailableAtStart: "3" }),
    );
  });
});

describe("clampNumericString(消費 UI 上限クランプ・M16-02 追補 v1.0.2)", () => {
  it("上限超は max に丸める(SA=7→6 / drive=25→20)", () => {
    expect(clampNumericString("7", 0, 6)).toBe("6");
    expect(clampNumericString("25", 0, 20)).toBe("20");
    expect(clampNumericString("20.5", 0, 20)).toBe("20");
  });

  it("下限未満は min に丸める(負値→0)", () => {
    expect(clampNumericString("-3", 0, 6)).toBe("0");
  });

  it("範囲内はタイプ表記をそのまま保持(小数途中入力を壊さない)", () => {
    expect(clampNumericString("3", 0, 6)).toBe("3");
    expect(clampNumericString("1.5", 0, 20)).toBe("1.5");
    expect(clampNumericString("1.", 0, 20)).toBe("1."); // 小数タイプ途中
    expect(clampNumericString(".5", 0, 20)).toBe(".5");
  });

  it("空文字はクリアとして保持する(0 に化けない)", () => {
    expect(clampNumericString("", 0, 6)).toBe("");
  });
});

describe("ComboEditorBasicFields 消費欄の onChange クランプ(F-1(a))", () => {
  const renderWithSpy = (value = baseValue()) => {
    const onChange = vi.fn();
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);
    render(
      <ComboEditorBasicFields
        value={value}
        customStateDefs={[]}
        onChange={onChange}
      />,
      { wrapper },
    );
    return onChange;
  };

  it("SA 消費に 7 を入力すると 6 にクランプして onChange される", () => {
    const onChange = renderWithSpy();
    fireEvent.change(screen.getByTestId("combo-editor-sa-consumed"), {
      target: { value: "7" },
    });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ saGaugeConsumed: "6" }),
    );
  });

  it("drive 消費に 25 を入力すると 20 にクランプして onChange される", () => {
    const onChange = renderWithSpy();
    fireEvent.change(screen.getByTestId("combo-editor-drive-consumed"), {
      target: { value: "25" },
    });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ driveGaugeConsumed: "20" }),
    );
  });
});

describe("ComboEditorBasicFields キャラ固有状態(custom_states)", () => {
  // ★★M24-12(§4.12・D-583): Switch からボタン群へ。
  //   ★`DES-005` §5.7 項目6 の「type=flag はトグル＝Switch 表記」を撤回した。
  //   ★M15-05 追補の「Checkbox → shadcn Switch」はここで役目を終えている。
  it("★(5) flag 状態はボタン群(はい / いいえ)で描画する", () => {
    renderFields([flagDef]);
    expect(screen.getByText("キャラ固有状態")).toBeDefined();
    expect(screen.getByText("電刃錬気")).toBeDefined();
    const group = screen.getByTestId("combo-editor-custom-state-denjin_charge");
    expect(group.getAttribute("role")).toBe("radiogroup");
    // ★Switch へ戻っていないこと(撤回した形が復活したら落ちる)。
    expect(group.querySelector('[role="switch"]')).toBeNull();
  });

  it("(6) M16-07: int 状態は ①② の 2 欄で描画し min/max・明示ラベルを反映する", () => {
    renderFields([intDef]);
    const start = screen.getByTestId(
      "combo-editor-custom-state-sun_crest-start",
    ) as HTMLInputElement;
    const end = screen.getByTestId(
      "combo-editor-custom-state-sun_crest-end",
    ) as HTMLInputElement;
    for (const input of [start, end]) {
      expect(input.type).toBe("number");
      expect(input.min).toBe("0");
      expect(input.max).toBe("4");
    }
    // ①② の明示ラベル(名称 + 固定句 + 範囲ヒント)
    expect(
      screen.getByText("サンシンボル：始動時に必要な最低のストック数(0〜4)"),
    ).toBeDefined();
    expect(screen.getByText("サンシンボル：終了時のストック数(0〜4)")).toBeDefined();
  });

  it("(6b) M16-07: show_delta=true は ③増減を calc 表示、false は非表示", () => {
    const v = baseValue();
    v.customStates = { sun_crest: { start_min: 1, end: 3 } };
    const { unmount } = renderFields([intDeltaDef], v);
    const delta = screen.getByTestId("combo-editor-custom-state-sun_crest-delta");
    expect(delta.textContent).toContain("サンシンボル：ストック増減");
    expect(delta.textContent).toContain("+2");
    unmount();
    // show_delta なし(intDef)では ③ を出さない
    renderFields([intDef], v);
    expect(
      screen.queryByTestId("combo-editor-custom-state-sun_crest-delta"),
    ).toBeNull();
  });

  it("(6c) M16-07: ① 欄の入力が構造化 {start_min,end} で onChange に乗る", () => {
    const onChange = vi.fn();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);
    const v = baseValue();
    v.customStates = { sun_crest: { end: 3 } };
    render(
      <ComboEditorBasicFields
        value={v}
        customStateDefs={[intDef]}
        onChange={onChange}
      />,
      { wrapper },
    );
    fireEvent.change(screen.getByTestId("combo-editor-custom-state-sun_crest-start"), {
      target: { value: "2" },
    });
    expect(onChange).toHaveBeenCalled();
    const next = onChange.mock.calls[0][0] as BasicFieldsValue;
    expect(next.customStates.sun_crest).toEqual({ end: 3, start_min: 2 });
  });

  it("(8) 状態を持たないキャラ(定義空)ではセクションを表示しない", () => {
    renderFields([]);
    expect(screen.queryByText("キャラ固有状態")).toBeNull();
  });

  it("(9) 未対応 type(composite)はスキップし、他に対応状態が無ければ非表示", () => {
    renderFields([compositeDef]);
    expect(screen.queryByText("キャラ固有状態")).toBeNull();
    expect(screen.queryByText("酔いレベル")).toBeNull();
  });

  it("M16-07: 付与済み flag は checked、int は ①② の値を表示する", () => {
    const v = baseValue();
    v.customStates = { denjin_charge: true, sun_crest: { start_min: 1, end: 3 } };
    renderFields([flagDef, intDef], v);
    // ★★M24-12(§4.12): ボタン群になったので「はい」が選ばれて見えること。
    expect(
      screen
        .getByTestId("combo-editor-custom-state-denjin_charge-yes")
        .getAttribute("aria-checked"),
    ).toBe("true");
    const start = screen.getByTestId(
      "combo-editor-custom-state-sun_crest-start",
    ) as HTMLInputElement;
    const end = screen.getByTestId(
      "combo-editor-custom-state-sun_crest-end",
    ) as HTMLInputElement;
    expect(start.value).toBe("1");
    expect(end.value).toBe("3");
  });

  it("M16-07 移行: 旧スカラ付与値は ②(end) 欄に表示し ① は空(既定)", () => {
    const v = baseValue();
    v.customStates = { sun_crest: 3 };
    renderFields([intDef], v);
    const start = screen.getByTestId(
      "combo-editor-custom-state-sun_crest-start",
    ) as HTMLInputElement;
    const end = screen.getByTestId(
      "combo-editor-custom-state-sun_crest-end",
    ) as HTMLInputElement;
    expect(start.value).toBe("");
    expect(end.value).toBe("3");
  });
});

describe("ComboEditorBasicFields 全項目温存(M15-05/FB① 削除なし回帰)", () => {
  it("レイアウト再構成後も基本フィールドと各節が全て存在する", () => {
    renderFields([]);
    // 基本情報の各入力(項目削除がないことのガード)
    for (const testId of [
      "combo-editor-damage",
      "combo-editor-position",
      "combo-editor-opponent-stance",
      "combo-editor-hit-type",
      "combo-editor-opponent-size",
      "combo-editor-drive-available",
      "combo-editor-sa-available",
      "combo-editor-drive-damage",
      "combo-editor-sa-consumed",
      "combo-editor-drive-consumed",
      "combo-editor-knockdown-advantage",
      "combo-editor-memo",
    ]) {
      expect(screen.getByTestId(testId)).toBeTruthy();
    }
    // 起き攻め 12 変種(M16-03 正規化: attack_type × tech_type × uses_dr)
    for (const spec of OKI_OPTION_SPECS) {
      expect(screen.getByTestId(okiTestId(spec))).toBeTruthy();
    }
    // 各節(基本情報/起き攻め/その他情報)。マイコンボ・タグは「その他情報」に統合。
    //
    // ★★★M38-01 追補2(2026-09-18): 「始動技」の読み取り専用表示を**削除した**。
    //   ⇒ `expect(screen.getByText("始動技")).toBeTruthy()` は失効した主張である。
    //   ★開発者の逐語＝「レシピの方で見れるのでわざわざ基本情報タブで見る必要がない」。
    //   ★★保存される値は 1 バイトも変わっていない —— 始動技の自動推定
    //     (`effectiveStarterMoveId`)は `ComboEditor` に残っており、重複判定キーの
    //     `starter_move_id` を作り続ける。消えたのは**表示だけ**である。
    expect(screen.queryByText("始動技")).toBeNull();
    expect(screen.getByTestId("combo-editor-basic-section")).toBeTruthy();
    expect(screen.getByTestId("combo-editor-oki-section")).toBeTruthy();
    expect(screen.getByTestId("combo-editor-other-section")).toBeTruthy();
  });
});

describe("ComboEditorBasicFields 起き攻めオプション(M16-03 正規化)", () => {
  it("新変種(シミー×ドライブラッシュ・打撃重ね)のチェックで onChange に okiOptions が乗る", () => {
    const onChange = vi.fn();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);
    render(
      <ComboEditorBasicFields
        value={baseValue()}
        customStateDefs={[]}
        onChange={onChange}
      />,
      { wrapper },
    );

    // シミーの後ろ受け身×ドライブラッシュ(旧構造には無かった変種)を選択。
    fireEvent.click(
      screen.getByTestId("combo-editor-oki-shimmy-back_tech-dr"),
    );
    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as BasicFieldsValue;
    // ★M27-02b: 「成立する」側を押したので available=true。
    expect(next.okiOptions).toEqual([
      { attackType: "shimmy", techType: "back_tech", usesDr: true },
    ]);
  });

  // =========================================================================
  // ★★M31-01(SD-006): ノーゲージ版 → ドライブラッシュ版への自動連動
  //
  // ★★3 つの挙動を **別々の it** で固定する。1 本にまとめると、どれが落ちたか
  //   分からなくなる(指示書 §5-3 / チェックリスト 3-1)。
  // ★判定式を書き写すのではなく、入力と出力で主張する(チェックリスト 6-3)。
  // =========================================================================

  it("★SD-006 (a) ノーゲージ版を付けると、同じ対のドライブラッシュ版にも付く", () => {
    const onChange = vi.fn();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);
    render(
      <ComboEditorBasicFields
        value={baseValue()}
        customStateDefs={[]}
        onChange={onChange}
      />,
      { wrapper },
    );

    fireEvent.click(
      screen.getByTestId("combo-editor-oki-throw_meaty-neutral_tech-nogauge"),
    );

    const next = onChange.mock.calls[0][0] as BasicFieldsValue;
    expect(next.okiOptions).toEqual(
      expect.arrayContaining([
        { attackType: "throw_meaty", techType: "neutral_tech", usesDr: false },
        { attackType: "throw_meaty", techType: "neutral_tech", usesDr: true },
      ]),
    );
    // ★対の 2 件だけ。他の攻撃種別・受け身種別へは波及しない。
    expect(next.okiOptions).toHaveLength(2);
  });

  it("★SD-006 (b) 逆向きは連動しない(ドライブラッシュ版を付けてもノーゲージ版は付かない)", () => {
    const onChange = vi.fn();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);
    render(
      <ComboEditorBasicFields
        value={baseValue()}
        customStateDefs={[]}
        onChange={onChange}
      />,
      { wrapper },
    );

    fireEvent.click(
      screen.getByTestId("combo-editor-oki-throw_meaty-neutral_tech-dr"),
    );

    const next = onChange.mock.calls[0][0] as BasicFieldsValue;
    expect(next.okiOptions).toEqual([
      { attackType: "throw_meaty", techType: "neutral_tech", usesDr: true },
    ]);
  });

  it("★SD-006 (c) 自動で付いたドライブラッシュ版は、利用者が外せる", () => {
    const onChange = vi.fn();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);
    // ★(a) の結果と同じ状態から始める(対の 2 件が付いている)。
    const value: BasicFieldsValue = {
      ...baseValue(),
      okiOptions: [
        { attackType: "throw_meaty", techType: "neutral_tech", usesDr: false },
        { attackType: "throw_meaty", techType: "neutral_tech", usesDr: true },
      ],
    };
    render(
      <ComboEditorBasicFields
        value={value}
        customStateDefs={[]}
        onChange={onChange}
      />,
      { wrapper },
    );

    fireEvent.click(
      screen.getByTestId("combo-editor-oki-throw_meaty-neutral_tech-dr"),
    );

    const next = onChange.mock.calls[0][0] as BasicFieldsValue;
    // ★外した 1 件だけが落ちる。ノーゲージ版は残る(外す操作は連動しない)。
    expect(next.okiOptions).toEqual([
      { attackType: "throw_meaty", techType: "neutral_tech", usesDr: false },
    ]);
  });

  it("★SD-006 ドライブラッシュ版が既に付いている対にノーゲージ版を足しても重複しない", () => {
    const onChange = vi.fn();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);
    const value: BasicFieldsValue = {
      ...baseValue(),
      okiOptions: [
        { attackType: "throw_meaty", techType: "neutral_tech", usesDr: true },
      ],
    };
    render(
      <ComboEditorBasicFields
        value={value}
        customStateDefs={[]}
        onChange={onChange}
      />,
      { wrapper },
    );

    fireEvent.click(
      screen.getByTestId("combo-editor-oki-throw_meaty-neutral_tech-nogauge"),
    );

    const next = onChange.mock.calls[0][0] as BasicFieldsValue;
    expect(next.okiOptions).toHaveLength(2);
  });

  it("画面ラベルは「ドライブラッシュ」正式名称で「DR」略記を使わない", () => {
    renderFields([]);
    const section = screen.getByTestId("combo-editor-oki-section");
    expect(section.textContent).toContain("ドライブラッシュ");
    expect(section.textContent).not.toContain("DR");
    // 打撃重ね(新規 attack_type)の見出しも存在。
    expect(section.textContent).toContain("打撃重ね");
  });

  // ★★M24-12(②): 複数選べることが画面から分かる(2026-08-28 開発者指示)。
  it("★「複数選択可」のヒントが節に 1 回だけ出る", () => {
    renderFields([]);
    const section = screen.getByTestId("combo-editor-oki-section");
    const hits = section.textContent?.match(/複数選択可/g) ?? [];
    expect(hits).toHaveLength(1);
  });

  // ★★M24-12(①): 受け身種別ごとに行を分ける(2026-08-28 開発者指示)。
  //   ★攻撃種別ごとに 2 列で並べると、1 行目＝その場受け身の 2 つ、
  //     2 行目＝後ろ受け身の 2 つになる(OKI_OPTION_SPECS の生成順による)。
  // ★★M24-12(①): 受け身種別ごとに行を分ける(2026-08-28 開発者指示)。
  //   ★攻撃種別ごとに 2 列で並べると、1 行目＝その場受け身の 2 つ、
  //     2 行目＝後ろ受け身の 2 つになる(OKI_OPTION_SPECS の生成順による)。
  it("★攻撃種別ごとに 3 群あり、各群は 2 列(＝受け身種別ごとの 2 行)である", () => {
    renderFields([]);
    const groups = screen
      .getByTestId("combo-editor-oki-section")
      .querySelectorAll('[role="group"]');
    expect(groups).toHaveLength(3);
    for (const group of Array.from(groups)) {
      expect(group.querySelectorAll('[role="checkbox"]')).toHaveLength(4);
      expect((group as HTMLElement).style.gridTemplateColumns).toContain(
        "repeat(2,",
      );
    }
  });

  // ★★M27-02b(P4M-011): 「起き攻めを一度でも調べたか」のフラグ。
  //
  // ★★これが本サブの中心である——チェックが 1 つも無いとき、「まだ調べていない」のか
  //   「調べたが成立するものが無かった」のかを決めるのはこの 1 個だけである。
  it("★チェックに触れると「調べた」が自動で就く(付けるとき)", () => {
    const onChange = vi.fn();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);
    render(
      <ComboEditorBasicFields
        value={baseValue()}
        customStateDefs={[]}
        onChange={onChange}
      />,
      { wrapper },
    );

    fireEvent.click(screen.getByTestId("combo-editor-oki-shimmy-back_tech-dr"));
    const next = onChange.mock.calls[0][0] as BasicFieldsValue;
    expect(next.okiVerified).toBe(true);
  });

  // ★★外すときも就く——どちらの操作も「起き攻めを見た」ことの証拠だからである。
  it("★チェックを外すときも「調べた」が就く", () => {
    const onChange = vi.fn();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);
    render(
      <ComboEditorBasicFields
        value={{
          ...baseValue(),
          okiVerified: false,
          okiOptions: [
            { attackType: "shimmy", techType: "back_tech", usesDr: true },
          ],
        }}
        customStateDefs={[]}
        onChange={onChange}
      />,
      { wrapper },
    );

    fireEvent.click(screen.getByTestId("combo-editor-oki-shimmy-back_tech-dr"));
    const next = onChange.mock.calls[0][0] as BasicFieldsValue;
    expect(next.okiOptions).toEqual([]);
    expect(next.okiVerified).toBe(true);
  });

  it("★トグルを直接押しても付け外しできる(チェック 0 件のときは確認を出さない)", () => {
    const onChange = vi.fn();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);
    render(
      <ComboEditorBasicFields
        value={{ ...baseValue(), okiVerified: true, okiOptions: [] }}
        customStateDefs={[]}
        onChange={onChange}
      />,
      { wrapper },
    );

    fireEvent.click(screen.getByTestId("combo-editor-oki-verified"));
    expect(screen.queryByTestId("combo-editor-oki-verified-confirm")).toBeNull();
    const next = onChange.mock.calls[0][0] as BasicFieldsValue;
    expect(next.okiVerified).toBe(false);
  });

  // ★★開発者の要求そのもの——「チェックが付いている状態で解除するのは操作ミス」。
  it("★★チェックが付いた状態で解除しようとすると、確認を挟む", async () => {
    const onChange = vi.fn();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);
    render(
      <ComboEditorBasicFields
        value={{
          ...baseValue(),
          okiVerified: true,
          okiOptions: [
            { attackType: "shimmy", techType: "back_tech", usesDr: true },
          ],
        }}
        customStateDefs={[]}
        onChange={onChange}
      />,
      { wrapper },
    );

    fireEvent.click(screen.getByTestId("combo-editor-oki-verified"));

    // ★★確認が出るまでは値が変わらない。**押しただけでは外れない**のが要点である。
    expect(onChange).not.toHaveBeenCalled();
    expect(
      await screen.findByTestId("combo-editor-oki-verified-confirm"),
    ).toBeTruthy();

    fireEvent.click(screen.getByTestId("combo-editor-oki-verified-confirm-ok"));
    const next = onChange.mock.calls[0][0] as BasicFieldsValue;
    expect(next.okiVerified).toBe(false);
    // ★チェックは残る(解除は「調べた」だけを外す)。
    expect(next.okiOptions).toHaveLength(1);
  });

  // ★★M24-12: マウスに持ち替えずキーボードだけで入力できる(2026-08-28 開発者要望)。
  //   ★12 個を平らに並べると数字キー(10 個)に収まらないが、攻撃種別ごとに
  //     「4 個 × 3 群」へ割れば収まる。⇒ 各群で 1〜4 が効く。
  it("★★数字キーで起き攻めをトグルできる(群ごとに 1〜4)", () => {
    const onChange = vi.fn();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);
    render(
      <ComboEditorBasicFields
        value={baseValue()}
        customStateDefs={[]}
        onChange={onChange}
      />,
      { wrapper },
    );

    // シミーの群で「2」＝その場受け身・ドライブラッシュ。
    const groups = screen
      .getByTestId("combo-editor-oki-section")
      .querySelectorAll('[role="group"]');
    fireEvent.keyDown(groups[1], { key: "2" });

    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as BasicFieldsValue;
    expect(next.okiOptions).toEqual([
      { attackType: "shimmy", techType: "neutral_tech", usesDr: true },
    ]);
  });

  // ★複数選択なので数字では次へ進まない。5 以降は割り当てが無い。
  it("★群にない数字キー(5 以降)は何もしない", () => {
    const onChange = vi.fn();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);
    render(
      <ComboEditorBasicFields
        value={baseValue()}
        customStateDefs={[]}
        onChange={onChange}
      />,
      { wrapper },
    );
    const groups = screen
      .getByTestId("combo-editor-oki-section")
      .querySelectorAll('[role="group"]');
    fireEvent.keyDown(groups[0], { key: "5" });
    expect(onChange).not.toHaveBeenCalled();
  });

  // ★★M24-03 レビュー 高-2 の再発防止。
  //   本画面は attack_type ごとにグルーピングするため okiOptionLabel をそのまま呼べず、
  //   以前は受け身種別とゲージ区分をインラインで組み立てていた。その結果 SM-097 で
  //   okiOptionLabel 側だけに「ノーゲージ」が付き、入力面と読む面で表記が割れた。
  //   ⇒ ここが constants/oki.ts の正典を通っていることを機械で固定する。
  it("★起き攻めのラベルは constants/oki.ts の正典(okiTechAndGaugeLabel)を通る", () => {
    renderFields([]);
    const section = screen.getByTestId("combo-editor-oki-section");
    for (const spec of OKI_OPTION_SPECS) {
      expect(
        section.textContent,
        `${JSON.stringify(spec)} のラベルが正典と一致しない(インライン組み立てに戻っていないか)`,
      ).toContain(okiTechAndGaugeLabel(spec));
    }
  });

  it("★ノーゲージ版も入力面でゲージ区分を名乗る(読む面と表記が割れない)", () => {
    renderFields([]);
    const section = screen.getByTestId("combo-editor-oki-section");
    expect(section.textContent).toContain(OKI_NO_GAUGE_LABEL);
  });
});

describe("ComboEditorBasicFields 折りたたみ節(M15-05/FB①)", () => {
  it("基本情報/起き攻め/その他情報は初期状態で展開している", () => {
    renderFields([]);
    // 各節が折りたたみ節(section)として存在
    expect(screen.getByTestId("combo-editor-basic-section")).toBeTruthy();
    expect(screen.getByTestId("combo-editor-oki-section")).toBeTruthy();
    expect(screen.getByTestId("combo-editor-other-section")).toBeTruthy();
    // 初期展開(全展開): 起き攻めの中身(チェックボックス)・メモが見えている
    expect(
      screen.getByTestId(FIRST_OKI_TESTID),
    ).toBeTruthy();
    expect(screen.getByTestId("combo-editor-memo")).toBeTruthy();
  });

  it("見出しクリックで起き攻め節を折りたたみ/再展開できる", () => {
    renderFields([]);
    const section = screen.getByTestId("combo-editor-oki-section");
    const header = section.querySelector("button") as HTMLButtonElement;

    // 展開 → クリックで折りたたみ(中身が消える)
    expect(
      screen.getByTestId(FIRST_OKI_TESTID),
    ).toBeTruthy();
    expect(header.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(header);
    expect(
      screen.queryByTestId(FIRST_OKI_TESTID),
    ).toBeNull();
    expect(header.getAttribute("aria-expanded")).toBe("false");

    // 再クリックで再展開
    fireEvent.click(header);
    expect(
      screen.getByTestId(FIRST_OKI_TESTID),
    ).toBeTruthy();
  });
});

describe("ComboEditorBasicFields 仮登録トグル(C-15 / showDraftToggle)", () => {
  function renderWithDraft(showDraftToggle: boolean | undefined) {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);
    return render(
      <ComboEditorBasicFields
        value={baseValue()}
        customStateDefs={[]}
        onChange={vi.fn()}
        showDraftToggle={showDraftToggle}
      />,
      { wrapper },
    );
  }

  // ★★M24-12(§4.10・レビュー 低-10): 既定を false へ変えた。
  //   ★末尾配置は本サブで廃止しており、本番から到達する経路は無い。既定が true のままだと
  //     **M24-05 が本部品を /setups/:setupId へ流用したとき、撤回したはずの末尾配置が
  //     黙って復活する。** ⇒ 既定側で止める。
  it("★★既定(prop 省略)では仮登録トグルを描画しない(末尾配置は廃止)", () => {
    renderFields([]);
    expect(screen.queryByTestId("combo-editor-draft-checkbox")).toBeNull();
  });

  it("showDraftToggle=true では仮登録トグルを描画する", () => {
    renderWithDraft(true);
    expect(screen.getByTestId("combo-editor-draft-checkbox")).toBeTruthy();
  });

  it("showDraftToggle=false では仮登録トグルを描画しない(新規=最上部へ移譲)", () => {
    renderWithDraft(false);
    expect(screen.queryByTestId("combo-editor-draft-checkbox")).toBeNull();
  });
});

// ★★M24-12(第 3 段): キーボードの順送り。
describe("M24-12 キーボードの順送り", () => {
  function renderWithGoToRecipe(onGoToRecipe: () => void) {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);
    return render(
      <ComboEditorBasicFields
        value={baseValue()}
        customStateDefs={[]}
        onChange={vi.fn()}
        onGoToRecipe={onGoToRecipe}
      />,
      { wrapper },
    );
  }

  /** 停止点の中の、実際にフォーカスを受ける要素。 */
  function focusableIn(stop: Element): HTMLElement {
    return stop.querySelector<HTMLElement>(
      'input:not([disabled]), textarea:not([disabled]), button:not([disabled]):not([tabindex="-1"]), [tabindex="0"]',
    )!;
  }

  it("Enter で次の欄へ進む", () => {
    const { container } = renderWithGoToRecipe(vi.fn());
    const stops = container.querySelectorAll("[data-seq-stop]");
    const first = focusableIn(stops[0]);
    first.focus();
    expect(document.activeElement).toBe(first);

    fireEvent.keyDown(first, { key: "Enter" });
    expect(document.activeElement).toBe(focusableIn(stops[1]));
  });

  // ★★★【M38-01 追補2・2026-09-18】基本情報の停止点の並びは次のとおりである。
  //   **index を直書きするテストは、下の表を見て直すこと。**
  //
  //     0 ダメージ / 1 有利フレーム / 2 開始ドライブ / 3 開始SA
  //     4 始動位置(入力方式) / 5 始動位置(値) / 6 相手の状態 / 7 ヒット種別
  //     8 持続当て / 9 相手の大きさ / 10 運び量(入力方式) / 11 運び量(値)
  //     12 ドライブダメージ / 13 SA消費 / 14 ドライブ消費
  //
  // ★★★追補2 で **16 → 15** になった。2 つのことが同時に起きている(開発者指示)。
  //   (a) **始動技の読み取り専用表示を削除した**(逐語＝「レシピの方で見れるので
  //       わざわざ基本情報タブで見る必要がない」)。
  //   (b) **運び量を「相手の大きさ」の直下へ移した。**
  //   ★★★**index を直書きしている既存テストは、いずれも指すものが変わらない** ——
  //     `stops[3]/[4]`(↓↑ の往復)・`stops[4]/[5]`(始動位置の入れ子)・`stops[6]→[5]`
  //     (復路)はすべて 9 番以前に在り、(a)(b) はどちらも 10 番以降でしか動かないためである。
  //   ★副産物: 始動技は focusable を持たない停止点だった(`stopsOf` が filter で落として
  //     いた)。⇒ 消えたことで raw の `data-seq-stop` 列と実際の停止点の列が一致する。
  //
  // ★★★【2026-09-17 作り直し】**開始残量の「不問」が停止点から消えて 18 → 16 になった。**
  //   ⇒ 旧: `3 開始ドライブの不問` / `5 開始SAの不問` が独立した停止点だった。
  //     数値を打つだけの利用者にも +2 停止を課していたため、同じ `Field` の中へ戻した
  //     (切り替えは数値欄の中の Space)。
  //   ★★★その Space すら追補2 で消えた(トグルごと)。⇒ 開始残量は素の数値欄である。
  //
  // ★★M37-01: 対象の停止点を [1]/[2] から [3]/[4] へ移した。
  //   ★当時の理由 —— [2] は「始動位置(マス数)」であり中身が `type="number"` で、
  //     数値入力は ↑↓ を順送りへ渡さなかった。⇒ 往路(↓)は進むが復路(↑)は進まない。
  //   ★★【M38-01・射程 1】その前提は失効した —— 数値入力も ↑↓ で順送りするように
  //     なった(`useFieldSequence` の `keyIsClaimedByField` から number 分岐を落とした)。
  //     ⇒ どの停止点を選んでも成り立つため対象は動かさない。
  //       ★★【2026-09-17】いまの [3]/[4] は「**開始SA**」と「**始動位置(入力方式)**」である
  //         (不問が停止点でなくなり 1 つずつ繰り上がった)。
  it("↓ で次へ、↑ で前へ進む", () => {
    const { container } = renderWithGoToRecipe(vi.fn());
    const stops = container.querySelectorAll("[data-seq-stop]");
    focusableIn(stops[3]).focus();
    fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    expect(document.activeElement).toBe(focusableIn(stops[4]));
    fireEvent.keyDown(document.activeElement!, { key: "ArrowUp" });
    expect(document.activeElement).toBe(focusableIn(stops[3]));
  });

  // ★★★M37-01(2026-09-13 の作り替え後): 入力方式のボタン群と値の入力欄は、
  //   同じ Field の中の **別々の停止点** である(入れ子の data-seq-stop)。
  //   ★置かないと、順送りは方式ボタンだけを踏んで **値の入力欄を飛ばす**。
  //     ⇒ 型検査もテストも E2E も緑のまま、キーボード経路だけが落ちる型である。
  it("★★順送りで、方式ボタンの次に「値の入力欄」へ入る(入れ子の停止点の証跡)", () => {
    const { container } = renderWithGoToRecipe(vi.fn());
    const stops = container.querySelectorAll("[data-seq-stop]");
    // ★★M38-01: 並び替えで [1]/[2] → [6]/[7]、さらに不問の停止点を畳んで [4]/[5] へ。
    //   ★見ているものは 1 度も変えていない —— 「方式ボタンの次に値の入力欄へ入る」。
    focusableIn(stops[4]).focus(); // 始動位置の入力方式(ボタン群)
    fireEvent.keyDown(document.activeElement!, { key: "Enter" });
    // 既定は通常入力なので、次の停止点は区分ボタン群である。
    expect(document.activeElement).toBe(focusableIn(stops[5]));
    expect(
      (document.activeElement as HTMLElement).getAttribute("data-testid"),
    ).toMatch(/^combo-editor-position-/);
  });

  // ★レビュー 低-3: 復路(次の欄から ↑ で戻る)も押さえる。
  // ★★M38-01: 対象が [3]/[2] → [8]/[7] → **[6]/[5]** へ移った(上の表)。
  //   ⇒ [5] が「始動位置(値)」であり、見ているもの(値の入力欄へ戻れる)は不変である。
  it("★順送りの復路でも値の入力欄へ戻れる", () => {
    const { container } = renderWithGoToRecipe(vi.fn());
    const stops = container.querySelectorAll("[data-seq-stop]");
    focusableIn(stops[6]).focus();
    fireEvent.keyDown(document.activeElement!, { key: "ArrowUp" });
    expect(document.activeElement).toBe(focusableIn(stops[5]));
  });

  // ★★指示書 §4.4.1 / D-578(5)。抜けるのは Tab かクリックだけである。
  it("★★メモ欄では順送りが効かない(Enter は改行・↓ はカーソル移動のため)", () => {
    renderWithGoToRecipe(vi.fn());
    const memo = screen.getByTestId("combo-editor-memo");
    memo.focus();
    expect(document.activeElement).toBe(memo);

    fireEvent.keyDown(memo, { key: "Enter" });
    expect(document.activeElement).toBe(memo);
    fireEvent.keyDown(memo, { key: "ArrowDown" });
    expect(document.activeElement).toBe(memo);
  });

  // ★★★【M38-01・射程 1】数値入力でも ↑↓ は順送りである。
  //
  // ★以下は失効した契約: 「★数値入力では ↑↓ を奪わない(Enter では進む)」
  //   —— ブラウザ既定の増減を残すための除外だった(M24-12)。
  //   開発者の逐語「矢印でフォーカスを移動させれた方がうれしい」で反転した。
  //
  // ★★破壊確認の要は `fireEvent.keyDown` の戻り値である ——
  //   Testing Library は `!event.defaultPrevented` を返す。⇒ `false` は
  //   `preventDefault()` が呼ばれた証拠であり、**ブラウザ既定の増減が抑止されている**
  //   ことを示す。jsdom は number の増減を実装しないため、value を見ても何も言えない。
  //   ⇒ `keyIsClaimedByField` へ number 分岐を戻すと、この行が赤くなる。
  it("★★数値入力でも ↑↓ で順送りし、既定の増減は抑止される", () => {
    const { container } = renderWithGoToRecipe(vi.fn());
    const stops = container.querySelectorAll("[data-seq-stop]");
    const damage = screen.getByTestId("combo-editor-damage") as HTMLInputElement;
    damage.focus();

    // ↓ で次の停止点へ進む。戻り値 false = preventDefault 済み(既定の増減は起きない)。
    expect(fireEvent.keyDown(damage, { key: "ArrowDown" })).toBe(false);
    expect(document.activeElement).toBe(focusableIn(stops[1]));

    // ↑ で戻れる(復路も数値欄が終点になりうる)。
    expect(
      fireEvent.keyDown(document.activeElement!, { key: "ArrowUp" }),
    ).toBe(false);
    expect(document.activeElement).toBe(damage);

    // Enter は従来どおり進む。
    fireEvent.keyDown(damage, { key: "Enter" });
    expect(document.activeElement).toBe(focusableIn(stops[1]));
  });

  // ★★指示書 §4.4.2 の落とせない条件。飛ばさない・止まらない。
  it("★★畳まれたセクションへ移ると、そのセクションが開いてから移る", () => {
    const { container } = renderWithGoToRecipe(vi.fn());

    // 「その他情報」を畳む。
    const otherSection = container.querySelector('[data-seq-section="other"]')!;
    fireEvent.click(otherSection.querySelector("button")!);
    // 畳まれた＝中身がアンマウントされている。
    expect(otherSection.querySelectorAll("[data-seq-stop]")).toHaveLength(0);

    // 起き攻めの最後の停止点から次へ進む。
    const okiSection = container.querySelector('[data-seq-section="oki"]')!;
    const okiStops = okiSection.querySelectorAll("[data-seq-stop]");
    focusableIn(okiStops[okiStops.length - 1]).focus();
    fireEvent.keyDown(document.activeElement!, { key: "Enter" });

    // ★開いた。
    const reopened = otherSection.querySelectorAll("[data-seq-stop]");
    expect(reopened.length).toBeGreaterThan(0);
    // ★★開いたうえで、その先頭へフォーカスが移っている(飛ばしても止まってもいない)。
    expect(document.activeElement).toBe(focusableIn(reopened[0]));
  });

  // ★★末尾の停止点はメモ欄であり、そこで順送りは止まる。
  //   ★「末尾より先へ進んだら自動でレシピタブへ移す」形は採っていない——
  //     開発者の逐語は「タブのみ。あるいは普通にクリックでレシピ遷移のボタンを
  //     押す。」(D-578(5)) であり、自動遷移は求められていない。
  it("★末尾はメモ欄で、そこから自動でタブは移らない(出口はボタンかタブ)", () => {
    const onGoToRecipe = vi.fn();
    const { container } = renderWithGoToRecipe(onGoToRecipe);
    const stops = container.querySelectorAll("[data-seq-stop]");
    const last = focusableIn(stops[stops.length - 1]);
    expect(last).toBe(screen.getByTestId("combo-editor-memo"));

    last.focus();
    fireEvent.keyDown(last, { key: "Enter" });
    // ★留まる。勝手に移らない。
    expect(document.activeElement).toBe(last);
    expect(onGoToRecipe).not.toHaveBeenCalled();

    // ★出口はボタンである。
    fireEvent.click(screen.getByTestId("combo-editor-go-to-recipe"));
    expect(onGoToRecipe).toHaveBeenCalledTimes(1);
  });

  it("★「レシピへ」ボタンがメモ欄より後ろにある", () => {
    renderWithGoToRecipe(vi.fn());
    const memo = screen.getByTestId("combo-editor-memo");
    const button = screen.getByTestId("combo-editor-go-to-recipe");
    // ★DOM 順で メモ → ボタン であること。
    expect(
      memo.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  // ★編集モードで順送りを強制しない(開発者逐語＝「必要な箇所を直接クリックして
  //   変更すればいい」)。⇒ クリックしただけで勝手に動かない。
  it("★クリックした欄にそのまま留まる(順送りを強制しない)", () => {
    renderWithGoToRecipe(vi.fn());
    const memo = screen.getByTestId("combo-editor-memo");
    fireEvent.click(memo);
    memo.focus();
    expect(document.activeElement).toBe(memo);
  });
});

// ★★M24-12(開発者の実機確認 2026-08-29)で見つかった 2 件。どちらも実装漏れである。
describe("M24-12 実機確認で見つかった穴", () => {
  // (d) 起き攻めの停止点だけハイライトのクラスが付いていなかった。
  //     ★jsdom は Tailwind を評価しないため、見えるのはクラス名だけである
  //       ——それでも「付け忘れ」は捕まえられる。
  it("★起き攻めの停止点にもハイライトのクラスが付いている", () => {
    renderFields([]);
    const stop = screen
      .getByTestId(FIRST_OKI_TESTID)
      .closest("[data-seq-stop]") as HTMLElement;
    expect(stop.className).toContain("focus-within:bg-sky-100");
  });
});

// ★★M24-12 v1.2.0(§4.12・D-583): `type=flag` を Switch からボタン群へ。
describe("M24-12 キャラ固有状態(type=flag)のボタン群(§4.12)", () => {
  function renderFlag(value: BasicFieldsValue = baseValue()) {
    const onChange = vi.fn();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);
    const utils = render(
      <ComboEditorBasicFields
        value={value}
        customStateDefs={[flagDef]}
        onChange={onChange}
      />,
      { wrapper },
    );
    return { onChange, ...utils };
  }

  const YES = "combo-editor-custom-state-denjin_charge-yes";
  const NO = "combo-editor-custom-state-denjin_charge-no";

  // ★★指示書 §4.12.2 / チェックリスト 1-23（**重大**）。
  //   `custom_states` は VAL 非連動で BE が止めない。⇒ `false` を書くと黙って壊れる。
  it("★★「いいえ」で undefined が保存される(false を書かない)", () => {
    const { onChange } = renderFlag({
      ...baseValue(),
      customStates: { denjin_charge: true },
    });
    fireEvent.click(screen.getByTestId(NO));
    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as BasicFieldsValue;
    // ★キーごと消えていること。`false` が入っていないこと。
    expect(Object.prototype.hasOwnProperty.call(next.customStates, "denjin_charge")).toBe(
      false,
    );
    expect(next.customStates.denjin_charge).toBeUndefined();
    expect(JSON.stringify(next.customStates)).not.toContain("false");
  });

  it("「はい」で true が保存される", () => {
    const { onChange } = renderFlag();
    fireEvent.click(screen.getByTestId(YES));
    expect(onChange.mock.calls[0][0].customStates.denjin_charge).toBe(true);
  });

  // ★★「未選択」という第 3 の見た目を作らない(指示書 §4.12.2)。
  it("★★初期(undefined)は「いいえ」が選択済みに見える", () => {
    renderFlag();
    expect(screen.getByTestId(NO).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByTestId(YES).getAttribute("aria-checked")).toBe("false");
  });

  // ★他の 5 欄と同じ作法＝数字キーで選べること(指示書 §4.12 / チェックリスト 1-24)。
  it("★数字キーだけで選べる(他の 5 欄と同じ作法)", () => {
    const { onChange } = renderFlag();
    const group = screen.getByTestId("combo-editor-custom-state-denjin_charge");
    fireEvent.keyDown(group, { key: "1" });
    expect(onChange.mock.calls[0][0].customStates.denjin_charge).toBe(true);
  });

  it("★ラベルは「はい / いいえ」で、状態名は別に出ている", () => {
    renderFlag();
    expect(screen.getByTestId(YES).textContent).toContain("はい");
    expect(screen.getByTestId(NO).textContent).toContain("いいえ");
    expect(screen.getByText("電刃錬気")).toBeTruthy();
  });
});

// ★★M24-12 v1.2.0(§4.11・D-582): タグ欄は順送りで到達したときだけ開く。
describe("M24-12 タグ欄の候補表示(§4.11)", () => {
  it("★停止点に「到達したら開く」の印が付いているのはタグ欄だけである", () => {
    const { container } = renderFields([]);
    const marked = container.querySelectorAll("[data-seq-open-on-arrival]");
    expect(marked).toHaveLength(1);
    // ★その停止点がタグ欄であること(印だけ在って別の欄に付いていないこと)。
    expect(marked[0].textContent).toContain("タグ");
  });

  // ★★`Tab` の素通りでは開かない——印はあくまで順送りが読むものであり、
  //   フォーカスに反応する仕掛けを DOM 側に持たせていないことを固定する。
  it("★★フォーカスしただけでは開かない(印は order 属性でしかない)", () => {
    renderFields([]);
    const trigger = screen.getByRole("button", {
      name: /タグを選択、または、新規登録/,
    });
    trigger.focus();
    expect(trigger.getAttribute("aria-expanded")).not.toBe("true");
  });

  // ★★レビュー(2 回目)中-6: 「順送りで開く」を見るテストが E2E にしか無かった。
  //   ★★破壊確認 7 が空振りした原因の片側である——**印を読む側(`useFieldSequence`)を
  //     見ているテストが 1 本も無かった。** E2E (5) へ観測を足して赤にしたが、
  //     指示書 §5.1 は**コンポーネント層にも**「タグ欄が順送りで開き、Tab では
  //     開かないこと」を求めている。⇒ 層を揃える。
  //   ★jsdom でも Radix の Popover は開く(`aria-expanded` が true になる)。
  it("★★順送り(↓)でタグ欄へ到達すると候補が開く", async () => {
    renderFields([]);
    const trigger = screen.getByRole("button", {
      name: /タグを選択、または、新規登録/,
    });
    expect(trigger.getAttribute("aria-expanded")).not.toBe("true");

    // ★1 つ前の停止点(マイコンボ)から ↓ で送る。
    // ★1 つ前の停止点はマイコンボ欄。roving tabindex の受け手(選択中のボタン)を掴む。
    const prev = screen
      .getByRole("radiogroup", { name: "マイコンボ" })
      .querySelector<HTMLElement>('[tabindex="0"]') as HTMLElement;
    expect(prev).toBeTruthy();
    prev.focus();
    fireEvent.keyDown(prev, { key: "ArrowDown" });

    await waitFor(() =>
      expect(
        screen
          .getByRole("button", { name: /タグを選択、または、新規登録/ })
          .getAttribute("aria-expanded"),
      ).toBe("true"),
    );
  });
});

// ★★M24-12 v1.2.0(§4.10.2・D-582): 仮登録トグルのラベルは 2 つの版で同一。
describe("M24-12 仮登録トグルのラベル(§4.10.2)", () => {
  it("★★inline 版と非 inline 版が同じ文字列を見せている", () => {
    const norm = (s: string) => s.replace(/\s+/g, "");
    const a = render(
      <ComboDraftToggleField checked={false} onChange={vi.fn()} />,
    );
    const nonInline = norm(a.container.textContent ?? "");
    a.unmount();
    const b = render(
      <ComboDraftToggleField inline checked={false} onChange={vi.fn()} />,
    );
    const inline = norm(b.container.textContent ?? "");
    // ★非 inline 版は legend「仮登録モード」を持つため、ラベル部分の包含で比べる。
    expect(nonInline).toContain(norm(DRAFT_TOGGLE_LABEL));
    expect(inline).toContain(norm(DRAFT_TOGGLE_LABEL));
    b.unmount();
  });

  it("★旧 inline 版の「仮登録」2 文字だけの形へ戻っていない", () => {
    const { container } = render(
      <ComboDraftToggleField inline checked={false} onChange={vi.fn()} />,
    );
    // ★M24-13: 括弧の中から「レシピ未入力」を落とした(仮登録でもレシピが要る)。
    //   ★見ているものは変わらない——inline 版でも補足が出ていること。
    expect(container.textContent).toContain("重複コンボの登録等を許容");
  });

  // ★★UI 種別は Switch のまま(指示書 §4.12.4 / チェックリスト 1-25)。
  it("★★UI 種別は Switch のまま(ボタン群に替えていない)", () => {
    render(<ComboDraftToggleField inline checked={false} onChange={vi.fn()} />);
    const sw = screen.getByTestId("combo-editor-draft-checkbox");
    expect(sw.getAttribute("role")).toBe("switch");
  });
});

// ══════════════════════════════════════════════════════════════════════════
// M37-01: 始動位置・運び量の入力方式(D-730 / D-731 ＋ 2026-09-13 開発者裁定)
//
// ★★★2026-09-13 に作りが変わった —— 3 方式を並べて連動させる形から、
//   **入力方式を選んで 1 項目だけ入力させる**形へ。⇒ 連動は「方式を切り替えたときに
//   同じ値が別の単位で見える」ことで確かめる(値は マス数 1 本＝D-731)。
// ══════════════════════════════════════════════════════════════════════════

/** 制御コンポーネントとして親の state を持つラッパ。 */
function ThreeWayHarness({ initial }: { initial?: Partial<BasicFieldsValue> }) {
  const [v, setV] = React.useState<BasicFieldsValue>({
    ...baseValue(),
    ...initial,
  });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <ComboEditorBasicFields
        value={v}
        customStateDefs={[]}
        onChange={setV}
      />
      <output data-testid="probe-position">{v.position || "(empty)"}</output>
      <output data-testid="probe-start-mass">
        {v.startPositionMass || "(empty)"}
      </output>
      <output data-testid="probe-carry-mass">
        {v.carryDistanceMass || "(empty)"}
      </output>
    </QueryClientProvider>
  );
}

const probe = (name: string) => screen.getByTestId(`probe-${name}`).textContent;
const bandIsOn = (code: string) =>
  screen.getByTestId(`combo-editor-position-${code}`).getAttribute("aria-checked") === "true";

/** 始動位置の入力方式を選ぶ。 */
const pickPositionMode = (mode: "band" | "mass" | "percent") =>
  fireEvent.click(screen.getByTestId(`combo-editor-position-mode-${mode}`));
/** 運び量の入力方式を選ぶ。 */
const pickCarryMode = (mode: "mass" | "percent") =>
  fireEvent.click(screen.getByTestId(`combo-editor-carry-mode-${mode}`));

const startBox = () =>
  screen.getByLabelText(/^始動位置\(トレーニングモードのマス目\)$/) as HTMLInputElement;
const startPct = () =>
  screen.getByLabelText("始動位置(パーセンテージ)") as HTMLInputElement;

describe("M37-01 入力方式を選んで 1 項目だけ入力させる(2026-09-13 開発者裁定)", () => {
  // ★★2026-09-13 開発者指定(案 B): 並びは 通常入力 → パーセンテージ → マス目。
  //   ★数字キーのショートカットは並び順から導出されるため、並びを変えると番号も動く。
  //     ⇒ ラベル文字列へ数字を焼き込まず、並びと番号を同時に固定する。
  it("★入力方式の並びは 通常入力 → パーセンテージ → マス目 で、頭に番号が出る", () => {
    render(<ThreeWayHarness />);
    const group = screen.getByTestId("combo-editor-position-mode");
    const pills = Array.from(group.querySelectorAll('[role="radio"]'));
    expect(pills.map((b) => b.getAttribute("data-testid"))).toEqual([
      "combo-editor-position-mode-band",
      "combo-editor-position-mode-percent",
      "combo-editor-position-mode-mass",
    ]);
    expect(pills.map((b) => b.textContent)).toEqual([
      "1通常入力",
      "2パーセンテージ",
      "3マス目",
    ]);
  });

  it("★運び量も パーセンテージ → マス目 の並びで番号が出る", () => {
    render(<ThreeWayHarness />);
    const group = screen.getByTestId("combo-editor-carry-mode");
    const pills = Array.from(group.querySelectorAll('[role="radio"]'));
    expect(pills.map((b) => b.textContent)).toEqual([
      "1パーセンテージ",
      "2マス目",
    ]);
  });

  // ★★数字キーで選べることは維持する(2026-09-13 開発者要望)。
  it("★数字キーで入力方式を選べる(2 でパーセンテージ)", () => {
    render(<ThreeWayHarness />);
    const group = screen.getByTestId("combo-editor-position-mode");
    fireEvent.keyDown(group, { key: "2" });
    expect(
      screen
        .getByTestId("combo-editor-position-mode-percent")
        .getAttribute("aria-checked"),
    ).toBe("true");
    expect(startPct()).toBeTruthy();
  });

  // ★★★案 B の狙いそのもの —— 方式の群と値の群が**見た目で見分けられる**こと。
  //   ★同じ見た目に戻したら赤くなる。⇒ 「境界が読めない」への対処が消えたら気づける。
  it("★方式のピルと値のボタンは見た目が違う(丸ピル vs 角丸長方形)", () => {
    render(<ThreeWayHarness initial={{ position: "mid_screen", startPositionMass: "80" }} />);
    const modePill = screen.getByTestId("combo-editor-position-mode-band");
    const valueBtn = screen.getByTestId("combo-editor-position-mid_screen");
    // どちらも「選択中」の状態どうしで比べる。
    expect(modePill.getAttribute("aria-checked")).toBe("true");
    expect(valueBtn.getAttribute("aria-checked")).toBe("true");
    // ★形が違う —— 方式は丸ピル、値は角丸長方形。
    expect(modePill.className).toContain("rounded-full");
    expect(valueBtn.className).not.toContain("rounded-full");
    // ★選択色も分ける —— 値は青、方式は slate。
    expect(modePill.className).toContain("slate-700");
    expect(valueBtn.className).toContain("blue-600");
  });

  it("★「入力方式」と言葉でも書いてある", () => {
    render(<ThreeWayHarness />);
    expect(screen.getAllByText("入力方式").length).toBe(2); // 始動位置 / 運び量
  });

  it("★既定は「通常入力」である(D-731＝既定の入力方式は従来型のまま)", () => {
    render(<ThreeWayHarness />);
    expect(
      screen
        .getByTestId("combo-editor-position-mode-band")
        .getAttribute("aria-checked"),
    ).toBe("true");
    // 区分ボタンが出ており、数値欄は出ていない。
    expect(screen.getByTestId("combo-editor-position-mid_screen")).toBeTruthy();
    expect(
      screen.queryByTestId("combo-editor-start-position-mass"),
    ).toBeNull();
  });

  it("★方式を切り替えると、出ている入力欄が 1 つだけ入れ替わる", () => {
    render(<ThreeWayHarness />);
    pickPositionMode("mass");
    expect(screen.queryByTestId("combo-editor-position-mid_screen")).toBeNull();
    expect(startBox()).toBeTruthy();
    expect(screen.queryByLabelText("始動位置(パーセンテージ)")).toBeNull();

    pickPositionMode("percent");
    expect(screen.queryByTestId("combo-editor-start-position-mass")).toBeNull();
    expect(startPct()).toBeTruthy();
  });

  // ── 値は 1 本(D-731)。方式を切り替えても保たれ、単位が変わって見えるだけ ──
  // 方向 1: 区分 → マス数 / パーセント
  it("区分で選んだ値が、マス目とパーセンテージへ写る", () => {
    render(<ThreeWayHarness />);
    fireEvent.click(screen.getByTestId("combo-editor-position-mid_screen"));
    expect(probe("start-mass")).toBe("80"); // D-731 の代表値
    pickPositionMode("mass");
    expect(startBox().value).toBe("80");
    pickPositionMode("percent");
    expect(startPct().value).toBe("50");
  });

  // 方向 2: マス数 → 区分 / パーセント
  it("マス目で入れた値が、区分とパーセンテージへ写る", () => {
    render(<ThreeWayHarness />);
    pickPositionMode("mass");
    fireEvent.change(startBox(), { target: { value: "100" } });
    pickPositionMode("band");
    expect(bandIsOn("mid_opponent")).toBe(true); // 91〜112(D-731 の是正後)
    pickPositionMode("percent");
    expect(startPct().value).toBe("62.5");
  });

  // 方向 3: パーセント → 区分 / マス数
  it("パーセンテージで入れた値が、区分とマス目へ写る", () => {
    render(<ThreeWayHarness />);
    pickPositionMode("percent");
    fireEvent.change(startPct(), { target: { value: "25" } });
    expect(probe("start-mass")).toBe("40");
    pickPositionMode("band");
    expect(bandIsOn("corner_self_near")).toBe(true); // 26〜47
    pickPositionMode("mass");
    expect(startBox().value).toBe("40");
  });

  it("★境界 112/113 は D-731 の是正後の値である(D-730 の旧 91〜111 ではない)", () => {
    render(<ThreeWayHarness />);
    pickPositionMode("mass");
    fireEvent.change(startBox(), { target: { value: "112" } });
    pickPositionMode("band");
    expect(bandIsOn("mid_opponent")).toBe(true);
    pickPositionMode("mass");
    fireEvent.change(startBox(), { target: { value: "113" } });
    pickPositionMode("band");
    expect(bandIsOn("corner_opponent_near")).toBe(true);
  });

  it("★値域外は画面に入らない(161 → 160)", () => {
    render(<ThreeWayHarness />);
    pickPositionMode("mass");
    fireEvent.change(startBox(), { target: { value: "161" } });
    expect(probe("start-mass")).toBe("160");
  });

  it("「不問」を選ぶとマス数も空になる(§5-3)", () => {
    render(<ThreeWayHarness initial={{ position: "mid_screen", startPositionMass: "80" }} />);
    fireEvent.click(screen.getByTestId("combo-editor-position-unspecified"));
    expect(probe("position")).toBe("(empty)");
    expect(probe("start-mass")).toBe("(empty)");
  });

  // ★★OptionButtonGroup は同じ値を押し直しても onChange を発火する。
  it("★同じ区分を押し直しても、域内のマス数は代表値で潰されない", () => {
    render(
      <ThreeWayHarness
        initial={{ position: "mid_screen", startPositionMass: "85" }}
      />,
    );
    fireEvent.click(screen.getByTestId("combo-editor-position-mid_screen"));
    expect(probe("start-mass")).toBe("85"); // 80 に戻らない
  });

  it("★区分を*変えた*ときは従来どおり代表値が入る(D-730 の従来型)", () => {
    render(
      <ThreeWayHarness
        initial={{ position: "mid_screen", startPositionMass: "85" }}
      />,
    );
    fireEvent.click(screen.getByTestId("combo-editor-position-corner_self"));
    expect(probe("start-mass")).toBe("12");
  });

  it("既存の区分ボタンは 8 個のままである(§5-5 の非破壊)", () => {
    render(<ThreeWayHarness />);
    // ★区分ボタン群のコンテナの中だけを数える。⇒ 入力方式のボタン群
    //   (combo-editor-position-mode)を巻き込まない。
    const group = screen.getByTestId("combo-editor-position");
    expect(group.querySelectorAll('[role="radio"]')).toHaveLength(
      Object.keys(POSITION_LABEL_JA).length + 1, // 7 区分 + 不問
    );
  });
});

describe("M37-01 運び量に区分は付けられない(D-731 不変条件 2・破壊確認 層 3)", () => {
  const carryField = () =>
    screen.getByTestId("combo-editor-carry-mode-mass").closest("[data-seq-stop]")!;

  // ★★★入力方式の選択そのものは radiogroup なので「radio が 0 個」では見られない。
  //   ⇒ **区分の語が出ないこと**と**方式が 2 択であること**で見る。
  it("★運び量の入力方式は 2 択で、区分が無い", () => {
    render(<ThreeWayHarness />);
    expect(screen.getByTestId("combo-editor-carry-mode-mass")).toBeTruthy();
    expect(screen.getByTestId("combo-editor-carry-mode-percent")).toBeTruthy();
    expect(screen.queryByTestId("combo-editor-carry-mode-band")).toBeNull();
  });

  it("★運び量の欄に区分名が 1 つも出ない", () => {
    render(<ThreeWayHarness />);
    // ★語の一覧はハードコピーせず POSITION_LABEL_JA から引く
    //   —— 区分名が増減したときに、この検査だけ古い集合を見る状態にしないため。
    for (const label of Object.values(POSITION_LABEL_JA)) {
      expect(carryField().textContent).not.toContain(label);
    }
    // ★パーセンテージへ切り替えても同じ。
    pickCarryMode("percent");
    for (const label of Object.values(POSITION_LABEL_JA)) {
      expect(carryField().textContent).not.toContain(label);
    }
  });

  it("運び量を動かしても始動位置・区分は 1 つも動かない(不変条件 1)", () => {
    render(<ThreeWayHarness initial={{ position: "mid_screen", startPositionMass: "80" }} />);
    fireEvent.change(
      screen.getByLabelText("運び量(トレーニングモードのマス目)"),
      { target: { value: "45" } },
    );
    expect(probe("carry-mass")).toBe("45");
    expect(probe("position")).toBe("mid_screen");
    expect(probe("start-mass")).toBe("80");
  });

  it("始動位置を動かしても運び量は動かない(不変条件 1・逆方向)", () => {
    render(<ThreeWayHarness initial={{ carryDistanceMass: "45" }} />);
    fireEvent.click(screen.getByTestId("combo-editor-position-corner_opponent"));
    expect(probe("start-mass")).toBe("148");
    expect(probe("carry-mass")).toBe("45");
  });
});

// ══════════════════════════════════════════════════════════════════════════
// ★★★M37-05: 始動位置のマス数の不変条件(`P-60` の決着・`D-864`)—— 画面の側
//
// ★★不変条件は 1 行である: `start_position_mass IS NULL` ⇔ `position = 不問`。
//   ⇒ 区分が決まっているなら、マス数は必ず値を持つ。
//
// ★★★帰結＝区分が決まっている始動位置では、マス数を空にできなくなる。
//   ⇒ **これを保存の応答で初めて見せると「消したのに生えてきた」と映る**(指示書 §0.6)。
//   ★本 describe が見るのは「**保存より前に**画面上で数字が戻ること」である。
//
// ★サーバ側(`fillStartPositionMassForPatch`)も同じ補完を行う。⇒ 埋めなくても
//   保存結果は同じになるため、**テストも型検査も何も言わない**。人が読む以外に
//   見つける経路が無い型であり、本 describe がその代わりである。
// ══════════════════════════════════════════════════════════════════════════
describe("M37-05 マス数を空のまま離れると代表値が入る(D-864)", () => {
  const elsewhere = () => screen.getByTestId("combo-editor-position-mode-band");

  it("★マス目: 区分が決まっていれば、空にして離れると代表値が戻る", () => {
    render(
      <ThreeWayHarness
        initial={{ position: "mid_screen", startPositionMass: "85" }}
      />,
    );
    pickPositionMode("mass");
    fireEvent.change(startBox(), { target: { value: "" } });
    expect(probe("start-mass")).toBe("(empty)"); // ★入力中は空のまま(打ち直せる)
    fireEvent.blur(startBox());
    expect(probe("start-mass")).toBe("80"); // mid_screen の代表値
    expect(probe("position")).toBe("mid_screen"); // ★区分は動かない
  });

  it("★パーセンテージ: 同じ結果になる(方式で挙動が割れない)", () => {
    render(
      <ThreeWayHarness
        initial={{ position: "corner_self", startPositionMass: "5" }}
      />,
    );
    pickPositionMode("percent");
    fireEvent.change(startPct(), { target: { value: "" } });
    expect(probe("start-mass")).toBe("(empty)");
    fireEvent.blur(startPct());
    expect(probe("start-mass")).toBe("12"); // corner_self の代表値
    expect(probe("position")).toBe("corner_self");
  });

  it("★★不問なら空のままである(代表値が定義されていない)", () => {
    render(<ThreeWayHarness initial={{ position: "", startPositionMass: "" }} />);
    pickPositionMode("mass");
    fireEvent.blur(startBox());
    expect(probe("start-mass")).toBe("(empty)");
    expect(probe("position")).toBe("(empty)");
  });

  it("★値が入っているときは離れても書き換えない", () => {
    render(
      <ThreeWayHarness
        initial={{ position: "mid_screen", startPositionMass: "85" }}
      />,
    );
    pickPositionMode("mass");
    fireEvent.blur(startBox());
    expect(probe("start-mass")).toBe("85"); // 80 へ潰さない
  });

  it("★区分をまたぐ値を入れてから離れても、その値のままである", () => {
    render(
      <ThreeWayHarness
        initial={{ position: "mid_screen", startPositionMass: "80" }}
      />,
    );
    pickPositionMode("mass");
    fireEvent.change(startBox(), { target: { value: "12" } });
    fireEvent.blur(startBox());
    expect(probe("start-mass")).toBe("12");
    // ★画面側は区分を導出して追随させる(既存挙動)。⇒ hasKeyChanges が PUT へ振り分ける。
    expect(probe("position")).toBe("corner_self");
  });

  // ★★★運び量は区分を持たない(`D-731` 不変条件 2)。⇒ 代表値という概念が存在しない。
  //   ★名前が似ているだけである(指示書 §4.3)。**埋まったら不合格**。
  it("★★★運び量は、区分が決まっていても離れて空のままである", () => {
    render(
      <ThreeWayHarness
        initial={{ position: "mid_screen", carryDistanceMass: "" }}
      />,
    );
    const carryBox = screen.getByLabelText(
      "運び量(トレーニングモードのマス目)",
    ) as HTMLInputElement;
    fireEvent.blur(carryBox);
    expect(probe("carry-mass")).toBe("(empty)");
  });

  it("★★★運び量: 値を消して離れても空のままである", () => {
    render(
      <ThreeWayHarness
        initial={{ position: "mid_screen", carryDistanceMass: "60" }}
      />,
    );
    const carryBox = screen.getByLabelText(
      "運び量(トレーニングモードのマス目)",
    ) as HTMLInputElement;
    fireEvent.change(carryBox, { target: { value: "" } });
    fireEvent.blur(carryBox);
    expect(probe("carry-mass")).toBe("(empty)");
  });

  // ★離れたあとに 通常入力 へ切り替えても、区分ボタンの点灯と値が一致すること。
  it("代表値が入ったあと、通常入力の区分ボタンが同じ区分を指す", () => {
    render(
      <ThreeWayHarness
        initial={{ position: "mid_opponent", startPositionMass: "95" }}
      />,
    );
    pickPositionMode("mass");
    fireEvent.change(startBox(), { target: { value: "" } });
    fireEvent.blur(startBox());
    expect(probe("start-mass")).toBe("102");
    fireEvent.click(elsewhere());
    expect(bandIsOn("mid_opponent")).toBe(true);
  });
});

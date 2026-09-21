import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ★M30-02 レビュー 中-5: 新設文言を locale へ寄せたため、実 ja.json を引く
//   (VirtualController.test.tsx と同じ流儀)。
import "@/lib/i18n";
import type { Move } from "@/features/moves/types";

import type { Step } from "../types";
import { ModifiersEditor } from "./ModifiersEditor";
import {
  MODIFIER_FLAGS_COMMON,
  MODIFIER_OD_VARIANT_FLAGS,
} from "../labels";

const CHAR_ID = 1;

function makeMove(id: number, code: string, nameJa?: string, category = "normal"): Move {
  return { id, characterId: CHAR_ID, code, category, isAerial: false, setupOnly: false, isDerived: false, nameJa };
}

const movesById = new Map<number, Move>([
  [1, makeMove(1, "standing_medium_punch", "立ち中P")],
  // ★M30-02(SD-020): OD 強度組合せの活性条件は「必殺技の OD であること」。
  //   対照として必殺技の OD を 1 件置く。
  [2, makeMove(2, "hadoken_od", "OD波動拳", "special")],
]);

// ラベル文字列から、そのラベルが包んでいる checkbox を引く。
// ★添字で引かない —— 群を分けた時点で添字は意味を失う(M30-02)。
function checkboxByLabel(label: string): HTMLElement {
  const el = screen.getByText(label).closest("label");
  if (el == null) throw new Error(`label が見つからない: ${label}`);
  return within(el).getByRole("checkbox");
}

function makeMoveStep(overrides?: Partial<Step>): Step {
  return { stepOrder: 1, moveId: 1, ...overrides };
}

function makeNonMoveStep(overrides?: Partial<Step>): Step {
  return {
    stepOrder: 1,
    moveId: undefined,
    modifiers: { type: "parry_drive_rush" },
    ...overrides,
  };
}

function renderEditor(props?: { step?: Step; stepIndex?: number; onSave?: ReturnType<typeof vi.fn>; onOpenChange?: ReturnType<typeof vi.fn> }) {
  return render(
    <ModifiersEditor
      open={true}
      step={props?.step ?? makeMoveStep()}
      stepIndex={props?.stepIndex ?? 0}
      movesById={movesById}
      onSave={props?.onSave ?? vi.fn()}
      onOpenChange={props?.onOpenChange ?? vi.fn()}
    />,
  );
}

describe("ModifiersEditor", () => {
  it("open=false のとき dialog が存在しない", () => {
    render(
      <ModifiersEditor
        open={false}
        step={undefined}
        stepIndex={null}
        movesById={movesById}
        onSave={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  // ★★M37-06: flags が 7 → 11 値になり、表示語も 1 件変わった(低ジャンプ → 低空)。
  //   ★添字ではなくラベルで引く —— 並びが変わるたびに落ちるテストにしないため
  //     (checkboxByLabel の注記と同じ理由。M30-02 で一度踏んでいる)。
  it("基本 flags(delay / link / 低空 / ノーキャン)が描画される", () => {
    renderEditor();
    expect(screen.getByText("ディレイ")).toBeTruthy();
    expect(screen.getByText("目押し")).toBeTruthy();
    expect(screen.getByText("低空")).toBeTruthy();
    expect(screen.getByText("ノーキャン")).toBeTruthy();
    // ★逆向き —— 旧表示語が残っていないこと(M37-06 §2.2 の表示語変更 1 件)。
    expect(screen.queryByText("低ジャンプ")).toBeNull();
  });

  // ★★★M37-06 §2.3: 選択肢から外した 3 値が**選択肢に出ない**こと。
  //   ⇒ 表示語そのものは labels.ts に残っている(既存行の表示に要る)。
  //     消えたのは「新規に選べること」だけである。
  it("★選択肢から外した 3 値(just / neutral_jump / forward_jump)は出ない", () => {
    renderEditor();
    for (const retired of ["ジャスト", "垂直ジャンプ中", "前ジャンプ中"]) {
      expect(screen.queryByText(retired)).toBeNull();
    }
  });

  it("既存ステップの flags が初期値として反映される", () => {
    renderEditor({ step: makeMoveStep({ modifiers: { flags: ["delay"] } }) });
    expect(checkboxByLabel("ディレイ").getAttribute("data-state")).toBe("checked");
    expect(checkboxByLabel("目押し").getAttribute("data-state")).toBe("unchecked");
  });

  // ★★★M37-06 §2.3-2 / §4.6: 既存行の modifiers を書き換えない、の UI 側の担保。
  //   選択肢から外した flag を持つステップを**開いて保存し直しても値が消えない**こと。
  //   ⇒ 消えると recipe_hash が変わり、重複判定と recipe_cache が同時に狂う(SUPP-001)。
  it("★★選択肢から外した flag は、編集して保存しても落ちない", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderEditor({ step: makeMoveStep({ modifiers: { flags: ["just"] } }), onSave });

    await user.click(checkboxByLabel("ディレイ"));
    await user.click(screen.getByRole("button", { name: "保存" }));

    const [, mods] = onSave.mock.calls[0];
    expect(mods.flags).toEqual(expect.arrayContaining(["just", "delay"]));
  });

  // ★M37-06 §5-5 / C-2: link と no_cancel は別の要素であり排他ではない(D-873)。
  it("★link と no_cancel は両方同時に選べる(排他ではない)", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderEditor({ onSave });

    await user.click(checkboxByLabel("目押し"));
    await user.click(checkboxByLabel("ノーキャン"));
    await user.click(screen.getByRole("button", { name: "保存" }));

    const [, mods] = onSave.mock.calls[0];
    expect(mods.flags).toEqual(expect.arrayContaining(["link", "no_cancel"]));
  });

  it("技ステップ(moveId !== null)では type ラジオボタンが表示されない", () => {
    renderEditor();
    expect(screen.queryByRole("radio")).toBeNull();
  });

  it("非技ステップ(moveId === null)では type ラジオボタンが表示される(dash は M16-04 で撤去済み)", () => {
    renderEditor({ step: makeNonMoveStep() });
    const radios = screen.getAllByRole("radio");
    // dash 撤去後は parry_drive_rush / cancel_drive_rush の 2 択のみ。
    expect(radios.length).toBe(2);
    // ★★M37-06 §2.6-3: parry_drive_rush の UI 表記をサーバ側の一般語「生ラッシュ」へ寄せた
    //   (着手前は UI だけ「パリィドライブラッシュ」で、同じステップが画面により別名だった)。
    expect(screen.getByText("生ラッシュ")).toBeTruthy();
    expect(screen.getByText("キャンセルドライブラッシュ")).toBeTruthy();
    // 方向別 dash は modifier.type 選択肢から消えている(再混入経路の遮断)。
    expect(screen.queryByText("前方ステップ")).toBeNull();
    expect(screen.queryByText("後方ステップ")).toBeNull();
  });

  it("notes を50文字超で入力すると警告色クラスが付与される", async () => {
    const user = userEvent.setup();
    renderEditor();
    const textarea = screen.getByRole("textbox", { name: /メモ/ }) as HTMLTextAreaElement;
    await user.clear(textarea);
    await user.type(textarea, "あ".repeat(51));
    expect(textarea.className).toMatch(/border-red/);
  });

  it("「保存」クリック → onSave(stepIndex, newModifiers) が呼ばれる", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    renderEditor({ stepIndex: 2, onSave });

    // ★添字ではなくラベルで引く(M37-06 で並びが変わったため)。
    await user.click(checkboxByLabel("目押し"));
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(onSave).toHaveBeenCalledOnce();
    const [idx, mods] = onSave.mock.calls[0];
    expect(idx).toBe(2);
    expect(mods?.flags).toContain("link");
  });

  it("「キャンセル」クリック → onSave が呼ばれず onOpenChange(false) が呼ばれる", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onOpenChange = vi.fn();

    renderEditor({ onSave, onOpenChange });

    await user.click(screen.getByRole("button", { name: "キャンセル" }));

    expect(onSave).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe("ModifiersEditor M15-03 追加 flags(OD組・一段目キャンセル・垂直/前ジャンプ中)", () => {
  // ★M24-04(指示書 §5.2 / M24-01 §7-8): 件数のベタ書きをやめ、
  //   「定義した項目がすべて出る」形にした。flag を足したらテストを直す必要は無く、
  //   足した flag が画面に出ていなければ落ちる。
  // ★★M30-02(SD-020): 群が 2 つになった。常時出す群と、既定非表示の OD 強度組合せ群である。
  it("常時出す群の flag がすべて固定選択式(checkbox)で描画される", () => {
    renderEditor();
    for (const flag of MODIFIER_FLAGS_COMMON) {
      expect(screen.getByText(flag.label)).toBeTruthy();
    }
    expect(screen.getAllByRole("checkbox")).toHaveLength(
      MODIFIER_FLAGS_COMMON.length,
    );
  });

  it("★★必殺技の OD でないステップでは節ごと出ない(2026-09-09 開発者判断)", () => {
    // ★着手時点は「常に節を出して中身を disabled」だった。⇒ 出さない形へ変えた。
    //   既定の makeMoveStep は moveId=1(standing_medium_punch = 通常技)。
    renderEditor();
    expect(screen.queryByTestId("recipe-od-variant-section-dialog")).toBeNull();
    for (const flag of MODIFIER_OD_VARIANT_FLAGS) {
      expect(screen.queryByText(flag.label)).toBeNull();
    }
  });

  it("★対照: 必殺技の OD なら節が出る。★ただし既定は畳まれている(SD-020)", () => {
    // ★★この対照が無いと「常に出さない」でも上の 1 件は緑になる。
    renderEditor({ step: makeMoveStep({ moveId: 2 }) });
    expect(screen.getByTestId("recipe-od-variant-section-dialog")).toBeTruthy();
    for (const flag of MODIFIER_OD_VARIANT_FLAGS) {
      expect(screen.queryByText(flag.label)).toBeNull();
    }
  });

  it("★展開すると OD 強度組合せが 3 つとも出る(SD-020)", async () => {
    const user = userEvent.setup();
    renderEditor({ step: makeMoveStep({ moveId: 2 }) });
    await user.click(screen.getByRole("button", { name: /OD 強度組合せ/ }));
    for (const flag of MODIFIER_OD_VARIANT_FLAGS) {
      expect(screen.getByText(flag.label)).toBeTruthy();
    }
  });

  it("★★必殺技の OD のステップでは OD 強度組合せを選べる(SD-020 活性条件)", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderEditor({ step: makeMoveStep({ moveId: 2 }), onSave });
    await user.click(screen.getByRole("button", { name: /OD 強度組合せ/ }));
    await user.click(checkboxByLabel("OD(弱中)"));
    await user.click(screen.getByRole("button", { name: "保存" }));
    const [, mods] = onSave.mock.calls[0];
    expect(mods.flags).toEqual(["od_lm"]);
  });

  it("追加 flag を付与して保存すると modifiers.flags に載る(既存 flag と衝突しない)", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    // 既存 flag just を持つステップに first_hit_cancel を足す
    renderEditor({ step: makeMoveStep({ modifiers: { flags: ["just"] } }), onSave });
    await user.click(checkboxByLabel("一段目キャンセル"));
    await user.click(screen.getByRole("button", { name: "保存" }));
    const [, mods] = onSave.mock.calls[0];
    expect(mods.flags).toEqual(expect.arrayContaining(["just", "first_hit_cancel"]));
  });

  it("★★付与済みの OD 組は、活性条件を満たさないステップでも外せる(既存データの保護)", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    // ★moveId=1 は通常技である。⇒ 新規付与はできないが、既に入っている値は外せる。
    //   ★節は自動で開く —— 閉じたままだと「付けた覚えのある値が消えた」に見える。
    renderEditor({ step: makeMoveStep({ modifiers: { flags: ["od_lm"] } }), onSave });
    const target = checkboxByLabel("OD(弱中)");
    expect(target.getAttribute("data-state")).toBe("checked");
    expect(target).toHaveProperty("disabled", false);
    await user.click(target);
    await user.click(screen.getByRole("button", { name: "保存" }));
    const [, mods] = onSave.mock.calls[0];
    expect(mods).toBeUndefined();
  });
});

describe("ModifiersEditor info-mark (⑤ modifier 説明)", () => {
  it("modifier の info-mark トリガが描画される", () => {
    renderEditor();
    expect(screen.getByTestId("info-mark-modifier")).toBeTruthy();
    // 初期状態(未クリック)では説明 Popover は開いていない
    expect(screen.queryByTestId("info-mark-modifier-content")).toBeNull();
  });

  it("info-mark クリックで説明が表示され、既存の保存導線に副作用がない", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderEditor({ onSave });

    await user.click(screen.getByTestId("info-mark-modifier"));

    const content = screen.getByTestId("info-mark-modifier-content");
    // ★M30-02 レビュー 中-5 で実 ja.json を読むようにしたため、キーではなく本文が出る。
    //   表示のみで保存は呼ばれない。
    expect(content.textContent).toContain("補足設定");
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe("ModifiersEditor localNotes 50文字超 console.warn 警告", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("50文字以下では console.warn が発火しない", async () => {
    const user = userEvent.setup();
    renderEditor();
    const textarea = screen.getByRole("textbox", { name: /メモ/ });
    await user.clear(textarea);
    await user.type(textarea, "あ".repeat(50));
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("51文字以上で console.warn が1回発火し「50文字を超えています」を含む", async () => {
    const user = userEvent.setup();
    renderEditor();
    const textarea = screen.getByRole("textbox", { name: /メモ/ });
    await user.clear(textarea);
    await user.type(textarea, "あ".repeat(51));
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("50 文字を超えています"));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("51"));
  });

  it("50文字超→50文字以下に減らした際、追加発火がない", async () => {
    const user = userEvent.setup();
    renderEditor();
    const textarea = screen.getByRole("textbox", { name: /メモ/ });
    await user.clear(textarea);
    await user.type(textarea, "あ".repeat(51));
    expect(warnSpy).toHaveBeenCalledTimes(1);
    await user.clear(textarea);
    await user.type(textarea, "あ".repeat(50));
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});

// ============================================================================
// M37-02 / B04: 非技ステップの見出しに内部 type が漏れないこと。
//
// ★着手前は `renderStepLabel` が `step.modifiers.type` をそのまま返しており、
//   ダイアログ見出しが「ステップ編集: parry_drive_rush」になっていた
//   (M37-RESEARCH-01 §3.3 の実測)。同型の是正は StepRow が M16-06 で済ませていた。
// ============================================================================
describe("M37-02 B04: 非技ステップの見出し", () => {
  it("★内部 type ではなく利用者語彙で出る", () => {
    renderEditor({ step: makeNonMoveStep() });

    const title = screen.getByRole("heading", { name: /ステップ編集/ });
    // ★M37-06 §2.6-3 で表記を「生ラッシュ」へ寄せた。見出しの原則(内部識別子を出さない)は不変。
    expect(title.textContent).toContain("生ラッシュ");
    // ★逆向き —— 内部識別子が 1 文字も出ていないこと。
    expect(title.textContent).not.toContain("parry_drive_rush");
  });

  it("★未知の type は内部識別子を出さずに「(不明なステップ)」へ倒す", () => {
    renderEditor({
      step: makeNonMoveStep({ modifiers: { type: "totally_unknown_type" } }),
    });

    const title = screen.getByRole("heading", { name: /ステップ編集/ });
    expect(title.textContent).toContain("(不明なステップ)");
    expect(title.textContent).not.toContain("totally_unknown_type");
  });
});

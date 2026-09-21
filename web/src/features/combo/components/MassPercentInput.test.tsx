import { useState } from "react";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import {
  MAX_POSITION_MASS,
  massToPercent,
  percentToMass,
} from "@/constants/position";
import {
  MassPercentInput,
  type MassPercentInputProps,
} from "./MassPercentInput";

// ── 破壊確認 層 1: props の完全一致 ──────────────────────────────────────
//
// ★★★M37-01 §5-2 / チェックリスト A-2。
//   `D-731` の不変条件 2 を「付けられない形」で固定する 3 層のうちの 1 層目。
//   ★口を 1 つでも足すと本テストがコンパイルエラーになる —— 型が違うかどうかでは
//     なく、**キーの集合そのもの**を見るため、`options?: never` のような
//     「一見無害な」追加でも赤くなる。
//   ★層 2(実装の走査)は MassPercentInput.convention.test.ts、
//     層 3(描画の確認)は ComboEditorBasicFields.test.tsx にある。
//
// ★★`mode` は 2026-09-13 の作り替え(1 項目入力)で足した口である。
//   **"band" を含まない 2 値**であり、区分を通す口ではない —— 下の型テストが
//   その 2 値も固定する。
//
// ★★★`onBlur` は `M37-05`(2026-09-13・`D-864`)で足した口であり、**6 → 7 へ**
//   意図して広げたものである。**合意の上で更新した**(開発者裁定・案 A)。
//   ★足した理由＝不変条件 `start_position_mass IS NULL` ⇔ `position = 不問` の帰結として
//     「区分が決まっている始動位置ではマス数を空にできない」。⇒ 空欄で離れたら
//     代表値を入れる必要があり、**`onChange` では毎キーストロークで発火して
//     打ち直せなくなる**ため、確定の合図が要る。
//   ★★★これは区分の口ではない —— 本部品は代表値も区分表も受け取らない。
//     **何を埋めるかを決めるのは親であり**、本口が運ぶのは「離れた」という事実だけである。
//     ⇒ 層 2(convention test)が禁じる識別子は 1 つも増えていない。
//   ★★運び量はこの口を**渡さない**。⇒ 「運び量が埋まらない」ことは
//     呼び出し側の JSX で構造的に保証される(`D-731` 不変条件 2)。

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

type ExpectedKeys =
  | "mode"
  | "testIdPrefix"
  | "value"
  | "onChange"
  | "ariaLabel"
  | "disabled"
  | "onBlur";

describe("MassPercentInput の props は固定である(破壊確認 層 1)", () => {
  it("props は 7 個ちょうどで、区分の口が 1 つも無い", () => {
    // ★const へ束ねて expect に読ませる(noUnusedLocals: true のため)。
    const keysAreExact: Equal<keyof MassPercentInputProps, ExpectedKeys> = true;
    expect(keysAreExact).toBe(true);
  });

  // ★★mode が区分を通す抜け道にならないことを固定する。
  it("mode は mass / percent の 2 値だけで、band を採れない", () => {
    const modeIsExact: Equal<MassPercentInputProps["mode"], "mass" | "percent"> =
      true;
    expect(modeIsExact).toBe(true);
  });
});

// ── 動作 ────────────────────────────────────────────────────────────────

/** 制御コンポーネントとして親の state を持つ薄いラッパ。 */
function Harness({
  initial = "",
  mode = "mass",
}: {
  initial?: string;
  mode?: "mass" | "percent";
}) {
  const [mass, setMass] = useState(initial);
  return (
    <>
      <MassPercentInput
        mode={mode}
        testIdPrefix="t-mass"
        value={mass}
        onChange={setMass}
        ariaLabel="入力欄"
      />
      <output data-testid="t-out">{mass === "" ? "(empty)" : mass}</output>
    </>
  );
}

const box = () => screen.getByLabelText("入力欄") as HTMLInputElement;
const out = () => screen.getByTestId("t-out").textContent;

describe("1 項目だけを描く(2026-09-13 開発者裁定)", () => {
  it("mass では 1 欄だけ出る", () => {
    render(<Harness mode="mass" />);
    expect(screen.getAllByRole("spinbutton")).toHaveLength(1);
    expect(screen.getByText("/ 160 マス")).toBeTruthy();
  });

  it("percent でも 1 欄だけ出る", () => {
    render(<Harness mode="percent" />);
    expect(screen.getAllByRole("spinbutton")).toHaveLength(1);
    expect(screen.getByText("%")).toBeTruthy();
  });

  // ★★保存される値は方式に依らずマス数 1 本である(D-731)。
  it("★パーセントで入力しても、外へ出るのはマス数である", async () => {
    const user = userEvent.setup();
    render(<Harness mode="percent" />);
    await user.type(box(), "25");
    expect(out()).toBe("40"); // 25% = 40 マス
  });

  it("同じ値をどちらの方式でも表せる(160 ⇄ 100%)", () => {
    const { unmount } = render(<Harness mode="mass" initial="160" />);
    expect(box().value).toBe("160");
    unmount();
    render(<Harness mode="percent" initial="160" />);
    expect(box().value).toBe("100");
  });
});

describe("★値域外は画面に入らない(2026-09-13 開発者裁定・要望 1a)", () => {
  it("マス欄は 161 を 160 へ丸める", async () => {
    const user = userEvent.setup();
    render(<Harness mode="mass" />);
    await user.type(box(), "161");
    expect(out()).toBe("160");
    expect(box().value).toBe("160");
  });

  it("マス欄は負値を入れられない(負号がタイプできない)", async () => {
    const user = userEvent.setup();
    render(<Harness mode="mass" />);
    await user.type(box(), "-5");
    expect(out()).toBe("5");
  });

  // ★貼り付け等でタイプを経由せずに入った場合もクランプが効くこと。
  it("★マス欄は貼り付けの -1 も 0 へ丸める", async () => {
    const user = userEvent.setup();
    render(<Harness mode="mass" />);
    await user.click(box());
    await user.paste("-1");
    expect(out()).toBe("0");
  });

  it("パーセント欄は 101 を 100 へ丸める", async () => {
    const user = userEvent.setup();
    render(<Harness mode="percent" />);
    await user.type(box(), "101");
    expect(out()).toBe(String(MAX_POSITION_MASS));
  });
});

describe("未入力(null)を表現できる(M37-01 §5-3)", () => {
  it("マス欄を空にできる", async () => {
    const user = userEvent.setup();
    render(<Harness mode="mass" initial="80" />);
    await user.clear(box());
    expect(out()).toBe("(empty)");
  });

  it("パーセント欄を空にできる", async () => {
    const user = userEvent.setup();
    render(<Harness mode="percent" initial="80" />);
    expect(box().value).toBe("50");
    await user.clear(box());
    expect(out()).toBe("(empty)");
  });
});

describe("丸めの向き(M37-01 §2.2-4 / チェックリスト C-4)", () => {
  // ★★表示を小数第 1 位にした理由そのものを固定する。
  //   整数 % だと 1% = 1.6 マスで往復が壊れる(constants/position.test.ts の陽性対照)。
  it("★小数第 1 位表示なら 0〜160 の全 161 値で マス → % → マス が不変", () => {
    const displayed = (mass: number) => Math.round(massToPercent(mass) * 10) / 10;
    for (let mass = 0; mass <= MAX_POSITION_MASS; mass++) {
      expect(percentToMass(displayed(mass))).toBe(mass);
    }
  });

  it("小数を含むパーセントも受け付ける(小数点がタイプできる)", async () => {
    const user = userEvent.setup();
    render(<Harness mode="percent" />);
    await user.type(box(), "62.5");
    expect(out()).toBe("100");
  });
});

// ── ★★★M37-05: onBlur の口(2026-09-13・`D-864`)─────────────────────────
//
// ★★本部品が持つのは「離れた」という事実を親へ渡すことだけである。
//   **代表値も区分も知らない。⇒ 何を埋めるかは親が決める。**
//   (層 2 の convention test が、本ファイルの実装に区分の識別子が現れないことを別途見る)
//
// ★★★2 方式で挙動が割れないことが要件である(指示書 §2.3-4)——
//   マス目で埋まってパーセンテージで埋まらない、が起きると利用者から見て一貫しない。
describe("M37-05 onBlur は 2 方式とも親へ届く", () => {
  function BlurHarness({ mode }: { mode: "mass" | "percent" }) {
    const [mass, setMass] = useState("");
    const [blurCount, setBlurCount] = useState(0);
    return (
      <>
        <MassPercentInput
          mode={mode}
          testIdPrefix="t-mass"
          value={mass}
          onChange={setMass}
          onBlur={() => setBlurCount((n) => n + 1)}
          ariaLabel="入力欄"
        />
        <button type="button">よそ</button>
        <output data-testid="t-blur">{blurCount}</output>
      </>
    );
  }
  const blurs = () => screen.getByTestId("t-blur").textContent;

  it("マス目: 欄から離れると onBlur が 1 回呼ばれる", async () => {
    const user = userEvent.setup();
    render(<BlurHarness mode="mass" />);
    await user.click(box());
    await user.click(screen.getByRole("button", { name: "よそ" }));
    expect(blurs()).toBe("1");
  });

  it("パーセンテージ: 欄から離れると onBlur が 1 回呼ばれる", async () => {
    const user = userEvent.setup();
    render(<BlurHarness mode="percent" />);
    await user.click(box());
    await user.click(screen.getByRole("button", { name: "よそ" }));
    expect(blurs()).toBe("1");
  });

  // ★★渡さない呼び出し元で落ちないこと。⇒ 運び量は本口を渡さない。
  it("★onBlur を渡さなくても離れられる(運び量の呼び出し形)", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Harness mode="mass" />
        <button type="button">よそ</button>
      </>,
    );
    await user.click(box());
    await user.click(screen.getByRole("button", { name: "よそ" }));
    expect(out()).toBe("(empty)");
  });
});

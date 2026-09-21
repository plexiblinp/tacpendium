import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useState } from "react";

import "@/lib/i18n";

import PasswordField from "./PasswordField";

// ===========================================================================
// M22-08 追補(2026-08-16 開発者要望): 非 ASCII は入力段階で落とす
// ===========================================================================
//
// ★★`PasswordField` は全 4 欄の唯一の合流点である——ログイン ／ いまのパスワード ／
// パスワードを決める ／ 新しいパスワード。ここで無条件に濾すため、欄ごとの
// 付け忘れが起きない。**opt-in の prop を作らないこと。**
// ★各欄が実際に本コンポーネントを通っていることは、LoginScreen.test.tsx と
// PasswordForms.test.tsx が欄ごとに固定している。
//
// ★★これは入力補助であって照合の検査ではない。サーバ側の照合は無検査のままである
// (M22-08 §4.1-2＝最重要ゲート 1)。

function renderField(overrides: Partial<React.ComponentProps<typeof PasswordField>> = {}) {
  const onChange = vi.fn();
  render(
    <PasswordField
      label="パスワード"
      value=""
      onChange={onChange}
      testIdPrefix="pf"
      masked={false}
      onMaskedChange={vi.fn()}
      {...overrides}
    />,
  );
  return { onChange, input: screen.getByTestId("pf-input") as HTMLInputElement };
}

describe("PasswordField の入力制限", () => {
  it.each([
    ["日本語", "ぱすわーど", ""],
    ["全角英数", "ＡＢＣ１２３", ""],
    ["全角スペース", "abc　def", "abcdef"],
    ["混在", "ｐａｓｓword１２３", "word"],
  ])("%s は落とされて親へ渡る", (_name, typed, expected) => {
    const { onChange, input } = renderField();

    fireEvent.change(input, { target: { value: typed } });

    expect(onChange).toHaveBeenCalledWith(expected);
  });

  it.each([
    ["英数", "password123"],
    ["記号を含む", "p@ssw0rd!"],
    // ★半角スペースは残す(合い言葉の形＝指示書 §4.1-3)。
    ["内側の半角スペース", "open the gate"],
  ])("%s はそのまま親へ渡る", (_name, typed) => {
    const { onChange, input } = renderField();

    fireEvent.change(input, { target: { value: typed } });

    expect(onChange).toHaveBeenCalledWith(typed);
  });

  // ★マスクしていてもしていなくても掛かること。
  // 表示切替で `type` が text / password と変わるが、除去は type に依存しない
  // ——`type="password"` の IME 自動無効化に頼れないことが、そもそもの理由である。
  it.each([
    ["表示中(type=text)", false],
    ["マスク中(type=password)", true],
  ])("%s でも落とされる", (_name, masked) => {
    const { onChange, input } = renderField({ masked });

    expect(input.type).toBe(masked ? "password" : "text");
    fireEvent.change(input, { target: { value: "ぱすpassわーど" } });

    expect(onChange).toHaveBeenCalledWith("pass");
  });
});

describe("PasswordField と IME", () => {
  // ★実際のフォームと同じく「状態を持つ親」に載せる。IME は
  //   compositionstart → change(複数) → compositionend の順で発火するため、
  //   値が実際に更新されないと確定時の挙動を確かめられない。
  function renderStateful() {
    const seen: string[] = [];
    function Harness() {
      const [value, setValue] = useState("");
      return (
        <PasswordField
          label="パスワード"
          value={value}
          onChange={(v) => {
            seen.push(v);
            setValue(v);
          }}
          testIdPrefix="pf"
          masked={false}
          onMaskedChange={vi.fn()}
        />
      );
    }
    render(<Harness />);
    return { seen, input: screen.getByTestId("pf-input") as HTMLInputElement };
  }

  // ★★変換中に 1 文字ずつ落とすと未確定文字列が壊れ、IME の状態がずれる。
  // ⇒ 変換中は素通しし(日本語がそのまま見える)、確定した時点で落とす。
  it("変換中は落とさず、確定した時点で落とす", () => {
    const { seen, input } = renderStateful();

    fireEvent.compositionStart(input);
    // 変換中の入力(未確定)。そのまま見えること。
    fireEvent.change(input, { target: { value: "ぱ" } });
    fireEvent.change(input, { target: { value: "ぱす" } });
    expect(input.value).toBe("ぱす");
    expect(seen).toEqual(["ぱ", "ぱす"]);

    // 確定。ここで落ちる。
    fireEvent.compositionEnd(input);
    expect(input.value).toBe("");
    expect(seen.at(-1)).toBe("");
  });

  // ★compositionend と最後の input の発火順序はブラウザで前後する。
  // 両方から呼ぶため冪等でなければならない。
  it("確定後に change が来ても結果が変わらない", () => {
    const { seen, input } = renderStateful();

    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: "あabcい" } });
    fireEvent.compositionEnd(input);
    // 確定後に届く input(ブラウザによっては compositionend の後に来る)。
    fireEvent.change(input, { target: { value: "あabcい" } });

    expect(input.value).toBe("abc");
    expect(seen.at(-1)).toBe("abc");
  });

  // ★変換が終わったあとの通常入力に、変換中の素通しが残らないこと
  //   (composingRef を戻し忘れると、以後ずっと濾さなくなる)。
  it("変換を終えたあとの通常入力は落とされる", () => {
    const { input } = renderStateful();

    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: "あ" } });
    fireEvent.compositionEnd(input);

    // 変換を経ずに直接入力する(貼り付け相当)。
    fireEvent.change(input, { target: { value: "ｚｅｎkaku" } });

    expect(input.value).toBe("kaku");
  });
});

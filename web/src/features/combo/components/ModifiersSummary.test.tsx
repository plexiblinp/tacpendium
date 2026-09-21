import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { ModifiersSummary } from "./ModifiersSummary";

// ★★M24-05(SM-052): コンボ側とセットプレイ側で食い違っていた 5 点を、
//   共有化した 1 本の側で固定する。ここが緑のままセットプレイ側だけ壊れることは
//   もう起きない——両者が同じ部品を呼ぶためである。
describe("ModifiersSummary", () => {
  it("flags を user 語彙のラベルへ解決する(内部コードを露出させない)", () => {
    render(<ModifiersSummary modifiers={{ flags: ["just", "link"] }} />);
    expect(screen.getByText("ジャスト")).toBeTruthy();
    expect(screen.getByText("目押し")).toBeTruthy();
    // ★旧セットプレイ側は `just` / `link` をそのまま出していた。
    expect(screen.queryByText("just")).toBeNull();
    expect(screen.queryByText("link")).toBeNull();
  });

  it("未知の flag は値をそのまま出す(握り潰さない)", () => {
    render(<ModifiersSummary modifiers={{ flags: ["unknown_flag"] }} />);
    expect(screen.getByText("unknown_flag")).toBeTruthy();
  });

  it("notes は本文を出さず ※ 記号 + ホバーで示す", () => {
    render(<ModifiersSummary modifiers={{ notes: "端限定" }} />);
    const mark = screen.getByText("※");
    expect(mark.getAttribute("title")).toBe("端限定");
    // ★旧セットプレイ側は本文を行内へ展開しており、長いメモで行が伸びていた。
    expect(screen.queryByText(/端限定/)).toBeNull();
  });

  // ★★型だけのステップ(ドライブラッシュ類)。旧セットプレイ側はここで灰バッジに
  //   `cancel_drive_rush` を出しており、主ラベルが日本語で出している同じ情報が
  //   内部コードで二重に見えていた。★これが SM-052 で実際に見えていた状態である
  //   (「中身が空のバッジ」は画面操作では作れない＝ModifiersEditor が undefined を返す)。
  it("型だけのステップでは何も描かない(主ラベルの日本語と二重にしない)", () => {
    const { container } = render(
      <ModifiersSummary modifiers={{ type: "cancel_drive_rush" }} />,
    );
    // ★旧セットプレイ側は type を内部コードのまま灰バッジへ出していた。
    expect(container.querySelector('[data-testid="modifiers-summary"]')).toBeNull();
    expect(container.textContent).toBe("");
  });

  it("modifiers 自体が無ければ何も描かない", () => {
    const { container } = render(<ModifiersSummary modifiers={undefined} />);
    expect(container.textContent).toBe("");
  });

  it("flags が空配列で notes も無ければ何も描かない", () => {
    const { container } = render(<ModifiersSummary modifiers={{ flags: [] }} />);
    expect(container.textContent).toBe("");
  });

  it("flags と notes が両方あれば両方出す", () => {
    render(<ModifiersSummary modifiers={{ flags: ["delay"], notes: "めくり" }} />);
    expect(screen.getByText("ディレイ")).toBeTruthy();
    expect(screen.getByText("※").getAttribute("title")).toBe("めくり");
  });
});

// ============================================================================
// M37-06 §5-4: 削除の安全性(破壊確認)。編集画面のバッジ側でも見る。
//
// ★★★選択肢から外した 3 値を持つ既存行を描いて、内部コードが出ないこと。
//   ⇒ 本部品のフォールバックは `?? f` であり、**波括弧すら付かない生コード**が出る
//     (Go 側の `{just}` とは露出の形が違う)。⇒ 両方で見る必要がある。
// ============================================================================
describe("M37-06 選択肢から外した flag の表示(破壊確認)", () => {
  it("★★★外した 3 値でも内部コードではなく表示語が出る", () => {
    render(
      <ModifiersSummary
        modifiers={{ flags: ["just", "neutral_jump", "forward_jump"] }}
      />,
    );
    for (const [code, label] of [
      ["just", "ジャスト"],
      ["neutral_jump", "垂直ジャンプ中"],
      ["forward_jump", "前ジャンプ中"],
    ]) {
      expect(screen.getByText(label)).toBeTruthy();
      expect(screen.queryByText(code)).toBeNull();
    }
  });

  // ★逆向き —— 表示語を持たない値はフォールバックで生コードが出ること。
  //   これが無いと、上の 1 件は「表示語が在るから緑」なのか「何も見ていないから緑」なのか
  //   区別できない(Go 側 flagtext_internal_test.go と同じ流儀)。
  it("★逆向き: 表示語を持たない値は生コードのまま出る(検査が効いている証拠)", () => {
    render(<ModifiersSummary modifiers={{ flags: ["totally_unknown_flag"] }} />);
    expect(screen.getByText("totally_unknown_flag")).toBeTruthy();
  });

  // ★M37-06 §5-5: link と no_cancel は排他ではない。両方付いた行が両方描かれること。
  it("★link と no_cancel が両方描かれる(排他ではない)", () => {
    render(<ModifiersSummary modifiers={{ flags: ["link", "no_cancel"] }} />);
    expect(screen.getByText("目押し")).toBeTruthy();
    expect(screen.getByText("ノーキャン")).toBeTruthy();
  });
});

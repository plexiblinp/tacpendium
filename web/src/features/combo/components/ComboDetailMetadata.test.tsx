// M17-01: メディア 3 フィールドの表示テスト。
// link の http/https リンク化・危険スキーム(javascript: 等)の非リンク化(XSS 無害化)・
// path 2 種のテキスト表示・NULL 時のセクション非表示を検証する。

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import "@/lib/i18n";
import type { ComboDetail } from "../types";
import ComboDetailMetadata from "./ComboDetailMetadata";

const makeCombo = (overrides: Partial<ComboDetail> = {}): ComboDetail => ({
  id: 1,
  characterId: 1,
  isDraft: false,
  affectedByGameUpdate: false,
  affectedMoves: [],
  stepCount: 2,
  defaultRecipe: "5LP > 236P",
  starterMoveCode: "5LP",
  version: 1,
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
  tags: [],
  ...overrides,
});

describe("ComboDetailMetadata — メディア表示(M17-01)", () => {
  it("http/https の link は rel/target 付きアンカーでリンク化される", () => {
    render(
      <ComboDetailMetadata
        combo={makeCombo({ link: "https://example.com/guide" })}
      />,
    );
    const a = document.querySelector('a[href="https://example.com/guide"]');
    expect(a).toBeTruthy();
    expect(a?.getAttribute("rel")).toBe("noopener noreferrer");
    expect(a?.getAttribute("target")).toBe("_blank");
    expect(a?.textContent).toBe("https://example.com/guide");
  });

  it("危険スキーム(javascript: 等)の link はリンク化されずテキスト表示(無害化)", () => {
    render(
      <ComboDetailMetadata combo={makeCombo({ link: "javascript:alert(1)" })} />,
    );
    // アンカーは生成されない。
    expect(document.querySelector("a")).toBeNull();
    // 値そのものはテキストとして表示される。
    expect(screen.getByTestId("combo-detail-link").textContent).toBe(
      "javascript:alert(1)",
    );
  });

  it("videoPath / imagePath は常にテキスト表示(リンク化・遷移なし)", () => {
    render(
      <ComboDetailMetadata
        combo={makeCombo({
          videoPath: "videos/ryu-bnb.mp4",
          imagePath: "images/ryu-bnb.png",
        })}
      />,
    );
    expect(document.querySelector("a")).toBeNull();
    expect(screen.getByTestId("combo-detail-video-path").textContent).toBe(
      "videos/ryu-bnb.mp4",
    );
    expect(screen.getByTestId("combo-detail-image-path").textContent).toBe(
      "images/ryu-bnb.png",
    );
    // 画像実体の読込(<img>)もしない(文字列参照まで)。
    expect(document.querySelector("img")).toBeNull();
  });

  it("メディア 3 フィールドがすべて NULL のときはメディアセクション自体を表示しない", () => {
    render(<ComboDetailMetadata combo={makeCombo()} />);
    expect(screen.queryByTestId("combo-detail-link")).toBeNull();
    expect(screen.queryByTestId("combo-detail-video-path")).toBeNull();
    expect(screen.queryByTestId("combo-detail-image-path")).toBeNull();
    // 見出し「メディア」も出ない(i18n 既定 = ja)。
    expect(screen.queryByText("メディア")).toBeNull();
  });

  it("一部のみ値がある場合、その項目だけ表示される", () => {
    render(
      <ComboDetailMetadata combo={makeCombo({ link: "https://example.com" })} />,
    );
    expect(screen.getByTestId("combo-detail-link")).toBeTruthy();
    expect(screen.queryByTestId("combo-detail-video-path")).toBeNull();
    expect(screen.queryByTestId("combo-detail-image-path")).toBeNull();
  });
});

// ★★M27-02b 追補(P4M-011): 「起き攻めを調べたか」は**行の有無によらず**詳細に出る。
//
// ★見るのは **行があるとき**である——当初の実装は「行が 1 つも無いとき」だけ
//   okiVerified を読んでおり、**利用者が実際に踏む経路(チェックを付けて登録した)で
//   フラグが不可視だった**(2026-09-05 実機確認で発覚)。⇒ 穴のあった側を固定する。
describe("ComboDetailMetadata — 起き攻めを調べたか(M27-02b / P4M-011)", () => {
  const withOption = { attackType: "shimmy", techType: "back_tech", usesDr: false };

  it("★起き攻めの行があっても「検証済み」が出る", () => {
    render(
      <ComboDetailMetadata
        combo={makeCombo({ okiOptions: [withOption], okiVerified: true })}
      />,
    );
    const badge = screen.getByTestId("combo-detail-oki-verified");
    expect(badge.getAttribute("data-state")).toBe("verified");
    expect(badge.textContent).toBe("検証済み");
  });

  it("★★行があっても okiVerified=false なら「未検証」と出る(解除ガードを通した状態)", () => {
    render(
      <ComboDetailMetadata
        combo={makeCombo({ okiOptions: [withOption], okiVerified: false })}
      />,
    );
    const badge = screen.getByTestId("combo-detail-oki-verified");
    expect(badge.getAttribute("data-state")).toBe("unverified");
    expect(badge.textContent).toBe("未検証");
  });

  it("行が無いときは、印に加えて『空である理由』の文が出る", () => {
    const { rerender } = render(
      <ComboDetailMetadata combo={makeCombo({ okiOptions: [], okiVerified: true })} />,
    );
    expect(
      screen.getByTestId("combo-detail-oki-verified").getAttribute("data-state"),
    ).toBe("verified");
    expect(screen.getByText(/調べましたが/)).toBeTruthy();

    rerender(
      <ComboDetailMetadata combo={makeCombo({ okiOptions: [], okiVerified: false })} />,
    );
    expect(
      screen.getByTestId("combo-detail-oki-verified").getAttribute("data-state"),
    ).toBe("unverified");
    expect(screen.getByText(/まだ調べていません/)).toBeTruthy();
  });
});

// ★★M27-03(SD-009) レビュー(中-4): 詳細画面の符号表示に検査が無かった。
//
// 完了報告 §2.4 は「詳細・ゴミ箱詳細・エクスポートの 3 面を揃えた」ことを主張の柱に
// している。⇒ **詳細とエクスポートの両方に同じ形の検査を置き、片面だけ変わる退行を
// 機械で止める**(対になる検査は `features/combo-io/export-model.test.ts`)。
//
// ★本ファイルは実物の i18n を読み込んでいる(`import "@/lib/i18n"`)ため ja の文言で見る。
describe("ComboDetailMetadata — ドライブダメージの符号(M27-03 / SD-009)", () => {
  function driveDamageText(driveDamage: number | undefined): string {
    render(<ComboDetailMetadata combo={makeCombo({ driveDamage })} />);
    // dt(ラベル)の隣の dd を読む。
    const dt = screen.getByText("ドライブダメージ");
    return dt.parentElement?.textContent ?? "";
  }

  it("★負はそのままで「削り」を添える", () => {
    const text = driveDamageText(-2.5);
    expect(text).toContain("-2.5");
    expect(text).toContain("削り");
  });

  it("★正は + を付けて「回復」を添える", () => {
    const text = driveDamageText(1);
    expect(text).toContain("+1");
    expect(text).toContain("回復");
  });

  it("★0 には符号も語も付けない", () => {
    const text = driveDamageText(0);
    expect(text).not.toContain("+");
    expect(text).not.toContain("削り");
    expect(text).not.toContain("回復");
  });

  it("★マイナスを許容する理由が ⓘ から読める", () => {
    render(<ComboDetailMetadata combo={makeCombo({ driveDamage: -1 })} />);
    expect(screen.getByTestId("info-mark-drive-damage")).toBeTruthy();
  });
});

// ══════════════════════════════════════════════════════════════════════════
// M37-01: 運び量の表示(指示書 §2.3-1)
// ══════════════════════════════════════════════════════════════════════════
describe("ComboDetailMetadata — 運び量(M37-01)", () => {
  const carry = () =>
    screen.getByTestId("combo-detail-carry-distance-mass").textContent;

  it("マス数とパーセントを、入力欄と同じ丸めで出す", () => {
    render(<ComboDetailMetadata combo={makeCombo({ carryDistanceMass: 45 })} />);
    // 45 / 160 = 28.125% → 小数第 1 位で 28.1(MassPercentInput の表示と同じ規則)。
    expect(carry()).toBe("45 マス (28.1%)");
  });

  it("端点(0 / 160)", () => {
    const { unmount } = render(
      <ComboDetailMetadata combo={makeCombo({ carryDistanceMass: 0 })} />,
    );
    expect(carry()).toBe("0 マス (0%)");
    unmount();
    render(<ComboDetailMetadata combo={makeCombo({ carryDistanceMass: 160 })} />);
    expect(carry()).toBe("160 マス (100%)");
  });

  it("未入力は「-」で出す(他の任意欄と同じ)", () => {
    render(<ComboDetailMetadata combo={makeCombo({})} />);
    expect(carry()).toBe("-");
  });

  // ★★★D-731 の不変条件 2 —— 運び量は区分を持たない。
  //   詳細画面でも区分名を出さないことを固定する(出すと「丸めてよい」に見える)。
  it("★運び量に区分名を出さない", () => {
    render(
      <ComboDetailMetadata combo={makeCombo({ carryDistanceMass: 155 })} />,
    );
    // 155 は「相手画面端」の域だが、区分名は出さない。
    expect(carry()).not.toContain("相手画面端");
    expect(carry()).toBe("155 マス (96.9%)");
  });
});

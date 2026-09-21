import { describe, expect, it } from "vitest";

import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  normalizePassword,
  passwordRuleMessageKey,
  stripNonPrintableASCII,
  validateNewPassword,
} from "./passwordRules";

// ★サーバ側(internal/service/auth/validate_test.go)と対の内容にしてある。
// 片方だけ通る状態はドリフトであり、画面とサーバで判定が割れることを意味する。

describe("normalizePassword", () => {
  it.each([
    ["変化なし", "plain", "plain"],
    ["半角の前後空白", "  plain  ", "plain"],
    ["タブと改行", "\tplain\n", "plain"],
    // ★全角スペース(U+3000)も落ちる。String.prototype.trim が Unicode の空白を扱う。
    ["全角スペース", "　plain　", "plain"],
    ["内側の空白は残す", "  open the gate  ", "open the gate"],
    ["空白だけ", "   ", ""],
    ["空文字", "", ""],
  ])("%s", (_name, input, expected) => {
    expect(normalizePassword(input)).toBe(expected);
  });
});

// ===========================================================================
// stripNonPrintableASCII — 入力段階の除去(2026-08-16 開発者要望)
// ===========================================================================
//
// ★★これは「入力補助」であって「照合の検査」ではない。サーバ側の照合には
// 何も掛かっていない(M22-08 §4.1-2＝最重要ゲート 1)。
// ★★落とすのは「印字可能な ASCII 以外」だけである。長さ等の規則に連動させると、
// 将来その規則を変えたときに締め出しが起きる(CHANGE-119 §2-b の理由②)。

describe("stripNonPrintableASCII — 落とすもの", () => {
  it.each([
    ["ひらがな", "ぱすわーど", ""],
    ["漢字", "合言葉", ""],
    ["全角英数", "ＡＢＣ１２３", ""],
    ["全角スペース", "abc　def", "abcdef"],
    ["絵文字", "pass😀word", "password"],
    ["アクセント付きラテン", "pässword", "pssword"],
    ["制御文字(U+001F)", "pass\u001Fword", "password"],
    ["DEL(U+007F)", "pass\u007Fword", "password"],
    ["BOM(U+FEFF)", "password\uFEFF", "password"],
    ["改行", "pass\nword", "password"],
    ["日本語だけ", "にほんご", ""],
  ])("%s", (_name, input, expected) => {
    expect(stripNonPrintableASCII(input)).toBe(expected);
  });
});

describe("stripNonPrintableASCII — 残すもの", () => {
  it.each([
    ["英数", "password123"],
    ["記号", "p@ssw0rd!\"#$%&'()*+,-./:;<=>?[\\]^_{|}~"],
    // ★半角スペースは残す(合い言葉の形＝指示書 §4.1-3)。前後の空白の除去は
    //   normalizePassword の担当であり、除去とは別物である。
    ["内側の半角スペース", "open the gate"],
    ["前後の半角スペース", "  spaced  "],
    ["境界の下端(U+0020)", "    "],
    ["境界の上端(U+007E)", "~~~~"],
    ["空文字", ""],
  ])("%s はそのまま", (_name, input) => {
    expect(stripNonPrintableASCII(input)).toBe(input);
  });

  // ★冪等であること。onChange と compositionEnd の両方から呼ぶため、
  //   二重に掛かっても結果が変わらないことが前提になっている。
  it("冪等である(二度掛けても変わらない)", () => {
    const once = stripNonPrintableASCII("ａbcあdef　gh");
    expect(stripNonPrintableASCII(once)).toBe(once);
    expect(once).toBe("bcdefgh");
  });

  // ★g フラグ付き正規表現を使い回しているため、lastIndex の持ち越しで
  //   2 回目以降が壊れないことを固定する。
  it("連続して呼んでも結果が変わらない", () => {
    for (let i = 0; i < 3; i++) {
      expect(stripNonPrintableASCII("あabcい")).toBe("abc");
    }
  });
});

describe("validateNewPassword — 文字種(VAL-N05)", () => {
  it.each([
    ["ひらがな", "ぱすわーど"],
    ["漢字", "合言葉です"],
    ["全角英数", "ＡＢＣ１２３"],
    ["全角スペースを内側に含む", "abc　def"],
    ["絵文字", "pass😀word"],
    ["アクセント付きラテン", "pässword"],
  ])("拒否: %s", (_name, input) => {
    expect(validateNewPassword(input)).toBe("charset");
  });

  it.each([
    ["英数", "password123"],
    ["記号", "p@ssw0rd!\"#$%&'()*+,-./:;<=>?[\\]^_{|}~"],
    // ★半角スペースは受け付ける(合い言葉の形を残すため＝指示書 §4.1-3)。
    ["内側の半角スペース", "open the gate"],
    ["境界の上端(U+007E)", "~~~~"],
  ])("許可: %s", (_name, input) => {
    expect(validateNewPassword(input)).not.toBe("charset");
  });
});

describe("validateNewPassword — 長さ(VAL-N06)", () => {
  it.each([
    ["下限より 1 文字短い", "a".repeat(PASSWORD_MIN_LENGTH - 1), "tooShort"],
    ["下限ちょうど", "a".repeat(PASSWORD_MIN_LENGTH), null],
    ["上限ちょうど", "a".repeat(PASSWORD_MAX_LENGTH), null],
    ["上限より 1 文字長い", "a".repeat(PASSWORD_MAX_LENGTH + 1), "tooLong"],
    ["空文字", "", "tooShort"],
  ])("%s", (_name, input, expected) => {
    expect(validateNewPassword(input)).toBe(expected);
  });

  // ★前後の空白を除いてから数える(指示書 §4.1-4)。
  it("前後の空白を除くと下限を割る値は拒否される", () => {
    expect(validateNewPassword("   ab   ")).toBe("tooShort");
  });

  it("前後の空白を除けば下限を満たす値は通る", () => {
    expect(validateNewPassword("   abcd   ")).toBeNull();
  });
});

// ★順序が入れ替わると、日本語のパスワードに「4 文字以上で決めてください」と出て、
// 利用者は日本語が原因だと分からない(指示書 §4.4 末尾)。
describe("validateNewPassword — 判定の順序", () => {
  it("非 ASCII かつ長さも範囲外なら、文字種として報告する", () => {
    expect(validateNewPassword("あい")).toBe("charset");
  });
});

describe("passwordRuleMessageKey", () => {
  it("違反の種類ごとに別のキーを返す", () => {
    const keys = [
      passwordRuleMessageKey("charset"),
      passwordRuleMessageKey("tooShort"),
      passwordRuleMessageKey("tooLong"),
    ];
    expect(new Set(keys).size).toBe(3);
    // ★i18n の実キーに合わせてリテラルで固定する。キー名が変わればここが赤くなる。
    expect(keys).toEqual([
      "auth.setPassword.errorCharset",
      "auth.setPassword.errorTooShort",
      "auth.setPassword.errorTooLong",
    ]);
  });
});

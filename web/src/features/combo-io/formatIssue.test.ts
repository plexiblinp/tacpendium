import { describe, expect, it } from "vitest";

import ja from "@/locales/ja.json";

import { formatIssue, parseIssue, type TFunc } from "./formatIssue";

describe("parseIssue", () => {
  it("[CODE] column: message を分解する", () => {
    const p = parseIssue('[VAL-ENUM] opponent_size: unknown opponent_size value "xl"');
    expect(p.code).toBe("VAL-ENUM");
    expect(p.column).toBe("opponent_size");
    expect(p.message).toBe('unknown opponent_size value "xl"');
  });

  it("[CODE] message(列なし)を分解する", () => {
    const p = parseIssue("[VAL-I02] input is not valid UTF-8");
    expect(p.code).toBe("VAL-I02");
    expect(p.column).toBeNull();
    expect(p.message).toBe("input is not valid UTF-8");
  });

  it("本文中のコロンを列と誤検出しない", () => {
    const p = parseIssue("[VAL-I04] ignored unknown column(s): tags");
    expect(p.code).toBe("VAL-I04");
    expect(p.column).toBeNull();
    expect(p.message).toBe("ignored unknown column(s): tags");
  });

  it("角括弧で始まらない(既に日本語)文字列は code=null", () => {
    const raw = "既存コンボ(ID 3)と重複(VAL-C02)";
    const p = parseIssue(raw);
    expect(p.code).toBeNull();
    expect(p.message).toBe(raw);
  });
});

// マッピングを持つ t スタブ: 定義済みキーは日本語を返し、未定義は defaultValue を返す。
//
// ★★M29-01: 着手前は文面を**このファイルへ直書き**していた
//   (`"comboImport.col.opponent_size": "相手の体格"`)。
//   ⇒ ja.json 側の語を直しても本テストは緑のままで、**失効した語がテストに
//     残り続ける**形だった(語彙統一で実際に踏んだ)。実 ja.json から引く。
const table: Record<string, string> = {
  "comboImport.val.VAL-ENUM": ja.comboImport.val["VAL-ENUM"],
  "comboImport.col.opponent_size": ja.comboImport.col.opponent_size,
  // ★M29-02: ファイルレベルのエラー(VAL-I03)も実 ja.json から引く。
  //   直書きすると ja.json 側を直したときにテストが緑のまま失効する(上のコメント)。
  "comboImport.val.VAL-I03": ja.comboImport.val["VAL-I03"],
};
const t: TFunc = (key, opts) => {
  const tmpl = table[key];
  if (tmpl === undefined) return (opts?.defaultValue as string) ?? key;
  return tmpl
    .replace("{{col}}", String(opts?.col ?? ""))
    .replace("{{row}}", String(opts?.row ?? ""));
};

describe("formatIssue", () => {
  it("写像済みコードは日本語(列ラベル・行番号を補間)に変換する", () => {
    const out = formatIssue(
      '[VAL-ENUM] opponent_size: unknown opponent_size value "xl"',
      3,
      t,
    );
    expect(out).toBe(`${ja.comboImport.col.opponent_size}に未知の値があります(3行目)`);
  });

  it("未写像コードは英語原文へフォールバックする", () => {
    const raw = "[VAL-XYZ] some untranslated message";
    expect(formatIssue(raw, 1, t)).toBe(raw);
  });

  it("角括弧なし(既に日本語)はそのまま返す", () => {
    const raw = "既存コンボ(ID 3)と重複(VAL-C02)";
    expect(formatIssue(raw, 2, t)).toBe(raw);
  });

  it("未定義の列ラベルは snake_case 原文で埋める", () => {
    const table2: Record<string, string> = {
      "comboImport.val.VAL-I06": "{{col}}が不正です",
    };
    const t2: TFunc = (key, opts) => {
      const tmpl = table2[key];
      if (tmpl === undefined) return (opts?.defaultValue as string) ?? key;
      return tmpl.replace("{{col}}", String(opts?.col ?? ""));
    };
    const out = formatIssue('[VAL-I06] character_code: unknown character_code "x"', 1, t2);
    expect(out).toBe("character_codeが不正です");
  });

  // ★★M29-02 §2.1(付随): ファイルレベルのエラーが訳に当たること。
  //
  // 着手前は BE がファイルレベルだけ `[CODE]` を落として渡していたため、
  // ja.json に "VAL-I03": "行数が上限を超えています" が在るのに一度も出ず、
  // 画面には英語の `row count exceeds limit 1000` が出ていた。
  // ★鳴ってはいたが読めなかった。だからテストも lint も緑のまま通った。
  it("★ファイルレベルの VAL-I03 を訳に当てる(接頭辞が落ちていると当たらない)", () => {
    // ★実 ja.json を引く t を使う。直書きすると ja.json を直しても緑のままになる。
    expect(formatIssue("[VAL-I03] row count exceeds limit 1000", 0, t)).toBe(
      ja.comboImport.val["VAL-I03"],
    );
  });

  it("接頭辞が無いと訳に当たらない(着手前の形の再現)", () => {
    // ★これが着手前に画面へ出ていた文字列である(英語のまま)。
    expect(formatIssue("row count exceeds limit 1000", 0, t)).toBe(
      "row count exceeds limit 1000",
    );
  });
});

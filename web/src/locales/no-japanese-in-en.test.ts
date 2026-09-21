import { describe, expect, it } from "vitest";

import en from "./en.json";

// ★★M24-07 §5.1-2: 英語ロケールに日本語が残っていないこと。
//
// 本サブの目的の半分は「英語 UI でも日本語が出る」を消すことである。
// ⇒ その状態へ戻ったことを機械で検出できるようにする。
//
// ★作法は forbidden-words.test.ts に倣う —— 辞書そのものを再帰的に平坦化して走査し、
//   新しい文言を足せば自動で網に入る形にする(1 組だけレンダリングして見る形にしない)。
//
// ★★例外は**このファイルへ書く**。コメントで済ませない ——
//   コメントだけだと、次の担当が「なぜ日本語なのか」を判断できず、消すか放置するかの
//   どちらかになる。ここに書いてあれば、増えたときに必ずこのテストが赤くなる。

function flatten(obj: Record<string, unknown>, prefix = ""): Array<[string, string]> {
  return Object.entries(obj).flatMap(([key, value]) =>
    typeof value === "object" && value !== null
      ? flatten(value as Record<string, unknown>, `${prefix}${key}.`)
      : [[`${prefix}${key}`, String(value)] as [string, string]],
  );
}

// ひらがな・カタカナ・CJK 統合漢字。和文の約物(「」・〜 等)も範囲に含める。
const JAPANESE = /[　-〿぀-ゟ゠-ヿ㐀-䶿一-鿿！-｠]/;

/**
 * 意図して日本語のままにしているキーの一覧。
 *
 * ★足すときは理由を必ず添えること。「英語 UI で日本語が出る」を許す判断であり、
 *   理由の無い追加は本テストを骨抜きにする。
 */
const ALLOWED: ReadonlyArray<{ key: string; reason: string }> = [
  {
    key: "settings.basic.languageJa",
    reason:
      "言語選択の選択肢そのもの。日本語を選ぶ項目は日本語で出すのが正しい(英語話者にも読める必要がある)",
  },
];

const ALLOWED_KEYS = new Set(ALLOWED.map((a) => a.key));

describe("英語ロケールに日本語が出ない(M24-07 §5.1-2)", () => {
  const entries = flatten(en);

  it("★走査対象が空でない(陽性対照)", () => {
    // ★「0 件だった」は「無い」ではなく「走査が壊れている」かもしれない(E-84)。
    expect(entries.length).toBeGreaterThan(500);
  });

  it("★★例外一覧に無いキーの値に日本語が含まれない", () => {
    const violations = entries
      .filter(([key]) => !ALLOWED_KEYS.has(key))
      .filter(([, value]) => JAPANESE.test(value))
      .map(([key, value]) => `${key} = ${value}`);
    expect(violations).toEqual([]);
  });

  it("★例外一覧が実態と合っている(消えたキーを残さない)", () => {
    // ★許可したまま実体が消えると、例外だけが積み上がって意味を失う。
    const known = new Set(entries.map(([key]) => key));
    const stale = ALLOWED.filter((a) => !known.has(a.key)).map((a) => a.key);
    expect(stale).toEqual([]);
  });

  it("★例外は実際に日本語を含んでいる(不要な例外を残さない)", () => {
    const byKey = new Map(entries);
    const unnecessary = ALLOWED.filter((a) => {
      const value = byKey.get(a.key);
      return value !== undefined && !JAPANESE.test(value);
    }).map((a) => a.key);
    expect(unnecessary).toEqual([]);
  });

  it("★すべての例外に理由が書かれている", () => {
    expect(ALLOWED.filter((a) => a.reason.trim().length === 0)).toEqual([]);
  });
});

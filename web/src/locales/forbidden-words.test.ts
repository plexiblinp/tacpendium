import { describe, expect, it } from "vitest";

import ja from "./ja.json";
import en from "./en.json";

// 競合まわりの文言の禁則語検査(M22-04 §4.5・CHANGE-113 §6.1)。
//
// ★ConflictDialog.test.tsx にも同種の主張はあるが、あちらが走査できるのは
//   「その時レンダリングした 1 組」だけである(versionConflict × combo)。
//   2 段目のダイアログは別の testid のため textContent に含まれず、notFound・
//   setup・duplicateSetup の文言も網に入らない。
//   ⇒ 本ファイルは辞書そのものを再帰的に平坦化して走査する。新しい文言を足せば
//     自動で網に入る形にしてある(locales.test.ts の parity 検査と同じ考え方)。

function flatten(obj: Record<string, unknown>, prefix = ""): Array<[string, string]> {
  return Object.entries(obj).flatMap(([key, value]) =>
    typeof value === "object" && value !== null
      ? flatten(value as Record<string, unknown>, `${prefix}${key}.`)
      : [[`${prefix}${key}`, String(value)] as [string, string]],
  );
}

const jaConflict = flatten(ja).filter(([k]) => k.startsWith("conflict."));
const enConflict = flatten(en).filter(([k]) => k.startsWith("conflict."));

describe("conflict.* の文言(ja)", () => {
  it("★走査対象が空でない(陽性対照)", () => {
    // ★「0 件だった」は「無い」ではなく「走査が壊れている」かもしれない(E-84)。
    expect(jaConflict.length).toBeGreaterThan(10);
  });

  // ★§4.5-5: 説明なしに使わない。「ほかの人が変更した」で足りる。
  it.each(["バージョン", "排他", "競合", "コンフリクト"])(
    "「%s」を使わない",
    (word) => {
      const hits = jaConflict.filter(([, v]) => v.includes(word));
      expect(hits).toEqual([]);
    },
  );

  // ★契約 F-3: 平文 HTTP の LAN 構成であり「安全です」とは書けない。
  it("「安全」と書かない", () => {
    expect(jaConflict.filter(([, v]) => v.includes("安全"))).toEqual([]);
  });

  // ★§4.3-6 / FR501: 版不一致は「失敗」ではなく「防いだ」場面である。
  it.each(["エラー", "失敗"])("「%s」と書かない", (word) => {
    expect(jaConflict.filter(([, v]) => v.includes(word))).toEqual([]);
  });
});

describe("conflict.* の文言(en)", () => {
  it("★走査対象が空でない(陽性対照)", () => {
    expect(enConflict.length).toBeGreaterThan(10);
  });

  it.each(["version", "conflict", "optimistic", "lock"])(
    "技術用語 %s を使わない",
    (word) => {
      const hits = enConflict.filter(([, v]) => v.toLowerCase().includes(word));
      expect(hits).toEqual([]);
    },
  );

  it.each(["error", "fail", "safe"])("「%s」と書かない", (word) => {
    const hits = enConflict.filter(([, v]) => v.toLowerCase().includes(word));
    expect(hits).toEqual([]);
  });
});

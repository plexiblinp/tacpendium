import { describe, expect, it } from "vitest";
import type { TFunction } from "i18next";

import ja from "@/locales/ja.json";
import type { ValidationIssue } from "@/features/combo/types";
import {
  VAL_C08_MOVE_EXISTS,
  VAL_R01_LINKED_SETUPS_DELETED,
  VAL_R02_ALL_PARENT_COMBOS_DELETED,
  VAL_S03_MOVE_EXISTS,
  formatBulkRestoreDetail,
  formatBulkRestoreSummary,
  formatRestoreWarning,
  formatRestoreWarnings,
} from "./restoreWarnings";
import { warningRefEntries } from "./warningDetails";

// 純粋関数の単体テスト(CLAUDE.md §5「フロント純粋関数は必須」)。
//
// ★実 ja.json を引く最小の t を使う。キーをそのまま返すモックだと
// 「翻訳キーが実在すること」も「{{count}} が差し込まれること」も判定できない。
const t = ((key: string, vars?: Record<string, unknown>) => {
  const raw = key
    .split(".")
    .reduce<unknown>((acc, k) => (acc as Record<string, unknown> | undefined)?.[k], ja);
  if (typeof raw !== "string") return key;
  return raw.replace(/\{\{(\w+)\}\}/g, (_m, name: string) => String(vars?.[name] ?? ""));
}) as unknown as TFunction;

function issue(code: string, details?: ValidationIssue["details"]): ValidationIssue {
  return { code, severity: "warning", message: "サーバ側の診断文", details };
}

describe("formatRestoreWarning", () => {
  it("VAL-R01: details.setups の件数を差し込む", () => {
    const out = formatRestoreWarning(
      issue(VAL_R01_LINKED_SETUPS_DELETED, { setups: [{ id: 1 }, { id: 2 }] }),
      t,
    );
    expect(out).toContain("2");
    expect(out).toContain("セットプレイ");
    // ★サーバの message を出していないこと(§4.3-4)。
    expect(out).not.toContain("サーバ側の診断文");
  });

  it("VAL-R02: details.combos の件数を差し込む", () => {
    const out = formatRestoreWarning(
      issue(VAL_R02_ALL_PARENT_COMBOS_DELETED, { combos: [{ id: 9 }] }),
      t,
    );
    expect(out).toContain("1");
    expect(out).toContain("親コンボ");
  });

  it("details が無くても落ちない(件数 0 として扱う)", () => {
    expect(() => formatRestoreWarning(issue(VAL_R01_LINKED_SETUPS_DELETED), t)).not.toThrow();
    expect(formatRestoreWarning(issue(VAL_R01_LINKED_SETUPS_DELETED), t)).toContain("0");
  });

  it.each([VAL_C08_MOVE_EXISTS, VAL_S03_MOVE_EXISTS])(
    "%s: 技不在は共通の文面へ落ちる",
    (code) => {
      expect(formatRestoreWarning(issue(code), t)).toContain("存在しない技");
    },
  );

  // ★未知コードを黙って消さない。将来 VAL-R03 以降が足されたとき、画面が何も
  //   出さないと「警告が出ていない」と読まれてしまう。
  it("未知コードでも空文字にならず、コードが文面に残る", () => {
    const out = formatRestoreWarning(issue("VAL-R99"), t);
    expect(out.length).toBeGreaterThan(0);
    expect(out).toContain("VAL-R99");
  });
});

describe("formatRestoreWarnings", () => {
  it("複数コードは / で連結する", () => {
    const out = formatRestoreWarnings(
      [
        issue(VAL_R01_LINKED_SETUPS_DELETED, { setups: [{ id: 1 }] }),
        issue(VAL_C08_MOVE_EXISTS),
      ],
      t,
    );
    expect(out).toContain(" / ");
  });

  // ★VAL-C08 / VAL-S03 はステップ単位で発火する。同一文を並べても利用者に
  //   増える情報が無いため畳む。
  it("同一の文面は 1 回だけ出す(ステップ単位の発火で連結されない)", () => {
    const out = formatRestoreWarnings(
      [issue(VAL_C08_MOVE_EXISTS), issue(VAL_C08_MOVE_EXISTS), issue(VAL_C08_MOVE_EXISTS)],
      t,
    );
    expect(out).not.toContain(" / ");
  });

  it("0 件なら空文字", () => {
    expect(formatRestoreWarnings([], t)).toBe("");
  });
});

describe("formatBulkRestoreSummary", () => {
  it("警告 0 件なら復元件数だけを出す", () => {
    const out = formatBulkRestoreSummary(3, 0, t);
    expect(out).toContain("3");
    expect(out).not.toContain("注意");
  });

  it("警告があるときは復元件数と警告件数の両方を出す", () => {
    const out = formatBulkRestoreSummary(5, 2, t);
    expect(out).toContain("5");
    expect(out).toContain("2");
    expect(out).toContain("注意");
  });
});

// ===========================================================================
// M23-06 §4.6-2: 連結した文面が句点で終わる
// ===========================================================================
describe("formatRestoreWarnings の句読点(M23-06 §4.6-2)", () => {
  it("1 件のときも句点で終わる", () => {
    const out = formatRestoreWarnings([issue(VAL_C08_MOVE_EXISTS)], t);
    expect(out.endsWith("。")).toBe(true);
  });

  it("2 種類が同時に発火しても、末尾は句点である", () => {
    const out = formatRestoreWarnings(
      [
        issue(VAL_R01_LINKED_SETUPS_DELETED, { setups: [{ id: 1 }] }),
        issue(VAL_C08_MOVE_EXISTS),
      ],
      t,
    );
    expect(out.endsWith("。")).toBe(true);
    // ★区切りの側に句点を足していないこと(「A。 / B。」にならない)。
    expect(out).not.toContain("。 / ");
  });

  it("0 件のときは句点も付かない(空文字のまま)", () => {
    expect(formatRestoreWarnings([], t)).toBe("");
  });
});

// ===========================================================================
// M23-06 §4.6-3: 警告が指している行の抽出は details のキーで行う
//
// ★★VAL コードで分岐しない。復元経路が返すコードは M23-04 の 2 件から 6 件へ
//   増えている。列挙する形にすると、次に 1 件足されたとき黙って何も出さなくなる。
// ===========================================================================
describe("warningRefEntries(M23-06 §4.6-3)", () => {
  it("details.setups から name を拾う", () => {
    const entries = warningRefEntries(
      issue(VAL_R01_LINKED_SETUPS_DELETED, { setups: [{ id: 9, name: "起き攻めA" }] }),
    );
    expect(entries).toEqual([{ id: 9, label: "起き攻めA" }]);
  });

  it("details.combos から memo を拾う", () => {
    const entries = warningRefEntries(
      issue(VAL_R02_ALL_PARENT_COMBOS_DELETED, { combos: [{ id: 3, memo: "画面端" }] }),
    );
    expect(entries).toEqual([{ id: 3, label: "画面端" }]);
  });

  it("★未知の VAL コードでも details さえあれば拾える(コードを見ていない証拠)", () => {
    const entries = warningRefEntries(
      issue("VAL-R99", { setups: [{ id: 1, name: "将来の警告" }] }),
    );
    expect(entries).toEqual([{ id: 1, label: "将来の警告" }]);
  });

  it("details が無い警告では空配列(VAL-C08 のようにステップ単位で発火するもの)", () => {
    expect(warningRefEntries(issue(VAL_C08_MOVE_EXISTS))).toEqual([]);
    expect(warningRefEntries(issue(VAL_S03_MOVE_EXISTS))).toEqual([]);
  });

  it("ラベルが空の行は落とす(取り違えの元になるため)", () => {
    const entries = warningRefEntries(
      issue(VAL_R01_LINKED_SETUPS_DELETED, { setups: [{ id: 1 }, { id: 2, name: "  " }] }),
    );
    expect(entries).toEqual([]);
  });
});

describe("formatBulkRestoreDetail(M23-06 §4.6-3)", () => {
  it("行のラベルと警告文を 1 行にまとめる", () => {
    const out = formatBulkRestoreDetail(
      {
        key: "combo-1",
        label: "画面端 中央始動",
        warnings: [issue(VAL_R01_LINKED_SETUPS_DELETED, { setups: [{ id: 9, name: "起き攻めA" }] })],
      },
      t,
    );
    expect(out).toContain("画面端 中央始動");
    expect(out).toContain("起き攻めA");
  });

  it("参照先が名前を持たない警告では、対象の括弧を足さない", () => {
    const out = formatBulkRestoreDetail(
      { key: "combo-1", label: "画面端 中央始動", warnings: [issue(VAL_C08_MOVE_EXISTS)] },
      t,
    );
    expect(out).toContain("画面端 中央始動");
    expect(out).not.toContain("対象:");
  });

  it("★未知の VAL コードでも行が壊れない", () => {
    const out = formatBulkRestoreDetail(
      {
        key: "setup-2",
        label: "↓↘→P > 中P",
        warnings: [issue("VAL-R99", { combos: [{ id: 5, memo: "将来のコンボ" }] })],
      },
      t,
    );
    expect(out).toContain("↓↘→P > 中P");
    expect(out).toContain("VAL-R99");
    expect(out).toContain("将来のコンボ");
  });
});

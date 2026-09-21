import { describe, expect, it } from "vitest";
import type { TFunction } from "i18next";

import ja from "@/locales/ja.json";
import type { ValidationIssue } from "@/features/combo/types";

import {
  VAL_C14_DUPLICATE_IN_TRASH,
  VAL_S07_DUPLICATE_SETUP_IN_TRASH,
  formatSaveWarning,
  formatSaveWarnings,
} from "./saveWarnings";
import {
  VAL_R03_DUPLICATE_ALIVE_COMBO,
  VAL_R04_DUPLICATE_ALIVE_SETUP,
  formatRestoreWarning,
} from "./restoreWarnings";

// 純粋関数の単体テスト(CLAUDE.md §5「フロント純粋関数は必須」)。
//
// ★実 ja.json を引く最小の t を使う。キーをそのまま返すモックだと
// 「翻訳キーが実在すること」も「{{count}} が差し込まれること」も判定できない
// (M23-04 教訓 2＝実際に一度それで空振りした)。
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

describe("formatSaveWarning", () => {
  it("VAL-C14: details.combos の件数を差し込む", () => {
    const out = formatSaveWarning(
      issue(VAL_C14_DUPLICATE_IN_TRASH, { combos: [{ id: 1 }], totalCount: 1 }),
      t,
    );
    expect(out).toContain("1");
    expect(out).toContain("ゴミ箱");
    // ★サーバの message を出していないこと(DES-006 §11.3 は翻訳キー経由を求めている)。
    expect(out).not.toContain("サーバ側の診断文");
  });

  it("VAL-S07: details.setups の件数を差し込む", () => {
    const out = formatSaveWarning(
      issue(VAL_S07_DUPLICATE_SETUP_IN_TRASH, { setups: [{ id: 1 }, { id: 2 }], totalCount: 2 }),
      t,
    );
    expect(out).toContain("2");
    expect(out).toContain("セットプレイ");
    expect(out).not.toContain("サーバ側の診断文");
  });

  it("★totalCount を優先する(details の配列は上限で切られている)", () => {
    // サーバは details へ載せる参照を上限で切り、総数を totalCount に入れる
    // (M23-05 §9.2)。配列長だけを見ると上限で頭打ちになった件数が出てしまう。
    const out = formatSaveWarning(
      issue(VAL_C14_DUPLICATE_IN_TRASH, {
        combos: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }],
        totalCount: 12,
      }),
      t,
    );
    expect(out).toContain("12");
    expect(out).not.toContain("5 件");
  });

  it("未知のコードでも黙って消さない", () => {
    const out = formatSaveWarning(issue("VAL-X99"), t);
    expect(out).toContain("VAL-X99");
  });
});

describe("formatSaveWarnings", () => {
  it("同じ文面は畳んで 1 本にまとめる", () => {
    const out = formatSaveWarnings(
      [
        issue(VAL_C14_DUPLICATE_IN_TRASH, { combos: [{ id: 1 }], totalCount: 1 }),
        issue(VAL_C14_DUPLICATE_IN_TRASH, { combos: [{ id: 1 }], totalCount: 1 }),
      ],
      t,
    );
    expect(out.split(" / ")).toHaveLength(1);
  });

  it("違う警告は連結する", () => {
    const out = formatSaveWarnings(
      [
        issue(VAL_C14_DUPLICATE_IN_TRASH, { combos: [{ id: 1 }], totalCount: 1 }),
        issue(VAL_S07_DUPLICATE_SETUP_IN_TRASH, { setups: [{ id: 2 }], totalCount: 1 }),
      ],
      t,
    );
    expect(out.split(" / ")).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// ★★M23-05 §4.6: 登録側と復元側で文面が違うこと
// ---------------------------------------------------------------------------

describe("登録側と復元側の文面の違い", () => {
  // ★利用者にできることが違う。登録側は「作り直す前に、ゴミ箱に同じものがある」を
  // 告げる——復元すれば重複そのものが減る。復元側は「もう並んでいる」を告げるだけで、
  // そのとき打てる手は少ない。⇒ 同じ文面にしてはならない。
  it("コンボ: VAL-C14(登録側)と VAL-R03(復元側)の文面が違う", () => {
    const save = formatSaveWarning(
      issue(VAL_C14_DUPLICATE_IN_TRASH, { combos: [{ id: 1 }], totalCount: 1 }),
      t,
    );
    const restore = formatRestoreWarning(
      issue(VAL_R03_DUPLICATE_ALIVE_COMBO, { combos: [{ id: 1 }], totalCount: 1 }),
      t,
    );
    expect(save).not.toBe(restore);
    // 登録側だけが「ゴミ箱にもある」を告げる。
    expect(save).toContain("ゴミ箱");
    expect(save).not.toContain("並んでいます");
    // 復元側だけが「もう並んでいる」を告げる。
    expect(restore).toContain("並んでいます");
    expect(restore).not.toContain("ゴミ箱");
  });

  it("セットプレイ: VAL-S07(登録側)と VAL-R04(復元側)の文面が違う", () => {
    const save = formatSaveWarning(
      issue(VAL_S07_DUPLICATE_SETUP_IN_TRASH, { setups: [{ id: 1 }], totalCount: 1 }),
      t,
    );
    const restore = formatRestoreWarning(
      issue(VAL_R04_DUPLICATE_ALIVE_SETUP, { setups: [{ id: 1 }], totalCount: 1 }),
      t,
    );
    expect(save).not.toBe(restore);
    expect(save).toContain("ゴミ箱");
    expect(restore).toContain("並んでいます");
  });
});

// ---------------------------------------------------------------------------
// ★★登録側の文面は「選べる」と読ませてはならない(開発者の実機確認・2026-08-22)
// ---------------------------------------------------------------------------

describe("登録側の文面が、実装がしないことを約束していないこと", () => {
  // ★★当初の文面は「作り直す代わりに復元できます」だった。**これは嘘である**——
  //   警告が出る時点で登録は既に完了しており、画面は詳細へ遷移する。利用者が
  //   「作り直すか復元するか」を選べる瞬間はどこにも無い。復元したければ、いま
  //   作ったものを自分で消してゴミ箱から戻す手作業が要る。
  // ★★2026-08-23 追記(M23-09)——保存前に選ばせる導線は**実装された**。
  //   PreSaveDuplicateDialog が「ゴミ箱から復元する／新しく作る／戻って編集を続ける」を
  //   保存ボタン押下時に出す(followup save-time-duplicate-choice-missing は解消済み)。
  // ★★それでも本ガードは生き続ける。守っている対象が違うからである——
  //   本ファイルが検査するのは**保存後トーストの文面**であり、その文面が出る場面では
  //   依然として登録は完了済みで、その場で選べる瞬間は無い。
  //   ★保存前の選択肢はダイアログ側の文面(trash.preSaveDuplicate.*)が担っており、
  //     そちらは別の階層に置いてある(M23-09 §4.5-3＝本ガードと衝突させない)。
  // ⇒ 「ダイアログができたのだから、この文面も選べる言い方にしてよい」と読まないこと。
  // ★本テストは、その取り違えが二度と入らないための回帰ガードである。
  it.each([
    ["VAL-C14", VAL_C14_DUPLICATE_IN_TRASH, "combos"],
    ["VAL-S07", VAL_S07_DUPLICATE_SETUP_IN_TRASH, "setups"],
  ])("%s: 選択を促す言い回しを含まない", (_label, code, key) => {
    const out = formatSaveWarning(
      issue(code, { [key]: [{ id: 1 }], totalCount: 1 } as ValidationIssue["details"]),
      t,
    );
    // 「〜できます」は、その場で選べるという誤解を生む(実際には選べない)。
    expect(out).not.toContain("復元できます");
    expect(out).not.toContain("代わりに");
  });
});

describe("formatRestoreWarning(M23-05 で足した 2 件)", () => {
  it("VAL-R03: details.combos の件数を差し込む", () => {
    const out = formatRestoreWarning(
      issue(VAL_R03_DUPLICATE_ALIVE_COMBO, { combos: [{ id: 1 }, { id: 2 }], totalCount: 2 }),
      t,
    );
    expect(out).toContain("2");
    expect(out).toContain("コンボ");
    expect(out).not.toContain("サーバ側の診断文");
  });

  it("VAL-R04: details.setups の件数を差し込む", () => {
    const out = formatRestoreWarning(
      issue(VAL_R04_DUPLICATE_ALIVE_SETUP, { setups: [{ id: 1 }], totalCount: 1 }),
      t,
    );
    expect(out).toContain("1");
    expect(out).toContain("セットプレイ");
    expect(out).not.toContain("サーバ側の診断文");
  });
});

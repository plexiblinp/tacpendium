import { describe, expect, it } from "vitest";

import {
  nextSequenceTarget,
  type SequenceSection,
} from "./fieldSequence";

/** 基本情報 3 / キャラ固有状態 2 / 起き攻め 3 / その他情報 4、全部開いている。 */
const OPEN: SequenceSection[] = [
  { key: "basic", open: true, stopCount: 3 },
  { key: "customStates", open: true, stopCount: 2 },
  { key: "oki", open: true, stopCount: 3 },
  { key: "other", open: true, stopCount: 4 },
];

describe("M24-12 順送りの次の移動先", () => {
  describe("セクションの中", () => {
    it("次へ 1 つ進む", () => {
      expect(nextSequenceTarget(OPEN, { sectionIndex: 0, stopIndex: 0 }, 1)).toEqual(
        { kind: "stop", sectionIndex: 0, stopIndex: 1 },
      );
    });

    it("前へ 1 つ戻る", () => {
      expect(nextSequenceTarget(OPEN, { sectionIndex: 0, stopIndex: 2 }, -1)).toEqual(
        { kind: "stop", sectionIndex: 0, stopIndex: 1 },
      );
    });
  });

  describe("セクションを跨ぐ", () => {
    it("末尾から次のセクションの先頭へ", () => {
      expect(nextSequenceTarget(OPEN, { sectionIndex: 0, stopIndex: 2 }, 1)).toEqual(
        { kind: "stop", sectionIndex: 1, stopIndex: 0 },
      );
    });

    it("先頭から前のセクションの末尾へ", () => {
      expect(nextSequenceTarget(OPEN, { sectionIndex: 1, stopIndex: 0 }, -1)).toEqual(
        { kind: "stop", sectionIndex: 0, stopIndex: 2 },
      );
    });
  });

  // ★★指示書 §4.4.2 の落とせない条件。
  describe("★★畳まれたセクションへ移るとき——開いてから移す", () => {
    const COLLAPSED: SequenceSection[] = [
      { key: "basic", open: true, stopCount: 3 },
      // ★畳まれている。中身はアンマウントされているので stopCount は数えられない。
      { key: "customStates", open: false, stopCount: 0 },
      { key: "oki", open: true, stopCount: 3 },
      { key: "other", open: true, stopCount: 4 },
    ];

    it("★飛ばさない——畳まれたセクションを「開く」対象として返す", () => {
      expect(
        nextSequenceTarget(COLLAPSED, { sectionIndex: 0, stopIndex: 2 }, 1),
      ).toEqual({ kind: "open", sectionIndex: 1, edge: "first" });
    });

    it("★止まらない——「開く」を返すのであって同じ位置に留まらない", () => {
      const target = nextSequenceTarget(
        COLLAPSED,
        { sectionIndex: 0, stopIndex: 2 },
        1,
      );
      expect(target).not.toEqual({
        kind: "stop",
        sectionIndex: 0,
        stopIndex: 2,
      });
    });

    it("★戻るときは末尾の停止点へ入るよう開く", () => {
      expect(
        nextSequenceTarget(COLLAPSED, { sectionIndex: 2, stopIndex: 0 }, -1),
      ).toEqual({ kind: "open", sectionIndex: 1, edge: "last" });
    });

    it("★★畳まれたセクションが連続していても、手前の 1 つを開く(まとめて開かない)", () => {
      const twoClosed: SequenceSection[] = [
        { key: "basic", open: true, stopCount: 1 },
        { key: "customStates", open: false, stopCount: 0 },
        { key: "oki", open: false, stopCount: 0 },
        { key: "other", open: true, stopCount: 1 },
      ];
      expect(
        nextSequenceTarget(twoClosed, { sectionIndex: 0, stopIndex: 0 }, 1),
      ).toEqual({ kind: "open", sectionIndex: 1, edge: "first" });
    });

    it("★いま居るセクションが畳まれている場合でも次へ進める(詰まらない)", () => {
      const target = nextSequenceTarget(
        COLLAPSED,
        { sectionIndex: 1, stopIndex: 0 },
        1,
      );
      expect(target).toEqual({ kind: "stop", sectionIndex: 2, stopIndex: 0 });
    });
  });

  // ★「開いていて空」は「畳まれている」とは別である。
  describe("開いていて中身が無いセクション(例: キャラ固有状態を持たないキャラ)", () => {
    const EMPTY: SequenceSection[] = [
      { key: "basic", open: true, stopCount: 2 },
      { key: "customStates", open: true, stopCount: 0 },
      { key: "oki", open: true, stopCount: 2 },
    ];

    it("★飛ばす——開いた結果として入力する欄が無いことは利用者から見えている", () => {
      expect(nextSequenceTarget(EMPTY, { sectionIndex: 0, stopIndex: 1 }, 1)).toEqual(
        { kind: "stop", sectionIndex: 2, stopIndex: 0 },
      );
    });

    it("戻るときも飛ばす", () => {
      expect(nextSequenceTarget(EMPTY, { sectionIndex: 2, stopIndex: 0 }, -1)).toEqual(
        { kind: "stop", sectionIndex: 0, stopIndex: 1 },
      );
    });
  });

  describe("端", () => {
    it("最後の停止点より先は end(タブの外へ抜ける)", () => {
      expect(nextSequenceTarget(OPEN, { sectionIndex: 3, stopIndex: 3 }, 1)).toEqual(
        { kind: "end" },
      );
    });

    it("最初の停止点より前は start", () => {
      expect(nextSequenceTarget(OPEN, { sectionIndex: 0, stopIndex: 0 }, -1)).toEqual(
        { kind: "start" },
      );
    });

    it("★末尾が畳まれていても、その先は end ではなく「開く」である", () => {
      const lastClosed: SequenceSection[] = [
        { key: "basic", open: true, stopCount: 1 },
        { key: "other", open: false, stopCount: 0 },
      ];
      expect(
        nextSequenceTarget(lastClosed, { sectionIndex: 0, stopIndex: 0 }, 1),
      ).toEqual({ kind: "open", sectionIndex: 1, edge: "first" });
    });

    it("セクションが 1 つも無ければ端を返す", () => {
      expect(nextSequenceTarget([], { sectionIndex: 0, stopIndex: 0 }, 1)).toEqual({
        kind: "end",
      });
      expect(nextSequenceTarget([], { sectionIndex: 0, stopIndex: 0 }, -1)).toEqual({
        kind: "start",
      });
    });
  });
});

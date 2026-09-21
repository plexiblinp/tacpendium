// M24-12: キーボードの順送り(ハイライトの次の移動先)。
//
// ★★本ファイルは純粋関数だけを置く。⇒ 「畳まれたセクションへ移るときどうなるか」を
//   画面を組まずにテストできる(指示書 §5.1)。
//
// ★★落とせない条件＝**畳まれたセクションは飛ばさない・そこで止まらない。開いてから移す**
//   (指示書 §4.4.2 / CHANGE-138 §2.4)。
//   - 飛ばすと、利用者は「入力できない欄」に到達したことに気づけない。
//   - 開かずに止めると、順送りがそこで詰まる。
//   ⇒ 第 3 の道として「開く」を返す。呼び出し側はセクションを開いてから focus する。

/** 順送りが辿るセクション 1 つ。 */
export interface SequenceSection {
  key: string;
  /** 展開しているか。★畳まれている間、中身はアンマウントされている。 */
  open: boolean;
  /**
   * そのセクションの停止点の数。
   * ★畳まれている間は数えられない(中身が DOM に無い)ため 0 でよい——
   *   畳まれたセクションは stopCount を見ずに「開く」を返すためである。
   */
  stopCount: number;
}

export interface SequencePosition {
  sectionIndex: number;
  stopIndex: number;
}

export type SequenceTarget =
  /** その停止点へ移る。 */
  | { kind: "stop"; sectionIndex: number; stopIndex: number }
  /** ★そのセクションを開いてから、端の停止点へ移る。 */
  | { kind: "open"; sectionIndex: number; edge: "first" | "last" }
  /** 最後の停止点より先へ進んだ(＝タブの外へ抜ける)。 */
  | { kind: "end" }
  /** 最初の停止点より前へ戻った。 */
  | { kind: "start" };

/**
 * 次(または前)の移動先を返す。
 *
 * @param direction 1 = 次へ / -1 = 前へ
 */
export function nextSequenceTarget(
  sections: readonly SequenceSection[],
  current: SequencePosition,
  direction: 1 | -1,
): SequenceTarget {
  const cur = sections[current.sectionIndex];

  // ① いまのセクションの中で動けるなら動く。
  if (cur && cur.open) {
    const next = current.stopIndex + direction;
    if (next >= 0 && next < cur.stopCount) {
      return { kind: "stop", sectionIndex: current.sectionIndex, stopIndex: next };
    }
  }

  // ② セクションを跨ぐ。
  for (
    let i = current.sectionIndex + direction;
    i >= 0 && i < sections.length;
    i += direction
  ) {
    const section = sections[i];
    // ★★畳まれていたら開く。飛ばさない・止まらない。
    if (!section.open) {
      return {
        kind: "open",
        sectionIndex: i,
        edge: direction > 0 ? "first" : "last",
      };
    }
    // ★開いていて中身が無いセクションは飛ばす(例: キャラ固有状態を持たないキャラ)。
    //   ★これは「畳まれたセクションを飛ばす」とは別である——開いた結果として
    //     入力する欄が無いことが利用者から見えている。
    if (section.stopCount > 0) {
      return {
        kind: "stop",
        sectionIndex: i,
        stopIndex: direction > 0 ? 0 : section.stopCount - 1,
      };
    }
  }

  // ③ 端まで来た。
  return direction > 0 ? { kind: "end" } : { kind: "start" };
}

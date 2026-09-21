import { describe, expect, it } from "vitest";

import { MAX_EXPORT_SELECTION } from "@/constants/export";
import {
  droppedCount,
  isTruncated,
  needsExportConfirm,
  parseExportObservation,
} from "./export-truncation";

describe("isTruncated", () => {
  // ★★境界の 1 件で鳴るかが要点である(チェックリスト §6-2)。
  //   「上限の 2 倍」で試すと、ちょうど上限の偽陽性を素通ししてしまう。
  it("上限をちょうど 1 件超えたときに鳴る", () => {
    expect(
      isTruncated({
        total: MAX_EXPORT_SELECTION + 1,
        included: MAX_EXPORT_SELECTION,
        reimportBlocked: false,
      }),
    ).toBe(true);
  });

  // ★★着手前の BE(export.go:29)は `>= 上限` で判定しており、ちょうど上限の
  //   ときに 1 件も落ちていないのに「切り捨てた」と言っていた。その回帰。
  it("ちょうど上限のときは鳴らない(偽陽性を出さない)", () => {
    expect(
      isTruncated({
        total: MAX_EXPORT_SELECTION,
        included: MAX_EXPORT_SELECTION,
        reimportBlocked: false,
      }),
    ).toBe(false);
  });

  it("上限未満では鳴らない", () => {
    expect(isTruncated({ total: 3, included: 3, reimportBlocked: false })).toBe(
      false,
    );
  });

  // ★BE の既定 100 件が効いていた経路の再現。総数だけが多く、載った数が少ない。
  it("一覧が BE の既定 100 件で切れている形を検出する", () => {
    expect(
      isTruncated({ total: 250, included: 100, reimportBlocked: false }),
    ).toBe(true);
    expect(
      droppedCount({ total: 250, included: 100, reimportBlocked: false }),
    ).toBe(150);
  });

  it("droppedCount は切り捨てが無ければ 0(負にならない)", () => {
    expect(droppedCount({ total: 5, included: 9, reimportBlocked: false })).toBe(
      0,
    );
  });
});

describe("needsExportConfirm", () => {
  it("切り捨てが無くても、往復できない出力なら確認する", () => {
    expect(
      needsExportConfirm({ total: 5, included: 5, reimportBlocked: true }),
    ).toBe(true);
  });

  it("切り捨ても往復不能も無ければ確認しない", () => {
    expect(
      needsExportConfirm({ total: 5, included: 5, reimportBlocked: false }),
    ).toBe(false);
  });
});

describe("parseExportObservation", () => {
  const headersOf = (map: Record<string, string>) => ({
    get: (k: string) => (k in map ? map[k] : null),
  });

  it("ヘッダから総数・載った件数・往復可否を読む", () => {
    const o = parseExportObservation(
      headersOf({
        "X-Export-Total": "1500",
        "X-Export-Included": "1000",
        "X-Export-Reimport-Blocked": "true",
      }),
    );
    expect(o).toEqual({ total: 1500, included: 1000, reimportBlocked: true });
    expect(isTruncated(o!)).toBe(true);
  });

  // ★★ヘッダが無いときに「切り捨てていない」と断定しないことの主張。
  //   断定すると、ヘッダが届かなくなった日に黙って着手前の状態へ戻る。
  it("ヘッダが無いときは null を返す(切り捨て無しと断定しない)", () => {
    expect(parseExportObservation(headersOf({}))).toBeNull();
  });

  it("数値として読めないヘッダは null 扱いにする", () => {
    expect(
      parseExportObservation(
        headersOf({ "X-Export-Total": "abc", "X-Export-Included": "10" }),
      ),
    ).toBeNull();
  });

  it("往復可否ヘッダが無いときは false に倒す", () => {
    expect(
      parseExportObservation(
        headersOf({ "X-Export-Total": "10", "X-Export-Included": "10" }),
      ),
    ).toEqual({ total: 10, included: 10, reimportBlocked: false });
  });
});

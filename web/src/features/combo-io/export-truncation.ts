// 書出が「上限で黙って切り捨てた」かの判定を 1 か所に閉じ込める(M29-02 §2.1)。
//
// ★★判定を散らさない理由 —— 上限が掛かる書出の経路は 2 つある
// (BE 生成の CSV / FE 生成の PDF・PNG・クリップボード)。条件を経路ごとに書くと、
// 片方だけ直したときに「1 か所は鳴るが他は黙ったまま」になる。しかもその状態は
// テストも型検査も緑のまま通る(鳴らない経路は、ただ何も言わないだけである)。
//
// ★★「>= 上限」で判定しないこと —— ちょうど上限ぴったりのときは 1 件も落ちて
// いないのに「切り捨てた」と言ってしまう。着手前の BE(export.go:29)がその形だった。
// 総数と実際に載った件数を比べるのが唯一の正しい判定である。

/** 書出の観測。総数と実際に載った件数、および往復可否。 */
export interface ExportObservation {
  /** 対象範囲に一致する総数(上限を掛けない数)。 */
  total: number;
  /** 実際に出力へ載った件数。 */
  included: number;
  /** 出力したファイルを取込に掛けると上限で弾かれるか(往復不能)。 */
  reimportBlocked: boolean;
}

/** 上限で切り捨てが起きたか。★総数 > 載った件数 のときだけ true。 */
export function isTruncated(o: ExportObservation): boolean {
  return o.total > o.included;
}

/** 何件が落ちたか(切り捨てが無ければ 0)。 */
export function droppedCount(o: ExportObservation): number {
  return Math.max(0, o.total - o.included);
}

/** 利用者へ確認を出すべきか(切り捨てるか、往復できないファイルになるか)。 */
export function needsExportConfirm(o: ExportObservation): boolean {
  return isTruncated(o) || o.reimportBlocked;
}

// BE が書出応答へ載せる観測ヘッダ(internal/api/comboio/handler.go と対の契約)。
// ★片方だけ変えると観測が静かに消える。名前をここに集約して grep で辿れるようにする。
export const EXPORT_HEADER_TOTAL = "X-Export-Total";
export const EXPORT_HEADER_INCLUDED = "X-Export-Included";
export const EXPORT_HEADER_REIMPORT_BLOCKED = "X-Export-Reimport-Blocked";

/**
 * 書出応答のヘッダから観測を読む。
 *
 * ★ヘッダが読めないときは null を返す(「切り捨てていない」と断定しない)。
 * 断定すると、ヘッダが届かなくなった日に黙って元の状態へ戻る。
 */
export function parseExportObservation(
  headers: Pick<Headers, "get">,
): ExportObservation | null {
  const total = toInt(headers.get(EXPORT_HEADER_TOTAL));
  const included = toInt(headers.get(EXPORT_HEADER_INCLUDED));
  if (total === null || included === null) return null;
  return {
    total,
    included,
    reimportBlocked: headers.get(EXPORT_HEADER_REIMPORT_BLOCKED) === "true",
  };
}

function toInt(raw: string | null): number | null {
  if (raw === null || raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

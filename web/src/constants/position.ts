import { type Position } from "@/constants/combo-list";

/**
 * 始動位置の区分と 160 マスの物差し(M28-02a・D-730 / D-731 / D-733)。
 *
 * ★★物差しはトレーニングモードの床のマスである(0〜160)。
 * 開発者の逐語:「スト6の画面は 160 マスをベースに感覚を記載する。(トレーニングモードの床のマス)」
 *
 * ★★バックエンド側の正本は internal/model/position.go の PositionBands である。
 * 本ファイルはその写しであり、値がずれると「画面に出る区分」と
 * 「サーバが重複判定に使う区分」が食い違う。⇒ position.test.ts が両者の形を固定する。
 *
 * ★★本ファイルは定数と純関数だけを持つ。3 つの入力方式(従来型 / マス数 / パーセント)の
 * **UI は features/combo/components/ 側にある**。
 *
 * ★★【2026-09-13・M37-01 で更新】旧記述は「UI は M28-02b の射程」であったが失効した ——
 * **M28-02b はこれを実装しないまま完了しており**(引き継ぎ漏れ＝計測点 M-137)、
 * 実際に作ったのは M37-01 である。⇒ 探す先は MassPercentInput.tsx と
 * ComboEditorBasicFields.tsx である。
 */

/** 物差しの上限(トレーニングモードの床のマス)。 */
export const MAX_POSITION_MASS = 160;

export type PositionBand = {
  readonly code: Position;
  /** 区分の範囲(両端含む)。 */
  readonly minMass: number;
  readonly maxMass: number;
  /**
   * 区分を選んだときに入るマス数。
   *
   * ★★中央値を計算して丸める形にしないこと。四捨五入・切り捨て・切り上げは
   * いずれも左右対称にならない〔四捨五入だと 12.5 → 13 と 147.5 → 148 で
   * 160 - 13 = 147 ≠ 148〕。対称になるのは half-even だけである。
   * ⇒ 7 個しかないので直書きする。丸め規則を実装するより確実で、説明も要らない。
   */
  readonly representativeMass: number;
};

/**
 * 始動位置の 7 区分(表示順)。
 *
 * ★並びは「不問」を先頭に置いた 8 値である。不問は値を持たない(空文字/NULL)ため
 * 本配列には含まれない。順序の正本は POSITION_VALUES と共有する。
 */
export const POSITION_BANDS: readonly PositionBand[] = [
  { code: "corner_self", minMass: 0, maxMass: 25, representativeMass: 12 },
  { code: "corner_self_near", minMass: 26, maxMass: 47, representativeMass: 36 },
  { code: "mid_self", minMass: 48, maxMass: 69, representativeMass: 58 },
  { code: "mid_screen", minMass: 70, maxMass: 90, representativeMass: 80 },
  { code: "mid_opponent", minMass: 91, maxMass: 112, representativeMass: 102 },
  {
    code: "corner_opponent_near",
    minMass: 113,
    maxMass: 134,
    representativeMass: 124,
  },
  {
    code: "corner_opponent",
    minMass: 135,
    maxMass: 160,
    representativeMass: 148,
  },
];

/** マス数が物差しの値域(0〜160)に収まっているか。 */
export function isValidPositionMass(mass: number): boolean {
  return Number.isInteger(mass) && mass >= 0 && mass <= MAX_POSITION_MASS;
}

/** マス数から区分を導出する。値域外なら null。 */
export function positionFromMass(mass: number): Position | null {
  if (!isValidPositionMass(mass)) return null;
  const band = POSITION_BANDS.find(
    (b) => mass >= b.minMass && mass <= b.maxMass,
  );
  return band ? band.code : null;
}

/** 区分の代表値を返す。未知の区分なら null。 */
export function representativeMassOf(position: string): number | null {
  const band = POSITION_BANDS.find((b) => b.code === position);
  return band ? band.representativeMass : null;
}

/**
 * マス数をパーセント(0〜100)へ変換する。★表示用であり保存しない。
 *
 * ★★端数を丸めない。丸めるかどうかは表示側の判断であり、ここで落とすと
 * 往復で情報が消える(下の massToPercent → percentToMass を参照)。
 */
export function massToPercent(mass: number): number {
  return (mass / MAX_POSITION_MASS) * 100;
}

/** パーセント(0〜100)をマス数へ変換する。★四捨五入して整数マスへ落とす。 */
export function percentToMass(percent: number): number {
  const mass = Math.round((percent / 100) * MAX_POSITION_MASS);
  return Math.min(MAX_POSITION_MASS, Math.max(0, mass));
}

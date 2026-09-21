// セットプレイ成立条件(combo_setup_results)の列挙定数(M19-03 / CHANGE-087)。
// バックエンド internal/model/setup.go の SetupResultOK / SetupResultNG と同期する
// (CLAUDE.md §4 の列挙同期)。
//
// 三値の表現(§4.1.3):
//   - 行が無い          = 未検証
//   - result === "ok"   = 成立
//   - result === "ng"   = 不成立
// 「未検証」を意味する result の値は作らない。未検証へ戻す操作は行の削除。
//
// 受け身種別(tech_type)の語彙とラベルは web/src/constants/oki.ts の
// OKI_TECH_TYPES / OKI_TECH_TYPE_LABELS を再利用する。第 3 の語彙を作らない
// (DES-005 §5.6 項目6 で正典化済み)。

import { OKI_TECH_TYPES, type OkiTechType } from "./oki";

export const SETUP_RESULTS = ["ok", "ng"] as const;
export type SetupResultValue = (typeof SETUP_RESULTS)[number];
export const SETUP_RESULT_OK = "ok" satisfies SetupResultValue;
export const SETUP_RESULT_NG = "ng" satisfies SetupResultValue;

// UI 上の 3 状態。"unverified" は画面表現のみで、保存値ではない(行が無いこと＝未検証)。
export type SetupResultState = SetupResultValue | "unverified";
export const SETUP_RESULT_UNVERIFIED = "unverified" satisfies SetupResultState;

// 注: 当初は巡回トグル(未検証 → 成立 → 不成立 → 未検証)だったが、2026-07-28 の実機確認で
// 「目的の状態にするのに 2 回押す必要がある」「メモ欄を開くために押すと状態が変わる」との
// 指摘を受け、**選択と状態指定を分離**する方式へ変更した(SetupResultEditor 参照)。
// これに伴い巡回関数は廃止。3 状態は SetupResultState の 3 値を直接指定する。

// 画面端の 2 値。combos.position の値域(mid_screen / corner_self / ...)とは
// 意味が違う(position はコンボ開始位置、こちらはコンボ終了時に相手が端にいるか)ため
// 値を流用しない(§4.1.2 / §3.3-6)。
export const SETUP_IN_CORNER_VALUES = [false, true] as const;

// 2×2 グリッドの正準のセル列(受け身 2 × 端 2 = 4)。表示・編集の反復に使う。
export interface SetupResultCellKey {
  techType: OkiTechType;
  inCorner: boolean;
}

export const SETUP_RESULT_CELLS: readonly SetupResultCellKey[] = OKI_TECH_TYPES.flatMap(
  (techType) => SETUP_IN_CORNER_VALUES.map((inCorner): SetupResultCellKey => ({ techType, inCorner })),
);

// セルの一意キー(map 引き・React key 用)。
export function setupResultCellKey(cell: { techType: string; inCorner: boolean }): string {
  return `${cell.techType}:${cell.inCorner}`;
}

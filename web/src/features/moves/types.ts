// 技マスタ API(GET /api/moves)のレスポンス型。
// バックエンド DTO `internal/api/move/dto.go` のミラー。

import type { WarningCode } from "@/constants/move-warning";
//
// 注: Move(一覧用、GET /api/moves)と MoveDetail(編集用、GET /api/moves/:id)は別 interface。
// バックエンドの MoveResponse(一覧)と MoveDetailResponse(詳細)も別型で、詳細のみ damage / rawData を含む。
// moves 列を追加する際は該当する型すべてに追加すること(M9-03、CLAUDE.md §4)。
// M14-01: 観測不能6列(properties / comboScaling / driveGaugeIncrease / driveGaugeDecreaseGuard /
// driveGaugeDecreasePunish / superArtGaugeIncrease)を削除し、観測可能な手入力硬直 recovery を追加した。
// M30-04: isDerived を Move(一覧用)へ追加した。MoveDetail(編集用)には出ない
// —— BE の MoveDetailResponse が返さないためであり、書き忘れではない。

export type MoveCategory =
  | "normal"
  | "special"
  | "unique"
  | "super_art"
  | "throw"
  | "system"
  | "target_combo"
  | "rush_variant"
  | "drive_impact"
  | "critical_art";

export interface Move {
  id: number;
  characterId: number;
  code: string;
  category: string; // MoveCategory として扱うが、未知値も許容するため string
  originalMoveId?: number | null;
  // フレームデータ列（M8-01、CHANGE-022/025）。
  startup?: number | null; // 発生フレーム（NULL 可）
  active?: number | null; // 持続フレーム数（NULL 可）
  total?: number | null; // 全体硬直（NULL 可、取込時算出）
  onHit?: number | null; // 硬直差ヒット（NULL 可、符号付き）
  onBlock?: number | null; // 硬直差ガード（NULL 可、符号付き）
  recovery?: number | null; // 硬直フレーム（手入力、NULL 可、M14-01）
  isAerial: boolean; // 空中判定（NOT NULL DEFAULT false）
  setupOnly: boolean; // セットプレイ専用フラグ（NOT NULL DEFAULT false）
  // 派生技フラグ（NOT NULL DEFAULT false、M30-04）。BE は false でも常に返す。
  // ★★「単独入力が不可能」ではない（DES-003 §3.3 errata③。true の行のうち少なくとも 96 行は
  //   コマンド衝突の回避が付与理由）。⇒ 入力面の可否判定に使わないこと（D-807）。
  //   本フラグの用途は必殺技ファミリー行の並び順（派生変種を末尾へ回す）だけである。
  isDerived: boolean;
  nameJa?: string | null; // official_ja_move プリセットの alias_text、未登録なら null
  // 取込プレビュー(§5.17)と同じ WarningCode をサーバが保存済みデータから再導出した配列
  // (M9-04、§4.1)。空配列は要確認なし。後方互換の追加(omitempty ではなく常時 [])。
  warnings?: WarningCode[];
}

export interface MoveListResponse {
  items: Move[];
}

// CommandIndexResponse は段階2 解決表(GET /api/characters/:id/command-index、M17-02)のミラー。
// entries は BE が畳み済みの token_key → move_code(FE は引くだけ = DES-002 §4.2)。
export interface CommandIndexResponse {
  characterId: number;
  entries: Record<string, string>;
}

// MotionCommandsResponse はコマンド技入力モード用の索引
// (GET /api/characters/:id/motion-commands、M21-06 §4.6)のミラー。
//
// ★CommandIndexResponse とは別物である。あちらは段階2 用に畳み済みの 1 対 1 マップで、
// 236LP のような多方向コマンドは 1 件も載っていない。こちらは索引の素通しで、畳んでも
// 絞ってもいない。前方一致・最長一致は FE 側が行う(§4.6-5)。
//
// ★配列であってマップではない。同一 tokenKey に複数の move が載る組が実データに 49 件あり、
// マップにすると「同じ長さで複数残るなら解決しない」(§4.2-4)が表現できなくなる。
export interface MotionCommandDTO {
  tokenKey: string;
  moveCode: string;
}

export interface MotionCommandsResponse {
  characterId: number;
  commands: MotionCommandDTO[];
}

// MoveDetail は編集グリッド用のフル項目(GET /api/moves/:id、M9-03)。
// バックエンド MoveDetailResponse のミラー。Move には無いフル項目を含む。
export interface MoveDetail {
  id: number;
  characterId: number;
  code: string;
  category: string;
  originalMoveId?: number | null;
  startup?: number | null;
  active?: number | null;
  total?: number | null;
  onHit?: number | null;
  onBlock?: number | null;
  damage?: number | null;
  recovery?: number | null; // 硬直フレーム（手入力、NULL 可、M14-01）
  isAerial: boolean;
  setupOnly: boolean;
  rawData?: string | null; // JSON(notes / notes_tool 等、CHANGE-030)
  nameJa?: string | null; // official_ja_move エイリアス(表示のみ、CHANGE-032)
}

// UpdateMoveRequest は PATCH /api/moves/:id の入力(M9-03、§4.1)。
// 未指定フィールドは更新しない(部分更新)。
export interface UpdateMoveRequest {
  total?: number | null;
  startup?: number | null;
  active?: number | null;
  onHit?: number | null;
  onBlock?: number | null;
  damage?: number | null;
  recovery?: number | null; // 硬直フレーム（手入力、NULL 可、M14-01）
  isAerial?: boolean;
  rawData?: string | null;
}

// ラッシュ版生成の対象判定(category ∈ {normal, unique} ∧ is_aerial=false、DES-003 §3.3)。
// グリッドの「ラッシュ版生成」ボタンの活性条件に用いる(サーバ側でも強制)。
export function isRushEligible(m: Pick<Move, "category" | "isAerial">): boolean {
  return !m.isAerial && (m.category === "normal" || m.category === "unique");
}

// 編集グリッドで「要確認」として強調する行か判定する(§4.6、取込プレビュー §5.17 と同方式)。
// サーバが再導出した warnings(total_null / extra_throw)を要確認シグナルとし、1 つでもあれば強調する
// (M9-04、§4.1)。M14-01 で unknown_properties / unknown_combo_scaling_key は撤去。
export function moveNeedsConfirmation(m: Pick<Move, "warnings">): boolean {
  return (m.warnings?.length ?? 0) > 0;
}

// カテゴリ表示用の日本語ラベル(技セレクタの <optgroup> ラベル)。
// SUPP-001 §3.3.3 と DES-003 §3.3 の category 値に基づく推測:
// rush_variant は「ラッシュ版」、target_combo は「ターゲットコンボ」、unique/system は補助技。
export const MOVE_CATEGORY_LABEL_JA: Record<string, string> = {
  normal: "通常技",
  unique: "特殊技",
  target_combo: "ターゲットコンボ",
  throw: "投げ",
  special: "必殺技",
  super_art: "SA",
  critical_art: "クリティカルアーツ",
  system: "システム",
  drive_impact: "ドライブインパクト",
  rush_variant: "ラッシュ版",
};

// セレクタでのカテゴリ表示順(まずよく使う通常技から)。
export const MOVE_CATEGORY_ORDER: string[] = [
  "normal",
  "unique",
  "target_combo",
  "throw",
  "special",
  "super_art",
  "critical_art",
  "system",
  "drive_impact",
  "rush_variant",
];

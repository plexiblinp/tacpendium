import type { Modifiers, ValidationIssue } from "../combo/types";
// 列挙値はバックエンド model.SetupResultOK / SetupResultNG と同期した定数を使う
// (CLAUDE.md §4: リテラル文字列を散在させない)。
import type { SetupResultValue } from "@/constants/setup-result";

export interface Setup {
  id: number;
  characterId: number;
  name?: string | null;
  description?: string | null;
  stepCount: number;
  version: number;
  createdAt: string;
  updatedAt: string;
  // 論理削除の日時(M23-02)。生きた行では省略される(バックエンドが omitempty)。
  // ゴミ箱一覧が「削除日時」を表示項目に持つため必要である(DES-005 §5.15)。
  deletedAt?: string | null;
}

export interface SetupStep {
  id: number;
  stepOrder: number;
  moveId?: number | null;
  moveCode?: string | null;
  modifiers?: Modifiers | null;
}

export interface SetupResponse extends Setup {
  steps: SetupStep[];
  defaultRecipe: string;
  parentComboIds: number[];
}

// RestoreSetupResponse は POST /api/setups/:id/restore の 200 応答(M23-04 §4.3)。
//
// ★SetupResponse 本体へ warnings を足していないのは意図である——バックエンドが
// warnings を設定するのは復元経路と登録経路(下の CreateSetupResponse)だけであり、
// 一覧・詳細の応答には現れない。3 分岐へ足すと「常にあるフィールド」に見えてしまう。
export interface RestoreSetupResponse extends SetupResponse {
  // ★0 件のときはキー自体が無い(バックエンドが omitempty)。空配列は返らない。
  warnings?: ValidationIssue[];
}

// CreateSetupResponse は POST /api/combos/:comboId/setups の 200 応答(M23-05 §4.6)。
//
// ★M23-04 が復元経路に作った warnings の器を、本サブが登録経路へ広げたもの。
// ★SetupResponse 本体へ足していないのは RestoreSetupResponse と同じ理由である——
// 設定されるのは登録経路だけであり、一覧・詳細には現れない。
export interface CreateSetupResponse extends SetupResponse {
  // ★0 件のときはキー自体が無い(バックエンドが omitempty)。空配列は返らない。
  warnings?: ValidationIssue[];
}

// SetupDuplicateRef は「どのセットプレイか」を人が読める形で示す最小の組(M23-09 §4.1-3)。
// バックエンド model.SetupRef と対応する。
//
// ★名前は必須列だが、VAL-S06 導入前の既存データには空がありうる。画面は
//   trash.warning.unnamedSetup(「セットプレイ {{id}}」)へ倒す。
// ★WarningDetails.setups とは今のところ別々に定義してある。共用していると読める記述を
//   置かないこと——片方だけ直したときに静かにずれる。
export interface SetupDuplicateRef {
  id: number;
  name?: string | null;
}

// CheckSetupDuplicateRequest は同経路の入力(M23-09 §4.1-2)。
//
// ★名前は送らない。VAL-S04 / VAL-S07 とも名前を見ない(DES-006 §3)。
// ★応答と同じファイルへ置く(コンボ側が features/combo/types.ts に要求・応答を
//   揃えているのと同じ作法)。
export interface CheckSetupDuplicateRequest {
  characterId: number;
  steps: Array<{ moveId?: number | null; modifiers?: Modifiers }>;
}

// CheckSetupDuplicateResponse は POST /api/combos/:comboId/setups/check-duplicate の
// 200 応答(M23-09 §4.1-2)。形はコンボ側に揃えてある。
//
// ★0 件でもキーは出て空配列になる。length で分岐してよい。
export interface CheckSetupDuplicateResponse {
  // 生きた一致。母集団は VAL-S04 と同一。★画面はこれではダイアログを出さない。
  duplicates: SetupDuplicateRef[];
  // ゴミ箱に居る一致。母集団は VAL-S07 と同一。
  deletedDuplicates: SetupDuplicateRef[];
}

// セットプレイ成立条件 1 セル分(M19-03)。バックエンド model.ComboSetupResult と対応。
// 行が存在すること自体が「検証済み」を意味する(未検証のセルはそもそも配列に現れない)。
export interface SetupResultCell {
  setupId: number;
  techType: string;
  inCorner: boolean;
  result: SetupResultValue;
  note?: string | null;
}

// ComboDetail.setups に埋め込まれるサマリ型(steps / createdAt / updatedAt 除外)
export interface SetupSummary extends Omit<Setup, "createdAt" | "updatedAt"> {
  defaultRecipe: string;
  parentComboIds: number[];
  // M19-03: この「コンボ × セットプレイ」の組の成立条件。コンボ詳細でのみ埋まる。
  // 未設定 / 空配列 = 全 4 セル未検証。
  results?: SetupResultCell[];
}

// 成立条件 1 セルの更新入力(PUT .../results)。
// note は全置換の契約。null を渡すと既存のメモは消える(部分更新ではない)。
export interface UpsertSetupResultInput {
  techType: string;
  inCorner: boolean;
  result: SetupResultValue;
  note?: string | null;
}

// 提案の採用時にチェックされた「確認できた条件」(M19-03 §4.5)。
// 記録されるのは成立(ok)のみで、不成立と note はここでは扱わない。
export interface SetupResultCondition {
  techType: string;
  inCorner: boolean;
}

export interface SetupStepInput {
  moveId?: number | null;
  modifiers?: Modifiers;
}

export interface CreateSetupInput {
  characterId: number;
  name?: string | null;
  description?: string | null;
  steps: SetupStepInput[];
  // M19-03 §4.5: 省略可。未チェックでも採用できる。
  verifiedConditions?: SetupResultCondition[];
}

export interface UpdateSetupInput {
  name?: string | null;
  description?: string | null;
  steps?: SetupStepInput[];
  version: number;
}

export interface SetupListResponse {
  items: SetupResponse[];
}

export interface ListSetupCandidatesResponse {
  items: SetupSummary[];
}

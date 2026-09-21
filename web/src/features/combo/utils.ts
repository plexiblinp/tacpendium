// コンボ画面で使うフォーマット・コード値変換ユーティリティ。
// 状況コード値マスタは SUPP-001 §3.2 準拠。

import { SETUP_FALLBACK_NAME_LENGTH } from "@/lib/constants";
import {
  POSITION_LABELS,
  OPPONENT_STANCE_LABELS,
  HIT_TYPE_LABELS,
  OPPONENT_SIZE_LABELS,
  POSITION_LABEL_KEYS as POSITION_KEYS_INTERNAL,
  HIT_TYPE_LABEL_KEYS as HIT_TYPE_KEYS_INTERNAL,
  DRIVE_DAMAGE_DIRECTION_LABEL_KEYS,
  type DriveDamageDirection,
} from "@/constants/combo-list";
import { jaLabel, type LabelKeyMap, type Translate } from "@/lib/ja-label";
import { massToPercent } from "@/constants/position";
import type { Move } from "@/features/moves/types";
import { MODIFIER_NON_MOVE_TYPES } from "./labels";
import type { Combo, ComboSummary, Modifiers, Step } from "./types";

// ===== 状況コード→日本語ラベル(SUPP-001 §3.2) =====
// 定義本体は constants/combo-list.ts に移動済み。既存 import 互換のため re-export。
export {
  POSITION_LABELS,
  OPPONENT_STANCE_LABELS,
  HIT_TYPE_LABELS,
  OPPONENT_SIZE_LABELS,
};
export {
  POSITION_LABEL_KEYS,
  OPPONENT_STANCE_LABEL_KEYS,
  HIT_TYPE_LABEL_KEYS,
  OPPONENT_SIZE_LABEL_KEYS,
  STARTER_MEATY_LABEL_KEYS,
} from "@/constants/combo-list";

// ★★M24-07: 第 1 引数は「値 → i18n キー」の対応表(*_LABEL_KEYS)、
//   第 3 引数は文言の解決関数になった。既定は日本語固定であり、
//   i18n を通らない画面(PDF・画像出力 / 確定反撃マイリスト)は呼び出しを変えなくてよい。
//   ★未知の値はコードをそのまま返す(隠さない＝それ自体が手がかり)。
//   ★★型は LabelKeyMap(値がドットを含む文字列)で受ける。*_LABELS(日本語の写し)を
//     渡すとコンパイルが止まる——レビュー 高-2 で「渡したままでも jaLabel の
//     フォールバックに救われて緑」という事故が実在したためである。
export function labelFor(
  keys: LabelKeyMap,
  code: string | undefined | null,
  translate: Translate = jaLabel,
): string {
  if (!code) return "-";
  const key = keys[code];
  return key ? translate(key) : code;
}

// ===== セットプレイ名フォールバック(SUPP-001 §2.4) =====

export function getSetupDisplayName(
  name: string | null | undefined,
  recipeText: string,
  isMobile: boolean,
): string {
  if (name) return name;
  const maxLen = isMobile
    ? SETUP_FALLBACK_NAME_LENGTH.mobile
    : SETUP_FALLBACK_NAME_LENGTH.pc;
  if (recipeText.length <= maxLen) return recipeText;
  return recipeText.slice(0, maxLen) + "…";
}

// ===== 始動状況グループ(CHANGE-002:始動技 + hit_type + position) =====

// ★★M24-07(SM-006 = SM-059): 始動状況の先頭に**内部の英語 move code** が出ていた
//   (例「standing_light_punch / 通常 / 画面中央」)。⇒ 技の表示名を出す。
//
// ★フォールバックの形(段階は 3 つ):
//   1. starterMoveNameJa —— 通常はこれ。official_ja_move の alias_text 由来
//   2. starterMoveCode —— 表示名が引けないとき。★ラッシュ版は alias を持たないため
//      実際に起こりうる(internal/repository/move/rush.go)。**隠さずコードを出す**のは
//      既存規約と同じ(usePreviewNames「未投入キャラ・未知 code は引数コードをそのまま
//      返す = それ自体がエラーの手がかり」)。★これは「内部値の露出」ではない——
//      表示できる名前が無いときに識別子を出すのは、無言で空にするより情報が多い
//   3. 始動技#<id> / 始動技? —— code すら無いとき(従来どおり)
export function formatStarterStatus(
  combo: ComboSummary,
  translate: Translate = jaLabel,
): string {
  const starterName = combo.starterMoveNameJa?.trim();
  let starterPart: string;
  if (starterName) {
    starterPart = starterName;
  } else if (combo.starterMoveCode) {
    starterPart = combo.starterMoveCode;
  } else if (combo.starterMoveId !== undefined) {
    // ★★M24-07 レビュー(中-2): ここだけ直書きの日本語が残っており、i18n を通る面
    //   でも英語 UI に「始動技#42」と出ていた。⇒ 3 段目のフォールバックも解決関数を通す。
    //   ★列挙していた面(一覧 / ゴミ箱 / 比較)は **M24-07 当時の記録**である。
    //     M27-03 で一覧は本関数を呼ばなくなった(始動技を出さないため)。
    //     現在の呼び手は `grep -rn "formatStarterStatus" web/src` で数えること。
    starterPart = translate("comboCommon.starterMoveFallback", {
      id: combo.starterMoveId,
    });
  } else {
    starterPart = translate("comboCommon.starterMoveUnknown");
  }
  return `${starterPart} / ${formatSituationStatus(combo, translate)}`;
}

// ★★M27-03(P4M-020): 始動技を出さない版。ヒット種別 / 始動位置 だけを連結する。
//
// ★開発者の逐語＝「コンボ一覧、レシピが綺麗に表示されているので、始動技を始動状況欄に
//   出す必要はなくなった。消したい。」
//
// ★★使うのは一覧の表部品(`ComboTableRow`)だけである。比較・ゴミ箱・エクスポートは
//   引き続き `formatStarterStatus` を使う——エクスポートは `DES-005` §5.13 が
//   「常時出力(固定)＝キャラクター名・始動状況(始動技 + カウンター種別 + 始動位置)」と
//   定めているためである。★共有関数そのものを削らない。
//
// ★語の生成は 1 本のままである——`formatStarterStatus` が本関数を呼ぶ。
export function formatSituationStatus(
  combo: ComboSummary,
  translate: Translate = jaLabel,
): string {
  return [
    labelFor(HIT_TYPE_KEYS_INTERNAL, combo.hitType, translate),
    labelFor(POSITION_KEYS_INTERNAL, combo.position, translate),
  ].join(" / ");
}

// ===== レシピ 1 行プレビュー(M15-05 追補・編集中の steps を一目で把握する簡易表記) =====
//
// 編集中(未保存)の steps を技名(公式日本語 = move.nameJa)で " > " 連結した簡易プレビュー。
// サーバの正規 notation(GET /api/combos/:id/recipe・プリセット解決)は保存済み combo に
// 対してのみ得られ、編集中は取得できないためクライアント側で近似表記を組み立てる。
// プリセット未実装の現状ではサーバも公式日本語へフォールバックするため実質的に一致する。
// 将来のプリセット/正規 notation 解決への差し替えは残課題(設計担当連携)。
//
// combo の `Step` と setup の `SetupStepInput` の双方を受けられる最小シグネチャ。
export interface RecipeLineStep {
  moveId?: number | null;
  moveCode?: string;
  modifiers?: Modifiers;
}

export function formatRecipeLine(
  steps: ReadonlyArray<RecipeLineStep> | undefined,
  moves: ReadonlyArray<Move>,
): string {
  if (!steps || steps.length === 0) return "";
  const byId = new Map(moves.map((m) => [m.id, m]));
  return steps
    .map((s) => {
      if (s.moveId != null) {
        const m = byId.get(s.moveId);
        return m?.nameJa ?? m?.code ?? s.moveCode ?? `#${s.moveId}`;
      }
      // 非技ステップは modifiers.type の区分ラベルで表す。
      const t = MODIFIER_NON_MOVE_TYPES.find((x) => x.value === s.modifiers?.type);
      return t?.label ?? "?";
    })
    .join(" > ");
}

// ===== 数値表示の整形 =====

export function formatDamage(damage: number | undefined): string {
  if (damage === undefined || damage === null) return "-";
  return String(damage);
}

export function formatDriveGauge(value: number | undefined): string {
  if (value === undefined || value === null) return "-";
  // SUPP-001 計算ロジック側で float を返す可能性があるため小数1桁丸め。
  return value.toFixed(1).replace(/\.0$/, "");
}

export function formatSAGauge(value: number | undefined): string {
  if (value === undefined || value === null) return "-";
  return String(value);
}

// ★★M27-03(SD-009): 符号を明示する。
//
// 開発者の逐語＝「正負がどっちを表すかいまは良く分からないので、表示を見直したい。」
// ⇒ 正に "+" を付ける。既存 `formatKnockdownAdvantage`(+32F)と同じ作法であり、
//   第 2 の流儀を作らない。
//
// ★★これは表示だけの変更である。値域も検証も変えていない(VAL-C13＝-6〜6)。
// ★本関数は 3 面が共有する 1 本である(コンボ詳細 / ゴミ箱のコンボ詳細 /
//   テキスト・画像エクスポート)。⇒ 片面だけ形を変えると、同じ値が面によって
//   違う文字列になる。3 面まとめて揃える。
export function formatDriveDamage(value: number | undefined | null): string {
  if (value == null) return "-";
  // -6〜6・小数許容(C-11)。REAL round-trip の浮動小数桁あふれを避け、小数2桁で丸めて表示。
  const rounded = Math.round(value * 100) / 100;
  // ★0 には符号を付けない。"+0" は「削った」と読めてしまう。
  return rounded > 0 ? `+${rounded}` : String(rounded);
}

// ★★M27-03(SD-009): 符号がどちらを表すかの語。
//
// ★★2026-09-05 に開発者の指示で**符号の意味を入れ替えた**——「マイナスの方を削り、
//   プラスの方を回復に」。⇒ **負 = 相手のゲージを削った / 正 = 相手が回復した。**
//
// ★着手前は逆だった(正 = 削り)。設計書もそちら(DES-003 / DES-005 の「回復で負値」)で
//   あり、既存の行はその規則で入力されていた。⇒ **マイグレ 000103 で既存値を反転させて
//   ある**。値と表示を同時に入れ替えているので、実世界の意味は保たれている。
//   ★片方だけ直さないこと。
//
// ★0 と未入力には語を付けない(どちらでもないため)。
// ★語そのものは i18n / ja.json の 1 か所が正典であり、本関数は「どちらの語か」だけを
//   決める。★第 2 の語彙を作らないため、呼び出し側で文字列を組み立てないこと。
export function driveDamageDirection(
  value: number | undefined | null,
): DriveDamageDirection | null {
  if (value == null) return null;
  const rounded = Math.round(value * 100) / 100;
  // ★負が削り・正が回復である(2026-09-05 開発者指示)。
  if (rounded < 0) return "cut";
  if (rounded > 0) return "recover";
  return null;
}

/** 符号の向きを表す語。i18n を通らない面(エクスポート等)は既定の jaLabel で引く。 */
export function driveDamageDirectionLabel(
  value: number | undefined | null,
  translate: Translate = jaLabel,
): string | null {
  const dir = driveDamageDirection(value);
  return dir === null ? null : translate(DRIVE_DAMAGE_DIRECTION_LABEL_KEYS[dir]);
}



export function formatKnockdownAdvantage(
  value: number | undefined | null,
): string {
  if (value == null) return "-";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value}F`;
}

/** マス数の単位。★語は locales に置く(driveDamageDirectionLabel と同じ流儀)。 */
const POSITION_MASS_UNIT_LABEL_KEY = "comboDetail.positionMassUnit";

/**
 * 始動位置のマス数・運び量の表示(M37-01)。
 *
 * ★表示専用の整形であり、変換そのものは constants/position.ts の既存関数に任せる
 *   (指示書 §2.2-3「新しい変換を書かない」)。
 * ★★丸めの向きは MassPercentInput の入力欄と揃えてある —— パーセントは
 *   小数第 1 位へ四捨五入。⇒ 入力欄と詳細画面で違う数字が出ることはない。
 */
export function formatPositionMass(
  value: number | undefined | null,
  translate: Translate = jaLabel,
): string {
  if (value == null) return "-";
  const percent = Math.round(massToPercent(value) * 10) / 10;
  return `${value} ${translate(POSITION_MASS_UNIT_LABEL_KEY)} (${percent}%)`;
}

export function formatMemo(memo: string | undefined): string {
  if (!memo) return "";
  // 一覧テーブルでは長いメモを切り詰める(暫定: 30文字)。詳細画面ではそのまま表示。
  if (memo.length <= 30) return memo;
  return memo.slice(0, 30) + "…";
}

// ===== PATCH/PUT 判定(SUPP-001 §2.2) =====

// SUPP-001 §2.2 の重複判定キー(8 フィールド)。
// これらのいずれかが変更されていれば PUT(キー変更編集)、それ以外なら PATCH。
//
// recipe(combo_steps の move_id 列 + modifiers の完全一致)も比較対象。
// CHANGE-006 反映: hit_type(旧 counter_type)を含む。
// M37-07 反映: starterMeaty を追加し 7 → 8 フィールドへ(開発者裁定 D-874)。

export interface ComboKeyFields {
  characterId: number;
  starterMoveId?: number | null;
  position?: string | null;
  opponentStance?: string | null;
  hitType?: string | null;
  opponentSize?: string | null;
  /**
   * ★M37-07: 始動技を持続当てしたか(重複判定キーの 8 つ目)。
   * ★他のキー項と違い null を取らない —— DB 列が NOT NULL DEFAULT 0 であり
   *   「未設定」という状態が無い。⇒ 比較も nullableEqual ではなく素の比較にする。
   */
  starterMeaty?: boolean;
  steps: Step[];
}

// hasKeyChanges は initial(編集前)と current(編集中)を比較し、
// SUPP-001 §2.2 のキーが 1 つでも変更されていれば true を返す。
//
// 比較ルール:
//   - スカラフィールドは厳密等価(null/undefined は同一視)
//   - steps は move_id 列と modifiers の完全一致(順序含む)
export function hasKeyChanges(
  initial: ComboKeyFields,
  current: ComboKeyFields,
): boolean {
  if (initial.characterId !== current.characterId) return true;
  if (!nullableEqual(initial.starterMoveId, current.starterMoveId)) return true;
  if (!nullableEqual(initial.position, current.position)) return true;
  if (!nullableEqual(initial.opponentStance, current.opponentStance))
    return true;
  if (!nullableEqual(initial.hitType, current.hitType)) return true;
  if (!nullableEqual(initial.opponentSize, current.opponentSize)) return true;
  // ★M37-07: bool は nullableEqual を通さない。undefined は false と同値である
  //   (列が NOT NULL DEFAULT 0 であり「未設定」が存在しない)。
  if ((initial.starterMeaty ?? false) !== (current.starterMeaty ?? false))
    return true;

  if (!stepsEqual(initial.steps, current.steps)) return true;

  return false;
}

function nullableEqual(
  a: string | number | null | undefined,
  b: string | number | null | undefined,
): boolean {
  const aNorm = a == null ? null : a;
  const bNorm = b == null ? null : b;
  return aNorm === bNorm;
}

function stepsEqual(a: Step[], b: Step[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const sa = a[i];
    const sb = b[i];
    if (!nullableEqual(sa.moveId, sb.moveId)) return false;
    if (!modifiersEqual(sa.modifiers, sb.modifiers)) return false;
  }
  return true;
}

function modifiersEqual(
  a: Modifiers | undefined,
  b: Modifiers | undefined,
): boolean {
  const aEmpty = isEmptyModifiers(a);
  const bEmpty = isEmptyModifiers(b);
  if (aEmpty && bEmpty) return true;
  if (aEmpty !== bEmpty) return false;

  // a, b ともに非空であることが確定
  const aSafe = a as Modifiers;
  const bSafe = b as Modifiers;

  if ((aSafe.type ?? "") !== (bSafe.type ?? "")) return false;
  if ((aSafe.notes ?? "") !== (bSafe.notes ?? "")) return false;

  const aFlags = [...(aSafe.flags ?? [])].sort();
  const bFlags = [...(bSafe.flags ?? [])].sort();
  if (aFlags.length !== bFlags.length) return false;
  for (let i = 0; i < aFlags.length; i++) {
    if (aFlags[i] !== bFlags[i]) return false;
  }
  return true;
}

function isEmptyModifiers(m: Modifiers | undefined): boolean {
  if (m == null) return true;
  const noFlags = !m.flags || m.flags.length === 0;
  const noType = !m.type || m.type === "";
  const noNotes = !m.notes || m.notes === "";
  return noFlags && noType && noNotes;
}

// isFormReadyForDuplicateCheck は重複検知 API 呼出に必要な最小フィールドが揃っているか判定する。
export function isFormReadyForDuplicateCheck(fields: {
  characterId: number;
  starterMoveId: number | null | undefined;
  position: string | null | undefined;
  opponentStance: string | null | undefined;
  hitType: string | null | undefined;
  opponentSize: string | null | undefined;
  steps: Step[];
}): boolean {
  return (
    fields.characterId > 0 &&
    fields.starterMoveId != null &&
    fields.steps.length >= 1 &&
    !!fields.position &&
    !!fields.opponentStance &&
    !!fields.hitType &&
    !!fields.opponentSize
  );
}

// extractKeyFields は Combo から ComboKeyFields を取り出す薄いヘルパ。
export function extractKeyFields(c: Combo): ComboKeyFields {
  const steps = c.steps ?? [];
  return {
    characterId: c.characterId,
    // C-12: 始動技はレシピ先頭 move から自動確定。保存済み starter_move_id ではなく
    // 現レシピ先頭を基準にキー比較する(current 側も effectiveStarterMoveId=auto を使うため整合)。
    starterMoveId: steps.find((s) => s.moveId != null)?.moveId ?? null,
    position: c.position,
    opponentStance: c.opponentStance,
    hitType: c.hitType,
    opponentSize: c.opponentSize,
    starterMeaty: c.starterMeaty ?? false,
    steps,
  };
}

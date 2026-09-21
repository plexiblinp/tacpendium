// 確定反撃サーチ(M18-02)の列挙定数。バックエンド internal/model/punish.go と 1:1 で同期する
// (CLAUDE.md §4。新規値追加時は両側を同時更新すること)。走査規則の数値(DASH_MIN_SLACK /
// JUMP_SLACK 等)は BE 算出のため FE には持たせない(規則を FE に二重実装しない・DES-002 §4.2)。
import { type HitType } from "./combo-list";

// verdict: combo_punish_starters.verdict の許容値。
export const PUNISH_VERDICT_ADOPTED = "adopted";
export const PUNISH_VERDICT_UNREACHABLE = "unreachable";

// guard_type: 走査タブ。
export const PUNISH_GUARD_TYPE_BLOCK = "block";
export const PUNISH_GUARD_TYPE_JUST_PARRY = "just_parry";

// lane: 始動技候補の判定根拠レーン。
export const PUNISH_LANE_GROUND = "ground";
export const PUNISH_LANE_DASH = "dash";
export const PUNISH_LANE_JUMP = "jump";

// reason: 手動確認レーンへ落ちた理由。
export const PUNISH_REASON_DISTANCE_DEPENDENT = "distance_dependent";
export const PUNISH_REASON_DATA_MISSING = "data_missing";
export const PUNISH_REASON_UNKNOWN_DAMAGE = "unknown_damage";
export const PUNISH_REASON_ZERO_RECOVERY = "zero_recovery";

// 表示ラベル(日本語)。「ジャストパリィ」は略さない(規約)。
export const PUNISH_GUARD_TYPE_LABELS: Record<string, string> = {
  [PUNISH_GUARD_TYPE_BLOCK]: "ガード",
  [PUNISH_GUARD_TYPE_JUST_PARRY]: "ジャストパリィ",
};

// レーン表示名: 「その場」(密着で出す)/「前方ステップ」(前進して出す)/「ジャンプ経由」。
// 内部値(ground/dash/jump)は不変で、表示のみドメイン語に合わせる(2026-07-24 開発者確定)。
export const PUNISH_LANE_LABELS: Record<string, string> = {
  [PUNISH_LANE_GROUND]: "その場",
  [PUNISH_LANE_DASH]: "前方ステップ",
  [PUNISH_LANE_JUMP]: "ジャンプ経由",
};

// ★★M24-07(SM-133)の帰属ラベル。相手の技と自分の技が同じ形で並び、太さの差しか
//   手掛かりが無かったことへの対処である。
//   ★★【M24-07 レビュー(中-6)で是正】3 面(PunishTree / PunishList / HiddenItemsPanel)へ
//     直書きしていたため、自分側だけ「自分の技」と「自分の始動技」の 2 語に割れ、
//     形もバッジとプレーンテキストに割れていた。⇒ 語を本定数へ 1 本化し、形は
//     共通部品 PunishAttributionBadge へ寄せる(E-76)。
//   ★語は「自分の始動技」に寄せた——PunishTree の第 2 階層も StarterNode(始動技)であり、
//     「自分の技」より何を指すかが狭くて正確である。
export const PUNISH_ATTRIBUTION_OPPONENT_MOVE_LABEL = "相手の技";
export const PUNISH_ATTRIBUTION_OWN_STARTER_LABEL = "自分の始動技";

export const PUNISH_REASON_LABELS: Record<string, string> = {
  [PUNISH_REASON_DISTANCE_DEPENDENT]: "距離依存",
  [PUNISH_REASON_DATA_MISSING]: "データ不足",
  [PUNISH_REASON_UNKNOWN_DAMAGE]: "ダメージ不明",
  [PUNISH_REASON_ZERO_RECOVERY]: "硬直データ不定",
};

// verdict 表示名: 採用/不採用。内部値 unreachable は不変(不採用＝必ずしも到達不能とは限らないため表示のみ変更)。
export const PUNISH_VERDICT_LABELS: Record<string, string> = {
  [PUNISH_VERDICT_ADOPTED]: "採用",
  [PUNISH_VERDICT_UNREACHABLE]: "不採用",
};

// ===== materialize(パニッシュカウンター版の生成・M18-03b) =====

// ガード種別から登録コンボの hit_type への写像。リテラルを再定義せず、
// combo-list.ts の正典配列を参照する(DES-006 §2.7 errata)。
//
// ★★M27-01 で **位置インデックス参照から名前参照へ是正した**。
//   旧実装は HIT_TYPE_VALUES[2] / [3] と添字で引いており、正典配列の途中へ値を
//   挿入すると写像が別の hit_type を指す。しかも型は HitType のままなので
//   **型検査もテストも緑のまま静かに壊れる**。M27-01 が 4 値を足すにあたり、
//   「末尾へ足せば安全」という運用だけに頼らない形へ変えた。
// ★実行時検査は置かない。引数の型 HitType は HIT_TYPE_VALUES からの派生なので、
//   正典配列から値が消えれば **コンパイルで落ちる**。実行時 throw は到達不能なうえ、
//   本定数はモジュールのトップレベルで評価されるため、万一発火すると import 時に
//   投げてアプリ全体が白画面になる（失敗の仕方が悪い方に倒れる）。
//   ⇒ 型注釈だけで同じ安全性が得られる。
const byName = (name: HitType): HitType => name;

export const PUNISH_HIT_TYPE_BY_GUARD: Readonly<
  Partial<Record<string, HitType>>
> = {
  [PUNISH_GUARD_TYPE_BLOCK]: byName("punish_counter"),
  [PUNISH_GUARD_TYPE_JUST_PARRY]: byName("just_parry_punish_counter"),
};

// PUNISH_COUNTER_HIT_TYPES は materialize 対象外(§4.1)の hit_type 集合。
//
// ★★本集合は「対象外リスト」である —— ここに無い値は **既定で生成の対象になる**。
//   ⇒ 値を足したら、足した値がここに要るかを必ず判断すること。
//     「新しい値だから自動的に対象外」ではない。逆である。
//
// ★★M27-01 で drive_impact_punish_counter を足した(開発者確定 2026-09-02)。
//   理由＝名前上すでにパニッシュカウンターであるものに「パニッシュカウンター版を作る」
//   ボタンが出て、実際に作れてしまうため。
//   ★足したのは **生成の対象外にすることだけ** である。タブ分け(punishlist の
//     punishHitTypes)には足していない —— 開発者の逐語＝「名前だけパニッシュカウンター。
//     確定反撃のロジックは変更が必要で始動技がインパクトの時だけ使う」であり、
//     どのタブに置くか・始動技の制約をどう掛けるかは **別サブの判断**である。
//   ⇒ 本値は引き続き「区分を判定できない反撃」に出る。そこは変えていない。
//
// ★壁やられ 2 種と stun は足していない。PC ではないため、生成できてよい。
export const PUNISH_COUNTER_HIT_TYPES: ReadonlySet<string> = new Set([
  PUNISH_HIT_TYPE_BY_GUARD[PUNISH_GUARD_TYPE_BLOCK]!,
  PUNISH_HIT_TYPE_BY_GUARD[PUNISH_GUARD_TYPE_JUST_PARRY]!,
  byName("drive_impact_punish_counter"),
]);

// 生成元バッジのラベル(§4.8-2)。内部値(materializedFromComboId が非 NULL)と表示ラベルを分離する(L-7)。
export const MATERIALIZED_BADGE_LABEL = "PC版(生成)";

// MATERIALIZE_DAMAGE_SKIP_LABELS は加算しなかった理由コード → 表示文言(§4.3)。
// BE の combosvc.MaterializeDamage* と 1:1 で同期する
// (CLAUDE.md §4。silent に 0 加算せず理由を出す)。
export const MATERIALIZE_DAMAGE_SKIP_LABELS: Record<string, string> = {
  base_damage_null: "基底コンボにダメージが未入力のため、加算していません",
  starter_move_not_set: "始動技が未設定のため、加算していません",
  starter_move_damage_null: "始動技のダメージが未設定のため、加算していません",
  starter_move_not_pc_scaled:
    "Super Arts／Critical Arts は補正対象外のため、加算していません",
};

// 多段技の初段ダメージを moves から判別できないため、生成結果にかかわらず常に伝える。
export const MATERIALIZE_DAMAGE_ESTIMATE_NOTICE =
  "生成したダメージは、始動技が多段の場合に実測と異なる可能性があります。生成後に実測値へ調整してください。";

// 長文の生成結果は利用者が読み終えるまで残し、明示的に閉じられるようにする。
// 通常の短い toast には波及させないため、materialize 新規生成時だけ使用する。
export const MATERIALIZE_RESULT_TOAST_BEHAVIOR = {
  duration: Infinity,
  closeButton: true,
  className: "materialize-result-toast",
} as const;

// 連続生成では同種の結果を最新 1 件へ置換する。一方、加算スキップ理由は通常結果より
// 回復しにくい知識なので別 ID に残し、最大 2 件（通常／要注意）に制限する。
export const MATERIALIZE_RESULT_TOAST_ID = "materialize-result";
export const MATERIALIZE_ATTENTION_TOAST_ID =
  "materialize-result-attention";

export function materializeResultToastBehavior(
  damageSkipReason?: string,
) {
  return {
    ...MATERIALIZE_RESULT_TOAST_BEHAVIOR,
    id: damageSkipReason
      ? MATERIALIZE_ATTENTION_TOAST_ID
      : MATERIALIZE_RESULT_TOAST_ID,
  } as const;
}

export const PUNISH_SEARCH_LOCK_REASON =
  "確定反撃サーチからの登録では変更不可";

export function materializeDamageDescription(
  damageAdded: boolean,
  damageSkipReason?: string,
): string {
  if (damageAdded) {
    return `通常版の合計ダメージに、始動技ダメージの20%を加えて登録しました。${MATERIALIZE_DAMAGE_ESTIMATE_NOTICE}`;
  }
  if (damageSkipReason) {
    const skip =
      MATERIALIZE_DAMAGE_SKIP_LABELS[damageSkipReason] ??
      `ダメージ加算は行われませんでした（未対応の理由コード: ${damageSkipReason}）`;
    return `${skip}。PC版のダメージは元の値で登録しました。${MATERIALIZE_DAMAGE_ESTIMATE_NOTICE}`;
  }
  return `カウンター版からの変換のため、PC版のダメージは元の値で登録しました。${MATERIALIZE_DAMAGE_ESTIMATE_NOTICE}`;
}

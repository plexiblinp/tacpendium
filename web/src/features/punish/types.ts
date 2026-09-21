// 確定反撃サーチ(M18-02)の API DTO 型。バックエンド service/punishfinder の JSON 契約を手書きミラー。
// すべて camelCase(CLAUDE.md §4)。

export interface ComboNode {
  comboId: number;
  damage?: number;
  stepCount: number;
  hitType?: string; // 変換ボタン表示条件(§4.8・punish_counter 系は非表示)
  adopted: boolean;
  hasMaterializedVersion: boolean; // 有効な PC 版があれば true。相手技・draft 非依存
  recipe?: string; // 既定プリセットのレシピ表示文字列(欠損時は未設定)
}

export interface StarterNode {
  moveId: number;
  code: string;
  nameJa?: string;
  lane: string; // ground | dash | jump
  startup?: number;
  slack?: number; // ダッシュ経由の残り猶予(地上/ジャンプは未設定)
  verdict?: string; // adopted | unreachable | 未設定(未検証)
  note?: string;
  combos: ComboNode[];
}

export interface OpponentMoveNode {
  moveId: number;
  code: string;
  nameJa?: string;
  advantage: number;
  starters: StarterNode[];
}

// RegisteredComboNode は「自動判定できない相手技」の配下に出す登録済み確定反撃(M18-03a §4.5)。
// フレーム判定を経ておらず、成立ツリーの ComboNode(採否トグル付き)とは由来が違う。
export interface RegisteredComboNode {
  comboId: number;
  damage?: number;
  stepCount: number;
  hitType?: string;
  starterMoveCode?: string;
  starterMoveNameJa?: string;
  note?: string;
  recipe?: string;
}

export interface ManualReviewNode {
  moveId: number;
  code: string;
  nameJa?: string;
  reasonCode: string;
  registeredCombos: RegisteredComboNode[];
}

export interface PunishTree {
  selfCharacterId: number;
  opponentCharacterId: number;
  guardType: string;
  nodes: OpponentMoveNode[];
  manualReviewNodes: ManualReviewNode[];
}

// ===== 確定反撃マイリスト(使う画面・画面21・M18-03a) =====
// バックエンド service/punishlist の JSON 契約を手書きミラー。

// PunishListComboNode はコンボ行(第2階層)。
// 始動技は行の属性表示にとどめ階層を切らない(探す画面の 3 階層と意図的に非対称)。
export interface PunishListComboNode {
  comboId: number;
  damage?: number;
  stepCount: number;
  hitType?: string;
  starterMoveId?: number;
  starterMoveCode?: string;
  starterMoveNameJa?: string;
  note?: string; // combo_punishes.note(採用理由)
  materializedFromComboId?: number; // 非 NULL なら materialize 生成物。生成元バッジ用(M18-03b・§4.8-2)
  // ★★M31-01(P4M-014): この基底コンボからパニッシュカウンター版が既に作られている。
  //   ⇒ ①「反撃に転用可能なコンボ」から外し、件数だけを述べる(黙って消さない)。
  hasMaterializedVersion?: boolean;
  recipe?: string; // 既定プリセットのレシピ表示文字列(欠損時は未設定)
}

// PunishListMoveNode は相手技ノード(第1階層)。
export interface PunishListMoveNode {
  moveId: number;
  code: string;
  nameJa?: string;
  opponentCharacterId: number;
  opponentCharacterNameJa: string;
  combos: PunishListComboNode[];
}

// HiddenPruning は「確定反撃のない技」。コンボ非依存(自キャラ × 相手技)。
export interface HiddenPruning {
  opponentMoveId: number;
  code: string;
  nameJa?: string;
  opponentCharacterId: number;
  opponentCharacterNameJa: string;
  note?: string;
}

// HiddenCuration は「使わない反撃」。個別コンボ単位(コンボ × 相手技)。
export interface HiddenCuration {
  comboId: number;
  opponentMoveId: number;
  code: string;
  nameJa?: string;
  opponentCharacterId: number;
  opponentCharacterNameJa: string;
  starterMoveCode?: string;
  starterMoveNameJa?: string;
  note?: string;
}

export interface PunishList {
  selfCharacterId: number;
  opponentCharacterId?: number;
  guardType: string;
  hitType: string;
  nodes: PunishListMoveNode[];
  // unclassifiedNodes は hit_type が punish_counter / just_parry_punish_counter の
  // いずれでもない(通常 / カウンター / 未設定)採用済み反撃。タブに依らず両タブ共通で出す。
  unclassifiedNodes: PunishListMoveNode[];
  hiddenPrunings: HiddenPruning[];
  hiddenCurations: HiddenCuration[];
}

// 書き込みリクエスト。
export interface StarterVerdictRequest {
  selfCharacterId: number;
  opponentMoveId: number;
  starterMoveId: number;
  verdict: string;
  note?: string | null;
}

export interface PruningRequest {
  selfCharacterId: number;
  opponentMoveId: number;
  note?: string | null;
}

export interface CurationRequest {
  comboId: number;
  opponentMoveId: number;
  note?: string | null;
}

// MaterializeRequest は POST /api/combos/:id/materialize の入力(M18-03b §4.4)。
// :id(基底コンボ)はパスで渡し、body には含めない。opponentMoveId は必須。
export interface MaterializeRequest {
  opponentMoveId: number;
  note?: string | null;
}

// MaterializeResponse は materialize の出力(M18-03b §4.4)。
// alreadyExisted=true のとき comboId は既存コンボ(FE はリンクを出す・エラー扱いにしない)。
// damageSkipReason は加算しなかった理由コード(空=加算した or counter で不変)。文言は FE が写像する(L-7)。
export interface MaterializeResponse {
  comboId: number;
  alreadyExisted: boolean;
  damageAdded: boolean;
  damageSkipReason?: string;
}

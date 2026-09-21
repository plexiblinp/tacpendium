// コンボ API のドメイン型(手書き、Go 側 internal/api/combo/dto.go と目視で対応)。
// SUPP-001 §5.1 に従い、ステップは move_id と move_code の両方を保持する。
// 注: ComboSummary と ComboDetail / Combo は別 interface だが、バックエンド ComboResponse は同一型。
//     フィールド追加時は該当するすべてに追加すること(web/CLAUDE.md §2)。
//     ★対象は 3 つある(ComboSummary / ComboDetail / Combo)。ComboDetail は ComboSummary を
//     継承するため実際に手で足すのは ComboSummary と Combo の 2 つだが、「2 つ」と覚えないこと
//     ——Combo(編集用)への追加を忘れると、コンボ編集画面で型エラーまたは表示崩れが発生する。

import type { Tag } from "@/types/tag";
import type { CreateSetupInput, SetupSummary } from "@/features/setup/types";

export interface ComboStep {
  id: number;
  stepOrder: number;
  moveId?: number;
  moveCode?: string;
  modifiers?: ComboStepModifiers;
}

// 起き攻めオプション 1 件(combo_oki_options・M16-03 正規化)。
// attackType/techType は web/src/constants/oki.ts の列挙値、usesDr はドライブラッシュ有無。
// sparse: 配列に含まれる＝そのオプションが成立する。
//
// ★★M27-02b: 「まだ調べていない」と「調べたが成立するものが無かった」の区別は、
//   セル単位ではなく**コンボ単位**の okiVerified が持つ。
export interface OkiOption {
  attackType: string;
  techType: string;
  usesDr: boolean;
}

export interface ComboStepModifiers {
  flags?: string[];
  type?: string;
  notes?: string;
}

// バックエンド DTO のミラー定義(internal/api/combo/dto.go と同期)。
// 厳密な strict TypeScript で、CHANGE-001/003/006 反映済み(M1-06 v1.1.0 時点)。

export type Severity = "error" | "warning";

export interface ValidationIssue {
  code: string;
  severity: "error" | "warning" | "info";
  field?: string;
  message: string;
  // details は「どれが問題なのか」を id 付きで返す付帯情報(M23-04 §4.3-3)。
  // 復元 2 経路(M23-04)と登録 2 経路(M23-05・VAL-C14 / VAL-S07)の warnings が持つ。
  // 400 validation_failed の validations では常に undefined。
  details?: WarningDetails;
}

// WarningDetails は警告の details(M23-04 §4.3-3 / M23-05 §4.6)。
// 形は M23-02 の 409 setup_in_use の details.combos に揃えてある。
export interface WarningDetails {
  setups?: Array<{ id: number; name?: string }>;
  combos?: Array<{ id: number; memo?: string }>;
  // totalCount は一致した総件数(M23-05 §9.2)。setups / combos は上限で切られることが
  // あるため、文面の件数はこちらを優先して使う。M23-04 の VAL-R01 / VAL-R02 は
  // 上限を持たないので付かない。
  totalCount?: number;
}

export interface ValidationResult {
  issues: ValidationIssue[];
}

/**
 * ゲームの更新で変わった技 1 本(FR702・M28-02c / CHANGE-162 §1.2)。
 *
 * ★nameJa は引けないことがある —— 表示名は moves の列ではなく preset_aliases
 * (official_ja_move)由来であり、ラッシュ版は alias を持たない。
 * ⇒ 引けないときは code へ落とす(先例 = starterMoveNameJa / formatStarterStatus)。
 */
export interface AffectedMove {
  moveId: number;
  code: string;
  nameJa?: string | null;
  lastChangedGameVersion: string;
}

export interface ComboSummary {
  id: number;
  characterId: number;
  isDraft: boolean;
  damage?: number;
  starterMoveId?: number;
  position?: string;
  /** 始動位置のマス数(0〜160・M28-02a)。★保存の正本はこちら。 */
  startPositionMass?: number;
  /** 運び量(0〜160・M28-02a)。★始動位置とは別の値。 */
  carryDistanceMass?: number;
  /** このコンボが前提としているゲームバージョン(FR702・M28-02a)。 */
  baselineVersion?: string;
  /**
   * このコンボが使っている技のうち、基準より後に変わったものが在るか(FR702・M28-02a)。
   *
   * ★★保存された値ではなくサーバが毎回導出する値である。
   * ★★「影響可能性」であって破綻の断定ではない(FR307)。画面の語も「壊れている」にしないこと。
   * ★★必須である(M28-02c / CHANGE-162)。BE は omitempty を付けておらず false でも
   *   必ずキーが出る。⇒ 型を optional にすると「キーが無い = 判定していない」と
   *   false の区別が 1 段下で潰れる。★画面側で `?? false` を書かないこと。
   * ★★真偽の正本はこの 1 本である。affectedMoves.length で判定しないこと。
   */
  affectedByGameUpdate: boolean;
  /**
   * 実際に基準より後に変わった技の一覧(FR702 の目的そのもの・M28-02c / CHANGE-162 §1)。
   *
   * ★★空でも [] が返る(omitempty なし)。⇒ 「変わった技が無い」と「そもそも列挙して
   *   いない」を区別できる形にしてある。
   * ★★長さで影響の有無を判定しないこと —— 真偽が 2 か所で表せてしまい、それ自体が
   *   「判定条件を 2 か所に書く」の再発である。判定は affectedByGameUpdate を見る。
   */
  affectedMoves: AffectedMove[];
  opponentStance?: string;
  hitType?: string;
  opponentSize?: string;
  /**
   * ★M37-07: このコンボの始動技を持続当てしたか(重複判定キーの 8 つ目・D-874)。
   * ★API 応答では常に非 undefined(サーバは omitempty を付けない)。
   * ★step の modifier `meaty`(中途の技)とは別物である。
   */
  starterMeaty?: boolean;
  driveAvailableAtStart?: number;
  saAvailableAtStart?: number;
  driveDamage?: number;
  saGaugeConsumed?: number; // 消費 SA(0〜6・M16-02)。VAL 非連動
  driveGaugeConsumed?: number; // 消費 drive(0〜20・0.5 刻み・M16-02)。VAL 非連動
  knockdownAdvantage?: number;
  memo?: string;
  situation?: string;
  link?: string; // 外部リンク URL(M17-01)。文字列参照のみ・http/https のみリンク化
  videoPath?: string; // 動画の相対パス(M17-01)。テキスト表示のみ(遷移なし)
  imagePath?: string; // 画像の相対パス(M17-01)。テキスト表示のみ(遷移なし)
  okiOptions?: OkiOption[]; // 起き攻めオプション(M16-03 正規化)。API 応答では常に非 undefined(空配列可)
  // ★M27-02b: 起き攻めを一度でも調べたか(コンボ単位)。API 応答では常に非 undefined。
  okiVerified?: boolean;
  stepCount: number;
  defaultRecipe: string;
  starterMoveCode: string;
  // 始動技の表示名(公式日本語)。未登録なら undefined(M24-07)。
  // ★画面はこちらを出し、引けないときだけ starterMoveCode へ落ちる。
  starterMoveNameJa?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null; // ゴミ箱 API 用(通常コンボは undefined)
  // 置き換えた後継コンボの id(M23-01)。PUT(キー変更編集)で積まれた旧行だけが値を持つ。
  // ★画面はこの値を読まない。ゴミ箱の絞り込みはサーバ側の述語で完結している(指示書 §1.3-1)。
  supersededByComboId?: number | null;
  tags: Tag[];
  setups?: SetupSummary[];
}

export interface ComboDetail extends ComboSummary {
  steps?: ComboStep[];
  validations?: ValidationResult;
  setups?: SetupSummary[];
}

// RestoreComboResponse は POST /api/combos/:id/restore の 200 応答(M23-04 §4.3)。
//
// ★ComboSummary / ComboDetail / Combo の 3 分岐へ warnings を足していないのは意図で
// ある(web/CLAUDE.md §2)——バックエンドが warnings を設定するのは復元 2 経路だけで
// あり、一覧・詳細・編集の応答には現れない。3 分岐へ足すと「常にあるフィールド」に
// 見えてしまう。
export interface RestoreComboResponse extends ComboDetail {
  // ★0 件のときはキー自体が無い(バックエンドが omitempty)。空配列は返らない。
  warnings?: ValidationIssue[];
}

// CreateComboResponse は POST /api/combos の 201 応答(M23-05 §4.6)。
//
// ★M23-04 が復元 2 経路に作った warnings の器を、本サブが登録経路へ広げたもの。
// M23-04 §1.6-2 は「既存の登録・更新経路へ warnings を遡って足さない」としていたが、
// それは同サブの射程を守る線であり恒久の禁止ではない(M23-05 §4.6)。
// ★Combo(編集用)本体へ warnings を足していないのは RestoreComboResponse と同じ理由で
// ある——設定されるのは登録経路だけであり、一覧・詳細には現れない(web/CLAUDE.md §2)。
export interface CreateComboResponse extends Combo {
  // ★0 件のときはキー自体が無い(バックエンドが omitempty)。空配列は返らない。
  warnings?: ValidationIssue[];
}

export interface ComboListResponse {
  items: ComboSummary[];
  /** items の件数(= この応答に載った数)。 */
  count: number;
  /**
   * 絞り込みに一致する総数(LIMIT / OFFSET を掛けない数)。
   *
   * ★★count と別に持つ理由(M29-02 §2.1) —— 一覧は BE 側で既定 100 件・
   * 上限 1000 件にクランプされる。count だけでは「ちょうど 100 件だった」と
   * 「100 件で切り捨てた」を区別できず、呼び出し元は切り捨てに気づけない。
   * ⇒ total > count が「切り捨てた」の観測である。
   */
  total: number;
}

export interface ComboRecipeResponse {
  comboId: number;
  presetId: number;
  text: string;
}
export interface Modifiers {
  flags?: string[];
  type?: string;
  notes?: string;
}

export interface Step {
  id?: number;
  stepOrder: number;
  moveId?: number;
  moveCode?: string;
  modifiers?: Modifiers;
}

// 起き攻めオプション(M16-03 正規化)。編集用・リクエスト用の共通フィールドを 1 つの interface にまとめる。
// 従来の OkiBooleans(6 bool mixin)を置換。sparse: 配列に含まれる＝そのオプションが成立する。
// ★M27-02b: 「調べたか」は okiVerified(コンボ単位)が持つ。
export interface OkiOptionsHolder {
  okiOptions?: OkiOption[];
  // ★M27-02b(P4M-011): 起き攻めを一度でも調べたか。
  //   ★これが無いと「チェックが 1 つも無い」が「まだ調べていない」なのか
  //     「調べたが成立するものが無かった」なのか区別できない。
  okiVerified?: boolean;
}

export interface Combo extends OkiOptionsHolder {
  id: number;
  characterId: number;
  isDraft: boolean;
  damage?: number | null;
  starterMoveId?: number | null;
  position?: string | null;
  /** 始動位置のマス数(0〜160・M28-02a)。★保存の正本はこちら。 */
  startPositionMass?: number | null;
  /** 運び量(0〜160・M28-02a)。★始動位置とは別の値であり区分へ丸めない。 */
  carryDistanceMass?: number | null;
  /**
   * FR702 の基準と判定(M28-02a)。★★どちらも読み取り専用である ——
   * エディタは送らない(CreateComboRequest に対応欄が無い)。サーバが登録時に入れ、
   * 判定は SELECT のたびに導出する。
   */
  baselineVersion?: string | null;
  /** ★M28-02c: 必須。`?? false` を書かないための型である(ComboSummary と同じ理由)。 */
  affectedByGameUpdate: boolean;
  /** ★M28-02c: 空でも [] が来る。長さで影響の有無を判定しないこと。 */
  affectedMoves: AffectedMove[];
  opponentStance?: string | null;
  hitType?: string | null;
  opponentSize?: string | null;
  /**
   * ★M37-07: このコンボの始動技を持続当てしたか(重複判定キーの 8 つ目・D-874)。
   * ★API 応答では常に非 undefined(サーバは omitempty を付けない)。
   * ★step の modifier `meaty`(中途の技)とは別物である。
   */
  starterMeaty?: boolean;
  driveAvailableAtStart?: number | null;
  saAvailableAtStart?: number | null;
  driveDamage?: number | null;
  saGaugeConsumed?: number | null; // 消費 SA(0〜6・M16-02)。VAL 非連動
  driveGaugeConsumed?: number | null; // 消費 drive(0〜20・0.5 刻み・M16-02)。VAL 非連動
  knockdownAdvantage?: number | null;
  memo?: string | null;
  situation?: string | null;
  link?: string | null; // 外部リンク URL(M17-01)
  videoPath?: string | null; // 動画の相対パス(M17-01)
  imagePath?: string | null; // 画像の相対パス(M17-01)
  stepCount: number;
  defaultRecipe: string;
  starterMoveCode: string;
  starterMoveNameJa?: string | null; // 始動技の表示名(M24-07)
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null; // ゴミ箱 API 用(通常コンボは undefined)
  // 置き換えた後継コンボの id(M23-01)。ComboSummary と同じ理由で保持する。編集画面は読まない。
  supersededByComboId?: number | null;
  steps?: Step[];
  tags: Tag[];
  validations?: ValidationResult;
}

export interface SetupCarryOptionsInput {
  mode: "carry_all" | "unlink_all" | "individual";
  carrySetupIds?: number[];
}

export interface CreateComboRequest extends OkiOptionsHolder {
  characterId: number;
  isDraft: boolean;
  damage?: number | null;
  starterMoveId?: number | null;
  position?: string | null;
  /** 始動位置のマス数(0〜160・M28-02a)。★保存の正本はこちら。 */
  startPositionMass?: number | null;
  /** 運び量(0〜160・M28-02a)。★始動位置とは別の値であり区分へ丸めない。 */
  carryDistanceMass?: number | null;
  opponentStance?: string | null;
  hitType?: string | null;
  opponentSize?: string | null;
  /**
   * ★M37-07: このコンボの始動技を持続当てしたか(重複判定キーの 8 つ目・D-874)。
   * ★API 応答では常に非 undefined(サーバは omitempty を付けない)。
   * ★step の modifier `meaty`(中途の技)とは別物である。
   */
  starterMeaty?: boolean;
  driveAvailableAtStart?: number | null;
  saAvailableAtStart?: number | null;
  driveDamage?: number | null;
  saGaugeConsumed?: number | null; // 消費 SA(0〜6・M16-02)。VAL 非連動
  driveGaugeConsumed?: number | null; // 消費 drive(0〜20・0.5 刻み・M16-02)。VAL 非連動
  knockdownAdvantage?: number | null;
  memo?: string | null;
  situation?: string | null;
  link?: string | null; // 外部リンク URL(M17-01)
  videoPath?: string | null; // 動画の相対パス(M17-01)
  imagePath?: string | null; // 画像の相対パス(M17-01)
  steps: StepRequest[];
  tagIds?: number[];
  setupCarryOptions?: SetupCarryOptionsInput;
  setups?: CreateSetupInput[];
}

export interface StepRequest {
  stepOrder: number;
  moveId?: number | null;
  modifiers?: Modifiers;
}

// CHANGE-008: driveAvailableAtStart / saAvailableAtStart / driveDamage を追加。
// M3-02: tagIds 追加。undefined=変更なし、null は送信しない(空配列 [] で全解除)。
export interface UpdateMetadataRequest extends OkiOptionsHolder {
  version: number;
  isDraft?: boolean;
  damage?: number | null;
  driveAvailableAtStart?: number | null;
  saAvailableAtStart?: number | null;
  driveDamage?: number | null;
  saGaugeConsumed?: number | null; // 消費 SA(0〜6・M16-02)。VAL 非連動
  driveGaugeConsumed?: number | null; // 消費 drive(0〜20・0.5 刻み・M16-02)。VAL 非連動
  knockdownAdvantage?: number | null;
  /** 始動位置のマス数(0〜160・M28-02a)。★M37-01 で PATCH 契約へ追加。 */
  startPositionMass?: number | null;
  /** 運び量(0〜160・M28-02a)。★始動位置とは別の値であり区分へ丸めない。 */
  carryDistanceMass?: number | null;
  memo?: string | null;
  // CHANGE-041(M11-01): custom_states 単独編集の往復保持のため PATCH に situation を加算。
  situation?: string | null;
  // メディア 3 フィールド(M17-01)。presence-detection: null=クリア / 値=更新 / キー不在=不変更。
  link?: string | null;
  videoPath?: string | null;
  imagePath?: string | null;
  tagIds?: number[];
  setupCarryOptions?: SetupCarryOptionsInput;
}

export interface PutComboRequest extends CreateComboRequest {
  version: number;
}

export interface ComboErrorResponse {
  error: {
    code: string;
    message?: string;
    details?: {
      validations?: ValidationResult;
    };
  };
}

export interface CheckDuplicateRequest {
  characterId: number;
  starterMoveId?: number | null;
  position?: string | null;
  opponentStance?: string | null;
  hitType?: string | null;
  opponentSize?: string | null;
  /** ★M37-07: 重複判定キーの 8 つ目。省略は false(通常始動)。 */
  starterMeaty?: boolean;
  steps: StepRequest[];
  excludeComboId?: number;
}

// ComboDuplicateRef は「どのコンボか」を人が読める形で示す最小の組(M23-09 §4.1-3)。
// バックエンド model.ComboRef と対応する。
//
// ★combos に name 列は無く、memo がその役割を負う。空でも構わない——画面は
//   trash.warning.unnamedCombo(「コンボ {{id}}」)へ倒す。
// ★WarningDetails.combos とは今のところ別々に定義してある(あちらはインライン匿名型)。
//   共用していると読める記述を置かないこと——片方だけ直したときに静かにずれる。
export interface ComboDuplicateRef {
  id: number;
  memo?: string | null;
}

// CheckDuplicateResponse は POST /api/combos/check-duplicate の 200 応答。
//
// ★★生きた側(duplicates)と削除済み側(deletedDuplicates)は別のキーである(M23-09 §4.1-1)。
//   画面は生きた重複ではダイアログを出さない——既に VAL-C02 が ERROR で止めている。
// ★0 件でもキーは出て空配列になる(warnings の omitempty とは逆)。length で分岐してよい。
export interface CheckDuplicateResponse {
  duplicates: Array<{
    id: number;
    characterId: number;
    starterMoveId: number | null;
    position: string | null;
    opponentStance: string | null;
    hitType: string | null;
    opponentSize: string | null;
    /** ★M37-07。要求値のエコーバックである(行から読んだ値ではない)。 */
    starterMeaty: boolean;
    stepCount: number;
    // ★M23-09 §3.3-4 で追加。既存キーの名前と意味は変わっていない。
    memo?: string | null;
  }>;
  deletedDuplicates: ComboDuplicateRef[];
}

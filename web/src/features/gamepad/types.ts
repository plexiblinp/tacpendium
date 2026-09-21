// 物理ゲームパッド入力の取得基盤・機種プロファイル層の型（M21-01・DES-005 §6.2〜§6.4.1）。
//
// ★本層の役割は「機種差とブラウザ差を、この層より上へ漏らさない」ことである（指示書 §4.2）。
// 上（M21-02 以降）へ渡すのは論理ボタンの状態だけで、buttons / axes の index は外へ出さない。
//
// ★本ファイルの型は DOM の Gamepad 型に依存しない。テストから直接組み立てられるようにするため
// （指示書 §4.2-2 / §5.1(b)）。DOM Gamepad → GamepadSnapshot の変換は副作用層（useGamepadPolling）が行う。

import type { LogicalButton } from "@/features/combo/components/VirtualController/controllerTypes";

// ---------------------------------------------------------------------------
// 入力（Gamepad のスナップショット）
// ---------------------------------------------------------------------------

/** buttons[] の 1 要素。pressed（デジタル）と value（アナログ）の両方を持つ（指示書 §4.2-6）。 */
export interface GamepadButtonSnapshot {
  pressed: boolean;
  /** アナログ値。パッドのトリガーは 12 段階、レバーレスは 0/1 のみ（D-324 の実測）。 */
  value: number;
}

/**
 * ある時点の Gamepad の状態。
 *
 * ★mapping は保持するが判定の必須条件にはしない（指示書 §4.2-3）。
 * ★axes の本数は固定で仮定しない（指示書 §4.2-5）。Firefox は Chrome / Edge に無い要素を
 *   1 つ持つ場合があり、index が全軸ずれる。
 */
export interface GamepadSnapshot {
  id: string;
  index: number;
  /**
   * "standard" 等。
   *
   * ★normalize.ts は mapping を一切読まない（指示書 §4.2-3「必須条件にしない」）。
   * ★ただし**プロファイル解決層は読む**——`mapping === "standard"` の機体へ標準配置の既定を
   *   当てるため（`defaultProfile.ts`。2026-08-13 開発者判断）。**標準は「速い経路」であって
   *   「要件」ではない**: 標準でない機体は弾かれず、従来どおりキャリブレーションへ倒れる。
   * ★プロファイル鍵には使わない（鍵は `browserKey::padId`）。
   */
  mapping: string;
  buttons: readonly GamepadButtonSnapshot[];
  axes: readonly number[];
  timestamp: number;
}

// ---------------------------------------------------------------------------
// 物理バインディング（キャリブレーションの結果）
// ---------------------------------------------------------------------------

/**
 * 論理的な入力 1 つに対応する物理入力の指定。
 *
 * ★方向は buttons と axes のどちらに出るかが機体と HID 実装で変わるため、両方を表現できる
 * （指示書 §4.2-4 / §4.3-5）。axis 側は「どちら向きに倒したか」を sign で持つ。
 */
export type PhysicalBinding =
  | { kind: "button"; index: number }
  | { kind: "axis"; index: number; sign: -1 | 1; threshold: number };

/** axis を押下とみなすしきい値（静止値からの変位の絶対値）。 */
export const DEFAULT_AXIS_THRESHOLD = 0.5;

// ---------------------------------------------------------------------------
// キャリブレーションの対象
// ---------------------------------------------------------------------------

/**
 * 方向の四方（1P 側 = 右向き基準。inputResolutionStage2.ts の NumpadDirection と同じ流儀）。
 *
 * ★斜めは登録しない。実機のレバー・レバーレスは上下左右の 4 入力しか持たず、斜めは 2 つの
 * 同時状態で表現されるため（1 スナップショット内の状態合成であり、M21-02 が持つ「時間窓」の
 * 話ではない）。⇒ 利用者に押させるのは 4 方向だけで済み、指示書 §4.3-2「全部を埋めないと
 * 使えない形にしない」にも効く。斜めの導出は normalize.ts が行う。
 */
export type DirectionCardinal = "up" | "down" | "left" | "right";

export const DIRECTION_CARDINALS: readonly DirectionCardinal[] = [
  "up",
  "down",
  "left",
  "right",
] as const;

/**
 * 方向以外でキャリブレーション対象になる論理ボタン。
 *
 * 6 攻撃ボタンは必須、それ以外（マクロ・ステップ操作）は任意である。
 * ★DI（強P+強K）・DP（中P+中K）・投げ（弱P+弱K）は本来 6 ボタンの同時押しで出るものであり、
 *   専用の物理ボタンを持つ機体だけが登録すればよい。同時押しからの導出は M21-02 の範囲であって
 *   本サブでは行わない（指示書 §1.3）。ここでの登録はあくまで「マクロボタンがある機体向けの直接割当」。
 */
export type CalibrationButton = Extract<
  LogicalButton,
  | "light_punch"
  | "medium_punch"
  | "heavy_punch"
  | "light_kick"
  | "medium_kick"
  | "heavy_kick"
  | "drive_impact"
  | "drive_parry"
  | "throw"
  | "shortcut_prefix"
>;

/** 攻撃 6 ボタン。キャリブレーションの必須区間。 */
export const ATTACK_BUTTONS: readonly CalibrationButton[] = [
  "light_punch",
  "medium_punch",
  "heavy_punch",
  "light_kick",
  "medium_kick",
  "heavy_kick",
] as const;

/**
 * マクロボタン。任意区間。
 *
 * ★実機で「1 つの物理ボタンに割り当てられている」ものだけを載せる（2026-08-13 開発者判断）。
 * DI（強P+強K）・DP（中P+中K）・投げ（弱P+弱K）は SF6 側でマクロとして割り当てている利用者が
 * 実際にいるため残す。
 *
 * ★次の 5 件は載せない——**1 ボタンでは出せない入力であり、設定に出すこと自体が無意味**である。
 *   前投げ / 後ろ投げ（方向 ＋ 投げ）／ 前ステップ / 後ステップ（方向の 2 回入力）／
 *   ラッシュ（中P+中K のあと 6）。**空きボタンがほぼ無い実機で専用マクロを充てる余地も無い。**
 *   これらの論理ボタン自体は `LogicalButton` に残る。**物理バインディングを持たせないだけである。**
 *
 * ★**どのサブが生成するかは 5 件で分かれる**（M21-03 完了時点の実態へ是正）。
 *   - **`throw_forward` / `throw_back`**: **M21-03 が生成する。** 弱P＋弱K の同時押しを
 *     共通技の「投げ」へ写し、`StepCandidate.direction` の後方成分で向きを決める
 *     （M21-03 指示書 §4.2-2′ / §9.2-7）。**1 スナップショット内の状態合成であり方向の列を見ない。**
 *   - **`dash_forward` / `dash_back` / `parry_drive_rush`**: **M21-03 では生成しない。**
 *     いずれも**方向の連続入力**（ステップ＝方向の 2 回入力、ラッシュ＝中P+中K のあと 6）を
 *     要し、それはモーション解析にあたる。**契約 F-3 ／ M21-03 指示書 §4.1-1 による。**
 *     ★**旧記述「`M21-06`（実モーション入力）の領分である」は決着した**（M21-06・2026-08-14）。
 *     **答えは「物理からは出せないまま」である**——3 件はいずれも `move_commands` に 1 行も
 *     載っておらず（索引は技の公式コマンドだけを持つ）、コマンド技入力モードが突き合わせる
 *     相手が存在しない。⇒ 引き続き仮想側の共通技エリアで入れる。
 *
 * ★`step_commit` / `step_delete` も含めない。**M21-01 は「余ったボタンへの機能割当は M21-04」
 *   という前提で予約していたが、その前提は撤回された**——**`D-358`（2026-08-14）で方式が
 *   「前置きボタン ＋ 後続ボタンの順次入力」に確定し、1 ボタン ＝ 1 操作の対応表は採らない**。
 *   ⇒ **M21-04 はこの 2 件へ物理バインディングを与えていない**（割り当てる対象そのものが無い）。
 *   物理側の操作は {@link ACTION_BUTTONS} の前置き 1 件だけを登録する。
 */
export const OPTIONAL_BUTTONS: readonly CalibrationButton[] = [
  "drive_impact",
  "drive_parry",
  "throw",
] as const;

/**
 * 操作用ボタン（M21-04）。★技を出すためではなく「ショートカットを起こす」ために押すもの。
 *
 * ★**技用の論理ボタンと同じ `GamepadProfile.buttons` に格納するが、判定経路には流さない。**
 *   `normalizeSnapshot` が `NormalizeResult.actions` へ分離するため、`stepDetection` の
 *   押下集合には一切入らない。**混ぜて `states` へ流すと、前置きを押すたびに
 *   `classifyButtons` が `unknown_combination` を返して「解決できなかった入力」が出る。**
 *
 * ★格納先を既存の `buttons` にしているのは、キャリブレーションの二重割当検出・`withBinding` /
 *   `bindingOf`・取り直し導線・slug / ラベルがそのまま効くためである（別フィールドを作ると
 *   それら全部に分岐が要る）。**保存キーもレコードの版も変わらない。**
 *
 * ★**1 ボタン ＝ 1 操作の対応表は持たない**（`D-358` で撤回済み）。物理側に登録するのは
 *   **前置き 1 件だけ**で、どの操作を起こすかは後続の攻撃ボタンが決める（既に登録済み）。
 *   ⇒ `step_commit` / `step_delete` へ物理バインディングは与えない。
 */
export const ACTION_BUTTONS: readonly CalibrationButton[] = [
  "shortcut_prefix",
] as const;

/** キャリブレーションで 1 度押させる対象。 */
export type CalibrationTarget = DirectionCardinal | CalibrationButton;

// ---------------------------------------------------------------------------
// プロファイル
// ---------------------------------------------------------------------------

/**
 * 機体 1 台分のボタン対応表。
 *
 * ★既定プロファイルからの差分ではなく全体を持つ（指示書 §4.3-4 の見込みを採用）。
 * 差分にすると既定が変わったときに壊れるうえ、未知の機体では「既定」自体が存在しない。
 */
export interface GamepadProfile {
  version: 1;
  /** Gamepad.id。 */
  padId: string;
  /**
   * ブラウザ識別。★同じ機体でもブラウザで Gamepad.id が異なるため、id だけを鍵にしない
   * （指示書 §4.2-7）。導出は副作用層が行い、純粋関数へは引数で渡す。
   */
  browserKey: string;
  directions: Partial<Record<DirectionCardinal, PhysicalBinding>>;
  buttons: Partial<Record<CalibrationButton, PhysicalBinding>>;
}

/** localStorage に持つ全プロファイル。キーは profileKey()。 */
export type GamepadProfileStore = Record<string, GamepadProfile>;

// ---------------------------------------------------------------------------
// 出力（正規化の結果）
// ---------------------------------------------------------------------------

/**
 * 論理ボタン 1 つの状態。
 *
 * ★pressed（デジタル）と value（アナログ）の両方を上へ渡す（指示書 §4.2-6）。
 * どちらを判定に使うかは本サブでは決めない——M21-02 の範囲である。
 */
export interface LogicalButtonState {
  button: LogicalButton;
  pressed: boolean;
  value: number;
  /** buttons と axes のどちらから来たか。方向の由来を上位が知りたい場合に使う。 */
  source: "button" | "axis" | "derived";
}

/** 上下左右の生の押下状態（SOCD 相殺前）。 */
export interface CardinalState {
  pressed: boolean;
  /** アナログ量（レバーの倒し量）。デジタル入力の機体では 0/1。 */
  value: number;
  source: "button" | "axis";
}

/** 正規化の結果。★未知の形でも例外を投げず、解決できなかったことを返す（指示書 §5.1(d)）。 */
export interface NormalizeResult {
  /**
   * 押されているボタンと、現在の方向。
   *
   * ★方向は「イベント」ではなく「状態」であるため、割当が 1 つでもあれば**常に 1 つ入る**。
   * 未入力のときは `direction_neutral` が `pressed: true` で入る（「方向はニュートラルである」
   * という状態を表す）。⇒ `states` を「押されているものだけ」と読まないこと。
   * ボタン側は押されているもの（または value > 0 のもの）だけが入る。
   */
  states: LogicalButtonState[];
  /**
   * ★SOCD 相殺・斜め導出を行う前の生の上下左右。
   *
   * `states` の方向は左右同時を相殺し上下同時を上優先へ潰した「結果」であるため、
   * M21-02 が別の SOCD 規則（例＝後入力優先）を採りたくなったときに元の事実が要る。
   * 指示書 §1.3 の「生の事実を上へ渡すところまで。まとめない」に対応する。
   * 方向の割当が 1 つも無い場合は undefined。
   */
  cardinals?: Record<DirectionCardinal, CardinalState>;
  /**
   * ★操作用ボタン（{@link ACTION_BUTTONS}）の押下状態（M21-04）。
   *
   * ★**`states` とは別に返す。** 同じ配列へ入れると `stepDetection` の押下集合に混ざり、
   *   前置きボタンを押しただけでステップ候補が立つ（そして解決できずに読取表示へ出る）。
   *   分離しておけば **`stepDetection.ts` は本サブで 1 行も変わらない**。
   * ★押されているもの（または value > 0 のもの）だけが入る。割当が無ければ空配列。
   */
  actions?: LogicalButtonState[];
  /** false = プロファイルが無い／当たらない。呼び出し側はキャリブレーションへ倒す。 */
  resolved: boolean;
}

export type { LogicalButton };

import { z } from "zod";

import { MAX_POSITION_MASS } from "@/constants/position";

// クライアント側の最低限のフォーマットチェック(指示書 §4.6)。
// ビジネスバリデーション(VAL-C01〜C12)はサーバー側が真であり、
// ここでは「数値であること」「整数範囲」「文字列の最大長」程度に留める。
//
// SUPP-001 §2.1 の仮登録モード(is_draft=true)では starter_move_id NULL 許容のため、
// フォームレベルの制約は緩めてサーバーに判定を委ねる。
// ★★「recipe 0 件許容」は M24-13 / CHANGE-139 で撤回された。仮登録でもレシピの
//   ステップ 1 本以上を要する(VAL-C09 を仮登録へ適用した)。★ただし「技が未指定の
//   ステップ」は引き続き許される——VAL-D02 は 1 文字も変えていない。
//
// 想定入力: ComboEditor が `buildCreatePayload()` で空文字を null に変換した後の値。
// したがって本スキーマでは null/undefined を許容し、空文字は受け付けない。

const optInt = (min: number, max: number) =>
  z.number().int()
    .min(min, { message: `${min}以上の値を入力してください` })
    .max(max, { message: `${max}以下の値を入力してください` })
    .nullable().optional();

// drive_damage 用(C-11): -6〜6・小数許容(int 制約なし)。
const optFloat = (min: number, max: number) =>
  z.number()
    .min(min, { message: `${min}以上の値を入力してください` })
    .max(max, { message: `${max}以下の値を入力してください` })
    .nullable().optional();

export const modifiersSchema = z
  .object({
    flags: z.array(z.string()).optional(),
    type: z.string().optional(),
    notes: z.string().max(200).optional(),
  })
  .optional();

export const stepSchema = z.object({
  stepOrder: z.number().int().nonnegative(),
  moveId: z.number().int().positive().nullable().optional(),
  modifiers: modifiersSchema,
});

const comboFormBase = z.object({
  characterId: z.number().int().positive(),
  damage: optInt(0, 99999),
  starterMoveId: z.number().int().positive().nullable().optional(),
  position: z.string().min(1).nullable().optional(),
  // ★M28-02a: 始動位置のマス数と運び量(0〜160 の整数)。
  //   ★値域は DB の CHECK と同じ。FE を第一防衛線に置く(既存の数値欄と同じ流儀)。
  //   ★【2026-09-13・M37-01 で更新】旧記述「UI は M28-02b の射程」は失効した ——
  //     M28-02b は実装しないまま完了しており(M-137)、作ったのは M37-01 である。
  // ★M37-01: 近傍と同じ optInt ヘルパへ寄せた。制約は同一(int / 0〜160)であり、
  //   変わるのはメッセージが日本語になることだけ —— 3 方式入力 UI を出した以上、
  //   ValidationDisplay に英語の既定文が出るのは具合が悪い。
  startPositionMass: optInt(0, MAX_POSITION_MASS),
  carryDistanceMass: optInt(0, MAX_POSITION_MASS),
  opponentStance: z.string().min(1).nullable().optional(),
  hitType: z.string().min(1).nullable().optional(),
  opponentSize: z.string().min(1).nullable().optional(),
  // ★M37-07: 始動技の持続当て(重複判定キーの 8 つ目)。
  //   ★必須欄にしない —— 列は NOT NULL DEFAULT 0 であり、未送信は false(通常始動)。
  //     ⇒ REQUIRED_PUBLISHED_COMBO_FIELDS へは足さない。
  starterMeaty: z.boolean().optional(),
  driveAvailableAtStart: optFloat(0, 6), // M16-01: 0.5 刻み・小数許容(0〜6)
  saAvailableAtStart: optInt(0, 3),
  driveDamage: optFloat(-6, 6),
  // M16-02: 消費ゲージは VAL 非連動(記録/表示/比較のみ)。指示書 §3.4-5/§9.1 に従い zod で
  // 範囲 ERROR を設けず、範囲は UI ステッパー上限のみで担保する(BE/CSV も range=nil で型安全のみ)。
  // SA は整数型・drive は数値型のチェックだけ残す(範囲 min/max は付けない)。
  saGaugeConsumed: z.number().int().nullable().optional(),
  driveGaugeConsumed: z.number().nullable().optional(),
  knockdownAdvantage: optInt(-600, 600),
  memo: z.string().max(2000).nullable().optional(),
  // メディア 3 フィールド(M17-01)。緩検証=URL/パスの形式強制はしない(最大長のみ memo と同基準)。
  link: z.string().max(2000).nullable().optional(),
  videoPath: z.string().max(2000).nullable().optional(),
  imagePath: z.string().max(2000).nullable().optional(),
  // 起き攻めオプション(combo_oki_options・M16-03 正規化)。sparse: 含まれる=成立する。
  okiOptions: z
    .array(
      z.object({
        attackType: z.string(),
        techType: z.string(),
        usesDr: z.boolean(),
      }),
    )
    .optional(),
  // ★M27-02b: 起き攻めを一度でも調べたか(コンボ単位のフラグ)。
  okiVerified: z.boolean().optional(),
  // ★★M24-13 / CHANGE-139: recipe >= 1 は本登録・仮登録の**両方**に掛かる
  //   (VAL-C09 のクライアント側予防)。以前は公開モードだけに掛けていた。
  //   ★掛かる範囲を広げただけであり、モードごとに 2 本目を書き起こしていない
  //     ——条件を写すと静かにずれる(DES-006 §2.1 の規約)。
  //   ★数えるのはステップの本数だけ。move_id が未指定のステップも 1 本と数える
  //     (VAL-D02 の「うろ覚え」は変えていない)。
  steps: z.array(stepSchema).min(1, "レシピを 1 ステップ以上入力してください"),
});

// ★★M27-02b(`P4M-009`): 本登録で必須にする欄(開発者確定 2026-09-03)。
//
// ★空(null/undefined)を弾くだけで、値域には触らない。範囲は既存の optInt/optFloat と
//   UI ステッパーが持つ——消費ゲージ 2 欄は `DES-006` §2.5 が「範囲 VAL 非連動」と
//   定めており、**必須化を口実に範囲 ERROR を足さない**。
// ★必須の欄の一覧は constants/field-requirement.ts の
//   REQUIRED_PUBLISHED_COMBO_FIELDS が正典。★ここへ欄を足すときは向こうも直す
//   (画面の印と検証がずれる)。
const requiredMessage = "本登録では入力が必要です";

const required = <T extends z.ZodTypeAny>(schema: T) =>
  schema.refine((v) => v != null, { message: requiredMessage });

// 公開モード(is_draft=false)。
//
// ★★必須は**この側だけに掛ける**。仮登録は「未確定でも保存できる」入口として
//   設計されている(SUPP-001 §2.1)。⇒ comboFormSchemaDraft は触らない。
// ★★条件を写して 2 本目を書き起こさない(`DES-006` §2.1 の規約)。
//   本ファイルは元から公開/仮登録の 2 本立てであり、その分岐をそのまま使う。
//
// ★★★【M38-01・射程 3】VAL-C15 の欄は 2 度動いた。**現在は 2 欄である。**
//   着手前:     damage / knockdownAdvantage / driveGaugeConsumed / saGaugeConsumed
//   追補1 まで: damage / knockdownAdvantage / driveAvailableAtStart / saAvailableAtStart
//   **現在:     damage / knockdownAdvantage の 2 欄だけ**(2026-09-18 追補2)
//
// ★★★開始残量 2 欄は**任意**である(2026-09-18 開発者裁定)。⇒ 空欄＝NULL＝「不問」。
//   ★追補1 の時代はここへ書けない必須だった —— payload では「不問」と「空のまま」が
//     同じ `null` になるため、`required()` を掛けると不問の保存が落ちた。
//     ⇒ 門は features/combo/requiredPublished.ts が持っていた。**その門ごと消えた**
//       (区別を諦めたため)。⇒ 判定は zod だけに戻った。
//   ★必須の正典は constants/field-requirement.ts の REQUIRED_PUBLISHED_COMBO_FIELDS。
//
// ★★★**開始残量 2 欄の値域は生きている**(下の comboFormBase の optFloat(0,6) /
//   optInt(0,3))。⇒ 必須を外すのと値域を外すのは別である。
//
// ★消費ゲージ 2 欄の required は外した。**値域は元から無い**
//   (DES-006 §2.5「範囲 VAL 非連動」)ので、外したものは 1 つも無い。
//   担保は UI クランプ(numericInput.ts の clampNumericString)だけであり、そこは不変。
export const comboFormSchemaPublished = comboFormBase.extend({
  isDraft: z.literal(false),
  damage: required(comboFormBase.shape.damage),
  knockdownAdvantage: required(comboFormBase.shape.knockdownAdvantage),
});

// 仮登録モード(is_draft=true): starter_move_id NULL を許容(SUPP-001 §2.1)。
// ★レシピ 0 件の許容は M24-13 で撤回された(上記 comboFormBase.steps)。
export const comboFormSchemaDraft = comboFormBase.extend({
  isDraft: z.literal(true),
});

export type ComboFormValuesPublished = z.infer<typeof comboFormSchemaPublished>;
export type ComboFormValuesDraft = z.infer<typeof comboFormSchemaDraft>;

// is_draft の値で適切なスキーマを選び safeParse する。
export function parseComboForm(input: unknown) {
  const isDraft =
    typeof input === "object" &&
    input !== null &&
    "isDraft" in (input as Record<string, unknown>) &&
    (input as Record<string, unknown>).isDraft === true;
  return isDraft
    ? comboFormSchemaDraft.safeParse(input)
    : comboFormSchemaPublished.safeParse(input);
}

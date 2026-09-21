// 仮想コントローラの「何を出すか」を決める述語(M30-01、P4M-017)。
//
// ★★本ファイルが出し分けの唯一の正本である(指示書 M30-01 §2.5-2)。
//   タブ側(VirtualController)と全技一覧側(RecipeBuilder / SetupRecipeEditor の
//   プルダウン = SM-100)が、同じ関数を**両方向から**使う。
//   ⇒ 規則を 2 か所へ書かない。2 か所に書くと、片方だけ直されて静かにずれる。
//
// ★本ファイルは既存の解決規則を 1 つも作り直していない。段階2/段階1 は
//   inputResolutionStage2.ts、必殺技ファミリーは inputResolution.ts、共通技は
//   useControllerInput.ts の SYSTEM_BUTTON_TO_MOVE_CODE をそのまま呼ぶ。
//   ⇒ ここに在るのは「どの面へ載るか」の集約だけである。
//
// ★★【2026-09-10 更新・M30-03】必殺技ファミリー UI の規則が**完全に失効した**。
//   ★着手時点(M30-01)の規則＝「強度接尾辞を持たない move_code は載らない」
//     (`CHANGE-166` が明文化した意図された設計)。
//   ★M30-02 が A1(強度語がどこにも無い形・実測 187 件)を、
//     M30-03 が A2(強度語が `move_code` の**途中**に在る形・実測 105 件。
//     `lightning_beast_light_rolling_attack` 等)を取り込んだ。
//   ★★⇒ **いま「未分類」へ落ちる必殺技は 1 件も無い**(実測 0 件)。
//     `category==='special'` は全数が必殺技タブへ載る。
//   ★規則は `inputResolution.parseSpecialCode` の 1 か所に在り、
//     `isOnSpecialTab` はその全域性を前提に category だけを見る。
//
// すべて副作用なしの純関数。

import { MOVE_CODE_DRIVE_REVERSAL } from "@/constants/move-code";
import type { Move } from "@/features/moves/types";

import { SYSTEM_BUTTON_TO_MOVE_CODE } from "./components/VirtualController/useControllerInput";
import type { AttackButton, Strength } from "./inputResolution";
import type {
  CommandIndexEntries,
  NumpadDirection,
} from "./inputResolutionStage2";
import {
  resolveDirectionalInput,
  resolveDirectionalRushInput,
} from "./inputResolutionStage2";

// 通常技タブの入力面が持つ全組み合わせ(方向 9 × 強度 3 × ボタン 2)。
// ★HitBoxLayout の DIRECTIONS / ATTACKS と同じ母集合である。片方だけ増えると
//   「押せるのに未分類扱い」または「未分類なのに押せる」が静かにずれる。
//   ⇒ moveSurfacing.test.ts が **実際に両方を import して**一致を検査する
//     (M30-01 レビュー 高-2。旧版はこの注記だけを置いており、検査は存在しなかった)。
export const ALL_DIRECTIONS: readonly NumpadDirection[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];
export const ALL_STRENGTHS: readonly Strength[] = ["light", "medium", "heavy"];
export const ALL_BUTTONS: readonly AttackButton[] = ["punch", "kick"];

/**
 * 共通技タブが並べる move_code(並び順そのもの)。
 *
 * ★★M30-01 追補(2026-09-08 開発者指示): タブ外の常設行から**タブへ移設**した。
 *   移設前の常設行が持っていたのは 6 code だけで、**移動系の 7 code
 *   (前入力 / 後ろ入力 / 微歩き 2 / ジャンプ 3)はどの面にも出ていなかった**
 *   ——実 DB で 217 行(7 code × 31 キャラ)が未分類へ落ちていた。
 * ★13 code すべてが実 DB に 31 キャラぶん在り、`official_ja_move` の表示名も付いている
 *   (前入力 / 微歩き(前) / 垂直ジャンプ …)。⇒ ラベルは nameJa をそのまま使う。
 * ★生ラッシュ(`parry_drive_rush`)はここに入れない。move ではなく `modifiers.type`
 *   だからである(`DES-004` §2.1)。タブには別途ボタンとして置く。
 */
export const COMMON_MOVE_CODES: readonly string[] = [
  "forward",
  "back",
  "micro_forward",
  "micro_back",
  "jump_neutral",
  "jump_forward",
  "jump_back",
  "drive_impact",
  "drive_parry",
  "throw_forward",
  "throw_back",
  "dash_forward",
  "dash_back",
];

const COMMON_MOVE_CODE_SET: ReadonlySet<string> = new Set(COMMON_MOVE_CODES);

/**
 * 入力面へ 1 つも出さない move_code(M31-04 / SM-098)。
 *
 * ★★「どのタブにも載らない」とは別物である。未分類タブは「どのタブにも載らない技」を
 *   並べる面であり、そこへ落ちれば結局は押せてしまう。⇒ 未分類からも外す必要がある。
 * ★★drive_reversal は防御リバーサルでありコンボ部品ではない(`DES-002` §4)。
 *   確定反撃の「相手の技」として走査に出れば足りる(2026-09-10 開発者判断・段 4)。
 * ★実測: 本集合が無いと、行を入れた時点で自動的に未分類タブへ並ぶ ——
 *   `isControllerSurfaced` が false を返すためである。**「何もしない」は「出さない」に
 *   ならない。**
 * ★共通技タブの固定 13 code には 1 文字も触っていない(指示書 §3-2)。
 * ★★【面の数え上げ・2026-09-10 開発者判断】ここでいう「入力面」は**仮想コントローラの
 *   タブ(未分類を含む)と全技一覧のプルダウンの 2 面**である。
 *   **他から引っ越し(IntakeHelperPage)は含めない** —— 逆引き
 *   (internal/service/intake の別名照合)も技セレクタも drive_reversal を素通しするが、
 *   **これは塞ぎ忘れではなく、対象外と決めた結果である**(開発者の逐語＝
 *   「ユーザーがあり得ないコンボを入れたりとかは考えなくていい」)。
 *   ★⇒ 次に触る人が「穴だ」と読んで勝手に塞がないこと。塞ぐなら判断のやり直しである。
 * ★★【2026-09-12 更新・M31-06】旧記述「`setup_only` 列とは別の仕組みである……⇒ 流用しない」は
 *   **失効した**。⇒ `setup_only` は本集合へ足すのではなく、**同じ判定 isInputExcluded() の
 *   2 つ目の理由**として入った(`D-810`)。
 * ★本集合は**静的な `code` 列挙のまま**であり、`setup_only` の行は 1 つも足さない ——
 *   由来が違うためである(こちらはフロント定数、あちらはデータ駆動のフラグ)。
 * ★★本集合は**面に関係なく外れる**。⇒ drive_reversal はセットプレイのレシピ入力でも出ない。
 *   **面で分かれるのは `setup_only` だけである**(コンボ側だけ外す)。⇒ isInputExcluded の注記。
 */
export const INPUT_EXCLUDED_MOVE_CODES: ReadonlySet<string> = new Set([
  MOVE_CODE_DRIVE_REVERSAL,
]);

/**
 * 入力面の「面」(M31-06)。
 *
 * ★★セットプレイのレシピ入力(SetupRecipeEditor)は、コンボ登録(RecipeBuilder)と
 *   **同じ VirtualController・同じ useControllerInputOmission を共有している。**
 *   ⇒ 部品の中で setup_only を落とすと、セットプレイからも消える。
 *   **セットプレイのレシピ入力が setup_only の技の唯一の入り口である**ため、それは事故である
 *   (指示書 M31-06 §4.1)。
 * ★★既定値の扱いは 2 通りに分かれている(M31-06 レビュー 高-1 で実物に合わせた)。
 *   ・isInputExcluded / useControllerInputOmission / VirtualController の prop …… **必須**。
 *     ⇒ 面を宣言しない呼び出しを型検査で止める。
 *   ・surfaceBuckets の第 4 引数だけ **既定 "combo" を持つ**。★これは暫定である ——
 *     共有テスト moveSurfacing.roster.test.ts が同関数を 6 か所で呼んでおり、必須にすると
 *     M30-05 と同じファイルを奪い合うためである(指示書 M31-06 §0.7)。
 * ★★★したがって「既定に頼ってよい」ではない。⇒ **本番の呼び元は 1 つ(VirtualController)
 *   しか無く、そこは必ず明示して渡す。** 新しい面を足すときも明示すること ——
 *   既定へ落ちた面では setup_only が静かに消える(本サブ最大の事故の形である)。
 * ★M30-05 のマージ後に既定を外す手番は、M31-06 完了報告 §6.3 で設計卓へ請求してある
 *   (followup-backlog を編集できるのは設計卓のみである＝`D-382`。
 *    §J は停止時記録の面であり、改善候補の置き場ではない)。
 */
export type RecipeInputContext = "combo" | "setup";

/**
 * 入力面へ一切出さない技か(M31-04 / M31-06)。
 *
 * ★★理由は 2 つあり、**面での効き方が違う**。⇒ それでも入口は本関数 1 本だけである(`D-810`)。
 *   1. INPUT_EXCLUDED_MOVE_CODES に載る code …… **両面**で外れる(静的なフロント定数)。
 *   2. move.setupOnly が立っている ……………………… **コンボ側だけ**外れる(データ駆動のフラグ)。
 * ★★軸が 2 つ並ぶこと自体は避けられない(由来が違う)。**揃えるのは入口だけでよい**
 *   (`followup` の input-excluded-codes-vs-setup-only-overlap)。
 *
 * ★★【2026-09-12 更新・M31-06】旧記述「効く範囲は呼び出し元 2 か所だけ」「タブ側の 5 バケットと
 *   isControllerSurfaced は本関数を呼ばない」「効かせるなら各バケットの push 直前へ足す」は
 *   **失効した**。⇒ surfaceBuckets が**先頭で 1 回だけ母集団を絞る**形になり、
 *   **仮想コントローラの 8 タブすべて**(未分類を含む)と全技一覧プルダウンに効く。
 *   ★★変えた理由＝drive_reversal は category='system' でどのタブにも載らなかったため
 *     旧構造でも表面化しなかったが、**setup_only は任意の category に立ちうる。**
 *     ⇒ 旧構造のままだと「未分類とプルダウンからは消えるのにタブには出続ける」を確実に踏む
 *     (それは旧注記自身が予告していた状態である)。
 *
 * ★★isControllerSurfaced の中へ入れてはならない —— 「除外＝掲載済み」と読み替わり、
 *   omittedCount と「トグル ON で残る集合＝未分類タブ」の一致が同時に壊れる。
 *   ⇒ **M31-06 も入れていない。** 母集団を先に絞る形を採ったので、同関数の中身は 1 行も動いていない。
 */
export function isInputExcluded(
  move: Move,
  context: RecipeInputContext,
): boolean {
  // 理由1: 静的な code 列挙(M31-04)。★面に関係なく外す。
  if (INPUT_EXCLUDED_MOVE_CODES.has(move.code)) return true;
  // 理由2: setup_only(M31-06)。★コンボ側だけ外す —— セットプレイのレシピ入力では出す。
  return context === "combo" && move.setupOnly;
}

// ★移設前の常設行が引いていた 6 code。★COMMON_MOVE_CODES の部分集合であることを
//   moveSurfacing.test.ts が検査する(移設で押せなくなった code が出ないため)。
export const LEGACY_SYSTEM_ROW_CODES: ReadonlySet<string> = new Set(
  Object.values(SYSTEM_BUTTON_TO_MOVE_CODE),
);

// SA タブが並べる category。
const SUPER_ART_CATEGORIES: ReadonlySet<string> = new Set([
  "super_art",
  "critical_art",
]);

// ラッシュ版 move_code の接頭辞(DES-004 §2.1 の `rush_<元技code>`)。
const RUSH_PREFIX = "rush_";

/** 仮想コントローラの面(タブ ＋ タブ外の共通技行)。 */
export type ControllerSurface =
  | "normal"
  | "unique"
  | "special"
  | "super_art"
  | "target_combo"
  | "common"
  | "character_state";

/**
 * 通常技タブから到達できる moveId の集合。
 *
 * 段階2 の解決表 → 段階1 の構造引き、およびラッシュトグル ON の解決を、
 * 入力面が持つ全組み合わせについて実際に走らせて集める。
 * ★「たぶんこの category が出る」ではなく、現物の解決関数を引いて数える。
 */
export function normalTabMoveIds(
  moves: Move[],
  entries: CommandIndexEntries,
): Set<number> {
  const ids = new Set<number>();
  for (const dir of ALL_DIRECTIONS) {
    for (const strength of ALL_STRENGTHS) {
      for (const button of ALL_BUTTONS) {
        const plain = resolveDirectionalInput(
          moves,
          entries,
          dir,
          strength,
          button,
        );
        if (plain) ids.add(plain.moveId);
        const rush = resolveDirectionalRushInput(
          moves,
          entries,
          dir,
          strength,
          button,
        );
        if (rush) ids.add(rush.moveId);
      }
    }
  }
  return ids;
}

/** 特殊技タブへ並ぶか(ラッシュトグル ON で到達する rush_<unique code> を含む)。 */
export function isOnUniqueTab(move: Move, moves: Move[]): boolean {
  if (move.category === "unique") return true;
  if (!move.code.startsWith(RUSH_PREFIX)) return false;
  const baseCode = move.code.slice(RUSH_PREFIX.length);
  return moves.some((m) => m.code === baseCode && m.category === "unique");
}

/**
 * 必殺技タブ(ファミリー UI)へ並ぶか。
 *
 * ★deriveSpecialFamilies が使うのと同じ条件である。
 * ★★【2026-09-10 更新・M30-03】`parseSpecialCode` が**全域になった**
 *   (A2 = 強度語が code の途中に在る形・実測 105 件を取り込んだ)。
 *   ⇒ **条件は category==="special" の 1 つだけになった。**
 *   ★`parseSpecialCode(...) !== null` を残さない —— 常に真である枝は
 *     「まだ何かを弾いている」と読ませる。**弾いていない。**
 *   ★実測(母集団 = `moves` テーブル): 必殺技タブから漏れる special は **0 件**。
 *   ★★「同じ条件である」ことは moveSurfacing.test.ts が
 *     deriveSpecialFamilies を実際に呼んで検査する(注記だけにしない)。
 */
export function isOnSpecialTab(move: Move): boolean {
  return move.category === "special";
}

/** SA タブへ並ぶか。 */
export function isOnSuperArtTab(move: Move): boolean {
  return SUPER_ART_CATEGORIES.has(move.category);
}

/** ターゲットコンボタブへ並ぶか(M30-01 / P4M-007・SM-135)。 */
export function isOnTargetComboTab(move: Move): boolean {
  return move.category === "target_combo";
}

/** 共通技タブへ並ぶか(M30-01 追補)。 */
export function isOnCommonTab(move: Move): boolean {
  return COMMON_MOVE_CODE_SET.has(move.code);
}

/**
 * 仮想コントローラのいずれかの面から入力できるか(M30-01 の出し分け規則そのもの)。
 *
 * ★★`SM-100`(全技一覧から分類済みの技を省く)はこの関数の**裏返し**を使う。
 *   ⇒ 述語は 1 本しかない。
 * ★★未分類タブは本関数が false を返す move だけを並べる。
 *   ⇒ 未分類タブ自身は「掲載済み」に数えない(数えると自己参照で空になる)。
 * ★★2026-09-08 開発者判断(案 C): **キャラ固有状態タブは「掲載済み」に数える**。
 *   ⇒ 同じ技が未分類にも固有状態にも出る重なり(実測 45 件 / 5 キャラ)が消え、
 *     「未分類 ＝ 7 枚のどのタブからも押せない技」に定義が揃う。
 *   ★このため本関数は stateCodes を要る。渡さなければ固有状態タブは無いものとして扱う。
 */
export function isControllerSurfaced(
  move: Move,
  moves: Move[],
  entries: CommandIndexEntries,
  normalIds?: ReadonlySet<number>,
  stateCodes: readonly string[] = [],
): boolean {
  const ids = normalIds ?? normalTabMoveIds(moves, entries);
  return (
    ids.has(move.id) ||
    isOnUniqueTab(move, moves) ||
    isOnSpecialTab(move) ||
    isOnSuperArtTab(move) ||
    isOnTargetComboTab(move) ||
    isOnCommonTab(move) ||
    isOnCharacterStateTab(move, stateCodes)
  );
}

/**
 * move が載る面を 1 つ返す(未分類なら null)。優先順は
 * 共通技 → 通常技 → 特殊技 → 必殺技 → SA → ターゲットコンボ → キャラ固有状態。
 *
 * ★複数の面に載る move は実在する(例: 段階2 の特殊技優先で通常技タブからも
 *   押せる `unique` の技)。本関数はそのうち 1 つを返すだけであり、
 *   タブの描画には使わない(描画は各面の述語が直接決める)。
 *   ⇒ 報告・デバッグ用の要約である。
 */
export function surfaceOf(
  move: Move,
  moves: Move[],
  entries: CommandIndexEntries,
  normalIds?: ReadonlySet<number>,
  stateCodes: readonly string[] = [],
): ControllerSurface | null {
  const ids = normalIds ?? normalTabMoveIds(moves, entries);
  if (isOnCommonTab(move)) return "common";
  if (ids.has(move.id)) return "normal";
  if (isOnUniqueTab(move, moves)) return "unique";
  if (isOnSpecialTab(move)) return "special";
  if (isOnSuperArtTab(move)) return "super_art";
  if (isOnTargetComboTab(move)) return "target_combo";
  if (isOnCharacterStateTab(move, stateCodes)) return "character_state";
  return null;
}

/** 各タブが並べる move の一覧(出現順を保持する)。 */
export interface SurfaceBuckets {
  /**
   * 入力面へ出す母集団(isInputExcluded で落とした後の moves)。
   *
   * ★★通常技タブと必殺技タブは**バケットを持たない** —— 前者は押下のたびに
   *   resolveDirectionalInput が解決し、後者は deriveSpecialFamilies がファミリーへ畳むためである。
   *   ⇒ その 2 タブが**他の 6 面と同じ母集団**を引くための口である(M31-06)。
   * ★★呼び手が自前で filter し直さないこと。**絞り込みの適用点は surfaceBuckets の 1 か所である。**
   */
  inputMoves: Move[];
  unique: Move[];
  superArt: Move[];
  targetCombo: Move[];
  /** 共通技タブ。★COMMON_MOVE_CODES の並び順で返す(seed の行順ではない)。 */
  common: Move[];
  /** キャラ固有状態タブ(P4M-008 (b))。 */
  characterState: Move[];
  /** どの面からも入力できない move(未分類タブの母集団)。 */
  unclassified: Move[];
}

/**
 * タブ描画用のバケットを 1 回の走査で作る。
 * ★必殺技タブだけは deriveSpecialFamilies が既にファミリーへ畳んでいるため
 *   ここでは配らない(同じ 2 条件であることは moveSurfacing.test.ts が検査する)。
 *   ⇒ 同タブと通常技タブは、代わりに buckets.inputMoves を母集団として引く(M31-06)。
 *
 * ★★context は面である(M31-06)。既定を "combo" にしてあるのは**テストの呼び出しの都合**であり、
 *   **本番の呼び元 VirtualController は必ず明示して渡す**。⇒ 面を黙って既定に任せないこと。
 */
export function surfaceBuckets(
  moves: Move[],
  entries: CommandIndexEntries,
  stateCodes: readonly string[] = [],
  context: RecipeInputContext = "combo",
): SurfaceBuckets {
  // ★★入力面から外す技は、ここで 1 回だけ落とす(M31-06)。
  //   ⇒ 以降の判定・バケット構築・走査はすべてこの母集団しか見ない。
  // ★★M31-04 は unclassified 分岐の中だけで落としていた。⇒ タブ側の 5 バケットと、
  //   バケットを持たない通常技 / 必殺技タブには効いていなかった
  //   (drive_reversal が category='system' でどのタブにも載らない code だったため、
  //    表面化しなかっただけである)。★setup_only は任意の category に立ちうる。
  // ★これは判定の「押し下げ」ではなく「引き上げ」である ——
  //   規則は依然 isInputExcluded の 1 本しかない(2 本目を作らない＝`D-810`)。
  const inputMoves = moves.filter((m) => !isInputExcluded(m, context));
  const normalIds = normalTabMoveIds(inputMoves, entries);
  const buckets: SurfaceBuckets = {
    inputMoves,
    unique: [],
    superArt: [],
    targetCombo: [],
    // ★共通技だけは並び順を COMMON_MOVE_CODES で決める。利用者が覚える並びであり、
    //   seed の行順に任せるとキャラごとに変わってしまう。
    common: COMMON_MOVE_CODES.map((code) =>
      inputMoves.find((m) => m.code === code),
    ).filter((m): m is Move => m != null),
    characterState: characterStateMoves(inputMoves, stateCodes),
    unclassified: [],
  };
  for (const move of inputMoves) {
    // ★特殊技タブが**ボタンとして並べる**のは category==="unique" の行だけである。
    //   ラッシュ版(rush_<unique code>)はボタンにならず、ラッシュトグル ON のときに
    //   同じボタンの解決先が差し替わる。⇒ 並びは category、到達可否は isOnUniqueTab。
    if (move.category === "unique") buckets.unique.push(move);
    if (isOnSuperArtTab(move)) buckets.superArt.push(move);
    if (isOnTargetComboTab(move)) buckets.targetCombo.push(move);
    // ★未分類は「どのタブにも載らない技」の面である。⇒ 入力面から外した技は
    //   そもそも inputMoves に居ないため、ここへ落ちることもない。
    //   ★CHANGE-176 §2.5 の等式「未分類 ＝ 裏返し ∧ 非除外」は変わっていない。
    //     ∧ 非除外 の位置が、この分岐から母集団の側へ移っただけである(M31-06)。
    if (!isControllerSurfaced(move, inputMoves, entries, normalIds, stateCodes)) {
      buckets.unclassified.push(move);
    }
  }
  return buckets;
}

// --- キャラ固有状態タブ(M30-01 / P4M-008 (b)・開発者判断 2026-09-08 の「読み2」) ---

/**
 * 状態コードの後置語。★これを落とした語幹でも技コードを照合する(案 A′)。
 *
 * ★★2026-09-08 開発者判断。**状態コードと技コードの語が食い違うキャラが在る**ため。
 *   実例＝`mai` は状態が `flame_stock`、技が `flame_light_kachousen` であり、
 *   そのままでは 1 件も当たらなかった(開発者の実機確認で判明)。
 * ★実測の効き目(定義を持つ 14 キャラ):
 *   mai 0 → 26 ／ ingrid 0 → 31 ／ juri 2 → 11 ／ kimberly 0 → 6 ／ yasmine 1 → 5。
 * ★★それでも救えないキャラが 2 体残る——`aki`(状態 `poisoned` に対応する技名が無い)と
 *   `m_bison`(状態 `psycho_mine_is_set` に対し技は `mine_set_*` で語順が違う)。
 *   ⇒ この形が増えるなら、状態定義そのものに「技コードの接頭辞」を持たせる案 D へ移る。
 *     設計卓への申し送り事項である(完了報告 §6)。
 */
const STATE_CODE_SUFFIXES: readonly string[] = [
  "_stock",
  "_mode",
  "_is_set",
  "_crest",
  "_charge",
];

/** 状態コードを、そのままの形と後置語を落とした語幹の両方へ広げる。 */
export function expandStateCodes(codes: readonly string[]): string[] {
  const out = new Set<string>();
  for (const code of codes) {
    if (code === "") continue;
    out.add(code);
    for (const suffix of STATE_CODE_SUFFIXES) {
      if (code.endsWith(suffix)) out.add(code.slice(0, -suffix.length));
    }
  }
  return [...out];
}

/** キャラ固有状態タブへ並ぶか。 */
export function isOnCharacterStateTab(
  move: Move,
  stateCodes: readonly string[],
): boolean {
  if (stateCodes.length === 0) return false;
  return expandStateCodes(stateCodes).some((code) => move.code.includes(code));
}

/**
 * キャラ固有の状態(`characters.custom_states`)に紐づく技を集める。
 *
 * ★★判定軸は「`move_code` が、そのキャラの `custom_states[].code`(またはその語幹)を
 *   含むか」である。⇒ 新しい列を足していない(指示書 §2.2-3 / §4-5)。API も変えていない
 *   (`Character.customStates` は既に配られている生 JSON である)。
 *
 * ★★2026-09-08 開発者判断(案 C)により、本タブは「掲載済み」に数える。
 *   ⇒ ここに並ぶ技は未分類タブへは出ない(重なりが消えた。実測 45 件 / 5 キャラ)。
 *
 * ★偽陽性を落としていない。SA の行(`sa2_feng_shui_engine` 等 4 件)は
 *   状態を発生させる技そのものであり、無関係ではないためである。
 */
export function characterStateMoves(
  moves: Move[],
  stateCodes: readonly string[],
): Move[] {
  if (stateCodes.length === 0) return [];
  const keys = expandStateCodes(stateCodes);
  return moves.filter((m) => keys.some((code) => m.code.includes(code)));
}

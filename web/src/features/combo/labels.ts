// 状況コード値の表示用ラベルマップ(SUPP-001 §3.2)。
// CHANGE-003: opponent_stance に "any" を追加。
// CHANGE-006: counter_type → hit_type にリネーム。
//
// ★★本ファイルは「エディタだけが読む」定義である。一覧・詳細・比較・出力・フィルタ・
//   重複警告・utils の 7 面は constants/combo-list.ts の LABELS 群を読む。
//   ⇒ 同じ値の呼び名を持つマップが 2 本ある状態であり、2026-08-28 の実測では
//     17 値中 3 値が割れていた〔any / normal / counter〕。
//   ★M24-12 で any を正典へ寄せた(開発者指示)。
//   ★★M24-08 で normal / counter も「通常 / カウンター」へ寄せて決着した
//     (開発者裁定 2026-08-30)。⇒ 3 値の割れはすべて解消した。
//     判断材料は 3 つ:
//       (1) 読み手が 7 面 対 1 面で、短い側が多数派である
//       (2) 同じマップの他の値が「パニッシュカウンター」であり「ヒット」を
//           付けていない。長い側は同一マップ内で接尾が不揃いだった
//       (3) 英語は元から 1 系統(Normal / Counter)である
//     ★併せて確定させたこと: followup `combo-labels-normal-counter-split` は
//       「ComboEditorBasicFields 236 行の直書きを触らずには畳めない」と書いていたが、
//       これは失効している。同ファイルは実測 910 行で直書きは無く、
//       本ファイルの HIT_TYPE_OPTIONS を import している。
//   ★★2 本のマップの統合そのものは横断リファクタであり、本サブでも行わない。

import {
  OPPONENT_STANCE_LABELS,
  POSITION_VALUES,
} from "@/constants/combo-list";

/**
 * 中立の選択肢の呼び名。
 * ★2026-08-28 開発者指示で「未指定」→「不問」。値は空文字(保存時 NULL)のまま。
 */
export const UNSPECIFIED_LABEL = "不問";

/**
 * 旧データ(NULL)を読み込んだときだけ出す空選択肢の呼び名。
 *
 * ★★★【M38-01】**使う欄が 2 つになった。**
 *   ★以下は失効した記述:「『相手の状態』の空選択肢の呼び名」——
 *     `hitTypeOptionsFor` も本定数を使う。
 *
 * ★★`UNSPECIFIED_LABEL`("不問")と別にしてある理由は**欄ごとに違う**。
 *   - **相手の状態**: 同じ欄に「不問」が 2 つ並ぶのを避けるため。この欄の中立は
 *     `"any"`(不問)であり、空文字は「M24-04 より前に保存された値」を表すだけの
 *     後方互換の選択肢である。
 *   - **ヒット種別**(M38-01): あちらに `"any"` は無い。⇒ 「2 つ並ぶ」問題は起きない。
 *     ★別にしている理由は**「不問」を選択肢から消したことを打ち消さないため**である。
 *     値域(`SUPP-001` §3.2 の 8 値)に「不問」は無く、消したはずの語が既存行の編集で
 *     だけ戻ると、消し残しに見える。
 *
 * ★どちらの欄でも意味は同じ ——「この値は選べる状態ではなく、読み込んだ値である」。
 */
export const LEGACY_UNSPECIFIED_LABEL = "(未指定)";

// ★★M28-02a: 5 → 7 区分(D-733)。新値は mid_self / mid_opponent。
//   ★語の源泉は ja.json であり、本表はそこからの写しである
//   (label-keys.test.ts が両者の一致を機械検査する)。
export const POSITION_LABEL_JA: Record<string, string> = {
  corner_self: "自分画面端",
  corner_self_near: "自分画面端寄り",
  mid_self: "自分中央寄り",
  mid_screen: "画面中央",
  mid_opponent: "相手中央寄り",
  corner_opponent_near: "相手画面端寄り",
  corner_opponent: "相手画面端",
};

// ★★並び順は POSITION_VALUES(constants/combo-list.ts)から導出する。
//   ★★着手前は本配列が独立した写しであり、一覧フィルタと エディタ で
//     並び順が別々に定義されていた。⇒ 片方だけ直すと静かにずれる。
//   ★エディタのボタン並びと数字キー割当(1..9,0)は本配列の index で決まるため、
//     順序は表示順の正本(POSITION_VALUES)に従わせる。
export const POSITION_OPTIONS: ReadonlyArray<{
  value: string;
  label: string;
}> = POSITION_VALUES.map((value) => ({
  value,
  label: POSITION_LABEL_JA[value],
}));

export const OPPONENT_STANCE_LABEL_JA: Record<string, string> = {
  standing: "立ち",
  crouching: "しゃがみ",
  airborne: "空中",
  // ★★M24-12: 「どちらでも可」はエディタだけの呼び名だった。
  //   一覧・詳細・比較・出力・フィルタ・重複警告・utils の 7 面は、正典
  //   (constants/combo-list.ts の OPPONENT_STANCE_LABELS)の「不問」を表示している。
  //   ⇒ 正典を参照して割れを解く(2026-08-28 開発者指示＝「未指定は不問に変えたい」)。
  //   ★ここを直接 "不問" と書かないのは、同じ値の呼び名を 2 か所に持つと
  //     また割れるためである。
  any: OPPONENT_STANCE_LABELS.any,
};

// ★★M24-12: 中立の選択肢(不問 = any)を一番左へ置く(2026-08-28 開発者指示)。
//   ★「相手の状態」だけ中立の値が 2 つある——空文字(保存時 NULL)と "any"。
//     既定は M24-04(SM-093)以来 "any" であり、本サブでも変えない
//     (DES-006 §2.4。空文字へ戻すと保存値が変わり、重複判定キーと一覧フィルタで
//      別の値になる)。⇒ 中立を兼ねるのは "any" の側であり、空文字の選択肢は
//     既定では出さない(旧データを読み込んだときだけ出す＝下記 stanceOptionsFor)。
export const OPPONENT_STANCE_OPTIONS: ReadonlyArray<{
  value: string;
  label: string;
}> = [
  { value: "any", label: OPPONENT_STANCE_LABEL_JA.any },
  { value: "standing", label: OPPONENT_STANCE_LABEL_JA.standing },
  { value: "crouching", label: OPPONENT_STANCE_LABEL_JA.crouching },
  { value: "airborne", label: OPPONENT_STANCE_LABEL_JA.airborne },
];

/**
 * 「相手の状態」の選択肢。
 *
 * ★★現在値が空文字のときだけ「(未指定)」を足す。
 *   M24-04 より前に保存されたコンボは opponent_stance が NULL であり、読み込むと
 *   空文字になる。選択肢に無いと「何も選ばれていない」状態が画面から説明できない。
 *   ★読込値は書き換えない(CHANGE-137 §2「編集・コピーは読込値のまま」)。
 *   ⇒ 新規登録では出ない。既定は "不問"(any) のままである。
 */
export function stanceOptionsFor(
  currentValue: string,
): ReadonlyArray<{ value: string; label: string }> {
  if (currentValue !== "") return OPPONENT_STANCE_OPTIONS;
  return [
    ...OPPONENT_STANCE_OPTIONS,
    { value: "", label: LEGACY_UNSPECIFIED_LABEL },
  ];
}

// ★M27-01: 8 値。並びは constants/combo-list.ts の HIT_TYPE_VALUES と同じにする
//   ——エディタの数字キーは配列の順に 1..9 が割り当たるため、他面と並びが違うと
//   「一覧では 5 番目なのにエディタでは 7 番目」が起きる。
export const HIT_TYPE_LABEL_JA: Record<string, string> = {
  normal: "通常",
  counter: "カウンター",
  punish_counter: "パニッシュカウンター",
  just_parry_punish_counter: "パニッシュカウンター(ジャストパリィ反撃)",
  drive_impact_wall_splat_hit: "インパクト壁やられ(ヒット)",
  drive_impact_wall_splat_block: "インパクト壁やられ(ガード)",
  drive_impact_punish_counter: "パニッシュカウンター(インパクト)",
  stun: "スタン",
};

export const HIT_TYPE_OPTIONS: ReadonlyArray<{
  value: string;
  label: string;
}> = [
  { value: "normal", label: HIT_TYPE_LABEL_JA.normal },
  { value: "counter", label: HIT_TYPE_LABEL_JA.counter },
  { value: "punish_counter", label: HIT_TYPE_LABEL_JA.punish_counter },
  {
    value: "just_parry_punish_counter",
    label: HIT_TYPE_LABEL_JA.just_parry_punish_counter,
  },
  {
    value: "drive_impact_wall_splat_hit",
    label: HIT_TYPE_LABEL_JA.drive_impact_wall_splat_hit,
  },
  {
    value: "drive_impact_wall_splat_block",
    label: HIT_TYPE_LABEL_JA.drive_impact_wall_splat_block,
  },
  {
    value: "drive_impact_punish_counter",
    label: HIT_TYPE_LABEL_JA.drive_impact_punish_counter,
  },
  { value: "stun", label: HIT_TYPE_LABEL_JA.stun },
];

/**
 * 「ヒット種別」の選択肢。
 *
 * ★★★【M38-01・射程 5】着手前、本欄は `withUnspecifiedFirst()` を通しており
 *   **値域に無い「不問」が先頭かつ既定**で出ていた(M24-12・2026-08-28 開発者指示で
 *   4 欄へ一律に足したもの)。⇒ 開発者が画面で見た「1 不問」の正体はこれである
 *   (「1」はラベルではなく `shortcutKeyForIndex(0)` が描く数字キー)。
 *   ★`SUPP-001` §3.2 の値域は 8 値であり「不問」を含まない。⇒ 選択肢から外した。
 *   ★★外したのは**選択肢**からであって値域からではない。`HIT_TYPE_OPTIONS` も
 *     `HIT_TYPE_VALUES` も `model.HitType*` も 1 つも動かしていない。
 *
 * ★★形は `stanceOptionsFor` と同型である —— **現在値が空文字のときだけ**
 *   「(未指定)」を足す。理由も同じで、`hit_type` が NULL の既存行を読み込むと
 *   空文字になり、選択肢に無いと「何も選ばれていない」状態が画面から説明できない。
 *   ★読込値は書き換えない(`CHANGE-137` §2「編集・コピーは読込値のまま」)。
 *   ⇒ 新規登録では出ない。既定は "normal"(通常)である。
 *
 * ★★★既存の NULL 行を `normal` へ寄せるマイグレは作らない(2026-09-17 開発者裁定)。
 *   ⇒ `hit_type` は重複判定キーの 1 つであり(`SUPP-001` §2.2)、寄せると
 *     既存の `normal` 行と同じキーになりうる。★その衝突を数えるには実 DB が要る。
 *   ⇒ だから本ヘルパが要る。**寄せない代わりに、読み込んだ値を見せ続ける。**
 *
 * ★足すのは末尾である(先頭ではない)。⇒ 先頭へ足すと 8 値の数字キー割当が
 *   1 つずつずれ、「通常」が 1 でなくなる。
 */
export function hitTypeOptionsFor(
  currentValue: string,
): ReadonlyArray<{ value: string; label: string }> {
  if (currentValue !== "") return HIT_TYPE_OPTIONS;
  return [...HIT_TYPE_OPTIONS, { value: "", label: LEGACY_UNSPECIFIED_LABEL }];
}

// ★M27-01: 3 値 → 4 値。medium → standard へ改名し、large を新設した。
// ★large1 / large2 のラベルに例示キャラを入れたのは開発者指示(2026-09-02)であり、
//   **全面で同じラベルを出す**——エディタだけ長くして他面を短くすると、同じ値が
//   画面によって違う名前で出る。⇒ locale(ja.json)側と 1 文字も違えないこと。
export const OPPONENT_SIZE_LABEL_JA: Record<string, string> = {
  standard: "標準",
  large: "大",
  large1: "大1(ザンギエフ等)",
  large2: "大2(マリーザ等)",
};

export const OPPONENT_SIZE_OPTIONS: ReadonlyArray<{
  value: string;
  label: string;
}> = [
  { value: "standard", label: OPPONENT_SIZE_LABEL_JA.standard },
  { value: "large", label: OPPONENT_SIZE_LABEL_JA.large },
  { value: "large1", label: OPPONENT_SIZE_LABEL_JA.large1 },
  { value: "large2", label: OPPONENT_SIZE_LABEL_JA.large2 },
];

// modifiers.flags の選択肢(SUPP-001 §3.3.1 / DES-004 §2.3、固定選択式・自由入力不可)。
// M15-03: OD 組(od_lm/od_mh/od_lh)・一段目キャンセル(first_hit_cancel)・
// 垂直/前ジャンプ中(neutral_jump/forward_jump)を追加(非スキーマ・既存 flag と衝突なし)。
// OD 組は必殺技 OD 4 種フラット(inputResolution.OD_VARIANT_FLAG)から自動付与される。
//
// ★★★【M37-06】数が 2 つある。混ぜないこと(開発者が全件決めた表＝`D-873`):
//
//   選択肢 = 14 値 … MODIFIER_FLAGS_COMMON(11) + MODIFIER_OD_VARIANT_FLAGS(3)
//   引き当て = 17 件 … 上記 ＋ MODIFIER_FLAGS_RETIRED(3)
//
// ★★★選択肢から外した 3 値の**表示語は消さない**。既存行が持っており、消すと
//   ModifiersSummary のフォールバック(`?? f`)で内部コードが画面へ出る。
//   ⇒ M37-02(B04)が消した「内部識別子むき出し」が戻る(指示書 §4.1 の「最大の危険」)。
//
// ★表示語の正本は 3 か所に在る(CHANGE-199 / DES-004 §2.3):
//   ① Go の flagText(internal/service/notation/resolver.go)
//   ② 本ファイル
//   ③ DES-004 §2.3
//
// ★★★【M37-06 で状況が変わった】① ⇄ ② の一致は
//   modifier-flag-labels.sync.test.ts が機械検査する(両向き)。
//   ⇒ 旧記述「機械検査は無い」は失効した。
//   ★★ただし ③(DES-004 §2.3)は依然として検査の外である。⇒ ③ だけは片側だけ直しても
//     表示は壊れないが**設計書が嘘になる**状態が、人が読む以外の経路で見つからない。
//   ★check-enum-sync.sh が flags を見ていないことは今も事実である —— 本定義が
//     web/src/constants/ ではなく features/combo/ に在るためであり、上記の同期テストは
//     その穴を「照合」で塞いだだけで、定数の置き場は動かしていない
//     (followup `modifier-flag-labels-triplicated-without-check` の「定数の移設」は未了)。
export interface ModifierFlagOption {
  value: string;
  label: string;
}

// ★★M30-02(SD-020): 常時出す群と OD 強度組合せ群を分けた。
//   OD 組は (a) 既定非表示・展開で出す (b) そのステップが必殺技の OD のときだけ選択可、
//   の 2 つを同時に満たす必要があり、常時出す群とは扱いが違う。
//   ⇒ 「どちらの群か」をデータで持たせないと、描画箇所ごとに条件が散る
//     (着手時点の描画箇所は RecipeBuilder と ModifiersEditor の 2 か所である)。
// ★★M37-06(D-873): 7 → 11 値。削除 3 ／ 追加 7 ／ 表示語の変更 1(low_jump)。
//   ★分類は DES-004 §2.3 に合わせてある(並び順＝分類順)。追加 7 値で「当て方・位置系」が
//     1 分類増えた。★分類の見出しは画面へ出さない —— 出すと縦が伸び、M37-02 の成果を食う。
export const MODIFIER_FLAGS_COMMON: ReadonlyArray<ModifierFlagOption> = [
  // タイミング系
  { value: "delay", label: "ディレイ" },
  // ★link は*難易度*の注記である(「特定のタイミングでぴったり押す」)。接続がキャンセルで
  //   ないことは no_cancel が表す。⇒ 別の要素であり、統合も排他化もしない(D-873)。
  { value: "link", label: "目押し" },
  // キャンセル系
  // ★キャンセルの既定は「キャンセルである」。⇒ 何も付いていないステップはキャンセルで
  //   繋いだと読む。「キャンセルした」を表す flag は作らない(M37-06 §0.4)。
  { value: "first_hit_cancel", label: "一段目キャンセル" },
  { value: "no_cancel", label: "ノーキャン" },
  { value: "late_cancel", label: "遅らせキャンセル" },
  // 空中・浮かせ系
  // ★M37-06: 表示語を「低ジャンプ」→「低空」へ(一般語から遠かった)。★コードは不変。
  { value: "low_jump", label: "低空" },
  // ★juggle_ の接頭辞は「相手の高度に対する当て方」を示す。high_hit / low_hit にしないのは
  //   *上段 / 下段*(ガード方向)と読まれるためである(開発者承認 2026-09-14)。
  { value: "juggle_high", label: "高め当て" },
  { value: "juggle_low", label: "低め当て" },
  // 当て方・位置系
  { value: "whiff", label: "空振り" },
  // ★meaty は**中途の技**向けである。始動技の持続当ては combos の列であり別サブ(M37-07)。
  { value: "meaty", label: "持続当て" },
  { value: "cross_under", label: "裏回り" },
];

/**
 * 選択肢から外したが、**表示語は残す** flag(M37-06 §2.3)。
 *
 * ★★★消さないこと。既存行がこの値を持っており、表示語が無いと ModifiersSummary の
 *   フォールバック(`?? f`)で `just` のような内部コードが画面へ出る。
 *   ⇒ M37-02(B04)が消した状態が戻る(指示書 §4.1)。
 * ★データ移行はしない。既存行の modifiers は 1 行も書き換えない ——
 *   modifiers は**重複判定キーの一部**であり(SUPP-001)、書き換えると recipe_hash が
 *   変わって重複判定と recipe_cache が同時に狂う(指示書 §4.6)。
 * ★外した理由は「使われていないから」ではない(D-857＝利用者はまだいない)。
 *   move 側と**重複している**からである:
 *     just         … 技のジャスト版は move の `perfect` 変種に在る
 *     neutral_jump … ジャンプ方向は move(jump_neutral / jump_forward / jump_back)で表す
 *     forward_jump … 同上
 */
export const MODIFIER_FLAGS_RETIRED: ReadonlyArray<ModifierFlagOption> = [
  { value: "just", label: "ジャスト" },
  { value: "neutral_jump", label: "垂直ジャンプ中" },
  { value: "forward_jump", label: "前ジャンプ中" },
];

// OD 強度組合せ(SD-020)。値は inputResolution.OD_VARIANT_FLAG と対応する。
// ★値の集合は変えない(M30-02 指示書 §4-4)。変えたのは「いつ出すか」だけである。
export const MODIFIER_OD_VARIANT_FLAGS: ReadonlyArray<ModifierFlagOption> = [
  { value: "od_lm", label: "OD(弱中)" },
  { value: "od_mh", label: "OD(中強)" },
  { value: "od_lh", label: "OD(弱強)" },
];

// ★表示名の引き当て用(ModifiersSummary / RecipeText)。**選択肢の描画には使わない**——
//   描画側は上の 2 群を別々に扱う必要がある(既定非表示と活性条件が違うため)。
// ★★★RETIRED を含めるのは引き当て側だけである。⇒ 選択肢は 14、引き当ては 17。
//   混ぜると「選択肢に外したはずの値が戻る」か「既存行が内部コードで出る」の
//   どちらかが起きる(M37-06 §2.3)。
export const MODIFIER_FLAGS: ReadonlyArray<ModifierFlagOption> = [
  ...MODIFIER_FLAGS_COMMON,
  ...MODIFIER_OD_VARIANT_FLAGS,
  ...MODIFIER_FLAGS_RETIRED,
];

// modifiers.type の選択肢(SUPP-001 §3.3.3、非技ステップ)
//
// dash(方向別)は M16-04(④'' dash 一本化)で撤去。移動は「1入力=1move」で
// system move dash(category=system の move)として扱うのが canonical(DES-004 §2.1)。
// 非技ステップ type は「技でも移動でもない、隣接ステップの出し方」に限る(生/キャンセルラッシュ)。
//
// ★★★M37-06(§2.6-3): parry_drive_rush の表記の割れを解消した。
//   着手前はサーバ(notation/resolver.go の nonMoveTypeText)が「生ラッシュ」、
//   UI が「パリィドライブラッシュ」であり、同じステップが画面によって別名で出ていた
//   (DES-004 §2.3 が実測として記録していた 1 件。followup
//    `modifier-display-differs-editor-and-viewer`)。
//   ⇒ **一般語である「生ラッシュ」へ寄せた**(指示書 §2.6-3 の指定)。サーバ側は変えていない。
//
// ★★cancel_drive_rush にも同型の割れが残っている(サーバ「キャンセルラッシュ」/
//   UI「キャンセルドライブラッシュ」)。**本サブでは触らない** —— 指示書が名指ししたのは
//   parry の 1 件だけであり、開発者が 2026-09-14 に「そのままでよい」と裁定した。
//   ⇒ 事実として残す。畳むなら別サブで両側をまとめて決めること。
export const MODIFIER_NON_MOVE_TYPES: ReadonlyArray<{
  value: string;
  label: string;
}> = [
  { value: "parry_drive_rush", label: "生ラッシュ" },
  { value: "cancel_drive_rush", label: "キャンセルドライブラッシュ" },
];

// M24-04(SM-112): 非技ステップの optgroup / 区分フィルタの呼び名。
//
// ★旧称は「共通システム（移動・その他）」だった。開発者の指摘＝「システムと、共通システム
//   （移動・その他）が意味が被りすぎててわかりにくい」。被りに加えて、旧称は事実としても
//   誤っていた——M16-04 で dash は category=system の move へ一本化されたため、
//   category=system の optgroup(「システム」)が移動(ダッシュ・ジャンプ・微歩き)と
//   ドライブパリィを持ち、この非技グループは移動を 1 つも含んでいない。
//   中身は MODIFIER_NON_MOVE_TYPES の 2 件、すなわちドライブラッシュ 2 種だけである。
//
// ⇒ 「システム」の語を落とし、中身をそのまま名乗る形にした。
//   これで 2 つの区分は「技か、技以外か」で読み分けられる。
// ★★振り分けの原則(どの技がどちらへ入るか)は M16-04 のまま。変えていない。
// ★★この 2 つは RecipeBuilder と SetupRecipeEditor の 2 か所に出る。定数を 1 本にして
//   片側だけ直る事故を塞ぐ(旧称は 4 箇所へリテラルで複製されていた)。
export const NON_MOVE_GROUP_LABEL_JA = "技以外（ドライブラッシュ）";
export const MOVE_SELECT_PLACEHOLDER_JA = "技・ドライブラッシュを選択";

/** プルダウンの区分フィルタで「非技ステップ」のみ表示する擬似区分値。 */
export const NON_MOVE_FILTER = "__nonmove__";

// 起き攻めのラベルは M16-03 正規化で web/src/constants/oki.ts へ集約済み
// (OKI_ATTACK_TYPE_LABELS / OKI_TECH_TYPE_LABELS / okiOptionLabel)。従来の OKI_FIELDS(6 bool 用)は撤去。

// M16-06(A-3/FB⑨⑪⑬): 始動ゲージ残量ラベルの正典(ja)。
// 従来「始動残量」(比較)/「開始残量」(詳細・エクスポート)の 2 表記が並立していたのを
// 「コンボ開始時の◯◯ゲージ残量」へ統一(開発者確定 2026-07-07)。誤解を防ぐための長ラベル。
// i18n サーフェス(詳細/比較)はロケールファイルが SSOT。本定数は t() を使えない
// 非コンポーネント文脈(エクスポート export-items/export-model)および入力欄で参照し、綴りの散在を防ぐ。
// ★2026-08-28(M24-04)で撤回した——消費側も下の GAUGE_CONSUMED_LABEL_JA として
//   定数化した。旧記述「消費側は既に一貫のため定数化不要」はもう当たらない。
export const GAUGE_AT_START_LABEL_JA = {
  drive: "コンボ開始時のドライブゲージ残量",
  sa: "コンボ開始時のSAゲージ残量",
} as const;

// M24-04(SM-007 / SM-101): ゲージ欄のラベルは 4 通り(始動側・消費側 × ドライブ・SA)ある。
// 従来は始動側だけが上の定数を持ち、消費側と括弧の注記は入力欄への直書きだった。
// ⇒ 4 通りを 1 か所で組み立てる形へ寄せた(第 2 の語彙を作らない。CHANGE-137 §3-3)。
export const GAUGE_CONSUMED_LABEL_JA = {
  drive: "ドライブゲージ消費",
  sa: "SAゲージ消費",
} as const;

export type GaugeKind = keyof typeof GAUGE_AT_START_LABEL_JA;
export type GaugeSide = "start" | "consumed";

const GAUGE_STEM_JA: Record<GaugeSide, Record<GaugeKind, string>> = {
  start: GAUGE_AT_START_LABEL_JA,
  consumed: GAUGE_CONSUMED_LABEL_JA,
};

// 括弧の中の注記。
// ★★上限をラベルに書くのは、その上限に根拠が説明できるときだけにする(CHANGE-137 判断10・
//   2026-08-27 開発者裁定)。ドライブ始動の 6 は実機のゲージ本数、SA の 3 は SA の本数で
//   根拠が説明できる。ドライブ消費の 20 は根拠が薄いため「書かない」——実際の上限 20 は
//   変えていない(UI クランプ側に残る。DES-006 §2.5 のとおり VAL は非連動)。
// ★★M24-12(D-582)で失効: 旧規則は「『0.5刻み』は上限ではなく入力の作法なので書く」だった。
//   スピナー撤廃で 0.5 刻みという作法自体が無くなったため、この行は成り立たない。
//   ⇒ 置き換わった規則は下の段落にある（小数は上限を書ける欄でだけ `6.0` の形で示す）。
//
// ★★M24-12(D-582・2026-08-29): スピナーを撤廃したため「0.5刻み」は事実でなくなった。
//   ★★不変条件そのものが消えている——`step=0.5` だけが 0.5 刻みを担保しており、
//     BE は範囲しか検証していない(DES-003 / DES-006 VAL-C04)。⇒ `1.3` が保存される。
//     **開発者はこれを承知のうえで許容すると裁定した**(指示書 §4.9.1)。
//   ★ドライブ始動は `0〜6.0本` の `.0` で「小数が入る」を伝える
//     (先例＝`ドライブダメージ(-6.0〜6.0)`。DES-005 §5.7)。
//   ★★ドライブ消費は注記が空になる——上限 20 に根拠が薄く書けず(上記)、
//     小数を伝える器も無いためである。**これは許容する**(指示書 §4.9.2)。
//   ★SA 2 欄は変えない(開発者が名指ししていない＝指示書 §9.1)。
//
// ★★M29-01(開発者裁定 3-A・2026-09-06): SA 始動へも「本」を付けた。
//   ★着手前は同じ SA ゲージが始動側「(0〜3)」・消費側「(0〜6本)」で割れていた。
//     SM-007(2026-08-27)が名指ししたのが SA 消費の 1 件だけだったためである。
//   ⇒ 「本」を付ける側(＝SM-007 が選んだ側)へ揃えた。sa_available_at_start は
//     INTEGER(0〜3)であり、本数表記が意味的にも正しい。
//   ★ドライブ消費の注記が空のままなのは D-582 の裁定どおりである(上限 20 に
//     根拠が説明できない)。⇒ 「揃っていない」と読んで足さないこと。
const GAUGE_NOTE_JA: Record<GaugeSide, Record<GaugeKind, string>> = {
  start: { drive: "0〜6.0本", sa: "0〜3本" },
  consumed: { drive: "", sa: "0〜6本" },
};

/**
 * ゲージ入力欄の日本語ラベルを組み立てる(4 通りの正典)。
 *
 * ★★注記が空のときは括弧ごと出さない。`ドライブゲージ消費()` になるのを防ぐ
 *   (M24-12・D-582 でドライブ消費の注記が空になった)。
 */
export function gaugeFieldLabelJa(side: GaugeSide, kind: GaugeKind): string {
  const note = GAUGE_NOTE_JA[side][kind];
  const stem = GAUGE_STEM_JA[side][kind];
  return note === "" ? stem : `${stem}(${note})`;
}

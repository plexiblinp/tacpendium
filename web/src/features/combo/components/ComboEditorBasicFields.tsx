import { useMemo, useState, type ReactNode } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FieldRequirementBadge } from "@/components/FieldRequirementBadge";
import { InfoMark } from "@/components/InfoMark";
import { positionFromMass, representativeMassOf } from "@/constants/position";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ComboDraftToggleField } from "./ComboDraftToggleField";
import { CollapsibleFieldset } from "./CollapsibleFieldset";
import {
  MYCOMBO_STATUS_LABELS,
  MYCOMBO_STATUS_REMOVE_LABEL,
  MYCOMBO_STATUS_VALUES,
  TAG_CATEGORY_MYCOMBO_STATUS,
  type MyComboStatus,
} from "@/constants/mycombo";
import { TagSelector } from "@/features/tag/components/TagSelector";
import { useMyComboStatusTags } from "@/features/mycombo/hooks/useMyComboStatusTags";
import {
  FIELD_OPTIONAL,
  FIELD_REQUIREMENT_LEGEND,
  requirementOf,
  type FieldRequirement,
} from "@/constants/field-requirement";
import { jaLabel } from "@/lib/ja-label";
import {
  STARTER_MEATY_LABEL,
  STARTER_MEATY_LABELS,
  STARTER_MEATY_VALUES,
} from "@/constants/combo-list";

import {
  gaugeFieldLabelJa,
  stanceOptionsFor,
  hitTypeOptionsFor,
  OPPONENT_SIZE_OPTIONS,
  POSITION_OPTIONS,
  UNSPECIFIED_LABEL,
} from "../labels";
import { OptionButtonGroup } from "./OptionButtonGroup";
import { useFieldSequence } from "../useFieldSequence";
import {
  NO_SPINNER,
  blockNonNumericKeys,
  clampNumericString,
} from "../numericInput";
import { MassPercentInput } from "./MassPercentInput";
import type { OkiOption } from "../types";
import {
  OKI_ATTACK_TYPES,
  OKI_ATTACK_TYPE_LABELS,
  OKI_OPTION_SPECS,
  okiOptionKey,
  okiOptionTestValue,
  okiTechAndGaugeLabel,
  OKI_VERIFIED_LABEL,
} from "@/constants/oki";
import {
  isFlagState,
  isIntStateValue,
  isDefaultIntValue,
  isSingleValueState,
  isSupportedState,
  normalizeIntValue,
  intStateDelta,
  customStateIntLabel,
  formatIntStateValue,
  stateOptions,
  type CustomStateDef,
  type CustomStateValue,
  type CustomStatesValues,
  type IntStateValue,
} from "../customStates";

export interface BasicFieldsValue {
  // 起き攻めオプション(M16-03 正規化)。sparse: 含まれる＝そのオプションが成立する。
  okiOptions: OkiOption[];
  // ★M27-02b(P4M-011): 起き攻めを一度でも調べたか(コンボ単位)。
  //   ★チェックが 1 つも無い状態の意味を決めるのはこの 1 個である。
  okiVerified: boolean;
  characterId: number;
  isDraft: boolean;
  damage: string;
  // C-12: 始動技は ComboEditor 側でレシピ先頭から自動確定するため、編集 state には持たない。
  position: string;
  // ★★M37-01: 始動位置のマス数と運び量(0〜160・文字列。"" = 未入力)。
  //   ★保存の正本はマス数 1 本である(D-731)。パーセントは表示・入力の変換であり
  //     state に持たない —— 持つと同じ情報が 2 か所に在ることになる(E-76)。
  //   ★★運び量は始動位置とは別の値であり、区分を持たない(D-731 不変条件 1 / 2)。
  startPositionMass: string;
  carryDistanceMass: string;
  opponentStance: string;
  hitType: string;
  opponentSize: string;
  // ★★M37-07: 始動技を持続当てしたか(重複判定キーの 8 つ目・D-874)。
  //   ★他の状況欄と違い string ではなく boolean である —— DB 列が
  //     NOT NULL DEFAULT 0 であり「不問(未指定)」という状態を持たないため。
  //   ★★3 値にしないこと(指示書 §0.5)。重複判定キーに入るため、「不問」を許すと
  //     SQL の `NULL != NULL` で意味の無い分岐が生まれる。
  starterMeaty: boolean;
  // ★★★M38-01 追補2(2026-09-18): 開始残量 2 欄は**任意**であり、
  //   **空文字＝ NULL ＝「不問」**である(状態は 2 つしか無い)。
  //
  // ★★着手前は `driveAvailableAtStartAny` / `saAvailableAtStartAny` という
  //   UI 専用の boolean を隣に持ち、「不問」を空欄と別の状態として扱っていた。
  //   ⇒ UI が 3 状態(数値 / 不問 / 空のまま)、DB が 2 状態(値 / NULL)で数が合わず、
  //     開発者が実機で「空欄と NULL の状態がわかりにくい」と判断した。
  //   ★★**区別を諦めて UI を DB へ揃えた**。⇒ flag も門(requiredPublished.ts)も
  //     Space のトグルも消えた。空欄の意味は placeholder の「不問」で常に画面に出る。
  //   ★先例 = CHANGE-200 / M37-05 の `start_position_mass IS NULL ⇔ position = 不問`。
  driveAvailableAtStart: string;
  saAvailableAtStart: string;
  driveDamage: string;
  saGaugeConsumed: string; // 消費 SA(0〜6・M16-02)
  driveGaugeConsumed: string; // 消費 drive(0〜20・0.5 刻み・M16-02)
  knockdownAdvantage: string;
  memo: string;
  // メディア 3 フィールド(M17-01)。任意の文字列参照(形式強制なし)。空="" は保存時 null(クリア)。
  link: string;
  videoPath: string;
  imagePath: string;
  tagIds: number[];
  // キャラ固有状態(custom_states)の付与値。code をキーに flag=boolean、
  // int=構造化 { start_min?, end? }(M16-07・旧スカラ number も後方互換で保持)。
  customStates: CustomStatesValues;
}

interface Props {
  value: BasicFieldsValue;
  // 選択中キャラのキャラ固有状態定義(custom_states の states[])。データ駆動描画に用いる(M11-01)。
  customStateDefs: CustomStateDef[];
  onChange: (next: BasicFieldsValue) => void;
  onCreateTag?: (name: string) => Promise<number | null>;
  tagCreating?: boolean;
  // 確定反撃サーチ等、遷移元の文脈でヒット種別が一意に決まる場合の説明。
  hitTypeLockedReason?: string;
  // 仮登録トグルをこのフィールド群の末尾に描画するか(M12-02 / C-15)。
  // 新規/コピーモードでは ComboEditor が画面最上部に描画するため false を渡す。
  showDraftToggle?: boolean;
  /**
   * ★M24-12: メモ欄の直後に置く「レシピへ」ボタンの動き(タブ 2 へ移る)。
   *   ★メモ欄は順送りを無効にしてある唯一の欄であり、そこからの出口が要る
   *     (指示書 §4.4.1 / D-578(5))。渡されなければボタンは出さない。
   */
  onGoToRecipe?: () => void;
}

/**
 * ★★M37-01(2026-09-13 開発者裁定): 始動位置・運び量の入力方式。
 *
 * ★着手当初は 3 方式を並べて連動させていたが、**「入力方式を選んだ後、1 項目だけ
 *   入力させる」**形へ変えた。⇒ `D-730`「3 つで連動する」／ 指示書 §2.2-1
 *   「どれを動かしても他の 2 つが追随する」からの設計変更であり、CHANGE 起票が要る。
 *
 * ★★保存される値は方式に依らず**マス数 1 本**である(`D-731`)。⇒ 方式を切り替えても
 *   値は保たれ、単位が変わって見えるだけである。
 *
 * ★★見た目は「ピル」である(2026-09-13 開発者選択・案 B)。値のボタン群(青・角丸長方形)と
 *   役割を見分けさせるため、一回り小さい丸ピル ＋ 選択色 slate にしてある。
 *   ⇒ 左に「入力方式」と言葉でも書く。
 *
 * ★★並びは 通常入力 → パーセンテージ → マス目(2026-09-13 開発者指定)。
 *   ★数字キーのショートカットは並び順から導出される(shortcutKeyForIndex)。
 *     ⇒ ラベル文字列へ数字を焼き込まないこと —— 並びを変えたときに番号がずれる。
 *     ★画面に出る番号は OptionButtonGroup が並び順から描く。
 */
const POSITION_INPUT_MODE_OPTIONS = [
  { value: "band", label: "通常入力" },
  { value: "percent", label: "パーセンテージ" },
  { value: "mass", label: "マス目" },
] as const;

/** 運び量は区分を持たないため 2 択である(`D-731` の不変条件 2)。 */
const CARRY_INPUT_MODE_OPTIONS = POSITION_INPUT_MODE_OPTIONS.filter(
  (o) => o.value !== "band",
);

type PositionInputMode = (typeof POSITION_INPUT_MODE_OPTIONS)[number]["value"];

/**
 * 運び量が採れる方式。★"band" を含まない。
 *
 * ★★これも不変条件 2 の歯止めである —— 運び量の state をこの型で持たせておくと、
 *   区分を足そうとした時点で型検査が赤くなる。
 */
type MassInputMode = Exclude<PositionInputMode, "band">;

// ★★M37-01: NO_SPINNER の定義は ../numericInput へ移した(MassPercentInput と共有
//   するため。同ファイルから import すると循環参照になる)。★中身は 1 文字も変えていない。
//   ★あわせて適用欄が 9 → 13 になった(始動位置マス数/％・運び量マス数/％)。

// ★★M24-12(§4.12.3): `type=flag` の 2 択。
//   ★値は「見た目」であって保存値ではない——保存は `true` か `undefined` である
//     (§4.12.2)。**ここに `false` を持ち込まないこと。**
// ★★M27-02b(`P4M-024`): 基本情報の節が「始動時の状態」を表すことの注記。
//
// ★語は画面の既存語に合わせて「コンボ開始時」とする(逐語の「始動時」ではない)。
//   ⇒ 理由は呼び出し側のコメントに書いた。マジックストリングにしない(CLAUDE.md §4)。
// ★★M27-02b: 「調べた」を外すときの確認の文面(CLAUDE.md §4 マジックストリング)。
const OKI_VERIFIED_UNSET_TITLE = "「起き攻めを調べた」を外しますか?";
const OKI_VERIFIED_UNSET_DESCRIPTION =
  "起き攻めにチェックが付いています。外すと「まだ調べていない」扱いになり、詳細画面でもそう表示されます。チェックはそのまま残ります。";

const BASIC_SECTION_START_STATE_NOTE =
  "この節の値はコンボ開始時の状態を表します。";

const FLAG_YES = "yes";
const FLAG_NO = "no";
const FLAG_STATE_OPTIONS = [
  { value: FLAG_YES, label: "はい" },
  { value: FLAG_NO, label: "いいえ" },
] as const;

// ★M37-07: 始動技の持続当ての選択肢(はい / いいえ・開発者確定 2026-09-14)。
//
// ★FLAG_STATE_OPTIONS を流用しない —— あちらは語を直書きしており、
//   本欄の語は ja.json(situation.starterMeaty.*)を正典にしている。
//   ⇒ 同じ語が 2 か所に在る状態(E-76)を作らず、label-keys.test.ts の網に入る。
// ★「不問」を先頭に付けないこと(withUnspecifiedFirst を通さない)。列は 2 値である。
const STARTER_MEATY_OPTIONS = STARTER_MEATY_VALUES.map((v) => ({
  value: v,
  label: STARTER_MEATY_LABELS[v],
}));

export function ComboEditorBasicFields({
  value,
  customStateDefs,
  onChange,
  onCreateTag,
  tagCreating,
  hitTypeLockedReason,
  // ★★M24-12(§4.10・レビュー 低-10): 既定を false にした。
  //   ★末尾配置は本サブで廃止しており、本番から到達する経路は無い。
  //     既定を true のままにすると、**M24-05 が本部品を /setups/:setupId へ流用したとき
  //     撤回したはずの末尾配置が黙って復活する。**
  //   ★prop 自体の要否（＝非 inline 分岐を残すか）は削除を伴うため開発者の手番である
  //     (CLAUDE.md §10.Y)。⇒ 設計伝達レポート §4 へ候補として回した。
  showDraftToggle = false,
  onGoToRecipe,
}: Props) {
  const set = <K extends keyof BasicFieldsValue>(key: K, v: BasicFieldsValue[K]) =>
    onChange({ ...value, [key]: v });

  // ── ★★★M37-01: 始動位置の 3 方式の連動(D-730 / D-731・指示書 §2.2)────────────
  //
  // 3 方式＝区分ボタン群 / マス数 / パーセント。★どれを動かしても他の 2 つが追随する。
  // ★パーセント ⇄ マス数 は MassPercentInput の中で閉じている。ここは区分との連動だけ。
  //
  // ★★連動は「画面上の入力時」に起きる。⇒ 保存時の正規化ではない(指示書 §0.2 / §4.2)。
  //   ★buildCreatePayload / buildPatchPayload は state をそのまま送る。
  //     送信の直前に値を書き換えるコードは 1 行も無い。
  //   ★★導出の正本はサーバの normalizePositionAndMass である —— 区分とマス数が食い違って
  //     届いた場合はマス数が勝つ。⇒ UI は権威ではないので二重化にならない。
  //
  // ★★区分をまたぐマス変更で position が動くのは意図どおりである。
  //   position は重複判定キーであり、動けば hasKeyChanges が PUT へ振り分ける
  //   (DES-005 §5.7 (a))。⇒ 区分内のマス変更は PATCH に留まり、DB の position と
  //   食い違わない。★サーバの PATCH 経路は normalizePositionAndMass を呼ばないため、
  //     この振り分けが 食い違いを防ぐ唯一の仕掛けである。
  //
  // ★★★2026-09-13 追記(M37-05 / D-864)—— 上の「normalizePositionAndMass を呼ばない」は
  //   今も真だが、**サーバの PATCH 経路は「触らない」わけではなくなった。**
  //   ⇒ 同経路は fillStartPositionMassForPatch(同関数の*補完の半分*だけ)を適用し、
  //     **更新後のマス数が NULL になるとき、DB 上の区分の代表値で埋める。**
  //   ★★それでも position は 1 バイトも書かない(UpdateMetadataInput に Position 欄が無い)。
  //     ⇒ **区分をまたぐマス変更を PUT へ振り分ける必要は消えていない。**
  //       サーバが埋めるのは「空になったとき」だけであり、区分の導出は行わないためである。
  //   ★下の fillStartPositionMassOnBlur は、その補完を画面の側で先に見せるためのものである。

  /** 区分を選んだとき。★従来型＝区分を選ぶと代表値のマス数が入る(D-730)。 */
  const setPositionBand = (band: string) => {
    // ★「不問」を選んだらマス数も空にする(3 方式とも空にできる＝指示書 §2.2-5)。
    if (band === "") {
      onChange({ ...value, position: "", startPositionMass: "" });
      return;
    }
    // ★★既に入っているマス数がその区分の域内なら、代表値で潰さない。
    //   ⇒ OptionButtonGroup は同じ値を押し直しても onChange を発火する。
    //     潰すと「85 マスと入れた人が、点いている区分をもう一度押しただけで
    //     80 に戻される」——★編集モードではそのまま保存される。
    //   ★区分を*変えた*ときは従来どおり代表値が入る(D-730 の従来型)。
    const current = value.startPositionMass.trim();
    const keepsMass =
      current !== "" && positionFromMass(Number(current)) === band;
    onChange({
      ...value,
      position: band,
      startPositionMass: keepsMass
        ? value.startPositionMass
        : String(representativeMassOf(band) ?? ""),
    });
  };

  /** マス数を直接入れたとき。★区分は導出して追随させる(値域外・空なら現状維持)。 */
  const setStartPositionMass = (massText: string) =>
    onChange({
      ...value,
      startPositionMass: massText,
      position:
        massText.trim() === ""
          ? value.position
          : (positionFromMass(Number(massText)) ?? value.position),
    });

  /**
   * ★★★M37-05: マス数の欄から離れたとき、空なら区分の代表値で埋める(D-864)。
   *
   * ★★不変条件は 1 行である: `start_position_mass IS NULL` ⇔ `position = 不問`。
   *   ⇒ 区分が決まっているなら、マス数は必ず値を持つ。
   *
   * ★★★ここで埋める理由は「保存してから値が生えてくる見え方にしない」ことである
   *   (指示書 §0.6)。サーバ側(`fillStartPositionMassForPatch`)が後ろの守りとして
   *   同じ補完を行うため、埋めなくても保存結果は同じになる。★だが利用者には
   *   「消したのに生えてきた」と映る。⇒ 画面の側で先に見せる。
   *
   * ★★`onChange` ではなく blur で行う —— `onChange` は毎キーストロークで発火するため、
   *   80 を消して 12 と打ち直そうとした瞬間に 80 が戻り、打ち直せなくなる。
   *
   * ★不問(`""`)なら `representativeMassOf` が null を返し、空のままになる。
   *   ⇒ 代表値が定義されていないためであり、これが正しい状態である。
   * ★代表値の出所は `setPositionBand` と同じ `representativeMassOf` 1 本である
   *   (指示書 §4.5)。⇒ 3 本目の表を作らない。
   * ★★運び量には掛けない —— 運び量は区分を持たず代表値が存在しない
   *   (`D-731` 不変条件 2)。⇒ 下の JSX で `onBlur` を渡さないことが、その保証である。
   */
  const fillStartPositionMassOnBlur = () => {
    if (value.startPositionMass.trim() !== "") return;
    const representative = representativeMassOf(value.position);
    if (representative === null) return;
    onChange({ ...value, startPositionMass: String(representative) });
  };

  /**
   * 区分ボタン群に出す値。
   *
   * ★マス数が入っていればそれを区分へ写す。⇒ 詳細入力で入れた値が、通常入力へ
   *   切り替えたときに区分として見える(方式を変えても値は 1 本である＝`D-731`)。
   * ★★値域外のセンチネルは撤去した —— `clampNumericString` が画面段で 0〜160 へ
   *   丸めるようになり(2026-09-13 開発者裁定)、`positionFromMass` が null を返す
   *   状態が画面からは作れなくなったためである。★DB 側も CHECK で 0〜160 である。
   */
  const displayedPositionBand =
    value.startPositionMass.trim() === ""
      ? value.position
      : (positionFromMass(Number(value.startPositionMass)) ?? value.position);

  /**
   * ★★入力方式。⇒ 画面のローカル状態であり、保存もブラウザストレージへの
   *   保持もしない。
   *   ★既定は「通常入力」である(`D-731`＝「既定の入力方式は従来型のまま」)。
   *   ★保持しないのは、保持すると `web/CLAUDE.md` §1 の台帳へのキー追加になり
   *     CHANGE 通知書が要るためである(§10.X)。⇒ 要るなら別途の判断で足す。
   */
  const [positionInputMode, setPositionInputMode] =
    useState<PositionInputMode>("band");
  const [carryInputMode, setCarryInputMode] =
    useState<MassInputMode>("mass");

  // ★M27-02b: 「調べた」を外すときの確認ダイアログの開閉。
  const [okiVerifiedConfirmOpen, setOkiVerifiedConfirmOpen] = useState(false);

  // ★★M27-02b(`P4M-009` / `P4M-010`): 欄の 3 状態を 1 か所で決める。
  //
  // ★★仮登録(is_draft=true)では必須にならない——仮登録は「未確定でも保存できる」
  //   入口として設計されている(SUPP-001 §2.1)。⇒ そのときは印を出さない。
  //   **印は「今のこの保存に要るか」を表す。** 常時「必須」と出すと、仮登録では
  //   保存できるのに必須と見える形になる。
  // ★必須の欄そのものの正典は constants/field-requirement.ts。ここでは持たない。
  const requirementFor = (field: string): FieldRequirement =>
    value.isDraft ? FIELD_OPTIONAL : requirementOf(field);

  // ★★M27-02b: 「調べた」を **外す** 操作にだけガードを掛ける。
  //
  // ★★開発者の逐語＝「一度検証済みにして、かつ、起き攻め状況でチェックを付けたものが
  //   ある時に、検証済み解除するのは操作ミスと思われるため、間違って押してしまわない
  //   ような仕組みにしてほしい」(2026-09-03)。
  // ★★トグルの無効化は採らない——**外すにはチェックを全部外す必要があるが、
  //   チェックに触れると「調べた」が自動で就く**ため循環する。
  //   ⇒ 本プロジェクトの先例(DeleteComboConfirm 等)に合わせて確認ダイアログで止める。
  // ★付ける操作と、チェックが 0 件のときの解除はダイアログを出さない(ミスではない)。
  const requestOkiVerifiedChange = (next: boolean) => {
    if (!next && value.okiOptions.length > 0) {
      setOkiVerifiedConfirmOpen(true);
      return;
    }
    set("okiVerified", next);
  };

  // 起き攻めオプションのトグル(M16-03): sparse セットへの追加/削除。
  //
  // ★★M27-02b(P4M-011): **チェックに触れたら「調べた」が自動で就く**
  //   (開発者確定 2026-09-03)。付ける／外すのどちらでも就く——どちらの操作も
  //   「起き攻めを見た」ことの証拠だからである。
  //   ★自動で外すことはしない。外すのは利用者の明示操作だけ(下記トグル)。
  //
  // ★★M31-01(SD-006): **ノーゲージ版を付けたら、同じ対のドライブラッシュ版にも付く**
  //   (開発者の逐語＝「起き攻めについて、ドライブラッシュなしの方にチェックをつけたら、
  //   ドライブラッシュ版に自動でチェックがついて欲しい」＝`Memo_Someday.txt:366`)。
  //
  //   ★★連動は **片方向・付けるときだけ** である。
  //     - 逆向き(DR 版 → ノーゲージ版)は付けない。⇒ 開発者は片方向しか求めていない。
  //     - 外す操作では連動しない。⇒ 自動で付いたものを外す手段が無くなるため。
  //   ★自動で付いたチェックは、通常のトグルでそのまま外せる(下の rest フィルタが
  //     対象の 1 件だけを落とすため、対の相手は残る)。
  //
  //   ★★VAL-C11 とは向きが逆である。あちらは「DR 版だけある」を事後に咎める WARNING、
  //     こちらは入力の補助である。⇒ 本連動を入れると VAL-C11 の母集団が減る。
  //     母集団の変化は完了報告に実測で載せてある(指示書 §4.2)。**警告の重大度・文言は
  //     1 文字も変えていない。**
  const toggleOki = (spec: OkiOption, on: boolean) => {
    const key = okiOptionKey(spec);
    const rest = value.okiOptions.filter((o) => okiOptionKey(o) !== key);
    let nextOptions: OkiOption[];
    if (!on) {
      nextOptions = rest;
    } else if (spec.usesDr) {
      nextOptions = [...rest, spec];
    } else {
      // ノーゲージ版を付けた ⇒ 同じ (attackType, techType) の DR 版も付ける。
      const paired: OkiOption = { ...spec, usesDr: true };
      const pairedKey = okiOptionKey(paired);
      const already = rest.some((o) => okiOptionKey(o) === pairedKey);
      nextOptions = already ? [...rest, spec] : [...rest, spec, paired];
    }
    onChange({
      ...value,
      okiOptions: nextOptions,
      okiVerified: true,
    });
  };

  // 付与値の 1 件更新。undefined を渡すとそのキーを削除する(= 既定値扱い)。
  const setCustomState = (code: string, v: CustomStateValue | undefined) => {
    const next = { ...value.customStates };
    if (v === undefined) {
      delete next[code];
    } else {
      next[code] = v;
    }
    set("customStates", next);
  };

  // M16-07: int state の現在値を編集用ペア { start_min?, end? } へ読み出す。
  //   構造化 = そのまま / 旧スカラ(number)= ②(end) へ写像 / 未付与 = 空。
  //   欠損フィールドは空欄として表示する(既存の「空欄 = 既定」UX を踏襲)。
  const readIntPair = (raw: CustomStateValue | undefined): IntStateValue => {
    if (isIntStateValue(raw)) {
      return {
        ...(raw.start_min != null ? { start_min: raw.start_min } : {}),
        ...(raw.end != null ? { end: raw.end } : {}),
      };
    }
    if (typeof raw === "number") return { end: raw };
    return {};
  };

  // M16-07: int state の ①start_min / ②end の片側を更新する。
  //   空文字は当該フィールド削除。整数化 + min/max クランプ。
  //   ★M31-05: 正規化後が既定(両者 min)なら state ごと削除する(旧: 両フィールドが空のときだけ削除)。
  const setIntField = (def: CustomStateDef, which: keyof IntStateValue, rawStr: string) => {
    const min = def.value_definition?.min ?? 0;
    const max = def.value_definition?.max;
    const nextPair: IntStateValue = readIntPair(value.customStates[def.code]);
    if (rawStr === "") {
      delete nextPair[which];
    } else {
      let n = Math.trunc(Number(rawStr));
      if (!Number.isFinite(n)) return;
      if (n < min) n = min;
      if (max != null && n > max) n = max;
      nextPair[which] = n;
    }
    // ★★M31-05(レビュー 中-3): 両フィールドが既定(min)なら、キーごと消す。
    //   ⇒ 保存内容は元から同じ(buildSituation が isDefaultIntValue を落とす)が、
    //     離脱ガード(formDirtyKey)は基本情報の生の値を見るため、既定値を書くと dirty になる。
    //   ★options 付き state は既定(「なし」)を選択済みとして見せるため、利用者が確認のつもりで
    //     「なし」を押しただけで確認ダイアログが出ていた。
    if (isDefaultIntValue(normalizeIntValue(nextPair, def), def)) {
      setCustomState(def.code, undefined);
    } else {
      setCustomState(def.code, nextPair);
    }
  };

  // ★★M31-05 追補: single_value の int state を 1 つの値として更新する。
  //   ⇒ 格納形は `{start_min, end}` のままで、両方へ同じ値を書く(形を分岐させない)。
  //   ★空文字・既定値のときはキーごと消す(setIntField と同じ流儀)。
  const setSingleIntField = (def: CustomStateDef, rawStr: string) => {
    const min = def.value_definition?.min ?? 0;
    const max = def.value_definition?.max;
    if (rawStr === "") {
      setCustomState(def.code, undefined);
      return;
    }
    let n = Math.trunc(Number(rawStr));
    if (!Number.isFinite(n)) return;
    if (n < min) n = min;
    if (max != null && n > max) n = max;
    if (n === min) {
      setCustomState(def.code, undefined);
      return;
    }
    setCustomState(def.code, { start_min: n, end: n });
  };

  // 描画対象(flag/level/stock)の状態のみ。未対応 type(composite 等)はスキップ。
  const supportedStateDefs = customStateDefs.filter(isSupportedState);

  // ★★M24-12(第 3 段): セクションの開閉を制御モードへ移した。
  //   ★理由は「畳まれたセクションへ移るときは開いてから移す」(§4.4.2)を満たすためである
  //     ——順送りが外から開けなければならない。既定は全展開(M15-05 の要件)のまま。
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    basic: true,
    customStates: true,
    oki: true,
    other: true,
  });
  const sectionDef = (key: string) => ({
    key,
    open: openSections[key] ?? true,
    setOpen: (open: boolean) =>
      setOpenSections((prev) => ({ ...prev, [key]: open })),
  });
  const sequenceSections = [
    sectionDef("basic"),
    sectionDef("customStates"),
    sectionDef("oki"),
    sectionDef("other"),
  ];
  const { rootRef, onKeyDown } = useFieldSequence({
    sections: sequenceSections,
  });

  const { statusToTagId, tagIdToStatus, allTagIds, isLoading: statusTagsLoading } = useMyComboStatusTags();

  const currentMyComboStatus = useMemo(() => {
    for (const id of value.tagIds) {
      const s = tagIdToStatus.get(id);
      if (s) return s;
    }
    return "" as const;
  }, [value.tagIds, tagIdToStatus]);

  const handleMyComboStatusChange = (newStatus: MyComboStatus | "") => {
    const cleaned = value.tagIds.filter((id) => !allTagIds.has(id));
    if (newStatus !== "") {
      const tagId = statusToTagId.get(newStatus);
      if (tagId !== undefined) cleaned.push(tagId);
    }
    set("tagIds", cleaned);
  };

  return (
    <div className="space-y-4" ref={rootRef} onKeyDown={onKeyDown}>
      <div data-seq-section="basic">
      <CollapsibleFieldset
        legend="基本情報"
        contentClassName="space-y-3"
        data-testid="combo-editor-basic-section"
        open={openSections.basic}
        onOpenChange={(o) => setOpenSections((p) => ({ ...p, basic: o }))}
        // ★★M27-02b: 節の注記を 2 つ、既存の summary 機構で出す。
        //   ★新しい仕組みを作らない——起き攻め節が既に同じ形で「複数選択可」を
        //     出している(下記)。同じ役割には同じ機構を使う。
        summary={
          <span className="flex flex-wrap gap-x-3 text-xs text-gray-500">
            {/* ★★P4M-024: 基本情報が始動時の状態であることを画面に出す。
                逐語＝「基本情報が始動時の状態を表す事を画面に表示」。

                ★★語は「コンボ開始時」を使う。**逐語の「始動時」ではない。**
                  画面の既存語がこちらだからである——始動ゲージ 2 欄の正典ラベルが
                  `gaugeFieldLabelJa("start", ...)` ＝「コンボ開始時の◯◯ゲージ残量」
                  (DES-005)。⇒ 本サブで語を作らない(用語統一は M29 の手番・指示書 §2.4-3)。 */}
            <span data-testid="combo-editor-basic-start-state-note">
              {BASIC_SECTION_START_STATE_NOTE}
            </span>
            {/* ★★P4M-010: 「印の無い欄は任意」の凡例。必須の欄にだけ印を付ける規則を
                ここで 1 回だけ示す。★仮登録では必須の欄が無いので出さない。 */}
            {value.isDraft ? null : (
              <span data-testid="combo-editor-requirement-legend">
                {FIELD_REQUIREMENT_LEGEND}
              </span>
            )}
          </span>
        }
      >
        {/* ★★M24-12: 2 カラムグリッド(grid-cols-2)をやめ、1 カラム縦積みにした。
            各項目は Field が「ラベル左・入力右」の横長の行として描く。
            ★縦は伸びる。それは想定内であり(M15-05 の「縦圧縮は 2 カラムで担保」は
              本サブで前提が変わった)、そのぶん折りたたみの役割が増える。 */}
        <div className="space-y-0.5">
          {/* キャラクター選択は ComboEditorCharacterField(画面上部)に移設(M10-01)。
              characterId は BasicFieldsValue に保持され、上部の選択で更新される。 */}
          {/* ★★★M38-01(射程 2): **数値 4 欄をここへまとめた。**
              ⇒ 開発者の要望は「必須項目を基本情報の上の方へまとめる」であり、
                上に在ることが「必須である」の手掛かりになる。
              ★並びは ダメージ → 有利フレーム → 開始ドライブ → 開始SA。
                結果 2 欄(ダメージ・有利フレーム)を先、コンボ開始時の前提 2 欄を後ろに
                置き、種類ごとに固めてある。★drive → sa の順は消費 2 欄と揃えた。
              ★★★【追補2・2026-09-18】**必須は先頭 2 欄だけになった**(開始残量 2 欄が
                任意へ)。★開発者裁定＝「位置は維持する」。⇒ 並びは 1 つも動かしていない。
                ★★★**その結果「上にあるものが必須」という手掛かりは成立しない。**
                  ⇒ 以下は失効した条件:「必須でないものを 1 つもこの塊へ混ぜないこと」
                    (指示書 §2.3-3)。手掛かりは節の凡例だけが担う。
              ★★★下の任意欄の**相対順は 1 つも変えていない**。⇒ 状況 4 軸と
                持続当ての塊(重複判定キーの並び・M37-07)も、数字キーの割当も不変である。
                ★追補2 で運び量を相手の大きさの直下へ移し、始動技の表示を消したが、
                  どちらも状況の塊より後ろであり、上記はいずれも動いていない。 */}
          <Field label="ダメージ" requirement={requirementFor("damage")} topic="damage">
            <Input
              type="number"
              className={`max-w-[11rem] ${NO_SPINNER}`}
              min={0}
              data-testid="combo-editor-damage"
              value={value.damage}
              onChange={(e) => set("damage", e.target.value)}
              onKeyDown={blockNonNumericKeys(false)}
            />
          </Field>

          <Field
            label="有利フレーム"
            requirement={requirementFor("knockdownAdvantage")}
            topic="knockdownAdvantage"
          >
            <Input
              type="number"
              className={`w-24 ${NO_SPINNER}`}
              data-testid="combo-editor-knockdown-advantage"
              value={value.knockdownAdvantage}
              onChange={(e) => set("knockdownAdvantage", e.target.value)}
              onKeyDown={blockNonNumericKeys(true)}
            />
          </Field>

          {/* M16-01: drive_available_at_start は 0〜6・0.5 刻み(sequence 側と粒度統一)。 */}
          {/* M16-06(A-3): ラベルを始動残量の正典へ統一。F-1(a): 消費欄と対称に UI クランプ(0〜6)。 */}
          {/* ★★★M38-01 追補2(2026-09-18): 本欄は**任意**である。**空欄＝「不問」**であり、
              placeholder に薄く「不問」と出る。⇒ 必須の印も、不問のトグルも持たない。
              ★追補1 までは VAL-C15 の必須欄であり、Space で切り替える「不問」トグルを
                持っていたが、**開発者裁定で必須ごと外れた**(空欄と NULL が見分けにくいため)。 */}
          <Field label={gaugeFieldLabelJa("start", "drive")}>
            <Input
              type="number"
              className={`w-24 ${NO_SPINNER}`}
              data-testid="combo-editor-drive-available"
              min={0}
              max={6}
              // ★M24-12: `step` を消すと既定 1 になり、承認済みの `1.3` が
              //   `stepMismatch`(=不正な値)になる。⇒ `any` で「刻みなし」を明示する。
              step="any"
              // ★★空のときだけ「不問」を薄く出す。⇒ 空欄の意味が常に画面に在る。
              placeholder={
                value.driveAvailableAtStart === "" ? UNSPECIFIED_LABEL : undefined
              }
              value={value.driveAvailableAtStart}
              onChange={(e) =>
                set(
                  "driveAvailableAtStart",
                  clampNumericString(e.target.value, 0, 6),
                )
              }
              onKeyDown={blockNonNumericKeys(false, true)}
            />
          </Field>

          {/* M16-06(A-3/F-1(a)): 正典ラベル＋消費欄と対称の UI クランプ(0〜3)。 */}
          {/* ★上の開始ドライブと同じく**任意・空欄＝不問**である(M38-01 追補2)。 */}
          <Field label={gaugeFieldLabelJa("start", "sa")}>
            <Input
              type="number"
              className={`w-24 ${NO_SPINNER}`}
              data-testid="combo-editor-sa-available"
              min={0}
              max={3}
              placeholder={
                value.saAvailableAtStart === "" ? UNSPECIFIED_LABEL : undefined
              }
              value={value.saAvailableAtStart}
              onChange={(e) =>
                set("saAvailableAtStart", clampNumericString(e.target.value, 0, 3))
              }
              onKeyDown={blockNonNumericKeys(false)}
            />
          </Field>

          {/* ★★M38-01(射程 2): ここから下も**任意の欄**である(印が出ない)。
              ★★★追補2 で必須は先頭 2 欄(ダメージ / 有利フレーム)だけになった。
                ⇒ 「上にあるものが必須」という手掛かりは**成立しない**。
                  手掛かりは節の凡例「この節では、印の無い欄は任意です。」だけが担う
                  (開発者裁定＝欄の位置は動かさない)。 */}
          {/* ★★★M37-01(2026-09-13 開発者裁定): 入力方式を選ばせ、選んだ 1 項目だけを出す。
              ★着手当初は 3 方式を並べて連動させていた(D-730 / 指示書 §2.2-1)。
                ⇒ 設計変更であり CHANGE 起票が要る。
              ★★保存される値は方式に依らずマス数 1 本である(D-731)。⇒ 方式を切り替えても
                値は保たれ、単位が変わって見えるだけである。
              ★ⓘ は OptionButtonGroup の hint へ渡す —— Field(=data-seq-stop)の中で
                ボタン群より前に置くと、useFieldSequence の focusableIn が最初の
                focusable を拾って ⓘ にフォーカスが載り、群の数字キーが効かなくなる。 */}
          <Field label="始動位置">
            <div className="space-y-1.5">
              {/* ★見出し語は span であり focusable ではない。⇒ 群より前に置いても
                  useFieldSequence の focusableIn を奪わない(ⓘ は button なので
                  hint へ回している)。 */}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-xs text-muted-foreground">入力方式</span>
                <OptionButtonGroup
                  mode="single"
                  variant="pill"
                  ariaLabel="始動位置の入力方式"
                  testIdPrefix="combo-editor-position-mode"
                  options={POSITION_INPUT_MODE_OPTIONS}
                  value={positionInputMode}
                  onChange={(v) => setPositionInputMode(v as PositionInputMode)}
                  hint={
                    <InfoMark
                      topic="position-mass"
                      text={jaLabel("help.positionMass")}
                      ariaLabel="トレーニングモードのマス目の説明"
                    />
                  }
                />
              </div>
              {/* ★★M24-12: プルダウンをボタン群へ替えた(指示書 §4.3)。
                  ★中立の選択肢「不問」を一番左・かつ既定にする(2026-08-28 開発者指示)。
                    保存値は変わらない——4 欄とも中立の値は元から既定だったため、
                    変えたのは並び順とラベルだけである。 */}
              {/* ★★★値の入力欄は独立した停止点にする。
                  ★Field(=data-seq-stop)の中で useFieldSequence の focusableIn は
                    「その停止点の最初の focusable」しか拾わない。⇒ 入れ子の
                    data-seq-stop を置かないと、順送りは方式ボタンだけを踏んで
                    **値の入力欄を飛ばして次の欄へ行く**。
                  ★型検査もテストも E2E も緑のまま、キーボード経路だけが落ちる型である。 */}
              <div data-seq-stop="">
                {positionInputMode === "band" ? (
                  <OptionButtonGroup
                    mode="single"
                    ariaLabel="始動位置"
                    testIdPrefix="combo-editor-position"
                    options={withUnspecifiedFirst(POSITION_OPTIONS)}
                    value={displayedPositionBand}
                    onChange={(v) => setPositionBand(v)}
                  />
                ) : (
                  <MassPercentInput
                    mode={positionInputMode}
                    testIdPrefix="combo-editor-start-position-mass"
                    value={value.startPositionMass}
                    onChange={setStartPositionMass}
                    onBlur={fillStartPositionMassOnBlur}
                    ariaLabel={
                      positionInputMode === "mass"
                        ? "始動位置(トレーニングモードのマス目)"
                        : "始動位置(パーセンテージ)"
                    }
                  />
                )}
              </div>
            </div>
          </Field>

          {/* ★★「相手の状態」だけ中立の値が 2 つある(空文字と "any")。
              既定は M24-04(SM-093)以来 "any"(不問)であり、本サブでも変えない
              ——空文字へ戻すと保存値が変わる(DES-006 §2.4)。
              ⇒ 中立を兼ねるのは "any" であり、空の選択肢は旧データを読み込んだ
                ときだけ出す(stanceOptionsFor)。 */}
          <Field label="相手の状態">
            <OptionButtonGroup
              mode="single"
              ariaLabel="相手の状態"
              testIdPrefix="combo-editor-opponent-stance"
              options={stanceOptionsFor(value.opponentStance)}
              value={value.opponentStance}
              onChange={(v) => set("opponentStance", v)}
            />
          </Field>

          {/* ★★★M38-01(射程 5): 「不問」を選択肢から外した ——
              `SUPP-001` §3.2 の値域は 8 値であり「不問」を含まない。
              ★外したのは選択肢からであって値域からではない(値は 1 つも動かしていない)。
              ★★`hitTypeOptionsFor` は `stanceOptionsFor` と同型で、**読み込んだ値が
                空のときだけ**末尾へ「(未指定)」を足す。⇒ 既存の NULL 行を開いても
                「何も選ばれていない」状態にならず、開いて保存しただけで `normal` へ
                化けることもない(`hit_type` は重複判定キーの 1 つである)。 */}
          <Field label="ヒット種別">
            <OptionButtonGroup
              mode="single"
              ariaLabel="ヒット種別"
              testIdPrefix="combo-editor-hit-type"
              options={hitTypeOptionsFor(value.hitType)}
              value={value.hitType}
              disabled={hitTypeLockedReason != null}
              disabledReason={
                hitTypeLockedReason ? `(${hitTypeLockedReason})` : undefined
              }
              onChange={(v) => set("hitType", v)}
            />
          </Field>

          {/* ★M37-07: 始動技の持続当て。ヒット種別の隣が素直である(指示書 §2.4-4)。
              ★★「不問」を置かない —— 列が NOT NULL DEFAULT 0 の 2 値であり、
                3 値にすると重複判定キーへ意味の無い分岐が入る(§0.5)。
              ★欄の語に「（始動技）」が付くのは、step の modifier「持続当て」と
                画面上で紛れるためである(開発者裁定の逐語)。modifier 側は変えていない。 */}
          <Field label={STARTER_MEATY_LABEL}>
            <OptionButtonGroup
              mode="single"
              ariaLabel={STARTER_MEATY_LABEL}
              testIdPrefix="combo-editor-starter-meaty"
              options={STARTER_MEATY_OPTIONS}
              value={value.starterMeaty ? FLAG_YES : FLAG_NO}
              onChange={(v) => set("starterMeaty", v === FLAG_YES)}
            />
          </Field>

          {/* M27-01: 4 区分では表せない体格差の逃がし先を、その場で案内する。
              ★内容は新方針ではない —— DES-003 の「コード値の採用方針」が
                「代表的な数種類のみアプリ管理対象とし、細かいニュアンスは
                 ユーザーが memo 欄で補足する運用とする」と既に定めている。
                本表示はそれを画面へ出したものである。
              ★★hint に渡すのが要（かなめ）である —— InfoMark は button であり、
                Field(=[data-seq-stop]) の中で選択肢ボタンより **前** に置くと、
                useFieldSequence の focusableIn が querySelector(単数)で
                最初の focusable を拾うため ⓘ にフォーカスが載る。
                すると群にフォーカスが無くなり **数字キー 1〜5 が効かなくなる**。
                OptionButtonGroup は hint をボタン群の後ろへ描くので DOM 順が安全。 */}
          <Field label="相手の大きさ">
            <OptionButtonGroup
              mode="single"
              ariaLabel="相手の大きさ"
              testIdPrefix="combo-editor-opponent-size"
              options={withUnspecifiedFirst(OPPONENT_SIZE_OPTIONS)}
              value={value.opponentSize}
              onChange={(v) => set("opponentSize", v)}
              hint={
                // ★文言の源泉は ja.json の help.* に置き、jaLabel で日本語固定を引く
                //   (lib/ja-label.ts の方針＝「語の源泉は locale の 1 つに保つ」)。
                //   ★en.json 側にも同じキーを置いてある。エディタは i18n を通らないため
                //     現時点の参照は 0 だが、既存の help.modifier / help.recipeModifier も
                //     同じ構造であり、ja / en の対称を崩さないためである。
                <InfoMark
                  topic="opponent-size"
                  text={jaLabel("help.opponentSize")}
                  ariaLabel="相手の大きさの説明"
                />
              }
            />
          </Field>

          {/* ★★★M37-01: 運び量(D-731 の不変条件)。
              ★★区分の入力は付けない。⇒ 「必ずしも画面端にぴったり送るコンボとは
                限らない」(開発者の逐語)ため、運び量を区分へ丸めてはならない。
              ★★★「付けなかった」ではなく「付けられない」形にしてある ——
                MassPercentInput は区分に関する prop を 1 つも持たず、
                その不在を 3 層のテストが固定している(同ファイルの注記を参照)。
              ★★★【M38-01 追補2・2026-09-18 開発者指示】**「相手の大きさ」の直下へ移した。**
                ★以下は失効した記述:「置き場も状況(＝重複判定キー)から離してある。
                  ⇒ 運び量はキーではなく計測値である」——**理屈は今も正しいが、
                  離して置く手掛かりとしては働いていなかった**(開発者が画面を見て違和感を
                  申告した)。⇒ 状況の塊の末尾へ寄せ、読む順を優先した。
                ★★**運び量が重複判定キーでないことは 1 ビットも変わらない。**
                  キーの正典は SUPP-001 §3.2 であり、画面の並びはそれを表さない。 */}
          <Field label="運び量">
            <div className="space-y-1.5">
              {/* ★★★選択肢は 2 つである。⇒ 「通常入力（区分）」を*持たない*のは
                  D-731 の不変条件 2 そのものである。★CARRY_INPUT_MODE_OPTIONS は
                  始動位置の表から band を除いて導出しており、区分を足すと
                  始動位置側にも同時に現れるため、こっそり足せない形にしてある。 */}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-xs text-muted-foreground">入力方式</span>
                <OptionButtonGroup
                  mode="single"
                  variant="pill"
                  ariaLabel="運び量の入力方式"
                  testIdPrefix="combo-editor-carry-mode"
                  options={CARRY_INPUT_MODE_OPTIONS}
                  value={carryInputMode}
                  onChange={(v) => setCarryInputMode(v as MassInputMode)}
                />
              </div>
              {/* ★入力欄を独立した停止点にする理由は始動位置と同じ。 */}
              <div data-seq-stop="">
                <MassPercentInput
                  mode={carryInputMode}
                  testIdPrefix="combo-editor-carry-distance-mass"
                  value={value.carryDistanceMass}
                  onChange={(v) => set("carryDistanceMass", v)}
                  ariaLabel={
                    carryInputMode === "mass"
                      ? "運び量(トレーニングモードのマス目)"
                      : "運び量(パーセンテージ)"
                  }
                />
              </div>
            </div>
          </Field>

          {/* C-11: drive_damage は -6〜6・小数許容(回復で負値、1 本未満の増減で小数)。 */}
          <Field label="ドライブダメージ(-6.0〜6.0)">
            {/* ★★M27-03(SD-009): 「マイナスを許容している理由」を画面に出す。
                ★★これまで、その理由はソースのコメントと DES-003 / DES-005 にしか
                  書かれておらず、画面には 1 文字も出ていなかった。
                ★InfoMark は入力欄の**後ろ**へ置く(DOM 順。相手の大きさの先例と同じ)。 */}
            <div className="flex items-center gap-1">
              <Input
                type="number"
                className={`max-w-[11rem] ${NO_SPINNER}`}
                min={-6}
                max={6}
                // ★★M24-12(2026-08-29 開発者裁定・(b)): `0.5` 刻みを外す。
                //   ★`VAL-C13` は「-6〜6・小数許容」で刻みを見ていない
                //     ——**UI だけが 0.5 刻みを主張している状態**だった。
                //   ★ラベルも `(-6.0〜6.0)` と小数を示しており、属性と食い違っていた。
                //   ★ゲージ欄と同じ理由で `any` にする(消すと既定 1 になり、
                //     `0.5` すらブラウザ的に不正な値になる)。
                step="any"
                data-testid="combo-editor-drive-damage"
                value={value.driveDamage}
                onChange={(e) => set("driveDamage", e.target.value)}
                onKeyDown={blockNonNumericKeys(true, true)}
              />
              {/* ★文言の源泉は ja.json の help.*。エディタは i18n を通らないため
                  jaLabel で引く(相手の大きさと同じ流儀)。en.json 側にも同じキーがある。 */}
              <InfoMark
                topic="drive-damage"
                text={jaLabel("help.driveDamage")}
                ariaLabel="ドライブダメージの説明"
              />
            </div>
          </Field>

          {/* M16-02: 消費ゲージ。始動残量(上記)と区別できるようラベルに「消費」を明示。VAL 非連動。 */}
          <Field
            label={gaugeFieldLabelJa("consumed", "sa")}
            requirement={requirementFor("saGaugeConsumed")}
            topic="saGaugeConsumed"
          >
            <Input
              type="number"
              className={`max-w-[11rem] ${NO_SPINNER}`}
              min={0}
              max={6}
              data-testid="combo-editor-sa-consumed"
              value={value.saGaugeConsumed}
              onChange={(e) =>
                set("saGaugeConsumed", clampNumericString(e.target.value, 0, 6))
              }
              onKeyDown={blockNonNumericKeys(false)}
            />
          </Field>

          <Field
            label={gaugeFieldLabelJa("consumed", "drive")}
            requirement={requirementFor("driveGaugeConsumed")}
            topic="driveGaugeConsumed"
          >
            <Input
              type="number"
              className={`max-w-[11rem] ${NO_SPINNER}`}
              min={0}
              max={20}
              // ★M24-12: `step` を消すと既定 1 になり、承認済みの `1.3` が
              //   `stepMismatch`(=不正な値)になる。⇒ `any` で「刻みなし」を明示する。
              step="any"
              data-testid="combo-editor-drive-consumed"
              value={value.driveGaugeConsumed}
              onChange={(e) =>
                set(
                  "driveGaugeConsumed",
                  clampNumericString(e.target.value, 0, 20),
                )
              }
              onKeyDown={blockNonNumericKeys(false, true)}
            />
          </Field>
        </div>
      </CollapsibleFieldset>
      </div>

      {/* キャラ固有状態(custom_states)。選択キャラの定義からデータ駆動で描画する(M11-01)。
          独立カラム「状況」(POSITION 等)とは別セクション。状態を持たないキャラでは非表示。 */}
      {supportedStateDefs.length > 0 && (
        <div data-seq-section="customStates">
        <CollapsibleFieldset
          legend="キャラ固有状態"
          open={openSections.customStates}
          onOpenChange={(o) => setOpenSections((p) => ({ ...p, customStates: o }))}
          contentClassName="space-y-3"
          data-testid="combo-editor-custom-states-section"
        >
          {/* M15-05: 固有状態が複数ある場合は横並び(auto-fit)。初期展開・折りたたみ可。 */}
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))]">
            {supportedStateDefs.map((def) => {
              if (isFlagState(def)) {
                // ★★M24-12(§4.12・D-583): Switch からボタン群へ。
                //
                //   ★`DES-005` §5.7 項目6 の「type=flag はトグル＝Switch 表記」を撤回した。
                //     ★撤回の機序は §4.10.1 と同じ——**元の規則は「表記整合」を目的に
                //       書かれたものであり、Switch が本質的に正しいから書かれたのではない。**
                //       本サブが単一選択 5 欄をボタン群にした結果、ここだけ作法から外れた。
                //       ⇒ 整合の相手が変わった ⇒ 根拠が消えた。
                //   ★★仮登録トグルは Switch のまま残す(§4.12.4)——**あちらの整合の相手は
                //     仮想コントローラのラッシュ版であり、本サブで変わっていない。**
                //
                //   ★★保存値の意味論は変えない。**「いいえ」は `undefined` であって
                //     `false` ではない**(`CHANGE-040` 以来の消去意味論)。
                //     ★`custom_states` は VAL 非連動で BE が止めないため、`false` を
                //       書くと**黙って壊れる**(指示書 §4.12.2)。
                //   ★初期(`undefined`)は「いいえ」を選択済みとして見せる。
                //     **「未選択」という第 3 の見た目を作らない**——Switch 時代に無かった
                //     概念であり、`undefined` と「いいえ」の違いを見せる意味が無い。
                //   ★ラベルが「はい / いいえ」なのは、状態名がキャラごとにデータ駆動で
                //     決まるためである(実査 §3.3-17＝5 件)。「あり / なし」は名詞にしか
                //     付かないが、「はい / いいえ」は品詞に依存しない。
                const on = value.customStates[def.code] === true;
                return (
                  <div
                    key={def.code}
                    // ★M24-12: キャラ固有状態も順送りの停止点にする。
                    data-seq-stop=""
                    className="rounded-md px-2 py-1.5 text-sm focus-within:bg-sky-100"
                  >
                    <div className="mb-1 text-xs font-medium text-gray-600">
                      {def.name_ja ?? def.code}
                    </div>
                    <OptionButtonGroup
                      mode="single"
                      ariaLabel={def.name_ja ?? def.code}
                      testIdPrefix={`combo-editor-custom-state-${def.code}`}
                      options={FLAG_STATE_OPTIONS}
                      value={on ? FLAG_YES : FLAG_NO}
                      onChange={(v) =>
                        setCustomState(def.code, v === FLAG_YES ? true : undefined)
                      }
                    />
                  </div>
                );
              }
              // isIntState(def) === true(supportedStateDefs でフィルタ済み)
              // M16-07: ①始動最低 / ②終了 の 2 欄。show_delta 時は ③増減(②−①)を calc 表示(入力不可)。
              const min = def.value_definition?.min ?? 0;
              const max = def.value_definition?.max;
              // ★★M31-05: 選択肢を持つ int state(設置系の変種)は値域の数字に意味が無い。
              //   ⇒ 「(0〜4)」を出すと利用者が数字を覚える形へ戻る。選択のときは出さない。
              const opts = stateOptions(def);
              const optionItems = opts.map((o) => ({
                value: String(o.value),
                label: o.label_ja ?? o.label_en ?? String(o.value),
              }));
              const rangeSuffix =
                opts.length === 0 && max != null ? `(${min}〜${max})` : "";
              const pair = readIntPair(value.customStates[def.code]);
              const startVal = pair.start_min != null ? String(pair.start_min) : "";
              const endVal = pair.end != null ? String(pair.end) : "";
              // ★選択のときは「未選択」という第 3 の見た目を作らない(flag 分岐と同じ流儀)。
              //   ⇒ 未付与は既定値(min = 「なし」)を選択済みとして見せる。
              const startSel = pair.start_min != null ? String(pair.start_min) : String(min);
              const endSel = pair.end != null ? String(pair.end) : String(min);
              const norm = normalizeIntValue(value.customStates[def.code], def);
              const delta = intStateDelta(norm);

              // ★★M31-05 追補: single_value は 1 欄だけ出す(2026-09-10 開発者の実機確認)。
              //   ★ラベルは state 名だけである —— ①②が無いのだから「始動時 / 終了時」を
              //     言う相手が居ない(customStateIntLabel が固定句を落とす)。
              //   ★数値入力のときだけ値域 (0〜3) を添える。選択のときは添えない
              //     ——数字を覚える形へ戻るためである。
              if (isSingleValueState(def)) {
                const singleVal = pair.end != null ? String(pair.end) : "";
                const singleSel = pair.end != null ? String(pair.end) : String(min);
                const label = customStateIntLabel(def, "end", "ja");
                return (
                  <div
                    key={def.code}
                    className={opts.length > 0 ? "col-span-full space-y-2" : "space-y-2"}
                    data-testid={`combo-editor-custom-state-${def.code}-group`}
                  >
                    <div
                      className="flex flex-col gap-1 rounded-md focus-within:bg-sky-100"
                      data-seq-stop=""
                    >
                      <Label className="text-xs text-gray-600">
                        {`${label}${rangeSuffix}`}
                      </Label>
                      {opts.length > 0 ? (
                        <OptionButtonGroup
                          mode="single"
                          ariaLabel={label}
                          testIdPrefix={`combo-editor-custom-state-${def.code}-value`}
                          options={optionItems}
                          value={singleSel}
                          onChange={(v) => setSingleIntField(def, v)}
                        />
                      ) : (
                        <Input
                          type="number"
                          className={`max-w-[11rem] ${NO_SPINNER}`}
                          min={min}
                          max={max}
                          value={singleVal}
                          data-testid={`combo-editor-custom-state-${def.code}-value`}
                          onChange={(e) => setSingleIntField(def, e.target.value)}
                          onKeyDown={blockNonNumericKeys(false)}
                        />
                      )}
                    </div>
                  </div>
                );
              }
              // M16-07: int は ①② の 2 欄を縦積みする。1 グリッドセル内に複数欄を置くため、
              // グリッド行高へ伸ばす Field(h-full/mt-auto)ではなく自然高のブロックで積む
              // (Field を使うと両欄が h-full で行高を奪い合い重なる/貫通する)。
              return (
                <div
                  key={def.code}
                  className="col-span-full space-y-2"
                  data-testid={`combo-editor-custom-state-${def.code}-group`}
                >
                  {/* ★M24-12: ①② はそれぞれ順送りの停止点にする(1 停止にまとめると
                      ② へキーボードで入れない)。 */}
                  <div className="flex flex-col gap-1 rounded-md focus-within:bg-sky-100" data-seq-stop="">
                    <Label className="text-xs text-gray-600">
                      {`${customStateIntLabel(def, "startMin", "ja")}${rangeSuffix}`}
                    </Label>
                    {opts.length > 0 ? (
                      <OptionButtonGroup
                        mode="single"
                        ariaLabel={customStateIntLabel(def, "startMin", "ja")}
                        testIdPrefix={`combo-editor-custom-state-${def.code}-start`}
                        options={optionItems}
                        value={startSel}
                        onChange={(v) => setIntField(def, "start_min", v)}
                      />
                    ) : (
                      <Input
                        type="number"
                        className={`max-w-[11rem] ${NO_SPINNER}`}
                        min={min}
                        max={max}
                        value={startVal}
                        data-testid={`combo-editor-custom-state-${def.code}-start`}
                        onChange={(e) => setIntField(def, "start_min", e.target.value)}
                        onKeyDown={blockNonNumericKeys(false)}
                      />
                    )}
                  </div>
                  <div className="flex flex-col gap-1 rounded-md focus-within:bg-sky-100" data-seq-stop="">
                    <Label className="text-xs text-gray-600">
                      {`${customStateIntLabel(def, "end", "ja")}${rangeSuffix}`}
                    </Label>
                    {opts.length > 0 ? (
                      <OptionButtonGroup
                        mode="single"
                        ariaLabel={customStateIntLabel(def, "end", "ja")}
                        testIdPrefix={`combo-editor-custom-state-${def.code}-end`}
                        options={optionItems}
                        value={endSel}
                        onChange={(v) => setIntField(def, "end", v)}
                      />
                    ) : (
                      <Input
                        type="number"
                        className={`max-w-[11rem] ${NO_SPINNER}`}
                        min={min}
                        max={max}
                        value={endVal}
                        data-testid={`combo-editor-custom-state-${def.code}-end`}
                        onChange={(e) => setIntField(def, "end", e.target.value)}
                        onKeyDown={blockNonNumericKeys(false)}
                      />
                    )}
                  </div>
                  {def.show_delta && (
                    <div
                      className="text-sm text-gray-600"
                      data-testid={`combo-editor-custom-state-${def.code}-delta`}
                    >
                      {customStateIntLabel(def, "delta", "ja")}: {formatIntStateValue("delta", delta)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CollapsibleFieldset>
        </div>
      )}

      <div data-seq-section="oki">
      <CollapsibleFieldset
        legend="起き攻め"
        data-testid="combo-editor-oki-section"
        open={openSections.oki}
        onOpenChange={(o) => setOpenSections((p) => ({ ...p, oki: o }))}
        // ★★M24-12(②): 複数選べることを小さく端的に示す(2026-08-28 開発者指示)。
        //   ★節に 1 回だけ出す。攻撃種別ごとに繰り返すと 3 回出て煩い。
        summary={
          <span className="flex flex-wrap items-center gap-x-3 text-xs text-gray-500">
            <span>複数選択可</span>
            {/* ★★M27-02b(P4M-011): 「一度でも調べたか」のトグル。
                ★★これが本サブの中心である——チェックが 1 つも無いとき、
                  「まだ調べていない」のか「調べたが成立するものが無かった」のかを
                  決めるのはこの 1 個だけである。
                ★節見出しの隣に置く(常時見える)。畳んでいても状態が読める。 */}
            <label
              className="flex items-center gap-1"
              // ★節見出しのクリック(開閉)を巻き込まない。
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="checkbox"
                data-testid="combo-editor-oki-verified"
                checked={value.okiVerified}
                onChange={(e) => requestOkiVerifiedChange(e.target.checked)}
              />
              <span>{OKI_VERIFIED_LABEL}</span>
            </label>
          </span>
        }
        summaryPlacement="inline"
      >
        {/* M16-03: 正規化オプション UI(attack_type × tech_type × uses_dr)。
            attack_type ごとにグルーピングし、シミー/打撃重ねにも ドライブラッシュ 切替を持つ。
            画面ラベルは「ドライブラッシュ」正式名称(DES-005 §5.6・「DR」略記不可)。

            ★★M24-12: チェックボックスをボタン群(OptionButtonGroup の複数選択)へ替えた。
              ★見た目の狙いは 2 つある。
                ① 受け身種別ごとに行を分ける(2026-08-28 開発者指示)。columns={2} で
                   1 行目＝その場受け身の 2 つ、2 行目＝後ろ受け身の 2 つになる。
                   ★OKI_OPTION_SPECS の生成順が
                     (その場・ノーゲージ)(その場・DR)(後ろ・ノーゲージ)(後ろ・DR)
                     なので、2 列に並べるだけでこの行分けになる。並べ替えは要らない。
                ② マウスに持ち替えずキーボードだけで入力できるようにする
                   (2026-08-28 開発者要望)。**攻撃種別ごとに 1 群＝3 群**に割り、
                   各群で 1〜4 がトグルになる。
              ★★12 個を平らに並べると数字キー(10 個)に収まらないが、
                「4 個 × 3 群」に割れば収まる。これが起き攻めを「ボタン化の対象外」
                としつつキーボードで届かせられる理由である
                ——**対象外なのはプルダウンでないからであって、届かない理由ではない。**
            ★data-testid は M16-03 の形のまま(`combo-editor-oki-<attack>-<tech>-<dr|nogauge>`)。
              ★変えると既存の E2E / ユニットテストが空振りする。 */}
        <div className="space-y-3">
          {OKI_ATTACK_TYPES.map((attackType) => {
            const specs = OKI_OPTION_SPECS.filter(
              (s) => s.attackType === attackType,
            );
            return (
              // ★★M24-12: 攻撃種別ごとに 1 停止。⇒ 順送りは 3 回で起き攻めを通り抜け、
              //   各停止で 1〜4 が効く(12 個を平らに並べず数字キー 10 個に収める)。
              // ★★M24-12(開発者確認 d・2026-08-29): 停止点にハイライトが付いて
              //   いなかった。他の停止点は Field / キャラ固有状態が持っていたが、
              //   起き攻めだけ素の div だったため付け忘れていた。
              <div
                key={attackType}
                data-seq-stop=""
                className="rounded-md px-2 py-1.5 focus-within:bg-sky-100"
              >
                <div className="mb-1 text-xs font-medium text-gray-600">
                  {OKI_ATTACK_TYPE_LABELS[attackType]}
                </div>
                <OptionButtonGroup
                  mode="multiple"
                  ariaLabel={`起き攻め: ${OKI_ATTACK_TYPE_LABELS[attackType]}`}
                  testIdPrefix="combo-editor-oki"
                  columns={2}
                  options={specs.map((spec) => ({
                    value: okiOptionTestValue(spec),
                    // ★M24-03 レビュー 高-2: ラベルの組み立ては constants/oki.ts の
                    //   単一の正典を通す。ここでインラインに組み立てると、入力面と
                    //   読む面(詳細・比較・出力)で表記が割れる。
                    label: okiTechAndGaugeLabel(spec),
                  }))}
                  values={specs
                    .filter((spec) =>
                      value.okiOptions.some(
                        (o) => okiOptionKey(o) === okiOptionKey(spec),
                      ),
                    )
                    .map(okiOptionTestValue)}
                  onToggle={(v) => {
                    const spec = specs.find((s) => okiOptionTestValue(s) === v);
                    if (!spec) return;
                    const on = value.okiOptions.some(
                      (o) => okiOptionKey(o) === okiOptionKey(spec),
                    );
                    toggleOki(spec, !on);
                  }}
                />
              </div>
            );
          })}
        </div>
      </CollapsibleFieldset>
      </div>

      {/* ★★M27-02b: 「調べた」を外す操作の確認。**チェックが付いている状態で外すのは
          操作ミスと考えられる**ため一度止める(開発者確定 2026-09-03)。
          ★外した結果どうなるかを文面で言う——「未検証」に戻ると、詳細では
            「まだ調べていません」と出るようになる。 */}
      <AlertDialog
        open={okiVerifiedConfirmOpen}
        onOpenChange={setOkiVerifiedConfirmOpen}
      >
        <AlertDialogContent data-testid="combo-editor-oki-verified-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>{OKI_VERIFIED_UNSET_TITLE}</AlertDialogTitle>
            <AlertDialogDescription>
              {OKI_VERIFIED_UNSET_DESCRIPTION}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              data-testid="combo-editor-oki-verified-confirm-ok"
              onClick={() => set("okiVerified", false)}
            >
              未検証に戻す
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* M15-05 追補: メモ・マイコンボ・タグを1つの「その他情報」節に統合(開発者要望)。
          各中身(Textarea/MyComboStatusSelect/TagSelector)は内部不変。 */}
      <div data-seq-section="other">
      <CollapsibleFieldset
        legend="その他情報"
        contentClassName="space-y-4"
        data-testid="combo-editor-other-section"
        open={openSections.other}
        onOpenChange={(o) => setOpenSections((p) => ({ ...p, other: o }))}
      >
        {/* M17-01: メディア 3 フィールド(文字列参照まで・形式強制なし)。空入力での保存=クリア。 */}
        <Field label="リンク">
          <Input
            type="text"
            maxLength={2000}
            data-testid="combo-editor-link"
            value={value.link}
            onChange={(e) => set("link", e.target.value)}
            placeholder="解説ページ等の URL(任意・http/https のみリンク化)"
          />
        </Field>

        <Field label="動画パス">
          <Input
            type="text"
            maxLength={2000}
            data-testid="combo-editor-video-path"
            value={value.videoPath}
            onChange={(e) => set("videoPath", e.target.value)}
            placeholder="動画ファイルの相対パス(任意・表示のみ)"
          />
        </Field>

        <Field label="画像パス">
          <Input
            type="text"
            maxLength={2000}
            data-testid="combo-editor-image-path"
            value={value.imagePath}
            onChange={(e) => set("imagePath", e.target.value)}
            placeholder="画像ファイルの相対パス(任意・表示のみ)"
          />
        </Field>

        {/* ★★M24-12: エディタではボタン群にする(選択肢 4 個＝10 以下)。
            ★共有部品 `MyComboStatusSelect` はそのまま残す——コンボ一覧の行
              (ComboTableRow)が同じ部品を使っており、一覧は本サブの対象外である。
            ★並び順は現状のまま(使用中 / 練習中 / 頻度低下 / 外す)。開発者の
              「中立を一番左・既定に」の指示は状況の 4 欄が対象であり、この欄の
              「マイコンボから外す」は中立ではなく意味のある操作である。 */}
        <Field label="マイコンボ">
          <OptionButtonGroup
            mode="single"
            ariaLabel="マイコンボ"
            testIdPrefix="combo-editor-mycombo-status"
            options={MYCOMBO_STATUS_BUTTON_OPTIONS}
            value={currentMyComboStatus}
            disabled={statusTagsLoading}
            onChange={(v) => handleMyComboStatusChange(v as MyComboStatus | "")}
          />
        </Field>

        {/* ★★M24-12(§4.11): 順送りで到達したら候補を開く。Tab の素通りでは開かない。 */}
        <Field label="タグ" openOnArrival>
          <TagSelector
            selectedTagIds={value.tagIds}
            onChange={(ids) => set("tagIds", ids)}
            excludeCategories={[TAG_CATEGORY_MYCOMBO_STATUS]}
            onCreateTag={onCreateTag}
            creating={tagCreating}
          />
        </Field>

        {/* ★★M24-12: メモを節の末尾(タグの下)へ移した(2026-08-28 開発者指示)。
            ★メモは基本情報タブの最後の項目になる。第 3 段で入れるキーボードの順送りは
              メモ欄で無効化する(Enter は改行・↓ はカーソル移動)ため、
              「順送りが効かない唯一の欄」が末尾に来る形になり、そこからの出口
              (「レシピへ」ボタン)がそのままタブ 2 への導線になる。 */}
        <Field label="メモ">
          <Textarea
            rows={3}
            maxLength={2000}
            data-testid="combo-editor-memo"
            value={value.memo}
            onChange={(e) => set("memo", e.target.value)}
            placeholder="このコンボに関するメモ(任意)"
          />
        </Field>

        {/* ★★M24-12: メモ欄の直後に「レシピへ」を置く(指示書 §4.4.1 / D-578(5))。
            ★★メモ欄は順送りを無効にしてある唯一の欄である——Enter は改行、↓ は
              カーソル移動であってほしい。⇒ そこからの出口が要る。
            ★メモは「その他情報」節の末尾＝基本情報タブの最後の項目でもあるため
              (2026-08-28 開発者指示)、この位置がそのままタブ 2 への導線になる。
            ★開発者の逐語＝「タブのみ。あるいは普通にクリックでレシピ遷移の
              ボタンを押す。」 */}
        {onGoToRecipe && (
          <div className="flex justify-end">
            <button
              type="button"
              data-testid="combo-editor-go-to-recipe"
              onClick={onGoToRecipe}
              className="rounded border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700 hover:bg-blue-100"
            >
              レシピへ →
            </button>
          </div>
        )}
      </CollapsibleFieldset>
      </div>

      {showDraftToggle && (
        <ComboDraftToggleField
          checked={value.isDraft}
          onChange={(checked) => set("isDraft", checked)}
        />
      )}
    </div>
  );
}

// ★★M37-01: blockNonNumericKeys の定義も ../numericInput へ移した。
//   ★import 元を動かさないため、従来どおり本ファイルからも re-export する。
export { blockNonNumericKeys };

// ★★M37-01: clampNumericString の定義も ../numericInput へ移した(MassPercentInput と
//   共有するため)。★import 元を動かさないため、従来どおり本ファイルからも re-export する。
export { clampNumericString };

// M24-12: マイコンボのボタン群の選択肢。
// ★ラベルは constants/mycombo.ts の正典を通す(画面側へ生リテラルを書かない)。
// ★「マイコンボから外す」は値が空文字である(タグを外す＝状態なし)。
const MYCOMBO_STATUS_BUTTON_OPTIONS: ReadonlyArray<{
  value: string;
  label: string;
}> = [
  ...MYCOMBO_STATUS_VALUES.map((s) => ({
    value: s as string,
    label: MYCOMBO_STATUS_LABELS[s],
  })),
  { value: "", label: MYCOMBO_STATUS_REMOVE_LABEL },
];

/**
 * 中立の選択肢「不問」を先頭に足す(M24-12・2026-08-28 開発者指示)。
 *
 * ★値は空文字のまま。保存時に NULL へ落ちる従来の挙動を変えない
 *   ——変えるのは並び順とラベルだけである。
 *
 * ★★★【M38-01・射程 5】**通す欄は 2 つである。⇒ 状況 4 軸へ一律に配らないこと。**
 *
 *   | 欄 | 本関数 | なぜ |
 *   |---|---|---|
 *   | 始動位置 | **通す** | `CHANGE-200` / `M37-05` が `start_position_mass IS NULL ⇔ position = 不問` を確立している。⇒ NULL が「不問」を表すことが設計で決まっている |
 *   | 相手の大きさ | **通す** | 開発者裁定(2026-09-17)＝「不問でも成立する、むしろ不問がないと不便」 |
 *   | 相手の状態 | 通さない | 中立が `"any"` であり、空文字とは**別の保存値**になる(`DES-006` §2.4)。⇒ `stanceOptionsFor` |
 *   | **ヒット種別** | **通さない** | **`SUPP-001` §3.2 の値域 8 値に「不問」が無い。**⇒ `hitTypeOptionsFor`(`labels.ts`) |
 *
 * ★★★ヒット種別を外したのが `M38-01` である。**元に戻さないこと** ——
 *   M24-12 は 4 欄へ一律に足したが、ヒット種別だけは値域に無い選択肢を作っており、
 *   開発者が画面で「1 不問」を見て起票した(「1」は数字キーの表示)。
 *   ⇒ 次に欄を足すときは、**その欄の値域に「不問」が在るかを先に確かめる**こと。
 */
function withUnspecifiedFirst(
  options: ReadonlyArray<{ value: string; label: string }>,
): ReadonlyArray<{ value: string; label: string }> {
  return [{ value: "", label: UNSPECIFIED_LABEL }, ...options];
}

// ★★M24-12: 1 カラム縦積みの 1 行。ラベルを左・入力を右に置いて「横長にして縦に積む」
//   (開発者逐語＝「横を広げて縦に並べる」・D-577)。
//
// ★M16-06 の「セルを h-full で伸ばし入力欄を mt-auto で下端へ寄せる」は、2 カラム
//   グリッドで長ラベルが折り返したときに隣接セルと入力欄がズレるのを防ぐ工夫だった。
//   ⇒ 1 カラムでは隣接セルが無いためズレようが無く、不要になったので外した。
//
// ★sm 未満では縦に積む(ラベルが上・入力が下)。狭い幅で 150px のラベル列を固定すると
//   入力欄が潰れるためである。★これは「幅で役割が変わる」形ではない——出る情報も
//   操作も同じで、折り返し方だけが変わる。
function Field({
  label,
  children,
  openOnArrival,
  requirement,
  topic,
}: {
  label: string;
  children: ReactNode;
  /**
   * ★★M27-02b: 必須 / 任意 / 未検証 の 3 状態。**印を出す経路はここ 1 本だけである**
   *   ——欄ごとに違う見せ方をしないため(M27-overview §3 M27-02「1 つの規則を 3 か所へ通す」)。
   * ★`optional` は描かれない(FieldRequirementBadge が null を返す)。
   *   任意 13 欄すべてに印を付けると読めなくなるためで、規則は節先頭の凡例が示す。
   */
  requirement?: FieldRequirement;
  /** 印の data-testid 用の識別子(例 "damage")。requirement を渡すときに添える。 */
  topic?: string;
  /**
   * ★★M24-12(§4.11・D-582): 順送りで**到達したときだけ**中身を開く欄か。
   *
   * ★開発者の逐語＝「メモ以外だとタグで一回停止した。フォーカスがあった時に、
   *   クリックしたのと同じものを出してほしい。」
   * ★★「フォーカスしただけで開く」は採らない——`Tab` で素通りするときも毎回
   *   開いて煩いためである(指示書 §4.11)。
   * ★実際に開くのは `useFieldSequence` 側で、**中の要素をクリックする**。
   *   ⇒ 開いた後の操作がクリック時と完全に同一になる(同じ経路を通るため)。
   */
  openOnArrival?: boolean;
}) {
  return (
    <div
      // ★★M24-12(第 3 段): 順送りの停止点。1 欄 = 1 停止。
      //   ★停止点の一覧は DOM から採る(この属性を数える)。手書きの配列を持たない——
      //     キャラ固有状態や仮登録トグルは条件付きで描かれるため、配列にすると
      //     必ず実物とずれる。
      data-seq-stop=""
      data-seq-open-on-arrival={openOnArrival ? "" : undefined}
      // ★★ハイライト。入力中の項目の背景を横長に薄い水色で出す(D-577)。
      //   ★state ではなく focus-within で描く。⇒ 「ハイライトも一緒に移る」が
      //     フォーカスの移動そのもので満たされ、位置を二重に持たなくて済む。
      //     クリックで直接触ったときも同じように光る(編集モードで順送りを
      //     強制しない＝§4.4.1 とも噛み合う)。
      className="flex flex-col gap-1 rounded-md px-2 py-1.5 focus-within:bg-sky-100 sm:grid sm:grid-cols-[minmax(9rem,14rem)_1fr] sm:items-center sm:gap-3"
    >
      <Label className="text-xs text-gray-600">
        {label}
        {requirement && topic ? (
          <FieldRequirementBadge requirement={requirement} topic={topic} />
        ) : null}
      </Label>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

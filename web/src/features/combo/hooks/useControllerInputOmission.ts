import { useEffect, useMemo, useState } from "react";

import { useCharacters } from "@/features/character/hooks/useCharacters";
import { useCommandIndex } from "@/features/moves/api";
import type { Move } from "@/features/moves/types";

import type { CommandIndexEntries } from "../inputResolutionStage2";
import { parseCustomStateDefs } from "../customStates";
import type { RecipeInputContext } from "../moveSurfacing";
import {
  isControllerSurfaced,
  isInputExcluded,
  normalTabMoveIds,
} from "../moveSurfacing";

// 全技一覧(プルダウン)から「仮想コントローラで入力できる技」を省く切替(M30-01 / SM-100)。
//
// ★★述語は features/combo/moveSurfacing.ts の isControllerSurfaced を**そのまま裏返す**。
//   ⇒ 規則を 2 か所へ書かない(指示書 §2.5-2)。タブ側が変われば、こちら側も同じ手番で変わる。
//
// ★★既定は OFF である(開発者判断 2026-09-08)。既存のコンボが参照している技が
//   一覧から消えると、利用者が探せなくなる面があるため(指示書 §2.5-3)。
//
// ★★ON にしても入力手段が消える技は 1 件も無い。省かれるのはコントローラのいずれかの面から
//   押せる技だけであり、残るのは未掲載タブに並ぶ集合と完全に一致する
//   (チェックリスト §6-3 が禁じているのは「ファミリー UI に載らない技を省くこと」である)。
//
// ★保持は component-local の useState だけで行い、ブラウザストレージへ置かない。
//   ⇒ web/CLAUDE.md §1 の台帳へ新しいキーを足していない。
//   面を離れると既定(OFF)へ戻るため、「消えたまま戻せない」状態にならない。
//
// ★★【2026-09-10 追加・M31-04】本フックはトグルとは別に、**入力面へ一切出さない技**
//   (moveSurfacing の INPUT_EXCLUDED_MOVE_CODES)を**常に**落とす。
//   ⇒ 既定 OFF は「全件表示」ではなくなった。★上の「OFF = 全件表示」という旧記述は
//     この行で失効している。⇒ 「トグルを OFF にすれば全 moves が並ぶ」を前提に
//     別の面を作らないこと。
//   ★常時除外はトグルの効き目ではないため omittedCount には数えない。
//
// ★★【2026-09-12 追加・M31-06】常時除外の理由が 2 つになった。⇒ 本フックは面(context)を要る。
//   ・INPUT_EXCLUDED_MOVE_CODES …… 両面で落とす。
//   ・setup_only ………………………………… **コンボ側だけ**落とす。セットプレイのレシピ入力では出す
//     (同面が setup_only の技の唯一の入り口である)。
//   ★★2 面が本フックを共有している(RecipeBuilder / SetupRecipeEditor)。
//     ⇒ context を渡し忘れると型検査が止める(既定値を置いていない)。

const EMPTY_ENTRIES: CommandIndexEntries = {};

// 技セレクタの値のうち「非技ステップ」を表す接頭辞(RecipeBuilder / SetupRecipeEditor の
// `nonmove:<type>`)。★既存の同リテラルは各エディタ側に散在したままにしてある——
//   本サブの射程は出し分けであり、無関係な差分を増やさないため(必要なら別の手番で畳む)。
const NON_MOVE_VALUE_PREFIX = "nonmove:";

export interface ControllerInputOmission {
  /** 省く側に倒しているか。 */
  omitSurfaced: boolean;
  setOmitSurfaced: (next: boolean) => void;
  /**
   * プルダウンへ並べる技。
   *
   * ★★omitSurfaced=false でも「全件」ではない —— 入力面へ一切出さない技
   *   (INPUT_EXCLUDED_MOVE_CODES・M31-04 ／ コンボ側の setup_only・M31-06)は
   *   トグルに関係なく常に落ちる。
   */
  visibleMoves: Move[];
  /**
   * トグルが省いている件数(0 のときトグルは件数の表示を落とす)。
   *
   * ★常時除外(INPUT_EXCLUDED_MOVE_CODES ／ コンボ側の setup_only)の分は数えない。
   *   あれはトグルの効き目ではない。
   */
  omittedCount: number;
}

export function useControllerInputOmission(
  characterId: number | null | undefined,
  moves: Move[],
  context: RecipeInputContext,
): ControllerInputOmission {
  const [omitSurfaced, setOmitSurfaced] = useState(false);
  // ★仮想コントローラと同じ queryKey・同じ staleTime を引くため、往復は増えない。
  //   取得に失敗しても壊れない(空 entries = 段階1 だけで判定する)。
  const { data: commandIndex } = useCommandIndex(characterId);
  const entries = commandIndex?.entries ?? EMPTY_ENTRIES;
  // ★キャラ固有状態タブも「掲載済み」に数える(2026-09-08 開発者判断・案 C)。
  //   ⇒ タブ側と同じ材料を引かないと、省く集合と未分類タブの中身がずれる。
  const { data: characters } = useCharacters();
  const stateCodes = useMemo(() => {
    const raw = characters?.find((c) => c.id === characterId)?.customStates;
    return parseCustomStateDefs(raw).map((d) => d.code);
  }, [characters, characterId]);

  // ★入力面から外す技(M31-04 / M31-06)はトグルに関係なく常に落とす。⇒ 未分類タブから外した技が
  //   プルダウンからは選べる、という穴を作らない(「入力面に出さない」は面をまたぐ)。
  //   ★omittedCount には数えない —— あの数字は「トグルが省いた件数」であり、
  //     常時除外はトグルの効き目ではない。
  const selectableMoves = useMemo(
    () => moves.filter((m) => !isInputExcluded(m, context)),
    [moves, context],
  );

  // ★★走査対象も判定材料も selectableMoves である(生の moves ではない)。
  //
  // ★走査対象を selectableMoves にする理由＝常時除外の分を omittedCount へ数えないため。
  //   M31-04 の時点では moves を走査していたが、drive_reversal がどのタブにも載らない
  //   code だったため偶然 0 件しか差が出ていなかった。**setup_only は掲載される形
  //   (例 category='special')に立ちうる**ので、moves のままだと数え過ぎる。
  //   ⇒ 「常時除外は数えない」という性質を保つための変更であり、数え方の方針は変えていない。
  //
  // ★★★母集団まで selectableMoves にする理由＝surfaceBuckets と**同じ材料**を使うため
  //   (M31-06 レビュー 高-2)。**surfaceBuckets は絞った母集団(inputMoves)で解決する。**
  //   ⇒ こちらだけ生の moves を渡すと、同じ述語が 2 つの答えを返す面ができる。
  //   ★具体的な崩れ方＝段階2 の解決表 entries が setup_only の技を指しているとき、
  //     surfaceBuckets 側はその技が母集団に居ないため段階1 へフォールバックして
  //     **別の通常技 N** を解決する(N は押せる)。生の moves で解くフック側は entries が
  //     当たるため N を normalIds に入れない。⇒ **N は押せるのにトグル ON で残り、
  //     omittedCount も 1 件ずれる。** 「未分類タブ ＝ トグル ON で残る集合」が静かに崩れる。
  //   ★★データが 0 件のうちは再現しない。⇒ フェーズ5 でフラグが立った瞬間に出る。
  //     moveSurfacing.ts ヘッダの「規則を 2 か所へ書かない」は材料の一致まで含む。
  const surfacedIds = useMemo(() => {
    const normalIds = normalTabMoveIds(selectableMoves, entries);
    const ids = new Set<number>();
    for (const m of selectableMoves) {
      if (
        isControllerSurfaced(m, selectableMoves, entries, normalIds, stateCodes)
      ) {
        ids.add(m.id);
      }
    }
    return ids;
  }, [selectableMoves, entries, stateCodes]);

  const visibleMoves = useMemo(
    () =>
      omitSurfaced
        ? selectableMoves.filter((m) => !surfacedIds.has(m.id))
        : selectableMoves,
    [omitSurfaced, selectableMoves, surfacedIds],
  );

  return {
    omitSurfaced,
    setOmitSurfaced,
    visibleMoves,
    omittedCount: surfacedIds.size,
  };
}

/**
 * 一覧から消えた技が選ばれたままにならないようにする(M30-01 レビュー 高-4)。
 *
 * ★★トグルを ON にすると `<select>` の表示は空欄になるが、`selectedValue` は残る。
 *   ⇒ ［追加］が活性のままで、**画面に出ていない技をそのまま積める**。
 * ★2 面(コンボのレシピ入力・セットプレイのレシピ入力)が同じ形を要る。
 *   片面だけ直すと `E-76`(同じ規則を 2 か所に持つ)の型になるため、ここに 1 本だけ置く。
 * ★キャラ切替・技の再取得で `visibleMoves` が入れ替わったときにも同じ理由で効く。
 * ★非技ステップ(`nonmove:<type>`)は moves に依存しないため対象外である。
 */
export function useClearHiddenSelection(
  visibleMoves: Move[],
  selectedValue: string,
  setSelectedValue: (next: string) => void,
): void {
  useEffect(() => {
    if (selectedValue === "") return;
    if (selectedValue.startsWith(NON_MOVE_VALUE_PREFIX)) return;
    if (visibleMoves.some((m) => String(m.id) === selectedValue)) return;
    setSelectedValue("");
  }, [visibleMoves, selectedValue, setSelectedValue]);
}

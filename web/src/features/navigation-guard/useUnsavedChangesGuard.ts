import { useEffect, useId } from "react";

import { useNavigationGuardContext } from "./NavigationGuardProvider";

/**
 * M24-04(CO-003): 未保存の変更があるあいだ、画面からの離脱を確認つきにする。
 *
 * @param isDirty 初期値と現在値を比べた結果。★「欄に触ったら true」にしないこと
 *   ——フォーカスしただけで確認が出ると、機能そのものが邪魔になる(指示書 §4.1)。
 *   ★保存が成功したら false に落とすこと。落とさないと保存直後の遷移で毎回出る。
 */
export function useUnsavedChangesGuard(isDirty: boolean): void {
  const { setBlocked } = useNavigationGuardContext();
  const id = useId();

  useEffect(() => {
    setBlocked(id, isDirty);
    return () => setBlocked(id, false);
  }, [id, isDirty, setBlocked]);
}

/**
 * 画面内の遷移(「キャンセル」ボタンなど)を確認つきで行う。
 * ★リンクではないので click キャプチャに掛からない。ここを通すこと。
 *
 * ★★行き先は「どこへ」か「戻る」の 2 択である。任意の関数は預かれない
 *   ——ガードは番人の履歴エントリを 1 枚積んでおり、離脱はその 1 枚ぶんを
 *   補正する必要がある。任意の関数(例: `navigate(-1)`)では補正のしようがなく、
 *   「離れたつもりで編集画面自身のエントリへ戻る」＝離れられない状態になる。
 */
export function useRequestLeave(): {
  leaveTo: (to: string) => void;
  leaveBack: () => void;
} {
  const { requestLeaveTo, requestLeaveBack } = useNavigationGuardContext();
  return { leaveTo: requestLeaveTo, leaveBack: requestLeaveBack };
}

/**
 * 保存が済んだ直後など、**確認は要らないが番人の補正は要る**離脱の入口。
 *
 * ★★素の `navigate(-1)` を呼んではいけない——ガードが積んだ番人のエントリぶんしか
 *   戻らず、編集画面自身へ着地する。しかも dirty を落とす state 更新は非同期なので、
 *   その時点ではガードがまだ張られており、確認ダイアログまで出る。
 *   （2026-08-28 の開発者手動確認 ④-1 で、セットプレイ編集の保存で実際に起きた）
 */
export function useLeaveWithoutConfirm(): {
  leaveTo: (to: string) => void;
  leaveBack: () => void;
} {
  const { leaveWithoutConfirmTo, leaveWithoutConfirmBack } =
    useNavigationGuardContext();
  return {
    leaveTo: leaveWithoutConfirmTo,
    leaveBack: leaveWithoutConfirmBack,
  };
}

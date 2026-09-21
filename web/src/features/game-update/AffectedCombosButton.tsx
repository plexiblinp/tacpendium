import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useGameUpdateNotice } from "./api";

/**
 * コンボ一覧へ足す入口(DES-005 §5.19b-6)。
 *
 * ★★一覧に増えるのはこのボタン 1 個だけである。フィルタ軸は足さない
 *   (開発者の逐語 =「一覧に常に 1 軸増えると邪魔」)。
 * ★★延期しても消えない —— 抑止するのはバナーだけである。LAN で 1 人が延期したら
 *   他の利用者が入口を失う形にしない。⇒ ここが分水嶺である(CHANGE-162 §2.3)。
 * ★★取得に失敗したときに「0 件」として扱わない。ボタンの位置にも失敗として出す。
 * ★件数はアプリ全体の合計である。⇒ 文面に「全キャラ」を明記する
 *   (コンボ一覧は必ずキャラを 1 体選んでいるため、書かないと選択中キャラの件数と読まれる)。
 */
export default function AffectedCombosButton() {
  const { t } = useTranslation();
  const notice = useGameUpdateNotice();

  if (notice.isError) {
    return (
      <span
        className="text-sm text-red-600"
        data-testid="game-update-button-error"
      >
        {t("gameUpdate.listButtonError")}
      </span>
    );
  }
  if (notice.isLoading) {
    return (
      <span className="text-sm text-slate-400">
        {t("gameUpdate.listButtonLoading")}
      </span>
    );
  }
  // ★0 件なら出さない(直すものが無い)。
  if (!notice.data || notice.data.affectedCount === 0) {
    return null;
  }

  return (
    <Link
      to="/game-update/combos"
      className="inline-flex items-center rounded border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-100"
      data-testid="game-update-button"
    >
      {t("gameUpdate.listButton", { count: notice.data.affectedCount })}
    </Link>
  );
}

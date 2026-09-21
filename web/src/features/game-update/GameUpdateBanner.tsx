import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import {
  useGameUpdateNotice,
  usePostponeGameUpdateNotice,
} from "./api";

/**
 * ゲーム更新の影響コンボがあることを知らせるバナー(FR702・DES-005 §5.19b)。
 *
 * ★★マウント先は HomePage ＋ ComboListPage の 2 か所である ——
 *   App.tsx のデスクトップ・リダイレクトにより 640px 以上では HomePage が
 *   一度も描画されない。⇒ ホームだけに置くと主動線が PC で丸ごと消える
 *   (既存の移行告知が実際にこれで消えていた = migration-banner-never-shown-on-desktop)。
 *
 * ★★延期が抑止するのはこのバナーだけである。一覧のボタン(AffectedCombosButton)は
 *   抑止しない —— LAN では 1 人の延期が全員に効くため、ボタンまで消すと他の利用者が
 *   入口を失う。⇒ ここが分水嶺である。
 *
 * ★★取得に失敗したときに「0 件」として扱わない。失敗はバナーの位置に失敗として出す
 *   (先例の轍 = combo-list-setup-count-hides-fetch-failure)。
 *
 * ★ブラウザストレージを使わない。延期の印はサーバ側の告知ファイルが持つ
 *   (CLAUDE.md §10.X の台帳に無いキーを増やさない = 移行告知と同じ理由)。
 */
export default function GameUpdateBanner() {
  const { t } = useTranslation();
  const notice = useGameUpdateNotice();
  const postpone = usePostponeGameUpdateNotice();

  // ★★失敗を黙って消さない。件数が取れていないことを画面へ出す。
  if (notice.isError) {
    return (
      <div
        className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        role="status"
        data-testid="game-update-banner-error"
      >
        <span>{t("gameUpdate.noticeError")}</span>
        <button
          type="button"
          onClick={() => notice.refetch()}
          className="ml-3 underline hover:no-underline"
        >
          {t("gameUpdate.noticeRetry")}
        </button>
      </div>
    );
  }

  if (!notice.data) {
    return null;
  }
  const { affectedCount, currentDataVersion, postponedForVersion } = notice.data;

  // ★0 件なら出さない。★延期中も出さない —— ただし抑止されるのはここだけである。
  if (affectedCount === 0 || postponedForVersion === currentDataVersion) {
    return null;
  }

  return (
    <div
      className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4"
      role="status"
      data-testid="game-update-banner"
    >
      <h2 className="text-sm font-bold text-amber-800">
        {t("gameUpdate.bannerTitle")}
      </h2>
      <p className="mt-1 text-sm text-slate-700">
        {t("gameUpdate.bannerBody", { count: affectedCount })}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <Link
          to="/game-update/combos"
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          {t("gameUpdate.bannerAction")}
        </Link>
        <button
          type="button"
          onClick={() => postpone.mutate()}
          disabled={postpone.isPending}
          className="text-sm text-slate-600 hover:underline disabled:text-slate-400"
          data-testid="game-update-postpone"
        >
          {t("gameUpdate.bannerPostpone")}
        </button>
      </div>
    </div>
  );
}

import { useTranslation } from "react-i18next";
import { X } from "lucide-react";

import {
  useAckDataMigrationNotice,
  useDataMigrationNotice,
} from "./useDataMigrationNotice";

/**
 * データの保存場所が変わったことを 1 度だけ知らせるバナー(M28-01 §2.3-5)。
 *
 * ★ブラウザストレージを使わない。「読んだ」印はバックエンド側の告知ファイルに持つ。
 * 理由は 2 つ。(1) CLAUDE.md §10.X の台帳に無いキーを増やさない
 * (2) 移行が走った起動でブラウザを開かなかった場合、ブラウザ側にだけ状態を置くと
 * 告知が誰にも届かないまま消える。
 */
export default function DataMigrationBanner() {
  const { t } = useTranslation();
  const { data: notice } = useDataMigrationNotice();
  const ack = useAckDataMigrationNotice();

  if (!notice || notice.acknowledged) {
    return null;
  }

  // ★題は 4 通りある。status の 2 分岐にすると、何も移していない経路(skipped)で
  // 「データの保存場所が変わりました」と出てしまい、本文「移行しません」と食い違う。
  //
  // ★★とくに old_data_stranded は「新旧の両方が在る」の中の**危険形**である
  // ——いま開いているデータが空で、実データが旧に取り残されている。
  // 良性形(旧はただの控え)と同じ色・同じ題で出すと、見分けがつかない。
  const failed = notice.status === "failed";
  const stranded = notice.reason === "old_data_stranded";
  const skipped = notice.status === "skipped";
  const alarming = failed || stranded;
  const tone = alarming
    ? "bg-red-50 border-red-200"
    : "bg-amber-50 border-amber-200";
  const titleTone = alarming ? "text-red-800" : "text-amber-800";
  const titleKey = failed
    ? "dataMigration.failedTitle"
    : stranded
      ? "dataMigration.strandedTitle"
      : skipped
        ? "dataMigration.skippedTitle"
        : "dataMigration.title";

  return (
    <div className={`relative rounded-lg border px-4 py-4 ${tone}`} role="status">
      <button
        type="button"
        onClick={() => ack.mutate()}
        aria-label={t("dataMigration.dismiss")}
        className="absolute top-2 right-2 text-slate-400 hover:text-slate-600"
      >
        <X className="h-4 w-4" />
      </button>
      <h2 className={`text-sm font-bold pr-6 ${titleTone}`}>
        {t(titleKey)}
      </h2>
      <p className="text-sm text-slate-700 mt-1 pr-6">{notice.message}</p>
      {notice.retiredTo ? (
        <p className="text-xs text-slate-600 mt-2 pr-6">
          {t("dataMigration.retiredTo", { path: notice.retiredTo })}
        </p>
      ) : null}
      {notice.retireFailed ? (
        <p className="text-xs text-slate-600 mt-2 pr-6">
          {t("dataMigration.retireFailed", { path: notice.from ?? "" })}
        </p>
      ) : null}
    </div>
  );
}

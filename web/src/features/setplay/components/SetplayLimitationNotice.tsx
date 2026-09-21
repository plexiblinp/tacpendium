import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Info } from "lucide-react";

import { setplayNoticeStorage } from "../setplay-notice-storage";

// SetplayLimitationNotice は提案の制約を告知する(M19-01 §4.6.3)。
//
// 表示仕様:
//   - 初回(その利用者が初めて開いたとき)だけ自動表示する。
//   - 2 回目以降は自動表示しない。注意アイコン押下時のみ表示する。
//   - 閉じる操作で消える。保持に失敗した場合は非表示に倒す(毎回表示にしない)。
//
// M19-LIMITATION-NOTICE: 文面(i18n `setplay.limitations.*`)は BE の制約実装
// (target 列挙規則・filler 規則〔category!=target_combo〕・KA NULL/負 KA 扱い・
// gap モード・打ち切り、internal/service/setplay/service.go)と対を成す。
// 制約を変更したら両方を同時に更新すること。
export function SetplayLimitationNotice() {
  const { t } = useTranslation();

  // 初回のみ自動表示。保持不可(load が null 以外を返せない等)なら非表示に倒す。
  const [open, setOpen] = useState<boolean>(() => {
    const seen = setplayNoticeStorage.load();
    if (seen === true) {
      return false; // 既読 → 自動表示しない
    }
    // 未読(null)。初回自動表示を試みる。保存に失敗しても表示自体は行うが、
    // 保存できない環境では「既読」を記録できない = 毎回自動表示になってしまうため、
    // 保存が失敗する場合は自動表示しない(非表示に倒す)。
    const saved = setplayNoticeStorage.save(true);
    return saved; // 保存成功時のみ初回自動表示
  });

  return (
    <div className="mb-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={t("setplay.limitations.info")}
          title={t("setplay.limitations.info")}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
        >
          <Info className="h-4 w-4" aria-hidden="true" />
          {t("setplay.limitations.title")}
        </button>
      </div>

      {open && (
        <div
          role="note"
          className="mt-2 space-y-1 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
        >
          <p>{t("setplay.limitations.frameOnly")}</p>
          <p>{t("setplay.limitations.notExhaustive")}</p>
          <p>{t("setplay.limitations.negativeKnockdown")}</p>
          <p>{t("setplay.limitations.gapDependsOpponent")}</p>
          <p>{t("setplay.limitations.topOnly")}</p>
          <p>{t("setplay.limitations.outOfScope")}</p>
          <p className="mt-1 font-medium">
            {t("setplay.limitations.frameCaveatsTitle")}
          </p>
          <ul className="list-disc space-y-0.5 pl-4">
            <li>{t("setplay.limitations.multiHit")}</li>
            <li>{t("setplay.limitations.lingeringProjectile")}</li>
            <li>{t("setplay.limitations.lingeringSetup")}</li>
            <li>{t("setplay.limitations.stateFiller")}</li>
            <li>{t("setplay.limitations.weakChain")}</li>
          </ul>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-1 rounded px-2 py-0.5 text-xs text-amber-700 hover:bg-amber-100"
          >
            {t("setplay.limitations.close")}
          </button>
        </div>
      )}
    </div>
  );
}

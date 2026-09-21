import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import {
  useInvalidateRecipeCacheConsumers,
  usePresets,
  useRebuildRecipeCache,
} from "@/features/preset/api";

import type { ConfigResponse } from "./types";

interface Props {
  config: ConfigResponse;
}

export default function SettingsSectionData({ config }: Props) {
  const { t } = useTranslation();

  // ★★M24-08 第 2 部 B: 「キャッシュ再構築」を実装した(開発者裁定 2026-08-30)。
  //
  // 着手前は disabled の未実装ボタンであり、対応する API も無かった。
  // recipe_cache は {presetId: 表示文字列} の JSON であり、preset_aliases を
  // 直しても追随しない。起動時の自動再構築も無いため、作り直す手段が実質
  // 存在しなかった(組み込みプリセットは PUT が 403 でエイリアス更新経由にも乗らない)。
  //
  // ★射程は「全プリセット」である(開発者裁定)。ラベル「キャッシュ再構築」が
  //   広い期待を与えるため、既定プリセットだけを直すと「押したのに直らない」が起きうる。
  //   プリセットは上限 8 枚であり、全枚回しても現実的なコストに収まる。
  // ★1 枚だけ直したいときはプリセット編集画面のボタンを使う。
  const presetsQuery = usePresets();
  const rebuild = useRebuildRecipeCache();
  const invalidateConsumers = useInvalidateRecipeCacheConsumers();
  const [rebuilding, setRebuilding] = useState(false);

  const handleRebuild = async () => {
    const presets = presetsQuery.data ?? [];
    if (presets.length === 0) {
      // ★「押したのに何も起きない」を作らない(E-84＝「起きなかった」と「失敗した」を
      //   同じ顔で出さない)。プリセットは最低 3 枚あるため通常は到達しないが、
      //   読み込み失敗時にここへ来る。
      toast.error(t("settings.data.cacheRebuildNoPresets"));
      return;
    }
    setRebuilding(true);
    // ★直列で回す。並列にすると notation 側が 1 プリセットにつき 1 トランザクションを
    //   開くため、SQLite の書き込みが競合しうる(DES-002 §6.4 の BEGIN IMMEDIATE)。
    // ★★部分失敗を握り潰さない(レビュー 中-4)。1 枚落ちても残りは試し、
    //   「何枚成功して、どこで落ちたか」を出す——途中で投げると、
    //   利用者は「何も直っていない」のか「途中まで直った」のかを区別できない。
    let done = 0;
    let failedAt: string | null = null;
    for (const p of presets) {
      try {
        await rebuild.mutateAsync(p.id);
        done += 1;
      } catch {
        if (failedAt === null) failedAt = p.name;
      }
    }
    setRebuilding(false);
    // ★枚数ぶんではなく 1 度だけ落とす(低-2)。1 枚でも成功していれば表示は変わりうる。
    if (done > 0) invalidateConsumers();

    if (failedAt === null) {
      toast.success(
        t("settings.data.cacheRebuildDone", { presetCount: presets.length }),
      );
    } else {
      toast.error(
        t("settings.data.cacheRebuildPartial", {
          presetCount: done,
          total: presets.length,
          name: failedAt,
        }),
      );
    }
  };

  return (
    <section className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold mb-4">{t("settings.data.heading")}</h2>

      <div className="space-y-3">
        <div>
          <span className="text-sm text-gray-500">{t("settings.data.dbPath")}:</span>
          <span className="ml-2 text-sm font-mono">{config.database.path || "(default)"}</span>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            disabled
            title={t("settings.data.notImplemented")}
            className="px-4 py-2 bg-gray-100 text-gray-400 rounded text-sm cursor-not-allowed"
          >
            {t("settings.data.backup")}
          </button>
          <button
            type="button"
            disabled
            title={t("settings.data.notImplemented")}
            className="px-4 py-2 bg-gray-100 text-gray-400 rounded text-sm cursor-not-allowed"
          >
            {t("settings.data.restore")}
          </button>
          <button
            type="button"
            onClick={() => void handleRebuild()}
            disabled={rebuilding || presetsQuery.isLoading}
            title={t("settings.data.cacheRebuildHint")}
            data-testid="settings-cache-rebuild"
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {rebuilding
              ? t("settings.data.cacheRebuilding")
              : t("settings.data.cacheRebuild")}
          </button>
        </div>
        <p className="text-xs text-gray-500">{t("settings.data.cacheRebuildHint")}</p>
      </div>
    </section>
  );
}

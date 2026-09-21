import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import Header from "@/components/Header";
import { DEFAULT_COLUMN_VISIBILITY } from "@/constants/combo-list";
import { useCharacters } from "@/features/character/hooks/useCharacters";
import { useCombos, useDeleteCombo } from "@/features/combo/api";
import ComboTable from "@/features/combo/components/ComboTable";
import { DeleteComboConfirm } from "@/features/combo/components/DeleteComboConfirm";
import type { ComboSummary } from "@/features/combo/types";
import {
  useAcknowledgeComboVersion,
  useGameUpdateNotice,
} from "@/features/game-update/api";

/**
 * ゲーム更新の影響コンボ(DES-005 §5.19b・CHANGE-162 §3)。
 *
 * ★★本画面が在る理由は「どの技が変わったか」を出すことである —— 「影響がある」と
 *   言うだけでは利用者は直せない(FR702 の目的そのもの)。
 * ★★既存の ComboTable を「表そのものとして」再利用する。新しい一覧の仕組みを作らない。
 *   足す 3 列は専用画面のときだけ渡す列であり、表示列カスタマイズの対象にしない。
 * ★★印(バッジ・状態列)は置かない —— 全行が該当するので冗長である(開発者確定)。
 * ★★取得に失敗したときに「0 件」として扱わない。失敗は失敗として出す。
 * ★キャラは「見出し ＋ 表」を縦に並べる(表の中にキャラ列を足さない)。
 */
/** 一度に取る上限。★BE 側の丸め(1000)と同じ値にしてある。 */
const PAGE_LIMIT = 1000;

export default function GameUpdateCombosPage() {
  const { t } = useTranslation();
  const notice = useGameUpdateNotice();
  const { data: characters } = useCharacters();
  const acknowledge = useAcknowledgeComboVersion();
  const [failedId, setFailedId] = useState<number | null>(null);
  // ★削除は一覧と同じ形にする(確認ダイアログ ＋ 同じミューテーション)。
  //   ⇒ この画面だけ別の削除の作法を持ち込まない。
  const deleteMutation = useDeleteCombo();
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  // ★キャラ横断で取る。専用画面はアプリ全体の合計を見せる面である。
  // ★limit は BE 側で 1000 に丸められる。件数の正本は告知 API の affectedCount である。
  const combosQuery = useCombos({ affectedByGameUpdate: true, limit: PAGE_LIMIT });

  const groups = useMemo(() => {
    const items = combosQuery.data?.items ?? [];
    const byCharacter = new Map<number, ComboSummary[]>();
    for (const combo of items) {
      const list = byCharacter.get(combo.characterId) ?? [];
      list.push(combo);
      byCharacter.set(combo.characterId, list);
    }
    return [...byCharacter.entries()].sort((a, b) => a[0] - b[0]);
  }, [combosQuery.data]);

  // ★★総数と表示件数が食い違うときは黙らない —— 打ち切りを言わないと「部分データを
  //   全部として見せる」形になり、combo-list-setup-count-hides-fetch-failure と同じ族になる。
  //   ★総数の正本は告知 API の affectedCount である(一覧の応答は打ち切られている)。
  const shownCount = combosQuery.data?.items.length ?? 0;
  // ★★「打ち切られた」の条件は shownCount が上限に達していることである。
  //   ⇒ 総数との差だけで判定しない —— 総数(告知 API)と行数(一覧 API)は別のクエリで
  //     あり、片方だけ先に更新される瞬間が実在する(例: 削除した直後は行数だけ減る)。
  //     差だけを見ると、その瞬間に「1 件中 0 件を表示しています」と嘘を言う。
  const truncated =
    combosQuery.isSuccess &&
    notice.data != null &&
    shownCount >= PAGE_LIMIT &&
    notice.data.affectedCount > shownCount;

  const characterName = (id: number) =>
    characters?.find((c) => c.id === id)?.nameJa ?? `#${id}`;

  const confirmDelete = () => {
    if (pendingDeleteId != null) {
      deleteMutation.mutate(pendingDeleteId);
    }
    setPendingDeleteId(null);
  };

  const handleAcknowledge = (comboId: number) => {
    setFailedId(null);
    acknowledge.mutate(comboId, {
      // ★失敗を黙って消さない。押したのに何も起きていない、を画面へ出す。
      onError: () => setFailedId(comboId),
    });
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <Header />
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">
            {t("gameUpdate.pageTitle")}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {t("gameUpdate.pageLead")}
          </p>
          {/* ★現在版は告知 API からしか取れない。取れていないときは黙って空にする
              (件数と違い、無くても誤解を生まない付帯情報であるため)。 */}
          {notice.data && (
            <p className="mt-1 text-xs text-slate-500">
              {t("gameUpdate.currentVersion", {
                version: notice.data.currentDataVersion,
              })}
            </p>
          )}
        </div>

        <Link to="/combos" className="inline-block text-sm text-blue-600 hover:underline">
          {t("gameUpdate.backToList")}
        </Link>

        {combosQuery.isLoading && (
          <p className="text-slate-500">{t("gameUpdate.pageLoading")}</p>
        )}

        {/* ★★取得失敗を「0 件」にしない。空の表を出すと「もう直っている」と読まれる。 */}
        {combosQuery.isError && (
          <div
            className="bg-red-50 border border-red-200 rounded-lg px-6 py-4 text-red-700"
            data-testid="game-update-page-error"
          >
            {t("gameUpdate.pageError")}
          </div>
        )}

        {truncated && (
          <div
            className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
            data-testid="game-update-page-truncated"
          >
            {t("gameUpdate.pageTruncated", {
              total: notice.data?.affectedCount ?? 0,
              shown: shownCount,
            })}
          </div>
        )}

        {combosQuery.isSuccess && groups.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-lg px-6 py-12 text-center text-slate-500">
            {t("gameUpdate.pageEmpty")}
          </div>
        )}

        {combosQuery.isSuccess &&
          groups.map(([characterId, combos]) => (
            <section key={characterId} className="space-y-2">
              <h2 className="text-base font-semibold text-slate-700">
                {characterName(characterId)}
              </h2>
              <ComboTable
                combos={combos}
                onDelete={setPendingDeleteId}
                // ★★［コピー］は出さない —— コピーで生まれる行は基準が現在版で埋まる
                //   ため「影響なし」として生まれ、元の行は影響ありのまま残る。
                //   ⇒ この画面の目的(変わった技を確認して直す)に対して意味を持たない。
                showCopy={false}
                visibility={DEFAULT_COLUMN_VISIBILITY}
                showGameUpdateColumns
                onAcknowledge={handleAcknowledge}
                acknowledgingId={
                  acknowledge.isPending ? (acknowledge.variables ?? null) : null
                }
                acknowledgeFailedId={failedId}
              />
            </section>
          ))}
      </div>

      <DeleteComboConfirm
        open={pendingDeleteId != null}
        message={t("comboList.deleteConfirm")}
        onOpenChange={(o) => {
          if (!o) setPendingDeleteId(null);
        }}
        onConfirm={confirmDelete}
      />
    </main>
  );
}

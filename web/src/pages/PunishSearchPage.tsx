import { useSearchParams } from "react-router-dom";

import Header from "@/components/Header";
import CharacterSelector from "@/features/mycombo/components/CharacterSelector";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PUNISH_GUARD_TYPE_BLOCK,
  PUNISH_GUARD_TYPE_JUST_PARRY,
  PUNISH_GUARD_TYPE_LABELS,
} from "@/constants/punish";
import { useResolvedCharacterId } from "@/features/combo/hooks/useResolvedCharacterId";
import { usePunishTree } from "@/features/punish/api";
import { PunishTree } from "@/features/punish/components/PunishTree";

function parseIdParam(raw: string | null): number | null {
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// PunishSearchPage は確定反撃サーチ(探す画面・M18-02)。
// 自キャラ×相手キャラ×タブ(ガード/ジャストパリィ)で走査し 3 階層ツリーを表示する。
// 選択状態は URL クエリ(self/opp/guard)に保持する(ブラウザストレージは使わない=§10.X)。
// これにより新規登録から戻った際に同じ文脈が復元される。
export default function PunishSearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // ★★M31-01(P4M-015): 自キャラの既定値。
  //   逐語＝「確定反撃の自キャラはデフォルト、または、前回選択キャラを自動で出したい。
  //   今は空。**相手は空のままでいい**」(phase4-memo.txt:54)。
  //
  //   ★★解決規則は書き起こさない。DES-005 §4.3.1 の解決順(段 1 URL → 段 2 同一
  //     セッションで最後に選んだキャラ → 段 3 config の既定 → 実在するキャラ)を
  //     実装した共通フック useResolvedCharacterId を通す。
  //   ★★相手キャラには適用しない。逐語が「相手は空のままでいい」と言っている——
  //     相手を勝手に埋めると、絞り込みが掛かった状態が既定になってしまう。
  //   ★本フックは読むだけであり、セッションへ書き戻さない
  //     (`combo-list-filters-v1` はコンボ一覧の生クエリ文字列を持つ値であり、
  //      ここから書くと一覧の絞り込みが変わる)。
  const self = useResolvedCharacterId({
    urlCharacterId: parseIdParam(searchParams.get("self")),
  });
  const opp = parseIdParam(searchParams.get("opp"));
  const guard = searchParams.get("guard") ?? PUNISH_GUARD_TYPE_JUST_PARRY;

  const setParam = (key: string, value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set(key, value);
      return next;
    });
  };

  const treeQ = usePunishTree(self, opp, guard);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <Header />
      <div className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="mb-4 text-xl font-semibold">確定反撃サーチ</h1>

      {/* 本機能の前提と限界。キャラ選択前のみ表示し、両キャラ選択で項目ごと消える
          (走査結果の邪魔にならないよう折り畳みではなく条件表示)。注意を読んでから走査する導線。 */}
      {/* ★M31-01(P4M-015): 自キャラは既定で埋まるようになった。⇒ 判定は相手だけを見る。
          ★★`self == null` を残すと死んだ条件になる——常に false であり、
            次の担当が「自キャラ未選択の分岐が在る」と読み違える。 */}
      {opp == null && (
        <div className="mb-4 rounded border border-slate-200 bg-white p-3 text-sm">
          <p className="font-medium text-slate-700">
            はじめに: この機能の前提と限界(お読みください)
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-600">
            <li>
              <span className="font-medium">距離は判定していません。</span>
              フレーム上は届いても、実際の間合いでは届かないことがあります。実戦で確かめ、採用/不採用を記録してください。
            </li>
            <li>
              <span className="font-medium">フレームデータに基づく候補です。</span>
              データが未整備の技は「自動判定できない相手技」に回ります(消さずに残します)。
            </li>
          </ul>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-gray-600">自キャラ</span>
          <CharacterSelector
            selectedCharacterId={self}
            onChange={(id) => setParam("self", String(id))}
            /* ★★M31-01(P4M-015): placeholder は表示されなくなったが**残す**。
                 CharacterSelector は `placeholder !== undefined` を pick モードの判定に
                 使っており、外すとキャラが 1 体しか無い DB で自キャラ欄が無効化される。
                 ⇒ 表示文言としてではなく、モード指定として効いている。 */
            placeholder="自キャラを選択"
            ariaLabel="自キャラ"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-gray-600">相手キャラ</span>
          <CharacterSelector
            selectedCharacterId={opp}
            onChange={(id) => setParam("opp", String(id))}
            placeholder="相手キャラを選択"
            ariaLabel="相手キャラ"
          />
        </label>
      </div>

      <Tabs
        value={guard}
        onValueChange={(v) => setParam("guard", v)}
        className="mb-4"
      >
        <TabsList>
          <TabsTrigger value={PUNISH_GUARD_TYPE_BLOCK}>
            {PUNISH_GUARD_TYPE_LABELS[PUNISH_GUARD_TYPE_BLOCK]}
          </TabsTrigger>
          <TabsTrigger value={PUNISH_GUARD_TYPE_JUST_PARRY}>
            {PUNISH_GUARD_TYPE_LABELS[PUNISH_GUARD_TYPE_JUST_PARRY]}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {opp == null ? (
        <p className="text-sm text-gray-500">
          相手キャラを選択すると、確定反撃の候補を走査します。
        </p>
      ) : treeQ.isLoading ? (
        <p className="text-sm text-gray-500">走査中...</p>
      ) : treeQ.isError ? (
        <p className="text-sm text-red-600">
          走査に失敗しました: {treeQ.error.message}
        </p>
      ) : treeQ.data ? (
        <PunishTree tree={treeQ.data} guardType={guard} />
      ) : null}
      </div>
    </main>
  );
}

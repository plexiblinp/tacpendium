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
import { usePunishList } from "@/features/punish/api";
import { HiddenItemsPanel } from "@/features/punish/components/HiddenItemsPanel";
import { PunishList } from "@/features/punish/components/PunishList";

// 画面内タブ(マイリスト / 隠したもの管理)。ガード・ジャストパリィのタブとは別軸。
const VIEW_LIST = "list";
const VIEW_HIDDEN = "hidden";

function parseIdParam(raw: string | null): number | null {
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// PunishListPage は確定反撃マイリスト(使う画面・画面21・M18-03a)。
//
// 採用済みの確定反撃を相手技 → コンボの 2 階層で見返し、使わないものを隠せる。
// 画面5「マイコンボ」とは別系統(あちらはタグ絞り込みのコンボ一覧ビュー)。
// 選択状態は URL クエリ(self/opp/guard/tab)に保持する(ブラウザストレージは使わない＝§10.X)。
export default function PunishListPage() {
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
  const view = searchParams.get("tab") ?? VIEW_LIST;

  const setParam = (key: string, value: string | null) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value == null) {
        next.delete(key);
      } else {
        next.set(key, value);
      }
      return next;
    });
  };

  const listQ = usePunishList(self, opp, guard);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <Header />
      <div className="mx-auto max-w-4xl px-4 py-6">
        <h1 className="mb-4 text-xl font-semibold">確定反撃マイリスト</h1>

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
              placeholder="すべての相手"
              ariaLabel="相手キャラ"
            />
          </label>
          {/* 相手キャラ絞りは任意。CharacterSelector 自体は解除操作を持たないため、
              選択中のみクリア用のボタンを添える(共有コンポーネントを改変しない)。 */}
          {opp != null && (
            <button
              type="button"
              onClick={() => setParam("opp", null)}
              className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-50"
            >
              すべての相手
            </button>
          )}
        </div>

        <Tabs
          value={view}
          onValueChange={(v) => setParam("tab", v)}
          className="mb-4"
        >
          <TabsList>
            <TabsTrigger value={VIEW_LIST}>確定反撃マイリスト</TabsTrigger>
            <TabsTrigger value={VIEW_HIDDEN}>隠したもの管理</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* ガード / ジャストパリィはマイリスト側のみの軸(隠したもの管理は区分に依らない)。 */}
        {view === VIEW_LIST && (
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
        )}

        {/* ★M31-01(P4M-015): 自キャラは既定で埋まるため「自キャラを選択すると…」の
            空状態は起きなくなった。⇒ 分岐ごと外す(残すと常に false の死んだ枝になる)。 */}
        {listQ.isLoading ? (
          <p className="text-sm text-gray-500">読み込み中...</p>
        ) : listQ.isError ? (
          <p className="text-sm text-red-600">
            取得に失敗しました: {listQ.error.message}
          </p>
        ) : listQ.data ? (
          view === VIEW_HIDDEN ? (
            <HiddenItemsPanel list={listQ.data} selfCharacterId={self} />
          ) : (
            <PunishList list={listQ.data} />
          )
        ) : null}
      </div>
    </main>
  );
}

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronRight, EyeOff, Plus } from "lucide-react";
import { toast } from "sonner";

import {
  materializeDamageDescription,
  materializeResultToastBehavior,
  PUNISH_COUNTER_HIT_TYPES,
  PUNISH_HIT_TYPE_BY_GUARD,
  PUNISH_LANE_LABELS,
  PUNISH_REASON_LABELS,
  PUNISH_VERDICT_ADOPTED,
  PUNISH_VERDICT_UNREACHABLE,
} from "@/constants/punish";

import {
  useAddPruning,
  useAddPunish,
  useDeleteStarterVerdict,
  useMaterialize,
  useRemovePunish,
  useSetStarterVerdict,
} from "../api";
import type {
  OpponentMoveNode,
  PunishTree as PunishTreeData,
  StarterNode,
} from "../types";
import { materializeErrorMessage } from "../materializeError";
import PunishAttributionBadge from "./PunishAttributionBadge";

function moveLabel(nameJa: string | undefined, code: string): string {
  return nameJa && nameJa.length > 0 ? nameJa : code;
}

function starterKey(oppMoveId: number, st: StarterNode): string {
  return `${oppMoveId}:${st.moveId}:${st.lane}`;
}

// トリムして空なら null(note クリア)、非空ならその値を返す。
function noteOrNull(raw: string): string | null {
  const t = raw.trim();
  return t.length > 0 ? t : null;
}

// キーボード(Enter/Space)で発火する行ヘッダー用ハンドラ。
function onActivateKey(handler: () => void) {
  return (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handler();
    }
  };
}

// トグルボタンの className。押下中は色付きで塗り、非押下は枠線のみ。
function toggleClass(active: boolean, tone: "green" | "gray"): string {
  const base = "rounded border px-2 py-0.5 text-xs";
  if (active) {
    return tone === "green"
      ? `${base} border-green-600 bg-green-600 text-white`
      : `${base} border-gray-600 bg-gray-600 text-white`;
  }
  return tone === "green"
    ? `${base} border-green-300 text-green-700 hover:bg-green-50`
    : `${base} border-gray-300 text-gray-600 hover:bg-gray-50`;
}

export function PunishTree({
  tree,
  guardType,
}: {
  tree: PunishTreeData;
  guardType: string;
}) {
  const navigate = useNavigate();
  const [expandedOpp, setExpandedOpp] = useState<Set<number>>(new Set());
  const [expandedStarter, setExpandedStarter] = useState<Set<string>>(new Set());
  const [expandedMaterialized, setExpandedMaterialized] = useState<Set<string>>(
    new Set(),
  );
  // 採否・pruning の理由(note)入力。始動技は starterKey、pruning は相手技 moveId をキーにする。
  const [starterNotes, setStarterNotes] = useState<Record<string, string>>({});
  const [pruneNotes, setPruneNotes] = useState<Record<number, string>>({});
  // ブラウザ内の一時非表示(DB 非保存・再読込/再走査でリセット)。永続 pruning とは別軸。
  const [hiddenStarters, setHiddenStarters] = useState<Set<string>>(new Set());
  const [hiddenCombos, setHiddenCombos] = useState<Set<number>>(new Set());

  const setVerdict = useSetStarterVerdict();
  const deleteVerdict = useDeleteStarterVerdict();
  const addPruning = useAddPruning();
  const addPunish = useAddPunish();
  const removePunish = useRemovePunish();
  const materialize = useMaterialize();

  const self = tree.selfCharacterId;
  const opp = tree.opponentCharacterId;
  // 戻り先(URL)。登録後・キャンセル時にこの位置へ復帰する(§4.5)。
  const returnUrl = `/punish/search?self=${self}&opp=${opp}&guard=${guardType}`;

  const goNewCombo = (
    context: {
      opponentLabel: string;
      starterLabel?: string;
    },
    registration?: { opponentMoveId: number },
  ) => {
    // 遷移先は既存の /combos/new(新 route を作らない)。キャラのみ文脈追従(CHANGE-039)。
    // 始動技はプリフィルしない(レシピ 1 手目から自動推定・ComboEditor 契約に触れない)。
    // punishContext は保存後のメッセージで「どの相手技/始動技向けか」を示すために渡す。
    navigate(`/combos/new?character=${self}`, {
      state: {
        punishReturn: returnUrl,
        punishContext: context,
        // 検索文脈から一意に決まる入力値は成立/手動レーンの両方で固定する。
        // opponentMoveId だけを手動レーンに限定し、自動採用の範囲は広げない。
        punishSelfCharacterId: self,
        hitType: PUNISH_HIT_TYPE_BY_GUARD[guardType],
        ...(registration
          ? {
              opponentMoveId: registration.opponentMoveId,
            }
          : {}),
      },
    });
  };

  const toggleOpp = (id: number) =>
    setExpandedOpp((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const toggleStarter = (key: string) =>
    setExpandedStarter((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const hideStarter = (key: string) =>
    setHiddenStarters((prev) => new Set(prev).add(key));
  const hideCombo = (id: number) =>
    setHiddenCombos((prev) => new Set(prev).add(id));
  const restoreAll = () => {
    setHiddenStarters(new Set());
    setHiddenCombos(new Set());
  };
  const hiddenCount = hiddenStarters.size + hiddenCombos.size;

  // 始動技の採否トグル。押下中の verdict を再クリックすると未検証へ戻す(解除)。
  const toggleVerdict = (
    om: OpponentMoveNode,
    st: StarterNode,
    key: string,
    verdict: string,
  ) => {
    if (st.verdict === verdict) {
      deleteVerdict.mutate({
        selfCharacterId: self,
        opponentMoveId: om.moveId,
        starterMoveId: st.moveId,
      });
      return;
    }
    const raw = starterNotes[key] ?? st.note ?? "";
    setVerdict.mutate({
      selfCharacterId: self,
      opponentMoveId: om.moveId,
      starterMoveId: st.moveId,
      verdict,
      note: noteOrNull(raw),
    });
  };

  // materialize(パニッシュカウンター版の生成)。FR301 既存一致時は生成されず既存へ導く
  // (エラー扱いにしない)。加算しなかった理由は文言で伝える(silent に 0 加算しない)。
  const doMaterialize = (comboId: number, opponentMoveId: number) => {
    materialize.mutate(
      { baseComboId: comboId, opponentMoveId },
      {
        onSuccess: (data) => {
          if (data.alreadyExisted) {
            toast.info("この確定反撃は既に登録されています", {
              description: "登録済みのパニッシュカウンター版を開けます",
              action: {
                label: "開く",
                onClick: () => navigate(`/combos/${data.comboId}`),
              },
            });
            return;
          }
          toast.success("パニッシュカウンター版を作成しました", {
            ...materializeResultToastBehavior(data.damageSkipReason),
            description: materializeDamageDescription(
              data.damageAdded,
              data.damageSkipReason,
            ),
            action: {
              label: "開く",
              onClick: () => navigate(`/combos/${data.comboId}`),
            },
          });
        },
        // ★★M31-01 レビュー(高-1): 理由を捨てない(PunishList と同じ 1 本を通す)。
        onError: (e) => toast.error(materializeErrorMessage(e)),
      },
    );
  };

  const renderStarter = (om: OpponentMoveNode, st: StarterNode) => {
    const key = starterKey(om.moveId, st);
    const expanded = expandedStarter.has(key);
    const visibleCombos = st.combos.filter((c) => !hiddenCombos.has(c.comboId));
    const activeCombos = visibleCombos.filter(
      (c) => !c.hasMaterializedVersion,
    );
    const materializedCombos = visibleCombos.filter(
      (c) => c.hasMaterializedVersion,
    );
    const materializedExpanded = expandedMaterialized.has(key);
    const toggleMaterialized = () =>
      setExpandedMaterialized((prev) => {
        const next = new Set(prev);
        next.has(key) ? next.delete(key) : next.add(key);
        return next;
      });
    const renderCombo = (
      combo: StarterNode["combos"][number],
      materialized: boolean,
    ) => (
      <li
        key={combo.comboId}
        className="ml-6 flex flex-wrap items-center gap-2 border-l border-gray-100 pl-3 py-0.5 text-sm"
      >
        <button
          type="button"
          onClick={() => navigate(`/combos/${combo.comboId}`)}
          className="text-blue-600 hover:underline"
        >
          コンボ #{combo.comboId}
        </button>
        {combo.damage != null && (
          <span className="text-xs text-gray-500">ダメージ {combo.damage}</span>
        )}
        <span className="text-xs text-gray-400">
          {combo.stepCount} ステップ
        </span>
        {combo.recipe != null && combo.recipe.length > 0 && (
          <span className="w-full break-words text-xs text-gray-600">
            {combo.recipe}
          </span>
        )}
        {materialized && (
          <span className="rounded bg-purple-100 px-1.5 py-0.5 text-xs text-purple-700">
            PC 版を作成済み
          </span>
        )}
        <button
          type="button"
          aria-pressed={combo.adopted}
          onClick={() =>
            combo.adopted
              ? removePunish.mutate({
                  comboId: combo.comboId,
                  opponentMoveId: om.moveId,
                })
              : addPunish.mutate(
                  { comboId: combo.comboId, opponentMoveId: om.moveId },
                  { onSuccess: () => toast.success("確定反撃に採用しました") },
                )
          }
          className={toggleClass(combo.adopted, "green")}
        >
          {combo.adopted ? "確定反撃に採用済み" : "確定反撃に採用"}
        </button>
        {!materialized &&
          !PUNISH_COUNTER_HIT_TYPES.has(combo.hitType ?? "") && (
            <button
              type="button"
              onClick={() => doMaterialize(combo.comboId, om.moveId)}
              disabled={materialize.isPending}
              className="rounded border border-purple-300 px-2 py-0.5 text-xs text-purple-700 hover:bg-purple-50 disabled:opacity-50"
            >
              パニッシュカウンター版を作る
            </button>
          )}
        <button
          type="button"
          aria-label="このコンボを一時非表示にする"
          title="この端末のみ・画面更新で戻ります"
          onClick={() => hideCombo(combo.comboId)}
          className="flex items-center gap-1 rounded border border-gray-200 px-1.5 py-0.5 text-xs text-gray-500 hover:bg-gray-50"
        >
          <EyeOff className="h-3.5 w-3.5" />
          一時非表示
        </button>
      </li>
    );
    // 注: 採否は現状 (自キャラ×相手技×始動技) 粒度でレーン非依存。同一始動技を別レーンで
    // 個別採否にする(lane 粒度)は本マイルストーンでは見送り(完了レポート参照)。
    return (
      <li key={key} className="ml-6 border-l border-gray-200 pl-3 py-1">
        <div className="flex flex-wrap items-center gap-2">
          {/* クリック領域: シェブロン + 技名 + レーン/発生/残り猶予。展開トグルはここ全体で反応。 */}
          <div
            role="button"
            tabIndex={0}
            aria-label={expanded ? "collapse" : "expand"}
            onClick={() => toggleStarter(key)}
            onKeyDown={onActivateKey(() => toggleStarter(key))}
            className="flex flex-wrap items-center gap-2 cursor-pointer"
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-500" />
            )}
            {/* ★M24-07(SM-133): 帰属ラベル。上の階層(相手の技)と読み分けられるようにする。 */}
            <PunishAttributionBadge side="own" />
            <span className="font-medium">{moveLabel(st.nameJa, st.code)}</span>
            <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-800">
              {PUNISH_LANE_LABELS[st.lane] ?? st.lane}
            </span>
            {st.startup != null && (
              <span className="text-xs text-gray-500">発生 {st.startup}F</span>
            )}
            {st.slack != null && (
              <span className="text-xs text-gray-500">残り猶予 {st.slack}F</span>
            )}
            {/* 展開前でも既存コンボ件数が分かるよう、行を増やさずインライン表示(1 件以上のみ)。 */}
            {st.combos.length > 0 && (
              <span className="rounded border border-indigo-400 bg-indigo-50 px-1.5 py-0.5 text-xs font-medium text-indigo-700">
                コンボ {st.combos.length}件
              </span>
            )}
          </div>
          {/* アクション: クリック領域の外に置き、展開トグルと干渉させない。 */}
          <button
            type="button"
            aria-pressed={st.verdict === PUNISH_VERDICT_ADOPTED}
            onClick={() => toggleVerdict(om, st, key, PUNISH_VERDICT_ADOPTED)}
            className={toggleClass(st.verdict === PUNISH_VERDICT_ADOPTED, "green")}
          >
            採用
          </button>
          <button
            type="button"
            aria-pressed={st.verdict === PUNISH_VERDICT_UNREACHABLE}
            onClick={() => toggleVerdict(om, st, key, PUNISH_VERDICT_UNREACHABLE)}
            className={toggleClass(st.verdict === PUNISH_VERDICT_UNREACHABLE, "gray")}
          >
            不採用
          </button>
          {/* 不採用の理由(任意)。空で送ると note はクリアされる。 */}
          <input
            type="text"
            aria-label="不採用理由(任意)"
            placeholder="不採用理由(任意)"
            value={starterNotes[key] ?? st.note ?? ""}
            onChange={(e) =>
              setStarterNotes((prev) => ({ ...prev, [key]: e.target.value }))
            }
            className="w-40 rounded border border-gray-300 px-1.5 py-0.5 text-xs"
          />
          {/* DB に残る pruning / curation と紛れないよう、アイコンだけでなく
              「一時非表示」の文字を添える(2026-07-26 開発者フィードバック 3)。 */}
          <button
            type="button"
            aria-label="この始動技を一時非表示にする"
            title="この端末のみ・画面更新で戻ります"
            onClick={() => hideStarter(key)}
            className="flex items-center gap-1 rounded border border-gray-200 px-1.5 py-0.5 text-xs text-gray-500 hover:bg-gray-50"
          >
            <EyeOff className="h-3.5 w-3.5" />
            一時非表示
          </button>
        </div>

        {expanded && (
          <ul className="mt-1">
            {activeCombos.map((combo) => renderCombo(combo, false))}
            {materializedCombos.length > 0 && (
              <li className="ml-6 border-l border-gray-100 pl-3 py-0.5">
                <button
                  type="button"
                  aria-expanded={materializedExpanded}
                  onClick={toggleMaterialized}
                  className="flex items-center gap-1 text-xs text-purple-700 hover:underline"
                >
                  {materializedExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                  変換済み ({materializedCombos.length} 件)
                </button>
                {materializedExpanded && (
                  <ul className="mt-1">
                    {materializedCombos.map((combo) =>
                      renderCombo(combo, true),
                    )}
                  </ul>
                )}
              </li>
            )}
            {/* 孫 0 件でも常時表示(未登録ケースがまさに主目的・§4.5)。 */}
            <li className="ml-6 border-l border-gray-100 pl-3 py-0.5">
              <button
                type="button"
                onClick={() =>
                  goNewCombo({
                    opponentLabel: moveLabel(om.nameJa, om.code),
                    starterLabel: moveLabel(st.nameJa, st.code),
                  })
                }
                className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
              >
                <Plus className="h-3.5 w-3.5" />
                このコンボを新規登録する
              </button>
            </li>
          </ul>
        )}
      </li>
    );
  };

  return (
    <div className="space-y-6">
      {/* 反撃候補(旧「成立レーン」) */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-700">反撃候補</h2>
        {/* 一時非表示がある時だけ再表示コントロールを出す(永続 pruning とは別軸)。 */}
        {hiddenCount > 0 && (
          <div className="mb-2 flex items-center gap-2 text-xs text-gray-500">
            <span>
              一時的に非表示: 始動技 {hiddenStarters.size} 件・コンボ{" "}
              {hiddenCombos.size} 件
            </span>
            <button
              type="button"
              onClick={restoreAll}
              className="rounded border border-gray-300 px-2 py-0.5 text-gray-600 hover:bg-gray-50"
            >
              すべて再表示
            </button>
          </div>
        )}
        {tree.nodes.length === 0 ? (
          <p className="text-sm text-gray-500">
            候補が見つかりませんでした。タブや相手キャラを変えてお試しください。
          </p>
        ) : (
          <ul className="space-y-1">
            {tree.nodes.map((om) => {
              const expanded = expandedOpp.has(om.moveId);
              const visibleStarters = om.starters.filter(
                (st) => !hiddenStarters.has(starterKey(om.moveId, st)),
              );
              return (
                <li key={om.moveId} className="rounded border border-gray-200 p-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* クリック領域: シェブロン + 技名 + 有利フレーム。 */}
                    <div
                      role="button"
                      tabIndex={0}
                      aria-label={expanded ? "collapse" : "expand"}
                      onClick={() => toggleOpp(om.moveId)}
                      onKeyDown={onActivateKey(() => toggleOpp(om.moveId))}
                      className="flex flex-wrap items-center gap-2 cursor-pointer"
                    >
                      {expanded ? (
                        <ChevronDown className="h-4 w-4 text-gray-500" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-gray-500" />
                      )}
                      {/* ★★M24-07(SM-133): 帰属ラベル。相手の技と自分の始動技が同じ形で
                          並んでおり、太さの差(font-semibold / font-medium)しか手掛かりが
                          無かった。★ラベルを足すだけ。並び・階層は変えない。 */}
                      <PunishAttributionBadge side="opponent" />
                      <span className="font-semibold">
                        {moveLabel(om.nameJa, om.code)}
                      </span>
                      <span className="text-xs text-gray-500">
                        有利 +{om.advantage}F
                      </span>
                    </div>
                    {/* 隠す理由(任意)。 */}
                    <input
                      type="text"
                      aria-label="隠す理由(任意)"
                      placeholder="隠す理由(任意)"
                      value={pruneNotes[om.moveId] ?? ""}
                      onChange={(e) =>
                        setPruneNotes((prev) => ({
                          ...prev,
                          [om.moveId]: e.target.value,
                        }))
                      }
                      className="ml-auto w-40 rounded border border-gray-300 px-1.5 py-0.5 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        addPruning.mutate(
                          {
                            selfCharacterId: self,
                            opponentMoveId: om.moveId,
                            note: noteOrNull(pruneNotes[om.moveId] ?? ""),
                          },
                          {
                            // 隠した先(戻し方)を必ず示す。ここを書かないと
                            // どこで復活できるか分からない(2026-07-26 開発者フィードバック 1)。
                            onSuccess: () =>
                              toast.success("確定反撃のない技として隠しました", {
                                description:
                                  "確定反撃マイリストの「隠したもの管理」から再表示できます",
                              }),
                          },
                        )
                      }
                      className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-50"
                    >
                      確定反撃のない技なので隠す
                    </button>
                  </div>
                  {expanded && (
                    <ul className="mt-1">
                      {visibleStarters.map((st) => renderStarter(om, st))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 自動判定できない相手技(旧「手動確認レーン」) */}
      {tree.manualReviewNodes.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-gray-700">
            自動判定できない相手技
          </h2>
          <ul className="space-y-1">
            {tree.manualReviewNodes.map((mn) => (
              <li
                key={mn.moveId}
                className="rounded border border-dashed border-gray-300 p-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span>{moveLabel(mn.nameJa, mn.code)}</span>
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                    {PUNISH_REASON_LABELS[mn.reasonCode] ?? mn.reasonCode}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      goNewCombo(
                        { opponentLabel: moveLabel(mn.nameJa, mn.code) },
                        { opponentMoveId: mn.moveId },
                      )
                    }
                    className="ml-auto rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-50"
                  >
                    手動で確定反撃を登録
                  </button>
                </div>
                {/* 既登録の確定反撃(§4.5)。フレーム判定の結果ではないことが分かるよう見出しを置き、
                    成立ツリーの候補とは混ぜない。この相手技は始動技→コンボのツリーが出ないため、
                    ここに出さないと登録済みでも画面に現れない(DES-005 §5.20 既知の限界2)。 */}
                {mn.registeredCombos.length > 0 && (
                  <div className="mt-2 border-t border-gray-200 pt-2">
                    <h3 className="text-xs font-semibold text-gray-600">
                      登録済みの確定反撃
                    </h3>
                    <ul className="mt-1">
                      {mn.registeredCombos.map((rc) => (
                        <li
                          key={rc.comboId}
                          className="ml-2 flex flex-wrap items-center gap-2 border-l border-gray-100 pl-3 py-0.5 text-sm"
                        >
                          <button
                            type="button"
                            onClick={() => navigate(`/combos/${rc.comboId}`)}
                            className="text-blue-600 hover:underline"
                          >
                            コンボ #{rc.comboId}
                          </button>
                          <span className="text-xs text-gray-500">
                            始動{" "}
                            {moveLabel(rc.starterMoveNameJa, rc.starterMoveCode ?? "-")}
                          </span>
                          {rc.damage != null && (
                            <span className="text-xs text-gray-500">
                              ダメージ {rc.damage}
                            </span>
                          )}
                          <span className="text-xs text-gray-400">
                            {rc.stepCount} ステップ
                          </span>
                          {rc.recipe != null && rc.recipe.length > 0 && (
                            <span className="w-full break-words text-xs text-gray-600">
                              {rc.recipe}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

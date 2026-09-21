import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";

import { HIT_TYPE_LABEL_KEYS } from "@/constants/combo-list";
import {
  materializeDamageDescription,
  materializeResultToastBehavior,
  MATERIALIZED_BADGE_LABEL,
  PUNISH_COUNTER_HIT_TYPES,
} from "@/constants/punish";
import { labelFor } from "@/features/combo/utils";

import { useAddCuration, useMaterialize, useRemovePunish } from "../api";
import type { PunishList as PunishListData, PunishListMoveNode } from "../types";
import { materializeErrorMessage } from "../materializeError";
import PunishAttributionBadge from "./PunishAttributionBadge";

function moveLabel(nameJa: string | undefined, code: string): string {
  return nameJa && nameJa.length > 0 ? nameJa : code;
}

// キーボード(Enter/Space)で発火する行ヘッダー用ハンドラ(PunishTree と同じ流儀)。
function onActivateKey(handler: () => void) {
  return (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handler();
    }
  };
}

function countCombos(nodes: PunishListMoveNode[]): number {
  return nodes.reduce((n, node) => n + node.combos.length, 0);
}

// ★★M31-01(P4M-014): 「区分を判定できない反撃」の内側を 2 つに割る。
//
// 開発者の逐語(phase4-memo.txt:41-48)＝
//   「以下のラベル名は微妙だが、2セクションに分ける。
//     ①反撃に転用可能なコンボの一覧（パニッシュカウンター、パニッシュカウンター
//       （ジャストパリィ）以外
//     ②再利用可能なコンボの一覧（パニッシュカウンター、パニッシュカウンター
//       （ジャストパリィ）だけ
//     ①はパニッシュカウンター版を作りつつ登録する。②はそのまま登録。
//     ①はすでにパニッシュカウンター版が作られているコンボはそのそも出さない。」
//
// ★★DES-005 §5.21 の骨格は一つも壊していない——両タブ共通・画面下部・折りたたみで
//   あることも、「3 つ目のタブにしない」ことも維持している。割ったのは中身だけである。
// ★★述語は既存の PUNISH_COUNTER_HIT_TYPES を使う。**新しい集合を書き起こさない**——
//   同じ問いに 2 つの答えが在ると、片方だけ直って静かにずれる。
//   ⇒ 変換ボタンの出し分けと同じ 1 本を見ている。
export type SectionKey = "tab" | "convertible" | "reusable" | "materialized";

interface UnclassifiedSplit {
  /** ①反撃に転用可能(PC 系でない ＋ PC 版が未生成)。 */
  convertible: PunishListMoveNode[];
  /** ②再利用可能(PC 系。現タブの区分ではないもの)。 */
  reusable: PunishListMoveNode[];
  /**
   * ①から外した「PC 版が既にある」コンボ。
   *
   * ★★件数だけを述べて**捨てない**。⇒ 捨てると、その行の「確定反撃の採用を解除」まで
   *   押せなくなる —— 本セクションは「そこにしか現れないコンボの解除手段を残す」ために
   *   在るのであり(下の renderCombos の注記)、除外は解除手段の剥奪を意味してはならない
   *   (M31-01 レビュー 中)。
   * ★変換導線は出さない(既に PC 版が在るため作る必要が無い)。
   */
  alreadyMaterialized: PunishListMoveNode[];
}

export function splitUnclassified(nodes: PunishListMoveNode[]): UnclassifiedSplit {
  const convertible: PunishListMoveNode[] = [];
  const reusable: PunishListMoveNode[] = [];
  const alreadyMaterialized: PunishListMoveNode[] = [];

  for (const node of nodes) {
    const conv: typeof node.combos = [];
    const reuse: typeof node.combos = [];
    const done: typeof node.combos = [];
    for (const combo of node.combos) {
      if (PUNISH_COUNTER_HIT_TYPES.has(combo.hitType ?? "")) {
        reuse.push(combo);
      } else if (combo.hasMaterializedVersion) {
        // ★黙って消さない。折りたたんだ別枠へ回す(M18 の「silent に消さない」思想／
        //   DES-005 §5.20 が同じ問いに「畳む ＋ バッジ」で答えた前例)。
        done.push(combo);
      } else {
        conv.push(combo);
      }
    }
    // ★同じ相手技が複数の枠に現れうる。⇒ 空でない側だけをそれぞれへ足す。
    if (conv.length > 0) convertible.push({ ...node, combos: conv });
    if (reuse.length > 0) reusable.push({ ...node, combos: reuse });
    if (done.length > 0) alreadyMaterialized.push({ ...node, combos: done });
  }
  return { convertible, reusable, alreadyMaterialized };
}

function noteOrNull(raw: string): string | null {
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// PunishList は確定反撃マイリスト(使う画面・画面21)の 2 階層ツリー。
//
// 第1階層＝相手技 / 第2階層＝コンボ。始動技はコンボ行の属性表示にとどめ階層を切らない
// (探す画面の 3 階層と意図的に非対称。使う場面では「どの相手技にどのコンボを出すか」だけが要る)。
export function PunishList({ list }: { list: PunishListData }) {
  const navigate = useNavigate();
  // 展開状態のキーはセクション接頭辞付き。同一 moveId が通常セクションと区分不明セクションの
  // 両方に現れる(同じ相手技に PC 系と normal のコンボが両方採用されている)場合に、
  // 片方を開くともう片方も連動して開くのを防ぐ。
  const [expandedMoves, setExpandedMoves] = useState<Set<string>>(new Set());
  const [expandedUnclassified, setExpandedUnclassified] = useState(false);
  const [curationNotes, setCurationNotes] = useState<Record<string, string>>({});

  const removePunish = useRemovePunish();
  const materialize = useMaterialize();
  const addCuration = useAddCuration();

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
        // ★★M31-01 レビュー(高-1): 理由を捨てない。materialize は VAL-C15 を通る
        //   ようになったため、400 は稀な異常系ではない(D-724 の実測＝既存の本登録
        //   83 件のうち 68 件が必須 4 欄のいずれか空)。
        //   ★★M38-01(射程 3 / 追補2): **当時の必須 4 欄に対する数である。**
        //     ⇒ `VAL-C15` は damage / knockdownAdvantage の **2 欄**になり、
        //       サーバが咎めるのもその 2 列だけである。⇒ 母数は減る方向。
        //     ★現在の件数は測っていない(実 DB が作業ツリーに無い)。
        onError: (e) => toast.error(materializeErrorMessage(e)),
      },
    );
  };

  const toggleMove = (key: string) =>
    setExpandedMoves((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const unclassifiedCount = countCombos(list.unclassifiedNodes);
  // ★★M31-01(P4M-014): 内側を ①反撃に転用可能 / ②再利用可能 へ割る。
  const split = splitUnclassified(list.unclassifiedNodes);

  // 採用解除は両セクションに出す。curation 登録は入力キューである区分不明セクションだけに置き、
  // PC 系のマイリスト本体には置かない(03a の開発者裁定を維持)。
  const renderCombos = (
    node: PunishListMoveNode,
    section: SectionKey,
  ) => (
    <ul className="mt-1">
      {node.combos.map((combo) => {
        const key = `${combo.comboId}:${node.moveId}`;
        const curationNote = curationNotes[key] ?? "";
        return (
          <li
            key={key}
            className="ml-6 flex flex-wrap items-center gap-2 border-l border-gray-100 pl-3 py-0.5 text-sm"
          >
            <button
              type="button"
              onClick={() => navigate(`/combos/${combo.comboId}`)}
              className="text-blue-600 hover:underline"
            >
              コンボ #{combo.comboId}
            </button>
            {/* 始動技は行の属性表示。階層を切らない。
                ★★M24-07 レビュー(中-6): 相手側だけがバッジで、自分側はプレーンテキスト
                  だった。⇒ 同じ形へ揃える(片側だけバッジだと「バッジ＝相手」という
                  第 2 の規則が生まれる)。 */}
            <PunishAttributionBadge side="own" />
            <span className="text-xs text-gray-500">
              {moveLabel(combo.starterMoveNameJa, combo.starterMoveCode ?? "-")}
            </span>
            {combo.damage != null && (
              <span className="text-xs text-gray-500">ダメージ {combo.damage}</span>
            )}
            <span className="text-xs text-gray-400">{combo.stepCount} ステップ</span>
            {/* レシピ(既定プリセット)。始動技だけでは内容が分からないため添える。
                ★★M24-07 レビュー(中-6)の取り込みで testid を足した —— 帰属ラベルを
                  バッジへ揃えた結果、始動技名が単独の span になり、1 手コンボでは
                  レシピ文字列と**完全一致で衝突する**ようになった(e2e が strict mode
                  違反で赤くなって判明)。★spec 側のセレクタを緩めるのではなく、
                  「これがレシピの span である」ことを実装側で名乗る。 */}
            {combo.recipe != null && combo.recipe.length > 0 && (
              <span
                data-testid="punish-mylist-recipe"
                className="w-full break-words text-xs text-gray-600"
              >
                {combo.recipe}
              </span>
            )}
            {/* hit_type バッジ。4 値のリテラルは定義せず既存ラベル定義を参照する。 */}
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">
              {labelFor(HIT_TYPE_LABEL_KEYS, combo.hitType)}
            </span>
            {/* 生成元バッジ(§4.8-2)。materialize 生成物(出自あり)であることを示す。
                内部値(materializedFromComboId)と表示ラベルを分離(L-7)。 */}
            {combo.materializedFromComboId != null && (
              <span className="rounded bg-purple-100 px-1.5 py-0.5 text-xs text-purple-700">
                {MATERIALIZED_BADGE_LABEL}
              </span>
            )}
            {combo.note != null && combo.note.length > 0 && (
              <span className="text-xs text-gray-500">メモ: {combo.note}</span>
            )}
            {/* 変換ボタンは「区分を判定できない反撃」セクションにのみ出す(§4.8)。
                当該セクションのコンボは定義上 punish_counter 系ではないが、念のため §4.1 で二重に弾く。 */}
            {section === "convertible" &&
              !PUNISH_COUNTER_HIT_TYPES.has(combo.hitType ?? "") && (
                <>
                  <button
                    type="button"
                    onClick={() => doMaterialize(combo.comboId, node.moveId)}
                    disabled={materialize.isPending}
                    className="rounded border border-purple-300 px-2 py-0.5 text-xs text-purple-700 hover:bg-purple-50 disabled:opacity-50"
                  >
                    パニッシュカウンター版を作る
                  </button>
                  <input
                    type="text"
                    aria-label="隠す理由(任意)"
                    placeholder="隠す理由(任意)"
                    value={curationNote}
                    onChange={(e) =>
                      setCurationNotes((prev) => ({
                        ...prev,
                        [key]: e.target.value,
                      }))
                    }
                    className="w-40 rounded border border-gray-300 px-1.5 py-0.5 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      addCuration.mutate(
                        {
                          comboId: combo.comboId,
                          opponentMoveId: node.moveId,
                          note: noteOrNull(curationNote),
                        },
                        {
                          onSuccess: () => {
                            setCurationNotes((prev) => {
                              const next = { ...prev };
                              delete next[key];
                              return next;
                            });
                            toast.success("使わない反撃として隠しました", {
                              description:
                                "「隠したもの管理」の「使わない反撃」から再表示できます",
                            });
                          },
                          onError: (e) =>
                            toast.error(`非表示に失敗しました: ${e.message}`),
                        },
                      )
                    }
                    disabled={addCuration.isPending}
                    className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                  >
                    使わない
                  </button>
                </>
              )}
            {/* 探す画面の「確定反撃に採用済み(解除)」と同じ結果。同じ DELETE を使う。
                区分不明セクションにも出す(そこにしか現れないコンボの解除手段を残すため)。 */}
            <button
              type="button"
              onClick={() =>
                removePunish.mutate(
                  { comboId: combo.comboId, opponentMoveId: node.moveId },
                  {
                    onSuccess: () =>
                      toast.success("確定反撃の採用を解除しました"),
                    onError: (e) =>
                      toast.error(`解除に失敗しました: ${e.message}`),
                  },
                )
              }
              className="ml-auto rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-50"
            >
              確定反撃の採用を解除
            </button>
          </li>
        );
      })}
    </ul>
  );

  const renderMoveNode = (
    node: PunishListMoveNode,
    section: SectionKey,
  ) => {
    // section は展開状態のキー接頭辞として使う(同一 moveId の連動展開を防ぐ)。
    const key = `${section}:${node.moveId}`;
    const expanded = expandedMoves.has(key);
    return (
      <li key={key} className="rounded border border-gray-200 p-2">
        {/* クリック領域は行ヘッダー全体(DES-005 §5.4・M18-02 と同じ形)。 */}
        <div
          role="button"
          tabIndex={0}
          aria-label={expanded ? "collapse" : "expand"}
          onClick={() => toggleMove(key)}
          onKeyDown={onActivateKey(() => toggleMove(key))}
          className="flex flex-wrap items-center gap-2 cursor-pointer"
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-500" />
          )}
          {/* ★★M24-07(SM-133): 帰属ラベル。この階層は相手の技である。 */}
          <PunishAttributionBadge side="opponent" />
          <span className="font-semibold">{moveLabel(node.nameJa, node.code)}</span>
          <span className="text-xs text-gray-500">
            {node.opponentCharacterNameJa}
          </span>
          <span className="rounded border border-indigo-400 bg-indigo-50 px-1.5 py-0.5 text-xs font-medium text-indigo-700">
            コンボ {node.combos.length}件
          </span>
        </div>
        {expanded && renderCombos(node, section)}
      </li>
    );
  };

  return (
    <div className="space-y-6">
      <section>
        {list.nodes.length > 0 ? (
          <ul className="space-y-1">
            {list.nodes.map((node) => renderMoveNode(node, "tab"))}
          </ul>
        ) : unclassifiedCount > 0 ? (
          // 採用自体はあるが全て区分不明のとき。「まだ登録されていません」は事実と食い違うため
          // タブ内が空であることだけを述べ、案内は下の区分不明セクションに任せる。
          <p className="text-sm text-gray-500">
            このタブに該当する確定反撃はありません。
          </p>
        ) : (
          <div className="rounded border border-dashed border-gray-300 p-4 text-sm text-gray-600">
            <p>まだ確定反撃が登録されていません。</p>
            <p className="mt-1">
              <Link to="/punish/search" className="text-blue-600 hover:underline">
                確定反撃サーチ
              </Link>
              で採用するとここに出ます。
            </p>
          </div>
        )}
      </section>

      {/* 区分を判定できない反撃。
          hit_type がガード/ジャストパリィのどちらでもない(通常・カウンター・未設定)採用は
          タブと同じ軸に並ばないため、3 つ目のタブにはせず両タブ共通で画面下部に置く
          (開発者確定 2026-07-26)。件数だけでなく展開して中身が見えるようにする。 */}
      {unclassifiedCount > 0 && (
        <section className="rounded border border-amber-300 bg-amber-50 p-3">
          <div
            role="button"
            tabIndex={0}
            aria-label={expandedUnclassified ? "collapse" : "expand"}
            onClick={() => setExpandedUnclassified((v) => !v)}
            onKeyDown={onActivateKey(() => setExpandedUnclassified((v) => !v))}
            className="flex flex-wrap items-center gap-2 cursor-pointer"
          >
            {expandedUnclassified ? (
              <ChevronDown className="h-4 w-4 text-amber-700" />
            ) : (
              <ChevronRight className="h-4 w-4 text-amber-700" />
            )}
            <h2 className="text-sm font-semibold text-amber-900">
              区分を判定できない反撃({unclassifiedCount} 件)
            </h2>
          </div>
          {expandedUnclassified && (
            <>
              <p className="mt-2 text-xs text-amber-900">
                これらのコンボはガード始動／ジャストパリィ始動のどちらか判定できない記録です。
                扱いが 2 通りに分かれるため、下で分けています。
              </p>

              {/* ★★① 反撃に転用可能なコンボ＝パニッシュカウンター系でないもの。
                  逐語＝「①はパニッシュカウンター版を作りつつ登録する」。 */}
              {split.convertible.length > 0 && (
                <div className="mt-3" data-testid="punish-unclassified-convertible">
                  <h3 className="text-xs font-semibold text-amber-900">
                    ① 反撃に転用可能なコンボ({countCombos(split.convertible)} 件)
                  </h3>
                  <p className="mt-1 text-xs text-amber-900">
                    <span className="font-medium">「パニッシュカウンター版を作る」</span>
                    で変換すると、別コンボとして生成され、上の一覧に出ます
                    (生成後は元コンボと独立し、基底の変更には追従しません)。
                  </p>
                  <ul className="mt-2 space-y-1">
                    {split.convertible.map((node) =>
                      renderMoveNode(node, "convertible"),
                    )}
                  </ul>
                </div>
              )}

              {/* ★★① から外した「PC 版が既にある」ぶんは、件数だけ述べる。
                  ★★黙って消さない——M18 の「silent に消さない」思想であり、
                    §5.20 が同じ問いに「畳む ＋ バッジ」で答えた前例に揃えてある。
                  ★通常は materialize が基底の採用を外すため 0 件である。 */}
              {split.alreadyMaterialized.length > 0 && (
                <div
                  className="mt-2"
                  data-testid="punish-unclassified-already-materialized"
                >
                  <p className="text-xs text-amber-800">
                    ※ パニッシュカウンター版が既にあるコンボ{" "}
                    {countCombos(split.alreadyMaterialized)} 件は ① に出していません。
                    採用を解除したい場合はこちらから操作できます。
                  </p>
                  <ul className="mt-1 space-y-1">
                    {split.alreadyMaterialized.map((node) =>
                      renderMoveNode(node, "materialized"),
                    )}
                  </ul>
                </div>
              )}

              {/* ★★② 再利用可能なコンボ＝パニッシュカウンター系だが現タブの区分ではないもの。
                  逐語＝「②はそのまま登録」。⇒ 変換導線は出さない(既に PC である)。
                  ★★drive_impact_punish_counter がここへ来る。
                    **どのタブへ置くかは本サブの射程ではない**——別サブの担当である
                    (CHANGE-151 §6-1 / followup punish-list-di-punish-counter-tab-placement)。 */}
              {split.reusable.length > 0 && (
                <div className="mt-3" data-testid="punish-unclassified-reusable">
                  <h3 className="text-xs font-semibold text-amber-900">
                    ② 再利用可能なコンボ({countCombos(split.reusable)} 件)
                  </h3>
                  <p className="mt-1 text-xs text-amber-900">
                    すでにパニッシュカウンター系のため、変換せずそのまま使えます。
                  </p>
                  <ul className="mt-2 space-y-1">
                    {split.reusable.map((node) => renderMoveNode(node, "reusable"))}
                  </ul>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}

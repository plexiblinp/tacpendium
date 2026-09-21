import { useMemo } from "react";

import {
  MOVE_CATEGORY_LABEL_JA,
  MOVE_CATEGORY_ORDER,
} from "@/features/moves/types";
import type { PresetAliasDetail } from "../types";

// ★カテゴリのラベルと表示順は技セレクタと共有する(moves/types.ts)。
// 独自定義を持つと、同じカテゴリが画面ごとに別名・別順序で出る
// (CLAUDE.md §4「マジックストリングは定数化」／.claude/rules/enum-sync.md 規則 2)。
// 新しいカテゴリが増えたとき片方だけ更新される形にもなる。

function categoryRank(category: string): number {
  const i = MOVE_CATEGORY_ORDER.indexOf(category);
  return i === -1 ? MOVE_CATEGORY_ORDER.length : i;
}

export interface AliasGroup {
  category: string;
  label: string;
  items: PresetAliasDetail[];
}

/**
 * groupByCategory はエイリアスをカテゴリ単位にまとめる。
 *
 * ★キャラ別のグループ化は画面側(キャラ選択)が担う。DES-005 §5.11 は
 * 「技ごと、キャラ別にグループ化」と定めており、キャラを選んでから
 * その中をカテゴリで束ねる形にした(1 キャラで最大 77 行あり、
 * カテゴリで束ねないと目的の技に辿り着けない)。
 */
export function groupByCategory(details: PresetAliasDetail[]): AliasGroup[] {
  const byCategory = new Map<string, PresetAliasDetail[]>();
  for (const d of details) {
    const list = byCategory.get(d.moveCategory);
    if (list) list.push(d);
    else byCategory.set(d.moveCategory, [d]);
  }
  return [...byCategory.entries()]
    .sort((a, b) => categoryRank(a[0]) - categoryRank(b[0]))
    .map(([category, items]) => ({
      category,
      label: MOVE_CATEGORY_LABEL_JA[category] ?? category,
      items,
    }));
}

interface Props {
  details: PresetAliasDetail[];
  /** moveId → 編集中の値。未編集の move はキーを持たない。 */
  edits: Record<number, string>;
  onChange: (moveId: number, value: string) => void;
  readOnly?: boolean;
}

/**
 * PresetAliasEditor はエイリアス編集の表(DES-005 §5.11)。
 *
 * ★編集できるのは alias_text だけである。
 * - aliasTextEn の編集欄は作らない(生成規則が入れる列であり、編集しても
 *   次の seed 波の再適用で消える。DES-004 §5.4 / 指示書 §1.3・§4.6-4)
 * - 技の追加・削除は行わない(DES-004 §6.2)
 * - 連結子・ベースプリセット名・フォールバック挙動も編集対象外(同)
 */
export default function PresetAliasEditor({
  details,
  edits,
  onChange,
  readOnly = false,
}: Props) {
  const groups = useMemo(() => groupByCategory(details), [details]);

  if (details.length === 0) {
    return (
      <p className="text-sm text-slate-500" data-testid="alias-editor-empty">
        このキャラクターのエイリアスはありません。
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <section key={g.category} data-testid={`alias-group-${g.category}`}>
          <h3 className="mb-2 text-sm font-bold text-slate-700">{g.label}</h3>
          <div className="overflow-x-auto rounded border border-slate-200 bg-white">
            <table className="w-full min-w-[32rem] text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">技</th>
                  <th className="px-3 py-2 font-medium">このプリセットでの表記</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {g.items.map((d) => {
                  const value = edits[d.moveId] ?? d.aliasText;
                  const dirty = edits[d.moveId] !== undefined && edits[d.moveId] !== d.aliasText;
                  return (
                    <tr key={d.moveId} data-testid={`alias-row-${d.moveId}`}>
                      <td className="px-3 py-2 align-top">
                        <div className="text-slate-800">
                          {d.officialAliasText ?? d.moveCode}
                        </div>
                        <div className="text-xs text-slate-400">{d.moveCode}</div>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={value}
                          readOnly={readOnly}
                          disabled={readOnly}
                          onChange={(e) => onChange(d.moveId, e.target.value)}
                          aria-label={`${d.officialAliasText ?? d.moveCode} の表記`}
                          data-testid={`alias-input-${d.moveId}`}
                          className={[
                            "w-full rounded border px-2 py-1 text-sm",
                            dirty ? "border-blue-400 bg-blue-50" : "border-slate-300",
                            readOnly ? "bg-slate-100 text-slate-500" : "",
                          ].join(" ")}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}

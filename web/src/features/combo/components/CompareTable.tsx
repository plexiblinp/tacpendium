import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  POSITION_LABEL_KEYS,
  OPPONENT_STANCE_LABEL_KEYS,
  HIT_TYPE_LABEL_KEYS,
} from "@/constants/combo-list";
import { TAG_CATEGORY_MYCOMBO_STATUS } from "@/constants/mycombo";
import {
  OKI_OPTION_SPECS,
  okiOptionKey,
  okiOptionLabel,
} from "@/constants/oki";
import { useCharacters } from "@/features/character/hooks/useCharacters";
import type { ComboDetail, OkiOption } from "../types";
import { useRecipeFullView } from "../hooks/useRecipeFullView";
import RecipeText from "./RecipeText";
import {
  formatStarterStatus,
  formatDamage,
  formatKnockdownAdvantage,
  formatSAGauge,
  formatDriveGauge,
  labelFor,
  getSetupDisplayName,
} from "../utils";
import {
  customStateValueText,
  parseCustomStateDefs,
  resolveCustomStatesForDisplay,
  toCustomStateLocale,
} from "../customStates";

interface CompareTableProps {
  combos: (ComboDetail | undefined)[];
  errors: (Error | null)[];
  loadings: boolean[];
  ids: number[];
  onRemove: (id: number) => void;
}


// DES-005 §5.8: 12 変種を個別行で表示し、詳細と同一表示方式に揃える。
function OkiYesNo({ value }: { value: boolean | undefined | null }) {
  if (value === undefined || value === null) return <span>-</span>;
  return value ? (
    <span className="text-emerald-600 font-medium">✓</span>
  ) : (
    <span className="text-slate-400">✗</span>
  );
}

// hasOkiOption はコンボの起き攻めオプション列に指定の変種が含まれるか(sparse: 含まれる=成立する)。
// ★M27-02b: 「調べたか」はコンボ単位の okiVerified が持つ。ここはセルの成否だけを見る。
function hasOkiOption(
  okiOptions: OkiOption[] | undefined,
  spec: { attackType: string; techType: string; usesDr: boolean },
): boolean {
  if (!okiOptions) return false;
  const key = okiOptionKey(spec);
  return okiOptions.some((o) => okiOptionKey(o) === key);
}

export default function CompareTable({
  combos,
  errors,
  loadings,
  ids,
  onRemove,
}: CompareTableProps) {
  const { t, i18n } = useTranslation();
  // キャラ固有状態(custom_states)の名称解決用。各コンボの characterId 定義を引く(M11-01)。
  // ★M24-03 §4.2(SM-061): キャラ名もこの同じ取得経路から引く(新しい経路を増やさない)。
  const { data: characters } = useCharacters();
  // M24-03 §4.1: 比較の既定は「末尾省略＋ホバー」のまま(開発者裁定 案A)。
  const { fullView } = useRecipeFullView(false);

  // M24-03 §4.2(SM-061): 比較表にキャラ名を出す。
  // ★値は name_ja。DES-005 §4.3 の並び順と同じ語彙であり、第 2 の語彙を作らない。
  const characterNameOf = (combo: ComboDetail): string =>
    characters?.find((c) => c.id === combo.characterId)?.nameJa ?? "";

  const labelCellClass =
    "sticky left-0 z-[1] bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 whitespace-nowrap border-r border-slate-200";
  const dataCellClass = "px-3 py-2 text-sm text-slate-800 align-top";
  const headerCellClass =
    "px-3 py-2 text-sm font-semibold text-center border-b border-slate-200";

  const renderSituationTags = (combo: ComboDetail) => {
    const tags: string[] = [];
    if (combo.position) {
      tags.push(labelFor(POSITION_LABEL_KEYS, combo.position, t));
    }
    if (combo.opponentStance) {
      tags.push(labelFor(OPPONENT_STANCE_LABEL_KEYS, combo.opponentStance, t));
    }
    if (combo.hitType) {
      tags.push(labelFor(HIT_TYPE_LABEL_KEYS, combo.hitType, t));
    }
    if (tags.length === 0) return "-";
    return (
      <div className="flex flex-wrap gap-1">
        {tags.map((tag, i) => (
          <span
            key={i}
            className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-xs"
          >
            {tag}
          </span>
        ))}
      </div>
    );
  };

  const renderCustomStates = (combo: ComboDetail) => {
    const defs = parseCustomStateDefs(
      characters?.find((c) => c.id === combo.characterId)?.customStates,
    );
    // M16-07: 比較は i18n サーフェス。int state ラベルは locale に応じ ja/en(M16-06 境界)。
    const resolved = resolveCustomStatesForDisplay(
      combo.situation,
      defs,
      toCustomStateLocale(i18n.language),
    );
    if (resolved.length === 0) return "-";
    return (
      <div className="flex flex-wrap gap-1">
        {resolved.map((s) => (
          <span
            key={`${s.code}-${s.kind}`}
            className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-xs"
          >
            {typeof s.value === "number"
              ? `${s.label}: ${customStateValueText(s)}`
              : s.label}
          </span>
        ))}
      </div>
    );
  };

  const renderSetups = (combo: ComboDetail) => {
    if (!combo.setups || combo.setups.length === 0) return "-";
    return (
      <ul className="space-y-0.5">
        {combo.setups.map((setup) => (
          <li key={setup.id} className="text-xs">
            {getSetupDisplayName(setup.name, setup.defaultRecipe, false)}
          </li>
        ))}
      </ul>
    );
  };

  const renderTags = (combo: ComboDetail) => {
    const filteredTags = combo.tags.filter(
      (tag) => tag.category !== TAG_CATEGORY_MYCOMBO_STATUS,
    );
    if (filteredTags.length === 0) return "-";
    return (
      <div className="flex flex-wrap gap-1">
        {filteredTags.map((tag) => (
          <span
            key={tag.id}
            className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-xs"
          >
            {tag.name}
          </span>
        ))}
      </div>
    );
  };

  const renderCell = (
    index: number,
    renderFn: (combo: ComboDetail) => React.ReactNode,
  ) => {
    if (errors[index]) {
      return (
        <TableCell key={ids[index]} className={`${dataCellClass} text-red-500`}>
          {t("compare.fetchErrorPartial")}
        </TableCell>
      );
    }
    if (loadings[index]) {
      return (
        <TableCell key={ids[index]} className={dataCellClass}>
          <div className="h-4 bg-slate-200 rounded animate-pulse" />
        </TableCell>
      );
    }
    const combo = combos[index];
    if (!combo) {
      return (
        <TableCell key={ids[index]} className={dataCellClass}>
          -
        </TableCell>
      );
    }
    return (
      <TableCell key={ids[index]} className={dataCellClass}>
        {renderFn(combo)}
      </TableCell>
    );
  };

  type RowDef = {
    labelKey: string;
    // label が指定された行はそれを直接表示(起き攻めオプションは constants/oki のラベルを使う・M16-03)。
    // 未指定なら t(labelKey) で i18n 解決する。
    label?: string;
    render: (combo: ComboDetail) => React.ReactNode;
  };

  const rows: RowDef[] = [
    {
      labelKey: "compare.row.starterSituation",
      render: (c) => formatStarterStatus(c, t),
    },
    {
      labelKey: "compare.row.route",
      // M24-03 §4.1(SM-021 / SM-014): コンボ側の面に共通の見せ方へ寄せる。
      // 全文表示モードのときはツールチップを出さない(同じ情報が 2 か所に出る)。
      render: (c) => (
        <RecipeText
          recipe={c.defaultRecipe}
          fullView={fullView}
          compactClassName="max-w-xs"
        />
      ),
    },
    {
      labelKey: "compare.row.damage",
      render: (c) => (
        <span className="tabular-nums">{formatDamage(c.damage)}</span>
      ),
    },
    // M16-02 追補(A-1/CHANGE-060 §7-1): ゲージの始動残量・消費を 4 行そろえて比較軸に掲載。
    // 始動 2 行は既存フィールドの表示追加(スキーマ変更なし)、消費 2 行は M16-02 追加列。
    // ラベルで始動/消費を判別可能にする(friend FB #11)。
    {
      labelKey: "compare.row.driveAvailableAtStart",
      render: (c) => (
        <span className="tabular-nums">
          {formatDriveGauge(c.driveAvailableAtStart)}
        </span>
      ),
    },
    {
      labelKey: "compare.row.saAvailableAtStart",
      render: (c) => (
        <span className="tabular-nums">
          {formatSAGauge(c.saAvailableAtStart)}
        </span>
      ),
    },
    {
      labelKey: "compare.row.driveGaugeConsumed",
      render: (c) => (
        <span className="tabular-nums">
          {formatDriveGauge(c.driveGaugeConsumed)}
        </span>
      ),
    },
    {
      labelKey: "compare.row.saGaugeConsumed",
      render: (c) => (
        <span className="tabular-nums">{formatSAGauge(c.saGaugeConsumed)}</span>
      ),
    },
    {
      labelKey: "compare.row.situation",
      render: (c) => renderSituationTags(c),
    },
    {
      labelKey: "compare.row.customStates",
      render: (c) => renderCustomStates(c),
    },
    {
      labelKey: "compare.row.knockdownAdvantage",
      render: (c) => (
        <span className="tabular-nums">
          {formatKnockdownAdvantage(c.knockdownAdvantage)}
        </span>
      ),
    },
    // 起き攻めオプション(M16-03 正規化)。12 変種を個別行で表示し、シミーのドライブラッシュ区分・
    // 打撃重ねも行として並ぶ(DES-005 §5.8 の非対称を解消)。sparse: 含まれる=✓、無い=✗。
    ...OKI_OPTION_SPECS.map(
      (spec): RowDef => ({
        labelKey: okiOptionKey(spec),
        label: okiOptionLabel(spec, t),
        render: (c) => <OkiYesNo value={hasOkiOption(c.okiOptions, spec)} />,
      }),
    ),
    {
      labelKey: "compare.row.setups",
      render: (c) => renderSetups(c),
    },
    {
      labelKey: "compare.row.tags",
      render: (c) => renderTags(c),
    },
    {
      labelKey: "compare.row.memo",
      render: (c) => c.memo || "-",
    },
    // メディア 3 行(M17-01)。比較表はテキスト表示のみ(リンク化は詳細画面の責務・CHANGE-068 §2.3-j)。
    {
      labelKey: "compare.row.link",
      render: (c) => (
        <span className="max-w-xs block truncate" title={c.link}>
          {c.link || "-"}
        </span>
      ),
    },
    {
      labelKey: "compare.row.videoPath",
      render: (c) => (
        <span className="max-w-xs block truncate" title={c.videoPath}>
          {c.videoPath || "-"}
        </span>
      ),
    },
    {
      labelKey: "compare.row.imagePath",
      render: (c) => (
        <span className="max-w-xs block truncate" title={c.imagePath}>
          {c.imagePath || "-"}
        </span>
      ),
    },
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50">
            <TableHead className={`${labelCellClass} border-b border-slate-200`} />
            {ids.map((id, index) => (
              <TableHead key={id} className={headerCellClass}>
                <div className="flex items-center justify-center gap-2">
                  <span>{t("compare.comboHeader", { id })}</span>
                  <button
                    type="button"
                    onClick={() => onRemove(id)}
                    className="text-slate-400 hover:text-red-500 text-xs"
                    aria-label={t("compare.removeCombo")}
                    title={t("compare.removeCombo")}
                  >
                    ✕
                  </button>
                </div>
                {loadings[index] ? (
                  <div className="h-3 w-20 mx-auto bg-slate-200 rounded animate-pulse mt-1" />
                ) : (
                  !errors[index] &&
                  combos[index] && (
                    <>
                      {/* M24-03 §4.2(SM-061): 複数キャラを並べたときにどの列がどのキャラか
                          分かるようにする。値は name_ja(DES-005 §4.3 と同じ語彙)。
                          ★キャラ一覧の取得前は空文字になる。そのときは要素を出さない
                            (空の行が一瞬出る＝M24-03 レビュー 低-4)。 */}
                      {characterNameOf(combos[index]!) !== "" && (
                        <div
                          className="text-xs font-semibold text-slate-700 mt-1"
                          data-testid="compare-character-name"
                        >
                          {characterNameOf(combos[index]!)}
                        </div>
                      )}
                      <div className="text-xs text-slate-400 font-normal mt-0.5">
                        {formatStarterStatus(combos[index], t)}
                      </div>
                      {/* ★★M24-03 §4.2(SM-003): 比較中コンボの詳細へ行く導線。
                          ★取り違えられない位置に置く(M23-07 の教訓)。分離は 4 点——
                            位置(✕ は右上・本リンクはセル最下段で 2 行離れる) ／
                            文言(「詳細を開く」対 aria-label「比較から外す」) ／
                            色(青リンク対 灰・ホバーで赤) ／
                            形(テキストリンク対 アイコンボタン)。
                          ★★右上の ✕ は「削除」ではない。比較リストから外すだけで
                            データは消えない(aria-label = t("compare.removeCombo")
                            = 「比較から外す」)。M23-07 が守ろうとした「取り違えると
                            利用者のデータが消える」型そのものではないが、位置の分離は
                            そのまま守っている。 */}
                      <div className="mt-2 text-left">
                        <Link
                          to={`/combos/${id}`}
                          className="text-xs font-normal text-blue-600 hover:underline"
                          data-testid="compare-open-detail"
                        >
                          {t("compare.openDetail")} →
                        </Link>
                      </div>
                    </>
                  )
                )}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, rowIndex) => (
            <TableRow
              key={row.labelKey}
              className={rowIndex % 2 === 0 ? "" : "bg-slate-50/50"}
            >
              <TableCell className={labelCellClass}>
                {row.label ?? t(row.labelKey)}
              </TableCell>
              {ids.map((_, colIndex) => renderCell(colIndex, row.render))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

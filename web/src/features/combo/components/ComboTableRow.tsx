import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight } from "lucide-react";

import { TableCell, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  COLUMN_TEST_IDS,
  HIT_TYPE_LABEL_KEYS,
  OPPONENT_STANCE_LABEL_KEYS,
  POSITION_LABEL_KEYS,
  type ColumnVisibility,
} from "@/constants/combo-list";
import {
  TAG_CATEGORY_MYCOMBO_STATUS,
  MYCOMBO_STATUS_VALUES,
  MYCOMBO_STATUS_TAG_NAMES,
} from "@/constants/mycombo";
import MyComboStatusSelect from "@/features/mycombo/components/MyComboStatusSelect";
import { TagBadgeList } from "@/features/tag/components/TagBadgeList";
import type { ComboSummary } from "../types";
import { useRecipeFullView } from "../hooks/useRecipeFullView";
import RecipeText, { MemoFirstLine } from "./RecipeText";
import { formatDamage, formatMemo, labelFor } from "../utils";

interface ComboTableRowProps {
  combo: ComboSummary;
  expanded: boolean;
  canExpand?: boolean;
  onToggleExpand: (id: number) => void;
  /**
   * 削除の通知。★渡さない面では［削除］そのものを描かない。
   *
   * ★★no-op を渡して「押しても何も起きないボタン」を残さないこと ——
   *   本サブが「取得失敗を 0 件にしない」「ボタンだけ黙って消さない」で避けてきた
   *   『黙って何も起きない』の実物になる(M28-02c レビュー 高-1)。
   */
  onDelete?: (id: number) => void;
  visibility: ColumnVisibility;
  onStatusChange?: (comboId: number, combo: ComboSummary, newStatus: string) => void;
  statusChanging?: boolean;
  isSelectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: number) => void;
  selectionDisabled?: boolean;
  /** ★専用画面のときだけ 3 列を足す(M28-02c)。列設定の共有物には触れない。 */
  /**
   * ［コピー］を描くか(既定 true)。
   *
   * ★★影響コンボの専用画面では出さない —— コピーで生まれるのは新しい行であり、
   *   その基準は登録時の現在版で埋まる(insertComboSQL の COALESCE)。⇒ コピーは
   *   「影響なし」として生まれ、元の行は影響ありのまま残る。
   *   **この画面の目的(変わった技を確認して直す)に対して意味を持たない操作である。**
   * ★既定を true にしてあるのは、既存の呼び手 4 面の挙動を 1 ミリも変えないためである。
   */
  showCopy?: boolean;
  showGameUpdateColumns?: boolean;
  onAcknowledge?: (comboId: number) => void;
  acknowledging?: boolean;
  acknowledgeFailed?: boolean;
}

export default function ComboTableRow({
  combo,
  expanded,
  canExpand = true,
  onToggleExpand,
  onDelete,
  visibility,
  onStatusChange,
  statusChanging,
  isSelectMode,
  selected,
  onToggleSelect,
  selectionDisabled,
  showCopy = true,
  showGameUpdateColumns,
  onAcknowledge,
  acknowledging,
  acknowledgeFailed,
}: ComboTableRowProps) {
  const { t } = useTranslation();
  // M24-03 §4.1: レシピの見せ方はコンボ側の面に共通の 1 つの規則を通る。
  //
  // ★★軸は「1 行にまとめる / ステップごとに改行」である(CHANGE-147・M24-07 で
  //   「省略 / 全文」から移した)。一覧の既定は OFF ＝ 1 行にまとめる側であり、
  //   幅(max-w-xs)で切られて末尾が省略され、全文は title(ホバー)へ入る。
  //   ★旧コメントは「末尾省略＋ホバー」とだけ書いており、撤回された軸の語だった。
  // ★★M31-03: ルート列が詳細へのリンクになったため、ホバー(= title)の隣に
  //   「クリック/タップ = 詳細へ遷移」が並ぶ。DES-005 §5.4 の「ルートのホバー/タップ
  //   → 全文表示」とは食い違っており、CHANGE を請求済みである。
  const { fullView } = useRecipeFullView(false);

  return (
    <TableRow>
      {isSelectMode && (
        <TableCell className="align-middle">
          <Checkbox
            checked={!!selected}
            disabled={!!selectionDisabled}
            onCheckedChange={() => onToggleSelect?.(combo.id)}
            aria-label={`コンボ #${combo.id} を選択`}
          />
        </TableCell>
      )}
      <TableCell className="align-middle text-slate-500">
        {canExpand ? (
          <button
            type="button"
            onClick={() => onToggleExpand(combo.id)}
            className="p-1 hover:bg-slate-200 rounded"
            aria-label={expanded ? "collapse" : "expand"}
          >
            {expanded ? (
              <ChevronDown size={16} />
            ) : (
              <ChevronRight size={16} />
            )}
          </button>
        ) : (
          <span className="inline-block w-[24px]" />
        )}
      </TableCell>
      {/* ★★M31-03(開発者確定 2026-09-09・案C): 列の並びは
            ルート / ダメージ / ヒット種別 / 始動位置 / 相手の状態 /
            タグ / 登録状態 / 備考 / セットプレイ数
          ★★並びの正本は 3 か所に分かれている —— 本ファイルのセル ／ ComboTable の
            見出し ／ constants の COLUMN_DEFINITIONS(表示列メニューの並び)。
            ⇒ 1 つだけ直すとずれるが、tsc もテストも検出しない。
            ★ComboTable.test.tsx の「3 か所の並びが一致する」検査が固定している。

          ★★M27-03 追補(2026-09-05 開発者指示): 状況は「始動状況」1 列ではなく
            3 列(ヒット種別 / 始動位置 / 相手の状態)である。
          ★★始動技を出さない点は変わらない(P4M-020)。starter_move_id のデータ・
            API 応答・絞り込み・ソートにも引き続き触れていない。
          ★★本部品を共有するのは **3 面** である —— コンボ一覧 / マイコンボ /
            影響コンボの専用画面(§5.19b・M28-02c で増えた)。
            ★旧記述「2 面」は M28-02c 以降 失効していた(M31-03 の段 1-2 実査で是正)。
            数えるのは「共通部品を使っている面」である
            (M24-03「面の数え上げは共通部品を使っている面で行う」)。 */}
      {visibility.recipe && (
        // M24-03 §4.4(SM-089): メモの 1 行目をレシピの上に薄く出す。
        // ★メモが空なら MemoFirstLine 自身が null を返す(空の行を作らない)。
        <TableCell
          className="text-slate-600 align-top"
          data-testid={COLUMN_TEST_IDS.recipe}
        >
          {/* ★★M31-03(開発者確定 2026-09-09): 詳細への行内リンクは**この列**が持つ。
                ★開発者の逐語＝「元々は始動状況に詳細へ飛ぶリンクが張られていましたが、
                  今はヒット種別にリンクが張られていて不自然」。
                ★置き場の正本は DETAIL_LINK_COLUMN(constants/combo-list.ts)である。

              ★★包むのは RecipeText だけである。MemoFirstLine を入れないこと ——
                同部品は role="note" を持つ**メモ由来の別情報**であり、リンクの中へ
                入れると支援技術がレシピの一部として読み上げる(M24-03 §4.4 の読み分けが
                崩れる)。

              ★★リンクは 1 列だけである。操作列の「詳細」は従来どおり残る。 */}
          <MemoFirstLine memo={combo.memo} className="max-w-xs" />
          <Link
            to={`/combos/${combo.id}`}
            className="text-blue-600 hover:underline"
          >
            <RecipeText
              recipe={combo.defaultRecipe}
              fullView={fullView}
              compactClassName="max-w-xs"
            />
          </Link>
        </TableCell>
      )}
      {visibility.damage && (
        <TableCell className="tabular-nums">
          {formatDamage(combo.damage)}
        </TableCell>
      )}
      {visibility.hitType && (
        // ★★M31-03(開発者確定 2026-09-09): 詳細への行内リンクはこの列に無い。
        //   置き場の正本は DETAIL_LINK_COLUMN(= ルート列)である。
        //
        // ★★testid を combo-starter-situation から改名した —— 「始動状況」という列は
        //   M27-03 で 3 列へ割れて**存在しない**。失効した名を残さない
        //   (旧名は「先頭セルがリンクを持っていた」時代の名残そのものであった)。
        <TableCell data-testid={COLUMN_TEST_IDS.hitType}>
          {labelFor(HIT_TYPE_LABEL_KEYS, combo.hitType, t)}
        </TableCell>
      )}
      {visibility.position && (
        <TableCell data-testid={COLUMN_TEST_IDS.position}>
          {labelFor(POSITION_LABEL_KEYS, combo.position, t)}
        </TableCell>
      )}
      {visibility.opponentStance && (
        // ★★独立列なので「不問」も「-」も出す。
        //   着手前は「不問・未設定は非表示」(淡色小)だったが、**列見出しが在る以上、
        //   空欄は「値が無い」のか「未取得」なのか区別できない**
        //   (セットプレイ数の「0 件も 0 と出す」と同じ作法)。
        <TableCell data-testid={COLUMN_TEST_IDS.opponentStance}>
          {labelFor(OPPONENT_STANCE_LABEL_KEYS, combo.opponentStance, t)}
        </TableCell>
      )}
      {visibility.tags && (
        <TableCell>
          <TagBadgeList
            tags={combo.tags}
            excludeCategories={[TAG_CATEGORY_MYCOMBO_STATUS]}
            maxVisible={3}
          />
        </TableCell>
      )}
      {visibility.draftStatus && (
        <TableCell>
          {combo.isDraft ? (
            <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-xs">
              {t("comboList.draftBadge")}
            </span>
          ) : (
            <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-xs">
              {t("comboList.officialBadge")}
            </span>
          )}
        </TableCell>
      )}
      {visibility.memo && (
        <TableCell
          className="text-slate-600 max-w-xs truncate"
          title={combo.memo ?? ""}
        >
          {formatMemo(combo.memo)}
        </TableCell>
      )}
      {visibility.setupCount && (
        // M24-01 §4.5(SM-012): 紐づくセットプレイの件数。
        // ★0 件も 0 と出す——空欄にすると「未取得」と区別できない。
        <TableCell
          className="text-right tabular-nums"
          data-testid={COLUMN_TEST_IDS.setupCount}
        >
          {combo.setups?.length ?? 0}
        </TableCell>
      )}
      {showGameUpdateColumns && (
        <>
          {/* 変わった技。★nameJa が引けないときは code へ落とす
              (先例 = formatStarterStatus。サーバは両方返し、落とすのは画面側である)。 */}
          <TableCell className="text-slate-700" data-testid="combo-affected-moves">
            {combo.affectedMoves.length > 0
              ? combo.affectedMoves
                  .map((m) => m.nameJa?.trim() || m.code)
                  .join(" / ")
              : "-"}
          </TableCell>
          {/* 前提バージョン。★無いときは「不明」と出す ——「-」にすると
              「不明だから出ている」という因果が画面から消える(DES-005 §5.6)。 */}
          <TableCell
            className="whitespace-nowrap tabular-nums text-slate-600"
            data-testid="combo-baseline-version"
          >
            {combo.baselineVersion ?? t("gameUpdate.baselineUnknown")}
          </TableCell>
          <TableCell className="whitespace-nowrap">
            {onAcknowledge && (
              <button
                type="button"
                onClick={() => onAcknowledge(combo.id)}
                disabled={!!acknowledging}
                title={t("gameUpdate.acknowledgeHint")}
                className="text-blue-600 hover:underline disabled:text-slate-400 disabled:no-underline"
                data-testid="combo-acknowledge"
              >
                {t("gameUpdate.acknowledge")}
              </button>
            )}
            {/* ★失敗を黙って消さない。押したのに何も起きていないことを画面へ出す。 */}
            {acknowledgeFailed && (
              <span
                className="ml-2 text-xs text-red-600"
                data-testid="combo-acknowledge-error"
              >
                {t("gameUpdate.acknowledgeError")}
              </span>
            )}
          </TableCell>
        </>
      )}
      {onStatusChange && (
        <TableCell>
          <MyComboStatusCell
            combo={combo}
            onStatusChange={onStatusChange}
            disabled={!!statusChanging}
          />
        </TableCell>
      )}
      <TableCell className="whitespace-nowrap">
        <Link
          to={`/combos/${combo.id}`}
          className="text-blue-600 hover:underline mr-3"
        >
          {t("common.detail")}
        </Link>
        <Link
          to={`/combos/${combo.id}/edit`}
          // ★M28-02c / CHANGE-162 §7: 専用画面から編集へ入ったら、保存後は専用画面へ戻す。
          //   ★出発点を location.state で渡すだけである(既存の punishReturn と同じ仕組み)。
          //   ⇒ 履歴の形は 1 枚も変えていない。
          //   ★副次的な利点 —— PUT は 201 Created で id が変わるが、専用画面へ戻す形なら
          //     id の差し替えが要らない。
          state={
            showGameUpdateColumns
              ? { returnTo: "/game-update/combos" }
              : undefined
          }
          className="text-slate-600 hover:underline mr-3"
        >
          {t("common.edit")}
        </Link>
        {showCopy && (
          <Link
            to={`/combos/new?copyFrom=${combo.id}`}
            className="text-slate-600 hover:underline mr-3"
          >
            {t("common.copy")}
          </Link>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={() => onDelete(combo.id)}
            className="text-red-600 hover:underline"
          >
            {t("common.delete")}
          </button>
        )}
      </TableCell>
    </TableRow>
  );
}

function MyComboStatusCell({
  combo,
  onStatusChange,
  disabled,
}: {
  combo: ComboSummary;
  onStatusChange: (comboId: number, combo: ComboSummary, newStatus: string) => void;
  disabled: boolean;
}) {
  const currentStatusTag = combo.tags.find(
    (t) => t.category === TAG_CATEGORY_MYCOMBO_STATUS,
  );

  const currentValue = currentStatusTag
    ? MYCOMBO_STATUS_VALUES.find(
        (s) => MYCOMBO_STATUS_TAG_NAMES[s] === currentStatusTag.name,
      ) ?? ""
    : "";

  return (
    <MyComboStatusSelect
      currentStatus={currentValue}
      onChange={(newStatus) => onStatusChange(combo.id, combo, newStatus)}
      disabled={disabled}
    />
  );
}

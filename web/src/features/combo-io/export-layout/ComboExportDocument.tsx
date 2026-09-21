// 出力専用レイアウト(PDF/PNG のラスタ化対象 DOM)。
// 画面6 詳細(§5.6)/画面8 比較表(§5.8)を「出力用に整形」した別建てコンポーネント。
// 既存の表示コンポーネントは変更せず(§2.3)、値整形は export-model(= 既存 utils 再利用)に委譲する。
//
// 出力対象数で切替: 1 件 → 詳細レイアウト、2 件以上 → 比較表レイアウト。
// スタイルはインライン指定(html-to-image が計算済みスタイルを必要とするため)。日本語は DOM のフォント解決に委ねる。
//
// M17-05c / M17-05c-fix(CHANGE-073):
//  - PDF は用紙寸法固定(単独=A4 縦・比較=A4 横相当)。`page` 指定時は比較表を A4 横幅(1122.5px)へ
//    table-layout:fixed で 4 列等幅にし、指定列(columnStart..End)のみ描画・thead 再掲・ページ番号/範囲ラベル。
//    行分割は廃止(超過は render 側の縮小フィットが吸収)＝`page` に行指定はない。
//  - `page` 未指定時は従来どおり全件を内容幅で描画(PNG 経路=1 枚)。
//  - 比較表の総題「コンボ比較」は削除(縦スペース確保)。
//  - 縮小フィットが下限 70% を下回るときは `overflowNote` を立て、末尾に固定 ja の注記を出す(切らない)。
//  出力文書内のラベル・見出し・ページ番号・注記は固定 ja(i18n キーを足さない＝M16-06 境界)。

import type { Character } from "@/features/character/hooks/useCharacters";
import type { ComboDetail } from "@/features/combo/types";
import type { ExportItemKey } from "../export-items";
import {
  buildComboFields,
  buildComboHeader,
  type ExportFieldRow,
} from "../export-model";

/** PDF ページ分割時に、このページの列(コンボ)範囲・ページ番号・縮小注記フラグを指定する。 */
export interface ExportPageRender {
  /** 1 始まりの通しページ番号。 */
  pageNumber: number;
  /** 総ページ数。 */
  pageCount: number;
  /** 比較表のみ: 載せる列(コンボ)の開始インデックス [含む]。 */
  columnStart?: number;
  /** 比較表のみ: 載せる列(コンボ)の終了インデックス [含まない]。 */
  columnEnd?: number;
  /** 縮小フィットが下限 70% を下回り、縮小せず原寸出力した場合に立てる(注記を出す)。 */
  overflowNote?: boolean;
}

interface ComboExportDocumentProps {
  combos: ComboDetail[];
  characters: Character[] | undefined;
  selected: ReadonlySet<ExportItemKey>;
  /** 指定時は該当ページ(列範囲)のみ描画し用紙固定の体裁にする(PDF)。未指定 = 全件 1 枚(PNG)。 */
  page?: ExportPageRender;
}

const FONT_FAMILY =
  '"Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic", Meiryo, -apple-system, "Segoe UI", sans-serif';

// 比較表を A4 横幅へ固定する CSS px(A4 横の長辺 297mm @96dpi ≒ 1122.5px)。paginate.COMPARISON_PAGE_PT と対。
const COMPARISON_PAGE_WIDTH_CSS = 1122.5;
// 比較表(固定幅)の項目名列の幅(CSS px)。残りを対象コンボ列で等分する。
const LABEL_COL_WIDTH_CSS = 150;
const ROOT_PADDING_CSS = 24;

const ROOT_STYLE: React.CSSProperties = {
  boxSizing: "border-box",
  background: "#ffffff",
  color: "#1b1f24",
  fontFamily: FONT_FAMILY,
  fontSize: "14px",
  lineHeight: 1.5,
  padding: `${ROOT_PADDING_CSS}px`,
};

const LABEL_CELL: React.CSSProperties = {
  background: "#f5f7f9",
  color: "#5b6470",
  fontSize: "12px",
  fontWeight: 600,
  textAlign: "left",
  verticalAlign: "top",
  padding: "6px 10px",
  border: "1px solid #e3e6ea",
  // M17-05c-fix(是正): 項目名は固定幅列(比較 A4=150px/単独 32%)で折り返す。旧 white-space:nowrap は
  // 長いラベル(「コンボ開始時のドライブゲージ残量」「投げ重ね(その場・ドライブラッシュ)」等)が枠外へ
  // はみ出す原因だった。折り返しで増える行高は縮小フィットが吸収する(実測で A4 縦相当に収まる)。
  overflowWrap: "anywhere",
};

const VALUE_CELL: React.CSSProperties = {
  fontSize: "14px",
  verticalAlign: "top",
  padding: "6px 10px",
  border: "1px solid #e3e6ea",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};

const HEADER_CELL: React.CSSProperties = {
  background: "#eef3fb",
  color: "#1b3a6b",
  fontSize: "13px",
  fontWeight: 700,
  textAlign: "center",
  verticalAlign: "top",
  padding: "8px 10px",
  border: "1px solid #d3deef",
};

const FOOTER_STYLE: React.CSSProperties = {
  marginTop: "12px",
  fontSize: "12px",
  color: "#5b6470",
  textAlign: "right",
};

const OVERFLOW_NOTE_STYLE: React.CSSProperties = {
  marginTop: "10px",
  fontSize: "12px",
  color: "#8a5b00",
  background: "#fff7e6",
  border: "1px solid #f0d9a8",
  borderRadius: "4px",
  padding: "6px 10px",
};

// 縮小フィット下限(70%)を下回り、縮小せず原寸で出したときの注記(固定 ja)。
// TODO(文言確定・開発者): 現状は仮文言。実出力確認後に確定する(指示書 §6-1)。
const OVERFLOW_NOTE_TEXT =
  "※ 一部が用紙に収まりきらないため、縮小せず原寸で出力しました。";

function PageFooter({
  page,
  rangeLabel,
}: {
  page: ExportPageRender;
  rangeLabel?: string;
}) {
  return (
    <div style={FOOTER_STYLE} data-field="page-footer">
      {rangeLabel ? `${rangeLabel}　` : ""}
      {page.pageNumber} / {page.pageCount}
    </div>
  );
}

function OverflowNote() {
  return (
    <div style={OVERFLOW_NOTE_STYLE} data-field="overflow-note">
      {OVERFLOW_NOTE_TEXT}
    </div>
  );
}

function SingleLayout({
  combo,
  characters,
  selected,
  page,
}: {
  combo: ComboDetail;
  characters: Character[] | undefined;
  selected: ReadonlySet<ExportItemKey>;
  page?: ExportPageRender;
}) {
  const header = buildComboHeader(combo, characters);
  const fields = buildComboFields(combo, characters, selected);
  return (
    <div style={{ ...ROOT_STYLE, width: "720px" }} data-export-mode="single">
      <div
        style={{
          borderBottom: "2px solid #e3e6ea",
          paddingBottom: "10px",
          marginBottom: "14px",
        }}
      >
        <div style={{ fontSize: "20px", fontWeight: 700 }} data-field="title">
          {header.title}
        </div>
        <div
          style={{ fontSize: "13px", color: "#5b6470", marginTop: "2px" }}
          data-field="subtitle"
        >
          {header.subtitle}
        </div>
      </div>
      <table
        style={{ borderCollapse: "collapse", width: "100%" }}
        data-field="fields"
      >
        <tbody>
          {fields.map((row) => (
            <tr key={row.key} data-row={row.key}>
              <th style={{ ...LABEL_CELL, width: "32%" }} scope="row">
                {row.label}
              </th>
              <td style={VALUE_CELL}>{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* 単独は常に 1 ページ。ページ番号は不要。縮小注記のみ出しうる。 */}
      {page?.overflowNote ? <OverflowNote /> : null}
    </div>
  );
}

function ComparisonLayout({
  combos,
  characters,
  selected,
  page,
}: {
  combos: ComboDetail[];
  characters: Character[] | undefined;
  selected: ReadonlySet<ExportItemKey>;
  page?: ExportPageRender;
}) {
  const isPaged = page !== undefined;
  // 列(コンボ)の部分集合。page 指定時は [columnStart, columnEnd) に絞る(項目名列は別途常に描画)。
  const colStart = page?.columnStart ?? 0;
  const colEnd = page?.columnEnd ?? combos.length;
  const visibleCombos = combos.slice(colStart, colEnd);

  const headers = visibleCombos.map((c) => buildComboHeader(c, characters));
  // 値は元の列インデックス(colStart + j)で引くため、全コンボ分を構築しておく。
  const fieldsPerCombo: ExportFieldRow[][] = combos.map((c) =>
    buildComboFields(c, characters, selected),
  );
  // 選択は決定的なため、全コンボで行キー・順序は一致する。先頭コンボを行の基準にする(全行を出す)。
  const baseRows = fieldsPerCombo[0] ?? [];

  // page 指定(PDF)= A4 横幅固定＋等幅。未指定(PNG 1 枚)= 従来の内容幅。
  const width = isPaged
    ? COMPARISON_PAGE_WIDTH_CSS
    : Math.max(720, 160 + combos.length * 360);
  const comboColWidth =
    isPaged && visibleCombos.length > 0
      ? (COMPARISON_PAGE_WIDTH_CSS - ROOT_PADDING_CSS * 2 - LABEL_COL_WIDTH_CSS) /
        visibleCombos.length
      : undefined;
  const labelColStyle: React.CSSProperties = isPaged
    ? { ...LABEL_CELL, width: `${LABEL_COL_WIDTH_CSS}px` }
    : LABEL_CELL;
  const comboColStyle = (base: React.CSSProperties): React.CSSProperties =>
    comboColWidth !== undefined ? { ...base, width: `${comboColWidth}px` } : base;
  const rangeLabel = isPaged
    ? `コンボ ${colStart + 1}–${colEnd} / 全 ${combos.length}`
    : undefined;

  return (
    <div
      style={{ ...ROOT_STYLE, width: `${width}px` }}
      data-export-mode="comparison"
    >
      {/* 総題「コンボ比較」は削除(CHANGE-073 §2.2-i・縦スペース確保)。コンボ列見出しは残す。 */}
      <table
        style={{
          borderCollapse: "collapse",
          width: "100%",
          tableLayout: isPaged ? "fixed" : "auto",
        }}
      >
        <thead>
          <tr>
            <th style={labelColStyle} />
            {headers.map((h, i) => (
              <th key={visibleCombos[i].id} style={comboColStyle(HEADER_CELL)}>
                <div>{h.title}</div>
                <div
                  style={{ fontSize: "11px", fontWeight: 400, color: "#5b6470" }}
                >
                  {h.subtitle}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {baseRows.map((row, rowIndex) => (
            <tr key={row.key} data-row={row.key}>
              <th style={labelColStyle} scope="row">
                {row.label}
              </th>
              {visibleCombos.map((c, j) => (
                <td key={c.id} style={comboColStyle(VALUE_CELL)}>
                  {fieldsPerCombo[colStart + j][rowIndex]?.value ?? "-"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {isPaged ? <PageFooter page={page} rangeLabel={rangeLabel} /> : null}
      {page?.overflowNote ? <OverflowNote /> : null}
    </div>
  );
}

// 単独 = 詳細レイアウト、複数 = 比較表レイアウト(出力対象数で切替)。
export default function ComboExportDocument({
  combos,
  characters,
  selected,
  page,
}: ComboExportDocumentProps) {
  if (combos.length === 0) {
    return (
      <div style={ROOT_STYLE} data-export-mode="empty">
        出力対象がありません
      </div>
    );
  }
  if (combos.length === 1) {
    return (
      <SingleLayout
        combo={combos[0]}
        characters={characters}
        selected={selected}
        page={page}
      />
    );
  }
  return (
    <ComparisonLayout
      combos={combos}
      characters={characters}
      selected={selected}
      page={page}
    />
  );
}

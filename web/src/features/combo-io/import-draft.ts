// 取込プレビューの「仮登録を取込対象から外す」判定(SM-071 / M24-06 §4.1)。
//
// ★除外は FE でのみ行う(確認事項 1 の決着 = D-591)。BE は is_draft の行を弾かない
// (internal/service/comboio/import.go は仮登録を VAL-C02 の対象外として常に新規作成へ進める)。
// したがって API を直に叩けば仮登録は入る。これは不変条件ではなく「うっかり混ざるのを防ぐ」
// ための形である(M24-06 §4.1.1)。
//
// ★判定を 1 か所に閉じ込める理由: 既定チェックの初期化・全選択/全解除・送信対象の算出の
// 3 か所が同じ条件を見ており、条件を散らすと 1 か所だけ漏れて「除外したつもりの行が送られる」
// 形の欠陥になる。純粋関数テストで条件漏れを固定する。

/** 判定に必要な最小の構造(テストから完全な ComboPreviewRow を組み立てずに済ませる)。 */
export interface DraftFilterableRow {
  isDraft: boolean;
  importable: boolean;
}

/** その行が「仮登録のため取込対象から外れる」か。 */
export function isDraftExcluded(row: DraftFilterableRow): boolean {
  return row.isDraft === true;
}

/**
 * その行を取込対象として選べるか。
 * ★既存の importable(検証エラー等で取り込めない)と、本サブで足した仮登録の除外の積である。
 */
export function isImportSelectable(row: DraftFilterableRow): boolean {
  return row.importable && !isDraftExcluded(row);
}

/** 仮登録のため除外した行数(画面に出す件数。黙って減らさないための材料)。 */
export function countExcludedDrafts(rows: readonly DraftFilterableRow[]): number {
  let n = 0;
  for (const row of rows) if (isDraftExcluded(row)) n += 1;
  return n;
}

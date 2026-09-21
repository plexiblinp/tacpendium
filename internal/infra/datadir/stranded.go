package datadir

import (
	"fmt"
	"path/filepath"
)

// StrandedCheck は「新旧の両方が在る」ときに、どちらに実データが在るかを数えた結果。
type StrandedCheck struct {
	OldRows int64
	NewRows int64
	// Stranded は「いま開く新が空で、旧にデータが在る」＝データが見えなくなっている状態。
	Stranded bool
}

// countAllRows は DB 内の全ユーザーテーブルの行数の合計を返す。
//
// ★アプリ標準の db.Open は使わない。journal_mode(WAL) を当てるため、
// 「見るだけ」のつもりが対象ファイルのヘッダを書き換えることになる。
func countAllRows(dbPath string) (int64, error) {
	conn, err := openSource(dbPath)
	if err != nil {
		return 0, err
	}
	defer func() { _ = conn.Close() }()

	tables, err := userTables(conn)
	if err != nil {
		return 0, err
	}
	counts, err := countTables(conn, tables)
	if err != nil {
		return 0, err
	}
	var total int64
	for _, c := range counts {
		// schema_migrations は golang-migrate の版であって利用者のデータではない。
		// これを数に入れると「空の新 DB」が常に 1 行以上を持つことになり、判定が効かない。
		if c.Table == "schema_migrations" {
			continue
		}
		total += c.Rows
	}
	return total, nil
}

// CheckStranded は「新旧の両方が在る」状態の中身を数えて、良性か危険かを分ける。
//
// ★★経路 b は 3 通りの状況を 1 つにまとめている ————————————————————————
// Decide は os.Stat のサイズしか見ないため、次を区別できない。
//
//  1. 移行は成功したが退避に失敗した（Windows のファイルロック等）—— 新は検証済み。良性
//  2. 確定と退避の間で落ちた —— 新は検証済み。良性
//  3. ★移行が走る前に新の場所へ空の DB が作られた —— **新が空で、実データは旧にある**
//
// 3 は「アプリを開くと空で、コンボは全部旧に取り残されている」状態であり、
// 気づかせ続ける価値がある。1・2 は旧がただの控えなので、消すのは開発者の手番であり
// 毎起動で催促する価値はない。⇒ 行数で分ける。
//
// ★数えられなかった場合は Stranded = false を返す（黙って赤くしない）。
func CheckStranded(oldDBPath, newDBPath string) (StrandedCheck, error) {
	newRows, err := countAllRows(newDBPath)
	if err != nil {
		return StrandedCheck{}, fmt.Errorf("datadir: 移行先の行数を数えられませんでした: %w", err)
	}
	oldRows, err := countAllRows(oldDBPath)
	if err != nil {
		return StrandedCheck{}, fmt.Errorf("datadir: 移行元の行数を数えられませんでした: %w", err)
	}
	return StrandedCheck{
		OldRows:  oldRows,
		NewRows:  newRows,
		Stranded: newRows == 0 && oldRows > 0,
	}, nil
}

// strandedMessage は危険形の利用者向け文面を組み立てる。
func strandedMessage(oldDir string, c StrandedCheck) string {
	return fmt.Sprintf(
		"いま開いているデータは空です。以前のデータ(%d 件)は %s に残っています。"+
			"移されないままなので、必要なら %s を確認してください",
		c.OldRows, oldDir, filepath.Clean(oldDir))
}

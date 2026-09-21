package datadir

import (
	"database/sql"
	"fmt"
	"sort"
	"strings"
)

// TableCount は 1 テーブルの行数。完了報告と利用者向けメッセージの材料になる。
type TableCount struct {
	Table string `json:"table"`
	Rows  int64  `json:"rows"`
}

// MismatchError は検証で食い違いを見つけたことを表す。型で返すのは、テストが
// 「本当に行数の比較が効いているか」を確かめられるようにするためである。
type MismatchError struct {
	Table string
	Old   int64
	New   int64
}

func (e *MismatchError) Error() string {
	return fmt.Sprintf("datadir: テーブル %s の行数が一致しません(移行元 %d 行 / 移行先 %d 行)", e.Table, e.Old, e.New)
}

// MissingTableError は移行先にテーブルが欠けていることを表す。
//
// ★行数だけを比べると見逃す ————————————————————————————————————————
// 「残ったテーブルの行数はすべて一致するが 1 つ丸ごと消えている」は、
// 行数の比較だけでは検出できない。⇒ テーブル名の集合そのものを突き合わせる。
type MissingTableError struct {
	Missing []string
	Extra   []string
}

func (e *MissingTableError) Error() string {
	var b strings.Builder
	b.WriteString("datadir: テーブル構成が一致しません")
	if len(e.Missing) > 0 {
		fmt.Fprintf(&b, "(移行先に欠落: %s)", strings.Join(e.Missing, ", "))
	}
	if len(e.Extra) > 0 {
		fmt.Fprintf(&b, "(移行先に余分: %s)", strings.Join(e.Extra, ", "))
	}
	return b.String()
}

// userTables は sqlite_master からユーザーテーブル名を昇順で返す。
//
// ★sqlite_ 接頭辞は除く。sqlite_sequence / sqlite_stat1 は ANALYZE や AUTOINCREMENT の
// 有無で片側にだけ現れうる内部テーブルであり、突合の対象にすると偽陽性になる。
// ★schema_migrations は除かない。golang-migrate の版を持つ通常のテーブルであり、
// 失われると次回起動でマイグレーションが全部やり直しになる。
func userTables(conn *sql.DB) ([]string, error) {
	rows, err := conn.Query(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`)
	if err != nil {
		return nil, fmt.Errorf("datadir: list tables: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var names []string
	for rows.Next() {
		var n string
		if scanErr := rows.Scan(&n); scanErr != nil {
			return nil, fmt.Errorf("datadir: scan table name: %w", scanErr)
		}
		names = append(names, n)
	}
	if rowsErr := rows.Err(); rowsErr != nil {
		return nil, fmt.Errorf("datadir: list tables: %w", rowsErr)
	}
	sort.Strings(names)
	return names, nil
}

// countTables は与えたテーブルの行数を数える。
func countTables(conn *sql.DB, tables []string) ([]TableCount, error) {
	counts := make([]TableCount, 0, len(tables))
	for _, t := range tables {
		var n int64
		// テーブル名は sqlite_master 由来であり利用者入力ではないが、
		// 念のため識別子を二重引用符でくくってエスケープする。
		q := fmt.Sprintf(`SELECT count(*) FROM %q`, t)
		if err := conn.QueryRow(q).Scan(&n); err != nil {
			return nil, fmt.Errorf("datadir: count %q: %w", t, err)
		}
		counts = append(counts, TableCount{Table: t, Rows: n})
	}
	return counts, nil
}

// integrityCheck は PRAGMA integrity_check を回し、"ok" 以外が返ったらエラーにする。
//
// ★integrity_check は「状態」ではなく「行」を返す。問題があれば複数行返る。
// Exec で捨てると、壊れた DB を「検証を通った」と誤認する。
func integrityCheck(conn *sql.DB) error {
	rows, err := conn.Query(`PRAGMA integrity_check`)
	if err != nil {
		return fmt.Errorf("datadir: integrity_check: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var messages []string
	for rows.Next() {
		var m string
		if scanErr := rows.Scan(&m); scanErr != nil {
			return fmt.Errorf("datadir: integrity_check scan: %w", scanErr)
		}
		messages = append(messages, m)
	}
	if rowsErr := rows.Err(); rowsErr != nil {
		return fmt.Errorf("datadir: integrity_check: %w", rowsErr)
	}
	if len(messages) != 1 || messages[0] != "ok" {
		return fmt.Errorf("datadir: integrity_check が ok を返しませんでした: %s", strings.Join(messages, "; "))
	}
	return nil
}

// Verify は移行元と移行先の中身が一致することを確かめる。
//
// 見るのは 3 つ。(1) テーブル名の集合 (2) 各テーブルの行数 (3) user_version。
// どれか 1 つでも食い違えば型つきのエラーを返す。
func Verify(oldConn, newConn *sql.DB, oldCounts []TableCount) error {
	newTables, err := userTables(newConn)
	if err != nil {
		return err
	}

	oldNames := make([]string, 0, len(oldCounts))
	oldByName := make(map[string]int64, len(oldCounts))
	for _, c := range oldCounts {
		oldNames = append(oldNames, c.Table)
		oldByName[c.Table] = c.Rows
	}
	sort.Strings(oldNames)

	if missing, extra := diffNames(oldNames, newTables); len(missing) > 0 || len(extra) > 0 {
		return &MissingTableError{Missing: missing, Extra: extra}
	}

	newCounts, err := countTables(newConn, newTables)
	if err != nil {
		return err
	}
	for _, c := range newCounts {
		if want := oldByName[c.Table]; want != c.Rows {
			return &MismatchError{Table: c.Table, Old: want, New: c.Rows}
		}
	}

	var oldUV, newUV int64
	if err := oldConn.QueryRow(`PRAGMA user_version`).Scan(&oldUV); err != nil {
		return fmt.Errorf("datadir: user_version(移行元): %w", err)
	}
	if err := newConn.QueryRow(`PRAGMA user_version`).Scan(&newUV); err != nil {
		return fmt.Errorf("datadir: user_version(移行先): %w", err)
	}
	if oldUV != newUV {
		return fmt.Errorf("datadir: user_version が一致しません(移行元 %d / 移行先 %d)", oldUV, newUV)
	}
	return nil
}

// diffNames は want に在って got に無いもの / got に在って want に無いものを返す。
func diffNames(want, got []string) (missing, extra []string) {
	inGot := make(map[string]bool, len(got))
	for _, g := range got {
		inGot[g] = true
	}
	inWant := make(map[string]bool, len(want))
	for _, w := range want {
		inWant[w] = true
		if !inGot[w] {
			missing = append(missing, w)
		}
	}
	for _, g := range got {
		if !inWant[g] {
			extra = append(extra, g)
		}
	}
	return missing, extra
}

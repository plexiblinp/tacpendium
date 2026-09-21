package dbtest

import (
	"database/sql"
	"fmt"
	"sort"
	"strings"
	"testing"
)

// Execer は Insert が必要とする最小のインタフェース。*sql.DB と *sql.Tx が満たす。
type Execer interface {
	Exec(query string, args ...any) (sql.Result, error)
}

// Raw は値ではなく SQL 式をそのまま埋め込むための型。
//
// 例: dbtest.Cols{"deleted_at": dbtest.Raw("datetime('now')")}
//
// ★プレースホルダで渡せる値には使わないこと。式が要る箇所だけに使う。
type Raw string

// Cols は INSERT する列名と値の組。
type Cols map[string]any

// Insert は table へ 1 行 INSERT し、その rowid を返す。失敗したらテストを落とす。
//
// ★★本ヘルパは既定値を 1 つも埋めない。指定した列だけが INSERT 文に出る。
// 埋めてしまうと「その既定値に依存した主張がたまたま通る」形になりうるためである
// (教訓 E-218 の変種)。列を省いたときの値はスキーマの既定に委ねられ、
// 寄せる前の inline INSERT と同じ結果になる。
//
// 列名は昇順に並べてから組み立てるので、同じ Cols からは常に同じ SQL が出る。
//
// table と列名は SQL へそのまま埋め込む。テスト専用ヘルパであり、いずれも
// テストコード中のリテラルであることを前提とする(外部入力を渡さないこと)。
func Insert(t *testing.T, db Execer, table string, cols Cols) int64 {
	t.Helper()

	if len(cols) == 0 {
		t.Fatalf("dbtest.Insert(%s): 列が 1 つも指定されていない", table)
	}

	names := make([]string, 0, len(cols))
	for name := range cols {
		names = append(names, name)
	}
	sort.Strings(names)

	placeholders := make([]string, 0, len(names))
	args := make([]any, 0, len(names))
	for _, name := range names {
		if raw, ok := cols[name].(Raw); ok {
			placeholders = append(placeholders, string(raw))
			continue
		}
		placeholders = append(placeholders, "?")
		args = append(args, cols[name])
	}

	query := fmt.Sprintf("INSERT INTO %s (%s) VALUES (%s)",
		table, strings.Join(names, ", "), strings.Join(placeholders, ", "))

	res, err := db.Exec(query, args...)
	if err != nil {
		t.Fatalf("dbtest.Insert: %s: %v", query, err)
	}
	id, err := res.LastInsertId()
	if err != nil {
		t.Fatalf("dbtest.Insert: %s: LastInsertId: %v", query, err)
	}
	return id
}

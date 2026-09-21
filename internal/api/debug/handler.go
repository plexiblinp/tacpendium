//go:build debug

package debug

import (
	"context"
	"database/sql"
	"fmt"
	"net/http"

	"github.com/labstack/echo/v4"
)

const maxDumpRows = 100

// Handler はデバッグ専用 HTTP ハンドラ。
type Handler struct {
	db *sql.DB
	// dir はデータディレクトリ(= filepath.Dir(dbPath))。告知ファイルの位置を知るために要る
	// (M28-02c)。★既存の notice.Handler と同じ形で受ける。
	dir string
}

// NewHandler は Handler を生成する。
func NewHandler(db *sql.DB, dir string) *Handler {
	return &Handler{db: db, dir: dir}
}

// ListTables は全テーブルのレコード数を返す。
//
// GET /api/debug/tables
// レスポンス: {"tables": [{"name": "combos", "count": 5}, ...]}
func (h *Handler) ListTables(c echo.Context) error {
	ctx := c.Request().Context()

	tables, err := listValidTables(ctx, h.db)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError)
	}

	type tableInfo struct {
		Name  string `json:"name"`
		Count int64  `json:"count"`
	}

	infos := make([]tableInfo, 0, len(tables))
	for _, name := range tables {
		var count int64
		// name は sqlite_master から取得したホワイトリスト値のため安全。
		row := h.db.QueryRowContext(ctx, fmt.Sprintf(`SELECT COUNT(*) FROM "%s"`, name))
		if err := row.Scan(&count); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError)
		}
		infos = append(infos, tableInfo{Name: name, Count: count})
	}

	return c.JSON(http.StatusOK, map[string]any{"tables": infos})
}

// DumpTable は指定テーブルの全レコードを JSON で返す。
//
// GET /api/debug/dump/:table
// レスポンス: {"table": "combos", "count": 5, "truncated": false, "rows": [...]}
// 上限 100 件。超過時は truncated=true をセット。
func (h *Handler) DumpTable(c echo.Context) error {
	ctx := c.Request().Context()
	table := c.Param("table")

	validTables, err := listValidTables(ctx, h.db)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError)
	}

	if !contains(validTables, table) {
		return echo.NewHTTPError(http.StatusNotFound)
	}

	// 総レコード数取得(truncated 判定用)。
	// table は上記ホワイトリストで検証済み。
	var total int64
	countRow := h.db.QueryRowContext(ctx, fmt.Sprintf(`SELECT COUNT(*) FROM "%s"`, table))
	if err := countRow.Scan(&total); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError)
	}

	rows, err := h.db.QueryContext(ctx, fmt.Sprintf(`SELECT * FROM "%s" ORDER BY rowid LIMIT %d`, table, maxDumpRows))
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError)
	}
	defer rows.Close()

	cols, err := rows.Columns()
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError)
	}

	result := make([]map[string]any, 0)
	for rows.Next() {
		vals := make([]any, len(cols))
		ptrs := make([]any, len(cols))
		for i := range vals {
			ptrs[i] = &vals[i]
		}
		if err := rows.Scan(ptrs...); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError)
		}
		rec := make(map[string]any, len(cols))
		for i, col := range cols {
			rec[col] = vals[i]
		}
		result = append(result, rec)
	}
	if err := rows.Err(); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError)
	}

	return c.JSON(http.StatusOK, map[string]any{
		"table":     table,
		"count":     total,
		"truncated": total > maxDumpRows,
		"rows":      result,
	})
}

// listValidTables は sqlite_master から有効なテーブル名一覧を返す。
// SQLite 内部テーブル(sqlite_* 接頭辞)とマイグレーション管理テーブルは除外する。
func listValidTables(ctx context.Context, db *sql.DB) ([]string, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT name FROM sqlite_master
		WHERE type = 'table'
		  AND name NOT LIKE 'sqlite_%'
		  AND name != 'schema_migrations'
		ORDER BY name
	`)
	if err != nil {
		return nil, fmt.Errorf("query sqlite_master: %w", err)
	}
	defer rows.Close()

	var tables []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, fmt.Errorf("scan table name: %w", err)
		}
		tables = append(tables, name)
	}
	return tables, rows.Err()
}

func contains(slice []string, s string) bool {
	for _, v := range slice {
		if v == s {
			return true
		}
	}
	return false
}

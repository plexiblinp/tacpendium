package dbtest_test

import (
	"database/sql"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/testutil/dbtest"
)

// 本ファイルは dbtest.Insert 自身の性質を固定する。
//
// ★とくに「指定しなかった列を埋めない」ことが要る —— 埋めると、寄せた側のテストが
// ヘルパの既定値に依存して「たまたま通る」形になりうる(教訓 E-218 の変種)。
// 寄せる前の inline INSERT は列を省けばスキーマ既定に委ねていたので、同じでなければならない。

func TestInsert_OnlyEmitsGivenColumns(t *testing.T) {
	db := dbtest.Setup(t)

	// character_id だけを指定する。他の列はスキーマ既定に委ねられるはずである。
	id := dbtest.Insert(t, db, "combos", dbtest.Cols{"character_id": 1})

	var isDraft, version, stepCount int
	var memo sql.NullString
	var deletedAt sql.NullString
	err := db.QueryRow(
		`SELECT is_draft, version, step_count, memo, deleted_at FROM combos WHERE id = ?`, id,
	).Scan(&isDraft, &version, &stepCount, &memo, &deletedAt)
	if err != nil {
		t.Fatalf("select back: %v", err)
	}

	// スキーマ既定と一致すること(ヘルパが独自の値を入れていない)。
	var wantDraft, wantVersion, wantStepCount int
	var wantMemo, wantDeletedAt sql.NullString
	if err := db.QueryRow(`
		SELECT
			(SELECT dflt_value FROM pragma_table_info('combos') WHERE name = 'is_draft'),
			(SELECT dflt_value FROM pragma_table_info('combos') WHERE name = 'version'),
			(SELECT dflt_value FROM pragma_table_info('combos') WHERE name = 'step_count'),
			(SELECT dflt_value FROM pragma_table_info('combos') WHERE name = 'memo'),
			(SELECT dflt_value FROM pragma_table_info('combos') WHERE name = 'deleted_at')
	`).Scan(&wantDraft, &wantVersion, &wantStepCount, &wantMemo, &wantDeletedAt); err != nil {
		t.Fatalf("read schema defaults: %v", err)
	}

	if isDraft != wantDraft || version != wantVersion || stepCount != wantStepCount {
		t.Errorf("省いた列がスキーマ既定と違う: is_draft=%d(want %d) version=%d(want %d) step_count=%d(want %d)",
			isDraft, wantDraft, version, wantVersion, stepCount, wantStepCount)
	}
	if memo.Valid {
		t.Errorf("省いた memo にヘルパが値を入れた: %q", memo.String)
	}
	if deletedAt.Valid {
		t.Errorf("省いた deleted_at にヘルパが値を入れた: %q", deletedAt.String)
	}
}

func TestInsert_ValuesAndRawExpressions(t *testing.T) {
	db := dbtest.Setup(t)

	id := dbtest.Insert(t, db, "combos", dbtest.Cols{
		"character_id":    1,
		"is_draft":        0,
		"opponent_stance": "crouching",
		"deleted_at":      dbtest.Raw("datetime('now')"),
	})

	var stance string
	var deletedAt sql.NullString
	if err := db.QueryRow(
		`SELECT opponent_stance, deleted_at FROM combos WHERE id = ?`, id,
	).Scan(&stance, &deletedAt); err != nil {
		t.Fatalf("select back: %v", err)
	}
	if stance != "crouching" {
		t.Errorf("opponent_stance = %q, want crouching", stance)
	}
	if !deletedAt.Valid || deletedAt.String == "" {
		t.Errorf("Raw の SQL 式が評価されていない: %v", deletedAt)
	}
	if deletedAt.String == "datetime('now')" {
		t.Errorf("Raw が文字列リテラルとして入っている: %q", deletedAt.String)
	}
}

func TestInsert_ReturnsNewRowID(t *testing.T) {
	db := dbtest.Setup(t)

	first := dbtest.Insert(t, db, "combos", dbtest.Cols{"character_id": 1})
	second := dbtest.Insert(t, db, "combos", dbtest.Cols{"character_id": 1})

	if first == 0 || second == 0 {
		t.Fatalf("rowid が 0 で返った: %d, %d", first, second)
	}
	if first == second {
		t.Errorf("2 回の INSERT が同じ id を返した: %d", first)
	}

	var n int
	if err := db.QueryRow(`SELECT COUNT(*) FROM combos WHERE id IN (?, ?)`, first, second).Scan(&n); err != nil {
		t.Fatalf("count: %v", err)
	}
	if n != 2 {
		t.Errorf("返った id の行が実在しない: count = %d, want 2", n)
	}
}

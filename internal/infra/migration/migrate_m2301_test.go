package migration_test

import (
	"context"
	"database/sql"
	"path/filepath"
	"testing"

	tacpendium "github.com/plexiblinp/tacpendium"
	"github.com/plexiblinp/tacpendium/internal/infra/db"
	"github.com/plexiblinp/tacpendium/internal/infra/migration"
)

// M23-01(CHANGE-121): マイグレ 000078 = combos.superseded_by_combo_id。
//
// 本ファイルは 2 つを見る。
//   (1) up / down の往復整合(列が出現し、down で消え、再 up で戻る)
//   (2) ★指示書 §3.3-7 の実測 —— 後継を完全削除したとき旧行の印がどうなるか。
//       M23-01 当時はボード P-04(PRAGMA foreign_keys が接続単位)により
//       ON DELETE SET NULL が保証されなかった。設計卓の暫定は「旧行がゴミ箱へ
//       再び現れてよい」であり、実測が暫定と食い違っても実装は変えず完了報告へ書く
//       (指示書 §11)。
//       ★M23-10 で db.Open 経由の接続はすべて FK=ON になった。本ファイルの
//       FK=OFF 側の枝は生接続を自前に開いているため影響を受けず、
//       「FK が効かない系での挙動」を記録する対照として今も有効である。

// ★指示書 §3.3-7 の実測(FK=ON を 1 接続に固定した系)。
// 後継を完全削除したときに ON DELETE SET NULL が発火するかを実物で確かめる。
func TestRun_M2301_SuccessorHardDelete_FKOn(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "m2301_fkon.db")
	if err := migration.Run(context.Background(), dbPath, tacpendium.MigrationsFS); err != nil {
		t.Fatalf("migration.Run: %v", err)
	}
	conn, err := db.Open(dbPath)
	if err != nil {
		t.Fatalf("db.Open: %v", err)
	}
	defer conn.Close()
	// ★M23-10 以降、この固定は FK=ON の根拠ではない(db.Open 経由は全接続 FK=ON)。
	// M23-01 当時の名残であり、外すかどうかは M23-10 の判断事項ではないため残している。
	conn.SetMaxOpenConns(1)

	var fk int
	if err := conn.QueryRow(`PRAGMA foreign_keys`).Scan(&fk); err != nil {
		t.Fatalf("pragma foreign_keys: %v", err)
	}
	if fk != 1 {
		t.Fatalf("この系は FK=ON を前提とする(得られた値 %d)", fk)
	}

	oldID, successorID := seedSupersededPair(t, conn)

	if _, err := conn.Exec(`DELETE FROM combos WHERE id = ?`, successorID); err != nil {
		t.Fatalf("後継の完全削除: %v", err)
	}

	var mark sql.NullInt64
	if err := conn.QueryRow(`SELECT superseded_by_combo_id FROM combos WHERE id = ?`, oldID).Scan(&mark); err != nil {
		t.Fatalf("select mark: %v", err)
	}
	// FK=ON では SET NULL が発火し、旧行は「通常の削除済み行」に戻る = ゴミ箱へ再び現れる。
	// これは設計卓の暫定(§4.1-3「現れてよい」)と一致する扱いである。
	if mark.Valid {
		t.Errorf("FK=ON の系で ON DELETE SET NULL が発火していない: superseded_by_combo_id = %d", mark.Int64)
	}
}

// ★指示書 §3.3-7 の実測(FK=OFF の接続で完全削除した系)。
// FK が効かない接続では連鎖が起きず、印が宙に浮いたまま残る。
// ★本テストは db.Open を使わず生接続を自前に開くため、M23-10(全接続 FK=ON)の
// 影響を受けない。実運用でこの系が現れることは M23-10 以降なくなったが、
// 「FK に依存しない実装であること」の対照として値を固定しておく。
// ★本テストは「効かないこと」を欠陥として赤にするためではなく、実測値を固定して
// 完了報告へ書くためのものである(指示書 §4.1-3・チェックリスト §0.3 N-5)。
func TestRun_M2301_SuccessorHardDelete_FKOff(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "m2301_fkoff.db")
	if err := migration.Run(context.Background(), dbPath, tacpendium.MigrationsFS); err != nil {
		t.Fatalf("migration.Run: %v", err)
	}
	conn, err := sql.Open("sqlite", dbPath)
	if err != nil {
		t.Fatalf("sql.Open: %v", err)
	}
	defer conn.Close()
	conn.SetMaxOpenConns(1) // PRAGMA を当てない素の接続(FK は既定で OFF)。

	oldID, successorID := seedSupersededPair(t, conn)

	if _, err := conn.Exec(`DELETE FROM combos WHERE id = ?`, successorID); err != nil {
		t.Fatalf("後継の完全削除: %v", err)
	}

	var mark sql.NullInt64
	if err := conn.QueryRow(`SELECT superseded_by_combo_id FROM combos WHERE id = ?`, oldID).Scan(&mark); err != nil {
		t.Fatalf("select mark: %v", err)
	}
	if !mark.Valid || mark.Int64 != successorID {
		t.Errorf("FK=OFF の系での実測が変化した: superseded_by_combo_id = %v, want %d(宙に浮いた id が残る)", mark, successorID)
	}
	// ★この状態でも「隠れたまま」になるだけであり、データは壊れない。旧行は物理削除されず
	// FR601 の対象として残っている。到達不能になるのは意図である(指示書 §1.3-1)。
	var stillThere int
	if err := conn.QueryRow(`SELECT count(*) FROM combos WHERE id = ?`, oldID).Scan(&stillThere); err != nil {
		t.Fatalf("count old row: %v", err)
	}
	if stillThere != 1 {
		t.Errorf("旧行が消えている(連鎖削除が起きた): count = %d", stillThere)
	}
}

// seedSupersededPair は「後継に置き換えられた削除済みの旧行」と「現役の後継行」を作る。
func seedSupersededPair(t *testing.T, conn *sql.DB) (oldID, successorID int64) {
	t.Helper()
	res, err := conn.Exec(`INSERT INTO combos (character_id, is_draft, version, step_count) VALUES (1, 0, 1, 1)`)
	if err != nil {
		t.Fatalf("insert successor: %v", err)
	}
	successorID, err = res.LastInsertId()
	if err != nil {
		t.Fatalf("last insert id: %v", err)
	}

	res, err = conn.Exec(`
		INSERT INTO combos (character_id, is_draft, version, step_count, deleted_at, superseded_by_combo_id)
		VALUES (1, 0, 1, 1, datetime('now'), ?)`, successorID)
	if err != nil {
		t.Fatalf("insert old row: %v", err)
	}
	oldID, err = res.LastInsertId()
	if err != nil {
		t.Fatalf("last insert id: %v", err)
	}
	return oldID, successorID
}

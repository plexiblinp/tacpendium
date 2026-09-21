// fkbehavior_test.go は「FK が有効な接続で、宣言どおりの挙動が実際に起きるか」を
// 挙動として主張する(M23-10 §5.1-2 / §5.1-3、および §3.3-1 の実査の恒久化)。
//
// package db_test(外部テストパッケージ)にしているのは意図である —— 本ファイルは
// マイグレーション適用済みの DB を要求するため testutil/dbtest を使うが、dbtest 自身が
// infra/db を import している。内部テストパッケージ(package db)に置くと import が循環する。
package db_test

import (
	"database/sql"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/testutil/dbtest"

	_ "modernc.org/sqlite"
)

// requireForeignKeysOn は、以降の主張が「FK が効いている接続」の上で行われることを固定する。
// これが無いと、FK が効いていない接続を引いたときに「CASCADE が発火しなかった」ではなく
// 「テストが緑のまま何も検証しなかった」に化ける。
func requireForeignKeysOn(t *testing.T, conn *sql.DB) {
	t.Helper()
	var fk int
	if err := conn.QueryRow("PRAGMA foreign_keys").Scan(&fk); err != nil {
		t.Fatalf("PRAGMA foreign_keys: %v", err)
	}
	if fk != 1 {
		t.Fatalf("前提が崩れている: この接続は FK=OFF(%d)。M23-10 以降 db.Open 経由の接続は全て FK=ON のはず", fk)
	}
}

// openRawFKOff は同じ DB ファイルへ「アプリ標準 PRAGMA を当てない素の接続」を 1 本開く。
// SQLite の既定は foreign_keys=OFF であり、これは実 DB に orphan が溜まった経路
// (P-04 下で FK が届いていなかった接続)を再現するために使う。
func openRawFKOff(t *testing.T, dbPath string) *sql.DB {
	t.Helper()
	// ★busy_timeout だけは持たせる。同じ DB ファイルへ dbtest のプールも繋がっており、
	//   既定の 0 だと書き込み競合で即 SQLITE_BUSY を返して flaky になりうる。
	//   foreign_keys は指定しない —— FK=OFF であることが本ヘルパの目的だからである。
	raw, err := sql.Open("sqlite", dbPath+"?_pragma=busy_timeout(5000)")
	if err != nil {
		t.Fatalf("sql.Open(raw): %v", err)
	}
	raw.SetMaxOpenConns(1)
	t.Cleanup(func() { _ = raw.Close() })
	var fk int
	if err := raw.QueryRow("PRAGMA foreign_keys").Scan(&fk); err != nil {
		t.Fatalf("raw PRAGMA foreign_keys: %v", err)
	}
	if fk != 0 {
		t.Fatalf("素の接続が FK=ON(%d)。orphan を仕込めない", fk)
	}
	return raw
}

func mustExec(t *testing.T, e interface {
	Exec(string, ...any) (sql.Result, error)
}, query string, args ...any) sql.Result {
	t.Helper()
	res, err := e.Exec(query, args...)
	if err != nil {
		t.Fatalf("exec %q: %v", query, err)
	}
	return res
}

func scanInt(t *testing.T, conn *sql.DB, query string, args ...any) int {
	t.Helper()
	var n int
	if err := conn.QueryRow(query, args...).Scan(&n); err != nil {
		t.Fatalf("scan %q: %v", query, err)
	}
	return n
}

// firstCharacterID は seed 済みキャラクタの id を 1 つ返す。
func firstCharacterID(t *testing.T, conn *sql.DB) int64 {
	t.Helper()
	var id int64
	if err := conn.QueryRow(`SELECT id FROM characters ORDER BY id LIMIT 1`).Scan(&id); err != nil {
		t.Fatalf("characters が seed されていない: %v", err)
	}
	return id
}

// TestOrphanRows_SurviveForeignKeysOn は ★M23-10 §3.3-1 の実査を恒久化したものである。
//
// 背景 —— 実 DB には P-04 下で溜まった orphan(親の消えた子行)が 19 件ある
// (combo_oki_options 12 / combo_steps 6 / combo_tags 1。docs/progress/m23-08-completion-report.md §4.1)。
// 本サブは FK を全接続で ON にするが、既存の orphan は掃除しない(§1.5-2)。
// ⇒ 「orphan が残ったままの DB を FK=ON の接続で触ると何が起きるか」が本サブ最大のリスクだった。
//
// ★空の DB から始まる通常のテストは、この経路を構造的に検出できない。
// 本テストは素の接続(FK=OFF)で orphan を仕込んでから FK=ON の接続で触ることで再現する。
//
// 実測の結論: 落ちない。SQLite は接続時に既存行を検査せず、UPDATE も子キー列が
// 変更されたときにしか FK 検査を発火しない。DELETE は子行側なので常に安全である。
func TestOrphanRows_SurviveForeignKeysOn(t *testing.T) {
	conn, dbPath := dbtest.SetupWithPath(t)
	requireForeignKeysOn(t, conn)

	charID := firstCharacterID(t, conn)

	// ── 親を 2 つ作る。A は消して orphan を作る側、B は再ポイント先 ──────────
	resA := mustExec(t, conn, `INSERT INTO combos (character_id) VALUES (?)`, charID)
	comboA, _ := resA.LastInsertId()
	resB := mustExec(t, conn, `INSERT INTO combos (character_id) VALUES (?)`, charID)
	comboB, _ := resB.LastInsertId()

	// 子行(combo_steps 3 / combo_oki_options 2 / combo_tags 1)を A にぶら下げる。
	stepIDs := make([]int64, 0, 3)
	for order := 1; order <= 3; order++ {
		r := mustExec(t, conn, `INSERT INTO combo_steps (combo_id, step_order, modifiers) VALUES (?, ?, ?)`,
			comboA, order, `{"flags":[]}`)
		id, _ := r.LastInsertId()
		stepIDs = append(stepIDs, id)
	}
	okiIDs := make([]int64, 0, 2)
	for i, at := range []string{"throw_meaty", "shimmy"} {
		r := mustExec(t, conn,
			`INSERT INTO combo_oki_options (combo_id, attack_type, tech_type, uses_dr) VALUES (?, ?, 'neutral_tech', ?)`,
			comboA, at, i)
		id, _ := r.LastInsertId()
		okiIDs = append(okiIDs, id)
	}
	resU := mustExec(t, conn, `INSERT INTO users (name) VALUES ('m23-10-orphan-probe')`)
	userID, _ := resU.LastInsertId()
	resT := mustExec(t, conn, `INSERT INTO tags (user_id, name) VALUES (?, 'm23-10-orphan-probe')`, userID)
	tagID, _ := resT.LastInsertId()
	mustExec(t, conn, `INSERT INTO combo_tags (combo_id, tag_id) VALUES (?, ?)`, comboA, tagID)

	// ── 素の接続(FK=OFF)で親だけを消し、実 DB と同じ形の orphan を作る ──────
	raw := openRawFKOff(t, dbPath)
	mustExec(t, raw, `DELETE FROM combos WHERE id = ?`, comboA)

	orphanSteps := scanInt(t, conn, `SELECT count(*) FROM combo_steps s
		WHERE NOT EXISTS (SELECT 1 FROM combos c WHERE c.id = s.combo_id)`)
	orphanOki := scanInt(t, conn, `SELECT count(*) FROM combo_oki_options o
		WHERE NOT EXISTS (SELECT 1 FROM combos c WHERE c.id = o.combo_id)`)
	orphanTags := scanInt(t, conn, `SELECT count(*) FROM combo_tags ct
		WHERE NOT EXISTS (SELECT 1 FROM combos c WHERE c.id = ct.combo_id)`)
	if orphanSteps != 3 || orphanOki != 2 || orphanTags != 1 {
		t.Fatalf("orphan の仕込みに失敗: steps=%d(want 3) oki=%d(want 2) tags=%d(want 1)",
			orphanSteps, orphanOki, orphanTags)
	}
	t.Logf("★仕込んだ orphan: combo_steps=%d / combo_oki_options=%d / combo_tags=%d",
		orphanSteps, orphanOki, orphanTags)

	// ── ここから先はすべて FK=ON の接続(dbtest = db.Open 経由)で実行する ────
	requireForeignKeysOn(t, conn)

	t.Run("orphan_のSELECTは落ちない", func(t *testing.T) {
		var n int
		if err := conn.QueryRow(`SELECT count(*) FROM combo_steps WHERE combo_id = ?`, comboA).Scan(&n); err != nil {
			t.Fatalf("orphan の SELECT: %v", err)
		}
		if n != 3 {
			t.Errorf("orphan 件数 = %d, want 3", n)
		}
	})

	t.Run("orphan_のFK列を触らないUPDATEは落ちない", func(t *testing.T) {
		if _, err := conn.Exec(`UPDATE combo_steps SET modifiers = ? WHERE id = ?`,
			`{"flags":["touched"]}`, stepIDs[0]); err != nil {
			t.Errorf("★FK 列を触らない UPDATE が落ちた: %v", err)
		}
		if _, err := conn.Exec(`UPDATE combo_oki_options SET tech_type = 'back_tech' WHERE id = ?`,
			okiIDs[0]); err != nil {
			t.Errorf("★FK 列を触らない UPDATE(oki)が落ちた: %v", err)
		}
	})

	t.Run("orphan_のFK列を有効な親へ再ポイントするUPDATEは落ちない", func(t *testing.T) {
		if _, err := conn.Exec(`UPDATE combo_steps SET combo_id = ? WHERE id = ?`,
			comboB, stepIDs[1]); err != nil {
			t.Errorf("★有効な親への再ポイントが落ちた: %v", err)
		}
	})

	t.Run("orphan_のDELETEは落ちない", func(t *testing.T) {
		if _, err := conn.Exec(`DELETE FROM combo_steps WHERE id = ?`, stepIDs[2]); err != nil {
			t.Errorf("★orphan の DELETE が落ちた: %v", err)
		}
		if _, err := conn.Exec(`DELETE FROM combo_oki_options WHERE id = ?`, okiIDs[1]); err != nil {
			t.Errorf("★orphan の DELETE(oki)が落ちた: %v", err)
		}
	})

	t.Run("orphanが残る表への正常なINSERTは落ちない", func(t *testing.T) {
		if _, err := conn.Exec(`INSERT INTO combo_steps (combo_id, step_order) VALUES (?, 99)`,
			comboB); err != nil {
			t.Errorf("★正常な INSERT が落ちた: %v", err)
		}
	})

	// ★対照 —— FK が本当に効いていることの確認。上の 5 件が「全部通る」だけでは
	//   「FK が効いていないから通った」と区別がつかない。
	t.Run("対照_実在しない親へのINSERTはFK違反で落ちる", func(t *testing.T) {
		if _, err := conn.Exec(`INSERT INTO combo_steps (combo_id, step_order) VALUES (?, 1)`,
			comboA); err == nil {
			t.Error("★消えた親を指す INSERT が通ってしまった。FK が効いていない")
		}
	})
}

// TestForeignKeys_CascadeActuallyFires は ON DELETE CASCADE が「宣言」ではなく
// 「挙動」として発火することを主張する(M23-10 §5.1-2)。
//
// ★対象に tags → combo_tags を選ぶ理由 —— 実行時に親を消す 4 経路のうち、
// tags だけが明示削除を持たず CASCADE に依存している(M23-10 §1.3-2)。
// つまりここが「FK=ON になって初めて正しく動く」唯一の経路である。
func TestForeignKeys_CascadeActuallyFires(t *testing.T) {
	conn := dbtest.Setup(t)
	requireForeignKeysOn(t, conn)

	charID := firstCharacterID(t, conn)
	resC := mustExec(t, conn, `INSERT INTO combos (character_id) VALUES (?)`, charID)
	comboID, _ := resC.LastInsertId()
	resU := mustExec(t, conn, `INSERT INTO users (name) VALUES ('m23-10-cascade-probe')`)
	userID, _ := resU.LastInsertId()
	resT := mustExec(t, conn, `INSERT INTO tags (user_id, name) VALUES (?, 'm23-10-cascade-probe')`, userID)
	tagID, _ := resT.LastInsertId()
	mustExec(t, conn, `INSERT INTO combo_tags (combo_id, tag_id) VALUES (?, ?)`, comboID, tagID)

	if got := scanInt(t, conn, `SELECT count(*) FROM combo_tags WHERE tag_id = ?`, tagID); got != 1 {
		t.Fatalf("仕込み失敗: combo_tags = %d, want 1", got)
	}

	mustExec(t, conn, `DELETE FROM tags WHERE id = ?`, tagID)

	if got := scanInt(t, conn, `SELECT count(*) FROM combo_tags WHERE tag_id = ?`, tagID); got != 0 {
		t.Errorf("★ON DELETE CASCADE が発火していない: combo_tags が %d 行残っている, want 0", got)
	}
	// 親の消えたコンボ側は無傷であること(CASCADE の向きが逆になっていない)。
	if got := scanInt(t, conn, `SELECT count(*) FROM combos WHERE id = ?`, comboID); got != 1 {
		t.Errorf("★CASCADE がコンボ側へ波及している: combos = %d, want 1", got)
	}
}

// TestExplicitChildDeleteThenParent_NoError は M23-08 / M23-02 が入れた明示削除が、
// FK=ON になった後も「保険として無害に残る」ことを主張する(M23-10 §5.1-3)。
//
// ★明示削除は撤去しない(M23-10 §2.2)。撤去してよいかどうかは本サブの判断事項ではない。
// ⇒ 二重に消しにいく形が、FK=ON の下でも落ちないことを固定しておく。
//
// ★本テストは「形」を主張するものであり、repository.HardDelete の実装そのものは
// internal/repository/combo/hard_delete_children_test.go が押さえている(同ファイルは
// スキーマから子表を列挙し、FK=ON / FK=OFF の両ケースで回す)。二重に守られている。
func TestExplicitChildDeleteThenParent_NoError(t *testing.T) {
	conn := dbtest.Setup(t)
	requireForeignKeysOn(t, conn)

	charID := firstCharacterID(t, conn)
	resC := mustExec(t, conn, `INSERT INTO combos (character_id) VALUES (?)`, charID)
	comboID, _ := resC.LastInsertId()
	mustExec(t, conn, `INSERT INTO combo_steps (combo_id, step_order) VALUES (?, 1)`, comboID)
	mustExec(t, conn,
		`INSERT INTO combo_oki_options (combo_id, attack_type, tech_type, uses_dr) VALUES (?, 'shimmy', 'neutral_tech', 0)`,
		comboID)

	tx, err := conn.Begin()
	if err != nil {
		t.Fatalf("Begin: %v", err)
	}
	defer func() { _ = tx.Rollback() }()

	// 子を明示的に消し(= M23-08 の形)、その後に親を消す。
	// 親の削除時点で CASCADE の対象は既に 0 行であり、二重に消しにいく形になる。
	for _, q := range []string{
		`DELETE FROM combo_steps WHERE combo_id = ?`,
		`DELETE FROM combo_oki_options WHERE combo_id = ?`,
		`DELETE FROM combo_tags WHERE combo_id = ?`,
	} {
		if _, err := tx.Exec(q, comboID); err != nil {
			t.Fatalf("明示削除 %q: %v", q, err)
		}
	}
	if _, err := tx.Exec(`DELETE FROM combos WHERE id = ?`, comboID); err != nil {
		t.Fatalf("★明示削除の後の親削除が落ちた: %v", err)
	}
	if err := tx.Commit(); err != nil {
		t.Fatalf("★Commit が落ちた(遅延 FK 検査の可能性): %v", err)
	}

	if got := scanInt(t, conn, `SELECT count(*) FROM combo_steps WHERE combo_id = ?`, comboID); got != 0 {
		t.Errorf("combo_steps が %d 行残っている, want 0", got)
	}
	if got := scanInt(t, conn, `SELECT count(*) FROM combos WHERE id = ?`, comboID); got != 0 {
		t.Errorf("combos が %d 行残っている, want 0", got)
	}
}

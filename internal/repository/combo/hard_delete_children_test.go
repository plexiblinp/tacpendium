package combo_test

// ★★M23-08 §4.1-3 / §5.1-1〜3: 完全削除が combos の子表をすべて落とすこと。
//
// 本ファイルは M23-08 でいちばん価値のある成果物である(指示書 §1.2)。守っているのは
// 「今日 5 表が消えること」ではなく、**新しい子表が増えて HardDelete に明示削除を
// 書き忘れたときに落ちること** である。
//
// ★なぜ明示削除なのか(代償を承知していることの記録):
//   CASCADE 依存のままなら「新しい子表が増えても何もしなくても消える」。明示削除へ
//   移すことは、その利点を捨てて「誰かが HardDelete に 1 行足すのを忘れる」形を
//   選ぶことである。移した理由は P-04 —— PRAGMA foreign_keys は接続単位であり、
//   M23-08 当時の infra/db.Open は *sql.DB.Exec で 1 接続にしか流していなかった
//   (SetMaxOpenConns も本番コードに無い)ため、CASCADE の発火が保証されなかった。
//   ⇒ 「忘れられる形」を選ぶ以上、忘れたことが分かる仕組みを同時に置く。それが本テスト。
//
// ★M23-10 で db.Open は接続文字列で PRAGMA を指定する形になり、プール中のすべての
//   接続が FK=ON になった。それでも明示削除も本テストも撤去しない —— 明示削除は
//   二重の保険であり、撤去してよいかどうかは M23-10 の判断事項ではない(同 §2.2)。
//
// ★fk_off ケースが必須である理由(M23-10 後も変わらない):
//   FK=ON の接続で回すと、明示削除を 1 表分消しても CASCADE が代わりに消してしまい、
//   テストは緑のまま通る。それでは本テストは何も守っていない。FK を一切適用しない
//   生接続で回す枝を必ず持たせる(先例: service/combo/setup_results_carry_test.go)。
//   ★M23-10 で db.Open 経由の接続はすべて FK=ON になったため、この枝は
//   「実運用で起こりうる状態」の再現ではなく「明示削除が実在することの検査」になった。
//   役割は変わったが、必要性は変わっていない。生接続は本ファイル内で自前に開いている。

import (
	"context"
	"database/sql"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
	comborepo "github.com/plexiblinp/tacpendium/internal/repository/combo"
	"github.com/plexiblinp/tacpendium/internal/testutil/dbtest"
)

// comboRef は「削除されたコンボの id を指しうる列」1 つを表す。
type comboRef struct {
	table  string
	column string
}

func (c comboRef) String() string { return c.table + "." + c.column }

// listTables はユーザ表の名前をすべて返す。
func listTables(t *testing.T, db *sql.DB) []string {
	t.Helper()
	rows, err := db.Query(
		`SELECT name FROM sqlite_master
		  WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
		  ORDER BY name`)
	if err != nil {
		t.Fatalf("list tables: %v", err)
	}
	defer func() { _ = rows.Close() }()

	var tables []string
	for rows.Next() {
		var name string
		if scanErr := rows.Scan(&name); scanErr != nil {
			t.Fatalf("scan table name: %v", scanErr)
		}
		tables = append(tables, name)
	}
	if rowsErr := rows.Err(); rowsErr != nil {
		t.Fatalf("iterate tables: %v", rowsErr)
	}
	return tables
}

// fkColumnsTo は table の外部キーのうち parent を参照する「from 列」を返す。
func fkColumnsTo(t *testing.T, db *sql.DB, table, parent string) []string {
	t.Helper()
	rows, err := db.Query(
		`SELECT "from" FROM pragma_foreign_key_list(?) WHERE "table" = ?`, table, parent)
	if err != nil {
		t.Fatalf("foreign_key_list(%s → %s): %v", table, parent, err)
	}
	defer func() { _ = rows.Close() }()

	var cols []string
	for rows.Next() {
		var column string
		if scanErr := rows.Scan(&column); scanErr != nil {
			t.Fatalf("scan fk column of %s: %v", table, scanErr)
		}
		cols = append(cols, column)
	}
	if rowsErr := rows.Err(); rowsErr != nil {
		t.Fatalf("iterate fk list of %s: %v", table, rowsErr)
	}
	return cols
}

// listComboRefs は「完全削除の後に、消えたコンボの id を指していてはいけない列」を
// スキーマから機械的に列挙する。
//
// ★★表名をハードコードしないことが本テストの要件である(指示書 §4.1-3)。
// ハードコードした一覧で書くと「表を足す人は、テストの一覧も一緒に忘れる」ため、
// 一覧がずれたことを検出するという目的をまったく果たさない。
//
// ★`ON DELETE CASCADE` に絞らない。絞ると「combos を参照するが CASCADE 句を持たない
// 新しい表」が列挙にも明示削除にもテストにも出てこない —— これは本サブ §4.2 が扱った
// materialized_from_combo_id(ON DELETE 句なし)とまったく同じ型の穴である。
// ⇒ 参照の仕方に依らず「指している列」をすべて集め、削除後に 0 行であることを課す。
//
//	CASCADE(行が消える)でも SET NULL / 明示 NULL 化(値が NULL になる)でも、
//	「消えた id を指す行が残っていない」という一つの主張で足りる。
//	★NULL 化と削除の取り違えは本主張では区別できないため、
//	TestHardDelete_NullsMaterializedFromInsteadOfDeletingChild が別に見ている。
//
// ★self-FK(combos 自身の列)も含める。3 本目の self-FK が足されたら列挙に出る。
//
// ★孫も 1 段だけ辿る。combo_setup_results は combos の直接の子ではなく
// combo_setups への複合 FK を持つ孫であり、直接の子だけを見ていると素通りする。
// 「直接の子 X の combos 参照列と同じ名前の列で X を参照している表」を孫として拾う。
func listComboRefs(t *testing.T, db *sql.DB) []comboRef {
	t.Helper()
	tables := listTables(t, db)

	var refs []comboRef
	// 直接 combos を指す列(self-FK を含む)。
	direct := map[string]string{} // 表名 → combos を指す列名
	for _, table := range tables {
		for _, column := range fkColumnsTo(t, db, table, "combos") {
			refs = append(refs, comboRef{table: table, column: column})
			if table != "combos" {
				direct[table] = column
			}
		}
	}
	// 孫: 直接の子を参照し、かつ同名の列を持つ表。
	for _, table := range tables {
		for parent, parentColumn := range direct {
			if table == parent {
				continue
			}
			for _, column := range fkColumnsTo(t, db, table, parent) {
				if column == parentColumn {
					refs = append(refs, comboRef{table: table, column: column})
				}
			}
		}
	}
	return refs
}

// countReferencing は comboID を指している行数を数える。
func countReferencing(t *testing.T, db *sql.DB, ref comboRef, comboID int64) int {
	t.Helper()
	var n int
	// 表名・列名は上でスキーマから引いた識別子であり、外部入力ではない。
	q := `SELECT COUNT(*) FROM "` + ref.table + `" WHERE "` + ref.column + `" = ?`
	if err := db.QueryRow(q, comboID).Scan(&n); err != nil {
		t.Fatalf("count %s: %v", ref, err)
	}
	return n
}

func countRows(t *testing.T, db *sql.DB, query string, args ...any) int {
	t.Helper()
	var n int
	if err := db.QueryRow(query, args...).Scan(&n); err != nil {
		t.Fatalf("count (%s): %v", query, err)
	}
	return n
}

// comboWithAllChildren は「既知の全子表 + 孫(combo_setup_results)に行を持つ」コンボを
// 1 件作り、その id を返す。self-FK は別途 referenceComboFromAnother が埋める。
//
// ★新しい子表が増えたら本関数にも行の作り方を足す必要がある。足し忘れは
// 「列挙したすべての参照列が削除前に 1 行以上ある」の主張が検出する —— 列挙は
// スキーマ由来なので、実装より先に増えるためである。
func comboWithAllChildren(t *testing.T, db *sql.DB, repo comborepo.Repository, tagName string) int64 {
	t.Helper()
	ctx := context.Background()

	move1 := lookupMoveID(t, db, 1, "standing_light_punch")
	move2 := lookupMoveID(t, db, 1, "hadoken_light")
	tagID := insertTestTag(t, db, tagName)

	var comboID int64
	withTx(t, db, func(tx *sql.Tx) {
		var err error
		comboID, err = repo.InsertCombo(ctx, tx, &model.Combo{
			CharacterID:    1,
			IsDraft:        false,
			StarterMoveID:  ptrInt64(move1),
			Position:       ptrStr("mid_screen"),
			OpponentStance: ptrStr("standing"),
			HitType:        ptrStr("normal"),
			OpponentSize:   ptrStr("standard"),
			Version:        1,
			StepCount:      2,
		})
		if err != nil {
			t.Fatalf("InsertCombo: %v", err)
		}
		// combo_steps
		if err = repo.InsertSteps(ctx, tx, comboID, []model.ComboStep{
			{StepOrder: 1, MoveID: ptrInt64(move1)},
			{StepOrder: 2, MoveID: ptrInt64(move2)},
		}); err != nil {
			t.Fatalf("InsertSteps: %v", err)
		}
		// combo_tags
		if err = repo.ReplaceTagAssociations(ctx, tx, comboID, 1, []int64{tagID}); err != nil {
			t.Fatalf("ReplaceTagAssociations: %v", err)
		}
		// combo_oki_options
		if err = repo.ReplaceOkiOptions(ctx, tx, comboID, []model.OkiOption{
			{AttackType: "strike_meaty", TechType: "neutral_tech", UsesDR: false},
		}); err != nil {
			t.Fatalf("ReplaceOkiOptions: %v", err)
		}
		// combo_punishes
		if err = repo.InsertPunish(ctx, tx, comboID, move2, nil); err != nil {
			t.Fatalf("InsertPunish: %v", err)
		}
		// combo_punish_curations(専用のリポジトリ経路が無いため素の SQL で置く)
		if _, err = tx.ExecContext(ctx,
			`INSERT INTO combo_punish_curations (combo_id, opponent_move_id) VALUES (?, ?)`,
			comboID, move2); err != nil {
			t.Fatalf("insert combo_punish_curations: %v", err)
		}
		// combo_setups + 孫の combo_setup_results
		res, execErr := tx.ExecContext(ctx,
			`INSERT INTO setups (character_id, name, step_count) VALUES (1, ?, 0)`, tagName+"-setup")
		if execErr != nil {
			t.Fatalf("insert setup: %v", execErr)
		}
		setupID, _ := res.LastInsertId()
		if _, err = tx.ExecContext(ctx,
			`INSERT INTO combo_setups (combo_id, setup_id) VALUES (?, ?)`, comboID, setupID); err != nil {
			t.Fatalf("insert combo_setups: %v", err)
		}
		if _, err = tx.ExecContext(ctx,
			`INSERT INTO combo_setup_results (combo_id, setup_id, tech_type, in_corner, result)
			 VALUES (?, ?, 'neutral_tech', 0, 'ok')`, comboID, setupID); err != nil {
			t.Fatalf("insert combo_setup_results: %v", err)
		}
	})
	return comboID
}

// referenceComboFromAnother は、別のコンボから target を指す self-FK をすべて埋める。
//
// ★列挙(listComboRefs)は combos 自身の self-FK 列も拾う。ここで埋めておかないと
// 「削除前に 1 行以上ある」の主張が落ちる —— それは 3 本目の self-FK が足されたときに
// 本関数を直させるための仕掛けであり、狙いどおりの落ち方である。
func referenceComboFromAnother(t *testing.T, db *sql.DB, refs []comboRef, target, other int64) {
	t.Helper()
	for _, ref := range refs {
		if ref.table != "combos" {
			continue
		}
		// 識別子はスキーマ由来。外部入力ではない。
		q := `UPDATE combos SET "` + ref.column + `" = ? WHERE id = ?`
		if _, err := db.Exec(q, target, other); err != nil {
			t.Fatalf("set %s: %v", ref, err)
		}
	}
}

// openFKOff は PRAGMA を一切適用しない生接続の *sql.DB を返す(SQLite の既定は FK=OFF)。
// 先例: internal/service/combo/setup_results_carry_test.go。
func openFKOff(t *testing.T, dbPath string) *sql.DB {
	t.Helper()
	raw, err := sql.Open("sqlite", dbPath)
	if err != nil {
		t.Fatalf("open raw db: %v", err)
	}
	t.Cleanup(func() { _ = raw.Close() })
	var fk int
	if err := raw.QueryRow("PRAGMA foreign_keys").Scan(&fk); err != nil {
		t.Fatalf("query foreign_keys: %v", err)
	}
	if fk != 0 {
		t.Skipf("生接続の既定が FK=ON(%d)のため、本ケースの前提が成立しない", fk)
	}
	return raw
}

// openFKOn は FK=ON が確実に効く接続を返す。
//
// ★M23-10 以降、この 1 本への固定は FK=ON の根拠ではない —— db.Open が接続文字列で
// PRAGMA を指定するようになり、プール中のすべての接続が FK=ON である。
// 固定を残しているのは歴史的経緯であり(M23-08 当時は PRAGMA がプール中の 1 本にしか
// 届かず、固定しなければ FK=OFF の接続を引きえた)、外すかどうかは M23-10 の判断事項
// ではない。⇒ 「固定しているから FK=ON なのだ」と読まないこと。
func openFKOn(t *testing.T, db *sql.DB) *sql.DB {
	t.Helper()
	db.SetMaxOpenConns(1)
	var fk int
	if err := db.QueryRow("PRAGMA foreign_keys").Scan(&fk); err != nil {
		t.Fatalf("query foreign_keys: %v", err)
	}
	if fk != 1 {
		t.Fatalf("FK=OFF(%d)。M23-10 以降 db.Open 経由は全接続 FK=ON のはずで、前提が崩れている", fk)
	}
	return db
}

// ---------------------------------------------------------------------------
// §5.1-1: スキーマから子表を列挙し、完全削除の後にすべてが空である
// ---------------------------------------------------------------------------

func TestHardDelete_RemovesAllCascadeChildren(t *testing.T) {
	for _, tc := range []struct {
		name  string
		fkOff bool
	}{
		{name: "fk_on", fkOff: false},
		// ★fk_off こそが本命である。明示削除だけが子を落とす経路になる。
		{name: "fk_off", fkOff: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			base, dbPath := dbtest.SetupWithPath(t)
			db := base
			if tc.fkOff {
				db = openFKOff(t, dbPath)
			} else {
				db = openFKOn(t, base)
			}
			repo := comborepo.New(db)
			ctx := context.Background()

			refs := listComboRefs(t, db)

			// ★★走査が壊れて 0 件になったときに緑で通らないようにする。
			//   件数 0 件の一覧に対する「すべて空である」は常に真である。
			if len(refs) == 0 {
				t.Fatal("combos を指す参照列が 1 件も列挙できていない。" +
					"列挙そのものが壊れており、以降の主張は無意味である")
			}
			t.Logf("列挙した combos 参照列 = %d 件: %v", len(refs), refs)

			comboID := comboWithAllChildren(t, db, repo, "m2308-"+tc.name)
			otherID := comboWithAllChildren(t, db, repo, "m2308-other-"+tc.name)
			referenceComboFromAnother(t, db, refs, comboID, otherID)

			// ★列挙したすべての参照列に行があること。新しい子表・新しい self-FK が
			//   増えて fixture を書き忘れると、ここで落ちる。
			for _, ref := range refs {
				if got := countReferencing(t, db, ref, comboID); got == 0 {
					t.Fatalf("%s に削除前の行が無い。参照列が増えた可能性がある —— "+
						"fixture に行の作り方を足し、HardDelete に明示削除か NULL 化を足すこと", ref)
				}
			}

			withTx(t, db, func(tx *sql.Tx) {
				if err := repo.HardDelete(ctx, tx, comboID); err != nil {
					t.Fatalf("HardDelete: %v", err)
				}
			})

			if got := countRows(t, db, `SELECT COUNT(*) FROM combos WHERE id = ?`, comboID); got != 0 {
				t.Errorf("combos が %d 行残っている", got)
			}
			// ★消えた id を指す行が 1 つも残っていないこと。
			//   子表なら行が消えたこと、self-FK なら値が NULL になったことを同じ形で見る。
			//   ★NULL 化と削除の取り違えは本主張では区別できない。それは
			//   TestHardDelete_NullsMaterializedFromInsteadOfDeletingChild が見ている。
			for _, ref := range refs {
				if got := countReferencing(t, db, ref, comboID); got != 0 {
					t.Errorf("%s に %d 行残っている(明示削除／NULL 化の書き漏れ)", ref, got)
				}
			}
			// ★対照: 巻き添えで別のコンボまで消えていないこと。
			if got := countRows(t, db, `SELECT COUNT(*) FROM combos WHERE id = ?`, otherID); got != 1 {
				t.Errorf("別のコンボ(id=%d)が %d 行。完全削除が対象外の行まで巻き込んでいる", otherID, got)
			}
		})
	}
}

// ---------------------------------------------------------------------------
// §5.1-2 / §5.1-3: self-FK は NULL 化であって削除ではない
// ---------------------------------------------------------------------------

// materialize 生成物を持つ基底コンボを完全削除しても、生成物は残り
// materialized_from_combo_id だけが NULL になる。
//
// ★NULL 化と削除を取り違えると利用者のデータが黙って消える(指示書 §4.2-2)。
// 生成物は独立したコンボであり、基底が消えても利用者の資産として残る。
func TestHardDelete_NullsMaterializedFromInsteadOfDeletingChild(t *testing.T) {
	for _, tc := range []struct {
		name  string
		fkOff bool
	}{
		{name: "fk_on", fkOff: false},
		{name: "fk_off", fkOff: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			base, dbPath := dbtest.SetupWithPath(t)
			db := base
			if tc.fkOff {
				db = openFKOff(t, dbPath)
			} else {
				db = openFKOn(t, base)
			}
			repo := comborepo.New(db)
			ctx := context.Background()

			baseID := comboWithAllChildren(t, db, repo, "m2308-mat-base-"+tc.name)
			derivedID := comboWithAllChildren(t, db, repo, "m2308-mat-derived-"+tc.name)
			if _, err := db.Exec(
				`UPDATE combos SET materialized_from_combo_id = ? WHERE id = ?`, baseID, derivedID); err != nil {
				t.Fatalf("set materialized_from_combo_id: %v", err)
			}

			withTx(t, db, func(tx *sql.Tx) {
				if err := repo.HardDelete(ctx, tx, baseID); err != nil {
					t.Fatalf("HardDelete(base): %v", err)
				}
			})

			// ★★生成物が削除されていないこと。取り違え検出はこの 1 本だけである。
			if got := countRows(t, db, `SELECT COUNT(*) FROM combos WHERE id = ?`, derivedID); got != 1 {
				t.Fatalf("materialize 生成物が消えている(combos の行数 = %d, want 1)。"+
					"NULL 化ではなく削除になっている＝利用者のデータの消失である", got)
			}
			// 生成物の子も巻き添えで消えていないこと。
			if got := countRows(t, db,
				`SELECT COUNT(*) FROM combo_steps WHERE combo_id = ?`, derivedID); got == 0 {
				t.Errorf("materialize 生成物の combo_steps まで消えている")
			}
			var ref sql.NullInt64
			if err := db.QueryRow(
				`SELECT materialized_from_combo_id FROM combos WHERE id = ?`, derivedID).Scan(&ref); err != nil {
				t.Fatalf("read materialized_from_combo_id: %v", err)
			}
			if ref.Valid {
				t.Errorf("materialized_from_combo_id = %d(dangling)。NULL 化されていない", ref.Int64)
			}
		})
	}
}

// 後継コンボを完全削除すると、旧行の superseded_by_combo_id が NULL に戻る。
//
// ★migrations/000078 は ON DELETE SET NULL を「意図の記録」として置いており、
// 「後継が完全削除された旧行はゴミ箱へ再び現れうる」前提で M23-01 が実装されている。
// FK=OFF の接続では SET NULL が発火せず印が残るため、旧行はゴミ箱の一覧
// (deleted_at IS NOT NULL AND superseded_by_combo_id IS NULL)からも重複判定からも
// 外れたまま、どの画面からも触れない行になる。明示 NULL 化でそれを接続に依存させない。
// ★M23-10 で db.Open 経由は全接続 FK=ON になったが、明示 NULL 化は撤去しない。
// ★開発者裁定(2026-08-23)により指示書 §4.2 へ 1 件足したもの。
func TestHardDelete_NullsSupersededByOnRemainingRows(t *testing.T) {
	for _, tc := range []struct {
		name  string
		fkOff bool
	}{
		{name: "fk_on", fkOff: false},
		{name: "fk_off", fkOff: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			base, dbPath := dbtest.SetupWithPath(t)
			db := base
			if tc.fkOff {
				db = openFKOff(t, dbPath)
			} else {
				db = openFKOn(t, base)
			}
			repo := comborepo.New(db)
			ctx := context.Background()

			oldID := comboWithAllChildren(t, db, repo, "m2308-sup-old-"+tc.name)
			newID := comboWithAllChildren(t, db, repo, "m2308-sup-new-"+tc.name)
			if _, err := db.Exec(
				`UPDATE combos SET deleted_at = datetime('now'), superseded_by_combo_id = ? WHERE id = ?`,
				newID, oldID); err != nil {
				t.Fatalf("mark superseded: %v", err)
			}

			withTx(t, db, func(tx *sql.Tx) {
				if err := repo.HardDelete(ctx, tx, newID); err != nil {
					t.Fatalf("HardDelete(new): %v", err)
				}
			})

			if got := countRows(t, db, `SELECT COUNT(*) FROM combos WHERE id = ?`, oldID); got != 1 {
				t.Fatalf("旧行が消えている(combos の行数 = %d, want 1)", got)
			}
			var ref sql.NullInt64
			if err := db.QueryRow(
				`SELECT superseded_by_combo_id FROM combos WHERE id = ?`, oldID).Scan(&ref); err != nil {
				t.Fatalf("read superseded_by_combo_id: %v", err)
			}
			if ref.Valid {
				t.Errorf("superseded_by_combo_id = %d(dangling)。旧行がゴミ箱へ戻らない", ref.Int64)
			}
		})
	}
}

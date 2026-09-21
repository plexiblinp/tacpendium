package migration_test

import (
	"context"
	"database/sql"
	"path/filepath"
	"testing"

	tacpendium "github.com/plexiblinp/tacpendium"
	"github.com/plexiblinp/tacpendium/internal/infra/migration"

	_ "modernc.org/sqlite"
)

// openTestDB は一時 DB を開いて *sql.DB を返す。テスト終了時にクローズする。
func openTestDB(t *testing.T, dbPath string) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		t.Fatalf("sql.Open: %v", err)
	}
	t.Cleanup(func() { db.Close() })
	return db
}

func TestRun_FirstAndIdempotent(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "test.db")
	ctx := context.Background()

	if err := migration.Run(ctx, dbPath, tacpendium.MigrationsFS); err != nil {
		t.Fatalf("first Run: %v", err)
	}

	if err := migration.Run(ctx, dbPath, tacpendium.MigrationsFS); err != nil {
		t.Fatalf("second Run (should be no-op): %v", err)
	}
}

// TestRun_CreatesMissingParentDir は、DB の親ディレクトリが存在しない場合でも
// マイグレーションが成功することを確認する。マイグレーションは main.go の db.Open
// (親ディレクトリ作成)より前に走るため、初回起動時に OS アプリデータディレクトリ
// (例: Windows %APPDATA%\combomgr\)が無い状況を再現する。
func TestRun_CreatesMissingParentDir(t *testing.T) {
	// t.TempDir() 配下の未作成のネストしたディレクトリを指定する。
	dbPath := filepath.Join(t.TempDir(), "nested", "appdata", "combomgr", "combomgr.db")
	if err := migration.Run(context.Background(), dbPath, tacpendium.MigrationsFS); err != nil {
		t.Fatalf("Run with missing parent dir: %v", err)
	}
}

func TestRun_AllTablesExist(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "test.db")
	if err := migration.Run(context.Background(), dbPath, tacpendium.MigrationsFS); err != nil {
		t.Fatalf("Run: %v", err)
	}

	db := openTestDB(t, dbPath)

	wantTables := []string{
		"games",
		"characters",
		"moves",
		"combos",
		"combo_steps",
		"tags",
		"combo_tags",
		"presets",
		"preset_aliases",
		"users",
		"setups",
		"setup_steps",
		"combo_setups",
	}

	for _, name := range wantTables {
		var found string
		err := db.QueryRow(
			"SELECT name FROM sqlite_master WHERE type='table' AND name=?",
			name,
		).Scan(&found)
		if err != nil {
			t.Errorf("table %q not found: %v", name, err)
			continue
		}
		if found != name {
			t.Errorf("table mismatch: got %q, want %q", found, name)
		}
	}
}

// readTableColumns は PRAGMA table_info の結果をカラム名 set として返すヘルパ。
func readTableColumns(t *testing.T, db *sql.DB, table string) map[string]bool {
	t.Helper()
	rows, err := db.Query("PRAGMA table_info(" + table + ")")
	if err != nil {
		t.Fatalf("PRAGMA table_info(%s): %v", table, err)
	}
	defer rows.Close()

	cols := map[string]bool{}
	for rows.Next() {
		var cid int
		var name, ctype string
		var notnull, pk int
		var dflt sql.NullString
		if err := rows.Scan(&cid, &name, &ctype, &notnull, &dflt, &pk); err != nil {
			t.Fatalf("scan: %v", err)
		}
		cols[name] = true
	}
	return cols
}

func TestRun_HitTypeColumnExists(t *testing.T) {
	// CHANGE-006 検証: combos テーブルに hit_type カラムが存在すること(counter_type ではない)。
	dbPath := filepath.Join(t.TempDir(), "test.db")
	if err := migration.Run(context.Background(), dbPath, tacpendium.MigrationsFS); err != nil {
		t.Fatalf("Run: %v", err)
	}
	db := openTestDB(t, dbPath)
	cols := readTableColumns(t, db, "combos")

	if !cols["hit_type"] {
		t.Error("expected combos.hit_type column to exist (CHANGE-006)")
	}
	if cols["counter_type"] {
		t.Error("combos.counter_type should not exist after CHANGE-006 rename")
	}
}

// C-11(000016)検証: drive_damage が REAL 化され、小数・負値・整数が round-trip すること
// (既存 int 値の互換 = 指示書 §5.1)。マイグレーション層で型宣言とデータ保持を担保する。
func TestRun_DriveDamageRealRoundTrip(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "test.db")
	if err := migration.Run(context.Background(), dbPath, tacpendium.MigrationsFS); err != nil {
		t.Fatalf("Run: %v", err)
	}
	db := openTestDB(t, dbPath)

	// 1) 宣言型が REAL であること(PRAGMA table_info)。
	var colType string
	rows, err := db.Query("PRAGMA table_info(combos)")
	if err != nil {
		t.Fatalf("PRAGMA table_info: %v", err)
	}
	for rows.Next() {
		var cid int
		var name, ctype string
		var notnull, pk int
		var dflt sql.NullString
		if err := rows.Scan(&cid, &name, &ctype, &notnull, &dflt, &pk); err != nil {
			t.Fatalf("scan table_info: %v", err)
		}
		if name == "drive_damage" {
			colType = ctype
		}
	}
	_ = rows.Close()
	if colType != "REAL" {
		t.Errorf("drive_damage column type = %q, want REAL", colType)
	}

	// 2) 小数・負値・整数の round-trip(character_id=1 はリュウ seed)。
	cases := []float64{-2.5, 3.5, 2, -6, 6}
	for _, want := range cases {
		res, err := db.Exec(
			"INSERT INTO combos (character_id, drive_damage) VALUES (1, ?)", want,
		)
		if err != nil {
			t.Fatalf("insert drive_damage=%g: %v", want, err)
		}
		id, _ := res.LastInsertId()
		var got float64
		if err := db.QueryRow("SELECT drive_damage FROM combos WHERE id = ?", id).Scan(&got); err != nil {
			t.Fatalf("select drive_damage id=%d: %v", id, err)
		}
		if got != want {
			t.Errorf("round-trip drive_damage = %g, want %g", got, want)
		}
	}
}

// columnType は combos の指定カラムの宣言型(PRAGMA table_info の type 列)を返すヘルパ。
func columnType(t *testing.T, db *sql.DB, table, column string) string {
	t.Helper()
	rows, err := db.Query("PRAGMA table_info(" + table + ")")
	if err != nil {
		t.Fatalf("PRAGMA table_info(%s): %v", table, err)
	}
	defer rows.Close()
	for rows.Next() {
		var cid int
		var name, ctype string
		var notnull, pk int
		var dflt sql.NullString
		if err := rows.Scan(&cid, &name, &ctype, &notnull, &dflt, &pk); err != nil {
			t.Fatalf("scan table_info: %v", err)
		}
		if name == column {
			return ctype
		}
	}
	t.Fatalf("column %s.%s not found", table, column)
	return ""
}

// M16-01(000019)検証: drive_available_at_start が REAL 化され、0.5 刻み・整数値が
// round-trip すること(既存 int 値の無損失昇格 = 指示書 §5.1)。
func TestRun_DriveAvailableAtStartRealRoundTrip(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "test.db")
	if err := migration.Run(context.Background(), dbPath, tacpendium.MigrationsFS); err != nil {
		t.Fatalf("Run: %v", err)
	}
	db := openTestDB(t, dbPath)

	// 1) 宣言型が REAL であること。
	if ct := columnType(t, db, "combos", "drive_available_at_start"); ct != "REAL" {
		t.Errorf("drive_available_at_start column type = %q, want REAL", ct)
	}

	// 2) 0.5 刻み・整数・境界値の round-trip(character_id=1 はリュウ seed)。
	cases := []float64{0, 2, 2.5, 5.5, 6}
	for _, want := range cases {
		res, err := db.Exec(
			"INSERT INTO combos (character_id, drive_available_at_start) VALUES (1, ?)", want,
		)
		if err != nil {
			t.Fatalf("insert drive_available_at_start=%g: %v", want, err)
		}
		id, _ := res.LastInsertId()
		var got float64
		if err := db.QueryRow(
			"SELECT drive_available_at_start FROM combos WHERE id = ?", id,
		).Scan(&got); err != nil {
			t.Fatalf("select drive_available_at_start id=%d: %v", id, err)
		}
		if got != want {
			t.Errorf("round-trip drive_available_at_start = %g, want %g", got, want)
		}
	}
}

// M16-02(000020)検証: ゲージ消費列 2 本が加算的に追加され、既存 seed 行は NULL、
// SA 消費(INTEGER)・drive 消費(REAL・0.5 刻み)が round-trip すること(指示書 §5.1)。
func TestRun_GaugeConsumedColumnsAdded(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "test.db")
	if err := migration.Run(context.Background(), dbPath, tacpendium.MigrationsFS); err != nil {
		t.Fatalf("Run: %v", err)
	}
	db := openTestDB(t, dbPath)

	// 1) 2 列が存在し宣言型が INTEGER / REAL であること。
	cols := readTableColumns(t, db, "combos")
	if !cols["sa_gauge_consumed"] {
		t.Errorf("combos.sa_gauge_consumed not found after up")
	}
	if !cols["drive_gauge_consumed"] {
		t.Errorf("combos.drive_gauge_consumed not found after up")
	}
	if ct := columnType(t, db, "combos", "sa_gauge_consumed"); ct != "INTEGER" {
		t.Errorf("sa_gauge_consumed column type = %q, want INTEGER", ct)
	}
	if ct := columnType(t, db, "combos", "drive_gauge_consumed"); ct != "REAL" {
		t.Errorf("drive_gauge_consumed column type = %q, want REAL", ct)
	}

	// 2) 既存 seed 行(000012 durability seed)は新列が NULL であること。
	var nullCount int
	if err := db.QueryRow(
		"SELECT COUNT(*) FROM combos WHERE sa_gauge_consumed IS NULL AND drive_gauge_consumed IS NULL",
	).Scan(&nullCount); err != nil {
		t.Fatalf("count null: %v", err)
	}
	var total int
	if err := db.QueryRow("SELECT COUNT(*) FROM combos").Scan(&total); err != nil {
		t.Fatalf("count total: %v", err)
	}
	if nullCount != total {
		t.Errorf("existing rows should have NULL consumed columns: null=%d total=%d", nullCount, total)
	}

	// 3) SA 消費(整数・上限 6)・drive 消費(小数・0.5 刻み)の round-trip(character_id=1 はリュウ seed)。
	res, err := db.Exec(
		"INSERT INTO combos (character_id, sa_gauge_consumed, drive_gauge_consumed) VALUES (1, ?, ?)",
		6, 3.5,
	)
	if err != nil {
		t.Fatalf("insert consumed: %v", err)
	}
	id, _ := res.LastInsertId()
	var gotSA int
	var gotDrive float64
	if err := db.QueryRow(
		"SELECT sa_gauge_consumed, drive_gauge_consumed FROM combos WHERE id = ?", id,
	).Scan(&gotSA, &gotDrive); err != nil {
		t.Fatalf("select consumed id=%d: %v", id, err)
	}
	if gotSA != 6 {
		t.Errorf("round-trip sa_gauge_consumed = %d, want 6", gotSA)
	}
	if gotDrive != 3.5 {
		t.Errorf("round-trip drive_gauge_consumed = %g, want 3.5", gotDrive)
	}
}

// M17-01(000031): combos にメディア 3 列(link/video_path/image_path)が TEXT・NULL 可で
// 追加され、既存行は NULL のまま、値の round-trip ができること。
func TestRun_ComboMediaColumnsAdded(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "test.db")
	if err := migration.Run(context.Background(), dbPath, tacpendium.MigrationsFS); err != nil {
		t.Fatalf("Run: %v", err)
	}
	db := openTestDB(t, dbPath)

	// 1) 3 列が存在し宣言型が TEXT であること。
	cols := readTableColumns(t, db, "combos")
	for _, col := range []string{"link", "video_path", "image_path"} {
		if !cols[col] {
			t.Errorf("combos.%s not found after up", col)
		}
		if ct := columnType(t, db, "combos", col); ct != "TEXT" {
			t.Errorf("%s column type = %q, want TEXT", col, ct)
		}
	}

	// 2) 既存行は 3 列とも NULL であること(backfill しない)。
	var nullCount, total int
	if err := db.QueryRow(
		"SELECT COUNT(*) FROM combos WHERE link IS NULL AND video_path IS NULL AND image_path IS NULL",
	).Scan(&nullCount); err != nil {
		t.Fatalf("count null: %v", err)
	}
	if err := db.QueryRow("SELECT COUNT(*) FROM combos").Scan(&total); err != nil {
		t.Fatalf("count total: %v", err)
	}
	if nullCount != total {
		t.Errorf("existing rows should have NULL media columns: null=%d total=%d", nullCount, total)
	}

	// 3) 文字列 round-trip(verbatim・解決や書換をしない)。
	res, err := db.Exec(
		"INSERT INTO combos (character_id, link, video_path, image_path) VALUES (1, ?, ?, ?)",
		"https://example.com/guide", "videos/ryu-bnb.mp4", "images/ryu-bnb.png",
	)
	if err != nil {
		t.Fatalf("insert media: %v", err)
	}
	id, _ := res.LastInsertId()
	var gotLink, gotVideo, gotImage string
	if err := db.QueryRow(
		"SELECT link, video_path, image_path FROM combos WHERE id = ?", id,
	).Scan(&gotLink, &gotVideo, &gotImage); err != nil {
		t.Fatalf("select media id=%d: %v", id, err)
	}
	if gotLink != "https://example.com/guide" || gotVideo != "videos/ryu-bnb.mp4" || gotImage != "images/ryu-bnb.png" {
		t.Errorf("round-trip mismatch: link=%q video=%q image=%q", gotLink, gotVideo, gotImage)
	}
}

func TestRun_PresetsCodeColumn(t *testing.T) {
	// CHANGE-007 検証: presets テーブルに code カラムが存在し、UNIQUE 制約が効くこと。
	dbPath := filepath.Join(t.TempDir(), "test.db")
	if err := migration.Run(context.Background(), dbPath, tacpendium.MigrationsFS); err != nil {
		t.Fatalf("Run: %v", err)
	}
	db := openTestDB(t, dbPath)

	cols := readTableColumns(t, db, "presets")
	if !cols["code"] {
		t.Error("expected presets.code column to exist (CHANGE-007)")
	}
	if !cols["name"] {
		t.Error("expected presets.name column to exist")
	}
	if cols["name_ja"] || cols["name_en"] {
		t.Error("presets should not have name_ja/name_en after v1.3.0 cleanup (single name column)")
	}

	// UNIQUE 制約検証: 同一 code を 2 回 INSERT すると失敗する
	_, err := db.Exec(
		"INSERT INTO presets (user_id, code, name, base_preset_code, is_builtin) VALUES (NULL, ?, ?, NULL, 1)",
		"official_ja_move", "duplicate test",
	)
	if err == nil {
		t.Error("expected UNIQUE violation when inserting duplicate code, got nil")
	}
}

func TestRun_MovesNoNameColumns(t *testing.T) {
	// 設計担当補正検証: moves テーブルに name_ja/name_en は存在しない(DES-003 §3.3)。
	dbPath := filepath.Join(t.TempDir(), "test.db")
	if err := migration.Run(context.Background(), dbPath, tacpendium.MigrationsFS); err != nil {
		t.Fatalf("Run: %v", err)
	}
	db := openTestDB(t, dbPath)
	cols := readTableColumns(t, db, "moves")

	if cols["name_ja"] || cols["name_en"] {
		t.Error("moves should not have name_ja/name_en columns; technique names are managed via preset_aliases (DES-004 §1.2)")
	}
}

func TestRun_MovesFrameColumnsExist(t *testing.T) {
	// M8-01 検証: moves にフレームデータ8列が加算的に追加されていること(CHANGE-022/025、DES-003 §3.3)。
	dbPath := filepath.Join(t.TempDir(), "test.db")
	if err := migration.Run(context.Background(), dbPath, tacpendium.MigrationsFS); err != nil {
		t.Fatalf("Run: %v", err)
	}
	db := openTestDB(t, dbPath)
	cols := readTableColumns(t, db, "moves")

	// M14-01(000018): drive_gauge_decrease_guard は HEAD で削除済みのため、ここでは温存される
	// フレーム列のみを確認する(削除6列の不在は TestRun_Migration000018_SchemaCleanup で検証)。
	wantCols := []string{
		"startup", "active", "total", "on_hit", "on_block",
		"is_aerial", "setup_only",
	}
	for _, name := range wantCols {
		if !cols[name] {
			t.Errorf("expected moves.%s column to exist (M8-01)", name)
		}
	}

	// 既存 seed 行(リュウ等)で nullable 6列が NULL、bool 2列が 0(false)で補完されていること。
	var nullStartups int
	if err := db.QueryRow("SELECT count(*) FROM moves WHERE startup IS NULL").Scan(&nullStartups); err != nil {
		t.Fatalf("count null startup: %v", err)
	}
	if nullStartups == 0 {
		t.Error("expected existing seed moves to have NULL startup (no backfill, CHANGE-025)")
	}

	var nonFalseBool int
	if err := db.QueryRow("SELECT count(*) FROM moves WHERE is_aerial NOT IN (0,1) OR setup_only NOT IN (0,1)").Scan(&nonFalseBool); err != nil {
		t.Fatalf("count bool: %v", err)
	}
	if nonFalseBool != 0 {
		t.Errorf("is_aerial / setup_only must be 0/1 for all rows, got %d invalid", nonFalseBool)
	}

	var defaultedFalse int
	if err := db.QueryRow("SELECT count(*) FROM moves WHERE is_aerial = 0 AND setup_only = 0").Scan(&defaultedFalse); err != nil {
		t.Fatalf("count defaulted false: %v", err)
	}
	if defaultedFalse == 0 {
		t.Error("expected existing seed moves to be defaulted is_aerial=0 / setup_only=0")
	}
}

func TestRun_SeedRowCounts(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "test.db")
	if err := migration.Run(context.Background(), dbPath, tacpendium.MigrationsFS); err != nil {
		t.Fatalf("Run: %v", err)
	}
	db := openTestDB(t, dbPath)

	cases := []struct {
		query   string
		min     int
		exact   int // 0 なら min のみ確認
		message string
	}{
		{"SELECT count(*) FROM games", 1, 1, "games (sf6)"},
		{"SELECT count(*) FROM games WHERE code='sf6'", 1, 1, "games sf6 by code"},
		// M12-05(000017): aki/jamie/guile を除去 → ryu + classic5 = 5。
		// M14-03b(000024): 第一波 7 キャラ(terry/guile/lily/kimberly/juri/mai/zangief)を追加 → 12。
		// M14-03d(000043): 第二波 manon を追加 → 13。
		// M14-03e(000053): 第三波 6 キャラを追加 → 19。
		// M14-03f(000082): 第四波 12 キャラを追加 → 31(全ロースター充足)。
		{"SELECT count(*) FROM characters", 31, 31, "characters (19 + 000082 第四波 12)"},
		{"SELECT count(*) FROM characters WHERE code='ryu'", 1, 1, "characters ryu by code"},
		// M12-05(000017)で aki/jamie/guile を除去後、guile は 000024、jamie は 000053 で再追加。
		// ★aki は 000082(第四波)で再追加された。⇒ 3 体そろう。
		{"SELECT count(*) FROM characters WHERE code IN ('aki','jamie','guile')", 3, 3, "aki も 000082 で再追加され 3 体そろう"},
		// M9-02(000014): classic 5 体の追加分(ryu は 000003 で既存のため対象外の 4 体)
		{"SELECT count(*) FROM characters WHERE code IN ('ken','ingrid','c_viper','dhalsim')", 4, 4, "characters classic5 additions (M9-02)"},
		// M12-05(000017)で両者の旧 custom_states は消え、000053 で再追加した jamie も NULL のまま。
		{"SELECT count(*) FROM characters WHERE custom_states IS NOT NULL AND custom_states != '' AND code IN ('aki','jamie')", 0, 0, "aki absent; re-added jamie has no custom_states"},
		{"SELECT count(*) FROM characters WHERE code IN ('aki','jamie') AND json_valid(custom_states)", 0, 0, "aki absent; re-added jamie has NULL custom_states"},
		// M12-05(000017)で guile を除去したが、M14-03b(000024)で第一波として再追加した。
		{"SELECT count(*) FROM characters WHERE code='guile'", 1, 1, "guile re-added in 000024 (first-wave)"},
		// M11-01(000015): 先行リリース3体の custom_states 定義投入。
		{"SELECT count(*) FROM characters WHERE code='ryu' AND json_extract(custom_states,'$.states[0].code')='denjin_charge'", 1, 1, "ryu custom_states = denjin_charge"},
		{"SELECT count(*) FROM characters WHERE code='ryu' AND json_extract(custom_states,'$.states[0].type')='flag'", 1, 1, "ryu denjin_charge type = flag"},
		{"SELECT count(*) FROM characters WHERE code='ingrid' AND json_extract(custom_states,'$.states[0].code')='sun_crest' AND json_extract(custom_states,'$.states[0].value_definition.min')=0 AND json_extract(custom_states,'$.states[0].value_definition.max')=4", 1, 1, "ingrid sun_crest (min0/max4)"},
		{"SELECT count(*) FROM characters WHERE code='c_viper' AND json_extract(custom_states,'$.states[0].code')='limit_decoupler'", 1, 1, "c_viper custom_states = limit_decoupler"},
		{"SELECT count(*) FROM characters WHERE code IN ('ryu','ingrid','c_viper') AND json_valid(custom_states)", 3, 3, "classic3 custom_states valid JSON"},
		// M12-05(000017)の ajg 除去後、M14-03 系の seed 波が順次 moves を追加している。
		{"SELECT count(*) FROM moves", 30, 0, "moves >= 30 (ryu seed only after ajg removal)"},
		{"SELECT count(*) FROM moves WHERE category='special'", 1, 0, "specials >= 1"},
		// M12-05(000017)で ryu の super_art 3 件のみになったが、M14-03b(000026)で第一波 9 キャラ分が
		// 加わる(件数は 000026 golden テストで固定)。ここでは下限のみ確認する。
		{"SELECT count(*) FROM moves WHERE category='super_art'", 3, 0, "super_art >= 3 (ryu + 第一波)"},
		{"SELECT count(*) FROM moves WHERE category='rush_variant'", 1, 0, "Ryu rush variants >= 1"},
		// M20-01(000069): 組み込みプリセットを 5 種 → 3 種へ整理した(D-288 / D-299 / D-300)。
		// ★本テストは HEAD スコープ(migration.Run で全適用)であり、期待値の更新が
		// 正しい対応である(SUPP-001 §5.5.2 (2))。本サブの契約は migrate_m2001_test.go が持つ。
		{"SELECT count(*) FROM presets", 3, 3, "presets = 3 (M20-01 で 5 → 3)"},
		{"SELECT count(*) FROM presets WHERE is_builtin=1", 3, 3, "builtin presets = 3 (残る 3 行はすべて組み込み)"},
		{"SELECT count(*) FROM preset_aliases", 30, 0, "preset_aliases >= 30"},
		{`SELECT count(*) FROM preset_aliases WHERE preset_id IN
		    (SELECT id FROM presets WHERE code='official_ja_move')`, 30, 0, "official_ja_move alias count >= 30"},
		// ★M20-02(000072/000073)で numeric / srk にも実データが入った。
		//   旧版は {min:0, exact:0} で「0 件」を主張していたつもりだったが、下のループは
		//   exact==0 を「min のみ確認」の signal に使うため n >= 0 となり、
		//   ★どんな値でも PASS する空振りアサーションだった(M20-02 レビュー H-1)。
		//   ⇒ 厳密一致へ作り替える。本テストは HEAD スコープであり、期待値の更新が
		//     正しい対応である(SUPP-001 §5.5.2 (2))。本サブの契約は migrate_m2002_test.go が持つ。
		//
		// ★この表に「0 件」を期待する行を足すときは exact を使えない(0 は signal と衝突する)。
		//   0 を主張したい場合は本ループを使わず個別に書くこと。
		// ★M20-06(000076/000077)が層 C-3 の 13 code を両プリセットへ足した(D-373)。
		//   1245 + 13 = 1258 / 1260 + 13 = 1273。同サブの契約は migrate_m2006_test.go が持つ。
		// ★M14-03f(000090/000091)が第四波 14 キャラ分を足した。
		//   numeric 1258 + 1014 = 2272 / srk 1273 + 1027 = 2300。
		//   内訳(numeric): キャラ別 906 + 移動系 9 code × 新 12 キャラ = 108。
		//   ★c_viper / dhalsim の移動系 18 行は 000072/000073 由来であり本波では増えない。
		//   本サブの契約は migrate_m1403f_test.go が持つ。
		// ★★M35-03 が golden 000072/000073 を再生成し、両プリセットへ 4 件ずつ足した
		//   (CSV の original_move_code の dangling を是正し、元技を解決できるように
		//   なった rush 4 件＝ingrid 2 / lily 1 / mai 1)。
		//   numeric 2272 + 4 = 2276 / srk 2300 + 4 = 2304。
		//   ★本サブの契約は migrate_m2002_test.go(v72/v73)と migrate_m3503_test.go(v111)が
		//     持つ。ここは HEAD スコープなので期待値の更新が正しい対応である
		//     (SUPP-001 §5.5.2 (2))。
		{`SELECT count(*) FROM preset_aliases WHERE preset_id IN
		    (SELECT id FROM presets WHERE code='numeric')`, 2275, 2275, "numeric alias count = 2275 (M20 期の 1258 + M14-03f の 1014 + M35-03 の 4)"}, // ★M37-04 追補2 で 2276 -> 2275(soaring_eagle_punches が索引から外れた分)
		{`SELECT count(*) FROM preset_aliases WHERE preset_id IN
		    (SELECT id FROM presets WHERE code='srk')`, 2303, 2303, "srk alias count = 2303 (M20 期の 1273 + M14-03f の 1027 + M35-03 の 4)"}, // ★M37-04 追補2 で 2304 -> 2303(同上)
		// M12-05(000017): 耐久テスト用 seed(000012 由来 36 件)は ajg 除去に内包され 0 件。
		// ajg characters が消えるため character_id サブクエリは空集合になり combos も 0。
		{"SELECT count(*) FROM combos", 0, 0, "no seed combos remain (durability removed in 000017)"},
	}

	for _, c := range cases {
		var n int
		if err := db.QueryRow(c.query).Scan(&n); err != nil {
			t.Errorf("%s: query failed: %v", c.message, err)
			continue
		}
		if c.exact != 0 {
			if n != c.exact {
				t.Errorf("%s: got %d, want exact %d", c.message, n, c.exact)
			}
		} else {
			if n < c.min {
				t.Errorf("%s: got %d, want >= %d", c.message, n, c.min)
			}
		}
	}
}

func TestRun_RushVariantOriginalMoveID(t *testing.T) {
	// ラッシュ版が original_move_id で元技を参照していることを確認。
	dbPath := filepath.Join(t.TempDir(), "test.db")
	if err := migration.Run(context.Background(), dbPath, tacpendium.MigrationsFS); err != nil {
		t.Fatalf("Run: %v", err)
	}
	db := openTestDB(t, dbPath)

	// M12-05(000017): ryu の code を新形へ統一済み(rush_stand_* → rush_standing_*、
	// 元技 stand_medium_punch → standing_medium_punch)。original_move_id 参照は数値のため不変。
	var origCode string
	err := db.QueryRow(`
		SELECT base.code
		FROM moves rush
		JOIN moves base ON rush.original_move_id = base.id
		WHERE rush.code = 'rush_standing_medium_punch'
	`).Scan(&origCode)
	if err != nil {
		t.Fatalf("rush variant lookup: %v", err)
	}
	if origCode != "standing_medium_punch" {
		t.Errorf("rush_standing_medium_punch original = %q, want standing_medium_punch", origCode)
	}
}

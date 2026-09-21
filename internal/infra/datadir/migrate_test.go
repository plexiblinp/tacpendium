package datadir_test

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/plexiblinp/tacpendium/internal/infra/datadir"
	"github.com/plexiblinp/tacpendium/internal/infra/db"
)

const (
	oldDBName = "combomgr.db"
	newDBName = "tacpendium.db"
)

var fixedNow = time.Date(2026, 9, 5, 12, 0, 0, 0, time.UTC)

// newParams は t.TempDir() 配下に旧・新の組を用意した Params を返す。
// ★XDG_DATA_HOME 経由にはしない。OS 既定の解決は別の 1 本で確かめる。
func newParams(t *testing.T) (p datadir.Params, root, oldDir, newDir string) {
	t.Helper()
	root = t.TempDir()
	oldDir = filepath.Join(root, "combomgr")
	newDir = filepath.Join(root, "tacpendium")
	return datadir.Params{
		OldDir:    oldDir,
		NewDir:    newDir,
		OldDBName: oldDBName,
		NewDBName: newDBName,
		Now:       fixedNow,
	}, root, oldDir, newDir
}

// seedDB は dir/name に実 DB を作り、テーブル 3 本と行を入れて閉じる。
func seedDB(t *testing.T, dir, name string, combos int) {
	t.Helper()
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatalf("mkdir %s: %v", dir, err)
	}
	conn, err := db.Open(filepath.Join(dir, name))
	if err != nil {
		t.Fatalf("open seed db: %v", err)
	}
	stmts := []string{
		`CREATE TABLE combos (id INTEGER PRIMARY KEY, name TEXT)`,
		`CREATE TABLE tags (id INTEGER PRIMARY KEY, label TEXT)`,
		`CREATE TABLE schema_migrations (version INTEGER, dirty BOOLEAN)`,
		`INSERT INTO schema_migrations VALUES (102, 0)`,
		`INSERT INTO tags VALUES (1, 'punish'), (2, 'corner')`,
		`PRAGMA user_version = 7`,
	}
	for _, s := range stmts {
		if _, err := conn.Exec(s); err != nil {
			t.Fatalf("seed exec %q: %v", s, err)
		}
	}
	for i := 1; i <= combos; i++ {
		if _, err := conn.Exec(`INSERT INTO combos VALUES (?, ?)`, i, fmt.Sprintf("combo-%d", i)); err != nil {
			t.Fatalf("seed insert: %v", err)
		}
	}
	if err := conn.Close(); err != nil {
		t.Fatalf("close seed db: %v", err)
	}
}

// seedEmptyDB は「マイグレーションだけ当たった直後」の DB を作る。
// テーブルはあるが利用者のデータは 1 行も無く、schema_migrations にだけ版が入っている。
//
// ★seedDB(…, 0) では作れない —— あちらは tags を必ず 2 行入れる。
// 「空の新 DB」は危険形の判定の要であり、フィクスチャが空でないと判定を試せない。
func seedEmptyDB(t *testing.T, dir, name string) {
	t.Helper()
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatalf("mkdir %s: %v", dir, err)
	}
	conn, err := db.Open(filepath.Join(dir, name))
	if err != nil {
		t.Fatalf("open empty db: %v", err)
	}
	for _, stmt := range []string{
		`CREATE TABLE combos (id INTEGER PRIMARY KEY, name TEXT)`,
		`CREATE TABLE tags (id INTEGER PRIMARY KEY, label TEXT)`,
		`CREATE TABLE schema_migrations (version INTEGER, dirty BOOLEAN)`,
		`INSERT INTO schema_migrations VALUES (102, 0)`,
		`PRAGMA user_version = 7`,
	} {
		if _, err := conn.Exec(stmt); err != nil {
			t.Fatalf("seed empty exec %q: %v", stmt, err)
		}
	}
	if err := conn.Close(); err != nil {
		t.Fatalf("close empty db: %v", err)
	}
}

func rowCount(t *testing.T, dbPath, table string) int64 {
	t.Helper()
	conn, err := db.Open(dbPath)
	if err != nil {
		t.Fatalf("open %s: %v", dbPath, err)
	}
	defer func() { _ = conn.Close() }()
	var n int64
	if err := conn.QueryRow(`SELECT count(*) FROM ` + table).Scan(&n); err != nil {
		t.Fatalf("count %s in %s: %v", table, dbPath, err)
	}
	return n
}

func sha256File(t *testing.T, path string) string {
	t.Helper()
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}

func mustNotExist(t *testing.T, path, why string) {
	t.Helper()
	if _, err := os.Lstat(path); err == nil {
		t.Errorf("%s: %s が存在してはならない", why, path)
	} else if !os.IsNotExist(err) {
		t.Errorf("%s: lstat %s: %v", why, path, err)
	}
}

// noStagingLeft は作業ディレクトリとロックが残っていないことを確かめる。
func noStagingLeft(t *testing.T, root, oldDir string) {
	t.Helper()
	entries, err := os.ReadDir(root)
	if err != nil {
		t.Fatalf("readdir %s: %v", root, err)
	}
	for _, e := range entries {
		if strings.HasPrefix(e.Name(), "tacpendium.migrating-") {
			t.Errorf("作業ディレクトリが残っている: %s", e.Name())
		}
	}
	mustNotExist(t, filepath.Join(oldDir, ".migrating.lock"), "ロックが残っている")
}

// ---------------------------------------------------------------------------
// 経路 (a) 旧が在って新が無い
// ---------------------------------------------------------------------------

func TestMigrate_A_OldOnly(t *testing.T) {
	p, root, oldDir, newDir := newParams(t)
	seedDB(t, oldDir, oldDBName, 3)
	if err := os.WriteFile(filepath.Join(oldDir, "notes.txt"), []byte("hello"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(oldDir, "sub"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(oldDir, "sub", "a.txt"), []byte("nested"), 0o644); err != nil {
		t.Fatal(err)
	}

	res := datadir.Migrate(p)
	if res.Status != datadir.StatusMigrated {
		t.Fatalf("Status = %q (%v), want migrated", res.Status, res.Err)
	}

	newDB := filepath.Join(newDir, newDBName)
	if got := rowCount(t, newDB, "combos"); got != 3 {
		t.Errorf("combos = %d, want 3", got)
	}
	if got := rowCount(t, newDB, "tags"); got != 2 {
		t.Errorf("tags = %d, want 2", got)
	}
	if got := rowCount(t, newDB, "schema_migrations"); got != 1 {
		t.Errorf("schema_migrations = %d, want 1 (版が失われるとマイグレーションが全部やり直しになる)", got)
	}
	if got, err := os.ReadFile(filepath.Join(newDir, "sub", "a.txt")); err != nil || string(got) != "nested" {
		t.Errorf("入れ子のファイルが運ばれていない: %v / %q", err, got)
	}

	// 指示書 §2.3-3: WAL / SHM を取り残さない。
	// rowCount が db.Open するので、その後も残らないことまでは見ない(Migrate 直後の
	// 状態は populateStaging 内で確認済み)。ここでは移行元側を見る。
	mustNotExist(t, filepath.Join(oldDir, oldDBName+"-wal"), "移行元 WAL")
	mustNotExist(t, filepath.Join(oldDir, oldDBName+"-shm"), "移行元 SHM")

	// 退避はまだ行われていない(Migrate の責務ではない)。
	if _, err := os.Stat(oldDir); err != nil {
		t.Fatalf("Migrate の時点で旧が消えている: %v", err)
	}

	if err := datadir.RetireOld(&res, fixedNow); err != nil {
		t.Fatalf("RetireOld: %v", err)
	}
	retired := oldDir + ".migrated-20260905"
	if res.RetiredDir != retired {
		t.Errorf("RetiredDir = %q, want %q", res.RetiredDir, retired)
	}
	mustNotExist(t, oldDir, "退避後の旧ディレクトリ")
	// ★退避先の DB が「開ける」ことまで見る。stat だけでは中身の無事は分からない。
	if got := rowCount(t, filepath.Join(retired, oldDBName), "combos"); got != 3 {
		t.Errorf("退避先の combos = %d, want 3", got)
	}
	noStagingLeft(t, root, retired)
}

// (a2) WAL にしかコミットが無い状態から移行できるか。
//
// ★★これが「DB 本体をバイトコピーする」実装を落とすテストである。
// wal_checkpoint を回さずに .db だけ運ぶと、この 2 行は移行先に現れない。
func TestMigrate_A2_CommitsOnlyInWAL(t *testing.T) {
	p, _, oldDir, newDir := newParams(t)
	seedDB(t, oldDir, oldDBName, 1)

	// checkpoint されない状態で追加コミットを作るため、接続を開いたまま WAL へ書き、
	// ファイルを別ディレクトリへ写し取ってから閉じる。
	conn, err := db.Open(filepath.Join(oldDir, oldDBName))
	if err != nil {
		t.Fatal(err)
	}
	for i := 2; i <= 3; i++ {
		if _, err := conn.Exec(`INSERT INTO combos VALUES (?, ?)`, i, fmt.Sprintf("wal-%d", i)); err != nil {
			t.Fatal(err)
		}
	}
	walPath := filepath.Join(oldDir, oldDBName+"-wal")
	if fi, statErr := os.Stat(walPath); statErr != nil || fi.Size() == 0 {
		_ = conn.Close()
		t.Skipf("この環境では WAL に未 checkpoint のフレームが残らなかった: %v", statErr)
	}
	if err := conn.Close(); err != nil {
		t.Fatal(err)
	}

	res := datadir.Migrate(p)
	if res.Status != datadir.StatusMigrated {
		t.Fatalf("Status = %q (%v), want migrated", res.Status, res.Err)
	}
	if got := rowCount(t, filepath.Join(newDir, newDBName), "combos"); got != 3 {
		t.Errorf("combos = %d, want 3 —— WAL にしか無かったコミットが落ちている", got)
	}
}

// ---------------------------------------------------------------------------
// 経路 (b) 新旧の両方が在る
// ---------------------------------------------------------------------------

func TestMigrate_B_BothExist(t *testing.T) {
	p, root, oldDir, newDir := newParams(t)
	seedDB(t, oldDir, oldDBName, 3)
	seedDB(t, newDir, newDBName, 9)

	oldSum := sha256File(t, filepath.Join(oldDir, oldDBName))
	newSum := sha256File(t, filepath.Join(newDir, newDBName))

	res := datadir.Migrate(p)
	if res.Status != datadir.StatusSkipped {
		t.Fatalf("Status = %q (%v), want skipped", res.Status, res.Err)
	}
	if res.Reason != datadir.ReasonNewDBExists {
		t.Errorf("Reason = %q, want new_db_exists", res.Reason)
	}
	if res.Message == "" {
		t.Error("経路 b は黙って飛ばしてはならない。理由が要る")
	}
	if got := sha256File(t, filepath.Join(oldDir, oldDBName)); got != oldSum {
		t.Error("旧 DB が変わっている")
	}
	if got := sha256File(t, filepath.Join(newDir, newDBName)); got != newSum {
		t.Error("新 DB が変わっている")
	}
	if _, err := os.Stat(oldDir); err != nil {
		t.Errorf("旧ディレクトリが退避されている: %v", err)
	}
	noStagingLeft(t, root, oldDir)
}

// (b2) 新ディレクトリは在るが DB が無い場合は移行する。
//
// ★★これが「新が空でなければ skip」実装を落とすテストである。
// applog.Init / migration.Run / db.Open はいずれも親ディレクトリを MkdirAll するため、
// 「存在するが DB は無い」は普通に起こる。そこで skip すると利用者のデータが取り残される。
func TestMigrate_B2_NewDirExistsButNoDB(t *testing.T) {
	p, _, oldDir, newDir := newParams(t)
	seedDB(t, oldDir, oldDBName, 4)
	if err := os.MkdirAll(filepath.Join(newDir, "logs"), 0o755); err != nil {
		t.Fatal(err)
	}

	res := datadir.Migrate(p)
	if res.Status != datadir.StatusMigrated {
		t.Fatalf("Status = %q (%v), want migrated —— 新ディレクトリが空でないことを理由に飛ばしてはならない", res.Status, res.Err)
	}
	if got := rowCount(t, filepath.Join(newDir, newDBName), "combos"); got != 4 {
		t.Errorf("combos = %d, want 4", got)
	}
}

// ---------------------------------------------------------------------------
// 経路 (c) 旧が無い
// ---------------------------------------------------------------------------

func TestMigrate_C_NoLegacyDir(t *testing.T) {
	p, root, oldDir, newDir := newParams(t)

	res := datadir.Migrate(p)
	if res.Status != datadir.StatusSkipped {
		t.Fatalf("Status = %q (%v), want skipped", res.Status, res.Err)
	}
	if res.Reason != datadir.ReasonNoLegacyDir {
		t.Errorf("Reason = %q, want no_legacy_dir", res.Reason)
	}
	// ★移行先を作るのは db.Open の仕事であって移行の仕事ではない。
	mustNotExist(t, newDir, "経路 c で移行先が作られた")
	noStagingLeft(t, root, oldDir)
}

func TestMigrate_C_LegacyDirWithoutDB(t *testing.T) {
	p, _, oldDir, _ := newParams(t)
	if err := os.MkdirAll(oldDir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(oldDir, "stray.txt"), []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}

	res := datadir.Migrate(p)
	if res.Status != datadir.StatusSkipped || res.Reason != datadir.ReasonNoLegacyDB {
		t.Fatalf("Status/Reason = %q/%q, want skipped/no_legacy_db", res.Status, res.Reason)
	}
}

// ---------------------------------------------------------------------------
// 経路 (d) 検証に失敗する —— 本サブで最も重要な 1 本
// ---------------------------------------------------------------------------

// assertNothingMoved は「何も動かさずに止まった」ことを確かめる。
//
// ★sha256 で比べられるのは、移行元に未 checkpoint の WAL フレームが無い場合だけである。
// 残っている場合は checkpointWAL が旧 DB へ書き戻すのでバイト列は変わる。
// ⇒ その経路は (d3) が受け持ち、バイト列ではなく行数で「使える状態で残っている」ことを見る。
func assertNothingMoved(t *testing.T, root, oldDir, newDir, oldSumBefore string, combosBefore int64) {
	t.Helper()
	if _, err := os.Stat(oldDir); err != nil {
		t.Fatalf("旧ディレクトリが消えている: %v", err)
	}
	entries, err := os.ReadDir(root)
	if err != nil {
		t.Fatal(err)
	}
	for _, e := range entries {
		if strings.Contains(e.Name(), ".migrated-") {
			t.Errorf("退避が行われている: %s", e.Name())
		}
	}
	if got := sha256File(t, filepath.Join(oldDir, oldDBName)); got != oldSumBefore {
		t.Error("旧 DB が 1 バイトでも変わっている")
	}
	if got := rowCount(t, filepath.Join(oldDir, oldDBName), "combos"); got != combosBefore {
		t.Errorf("旧 DB の combos = %d, want %d —— 旧が使えなくなっている", got, combosBefore)
	}
	mustNotExist(t, newDir, "移行先")
	noStagingLeft(t, root, oldDir)
}

// (d1) 行数が食い違う。★「開ければ通る」実装ではなく、行数の比較そのものを試す。
func TestMigrate_D1_RowCountMismatch_MovesNothing(t *testing.T) {
	p, root, oldDir, newDir := newParams(t)
	seedDB(t, oldDir, oldDBName, 3)
	oldSum := sha256File(t, filepath.Join(oldDir, oldDBName))

	// 「妥当な DB だが 1 行足りない」コピーを作る。
	p.CopyDB = func(src, dst string) error {
		srcConn, err := db.Open(src)
		if err != nil {
			return err
		}
		if _, err := srcConn.Exec(`VACUUM INTO '` + dst + `'`); err != nil {
			_ = srcConn.Close()
			return err
		}
		if err := srcConn.Close(); err != nil {
			return err
		}
		dstConn, err := db.Open(dst)
		if err != nil {
			return err
		}
		if _, err := dstConn.Exec(`DELETE FROM combos WHERE id = 1`); err != nil {
			_ = dstConn.Close()
			return err
		}
		return dstConn.Close()
	}

	res := datadir.Migrate(p)
	if res.Status != datadir.StatusFailed {
		t.Fatalf("Status = %q, want failed —— 行数の食い違いを見逃している", res.Status)
	}
	var mismatch *datadir.MismatchError
	if !errors.As(res.Err, &mismatch) {
		t.Fatalf("Err = %v, want *MismatchError", res.Err)
	}
	if mismatch.Table != "combos" || mismatch.Old != 3 || mismatch.New != 2 {
		t.Errorf("MismatchError = %+v, want {combos 3 2}", *mismatch)
	}
	if res.Message == "" {
		t.Error("利用者へ出す理由が空である")
	}
	assertNothingMoved(t, root, oldDir, newDir, oldSum, 3)
}

// (d2) コピーが壊れている。
func TestMigrate_D2_CorruptCopy_MovesNothing(t *testing.T) {
	p, root, oldDir, newDir := newParams(t)
	seedDB(t, oldDir, oldDBName, 3)
	oldSum := sha256File(t, filepath.Join(oldDir, oldDBName))

	p.CopyDB = func(src, dst string) error {
		srcConn, err := db.Open(src)
		if err != nil {
			return err
		}
		if _, err := srcConn.Exec(`VACUUM INTO '` + dst + `'`); err != nil {
			_ = srcConn.Close()
			return err
		}
		if err := srcConn.Close(); err != nil {
			return err
		}
		f, err := os.OpenFile(dst, os.O_WRONLY, 0o600)
		if err != nil {
			return err
		}
		if _, err := f.WriteAt([]byte(strings.Repeat("\x00", 512)), 4096); err != nil {
			_ = f.Close()
			return err
		}
		return f.Close()
	}

	res := datadir.Migrate(p)
	if res.Status != datadir.StatusFailed {
		t.Fatalf("Status = %q, want failed —— 壊れたコピーを通している", res.Status)
	}
	assertNothingMoved(t, root, oldDir, newDir, oldSum, 3)
}

// ---------------------------------------------------------------------------
// ロック(二重起動)と中断
// ---------------------------------------------------------------------------

func TestMigrate_LockHeldByLiveInstance(t *testing.T) {
	p, root, oldDir, newDir := newParams(t)
	seedDB(t, oldDir, oldDBName, 2)
	oldSum := sha256File(t, filepath.Join(oldDir, oldDBName))

	lock := filepath.Join(oldDir, ".migrating.lock")
	if err := os.WriteFile(lock, []byte(`{"pid":1}`), 0o600); err != nil {
		t.Fatal(err)
	}

	res := datadir.Migrate(p)
	if res.Status != datadir.StatusBlocked {
		t.Fatalf("Status = %q, want blocked", res.Status)
	}
	if !res.Fatal() {
		t.Error("別プロセスが移行中のときは起動を止めるべきである(旧を 2 系統から書くと片方が見えなくなる)")
	}
	if _, err := os.Stat(oldDir); err != nil {
		t.Fatalf("旧が動いている: %v", err)
	}
	if got := sha256File(t, filepath.Join(oldDir, oldDBName)); got != oldSum {
		t.Error("旧 DB が変わっている")
	}
	mustNotExist(t, newDir, "移行先")
	// ロックは他プロセスのものなので消さない。
	if _, err := os.Stat(lock); err != nil {
		t.Error("他プロセスのロックを消してしまっている")
	}
	entries, _ := os.ReadDir(root)
	for _, e := range entries {
		if strings.HasPrefix(e.Name(), "tacpendium.migrating-") {
			t.Errorf("作業ディレクトリを作ってしまっている: %s", e.Name())
		}
	}
}

// ★中断で永久に起動できなくならないこと。期限切れのロックは取り除いて進む。
func TestMigrate_StaleLockIsReclaimed(t *testing.T) {
	p, _, oldDir, newDir := newParams(t)
	seedDB(t, oldDir, oldDBName, 2)

	lock := filepath.Join(oldDir, ".migrating.lock")
	if err := os.WriteFile(lock, []byte(`{"pid":1}`), 0o600); err != nil {
		t.Fatal(err)
	}
	// ★寿命は実時計で測られるので、テストも実時計基準で古くする。
	stale := time.Now().Add(-2 * time.Hour)
	if err := os.Chtimes(lock, stale, stale); err != nil {
		t.Fatal(err)
	}

	res := datadir.Migrate(p)
	if res.Status != datadir.StatusMigrated {
		t.Fatalf("Status = %q (%v), want migrated —— 期限切れのロックで永久に止まってはならない", res.Status, res.Err)
	}
	if got := rowCount(t, filepath.Join(newDir, newDBName), "combos"); got != 2 {
		t.Errorf("combos = %d, want 2", got)
	}
}

// ★中断で残った作業ディレクトリが積もらないこと。
func TestMigrate_StaleStagingIsSwept(t *testing.T) {
	p, root, oldDir, _ := newParams(t)
	seedDB(t, oldDir, oldDBName, 1)

	stale := filepath.Join(root, "tacpendium.migrating-abandoned")
	if err := os.MkdirAll(stale, 0o755); err != nil {
		t.Fatal(err)
	}
	old := time.Now().Add(-2 * time.Hour)
	if err := os.Chtimes(stale, old, old); err != nil {
		t.Fatal(err)
	}

	res := datadir.Migrate(p)
	if res.Status != datadir.StatusMigrated {
		t.Fatalf("Status = %q (%v), want migrated", res.Status, res.Err)
	}
	mustNotExist(t, stale, "放置された作業ディレクトリ")
}

// ---------------------------------------------------------------------------
// 退避
// ---------------------------------------------------------------------------

func TestRetireOld_DateCollisionKeepsBoth(t *testing.T) {
	p, _, oldDir, _ := newParams(t)
	seedDB(t, oldDir, oldDBName, 1)
	existing := oldDir + ".migrated-20260905"
	if err := os.MkdirAll(existing, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(existing, "marker"), []byte("previous"), 0o644); err != nil {
		t.Fatal(err)
	}

	res := datadir.Migrate(p)
	if res.Status != datadir.StatusMigrated {
		t.Fatalf("Status = %q (%v)", res.Status, res.Err)
	}
	if err := datadir.RetireOld(&res, fixedNow); err != nil {
		t.Fatalf("RetireOld: %v", err)
	}
	if res.RetiredDir == existing {
		t.Fatal("既存の退避先を上書きしている。旧を消さないという約束に反する")
	}
	if got, err := os.ReadFile(filepath.Join(existing, "marker")); err != nil || string(got) != "previous" {
		t.Errorf("先にあった退避先が失われている: %v / %q", err, got)
	}
	if _, err := os.Stat(filepath.Join(res.RetiredDir, oldDBName)); err != nil {
		t.Errorf("今回の退避先に DB が無い: %v", err)
	}
}

func TestRetireOld_SkippedResultDoesNothing(t *testing.T) {
	res := datadir.Result{Status: datadir.StatusSkipped}
	if err := datadir.RetireOld(&res, fixedNow); err != nil {
		t.Fatalf("RetireOld on skipped: %v", err)
	}
	if res.RetiredDir != "" {
		t.Errorf("RetiredDir = %q, want empty", res.RetiredDir)
	}
}

// ---------------------------------------------------------------------------
// 「壊したら赤くなる」ことを検証層そのもので見る
// ---------------------------------------------------------------------------

func openMem(t *testing.T, stmts ...string) *sql.DB {
	t.Helper()
	conn, err := db.Open(filepath.Join(t.TempDir(), "x.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = conn.Close() })
	for _, s := range stmts {
		if _, err := conn.Exec(s); err != nil {
			t.Fatalf("exec %q: %v", s, err)
		}
	}
	return conn
}

func TestVerify_DetectsRowCountMismatch(t *testing.T) {
	oldConn := openMem(t, `CREATE TABLE combos (id INTEGER)`, `INSERT INTO combos VALUES (1),(2),(3)`)
	newConn := openMem(t, `CREATE TABLE combos (id INTEGER)`, `INSERT INTO combos VALUES (1),(2)`)

	err := datadir.Verify(oldConn, newConn, []datadir.TableCount{{Table: "combos", Rows: 3}})
	var mismatch *datadir.MismatchError
	if !errors.As(err, &mismatch) {
		t.Fatalf("err = %v, want *MismatchError", err)
	}
	if mismatch.Old != 3 || mismatch.New != 2 {
		t.Errorf("MismatchError = %+v", *mismatch)
	}
}

// ★行数だけを見ていると通ってしまう型。テーブルが丸ごと欠けている。
func TestVerify_DetectsMissingTable(t *testing.T) {
	oldConn := openMem(t,
		`CREATE TABLE combos (id INTEGER)`, `INSERT INTO combos VALUES (1)`,
		`CREATE TABLE tags (id INTEGER)`, `INSERT INTO tags VALUES (1)`)
	newConn := openMem(t, `CREATE TABLE combos (id INTEGER)`, `INSERT INTO combos VALUES (1)`)

	// 先に「同じ構成どうしなら通る」ことを見て、常に赤いだけの検証でないことを確かめる。
	if err := datadir.Verify(newConn, newConn, []datadir.TableCount{{Table: "combos", Rows: 1}}); err != nil {
		t.Fatalf("同一 DB の突合が失敗した: %v", err)
	}
	err := datadir.Verify(oldConn, newConn, []datadir.TableCount{{Table: "combos", Rows: 1}, {Table: "tags", Rows: 1}})
	var missing *datadir.MissingTableError
	if !errors.As(err, &missing) {
		t.Fatalf("err = %v, want *MissingTableError", err)
	}
	if len(missing.Missing) != 1 || missing.Missing[0] != "tags" {
		t.Errorf("Missing = %v, want [tags]", missing.Missing)
	}
}

// ★sqlite_ 接頭辞の内部テーブルは突合の対象にしない(片側にだけ現れて偽陽性になる)。
func TestVerify_IgnoresSqliteInternalTables(t *testing.T) {
	oldConn := openMem(t, `CREATE TABLE combos (id INTEGER)`, `INSERT INTO combos VALUES (1)`)
	newConn := openMem(t, `CREATE TABLE combos (id INTEGER)`, `INSERT INTO combos VALUES (1)`, `ANALYZE`)

	if err := datadir.Verify(oldConn, newConn, []datadir.TableCount{{Table: "combos", Rows: 1}}); err != nil {
		t.Fatalf("内部テーブルの差で落ちてはならない: %v", err)
	}
}

func TestVerify_DetectsUserVersionMismatch(t *testing.T) {
	oldConn := openMem(t, `CREATE TABLE combos (id INTEGER)`, `PRAGMA user_version = 7`)
	newConn := openMem(t, `CREATE TABLE combos (id INTEGER)`, `PRAGMA user_version = 3`)

	if err := datadir.Verify(oldConn, newConn, []datadir.TableCount{{Table: "combos", Rows: 0}}); err == nil {
		t.Fatal("user_version の食い違いを見逃している")
	}
}

// ---------------------------------------------------------------------------
// 判定
// ---------------------------------------------------------------------------

func TestUsesLegacyDefault(t *testing.T) {
	root := t.TempDir()
	legacy := filepath.Join(root, "combomgr", "combomgr.db")
	if datadir.UsesLegacyDefault(legacy, legacy) != true {
		t.Error("同じパスを別物と判定している")
	}
	if datadir.UsesLegacyDefault(filepath.Join(root, "elsewhere.db"), legacy) != false {
		t.Error("別のパスを同じと判定している")
	}
	// ★リネーム前の config.toml が旧既定の絶対パスを持っている形。
	// ここを取りこぼすと利用者のデータが永久に旧へ取り残される。
	if datadir.UsesLegacyDefault(filepath.Join(root, "combomgr", ".", "combomgr.db"), legacy) != true {
		t.Error("正規化前のパスを取りこぼしている")
	}
}

func TestDecide_SymlinkedLegacyDirIsRefused(t *testing.T) {
	if os.Getenv("GOOS") == "windows" {
		t.Skip("windows ではシンボリックリンクの作成に権限が要る")
	}
	root := t.TempDir()
	real := filepath.Join(root, "elsewhere")
	seedDB(t, real, oldDBName, 1)
	oldDir := filepath.Join(root, "combomgr")
	if err := os.Symlink(real, oldDir); err != nil {
		t.Skipf("シンボリックリンクを作れない環境: %v", err)
	}

	d, err := datadir.Decide(oldDir, filepath.Join(root, "tacpendium"), oldDBName, newDBName)
	if err != nil {
		t.Fatal(err)
	}
	if d.Proceed {
		t.Fatal("シンボリックリンクの旧ディレクトリを移行対象にしている(退避のリネームがリンク自体を動かす)")
	}
	if d.Reason != datadir.ReasonLegacyDirSymlnk {
		t.Errorf("Reason = %q", d.Reason)
	}
}

// OS 既定パスの解決経由で一度だけ通しておく(t.Setenv があるので並列化しない)。
func TestDefaultParams_UsesOSPaths(t *testing.T) {
	root := t.TempDir()
	t.Setenv("XDG_DATA_HOME", root)

	p, err := datadir.DefaultParams(fixedNow)
	if err != nil {
		t.Fatal(err)
	}
	if p.OldDBName != "combomgr.db" || p.NewDBName != "tacpendium.db" {
		t.Errorf("DB 名 = %q / %q", p.OldDBName, p.NewDBName)
	}
	if filepath.Base(p.OldDir) != "combomgr" || filepath.Base(p.NewDir) != "tacpendium" {
		t.Errorf("ディレクトリ = %q / %q", p.OldDir, p.NewDir)
	}
}

// (d3) ★★WAL にコミットが残っている状態で検証に失敗する。
//
// ★★(d1)/(d2) はこの経路を 1 度も通っていなかった ————————————————————————
// seedDB が正常終了した後の DB は WAL フレームを持たないため、checkpointWAL が
// 移行元 DB へ書き戻す経路に入らない。そのため assertNothingMoved の sha256 一致が
// 成立していただけである。★WAL が残っていれば checkpoint が旧 DB のバイト列を変える。
//
// ⇒ ここで確かめるのは「バイト列が同じこと」ではなく
// **「旧を開けば移行前と同じデータが読めること」**である。
func TestMigrate_D3_VerifyFailsWithPendingWAL_OldDataStillReadable(t *testing.T) {
	p, root, oldDir, newDir := newParams(t)
	seedDB(t, oldDir, oldDBName, 1)

	oldDBPath := filepath.Join(oldDir, oldDBName)
	conn, err := db.Open(oldDBPath)
	if err != nil {
		t.Fatal(err)
	}
	for i := 2; i <= 4; i++ {
		if _, err := conn.Exec(`INSERT INTO combos VALUES (?, ?)`, i, fmt.Sprintf("wal-%d", i)); err != nil {
			t.Fatal(err)
		}
	}
	walPath := oldDBPath + "-wal"
	if fi, statErr := os.Stat(walPath); statErr != nil || fi.Size() == 0 {
		_ = conn.Close()
		t.Skipf("この環境では WAL に未 checkpoint のフレームが残らなかった: %v", statErr)
	}
	if err := conn.Close(); err != nil {
		t.Fatal(err)
	}

	// 検証を必ず落とす: 妥当な DB だが 1 行足りないコピーを作る。
	p.CopyDB = func(src, dst string) error {
		srcConn, openErr := db.Open(src)
		if openErr != nil {
			return openErr
		}
		if _, execErr := srcConn.Exec(`VACUUM INTO '` + dst + `'`); execErr != nil {
			_ = srcConn.Close()
			return execErr
		}
		if closeErr := srcConn.Close(); closeErr != nil {
			return closeErr
		}
		dstConn, openErr := db.Open(dst)
		if openErr != nil {
			return openErr
		}
		if _, execErr := dstConn.Exec(`DELETE FROM combos WHERE id = 1`); execErr != nil {
			_ = dstConn.Close()
			return execErr
		}
		return dstConn.Close()
	}

	res := datadir.Migrate(p)
	if res.Status != datadir.StatusFailed {
		t.Fatalf("Status = %q, want failed", res.Status)
	}

	// ★★ここが本体。旧が「使える状態で」残っていること。
	if _, statErr := os.Stat(oldDir); statErr != nil {
		t.Fatalf("旧ディレクトリが消えている: %v", statErr)
	}
	entries, readErr := os.ReadDir(root)
	if readErr != nil {
		t.Fatal(readErr)
	}
	for _, e := range entries {
		if strings.Contains(e.Name(), ".migrated-") {
			t.Errorf("退避が行われている: %s", e.Name())
		}
	}
	if got := rowCount(t, oldDBPath, "combos"); got != 4 {
		t.Errorf("旧 DB の combos = %d, want 4 —— WAL にしか無かった 3 行が失われている", got)
	}
	if got := rowCount(t, oldDBPath, "tags"); got != 2 {
		t.Errorf("旧 DB の tags = %d, want 2", got)
	}
	mustNotExist(t, newDir, "移行先")
	noStagingLeft(t, root, oldDir)
}

// ---------------------------------------------------------------------------
// 経路 b の中身の分け（★良性と危険を区別する）
// ---------------------------------------------------------------------------

// 良性形: 新にデータが在る（退避に失敗した／確定と退避の間で落ちた）。
func TestMigrate_B_NewHasData_IsBenign(t *testing.T) {
	p, _, oldDir, newDir := newParams(t)
	seedDB(t, oldDir, oldDBName, 3)
	seedDB(t, newDir, newDBName, 9)

	res := datadir.Migrate(p)
	if res.Status != datadir.StatusSkipped {
		t.Fatalf("Status = %q, want skipped", res.Status)
	}
	if res.Reason != datadir.ReasonNewDBExists {
		t.Errorf("Reason = %q, want new_db_exists（良性形）", res.Reason)
	}
}

// ★★危険形: 新が空で、旧にデータが在る。
//
// これは「アプリを開くと空で、コンボは全部旧に取り残されている」状態である。
// Decide は os.Stat のサイズしか見ないため、良性形と同じ経路 b に入る。
// ⇒ 中身（行数）で分けないと、利用者はデータが消えたようにしか見えない。
func TestMigrate_B_NewEmptyOldHasData_IsStranded(t *testing.T) {
	p, _, oldDir, newDir := newParams(t)
	seedDB(t, oldDir, oldDBName, 4)
	seedEmptyDB(t, newDir, newDBName) // ★テーブルはあるが利用者の行が無い＝空の DB

	res := datadir.Migrate(p)
	if res.Status != datadir.StatusSkipped {
		t.Fatalf("Status = %q, want skipped", res.Status)
	}
	if res.Reason != datadir.ReasonOldDataStranded {
		t.Fatalf("Reason = %q, want old_data_stranded —— 空の新と実データのある旧を区別できていない", res.Reason)
	}
	if !strings.Contains(res.Message, oldDir) {
		t.Errorf("旧データの在処が文面に無い: %q", res.Message)
	}
	// 旧は 1 バイトも動いていないこと。
	if _, err := os.Stat(filepath.Join(oldDir, oldDBName)); err != nil {
		t.Errorf("旧 DB が動いている: %v", err)
	}
}

// schema_migrations だけが入っている新 DB は「空」とみなすこと。
// ★これを数に入れると、golang-migrate が版を 1 行書いた時点で
// 「空ではない」ことになり、危険形の判定が永久に効かなくなる。
func TestCheckStranded_IgnoresSchemaMigrations(t *testing.T) {
	root := t.TempDir()
	oldDir := filepath.Join(root, "old")
	newDir := filepath.Join(root, "new")
	seedDB(t, oldDir, oldDBName, 2)
	seedEmptyDB(t, newDir, newDBName)

	check, err := datadir.CheckStranded(
		filepath.Join(oldDir, oldDBName), filepath.Join(newDir, newDBName))
	if err != nil {
		t.Fatal(err)
	}
	if check.NewRows != 0 {
		t.Errorf("NewRows = %d, want 0 —— schema_migrations を数に入れている", check.NewRows)
	}
	if check.OldRows == 0 {
		t.Error("OldRows = 0 —— 旧のデータを数えられていない")
	}
	if !check.Stranded {
		t.Error("Stranded = false, want true")
	}
}

func TestCheckStranded_BothHaveData_NotStranded(t *testing.T) {
	root := t.TempDir()
	oldDir := filepath.Join(root, "old")
	newDir := filepath.Join(root, "new")
	seedDB(t, oldDir, oldDBName, 2)
	seedDB(t, newDir, newDBName, 7)

	check, err := datadir.CheckStranded(
		filepath.Join(oldDir, oldDBName), filepath.Join(newDir, newDBName))
	if err != nil {
		t.Fatal(err)
	}
	if check.Stranded {
		t.Errorf("Stranded = true, want false（新にデータが在るので良性）: %+v", check)
	}
}

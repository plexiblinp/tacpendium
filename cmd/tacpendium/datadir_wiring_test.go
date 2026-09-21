package main

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/plexiblinp/tacpendium/internal/config"
	"github.com/plexiblinp/tacpendium/internal/infra/datadir"
	dbinfra "github.com/plexiblinp/tacpendium/internal/infra/db"
)

// prepareDataDir の配線を、OS 既定パスの解決経由で通す。
//
// ★★ここが M28-01 で最も順序が効く関数である ————————————————————————
// 「複製 → 検証 → config の書き換え → 旧の退避」の順序は internal/infra/datadir の
// 中では完結せず、prepareDataDir が持っている。datadir 側のテストはこの関数を 1 度も通らない。

// seedLegacyDB は旧既定の場所に実 DB を作る。
func seedLegacyDB(t *testing.T, combos int) (oldDir, oldDBPath string) {
	t.Helper()
	oldDBPath, err := dbinfra.LegacyResolveDBPath()
	if err != nil {
		t.Fatalf("LegacyResolveDBPath: %v", err)
	}
	oldDir = filepath.Dir(oldDBPath)
	if err := os.MkdirAll(oldDir, 0o755); err != nil {
		t.Fatal(err)
	}
	conn, err := dbinfra.Open(oldDBPath)
	if err != nil {
		t.Fatalf("open legacy db: %v", err)
	}
	if _, err := conn.Exec(`CREATE TABLE combos (id INTEGER PRIMARY KEY)`); err != nil {
		t.Fatal(err)
	}
	for i := 1; i <= combos; i++ {
		if _, err := conn.Exec(`INSERT INTO combos VALUES (?)`, i); err != nil {
			t.Fatal(err)
		}
	}
	if err := conn.Close(); err != nil {
		t.Fatal(err)
	}
	return oldDir, oldDBPath
}

func countCombos(t *testing.T, dbPath string) int64 {
	t.Helper()
	conn, err := dbinfra.Open(dbPath)
	if err != nil {
		t.Fatalf("open %s: %v", dbPath, err)
	}
	defer func() { _ = conn.Close() }()
	var n int64
	if err := conn.QueryRow(`SELECT count(*) FROM combos`).Scan(&n); err != nil {
		t.Fatalf("count: %v", err)
	}
	return n
}

// (a) database.path が空 → 移行して退避まで進み、config は書き換わらない(書き換える対象が無い)。
func TestPrepareDataDir_EmptyPath_MigratesAndRetires(t *testing.T) {
	root := t.TempDir()
	t.Setenv("XDG_DATA_HOME", root)
	oldDir, _ := seedLegacyDB(t, 3)

	configPath := filepath.Join(t.TempDir(), "config.toml")
	cfg := config.Default()

	res, gotCfg, dbPath, err := prepareDataDir(configPath, cfg)
	if err != nil {
		t.Fatalf("prepareDataDir: %v", err)
	}
	if res.Status != datadir.StatusMigrated {
		t.Fatalf("Status = %q (%v), want migrated", res.Status, res.Err)
	}
	if got := countCombos(t, dbPath); got != 3 {
		t.Errorf("combos = %d, want 3", got)
	}
	if gotCfg.Database.Path != "" {
		t.Errorf("Database.Path = %q, want 空のまま", gotCfg.Database.Path)
	}
	if res.RetiredDir == "" || res.RetireFailed {
		t.Errorf("退避されていない: RetiredDir=%q RetireFailed=%v", res.RetiredDir, res.RetireFailed)
	}
	if _, statErr := os.Stat(oldDir); statErr == nil {
		t.Error("旧ディレクトリが元の名前のまま残っている")
	}
}

// (b) database.path が旧既定の絶対パス → 移行し、config が書き換わり、退避まで進む。
func TestPrepareDataDir_LegacyAbsolutePath_RewritesConfigThenRetires(t *testing.T) {
	root := t.TempDir()
	t.Setenv("XDG_DATA_HOME", root)
	_, oldDBPath := seedLegacyDB(t, 2)

	configPath := filepath.Join(t.TempDir(), "config.toml")
	cfg := config.Default()
	cfg.Database.Path = oldDBPath
	if err := config.Save(configPath, cfg); err != nil {
		t.Fatal(err)
	}
	// ★ここで config.Load が通ることも同時に確かめている。
	// appDataRoots が旧データディレクトリを許していないと、移行が走る前に落ちる。
	loaded, err := config.Load(configPath)
	if err != nil {
		t.Fatalf("config.Load: %v —— 旧既定の絶対パスで起動できない", err)
	}

	res, gotCfg, dbPath, err := prepareDataDir(configPath, loaded)
	if err != nil {
		t.Fatalf("prepareDataDir: %v", err)
	}
	if res.Status != datadir.StatusMigrated {
		t.Fatalf("Status = %q (%v), want migrated", res.Status, res.Err)
	}
	if !res.ConfigRewritten {
		t.Error("config.toml が書き換わっていない")
	}
	wantDB, _ := dbinfra.ResolveDBPath("")
	if gotCfg.Database.Path != wantDB {
		t.Errorf("Database.Path = %q, want %q", gotCfg.Database.Path, wantDB)
	}
	if dbPath != wantDB {
		t.Errorf("dbPath = %q, want %q", dbPath, wantDB)
	}
	if got := countCombos(t, dbPath); got != 2 {
		t.Errorf("combos = %d, want 2", got)
	}
	if res.RetiredDir == "" {
		t.Error("退避されていない")
	}
}

// ★★(c) config の書き換えが空振りしたら退避しない。
//
// 本サブで最も危ない経路である。移行の判定(UsesLegacyDefault)は EvalSymlinks で正規化するが、
// config の書き換え(withinRoot)は純粋な字句一致である。両者が食い違う綴りが書かれていると
// 「移行はする ／ config は書き換わらない ／ 旧は退避される」が成立し、次の起動で
// SQLite が消えた旧パスへ空の DB を作る。⇒ 退避の前に「開く先が実在するか」を見る。
func TestPrepareDataDir_ConfigRewriteMissed_DoesNotRetire(t *testing.T) {
	root := t.TempDir()
	t.Setenv("XDG_DATA_HOME", root)
	oldDir, oldDBPath := seedLegacyDB(t, 4)

	// シンボリックリンク経由の綴りで書く。EvalSymlinks は同じ場所だと解決するが、
	// withinRoot の字句一致では旧ルート配下と判定されない。
	linkRoot := filepath.Join(t.TempDir(), "linked")
	if err := os.Symlink(oldDir, linkRoot); err != nil {
		t.Skipf("シンボリックリンクを作れない環境: %v", err)
	}
	viaLink := filepath.Join(linkRoot, filepath.Base(oldDBPath))

	configPath := filepath.Join(t.TempDir(), "config.toml")
	cfg := config.Default()
	cfg.Database.Path = viaLink

	res, gotCfg, dbPath, err := prepareDataDir(configPath, cfg)
	if err != nil {
		t.Fatalf("prepareDataDir: %v", err)
	}
	if res.Status != datadir.StatusMigrated {
		t.Skipf("この環境では移行対象と判定されなかった(Status=%q)。本経路の前提が成立しない", res.Status)
	}

	// ★ここが本体。書き換えが空振りしているなら退避してはならない。
	if !res.ConfigRewritten {
		if res.RetiredDir != "" {
			t.Fatalf("config が書き換わっていないのに旧を退避した: %q —— 次の起動で空の DB が作られる", res.RetiredDir)
		}
		if _, statErr := os.Stat(oldDir); statErr != nil {
			t.Fatalf("旧ディレクトリが失われている: %v", statErr)
		}
		if !res.RetireFailed {
			t.Error("退避を見送ったことが Result に出ていない")
		}
	}
	// どちらに転んでも、これから開く DB は実在していなければならない。
	if _, statErr := os.Stat(dbPath); statErr != nil {
		t.Errorf("開く先 %q が存在しない: %v", dbPath, statErr)
	}
	_ = gotCfg
}

// (d) 利用者が明示した「旧既定とは無関係のパス」には触らない。
func TestPrepareDataDir_ExplicitUnrelatedPath_SkipsEntirely(t *testing.T) {
	root := t.TempDir()
	t.Setenv("XDG_DATA_HOME", root)
	oldDir, _ := seedLegacyDB(t, 1)

	explicit := filepath.Join(root, "elsewhere.db")
	cfg := config.Default()
	cfg.Database.Path = explicit

	res, _, dbPath, err := prepareDataDir(filepath.Join(t.TempDir(), "config.toml"), cfg)
	if err != nil {
		t.Fatalf("prepareDataDir: %v", err)
	}
	if res.Status != datadir.StatusSkipped || res.Reason != datadir.ReasonExplicitDBPath {
		t.Fatalf("Status/Reason = %q/%q, want skipped/explicit_db_path", res.Status, res.Reason)
	}
	if dbPath != explicit {
		t.Errorf("dbPath = %q, want %q", dbPath, explicit)
	}
	if _, statErr := os.Stat(oldDir); statErr != nil {
		t.Errorf("旧ディレクトリに触っている: %v", statErr)
	}
}

func TestReadyToRetire(t *testing.T) {
	root := t.TempDir()
	oldDir := filepath.Join(root, "combomgr")
	newDir := filepath.Join(root, "tacpendium")
	if err := os.MkdirAll(newDir, 0o755); err != nil {
		t.Fatal(err)
	}
	newDB := filepath.Join(newDir, "tacpendium.db")
	if err := os.WriteFile(newDB, []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}

	if ok, _ := datadir.ReadyToRetire(newDB, oldDir); !ok {
		t.Error("移行先に実在する DB を退避不可と判定している")
	}
	if ok, reason := datadir.ReadyToRetire(filepath.Join(oldDir, "combomgr.db"), oldDir); ok {
		t.Error("旧ディレクトリ配下を指したままで退避可と判定している")
	} else if reason == "" {
		t.Error("理由が空である")
	}
	if ok, _ := datadir.ReadyToRetire(filepath.Join(newDir, "missing.db"), oldDir); ok {
		t.Error("実在しない DB を退避可と判定している")
	}
	if ok, _ := datadir.ReadyToRetire("", oldDir); ok {
		t.Error("空パスを退避可と判定している")
	}
}

// ★★条件 (a): 検証に失敗したとき、アプリが掴むのは「旧」でなければならない。
//
// 設計卓の裁定（2026-09-05）の逐語＝「コピー途中の新を掴んだまま起動すると、
// 規則 1・6 が壊れます」。datadir 側の (d1)/(d2)/(d3) は Migrate の戻り値までしか
// 見ておらず、**run() がどちらの DB を開くかは誰も確かめていなかった**。
func TestPrepareDataDirWith_VerifyFails_OpensLegacyDB(t *testing.T) {
	root := t.TempDir()
	t.Setenv("XDG_DATA_HOME", root)
	oldDir, oldDBPath := seedLegacyDB(t, 3)

	params, err := datadir.DefaultParams(fixedNow())
	if err != nil {
		t.Fatal(err)
	}
	// 妥当だが 1 行足りないコピーを作らせて、検証を必ず落とす。
	params.CopyDB = func(src, dst string) error {
		srcConn, openErr := dbinfra.Open(src)
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
		dstConn, openErr := dbinfra.Open(dst)
		if openErr != nil {
			return openErr
		}
		if _, execErr := dstConn.Exec(`DELETE FROM combos WHERE id = 1`); execErr != nil {
			_ = dstConn.Close()
			return execErr
		}
		return dstConn.Close()
	}

	cfg := config.Default()
	res, _, dbPath, err := prepareDataDirWith(filepath.Join(t.TempDir(), "config.toml"), cfg, params)
	if err != nil {
		t.Fatalf("prepareDataDirWith: %v", err)
	}
	if res.Status != datadir.StatusFailed {
		t.Fatalf("Status = %q, want failed", res.Status)
	}
	// ★起動は止めない(裁定②の本体)。
	if res.Fatal() {
		t.Error("検証の失敗で起動を止めている。止めるのは移行であってアプリではない")
	}
	// ★★掴むのは旧。パスの一致だけでなく、中身が読めることまで見る。
	if dbPath != oldDBPath {
		t.Fatalf("dbPath = %q, want %q(旧)", dbPath, oldDBPath)
	}
	if got := countCombos(t, dbPath); got != 3 {
		t.Errorf("開いた DB の combos = %d, want 3 —— 旧が無事に読めていない", got)
	}
	if _, statErr := os.Stat(oldDir); statErr != nil {
		t.Errorf("旧ディレクトリが動いている: %v", statErr)
	}
	// ★条件 (c) の前提の実測: 検証失敗では移行先が作られない。
	if res.RemnantDir || res.RemnantDB {
		t.Errorf("失敗したのに移行先に残骸がある: dir=%v db=%v", res.RemnantDir, res.RemnantDB)
	}
	mustNotExistPath(t, params.NewDir)
}

// ★★§4: 明示パスが「新既定」を指していても、移行を飛ばしてはならない。
//
// README.txt は既定パスを OS 別に印字している。「保存場所を明示しておこう」と
// それを config.toml へ書き写す利用者がいる。**移行が要るのはまさにその人である。**
// 明示されているだけで飛ばすと、移行もせず告知も出さないまま
// db.Open がそこへ空の DB を作り、旧のデータが黙って取り残される。
func TestPrepareDataDirWith_ExplicitNewDefaultPath_StillMigrates(t *testing.T) {
	root := t.TempDir()
	t.Setenv("XDG_DATA_HOME", root)
	seedLegacyDB(t, 5)

	params, err := datadir.DefaultParams(fixedNow())
	if err != nil {
		t.Fatal(err)
	}
	newDBPath := filepath.Join(params.NewDir, params.NewDBName)

	cfg := config.Default()
	cfg.Database.Path = newDBPath // ★README の文字列を書き写した形

	res, _, dbPath, err := prepareDataDirWith(filepath.Join(t.TempDir(), "config.toml"), cfg, params)
	if err != nil {
		t.Fatalf("prepareDataDirWith: %v", err)
	}
	if res.Status != datadir.StatusMigrated {
		t.Fatalf("Status = %q (reason=%q, %v), want migrated —— 明示されているだけで飛ばしている",
			res.Status, res.Reason, res.Err)
	}
	if dbPath != newDBPath {
		t.Errorf("dbPath = %q, want %q", dbPath, newDBPath)
	}
	if got := countCombos(t, dbPath); got != 5 {
		t.Errorf("combos = %d, want 5 —— データが運ばれていない", got)
	}
}

// 対照: 明示先が旧既定でも新既定でもないなら、従来どおり黙って従う。
func TestPrepareDataDirWith_ExplicitUnrelatedPath_StaysSilent(t *testing.T) {
	root := t.TempDir()
	t.Setenv("XDG_DATA_HOME", root)
	oldDir, _ := seedLegacyDB(t, 1)

	params, err := datadir.DefaultParams(fixedNow())
	if err != nil {
		t.Fatal(err)
	}
	explicit := filepath.Join(root, "elsewhere.db")
	cfg := config.Default()
	cfg.Database.Path = explicit

	res, _, dbPath, err := prepareDataDirWith(filepath.Join(t.TempDir(), "config.toml"), cfg, params)
	if err != nil {
		t.Fatal(err)
	}
	if res.Status != datadir.StatusSkipped || res.Reason != datadir.ReasonExplicitDBPath {
		t.Fatalf("Status/Reason = %q/%q, want skipped/explicit_db_path", res.Status, res.Reason)
	}
	if dbPath != explicit {
		t.Errorf("dbPath = %q, want %q", dbPath, explicit)
	}
	if _, statErr := os.Stat(oldDir); statErr != nil {
		t.Errorf("旧ディレクトリに触っている: %v", statErr)
	}
}

func fixedNow() time.Time { return time.Date(2026, 9, 5, 12, 0, 0, 0, time.UTC) }

func mustNotExistPath(t *testing.T, path string) {
	t.Helper()
	if _, err := os.Lstat(path); err == nil {
		t.Errorf("%s が存在してはならない", path)
	}
}

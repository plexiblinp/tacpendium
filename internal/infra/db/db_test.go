package db

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func TestOpen_AppliesPragmas(t *testing.T) {
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "test.db")

	conn, err := Open(dbPath)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	t.Cleanup(func() { conn.Close() })

	// journal_mode は WAL を期待。SQLite が大文字小文字どちらで返すか実装依存のため lower で比較。
	var jm string
	if err := conn.QueryRow("PRAGMA journal_mode").Scan(&jm); err != nil {
		t.Fatalf("query journal_mode: %v", err)
	}
	if strings.ToLower(jm) != "wal" {
		t.Errorf("journal_mode = %q, want wal", jm)
	}

	var fk int
	if err := conn.QueryRow("PRAGMA foreign_keys").Scan(&fk); err != nil {
		t.Fatalf("query foreign_keys: %v", err)
	}
	if fk != 1 {
		t.Errorf("foreign_keys = %d, want 1 (ON)", fk)
	}

	var busy int
	if err := conn.QueryRow("PRAGMA busy_timeout").Scan(&busy); err != nil {
		t.Fatalf("query busy_timeout: %v", err)
	}
	if busy != 5000 {
		t.Errorf("busy_timeout = %d, want 5000", busy)
	}

	var sync int
	if err := conn.QueryRow("PRAGMA synchronous").Scan(&sync); err != nil {
		t.Fatalf("query synchronous: %v", err)
	}
	// SQLite で synchronous = NORMAL は内部値 1 として返る。
	if sync != 1 {
		t.Errorf("synchronous = %d, want 1 (NORMAL)", sync)
	}
}

func TestOpen_CreatesParentDir(t *testing.T) {
	root := t.TempDir()
	nested := filepath.Join(root, "deeply", "nested", "path")
	dbPath := filepath.Join(nested, "test.db")

	conn, err := Open(dbPath)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	t.Cleanup(func() { conn.Close() })

	if _, err := os.Stat(nested); err != nil {
		t.Errorf("expected parent dir %q to be created: %v", nested, err)
	}
}

func TestOpen_EmptyPath(t *testing.T) {
	if _, err := Open(""); err == nil {
		t.Error("Open(\"\") should error")
	}
}

func TestResolveDBPath_ExplicitPath(t *testing.T) {
	got, err := ResolveDBPath("/tmp/custom.db")
	if err != nil {
		t.Fatalf("ResolveDBPath: %v", err)
	}
	if got != "/tmp/custom.db" {
		t.Errorf("got %q, want %q", got, "/tmp/custom.db")
	}
}

func TestResolveDBPath_DefaultByOS(t *testing.T) {
	t.Setenv("XDG_DATA_HOME", "")
	got, err := ResolveDBPath("")
	if err != nil {
		t.Fatalf("ResolveDBPath: %v", err)
	}

	switch runtime.GOOS {
	case "windows":
		if !strings.Contains(got, "tacpendium") || !strings.HasSuffix(got, "tacpendium.db") {
			t.Errorf("windows default path looks wrong: %q", got)
		}
	case "darwin":
		want := "Library/Application Support/tacpendium/tacpendium.db"
		if !strings.HasSuffix(got, want) {
			t.Errorf("darwin default path = %q, want suffix %q", got, want)
		}
	default: // linux
		want := ".local/share/tacpendium/tacpendium.db"
		if !strings.HasSuffix(got, want) {
			t.Errorf("linux default path = %q, want suffix %q", got, want)
		}
	}
}

func TestResolveDBPath_XDGDataHome(t *testing.T) {
	if runtime.GOOS != "linux" && runtime.GOOS != "freebsd" {
		t.Skipf("XDG behavior is only tested on linux-like OS; current=%s", runtime.GOOS)
	}
	t.Setenv("XDG_DATA_HOME", "/custom/xdg/data")
	got, err := ResolveDBPath("")
	if err != nil {
		t.Fatalf("ResolveDBPath: %v", err)
	}
	want := "/custom/xdg/data/tacpendium/tacpendium.db"
	if got != want {
		t.Errorf("got %q, want %q (XDG_DATA_HOME)", got, want)
	}
}

// TestLegacyResolveDBPath_IsTheOldDefault は旧既定パスが M28-01 より前の綴りのままで
// あることを固定する。
//
// ★★ここが動くと利用者のデータの移行元を見失う。移行は「旧既定に在るもの」を運ぶので、
// この 2 つの名前が新名へ引きずられたら、移行は何も見つけられないまま静かに成功する。
func TestLegacyResolveDBPath_IsTheOldDefault(t *testing.T) {
	if runtime.GOOS != "linux" && runtime.GOOS != "freebsd" {
		t.Skipf("XDG behavior is only tested on linux-like OS; current=%s", runtime.GOOS)
	}
	t.Setenv("XDG_DATA_HOME", "/custom/xdg/data")

	got, err := LegacyResolveDBPath()
	if err != nil {
		t.Fatalf("LegacyResolveDBPath: %v", err)
	}
	if want := "/custom/xdg/data/combomgr/combomgr.db"; got != want {
		t.Errorf("LegacyResolveDBPath() = %q, want %q", got, want)
	}

	dir, err := LegacyDataDir()
	if err != nil {
		t.Fatalf("LegacyDataDir: %v", err)
	}
	if want := "/custom/xdg/data/combomgr"; dir != want {
		t.Errorf("LegacyDataDir() = %q, want %q", dir, want)
	}
}

// TestDataDirNames_AreDistinct は新旧の名前が食い違っていることを固定する。
// 同じになったら移行は自分自身を移行しようとする。
func TestDataDirNames_AreDistinct(t *testing.T) {
	if AppDirName() == LegacyAppDirName() {
		t.Errorf("新旧のディレクトリ名が同じ: %q", AppDirName())
	}
	if DBFileName() == LegacyDBFileName() {
		t.Errorf("新旧の DB ファイル名が同じ: %q", DBFileName())
	}
}

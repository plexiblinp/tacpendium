package config

import (
	"os"
	"path/filepath"
	"strconv"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/infra/db"
)

func TestDefault(t *testing.T) {
	cfg := Default()
	if cfg.Server.Mode != "local" {
		t.Errorf("Server.Mode = %q, want %q", cfg.Server.Mode, "local")
	}
	if cfg.Server.Port != 47318 {
		t.Errorf("Server.Port = %d, want 47318", cfg.Server.Port)
	}
	if cfg.Logging.Level != "info" {
		t.Errorf("Logging.Level = %q, want %q", cfg.Logging.Level, "info")
	}
	if cfg.Logging.File != "logs/tacpendium.log" {
		t.Errorf("Logging.File = %q, want %q", cfg.Logging.File, "logs/tacpendium.log")
	}
	if cfg.Logging.MaxSizeMB != 10 || cfg.Logging.MaxBackups != 5 || cfg.Logging.MaxAgeDays != 30 {
		t.Errorf("Logging rotation defaults wrong: %+v", cfg.Logging)
	}
	if cfg.Security.PasswordEnabled {
		t.Error("Security.PasswordEnabled should default to false")
	}
	if cfg.Defaults.CharacterID != 1 {
		t.Errorf("Defaults.CharacterID = %d, want 1", cfg.Defaults.CharacterID)
	}
	if cfg.Defaults.PresetID != 1 {
		t.Errorf("Defaults.PresetID = %d, want 1", cfg.Defaults.PresetID)
	}
}

func TestLoad_FileMissing_ReturnsDefault(t *testing.T) {
	t.Setenv(EnvLogLevel, "")
	t.Setenv(EnvDBPath, "")
	cfg, err := Load(filepath.Join(t.TempDir(), "does-not-exist.toml"))
	if err != nil {
		t.Fatalf("Load returned error for missing file: %v", err)
	}
	if cfg.Server.Port != 47318 || cfg.Server.Mode != "local" {
		t.Errorf("missing file should yield defaults, got %+v", cfg.Server)
	}
}

// TestLoad_EnvDBPathOverride は TACPENDIUM_DB_PATH による database.path の一時上書き
// (E2E 使い捨て DB 用・改善レーン E1)を検証する。
func TestLoad_EnvDBPathOverride(t *testing.T) {
	t.Setenv(EnvLogLevel, "")
	t.Setenv(EnvDBPath, "web/e2e/.tmp/e2e.db")

	cfg, err := Load(filepath.Join(t.TempDir(), "does-not-exist.toml"))
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.Database.Path != "web/e2e/.tmp/e2e.db" {
		t.Errorf("Database.Path = %q, want env override", cfg.Database.Path)
	}
}

// TestLoad_EnvPortOverride は TACPENDIUM_PORT による server.port の一時上書き
// (E2E 専用ポート・改善レーン E1)を検証する。数値でない値は無視される。
func TestLoad_EnvPortOverride(t *testing.T) {
	t.Setenv(EnvLogLevel, "")
	t.Setenv(EnvDBPath, "")
	t.Setenv(EnvPort, "47390")

	cfg, err := Load(filepath.Join(t.TempDir(), "does-not-exist.toml"))
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.Server.Port != 47390 {
		t.Errorf("Server.Port = %d, want 47390", cfg.Server.Port)
	}

	t.Setenv(EnvPort, "not-a-number")
	cfg, err = Load(filepath.Join(t.TempDir(), "does-not-exist.toml"))
	if err != nil {
		t.Fatalf("Load(non-numeric env): %v", err)
	}
	if cfg.Server.Port != 47318 {
		t.Errorf("Server.Port = %d, want default when env is non-numeric", cfg.Server.Port)
	}
}

// TestLoad_EnvDBPathOverride_StillValidated は env 上書きにも ValidateDataPath が
// 適用されること(".." 脱出パスは拒否)を検証する。
func TestLoad_EnvDBPathOverride_StillValidated(t *testing.T) {
	t.Setenv(EnvLogLevel, "")
	t.Setenv(EnvDBPath, "../outside.db")

	if _, err := Load(filepath.Join(t.TempDir(), "does-not-exist.toml")); err == nil {
		t.Fatal("expected validation error for traversal path via env override")
	}
}

func TestLoad_ValidFile(t *testing.T) {
	t.Setenv(EnvLogLevel, "")
	t.Setenv(EnvDBPath, "")
	dir := t.TempDir()
	path := filepath.Join(dir, "config.toml")
	body := `
[server]
mode = "lan"
port = 50000

[database]
path = "data/test.db"

[logging]
level = "debug"
file = "logs/test.log"
max_size_mb = 5
max_backups = 3
max_age_days = 7

[security]
password_enabled = true
`
	if err := os.WriteFile(path, []byte(body), 0o600); err != nil {
		t.Fatalf("write: %v", err)
	}

	cfg, err := Load(path)
	if err != nil {
		t.Fatalf("Load returned error: %v", err)
	}
	if cfg.Server.Mode != "lan" {
		t.Errorf("Server.Mode = %q, want %q", cfg.Server.Mode, "lan")
	}
	if cfg.Server.Port != 50000 {
		t.Errorf("Server.Port = %d, want 50000", cfg.Server.Port)
	}
	if cfg.Database.Path != "data/test.db" {
		t.Errorf("Database.Path = %q, want %q", cfg.Database.Path, "data/test.db")
	}
	if cfg.Logging.Level != "debug" || cfg.Logging.File != "logs/test.log" {
		t.Errorf("Logging mismatch: %+v", cfg.Logging)
	}
	if cfg.Logging.MaxSizeMB != 5 || cfg.Logging.MaxBackups != 3 || cfg.Logging.MaxAgeDays != 7 {
		t.Errorf("Logging rotation values mismatch: %+v", cfg.Logging)
	}
	if !cfg.Security.PasswordEnabled {
		t.Error("Security.PasswordEnabled should be true")
	}
}

func TestLoad_InvalidTOML(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "config.toml")
	if err := os.WriteFile(path, []byte("this is = not = toml ==="), 0o600); err != nil {
		t.Fatalf("write: %v", err)
	}
	_, err := Load(path)
	if err == nil {
		t.Fatal("expected error for invalid TOML, got nil")
	}
}

// TestPersistPort_DoesNotPersistEnvOverride は、ポート記録時に環境変数による一時的な
// ログレベル上書き(TACPENDIUM_LOG_LEVEL)が config.toml に焼き付かないことを確認する
// (M7-05 レビュー指摘1)。ディスク内容を起点に port のみ更新するのが正。
func TestPersistPort_DoesNotPersistEnvOverride(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "config.toml")
	body := `
[server]
mode = "lan"
port = 47318

[logging]
level = "info"
file = "logs/test.log"
max_size_mb = 5
max_backups = 3
max_age_days = 7
`
	if err := os.WriteFile(path, []byte(body), 0o600); err != nil {
		t.Fatalf("write: %v", err)
	}

	// 環境変数でログレベルを一時上書きした状態で保存する。
	t.Setenv(EnvLogLevel, "debug")
	if err := PersistPort(path, 47319); err != nil {
		t.Fatalf("PersistPort: %v", err)
	}

	// env override を外して、ファイルに焼き付いた実値を確認する。
	t.Setenv(EnvLogLevel, "")
	cfg, err := Load(path)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.Server.Port != 47319 {
		t.Errorf("Server.Port = %d, want 47319", cfg.Server.Port)
	}
	if cfg.Logging.Level != "info" {
		t.Errorf("Logging.Level = %q, want \"info\"(env override は永続化しないのが正)", cfg.Logging.Level)
	}
	if cfg.Server.Mode != "lan" {
		t.Errorf("Server.Mode = %q, want \"lan\"(既存値の保持)", cfg.Server.Mode)
	}
}

// TestPersistPort_FileMissing_CreatesWithDefaults は、config.toml 不在時にデフォルト値 +
// 指定ポートで生成されることを確認する。
func TestPersistPort_FileMissing_CreatesWithDefaults(t *testing.T) {
	t.Setenv(EnvLogLevel, "")
	dir := t.TempDir()
	path := filepath.Join(dir, "config.toml")

	if err := PersistPort(path, 50001); err != nil {
		t.Fatalf("PersistPort: %v", err)
	}

	cfg, err := Load(path)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.Server.Port != 50001 {
		t.Errorf("Server.Port = %d, want 50001", cfg.Server.Port)
	}
	if cfg.Server.Mode != "local" {
		t.Errorf("Server.Mode = %q, want \"local\"(default)", cfg.Server.Mode)
	}
	if cfg.Logging.Level != "info" {
		t.Errorf("Logging.Level = %q, want \"info\"(default)", cfg.Logging.Level)
	}
}

func TestLoad_InvalidMode(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "config.toml")
	body := `
[server]
mode = "wan"
port = 47318
`
	if err := os.WriteFile(path, []byte(body), 0o600); err != nil {
		t.Fatalf("write: %v", err)
	}
	_, err := Load(path)
	if err == nil {
		t.Fatal("expected error for invalid mode, got nil")
	}
}

func TestLoad_EnvOverride_LogLevel(t *testing.T) {
	t.Setenv(EnvLogLevel, "warn")
	cfg, err := Load(filepath.Join(t.TempDir(), "missing.toml"))
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.Logging.Level != "warn" {
		t.Errorf("Logging.Level = %q, want %q (env override)", cfg.Logging.Level, "warn")
	}
}

func TestLoad_EnvOverride_OverridesFileValue(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "config.toml")
	body := `
[logging]
level = "debug"
`
	if err := os.WriteFile(path, []byte(body), 0o600); err != nil {
		t.Fatalf("write: %v", err)
	}
	t.Setenv(EnvLogLevel, "error")
	cfg, err := Load(path)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.Logging.Level != "error" {
		t.Errorf("Logging.Level = %q, want %q (env should override file)", cfg.Logging.Level, "error")
	}
}

func TestLoad_DefaultsFromFile(t *testing.T) {
	t.Setenv(EnvLogLevel, "")
	dir := t.TempDir()
	path := filepath.Join(dir, "config.toml")
	body := `
[defaults]
character_id = 5
preset_id = 3
`
	if err := os.WriteFile(path, []byte(body), 0o600); err != nil {
		t.Fatalf("write: %v", err)
	}
	cfg, err := Load(path)
	if err != nil {
		t.Fatalf("Load returned error: %v", err)
	}
	if cfg.Defaults.CharacterID != 5 {
		t.Errorf("Defaults.CharacterID = %d, want 5", cfg.Defaults.CharacterID)
	}
	if cfg.Defaults.PresetID != 3 {
		t.Errorf("Defaults.PresetID = %d, want 3", cfg.Defaults.PresetID)
	}
}

func TestLoad_DefaultsFromDefault(t *testing.T) {
	t.Setenv(EnvLogLevel, "")
	dir := t.TempDir()
	path := filepath.Join(dir, "config.toml")
	body := `
[server]
mode = "local"
port = 47318
`
	if err := os.WriteFile(path, []byte(body), 0o600); err != nil {
		t.Fatalf("write: %v", err)
	}
	cfg, err := Load(path)
	if err != nil {
		t.Fatalf("Load returned error: %v", err)
	}
	if cfg.Defaults.CharacterID != 1 {
		t.Errorf("Defaults.CharacterID = %d, want 1 (default)", cfg.Defaults.CharacterID)
	}
	if cfg.Defaults.PresetID != 1 {
		t.Errorf("Defaults.PresetID = %d, want 1 (default)", cfg.Defaults.PresetID)
	}
}

func TestLoad_DefaultsCharacterIDZero(t *testing.T) {
	t.Setenv(EnvLogLevel, "")
	dir := t.TempDir()
	path := filepath.Join(dir, "config.toml")
	body := `
[defaults]
character_id = 0
preset_id = 1
`
	if err := os.WriteFile(path, []byte(body), 0o600); err != nil {
		t.Fatalf("write: %v", err)
	}
	_, err := Load(path)
	if err == nil {
		t.Fatal("expected error for character_id=0, got nil")
	}
}

func TestLoad_DefaultsPresetIDZero(t *testing.T) {
	t.Setenv(EnvLogLevel, "")
	dir := t.TempDir()
	path := filepath.Join(dir, "config.toml")
	body := `
[defaults]
character_id = 1
preset_id = 0
`
	if err := os.WriteFile(path, []byte(body), 0o600); err != nil {
		t.Fatalf("write: %v", err)
	}
	_, err := Load(path)
	if err == nil {
		t.Fatal("expected error for preset_id=0, got nil")
	}
}

// TestLoad_RejectsTraversalDatabasePath は、database.path にディレクトリトラバーサル
// (".." 脱出)を含む設定を Load が拒否することを確認する(CHANGE-048)。
func TestLoad_RejectsTraversalDatabasePath(t *testing.T) {
	t.Setenv(EnvLogLevel, "")
	dir := t.TempDir()
	path := filepath.Join(dir, "config.toml")
	body := `
[database]
path = "../../escape.db"
`
	if err := os.WriteFile(path, []byte(body), 0o600); err != nil {
		t.Fatalf("write: %v", err)
	}
	if _, err := Load(path); err == nil {
		t.Fatal("expected error for traversal database.path, got nil")
	}
}

// TestLoad_RejectsTraversalLoggingFile は、logging.file の ".." 脱出を Load が拒否する
// ことを確認する(CHANGE-048)。
func TestLoad_RejectsTraversalLoggingFile(t *testing.T) {
	t.Setenv(EnvLogLevel, "")
	dir := t.TempDir()
	path := filepath.Join(dir, "config.toml")
	body := `
[logging]
file = "../../escape.log"
`
	if err := os.WriteFile(path, []byte(body), 0o600); err != nil {
		t.Fatalf("write: %v", err)
	}
	if _, err := Load(path); err == nil {
		t.Fatal("expected error for traversal logging.file, got nil")
	}
}

// TestLoad_RejectsAbsoluteOutsideDataDir は、アプリ管轄外の絶対パスを Load が拒否する
// ことを確認する(CHANGE-048)。t.TempDir() はデータディレクトリ/CWD のいずれの配下でも
// ないため拒否される想定。
func TestLoad_RejectsAbsoluteOutsideDataDir(t *testing.T) {
	t.Setenv(EnvLogLevel, "")
	dir := t.TempDir()
	path := filepath.Join(dir, "config.toml")
	outside := filepath.Join(t.TempDir(), "victim.db")
	body := "[database]\npath = " + strconv.Quote(outside) + "\n"
	if err := os.WriteFile(path, []byte(body), 0o600); err != nil {
		t.Fatalf("write: %v", err)
	}
	if _, err := Load(path); err == nil {
		t.Fatalf("expected error for absolute path outside data dir (%s), got nil", outside)
	}
}

// TestValidateDataPath は ValidateDataPath の各分岐を確認する(CHANGE-048)。
func TestValidateDataPath(t *testing.T) {
	dataDir, err := db.DataDir()
	if err != nil {
		t.Fatalf("DataDir: %v", err)
	}
	wd, err := os.Getwd()
	if err != nil {
		t.Fatalf("Getwd: %v", err)
	}

	cases := []struct {
		name    string
		path    string
		wantErr bool
	}{
		{"empty is allowed", "", false},
		{"relative log default", "logs/tacpendium.log", false},
		{"relative db", "data/test.db", false},
		{"internal dotdot resolves clean", "a/b/../c.db", false},
		{"escaping dotdot rejected", "../escape.db", true},
		{"escaping dotdot via clean rejected", "a/../../escape", true},
		{"absolute under data dir allowed", filepath.Join(dataDir, "sub", "tacpendium.db"), false},
		{"absolute under cwd allowed", filepath.Join(wd, "x.db"), false},
		{"absolute outside rejected", filepath.Join(t.TempDir(), "victim.db"), true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			msg := ValidateDataPath(tc.path)
			if tc.wantErr && msg == "" {
				t.Errorf("ValidateDataPath(%q) = ok, want rejection", tc.path)
			}
			if !tc.wantErr && msg != "" {
				t.Errorf("ValidateDataPath(%q) rejected with %q, want ok", tc.path, msg)
			}
		})
	}
}

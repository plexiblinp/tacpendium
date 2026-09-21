package config

import (
	"errors"
	"net"
	"os"
	"path/filepath"
	"testing"

	"github.com/BurntSushi/toml"
	appconfig "github.com/plexiblinp/tacpendium/internal/config"
)

func defaultCfg() *appconfig.Config {
	return appconfig.Default()
}

func noopResolver() (net.IP, error) {
	return nil, errors.New("no LAN IP")
}

func fixedResolver(ip string) LanIpResolver {
	return func() (net.IP, error) {
		return net.ParseIP(ip), nil
	}
}

func readPersistedConfig(t *testing.T, path string) *appconfig.Config {
	t.Helper()
	cfg := appconfig.Default()
	if _, err := toml.DecodeFile(path, cfg); err != nil {
		t.Fatalf("decode persisted config: %v", err)
	}
	return cfg
}

func TestService_Get_Initialized(t *testing.T) {
	dir := t.TempDir()
	configPath := filepath.Join(dir, "config.toml")
	if err := os.WriteFile(configPath, []byte("[server]\nmode = \"local\"\nport = 47318\n"), 0o600); err != nil {
		t.Fatalf("write: %v", err)
	}

	svc := NewService(defaultCfg(), configPath, noopResolver, nil, nil)
	cfg, _, isInitialized, err := svc.Get()
	if err != nil {
		t.Fatalf("Get returned error: %v", err)
	}
	if !isInitialized {
		t.Error("isInitialized should be true when config.toml exists")
	}
	if cfg.Server.Port != 47318 {
		t.Errorf("Server.Port = %d, want 47318", cfg.Server.Port)
	}
}

func TestService_Get_NotInitialized(t *testing.T) {
	dir := t.TempDir()
	configPath := filepath.Join(dir, "does-not-exist.toml")

	svc := NewService(defaultCfg(), configPath, noopResolver, nil, nil)
	_, _, isInitialized, err := svc.Get()
	if err != nil {
		t.Fatalf("Get returned error: %v", err)
	}
	if isInitialized {
		t.Error("isInitialized should be false when config.toml does not exist")
	}
}

func TestService_Update_Success(t *testing.T) {
	dir := t.TempDir()
	configPath := filepath.Join(dir, "config.toml")

	svc := NewService(defaultCfg(), configPath, noopResolver, nil, nil)

	newLevel := "debug"
	req := UpdateRequest{
		Logging: &LoggingUpdate{Level: &newLevel},
	}
	updated, _, issues, _, err := svc.Update(req)
	if err != nil {
		t.Fatalf("Update returned error: %v", err)
	}
	if len(issues) > 0 {
		t.Fatalf("unexpected validation issues: %v", issues)
	}
	if updated.Logging.Level != "debug" {
		t.Errorf("Logging.Level = %q, want %q", updated.Logging.Level, "debug")
	}

	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		t.Error("config.toml should have been written")
	}

	cfg, _, _, _ := svc.Get()
	if cfg.Logging.Level != "debug" {
		t.Errorf("in-memory cfg.Logging.Level = %q, want %q", cfg.Logging.Level, "debug")
	}
}

func TestService_Update_EnvOverridesAreNotPersisted(t *testing.T) {
	dir := t.TempDir()
	configPath := filepath.Join(dir, "config.toml")

	disk := appconfig.Default()
	disk.Server.Port = 47590
	disk.Database.Path = "data/dev.db"
	disk.Logging.Level = "warn"
	if err := appconfig.Save(configPath, disk); err != nil {
		t.Fatalf("save initial config: %v", err)
	}

	t.Setenv(appconfig.EnvPort, "47390")
	t.Setenv(appconfig.EnvDBPath, "web/e2e/.tmp/tacpendium-e2e.db")
	t.Setenv(appconfig.EnvLogLevel, "debug")

	runtime, err := appconfig.Load(configPath)
	if err != nil {
		t.Fatalf("load runtime config: %v", err)
	}
	svc := NewService(runtime, configPath, noopResolver, nil, nil)

	characterID := int64(5)
	updated, _, issues, _, err := svc.Update(UpdateRequest{
		Defaults: &DefaultsUpdate{CharacterID: &characterID},
	})
	if err != nil {
		t.Fatalf("Update returned error: %v", err)
	}
	if len(issues) > 0 {
		t.Fatalf("unexpected validation issues: %v", issues)
	}

	if updated.Server.Port != 47390 {
		t.Errorf("runtime Server.Port = %d, want env value 47390", updated.Server.Port)
	}
	if updated.Database.Path != "web/e2e/.tmp/tacpendium-e2e.db" {
		t.Errorf("runtime Database.Path = %q, want E2E env value", updated.Database.Path)
	}
	if updated.Logging.Level != "debug" {
		t.Errorf("runtime Logging.Level = %q, want env value debug", updated.Logging.Level)
	}

	persisted := readPersistedConfig(t, configPath)
	if persisted.Server.Port != 47590 {
		t.Errorf("persisted Server.Port = %d, want original 47590", persisted.Server.Port)
	}
	if persisted.Database.Path != "data/dev.db" {
		t.Errorf("persisted Database.Path = %q, want original %q", persisted.Database.Path, "data/dev.db")
	}
	if persisted.Logging.Level != "warn" {
		t.Errorf("persisted Logging.Level = %q, want original %q", persisted.Logging.Level, "warn")
	}
	if persisted.Defaults.CharacterID != 5 {
		t.Errorf("persisted Defaults.CharacterID = %d, want updated value 5", persisted.Defaults.CharacterID)
	}
}

func TestService_Update_EnvOverridesUseDefaultsWhenConfigDoesNotExist(t *testing.T) {
	dir := t.TempDir()
	configPath := filepath.Join(dir, "config.toml")

	t.Setenv(appconfig.EnvPort, "47390")
	t.Setenv(appconfig.EnvDBPath, "web/e2e/.tmp/tacpendium-e2e.db")
	t.Setenv(appconfig.EnvLogLevel, "debug")

	runtime, err := appconfig.Load(configPath)
	if err != nil {
		t.Fatalf("load runtime config: %v", err)
	}
	svc := NewService(runtime, configPath, noopResolver, nil, nil)

	presetID := int64(3)
	if _, _, issues, _, err := svc.Update(UpdateRequest{
		Defaults: &DefaultsUpdate{PresetID: &presetID},
	}); err != nil {
		t.Fatalf("Update returned error: %v", err)
	} else if len(issues) > 0 {
		t.Fatalf("unexpected validation issues: %v", issues)
	}

	persisted := readPersistedConfig(t, configPath)
	defaults := appconfig.Default()
	if persisted.Server.Port != defaults.Server.Port {
		t.Errorf("persisted Server.Port = %d, want default %d", persisted.Server.Port, defaults.Server.Port)
	}
	if persisted.Database.Path != defaults.Database.Path {
		t.Errorf("persisted Database.Path = %q, want default %q", persisted.Database.Path, defaults.Database.Path)
	}
	if persisted.Logging.Level != defaults.Logging.Level {
		t.Errorf("persisted Logging.Level = %q, want default %q", persisted.Logging.Level, defaults.Logging.Level)
	}
	if persisted.Defaults.PresetID != 3 {
		t.Errorf("persisted Defaults.PresetID = %d, want updated value 3", persisted.Defaults.PresetID)
	}
}

func TestService_Update_WithoutEnvOverridesPersistsFields(t *testing.T) {
	dir := t.TempDir()
	configPath := filepath.Join(dir, "config.toml")

	// 空文字は config.Load と同様に override として扱わない。
	t.Setenv(appconfig.EnvPort, "")
	t.Setenv(appconfig.EnvDBPath, "")
	t.Setenv(appconfig.EnvLogLevel, "")

	svc := NewService(defaultCfg(), configPath, noopResolver, nil, nil)
	port := 49000
	dbPath := "data/updated.db"
	level := "debug"
	_, _, issues, _, err := svc.Update(UpdateRequest{
		Server:   &ServerUpdate{Port: &port},
		Database: &DatabaseUpdate{Path: &dbPath},
		Logging:  &LoggingUpdate{Level: &level},
	})
	if err != nil {
		t.Fatalf("Update returned error: %v", err)
	}
	if len(issues) > 0 {
		t.Fatalf("unexpected validation issues: %v", issues)
	}

	persisted := readPersistedConfig(t, configPath)
	if persisted.Server.Port != port {
		t.Errorf("persisted Server.Port = %d, want %d", persisted.Server.Port, port)
	}
	if persisted.Database.Path != dbPath {
		t.Errorf("persisted Database.Path = %q, want %q", persisted.Database.Path, dbPath)
	}
	if persisted.Logging.Level != level {
		t.Errorf("persisted Logging.Level = %q, want %q", persisted.Logging.Level, level)
	}
}

func TestService_Update_ValidationFailure(t *testing.T) {
	dir := t.TempDir()
	configPath := filepath.Join(dir, "config.toml")

	svc := NewService(defaultCfg(), configPath, noopResolver, nil, nil)

	invalidMode := "invalid"
	req := UpdateRequest{
		Server: &ServerUpdate{Mode: &invalidMode},
	}
	_, _, issues, _, err := svc.Update(req)
	if err != nil {
		t.Fatalf("Update returned unexpected error: %v", err)
	}
	if len(issues) == 0 {
		t.Fatal("expected validation issues, got none")
	}
	if issues[0].Field != "server.mode" {
		t.Errorf("issue.Field = %q, want %q", issues[0].Field, "server.mode")
	}

	if _, err := os.Stat(configPath); !os.IsNotExist(err) {
		t.Error("config.toml should NOT have been written on validation failure")
	}
}

func TestService_Update_RestartRequired(t *testing.T) {
	dir := t.TempDir()
	configPath := filepath.Join(dir, "config.toml")

	cfg := defaultCfg()
	cfg.Server.Mode = "local"
	svc := NewService(cfg, configPath, noopResolver, nil, nil)

	newMode := "lan"
	req := UpdateRequest{
		Server: &ServerUpdate{Mode: &newMode},
	}
	_, _, issues, restartRequired, err := svc.Update(req)
	if err != nil {
		t.Fatalf("Update returned error: %v", err)
	}
	if len(issues) > 0 {
		t.Fatalf("unexpected validation issues: %v", issues)
	}
	if !restartRequired {
		t.Error("restartRequired should be true when mode changes")
	}
}

func TestService_Update_AtomicWrite(t *testing.T) {
	dir := t.TempDir()
	configPath := filepath.Join(dir, "config.toml")
	tmpPath := configPath + ".tmp"

	svc := NewService(defaultCfg(), configPath, noopResolver, nil, nil)

	newLevel := "warn"
	req := UpdateRequest{
		Logging: &LoggingUpdate{Level: &newLevel},
	}
	if _, _, _, _, err := svc.Update(req); err != nil {
		t.Fatalf("Update returned error: %v", err)
	}

	if _, err := os.Stat(tmpPath); !os.IsNotExist(err) {
		t.Error("tmp file should not exist after successful write")
	}
}

func TestService_Update_PartialUpdate(t *testing.T) {
	dir := t.TempDir()
	configPath := filepath.Join(dir, "config.toml")

	cfg := defaultCfg()
	cfg.Server.Port = 47318
	svc := NewService(cfg, configPath, noopResolver, nil, nil)

	newMode := "local"
	req := UpdateRequest{
		Server: &ServerUpdate{Mode: &newMode},
	}
	updated, _, issues, _, err := svc.Update(req)
	if err != nil {
		t.Fatalf("Update returned error: %v", err)
	}
	if len(issues) > 0 {
		t.Fatalf("unexpected validation issues: %v", issues)
	}

	if updated.Server.Port != 47318 {
		t.Errorf("Server.Port = %d, want 47318 (should not change on partial update)", updated.Server.Port)
	}
}

// --- Phase 2 新規テスト ---

func TestService_Get_NetworkLocalMode(t *testing.T) {
	dir := t.TempDir()
	configPath := filepath.Join(dir, "config.toml")

	cfg := defaultCfg()
	cfg.Server.Mode = "local"
	svc := NewService(cfg, configPath, fixedResolver("192.168.1.100"), nil, nil)

	_, network, _, err := svc.Get()
	if err != nil {
		t.Fatalf("Get returned error: %v", err)
	}
	if network.PrimaryLanIp != "" {
		t.Errorf("PrimaryLanIp = %q, want empty for local mode", network.PrimaryLanIp)
	}
	if network.LanUrl != "" {
		t.Errorf("LanUrl = %q, want empty for local mode", network.LanUrl)
	}
}

func TestService_Get_NetworkLanMode(t *testing.T) {
	dir := t.TempDir()
	configPath := filepath.Join(dir, "config.toml")

	cfg := defaultCfg()
	cfg.Server.Mode = "lan"
	cfg.Server.Port = 47318
	svc := NewService(cfg, configPath, fixedResolver("192.168.1.100"), nil, nil)

	_, network, _, err := svc.Get()
	if err != nil {
		t.Fatalf("Get returned error: %v", err)
	}
	if network.PrimaryLanIp != "192.168.1.100" {
		t.Errorf("PrimaryLanIp = %q, want %q", network.PrimaryLanIp, "192.168.1.100")
	}
	if network.LanUrl != "http://192.168.1.100:47318" {
		t.Errorf("LanUrl = %q, want %q", network.LanUrl, "http://192.168.1.100:47318")
	}
}

func TestService_Get_NetworkLanModeFailure(t *testing.T) {
	dir := t.TempDir()
	configPath := filepath.Join(dir, "config.toml")

	cfg := defaultCfg()
	cfg.Server.Mode = "lan"
	svc := NewService(cfg, configPath, noopResolver, nil, nil)

	_, network, _, err := svc.Get()
	if err != nil {
		t.Fatalf("Get returned error: %v", err)
	}
	if network.PrimaryLanIp != "" {
		t.Errorf("PrimaryLanIp = %q, want empty on resolver failure", network.PrimaryLanIp)
	}
	if network.LanUrl != "" {
		t.Errorf("LanUrl = %q, want empty on resolver failure", network.LanUrl)
	}
}

func TestService_Update_DefaultsPartial(t *testing.T) {
	dir := t.TempDir()
	configPath := filepath.Join(dir, "config.toml")

	svc := NewService(defaultCfg(), configPath, noopResolver, nil, nil)

	charID := int64(5)
	req := UpdateRequest{
		Defaults: &DefaultsUpdate{CharacterID: &charID},
	}
	updated, _, issues, _, err := svc.Update(req)
	if err != nil {
		t.Fatalf("Update returned error: %v", err)
	}
	if len(issues) > 0 {
		t.Fatalf("unexpected validation issues: %v", issues)
	}
	if updated.Defaults.CharacterID != 5 {
		t.Errorf("Defaults.CharacterID = %d, want 5", updated.Defaults.CharacterID)
	}
	if updated.Defaults.PresetID != 1 {
		t.Errorf("Defaults.PresetID = %d, want 1 (unchanged)", updated.Defaults.PresetID)
	}
}

func TestService_Update_DefaultsValidationFailure(t *testing.T) {
	dir := t.TempDir()
	configPath := filepath.Join(dir, "config.toml")

	svc := NewService(defaultCfg(), configPath, noopResolver, nil, nil)

	zero := int64(0)
	req := UpdateRequest{
		Defaults: &DefaultsUpdate{CharacterID: &zero},
	}
	_, _, issues, _, err := svc.Update(req)
	if err != nil {
		t.Fatalf("Update returned unexpected error: %v", err)
	}
	if len(issues) == 0 {
		t.Fatal("expected validation issues for characterId=0, got none")
	}
	if issues[0].Field != "defaults.characterId" {
		t.Errorf("issue.Field = %q, want %q", issues[0].Field, "defaults.characterId")
	}
}

// TestService_Update_RejectsTraversalPath は、PUT /api/config 経由のトラバーサルパス
// (database.path の ".." 脱出)が検証で拒否され、config.toml が書かれないことを確認する
// (CHANGE-048)。
func TestService_Update_RejectsTraversalPath(t *testing.T) {
	dir := t.TempDir()
	configPath := filepath.Join(dir, "config.toml")

	svc := NewService(defaultCfg(), configPath, noopResolver, nil, nil)

	badPath := "../../victim.db"
	req := UpdateRequest{
		Database: &DatabaseUpdate{Path: &badPath},
	}
	_, _, issues, _, err := svc.Update(req)
	if err != nil {
		t.Fatalf("Update returned unexpected error: %v", err)
	}
	if len(issues) == 0 {
		t.Fatal("expected validation issues for traversal database.path, got none")
	}
	if issues[0].Field != "database.path" {
		t.Errorf("issue.Field = %q, want %q", issues[0].Field, "database.path")
	}
	if _, statErr := os.Stat(configPath); !os.IsNotExist(statErr) {
		t.Error("config.toml should NOT have been written on validation failure")
	}
}

// TestService_Update_RestartRequiredOnDatabasePath は、database.path 変更時に
// restartRequired=true が返ることを確認する(起動時のみ反映されるため。CHANGE-048 / 1-E)。
func TestService_Update_RestartRequiredOnDatabasePath(t *testing.T) {
	dir := t.TempDir()
	configPath := filepath.Join(dir, "config.toml")

	svc := NewService(defaultCfg(), configPath, noopResolver, nil, nil)

	newPath := "data/relocated.db"
	req := UpdateRequest{
		Database: &DatabaseUpdate{Path: &newPath},
	}
	_, _, issues, restartRequired, err := svc.Update(req)
	if err != nil {
		t.Fatalf("Update returned error: %v", err)
	}
	if len(issues) > 0 {
		t.Fatalf("unexpected validation issues: %v", issues)
	}
	if !restartRequired {
		t.Error("restartRequired should be true when database.path changes")
	}
}

func TestService_Get_DefaultsValues(t *testing.T) {
	dir := t.TempDir()
	configPath := filepath.Join(dir, "config.toml")

	cfg := defaultCfg()
	cfg.Defaults.CharacterID = 3
	cfg.Defaults.PresetID = 7
	svc := NewService(cfg, configPath, noopResolver, nil, nil)

	got, _, _, err := svc.Get()
	if err != nil {
		t.Fatalf("Get returned error: %v", err)
	}
	if got.Defaults.CharacterID != 3 {
		t.Errorf("Defaults.CharacterID = %d, want 3", got.Defaults.CharacterID)
	}
	if got.Defaults.PresetID != 7 {
		t.Errorf("Defaults.PresetID = %d, want 7", got.Defaults.PresetID)
	}
}

// ===========================================================================
// M22-01: [security] の配線
// ===========================================================================

// TestService_SetPasswordHash_Persists は password_hash が config.toml へ書き戻され、
// Security() から読めることを固定する(指示書 §4.1-1)。
func TestService_SetPasswordHash_Persists(t *testing.T) {
	dir := t.TempDir()
	configPath := filepath.Join(dir, "config.toml")

	svc := NewService(defaultCfg(), configPath, noopResolver, nil, nil)
	if got := svc.Security().PasswordHash; got != "" {
		t.Fatalf("PasswordHash should start empty, got %q", got)
	}

	const hash = "pbkdf2-sha256$600000$c2FsdA$ZGVyaXZlZA"
	if err := svc.SetPasswordHash(hash); err != nil {
		t.Fatalf("SetPasswordHash: %v", err)
	}

	if got := svc.Security().PasswordHash; got != hash {
		t.Errorf("Security().PasswordHash = %q, want %q", got, hash)
	}
	if got := readPersistedConfig(t, configPath).Security.PasswordHash; got != hash {
		t.Errorf("persisted password_hash = %q, want %q", got, hash)
	}
}

// TestService_Update_PreservesPasswordHash は PUT /api/config 相当の更新で
// password_hash が落ちないことを固定する(指示書 §3.3-3 の書き戻し経路)。
func TestService_Update_PreservesPasswordHash(t *testing.T) {
	dir := t.TempDir()
	configPath := filepath.Join(dir, "config.toml")

	svc := NewService(defaultCfg(), configPath, noopResolver, nil, nil)
	const hash = "pbkdf2-sha256$600000$c2FsdA$ZGVyaXZlZA"
	if err := svc.SetPasswordHash(hash); err != nil {
		t.Fatalf("SetPasswordHash: %v", err)
	}

	level := "debug"
	if _, _, issues, _, err := svc.Update(UpdateRequest{
		Logging: &LoggingUpdate{Level: &level},
	}); err != nil || len(issues) > 0 {
		t.Fatalf("Update: err=%v issues=%v", err, issues)
	}

	if got := svc.Security().PasswordHash; got != hash {
		t.Errorf("in-memory password_hash = %q, want %q (dropped by Update)", got, hash)
	}
	if got := readPersistedConfig(t, configPath).Security.PasswordHash; got != hash {
		t.Errorf("persisted password_hash = %q, want %q (dropped by Update)", got, hash)
	}
}

// TestService_Update_RejectsEnablingWithoutPassword は、パスワード未設定のまま
// password_enabled を true にできないことを固定する(指示書 §4.1-3 の API 経路)。
func TestService_Update_RejectsEnablingWithoutPassword(t *testing.T) {
	dir := t.TempDir()
	configPath := filepath.Join(dir, "config.toml")

	svc := NewService(defaultCfg(), configPath, noopResolver, nil, nil)
	enabled := true
	_, _, issues, _, err := svc.Update(UpdateRequest{
		Security: &SecurityUpdate{PasswordEnabled: &enabled},
	})
	if err != nil {
		t.Fatalf("Update returned error: %v", err)
	}
	if len(issues) != 1 || issues[0].Field != "security.passwordEnabled" {
		t.Fatalf("issues = %+v, want one issue on security.passwordEnabled", issues)
	}
	if svc.Security().PasswordEnabled {
		t.Error("PasswordEnabled should remain false when the update is rejected")
	}
}

// TestService_Update_AllowsEnablingWithPassword は、パスワード設定済みなら
// password_enabled を true にできることを固定する(上のテストの対照)。
func TestService_Update_AllowsEnablingWithPassword(t *testing.T) {
	dir := t.TempDir()
	configPath := filepath.Join(dir, "config.toml")

	svc := NewService(defaultCfg(), configPath, noopResolver, nil, nil)
	if err := svc.SetPasswordHash("pbkdf2-sha256$600000$c2FsdA$ZGVyaXZlZA"); err != nil {
		t.Fatalf("SetPasswordHash: %v", err)
	}

	enabled := true
	_, _, issues, _, err := svc.Update(UpdateRequest{
		Security: &SecurityUpdate{PasswordEnabled: &enabled},
	})
	if err != nil || len(issues) > 0 {
		t.Fatalf("Update: err=%v issues=%v", err, issues)
	}
	if !svc.Security().PasswordEnabled {
		t.Error("PasswordEnabled should be true after a successful update")
	}
}

// TestService_Update_UnrelatedChangeInInconsistentState は、config.toml を手で書いて
// 「有効かつハッシュ空」になっている状態でも、無関係な設定変更が巻き添えで
// 拒否されないことを固定する(指示書 §4.1-3。ファイル経路は WARN + OFF 扱いで受ける)。
func TestService_Update_UnrelatedChangeInInconsistentState(t *testing.T) {
	dir := t.TempDir()
	configPath := filepath.Join(dir, "config.toml")

	cfg := defaultCfg()
	cfg.Security.PasswordEnabled = true // ハッシュは空のまま
	svc := NewService(cfg, configPath, noopResolver, nil, nil)

	level := "debug"
	_, _, issues, _, err := svc.Update(UpdateRequest{
		Logging: &LoggingUpdate{Level: &level},
	})
	if err != nil {
		t.Fatalf("Update returned error: %v", err)
	}
	if len(issues) > 0 {
		t.Fatalf("unrelated update should not be rejected, got issues = %+v", issues)
	}
}

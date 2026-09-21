package log

import (
	"log/slog"
	"os"
	"path/filepath"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/config"
)

// TestInit_RelativeFileResolvesToAppBaseDir は「相対の logging.file が
// AppBaseDir() 基準へ解決される」ことを固定する(M34-02 段 1)。
//
// ★★これが壊れると誰も気づけない —— ログは書けているが別の場所へ出るだけであり、
// テストも lint も型検査も緑になる。トレイの「ログフォルダを開く」だけが
// 「開いても何も無い」形で外れる。
//
// ★テスト中の AppBaseDir() はカレントディレクトリ(= パッケージディレクトリ)を返すため、
// ここでは Chdir で基準を移してから測る。⇒ 全 OS で同じ判定になる。
func TestInit_RelativeFileResolvesToAppBaseDir(t *testing.T) {
	base := t.TempDir()
	t.Chdir(base)

	cfg := &config.LoggingConfig{
		Level: "info", File: filepath.Join("logs", "tacpendium.log"),
		MaxSizeMB: 1, MaxBackups: 1, MaxAgeDays: 1,
	}
	if err := Init(cfg); err != nil {
		t.Fatalf("Init: %v", err)
	}
	slog.Info("m34-02 段 1 の実測")

	want := filepath.Join(base, "logs", "tacpendium.log")
	if _, err := os.Stat(want); err != nil {
		t.Fatalf("ログが %s に出ていない: %v", want, err)
	}

	// ★cfg を書き換えていないこと。書き換えると PUT /api/config が絶対パスを
	// config.toml へ焼き付ける(log.go の注記)。
	if got := cfg.File; got != filepath.Join("logs", "tacpendium.log") {
		t.Errorf("cfg.File が書き換わっている: %q", got)
	}
}

// TestInit_AbsoluteFileIsUsedVerbatim は絶対パス指定が素通しであることを固定する。
func TestInit_AbsoluteFileIsUsedVerbatim(t *testing.T) {
	dir := t.TempDir()
	other := t.TempDir()
	t.Chdir(other)

	abs := filepath.Join(dir, "sub", "app.log")
	cfg := &config.LoggingConfig{Level: "info", File: abs, MaxSizeMB: 1, MaxBackups: 1, MaxAgeDays: 1}
	if err := Init(cfg); err != nil {
		t.Fatalf("Init: %v", err)
	}
	slog.Info("absolute")
	if _, err := os.Stat(abs); err != nil {
		t.Fatalf("ログが %s に出ていない: %v", abs, err)
	}
}

func TestInit_RejectsBadInput(t *testing.T) {
	if err := Init(nil); err == nil {
		t.Error("nil config を受理した")
	}
	if err := Init(&config.LoggingConfig{Level: "info"}); err == nil {
		t.Error("空の file を受理した")
	}
	if err := Init(&config.LoggingConfig{Level: "nonsense", File: "x.log"}); err == nil {
		t.Error("未知の level を受理した")
	}
}

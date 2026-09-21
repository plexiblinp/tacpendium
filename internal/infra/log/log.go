// Package log は slog の既定ロガーを設定する初期化関数を提供する。
//
// 設計参照: SUPP-001 §5.6(ロギング戦略)。
// - debug 時: テキスト形式、標準出力 + ファイル
// - それ以外: JSON 形式、ファイルのみ
// - lumberjack によるローテーション(MaxSize/MaxBackups/MaxAge は config 由来、Compress=false)
package log

import (
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"strings"

	"github.com/plexiblinp/tacpendium/internal/config"
	"gopkg.in/natefinch/lumberjack.v2"
)

// Init は config を元に slog の既定ロガーをセットアップする。
//
// ローテーションを伴うファイル出力が必須のため、ログディレクトリが無ければ作成する。
func Init(cfg *config.LoggingConfig) error {
	if cfg == nil {
		return fmt.Errorf("log: nil config")
	}

	level, err := parseLevel(cfg.Level)
	if err != nil {
		return err
	}

	if cfg.File == "" {
		return fmt.Errorf("log: empty file path")
	}
	// ★★相対パスは AppBaseDir() 基準へ解決する(M34-02 段 1) ————————————————
	// 既定値 logs/tacpendium.log は相対パスであり、M34-01 の実査までは lumberjack へ
	// verbatim で渡していた。⇒ プロセスのカレントディレクトリ基準で解決されるため、
	// 常駐化して起動経路が増えると(ダブルクリック / ショートカットの作業フォルダ /
	// 将来のスタートアップ登録)ログの出先が起動ごとに動く。
	// ★★トレイの「ログフォルダを開く」は同じ関数で解決した先を開く。⇒ 両者がずれない。
	// ★cfg を書き換えないこと —— PUT /api/config が実行時 Config を config.toml へ
	// 書き戻すため、解決済みの絶対パスを入れると利用者のファイルへ焼き付く。
	file := config.ResolveAppPath(cfg.File)
	if dir := filepath.Dir(file); dir != "" && dir != "." {
		if mkErr := os.MkdirAll(dir, 0o755); mkErr != nil {
			return fmt.Errorf("log: mkdir %q: %w", dir, mkErr)
		}
	}

	rotator := &lumberjack.Logger{
		Filename:   file,
		MaxSize:    cfg.MaxSizeMB,
		MaxBackups: cfg.MaxBackups,
		MaxAge:     cfg.MaxAgeDays,
		Compress:   false,
	}

	var writer io.Writer = rotator
	var handler slog.Handler
	opts := &slog.HandlerOptions{Level: level, AddSource: true}

	if level == slog.LevelDebug {
		writer = io.MultiWriter(os.Stdout, rotator)
		handler = slog.NewTextHandler(writer, opts)
	} else {
		handler = slog.NewJSONHandler(writer, opts)
	}

	slog.SetDefault(slog.New(handler))
	return nil
}

func parseLevel(s string) (slog.Level, error) {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "debug":
		return slog.LevelDebug, nil
	case "info", "":
		return slog.LevelInfo, nil
	case "warn", "warning":
		return slog.LevelWarn, nil
	case "error":
		return slog.LevelError, nil
	default:
		return 0, fmt.Errorf("log: unknown level %q", s)
	}
}

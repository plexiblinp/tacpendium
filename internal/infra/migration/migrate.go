// Package migration は golang-migrate/migrate/v4 を用いて embed.FS 内のマイグレーション
// SQL を SQLite に適用する。
//
// 設計参照: SUPP-001 §2.7、M1-02 指示書 §4.1。
package migration

import (
	"context"
	"database/sql"
	"embed"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"

	"github.com/golang-migrate/migrate/v4"
	sqlitemig "github.com/golang-migrate/migrate/v4/database/sqlite" // modernc.org/sqlite ベースのドライバ(WithInstance 用)
	"github.com/golang-migrate/migrate/v4/source/iofs"

	_ "modernc.org/sqlite" // sql.Open("sqlite", ...) 用にドライバを登録
)

// Run は embed.FS から読み込んだマイグレーションを SQLite DB に適用する。
//
// dbPath は SQLite ファイルへのフルパス、fs は migrations/ をルートに含む embed.FS。
// 既に最新まで適用済みなら no-op として正常終了する(migrate.ErrNoChange を吸収)。
//
// 進捗は slog.Default() に Info レベルで出力する。
//
// リソース解放: `migrate.Migrate.Close()` は内部で source driver / database driver の
// 両方を Close するため、source への明示的な defer Close は **登録しない**(M1-02 機械
// レビュー指摘: defer LIFO により二重 Close になる問題の回避)。
func Run(ctx context.Context, dbPath string, fs embed.FS) error {
	source, err := iofs.New(fs, "migrations")
	if err != nil {
		return fmt.Errorf("migration: build iofs source: %w", err)
	}

	// マイグレーションは main.go の db.Open(親ディレクトリ作成)より前に走るため、
	// ここで DB の親ディレクトリを作成しておく(OS アプリデータディレクトリは
	// 初回起動時に存在しないため。例: Windows %APPDATA%\combomgr\)。
	if dir := filepath.Dir(dbPath); dir != "" && dir != "." {
		if mkErr := os.MkdirAll(dir, 0o755); mkErr != nil {
			_ = source.Close()
			return fmt.Errorf("migration: mkdir %q: %w", dir, mkErr)
		}
	}

	// DSN は database/sql に生のファイルパスとして渡す。
	// 旧実装の "sqlite://" + dbPath 形式は golang-migrate の sqlite ドライバが
	// net/url.Parse でパースするため、Windows の絶対パス(例: C:\Users\...\combomgr.db)
	// が「ホスト C + 不正なポート :\Users...」として解釈され起動不能になる。
	// WithInstance に開済みの *sql.DB を渡すことで URL パースを完全に回避する。
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		_ = source.Close()
		return fmt.Errorf("migration: open db %q: %w", dbPath, err)
	}

	driver, err := sqlitemig.WithInstance(db, &sqlitemig.Config{})
	if err != nil {
		_ = source.Close()
		_ = db.Close()
		return fmt.Errorf("migration: db driver: %w", err)
	}

	m, err := migrate.NewWithInstance("iofs", source, "sqlite", driver)
	if err != nil {
		// NewWithInstance が失敗した場合は m が握れていないので、source / driver を自前で閉じる。
		_ = source.Close()
		_ = driver.Close() // driver.Close() が内部の *sql.DB も閉じる。
		return fmt.Errorf("migration: new instance: %w", err)
	}
	defer func() {
		// migrate.Close は (sourceErr, databaseErr) を返す。source/database の双方を
		// 閉じるため、source の明示 Close は不要(上記 godoc 参照)。エラーは警告ログのみ。
		if srcErr, dbErr := m.Close(); srcErr != nil || dbErr != nil {
			slog.WarnContext(ctx, "migration close",
				slog.Any("source_err", srcErr),
				slog.Any("db_err", dbErr),
			)
		}
	}()

	m.Log = &slogLogger{ctx: ctx}

	currentBefore, _, _ := m.Version()
	slog.InfoContext(ctx, "migration starting",
		slog.Uint64("from_version", uint64(currentBefore)),
		slog.String("db", dbPath),
	)

	if err := m.Up(); err != nil {
		if errors.Is(err, migrate.ErrNoChange) {
			slog.InfoContext(ctx, "migration up-to-date",
				slog.Uint64("version", uint64(currentBefore)),
			)
			return nil
		}
		return fmt.Errorf("migration: up: %w", err)
	}

	currentAfter, dirty, _ := m.Version()
	slog.InfoContext(ctx, "migration completed",
		slog.Uint64("version", uint64(currentAfter)),
		slog.Bool("dirty", dirty),
	)
	return nil
}

// slogLogger は migrate.Logger を満たす slog ブリッジ。
//
// migrate ライブラリは内部から Printf 形式でログを出すが、本アプリは slog 統一のため
// それを slog.Info に橋渡しする。Verbose() = false にして verbose 出力は抑制する。
type slogLogger struct {
	ctx context.Context
}

func (l *slogLogger) Printf(format string, v ...any) {
	slog.InfoContext(l.ctx, fmt.Sprintf(format, v...))
}

func (l *slogLogger) Verbose() bool {
	return false
}

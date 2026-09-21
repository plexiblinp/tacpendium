package db

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// poolProbeConns は回帰ゲートが同時に張る接続の本数。
//
// 16 本は 2026-08-23 の P-04 実測(docs/progress/20260823-m23-08-p04-root-fix-feasibility.md)
// に合わせた値である。DSN 化前の実装では、このうち 15 本が FK=OFF になる。
const poolProbeConns = 16

// connPragmas は 1 接続から読み取ったアプリ標準 PRAGMA の実測値。
type connPragmas struct {
	foreignKeys int
	journalMode string
	busyTimeout int
	synchronous int
}

// readPragmas は 1 本の接続(*sql.Conn)からアプリ標準 PRAGMA 4 種を読む。
// *sql.DB ではなく *sql.Conn を取るのは意図である —— *sql.DB.QueryRow は
// そのつどプールから 1 本借りるため、どの接続を見たのかが決まらない。
func readPragmas(ctx context.Context, c *sql.Conn) (connPragmas, error) {
	var p connPragmas
	if err := c.QueryRowContext(ctx, "PRAGMA foreign_keys").Scan(&p.foreignKeys); err != nil {
		return p, fmt.Errorf("foreign_keys: %w", err)
	}
	if err := c.QueryRowContext(ctx, "PRAGMA journal_mode").Scan(&p.journalMode); err != nil {
		return p, fmt.Errorf("journal_mode: %w", err)
	}
	if err := c.QueryRowContext(ctx, "PRAGMA busy_timeout").Scan(&p.busyTimeout); err != nil {
		return p, fmt.Errorf("busy_timeout: %w", err)
	}
	if err := c.QueryRowContext(ctx, "PRAGMA synchronous").Scan(&p.synchronous); err != nil {
		return p, fmt.Errorf("synchronous: %w", err)
	}
	return p, nil
}

// TestOpen_AllPooledConnectionsHaveAppPragmas は ★M23-10 の回帰ゲート本体である。
//
// 主張: Open が返すプールから同時に張った接続の「すべて」で、アプリ標準 PRAGMA
// 4 種が効いている。
//
// ★★書き換え禁止事項(M23-10 §4.2-2) ————————————————————————————————
// 接続を 1 本ずつ取って返す形(Conn() → 読む → Close() の繰り返し)に
// 書き換えてはならない。database/sql のプールは返された接続を再利用するため、
// 常に同じ 1 本 —— DSN 化前の実装で唯一 PRAGMA が届いていた接続 —— だけを
// 見ることになり、壊れた実装のままでも緑になる。何も守らないテストになる。
// ⇒ poolProbeConns 本すべてを「先に掴み切って」から読むこと。
//
// ★SetMaxOpenConns は呼ばない(M23-10 §1.5-3)。プール上限が無いからこそ
// 同時要求が別々の接続になる。上限を入れると本テストの前提が消える。
func TestOpen_AllPooledConnectionsHaveAppPragmas(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "fkgate.db")
	conn, err := Open(dbPath)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	t.Cleanup(func() { _ = conn.Close() })

	// ★Conn() はプール上限に達すると空きが出るまでブロックする。db.Open は
	// SetMaxOpenConns を呼ばない(M23-10 §1.5-3)が、将来 16 未満の上限が入ると
	// 本テストは「赤くなる」のではなく「ハングする」——出るのは test timed out で
	// あり原因が読めない。⇒ 期限を切って、読めるメッセージで落とす。
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// ── 1) 同時に掴む ───────────────────────────────────────────────
	holds := make([]*sql.Conn, 0, poolProbeConns)
	t.Cleanup(func() {
		for _, c := range holds {
			_ = c.Close()
		}
	})
	for i := 0; i < poolProbeConns; i++ {
		c, connErr := conn.Conn(ctx)
		if connErr != nil {
			if errors.Is(connErr, context.DeadlineExceeded) {
				t.Fatalf("接続 %d を掴めないまま期限切れ。プール上限(SetMaxOpenConns)が "+
					"%d 未満で入った可能性がある。本テストは上限が無いことを前提にしている", i, poolProbeConns)
			}
			t.Fatalf("Conn(%d): %v", i, connErr)
		}
		holds = append(holds, c)
	}

	// ── 2) 掴んだまま 1 本ずつ読む ─────────────────────────────────
	var bad []string
	for i, c := range holds {
		p, readErr := readPragmas(ctx, c)
		if readErr != nil {
			t.Fatalf("接続 %d の PRAGMA 読取: %v", i, readErr)
		}
		var issues []string
		if p.foreignKeys != 1 {
			issues = append(issues, fmt.Sprintf("foreign_keys=%d(want 1)", p.foreignKeys))
		}
		if strings.ToLower(p.journalMode) != "wal" {
			issues = append(issues, fmt.Sprintf("journal_mode=%q(want wal)", p.journalMode))
		}
		if p.busyTimeout != 5000 {
			issues = append(issues, fmt.Sprintf("busy_timeout=%d(want 5000)", p.busyTimeout))
		}
		if p.synchronous != 1 {
			issues = append(issues, fmt.Sprintf("synchronous=%d(want 1=NORMAL)", p.synchronous))
		}
		if len(issues) > 0 {
			bad = append(bad, fmt.Sprintf("  接続 %2d: %s", i, strings.Join(issues, " / ")))
		}
	}
	if len(bad) > 0 {
		t.Errorf("同時に張った %d 接続のうち %d 本でアプリ標準 PRAGMA が効いていない:\n%s",
			poolProbeConns, len(bad), strings.Join(bad, "\n"))
	}
}

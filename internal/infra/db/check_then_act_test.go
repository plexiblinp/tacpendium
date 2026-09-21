package db_test

import (
	"context"
	"database/sql"
	"fmt"
	"sync"
	"testing"
)

// M24-11 §4.4: 「検査と書き込みを同じ書き込みトランザクションの内側に置けば、
// BEGIN IMMEDIATE によってそのまま守られる」という主張を機構として固定する。
//
// ★★なぜここに置くのか(実物の VAL-P05 ではなく)——————————————————
// VAL-P05(プリセット上限 8 件)は internal/service/preset/ にあり、同パッケージは
// 契約 F-1 の凍結対象である(指示書 M24-11 §2.2)。テストであってもファイルを足せば
// 差分になる。⇒ 実装は読んで確かめるに留め(preset/service.go:166 の
// CountPresets(ctx, tx) が INSERT と同じ tx の内側にある)、その形が守られる根拠
// である「機構」の側をここで固定する。
//
// ★本テストが赤くなったら、VAL-P05 の「そのまま守られる」という判定も同時に崩れる。

// TestCheckThenActInsideTxIsSerialized は、同一トランザクション内で
// 「数える → 上限未満なら書く」を行う 2 本が同時に走っても上限を越えないことを示す。
//
// ★★緑が意味を持つ形にしてある(レビュー指摘 中-3 の是正)——————————————
// 当初は goroutine のエラーを無言で握り潰し、判定も「越えていないこと」だけだった。
// その形では 2 本とも早期にエラーで抜けた場合(items が 0 件)も緑になり、
// 「上限が守られた」のか「そもそも誰も書けなかった」のか区別が付かない。
// ⇒ (a) エラーを回収して報告する (b) 判定を「ちょうど limit 件」にする。
// 片方が弾かれたのではなく「片方が待って、見えるようになった上限で引き返した」ことを主張する。
func TestCheckThenActInsideTxIsSerialized(t *testing.T) {
	conn := newCounterDB(t)
	const limit = 1

	errC := make(chan error, 2)
	var wg sync.WaitGroup
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			errC <- checkThenActInsideTx(conn, limit)
		}()
	}
	wg.Wait()
	close(errC)

	// ★エラーを握り潰さない。ここが空振り緑を防ぐ要である。
	for err := range errC {
		if err != nil {
			t.Fatalf("tx の内側の検査 → 書き込みが失敗した: %v。"+
				"BEGIN IMMEDIATE 下でも待って通るはずであり、失敗するなら前提が違う", err)
		}
	}

	// ★★「ちょうど limit 件」を主張する。「越えていない」だけでは 0 件でも緑になる。
	if got := countItems(t, conn); got != limit {
		t.Errorf("items = %d 件(期待ちょうど %d 件)。"+
			"越えていれば直列化が効いておらず、下回っていれば誰も書けていない"+
			"＝VAL-P05 の「そのまま守られる」判定の根拠が崩れる", got, limit)
	}
}

// checkThenActInsideTx は「数える → 上限未満なら書く」を 1 つのトランザクションで行う。
// ★VAL-P05 の実装(preset/service.go:166 の CountPresets(ctx, tx) → CreatePresetTx)と同じ形である。
func checkThenActInsideTx(conn *sql.DB, limit int) error {
	ctx := context.Background()
	tx, err := conn.BeginTx(ctx, nil) // BEGIN IMMEDIATE
	if err != nil {
		return fmt.Errorf("begin: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	var n int
	if err := tx.QueryRowContext(ctx, `SELECT COUNT(*) FROM items`).Scan(&n); err != nil {
		return fmt.Errorf("count: %w", err)
	}
	if n >= limit {
		return nil // 上限に達している。引き返すのが正しい振る舞いである
	}
	if _, err := tx.ExecContext(ctx, `INSERT INTO items DEFAULT VALUES`); err != nil {
		return fmt.Errorf("insert: %w", err)
	}
	return tx.Commit()
}

// TestCheckThenActOutsideTxIsNotSerialized は対照である。
//
// ★★対照が「発火しないことがある」形だったのを是正した(レビュー指摘 中-3)——————
// 当初は「上限を越えたら t.Logf」だけで、越えなければ何も主張しなかった。実行時に
// 発火せず、「両方を並べて初めて効いていると言える」という主張が成立していなかった。
//
// ⇒ 主張を「越えること」(競合の当たり方に依存＝flaky)から
//
//	「2 本とも INSERT に到達できること」(構造的に決定論)へ変えた。
//	検査を tx の外で済ませた 2 本は、互いの書き込みを見ないまま両方が書きに進む。
//	これは BEGIN IMMEDIATE があっても防げない——直列化されるのは書き込みの順序だけで、
//	「古い判定に基づいて書く」ことは止められないからである。
func TestCheckThenActOutsideTxIsNotSerialized(t *testing.T) {
	conn := newCounterDB(t)
	const limit = 1
	ctx := context.Background()

	// 2 本とも「まだ 0 件」を tx の外で観測する(check-then-act の check)
	counts := make([]int, 2)
	for i := range counts {
		if err := conn.QueryRowContext(ctx, `SELECT COUNT(*) FROM items`).Scan(&counts[i]); err != nil {
			t.Fatalf("count %d: %v", i, err)
		}
	}
	for i, n := range counts {
		if n >= limit {
			t.Fatalf("前提が崩れている: %d 本目の観測が既に %d 件(期待 0 件)", i, n)
		}
	}

	// 観測が古いまま 2 本とも書きに進む(act)。BEGIN IMMEDIATE は順序を直列化するだけで、
	// 「古い判定に基づく書き込み」は止めない。
	for i := range counts {
		tx, err := conn.BeginTx(ctx, nil)
		if err != nil {
			t.Fatalf("begin %d: %v", i, err)
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO items DEFAULT VALUES`); err != nil {
			_ = tx.Rollback()
			t.Fatalf("insert %d: %v", i, err)
		}
		if err := tx.Commit(); err != nil {
			t.Fatalf("commit %d: %v", i, err)
		}
	}

	// ★★上限を越える。これが「検査を tx の外へ出すと守られない」ことの逐語である。
	if got := countItems(t, conn); got <= limit {
		t.Errorf("items = %d 件(期待 %d 件超)。"+
			"検査を tx の外へ出しても越えないなら、対照が成立しておらず"+
			"上のテストの緑が「tx の内側だから守られた」ことの証明にならない", got, limit)
	}
}

func newCounterDB(t *testing.T) *sql.DB {
	t.Helper()
	conn := openTempDB(t)
	if _, err := conn.Exec(`CREATE TABLE items (id INTEGER PRIMARY KEY AUTOINCREMENT)`); err != nil {
		t.Fatalf("create table: %v", err)
	}
	return conn
}

func countItems(t *testing.T, conn *sql.DB) int {
	t.Helper()
	var n int
	if err := conn.QueryRow(`SELECT COUNT(*) FROM items`).Scan(&n); err != nil {
		t.Fatalf("count items: %v", err)
	}
	return n
}

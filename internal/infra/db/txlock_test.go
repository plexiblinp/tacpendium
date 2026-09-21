package db_test

import (
	"context"
	"database/sql"
	"path/filepath"
	"testing"
	"time"

	"github.com/plexiblinp/tacpendium/internal/infra/db"
)

// M24-11 / CHANGE-136: DSN の _txlock=immediate が「書き込みトランザクションだけ」に
// 効いていることを固定する。
//
// ★★なぜ「BEGIN IMMEDIATE と書いてあること」ではなく振る舞いを見るのか——————
// 発行しているのはドライバであり、アプリのコードに BEGIN の文字列は現れない。
// 文字列を検査する術が無いうえ、仮に検査できても「その文字列が実際にロックを
// 早く取ったか」は別の主張である。⇒ ロックを取る時刻の違いそのものを観測する。
//
//	DEFERRED: BeginTx は何もロックしない ⇒ 2 本目の BeginTx は即座に返る
//	IMMEDIATE: BeginTx が write lock を取る ⇒ 2 本目は 1 本目が終わるまで返らない
//
// ★1 本目は文を 1 つも実行しない。これが要である——文を実行してしまうと DEFERRED でも
// write lock を取ってしまい、2 つのモードの差が消えて検査が空振りする
// (「その壊し方で観測が動くか」＝playbook §4.32)。

// txLockHoldFor は 1 本目が write lock を保持する時間。
// ★確率を上げるための待ちではない。2 本目が「待たされた／待たされなかった」を
// 判別できるだけの幅として置いている。
const txLockHoldFor = 400 * time.Millisecond

func openTempDB(t *testing.T) *sql.DB {
	t.Helper()
	conn, err := db.Open(filepath.Join(t.TempDir(), "txlock.db"))
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	t.Cleanup(func() { _ = conn.Close() })
	return conn
}

// beginElapsed は tx1 を保持したまま opts で 2 本目を開き、開くのに要した時間を返す。
func beginElapsed(t *testing.T, conn *sql.DB, opts *sql.TxOptions) time.Duration {
	t.Helper()
	ctx := context.Background()

	tx1, err := conn.BeginTx(ctx, nil) // 書き込み tx(文は実行しない)
	if err != nil {
		t.Fatalf("begin tx1: %v", err)
	}

	elapsedC := make(chan time.Duration, 1)
	errC := make(chan error, 1)
	startedC := make(chan struct{})

	go func() {
		close(startedC)
		begin := time.Now()
		tx2, err2 := conn.BeginTx(ctx, opts)
		elapsed := time.Since(begin)
		if err2 != nil {
			errC <- err2
			return
		}
		_ = tx2.Rollback()
		elapsedC <- elapsed
	}()

	<-startedC
	time.Sleep(txLockHoldFor)
	if err := tx1.Rollback(); err != nil {
		t.Fatalf("rollback tx1: %v", err)
	}

	select {
	case err := <-errC:
		t.Fatalf("begin tx2: %v", err)
		return 0
	case d := <-elapsedC:
		return d
	case <-time.After(30 * time.Second):
		t.Fatal("begin tx2 が返らない")
		return 0
	}
}

// TestOpen_WriteTxUsesBeginImmediate は書き込み tx が開始時点で write lock を取ることを
// 主張する。★_txlock=immediate を DSN から外すとこのテストが赤くなる(破壊確認 1)。
func TestOpen_WriteTxUsesBeginImmediate(t *testing.T) {
	elapsed := beginElapsed(t, openTempDB(t), nil)
	if elapsed < txLockHoldFor {
		t.Errorf("2 本目の BeginTx が待たされていない(所要 %v < 保持 %v)。"+
			"書き込み tx が BEGIN IMMEDIATE で開いていない＝DEFERRED へ戻っている", elapsed, txLockHoldFor)
	}
}

// TestOpen_ReadOnlyTxDoesNotUseBeginImmediate は読み取り専用 tx が write lock を
// 取らないことを主張する(指示書 M24-11 §4.1.2「読み取り専用は含めない」)。
//
// ★★本テストが守っているのはドライバの分岐である——modernc.org/sqlite v1.50.0 の
// tx.go:22-25 が opts.ReadOnly を見て beginMode を外す。ドライバを上げたときに
// この性質が失われたら、ここで気づける。
//
// ★本リポジトリに読み取り専用 tx は現時点で 0 件である。⇒ 本テストは
// 「今そう書かれている」ことの検査ではなく、「そう書けば除外される」ことの検査であり、
// 正しい書き方の先例でもある。
func TestOpen_ReadOnlyTxDoesNotUseBeginImmediate(t *testing.T) {
	elapsed := beginElapsed(t, openTempDB(t), &sql.TxOptions{ReadOnly: true})
	if elapsed >= txLockHoldFor {
		t.Errorf("読み取り専用 tx が write lock を待っている(所要 %v >= 保持 %v)。"+
			"不要に write lock を取っている＝ReadOnly の除外が効いていない", elapsed, txLockHoldFor)
	}
}

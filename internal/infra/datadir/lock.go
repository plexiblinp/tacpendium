package datadir

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"
)

// lockFileName は旧ディレクトリ直下に置く移行ロック。
//
// ★★ロックと作業領域を分けてある ————————————————————————————————————
// 「作業ディレクトリを排他作成してロック代わりにする」形は、中断すると永久に残り、
// 以後の起動が毎回はじかれる。M28-01 指示書 §2.3-6 が求めるのは
// 「中断したら旧が正本のまま残る」であって「以後起動できない」ではない。
// ⇒ ロックは寿命つきの小さなファイル、作業領域は毎回ユニークな一時ディレクトリにする。
const lockFileName = ".migrating.lock"

// lockStaleAfter を超えて更新されていないロックは、落ちたプロセスの置き土産とみなす。
// 数 MB の SQLite のコピーはミリ秒で終わるため、5 分は十分に安全側である。
const lockStaleAfter = 5 * time.Minute

// lockInfo はロックファイルの中身。人が読んで状況を判断できるようにしてある。
type lockInfo struct {
	PID       int       `json:"pid"`
	Host      string    `json:"host"`
	StartedAt time.Time `json:"started_at"`
}

// acquireLock は oldDir 配下にロックを作る。既に生きたロックがあれば held=true を返す。
// 期限切れのロックは取り除いて取り直す。
//
// ★寿命の判定に time.Now() を使う(呼出側が渡す Now ではない)。比較相手がファイルの
// mtime であり、同じ時計から取らないと「作った直後のロックが期限切れに見える」ことが起きる。
// 呼出側の Now は退避先の日付ラベルにだけ使う。
func acquireLock(oldDir string) (release func(), held bool, err error) {
	now := time.Now()
	path := filepath.Join(oldDir, lockFileName)

	for attempt := 0; attempt < 2; attempt++ {
		f, openErr := os.OpenFile(path, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o600)
		if openErr == nil {
			host, _ := os.Hostname()
			body, _ := json.Marshal(lockInfo{PID: os.Getpid(), Host: host, StartedAt: now})
			_, writeErr := f.Write(body)
			syncErr := f.Sync()
			closeErr := f.Close()
			if writeErr != nil || syncErr != nil || closeErr != nil {
				_ = os.Remove(path)
				return nil, false, fmt.Errorf("datadir: write lock %q: %w", path, firstErr(writeErr, syncErr, closeErr))
			}
			return func() { _ = os.Remove(path) }, false, nil
		}
		if !os.IsExist(openErr) {
			return nil, false, fmt.Errorf("datadir: create lock %q: %w", path, openErr)
		}

		fi, statErr := os.Stat(path)
		if statErr != nil {
			// 直前に他プロセスが外した。もう一度だけ取りに行く。
			continue
		}
		if now.Sub(fi.ModTime()) < lockStaleAfter {
			return nil, true, nil
		}
		// 期限切れ。取り除いて 1 度だけ取り直す。
		if rmErr := os.Remove(path); rmErr != nil && !os.IsNotExist(rmErr) {
			return nil, true, nil
		}
	}
	return nil, true, nil
}

func firstErr(errs ...error) error {
	for _, e := range errs {
		if e != nil {
			return e
		}
	}
	return nil
}

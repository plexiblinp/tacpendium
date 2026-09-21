package db

import (
	"errors"

	"modernc.org/sqlite"
	sqlite3 "modernc.org/sqlite/lib"
)

// IsBusy は err が SQLite の「今は書けない」系の結果コードかを判定する
// (M24-11 / CHANGE-136)。
//
// ★★なぜ本サブで要るのか———————————————————————————————————
// BEGIN IMMEDIATE は開始時点で write lock を取りにいく。取れなければ busy_timeout
// (5 秒)ぶん待ち、それでも取れなければ SQLITE_BUSY を返す。この応答は DES-002 §4.2 の
// 経路表に載っていなかった——それまで到達しなかったからではなく、到達しても
// 500 internal_error に紛れて見分けが付かなかったからである。
//
// ★★判定に含めるもの———————————————————————————————————————
//   - SQLITE_BUSY(5)   別の接続が write lock を握っている
//   - SQLITE_LOCKED(6) 同一接続内での衝突。★書き込み tx の内側から非 tx の書きを
//     撃った場合がこれに当たる(SUPP-001 §7.1.1-3)
//
// 下位 8 bit だけを見るのは、SQLite が拡張結果コード(SQLITE_BUSY_SNAPSHOT 等)を
// 上位 bit に載せて返すためである。素の等値比較だと拡張形を取りこぼす。
func IsBusy(err error) bool {
	if err == nil {
		return false
	}
	var e *sqlite.Error
	if !errors.As(err, &e) {
		return false
	}
	switch e.Code() & 0xff {
	case sqlite3.SQLITE_BUSY, sqlite3.SQLITE_LOCKED:
		return true
	default:
		return false
	}
}

package datadir

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"time"
)

// noticeFileName はデータ移行の告知を残すファイル。データディレクトリ直下に置く。
const noticeFileName = ".migration-notice.json"

// Notice は「データの保存場所が変わった」ことを利用者へ 1 度だけ伝えるための記録。
//
// ★★プロセス内のフラグでは足りない ————————————————————————————————————
// M28-01 指示書 §2.3-5 は「起動ログと画面に 1 度だけ出す」を求める。移行が走った起動で
// 利用者がブラウザを開かなければ、メモリ上のフラグはそのまま消えて誰にも伝わらない。
// ⇒ ファイルに残し、利用者が閉じたら acknowledged を立てる。
//
// ★ブラウザストレージは使わない。CLAUDE.md §10.X の台帳に載っていないキーを増やすと
// check-browser-storage-keys.sh が赤くなり、台帳への追記は設計卓の手番になる。
type Notice struct {
	Status         Status    `json:"status"`
	Reason         Reason    `json:"reason,omitempty"`
	Message        string    `json:"message"`
	From           string    `json:"from,omitempty"`
	To             string    `json:"to,omitempty"`
	RetiredTo      string    `json:"retiredTo,omitempty"`
	RetireFailed   bool      `json:"retireFailed,omitempty"`
	At             time.Time `json:"at"`
	Acknowledged   bool      `json:"acknowledged"`
	AcknowledgedAt time.Time `json:"acknowledgedAt,omitempty"`
}

// NoticeFor は Result から告知を組み立てる。告知が要らない結果なら ok=false を返す。
//
// ★skip は告知しない —— ただし「新旧の両方が在る」だけは別である。
// 旧に利用者のデータが残っているのに移行していない状態であり、黙っていてよくない。
func NoticeFor(res Result) (Notice, bool) {
	switch {
	case res.Status == StatusMigrated,
		res.Status == StatusFailed,
		res.Status == StatusSkipped && res.Reason == ReasonNewDBExists,
		res.Status == StatusSkipped && res.Reason == ReasonOldDataStranded:
	default:
		return Notice{}, false
	}
	return Notice{
		Status:       res.Status,
		Reason:       res.Reason,
		Message:      res.Message,
		From:         res.OldDir,
		To:           res.NewDir,
		RetiredTo:    res.RetiredDir,
		RetireFailed: res.RetireFailed,
		At:           res.At,
	}, true
}

// WriteNotice は dir 直下へ告知を保存する。
func WriteNotice(dir string, n Notice) error {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("datadir: mkdir %q: %w", dir, err)
	}
	data, err := json.MarshalIndent(n, "", "  ")
	if err != nil {
		return fmt.Errorf("datadir: encode notice: %w", err)
	}
	path := filepath.Join(dir, noticeFileName)
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return fmt.Errorf("datadir: write notice: %w", err)
	}
	if err := os.Rename(tmp, path); err != nil {
		_ = os.Remove(tmp)
		return fmt.Errorf("datadir: replace notice: %w", err)
	}
	return nil
}

// ReadNotice は dir 直下の告知を読む。無ければ ok=false。
func ReadNotice(dir string) (Notice, bool, error) {
	data, err := os.ReadFile(filepath.Join(dir, noticeFileName))
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return Notice{}, false, nil
		}
		return Notice{}, false, fmt.Errorf("datadir: read notice: %w", err)
	}
	var n Notice
	if err := json.Unmarshal(data, &n); err != nil {
		// 壊れた告知でアプリを止めない。告知が無いものとして扱う。
		return Notice{}, false, nil
	}
	return n, true, nil
}

// AckNotice は告知を「読んだ」状態にする。
//
// ★消さない。移行が起きたことの記録は残す(後から経緯を追えるようにするため)。
func AckNotice(dir string, now time.Time) error {
	n, ok, err := ReadNotice(dir)
	if err != nil || !ok {
		return err
	}
	if n.Acknowledged {
		return nil
	}
	n.Acknowledged = true
	n.AcknowledgedAt = now
	return WriteNotice(dir, n)
}

// UpsertNotice は告知を保存する。
//
// ★★規則は 1 本 ——「完全に解決した状態だけが 1 度だけ。未解決の状態は毎回」——————
// 閉じた印(Acknowledged)を保つのは **StatusMigrated かつ旧を退避済み** のときだけにする。
// それ以外(検証の失敗 ／ 新旧の両方が在る ／ データが取り残されている)は
// **毎起動で上書きし、Acknowledged を false へ戻す**。
//
// ★根拠は開発者裁定(2026-09-05・M28-01 追補 条件 (b))の逐語:
// 「1 度だけだと、利用者は旧のまま動き続けていることに気づけません」。
// 未解決の状態を ack で永久に隠すと、まさにそれが起きる。
//
// ★逆に、解決済みの状態まで毎回出すと催促になる。旧を消すのは開発者の手番であり
// (D-196)、意図して先送りしている作業を毎起動で突くとバナーを無視する習慣ができる。
//
// ★★未解決の状態は「解決すれば自然に消える」。旧を消すか畳めば次回は
// no_legacy_dir になり告知そのものが作られない。⇒ 永久に出続けるのではない。
func UpsertNotice(dir string, n Notice) error {
	if keepsAcknowledgement(n) {
		if existing, ok, err := ReadNotice(dir); err == nil && ok && sameSituation(existing, n) {
			return nil
		}
	}
	return WriteNotice(dir, n)
}

// keepsAcknowledgement は「閉じたら二度と出さなくてよい」状態かを返す。
//
//	移行できた                     → 出さない。用は済んでいる
//	新旧の両方が在る(新にデータ在り) → 出さない。旧はただの控えであり、
//	                                 消すのは開発者の手番(D-196)。催促しない
//	★検証に失敗した               → **毎回出す**。旧のまま動き続けていることに
//	                                 気づけなくなる
//	★データが取り残されている     → **毎回出す**。開いているのが空の DB であり、
//	                                 気づかなければコンボが消えたのと同じ
func keepsAcknowledgement(n Notice) bool {
	switch {
	case n.Status == StatusMigrated:
		return true
	case n.Status == StatusSkipped && n.Reason == ReasonNewDBExists:
		return true
	default:
		return false
	}
}

// sameSituation は 2 つの告知が同じ状況を指しているかを返す。
func sameSituation(a, b Notice) bool {
	return a.Status == b.Status &&
		a.Reason == b.Reason &&
		a.From == b.From &&
		a.To == b.To &&
		a.RetiredTo == b.RetiredTo &&
		a.Message == b.Message
}

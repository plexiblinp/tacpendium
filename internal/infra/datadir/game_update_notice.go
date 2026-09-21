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

// gameUpdateNoticeFileName はゲーム更新の告知の「延期」を残すファイル。
// データディレクトリ直下(= filepath.Dir(dbPath))に置く。
const gameUpdateNoticeFileName = ".game-update-notice.json"

// GameUpdateNotice は「ゲーム更新の告知バナーを次の版まで出さない」という記録
// (FR702・M28-02c / CHANGE-162 §2.3)。
//
// ★★保存先がサーバ側のファイルである理由 ————————————————————————————
// コンボは利用者ごとの所有物ではない(combos に user_id が無く、所有者を持つのは
// tags だけである)。⇒ 影響コンボの集合はアプリ全体で 1 つであり、その告知の延期も
// アプリ全体が素直である。★LAN で 1 人の延期が全員に効くことを許容する。
//
// ★★ただし条件が 1 つある —— 延期が抑止するのはバナーだけであり、
// 一覧のボタンは抑止しない。ボタンまで消すと LAN で他の利用者が入口を失う。
// ⇒ ここが分水嶺である。この 1 行を消さないこと。
//
// ★ブラウザストレージは使わない(CLAUDE.md §10.X の台帳に無いキーを増やさない)。
// ★DB 列も使わない(マイグレを消費しない)。
type GameUpdateNotice struct {
	// PostponedForVersion は「この版のあいだは出さない」と決めた版数。
	// ⇒ games.current_data_version と一致する間だけ抑止する。版が上がれば自然に外れる。
	PostponedForVersion string    `json:"postponedForVersion"`
	At                  time.Time `json:"at"`
}

// gameUpdateNoticePath は告知ファイルのパスを返す。
func gameUpdateNoticePath(dir string) string {
	return filepath.Join(dir, gameUpdateNoticeFileName)
}

// WriteGameUpdateNotice は dir 直下へ延期の記録を保存する。
//
// ★書き方は .migration-notice.json と同じ tmp → rename である
// (途中で落ちても壊れた JSON を残さない)。
func WriteGameUpdateNotice(dir string, n GameUpdateNotice) error {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("datadir: mkdir %q: %w", dir, err)
	}
	data, err := json.MarshalIndent(n, "", "  ")
	if err != nil {
		return fmt.Errorf("datadir: encode game update notice: %w", err)
	}
	path := gameUpdateNoticePath(dir)
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return fmt.Errorf("datadir: write game update notice: %w", err)
	}
	if err := os.Rename(tmp, path); err != nil {
		_ = os.Remove(tmp)
		return fmt.Errorf("datadir: replace game update notice: %w", err)
	}
	return nil
}

// ReadGameUpdateNotice は dir 直下の延期の記録を読む。無ければ ok=false。
//
// ★壊れた JSON でアプリを止めない —— 「延期していない」として扱う。
// ⇒ 告知が出るのは安全側である(出し漏らすより出しすぎるほうがよい。FR307 と同じ向き)。
func ReadGameUpdateNotice(dir string) (GameUpdateNotice, bool, error) {
	data, err := os.ReadFile(gameUpdateNoticePath(dir))
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return GameUpdateNotice{}, false, nil
		}
		return GameUpdateNotice{}, false, fmt.Errorf("datadir: read game update notice: %w", err)
	}
	var n GameUpdateNotice
	if err := json.Unmarshal(data, &n); err != nil {
		return GameUpdateNotice{}, false, nil
	}
	if n.PostponedForVersion == "" {
		return GameUpdateNotice{}, false, nil
	}
	return n, true, nil
}

// PostponeGameUpdateNotice は「この版のあいだはバナーを出さない」を記録する。
//
// ★版数はクライアントから受けない。呼び手(サーバ)が games.current_data_version を
// 読んで渡す(acknowledge-version が「版数をクライアントから受けない」を選んだのと同型)。
func PostponeGameUpdateNotice(dir, currentDataVersion string, now time.Time) error {
	return WriteGameUpdateNotice(dir, GameUpdateNotice{
		PostponedForVersion: currentDataVersion,
		At:                  now,
	})
}

// PostponedForCurrentVersion は「いま抑止が効いているか」を返す。
//
// ★★版が上がったら抑止は外れる —— 記録した版と現在版が一致するときだけ効く。
// ⇒ 次のゲーム更新では黙って握り潰されない。
func PostponedForCurrentVersion(dir, currentDataVersion string) (string, bool, error) {
	n, ok, err := ReadGameUpdateNotice(dir)
	if err != nil || !ok {
		return "", false, err
	}
	if n.PostponedForVersion != currentDataVersion {
		return n.PostponedForVersion, false, nil
	}
	return n.PostponedForVersion, true, nil
}

// RemoveGameUpdateNotice は延期の記録を消す。
//
// ★★本番に「延期の解除」という操作は無い(版が上がれば自然に外れる)。⇒ これは
// テストが共有状態を元へ戻すための口である(D-399 (1))。呼び手は debug ビルドの
// ハンドラだけであり、本番の経路からは呼ばれない。
func RemoveGameUpdateNotice(dir string) error {
	if err := os.Remove(gameUpdateNoticePath(dir)); err != nil && !errors.Is(err, fs.ErrNotExist) {
		return fmt.Errorf("datadir: remove game update notice: %w", err)
	}
	return nil
}

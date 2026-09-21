// Package config は config.toml の読込とデフォルト値を提供する。
//
// 設計参照: SUPP-001 §5.8(設定ファイルフォーマット)、§5.6(ロギング戦略)。
package config

import (
	"bytes"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/BurntSushi/toml"
	"github.com/plexiblinp/tacpendium/internal/infra/db"
)

// 環境変数キー。
const (
	EnvLogLevel = "TACPENDIUM_LOG_LEVEL"
	// EnvDBPath は database.path の一時上書き(開発・テスト用途。E2E の使い捨て DB 等)。
	// 通常の validate()(ValidateDataPath)を同様に通るため、指定できるパスの制約は
	// config.toml と同一。注意: PUT /api/config は実行時 cfg を起点に config.toml を
	// 書き戻すため、この上書きが有効な状態で設定変更 API を呼ぶと上書き値がファイルに
	// 焼き付く(EnvLogLevel と同種の既知制約。PersistPort のコメント参照)。
	EnvDBPath = "TACPENDIUM_DB_PATH"
	// EnvPort は server.port の一時上書き(開発・テスト用途。E2E の専用ポート等。
	// 並行レーンの開発サーバと config.toml のポートを取り合わないために使う)。
	// 数値として解釈できない値は無視する。validate() の範囲チェックは通常どおり適用。
	// EnvDBPath と同じ焼き付き制約あり。main.go の L-04 フォールバック永続化は
	// 本上書きが有効な間はスキップされる(config.toml の port を汚さない)。
	EnvPort = "TACPENDIUM_PORT"
	// EnvConfigPath は設定ファイル自体の置き場所の一時上書き(開発・テスト用途。
	// E2E の使い捨て config 等)。未設定なら従来どおりアプリ実行ディレクトリ直下の
	// config.toml を読む(既定の挙動は不変。CHANGE-135)。
	//
	// ★★なぜ要るのか(M24-09c 追補)————————————————————————————————
	// E2E は使い捨て DB と専用ポートで dev から分離しているつもりだったが、
	// 設定ファイルだけは dev と同じ実ファイルを読んでいた。⇒ 開発者が設定画面で
	// 既定キャラを変えると、その値が段 3b として E2E の画面に効き、
	// 「リュウが出ること」を前提にした spec が 35 件まとめて落ちた(開発者ローカル実測)。
	// ★依存の向きは dev → E2E である。E2E → dev(PUT /api/config が config.toml を
	// 再シリアライズする)は既知だったが、逆向きは報告されていなかった。
	//
	// ★他の 3 つと違い、本キーは「焼き付き」制約を持たない —— パスの決まり方が
	// 変わるだけで、書き戻しは internal/config.Save ただ 1 本のまま(CHANGE-132)。
	EnvConfigPath = "TACPENDIUM_CONFIG_PATH"
)

// デフォルト値。SUPP-001 §5.8 の設定ファイル例を根拠とする。
const (
	defaultServerMode    = "local"
	defaultServerPort    = 47318
	defaultLoggingLevel  = "info"
	defaultLoggingFile   = "logs/tacpendium.log"
	defaultLogMaxSizeMB  = 10
	defaultLogMaxBackups = 5
	defaultLogMaxAgeDays = 30
)

// Config はアプリケーション全体の設定を表す。
type Config struct {
	Server   ServerConfig   `toml:"server"`
	Database DatabaseConfig `toml:"database"`
	Logging  LoggingConfig  `toml:"logging"`
	Security SecurityConfig `toml:"security"`
	Defaults DefaultsConfig `toml:"defaults"`
}

// ServerConfig はサーバ起動に関する設定。
type ServerConfig struct {
	// Mode は "local" または "lan"。SUPP-001 §2.6.1 の bind/CORS 構築に影響する。
	Mode string `toml:"mode"`
	// Port はリッスンポート(default 47318)。
	Port int `toml:"port"`
}

// DatabaseConfig は SQLite ファイルパス等を保持する。
type DatabaseConfig struct {
	// Path は空ならアプリ既定のデータディレクトリを使う(M1-02 で実装)。
	Path string `toml:"path"`
}

// LoggingConfig はロギング出力先・ローテーション設定を保持する。SUPP-001 §5.6 準拠。
type LoggingConfig struct {
	Level      string `toml:"level"`
	File       string `toml:"file"`
	MaxSizeMB  int    `toml:"max_size_mb"`
	MaxBackups int    `toml:"max_backups"`
	MaxAgeDays int    `toml:"max_age_days"`
}

// SecurityConfig は簡易パスワード保護の設定を保持する。DES-002 §8。
type SecurityConfig struct {
	// PasswordEnabled は簡易パスワードによる入場ゲートの有効・無効。既定は false。
	PasswordEnabled bool `toml:"password_enabled"`
	// PasswordHash は簡易パスワードの検証子(平文は保存しない)。空なら未設定。
	//
	// ★API 応答へ載せない・要求から受け取らない(SUPP-001 §5.6)。
	// internal/api/config の DTO は手書きの別型であり、本フィールドを詰め替えないことで
	// 除外を成立させている。ログにも出さない。
	PasswordHash string `toml:"password_hash"`
}

// DefaultsConfig はデフォルト表示キャラクター・プリセットの設定を保持する。SUPP-001 §5.8 v1.14.0。
type DefaultsConfig struct {
	CharacterID int64 `toml:"character_id"`
	PresetID    int64 `toml:"preset_id"`
}

// Default は組込デフォルト値の Config を返す。
func Default() *Config {
	return &Config{
		Server: ServerConfig{
			Mode: defaultServerMode,
			Port: defaultServerPort,
		},
		Database: DatabaseConfig{
			Path: "",
		},
		Logging: LoggingConfig{
			Level:      defaultLoggingLevel,
			File:       defaultLoggingFile,
			MaxSizeMB:  defaultLogMaxSizeMB,
			MaxBackups: defaultLogMaxBackups,
			MaxAgeDays: defaultLogMaxAgeDays,
		},
		Security: SecurityConfig{
			PasswordEnabled: false,
		},
		Defaults: DefaultsConfig{
			CharacterID: 1,
			PresetID:    1,
		},
	}
}

// Load は path から TOML を読み込み Config を返す。
//
// ファイルが存在しない場合は Default() を返し、エラーにはしない(初回起動の挙動)。
// 環境変数 TACPENDIUM_LOG_LEVEL が設定されていれば Logging.Level を上書きする。
func Load(path string) (*Config, error) {
	cfg := Default()

	data, err := os.ReadFile(path)
	switch {
	case err == nil:
		if _, decodeErr := toml.Decode(string(data), cfg); decodeErr != nil {
			return nil, fmt.Errorf("config: decode %q: %w", path, decodeErr)
		}
	case errors.Is(err, fs.ErrNotExist):
		// ファイル不在はデフォルト値で続行。
	default:
		return nil, fmt.Errorf("config: read %q: %w", path, err)
	}

	applyEnvOverrides(cfg)
	if err := cfg.validate(); err != nil {
		return nil, err
	}
	return cfg, nil
}

// Save は cfg を TOML へ表現し、一時ファイル経由でアトミックに path へ書き戻す。
// 起動時のポート競合フォールバック(L-04)で採用ポートを config.toml に記録する用途と、
// 設定 API(PUT /api/config)の書き戻しの両方が本関数を通る。
//
// ★config.toml へ書き戻す経路は本関数ただ 1 つである。別に書かないこと
// (M24-09b 以前は service/config が同じ処理を独立に持っていた＝followup `CO-012`)。
//
// ★2 段に分けてあるのは、「どう表現するか」(encodeTOML)と「どう置き換えるか」
// (replaceAtomically)が別の関心だからである。
func Save(path string, cfg *Config) error {
	data, err := encodeTOML(cfg)
	if err != nil {
		return err
	}
	return replaceAtomically(path, data)
}

// encodeTOML は Config を config.toml の中身(バイト列)へ表現する。
//
// ★現在の方式は構造体からの全再エンコードである。元ファイルを 1 バイトも読まないため、
// コメント・空行・キー順・インデントは出力に現れない。Config が持つセクションは
// ファイルに書かれていなくても既定値で出力される。
func encodeTOML(cfg *Config) ([]byte, error) {
	var buf bytes.Buffer
	if err := toml.NewEncoder(&buf).Encode(cfg); err != nil {
		return nil, fmt.Errorf("config: encode: %w", err)
	}
	return buf.Bytes(), nil
}

// replaceAtomically は data で path の内容を置き換える。
//
// ★守りたい不変条件: 途中で失敗しても path が壊れない。
// 一時ファイルへ書き切って fsync してから rename する。rename は同一ディレクトリ内で
// アトミックなので、path は常に「置換前の完全な内容」か「置換後の完全な内容」の
// どちらかになる。**path へ直接書いてはならない** —— 直接書くと、書込中に落ちた場合に
// 利用者の設定ファイルが切り詰められた状態で残る。
func replaceAtomically(path string, data []byte) error {
	tmpPath := path + ".tmp"

	f, err := os.Create(tmpPath)
	if err != nil {
		return fmt.Errorf("config: create tmp: %w", err)
	}

	_, writeErr := f.Write(data)
	syncErr := f.Sync()
	closeErr := f.Close()

	if writeErr != nil {
		os.Remove(tmpPath)
		return fmt.Errorf("config: write tmp: %w", writeErr)
	}
	if syncErr != nil {
		os.Remove(tmpPath)
		return fmt.Errorf("config: sync tmp: %w", syncErr)
	}
	if closeErr != nil {
		os.Remove(tmpPath)
		return fmt.Errorf("config: close tmp: %w", closeErr)
	}

	if err := os.Rename(tmpPath, path); err != nil {
		os.Remove(tmpPath)
		return fmt.Errorf("config: rename tmp: %w", err)
	}
	return nil
}

// PersistPort はディスク上の config.toml を起点に Server.Port のみを更新して書き戻す。
// 起動時ポート競合フォールバック(L-04)でのポート記録用。
//
// 実行時の Config(applyEnvOverrides 適用済み)ではなくファイル内容を起点にすることで、
// 環境変数による一時的な上書き(TACPENDIUM_LOG_LEVEL → Logging.Level)が config.toml に
// 焼き付くのを防ぐ(env override は一時的上書きが意図のため)。ファイル不在時はデフォルト値で生成する。
func PersistPort(path string, port int) error {
	cfg := Default()
	data, err := os.ReadFile(path)
	switch {
	case err == nil:
		if _, decodeErr := toml.Decode(string(data), cfg); decodeErr != nil {
			return fmt.Errorf("config: decode %q: %w", path, decodeErr)
		}
	case errors.Is(err, fs.ErrNotExist):
		// ファイル不在はデフォルト値で続行。
	default:
		return fmt.Errorf("config: read %q: %w", path, err)
	}
	cfg.Server.Port = port
	return Save(path, cfg)
}

// RewriteRelocatedPaths は config.toml の database.path / logging.file が oldRoot 配下の
// 絶対パスであるとき、それを newRoot 配下の対応する絶対パスへ書き換えて保存する。
// 書き換えが 1 つでも起きたら true を返す。ファイルが存在しなければ何もせず false を返す。
//
// ★M28-01(正式名リネーム)のデータディレクトリ移行から呼ばれる。
//
// ★★env による一時上書きを焼き付けないため、PersistPort と同じ形を採る ————————
// 実行時の *Config(applyEnvOverrides 済み)を Save へ渡すと、TACPENDIUM_LOG_LEVEL 等の
// 一時上書きが config.toml へ書き込まれてしまう。⇒ ディスクの内容を Default() へ
// 読み直し、対象 2 キーだけを触って書き戻す。
//
// ★書き換えは「oldRoot 配下の絶対パス」に限る。相対パス(既定の logs/tacpendium.log 等)は
// カレントディレクトリ基準でありデータディレクトリとは無関係なので触らない。
//
// ★既知の副作用: Save は構造体からの全再エンコードであるため、コメント・キー順は失われる
// (encodeTOML の注記)。⇒ 実際に書き換えが要るときだけ Save する。
func RewriteRelocatedPaths(path string, mapping map[string]string, oldRoot, newRoot string) (bool, error) {
	cfg := Default()
	data, err := os.ReadFile(path)
	switch {
	case err == nil:
		if _, decodeErr := toml.Decode(string(data), cfg); decodeErr != nil {
			return false, fmt.Errorf("config: decode %q: %w", path, decodeErr)
		}
	case errors.Is(err, fs.ErrNotExist):
		// ファイルが無ければ書き換える対象も無い。★新規作成はしない。
		return false, nil
	default:
		return false, fmt.Errorf("config: read %q: %w", path, err)
	}

	changed := false
	if v, ok := relocatePath(cfg.Database.Path, mapping, oldRoot, newRoot); ok {
		cfg.Database.Path = v
		changed = true
	}
	if v, ok := relocatePath(cfg.Logging.File, mapping, oldRoot, newRoot); ok {
		cfg.Logging.File = v
		changed = true
	}
	if !changed {
		return false, nil
	}
	if err := Save(path, cfg); err != nil {
		return false, err
	}
	return true, nil
}

// relocatePath は value が oldRoot 配下の絶対パスなら移行後の対応パスを返す。
// 対象外(空・相対・oldRoot 外)なら ok=false を返す。
//
// ★★mapping を先に引く理由 ————————————————————————————————————————————
// 移行はファイル名も変える(combomgr.db → tacpendium.db)。ルートを付け替えるだけだと
// 「<新>/combomgr.db」という**存在しないパス**を書き込んでしまい、次回起動時に SQLite が
// そこへ空の DB を作る。利用者から見ると「データが消えた」状態になる。
// ⇒ 移行が実際に作った対応表を正本とし、表に無いものだけルート付け替えで拾う。
func relocatePath(value string, mapping map[string]string, oldRoot, newRoot string) (string, bool) {
	if strings.TrimSpace(value) == "" || oldRoot == "" || newRoot == "" {
		return "", false
	}
	clean := filepath.Clean(value)
	if !filepath.IsAbs(clean) {
		return "", false
	}
	if mapped, ok := mapping[clean]; ok && mapped != "" {
		return mapped, true
	}
	if !withinRoot(clean, filepath.Clean(oldRoot)) {
		return "", false
	}
	rel, err := filepath.Rel(filepath.Clean(oldRoot), clean)
	if err != nil {
		return "", false
	}
	return filepath.Join(newRoot, rel), true
}

func applyEnvOverrides(cfg *Config) {
	if v, ok := os.LookupEnv(EnvLogLevel); ok && strings.TrimSpace(v) != "" {
		cfg.Logging.Level = strings.TrimSpace(v)
	}
	if v, ok := os.LookupEnv(EnvDBPath); ok && strings.TrimSpace(v) != "" {
		cfg.Database.Path = strings.TrimSpace(v)
	}
	if v, ok := os.LookupEnv(EnvPort); ok && strings.TrimSpace(v) != "" {
		if port, err := strconv.Atoi(strings.TrimSpace(v)); err == nil {
			cfg.Server.Port = port
		}
	}
}

func (c *Config) validate() error {
	switch c.Server.Mode {
	case "local", "lan":
		// ok
	default:
		return fmt.Errorf("config: invalid server.mode %q (want \"local\" or \"lan\")", c.Server.Mode)
	}
	if c.Server.Port <= 0 || c.Server.Port > 65535 {
		return fmt.Errorf("config: invalid server.port %d", c.Server.Port)
	}
	if c.Defaults.CharacterID < 1 {
		return fmt.Errorf("config: invalid defaults.character_id %d (want >= 1)", c.Defaults.CharacterID)
	}
	if c.Defaults.PresetID < 1 {
		return fmt.Errorf("config: invalid defaults.preset_id %d (want >= 1)", c.Defaults.PresetID)
	}
	if msg := ValidateDataPath(c.Database.Path); msg != "" {
		return fmt.Errorf("config: invalid database.path %q: %s", c.Database.Path, msg)
	}
	if msg := ValidateDataPath(c.Logging.File); msg != "" {
		return fmt.Errorf("config: invalid logging.file %q: %s", c.Logging.File, msg)
	}
	return nil
}

// ValidateDataPath は database.path / logging.file に与えられたユーザー指定パスが
// アプリ管轄ディレクトリ外へ脱出しないことを検証する。安全なら空文字を、問題があれば
// 利用者向けメッセージを返す。
//
// 空パスは許容する(database.path 空 = OS 既定の解決にフォールバック、logging.file の
// 空は log.Init 側で別途エラーになる)。
//
// ポリシー(CHANGE-048):
//   - filepath.Clean 後に ".." 要素を含むパスは拒否(ディレクトリトラバーサル防止)
//   - 絶対パスはアプリ既定データディレクトリ、AppBaseDir()、または実行時
//     カレントディレクトリ配下のみ許可(許可ルートの全数は appDataRoots)
//   - ".." を含まない相対パスは AppBaseDir() 配下に解決されるため許可
//
// ★★相対パスを許可している根拠は M34-02 段 1 で変わった —— 以前は「カレント
// ディレクトリ配下に解決されるから」であった。⇒ logging.file の相対値は
// ResolveAppPath で AppBaseDir() 基準へ解決されるようになったので、根拠も
// そちらへ移る(常駐化で起動経路が増えても出先が動かないようにするため)。
// ★開発時(go run / go test)は AppBaseDir() がカレントディレクトリを返すため、
// 従来の判定と一致する。
//
// これにより、設定経由(config.toml / PUT /api/config)で指定されたパスがアプリ管轄外の
// 既存ファイルを上書き・破損させることを防ぐ。
func ValidateDataPath(path string) string {
	if strings.TrimSpace(path) == "" {
		return ""
	}
	clean := filepath.Clean(path)
	for _, seg := range strings.Split(clean, string(os.PathSeparator)) {
		if seg == ".." {
			return `パスに ".." を含めることはできません(アプリ管轄外への書き込み防止)`
		}
	}
	if filepath.IsAbs(clean) {
		roots := appDataRoots()
		if len(roots) == 0 {
			return "アプリのデータディレクトリを解決できませんでした"
		}
		for _, root := range roots {
			if withinRoot(clean, root) {
				return ""
			}
		}
		return "絶対パスはアプリのデータディレクトリ、アプリ本体の在るフォルダ、または起動時のカレントディレクトリ配下のみ指定できます"
	}
	return ""
}

// appDataRoots は絶対パス検証で許可するルート(アプリ既定データディレクトリ + 旧既定
// データディレクトリ + AppBaseDir() + 実行時のカレントディレクトリ)を返す。解決に
// 失敗したルートは黙って除外する。
//
// ★★AppBaseDir() を含めているのは M34-02 段 1 の帰結である —— 相対パスの基準が
// アプリ本体の在るフォルダへ移ったので、利用者が同じ場所を絶対パスで書いたときに
// 検証で弾かれてはならない。★カレントディレクトリも残す(開発時の挙動を変えないため。
// 開発時は両者が一致する)。
//
// ★★旧既定(db.LegacyDataDir)を含めているのは M28-01(正式名リネーム)の経過措置である。
// リネーム前に書かれた config.toml は database.path / logging.file に
// 「.../combomgr/combomgr.db」のような絶対パスを持ちうる。旧ルートを許可しないと
// validate() がそれを弾き、config.Load がエラーを返し、**データディレクトリの移行が
// 走る前に起動そのものが落ちる**(移行は config.Load の後ろに置かざるを得ない。
// 移行の判定に cfg.Database.Path が要るため)。
// ⇒ 旧ルートを許可しておき、移行側が config.toml のパスを新ルートへ書き換える。
func appDataRoots() []string {
	var roots []string
	if d, err := db.DataDir(); err == nil && d != "" {
		roots = append(roots, filepath.Clean(d))
	}
	if d, err := db.LegacyDataDir(); err == nil && d != "" {
		roots = append(roots, filepath.Clean(d))
	}
	if base := AppBaseDir(); base != "" {
		roots = append(roots, filepath.Clean(base))
	}
	if wd, err := os.Getwd(); err == nil && wd != "" {
		roots = append(roots, filepath.Clean(wd))
	}
	return roots
}

// withinRoot は path が root と同一、または root 配下にあるかを返す。
func withinRoot(path, root string) bool {
	rel, err := filepath.Rel(root, path)
	if err != nil {
		return false
	}
	if rel == "." {
		return true
	}
	return rel != ".." && !strings.HasPrefix(rel, ".."+string(os.PathSeparator))
}

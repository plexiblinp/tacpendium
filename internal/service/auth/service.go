package auth

import (
	"crypto/rand"
	"errors"
	"fmt"
	"log/slog"
	"sync"

	appconfig "github.com/plexiblinp/tacpendium/internal/config"
)

// エラー。呼出側(ハンドラ)が応答を決めるための区別だけを持つ。
var (
	// ErrCurrentPasswordRequired はパスワード設定済みなのに現在のパスワードが
	// 添えられていない、または一致しないことを表す。
	ErrCurrentPasswordRequired = errors.New("auth: current password is required")
	// ErrEmptyPassword は新しいパスワードが空であることを表す。
	ErrEmptyPassword = errors.New("auth: password must not be empty")
)

// SecurityStore は [security] の読み書きを提供する(internal/service/config が実装)。
//
// ★config サービス全体ではなく必要な 2 操作だけを受ける。認証が設定 API の
// 他の面へ依存しないようにするため。
type SecurityStore interface {
	// Security は [security] のスナップショットを返す。
	Security() appconfig.SecurityConfig
	// SetPasswordHash は password_hash を更新し config.toml へ書き戻す。
	SetPasswordHash(hash string) error
}

// Service は簡易パスワードの照合とセッションの管理を提供する。
//
// ★本サービスのメソッドは context.Context を取らない。CLAUDE.md §4 の
// 「サービス層のメソッドは第一引数に context.Context を取る」からの逸脱である。
// 理由は依存先に渡す先が無いこと——SecurityStore(実体は internal/service/config)が
// ctx を取らない設計であり(同パッケージ PresetExistsFunc のコメント参照)、
// ctx を受けても素通しにしかならない。取れない ctx を型に載せると
// 「キャンセルが効く」という誤った期待を呼ぶため、取らない形に揃えた。
// ⇒ 帰結: SetPassword の鍵導出(約 315ms)はクライアント切断でも最後まで走る。
// 全面導入は configsvc の公開インタフェースの組み替えを伴うため本サブの範囲外。
type Service struct {
	store SecurityStore

	mu sync.RWMutex
	// sessions は発行済みセッション ID の集合。
	//
	// ★メモリにのみ持つ(DES-002 §8「メモリ保持で十分」)。再起動で消える。
	// タイムアウトは設けないため、失効させるのはログアウトと再起動だけである。
	sessions map[string]struct{}
}

// NewService は Service を生成する。
func NewService(store SecurityStore) *Service {
	return &Service{
		store:    store,
		sessions: make(map[string]struct{}),
	}
}

// Enabled は入場ゲートが有効かを返す。
//
// ★password_enabled = true でもパスワードが未設定なら false を返す。
// この状態は config.toml を手で書いた場合にだけ起きる。起動を止める代わりに
// 無効として扱う(M22-01 §4.1-3。開発者判断 2026-08-15)。
// アプリからは PUT /api/config の検証で作れない。
//
// ★本メソッドはログを出さない。リクエストごとに呼ばれるため、ここで警告すると
// 静的アセット 1 枚ごとに 1 行出てログを埋める。警告は WarnIfMisconfigured が
// 起動時に一度だけ出す。
func (s *Service) Enabled() bool {
	sec := s.store.Security()
	return sec.PasswordEnabled && sec.PasswordHash != ""
}

// WarnIfMisconfigured は password_enabled = true かつパスワード未設定のときに
// 警告を 1 度だけ出す。起動時に呼ぶ。
//
// ★この不整合は config.toml を手で書いた場合にだけ起きる(アプリからは
// PUT /api/config の検証で作れない)。設定はプロセス起動時にしか読まないため、
// 起動時の 1 回で検出しきる。
func (s *Service) WarnIfMisconfigured() {
	sec := s.store.Security()
	if sec.PasswordEnabled && sec.PasswordHash == "" {
		slog.Warn("auth: password_enabled is true but no password is set; treating password protection as disabled",
			"hint", "set a password from the app, or set password_enabled = false in config.toml")
	}
}

// PasswordSet はパスワードが設定済みかを返す。
func (s *Service) PasswordSet() bool {
	return s.store.Security().PasswordHash != ""
}

// Login はパスワードを照合し、一致すれば新しいセッション ID を返す。
//
// 一致しなければ空文字と false を返す。★理由は区別しない(指示書 §4.4-1)——
// 入場ゲートが無効・パスワード未設定・不一致のいずれも同じ結果である。
//
// ★入場ゲートが無効なら、正しいパスワードでもセッションを発行しない。
// password_enabled = false のときはセッションが何も守らないうえ、
// 発行すると OFF なのに Set-Cookie が付く(指示書 §4.9-4 が名指しで警戒した形)。
// ★「一度掛けて外した後」は password_hash が残るため、これは例外的な状態ではなく
// 通常の OFF 状態である。
func (s *Service) Login(password string) (string, bool) {
	if !s.Enabled() {
		return "", false
	}

	// ★掛けるのは前後の空白の除去だけである(M22-08 §4.1-5)。
	// ★★文字種(VAL-N05)・長さ(VAL-N06)の検査は絶対に掛けない(同 §4.1-2＝最重要ゲート 1)。
	// 掛けると、既に非 ASCII や短いパスワードで決めた利用者が入れなくなり、しかも
	// 変更もできなくなる(変更は現在のパスワードを要求するため)。⇒ 詰みが生まれる。
	password = NormalizePassword(password)

	sec := s.store.Security()
	if !VerifyPassword(sec.PasswordHash, password) {
		return "", false
	}

	// crypto/rand.Text は暗号論的乱数から base32 の文字列を返す(約 128bit)。
	id := rand.Text()

	s.mu.Lock()
	defer s.mu.Unlock()
	s.sessions[id] = struct{}{}
	return id, true
}

// Logout は指定のセッションを破棄する。存在しない ID は黙って無視する。
func (s *Service) Logout(sessionID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.sessions, sessionID)
}

// Validate はセッション ID が有効かを返す。
func (s *Service) Validate(sessionID string) bool {
	if sessionID == "" {
		return false
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	_, ok := s.sessions[sessionID]
	return ok
}

// SetPassword はパスワードを設定・変更する。
//
// 設定済みの場合は current の一致を要求する(指示書 §4.4-3。開発者判断 D-396)。
// 未設定からの初回設定では current を見ない。
//
// ★変更が通ると既存のセッションはすべて破棄される。パスワードを変えた本人だけが
// 入り直せる状態にするため。
func (s *Service) SetPassword(current, next string) error {
	// ★前後の空白は「決めるとき」も「入れるとき」も除去する(M22-08 §4.1-5)。
	// current も除去するのは、決めるときに除去した値で検証子を作っているためである
	// (除去しないと、自分が決めた値と照合できない)。
	current = NormalizePassword(current)
	next = NormalizePassword(next)

	if next == "" {
		return ErrEmptyPassword
	}
	// ★★検査は next にだけ掛ける。current には掛けない(M22-08 §4.1-2＝最重要ゲート 1)。
	// current に掛けると、既に非 ASCII や短いパスワードで決めた利用者が変更できなくなり、
	// 入れないまま直す手段も失う。
	if err := validateNewPassword(next); err != nil {
		return err
	}

	sec := s.store.Security()
	if sec.PasswordHash != "" && !VerifyPassword(sec.PasswordHash, current) {
		return ErrCurrentPasswordRequired
	}

	hash, err := HashPassword(next)
	if err != nil {
		return err
	}
	if err := s.store.SetPasswordHash(hash); err != nil {
		return fmt.Errorf("auth: persist password: %w", err)
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	s.sessions = make(map[string]struct{})
	return nil
}

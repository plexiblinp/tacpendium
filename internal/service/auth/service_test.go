package auth

import (
	"bytes"
	"errors"
	"log/slog"
	"strings"
	"sync"
	"testing"

	appconfig "github.com/plexiblinp/tacpendium/internal/config"
)

// fakeStore は SecurityStore のテスト実装。
type fakeStore struct {
	mu      sync.Mutex
	sec     appconfig.SecurityConfig
	saveErr error
}

func (f *fakeStore) Security() appconfig.SecurityConfig {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.sec
}

func (f *fakeStore) SetPasswordHash(hash string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.saveErr != nil {
		return f.saveErr
	}
	f.sec.PasswordHash = hash
	return nil
}

// newServiceWithPassword はパスワード設定済みの Service を返す。
func newServiceWithPassword(t *testing.T, password string, enabled bool) (*Service, *fakeStore) {
	t.Helper()
	hash, err := HashPassword(password)
	if err != nil {
		t.Fatalf("HashPassword: %v", err)
	}
	store := &fakeStore{sec: appconfig.SecurityConfig{PasswordEnabled: enabled, PasswordHash: hash}}
	return NewService(store), store
}

// ===========================================================================
// 検証子
// ===========================================================================

func TestHashPassword_RoundTrip(t *testing.T) {
	const password = "correct horse battery staple"

	encoded, err := HashPassword(password)
	if err != nil {
		t.Fatalf("HashPassword: %v", err)
	}

	if !strings.HasPrefix(encoded, hashScheme+"$") {
		t.Errorf("encoded = %q, want prefix %q", encoded, hashScheme+"$")
	}
	if strings.Contains(encoded, password) {
		t.Error("the encoded verifier must not contain the plaintext password")
	}
	if !VerifyPassword(encoded, password) {
		t.Error("VerifyPassword should accept the original password")
	}
	if VerifyPassword(encoded, password+"x") {
		t.Error("VerifyPassword should reject a different password")
	}
}

// TestHashPassword_SaltIsRandom は同じパスワードでも検証子が毎回変わることを固定する。
func TestHashPassword_SaltIsRandom(t *testing.T) {
	a, err := HashPassword("same")
	if err != nil {
		t.Fatalf("HashPassword: %v", err)
	}
	b, err := HashPassword("same")
	if err != nil {
		t.Fatalf("HashPassword: %v", err)
	}
	if a == b {
		t.Error("two verifiers for the same password must differ (salt is not random)")
	}
}

// TestVerifyPassword_MalformedVerifier は壊れた検証子が例外ではなく不一致になることを固定する。
func TestVerifyPassword_MalformedVerifier(t *testing.T) {
	cases := map[string]string{
		"空":               "",
		"区切り不足":           "pbkdf2-sha256$600000$c2FsdA",
		"反復回数が数値でない":      "pbkdf2-sha256$abc$c2FsdA$a2V5",
		"反復回数がゼロ":         "pbkdf2-sha256$0$c2FsdA$a2V5",
		"ソルトが base64 でない": "pbkdf2-sha256$600000$!!!$a2V5",
		"鍵が空":             "pbkdf2-sha256$600000$c2FsdA$",
		"未知の方式":           "bcrypt$600000$c2FsdA$a2V5",
	}
	for name, encoded := range cases {
		t.Run(name, func(t *testing.T) {
			if VerifyPassword(encoded, "anything") {
				t.Errorf("VerifyPassword(%q) = true, want false", encoded)
			}
		})
	}
}

// ===========================================================================
// Enabled / PasswordSet
// ===========================================================================

func TestService_Enabled(t *testing.T) {
	t.Run("無効なら false", func(t *testing.T) {
		svc, _ := newServiceWithPassword(t, "pw", false)
		if svc.Enabled() {
			t.Error("Enabled should be false when password_enabled is false")
		}
	})

	t.Run("有効かつ設定済みなら true", func(t *testing.T) {
		svc, _ := newServiceWithPassword(t, "pw", true)
		if !svc.Enabled() {
			t.Error("Enabled should be true when password_enabled is true and a password is set")
		}
	})
}

// TestService_Enabled_TrueWithoutPasswordIsDisabled は §4.1-3 の決定を固定する
// ——起動を止めず、無効として扱う。
func TestService_Enabled_TrueWithoutPasswordIsDisabled(t *testing.T) {
	store := &fakeStore{sec: appconfig.SecurityConfig{PasswordEnabled: true, PasswordHash: ""}}
	svc := NewService(store)

	if svc.Enabled() {
		t.Error("Enabled should be false when password_enabled is true but no password is set")
	}
}

// TestService_Enabled_DoesNotLog は Enabled がログを出さないことを固定する。
//
// ★Enabled はミドルウェアがリクエストごとに呼ぶ。ここで警告すると、不整合な
// 設定のときに静的アセット 1 枚ごとに 1 行出てログを埋める(レビュー指摘 2-c)。
func TestService_Enabled_DoesNotLog(t *testing.T) {
	var buf bytes.Buffer
	prev := slog.Default()
	slog.SetDefault(slog.New(slog.NewTextHandler(&buf, &slog.HandlerOptions{Level: slog.LevelDebug})))
	defer slog.SetDefault(prev)

	svc := NewService(&fakeStore{sec: appconfig.SecurityConfig{PasswordEnabled: true, PasswordHash: ""}})
	for i := 0; i < 100; i++ {
		svc.Enabled()
	}

	if buf.Len() != 0 {
		t.Errorf("Enabled must not log (it runs per request), got: %s", buf.String())
	}
}

// TestService_WarnIfMisconfigured は起動時の警告を固定する(§4.1-3)。
func TestService_WarnIfMisconfigured(t *testing.T) {
	t.Run("不整合なら警告する", func(t *testing.T) {
		var buf bytes.Buffer
		prev := slog.Default()
		slog.SetDefault(slog.New(slog.NewTextHandler(&buf, &slog.HandlerOptions{Level: slog.LevelWarn})))
		defer slog.SetDefault(prev)

		NewService(&fakeStore{sec: appconfig.SecurityConfig{PasswordEnabled: true}}).WarnIfMisconfigured()

		if !strings.Contains(buf.String(), "password_enabled is true but no password is set") {
			t.Errorf("expected a warning to be logged, got: %s", buf.String())
		}
	})

	t.Run("整合していれば黙る", func(t *testing.T) {
		var buf bytes.Buffer
		prev := slog.Default()
		slog.SetDefault(slog.New(slog.NewTextHandler(&buf, &slog.HandlerOptions{Level: slog.LevelWarn})))
		defer slog.SetDefault(prev)

		svc, _ := newServiceWithPassword(t, "pw", true)
		svc.WarnIfMisconfigured()
		NewService(&fakeStore{}).WarnIfMisconfigured() // 未設定 かつ OFF

		if buf.Len() != 0 {
			t.Errorf("no warning expected, got: %s", buf.String())
		}
	})
}

func TestService_PasswordSet(t *testing.T) {
	svc, _ := newServiceWithPassword(t, "pw", false)
	if !svc.PasswordSet() {
		t.Error("PasswordSet should be true")
	}

	empty := NewService(&fakeStore{})
	if empty.PasswordSet() {
		t.Error("PasswordSet should be false when no password is set")
	}
}

// ===========================================================================
// ログイン・セッション
// ===========================================================================

// TestService_Login_RequiresEnabled は、入場ゲートが無効なら正しいパスワードでも
// セッションを発行しないことを固定する(指示書 §4.9-4)。
//
// ★「OFF かつ設定済み」はゲートを外した後の通常状態である(password_hash は残る)。
func TestService_Login_RequiresEnabled(t *testing.T) {
	svc, _ := newServiceWithPassword(t, "s3cret", false)

	if id, ok := svc.Login("s3cret"); ok || id != "" {
		t.Error("Login must not issue a session while password protection is off")
	}

	// 対照: ON なら同じパスワードで通る。
	on, _ := newServiceWithPassword(t, "s3cret", true)
	if _, ok := on.Login("s3cret"); !ok {
		t.Error("control: Login should succeed while password protection is on")
	}
}

func TestService_Login(t *testing.T) {
	svc, _ := newServiceWithPassword(t, "s3cret", true)

	id, ok := svc.Login("s3cret")
	if !ok {
		t.Fatal("Login should succeed with the correct password")
	}
	if id == "" {
		t.Fatal("Login should return a non-empty session id")
	}
	if !svc.Validate(id) {
		t.Error("the issued session should validate")
	}

	if _, ok := svc.Login("wrong"); ok {
		t.Error("Login should fail with a wrong password")
	}
}

// TestService_Login_NoPasswordSet は未設定のときログインできないことを固定する。
func TestService_Login_NoPasswordSet(t *testing.T) {
	svc := NewService(&fakeStore{})
	if _, ok := svc.Login(""); ok {
		t.Error("Login must not succeed when no password is set")
	}
}

// TestService_Login_IssuesDistinctSessions は 2 回のログインが別のセッションになることを固定する。
func TestService_Login_IssuesDistinctSessions(t *testing.T) {
	svc, _ := newServiceWithPassword(t, "pw", true)

	first, ok := svc.Login("pw")
	if !ok {
		t.Fatal("first login failed")
	}
	second, ok := svc.Login("pw")
	if !ok {
		t.Fatal("second login failed")
	}
	if first == second {
		t.Error("two logins must not share a session id")
	}
	if !svc.Validate(first) || !svc.Validate(second) {
		t.Error("both sessions should remain valid")
	}
}

func TestService_Logout(t *testing.T) {
	svc, _ := newServiceWithPassword(t, "pw", true)

	id, _ := svc.Login("pw")
	svc.Logout(id)
	if svc.Validate(id) {
		t.Error("the session should be invalid after logout")
	}

	// 存在しない ID の破棄は無害。
	svc.Logout("no-such-session")
}

func TestService_Validate_RejectsUnknown(t *testing.T) {
	svc, _ := newServiceWithPassword(t, "pw", true)

	if svc.Validate("") {
		t.Error("an empty session id must not validate")
	}
	if svc.Validate("fabricated-session-id") {
		t.Error("a fabricated session id must not validate")
	}
}

// TestService_ConcurrentAccess は複数端末が同時に叩いても壊れないことを固定する
// (指示書 §4.3-7)。-race 付きで意味を持つ。
func TestService_ConcurrentAccess(t *testing.T) {
	svc, _ := newServiceWithPassword(t, "pw", true)

	const goroutines = 16
	var wg sync.WaitGroup
	wg.Add(goroutines)
	for i := 0; i < goroutines; i++ {
		go func() {
			defer wg.Done()
			id, ok := svc.Login("pw")
			if !ok {
				t.Error("Login failed under concurrency")
				return
			}
			svc.Validate(id)
			svc.Logout(id)
		}()
	}
	wg.Wait()
}

// ===========================================================================
// パスワードの設定・変更
// ===========================================================================

// TestService_SetPassword_InitialDoesNotRequireCurrent は初回設定で現在の
// パスワードを要求しないことを固定する(指示書 §4.4-3)。
func TestService_SetPassword_InitialDoesNotRequireCurrent(t *testing.T) {
	store := &fakeStore{}
	svc := NewService(store)

	if err := svc.SetPassword("", "first-password"); err != nil {
		t.Fatalf("initial SetPassword: %v", err)
	}
	if store.Security().PasswordHash == "" {
		t.Fatal("the password hash should have been persisted")
	}
	if !VerifyPassword(store.Security().PasswordHash, "first-password") {
		t.Error("the stored verifier should match the password that was set")
	}

	// ★この時点ではまだ入場ゲートが OFF なのでログインは通らない。
	// パスワードを設定しただけでは保護は始まらない(有効化は PUT /api/config)。
	if _, ok := svc.Login("first-password"); ok {
		t.Error("Login must not succeed while password protection is still off")
	}

	// 有効化すれば通る。
	store.mu.Lock()
	store.sec.PasswordEnabled = true
	store.mu.Unlock()
	if _, ok := svc.Login("first-password"); !ok {
		t.Error("the newly set password should log in once protection is enabled")
	}
}

// TestService_SetPassword_ChangeRequiresCurrent は変更時に現在のパスワードが
// 要ることを固定する(指示書 §5.1-12)。
func TestService_SetPassword_ChangeRequiresCurrent(t *testing.T) {
	svc, store := newServiceWithPassword(t, "old-password", true)
	before := store.Security().PasswordHash

	if err := svc.SetPassword("", "new-password"); !errors.Is(err, ErrCurrentPasswordRequired) {
		t.Errorf("SetPassword with no current password: err = %v, want ErrCurrentPasswordRequired", err)
	}
	if err := svc.SetPassword("wrong-password", "new-password"); !errors.Is(err, ErrCurrentPasswordRequired) {
		t.Errorf("SetPassword with a wrong current password: err = %v, want ErrCurrentPasswordRequired", err)
	}
	if store.Security().PasswordHash != before {
		t.Error("a rejected change must not modify the stored hash")
	}
	if _, ok := svc.Login("old-password"); !ok {
		t.Error("the old password should still work after a rejected change")
	}
}

func TestService_SetPassword_ChangeSucceedsWithCurrent(t *testing.T) {
	svc, _ := newServiceWithPassword(t, "old-password", true)

	if err := svc.SetPassword("old-password", "new-password"); err != nil {
		t.Fatalf("SetPassword: %v", err)
	}
	if _, ok := svc.Login("old-password"); ok {
		t.Error("the old password must no longer work")
	}
	if _, ok := svc.Login("new-password"); !ok {
		t.Error("the new password should work")
	}
}

// TestService_SetPassword_InvalidatesSessions は変更で既存セッションが失効することを固定する。
func TestService_SetPassword_InvalidatesSessions(t *testing.T) {
	svc, _ := newServiceWithPassword(t, "old-password", true)

	id, ok := svc.Login("old-password")
	if !ok {
		t.Fatal("login failed")
	}
	if err := svc.SetPassword("old-password", "new-password"); err != nil {
		t.Fatalf("SetPassword: %v", err)
	}
	if svc.Validate(id) {
		t.Error("sessions issued before the password change must be invalidated")
	}
}

func TestService_SetPassword_RejectsEmpty(t *testing.T) {
	svc := NewService(&fakeStore{})
	if err := svc.SetPassword("", ""); !errors.Is(err, ErrEmptyPassword) {
		t.Errorf("err = %v, want ErrEmptyPassword", err)
	}
}

// TestService_SetPassword_PersistFailureDoesNotChangeState は書き戻し失敗時に
// 「設定できた」状態にならないことを固定する。
func TestService_SetPassword_PersistFailureDoesNotChangeState(t *testing.T) {
	svc, store := newServiceWithPassword(t, "old-password", true)
	id, _ := svc.Login("old-password")
	store.mu.Lock()
	store.saveErr = errors.New("disk full")
	store.mu.Unlock()

	if err := svc.SetPassword("old-password", "new-password"); err == nil {
		t.Fatal("SetPassword should return the persistence error")
	}
	if !svc.Validate(id) {
		t.Error("sessions must survive a failed password change")
	}
	if _, ok := svc.Login("old-password"); !ok {
		t.Error("the old password must still work after a failed change")
	}
}

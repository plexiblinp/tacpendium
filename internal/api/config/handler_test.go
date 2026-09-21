package config_test

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"

	confighandler "github.com/plexiblinp/tacpendium/internal/api/config"
	appconfig "github.com/plexiblinp/tacpendium/internal/config"
	"github.com/plexiblinp/tacpendium/internal/model"
	configsvc "github.com/plexiblinp/tacpendium/internal/service/config"
)

// ===========================================================================
// モック Service
// ===========================================================================

type mockService struct {
	getFn      func() (*appconfig.Config, configsvc.NetworkInfo, bool, error)
	updateFn   func(req configsvc.UpdateRequest) (*appconfig.Config, configsvc.NetworkInfo, []configsvc.ValidationIssue, bool, error)
	securityFn func() appconfig.SecurityConfig
	setHashFn  func(hash string) error
}

func (m *mockService) Get() (*appconfig.Config, configsvc.NetworkInfo, bool, error) {
	return m.getFn()
}

func (m *mockService) Update(req configsvc.UpdateRequest) (*appconfig.Config, configsvc.NetworkInfo, []configsvc.ValidationIssue, bool, error) {
	return m.updateFn(req)
}

func (m *mockService) Security() appconfig.SecurityConfig {
	if m.securityFn == nil {
		return appconfig.SecurityConfig{}
	}
	return m.securityFn()
}

func (m *mockService) SetPasswordHash(hash string) error {
	if m.setHashFn == nil {
		return nil
	}
	return m.setHashFn(hash)
}

// ===========================================================================
// テスト用 server
// ===========================================================================

func newTestServer(t *testing.T, svc *mockService) *echo.Echo {
	t.Helper()
	e := echo.New()
	api := e.Group("/api")
	confighandler.RegisterRoutes(api, confighandler.NewHandler(svc))
	return e
}

func defaultConfig() *appconfig.Config {
	return appconfig.Default()
}

// ===========================================================================
// GET /api/config — 正常系
// ===========================================================================

func TestHandler_Get_Success(t *testing.T) {
	svc := &mockService{
		getFn: func() (*appconfig.Config, configsvc.NetworkInfo, bool, error) {
			return defaultConfig(), configsvc.NetworkInfo{}, true, nil
		},
	}
	e := newTestServer(t, svc)

	req := httptest.NewRequest(http.MethodGet, "/api/config", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want 200; body=%s", rec.Code, rec.Body.String())
	}

	var resp confighandler.ConfigResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if !resp.IsInitialized {
		t.Error("isInitialized should be true")
	}
	if resp.Server.Port != 47318 {
		t.Errorf("server.port = %d, want 47318", resp.Server.Port)
	}
	if resp.Server.Mode != "local" {
		t.Errorf("server.mode = %q, want %q", resp.Server.Mode, "local")
	}
}

// ===========================================================================
// GET /api/config — サービス層エラー時に 500
// ===========================================================================

func TestHandler_Get_InternalError(t *testing.T) {
	svc := &mockService{
		getFn: func() (*appconfig.Config, configsvc.NetworkInfo, bool, error) {
			return nil, configsvc.NetworkInfo{}, false, errors.New("unexpected io error")
		},
	}
	e := newTestServer(t, svc)

	req := httptest.NewRequest(http.MethodGet, "/api/config", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusInternalServerError {
		t.Errorf("status = %d, want 500; body=%s", rec.Code, rec.Body.String())
	}

	var resp model.APIErrorResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if resp.Error.Code != "config_read_failed" {
		t.Errorf("error.code = %q, want %q", resp.Error.Code, "config_read_failed")
	}
}

// ===========================================================================
// PUT /api/config — 正常系
// ===========================================================================

func TestHandler_Update_Success(t *testing.T) {
	svc := &mockService{
		updateFn: func(_ configsvc.UpdateRequest) (*appconfig.Config, configsvc.NetworkInfo, []configsvc.ValidationIssue, bool, error) {
			cfg := defaultConfig()
			cfg.Logging.Level = "debug"
			return cfg, configsvc.NetworkInfo{}, nil, false, nil
		},
	}
	e := newTestServer(t, svc)

	body := `{"logging":{"level":"debug"}}`
	req := httptest.NewRequest(http.MethodPut, "/api/config", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want 200; body=%s", rec.Code, rec.Body.String())
	}

	var resp confighandler.ConfigResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if resp.Logging.Level != "debug" {
		t.Errorf("logging.level = %q, want %q", resp.Logging.Level, "debug")
	}
	if resp.IsInitialized != true {
		t.Error("isInitialized should be true after successful PUT")
	}
}

// ===========================================================================
// PUT /api/config — 不正な JSON で 400
// ===========================================================================

func TestHandler_Update_InvalidJSON(t *testing.T) {
	svc := &mockService{}
	e := newTestServer(t, svc)

	req := httptest.NewRequest(http.MethodPut, "/api/config", strings.NewReader("not a json"))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400; body=%s", rec.Code, rec.Body.String())
	}

	var resp model.APIErrorResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if resp.Error.Code != "invalid_request" {
		t.Errorf("error.code = %q, want %q", resp.Error.Code, "invalid_request")
	}
}

// ===========================================================================
// PUT /api/config — バリデーション失敗で 422
// ===========================================================================

func TestHandler_Update_ValidationFailure(t *testing.T) {
	svc := &mockService{
		updateFn: func(_ configsvc.UpdateRequest) (*appconfig.Config, configsvc.NetworkInfo, []configsvc.ValidationIssue, bool, error) {
			return nil, configsvc.NetworkInfo{}, []configsvc.ValidationIssue{
				{Field: "server.mode", Message: `invalid server.mode "invalid" (want "local" or "lan")`},
			}, false, nil
		},
	}
	e := newTestServer(t, svc)

	body := `{"server":{"mode":"invalid"}}`
	req := httptest.NewRequest(http.MethodPut, "/api/config", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnprocessableEntity {
		t.Errorf("status = %d, want 422; body=%s", rec.Code, rec.Body.String())
	}

	var resp model.APIErrorResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if resp.Error.Code != "validation_failed" {
		t.Errorf("error.code = %q, want %q", resp.Error.Code, "validation_failed")
	}
	validations, ok := resp.Error.Details["validations"].(map[string]any)
	if !ok {
		t.Fatalf("details.validations not found or wrong type: %v", resp.Error.Details)
	}
	issues, ok := validations["issues"].([]any)
	if !ok || len(issues) == 0 {
		t.Fatalf("details.validations.issues not found or empty: %v", validations)
	}
	issue, ok := issues[0].(map[string]any)
	if !ok {
		t.Fatalf("issue[0] wrong type: %v", issues[0])
	}
	if issue["field"] != "server.mode" {
		t.Errorf("issue.field = %q, want %q", issue["field"], "server.mode")
	}
}

// ===========================================================================
// PUT /api/config — 書き込みエラーで 500
// ===========================================================================

func TestHandler_Update_WriteFailure(t *testing.T) {
	svc := &mockService{
		updateFn: func(_ configsvc.UpdateRequest) (*appconfig.Config, configsvc.NetworkInfo, []configsvc.ValidationIssue, bool, error) {
			return nil, configsvc.NetworkInfo{}, nil, false, errors.New("disk full")
		},
	}
	e := newTestServer(t, svc)

	body := `{"logging":{"level":"debug"}}`
	req := httptest.NewRequest(http.MethodPut, "/api/config", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusInternalServerError {
		t.Errorf("status = %d, want 500; body=%s", rec.Code, rec.Body.String())
	}

	var resp model.APIErrorResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if resp.Error.Code != "config_write_failed" {
		t.Errorf("error.code = %q, want %q", resp.Error.Code, "config_write_failed")
	}
}

// ===========================================================================
// GET /api/config — Network (local mode: 空)
// ===========================================================================

func TestHandler_Get_NetworkLocalMode(t *testing.T) {
	svc := &mockService{
		getFn: func() (*appconfig.Config, configsvc.NetworkInfo, bool, error) {
			return defaultConfig(), configsvc.NetworkInfo{}, true, nil
		},
	}
	e := newTestServer(t, svc)

	req := httptest.NewRequest(http.MethodGet, "/api/config", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}

	var resp confighandler.ConfigResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if resp.Network.PrimaryLanIp != "" {
		t.Errorf("network.primaryLanIp = %q, want empty", resp.Network.PrimaryLanIp)
	}
	if resp.Network.LanUrl != "" {
		t.Errorf("network.lanUrl = %q, want empty", resp.Network.LanUrl)
	}
}

// ===========================================================================
// GET /api/config — Network (lan mode: IP + URL)
// ===========================================================================

func TestHandler_Get_NetworkLanMode(t *testing.T) {
	svc := &mockService{
		getFn: func() (*appconfig.Config, configsvc.NetworkInfo, bool, error) {
			cfg := defaultConfig()
			cfg.Server.Mode = "lan"
			return cfg, configsvc.NetworkInfo{
				PrimaryLanIp: "192.168.1.50",
				LanUrl:       "http://192.168.1.50:47318",
			}, true, nil
		},
	}
	e := newTestServer(t, svc)

	req := httptest.NewRequest(http.MethodGet, "/api/config", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}

	var resp confighandler.ConfigResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if resp.Network.PrimaryLanIp != "192.168.1.50" {
		t.Errorf("network.primaryLanIp = %q, want %q", resp.Network.PrimaryLanIp, "192.168.1.50")
	}
	if resp.Network.LanUrl != "http://192.168.1.50:47318" {
		t.Errorf("network.lanUrl = %q, want %q", resp.Network.LanUrl, "http://192.168.1.50:47318")
	}
}

// ===========================================================================
// GET /api/config — Defaults 値の確認
// ===========================================================================

func TestHandler_Get_DefaultsValues(t *testing.T) {
	svc := &mockService{
		getFn: func() (*appconfig.Config, configsvc.NetworkInfo, bool, error) {
			cfg := defaultConfig()
			cfg.Defaults.CharacterID = 3
			cfg.Defaults.PresetID = 7
			return cfg, configsvc.NetworkInfo{}, true, nil
		},
	}
	e := newTestServer(t, svc)

	req := httptest.NewRequest(http.MethodGet, "/api/config", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}

	var resp confighandler.ConfigResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if resp.Defaults.CharacterID != 3 {
		t.Errorf("defaults.characterId = %d, want 3", resp.Defaults.CharacterID)
	}
	if resp.Defaults.PresetID != 7 {
		t.Errorf("defaults.presetId = %d, want 7", resp.Defaults.PresetID)
	}
}

// ===========================================================================
// PUT /api/config — Defaults 部分更新
// ===========================================================================

func TestHandler_Update_DefaultsPartial(t *testing.T) {
	svc := &mockService{
		updateFn: func(req configsvc.UpdateRequest) (*appconfig.Config, configsvc.NetworkInfo, []configsvc.ValidationIssue, bool, error) {
			cfg := defaultConfig()
			if req.Defaults != nil && req.Defaults.CharacterID != nil {
				cfg.Defaults.CharacterID = *req.Defaults.CharacterID
			}
			return cfg, configsvc.NetworkInfo{}, nil, false, nil
		},
	}
	e := newTestServer(t, svc)

	body := `{"defaults":{"characterId":5}}`
	req := httptest.NewRequest(http.MethodPut, "/api/config", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", rec.Code, rec.Body.String())
	}

	var resp confighandler.ConfigResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if resp.Defaults.CharacterID != 5 {
		t.Errorf("defaults.characterId = %d, want 5", resp.Defaults.CharacterID)
	}
}

// ===========================================================================
// M22-01 最重要ゲート 1: password_hash を API へ漏らさない(指示書 §4.2)
// ===========================================================================

// TestHandler_Get_DoesNotExposePasswordHash は GET /api/config の応答の
// どこにも password_hash の値が現れないことを固定する(指示書 §5.1-5)。
//
// ★応答 JSON の生バイト列を見る。DTO の構造ではなく「外へ出た文字列」を見ることで、
// フィールド名を変えて運んだ場合も検出する。
func TestHandler_Get_DoesNotExposePasswordHash(t *testing.T) {
	const secretHash = "pbkdf2-sha256$600000$c2FsdHNhbHQ$ZGVyaXZlZC1rZXktdmFsdWU"

	svc := &mockService{
		getFn: func() (*appconfig.Config, configsvc.NetworkInfo, bool, error) {
			cfg := defaultConfig()
			cfg.Security.PasswordEnabled = true
			cfg.Security.PasswordHash = secretHash
			return cfg, configsvc.NetworkInfo{}, true, nil
		},
	}
	e := newTestServer(t, svc)

	req := httptest.NewRequest(http.MethodGet, "/api/config", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", rec.Code, rec.Body.String())
	}

	body := rec.Body.String()
	if strings.Contains(body, secretHash) {
		t.Errorf("response body contains the password hash: %s", body)
	}
	if strings.Contains(body, "passwordHash") || strings.Contains(body, "password_hash") {
		t.Errorf("response body contains a password hash field: %s", body)
	}

	// 対照: passwordEnabled は出る(隠しているのはハッシュだけである)。
	var resp confighandler.ConfigResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if !resp.Security.PasswordEnabled {
		t.Error("security.passwordEnabled should be exposed")
	}
}

// TestHandler_Update_CannotWritePasswordHash は PUT /api/config で password_hash を
// 書けないことを固定する(指示書 §5.1-5 後段)。
//
// ★サービス層へ届いた UpdateRequest を覗き、ハッシュを運ぶ経路が無いことを見る。
func TestHandler_Update_CannotWritePasswordHash(t *testing.T) {
	const injected = "attacker-supplied-hash"

	var received configsvc.UpdateRequest
	svc := &mockService{
		updateFn: func(req configsvc.UpdateRequest) (*appconfig.Config, configsvc.NetworkInfo, []configsvc.ValidationIssue, bool, error) {
			received = req
			return defaultConfig(), configsvc.NetworkInfo{}, nil, false, nil
		},
	}
	e := newTestServer(t, svc)

	// 想定しうる綴りを全部混ぜて投げる。
	body := `{"security":{"passwordEnabled":false,"passwordHash":"` + injected +
		`","password_hash":"` + injected + `"}}`
	req := httptest.NewRequest(http.MethodPut, "/api/config", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", rec.Code, rec.Body.String())
	}
	if received.Security == nil {
		t.Fatal("security update should have been forwarded")
	}
	// SecurityUpdate に PasswordHash 相当のフィールドが無いことが、
	// 「書けない」の実体である。値の運搬先が構造上存在しない。
	if got := rec.Body.String(); strings.Contains(got, injected) {
		t.Errorf("response echoed the injected hash: %s", got)
	}
}

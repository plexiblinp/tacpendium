package comboio_test

import (
	"bytes"
	"context"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/labstack/echo/v4"

	authapi "github.com/plexiblinp/tacpendium/internal/api/auth"
	comboiohandler "github.com/plexiblinp/tacpendium/internal/api/comboio"
	mw "github.com/plexiblinp/tacpendium/internal/api/middleware"
	appconfig "github.com/plexiblinp/tacpendium/internal/config"
	authsvc "github.com/plexiblinp/tacpendium/internal/service/auth"
	comboiosvc "github.com/plexiblinp/tacpendium/internal/service/comboio"
)

// ===========================================================================
// モックサービス(comboiosvc.Service)
// ===========================================================================

type mockService struct {
	exportFn  func(ctx context.Context, q comboiosvc.ExportQuery) ([]byte, error)
	previewFn func(ctx context.Context, comboCSV, setupCSV string) (*comboiosvc.PreviewResult, error)
	commitFn  func(ctx context.Context, comboCSV, setupCSV string, selected []string, action comboiosvc.DupAction) (*comboiosvc.CommitResult, error)

	// lastCommitUserID はハンドラが渡した利用者 ID(M22-02 §5.1-11 の検証用)。
	lastCommitUserID int64
	// lastExportUserID は Export に渡った利用者 ID(同上)。
	lastExportUserID int64

	// exportResultFn は観測欄(M29-02 §2.1)まで組み立てたいテスト用。
	// ★設定されていれば exportFn より優先する。
	exportResultFn func(ctx context.Context, q comboiosvc.ExportQuery) (*comboiosvc.ExportResult, error)
}

func (m *mockService) ExportCSV(ctx context.Context, q comboiosvc.ExportQuery) (*comboiosvc.ExportResult, error) {
	m.lastExportUserID = q.UserID
	// ★観測欄(切り捨て・往復不能)を主張したいテストは exportResultFn を差す。
	if m.exportResultFn != nil {
		return m.exportResultFn(ctx, q)
	}
	data, err := m.exportFn(ctx, q)
	if err != nil {
		return nil, err
	}
	// ★観測欄を主張しないテストは「切り捨て無し」に倒す(総数 = 載った件数)。
	return &comboiosvc.ExportResult{Data: data, TotalCombos: 0, IncludedCombos: 0}, nil
}

func (m *mockService) ParsePreview(ctx context.Context, comboCSV, setupCSV string) (*comboiosvc.PreviewResult, error) {
	return m.previewFn(ctx, comboCSV, setupCSV)
}

// ★M22-02: ハンドラが渡した userID を捨てずに記録する。
// 捨てると「他から引っ越しの経路へ userID が届いているか」(§5.1-11)を見られない。
func (m *mockService) Commit(ctx context.Context, comboCSV, setupCSV string, selected []string, action comboiosvc.DupAction, userID int64) (*comboiosvc.CommitResult, error) {
	m.lastCommitUserID = userID
	return m.commitFn(ctx, comboCSV, setupCSV, selected, action)
}

// multipartBody は file/field を含む multipart ボディと Content-Type を返す。
func multipartBody(t *testing.T, files map[string]string, fields map[string]string) (*bytes.Buffer, string) {
	t.Helper()
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	for name, content := range files {
		fw, err := w.CreateFormFile(name, name+".csv")
		if err != nil {
			t.Fatalf("CreateFormFile: %v", err)
		}
		_, _ = fw.Write([]byte(content))
	}
	for k, v := range fields {
		_ = w.WriteField(k, v)
	}
	_ = w.Close()
	return &buf, w.FormDataContentType()
}

// ===========================================================================
// Export(GET /api/export/csv)
// ===========================================================================

func TestExportHandler_Happy(t *testing.T) {
	zipBytes := []byte("PK\x03\x04fake-zip")
	h := comboiohandler.NewHandler(&mockService{
		exportFn: func(_ context.Context, q comboiosvc.ExportQuery) ([]byte, error) {
			if q.Range != comboiosvc.RangeAll {
				t.Errorf("expected range=all default, got %q", q.Range)
			}
			return zipBytes, nil
		},
	})
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/export/csv?range=all", nil)
	rec := httptest.NewRecorder()
	if err := h.Export(e.NewContext(req, rec)); err != nil {
		t.Fatalf("Export: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d want 200", rec.Code)
	}
	if ct := rec.Header().Get(echo.HeaderContentType); ct != "application/zip" {
		t.Errorf("content-type: got %q want application/zip", ct)
	}
	if cd := rec.Header().Get(echo.HeaderContentDisposition); cd == "" {
		t.Errorf("missing Content-Disposition")
	}
	if !bytes.Equal(rec.Body.Bytes(), zipBytes) {
		t.Errorf("body mismatch")
	}
}

func TestExportHandler_BadRange(t *testing.T) {
	h := comboiohandler.NewHandler(&mockService{
		exportFn: func(context.Context, comboiosvc.ExportQuery) ([]byte, error) {
			t.Fatal("service should not be called for invalid range")
			return nil, nil
		},
	})
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/export/csv?range=bogus", nil)
	rec := httptest.NewRecorder()
	if err := h.Export(e.NewContext(req, rec)); err != nil {
		t.Fatalf("Export: %v", err)
	}
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status: got %d want 400", rec.Code)
	}
}

// ===========================================================================
// Preview(POST /api/import/csv/preview)
// ===========================================================================

func TestPreviewHandler_MissingComboFile(t *testing.T) {
	h := comboiohandler.NewHandler(&mockService{
		previewFn: func(context.Context, string, string) (*comboiosvc.PreviewResult, error) {
			t.Fatal("service should not be called without combo_file")
			return nil, nil
		},
	})
	e := echo.New()
	body, ct := multipartBody(t, nil, map[string]string{"selected": "[]"}) // file なし
	req := httptest.NewRequest(http.MethodPost, "/api/import/csv/preview", body)
	req.Header.Set(echo.HeaderContentType, ct)
	rec := httptest.NewRecorder()
	if err := h.Preview(e.NewContext(req, rec)); err != nil {
		t.Fatalf("Preview: %v", err)
	}
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status: got %d want 400", rec.Code)
	}
}

// TestPreviewHandler_OversizedUpload は容量ガード(第1回レビュー「高」修正)を検証する。
// readFormFile の io.LimitReader(maxUploadBytes=10MiB)で全量展開前に弾き 400 を返す。
// zip エントリ展開(readZipEntry)も同じ maxUploadBytes ガードを共有する。
func TestPreviewHandler_OversizedUpload(t *testing.T) {
	const maxUploadBytes = 10 << 20 // handler.go の定数と一致
	h := comboiohandler.NewHandler(&mockService{
		previewFn: func(context.Context, string, string) (*comboiosvc.PreviewResult, error) {
			t.Fatal("service should not be called for oversized upload")
			return nil, nil
		},
	})
	e := echo.New()
	oversized := bytes.Repeat([]byte("a"), maxUploadBytes+1) // 10MiB 超
	body, ct := multipartBody(t, map[string]string{"combo_file": string(oversized)}, nil)
	req := httptest.NewRequest(http.MethodPost, "/api/import/csv/preview", body)
	req.Header.Set(echo.HeaderContentType, ct)
	rec := httptest.NewRecorder()
	if err := h.Preview(e.NewContext(req, rec)); err != nil {
		t.Fatalf("Preview: %v", err)
	}
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status: got %d want 400 (size guard)", rec.Code)
	}
}

func TestPreviewHandler_Happy(t *testing.T) {
	h := comboiohandler.NewHandler(&mockService{
		previewFn: func(_ context.Context, comboCSV, setupCSV string) (*comboiosvc.PreviewResult, error) {
			if comboCSV == "" {
				t.Error("comboCSV not passed through")
			}
			return &comboiosvc.PreviewResult{
				Combos:  []comboiosvc.ComboPreviewRow{{RowNumber: 1, LocalID: "c1", Importable: true}},
				Summary: comboiosvc.PreviewSummary{ComboTotal: 1, ComboOK: 1},
			}, nil
		},
	})
	e := echo.New()
	body, ct := multipartBody(t, map[string]string{"combo_file": "local_id\nc1\n"}, nil)
	req := httptest.NewRequest(http.MethodPost, "/api/import/csv/preview", body)
	req.Header.Set(echo.HeaderContentType, ct)
	rec := httptest.NewRecorder()
	if err := h.Preview(e.NewContext(req, rec)); err != nil {
		t.Fatalf("Preview: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d want 200", rec.Code)
	}
	var resp map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("json: %v", err)
	}
	if _, ok := resp["combos"]; !ok {
		t.Errorf("response missing combos: %s", rec.Body.String())
	}
	if _, ok := resp["summary"]; !ok {
		t.Errorf("response missing summary")
	}
}

// ===========================================================================
// Commit(POST /api/import/csv)
// ===========================================================================

func TestCommitHandler_Happy_DupActionDefaultSkip(t *testing.T) {
	h := comboiohandler.NewHandler(&mockService{
		commitFn: func(_ context.Context, _, _ string, selected []string, action comboiosvc.DupAction) (*comboiosvc.CommitResult, error) {
			if action != comboiosvc.DupSkip {
				t.Errorf("default dupAction: got %q want skip", action)
			}
			if len(selected) != 1 || selected[0] != "c1" {
				t.Errorf("selected not parsed: %v", selected)
			}
			return &comboiosvc.CommitResult{Summary: comboiosvc.CommitSummary{Success: 1}}, nil
		},
	})
	e := echo.New()
	body, ct := multipartBody(t,
		map[string]string{"combo_file": "local_id\nc1\n"},
		map[string]string{"selected": `["c1"]`}, // dupAction 省略 → 既定 skip
	)
	req := httptest.NewRequest(http.MethodPost, "/api/import/csv", body)
	req.Header.Set(echo.HeaderContentType, ct)
	rec := httptest.NewRecorder()
	if err := h.Commit(e.NewContext(req, rec)); err != nil {
		t.Fatalf("Commit: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d want 200", rec.Code)
	}
	var resp struct {
		Summary comboiosvc.CommitSummary `json:"summary"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("json: %v", err)
	}
	if resp.Summary.Success != 1 {
		t.Errorf("summary.success: got %d want 1", resp.Summary.Success)
	}
}

func TestCommitHandler_DupActionSetupsOnly(t *testing.T) {
	h := comboiohandler.NewHandler(&mockService{
		commitFn: func(_ context.Context, _, _ string, _ []string, action comboiosvc.DupAction) (*comboiosvc.CommitResult, error) {
			if action != comboiosvc.DupSetupsOnly {
				t.Errorf("dupAction: got %q want setups_only", action)
			}
			return &comboiosvc.CommitResult{}, nil
		},
	})
	e := echo.New()
	body, ct := multipartBody(t,
		map[string]string{"combo_file": "local_id\nc1\n"},
		map[string]string{"selected": `["c1"]`, "dupAction": "setups_only"},
	)
	req := httptest.NewRequest(http.MethodPost, "/api/import/csv", body)
	req.Header.Set(echo.HeaderContentType, ct)
	rec := httptest.NewRecorder()
	if err := h.Commit(e.NewContext(req, rec)); err != nil {
		t.Fatalf("Commit: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d want 200", rec.Code)
	}
}

// TestCommitHandler_DupActionAddRejected は廃止した "add" が未知値として既定 skip に倒れることを検証する。
func TestCommitHandler_DupActionAddRejected(t *testing.T) {
	h := comboiohandler.NewHandler(&mockService{
		commitFn: func(_ context.Context, _, _ string, _ []string, action comboiosvc.DupAction) (*comboiosvc.CommitResult, error) {
			if action != comboiosvc.DupSkip {
				t.Errorf("removed dupAction=add should fall back to skip, got %q", action)
			}
			return &comboiosvc.CommitResult{}, nil
		},
	})
	e := echo.New()
	body, ct := multipartBody(t,
		map[string]string{"combo_file": "local_id\nc1\n"},
		map[string]string{"selected": `["c1"]`, "dupAction": "add"},
	)
	req := httptest.NewRequest(http.MethodPost, "/api/import/csv", body)
	req.Header.Set(echo.HeaderContentType, ct)
	rec := httptest.NewRecorder()
	if err := h.Commit(e.NewContext(req, rec)); err != nil {
		t.Fatalf("Commit: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d want 200", rec.Code)
	}
}

// ===========================================================================
// M22-02: 利用者 ID の配線(§5.1-11)
// ===========================================================================

// defaultUserResolver は X-User-Id 未指定時の既定利用者を固定で返す。
type defaultUserResolver struct{ id int64 }

func (d defaultUserResolver) DefaultUserID(context.Context) (int64, error) { return d.id, nil }

// ★他から引っ越しの経路へ userID が届いていること。
// ★モックが userID を捨てていると、この配線は誰も見ていない状態になる
// (初版のモックは実際に捨てていた)。
func TestCommitHandler_PassesRequestingUserID(t *testing.T) {
	svc := &mockService{
		commitFn: func(context.Context, string, string, []string, comboiosvc.DupAction) (*comboiosvc.CommitResult, error) {
			return &comboiosvc.CommitResult{}, nil
		},
	}
	e := echo.New()
	e.Use(mw.UserContext(defaultUserResolver{id: 1}))
	comboiohandler.RegisterRoutes(e.Group("/api"), comboiohandler.NewHandler(svc))

	body, ct := multipartBody(t, map[string]string{"combo_file": "local_id\nc1\n"},
		map[string]string{"selected": `["c1"]`})
	req := httptest.NewRequest(http.MethodPost, "/api/import/csv", body)
	req.Header.Set(echo.HeaderContentType, ct)
	req.Header.Set(mw.UserIDHeader, "7")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d (body=%s)", rec.Code, rec.Body.String())
	}
	if svc.lastCommitUserID != 7 {
		t.Errorf("★Commit へ渡った userID = %d, want 7(取り込んだタグが別人のものになる)", svc.lastCommitUserID)
	}
}

// ★出力に載るタグを絞るための userID が Export へ届いていること(§4.5-16)。
func TestExportHandler_PassesRequestingUserID(t *testing.T) {
	svc := &mockService{
		exportFn: func(context.Context, comboiosvc.ExportQuery) ([]byte, error) {
			return []byte("PK\x03\x04"), nil
		},
	}
	e := echo.New()
	e.Use(mw.UserContext(defaultUserResolver{id: 1}))
	comboiohandler.RegisterRoutes(e.Group("/api"), comboiohandler.NewHandler(svc))

	req := httptest.NewRequest(http.MethodGet, "/api/export/csv?range=all", nil)
	req.Header.Set(mw.UserIDHeader, "7")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	if svc.lastExportUserID != 7 {
		t.Errorf("★Export へ渡った userID = %d, want 7", svc.lastExportUserID)
	}
}

// ===========================================================================
// M22-08 §5.1-6 / §4.2: 認証経路の本文サイズ上限が取り込みを壊していない
// ===========================================================================

// TestImportRoutes_AcceptCSVFarLargerThanAuthBodyLimit は、認証経路へ入れた
// 本文サイズの上限(VAL-N07・8KiB)が取り込みへ及んでいないことを、
// ★実物の取り込みハンドラと実物の経路登録を通して固定する。
//
// ★★これが最重要ゲート 2 の網である(M22-08 §4.2-4)。上限を全経路へ掛けると
// 取り込みは「大きいファイルのときだけ」失敗し、小さい CSV のテストは緑のまま通る。
// ⇒ 認証経路の上限をはるかに超える大きさの CSV を、実際に通して確かめる。
func TestImportRoutes_AcceptCSVFarLargerThanAuthBodyLimit(t *testing.T) {
	// 認証経路の上限(8KiB)の 256 倍。取り込みでは日常的な大きさである
	// (取り込み自身の上限は 1 ファイル 10MiB＝VAL-I01)。
	const rows = 40000
	var csv bytes.Buffer
	csv.WriteString("local_id\n")
	for i := 0; i < rows; i++ {
		csv.WriteString("combo-")
		csv.WriteString(strconv.Itoa(i))
		csv.WriteString("\n")
	}
	if csv.Len() <= 8<<10 {
		t.Fatalf("precondition: the fixture (%d bytes) must exceed the auth body limit", csv.Len())
	}

	var received int
	h := comboiohandler.NewHandler(&mockService{
		previewFn: func(_ context.Context, comboCSV, _ string) (*comboiosvc.PreviewResult, error) {
			received = len(comboCSV)
			return &comboiosvc.PreviewResult{
				Summary: comboiosvc.PreviewSummary{ComboTotal: rows, ComboOK: rows},
			}, nil
		},
	})

	// ★本番と同じ形で登録する——認証経路と取り込み経路が同じ /api グループに並ぶ
	//   (cmd/tacpendium/main.go)。認証側の経路単位ミドルウェアが漏れるならここで落ちる。
	e := echo.New()
	api := e.Group("/api")
	authStore := &bodyLimitStore{}
	authapi.RegisterRoutes(api, authapi.NewHandler(authsvc.NewService(authStore)))
	comboiohandler.RegisterRoutes(api, h)

	body, ct := multipartBody(t, map[string]string{"combo_file": csv.String()}, nil)
	req := httptest.NewRequest(http.MethodPost, "/api/import/csv/preview", body)
	req.Header.Set(echo.HeaderContentType, ct)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (a large CSV must still import). body = %s",
			rec.Code, rec.Body.String())
	}
	if received != csv.Len() {
		t.Fatalf("the handler received %d bytes, want %d — the body was truncated", received, csv.Len())
	}

	// 対照: 同じ echo の認証経路では、同じ大きさの本文が実際に 413 で弾かれる。
	// ★これが無いと「そもそも上限が効いていないだけ」と区別できない。
	big := httptest.NewRequest(http.MethodPost, authapi.PathPassword, bytes.NewReader(csv.Bytes()))
	big.Header.Set(echo.HeaderContentType, "application/json")
	bigRec := httptest.NewRecorder()
	e.ServeHTTP(bigRec, big)
	if bigRec.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("control: the auth route accepted %d bytes (status %d), want 413",
			csv.Len(), bigRec.Code)
	}
}

// bodyLimitStore は上記テスト用の最小 SecurityStore(検証子は持たない)。
type bodyLimitStore struct{}

func (bodyLimitStore) Security() appconfig.SecurityConfig { return appconfig.SecurityConfig{} }
func (bodyLimitStore) SetPasswordHash(string) error       { return nil }

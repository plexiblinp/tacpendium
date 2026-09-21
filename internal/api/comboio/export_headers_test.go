package comboio_test

// ★★M29-02 §2.1: 書出の観測を応答ヘッダで運ぶことの主張。
//
// ★なぜヘッダなのか —— 本体は zip のバイト列であり、JSON の警告欄を混ぜられない。
// 画面側には送信前の確認ダイアログを置いたが、それは**画面を通る経路にしか効かない**。
// API を直に叩く呼び出し元にも観測が届くのはヘッダだけである。
// ⇒ 画面とヘッダの両方を置いて、はじめて全経路に観測が付く。
//
// ★★1 経路だけ鳴らして他が黙ったまま残る、が本サブでいちばん起きやすい事故である
// (チェックリスト §0.4-1)。本ファイルはそのうち「API 直叩き」経路の観測である。

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/labstack/echo/v4"

	comboiohandler "github.com/plexiblinp/tacpendium/internal/api/comboio"
	comboiosvc "github.com/plexiblinp/tacpendium/internal/service/comboio"
)

func exportWithResult(t *testing.T, res *comboiosvc.ExportResult) *httptest.ResponseRecorder {
	t.Helper()
	h := comboiohandler.NewHandler(&mockService{
		exportResultFn: func(_ context.Context, _ comboiosvc.ExportQuery) (*comboiosvc.ExportResult, error) {
			return res, nil
		},
	})
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/export/csv?range=all", nil)
	rec := httptest.NewRecorder()
	if err := h.Export(e.NewContext(req, rec)); err != nil {
		t.Fatalf("Export: %v", err)
	}
	return rec
}

func TestExportHeaders_TruncatedIsReported(t *testing.T) {
	rec := exportWithResult(t, &comboiosvc.ExportResult{
		Data:           []byte("PK\x03\x04fake-zip"),
		TotalCombos:    1001, // ★境界 +1
		IncludedCombos: 1000,
	})
	if got := rec.Header().Get("X-Export-Truncated"); got != "true" {
		t.Errorf("X-Export-Truncated = %q, want \"true\"", got)
	}
	if got := rec.Header().Get("X-Export-Total"); got != "1001" {
		t.Errorf("X-Export-Total = %q, want \"1001\"", got)
	}
	if got := rec.Header().Get("X-Export-Included"); got != "1000" {
		t.Errorf("X-Export-Included = %q, want \"1000\"", got)
	}
}

func TestExportHeaders_ExactLimitIsNotReportedAsTruncated(t *testing.T) {
	// ★★着手前の `>=` 判定が出していた偽陽性の回帰。
	rec := exportWithResult(t, &comboiosvc.ExportResult{
		Data:           []byte("PK\x03\x04fake-zip"),
		TotalCombos:    1000,
		IncludedCombos: 1000,
	})
	if got := rec.Header().Get("X-Export-Truncated"); got != "false" {
		t.Errorf("X-Export-Truncated = %q, want \"false\"(1 件も落ちていない)", got)
	}
}

func TestExportHeaders_AlwaysPresentEvenWhenNotTruncated(t *testing.T) {
	// ★★切り捨てが無くてもヘッダを出す。出さないと呼び出し元は
	//   「ヘッダが無い」と「切り捨てていない」を区別できない
	//   (キーが消えると『判定していない』と区別が付かない = DES-002 §4.2 の考え方)。
	rec := exportWithResult(t, &comboiosvc.ExportResult{
		Data:           []byte("PK\x03\x04fake-zip"),
		TotalCombos:    3,
		IncludedCombos: 3,
	})
	for _, k := range []string{
		"X-Export-Total", "X-Export-Included",
		"X-Export-Truncated", "X-Export-Reimport-Blocked",
	} {
		if rec.Header().Get(k) == "" {
			t.Errorf("%s が付いていない(切り捨てが無くても必ず出すこと)", k)
		}
	}
}

func TestExportHeaders_ReimportBlockedIsReported(t *testing.T) {
	// ★書出に上限が無いのに取込は上限で弾く非対称の観測。
	rec := exportWithResult(t, &comboiosvc.ExportResult{
		Data:               []byte("PK\x03\x04fake-zip"),
		TotalCombos:        10,
		IncludedCombos:     10,
		SetupRowsOverLimit: true,
	})
	if got := rec.Header().Get("X-Export-Reimport-Blocked"); got != "true" {
		t.Errorf("X-Export-Reimport-Blocked = %q, want \"true\"", got)
	}
	// ★切り捨てとは別の観測である(混同しない)。
	if got := rec.Header().Get("X-Export-Truncated"); got != "false" {
		t.Errorf("X-Export-Truncated = %q, want \"false\"", got)
	}
}

func TestExportHeaders_AreExposedToBrowsers(t *testing.T) {
	// ★fetch は CORS セーフリスト外のヘッダを既定で読めない。
	//   明示しないと LAN 共有時に観測が静かに読めなくなる。
	rec := exportWithResult(t, &comboiosvc.ExportResult{
		Data: []byte("PK\x03\x04fake-zip"), TotalCombos: 1, IncludedCombos: 1,
	})
	exposed := rec.Header().Get("Access-Control-Expose-Headers")
	for _, k := range []string{"X-Export-Total", "X-Export-Included", "X-Export-Truncated"} {
		if !contains(exposed, k) {
			t.Errorf("Access-Control-Expose-Headers に %s が無い: %q", k, exposed)
		}
	}
}

func contains(haystack, needle string) bool {
	return len(haystack) >= len(needle) && (func() bool {
		for i := 0; i+len(needle) <= len(haystack); i++ {
			if haystack[i:i+len(needle)] == needle {
				return true
			}
		}
		return false
	})()
}

package comboio_test

// ★★M29-02 §2.1(付随): 取込は鳴っていたが「読めない/届かない」形が 2 つあった。
//
//  1. combo_file の上限超過が「コンボ CSV(combo_file)が必要です」と誤ラベルされる。
//     ⇒ 利用者は選び直せばよいと読むが、何度選び直しても直らない。
//  2. setup_file の上限超過が握り潰され、セットプレイが 1 件も入らないのに
//     何も言わない。⇒ 利用者は「セットプレイは無かった」と思う。
//
// ★2 は「黙って落ちる」そのものである。1 は鳴ってはいるが嘘をついている。

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"

	comboiohandler "github.com/plexiblinp/tacpendium/internal/api/comboio"
	comboiosvc "github.com/plexiblinp/tacpendium/internal/service/comboio"
)

const testMaxUploadBytes = 10 << 20 // handler.go の maxUploadBytes と一致

// oversizedBlob は上限を「ちょうど 1 バイト」超える本文を作る。
// ★★2 倍で試さないこと(チェックリスト §6-2)。境界で弾けるかが要点である。
func oversizedBlob() string {
	return string(bytes.Repeat([]byte("a"), testMaxUploadBytes+1))
}

func TestComboFileOversized_IsNotMislabeledAsMissing(t *testing.T) {
	h := comboiohandler.NewHandler(&mockService{
		previewFn: func(context.Context, string, string) (*comboiosvc.PreviewResult, error) {
			t.Fatal("上限超過ならサービスへ届いてはいけない")
			return nil, nil
		},
	})
	e := echo.New()
	body, ct := multipartBody(t, map[string]string{"combo_file": oversizedBlob()}, nil)
	req := httptest.NewRequest(http.MethodPost, "/api/import/csv/preview", body)
	req.Header.Set(echo.HeaderContentType, ct)
	rec := httptest.NewRecorder()
	if err := h.Preview(e.NewContext(req, rec)); err != nil {
		t.Fatalf("Preview: %v", err)
	}
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
	msg := rec.Body.String()
	// ★★「必要です」と言ってはいけない —— ファイルは在る。大きすぎるのである。
	if strings.Contains(msg, "必要です") {
		t.Errorf("★上限超過が「必要です」と誤ラベルされている: %s", msg)
	}
	if !strings.Contains(msg, "上限") {
		t.Errorf("上限超過であることが伝わっていない: %s", msg)
	}
}

func TestSetupFileOversized_IsNotSilentlyDropped(t *testing.T) {
	// ★★着手前はここが黙っていた。セットプレイが 1 件も入らないのに
	//   取込は「成功」として進んでいた(= 成功の自動断定)。
	called := false
	h := comboiohandler.NewHandler(&mockService{
		previewFn: func(_ context.Context, _, setupCSV string) (*comboiosvc.PreviewResult, error) {
			called = true
			if setupCSV == "" {
				t.Error("★セットプレイ CSV が黙って空にされたまま取込へ進んだ")
			}
			return &comboiosvc.PreviewResult{}, nil
		},
	})
	e := echo.New()
	body, ct := multipartBody(t, map[string]string{
		"combo_file": "local_id,character_code\n",
		"setup_file": oversizedBlob(),
	}, nil)
	req := httptest.NewRequest(http.MethodPost, "/api/import/csv/preview", body)
	req.Header.Set(echo.HeaderContentType, ct)
	rec := httptest.NewRecorder()
	if err := h.Preview(e.NewContext(req, rec)); err != nil {
		t.Fatalf("Preview: %v", err)
	}
	if called {
		t.Fatal("★上限超過のまま取込処理へ進んでいる(握り潰されている)")
	}
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400(上限超過は伝える)", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "上限") {
		t.Errorf("上限超過であることが伝わっていない: %s", rec.Body.String())
	}
}

func TestSetupFileAbsent_StillProceeds(t *testing.T) {
	// ★★「添付されていない」と「大きすぎる」を混同しないことの主張。
	//   セットプレイ CSV は任意であり、無いだけなら従来どおり通す。
	//   ここを一緒くたに弾くと、コンボだけの取込ができなくなる(過剰修正)。
	called := false
	h := comboiohandler.NewHandler(&mockService{
		previewFn: func(_ context.Context, _, setupCSV string) (*comboiosvc.PreviewResult, error) {
			called = true
			if setupCSV != "" {
				t.Errorf("setupCSV = %q, want 空", setupCSV)
			}
			return &comboiosvc.PreviewResult{}, nil
		},
	})
	e := echo.New()
	body, ct := multipartBody(t, map[string]string{
		"combo_file": "local_id,character_code\n",
	}, nil)
	req := httptest.NewRequest(http.MethodPost, "/api/import/csv/preview", body)
	req.Header.Set(echo.HeaderContentType, ct)
	rec := httptest.NewRecorder()
	if err := h.Preview(e.NewContext(req, rec)); err != nil {
		t.Fatalf("Preview: %v", err)
	}
	if !called {
		t.Fatal("★セットプレイ CSV が無いだけで取込が止まっている(過剰な修正)")
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
}

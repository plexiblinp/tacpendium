package main

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"

	healthapi "github.com/plexiblinp/tacpendium/internal/api/health"
)

// TestTacpendiumRespondsAt は二重起動の判別が「同じアプリだけ」を拾うことを固定する
// (M34-overview §4.4 の危険)。
//
// ★★誤判定の代償が大きい —— 別のソフトがそのポートに居たときに「同じアプリ」と
// 読むと、他人のプロセスの画面を開きに行ったうえで自分は退く。⇒ 利用者から見ると
// アプリが起動しない。
func TestTacpendiumRespondsAt(t *testing.T) {
	cases := []struct {
		name    string
		handler http.HandlerFunc
		want    bool
	}{
		{
			name: "本体の応答(status + version)は同一アプリと判定する",
			handler: func(w http.ResponseWriter, r *http.Request) {
				if r.URL.Path != "/api/health" {
					w.WriteHeader(http.StatusNotFound)
					return
				}
				w.Header().Set("Content-Type", "application/json")
				_, _ = w.Write([]byte(`{"status":"ok","version":"0.1.0"}`))
			},
			want: true,
		},
		{
			name: "別のソフトが 200 を返しても、未知のキーが在れば別物と扱う",
			handler: func(w http.ResponseWriter, _ *http.Request) {
				_, _ = w.Write([]byte(`{"status":"ok","version":"1.2.3","service":"someone-else"}`))
			},
			want: false,
		},
		{
			name: "JSON でない応答は別物",
			handler: func(w http.ResponseWriter, _ *http.Request) {
				_, _ = w.Write([]byte(`<html>hello</html>`))
			},
			want: false,
		},
		{
			name: "status が ok でなければ別物",
			handler: func(w http.ResponseWriter, _ *http.Request) {
				_, _ = w.Write([]byte(`{"status":"degraded","version":"0.1.0"}`))
			},
			want: false,
		},
		{
			name: "version が空なら別物",
			handler: func(w http.ResponseWriter, _ *http.Request) {
				_, _ = w.Write([]byte(`{"status":"ok","version":""}`))
			},
			want: false,
		},
		{
			name: "/api/health が無ければ別物",
			handler: func(w http.ResponseWriter, _ *http.Request) {
				w.WriteHeader(http.StatusNotFound)
			},
			want: false,
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			srv := httptest.NewServer(tc.handler)
			defer srv.Close()
			base := srv.URL + "/"
			if got := tacpendiumRespondsAt(context.Background(), srv.Client(), base); got != tc.want {
				t.Errorf("tacpendiumRespondsAt() = %v, want %v", got, tc.want)
			}
		})
	}
}

// TestTacpendiumRespondsAt_UsesTheRealHealthHandler は「自分自身を認識できること」を
// 実ハンドラの応答で固定する(レビュー指摘 中-10)。
//
// ★★上のテーブルは手書きのリテラル JSON である。⇒ それだけだと、誰かが
// healthapi.Response にフィールドを足したとき、実物の応答は
// DisallowUnknownFields で弾かれるのにテストは古い 2 キーを送り続けて全緑になる。
// ★二重起動の判別が黙って無効化する形であり、動作は「常に新規起動」に見える。
func TestTacpendiumRespondsAt_UsesTheRealHealthHandler(t *testing.T) {
	e := echo.New()
	e.GET("/api/health", healthapi.Handler)
	srv := httptest.NewServer(e)
	defer srv.Close()

	if !tacpendiumRespondsAt(context.Background(), srv.Client(), srv.URL+"/") {
		t.Fatal("実ハンドラの応答を同一アプリと判定できない(判別が無効化している)")
	}
}

// TestTacpendiumRespondsAt_NobodyListening は「誰も居ない」= 通常の起動が
// 妨げられないことを固定する。★ここを取り違えると、アプリが一度も起動しなくなる。
func TestTacpendiumRespondsAt_NobodyListening(t *testing.T) {
	srv := httptest.NewServer(http.NotFoundHandler())
	base := srv.URL + "/"
	srv.Close() // 誰も listen していない状態を作る

	if tacpendiumRespondsAt(context.Background(), http.DefaultClient, base) {
		t.Error("接続できないのに「既に起動している」と判定した")
	}
}

// TestOpenExistingInstance_FailureIsReported は「既存の画面を開けなかったとき」だけ
// 伝えることを固定する。★開けたときは画面が出ること自体がフィードバックであり、
// ダイアログは出さない。
func TestOpenExistingInstance_FailureIsReported(t *testing.T) {
	captured := swapAlert(t)

	origOpen := desktopOpenURL
	desktopOpenURL = func(string) error { return errors.New("no browser") }
	t.Cleanup(func() { desktopOpenURL = origOpen })

	openExistingInstance("http://127.0.0.1:47318/")
	if len(*captured) != 1 || !strings.HasPrefix((*captured)[0], notifyTitleAlreadyRunning+"|") {
		t.Fatalf("通知 = %v", *captured)
	}

	// ★成功時は黙る。
	captured2 := swapAlert(t)
	desktopOpenURL = func(string) error { return nil }
	openExistingInstance("http://127.0.0.1:47318/")
	if len(*captured2) != 0 {
		t.Errorf("成功時に通知が出ている: %v", *captured2)
	}
}

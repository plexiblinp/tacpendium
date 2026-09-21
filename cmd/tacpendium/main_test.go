package main

import (
	"bytes"
	"errors"
	"fmt"
	"net"
	"os"
	"strings"
	"testing"

	appconfig "github.com/plexiblinp/tacpendium/internal/config"
	"github.com/plexiblinp/tacpendium/internal/desktop"
	"github.com/plexiblinp/tacpendium/internal/infra/netutil"
)

func TestPrintStartupNotice_LocalMode(t *testing.T) {
	var buf bytes.Buffer
	printStartupNotice(&buf, "local", 47318, nil, false)
	out := buf.String()

	if !strings.Contains(out, "http://localhost:47318/") {
		t.Errorf("local notice missing PC URL; got:\n%s", out)
	}
	// local モードでは LAN URL 行・FW ヒントを出さない。
	if strings.Contains(out, "スマホ") || strings.Contains(out, "ファイアウォール") {
		t.Errorf("local notice should not include LAN/firewall lines; got:\n%s", out)
	}
}

func TestPrintStartupNotice_LanMode(t *testing.T) {
	var buf bytes.Buffer
	ips := []net.IP{net.ParseIP("192.168.1.50"), net.ParseIP("10.0.0.5")}
	printStartupNotice(&buf, "lan", 47319, ips, false)
	out := buf.String()

	if !strings.Contains(out, "http://localhost:47319/") {
		t.Errorf("lan notice missing PC URL; got:\n%s", out)
	}
	// 実ポート追従で渡した全 IP の URL を含む。
	if !strings.Contains(out, "http://192.168.1.50:47319/") {
		t.Errorf("lan notice missing LAN URL for 192.168.1.50; got:\n%s", out)
	}
	if !strings.Contains(out, "http://10.0.0.5:47319/") {
		t.Errorf("lan notice missing LAN URL for 10.0.0.5; got:\n%s", out)
	}
	// FW / サードパーティ AV ヒントを含む。
	if !strings.Contains(out, "ファイアウォール") {
		t.Errorf("lan notice missing firewall hint; got:\n%s", out)
	}
	if !strings.Contains(out, "Norton") {
		t.Errorf("lan notice missing third-party AV hint; got:\n%s", out)
	}
}

func TestPrintStartupNotice_LanModeNoIP(t *testing.T) {
	var buf bytes.Buffer
	printStartupNotice(&buf, "lan", 47318, nil, false)
	out := buf.String()

	// IP 未検出でもクラッシュせず、その旨と FW ヒントを案内する。
	if !strings.Contains(out, "検出できませんでした") {
		t.Errorf("lan notice (no IP) missing not-detected message; got:\n%s", out)
	}
	if !strings.Contains(out, "ファイアウォール") {
		t.Errorf("lan notice (no IP) missing firewall hint; got:\n%s", out)
	}
}

// TestPrintStartupNotice_ExitHintFollowsTray は常駐化で失効した文面が直っていることを
// 固定する(M34-02 段 6 / followup `startup-notice-text-stale-on-tray`)。
//
// ★★放っておくと利用者へそのまま出る —— -H=windowsgui では閉じる窓が無いのに
// 「このウィンドウを閉じてください」と書かれた案内が出る。★動作は正しいままなので
// テストも lint も型検査も緑になる。人が読む以外に見つける経路が無い。
func TestPrintStartupNotice_ExitHintFollowsTray(t *testing.T) {
	var withTray bytes.Buffer
	printStartupNotice(&withTray, "local", 47318, nil, true)
	if out := withTray.String(); !strings.Contains(out, "通知領域のアイコン") {
		t.Errorf("トレイが在るのに常駐の終了案内が無い:\n%s", out)
	}
	if out := withTray.String(); strings.Contains(out, "このウィンドウを閉じて") {
		t.Errorf("失効した文面が残っている(閉じる窓は無い):\n%s", out)
	}

	var noTray bytes.Buffer
	printStartupNotice(&noTray, "local", 47318, nil, false)
	if out := noTray.String(); !strings.Contains(out, "このウィンドウを閉じて") {
		t.Errorf("トレイの無い OS では従来の案内が正しい:\n%s", out)
	}
}

// TestAppURLsShareOneOrigin は 3 つの導線が同じ origin を指すことを固定する
// (レビュー指摘 高-2)。
//
// ★★割れると UI 状態が導線ごとに分かれる —— localStorage / sessionStorage は
// origin 単位であり、web/CLAUDE.md §1 台帳の実装済み 9 キー(keyboard-bindings-v1 は
// **既定を持たず全件を利用者が登録する**)が「どちらから入ったか」で別物になる。
// ★動作は正しく見えるため、テストが無いと誰も気づけない。
func TestAppURLsShareOneOrigin(t *testing.T) {
	const port = 47318
	origin := fmt.Sprintf("http://%s:%d", localAppHost, port)

	if got := localAppURL(port); !strings.HasPrefix(got, origin+"/") {
		t.Errorf("ブラウザで開く URL = %q, want %q 配下", got, origin)
	}
	if got := settingsQRURL(port); !strings.HasPrefix(got, origin+"/") {
		t.Errorf("設定画面の URL = %q, want %q 配下", got, origin)
	}

	var buf bytes.Buffer
	printStartupNotice(&buf, "local", port, nil, true)
	if out := buf.String(); !strings.Contains(out, origin+"/") {
		t.Errorf("起動案内が別の origin を案内している(origin=%s):\n%s", origin, out)
	}
}

// TestTrayResidentMatchesDesktopContract は trayResident() の境界が
// internal/desktop の OS 分離と一致していることを突き合わせる。
//
// ★★非 Windows 側でしか測れない —— Windows で RunTray を呼ぶとメッセージループへ
// 入ってブロックするためである。⇒ CI は Linux で回るので、ここは常に走る。
// ★ずれると起動案内の終了の導線が嘘になる。
func TestTrayResidentMatchesDesktopContract(t *testing.T) {
	if trayResident() {
		t.Skip("Windows では RunTray がブロックするため突き合わせられない")
	}
	if err := desktop.RunTray(desktop.TrayMenu{}); !errors.Is(err, desktop.ErrUnsupported) {
		t.Fatalf("trayResident() は false なのに RunTray が %v を返した", err)
	}
}

// ===========================================================================
// M22-05: 許可 Origin の構築(指示書 §5.1-8・§4.3)
//
// ★モードで変わるのは「許可 Origin が 1 本増えるかどうか」だけであり、
// ミドルウェアの構成・順序は変わらない。境界を守っているのは bind アドレスで
// あって CORS ではない(DES-002 §3.2)。
// ===========================================================================

// buildAllowedOriginsPort はテストで使う実ポート。★リテラルで固定する
// (SUPP-001 §5.5 (13))。
const buildAllowedOriginsPort = 47318

// TestBuildAllowedOrigins_LocalMode は local モードの許可 Origin が
// ループバックの 2 本ちょうどであることを固定する。
func TestBuildAllowedOrigins_LocalMode(t *testing.T) {
	got, err := buildAllowedOrigins("local", buildAllowedOriginsPort)
	if err != nil {
		t.Fatalf("buildAllowedOrigins: %v", err)
	}
	want := []string{"http://localhost:47318", "http://127.0.0.1:47318"}
	if len(got) != len(want) {
		t.Fatalf("origins = %v (len %d), want %v (len %d)", got, len(got), want, len(want))
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("origins[%d] = %q, want %q", i, got[i], want[i])
		}
	}
}

// TestBuildAllowedOrigins_UnknownModeFallsBackToLocal は、mode が未知の値でも
// ループバックだけを許可する(＝開く側へ倒れない)ことを固定する。
//
// ★determineBindHost も同じく "lan" 以外を 127.0.0.1 として扱う。
func TestBuildAllowedOrigins_UnknownModeFallsBackToLocal(t *testing.T) {
	local, err := buildAllowedOrigins("local", buildAllowedOriginsPort)
	if err != nil {
		t.Fatalf("buildAllowedOrigins(local): %v", err)
	}
	for _, mode := range []string{"", "LAN", "shared", "0.0.0.0"} {
		got, err := buildAllowedOrigins(mode, buildAllowedOriginsPort)
		if err != nil {
			t.Errorf("buildAllowedOrigins(%q): %v", mode, err)
			continue
		}
		if len(got) != len(local) {
			t.Errorf("mode %q: origins = %v, want the local list %v", mode, got, local)
		}
	}
}

// TestBuildAllowedOrigins_LanModeAppendsToLocalList は、lan モードが local の
// 一覧を「置き換えず、末尾へ 1 本足す」形であることを固定する。
//
// ★置き換えにすると自機のブラウザから使えなくなる。
// ★代表 LAN IP が見つからない環境(CI・コンテナ等)では起動そのものが中止される
// 仕様のため、その場合は skip する。
func TestBuildAllowedOrigins_LanModeAppendsToLocalList(t *testing.T) {
	got, err := buildAllowedOrigins("lan", buildAllowedOriginsPort)
	if err != nil {
		if errors.Is(err, netutil.ErrNoLANIP) {
			t.Skipf("代表 LAN IP を検出できない環境のため skip(lan モードは起動時に中止される): %v", err)
		}
		t.Fatalf("buildAllowedOrigins(lan): %v", err)
	}

	local, err := buildAllowedOrigins("local", buildAllowedOriginsPort)
	if err != nil {
		t.Fatalf("buildAllowedOrigins(local): %v", err)
	}
	if len(got) != len(local)+1 {
		t.Fatalf("lan origins = %v (len %d), want the local list plus exactly one (len %d)",
			got, len(got), len(local)+1)
	}
	for i := range local {
		if got[i] != local[i] {
			t.Errorf("lan origins[%d] = %q, want %q (local の一覧を置き換えていない)", i, got[i], local[i])
		}
	}

	// 追加された 1 本は http スキームの プライベート IPv4 であること。
	// ★https にしないこと —— LAN 構成は平文 HTTP である(契約 F-3)。
	extra := got[len(got)-1]
	if !strings.HasPrefix(extra, "http://") {
		t.Errorf("lan の追加 Origin = %q, want the http:// scheme (平文 HTTP が前提)", extra)
	}
	host, _, splitErr := net.SplitHostPort(strings.TrimPrefix(extra, "http://"))
	if splitErr != nil {
		t.Fatalf("lan の追加 Origin %q を host:port へ分解できない: %v", extra, splitErr)
	}
	if ip := net.ParseIP(host); ip == nil || !netutil.IsPrivateIPv4(ip) {
		t.Errorf("lan の追加 Origin のホスト部 = %q, want a private IPv4", host)
	}
}

// TestBuildAllowedOrigins_UsesActualPort は、本関数が受け取った port を許可 Origin へ
// そのまま反映し、既定ポートを焼き付けないことを固定する。
//
// ★固定できるのはここまでである。「ポート競合フォールバック後の実ポートが渡ること」
// 自体は main.go の配線(listener 確保 → cfg.Server.Port = actualPort → 本関数の呼び出し)
// 側にあり、本テストの射程外である。⇒ 配線が壊れても本テストは緑のままになる。
func TestBuildAllowedOrigins_UsesActualPort(t *testing.T) {
	const fallbackPort = 47325
	got, err := buildAllowedOrigins("local", fallbackPort)
	if err != nil {
		t.Fatalf("buildAllowedOrigins: %v", err)
	}
	for _, origin := range got {
		if !strings.HasSuffix(origin, ":47325") {
			t.Errorf("origin %q does not carry the actual port 47325", origin)
		}
	}
}

// M24-09c 追補 / CHANGE-135: 設定ファイルのパスを env で差し替えられること。
//
// ★★守っているのは「既定の挙動が不変であること」である。
// TACPENDIUM_CONFIG_PATH を未設定にしたときアプリ実行ディレクトリ直下の config.toml を
// 読む、という SUPP-001 §5.8 の契約は変わっていない。env はそれを一時的に外すだけである。
//
// ★★M34-02 段 1 で期待値が「相対の "config.toml"」から「AppBaseDir() 直下の絶対パス」へ
// 変わった。⇒ 契約(実行ディレクトリ直下)は同じで、実装がそれに追いついた。
// ★開発時とテスト中は AppBaseDir() がカレントディレクトリを返すため、読む先の実体は
// 従来と同じである(テストの CWD はパッケージディレクトリ)。
//
// ★なぜ要るのか —— E2E は使い捨て DB と専用ポートで dev から分離しているつもりだったが、
// 設定ファイルだけは dev と同じ実ファイルを読んでいた。開発者が設定画面で既定キャラを
// 変えると E2E が 35 件まとめて落ちた(M24-09c 追補・事実 A)。
func TestResolveConfigPath(t *testing.T) {
	for _, tc := range []struct {
		name string
		// set が false のときは env を設定しない(未設定の状態を作る)。
		set  bool
		env  string
		want string
	}{
		{name: "env 未設定なら実行ディレクトリ直下の config.toml", set: false, want: appconfig.ResolveAppPath("config.toml")},
		{name: "env が空文字なら既定へ倒す", set: true, env: "", want: appconfig.ResolveAppPath("config.toml")},
		{name: "env が空白だけなら既定へ倒す", set: true, env: "   ", want: appconfig.ResolveAppPath("config.toml")},
		{name: "env があればその値を使う", set: true, env: "web/e2e/.tmp/tacpendium-e2e.toml", want: "web/e2e/.tmp/tacpendium-e2e.toml"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if tc.set {
				t.Setenv(appconfig.EnvConfigPath, tc.env)
			} else {
				// ★t.Setenv は「設定する」しかできないため、未設定側は明示的に外す。
				//   t.Setenv を一度通してから Unsetenv すると、後片付けは t.Setenv が担う。
				t.Setenv(appconfig.EnvConfigPath, "sentinel")
				if err := os.Unsetenv(appconfig.EnvConfigPath); err != nil {
					t.Fatalf("unset %s: %v", appconfig.EnvConfigPath, err)
				}
			}
			if got := resolveConfigPath(); got != tc.want {
				t.Errorf("resolveConfigPath() = %q, want %q", got, tc.want)
			}
		})
	}
}

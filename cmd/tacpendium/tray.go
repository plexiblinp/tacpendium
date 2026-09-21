package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/plexiblinp/tacpendium/internal/desktop"
)

// トレイの表題・メニュー文言。★リテラルを配線側へ散らさない(CLAUDE.md 共通規約)。
//
// ★★中身は開発者が確定させたものである(M34-overview §5.1.6 / D-792) ————————
// 確定 4 件 = ブラウザで開く / 設定画面をブラウザで開く / ログフォルダを開く / 終了。
// 候補 2 件のうち「DB のフォルダを開く」を採り、「exe のフォルダを開く」は採らない。
// ⇒ 段 1 でログの基準を実行ファイルの位置へ寄せたため、exe のフォルダはログフォルダの
// 親になる(同 §5.1.6-6 が「親になるなら足さない」と書いた条件)。DB は既定で
// %APPDATA%/tacpendium/ にあり重ならないので、そちらは項目として意味がある。
//
// ★★【2026-09-12 開発者要求で 1 件追加】設定ファイルのフォルダを開く ————————
// 逐語 =「パスワードリセット等の時に直接いじるので、ないと困る」。
// ⇒ 簡易パスワードを忘れたときの復旧手段は config.toml の手編集だけであり
// (config.toml.example のコメントが唯一の手順)、アプリ側からは復旧できない。
// ★実測の置き場は AppBaseDir()(= 配布では exe の隣)であり、ログフォルダの親に当たる。
// ⇒ 「exe のフォルダを開く」を名前を変えて採ったのと同じ場所を開くことになるが、
// **用途で名付ける**。§5.1.6-6 が足さないと決めたのは「ログフォルダの親という
// それだけの理由では要らない」であって、復旧導線としての必要性は別である。
// ★重複して「exe のフォルダを開く」を足さないこと(同じ場所が 2 項目に出る)。
const (
	trayTitle              = "Tacpendium"
	trayLabelOpenApp       = "ブラウザで開く"
	trayLabelOpenSettings  = "設定画面をブラウザで開く"
	trayLabelOpenConfigDir = "設定ファイルのフォルダを開く"
	trayLabelOpenLogDir    = "ログフォルダを開く"
	trayLabelOpenDBDir     = "DB のフォルダを開く"
	trayLabelQuit          = "終了"

	trayQuitPrompt = "Tacpendium を終了します。よろしいですか?\n(終了するとブラウザの画面は使えなくなります)"

	// shutdownTimeout は終了時に HTTP サーバの後片付けを待つ上限。
	shutdownTimeout = 5 * time.Second
)

// trayDeps はトレイのメニューが触る外界。★すべて関数で受け取る ——
// desktop パッケージを直に呼ぶとメニューの結線を Linux でテストできない。
type trayDeps struct {
	AppURL      string // 「ブラウザで開く」の URL
	SettingsURL string // 「設定画面をブラウザで開く」の URL(QR のディープリンク)
	ConfigDir   string // 実際に読んでいる config.toml の在るディレクトリ
	LogDir      string // ログの出先(段 1 で解決済みの絶対パス)
	DBDir       string // DB の在るディレクトリ

	OpenURL    func(string) error
	OpenFolder func(string) error
	Confirm    func(title, text string) bool
	// Notify は失敗を利用者へ伝える経路。段 4 で MessageBox へ載る。
	Notify func(title string, err error)
	// Quit は画面とトレイで共通の終了処理(HTTP サーバを止めてアイコンを消す)。
	Quit func()
}

// buildTrayMenu は確定したメニューを組み立てる。
//
// ★★各項目は失敗しうる(ブラウザが無い / フォルダが無い / パスが空)。⇒ 失敗を
// 握り潰さず Notify へ渡す。黙って何も起きないのが最悪である(指示書 §2.4-2)。
func buildTrayMenu(d trayDeps) desktop.TrayMenu {
	openURL := func(label, url string) func() {
		return func() {
			if err := d.OpenURL(url); err != nil {
				d.Notify(label, fmt.Errorf("%s を開けませんでした: %w", url, err))
			}
		}
	}
	openFolder := func(label, dir string) func() {
		return func() {
			if err := d.OpenFolder(dir); err != nil {
				d.Notify(label, fmt.Errorf("フォルダを開けませんでした: %w", err))
			}
		}
	}

	return desktop.TrayMenu{
		Title: trayTitle,
		// ★ツールチップが「動いているか」の唯一の表示である(desktop.TrayMenu の注記)。
		Tooltip: trayTitle + " 稼働中\n" + d.AppURL,
		Items: []desktop.TrayItem{
			// ★Default は左ダブルクリックでも走る項目(M34-overview §5.1.6-1)。
			{Label: trayLabelOpenApp, OnClick: openURL(trayLabelOpenApp, d.AppURL), Default: true},
			// ★QR はトレイで描かない —— 設定画面のネットワーク節を開くところまでにする
			// (Go の QR ライブラリと Win32 の描画ウィンドウが増えるため。指示書 §3-3)。
			// ★LAN 共有 OFF のときの出し分けも作らない(開発者判断・2026-09-09)。
			{Label: trayLabelOpenSettings, OnClick: openURL(trayLabelOpenSettings, d.SettingsURL)},
			// ★設定ファイルは画面からは直せない項目(簡易パスワードの復旧)のために
			// 手編集する。⇒ その置き場をここから開く(2026-09-12 開発者要求)。
			// ★TACPENDIUM_CONFIG_PATH で差し替えている場合も「実際に読んでいる方」を開く。
			{Label: trayLabelOpenConfigDir, OnClick: openFolder(trayLabelOpenConfigDir, d.ConfigDir)},
			{Label: trayLabelOpenLogDir, OnClick: openFolder(trayLabelOpenLogDir, d.LogDir)},
			{Label: trayLabelOpenDBDir, OnClick: openFolder(trayLabelOpenDBDir, d.DBDir)},
			{Label: trayLabelQuit, OnClick: func() {
				// ★終了確認を挟む(M34-overview §5.1.6-4)。
				// ★非 Windows の Confirm は常に false を返すが、その OS にトレイは
				// 出ないため本経路へ来ない(desktop.RunTray が ErrUnsupported)。
				if !d.Confirm(trayTitle, trayQuitPrompt) {
					return
				}
				d.Quit()
			}},
		},
	}
}

// httpServer は常駐中に停止させる対象。*echo.Echo が満たす。
// ★インタフェースにしてあるのは runResident を Linux でテストするためである。
type httpServer interface {
	Start(address string) error
	Shutdown(ctx context.Context) error
}

// trayRunner は通知領域アイコンの実装。既定は desktop パッケージ。
type trayRunner interface {
	Run(desktop.TrayMenu) error
	Stop()
}

// desktopTray は internal/desktop への既定の結線。
type desktopTray struct{}

func (desktopTray) Run(m desktop.TrayMenu) error { return desktop.RunTray(m) }
func (desktopTray) Stop()                        { desktop.StopTray() }

// runResident は HTTP サーバを別 goroutine で起こし、トレイのメッセージループを
// 呼び出し元の goroutine(= main)で回す。
//
// ★★RunTray はブロックし、メインスレッドを握る goroutine から呼ぶ契約である
// (tray_windows.go の注記)。⇒ 入れ替えて「サーバを main、トレイを goroutine」に
// しないこと。
//
// ★★ErrUnsupported を致命エラーとして扱わない(SUPP-001 §5.2 の注記) ————————
// 非 Windows ではトレイが無いので、従来どおりサーバの終了まで待つ。★致命にすると
// Linux/macOS でアプリが起動しなくなる。
func runResident(srv httpServer, bindAddr, appURL string, tray trayRunner,
	notify func(title string, err error), buildMenu func(quit func()) desktop.TrayMenu) error {

	var mu sync.Mutex
	var srvErr error
	done := make(chan struct{})

	go func() {
		defer close(done)
		if err := srv.Start(bindAddr); err != nil && !errors.Is(err, http.ErrServerClosed) {
			mu.Lock()
			srvErr = fmt.Errorf("server: %w", err)
			mu.Unlock()
			slog.Error("http server stopped with an error", slog.String("err", err.Error()))
			// ★サーバが落ちたまま常駐し続けない。アイコンを畳んで runResident を返させる。
			// ★★ここでは通知しない —— エラーは呼び出し元へ返り、main() の reportFatal が
			// 唯一の致命出口として MessageBox を出す。2 か所で出すと同じ失敗が二重に出る。
			tray.Stop()
		}
	}()

	var quitOnce sync.Once
	quit := func() {
		quitOnce.Do(func() {
			slog.Info("shutting down", slog.String("reason", "quit requested"))
			ctx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
			defer cancel()
			if err := srv.Shutdown(ctx); err != nil {
				slog.Warn("graceful shutdown failed", slog.String("err", err.Error()))
			}
			tray.Stop()
		})
	}

	err := tray.Run(buildMenu(quit))
	switch {
	case err == nil:
		// 終了要求でメッセージループを抜けた。
		//
		// ★★quit を呼び直す。冪等である(sync.Once) —— RunTray は WM_QUIT で nil を
		// 返すが、WM_QUIT は StopTray 以外からも来る(Windows のログオフ・
		// シャットダウン処理、任意の PostQuitMessage)。その場合 quit は 1 度も走って
		// おらず srv.Shutdown も呼ばれないため、srv.Start は返らない。
		// ⇒ <-done で永久にブロックし、窓もアイコンも無い状態でプロセスが残る。
		quit()
	case errors.Is(err, desktop.ErrUnsupported):
		slog.Info("no notification-area icon on this platform; continuing without one")
	default:
		// ★アイコンが出せなくてもアプリは使える。⇒ 致命にしない。
		// ★★ただし、この状態では利用者に止める手段が残っていない ——
		// コンソール窓(段 5 で消えた)・トレイアイコン(出せなかった)・画面側の
		// 終了ボタン(未実装)のどれも無い。⇒ 文面でそれを伝える。
		slog.Error("could not show the notification-area icon", slog.String("err", err.Error()))
		notify(notifyTitleTrayFailed, fmt.Errorf("%w\n\n"+
			"アプリはブラウザから使えます: %s\n"+
			"終了するにはタスク マネージャーで tacpendium を終了してください。", err, appURL))
	}

	<-done
	mu.Lock()
	defer mu.Unlock()
	return srvErr
}

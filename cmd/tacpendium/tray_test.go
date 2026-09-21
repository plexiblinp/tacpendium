package main

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/plexiblinp/tacpendium/internal/desktop"
)

// ---------------------------------------------------------------------------
// メニューの中身(段 3)
// ---------------------------------------------------------------------------

func testDeps() (trayDeps, *recorder) {
	r := &recorder{}
	return trayDeps{
		AppURL:      "http://127.0.0.1:47318/",
		SettingsURL: "http://127.0.0.1:47318/settings?qr=1",
		ConfigDir:   "/app",
		LogDir:      "/app/logs",
		DBDir:       "/appdata/tacpendium",
		OpenURL:     func(u string) error { r.urls = append(r.urls, u); return r.urlErr },
		OpenFolder:  func(d string) error { r.dirs = append(r.dirs, d); return r.dirErr },
		Confirm:     func(string, string) bool { r.confirms++; return r.confirmAnswer },
		Notify:      func(title string, err error) { r.notified = append(r.notified, title) },
		Quit:        func() { r.quits++ },
	}, r
}

type recorder struct {
	urls, dirs, notified []string
	urlErr, dirErr       error
	confirms, quits      int
	confirmAnswer        bool
}

// TestBuildTrayMenu_ConfirmedItems は開発者が確定させたメニュー(M34-overview §5.1.6 /
// D-792 ＋ 2026-09-12 の追加要求)を機械で固定する。
//
// ★候補 2 件の採否も併せて固定する ——「DB のフォルダを開く」は採り、
// 「exe のフォルダを開く」という項目は作らない(段 1 でログの基準を実行ファイルの位置へ
// 寄せたため、exe のフォルダはログフォルダの親になる)。
//
// ★★ただし同じ場所は「設定ファイルのフォルダを開く」として開く(2026-09-12)。
// ⇒ 簡易パスワードを忘れたときの復旧は config.toml の手編集だけであり、用途としては
// 別物である。**名前を分けて 1 項目に保つこと** —— 同じ場所を指す項目を 2 つ出さない。
func TestBuildTrayMenu_ConfirmedItems(t *testing.T) {
	d, _ := testDeps()
	m := buildTrayMenu(d)

	want := []string{
		trayLabelOpenApp,
		trayLabelOpenSettings,
		trayLabelOpenConfigDir,
		trayLabelOpenLogDir,
		trayLabelOpenDBDir,
		trayLabelQuit,
	}
	if len(m.Items) != len(want) {
		t.Fatalf("項目数 %d, want %d (%v)", len(m.Items), len(want), labelsOf(m))
	}
	for i, label := range want {
		if m.Items[i].Label != label {
			t.Errorf("項目 %d = %q, want %q", i, m.Items[i].Label, label)
		}
		if m.Items[i].OnClick == nil {
			t.Errorf("項目 %q に OnClick が無い", label)
		}
	}
	// ★同じ場所を指す項目を 2 つ出さない。「設定ファイルのフォルダ」が配布では
	// exe のフォルダそのものであり、別名でもう 1 項目足すと重複する。
	for _, label := range labelsOf(m) {
		if label == "exe のフォルダを開く" {
			t.Error("同じ場所を指す項目が重複している(設定ファイルのフォルダ = exe のフォルダ)")
		}
	}

	// ★Default は 1 件だけ。左ダブルクリックで走るのは「ブラウザで開く」である。
	defaults := 0
	for _, it := range m.Items {
		if it.Default {
			defaults++
			if it.Label != trayLabelOpenApp {
				t.Errorf("Default が %q に付いている", it.Label)
			}
		}
	}
	if defaults != 1 {
		t.Errorf("Default の数 = %d, want 1", defaults)
	}

	// ★ツールチップは「動いているか」の唯一の表示である。URL が読めること。
	if !strings.Contains(m.Tooltip, d.AppURL) {
		t.Errorf("Tooltip に URL が無い: %q", m.Tooltip)
	}
}

// TestBuildTrayMenu_OpensExpectedTargets は各項目が開く先を固定する。
func TestBuildTrayMenu_OpensExpectedTargets(t *testing.T) {
	d, r := testDeps()
	m := buildTrayMenu(d)

	m.Items[0].OnClick() // ブラウザで開く
	m.Items[1].OnClick() // 設定画面(QR)
	m.Items[2].OnClick() // 設定ファイルのフォルダ
	m.Items[3].OnClick() // ログフォルダ
	m.Items[4].OnClick() // DB のフォルダ

	if got := r.urls; len(got) != 2 || got[0] != d.AppURL || got[1] != d.SettingsURL {
		t.Errorf("開いた URL = %v", got)
	}
	if got := r.dirs; len(got) != 3 || got[0] != d.ConfigDir || got[1] != d.LogDir || got[2] != d.DBDir {
		t.Errorf("開いたフォルダ = %v", got)
	}
	if len(r.notified) != 0 {
		t.Errorf("成功時に通知が出ている: %v", r.notified)
	}
}

// TestBuildTrayMenu_FailuresAreNotified は「黙って何も起きない」を禁じる(指示書 §2.4-2)。
//
// ★★これが本サブで最も落ちやすい形である —— ブラウザやファイラは起動して待たないため、
// 失敗しても例外は出ず、利用者からは「選んでも何も起きない」に見える。
func TestBuildTrayMenu_FailuresAreNotified(t *testing.T) {
	d, r := testDeps()
	r.urlErr = errors.New("no browser")
	r.dirErr = errors.New("no such directory")
	m := buildTrayMenu(d)

	for i := 0; i < 5; i++ {
		m.Items[i].OnClick()
	}
	if len(r.notified) != 5 {
		t.Fatalf("通知された件数 = %d (%v), want 5", len(r.notified), r.notified)
	}
	for i, title := range r.notified {
		if title != labelsOf(m)[i] {
			t.Errorf("通知の表題 %q が項目名 %q と一致しない", title, labelsOf(m)[i])
		}
	}
}

// TestBuildTrayMenu_QuitAsksFirst は終了確認を挟むことを固定する(M34-overview §5.1.6-4)。
func TestBuildTrayMenu_QuitAsksFirst(t *testing.T) {
	d, r := testDeps()
	r.confirmAnswer = false
	items := buildTrayMenu(d).Items
	quitItem := items[len(items)-1]

	quitItem.OnClick()
	if r.confirms != 1 {
		t.Fatalf("確認ダイアログが出ていない (confirms=%d)", r.confirms)
	}
	if r.quits != 0 {
		t.Fatal("「いいえ」でも終了処理が走っている")
	}

	r.confirmAnswer = true
	quitItem.OnClick()
	if r.quits != 1 {
		t.Fatalf("「はい」で終了処理が走っていない (quits=%d)", r.quits)
	}
}

func labelsOf(m desktop.TrayMenu) []string {
	out := make([]string, 0, len(m.Items))
	for _, it := range m.Items {
		out = append(out, it.Label)
	}
	return out
}

// ---------------------------------------------------------------------------
// 常駐ループ(段 3)
// ---------------------------------------------------------------------------

type fakeServer struct {
	startErr   error
	started    chan struct{}
	startsOnce sync.Once
	stop       chan struct{}
	stopOnce   sync.Once
	mu         sync.Mutex
	shutdowns  int
}

func newFakeServer(startErr error) *fakeServer {
	return &fakeServer{startErr: startErr, started: make(chan struct{}), stop: make(chan struct{})}
}

func (f *fakeServer) Start(string) error {
	f.startsOnce.Do(func() { close(f.started) })
	if f.startErr != nil {
		return f.startErr
	}
	<-f.stop
	return http.ErrServerClosed
}

// waitStarted は「サーバが起きた」ところまで進めてから判定させる。
// ★これが無いと「まだ返っていない」の判定が、単に runResident が始まる前だっただけ
// という形で常に成立してしまう(検査が存在しないのと同じになる)。
func (f *fakeServer) waitStarted(t *testing.T) {
	t.Helper()
	select {
	case <-f.started:
	case <-time.After(2 * time.Second):
		t.Fatal("サーバが起動しない")
	}
}

func (f *fakeServer) Shutdown(context.Context) error {
	f.mu.Lock()
	f.shutdowns++
	f.mu.Unlock()
	f.stopOnce.Do(func() { close(f.stop) })
	return nil
}

func (f *fakeServer) shutdownCount() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.shutdowns
}

type fakeTray struct {
	runErr   error
	during   func(m desktop.TrayMenu)
	stopCh   chan struct{}
	stopOnce sync.Once
	stops    int
	mu       sync.Mutex
}

func newFakeTray(runErr error) *fakeTray {
	return &fakeTray{runErr: runErr, stopCh: make(chan struct{})}
}

func (t *fakeTray) Run(m desktop.TrayMenu) error {
	if t.during != nil {
		t.during(m)
	}
	if t.runErr != nil {
		return t.runErr
	}
	<-t.stopCh // 本物と同じく Stop までブロックする
	return nil
}

func (t *fakeTray) Stop() {
	t.mu.Lock()
	t.stops++
	t.mu.Unlock()
	t.stopOnce.Do(func() { close(t.stopCh) })
}

// TestRunResident_UnsupportedTrayKeepsServing は ErrUnsupported を致命扱いしないことを
// 固定する(SUPP-001 §5.2 の契約 / チェックリスト E-1)。
//
// ★★Linux の go test は「トレイが無い側」しか通らない。⇒ ここを固定しないと、
// 誰かが ErrUnsupported を fatal にしても Linux では誰も気づけない
// (アプリは Windows でだけ動き、開発機で起動しなくなる)。
func TestRunResident_UnsupportedTrayKeepsServing(t *testing.T) {
	srv := newFakeServer(nil)
	tray := newFakeTray(desktop.ErrUnsupported)

	errCh := make(chan error, 1)
	go func() {
		errCh <- runResident(srv, "127.0.0.1:0", "http://localhost:47318/", tray, func(string, error) {
			t.Error("トレイ非対応は失敗ではない。通知してはならない")
		}, func(quit func()) desktop.TrayMenu { return desktop.TrayMenu{} })
	}()

	// ★トレイが無い間もサーバは動き続ける。⇒ 止めるまで runResident は返らない。
	srv.waitStarted(t)
	select {
	case err := <-errCh:
		t.Fatalf("トレイ非対応で即座に返った(サーバを待っていない): %v", err)
	default:
	}

	if err := srv.Shutdown(context.Background()); err != nil {
		t.Fatal(err)
	}
	if err := <-errCh; err != nil {
		t.Fatalf("正常終了なのにエラーを返した: %v", err)
	}
}

// TestRunResident_QuitFromTrayStopsServer は「終了」から HTTP サーバの停止と
// アイコンの削除が走ることを固定する(指示書 §2.6-2)。
func TestRunResident_QuitFromTrayStopsServer(t *testing.T) {
	srv := newFakeServer(nil)
	tray := newFakeTray(nil)

	tray.during = func(m desktop.TrayMenu) {
		// トレイの「終了」を押した状況を作る。
		m.Items[len(m.Items)-1].OnClick()
	}

	d, r := testDeps()
	r.confirmAnswer = true
	err := runResident(srv, "127.0.0.1:0", "http://localhost:47318/", tray, func(string, error) {
		t.Error("正常な終了で通知が出ている")
	}, func(quit func()) desktop.TrayMenu {
		d.Quit = quit
		return buildTrayMenu(d)
	})
	if err != nil {
		t.Fatalf("runResident: %v", err)
	}
	if srv.shutdownCount() != 1 {
		t.Errorf("HTTP サーバの停止回数 = %d, want 1", srv.shutdownCount())
	}
	if tray.stops == 0 {
		t.Error("アイコンの削除(StopTray)が呼ばれていない")
	}
}

// TestRunResident_QuitIsCalledWhenTheLoopEndsOnItsOwn は、メッセージループが
// StopTray 以外の理由で終わった場合でもサーバが止まることを固定する
// (レビュー指摘 中-7)。
//
// ★★RunTray は WM_QUIT で nil を返す。WM_QUIT は StopTray の PostMessage 以外からも
// 来る(Windows のログオフ・シャットダウン、任意の PostQuitMessage)。
// ⇒ その場合 quit が 1 度も走らないと srv.Shutdown が呼ばれず、runResident は
// <-done で永久にブロックする(窓もアイコンも無い状態でプロセスが残る)。
// ★このテストは、塞ぐ前は 30 秒でタイムアウトする形で落ちる。
func TestRunResident_QuitIsCalledWhenTheLoopEndsOnItsOwn(t *testing.T) {
	srv := newFakeServer(nil)
	// ★quit を呼ばずに nil を返す = 外から WM_QUIT が来た状況。
	tray := &fakeTray{stopCh: make(chan struct{})}
	tray.during = func(desktop.TrayMenu) { tray.runErr = nil }

	done := make(chan error, 1)
	go func() {
		done <- runResident(srv, "127.0.0.1:0", "http://localhost:47318/", tray,
			func(string, error) { t.Error("正常な終了で通知が出ている") },
			func(quit func()) desktop.TrayMenu { return desktop.TrayMenu{} })
	}()
	// ★Run を返させる(StopTray 経由ではない終了)。
	tray.stopOnce.Do(func() { close(tray.stopCh) })

	select {
	case err := <-done:
		if err != nil {
			t.Fatalf("runResident: %v", err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("runResident が返らない(quit が走らず srv.Shutdown が呼ばれていない)")
	}
	if srv.shutdownCount() != 1 {
		t.Errorf("HTTP サーバの停止回数 = %d, want 1", srv.shutdownCount())
	}
}

// TestRunResident_ServerFailureStopsTrayAndPropagates はサーバが落ちたときに
// 黙って常駐し続けないことを固定する(指示書 §2.4-1)。
//
// ★★通知は runResident では出さない —— エラーは呼び出し元へ返り、main() の
// reportFatal が唯一の致命出口として MessageBox を出す(段 4)。⇒ 2 か所で出すと
// 同じ失敗が二重に見える。★ここで固定するのは「アイコンを畳んで、エラーを返すこと」である。
func TestRunResident_ServerFailureStopsTrayAndPropagates(t *testing.T) {
	boom := errors.New("listener died")
	srv := newFakeServer(boom)
	tray := newFakeTray(nil) // 本物と同じく Stop までブロックする

	err := runResident(srv, "127.0.0.1:0", "http://localhost:47318/", tray, func(title string, _ error) {
		t.Errorf("runResident が通知した(致命の出口は main の reportFatal 1 本): %s", title)
	}, func(quit func()) desktop.TrayMenu { return desktop.TrayMenu{} })

	if !errors.Is(err, boom) {
		t.Fatalf("runResident() = %v, want %v を含むエラー", err, boom)
	}
	tray.mu.Lock()
	defer tray.mu.Unlock()
	if tray.stops == 0 {
		t.Error("サーバが落ちたのにアイコンを畳んでいない(常駐したまま残る)")
	}
}

// TestRunResident_TrayFailureIsNotFatal はアイコンを出せなかった場合に、
// 通知しつつサーバは動き続けることを固定する。
func TestRunResident_TrayFailureIsNotFatal(t *testing.T) {
	srv := newFakeServer(nil)
	tray := newFakeTray(errors.New("Shell_NotifyIconW failed"))

	var mu sync.Mutex
	var titles []string
	errCh := make(chan error, 1)
	go func() {
		errCh <- runResident(srv, "127.0.0.1:0", "http://localhost:47318/", tray, func(title string, _ error) {
			mu.Lock()
			titles = append(titles, title)
			mu.Unlock()
		}, func(quit func()) desktop.TrayMenu { return desktop.TrayMenu{} })
	}()

	srv.waitStarted(t)
	select {
	case err := <-errCh:
		t.Fatalf("アイコンを出せないだけで終了した: %v", err)
	default:
	}
	if err := srv.Shutdown(context.Background()); err != nil {
		t.Fatal(err)
	}
	if err := <-errCh; err != nil {
		t.Fatalf("runResident: %v", err)
	}
	mu.Lock()
	defer mu.Unlock()
	if len(titles) != 1 || titles[0] != notifyTitleTrayFailed {
		t.Errorf("通知 = %v, want [%q]", titles, notifyTitleTrayFailed)
	}
}

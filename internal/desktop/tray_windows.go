//go:build windows

// Notification-area (system tray) residency for Windows, written directly
// against the Win32 API through syscall.NewLazyDLL (M34).
//
// Shape of a tray app in Win32: you need a window to receive the icon's
// callbacks, but you do not want a visible one — so a message-only window
// (HWND_MESSAGE) is created, the icon is registered against it with
// Shell_NotifyIconW, and a normal GetMessage/DispatchMessage loop runs on a
// locked OS thread. The right-click menu is a plain popup menu shown with
// TPM_RETURNCMD so the selection comes back inline instead of via WM_COMMAND.
package desktop

import (
	"errors"
	"fmt"
	"runtime"
	"sync"
	"syscall"
	"time"
	"unsafe"
)

var (
	procRegisterClassExW         = user32.NewProc("RegisterClassExW")
	procCreateWindowExW          = user32.NewProc("CreateWindowExW")
	procDefWindowProcW           = user32.NewProc("DefWindowProcW")
	procDestroyWindow            = user32.NewProc("DestroyWindow")
	procGetMessageW              = user32.NewProc("GetMessageW")
	procTranslateMessage         = user32.NewProc("TranslateMessage")
	procDispatchMessageW         = user32.NewProc("DispatchMessageW")
	procPostMessageW             = user32.NewProc("PostMessageW")
	procPostQuitMessage          = user32.NewProc("PostQuitMessage")
	procRegisterWindowMessageW   = user32.NewProc("RegisterWindowMessageW")
	procCreatePopupMenu          = user32.NewProc("CreatePopupMenu")
	procDestroyMenu              = user32.NewProc("DestroyMenu")
	procAppendMenuW              = user32.NewProc("AppendMenuW")
	procTrackPopupMenu           = user32.NewProc("TrackPopupMenu")
	procSetForegroundWindow      = user32.NewProc("SetForegroundWindow")
	procGetCursorPos             = user32.NewProc("GetCursorPos")
	procLoadIconW                = user32.NewProc("LoadIconW")
	procCreateIconFromResourceEx = user32.NewProc("CreateIconFromResourceEx")
	procDestroyIcon              = user32.NewProc("DestroyIcon")
	procGetSystemMetrics         = user32.NewProc("GetSystemMetrics")

	procShellNotifyIconW = shell32.NewProc("Shell_NotifyIconW")

	procGetModuleHandleW = kernel32.NewProc("GetModuleHandleW")
)

const (
	wmNull          = 0x0000
	wmDestroy       = 0x0002
	wmRButtonUp     = 0x0205
	wmLButtonDblClk = 0x0203
	wmApp           = 0x8000

	// Icon callbacks land on wmTrayCallback; StopTray posts wmTrayQuit.
	wmTrayCallback = wmApp + 1
	wmTrayQuit     = wmApp + 2

	nimAdd    = 0x0
	nimDelete = 0x2

	nifMessage = 0x01
	nifIcon    = 0x02
	nifTip     = 0x04

	mfString = 0x0000

	tpmRightButton = 0x0002
	tpmNoNotify    = 0x0080
	tpmReturnCmd   = 0x0100

	idiApplication = 32512

	// CreateIconFromResourceEx の引数(winuser.h)。
	iconFIcon    = 1          // fIcon = TRUE(カーソルではなくアイコンとして作る)
	iconVersion3 = 0x00030000 // dwVersion。.ico のリソースはバージョン 3 である
	smCXSmIcon   = 49
	smCYSmIcon   = 50

	// HWND_MESSAGE == (HWND)-3: a window that exists only to receive messages.
	hwndMessage = ^uintptr(2)
)

type wndClassExW struct {
	cbSize        uint32
	style         uint32
	lpfnWndProc   uintptr
	cbClsExtra    int32
	cbWndExtra    int32
	hInstance     syscall.Handle
	hIcon         syscall.Handle
	hCursor       syscall.Handle
	hbrBackground syscall.Handle
	lpszMenuName  *uint16
	lpszClassName *uint16
	hIconSm       syscall.Handle
}

type notifyIconDataW struct {
	cbSize           uint32
	hWnd             syscall.Handle
	uID              uint32
	uFlags           uint32
	uCallbackMessage uint32
	hIcon            syscall.Handle
	szTip            [128]uint16
	dwState          uint32
	dwStateMask      uint32
	szInfo           [256]uint16
	uVersion         uint32
	szInfoTitle      [64]uint16
	dwInfoFlags      uint32
	guidItem         [16]byte
	hBalloonIcon     syscall.Handle
}

type point struct{ x, y int32 }

type msgW struct {
	hwnd    syscall.Handle
	message uint32
	wParam  uintptr
	lParam  uintptr
	time    uint32
	pt      point
}

// tray holds the single live icon. One resident icon per process is all the
// app needs, so the state is package-level rather than threaded
// through the Win32 callback via SetWindowLongPtr.
var tray struct {
	mu      sync.Mutex
	hwnd    syscall.Handle
	hicon   syscall.Handle
	menu    TrayMenu
	stopped bool // StopTray called before the window existed
}

var (
	wndProcOnce sync.Once
	wndProcPtr  uintptr
	// TaskbarCreated is broadcast when Explorer restarts; the icon must be
	// re-added or it silently disappears for the rest of the session.
	taskbarCreatedMsg uint32
)

// RunTray shows the notification-area icon and pumps its message loop until
// StopTray is called (or the user picks an entry that stops the tool). It
// blocks, and must be called from the goroutine that owns the main thread.
func RunTray(m TrayMenu) error {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()

	tray.mu.Lock()
	if tray.stopped {
		tray.mu.Unlock()
		return nil // 起動より先に停止が要求されていた
	}
	tray.menu = m
	tray.mu.Unlock()

	hwnd, err := createMessageWindow()
	if err != nil {
		return err
	}
	hicon := loadTrayIcon()

	tray.mu.Lock()
	tray.hwnd, tray.hicon = hwnd, hicon
	stopped := tray.stopped
	tray.mu.Unlock()

	if err := addIcon(hwnd, hicon, m.Tooltip); err != nil {
		destroyTray()
		return err
	}
	if stopped { // RunTray とほぼ同時に StopTray が来た場合
		destroyTray()
		return nil
	}
	defer destroyTray()

	var msg msgW
	for {
		r, _, _ := procGetMessageW.Call(uintptr(unsafe.Pointer(&msg)), 0, 0, 0)
		if r == 0 { // WM_QUIT
			return nil
		}
		if int32(r) == -1 {
			return fmt.Errorf("メッセージループが異常終了しました")
		}
		procTranslateMessage.Call(uintptr(unsafe.Pointer(&msg)))
		procDispatchMessageW.Call(uintptr(unsafe.Pointer(&msg)))
	}
}

// StopTray tears the icon down and lets RunTray return. Safe to call from any
// goroutine, more than once, and before RunTray ever started.
func StopTray() {
	tray.mu.Lock()
	tray.stopped = true
	hwnd := tray.hwnd
	tray.mu.Unlock()
	if hwnd != 0 {
		procPostMessageW.Call(uintptr(hwnd), wmTrayQuit, 0, 0)
	}
}

func createMessageWindow() (syscall.Handle, error) {
	hinst, _, _ := procGetModuleHandleW.Call(0)
	className, err := syscall.UTF16PtrFromString("TacpendiumTrayWindow")
	if err != nil {
		return 0, err
	}
	wndProcOnce.Do(func() {
		wndProcPtr = syscall.NewCallback(wndProc)
		if n, _, _ := procRegisterWindowMessageW.Call(uintptr(unsafe.Pointer(mustUTF16("TaskbarCreated")))); n != 0 {
			taskbarCreatedMsg = uint32(n)
		}
	})
	wc := wndClassExW{
		cbSize:        uint32(unsafe.Sizeof(wndClassExW{})),
		lpfnWndProc:   wndProcPtr,
		hInstance:     syscall.Handle(hinst),
		lpszClassName: className,
	}
	// クラス名は同一プロセス内で使い回される。二度目の登録失敗は無視してよい
	// (ERROR_CLASS_ALREADY_EXISTS)。
	procRegisterClassExW.Call(uintptr(unsafe.Pointer(&wc)))

	hwnd, _, callErr := procCreateWindowExW.Call(
		0,
		uintptr(unsafe.Pointer(className)),
		uintptr(unsafe.Pointer(mustUTF16("tacpendium"))),
		0, 0, 0, 0, 0,
		hwndMessage, 0, hinst, 0,
	)
	if hwnd == 0 {
		return 0, fmt.Errorf("常駐用ウィンドウを作成できません: %w", callErr)
	}
	return syscall.Handle(hwnd), nil
}

// loadTrayIcon turns the embedded .ico into an HICON. On any failure it falls
// back to the generic application icon: a missing icon means the user cannot
// see that the tool is running, which is the whole feature.
func loadTrayIcon() syscall.Handle {
	if img, err := iconImage(iconICO); err == nil {
		cx, _, _ := procGetSystemMetrics.Call(smCXSmIcon)
		cy, _, _ := procGetSystemMetrics.Call(smCYSmIcon)
		h, _, _ := procCreateIconFromResourceEx.Call(
			uintptr(unsafe.Pointer(&img[0])), uintptr(len(img)),
			iconFIcon,
			iconVersion3,
			cx, cy, 0,
		)
		if h != 0 {
			return syscall.Handle(h)
		}
	}
	h, _, _ := procLoadIconW.Call(0, idiApplication)
	return syscall.Handle(h)
}

func newNotifyData(hwnd, hicon syscall.Handle, tooltip string) notifyIconDataW {
	nid := notifyIconDataW{
		cbSize:           uint32(unsafe.Sizeof(notifyIconDataW{})),
		hWnd:             hwnd,
		uID:              1,
		uFlags:           nifMessage | nifIcon | nifTip,
		uCallbackMessage: wmTrayCallback,
		hIcon:            hicon,
	}
	copyUTF16(nid.szTip[:], tooltip)
	return nid
}

// addIcon registers the icon, retrying briefly: Shell_NotifyIcon can fail while
// Explorer is still coming up (login / restart).
func addIcon(hwnd, hicon syscall.Handle, tooltip string) error {
	nid := newNotifyData(hwnd, hicon, tooltip)
	for attempt := 0; attempt < 3; attempt++ {
		if r, _, _ := procShellNotifyIconW.Call(nimAdd, uintptr(unsafe.Pointer(&nid))); r != 0 {
			return nil
		}
		time.Sleep(500 * time.Millisecond)
	}
	return errors.New("通知領域にアイコンを登録できません")
}

func destroyTray() {
	tray.mu.Lock()
	hwnd, hicon := tray.hwnd, tray.hicon
	tray.hwnd, tray.hicon = 0, 0
	tray.mu.Unlock()
	if hwnd == 0 {
		return
	}
	nid := newNotifyData(hwnd, hicon, "")
	procShellNotifyIconW.Call(nimDelete, uintptr(unsafe.Pointer(&nid)))
	if hicon != 0 {
		procDestroyIcon.Call(uintptr(hicon))
	}
	procDestroyWindow.Call(uintptr(hwnd))
}

func wndProc(hwnd syscall.Handle, message uint32, wParam, lParam uintptr) uintptr {
	switch {
	case message == wmTrayQuit:
		procPostQuitMessage.Call(0)
		return 0
	case message == wmDestroy:
		procPostQuitMessage.Call(0)
		return 0
	case taskbarCreatedMsg != 0 && message == taskbarCreatedMsg:
		// Explorer が再起動した。アイコンを貼り直さないと以後見えなくなる。
		tray.mu.Lock()
		h, icon, tip := tray.hwnd, tray.hicon, tray.menu.Tooltip
		tray.mu.Unlock()
		if h != 0 {
			nid := newNotifyData(h, icon, tip)
			procShellNotifyIconW.Call(nimAdd, uintptr(unsafe.Pointer(&nid)))
		}
		return 0
	case message == wmTrayCallback:
		// 既定バージョンの通知では lParam の LOWORD がマウスメッセージ。
		switch uint32(lParam) & 0xffff {
		case wmRButtonUp:
			showMenu(hwnd)
		case wmLButtonDblClk:
			invokeDefaultItem()
		}
		return 0
	}
	r, _, _ := procDefWindowProcW.Call(uintptr(hwnd), uintptr(message), wParam, lParam)
	return r
}

// showMenu pops the right-click menu at the cursor. The SetForegroundWindow
// call before and the WM_NULL post after are the documented workaround for the
// menu refusing to dismiss when the owner has no visible window.
func showMenu(hwnd syscall.Handle) {
	tray.mu.Lock()
	items := tray.menu.Items
	tray.mu.Unlock()
	if len(items) == 0 {
		return
	}

	hmenu, _, _ := procCreatePopupMenu.Call()
	if hmenu == 0 {
		return
	}
	defer procDestroyMenu.Call(hmenu)
	for i, it := range items {
		procAppendMenuW.Call(hmenu, mfString, uintptr(i+1),
			uintptr(unsafe.Pointer(mustUTF16(it.Label))))
	}

	var pt point
	procGetCursorPos.Call(uintptr(unsafe.Pointer(&pt)))
	procSetForegroundWindow.Call(uintptr(hwnd))
	cmd, _, _ := procTrackPopupMenu.Call(hmenu,
		tpmRightButton|tpmReturnCmd|tpmNoNotify,
		uintptr(pt.x), uintptr(pt.y), 0, uintptr(hwnd), 0)
	procPostMessageW.Call(uintptr(hwnd), wmNull, 0, 0)

	if cmd >= 1 && int(cmd) <= len(items) {
		invoke(items[cmd-1])
	}
}

func invokeDefaultItem() {
	tray.mu.Lock()
	items := tray.menu.Items
	tray.mu.Unlock()
	for _, it := range items {
		if it.Default {
			invoke(it)
			return
		}
	}
}

// invoke runs a menu action off the message-loop thread so a confirmation
// dialog (or a graceful HTTP shutdown) never freezes the icon.
func invoke(it TrayItem) {
	if it.OnClick == nil {
		return
	}
	go it.OnClick()
}

func mustUTF16(s string) *uint16 {
	p, err := syscall.UTF16PtrFromString(s)
	if err != nil {
		// NUL を含む文字列だけが失敗する。ここに来る値は全てリテラル/自前生成。
		p, _ = syscall.UTF16PtrFromString("")
	}
	return p
}

// copyUTF16 writes s into a fixed-size UTF-16 field, always NUL-terminated.
//
// ★deprecated な syscall.StringToUTF16 は使わない: 同関数は NUL を含む文字列で
// panic する(CLAUDE.md §4「パニックは原則使わない」)。現在の呼び出し元は
// リテラル由来の Tooltip だけだが、M34-02 でツールチップを設定値から組み立てると
// panic 経路になる。UTF16FromString はエラーを返すので、その場合は空文字を書く。
func copyUTF16(dst []uint16, s string) {
	src, err := syscall.UTF16FromString(s)
	if err != nil {
		// NUL を含むなど変換できない文字列。空文字(NUL 終端のみ)を書いて続行する。
		src = []uint16{0}
	}
	if len(src) > len(dst) {
		src = src[:len(dst)]
		src[len(src)-1] = 0
	}
	copy(dst, src)
}

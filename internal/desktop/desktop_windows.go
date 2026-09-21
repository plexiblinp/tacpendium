//go:build windows

// Win32 primitives shared by the dialogs and the tray. Everything goes through
// syscall.NewLazyDLL so the tool keeps its "standard library only" dependency
// footprint (CLAUDE.md ★ ライセンス規約: 標準ライブラリのみが最も安全).
package desktop

import (
	"os/exec"
	"syscall"
	"unsafe"
)

var (
	user32   = syscall.NewLazyDLL("user32.dll")
	shell32  = syscall.NewLazyDLL("shell32.dll")
	kernel32 = syscall.NewLazyDLL("kernel32.dll")

	procMessageBoxW = user32.NewProc("MessageBoxW")
)

// MessageBoxW uType flags (winuser.h).
const (
	mbOK            = 0x00000000
	mbYesNo         = 0x00000004
	mbIconError     = 0x00000010
	mbIconQuestion  = 0x00000020
	mbSystemModal   = 0x00001000
	mbSetForeground = 0x00010000

	idYes = 6
)

// messageBox shows a modal native dialog and returns the ID of the button the
// user pressed. mbSetForeground|mbSystemModal matter here: the tool has no
// window of its own, so without them the box can open behind everything and
// look like a hang.
func messageBox(title, text string, flags uintptr) uintptr {
	t, err := syscall.UTF16PtrFromString(title)
	if err != nil {
		return 0
	}
	b, err := syscall.UTF16PtrFromString(text)
	if err != nil {
		return 0
	}
	// LazyProc.Call is //go:uintptrescapes, so the UTF-16 buffers stay alive
	// for the duration of the call.
	r, _, _ := procMessageBoxW.Call(0,
		uintptr(unsafe.Pointer(b)), uintptr(unsafe.Pointer(t)),
		flags|mbSetForeground|mbSystemModal)
	return r
}

// Alert reports a problem the user must see. With no console left, this is the
// only channel for a fatal startup error (port in use, unwritable data dir).
func Alert(title, text string) {
	messageBox(title, text, mbOK|mbIconError)
}

// Confirm asks a yes/no question and reports whether the user chose yes.
// Used by the tray's 終了 entry so that stopping the tool always takes a
// deliberate second action, exactly like the button in the browser UI.
func Confirm(title, text string) bool {
	return messageBox(title, text, mbYesNo|mbIconQuestion) == idYes
}

// spawn starts a helper process.
//
// HideWindow (STARTF_USESHOWWINDOW + SW_HIDE) is applied only when the helper
// has no UI of its own — it stops a window from flashing, which is the whole
// point of M34. It must NOT be applied to explorer: SW_HIDE is inherited by
// the window we are trying to show, so the folder never appears while Start()
// still reports success (実機検証 2026-08-04 で判明)。
func spawn(c launchCmd) error {
	cmd := exec.Command(c.Name, c.Args...)
	if c.HideWindow {
		cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	}
	return cmd.Start()
}

//go:build !windows

// Non-Windows stubs. 通知領域への常駐は Windows だけの機能だが、本体は
// Windows / macOS / Linux の 3 OS へ配布する(DES-001)。これらのスタブは
// `go run ./cmd/tacpendium` を開発機(Linux/macOS)で使えるようにし、
// `go build`/`go vet` をどの GOOS でも通す。
package desktop

import (
	"fmt"
	"os"
	"os/exec"
)

// Alert prints to stderr — a developer machine has a console, so there is no
// need for a dialog.
func Alert(title, text string) {
	fmt.Fprintf(os.Stderr, "[%s] %s\n", title, text)
}

// Confirm cannot prompt without a GUI toolkit, so it answers "no" and says why.
// The only caller is the tray, which does not exist here.
func Confirm(title, text string) bool {
	fmt.Fprintf(os.Stderr, "[%s] %s -> 確認ダイアログ非対応のため中止\n", title, text)
	return false
}

// RunTray reports that there is no tray on this platform. Callers keep running.
func RunTray(TrayMenu) error { return ErrUnsupported }

// StopTray is a no-op: nothing was ever shown.
func StopTray() {}

// spawn ignores HideWindow: that flag only exists on Windows.
func spawn(c launchCmd) error {
	return exec.Command(c.Name, c.Args...).Start()
}

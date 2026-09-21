package desktop

import "unsafe"

// Compile-time layout guards for the structs handed to Win32 (x64 sizes from
// shellapi.h / winuser.h). Go lays these out identically as long as nobody
// reorders or retypes a field — and a wrong size does not fail loudly at
// runtime, it silently corrupts the call. The Windows behaviour cannot be
// exercised from the Linux dev environment, so this is the one check that can
// run there: `GOOS=windows GOARCH=amd64 go build ./...` fails on a mismatch.
//
// 限界: 検出できるのは「合計サイズが変わる」誤りだけ。サイズが変わらない
// フィールドの入れ替え・型変更は通ってしまう(実機確認が必要)。
//
// (arch 依存のため amd64 限定。386/arm64 は本体の配布対象外。)
const (
	_ = uint(unsafe.Sizeof(notifyIconDataW{}) - 976) // 小さすぎると const overflow
	_ = uint(976 - unsafe.Sizeof(notifyIconDataW{})) // 大きすぎると const overflow

	_ = uint(unsafe.Sizeof(wndClassExW{}) - 80)
	_ = uint(80 - unsafe.Sizeof(wndClassExW{}))

	_ = uint(unsafe.Sizeof(msgW{}) - 48)
	_ = uint(48 - unsafe.Sizeof(msgW{}))
)

package desktop

import (
	"encoding/binary"
	"os"
	"reflect"
	"strings"
	"testing"
)

func TestValidateURLRejectsNonHTTP(t *testing.T) {
	// 設定(ホスト・ポート)から組み立てた文字列がそのまま渡るため、
	// シェル/プロトコル悪用の芽を潰す。
	bad := []string{
		"", "file:///C:/Windows/System32", "javascript:alert(1)",
		"http://", "ftp://example.com", "not a url", "://x",
	}
	for _, s := range bad {
		if err := ValidateURL(s); err == nil {
			t.Errorf("ValidateURL(%q) = nil, want error", s)
		}
	}
	good := []string{"http://127.0.0.1:8765", "http://localhost:8765/", "https://example.com/x?y=1"}
	for _, s := range good {
		if err := ValidateURL(s); err != nil {
			t.Errorf("ValidateURL(%q) = %v, want nil", s, err)
		}
	}
}

// TestOpenURLKeepsTheValidateURLGate は「委譲しても関門が残っている」ことを固定する
// (M34-02 段 6 / チェックリスト E-3)。
//
// ★★経路は 1 本になった —— 実際の起動は github.com/pkg/browser(Windows は
// ShellExecute)へ委譲する。それまでの自前の rundll32 実装と、OS ごとの
// コマンド組み立て(browserCommand)は撤去した。
//
// ★★ValidateURL は捨てない。⇒ 設定由来の文字列が任意のプロトコル起動に化けるのを
// 防ぐ唯一の関門であり、委譲のときに外すと関門ごと消える。★ここが赤くなる形は
// 「OpenURL が pkg/browser へ直結された」であり、それは動作としては正しく見える。
func TestOpenURLKeepsTheValidateURLGate(t *testing.T) {
	// ★正常系は書かない —— 通してしまうと実際にブラウザ(xdg-open)を起動しようとする。
	//   関門の有無は拒否側で測りきれる。
	bad := []string{
		"", "file:///C:/Windows/System32", "javascript:alert(1)",
		"ftp://example.com", "http://", "not a url",
	}
	for _, s := range bad {
		if err := OpenURL(s); err == nil {
			t.Errorf("OpenURL(%q) = nil, want error", s)
		}
	}
}

func TestFolderCommandPerOS(t *testing.T) {
	const dir = `C:\Users\tester\AppData\Roaming\tacpendium`
	cases := map[string]string{"windows": "explorer.exe", "darwin": "open", "linux": "xdg-open"}
	for goos, want := range cases {
		got, err := folderCommand(goos, dir)
		if err != nil {
			t.Fatalf("%s: %v", goos, err)
		}
		if got.Name != want || !reflect.DeepEqual(got.Args, []string{dir}) {
			t.Errorf("%s: got %+v", goos, got)
		}
	}
	if _, err := folderCommand("windows", ""); err == nil {
		t.Fatal("folderCommand accepted an empty path")
	}
}

func TestErrUnsupportedMessageIsJapanese(t *testing.T) {
	// 利用者に出る可能性のある文言。英語の生エラーが混ざらないことを固定する。
	if !strings.Contains(ErrUnsupported.Error(), "常駐アイコン") {
		t.Fatalf("unexpected message: %v", ErrUnsupported)
	}
}

func TestEmbeddedIconIsUsable(t *testing.T) {
	// 常駐アイコンが出ない = 稼働状況が見えない、なので埋め込み .ico が
	// CreateIconFromResourceEx に渡せる形であることを Linux 側で固定しておく。
	img, err := iconImage(iconICO)
	if err != nil {
		t.Fatalf("埋め込み icon.ico を解釈できない: %v", err)
	}
	// BITMAPINFOHEADER(40) + 32x32 BGRA + 1bpp AND マスク(32行 x 4byte)
	const want = 40 + 32*32*4 + 32*4
	if len(img) != want {
		t.Fatalf("画像データ長 %d, want %d", len(img), want)
	}
	if got := binary.LittleEndian.Uint32(img[0:4]); got != 40 {
		t.Errorf("BITMAPINFOHEADER の size = %d, want 40", got)
	}
	if got := binary.LittleEndian.Uint16(img[14:16]); got != 32 {
		t.Errorf("bit count = %d, want 32", got)
	}
}

func TestIconImageRejectsBrokenFiles(t *testing.T) {
	bad := [][]byte{
		nil,
		make([]byte, 10), // 短すぎる
		{0, 0, 2, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0},             // type=2(カーソル)
		{0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0},             // count=0
		{0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0xff, 0xff, 0, 0, 0xff, 0xff, 0, 0, 0, 0}, // 範囲外
	}
	for i, b := range bad {
		if _, err := iconImage(b); err == nil {
			t.Errorf("case %d: 壊れた ico を受理した", i)
		}
	}
}

// TestFolderCommandNeverHidesWindow は 2026-08-04 の実機検証で出た不具合の回帰テスト。
//
// 症状: 常駐アイコン右クリック →「ログフォルダを開く」を選んでも何も起きない。
// (移植元の名称は「データフォルダを開く」。D-792 が本体の名称を確定させた)
// 原因: explorer.exe を SW_HIDE(HideWindow)付きで起動していた。開きたいウィンドウ
//
//	そのものが隠されるうえ、Start() は成功するのでエラーにもログにも残らなかった。
//
// 教訓: 「ヘルパを隠す」判断は、そのプロセスのウィンドウが目的かどうかで決まる。
func TestFolderCommandNeverHidesWindow(t *testing.T) {
	for _, goos := range []string{"windows", "darwin", "linux"} {
		got, err := folderCommand(goos, "/tmp")
		if err != nil {
			t.Fatalf("%s: %v", goos, err)
		}
		if got.HideWindow {
			t.Errorf("%s: ファイラのウィンドウを隠している(=何も起きないように見える)", goos)
		}
	}
}

func TestOpenFolderRejectsBadPaths(t *testing.T) {
	// ファイラは起動しっぱなしで待たないため、パス不正は事前に弾かないと
	// 「何も起きない」が再発する(ログにも残らない)。
	if err := OpenFolder(t.TempDir() + "/does-not-exist"); err == nil {
		t.Error("存在しないフォルダを受理した")
	}
	f := t.TempDir() + "/file.txt"
	if err := os.WriteFile(f, []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := OpenFolder(f); err == nil {
		t.Error("ファイル(非フォルダ)を受理した")
	}
	if err := OpenFolder(""); err == nil {
		t.Error("空パスを受理した")
	}
}

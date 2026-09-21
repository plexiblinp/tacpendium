package main

import (
	"debug/pe"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

// PE のサブシステム値(winnt.h)。
const (
	subsystemGUI = 2 // IMAGE_SUBSYSTEM_WINDOWS_GUI  = コンソール窓が出ない
	subsystemCUI = 3 // IMAGE_SUBSYSTEM_WINDOWS_CUI  = コンソール窓が出る
)

// ★空白は [ \t] で書く。\s は改行も食うため、値が空の行で次の行を拾ってしまう
// (実測: `WINDOWS_GUI_LDFLAGS :=` だけの行で "build-windows: ensure-web-deps" を掴んだ)。
var ldflagsLine = regexp.MustCompile(`(?m)^WINDOWS_GUI_LDFLAGS[ \t]*:?=[ \t]*(.*)$`)

// buildWindowsRecipe は `build-windows:` ターゲットのレシピ行(タブ始まり)を拾う。
// ★ターゲット行の次から、タブで始まらない行に当たるまでがレシピである。
var buildWindowsRecipe = regexp.MustCompile(`(?m)^build-windows:[^\n]*\n((?:\t[^\n]*\n)+)`)

// TestWindowsBuildIsGUISubsystem は「配布する exe が GUI サブシステムであること」を
// 機械で確かめる(M34-02 段 5-2 / チェックリスト D-1)。
//
// ★★「窓が出なかった」は完了条件にならない —— たまたま出なかっただけかもしれない
// (指示書 §6-2)。⇒ PE ヘッダのサブシステム値で判定する。
//
// ★★リンク指定の正本は Makefile である。本テストはそこから読む。⇒ 誰かが
// -H=windowsgui を消したら、この 1 本が赤で知らせる。
// ★Linux の PR CI でも走る(go test ./... はクロスコンパイルできる)。
//
// ★★陽性対照を同じテストの中に持たせてある —— フラグ無しでリンクすると CUI(3)に
// なることまで測る。⇒ 「判定が常に緑を返すだけの検査」ではないことを、この 1 本で示す
// (教訓 E-84。M34-01 は構造体サイズガードをわざと崩して同じ形を実演した)。
func TestWindowsBuildIsGUISubsystem(t *testing.T) {
	if _, err := exec.LookPath("go"); err != nil {
		t.Skip("go コマンドが無い環境ではリンクできない")
	}
	repoRoot := repoRootDir(t)
	flags := windowsGUILdflags(t, repoRoot)

	if !strings.Contains(flags, "-H=windowsgui") {
		t.Fatalf("Makefile の WINDOWS_GUI_LDFLAGS に -H=windowsgui が無い: %q", flags)
	}

	// (1) 本番の指定でリンクしたものは GUI である。
	if got := buildWindowsExe(t, repoRoot, flags); got != subsystemGUI {
		t.Errorf("Subsystem = %d, want %d (GUI)。⇒ 配布 exe で黒窓が出る", got, subsystemGUI)
	}

	// (2) ★配布物のレシピが、その指定を実際に渡していること(レビュー指摘 高-4)。
	// ★★これが無いと門が成果物から 1 段離れる —— 変数の定義は残したまま
	// `build-windows` の `-ldflags=` だけを落とすと、配布 exe は CUI に戻って黒窓が
	// 復活するのに、本テストは緑のままになる。
	assertRecipePassesLdflags(t, repoRoot)

	// (3) 陽性対照。指定を外すと CUI になる。
	// ★パッケージのコンパイル結果はキャッシュされるため、ここはリンクのみで済む。
	if got := buildWindowsExe(t, repoRoot, ""); got != subsystemCUI {
		t.Errorf("フラグ無しの Subsystem = %d, want %d (CUI)。"+
			"⇒ 判定がフラグを見ていない可能性がある", got, subsystemCUI)
	}
}

// assertRecipePassesLdflags は `build-windows` レシピが $(WINDOWS_GUI_LDFLAGS) を
// go build へ渡していることを確かめる。
func assertRecipePassesLdflags(t *testing.T, repoRoot string) {
	t.Helper()
	body, err := os.ReadFile(filepath.Join(repoRoot, "Makefile"))
	if err != nil {
		t.Fatalf("Makefile を読めない: %v", err)
	}
	m := buildWindowsRecipe.FindSubmatch(body)
	if m == nil {
		t.Fatal("Makefile に build-windows のレシピが無い")
	}
	recipe := string(m[1])
	if !strings.Contains(recipe, "$(WINDOWS_GUI_LDFLAGS)") {
		t.Errorf("build-windows が $(WINDOWS_GUI_LDFLAGS) を渡していない。"+
			"⇒ 配布 exe で黒窓が復活する。レシピ:\n%s", recipe)
	}
	if !strings.Contains(recipe, "-ldflags=") {
		t.Errorf("build-windows に -ldflags= が無い。レシピ:\n%s", recipe)
	}
}

// buildWindowsExe は GOOS=windows で ./cmd/tacpendium をリンクし、
// 成果物の PE サブシステム値を返す。
func buildWindowsExe(t *testing.T, repoRoot, ldflags string) uint16 {
	t.Helper()

	out := filepath.Join(t.TempDir(), "tacpendium.exe")
	args := []string{"build"}
	if ldflags != "" {
		args = append(args, "-ldflags="+ldflags)
	}
	// ★embed_web タグは付けない —— 付けると //go:embed all:web/dist が web/dist を
	// 要求する(Makefile の check-windows と同じ理由)。サブシステムはタグに依らない。
	args = append(args, "-o", out, "./cmd/tacpendium")

	cmd := exec.Command("go", args...)
	cmd.Dir = repoRoot
	cmd.Env = append(os.Environ(), "GOOS=windows", "GOARCH=amd64", "CGO_ENABLED=0")
	if combined, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("go %s: %v\n%s", strings.Join(args, " "), err, combined)
	}

	f, err := pe.Open(out)
	if err != nil {
		t.Fatalf("PE を読めない(%s): %v", out, err)
	}
	defer f.Close()

	oh, ok := f.OptionalHeader.(*pe.OptionalHeader64)
	if !ok {
		t.Fatalf("PE32+ ではない(GOARCH=amd64 のはず): %T", f.OptionalHeader)
	}
	return oh.Subsystem
}

// windowsGUILdflags は Makefile から WINDOWS_GUI_LDFLAGS の値を読む。
func windowsGUILdflags(t *testing.T, repoRoot string) string {
	t.Helper()
	body, err := os.ReadFile(filepath.Join(repoRoot, "Makefile"))
	if err != nil {
		t.Fatalf("Makefile を読めない: %v", err)
	}
	m := ldflagsLine.FindSubmatch(body)
	if m == nil {
		t.Fatal("Makefile に WINDOWS_GUI_LDFLAGS の行が無い。⇒ 黒窓が復活する変更である")
	}
	return strings.TrimSpace(string(m[1]))
}

// repoRootDir は Makefile の在るディレクトリ(= リポジトリルート)を返す。
func repoRootDir(t *testing.T) string {
	t.Helper()
	dir, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	for {
		if _, statErr := os.Stat(filepath.Join(dir, "Makefile")); statErr == nil {
			return dir
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			t.Fatal("Makefile が見つからない")
		}
		dir = parent
	}
}

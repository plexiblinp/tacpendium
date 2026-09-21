package config

import (
	"os"
	"path/filepath"
	"testing"
)

// TestIsGoBuildTempDir は「開発時だけカレントディレクトリへ倒す」判定を固定する。
//
// ★この判定が壊れる方向は 2 つあり、どちらも静かに効く。
//   - 開発時を拾えなくなる: go run がリポジトリ直下の config.toml を読まなくなり、
//     worktree のポート分離と E2E スタックが黙って別の設定で走る。
//   - 配布 exe を誤って拾う: 基準がまたカレントディレクトリへ戻り、本サブの成果が消える。
func TestIsGoBuildTempDir(t *testing.T) {
	temp := []string{
		// 実測値(Linux・go run)
		filepath.Join(string(filepath.Separator), "tmp", "go-build30358198", "b001", "exe"),
		// go test のテストバイナリは exe/ を挟まない
		filepath.Join(string(filepath.Separator), "tmp", "go-build123", "b001"),
		filepath.Join(string(filepath.Separator), "var", "folders", "xy", "go-build999", "b001", "exe"),
	}
	for _, dir := range temp {
		if !isGoBuildTempDir(dir) {
			t.Errorf("isGoBuildTempDir(%q) = false, want true", dir)
		}
	}

	real := []string{
		filepath.Join(string(filepath.Separator), "home", "user", "tacpendium"),
		filepath.Join(string(filepath.Separator), "opt", "tacpendium", "bin"),
		// 名前が似ているだけのディレクトリは拾わない。
		filepath.Join(string(filepath.Separator), "home", "user", "mygo-buildings"),
		string(filepath.Separator),
	}
	for _, dir := range real {
		if isGoBuildTempDir(dir) {
			t.Errorf("isGoBuildTempDir(%q) = true, want false", dir)
		}
	}
}

// TestAppBaseDirUnderGoTest は「テスト中は従来どおりカレントディレクトリ基準である」ことを
// 固定する。★テストバイナリも go-build 配下に置かれるため、本テスト自身が判定の実測になる。
func TestAppBaseDirUnderGoTest(t *testing.T) {
	wd, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	if got := AppBaseDir(); got != wd {
		t.Fatalf("AppBaseDir() = %q, want %q (テストバイナリは go-build 配下にある)", got, wd)
	}
}

func TestResolveAppPath(t *testing.T) {
	base := AppBaseDir()
	abs := filepath.Join(string(filepath.Separator), "var", "log", "tacpendium.log")

	cases := map[string]string{
		// 相対は基準ディレクトリへ寄せる(既定値がこれ)。
		filepath.Join("logs", "tacpendium.log"): filepath.Join(base, "logs", "tacpendium.log"),
		"config.toml":                           filepath.Join(base, "config.toml"),
		// 空と絶対は素通し。呼び手に判定を増やさせない。
		"":  "",
		abs: abs,
	}
	for in, want := range cases {
		if got := ResolveAppPath(in); got != want {
			t.Errorf("ResolveAppPath(%q) = %q, want %q", in, got, want)
		}
	}
}

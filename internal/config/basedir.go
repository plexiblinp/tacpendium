package config

import (
	"os"
	"path/filepath"
	"strings"
)

// goBuildDirPrefix は `go run` / `go test` が実行ファイルを置く一時ディレクトリの
// 名前の接頭辞。実測値は次の形である。
//
//	/tmp/go-build30358198/b001/exe/tacpendium   (go run・Linux)
//	%TEMP%\go-build123456\b001\exe\app.exe      (go run・Windows)
//	/tmp/go-build.../b001/config.test           (go test)
const goBuildDirPrefix = "go-build"

// AppBaseDir はアプリが「自分の置き場」として使う基準ディレクトリを返す(M34-02 段 1)。
//
// ★★何を解決するための関数か ————————————————————————————————————————————
// config.toml と logging.file の既定値はどちらも相対パスであり、M34-01 の実査までは
// プロセスのカレントディレクトリ基準で解決されていた(os.Executable() はリポジトリ全体で
// 0 件だった)。常駐化すると起動経路が増える(ダブルクリック / ショートカットの「作業
// フォルダ」/ 将来のスタートアップ登録)ため、カレントディレクトリ基準では起動のたびに
// 出先が動く。
//
// ★★壊れるのは「ログフォルダを開く」だけではない —— config.toml も見つからなくなり、
// Load はファイル不在をエラーにせず既定値で続行するので、利用者の設定(ポート / LAN 共有
// モード / パスワード)が黙って無視される。黒窓を消すと、それに気づく手掛かりも無くなる。
// ⇒ 基準を実行ファイルの位置へ一意化する(M34-01 完了報告 §4.4 の案 A)。
//
// ★★開発時だけカレントディレクトリへ倒す理由 ——————————————————————————————
// `go run ./cmd/tacpendium` と `go test` の実行ファイルは一時ビルドディレクトリに置かれる。
// そこを基準にすると、リポジトリ直下の config.toml が読まれなくなり、
// worktree ごとのポート分離(scripts/wt-new.sh)と E2E スタックが黙って壊れる。
// ⇒ 実行ファイルの祖先に go-build* が在るときだけ、従来どおりカレントディレクトリを返す。
// ★配布された exe がこの分岐へ入ることはない。
//
// os.Executable() が失敗する環境でもカレントディレクトリへ倒し、起動そのものは止めない。
func AppBaseDir() string {
	exe, err := os.Executable()
	if err != nil {
		return cwdOrDot()
	}
	// シンボリックリンク経由で起動された場合も実体の位置を基準にする。
	if resolved, resolveErr := filepath.EvalSymlinks(exe); resolveErr == nil {
		exe = resolved
	}
	dir := filepath.Dir(exe)
	if isGoBuildTempDir(dir) {
		return cwdOrDot()
	}
	return dir
}

// ResolveAppPath は相対パスを AppBaseDir() 基準の絶対パスへ解決する。
// 空文字と絶対パスはそのまま返す(呼び手の判定を増やさないため)。
//
// ★★結果を *Config へ書き戻さないこと —— PUT /api/config は実行時の Config を
// 再シリアライズして config.toml へ書き戻すため、解決済みの絶対パスを cfg へ入れると
// 利用者のファイルへ焼き付く(EnvLogLevel 等の env 上書きと同じ形)。
// ⇒ 使うその場で解決する。
func ResolveAppPath(path string) string {
	if strings.TrimSpace(path) == "" || filepath.IsAbs(path) {
		return path
	}
	return filepath.Join(AppBaseDir(), path)
}

// isGoBuildTempDir は dir の祖先に go-build* ディレクトリが在るかを返す。
func isGoBuildTempDir(dir string) bool {
	for {
		if strings.HasPrefix(filepath.Base(dir), goBuildDirPrefix) {
			return true
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return false
		}
		dir = parent
	}
}

func cwdOrDot() string {
	if wd, err := os.Getwd(); err == nil && wd != "" {
		return wd
	}
	return "."
}

package main

import (
	"errors"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"

	"github.com/plexiblinp/tacpendium/internal/desktop"
)

// 通知の表題。★MessageBox のキャプションにもログのメッセージにも使う。
const (
	notifyTitleStartupFailed = "Tacpendium を起動できませんでした"
	notifyTitleTrayFailed    = "Tacpendium: 通知領域にアイコンを表示できませんでした"
)

// desktopOpenURL は既定ブラウザを開く唯一の経路(M34-02 段 6 で 1 本に寄せた)。
// ★変数にしてあるのはテストのためである。実体は desktop.OpenURL であり、
// ValidateURL を通したうえで github.com/pkg/browser へ委譲する。
var desktopOpenURL = desktop.OpenURL

// desktopOpenFolder はファイラでフォルダを開く経路。★同じくテストのための変数である。
var desktopOpenFolder = desktop.OpenFolder

// configPathForReport は「いま読んでいる設定ファイル」の絶対パス。
//
// ★★致命エラーの本文へ載せるためだけに持っている(2026-09-12 開発者要求) ————————
// run() の先頭で 1 度だけ書き、以後は読むだけである。⇒ main() の reportFatal は
// run() の戻り値しか持たないため、ここを経由しないと「どの設定ファイルの話か」を
// 利用者へ出せない。
// ★引数エラー(parseArgs)は設定ファイルを読む前に落ちるので、空のままになる。
// ⇒ そのときは本文へ何も足さない。
var configPathForReport string

// configProblem は「設定ファイルを直せば直る失敗」の目印。
//
// ★★分類が要る理由 —— 黒窓が消えた後、利用者に見えるのは MessageBox だけである。
// 「どこを直せばよいか」が本文に無いと、起動しない箱を前に手が止まる。
// ⇒ 設定ファイル由来の失敗のときだけ、ダイアログを閉じた後にその置き場を開く。
// ★★DB の破損・ポートの枯渇・配布物の異常では開かない —— 直す先が違うためである。
//
// ★実測(2026-09-12・完了報告 §15)では run() が返しうる 15 種のうち 8 種が
// 設定ファイル由来であり、利用者が最も踏みやすいのもそこである。
type configProblem struct{ err error }

func (c configProblem) Error() string { return c.err.Error() }
func (c configProblem) Unwrap() error { return c.err }

// asConfigProblem は err へ「設定ファイル由来」の目印を付ける(nil はそのまま)。
func asConfigProblem(err error) error {
	if err == nil {
		return nil
	}
	return configProblem{err: err}
}

// isConfigProblem は err が設定ファイル由来かを返す。
func isConfigProblem(err error) bool {
	var c configProblem
	return errors.As(err, &c)
}

// alert は「利用者へ必ず見せる」経路。★テストのため差し替え可能にしてある。
//
// ★★-H=windowsgui では標準出力・標準エラーの接続先が無い(M34-overview §4.1)。
// ⇒ Windows では MessageBoxW、他 OS では stderr へ落ちる(internal/desktop の契約)。
// ★他 OS の挙動は従来と同じであり、これは Windows で「何も見えない」を防ぐためにある。
var alert = desktop.Alert

// reportFatal は致命エラーの唯一の出口である(M34-02 段 4)。
//
// ★★これが無いと「ダブルクリックしても何も起きない」になる ————————————————
// 黒窓を消すと、起動に失敗しても利用者には何も見えない。⇒ 起動失敗はここで必ず
// ダイアログにする。★引数エラー(段 2)も設定の読込失敗もポートの枯渇も、すべて
// run() のエラーとして本関数を通る。
//
// ★標準エラーへの 1 行は残す —— コンソールの在るビルド(開発 / Linux・macOS 配布)では
// そちらが従来どおりの手掛かりであり、消す理由が無い。
func reportFatal(err error) {
	fmt.Fprintf(os.Stderr, "fatal: %v\n", err)
	// ★ロガーは初期化前に落ちることもある。その場合でも slog の既定(stderr)へ出る。
	slog.Error(notifyTitleStartupFailed, slog.String("err", errText(err)))

	fromConfig := isConfigProblem(err)
	alert(notifyTitleStartupFailed, fatalMessage(err, configPathForReport, fromConfig))

	// ★設定ファイル由来のときだけ置き場を開く。⇒ ダイアログを閉じた直後に
	// 直す先が目の前に出る(2026-09-12 開発者要求)。
	if fromConfig && configPathForReport != "" {
		if openErr := desktopOpenFolder(filepath.Dir(configPathForReport)); openErr != nil {
			slog.Warn("could not open the config folder",
				slog.String("dir", filepath.Dir(configPathForReport)),
				slog.String("err", openErr.Error()))
		}
	}
}

// fatalMessage は致命エラーの本文を組み立てる。
//
// ★設定ファイルのパスは**由来にかかわらず**添える(在るときのみ)。⇒ 「どの設定で
// 起動しようとしたか」は、どの失敗でも切り分けの足がかりになるためである。
// ★ただし設定由来でないときは (参考) と断る —— 原因だと読ませないため。
func fatalMessage(err error, configPath string, fromConfig bool) string {
	text := err.Error()
	if configPath == "" {
		return text
	}
	if fromConfig {
		return text + "\n\n設定ファイル: " + configPath +
			"\n［OK］を押すと、このフォルダを開きます。"
	}
	return text + "\n\n(参考) 設定ファイル: " + configPath
}

// notifyProblem は「致命ではないが黙って済ませてはいけない失敗」を伝える。
//
// ★★メニュー項目の失敗がこれである(指示書 §2.4-2)。ブラウザもファイラも起動して
// 待たないため、失敗しても例外は出ず、利用者からは「選んでも何も起きない」に見える。
// ⇒ 黙って何も起きないのが最悪である。
//
// ★アイコンを出せなかった場合もここを通る(アプリはブラウザから使えるため致命にしない)。
func notifyProblem(title string, err error) {
	slog.Error(title, slog.String("err", errText(err)))
	alert(title, err.Error())
}

package main

import (
	"errors"
	"fmt"
	"path/filepath"
	"strings"
	"testing"
)

// swapAlert はテスト中だけ通知先を差し替える。
func swapAlert(t *testing.T) *[]string {
	t.Helper()
	var captured []string
	orig := alert
	alert = func(title, text string) { captured = append(captured, title+"|"+text) }
	t.Cleanup(func() { alert = orig })
	return &captured
}

// swapOpenFolder はテスト中だけフォルダを開く経路を差し替える。
func swapOpenFolder(t *testing.T) *[]string {
	t.Helper()
	var opened []string
	orig := desktopOpenFolder
	desktopOpenFolder = func(dir string) error { opened = append(opened, dir); return nil }
	t.Cleanup(func() { desktopOpenFolder = orig })
	return &opened
}

// setConfigPathForReport はテスト中だけ「読んでいる設定ファイル」を差し替える。
func setConfigPathForReport(t *testing.T, path string) {
	t.Helper()
	orig := configPathForReport
	configPathForReport = path
	t.Cleanup(func() { configPathForReport = orig })
}

// TestReportFatal_AlwaysReachesTheUser は「起動に失敗したら必ず見える」ことを固定する
// (M34-02 段 4 / チェックリスト C-1)。
//
// ★★これが無いと本サブは害になる —— 黒窓を消した後、起動失敗は
// 「ダブルクリックしても何も起きない」という最悪の形になる。
// ★Windows では MessageBoxW、他 OS では stderr(internal/desktop の契約)。
func TestReportFatal_AlwaysReachesTheUser(t *testing.T) {
	captured := swapAlert(t)
	opened := swapOpenFolder(t)
	setConfigPathForReport(t, "")

	reportFatal(errors.New("listen: 全ポートが使用中です"))

	if len(*captured) != 1 {
		t.Fatalf("通知が %d 件(1 件であるべき): %v", len(*captured), *captured)
	}
	got := (*captured)[0]
	if want := notifyTitleStartupFailed + "|listen: 全ポートが使用中です"; got != want {
		t.Errorf("通知 = %q, want %q", got, want)
	}
	if len(*opened) != 0 {
		t.Errorf("設定ファイルの置き場が判らないのにフォルダを開いた: %v", *opened)
	}
}

// TestReportFatal_ConfigProblemShowsThePathAndOpensIt は「設定ファイルを直せば直る
// 失敗」のときだけ、置き場を示して開くことを固定する(2026-09-12 開発者要求)。
//
// ★★実測で分かったこと —— run() が返しうる 15 種のうち 8 種が設定ファイル由来であり、
// 利用者が最も踏みやすいのもそこである。⇒ 本文にパスが無いと、起動しない箱を前に
// 手が止まる(黒窓が消えたので他に手掛かりが無い)。
func TestReportFatal_ConfigProblemShowsThePathAndOpensIt(t *testing.T) {
	captured := swapAlert(t)
	opened := swapOpenFolder(t)
	setConfigPathForReport(t, filepath.Join("/app", "config.toml"))

	reportFatal(asConfigProblem(fmt.Errorf("load config: %w",
		errors.New(`config: invalid server.mode "xxxx"`))))

	if len(*captured) != 1 {
		t.Fatalf("通知 = %v", *captured)
	}
	body := (*captured)[0]
	// ★原因・置き場・次の操作の 3 つが本文に揃っていること。
	for _, want := range []string{
		`config: invalid server.mode "xxxx"`,
		filepath.Join("/app", "config.toml"),
		"このフォルダを開きます",
	} {
		if !strings.Contains(body, want) {
			t.Errorf("本文に %q が無い:\n%s", want, body)
		}
	}
	if len(*opened) != 1 || (*opened)[0] != "/app" {
		t.Errorf("開いたフォルダ = %v, want [/app]", *opened)
	}
}

// TestReportFatal_NonConfigProblemDoesNotOpenTheFolder は、設定と無関係な失敗で
// 勝手にフォルダを開かないことを固定する。
//
// ★★開く先が違うものまで開くと、利用者は「設定ファイルが原因だ」と読む。
// ⇒ DB の破損・ポートの枯渇・配布物の異常はそこを直しても直らない。
func TestReportFatal_NonConfigProblemDoesNotOpenTheFolder(t *testing.T) {
	captured := swapAlert(t)
	opened := swapOpenFolder(t)
	setConfigPathForReport(t, filepath.Join("/app", "config.toml"))

	reportFatal(errors.New("migration: dirty database version 42"))

	if len(*opened) != 0 {
		t.Errorf("設定由来でないのにフォルダを開いた: %v", *opened)
	}
	body := (*captured)[0]
	if !strings.Contains(body, "(参考) 設定ファイル: ") {
		t.Errorf("参考としての設定ファイルのパスが本文に無い:\n%s", body)
	}
	if strings.Contains(body, "このフォルダを開きます") {
		t.Errorf("開かないのに「開きます」と書いている:\n%s", body)
	}
}

// TestIsConfigProblem は目印が包んでも失われないことを固定する。
// ★fmt.Errorf で更に包まれても errors.As で拾えること。
func TestIsConfigProblem(t *testing.T) {
	base := errors.New("boom")
	if isConfigProblem(base) {
		t.Error("目印の無いエラーを設定由来と判定した")
	}
	if !isConfigProblem(asConfigProblem(base)) {
		t.Error("目印を付けたエラーを拾えない")
	}
	if !isConfigProblem(fmt.Errorf("wrapped: %w", asConfigProblem(base))) {
		t.Error("さらに包むと拾えない")
	}
	if got := asConfigProblem(base).Error(); got != "boom" {
		t.Errorf("目印を付けると文面が変わる: %q", got)
	}
	if asConfigProblem(nil) != nil {
		t.Error("nil に目印を付けた")
	}
}

// TestParseArgsErrorRidesTheSameChannel は引数エラーも同じ経路に載ることを固定する
// (指示書 §2.4-4)。★-H=windowsgui では標準エラーも消えるため、載せないと
// 打ち間違えたオプションが黙って無視されたのと区別できない。
func TestParseArgsErrorRidesTheSameChannel(t *testing.T) {
	captured := swapAlert(t)

	err := parseArgs([]string{"--serve"})
	if err == nil {
		t.Fatal("未知の引数が通った")
	}
	reportFatal(err)

	if len(*captured) != 1 {
		t.Fatalf("通知が %d 件: %v", len(*captured), *captured)
	}
}

// TestNotifyProblem_ReachesTheUser はメニュー項目の失敗も見えることを固定する
// (指示書 §2.4-2)。★「黙って何も起きない」が最悪である。
func TestNotifyProblem_ReachesTheUser(t *testing.T) {
	captured := swapAlert(t)

	notifyProblem(trayLabelOpenLogDir, errors.New("フォルダを確認できません"))

	if len(*captured) != 1 || (*captured)[0] != trayLabelOpenLogDir+"|フォルダを確認できません" {
		t.Errorf("通知 = %v", *captured)
	}
}

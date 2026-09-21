package datadir

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

// M28-02c: 延期の保存と読み出し(指示書 §5-3)。
//
// ★★最も重要なのは「版が上がったら抑止が外れること」である ——
//   外れないと、次のゲーム更新の告知が黙って握り潰される。

func TestPostponeGameUpdateNotice_RoundTrip(t *testing.T) {
	dir := t.TempDir()
	now := time.Date(2026, 9, 7, 12, 0, 0, 0, time.UTC)

	// 何も書いていない状態は「延期していない」。
	if _, ok, err := PostponedForCurrentVersion(dir, "2026.09.01.00"); err != nil || ok {
		t.Fatalf("初期状態: ok=%v err=%v, want ok=false err=nil", ok, err)
	}

	if err := PostponeGameUpdateNotice(dir, "2026.09.01.00", now); err != nil {
		t.Fatalf("postpone: %v", err)
	}
	// ★ファイル名は台帳ではなくデータディレクトリ直下の隠しファイルである。
	if _, err := os.Stat(filepath.Join(dir, ".game-update-notice.json")); err != nil {
		t.Errorf("告知ファイルが作られていない: %v", err)
	}

	got, ok, err := PostponedForCurrentVersion(dir, "2026.09.01.00")
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	if !ok || got != "2026.09.01.00" {
		t.Errorf("同じ版: ok=%v got=%q, want ok=true got=2026.09.01.00", ok, got)
	}
}

// TestPostponeGameUpdateNotice_ReleasedOnNewerVersion は版が上がったら抑止が外れることを
// 固定する(★これが外れないと次の更新の告知が永久に出ない)。
func TestPostponeGameUpdateNotice_ReleasedOnNewerVersion(t *testing.T) {
	dir := t.TempDir()
	if err := PostponeGameUpdateNotice(dir, "2026.09.01.00", time.Now()); err != nil {
		t.Fatalf("postpone: %v", err)
	}

	got, ok, err := PostponedForCurrentVersion(dir, "2026.10.01.00")
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	if ok {
		t.Error("★版が上がったのに抑止が効いている。⇒ 次の更新の告知が握り潰される")
	}
	// 記録そのものは残る(消さない。経緯を追えるようにするため)。
	if got != "2026.09.01.00" {
		t.Errorf("記録された版 = %q, want 2026.09.01.00", got)
	}
}

// TestReadGameUpdateNotice_BrokenFileIsNotPostponed は壊れた JSON でアプリを止めず、
// かつ「延期していない」に倒すことを固定する。
//
// ★安全側 = 告知が出るほう。出し漏らすより出しすぎるほうがよい(FR307 と同じ向き)。
func TestReadGameUpdateNotice_BrokenFileIsNotPostponed(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, ".game-update-notice.json"), []byte("{ broken"), 0o644); err != nil {
		t.Fatalf("write: %v", err)
	}
	_, ok, err := PostponedForCurrentVersion(dir, "2026.09.01.00")
	if err != nil {
		t.Fatalf("壊れた JSON でエラーを返している: %v", err)
	}
	if ok {
		t.Error("壊れた JSON を延期として扱っている")
	}
}

// TestPostponeGameUpdateNotice_Overwrites は 2 度目の延期が上書きになることを固定する。
func TestPostponeGameUpdateNotice_Overwrites(t *testing.T) {
	dir := t.TempDir()
	if err := PostponeGameUpdateNotice(dir, "2026.09.01.00", time.Now()); err != nil {
		t.Fatalf("postpone 1: %v", err)
	}
	if err := PostponeGameUpdateNotice(dir, "2026.10.01.00", time.Now()); err != nil {
		t.Fatalf("postpone 2: %v", err)
	}
	got, ok, err := PostponedForCurrentVersion(dir, "2026.10.01.00")
	if err != nil || !ok || got != "2026.10.01.00" {
		t.Errorf("ok=%v got=%q err=%v, want ok=true got=2026.10.01.00", ok, got, err)
	}
	// ★tmp ファイルを残さない。
	if _, err := os.Stat(filepath.Join(dir, ".game-update-notice.json.tmp")); !os.IsNotExist(err) {
		t.Error("tmp ファイルが残っている")
	}
}

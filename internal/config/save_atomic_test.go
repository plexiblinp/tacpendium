package config

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// 本ファイルは Save のアトミック書込の不変条件だけを扱う(M24-09b §5.1-3)。
//
// ★守りたい不変条件: **書込に失敗しても、既存の設定ファイルが壊れない。**
// config.toml は利用者が手で書く唯一のファイルであり、切り詰められた状態で残ると
// 起動できなくなる。Save は一時ファイルへ書き切ってから rename することで、
// path が常に「置換前の完全な内容」か「置換後の完全な内容」のどちらかになるようにしている。
//
// ★config_test.go とは別ファイルにしてある —— 同ファイルへ足すと、Load の検証群と
// 書込の不変条件という別の関心が混ざる(教訓 E-225 の M23-08 是正と同じ形)。

const existingConfigTOML = `# 利用者が手で書いたコメント
[server]
mode = "local"
port = 47318
`

// writeSeedConfig は「既に存在する設定ファイル」を用意し、そのパスと元の中身を返す。
func writeSeedConfig(t *testing.T) (path string, original []byte) {
	t.Helper()
	path = filepath.Join(t.TempDir(), "config.toml")
	if err := os.WriteFile(path, []byte(existingConfigTOML), 0o600); err != nil {
		t.Fatalf("seed config.toml: %v", err)
	}
	original, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read seed: %v", err)
	}
	return path, original
}

// TestSave_WriteFailure_LeavesExistingFileIntact は、書込に失敗したときに
// 既存の設定ファイルが 1 バイトも変わらないことを主張する。
//
// 失敗のさせ方: 一時ファイルのパス(path + ".tmp")をディレクトリとして先に作っておく。
// os.Create がそこで失敗するため、Save は path へ触れないまま error を返す。
//
// ★これは「アトミックに置き換えているか」を外から観測できる唯一の形である。
// path へ直接書く実装だと、この状況でも書き込みが成功して既存の中身が失われる。
func TestSave_WriteFailure_LeavesExistingFileIntact(t *testing.T) {
	path, original := writeSeedConfig(t)

	// 一時ファイルの置き場をディレクトリで塞ぐ。
	if err := os.Mkdir(path+".tmp", 0o700); err != nil {
		t.Fatalf("mkdir blocker: %v", err)
	}

	cfg := Default()
	cfg.Server.Port = 60000 // 元ファイル(47318)と違う値にして、書けたかどうかを判別可能にする

	err := Save(path, cfg)
	if err == nil {
		t.Fatal("Save は失敗するはずだが nil を返した(書込経路が一時ファイルを経由していない)")
	}

	after, readErr := os.ReadFile(path)
	if readErr != nil {
		t.Fatalf("既存ファイルが読めなくなった: %v", readErr)
	}
	if string(after) != string(original) {
		t.Errorf("書込失敗で既存の設定ファイルが変わった:\n--- before ---\n%s\n--- after ---\n%s",
			original, after)
	}
	if strings.Contains(string(after), "60000") {
		t.Errorf("書込失敗なのに新しい値が書かれている: %s", after)
	}
}

// TestSave_Success_ReplacesCompletelyAndLeavesNoTemp は、成功時に
// 中身が完全に置き換わり、一時ファイルが残らないことを主張する。
func TestSave_Success_ReplacesCompletelyAndLeavesNoTemp(t *testing.T) {
	path, _ := writeSeedConfig(t)

	cfg := Default()
	cfg.Server.Port = 60000

	if err := Save(path, cfg); err != nil {
		t.Fatalf("Save: %v", err)
	}

	// 中身が新しい値になっている(＝置換が完了している)。
	after, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read after: %v", err)
	}
	if !strings.Contains(string(after), "60000") {
		t.Errorf("新しい値が書かれていない: %s", after)
	}

	// 一時ファイルが残っていない。
	if _, err := os.Stat(path + ".tmp"); !os.IsNotExist(err) {
		t.Errorf("一時ファイルが残った: %s.tmp (stat err = %v)", path, err)
	}

	// 書き戻した内容が Load で読み直せる(＝切り詰められていない完全な TOML である)。
	reloaded, err := Load(path)
	if err != nil {
		t.Fatalf("書き戻した config.toml が読み直せない: %v", err)
	}
	if reloaded.Server.Port != 60000 {
		t.Errorf("Load 後の port = %d, want 60000", reloaded.Server.Port)
	}
}

// TestSave_CreatesFileWhenAbsent はファイル不在時に新規作成されることを主張する
// (初回起動・PersistPort の経路)。
func TestSave_CreatesFileWhenAbsent(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.toml")

	if err := Save(path, Default()); err != nil {
		t.Fatalf("Save: %v", err)
	}
	if _, err := os.Stat(path); err != nil {
		t.Fatalf("ファイルが作られていない: %v", err)
	}
	if _, err := os.Stat(path + ".tmp"); !os.IsNotExist(err) {
		t.Errorf("一時ファイルが残った: %s.tmp", path)
	}
}

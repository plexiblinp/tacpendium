package main

import (
	"strings"
	"testing"
)

// TestParseArgs は「引数なしが唯一の起動形である」ことを機械で固定する(M34-02 段 2)。
//
// ★★着手前は余分な引数が黙って無視されていた。⇒ 本テストが無いと、誰かが
// 無視へ戻しても何も言わない(起動は成功するため、テストも lint も緑になる)。
func TestParseArgs(t *testing.T) {
	if err := parseArgs(nil); err != nil {
		t.Fatalf("引数なしが拒否された: %v", err)
	}
	if err := parseArgs([]string{}); err != nil {
		t.Fatalf("空の引数列が拒否された: %v", err)
	}

	bad := [][]string{
		{"--serve"},          // 打ち間違えたオプション
		{"-port=1234"},       // 在ると思われがちなオプション
		{"tray"},             // サブコマンド風の位置引数
		{"config.toml"},      // ファイルを渡す誤用
		{"--", "unexpected"}, // 終端の後ろの位置引数
		{"-h"},               // help も「引数なしで起動」を伝えて終わる
	}
	for _, args := range bad {
		err := parseArgs(args)
		if err == nil {
			t.Errorf("parseArgs(%q) = nil, want error", args)
			continue
		}
		// ★利用者にそのまま出る文面である。何をすればよいかが含まれること。
		if !strings.Contains(err.Error(), "引数なしで起動") {
			t.Errorf("parseArgs(%q) のエラー文に対処が書かれていない: %v", args, err)
		}
	}
}

package model_test

import (
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
)

func TestExtractDefaultRecipe(t *testing.T) {
	sp := func(s string) *string { return &s }

	tests := []struct {
		name     string
		cache    *string
		presetID int64
		want     string
	}{
		{"指定プリセットの値を取り出す", sp(`{"1":"弱P > 中K > 波動拳","2":"LP > MK > QCF+P"}`), 1, "弱P > 中K > 波動拳"},
		{"★既定が別プリセットなら別の値を取り出す(固定値を読んでいない)", sp(`{"1":"弱P > 中K > 波動拳","2":"LP > MK > QCF+P"}`), 2, "LP > MK > QCF+P"},
		{"nil は空文字", nil, 1, ""},
		{"空文字は空文字", sp(""), 1, ""},
		{"壊れた JSON は空文字(エラーにしない)", sp(`{broken`), 1, ""},
		{"指定プリセットのキーが無ければ空文字", sp(`{"2":"LP > MK"}`), 1, ""},
	}
	for _, tt := range tests {
		if got := model.ExtractDefaultRecipe(tt.cache, tt.presetID); got != tt.want {
			t.Errorf("%s: got %q, want %q", tt.name, got, tt.want)
		}
	}
}

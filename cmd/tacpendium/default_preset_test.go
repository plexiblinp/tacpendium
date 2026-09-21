package main

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"strconv"
	"strings"
	"testing"

	appconfig "github.com/plexiblinp/tacpendium/internal/config"
	"github.com/plexiblinp/tacpendium/internal/model"
	presetrepo "github.com/plexiblinp/tacpendium/internal/repository/preset"
	"github.com/plexiblinp/tacpendium/internal/testutil/dbtest"
)

// M20-05 §5 (i)(m): 起動時に config が実在しないプリセットを指していたときの振る舞い。
//
// ★開発者判断で確定済み(D-358)——起動は止めず、組み込みの既定へ倒してログへ残す。
// 画面への告知は本サブでは行わない。
//
// ★(m) が要るのは §4.2 と §4.3 が不可分だからである。読み出しキーを config へ
// 追随させたため、実在しない ID を指したままだとレシピ行が黙って消える
// (キー不在は空文字を返しエラーにならない)。倒したあとに行が残ることまで見る。

// captureWarn は ensureDefaultPresetExists を実行し、その間のログを文字列で返す。
func captureWarn(t *testing.T, fn func()) string {
	t.Helper()
	var buf bytes.Buffer
	prev := slog.Default()
	slog.SetDefault(slog.New(slog.NewTextHandler(&buf, &slog.HandlerOptions{Level: slog.LevelWarn})))
	defer slog.SetDefault(prev)
	fn()
	return buf.String()
}

func TestEnsureDefaultPresetExists_FallsBackAndLogs(t *testing.T) {
	db := dbtest.Setup(t)
	repo := presetrepo.New(db)
	ctx := context.Background()

	cfg := appconfig.Default()
	cfg.Defaults.PresetID = 999999 // 実在しない

	var err error
	logged := captureWarn(t, func() { err = ensureDefaultPresetExists(ctx, repo, cfg) })

	// (i-1) 起動は止まらない。
	if err != nil {
		t.Fatalf("起動が止まった: %v。実在しない preset_id でも起動は続けること(D-358)", err)
	}

	// (i-2) 組み込みの既定へ倒れている。
	builtin, err := repo.FindPresetByCode(ctx, model.PresetCodeOfficialJaMove)
	if err != nil {
		t.Fatalf("FindPresetByCode: %v", err)
	}
	if cfg.Defaults.PresetID != builtin.ID {
		t.Errorf("preset_id = %d, want %d(組み込みの既定 %q へ倒すこと)",
			cfg.Defaults.PresetID, builtin.ID, model.PresetCodeOfficialJaMove)
	}

	// (i-3) 倒したことがログに残る。
	if !strings.Contains(logged, "does not exist") {
		t.Errorf("警告ログが出ていない。出力:\n%s", logged)
	}
	if !strings.Contains(logged, "999999") {
		t.Errorf("設定されていた値がログに残っていない。出力:\n%s", logged)
	}
	if !strings.Contains(logged, strconv.FormatInt(builtin.ID, 10)) {
		t.Errorf("倒し先がログに残っていない。出力:\n%s", logged)
	}
}

func TestEnsureDefaultPresetExists_KeepsValidValue(t *testing.T) {
	db := dbtest.Setup(t)
	repo := presetrepo.New(db)
	ctx := context.Background()

	numeric, err := repo.FindPresetByCode(ctx, model.PresetCodeNumeric)
	if err != nil {
		t.Fatalf("FindPresetByCode: %v", err)
	}

	cfg := appconfig.Default()
	cfg.Defaults.PresetID = numeric.ID

	logged := captureWarn(t, func() {
		if err := ensureDefaultPresetExists(ctx, repo, cfg); err != nil {
			t.Fatalf("ensureDefaultPresetExists: %v", err)
		}
	})

	// ★実在する値は勝手に書き換えない(組み込みの既定へ倒すのは不在のときだけ)。
	if cfg.Defaults.PresetID != numeric.ID {
		t.Errorf("preset_id = %d, want %d(実在する値は書き換えないこと)", cfg.Defaults.PresetID, numeric.ID)
	}
	if logged != "" {
		t.Errorf("実在しているのに警告が出ている:\n%s", logged)
	}
}

// TestEnsureDefaultPresetExists_RecipeRowSurvives は §5 (m)。
//
// ★倒したあとの preset_id で recipe_cache を引けること——つまりレシピ行が
// 空にならないことを見る。倒さずに追随だけ入れると、ここが空文字になる。
func TestEnsureDefaultPresetExists_RecipeRowSurvives(t *testing.T) {
	db := dbtest.Setup(t)
	repo := presetrepo.New(db)
	ctx := context.Background()

	// recipe_cache を持つ行を 1 つ用意する(seed の形に合わせた最小の JSON)。
	builtin, err := repo.FindPresetByCode(ctx, model.PresetCodeOfficialJaMove)
	if err != nil {
		t.Fatalf("FindPresetByCode: %v", err)
	}
	cacheJSON, err := json.Marshal(map[string]string{
		strconv.FormatInt(builtin.ID, 10): "立ち弱P > 弱波動拳",
	})
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	cfg := appconfig.Default()
	cfg.Defaults.PresetID = 999999
	if err := ensureDefaultPresetExists(ctx, repo, cfg); err != nil {
		t.Fatalf("ensureDefaultPresetExists: %v", err)
	}

	raw := string(cacheJSON)
	got := model.ExtractDefaultRecipe(&raw, cfg.Defaults.PresetID)
	if got == "" {
		t.Errorf("倒したあとの preset_id=%d でレシピ行が空になった。"+
			"★追随(§4.2)だけ入れて実在検査(§4.3)が効いていない状態と同じ症状である",
			cfg.Defaults.PresetID)
	}
}

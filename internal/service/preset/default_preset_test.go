package preset_test

import (
	"context"
	"database/sql"
	"encoding/json"
	"net"
	"path/filepath"
	"strconv"
	"testing"

	appconfig "github.com/plexiblinp/tacpendium/internal/config"
	"github.com/plexiblinp/tacpendium/internal/model"
	comborepo "github.com/plexiblinp/tacpendium/internal/repository/combo"
	presetrepo "github.com/plexiblinp/tacpendium/internal/repository/preset"
	setuprepo "github.com/plexiblinp/tacpendium/internal/repository/setup"
	combosvc "github.com/plexiblinp/tacpendium/internal/service/combo"
	configsvc "github.com/plexiblinp/tacpendium/internal/service/config"
	"github.com/plexiblinp/tacpendium/internal/service/notation"
	"github.com/plexiblinp/tacpendium/internal/service/validation"
	"github.com/plexiblinp/tacpendium/internal/testutil/dbtest"
)

// M20-05 §5 (d)(e)(h): 既定プリセットへの追随と、config の実在検査を固定する。
//
// ★§4.2 の追随と §4.3 の実在検査は不可分である。追随だけ入れると、実在しない ID を
// 指した状態でレシピ行が黙って消える(キー不在は空文字を返しエラーにならない)。

// defaultPresetEnv は本番と同じ配線で combo サービスと config サービスを組む。
type defaultPresetEnv struct {
	db             *sql.DB
	ctx            context.Context
	comboSvc       combosvc.Service
	configSvc      configsvc.Service
	cfg            *appconfig.Config
	comboID        int64
	officialID     int64
	numericID      int64
	recomputeCalls []int64
}

func newDefaultPresetEnv(t *testing.T) *defaultPresetEnv {
	t.Helper()
	db := dbtest.Setup(t)
	pRepo := presetrepo.New(db)
	cRepo := comborepo.New(db)
	sRepo := setuprepo.New(db)
	nSvc := notation.New(db, pRepo, cRepo, sRepo)
	moveID := moveIDByCode(t, db, 1, "standing_light_punch")

	env := &defaultPresetEnv{
		db:         db,
		ctx:        context.Background(),
		cfg:        appconfig.Default(),
		officialID: presetIDByCode(t, db, model.PresetCodeOfficialJaMove),
		numericID:  presetIDByCode(t, db, model.PresetCodeNumeric),
	}
	env.comboID = insertWiringCombo(t, db, cRepo, nSvc, moveID)
	env.cfg.Defaults.PresetID = env.officialID

	// ★main.go と同じ形で注入する。固定値ではなくクロージャで現在値を読む。
	defaultPresetID := func() int64 { return env.cfg.Defaults.PresetID }
	env.comboSvc = combosvc.New(db, cRepo, validation.Dependencies{
		CharacterRepo: &combosvc.CharacterAdapter{DB: db},
		MoveRepo:      &combosvc.MoveAdapter{DB: db},
		ComboRepo:     &combosvc.ComboDuplicateAdapter{Repo: cRepo},
	}, nSvc, nil, defaultPresetID)

	env.configSvc = configsvc.NewService(
		env.cfg,
		filepath.Join(t.TempDir(), "config.toml"),
		func() (net.IP, error) { return nil, nil },
		func(presetID int64) (bool, error) {
			if _, err := pRepo.FindPresetByID(env.ctx, presetID); err != nil {
				return false, nil
			}
			return true, nil
		},
		func(presetID int64) error {
			env.recomputeCalls = append(env.recomputeCalls, presetID)
			return nSvc.RecomputePresetCache(env.ctx, presetID)
		},
	)
	return env
}

// ---------------------------------------------------------------------------
// (e) 読み出しキーの追随
// ---------------------------------------------------------------------------

// Test_DefaultRecipe_FollowsConfig は ★固定値を読んでいないことを主張する。
//
// M20-05 以前は model / combo / setup の 3 か所が独立に "1" を持っており、
// config の [defaults] preset_id を変えても取り出す表記が変わらなかった(D-313)。
func Test_DefaultRecipe_FollowsConfig(t *testing.T) {
	env := newDefaultPresetEnv(t)

	env.cfg.Defaults.PresetID = env.officialID
	official, err := env.comboSvc.Get(env.ctx, env.comboID, 1)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}

	env.cfg.Defaults.PresetID = env.numericID
	numeric, err := env.comboSvc.Get(env.ctx, env.comboID, 1)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}

	if official.DefaultRecipe == "" || numeric.DefaultRecipe == "" {
		t.Fatalf("前提が崩れている: 表記が空(official=%q numeric=%q)",
			official.DefaultRecipe, numeric.DefaultRecipe)
	}
	if official.DefaultRecipe == numeric.DefaultRecipe {
		t.Errorf("config を変えても表記が変わらない(いずれも %q)。"+
			"固定値を読んでいる(§4.2-1・差し戻し事由 6)", official.DefaultRecipe)
	}

	// ★実際に切替先プリセットのキャッシュ値と一致していることまで見る
	// (「たまたま違う値になった」を除外する)。
	want, ok := cacheEntry(t, env.db, env.comboID, env.numericID)
	if !ok {
		t.Fatal("numeric プリセットのエントリが recipe_cache に無い")
	}
	if numeric.DefaultRecipe != want {
		t.Errorf("DefaultRecipe = %q, want %q(切替先プリセットのキャッシュ値)",
			numeric.DefaultRecipe, want)
	}
}

// ---------------------------------------------------------------------------
// (d) 既定プリセットの切替
// ---------------------------------------------------------------------------

// Test_ConfigUpdate_RecomputesSwitchedPreset は §4.2-3 を固定する。
//
// ★追随させると新しい状態が 1 つ生まれる——「一度もエイリアスを触っていない
// プリセットへ切り替えるとキーが存在しない」。切替と同じ手番で塞ぐ(D-313)。
// キーを実際に取り除いた状態から切り替え、切替先のキーで表記が取り出せることを見る。
func Test_ConfigUpdate_RecomputesSwitchedPreset(t *testing.T) {
	env := newDefaultPresetEnv(t)

	// 「切替先にキャッシュが無い」状態を作る。
	stripCacheKey(t, env.db, env.comboID, env.numericID)
	if _, ok := cacheEntry(t, env.db, env.comboID, env.numericID); ok {
		t.Fatal("前提が崩れている: キーを取り除けていない")
	}

	target := env.numericID
	if _, _, issues, _, err := env.configSvc.Update(configsvc.UpdateRequest{
		Defaults: &configsvc.DefaultsUpdate{PresetID: &target},
	}); err != nil || len(issues) > 0 {
		t.Fatalf("Update: err=%v issues=%v", err, issues)
	}

	if len(env.recomputeCalls) != 1 || env.recomputeCalls[0] != target {
		t.Fatalf("再計算の呼び出し = %v, want [%d](切替先の 1 回だけ)", env.recomputeCalls, target)
	}
	text, ok := cacheEntry(t, env.db, env.comboID, target)
	if !ok {
		t.Fatalf("切替先 preset=%d のキーが再計算されていない(§4.2-3)", target)
	}
	if text == "" {
		t.Error("切替先のエントリが空文字である")
	}

	// 切替後は当該プリセットの表記が取り出せる。
	got, err := env.comboSvc.Get(env.ctx, env.comboID, 1)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if got.DefaultRecipe != text {
		t.Errorf("DefaultRecipe = %q, want %q", got.DefaultRecipe, text)
	}
}

// Test_ConfigUpdate_NoRecomputeWhenUnchanged は ★切替が無いときに再計算を走らせない
// ことを見る(呼び出しを利用者の操作で分岐させないのは「書き込み経路」の話であり、
// 設定が変わっていないのに再計算するのは単なる無駄である)。
func Test_ConfigUpdate_NoRecomputeWhenUnchanged(t *testing.T) {
	env := newDefaultPresetEnv(t)

	characterID := int64(1)
	if _, _, issues, _, err := env.configSvc.Update(configsvc.UpdateRequest{
		Defaults: &configsvc.DefaultsUpdate{CharacterID: &characterID},
	}); err != nil || len(issues) > 0 {
		t.Fatalf("Update: err=%v issues=%v", err, issues)
	}
	if len(env.recomputeCalls) != 0 {
		t.Errorf("既定プリセットが変わっていないのに再計算が走った: %v", env.recomputeCalls)
	}
}

// ---------------------------------------------------------------------------
// (h) config の実在検査
// ---------------------------------------------------------------------------

// Test_ConfigUpdate_RejectsNonexistentPreset は §4.3-1 を固定する。
//
// ★値域だけの検証で通すと、実在しないプリセットを指した状態が config に入る。
// 読み出しキーが config へ追随するため、そのままではレシピ行が黙って消える。
func Test_ConfigUpdate_RejectsNonexistentPreset(t *testing.T) {
	env := newDefaultPresetEnv(t)

	bogus := int64(999999)
	_, _, issues, _, err := env.configSvc.Update(configsvc.UpdateRequest{
		Defaults: &configsvc.DefaultsUpdate{PresetID: &bogus},
	})
	if err != nil {
		t.Fatalf("Update returned error: %v", err)
	}
	if len(issues) == 0 {
		t.Fatal("実在しないプリセットを指す更新が通ってしまった(§4.3-1)")
	}
	found := false
	for _, iss := range issues {
		if iss.Field == "defaults.presetId" {
			found = true
		}
	}
	if !found {
		t.Errorf("issues = %v, want defaults.presetId の指摘", issues)
	}
	if env.cfg.Defaults.PresetID == bogus {
		t.Error("拒否されたのに config が書き換わっている")
	}
	if len(env.recomputeCalls) != 0 {
		t.Errorf("拒否されたのに再計算が走った: %v", env.recomputeCalls)
	}
}

// stripCacheKey は recipe_cache から当該 preset_id のキーだけを取り除く。
func stripCacheKey(t *testing.T, db *sql.DB, comboID, presetID int64) {
	t.Helper()
	var raw sql.NullString
	if err := db.QueryRow(`SELECT recipe_cache FROM combos WHERE id = ?`, comboID).Scan(&raw); err != nil {
		t.Fatalf("select recipe_cache: %v", err)
	}
	m := map[string]string{}
	if raw.Valid && raw.String != "" {
		if err := json.Unmarshal([]byte(raw.String), &m); err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
	}
	delete(m, strconv.FormatInt(presetID, 10))
	b, err := json.Marshal(m)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	if _, err := db.Exec(`UPDATE combos SET recipe_cache = ? WHERE id = ?`, string(b), comboID); err != nil {
		t.Fatalf("update recipe_cache: %v", err)
	}
}

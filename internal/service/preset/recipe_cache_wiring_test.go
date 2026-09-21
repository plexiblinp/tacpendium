package preset_test

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"strconv"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
	comborepo "github.com/plexiblinp/tacpendium/internal/repository/combo"
	presetrepo "github.com/plexiblinp/tacpendium/internal/repository/preset"
	setuprepo "github.com/plexiblinp/tacpendium/internal/repository/setup"
	"github.com/plexiblinp/tacpendium/internal/service/notation"
	presetsvc "github.com/plexiblinp/tacpendium/internal/service/preset"
	"github.com/plexiblinp/tacpendium/internal/testutil/dbtest"
)

// M20-05 §5 (a)(b)(c)(f)(g)(l): recipe_cache 再計算の「いつ呼ばれるか」を固定する。
//
// ★再計算そのものの正しさは既存のテスト資産(notation パッケージ)が持つ。
// 本ファイルが主張するのは「書き込み経路から呼ばれていること」と「その呼び出しが
// 正しい位置(コミット後 / 同一 tx 内)にあること」だけである。
//
// ★なぜ形を固定するか——配線を間違えても動いてしまい、壊れるのは「表記が古いまま」と
// いう silent な形である。動作は正しいままなのでテストも lint も型検査も緑になる。

const wiringAliasText = "M20-05テスト表記"

type wiringEnv struct {
	db       *sql.DB
	ctx      context.Context
	svc      presetsvc.Service
	pRepo    presetrepo.Repository
	cRepo    comborepo.Repository
	moveID   int64
	comboIDs []int64
}

// newWiringEnv は コンボ 2 本 ＋ 本番と同じ配線の preset サービスを用意する。
//
// ★コンボを 2 本置くのは §5 (f)〔部分更新の不在〕のためである。1 本だと
// 「先行行が残っていない」ことを主張できない。
func newWiringEnv(t *testing.T) *wiringEnv {
	t.Helper()
	db := dbtest.Setup(t)
	pRepo := presetrepo.New(db)
	cRepo := comborepo.New(db)
	sRepo := setuprepo.New(db)
	nSvc := notation.New(db, pRepo, cRepo, sRepo)

	env := &wiringEnv{
		db:     db,
		ctx:    context.Background(),
		svc:    presetsvc.New(db, pRepo, nil, nSvc),
		pRepo:  pRepo,
		cRepo:  cRepo,
		moveID: moveIDByCode(t, db, 1, "standing_light_punch"),
	}
	env.comboIDs = []int64{
		insertWiringCombo(t, db, cRepo, nSvc, env.moveID),
		insertWiringCombo(t, db, cRepo, nSvc, env.moveID),
	}
	return env
}

func insertWiringCombo(t *testing.T, db *sql.DB, cRepo comborepo.Repository, nSvc notation.Service, moveID int64) int64 {
	t.Helper()
	ctx := context.Background()
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		t.Fatalf("begin tx: %v", err)
	}
	defer func() { _ = tx.Rollback() }()

	combo := &model.Combo{
		CharacterID:    1,
		StarterMoveID:  &moveID,
		Position:       strPtr("mid_screen"),
		OpponentStance: strPtr("standing"),
		HitType:        strPtr("normal"),
		OpponentSize:   strPtr("standard"),
		Version:        1,
		StepCount:      1,
	}
	id, err := cRepo.InsertCombo(ctx, tx, combo)
	if err != nil {
		t.Fatalf("InsertCombo: %v", err)
	}
	if err := cRepo.InsertSteps(ctx, tx, id, []model.ComboStep{{StepOrder: 1, MoveID: &moveID}}); err != nil {
		t.Fatalf("InsertSteps: %v", err)
	}
	if err := nSvc.RecomputeComboCache(ctx, tx, id); err != nil {
		t.Fatalf("RecomputeComboCache: %v", err)
	}
	if err := tx.Commit(); err != nil {
		t.Fatalf("commit: %v", err)
	}
	return id
}

func strPtr(s string) *string { return &s }

// cacheEntry は combos.recipe_cache から当該 preset_id のエントリを取り出す。
func cacheEntry(t *testing.T, db *sql.DB, comboID, presetID int64) (string, bool) {
	t.Helper()
	var raw sql.NullString
	if err := db.QueryRow(`SELECT recipe_cache FROM combos WHERE id = ?`, comboID).Scan(&raw); err != nil {
		t.Fatalf("select recipe_cache (combo=%d): %v", comboID, err)
	}
	if !raw.Valid || raw.String == "" {
		return "", false
	}
	m := map[string]string{}
	if err := json.Unmarshal([]byte(raw.String), &m); err != nil {
		t.Fatalf("unmarshal recipe_cache (combo=%d): %v", comboID, err)
	}
	v, ok := m[strconv.FormatInt(presetID, 10)]
	return v, ok
}

// aliasTextOf は preset_aliases の現在値を DB から直接読む。
func aliasTextOf(t *testing.T, db *sql.DB, presetID, moveID int64) string {
	t.Helper()
	var text string
	if err := db.QueryRow(
		`SELECT alias_text FROM preset_aliases WHERE preset_id = ? AND move_id = ?`,
		presetID, moveID,
	).Scan(&text); err != nil {
		t.Fatalf("select alias_text (preset=%d move=%d): %v", presetID, moveID, err)
	}
	return text
}

// ---------------------------------------------------------------------------
// (b) 作成・コピー
// ---------------------------------------------------------------------------

// ★本プロジェクトでは「作成」と「コピー」は同一経路である(§3.3-1 実査)。
// POST /api/presets = Create() が組み込みプリセットのエイリアスを複製する形であり、
// 独立した duplicate エンドポイントは存在しない。⇒ 本テストが両方を固定する。
func Test_Create_PopulatesRecipeCache(t *testing.T) {
	env := newWiringEnv(t)

	created, err := env.svc.Create(env.ctx, testUserID, model.PresetCodeSRK, "作成で再計算")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	for _, comboID := range env.comboIDs {
		text, ok := cacheEntry(t, env.db, comboID, created.ID)
		if !ok {
			t.Fatalf("combo=%d: 作成した preset=%d のエントリが recipe_cache に無い", comboID, created.ID)
		}
		if text == "" {
			t.Errorf("combo=%d: エントリが空文字である", comboID)
		}
	}
}

// ---------------------------------------------------------------------------
// (a) エイリアス更新
// ---------------------------------------------------------------------------

func Test_Update_RefreshesRecipeCache(t *testing.T) {
	env := newWiringEnv(t)

	created, err := env.svc.Create(env.ctx, testUserID, model.PresetCodeSRK, "更新で再計算")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	before, _ := cacheEntry(t, env.db, env.comboIDs[0], created.ID)

	if _, err := env.svc.Update(env.ctx, testUserID, created.ID, nil, []presetsvc.AliasUpdate{
		{MoveID: env.moveID, AliasText: wiringAliasText},
	}); err != nil {
		t.Fatalf("Update: %v", err)
	}

	for _, comboID := range env.comboIDs {
		text, ok := cacheEntry(t, env.db, comboID, created.ID)
		if !ok {
			t.Fatalf("combo=%d: preset=%d のエントリが消えた", comboID, created.ID)
		}
		if text != wiringAliasText {
			t.Errorf("combo=%d: 表記 = %q, want %q(更新前は %q)。stale が解消していない",
				comboID, text, wiringAliasText, before)
		}
	}
}

// ---------------------------------------------------------------------------
// (c) 削除
// ---------------------------------------------------------------------------

func Test_Delete_RemovesRecipeCacheEntry(t *testing.T) {
	env := newWiringEnv(t)

	created, err := env.svc.Create(env.ctx, testUserID, model.PresetCodeSRK, "削除で掃除")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if _, ok := cacheEntry(t, env.db, env.comboIDs[0], created.ID); !ok {
		t.Fatal("前提が崩れている: 作成直後にエントリが無い")
	}

	if err := env.svc.Delete(env.ctx, testUserID, created.ID); err != nil {
		t.Fatalf("Delete: %v", err)
	}

	for _, comboID := range env.comboIDs {
		if text, ok := cacheEntry(t, env.db, comboID, created.ID); ok {
			t.Errorf("combo=%d: 削除した preset=%d のキーが孤児として残っている(値 %q)",
				comboID, created.ID, text)
		}
		// ★キャッシュ全体が消えていないことも見る(他プリセットの巻き添えを防ぐ)。
		if _, ok := cacheEntry(t, env.db, comboID, presetIDByCode(t, env.db, model.PresetCodeOfficialJaMove)); !ok {
			t.Errorf("combo=%d: 他プリセットのエントリまで消えている", comboID)
		}
	}
}

// ---------------------------------------------------------------------------
// (l) 呼び出し順(§4.4-5・D-360)
// ---------------------------------------------------------------------------

// orderSpyNotation は RecomputePresetCache が呼ばれた瞬間に、別経路(非 tx)から
// preset_aliases を読んで記録する。
//
// ★これが §5 (l) の実装である。書き込みトランザクションの内側で再計算を呼ぶと、
// 別コネクションからは未コミットの更新が見えない——つまり旧いエイリアスが観測される。
// 再計算はまさにその経路でエイリアスを引くため、内側で呼べば古い表記を書き込む。
// エラーにはならず、他のどのテストも緑のまま通る。順序が正しさの根拠である以上、
// 順序が壊れたことを検出できる検査を置く(件数ではなく形を固定する＝D-354 と同型)。
type orderSpyNotation struct {
	notation.Service
	db              *sql.DB
	moveID          int64
	called          bool
	seenAtRecompute string
}

func (s *orderSpyNotation) RecomputePresetCache(ctx context.Context, presetID int64) error {
	s.called = true
	var text string
	// t を持たないため、ここでは失敗を空文字として記録し、判定は呼出側で行う。
	_ = s.db.QueryRow(
		`SELECT alias_text FROM preset_aliases WHERE preset_id = ? AND move_id = ?`,
		presetID, s.moveID,
	).Scan(&text)
	s.seenAtRecompute = text
	return s.Service.RecomputePresetCache(ctx, presetID)
}

func Test_Update_RecomputesAfterCommit(t *testing.T) {
	db := dbtest.Setup(t)
	pRepo := presetrepo.New(db)
	cRepo := comborepo.New(db)
	sRepo := setuprepo.New(db)
	moveID := moveIDByCode(t, db, 1, "standing_light_punch")
	real := notation.New(db, pRepo, cRepo, sRepo)
	insertWiringCombo(t, db, cRepo, real, moveID)

	spy := &orderSpyNotation{Service: real, db: db, moveID: moveID}
	svc := presetsvc.New(db, pRepo, nil, spy)
	ctx := context.Background()

	created, err := svc.Create(ctx, testUserID, model.PresetCodeSRK, "順序検証")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if !spy.called {
		t.Fatal("Create から再計算が呼ばれていない")
	}

	spy.called = false
	if _, err := svc.Update(ctx, testUserID, created.ID, nil, []presetsvc.AliasUpdate{
		{MoveID: moveID, AliasText: wiringAliasText},
	}); err != nil {
		t.Fatalf("Update: %v", err)
	}
	if !spy.called {
		t.Fatal("Update から再計算が呼ばれていない")
	}
	if spy.seenAtRecompute != wiringAliasText {
		t.Errorf("再計算の時点で見えたエイリアス = %q, want %q。"+
			"★書き込みトランザクションの内側で再計算を呼んでいる(コミット前の値が見えている)。"+
			"この形は古い表記を silent に書き込む(§4.4-3・差し戻し事由 11)",
			spy.seenAtRecompute, wiringAliasText)
	}
	// 実際に新しい表記が書かれていることも併せて見る。
	if got := aliasTextOf(t, db, created.ID, moveID); got != wiringAliasText {
		t.Errorf("preset_aliases = %q, want %q", got, wiringAliasText)
	}
}

// ---------------------------------------------------------------------------
// (f) 部分更新の不在 / (g) 失敗の可視性(§4.4-1 / §4.4-2)
// ---------------------------------------------------------------------------

// failNthCacheUpdate は N 回目の UpdateRecipeCacheTx を失敗させる。
//
// ★再計算バッチの「途中」で落とすためのものである。1 回目は成功させ、2 回目で落とす。
// 境界が効いていなければ 1 回目の更新が残る(M20-05 以前の as-built＝D-303)。
type failNthCacheUpdate struct {
	comborepo.Repository
	failOn int
	calls  int
}

func (r *failNthCacheUpdate) UpdateRecipeCacheTx(ctx context.Context, tx *sql.Tx, comboID int64, cacheJSON string) error {
	r.calls++
	if r.calls == r.failOn {
		return errors.New("injected failure in the middle of the recompute batch")
	}
	return r.Repository.UpdateRecipeCacheTx(ctx, tx, comboID, cacheJSON)
}

func Test_Update_RecomputeFailure_IsAtomicAndVisible(t *testing.T) {
	db := dbtest.Setup(t)
	pRepo := presetrepo.New(db)
	cRepo := comborepo.New(db)
	sRepo := setuprepo.New(db)
	moveID := moveIDByCode(t, db, 1, "standing_light_punch")

	okNotation := notation.New(db, pRepo, cRepo, sRepo)
	comboIDs := []int64{
		insertWiringCombo(t, db, cRepo, okNotation, moveID),
		insertWiringCombo(t, db, cRepo, okNotation, moveID),
	}

	ctx := context.Background()
	okSvc := presetsvc.New(db, pRepo, nil, okNotation)
	created, err := okSvc.Create(ctx, testUserID, model.PresetCodeSRK, "失敗注入")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	before := make(map[int64]string, len(comboIDs))
	for _, id := range comboIDs {
		text, ok := cacheEntry(t, db, id, created.ID)
		if !ok {
			t.Fatalf("前提が崩れている: combo=%d にエントリが無い", id)
		}
		before[id] = text
	}

	// 2 回目のキャッシュ更新で落とす(1 回目は成功させる)。
	failing := &failNthCacheUpdate{Repository: cRepo, failOn: 2}
	badSvc := presetsvc.New(db, pRepo, nil, notation.New(db, pRepo, failing, sRepo))

	_, err = badSvc.Update(ctx, testUserID, created.ID, nil, []presetsvc.AliasUpdate{
		{MoveID: moveID, AliasText: wiringAliasText},
	})
	// (g) 失敗が呼び出し元へ伝わること。★握り潰したら利用者からは「反映されない」としか見えない。
	if err == nil {
		t.Fatal("再計算に失敗しているのに Update が成功を返した(§4.4-2・差し戻し事由 4)")
	}
	if failing.calls < 2 {
		t.Fatalf("失敗注入が効いていない(UpdateRecipeCacheTx の呼び出し %d 回)", failing.calls)
	}

	// (f) 先行行の更新が残っていないこと。
	for _, id := range comboIDs {
		text, ok := cacheEntry(t, db, id, created.ID)
		if !ok {
			t.Errorf("combo=%d: エントリごと消えている", id)
			continue
		}
		if text != before[id] {
			t.Errorf("combo=%d: 表記 = %q, want %q(更新前のまま)。"+
				"再計算バッチが部分更新として残っている(§4.4-1・差し戻し事由 3)", id, text, before[id])
		}
	}

	// ★書き込み本体(preset_aliases)は成功している——これは設計どおりである(D-360)。
	// 「保存は成功したが再計算に失敗した」状態を許容し、失敗は上の (g) で伝えている。
	if got := aliasTextOf(t, db, created.ID, moveID); got != wiringAliasText {
		t.Errorf("preset_aliases = %q, want %q(書き込み本体は成功しているはず)", got, wiringAliasText)
	}
}

package punish_test

import (
	"context"
	"database/sql"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
	"github.com/plexiblinp/tacpendium/internal/repository/punish"
	"github.com/plexiblinp/tacpendium/internal/testutil/dbtest"
)

func scanInt64(t *testing.T, db *sql.DB, q string, args ...any) int64 {
	t.Helper()
	var n int64
	if err := db.QueryRow(q, args...).Scan(&n); err != nil {
		t.Fatalf("query %q: %v", q, err)
	}
	return n
}

func TestRepository_StarterCRUD(t *testing.T) {
	db := dbtest.Setup(t)
	repo := punish.New(db)
	ctx := context.Background()

	self := scanInt64(t, db, `SELECT id FROM characters WHERE code='ryu'`)
	opp := scanInt64(t, db, `SELECT m.id FROM moves m JOIN characters c ON c.id=m.character_id WHERE c.code='ryu' AND m.code='hadoken_light'`)
	starter := scanInt64(t, db, `SELECT m.id FROM moves m JOIN characters c ON c.id=m.character_id WHERE c.code='ryu' AND m.code='standing_light_punch'`)

	// 登録。
	if err := repo.UpsertStarter(ctx, self, opp, starter, "adopted", nil); err != nil {
		t.Fatalf("upsert adopted: %v", err)
	}
	vs, err := repo.ListStarterVerdicts(ctx, self)
	if err != nil {
		t.Fatal(err)
	}
	if len(vs) != 1 || vs[0].Verdict != "adopted" || vs[0].StarterMoveID != starter {
		t.Fatalf("verdicts = %+v, want 1 adopted for starter %d", vs, starter)
	}

	// UNIQUE 衝突で更新される(重複行にならない)。
	note := "届かない"
	if err := repo.UpsertStarter(ctx, self, opp, starter, "unreachable", &note); err != nil {
		t.Fatalf("upsert unreachable: %v", err)
	}
	vs, _ = repo.ListStarterVerdicts(ctx, self)
	if len(vs) != 1 || vs[0].Verdict != "unreachable" || vs[0].Note == nil || *vs[0].Note != "届かない" {
		t.Fatalf("after conflict update verdicts = %+v, want 1 unreachable with note", vs)
	}

	// 解除。
	if err := repo.DeleteStarter(ctx, self, opp, starter); err != nil {
		t.Fatalf("delete: %v", err)
	}
	vs, _ = repo.ListStarterVerdicts(ctx, self)
	if len(vs) != 0 {
		t.Fatalf("after delete verdicts = %+v, want empty", vs)
	}
}

func TestRepository_PruningRoundTrip(t *testing.T) {
	db := dbtest.Setup(t)
	repo := punish.New(db)
	ctx := context.Background()

	self := scanInt64(t, db, `SELECT id FROM characters WHERE code='ryu'`)
	opp := scanInt64(t, db, `SELECT m.id FROM moves m JOIN characters c ON c.id=m.character_id WHERE c.code='ryu' AND m.code='hadoken_light'`)

	if err := repo.AddPruning(ctx, self, opp, nil); err != nil {
		t.Fatalf("add pruning: %v", err)
	}
	set, err := repo.ListPrunedMoveIDs(ctx, self)
	if err != nil {
		t.Fatal(err)
	}
	if !set[opp] {
		t.Fatalf("pruned set = %v, want to contain %d", set, opp)
	}
	// 二重登録は UNIQUE 衝突で更新(例外にならない)。
	note := "physically unreachable"
	if err := repo.AddPruning(ctx, self, opp, &note); err != nil {
		t.Fatalf("re-add pruning: %v", err)
	}
	if got := scanInt64(t, db, `SELECT count(*) FROM combo_punish_prunings WHERE self_character_id=? AND opponent_move_id=?`, self, opp); got != 1 {
		t.Fatalf("pruning rows = %d, want 1 (upsert, not duplicate)", got)
	}

	if err := repo.RemovePruning(ctx, self, opp); err != nil {
		t.Fatalf("remove pruning: %v", err)
	}
	set, _ = repo.ListPrunedMoveIDs(ctx, self)
	if len(set) != 0 {
		t.Fatalf("after remove pruned set = %v, want empty", set)
	}
}

func TestRepository_AdoptedComboPunishes(t *testing.T) {
	db := dbtest.Setup(t)
	db.SetMaxOpenConns(1) // FK=ON 接続を 1 本に固定
	repo := punish.New(db)
	ctx := context.Background()

	self := scanInt64(t, db, `SELECT id FROM characters WHERE code='ryu'`)
	opp := scanInt64(t, db, `SELECT m.id FROM moves m JOIN characters c ON c.id=m.character_id WHERE c.code='ryu' AND m.code='hadoken_light'`)
	starter := scanInt64(t, db, `SELECT m.id FROM moves m JOIN characters c ON c.id=m.character_id WHERE c.code='ryu' AND m.code='standing_light_punch'`)

	res, err := db.Exec(`INSERT INTO combos(character_id, starter_move_id) VALUES(?,?)`, self, starter)
	if err != nil {
		t.Fatalf("insert combo: %v", err)
	}
	comboID, _ := res.LastInsertId()

	if err := repo.AddPunish(ctx, comboID, opp, nil); err != nil {
		t.Fatalf("add punish: %v", err)
	}
	keys, err := repo.ListAdoptedComboPunishes(ctx, self)
	if err != nil {
		t.Fatal(err)
	}
	if len(keys) != 1 || keys[0].ComboID != comboID || keys[0].OpponentMoveID != opp {
		t.Fatalf("adopted keys = %+v, want 1 (%d,%d)", keys, comboID, opp)
	}

	if err := repo.RemovePunish(ctx, comboID, opp); err != nil {
		t.Fatalf("remove punish: %v", err)
	}
	keys, _ = repo.ListAdoptedComboPunishes(ctx, self)
	if len(keys) != 0 {
		t.Fatalf("after remove adopted keys = %+v, want empty", keys)
	}
}

func TestRepository_MaterializedBaseComboIDs(t *testing.T) {
	db := dbtest.Setup(t)
	db.SetMaxOpenConns(1)
	repo := punish.New(db)
	ctx := context.Background()

	ryu := scanInt64(t, db, `SELECT id FROM characters WHERE code='ryu'`)
	ken := scanInt64(t, db, `SELECT id FROM characters WHERE code='ken'`)

	insertCombo := func(characterID int64, materializedFrom *int64, isDraft bool, deleted bool) int64 {
		t.Helper()
		var from any
		if materializedFrom != nil {
			from = *materializedFrom
		}
		var deletedAt any
		if deleted {
			deletedAt = "2026-07-28 00:00:00"
		}
		res, err := db.Exec(
			`INSERT INTO combos(character_id, materialized_from_combo_id, is_draft, deleted_at) VALUES(?,?,?,?)`,
			characterID, from, isDraft, deletedAt,
		)
		if err != nil {
			t.Fatalf("insert combo: %v", err)
		}
		id, _ := res.LastInsertId()
		return id
	}

	activeBase := insertCombo(ryu, nil, false, false)
	draftBase := insertCombo(ryu, nil, false, false)
	deletedOnlyBase := insertCombo(ryu, nil, false, false)
	crossCharacterChildBase := insertCombo(ryu, nil, false, false)
	otherCharacterBase := insertCombo(ken, nil, false, false)

	insertCombo(ryu, &activeBase, false, false)
	insertCombo(ryu, &draftBase, true, false)       // is_draft は判定対象外
	insertCombo(ryu, &deletedOnlyBase, false, true) // 論理削除済みだけなら未変換扱い
	insertCombo(ken, &crossCharacterChildBase, false, false)
	insertCombo(ken, &otherCharacterBase, false, false) // 他キャラは混ぜない

	got, err := repo.ListMaterializedBaseComboIDs(ctx, ryu)
	if err != nil {
		t.Fatal(err)
	}
	if !got[activeBase] || !got[draftBase] || !got[crossCharacterChildBase] {
		t.Fatalf("active/draft/cross-character-child materialized bases missing: got=%v", got)
	}
	if got[deletedOnlyBase] {
		t.Errorf("deleted materialized combo must not fold its base: got=%v", got)
	}
	if got[otherCharacterBase] {
		t.Errorf("other character base leaked into result: got=%v", got)
	}
}

// setupPunishFixture は self=ryu / opp=hadoken_light / starter=standing_light_punch と
// コンボ 1 件を用意する(M18-03a のマイリスト系テスト共通の土台)。
func setupPunishFixture(t *testing.T, db *sql.DB, hitType *string) (self, opp, comboID int64) {
	t.Helper()
	self = scanInt64(t, db, `SELECT id FROM characters WHERE code='ryu'`)
	opp = scanInt64(t, db, `SELECT m.id FROM moves m JOIN characters c ON c.id=m.character_id WHERE c.code='ryu' AND m.code='hadoken_light'`)
	starter := scanInt64(t, db, `SELECT m.id FROM moves m JOIN characters c ON c.id=m.character_id WHERE c.code='ryu' AND m.code='standing_light_punch'`)

	var ht any
	if hitType != nil {
		ht = *hitType
	}
	res, err := db.Exec(`INSERT INTO combos(character_id, starter_move_id, damage, step_count, hit_type, recipe_cache) VALUES(?,?,?,?,?,?)`,
		self, starter, 2500, 4, ht, `{"1":"弱P > 中K > 波動拳"}`)
	if err != nil {
		t.Fatalf("insert combo: %v", err)
	}
	comboID, _ = res.LastInsertId()
	return self, opp, comboID
}

func strPtr(s string) *string { return &s }

func TestRepository_CurationCRUD(t *testing.T) {
	db := dbtest.Setup(t)
	db.SetMaxOpenConns(1) // FK=ON 接続を 1 本に固定
	repo := punish.New(db)
	ctx := context.Background()

	self, opp, comboID := setupPunishFixture(t, db, strPtr(model.HitTypePunishCounter))

	// 存在しないキーの DELETE が壊れない(登録前に呼ぶ)。
	if err := repo.RemoveCuration(ctx, comboID, opp); err != nil {
		t.Fatalf("remove curation before add: %v", err)
	}

	if err := repo.AddCuration(ctx, comboID, opp, nil); err != nil {
		t.Fatalf("add curation: %v", err)
	}
	cs, err := repo.ListCurations(ctx, self, nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(cs) != 1 || cs[0].ComboID != comboID || cs[0].OpponentMoveID != opp {
		t.Fatalf("curations = %+v, want 1 (%d,%d)", cs, comboID, opp)
	}
	if cs[0].OpponentMoveCode != "hadoken_light" || cs[0].OpponentCharacterNameJa == "" {
		t.Errorf("表示用投影が欠けている: %+v", cs[0])
	}

	// UNIQUE 二重登録は行を増やさず note が更新される(pruning / starters と同じ返し方)。
	if err := repo.AddCuration(ctx, comboID, opp, strPtr("距離が遠い")); err != nil {
		t.Fatalf("re-add curation: %v", err)
	}
	if got := scanInt64(t, db, `SELECT count(*) FROM combo_punish_curations WHERE combo_id=? AND opponent_move_id=?`, comboID, opp); got != 1 {
		t.Fatalf("curation rows = %d, want 1 (upsert, not duplicate)", got)
	}
	cs, _ = repo.ListCurations(ctx, self, nil)
	if len(cs) != 1 || cs[0].Note == nil || *cs[0].Note != "距離が遠い" {
		t.Fatalf("after conflict update curations = %+v, want note 距離が遠い", cs)
	}

	if err := repo.RemoveCuration(ctx, comboID, opp); err != nil {
		t.Fatalf("remove curation: %v", err)
	}
	cs, _ = repo.ListCurations(ctx, self, nil)
	if len(cs) != 0 {
		t.Fatalf("after remove curations = %+v, want empty", cs)
	}
}

func TestRepository_ListPunishEntries(t *testing.T) {
	db := dbtest.Setup(t)
	db.SetMaxOpenConns(1)
	repo := punish.New(db)
	ctx := context.Background()

	self, opp, comboID := setupPunishFixture(t, db, strPtr(model.HitTypeJustParryPunishCounter))
	if err := repo.AddPunish(ctx, comboID, opp, strPtr("最大反撃")); err != nil {
		t.Fatalf("add punish: %v", err)
	}

	entries, err := repo.ListPunishEntries(ctx, punish.PunishEntryFilter{SelfCharacterID: self})
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 1 {
		t.Fatalf("entries = %+v, want 1", entries)
	}
	e := entries[0]
	if e.ComboID != comboID || e.OpponentMoveID != opp {
		t.Errorf("key = (%d,%d), want (%d,%d)", e.ComboID, e.OpponentMoveID, comboID, opp)
	}
	if e.Damage == nil || *e.Damage != 2500 || e.StepCount != 4 {
		t.Errorf("combo 表示項目が欠けている: damage=%v stepCount=%d", e.Damage, e.StepCount)
	}
	if e.HitType == nil || *e.HitType != model.HitTypeJustParryPunishCounter {
		t.Errorf("hitType = %v, want just_parry_punish_counter", e.HitType)
	}
	if e.StarterMoveID == nil || e.StarterMoveCode == nil || *e.StarterMoveCode != "standing_light_punch" {
		t.Errorf("始動技が解決できていない: id=%v code=%v", e.StarterMoveID, e.StarterMoveCode)
	}
	if e.OpponentMoveCode != "hadoken_light" || e.OpponentCharacterNameJa == "" {
		t.Errorf("相手技/相手キャラが解決できていない: %+v", e)
	}
	if e.Note == nil || *e.Note != "最大反撃" {
		t.Errorf("note = %v, want 最大反撃", e.Note)
	}
	// recipe_cache は生 JSON のまま投影する(既定レシピの抽出はサービス層)。
	if e.RecipeCache == nil || *e.RecipeCache != `{"1":"弱P > 中K > 波動拳"}` {
		t.Errorf("recipeCache = %v, want 生 JSON", e.RecipeCache)
	}

	// curation 除外(表示制御)。
	if err := repo.AddCuration(ctx, comboID, opp, nil); err != nil {
		t.Fatal(err)
	}
	excluded, err := repo.ListPunishEntries(ctx, punish.PunishEntryFilter{SelfCharacterID: self, ExcludeCurated: true})
	if err != nil {
		t.Fatal(err)
	}
	if len(excluded) != 0 {
		t.Errorf("ExcludeCurated=true entries = %+v, want empty", excluded)
	}
	// ExcludeCurated=false では出る(探す画面の既登録表示は curation で隠さない)。
	kept, _ := repo.ListPunishEntries(ctx, punish.PunishEntryFilter{SelfCharacterID: self})
	if len(kept) != 1 {
		t.Errorf("ExcludeCurated=false entries = %+v, want 1", kept)
	}
	if err := repo.RemoveCuration(ctx, comboID, opp); err != nil {
		t.Fatal(err)
	}

	// 論理削除済みコンボは出ない。
	if _, err := db.Exec(`UPDATE combos SET deleted_at = datetime('now') WHERE id = ?`, comboID); err != nil {
		t.Fatal(err)
	}
	afterDelete, _ := repo.ListPunishEntries(ctx, punish.PunishEntryFilter{SelfCharacterID: self})
	if len(afterDelete) != 0 {
		t.Errorf("論理削除後の entries = %+v, want empty", afterDelete)
	}
}

// pruning はマイリストの母集合を絞らない(指示書 §4.1 の帰結)。
// pruning は「探す画面の刈り込み」であり、採用済みの反撃を隠す権限を持たない。
func TestRepository_ListPunishEntries_IgnoresPruning(t *testing.T) {
	db := dbtest.Setup(t)
	db.SetMaxOpenConns(1)
	repo := punish.New(db)
	ctx := context.Background()

	self, opp, comboID := setupPunishFixture(t, db, strPtr(model.HitTypeJustParryPunishCounter))
	if err := repo.AddPunish(ctx, comboID, opp, nil); err != nil {
		t.Fatal(err)
	}
	// 同じ相手技を pruning しても母集合から消えないこと。
	if err := repo.AddPruning(ctx, self, opp, strPtr("届かない")); err != nil {
		t.Fatal(err)
	}

	entries, err := repo.ListPunishEntries(ctx, punish.PunishEntryFilter{SelfCharacterID: self, ExcludeCurated: true})
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 1 || entries[0].ComboID != comboID {
		t.Fatalf("pruning 済み相手技の採用済み反撃が消えた: entries = %+v, want 1 (combo %d)", entries, comboID)
	}
}

func TestRepository_ListPunishEntries_OpponentCharacterFilter(t *testing.T) {
	db := dbtest.Setup(t)
	db.SetMaxOpenConns(1)
	repo := punish.New(db)
	ctx := context.Background()

	self, opp, comboID := setupPunishFixture(t, db, strPtr(model.HitTypePunishCounter))
	if err := repo.AddPunish(ctx, comboID, opp, nil); err != nil {
		t.Fatal(err)
	}
	oppChar := scanInt64(t, db, `SELECT character_id FROM moves WHERE id = ?`, opp)

	match, err := repo.ListPunishEntries(ctx, punish.PunishEntryFilter{SelfCharacterID: self, OpponentCharacterID: &oppChar})
	if err != nil {
		t.Fatal(err)
	}
	if len(match) != 1 {
		t.Errorf("相手キャラ一致の entries = %+v, want 1", match)
	}
	other := oppChar + 9999 // 存在しない相手キャラ id
	miss, _ := repo.ListPunishEntries(ctx, punish.PunishEntryFilter{SelfCharacterID: self, OpponentCharacterID: &other})
	if len(miss) != 0 {
		t.Errorf("相手キャラ不一致の entries = %+v, want empty", miss)
	}
}

func TestRepository_ListPrunings(t *testing.T) {
	db := dbtest.Setup(t)
	repo := punish.New(db)
	ctx := context.Background()

	self := scanInt64(t, db, `SELECT id FROM characters WHERE code='ryu'`)
	opp := scanInt64(t, db, `SELECT m.id FROM moves m JOIN characters c ON c.id=m.character_id WHERE c.code='ryu' AND m.code='hadoken_light'`)

	if err := repo.AddPruning(ctx, self, opp, strPtr("届かない")); err != nil {
		t.Fatal(err)
	}
	ps, err := repo.ListPrunings(ctx, self, nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(ps) != 1 || ps[0].OpponentMoveID != opp {
		t.Fatalf("prunings = %+v, want 1 for move %d", ps, opp)
	}
	if ps[0].OpponentMoveCode != "hadoken_light" || ps[0].OpponentCharacterNameJa == "" {
		t.Errorf("表示用投影が欠けている: %+v", ps[0])
	}
	if ps[0].Note == nil || *ps[0].Note != "届かない" {
		t.Errorf("note = %v, want 届かない", ps[0].Note)
	}
}

// RemovePunish が同一キーの curation を連動削除する(孤児を作らない・指示書 §4.1)。
func TestRepository_RemovePunish_CascadesCuration(t *testing.T) {
	db := dbtest.Setup(t)
	db.SetMaxOpenConns(1)
	repo := punish.New(db)
	ctx := context.Background()

	self, opp, comboID := setupPunishFixture(t, db, strPtr(model.HitTypePunishCounter))
	if err := repo.AddPunish(ctx, comboID, opp, nil); err != nil {
		t.Fatal(err)
	}
	if err := repo.AddCuration(ctx, comboID, opp, nil); err != nil {
		t.Fatal(err)
	}

	if err := repo.RemovePunish(ctx, comboID, opp); err != nil {
		t.Fatalf("remove punish: %v", err)
	}
	if got := scanInt64(t, db, `SELECT count(*) FROM combo_punishes WHERE combo_id=? AND opponent_move_id=?`, comboID, opp); got != 0 {
		t.Errorf("combo_punishes rows = %d, want 0", got)
	}
	if got := scanInt64(t, db, `SELECT count(*) FROM combo_punish_curations WHERE combo_id=? AND opponent_move_id=?`, comboID, opp); got != 0 {
		t.Errorf("curation が孤児として残っている: %d 行", got)
	}
	cs, _ := repo.ListCurations(ctx, self, nil)
	if len(cs) != 0 {
		t.Errorf("ListCurations = %+v, want empty", cs)
	}
}

// 2 文目が失敗したとき両方とも残る(原子性)。curations 表を落として 2 文目を失敗させる。
func TestRepository_RemovePunish_AtomicOnFailure(t *testing.T) {
	db := dbtest.Setup(t)
	db.SetMaxOpenConns(1)
	repo := punish.New(db)
	ctx := context.Background()

	_, opp, comboID := setupPunishFixture(t, db, strPtr(model.HitTypePunishCounter))
	if err := repo.AddPunish(ctx, comboID, opp, nil); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`DROP TABLE combo_punish_curations`); err != nil {
		t.Fatalf("drop curations: %v", err)
	}

	if err := repo.RemovePunish(ctx, comboID, opp); err == nil {
		t.Fatal("RemovePunish がエラーを返さない(2 文目が失敗する状況を作れていない)")
	}
	if got := scanInt64(t, db, `SELECT count(*) FROM combo_punishes WHERE combo_id=? AND opponent_move_id=?`, comboID, opp); got != 1 {
		t.Errorf("ロールバックされていない: combo_punishes rows = %d, want 1", got)
	}
}

func TestRepository_ScanProjectionAndMovementTotals(t *testing.T) {
	db := dbtest.Setup(t)
	repo := punish.New(db)
	ctx := context.Background()

	self := scanInt64(t, db, `SELECT id FROM characters WHERE code='ryu'`)

	moves, err := repo.ListMovesForScan(ctx, self)
	if err != nil {
		t.Fatal(err)
	}
	if len(moves) == 0 {
		t.Fatal("scan returned no moves for ryu")
	}
	var hadoken *punish.ScanMove
	for i := range moves {
		if moves[i].Code == "hadoken_light" {
			hadoken = &moves[i]
			break
		}
	}
	if hadoken == nil {
		t.Fatal("hadoken_light not found in scan projection")
	}
	// 投影に damage / is_projectile が乗っていること(MoveListItem では取れない列)。
	if !hadoken.IsProjectile {
		t.Errorf("hadoken_light.IsProjectile = false, want true")
	}
	if hadoken.Damage == nil {
		t.Errorf("hadoken_light.Damage = nil, want a value")
	}

	// 移動 total: 000041 backfill 適用済み(ryu dash_forward=19 / jump_forward=43)。
	mt, err := repo.GetMovementTotals(ctx, self)
	if err != nil {
		t.Fatal(err)
	}
	if mt.DashForward == nil || *mt.DashForward != 19 {
		t.Errorf("ryu DashForward = %v, want 19", mt.DashForward)
	}
	if mt.JumpForward == nil || *mt.JumpForward != 43 {
		t.Errorf("ryu JumpForward = %v, want 43", mt.JumpForward)
	}
}

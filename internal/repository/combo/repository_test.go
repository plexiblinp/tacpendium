package combo_test

import (
	"context"
	"database/sql"
	"errors"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
	comborepo "github.com/plexiblinp/tacpendium/internal/repository/combo"
	"github.com/plexiblinp/tacpendium/internal/testutil/dbtest"
)

// ===========================================================================
// ヘルパ
// ===========================================================================

func ptrInt(i int) *int       { return &i }
func ptrInt64(i int64) *int64 { return &i }
func ptrStr(s string) *string { return &s }
func ptrBool(b bool) *bool    { return &b }

// validRyuCombo は seed 済みの DB(リュウ character_id=1)に対して挿入可能な
// 最小の本登録コンボを返す。
func validRyuCombo() *model.Combo {
	return &model.Combo{
		CharacterID:    1,
		IsDraft:        false,
		StarterMoveID:  ptrInt64(moveIDByCode(1, "standing_light_punch")),
		Position:       ptrStr("mid_screen"),
		OpponentStance: ptrStr("standing"),
		HitType:        ptrStr("normal"),
		OpponentSize:   ptrStr("standard"),
		Version:        1,
		StepCount:      2,
	}
}

// moveIDByCode はテスト中で seed 済み move を id で参照するための代替値。
// 簡単のため、seed の挿入順依存で固定値を返さず DB から都度引く実装にする。
//
// テスト関数が直接 sql.DB を持たないため、グローバルな lookup は使わず、
// 代わりに各テスト関数で `lookupMoveID(t, db, ...)` を呼ぶ形にする。
// この関数は見た目用の placeholder として 1 を返すだけ(非推奨パス)。
func moveIDByCode(_ int64, _ string) int64 { return 1 }

func lookupMoveID(t *testing.T, db *sql.DB, characterID int64, code string) int64 {
	t.Helper()
	var id int64
	err := db.QueryRow(`SELECT id FROM moves WHERE character_id = ? AND code = ?`, characterID, code).Scan(&id)
	if err != nil {
		t.Fatalf("lookup move id (char=%d code=%s): %v", characterID, code, err)
	}
	return id
}

// withTx はテスト内で短いトランザクションを実行するヘルパ。
func withTx(t *testing.T, db *sql.DB, fn func(tx *sql.Tx)) {
	t.Helper()
	tx, err := db.BeginTx(context.Background(), nil)
	if err != nil {
		t.Fatalf("begin tx: %v", err)
	}
	defer func() {
		_ = tx.Rollback()
	}()
	fn(tx)
	if err := tx.Commit(); err != nil {
		t.Fatalf("commit: %v", err)
	}
}

// ===========================================================================
// InsertCombo + InsertSteps + FindByID(集約モデル)
// ===========================================================================

func TestRepository_InsertAndFindByID(t *testing.T) {
	db := dbtest.Setup(t)
	repo := comborepo.New(db)
	ctx := context.Background()

	move1 := lookupMoveID(t, db, 1, "standing_light_punch")
	move2 := lookupMoveID(t, db, 1, "hadoken_light")

	combo := &model.Combo{
		CharacterID:    1,
		IsDraft:        false,
		StarterMoveID:  ptrInt64(move1),
		Position:       ptrStr("mid_screen"),
		OpponentStance: ptrStr("standing"),
		HitType:        ptrStr("normal"),
		OpponentSize:   ptrStr("standard"),
		Damage:         ptrInt(200),
		Version:        1,
		StepCount:      2,
	}
	steps := []model.ComboStep{
		{StepOrder: 1, MoveID: ptrInt64(move1)},
		{StepOrder: 2, MoveID: ptrInt64(move2), Modifiers: &model.Modifiers{Flags: []string{"just"}}},
	}

	var newID int64
	withTx(t, db, func(tx *sql.Tx) {
		var err error
		newID, err = repo.InsertCombo(ctx, tx, combo)
		if err != nil {
			t.Fatalf("InsertCombo: %v", err)
		}
		if err := repo.InsertSteps(ctx, tx, newID, steps); err != nil {
			t.Fatalf("InsertSteps: %v", err)
		}
	})

	got, err := repo.FindByID(ctx, newID)
	if err != nil {
		t.Fatalf("FindByID: %v", err)
	}

	if got.CharacterID != 1 {
		t.Errorf("CharacterID = %d, want 1", got.CharacterID)
	}
	if got.Damage == nil || *got.Damage != 200 {
		t.Errorf("Damage mismatch: %+v", got.Damage)
	}
	if got.HitType == nil || *got.HitType != "normal" {
		t.Errorf("HitType mismatch: %+v", got.HitType)
	}
	if len(got.Steps) != 2 {
		t.Fatalf("expected 2 steps, got %d", len(got.Steps))
	}
	if got.Steps[0].MoveCode == nil || *got.Steps[0].MoveCode != "standing_light_punch" {
		t.Errorf("step 1 move_code = %v, want standing_light_punch", got.Steps[0].MoveCode)
	}
	if got.Steps[1].Modifiers == nil || len(got.Steps[1].Modifiers.Flags) != 1 {
		t.Errorf("step 2 modifiers should have 1 flag, got: %+v", got.Steps[1].Modifiers)
	}
}

func TestRepository_FindByID_NotFound(t *testing.T) {
	db := dbtest.Setup(t)
	repo := comborepo.New(db)
	_, err := repo.FindByID(context.Background(), 99999)
	if !errors.Is(err, comborepo.ErrNotFound) {
		t.Errorf("expected ErrNotFound, got %v", err)
	}
}

// ===========================================================================
// List(Steps は nil)
// ===========================================================================

func TestRepository_List_StepsNotLoaded(t *testing.T) {
	db := dbtest.Setup(t)
	repo := comborepo.New(db)
	ctx := context.Background()

	move1 := lookupMoveID(t, db, 1, "standing_light_punch")

	withTx(t, db, func(tx *sql.Tx) {
		combo := &model.Combo{
			CharacterID:    1,
			StarterMoveID:  ptrInt64(move1),
			Position:       ptrStr("mid_screen"),
			OpponentStance: ptrStr("standing"),
			HitType:        ptrStr("normal"),
			OpponentSize:   ptrStr("standard"),
			Version:        1,
		}
		id, err := repo.InsertCombo(ctx, tx, combo)
		if err != nil {
			t.Fatal(err)
		}
		if err := repo.InsertSteps(ctx, tx, id, []model.ComboStep{
			{StepOrder: 1, MoveID: ptrInt64(move1)},
		}); err != nil {
			t.Fatal(err)
		}
	})

	got, err := repo.List(ctx, comborepo.ListFilter{CharacterID: ptrInt64(1)})
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(got) == 0 {
		t.Fatal("expected at least 1 result")
	}
	for _, c := range got {
		if c.Steps != nil {
			t.Errorf("List result should have Steps=nil (N+1 prevention), got %d steps", len(c.Steps))
		}
	}
}

// ===========================================================================
// UpdateMetadata + 楽観的排他
// ===========================================================================

func TestRepository_UpdateMetadata_OK(t *testing.T) {
	db := dbtest.Setup(t)
	repo := comborepo.New(db)
	ctx := context.Background()

	move1 := lookupMoveID(t, db, 1, "standing_light_punch")
	var id int64
	withTx(t, db, func(tx *sql.Tx) {
		c := &model.Combo{
			CharacterID:   1,
			StarterMoveID: ptrInt64(move1),
			Position:      ptrStr("mid_screen"),
			Version:       1,
		}
		var err error
		id, err = repo.InsertCombo(ctx, tx, c)
		if err != nil {
			t.Fatal(err)
		}
	})

	withTx(t, db, func(tx *sql.Tx) {
		newVer, err := repo.UpdateMetadata(ctx, tx, id, 1, comborepo.UpdateMetadataInput{
			Memo: comborepo.Some("updated"),
		})
		if err != nil {
			t.Fatalf("UpdateMetadata: %v", err)
		}
		if newVer != 2 {
			t.Errorf("expected new version 2, got %d", newVer)
		}
	})

	got, err := repo.FindByID(ctx, id)
	if err != nil {
		t.Fatal(err)
	}
	if got.Memo == nil || *got.Memo != "updated" {
		t.Errorf("memo not updated: %+v", got.Memo)
	}
	if got.Version != 2 {
		t.Errorf("version = %d, want 2", got.Version)
	}
}

// TestRepository_UpdateMetadata_Situation は CHANGE-041(M11-01)で追加した PATCH 経路の
// situation(custom_states 格納先)永続化を検証する。指示書 §5.1 (16)(17)。
func TestRepository_UpdateMetadata_Situation(t *testing.T) {
	db := dbtest.Setup(t)
	repo := comborepo.New(db)
	ctx := context.Background()

	move1 := lookupMoveID(t, db, 1, "standing_light_punch")
	var id int64
	withTx(t, db, func(tx *sql.Tx) {
		c := &model.Combo{
			CharacterID:   1,
			StarterMoveID: ptrInt64(move1),
			Memo:          ptrStr("orig"),
			Version:       1,
		}
		var err error
		id, err = repo.InsertCombo(ctx, tx, c)
		if err != nil {
			t.Fatal(err)
		}
	})

	// (16) custom_states のみを PATCH で更新 → 再取得で保持される。
	situation := `{"custom_states":{"denjin_charge":true}}`
	withTx(t, db, func(tx *sql.Tx) {
		if _, err := repo.UpdateMetadata(ctx, tx, id, 1, comborepo.UpdateMetadataInput{
			Situation: comborepo.Some(situation),
		}); err != nil {
			t.Fatalf("UpdateMetadata(situation): %v", err)
		}
	})
	got, err := repo.FindByID(ctx, id)
	if err != nil {
		t.Fatal(err)
	}
	if got.Situation == nil || *got.Situation != situation {
		t.Errorf("situation not persisted: %v", got.Situation)
	}

	// (17) situation を指定しない PATCH(memo のみ)では既存 situation が消えない(不在=不変更)。
	withTx(t, db, func(tx *sql.Tx) {
		if _, err := repo.UpdateMetadata(ctx, tx, id, 2, comborepo.UpdateMetadataInput{
			Memo: comborepo.Some("memo-only"),
		}); err != nil {
			t.Fatalf("UpdateMetadata(memo only): %v", err)
		}
	})
	got, err = repo.FindByID(ctx, id)
	if err != nil {
		t.Fatal(err)
	}
	if got.Situation == nil || *got.Situation != situation {
		t.Errorf("situation should be preserved when not specified: %v", got.Situation)
	}
	if got.Memo == nil || *got.Memo != "memo-only" {
		t.Errorf("memo not updated: %v", got.Memo)
	}

	// (18) situation を present+null で PATCH すると NULL にクリアされる(custom_states あり→なし)。
	// CHANGE-043: 空文字 "" センチネルを撤去し、presence-detection の null=クリアへ統一。
	withTx(t, db, func(tx *sql.Tx) {
		if _, err := repo.UpdateMetadata(ctx, tx, id, 3, comborepo.UpdateMetadataInput{
			Situation: comborepo.Null[string](),
		}); err != nil {
			t.Fatalf("UpdateMetadata(situation clear): %v", err)
		}
	})
	got, err = repo.FindByID(ctx, id)
	if err != nil {
		t.Fatal(err)
	}
	if got.Situation != nil {
		t.Errorf("situation should be cleared to NULL by present+null, got: %v", *got.Situation)
	}
}

// TestRepository_UpdateMetadata_Tristate は CHANGE-043 の presence-detection を検証する。
// present+null=NULL クリア / 不在=不変更(温存) / 部分 PATCH(昇格相当)の安全性。指示書 §5.1 (1)〜(7)。
func TestRepository_UpdateMetadata_Tristate(t *testing.T) {
	db := dbtest.Setup(t)
	repo := comborepo.New(db)
	ctx := context.Background()

	move1 := lookupMoveID(t, db, 1, "standing_light_punch")
	var id int64
	situation := `{"custom_states":{"denjin_charge":true}}`
	withTx(t, db, func(tx *sql.Tx) {
		c := &model.Combo{
			CharacterID:   1,
			StarterMoveID: ptrInt64(move1),
			IsDraft:       true,
			Damage:        ptrInt(3000),
			Memo:          ptrStr("orig memo"),
			Situation:     ptrStr(situation),
			Version:       1,
		}
		var err error
		id, err = repo.InsertCombo(ctx, tx, c)
		if err != nil {
			t.Fatal(err)
		}
	})

	// (1)(3)(6) present+null で memo / damage / 起き攻め を NULL クリア(situation は温存=不在)。
	withTx(t, db, func(tx *sql.Tx) {
		if _, err := repo.UpdateMetadata(ctx, tx, id, 1, comborepo.UpdateMetadataInput{
			Memo:   comborepo.Null[string](),
			Damage: comborepo.Null[int](),
		}); err != nil {
			t.Fatalf("UpdateMetadata(clear): %v", err)
		}
	})
	got, err := repo.FindByID(ctx, id)
	if err != nil {
		t.Fatal(err)
	}
	if got.Memo != nil {
		t.Errorf("memo should be NULL, got %v", *got.Memo)
	}
	if got.Damage != nil {
		t.Errorf("damage should be NULL, got %v", *got.Damage)
	}
	// (2)(5) 不在のフィールドは温存される(situation は上の PATCH で不在=不変更)。
	if got.Situation == nil || *got.Situation != situation {
		t.Errorf("situation should be preserved (absent=unchanged), got %v", got.Situation)
	}

	// (7) 部分 PATCH 安全(昇格相当): IsDraft のみ present・他は不在 → 既存メタデータが温存される。
	withTx(t, db, func(tx *sql.Tx) {
		if _, err := repo.UpdateMetadata(ctx, tx, id, 2, comborepo.UpdateMetadataInput{
			IsDraft: ptrBool(false),
		}); err != nil {
			t.Fatalf("UpdateMetadata(promote): %v", err)
		}
	})
	got, err = repo.FindByID(ctx, id)
	if err != nil {
		t.Fatal(err)
	}
	if got.IsDraft {
		t.Error("is_draft should be false after promote")
	}
	if got.Situation == nil || *got.Situation != situation {
		t.Errorf("situation should be preserved through partial PATCH, got %v", got.Situation)
	}
}

// TestRepository_ComboMedia_InsertAndTristate は M17-01 のメディア 3 列
// (link/video_path/image_path)の INSERT/SELECT 追従と、PATCH presence-detection
// トライステート(不在=不変更 / null=NULL クリア / 値=更新)を各列で検証する。指示書 M17-01 §5.1。
func TestRepository_ComboMedia_InsertAndTristate(t *testing.T) {
	db := dbtest.Setup(t)
	repo := comborepo.New(db)
	ctx := context.Background()

	move1 := lookupMoveID(t, db, 1, "standing_light_punch")
	var id int64
	withTx(t, db, func(tx *sql.Tx) {
		c := &model.Combo{
			CharacterID:   1,
			StarterMoveID: ptrInt64(move1),
			Link:          ptrStr("https://example.com/guide"),
			VideoPath:     ptrStr("videos/ryu-bnb.mp4"),
			ImagePath:     ptrStr("images/ryu-bnb.png"),
			Version:       1,
		}
		var err error
		id, err = repo.InsertCombo(ctx, tx, c)
		if err != nil {
			t.Fatal(err)
		}
	})

	// INSERT/SELECT 追従: 3 列とも保存・取得できる。
	got, err := repo.FindByID(ctx, id)
	if err != nil {
		t.Fatal(err)
	}
	if got.Link == nil || *got.Link != "https://example.com/guide" {
		t.Errorf("link not persisted: %v", got.Link)
	}
	if got.VideoPath == nil || *got.VideoPath != "videos/ryu-bnb.mp4" {
		t.Errorf("video_path not persisted: %v", got.VideoPath)
	}
	if got.ImagePath == nil || *got.ImagePath != "images/ryu-bnb.png" {
		t.Errorf("image_path not persisted: %v", got.ImagePath)
	}

	// 値=更新: link のみ更新。不在の video_path/image_path は不変更(温存)。
	withTx(t, db, func(tx *sql.Tx) {
		if _, err := repo.UpdateMetadata(ctx, tx, id, 1, comborepo.UpdateMetadataInput{
			Link: comborepo.Some("https://example.com/updated"),
		}); err != nil {
			t.Fatalf("UpdateMetadata(link update): %v", err)
		}
	})
	got, err = repo.FindByID(ctx, id)
	if err != nil {
		t.Fatal(err)
	}
	if got.Link == nil || *got.Link != "https://example.com/updated" {
		t.Errorf("link not updated: %v", got.Link)
	}
	if got.VideoPath == nil || *got.VideoPath != "videos/ryu-bnb.mp4" {
		t.Errorf("video_path should be preserved (absent=unchanged): %v", got.VideoPath)
	}
	if got.ImagePath == nil || *got.ImagePath != "images/ryu-bnb.png" {
		t.Errorf("image_path should be preserved (absent=unchanged): %v", got.ImagePath)
	}

	// null=クリア: video_path/image_path を present+null で NULL クリア。link は不在=温存。
	withTx(t, db, func(tx *sql.Tx) {
		if _, err := repo.UpdateMetadata(ctx, tx, id, 2, comborepo.UpdateMetadataInput{
			VideoPath: comborepo.Null[string](),
			ImagePath: comborepo.Null[string](),
		}); err != nil {
			t.Fatalf("UpdateMetadata(paths clear): %v", err)
		}
	})
	got, err = repo.FindByID(ctx, id)
	if err != nil {
		t.Fatal(err)
	}
	if got.VideoPath != nil {
		t.Errorf("video_path should be cleared to NULL, got %v", *got.VideoPath)
	}
	if got.ImagePath != nil {
		t.Errorf("image_path should be cleared to NULL, got %v", *got.ImagePath)
	}
	if got.Link == nil || *got.Link != "https://example.com/updated" {
		t.Errorf("link should be preserved (absent=unchanged): %v", got.Link)
	}

	// link も null=クリアできる。
	withTx(t, db, func(tx *sql.Tx) {
		if _, err := repo.UpdateMetadata(ctx, tx, id, 3, comborepo.UpdateMetadataInput{
			Link: comborepo.Null[string](),
		}); err != nil {
			t.Fatalf("UpdateMetadata(link clear): %v", err)
		}
	})
	got, err = repo.FindByID(ctx, id)
	if err != nil {
		t.Fatal(err)
	}
	if got.Link != nil {
		t.Errorf("link should be cleared to NULL, got %v", *got.Link)
	}
}

func TestRepository_UpdateMetadata_VersionConflict(t *testing.T) {
	db := dbtest.Setup(t)
	repo := comborepo.New(db)
	ctx := context.Background()

	move1 := lookupMoveID(t, db, 1, "standing_light_punch")
	var id int64
	withTx(t, db, func(tx *sql.Tx) {
		c := &model.Combo{
			CharacterID:   1,
			StarterMoveID: ptrInt64(move1),
			Version:       1,
		}
		var err error
		id, err = repo.InsertCombo(ctx, tx, c)
		if err != nil {
			t.Fatal(err)
		}
	})

	tx, _ := db.BeginTx(ctx, nil)
	defer tx.Rollback()
	_, err := repo.UpdateMetadata(ctx, tx, id, 99, comborepo.UpdateMetadataInput{
		Memo: comborepo.Some("foo"),
	})
	if !errors.Is(err, comborepo.ErrConflict) {
		t.Errorf("expected ErrConflict, got %v", err)
	}
}

// M22-03 §5.1-8: タグだけを送る PATCH でも combos.version が上がること。
//
// ★集約単位が維持されていることの網である(D-394)。タグ・起き攻めは combos の
// UPDATE では扱わず、サービス層が同一トランザクションで子行を差し替える。
// ⇒ SET 対象が空の UpdateMetadata でも version は +1 されなければならない。
// これが崩れると「タグだけ変えた編集」が他端末の版を失効させず、上書き事故が通る。
func TestRepository_UpdateMetadata_EmptySetStillBumpsVersion(t *testing.T) {
	db := dbtest.Setup(t)
	repo := comborepo.New(db)
	ctx := context.Background()

	move1 := lookupMoveID(t, db, 1, "standing_light_punch")
	var id int64
	withTx(t, db, func(tx *sql.Tx) {
		var err error
		id, err = repo.InsertCombo(ctx, tx, &model.Combo{
			CharacterID:   1,
			StarterMoveID: ptrInt64(move1),
			Version:       1,
		})
		if err != nil {
			t.Fatal(err)
		}
	})

	// SET 対象を 1 つも指定しない = tagIds だけを送る PATCH と同じ形。
	var next int
	withTx(t, db, func(tx *sql.Tx) {
		var err error
		next, err = repo.UpdateMetadata(ctx, tx, id, 1, comborepo.UpdateMetadataInput{})
		if err != nil {
			t.Fatalf("UpdateMetadata(empty set): %v", err)
		}
	})
	if next != 2 {
		t.Errorf("returned version = %d, want 2", next)
	}

	var stored int
	if err := db.QueryRow(`SELECT version FROM combos WHERE id = ?`, id).Scan(&stored); err != nil {
		t.Fatal(err)
	}
	if stored != 2 {
		t.Errorf("combos.version = %d, want 2 (SET 対象が空でも +1 されること)", stored)
	}

	// 古い版はもう通らない(集約の版が実際に失効している)。
	withTx(t, db, func(tx *sql.Tx) {
		if _, err := repo.UpdateMetadata(ctx, tx, id, 1, comborepo.UpdateMetadataInput{}); !errors.Is(err, comborepo.ErrConflict) {
			t.Errorf("stale version: expected ErrConflict, got %v", err)
		}
	})
}

// M22-03 §5.1-9 / §4.5: recipe_cache の更新では combos.version が上がらないこと。
//
// ★「直っていない」ことを固定するのが目的である。次の担当が「updated_at と version
// がずれている = バグだ」と読んで直すのを防ぐ。
//
// as-built(CHANGE-114 §2-e が DES-003 へ明記する): recipe_cache の更新は
// combos.updated_at を進めるが version は進めない。⇒ updated_at が進んでいても
// 版が同じ状態が正常に起こりうる。⇒ updated_at で競合を判定してはならない。
func TestRepository_UpdateRecipeCache_DoesNotBumpVersion(t *testing.T) {
	db := dbtest.Setup(t)
	repo := comborepo.New(db)
	ctx := context.Background()

	move1 := lookupMoveID(t, db, 1, "standing_light_punch")
	var id int64
	withTx(t, db, func(tx *sql.Tx) {
		var err error
		id, err = repo.InsertCombo(ctx, tx, &model.Combo{
			CharacterID:   1,
			StarterMoveID: ptrInt64(move1),
			Version:       1,
		})
		if err != nil {
			t.Fatal(err)
		}
	})

	var beforeVersion int
	var beforeUpdatedAt string
	if err := db.QueryRow(`SELECT version, updated_at FROM combos WHERE id = ?`, id).
		Scan(&beforeVersion, &beforeUpdatedAt); err != nil {
		t.Fatal(err)
	}

	// datetime('now') は秒精度のため、updated_at が進んだことを見るには
	// 1 秒以上ずらす必要がある。ここでは行を過去へ寄せて差を作る。
	if _, err := db.Exec(`UPDATE combos SET updated_at = datetime('now', '-1 hour') WHERE id = ?`, id); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(`SELECT updated_at FROM combos WHERE id = ?`, id).Scan(&beforeUpdatedAt); err != nil {
		t.Fatal(err)
	}

	if err := repo.UpdateRecipeCache(ctx, id, `{"steps":[]}`); err != nil {
		t.Fatalf("UpdateRecipeCache: %v", err)
	}

	var afterVersion int
	var afterUpdatedAt string
	if err := db.QueryRow(`SELECT version, updated_at FROM combos WHERE id = ?`, id).
		Scan(&afterVersion, &afterUpdatedAt); err != nil {
		t.Fatal(err)
	}
	if afterVersion != beforeVersion {
		t.Errorf("combos.version = %d, want %d (キャッシュは排他対象外。上げてはならない)", afterVersion, beforeVersion)
	}
	if afterUpdatedAt == beforeUpdatedAt {
		t.Errorf("combos.updated_at が進んでいない (%q)。非同期の as-built が崩れている", afterUpdatedAt)
	}

	// 版が据え置かれているため、キャッシュ更新の前に取得した版で今も更新できる。
	// ★これが「updated_at が進んでいても版が同じ状態が正常に起こりうる」の実体である。
	withTx(t, db, func(tx *sql.Tx) {
		if _, err := repo.UpdateMetadata(ctx, tx, id, beforeVersion, comborepo.UpdateMetadataInput{}); err != nil {
			t.Errorf("キャッシュ更新後も旧版で更新できるべき: %v", err)
		}
	})
}

// M22-03 §4.5 / §6: recipe_cache の tx 版は version も updated_at も進めないこと。
//
// ★非 tx 版(上のテスト)と挙動が違う。CHANGE-114 が DES-003 へ書く as-built は
// この差まで含むため、設計書へ書いたあとで tx 版に updated_at が足されても
// 誰も気づかない状態にしない。SQL を読めば分かることを、読まなくても分かる形にする。
func TestRepository_UpdateRecipeCacheTx_DoesNotBumpVersionOrUpdatedAt(t *testing.T) {
	db := dbtest.Setup(t)
	repo := comborepo.New(db)
	ctx := context.Background()

	move1 := lookupMoveID(t, db, 1, "standing_light_punch")
	var id int64
	withTx(t, db, func(tx *sql.Tx) {
		var err error
		id, err = repo.InsertCombo(ctx, tx, &model.Combo{
			CharacterID:   1,
			StarterMoveID: ptrInt64(move1),
			Version:       1,
		})
		if err != nil {
			t.Fatal(err)
		}
	})

	// datetime('now') は秒精度のため、行を過去へ寄せて差が出る余地を作る。
	// ★これが無いと「そもそも時刻が動かない」ために緑になり、何も主張しない。
	if _, err := db.Exec(`UPDATE combos SET updated_at = datetime('now', '-1 hour') WHERE id = ?`, id); err != nil {
		t.Fatal(err)
	}
	var beforeVersion int
	var beforeUpdatedAt string
	if err := db.QueryRow(`SELECT version, updated_at FROM combos WHERE id = ?`, id).
		Scan(&beforeVersion, &beforeUpdatedAt); err != nil {
		t.Fatal(err)
	}

	withTx(t, db, func(tx *sql.Tx) {
		if err := repo.UpdateRecipeCacheTx(ctx, tx, id, `{"steps":[]}`); err != nil {
			t.Fatalf("UpdateRecipeCacheTx: %v", err)
		}
	})

	var afterVersion int
	var afterUpdatedAt string
	if err := db.QueryRow(`SELECT version, updated_at FROM combos WHERE id = ?`, id).
		Scan(&afterVersion, &afterUpdatedAt); err != nil {
		t.Fatal(err)
	}
	if afterVersion != beforeVersion {
		t.Errorf("combos.version = %d, want %d (キャッシュは排他対象外)", afterVersion, beforeVersion)
	}
	if afterUpdatedAt != beforeUpdatedAt {
		t.Errorf("combos.updated_at = %q, want %q (tx 版は updated_at を進めない)", afterUpdatedAt, beforeUpdatedAt)
	}

	// ★対照実験: 同じ行に対して非 tx 版を呼ぶと updated_at は進む。
	// これが無いと「そもそも書き込みが効いていない」形の空振りと区別できない。
	if err := repo.UpdateRecipeCache(ctx, id, `{"steps":[]}`); err != nil {
		t.Fatalf("UpdateRecipeCache: %v", err)
	}
	var controlUpdatedAt string
	if err := db.QueryRow(`SELECT updated_at FROM combos WHERE id = ?`, id).Scan(&controlUpdatedAt); err != nil {
		t.Fatal(err)
	}
	if controlUpdatedAt == beforeUpdatedAt {
		t.Errorf("対照が成立していない: 非 tx 版でも updated_at が進んでいない (%q)", controlUpdatedAt)
	}
}

func TestRepository_UpdateMetadata_NotFound(t *testing.T) {
	db := dbtest.Setup(t)
	repo := comborepo.New(db)
	tx, _ := db.BeginTx(context.Background(), nil)
	defer tx.Rollback()
	_, err := repo.UpdateMetadata(context.Background(), tx, 99999, 1, comborepo.UpdateMetadataInput{
		Memo: comborepo.Some("foo"),
	})
	if !errors.Is(err, comborepo.ErrNotFound) {
		t.Errorf("expected ErrNotFound, got %v", err)
	}
}

// ===========================================================================
// SoftDelete + Restore
// ===========================================================================

func TestRepository_SoftDeleteAndRestore(t *testing.T) {
	db := dbtest.Setup(t)
	repo := comborepo.New(db)
	ctx := context.Background()

	move1 := lookupMoveID(t, db, 1, "standing_light_punch")
	var id int64
	withTx(t, db, func(tx *sql.Tx) {
		c := &model.Combo{CharacterID: 1, StarterMoveID: ptrInt64(move1), Version: 1}
		var err error
		id, err = repo.InsertCombo(ctx, tx, c)
		if err != nil {
			t.Fatal(err)
		}
	})

	// SoftDelete
	withTx(t, db, func(tx *sql.Tx) {
		if err := repo.SoftDelete(ctx, tx, id); err != nil {
			t.Fatalf("SoftDelete: %v", err)
		}
	})

	// FindByID は deleted_at IS NULL のみ返すため NotFound になる
	if _, err := repo.FindByID(ctx, id); !errors.Is(err, comborepo.ErrNotFound) {
		t.Errorf("after SoftDelete FindByID should return ErrNotFound, got %v", err)
	}

	// Restore
	withTx(t, db, func(tx *sql.Tx) {
		if err := repo.Restore(ctx, tx, id); err != nil {
			t.Fatalf("Restore: %v", err)
		}
	})

	if _, err := repo.FindByID(ctx, id); err != nil {
		t.Errorf("after Restore FindByID should succeed, got %v", err)
	}
}

// ===========================================================================
// FindActiveByDuplicateKey
// ===========================================================================

func TestRepository_FindActiveByDuplicateKey(t *testing.T) {
	db := dbtest.Setup(t)
	repo := comborepo.New(db)
	ctx := context.Background()

	move1 := lookupMoveID(t, db, 1, "standing_light_punch")
	withTx(t, db, func(tx *sql.Tx) {
		c := &model.Combo{
			CharacterID:    1,
			IsDraft:        false,
			StarterMoveID:  ptrInt64(move1),
			Position:       ptrStr("mid_screen"),
			OpponentStance: ptrStr("standing"),
			HitType:        ptrStr("normal"),
			OpponentSize:   ptrStr("standard"),
			Version:        1,
		}
		_, err := repo.InsertCombo(ctx, tx, c)
		if err != nil {
			t.Fatal(err)
		}
	})

	// 同じキーで検索 → 1 件ヒット
	got, err := repo.FindActiveByDuplicateKey(ctx, nil, comborepo.DuplicateKey{
		CharacterID:    1,
		StarterMoveID:  ptrInt64(move1),
		Position:       ptrStr("mid_screen"),
		OpponentStance: ptrStr("standing"),
		HitType:        ptrStr("normal"),
		OpponentSize:   ptrStr("standard"),
	})
	if err != nil {
		t.Fatalf("FindActiveByDuplicateKey: %v", err)
	}
	if len(got) != 1 {
		t.Errorf("expected 1 candidate, got %d", len(got))
	}

	// 異なるキーで検索 → 0 件
	got2, err := repo.FindActiveByDuplicateKey(ctx, nil, comborepo.DuplicateKey{
		CharacterID:    1,
		StarterMoveID:  ptrInt64(move1),
		Position:       ptrStr("corner_self"),
		OpponentStance: ptrStr("standing"),
		HitType:        ptrStr("normal"),
		OpponentSize:   ptrStr("standard"),
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(got2) != 0 {
		t.Errorf("expected 0 candidates with different position, got %d", len(got2))
	}
}

// TestRepository_FindActiveByDuplicateKey_HitTypeDistinguishes は M18-01(FR301・E-19)を検証する:
// レシピ以外が同一でも hit_type が punish_counter と just_parry_punish_counter で異なれば
// 別コンボ(別の重複キーバケット)として扱われる。dup キーに hit_type が含まれるため改修不要。
func TestRepository_FindActiveByDuplicateKey_HitTypeDistinguishes(t *testing.T) {
	db := dbtest.Setup(t)
	repo := comborepo.New(db)
	ctx := context.Background()

	move1 := lookupMoveID(t, db, 1, "standing_light_punch")
	insert := func(hitType string) {
		withTx(t, db, func(tx *sql.Tx) {
			c := &model.Combo{
				CharacterID:    1,
				IsDraft:        false,
				StarterMoveID:  ptrInt64(move1),
				Position:       ptrStr("mid_screen"),
				OpponentStance: ptrStr("standing"),
				HitType:        ptrStr(hitType),
				OpponentSize:   ptrStr("standard"),
				Version:        1,
			}
			if _, err := repo.InsertCombo(ctx, tx, c); err != nil {
				t.Fatal(err)
			}
		})
	}
	insert("punish_counter")
	insert("just_parry_punish_counter")

	// 各 hit_type で検索 → それぞれ 1 件のみ(別バケット)。
	for _, ht := range []string{"punish_counter", "just_parry_punish_counter"} {
		got, err := repo.FindActiveByDuplicateKey(ctx, nil, comborepo.DuplicateKey{
			CharacterID:    1,
			StarterMoveID:  ptrInt64(move1),
			Position:       ptrStr("mid_screen"),
			OpponentStance: ptrStr("standing"),
			HitType:        ptrStr(ht),
			OpponentSize:   ptrStr("standard"),
		})
		if err != nil {
			t.Fatalf("FindActiveByDuplicateKey(%s): %v", ht, err)
		}
		if len(got) != 1 {
			t.Errorf("hit_type=%s の候補 = %d, want 1(hit_type で別コンボ)", ht, len(got))
		}
		if len(got) == 1 && got[0].HitType != nil && *got[0].HitType != ht {
			t.Errorf("hit_type=%s の候補に別 hit_type=%v が混入", ht, *got[0].HitType)
		}
	}
}

func TestRepository_FindActiveByDuplicateKey_ExcludesDrafts(t *testing.T) {
	db := dbtest.Setup(t)
	repo := comborepo.New(db)
	ctx := context.Background()

	move1 := lookupMoveID(t, db, 1, "standing_light_punch")
	withTx(t, db, func(tx *sql.Tx) {
		// draft コンボを 1 件、published を 0 件投入
		c := &model.Combo{
			CharacterID:    1,
			IsDraft:        true,
			StarterMoveID:  ptrInt64(move1),
			Position:       ptrStr("mid_screen"),
			OpponentStance: ptrStr("standing"),
			HitType:        ptrStr("normal"),
			OpponentSize:   ptrStr("standard"),
			Version:        1,
		}
		_, err := repo.InsertCombo(ctx, tx, c)
		if err != nil {
			t.Fatal(err)
		}
	})

	got, err := repo.FindActiveByDuplicateKey(ctx, nil, comborepo.DuplicateKey{
		CharacterID:    1,
		StarterMoveID:  ptrInt64(move1),
		Position:       ptrStr("mid_screen"),
		OpponentStance: ptrStr("standing"),
		HitType:        ptrStr("normal"),
		OpponentSize:   ptrStr("standard"),
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 0 {
		t.Errorf("draft should not be counted as duplicate candidate, got %d candidates", len(got))
	}
}

// ===========================================================================
// FindStepsForCombos(バルク取得)
// ===========================================================================

func TestRepository_FindStepsForCombos(t *testing.T) {
	db := dbtest.Setup(t)
	repo := comborepo.New(db)
	ctx := context.Background()

	move1 := lookupMoveID(t, db, 1, "standing_light_punch")
	move2 := lookupMoveID(t, db, 1, "hadoken_light")

	var id1, id2 int64
	withTx(t, db, func(tx *sql.Tx) {
		c1 := &model.Combo{CharacterID: 1, StarterMoveID: ptrInt64(move1), Version: 1}
		var err error
		id1, err = repo.InsertCombo(ctx, tx, c1)
		if err != nil {
			t.Fatal(err)
		}
		if err := repo.InsertSteps(ctx, tx, id1, []model.ComboStep{
			{StepOrder: 1, MoveID: ptrInt64(move1)},
			{StepOrder: 2, MoveID: ptrInt64(move2)},
		}); err != nil {
			t.Fatal(err)
		}

		c2 := &model.Combo{CharacterID: 1, StarterMoveID: ptrInt64(move2), Version: 1}
		id2, err = repo.InsertCombo(ctx, tx, c2)
		if err != nil {
			t.Fatal(err)
		}
		if err := repo.InsertSteps(ctx, tx, id2, []model.ComboStep{
			{StepOrder: 1, MoveID: ptrInt64(move2)},
		}); err != nil {
			t.Fatal(err)
		}
	})

	stepsByID, err := repo.FindStepsForCombos(ctx, []int64{id1, id2})
	if err != nil {
		t.Fatal(err)
	}
	if len(stepsByID[id1]) != 2 {
		t.Errorf("combo %d should have 2 steps, got %d", id1, len(stepsByID[id1]))
	}
	if len(stepsByID[id2]) != 1 {
		t.Errorf("combo %d should have 1 step, got %d", id2, len(stepsByID[id2]))
	}
}

// ===========================================================================
// UpdateSetupReferences
// ===========================================================================

func TestRepository_UpdateSetupReferences(t *testing.T) {
	db := dbtest.Setup(t)
	repo := comborepo.New(db)
	ctx := context.Background()

	move1 := lookupMoveID(t, db, 1, "standing_light_punch")
	var oldID, newID int64
	withTx(t, db, func(tx *sql.Tx) {
		c1 := &model.Combo{CharacterID: 1, StarterMoveID: ptrInt64(move1), Version: 1}
		var err error
		oldID, err = repo.InsertCombo(ctx, tx, c1)
		if err != nil {
			t.Fatal(err)
		}
		c2 := &model.Combo{CharacterID: 1, StarterMoveID: ptrInt64(move1), Version: 1}
		newID, err = repo.InsertCombo(ctx, tx, c2)
		if err != nil {
			t.Fatal(err)
		}
	})

	// setups と combo_setups を直接 INSERT(現状のスキーマで)
	_, err := db.ExecContext(ctx,
		`INSERT INTO setups (character_id, name, version) VALUES (?, ?, ?)`, 1, "test", 1)
	if err != nil {
		t.Fatalf("insert setup: %v", err)
	}
	var setupID int64
	if err := db.QueryRow("SELECT last_insert_rowid()").Scan(&setupID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.ExecContext(ctx,
		`INSERT INTO combo_setups (combo_id, setup_id) VALUES (?, ?)`, oldID, setupID); err != nil {
		t.Fatalf("insert combo_setup: %v", err)
	}

	withTx(t, db, func(tx *sql.Tx) {
		if err := repo.UpdateSetupReferences(ctx, tx, oldID, newID); err != nil {
			t.Fatalf("UpdateSetupReferences: %v", err)
		}
	})

	var actualComboID int64
	err = db.QueryRow(`SELECT combo_id FROM combo_setups WHERE setup_id = ?`, setupID).Scan(&actualComboID)
	if err != nil {
		t.Fatal(err)
	}
	if actualComboID != newID {
		t.Errorf("combo_setup.combo_id = %d, want %d (newID)", actualComboID, newID)
	}
}

// ===========================================================================
// List ソート・ページング
// ===========================================================================

func TestRepository_List_SortAndPaging(t *testing.T) {
	db := dbtest.Setup(t)
	repo := comborepo.New(db)
	ctx := context.Background()

	move1 := lookupMoveID(t, db, 1, "standing_light_punch")
	for i := 0; i < 5; i++ {
		dmg := i * 100
		withTx(t, db, func(tx *sql.Tx) {
			c := &model.Combo{
				CharacterID:   1,
				StarterMoveID: ptrInt64(move1),
				Damage:        ptrInt(dmg),
				Version:       1,
			}
			if _, err := repo.InsertCombo(ctx, tx, c); err != nil {
				t.Fatal(err)
			}
		})
	}

	got, err := repo.List(ctx, comborepo.ListFilter{
		CharacterID: ptrInt64(1),
		Sort:        "damage",
		Order:       "desc",
		Limit:       3,
		Offset:      0,
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 3 {
		t.Errorf("expected limit=3, got %d", len(got))
	}
	if len(got) >= 2 {
		if got[0].Damage == nil || got[1].Damage == nil {
			t.Fatal("damage nil unexpected")
		}
		if *got[0].Damage < *got[1].Damage {
			t.Errorf("desc order broken: %d < %d", *got[0].Damage, *got[1].Damage)
		}
	}
}

// ソートキーが全行同値でも、ページを跨いだ結果に重複・欠落が出ないこと(B9)。
// ORDER BY に id 副次キーが無いと同値行の順序が SQL 上未規定になり、
// ページ境界で同じ行が2回出る/1行も出ないケースがあり得る。
func TestRepository_List_StablePagingOnEqualSortKeys(t *testing.T) {
	db := dbtest.Setup(t)
	repo := comborepo.New(db)
	ctx := context.Background()

	move1 := lookupMoveID(t, db, 1, "standing_light_punch")
	const total = 7
	for i := 0; i < total; i++ {
		withTx(t, db, func(tx *sql.Tx) {
			c := &model.Combo{
				CharacterID:   1,
				StarterMoveID: ptrInt64(move1),
				Damage:        ptrInt(1000), // 全行同値
				Version:       1,
			}
			if _, err := repo.InsertCombo(ctx, tx, c); err != nil {
				t.Fatal(err)
			}
		})
	}

	seen := map[int64]int{}
	const pageSize = 3
	for offset := 0; offset < total; offset += pageSize {
		got, err := repo.List(ctx, comborepo.ListFilter{
			CharacterID: ptrInt64(1),
			Sort:        "damage",
			Order:       "desc",
			Limit:       pageSize,
			Offset:      offset,
		})
		if err != nil {
			t.Fatal(err)
		}
		for _, c := range got {
			seen[c.ID]++
		}
	}

	if len(seen) != total {
		t.Errorf("expected %d distinct combos across pages, got %d", total, len(seen))
	}
	for id, n := range seen {
		if n != 1 {
			t.Errorf("combo %d appeared %d times across pages", id, n)
		}
	}
}

func TestRepository_List_FilterByIsDraft(t *testing.T) {
	db := dbtest.Setup(t)
	repo := comborepo.New(db)
	ctx := context.Background()

	move1 := lookupMoveID(t, db, 1, "standing_light_punch")
	withTx(t, db, func(tx *sql.Tx) {
		c1 := &model.Combo{CharacterID: 1, IsDraft: false, StarterMoveID: ptrInt64(move1), Version: 1}
		c2 := &model.Combo{CharacterID: 1, IsDraft: true, StarterMoveID: ptrInt64(move1), Version: 1}
		if _, err := repo.InsertCombo(ctx, tx, c1); err != nil {
			t.Fatal(err)
		}
		if _, err := repo.InsertCombo(ctx, tx, c2); err != nil {
			t.Fatal(err)
		}
	})

	isDraft := false
	published, err := repo.List(ctx, comborepo.ListFilter{CharacterID: ptrInt64(1), IsDraft: &isDraft})
	if err != nil {
		t.Fatal(err)
	}
	for _, c := range published {
		if c.IsDraft {
			t.Errorf("filter is_draft=false returned a draft: id=%d", c.ID)
		}
	}

	isDraft = true
	drafts, err := repo.List(ctx, comborepo.ListFilter{CharacterID: ptrInt64(1), IsDraft: &isDraft})
	if err != nil {
		t.Fatal(err)
	}
	for _, c := range drafts {
		if !c.IsDraft {
			t.Errorf("filter is_draft=true returned a published: id=%d", c.ID)
		}
	}
	if len(drafts) == 0 {
		t.Error("expected at least 1 draft")
	}
}

// ===========================================================================
// M1-04: recipe_cache 操作メソッド
// ===========================================================================

func TestRepository_GetRecipeCache_NullDefault(t *testing.T) {
	db := dbtest.Setup(t)
	repo := comborepo.New(db)
	ctx := context.Background()

	combo := validRyuCombo()
	combo.StarterMoveID = ptrInt64(lookupMoveID(t, db, 1, "standing_light_punch"))
	withTx(t, db, func(tx *sql.Tx) {
		id, err := repo.InsertCombo(ctx, tx, combo)
		if err != nil {
			t.Fatalf("InsertCombo: %v", err)
		}
		combo.ID = id
	})

	cache, err := repo.GetRecipeCache(ctx, combo.ID)
	if err != nil {
		t.Fatalf("GetRecipeCache: %v", err)
	}
	if cache != nil {
		t.Fatalf("expected nil recipe_cache, got %q", *cache)
	}
}

func TestRepository_UpdateRecipeCache(t *testing.T) {
	db := dbtest.Setup(t)
	repo := comborepo.New(db)
	ctx := context.Background()

	combo := validRyuCombo()
	combo.StarterMoveID = ptrInt64(lookupMoveID(t, db, 1, "standing_light_punch"))
	withTx(t, db, func(tx *sql.Tx) {
		id, err := repo.InsertCombo(ctx, tx, combo)
		if err != nil {
			t.Fatalf("InsertCombo: %v", err)
		}
		combo.ID = id
	})

	cacheJSON := `{"1":"立ち弱P > 弱波動拳"}`
	if err := repo.UpdateRecipeCache(ctx, combo.ID, cacheJSON); err != nil {
		t.Fatalf("UpdateRecipeCache: %v", err)
	}

	got, err := repo.GetRecipeCache(ctx, combo.ID)
	if err != nil {
		t.Fatalf("GetRecipeCache: %v", err)
	}
	if got == nil || *got != cacheJSON {
		t.Fatalf("expected %q, got %v", cacheJSON, got)
	}
}

func TestRepository_UpdateRecipeCacheTx(t *testing.T) {
	db := dbtest.Setup(t)
	repo := comborepo.New(db)
	ctx := context.Background()

	combo := validRyuCombo()
	combo.StarterMoveID = ptrInt64(lookupMoveID(t, db, 1, "standing_light_punch"))
	withTx(t, db, func(tx *sql.Tx) {
		id, err := repo.InsertCombo(ctx, tx, combo)
		if err != nil {
			t.Fatalf("InsertCombo: %v", err)
		}
		combo.ID = id
	})

	cacheJSON := `{"1":"test"}`
	withTx(t, db, func(tx *sql.Tx) {
		if err := repo.UpdateRecipeCacheTx(ctx, tx, combo.ID, cacheJSON); err != nil {
			t.Fatalf("UpdateRecipeCacheTx: %v", err)
		}
	})

	got, err := repo.GetRecipeCache(ctx, combo.ID)
	if err != nil {
		t.Fatalf("GetRecipeCache: %v", err)
	}
	if got == nil || *got != cacheJSON {
		t.Fatalf("expected %q, got %v", cacheJSON, got)
	}
}

func TestRepository_SetRecipeCacheNullTx(t *testing.T) {
	db := dbtest.Setup(t)
	repo := comborepo.New(db)
	ctx := context.Background()

	combo := validRyuCombo()
	combo.StarterMoveID = ptrInt64(lookupMoveID(t, db, 1, "standing_light_punch"))
	withTx(t, db, func(tx *sql.Tx) {
		id, err := repo.InsertCombo(ctx, tx, combo)
		if err != nil {
			t.Fatalf("InsertCombo: %v", err)
		}
		combo.ID = id
	})

	if err := repo.UpdateRecipeCache(ctx, combo.ID, `{"1":"test"}`); err != nil {
		t.Fatalf("UpdateRecipeCache: %v", err)
	}

	withTx(t, db, func(tx *sql.Tx) {
		if err := repo.SetRecipeCacheNullTx(ctx, tx, combo.ID); err != nil {
			t.Fatalf("SetRecipeCacheNullTx: %v", err)
		}
	})

	got, err := repo.GetRecipeCache(ctx, combo.ID)
	if err != nil {
		t.Fatalf("GetRecipeCache: %v", err)
	}
	if got != nil {
		t.Fatalf("expected nil, got %q", *got)
	}
}

func TestRepository_ListAllActiveCombos(t *testing.T) {
	db := dbtest.Setup(t)
	repo := comborepo.New(db)
	ctx := context.Background()

	move1 := lookupMoveID(t, db, 1, "standing_light_punch")

	// 2 件作成、1 件を削除
	var id1, id2 int64
	withTx(t, db, func(tx *sql.Tx) {
		combo1 := validRyuCombo()
		combo1.StarterMoveID = ptrInt64(move1)
		var err error
		id1, err = repo.InsertCombo(ctx, tx, combo1)
		if err != nil {
			t.Fatal(err)
		}

		combo2 := validRyuCombo()
		combo2.StarterMoveID = ptrInt64(move1)
		id2, err = repo.InsertCombo(ctx, tx, combo2)
		if err != nil {
			t.Fatal(err)
		}
	})

	withTx(t, db, func(tx *sql.Tx) {
		if err := repo.SoftDelete(ctx, tx, id1); err != nil {
			t.Fatal(err)
		}
	})

	combos, err := repo.ListAllActiveCombosTx(ctx, nil)
	if err != nil {
		t.Fatalf("ListAllActiveCombos: %v", err)
	}
	for _, c := range combos {
		if c.ID == id1 {
			t.Errorf("soft-deleted combo %d should not be in active list", id1)
		}
	}
	found := false
	for _, c := range combos {
		if c.ID == id2 {
			found = true
		}
	}
	if !found {
		t.Errorf("active combo %d not found in list", id2)
	}
}

func TestRepository_FindStepsByComboIDTx(t *testing.T) {
	db := dbtest.Setup(t)
	repo := comborepo.New(db)
	ctx := context.Background()

	move1 := lookupMoveID(t, db, 1, "standing_light_punch")
	move2 := lookupMoveID(t, db, 1, "hadoken_light")

	var comboID int64
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		t.Fatal(err)
	}

	combo := validRyuCombo()
	combo.StarterMoveID = ptrInt64(move1)
	comboID, err = repo.InsertCombo(ctx, tx, combo)
	if err != nil {
		tx.Rollback()
		t.Fatal(err)
	}

	steps := []model.ComboStep{
		{StepOrder: 1, MoveID: ptrInt64(move1)},
		{StepOrder: 2, MoveID: ptrInt64(move2)},
	}
	if err := repo.InsertSteps(ctx, tx, comboID, steps); err != nil {
		tx.Rollback()
		t.Fatal(err)
	}

	// tx 内で steps を読み取り
	got, err := repo.FindStepsByComboIDTx(ctx, tx, comboID)
	if err != nil {
		tx.Rollback()
		t.Fatalf("FindStepsByComboIDTx: %v", err)
	}
	tx.Commit()

	if len(got) != 2 {
		t.Fatalf("expected 2 steps, got %d", len(got))
	}
	if got[0].MoveCode == nil || *got[0].MoveCode != "standing_light_punch" {
		t.Errorf("step[0].MoveCode = %v, want standing_light_punch", got[0].MoveCode)
	}
}

// ===========================================================================
// ReplaceTagAssociations(M3-02)
// ===========================================================================

func insertTestTag(t *testing.T, db *sql.DB, name string) int64 {
	t.Helper()
	res, err := db.Exec(`INSERT INTO tags (user_id, name) VALUES (1, ?)`, name)
	if err != nil {
		t.Fatalf("insert tag %q: %v", name, err)
	}
	id, _ := res.LastInsertId()
	return id
}

func countComboTags(t *testing.T, db *sql.DB, comboID int64) int {
	t.Helper()
	var n int
	if err := db.QueryRow(`SELECT COUNT(*) FROM combo_tags WHERE combo_id = ?`, comboID).Scan(&n); err != nil {
		t.Fatalf("count combo_tags: %v", err)
	}
	return n
}

func TestRepository_ReplaceTagAssociations_EmptyRemovesAll(t *testing.T) {
	db := dbtest.Setup(t)
	repo := comborepo.New(db)
	ctx := context.Background()

	move1 := lookupMoveID(t, db, 1, "standing_light_punch")
	tagID := insertTestTag(t, db, "r-tag1")

	var comboID int64
	withTx(t, db, func(tx *sql.Tx) {
		c := &model.Combo{CharacterID: 1, StarterMoveID: ptrInt64(move1), Version: 1}
		var err error
		comboID, err = repo.InsertCombo(ctx, tx, c)
		if err != nil {
			t.Fatal(err)
		}
		if err := repo.ReplaceTagAssociations(ctx, tx, comboID, 1, []int64{tagID}); err != nil {
			t.Fatalf("ReplaceTagAssociations(set): %v", err)
		}
	})
	if countComboTags(t, db, comboID) != 1 {
		t.Errorf("expected 1 combo_tag after set")
	}

	// 空配列で全削除
	withTx(t, db, func(tx *sql.Tx) {
		if err := repo.ReplaceTagAssociations(ctx, tx, comboID, 1, []int64{}); err != nil {
			t.Fatalf("ReplaceTagAssociations(empty): %v", err)
		}
	})
	if countComboTags(t, db, comboID) != 0 {
		t.Errorf("expected 0 combo_tags after empty replace")
	}
}

func TestRepository_ReplaceTagAssociations_Replace(t *testing.T) {
	db := dbtest.Setup(t)
	repo := comborepo.New(db)
	ctx := context.Background()

	move1 := lookupMoveID(t, db, 1, "standing_light_punch")
	tagID1 := insertTestTag(t, db, "r-tag-a")
	tagID2 := insertTestTag(t, db, "r-tag-b")

	var comboID int64
	withTx(t, db, func(tx *sql.Tx) {
		c := &model.Combo{CharacterID: 1, StarterMoveID: ptrInt64(move1), Version: 1}
		var err error
		comboID, err = repo.InsertCombo(ctx, tx, c)
		if err != nil {
			t.Fatal(err)
		}
		if err := repo.ReplaceTagAssociations(ctx, tx, comboID, 1, []int64{tagID1}); err != nil {
			t.Fatalf("initial set: %v", err)
		}
	})

	withTx(t, db, func(tx *sql.Tx) {
		if err := repo.ReplaceTagAssociations(ctx, tx, comboID, 1, []int64{tagID2}); err != nil {
			t.Fatalf("replace: %v", err)
		}
	})

	if countComboTags(t, db, comboID) != 1 {
		t.Errorf("expected 1 combo_tag after replace")
	}
	var gotTagID int64
	if err := db.QueryRow(`SELECT tag_id FROM combo_tags WHERE combo_id = ?`, comboID).Scan(&gotTagID); err != nil {
		t.Fatal(err)
	}
	if gotTagID != tagID2 {
		t.Errorf("expected tag_id=%d, got %d", tagID2, gotTagID)
	}
}

// ===========================================================================
// List 2クエリ方式でタグが取得できること(M3-02)
// ===========================================================================

func TestRepository_List_TagsMerged(t *testing.T) {
	db := dbtest.Setup(t)
	repo := comborepo.New(db)
	ctx := context.Background()

	move1 := lookupMoveID(t, db, 1, "standing_light_punch")
	tagID1 := insertTestTag(t, db, "l-tag1")
	tagID2 := insertTestTag(t, db, "l-tag2")

	var combo1ID, combo2ID int64
	withTx(t, db, func(tx *sql.Tx) {
		c1 := &model.Combo{CharacterID: 1, StarterMoveID: ptrInt64(move1), Position: ptrStr("mid_screen"), Version: 1}
		var err error
		combo1ID, err = repo.InsertCombo(ctx, tx, c1)
		if err != nil {
			t.Fatal(err)
		}
		if err := repo.ReplaceTagAssociations(ctx, tx, combo1ID, 1, []int64{tagID1, tagID2}); err != nil {
			t.Fatal(err)
		}
		c2 := &model.Combo{CharacterID: 1, StarterMoveID: ptrInt64(move1), Position: ptrStr("corner_self"), Version: 1}
		combo2ID, err = repo.InsertCombo(ctx, tx, c2)
		if err != nil {
			t.Fatal(err)
		}
		// combo2 にはタグなし
	})

	combos, err := repo.List(ctx, comborepo.ListFilter{})
	if err != nil {
		t.Fatalf("List: %v", err)
	}

	var found1, found2 *model.Combo
	for _, c := range combos {
		switch c.ID {
		case combo1ID:
			found1 = c
		case combo2ID:
			found2 = c
		}
	}
	if found1 == nil || found2 == nil {
		t.Fatalf("combos not found in list: combo1=%v combo2=%v", found1, found2)
	}
	if len(found1.Tags) != 2 {
		t.Errorf("combo1 expected 2 tags, got %d: %v", len(found1.Tags), found1.Tags)
	}
	if len(found2.Tags) != 0 {
		t.Errorf("combo2 expected 0 tags, got %d: %v", len(found2.Tags), found2.Tags)
	}
}

// ===========================================================================
// List — StarterMoveCode バッチ取得
// ===========================================================================

func TestRepository_List_StarterMoveCode(t *testing.T) {
	ctx := context.Background()

	t.Run("valid StarterMoveID populates StarterMoveCode", func(t *testing.T) {
		db := dbtest.Setup(t)
		repo := comborepo.New(db)
		move1 := lookupMoveID(t, db, 1, "standing_light_punch")

		var comboID int64
		withTx(t, db, func(tx *sql.Tx) {
			combo := &model.Combo{
				CharacterID:    1,
				StarterMoveID:  ptrInt64(move1),
				Position:       ptrStr("mid_screen"),
				OpponentStance: ptrStr("standing"),
				HitType:        ptrStr("normal"),
				OpponentSize:   ptrStr("standard"),
				Version:        1,
				StepCount:      1,
			}
			id, err := repo.InsertCombo(ctx, tx, combo)
			if err != nil {
				t.Fatalf("InsertCombo: %v", err)
			}
			comboID = id
			if err := repo.InsertSteps(ctx, tx, id, []model.ComboStep{
				{StepOrder: 1, MoveID: ptrInt64(move1)},
			}); err != nil {
				t.Fatalf("InsertSteps: %v", err)
			}
		})

		got, err := repo.List(ctx, comborepo.ListFilter{CharacterID: ptrInt64(1)})
		if err != nil {
			t.Fatalf("List: %v", err)
		}
		var found *model.Combo
		for _, c := range got {
			if c.ID == comboID {
				found = c
				break
			}
		}
		if found == nil {
			t.Fatalf("combo %d not found in List result", comboID)
		}
		if found.StarterMoveCode == nil {
			t.Fatal("StarterMoveCode should be set, got nil")
		}
		if *found.StarterMoveCode != "standing_light_punch" {
			t.Errorf("StarterMoveCode = %q, want %q", *found.StarterMoveCode, "standing_light_punch")
		}

		// ★★M24-07(SM-006 = SM-059): 画面へ出すのは表示名である。
		//   コードだけを返していると、一覧の始動状況が英語の内部コードから始まる。
		//   ⇒ official_ja_move プリセットの alias_text を同じ問い合わせで返すこと。
		if found.StarterMoveNameJa == nil {
			t.Fatal("StarterMoveNameJa should be set (official_ja_move alias), got nil")
		}
		if *found.StarterMoveNameJa != "立ち弱P" {
			t.Errorf("StarterMoveNameJa = %q, want %q", *found.StarterMoveNameJa, "立ち弱P")
		}
	})

	t.Run("nil StarterMoveID keeps StarterMoveCode nil", func(t *testing.T) {
		db := dbtest.Setup(t)
		repo := comborepo.New(db)

		var comboID int64
		withTx(t, db, func(tx *sql.Tx) {
			combo := &model.Combo{
				CharacterID:    1,
				StarterMoveID:  nil,
				Position:       ptrStr("corner_self"),
				OpponentStance: ptrStr("standing"),
				HitType:        ptrStr("normal"),
				OpponentSize:   ptrStr("standard"),
				Version:        1,
				StepCount:      0,
			}
			id, err := repo.InsertCombo(ctx, tx, combo)
			if err != nil {
				t.Fatalf("InsertCombo: %v", err)
			}
			comboID = id
		})

		got, err := repo.List(ctx, comborepo.ListFilter{CharacterID: ptrInt64(1)})
		if err != nil {
			t.Fatalf("List: %v", err)
		}
		var found *model.Combo
		for _, c := range got {
			if c.ID == comboID {
				found = c
				break
			}
		}
		if found == nil {
			t.Fatalf("combo %d not found in List result", comboID)
		}
		if found.StarterMoveCode != nil {
			t.Errorf("StarterMoveCode should be nil for nil StarterMoveID, got %q", *found.StarterMoveCode)
		}
	})
}

// ===========================================================================
// FindByID — StarterMoveCode 補完(M15-05/FB②)
// 比較画面は GET /api/combos/{id}(= FindByID)経由でデータを得るため、List と
// 同様に StarterMoveCode を補完しないと「始動技#<id>」の生 ID 表示になる。
// ===========================================================================

func TestRepository_FindByID_StarterMoveCode(t *testing.T) {
	ctx := context.Background()

	t.Run("valid StarterMoveID populates StarterMoveCode", func(t *testing.T) {
		db := dbtest.Setup(t)
		repo := comborepo.New(db)
		move1 := lookupMoveID(t, db, 1, "standing_light_punch")

		var comboID int64
		withTx(t, db, func(tx *sql.Tx) {
			combo := &model.Combo{
				CharacterID:    1,
				StarterMoveID:  ptrInt64(move1),
				Position:       ptrStr("mid_screen"),
				OpponentStance: ptrStr("standing"),
				HitType:        ptrStr("normal"),
				OpponentSize:   ptrStr("standard"),
				Version:        1,
				StepCount:      1,
			}
			id, err := repo.InsertCombo(ctx, tx, combo)
			if err != nil {
				t.Fatalf("InsertCombo: %v", err)
			}
			comboID = id
			if err := repo.InsertSteps(ctx, tx, id, []model.ComboStep{
				{StepOrder: 1, MoveID: ptrInt64(move1)},
			}); err != nil {
				t.Fatalf("InsertSteps: %v", err)
			}
		})

		found, err := repo.FindByID(ctx, comboID)
		if err != nil {
			t.Fatalf("FindByID: %v", err)
		}
		if found.StarterMoveCode == nil {
			t.Fatal("StarterMoveCode should be set, got nil")
		}
		if *found.StarterMoveCode != "standing_light_punch" {
			t.Errorf("StarterMoveCode = %q, want %q", *found.StarterMoveCode, "standing_light_punch")
		}
	})

	t.Run("nil StarterMoveID keeps StarterMoveCode nil", func(t *testing.T) {
		db := dbtest.Setup(t)
		repo := comborepo.New(db)

		var comboID int64
		withTx(t, db, func(tx *sql.Tx) {
			combo := &model.Combo{
				CharacterID:    1,
				StarterMoveID:  nil,
				Position:       ptrStr("corner_self"),
				OpponentStance: ptrStr("standing"),
				HitType:        ptrStr("normal"),
				OpponentSize:   ptrStr("standard"),
				Version:        1,
				StepCount:      0,
			}
			id, err := repo.InsertCombo(ctx, tx, combo)
			if err != nil {
				t.Fatalf("InsertCombo: %v", err)
			}
			comboID = id
		})

		found, err := repo.FindByID(ctx, comboID)
		if err != nil {
			t.Fatalf("FindByID: %v", err)
		}
		if found.StarterMoveCode != nil {
			t.Errorf("StarterMoveCode should be nil for nil StarterMoveID, got %q", *found.StarterMoveCode)
		}
	})
}

// ===========================================================================
// DeleteComboSetupsByComboID / Excluding / CountComboSetupsByComboID
// ===========================================================================

func insertTestSetupAndLink(t *testing.T, db *sql.DB, comboID int64) int64 {
	t.Helper()
	ctx := context.Background()
	_, err := db.ExecContext(ctx,
		`INSERT INTO setups (character_id, name, version) VALUES (?, ?, ?)`, 1, "test", 1)
	if err != nil {
		t.Fatalf("insert setup: %v", err)
	}
	var setupID int64
	if err := db.QueryRow("SELECT last_insert_rowid()").Scan(&setupID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.ExecContext(ctx,
		`INSERT INTO combo_setups (combo_id, setup_id) VALUES (?, ?)`, comboID, setupID); err != nil {
		t.Fatalf("insert combo_setup: %v", err)
	}
	return setupID
}

func TestRepository_CountComboSetupsByComboID(t *testing.T) {
	db := dbtest.Setup(t)
	repo := comborepo.New(db)
	ctx := context.Background()

	move1 := lookupMoveID(t, db, 1, "standing_light_punch")
	var comboID int64
	withTx(t, db, func(tx *sql.Tx) {
		c := &model.Combo{CharacterID: 1, IsDraft: false, StepCount: 1, Version: 1}
		id, err := repo.InsertCombo(ctx, tx, c)
		if err != nil {
			t.Fatal(err)
		}
		comboID = id
		_ = repo.InsertSteps(ctx, tx, id, []model.ComboStep{{StepOrder: 1, MoveID: &move1}})
	})

	count, err := repo.CountComboSetupsByComboID(ctx, comboID)
	if err != nil {
		t.Fatal(err)
	}
	if count != 0 {
		t.Errorf("count = %d, want 0", count)
	}

	insertTestSetupAndLink(t, db, comboID)
	insertTestSetupAndLink(t, db, comboID)

	count, err = repo.CountComboSetupsByComboID(ctx, comboID)
	if err != nil {
		t.Fatal(err)
	}
	if count != 2 {
		t.Errorf("count = %d, want 2", count)
	}
}

func TestRepository_DeleteComboSetupsByComboID(t *testing.T) {
	db := dbtest.Setup(t)
	repo := comborepo.New(db)
	ctx := context.Background()

	move1 := lookupMoveID(t, db, 1, "standing_light_punch")
	var comboID int64
	withTx(t, db, func(tx *sql.Tx) {
		c := &model.Combo{CharacterID: 1, IsDraft: false, StepCount: 1, Version: 1}
		id, err := repo.InsertCombo(ctx, tx, c)
		if err != nil {
			t.Fatal(err)
		}
		comboID = id
		_ = repo.InsertSteps(ctx, tx, id, []model.ComboStep{{StepOrder: 1, MoveID: &move1}})
	})

	insertTestSetupAndLink(t, db, comboID)
	insertTestSetupAndLink(t, db, comboID)

	withTx(t, db, func(tx *sql.Tx) {
		if err := repo.DeleteComboSetupsByComboID(ctx, tx, comboID); err != nil {
			t.Fatal(err)
		}
	})

	count, err := repo.CountComboSetupsByComboID(ctx, comboID)
	if err != nil {
		t.Fatal(err)
	}
	if count != 0 {
		t.Errorf("count after delete = %d, want 0", count)
	}
}

func TestRepository_DeleteComboSetupsByComboIDExcluding(t *testing.T) {
	db := dbtest.Setup(t)
	repo := comborepo.New(db)
	ctx := context.Background()

	move1 := lookupMoveID(t, db, 1, "standing_light_punch")
	var comboID int64
	withTx(t, db, func(tx *sql.Tx) {
		c := &model.Combo{CharacterID: 1, IsDraft: false, StepCount: 1, Version: 1}
		id, err := repo.InsertCombo(ctx, tx, c)
		if err != nil {
			t.Fatal(err)
		}
		comboID = id
		_ = repo.InsertSteps(ctx, tx, id, []model.ComboStep{{StepOrder: 1, MoveID: &move1}})
	})

	keepID := insertTestSetupAndLink(t, db, comboID)
	insertTestSetupAndLink(t, db, comboID)
	insertTestSetupAndLink(t, db, comboID)

	withTx(t, db, func(tx *sql.Tx) {
		if err := repo.DeleteComboSetupsByComboIDExcluding(ctx, tx, comboID, []int64{keepID}); err != nil {
			t.Fatal(err)
		}
	})

	count, err := repo.CountComboSetupsByComboID(ctx, comboID)
	if err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Errorf("count after excluding delete = %d, want 1", count)
	}

	var remaining int64
	err = db.QueryRow(`SELECT setup_id FROM combo_setups WHERE combo_id = ?`, comboID).Scan(&remaining)
	if err != nil {
		t.Fatal(err)
	}
	if remaining != keepID {
		t.Errorf("remaining setup_id = %d, want %d", remaining, keepID)
	}
}

// TestRepository_OkiOptions_ReplaceAndFind は起き攻めオプション(combo_oki_options・M16-03)の
// 差し替え read/write を検証する。打撃重ね・シミー ドライブラッシュ の新変種保存も含む。
func TestRepository_OkiOptions_ReplaceAndFind(t *testing.T) {
	db := dbtest.Setup(t)
	repo := comborepo.New(db)
	ctx := context.Background()
	move1 := lookupMoveID(t, db, 1, "standing_light_punch")

	var id int64
	withTx(t, db, func(tx *sql.Tx) {
		c := &model.Combo{CharacterID: 1, StarterMoveID: ptrInt64(move1), IsDraft: true, Version: 1}
		var err error
		id, err = repo.InsertCombo(ctx, tx, c)
		if err != nil {
			t.Fatal(err)
		}
	})

	// 新変種(シミー ドライブラッシュ・打撃重ね)を保存できる。
	opts := []model.OkiOption{
		{AttackType: model.OkiAttackTypeShimmy, TechType: model.OkiTechTypeBack, UsesDR: true},
		{AttackType: model.OkiAttackTypeStrikeMeaty, TechType: model.OkiTechTypeNeutral, UsesDR: false},
	}
	withTx(t, db, func(tx *sql.Tx) {
		if err := repo.ReplaceOkiOptions(ctx, tx, id, opts); err != nil {
			t.Fatal(err)
		}
	})

	got, err := repo.FindOkiOptionsByComboID(ctx, id)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 2 {
		t.Fatalf("FindOkiOptionsByComboID want 2, got %d", len(got))
	}

	// FindByID 経由でも注入される。
	combo, err := repo.FindByID(ctx, id)
	if err != nil {
		t.Fatal(err)
	}
	if len(combo.OkiOptions) != 2 {
		t.Fatalf("FindByID oki want 2, got %d", len(combo.OkiOptions))
	}

	// replace-set: 差し替えで既存を全置換。
	withTx(t, db, func(tx *sql.Tx) {
		if err := repo.ReplaceOkiOptions(ctx, tx, id, []model.OkiOption{
			{AttackType: model.OkiAttackTypeThrowMeaty, TechType: model.OkiTechTypeNeutral, UsesDR: false},
		}); err != nil {
			t.Fatal(err)
		}
	})
	got2, err := repo.FindOkiOptionsByComboID(ctx, id)
	if err != nil {
		t.Fatal(err)
	}
	if len(got2) != 1 || got2[0].AttackType != model.OkiAttackTypeThrowMeaty {
		t.Fatalf("after replace want [throw_meaty], got %+v", got2)
	}

	// 空スライスで全解除。
	withTx(t, db, func(tx *sql.Tx) {
		if err := repo.ReplaceOkiOptions(ctx, tx, id, nil); err != nil {
			t.Fatal(err)
		}
	})
	got3, err := repo.FindOkiOptionsByComboID(ctx, id)
	if err != nil {
		t.Fatal(err)
	}
	if len(got3) != 0 {
		t.Fatalf("after clear want 0, got %d", len(got3))
	}
}

// TestList_FilterByHitType_M2701 は hit_type 8 値すべてが **DB へ保存でき、
// 一覧の絞り込みで拾える** ことを見る(指示書 §5 完了条件 6・§2.4-2)。
//
// ★★なぜ値域を回すのか —— 値を 1 つずつ書いたテストは、値が増えたときに
//
//	増えた分を素通しする。model の定数を回せば、次に値を足した担当が
//	ここへ足し忘れてもテストが落ちる(既存の label-keys.test.ts と同じ形)。
//
// ★破壊確認: repository.go の hit_type フィルタ句(`WHERE hit_type = ?`)を外すと、
//
//	「1 件のはずが 8 件」になって赤くなる。
func TestList_FilterByHitType_M2701(t *testing.T) {
	db := dbtest.Setup(t)
	repo := comborepo.New(db)
	ctx := context.Background()
	move1 := lookupMoveID(t, db, 1, "standing_light_punch")

	// ★model の定数を回す。リテラルを再定義しない。
	hitTypes := []string{
		model.HitTypeNormal,
		model.HitTypeCounter,
		model.HitTypePunishCounter,
		model.HitTypeJustParryPunishCounter,
		model.HitTypeDriveImpactWallSplatHit,
		model.HitTypeDriveImpactWallSplatBlock,
		model.HitTypeDriveImpactPunishCounter,
		model.HitTypeStun,
	}
	// 相手サイズ 4 値も一緒に通す。★着手前は large1 / large2 を通す経路が 0 件だった。
	sizes := []string{
		model.OpponentSizeStandard,
		model.OpponentSizeLarge,
		model.OpponentSizeLarge1,
		model.OpponentSizeLarge2,
	}

	for i, ht := range hitTypes {
		size := sizes[i%len(sizes)]
		withTx(t, db, func(tx *sql.Tx) {
			c := &model.Combo{
				CharacterID:    1,
				IsDraft:        false,
				StarterMoveID:  ptrInt64(move1),
				Position:       ptrStr("mid_screen"),
				OpponentStance: ptrStr("standing"),
				HitType:        ptrStr(ht),
				OpponentSize:   ptrStr(size),
				Version:        1,
			}
			if _, err := repo.InsertCombo(ctx, tx, c); err != nil {
				t.Fatalf("InsertCombo(hit_type=%s, opponent_size=%s): %v", ht, size, err)
			}
		})
	}

	for i, ht := range hitTypes {
		wantSize := sizes[i%len(sizes)]
		got, err := repo.List(ctx, comborepo.ListFilter{
			CharacterID: ptrInt64(1),
			HitType:     ptrStr(ht),
		})
		if err != nil {
			t.Fatalf("List(hit_type=%s): %v", ht, err)
		}
		if len(got) != 1 {
			t.Errorf("hit_type=%s の絞り込み結果 = %d 件, want 1", ht, len(got))
			continue
		}
		// ★保存した値がそのまま返ること(往復で失われない)。
		if got[0].HitType == nil || *got[0].HitType != ht {
			t.Errorf("hit_type=%s で拾った行の hit_type = %v", ht, got[0].HitType)
		}
		if got[0].OpponentSize == nil || *got[0].OpponentSize != wantSize {
			t.Errorf("hit_type=%s の行の opponent_size = %v, want %s", ht, got[0].OpponentSize, wantSize)
		}
	}

	// 対照: 絞り込み無しなら全件出る(母数の確認)。
	all, err := repo.List(ctx, comborepo.ListFilter{CharacterID: ptrInt64(1)})
	if err != nil {
		t.Fatalf("List(no filter): %v", err)
	}
	if len(all) != len(hitTypes) {
		t.Errorf("絞り込み無しの件数 = %d, want %d", len(all), len(hitTypes))
	}
}

package combo_test

import (
	"context"
	"database/sql"
	"errors"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
	comborepo "github.com/plexiblinp/tacpendium/internal/repository/combo"
	combosvc "github.com/plexiblinp/tacpendium/internal/service/combo"
)

// ---------------------------------------------------------------------------
// materialize テスト用ヘルパ
// ---------------------------------------------------------------------------

// baseComboInput は Ryu の materialize 対象になる基底コンボ入力を作る。
// 始動技 standing_light_punch(seed damage=300・5 の倍数)。
func baseComboInput(t *testing.T, db *sql.DB) combosvc.CreateInput {
	t.Helper()
	in := validRyuInput(t, db)
	in.Damage = ptr(1000)
	return in
}

func oppMoveID(t *testing.T, db *sql.DB) int64 {
	t.Helper()
	return lookupMoveID(t, db, 1, "hadoken_light")
}

func createBase(t *testing.T, db *sql.DB, svc combosvc.Service, in combosvc.CreateInput) *model.Combo {
	t.Helper()
	saved, result, err := svc.Create(context.Background(), in)
	if err != nil {
		t.Fatalf("create base: %v", err)
	}
	if result.HasError() {
		t.Fatalf("create base validation: %+v", result.Issues)
	}
	return saved
}

func getCombo(t *testing.T, svc combosvc.Service, id int64) *model.Combo {
	t.Helper()
	got, err := svc.Get(context.Background(), id, 1)
	if err != nil {
		t.Fatalf("get combo %d: %v", id, err)
	}
	return got
}

func countPunishes(t *testing.T, db *sql.DB, comboID int64) int {
	t.Helper()
	var n int
	if err := db.QueryRow(`SELECT COUNT(*) FROM combo_punishes WHERE combo_id = ?`, comboID).Scan(&n); err != nil {
		t.Fatalf("count punishes: %v", err)
	}
	return n
}

// ---------------------------------------------------------------------------
// 対象判定(§4.1)
// ---------------------------------------------------------------------------

func TestMaterialize_Normal_AddsStarterDamage(t *testing.T) {
	db, svc := newSvc(t)
	base := createBase(t, db, svc, baseComboInput(t, db))
	opp := oppMoveID(t, db)

	res, _, err := svc.Materialize(context.Background(), combosvc.MaterializeInput{
		UserID:         1,
		BaseComboID:    base.ID,
		OpponentMoveID: opp,
	})
	if err != nil {
		t.Fatalf("materialize: %v", err)
	}
	if res.AlreadyExisted {
		t.Fatal("expected new generation, got AlreadyExisted")
	}
	if !res.DamageAdded || res.DamageSkipReason != "" {
		t.Fatalf("expected damage added, got added=%v reason=%q", res.DamageAdded, res.DamageSkipReason)
	}
	gen := getCombo(t, svc, res.ComboID)
	// 1000 + round(300 * 0.2) = 1000 + 60 = 1060
	if gen.Damage == nil || *gen.Damage != 1060 {
		t.Fatalf("expected damage 1060, got %v", gen.Damage)
	}
	if gen.HitType == nil || *gen.HitType != model.HitTypePunishCounter {
		t.Fatalf("expected hit_type punish_counter, got %v", gen.HitType)
	}
	if gen.MaterializedFromComboID == nil || *gen.MaterializedFromComboID != base.ID {
		t.Fatalf("expected materialized_from=%d, got %v", base.ID, gen.MaterializedFromComboID)
	}
	// combo_punishes が生成物に対して 1 行作られる。
	if got := countPunishes(t, db, gen.ID); got != 1 {
		t.Fatalf("expected 1 combo_punishes row for generated combo, got %d", got)
	}
}

func TestMaterialize_Counter_DamageUnchanged(t *testing.T) {
	db, svc := newSvc(t)
	in := baseComboInput(t, db)
	in.HitType = ptr(model.HitTypeCounter)
	base := createBase(t, db, svc, in)

	res, _, err := svc.Materialize(context.Background(), combosvc.MaterializeInput{
		UserID:      1,
		BaseComboID: base.ID, OpponentMoveID: oppMoveID(t, db),
	})
	if err != nil {
		t.Fatalf("materialize: %v", err)
	}
	if res.DamageAdded {
		t.Fatal("counter: expected damage NOT added (二重計上しない)")
	}
	gen := getCombo(t, svc, res.ComboID)
	if gen.Damage == nil || *gen.Damage != 1000 {
		t.Fatalf("counter: expected damage unchanged 1000, got %v", gen.Damage)
	}
	if gen.HitType == nil || *gen.HitType != model.HitTypePunishCounter {
		t.Fatalf("expected hit_type punish_counter, got %v", gen.HitType)
	}
}

func TestMaterialize_NullHitType_TreatedAsNormal(t *testing.T) {
	db, svc := newSvc(t)
	in := baseComboInput(t, db)
	in.HitType = nil // 区分未設定 = ノーマルヒットとみなす(取りこぼさない)
	base := createBase(t, db, svc, in)

	res, _, err := svc.Materialize(context.Background(), combosvc.MaterializeInput{
		UserID:      1,
		BaseComboID: base.ID, OpponentMoveID: oppMoveID(t, db),
	})
	if err != nil {
		t.Fatalf("materialize: %v", err)
	}
	if !res.DamageAdded {
		t.Fatal("null hit_type: expected treated as normal (damage added)")
	}
	gen := getCombo(t, svc, res.ComboID)
	if gen.Damage == nil || *gen.Damage != 1060 {
		t.Fatalf("expected damage 1060, got %v", gen.Damage)
	}
}

func TestMaterialize_SuperArtsAndCriticalArts_DamageUnchanged(t *testing.T) {
	for _, category := range []string{model.MoveCategorySuperArt, model.MoveCategoryCriticalArt} {
		t.Run(category, func(t *testing.T) {
			db, svc := newSvc(t)
			in := baseComboInput(t, db)
			base := createBase(t, db, svc, in)
			if _, err := db.Exec(`UPDATE moves SET category = ? WHERE id = ?`, category, *base.StarterMoveID); err != nil {
				t.Fatalf("set starter category: %v", err)
			}

			res, _, err := svc.Materialize(context.Background(), combosvc.MaterializeInput{
				UserID:      1,
				BaseComboID: base.ID, OpponentMoveID: oppMoveID(t, db),
			})
			if err != nil {
				t.Fatalf("materialize: %v", err)
			}
			if res.DamageAdded || res.DamageSkipReason != combosvc.MaterializeDamageStarterUnscaled {
				t.Fatalf("expected unscaled skip, got added=%v reason=%q", res.DamageAdded, res.DamageSkipReason)
			}
			gen := getCombo(t, svc, res.ComboID)
			if gen.Damage == nil || *gen.Damage != 1000 {
				t.Fatalf("expected damage unchanged 1000, got %v", gen.Damage)
			}
		})
	}
}

func TestMaterialize_IneligibleHitType_Rejected(t *testing.T) {
	for _, hit := range []string{
		model.HitTypePunishCounter,
		model.HitTypeJustParryPunishCounter,
		// ★M27-01(開発者確定 2026-09-02): 名前上すでにパニッシュカウンターであるため
		//   生成の対象外にした。★対象外判定にだけ足したものであり、タブ分けや
		//   「始動技がインパクトのときだけ使う」制約は別サブの担当である。
		model.HitTypeDriveImpactPunishCounter,
	} {
		t.Run(hit, func(t *testing.T) {
			db, svc := newSvc(t)
			in := baseComboInput(t, db)
			in.HitType = ptr(hit)
			base := createBase(t, db, svc, in)
			before := countCombos(t, db)

			_, _, err := svc.Materialize(context.Background(), combosvc.MaterializeInput{
				UserID:      1,
				BaseComboID: base.ID, OpponentMoveID: oppMoveID(t, db),
			})
			if !errors.Is(err, combosvc.ErrMaterializeIneligibleHitType) {
				t.Fatalf("expected ErrMaterializeIneligibleHitType, got %v", err)
			}
			if after := countCombos(t, db); after != before {
				t.Fatalf("no combo should be generated: before=%d after=%d", before, after)
			}
		})
	}
}

// TestMaterialize_M2701NewHitTypes_Eligible は M27-01 で足した PC 以外の 3 値が
// **生成の対象のまま**であることを見る。
//
// ★★なぜ要るか —— Materialize の対象判定は「対象外リスト」方式であり、
//
//	switch の default は「未知値は取りこぼさず normal 相当で扱う(silent-drop 回避)」
//	となっている。⇒ 値を足しただけでは自動的に安全側へ倒れない。
//	drive_impact_punish_counter を対象外へ足したときに、壁やられ 2 種と stun まで
//	巻き込んで弾いていないことを、ここで押さえる。
//
// ★壁やられ・スタンはパニッシュカウンターではないので、PC 版を作れてよい。
func TestMaterialize_M2701NewHitTypes_Eligible(t *testing.T) {
	for _, hit := range []string{
		model.HitTypeDriveImpactWallSplatHit,
		model.HitTypeDriveImpactWallSplatBlock,
		model.HitTypeStun,
	} {
		t.Run(hit, func(t *testing.T) {
			db, svc := newSvc(t)
			in := baseComboInput(t, db)
			in.HitType = ptr(hit)
			base := createBase(t, db, svc, in)
			before := countCombos(t, db)

			_, _, err := svc.Materialize(context.Background(), combosvc.MaterializeInput{
				UserID:      1,
				BaseComboID: base.ID, OpponentMoveID: oppMoveID(t, db),
			})
			if errors.Is(err, combosvc.ErrMaterializeIneligibleHitType) {
				t.Fatalf("%s は生成の対象であるべきだが対象外として弾かれた", hit)
			}
			if err != nil {
				t.Fatalf("Materialize(%s): %v", hit, err)
			}
			if after := countCombos(t, db); after != before+1 {
				t.Fatalf("生成されていない: before=%d after=%d", before, after)
			}
		})
	}
}

// ---------------------------------------------------------------------------
// ダメージの縁(§4.3・裁定2＝生成を止めず理由を返す)
// ---------------------------------------------------------------------------

func TestMaterialize_DamageEdges(t *testing.T) {
	t.Run("base_damage_null", func(t *testing.T) {
		db, svc := newSvc(t)
		// ★★M31-01 で前提が 1 つ失効した。
		//
		//   旧コメントは「(b) Materialize 自身が生成した行(同関数は
		//   ValidateComboForCreate を通らない)」を、ダメージ NULL の【本登録】が
		//   実在する根拠に挙げていた。**その穴を塞いだ**
		//   (materialize-bypasses-required-fields)。⇒ 本登録の基底がダメージ NULL の
		//   場合、materialize は VAL-C15 で弾くようになり、この分岐へ到達しない。
		//
		//   ★★したがって MaterializeDamageBaseNull の適用面は
		//     **仮登録の基底だけ**に狭まった(VAL-C15 は仮登録を完全スキップするため)。
		//   ⇒ 検証したいのは Materialize のダメージ分岐であって必須化ではないので、
		//     到達可能な唯一の経路である仮登録へ移す。主題は変えていない。
		//   ★本登録側の挙動は materialize_required_fields_test.go が固定している。
		in := baseComboInput(t, db)
		in.IsDraft = true
		in.Damage = nil
		base := createBase(t, db, svc, in)
		res, _, err := svc.Materialize(context.Background(), combosvc.MaterializeInput{
			UserID:      1,
			BaseComboID: base.ID, OpponentMoveID: oppMoveID(t, db),
		})
		if err != nil {
			t.Fatalf("materialize: %v", err)
		}
		if res.DamageAdded || res.DamageSkipReason != combosvc.MaterializeDamageBaseNull {
			t.Fatalf("expected base_damage_null skip, got added=%v reason=%q", res.DamageAdded, res.DamageSkipReason)
		}
		gen := getCombo(t, svc, res.ComboID)
		if gen.Damage != nil {
			t.Fatalf("expected nil damage, got %v", *gen.Damage)
		}
	})

	t.Run("starter_move_not_set", func(t *testing.T) {
		db, svc := newSvc(t)
		in := baseComboInput(t, db)
		in.StarterMoveID = nil
		base := createBase(t, db, svc, in)
		res, _, err := svc.Materialize(context.Background(), combosvc.MaterializeInput{
			UserID:      1,
			BaseComboID: base.ID, OpponentMoveID: oppMoveID(t, db),
		})
		if err != nil {
			t.Fatalf("materialize: %v", err)
		}
		if res.DamageAdded || res.DamageSkipReason != combosvc.MaterializeDamageStarterNotSet {
			t.Fatalf("expected starter_move_not_set skip, got added=%v reason=%q", res.DamageAdded, res.DamageSkipReason)
		}
		gen := getCombo(t, svc, res.ComboID)
		if gen.Damage == nil || *gen.Damage != 1000 {
			t.Fatalf("expected damage unchanged 1000, got %v", gen.Damage)
		}
	})

	t.Run("starter_move_damage_null", func(t *testing.T) {
		db, svc := newSvc(t)
		in := baseComboInput(t, db)
		base := createBase(t, db, svc, in)
		// 始動技の moves.damage を NULL にする(このテスト専用の隔離 DB のみ・moves を汚さない懸念なし)。
		if _, err := db.Exec(`UPDATE moves SET damage = NULL WHERE id = ?`, *base.StarterMoveID); err != nil {
			t.Fatalf("null out starter damage: %v", err)
		}
		res, _, err := svc.Materialize(context.Background(), combosvc.MaterializeInput{
			UserID:      1,
			BaseComboID: base.ID, OpponentMoveID: oppMoveID(t, db),
		})
		if err != nil {
			t.Fatalf("materialize: %v", err)
		}
		if res.DamageAdded || res.DamageSkipReason != combosvc.MaterializeDamageStarterDmgNull {
			t.Fatalf("expected starter_move_damage_null skip, got added=%v reason=%q", res.DamageAdded, res.DamageSkipReason)
		}
		gen := getCombo(t, svc, res.ComboID)
		if gen.Damage == nil || *gen.Damage != 1000 {
			t.Fatalf("expected damage unchanged 1000, got %v", gen.Damage)
		}
	})
}

// ---------------------------------------------------------------------------
// コピー範囲(§4.3・裁定9/10)
// ---------------------------------------------------------------------------

func TestMaterialize_CopyRange(t *testing.T) {
	db, svc := newSvc(t)
	in := baseComboInput(t, db)
	in.IsDraft = true
	in.KnockdownAdvantage = ptr(40)
	in.SAAvailableAtStart = ptr(2)
	in.Memo = ptr("基底メモ")
	in.OkiOptions = []model.OkiOption{
		{AttackType: model.OkiAttackTypeStrikeMeaty, TechType: model.OkiTechTypeNeutral, UsesDR: false},
	}
	// 既存のシード済みタグを 1 件紐づける。
	var tagID int64
	if err := db.QueryRow(`SELECT id FROM tags WHERE user_id = 1 LIMIT 1`).Scan(&tagID); err != nil {
		t.Fatalf("lookup seeded tag: %v", err)
	}
	in.TagIDs = []int64{tagID}
	base := createBase(t, db, svc, in)

	// combo_setups を基底に付与(コピーされないことの検証用)。
	if _, err := db.Exec(`INSERT INTO setups (character_id, name, version) VALUES (1, 'base setup', 1)`); err != nil {
		t.Fatalf("insert setup: %v", err)
	}
	var setupID int64
	if err := db.QueryRow(`SELECT last_insert_rowid()`).Scan(&setupID); err != nil {
		t.Fatalf("last setup id: %v", err)
	}
	if _, err := db.Exec(`INSERT INTO combo_setups (combo_id, setup_id) VALUES (?, ?)`, base.ID, setupID); err != nil {
		t.Fatalf("insert combo_setups: %v", err)
	}

	res, _, err := svc.Materialize(context.Background(), combosvc.MaterializeInput{
		UserID:      1,
		BaseComboID: base.ID, OpponentMoveID: oppMoveID(t, db),
	})
	if err != nil {
		t.Fatalf("materialize: %v", err)
	}
	gen := getCombo(t, svc, res.ComboID)

	if len(gen.Steps) != len(base.Steps) {
		t.Errorf("steps not copied: base=%d gen=%d", len(base.Steps), len(gen.Steps))
	}
	if len(gen.OkiOptions) != 1 {
		t.Errorf("oki options not copied: got %d", len(gen.OkiOptions))
	}
	if gen.KnockdownAdvantage == nil || *gen.KnockdownAdvantage != 40 {
		t.Errorf("knockdown_advantage not copied: %v", gen.KnockdownAdvantage)
	}
	if gen.SAAvailableAtStart == nil || *gen.SAAvailableAtStart != 2 {
		t.Errorf("gauge not copied: %v", gen.SAAvailableAtStart)
	}
	if gen.Memo == nil || *gen.Memo != "基底メモ" {
		t.Errorf("memo not copied: %v", gen.Memo)
	}
	if !gen.IsDraft {
		t.Error("is_draft should be inherited from base (裁定3)")
	}
	// タグがコピーされている。
	var genTags int
	if err := db.QueryRow(`SELECT COUNT(*) FROM combo_tags WHERE combo_id = ?`, gen.ID).Scan(&genTags); err != nil {
		t.Fatalf("count gen tags: %v", err)
	}
	if genTags != 1 {
		t.Errorf("tags not copied: got %d", genTags)
	}
	// combo_setups はコピーされない(別コンボへの紐づけは意味が変わる)。
	var genSetups int
	if err := db.QueryRow(`SELECT COUNT(*) FROM combo_setups WHERE combo_id = ?`, gen.ID).Scan(&genSetups); err != nil {
		t.Fatalf("count gen setups: %v", err)
	}
	if genSetups != 0 {
		t.Errorf("combo_setups must NOT be copied, got %d", genSetups)
	}
}

// ---------------------------------------------------------------------------
// 入力キューの処理(§5.3-A/§1.1・開発者裁定 2026-07-27)
// materialize は基底コンボの採用を解除し、第3セクションから外す(基底コンボ自体は残る)。
// ---------------------------------------------------------------------------

func TestMaterialize_DrainsBaseAdoption(t *testing.T) {
	db, svc := newSvc(t)
	base := createBase(t, db, svc, baseComboInput(t, db))
	opp := oppMoveID(t, db)
	// 基底を採用済みにする(第3セクションに出る状態)＋同キー curation も付ける。
	if _, err := db.Exec(`INSERT INTO combo_punishes (combo_id, opponent_move_id, note) VALUES (?, ?, NULL)`, base.ID, opp); err != nil {
		t.Fatalf("adopt base: %v", err)
	}
	if _, err := db.Exec(`INSERT INTO combo_punish_curations (combo_id, opponent_move_id, note) VALUES (?, ?, NULL)`, base.ID, opp); err != nil {
		t.Fatalf("curate base: %v", err)
	}

	res, _, err := svc.Materialize(context.Background(), combosvc.MaterializeInput{UserID: 1, BaseComboID: base.ID, OpponentMoveID: opp})
	if err != nil {
		t.Fatalf("materialize: %v", err)
	}
	// 基底の採用と curation は解除される。
	if got := countPunishes(t, db, base.ID); got != 0 {
		t.Errorf("base adoption should be drained, got %d rows", got)
	}
	var baseCurations int
	if err := db.QueryRow(`SELECT COUNT(*) FROM combo_punish_curations WHERE combo_id = ?`, base.ID).Scan(&baseCurations); err != nil {
		t.Fatalf("count base curations: %v", err)
	}
	if baseCurations != 0 {
		t.Errorf("base curation should be drained, got %d", baseCurations)
	}
	// 生成物には採用が付く。基底コンボ自体は残る。
	if got := countPunishes(t, db, res.ComboID); got != 1 {
		t.Errorf("generated combo should be adopted, got %d", got)
	}
	if _, err := svc.Get(context.Background(), base.ID, 1); err != nil {
		t.Errorf("base combo itself must remain: %v", err)
	}
}

func TestMaterialize_Drain_NoOpWhenBaseNotAdopted(t *testing.T) {
	// 探す画面の孫ツリー経由(未採用の基底を変換)では解除対象が無く no-op(冪等)。
	db, svc := newSvc(t)
	base := createBase(t, db, svc, baseComboInput(t, db))
	if _, _, err := svc.Materialize(context.Background(), combosvc.MaterializeInput{
		UserID:      1,
		BaseComboID: base.ID, OpponentMoveID: oppMoveID(t, db),
	}); err != nil {
		t.Fatalf("materialize should succeed even when base not adopted: %v", err)
	}
}

// ---------------------------------------------------------------------------
// FR301 重複防止(§4.5)
// ---------------------------------------------------------------------------

func TestMaterialize_FR301_ReturnsExistingID(t *testing.T) {
	db, svc := newSvc(t)
	base := createBase(t, db, svc, baseComboInput(t, db))
	opp := oppMoveID(t, db)

	first, _, err := svc.Materialize(context.Background(), combosvc.MaterializeInput{UserID: 1, BaseComboID: base.ID, OpponentMoveID: opp})
	if err != nil {
		t.Fatalf("materialize 1: %v", err)
	}
	countAfterFirst := countCombos(t, db)

	second, _, err := svc.Materialize(context.Background(), combosvc.MaterializeInput{UserID: 1, BaseComboID: base.ID, OpponentMoveID: opp})
	if err != nil {
		t.Fatalf("materialize 2: %v", err)
	}
	if !second.AlreadyExisted {
		t.Fatal("expected AlreadyExisted on second materialize")
	}
	if second.ComboID != first.ComboID {
		t.Fatalf("expected same combo id, got %d vs %d", second.ComboID, first.ComboID)
	}
	if after := countCombos(t, db); after != countAfterFirst {
		t.Fatalf("no new combo should be generated: %d -> %d", countAfterFirst, after)
	}
}

func TestMaterialize_FR301_NilKeyMatch(t *testing.T) {
	db, svc := newSvc(t)
	in := baseComboInput(t, db)
	// nil 同士の一致を効かせる(starter / position / stance / size を NULL に)。
	in.StarterMoveID = nil
	in.Position = nil
	in.OpponentStance = nil
	in.OpponentSize = nil
	base := createBase(t, db, svc, in)
	opp := oppMoveID(t, db)

	first, _, err := svc.Materialize(context.Background(), combosvc.MaterializeInput{UserID: 1, BaseComboID: base.ID, OpponentMoveID: opp})
	if err != nil {
		t.Fatalf("materialize 1: %v", err)
	}
	second, _, err := svc.Materialize(context.Background(), combosvc.MaterializeInput{UserID: 1, BaseComboID: base.ID, OpponentMoveID: opp})
	if err != nil {
		t.Fatalf("materialize 2: %v", err)
	}
	if !second.AlreadyExisted || second.ComboID != first.ComboID {
		t.Fatalf("nil-key dup not detected: existed=%v id=%d/%d", second.AlreadyExisted, second.ComboID, first.ComboID)
	}
}

// 判定の穴(§4.5-2): 既存 PC 版が仮登録 / ゴミ箱にあると検出されず二重生成される
// (既存の全登録経路と一貫した挙動＝期待値は「生成される」)。
func TestMaterialize_FR301_Holes_Generate(t *testing.T) {
	t.Run("existing_pc_is_draft", func(t *testing.T) {
		db, svc := newSvc(t)
		base := createBase(t, db, svc, baseComboInput(t, db))
		opp := oppMoveID(t, db)
		first, _, err := svc.Materialize(context.Background(), combosvc.MaterializeInput{UserID: 1, BaseComboID: base.ID, OpponentMoveID: opp})
		if err != nil {
			t.Fatalf("materialize 1: %v", err)
		}
		// 既存 PC 版を仮登録に変える → dup SQL(is_draft=0 固定)から外れる。
		if _, err := db.Exec(`UPDATE combos SET is_draft = 1 WHERE id = ?`, first.ComboID); err != nil {
			t.Fatalf("set draft: %v", err)
		}
		second, _, err := svc.Materialize(context.Background(), combosvc.MaterializeInput{UserID: 1, BaseComboID: base.ID, OpponentMoveID: opp})
		if err != nil {
			t.Fatalf("materialize 2: %v", err)
		}
		if second.AlreadyExisted {
			t.Fatal("穴: 仮登録の既存 PC 版は検出されず、生成されるのが既存仕様")
		}
	})

	t.Run("existing_pc_deleted", func(t *testing.T) {
		db, svc := newSvc(t)
		base := createBase(t, db, svc, baseComboInput(t, db))
		opp := oppMoveID(t, db)
		first, _, err := svc.Materialize(context.Background(), combosvc.MaterializeInput{UserID: 1, BaseComboID: base.ID, OpponentMoveID: opp})
		if err != nil {
			t.Fatalf("materialize 1: %v", err)
		}
		if _, err := db.Exec(`UPDATE combos SET deleted_at = datetime('now') WHERE id = ?`, first.ComboID); err != nil {
			t.Fatalf("soft delete: %v", err)
		}
		second, _, err := svc.Materialize(context.Background(), combosvc.MaterializeInput{UserID: 1, BaseComboID: base.ID, OpponentMoveID: opp})
		if err != nil {
			t.Fatalf("materialize 2: %v", err)
		}
		if second.AlreadyExisted {
			t.Fatal("穴: ゴミ箱の既存 PC 版は検出されず、生成されるのが既存仕様")
		}
	})
}

// 基底自身は FR301 で衝突しない(hit_type が normal/counter と punish_counter で異なるため)。
// 初回 materialize が「生成された(既存扱いにならない)」ことで、基底が候補に含まれていない
// ことを明示する(§4.5・レビュー低指摘の明示化)。
func TestMaterialize_FR301_BaseDoesNotCollide(t *testing.T) {
	db, svc := newSvc(t)
	base := createBase(t, db, svc, baseComboInput(t, db))
	res, _, err := svc.Materialize(context.Background(), combosvc.MaterializeInput{
		UserID:      1,
		BaseComboID: base.ID, OpponentMoveID: oppMoveID(t, db),
	})
	if err != nil {
		t.Fatalf("materialize: %v", err)
	}
	if res.AlreadyExisted {
		t.Fatal("基底自身が FR301 の既存候補として誤検出された(hit_type 差で衝突しないはず)")
	}
	if res.ComboID == base.ID {
		t.Fatalf("生成物 id が基底 id と同じ: %d", res.ComboID)
	}
}

// ---------------------------------------------------------------------------
// トランザクション原子性(§4.4)
// ---------------------------------------------------------------------------

// combo_punishes.opponent_move_id は moves(id) への FK(NOT NULL)。存在しない相手技 id を
// 渡すと最後の INSERT が失敗し、combos INSERT ごとロールバックされる(何も残らない)。
func TestMaterialize_Atomic_RollbackOnPunishFailure(t *testing.T) {
	db, svc := newSvc(t)
	base := createBase(t, db, svc, baseComboInput(t, db))
	before := countCombos(t, db)

	_, _, err := svc.Materialize(context.Background(), combosvc.MaterializeInput{
		UserID:         1,
		BaseComboID:    base.ID,
		OpponentMoveID: 999999, // 存在しない move → combo_punishes の FK 違反
	})
	if err == nil {
		t.Fatal("expected error from punish FK violation")
	}
	if after := countCombos(t, db); after != before {
		t.Fatalf("combo must be rolled back: before=%d after=%d", before, after)
	}
}

// ---------------------------------------------------------------------------
// 編集経路での採用引き継ぎ(§4.6・裁定11)
// ---------------------------------------------------------------------------

func TestUpdateWithKeyChange_CarriesPunishAndCuration(t *testing.T) {
	db, svc := newSvc(t)
	base := createBase(t, db, svc, baseComboInput(t, db))
	opp := oppMoveID(t, db)
	// 基底に採用と curation を付与。
	if _, err := db.Exec(`INSERT INTO combo_punishes (combo_id, opponent_move_id, note) VALUES (?, ?, ?)`, base.ID, opp, "採用理由"); err != nil {
		t.Fatalf("insert punish: %v", err)
	}
	if _, err := db.Exec(`INSERT INTO combo_punish_curations (combo_id, opponent_move_id, note) VALUES (?, ?, ?)`, base.ID, opp, nil); err != nil {
		t.Fatalf("insert curation: %v", err)
	}

	// 識別キー変更(position 変更)を伴う編集。
	newInput := baseComboInput(t, db)
	newInput.Position = ptr("corner_self")
	newCombo, result, err := svc.UpdateWithKeyChange(context.Background(), base.ID, base.Version, newInput)
	if err != nil {
		t.Fatalf("update with key change: %v", err)
	}
	if result.HasError() {
		t.Fatalf("unexpected validation: %+v", result.Issues)
	}

	// combo_punishes / combo_punish_curations が新コンボへ移り、旧コンボには残らない。
	var punishComboID int64
	if err := db.QueryRow(`SELECT combo_id FROM combo_punishes WHERE opponent_move_id = ?`, opp).Scan(&punishComboID); err != nil {
		t.Fatalf("query punish: %v", err)
	}
	if punishComboID != newCombo.ID {
		t.Errorf("combo_punishes should move to new combo: got %d want %d", punishComboID, newCombo.ID)
	}
	var curationComboID int64
	if err := db.QueryRow(`SELECT combo_id FROM combo_punish_curations WHERE opponent_move_id = ?`, opp).Scan(&curationComboID); err != nil {
		t.Fatalf("query curation: %v", err)
	}
	if curationComboID != newCombo.ID {
		t.Errorf("combo_punish_curations should move to new combo: got %d want %d", curationComboID, newCombo.ID)
	}
	// note は不変。
	var note string
	if err := db.QueryRow(`SELECT note FROM combo_punishes WHERE combo_id = ?`, newCombo.ID).Scan(&note); err != nil {
		t.Fatalf("query note: %v", err)
	}
	if note != "採用理由" {
		t.Errorf("note should be preserved, got %q", note)
	}
	if got := countPunishes(t, db, base.ID); got != 0 {
		t.Errorf("old combo should have no punish rows, got %d", got)
	}
}

// 識別キーが変わらない編集(PATCH=UpdateMetadata)では採用は動かない(§4.6・§5.1)。
// UpdateWithKeyChange 以外の経路は MovePunishReferences を呼ばないことを明示する。
func TestUpdateMetadata_DoesNotMovePunish(t *testing.T) {
	db, svc := newSvc(t)
	base := createBase(t, db, svc, baseComboInput(t, db))
	opp := oppMoveID(t, db)
	if _, err := db.Exec(`INSERT INTO combo_punishes (combo_id, opponent_move_id, note) VALUES (?, ?, NULL)`, base.ID, opp); err != nil {
		t.Fatalf("adopt: %v", err)
	}

	// メタデータのみ編集(識別キー不変・同一 id)。
	updated, result, err := svc.UpdateMetadata(context.Background(), base.ID, base.Version, combosvc.UpdateMetadataInput{
		Memo: comborepo.Some("メタ編集"),
	})
	if err != nil {
		t.Fatalf("update metadata: %v", err)
	}
	if result.HasError() {
		t.Fatalf("unexpected validation: %+v", result.Issues)
	}
	// id は不変で、採用も同じコンボに残る(移動も消失も起きない)。
	if updated.ID != base.ID {
		t.Fatalf("metadata edit must keep same id: got %d want %d", updated.ID, base.ID)
	}
	if got := countPunishes(t, db, base.ID); got != 1 {
		t.Errorf("adoption must remain on same combo after metadata edit, got %d", got)
	}
}

// 引き継ぎの原子性(§4.6): キー変更編集の途中で失敗すると全体がロールバックし、
// 採用は旧コンボに残ったまま(片方だけ移らない)。ここでは存在しないタグ id で
// tx 後半(ReplaceTagAssociations)を失敗させ、MovePunishReferences の効果も巻き戻ることを見る。
func TestUpdateWithKeyChange_PunishCarryIsAtomic(t *testing.T) {
	db, svc := newSvc(t)
	base := createBase(t, db, svc, baseComboInput(t, db))
	opp := oppMoveID(t, db)
	if _, err := db.Exec(`INSERT INTO combo_punishes (combo_id, opponent_move_id, note) VALUES (?, ?, NULL)`, base.ID, opp); err != nil {
		t.Fatalf("adopt: %v", err)
	}

	newInput := baseComboInput(t, db)
	newInput.Position = ptr("corner_self")
	newInput.TagIDs = []int64{999999} // 存在しないタグ → tx 後半で失敗させる

	_, _, err := svc.UpdateWithKeyChange(context.Background(), base.ID, base.Version, newInput)
	if !errors.Is(err, combosvc.ErrInvalidTagID) {
		t.Fatalf("expected ErrInvalidTagID to trigger rollback, got %v", err)
	}
	// ロールバックされ、旧コンボは有効なまま・採用も旧コンボに残る(片方だけ移っていない)。
	if _, getErr := svc.Get(context.Background(), base.ID, 1); getErr != nil {
		t.Errorf("old combo must remain active after rollback: %v", getErr)
	}
	if got := countPunishes(t, db, base.ID); got != 1 {
		t.Errorf("adoption must stay on old combo after rollback, got %d", got)
	}
}

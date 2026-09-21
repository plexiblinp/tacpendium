package punishfinder

import (
	"context"
	"strings"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
	"github.com/plexiblinp/tacpendium/internal/repository/combo"
	"github.com/plexiblinp/tacpendium/internal/repository/punish"
	"github.com/plexiblinp/tacpendium/internal/testutil/dbtest"
)

func ip(n int) *int { return &n }

func sptr(s string) *string { return &s }

// fakeRepo は punish.Repository のインメモリ実装(境界値を精密に制御するため)。
type fakeRepo struct {
	moves        map[int64][]punish.ScanMove
	totals       map[int64]punish.MovementTotals
	pruned       map[int64]map[int64]bool
	verdicts     map[int64][]punish.StarterVerdict
	adopted      map[int64][]punish.ComboPunishKey
	materialized map[int64]map[int64]bool
	entries      map[int64][]punish.PunishEntry // 自キャラ id → 採用済み確定反撃(表示用投影・M18-03a)

	upsertCalls []punish.StarterVerdict
}

func (f *fakeRepo) ListMovesForScan(_ context.Context, characterID int64) ([]punish.ScanMove, error) {
	return f.moves[characterID], nil
}
func (f *fakeRepo) GetMovementTotals(_ context.Context, characterID int64) (punish.MovementTotals, error) {
	return f.totals[characterID], nil
}
func (f *fakeRepo) ListPrunedMoveIDs(_ context.Context, selfCharacterID int64) (map[int64]bool, error) {
	if f.pruned[selfCharacterID] == nil {
		return map[int64]bool{}, nil
	}
	return f.pruned[selfCharacterID], nil
}
func (f *fakeRepo) ListStarterVerdicts(_ context.Context, selfCharacterID int64) ([]punish.StarterVerdict, error) {
	return f.verdicts[selfCharacterID], nil
}
func (f *fakeRepo) ListAdoptedComboPunishes(_ context.Context, selfCharacterID int64) ([]punish.ComboPunishKey, error) {
	return f.adopted[selfCharacterID], nil
}
func (f *fakeRepo) ListMaterializedBaseComboIDs(_ context.Context, selfCharacterID int64) (map[int64]bool, error) {
	if f.materialized[selfCharacterID] == nil {
		return map[int64]bool{}, nil
	}
	return f.materialized[selfCharacterID], nil
}
func (f *fakeRepo) UpsertStarter(_ context.Context, self, opp, starter int64, verdict string, note *string) error {
	f.upsertCalls = append(f.upsertCalls, punish.StarterVerdict{OpponentMoveID: opp, StarterMoveID: starter, Verdict: verdict, Note: note})
	return nil
}
func (f *fakeRepo) ListPunishEntries(_ context.Context, filter punish.PunishEntryFilter) ([]punish.PunishEntry, error) {
	return f.entries[filter.SelfCharacterID], nil
}
func (f *fakeRepo) ListCurations(context.Context, int64, *int64) ([]punish.CurationEntry, error) {
	return nil, nil
}
func (f *fakeRepo) ListPrunings(context.Context, int64, *int64) ([]punish.PruningEntry, error) {
	return nil, nil
}
func (f *fakeRepo) DeleteStarter(context.Context, int64, int64, int64) error { return nil }
func (f *fakeRepo) AddPunish(context.Context, int64, int64, *string) error   { return nil }
func (f *fakeRepo) RemovePunish(context.Context, int64, int64) error         { return nil }
func (f *fakeRepo) AddPruning(context.Context, int64, int64, *string) error  { return nil }
func (f *fakeRepo) RemovePruning(context.Context, int64, int64) error        { return nil }
func (f *fakeRepo) AddCuration(context.Context, int64, int64, *string) error { return nil }
func (f *fakeRepo) RemoveCuration(context.Context, int64, int64) error       { return nil }

type fakeCombos struct{ byStarter map[int64][]*model.Combo }

func (f fakeCombos) List(_ context.Context, filter combo.ListFilter) ([]*model.Combo, error) {
	out := make([]*model.Combo, 0)
	for _, id := range filter.StarterMoveIDs {
		out = append(out, f.byStarter[id]...)
	}
	return out, nil
}

// laneCount は tree 中で指定始動技 id が指定レーンに現れた回数を数える。
func laneCount(tree *Tree, starterID int64, lane string) int {
	n := 0
	for _, om := range tree.Nodes {
		for _, st := range om.Starters {
			if st.MoveID == starterID && st.Lane == lane {
				n++
			}
		}
	}
	return n
}

func manualReason(tree *Tree, moveID int64) (string, bool) {
	for _, m := range tree.ManualReviewNodes {
		if m.MoveID == moveID {
			return m.ReasonCode, true
		}
	}
	return "", false
}

func shownInAccepted(tree *Tree, moveID int64) bool {
	for _, om := range tree.Nodes {
		if om.MoveID == moveID {
			return true
		}
	}
	return false
}

const (
	self = int64(1)
	oppC = int64(2)
)

// baseSvc は自技 1 本(id=100・startup=5・地上・damage>0)を持つ最小構成。
func baseSvc(oppMoves []punish.ScanMove, totals punish.MovementTotals) (Service, *fakeRepo) {
	repo := &fakeRepo{
		moves: map[int64][]punish.ScanMove{
			self: {{ID: 100, CharacterID: self, Code: "standing_light_punch", Category: "normal", Startup: ip(5), Damage: ip(30)}},
			oppC: oppMoves,
		},
		totals:   map[int64]punish.MovementTotals{self: totals},
		pruned:   map[int64]map[int64]bool{},
		verdicts: map[int64][]punish.StarterVerdict{},
		adopted:  map[int64][]punish.ComboPunishKey{},
	}
	return New(repo, fakeCombos{}, func() int64 { return 1 }), repo
}

func TestScan_GroundBoundary_Block(t *testing.T) {
	// block: adv = -(on_block)。startup(5) == adv 成立 / adv-1 で不成立。
	opp := []punish.ScanMove{{ID: 10, CharacterID: oppC, Code: "hp", Category: "normal", Damage: ip(80), OnBlock: ip(-5)}}
	svc, _ := baseSvc(opp, punish.MovementTotals{})
	tree, err := svc.Scan(context.Background(), ScanParams{self, oppC, model.PunishGuardTypeBlock})
	if err != nil {
		t.Fatal(err)
	}
	if laneCount(tree, 100, model.PunishLaneGround) != 1 {
		t.Errorf("startup==adv should be 成立 (ground lane)")
	}

	// adv = 4(on_block=-4) < startup 5 → 不成立。
	opp2 := []punish.ScanMove{{ID: 10, CharacterID: oppC, Code: "hp", Category: "normal", Damage: ip(80), OnBlock: ip(-4)}}
	svc2, _ := baseSvc(opp2, punish.MovementTotals{})
	tree2, _ := svc2.Scan(context.Background(), ScanParams{self, oppC, model.PunishGuardTypeBlock})
	if laneCount(tree2, 100, model.PunishLaneGround) != 0 {
		t.Errorf("startup==adv+1 should be 不成立")
	}
}

func TestScan_GroundBoundary_JustParry(t *testing.T) {
	// just_parry: adv = recovery。
	opp := []punish.ScanMove{{ID: 10, CharacterID: oppC, Code: "hp", Category: "normal", Damage: ip(80), Recovery: ip(5)}}
	svc, _ := baseSvc(opp, punish.MovementTotals{})
	tree, _ := svc.Scan(context.Background(), ScanParams{self, oppC, model.PunishGuardTypeJustParry})
	if laneCount(tree, 100, model.PunishLaneGround) != 1 {
		t.Errorf("recovery==startup should be 成立")
	}
	opp2 := []punish.ScanMove{{ID: 10, CharacterID: oppC, Code: "hp", Category: "normal", Damage: ip(80), Recovery: ip(4)}}
	svc2, _ := baseSvc(opp2, punish.MovementTotals{})
	tree2, _ := svc2.Scan(context.Background(), ScanParams{self, oppC, model.PunishGuardTypeJustParry})
	if laneCount(tree2, 100, model.PunishLaneGround) != 0 {
		t.Errorf("recovery<startup should be 不成立")
	}
}

func TestScan_ExclusionRules(t *testing.T) {
	// 各除外規則を 1 相手技ずつ用意し、block タブで検証。有利が出る技(adv>0)は on_block=-9。
	opp := []punish.ScanMove{
		{ID: 10, Code: "zero_dmg", Category: "normal", Damage: ip(0), OnBlock: ip(-9)},                       // a: 完全除外
		{ID: 11, Code: "null_dmg", Category: "normal", Damage: nil, OnBlock: ip(-9)},                         // b: unknown_damage
		{ID: 12, Code: "fireball", Category: "special", Damage: ip(60), IsProjectile: true, OnBlock: ip(-9)}, // c: distance_dependent
		{ID: 13, Code: "no_onblock", Category: "normal", Damage: ip(60), OnBlock: nil},                       // d: data_missing(block)
		{ID: 14, Code: "punishable", Category: "normal", Damage: ip(60), OnBlock: ip(-9)},                    // 通常(成立)
	}
	repo := &fakeRepo{
		moves: map[int64][]punish.ScanMove{
			self: {{ID: 100, Code: "slp", Category: "normal", Startup: ip(5), Damage: ip(30)}},
			oppC: opp,
		},
		totals:   map[int64]punish.MovementTotals{self: {}},
		pruned:   map[int64]map[int64]bool{self: {13: false}},
		verdicts: map[int64][]punish.StarterVerdict{},
		adopted:  map[int64][]punish.ComboPunishKey{},
	}
	svc := New(repo, fakeCombos{}, func() int64 { return 1 })
	tree, err := svc.Scan(context.Background(), ScanParams{self, oppC, model.PunishGuardTypeBlock})
	if err != nil {
		t.Fatal(err)
	}

	// a: damage=0 は画面に出ない(成立にも手動確認にも無い)。
	if shownInAccepted(tree, 10) {
		t.Errorf("damage=0 の技が成立レーンに出ている")
	}
	if _, ok := manualReason(tree, 10); ok {
		t.Errorf("damage=0 の技が手動確認レーンに出ている(完全除外のはず)")
	}
	// b: damage NULL は手動確認 unknown_damage(a と区別)。
	if r, _ := manualReason(tree, 11); r != model.PunishReasonUnknownDamage {
		t.Errorf("damage NULL の reason=%q, want unknown_damage", r)
	}
	// c: projectile は distance_dependent。
	if r, _ := manualReason(tree, 12); r != model.PunishReasonDistanceDependent {
		t.Errorf("projectile の reason=%q, want distance_dependent", r)
	}
	// d: on_block NULL(block) は data_missing。
	if r, _ := manualReason(tree, 13); r != model.PunishReasonDataMissing {
		t.Errorf("on_block NULL の reason=%q, want data_missing", r)
	}
	// 通常技は成立レーンに出る。
	if !shownInAccepted(tree, 14) {
		t.Errorf("通常の反撃対象が成立レーンに出ていない")
	}
}

func TestScan_JustParry_RecoveryRules(t *testing.T) {
	opp := []punish.ScanMove{
		{ID: 20, Code: "no_recovery", Category: "normal", Damage: ip(60), Recovery: nil},                          // e: data_missing
		{ID: 21, Code: "zero_recovery", Category: "normal", Damage: ip(60), Recovery: ip(0), IsProjectile: false}, // f: zero_recovery
	}
	repo := &fakeRepo{
		moves: map[int64][]punish.ScanMove{
			self: {{ID: 100, Code: "slp", Category: "normal", Startup: ip(5), Damage: ip(30)}},
			oppC: opp,
		},
		totals: map[int64]punish.MovementTotals{self: {}},
		pruned: map[int64]map[int64]bool{}, verdicts: map[int64][]punish.StarterVerdict{}, adopted: map[int64][]punish.ComboPunishKey{},
	}
	svc := New(repo, fakeCombos{}, func() int64 { return 1 })
	tree, _ := svc.Scan(context.Background(), ScanParams{self, oppC, model.PunishGuardTypeJustParry})
	if r, _ := manualReason(tree, 20); r != model.PunishReasonDataMissing {
		t.Errorf("recovery NULL の reason=%q, want data_missing", r)
	}
	if r, _ := manualReason(tree, 21); r != model.PunishReasonZeroRecovery {
		t.Errorf("recovery=0 の reason=%q, want zero_recovery", r)
	}
}

func TestScan_PrunedExcluded(t *testing.T) {
	opp := []punish.ScanMove{{ID: 30, Code: "hp", Category: "normal", Damage: ip(60), OnBlock: ip(-9)}}
	repo := &fakeRepo{
		moves: map[int64][]punish.ScanMove{
			self: {{ID: 100, Code: "slp", Category: "normal", Startup: ip(5), Damage: ip(30)}},
			oppC: opp,
		},
		totals: map[int64]punish.MovementTotals{self: {}},
		pruned: map[int64]map[int64]bool{self: {30: true}}, verdicts: map[int64][]punish.StarterVerdict{}, adopted: map[int64][]punish.ComboPunishKey{},
	}
	svc := New(repo, fakeCombos{}, func() int64 { return 1 })
	tree, _ := svc.Scan(context.Background(), ScanParams{self, oppC, model.PunishGuardTypeBlock})
	if shownInAccepted(tree, 30) {
		t.Errorf("pruned 済みの相手技が成立レーンに残っている")
	}
	if _, ok := manualReason(tree, 30); ok {
		t.Errorf("pruned 済みは手動確認にも出ないはず(候補から除外)")
	}
}

func TestScan_DashLane_Boundary_And_NullSkip(t *testing.T) {
	// self 始動技 startup=4。dash_forward.total=10。
	self4 := map[int64][]punish.ScanMove{
		self: {{ID: 100, Code: "slp", Category: "normal", Startup: ip(4), Damage: ip(30)}},
	}
	// adv=14(on_block=-14) → slack=4 → dash 成立。
	repo := &fakeRepo{
		moves:  cloneWithOpp(self4, []punish.ScanMove{{ID: 40, Code: "hp", Category: "normal", Damage: ip(60), OnBlock: ip(-14)}}),
		totals: map[int64]punish.MovementTotals{self: {DashForward: ip(10)}},
		pruned: map[int64]map[int64]bool{}, verdicts: map[int64][]punish.StarterVerdict{}, adopted: map[int64][]punish.ComboPunishKey{},
	}
	tree, _ := New(repo, fakeCombos{}, func() int64 { return 1 }).Scan(context.Background(), ScanParams{self, oppC, model.PunishGuardTypeBlock})
	if laneCount(tree, 100, model.PunishLaneDash) != 1 {
		t.Errorf("slack==4 should be dash 成立")
	}

	// adv=13 → slack=3 → dash 不成立。
	repo2 := &fakeRepo{
		moves:  cloneWithOpp(self4, []punish.ScanMove{{ID: 40, Code: "hp", Category: "normal", Damage: ip(60), OnBlock: ip(-13)}}),
		totals: map[int64]punish.MovementTotals{self: {DashForward: ip(10)}},
		pruned: map[int64]map[int64]bool{}, verdicts: map[int64][]punish.StarterVerdict{}, adopted: map[int64][]punish.ComboPunishKey{},
	}
	tree2, _ := New(repo2, fakeCombos{}, func() int64 { return 1 }).Scan(context.Background(), ScanParams{self, oppC, model.PunishGuardTypeBlock})
	if laneCount(tree2, 100, model.PunishLaneDash) != 0 {
		t.Errorf("slack==3 should be dash 不成立")
	}

	// dash_forward.total = NULL → dash レーンごとスキップ(例外にならない)。
	repo3 := &fakeRepo{
		moves:  cloneWithOpp(self4, []punish.ScanMove{{ID: 40, Code: "hp", Category: "normal", Damage: ip(60), OnBlock: ip(-14)}}),
		totals: map[int64]punish.MovementTotals{self: {DashForward: nil}},
		pruned: map[int64]map[int64]bool{}, verdicts: map[int64][]punish.StarterVerdict{}, adopted: map[int64][]punish.ComboPunishKey{},
	}
	tree3, err := New(repo3, fakeCombos{}, func() int64 { return 1 }).Scan(context.Background(), ScanParams{self, oppC, model.PunishGuardTypeBlock})
	if err != nil {
		t.Fatalf("dash total NULL で例外: %v", err)
	}
	if laneCount(tree3, 100, model.PunishLaneDash) != 0 {
		t.Errorf("dash total NULL でも dash レーンが出ている")
	}
}

func TestScan_JumpLane_Boundary_HeavyOnly(t *testing.T) {
	// jump_forward.total=43 → 閾値 adv >= 43-4 = 39。
	selfJump := map[int64][]punish.ScanMove{
		self: {
			{ID: 200, Code: "jumping_heavy_punch", Category: "normal", Startup: ip(9), Damage: ip(80), IsAerial: true},
			{ID: 201, Code: "jumping_medium_punch", Category: "normal", Startup: ip(7), Damage: ip(60), IsAerial: true},
			{ID: 202, Code: "jumping_heavy_kick_grounded_fake", Category: "normal", Startup: ip(9), Damage: ip(80), IsAerial: false}, // is_aerial=false
			{ID: 203, Code: "neutral_jumping_heavy_kick", Category: "normal", Startup: ip(10), Damage: ip(80), IsAerial: true},
			{ID: 204, Code: "unique_jumping_heavy_fake", Category: "unique", Startup: ip(10), Damage: ip(80), IsAerial: true},
		},
	}
	// adv=39 → jump 成立(強攻撃 200 のみ)。
	repo := &fakeRepo{
		moves:  cloneWithOpp(selfJump, []punish.ScanMove{{ID: 50, Code: "hp", Category: "normal", Damage: ip(60), Recovery: ip(39)}}),
		totals: map[int64]punish.MovementTotals{self: {JumpForward: ip(43)}},
		pruned: map[int64]map[int64]bool{}, verdicts: map[int64][]punish.StarterVerdict{}, adopted: map[int64][]punish.ComboPunishKey{},
	}
	tree, _ := New(repo, fakeCombos{}, func() int64 { return 1 }).Scan(context.Background(), ScanParams{self, oppC, model.PunishGuardTypeJustParry})
	if laneCount(tree, 200, model.PunishLaneJump) != 1 {
		t.Errorf("adv==jumpTotal-4 should be jump 成立(強攻撃)")
	}
	if laneCount(tree, 201, model.PunishLaneJump) != 0 {
		t.Errorf("jumping_medium_ が jump レーンに出ている(強攻撃のみのはず)")
	}
	if laneCount(tree, 202, model.PunishLaneJump) != 0 {
		t.Errorf("is_aerial=false が jump レーンに出ている")
	}
	if laneCount(tree, 203, model.PunishLaneJump) != 1 {
		t.Errorf("neutral_jumping_heavy_kick が jump レーンに出ていない")
	}
	if laneCount(tree, 204, model.PunishLaneJump) != 0 {
		t.Errorf("unique 系が jump レーンに出ている")
	}
	// 空中技は地上レーンにも出ない(接地始動レーンから除外)。
	if laneCount(tree, 200, model.PunishLaneGround) != 0 {
		t.Errorf("空中技が地上レーンに出ている(偽陽性)")
	}

	// adv=38 → jump 不成立。
	repo2 := &fakeRepo{
		moves:  cloneWithOpp(selfJump, []punish.ScanMove{{ID: 50, Code: "hp", Category: "normal", Damage: ip(60), Recovery: ip(38)}}),
		totals: map[int64]punish.MovementTotals{self: {JumpForward: ip(43)}},
		pruned: map[int64]map[int64]bool{}, verdicts: map[int64][]punish.StarterVerdict{}, adopted: map[int64][]punish.ComboPunishKey{},
	}
	tree2, _ := New(repo2, fakeCombos{}, func() int64 { return 1 }).Scan(context.Background(), ScanParams{self, oppC, model.PunishGuardTypeJustParry})
	if laneCount(tree2, 200, model.PunishLaneJump) != 0 {
		t.Errorf("adv==jumpTotal-5 should be jump 不成立")
	}

	// jump_forward.total = NULL → jump レーンごとスキップ。
	repo3 := &fakeRepo{
		moves:  cloneWithOpp(selfJump, []punish.ScanMove{{ID: 50, Code: "hp", Category: "normal", Damage: ip(60), Recovery: ip(39)}}),
		totals: map[int64]punish.MovementTotals{self: {JumpForward: nil}},
		pruned: map[int64]map[int64]bool{}, verdicts: map[int64][]punish.StarterVerdict{}, adopted: map[int64][]punish.ComboPunishKey{},
	}
	tree3, err := New(repo3, fakeCombos{}, func() int64 { return 1 }).Scan(context.Background(), ScanParams{self, oppC, model.PunishGuardTypeJustParry})
	if err != nil {
		t.Fatalf("jump total NULL で例外: %v", err)
	}
	if laneCount(tree3, 200, model.PunishLaneJump) != 0 {
		t.Errorf("jump total NULL でも jump レーンが出ている")
	}
}

func TestScan_JumpLane_SeedRegression_ExistingJumpHeavyPlusNeutral(t *testing.T) {
	// migration seed 全体を一次源とする canary。
	// seed 追加・是正時は数字だけを合わせず、案 C の候補差分を再計測して更新する。
	//
	// 2026-07-28 時点: legacy 21 / 案C 23 / unique 空中 7。
	// 2026-07-31(M14-03d・manon 投入)で再計測: manon の jumping_heavy_punch / jumping_heavy_kick が
	//   legacy prefix 候補へ 2 件加わり 21→23、案 C も同じ 2 件のみ増えて 23→25。
	//   増分の内訳(neutral_jumping 2 件)は不変＝manon は neutral_jumping_* を持たない。
	//   unique 系空中技も不変(manon の is_aerial=true は jumping_* 6 件のみで category=normal)。
	// 2026-08-01(M14-03e・6 キャラ投入)で再計測: 通常の jumping_heavy_* が 12 件、
	//   marisa のホールド版が 2 件加わり legacy 23→37、案 C 25→39。
	//   unique 系空中技は rashid 7 件＋marisa 2 件が加わり 7→16。
	// ※ 旧テスト名は Existing21PlusNeutral2 だったが、seed 追加のたびに名前が実態とずれるため
	//   数字を名前から外した(判定値は下記 const が正)。
	// 2026-09-02(M14-03f・第四波 14 キャラ投入)で再計測: legacy 37→65 / 案 C 39→71 /
	//   unique 系空中技 16→32。案 C の増分の内訳は neutral_jumping_heavy_* が 2→6 件
	//   (blanka / c_viper / chun_li / e_honda / juri / ken)。
	//   ★キャラが 19 → 31 になったことによる増分であり、
	//   規則の変更ではない(下の「従来候補が案 C で消えていない」主張が守っている)。
	const (
		wantLegacyJumpHeavy = 65
		wantOptionC         = 71
		wantUniqueAerial    = 32
	)

	db := dbtest.Setup(t)
	repo := punish.New(db)
	ctx := context.Background()

	rows, err := db.Query(`SELECT id, code FROM characters WHERE EXISTS (
		SELECT 1 FROM moves WHERE moves.character_id = characters.id
	) ORDER BY id`)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()

	type character struct {
		id   int64
		code string
	}
	var characters []character
	for rows.Next() {
		var c character
		if err := rows.Scan(&c.id, &c.code); err != nil {
			t.Fatal(err)
		}
		characters = append(characters, c)
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}

	oldCandidates := make(map[string]bool)
	newCandidates := make(map[string]bool)
	uniqueAerial := make(map[string]bool)
	svc := &service{}
	for _, c := range characters {
		moves, err := repo.ListMovesForScan(ctx, c.id)
		if err != nil {
			t.Fatalf("%s: list moves: %v", c.code, err)
		}
		for _, move := range moves {
			key := c.code + "/" + move.Code
			if move.IsAerial && strings.HasPrefix(move.Code, "jumping_heavy_") {
				oldCandidates[key] = true
			}
			if move.IsAerial && move.Category == model.MoveCategoryUnique {
				uniqueAerial[key] = true
			}
		}
		nodes := svc.buildStarters(
			moves,
			1000,
			punish.MovementTotals{JumpForward: ip(1)},
			1,
			nil,
		)
		for _, node := range nodes {
			if node.Lane == model.PunishLaneJump {
				newCandidates[c.code+"/"+node.Code] = true
			}
		}
	}

	if len(oldCandidates) != wantLegacyJumpHeavy {
		t.Fatalf("従来 prefix 候補 = %d 件, want %d: %v", len(oldCandidates), wantLegacyJumpHeavy, oldCandidates)
	}
	for key := range oldCandidates {
		if !newCandidates[key] {
			t.Errorf("従来候補が案 C で消えた: %s", key)
		}
	}
	if len(newCandidates) != wantOptionC {
		t.Fatalf("案 C 候補 = %d 件, want %d: %v", len(newCandidates), wantOptionC, newCandidates)
	}
	additions := make(map[string]bool)
	for key := range newCandidates {
		if !oldCandidates[key] {
			additions[key] = true
		}
	}
	// ★案 C が prefix 方式に上乗せする分＝neutral_jumping_heavy_*。
	//   M14-03f(第四波)で 2 件 → 6 件になった(blanka / c_viper / chun_li / e_honda が追加)。
	//   ★列挙で固定する。件数だけだと「別の技が入れ替わりで増えた」を検出できない。
	for _, key := range []string{
		"juri/neutral_jumping_heavy_kick",
		"ken/neutral_jumping_heavy_kick",
		"blanka/neutral_jumping_heavy_punch",
		"c_viper/neutral_jumping_heavy_kick",
		"chun_li/neutral_jumping_heavy_kick",
		"e_honda/neutral_jumping_heavy_punch",
	} {
		if !additions[key] {
			t.Errorf("案 C の増分に %s が無い: %v", key, additions)
		}
		delete(additions, key)
	}
	if len(additions) != 0 {
		t.Errorf("案 C に想定外の増分: %v", additions)
	}
	if len(uniqueAerial) != wantUniqueAerial {
		t.Fatalf("unique 系空中技 = %d 件, want %d: %v", len(uniqueAerial), wantUniqueAerial, uniqueAerial)
	}
	for key := range uniqueAerial {
		if newCandidates[key] {
			t.Errorf("unique 系空中技が案 C 候補へ混入: %s", key)
		}
	}
}

func TestScan_CharacterIndependent(t *testing.T) {
	// 2 マッチアップ(self→oppC と self3→opp4)で同一ロジックが働く(E-15)。
	mk := func(selfID, oppID int64, startup, onBlock int) *Tree {
		repo := &fakeRepo{
			moves: map[int64][]punish.ScanMove{
				selfID: {{ID: 100, Code: "slp", Category: "normal", Startup: ip(startup), Damage: ip(30)}},
				oppID:  {{ID: 10, Code: "hp", Category: "normal", Damage: ip(60), OnBlock: ip(onBlock)}},
			},
			totals: map[int64]punish.MovementTotals{selfID: {}},
			pruned: map[int64]map[int64]bool{}, verdicts: map[int64][]punish.StarterVerdict{}, adopted: map[int64][]punish.ComboPunishKey{},
		}
		tree, _ := New(repo, fakeCombos{}, func() int64 { return 1 }).Scan(context.Background(), ScanParams{selfID, oppID, model.PunishGuardTypeBlock})
		return tree
	}
	a := mk(1, 2, 5, -6) // adv=6 >= startup 5 → 成立
	b := mk(3, 4, 5, -6)
	if laneCount(a, 100, model.PunishLaneGround) != 1 || laneCount(b, 100, model.PunishLaneGround) != 1 {
		t.Errorf("同一ロジックが 2 マッチアップで一致しない(キャラ非依存でない)")
	}
}

func TestScan_CombosAttachedWithAdopted(t *testing.T) {
	opp := []punish.ScanMove{{ID: 10, Code: "hp", Category: "normal", Damage: ip(60), OnBlock: ip(-9)}}
	combos := fakeCombos{byStarter: map[int64][]*model.Combo{
		100: {
			{ID: 500, StarterMoveID: ip64(100), Damage: ip(2500), StepCount: 4},
			{ID: 501, StarterMoveID: ip64(100), Damage: ip(1800), StepCount: 3},
		},
	}}
	repo := &fakeRepo{
		moves: map[int64][]punish.ScanMove{
			self: {{ID: 100, Code: "slp", Category: "normal", Startup: ip(5), Damage: ip(30)}},
			oppC: opp,
		},
		totals:       map[int64]punish.MovementTotals{self: {}},
		pruned:       map[int64]map[int64]bool{},
		verdicts:     map[int64][]punish.StarterVerdict{},
		adopted:      map[int64][]punish.ComboPunishKey{self: {{ComboID: 500, OpponentMoveID: 10}}},
		materialized: map[int64]map[int64]bool{self: {500: true}},
	}
	tree, _ := New(repo, combos, func() int64 { return 1 }).Scan(context.Background(), ScanParams{self, oppC, model.PunishGuardTypeBlock})
	if len(tree.Nodes) != 1 || len(tree.Nodes[0].Starters) != 1 {
		t.Fatalf("成立ノード構造が不正: %+v", tree.Nodes)
	}
	st := tree.Nodes[0].Starters[0]
	if len(st.Combos) != 2 {
		t.Fatalf("孫コンボ数 = %d, want 2", len(st.Combos))
	}
	// 500 は採用済み、501 は未採用。
	var c500, c501 *ComboNode
	for i := range st.Combos {
		switch st.Combos[i].ComboID {
		case 500:
			c500 = &st.Combos[i]
		case 501:
			c501 = &st.Combos[i]
		}
	}
	if c500 == nil || !c500.Adopted {
		t.Errorf("combo 500 は adopted のはず")
	}
	if c500 == nil || !c500.HasMaterializedVersion {
		t.Errorf("combo 500 は materialize 生成物ありのはず")
	}
	if c501 == nil || c501.Adopted {
		t.Errorf("combo 501 は未採用のはず")
	}
	if c501 == nil || c501.HasMaterializedVersion {
		t.Errorf("combo 501 は materialize 生成物なしのはず")
	}
}

func TestScan_MaterializedFlagDoesNotDependOnOpponentMove(t *testing.T) {
	db := dbtest.Setup(t)
	db.SetMaxOpenConns(1)
	ctx := context.Background()
	punishRepo := punish.New(db)

	var selfID, starterID int64
	if err := db.QueryRow(`SELECT id FROM characters WHERE code='ryu'`).Scan(&selfID); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(
		`SELECT id FROM moves WHERE character_id=? AND code='standing_light_punch'`,
		selfID,
	).Scan(&starterID); err != nil {
		t.Fatal(err)
	}

	rows, err := db.Query(
		`SELECT id FROM moves
		 WHERE character_id=?
		   AND code LIKE 'standing_%'
		   AND damage > 0
		   AND is_aerial=0
		   AND recovery IS NOT NULL
		 ORDER BY id
		 LIMIT 2`,
		selfID,
	)
	if err != nil {
		t.Fatal(err)
	}
	var opponentMoveIDs []int64
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			rows.Close()
			t.Fatal(err)
		}
		opponentMoveIDs = append(opponentMoveIDs, id)
	}
	if err := rows.Close(); err != nil {
		t.Fatal(err)
	}
	if len(opponentMoveIDs) != 2 {
		t.Fatalf("相手技 fixture = %d 件, want 2", len(opponentMoveIDs))
	}
	opponentMoveA, opponentMoveB := opponentMoveIDs[0], opponentMoveIDs[1]

	res, err := db.Exec(
		`INSERT INTO combos(character_id, starter_move_id, hit_type) VALUES(?,?,?)`,
		selfID,
		starterID,
		model.HitTypeNormal,
	)
	if err != nil {
		t.Fatal(err)
	}
	baseComboID, _ := res.LastInsertId()
	if _, err := db.Exec(
		`INSERT INTO combos(character_id, starter_move_id, hit_type, materialized_from_combo_id)
		 VALUES(?,?,?,?)`,
		selfID,
		starterID,
		model.HitTypePunishCounter,
		baseComboID,
	); err != nil {
		t.Fatal(err)
	}
	if err := punishRepo.AddPunish(ctx, baseComboID, opponentMoveA, nil); err != nil {
		t.Fatal(err)
	}

	tree, err := New(punishRepo, combo.New(db), func() int64 { return 1 }).Scan(ctx, ScanParams{
		SelfCharacterID:     selfID,
		OpponentCharacterID: selfID,
		GuardType:           model.PunishGuardTypeJustParry,
	})
	if err != nil {
		t.Fatal(err)
	}

	foundOnB := false
	for _, opponent := range tree.Nodes {
		if opponent.MoveID != opponentMoveB {
			continue
		}
		for _, starter := range opponent.Starters {
			for _, candidate := range starter.Combos {
				if candidate.ComboID == baseComboID && candidate.HasMaterializedVersion {
					foundOnB = true
				}
			}
		}
	}
	if !foundOnB {
		t.Fatalf(
			"相手技 A(%d) で採用・変換した基底 %d が相手技 B(%d) で materialized 扱いにならない",
			opponentMoveA,
			baseComboID,
			opponentMoveB,
		)
	}
}

func TestScan_VerdictAttached(t *testing.T) {
	opp := []punish.ScanMove{{ID: 10, Code: "hp", Category: "normal", Damage: ip(60), OnBlock: ip(-9)}}
	note := "test"
	repo := &fakeRepo{
		moves: map[int64][]punish.ScanMove{
			self: {{ID: 100, Code: "slp", Category: "normal", Startup: ip(5), Damage: ip(30)}},
			oppC: opp,
		},
		totals:   map[int64]punish.MovementTotals{self: {}},
		pruned:   map[int64]map[int64]bool{},
		verdicts: map[int64][]punish.StarterVerdict{self: {{OpponentMoveID: 10, StarterMoveID: 100, Verdict: model.PunishVerdictAdopted, Note: &note}}},
		adopted:  map[int64][]punish.ComboPunishKey{},
	}
	tree, _ := New(repo, fakeCombos{}, func() int64 { return 1 }).Scan(context.Background(), ScanParams{self, oppC, model.PunishGuardTypeBlock})
	st := tree.Nodes[0].Starters[0]
	if st.Verdict == nil || *st.Verdict != model.PunishVerdictAdopted {
		t.Errorf("verdict が始動技ノードに付与されていない")
	}
	if st.Note == nil || *st.Note != "test" {
		t.Errorf("note が付与されていない")
	}
}

func TestScan_EmptyForUnseeded(t *testing.T) {
	// 未 seed/不存在: moves 無し → 200+空(空ツリー)。
	repo := &fakeRepo{
		moves: map[int64][]punish.ScanMove{}, totals: map[int64]punish.MovementTotals{},
		pruned: map[int64]map[int64]bool{}, verdicts: map[int64][]punish.StarterVerdict{}, adopted: map[int64][]punish.ComboPunishKey{},
	}
	tree, err := New(repo, fakeCombos{}, func() int64 { return 1 }).Scan(context.Background(), ScanParams{999, 998, model.PunishGuardTypeBlock})
	if err != nil {
		t.Fatalf("未 seed で err: %v", err)
	}
	if len(tree.Nodes) != 0 || len(tree.ManualReviewNodes) != 0 {
		t.Errorf("未 seed は空ツリーのはず: %+v", tree)
	}
}

func TestScan_NonPunishableTargetsExcluded(t *testing.T) {
	// 相手技側: 移動 system move(前/後/微歩き/ダッシュ/ジャンプ)と空中攻撃は
	// 成立レーンにも手動確認レーンにも出さない(完全除外)。
	opp := []punish.ScanMove{
		{ID: 10, Code: "dash_forward", Category: "system", Damage: nil, Recovery: ip(20)},                           // 移動
		{ID: 11, Code: "jump_forward", Category: "system", Damage: nil, Recovery: ip(20)},                           // 移動
		{ID: 12, Code: "forward", Category: "system", Damage: nil, Recovery: ip(20)},                                // 移動(前入力)
		{ID: 13, Code: "jumping_heavy_punch", Category: "normal", Damage: ip(90), Recovery: ip(20), IsAerial: true}, // 空中攻撃
		{ID: 14, Code: "standing_hp", Category: "normal", Damage: ip(80), Recovery: ip(20)},                         // 通常(成立するはず)
	}
	repo := &fakeRepo{
		moves: map[int64][]punish.ScanMove{
			self: {{ID: 100, Code: "slp", Category: "normal", Startup: ip(5), Damage: ip(30)}},
			oppC: opp,
		},
		totals: map[int64]punish.MovementTotals{self: {}},
		pruned: map[int64]map[int64]bool{}, verdicts: map[int64][]punish.StarterVerdict{}, adopted: map[int64][]punish.ComboPunishKey{},
	}
	tree, err := New(repo, fakeCombos{}, func() int64 { return 1 }).Scan(context.Background(), ScanParams{self, oppC, model.PunishGuardTypeJustParry})
	if err != nil {
		t.Fatal(err)
	}
	for _, id := range []int64{10, 11, 12, 13} {
		if shownInAccepted(tree, id) {
			t.Errorf("反撃対象外 (id=%d) が成立レーンに出ている", id)
		}
		if _, ok := manualReason(tree, id); ok {
			t.Errorf("反撃対象外 (id=%d) が手動確認レーンに出ている(完全除外のはず)", id)
		}
	}
	// 通常技は従来どおり成立する。
	if !shownInAccepted(tree, 14) {
		t.Errorf("通常の相手技が成立レーンに出ていない(除外の巻き込み)")
	}
}

func TestScan_InvalidGuardType(t *testing.T) {
	svc, _ := baseSvc(nil, punish.MovementTotals{})
	if _, err := svc.Scan(context.Background(), ScanParams{self, oppC, "bogus"}); err != ErrInvalidGuardType {
		t.Errorf("不正 guard_type で ErrInvalidGuardType を返すべき, got %v", err)
	}
}

func TestSetStarterVerdict_Whitelist(t *testing.T) {
	svc, repo := baseSvc(nil, punish.MovementTotals{})
	if err := svc.SetStarterVerdict(context.Background(), self, 10, 100, "bogus", nil); err != ErrInvalidVerdict {
		t.Errorf("未知 verdict は ErrInvalidVerdict を返すべき, got %v", err)
	}
	if err := svc.SetStarterVerdict(context.Background(), self, 10, 100, model.PunishVerdictUnreachable, nil); err != nil {
		t.Errorf("許容 verdict が弾かれた: %v", err)
	}
	if len(repo.upsertCalls) != 1 {
		t.Errorf("許容値の upsert が呼ばれていない")
	}
}

func ip64(n int64) *int64 { return &n }

// cloneWithOpp は self 側 moves マップに相手技を足したものを返す(テストの共通化)。
func cloneWithOpp(selfMoves map[int64][]punish.ScanMove, opp []punish.ScanMove) map[int64][]punish.ScanMove {
	m := map[int64][]punish.ScanMove{oppC: opp}
	for k, v := range selfMoves {
		m[k] = v
	}
	return m
}

// ---------------------------------------------------------------------------
// M18-03a §4.5: 自動判定できない相手技への既登録表示。
// ---------------------------------------------------------------------------

func registeredOf(tree *Tree, moveID int64) ([]RegisteredComboNode, bool) {
	for _, m := range tree.ManualReviewNodes {
		if m.MoveID == moveID {
			return m.RegisteredCombos, true
		}
	}
	return nil, false
}

// 手動確認レーンの相手技に既登録の確定反撃があれば配下に出る／無ければ空。
func TestScan_ManualReviewShowsRegisteredCombos(t *testing.T) {
	// id=10: damage IS NULL → 手動確認(unknown_damage)。id=11: 飛び道具 → 手動確認(distance_dependent)。
	opp := []punish.ScanMove{
		{ID: 10, CharacterID: oppC, Code: "unknown_move", Category: "normal", Damage: nil, Recovery: ip(20)},
		{ID: 11, CharacterID: oppC, Code: "hadoken_light", Category: "special", Damage: ip(60), Recovery: ip(30), IsProjectile: true},
	}
	svc, repo := baseSvc(opp, punish.MovementTotals{})
	repo.entries = map[int64][]punish.PunishEntry{
		self: {{
			ComboID: 77, OpponentMoveID: 10, StepCount: 5, Damage: ip(2800),
			HitType: sptr(model.HitTypeJustParryPunishCounter), StarterMoveCode: sptr("standing_light_punch"),
			Note: sptr("要練習"),
		}},
	}

	tree, err := svc.Scan(context.Background(), ScanParams{self, oppC, model.PunishGuardTypeJustParry})
	if err != nil {
		t.Fatal(err)
	}
	if reason, ok := manualReason(tree, 10); !ok || reason != model.PunishReasonUnknownDamage {
		t.Fatalf("id=10 は手動確認(unknown_damage)のはず: reason=%q ok=%v", reason, ok)
	}
	got, ok := registeredOf(tree, 10)
	if !ok {
		t.Fatal("id=10 のノードが無い")
	}
	if len(got) != 1 || got[0].ComboID != 77 || got[0].StepCount != 5 {
		t.Fatalf("registeredCombos = %+v, want combo 77", got)
	}
	if got[0].StarterMoveCode == nil || *got[0].StarterMoveCode != "standing_light_punch" {
		t.Errorf("始動技が載っていない: %+v", got[0])
	}
	if got[0].Note == nil || *got[0].Note != "要練習" {
		t.Errorf("note が載っていない: %+v", got[0])
	}
	// 登録の無い相手技は空スライス(null にしない)。
	empty, ok := registeredOf(tree, 11)
	if !ok {
		t.Fatal("id=11 のノードが無い")
	}
	if empty == nil || len(empty) != 0 {
		t.Errorf("registeredCombos = %+v, want 空スライス", empty)
	}
}

// §4.5 の追加が成立ツリー側に混ざらない(既存の走査結果が不変)。
func TestScan_RegisteredCombosDoNotLeakIntoAcceptedTree(t *testing.T) {
	// id=10 は成立(recovery=20 > startup=5)、id=11 は damage NULL で手動確認。
	opp := []punish.ScanMove{
		{ID: 10, CharacterID: oppC, Code: "standing_hp", Category: "normal", Damage: ip(80), Recovery: ip(20)},
		{ID: 11, CharacterID: oppC, Code: "unknown_move", Category: "normal", Damage: nil, Recovery: ip(20)},
	}
	svc, repo := baseSvc(opp, punish.MovementTotals{})
	// 成立側の相手技(id=10)にも既登録があるが、成立ツリーには影響しない。
	repo.entries = map[int64][]punish.PunishEntry{
		self: {
			{ComboID: 77, OpponentMoveID: 10, StepCount: 5},
			{ComboID: 88, OpponentMoveID: 11, StepCount: 3},
		},
	}

	tree, err := svc.Scan(context.Background(), ScanParams{self, oppC, model.PunishGuardTypeJustParry})
	if err != nil {
		t.Fatal(err)
	}
	if !shownInAccepted(tree, 10) {
		t.Fatal("id=10 が成立レーンに出ていない(既存の走査結果が回帰した)")
	}
	if laneCount(tree, 100, model.PunishLaneGround) != 1 {
		t.Errorf("成立レーンの始動技が変化した")
	}
	// 手動確認レーンには id=11 の登録だけが出る。
	got, ok := registeredOf(tree, 11)
	if !ok || len(got) != 1 || got[0].ComboID != 88 {
		t.Errorf("id=11 の registeredCombos = %+v (ok=%v), want combo 88", got, ok)
	}
	if _, ok := registeredOf(tree, 10); ok {
		t.Error("成立レーンの相手技が手動確認レーンにも出ている")
	}
}

// 成立ツリーの孫コンボにもレシピを載せる(2026-07-26 開発者フィードバック 7)。
// combo リポジトリの List が recipe_cache を投影済みのため追加クエリは不要。
func TestScan_GrandchildCombosCarryRecipe(t *testing.T) {
	opp := []punish.ScanMove{
		{ID: 10, CharacterID: oppC, Code: "standing_hp", Category: "normal", Damage: ip(80), Recovery: ip(20)},
	}
	repo := &fakeRepo{
		moves: map[int64][]punish.ScanMove{
			self: {{ID: 100, CharacterID: self, Code: "standing_light_punch", Category: "normal", Startup: ip(5), Damage: ip(30)}},
			oppC: opp,
		},
		totals:   map[int64]punish.MovementTotals{self: {}},
		pruned:   map[int64]map[int64]bool{},
		verdicts: map[int64][]punish.StarterVerdict{},
		adopted:  map[int64][]punish.ComboPunishKey{},
	}
	combos := fakeCombos{byStarter: map[int64][]*model.Combo{
		100: {
			{ID: 77, StarterMoveID: func() *int64 { v := int64(100); return &v }(), StepCount: 3,
				RecipeCache: sptr(`{"1":"弱P > 中K > 波動拳","2":"LP > MK > QCF+P"}`)},
			{ID: 78, StarterMoveID: func() *int64 { v := int64(100); return &v }(), StepCount: 2,
				RecipeCache: nil}, // 未生成
		},
	}}

	tree, err := New(repo, combos, func() int64 { return 1 }).Scan(context.Background(), ScanParams{self, oppC, model.PunishGuardTypeJustParry})
	if err != nil {
		t.Fatal(err)
	}
	var got []ComboNode
	for _, om := range tree.Nodes {
		for _, st := range om.Starters {
			got = append(got, st.Combos...)
		}
	}
	if len(got) != 2 {
		t.Fatalf("孫コンボ = %d 件, want 2", len(got))
	}
	if got[0].Recipe != "弱P > 中K > 波動拳" {
		t.Errorf("孫コンボにレシピが載っていない: %q", got[0].Recipe)
	}
	// recipe_cache 未生成は空文字(FE は行を出さない)。エラーにしない。
	if got[1].Recipe != "" {
		t.Errorf("未生成時の recipe = %q, want 空文字", got[1].Recipe)
	}
}

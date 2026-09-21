package punishlist

import (
	"context"
	"errors"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
	"github.com/plexiblinp/tacpendium/internal/repository/punish"
)

func sp(s string) *string { return &s }

// fakeRepo は punishlist.Repository のインメモリ実装。
// リポジトリ側の SQL(自キャラ絞り・論理削除除外・curation 除外)は repository のテストで
// 担保済みのため、本 fake は「サービスが何をどう振り分けるか」だけを見る。
type fakeRepo struct {
	entries   []punish.PunishEntry
	curations []punish.CurationEntry
	prunings  []punish.PruningEntry
	// ★M31-01(P4M-014): 「PC 版が既に作られている基底コンボ」の集合。
	materializedBases map[int64]bool

	lastFilter  punish.PunishEntryFilter
	addedNote   *string
	addedKey    [2]int64
	removedKey  [2]int64
	addCalled   bool
	removeCalls int
}

func (f *fakeRepo) ListPunishEntries(_ context.Context, filter punish.PunishEntryFilter) ([]punish.PunishEntry, error) {
	f.lastFilter = filter
	return f.entries, nil
}
func (f *fakeRepo) ListMaterializedBaseComboIDs(context.Context, int64) (map[int64]bool, error) {
	return f.materializedBases, nil
}
func (f *fakeRepo) ListCurations(context.Context, int64, *int64) ([]punish.CurationEntry, error) {
	return f.curations, nil
}
func (f *fakeRepo) ListPrunings(context.Context, int64, *int64) ([]punish.PruningEntry, error) {
	return f.prunings, nil
}
func (f *fakeRepo) AddCuration(_ context.Context, comboID, opponentMoveID int64, note *string) error {
	f.addCalled = true
	f.addedKey = [2]int64{comboID, opponentMoveID}
	f.addedNote = note
	return nil
}
func (f *fakeRepo) RemoveCuration(_ context.Context, comboID, opponentMoveID int64) error {
	f.removeCalls++
	f.removedKey = [2]int64{comboID, opponentMoveID}
	return nil
}

// entry はテスト用の表示用投影を組む(相手技 1 種・自キャラ 1 種を既定にする)。
func entry(comboID, oppMoveID int64, hitType *string) punish.PunishEntry {
	return punish.PunishEntry{
		ComboID:                 comboID,
		OpponentMoveID:          oppMoveID,
		OpponentMoveCode:        "hadoken_light",
		OpponentCharacterID:     2,
		OpponentCharacterNameJa: "ケン",
		StepCount:               4,
		HitType:                 hitType,
	}
}

func comboIDs(nodes []MoveNode) []int64 {
	out := make([]int64, 0)
	for _, n := range nodes {
		for _, c := range n.Combos {
			out = append(out, c.ComboID)
		}
	}
	return out
}

func TestList_InvalidGuardType(t *testing.T) {
	svc := New(&fakeRepo{}, func() int64 { return 1 })
	if _, err := svc.List(context.Background(), ListParams{SelfCharacterID: 1, GuardType: "bogus"}); !errors.Is(err, ErrInvalidGuardType) {
		t.Fatalf("err = %v, want ErrInvalidGuardType", err)
	}
}

func TestList_EmptyIsNotNil(t *testing.T) {
	svc := New(&fakeRepo{}, func() int64 { return 1 })
	got, err := svc.List(context.Background(), ListParams{SelfCharacterID: 999, GuardType: model.PunishGuardTypeJustParry})
	if err != nil {
		t.Fatalf("未 seed・不存在 ID でエラーになった: %v", err)
	}
	// 空配列は null でなく [] でシリアライズされること(FE が length を引けるように)。
	if got.Nodes == nil || got.UnclassifiedNodes == nil || got.HiddenPrunings == nil || got.HiddenCurations == nil {
		t.Fatalf("空スライスが nil: %+v", got)
	}
	if len(got.Nodes) != 0 {
		t.Errorf("nodes = %+v, want empty", got.Nodes)
	}
}

// hit_type タブの絞りが双方向に効く(片方のタブに他方が混ざらない)。
func TestList_HitTypeTabFiltersBothWays(t *testing.T) {
	repo := &fakeRepo{entries: []punish.PunishEntry{
		entry(1, 10, sp(model.HitTypePunishCounter)),
		entry(2, 10, sp(model.HitTypeJustParryPunishCounter)),
	}}
	svc := New(repo, func() int64 { return 1 })
	ctx := context.Background()

	block, err := svc.List(ctx, ListParams{SelfCharacterID: 1, GuardType: model.PunishGuardTypeBlock})
	if err != nil {
		t.Fatal(err)
	}
	if got := comboIDs(block.Nodes); len(got) != 1 || got[0] != 1 {
		t.Errorf("ガードタブの combo = %v, want [1](just_parry が混ざってはいけない)", got)
	}
	if block.HitType != model.HitTypePunishCounter {
		t.Errorf("hitType = %q, want %q", block.HitType, model.HitTypePunishCounter)
	}

	jp, err := svc.List(ctx, ListParams{SelfCharacterID: 1, GuardType: model.PunishGuardTypeJustParry})
	if err != nil {
		t.Fatal(err)
	}
	if got := comboIDs(jp.Nodes); len(got) != 1 || got[0] != 2 {
		t.Errorf("ジャストパリィタブの combo = %v, want [2](punish_counter が混ざってはいけない)", got)
	}
	// タブ外に落ちたものは「区分を判定できない」扱いにしない(もう一方のタブに属するため)。
	if len(jp.UnclassifiedNodes) != 0 {
		t.Errorf("unclassifiedNodes = %+v, want empty", jp.UnclassifiedNodes)
	}
}

// hit_type が normal / counter / NULL の採用済み反撃は、どちらのタブにも出ず
// 「区分を判定できない反撃」に出る(開発者確定 2026-07-26。NULL を落とさない)。
func TestList_UnclassifiedHitTypes(t *testing.T) {
	repo := &fakeRepo{entries: []punish.PunishEntry{
		entry(1, 10, sp(model.HitTypeNormal)),
		entry(2, 10, sp(model.HitTypeCounter)),
		entry(3, 10, nil), // hit_type IS NULL
		entry(4, 10, sp(model.HitTypeJustParryPunishCounter)),
	}}
	svc := New(repo, func() int64 { return 1 })
	ctx := context.Background()

	for _, guard := range []string{model.PunishGuardTypeBlock, model.PunishGuardTypeJustParry} {
		got, err := svc.List(ctx, ListParams{SelfCharacterID: 1, GuardType: guard})
		if err != nil {
			t.Fatal(err)
		}
		unclassified := comboIDs(got.UnclassifiedNodes)
		if len(unclassified) != 3 {
			t.Fatalf("guard=%s: unclassified = %v, want 3 件(normal/counter/NULL)", guard, unclassified)
		}
		for _, want := range []int64{1, 2, 3} {
			found := false
			for _, id := range unclassified {
				if id == want {
					found = true
				}
			}
			if !found {
				t.Errorf("guard=%s: combo %d が unclassified に無い", guard, want)
			}
		}
		// 通常のタブ側には出ない。
		for _, id := range comboIDs(got.Nodes) {
			if id == 1 || id == 2 || id == 3 {
				t.Errorf("guard=%s: 区分不明の combo %d がタブ側に出ている", guard, id)
			}
		}
	}
}

// pruning はマイリストの表示を制御しない(指示書 §4.1 の帰結。落とすと設計意図が壊れる)。
func TestList_PruningDoesNotHideAdoptedPunish(t *testing.T) {
	repo := &fakeRepo{
		entries: []punish.PunishEntry{entry(1, 10, sp(model.HitTypeJustParryPunishCounter))},
		prunings: []punish.PruningEntry{{
			OpponentMoveID: 10, OpponentMoveCode: "hadoken_light",
			OpponentCharacterID: 2, OpponentCharacterNameJa: "ケン",
		}},
	}
	svc := New(repo, func() int64 { return 1 })
	got, err := svc.List(context.Background(), ListParams{SelfCharacterID: 1, GuardType: model.PunishGuardTypeJustParry})
	if err != nil {
		t.Fatal(err)
	}
	if ids := comboIDs(got.Nodes); len(ids) != 1 || ids[0] != 1 {
		t.Fatalf("pruning 済み相手技の採用済み反撃が消えた: nodes = %+v", got.Nodes)
	}
	// 「隠したもの管理」には一覧として出る(解除の導線のため)。
	if len(got.HiddenPrunings) != 1 || got.HiddenPrunings[0].OpponentMoveID != 10 {
		t.Errorf("hiddenPrunings = %+v, want 1 件", got.HiddenPrunings)
	}
}

// 母集合の取得時に curation 除外を要求している(表示制御)。
func TestList_RequestsCurationExclusionAndFoldsHiddenItems(t *testing.T) {
	oppChar := int64(2)
	repo := &fakeRepo{curations: []punish.CurationEntry{{
		ComboID: 7, OpponentMoveID: 10, OpponentMoveCode: "hadoken_light",
		OpponentCharacterID: 2, OpponentCharacterNameJa: "ケン", Note: sp("使わない"),
	}}}
	svc := New(repo, func() int64 { return 1 })
	got, err := svc.List(context.Background(), ListParams{
		SelfCharacterID: 1, OpponentCharacterID: &oppChar, GuardType: model.PunishGuardTypeJustParry,
	})
	if err != nil {
		t.Fatal(err)
	}
	if !repo.lastFilter.ExcludeCurated {
		t.Error("ExcludeCurated=false で母集合を引いている(curation が表示制御になっていない)")
	}
	if repo.lastFilter.OpponentCharacterID == nil || *repo.lastFilter.OpponentCharacterID != oppChar {
		t.Errorf("相手キャラ絞りが渡っていない: %+v", repo.lastFilter)
	}
	if len(got.HiddenCurations) != 1 || got.HiddenCurations[0].ComboID != 7 {
		t.Fatalf("hiddenCurations = %+v, want 1 件(別 GET を立てず畳む)", got.HiddenCurations)
	}
	if got.HiddenCurations[0].Note == nil || *got.HiddenCurations[0].Note != "使わない" {
		t.Errorf("note が落ちている: %+v", got.HiddenCurations[0])
	}
}

// 第1階層＝相手技でグルーピングされ、始動技では階層を切らない。
func TestList_GroupsByOpponentMove(t *testing.T) {
	jp := sp(model.HitTypeJustParryPunishCounter)
	e1 := entry(1, 10, jp)
	e1.StarterMoveCode = sp("standing_light_punch")
	e2 := entry(2, 10, jp)
	e2.StarterMoveCode = sp("crouching_medium_kick") // 始動技が違っても同じ相手技ノードに入る
	e3 := entry(3, 11, jp)
	e3.OpponentMoveCode = "shoryuken_light"

	svc := New(&fakeRepo{entries: []punish.PunishEntry{e1, e2, e3}}, func() int64 { return 1 })
	got, err := svc.List(context.Background(), ListParams{SelfCharacterID: 1, GuardType: model.PunishGuardTypeJustParry})
	if err != nil {
		t.Fatal(err)
	}
	if len(got.Nodes) != 2 {
		t.Fatalf("nodes = %d 件, want 2(相手技 2 種)", len(got.Nodes))
	}
	if len(got.Nodes[0].Combos) != 2 || got.Nodes[0].MoveID != 10 {
		t.Errorf("1 つ目のノード = %+v, want moveId=10 にコンボ 2 件", got.Nodes[0])
	}
	if got.Nodes[0].Combos[0].StarterMoveCode == nil || *got.Nodes[0].Combos[0].StarterMoveCode != "standing_light_punch" {
		t.Errorf("始動技が行の属性として載っていない: %+v", got.Nodes[0].Combos[0])
	}
	if len(got.Nodes[1].Combos) != 1 || got.Nodes[1].MoveID != 11 {
		t.Errorf("2 つ目のノード = %+v, want moveId=11 にコンボ 1 件", got.Nodes[1])
	}
}

// recipe_cache から既定プリセットのレシピを抽出して行に載せる(開発者フィードバック 7)。
func TestList_ExtractsDefaultRecipe(t *testing.T) {
	jp := sp(model.HitTypeJustParryPunishCounter)
	withRecipe := entry(1, 10, jp)
	withRecipe.RecipeCache = sp(`{"1":"弱P > 中K > 波動拳","2":"LP > MK > QCF+P"}`)
	broken := entry(2, 10, jp)
	broken.RecipeCache = sp(`{broken`)
	none := entry(3, 10, jp)

	svc := New(&fakeRepo{entries: []punish.PunishEntry{withRecipe, broken, none}}, func() int64 { return 1 })
	got, err := svc.List(context.Background(), ListParams{SelfCharacterID: 1, GuardType: model.PunishGuardTypeJustParry})
	if err != nil {
		t.Fatal(err)
	}
	combos := got.Nodes[0].Combos
	if len(combos) != 3 {
		t.Fatalf("combos = %d, want 3", len(combos))
	}
	if combos[0].Recipe != "弱P > 中K > 波動拳" {
		t.Errorf("recipe = %q, want 既定プリセットの値", combos[0].Recipe)
	}
	// 壊れた JSON / 未設定は空文字(FE は行を出さない)。エラーにしない。
	if combos[1].Recipe != "" || combos[2].Recipe != "" {
		t.Errorf("欠損時の recipe = %q / %q, want 空文字", combos[1].Recipe, combos[2].Recipe)
	}
}

func TestCurationPassthrough(t *testing.T) {
	repo := &fakeRepo{}
	svc := New(repo, func() int64 { return 1 })
	ctx := context.Background()

	if err := svc.AddCuration(ctx, 5, 10, sp("使わない")); err != nil {
		t.Fatal(err)
	}
	if !repo.addCalled || repo.addedKey != [2]int64{5, 10} || repo.addedNote == nil || *repo.addedNote != "使わない" {
		t.Errorf("AddCuration の受け渡しが壊れている: key=%v note=%v", repo.addedKey, repo.addedNote)
	}
	if err := svc.RemoveCuration(ctx, 5, 10); err != nil {
		t.Fatal(err)
	}
	if repo.removeCalls != 1 || repo.removedKey != [2]int64{5, 10} {
		t.Errorf("RemoveCuration の受け渡しが壊れている: calls=%d key=%v", repo.removeCalls, repo.removedKey)
	}
}

package punishfinder

import (
	"context"
	"reflect"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
	"github.com/plexiblinp/tacpendium/internal/repository/punish"
)

// M20-05 §5 (n): 既定プリセットを変えても候補集合が変わらないことを固定する。
//
// ★★ なぜこのテストが要るか(D-360)★★
// 本パッケージは契約 F-3 の担保として diff 0 が要求されていた。M20-05 は
// 「既定プリセットの固定値を 1 か所へ寄せる」ために、その要求へ明示的な例外を得ている
// (§2.2-3)。例外を許すぶん、diff 0 という proxy の代わりに **不変条件そのもの** を
// 直接測る検査をここへ置く。
//
// 守りたい不変条件は「M20 はプリセット層のみを触り、moves の意味論と値・候補集合の
// 算出には触れない」である。⇒ 既定プリセットを変えたとき、変わってよいのは
// 表示文字列(Recipe)だけであり、ツリーの形・相手技・始動技・レーン・コンボ集合は
// 1 ビットも変わってはならない。
//
// ★proxy(diff 0)を守るために振る舞いを隠す形を採ったら、proxy は嘘をつくようになる。
// 可変なプロセス状態で diff を 0 にする案を退けたのはこのためである(§4.2 注記 2)。

// scanTreeWithDefaultPreset は既定プリセットだけを差し替えて同じ走査を回す。
func scanTreeWithDefaultPreset(t *testing.T, presetID int64) *Tree {
	t.Helper()
	opp := []punish.ScanMove{
		{ID: 10, CharacterID: oppC, Code: "hp", Category: "normal", Damage: ip(80), OnBlock: ip(-5)},
		{ID: 11, CharacterID: oppC, Code: "mp", Category: "normal", Damage: ip(60), OnBlock: ip(-3)},
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
	// recipe_cache は {presetId: 表示文字列} の JSON。プリセットごとに違う値を入れておく。
	cache := `{"1":"立ち弱P","3":"5LP","5":"LP"}`
	combos := fakeCombos{byStarter: map[int64][]*model.Combo{
		100: {{ID: 900, StarterMoveID: ip64(100), Damage: ip(120), StepCount: 2, RecipeCache: sptr(cache)}},
	}}

	svc := New(repo, combos, func() int64 { return presetID })
	tree, err := svc.Scan(context.Background(), ScanParams{self, oppC, model.PunishGuardTypeBlock})
	if err != nil {
		t.Fatalf("Scan(preset=%d): %v", presetID, err)
	}
	return tree
}

// candidateShape は Recipe を除いた「候補集合の形」を取り出す。
//
// ★Recipe だけを落として比較するのが要点である。全体を比較すると
// 「表示文字列が変わったこと」まで差分になり、何を守っているのか分からなくなる。
type candidateShape struct {
	OpponentMoveIDs    []int64
	StarterPerMove     map[int64][]int64
	LanePerStarter     map[int64][]string
	ComboIDsPerStarter map[int64][]int64
	ManualReviewIDs    []int64
}

func shapeOf(tree *Tree) candidateShape {
	s := candidateShape{
		StarterPerMove:     map[int64][]int64{},
		LanePerStarter:     map[int64][]string{},
		ComboIDsPerStarter: map[int64][]int64{},
	}
	for _, om := range tree.Nodes {
		s.OpponentMoveIDs = append(s.OpponentMoveIDs, om.MoveID)
		for _, st := range om.Starters {
			s.StarterPerMove[om.MoveID] = append(s.StarterPerMove[om.MoveID], st.MoveID)
			s.LanePerStarter[st.MoveID] = append(s.LanePerStarter[st.MoveID], st.Lane)
			for _, c := range st.Combos {
				s.ComboIDsPerStarter[st.MoveID] = append(s.ComboIDsPerStarter[st.MoveID], c.ComboID)
			}
		}
	}
	for _, m := range tree.ManualReviewNodes {
		s.ManualReviewIDs = append(s.ManualReviewIDs, m.MoveID)
	}
	return s
}

func recipesOf(tree *Tree) []string {
	out := []string{}
	for _, om := range tree.Nodes {
		for _, st := range om.Starters {
			for _, c := range st.Combos {
				out = append(out, c.Recipe)
			}
		}
	}
	return out
}

func TestScan_DefaultPresetChange_DoesNotAffectCandidates(t *testing.T) {
	base := scanTreeWithDefaultPreset(t, 1)
	switched := scanTreeWithDefaultPreset(t, 3)

	if !reflect.DeepEqual(shapeOf(base), shapeOf(switched)) {
		t.Errorf("既定プリセットを変えたら候補集合が変わった。\n preset=1: %+v\n preset=3: %+v\n"+
			"★M20 はプリセット層のみを触る。候補集合の算出に触れてはならない(契約 F-3)",
			shapeOf(base), shapeOf(switched))
	}

	// ★陽性対照: 表示文字列のほうは実際に変わっていること。
	// これが変わらないなら、そもそも注入が効いていない(テストが何も測っていない)。
	baseRecipes, switchedRecipes := recipesOf(base), recipesOf(switched)
	if len(baseRecipes) == 0 {
		t.Fatal("前提が崩れている: コンボが 1 件も出ていない")
	}
	if reflect.DeepEqual(baseRecipes, switchedRecipes) {
		t.Errorf("表示文字列が変わっていない(%v)。注入が効いていないため本テストは"+
			"何も測っていない", baseRecipes)
	}
	if baseRecipes[0] != "立ち弱P" || switchedRecipes[0] != "5LP" {
		t.Errorf("Recipe = %q / %q, want %q / %q(注入された既定プリセットのキーを読むこと)",
			baseRecipes[0], switchedRecipes[0], "立ち弱P", "5LP")
	}
}

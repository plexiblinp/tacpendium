package punishlist

import (
	"context"
	"errors"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
	"github.com/plexiblinp/tacpendium/internal/repository/punish"
)

// ===========================================================================
// M31-01(P4M-014): ComboNode.HasMaterializedVersion の投影
//
// ★★FE は本フラグで「①(反撃に転用可能)から外す」を決める。⇒ 投影が落ちると、
//   画面は着手前と同じ見た目のまま静かに旧挙動へ戻る(テストも lint も緑のまま)。
// ===========================================================================

// errRepo は ListMaterializedBaseComboIDs だけが失敗するリポジトリ。
type errRepo struct {
	*fakeRepo
}

func (e *errRepo) ListMaterializedBaseComboIDs(context.Context, int64) (map[int64]bool, error) {
	return nil, errors.New("boom")
}

func TestM3101_List_ProjectsHasMaterializedVersion(t *testing.T) {
	repo := &fakeRepo{
		entries: []punish.PunishEntry{
			entry(1, 10, sp(model.HitTypeNormal)),
			entry(2, 10, sp(model.HitTypeNormal)),
		},
		materializedBases: map[int64]bool{2: true},
	}
	svc := New(repo, func() int64 { return 1 })

	out, err := svc.List(context.Background(), ListParams{
		SelfCharacterID: 1, GuardType: model.PunishGuardTypeBlock,
	})
	if err != nil {
		t.Fatal(err)
	}

	got := map[int64]bool{}
	for _, n := range out.UnclassifiedNodes {
		for _, c := range n.Combos {
			got[c.ComboID] = c.HasMaterializedVersion
		}
	}
	if got[1] {
		t.Errorf("combo 1 に HasMaterializedVersion が立っている(PC 版は無いはず)")
	}
	if !got[2] {
		t.Errorf("combo 2 に HasMaterializedVersion が立っていない(PC 版が在るはず)")
	}
}

// ★★取得に失敗しても一覧そのものは落とさない。
//
//	フラグは表示の補助であり、マイリストを見るという主目的を巻き添えにしない
//	(M23-04 の「検証が壊れても復元は落とさない」と同じ扱い)。
func TestM3101_List_SurvivesMaterializedLookupFailure(t *testing.T) {
	repo := &errRepo{fakeRepo: &fakeRepo{
		entries: []punish.PunishEntry{entry(1, 10, sp(model.HitTypeNormal))},
	}}
	svc := New(repo, func() int64 { return 1 })

	out, err := svc.List(context.Background(), ListParams{
		SelfCharacterID: 1, GuardType: model.PunishGuardTypeBlock,
	})
	if err != nil {
		t.Fatalf("一覧が落ちた: %v", err)
	}
	if len(out.UnclassifiedNodes) != 1 {
		t.Fatalf("区分不明が %d 件, want 1", len(out.UnclassifiedNodes))
	}
	// ★フラグは false へ倒れる(nil マップの参照)。⇒ 全件が ① に出る＝着手前と同じ。
	if out.UnclassifiedNodes[0].Combos[0].HasMaterializedVersion {
		t.Errorf("取得失敗時にフラグが立っている")
	}
}

package move

import (
	"reflect"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
)

// TestMoveListItemSharedFieldsMatchModelMove は §4.8 乖離検出ガード(M8-A4 / M9-overview §3.9)。
//
// MoveListItem は GET /api/moves の意図的投影で、model.Move と共有する moves 列フィールドを持つ。
// NameJa は結合由来(moves 列ではない)のため対象外。共有フィールドはすべて model.Move 側に
// 同名・同型で存在しなければならない。将来 moves 列を追加した際に、片側だけ更新して同期が
// 崩れたことをこのテストが検出する。
func TestMoveListItemSharedFieldsMatchModelMove(t *testing.T) {
	// NameJa は preset_aliases 結合由来で moves 列ではないため、突合対象から除外する。
	const joinDerivedField = "NameJa"

	moveType := reflect.TypeFor[model.Move]()
	listType := reflect.TypeFor[MoveListItem]()

	for f := range listType.Fields() {
		if f.Name == joinDerivedField {
			continue
		}
		mf, ok := moveType.FieldByName(f.Name)
		if !ok {
			t.Errorf("MoveListItem.%s が model.Move に存在しません(乖離: moves 列追加時は両構造体を同期すること)", f.Name)
			continue
		}
		if mf.Type != f.Type {
			t.Errorf("フィールド %s の型が乖離しています: MoveListItem=%s / model.Move=%s", f.Name, f.Type, mf.Type)
		}
	}
}

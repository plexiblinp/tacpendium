package combo_test

import (
	"context"
	"database/sql"
	"testing"

	comborepo "github.com/plexiblinp/tacpendium/internal/repository/combo"
	"github.com/plexiblinp/tacpendium/internal/testutil/dbtest"
)

// M37-03(B01): ゴミ箱のコンボ側の既定の並びが「削除日時の降順」であることを実 DB で固定する。
//
// ★★本サブの要求は「削除日時の*表示*」ではなく「並び順」である(指示書 §0.3)。
//
// 着手前の実測: ゴミ箱のコンボ側は sort を送らず resolveSortClause の default 分岐へ落ちていたため、
// `starter_move_id ASC, position ASC, hit_type ASC, opponent_stance ASC, opponent_size ASC, id ASC`
// ——削除日時と無関係な **始動状況順**で並んでいた。セットプレイ側(repository/setup/restore.go)は
// 当初から `deleted_at DESC, id DESC` であり、同じ画面の 2 つの表が食い違っていた。
//
// ★★★判定は 2 ケースで挟む。どちらか片方だけでは並びを一意に特定できない。
//
//	ケース 1(id 昇順と区別): 古い行ほど id が小さい並びにすると、旧挙動(id ASC)と
//	  削除日時降順は **逆の答え**になる。⇒ 旧実装では落ちる。
//	ケース 2(id 降順と区別): id が大きい行を先に消すと、`id DESC` だけの実装と
//	  削除日時降順は **逆の答え**になる。⇒ 日時が効いていることの証拠になる。
//
// ★deleted_at は明示値で入れる。本番の SoftDelete は datetime('now') の **秒精度**であり、
// 同じ秒に 2 行消すと日時では順序が決まらないため、テストで時刻を待つのは不安定である。

// insertTrashedComboAt は指定した削除日時の削除済みコンボを 1 行作る。
//
// ★状況 4 軸をすべて同じ値にしてある —— 旧既定(始動状況順)の第 1〜5 キーが全行で同値になり、
// 旧実装の並びが `id ASC` だけに決まる。⇒ ケース 1 が旧実装を確実に落とす。
func insertTrashedComboAt(t *testing.T, db *sql.DB, deletedAt string) int64 {
	t.Helper()
	return dbtest.Insert(t, db, "combos", dbtest.Cols{
		"character_id":    1,
		"is_draft":        0,
		"position":        "mid_screen",
		"opponent_stance": "standing",
		"hit_type":        "normal",
		"opponent_size":   "standard",
		"version":         1,
		"step_count":      1,
		"deleted_at":      deletedAt,
	})
}

func trashedIDsInOrder(t *testing.T, repo comborepo.Repository, filter comborepo.ListFilter) []int64 {
	t.Helper()
	got, err := repo.List(context.Background(), filter)
	if err != nil {
		t.Fatalf("List(OnlyDeleted): %v", err)
	}
	ids := make([]int64, 0, len(got))
	for _, c := range got {
		ids = append(ids, c.ID)
	}
	return ids
}

func assertIDOrder(t *testing.T, label string, got []int64, want []int64) {
	t.Helper()
	if len(got) != len(want) {
		t.Fatalf("%s: 件数 = %d(%v), want %d(%v)", label, len(got), got, len(want), want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("%s: 並び = %v, want %v", label, got, want)
		}
	}
}

// ケース 1: 消した順に id が増える並び。⇒ 新しく消したものが先頭に来る。
// ★旧挙動(id ASC)なら古いほうが先頭になるため、本ケースは旧実装で落ちる。
func TestList_TrashDefaultOrder_NewestDeletedFirst(t *testing.T) {
	db := dbtest.Setup(t)
	repo := comborepo.New(db)

	older := insertTrashedComboAt(t, db, "2026-01-01 00:00:00") // 先に消した(id 小)
	newer := insertTrashedComboAt(t, db, "2026-01-02 00:00:00") // 後で消した(id 大)

	got := trashedIDsInOrder(t, repo, comborepo.ListFilter{OnlyDeleted: true})
	assertIDOrder(t, "削除日時降順(新しく消したものが上)", got, []int64{newer, older})
}

// ケース 2: id の大きい行を先に消す。⇒ 後から消した id 小の行が先頭に来る。
// ★`id DESC` だけの実装なら id 大が先頭になるため、本ケースは「日時で並んでいる」ことの証拠になる。
func TestList_TrashDefaultOrder_UsesDeletedAtNotID(t *testing.T) {
	db := dbtest.Setup(t)
	repo := comborepo.New(db)

	deletedLater := insertTrashedComboAt(t, db, "2026-01-02 00:00:00")   // id 小・後で消した
	deletedEarlier := insertTrashedComboAt(t, db, "2026-01-01 00:00:00") // id 大・先に消した

	got := trashedIDsInOrder(t, repo, comborepo.ListFilter{OnlyDeleted: true})
	assertIDOrder(t, "id ではなく deleted_at で並ぶ", got, []int64{deletedLater, deletedEarlier})
}

// 同じ秒に消した行は id の降順で決まる(全順序が確定していること)。
// ★本番の SoftDelete は datetime('now') の秒精度であり、同秒の同着は実際に起こりうる。
func TestList_TrashDefaultOrder_TieBreaksByIDDesc(t *testing.T) {
	db := dbtest.Setup(t)
	repo := comborepo.New(db)

	const sameMoment = "2026-01-01 00:00:00"
	first := insertTrashedComboAt(t, db, sameMoment)
	second := insertTrashedComboAt(t, db, sameMoment)

	got := trashedIDsInOrder(t, repo, comborepo.ListFilter{OnlyDeleted: true})
	assertIDOrder(t, "同時刻は id 降順", got, []int64{second, first})
}

// ★明示された sort は従来どおり優先する(ゴミ箱の既定を差し替えただけであること)。
func TestList_TrashExplicitSortStillWins(t *testing.T) {
	db := dbtest.Setup(t)
	repo := comborepo.New(db)

	newerDeleted := insertTrashedComboAt(t, db, "2026-01-02 00:00:00")
	olderDeleted := insertTrashedComboAt(t, db, "2026-01-01 00:00:00")

	// deleted_at の昇順を明示 ⇒ 既定(降順)とは逆になる。
	got := trashedIDsInOrder(t, repo, comborepo.ListFilter{
		OnlyDeleted: true,
		Sort:        "deleted_at",
		Order:       "asc",
	})
	assertIDOrder(t, "明示 sort=deleted_at&order=asc", got, []int64{olderDeleted, newerDeleted})
}

// ★★`sort=default` は「明示指定」として扱う(M37-03 レビュー 中-2)。
//
// ⇒ ゴミ箱でも始動状況順に戻る。**意図どおりである** ——`default` は whitelist の 1 エントリであり
// 「始動状況順で並べてくれ」という明示の要求だからである。
// ★現時点でゴミ箱の画面は sort を送らないため実害は無い。本テストは挙動を固定して、
// 将来ゴミ箱へ並び替え UI を足す担当が「既定へ戻す」に sort=default を使ったときに気づけるようにする。
func TestList_TrashSortDefaultIsTreatedAsExplicit(t *testing.T) {
	db := dbtest.Setup(t)
	repo := comborepo.New(db)

	// 状況 4 軸は同値にしてある ⇒ 始動状況順の第 1〜5 キーが並ばず、id ASC に決まる。
	older := insertTrashedComboAt(t, db, "2026-01-01 00:00:00") // id 小
	newer := insertTrashedComboAt(t, db, "2026-01-02 00:00:00") // id 大

	got := trashedIDsInOrder(t, repo, comborepo.ListFilter{
		OnlyDeleted: true,
		Sort:        "default",
	})
	// ★削除日時降順なら {newer, older} になるはず。そうならないことを固定する。
	assertIDOrder(t, "sort=default は始動状況順(id ASC)へ戻る", got, []int64{older, newer})
}

// ★ゴミ箱以外の一覧の並びは変えていない(既定は従来どおり始動状況順＋id ASC)。
func TestList_NonTrashDefaultOrderUnchanged(t *testing.T) {
	db := dbtest.Setup(t)
	repo := comborepo.New(db)

	// 状況 4 軸が同値の現役行を 2 つ。⇒ 既定の並びは id ASC に決まる。
	first := dbtest.Insert(t, db, "combos", dbtest.Cols{
		"character_id": 1, "is_draft": 0, "position": "mid_screen",
		"opponent_stance": "standing", "hit_type": "normal", "opponent_size": "standard",
		"version": 1, "step_count": 1,
	})
	second := dbtest.Insert(t, db, "combos", dbtest.Cols{
		"character_id": 1, "is_draft": 0, "position": "mid_screen",
		"opponent_stance": "standing", "hit_type": "normal", "opponent_size": "standard",
		"version": 1, "step_count": 1,
	})

	got := trashedIDsInOrder(t, repo, comborepo.ListFilter{})
	assertIDOrder(t, "通常一覧の既定は不変(id ASC)", got, []int64{first, second})
}

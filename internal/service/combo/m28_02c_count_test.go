package combo_test

import (
	"context"
	"testing"

	comborepo "github.com/plexiblinp/tacpendium/internal/repository/combo"
)

// M28-02c: 総数(Count)が一覧の絞り込みと同じ集合を返すこと(指示書 §5-2)。
//
// ★★一覧 API の count では総数が取れない —— ハンドラが Count: len(items) であり、
//   limit も 100 / 1000 に丸められる(CHANGE-162 §2.2)。⇒ COUNT の新設が要る。
// ★★件数と一覧が別々の述語で決まると、バナーが「3 件」と言うのに専用画面が空、
//   という形が起きる。⇒ 実 DB で「件数 == 行数」を主張する。

// TestCountMatchesListFilter は Count と List が同じ集合を指すことを固定する。
func TestCountMatchesListFilter(t *testing.T) {
	db, svc := newSvc(t)
	ctx := context.Background()
	repo := comborepo.New(db)

	affected, res, err := svc.Create(ctx, validRyuInput(t, db))
	if err != nil || affected == nil {
		t.Fatalf("create affected: err=%v issues=%v", err, res.Issues)
	}
	otherIn := validRyuInput(t, db)
	otherIn.Position = ptr("corner_self")
	unaffected, res, err := svc.Create(ctx, otherIn)
	if err != nil || unaffected == nil {
		t.Fatalf("create unaffected: err=%v issues=%v", err, res.Issues)
	}
	// 3 件目はゴミ箱へ入れる。★判定式は deleted_at を見ないので、
	//   「削除済みなのに件数に入る」形になっていないことを確かめる意味がある。
	trashedIn := validRyuInput(t, db)
	trashedIn.Position = ptr("corner_opponent")
	trashed, res, err := svc.Create(ctx, trashedIn)
	if err != nil || trashed == nil {
		t.Fatalf("create trashed: err=%v issues=%v", err, res.Issues)
	}

	move2 := lookupMoveID(t, db, 1, "hadoken_light")
	setMarker(t, db, move2, "2026.09.01.00")
	setBaseline(t, db, affected.ID, "2026.08.03.01")   // 古い ⇒ 影響あり
	setBaseline(t, db, unaffected.ID, "2026.09.01.00") // 同値 ⇒ 影響なし
	setBaseline(t, db, trashed.ID, "2026.08.03.01")    // 古いが、ゴミ箱に入れる
	if err := svc.Delete(ctx, trashed.ID); err != nil {
		t.Fatalf("delete: %v", err)
	}

	yes, no := true, false
	cases := []struct {
		name   string
		filter comborepo.ListFilter
	}{
		{"影響ありのみ", comborepo.ListFilter{AffectedByGameUpdate: &yes, UserID: 1}},
		{"影響なしのみ", comborepo.ListFilter{AffectedByGameUpdate: &no, UserID: 1}},
		{"絞り込みなし", comborepo.ListFilter{UserID: 1}},
		{"キャラ指定と併用", comborepo.ListFilter{AffectedByGameUpdate: &yes, CharacterID: ptr(int64(1)), UserID: 1}},
		{"該当しないキャラ", comborepo.ListFilter{AffectedByGameUpdate: &yes, CharacterID: ptr(int64(2)), UserID: 1}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			// ★limit を大きく取り、丸め(既定 100)に当たらない形で行数を数える。
			listFilter := tc.filter
			listFilter.Limit = 1000
			rows, err := repo.List(ctx, listFilter)
			if err != nil {
				t.Fatalf("list: %v", err)
			}
			n, err := repo.Count(ctx, tc.filter)
			if err != nil {
				t.Fatalf("count: %v", err)
			}
			if n != len(rows) {
				t.Errorf("★件数 %d と行数 %d が食い違っている。⇒ 述語が 2 本に割れている疑い", n, len(rows))
			}
		})
	}

	// ★ゴミ箱の行は件数に入らない(既定の deleted_at IS NULL を Count も通る)。
	n, err := repo.Count(ctx, comborepo.ListFilter{AffectedByGameUpdate: &yes, UserID: 1})
	if err != nil {
		t.Fatalf("count: %v", err)
	}
	if n != 1 {
		t.Errorf("影響ありの総数 = %d, want 1(ゴミ箱の行は入らない)", n)
	}
}

// TestCountIsNotCappedByListLimit は「一覧 API の count で代用できない」ことの裏返しを
// 固定する —— Count は limit の丸めを受けない(CHANGE-162 §2.2 / チェックリスト §0.4-9)。
func TestCountIsNotCappedByListLimit(t *testing.T) {
	db, svc := newSvc(t)
	ctx := context.Background()
	repo := comborepo.New(db)

	// 区分を変えて 3 件作る(重複判定を避けるため)。
	positions := []string{"mid_screen", "corner_self", "corner_opponent"}
	for _, pos := range positions {
		in := validRyuInput(t, db)
		in.Position = ptr(pos)
		created, res, err := svc.Create(ctx, in)
		if err != nil || created == nil {
			t.Fatalf("create %s: err=%v issues=%v", pos, err, res.Issues)
		}
		setBaseline(t, db, created.ID, "2026.08.03.01")
	}
	setMarker(t, db, lookupMoveID(t, db, 1, "hadoken_light"), "2026.09.01.00")

	yes := true
	// ★limit = 1 の List は 1 行しか返さないが、Count は 3 を返す。
	rows, err := repo.List(ctx, comborepo.ListFilter{AffectedByGameUpdate: &yes, Limit: 1, UserID: 1})
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(rows) != 1 {
		t.Fatalf("limit=1 の行数 = %d, want 1", len(rows))
	}
	n, err := repo.Count(ctx, comborepo.ListFilter{AffectedByGameUpdate: &yes, UserID: 1})
	if err != nil {
		t.Fatalf("count: %v", err)
	}
	if n != 3 {
		t.Errorf("★総数 = %d, want 3。⇒ 一覧のページ件数で代用していないこと", n)
	}
}

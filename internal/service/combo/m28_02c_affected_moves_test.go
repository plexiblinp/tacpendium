package combo_test

import (
	"context"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
	comborepo "github.com/plexiblinp/tacpendium/internal/repository/combo"
)

// M28-02c: ComboResponse.affectedMoves の中身(CHANGE-162 §1.2)。
//
// ★★本サブの目的そのものである —— 「影響がある」と言うだけでは利用者は直せない。
//   どの技が変わったかを出すことが FR702 の目的である。
// ★★真偽の正本は affectedByGameUpdate の 1 本であり、列挙の長さではない。
//   本ファイルは「真偽と列挙が同じ 1 本の述語から導かれている」ことを実 DB で確かめる。

// TestAffectedMoves_ListsOnlyTheMovesThatChanged は列挙が判定と一致することを固定する。
func TestAffectedMoves_ListsOnlyTheMovesThatChanged(t *testing.T) {
	db, svc := newSvc(t)
	ctx := context.Background()
	repo := comborepo.New(db)

	created, res, err := svc.Create(ctx, validRyuInput(t, db))
	if err != nil || created == nil {
		t.Fatalf("create: err=%v issues=%v", err, res.Issues)
	}
	move1 := lookupMoveID(t, db, 1, "standing_light_punch")
	move2 := lookupMoveID(t, db, 1, "hadoken_light")

	// ★初回は必ず 0 件である(D-725: 既存コンボの基準は最新)。
	//   ⇒ 「0 件だったから正しい」は証拠にならないので、ここから人工的に古い基準を作る。
	got, err := repo.FindByID(ctx, created.ID)
	if err != nil {
		t.Fatalf("find: %v", err)
	}
	if got.AffectedByGameUpdate {
		t.Fatal("★前提が崩れている: マーカーを立てる前に影響ありになっている")
	}
	if got.AffectedMoves == nil {
		t.Error("★空でも nil ではなく空スライスであること(応答で [] を明示するため)")
	}
	if len(got.AffectedMoves) != 0 {
		t.Errorf("マーカーを立てる前の affectedMoves = %v, want 空", got.AffectedMoves)
	}

	// 2 技目だけを変え、基準をその手前へ置く。
	setMarker(t, db, move2, "2026.09.01.00")
	setBaseline(t, db, created.ID, "2026.08.03.01")

	got, err = repo.FindByID(ctx, created.ID)
	if err != nil {
		t.Fatalf("find: %v", err)
	}
	if !got.AffectedByGameUpdate {
		t.Fatal("★真偽が false のままである(判定側が動いていない)")
	}
	if len(got.AffectedMoves) != 1 {
		t.Fatalf("affectedMoves の件数 = %d, want 1 (%+v)", len(got.AffectedMoves), got.AffectedMoves)
	}
	am := got.AffectedMoves[0]
	if am.MoveID != move2 {
		t.Errorf("moveId = %d, want %d(変わった技だけを出すこと)", am.MoveID, move2)
	}
	if am.MoveID == move1 {
		t.Error("★変わっていない技まで出ている")
	}
	if am.Code == "" {
		t.Error("code が空である(名前が引けないときのフォールバック先が無くなる)")
	}
	if am.LastChangedGameVersion != "2026.09.01.00" {
		t.Errorf("lastChangedGameVersion = %q, want %q", am.LastChangedGameVersion, "2026.09.01.00")
	}

	// ★1 技目にもマーカーを立てれば 2 件になる(列挙が EXISTS の真偽で頭打ちにならない)。
	setMarker(t, db, move1, "2026.09.02.00")
	got, err = repo.FindByID(ctx, created.ID)
	if err != nil {
		t.Fatalf("find: %v", err)
	}
	if len(got.AffectedMoves) != 2 {
		t.Errorf("2 技とも変わったときの件数 = %d, want 2 (%+v)", len(got.AffectedMoves), got.AffectedMoves)
	}
}

// TestAffectedMoves_AgreesWithTheBooleanOnEveryRow は「真偽と列挙が食い違わない」ことを
// 判定表の全行で主張する(チェックリスト §1-1 / §0.4-1)。
//
// ★★食い違いは特定の関係のときだけ起きる。⇒ 素のデータでは検出できない。
func TestAffectedMoves_AgreesWithTheBooleanOnEveryRow(t *testing.T) {
	db, svc := newSvc(t)
	ctx := context.Background()
	repo := comborepo.New(db)

	created, res, err := svc.Create(ctx, validRyuInput(t, db))
	if err != nil || created == nil {
		t.Fatalf("create: err=%v issues=%v", err, res.Issues)
	}
	move2 := lookupMoveID(t, db, 1, "hadoken_light")

	cases := []struct {
		name     string
		marker   any
		baseline any
		want     bool
	}{
		{"マーカーが基準より新しい", "2026.09.01.00", "2026.08.03.01", true},
		{"マーカーが基準より古い", "2026.07.01.00", "2026.08.03.01", false},
		{"マーカーと基準が同じ", "2026.08.03.01", "2026.08.03.01", false},
		{"マーカーが NULL", nil, "2026.08.03.01", false},
		{"基準が NULL・マーカーあり", "2026.08.03.01", nil, true},
		{"基準が NULL・マーカーも NULL", nil, nil, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			setMarker(t, db, move2, tc.marker)
			setBaseline(t, db, created.ID, tc.baseline)

			got, err := repo.FindByID(ctx, created.ID)
			if err != nil {
				t.Fatalf("find: %v", err)
			}
			if got.AffectedByGameUpdate != tc.want {
				t.Fatalf("affectedByGameUpdate = %v, want %v", got.AffectedByGameUpdate, tc.want)
			}
			// ★★真偽と列挙は同じ 1 本の述語から出ている。⇒ 片方だけが動くことは無い。
			hasMoves := len(got.AffectedMoves) > 0
			if hasMoves != got.AffectedByGameUpdate {
				t.Errorf("★真偽(%v)と列挙(%d 件)が食い違っている。⇒ 判定式が 2 本に割れている疑い",
					got.AffectedByGameUpdate, len(got.AffectedMoves))
			}
		})
	}
}

// TestAffectedMoves_IgnoresNonMoveSteps は move_id が NULL のステップが列挙に入らないことを
// 固定する(JOIN moves で構造的に落ちる)。
func TestAffectedMoves_IgnoresNonMoveSteps(t *testing.T) {
	db, svc := newSvc(t)
	ctx := context.Background()
	repo := comborepo.New(db)

	move1 := lookupMoveID(t, db, 1, "standing_light_punch")
	move2 := lookupMoveID(t, db, 1, "hadoken_light")
	input := validRyuInput(t, db)
	// 3 ステップ目として非技ステップ(move_id なし)を足す。
	input.Steps = append(input.Steps, model.ComboStep{
		StepOrder: 3, MoveID: nil, Modifiers: &model.Modifiers{Type: "cancel_drive_rush"},
	})

	created, res, err := svc.Create(ctx, input)
	if err != nil || created == nil {
		t.Fatalf("create: err=%v issues=%v", err, res.Issues)
	}
	setMarker(t, db, move1, "2026.09.01.00")
	setMarker(t, db, move2, "2026.09.01.00")
	setBaseline(t, db, created.ID, "2026.08.03.01")

	got, err := repo.FindByID(ctx, created.ID)
	if err != nil {
		t.Fatalf("find: %v", err)
	}
	if len(got.AffectedMoves) != 2 {
		t.Errorf("件数 = %d, want 2(非技ステップは判定にも列挙にも入らない): %+v",
			len(got.AffectedMoves), got.AffectedMoves)
	}
}

// TestAffectedMoves_ListIsBatched は一覧経路でも列挙が載ること、および
// 該当が無いときはキーが空スライスであることを固定する。
func TestAffectedMoves_ListIsBatched(t *testing.T) {
	db, svc := newSvc(t)
	ctx := context.Background()
	repo := comborepo.New(db)

	a, res, err := svc.Create(ctx, validRyuInput(t, db))
	if err != nil || a == nil {
		t.Fatalf("create a: err=%v issues=%v", err, res.Issues)
	}
	otherIn := validRyuInput(t, db)
	otherIn.Position = ptr("corner_self")
	b, res, err := svc.Create(ctx, otherIn)
	if err != nil || b == nil {
		t.Fatalf("create b: err=%v issues=%v", err, res.Issues)
	}

	move2 := lookupMoveID(t, db, 1, "hadoken_light")
	setMarker(t, db, move2, "2026.09.01.00")
	setBaseline(t, db, a.ID, "2026.08.03.01") // 古い ⇒ 影響あり
	setBaseline(t, db, b.ID, "2026.09.01.00") // 同値 ⇒ 影響なし

	list, err := repo.List(ctx, comborepo.ListFilter{UserID: 1})
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(list) != 2 {
		t.Fatalf("一覧の件数 = %d, want 2", len(list))
	}
	for _, c := range list {
		if c.AffectedMoves == nil {
			t.Errorf("combo %d: affectedMoves が nil(空でも空スライスであること)", c.ID)
			continue
		}
		switch c.ID {
		case a.ID:
			if len(c.AffectedMoves) != 1 {
				t.Errorf("影響ありの行の件数 = %d, want 1", len(c.AffectedMoves))
			}
		case b.ID:
			if len(c.AffectedMoves) != 0 {
				t.Errorf("影響なしの行の件数 = %d, want 0", len(c.AffectedMoves))
			}
		}
	}
}

// TestDeleteAndRestore_DoesNotTouchBaseline は「削除して復元しても基準は最新化されない」
// ことを実 DB で固定する(M28-02c: 専用画面へ［削除］を出すにあたっての前提)。
//
// ★★ここが崩れると、影響コンボを 1 度ゴミ箱へ入れて戻しただけで「確認済み」に化ける。
//
//	⇒ 利用者が中身を見ていないのに警告が消える。FR307 の向きに反する。
//
// ★実装上の根拠＝基準を書く本番コードは 2 か所しか無い(INSERT の COALESCE と
//
//	AdvanceBaselineVersion)。削除も復元も deleted_at / updated_at しか触らない。
func TestDeleteAndRestore_DoesNotTouchBaseline(t *testing.T) {
	db, svc := newSvc(t)
	ctx := context.Background()
	repo := comborepo.New(db)

	created, res, err := svc.Create(ctx, validRyuInput(t, db))
	if err != nil || created == nil {
		t.Fatalf("create: err=%v issues=%v", err, res.Issues)
	}
	move2 := lookupMoveID(t, db, 1, "hadoken_light")
	setMarker(t, db, move2, "2026.09.01.00")
	setBaseline(t, db, created.ID, "2026.08.03.01")

	before, err := repo.FindByID(ctx, created.ID)
	if err != nil {
		t.Fatalf("find: %v", err)
	}
	if !before.AffectedByGameUpdate {
		t.Fatal("★前提が崩れている: 削除する前に影響ありになっていない")
	}

	// 削除 ⇒ 件数から外れる(母集団は deleted_at IS NULL)。
	if err := svc.Delete(ctx, created.ID); err != nil {
		t.Fatalf("delete: %v", err)
	}
	yes := true
	n, err := repo.Count(ctx, comborepo.ListFilter{AffectedByGameUpdate: &yes, UserID: 1})
	if err != nil {
		t.Fatalf("count after delete: %v", err)
	}
	if n != 0 {
		t.Errorf("削除後の件数 = %d, want 0(ゴミ箱の行は数えない)", n)
	}

	// ★ゴミ箱の行でも判定そのものは生きている(印は出る。ボタンだけ出さない)。
	trashed, err := repo.FindByIDAllowDeleted(ctx, created.ID)
	if err != nil {
		t.Fatalf("find deleted: %v", err)
	}
	if !trashed.AffectedByGameUpdate {
		t.Error("★ゴミ箱の行で判定が消えている(判定式は deleted_at を見ないはず)")
	}

	// 復元 ⇒ 基準はそのままで、件数も元へ戻る。
	if _, err := svc.Restore(ctx, created.ID); err != nil {
		t.Fatalf("restore: %v", err)
	}
	after, err := repo.FindByID(ctx, created.ID)
	if err != nil {
		t.Fatalf("find after restore: %v", err)
	}
	if got, want := derefStr(after.BaselineVersion), derefStr(before.BaselineVersion); got != want {
		t.Errorf("★★復元で基準が動いた: %q → %q。⇒ 見ていないのに「確認済み」に化ける", want, got)
	}
	if !after.AffectedByGameUpdate {
		t.Error("★復元したのに影響ありへ戻っていない")
	}
	n, err = repo.Count(ctx, comborepo.ListFilter{AffectedByGameUpdate: &yes, UserID: 1})
	if err != nil {
		t.Fatalf("count after restore: %v", err)
	}
	if n != 1 {
		t.Errorf("復元後の件数 = %d, want 1", n)
	}
}

func derefStr(s *string) string {
	if s == nil {
		return "<nil>"
	}
	return *s
}

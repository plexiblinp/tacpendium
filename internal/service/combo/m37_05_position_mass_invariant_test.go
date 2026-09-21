package combo_test

import (
	"context"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
	comborepo "github.com/plexiblinp/tacpendium/internal/repository/combo"
	combosvc "github.com/plexiblinp/tacpendium/internal/service/combo"
)

// M37-05: 始動位置のマス数の不変条件(P-60 の決着・D-864)。
//
// ★★★不変条件は 1 行である:
//
//	start_position_mass IS NULL  ⇔  position = 不問
//
// ⇒ 区分が決まっているならマス数は必ず値を持ち、マス数が空なら区分は不問である。
//
// ★★着手前、この不変条件は POST / PUT では成り立っていた —— 両経路が
//   normalizePositionAndMass を呼ぶためである。★穴は PATCH 経路 1 本だけであった
//   (CHANGE-195 §2.3 の「持たせなかった分岐 1」)。本サブが埋めたのはそこだけである。
//
// ★★NULL に 2 つ目の意味(「未測定」「クリア済み」等)は持たせない(指示書 §4.2)。
//   足すと、区分が決まっている行の NULL が「意味のある空」に見え、本サブが消した状態が戻る。

// ---------------------------------------------------------------------------
// 束 B: 不変条件そのもの
// ---------------------------------------------------------------------------

// TestInvariant_AllThreePaths は POST / PATCH / PUT の 3 経路すべてで不変条件が
// 成り立つことを 1 本で確かめる(指示書 §5-1・チェックリスト B-1)。
//
// ★1 経路だけで閉じさせないために 3 経路を同じ表で回す。
func TestInvariant_AllThreePaths(t *testing.T) {
	t.Run("POST: 区分あり・マス数なし ⇒ 代表値が入る", func(t *testing.T) {
		db, svc := newSvc(t)
		ctx := context.Background()

		in := validRyuInput(t, db)
		in.Position = ptr("mid_screen")
		in.StartPositionMass = nil
		saved, _, err := svc.Create(ctx, in)
		if err != nil {
			t.Fatalf("create: %v", err)
		}
		assertMass(t, "POST", saved.StartPositionMass, ptr(80))
		assertPosition(t, "POST", saved.Position, ptr("mid_screen"))
	})

	t.Run("POST: 不問・マス数なし ⇒ どちらも NULL のまま", func(t *testing.T) {
		db, svc := newSvc(t)
		ctx := context.Background()

		in := validRyuInput(t, db)
		in.Position = nil
		in.StartPositionMass = nil
		saved, _, err := svc.Create(ctx, in)
		if err != nil {
			t.Fatalf("create: %v", err)
		}
		assertMass(t, "POST(不問)", saved.StartPositionMass, nil)
		assertPosition(t, "POST(不問)", saved.Position, nil)
	})

	t.Run("PATCH: 区分あり・マス数を明示クリア ⇒ 代表値が入る", func(t *testing.T) {
		db, svc := newSvc(t)
		ctx := context.Background()

		saved := mustCreate(t, ctx, svc, withPosition(validRyuInput(t, db), ptr("corner_self"), ptr(5)))
		got := mustPatch(t, ctx, svc, saved.ID, saved.Version, combosvc.UpdateMetadataInput{
			StartPositionMass: comborepo.Null[int](),
		})
		assertMass(t, "PATCH(明示クリア)", got.StartPositionMass, ptr(12))
		assertPosition(t, "PATCH(明示クリア)", got.Position, ptr("corner_self"))
	})

	t.Run("PUT: 区分あり・マス数なし ⇒ 代表値が入る", func(t *testing.T) {
		db, svc := newSvc(t)
		ctx := context.Background()

		saved := mustCreate(t, ctx, svc, withPosition(validRyuInput(t, db), ptr("mid_opponent"), ptr(95)))

		// ★識別キー(hit_type)を変えて PUT 経路を通す。マス数は送らない。
		changed := withPosition(validRyuInput(t, db), ptr("mid_opponent"), nil)
		changed.HitType = ptr("counter")
		got, result, err := svc.UpdateWithKeyChange(ctx, saved.ID, saved.Version, changed)
		if err != nil {
			t.Fatalf("UpdateWithKeyChange: %v", err)
		}
		if result.HasError() {
			t.Fatalf("unexpected validation error: %+v", result.Issues)
		}
		assertMass(t, "PUT", got.StartPositionMass, ptr(102))
		assertPosition(t, "PUT", got.Position, ptr("mid_opponent"))
	})
}

// TestPatch_ClearMass_FillsRepresentative は代表値 7 個すべてで補完が効くことを見る
// (指示書 §5-2・チェックリスト B-2)。
//
// ★代表値の表は 1 つの出所(model.PositionBands)から引く。ここで写経したのは
//
//	「補完が実際にその値になる」ことを外から固定するためであり、規則の第 3 の出所ではない。
func TestPatch_ClearMass_FillsRepresentative(t *testing.T) {
	cases := []struct {
		position string
		want     int
	}{
		{"corner_self", 12},
		{"corner_self_near", 36},
		{"mid_self", 58},
		{"mid_screen", 80},
		{"mid_opponent", 102},
		{"corner_opponent_near", 124},
		{"corner_opponent", 148},
	}
	for _, tc := range cases {
		t.Run(tc.position, func(t *testing.T) {
			db, svc := newSvc(t)
			ctx := context.Background()

			saved := mustCreate(t, ctx, svc, withPosition(validRyuInput(t, db), ptr(tc.position), nil))
			got := mustPatch(t, ctx, svc, saved.ID, saved.Version, combosvc.UpdateMetadataInput{
				StartPositionMass: comborepo.Null[int](),
			})
			assertMass(t, "PATCH "+tc.position, got.StartPositionMass, &tc.want)
			assertPosition(t, "PATCH "+tc.position, got.Position, ptr(tc.position))
		})
	}
}

// TestPatch_Unspecified_StaysNull は「不問の行は埋めない」ことを見る
// (指示書 §2.2-2 / §5-2・チェックリスト B-3)。
//
// ★★★これは A-4「補完を外すと NULL のまま」の対照でもある ——
//
//	補完が無条件に走るなら、この行にも何かが入ってしまう。
//	⇒ 入らないことが「補完は区分が在るときだけ効く」ことの証拠になる。
func TestPatch_Unspecified_StaysNull(t *testing.T) {
	db, svc := newSvc(t)
	ctx := context.Background()

	saved := mustCreate(t, ctx, svc, withPosition(validRyuInput(t, db), nil, nil))
	assertPosition(t, "作成直後", saved.Position, nil)

	// (a) 明示クリア
	got := mustPatch(t, ctx, svc, saved.ID, saved.Version, combosvc.UpdateMetadataInput{
		StartPositionMass: comborepo.Null[int](),
	})
	assertMass(t, "PATCH(不問・明示クリア)", got.StartPositionMass, nil)
	assertPosition(t, "PATCH(不問・明示クリア)", got.Position, nil)

	// (b) キー不在(メモだけ)
	got = mustPatch(t, ctx, svc, got.ID, got.Version, combosvc.UpdateMetadataInput{
		Memo: comborepo.Some("不問のまま"),
	})
	assertMass(t, "PATCH(不問・キー不在)", got.StartPositionMass, nil)
	assertPosition(t, "PATCH(不問・キー不在)", got.Position, nil)
}

// TestPatch_MemoOnly_FillsFromDBPosition は「キー不在でも埋まる」ことを見る
// (指示書 §2.2-1′・チェックリスト B-4)。
//
// ★★★これは意図した形である(D-864)。メモだけを直す PATCH でも、元が NULL で
//
//	position が区分なら代表値が入る。★PUT は着手前からそう振る舞っており
//	(hit_type を変えるだけでマス数が埋まった)、本サブはそこへ寄せた。
func TestPatch_MemoOnly_FillsFromDBPosition(t *testing.T) {
	db, svc := newSvc(t)
	ctx := context.Background()

	// ★元から NULL の行を作る。★Create は normalize で埋めてしまうため、
	//   いったん作ってから PATCH で明示クリアしても代表値が入る ——
	//   ⇒ 「元から NULL」を作れるのは position が不問の行だけである。
	//   そこで position を持つ行を作り、DB を直接叩いてマス数を NULL に戻す。
	saved := mustCreate(t, ctx, svc, withPosition(validRyuInput(t, db), ptr("mid_self"), ptr(55)))
	if _, err := db.Exec(`UPDATE combos SET start_position_mass = NULL WHERE id = ?`, saved.ID); err != nil {
		t.Fatalf("force NULL: %v", err)
	}
	before, err := svc.Get(ctx, saved.ID, 1)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	assertMass(t, "前提(強制 NULL)", before.StartPositionMass, nil)

	got := mustPatch(t, ctx, svc, before.ID, before.Version, combosvc.UpdateMetadataInput{
		Memo: comborepo.Some("メモだけ直す"),
	})
	assertMass(t, "PATCH(メモだけ)", got.StartPositionMass, ptr(58))
	assertPosition(t, "PATCH(メモだけ)", got.Position, ptr("mid_self"))
	if got.Memo == nil || *got.Memo != "メモだけ直す" {
		t.Errorf("memo = %v, want %q", got.Memo, "メモだけ直す")
	}
}

// ---------------------------------------------------------------------------
// 束 A: PATCH から position が動かないこと(★最重要)
// ---------------------------------------------------------------------------

// TestPatch_CrossBandMass_DoesNotMovePosition は本サブ最大の危険に対する破壊確認である
// (指示書 §4.1 / §5-3・チェックリスト A-3)。
//
// ★★★normalizePositionAndMass をそのまま PATCH から呼ぶと、区分をまたぐマス数が
//
//	届いたときに position が導出し直される。position は重複判定キーであり、動くと
//	(1) 既存行と重複キーが衝突しうる (2) PUT〔旧行を論理削除して新規行を作る〕を
//	通らないため履歴の作られ方が変わる (3) PATCH の契約が嘘になる。
//
// ★画面からは起きない(フロントが区分をまたぐ変更を PUT へ振り分ける)。
//
//	⇒ それでも契約として押さえる。本テストが赤くなったら、補完に導出が混ざっている。
func TestPatch_CrossBandMass_DoesNotMovePosition(t *testing.T) {
	db, svc := newSvc(t)
	ctx := context.Background()

	saved := mustCreate(t, ctx, svc, withPosition(validRyuInput(t, db), ptr("mid_screen"), ptr(80)))

	// 区分をまたぐ 12(= corner_self の代表値)を投げる。
	got := mustPatch(t, ctx, svc, saved.ID, saved.Version, combosvc.UpdateMetadataInput{
		StartPositionMass: comborepo.Some(12),
	})
	assertPosition(t, "PATCH(区分またぎ)", got.Position, ptr("mid_screen"))
	assertMass(t, "PATCH(区分またぎ)", got.StartPositionMass, ptr(12))

	// ★DB から読み直しても position が動いていないこと。
	reread, err := svc.Get(ctx, saved.ID, 1)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	assertPosition(t, "再読込(区分またぎ)", reread.Position, ptr("mid_screen"))
	assertMass(t, "再読込(区分またぎ)", reread.StartPositionMass, ptr(12))
}

// ---------------------------------------------------------------------------
// 束 C: 運び量(触っていないこと)
// ---------------------------------------------------------------------------

// TestPatch_CarryDistanceMass_NeverFilled は運び量が 1 行も埋まらないことを見る
// (指示書 §0.5 / §5-4・チェックリスト C-1 / C-2 / C-3)。
//
// ★★★運び量は区分を持たない(D-731 不変条件 2)。⇒ 代表値という概念が存在しない。
//
//	★名前が似ているだけであり、「2 欄あるから両方そろえよう」は誤りである(指示書 §4.3)。
func TestPatch_CarryDistanceMass_NeverFilled(t *testing.T) {
	db, svc := newSvc(t)
	ctx := context.Background()

	// ★position は区分を持つ行にする。⇒ 始動位置だけが埋まり、運び量は埋まらないこと。
	in := withPosition(validRyuInput(t, db), ptr("corner_opponent"), ptr(150))
	in.CarryDistanceMass = ptr(60)
	saved := mustCreate(t, ctx, svc, in)

	got := mustPatch(t, ctx, svc, saved.ID, saved.Version, combosvc.UpdateMetadataInput{
		StartPositionMass: comborepo.Null[int](),
		CarryDistanceMass: comborepo.Null[int](),
	})
	assertMass(t, "始動位置", got.StartPositionMass, ptr(148))
	if got.CarryDistanceMass != nil {
		t.Errorf("carryDistanceMass = %v, want nil (運び量は埋めない)", *got.CarryDistanceMass)
	}

	// ★キー不在のときも埋まらないこと。
	got = mustPatch(t, ctx, svc, got.ID, got.Version, combosvc.UpdateMetadataInput{
		Memo: comborepo.Some("運び量は触らない"),
	})
	if got.CarryDistanceMass != nil {
		t.Errorf("carryDistanceMass(キー不在) = %v, want nil", *got.CarryDistanceMass)
	}
}

// ---------------------------------------------------------------------------
// 束 A-5: PUT / POST の既存挙動が無傷であること
// ---------------------------------------------------------------------------

// TestNormalize_DerivationStillWorksOnCreateAndPut は、補完の半分を
// representativeMassFill へ切り出したことで導出の半分が壊れていないことを見る
// (チェックリスト A-5)。
//
// ★POST / PUT では「マス数が勝ち、position を導出して上書きする」。★この向きは変えていない。
func TestNormalize_DerivationStillWorksOnCreateAndPut(t *testing.T) {
	db, svc := newSvc(t)
	ctx := context.Background()

	// POST: position=mid_screen で作るが、マス数 12 を送る ⇒ position は corner_self へ導出される。
	in := withPosition(validRyuInput(t, db), ptr("mid_screen"), ptr(12))
	saved := mustCreate(t, ctx, svc, in)
	assertPosition(t, "POST(導出)", saved.Position, ptr("corner_self"))
	assertMass(t, "POST(導出)", saved.StartPositionMass, ptr(12))

	// PUT: マス数 150 を送る ⇒ position は corner_opponent へ導出される。
	changed := withPosition(validRyuInput(t, db), ptr("mid_screen"), ptr(150))
	got, result, err := svc.UpdateWithKeyChange(ctx, saved.ID, saved.Version, changed)
	if err != nil {
		t.Fatalf("UpdateWithKeyChange: %v", err)
	}
	if result.HasError() {
		t.Fatalf("unexpected validation error: %+v", result.Issues)
	}
	assertPosition(t, "PUT(導出)", got.Position, ptr("corner_opponent"))
	assertMass(t, "PUT(導出)", got.StartPositionMass, ptr(150))
}

// ---------------------------------------------------------------------------
// 補助
// ---------------------------------------------------------------------------

func withPosition(in combosvc.CreateInput, position *string, mass *int) combosvc.CreateInput {
	in.Position = position
	in.StartPositionMass = mass
	return in
}

func mustCreate(t *testing.T, ctx context.Context, svc combosvc.Service, in combosvc.CreateInput) *model.Combo {
	t.Helper()
	saved, result, err := svc.Create(ctx, in)
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if result.HasError() {
		t.Fatalf("create validation error: %+v", result.Issues)
	}
	return saved
}

func mustPatch(t *testing.T, ctx context.Context, svc combosvc.Service, id int64, version int, in combosvc.UpdateMetadataInput) *model.Combo {
	t.Helper()
	got, result, err := svc.UpdateMetadata(ctx, id, version, in)
	if err != nil {
		t.Fatalf("UpdateMetadata: %v", err)
	}
	if result.HasError() {
		t.Fatalf("patch validation error: %+v", result.Issues)
	}
	return got
}

func assertMass(t *testing.T, label string, got, want *int) {
	t.Helper()
	switch {
	case want == nil && got != nil:
		t.Errorf("%s: startPositionMass = %d, want nil", label, *got)
	case want != nil && got == nil:
		t.Errorf("%s: startPositionMass = nil, want %d", label, *want)
	case want != nil && got != nil && *got != *want:
		t.Errorf("%s: startPositionMass = %d, want %d", label, *got, *want)
	}
}

func assertPosition(t *testing.T, label string, got, want *string) {
	t.Helper()
	switch {
	case want == nil && got != nil:
		t.Errorf("%s: position = %q, want nil(不問)", label, *got)
	case want != nil && got == nil:
		t.Errorf("%s: position = nil, want %q", label, *want)
	case want != nil && got != nil && *got != *want:
		t.Errorf("%s: position = %q, want %q", label, *got, *want)
	}
}

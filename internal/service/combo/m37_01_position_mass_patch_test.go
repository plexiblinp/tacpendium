package combo_test

import (
	"context"
	"testing"

	comborepo "github.com/plexiblinp/tacpendium/internal/repository/combo"
	combosvc "github.com/plexiblinp/tacpendium/internal/service/combo"
)

// M37-01: PATCH(メタデータ編集)でマス数 2 列を保存できること。
//
// ★★着手前は UpdateMetadataRequest に 2 列が無く、POST と PUT にしかなかった。
//   ⇒ 編集モードでマス数・運び量だけを直すと値が黙って落ちた。
//   3 方式入力 UI を画面へ出す以上、メタデータ経路でも保存できる必要がある
//   (2026-09-13 開発者裁定。指示書 M37-01 §3-4 / §6-5 を承認で外した)。
//
// ★★PUT へ載せる案は採らなかった —— PUT(UpdateWithKeyChange)は旧行を論理削除して
//   新規行を作る経路であり、運び量は重複キーではないため、直しただけでコンボ id が
//   変わりゴミ箱へ積まれてしまう。
//
// ★★本経路は position を触らない。⇒ normalizePositionAndMass は Create と
//   UpdateWithKeyChange からしか呼ばれない(指示書 §3-1・差分 0)。区分をまたぐ
//   マス変更をフロントが PUT へ振り分けるのは、この非対称を前提にしている。
//
// ★★★2026-09-13 追記(M37-05 / D-864)—— 上の「position を触らない」は今も真だが、
//   **マス数はもう素通しではない。** 本経路は fillStartPositionMassForPatch を呼び、
//   **更新後のマス数が NULL になるとき、DB 上の position が区分なら代表値で埋める**。
//   ⇒ 不変条件 `start_position_mass IS NULL` ⇔ `position = 不問` を PATCH でも守るためである。
//   ★position は依然として 1 バイトも書かない(UpdateMetadataInput に Position 欄が無い)。
//   ★carry_distance_mass は埋めない(運び量は区分を持たない = D-731 不変条件 2)。
//   ★詳細と網羅的な試験は m37_05_position_mass_invariant_test.go にある。

func TestUpdateMetadata_PositionMass_Persists(t *testing.T) {
	db, svc := newSvc(t)
	ctx := context.Background()

	saved, _, err := svc.Create(ctx, validRyuInput(t, db))
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	got, result, err := svc.UpdateMetadata(ctx, saved.ID, saved.Version, combosvc.UpdateMetadataInput{
		StartPositionMass: comborepo.Some(80),
		CarryDistanceMass: comborepo.Some(45),
	})
	if err != nil {
		t.Fatalf("UpdateMetadata: %v", err)
	}
	if result.HasError() {
		t.Fatalf("unexpected validation error: %+v", result.Issues)
	}
	if got.StartPositionMass == nil || *got.StartPositionMass != 80 {
		t.Errorf("startPositionMass = %v, want 80", got.StartPositionMass)
	}
	if got.CarryDistanceMass == nil || *got.CarryDistanceMass != 45 {
		t.Errorf("carryDistanceMass = %v, want 45", got.CarryDistanceMass)
	}

	// ★DB から読み直しても残っていること(レスポンスだけの見せかけでないこと)。
	reread, err := svc.Get(ctx, saved.ID, 1)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if reread.StartPositionMass == nil || *reread.StartPositionMass != 80 {
		t.Errorf("reread startPositionMass = %v, want 80", reread.StartPositionMass)
	}
	if reread.CarryDistanceMass == nil || *reread.CarryDistanceMass != 45 {
		t.Errorf("reread carryDistanceMass = %v, want 45", reread.CarryDistanceMass)
	}
}

// present + null がトライステートとして届くこと。
//
// ★★★2026-09-13 改訂(M37-05 / D-864)—— **start_position_mass はもう「他の Optional 列と
//
//	同じ」ではない。** 区分が決まっている行では、明示クリアしても NULL にならず
//	**代表値が戻る**(fillStartPositionMassForPatch)。⇒ 本テストの fixture は
//	validRyuInput であり Position: "mid_screen" を持つため、代表値 80 が入る。
//
// ★★それでも本テストは価値を失っていない —— **carry_distance_mass が NULL になること**が、
//
//	「present + null が SET 句まで NULL として届いている」ことの証拠だからである。
//	⇒ 運び量は区分を持たず補完の対象外であり(D-731 不変条件 2)、トライステートの
//	  素の振る舞いが見えるのは今やこちらだけである。
//
// ★「明示クリアが NULL のまま残る」形は position が不問の行で見る。
//
//	⇒ m37_05_position_mass_invariant_test.go の TestPatch_Unspecified_StaysNull。
func TestUpdateMetadata_PositionMass_ClearsWithPresentNull(t *testing.T) {
	db, svc := newSvc(t)
	ctx := context.Background()

	saved, _, err := svc.Create(ctx, validRyuInput(t, db))
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	set, _, err := svc.UpdateMetadata(ctx, saved.ID, saved.Version, combosvc.UpdateMetadataInput{
		StartPositionMass: comborepo.Some(80),
		CarryDistanceMass: comborepo.Some(45),
	})
	if err != nil {
		t.Fatalf("UpdateMetadata(set): %v", err)
	}

	cleared, result, err := svc.UpdateMetadata(ctx, saved.ID, set.Version, combosvc.UpdateMetadataInput{
		StartPositionMass: comborepo.Null[int](),
		CarryDistanceMass: comborepo.Null[int](),
	})
	if err != nil {
		t.Fatalf("UpdateMetadata(clear): %v", err)
	}
	if result.HasError() {
		t.Fatalf("unexpected validation error: %+v", result.Issues)
	}
	// ★★始動位置は区分(mid_screen)が決まっているため、代表値 80 が戻る(M37-05 / D-864)。
	//   ⇒ ここが nil を期待したままだと、D-864 で意図的に変えた挙動を旧のまま固定してしまう。
	if cleared.StartPositionMass == nil || *cleared.StartPositionMass != 80 {
		t.Errorf("startPositionMass = %v, want 80 (mid_screen の代表値・M37-05)", cleared.StartPositionMass)
	}
	// ★★★運び量は埋めない。⇒ present + null が NULL として届いていることの証拠である。
	if cleared.CarryDistanceMass != nil {
		t.Errorf("carryDistanceMass = %v, want nil", *cleared.CarryDistanceMass)
	}
	// ★position は動いていないこと(本経路は識別キーを変えない)。
	if cleared.Position == nil || *cleared.Position != "mid_screen" {
		t.Errorf("position = %v, want %q", cleared.Position, "mid_screen")
	}
}

// ★★PATCH は position を書き換えない。
//
// これが本サブのフロント側の振り分け(effectivePosition)の前提である ——
// 区分をまたぐマス変更は PUT へ回し、区分内のマス変更だけを PATCH へ通す。
// 本テストが赤くなったら、その前提が崩れているので振り分けを見直すこと。
func TestUpdateMetadata_PositionMass_DoesNotDerivePosition(t *testing.T) {
	db, svc := newSvc(t)
	ctx := context.Background()

	in := validRyuInput(t, db)
	mid := "mid_screen"
	in.Position = &mid
	saved, _, err := svc.Create(ctx, in)
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	// 区分内(70〜90)の 85 へ動かす。
	got, _, err := svc.UpdateMetadata(ctx, saved.ID, saved.Version, combosvc.UpdateMetadataInput{
		StartPositionMass: comborepo.Some(85),
	})
	if err != nil {
		t.Fatalf("UpdateMetadata: %v", err)
	}
	if got.Position == nil || *got.Position != mid {
		t.Errorf("position = %v, want %q (PATCH は導出しない)", got.Position, mid)
	}
	if got.StartPositionMass == nil || *got.StartPositionMass != 85 {
		t.Errorf("startPositionMass = %v, want 85", got.StartPositionMass)
	}
}

package combo_test

import (
	"context"
	"database/sql"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
	comborepo "github.com/plexiblinp/tacpendium/internal/repository/combo"
	combosvc "github.com/plexiblinp/tacpendium/internal/service/combo"
	"github.com/plexiblinp/tacpendium/internal/service/validation"
)

// M28-02a: FR702 の判定(影響可能性あり)。
//
// ★★判定は保存せず導出する(checklist §5.1 確定事項 3)。
// ★★判定は「コンボが使っている move のうち、マーカーがコンボの基準より新しいものが
//   1 つでもあるか」である。★combo_steps を経由し、move_id が NULL の行は入らない。
// ★★NULL の向きは安全側である(指示書 §2.3-3 / FR307 と同じ向き):
//   - 基準が NULL   = 「いつの前提か分からない」⇒ 影響可能性ありに出す(出し漏らさない)
//   - マーカーが NULL = 「まだ一度も変わっていない」という既知の状態 ⇒ 影響なし
//   この 2 つは似て見えるが別物である。混同すると出し漏らすか、全件が出続けるかになる。

// setMarker は move にマーカーを立てる(配信者の操作を模す)。
func setMarker(t *testing.T, db *sql.DB, moveID int64, version any) {
	t.Helper()
	if _, err := db.Exec(`UPDATE moves SET last_changed_game_version = ? WHERE id = ?`, version, moveID); err != nil {
		t.Fatalf("set marker (move=%d, v=%v): %v", moveID, version, err)
	}
}

// setBaseline はコンボの基準を直接書き換える(登録時期の違いを模す)。
func setBaseline(t *testing.T, db *sql.DB, comboID int64, version any) {
	t.Helper()
	if _, err := db.Exec(`UPDATE combos SET baseline_version = ? WHERE id = ?`, version, comboID); err != nil {
		t.Fatalf("set baseline (combo=%d, v=%v): %v", comboID, version, err)
	}
}

func affectedOf(t *testing.T, db *sql.DB, comboID int64) bool {
	t.Helper()
	c, err := comborepo.New(db).FindByID(context.Background(), comboID)
	if err != nil {
		t.Fatalf("find combo %d: %v", comboID, err)
	}
	return c.AffectedByGameUpdate
}

// TestAffectedByGameUpdate_Matrix は判定の全組み合わせを固定する
// (チェックリスト §6-1: マーカーが 新しい／古い／同じ／NULL、基準が NULL)。
func TestAffectedByGameUpdate_Matrix(t *testing.T) {
	db, svc := newSvc(t)

	created, res, err := svc.Create(context.Background(), validRyuInput(t, db))
	if err != nil || created == nil {
		t.Fatalf("create: err=%v issues=%v", err, res.Issues)
	}
	// レシピの 2 技目。ここへマーカーを立てる。
	move2 := lookupMoveID(t, db, 1, "hadoken_light")

	cases := []struct {
		name     string
		marker   any // moves.last_changed_game_version
		baseline any // combos.baseline_version
		want     bool
		why      string
	}{
		{"マーカーが基準より新しい", "2026.09.01.00", "2026.08.03.01", true,
			"基準より後に技が変わった ⇒ 影響可能性あり"},
		{"マーカーが基準より古い", "2026.07.01.00", "2026.08.03.01", false,
			"技が変わったのは基準より前 ⇒ そのコンボは既にその変更を織り込んでいる"},
		{"マーカーと基準が同じ", "2026.08.03.01", "2026.08.03.01", false,
			"★同値は「新しい」ではない。基準より新しいものだけを出す"},
		{"マーカーが NULL", nil, "2026.08.03.01", false,
			"★NULL は「不明」ではなく「まだ一度も変わっていない」(D-725)。⇒ 影響なし"},
		{"基準が NULL・マーカーあり", "2026.08.03.01", nil, true,
			"★基準が不明 ⇒ 安全側に倒して出す(FR307 と同じ向き)"},
		{"基準が NULL・マーカーも NULL", nil, nil, false,
			"★変わった技が 1 つも無ければ、基準が不明でも出しようがない"},
		// ★アプリ版(後半 NN)だけの差も検出できること。
		// これが「日付だけ」ではなく NN まで持つ理由である(入力ミスの訂正・列追加)。
		{"アプリ版だけが進んだ", "2026.08.03.02", "2026.08.03.01", true,
			"★後半 NN の差 ⇒ 検出できる。バランス調整以外の版も表せる"},
		// ★"1.10" < "1.9" 型の誤りが起きないこと(固定幅ゼロ埋め)。
		{"版が 09 → 10 へ繰り上がった", "2026.08.03.10", "2026.08.03.09", true,
			`★"1.9" < "1.10" 型の誤りが起きないこと。ゼロ埋めで辞書順＝時系列順`},
		{"版が 10 → 09 の逆順", "2026.08.03.09", "2026.08.03.10", false,
			"★逆向きも正しく判定されること"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			setMarker(t, db, move2, tc.marker)
			setBaseline(t, db, created.ID, tc.baseline)
			if got := affectedOf(t, db, created.ID); got != tc.want {
				t.Errorf("affected = %v, want %v(%s)", got, tc.want, tc.why)
			}
		})
	}
}

// TestAffectedByGameUpdate_IgnoresNonMoveSteps は move_id が NULL のステップが
// 判定に入らないことを固定する(指示書 §2.3-2)。
//
// ★非技ステップ(ドライブラッシュ等)は moves を指さない。⇒ マーカーを持ちようがない。
func TestAffectedByGameUpdate_IgnoresNonMoveSteps(t *testing.T) {
	db, svc := newSvc(t)

	move1 := lookupMoveID(t, db, 1, "standing_light_punch")
	move2 := lookupMoveID(t, db, 1, "hadoken_light")
	input := validRyuInput(t, db)
	input.Steps = []model.ComboStep{
		{StepOrder: 1, MoveID: &move1},
		// ★move_id が NULL のステップ(DES-003 §3.5 の taxonomy)。
		{StepOrder: 2, MoveID: nil, Modifiers: &model.Modifiers{Type: "cancel_drive_rush"}},
		{StepOrder: 3, MoveID: &move2},
	}
	created, res, err := svc.Create(context.Background(), input)
	if err != nil || created == nil {
		t.Fatalf("create: err=%v issues=%v", err, res.Issues)
	}
	setBaseline(t, db, created.ID, "2026.08.03.01")

	// 技ステップにマーカーが無い状態では出ない。
	if affectedOf(t, db, created.ID) {
		t.Fatal("マーカーが 1 つも無いのに影響可能性ありになった")
	}
	// ★NULL ステップが在ることで判定が壊れていないこと(JOIN で落ちるだけ)。
	setMarker(t, db, move2, "2026.09.01.00")
	if !affectedOf(t, db, created.ID) {
		t.Error("技ステップのマーカーが判定に効いていない(NULL ステップに巻き込まれた)")
	}
	// ★ステップ数の内訳を記録に残す(検証が空回りしていないことの足場)。
	var withMove, withoutMove int
	if err := db.QueryRow(`SELECT
			SUM(CASE WHEN move_id IS NOT NULL THEN 1 ELSE 0 END),
			SUM(CASE WHEN move_id IS NULL THEN 1 ELSE 0 END)
		FROM combo_steps WHERE combo_id = ?`, created.ID).Scan(&withMove, &withoutMove); err != nil {
		t.Fatalf("count steps: %v", err)
	}
	if withMove != 2 || withoutMove != 1 {
		t.Fatalf("ステップの内訳が想定と違う(技=%d, 非技=%d)", withMove, withoutMove)
	}
}

// TestBaselineWrittenOnEveryCreationPath は「基準が入らない登録経路が無い」ことを固定する。
//
// ★★これが本サブで最も静かに壊れる形である。基準が NULL のコンボは安全側に倒れて
//
//	「影響可能性あり」へ出続けるため、1 経路でも抜けると一覧が使い物にならなくなる。
//
// ★先例 = `materialize-bypasses-required-fields`(followup): Materialize は
//
//	ValidateComboForCreate を通らないため、必須欄が空のまま在りうる。
func TestBaselineWrittenOnEveryCreationPath(t *testing.T) {
	db, svc := newSvc(t)
	ctx := context.Background()

	current := currentDataVersion(t, db)
	if current == "" {
		t.Fatal("games.current_data_version が空(前提が崩れている)")
	}

	baselineOf := func(id int64) string {
		var v sql.NullString
		if err := db.QueryRow(`SELECT baseline_version FROM combos WHERE id = ?`, id).Scan(&v); err != nil {
			t.Fatalf("baseline of %d: %v", id, err)
		}
		return v.String
	}

	// (1) POST /api/combos
	created, res, err := svc.Create(ctx, validRyuInput(t, db))
	if err != nil || created == nil {
		t.Fatalf("create: err=%v issues=%v", err, res.Issues)
	}
	if got := baselineOf(created.ID); got != current {
		t.Errorf("Create 経路: baseline = %q, want %q", got, current)
	}

	// (2) 仮登録(下書き)も同じ。★昇格時ではなく登録時に入る。
	draftInput := validRyuInput(t, db)
	draftInput.IsDraft = true
	draftInput.Position = ptr("corner_self")
	draft, res, err := svc.Create(ctx, draftInput)
	if err != nil || draft == nil {
		t.Fatalf("create draft: err=%v issues=%v", err, res.Issues)
	}
	if got := baselineOf(draft.ID); got != current {
		t.Errorf("仮登録経路: baseline = %q, want %q", got, current)
	}

	// (3) ★★Materialize。`gen := *base` の構造体まるごと複製であり、明示的に
	//     nil にしていなければ基底の基準をそのまま引き継ぐ。
	//     ⇒ 基底が古い前提のままだと、生成物まで古い前提を名乗る。
	setBaseline(t, db, created.ID, "2026.07.01.00") // 基底を意図的に古くする
	mat, _, err := svc.Materialize(ctx, combosvc.MaterializeInput{
		UserID:         1,
		BaseComboID:    created.ID,
		OpponentMoveID: oppMoveID(t, db),
	})
	if err != nil {
		t.Fatalf("materialize: %v", err)
	}
	if mat.AlreadyExisted {
		t.Fatal("materialize が既存を返した(新規生成の前提が崩れている)")
	}
	if got := baselineOf(mat.ComboID); got != current {
		t.Errorf("Materialize 経路: baseline = %q, want %q(基底の %q を引き継いでいる)",
			got, current, "2026.07.01.00")
	}
}

// TestAcknowledgeGameVersion は「確認した」が基準を現在版へ進めることを固定する。
func TestAcknowledgeGameVersion(t *testing.T) {
	db, svc := newSvc(t)
	ctx := context.Background()

	created, res, err := svc.Create(ctx, validRyuInput(t, db))
	if err != nil || created == nil {
		t.Fatalf("create: err=%v issues=%v", err, res.Issues)
	}
	move2 := lookupMoveID(t, db, 1, "hadoken_light")

	// 版が上がり、技が変わった状態を作る。
	//
	// ★★「現在版より確実に新しい」版を使う。固定値を書くと、マイグレが
	//   games.current_data_version を引き上げた瞬間に前提が崩れる
	//   (実測: -mode game-version のマイグレを 1 本足しただけで本テストが落ちた)。
	const bumped = "2099.12.31.99"
	if before := currentDataVersion(t, db); before >= bumped {
		t.Fatalf("前提: 現在版 %q が想定より新しい(テストの版を上げること)", before)
	}
	if _, err := db.Exec(`UPDATE games SET current_data_version = ? WHERE code='sf6'`, bumped); err != nil {
		t.Fatalf("bump game version: %v", err)
	}
	setMarker(t, db, move2, bumped)
	if !affectedOf(t, db, created.ID) {
		t.Fatal("前提: 影響可能性ありになっていること")
	}

	got, err := svc.AcknowledgeGameVersion(ctx, created.ID)
	if err != nil {
		t.Fatalf("acknowledge: %v", err)
	}
	if got.BaselineVersion == nil || *got.BaselineVersion != bumped {
		t.Errorf("基準が進んでいない: %v", got.BaselineVersion)
	}
	// ★進めた結果、判定が false になることを応答で返せること。
	if got.AffectedByGameUpdate {
		t.Error("確認した後も影響可能性ありのままになっている")
	}
	if affectedOf(t, db, created.ID) {
		t.Error("DB 上でも影響可能性ありのままになっている")
	}

	// ★他のコンボは巻き込まない(部分消化 = 1 件ずつ潰せること)。
	otherInput := validRyuInput(t, db)
	otherInput.Position = ptr("corner_opponent")
	other, res, err := svc.Create(ctx, otherInput)
	if err != nil || other == nil {
		t.Fatalf("create other: err=%v issues=%v", err, res.Issues)
	}
	// ★確実に bumped より古い基準にする(現在版の実値に依存させない)。
	setBaseline(t, db, other.ID, "2000.01.01.00")
	if !affectedOf(t, db, other.ID) {
		t.Fatal("前提: もう 1 件も影響可能性ありであること")
	}
	if _, err := svc.AcknowledgeGameVersion(ctx, created.ID); err != nil {
		t.Fatalf("acknowledge again: %v", err)
	}
	if !affectedOf(t, db, other.ID) {
		t.Error("★1 件を確認したら別のコンボまで確認済みになった(部分消化が壊れている)")
	}

	// 存在しない id は ErrNotFound。
	if _, err := svc.AcknowledgeGameVersion(ctx, 999999); err == nil {
		t.Error("存在しない id でエラーにならなかった")
	}
}

func currentDataVersion(t *testing.T, db *sql.DB) string {
	t.Helper()
	var v string
	if err := db.QueryRow(`SELECT current_data_version FROM games WHERE code='sf6'`).Scan(&v); err != nil {
		t.Fatalf("current data version: %v", err)
	}
	return v
}

// TestPositionMassRangeIsRejectedWithValidationError は、値域外のマス数が
// 400 相当（検証エラー）で弾かれることを固定する（レビュー 高 2）。
//
// ★★これが無いと DB の CHECK 違反になり、ハンドラの既定分岐で 500 になる。
// 「利用者が直せる入力ミス」を 500 で返すのは他の値域欄（VAL-C04 / C05 / C13）と扱いが違う。
func TestPositionMassRangeIsRejectedWithValidationError(t *testing.T) {
	db, svc := newSvc(t)
	ctx := context.Background()

	for _, tc := range []struct {
		name  string
		mut   func(in *combosvc.CreateInput)
		field string
	}{
		{"始動位置が上限超え", func(in *combosvc.CreateInput) { v := 161; in.StartPositionMass = &v }, "startPositionMass"},
		{"始動位置が負", func(in *combosvc.CreateInput) { v := -1; in.StartPositionMass = &v }, "startPositionMass"},
		{"運び量が上限超え", func(in *combosvc.CreateInput) { v := 500; in.CarryDistanceMass = &v }, "carryDistanceMass"},
		{"運び量が負", func(in *combosvc.CreateInput) { v := -5; in.CarryDistanceMass = &v }, "carryDistanceMass"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			in := validRyuInput(t, db)
			tc.mut(&in)
			created, res, err := svc.Create(ctx, in)
			if err != nil {
				t.Fatalf("Create が err を返した(検証エラーで返すこと): %v", err)
			}
			if created != nil {
				t.Fatalf("値域外なのに登録された(id=%d)", created.ID)
			}
			var found bool
			for _, iss := range res.Issues {
				if iss.Field == tc.field && iss.Severity == validation.SeverityError {
					found = true
				}
			}
			if !found {
				t.Errorf("%s の値域エラーが出ていない: %+v", tc.field, res.Issues)
			}
		})
	}

	// ★境界値は通る(厳しすぎないこと)。
	for _, v := range []int{0, 160} {
		in := validRyuInput(t, db)
		in.StartPositionMass = &v
		in.CarryDistanceMass = &v
		// ★重複を避けるため区分を散らす(マス数が position を上書きする)。
		created, res, err := svc.Create(ctx, in)
		if err != nil || created == nil {
			t.Fatalf("境界値 %d が弾かれた: err=%v issues=%+v", v, err, res.Issues)
		}
	}
}

// TestListFilterByAffectedByGameUpdate は一覧の絞り込みを実 DB で通す（レビュー 高 3）。
//
// ★★着手時、判定の WHERE 句は 1 度も実行されていなかった（SELECT の派生列だけが
// FindByID 経由で通っていた）。チェックリスト §6-4 の「テストが多いのに判定の入口を
// 1 度も通っていない」形そのものである。
func TestListFilterByAffectedByGameUpdate(t *testing.T) {
	db, svc := newSvc(t)
	ctx := context.Background()
	repo := comborepo.New(db)

	// 影響ありのコンボ（基準より新しいマーカーを持つ技を使う）。
	affected, res, err := svc.Create(ctx, validRyuInput(t, db))
	if err != nil || affected == nil {
		t.Fatalf("create affected: err=%v issues=%v", err, res.Issues)
	}
	// 影響なしのコンボ（別の区分にして重複を避ける）。
	otherIn := validRyuInput(t, db)
	otherIn.Position = ptr("corner_self")
	unaffected, res, err := svc.Create(ctx, otherIn)
	if err != nil || unaffected == nil {
		t.Fatalf("create unaffected: err=%v issues=%v", err, res.Issues)
	}

	// affected 側だけが使う技へマーカーを立てたいが、2 件は同じレシピである。
	// ⇒ 代わりに基準の側をずらす（判定は「基準 < マーカー」であり対称）。
	move2 := lookupMoveID(t, db, 1, "hadoken_light")
	setMarker(t, db, move2, "2026.09.01.00")
	setBaseline(t, db, affected.ID, "2026.08.03.01")   // 古い ⇒ 影響あり
	setBaseline(t, db, unaffected.ID, "2026.09.01.00") // 同値 ⇒ 影響なし

	ids := func(filter *bool) []int64 {
		got, err := repo.List(ctx, comborepo.ListFilter{AffectedByGameUpdate: filter, UserID: 1})
		if err != nil {
			t.Fatalf("list: %v", err)
		}
		out := make([]int64, 0, len(got))
		for _, c := range got {
			out = append(out, c.ID)
		}
		return out
	}

	yes, no := true, false
	if got := ids(&yes); len(got) != 1 || got[0] != affected.ID {
		t.Errorf("affected=true の結果 = %v, want [%d]", got, affected.ID)
	}
	if got := ids(&no); len(got) != 1 || got[0] != unaffected.ID {
		t.Errorf("affected=false の結果 = %v, want [%d]", got, unaffected.ID)
	}
	// ★絞り込みなしは両方返る(WHERE が常時効いていないこと)。
	if got := ids(nil); len(got) != 2 {
		t.Errorf("絞り込みなしの件数 = %d, want 2 (%v)", len(got), got)
	}
}

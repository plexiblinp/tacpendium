package combo_test

// ★M19-07: コンボと同梱で作るセットプレイの「確認できた条件」。
//
// 本サブは「セットプレイ単独作成にだけあった verifiedConditions を、コンボ同梱の口へ
// 揃える」ものである。サービス層(CreateSetupInTx)の配線は M19-03 の時点で既にあり、
// 欠けていたのは API 層の写像だけだった。したがって本ファイルは
//
//   - 同一トランザクションであること(コンボ作成が失敗したら結果行も残らない)
//   - 渡したセルと渡さなかったセルを「対で」固定すること(SUPP-001 §5.5.2 (3))
//   - ok 固定・note なしの非対称が維持されていること(指示書 §2.2)
//
// を、同梱経路で押さえる。
//
// ★HEAD 依存について: 本サブはマイグレを消費しない。以下のテストはいずれも
// 「このテストが作成したコンボ／セットプレイの行」しか数えず、seed 済みデータの件数を
// 期待値に持ち込まないため、後続の seed 波で落ちることはない(SUPP-001 §5.5.2 (1)(2))。

import (
	"context"
	"database/sql"
	"errors"
	"sort"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
	setupsvc "github.com/plexiblinp/tacpendium/internal/service/setup"
)

// cell はセル座標(受け身種別 × 画面端)。期待値を「組」で書くために使う。
type cell struct {
	TechType string
	InCorner bool
}

// allCells は値域の全 4 セル。渡さなかったセルを対で固定するために全数を持つ。
// 値域の正典は model.OkiTechTypes(BE)であり、FE の SETUP_RESULT_CELLS と一致する。
func allCells() []cell {
	var out []cell
	for _, tt := range model.OkiTechTypes {
		for _, ic := range []bool{false, true} {
			out = append(out, cell{TechType: tt, InCorner: ic})
		}
	}
	return out
}

// listSetupResultCells は 1 コンボ分の結果セルを (tech_type, in_corner) の組で返す。
// 「入った件数」ではなく「どのセルが入ったか」を比較するため、座標そのものを読む。
func listSetupResultCells(t *testing.T, db *sql.DB, comboID int64) []cell {
	t.Helper()
	rows, err := db.Query(
		`SELECT tech_type, in_corner FROM combo_setup_results WHERE combo_id = ?`, comboID)
	if err != nil {
		t.Fatalf("list setup result cells: %v", err)
	}
	defer rows.Close()

	var out []cell
	for rows.Next() {
		var c cell
		if err := rows.Scan(&c.TechType, &c.InCorner); err != nil {
			t.Fatalf("scan cell: %v", err)
		}
		out = append(out, c)
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("rows: %v", err)
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].TechType != out[j].TechType {
			return out[i].TechType < out[j].TechType
		}
		return !out[i].InCorner && out[j].InCorner
	})
	return out
}

// countAllSetupResults は DB 全体の結果行を数える。
// ロールバック検証ではコンボ ID が発番されない(あるいは巻き戻る)ため、
// comboID で絞ると「消えたのか、そもそも書かれなかったのか」を区別できない。
func countAllSetupResults(t *testing.T, db *sql.DB) int {
	t.Helper()
	var n int
	if err := db.QueryRow(`SELECT count(*) FROM combo_setup_results`).Scan(&n); err != nil {
		t.Fatalf("count all setup results: %v", err)
	}
	return n
}

func countAllComboSetups(t *testing.T, db *sql.DB) int {
	t.Helper()
	var n int
	if err := db.QueryRow(`SELECT count(*) FROM combo_setups`).Scan(&n); err != nil {
		t.Fatalf("count all combo_setups: %v", err)
	}
	return n
}

// bundledSetupWith は同梱セットプレイ 1 本ぶんの入力に成立条件を載せて返す。
func bundledSetupWith(t *testing.T, db *sql.DB, name string, conds ...cell) setupsvc.CreateSetupInput {
	t.Helper()
	return bundledSetupWithMove(t, db, name, "standing_light_punch", conds...)
}

// bundledSetupWithMove はレシピの技を選べる版である。
//
// ★★M24-13 §4.6: 同じ親コンボへ 2 本同梱するときはレシピを分けること。VAL-S04 は
// 名前を見ない(DES-006 §3)ため、名前だけ変えた同一レシピは重複である。
// ★以前は同一リクエスト内の 2 本目が見えず通っていた(判定が *sql.DB 直読みだった)。
func bundledSetupWithMove(t *testing.T, db *sql.DB, name string, moveCode string, conds ...cell) setupsvc.CreateSetupInput {
	t.Helper()
	in := validSetupInputWithDistinctRecipe(t, db, 1, moveCode)
	in.Name = ptr(name)
	for _, c := range conds {
		in.VerifiedConditions = append(in.VerifiedConditions,
			setupsvc.SetupResultCondition{TechType: c.TechType, InCorner: c.InCorner})
	}
	return in
}

// ---------------------------------------------------------------------------
// §4-1 同一トランザクション
// ---------------------------------------------------------------------------

// ★コンボ作成が失敗したとき、combo_setups も combo_setup_results も残らない。
// 1 本目のセットプレイに成立条件を載せ、2 本目をバリデーションエラーにして巻き戻す。
// 「結果行だけが親を失って残る」ことが起きないことを見ている(VAL-S05 / G-1)。
func TestService_Create_BundledVerifiedConditions_RolledBackWithCombo(t *testing.T) {
	db, svc := newSvcWithSetups(t)
	input := validRyuInput(t, db)
	input.Setups = []setupsvc.CreateSetupInput{
		bundledSetupWith(t, db, "成立条件つき",
			cell{model.OkiTechTypeNeutral, false},
			cell{model.OkiTechTypeBack, true},
		),
		// VAL-S02: レシピが空 = バリデーションエラーで Tx ごと巻き戻る。
		{CharacterID: 1, Name: ptr("壊し役"), Steps: []model.SetupStep{}},
	}

	got, result, err := svc.Create(context.Background(), input)
	if err != nil {
		t.Fatalf("expected no system error, got: %v", err)
	}
	if got != nil {
		t.Errorf("expected nil combo on validation error, got ID=%d", got.ID)
	}
	if !result.HasError() {
		t.Fatal("expected validation error")
	}

	if n := countCombos(t, db); n != 0 {
		t.Errorf("コンボが巻き戻っていない: %d 件, want 0", n)
	}
	if n := countSetups(t, db); n != 0 {
		t.Errorf("セットプレイが巻き戻っていない: %d 件, want 0", n)
	}
	if n := countAllComboSetups(t, db); n != 0 {
		t.Errorf("combo_setups が巻き戻っていない: %d 行, want 0", n)
	}
	// ★本サブの中心。1 本目の成立条件だけが残ると、親を失った検証結果になる。
	if n := countAllSetupResults(t, db); n != 0 {
		t.Errorf("combo_setup_results が巻き戻っていない: %d 行, want 0", n)
	}
}

// 別のバリデーションエラー(VAL-S01: 存在しないキャラクター指定)で落ちた場合も同じく残らない。
// 上のテストが「2 本目が壊れて 1 本目が巻き戻る」形なのに対し、こちらは
// 「成立条件を載せた当の 1 本が壊れる」形を見ている。
func TestService_Create_BundledVerifiedConditions_RolledBackOnCharacterMismatch(t *testing.T) {
	db, svc := newSvcWithSetups(t)
	input := validRyuInput(t, db)
	s := bundledSetupWith(t, db, "キャラ不一致", cell{model.OkiTechTypeNeutral, false})
	s.CharacterID = 99999
	input.Setups = []setupsvc.CreateSetupInput{s}

	if _, result, err := svc.Create(context.Background(), input); err != nil {
		t.Fatalf("expected no system error, got: %v", err)
	} else if !result.HasError() {
		t.Fatal("expected validation error")
	}

	if n := countAllSetupResults(t, db); n != 0 {
		t.Errorf("combo_setup_results が残っている: %d 行, want 0", n)
	}
	if n := countCombos(t, db); n != 0 {
		t.Errorf("コンボが残っている: %d 件, want 0", n)
	}
}

// ---------------------------------------------------------------------------
// §4-2 / §4-4 / §4-5 記録されるセル・されないセル・ok 固定
// ---------------------------------------------------------------------------

// ★渡したセルと渡さなかったセルを対で固定する(SUPP-001 §5.5.2 (3))。
// 「入った件数」だけでは、条件を広く当てすぎても検出できない
// (4 セル全部に入れても件数 2 のテストは書けてしまう、という誤りを防ぐ)。
func TestService_Create_BundledVerifiedConditions_RecordsOnlyGivenCells(t *testing.T) {
	db, svc := newSvcWithSetups(t)

	// 4 セル中 2 セルだけ渡す。対角に取り、受け身種別・画面端のどちらの軸でも
	// 「広く当てる」誤りが検出できるようにする。
	given := []cell{
		{model.OkiTechTypeNeutral, false},
		{model.OkiTechTypeBack, true},
	}
	notGiven := []cell{
		{model.OkiTechTypeNeutral, true},
		{model.OkiTechTypeBack, false},
	}

	input := validRyuInput(t, db)
	input.Setups = []setupsvc.CreateSetupInput{
		bundledSetupWith(t, db, "対角 2 セル", given...),
	}

	got, result, err := svc.Create(context.Background(), input)
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if result.HasError() {
		t.Fatalf("unexpected validation: %+v", result.Issues)
	}

	// (a) 入ったセルの「組」が期待と完全一致すること。
	want := []cell{
		{model.OkiTechTypeBack, true},
		{model.OkiTechTypeNeutral, false},
	}
	gotCells := listSetupResultCells(t, db, got.ID)
	if len(gotCells) != len(want) {
		t.Fatalf("記録されたセル = %v, want %v", gotCells, want)
	}
	for i := range want {
		if gotCells[i] != want[i] {
			t.Fatalf("記録されたセル = %v, want %v", gotCells, want)
		}
	}

	// (b) 渡さなかったセルに 1 行も無いこと(未検証は行の有無で表現する)。
	for _, c := range notGiven {
		var n int
		if err := db.QueryRow(
			`SELECT count(*) FROM combo_setup_results
			 WHERE combo_id = ? AND tech_type = ? AND in_corner = ?`,
			got.ID, c.TechType, c.InCorner).Scan(&n); err != nil {
			t.Fatalf("count cell %v: %v", c, err)
		}
		if n != 0 {
			t.Errorf("渡していないセル %v に %d 行入っている, want 0", c, n)
		}
	}

	// (c) 値域の全 4 セルのうち、渡した 2 セルだけが埋まっている(取りこぼし防止)。
	if len(allCells()) != len(given)+len(notGiven) {
		t.Fatalf("値域が 4 セルでない: %v。given/notGiven の網羅が崩れている", allCells())
	}
}

// ★ok 固定・note なしの非対称は維持する(指示書 §2.2 / R-3)。
func TestService_Create_BundledVerifiedConditions_OnlyOkNoNote(t *testing.T) {
	db, svc := newSvcWithSetups(t)
	input := validRyuInput(t, db)
	input.Setups = []setupsvc.CreateSetupInput{
		bundledSetupWith(t, db, "ok のみ",
			cell{model.OkiTechTypeNeutral, false},
			cell{model.OkiTechTypeNeutral, true},
		),
	}

	got, result, err := svc.Create(context.Background(), input)
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if result.HasError() {
		t.Fatalf("unexpected validation: %+v", result.Issues)
	}

	var notOK int
	if err := db.QueryRow(
		`SELECT count(*) FROM combo_setup_results WHERE combo_id = ? AND result <> 'ok'`,
		got.ID).Scan(&notOK); err != nil {
		t.Fatalf("count non-ok: %v", err)
	}
	if notOK != 0 {
		t.Errorf("ok 以外が %d 行入っている, want 0", notOK)
	}

	var withNote int
	if err := db.QueryRow(
		`SELECT count(*) FROM combo_setup_results WHERE combo_id = ? AND note IS NOT NULL`,
		got.ID).Scan(&withNote); err != nil {
		t.Fatalf("count note: %v", err)
	}
	if withNote != 0 {
		t.Errorf("note が %d 行書かれている, want 0", withNote)
	}
}

// 同梱セットプレイが複数あるとき、成立条件はそれぞれの setup_id に振り分けられる。
func TestService_Create_BundledVerifiedConditions_PerSetup(t *testing.T) {
	db, svc := newSvcWithSetups(t)
	input := validRyuInput(t, db)
	input.Setups = []setupsvc.CreateSetupInput{
		bundledSetupWith(t, db, "setup A", cell{model.OkiTechTypeNeutral, false}),
		// ★M24-13: 2 本目はレシピを分ける(VAL-S04 は名前を見ない)。
		bundledSetupWithMove(t, db, "setup B", "standing_medium_punch",
			cell{model.OkiTechTypeBack, false},
			cell{model.OkiTechTypeBack, true},
		),
	}

	got, result, err := svc.Create(context.Background(), input)
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if result.HasError() {
		t.Fatalf("unexpected validation: %+v", result.Issues)
	}

	rows, err := db.Query(
		`SELECT setup_id, count(*) FROM combo_setup_results
		 WHERE combo_id = ? GROUP BY setup_id ORDER BY setup_id`, got.ID)
	if err != nil {
		t.Fatalf("group by setup: %v", err)
	}
	defer rows.Close()

	var counts []int
	for rows.Next() {
		var setupID int64
		var n int
		if err := rows.Scan(&setupID, &n); err != nil {
			t.Fatalf("scan: %v", err)
		}
		counts = append(counts, n)
	}
	if len(counts) != 2 || counts[0] != 1 || counts[1] != 2 {
		t.Errorf("setup ごとの件数 = %v, want [1 2](A に 1 セル・B に 2 セル)", counts)
	}
}

// ---------------------------------------------------------------------------
// §4-3 / §4-9 未指定・空配列は 0 行(既存のコンボ作成の非回帰)
// ---------------------------------------------------------------------------

// 渡さない／空のとき、combo_setup_results に 1 行も入らない。
// 「未検証」は行の有無で表現するため、既定は必ず 0 行である。
func TestService_Create_BundledWithoutVerifiedConditions_NoRows(t *testing.T) {
	cases := []struct {
		name  string
		conds []setupsvc.SetupResultCondition
	}{
		{"未指定(nil)", nil},
		{"空配列", []setupsvc.SetupResultCondition{}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			db, svc := newSvcWithSetups(t)
			input := validRyuInput(t, db)
			s := validSetupInput(t, db, 1)
			s.VerifiedConditions = tc.conds
			input.Setups = []setupsvc.CreateSetupInput{s}

			got, result, err := svc.Create(context.Background(), input)
			if err != nil {
				t.Fatalf("Create: %v", err)
			}
			if result.HasError() {
				t.Fatalf("unexpected validation: %+v", result.Issues)
			}
			// セットプレイ自体は作られる(チェックせずに登録できる)。
			if n := countComboSetups(t, db, got.ID); n != 1 {
				t.Errorf("combo_setups = %d 行, want 1", n)
			}
			if n := countSetupResults(t, db, got.ID); n != 0 {
				t.Errorf("combo_setup_results = %d 行, want 0(未検証で開始)", n)
			}
		})
	}
}

// ---------------------------------------------------------------------------
// §4-6 値域外の techType
// ---------------------------------------------------------------------------

// 値域外の techType は ErrInvalidResultValue で弾かれ、コンボごと巻き戻る。
// (HTTP 400 への写像は internal/api/combo のハンドラテストで固定する)
func TestService_Create_BundledVerifiedConditions_OutOfRangeTechType(t *testing.T) {
	db, svc := newSvcWithSetups(t)
	input := validRyuInput(t, db)
	input.Setups = []setupsvc.CreateSetupInput{
		bundledSetupWith(t, db, "値域外", cell{TechType: "quick_rise", InCorner: false}),
	}

	_, _, err := svc.Create(context.Background(), input)
	if !errors.Is(err, setupsvc.ErrInvalidResultValue) {
		t.Fatalf("err = %v, want ErrInvalidResultValue", err)
	}
	if n := countCombos(t, db); n != 0 {
		t.Errorf("コンボが残っている: %d 件, want 0", n)
	}
	if n := countAllSetupResults(t, db); n != 0 {
		t.Errorf("combo_setup_results が残っている: %d 行, want 0", n)
	}
}

package combo_test

// 成立条件(combo_setup_results)によるコンボ一覧の絞り込みのテスト(M19-06 §4)。
//
// 本サブの肝は「ok / ng / unverified の 3 状態を混ぜないこと」であるため、
// どのケースも「該当するコンボ」と「該当しないコンボ」を対で固定する
// (SUPP-001 §5.5.2 (3)＝該当件数だけでは、条件を広く当てすぎても検出できない)。

import (
	"context"
	"database/sql"
	"sort"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
	comborepo "github.com/plexiblinp/tacpendium/internal/repository/combo"
	"github.com/plexiblinp/tacpendium/internal/testutil/dbtest"
)

// setupResultFixture はコンボ名 → combo_id の対応表。期待値を ID でなく名前で書く。
type setupResultFixture struct {
	db     *sql.DB
	repo   comborepo.Repository
	ids    map[string]int64
	byID   map[int64]string
	nextKD int
}

// insertLabeledCombo はラベル付きのコンボを 1 件作る。
// 識別キーが重なっても構わない(重複判定はサービス層の責務でリポジトリ層は素通し)。
func (f *setupResultFixture) insertLabeledCombo(t *testing.T, label string) int64 {
	t.Helper()
	ctx := context.Background()
	move1 := lookupMoveID(t, f.db, 1, "standing_light_punch")
	var id int64
	withTx(t, f.db, func(tx *sql.Tx) {
		c := validRyuCombo()
		c.StarterMoveID = &move1
		c.Memo = ptrStr(label)
		c.StepCount = 1
		newID, err := f.repo.InsertCombo(ctx, tx, c)
		if err != nil {
			t.Fatalf("insert combo %s: %v", label, err)
		}
		id = newID
		if err := f.repo.InsertSteps(ctx, tx, newID, []model.ComboStep{{StepOrder: 1, MoveID: &move1}}); err != nil {
			t.Fatalf("insert steps %s: %v", label, err)
		}
	})
	f.ids[label] = id
	f.byID[id] = label
	return id
}

// linkSetup はコンボへセットプレイを 1 つ紐付け、その setup_id を返す。
func (f *setupResultFixture) linkSetup(t *testing.T, comboID int64) int64 {
	t.Helper()
	return insertTestSetupAndLink(t, f.db, comboID)
}

// softDeleteSetup はセットプレイを論理削除する(combo_setups の行は残る)。
func (f *setupResultFixture) softDeleteSetup(t *testing.T, setupID int64) {
	t.Helper()
	if _, err := f.db.Exec(
		`UPDATE setups SET deleted_at = datetime('now') WHERE id = ?`, setupID); err != nil {
		t.Fatalf("soft delete setup %d: %v", setupID, err)
	}
}

// putResult は成立条件の行を 1 つ入れる(行があること自体が「検証済み」を表す)。
func (f *setupResultFixture) putResult(t *testing.T, comboID, setupID int64, techType string, inCorner bool, result string) {
	t.Helper()
	if _, err := f.db.Exec(
		`INSERT INTO combo_setup_results (combo_id, setup_id, tech_type, in_corner, result)
		 VALUES (?, ?, ?, ?, ?)`, comboID, setupID, techType, inCorner, result); err != nil {
		t.Fatalf("insert combo_setup_result: %v", err)
	}
}

// labelsOf は List の結果を「本 fixture が作ったコンボ」のラベル昇順スライスへ変換する。
//
// ★fixture 由来でないコンボは無視する。本テストの比較区間を自サブに閉じるためで、
// 将来 seed マイグレがコンボを投入しても(migrations/000012 は「フェーズ3で総入れ替え」
// と述べている)期待値の完全一致アサートが巻き添えで落ちないようにする
// (SUPP-001 §5.5.2 (1)(2) の趣旨。機械レビュー指摘・低4)。
func (f *setupResultFixture) labelsOf(t *testing.T, filter comborepo.ListFilter) []string {
	t.Helper()
	combos, err := f.repo.List(context.Background(), filter)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	out := make([]string, 0, len(combos))
	for _, c := range combos {
		if label, ok := f.byID[c.ID]; ok {
			out = append(out, label)
		}
	}
	sort.Strings(out)
	return out
}

func assertLabels(t *testing.T, name string, got, want []string) {
	t.Helper()
	if len(got) != len(want) {
		t.Errorf("%s: got %v, want %v", name, got, want)
		return
	}
	for i := range got {
		if got[i] != want[i] {
			t.Errorf("%s: got %v, want %v", name, got, want)
			return
		}
	}
}

// newSetupResultFixture は 3 状態と軸を判別できる最小のデータセットを作る。
//
//	okOnly       : セットプレイ 1 つ。back_tech / 画面端 = ok
//	mixed        : セットプレイ 2 つ。back_tech / 画面端 が一方 ok・他方 ng
//	ngOnly       : セットプレイ 1 つ。back_tech / 画面端 = ng
//	unverified   : セットプレイ 1 つ。成立条件の行が無い
//	otherCell    : セットプレイ 1 つ。neutral_tech / 画面中央 = ok(別セル)
//	noSetup      : セットプレイを 1 つも持たない(3 値のどれにも該当しない)
//	deletedSetup : 唯一のセットプレイが論理削除済み。行は back_tech / 画面端 = ok で残っている
func newSetupResultFixture(t *testing.T) *setupResultFixture {
	t.Helper()
	db := dbtest.Setup(t)
	f := &setupResultFixture{
		db:   db,
		repo: comborepo.New(db),
		ids:  map[string]int64{},
		byID: map[int64]string{},
	}

	okOnly := f.insertLabeledCombo(t, "okOnly")
	s := f.linkSetup(t, okOnly)
	f.putResult(t, okOnly, s, model.OkiTechTypeBack, true, model.SetupResultOK)

	mixed := f.insertLabeledCombo(t, "mixed")
	sA := f.linkSetup(t, mixed)
	sB := f.linkSetup(t, mixed)
	f.putResult(t, mixed, sA, model.OkiTechTypeBack, true, model.SetupResultOK)
	f.putResult(t, mixed, sB, model.OkiTechTypeBack, true, model.SetupResultNG)

	ngOnly := f.insertLabeledCombo(t, "ngOnly")
	s = f.linkSetup(t, ngOnly)
	f.putResult(t, ngOnly, s, model.OkiTechTypeBack, true, model.SetupResultNG)

	unverified := f.insertLabeledCombo(t, "unverified")
	f.linkSetup(t, unverified)

	otherCell := f.insertLabeledCombo(t, "otherCell")
	s = f.linkSetup(t, otherCell)
	f.putResult(t, otherCell, s, model.OkiTechTypeNeutral, false, model.SetupResultOK)

	f.insertLabeledCombo(t, "noSetup")

	deletedSetup := f.insertLabeledCombo(t, "deletedSetup")
	s = f.linkSetup(t, deletedSetup)
	f.putResult(t, deletedSetup, s, model.OkiTechTypeBack, true, model.SetupResultOK)
	f.softDeleteSetup(t, s)

	return f
}

// allLabels は fixture の全コンボ(絞り込み無しで返るはずの集合)。
var allLabels = []string{
	"deletedSetup", "mixed", "ngOnly", "noSetup", "okOnly", "otherCell", "unverified",
}

func backCorner() (techType *string, inCorner *bool) {
	return ptrStr(model.OkiTechTypeBack), ptrBool(true)
}

// ---------------------------------------------------------------------------
// §4-1 / §4-2 / §4-3: 3 値の該当・非該当を対で固定する
// ---------------------------------------------------------------------------

func TestRepository_List_SetupResult_ThreeStates(t *testing.T) {
	f := newSetupResultFixture(t)
	tech, corner := backCorner()

	tests := []struct {
		name  string
		state string
		want  []string
	}{
		{
			// ★一部 ok・一部 ng の mixed は ok に該当する(EXISTS 意味論・§2.1 (a))。
			name:  "ok は当該セルに ok の行があるコンボ",
			state: model.SetupResultOK,
			want:  []string{"mixed", "okOnly"},
		},
		{
			// ★ng は ok の単純な否定ではない。mixed は ok を持つので該当しない(§2.1 (b))。
			name:  "ng は ok が 1 つも無く ng の行があるコンボ",
			state: model.SetupResultNG,
			want:  []string{"ngOnly"},
		},
		{
			// ★unverified は「セットプレイを持つが当該セルの行が無い」。
			// ngOnly は行があるので該当せず、noSetup はセットプレイが無いので該当しない。
			name:  "unverified は当該セルの行が 1 つも無いコンボ",
			state: model.SetupResultUnverified,
			want:  []string{"otherCell", "unverified"},
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := f.labelsOf(t, comborepo.ListFilter{
				SetupResult: ptrStr(tc.state), SetupTechType: tech, SetupInCorner: corner,
			})
			assertLabels(t, tc.name, got, tc.want)

			// 対の固定: 該当しなかったコンボが確かに存在すること(全件一致なら
			// 「条件を広く当てすぎている」ので、件数だけでは検出できない)。
			if len(got) == len(allLabels) {
				t.Errorf("%s: 全件該当している(絞り込めていない)", tc.name)
			}
		})
	}
}

// ★セットプレイを 1 つも持たないコンボは 3 値のどれにも該当しない(§2.1 (c))。
// 「該当なし(圏外)」を「未検証」に混ぜない。
func TestRepository_List_SetupResult_ComboWithoutSetupMatchesNone(t *testing.T) {
	f := newSetupResultFixture(t)
	tech, corner := backCorner()

	for _, state := range []string{model.SetupResultOK, model.SetupResultNG, model.SetupResultUnverified} {
		for _, axes := range []struct {
			name     string
			techType *string
			inCorner *bool
		}{
			{"軸あり", tech, corner},
			{"軸なし", nil, nil},
		} {
			got := f.labelsOf(t, comborepo.ListFilter{
				SetupResult: ptrStr(state), SetupTechType: axes.techType, SetupInCorner: axes.inCorner,
			})
			for _, label := range got {
				if label == "noSetup" {
					t.Errorf("state=%s %s: セットプレイを持たないコンボが該当している", state, axes.name)
				}
			}
		}
	}

	// noSetup 自体は絞り込み無しなら返る(そもそも存在しない、ではないことの固定)。
	all := f.labelsOf(t, comborepo.ListFilter{})
	found := false
	for _, label := range all {
		if label == "noSetup" {
			found = true
		}
	}
	if !found {
		t.Fatal("絞り込み無しでも noSetup が返っていない(fixture が壊れている)")
	}
}

// ★論理削除された setups は 3 述語すべてから除外する(開発者裁定 2026-08-09)。
// 行は残っているが、画面上「セットプレイが無い」ものとして扱う。
func TestRepository_List_SetupResult_SoftDeletedSetupExcluded(t *testing.T) {
	f := newSetupResultFixture(t)
	tech, corner := backCorner()

	for _, state := range []string{model.SetupResultOK, model.SetupResultNG, model.SetupResultUnverified} {
		got := f.labelsOf(t, comborepo.ListFilter{
			SetupResult: ptrStr(state), SetupTechType: tech, SetupInCorner: corner,
		})
		for _, label := range got {
			if label == "deletedSetup" {
				t.Errorf("state=%s: 論理削除済みセットプレイのコンボが該当している", state)
			}
		}
	}
}

// ---------------------------------------------------------------------------
// §4-4: 軸の独立(tech_type のみ / in_corner のみ / 両方 / どちらも不問)
// ---------------------------------------------------------------------------

func TestRepository_List_SetupResult_AxesIndependent(t *testing.T) {
	f := newSetupResultFixture(t)

	tests := []struct {
		name     string
		techType *string
		inCorner *bool
		want     []string
	}{
		{
			name:     "tech_type のみ(back_tech)",
			techType: ptrStr(model.OkiTechTypeBack),
			want:     []string{"mixed", "okOnly"},
		},
		{
			name:     "in_corner のみ(画面端)",
			inCorner: ptrBool(true),
			want:     []string{"mixed", "okOnly"},
		},
		{
			name:     "両方指定(back_tech / 画面端)",
			techType: ptrStr(model.OkiTechTypeBack),
			inCorner: ptrBool(true),
			want:     []string{"mixed", "okOnly"},
		},
		{
			// どちらも不問なら別セル(neutral_tech / 画面中央)の ok も拾う。
			name: "どちらも不問",
			want: []string{"mixed", "okOnly", "otherCell"},
		},
		{
			// 逆側の軸を指定すると otherCell だけが残る(軸が効いていることの対固定)。
			name:     "tech_type のみ(neutral_tech)",
			techType: ptrStr(model.OkiTechTypeNeutral),
			want:     []string{"otherCell"},
		},
		{
			name:     "in_corner のみ(画面中央)",
			inCorner: ptrBool(false),
			want:     []string{"otherCell"},
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := f.labelsOf(t, comborepo.ListFilter{
				SetupResult: ptrStr(model.SetupResultOK), SetupTechType: tc.techType, SetupInCorner: tc.inCorner,
			})
			assertLabels(t, tc.name, got, tc.want)
		})
	}
}

// ---------------------------------------------------------------------------
// §4-5: 成立状態が未指定なら、軸を指定しても絞り込まれない
// ---------------------------------------------------------------------------

func TestRepository_List_SetupResult_AxesWithoutStateDoNotFilter(t *testing.T) {
	f := newSetupResultFixture(t)

	tests := []struct {
		name     string
		techType *string
		inCorner *bool
	}{
		{"tech_type のみ", ptrStr(model.OkiTechTypeBack), nil},
		{"in_corner のみ", nil, ptrBool(true)},
		{"両方", ptrStr(model.OkiTechTypeBack), ptrBool(true)},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := f.labelsOf(t, comborepo.ListFilter{
				SetupTechType: tc.techType, SetupInCorner: tc.inCorner,
			})
			assertLabels(t, tc.name, got, allLabels)
		})
	}
}

// ---------------------------------------------------------------------------
// §4-7: 新項目を指定しないときの結果が既存フィルタと一致する
// ---------------------------------------------------------------------------

func TestRepository_List_SetupResult_ExistingFiltersUnchanged(t *testing.T) {
	f := newSetupResultFixture(t)

	// 絞り込み無し。
	assertLabels(t, "絞り込み無し", f.labelsOf(t, comborepo.ListFilter{}), allLabels)

	// 既存フィルタ(fixture は全件 mid_screen / standing / normal / 本登録)。
	assertLabels(t, "position", f.labelsOf(t, comborepo.ListFilter{
		Position: ptrStr("mid_screen"),
	}), allLabels)
	assertLabels(t, "position 非該当", f.labelsOf(t, comborepo.ListFilter{
		Position: ptrStr("corner_self"),
	}), []string{})
	assertLabels(t, "is_draft=false", f.labelsOf(t, comborepo.ListFilter{
		IsDraft: ptrBool(false),
	}), allLabels)
	assertLabels(t, "is_draft=true", f.labelsOf(t, comborepo.ListFilter{
		IsDraft: ptrBool(true),
	}), []string{})
	assertLabels(t, "character_id", f.labelsOf(t, comborepo.ListFilter{
		CharacterID: ptrInt64(1),
	}), allLabels)
}

// ---------------------------------------------------------------------------
// §4-9: 論理削除されたコンボの扱いは既存の IncludeDeleted / OnlyDeleted に従う
// ---------------------------------------------------------------------------

func TestRepository_List_SetupResult_RespectsDeletedComboFlags(t *testing.T) {
	f := newSetupResultFixture(t)
	ctx := context.Background()
	tech, corner := backCorner()

	// ok に該当する 2 件のうち okOnly を論理削除する。
	if err := f.repo.SoftDelete(ctx, nil, f.ids["okOnly"]); err != nil {
		t.Fatalf("soft delete combo: %v", err)
	}

	base := comborepo.ListFilter{SetupResult: ptrStr(model.SetupResultOK), SetupTechType: tech, SetupInCorner: corner}

	assertLabels(t, "既定(削除済みを含めない)", f.labelsOf(t, base), []string{"mixed"})

	withIncluded := base
	withIncluded.IncludeDeleted = true
	assertLabels(t, "IncludeDeleted", f.labelsOf(t, withIncluded), []string{"mixed", "okOnly"})

	onlyDeleted := base
	onlyDeleted.OnlyDeleted = true
	assertLabels(t, "OnlyDeleted", f.labelsOf(t, onlyDeleted), []string{"okOnly"})
}

// ---------------------------------------------------------------------------
// 軸の「不問」は各セルの答えの OR である(セル単位の判定・開発者裁定 2026-08-09)
//
// ★実機確認で「全て」が最も狭くなる例が 2 つ観測されたことを受けた仕様。
// 当初はセルを問わず 1 回だけ問う形で、ng と unverified が否定を含むために
// 対象セルを広げると該当しにくくなっていた。
// ---------------------------------------------------------------------------

// addAxisFixtures は「全て」と個別指定の差が出るコンボを 2 件足す。
//
//	mixedCells : 1 セットプレイ。画面中央その場受け身 = ng ／ 画面端後ろ受け身 = ok。
//	             ★開発者が dev DB で観測した形(セルによって答えが違うコンボ)。
//	partial    : 1 セットプレイ。画面端その場受け身 = ok のみ。残り 3 セルは未記録。
func addAxisFixtures(t *testing.T, f *setupResultFixture) {
	t.Helper()

	mixedCells := f.insertLabeledCombo(t, "mixedCells")
	s := f.linkSetup(t, mixedCells)
	f.putResult(t, mixedCells, s, model.OkiTechTypeNeutral, false, model.SetupResultNG)
	f.putResult(t, mixedCells, s, model.OkiTechTypeBack, true, model.SetupResultOK)

	partial := f.insertLabeledCombo(t, "partial")
	s = f.linkSetup(t, partial)
	f.putResult(t, partial, s, model.OkiTechTypeNeutral, true, model.SetupResultOK)
}

// ★セルによって答えが違うコンボが、ng でも ok でも「全て」に出ること。
// 当初の形では ok の行に引っかかって ng の「全て」から落ちていた。
func TestRepository_List_SetupResult_AxisAllIsUnionForNG(t *testing.T) {
	f := newSetupResultFixture(t)
	addAxisFixtures(t, f)

	// 画面中央では不成立、画面端では成立。個別指定はどちらも従来どおり。
	assertLabels(t, "ng / 画面中央", f.labelsOf(t, comborepo.ListFilter{
		SetupResult: ptrStr(model.SetupResultNG), SetupInCorner: ptrBool(false),
	}), []string{"mixedCells"})
	assertLabels(t, "ng / 相手が画面端", f.labelsOf(t, comborepo.ListFilter{
		SetupResult: ptrStr(model.SetupResultNG), SetupInCorner: ptrBool(true),
	}), []string{"ngOnly"})

	// ★「全て」は両者の和集合になる(当初は mixedCells が落ちて ngOnly だけだった)。
	assertLabels(t, "ng / 画面端=全て", f.labelsOf(t, comborepo.ListFilter{
		SetupResult: ptrStr(model.SetupResultNG),
	}), []string{"mixedCells", "ngOnly"})

	// ok 側は元から単調で、同じコンボが ok にも出る(3 値は排他ではない)。
	got := f.labelsOf(t, comborepo.ListFilter{SetupResult: ptrStr(model.SetupResultOK)})
	found := false
	for _, l := range got {
		if l == "mixedCells" {
			found = true
		}
	}
	if !found {
		t.Errorf("mixedCells は ok にも出るはず(セルによって答えが違うため)。got %v", got)
	}
}

// ★unverified は「未記録のセルが 1 つ以上ある」= 埋め残しがあるコンボ。
// 当初は「1 セルも記録が無い」で、1 セルでも埋めると落ちていた。
func TestRepository_List_SetupResult_UnverifiedMeansSomeCellUnrecorded(t *testing.T) {
	f := newSetupResultFixture(t)
	addAxisFixtures(t, f)

	// 1 セルだけ記録した partial は「全て」に出る(残り 3 セルが未記録のため)。
	got := f.labelsOf(t, comborepo.ListFilter{SetupResult: ptrStr(model.SetupResultUnverified)})
	for _, want := range []string{"partial", "okOnly", "unverified"} {
		found := false
		for _, l := range got {
			if l == want {
				found = true
			}
		}
		if !found {
			t.Errorf("unverified / 全て に %s が含まれるはず(未記録のセルが残っている)。got %v", want, got)
		}
	}

	// ★セットプレイを持たない/生きたセットプレイが無いコンボは、やはり該当しない。
	for _, ng := range []string{"noSetup", "deletedSetup"} {
		for _, l := range got {
			if l == ng {
				t.Errorf("unverified / 全て に %s が出ている(圏外は 3 値のどれにも入らない)", ng)
			}
		}
	}

	// 個別指定: partial が記録済みのセルでは該当せず、未記録のセルでは該当する。
	recorded := f.labelsOf(t, comborepo.ListFilter{
		SetupResult:   ptrStr(model.SetupResultUnverified),
		SetupTechType: ptrStr(model.OkiTechTypeNeutral), SetupInCorner: ptrBool(true),
	})
	for _, l := range recorded {
		if l == "partial" {
			t.Error("記録済みのセルを指定したのに partial が unverified に出ている")
		}
	}
	unrecorded := f.labelsOf(t, comborepo.ListFilter{
		SetupResult:   ptrStr(model.SetupResultUnverified),
		SetupTechType: ptrStr(model.OkiTechTypeBack), SetupInCorner: ptrBool(true),
	})
	found := false
	for _, l := range unrecorded {
		if l == "partial" {
			found = true
		}
	}
	if !found {
		t.Errorf("未記録のセルを指定したら partial が unverified に出るはず。got %v", unrecorded)
	}
}

// ★単調性: 軸を絞った結果は、必ず「全て」の結果の部分集合である。
// これが本裁定の眼目 ——「全て」が個別指定より狭くなることは無い。
func TestRepository_List_SetupResult_AxisIsMonotone(t *testing.T) {
	f := newSetupResultFixture(t)
	addAxisFixtures(t, f)

	axes := []struct {
		name     string
		techType *string
		inCorner *bool
	}{
		{"その場受け身", ptrStr(model.OkiTechTypeNeutral), nil},
		{"後ろ受け身", ptrStr(model.OkiTechTypeBack), nil},
		{"画面中央", nil, ptrBool(false)},
		{"相手が画面端", nil, ptrBool(true)},
		{"その場受け身 / 画面中央", ptrStr(model.OkiTechTypeNeutral), ptrBool(false)},
		{"その場受け身 / 相手が画面端", ptrStr(model.OkiTechTypeNeutral), ptrBool(true)},
		{"後ろ受け身 / 画面中央", ptrStr(model.OkiTechTypeBack), ptrBool(false)},
		{"後ろ受け身 / 相手が画面端", ptrStr(model.OkiTechTypeBack), ptrBool(true)},
	}

	for _, state := range []string{model.SetupResultOK, model.SetupResultNG, model.SetupResultUnverified} {
		all := map[string]bool{}
		for _, l := range f.labelsOf(t, comborepo.ListFilter{SetupResult: ptrStr(state)}) {
			all[l] = true
		}
		for _, ax := range axes {
			for _, l := range f.labelsOf(t, comborepo.ListFilter{
				SetupResult: ptrStr(state), SetupTechType: ax.techType, SetupInCorner: ax.inCorner,
			}) {
				if !all[l] {
					t.Errorf("state=%s 軸=%s: %s が個別指定では出るのに「全て」で出ていない(単調性違反)",
						state, ax.name, l)
				}
			}
		}
	}
}

// ---------------------------------------------------------------------------
// 値域外の成立状態は 1 件も返さない(API 層で 400 に落ちるため通常は到達しない)
// ---------------------------------------------------------------------------

func TestRepository_List_SetupResult_UnknownStateMatchesNothing(t *testing.T) {
	f := newSetupResultFixture(t)
	assertLabels(t, "値域外", f.labelsOf(t, comborepo.ListFilter{
		SetupResult: ptrStr("maybe"),
	}), []string{})
}

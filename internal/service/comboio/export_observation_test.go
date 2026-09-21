package comboio_test

// ★★M29-02 §2.1: 書出の切り捨て判定が「境界の 1 件」で正しく鳴るかの主張。
//
// 着手前の実装は `len(combos) >= exportRowLimit` で判定していた。この形は
// **ちょうど上限のときに 1 件も落ちていないのに「切り捨てた」と言う**(偽陽性)。
// ⇒ 総数と実際に載った件数を比べる形へ変えた。その回帰を固定する。

import (
	"context"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
	combosvc "github.com/plexiblinp/tacpendium/internal/service/combo"
	comboio "github.com/plexiblinp/tacpendium/internal/service/comboio"
	"github.com/plexiblinp/tacpendium/internal/service/comboio/csvcore"
)

func TestExportResultTruncatedBoundary(t *testing.T) {
	// ★上限そのものの値には依存させない。判定は「総数 > 載った件数」であり、
	//   上限がいくつであってもこの関係だけで決まるべきである。
	cases := []struct {
		name     string
		total    int
		included int
		want     bool
	}{
		// ★★境界 +1。ここで鳴らなければ、事故が起きる当の状況を素通しする。
		{"上限をちょうど 1 件超える", 1001, 1000, true},
		// ★★ちょうど上限。着手前の `>=` はここで偽陽性を出していた。
		{"ちょうど上限(1 件も落ちていない)", 1000, 1000, false},
		{"上限未満", 3, 3, false},
		{"既定 100 件で切れた形", 250, 100, true},
		{"0 件", 0, 0, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			r := &comboio.ExportResult{TotalCombos: tc.total, IncludedCombos: tc.included}
			if got := r.Truncated(); got != tc.want {
				t.Fatalf("Truncated() = %v, want %v (total=%d included=%d)",
					got, tc.want, tc.total, tc.included)
			}
		})
	}
}

func TestExportResultReimportBlocked(t *testing.T) {
	// ★★書出には行数・バイト数の上限が無いのに取込は上限で弾く、という非対称。
	//   ⇒ 自分が出したファイルを自分の取込が拒否しうる。その観測。
	cases := []struct {
		name        string
		rowsOver    bool
		bytesOver   bool
		wantBlocked bool
	}{
		{"どちらも上限内", false, false, false},
		{"セットプレイ行数が上限超え", true, false, true},
		{"バイト数が上限超え", false, true, true},
		{"両方", true, true, true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			r := &comboio.ExportResult{
				SetupRowsOverLimit: tc.rowsOver,
				BytesOverLimit:     tc.bytesOver,
			}
			if got := r.ReimportBlocked(); got != tc.wantBlocked {
				t.Fatalf("ReimportBlocked() = %v, want %v", got, tc.wantBlocked)
			}
		})
	}
}

// ★★M29-02 §2.1: 往復の非対称の判定そのものを境界で主張する。
//
// ★本テストが無かったとき、判定を殺しても全テストが緑のままだった(破壊確認で実測)。
// ⇒ ReimportBlocked() の単体テストと、ヘッダに手で値を入れたテストだけでは、
//
//	「実際に計算しているか」は 1 度も観測されていなかった。
func TestExceedsImportRowLimitBoundary(t *testing.T) {
	limit := csvcore.DefaultMaxRows
	cases := []struct {
		name string
		rows int
		want bool
	}{
		{"上限をちょうど 1 行超える", limit + 1, true}, // ★境界 +1
		{"ちょうど上限(取込は受理する)", limit, false},
		{"上限未満", 1, false},
		{"0 行", 0, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := comboio.ExceedsImportRowLimit(tc.rows); got != tc.want {
				t.Fatalf("ExceedsImportRowLimit(%d) = %v, want %v", tc.rows, got, tc.want)
			}
		})
	}
}

func TestExceedsImportByteLimitBoundary(t *testing.T) {
	limit := csvcore.DefaultMaxBytes
	if !comboio.ExceedsImportByteLimit(limit + 1) {
		t.Error("上限を 1 バイト超えたのに検出できていない")
	}
	if comboio.ExceedsImportByteLimit(limit) {
		t.Error("ちょうど上限で偽陽性を出している(取込は受理する)")
	}
}

// ★★M29-02 レビュー高-3: ExportCSV が「総数」を実際に載せていることの観測。
//
// ★★これが無かったとき、TotalCombos への代入を len(combos) に変えても全テストが
// 緑のままだった(破壊確認で実測)。純関数(Truncated)のテストとハンドラの mock は
// 在ったが、その 2 つを繋ぐ配線 —— Count の結果を ExportResult へ載せる代入 ——
// は 1 度も観測されていなかった。
//
// ★完了報告 §9.3 が一般形として書いた無観測の型が、本サブの中心機能に残っていた。
//
// ★実データで total > included を作るには 1000 件超のコンボが要り、テストとして
// 現実的でない。⇒ ComboService の継ぎ目に stub を差し、List と Count が違う数を
// 返す状況を作って配線だけを観測する。
type countStubComboService struct {
	comboio.ComboService // 使わないメソッドは埋め込みに任せる(呼ばれたら panic して気づく)
	listResult           []*model.Combo
	countResult          int
	countCalls           int
}

func (s *countStubComboService) List(context.Context, combosvc.ListFilter) ([]*model.Combo, error) {
	return s.listResult, nil
}

func (s *countStubComboService) Count(context.Context, combosvc.ListFilter) (int, error) {
	s.countCalls++
	return s.countResult, nil
}

func TestExportCSVCarriesTotalFromCount(t *testing.T) {
	h := newHarness(t)
	ctx := context.Background()

	// 実データを 1 件用意する(export が code 解決・steps 取得を通れるようにする)。
	mv := h.moveIDs[0]
	created, vr, err := h.comboSvc.Create(ctx, combosvc.CreateInput{
		CharacterID: h.ryuID,
		IsDraft:     true,
		DriveDamage: floatPtrIO(-1),
		Steps:       []model.ComboStep{{StepOrder: 1, MoveID: &mv}},
	})
	if err != nil || vr.HasError() {
		t.Fatalf("create combo: err=%v vr=%+v", err, vr.Errors())
	}

	// ★List は 1 件、Count は 7 件を返す継ぎ目を作る。
	//   ⇒ TotalCombos が len(combos) から来ていれば 1 になり、Count から来ていれば 7 になる。
	stub := &countStubComboService{
		listResult:  []*model.Combo{created},
		countResult: 7,
	}
	svc := comboio.New(h.db, h.comboRepo, h.charRepo, h.moveRepo, stub, h.setupSvc, h.tagSvc)

	res, err := svc.ExportCSV(ctx, comboio.ExportQuery{Range: comboio.RangeAll})
	if err != nil {
		t.Fatalf("ExportCSV: %v", err)
	}
	if stub.countCalls == 0 {
		t.Fatal("★Count が 1 度も呼ばれていない(総数を数えていない)")
	}
	if res.TotalCombos != 7 {
		t.Fatalf("TotalCombos = %d, want 7(Count の結果を載せること)", res.TotalCombos)
	}
	if res.IncludedCombos != 1 {
		t.Fatalf("IncludedCombos = %d, want 1(実際に載った件数)", res.IncludedCombos)
	}
	// ★★ここが観測の要。総数 7 > 載った 1 ⇒ 切り捨てたと言えなければならない。
	if !res.Truncated() {
		t.Fatal("★総数が載った件数を上回るのに Truncated() が false")
	}
}

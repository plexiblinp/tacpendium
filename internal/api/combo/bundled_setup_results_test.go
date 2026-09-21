package combo_test

// ★M19-07: POST /api/combos の setups[].verifiedConditions。
//
// 本サブが実際に変えたのは API 層の写像だけである(サービス層の配線は M19-03 で完成済み)。
// したがって「ワイヤ上の verifiedConditions がサービス層の CreateSetupInput へ届くこと」を
// 固定するのが、このサブの本体の回帰ガードになる。DB への書き込みは
// internal/service/combo の同名テスト群が押さえる。

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
	combosvc "github.com/plexiblinp/tacpendium/internal/service/combo"
	setupsvc "github.com/plexiblinp/tacpendium/internal/service/setup"
	"github.com/plexiblinp/tacpendium/internal/service/validation"
)

// postCombo は body を POST し、サービス層が受け取った CreateInput を捕まえて返す。
func postCombo(t *testing.T, body string) (*combosvc.CreateInput, *httptest.ResponseRecorder) {
	t.Helper()
	var captured *combosvc.CreateInput
	svc := &mockService{
		createFn: func(_ context.Context, input combosvc.CreateInput) (*model.Combo, validation.ValidationResult, error) {
			captured = &input
			return &model.Combo{ID: 10, CharacterID: 1, Version: 1}, validation.ValidationResult{}, nil
		},
	}
	e := newTestServer(t, svc)
	req := httptest.NewRequest(http.MethodPost, "/api/combos", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	return captured, rec
}

// ★verifiedConditions が同梱セットプレイごとにサービス層へ届く。
// 渡したセルと渡さなかったセルを対で見る(SUPP-001 §5.5.2 (3))。
func TestHandler_Create_PassesBundledVerifiedConditions(t *testing.T) {
	body := `{"characterId":1,"isDraft":false,"steps":[],"setups":[
		{"characterId":1,"steps":[{"moveId":1}],"verifiedConditions":[
			{"techType":"neutral_tech","inCorner":false},
			{"techType":"back_tech","inCorner":true}
		]}
	]}`
	captured, rec := postCombo(t, body)

	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, want 201; body=%s", rec.Code, rec.Body.String())
	}
	if captured == nil {
		t.Fatal("service.Create が呼ばれていない")
	}
	if len(captured.Setups) != 1 {
		t.Fatalf("setups = %d 件, want 1", len(captured.Setups))
	}

	got := captured.Setups[0].VerifiedConditions
	want := []setupsvc.SetupResultCondition{
		{TechType: model.OkiTechTypeNeutral, InCorner: false},
		{TechType: model.OkiTechTypeBack, InCorner: true},
	}
	if len(got) != len(want) {
		t.Fatalf("verifiedConditions = %+v, want %+v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("verifiedConditions = %+v, want %+v", got, want)
		}
	}

	// 渡していないセルが勝手に増えていないこと(上の長さ比較と対で意味を持つ)。
	for _, c := range got {
		if c.TechType == model.OkiTechTypeNeutral && c.InCorner {
			t.Errorf("渡していないセル neutral_tech/inCorner が含まれている")
		}
		if c.TechType == model.OkiTechTypeBack && !c.InCorner {
			t.Errorf("渡していないセル back_tech/midScreen が含まれている")
		}
	}
}

// 複数の同梱セットプレイでも、条件はそれぞれの要素へ振り分けられる。
func TestHandler_Create_PassesBundledVerifiedConditions_PerSetup(t *testing.T) {
	body := `{"characterId":1,"isDraft":false,"steps":[],"setups":[
		{"characterId":1,"steps":[{"moveId":1}],"verifiedConditions":[
			{"techType":"neutral_tech","inCorner":false}
		]},
		{"characterId":1,"steps":[{"moveId":2}],"verifiedConditions":[
			{"techType":"back_tech","inCorner":false},
			{"techType":"back_tech","inCorner":true}
		]}
	]}`
	captured, rec := postCombo(t, body)

	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, want 201; body=%s", rec.Code, rec.Body.String())
	}
	if len(captured.Setups) != 2 {
		t.Fatalf("setups = %d 件, want 2", len(captured.Setups))
	}
	if n := len(captured.Setups[0].VerifiedConditions); n != 1 {
		t.Errorf("setups[0].verifiedConditions = %d 件, want 1", n)
	}
	if n := len(captured.Setups[1].VerifiedConditions); n != 2 {
		t.Errorf("setups[1].verifiedConditions = %d 件, want 2", n)
	}
	if captured.Setups[0].VerifiedConditions[0].TechType != model.OkiTechTypeNeutral {
		t.Errorf("setups[0] のセルが setups[1] と入れ替わっている: %+v", captured.Setups[0].VerifiedConditions)
	}
}

// ★verifiedConditions を渡さない既存のリクエストが、変更前と同じ結果になる(§4-9)。
// 省略時は空(長さ 0)で届く = 結果行 0 行 = 未検証で開始。
func TestHandler_Create_WithoutBundledVerifiedConditions(t *testing.T) {
	cases := []struct {
		name string
		body string
	}{
		{
			"verifiedConditions を省略(M19-07 以前のリクエスト)",
			`{"characterId":1,"isDraft":false,"steps":[],"setups":[{"characterId":1,"steps":[{"moveId":1}]}]}`,
		},
		{
			"verifiedConditions が空配列",
			`{"characterId":1,"isDraft":false,"steps":[],"setups":[{"characterId":1,"steps":[{"moveId":1}],"verifiedConditions":[]}]}`,
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			captured, rec := postCombo(t, tc.body)
			if rec.Code != http.StatusCreated {
				t.Fatalf("status = %d, want 201; body=%s", rec.Code, rec.Body.String())
			}
			if len(captured.Setups) != 1 {
				t.Fatalf("setups = %d 件, want 1", len(captured.Setups))
			}
			if n := len(captured.Setups[0].VerifiedConditions); n != 0 {
				t.Errorf("verifiedConditions = %d 件, want 0", n)
			}
			// 既存フィールドの写像が壊れていないこと。
			if captured.Setups[0].CharacterID != 1 {
				t.Errorf("characterId = %d, want 1", captured.Setups[0].CharacterID)
			}
			if len(captured.Setups[0].Steps) != 1 {
				t.Errorf("steps = %d 件, want 1", len(captured.Setups[0].Steps))
			}
		})
	}
}

// ★値域外の techType は 400 で弾かれる(§4-6)。
// サービス層は %w でラップして返すため、ハンドラは errors.Is で拾う。
func TestHandler_Create_400_InvalidVerifiedConditionTechType(t *testing.T) {
	svc := &mockService{
		createFn: func(_ context.Context, _ combosvc.CreateInput) (*model.Combo, validation.ValidationResult, error) {
			return nil, validation.ValidationResult{},
				fmt.Errorf("create setup setups[0]: %w", setupsvc.ErrInvalidResultValue)
		},
	}
	e := newTestServer(t, svc)

	body := `{"characterId":1,"isDraft":false,"steps":[],"setups":[
		{"characterId":1,"steps":[{"moveId":1}],"verifiedConditions":[{"techType":"quick_rise","inCorner":false}]}
	]}`
	req := httptest.NewRequest(http.MethodPost, "/api/combos", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400; body=%s", rec.Code, rec.Body.String())
	}
	var resp model.APIErrorResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	// コード・文言は api/setup の setupResultError と同一にする(第 3 の語彙を作らない)。
	if resp.Error.Code != "invalid_setup_result" {
		t.Errorf("Error.Code = %q, want invalid_setup_result", resp.Error.Code)
	}
}

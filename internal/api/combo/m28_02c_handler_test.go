package combo_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
)

// M28-02c: ComboResponse.affectedMoves の応答の形(CHANGE-162 §1.2)。
//
// ★経路の中身(どの技が当たるか)は service 層のテストが持つ。ここは入口の形だけを見る。

// TestComboResponse_AffectedMovesKeyIsAlwaysPresent は空でも [] が出ることを固定する。
//
// ★★omitempty を付けない理由は affectedByGameUpdate と同じである ——
// キーが消えると「変わった技が無い」と「そもそも列挙していない」が区別できなくなる。
// ★区別が付かないと、画面が「取得できていない」を「0 件」として描いてしまう
// (先例 = combo-list-setup-count-hides-fetch-failure)。
func TestComboResponse_AffectedMovesKeyIsAlwaysPresent(t *testing.T) {
	svc := &mockService{
		getFn: func(ctx context.Context, id int64) (*model.Combo, error) {
			// ★AffectedMoves は nil のまま(リポジトリを通っていない状態を模す)。
			return &model.Combo{ID: id, CharacterID: 1}, nil
		},
	}
	e := newTestServer(t, svc)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/combos/1", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d (body=%s)", rec.Code, rec.Body.String())
	}
	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	v, ok := body["affectedMoves"]
	if !ok {
		t.Fatal("★affectedMoves のキーが出ていない(空でも [] を出すこと)")
	}
	arr, ok := v.([]any)
	if !ok {
		t.Fatalf("affectedMoves = %#v, want []", v)
	}
	if len(arr) != 0 {
		t.Errorf("affectedMoves = %v, want 空配列", arr)
	}
}

// TestComboResponse_AffectedMovesShape は 1 件ぶんの形を固定する。
//
// ★nameJa は NULL 可であり、そのときはキーごと出ない(omitempty)。
// ⇒ 画面側が code へ落とす(先例 = starterMoveNameJa / formatStarterStatus)。
func TestComboResponse_AffectedMovesShape(t *testing.T) {
	nameJa := "しゃがみ中キック"
	svc := &mockService{
		getFn: func(ctx context.Context, id int64) (*model.Combo, error) {
			return &model.Combo{
				ID:                   id,
				CharacterID:          1,
				AffectedByGameUpdate: true,
				AffectedMoves: []model.AffectedMove{
					{MoveID: 123, Code: "2MK", NameJa: &nameJa, LastChangedGameVersion: "2026.09.10.01"},
					{MoveID: 124, Code: "rush_2MK", LastChangedGameVersion: "2026.09.10.01"},
				},
			}, nil
		},
	}
	e := newTestServer(t, svc)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/combos/1", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d (body=%s)", rec.Code, rec.Body.String())
	}
	var body struct {
		AffectedMoves []map[string]any `json:"affectedMoves"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(body.AffectedMoves) != 2 {
		t.Fatalf("件数 = %d, want 2", len(body.AffectedMoves))
	}
	first := body.AffectedMoves[0]
	for _, key := range []string{"moveId", "code", "nameJa", "lastChangedGameVersion"} {
		if _, ok := first[key]; !ok {
			t.Errorf("★%s のキーが出ていない(JSON は camelCase)", key)
		}
	}
	// ★表示名が引けない技はキーごと出ない。⇒ 画面が code へ落とす合図になる。
	if _, ok := body.AffectedMoves[1]["nameJa"]; ok {
		t.Error("nameJa が nil のときはキーごと出さないこと(omitempty)")
	}
	if body.AffectedMoves[1]["code"] != "rush_2MK" {
		t.Errorf("code = %v, want rush_2MK", body.AffectedMoves[1]["code"])
	}
}

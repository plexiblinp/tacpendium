package punish_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"

	punishhandler "github.com/plexiblinp/tacpendium/internal/api/punish"
	punishfinder "github.com/plexiblinp/tacpendium/internal/service/punishfinder"
	punishlist "github.com/plexiblinp/tacpendium/internal/service/punishlist"
)

// fakeService は punishfinder.Service のテスト用実装。
type fakeService struct {
	tree       *punishfinder.Tree
	scanErr    error
	verdictErr error

	lastScan    punishfinder.ScanParams
	starterSet  bool
	punishAdded bool
	pruneAdded  bool
}

func (f *fakeService) Scan(_ context.Context, p punishfinder.ScanParams) (*punishfinder.Tree, error) {
	f.lastScan = p
	if f.scanErr != nil {
		return nil, f.scanErr
	}
	if f.tree != nil {
		return f.tree, nil
	}
	return &punishfinder.Tree{SelfCharacterID: p.SelfCharacterID, OpponentCharacterID: p.OpponentCharacterID, GuardType: p.GuardType, Nodes: []punishfinder.OpponentMoveNode{}, ManualReviewNodes: []punishfinder.ManualReviewNode{}}, nil
}
func (f *fakeService) SetStarterVerdict(_ context.Context, _, _, _ int64, _ string, _ *string) error {
	if f.verdictErr != nil {
		return f.verdictErr
	}
	f.starterSet = true
	return nil
}
func (f *fakeService) DeleteStarterVerdict(context.Context, int64, int64, int64) error { return nil }
func (f *fakeService) AddPunish(_ context.Context, _, _ int64, _ *string) error {
	f.punishAdded = true
	return nil
}
func (f *fakeService) RemovePunish(context.Context, int64, int64) error { return nil }
func (f *fakeService) AddPruning(_ context.Context, _, _ int64, _ *string) error {
	f.pruneAdded = true
	return nil
}
func (f *fakeService) RemovePruning(context.Context, int64, int64) error { return nil }

// fakeListService は punishlist.Service のテスト用実装(M18-03a)。
type fakeListService struct {
	list    *punishlist.List
	listErr error

	lastParams    punishlist.ListParams
	curationAdded bool
	lastCuration  [2]int64
	lastNote      *string
	curationGone  bool
}

func (f *fakeListService) List(_ context.Context, p punishlist.ListParams) (*punishlist.List, error) {
	f.lastParams = p
	if f.listErr != nil {
		return nil, f.listErr
	}
	if f.list != nil {
		return f.list, nil
	}
	return &punishlist.List{
		SelfCharacterID:   p.SelfCharacterID,
		GuardType:         p.GuardType,
		Nodes:             []punishlist.MoveNode{},
		UnclassifiedNodes: []punishlist.MoveNode{},
		HiddenPrunings:    []punishlist.HiddenPruning{},
		HiddenCurations:   []punishlist.HiddenCuration{},
	}, nil
}

func (f *fakeListService) AddCuration(_ context.Context, comboID, opponentMoveID int64, note *string) error {
	f.curationAdded = true
	f.lastCuration = [2]int64{comboID, opponentMoveID}
	f.lastNote = note
	return nil
}

func (f *fakeListService) RemoveCuration(_ context.Context, comboID, opponentMoveID int64) error {
	f.curationGone = true
	f.lastCuration = [2]int64{comboID, opponentMoveID}
	return nil
}

func newServer(svc punishfinder.Service) *echo.Echo {
	return newServerWith(svc, &fakeListService{})
}

func newServerWith(svc punishfinder.Service, list punishlist.Service) *echo.Echo {
	e := echo.New()
	g := e.Group("/api")
	punishhandler.RegisterRoutes(g, punishhandler.NewHandler(svc, list))
	return e
}

func do(e *echo.Echo, method, target, body string) *httptest.ResponseRecorder {
	var r *http.Request
	if body == "" {
		r = httptest.NewRequest(method, target, nil)
	} else {
		r = httptest.NewRequest(method, target, strings.NewReader(body))
		r.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	}
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, r)
	return rec
}

func TestPunishFinder_200_Empty(t *testing.T) {
	svc := &fakeService{}
	e := newServer(svc)
	rec := do(e, http.MethodGet, "/api/punish-finder?self_character_id=1&opponent_character_id=2&guard_type=block", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body %s)", rec.Code, rec.Body.String())
	}
	var tree punishfinder.Tree
	if err := json.Unmarshal(rec.Body.Bytes(), &tree); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if tree.SelfCharacterID != 1 || tree.OpponentCharacterID != 2 || tree.GuardType != "block" {
		t.Errorf("echoed params wrong: %+v", tree)
	}
	// 空配列は null でなく [] でシリアライズされる。
	if !strings.Contains(rec.Body.String(), `"nodes":[]`) {
		t.Errorf("nodes should serialize as [], body=%s", rec.Body.String())
	}
}

func TestPunishFinder_400_InvalidCharacterID(t *testing.T) {
	e := newServer(&fakeService{})
	for _, q := range []string{
		"/api/punish-finder?self_character_id=0&opponent_character_id=2&guard_type=block",
		"/api/punish-finder?self_character_id=abc&opponent_character_id=2&guard_type=block",
		"/api/punish-finder?opponent_character_id=2&guard_type=block",
	} {
		rec := do(e, http.MethodGet, q, "")
		if rec.Code != http.StatusBadRequest {
			t.Errorf("%s: status = %d, want 400", q, rec.Code)
		}
	}
}

func TestPunishFinder_400_InvalidGuardType(t *testing.T) {
	svc := &fakeService{scanErr: punishfinder.ErrInvalidGuardType}
	e := newServer(svc)
	rec := do(e, http.MethodGet, "/api/punish-finder?self_character_id=1&opponent_character_id=2&guard_type=bogus", "")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
}

func TestCreateStarter_204(t *testing.T) {
	svc := &fakeService{}
	e := newServer(svc)
	rec := do(e, http.MethodPost, "/api/combo-punish-starters",
		`{"selfCharacterId":1,"opponentMoveId":10,"starterMoveId":100,"verdict":"adopted"}`)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want 204 (body %s)", rec.Code, rec.Body.String())
	}
	if !svc.starterSet {
		t.Errorf("SetStarterVerdict が呼ばれていない")
	}
}

func TestCreateStarter_400_InvalidVerdict(t *testing.T) {
	svc := &fakeService{verdictErr: punishfinder.ErrInvalidVerdict}
	e := newServer(svc)
	rec := do(e, http.MethodPost, "/api/combo-punish-starters",
		`{"selfCharacterId":1,"opponentMoveId":10,"starterMoveId":100,"verdict":"bogus"}`)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
}

func TestCreateStarter_400_MissingID(t *testing.T) {
	e := newServer(&fakeService{})
	rec := do(e, http.MethodPost, "/api/combo-punish-starters",
		`{"selfCharacterId":1,"opponentMoveId":0,"starterMoveId":100,"verdict":"adopted"}`)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
}

func TestDeleteStarter_204(t *testing.T) {
	e := newServer(&fakeService{})
	rec := do(e, http.MethodDelete, "/api/combo-punish-starters",
		`{"selfCharacterId":1,"opponentMoveId":10,"starterMoveId":100}`)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want 204", rec.Code)
	}
}

func TestCreatePunish_And_Pruning_204(t *testing.T) {
	svc := &fakeService{}
	e := newServer(svc)
	rec := do(e, http.MethodPost, "/api/combo-punishes", `{"comboId":500,"opponentMoveId":10}`)
	if rec.Code != http.StatusNoContent || !svc.punishAdded {
		t.Fatalf("punish: status=%d added=%v", rec.Code, svc.punishAdded)
	}
	rec = do(e, http.MethodPost, "/api/combo-punish-prunings", `{"selfCharacterId":1,"opponentMoveId":10}`)
	if rec.Code != http.StatusNoContent || !svc.pruneAdded {
		t.Fatalf("pruning: status=%d added=%v", rec.Code, svc.pruneAdded)
	}
}

func TestCreatePunish_400_MissingID(t *testing.T) {
	e := newServer(&fakeService{})
	rec := do(e, http.MethodPost, "/api/combo-punishes", `{"comboId":0,"opponentMoveId":10}`)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
}

// ---------------------------------------------------------------------------
// M18-03a: マイリスト(GET /api/punish-list)と curation の endpoint。
// ---------------------------------------------------------------------------

func TestPunishList_200_EmptyAndDefaultsToJustParry(t *testing.T) {
	list := &fakeListService{}
	e := newServerWith(&fakeService{}, list)
	rec := do(e, http.MethodGet, "/api/punish-list?self=1", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body %s)", rec.Code, rec.Body.String())
	}
	// guard 省略時の既定はジャストパリィ(探す画面と一貫)。
	if list.lastParams.GuardType != "just_parry" {
		t.Errorf("guardType = %q, want just_parry", list.lastParams.GuardType)
	}
	if list.lastParams.OpponentCharacterID != nil {
		t.Errorf("opp 省略時は nil のはず: %v", list.lastParams.OpponentCharacterID)
	}
	// 空配列は null でなく [] でシリアライズされる。
	for _, key := range []string{`"nodes":[]`, `"unclassifiedNodes":[]`, `"hiddenPrunings":[]`, `"hiddenCurations":[]`} {
		if !strings.Contains(rec.Body.String(), key) {
			t.Errorf("%s が [] でシリアライズされていない: body=%s", key, rec.Body.String())
		}
	}
}

func TestPunishList_PassesOppAndGuard(t *testing.T) {
	list := &fakeListService{}
	e := newServerWith(&fakeService{}, list)
	rec := do(e, http.MethodGet, "/api/punish-list?self=1&opp=2&guard=block", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if list.lastParams.SelfCharacterID != 1 || list.lastParams.GuardType != "block" {
		t.Errorf("params = %+v, want self=1 guard=block", list.lastParams)
	}
	if list.lastParams.OpponentCharacterID == nil || *list.lastParams.OpponentCharacterID != 2 {
		t.Errorf("opp = %v, want 2", list.lastParams.OpponentCharacterID)
	}
}

func TestPunishList_400_InvalidParams(t *testing.T) {
	e := newServerWith(&fakeService{}, &fakeListService{})
	for _, q := range []string{
		"/api/punish-list",              // self 欠落
		"/api/punish-list?self=0",       // 非正
		"/api/punish-list?self=abc",     // 数値でない
		"/api/punish-list?self=1&opp=0", // opp が非正(指定したなら正整数)
	} {
		rec := do(e, http.MethodGet, q, "")
		if rec.Code != http.StatusBadRequest {
			t.Errorf("%s: status = %d, want 400", q, rec.Code)
		}
	}
}

func TestPunishList_400_InvalidGuardType(t *testing.T) {
	e := newServerWith(&fakeService{}, &fakeListService{listErr: punishlist.ErrInvalidGuardType})
	rec := do(e, http.MethodGet, "/api/punish-list?self=1&guard=bogus", "")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
}

func TestCuration_CreateAndDelete_204(t *testing.T) {
	list := &fakeListService{}
	e := newServerWith(&fakeService{}, list)

	rec := do(e, http.MethodPost, "/api/combo-punish-curations",
		`{"comboId":5,"opponentMoveId":10,"note":"使わない"}`)
	if rec.Code != http.StatusNoContent || !list.curationAdded {
		t.Fatalf("create: status=%d added=%v (body %s)", rec.Code, list.curationAdded, rec.Body.String())
	}
	if list.lastCuration != [2]int64{5, 10} {
		t.Errorf("key = %v, want [5 10]", list.lastCuration)
	}
	if list.lastNote == nil || *list.lastNote != "使わない" {
		t.Errorf("note = %v, want 使わない", list.lastNote)
	}

	// DELETE はキー項目をボディで受ける(M18-02 の実装形)。
	rec = do(e, http.MethodDelete, "/api/combo-punish-curations", `{"comboId":5,"opponentMoveId":10}`)
	if rec.Code != http.StatusNoContent || !list.curationGone {
		t.Fatalf("delete: status=%d removed=%v", rec.Code, list.curationGone)
	}
}

func TestCuration_400_MissingID(t *testing.T) {
	e := newServerWith(&fakeService{}, &fakeListService{})
	for _, body := range []string{
		`{"comboId":0,"opponentMoveId":10}`,
		`{"comboId":5,"opponentMoveId":0}`,
	} {
		for _, method := range []string{http.MethodPost, http.MethodDelete} {
			rec := do(e, method, "/api/combo-punish-curations", body)
			if rec.Code != http.StatusBadRequest {
				t.Errorf("%s %s: status = %d, want 400", method, body, rec.Code)
			}
		}
	}
}

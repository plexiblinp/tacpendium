package intake_test

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"

	intakehandler "github.com/plexiblinp/tacpendium/internal/api/intake"
	movecommandrepo "github.com/plexiblinp/tacpendium/internal/repository/movecommand"
	presetrepo "github.com/plexiblinp/tacpendium/internal/repository/preset"
	intakesvc "github.com/plexiblinp/tacpendium/internal/service/intake"
	"github.com/plexiblinp/tacpendium/internal/testutil/dbtest"
)

func newHandler(t *testing.T) (*intakehandler.Handler, *sql.DB) {
	t.Helper()
	db := dbtest.Setup(t)
	svc := intakesvc.New(movecommandrepo.New(db), presetrepo.New(db))
	return intakehandler.NewHandler(svc), db
}

func postJSON(t *testing.T, path, body string, fn func(echo.Context) error) *httptest.ResponseRecorder {
	t.Helper()
	e := echo.New()
	req := httptest.NewRequest(http.MethodPost, path, strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	if err := fn(c); err != nil {
		t.Fatalf("handler error: %v", err)
	}
	return rec
}

// resolveResponse のミラー(テスト用の最小デコード形)。
type resolveResp struct {
	CharacterCode  string `json:"characterCode"`
	MovesAvailable bool   `json:"movesAvailable"`
	Combos         []struct {
		ComboIndex int `json:"comboIndex"`
		Steps      []struct {
			MoveCode    string `json:"moveCode"`
			Resolved    bool   `json:"resolved"`
			ResolvedVia string `json:"resolvedVia"`
		} `json:"steps"`
	} `json:"combos"`
	Summary struct {
		TotalSteps int `json:"totalSteps"`
		Resolved   int `json:"resolved"`
		Unresolved int `json:"unresolved"`
	} `json:"summary"`
}

func TestResolve_SeededCharacter_TokenMatch(t *testing.T) {
	h, _ := newHandler(t)
	// ryu の "2MP" は crouching_medium_punch に一致する(既知 seed)。text は TSV(タブ区切り)。
	line := strings.Join([]string{"1", "1", "屈中P", "2MP", "しゃがみ中P", "高", ""}, "\t")
	body := `{"characterCode":"ryu","text":` + jsonStr(line) + `}`

	rec := postJSON(t, "/api/intake/resolve", body, h.Resolve)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body: %s)", rec.Code, rec.Body.String())
	}
	var resp resolveResp
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if !resp.MovesAvailable {
		t.Fatalf("MovesAvailable should be true for ryu")
	}
	step := resp.Combos[0].Steps[0]
	if !step.Resolved || step.MoveCode != "crouching_medium_punch" || step.ResolvedVia != "token" {
		t.Fatalf("expected crouching_medium_punch via token, got %+v", step)
	}
}

// insertMovelessCharacter は「characters 行はあるが moves が 1 行も無い」キャラを 1 体作る。
//
// ★★以前は c_viper をそのまま使っていた。第四波 seed(M14-03f・2026-09-02)で 31 キャラ
// すべてが本 seed 済みになり、配布 DB から「moves を持たないキャラ」が消えたためである。
// ⇒ 前提が消えたのでテストを消す、ではない。守っている不変条件——「moves が無いキャラでも
//
//	500 にせず、全ステップ未解決として 200 を返す」——は今も要る。ゲーム側の
//	アップデートで新キャラが増えたとき、characters 行だけが先に入る期間が必ずできる
//	(先例: c_viper / dhalsim が 000014 から第四波まで仮登録のままだった)。
//
// ⇒ 対象を実データに頼るのをやめ、テスト側で作る。
func insertMovelessCharacter(t *testing.T, db *sql.DB, code string) {
	t.Helper()
	if _, err := db.Exec(`INSERT INTO characters (game_id, code, name_ja, name_en)
		SELECT g.id, ?, ?, ? FROM games g WHERE g.code = 'sf6'`, code, code, code); err != nil {
		t.Fatalf("insert character %s: %v", code, err)
	}
}

func TestResolve_MovelessCharacter_AllUnresolved(t *testing.T) {
	h, db := newHandler(t)
	insertMovelessCharacter(t, db, "test_moveless")
	line := strings.Join([]string{"1", "1", "屈中P", "2MP", "しゃがみ中P", "高", ""}, "\t")
	body := `{"characterCode":"test_moveless","text":` + jsonStr(line) + `}`

	rec := postJSON(t, "/api/intake/resolve", body, h.Resolve)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (moves を持たないキャラでも壊れない)", rec.Code)
	}
	var resp resolveResp
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if resp.MovesAvailable || resp.Summary.Resolved != 0 || resp.Summary.Unresolved != 1 {
		t.Fatalf("moves を持たないキャラは 1 つも解決しないはず: %+v", resp.Summary)
	}
}

func TestResolve_MissingCharacterCode_400(t *testing.T) {
	h, _ := newHandler(t)
	rec := postJSON(t, "/api/intake/resolve", `{"characterCode":"","text":"1\t1\tx\t2MP\t\t\t"}`, h.Resolve)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
}

func TestBuildCSV_ProducesImportableCSV(t *testing.T) {
	h, _ := newHandler(t)
	body := `{"characterCode":"ryu","combos":[{"memo":"屈中P>弱波動","isDraft":false,"steps":[{"moveCode":"crouching_medium_punch"},{"moveCode":"hadoken_light"}]}]}`

	rec := postJSON(t, "/api/intake/csv", body, h.BuildCSV)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body: %s)", rec.Code, rec.Body.String())
	}
	var resp struct {
		CSVText string `json:"csvText"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	// 既存 CSV 契約の列ヘッダ(local_id/character_code/recipe)と、recipe セルへ move_code が載ること。
	if !strings.HasPrefix(resp.CSVText, "local_id,character_code,") {
		t.Fatalf("csv header unexpected: %q", firstLine(resp.CSVText))
	}
	if !strings.Contains(resp.CSVText, "ryu") || !strings.Contains(resp.CSVText, "crouching_medium_punch") {
		t.Fatalf("csv missing expected content: %s", resp.CSVText)
	}
}

func TestBuildCSV_RejectsUnresolvedStep(t *testing.T) {
	h, _ := newHandler(t)
	// 空 move_code(未解決)を含むリクエストは 400(決定論・不完全は通さない)。
	body := `{"characterCode":"ryu","combos":[{"memo":"x","isDraft":false,"steps":[{"moveCode":""}]}]}`
	rec := postJSON(t, "/api/intake/csv", body, h.BuildCSV)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400 for unresolved step", rec.Code)
	}
}

func TestBuildCSV_RejectsEmptyCombos(t *testing.T) {
	h, _ := newHandler(t)
	rec := postJSON(t, "/api/intake/csv", `{"characterCode":"ryu","combos":[]}`, h.BuildCSV)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400 for empty combos", rec.Code)
	}
}

func jsonStr(s string) string {
	b, _ := json.Marshal(s)
	return string(b)
}

func firstLine(s string) string {
	head, _, _ := strings.Cut(s, "\n")
	return head
}

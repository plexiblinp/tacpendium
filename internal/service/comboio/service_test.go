package comboio_test

import (
	"archive/zip"
	"bytes"
	"context"
	"database/sql"
	"io"
	"strings"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
	charrepo "github.com/plexiblinp/tacpendium/internal/repository/character"
	comborepo "github.com/plexiblinp/tacpendium/internal/repository/combo"
	moverepo "github.com/plexiblinp/tacpendium/internal/repository/move"
	presetrepo "github.com/plexiblinp/tacpendium/internal/repository/preset"
	setuprepo "github.com/plexiblinp/tacpendium/internal/repository/setup"
	tagrepo "github.com/plexiblinp/tacpendium/internal/repository/tag"
	combosvc "github.com/plexiblinp/tacpendium/internal/service/combo"
	comboio "github.com/plexiblinp/tacpendium/internal/service/comboio"
	"github.com/plexiblinp/tacpendium/internal/service/notation"
	setupsvc "github.com/plexiblinp/tacpendium/internal/service/setup"
	tagsvc "github.com/plexiblinp/tacpendium/internal/service/tag"
	"github.com/plexiblinp/tacpendium/internal/service/validation"
	"github.com/plexiblinp/tacpendium/internal/testutil/dbtest"
)

type harness struct {
	db       *sql.DB // M22-02: 利用者ごとのタグを直接確かめるために保持する
	io       comboio.Service
	comboSvc combosvc.Service
	// ★M29-02: ComboService の継ぎ目に stub を差した io サービスを組み直すために保持する
	//   (書出が「総数」を実際に載せているかの観測。export_observation_test.go)。
	comboRepo comboio.ComboRepo
	charRepo  comboio.CharRepo
	moveRepo  comboio.MoveRepo
	setupSvc  comboio.SetupService
	tagSvc    comboio.TagService
	ryuID     int64
	moveCodes []string
	moveIDs   []int64
}

func newHarness(t *testing.T) *harness {
	t.Helper()
	db := dbtest.Setup(t)
	ctx := context.Background()

	repo := comborepo.New(db)
	sRepo := setuprepo.New(db)
	presetRepo := presetrepo.New(db)
	notationSvc := notation.New(db, presetRepo, repo, sRepo)
	charRepo := charrepo.New(db)
	moveRepo := moverepo.New(db)
	tagService := tagsvc.New(tagrepo.New(db))

	validDeps := validation.Dependencies{
		CharacterRepo: &combosvc.CharacterAdapter{DB: db},
		MoveRepo:      &combosvc.MoveAdapter{DB: db},
		ComboRepo:     &combosvc.ComboDuplicateAdapter{Repo: repo},
	}
	setupValidDeps := setupsvc.ValidationDeps{
		CharacterRepo: &combosvc.CharacterAdapter{DB: db},
		MoveRepo:      &combosvc.MoveAdapter{DB: db},
		// ★★M24-13 §4.6: 本番配線(cmd/tacpendium/main.go)と同じくアダプタを挟む。
		//   sRepo を直に渡すと txScopedValidDeps が tx を束ねられず、VAL-S04 の判定が
		//   *sql.DB 直読みへ落ちる ⇒ 競合を塞いだことをテストが観測できなくなる。
		SetupRepo: &setupsvc.SetupDuplicateAdapter{Repo: sRepo},
	}
	setupService := setupsvc.New(db, sRepo, setupValidDeps, notationSvc, repo, func() int64 { return 1 })
	comboService := combosvc.New(db, repo, validDeps, notationSvc, setupService, func() int64 { return 1 })
	ioSvc := comboio.New(db, repo, charRepo, moveRepo, comboService, setupService, tagService)

	h := &harness{
		db: db, io: ioSvc, comboSvc: comboService,
		comboRepo: repo, charRepo: charRepo, moveRepo: moveRepo,
		setupSvc: setupService, tagSvc: tagService,
	}

	gameID, err := charRepo.GameIDByCode(ctx, "sf6")
	if err != nil {
		t.Fatalf("game id: %v", err)
	}
	chars, err := charRepo.ListByGame(ctx, gameID)
	if err != nil || len(chars) == 0 {
		t.Fatalf("list chars: %v (n=%d)", err, len(chars))
	}
	h.ryuID = chars[0].ID
	moves, err := moveRepo.ListByCharacter(ctx, h.ryuID)
	if err != nil || len(moves) < 2 {
		t.Fatalf("list moves: %v (n=%d)", err, len(moves))
	}
	for _, m := range moves[:2] {
		h.moveCodes = append(h.moveCodes, m.Code)
		h.moveIDs = append(h.moveIDs, m.ID)
	}
	return h
}

func unzip(t *testing.T, data []byte) map[string]string {
	t.Helper()
	zr, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		t.Fatalf("unzip: %v", err)
	}
	out := map[string]string{}
	for _, f := range zr.File {
		rc, _ := f.Open()
		b, _ := io.ReadAll(rc)
		_ = rc.Close()
		out[f.Name] = string(b)
	}
	return out
}

// TestExportRoundTripAndDuplicateSkip はコンボ作成 → export(zip)→ 再 import で
// 重複検出 → skip 動作までを実 DB で検証する(Phase 2/3 結線の統合テスト)。
func TestExportRoundTripAndDuplicateSkip(t *testing.T) {
	h := newHarness(t)
	ctx := context.Background()

	mv0 := h.moveIDs[0]
	memo := "確反,\"テスト\"\n2 行目"
	_, vr, err := h.comboSvc.Create(ctx, combosvc.CreateInput{
		CharacterID:   h.ryuID,
		StarterMoveID: &mv0,
		Memo:          &memo,
		// ★M27-02b(VAL-C15) / ★★M38-01: 本登録の fixture が埋める欄。
		//
		//	★★M38-01 追補2 の時点で必須は 2 欄である。⇒ いまサーバが咎めるのは
		//	  damage / knockdownAdvantage だけである(正典 =
		//	  internal/service/validation/combo.go の requiredPublishedFields)。
		//	★消費ゲージ 2 欄は必須から外れた。開始残量 2 欄は必須だが、「不問」を
		//	  NULL で表すためサーバからは空と区別できず咎めない。
		//	⇒ 本 fixture が消費ゲージを埋めているのは余分であって害は無い。**そのまま写さないこと。**
		Damage:             intPtr(1200),
		KnockdownAdvantage: intPtr(30),
		DriveGaugeConsumed: floatPtrIO(1.0),
		SAGaugeConsumed:    intPtr(0),
		Steps:              []model.ComboStep{{StepOrder: 1, MoveID: &mv0}},
	})
	if err != nil || vr.HasError() {
		t.Fatalf("create combo: err=%v vr=%+v", err, vr.Errors())
	}

	data, err := h.io.ExportCSV(ctx, comboio.ExportQuery{Range: comboio.RangeAll})
	if err != nil {
		t.Fatalf("export: %v", err)
	}
	files := unzip(t, data.Data)
	comboCSV, ok := files["combos.csv"]
	if !ok {
		t.Fatalf("combos.csv not in zip; have %v", keys(files))
	}
	if _, ok := files["setups.csv"]; !ok {
		t.Errorf("setups.csv not in zip; have %v", keys(files))
	}
	if !strings.Contains(comboCSV, h.moveCodes[0]) {
		t.Errorf("combos.csv missing starter move code %q:\n%s", h.moveCodes[0], comboCSV)
	}

	// 再 import preview → 既存重複として検出。
	prev, err := h.io.ParsePreview(ctx, comboCSV, "")
	if err != nil {
		t.Fatalf("preview: %v", err)
	}
	if len(prev.Combos) != 1 {
		t.Fatalf("expected 1 preview combo, got %d", len(prev.Combos))
	}
	if !prev.Combos[0].Duplicate {
		t.Errorf("expected duplicate flag for re-import of existing combo, got %+v", prev.Combos[0])
	}

	// commit skip → スキップされる。
	local := prev.Combos[0].LocalID
	res, err := h.io.Commit(ctx, comboCSV, "", []string{local}, comboio.DupSkip, 1)
	if err != nil {
		t.Fatalf("commit skip: %v", err)
	}
	if res.Summary.Skipped != 1 || res.Summary.Success != 0 {
		t.Errorf("expected 1 skipped 0 success, got %+v", res.Summary)
	}
}

// TestMediaFieldsExportImportRoundTrip はメディア 3 列(M17-01)が DB → export CSV →
// import → DB → 再 export まで verbatim で往復することを実 DB で検証する(統合)。
func TestMediaFieldsExportImportRoundTrip(t *testing.T) {
	h := newHarness(t)
	ctx := context.Background()

	mv0 := h.moveIDs[0]
	link := "https://example.com/m17-guide?x=1"
	video := "videos/ryu bnb #1.mp4"
	image := "images/ryu-bnb.png"
	// IsDraft=true: 再取込が VAL-C02 で弾かれないようにする(draft は C02 スキップ=常に新規作成)。
	_, vr, err := h.comboSvc.Create(ctx, combosvc.CreateInput{
		CharacterID:   h.ryuID,
		IsDraft:       true,
		StarterMoveID: &mv0,
		Link:          &link,
		VideoPath:     &video,
		ImagePath:     &image,
		Steps:         []model.ComboStep{{StepOrder: 1, MoveID: &mv0}},
	})
	if err != nil || vr.HasError() {
		t.Fatalf("create combo: err=%v vr=%+v", err, vr.Errors())
	}

	// export: 3 列の値が CSV に verbatim で載る。
	data, err := h.io.ExportCSV(ctx, comboio.ExportQuery{Range: comboio.RangeAll})
	if err != nil {
		t.Fatalf("export: %v", err)
	}
	comboCSV := unzip(t, data.Data)["combos.csv"]
	for _, want := range []string{link, video, image} {
		if !strings.Contains(comboCSV, want) {
			t.Errorf("combos.csv missing media value %q:\n%s", want, comboCSV)
		}
	}

	// import(draft のため skip 対象外=複製取込)→ 再 export で 2 行分の media が verbatim 一致。
	prev, err := h.io.ParsePreview(ctx, comboCSV, "")
	if err != nil || len(prev.Combos) != 1 {
		t.Fatalf("preview: err=%v combos=%+v", err, prev)
	}
	res, err := h.io.Commit(ctx, comboCSV, "", []string{prev.Combos[0].LocalID}, comboio.DupSkip, 1)
	if err != nil || res.Summary.Success != 1 {
		t.Fatalf("commit: err=%v summary=%+v", err, res.Summary)
	}
	data2, err := h.io.ExportCSV(ctx, comboio.ExportQuery{Range: comboio.RangeAll})
	if err != nil {
		t.Fatalf("re-export: %v", err)
	}
	comboCSV2 := unzip(t, data2.Data)["combos.csv"]
	for _, want := range []string{link, video, image} {
		if got := strings.Count(comboCSV2, want); got != 2 {
			t.Errorf("re-exported CSV should contain %q twice (original+imported), got %d:\n%s", want, got, comboCSV2)
		}
	}
}

// TestImportNewComboCreatesWithTags は新規コンボ(タグ付き)を CSV から取り込み、
// 新規タグ作成 + starter 再導出が行われることを検証する。
func TestImportNewComboCreatesWithTags(t *testing.T) {
	h := newHarness(t)
	ctx := context.Background()

	// 手書き相当の CSV を export 経由で作る(starter 列なし・recipe 先頭から導出される)。
	csv := buildComboCSV(t, h.moveCodes[0], h.moveCodes[1])

	prev, err := h.io.ParsePreview(ctx, csv, "")
	if err != nil {
		t.Fatalf("preview: %v", err)
	}
	if len(prev.Combos) != 1 || !prev.Combos[0].Importable {
		t.Fatalf("expected 1 importable combo, got %+v", prev.Combos)
	}
	if prev.Combos[0].StarterMoveCode != h.moveCodes[0] {
		t.Errorf("starter should be recipe head %q, got %q", h.moveCodes[0], prev.Combos[0].StarterMoveCode)
	}

	res, err := h.io.Commit(ctx, csv, "", []string{prev.Combos[0].LocalID}, comboio.DupSkip, 1)
	if err != nil {
		t.Fatalf("commit: %v", err)
	}
	if res.Summary.Success != 1 {
		t.Fatalf("expected 1 created, got %+v (rows=%+v)", res.Summary, res.Rows)
	}
}

// buildComboCSV は ryu の 2 ステップレシピ + 新規タグ 1 件のコンボ CSV を組み立てる。
func buildComboCSV(t *testing.T, head, second string) string {
	t.Helper()
	header := strings.Join([]string{
		"local_id", "character_code", "is_draft", "damage",
		"drive_available_at_start", "sa_available_at_start", "drive_damage",
		"position", "opponent_stance", "hit_type", "opponent_size", "situation",
		"oki_meaty_neutral_tech_throw", "oki_meaty_neutral_tech_throw_dr",
		"oki_meaty_back_tech_throw", "oki_meaty_back_tech_throw_dr",
		"oki_shimmy_neutral_tech", "oki_shimmy_back_tech",
		// ★M27-02b(VAL-C15) / ★★M38-01: 本登録の fixture が CSV へ載せる欄。
		//   ★M38-01 で必須欄が 2 欄になり、CSV が咎めるのは
		//     damage / knockdown_advantage の 2 列だけになった。⇒ 消費ゲージは余分である。
		//   ★消費ゲージ 2 列は optionalImportColumns 側であり、旧ファイルにも
		//     無くてよい列である(列を必須にしていない＝contract.go:47 の先例)。
		"sa_gauge_consumed", "drive_gauge_consumed",
		"knockdown_advantage", "memo", "tags", "recipe",
	}, ",")
	recipe := `"[{""move_code"":""` + head + `"",""modifiers"":{}},{""move_code"":""` + second + `"",""modifiers"":{}}]"`
	tags := `"[{""name"":""新規取込タグ""}]"`
	row := strings.Join([]string{
		"x1", "ryu", "false", "1500", "", "", "",
		"", "", "", "", "",
		"", "", "", "", "", "",
		// ★M27-02b: sa_gauge_consumed / drive_gauge_consumed / knockdown_advantage。
		"0", "1",
		"30", "取込メモ", tags, recipe,
	}, ",")
	return header + "\n" + row + "\n"
}

// TestImportSetupParentResolution はコンボ + セットプレイ CSV を同一バッチで取り込み、
// parent_combo_local_id が同一バッチの local_id で解決されることを検証する。
func TestImportSetupParentResolution(t *testing.T) {
	h := newHarness(t)
	ctx := context.Background()

	comboCSV := buildComboCSVLocal(t, "p1", h.moveCodes[0], h.moveCodes[1])
	setupCSV := buildSetupCSV(t, "p1", "詐欺飛び", h.moveCodes[0])

	prev, err := h.io.ParsePreview(ctx, comboCSV, setupCSV)
	if err != nil {
		t.Fatalf("preview: %v", err)
	}
	if len(prev.Setups) != 1 || !prev.Setups[0].ParentResolvable {
		t.Fatalf("expected resolvable setup, got %+v", prev.Setups)
	}

	res, err := h.io.Commit(ctx, comboCSV, setupCSV, []string{"p1"}, comboio.DupSkip, 1)
	if err != nil {
		t.Fatalf("commit: %v", err)
	}
	// コンボ 1 + セットプレイ 1 = 成功 2。
	if res.Summary.Success != 2 {
		t.Fatalf("expected 2 created (combo+setup), got %+v (rows=%+v)", res.Summary, res.Rows)
	}
}

// TestImportUnknownMoveNullified は未知 move_code が VAL-I07 WARNING で取り込み可能(move_id NULL)を検証。
func TestImportUnknownMoveNullified(t *testing.T) {
	h := newHarness(t)
	ctx := context.Background()

	csv := buildComboCSVLocal(t, "u1", "no_such_move_code", h.moveCodes[1])
	prev, err := h.io.ParsePreview(ctx, csv, "")
	if err != nil {
		t.Fatalf("preview: %v", err)
	}
	if !prev.Combos[0].Importable {
		t.Fatalf("unknown move should be importable (WARNING), got %+v", prev.Combos[0])
	}
	hasI07 := false
	for _, w := range prev.Combos[0].Warnings {
		if strings.Contains(w, "VAL-I07") {
			hasI07 = true
		}
	}
	if !hasI07 {
		t.Errorf("expected VAL-I07 warning, got %v", prev.Combos[0].Warnings)
	}
	res, err := h.io.Commit(ctx, csv, "", []string{"u1"}, comboio.DupSkip, 1)
	if err != nil {
		t.Fatalf("commit: %v", err)
	}
	if res.Summary.Success != 1 {
		t.Errorf("expected 1 created, got %+v (rows=%+v)", res.Summary, res.Rows)
	}
}

// TestImportPartialSuccess は不正行(未知キャラ)を含むバッチで、正常行のみ取り込まれることを検証。
func TestImportPartialSuccess(t *testing.T) {
	h := newHarness(t)
	ctx := context.Background()

	header := comboCSVHeader()
	good := comboCSVRow("ok1", "ryu", h.moveCodes[0])
	bad := comboCSVRow("bad1", "ghostchar", h.moveCodes[0]) // 未知キャラ → VAL-I06 ERROR
	csv := header + "\n" + good + "\n" + bad + "\n"

	prev, err := h.io.ParsePreview(ctx, csv, "")
	if err != nil {
		t.Fatalf("preview: %v", err)
	}
	if prev.Summary.ComboError != 1 || prev.Summary.ComboOK != 1 {
		t.Fatalf("expected 1 ok 1 error, got %+v", prev.Summary)
	}

	res, err := h.io.Commit(ctx, csv, "", []string{"ok1", "bad1"}, comboio.DupSkip, 1)
	if err != nil {
		t.Fatalf("commit: %v", err)
	}
	// bad1 は Combo==nil で取り込み候補外 → 成功 1 のみ。
	if res.Summary.Success != 1 {
		t.Errorf("expected 1 created, got %+v (rows=%+v)", res.Summary, res.Rows)
	}
}

// TestImportIdempotentSkip は同一新規コンボを 2 回(2 回目 skip)取り込んでも重複しないことを検証。
func TestImportIdempotentSkip(t *testing.T) {
	h := newHarness(t)
	ctx := context.Background()

	csv := buildComboCSVLocal(t, "i1", h.moveCodes[0], h.moveCodes[1])

	r1, err := h.io.Commit(ctx, csv, "", []string{"i1"}, comboio.DupSkip, 1)
	if err != nil || r1.Summary.Success != 1 {
		t.Fatalf("first import: err=%v summary=%+v", err, r1.Summary)
	}
	r2, err := h.io.Commit(ctx, csv, "", []string{"i1"}, comboio.DupSkip, 1)
	if err != nil {
		t.Fatalf("second import: %v", err)
	}
	if r2.Summary.Skipped != 1 || r2.Summary.Success != 0 {
		t.Errorf("second import should skip duplicate, got %+v", r2.Summary)
	}
}

// TestImportSetupParentFailureSkipped は親コンボが取込対象外/未存在のセットプレイが
// スキップ + レポートされることを検証する(§4.6)。
func TestImportSetupParentFailureSkipped(t *testing.T) {
	h := newHarness(t)
	ctx := context.Background()

	comboCSV := buildComboCSVLocal(t, "p9", h.moveCodes[0], h.moveCodes[1])
	// 親 local_id "ghost"(バッチに存在せず・数値でもない)→ 解決不能。
	setupCSV := buildSetupCSV(t, "ghost", "孤児セットプレイ", h.moveCodes[0])

	prev, err := h.io.ParsePreview(ctx, comboCSV, setupCSV)
	if err != nil {
		t.Fatalf("preview: %v", err)
	}
	if prev.Setups[0].ParentResolvable {
		t.Errorf("expected unresolvable parent in preview, got %+v", prev.Setups[0])
	}

	res, err := h.io.Commit(ctx, comboCSV, setupCSV, []string{"p9"}, comboio.DupSkip, 1)
	if err != nil {
		t.Fatalf("commit: %v", err)
	}
	// コンボ 1 created + セットプレイ 1 skipped。
	if res.Summary.Success != 1 || res.Summary.Skipped != 1 {
		t.Fatalf("expected 1 created + 1 skipped, got %+v (rows=%+v)", res.Summary, res.Rows)
	}
	foundSetupSkip := false
	for _, r := range res.Rows {
		if r.Kind == "setup" && r.Status == "skipped" {
			foundSetupSkip = true
		}
	}
	if !foundSetupSkip {
		t.Errorf("expected a skipped setup row, got %+v", res.Rows)
	}
}

// TestImportSetupsOnlyParentResolution は「セットプレイのみ取込」で、重複コンボ本体は
// skip しつつ、その配下セットプレイが重複相手の既存コンボへ親解決されて取り込まれることを検証する(B-6)。
func TestImportSetupsOnlyParentResolution(t *testing.T) {
	h := newHarness(t)
	ctx := context.Background()

	comboCSV := buildComboCSVLocal(t, "p1", h.moveCodes[0], h.moveCodes[1])
	// 既存コンボを先に取り込む(セットプレイなし)。
	if r, err := h.io.Commit(ctx, comboCSV, "", []string{"p1"}, comboio.DupSkip, 1); err != nil || r.Summary.Success != 1 {
		t.Fatalf("seed combo: err=%v summary=%+v", err, r.Summary)
	}

	// 同一コンボ(重複)+ セットプレイを setups_only で取り込む。
	setupCSV := buildSetupCSV(t, "p1", "詐欺飛び", h.moveCodes[0])
	res, err := h.io.Commit(ctx, comboCSV, setupCSV, []string{"p1"}, comboio.DupSetupsOnly, 1)
	if err != nil {
		t.Fatalf("commit setups_only: %v", err)
	}
	// コンボは skip(重複)、セットプレイは既存コンボへ created。
	if res.Summary.Skipped != 1 || res.Summary.Success != 1 {
		t.Fatalf("expected combo skipped + setup created, got %+v (rows=%+v)", res.Summary, res.Rows)
	}
	var comboSkipped, setupCreated bool
	for _, r := range res.Rows {
		if r.Kind == "combo" && r.Status == "skipped" {
			comboSkipped = true
		}
		if r.Kind == "setup" && r.Status == "created" {
			setupCreated = true
		}
	}
	if !comboSkipped || !setupCreated {
		t.Errorf("expected combo skipped & setup created, got rows=%+v", res.Rows)
	}

	// 再 export: コンボは 1 件のまま(重複増殖なし)・setups.csv に取り込んだセットプレイが載る。
	data, err := h.io.ExportCSV(ctx, comboio.ExportQuery{Range: comboio.RangeAll})
	if err != nil {
		t.Fatalf("re-export: %v", err)
	}
	files := unzip(t, data.Data)
	prev, err := h.io.ParsePreview(ctx, files["combos.csv"], "")
	if err != nil {
		t.Fatalf("re-preview: %v", err)
	}
	if len(prev.Combos) != 1 {
		t.Errorf("expected exactly 1 combo after setups-only import, got %d", len(prev.Combos))
	}
	if !strings.Contains(files["setups.csv"], "詐欺飛び") {
		t.Errorf("exported setups.csv should contain the setups-only imported setup:\n%s", files["setups.csv"])
	}
}

// TestImportSetupsOnlyDuplicateSetupJudgement は setups_only の既存コンボ配下で、
// セットプレイ重複判定を検証する(B-6・開発者確定 2026-07-18)。
// レシピ一致=セットプレイの同一性(名前非依存・VAL-S04)につき「同レシピ=graceful skip /
// 別レシピ=取込む」。承認基準§4-(4)「同名+同レシピ=skip・名前だけ一致(同名別レシピ)=取込む」を
// 満たしつつ、既存不変条件 VAL-S04(別名でも同レシピは 1 コンボに 1 つ)と整合する。
func TestImportSetupsOnlyDuplicateSetupJudgement(t *testing.T) {
	cases := []struct {
		name       string
		setupName  string
		diffRecipe bool // true: 既存と別レシピ(moveCodes[1])を使う
		wantSkip   bool
	}{
		{"同名+同レシピ=skip", "詐欺飛び", false, true},
		{"同名+別レシピ=取込む", "詐欺飛び", true, false},
		{"別名+同レシピ=skip(レシピ一致)", "逃げ", false, true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			h := newHarness(t)
			ctx := context.Background()
			comboCSV := buildComboCSVLocal(t, "p1", h.moveCodes[0], h.moveCodes[1])
			// 既存コンボ + 既存セットプレイ("詐欺飛び"・recipe=[moveCodes[0]])。
			seed := buildSetupCSV(t, "p1", "詐欺飛び", h.moveCodes[0])
			if r, err := h.io.Commit(ctx, comboCSV, seed, []string{"p1"}, comboio.DupSkip, 1); err != nil || r.Summary.Success != 2 {
				t.Fatalf("seed: err=%v summary=%+v", err, r.Summary)
			}

			head := h.moveCodes[0]
			if tc.diffRecipe {
				head = h.moveCodes[1]
			}
			newSetup := buildSetupCSV(t, "p1", tc.setupName, head)
			res, err := h.io.Commit(ctx, comboCSV, newSetup, []string{"p1"}, comboio.DupSetupsOnly, 1)
			if err != nil {
				t.Fatalf("commit: %v", err)
			}
			var setupStatus string
			for _, r := range res.Rows {
				if r.Kind == "setup" {
					setupStatus = r.Status
				}
			}
			if tc.wantSkip && setupStatus != "skipped" {
				t.Errorf("expected setup skipped (同名+同レシピ), got %q (rows=%+v)", setupStatus, res.Rows)
			}
			if !tc.wantSkip && setupStatus != "created" {
				t.Errorf("expected setup created, got %q (rows=%+v)", setupStatus, res.Rows)
			}
		})
	}
}

// TestImportSetupsOnlyDoesNotTouchCombo は setups_only の親解決が既存コンボ本体
// (version・recipe cache)に波及しないことを検証する(B-6 非波及・combos の同一性不変)。
func TestImportSetupsOnlyDoesNotTouchCombo(t *testing.T) {
	h := newHarness(t)
	ctx := context.Background()

	mv0 := h.moveIDs[0]
	created, vr, err := h.comboSvc.Create(ctx, combosvc.CreateInput{
		CharacterID:   h.ryuID,
		StarterMoveID: &mv0,
		// ★M27-02b(VAL-C15) / ★★M38-01: 本登録の fixture が埋める欄。
		//
		//	★★M38-01 追補2 の時点で必須は 2 欄である。⇒ いまサーバが咎めるのは
		//	  damage / knockdownAdvantage だけである(正典 =
		//	  internal/service/validation/combo.go の requiredPublishedFields)。
		//	★消費ゲージ 2 欄は必須から外れた。開始残量 2 欄は必須だが、「不問」を
		//	  NULL で表すためサーバからは空と区別できず咎めない。
		//	⇒ 本 fixture が消費ゲージを埋めているのは余分であって害は無い。**そのまま写さないこと。**
		Damage:             intPtr(1200),
		KnockdownAdvantage: intPtr(30),
		DriveGaugeConsumed: floatPtrIO(1.0),
		SAGaugeConsumed:    intPtr(0),
		Steps:              []model.ComboStep{{StepOrder: 1, MoveID: &mv0}},
	})
	if err != nil || vr.HasError() {
		t.Fatalf("create combo: err=%v vr=%+v", err, vr.Errors())
	}
	before, err := h.comboSvc.Get(ctx, created.ID, 1)
	if err != nil {
		t.Fatalf("get before: %v", err)
	}

	// 同一キー + 同一レシピの重複行 + セットプレイを setups_only で取り込む。
	comboCSV := comboCSVHeader() + "\n" + comboCSVRow("p1", "ryu", h.moveCodes[0]) + "\n"
	setupCSV := buildSetupCSV(t, "p1", "起き攻め", h.moveCodes[0])
	res, err := h.io.Commit(ctx, comboCSV, setupCSV, []string{"p1"}, comboio.DupSetupsOnly, 1)
	if err != nil {
		t.Fatalf("commit: %v", err)
	}
	if res.Summary.Skipped != 1 || res.Summary.Success != 1 {
		t.Fatalf("expected combo skipped + setup created, got %+v (rows=%+v)", res.Summary, res.Rows)
	}

	after, err := h.comboSvc.Get(ctx, created.ID, 1)
	if err != nil {
		t.Fatalf("get after: %v", err)
	}
	if before.Version != after.Version {
		t.Errorf("combo version changed by setups-only import: before=%d after=%d", before.Version, after.Version)
	}
	if before.StepCount != after.StepCount {
		t.Errorf("combo step_count changed: before=%d after=%d", before.StepCount, after.StepCount)
	}
	if ptrStr(before.RecipeCache) != ptrStr(after.RecipeCache) {
		t.Errorf("combo recipe cache changed: before=%v after=%v", ptrStr(before.RecipeCache), ptrStr(after.RecipeCache))
	}
}

func ptrStr(p *string) string {
	if p == nil {
		return "<nil>"
	}
	return *p
}

func keys(m map[string]string) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	return out
}

// ── CSV 組み立てヘルパ ─────────────────────────────────────────────────

func comboCSVHeader() string {
	return strings.Join([]string{
		"local_id", "character_code", "is_draft", "damage",
		"drive_available_at_start", "sa_available_at_start", "drive_damage",
		"position", "opponent_stance", "hit_type", "opponent_size", "situation",
		"oki_meaty_neutral_tech_throw", "oki_meaty_neutral_tech_throw_dr",
		"oki_meaty_back_tech_throw", "oki_meaty_back_tech_throw_dr",
		"oki_shimmy_neutral_tech", "oki_shimmy_back_tech",
		// ★M27-02b(VAL-C15) / ★★M38-01: 本登録の fixture が CSV へ載せる欄。
		//   ★M38-01 で必須欄が 2 欄になり、CSV が咎めるのは
		//     damage / knockdown_advantage の 2 列だけになった。⇒ 消費ゲージは余分である。
		//   ★消費ゲージ 2 列は optionalImportColumns 側であり、旧ファイルにも
		//     無くてよい列である(列を必須にしていない＝contract.go:47 の先例)。
		"sa_gauge_consumed", "drive_gauge_consumed",
		"knockdown_advantage", "memo", "tags", "recipe",
	}, ",")
}

func comboCSVRow(local, charCode, head string) string {
	recipe := `"[{""move_code"":""` + head + `"",""modifiers"":{}}]"`
	return strings.Join([]string{
		local, charCode, "false", "1000", "", "", "",
		"", "", "", "", "",
		"", "", "", "", "", "",
		// ★M27-02b: 消費 SA / 消費 drive / 有利フレーム(本登録の必須欄)。
		"0", "1",
		"30", "メモ", "", recipe,
	}, ",")
}

func buildComboCSVLocal(t *testing.T, local, head, second string) string {
	t.Helper()
	recipe := `"[{""move_code"":""` + head + `"",""modifiers"":{}},{""move_code"":""` + second + `"",""modifiers"":{}}]"`
	row := strings.Join([]string{
		local, "ryu", "false", "1500", "", "", "",
		"", "", "", "", "",
		"", "", "", "", "", "",
		// ★M27-02b: 消費 SA / 消費 drive / 有利フレーム(本登録の必須欄)。
		"0", "1",
		"30", "取込メモ", "", recipe,
	}, ",")
	return comboCSVHeader() + "\n" + row + "\n"
}

func buildSetupCSV(t *testing.T, parentLocal, name, head string) string {
	t.Helper()
	header := strings.Join([]string{
		"parent_combo_local_id", "name", "description", "recipe",
	}, ",")
	recipe := `"[{""move_code"":""` + head + `"",""modifiers"":{}}]"`
	row := strings.Join([]string{parentLocal, name, "説明", recipe}, ",")
	return header + "\n" + row + "\n"
}

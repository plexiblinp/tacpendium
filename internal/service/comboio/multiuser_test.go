package comboio_test

import (
	"context"
	"strings"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
	combosvc "github.com/plexiblinp/tacpendium/internal/service/combo"
	comboio "github.com/plexiblinp/tacpendium/internal/service/comboio"
)

// M22-02 段 2: エクスポート・インポートのタグ経路が利用者で絞られること。
//
// ★他から引っ越しの経路を落とすと、取り込んだタグが別人のものになる(§4.5-5)。
// ★出力に載るタグは出力する利用者のものになる(§4.5-10)。同じコンボでも
//   出力する人によって載るタグが変わるのは D-402 の帰結であり、欠陥ではない。

func createUserFor(t *testing.T, h *harness, name string) int64 {
	t.Helper()
	res, err := h.db.Exec(`INSERT INTO users (name) VALUES (?)`, name)
	if err != nil {
		t.Fatalf("create user: %v", err)
	}
	id, err := res.LastInsertId()
	if err != nil {
		t.Fatalf("last insert id: %v", err)
	}
	return id
}

func tagIDByName(t *testing.T, h *harness, userID int64, name string) int64 {
	t.Helper()
	var id int64
	if err := h.db.QueryRow(`SELECT id FROM tags WHERE user_id = ? AND name = ?`,
		userID, name).Scan(&id); err != nil {
		t.Fatalf("tag %q for user %d: %v", name, userID, err)
	}
	return id
}

func countTagsNamed(t *testing.T, h *harness, userID int64, name string) int {
	t.Helper()
	var n int
	if err := h.db.QueryRow(`SELECT COUNT(*) FROM tags WHERE user_id = ? AND name = ?`,
		userID, name).Scan(&n); err != nil {
		t.Fatalf("count tags: %v", err)
	}
	return n
}

// csvWithTag は 1 行のコンボ CSV を、指定したタグ名付きで組み立てる。
func csvWithTag(head, tagName string) string {
	recipe := `"[{""move_code"":""` + head + `"",""modifiers"":{}}]"`
	tags := `"[{""name"":""` + tagName + `""}]"`
	row := strings.Join([]string{
		"t1", "ryu", "false", "1200", "", "", "",
		"", "", "", "", "",
		"", "", "", "", "", "",
		// ★M27-02b: 消費 SA / 消費 drive / 有利フレーム(本登録の必須欄)。
		"0", "1",
		"30", "メモ", tags, recipe,
	}, ",")
	return comboCSVHeader() + "\n" + row + "\n"
}

// ★§5.1-19（重大 §9-23）: 取り込みが既定タグと重複を作らない。
// D-402 で既定タグを生成するようになったため、取り込みが「既に在るもの」と
// 出会う場面が増えた。同名タグが 2 本並ぶと、どちらが効いているか分からなくなる。
func TestImport_DoesNotDuplicateExistingTagOfSameUser(t *testing.T) {
	h := newHarness(t)
	ctx := context.Background()

	// user_id = 1 は migrations/000007 で「使用中」を持っている。
	before := countTagsNamed(t, h, 1, "使用中")
	if before != 1 {
		t.Fatalf("前提が崩れている: user 1 の「使用中」= %d 件", before)
	}

	csv := csvWithTag(h.moveCodes[0], "使用中")
	if _, err := h.io.Commit(ctx, csv, "", []string{"t1"}, comboio.DupSkip, 1); err != nil {
		t.Fatalf("commit: %v", err)
	}

	if after := countTagsNamed(t, h, 1, "使用中"); after != 1 {
		t.Errorf("取り込みで「使用中」が %d 件へ増えた(重複を作っている)", after)
	}
}

// ★§5.1-11 / §4.5-5: 取り込んだタグが取り込んだ人のものになる。
// 片方だけ差し替えると別人のタグになる。
func TestImport_CreatesTagsForTheImportingUser(t *testing.T) {
	h := newHarness(t)
	ctx := context.Background()
	userB := createUserFor(t, h, "B")

	csv := csvWithTag(h.moveCodes[0], "B の新規タグ")
	if _, err := h.io.Commit(ctx, csv, "", []string{"t1"}, comboio.DupSkip, userB); err != nil {
		t.Fatalf("commit as B: %v", err)
	}

	if got := countTagsNamed(t, h, userB, "B の新規タグ"); got != 1 {
		t.Errorf("B のタグとして作られていない(件数 %d)", got)
	}
	if got := countTagsNamed(t, h, 1, "B の新規タグ"); got != 0 {
		t.Errorf("★取り込んだタグが別人(user 1)のものになっている(件数 %d)", got)
	}
}

// ★§5.1-25: エクスポートに他の利用者のタグが載らない。
// ★§5.1-20: 載るタグは出力した利用者のものである。
func TestExport_TagsAreScopedToExportingUser(t *testing.T) {
	h := newHarness(t)
	ctx := context.Background()
	userB := createUserFor(t, h, "B")

	// B にも「使用中」を作る(既定タグの生成と同じ状況＝同名の並存)。
	if _, err := h.db.Exec(`INSERT INTO tags (user_id, name, category) VALUES (?, ?, ?)`,
		userB, "使用中", model.TagCategoryMyComboStatus); err != nil {
		t.Fatalf("create tag for B: %v", err)
	}
	tagA := tagIDByName(t, h, 1, "使用中")
	tagB := tagIDByName(t, h, userB, "使用中")

	// A が自分のタグを付けたコンボを作る。
	created, _, err := h.comboSvc.Create(ctx, combosvc.CreateInput{
		UserID:      1,
		CharacterID: h.ryuID,
		Damage:      intPtr(1000),
		// ★M27-02b(VAL-C15) / ★★M38-01: 本登録の fixture が埋める欄(IsDraft 既定 false)。
		//   ★M38-01 追補2 の時点で必須は damage / knockdownAdvantage の 2 欄である。
		KnockdownAdvantage: intPtr(30),
		DriveGaugeConsumed: floatPtrIO(1.0),
		SAGaugeConsumed:    intPtr(0),
		TagIDs:             []int64{tagA},
		Steps:              []model.ComboStep{{StepOrder: 1, MoveID: &h.moveIDs[0]}},
	})
	if err != nil {
		t.Fatalf("create combo: %v", err)
	}

	// A が出力すると自分のタグが載る(対照)。
	dataA, err := h.io.ExportCSV(ctx, comboio.ExportQuery{
		Range: comboio.RangeSelected, SelectedIDs: []int64{created.ID}, UserID: 1,
	})
	if err != nil {
		t.Fatalf("export as A: %v", err)
	}
	if !strings.Contains(unzip(t, dataA.Data)["combos.csv"], "使用中") {
		t.Error("A の出力に自分のタグが載っていない(対照)")
	}

	// ★B が出力すると載らない。B は付けていないためである。
	dataB, err := h.io.ExportCSV(ctx, comboio.ExportQuery{
		Range: comboio.RangeSelected, SelectedIDs: []int64{created.ID}, UserID: userB,
	})
	if err != nil {
		t.Fatalf("export as B: %v", err)
	}
	if strings.Contains(unzip(t, dataB.Data)["combos.csv"], "使用中") {
		t.Error("★B の出力に A のタグが載っている")
	}
	_ = tagB
}

func intPtr(v int) *int { return &v }

// ★M27-02b(VAL-C15): 消費ドライブゲージは REAL(float64)。
// ★名前を floatPtr にしないのは、同パッケージの他ファイルとの衝突を避けるためである。
func floatPtrIO(v float64) *float64 { return &v }

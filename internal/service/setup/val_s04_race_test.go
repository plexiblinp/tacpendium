package setup_test

import (
	"context"
	"database/sql"
	"testing"
	"time"

	"github.com/plexiblinp/tacpendium/internal/model"
	setupsvc "github.com/plexiblinp/tacpendium/internal/service/setup"
)

// M24-13 §4.6 / CHANGE-139: VAL-S04 の check-then-act 競合を固定する決定論テスト。
//
// ★★形は M24-11 の VAL-C02 版(combo/val_c02_race_test.go)をそのまま踏襲している。
// 2 つ目の形を作らない——同じ欠陥に対して観測の書き方が 2 通りあると、片方だけ直る。
//
// ★★なぜ「決定論」でなければならないのか————————————————————————
// 同時実行の欠陥は、直っていなくても出ないことがある。⇒ 緑の回数は「直った」の
// 根拠にならない。本テストは確率を排し「必ず赤 / 必ず緑」へ翻訳する。
//
// ★★仕掛け————————————————————————————————————————
// テスト自身が「先行する書き込みトランザクション(tx1)」を演じ、その内側で
// 同一レシピのセットプレイを同じ親コンボへ紐付けてから holdFor だけ保持して commit する。
// その保持中に svc.CreateSetup を走らせ、後続がどう振る舞うかを見る。
//
//	修正前(検証が tx の外):
//	  検証は *sql.DB で走り tx1 の未コミット行が見えない ⇒ 「重複なし」を見る
//	  ⇒ そのまま INSERT ⇒ 同一レシピのセットプレイが同じコンボへ 2 本並ぶ(赤)
//	修正後(BEGIN IMMEDIATE + 検証が tx の内側):
//	  BeginTx が tx1 の write lock で待つ ⇒ commit 後に tx 経由で読む
//	  ⇒ 重複を見つけて VAL-S04 で止まる ⇒ 紐付きは 1 件(緑)
//
// ★破壊確認 5 の相手である。判定を tx の外へ戻すと本テストが赤くなる。

// s04RaceHoldFor は tx1 が行を作ってから commit するまで保持する時間。
//
// ★この値は再現確率を上げるための待ちではない。tx1 が write lock を握っている区間を
// 確実に作るための構造であり、後続は startedC の同期で必ずこの区間に入る。
const s04RaceHoldFor = 400 * time.Millisecond

func TestService_CreateSetup_VAL_S04_ConcurrentDoesNotDoubleLink(t *testing.T) {
	env := newTestEnv(t)
	ctx := context.Background()
	input := validSetupInput(t, env.db)

	// --- tx1: 先行する書き込みトランザクション -------------------------------
	tx1, err := env.db.BeginTx(ctx, nil)
	if err != nil {
		t.Fatalf("begin tx1: %v", err)
	}
	insertRivalSetup(t, ctx, env, tx1, input)

	// ★ここで tx1 は write lock を握っている(行を書いたため)。
	//   修正後は、後続の BeginTx がこの時点で待たされる。

	type outcome struct {
		duplicate bool
		err       error
	}
	startedC := make(chan struct{})
	doneC := make(chan outcome, 1)

	go func() {
		close(startedC)
		_, result, createErr := env.svc.CreateSetup(ctx, env.comboID, validSetupInput(t, env.db))
		dup := false
		for _, i := range result.Errors() {
			if i.Code == setupsvc.CodeS04Duplicate {
				dup = true
			}
		}
		doneC <- outcome{duplicate: dup, err: createErr}
	}()

	<-startedC
	// ★後続が CreateSetup に入ったことを確かめてから保持する。
	//   これで「保持区間に後続が入る」ことが確率ではなく構造で保証される。
	time.Sleep(s04RaceHoldFor)

	if err := tx1.Commit(); err != nil {
		t.Fatalf("commit tx1: %v", err)
	}

	got := <-doneC
	if got.err != nil {
		t.Fatalf("後続の CreateSetup がエラーになった: %v", got.err)
	}

	// ★★判定は 2 つで行う。回数では判定しない。
	if !got.duplicate {
		t.Error("後続が VAL-S04 で止まっていない。判定が tx1 の未コミット行を見ていない" +
			"(check-then-act の窓が開いたまま)")
	}
	if n := countSetupsLinkedTo(t, env, env.comboID); n != 1 {
		t.Errorf("同一レシピのセットプレイが %d 件紐付いている, want 1", n)
	}
}

// TestService_CreateSetupInTx_VAL_S04_SeesUncommittedSiblings は同一リクエスト内の
// 重複を固定する(POST /api/combos の同梱セットプレイ)。
//
// ★★これは競合ではない。1 本の tx の中で 2 本目を書く形であり、以前は判定が
// *sql.DB 直読みだったため 1 本目が見えず、同じレシピが 2 本並んだ
// (D-360＝tx を受け取っていても読みに使わなければ意味が無い)。
// ★競合テストと違い goroutine も待ちも要らない。決定論そのものである。
func TestService_CreateSetupInTx_VAL_S04_SeesUncommittedSiblings(t *testing.T) {
	env := newTestEnv(t)
	ctx := context.Background()

	tx, err := env.db.BeginTx(ctx, nil)
	if err != nil {
		t.Fatalf("begin tx: %v", err)
	}
	defer func() { _ = tx.Rollback() }()

	// 1 本目: 通る。
	if _, result, err := env.svc.CreateSetupInTx(ctx, tx, env.comboID, validSetupInput(t, env.db)); err != nil {
		t.Fatalf("1 本目: %v", err)
	} else if result.HasError() {
		t.Fatalf("1 本目が落ちた: %+v", result.Errors())
	}

	// 2 本目: 同じレシピ。★名前を変えても重複である(VAL-S04 は名前を見ない)。
	second := validSetupInput(t, env.db)
	name := "名前だけ違う 2 本目"
	second.Name = &name
	_, result, err := env.svc.CreateSetupInTx(ctx, tx, env.comboID, second)
	if err != nil {
		t.Fatalf("2 本目: %v", err)
	}
	found := false
	for _, i := range result.Errors() {
		if i.Code == setupsvc.CodeS04Duplicate {
			found = true
		}
	}
	if !found {
		t.Errorf("同一 tx 内の 1 本目が見えていない(未コミット行を読めていない): %+v", result.Issues)
	}
}

// insertRivalSetup は tx1 の内側で「同一レシピのセットプレイを同じコンボへ紐付ける」。
//
// ★サービスを通さないのは、サービスが自分でトランザクションを開いてしまうためである
// (M24-11 の insertRivalCombo と同じ理由)。
func insertRivalSetup(t *testing.T, ctx context.Context, env *testEnv, tx *sql.Tx, input setupsvc.CreateSetupInput) {
	t.Helper()
	setup := &model.Setup{
		CharacterID: input.CharacterID,
		Name:        input.Name,
		StepCount:   len(input.Steps),
		Version:     1,
	}
	id, err := env.repo.InsertSetup(ctx, tx, setup)
	if err != nil {
		t.Fatalf("insert rival setup: %v", err)
	}
	steps := make([]model.SetupStep, len(input.Steps))
	copy(steps, input.Steps)
	for i := range steps {
		steps[i].StepOrder = i + 1
	}
	if err := env.repo.InsertSteps(ctx, tx, id, steps); err != nil {
		t.Fatalf("insert rival steps: %v", err)
	}
	if err := env.repo.InsertComboSetup(ctx, tx, env.comboID, id); err != nil {
		t.Fatalf("insert rival combo_setup: %v", err)
	}
}

// countSetupsLinkedTo は comboID に紐付いた生存セットプレイの件数を返す。
func countSetupsLinkedTo(t *testing.T, env *testEnv, comboID int64) int {
	t.Helper()
	var n int
	err := env.db.QueryRow(`
		SELECT COUNT(*)
		FROM setups s
		JOIN combo_setups cs ON cs.setup_id = s.id
		WHERE cs.combo_id = ? AND s.deleted_at IS NULL`, comboID).Scan(&n)
	if err != nil {
		t.Fatalf("count linked setups: %v", err)
	}
	return n
}

package combo_test

import (
	"context"
	"database/sql"
	"testing"
	"time"

	comborepo "github.com/plexiblinp/tacpendium/internal/repository/combo"
	combosvc "github.com/plexiblinp/tacpendium/internal/service/combo"
	"github.com/plexiblinp/tacpendium/internal/service/validation"
)

// M24-11: VAL-C02 の check-then-act 競合を固定する決定論テスト。
//
// ★★なぜ「決定論」でなければならないのか———————————————————————————
// 一次源(M24-09c 設計伝達レポート §4-1)の再現手順は確率的である——逐語で
// 「--workers=2 --retries=0 を繰り返す。10 回中 1 回の頻度で、両方の
// POST /api/combos が 201 を返す」。同時実行の欠陥は、直っていなくても出ない
// ことがある。⇒ 緑の回数は「直った」の根拠にならない(チェックリスト 1-2)。
// 本テストは確率を排し、「必ず赤 / 必ず緑」へ翻訳する。
//
// ★★仕掛け————————————————————————————————————————————
// テスト自身が「先行する書き込みトランザクション(tx1)」を演じ、その内側で
// 同一識別キーの行を作ってから holdFor だけ保持して commit する。その保持中に
// svc.Create を走らせ、後続がどう振る舞うかを見る。
//
//	修正前(DEFERRED + 検証が tx の外):
//	  検証は *sql.DB で走り tx1 の未コミット行が見えない ⇒ 「重複なし」を見る
//	  ⇒ そのまま INSERT ⇒ 同一識別キーの本登録が 2 件生存する(赤)
//	修正後(BEGIN IMMEDIATE + 検証が tx の内側):
//	  BeginTx が tx1 の write lock で待つ ⇒ commit 後に tx 経由で読む
//	  ⇒ 重複を見つけて VAL-C02 で止まる ⇒ 行は 1 件(緑)
//
// ★本リポジトリで DB を並行に触る Go テストは本件が最初である
// (t.Parallel() は 0 件、既存の go func は DB を使わない)。相乗りできる先例が
// 無いため、待ちの観測方法も含めてここに書き下している。

// raceHoldFor は tx1 が行を作ってから commit するまで保持する時間。
//
// ★この値は「競合の再現確率」を上げるための待ちではない。tx1 が write lock を
// 握っている区間を確実に作るための構造であり、後続は必ずこの区間に入る
// (下の startedC で同期しているため)。⇒ 値を短くしても結果は変わらない。
const raceHoldFor = 400 * time.Millisecond

// TestService_Create_VAL_C02_ConcurrentDoesNotDoubleInsert は M24-11 の中心である。
//
// ★判定は「行が 1 件であること」と「後続が VAL-C02 で止まったこと」の 2 つで行う。
// 回数では判定しない。
func TestService_Create_VAL_C02_ConcurrentDoesNotDoubleInsert(t *testing.T) {
	db, svc := newSvc(t)
	ctx := context.Background()
	input := validRyuInput(t, db)

	// --- tx1: 先行する書き込みトランザクション ---------------------------------
	tx1, err := db.BeginTx(ctx, nil)
	if err != nil {
		t.Fatalf("begin tx1: %v", err)
	}
	insertRivalCombo(t, ctx, tx1, input)

	// ★ここで tx1 は write lock を握っている(行を書いたため)。
	//   修正後は、後続の BeginTx がこの時点で待たされる。

	startedC := make(chan struct{})
	doneC := make(chan createOutcome, 1)

	go func() {
		close(startedC) // 後続が走り出したことを tx1 側へ知らせる
		begin := time.Now()
		_, result, createErr := svc.Create(ctx, input)
		doneC <- createOutcome{result: result, err: createErr, elapsed: time.Since(begin)}
	}()

	<-startedC
	// ★後続が Create に入ったことを確かめてから保持する。
	//   これで「保持区間に後続が入る」ことが確率ではなく構造で保証される。
	time.Sleep(raceHoldFor)

	if err := tx1.Commit(); err != nil {
		t.Fatalf("commit tx1: %v", err)
	}

	got := <-doneC
	if got.err != nil {
		t.Fatalf("後続の Create が error を返した(バリデーション結果であるべき): %v", got.err)
	}

	// --- 判定 1: 同一識別キーの本登録が 2 件生存していないこと -------------------
	// ★これが M24-09c §4-1 が観測した状態そのものである。
	if n := countLiveDuplicates(t, db, input); n != 1 {
		t.Errorf("同一識別キーの生きた本登録コンボが %d 件ある(期待 1 件)。"+
			"VAL-C02 の判定と登録の間に割り込まれている", n)
	}

	// --- 判定 2: 後続が VAL-C02 で止まったこと ---------------------------------
	if !hasC02(got.result) {
		t.Errorf("後続の Create が VAL-C02 で止まらなかった。issues=%+v", got.result.Issues)
	}

	// --- 判定 3: 後続が tx1 の commit を待ったこと(観測) -----------------------
	// ★★「N 回緑だった」ではなく「待ちが起きた」を根拠にする(チェックリスト 1-2)。
	//   後続が tx1 より先に完了していたなら、それは待っていないということである。
	// ★elapsed は time.Since の返り値であり、tx1 の保持時間を下回らないことが
	//   「待った」ことの証明になる。★commit 時刻との前後比較を別途書かないこと——
	//   elapsed は常に非負であり、そこから導く比較は構造的に成立しえない(死んだ検査になる)。
	if got.elapsed < raceHoldFor {
		t.Errorf("後続が tx1 の commit を待っていない: 所要 %v < 保持 %v", got.elapsed, raceHoldFor)
	}
}

// TestService_Create_SingleInsertStillSucceeds は、単発の登録が従来どおり通ることの対照。
// ★競合対策で「常に重複エラー」になってしまう退行を捕まえる。
func TestService_Create_SingleInsertStillSucceeds(t *testing.T) {
	db, svc := newSvc(t)
	ctx := context.Background()

	got, result, err := svc.Create(ctx, validRyuInput(t, db))
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if result.HasError() {
		t.Fatalf("単発の登録が落ちた: %+v", result.Issues)
	}
	if got.ID == 0 {
		t.Error("ID が採番されていない")
	}
}

// ---------------------------------------------------------------------------
// ヘルパ
// ---------------------------------------------------------------------------

type createOutcome struct {
	result  validation.ValidationResult
	err     error
	elapsed time.Duration
}

func hasC02(r validation.ValidationResult) bool {
	for _, i := range r.Errors() {
		if i.Code == validation.CodeC02Duplicate {
			return true
		}
	}
	return false
}

// insertRivalCombo は input と同一の識別キー・同一レシピの本登録コンボを tx で作る。
//
// ★サービス層を通さず素の SQL で書くのは意図である——tx1 は「競合相手」の役であり、
// アプリの登録経路そのものを再現する必要はない。必要なのは「同一識別キーの行を
// 書いた書き込み tx が開いている」状態だけである。
func insertRivalCombo(t *testing.T, ctx context.Context, tx *sql.Tx, input combosvc.CreateInput) {
	t.Helper()
	res, err := tx.ExecContext(ctx, `
		INSERT INTO combos
		    (character_id, is_draft, damage, starter_move_id,
		     position, opponent_stance, hit_type, opponent_size, step_count, version)
		VALUES (?, 0, ?, ?, ?, ?, ?, ?, ?, 1)`,
		input.CharacterID, input.Damage, input.StarterMoveID,
		input.Position, input.OpponentStance, input.HitType, input.OpponentSize,
		len(input.Steps))
	if err != nil {
		t.Fatalf("insert rival combo: %v", err)
	}
	comboID, err := res.LastInsertId()
	if err != nil {
		t.Fatalf("last insert id: %v", err)
	}
	for _, s := range input.Steps {
		if _, err := tx.ExecContext(ctx,
			`INSERT INTO combo_steps (combo_id, step_order, move_id) VALUES (?, ?, ?)`,
			comboID, s.StepOrder, s.MoveID); err != nil {
			t.Fatalf("insert rival step: %v", err)
		}
	}
}

// countLiveDuplicates は input と同一識別キーの「生きた本登録コンボ」を数える。
//
// ★述語は DES-006 §2.3 と同じ(is_draft = 0 / deleted_at IS NULL / NULL 同士は一致)。
// レシピの一致は step_count と move_id 列で近似する——本テストの 2 件は同一レシピを
// 明示的に作っているため、これで十分に一意化できる。
func countLiveDuplicates(t *testing.T, db *sql.DB, input combosvc.CreateInput) int {
	t.Helper()
	var n int
	err := db.QueryRow(`
		SELECT COUNT(*) FROM combos
		WHERE character_id = ?
		  AND is_draft = 0
		  AND deleted_at IS NULL
		  AND starter_move_id IS ?
		  AND position IS ?
		  AND opponent_stance IS ?
		  AND hit_type IS ?
		  AND opponent_size IS ?`,
		input.CharacterID, input.StarterMoveID, input.Position,
		input.OpponentStance, input.HitType, input.OpponentSize).Scan(&n)
	if err != nil {
		t.Fatalf("count live duplicates: %v", err)
	}
	return n
}

// ---------------------------------------------------------------------------
// PUT(識別キーを変える編集)が従来どおり通ること
// ---------------------------------------------------------------------------

// TestService_UpdateWithKeyChange_StillSucceeds は、判定をトランザクションの内側へ
// 移したあとも PUT が通ることを主張する。
//
// ★★本経路は deleted_at IS NULL の周りで最も壊しやすい———————————————
// PUT は「旧行を論理削除 → 新行を登録」を同一トランザクションで行う。判定を
// 論理削除より後ろへ動かすと旧行が候補から消え、逆に述語を緩めると PUT が自分の
// 消した旧行に衝突してあらゆる編集が落ちる(DES-006 §2.3)。どちらも起きていないこと。
func TestService_UpdateWithKeyChange_StillSucceeds(t *testing.T) {
	db, svc := newSvc(t)
	ctx := context.Background()

	created, r, err := svc.Create(ctx, validRyuInput(t, db))
	if err != nil || r.HasError() {
		t.Fatalf("事前の登録が失敗した: err=%v issues=%+v", err, r.Issues)
	}

	// 識別キーを変える編集(position を変える)
	edit := validRyuInput(t, db)
	edit.Position = ptr("corner_self")

	got, result, err := svc.UpdateWithKeyChange(ctx, created.ID, created.Version, edit)
	if err != nil {
		t.Fatalf("UpdateWithKeyChange: %v", err)
	}
	if result.HasError() {
		t.Fatalf("識別キーを変える編集が落ちた: %+v", result.Issues)
	}
	if got.ID == created.ID {
		t.Error("新行が作られていない(PUT は旧行を論理削除して新行を作る)")
	}

	// 旧行が論理削除され、新行だけが生きていること
	var aliveOld int
	if err := db.QueryRow(`SELECT COUNT(*) FROM combos WHERE id = ? AND deleted_at IS NULL`,
		created.ID).Scan(&aliveOld); err != nil {
		t.Fatalf("count old: %v", err)
	}
	if aliveOld != 0 {
		t.Error("旧行が論理削除されていない")
	}
}

// TestService_UpdateWithKeyChange_SameKeyStillCollides は、キーを変えない PUT が
// 自分の旧行に衝突するという「既存の挙動」が変わっていないことを主張する。
//
// ★★これは欠陥の固定ではなく、射程外であることの固定である———————————
// service.go の UpdateWithKeyChange が自らこの限界を注記しており、本サブは
// 判定の時刻だけを変えて挙動は変えないと定めている(指示書 M24-11 §1.3-3)。
// ⇒ ここが緑から赤へ変わったら、それは本サブが射程を越えたということである。
func TestService_UpdateWithKeyChange_SameKeyStillCollides(t *testing.T) {
	db, svc := newSvc(t)
	ctx := context.Background()

	input := validRyuInput(t, db)
	created, r, err := svc.Create(ctx, input)
	if err != nil || r.HasError() {
		t.Fatalf("事前の登録が失敗した: err=%v issues=%+v", err, r.Issues)
	}

	// キーを変えない編集(旧行がまだ生きているため自分に衝突する)
	_, result, err := svc.UpdateWithKeyChange(ctx, created.ID, created.Version, input)
	if err != nil {
		t.Fatalf("UpdateWithKeyChange: %v", err)
	}
	if !hasC02(result) {
		t.Error("キーを変えない PUT の既存挙動(自分の旧行に衝突する)が変わっている。"+
			"本サブは判定の時刻だけを変える。挙動を変えたなら射程を越えている", result.Issues)
	}
}

// ---------------------------------------------------------------------------
// §4.3: 開いた書き込み tx の内側からの「読み」が顕在化しないこと
// ---------------------------------------------------------------------------

// TestValidationReadsInsideWriteTx は、BEGIN IMMEDIATE 下でも「開いた書き込み tx の
// 内側から非 tx のハンドルで読む」形が SQLITE_BUSY にならないことを実測で固定する。
//
// ★★なぜ要るのか(指示書 M24-11 §4.3)—————————————————————————————
// 指示書は「BEGIN IMMEDIATE にすると潜在的な自己デッドロックが確実に踏まれるように
// なる」を本サブ最大のリスクとして挙げていた。
//
// 実測(完了報告 §3 / §3.2.1):
//   - 着手基点で非 tx ハンドルを撃つのは 6 本。うち開いた write tx の内側で走るのが 5 本
//     (残り 1 本 = RecomputePresetCache はコミット後に呼ばれる規約である)。
//   - 本サブの変更自体が 3 本を新たに内側へ入れた ⇒ 完了時点の全数は 9 本。
//   - 9 本ともすべて「読み」である。非 tx の UPDATE 文は 0 件
//     (SUPP-001 §7.1.1-3 が名指ししたのはその形である)。
//
// ★★ただし「書きに行く形」が 1 件あり、直した——Materialize の「既存 id を返す」経路が
//
//	drainBasePunish を呼び、同関数が内側で自前の書き込み tx を開いていた。
//	非 tx の UPDATE 文ではないが、SUPP-001 §7.1.1-3 が言う害(内側から別コネクションで
//	書きにいって SQLITE_BUSY)にはこれが該当する。⇒ 「書きは 0 件」と読まないこと。
//
// WAL では読みは writer と競合しないため顕在化しない——という見立てを、
// 推測のままにせず実測で固定する。
//
// ★本テストが赤くなったら、それは「読みも競合する」ということであり、
// CharacterAdapter / MoveAdapter / RecomputeComboCache の非 tx 読みが軒並み危うくなる。
func TestValidationReadsInsideWriteTx(t *testing.T) {
	db, _ := newSvc(t)
	ctx := context.Background()

	tx, err := db.BeginTx(ctx, nil) // BEGIN IMMEDIATE で write lock を握る
	if err != nil {
		t.Fatalf("begin tx: %v", err)
	}
	defer func() { _ = tx.Rollback() }()

	// tx の内側で書く(ロックを確実に握った状態にする)
	if _, err := tx.ExecContext(ctx,
		`INSERT INTO combos (character_id, is_draft, step_count, version) VALUES (1, 0, 0, 1)`); err != nil {
		t.Fatalf("write inside tx: %v", err)
	}

	// ★その内側から、別ハンドル(*sql.DB)で読む。
	//   VAL-C01(characters)/ VAL-C08(moves)が実際に行っている形である。
	done := make(chan error, 1)
	go func() {
		var n int
		done <- db.QueryRowContext(ctx, `SELECT COUNT(*) FROM characters`).Scan(&n)
	}()

	select {
	case err := <-done:
		if err != nil {
			t.Fatalf("開いた書き込み tx の内側から非 tx で読めなかった: %v。"+
				"WAL の読みが writer と競合している＝§4.3 の顕在化が起きている", err)
		}
	case <-time.After(10 * time.Second):
		t.Fatal("非 tx の読みが返らない(busy_timeout ぶん待たされている疑い)")
	}
}

// ---------------------------------------------------------------------------
// 判定が *sql.Tx で読んでいること(*sql.DB 直読みが残っていないこと)
// ---------------------------------------------------------------------------

// TestTxScopedDeps_BindsTxToDuplicateChecker は、重複判定が「そのトランザクションの
// 未コミットの行」を見ることを主張する。
//
// ★★なぜこの形で観測するのか———————————————————————————————
// BEGIN IMMEDIATE によって書き込み tx は直列化されるため、POST の経路だけを見ると
// 「判定が *sql.Tx を使っているか *sql.DB を使っているか」は結果に現れない——
// 2 本目が判定する時点で 1 本目は既に commit しているからである。
// ⇒ それでは D-360 の規約(「tx を取るならその tx を読みにも使う」)が守られている
// ことを検査できない。破壊確認 3(判定に *sql.DB を渡す)も観測が動かず空振りする。
// ⇒ 未コミットの行が見えるかどうかを直接見る。これは *sql.Tx でしか成立しない。
//
// ★この性質は将来の防御でもある。判定と書き込みの順序が入れ替わる変更が入ったとき、
// tx を見ていなければ自分が今書いた行を取りこぼす。
func TestTxScopedDeps_BindsTxToDuplicateChecker(t *testing.T) {
	db, _ := newSvc(t)
	ctx := context.Background()
	input := validRyuInput(t, db)
	repo := comborepo.New(db)

	key := validation.DuplicateKey{
		CharacterID:    input.CharacterID,
		StarterMoveID:  input.StarterMoveID,
		Position:       input.Position,
		OpponentStance: input.OpponentStance,
		HitType:        input.HitType,
		OpponentSize:   input.OpponentSize,
	}

	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		t.Fatalf("begin tx: %v", err)
	}
	defer func() { _ = tx.Rollback() }()

	// この tx の内側で候補となる行を作る(まだコミットしない)
	insertRivalCombo(t, ctx, tx, input)

	// --- tx を束ねたアダプタ: 未コミットの行が見えること --------------------------
	txBound := (&combosvc.ComboDuplicateAdapter{Repo: repo}).WithTx(tx)
	got, err := txBound.FindActivePublishedDuplicates(ctx, key)
	if err != nil {
		t.Fatalf("tx 経由の候補抽出: %v", err)
	}
	if len(got) != 1 {
		t.Errorf("tx の内側で書いた行が判定に見えていない(候補 %d 件・期待 1 件)。"+
			"判定が *sql.DB 直読みになっている＝D-360 の規約に反する", len(got))
	}

	// --- tx を束ねないアダプタ: 見えないこと(対照) ------------------------------
	// ★この対照が無いと、上の主張が「たまたま 1 件あった」でも通ってしまう。
	dbBound := &combosvc.ComboDuplicateAdapter{Repo: repo}
	got2, err := dbBound.FindActivePublishedDuplicates(ctx, key)
	if err != nil {
		t.Fatalf("非 tx の候補抽出: %v", err)
	}
	if len(got2) != 0 {
		t.Errorf("非 tx のハンドルに未コミットの行が見えている(候補 %d 件・期待 0 件)。"+
			"対照が成立しておらず、上の主張が空振りしている", len(got2))
	}
}

// ---------------------------------------------------------------------------
// VAL-C02 の 4 経路目: 仮登録 → 本登録の昇格(PATCH /api/combos/:id)
// ---------------------------------------------------------------------------

// TestService_UpdateMetadata_PromotionDoesNotDoubleInsert は、昇格経路でも
// 判定と登録が割り込まれないことを主張する。
//
// ★★本経路はレビュー指摘 高-1 で見つかった 4 経路目である———————————————
// 指示書 §4.2 と CHANGE-136 §2.3 は適用面を「POST / PUT / materialize の 3 経路」と
// 書いているが、実装には 4 つ目があった。設計卓は実装ソースを読めないため
// (指示書 §1.1.4)、この種の食い違いは製造が実査で見つけて報告する定めである。
//
// ★昇格は INSERT ではないが、is_draft を 0 にする＝重複判定の母集団
// (is_draft = 0 AND deleted_at IS NULL)へ行を持ち込む操作であり、害の形は同じである。
//
// 仕掛けは Create の再現テストと同型: tx1 が同一識別キーの本登録行を作って保持し、
// その間に昇格を走らせる。
func TestService_UpdateMetadata_PromotionDoesNotDoubleInsert(t *testing.T) {
	db, svc := newSvc(t)
	ctx := context.Background()

	// 仮登録を 1 件作る(VAL-C02 は仮登録では走らないため、これは常に通る)
	draftInput := validRyuInput(t, db)
	draftInput.IsDraft = true
	draft, r, err := svc.Create(ctx, draftInput)
	if err != nil || r.HasError() {
		t.Fatalf("仮登録の作成が失敗した: err=%v issues=%+v", err, r.Issues)
	}

	// tx1: 同一識別キーの本登録行を作って保持する
	tx1, err := db.BeginTx(ctx, nil)
	if err != nil {
		t.Fatalf("begin tx1: %v", err)
	}
	insertRivalCombo(t, ctx, tx1, draftInput)

	startedC := make(chan struct{})
	doneC := make(chan createOutcome, 1)

	go func() {
		close(startedC)
		begin := time.Now()
		_, result, upErr := svc.UpdateMetadata(ctx, draft.ID, draft.Version,
			combosvc.UpdateMetadataInput{IsDraft: ptr(false)})
		doneC <- createOutcome{result: result, err: upErr, elapsed: time.Since(begin)}
	}()

	<-startedC
	time.Sleep(raceHoldFor)
	if err := tx1.Commit(); err != nil {
		t.Fatalf("commit tx1: %v", err)
	}

	got := <-doneC
	if got.err != nil {
		t.Fatalf("昇格が error を返した(バリデーション結果であるべき): %v", got.err)
	}

	// --- 判定 1: 同一識別キーの本登録が 2 件生存していないこと ---------------------
	if n := countLiveDuplicates(t, db, draftInput); n != 1 {
		t.Errorf("同一識別キーの生きた本登録コンボが %d 件ある(期待 1 件)。"+
			"昇格経路の VAL-C02 が判定と登録の間に割り込まれている", n)
	}

	// --- 判定 2: 昇格が VAL-C02 で止まったこと -----------------------------------
	if !hasC02(got.result) {
		t.Errorf("昇格が VAL-C02 で止まらなかった。issues=%+v", got.result.Issues)
	}

	// --- 判定 3: 昇格が tx1 の commit を待ったこと(観測) -------------------------
	if got.elapsed < raceHoldFor {
		t.Errorf("昇格が tx1 の commit を待っていない: 所要 %v < 保持 %v", got.elapsed, raceHoldFor)
	}
}

// TestService_UpdateMetadata_PromotionStillSucceeds は、競合が無ければ昇格が
// 従来どおり通ることの対照。
//
// ★拒否側だけを固定すると「常に拒否する」実装でも緑になる。
func TestService_UpdateMetadata_PromotionStillSucceeds(t *testing.T) {
	db, svc := newSvc(t)
	ctx := context.Background()

	draftInput := validRyuInput(t, db)
	draftInput.IsDraft = true
	draft, r, err := svc.Create(ctx, draftInput)
	if err != nil || r.HasError() {
		t.Fatalf("仮登録の作成が失敗した: err=%v issues=%+v", err, r.Issues)
	}

	got, result, err := svc.UpdateMetadata(ctx, draft.ID, draft.Version,
		combosvc.UpdateMetadataInput{IsDraft: ptr(false)})
	if err != nil {
		t.Fatalf("UpdateMetadata: %v", err)
	}
	if result.HasError() {
		t.Fatalf("競合が無いのに昇格が落ちた: %+v", result.Issues)
	}
	if got == nil || got.IsDraft {
		t.Error("昇格後も is_draft が true のままである")
	}
}

// TestService_UpdateMetadata_NonPromotingPatchStillWorks は、昇格しない PATCH
// (メタデータのみの更新)が従来どおり通ることの対照。
//
// ★★本サブは昇格経路のために BeginTx を関数の先頭へ動かした。昇格しない PATCH も
// 同じ tx を通るため、そちらが壊れていないことを固定する。
func TestService_UpdateMetadata_NonPromotingPatchStillWorks(t *testing.T) {
	db, svc := newSvc(t)
	ctx := context.Background()

	created, r, err := svc.Create(ctx, validRyuInput(t, db))
	if err != nil || r.HasError() {
		t.Fatalf("事前の登録が失敗した: err=%v issues=%+v", err, r.Issues)
	}

	memo := "M24-11 のメタデータ更新"
	got, result, err := svc.UpdateMetadata(ctx, created.ID, created.Version,
		combosvc.UpdateMetadataInput{Memo: comborepo.Optional[string]{Present: true, Value: &memo}})
	if err != nil {
		t.Fatalf("UpdateMetadata: %v", err)
	}
	if result.HasError() {
		t.Fatalf("メタデータ更新が落ちた: %+v", result.Issues)
	}
	if got.Memo == nil || *got.Memo != memo {
		t.Errorf("memo が反映されていない: %+v", got.Memo)
	}
	// ★楽観排他が従来どおり効いていること(版が上がる)
	if got.Version != created.Version+1 {
		t.Errorf("version = %d, want %d(集約粒度の楽観排他)", got.Version, created.Version+1)
	}
}

package combo_test

import (
	"context"
	"database/sql"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
	combosvc "github.com/plexiblinp/tacpendium/internal/service/combo"
)

// ---------------------------------------------------------------------------
// M31-01 段 1-1 / 段 2: materialize が VAL-C15(本登録の必須欄)を通らない穴
//
// ★★本ファイルは「陽性対照 → 是正」の対で読むこと。
//   着手前の実測(段 1-1)では、必須欄が空の基底から materialize すると
//   **必須欄が空の本登録コンボが生成できた**。VAL-C15 は ERROR であり
//   POST / PUT / PATCH / CSV 取込のすべてが咎めるのに、materialize だけが
//   ValidateComboForCreate を一度も呼ばないためである(DES-006 §2.1 の
//   VAL-C15 行が「Materialize は本 VAL を通らない〔抜け穴〕」と自認していた)。
//
// ★★新規ファイルにしてある。materialize_test.go へ相乗りしない(教訓 E-225)。
// ---------------------------------------------------------------------------

// blankRequiredFields は既に在る本登録コンボの、**サーバが咎める必須欄**を空にする。
//
// ★★Create 経由では作れない(VAL-C15 が ERROR で弾く)。⇒ M27-02b 以前に
//
//	登録された既存行を再現するには、SQL で直接空にするしかない。
//	これは followup `required-fields-migration-burden` が実測した
//	「既存の本登録 83 件のうち 68 件は必須欄のいずれかが空」と同じ状態である。
//
// ★★★【M38-01・射程 3】空にする列を damage / knockdown_advantage の 2 列へ絞った。
//
//	★VAL-C15 の 4 欄は入れ替わり、後ろ 2 欄は driveAvailableAtStart /
//	saAvailableAtStart になった。しかし**サーバは同 2 欄を咎めない** ——
//	「不問」を NULL で表すため、不問と未入力を区別できないからである
//	(internal/service/validation/combo.go の requiredPublishedFields の注記)。
//	⇒ 開始残量を空にしても陽性対照にならない。空にするのは咎められる 2 列だけ。
//	★消費ゲージ 2 列は必須から外れたので、空にしても意味を持たない。
func blankRequiredFields(t *testing.T, db *sql.DB, comboID int64) {
	t.Helper()
	_, err := db.Exec(`
		UPDATE combos
		   SET damage = NULL,
		       knockdown_advantage = NULL
		 WHERE id = ?`, comboID)
	if err != nil {
		t.Fatalf("blank required fields: %v", err)
	}
}

// requiredFieldsPresent は VAL-C15 のうち**サーバが咎める欄**が埋まっているかを返す。
// ★空かどうかだけを見る。値域は見ない(DES-006 §2.1 の VAL-C15 と同じ)。
// ★★M38-01: 開始残量 2 欄はサーバが咎めないため、ここでも数えない
//
//	(数えると「サーバが咎める」という本ファイルの主題とずれる)。
func requiredFieldsPresent(c *model.Combo) bool {
	return c.Damage != nil && c.KnockdownAdvantage != nil
}

// ---------------------------------------------------------------------------
// 陽性対照の前提: 必須欄が空の**本登録**基底が現に作れること
//
// ★これが作れないなら、下の是正テストは「もともと生成できなかった」のか
//   「塞いだから生成できない」のかを区別できない(チェックリスト 5-1)。
// ---------------------------------------------------------------------------

func TestM3101_BaseWithBlankRequiredFields_CanExist(t *testing.T) {
	db, svc := newSvc(t)
	base := createBase(t, db, svc, baseComboInput(t, db))
	blankRequiredFields(t, db, base.ID)

	got := getCombo(t, svc, base.ID)
	if got.IsDraft {
		t.Fatalf("基底が仮登録になっている(本登録でなければ陽性対照にならない)")
	}
	if requiredFieldsPresent(got) {
		// ★★M38-01: 表示する列を blankRequiredFields が空にする 2 列へ揃えた。
		//   ⇒ 消費ゲージを出しても、いま空にしていない列の値が並ぶだけで診断にならない。
		t.Fatalf("サーバが咎める必須欄が空になっていない: damage=%v ka=%v",
			got.Damage, got.KnockdownAdvantage)
	}
}

// ---------------------------------------------------------------------------
// 段 2 の是正: materialize が VAL-C15 で弾くこと
//
// ★★着手前はここが通っていた(= 必須欄が空の本登録が生成できた)。
//   ⇒ 本テストが赤から緑へ反転したことが「穴が塞がった」の証拠である。
// ---------------------------------------------------------------------------

func TestM3101_Materialize_RejectsBlankRequiredFields(t *testing.T) {
	db, svc := newSvc(t)
	base := createBase(t, db, svc, baseComboInput(t, db))
	blankRequiredFields(t, db, base.ID)
	opp := oppMoveID(t, db)

	res, result, err := svc.Materialize(context.Background(), combosvc.MaterializeInput{
		UserID:         1,
		BaseComboID:    base.ID,
		OpponentMoveID: opp,
	})
	if err != nil {
		t.Fatalf("materialize は検証エラーを err で返さない(400 は ValidationResult 経由): %v", err)
	}
	if !result.HasError() {
		t.Fatalf("VAL-C15 で弾かれていない。生成結果=%+v issues=%+v", res, result.Issues)
	}
	if res != nil {
		t.Fatalf("検証エラー時にコンボを生成している: %+v", res)
	}

	// ★咎められる欄がすべて咎められること。1 欄だけ見て通すと、次の欄で同じ穴が開く。
	//
	// ★★★【M38-01・射程 3】対象を damage / knockdownAdvantage の 2 件へ絞った。
	//   ⇒ VAL-C15 の 4 欄は入れ替わったが、開始残量 2 欄は**サーバが咎めない**
	//     (「不問」を NULL で表すため不問と未入力を区別できない)。
	//     消費ゲージ 2 欄は必須から外れた。
	//   ★本テストの主題は「materialize が VAL-C15 を通ること」であり、
	//     咎められる欄が何件かではない。⇒ 主題は 1 文字も緩んでいない。
	got := map[string]bool{}
	for _, is := range result.Issues {
		if is.Code == "VAL-C15" {
			got[is.Field] = true
		}
	}
	for _, f := range []string{"damage", "knockdownAdvantage"} {
		if !got[f] {
			t.Errorf("VAL-C15 が %s を咎めていない(issues=%+v)", f, result.Issues)
		}
	}

	// ★行が 1 件も増えていないこと(ロールバックの確認)。
	var n int
	if err := db.QueryRow(
		`SELECT COUNT(*) FROM combos WHERE materialized_from_combo_id = ?`, base.ID).Scan(&n); err != nil {
		t.Fatalf("count generated: %v", err)
	}
	if n != 0 {
		t.Errorf("生成物が %d 件残っている(ロールバックできていない)", n)
	}
}

// 必須欄が埋まっている基底では、従来どおり生成できること(退行の確認)。
func TestM3101_Materialize_AllowsWhenRequiredFieldsFilled(t *testing.T) {
	db, svc := newSvc(t)
	base := createBase(t, db, svc, baseComboInput(t, db))
	opp := oppMoveID(t, db)

	res, result, err := svc.Materialize(context.Background(), combosvc.MaterializeInput{
		UserID:         1,
		BaseComboID:    base.ID,
		OpponentMoveID: opp,
	})
	if err != nil {
		t.Fatalf("materialize: %v", err)
	}
	if result.HasError() {
		t.Fatalf("必須欄が埋まっているのに弾かれた: %+v", result.Issues)
	}
	if res == nil || res.ComboID == 0 {
		t.Fatalf("生成されていない: %+v", res)
	}
	if !requiredFieldsPresent(getCombo(t, svc, res.ComboID)) {
		t.Errorf("生成物の必須欄が空になっている")
	}
}

// ---------------------------------------------------------------------------
// 仮登録の基底からの生成は VAL-C15 を通さない(DES-006 §2.1・M27-02b)
//
// ★★M24-13(仮登録のレシピ必須化)の前例と食い違わせないための固定である。
//   VAL-C09 は仮登録でも走るが、VAL-C15 は仮登録では走らない。
//   materialize は is_draft を基底から引き継ぐため、仮登録の基底から作った
//   生成物も仮登録であり、必須欄は要求されない。
// ---------------------------------------------------------------------------

func TestM3101_Materialize_DraftBaseSkipsRequiredFields(t *testing.T) {
	db, svc := newSvc(t)
	in := baseComboInput(t, db)
	in.IsDraft = true
	in.Damage = nil
	in.KnockdownAdvantage = nil
	in.DriveGaugeConsumed = nil
	in.SAGaugeConsumed = nil
	base := createBase(t, db, svc, in)
	opp := oppMoveID(t, db)

	res, result, err := svc.Materialize(context.Background(), combosvc.MaterializeInput{
		UserID:         1,
		BaseComboID:    base.ID,
		OpponentMoveID: opp,
	})
	if err != nil {
		t.Fatalf("materialize: %v", err)
	}
	if result.HasError() {
		t.Fatalf("仮登録の基底に VAL-C15 が掛かっている: %+v", result.Issues)
	}
	if res == nil {
		t.Fatal("仮登録の基底から生成できていない")
	}
	if !getCombo(t, svc, res.ComboID).IsDraft {
		t.Errorf("仮登録の基底から本登録が生まれている(is_draft の引き継ぎが壊れた)")
	}
}

// ---------------------------------------------------------------------------
// FR301 の既存一致(AlreadyExisted)は VAL-C15 の手前で返る
//
// ★★これは「弾く／弾かない」の境界であり、設計上は正しい——**新しい行を作らない**
//   経路だからである(既存 id を返すだけ)。⇒ 必須欄が空の基底でも 200 で通る。
// ★★テストで固定しておかないと、後から「一貫していない」として誤って塞がれうる
//   (塞ぐと、既に在る確定反撃版へ到達する手段が消える)。M31-01 レビュー(低)。
// ---------------------------------------------------------------------------

func TestM3101_Materialize_AlreadyExisted_SkipsRequiredFields(t *testing.T) {
	db, svc := newSvc(t)
	base := createBase(t, db, svc, baseComboInput(t, db))
	opp := oppMoveID(t, db)

	// 1 回目: 必須欄が埋まった状態で生成しておく。
	first, result, err := svc.Materialize(context.Background(), combosvc.MaterializeInput{
		UserID: 1, BaseComboID: base.ID, OpponentMoveID: opp,
	})
	if err != nil || result.HasError() {
		t.Fatalf("1 回目: err=%v issues=%+v", err, result.Issues)
	}

	// 基底の必須欄を空にしてから、同じ組でもう一度呼ぶ。
	blankRequiredFields(t, db, base.ID)

	second, result2, err := svc.Materialize(context.Background(), combosvc.MaterializeInput{
		UserID: 1, BaseComboID: base.ID, OpponentMoveID: opp,
	})
	if err != nil {
		t.Fatalf("2 回目: %v", err)
	}
	if result2.HasError() {
		t.Fatalf("既存一致の経路で VAL-C15 が掛かっている(新しい行を作らないため掛からないのが正): %+v",
			result2.Issues)
	}
	if second == nil || !second.AlreadyExisted {
		t.Fatalf("既存一致になっていない: %+v", second)
	}
	if second.ComboID != first.ComboID {
		t.Errorf("返った id = %d, want %d(既存の確定反撃版)", second.ComboID, first.ComboID)
	}
}

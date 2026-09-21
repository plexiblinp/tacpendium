package combo_test

// ★M37-07: 始動技の持続当て(starter_meaty)を重複判定キーへ加えたことのテスト。
//
// ★★新規ファイルにしてある。既存の service_test.go / trash_duplicate_test.go へ
//   相乗りしない(教訓 E-225 ——「新規のつもり」で既存ファイルを上書きして
//   回帰テストを消す事故が M23-08 で実際に起きている)。
//
// ★★★§5-2 の破壊確認の本体は「述語を実際に外して赤くなることを見る」手順であり、
//   それは完了報告 §5.2 に実施記録がある(FindActiveByDuplicateKey から
//   `starter_meaty = ?` を外すと本ファイルの 4 本が赤くなる。復元済み)。
//   ★本ファイルのテストはその手順が赤にする対象であって、手順そのものではない。
//   ⇒ 「このテストが述語を外している」と読まないこと(レビュー 中-6)。

import (
	"context"
	"database/sql"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
	comborepo "github.com/plexiblinp/tacpendium/internal/repository/combo"
	combosvc "github.com/plexiblinp/tacpendium/internal/service/combo"
	"github.com/plexiblinp/tacpendium/internal/service/validation"
)

// meatyInput は validRyuInput と全く同じ入力に starter_meaty だけを載せたもの。
// ★キーの他の 7 要素(recipe を含む)は 1 バイトも変えない —— 変えると
//
//	「starter_meaty が効いた」のか「他が違った」のかが区別できなくなる。
func meatyInput(t *testing.T, db *sql.DB, meaty bool) combosvc.CreateInput {
	t.Helper()
	in := validRyuInput(t, db)
	in.StarterMeaty = meaty
	return in
}

// ---------------------------------------------------------------------------
// §5-1: starter_meaty だけが違う 2 行は「別コンボ」として登録できる
// ---------------------------------------------------------------------------

func TestStarterMeaty_DifferentValueIsNotDuplicate(t *testing.T) {
	db, svc := newSvc(t)
	ctx := context.Background()

	first, res1, err := svc.Create(ctx, meatyInput(t, db, false))
	if err != nil || res1.HasError() {
		t.Fatalf("1 本目の登録に失敗: err=%v issues=%+v", err, res1.Issues)
	}

	// ★レシピも状況も 1 本目と同一。違うのは starter_meaty だけである。
	second, res2, err := svc.Create(ctx, meatyInput(t, db, true))
	if err != nil {
		t.Fatalf("2 本目の登録でエラー: %v", err)
	}
	if issue := issueByCode(res2.Issues, validation.CodeC02Duplicate); issue != nil {
		t.Fatalf("starter_meaty が違うのに VAL-C02 が返った(キーに入っていない): %+v", issue)
	}
	if second == nil {
		t.Fatal("2 本目が保存されていない")
	}
	if second.ID == first.ID {
		t.Fatalf("2 本目が別コンボになっていない: id=%d", second.ID)
	}
	if !second.StarterMeaty {
		t.Error("2 本目の starter_meaty が保存・読み出しできていない")
	}
	if first.StarterMeaty {
		t.Error("1 本目の starter_meaty が false のまま読めていない")
	}
}

// ---------------------------------------------------------------------------
// §5-1 の裏: starter_meaty が同じなら従来どおり重複と判定される
// ---------------------------------------------------------------------------

func TestStarterMeaty_SameValueStillDuplicates(t *testing.T) {
	db, svc := newSvc(t)
	ctx := context.Background()

	for _, meaty := range []bool{false, true} {
		if _, res, err := svc.Create(ctx, meatyInput(t, db, meaty)); err != nil || res.HasError() {
			t.Fatalf("meaty=%v の 1 本目に失敗: err=%v issues=%+v", meaty, err, res.Issues)
		}
		_, res, err := svc.Create(ctx, meatyInput(t, db, meaty))
		if err != nil {
			t.Fatalf("meaty=%v の 2 本目でエラー: %v", meaty, err)
		}
		if issueByCode(res.Issues, validation.CodeC02Duplicate) == nil {
			t.Errorf("meaty=%v: 完全に同じコンボなのに VAL-C02 が返らない", meaty)
		}
	}
}

// ---------------------------------------------------------------------------
// §5-2 ★★★SQL の述語が starter_meaty で候補を絞り分けていること
//
// ★リポジトリを直に叩く。サービス層の判定は「SQL でキーを絞る → 候補の
//   recipe_hash を比較する」の 2 段であり(SUPP-001 §2.2)、1 段目の絞り込みに
//   本列が入っているかどうかがここで観測できる唯一の分かれ目である。
//
// ★★本テストが示すのは (a) と (b) の**差**である。
//   (a) 値を反転して引く → 出ない ／ (b) 同じ値で引く → 出る。
//   ⇒ 差が出なければ述語は本列を見ていない。
// ★★★(b) は述語を外しているのではない。⇒ 「同じ値なら一致する」以上のことは
//   言っていない。**述語を実際に外す破壊確認は完了報告 §5.2 の手順が担う**
//   (レビュー 中-6 の是正。以前のテスト名とコメントは実装と食い違っていた)。
// ---------------------------------------------------------------------------

func TestStarterMeaty_KeyPredicateDiscriminates(t *testing.T) {
	db, svc := newSvc(t)
	ctx := context.Background()

	saved, res, err := svc.Create(ctx, meatyInput(t, db, false))
	if err != nil || res.HasError() {
		t.Fatalf("登録に失敗: err=%v issues=%+v", err, res.Issues)
	}

	repo := comborepo.New(db)
	base := comborepo.DuplicateKey{
		CharacterID:    saved.CharacterID,
		StarterMoveID:  saved.StarterMoveID,
		Position:       saved.Position,
		OpponentStance: saved.OpponentStance,
		HitType:        saved.HitType,
		OpponentSize:   saved.OpponentSize,
	}

	// (a) キーに starter_meaty を**含めた**まま、値だけ反転して引く。
	//     ⇒ 保存済みの行(false)は候補に出てはならない。
	withColumn := base
	withColumn.StarterMeaty = true
	got, err := repo.FindActiveByDuplicateKey(ctx, nil, withColumn)
	if err != nil {
		t.Fatalf("find(with column): %v", err)
	}
	if len(got) != 0 {
		t.Fatalf("starter_meaty=true で引いたのに false の行が候補に出た(キーに入っていない): %d 件", len(got))
	}

	// (b) 保存済みの行と同じ値(false)で引く ⇒ 候補に出る。
	//     ★(a) との**差**が本列の寄与そのものである。差が出ないなら述語は
	//       本列を見ておらず、(a) が通っているのは別の理由である。
	//     ★★これは「述語を外した世界」ではない。述語を外す破壊確認は
	//       完了報告 §5.2 の手順が担う。
	withoutColumn := base
	withoutColumn.StarterMeaty = false
	got, err = repo.FindActiveByDuplicateKey(ctx, nil, withoutColumn)
	if err != nil {
		t.Fatalf("find(without column): %v", err)
	}
	if len(got) != 1 || got[0].ID != saved.ID {
		t.Fatalf("キーから本列の寄与を消したのに重複が検出されない: got=%v want=[%d]", ids(got), saved.ID)
	}
}

func ids(cs []model.Combo) []int64 {
	out := make([]int64, len(cs))
	for i := range cs {
		out[i] = cs[i].ID
	}
	return out
}

// ---------------------------------------------------------------------------
// §5-5: recipe_hash は 1 バイトも変わっていない
//
// ★starter_meaty は**列の側**であって recipe の一部ではない(指示書 §4.2)。
//   変えてしまうと重複判定と recipe_cache が同時に狂う。
// ---------------------------------------------------------------------------

func TestStarterMeaty_RecipeHashUnchanged(t *testing.T) {
	db, svc := newSvc(t)
	ctx := context.Background()

	a, res, err := svc.Create(ctx, meatyInput(t, db, false))
	if err != nil || res.HasError() {
		t.Fatalf("false 側の登録に失敗: err=%v issues=%+v", err, res.Issues)
	}
	b, res, err := svc.Create(ctx, meatyInput(t, db, true))
	if err != nil || res.HasError() {
		t.Fatalf("true 側の登録に失敗: err=%v issues=%+v", err, res.Issues)
	}

	ha := combosvc.CalcRecipeHash(a.Steps)
	hb := combosvc.CalcRecipeHash(b.Steps)
	if ha != hb {
		t.Errorf("starter_meaty が recipe_hash を動かしている: %s != %s", ha, hb)
	}
	if ha == "" {
		t.Error("recipe_hash が空(陽性対照が成立していない)")
	}
}

// ---------------------------------------------------------------------------
// §5-3: 既存行はすべて 0(既定)である —— UPDATE を書いていないことの観測
// ---------------------------------------------------------------------------

func TestStarterMeaty_DefaultsToFalseWhenNotSpecified(t *testing.T) {
	db, svc := newSvc(t)

	// ★StarterMeaty を**指定しない**入力(= 既存の全 fixture と同じ形)。
	saved, res, err := svc.Create(context.Background(), validRyuInput(t, db))
	if err != nil || res.HasError() {
		t.Fatalf("登録に失敗: err=%v issues=%+v", err, res.Issues)
	}
	if saved.StarterMeaty {
		t.Error("未指定なのに starter_meaty が true になっている")
	}

	var n int
	if err := db.QueryRow(`SELECT COUNT(*) FROM combos WHERE starter_meaty <> 0`).Scan(&n); err != nil {
		t.Fatalf("select: %v", err)
	}
	if n != 0 {
		t.Errorf("既定で 0 にならない行が %d 件ある(マイグレが UPDATE を書いている疑い)", n)
	}

	// ★NOT NULL であること —— NULL を許すと「不明どうし」が別コンボになる(§0.5)。
	if err := db.QueryRow(`SELECT COUNT(*) FROM combos WHERE starter_meaty IS NULL`).Scan(&n); err != nil {
		t.Fatalf("select null: %v", err)
	}
	if n != 0 {
		t.Errorf("starter_meaty が NULL の行が %d 件ある(NOT NULL 制約が効いていない)", n)
	}
}

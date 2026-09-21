package movecommand_test

import (
	"context"
	"database/sql"
	"testing"

	movecommandrepo "github.com/plexiblinp/tacpendium/internal/repository/movecommand"
	"github.com/plexiblinp/tacpendium/internal/testutil/dbtest"
)

// charID は code からキャラ id を引くテスト小道具。
func charID(t *testing.T, db *sql.DB, code string) int64 {
	t.Helper()
	var id int64
	if err := db.QueryRow(
		`SELECT id FROM characters WHERE code = ? AND game_id IN (SELECT id FROM games WHERE code = 'sf6')`,
		code).Scan(&id); err != nil {
		t.Fatalf("charID(%s): %v", code, err)
	}
	return id
}

func TestListByCharacter_SeededRyu(t *testing.T) {
	db := dbtest.Setup(t)
	repo := movecommandrepo.New(db)

	rows, err := repo.ListByCharacter(context.Background(), charID(t, db, "ryu"))
	if err != nil {
		t.Fatalf("ListByCharacter: %v", err)
	}
	if len(rows) == 0 {
		t.Fatal("ryu の索引が空")
	}

	// 000035 seed の代表エントリ: 波動拳(弱)= '236LP'・special・地上。
	var found bool
	prevID := int64(-1)
	for _, r := range rows {
		if r.MoveID < prevID {
			t.Fatalf("move_id 昇順でない: %d の後に %d", prevID, r.MoveID)
		}
		prevID = r.MoveID
		if r.MoveCode == "hadoken_light" {
			found = true
			if r.TokenKey != "236LP" || r.Category != "special" || r.IsAerial {
				t.Errorf("hadoken_light = %+v; want token '236LP'/special/地上", r)
			}
		}
	}
	if !found {
		t.Error("hadoken_light が索引に無い")
	}
}

func TestListByCharacter_IncludesAerial(t *testing.T) {
	db := dbtest.Setup(t)
	repo := movecommandrepo.New(db)

	// 索引は広く持つ(§1.5-6): 空中特殊技 lily/great_spin も索引には載る(除外は解決表側)。
	rows, err := repo.ListByCharacter(context.Background(), charID(t, db, "lily"))
	if err != nil {
		t.Fatalf("ListByCharacter: %v", err)
	}
	for _, r := range rows {
		if r.MoveCode == "great_spin" {
			if r.TokenKey != "2HP" || !r.IsAerial {
				t.Errorf("great_spin = %+v; want token '2HP'/is_aerial=true", r)
			}
			return
		}
	}
	t.Error("lily/great_spin が索引に無い(索引は広く持つ違反)")
}

func TestListByCharacter_UnseededIsEmpty(t *testing.T) {
	db := dbtest.Setup(t)
	repo := movecommandrepo.New(db)

	// 索引を持たないキャラ(存在しない id は索引 0 行=同一経路)は空を返し壊れない。
	// ★実在キャラへは依存しない。★M14-03f(第四波 seed)で 31 キャラすべてが索引を持つように
	//   なったため、「索引を持たない実在キャラ」はもう存在しない(旧注記は c_viper を
	//   その例として挙げていた)。⇒ 存在しない id で経路を突く形が唯一の書き方である。
	rows, err := repo.ListByCharacter(context.Background(), 999999)
	if err != nil {
		t.Fatalf("ListByCharacter(999999): %v", err)
	}
	if len(rows) != 0 {
		t.Errorf("ListByCharacter(999999) = %d 行; want 0(壊れない)", len(rows))
	}
}

// TestLoadIndex_RuntimeConsumption は M14-03b IF(moveindex)を本体ランタイム(DB)から
// 再構築して消費できること(M17-02 §2.3 の主眼・M17-04 の土台)を検証する。
func TestLoadIndex_RuntimeConsumption(t *testing.T) {
	db := dbtest.Setup(t)
	repo := movecommandrepo.New(db)

	ix, err := repo.LoadIndex(context.Background())
	if err != nil {
		t.Fatalf("LoadIndex: %v", err)
	}

	// 正準トークン列でも numpad 形でも同じキーへ畳まれて引ける(M17-04 の表記解決想定)。
	for _, query := range []string{"d dr r plus p_l", "236LP"} {
		if got, ok := ix.Lookup("ryu", query); !ok || got != "hadoken_light" {
			t.Errorf("Lookup(ryu, %q) = %q, %v; want hadoken_light, true", query, got, ok)
		}
	}
	// キャラ別スコープ: 索引に無いキャラキーは未解決。
	if got, ok := ix.Lookup("no_such_char", "236LP"); ok {
		t.Errorf("Lookup(no_such_char) = %q; want 未解決", got)
	}
	// 索引キャラ数 = M17-02 の 10 + M14-03d の manon + M14-03e の 6 + M14-03f の 14 = 31。
	// ★M14-03f(第四波)で全 31 キャラが index を持つようになった。c_viper / dhalsim は
	//   それまで command を 1 つも持たず索引に載っていなかった(仮登録・移動 9 種のみ)。
	if got := len(ix.CharKeys()); got != 31 {
		t.Errorf("CharKeys = %d, want 31", got)
	}
}

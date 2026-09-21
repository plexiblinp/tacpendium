package preset_test

import (
	"context"
	"testing"

	presetrepo "github.com/plexiblinp/tacpendium/internal/repository/preset"
	"github.com/plexiblinp/tacpendium/internal/testutil/dbtest"
)

// ListAliasEntriesByCharacter は M20-07 逆引きの辞書取得(全プリセット横断・キャラスコープ)。
// M17-04 の FindMoveCodesByAlias を置き換えたもの(照合そのものは internal/aliasindex が持つ)。

func TestRepository_ListAliasEntriesByCharacter_ReturnsSeededAliases(t *testing.T) {
	db := dbtest.Setup(t)
	repo := presetrepo.New(db)

	entries, err := repo.ListAliasEntriesByCharacter(context.Background(), "ryu")
	if err != nil {
		t.Fatalf("ListAliasEntriesByCharacter: %v", err)
	}
	if len(entries) == 0 {
		t.Fatal("seed 済みキャラで 0 件が返った")
	}

	// official_ja_move の「立ち弱P」= standing_light_punch(既知データ)。
	var found bool
	for _, e := range entries {
		if e.AliasText == "立ち弱P" && e.MoveCode == "standing_light_punch" {
			found = true
		}
	}
	if !found {
		t.Errorf("既知の別名 立ち弱P → standing_light_punch が辞書に無い(%d 件を走査)", len(entries))
	}
}

// ★全プリセット横断であることを主張する。プリセットで絞ると、カスタムプリセットを
// 逆引き辞書に使うという仕様(DES-003 §3.9・G-11)が成立しなくなる。
func TestRepository_ListAliasEntriesByCharacter_SpansAllPresets(t *testing.T) {
	db := dbtest.Setup(t)
	repo := presetrepo.New(db)

	entries, err := repo.ListAliasEntriesByCharacter(context.Background(), "ryu")
	if err != nil {
		t.Fatalf("ListAliasEntriesByCharacter: %v", err)
	}

	// 同じ move へ複数プリセットが別表記を割り当てているはず
	// (official_ja_move の日本語技名 と numeric / srk の記法)。
	byMove := map[string]map[string]struct{}{}
	for _, e := range entries {
		if byMove[e.MoveCode] == nil {
			byMove[e.MoveCode] = map[string]struct{}{}
		}
		byMove[e.MoveCode][e.AliasText] = struct{}{}
	}
	var multi int
	for _, texts := range byMove {
		if len(texts) > 1 {
			multi++
		}
	}
	if multi == 0 {
		t.Error("1 つの move に複数プリセットの表記が付いていない(横断で引けていない可能性)")
	}
}

// ★alias_text_en を含めて返すこと(D-317 の両引きの材料)。
// 非 NULL なのは「記法自身が語を持たない行」だけである(DES-003 §3.9)。
func TestRepository_ListAliasEntriesByCharacter_IncludesAliasTextEn(t *testing.T) {
	db := dbtest.Setup(t)
	repo := presetrepo.New(db)

	entries, err := repo.ListAliasEntriesByCharacter(context.Background(), "ryu")
	if err != nil {
		t.Fatalf("ListAliasEntriesByCharacter: %v", err)
	}

	var withEn int
	for _, e := range entries {
		if e.AliasTextEn != nil && *e.AliasTextEn != "" {
			withEn++
		}
	}
	if withEn == 0 {
		t.Errorf("alias_text_en を持つ行が 1 件も返らなかった(%d 件を走査)", len(entries))
	}
}

// 実在しないキャラ・キャラ未指定は空(壊れない)。
func TestRepository_ListAliasEntriesByCharacter_UnknownCharacterIsEmpty(t *testing.T) {
	db := dbtest.Setup(t)
	repo := presetrepo.New(db)

	for _, code := range []string{"no_such_character", ""} {
		entries, err := repo.ListAliasEntriesByCharacter(context.Background(), code)
		if err != nil {
			t.Fatalf("ListAliasEntriesByCharacter(%q): %v", code, err)
		}
		if len(entries) != 0 {
			t.Errorf("%q で %d 件が返った(0 件のはず)", code, len(entries))
		}
	}
}

// ★技データ(CSV 由来の攻撃技)を持たないキャラでも、移動系のエイリアスは入っている。
//
// ★★以前は c_viper を実データのまま使っていた。第四波 seed(M14-03f・2026-09-02)で
// 31 キャラすべてが本 seed 済みになり、配布 DB から「攻撃技を持たないキャラ」が
// 消えたためである(c_viper / dhalsim は 000014 から第四波まで、移動 9 種だけを持つ
// 仮登録だった)。
// ⇒ 前提が消えたのでテストを消す、ではない。守っている不変条件——「技が未投入だから
//
//	逆引き辞書も空」ではない——は今も要る。ゲーム側のアップデートで新キャラが増えると、
//	characters 行と移動系エイリアスだけが先に入る期間が必ずできる。
//
// ⇒ 対象を実データに頼るのをやめ、テスト側で同じ形を作る。
func TestRepository_ListAliasEntriesByCharacter_MovesetlessCharacterStillHasMovementAliases(t *testing.T) {
	db := dbtest.Setup(t)
	repo := presetrepo.New(db)

	// 仮登録キャラを 1 体作る: characters 行 + 移動系 2 code + その official_ja_move alias。
	// (攻撃技と、その別名は作らない。)
	if _, err := db.Exec(`INSERT INTO characters (game_id, code, name_ja, name_en)
		SELECT g.id, 'test_movesetless', 'テスト仮登録', 'Test Provisional'
		FROM games g WHERE g.code = 'sf6'`); err != nil {
		t.Fatalf("insert character: %v", err)
	}
	if _, err := db.Exec(`INSERT INTO moves (character_id, code, category)
		SELECT c.id, v.code, 'system' FROM characters c
		CROSS JOIN (SELECT 'dash_forward' AS code UNION ALL SELECT 'jump_neutral') AS v
		WHERE c.code = 'test_movesetless'`); err != nil {
		t.Fatalf("insert movement moves: %v", err)
	}
	if _, err := db.Exec(`INSERT INTO preset_aliases (preset_id, move_id, character_id, alias_text)
		SELECT (SELECT id FROM presets WHERE code = 'official_ja_move'), m.id, m.character_id, v.alias_text
		FROM moves m JOIN characters c ON c.id = m.character_id
		CROSS JOIN (SELECT 'dash_forward' AS code, '前方ステップ' AS alias_text
		            UNION ALL SELECT 'jump_neutral', '垂直ジャンプ') AS v
		WHERE c.code = 'test_movesetless' AND m.code = v.code`); err != nil {
		t.Fatalf("insert movement aliases: %v", err)
	}

	entries, err := repo.ListAliasEntriesByCharacter(context.Background(), "test_movesetless")
	if err != nil {
		t.Fatalf("ListAliasEntriesByCharacter: %v", err)
	}
	if len(entries) == 0 {
		t.Fatal("移動系エイリアスが 1 件も返らなかった")
	}
	for _, e := range entries {
		if e.AliasText == "立ち弱P" {
			t.Errorf("技データを持たないキャラに通常技の別名があった: %+v", e)
		}
	}
}

// TestRepository_ListAliasEntriesByCharacter_FormerlyProvisionalCharacterNowHasMoveAliases は
// 第四波 seed の結果を固定する。★上のテストと対である。
//
// c_viper は第四波(M14-03f)で攻撃技を持つようになった。⇒ 移動系だけでなく通常技の
// エイリアスも返る。★仮登録のまま取り残されていたら、ここが赤くなる。
func TestRepository_ListAliasEntriesByCharacter_FormerlyProvisionalCharacterNowHasMoveAliases(t *testing.T) {
	db := dbtest.Setup(t)
	repo := presetrepo.New(db)

	for _, code := range []string{"c_viper", "dhalsim"} {
		entries, err := repo.ListAliasEntriesByCharacter(context.Background(), code)
		if err != nil {
			t.Fatalf("ListAliasEntriesByCharacter(%s): %v", code, err)
		}
		var hasMovement, hasNormal bool
		for _, e := range entries {
			switch e.AliasText {
			case "前方ステップ": // ★000080(M24-08)で「前ダッシュ」から是正された表示語
				hasMovement = true
			case "立ち弱P":
				hasNormal = true
			}
		}
		if !hasMovement {
			t.Errorf("%s: 移動系エイリアスが無い", code)
		}
		if !hasNormal {
			t.Errorf("%s: 通常技のエイリアスが無い(第四波 seed が当たっていない)", code)
		}
	}
}

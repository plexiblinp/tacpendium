package migration_test

import (
	"testing"

	_ "modernc.org/sqlite"
)

// TestRun_M1403b_SeedIntegrity は seed 契約 (a) の充足を検証する:
// 全キャラに移動 9 種が投入され、official_ja_move alias が対で付き、生 code フォールバックが無い。
//
// ★★M33-03 で「12 キャラ時点の実測値」を構造の主張へ置き換えた。⇒ 着手時点は
// characters = 12 / 9 移動を持つキャラ = 12 / custom_states 定義キャラ = 8 …と
// *その波の母数*を写していたため、後続の seed 波(現在 31 キャラ)で全部落ちた。
// ★主張の芯は「全キャラが 9 移動を持つ」であって「12 キャラである」ではない。
// ⇒ 母数そのものと突き合わせる形にすると、波が進んでも緑のままで、しかも主張は強くなる
// (12 を写す形は 13 キャラ目が 9 移動を持たなくても緑になりうる)。
func TestRun_M1403b_SeedIntegrity(t *testing.T) {
	m, db := newMigrator(t)
	defer db.Close()
	if err := m.Up(); err != nil {
		t.Fatalf("up to HEAD: %v", err)
	}

	chars := scanInt(t, db, "SELECT count(*) FROM characters")
	if chars == 0 {
		t.Fatalf("characters が 0 行(母集団が壊れている)")
	}
	// (a) ★全キャラが移動 9 種を持つ。⇒ 件数ではなく「母数と一致すること」で見る。
	if got := scanInt(t, db, `SELECT count(*) FROM (SELECT character_id FROM moves
		WHERE category='system' AND code IN ('forward','back','micro_forward','micro_back',
		'dash_forward','dash_back','jump_neutral','jump_forward','jump_back')
		GROUP BY character_id HAVING count(*)=9)`); got != chars {
		t.Errorf("全 9 移動 move を持つキャラ = %d, want %d(= characters 全数)", got, chars)
	}
	// ryu に forward/back が additive で追加されている(元の 56 → 58)。
	if got := scanInt(t, db, `SELECT count(*) FROM moves m JOIN characters c ON c.id=m.character_id
		WHERE c.code='ryu' AND m.code IN ('forward','back')`); got != 2 {
		t.Errorf("ryu forward/back = %d, want 2", got)
	}
	// (a) alias 欠落ゼロ(全 move に official_ja_move alias が対で付く = 生 code フォールバック無し)。
	if got := scanInt(t, db, `SELECT count(*) FROM moves m WHERE NOT EXISTS
		(SELECT 1 FROM preset_aliases pa JOIN presets p ON p.id=pa.preset_id AND p.code='official_ja_move'
		 WHERE pa.move_id=m.id)`); got != 0 {
		t.Errorf("official_ja_move alias 欠落 move = %d, want 0 (生 code フォールバック)", got)
	}
	// ★custom_states を持つキャラが 1 人以上居ること(母集団の生存確認)。
	//   ⇒ 件数は seed 波ごとに増えるので固定しない(着手時点は 8 / 現在 17)。
	if got := scanInt(t, db, "SELECT count(*) FROM characters WHERE custom_states IS NOT NULL"); got == 0 {
		t.Errorf("custom_states 定義キャラ = 0(母集団が壊れている)")
	}
	// ★show_delta は int(stock) 系にだけ付く。flag には付与しない。
	//   ⇒ 件数ではなく「flag に付いている行が 0」で見る(これが本来の主張である)。
	if got := scanInt(t, db, `SELECT count(*) FROM characters c, json_each(json_extract(c.custom_states,'$.states')) j
		WHERE json_extract(j.value,'$.show_delta')=1
		  AND json_extract(j.value,'$.type')='flag'`); got != 0 {
		t.Errorf("flag な state に show_delta=true が付いている行 = %d, want 0", got)
	}
	// ryu denjin_charge に scope:persistent が付与され、flag/code は温存。
	if got := scanInt(t, db, `SELECT count(*) FROM characters WHERE code='ryu'
		AND json_extract(custom_states,'$.states[0].code')='denjin_charge'
		AND json_extract(custom_states,'$.states[0].type')='flag'
		AND json_extract(custom_states,'$.states[0].scope')='persistent'`); got != 1 {
		t.Errorf("ryu denjin_charge の scope 是正が未反映")
	}
	// ★juri は fuha_stock と feng_shui_engine を持つ。⇒ state 数ではなく名指しで見る
	//   (着手時点は 2 state だったが、後続の波で増えた=現在 3。★主張の芯は「この 2 つが在る」)。
	for _, code := range []string{"fuha_stock", "feng_shui_engine"} {
		if got := scanInt(t, db, `SELECT count(*) FROM characters c,
			json_each(json_extract(c.custom_states,'$.states')) j
			WHERE c.code='juri' AND json_extract(j.value,'$.code')=?`, code); got != 1 {
			t.Errorf("juri の custom_state %q = %d 件, want 1", code, got)
		}
	}
}

// TestRun_M1403b_DupRemeasurement は seed 契約 (c) の全域 dup 再測定(0 件)を検証する。
func TestRun_M1403b_DupRemeasurement(t *testing.T) {
	m, db := newMigrator(t)
	defer db.Close()
	if err := m.Up(); err != nil {
		t.Fatalf("up to HEAD: %v", err)
	}
	// 同一キャラ内 move_code 衝突。
	if got := scanInt(t, db, `SELECT count(*) FROM (SELECT character_id, code FROM moves
		GROUP BY character_id, code HAVING count(*)>1)`); got != 0 {
		t.Errorf("同一キャラ move_code 衝突 = %d, want 0", got)
	}
	// (preset_id, move_id) UNIQUE 衝突。
	if got := scanInt(t, db, `SELECT count(*) FROM (SELECT preset_id, move_id FROM preset_aliases
		GROUP BY preset_id, move_id HAVING count(*)>1)`); got != 0 {
		t.Errorf("(preset_id, move_id) 衝突 = %d, want 0", got)
	}
	// 同一キャラ内 alias_text(official_ja_move)衝突。
	if got := scanInt(t, db, `SELECT count(*) FROM (SELECT m.character_id, pa.alias_text
		FROM preset_aliases pa JOIN moves m ON m.id=pa.move_id
		JOIN presets p ON p.id=pa.preset_id AND p.code='official_ja_move'
		GROUP BY m.character_id, pa.alias_text HAVING count(*)>1)`); got != 0 {
		t.Errorf("同一キャラ alias_text 衝突 = %d, want 0", got)
	}
}

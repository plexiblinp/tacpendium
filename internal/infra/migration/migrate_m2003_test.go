package migration_test

import (
	"strings"
	"testing"
)

// M20-03(000074〜000075)の契約テスト。preset_aliases の character_id 非正規化と一意制約 2 本。
//
// ★比較区間は自サブに閉じる(SUPP-001 §5.5.2 (1))。始端 = 本サブの直前の連番 v73、
// 終端 = 本サブの最終連番 v75。m.Up()(HEAD 終端)を使わない——後続サブが正当にマイグレを
// 追加したとき、本サブの契約テストが無関係に落ちるのを避けるためである。
//
// ★HEAD スコープの主張(「現行の配布状態で行数が N」等)は本ファイルに置かない(同 (2))。
// それは migrate_test.go の TestRun_SeedRowCounts が持つ。落ちたときの正しい対応が違う——
// 本ファイルが落ちたら実装が契約を破ったので実装を直す。
const ()

// 本サブが張る索引の名前(マイグレ 000075 と対。名前で落とすため名前を固定する)。
const ()

// TestRun_M2003_ConstraintActuallyBites は ★破壊テストである(SUPP-001 §5.5.4 (10))。
//
//	(i) 同一 (preset_id, character_id, alias_text) で別 move_id の INSERT が失敗すること
//	(j) 同一 (preset_id, character_id, alias_text_en) で別 move_id の INSERT が失敗すること
//	(k) alias_text_en が NULL の行は複数あってよいこと(部分インデックスの主張)
//
// ★制約は「張った」だけでは効いているか分からない。非破壊条件を守るテストは、
// その条件を実際に破って FAIL を確認する必要がある。一意制約はまさにその型である。
func TestRun_M2003_ConstraintActuallyBites(t *testing.T) {
	m, db := newMigrator(t)
	defer db.Close()

	if err := m.Up(); err != nil {
		t.Fatalf("up to HEAD: %v", err)
	}

	presetID := int64(scanInt(t, db, `SELECT id FROM presets WHERE code = 'numeric'`))

	// 同一キャラの別 move を 2 つ取る(実データから引く。ryu 固定にしない)。
	//
	// ★当該プリセットのエイリアスをまだ持たない move を選ぶこと。持っている move を選ぶと
	// 既存の UNIQUE(preset_id, move_id) が先に発火し、「本サブが張った制約が効いた」のか
	// 「既存制約が効いた」のかを区別できない。★破壊テストは、狙った制約が落としたことを
	// 示せて初めて意味を持つ(M20-02 が衝突組を非投入にしているため、該当する move は実在する)。
	var charID, moveA, moveB int64
	err := db.QueryRow(`SELECT m1.character_id, m1.id, m2.id
	    FROM moves m1 JOIN moves m2 ON m2.character_id = m1.character_id AND m2.id > m1.id
	    WHERE NOT EXISTS (SELECT 1 FROM preset_aliases pa WHERE pa.preset_id = ? AND pa.move_id = m1.id)
	      AND NOT EXISTS (SELECT 1 FROM preset_aliases pa WHERE pa.preset_id = ? AND pa.move_id = m2.id)
	    ORDER BY m1.id, m2.id LIMIT 1`, presetID, presetID).Scan(&charID, &moveA, &moveB)
	if err != nil {
		// ★ここが落ちても「制約が効かなくなった」ではない。followup
		//   numeric-aerial-vs-crouching-collision（衝突組 35 キーの投入）や P-34 の残り 14 件が
		//   入ると候補が減るため、将来はエイリアス未投入の move が枯れうる。
		//   ★【2026-08-14 更新 = M20-06】P-34 の 27 件のうち 13 件は投入済みである(D-373)。
		//   そのときは投入先プリセットを変えるか、専用の move を作って測ること。
		t.Fatalf("エイリアス未投入の同一キャラ別 move を 2 件取得できない: %v", err)
	}

	// 破壊テストは行を実際に入れるため、毎回掃除して次のケースへ影響させない。
	cleanup := func() {
		if _, err := db.Exec(`DELETE FROM preset_aliases WHERE alias_text LIKE 'M2003_DESTRUCTIVE%'
		    OR alias_text_en LIKE 'M2003_DESTRUCTIVE%'`); err != nil {
			t.Fatalf("cleanup: %v", err)
		}
	}
	insert := func(moveID int64, text string, textEn any) error {
		_, err := db.Exec(`INSERT INTO preset_aliases (preset_id, move_id, character_id, alias_text, alias_text_en)
		    VALUES (?, ?, ?, ?, ?)`, presetID, moveID, charID, text, textEn)
		return err
	}

	// ── (i) alias_text の衝突 ──────────────────────────────────────────
	t.Run("i_同一preset_char_alias_textで別moveのINSERTが失敗する", func(t *testing.T) {
		defer cleanup()
		if err := insert(moveA, "M2003_DESTRUCTIVE_A", nil); err != nil {
			t.Fatalf("1 行目の INSERT が失敗した(制約が広すぎる): %v", err)
		}
		err := insert(moveB, "M2003_DESTRUCTIVE_A", nil)
		if err == nil {
			t.Fatal("同一 (preset_id, character_id, alias_text) で別 move_id の INSERT が通った。" +
				"UNIQUE(preset_id, character_id, alias_text) が効いていない")
		}
		t.Logf("(i) 期待どおり失敗した: %v", err)
		if !strings.Contains(err.Error(), "UNIQUE") {
			t.Errorf("(i) UNIQUE 制約違反以外の理由で失敗している: %v", err)
		}
	})

	// ── (j) alias_text_en の衝突 ───────────────────────────────────────
	t.Run("j_同一preset_char_alias_text_enで別moveのINSERTが失敗する", func(t *testing.T) {
		defer cleanup()
		// alias_text は別値にして、alias_text_en だけを衝突させる。
		if err := insert(moveA, "M2003_DESTRUCTIVE_B1", "M2003_DESTRUCTIVE_EN"); err != nil {
			t.Fatalf("1 行目の INSERT が失敗した: %v", err)
		}
		err := insert(moveB, "M2003_DESTRUCTIVE_B2", "M2003_DESTRUCTIVE_EN")
		if err == nil {
			t.Fatal("同一 (preset_id, character_id, alias_text_en) で別 move_id の INSERT が通った。" +
				"部分インデックスが効いていない")
		}
		t.Logf("(j) 期待どおり失敗した: %v", err)
		if !strings.Contains(err.Error(), "UNIQUE") {
			t.Errorf("(j) UNIQUE 制約違反以外の理由で失敗している: %v", err)
		}
	})

	// ── (k) alias_text_en が NULL の行は複数あってよい ──────────────────
	t.Run("k_alias_text_enがNULLの行は複数あってよい", func(t *testing.T) {
		defer cleanup()
		if err := insert(moveA, "M2003_DESTRUCTIVE_C1", nil); err != nil {
			t.Fatalf("1 行目の INSERT が失敗した: %v", err)
		}
		// ★alias_text は別値にする。同値なら (i) の制約で正しく落ちるため、
		//   ここで見たい「NULL 同士は衝突しない」の主張にならない。
		if err := insert(moveB, "M2003_DESTRUCTIVE_C2", nil); err != nil {
			t.Fatalf("alias_text_en が NULL の 2 行目が入らない。部分インデックスが NULL を"+
				"衝突扱いしている(NULL は「英語表記を持たない」であって同値ではない): %v", err)
		}
	})
}

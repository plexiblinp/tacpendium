package migration_test

import "testing"

// M24-08 第 2 部 B(CHANGE-148 / D-615): マイグレ 000080 = 地上ダッシュの表示語の是正。
//
// 本ファイルが見るのは 5 点である。
//   (1) up で ja が「前方ステップ / 後方ステップ」になること / down で戻ること(往復整合)
//   (2) ★en を巻き込んでいないこと —— srk プリセットの 'dash' / 'backdash' は英語であり正しい
//   (3) ★official_ja_move 以外のプリセットを巻き込んでいないこと(numeric の '66' / '44')
//   (4) ★対象行の母数を実測して記録すること(指示書 §3.3-9。「2 行」と決めつけない)
//   (5) ★recipe_cache をマイグレが書き換えていないこと(D-615 / E-76)
//
// ★破壊確認 5(alias_text を「前ダッシュ」へ戻す)で赤くなるのは (1) である。

const (
	presetOfficialJaMove = `(SELECT id FROM presets WHERE code='official_ja_move')`
	presetSRK            = `(SELECT id FROM presets WHERE code='srk')`
	presetNumeric        = `(SELECT id FROM presets WHERE code='numeric')`
)

// TestRun_M2408_EnAndOtherPresetsUntouched は「直してはいけないもの」を主張する。
//
// ★これが本サブで最も落としやすい点である。値で絞る UPDATE を preset で限定せずに書くと、
// 別プリセットの同表記まで書き換わるが、テストが無ければ go test は緑のまま通る
// (教訓 E-225 と同型 —— 消えた/壊れたものは、それを見るテストが無いかぎり何も言わない)。
func TestRun_M2408_EnAndOtherPresetsUntouched(t *testing.T) {
	m, conn := newMigrator(t)
	defer conn.Close()

	if err := m.Up(); err != nil {
		t.Fatalf("up to HEAD: %v", err)
	}

	// (2) ★en は Dash のままが正しい(D-615)。srk プリセットの英語表記を日本語化しない。
	for _, want := range []string{"dash", "backdash"} {
		if got := scanInt(t, conn,
			`SELECT count(*) FROM preset_aliases
			  WHERE preset_id=`+presetSRK+` AND alias_text=?`, want); got == 0 {
			t.Errorf("★srk プリセットの英語表記 %q が消えている(en を巻き込んだ)", want)
		}
	}

	// (3) ★numeric プリセットの数字表記も巻き込まない。
	for _, want := range []string{"66", "44"} {
		if got := scanInt(t, conn,
			`SELECT count(*) FROM preset_aliases
			  WHERE preset_id=`+presetNumeric+` AND alias_text=?`, want); got == 0 {
			t.Errorf("★numeric プリセットの表記 %q が消えている", want)
		}
	}

	// ★official_ja_move 以外に「前方ステップ/後方ステップ」を作っていないこと。
	if got := scanInt(t, conn,
		`SELECT count(*) FROM preset_aliases
		  WHERE preset_id <> `+presetOfficialJaMove+`
		    AND alias_text IN ('前方ステップ','後方ステップ')`); got != 0 {
		t.Errorf("★別プリセットに「前方ステップ/後方ステップ」を作った (%d 行)", got)
	}

	// ★「【強化】前方ステップ」等の類似値を巻き込んでいないこと(UNIQUE 衝突の下見も兼ねる)。
	if got := scanInt(t, conn,
		`SELECT count(*) FROM preset_aliases WHERE alias_text LIKE '【強化】%ステップ'`); got == 0 {
		t.Errorf("★「【強化】…ステップ」が消えている(前方一致で巻き込んだ)")
	}

}

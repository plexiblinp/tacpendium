package csvcore

import (
	"strings"
	"testing"
)

// TestCSVColumnNamesAreFrozen は CSV の列名が契約であることを機械で押さえる
// (DES-002 §7.6・M24-07)。
//
// ★★なぜ既存の往復テストでは足りないのか ——
//
//	ExportCSV と ParseAndValidate は**同じ CSVColumns を読む**。列名を書き換えると
//	両側が対称に変わるため、TestRoundTrip 系はすべて緑のまま通る。
//	⇒ 「往復が通る」ことは列名が変わっていないことの証拠にならない。
//
// ★これまで列名の変更を検出できたのは E2E だけだった(web/e2e/support/combo-io.ts が
//
//	22 列を逐語で持つ)。E2E は nightly であり PR チェックに載らない(DES-002 §11.3)。
//	⇒ 契約の観測を、PR で必ず走る側にも置く。
//
// ★列を**足す**のは後方互換の運用として認められている(任意列として列末尾追加)。
//
//	そのときは本テストの期待値も同じ手番で更新すること —— 更新の手間が
//	「列名を気軽に変えない」ための摩擦そのものである。
func TestCSVColumnNamesAreFrozen(t *testing.T) {
	wantCombo := []string{
		"local_id", "character_code", "is_draft", "damage",
		"drive_available_at_start", "sa_available_at_start", "drive_damage",
		"position", "opponent_stance", "hit_type", "opponent_size", "situation",
		"oki_meaty_neutral_tech_throw", "oki_meaty_neutral_tech_throw_dr",
		"oki_meaty_back_tech_throw", "oki_meaty_back_tech_throw_dr",
		"oki_shimmy_neutral_tech", "oki_shimmy_back_tech",
		"knockdown_advantage", "memo", "tags", "recipe",
		"sa_gauge_consumed", "drive_gauge_consumed",
		"oki_shimmy_neutral_tech_dr", "oki_shimmy_back_tech_dr",
		"oki_strike_meaty_neutral_tech", "oki_strike_meaty_neutral_tech_dr",
		"oki_strike_meaty_back_tech", "oki_strike_meaty_back_tech_dr",
		"link", "video_path", "image_path",
		// ★M27-02b: 起き攻めを調べたかのフラグ(任意列・列末尾追加)。
		"oki_verified",
		// ★M28-02a: 始動位置のマス数と運び量(任意列・列末尾追加)。
		//   ★combos.baseline_version は載せていない —— DB 管理列であって
		//     利用者の入力ではない(先例＝materialized_from_combo_id)。
		"start_position_mass", "carry_distance_mass",
		// ★M37-07: 始動技の持続当て(任意列・列末尾追加)。
		//   ★本列は重複判定キーの 8 つ目である ⇒ 載せないと出力 → 取込で
		//     別コンボへ化ける(他の任意列より落とせない理由がある)。
		"starter_meaty",
	}
	if got := strings.Join(CSVColumns, ","); got != strings.Join(wantCombo, ",") {
		t.Errorf("コンボ CSV の列名/列順が変わっている(DES-002 §7.6 の往復契約)\n got=%s\nwant=%s",
			got, strings.Join(wantCombo, ","))
	}

	wantSetup := []string{"parent_combo_local_id", "name", "description", "recipe"}
	if got := strings.Join(SetupCSVColumns, ","); got != strings.Join(wantSetup, ",") {
		t.Errorf("セットプレイ CSV の列名/列順が変わっている\n got=%s\nwant=%s",
			got, strings.Join(wantSetup, ","))
	}

	// ★必須列と任意列の別も契約である(VAL-I04 が必須列の欠損を弾く)。
	// 任意列を必須へ動かすと、旧 CSV の取込が静かに壊れる。
	if len(requiredImportColumns) != 22 {
		t.Errorf("必須列 = %d 件, want 22", len(requiredImportColumns))
	}
	// ★M27-02b: oki_verified を任意列として足したため 11 → 12。
	// ★M28-02a: 始動位置マス数・運び量を任意列として足したため 12 → 14。
	// ★M37-07: starter_meaty を任意列として足したため 14 → 15。
	//   ★必須列 22 は動いていない(旧 CSV の取込を壊していないことの観測)。
	if len(optionalImportColumns) != 15 {
		t.Errorf("任意列 = %d 件, want 15", len(optionalImportColumns))
	}
}

// TestCSVColumnNamesAreASCII は列名に表示語(日本語)が混ざらないことを押さえる。
//
// ★★M24-07 の危険そのものである —— 本サブは画面の語彙を一括で置換した。
// 列名は「画面に出る語」ではないが、置換の巻き添えになりうる。
// ⇒ 巻き込んだ瞬間に赤くなる形にしておく。
func TestCSVColumnNamesAreASCII(t *testing.T) {
	all := append(append([]string{}, CSVColumns...), SetupCSVColumns...)
	if len(all) == 0 {
		t.Fatal("走査対象が空(陽性対照)")
	}
	for _, col := range all {
		for _, r := range col {
			if r > 0x7F {
				t.Errorf("列名 %q に非 ASCII 文字 %q が入っている(表示語の置換に巻き込まれた可能性)", col, r)
				break
			}
		}
	}
}

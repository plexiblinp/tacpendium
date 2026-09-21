package migration_test

import (
	"database/sql"
	"sort"
	"testing"
)

// movementCodes は M14-03b(000025)投入の移動 system move 9 種(M14-03c で削除・再投入しない)。
var movementCodes = []string{
	"forward", "back", "micro_forward", "micro_back",
	"dash_forward", "dash_back", "jump_neutral", "jump_forward", "jump_back",
}

// ryuMoveSet は ryu の (code, category, 元技code, official_ja_move alias) の集合を
// 決定論的な文字列表現で返す(down 忠実性のスナップショット比較用)。
func ryuMoveSet(t *testing.T, db *sql.DB) []string {
	t.Helper()
	rows, err := db.Query(`SELECT m.code, m.category,
		COALESCE((SELECT b.code FROM moves b WHERE b.id = m.original_move_id), ''),
		COALESCE((SELECT pa.alias_text FROM preset_aliases pa
			JOIN presets p ON p.id = pa.preset_id AND p.code = 'official_ja_move'
			WHERE pa.move_id = m.id), '')
		FROM moves m JOIN characters c ON c.id = m.character_id WHERE c.code = 'ryu'`)
	if err != nil {
		t.Fatalf("ryuMoveSet query: %v", err)
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var code, cat, base, alias string
		if err := rows.Scan(&code, &cat, &base, &alias); err != nil {
			t.Fatalf("scan: %v", err)
		}
		out = append(out, code+"|"+cat+"|"+base+"|"+alias)
	}
	sort.Strings(out)
	return out
}

// TestRun_M1403c_UpContract は 000029+000030 の up 契約を検証する:
// ryu 新 moves=93(CSV 84+移動 9)・alias 93・combos/setups 空・新旧 code の存否・rush 全解決。
//
// ★終端は v30(自サブの最終連番)である。HEAD ではない(M19-04d §4.3)。
//
//	本テストが主張するのは「M14-03c の up 契約」であって「HEAD でもこの形が保たれる」ではない。
//	HEAD 不変条件を相乗りさせると、後続サブの正当な変更で「M14-03c のテスト」が落ち、
//	原因が名前から辿れなくなる。
//	★閉じたことで主張されなくなったもの: 「HEAD でも ryu が 93 moves・旧 code 不在・
//	  rush 17 全解決・FK 宙吊り無し」。このうち FK 宙吊り無しだけは波に依存しない普遍の
//	  不変条件なので、TestRun_HEAD_NoDanglingForeignKeys として別に切り出した。
//	  残り(93 moves 等)は ryu の再 seed 波で正当に変わり得るため引き継がない。
func TestRun_M1403c_UpContract(t *testing.T) {
	m, db := newMigrator(t)
	defer db.Close()
	if err := m.Up(); err != nil {
		t.Fatalf("up to HEAD: %v", err)
	}

	// ★★M33-03: 件数(93 = CSV 84 + 移動 9)を CSV との突き合わせへ置き換えた。
	//   ⇒ 「+9」の前提が失効していた(現在の system move は 11 種)。詳細は
	//     assertCharMovesMatchCSV の godoc。
	assertCharMovesMatchCSV(t, db, "ryu")
	// alias は「全 move に対で付く」ことで見る(生 code フォールバックが出ない条件)。
	if got := scanInt(t, db, `SELECT count(*) FROM moves m JOIN characters c ON c.id=m.character_id
		WHERE c.code='ryu' AND NOT EXISTS (
			SELECT 1 FROM preset_aliases pa JOIN presets p ON p.id=pa.preset_id AND p.code='official_ja_move'
			WHERE pa.move_id = m.id)`); got != 0 {
		t.Errorf("official_ja_move alias 欠落の ryu moves = %d, want 0", got)
	}
	if got := scanInt(t, db, `SELECT count(*) FROM combos WHERE character_id IN (SELECT id FROM characters WHERE code='ryu')`); got != 0 {
		t.Errorf("ryu combos = %d, want 0 (クリア済み)", got)
	}
	if got := scanInt(t, db, `SELECT count(*) FROM setups WHERE character_id IN (SELECT id FROM characters WHERE code='ryu')`); got != 0 {
		t.Errorf("ryu setups = %d, want 0 (クリア済み)", got)
	}

	// 000030 が seed する code が存在する。
	//
	// ★見出しを「由来」ではなく「役割」で書く(M35-02 レビュー 中-5)。
	//   ★以前は「新体系のみの code」と書いていたが、M35-02 で移した `axe_kick` は
	//     000004 由来の旧体系 seed でも使われていた綴りであり、「新体系のみ」ではない。
	//
	// ★★2026-09-10(M35-02 / 000108)に `axe_kick_2` -> `axe_kick` を移した。
	//   本テストが主張しているのは「新体系が使う code はこれである」であって
	//   「その綴りが未来永劫この形である」ではない。開発者の確定(2026-09-08。逐語＝
	//   「axe_kick_2 側の方が誤り。axe_kick、rush_axe_kick が正しい」)により
	//   新体系の code が `axe_kick` になったため、主張の側も追随させた。
	//   ★これは「落ちたテストを緩める」ではない——是正前は 0 件/1 件だった 2 行が、
	//     是正後に 1 件/0 件へ**反転する**だけであり、主張の強さは変わらない。
	//   ★golden 000030 が seed する code が変わったのが原因である。本テストの終端 v30 は
	//     000030 の直後であり、golden を直せば必ずここが動く(先例の terry / 000026 には
	//     版固定テストが無かったため、この追随は本サブが初めて行う)。
	//   ★`axe_kick` はもともと 000004 由来の旧体系 seed が使っていた綴りでもあるが、
	//     その旧 seed 行は 000029 が掃いており復活していない(下の rush 全解決・moves 93 件が
	//     それを保証する)。⇒ 下の「残っていてはならない code」の側から `axe_kick` を外した。
	for _, code := range []string{"tatsumaki_senpu_kyaku_light", "collarbone_breaker", "axe_kick",
		"high_blade_kick_light", "sa3_shin_shoryuken", "denjin_charge_hadoken", "drive_parry"} {
		if got := scanInt(t, db, `SELECT count(*) FROM moves m JOIN characters c ON c.id=m.character_id
			WHERE c.code='ryu' AND m.code=?`, code); got != 1 {
			t.Errorf("000030 が seed する code %q = %d, want 1", code, got)
		}
	}
	// seed 後に残っていてはならない code が不在である。
	//
	// ★見出しを「由来」ではなく「役割」で書く(M35-02 レビュー 中-5)。
	//   ★以前は「旧体系のみの code が不在(000004 由来の旧 seed が掃かれている)」と書いていたが、
	//     M35-02 で置いた `axe_kick_2` は 000004 由来ではなく、M35-02 が撤回した綴りである。
	//     ⇒ 由来で括ると 1 要素だけ意味が違うリストになる。**役割で括れば全要素が同じ意味になる**——
	//       「000029 が掃いた旧 seed の綴り」も「M35-02 が撤回した綴り」も、
	//       *seed 後に残っていてはならない* 点では同じである。
	//
	// ★`axe_kick` は上の 000030 が seed する側へ移した(M35-02)。★代わりに `axe_kick_2` をここへ置く——
	//   M35-02 で撤回した綴りであり、**残っていたら是正が効いていない**という意味になる。
	//   ⇒ 不在リストの要素数は減っていない(是正の前後で主張は対のまま入れ替わる)。
	for _, code := range []string{"tatsumaki_light", "collar_bone_breaker", "axe_kick_2",
		"high_blade_kick", "sa2_shin_shoryuken", "sa3_denjin_hadoken"} {
		if got := scanInt(t, db, `SELECT count(*) FROM moves m JOIN characters c ON c.id=m.character_id
			WHERE c.code='ryu' AND m.code=?`, code); got != 0 {
			t.Errorf("残っていてはならない code %q が残存 = %d, want 0", code, got)
		}
	}
	// rush 17 種の original_move_id が全解決(NULL ゼロ)。
	if got := scanInt(t, db, `SELECT count(*) FROM moves m JOIN characters c ON c.id=m.character_id
		WHERE c.code='ryu' AND m.category='rush_variant'`); got != 17 {
		t.Errorf("ryu rush_variant = %d, want 17", got)
	}
	if got := scanInt(t, db, `SELECT count(*) FROM moves m JOIN characters c ON c.id=m.character_id
		WHERE c.code='ryu' AND m.category='rush_variant' AND m.original_move_id IS NULL`); got != 0 {
		t.Errorf("original_move_id 未解決の rush = %d, want 0", got)
	}
	fkCheck(t, db)
}

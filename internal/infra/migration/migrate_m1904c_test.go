package migration_test

import (
	"database/sql"
	"testing"
)

// ★★★【M33-03・2026-09-19】本ファイルの終端は HEAD である。
//
// ⇒ 着手時点は「HEAD を終端にしない(SUPP-001 §5.5 の規約 (1))」と書いていたが、M33-02 が
// 旧 111 本を新系列 9 本へ潰した結果、閉じるべき区間そのものが 1 つしか無い。
// ★版数を名指しして区間を閉じる形は、機構ごと成立しなくなった。
//
// ⇒ したがって本ファイルのテストは「契約テスト」ではなく HEAD テストである。
// 落ちたときの正しい対応も変わる——実装を疑う前に、期待値の更新が正しいかを
// 見ること(SUPP-001 §5.5.2 規約 (2) の「扱いを混ぜない」)。
//
// ★★★名前空間は未解決である。規約 (2) は「HEAD スコープは migrate_head_test.go に
// TestRun_HEAD_* として置き、サブ名へ相乗りさせない」と定めるが、本ファイルは
// サブ名のままである。⇒ 移設するか規約 (2) を改めるかは設計卓の判断であり、
// M33-03 の設計伝達レポートへ CHANGE 原稿として回してある。

// M19-04c(CHANGE なし・マイグレ 000063)の是正結果を固定する。
//
// ★本ファイルは「件数」ではなく「v63(本サブの最終連番)時点の状態」で固定する。
//
//	golden(000026 / 000034 / 000045)も同じ是正を入れてあるため、新規 DB は最初から是正後の値で
//	seed される。したがって 000063 の UPDATE は新規 DB では 1 行も当たらず、それでも成功する
//	——エラーにならない。「UPDATE が 10 行に当たった」で固定すると、CI では常に 0 行になるため
//	何も守れない(指示書 §2.6)。
//
// ★000063 の存在価値は「既に適用済みの DB(開発者の手元・配布済み)を追随させること」だけで
//
//	あり、その経路は新規 DB からは再現できない。
//	★★【M33-03】着手時点はその検証を TestRun_M1904c_DownUpRoundTrip(旧 000063 の down -> re-up)
//	が受け持っていたが、名指しした版が消えたため同テストは成立せず削除した。
//	⇒ down 往復そのものは TestRun_HEAD_DownUpRoundTrip(migrate_head_test.go)が新系列に対して見る。
//	★ただし「適用済み DB を追随させる」経路は新系列には存在しない(区間が 1 つしか無い)。
//
// 判定値は const / テーブルに置き、テスト名には数字を埋め込まない(M14-03d §3.3-1)。
//
// ★★【2026-09-12 更新・M30-07】guile の【ジャスト】版 move_code が接頭形
//
//	`perfect_timing_<強度>_<技>` から接尾形 `<技>_perfect_<強度>` へ揃った(マイグレ 000112)。
//	golden 000026 を再生成した手番であるため、その版に固定された本ファイルの主張も追随させた
//	(SUPP-001 §5.5.4 規約 (16)。歯止め (a) 同一手番 / (b) 要素数不変 / (c) 先に赤を実測 /
//	 (d) 見出しは役割で書く)。★主張の本数も強さも 1 つも減らしていない。
const (
	// 改名の前後。★旧 code が 0 件・新 code が 1 件を対で固定する。
	// 片方だけだと「旧が残っている」か「新が増えている」かのどちらかを取り落とす。
	m1904cOldBreak  = "sonic_break_light"
	m1904cNewBreak  = "sonic_break"
	m1904cOldCross2 = "sonic_cross_2_meter_od" // 改名後は別の技(旧 3_meter_od)を指す
	m1904cNewJust   = "sonic_cross_perfect_od"
	m1904cOldCross3 = "sonic_cross_3_meter_od"
)

// m1904cFrames は是正後(HEAD)のフレーム値。10 行のうちフレームを持つ 7 行。
// A(sonic_break)は改名のみでフレーム不変のため m1904cCodes 側で固定する。
var m1904cFrames = []struct {
	char, code                       string
	startup, active, recovery, total int
}{
	// B-3: 派生元が OD ソニックブレイドだけなので通し値。startup_basis は 'through'。
	{"guile", "sonic_cross_2_meter_od", 15, 46, 11, 71},
	// C: 誤っていたのは active / recovery / total(mai の 2 行のみ startup も +1)。
	{"kimberly", "bushin_prism_strikes", 26, 3, 19, 47},
	{"lily", "condor_dive_follow_up", 12, 12, 24, 47},
	{"lily", "windclad_od_condor_dive_follow_up", 12, 10, 24, 45},
	{"mai", "midare_kachousen", 28, 30, 39, 96},
	{"mai", "flame_midare_kachousen", 28, 30, 39, 96},
	{"manon", "temps_lie", 5, 5, 17, 26},
}

// countCodeM1904c は guile の当該 code の行数を返す。
func countCodeM1904c(t *testing.T, db *sql.DB, char, code string) int {
	t.Helper()
	return scanInt(t, db, `SELECT count(*) FROM moves m JOIN characters c ON c.id = m.character_id
		WHERE c.code = ? AND m.code = ?`, char, code)
}

// assertFramesM1904c は 1 行のフレーム 4 値を突合する。
func assertFramesM1904c(t *testing.T, db *sql.DB, char, code string, su, act, rec, tot int) {
	t.Helper()
	var gotSu, gotAct, gotRec, gotTot int
	err := db.QueryRow(`SELECT m.startup, m.active, m.recovery, m.total
		FROM moves m JOIN characters c ON c.id = m.character_id
		WHERE c.code = ? AND m.code = ?`, char, code).Scan(&gotSu, &gotAct, &gotRec, &gotTot)
	if err != nil {
		t.Fatalf("%s/%s の行が引けない: %v", char, code, err)
	}
	if gotSu != su || gotAct != act || gotRec != rec || gotTot != tot {
		t.Errorf("%s/%s = %d/%d/%d/%d, want %d/%d/%d/%d",
			char, code, gotSu, gotAct, gotRec, gotTot, su, act, rec, tot)
	}
	// ★内部整合。seedgen の validate() が全カテゴリ一律で課している式であり、
	//   是正値がこの式を破っていたら CSV 側の再生成が通らない。
	if tot != su+act-1+rec {
		t.Errorf("%s/%s の内部整合が崩れている: %d != %d+%d-1+%d",
			char, code, tot, su, act, rec)
	}
}

// assertCorrectedStateM1904c は v63 で満たすべき最終状態をまとめて突合する。
func assertCorrectedStateM1904c(t *testing.T, db *sql.DB) {
	t.Helper()
	// 改名 3 件: 旧 code が 0 件・新 code が 1 件。
	for _, w := range []struct {
		code string
		want int
	}{
		{m1904cOldBreak, 0},
		{m1904cNewBreak, 1},
		{m1904cOldCross3, 0},
		{m1904cNewJust, 1},
		// ★旧 2_meter_od の code 自体は「別の技(旧 3_meter_od)の新 code」として 1 件残る。
		//   0 件を期待してはならない。指す実体が入れ替わっている点が本サブの肝である。
		{m1904cOldCross2, 1},
	} {
		if got := countCodeM1904c(t, db, "guile", w.code); got != w.want {
			t.Errorf("guile の %s = %d 件, want %d", w.code, got, w.want)
		}
	}

	// 改名後の 2_meter_od は「ODソニッククロス２」であること(name_ja で実体を確かめる)。
	// ★code だけを見ると入れ替わりに気付けない。
	var nameJa string
	err := db.QueryRow(`SELECT pa.alias_text FROM moves m
		JOIN characters c ON c.id = m.character_id
		JOIN preset_aliases pa ON pa.move_id = m.id
		 AND pa.preset_id = (SELECT id FROM presets WHERE code = 'official_ja_move')
		WHERE c.code = 'guile' AND m.code = ?`, m1904cOldCross2).Scan(&nameJa)
	if err != nil {
		t.Fatalf("改名後 %s の name_ja が引けない: %v", m1904cOldCross2, err)
	}
	if nameJa != "ODソニッククロス２" {
		t.Errorf("改名後 %s の name_ja = %q, want %q(改名の対応が入れ替わっている疑い)",
			m1904cOldCross2, nameJa, "ODソニッククロス２")
	}

	for _, f := range m1904cFrames {
		assertFramesM1904c(t, db, f.char, f.code, f.startup, f.active, f.recovery, f.total)
	}

	// B-3 の startup_basis。000050 が人手判断待ちとして unknown で残した行に本サブで値を入れる。
	var basis string
	if err := db.QueryRow(`SELECT m.startup_basis FROM moves m JOIN characters c ON c.id = m.character_id
		WHERE c.code = 'guile' AND m.code = ?`, m1904cOldCross2).Scan(&basis); err != nil {
		t.Fatalf("startup_basis が引けない: %v", err)
	}
	if basis != "through" {
		t.Errorf("guile/%s の startup_basis = %q, want %q", m1904cOldCross2, basis, "through")
	}

	// is_projectile の母集団が生きていること。
	//
	// ★★M33-03: 全体件数(135)の固定を外した。⇒ これは v63 時点(17 キャラ)の母数であり、
	//   後続の seed 波で正当に増える(現在 188)。★下の名指し 3 行の主張が本体である
	//   ——「取り落としと巻き込みが相殺して通り得る」という懸念に答えているのは、
	//   件数ではなく名指しのほうである。⇒ 件数は 0 でないことだけを見る。
	if got := scanInt(t, db, `SELECT count(*) FROM moves WHERE is_projectile = 1`); got == 0 {
		t.Errorf("is_projectile=1 が 0 行(母集団が壊れている)")
	}
	// ★是正した guile 3 行が飛び道具のまま残っていること(件数だけだと取り落としと
	//   別行の巻き込みが相殺して通り得る)。
	for _, code := range []string{m1904cNewBreak, m1904cNewJust, m1904cOldCross2} {
		if got := scanInt(t, db, `SELECT count(*) FROM moves m JOIN characters c ON c.id = m.character_id
			WHERE c.code = 'guile' AND m.code = ? AND m.is_projectile = 1`, code); got != 1 {
			t.Errorf("guile/%s の is_projectile=1 = %d, want 1", code, got)
		}
	}
}

// TestRun_M1904c_CorrectedState は本サブ適用後(v63)の最終状態を固定する(件数ではなく状態)。
func TestRun_M1904c_CorrectedState(t *testing.T) {
	m, db := newMigrator(t)
	defer db.Close()
	if err := m.Up(); err != nil {
		t.Fatalf("up to HEAD: %v", err)
	}
	assertCorrectedStateM1904c(t, db)
}

package migration_test

import (
	"database/sql"
	"testing"
)

// M37-04(CHANGE なし・マイグレ 000114 / 000115)の結果を固定する。
//
// ★★本サブは 2 本のマイグレを消費し、用途が違う(D-870 の条件＝用途を明記すること)。
//
//	000114 = 列の追加(moves.first_hit_startup・層 A)。★値は 1 行も入れない。
//	000115 = データ修正(chun_li soaring_eagle_punches の is_aerial・層 B)。
//	         ★startup には 1 行も触れない。
//
// ★000113 は欠番である(D-866)。詰めていないことは連番の実在で分かる。
const ()

const (
	m3704Char = "chun_li"
	m3704Code = "soaring_eagle_punches"
)

// m3704TargetSetCounts は「startup が初段の値とは限らない行」を数える式と期待値。
//
// ★★実測し直すこと(チェックリスト E-1)。M37-RESEARCH-01 の値をそのまま写してはならない。
//
//	本表は 2026-09-13 に DB 側で数え直した結果であり、CSV 側の独立集計とも一致する。
//	★106 は「誤データ 106 件」ではない。「first_hit_startup を埋める対象の行数」である。
//
// ★★【2026-09-13・追補2 で更新】109 -> 110 / 117 -> 118 / 9 -> 8。
//
//	chun_li soaring_eagle_punches を soaring_raid 形式へ揃えた際に is_derived を
//	false -> true にしたため、同行が非 derived から derived+standalone へ移った。
//	★ただし「startup あり 106」と「非空中 damage>0 105」は動かない —— 同行はフレームを
//	  空にしたため、どちらの条件にも入らない(soaring_raid / satelite_leap と同じ)。
//
// ★★★【2026-09-19・M39-01 で更新】110 -> 106。
//
//	D-187 の不変条件(startup が NULL なら startup_basis は unknown)を新系列へ折り込んだため、
//	フレームを持たない空中限定 4 行が standalone から unknown へ移り、本集合から外れた。
//	★外れた 4 行 = chun_li soaring_eagle_punches / dee_jay party_in_the_air /
//	  elena soaring_raid / elena raptor_range。
//	★★この 4 行は（旧系列の）000116 の backfill が「投入対象外」として意図的に NULL のまま残した 4 行と
//	  完全に同一である(下の TestRun_M3704_FirstHitStartupBackfilled (3) が名指ししている)。
//	⇒ 埋める対象 106 と、実際に値が入っている 106 がこれで一致した。
//	★埋める実務は動いていない —— 外れた 4 行はもともと埋める対象ではなかった。
var m3704TargetSetCounts = []struct {
	name  string
	where string
	want  int
}{
	{"target_combo", `m.category = 'target_combo'`, 126},
	{"うち is_derived", `m.category = 'target_combo' AND m.is_derived = 1`, 118},
	{"うち非 derived", `m.category = 'target_combo' AND m.is_derived = 0`, 8},
	{"derived ＋ standalone(＝埋める対象)",
		`m.category = 'target_combo' AND m.is_derived = 1 AND m.startup_basis = 'standalone'`, 106},
	{"上記のうち startup あり",
		`m.category = 'target_combo' AND m.is_derived = 1 AND m.startup_basis = 'standalone'
		 AND m.startup IS NOT NULL`, 106},
	{"上記かつ非空中・damage>0",
		`m.category = 'target_combo' AND m.is_derived = 1 AND m.startup_basis = 'standalone'
		 AND m.startup IS NOT NULL AND m.is_aerial = 0 AND m.damage > 0`, 105},
	{"basis=through(★埋める対象の外・候補から消してはならない)",
		`m.category = 'target_combo' AND m.startup_basis = 'through'`, 4},
}

// airOnlyShape は「空中限定ターゲットコンボの形」に当てはまる行数を返す。
//
// ★★形の正本は elena soaring_raid / ingrid satelite_leap である(開発者指示・2026-09-13)。
//
//	フレーム 4 列がすべて NULL ∧ is_aerial = 0 ∧ category = 'target_combo'。
//	⇒ この形なら buildStarters は候補にしない(candidateStartup が nil を返す)一方、
//	  相手技としては手動確認レーン(data_missing)に出る。
//	★is_aerial = 1 にすると isNonPunishableTarget で相手技からも完全除外され、
//	  手動確認レーンにすら出なくなる。⇒ それは soaring_raid 形式ではない。
//
// ★キャラを JOIN で絞る。moves.code はテーブル全体では一意ではない(UNIQUE は (character_id, code))。
func airOnlyShape(t *testing.T, db *sql.DB, charCode, moveCode string) int {
	t.Helper()
	return scanInt(t, db, `SELECT count(*) FROM moves m JOIN characters c ON c.id = m.character_id
		WHERE c.code = ? AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = ?
		  AND m.startup IS NULL AND m.active IS NULL AND m.recovery IS NULL AND m.total IS NULL
		  AND m.is_aerial = 0 AND m.category = 'target_combo'`, charCode, moveCode)
}

// TestRun_M3704_FirstHitStartupBackfilled は 000116 の投入結果を固定する(追補3)。
//
// ★★一次源は開発者が提示した解決ルールである(2026-09-14)——command を最初の " chain " で
//
//	切った左側と command が完全一致し、chain を含まない同キャラの技の startup を初段とする。
//	実測 106/106 が解決した。対応表の全数は
//	docs/progress/20260913-M37-04-dropped-starters.md にある。
//
// ★投入しない 4 行(空中限定でフレームを持たない行)が NULL のままであることを対で見る ——
//
//	「入った件数」だけでは、規則を広く当てすぎても検出できない(SUPP-001 §5.5 (3))。
func TestRun_M3704_FirstHitStartupBackfilled(t *testing.T) {
	m, db := newMigrator(t)
	defer db.Close()
	if err := m.Up(); err != nil {
		t.Fatalf("up to HEAD: %v", err)
	}

	// (1) 投入した件数。
	if got := scanInt(t, db, `SELECT count(*) FROM moves WHERE first_hit_startup IS NOT NULL`); got != 106 {
		t.Errorf("first_hit_startup が入っている行 = %d, want 106", got)
	}

	// (2) 投入先は「埋める対象」の中だけである。⇒ 規則を広く当てていないことの対。
	if got := scanInt(t, db, `SELECT count(*) FROM moves
		WHERE first_hit_startup IS NOT NULL
		  AND NOT (category = 'target_combo' AND is_derived = 1 AND startup_basis = 'standalone')`); got != 0 {
		t.Errorf("対象外の行へ投入している = %d 件, want 0", got)
	}

	// (3) 空中限定の 4 行は NULL のまま(フレームを持たず確定反撃の対象外)。
	for _, c := range []struct{ char, code string }{
		{"dee_jay", "party_in_the_air"},
		{"elena", "soaring_raid"},
		{"elena", "raptor_range"},
		{m3704Char, m3704Code},
	} {
		if got := scanInt(t, db, `SELECT count(*) FROM moves m JOIN characters c ON c.id = m.character_id
			WHERE c.code = ? AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6')
			  AND m.code = ? AND m.first_hit_startup IS NULL`, c.char, c.code); got != 1 {
			t.Errorf("%s/%s の first_hit_startup が NULL でない(空中限定は投入対象外)", c.char, c.code)
		}
	}

	// (4) ★B06 の題材を名指しで固定する。
	//     ryu fuwa_triple_strike_2hits は startup=5(2 段目)だが、初段は立中P の 6 である。
	if got := scanInt(t, db, `SELECT m.first_hit_startup FROM moves m JOIN characters c ON c.id = m.character_id
		WHERE c.code = 'ryu' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6')
		  AND m.code = 'fuwa_triple_strike_2hits'`); got != 6 {
		t.Errorf("ryu/fuwa_triple_strike_2hits の first_hit_startup = %d, want 6(初段＝立中P)", got)
	}
	// ★同行の startup は 5 のままである(本サブはデータを直していない)。
	if got := scanInt(t, db, `SELECT m.startup FROM moves m JOIN characters c ON c.id = m.character_id
		WHERE c.code = 'ryu' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6')
		  AND m.code = 'fuwa_triple_strike_2hits'`); got != 5 {
		t.Errorf("ryu/fuwa_triple_strike_2hits の startup = %d, want 5", got)
	}
}

// TestRun_M3704_TargetSetCounts は埋める対象の母集団を実測で固定する(E-1)。
func TestRun_M3704_TargetSetCounts(t *testing.T) {
	m, db := newMigrator(t)
	defer db.Close()
	if err := m.Up(); err != nil {
		t.Fatalf("migrate up: %v", err)
	}
	for _, c := range m3704TargetSetCounts {
		q := `SELECT count(*) FROM moves m JOIN characters c ON c.id = m.character_id
			JOIN games g ON g.id = c.game_id AND g.code = 'sf6' WHERE ` + c.where
		if got := scanInt(t, db, q); got != c.want {
			t.Errorf("%s = %d 行, want %d", c.name, got, c.want)
		}
	}
}

// TestRun_M3704_CorrectedState は 000115 の是正結果(v115 時点の状態)を固定する。
//
// ★件数ではなく状態で固定する理由 —— golden(000084 / 000085)と CSV にも同じ是正を入れて
//
//	あるため、新規 DB は最初から是正後の形で seed される。000115 の UPDATE は 0 行に当たって
//	成功する。⇒ 「UPDATE が 1 行に当たった」で固定すると CI では常に 0 行になり、何も守らない
//	(000112 / migrate_m3007_test.go と同じ形)。
func TestRun_M3704_CorrectedState(t *testing.T) {
	m, db := newMigrator(t)
	defer db.Close()
	if err := m.Up(); err != nil {
		t.Fatalf("up to HEAD: %v", err)
	}
	if got := airOnlyShape(t, db, m3704Char, m3704Code); got != 1 {
		t.Errorf("是正後の %s/%s が空中限定ターゲットコンボの形になっていない"+
			"(フレーム 4 列 NULL ∧ is_aerial=0 ∧ target_combo)", m3704Char, m3704Code)
	}
	if got := scanInt(t, db, `SELECT m.is_derived FROM moves m JOIN characters c ON c.id = m.character_id
		WHERE c.code = ? AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = ?`,
		m3704Char, m3704Code); got != 1 {
		t.Errorf("是正後の is_derived = %d, want 1(soaring_raid / satelite_leap と揃える)", got)
	}
}

// TestRun_M3704_AirOnlyTargetCombosShareTheShape は ★3 行が同じ形であることを固定する。
//
// ★★これが「soaring_raid 形式へ揃えた」の実体である。⇒ 次に誰かが片方だけ触ったら赤になる。
//
//	形の正本は開発者指示(2026-09-13)＝「elena の soaring_raid の形式にしたい。これは
//	空中限定のターゲットコンボで確定反撃ではそもそも扱わない対象外になる」。
func TestRun_M3704_AirOnlyTargetCombosShareTheShape(t *testing.T) {
	m, db := newMigrator(t)
	defer db.Close()
	if err := m.Up(); err != nil {
		t.Fatalf("migrate up: %v", err)
	}
	for _, c := range []struct{ char, code, what string }{
		{"elena", "soaring_raid", "形の正本"},
		{"ingrid", "satelite_leap", "類似系"},
		{m3704Char, m3704Code, "M37-04 で揃えた行"},
	} {
		if got := airOnlyShape(t, db, c.char, c.code); got != 1 {
			t.Errorf("%s/%s(%s)が空中限定ターゲットコンボの形になっていない", c.char, c.code, c.what)
		}
	}
}

// TestRun_M3704_StartupUntouchedExceptAirOnly は「startup に触れたのは 1 行だけ」を固定する。
//
// ★★チェックリスト束 C-1 が「最初に見ること」と名指しする観点である ——
//
//	本サブの前提は「データは正しい。誤っているのは判定である」であり、startup の値を
//	確定反撃の都合で書き換えてはならない。
//	★★★唯一の例外が鷹嘴連拳であり、それも「別の値へ書き換えた」のではなく「空にした」である
//	  (空中限定のため地上の確定反撃に持ち込む値をそもそも持たない＝開発者判断・2026-09-13)。
func TestRun_M3704_StartupUntouchedExceptAirOnly(t *testing.T) {
	m, db := newMigrator(t)
	defer db.Close()
	if err := m.Up(); err != nil {
		t.Fatalf("migrate up: %v", err)
	}

	// (1) 鷹嘴連拳は空である(唯一の例外)。
	if got := scanInt(t, db, `SELECT count(*) FROM moves m JOIN characters c ON c.id = m.character_id
		WHERE c.code = ? AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = ?
		  AND m.startup IS NULL`, m3704Char, m3704Code); got != 1 {
		t.Errorf("%s/%s の startup が空になっていない", m3704Char, m3704Code)
	}

	// (2) B06 の題材である ryu fuwa_triple_strike_2hits は seed 値のままである。
	//     ⇒ 「判定を変えた」のであって「データを直した」のではないことの証拠。
	if got := scanInt(t, db, `SELECT m.startup FROM moves m JOIN characters c ON c.id = m.character_id
		WHERE c.code = 'ryu' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6')
		  AND m.code = 'fuwa_triple_strike_2hits'`); got != 5 {
		t.Errorf("ryu/fuwa_triple_strike_2hits の startup = %d, want 5(本サブは値を変えない)", got)
	}

	// (3) 埋める対象のうち startup を持つ行数は 106 のままである。
	//     ⇒ 鷹嘴連拳を空にしても、他の行の startup は 1 行も動いていない。
	//     ★M39-01 以降、埋める対象そのものが 106 行であり、その全数が startup を持つ
	//       (フレームを持たない空中限定 4 行は unknown へ移って対象から外れた)。
	//       ⇒ 本アサーションの値 106 は動かないが、「110 のうち 106」という関係ではなくなった。
	if got := scanInt(t, db, `SELECT count(*) FROM moves m JOIN characters c ON c.id = m.character_id
		JOIN games g ON g.id = c.game_id AND g.code = 'sf6'
		WHERE m.category = 'target_combo' AND m.is_derived = 1
		  AND m.startup_basis = 'standalone' AND m.startup IS NOT NULL`); got != 106 {
		t.Errorf("埋める対象のうち startup あり = %d 行, want 106", got)
	}
}

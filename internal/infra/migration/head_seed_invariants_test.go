package migration_test

import (
	"fmt"
	"strings"
	"testing"
)

// 本ファイルは ★HEAD スコープ★ の seed 不変条件を置く場所である。
//
// ★★★なぜ在るか(M33-03・レビュー 高-3 の是正)——M33-02 が旧 111 本を新系列 9 本へ潰した結果、
// 版数を名指しして区間を閉じていた歴史テスト 141 本のうち 102 本を消した。その 102 本の中に、
// **版数に依存しない主張が混ざっていた。** ⇒ 消した時点では期待値の表だけが孤児として残り、
// **主張を見るものが 1 つも無くなっていた。**
//
// ★★もっとも危ないのは `D-317` の交差検査だった——旧 `migrate_m2003_test.go` の (g) が
//
//	実 seed に対して「`alias_text` が別行の `alias_text_en` と一致しない」を 0 件で固定して
//	いた。★同検査は「列を跨ぐ条件であり UNIQUE では表現できない。⇒ 検査で守る」と
//	自ら書いていたものであり、**消すと守るものが無くなる**(repo 全体を走査して確認)。
//	しかも `internal/repository/preset/queries.go` と `internal/service/preset/service.go` の
//	コメントが「seed 経路は migrate_m2003_test.go (g) が 0 件を固定している」と*指し続けて*いた。
//
// ★ここへ置く基準は `migrate_head_test.go` と同じ＝「HEAD が何であっても成り立つべき不変条件」。
// ★★ただし本ファイルは *seed の中身* を見る(スキーマではなく行)。⇒ 新しいキャラが増えたとき、
// 名指しの行についての主張は変わらないが、**新しい行がこの表に載らない**。
// ⇒ 表に足すのは seed 波の手番である。

// TestRun_HEAD_NoCrossingAliasTextEn は `D-317` の交差条件を実 seed に対して固定する。
//
// ★★旧 `migrate_m2003_test.go` の (g) から引き上げた。⇒ 「ある技の `alias_text` が、
// 同一プリセット・同一キャラの別の技の `alias_text_en` と一致する」は列を跨ぐ条件であるため
// UNIQUE では表現できない。**検査で守るしかない。**
func TestRun_HEAD_NoCrossingAliasTextEn(t *testing.T) {
	m, db := newMigrator(t)
	defer db.Close()
	if err := m.Up(); err != nil {
		t.Fatalf("up to HEAD: %v", err)
	}
	// 母数の生存確認。★これが 0 だと「交差 0 件」が空振りする。
	if got := scanInt(t, db, `SELECT count(*) FROM preset_aliases WHERE alias_text_en IS NOT NULL`); got == 0 {
		t.Fatalf("alias_text_en を持つ行が 0(母集団が壊れている)")
	}
	if crossed := scanInt(t, db, `SELECT count(*) FROM preset_aliases a
		JOIN preset_aliases b
		  ON b.preset_id = a.preset_id AND b.character_id = a.character_id AND b.move_id <> a.move_id
		WHERE b.alias_text_en IS NOT NULL AND a.alias_text = b.alias_text_en`); crossed != 0 {
		t.Errorf("alias_text と別行の alias_text_en の交差 = %d 件, want 0(D-317 / DES-003 §3.9)", crossed)
	}
}

// TestRun_HEAD_SeedSatisfiesUniqueConstraints は実 seed が一意制約を満たすことを固定する。
//
// ★★旧 `migrate_m2003_test.go` から引き上げた。⇒ 制約そのものが張られていることは
// `TestRun_M2003_ConstraintActuallyBites` が見るが、**実データが違反していないこと**は
// 別の主張である(制約を張る前から入っていた行は、制約の宣言だけでは検出されない)。
func TestRun_HEAD_SeedSatisfiesUniqueConstraints(t *testing.T) {
	m, db := newMigrator(t)
	defer db.Close()
	if err := m.Up(); err != nil {
		t.Fatalf("up to HEAD: %v", err)
	}
	for _, c := range []struct {
		label, query string
	}{
		{"(preset_id, character_id, alias_text)", `SELECT count(*) FROM (
			SELECT 1 FROM preset_aliases GROUP BY preset_id, character_id, alias_text
			HAVING count(*) > 1)`},
		{"(preset_id, character_id, alias_text_en)（alias_text_en 非 NULL のみ）", `SELECT count(*) FROM (
			SELECT 1 FROM preset_aliases WHERE alias_text_en IS NOT NULL
			GROUP BY preset_id, character_id, alias_text_en HAVING count(*) > 1)`},
		{"(preset_id, move_id)", `SELECT count(*) FROM (
			SELECT 1 FROM preset_aliases GROUP BY preset_id, move_id HAVING count(*) > 1)`},
		{"(character_id, code)（moves）", `SELECT count(*) FROM (
			SELECT 1 FROM moves GROUP BY character_id, code HAVING count(*) > 1)`},
	} {
		if got := scanInt(t, db, c.query); got != 0 {
			t.Errorf("%s の重複 = %d 件, want 0", c.label, got)
		}
	}
}

// TestRun_HEAD_PresetAliasCharacterIDFilled は `preset_aliases.character_id` が
// 実 seed で 1 行も NULL でないことを固定する。
//
// ★★列は FK ではなく NULL 可である(`000001_init_schema:106`「★FK ではない(000074 の as-built)」)。
// ⇒ 型としては NULL を取りうるが、**配布シードでは全行埋まっている**ことが
// `internal/repository/preset/repository.go` の読み側の前提になっている。
// ★旧 P-34 の期待値表から引き上げた主張である。
func TestRun_HEAD_PresetAliasCharacterIDFilled(t *testing.T) {
	m, db := newMigrator(t)
	defer db.Close()
	if err := m.Up(); err != nil {
		t.Fatalf("up to HEAD: %v", err)
	}
	total := scanInt(t, db, `SELECT count(*) FROM preset_aliases`)
	if total == 0 {
		t.Fatalf("preset_aliases が 0 行(母集団が壊れている)")
	}
	if got := scanInt(t, db, `SELECT count(*) FROM preset_aliases WHERE character_id IS NULL`); got != 0 {
		t.Errorf("preset_aliases.character_id が NULL の行 = %d, want 0(母数 %d 行)", got, total)
	}
}

// TestRun_HEAD_MovementSystemMoveTotals は移動 system move の `total` 実測値を固定する。
//
// ★★★旧 `migrate_m1403f_test.go` の期待値表 `m1403fMovementTotals` から引き上げた。
// ⇒ **この値は CSV に無い。** 移動 system move は `character_data/*.csv` に 1 行も無いため
// （CSV は攻撃技のみを持つ）、`TestRun_HEAD_SeedValuesMatchCSV` は移動 system move を
// **母集団から明示的に除外している。** ⇒ 本テストを入れるまで、これらの値を見るものは
// 1 つも無かった(レビュー 高-3④)。
//
// ★出所は開発者提供の実測値(2026-09-02 受領)。CSV の `notes_tool` が独立に 3 件を裏づける。
func TestRun_HEAD_MovementSystemMoveTotals(t *testing.T) {
	m, db := newMigrator(t)
	defer db.Close()
	if err := m.Up(); err != nil {
		t.Fatalf("up to HEAD: %v", err)
	}
	for _, w := range m1403fMovementTotals {
		for _, c := range []struct {
			code string
			want int
		}{
			{"dash_forward", w.dashForward},
			{"dash_back", w.dashBack},
			{"jump_neutral", w.jump},
		} {
			got := scanInt(t, db, `SELECT count(*) FROM moves m JOIN characters c ON c.id = m.character_id
				WHERE c.code = ? AND m.code = ? AND m.total = ?`, w.code, c.code, c.want)
			if got != 1 {
				t.Errorf("%s/%s の total = %d であるべき(一致した行 %d 件, want 1)", w.code, c.code, c.want, got)
			}
		}
	}
}

// TestRun_HEAD_MoveDerivationCounts はキャラ別の `move_derivations` の子件数とペア数を固定する。
//
// ★★旧 `migrate_m1403f_test.go` の `m1403fDerivationCounts`(派生)と
// `m1403fJumpDerivCounts`(ジャンプ前提)から引き上げた。
// ⇒ 元コメントの逐語「★1 つずつ固定する——`INSERT ... SELECT` は子や親が居なくても
// 0 行投入で成功してしまう(**サイレント no-op**)」。★その危険は seed が在る限り残る。
func TestRun_HEAD_MoveDerivationCounts(t *testing.T) {
	m, db := newMigrator(t)
	defer db.Close()
	if err := m.Up(); err != nil {
		t.Fatalf("up to HEAD: %v", err)
	}
	// ★2 つの表は母集団が重なる(同じキャラが両方に出る)。⇒ キャラごとに合算して比べる。
	want := map[string][2]int{}
	for _, r := range m1403fDerivationCounts {
		v := want[r.char]
		want[r.char] = [2]int{v[0] + r.children, v[1] + r.pairs}
	}
	for _, r := range m1403fJumpDerivCounts {
		v := want[r.char]
		want[r.char] = [2]int{v[0] + r.children, v[1] + r.pairs}
	}
	if len(want) == 0 {
		t.Fatalf("期待値表が空(テストが空回りしている)")
	}
	for char, w := range want {
		children := scanInt(t, db, `SELECT count(DISTINCT d.child_move_id) FROM move_derivations d
			JOIN moves m ON m.id = d.child_move_id JOIN characters c ON c.id = m.character_id
			WHERE c.code = ?`, char)
		pairs := scanInt(t, db, `SELECT count(*) FROM move_derivations d
			JOIN moves m ON m.id = d.child_move_id JOIN characters c ON c.id = m.character_id
			WHERE c.code = ?`, char)
		if children < w[0] || pairs < w[1] {
			t.Errorf("%s の move_derivations: 子 %d(want >= %d) / ペア %d(want >= %d)"+
				"（★期待値表は当該波が投入した分の下限である。後続波が足すのは正当）",
				char, children, w[0], pairs, w[1])
		}
	}
}

// TestRun_HEAD_FourthWaveCustomStates は第四波が投入した `custom_states` 9 状態を固定する。
//
// ★★旧 `migrate_m1403f_test.go` の `m1403fCustomStates` から引き上げた。
// ⇒ `characters.custom_states` は JSON 列であり、**値が入れ替わってもスキーマは変わらない。**
// ★`code` は `name_en` からの機械生成(開発者裁定 2026-09-02)。
func TestRun_HEAD_FourthWaveCustomStates(t *testing.T) {
	m, db := newMigrator(t)
	defer db.Close()
	if err := m.Up(); err != nil {
		t.Fatalf("up to HEAD: %v", err)
	}
	if len(m1403fCustomStates) == 0 {
		t.Fatalf("期待値表が空(テストが空回りしている)")
	}
	for _, w := range m1403fCustomStates {
		got := scanInt(t, db, `SELECT count(*) FROM characters c,
			json_each(json_extract(c.custom_states, '$.states')) j
			WHERE c.code = ?
			  AND json_extract(j.value, '$.code') = ?
			  AND json_extract(j.value, '$.name_ja') = ?
			  AND json_extract(j.value, '$.subject') = ?
			  AND json_extract(j.value, '$.scope') = ?
			  AND json_extract(j.value, '$.type') = ?`,
			w.charCode, w.stateCode, w.nameJA, w.subject, w.scope, w.kind)
		if got != 1 {
			t.Errorf("%s/%s の custom_state が期待どおりに無い(一致 %d 件, want 1)"+
				"（name_ja=%q subject=%q scope=%q type=%q）",
				w.charCode, w.stateCode, got, w.nameJA, w.subject, w.scope, w.kind)
		}
	}
}

// TestRun_HEAD_SeededCharacterSetsAreDisjoint は seed 済み 17 キャラと第四波 12 キャラが
// いずれも実在し、重複していないことを固定する。
//
// ★旧 `m1403fSeeded17` / `m1403fNew12`(SQL の IN 句として使われていた定数)から引き上げた。
func TestRun_HEAD_SeededCharacterSetsAreDisjoint(t *testing.T) {
	m, db := newMigrator(t)
	defer db.Close()
	if err := m.Up(); err != nil {
		t.Fatalf("up to HEAD: %v", err)
	}
	count := func(in string) int {
		return scanInt(t, db, fmt.Sprintf(`SELECT count(*) FROM characters WHERE code IN (%s)`, in))
	}
	seeded17 := count(m1403fSeeded17)
	new12 := count(m1403fNew12)
	if want := strings.Count(m1403fSeeded17, ",") + 1; seeded17 != want {
		t.Errorf("既 seed 17 キャラのうち実在するのは %d 件, want %d", seeded17, want)
	}
	if want := strings.Count(m1403fNew12, ",") + 1; new12 != want {
		t.Errorf("第四波 12 キャラのうち実在するのは %d 件, want %d", new12, want)
	}
	if got := count(m1403fSeeded17 + "," + m1403fNew12); got != seeded17+new12 {
		t.Errorf("2 つのキャラ集合が重複している: 合計 %d, want %d", got, seeded17+new12)
	}
}

// startupBasisInvariantSQL は `D-187` の不変条件の検出式である。
//
// ★述語＝「`startup` が NULL なら `startup_basis` は 'unknown'」(DES-003 §3.3 (i))。
// 'standalone' は「単独で出したときの値が入っている」という*事実の主張*であり、
// 値が無いのにそう主張するのは列の定義に反する。
//
// ★★★ガードと破壊確認が同じ式を通ることに意味がある。⇒ 定数で共有しないと、
// 「検出器が実際に噛むこと」を示した対照と、本番で走る式が別物になりうる。
//
// ★★★【2026-09-19・M39-02】同じ式の複製が **もう 1 か所** に在る ——
//
//	internal/repository/move/rush_runtime_invariant_test.go の d187InvariantSQL。
//	★**本式を変えるときは、あちらも変えること。**
//	⇒ 本定数は package migration_test に属するため、あちら(package move_test)から
//	  import できない。共有する道はあった〔両パッケージが既に import している
//	  internal/testutil/dbtest へ移す等〕が、**本 MS では採らなかった** ——
//	  同 helper は DB を用意する道具であり、不変条件の述語はその責務ではないためである。
//	  ⇒ 「共有できない」のではなく「共有しないことを選んだ」。この行がその代償を埋める。
//
// ★見ているものが違うことも押さえておくこと ——
//
//	本ファイル側は **新規 DB の最終状態**(マイグレを HEAD まで当てた直後の moves)。
//	あちらは **実行時の経路**(ラッシュ版生成が不変条件を破らないこと)。
//	⇒ 本ガードは、利用者が操作して作った行を 1 行も見ない(SUPP-001 §5.5 規約 (24)-3)。
const startupBasisInvariantSQL = `SELECT count(*) FROM moves
	WHERE startup IS NULL AND startup_basis <> 'unknown'`

// TestRun_HEAD_StartupBasisUnknownWhenStartupNull は `D-187` の不変条件を HEAD に対して固定する。
//
// ★★★なぜ HEAD スコープか(M39-01)——本不変条件を見ていた旧テストは
//
//	`migrate_m19p2_test.go` の `TestRun_M19P2_BeforeState` であり、**版 v64 に固定**されていた。
//	⇒ v64 の時点では成立しており、その後の seed 波(第四波)で 132 行が崩れたことを
//	  誰も見ていなかった。★ガードが版固定だったことが見逃しの直因である。
//	⇒ 「HEAD が何であっても成り立つべき不変条件」であるから、版数を名指ししない(D-714)。
//
// ★★★なぜ本ファイルか——`migrate_head_test.go` はスキーマ/構造の主張(FK・表集合・値域)を置き、
//
//	本ファイルは *seed の中身* = 行を見る。本件は `startup` × `startup_basis` の
//	**列を跨ぐ行の述語**であり、UNIQUE でも CHECK でも表現できない。
//	⇒ 同ファイルの `TestRun_HEAD_NoCrossingAliasTextEn` と同じ性格である。
//	★`migrate_head_test.go` の `TestRun_HEAD_StartupBasisPartitionsAllMoves` とは主張が違う ——
//	  あちらは「値が 3 値のどれかか」、こちらは「その値が `startup` と整合するか」。
//	  主張が 2 つあるならテストも 2 つに分ける(同ファイル冒頭の規則)。
//
// ★★★本テストは M39-01 以降、`migrations/` に是正の記録が 1 行も残らない形(新系列への折り込み)
//
//	を採ったため、**不変条件を守る恒久的な歯止めはこれだけ**である。⇒ 消さないこと。
//
// ★件数を書かない。⇒ 新しいキャラが増えても、不変条件を守っていれば緑のままである。
func TestRun_HEAD_StartupBasisUnknownWhenStartupNull(t *testing.T) {
	m, db := newMigrator(t)
	defer db.Close()
	if err := m.Up(); err != nil {
		t.Fatalf("up to HEAD: %v", err)
	}
	// ★母数の生存確認。startup が NULL の行が 0 なら、違反 0 は空振りである。
	nullStartups := scanInt(t, db, `SELECT count(*) FROM moves WHERE startup IS NULL`)
	if nullStartups == 0 {
		t.Fatalf("startup IS NULL の行が 0 件(母数が無く、本テストが空回りしている)")
	}
	if got := scanInt(t, db, startupBasisInvariantSQL); got != 0 {
		t.Errorf("startup が NULL なのに startup_basis が 'unknown' でない行 = %d, want 0"+
			"(母数 startup IS NULL = %d 行。D-187 / DES-003 §3.3 (i))", got, nullStartups)
	}
}

// TestRun_HEAD_StartupBasisInvariantDetectorBites は上のガードの**破壊確認**である。
//
// ★★★1 行を故意に 'standalone' へ戻して検出式が噛むことを示す。⇒ 戻して 0 のままなら、
//
//	そのガードは何も見ていない。★「緑である」ことと「見ている」ことは別である。
//
// ★環境変数でゲートしない。⇒ skip するテストは緑のまま素通りし、対照の役を果たさない
//
//	(TACPENDIUM_AUDIT_DB 型の前例がある)。
//
// ★戻す行は述語で選ぶ(id や code を直書きしない)。⇒ 次の seed 波で母数が変わっても対照が生き残る。
// ★DB は newMigrator が t.TempDir() に作る使い捨てであり、他のテストへ影響しない。
func TestRun_HEAD_StartupBasisInvariantDetectorBites(t *testing.T) {
	m, db := newMigrator(t)
	defer db.Close()
	if err := m.Up(); err != nil {
		t.Fatalf("up to HEAD: %v", err)
	}
	before := scanInt(t, db, startupBasisInvariantSQL)
	if before != 0 {
		t.Fatalf("破壊前の違反 = %d, want 0(ガード側が既に赤であり、対照にならない)", before)
	}
	res, err := db.Exec(`UPDATE moves SET startup_basis = 'standalone'
		WHERE id = (SELECT min(id) FROM moves WHERE startup IS NULL AND startup_basis = 'unknown')`)
	if err != nil {
		t.Fatalf("破壊用 UPDATE: %v", err)
	}
	n, err := res.RowsAffected()
	if err != nil {
		t.Fatalf("RowsAffected: %v", err)
	}
	// ★当たった行数を必ず確かめる。⇒ 0 行に当たったまま「検出 0」を見ても、それは対照ではない。
	if n != 1 {
		t.Fatalf("破壊用 UPDATE が当たった行 = %d, want 1(対照が空振りしている)", n)
	}
	after := scanInt(t, db, startupBasisInvariantSQL)
	t.Logf("破壊確認: 違反件数 %d -> %d(1 行を 'standalone' へ戻した)", before, after)
	if after != 1 {
		t.Errorf("破壊後の違反 = %d, want 1(検出式が噛んでいない＝ガードは何も見ていない)", after)
	}
}

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

// M28-05(CHANGE なし・マイグレ 000106)の是正結果を固定する。
//
// 射程は 1 行——terry の move_code `quick_burn_light` -> `quick_burn`。
// 誤りであることの一次源は開発者のインゲーム確認(2026-09-06)であり、
// sonic_break_light -> sonic_break(M19-04c / 000063 節 A)と同型である。
//
// ★本ファイルは「件数」ではなく「v106 時点の状態」で固定する(SUPP-001 §5.5.4 (6))。
//
//	golden 4 本(000026 / 000035 / 000072 / 000073)にも同じ是正を入れてあるため、新規 DB は
//	最初から是正後の code で seed される。したがって 000106 の UPDATE は新規 DB では 1 行も
//	当たらず、それでも成功する——エラーにならない。「UPDATE が 1 行に当たった」で固定すると、
//	CI では常に 0 行になるため何も守れない。
//
// ★000106 の存在価値は「既に適用済みの DB(開発者の手元)を追随させること」だけであり、その
//
//	経路は新規 DB からは再現できない。
//	★★【M33-03】着手時点はその検証を TestRun_M2805_DownUpRoundTrip(旧 000106 の down -> re-up)
//	が受け持っていたが、名指しした版が消えたため同テストは成立せず削除した。
//	⇒ down 往復そのものは TestRun_HEAD_DownUpRoundTrip(migrate_head_test.go)が新系列に対して見る。
//
// 判定値は const に置き、テスト名には数字を埋め込まない(M14-03d §3.3-1 /
// followup `migration-version-literals-in-tests`)。
const (
	// 改名の前後。★旧 code が 0 件・新 code が 1 件を対で固定する。
	// 片方だけだと「旧が残っている」か「新が増えている」かのどちらかを取り落とす。
	m2805OldCode = "quick_burn_light"
	m2805NewCode = "quick_burn"

	// ★改名しない対。quick_burn / quick_burn_od の既存形へ合流するのが本サブの狙いであり、
	//   _od 側を巻き添えで改名していないことを対照として固定する(指示書 §3-3)。
	m2805UntouchedOD = "quick_burn_od"

	m2805Char = "terry"
)

const ()

// countCodeM2805 は指定キャラの指定 code の件数を返す。
//
// ★キャラを JOIN で絞る。moves.code はテーブル全体では一意ではなく(UNIQUE は
//
//	(character_id, code))、code だけで数えると他キャラの同名を巻き込む。
func countCodeM2805(t *testing.T, db *sql.DB, char, code string) int {
	t.Helper()
	return scanInt(t, db, `SELECT count(*) FROM moves m JOIN characters c ON c.id = m.character_id
		WHERE c.code = ? AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = ?`,
		char, code)
}

// assertRenamedM2805 は「是正後」の状態を主張する。
func assertRenamedM2805(t *testing.T, db *sql.DB) {
	t.Helper()
	for _, w := range []struct {
		code string
		want int
	}{
		{m2805OldCode, 0},
		{m2805NewCode, 1},
		{m2805UntouchedOD, 1},
	} {
		if got := countCodeM2805(t, db, m2805Char, w.code); got != w.want {
			t.Errorf("是正後の %s %s = %d 件, want %d", m2805Char, w.code, got, w.want)
		}
	}
}

// TestRun_M2805_CorrectedState は v106 時点の最終状態を固定する。
func TestRun_M2805_CorrectedState(t *testing.T) {
	m, db := newMigrator(t)
	defer db.Close()
	if err := m.Up(); err != nil {
		t.Fatalf("up to HEAD: %v", err)
	}
	assertRenamedM2805(t, db)
}

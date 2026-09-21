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

// M35-02(CHANGE なし・マイグレ 000108)の是正結果を固定する。
//
// 射程は 1 行——ryu の move_code `axe_kick_2` -> `axe_kick`。
// 誤りであることの一次源は開発者の確定(2026-09-08。逐語＝「axe_kick_2 側の方が誤り。
// axe_kick、rush_axe_kick が正しい」)であり、
// quick_burn_light -> quick_burn(M28-05 / 000106)、
// round_wave_heavy -> round_wave(M30-02 追補 / 000107)と同型である。
//
// ★★直っている実害は先例 2 本と違う。先例は「強度語の付け誤り」であり表示だけの問題だったが、
//
//	本件は **rush_axe_kick がどの入力面からも選べない** という機能欠落である。
//	web/src/features/combo/inputResolution.ts の resolveRushByCode は `rush_` + 基底 code で
//	探すため、基底が `axe_kick_2` だと `rush_axe_kick_2` を探して外れる。
//	★エラーにはならず「ラッシュ版が出ないだけ」になる。⇒ どのテストも赤くならなかった。
//
// ★★傍証が character_data/command-correction-history.md:393 に在る——同ファイルの ryu の行は
//
//	`axe_kick_2` に対する「対応 dist code」を `axe_kick` と記録している(確信度「高」)。
//	⇒ 公式データ側の識別子は `axe_kick` であり、本アプリ側だけが `_2` を持っていた。
//
// ★本ファイルは「件数」ではなく「v108 時点の状態」で固定する(SUPP-001 §5.5.4 (6) / 指示書 §4.3)。
//
//	golden 4 本(000030 / 000035 / 000072 / 000073)にも同じ是正を入れてあるため、新規 DB は
//	最初から是正後の code で seed される。したがって 000108 の UPDATE は新規 DB では 1 行も
//	当たらず、それでも成功する——エラーにならない。「UPDATE が 1 行に当たった」で固定すると、
//	CI では常に 0 行になるため何も守れない。
//
// 判定値は const に置き、テスト名には数字を埋め込まない(M14-03d §3.3-1 /
// followup `migration-version-literals-in-tests`)。
const (
	// 改名の前後。★旧 code が 0 件・新 code が 1 件を対で固定する。
	// 片方だけだと「旧が残っている」か「新が増えている」かのどちらかを取り落とす。
	m3502OldCode = "axe_kick_2"
	m3502NewCode = "axe_kick"

	// ★本サブの目的そのものを固定する対照。resolveRushByCode が探すのは
	//   `rush_` + 基底 code である。⇒ 是正後は m3502RushCode == "rush_" + m3502NewCode が
	//   実在しなければならない。★是正前は "rush_axe_kick_2" を探して外れていた。
	//
	//   ★あわせて巻き添えを見る対照でもある。rush_axe_kick は本サブで 1 文字も触らない
	//     (開発者の確定)。⇒ 是正の前後を通じて 1 件のままであることを up / down 双方で固定する。
	m3502RushCode = "rush_axe_kick"

	m3502Char = "ryu"
)

const ()

// countCodeM3502 は指定キャラの指定 code の件数を返す。
//
// ★キャラを JOIN で絞る。moves.code はテーブル全体では一意ではなく(UNIQUE は
//
//	(character_id, code))、code だけで数えると他キャラの同名を巻き込む。
func countCodeM3502(t *testing.T, db *sql.DB, char, code string) int {
	t.Helper()
	return scanInt(t, db, `SELECT count(*) FROM moves m JOIN characters c ON c.id = m.character_id
		WHERE c.code = ? AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6') AND m.code = ?`,
		char, code)
}

// assertRenamedM3502 は「是正後」の状態を主張する。
func assertRenamedM3502(t *testing.T, db *sql.DB) {
	t.Helper()
	for _, w := range []struct {
		code string
		want int
	}{
		{m3502OldCode, 0},
		{m3502NewCode, 1},
		{m3502RushCode, 1},
	} {
		if got := countCodeM3502(t, db, m3502Char, w.code); got != w.want {
			t.Errorf("是正後の %s %s = %d 件, want %d", m3502Char, w.code, got, w.want)
		}
	}
}

// TestRun_M3502_CorrectedState は v108 時点の最終状態を固定する。
func TestRun_M3502_CorrectedState(t *testing.T) {
	m, db := newMigrator(t)
	defer db.Close()
	if err := m.Up(); err != nil {
		t.Fatalf("up to HEAD: %v", err)
	}
	assertRenamedM3502(t, db)
}

// TestRun_M3502_RushIsReachable は本サブの目的そのものを固定する——
// 「resolveRushByCode(`rush_` + 基底 code)が当たる」形になっていること。
//
// ★★これが是正前に壊れていた唯一の面である。是正前は基底 code が `axe_kick_2` だったため
//
//	resolveRushByCode は `rush_axe_kick_2` を探し、実在する `rush_axe_kick` に到達できなかった。
//	★エラーにはならず null が返るだけであり、呼び出し側はそれを「データ駆動の非活性」として
//	  扱う。⇒ ラッシュ版が入力面に出ないだけで、どのテストも赤くならなかった。
//
// ★DB 側で見るのは「rush 版の code が `rush_` + 基底 code と一致すること」と
//
//	「original_move_id が基底技を指していること」の対である。前者だけだと命名が偶然
//	一致しただけの状態を通し、後者だけだとフロントから到達できない状態を通す。
func TestRun_M3502_RushIsReachable(t *testing.T) {
	m, db := newMigrator(t)
	defer db.Close()
	if err := m.Up(); err != nil {
		t.Fatalf("up to HEAD: %v", err)
	}

	// (1) resolveRushByCode が組み立てる code が実在すること。
	if got := countCodeM3502(t, db, m3502Char, "rush_"+m3502NewCode); got != 1 {
		t.Errorf("resolveRushByCode が探す %q = %d 件, want 1 (ラッシュ版へ到達できない)",
			"rush_"+m3502NewCode, got)
	}

	// (2) その rush 版の original_move_id が基底技を指していること。
	var baseCode string
	if err := db.QueryRow(`SELECT b.code FROM moves r
		JOIN characters c ON c.id = r.character_id
		JOIN moves b ON b.id = r.original_move_id
		WHERE c.code = ? AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6')
		  AND r.code = ?`, m3502Char, m3502RushCode).Scan(&baseCode); err != nil {
		t.Fatalf("%s の original_move_id を解決できない: %v", m3502RushCode, err)
	}
	if baseCode != m3502NewCode {
		t.Errorf("%s の元技 code = %q, want %q", m3502RushCode, baseCode, m3502NewCode)
	}
	// (3) (1) と (2) が同じ技を指していること＝命名と参照が一致していること。
	if "rush_"+baseCode != m3502RushCode {
		t.Errorf("命名と参照が不一致: rush_%s != %s", baseCode, m3502RushCode)
	}
}

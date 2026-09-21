package migration_test

// M31-04(SM-098・CHANGE-169 §3・マイグレ 000109)の投入結果と、確定反撃の走査への出方を固定する。
//
// ★★本ファイルの主張は 2 つあり、テストも 2 つに分けてある。
//   (1) 契約 — 000109 が何を入れたか(行・列値・alias・既存 system move の非破壊)。
//   (2) 陽性対照 — 入れる前は走査に出ず、入れた後は出ること。
//   ★(2) を (1) に混ぜないこと。「入れた」は「出る」の証拠にならない —— 走査は述語で
//     絞っており、行を入れただけでは出ないことがありうる(指示書 §4.3)。
//     ★後だけ見ても足りない。もともと出ていたのか本サブで出るようになったのかが
//     区別できないためである。
//
// ★件数リテラルで固定しない(SUPP-001 §5.5.4 (6))。行数は「sf6 キャラ数」から引き、
//   キャラが増える波が来ても本テストは直さなくてよい形にしてある。

import (
	"context"
	"database/sql"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
	punishrepo "github.com/plexiblinp/tacpendium/internal/repository/punish"
	"github.com/plexiblinp/tacpendium/internal/service/punishfinder"
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

const ()

// 投入値。★開発者の逐語(2026-09-08)と DES-002 §4 が一次源である。詳細は 000109 の up に書いた。
const (
	m3104Code    = "drive_reversal"
	m3104OnBlock = -6 // 開発者の逐語「一律ガードフレームが-6」

)

// m3104ScanCodes は 1 キャラ組の走査結果から、成立レーン / 手動確認レーンに出た相手技 code を返す。
func m3104ScanCodes(t *testing.T, db *sql.DB, self, opp int64, guard string) (accepted map[string]int, manual map[string]string) {
	t.Helper()
	svc := punishfinder.New(punishrepo.New(db), canaryEmptyLister{}, func() int64 { return 1 })
	tree, err := svc.Scan(context.Background(), punishfinder.ScanParams{
		SelfCharacterID:     self,
		OpponentCharacterID: opp,
		GuardType:           guard,
	})
	if err != nil {
		t.Fatalf("scan(guard=%s): %v", guard, err)
	}
	accepted = make(map[string]int)
	for _, n := range tree.Nodes {
		accepted[n.Code] = n.Advantage
	}
	manual = make(map[string]string)
	for _, n := range tree.ManualReviewNodes {
		manual[n.Code] = n.ReasonCode
	}
	return accepted, manual
}

// m3104Chars は sf6 キャラの id を code 順で返す。
func m3104Chars(t *testing.T, db *sql.DB) []int64 {
	t.Helper()
	rows, err := db.Query(`SELECT c.id FROM characters c
		JOIN games g ON g.id = c.game_id AND g.code = 'sf6' ORDER BY c.code`)
	if err != nil {
		t.Fatalf("characters: %v", err)
	}
	defer rows.Close()
	ids := make([]int64, 0)
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			t.Fatalf("scan id: %v", err)
		}
		ids = append(ids, id)
	}
	return ids
}

// TestRun_M3104_PunishScanPositiveControl は「入れる前は出ない / 入れた後は出る」を実測する
// (指示書 §4.3・チェックリスト C-1)。
//
// ★★走査の述語を通ることと、行が在ることは別である。punishfinder の pass 1 は
//
//	damage=0 を完全除外し、damage IS NULL / on_block IS NULL を手動確認レーンへ落とす。
//	⇒ 「行を入れた」だけでは成立レーンに出ない。本テストはそこを実測で押さえる。
//
// ★★全キャラ組で見る(1 キャラで済ませない＝チェックリスト C-3)。CROSS JOIN の投入が
//
//	一部のキャラを取りこぼしていても、1 組だけ見ていれば緑になる。
func TestRun_M3104_PunishScanPositiveControl(t *testing.T) {
	m, db := newMigrator(t)
	defer db.Close()

	// --- 前(行が無い状態): 出ないこと ---
	//
	// ★★【2026-09-13・M37-04 で変更】スキーマは HEAD まで上げ、「投入前」は行の削除で作る。
	//
	//	旧実装は v107 の DB へ*現行の* punishfinder を当てていたが、走査の投影へ列が増える
	//	たびに `no such column` で落ちる(実際 M37-04 が first_hit_startup を足して落ちた)。
	//	⇒ サービスコードは常に最新スキーマを要求するのに、DB だけ過去へ戻していた。
	//	★「v107 に行が無い / v109 に行が在る」は TestRun_M3104_UpContract が素の SQL で
	//	  押さえている。⇒ 本テストの主張は*走査の挙動*であり、版ではなく行の有無で作れる。
	if err := m.Up(); err != nil {
		t.Fatalf("migrate up: %v", err)
	}
	chars := m3104Chars(t, db)
	if len(chars) == 0 {
		t.Fatal("sf6 キャラが 0 件(テストが空回りしている)")
	}
	self := chars[0]

	// 000109 が投入した行だけを落とす。★対照(drive_parry)は残す ——
	//   「走査そのものが何も返さなくなった」のではないことを後段の JP タブ側で確かめられる。
	if _, err := db.Exec(`DELETE FROM moves WHERE code = ?`, m3104Code); err != nil {
		t.Fatalf("投入前の状態を作れない: %v", err)
	}
	if n := scanInt(t, db, `SELECT COUNT(*) FROM moves WHERE code = ?`, m3104Code); n != 0 {
		t.Fatalf("投入前の状態が作れていない(%s = %d 行)", m3104Code, n)
	}
	for _, guard := range []string{model.PunishGuardTypeBlock, model.PunishGuardTypeJustParry} {
		for _, opp := range chars {
			acc, man := m3104ScanCodes(t, db, self, opp, guard)
			if _, ok := acc[m3104Code]; ok {
				t.Fatalf("投入前の成立レーンに %s が出ている(guard=%s)", m3104Code, guard)
			}
			if _, ok := man[m3104Code]; ok {
				t.Fatalf("投入前の手動確認レーンに %s が出ている(guard=%s)", m3104Code, guard)
			}
		}
	}

	// --- 後(行が在る状態): ブロックタブに出る / ジャストパリィタブには出ない ---
	// ★行を消していない別インスタンスで見る(消した DB を作り直すより素直である)。
	m2, db2 := newMigrator(t)
	defer db2.Close()
	if err := m2.Up(); err != nil {
		t.Fatalf("migrate up: %v", err)
	}
	for _, opp := range chars {
		acc, man := m3104ScanCodes(t, db2, self, opp, model.PunishGuardTypeBlock)
		adv, ok := acc[m3104Code]
		if !ok {
			t.Fatalf("投入後のブロックタブに %s が出ていない(opponent id=%d)。手動確認レーン=%q",
				m3104Code, opp, man[m3104Code])
		}
		// ★有利フレーム = -(on_block)。-6 を入れたので +6 になる(model/punish.go)。
		if want := -m3104OnBlock; adv != want {
			t.Errorf("%s の有利フレーム = %d, want %d(opponent id=%d)", m3104Code, adv, want, opp)
		}
	}
	for _, opp := range chars {
		acc, man := m3104ScanCodes(t, db2, self, opp, model.PunishGuardTypeJustParry)
		if _, ok := acc[m3104Code]; ok {
			t.Errorf("ジャストパリィタブの成立レーンに %s が出ている(opponent id=%d)。段 3 案 b は「走査から外す」である", m3104Code, opp)
		}
		// ★手動確認レーンにも出さない。「取り扱わなくてもいい」であって
		//   「判断を人に回す」ではないため(justParryExcludedCodes の注記)。
		if reason, ok := man[m3104Code]; ok {
			t.Errorf("ジャストパリィタブの手動確認レーンに %s が出ている(reason=%s, opponent id=%d)", m3104Code, reason, opp)
		}
	}
}

package punishfinder

// M31-04(SM-098): ドライブリバーサルの走査での扱いを固定する。
//
// ★★主張は 1 つ ——「ブロックタブには出る／ジャストパリィタブには一切出ない」。
//   DB を通した実測(internal/infra/migration/migrate_m3104_test.go の陽性対照)とは別に、
//   ここでは述語だけを孤立させて見る。⇒ seed の値が将来変わっても、除外の意図は
//   このテストが持ち続ける。
//
// ★「一切出ない」は成立レーンと手動確認レーンの両方を見て初めて言える。
//   recovery を入れてあるので、除外が外れると JP タブの成立レーンに adv=27 で出る。
//   除外を入れたまま recovery を消すと、今度は手動確認レーン(data_missing)に出る。
//   ⇒ 片方だけ見ると、どちらの壊れ方も取り落とす。

import (
	"context"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
	"github.com/plexiblinp/tacpendium/internal/repository/punish"
)

// m3104Opp は 000109 が投入する値と同じ形の相手技 1 本。
func m3104Opp() []punish.ScanMove {
	return []punish.ScanMove{{
		ID:          10,
		CharacterID: oppC,
		Code:        model.MoveCodeDriveReversal,
		Category:    model.MoveCategorySystem,
		Damage:      ip(500),
		OnBlock:     ip(-6),
		Recovery:    ip(27),
	}}
}

func TestScan_DriveReversal_BlockTab_Accepted(t *testing.T) {
	svc, _ := baseSvc(m3104Opp(), punish.MovementTotals{})
	tree, err := svc.Scan(context.Background(), ScanParams{self, oppC, model.PunishGuardTypeBlock})
	if err != nil {
		t.Fatal(err)
	}
	if !shownInAccepted(tree, 10) {
		reason, ok := manualReason(tree, 10)
		t.Fatalf("ブロックタブの成立レーンに出ていない(手動確認レーン=%q, ok=%v)", reason, ok)
	}
	// ★有利フレーム = -(on_block) = +6。自技 startup=5 <= 6 なので始動技が付く。
	for _, om := range tree.Nodes {
		if om.MoveID != 10 {
			continue
		}
		if om.Advantage != 6 {
			t.Errorf("有利フレーム = %d, want 6", om.Advantage)
		}
		if len(om.Starters) == 0 {
			t.Error("始動技が 1 本も付いていない(adv=6 >= startup=5 のはず)")
		}
	}
}

func TestScan_DriveReversal_JustParryTab_Excluded(t *testing.T) {
	svc, _ := baseSvc(m3104Opp(), punish.MovementTotals{})
	tree, err := svc.Scan(context.Background(), ScanParams{self, oppC, model.PunishGuardTypeJustParry})
	if err != nil {
		t.Fatal(err)
	}
	if shownInAccepted(tree, 10) {
		t.Error("ジャストパリィタブの成立レーンに出ている(justParryExcludedCodes が効いていない)")
	}
	if reason, ok := manualReason(tree, 10); ok {
		t.Errorf("ジャストパリィタブの手動確認レーンに出ている(reason=%s)。"+
			"「取り扱わなくてもいい」であって「判断を人に回す」ではない", reason)
	}
}

// TestScan_JustParryExclusion_IsCodeScoped は除外が code 単位であることを固定する。
//
// ★★「category=system を JP タブから外した」ではないことを見る対照である。
//
//	drive_parry も category=system であり、そちらは従来どおり走査に出続けなければならない。
func TestScan_JustParryExclusion_IsCodeScoped(t *testing.T) {
	opp := []punish.ScanMove{{
		ID: 11, CharacterID: oppC, Code: "drive_parry", Category: model.MoveCategorySystem,
		Damage: ip(500), Recovery: ip(33),
	}}
	svc, _ := baseSvc(opp, punish.MovementTotals{})
	tree, err := svc.Scan(context.Background(), ScanParams{self, oppC, model.PunishGuardTypeJustParry})
	if err != nil {
		t.Fatal(err)
	}
	if !shownInAccepted(tree, 11) {
		t.Error("drive_parry が JP タブから消えている(除外が code 単位になっていない)")
	}
}

package migration_test

// セットプレイ提案の「提案結果」を実 seed 上で測る計測ハーネス。
//
// ★用途: 候補集合の射影(canary_setplay_projection_test.go)は「何が候補か」を測るが、
//
//	「提案が何件出て、どれだけ時間がかかるか」は測れない。M19-05 は合成 filler 単位で
//	探索候補を増やすため、DES-002 §4.2 が明記する次の 2 つの記述が更新を要するかを判定する:
//	  - 性能実測 = juri KA40 gap 全種別 = 4884 件 / 25.6ms(NFR001 の 100ms に余裕)
//	  - engineSafetyCap 6000 = 「実データでは非発火の後段防御」
//
// ★測定条件は M19-02 完了報告 §1.1 の表と同じにしてある(juri・KA=40・4 条件)。
//
//	そちらは engineSafetyCap を無効化した全列挙だが、本ハーネスは本番設定のまま走らせる。
//	truncated=false であれば TotalFound は全列挙値であり、4884 と直接比較できる。
//	truncated=true なら「安全上限に到達した」こと自体が答えである。
//
// ★既定ではスキップする。CI を重くしないため、環境変数 SETPLAY_PERF=1 のときだけ走る。
//
//	SETPLAY_PERF=1 go test ./internal/infra/migration/ -run TestPerf_SetplayProposals -v

import (
	"context"
	"database/sql"
	"os"
	"testing"
	"time"

	"github.com/plexiblinp/tacpendium/internal/model"
	setplayrepo "github.com/plexiblinp/tacpendium/internal/repository/setplay"
	setplaysvc "github.com/plexiblinp/tacpendium/internal/service/setplay"
)

// perfComboReader は KA と characterId だけを返す ComboReader。
type perfComboReader struct{ combo *model.Combo }

func (r perfComboReader) FindByID(ctx context.Context, id int64) (*model.Combo, error) {
	return r.combo, nil
}

// perfDupChecker は常に「未採用」を返す DuplicateChecker。
// 測定対象は探索であり、採用済み判定は seed 直後の実データでは常に空である。
type perfDupChecker struct{}

func (perfDupChecker) FindDuplicateInCombo(ctx context.Context, comboID, characterID int64, recipeHash string, excludeSetupID *int64) (*int64, error) {
	return nil, nil
}

// perfDefaultTypes は query 既定の対象種別(DES-002 §4.2)。
func perfDefaultTypes() []string {
	return []string{setplaysvc.TargetTypeNormal, setplaysvc.TargetTypeUnique, setplaysvc.TargetTypeSpecialProjectile}
}

// TestPerf_SetplayProposals は juri KA=40 の 4 条件で提案件数・truncated・所要時間を測る。
func TestPerf_SetplayProposals(t *testing.T) {
	if os.Getenv("SETPLAY_PERF") == "" {
		t.Skip("SETPLAY_PERF 未指定のためスキップ(提案結果の測定時のみ実行する)")
	}
	db := m1905DB(t)

	// juri = DES-002 §4.2 が「最大負荷」として記録しているキャラ。
	// zangief = チェーングループ員が最多(6 行 = 通常版 3 ＋ 連打版 3)＝合成単位が最も増えるキャラ。
	for _, charCode := range []string{"juri", "zangief"} {
		perfMeasureCharacter(t, db, charCode)
	}
}

func perfMeasureCharacter(t *testing.T, db *sql.DB, charCode string) {
	t.Helper()
	ctx := context.Background()

	var charID int64
	if err := db.QueryRow(`SELECT id FROM characters WHERE code=?`, charCode).Scan(&charID); err != nil {
		t.Fatalf("%s の character_id: %v", charCode, err)
	}
	ka := 40
	svc := setplaysvc.NewService(
		perfComboReader{combo: &model.Combo{ID: 1, CharacterID: charID, KnockdownAdvantage: &ka}},
		setplayrepo.New(db),
		perfDupChecker{},
	)

	cases := []struct {
		label  string
		params setplaysvc.SuggestParams
	}{
		{"meaty 既定種別", setplaysvc.SuggestParams{TargetTypes: perfDefaultTypes()}},
		{"meaty 全種別", setplaysvc.SuggestParams{TargetTypes: canarySetplayTypes()}},
		{"gap 既定種別", setplaysvc.SuggestParams{Mode: setplaysvc.ModeGap, TargetTypes: perfDefaultTypes()}},
		{"gap 全種別", setplaysvc.SuggestParams{Mode: setplaysvc.ModeGap, TargetTypes: canarySetplayTypes()}},
	}
	t.Logf("=== %s KA=%d / マイグレ HEAD ===", charCode, ka)
	for _, c := range cases {
		start := time.Now()
		res, err := svc.SuggestForCombo(ctx, 1, c.params)
		elapsed := time.Since(start)
		if err != nil {
			t.Fatalf("%s: %v", c.label, err)
		}
		t.Logf("%-14s TotalFound=%-6d returned=%-5d truncated=%-5v %v",
			c.label, res.TotalFound, len(res.Proposals), res.Truncated, elapsed.Round(time.Microsecond))
	}
}

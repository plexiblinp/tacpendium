package csvcore

// ★M37-07: starter_meaty を CSV の任意列(列末尾)として足したことのテスト。
//
// ★★新規ファイルにしてある(教訓 E-225)。同名の既存ファイルが無いことを
//   作る前に確認済み。
//
// ★本ファイルの主題は 2 つだけである:
//   (1) 往復で値が保たれること —— ★本列は重複判定キーであり、消えると
//       出力 → 取込のたびにコンボが別物へ化ける(他の任意列より落とせない)。
//   (2) **列が 1 つ少ない旧 CSV が従来どおり読めること**(後方互換)。

import (
	"strings"
	"testing"
)

// TestStarterMeatyRoundTrip は true / false / 未設定(nil)の 3 通りが往復することを見る。
//
// ★nil と false を区別して持つ理由 —— 旧 CSV(列そのものが無い)は nil で来る。
//
//	サービス層はそれを false(通常始動)として読むが、CSV 層では区別を保つ。
//	OkiVerified(M27-02b)と同じ形である。
func TestStarterMeatyRoundTrip(t *testing.T) {
	yes, no := true, false
	in := []Combo{
		draftMinimal(Combo{CharacterCode: "ryu", LocalID: "a", StarterMeaty: &yes}),
		draftMinimal(Combo{CharacterCode: "ryu", LocalID: "b", StarterMeaty: &no}),
		draftMinimal(Combo{CharacterCode: "ryu", LocalID: "c"}), // 未設定
	}
	csvText, err := ExportCSV(in)
	if err != nil {
		t.Fatalf("ExportCSV: %v", err)
	}
	// ★ヘッダに列が在ること(列末尾であること自体は column_contract_test.go が押さえる)。
	header := strings.SplitN(csvText, "\n", 2)[0]
	if !strings.Contains(header, ColStarterMeaty) {
		t.Fatalf("ヘッダに %s が無い: %s", ColStarterMeaty, header)
	}

	res, err := ParseAndValidate(csvText, Options{})
	if err != nil || res.FileError != nil {
		t.Fatalf("ParseAndValidate: err=%v fileError=%+v", err, res.FileError)
	}
	if len(res.Combos) != 3 {
		t.Fatalf("行数 = %d, want 3 (rowResults=%+v)", len(res.Combos), res.RowResults)
	}
	if got := res.Combos[0].StarterMeaty; got == nil || !*got {
		t.Errorf("true が往復していない: %v", got)
	}
	if got := res.Combos[1].StarterMeaty; got == nil || *got {
		t.Errorf("false が往復していない: %v", got)
	}
	if got := res.Combos[2].StarterMeaty; got != nil {
		t.Errorf("未設定が nil のまま往復していない: %v", got)
	}
}

// TestStarterMeatyBackwardCompatImport は **列が 1 つ少ない旧 CSV** が
// 従来どおり読めることを見る(指示書 §5-6・§4.5)。
//
// ★★ここが落ちるなら射程超過である —— 任意列として足したはずの列が
//
//	必須列になっている。旧 CSV を持つ利用者の取込が静かに壊れる。
func TestStarterMeatyBackwardCompatImport(t *testing.T) {
	// CSVColumns から starter_meaty だけを抜いた「旧 CSV」を組む。
	old := make([]string, 0, len(CSVColumns)-1)
	for _, c := range CSVColumns {
		if c != ColStarterMeaty {
			old = append(old, c)
		}
	}
	if len(old) != len(CSVColumns)-1 {
		t.Fatalf("旧 CSV の列数 = %d, want %d(陽性対照)", len(old), len(CSVColumns)-1)
	}

	csvText := strings.Join(old, ",") + "\n" +
		strings.Join(backwardCompatDraftRow(old), ",") + "\n"

	res, err := ParseAndValidate(csvText, Options{})
	if err != nil {
		t.Fatalf("旧 CSV が読めない: %v", err)
	}
	if res.FileError != nil {
		t.Fatalf("旧 CSV で FileError: %+v(任意列になっていない疑い)", res.FileError)
	}
	if len(res.Combos) != 1 {
		t.Fatalf("行数 = %d, want 1 (rowResults=%+v)", len(res.Combos), res.RowResults)
	}
	if got := res.Combos[0].StarterMeaty; got != nil {
		t.Errorf("欠損列が nil にならない: %v", got)
	}
	// ★欠損列を理由にした指摘を 1 件も出さないこと。
	for _, rr := range res.RowResults {
		for _, is := range rr.Issues {
			if is.Column == ColStarterMeaty {
				t.Errorf("旧 CSV で %s に指摘が出た: %+v", ColStarterMeaty, is)
			}
		}
	}
}

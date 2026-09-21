package csvcore

import (
	"encoding/csv"
	"strings"
	"testing"
)

// M37-05: CSV の空セルが従来どおり通ることの非退行試験(指示書 §0.4 / §5-5・
// チェックリスト E-2 / E-3)。
//
// ★★★本サブは CSV / API 経路へ新しい拒否を 1 つも足していない ——
//   開発者の逐語＝「API を直接叩く経路は基本的に想定しなくていいです」
//   「あとは異常な CSV も想定しなくていいです」(2026-09-13)。
//
// ★★★ただし「壊さない」ことは要る。⇒ 取り込みが落ちるようになったら射程超過である。
//   本テストはその床である。
//
// ★csvcore 層は正規化を持たない(補完は Create 側の normalizePositionAndMass にある)。
//   ⇒ 本層では空セルが nil のまま通ること自体を固定する。

// TestEmptyMassCells_StillParseAsNil は空セルが nil として通り、指摘も立たないことを見る。
func TestEmptyMassCells_StillParseAsNil(t *testing.T) {
	in := []Combo{draftMinimal(Combo{
		LocalID:       "c1",
		CharacterCode: "ryu",
		// ★区分は決まっているが、マス数 2 欄はどちらも空(nil)である。
		Position:          "mid_screen",
		StartPositionMass: nil,
		CarryDistanceMass: nil,
	})}

	csvText, err := ExportCSV(in)
	if err != nil {
		t.Fatalf("ExportCSV: %v", err)
	}
	res, err := ParseAndValidate(csvText, Options{})
	if err != nil {
		t.Fatalf("ParseAndValidate: %v", err)
	}
	if res.FileError != nil {
		t.Fatalf("unexpected FileError: %+v", res.FileError)
	}
	if len(res.Combos) != 1 {
		t.Fatalf("got %d combos, want 1 (rowResults=%+v)", len(res.Combos), res.RowResults)
	}

	got := res.Combos[0]
	if got.StartPositionMass != nil {
		t.Errorf("startPositionMass = %d, want nil (csvcore は補完しない)", *got.StartPositionMass)
	}
	if got.CarryDistanceMass != nil {
		t.Errorf("carryDistanceMass = %d, want nil", *got.CarryDistanceMass)
	}
	if got.Position != "mid_screen" {
		t.Errorf("position = %q, want %q", got.Position, "mid_screen")
	}

	// ★★マス数 2 列について指摘が 1 件も立たないこと(新しい拒否を足していないこと)。
	for _, rr := range res.RowResults {
		for _, is := range rr.Issues {
			if is.Column == ColStartPositionMass || is.Column == ColCarryDistanceMass {
				t.Errorf("空セルに指摘が立った: %+v", is)
			}
		}
	}
}

// TestEmptyMassCells_UnspecifiedPosition_StillParses は「不問 ＋ 空セル」も通ることを見る。
//
// ★不変条件(start_position_mass IS NULL ⇔ position = 不問)を満たす形そのものである。
func TestEmptyMassCells_UnspecifiedPosition_StillParses(t *testing.T) {
	in := []Combo{draftMinimal(Combo{
		LocalID:       "c1",
		CharacterCode: "ryu",
		Position:      "", // ★不問
	})}

	csvText, err := ExportCSV(in)
	if err != nil {
		t.Fatalf("ExportCSV: %v", err)
	}
	res, err := ParseAndValidate(csvText, Options{})
	if err != nil {
		t.Fatalf("ParseAndValidate: %v", err)
	}
	if res.FileError != nil {
		t.Fatalf("unexpected FileError: %+v", res.FileError)
	}
	if len(res.Combos) != 1 {
		t.Fatalf("got %d combos, want 1 (rowResults=%+v)", len(res.Combos), res.RowResults)
	}
	if res.Combos[0].StartPositionMass != nil {
		t.Errorf("startPositionMass = %d, want nil", *res.Combos[0].StartPositionMass)
	}
}

// TestEmptyMassCells_RawCSVText_StillParses は**利用者が渡す生の CSV テキスト**を
// 直接通す(レビュー 低-1)。
//
// ★★上の 2 本は ExportCSV の往復で空セルを作っている。⇒ ExportCSV 側の仕様が変われば
//
//	床が静かに動かなくなる。★本テストはヘッダと空セルを直接書くため、その影響を受けない。
func TestEmptyMassCells_RawCSVText_StillParses(t *testing.T) {
	// ★★ヘッダは CSVColumns から組む —— 必須列の集合は列末尾追加のたびに動くため、
	//   ここへ写経すると「列が増えた瞬間に落ちるテスト」になる。
	// ★値は数個だけ入れ、**残りはすべて空セル**にする。⇒ マス数 2 列も空である。
	filled := map[string]string{
		ColLocalID:       "c1",
		ColCharacterCode: "ryu",
		ColIsDraft:       "true",
		ColPosition:      "mid_screen",
		// ★レシピはセル内 JSON である(contract.go:56)。1 手だけ入れる。
		ColRecipe: `[{"move_code":"5lp"}]`,
	}
	cells := make([]string, 0, len(CSVColumns))
	for _, col := range CSVColumns {
		cells = append(cells, filled[col]) // ★未指定は "" = 空セル
	}
	// ★★encoding/csv で組む —— recipe のセル内 JSON はカンマと引用符を含むため、
	//   文字列連結で作ると引用が壊れ、「取り込めない CSV」を測ることになる。
	var buf strings.Builder
	w := csv.NewWriter(&buf)
	if err := w.Write(CSVColumns); err != nil {
		t.Fatalf("write header: %v", err)
	}
	if err := w.Write(cells); err != nil {
		t.Fatalf("write row: %v", err)
	}
	w.Flush()
	if err := w.Error(); err != nil {
		t.Fatalf("csv writer: %v", err)
	}
	raw := buf.String()

	res, err := ParseAndValidate(raw, Options{})
	if err != nil {
		t.Fatalf("ParseAndValidate: %v", err)
	}
	if res.FileError != nil {
		t.Fatalf("unexpected FileError: %+v", res.FileError)
	}
	if len(res.Combos) != 1 {
		t.Fatalf("got %d combos, want 1 (rowResults=%+v)", len(res.Combos), res.RowResults)
	}
	got := res.Combos[0]
	if got.StartPositionMass != nil {
		t.Errorf("startPositionMass = %d, want nil", *got.StartPositionMass)
	}
	if got.CarryDistanceMass != nil {
		t.Errorf("carryDistanceMass = %d, want nil", *got.CarryDistanceMass)
	}
	// ★★マス数 2 列に指摘が 1 件も立たないこと(新しい拒否を足していないこと)。
	for _, rr := range res.RowResults {
		for _, is := range rr.Issues {
			if is.Column == ColStartPositionMass || is.Column == ColCarryDistanceMass {
				t.Errorf("空セルに指摘が立った: %+v", is)
			}
		}
	}
}

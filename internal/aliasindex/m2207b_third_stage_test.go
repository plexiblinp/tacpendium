package aliasindex_test

import (
	"context"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/aliasindex"
	"github.com/plexiblinp/tacpendium/internal/model"
	presetrepo "github.com/plexiblinp/tacpendium/internal/repository/preset"
	"github.com/plexiblinp/tacpendium/internal/testutil/dbtest"
)

// 本ファイルは M22-07b（案 E）が足した第 3 段を固定する。
//
// # 何を解いたか
//
// SA 番号（SA1 / SA2 / SA3 / CA）は move_code そのものが持っている。⇒ preset_aliases へ
// 1 行も足さずに逆引きできる。M22-07 は同じものを「辞書へ行を足す」形で解こうとして、
// UNIQUE (preset_id, move_id)（DES-003 §3.9 制約①＝1 技 1 表記）に阻まれて 0 行で終わった。
//
// # 本ファイルが守るもの
//
//	§5.1-1 SA 番号の表記が解決する（一意な組）
//	§5.1-2 多義の組は確定せず、候補として返る
//	§5.1-3 ★前 2 段が 1 件以上を返すとき、第 3 段が引かれない（構造そのものを主張する）
//	§5.1-4 状態接頭辞を持つ move_code も拾う
//	§5.1-5 preset_aliases の行数が変わっていない
//
// ★件数の正本は m2207_baseline_test.go の母集合 X（確定 53 / 候補 15 / 該当なし 8）である。
// 本ファイルは「なぜそうなるか」の性質を主張し、件数は重複して持たない（E-136）。

func ptrEn(s string) *string { return &s }

// TestThirdStage_ResolvesUniqueSANumber は §5.1-1。
func TestThirdStage_ResolvesUniqueSANumber(t *testing.T) {
	// 辞書側は SA 番号を 1 行も持たない（案 E の前提そのもの）。
	ix := aliasindex.Build([]model.AliasEntry{
		{MoveCode: "sa1_shinku_hadoken", AliasText: "236236P (SA1)"},
		{MoveCode: "sa2_shin_shoryuken", AliasText: "214214P (SA2)"},
	})

	got := ix.Lookup("SA1")
	if len(got) != 1 || got[0] != "sa1_shinku_hadoken" {
		t.Errorf("素の SA1 が 1 件で確定しない: %v", got)
	}
	// 大文字小文字を畳む（利用者は "sa1" とも書く）。
	if lower := ix.Lookup("sa1"); len(lower) != 1 || lower[0] != "sa1_shinku_hadoken" {
		t.Errorf("小文字の sa1 が引けない: %v", lower)
	}
	// 対照: 当該キャラが持たない番号は当たらない。
	if none := ix.Lookup("SA3"); len(none) != 0 {
		t.Errorf("持たない番号が当たった: %v", none)
	}
}

// TestThirdStage_AmbiguousGroupStaysUnconfirmed は §5.1-2。
//
// ★案 E を選んだ理由の 1 つがこれである（指示書 §4.5）。A / B / C は DES-004 §5.5 の
// 「衝突組は両方落とす」に当たって多義の組を捨てるが、E は候補として人へ返す。
// ⇒ 「解決できないから落とす」形にしていないことを主張する。
func TestThirdStage_AmbiguousGroupStaysUnconfirmed(t *testing.T) {
	// ryu の実データと同じ形（素の SA1 と、電刃をためた SA1 が同居する）。
	ix := aliasindex.Build([]model.AliasEntry{
		{MoveCode: "sa1_shinku_hadoken", AliasText: "236236P (SA1)"},
		{MoveCode: "denjin_charge_sa1_shinku_hadoken", AliasText: "236236P (SA1)電"},
	})

	got := ix.Lookup("SA1")
	if len(got) != 2 {
		t.Fatalf("多義の組が 2 件で返らない: %v(捨てていないか、確定していないかを確かめること)", got)
	}
	// ★昇順で両方返る。呼び出し側（internal/service/intake）の「1 件のときだけ確定」により
	// 未確定へ倒れ、候補として人へ提示される。
	if got[0] != "denjin_charge_sa1_shinku_hadoken" || got[1] != "sa1_shinku_hadoken" {
		t.Errorf("候補の中身が想定と違う: %v", got)
	}
}

// TestThirdStage_DoesNotOverrideEarlierStages は §5.1-3。★本サブで最も重要なテストである。
//
// ★「いま 0 件だから通っている」形にしていない。第 1 段・第 2 段が当たるキーを、
// 第 3 段も別の答えで持っている索引を組み、★前段の答えが返ることを主張する。
// ⇒ 段の順序を入れ替えたら、このテストは必ず赤くなる（破壊確認 A）。
//
// ★実データには "SA1" という alias_text が 1 行も無いため、実データだけを見る検査では
// この不変条件を検出できない。合成 fixture が要るのはそのためである。
func TestThirdStage_DoesNotOverrideEarlierStages(t *testing.T) {
	// 第 1 段が "sa1" を持つ（利用者が作ったカスタムプリセットで "SA1" と名付けた想定）。
	// 同時に第 3 段も "sa1" を持つ（sa1_ の move が居るため）。
	ix := aliasindex.Build([]model.AliasEntry{
		{MoveCode: "some_other_move", AliasText: "SA1"},
		{MoveCode: "sa1_shinku_hadoken", AliasText: "236236P (SA1)"},
	})

	// 第 1 段の答えが返ること。第 3 段の答え(sa1_shinku_hadoken)で上書きされていないこと。
	got := ix.Lookup("SA1")
	if len(got) != 1 || got[0] != "some_other_move" {
		t.Errorf("★第 1 段の答えが第 3 段に上書きされた: %v"+
			"(段の順序が壊れている＝チェックリスト §9-2 の重大)", got)
	}
	// 対照: 第 3 段はちゃんと別の答えを持っている（持っていなければ上の主張が空振りする）。
	if third := ix.LookupSANumber("SA1"); len(third) != 1 || third[0] != "sa1_shinku_hadoken" {
		t.Fatalf("第 3 段が別の答えを持っていない: %v(この対照が無いと上の主張は空振りする)", third)
	}

	// 第 2 段についても同じ形を作る。
	// 辞書側だけ注記を落とした索引が "sa2" を持ち、第 3 段も "sa2" を持つ状況。
	ix2 := aliasindex.Build([]model.AliasEntry{
		{MoveCode: "relaxed_stage_move", AliasText: "SA2 (CA)"},
		{MoveCode: "sa2_shin_shoryuken", AliasText: "214214P (SA2)"},
	})
	if strict := ix2.LookupStrict("SA2"); len(strict) != 0 {
		t.Fatalf("第 1 段が SA2 を持っている(第 2 段の対照にならない): %v", strict)
	}
	got2 := ix2.Lookup("SA2")
	if len(got2) != 1 || got2[0] != "relaxed_stage_move" {
		t.Errorf("★第 2 段の答えが第 3 段に上書きされた: %v"+
			"(段の順序が壊れている＝チェックリスト §9-2 の重大)", got2)
	}
}

// TestThirdStage_PicksUpStatePrefixedMoveCodes は §5.1-4。
//
// ★落とすと、同じ番号を持つ組が多義でないように見え、「確定してはならないものを確定する」
// という最も悪い形になる（指示書 §4.2）。M22-07 の分類テストが実データ 10 行で同じ固定を
// 持っているが、こちらは第 3 段の索引側で主張する。
func TestThirdStage_PicksUpStatePrefixedMoveCodes(t *testing.T) {
	prefixed := []string{
		"denjin_charge_sa1_shinku_hadoken",
		"flame_sa2_chou_hissatsu_shinobi_bachi",
		"fuha_sa1_sakkai_fuhazan",
		"windclad_sa2_thunderbird",
	}
	for _, code := range prefixed {
		ix := aliasindex.Build([]model.AliasEntry{{MoveCode: code, AliasText: "x"}})
		num := "SA1"
		if code == "flame_sa2_chou_hissatsu_shinobi_bachi" || code == "windclad_sa2_thunderbird" {
			num = "SA2"
		}
		if got := ix.LookupSANumber(num); len(got) != 1 || got[0] != code {
			t.Errorf("状態接頭辞つきの move_code を第 3 段が拾えない: %s → %v", code, got)
		}
	}

	// 対照: SA / CA を含まない move_code は拾わない（索引が何にでも当たる状態ではない）。
	ix := aliasindex.Build([]model.AliasEntry{{MoveCode: "standing_light_punch", AliasText: "5LP"}})
	for _, num := range saNumbers {
		if got := ix.LookupSANumber(num); len(got) != 0 {
			t.Errorf("SA でない move_code が %s で当たった: %v", num, got)
		}
	}
}

// TestThirdStage_AliasRowCountUnchanged は §5.1-5。
//
// ★案 E の核心は「辞書に触らない」ことである。行が増えていたら前提が崩れている
// （チェックリスト §9-4 の重大）。
func TestThirdStage_AliasRowCountUnchanged(t *testing.T) {
	db := dbtest.Setup(t)

	var rows int
	if err := db.QueryRowContext(context.Background(),
		`SELECT count(*) FROM preset_aliases`).Scan(&rows); err != nil {
		t.Fatalf("count preset_aliases: %v", err)
	}

	// ★実測値で固定する（M22-07 / M22-07b とも 1 行も増減させていない）。
	//
	// ★★M14-03f(第四波 seed・2026-09-02)で 4184 → 7597 になった。★これは案 E が辞書へ
	//   足したのではなく、seed 波が新キャラ 14 体分の辞書を足したためである。
	//   ⇒ 本テストが守っているのは「案 E(第 3 段)が辞書に触らない」であって
	//     「preset_aliases が永久に 4184 行である」ではない。seed 波のたびに更新する。
	//   ★案 E が足していないことの直接の証拠は、下の「素の SA 番号の行 0 行」である。
	//     こちらは seed 波が増えても 0 のままでなければならない。
	// ★alias_text_en を持つ行は 160 行(第四波で 102 → 160。層 C-3 の 5 件 × 2 プリセット ＋
	//   移動系 micro_forward / micro_back の英語表記 × 新 12 キャラ × 2 プリセット の増分)。
	// ★★M14-03f 第三段(2026-09-04・000097)で 7597 → 7598 になった。増分は 1 行だけで、
	//   ダルシムの連打版 crouching_light_punch_rapid に対の official_ja_move alias である
	//   (連打版は moves に無い技を新規登録するため。ザンギエフの 3 行＝000051 と同型)。
	//   ここでも案 E は 1 行も足していない。
	// ★★M31-04(2026-09-10・000109)で 7598 → 7629 になった。増分は 31 行＝
	//   ドライブリバーサル(全キャラ 1 行の system move)に対の official_ja_move alias である。
	//   ここでも案 E は 1 行も足していない(下の「素の SA 番号の行 0 行」が引き続き 0)。
	// ★★M35-03(2026-09-11・golden 000072/000073 の再生成)で 7629 → 7635 になった。
	//   増分は 8 行＝rush 4 件(ingrid 2 / lily 1 / mai 1)× numeric / srk の 2 プリセット。
	//   CSV の original_move_code が実在しない move_code を指していた 4 件を是正した結果、
	//   生成器が元技を解決できるようになり「DR > <元技の表記>」を合成した(D-311)。
	//   ★seed 波ではないが「辞書側が増えた」という点では同じ性質であり、本テストが
	//     守る主張(案 E が辞書に触らない)は変わらない。
	//   ★★【2026-09-13・M37-04 追補2】7637 -> 7635。chun_li soaring_eagle_punches を
	//     elena soaring_raid と同じ「空中限定ターゲットコンボ」の形へ揃えた際に
	//     is_derived を false -> true にしたため、同行が numeric / srk の 2 プリセットから
	//     外れた(段階2 の解決索引と同じ規則＝DES-004 §2.4)。⇒ 2 行の減である。
	//     ★soaring_raid / satelite_leap は元から辞書に居ない。⇒ 揃った結果である。
	const wantRows = 7635
	if rows != wantRows {
		t.Errorf("preset_aliases の行数 = %d, want %d"+
			"(案 E は辞書へ 1 行も足さない＝チェックリスト §9-4)", rows, wantRows)
	}

	// 素の SA 番号を alias_text に持つ行が 0 行であること（第 3 段は辞書由来ではない）。
	var saRows int
	if err := db.QueryRowContext(context.Background(),
		`SELECT count(*) FROM preset_aliases
		 WHERE alias_text IN ('SA1','SA2','SA3','CA')
		    OR alias_text_en IN ('SA1','SA2','SA3','CA')`).Scan(&saRows); err != nil {
		t.Fatalf("count bare SA rows: %v", err)
	}
	if saRows != 0 {
		t.Errorf("素の SA 番号の行が %d 行ある(第 3 段は規則であって辞書ではない)", saRows)
	}

	t.Logf("preset_aliases %d 行 / 素の SA 番号の行 %d 行", rows, saRows)
}

// TestThirdStage_RealDataResolvesWithoutDictionaryRows は実データでの疎通。
//
// ★合成 fixture だけだと「実データでも効く」を主張できない。母集合 X の件数は
// m2207_baseline_test.go が持つため、ここでは 1 キャラの実例だけを見る。
func TestThirdStage_RealDataResolvesWithoutDictionaryRows(t *testing.T) {
	db := dbtest.Setup(t)
	repo := presetrepo.New(db)

	entries, err := repo.ListAliasEntriesByCharacter(context.Background(), "ken")
	if err != nil {
		t.Fatalf("ListAliasEntriesByCharacter: %v", err)
	}
	ix := aliasindex.Build(entries)

	// ken は SA1 / SA2 / SA3 / CA をそれぞれ 1 技ずつ持つ（多義が無いキャラ）。
	for _, num := range saNumbers {
		got := ix.Lookup(num)
		if len(got) != 1 {
			t.Errorf("ken の %s が 1 件で確定しない: %v", num, got)
			continue
		}
		// 第 1 段から来ていないこと（辞書に行が無いことの裏取り）。
		if strict := ix.LookupStrict(num); len(strict) != 0 {
			t.Errorf("ken の %s が第 1 段から来ている: %v", num, strict)
		}
		t.Logf("ken %s → %s（辞書に行を持たずに解決）", num, got[0])
	}
}

// 未使用の補助を避けるための参照（英語表記つきの行でも第 3 段が move_code から導くこと）。
func TestThirdStage_UsesMoveCodeNotAliasText(t *testing.T) {
	// alias_text / alias_text_en のどちらにも SA 番号が入っていないのに引ける。
	ix := aliasindex.Build([]model.AliasEntry{
		{MoveCode: "sa3_shinryu_reppa", AliasText: "236236K (SA3)", AliasTextEn: ptrEn("Shinryu Reppa")},
	})
	if got := ix.Lookup("SA3"); len(got) != 1 || got[0] != "sa3_shinryu_reppa" {
		t.Errorf("move_code からの導出になっていない: %v", got)
	}
}

// TestThirdStage_ShapeOnRealData は第 3 段が実データで「何を持っているか」を形まで主張する
// （DES-004 §5.0.2 規約 4「緩い段が持つ同一視は、形まで主張する」）。
//
// ★★なぜ要るか——第 3 段は move_code だけを見ており、category を見ていない。
// 対する seedgen.saAnnotation は super_art / critical_art に限定しており、★非対称である。
// 実データでは規則に当たる move が SA / CA の全数と一致するため現時点で無害だが、
// 「一致している」ことを主張するものが無いと、将来 category 外の move_code が
// sa1_ / ca_ の形を持ち込んだときに、★第 3 段だけが黙ってそれを拾う。
//
// ⇒ 一致そのものを固定する。ずれたら赤くなり、そのとき非対称を設計判断へ戻せる。
func TestThirdStage_ShapeOnRealData(t *testing.T) {
	db := dbtest.Setup(t)

	// 規則に当たる move を category 別に数える（第 3 段が索引へ入れる母集合そのもの）。
	const q = `
SELECT m.category, count(*)
FROM moves m
WHERE m.code GLOB '*sa[123]_*' OR m.code GLOB 'sa[123]_*'
   OR m.code GLOB '*_ca_*'     OR m.code GLOB 'ca_*'
GROUP BY m.category
ORDER BY m.category`

	rows, err := db.QueryContext(context.Background(), q)
	if err != nil {
		t.Fatalf("category 別の集計: %v", err)
	}
	defer rows.Close()

	byCategory := make(map[string]int)
	for rows.Next() {
		var cat string
		var n int
		if err := rows.Scan(&cat, &n); err != nil {
			t.Fatalf("scan: %v", err)
		}
		byCategory[cat] = n
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("rows: %v", err)
	}

	// ★形の主張: 当たるのは super_art と critical_art だけであり、他の category は 0 である。
	for cat, n := range byCategory {
		if cat != "super_art" && cat != "critical_art" {
			t.Errorf("★SA / CA 以外の category が第 3 段の規則に当たった: category=%s %d 件"+
				"(seedgen.saAnnotation は category で絞っており、第 3 段だけが拾う形になっている)",
				cat, n)
		}
	}

	// ★件数の主張: SA / CA の全数と一致する（取りこぼしも誤当たりも無い）。
	// ★★M14-03f(第四波 seed)で 79 → 138 / 17 → 32 になった。新キャラ 14 体分の SA / CA が
	//   増えた分である。★下の「SA / CA の総数と一致する」対照が、増分が取りこぼしでも
	//   誤当たりでもないことを同じ手番で主張している。
	const (
		wantSuperArt    = 138
		wantCriticalArt = 32
	)
	if got := byCategory["super_art"]; got != wantSuperArt {
		t.Errorf("super_art の当たり = %d, want %d", got, wantSuperArt)
	}
	if got := byCategory["critical_art"]; got != wantCriticalArt {
		t.Errorf("critical_art の当たり = %d, want %d", got, wantCriticalArt)
	}

	// 対照: category が super_art / critical_art である move の総数と一致すること。
	var total int
	if err := db.QueryRowContext(context.Background(),
		`SELECT count(*) FROM moves WHERE category IN ('super_art','critical_art')`).Scan(&total); err != nil {
		t.Fatalf("count SA/CA moves: %v", err)
	}
	if hit := byCategory["super_art"] + byCategory["critical_art"]; hit != total {
		t.Errorf("★規則に当たる件数 %d が SA / CA の総数 %d と一致しない"+
			"(取りこぼしがあると、その技だけ第 3 段で引けない)", hit, total)
	}

	t.Logf("第 3 段の形: super_art %d / critical_art %d / 他 category 0（SA・CA の総数 %d と一致）",
		byCategory["super_art"], byCategory["critical_art"], total)
}

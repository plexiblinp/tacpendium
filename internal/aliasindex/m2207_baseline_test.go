package aliasindex_test

import (
	"context"
	"strings"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/aliasindex"
	"github.com/plexiblinp/tacpendium/internal/aliasnorm"
	presetrepo "github.com/plexiblinp/tacpendium/internal/repository/preset"
	"github.com/plexiblinp/tacpendium/internal/testutil/dbtest"
)

// 本ファイルは M22-07 §4.1「増やす前に測る」の基準値を、逆引きの実装そのもので固定する
// (SUPP-001 §5.5 (11″)。自作の近似で数えると、実装と違う母集合を数えたまま、
// もっともらしい件数を返して気づけない)。
//
// ★測る対象は 2 つの母集合である。何を・どの単位で数えたかを併記する(E-93 / E-16)。
//
//	母集合 X … SA 番号の素の表記。全キャラ × SA1 / SA2 / SA3 / CA を引く。
//	            ★当該キャラが持たない SA 番号も引く(持たない番号も解決してはならない)。
//	母集合 Y … DB 内の既存 alias_text / alias_text_en の全数。増やす作業の非回帰の対照。
//
// ★「解決」の定義は本番の確定規則に合わせる——internal/service/intake が
// 「Lookup の返りが 1 件のときだけ確定」としているため、本ファイルも Lookup(全段) の
// 返りがちょうど 1 件のときだけ解決と数える。第 1 段だけ(LookupStrict)で数えると、
// 「第 2 段の衝突で既存まで落ちる」経路(M22-07 指示書 §4.3-4 が (b) の主経路と名指しした形)を
// 原理的に検出できない。★M22-07b で Lookup は 3 段になったが、本ファイルは段数を数えず
// 「本番と同じ Lookup を通す」ことだけを守る——段が増えるたびに書き換えずに済む形にしてある。
//
// ★★件数の分担(M22-07b で明確化)。同じ 53 / 15 が 2 か所に出るが、主張は別物である。
//
//	internal/seedgen の分類テスト … CSV 行を (キャラ, SA 番号) の組へ畳んだ「分類」の件数。
//	                                 一意 53 組 / 多義 15 組。★源は CSV である
//	本ファイル(母集合 X)           … 実 DB の索引を本番の Lookup で引いた「解決結果」の件数。
//	                                 確定 53 / 候補どまり 15。★源は DB と実装である
//
// ⇒ 二重化ではなく相互照合である。分類が正しくても索引の組み方を誤れば本ファイルが赤くなり、
// 逆もまた同じ。★片方だけ直すと必ず食い違うため、どちらかが嘘になったまま緑にならない
// (seedgen 側のエラーメッセージも「internal/aliasindex の基準値テストと食い違っている」と書く)。

// saNumbers は素の SA 番号の表記(母集合 X の軸)。
var saNumbers = []string{"SA1", "SA2", "SA3", "CA"}

// TestBaseline_X_SANumberNotationsAfterThirdStage は母集合 X の状態を固定する。
//
// ★★本テストは M22-07 では「全数が未確定」を主張していた(関数名も …AreUnresolved だった)。
// M22-07b が第 3 段を入れて、その基準値を動かした——それが本サブの成果そのものである
// (指示書 M22-07b §4.4「M22-07 は (c) 0 で終わっている。本サブは (c) を 0 から動かす」)。
//
// ★主張を落としていない。母集合(全キャラ × SA1/SA2/SA3/CA)は同じままで、内訳を
// 「確定 / 多義で候補 / 該当なし」の 3 つに割って固定した。⇒ 以下がいずれも赤を出す。
//
//	・確定していたものが確定しなくなった   … (b) 解決しなくなった入力
//	・多義の組が確定するようになった       … 指示書 §4.5 / チェックリスト §9-3(重大)
//	・当該キャラが持たない番号が当たった   … 第 3 段が別キャラの move を引いている
func TestBaseline_X_SANumberNotationsAfterThirdStage(t *testing.T) {
	db := dbtest.Setup(t)
	repo := presetrepo.New(db)

	chars := allCharacterCodes(t, db)
	if len(chars) == 0 {
		t.Fatal("キャラが 0 件(検査が対象を見ていない)")
	}

	var probes, confirmed, candidates, none int
	for _, charCode := range chars {
		entries, err := repo.ListAliasEntriesByCharacter(context.Background(), charCode)
		if err != nil {
			t.Fatalf("ListAliasEntriesByCharacter(%q): %v", charCode, err)
		}
		ix := aliasindex.Build(entries)

		for _, notation := range saNumbers {
			probes++
			// ★本番と同じ確定規則で数える(1 件のときだけ確定)。
			switch codes := ix.Lookup(notation); {
			case len(codes) == 1:
				confirmed++
			case len(codes) > 1:
				candidates++
			default:
				none++
			}
		}
	}

	// ★実測値で固定する(件数の正本はここ 1 か所＝E-136 / SUPP-001 §5.5.3.1)。
	//
	//	確定 98 … (キャラ, SA 番号) が 1 技に定まる組。これが (c) 新たに解決した入力である
	//	候補 26 … 同一キャラに同じ番号の技が複数ある組。★確定させない(DES-004 §5.0.2 規約 1)
	//	なし   0 … 当該キャラがその番号を持たない組
	//
	// ★★M14-03f(第四波 seed・2026-09-02)で 19 → 31 キャラになり、母集合が 76 → 124 通りへ増えた。
	//   ⇒ 確定 53 → 98 / 候補 15 → 26 / なし 8 → 0。
	// ★「なし」が 0 になったのは、旧記述の「c_viper / dhalsim は SA / CA を 1 つも持たない」が
	//   失効したためである。両者は 000014 以来の仮登録(移動 9 種のみ)だったが、第四波で
	//   攻撃技が入り SA / CA も持つようになった。⇒ 8 通りすべてが当たるようになった。
	// ★増えたこと自体は正である。減っていたら (b)解決しなくなった / (§9-3)多義を確定させた
	//   のどちらかであり、そちらが重大である。
	const (
		wantProbes     = 124
		wantConfirmed  = 98
		wantCandidates = 26
		wantNone       = 0
	)
	if probes != wantProbes {
		t.Errorf("母集合 X の通り数 = %d, want %d", probes, wantProbes)
	}
	if confirmed != wantConfirmed {
		t.Errorf("確定した通り数 = %d, want %d(減っていれば (b) 解決しなくなった入力である)",
			confirmed, wantConfirmed)
	}
	if candidates != wantCandidates {
		t.Errorf("候補どまりの通り数 = %d, want %d"+
			"(減っていれば多義の組を確定させている＝チェックリスト §9-3 の重大)",
			candidates, wantCandidates)
	}
	if none != wantNone {
		t.Errorf("当たらなかった通り数 = %d, want %d", none, wantNone)
	}

	t.Logf("母集合 X: キャラ %d × 表記 %d = %d 通り / 確定 %d / 候補どまり %d / 該当なし %d"+
		"(M22-07 時点は 確定 0 / 該当なし 76。M14-03f 直前は 確定 53 / 該当なし 8 だった)",
		len(chars), len(saNumbers), probes, confirmed, candidates, none)
	if probes == 0 {
		t.Fatal("1 通りも引いていない(検査が空回りしている)")
	}
}

// TestBaseline_X_PositiveControl は 3 つの段がそれぞれ別の入力に効いていることを示す対照である。
//
// ★M22-07 の時点では「素の SA 番号は当たらない」が第 3 の主張だった。M22-07b が第 3 段を
// 入れたため、いまは「当たる。ただし第 1 段・第 2 段からではない」を主張する。
// ⇒ 3 つの段が別々の入力を受け持っていることが、1 つのキャラの 1 つの索引の上で示される。
func TestBaseline_X_PositiveControl(t *testing.T) {
	db := dbtest.Setup(t)
	repo := presetrepo.New(db)

	// 注記つきの既存 alias_text を 1 件、実データから取る(値を書き写さない)。
	const q = `
SELECT c.code, pa.alias_text
FROM preset_aliases pa
JOIN moves m ON m.id = pa.move_id
JOIN characters c ON c.id = m.character_id
WHERE pa.alias_text LIKE '% (SA1)'
ORDER BY c.code, pa.alias_text
LIMIT 1`

	var charCode, aliasText string
	if err := db.QueryRowContext(context.Background(), q).Scan(&charCode, &aliasText); err != nil {
		t.Fatalf("注記つきの alias_text を取得できなかった: %v", err)
	}

	entries, err := repo.ListAliasEntriesByCharacter(context.Background(), charCode)
	if err != nil {
		t.Fatalf("ListAliasEntriesByCharacter(%q): %v", charCode, err)
	}
	ix := aliasindex.Build(entries)

	// (1) 注記つきのまま引けば第 1 段で当たる。
	if codes := ix.LookupStrict(aliasText); len(codes) != 1 {
		t.Errorf("注記つきの表記が第 1 段で 1 件に解決しない: char=%s 表記=%q → %v",
			charCode, aliasText, codes)
	}
	// (2) 注記を落とした形は第 2 段で当たる(1 件とは限らない。CA vs SA3 の組があるため)。
	bare := strings.TrimSuffix(aliasText, " (SA1)")
	if codes := ix.Lookup(bare); len(codes) == 0 {
		t.Errorf("注記を落とした表記が 1 件も当たらない: char=%s 表記=%q(第 2 段が効いていない疑い)",
			charCode, bare)
	}
	// (3) 素の SA 番号は第 3 段で当たる(M22-07b)。
	saCodes := ix.Lookup("SA1")
	if len(saCodes) == 0 {
		t.Errorf("素の SA 番号が 1 件も当たらない: char=%s(第 3 段が効いていない疑い)", charCode)
	}
	// (3') ★その答えが第 1 段・第 2 段から来ていないことを示す。
	//      来ていたら、それは辞書に "SA1" という行が在るということであり、案 E の前提が崩れている。
	if codes := ix.LookupStrict("SA1"); len(codes) != 0 {
		t.Errorf("素の SA 番号が第 1 段で当たった: char=%s → %v"+
			"(辞書に行が入っている＝案 E の前提が崩れている)", charCode, codes)
	}
	if codes := ix.LookupSANumber("SA1"); len(codes) == 0 {
		t.Errorf("第 3 段が SA1 を持っていない: char=%s", charCode)
	}

	t.Logf("陽性対照: char=%s / 第 1 段 %q は解決 / 第 2 段 %q も解決 / 第 3 段 \"SA1\" → %v",
		charCode, aliasText, bare, saCodes)
}

// TestBaseline_Y_ExistingNotationsAllResolve は母集合 Y の基準値を固定する。
//
// ★これが §4.3-2 の (a) 答えが変わった入力 / (b) 解決しなくなった入力 を守る対照である。
// 辞書へ行を足す作業は、足した瞬間に既存の答えを変えうる——衝突組は両方落とされるため
// (DES-004 §5.5)、増やした行が既存と衝突すると既存まで解決しなくなる。
// ⇒ 「既存の表記が全数 1 件で確定する」を先に固定しておかないと、壊れたことに気づけない。
//
// ★本番と同じ Lookup(全段)で引く。第 1 段だけで数えると、増やした行が第 2 段の衝突を
// 増やして既存を落とす形(M22-07 指示書 §4.3-4 の主経路)に当たらない。
func TestBaseline_Y_ExistingNotationsAllResolve(t *testing.T) {
	db := dbtest.Setup(t)
	repo := presetrepo.New(db)

	chars := allCharacterCodes(t, db)
	if len(chars) == 0 {
		t.Fatal("キャラが 0 件(検査が対象を見ていない)")
	}

	var total, resolvedOne, empty, notOne int
	for _, charCode := range chars {
		entries, err := repo.ListAliasEntriesByCharacter(context.Background(), charCode)
		if err != nil {
			t.Fatalf("ListAliasEntriesByCharacter(%q): %v", charCode, err)
		}
		ix := aliasindex.Build(entries)

		// 索引へ入るのと同じ単位で引く(1 行が日本語と英語の 2 表記を持てば 2 回引く)。
		texts := make([]string, 0, len(entries)*2)
		for _, e := range entries {
			texts = append(texts, e.AliasText)
			if e.AliasTextEn != nil {
				texts = append(texts, *e.AliasTextEn)
			}
		}

		for _, text := range texts {
			// 正規化して空になる表記は索引へ入らない(aliasindex.add)。母集合から外し、
			// 件数を出す——黙って除くと「全数を見た」が嘘になる。
			if aliasnorm.Normalize(text) == "" {
				empty++
				continue
			}
			total++
			codes := ix.Lookup(text)
			if len(codes) == 1 {
				resolvedOne++
				continue
			}
			notOne++
			t.Errorf("既存の表記が 1 件に確定しない: char=%s 表記=%q → %v",
				charCode, text, codes)
		}
	}

	t.Logf("母集合 Y: キャラ %d / 表記 %d / 1 件で確定 %d / 1 件でない %d / 正規化後に空 %d",
		len(chars), total, resolvedOne, notOne, empty)
	if total == 0 {
		t.Fatal("表記を 1 つも引いていない(検査が空回りしている)")
	}
}

// TestBaseline_Y_RelaxedCollisionBaseline は第 2 段の衝突組数を基準値として固定する。
//
// ★これが指示書 §4.3-4 が名指しした「(b) 解決しなくなった入力が 0 でなくなる主な経路」の
// 直接の検出器である。増やした行が既存と同じ緩和キーへ落ちると第 2 段の衝突組が増え、
// その組に属する既存の表記は「複数件 → 未確定」へ倒れる。
//
// ★組数そのものに意味があるのではなく、増えないことに意味がある。
// 投入するサブは、この数が増えていないことを示すこと。
func TestBaseline_Y_RelaxedCollisionBaseline(t *testing.T) {
	db := dbtest.Setup(t)
	repo := presetrepo.New(db)

	chars := allCharacterCodes(t, db)
	var groups int
	for _, charCode := range chars {
		entries, err := repo.ListAliasEntriesByCharacter(context.Background(), charCode)
		if err != nil {
			t.Fatalf("ListAliasEntriesByCharacter(%q): %v", charCode, err)
		}
		groups += len(aliasindex.Build(entries).RelaxedCollisions())
	}

	// ★実測値で固定する。既知の形は CA vs SA3 だけであり、その主張は
	// TestRealData_RelaxedStageCollisionsAreOnlyCAvsSA3 が持つ。本テストは数を持つ。
	//
	// ★★M14-03f(第四波 seed・2026-09-02)で 17 → 31 になった。★これは「増えてはいけない」に
	//   当たらない。組数は「SA / CA を持つキャラ数」と一致しており、その内訳は
	//   1 キャラにつき CA vs SA3 の 1 組である(上記の対テストが形を主張している)。
	//     M14-03f 直前 … 19 キャラ - SA/CA を持たない 2 体(c_viper / dhalsim の仮登録)= 17
	//     M14-03f 直後 … 31 キャラ全員が SA / CA を持つ = 31
	// ★本テストが検出したいのは「新しい形の衝突が増えること」である。⇒ 数の増加が
	//   キャラ数の増加で説明できないときに疑うこと。説明できるなら、対テストが形を守っている。
	const wantGroups = 31
	if groups != wantGroups {
		t.Errorf("第 2 段の衝突組数 = %d, want %d"+
			"(増えているなら、増やした行が既存の緩和キーと衝突している=指示書 §4.3-4)",
			groups, wantGroups)
	}
	t.Logf("第 2 段の衝突組数 %d(基準値)", groups)
}

// TestBaseline_ThreeCountsOfThisSub は「辞書に素の SA 番号の行が 1 行も無いこと」を固定する。
//
// ★★M22-07b で役割が変わった。以下は履歴として残す(名前は据え置き=参照の追跡のため)。
//
//	M22-07  … 3 数値が (a) 0 / (b) 0 / (c) 0 であることの根拠だった。行を 1 行も投入できず、
//	          母集合 X が全数未確定のままだったため、(c) 0 は「増やせなかった」を意味した
//	M22-07b … ★(c) は 0 → 53 へ動いた(母集合 X のテストが持つ)。⇒ 本テストが 3 数値の
//	          根拠であることをやめ、★案 E の前提そのものの番人になった
//
// ★いまの主張——「第 3 段は規則であって辞書ではない」。素の SA 番号が解決するのに
// preset_aliases には 1 行も無い、という状態が保たれていることを実データで確かめる。
// ⇒ ここが赤くなったら、誰かが辞書へ行を足したということであり、案 E の前提が崩れている
// (M22-07b チェックリスト §9-4 の重大)。
func TestBaseline_ThreeCountsOfThisSub(t *testing.T) {
	db := dbtest.Setup(t)

	// 投入していないことを実データで主張する: 素の SA 番号を持つ行は 0 行。
	const q = `
SELECT count(*)
FROM preset_aliases
WHERE alias_text IN ('SA1', 'SA2', 'SA3', 'CA')
   OR alias_text_en IN ('SA1', 'SA2', 'SA3', 'CA')`

	var n int
	if err := db.QueryRowContext(context.Background(), q).Scan(&n); err != nil {
		t.Fatalf("count bare SA number aliases: %v", err)
	}
	if n != 0 {
		t.Errorf("素の SA 番号の別名行が %d 行ある(本サブは 0 行しか投入していない)", n)
	}

	t.Logf("素の SA 番号を持つ preset_aliases の行 %d 行"+
		"(第 3 段は move_code から導く規則であり、辞書由来ではない)", n)
}

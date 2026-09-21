package aliasindex_test

import (
	"reflect"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/aliasindex"
	"github.com/plexiblinp/tacpendium/internal/model"
)

func ptr(s string) *string { return &s }

func TestLookup_NormalizesBothSides(t *testing.T) {
	// 辞書側が全角括弧、入力側が半角。M20-07 が解く D-307 の形そのもの。
	ix := aliasindex.Build([]model.AliasEntry{
		{MoveCode: "psycho_mine_auto_detonation", AliasText: "サイコマイン（自動爆発）"},
	})

	got := ix.Lookup("サイコマイン(自動爆発)")
	if !reflect.DeepEqual(got, []string{"psycho_mine_auto_detonation"}) {
		t.Errorf("半角入力で辞書の全角行を引けなかった: %v", got)
	}
	// 逆向き(辞書が半角・入力が全角)も同じ関数で揃うこと。
	ix2 := aliasindex.Build([]model.AliasEntry{
		{MoveCode: "solar_flare", AliasText: "ソーラーフレア(Lv1)(前方)"},
	})
	if got := ix2.Lookup("ソーラーフレア（Lv1）（前方）"); len(got) != 1 {
		t.Errorf("全角入力で辞書の半角行を引けなかった: %v", got)
	}
}

func TestLookup_UsesAliasTextEn(t *testing.T) {
	ix := aliasindex.Build([]model.AliasEntry{
		{MoveCode: "micro_back", AliasText: "微歩き(後)", AliasTextEn: ptr("back microwalk")},
	})

	if got := ix.Lookup("back microwalk"); !reflect.DeepEqual(got, []string{"micro_back"}) {
		t.Errorf("英語表記で引けなかった: %v", got)
	}
	// 大文字混じりでも引ける(裁定 3。実測で同一視 0 のため畳み込みを採った)。
	if got := ix.Lookup("Back Microwalk"); !reflect.DeepEqual(got, []string{"micro_back"}) {
		t.Errorf("大文字混じりの英語表記で引けなかった: %v", got)
	}
	// 日本語側も従来どおり引ける。
	if got := ix.Lookup("微歩き(後)"); !reflect.DeepEqual(got, []string{"micro_back"}) {
		t.Errorf("日本語表記で引けなかった: %v", got)
	}
}

// ★alias_text_en が NULL なのは「英語表記を持たない」であって「エイリアス未定義」ではない
// (DES-003 §3.9・D-317)。⇒ フォールバックの引き金にしない。英語キーを足さないだけ。
func TestBuild_NilAliasTextEnIsNotAFallbackTrigger(t *testing.T) {
	entries := []model.AliasEntry{
		{MoveCode: "hadoken_light", AliasText: "波動拳", AliasTextEn: nil},
		{MoveCode: "micro_forward", AliasText: "微歩き(前)", AliasTextEn: ptr("microwalk")},
	}
	ix := aliasindex.Build(entries)

	// NULL の行も日本語側は普通に引ける(未定義扱いになっていない)。
	if got := ix.Lookup("波動拳"); !reflect.DeepEqual(got, []string{"hadoken_light"}) {
		t.Errorf("alias_text_en が NULL の行の日本語表記が引けなかった: %v", got)
	}
	// 英語キーは NULL の行の分だけ増えない。
	if got := ix.Scanned(); got != 3 {
		t.Errorf("投入表記数 = %d, want 3 (日本語 2 + 英語 1)", got)
	}
	// 空文字で全件当たるような索引になっていないこと。
	if got := ix.Lookup(""); len(got) != 0 {
		t.Errorf("空表記で %v が当たった", got)
	}
}

func TestBuild_EmptyAliasTextEnIsSkipped(t *testing.T) {
	ix := aliasindex.Build([]model.AliasEntry{
		{MoveCode: "hadoken_light", AliasText: "波動拳", AliasTextEn: ptr("")},
	})
	if got := ix.Scanned(); got != 1 {
		t.Errorf("投入表記数 = %d, want 1 (空の英語表記は投入しない)", got)
	}
}

// ★決定論の骨格: 複数件はそのまま複数件で返す。タイブレークしない。
func TestLookup_CrossPresetCollisionReturnsAllCodes(t *testing.T) {
	ix := aliasindex.Build([]model.AliasEntry{
		{MoveCode: "elbow_drop", AliasText: "2HP"},            // 空中版(numeric)
		{MoveCode: "crouching_heavy_punch", AliasText: "2HP"}, // しゃがみ版(numeric)
	})

	got := ix.Lookup("2HP")
	want := []string{"crouching_heavy_punch", "elbow_drop"}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("複数件が畳まれた: %v, want %v", got, want)
	}
}

// 同一 move への重複(プリセット跨ぎ。実測 714 件)は 1 件へ畳む。
func TestLookup_SameMoveAcrossPresetsFoldsToOne(t *testing.T) {
	ix := aliasindex.Build([]model.AliasEntry{
		{MoveCode: "hadoken_light", AliasText: "236LP"}, // numeric
		{MoveCode: "hadoken_light", AliasText: "236LP"}, // srk
	})
	if got := ix.Lookup("236LP"); !reflect.DeepEqual(got, []string{"hadoken_light"}) {
		t.Errorf("同一 move の重複が畳まれていない: %v", got)
	}
}

// ★2 段構え: 第 1 段が当たるときは第 2 段へ落ちない。
func TestLookup_StrictStageWinsOverRelaxed(t *testing.T) {
	ix := aliasindex.Build([]model.AliasEntry{
		{MoveCode: "sa1_shinku_hadoken", AliasText: "236236P (SA1)"},
		{MoveCode: "sa3_shin_shoryuken", AliasText: "236236P (SA3)"},
	})

	// 注記つきで書けば第 1 段で 1 件に確定する材料が返る。
	if got := ix.Lookup("236236P (SA1)"); !reflect.DeepEqual(got, []string{"sa1_shinku_hadoken"}) {
		t.Errorf("第 1 段で注記つきを引けなかった: %v", got)
	}
	if got := ix.LookupStrict("236236P (SA1)"); !reflect.DeepEqual(got, []string{"sa1_shinku_hadoken"}) {
		t.Errorf("LookupStrict が第 1 段で引けなかった: %v", got)
	}
}

// ★第 2 段: 注記を省いた入力を拾う。ただし当たりが 2 件なら 2 件のまま返す
// (呼び出し側の「1 件のときだけ確定」が未解決へ倒す)。
func TestLookup_RelaxedStageForOmittedSACATag(t *testing.T) {
	ix := aliasindex.Build([]model.AliasEntry{
		{MoveCode: "sa1_shinku_hadoken", AliasText: "236236P (SA1)"},
		{MoveCode: "sa2_shinku_hadoken", AliasText: "214214P (SA2)"},
		{MoveCode: "ca_shin_shoryuken", AliasText: "236236K (CA)"},
		{MoveCode: "sa3_shin_shoryuken", AliasText: "236236K (SA3)"},
	})

	// 1 件に解ける側(SA1 / SA2)。
	if got := ix.Lookup("236236P"); !reflect.DeepEqual(got, []string{"sa1_shinku_hadoken"}) {
		t.Errorf("番号なしの入力が第 2 段で解けなかった: %v", got)
	}
	// ★CA と SA3 がダブる側は 2 件のまま返る(勝手に選ばない)。
	if got := ix.Lookup("236236K"); !reflect.DeepEqual(got, []string{"ca_shin_shoryuken", "sa3_shin_shoryuken"}) {
		t.Errorf("CA / SA3 のダブりが 2 件で返らなかった: %v", got)
	}
	// 第 1 段だけを引けば 0 件である(第 2 段が効いていることの対照)。
	if got := ix.LookupStrict("236236P"); len(got) != 0 {
		t.Errorf("第 1 段が注記なしの入力に当たってしまった: %v", got)
	}
}

// ★★第 2 段で注記を落とすのは辞書側だけであることを固定する(レビュー指摘 高-1)。
//
// 実装当初は入力側にも NormalizeRelaxed を掛けていたため、利用者が書いた注記を捨てて
// 別の技へ確定していた。★この形は他のどのテストでも赤くならなかった——第 1 段の衝突検査は
// 0 組のままで、動作は「解決できた」ように見えるためである。本サブが最も警戒していた
// 「別の技が同じものとして解決される」形そのものが、第 2 段の入力側から入り込んでいた。
func TestLookup_RelaxedStageDoesNotStripTheUsersOwnTag(t *testing.T) {
	// ryu の実データ: SA1 は 236236P、SA3 と CA は 236236K。
	ix := aliasindex.Build([]model.AliasEntry{
		{MoveCode: "sa1_shinku_hadoken", AliasText: "236236P (SA1)"},
		{MoveCode: "sa3_shin_shoryuken", AliasText: "236236K (SA3)"},
		{MoveCode: "ca_shin_shoryuken", AliasText: "236236K (CA)"},
	})

	// 利用者が「236236P の SA3」という実在しない組み合わせを書いた場合。
	// ★SA1 へ確定してはならない。書かれていない技である。
	if got := ix.Lookup("236236P (SA3)"); len(got) != 0 {
		t.Errorf("★利用者が書いた注記を捨てて %v へ当てた(未解決が正しい)", got)
	}

	// 対照 1: 注記を省いた入力は従来どおり第 2 段で拾える(第 2 段を殺していない)。
	if got := ix.Lookup("236236P"); !reflect.DeepEqual(got, []string{"sa1_shinku_hadoken"}) {
		t.Errorf("注記を省いた入力が第 2 段で拾えなくなった: %v", got)
	}

	// 対照 2: 正しい注記つきの入力は第 1 段で確定する。
	if got := ix.Lookup("236236K (SA3)"); !reflect.DeepEqual(got, []string{"sa3_shin_shoryuken"}) {
		t.Errorf("正しい注記つきの入力が第 1 段で引けない: %v", got)
	}
}

// ★第 1 段に同一視は無い。ここが空でなくなったら正規化が緩すぎる。
func TestStrictCollisions_IsEmptyForDistinguishableAliases(t *testing.T) {
	ix := aliasindex.Build([]model.AliasEntry{
		{MoveCode: "crouching_medium_kick", AliasText: "しゃがみ中K"},
		{MoveCode: "rush_crouching_medium_kick", AliasText: "しゃがみ中K(ラッシュ)"},
		{MoveCode: "ca_shin_shoryuken", AliasText: "236236K (CA)"},
		{MoveCode: "sa3_shin_shoryuken", AliasText: "236236K (SA3)"},
	})

	if got := ix.StrictCollisions(); len(got) != 0 {
		t.Errorf("第 1 段で別の技が同一視された: %+v", got)
	}
	// 第 2 段では CA と SA3 が衝突する。これは設計上の前提であり欠陥ではない。
	relaxed := ix.RelaxedCollisions()
	if len(relaxed) != 1 {
		t.Fatalf("第 2 段の衝突が %d 組(1 組のはず): %+v", len(relaxed), relaxed)
	}
	if !reflect.DeepEqual(relaxed[0].MoveCodes, []string{"ca_shin_shoryuken", "sa3_shin_shoryuken"}) {
		t.Errorf("第 2 段の衝突の中身が想定と違う: %+v", relaxed[0])
	}
}

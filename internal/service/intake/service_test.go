package intake

import (
	"context"
	"errors"
	"slices"
	"strings"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
	"github.com/plexiblinp/tacpendium/internal/moveindex"
)

// fakeIndexLoader は事前構築した索引を返す(LoadIndex の DB 依存を切る)。
type fakeIndexLoader struct{ ix *moveindex.Index }

func (f fakeIndexLoader) LoadIndex(_ context.Context) (*moveindex.Index, error) {
	return f.ix, nil
}

// fakeAlias は charCode|aliasText → move_code 群のマップで逆引き辞書を模す。
// M20-07 以降、サービスは 1 表記ずつ引くのではなくキャラ分の辞書を受け取るため、
// マップを model.AliasEntry 列へ展開して返す。
type fakeAlias struct {
	m   map[string][]string
	en  map[string]string // aliasText → alias_text_en(省略可)
	err error             // 非 nil なら辞書取得に失敗させる
}

func (f fakeAlias) ListAliasEntriesByCharacter(_ context.Context, charCode string) ([]model.AliasEntry, error) {
	if f.err != nil {
		return nil, f.err
	}
	var entries []model.AliasEntry
	for key, codes := range f.m {
		cc, aliasText, ok := strings.Cut(key, "|")
		if !ok || cc != charCode {
			continue
		}
		for _, code := range codes {
			e := model.AliasEntry{MoveCode: code, AliasText: aliasText}
			if en, ok := f.en[aliasText]; ok {
				e.AliasTextEn = &en
			}
			entries = append(entries, e)
		}
	}
	return entries, nil
}

// buildIndex は ryu 用の最小索引を実エンジンで構築する(AddIndexed は正規化済みキー投入)。
func buildIndex() *moveindex.Index {
	ix := moveindex.New()
	ix.AddIndexed("ryu", "hadoken_light", "236LP", 100)       // 弱波動拳
	ix.AddIndexed("ryu", "standing_medium_punch", "MP", 20)   // 立ち中P
	ix.AddIndexed("ryu", "crouching_medium_punch", "2MP", 21) // しゃがみ中P
	return ix
}

func newService(alias map[string][]string) *Service {
	return New(fakeIndexLoader{ix: buildIndex()}, fakeAlias{m: alias})
}

// newServiceWithEn は alias_text_en を持つ辞書でサービスを組む(M20-07 の両引き用)。
func newServiceWithEn(alias map[string][]string, en map[string]string) *Service {
	return New(fakeIndexLoader{ix: buildIndex()}, fakeAlias{m: alias, en: en})
}

// tsv はタブ区切り 1 行を作るヘルパ。
func tsv(cols ...string) string { return strings.Join(cols, "\t") }

func TestResolve_TokenMatch(t *testing.T) {
	svc := newService(nil)
	// トークン列「d dr r plus p_l」は 236LP へ正規化され hadoken_light に一致する。
	text := tsv("1", "1", "弱波動", "d dr r plus p_l", "波動拳(弱)", "高", "")
	res, err := svc.Resolve(context.Background(), "ryu", text)
	if err != nil {
		t.Fatalf("Resolve: %v", err)
	}
	if !res.MovesAvailable {
		t.Fatalf("MovesAvailable should be true for seeded char")
	}
	step := res.Combos[0].Steps[0]
	if !step.Resolved || step.MoveCode != "hadoken_light" || step.ResolvedVia != viaToken {
		t.Fatalf("token match failed: %+v", step)
	}
	if res.Summary.Resolved != 1 || res.Summary.Unresolved != 0 {
		t.Fatalf("summary: %+v", res.Summary)
	}
}

func TestResolve_AliasMatch_UniqueOnly(t *testing.T) {
	// トークンは不明(?)だが技名候補「波動拳」がキャラ内で一意 → alias 経由で解決。
	svc := newService(map[string][]string{"ryu|波動拳": {"hadoken_light"}})
	text := tsv("1", "1", "弱波動", "?", "波動拳", "低", "")
	res, err := svc.Resolve(context.Background(), "ryu", text)
	if err != nil {
		t.Fatalf("Resolve: %v", err)
	}
	step := res.Combos[0].Steps[0]
	if !step.Resolved || step.MoveCode != "hadoken_light" || step.ResolvedVia != viaAlias {
		t.Fatalf("alias match failed: %+v", step)
	}
}

func TestResolve_AliasAmbiguous_Unresolved(t *testing.T) {
	// 技名候補が複数 move に一致 → 決定論のため未解決に倒す(曖昧一致・タイブレークをしない)。
	svc := newService(map[string][]string{"ryu|中P": {"standing_medium_punch", "crouching_medium_punch"}})
	text := tsv("1", "1", "中P", "?", "中P", "低", "")
	res, err := svc.Resolve(context.Background(), "ryu", text)
	if err != nil {
		t.Fatalf("Resolve: %v", err)
	}
	step := res.Combos[0].Steps[0]
	if step.Resolved {
		t.Fatalf("ambiguous alias must stay unresolved")
	}
	// ★M20-07: 複数件だった事実を候補として残す。M17-04 では捨てていたため、
	// 画面上で「候補が複数あって決められなかった」と「1 つも当たらなかった」が
	// 同じ顔になっていた(E-84)。
	want := []string{"crouching_medium_punch", "standing_medium_punch"}
	if !slices.Equal(step.Candidates, want) {
		t.Errorf("複数件の候補が残っていない: %v, want %v", step.Candidates, want)
	}
}

func TestResolve_UnknownToken_NoFallback(t *testing.T) {
	// 索引に無いトークン列 → 未解決のまま(通常技へフォールバックしない=段階2 との挙動差)。
	svc := newService(nil)
	text := tsv("1", "1", "謎技", "d d d plus p_l", "?", "低", "")
	res, err := svc.Resolve(context.Background(), "ryu", text)
	if err != nil {
		t.Fatalf("Resolve: %v", err)
	}
	step := res.Combos[0].Steps[0]
	if step.Resolved || step.MoveCode != "" {
		t.Fatalf("unknown token must stay unresolved: %+v", step)
	}
	if len(step.Candidates) != 0 {
		t.Fatalf("no candidates expected for unindexed token: %v", step.Candidates)
	}
}

func TestResolve_CharacterNotInIndex_AllUnresolved(t *testing.T) {
	// 索引に居ないキャラ → 全行未解決・エラーで落ちない・MovesAvailable=false。
	//
	// ★以前は c_viper を「未投入キャラ」の実例として書いていたが、M14-03f(第四波 seed・
	//   2026-09-02)で 31 キャラすべてが本 seed 済みになり、その説明は失効した。
	//   ★本テストは newService(nil) の索引ゼロ fixture で回っており実データを引かない。
	//   ⇒ 実在する code を使う必要が無いので、意図が読める名前へ変えた。
	svc := newService(nil)
	text := tsv("1", "1", "屈中P", "2MP", "しゃがみ中P", "高", "")
	res, err := svc.Resolve(context.Background(), "not_in_index", text)
	if err != nil {
		t.Fatalf("Resolve must not error for a character absent from the index: %v", err)
	}
	if res.MovesAvailable {
		t.Fatalf("MovesAvailable should be false when the index has no entry")
	}
	if res.Combos[0].Steps[0].Resolved {
		t.Fatalf("step must be unresolved when the index has no entry")
	}
}

func TestResolve_UnknownCharacter_AllUnresolved(t *testing.T) {
	// キャラ不明(存在しない code)も未投入と同じ扱い(壊れない)。
	svc := newService(nil)
	text := tsv("1", "1", "屈中P", "2MP", "しゃがみ中P", "高", "")
	res, err := svc.Resolve(context.Background(), "no_such_char", text)
	if err != nil {
		t.Fatalf("Resolve must not error for unknown char: %v", err)
	}
	if res.MovesAvailable || res.Summary.Resolved != 0 {
		t.Fatalf("unknown char should resolve nothing: %+v", res.Summary)
	}
}

func TestResolve_TokenBeatsAlias(t *testing.T) {
	// トークン列で引ければ別名照合は走らない(① が ② に優先)。
	svc := newService(map[string][]string{"ryu|波動拳": {"some_other_code"}})
	text := tsv("1", "1", "弱波動", "d dr r plus p_l", "波動拳", "高", "")
	res, err := svc.Resolve(context.Background(), "ryu", text)
	if err != nil {
		t.Fatalf("Resolve: %v", err)
	}
	step := res.Combos[0].Steps[0]
	if step.ResolvedVia != viaToken || step.MoveCode != "hadoken_light" {
		t.Fatalf("token should win over alias: %+v", step)
	}
}

func TestResolve_EmptyCommandMove_Unresolved(t *testing.T) {
	// command 空の非派生 special(guile/sonic_blade_od・lily/condor_spire_od)は索引に載らない
	// (M17-04 §1.4/§3.3-6)。その入力はトークンで引けず、別名も無ければ未解決のまま返る
	// (エラーで止まらない・通常技へフォールバックしない)。索引にその move が無い状況で確認する。
	svc := newService(nil) // 索引は hadoken/立中P/しゃがみ中P のみ。sonic_blade_od 相当は無い。
	text := tsv("1", "1", "ソニックブレイドOD", "charge_l r plus p_l k_l", "?", "低", "")
	res, err := svc.Resolve(context.Background(), "guile", text)
	if err != nil {
		t.Fatalf("Resolve must not error: %v", err)
	}
	if res.Combos[0].Steps[0].Resolved {
		t.Fatalf("empty-command move must stay unresolved (no fallback)")
	}
}

func TestResolve_ComboGrouping(t *testing.T) {
	// # でコンボへまとめ、入力の出現順を保つ。
	svc := newService(nil)
	text := strings.Join([]string{
		tsv("1", "1", "立中P", "p_m", "立ち中P", "高", ""),
		tsv("1", "2", "弱波動", "d dr r plus p_l", "波動拳(弱)", "高", ""),
		tsv("2", "1", "しゃがみ中P", "2MP", "しゃがみ中P", "高", ""),
	}, "\n")
	res, err := svc.Resolve(context.Background(), "ryu", text)
	if err != nil {
		t.Fatalf("Resolve: %v", err)
	}
	if len(res.Combos) != 2 {
		t.Fatalf("expected 2 combos, got %d", len(res.Combos))
	}
	if len(res.Combos[0].Steps) != 2 || res.Combos[1].ComboIndex != 2 {
		t.Fatalf("grouping wrong: %+v", res.Combos)
	}
	if res.Summary.TotalSteps != 3 || res.Summary.Resolved != 3 {
		t.Fatalf("summary: %+v", res.Summary)
	}
}

// ===========================================================================
// M20-07: 逆引き前段の正規化 / 両引き / 多候補ハッジの分割
// ===========================================================================

// §5 (a): 辞書側が全角括弧でも、利用者が半角で書いた入力で解決する(D-307)。
func TestResolve_FullWidthAlias_ResolvesFromHalfWidthInput(t *testing.T) {
	svc := newService(map[string][]string{
		"ryu|サイコマイン（自動爆発）": {"psycho_mine_auto_detonation"},
	})
	text := tsv("1", "1", "マイン", "?", "サイコマイン(自動爆発)", "低", "")
	res, err := svc.Resolve(context.Background(), "ryu", text)
	if err != nil {
		t.Fatalf("Resolve: %v", err)
	}
	step := res.Combos[0].Steps[0]
	if !step.Resolved || step.MoveCode != "psycho_mine_auto_detonation" || step.ResolvedVia != viaAlias {
		t.Fatalf("半角入力で全角括弧の別名を解決できなかった: %+v", step)
	}
}

// §5 (h) の対照: 正規化は入力側と辞書側の両方へ掛かる。
// 辞書が半角・入力が全角でも解決すること(片側だけに掛けるとどちらかが落ちる)。
func TestResolve_HalfWidthAlias_ResolvesFromFullWidthInput(t *testing.T) {
	svc := newService(map[string][]string{
		"ryu|ソーラーフレア(Lv1)(前方)": {"solar_flare"},
	})
	text := tsv("1", "1", "フレア", "?", "ソーラーフレア（Lv1）（前方）", "低", "")
	res, err := svc.Resolve(context.Background(), "ryu", text)
	if err != nil {
		t.Fatalf("Resolve: %v", err)
	}
	if step := res.Combos[0].Steps[0]; !step.Resolved || step.MoveCode != "solar_flare" {
		t.Fatalf("全角入力で半角括弧の別名を解決できなかった: %+v", step)
	}
}

// §5 (c): 英語表記(alias_text_en)を入力しても解決する(D-317 の両引き)。
func TestResolve_EnglishAlias_Resolves(t *testing.T) {
	svc := newServiceWithEn(
		map[string][]string{"ryu|微歩き(後)": {"micro_back"}},
		map[string]string{"微歩き(後)": "back microwalk"},
	)
	text := tsv("1", "1", "微下がり", "?", "back microwalk", "低", "")
	res, err := svc.Resolve(context.Background(), "ryu", text)
	if err != nil {
		t.Fatalf("Resolve: %v", err)
	}
	if step := res.Combos[0].Steps[0]; !step.Resolved || step.MoveCode != "micro_back" {
		t.Fatalf("英語表記を解決できなかった: %+v", step)
	}
}

// §5 (d): alias_text_en が NULL の行はフォールバックの引き金にならない。
// 「英語表記を持たない」であって「エイリアス未定義」ではない(DES-003 §3.9)。
func TestResolve_NilAliasTextEn_IsNotAFallbackTrigger(t *testing.T) {
	svc := newService(map[string][]string{"ryu|波動拳": {"hadoken_light"}})

	// (1) 英語表記を持たない行でも、日本語側は普通に解決する。
	res, err := svc.Resolve(context.Background(), "ryu", tsv("1", "1", "波動", "?", "波動拳", "低", ""))
	if err != nil {
		t.Fatalf("Resolve: %v", err)
	}
	if step := res.Combos[0].Steps[0]; !step.Resolved || step.MoveCode != "hadoken_light" {
		t.Fatalf("alias_text_en が NULL の行が解決できなかった: %+v", step)
	}

	// (2) 英語で書いても当たらない(英語キーが無いだけであり、別の技へ倒れたりしない)。
	res, err = svc.Resolve(context.Background(), "ryu", tsv("1", "1", "hadoken", "?", "hadoken", "低", ""))
	if err != nil {
		t.Fatalf("Resolve: %v", err)
	}
	step := res.Combos[0].Steps[0]
	if step.Resolved {
		t.Fatalf("英語表記を持たない行が英語入力で解決してしまった: %+v", step)
	}
	if len(step.Candidates) != 0 {
		t.Errorf("当たっていないのに候補が出た: %v", step.Candidates)
	}
}

// §5 (e): 多候補ハッジは分割され、候補として提示される。★確定にはならない。
func TestResolve_Hedge_SplitIntoCandidatesNeverResolved(t *testing.T) {
	svc := newService(map[string][]string{
		"ryu|立ち中P":   {"standing_medium_punch"},
		"ryu|しゃがみ中P": {"crouching_medium_punch"},
	})
	text := tsv("1", "1", "中P", "?", "立ち中P or しゃがみ中P", "低", "")
	res, err := svc.Resolve(context.Background(), "ryu", text)
	if err != nil {
		t.Fatalf("Resolve: %v", err)
	}

	step := res.Combos[0].Steps[0]
	if step.Resolved {
		t.Fatalf("★分割の結果を確定にしてはならない: %+v", step)
	}
	want := []string{"standing_medium_punch", "crouching_medium_punch"}
	if !slices.Equal(step.Candidates, want) {
		t.Errorf("分割候補 = %v, want %v", step.Candidates, want)
	}
}

// ★ハッジが 1 件にしか解けなくても確定させない(どれが正しいかは書き手しか知らない)。
func TestResolve_Hedge_SingleHitStillNotResolved(t *testing.T) {
	svc := newService(map[string][]string{"ryu|立ち中P": {"standing_medium_punch"}})
	text := tsv("1", "1", "中P", "?", "立ち中P or 知らない技", "低", "")
	res, err := svc.Resolve(context.Background(), "ryu", text)
	if err != nil {
		t.Fatalf("Resolve: %v", err)
	}
	step := res.Combos[0].Steps[0]
	if step.Resolved {
		t.Fatalf("★1 件に解けても分割結果は確定にしない: %+v", step)
	}
	if !slices.Equal(step.Candidates, []string{"standing_medium_punch"}) {
		t.Errorf("候補 = %v, want [standing_medium_punch]", step.Candidates)
	}
}

// ★ハッジで無い技名は分割されない。技名の中の "or" を割らないこと。
func TestResolve_NonHedgeNameIsNotSplit(t *testing.T) {
	svc := newService(map[string][]string{"ryu|Order of the Sun": {"sa2_order_of_the_sun"}})
	text := tsv("1", "1", "SA2", "?", "Order of the Sun", "高", "")
	res, err := svc.Resolve(context.Background(), "ryu", text)
	if err != nil {
		t.Fatalf("Resolve: %v", err)
	}
	if step := res.Combos[0].Steps[0]; !step.Resolved || step.MoveCode != "sa2_order_of_the_sun" {
		t.Fatalf("技名の中の or で分割されてしまった: %+v", step)
	}
}

// ★第 2 段(SA / CA 注記の除去): 番号を省いた入力が 1 件に解ければ確定してよい。
func TestResolve_OmittedSATag_ResolvesWhenUnique(t *testing.T) {
	svc := newService(map[string][]string{"ryu|236236P (SA1)": {"sa1_shinku_hadoken"}})
	text := tsv("1", "1", "真空", "?", "236236P", "中", "")
	res, err := svc.Resolve(context.Background(), "ryu", text)
	if err != nil {
		t.Fatalf("Resolve: %v", err)
	}
	if step := res.Combos[0].Steps[0]; !step.Resolved || step.MoveCode != "sa1_shinku_hadoken" {
		t.Fatalf("注記を省いた入力が解決できなかった: %+v", step)
	}
}

// ★★第 2 段で CA と SA3 がダブる 17 組は未解決のまま候補として出す(勝手に選ばない)。
// 実測: 技データを持つ全 17 キャラで Critical Art と SA3 が同一コマンドである。
func TestResolve_OmittedSATag_AmbiguousStaysUnresolved(t *testing.T) {
	svc := newService(map[string][]string{
		"ryu|236236K (CA)":  {"ca_shin_shoryuken"},
		"ryu|236236K (SA3)": {"sa3_shin_shoryuken"},
	})
	text := tsv("1", "1", "SA3?", "?", "236236K", "低", "")
	res, err := svc.Resolve(context.Background(), "ryu", text)
	if err != nil {
		t.Fatalf("Resolve: %v", err)
	}
	step := res.Combos[0].Steps[0]
	if step.Resolved {
		t.Fatalf("★CA と SA3 のダブりを確定させてはならない: %+v", step)
	}
	want := []string{"ca_shin_shoryuken", "sa3_shin_shoryuken"}
	if !slices.Equal(step.Candidates, want) {
		t.Errorf("候補 = %v, want %v", step.Candidates, want)
	}

	// 対照: 注記まで書けば第 1 段で確定する(第 2 段が第 1 段を潰していない)。
	res, err = svc.Resolve(context.Background(), "ryu", tsv("1", "1", "SA3", "?", "236236K (SA3)", "高", ""))
	if err != nil {
		t.Fatalf("Resolve: %v", err)
	}
	if step := res.Combos[0].Steps[0]; !step.Resolved || step.MoveCode != "sa3_shin_shoryuken" {
		t.Fatalf("注記つきの入力が第 1 段で確定しなかった: %+v", step)
	}
}

// ★辞書の取得に失敗しても照合全体は落とさない(M17-04 以来の方針)。
// トークン照合は従来どおり効き、別名照合だけが効かなくなる。
func TestResolve_AliasDictionaryLoadFailure_DoesNotFailRequest(t *testing.T) {
	svc := New(fakeIndexLoader{ix: buildIndex()}, fakeAlias{err: errors.New("db down")})
	text := strings.Join([]string{
		tsv("1", "1", "弱波動", "d dr r plus p_l", "波動拳", "高", ""),
		tsv("1", "2", "謎", "?", "波動拳", "低", ""),
	}, "\n")

	res, err := svc.Resolve(context.Background(), "ryu", text)
	if err != nil {
		t.Fatalf("辞書の取得失敗で照合全体が落ちた: %v", err)
	}
	if !res.Combos[0].Steps[0].Resolved {
		t.Error("トークン照合まで効かなくなっている")
	}
	if res.Combos[0].Steps[1].Resolved {
		t.Error("辞書が読めていないのに別名照合が成功した")
	}
}

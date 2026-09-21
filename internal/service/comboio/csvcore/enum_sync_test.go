package csvcore

import (
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
)

// M27-01: CSV 取込のホワイトリストと model の列挙定数の同期を機械的に押さえる。
//
// ★★なぜ要るか —— rules.go の DefaultHitTypes / DefaultOpponentSizes は
//   model.HitType* / model.OpponentSize* を **参照せずリテラルを再定義**している。
//   ⇒ 片側だけ値を足しても、コンパイルも既存テストも緑のまま通る。
//   実際 opponent_size は着手前の時点で 1/3 しか一致していなかった
//   (followup `csv-import-opponent-size-whitelist-stale`)。
//   本ファイルは「ズレたことに気づけない」状態そのものを潰す。
//
// ★scripts/check-enum-sync.sh はここを見ない。同スクリプトが見るのは
//   model → web/src/constants の対応であり、Go 内部の再定義は射程外である。

// ★本パッケージの rules.go にも toSet があるため名前を分ける(こちらはテスト専用)。
func valueSet(vs []string) map[string]bool {
	m := make(map[string]bool, len(vs))
	for _, v := range vs {
		m[v] = true
	}
	return m
}

// TestDefaultHitTypesMatchesModel は DefaultHitTypes が model.HitType* と完全一致することを見る。
//
// ★hit_type は「完全一致」を要求してよい —— 着手前も 4/4 一致しており、
//
//	ズレを許容する裁定は無い。⇒ 増えても減っても赤くする。
func TestDefaultHitTypesMatchesModel(t *testing.T) {
	want := []string{
		model.HitTypeNormal,
		model.HitTypeCounter,
		model.HitTypePunishCounter,
		model.HitTypeJustParryPunishCounter,
		model.HitTypeDriveImpactWallSplatHit,
		model.HitTypeDriveImpactWallSplatBlock,
		model.HitTypeDriveImpactPunishCounter,
		model.HitTypeStun,
	}
	got := valueSet(DefaultHitTypes)

	if len(DefaultHitTypes) != len(want) {
		t.Errorf("DefaultHitTypes の件数 = %d, want %d (%v)", len(DefaultHitTypes), len(want), DefaultHitTypes)
	}
	for _, w := range want {
		if !got[w] {
			t.Errorf("model.HitType* の %q が DefaultHitTypes に無い(CSV 取込で未知値になる)", w)
		}
	}
	wantSet := valueSet(want)
	for _, g := range DefaultHitTypes {
		if !wantSet[g] {
			t.Errorf("DefaultHitTypes の %q が model に無い(死んだ値)", g)
		}
	}
}

// TestDefaultOpponentSizesKnownMismatch は opponent_size の **既知のズレ** を固定する。
//
// ★★これは「一致していること」ではなく「今どうズレているか」を書き留めるテストである。
//
//	本体は standard / large / large1 / large2 の 4 値だが、ホワイトリストは
//	small / standard / large の 3 値である。
//	  - small          : 本体に無い死んだ値
//	  - large1 / large2: 本体に在るがホワイトリストに無く、往復すると VAL-ENUM が出る
//	これは **開発者裁定でスコープ外**である(followup `csv-import-opponent-size-whitelist-stale`。
//	逐語＝「これはあなたのミスでもなければスコープ外なので、対応不要ですが、
//	申し送りにはしておいてください。」)。M27-01 は medium → standard の 1 語だけを
//	追随させた(開発者選択 (a)・2026-09-02)。
//
// ★★なぜ「ズレ」をテストで固定するのか —— 着手前、このズレを検知する経路が
//
//	Go にも E2E にも 1 件も無かった(large1 / large2 を通すテストが 0 件だった)。
//	だから 1/3 しか一致していない状態が誰にも気づかれず残った。
//	⇒ 直すのが射程外なら、せめて **現状を書き留めて、変わったら赤くする**。
//	★このテストが赤くなったら、それは「壊れた」ではなく「ズレが動いた」の合図である。
//	  直したのなら本テストを一致検査へ書き換えること。
func TestDefaultOpponentSizesKnownMismatch(t *testing.T) {
	modelValues := []string{
		model.OpponentSizeStandard,
		model.OpponentSizeLarge,
		model.OpponentSizeLarge1,
		model.OpponentSizeLarge2,
	}
	white := valueSet(DefaultOpponentSizes)
	modelSet := valueSet(modelValues)

	// 一致している 2 値。★ここが崩れたら M27-01 の変更が失われている。
	for _, v := range []string{model.OpponentSizeStandard, model.OpponentSizeLarge} {
		if !white[v] {
			t.Errorf("%q はホワイトリストに在るべき(M27-01 で追随させた)", v)
		}
	}

	// 既知の欠落 2 値。★解消したら本テストを一致検査へ書き換えること。
	for _, v := range []string{model.OpponentSizeLarge1, model.OpponentSizeLarge2} {
		if white[v] {
			t.Errorf("%q がホワイトリストに入った —— 既知のズレが解消している。"+
				"本テストを「完全一致」の検査へ書き換えること", v)
		}
	}

	// 既知の死んだ値。★消したら本テストを更新すること。
	if !white["small"] {
		t.Errorf(`"small" がホワイトリストから消えた —— 死んだ値が掃除されている。` +
			`本テストを更新すること`)
	}
	if modelSet["small"] {
		t.Errorf(`"small" が model に復活している(M27-01 の前提が崩れている)`)
	}

	// ★母数を記録に残す。次に触る担当が「何対何だったか」を実測なしで読めるようにする。
	matched := 0
	for _, v := range modelValues {
		if white[v] {
			matched++
		}
	}
	t.Logf("★opponent_size の一致状況(実測): model %d 値中 %d 値がホワイトリストに在る "+
		"(ホワイトリストは %d 値: %v)", len(modelValues), matched, len(DefaultOpponentSizes), DefaultOpponentSizes)
}

// TestDefaultPositionsMatchesModel は DefaultPositions が model の区分表と一致することを見る。
//
// ★★M28-02a で新設した。着手前は position の同期テストが存在しなかった ——
// hit_type と opponent_size にはあり、position だけが無い状態だった。
// ⇒ その穴の中で実際にズレていた: DefaultPositions は 4 値で corner_self_near を欠いており、
//
//	本体の値域は 5 値だった。corner_self_near のコンボを往復させると
//	VAL-ENUM 警告が出るが、それを観測するものが何も無かった。
//
// ★★これは followup の
// `csv-column-contract-unobserved-in-pr` / `gofmt-not-in-pr-checks` /
// `import-order-unchecked` / `check-enum-sync-misses-size-suffix` と同じ型である
// —— 守るべきものはあるが観測が無い。★5 例目にあたる。
//
// ★完全一致を要求する。position はズレを許容する裁定を持たない
// (opponent_size のような「既知のズレを認めた行」は無い)。
func TestDefaultPositionsMatchesModel(t *testing.T) {
	want := model.PositionValuesInDisplayOrder()
	got := valueSet(DefaultPositions)

	if len(DefaultPositions) != len(want) {
		t.Errorf("DefaultPositions の件数 = %d, want %d (%v)", len(DefaultPositions), len(want), DefaultPositions)
	}
	for _, v := range want {
		if !got[v] {
			t.Errorf("DefaultPositions に %q が無い(本体の値域に在る値が CSV で未知値扱いになる)", v)
		}
	}
	wantSet := valueSet(want)
	for _, v := range DefaultPositions {
		if !wantSet[v] {
			t.Errorf("DefaultPositions に本体の値域に無い %q が在る", v)
		}
	}
	// ★新区分 2 つが確かに含まれること(D-733)。
	for _, v := range []string{model.PositionMidSelf, model.PositionMidOpponent} {
		if !got[v] {
			t.Errorf("新区分 %q が DefaultPositions に無い", v)
		}
	}
	// ★着手前に欠けていた値。回帰の名指し。
	if !got[model.PositionCornerSelfNear] {
		t.Error("corner_self_near が DefaultPositions に無い(M28-02a 以前の欠落へ戻っている)")
	}
}

package punishfinder

// M37-04(B06): ターゲットコンボの 2 段目以降を 1 行で表す行の候補判定を固定する。
//
// ★★主張は 2 つある。
//
//	(1) 対象行は first_hit_startup で判定する。NULL の間は候補から外す(D-857)。
//	(2) 対象は「category='target_combo' ∧ is_derived ∧ startup_basis='standalone'」の
//	    3 属性がそろった行だけである。⇒ through / unknown / 非 derived は現状どおり
//	    startup で判定し、候補から消えない(指示書 §4.3・偽陰性を増やさない)。
//
// ★「候補から消えた」だけでは歯止めの証拠にならない —— 別の理由で出ていない可能性を
//   排除できないためである。⇒ TestBuildStarters_DestructiveCheck が、除外を外した
//   変更前の述語を同じフィクスチャへ当てて「戻る」ことまで見る(指示書 §5-3)。

import (
	"context"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
	"github.com/plexiblinp/tacpendium/internal/repository/punish"
)

// m3704Opp は有利 +5F を作る相手技(block タブ: adv = -(on_block))。
// ★5F は実データに合わせてある —— ryu fuwa_triple_strike_2hits の startup が 5 であり、
//
//	是正前はこの有利で `5 <= 5` が成立して候補に出ていた。
func m3704Opp() []punish.ScanMove {
	return []punish.ScanMove{{
		ID: 10, CharacterID: oppC, Code: "opp_move", Category: model.MoveCategoryNormal,
		Damage: ip(80), OnBlock: ip(-5),
	}}
}

// m3704Self は判定対象の 4 類型を 1 本ずつ持つ自技集合。startup はすべて 5 に揃えてあり、
// 有利 5F では「述語だけ」が出る・出ないを決める。
//
//	200 = 対象(B 群)          target_combo ∧ derived ∧ standalone … ryu fuwa_triple_strike_2hits と同形
//	201 = 非 derived(A 群)    target_combo ∧ derived=false
//	202 = through(C 群)       target_combo ∧ derived ∧ basis=through … jamie 乱酔旋と同形
//	203 = unknown(C 群)       target_combo ∧ derived ∧ basis=unknown
//	204 = 普通の通常技         対象外の代表(挙動が変わらないことの対照)
func m3704Self(firstHit *int) []punish.ScanMove {
	return []punish.ScanMove{
		{ID: 200, CharacterID: self, Code: "fuwa_triple_strike_2hits", Category: model.MoveCategoryTargetCombo,
			Startup: ip(5), Damage: ip(540), IsDerived: true,
			StartupBasis: model.MoveStartupBasisStandalone, FirstHitStartup: firstHit},
		{ID: 201, CharacterID: self, Code: "machine_gun_chops", Category: model.MoveCategoryTargetCombo,
			Startup: ip(5), Damage: ip(600), IsDerived: false,
			StartupBasis: model.MoveStartupBasisStandalone},
		{ID: 202, CharacterID: self, Code: "ransui_haze_through", Category: model.MoveCategoryTargetCombo,
			Startup: ip(5), Damage: ip(700), IsDerived: true,
			StartupBasis: model.MoveStartupBasisThrough},
		{ID: 203, CharacterID: self, Code: "hell_attack_unknown", Category: model.MoveCategoryTargetCombo,
			Startup: ip(5), Damage: ip(700), IsDerived: true,
			StartupBasis: model.MoveStartupBasisUnknown},
		{ID: 204, CharacterID: self, Code: "standing_light_punch", Category: model.MoveCategoryNormal,
			Startup: ip(5), Damage: ip(300),
			StartupBasis: model.MoveStartupBasisStandalone},
	}
}

// m3704Svc は m3704Self を自技に持つサービスを組む(baseSvc は自技が固定のため使えない)。
func m3704Svc(selfMoves []punish.ScanMove) Service {
	repo := &fakeRepo{
		moves:    map[int64][]punish.ScanMove{self: selfMoves, oppC: m3704Opp()},
		totals:   map[int64]punish.MovementTotals{self: {}},
		pruned:   map[int64]map[int64]bool{},
		verdicts: map[int64][]punish.StarterVerdict{},
		adopted:  map[int64][]punish.ComboPunishKey{},
	}
	return New(repo, fakeCombos{}, func() int64 { return 1 })
}

// m3704Scan は block タブ(有利 +5F)で走査し、地上レーンへ出た始動技 id 集合を返す。
func m3704Scan(t *testing.T, selfMoves []punish.ScanMove) map[int64]bool {
	t.Helper()
	tree, err := m3704Svc(selfMoves).Scan(context.Background(),
		ScanParams{self, oppC, model.PunishGuardTypeBlock})
	if err != nil {
		t.Fatalf("Scan: %v", err)
	}
	got := map[int64]bool{}
	for _, om := range tree.Nodes {
		for _, st := range om.Starters {
			if st.Lane == model.PunishLaneGround {
				got[st.MoveID] = true
			}
		}
	}
	return got
}

// m3704ScanLane は指定レーンへ出た始動技 id 集合を返す。
// oppOnBlock で有利フレームを、totals でダッシュ可否を変えられる。
func m3704ScanLane(t *testing.T, selfMoves []punish.ScanMove, oppOnBlock int,
	totals punish.MovementTotals, lane string) map[int64]bool {
	t.Helper()
	opp := []punish.ScanMove{{
		ID: 10, CharacterID: oppC, Code: "opp_move", Category: model.MoveCategoryNormal,
		Damage: ip(80), OnBlock: ip(oppOnBlock),
	}}
	repo := &fakeRepo{
		moves:    map[int64][]punish.ScanMove{self: selfMoves, oppC: opp},
		totals:   map[int64]punish.MovementTotals{self: totals},
		pruned:   map[int64]map[int64]bool{},
		verdicts: map[int64][]punish.StarterVerdict{},
		adopted:  map[int64][]punish.ComboPunishKey{},
	}
	tree, err := New(repo, fakeCombos{}, func() int64 { return 1 }).
		Scan(context.Background(), ScanParams{self, oppC, model.PunishGuardTypeBlock})
	if err != nil {
		t.Fatalf("Scan: %v", err)
	}
	got := map[int64]bool{}
	for _, om := range tree.Nodes {
		for _, st := range om.Starters {
			if st.Lane == lane {
				got[st.MoveID] = true
			}
		}
	}
	return got
}

// TestScan_DashLane_UsesSameGate は §5-1/§5-2 をダッシュ経由レーンでも固定する(低-9)。
//
// ★地上レーンと同じ startup 変数を共有しているが、レーンごとに述語が分岐した将来に
//
//	空白にならないよう、ここで独立に押さえる。
//	有利 20F・dash_forward.total=10 ⇒ slack=10(>= DashMinSlack=4)。startup 5 <= 10 で成立する。
func TestScan_DashLane_UsesSameGate(t *testing.T) {
	totals := punish.MovementTotals{DashForward: ip(10)}

	// NULL のまま: ダッシュ経由レーンにも出ない。
	if m3704ScanLane(t, m3704Self(nil), -20, totals, model.PunishLaneDash)[200] {
		t.Error("first_hit_startup=NULL の対象行がダッシュ経由レーンに出ている")
	}
	// 対象外の行(通常技)は従来どおり出る ⇒ レーン自体は機能している。
	if !m3704ScanLane(t, m3704Self(nil), -20, totals, model.PunishLaneDash)[204] {
		t.Fatal("通常技すらダッシュ経由レーンに出ていない(テストが空回りしている)")
	}
	// 値を入れればその値で判定される。slack=10 なので 10 は成立・11 は不成立。
	if !m3704ScanLane(t, m3704Self(ip(10)), -20, totals, model.PunishLaneDash)[200] {
		t.Error("first_hit_startup=10(== slack)がダッシュ経由レーンに出ていない(境界)")
	}
	if m3704ScanLane(t, m3704Self(ip(11)), -20, totals, model.PunishLaneDash)[200] {
		t.Error("first_hit_startup=11(> slack=10)がダッシュ経由レーンに出ている")
	}
}

// TestScan_TargetComboNullFirstHit_Excluded は §5-2 ——
// first_hit_startup が NULL の対象行が、有利 5F で候補から外れることを名指しで固定する。
func TestScan_TargetComboNullFirstHit_Excluded(t *testing.T) {
	got := m3704Scan(t, m3704Self(nil))
	if got[200] {
		t.Errorf("fuwa_triple_strike_2hits(first_hit_startup=NULL)が有利 5F で候補に出ている。" +
			"⇒ 実際には初段 6F から始まるため入らない(B06 の偽陽性)")
	}
}

// TestScan_TargetComboWithFirstHit_JudgedByIt は §5-1 ——
// 値が入っている行は、その値で判定されることを固定する。
func TestScan_TargetComboWithFirstHit_JudgedByIt(t *testing.T) {
	// 初段 6F: 有利 5F では入らない(6 > 5)。★startup=5 のままなら通ってしまう。
	if m3704Scan(t, m3704Self(ip(6)))[200] {
		t.Error("first_hit_startup=6 なのに有利 5F で候補に出ている(startup=5 で判定している疑い)")
	}
	// 初段 5F: 有利 5F でちょうど入る(5 <= 5)。
	if !m3704Scan(t, m3704Self(ip(5)))[200] {
		t.Error("first_hit_startup=5 なら有利 5F で候補に出るはず(境界)")
	}
	// 表示される発生も判定に使った値であること(判定 6F / 表示 5F の食い違いを作らない)。
	tree, err := m3704Svc(m3704Self(ip(4))).Scan(context.Background(),
		ScanParams{self, oppC, model.PunishGuardTypeBlock})
	if err != nil {
		t.Fatal(err)
	}
	for _, om := range tree.Nodes {
		for _, st := range om.Starters {
			if st.MoveID == 200 && (st.Startup == nil || *st.Startup != 4) {
				t.Errorf("応答の startup = %v, want 4(判定に使った first_hit_startup)", st.Startup)
			}
		}
	}
}

// TestScan_NonTargetRows_Unchanged は §5-4 の偽陰性確認 ——
// 非 derived / through / unknown / 通常技は candidateStartup が startup を返すため、
// first_hit_startup が NULL のままでも候補から消えない。
//
// ★述語から startup_basis を落として 3 条件にすると、through と unknown の 2 本がここで落ちる。
func TestScan_NonTargetRows_Unchanged(t *testing.T) {
	got := m3704Scan(t, m3704Self(nil))
	for _, c := range []struct {
		id   int64
		what string
	}{
		{201, "非 derived の target_combo(実データ 9 行)"},
		{202, "basis=through の target_combo(実データ 4 行)"},
		{203, "basis=unknown の target_combo(実データ 4 行)"},
		{204, "普通の通常技"},
	} {
		if !got[c.id] {
			t.Errorf("%s が候補から消えている(偽陰性。除外の範囲を広げすぎている)", c.what)
		}
	}
}

// TestScan_DestructiveCheck_ReturnsWhenGateRemoved は §5-3 の破壊確認 ——
// 除外を外すと対象行が同じ有利 5F で候補に*戻る*ことを、Scan を通して見る。
//
// ★★これが無いと「候補から消えた」ことしか言えない。消えた理由が本当に本サブの歯止めなのか、
//
//	damage=0 や is_aerial など別の条件で落ちているだけなのかを区別できない。
//	⇒ 同じフィクスチャのまま「ゲートだけ」を外して、戻ることを 2 通りで見る。
func TestScan_DestructiveCheck_ReturnsWhenGateRemoved(t *testing.T) {
	// (0) ゲートあり: 出ない。
	if m3704Scan(t, m3704Self(nil))[200] {
		t.Fatal("前提が崩れている: ゲートありで候補に出ている")
	}

	// (1) 述語を外す —— 同じ行の startup_basis だけを through にすると usesFirstHitStartup が
	//     false になり、変更前とまったく同じ「startup をそのまま使う」判定へ戻る。
	//     ⇒ startup=5 <= adv=5 で候補に戻る。
	off := m3704Self(nil)
	off[0].StartupBasis = model.MoveStartupBasisThrough
	if !m3704Scan(t, off)[200] {
		t.Error("除外を外しても候補に戻らない。⇒ この行は別の理由(damage / is_aerial 等)で" +
			"落ちており、本サブの歯止めを証明できていない")
	}

	// (2) 値を入れる —— 述語はそのままに first_hit_startup を埋めると戻る。
	//     ⇒ 除外の理由が「NULL であること」だけであると言える。
	if !m3704Scan(t, m3704Self(ip(5)))[200] {
		t.Error("値を入れても候補に戻らない")
	}

	// (3) 単体でも同じことを述語の側から確かめる(Scan の他の除外条件に紛れないため)。
	sm := m3704Self(nil)[0]
	if sm.Code != "fuwa_triple_strike_2hits" {
		t.Fatalf("フィクスチャの並びが変わっている: %s", sm.Code)
	}
	if got := candidateStartup(sm); got != nil {
		t.Errorf("現在の述語で候補になっている(発生 %d)", *got)
	}
	if sm.Startup == nil || *sm.Startup > 5 {
		t.Fatalf("変更前の述語の素材が無い/成立しない(startup=%v)。破壊確認が空回りしている",
			sm.Startup)
	}
}

// TestUsesFirstHitStartup_Predicate は述語そのものを表で固定する。
//
// ★3 属性がそろったときだけ true であること —— 1 つでも欠けると範囲が変わる。
func TestUsesFirstHitStartup_Predicate(t *testing.T) {
	base := punish.ScanMove{
		Category: model.MoveCategoryTargetCombo, IsDerived: true,
		StartupBasis: model.MoveStartupBasisStandalone,
	}
	if !usesFirstHitStartup(base) {
		t.Error("3 属性がそろった行が対象になっていない")
	}
	for _, c := range []struct {
		name string
		mod  func(*punish.ScanMove)
	}{
		{"category が normal", func(m *punish.ScanMove) { m.Category = model.MoveCategoryNormal }},
		{"is_derived が false", func(m *punish.ScanMove) { m.IsDerived = false }},
		{"basis が through", func(m *punish.ScanMove) { m.StartupBasis = model.MoveStartupBasisThrough }},
		{"basis が unknown", func(m *punish.ScanMove) { m.StartupBasis = model.MoveStartupBasisUnknown }},
	} {
		m := base
		c.mod(&m)
		if usesFirstHitStartup(m) {
			t.Errorf("%s の行まで対象にしている(除外の範囲が広がっている)", c.name)
		}
	}
}

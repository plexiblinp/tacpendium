package migration_test

// M19-05 が変えた候補集合の規則を、実 seed データ上で固定する。
//
// ★★★【M33-03・2026-09-19 で作り直した】着手時点の本ファイルは、期待値を
// 「v68 適用後・17 キャラ seed 済み」の実測値で凍結し、m1905Version(68) へ版を固定して
// いた。⇒ M33-02 が旧 111 本を新系列 9 本へ潰したため、版を固定する機構そのものが
// 消えた。★同時に、凍結していた数値はすべて失効した(31 キャラ seed 済みの現在は
// target_combo 80 -> 126 / filler 候補 1482 -> 2730 など)。
//
// ★★作り直しの方針＝凍結した写真をやめ、「旧規則(SQL の対照群) と 新規則(本番の
// ProjectCandidates) の差分が、ゲートの述語そのもので説明できること」を主張する。
//
//	⇒ Go の実装と SQL の述語を突き合わせる形なので、実装を 2 つ持つ意味がある
//	  (トートロジーにならない)。★そして seed 波が進んでも落ちない——増えたキャラの
//	  行は、両辺に同じだけ現れる。
//
// ★★旧版が版を固定していた理由(逐語)は「HEAD で走らせると残り 14 キャラの seed 波が
// 入った瞬間に TestM1905_* が落ちる。しかも『M19-05 が契約を破った』と読める名前で
// 落ちるため、正しい対応(期待値の更新)と名前が示唆する対応(実装を疑う)が食い違う」
// であった。⇒ 本作り直しはその懸念に別の形で答えている——**期待値を持たないので
// 更新する必要が無い**。
//
// ★★★凍結していた v68 の全数リストは、下の各テストのコメントへ逐語で残した。
// ⇒ あれは当時*人が確認した*列挙であり、述語へ置き換えると人手レビューの痕跡が消える。
//
// ★★申し送り(M33-03)＝本ファイルは setplay サービスのロジックテストであり、
// internal/infra/migration に住んでいる理由はもう無い(マイグレの版を固定するために
// ここに居た)。⇒ setplay サービスの隣へ移すのが筋だが、移設は差分が大きいため
// 本サブの射程外とした。
//
// ★緩和側と維持側を対で固定する(SUPP-001 §5.5.2 (3))。
//
//	「新たに入った件数」だけを固定すると、条件を広く当てすぎても検出できない。

import (
	"database/sql"
	"sort"
	"testing"
)

// m1905DB は HEAD まで適用した DB を返す。
//
// ★★M33-03 までは m1905Version(68) へ版を固定していた。⇒ その版が存在しなくなった
// ため HEAD へ寄せた。★期待値を持たない形へ作り直したので、HEAD で走らせても
// seed 波で落ちない(ヘッダ参照)。
func m1905DB(t *testing.T) *sql.DB {
	t.Helper()
	m, db := newMigrator(t)
	t.Cleanup(func() { _ = db.Close() })
	if err := m.Up(); err != nil {
		t.Fatalf("migrate to HEAD: %v", err)
	}
	return db
}

// m1905ServiceFillers は本番の ProjectCandidates が返す filler 候補の全数を
// "キャラ/技" のキーで返す。
func m1905ServiceFillers(t *testing.T, db *sql.DB) map[string]bool {
	t.Helper()
	out := map[string]bool{}
	for _, c := range canarySetplayCharacters(t, db) {
		for _, code := range canarySetplayProject(t, db, c.id).FillerCodes {
			out[c.code+"/"+code] = true
		}
	}
	return out
}

// m1905ServiceTargets は本番の ProjectCandidates が返す target 候補の全数を返す。
func m1905ServiceTargets(t *testing.T, db *sql.DB) map[string]bool {
	t.Helper()
	out := map[string]bool{}
	for _, c := range canarySetplayCharacters(t, db) {
		for _, code := range canarySetplayProject(t, db, c.id).TargetCodes {
			out[c.code+"/"+code] = true
		}
	}
	return out
}

// m1905SetOf は SQL 述語に当たる行の集合を返す。
func m1905SetOf(t *testing.T, db *sql.DB, where string) map[string]bool {
	t.Helper()
	out := map[string]bool{}
	for _, k := range canarySetplayCodes(t, db, where) {
		out[k] = true
	}
	return out
}

// m1905Diff は a にあって b に無いものを並べて返す。
func m1905Diff(a, b map[string]bool) []string {
	var out []string
	for k := range a {
		if !b[k] {
			out = append(out, k)
		}
	}
	sort.Strings(out)
	return out
}

// m1905AssertSameSet は 2 つの集合が一致することを主張する。
//
// ★片方が空のときは「空 == 空」で通り得るため、母数の生存確認を呼び出し側で行う。
func m1905AssertSameSet(t *testing.T, label string, got, want map[string]bool) {
	t.Helper()
	if extra := m1905Diff(got, want); len(extra) != 0 {
		t.Errorf("%s: 述語で説明できない行が %d 件ある: %v", label, len(extra), extra)
	}
	if missing := m1905Diff(want, got); len(missing) != 0 {
		t.Errorf("%s: 述語に当たるのに実際はそうなっていない行が %d 件ある: %v", label, len(missing), missing)
	}
}

// 基準時点 2026-08-09 / v68 の実測。
const ()

// ★★【2026-09-12 更新・M30-07】guile の【ジャスト】版 move_code が接頭形
//
//	`perfect_timing_<強度>_<技>` から接尾形 `<技>_perfect_<強度>` へ揃った(マイグレ 000112)。
//	golden 000026 を再生成した手番であるため、その版に固定された本ファイルの主張も追随させた
//	(SUPP-001 §5.5.4 規約 (16)。歯止め (a) 同一手番 / (b) 要素数不変 / (c) 先に赤を実測 /
//	 (d) 見出しは役割で書く)。★主張の本数も強さも 1 つも減らしていない。
//
// m1905Gate2Standalone / m1905Gate2Unknown はゲート 2(単独入力不可)の除外行。
// ★'standalone' 由来と 'unknown' 由来を分けて固定する(§4.2-3)。
// 'unknown' は CHANGE-093／D-227 で述語へ追加された側であり、混ぜると拡張の効果が見えなくなる。
var ()

// soloUnavailableSQL は DES-003 §3.3 の「単独では出せない」述語(SQL 版)。
// ★本番の判定は internal/service/setplay の isSoloUnavailable が持つ。ここは全数列挙のための
// 射影であり、判定の正本ではない(規則の二重実装を避けるため、候補集合そのものの検証は
// ProjectCandidates 経由で行う)。
const soloUnavailableSQL = `m.startup_basis IN ('standalone','unknown')
  AND EXISTS(SELECT 1 FROM move_derivations d WHERE d.child_move_id = m.id)`

// TestM1905_Gate1_TargetComboSplit はゲート 1 の緩和側と維持側を対で固定する。
//
// ★★M33-03: 凍結した件数(target_combo 全数 80 / 維持 76 / 緩和 4)をやめ、
// 「本番の filler 候補が、旧規則の集合にゲート 1 の述語を足したものと一致する」形へ変えた。
// ⇒ 旧規則は SQL の対照群、新規則は ProjectCandidates。★差分が述語そのもので
// 説明できることを見るので、キャラが増えても落ちない。
//
// ★v68・17 キャラ時点に人が確認した緩和 4 行(歴史記録):
//
//	zangief/machine_gun_chops ／ zangief/machine_gun_chops_2hits ／
//	zangief/power_stomps ／ zangief/power_stomps_2hits
//	⇒ いずれも category='target_combo' ∧ is_derived=0。現在は 8 行(aki 2 / e_honda 2 が増えた)。
func TestM1905_Gate1_TargetComboSplit(t *testing.T) {
	db := m1905DB(t)

	// 母数の生存確認。★これが 0 だと以下の集合比較が「空 == 空」で空振りする。
	total := scanInt(t, db, `SELECT count(*) FROM moves WHERE category='target_combo'`)
	if total == 0 {
		t.Fatalf("target_combo が 0 行(母集団が壊れている)")
	}

	// ★維持側と緩和側は is_derived で分割される。⇒ 件数ではなく分割で見る。
	keptOut := scanInt(t, db, `SELECT count(*) FROM moves WHERE category='target_combo' AND is_derived=1`)
	newlyIn := scanInt(t, db, `SELECT count(*) FROM moves WHERE category='target_combo' AND is_derived=0`)
	if keptOut+newlyIn != total {
		t.Errorf("target_combo が is_derived で分割されていない: %d + %d <> %d", keptOut, newlyIn, total)
	}
	if newlyIn == 0 {
		t.Fatalf("ゲート 1 で緩和される行が 0(ゲートが効いていないか母集団が壊れている)")
	}

	// ★★本番の filler 候補 ∖ 旧規則の集合 == ゲート 1 の述語の集合。
	service := m1905ServiceFillers(t, db)
	oldRule := m1905SetOf(t, db, `m.total >= 1 AND m.category <> 'target_combo'`)
	gate1 := m1905SetOf(t, db, `m.category='target_combo' AND m.is_derived=0`)

	added := map[string]bool{}
	for _, k := range m1905Diff(service, oldRule) {
		added[k] = true
	}
	m1905AssertSameSet(t, "ゲート 1 で新たに filler 候補へ入った行", added, gate1)
}

// TestM1905_Gate2_SoloUnavailable はゲート 2 の除外行を述語で固定する。
//
// ★★M33-03: 凍結した全数リスト(standalone 由来 11 行 / unknown 由来 5 行)をやめ、
// 「旧規則の集合 ∖ 本番の filler 候補 == soloUnavailableSQL の集合」へ変えた。
//
// ★v68・17 キャラ時点に人が確認した除外行(歴史記録):
//
//	standalone 由来 11 行＝guile/sonic_cross_{heavy,light,medium,od,perfect_od} ／
//	  kimberly/step_up_{backward,forward,neutral} ／
//	  zangief/{crouching_light_kick_rapid,crouching_light_punch_rapid,standing_light_punch_rapid}
//	unknown 由来 5 行＝ken/{gorai_axe_kick,kazekama_shin_kick,senka_snap_kick} ／
//	  m_bison/{devil_reverse_od,head_press_od}
//	⇒ 現在は standalone 由来 97 行 / unknown 由来 28 行(キャラが 17 -> 31 になった分)。
func TestM1905_Gate2_SoloUnavailable(t *testing.T) {
	db := m1905DB(t)

	service := m1905ServiceFillers(t, db)
	oldRule := m1905SetOf(t, db, `m.total >= 1 AND m.category <> 'target_combo'`)
	// ★除外の述語は旧規則の母数の中で見る。⇒ 母数の外にある行を数えないため。
	gate2 := m1905SetOf(t, db,
		`m.total >= 1 AND m.category <> 'target_combo' AND `+soloUnavailableSQL)

	if len(gate2) == 0 {
		t.Fatalf("ゲート 2 で除外される行が 0(ゲートが効いていないか母集団が壊れている)")
	}

	removed := map[string]bool{}
	for _, k := range m1905Diff(oldRule, service) {
		removed[k] = true
	}
	m1905AssertSameSet(t, "ゲート 2 で filler 候補から外れた行", removed, gate2)

	// ★内訳が basis の 2 系統に分かれ、取りこぼしが無いこと。
	sa := m1905SetOf(t, db, `m.total >= 1 AND m.category <> 'target_combo' AND `+soloUnavailableSQL+` AND m.startup_basis='standalone'`)
	un := m1905SetOf(t, db, `m.total >= 1 AND m.category <> 'target_combo' AND `+soloUnavailableSQL+` AND m.startup_basis='unknown'`)
	if len(sa)+len(un) != len(gate2) {
		t.Errorf("除外行が basis の 2 系統で分割されていない: standalone %d + unknown %d <> %d",
			len(sa), len(un), len(gate2))
	}
}

// TestM1905_FillerCandidateCount は filler 候補の総数の変遷を固定する。
// 旧規則(対照群)と新規則(本番の ProjectCandidates 経由)を同じ DB で並べて測り、
// 差分がゲート 1 とゲート 2 だけで説明できることを固定する。
//
// ★★M33-03: 検算の「+4 / -16」を*実測したゲートの大きさ*へ差し替えた。
// ⇒ 着手時点は measured な before / after と凍結した 4 / 16 を混ぜていたため、
//
//	キャラが増えると必ず破れた(実測 after=2630 に対し before+4-16=2718)。
//
// ★ゲートの大きさも測れば、同じ検算がそのまま drift-proof になる。
//
// ★v68・17 キャラ時点の値(歴史記録)＝旧規則 1482 / 新規則 1470(= 1482 + 4 - 16)。
//
//	現在は旧規則 2730 / 新規則 2630。
func TestM1905_FillerCandidateCount(t *testing.T) {
	db := m1905DB(t)

	// 対照群: 規則変更前の述語(total >= 1 AND category != 'target_combo')。
	// ★これは「旧規則を意図的に再現した対照群」であり、本番コードの写しではない。
	before := scanInt(t, db, `SELECT count(*) FROM moves WHERE total >= 1 AND category <> 'target_combo'`)
	if before == 0 {
		t.Fatalf("旧規則の filler 候補が 0(母集団が壊れている)")
	}

	after, _ := canarySetplayTotals(t, db)

	gate1 := len(m1905SetOf(t, db, `m.category='target_combo' AND m.is_derived=0`))
	gate2 := len(m1905SetOf(t, db,
		`m.total >= 1 AND m.category <> 'target_combo' AND `+soloUnavailableSQL))
	if gate1 == 0 || gate2 == 0 {
		t.Fatalf("ゲートの大きさが 0(gate1=%d gate2=%d)。⇒ 検算が空振りする", gate1, gate2)
	}

	if want := before + gate1 - gate2; after != want {
		t.Errorf("差分がゲート 1/2 で説明できない: after=%d, before(%d)+gate1(%d)-gate2(%d)=%d",
			after, before, gate1, gate2, want)
	}
	t.Logf("filler 候補: 旧規則 %d -> 新規則 %d (ゲート 1 で +%d / ゲート 2 で -%d)",
		before, after, gate1, gate2)
}

// --- 段階 B: target ゲートの切替(M19-DESIGN-07 §3) ---
//
// is_aerial → fastest_unreachable ／ is_derived → basis ＋ 親参照 へ切り替えた。
// ★解禁側と非解禁側を対で固定する(裁定 §8.2)。「解禁された件数」だけでは、
//
//	条件を広く当てすぎても検出できない。
//
// ★★is_derived ゲートは through で確定した行だけを解禁する。through 以外の派生技
//
//	(状態変種 standalone)は M19-DESIGN-07 §9-4 が「暫定 is_derived ゲート継続」と
//	明記している範囲であり、外すと denjin_charge_* / flame_* / mine_set_* /
//	drink_level_* / windclad_* 等が一斉に target へ入る(実測 +172 行)。
//
// ★★【M35-03・2026-09-11】基準が 903 / 937 から 907 / 941 へ +4 ずつ動いた。
//
//	理由はゲートの変更ではなくデータである——m1905TargetBaseSQL は rush_variant を
//	「original_move_id が normal / unique の move を指していること」で絞る。
//	M35-03 が CSV の original_move_code の dangling 4 件を是正し golden 000026 を
//	再生成したため、ingrid 2 / lily 1 / mai 1 の rush 4 行が解決するようになった。
//	4 行とも基底は unique、startup>=1 / active>=1 / damage>0 / is_aerial=false であり、
//	旧ゲートと新ゲートの両方を通る。⇒ 差は一様に +4 である。
//
// ★★これは SUPP-001 §5.5.4 規約 (16) に基づく追随である(終端 v68 ≧ golden 000026)。
//
//	★本ファイルは "000026" という文字列を 1 度も持たない。⇒ 規約 (16) が言う
//	「golden の版に固定された契約テストを grep で探す」を連番の grep で行うと
//	本ファイルは出てこない。弁別に効いたのは
//	`grep original_move_id --include=*_test.go` ＋「終端がその golden の版以上か」であった。
//
// ★下の対の不変条件(after == before + len(unlocked) - len(excluded) = +57 -23)は
//
//	変わっていない。⇒ 一様な +4 であってゲートが動いたのではないことは、そこで守られる。

// TestM1905_TargetGateSwitch は target ゲート切替の解禁側・非解禁側を対で固定する。
//
// ★★M33-03: 凍結した全数リスト(解禁 57 行 / 除外 23 行)をやめ、
// 「本番の target 候補 と 旧ゲートの集合 の差分が、切替の述語で説明できること」へ変えた。
//
// ★v68・17 キャラ時点の値(歴史記録)＝旧ゲート 907 / 新ゲート 941(= 907 + 57 - 23)。
//
//	解禁 57 行のうち 56 行は startup_basis='through'(through target 解禁そのもの)、
//	残る 1 行 kimberly/elbow_drop は is_derived=0・is_aerial=1・fastest_unreachable=0 で、
//	000067 B の裁定(ジャンプからの通し値=through)により解禁された行であった。
//	除外 23 行は全数 fastest_unreachable=1(B 型＝単独で最速入力しても地上の相手に
//	当てられない技)であり、従来は is_aerial=0 のため target に出ていた誤提案であった。
//
// ★★is_derived ゲートは through で確定した行だけを解禁する。through 以外の派生技
//
//	(状態変種 standalone)は M19-DESIGN-07 §9-4 が「暫定 is_derived ゲート継続」と
//	明記している範囲であり、外すと denjin_charge_* / flame_* / mine_set_* /
//	drink_level_* / windclad_* 等が一斉に target へ入る(v68 時点の実測 +172 行)。
//	⇒ 下の「解禁行の由来が 2 系統だけであること」がその検算である。
func TestM1905_TargetGateSwitch(t *testing.T) {
	db := m1905DB(t)

	// 対照群: 旧ゲートを SQL で再現して同じ DB 上で実測する。
	// ★ハードコード定数どうしの比較にすると恒真式になり、旧ゲートの再現ごと固定できない。
	before := scanInt(t, db, `SELECT count(*) `+m1905TargetBaseSQL+m1905OldTargetGateSQL)
	if before == 0 {
		t.Fatalf("旧ゲートの target 候補が 0(母集団が壊れている)")
	}

	service := m1905ServiceTargets(t, db)
	oldGate := m1905SetOf(t, db,
		`m.startup >= 1 AND m.active >= 1 AND m.damage > 0
		 AND (m.category IN ('normal','unique','throw','special')
		      OR (m.category='rush_variant' AND EXISTS(
		            SELECT 1 FROM moves o WHERE o.id=m.original_move_id AND o.category IN ('normal','unique'))))
		 AND m.is_aerial = 0
		 AND (m.category='rush_variant' OR m.is_derived = 0)`)

	unlocked := map[string]bool{}
	for _, k := range m1905Diff(service, oldGate) {
		unlocked[k] = true
	}
	excluded := map[string]bool{}
	for _, k := range m1905Diff(oldGate, service) {
		excluded[k] = true
	}
	if len(unlocked) == 0 || len(excluded) == 0 {
		t.Fatalf("解禁/除外のどちらかが 0(解禁 %d / 除外 %d)。⇒ ゲートが切り替わっていない疑い",
			len(unlocked), len(excluded))
	}

	// 検算: 総数の差が解禁/除外の大きさで説明できること。
	_, after := canarySetplayTotals(t, db)
	if want := before + len(unlocked) - len(excluded); after != want {
		t.Errorf("差分が解禁/除外で説明できない: after=%d, before(%d)+%d-%d=%d",
			after, before, len(unlocked), len(excluded), want)
	}

	// ★★除外側: 理由は 2 系統だけであること。
	//   (a) fastest_unreachable=1（B 型＝単独で最速入力しても地上の相手に当てられない技）
	//   (b) 単独入力不可（startup_basis が standalone/unknown で、かつ親参照を持つ）
	//       ⇒ 新ゲートは is_derived を「basis ＋ 親参照」へ切り替えたので、こちらも効く。
	//
	// ★★★M33-03 の実測で分かったこと——v68 の凍結リスト 23 行は (a) だけで説明できたが、
	//   HEAD では (b) だけで落ちる行が 12 行ある（ken/ryu/luke/rashid/zangief の
	//   aerial_* 系。いずれも is_aerial=0・is_derived=0・fastest_unreachable=0・
	//   basis=standalone で親参照を持つ）。⇒ 旧テストの「理由は fastest_unreachable
	//   ただ 1 つ」は *17 キャラ時点でたまたま成り立っていた*だけである。
	wantExcluded := m1905SetOf(t, db,
		`m.startup >= 1 AND m.active >= 1 AND m.damage > 0
		 AND (m.category IN ('normal','unique','throw','special')
		      OR (m.category='rush_variant' AND EXISTS(
		            SELECT 1 FROM moves o WHERE o.id=m.original_move_id AND o.category IN ('normal','unique'))))
		 AND m.is_aerial = 0
		 AND (m.category='rush_variant' OR m.is_derived = 0)
		 AND (m.fastest_unreachable = 1 OR (`+soloUnavailableSQL+`))`)
	m1905AssertSameSet(t, "target から外れた行", excluded, wantExcluded)

	// ★★解禁側: 由来は 2 系統だけであること。
	//   (a) startup_basis='through'(is_derived ゲートの through 解禁)
	//   (b) is_derived=0 かつ is_aerial=1 かつ fastest_unreachable=0
	//       (is_aerial -> fastest_unreachable の切替で解禁された側)
	// ⇒ どちらでもない行が 1 行でも在れば、状態変種(standalone)が漏れている。
	wantUnlocked := m1905SetOf(t, db,
		`(m.startup_basis='through'
		  OR (m.is_derived=0 AND m.is_aerial=1 AND m.fastest_unreachable=0))
		 AND m.startup >= 1 AND m.active >= 1 AND m.damage > 0`)
	if stray := m1905Diff(unlocked, wantUnlocked); len(stray) != 0 {
		t.Errorf("through でも is_aerial 切替でもない行を解禁している(状態変種が漏れている疑い): %v", stray)
	}
	t.Logf("target 候補: 旧ゲート %d -> 新ゲート %d (解禁 %d / 除外 %d)",
		before, after, len(unlocked), len(excluded))
}

// m1905TargetBaseSQL は collectTargets の「種別が提供される ∧ startup/active ≥ 1 ∧ damage > 0」
// までを SQL で再現した共通部分(既定 IncludeZeroDamage=false)。ゲート部分だけを差し替えて数える。
const m1905TargetBaseSQL = `
FROM moves m JOIN characters c ON c.id=m.character_id
WHERE m.startup >= 1 AND m.active >= 1 AND m.damage > 0
  AND (m.category IN ('normal','unique','throw','special')
       OR (m.category='rush_variant' AND EXISTS(
             SELECT 1 FROM moves o WHERE o.id=m.original_move_id AND o.category IN ('normal','unique'))))
`

// m1905OldTargetGateSQL は M19-05 以前の target ゲート(対照群)。
// ★これは「旧規則を意図的に再現した対照群」であり、本番コードの写しではない。
// 本番の新ゲートは internal/service/setplay の collectTargets が持ち、
// 新側の実測は ProjectCandidates 経由で行う(規則を二重に持たない)。
const m1905OldTargetGateSQL = `
  AND m.is_aerial = 0
  AND (m.category='rush_variant' OR m.is_derived = 0)
`

// TestM1905_ChainGroupSoloUnavailableIsZangiefOnly は合成 filler 単位の分岐前提を実 seed で固定する。
//
// ★「2 番目以降は単独入力不可の員があればその集合、無ければグループ全員」という規則は、
// 「連打版ではない理由で単独入力不可になっているチェーングループ員が居ない」ことに依存する。
// そういう行が 1 行でも入ると、**そのキャラの 2 番目以降から通常版が一斉に消える
// ——しかもエラーにならない。** 文書(完了報告 §5.1)だけでは seed 波で静かに失効する
// ため、ここで止める。
//
// ★★M33-03: 凍結した件数(チェーングループ員 53 / zangief 3 行 / 1 キャラ)をやめ、
// 「単独入力不可のチェーングループ員は、いずれも連打版(code が _rapid で終わる)であること」
// という述語へ変えた。⇒ これが本来の依存そのものである。★キャラ名でも件数でもない。
//
// ★v68・17 キャラ時点に人が確認した該当行(歴史記録)＝zangief の連打版 3 行
//
//	(crouching_light_kick_rapid / crouching_light_punch_rapid / standing_light_punch_rapid)
//	で、単独入力不可の員を持つキャラは zangief ただ 1 キャラであった。
//	⇒ 現在は 4 行 / 2 キャラ(dhalsim/crouching_light_punch_rapid が増えた。★これも連打版)。
func TestM1905_ChainGroupSoloUnavailableIsZangiefOnly(t *testing.T) {
	db := m1905DB(t)

	// 母数の生存確認。
	members := scanInt(t, db, `SELECT count(*) FROM moves WHERE chain_cancel_total IS NOT NULL`)
	if members == 0 {
		t.Fatalf("チェーングループ員が 0 行(母集団が壊れている)")
	}

	// ★単独入力不可のグループ員は、いずれも連打版であること。
	//   ⇒ 連打版でないものが 1 行でも在れば、上の分岐前提が崩れている。
	soloUnavailable := canarySetplayCodes(t, db,
		`m.chain_cancel_total IS NOT NULL AND `+soloUnavailableSQL)
	rapidOnly := m1905SetOf(t, db,
		`m.chain_cancel_total IS NOT NULL AND m.code LIKE '%\_rapid' ESCAPE '\' AND `+soloUnavailableSQL)
	for _, k := range soloUnavailable {
		if !rapidOnly[k] {
			t.Errorf("連打版でないチェーングループ員が単独入力不可になっている: %s"+
				"（⇒ そのキャラの 2 番目以降から通常版が一斉に消える）", k)
		}
	}
	t.Logf("チェーングループ員 %d 行・うち単独入力不可 %d 行（全数が連打版）: %v",
		members, len(soloUnavailable), soloUnavailable)
}

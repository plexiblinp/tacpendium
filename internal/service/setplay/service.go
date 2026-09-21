package setplay

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"

	"github.com/plexiblinp/tacpendium/internal/model"
	comborepo "github.com/plexiblinp/tacpendium/internal/repository/combo"
	setplayrepo "github.com/plexiblinp/tacpendium/internal/repository/setplay"
	setupsvc "github.com/plexiblinp/tacpendium/internal/service/setup"
)

// ステップの役割。M19-02 で値域に parent を用意し、M19-05 の表記展開で実際に出力を始めた。
const (
	RoleFiller = "filler"
	RoleTarget = "target"
	// RoleParent は表記用親(through の技の直前に前置する行)。
	// 費用規則の分類 1 により計上ゼロ = ProposalStep.Counted が false になる(M19-05)。
	RoleParent = "parent"
)

// 打ち切り関連(§4.3)。「エンジンは安全上限まで全列挙 → グルーがランキング →
// 上位 limit 件を返す」構造。数値の根拠は完了報告 §7.2 の実測(§3.3-1)。
//
//   - engineSafetyCap: エンジン 1 target あたりの全列挙の安全上限。ここに到達した
//     ときのみ truncated=true(=「数え切れていない」の意味に限定)。テストで
//     打ち切り挙動を確認するため var。実測(§3.3-1)では 1 target あたりの解数は
//     この値に遠く及ばない(集計 TotalFound の最大でも gap 全種別 Juri KA40 で 4884・
//     多数 target への分散)ため、実データでは発火しない病的入力向けの後段防御。
//   - defaultLimit: limit 省略時の返却件数(§11-2 暫定=現行表示件数と同じ 200)。
//   - maxLimit: limit の上限。超過指定はここへ丸める(エラーにしない=n_min の流儀)。
//     実測の meaty 全種別最大 677・gap 既定種別最大 2875 を包含する 3000 とし、
//     既定運用(meaty・gap 既定種別)は全件到達可能にする。全種別 gap の 4884 は上位
//     優先で表示(ランキング後に切るため隠れるのは価値の低い分=§4.3 設計意図)。
var engineSafetyCap = 6000

const (
	defaultLimit = 200
	maxLimit     = 3000
)

// gap(汚連携)モードの G 範囲(開発者確定 2026-07-26)。G は 1〜13 で丸める。
const (
	gapGMinFloor   = 1  // g_min の下限(1 未満は 1 へ)。
	gapGMaxDefault = 13 // g_max の既定かつ上限(未指定・超過は 13 へ)。
)

// 提案モード(§4.4)。
const (
	ModeMeaty = "meaty" // 重ねる(既存挙動)。既定。
	ModeGap   = "gap"   // あえて重ねない(汚連携=完全空振り)。受理帯を [active+Gmin, active+Gmax] に差し替える。
)

// ReasonKnockdownNegative は負 KA のとき提案 0 件の理由としてレスポンスに載せる
// 専用コード(§4.2)。NULL の ErrKnockdownNotSet(400)とは別で、これは 200 で返す。
const ReasonKnockdownNegative = "knockdown_advantage_negative"

// エラーセンチネル。
var (
	// ErrComboNotFound は対象コンボが見つからない場合に返る。
	ErrComboNotFound = errors.New("setplay: combo not found")
	// ErrKnockdownNotSet はコンボの knockdown_advantage が未入力(NULL)の場合に返る。
	// ハンドラは 400 系へマップし、UI が「有利フレーム未入力」と表示できるようにする。
	ErrKnockdownNotSet = errors.New("setplay: knockdown advantage not set")
)

// 対象種別(target type)キー。category + is_projectile(+ rush は元技 category)から算出する(§4.2 拡張)。
const (
	TargetTypeNormal            = "normal"             // 通常技
	TargetTypeUnique            = "unique"             // 特殊技
	TargetTypeSpecial           = "special"            // 必殺技(非弾)
	TargetTypeSpecialProjectile = "special_projectile" // 必殺技(弾)
	TargetTypeThrow             = "throw"              // 投げ
	TargetTypeNormalRush        = "normal_rush"        // 通常技(ラッシュ版)
	TargetTypeUniqueRush        = "unique_rush"        // 特殊技(ラッシュ版)
	// 元技が special 等のラッシュ版・その他の派生種別は提供しない("" 扱い)。
)

// isRushTargetType は rush 種別か。rush は is_derived=true が正常なため列挙時に除外しない。
func isRushTargetType(t string) bool {
	return t == TargetTypeNormalRush || t == TargetTypeUniqueRush
}

// SuggestSort は並べ替えモード。
type SuggestSort string

const (
	// SortByN は持続が深い順(N 降順)。既定。
	SortByN SuggestSort = "n"
	// SortByTarget は重ねる技(target)順。
	SortByTarget SuggestSort = "target"
)

// SuggestParams は提案生成の絞り込み・並べ替え指定。
type SuggestParams struct {
	// NMin は最小持続番号。0(未指定)は既定 1。エンジンが 1 未満を 1 に丸める。
	NMin int
	// NMax は最大持続番号(N の上限)。meaty モードでのみ有効。0/未指定は上限なし
	// (=target.Active まで)。持続の長い技(波動拳など、画面に残る弾の硬直を持続扱い
	// している target)で深い N を切り落とし候補を絞るために使う。NMax<NMin は空結果。
	NMax int
	// TargetTypes は自動列挙で許可する対象種別キー集合。空は「該当なし=結果なし」。
	// TargetMoveID 指定時は無視される。
	TargetTypes []string
	// IncludeZeroDamage が true のとき damage 0/NULL の技も target 対象にする。
	// 既定 false = damage>0 のみ(ドライブパリィ等のダメージ0技を除外)。
	// system は type="" のため元から自動対象外。
	IncludeZeroDamage bool
	// Sort は並べ替えモード。"" は SortByN 扱い。
	Sort SuggestSort
	// TargetMoveID は明示指定 target。nil で自動列挙(§4.2 の種別/damage/is_derived/is_aerial を適用)。
	TargetMoveID *int64
	// Mode は提案モード(§4.4)。"" / ModeMeaty は重ねる(既存)。ModeGap はあえて重ねない。
	Mode string
	// GMin/GMax は gap モードの G 範囲(§4.4)。Mode!=gap のとき無視。
	// GMin<1 は 1、GMax>13 または未指定(0)は 13 に丸める。GMin>GMax は空結果。
	GMin int
	GMax int
	// Limit は返却件数の上限(§4.3)。0/未指定は defaultLimit、maxLimit 超過は丸める。
	Limit int
}

// moveTargetType は category + is_projectile(+ rush は元技 category)から対象種別キーを返す。
// 提供しない種別(super_art / system / 元 special のラッシュ等)は "" を返す。
// catByID は同キャラ move の id→category マップ(rush_variant の元技分類に使う)。
func moveTargetType(mc setplayrepo.MoveCandidate, catByID map[int64]string) string {
	switch mc.Category {
	case model.MoveCategoryNormal:
		return TargetTypeNormal
	case model.MoveCategoryUnique:
		return TargetTypeUnique
	case model.MoveCategoryThrow:
		return TargetTypeThrow
	case model.MoveCategorySpecial:
		if mc.IsProjectile {
			return TargetTypeSpecialProjectile
		}
		return TargetTypeSpecial
	case model.MoveCategoryRushVariant:
		// 元技のカテゴリで rush 種別を判定する(元 normal→normal_rush、元 unique→unique_rush)。
		if mc.OriginalMoveID == nil {
			return ""
		}
		switch catByID[*mc.OriginalMoveID] {
		case model.MoveCategoryNormal:
			return TargetTypeNormalRush
		case model.MoveCategoryUnique:
			return TargetTypeUniqueRush
		default:
			return "" // 元 special 等のラッシュは提供しない
		}
	default:
		return ""
	}
}

// ProposalStep は提案の 1 ステップ(表示順)。
type ProposalStep struct {
	MoveID  int64
	Code    string
	Role    string
	Counted bool
}

// Proposal は 1 件の提案。
type Proposal struct {
	Steps          []ProposalStep
	S              int // 第 1 active の絶対フレーム
	N              int // 起き上がりに重なる持続フレーム番号
	Landing        int // = KA + 1
	TargetActive   int
	AlreadyAdopted bool
	Mode           string // "meaty" | "gap"(§4.4)
	G              int    // gap のとき = N − active(最終 active が起き上がりの G フレーム前＝完全空振り)。meaty のとき 0

	// ランキング・内部処理用の非公開フィールド(JSON 非公開)。
	targetCode string // 重ねる技(target)の code。sort=target の第 1 キー
	sumFiller  int    // Σ filler.total
	sortName   string // 決定論的タイブレーク用(全ステップ code の連結)
	recipeHash string // alreadyAdopted 判定用(返却分だけ後段で dup 判定=N+1 解消)
}

// SuggestResult は提案生成の結果。
type SuggestResult struct {
	// Proposals はランキング後に上位 limit 件へ絞った提案。
	Proposals []Proposal
	// Truncated はエンジンが安全上限(engineSafetyCap)に到達し「数え切れていない」
	// ときのみ true。limit で切っただけの状態は Truncated にしない(§4.3.2-3)。
	Truncated bool
	// TotalFound はランキング対象となった総解数(limit で切る前)。UI の件数表示・
	// 「さらに表示」の要否判定に使う(§4.3)。
	TotalFound int
	// Reason は提案 0 件を返す際の理由コード(現状は負 KA のみ=ReasonKnockdownNegative)。
	// 正常に提案がある場合は空。
	Reason string
}

// ComboReader は親コンボの読み取り(KA・characterId 取得)。setup サービスと同型。
type ComboReader interface {
	FindByID(ctx context.Context, id int64) (*model.Combo, error)
}

// MoveCandidateReader はキャラの moves 候補と親子関係を読む。
type MoveCandidateReader interface {
	ListCharacterMoveCandidates(ctx context.Context, characterID int64) ([]setplayrepo.MoveCandidate, error)
	ListCharacterMoveDerivations(ctx context.Context, characterID int64) ([]setplayrepo.MoveDerivation, error)
}

// isSoloUnavailable は「単独では出せない(親からの派生でのみ出る)技」を判定する。
// 正本は DES-003 §3.3 / M19-DESIGN-07 §5-4(CHANGE-093・D-227 で 'unknown' を含めた)。
//
// ★この述語が答えるのは「自分がこの技を単独で入力できるか」である。
// 「相手がこの技を出しうるか」(確定反撃サーチの相手技候補)には転用しないこと——
// 親から出せば実機で成立する技を落とす偽陰性になる(D-260)。
//
// hasParent は move_derivations に子として存在するか。同じ概念の判定をここ 1 本に集約し、
// filler ゲート・target ゲート・合成 filler 単位の 3 箇所がすべてこれを呼ぶ(第 2 の述語を作らない)。
func isSoloUnavailable(m setplayrepo.MoveCandidate, hasParent bool) bool {
	if !hasParent {
		return false
	}
	return m.StartupBasis == model.MoveStartupBasisStandalone ||
		m.StartupBasis == model.MoveStartupBasisUnknown
}

// DuplicateChecker は VAL-S04 と同一基準(同一親コンボ・同一レシピ・名前非依存)の
// 重複判定。setup リポジトリの FindDuplicateInCombo が満たす。alreadyAdopted に使う。
type DuplicateChecker interface {
	FindDuplicateInCombo(ctx context.Context, comboID int64, characterID int64, recipeHash string, excludeSetupID *int64) (*int64, error)
}

// Service はセットプレイ自動提案のグルー層。
type Service interface {
	// SuggestForCombo は comboID の KA から成立するセットプレイ提案を返す(副作用なし)。
	SuggestForCombo(ctx context.Context, comboID int64, params SuggestParams) (*SuggestResult, error)
}

type service struct {
	comboReader ComboReader
	moveReader  MoveCandidateReader
	dupChecker  DuplicateChecker
}

// NewService はグルー層 Service を構築する。
func NewService(comboReader ComboReader, moveReader MoveCandidateReader, dupChecker DuplicateChecker) Service {
	return &service{comboReader: comboReader, moveReader: moveReader, dupChecker: dupChecker}
}

func (s *service) SuggestForCombo(ctx context.Context, comboID int64, params SuggestParams) (*SuggestResult, error) {
	combo, err := s.comboReader.FindByID(ctx, comboID)
	if err != nil {
		if errors.Is(err, comborepo.ErrNotFound) {
			return nil, ErrComboNotFound
		}
		return nil, fmt.Errorf("find combo: %w", err)
	}
	// M19-LIMITATION-NOTICE (d): KA(knockdown_advantage)が NULL のコンボは提案不可。
	//   この扱いを変更したら、ヒント文面(web i18n `setplay.limitations.*`。
	//   web/src/features/setplay/ 配下)を同時に更新すること。
	if combo.KnockdownAdvantage == nil {
		return nil, ErrKnockdownNotSet
	}
	ka := *combo.KnockdownAdvantage
	landing := ka + 1

	// M19-LIMITATION-NOTICE (e): 負 KA(有利フレームがマイナス)のコンボは提案不可。
	//   NULL(400)とは別で、保存が許される正当値(VAL-C10)のため 200 + 専用理由コードで返す。
	//   この扱いを変更したら、ヒント文面(web i18n `setplay.limitations.*`)を同時に更新すること。
	if ka < 0 {
		return &SuggestResult{Proposals: []Proposal{}, Reason: ReasonKnockdownNegative}, nil
	}

	mode := params.Mode
	if mode == "" {
		mode = ModeMeaty
	}

	cands, err := s.moveReader.ListCharacterMoveCandidates(ctx, combo.CharacterID)
	if err != nil {
		return nil, fmt.Errorf("list move candidates: %w", err)
	}

	derivations, err := s.moveReader.ListCharacterMoveDerivations(ctx, combo.CharacterID)
	if err != nil {
		return nil, fmt.Errorf("list move derivations: %w", err)
	}
	parentsByChild := make(map[int64][]int64, len(derivations))
	for _, d := range derivations {
		parentsByChild[d.ChildMoveID] = append(parentsByChild[d.ChildMoveID], d.ParentMoveID)
	}

	byID := make(map[int64]setplayrepo.MoveCandidate, len(cands))
	for _, m := range cands {
		byID[m.ID] = m
	}
	// 表記用親の解決器。through の技の直前に前置する親を決める(費用規則 分類 1 = 計上ゼロ)。
	parentOf := newParentResolver(byID, parentsByChild)

	singles := collectFillerSingles(cands, parentsByChild)
	units := buildFillerUnits(singles, cands, parentsByChild, ka+2)
	unitByName := make(map[string]fillerUnit, len(units))
	fillers := make([]Move, 0, len(units))
	for _, u := range units {
		unitByName[u.Name] = u
		fillers = append(fillers, Move{Name: u.Name, TotalFrames: u.Total})
	}

	targets := collectTargets(cands, parentsByChild, params)

	opt := DefaultOptions()
	if params.NMin != 0 {
		opt.NMin = params.NMin // NMin < 1 はエンジンが 1 へ丸める。gap では帯に用いず無視される。
	}
	// エンジンは安全上限まで全列挙する(打ち切りはランキング後にグルーで行う=§4.3.2)。
	opt.MaxResults = engineSafetyCap

	// 安全上限に到達した(=数え切れていない)ときのみ truncated=true。
	truncated := false
	proposals := []Proposal{}
	for _, tc := range targets {
		target := Target{Name: tc.Code, Startup: *tc.Startup, Active: *tc.Active}
		// M19-LIMITATION-NOTICE (f): 受理帯の差し替えだけでモード/上限を実現する
		//   (探索構造・恒等式は不変)。この扱いを変更したら、ヒント文面を同時に更新すること。
		optT := opt
		if mode == ModeGap {
			// M19-02-GAP-DEF: gap は N を [active+Gmin, active+Gmax] へ(完全空振り)。ロールバック点。
			optT.Band = gapBand(params.GMin, params.GMax, target.Active)
		} else {
			optT.Band = meatyBand(opt.NMin, params.NMax, target.Active) // meaty は n_max 指定時のみ上限を絞る。
		}
		suggestions, serr := Suggest(ka, fillers, target, optT)
		if serr != nil {
			// target は事前フィルタ済みのため通常到達しないが、防御的にスキップ。
			continue
		}
		if opt.MaxResults > 0 && len(suggestions) >= opt.MaxResults {
			truncated = true
		}
		for _, sg := range suggestions {
			proposals = append(proposals, buildProposal(landing, mode, tc, sg, unitByName, parentOf))
		}
	}

	// M19-LIMITATION-NOTICE (g): 打ち切りはここ(ランキング後)で行う。エンジンの安全上限
	//   より前ではない。この扱いを変更したら、ヒント文面を同時に更新すること。
	rank(proposals, params.Sort, mode == ModeGap)
	totalFound := len(proposals)

	limit := params.Limit
	if limit <= 0 {
		limit = defaultLimit
	}
	if limit > maxLimit {
		limit = maxLimit // 超過指定は丸める(エラーにしない=n_min の流儀)。
	}
	if len(proposals) > limit {
		proposals = proposals[:limit] // limit 切りは truncated にしない(§4.3.2-3)。
	}

	// alreadyAdopted は返却する分(≤limit)だけ算出する(打ち切り前の全件で回さない=N+1 解消)。
	for i := range proposals {
		dupID, derr := s.dupChecker.FindDuplicateInCombo(ctx, comboID, combo.CharacterID, proposals[i].recipeHash, nil)
		if derr != nil {
			return nil, fmt.Errorf("check already adopted: %w", derr)
		}
		proposals[i].AlreadyAdopted = dupID != nil
	}

	return &SuggestResult{Proposals: proposals, Truncated: truncated, TotalFound: totalFound}, nil
}

// meatyBand は meaty モードで n_max(N の上限)が指定されたときだけ受理帯を
// [max(1,nMin), min(active, nMax)] に絞る。nMax<=0 は絞りなし(nil=既定挙動＝
// 一般化前と完全一致)。nMax<nMin のときは Lo>Hi となりエンジンが空結果を返す。
func meatyBand(nMin, nMax, active int) *NBand {
	if nMax <= 0 {
		return nil
	}
	lo := nMin
	if lo < 1 {
		lo = 1
	}
	hi := active
	if nMax < hi {
		hi = nMax
	}
	return &NBand{Lo: lo, Hi: hi}
}

// M19-02-GAP-DEF: gap(あえて重ねない=完全空振り)モードの受理帯を返す。ロールバック点。
//
// gap の隙間 G ＝「target の**最終** active が起き上がり(KA+1)より何フレーム前に出るか」
// (＝技を丸ごと空振りさせ、起き上がりに一切重ねない)。
//
//	最終 active = (KA+1) − G、最終 active = S + active − 1、N = KA+2 − S ⟹ **G = N − active**。
//
// よって N の受理帯は [active + Gmin, active + Gmax]。G≥1 で最終 active ≤ KA(起き上がり前)
// ＝完全空振りが保証され、N > active ゆえ meaty(N ≤ active)と**完全に排他**になる。
//
// 【経緯】当てる意図のセットプレイは meaty で実現済みのため、gap は「当てない」専用。
// 定義は 2 度是正した(後→第1active前→最終active前=完全空振り。開発者確認 2026-07-26)。
// 実機フィードバックで覆る可能性があるため本関数に隔離し、単一コミット revert で戻せる。
//
// GMin<1→1、GMax>13 または未指定(0)→13 に丸める。GMin>GMax のときは Lo>Hi となり
// エンジンが空結果を返す。active は target ごとに異なるため per-target で渡す。
func gapBand(gMin, gMax, active int) *NBand {
	if gMin < gapGMinFloor {
		gMin = gapGMinFloor
	}
	if gMax <= 0 || gMax > gapGMaxDefault {
		gMax = gapGMaxDefault
	}
	return &NBand{Lo: active + gMin, Hi: active + gMax}
}

// collectFillerSingles は単発 filler の候補集合を返す(M19-05 段階 A)。
//
// 述語(M19-DESIGN-07 §5-3/§5-4・M19-DESIGN-08 §1):
//
//	total >= 1
//	  AND NOT (category = 'target_combo' AND is_derived = 1)   -- ゲート 1
//	  AND NOT 単独入力不可                                       -- ゲート 2
//
// ★ゲート 1 は「category を外す」ではなく「category を is_derived へ置き換える」ものである。
// 外すと篩が全部落ちる(D-148)。空振りでも出るパターン 3 だけが新たに候補へ入り、
// 前段のヒット/ガードを要するパターン 1/2 は引き続き除外される。
//
// ★ゲート 2 は設計過程で発見された既存の穴の是正(単独入力不可の除外が無かった)。
// 該当行はチェーン合成・表記展開の経由でのみ登場させる——除外して終わりにしない。
//
// ★is_derived / rush_variant / setup_only 単独では絞らない(M19-02 §4.1「除外しないもの」)。
//
// M19-LIMITATION-NOTICE (c): この filler 規則を変更したら、ヒント文面
// (web i18n `setplay.limitations.*`)を同時に更新すること。
func collectFillerSingles(cands []setplayrepo.MoveCandidate, parentsByChild map[int64][]int64) []setplayrepo.MoveCandidate {
	out := make([]setplayrepo.MoveCandidate, 0, len(cands))
	for _, m := range cands {
		if m.Total == nil || *m.Total < 1 {
			continue
		}
		if m.Category == model.MoveCategoryTargetCombo && m.IsDerived {
			continue // ゲート 1
		}
		if isSoloUnavailable(m, len(parentsByChild[m.ID]) > 0) {
			continue // ゲート 2
		}
		out = append(out, m)
	}
	return out
}

// maxChainLen は合成 filler 単位に組む連鎖の最大長。
// k は本来 KA 上限で自然に有限になる(実用上 KA ≦ 60 程度なら高々 5〜6 連＝M19-DESIGN-07 §2-2)。
// 本定数は病的入力に対する後段防御であり、実データでは予算側の枝刈りが先に効く。
const maxChainLen = 8

// maxChainUnits は 1 キャラあたりに作る合成単位の個数の上限。
//
// ★長さの上限(maxChainLen)だけでは個数を縛れない。budgetCap = KA + 2 は KA に比例して
// 緩むため、KA が大きいほど |グループ員|^k が素直に立ち上がる。**KA は VAL-C10 が
// WARNING のみで −600〜+600 が警告なしに保存できる**ため、極端な KA のコンボでは
// 「エンジンの枝刈りが効く前に、確定的に大量の単位を構築する」経路になりうる
// (KA=600・3 員グループで Σ3^k ≒ 9,840)。
//
// engineSafetyCap(エンジン側の全列挙の安全上限)と同じ役割を単位構築側に置いたものである。
// 実データの想定(KA ≦ 60・グループ員 2〜3 行〔zangief のみ 6 行〕・chain_cancel_total 9〜15F)
// では長さ 5〜6 で予算が尽き、単位数は数百に収まるため到達しない。
// テストで到達を確認するため var とする。
var maxChainUnits = 2000

// fillerUnit は探索へ渡す空振り 1 単位。単発技も長さ 1 の単位として扱う。
//
// 合成単位(長さ 2 以上)は「チェーングループから作った疑似 filler」であり、
// 単位 total ＝ Σ(非末端の chain_cancel_total) ＋ 末端の total(M19-DESIGN-07 §2-2)。
// 費用は単位ごとに独立なので、エンジン・受理帯・恒等式は不変(区分 2)。
type fillerUnit struct {
	// Name はエンジンへ渡す識別子。単発は move_code、合成は code を ">" で連結したもの。
	Name string
	// Total は単位全体の実消費フレーム。
	Total int
	// Members は表記順の構成技。
	Members []setplayrepo.MoveCandidate
}

// buildFillerUnits は単発 filler と合成 filler 単位を組み立てる(M19-05 段階 B)。
//
// # 合成の規則
//
//   - チェーングループ員 ＝ chain_cancel_total が非 NULL の行。
//     非 NULL であること自体がグループ員であることを兼ねる(DES-003 §3.3)。
//   - 先頭位置には単独入力可の員だけを置ける(単独で出せない技から連携は始められない)。
//   - 2 番目以降には「単独入力不可の員があればその集合」を、無ければグループ全員を置く。
//     ★キャラ名でなく性質で書いている。ザンギエフはチェーンの 2 打目以降に別性能の
//     「連打版」が出る(M19-DESIGN-07 §9-1 の実測性質 ①②＝別ボタンでも連打版・3 打目以降も
//     連打版)。連打版行は単独入力不可なのでこの一般則だけで 2 番目以降に入り、特例が要らない。
//     他キャラは単独入力不可の員を持たないため、従来どおりグループ全員が続く。
//   - 差し込んだ行自身の値を費用規則が読む(末端の total も連打版の値になる)。
//
// cands は同キャラの全候補。2 番目以降の位置には単発 filler として落ちた行(単独入力不可の
// 連打版など)も登場するため、singles だけでなく全候補から員を拾う必要がある。
// budgetCap は S の上限(= KA + 2)。単位 total がこれを超える組は作らない。
//
// ★既知の残件(M19-05 時点・開発者裁定 2026-08-09 で「除去せず残件として報告」)——
// 本関数は合成単位を**追加**するが、チェーングループ員を単発として複数含む解を**除去しない**。
// そのため同じ表記(例: リュウ 立弱P > 立弱P)が、KA によって合成単位経由の S(実機 22F)と
// 単発 2 つ分の S(全 total 計上 26F)の 2 通りで出る。後者は M19-DESIGN-07 §1-2-6 が
// 「実現不能レシピであり除去対象」と名指したものだが、**何をもって「隣接」とするかの判定法が
// DESIGN-07/08 のどこにも定義されていない**ため、本サブでは製造判断で規則を作らなかった。
// M19-01/02 からの既存挙動でありデグレではない。設計卓の裁定待ち。
func buildFillerUnits(singles, cands []setplayrepo.MoveCandidate, parentsByChild map[int64][]int64, budgetCap int) []fillerUnit {
	units := make([]fillerUnit, 0, len(singles))
	for _, m := range singles {
		units = append(units, fillerUnit{Name: m.Code, Total: *m.Total, Members: []setplayrepo.MoveCandidate{m}})
	}

	// チェーングループを組む。先頭候補は「単発 filler として通った員」に限る
	// (ゲート 1/2 で落ちた技から連携を始めることはできない)。
	heads := make([]setplayrepo.MoveCandidate, 0, len(singles))
	for _, m := range singles {
		if m.ChainCancelTotal != nil {
			heads = append(heads, m)
		}
	}
	if len(heads) == 0 {
		return units
	}
	// 2 番目以降の候補。単独入力不可の員があればそれを使う。
	var conts, soloOnly []setplayrepo.MoveCandidate
	for _, m := range cands {
		if m.ChainCancelTotal == nil || m.Total == nil || *m.Total < 1 {
			continue
		}
		if isSoloUnavailable(m, len(parentsByChild[m.ID]) > 0) {
			soloOnly = append(soloOnly, m)
		}
	}
	if len(soloOnly) > 0 {
		conts = soloOnly
	} else {
		conts = heads
	}

	// 長さの短い順に幅優先で伸ばす。
	// ★深さ優先ではなく幅優先にするのは、maxChainUnits に到達したときに残るのが
	//   「短い連鎖」＝実用的な単位になるようにするためである(engineSafetyCap 到達時に
	//   少手数の提案が優先して残るのと同じ考え方)。
	//
	// prefix は「連鎖列」と「非末端の chain_cancel_total の累計」の対。
	type prefix struct {
		seq     []setplayrepo.MoveCandidate
		partial int
	}
	frontier := make([]prefix, 0, len(heads))
	for _, h := range heads {
		frontier = append(frontier, prefix{seq: []setplayrepo.MoveCandidate{h}, partial: *h.ChainCancelTotal})
	}
	capped := false
	for length := 2; length <= maxChainLen && len(frontier) > 0 && !capped; length++ {
		next := make([]prefix, 0, len(frontier)*len(conts))
		for _, p := range frontier {
			for _, c := range conts {
				if c.Total == nil {
					continue // 末端になれない行は単位に組めない
				}
				// ★末端として置けるか(total)と、非末端として更に伸ばせるか(chain_cancel_total)は
				//   別の判定である。chain_cancel_total < total であるため、
				//   「末端にすると予算超過だが、非末端として繋げば収まる」組が原理的にありうる。
				//   2 つを 1 つの continue にまとめると、その経路ごと落としてしまう。
				if p.partial+*c.Total <= budgetCap {
					if len(units) >= maxChainUnits {
						capped = true
						break
					}
					units = append(units, newChainUnit(appendSeq(p.seq, c), p.partial+*c.Total))
				}
				if c.ChainCancelTotal != nil && p.partial+*c.ChainCancelTotal <= budgetCap {
					next = append(next, prefix{seq: appendSeq(p.seq, c), partial: p.partial + *c.ChainCancelTotal})
				}
			}
			if capped {
				break
			}
		}
		frontier = next
	}
	return units
}

// appendSeq は seq の複製へ m を足した新しいスライスを返す(共有バッキング配列を作らない)。
func appendSeq(seq []setplayrepo.MoveCandidate, m setplayrepo.MoveCandidate) []setplayrepo.MoveCandidate {
	out := make([]setplayrepo.MoveCandidate, len(seq), len(seq)+1)
	copy(out, seq)
	return append(out, m)
}

// newChainUnit は連鎖列から合成単位を作る。
// 単位 total は呼び出し側が算出済み(Σ非末端の chain_cancel_total ＋ 末端の total)。
func newChainUnit(seq []setplayrepo.MoveCandidate, total int) fillerUnit {
	codes := make([]string, len(seq))
	for i, m := range seq {
		codes[i] = m.Code
	}
	return fillerUnit{Name: strings.Join(codes, ">"), Total: total, Members: seq}
}

// collectTargets は §4.2(拡張)の列挙規則で target 候補を絞り込む。
func collectTargets(cands []setplayrepo.MoveCandidate, parentsByChild map[int64][]int64, params SuggestParams) []setplayrepo.MoveCandidate {
	typeSet := make(map[string]bool, len(params.TargetTypes))
	for _, t := range params.TargetTypes {
		typeSet[t] = true
	}
	// rush_variant の元技カテゴリ解決用に id→category を作る。
	catByID := make(map[int64]string, len(cands))
	for _, m := range cands {
		catByID[m.ID] = m.Category
	}
	out := make([]setplayrepo.MoveCandidate, 0, len(cands))
	for _, m := range cands {
		// 条件 1: startup ≥ 1 かつ active ≥ 1(いずれか NULL の技は除外)。
		if m.Startup == nil || *m.Startup < 1 || m.Active == nil || *m.Active < 1 {
			continue
		}
		if params.TargetMoveID != nil {
			// 明示指定モード: 指定 move のみ。種別/damage/is_derived/is_aerial は適用しない
			// (ユーザーが技を直接選んだため。§4.2 明示指定)。ただし system は常に対象外
			// (§4.6-2・DES-005 §5.6 項目12「category=system は常に対象外」。BE 側でも除外)。
			if m.ID == *params.TargetMoveID && m.Category != model.MoveCategorySystem {
				out = append(out, m)
			}
			continue
		}
		// 自動列挙。
		// M19-LIMITATION-NOTICE (b): この target 列挙規則(種別 type・fastest_unreachable 除外・
		//   単独入力不可の除外・非 through の is_derived 除外〔rush 種別は除外しない〕・
		//   damage>0 既定)を変更したら、ヒント文面(web i18n `setplay.limitations.*`)を
		//   同時に更新すること。
		ttype := moveTargetType(m, catByID)
		if ttype == "" || !typeSet[ttype] {
			continue // 選択された種別以外(system/SA/元 special ラッシュ等の "" を含む)は対象外
		}
		// M19-05: target ゲートを is_derived / is_aerial 依存から
		// basis ＋ 親参照 ＋ air フラグ導出へ切り替えた(M19-DESIGN-07 §3)。
		//
		// is_aerial → fastest_unreachable。is_aerial の実セマンティクスは「空中技か」ではなく
		// 「通常技と特殊技でラッシュ版を作るか否か」であり(D-222)、target 可否の軸ではない。
		// 「単独で最速入力しても地上の相手に当てられない」= スカラー S の target にできない、
		// という事実そのものを持つのが fastest_unreachable である。
		if m.FastestUnreachable {
			continue
		}
		if !isRushTargetType(ttype) {
			// 単独では出せない技は target にできない(親から出す前提の技であるため)。
			if isSoloUnavailable(m, len(parentsByChild[m.ID]) > 0) {
				continue
			}
			// is_derived → basis。through は通し値なので S の意味が確定し、target を解禁する。
			// ★through 以外の派生技(状態変種 standalone・親参照なしで is_derived=1 のもの)は
			//   引き続き除外する——M19-DESIGN-07 §9-4 が「暫定 is_derived ゲート継続」と明記して
			//   いる範囲である。ここを外すと denjin_charge_* / flame_* / mine_set_* 等の
			//   状態前提技が一斉に target へ入る(実測 +172 行)。
			if m.IsDerived && m.StartupBasis != model.MoveStartupBasisThrough {
				continue
			}
		}
		if !params.IncludeZeroDamage && (m.Damage == nil || *m.Damage <= 0) {
			continue // ダメージ 0/NULL(ドライブパリィ等)は既定で target にしない(重ねる概念がない)
		}
		out = append(out, m)
	}
	return out
}

// CandidateProjection は候補集合の射影(測定用)。D-237 の版固定測定手段が使う。
type CandidateProjection struct {
	// FillerCodes は単発 filler 候補の move_code(昇順)。
	FillerCodes []string
	// TargetCodes は target 候補の move_code(昇順)。
	TargetCodes []string
}

// ProjectCandidates は候補集合を射影する。**測定専用**であり提案生成の経路では使わない。
//
// 提案生成が使うのと同じ collectFillerSingles / collectTargets を呼ぶため、規則を二重に持たない
// (SQL で規則を書き写すと、本番の述語を直したときに測定側が静かに古くなる)。
//
// 使い方は internal/infra/migration/canary_setplay_projection_test.go を参照。
func ProjectCandidates(cands []setplayrepo.MoveCandidate, derivations []setplayrepo.MoveDerivation, params SuggestParams) CandidateProjection {
	parentsByChild := make(map[int64][]int64, len(derivations))
	for _, d := range derivations {
		parentsByChild[d.ChildMoveID] = append(parentsByChild[d.ChildMoveID], d.ParentMoveID)
	}
	p := CandidateProjection{FillerCodes: []string{}, TargetCodes: []string{}}
	for _, m := range collectFillerSingles(cands, parentsByChild) {
		p.FillerCodes = append(p.FillerCodes, m.Code)
	}
	for _, m := range collectTargets(cands, parentsByChild, params) {
		p.TargetCodes = append(p.TargetCodes, m.Code)
	}
	sort.Strings(p.FillerCodes)
	sort.Strings(p.TargetCodes)
	return p
}

// parentResolver は through の技に前置する表記用親を返す。親を持たない技には nil を返す。
type parentResolver func(m setplayrepo.MoveCandidate) *setplayrepo.MoveCandidate

// newParentResolver は表記展開(M19-DESIGN-07 §2-1 分類 1)の親解決器を作る。
//
// ★親を前置するのは startup_basis='through' の技だけである。through の startup は
// 「親の入力を起点に測った通し値」であり、親の消費は既にその値へ織り込まれている。
// したがって前置した親ステップの費用は 0(計上ゼロ)——これが費用規則の分類 1 である。
// standalone / unknown の技に親を前置すると二重計上になる。
//
// ★親が複数あるときは move_code 昇順の先頭を採る。費用には影響しない(分類 1 の cost は
// 親が誰でも 0)ため表示上の決定にすぎないが、決定論にするために順序を固定する。
// 意味的に正しい親を選ぶ規則は本サブでは持たない(followup notation-expansion-multiple-parents)。
func newParentResolver(byID map[int64]setplayrepo.MoveCandidate, parentsByChild map[int64][]int64) parentResolver {
	chosen := make(map[int64]setplayrepo.MoveCandidate, len(parentsByChild))
	for childID, parentIDs := range parentsByChild {
		var best *setplayrepo.MoveCandidate
		for _, pid := range parentIDs {
			p, ok := byID[pid]
			if !ok {
				continue // 別キャラ等で解決できない親は前置しない
			}
			if best == nil || p.Code < best.Code {
				pc := p
				best = &pc
			}
		}
		if best != nil {
			chosen[childID] = *best
		}
	}
	return func(m setplayrepo.MoveCandidate) *setplayrepo.MoveCandidate {
		if m.StartupBasis != model.MoveStartupBasisThrough {
			return nil
		}
		p, ok := chosen[m.ID]
		if !ok {
			return nil
		}
		return &p
	}
}

// buildProposal はエンジンの Suggestion を Proposal(DTO 素材)へ変換する。
// alreadyAdopted はここでは判定せず(N+1 回避)、返却分の recipeHash から後段でまとめて判定する。
//
// # 費用規則 4 分類の現れ方(M19-DESIGN-07 §2-1)
//
//   - 分類 1(表記用親 → 0): 前置した親ステップを Counted=false とし S に足さない。
//   - 分類 2(チェーン隣接 → chain_cancel_total): 合成 filler 単位の Total に内包済み。
//   - 分類 3(target → startup): エンジンが S = Σ単位 total + target.Startup で算出済み。
//   - 分類 4(その他 → total): 単発 filler・チェーン末端。単位 Total に内包済み。
//
// ★恒等式 S = Σcost(i) / N = KA + 2 − S / G = N − active は不変である。
// 前置親は計上ゼロなので S は動かない。
//
// ★表記展開は role 非依存(M19-DESIGN-02)。through の技を filler に使う解でも同じ規則で
// 親ステップを前置し、計上は通し total 1 つ(前置親は計上ゼロ)。
func buildProposal(landing int, mode string, tc setplayrepo.MoveCandidate, sg Suggestion, unitByName map[string]fillerUnit, parentOf parentResolver) Proposal {
	steps := make([]ProposalStep, 0, len(sg.Fillers)+2)
	setupSteps := make([]model.SetupStep, 0, len(sg.Fillers)+2)
	var codeParts []string
	sumFiller := 0
	order := 1

	// appendStep は 1 ステップを積む。counted=false のステップは S に寄与しない(分類 1)。
	appendStep := func(m setplayrepo.MoveCandidate, role string, counted bool) {
		mid := m.ID
		steps = append(steps, ProposalStep{MoveID: mid, Code: m.Code, Role: role, Counted: counted})
		// 格納は展開後の表記順(親行を含む)。「through の子の直前の親行は計上ゼロ」という
		// 決定論の規約で再計算できるため、modifiers への特記は要らない(M19-DESIGN-02)。
		setupSteps = append(setupSteps, model.SetupStep{StepOrder: order, MoveID: &mid})
		codeParts = append(codeParts, m.Code)
		order++
	}
	// appendWithParent は through の技の直前に表記用親を前置してから本体を積む。
	appendWithParent := func(m setplayrepo.MoveCandidate, role string) {
		if p := parentOf(m); p != nil {
			appendStep(*p, RoleParent, false) // 分類 1: 計上ゼロ
		}
		appendStep(m, role, true)
	}

	for _, f := range sg.Fillers {
		// 合成単位は構成技へ展開する。単発は長さ 1 の単位として同じ経路を通る。
		for _, m := range unitByName[f.Name].Members {
			appendWithParent(m, RoleFiller)
		}
		sumFiller += f.TotalFrames
	}
	appendWithParent(tc, RoleTarget)

	// M19-02-GAP-DEF: gap のとき G = N − active(＝最終 active が起き上がりの G フレーム前＝
	// 完全空振り。恒等式より)。meaty のとき 0。ロールバック点。
	g := 0
	if mode == ModeGap {
		g = sg.HitActiveFrame - *tc.Active
	}

	return Proposal{
		Steps:        steps,
		S:            sg.TotalFrames,
		N:            sg.HitActiveFrame,
		Landing:      landing,
		TargetActive: *tc.Active,
		Mode:         mode,
		G:            g,
		targetCode:   tc.Code,
		sumFiller:    sumFiller,
		sortName:     strings.Join(codeParts, ">"),
		// alreadyAdopted 判定は返却分だけ後段で行う(VAL-S04 と同一基準=名前非依存)。
		recipeHash: setupsvc.CalcSetupRecipeHash(setupSteps),
	}
}

// rank はグルー側のランキング(§4.4 拡張)。
// meaty(gap=false): 第 1 キー = N 降順(持続が深い順)。
// gap(gap=true): 第 1 キー = **G 昇順**(隙間が小さい順)。G=N−active は target ごとに
//
//	active が異なるため N ではなく Proposal.G を直接比較する(M19-02-GAP-DEF・ロールバック点)。
//
// sort=n: 第 1 キー → target code 昇順 → 手数昇順 → Σtotal 昇順 → Name 昇順。
// sort=target: target code 昇順 → 第 1 キー → 手数昇順 → Σtotal 昇順 → Name 昇順。
// 手数は主キーから外れタイブレークのみ(手数ソートは廃止)。
func rank(props []Proposal, mode SuggestSort, gap bool) {
	// primaryBefore: 第 1 キー(meaty=N 降順 / gap=G 昇順)。equal のとき次キーへ委ねる。
	primaryBefore := func(a, b *Proposal) (before, equal bool) {
		if gap {
			if a.G != b.G {
				return a.G < b.G, false
			}
			return false, true
		}
		if a.N != b.N {
			return a.N > b.N, false
		}
		return false, true
	}
	sort.SliceStable(props, func(i, j int) bool {
		a, b := &props[i], &props[j]
		if mode == SortByTarget {
			if a.targetCode != b.targetCode {
				return a.targetCode < b.targetCode
			}
			if bfr, eq := primaryBefore(a, b); !eq {
				return bfr
			}
		} else { // SortByN(既定・"" 含む)
			if bfr, eq := primaryBefore(a, b); !eq {
				return bfr
			}
			if a.targetCode != b.targetCode {
				return a.targetCode < b.targetCode
			}
		}
		// 手数(タイブレーク)= target 以外のステップ数。M19-05 以降は合成 filler 単位の構成技と
		// 表記用親も 1 ステップとして数える(いずれも実際に入力する手であるため)。
		// 計上ゼロの親も「手」ではあるので除かない。
		fa, fb := len(a.Steps)-1, len(b.Steps)-1
		if fa != fb {
			return fa < fb
		}
		if a.sumFiller != b.sumFiller {
			return a.sumFiller < b.sumFiller
		}
		return a.sortName < b.sortName
	})
}

// Package punishfinder は確定反撃サーチ(M18-02)の走査規則を一元化するサービスである。
//
// フレーム判定・レーン分け(地上/ダッシュ経由/ジャンプ経由)・除外規則(a〜h)・手動確認レーンの
// 振り分けをすべて本パッケージに集約し、FE は結果ツリーを描くだけにする(規則を FE に二重実装しない
// ＝既存 command-index の先例・DES-002 §4.2)。read-only の走査(Scan)と、検証状態の書き込み
// (始動技 verdict / コンボ採用 / pruning)を提供する。
package punishfinder

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"

	"github.com/plexiblinp/tacpendium/internal/model"
	"github.com/plexiblinp/tacpendium/internal/repository/combo"
	"github.com/plexiblinp/tacpendium/internal/repository/punish"
)

// ErrInvalidGuardType は guard_type が許容値でない場合に返す(handler で 400)。
var ErrInvalidGuardType = errors.New("guard_type must be 'block' or 'just_parry'")

// ErrInvalidVerdict は verdict が許容値でない場合に返す(handler で 400)。
var ErrInvalidVerdict = errors.New("verdict must be 'adopted' or 'unreachable'")

// ScanParams は走査の入力。
type ScanParams struct {
	SelfCharacterID     int64
	OpponentCharacterID int64
	GuardType           string
}

// Tree は走査結果(BE が算出済みの 3 階層ツリー + 手動確認レーン)。JSON 契約でもある。
type Tree struct {
	SelfCharacterID     int64              `json:"selfCharacterId"`
	OpponentCharacterID int64              `json:"opponentCharacterId"`
	GuardType           string             `json:"guardType"`
	Nodes               []OpponentMoveNode `json:"nodes"`             // 成立レーン(相手技→始動技→コンボ)
	ManualReviewNodes   []ManualReviewNode `json:"manualReviewNodes"` // 手動確認レーン(除外された相手技)
}

// OpponentMoveNode は成立レーンの相手技ノード(親)。
type OpponentMoveNode struct {
	MoveID    int64         `json:"moveId"`
	Code      string        `json:"code"`
	NameJa    *string       `json:"nameJa,omitempty"`
	Advantage int           `json:"advantage"` // 有利フレーム(ガード=-(on_block) / JP=recovery)
	Starters  []StarterNode `json:"starters"`
}

// StarterNode は始動技ノード(子)。判定根拠の異なるレーンは別ノードとして出す(silent に混ぜない)。
type StarterNode struct {
	MoveID  int64       `json:"moveId"`
	Code    string      `json:"code"`
	NameJa  *string     `json:"nameJa,omitempty"`
	Lane    string      `json:"lane"` // ground|dash|jump
	Startup *int        `json:"startup,omitempty"`
	Slack   *int        `json:"slack,omitempty"`   // ダッシュ経由の残り猶予(地上/ジャンプは null)
	Verdict *string     `json:"verdict,omitempty"` // adopted|unreachable|null(未検証)
	Note    *string     `json:"note,omitempty"`
	Combos  []ComboNode `json:"combos"`
}

// ComboNode は孫コンボノード。
type ComboNode struct {
	ComboID                int64   `json:"comboId"`
	Damage                 *int    `json:"damage,omitempty"`
	StepCount              int     `json:"stepCount"`
	HitType                *string `json:"hitType,omitempty"` // combos.hit_type。FE の変換ボタン表示条件(§4.8・punish_counter 系は非表示)。走査述語には非関与の出力投影のみ(M18-03b)
	Adopted                bool    `json:"adopted"`           // combo_punishes に (combo, 相手技) が登録済みか
	HasMaterializedVersion bool    `json:"hasMaterializedVersion"`
	// Recipe は既定プリセットのレシピ表示文字列(recipe_cache から抽出)。
	// id だけではどのコンボか分からないため添える(2026-07-26 開発者フィードバック 7)。
	Recipe string `json:"recipe,omitempty"`
}

// ManualReviewNode は手動確認レーンの相手技ノード(除外理由バッジ付き)。
type ManualReviewNode struct {
	MoveID     int64   `json:"moveId"`
	Code       string  `json:"code"`
	NameJa     *string `json:"nameJa,omitempty"`
	ReasonCode string  `json:"reasonCode"` // distance_dependent|data_missing|unknown_damage|zero_recovery
	// RegisteredCombos はこの相手技に登録済みの確定反撃(M18-03a §4.5)。
	//
	// フレーム判定を経ておらず、成立ツリーの候補とは由来が違う(手動で登録されたもの)。
	// 当該相手技は始動技→コンボのツリーが出ないため、これが無いと登録済みでも画面に現れない
	// (DES-005 §5.20 既知の限界 2)。BE から配信することで FE が 2 系統の API を混ぜずに済み、
	// invalidate も既存の [punish-finder] 1 本で足りる。
	RegisteredCombos []RegisteredComboNode `json:"registeredCombos"`
}

// RegisteredComboNode は手動確認レーンに出す登録済み確定反撃 1 件。
// 成立ツリーの ComboNode と型を分けるのは、adopted(採否トグルの状態)を持たず
// 「登録済みであること自体」しか意味しないため(混ぜると採否の意味が曖昧になる)。
type RegisteredComboNode struct {
	ComboID           int64   `json:"comboId"`
	Damage            *int    `json:"damage,omitempty"`
	StepCount         int     `json:"stepCount"`
	HitType           *string `json:"hitType,omitempty"`
	StarterMoveCode   *string `json:"starterMoveCode,omitempty"`
	StarterMoveNameJa *string `json:"starterMoveNameJa,omitempty"`
	Note              *string `json:"note,omitempty"`
	Recipe            string  `json:"recipe,omitempty"`
}

// ComboLister は孫コンボの逆引きに必要な最小 IF(combo リポジトリが実装)。
type ComboLister interface {
	List(ctx context.Context, filter combo.ListFilter) ([]*model.Combo, error)
}

// Service は確定反撃サーチの走査と検証状態の書き込みを提供する。
type Service interface {
	Scan(ctx context.Context, p ScanParams) (*Tree, error)
	SetStarterVerdict(ctx context.Context, selfCharacterID, opponentMoveID, starterMoveID int64, verdict string, note *string) error
	DeleteStarterVerdict(ctx context.Context, selfCharacterID, opponentMoveID, starterMoveID int64) error
	AddPunish(ctx context.Context, comboID, opponentMoveID int64, note *string) error
	RemovePunish(ctx context.Context, comboID, opponentMoveID int64) error
	AddPruning(ctx context.Context, selfCharacterID, opponentMoveID int64, note *string) error
	RemovePruning(ctx context.Context, selfCharacterID, opponentMoveID int64) error
}

type service struct {
	repo   punish.Repository
	combos ComboLister
	// defaultPresetID は config の [defaults] preset_id の現在値を返す(M20-05・D-360)。
	//
	// ★本フィールドと下の defaultRecipe だけが M20-05 の変更範囲である
	// (契約 F-3 の diff 0 に対する明示的な例外。候補集合の算出には触れていない)。
	// 既定プリセットを表す値を model 側の固定値で持つのをやめたため、レシピ表示文字列を
	// 取り出す側が「どのプリセットで表示するか」を渡す必要がある。
	defaultPresetID func() int64
}

// New はサービスを構築する。
//
// defaultPresetID が nil の場合は「既定プリセットが未注入」として扱い、Recipe は
// 空文字になる(preset.New と同じ nil 扱い)。本番配線では必ず渡すこと。
func New(repo punish.Repository, combos ComboLister, defaultPresetID func() int64) Service {
	return &service{repo: repo, combos: combos, defaultPresetID: defaultPresetID}
}

// defaultRecipe は既定プリセットのレシピ表示文字列を取り出す(M20-05・D-360)。
func (s *service) defaultRecipe(cache *string) string {
	if s.defaultPresetID == nil {
		return ""
	}
	return model.ExtractDefaultRecipe(cache, s.defaultPresetID())
}

type verdictKey struct {
	opponentMoveID int64
	starterMoveID  int64
}

type comboPunishKey struct {
	comboID        int64
	opponentMoveID int64
}

// Scan は 3 階層ツリー(成立レーン)と手動確認レーンを算出して返す。
// 未 seed・不存在 ID は空ツリー(ListMovesForScan が空を返すため自然に空になる＝200+空)。
func (s *service) Scan(ctx context.Context, p ScanParams) (*Tree, error) {
	if !guardTypeWhitelist[p.GuardType] {
		return nil, ErrInvalidGuardType
	}
	tree := &Tree{
		SelfCharacterID:     p.SelfCharacterID,
		OpponentCharacterID: p.OpponentCharacterID,
		GuardType:           p.GuardType,
		Nodes:               []OpponentMoveNode{},
		ManualReviewNodes:   []ManualReviewNode{},
	}

	oppMoves, err := s.repo.ListMovesForScan(ctx, p.OpponentCharacterID)
	if err != nil {
		return nil, fmt.Errorf("list opponent moves: %w", err)
	}
	selfMoves, err := s.repo.ListMovesForScan(ctx, p.SelfCharacterID)
	if err != nil {
		return nil, fmt.Errorf("list self moves: %w", err)
	}
	totals, err := s.repo.GetMovementTotals(ctx, p.SelfCharacterID)
	if err != nil {
		return nil, fmt.Errorf("get movement totals: %w", err)
	}
	pruned, err := s.repo.ListPrunedMoveIDs(ctx, p.SelfCharacterID)
	if err != nil {
		return nil, fmt.Errorf("list pruned: %w", err)
	}
	verdicts, err := s.repo.ListStarterVerdicts(ctx, p.SelfCharacterID)
	if err != nil {
		return nil, fmt.Errorf("list starter verdicts: %w", err)
	}
	verdictIdx := make(map[verdictKey]punish.StarterVerdict, len(verdicts))
	for _, v := range verdicts {
		verdictIdx[verdictKey{v.OpponentMoveID, v.StarterMoveID}] = v
	}
	// 手動確認レーンに載せる既登録の確定反撃(§4.5)。
	// curation では絞らない(curation は「使う」画面の表示制御であり、探す画面では
	// 登録済みの事実をそのまま見せる)。hit_type でも絞らない(タブは走査の判定根拠であって、
	// 手動登録された反撃の区分ではないため。絞ると登録済みが黙って消える)。
	registered, err := s.repo.ListPunishEntries(ctx, punish.PunishEntryFilter{
		SelfCharacterID:     p.SelfCharacterID,
		OpponentCharacterID: &p.OpponentCharacterID,
	})
	if err != nil {
		return nil, fmt.Errorf("list registered punishes: %w", err)
	}
	registeredIdx := make(map[int64][]RegisteredComboNode)
	for _, e := range registered {
		registeredIdx[e.OpponentMoveID] = append(registeredIdx[e.OpponentMoveID], RegisteredComboNode{
			ComboID:           e.ComboID,
			Damage:            e.Damage,
			StepCount:         e.StepCount,
			HitType:           e.HitType,
			StarterMoveCode:   e.StarterMoveCode,
			StarterMoveNameJa: e.StarterMoveNameJa,
			Note:              e.Note,
			Recipe:            s.defaultRecipe(e.RecipeCache),
		})
	}

	// pass 1: 相手技を分類し、成立レーンの始動技ノード骨格を組む。
	starterIDSet := make(map[int64]bool)
	accepted := make([]*OpponentMoveNode, 0)
	for _, om := range oppMoves {
		// 反撃対象外(移動 system move・空中攻撃)は完全除外(手動確認レーンにも出さない)。
		// 前入力・後ろ入力・微歩き・ダッシュ・ジャンプ・ジャンプ攻撃はガード/ジャストパリィ後の
		// 確定反撃の対象にならない(開発者確定 2026-07-24)。
		if isNonPunishableTarget(om) {
			continue
		}
		// a: damage=0 は完全除外(画面に出さない)。
		if om.Damage != nil && *om.Damage == 0 {
			continue
		}
		// g: pruning 済みは候補から除外(解除で復帰)。
		if pruned[om.ID] {
			continue
		}
		// b: damage IS NULL は手動確認(0 と NULL は意味が違う＝黙って落とさない)。
		if om.Damage == nil {
			tree.ManualReviewNodes = append(tree.ManualReviewNodes, manualNode(om, model.PunishReasonUnknownDamage, registeredIdx[om.ID]))
			continue
		}
		// c: 飛び道具は手動確認(距離依存)。
		if om.IsProjectile {
			tree.ManualReviewNodes = append(tree.ManualReviewNodes, manualNode(om, model.PunishReasonDistanceDependent, registeredIdx[om.ID]))
			continue
		}
		// d/e/f: 有利フレームの算出。算出不能・不定は手動確認。
		var adv int
		switch p.GuardType {
		case model.PunishGuardTypeBlock:
			if om.OnBlock == nil { // d
				tree.ManualReviewNodes = append(tree.ManualReviewNodes, manualNode(om, model.PunishReasonDataMissing, registeredIdx[om.ID]))
				continue
			}
			adv = -(*om.OnBlock)
		case model.PunishGuardTypeJustParry:
			// ★JP タブからだけ外す技(M31-04)。手動確認レーンにも出さない ——
			//   「取り扱わなくてもいい」であって「判断を人に回す」ではないため。
			//   ブロックタブでは通常どおり走査される(上の case を通る)。
			if justParryExcludedCodes[om.Code] {
				continue
			}
			if om.Recovery == nil { // e
				tree.ManualReviewNodes = append(tree.ManualReviewNodes, manualNode(om, model.PunishReasonDataMissing, registeredIdx[om.ID]))
				continue
			}
			if *om.Recovery == 0 { // f(is_projectile は上で除外済み)
				tree.ManualReviewNodes = append(tree.ManualReviewNodes, manualNode(om, model.PunishReasonZeroRecovery, registeredIdx[om.ID]))
				continue
			}
			adv = *om.Recovery
		}
		// h: 有利 <= 0 は候補なし(正常・出さない)。
		if adv <= 0 {
			continue
		}

		starters := s.buildStarters(selfMoves, adv, totals, om.ID, verdictIdx)
		if len(starters) == 0 {
			continue // 候補なし(正常)
		}
		for i := range starters {
			starterIDSet[starters[i].MoveID] = true
		}
		accepted = append(accepted, &OpponentMoveNode{
			MoveID:    om.ID,
			Code:      om.Code,
			NameJa:    om.NameJa,
			Advantage: adv,
			Starters:  starters,
		})
	}

	// pass 2: 孫コンボを 1 回のクエリで取得し、始動技ノードへ割り当てる。
	if len(starterIDSet) > 0 {
		ids := sortedInt64Keys(starterIDSet)
		combos, err := s.combos.List(ctx, combo.ListFilter{CharacterID: &p.SelfCharacterID, StarterMoveIDs: ids})
		if err != nil {
			return nil, fmt.Errorf("list combos by starter: %w", err)
		}
		byStarter := make(map[int64][]*model.Combo)
		for _, c := range combos {
			if c.StarterMoveID != nil {
				byStarter[*c.StarterMoveID] = append(byStarter[*c.StarterMoveID], c)
			}
		}
		adopted, err := s.repo.ListAdoptedComboPunishes(ctx, p.SelfCharacterID)
		if err != nil {
			return nil, fmt.Errorf("list adopted: %w", err)
		}
		adoptedSet := make(map[comboPunishKey]bool, len(adopted))
		for _, k := range adopted {
			adoptedSet[comboPunishKey{k.ComboID, k.OpponentMoveID}] = true
		}
		materializedBaseIDs, err := s.repo.ListMaterializedBaseComboIDs(ctx, p.SelfCharacterID)
		if err != nil {
			return nil, fmt.Errorf("list materialized base combos: %w", err)
		}
		for _, node := range accepted {
			for si := range node.Starters {
				st := &node.Starters[si]
				for _, c := range byStarter[st.MoveID] {
					st.Combos = append(st.Combos, ComboNode{
						ComboID:                c.ID,
						Damage:                 c.Damage,
						StepCount:              c.StepCount,
						HitType:                c.HitType,
						Adopted:                adoptedSet[comboPunishKey{c.ID, node.MoveID}],
						HasMaterializedVersion: materializedBaseIDs[c.ID],
						// combo リポジトリの List が recipe_cache を投影済みのため追加クエリは不要。
						Recipe: s.defaultRecipe(c.RecipeCache),
					})
				}
			}
		}
	}

	for _, node := range accepted {
		tree.Nodes = append(tree.Nodes, *node)
	}
	return tree, nil
}

// usesFirstHitStartup は「格納されている startup が初段の値とは限らない行」を判定する。
//
// 対象＝category='target_combo' ∧ is_derived ∧ startup_basis='standalone'(実測 106 行)。
// これらはターゲットコンボの 2 段目以降を 1 行で表しており、startup には*その段*を単独で
// 出したときの発生が入っている。実例: ryu fuwa_triple_strike_2hits は startup=5 だが、
// 実際にはその初段(立中P=6F)から始まる。⇒ 有利 5F で 5 <= 5 が成立して候補に出るが入らない。
//
// ★★startup_basis を述語へ含める理由(指示書 §4.3・開発者裁定 2026-09-13)。
//
//	target_combo ∧ is_derived は 118 行あるが、うち through 4 行 / unknown 8 行は上の 106 の
//	外にある。through は「連携の頭から数えた通し値」であり既に初段分を含むため、そのまま
//	判定して偽陽性にならない。⇒ basis を落として 3 条件にすると、この 12 行まで候補から
//	消えて偽陰性が増える(§5-4 の確認対象そのものである)。
//	★M39-01 で 109/117/(through 4・unknown 4) -> 106/118/(through 4・unknown 8) へ動いた ——
//	  D-187 の是正でフレームを持たない空中限定 4 行が standalone から unknown へ移ったためである。
//	  ⇒ 同 4 行は startup も first_hit_startup も NULL であり、candidateStartup の戻り値は
//	    是正の前後とも nil である(挙動は変わっていない)。
//
// ★データは誤っていない(開発者確認・D-857)。誤っているのは判定側の読み方であった。
// ★初段を機械的に同定しようとしないこと(指示書 §3-3)。実測で target_combo 126 行のうち
// 59 行が判定不能であり、そもそも command 列は DB moves に無い(M37-RESEARCH-01 §6-2)。
func usesFirstHitStartup(sm punish.ScanMove) bool {
	return sm.Category == model.MoveCategoryTargetCombo &&
		sm.IsDerived &&
		sm.StartupBasis == model.MoveStartupBasisStandalone
}

// candidateStartup は候補判定に使う発生フレームを返す。nil なら判定する材料が無い
// ＝この行は候補にしない。
//
// 対象行(usesFirstHitStartup)では first_hit_startup を使い、NULL ならそのまま nil を返す ——
// 判定する材料が無いためである(M37-04 §0.5・D-857)。偽陽性(入らない反撃を信じて練習する)は
// 偽陰性より害が大きく、いま実際に出ている。⇒ 外せば今すぐ改善し、開発者が 106 行を
// 埋めた行から順に正しく戻る。
//
// 対象外の行は startup をそのまま返す(現状どおり・挙動を変えない)。
func candidateStartup(sm punish.ScanMove) *int {
	if usesFirstHitStartup(sm) {
		return sm.FirstHitStartup
	}
	return sm.Startup
}

// buildStarters は 1 相手技(有利 adv)に対する始動技候補を 3 レーンで組む。
// 共通条件 damage>0。同一始動技が複数レーンに載る場合はレーン別ノードとして別々に出す。
func (s *service) buildStarters(selfMoves []punish.ScanMove, adv int, totals punish.MovementTotals, oppMoveID int64, verdictIdx map[verdictKey]punish.StarterVerdict) []StarterNode {
	out := make([]StarterNode, 0)
	for _, sm := range selfMoves {
		if sm.Damage == nil || *sm.Damage <= 0 {
			continue // ダッシュ・構え等は始動になり得ない
		}
		// 地上・ダッシュ経由は接地始動レーン＝空中技は対象外(跳び込みはジャンプ経由レーンで扱う。
		// 地上/ダッシュに空中技を混ぜると 3 レーンの判定根拠区別が崩れる＝偽陽性)。
		grounded := !sm.IsAerial
		// ★M37-04(B06): 判定に使う発生は Startup そのものとは限らない。candidateStartup を見ること。
		//   nil は「判定する材料が無い」＝この行は候補にしない、を意味する。
		startup := candidateStartup(sm)
		// 地上レーン: 初段の発生 <= 有利。
		if grounded && startup != nil && *startup <= adv {
			out = append(out, s.starterNode(sm, model.PunishLaneGround, nil, oppMoveID, verdictIdx, startup))
		}
		// ダッシュ経由レーン: dash_forward.total が非 NULL のキャラのみ。
		if grounded && totals.DashForward != nil {
			slack := adv - *totals.DashForward
			if slack >= DashMinSlack && startup != nil && *startup <= slack {
				sl := slack
				out = append(out, s.starterNode(sm, model.PunishLaneDash, &sl, oppMoveID, verdictIdx, startup))
			}
		}
		// ジャンプ経由レーン: jump_forward.total が非 NULL のキャラのみ・強攻撃
		// (is_aerial=1・category=normal・code に jumping_heavy_ を含む)。
		// 判定に使うのはキャラのジャンプ全体(jump_forward.total)であり、空中技自身の total ではない。
		if totals.JumpForward != nil {
			if sm.IsAerial && sm.Category == model.MoveCategoryNormal &&
				strings.Contains(sm.Code, jumpHeavyCodePart) &&
				adv >= *totals.JumpForward-JumpSlack {
				// ★ジャンプレーンは startup を判定に使わない(キャラのジャンプ全体で決まる)。
				//   応答へ載せる発生だけを上の startup から渡す(再計算しない)。
				//   ★本レーンは category=normal を要求するため target_combo は到達しない。
				//     ⇒ startup は常に sm.Startup そのものであり、M37-04 で挙動を変えていない。
				out = append(out, s.starterNode(sm, model.PunishLaneJump, nil, oppMoveID, verdictIdx, startup))
			}
		}
	}
	return out
}

// starterNode は始動技ノードを組み、(相手技, 始動技) キーの verdict/note を付与する。
//
// ★M37-04: startup は candidateStartup が返した「判定に使った値」である。
//
//	⇒ 判定を 6F で行いながら画面へ 5F を出すと読めないため、応答にも判定値を載せる。
//	★着地時点では first_hit_startup が全行 NULL のため応答は 1 バイトも変わらない。
//	対象行は候補に出ず、対象外の行は Startup がそのまま渡る。埋めた行から順に正しくなる。
func (s *service) starterNode(sm punish.ScanMove, lane string, slack *int, oppMoveID int64, verdictIdx map[verdictKey]punish.StarterVerdict, startup *int) StarterNode {
	n := StarterNode{
		MoveID:  sm.ID,
		Code:    sm.Code,
		NameJa:  sm.NameJa,
		Lane:    lane,
		Startup: startup,
		Slack:   slack,
		Combos:  []ComboNode{},
	}
	if v, ok := verdictIdx[verdictKey{oppMoveID, sm.ID}]; ok {
		verdict := v.Verdict
		n.Verdict = &verdict
		n.Note = v.Note
	}
	return n
}

// manualNode は手動確認レーンのノードを組む。registered はこの相手技に登録済みの確定反撃
// (§4.5)で、0 件なら空スライスにする(JSON で null にせず FE が length を引けるように)。
func manualNode(om punish.ScanMove, reason string, registered []RegisteredComboNode) ManualReviewNode {
	if registered == nil {
		registered = []RegisteredComboNode{}
	}
	return ManualReviewNode{
		MoveID:           om.ID,
		Code:             om.Code,
		NameJa:           om.NameJa,
		ReasonCode:       reason,
		RegisteredCombos: registered,
	}
}

// isNonPunishableTarget は相手技のうち反撃対象にならないもの(移動 system move・空中攻撃)を判定する。
// 該当技は走査から完全除外する(成立レーンにも手動確認レーンにも出さない)。
func isNonPunishableTarget(m punish.ScanMove) bool {
	if m.IsAerial {
		return true // 相手の空中攻撃(跳び込み)は確定反撃の対象にしない
	}
	return m.Category == model.MoveCategorySystem && movementSystemCodes[m.Code]
}

func sortedInt64Keys(set map[int64]bool) []int64 {
	ids := make([]int64, 0, len(set))
	for id := range set {
		ids = append(ids, id)
	}
	sort.Slice(ids, func(i, j int) bool { return ids[i] < ids[j] })
	return ids
}

func (s *service) SetStarterVerdict(ctx context.Context, selfCharacterID, opponentMoveID, starterMoveID int64, verdict string, note *string) error {
	if !verdictWhitelist[verdict] {
		return ErrInvalidVerdict
	}
	return s.repo.UpsertStarter(ctx, selfCharacterID, opponentMoveID, starterMoveID, verdict, note)
}

func (s *service) DeleteStarterVerdict(ctx context.Context, selfCharacterID, opponentMoveID, starterMoveID int64) error {
	return s.repo.DeleteStarter(ctx, selfCharacterID, opponentMoveID, starterMoveID)
}

func (s *service) AddPunish(ctx context.Context, comboID, opponentMoveID int64, note *string) error {
	return s.repo.AddPunish(ctx, comboID, opponentMoveID, note)
}

func (s *service) RemovePunish(ctx context.Context, comboID, opponentMoveID int64) error {
	return s.repo.RemovePunish(ctx, comboID, opponentMoveID)
}

func (s *service) AddPruning(ctx context.Context, selfCharacterID, opponentMoveID int64, note *string) error {
	return s.repo.AddPruning(ctx, selfCharacterID, opponentMoveID, note)
}

func (s *service) RemovePruning(ctx context.Context, selfCharacterID, opponentMoveID int64) error {
	return s.repo.RemovePruning(ctx, selfCharacterID, opponentMoveID)
}

// Package punishlist は確定反撃マイリスト(使う画面・画面21・M18-03a)の取得を担うサービスである。
//
// 探す画面(service/punishfinder)が「走査」であるのに対し、本パッケージは「取得」に徹する。
// フレーム判定・レーン判定・除外規則 a〜h は本パッケージに存在しない。マイリストは保存済みの
// 事実(combo_punishes)を引くだけであり、この非対称を実装でも保つため punishfinder に相乗り
// させない(指示書 §4.3)。
//
// 3 表の役割分担(指示書 §4.1):
//   - combo_punishes         … 採用の正。本画面の母集合
//   - combo_punish_curations … 届くが使わない。本画面の表示制御
//   - combo_punish_prunings  … 物理的に届かない。探す画面の刈り込み用であり、
//     本画面の表示制御には使わない(pruning された相手技でも採用済みの反撃は出す)
package punishlist

import (
	"context"
	"errors"
	"fmt"
	"log/slog"

	"github.com/plexiblinp/tacpendium/internal/model"
	"github.com/plexiblinp/tacpendium/internal/repository/punish"
)

// ErrInvalidGuardType は guard が許容値でない場合に返す(handler で 400)。
var ErrInvalidGuardType = errors.New("guard must be 'block' or 'just_parry'")

// Repository は本サービスが必要とする最小 IF(repository/punish が実装)。
// punishfinder.ComboLister と同じ流儀で、必要なメソッドだけを宣言する。
type Repository interface {
	ListPunishEntries(ctx context.Context, f punish.PunishEntryFilter) ([]punish.PunishEntry, error)
	ListCurations(ctx context.Context, selfCharacterID int64, opponentCharacterID *int64) ([]punish.CurationEntry, error)
	ListPrunings(ctx context.Context, selfCharacterID int64, opponentCharacterID *int64) ([]punish.PruningEntry, error)
	AddCuration(ctx context.Context, comboID, opponentMoveID int64, note *string) error
	RemoveCuration(ctx context.Context, comboID, opponentMoveID int64) error
	// ★★M31-01(P4M-014): 「この基底コンボからパニッシュカウンター版が既に作られたか」。
	//   探す画面(§5.20 の畳み込み・M18-03c)が使っている既存メソッドをそのまま再利用する。
	//   **新しい判定を書き起こさない**——2 本になると、片方だけ直って静かにずれる。
	ListMaterializedBaseComboIDs(ctx context.Context, selfCharacterID int64) (map[int64]bool, error)
}

// guardTypeToHitType は走査タブ(guard)と紐づくコンボの hit_type の対応(指示書 §4.4-1)。
// combo_punishes は guard_type を持たず、判別は常に combos.hit_type で行う(DES-003 §3.15)。
// 4 値リテラルは新規定義せず internal/model の既存定数を参照する。
var guardTypeToHitType = map[string]string{
	model.PunishGuardTypeBlock:     model.HitTypePunishCounter,
	model.PunishGuardTypeJustParry: model.HitTypeJustParryPunishCounter,
}

// punishHitTypes はマイリストのタブが扱う hit_type の集合。
// ここに含まれない値(normal / counter / NULL)は「区分を判定できない反撃」へ回す。
var punishHitTypes = map[string]bool{
	model.HitTypePunishCounter:          true,
	model.HitTypeJustParryPunishCounter: true,
}

// ListParams は取得の入力。
type ListParams struct {
	SelfCharacterID     int64
	OpponentCharacterID *int64 // nil = 全相手キャラ
	GuardType           string // block | just_parry
}

// List は画面21 のデータ一式(マイリスト ＋ 隠したもの一覧)。JSON 契約でもある。
//
// 隠したもの一覧を本レスポンスへ畳むのは、FE が 2 系統の API を混ぜないため(指示書 §4.6)。
type List struct {
	SelfCharacterID     int64  `json:"selfCharacterId"`
	OpponentCharacterID *int64 `json:"opponentCharacterId,omitempty"`
	GuardType           string `json:"guardType"`
	HitType             string `json:"hitType"` // guardType に対応する combos.hit_type

	Nodes []MoveNode `json:"nodes"` // 現タブ(hit_type 一致)の相手技ノード
	// UnclassifiedNodes は hit_type が punish_counter / just_parry_punish_counter の
	// いずれでもない(normal / counter / NULL)採用済み反撃。
	//
	// 探す画面の「確定反撃に採用」は hit_type を見ないため、こうしたコンボが
	// combo_punishes に入り得る。タブで絞ると黙って見えなくなるため、両タブ共通で別枠に出す
	// (開発者確定 2026-07-26。M18 の「silent に消さない」思想の適用)。
	// 本バケツは M18-03b の materialize が処理すべき入力キューであり、ゴミ箱ではない。
	UnclassifiedNodes []MoveNode `json:"unclassifiedNodes"`

	HiddenPrunings  []HiddenPruning  `json:"hiddenPrunings"`  // 確定反撃のない技(自キャラ × 相手技)
	HiddenCurations []HiddenCuration `json:"hiddenCurations"` // 使わない反撃(コンボ × 相手技)
}

// MoveNode は相手技ノード(第1階層)。
type MoveNode struct {
	MoveID                  int64       `json:"moveId"`
	Code                    string      `json:"code"`
	NameJa                  *string     `json:"nameJa,omitempty"`
	OpponentCharacterID     int64       `json:"opponentCharacterId"`
	OpponentCharacterNameJa string      `json:"opponentCharacterNameJa"`
	Combos                  []ComboNode `json:"combos"`
}

// ComboNode はコンボ行(第2階層)。
// 始動技は行の属性表示にとどめ、階層を切らない(探す画面の 3 階層と意図的に非対称)。
type ComboNode struct {
	ComboID           int64   `json:"comboId"`
	Damage            *int    `json:"damage,omitempty"`
	StepCount         int     `json:"stepCount"`
	HitType           *string `json:"hitType,omitempty"`
	StarterMoveID     *int64  `json:"starterMoveId,omitempty"`
	StarterMoveCode   *string `json:"starterMoveCode,omitempty"`
	StarterMoveNameJa *string `json:"starterMoveNameJa,omitempty"`
	Note              *string `json:"note,omitempty"` // combo_punishes.note(採用理由)
	// MaterializedFromComboID は materialize 生成物の出自(基底コンボ id)。生成元バッジ用(M18-03b)。
	// 非 NULL のとき FE は「PC版(生成)」バッジを出す(内部値と表示ラベルを分離・L-7)。
	MaterializedFromComboID *int64 `json:"materializedFromComboId,omitempty"`
	// HasMaterializedVersion は「この基底コンボからパニッシュカウンター版が既に作られている」
	// ことを示す(M31-01・P4M-014)。
	//
	// ★★開発者の逐語＝「①はすでにパニッシュカウンター版が作られているコンボは
	//   そのそも出さない」(phase4-memo.txt:47)。⇒ FE は本フラグが立った行を
	//   ①(反撃に転用可能)から外し、**件数だけを述べる**。
	// ★★黙って消さない。件数を出すのは M18 の「silent に消さない」思想であり、
	//   §5.20 が同じ問いに「畳む ＋ バッジ」で答えた前例に揃えてある。
	// ★通常は materialize が基底の採用(combo_punishes)を外すため、本フラグが立った行が
	//   マイリストに残ること自体が稀である(再採用した場合などに起こる)。
	HasMaterializedVersion bool `json:"hasMaterializedVersion,omitempty"`
	// Recipe は既定プリセットのレシピ表示文字列(recipe_cache から抽出)。
	// 未生成・欠損時は空文字で、FE は行を出さない(2026-07-26 開発者フィードバック 7)。
	Recipe string `json:"recipe,omitempty"`
}

// HiddenPruning は「確定反撃のない技」1 件。コンボ非依存(マッチアップの物理的事実)。
type HiddenPruning struct {
	OpponentMoveID          int64   `json:"opponentMoveId"`
	Code                    string  `json:"code"`
	NameJa                  *string `json:"nameJa,omitempty"`
	OpponentCharacterID     int64   `json:"opponentCharacterId"`
	OpponentCharacterNameJa string  `json:"opponentCharacterNameJa"`
	Note                    *string `json:"note,omitempty"`
}

// HiddenCuration は「使わない反撃」1 件。個別コンボ単位。
type HiddenCuration struct {
	ComboID                 int64   `json:"comboId"`
	OpponentMoveID          int64   `json:"opponentMoveId"`
	Code                    string  `json:"code"`
	NameJa                  *string `json:"nameJa,omitempty"`
	OpponentCharacterID     int64   `json:"opponentCharacterId"`
	OpponentCharacterNameJa string  `json:"opponentCharacterNameJa"`
	StarterMoveCode         *string `json:"starterMoveCode,omitempty"`
	StarterMoveNameJa       *string `json:"starterMoveNameJa,omitempty"`
	Note                    *string `json:"note,omitempty"`
}

// Service はマイリストの取得と curation の登録/解除を提供する。
type Service interface {
	List(ctx context.Context, p ListParams) (*List, error)
	AddCuration(ctx context.Context, comboID, opponentMoveID int64, note *string) error
	RemoveCuration(ctx context.Context, comboID, opponentMoveID int64) error
}

type service struct {
	repo Repository
	// defaultPresetID は config の [defaults] preset_id の現在値を返す(M20-05・D-360)。
	//
	// ★既定プリセットを表す値を model 側の固定値で持つのをやめたため、レシピ表示文字列を
	// 取り出す側が「どのプリセットで表示するか」を渡す必要がある。
	defaultPresetID func() int64
}

// New はサービスを構築する。
//
// defaultPresetID が nil の場合は「既定プリセットが未注入」として扱い、Recipe は
// 空文字になる(preset.New と同じ nil 扱い)。本番配線では必ず渡すこと。
func New(repo Repository, defaultPresetID func() int64) Service {
	return &service{repo: repo, defaultPresetID: defaultPresetID}
}

// defaultRecipe は既定プリセットのレシピ表示文字列を取り出す(M20-05・D-360)。
func (s *service) defaultRecipe(cache *string) string {
	if s.defaultPresetID == nil {
		return ""
	}
	return model.ExtractDefaultRecipe(cache, s.defaultPresetID())
}

// List はマイリストと隠したもの一覧を返す。
//
// 未 seed・不存在の(有効な)ID は 200＋空(リポジトリが空を返すため自然に空になる)。
func (s *service) List(ctx context.Context, p ListParams) (*List, error) {
	hitType, ok := guardTypeToHitType[p.GuardType]
	if !ok {
		return nil, ErrInvalidGuardType
	}
	out := &List{
		SelfCharacterID:     p.SelfCharacterID,
		OpponentCharacterID: p.OpponentCharacterID,
		GuardType:           p.GuardType,
		HitType:             hitType,
		Nodes:               []MoveNode{},
		UnclassifiedNodes:   []MoveNode{},
		HiddenPrunings:      []HiddenPruning{},
		HiddenCurations:     []HiddenCuration{},
	}

	// 段 1(自キャラ絞り)・段 2(論理削除除外)・段 4(curation 除外)は SQL 側。
	// 段 3(hit_type タブ絞り)と段 5(相手技グルーピング)を以下で行う。
	entries, err := s.repo.ListPunishEntries(ctx, punish.PunishEntryFilter{
		SelfCharacterID:     p.SelfCharacterID,
		OpponentCharacterID: p.OpponentCharacterID,
		ExcludeCurated:      true,
	})
	if err != nil {
		return nil, fmt.Errorf("list punish entries: %w", err)
	}

	inTab := make([]punish.PunishEntry, 0, len(entries))
	unclassified := make([]punish.PunishEntry, 0)
	for _, e := range entries {
		switch {
		case e.HitType != nil && *e.HitType == hitType:
			inTab = append(inTab, e)
		case e.HitType == nil || !punishHitTypes[*e.HitType]:
			// 区分(ガード始動 / ジャストパリィ始動)を判定できない記録。タブに依らず出す。
			unclassified = append(unclassified, e)
		default:
			// もう一方のタブに属する。現タブでは出さない。
		}
	}
	// ★★M31-01(P4M-014): 「PC 版が既に作られている基底コンボ」の集合を 1 回だけ引く。
	//   ★探す画面(§5.20 の畳み込み)が使っている既存メソッドの再利用である。
	//   ★取得に失敗しても一覧そのものは落とさない——フラグは表示の補助であり、
	//     マイリストを見るという主目的を巻き添えにしない(M23-04 の検証と同じ扱い)。
	materializedBases, mErr := s.repo.ListMaterializedBaseComboIDs(ctx, p.SelfCharacterID)
	if mErr != nil {
		slog.WarnContext(ctx, "punishlist: list materialized bases failed",
			slog.String("err", mErr.Error()))
		materializedBases = nil
	}

	out.Nodes = s.groupByOpponentMove(inTab, materializedBases)
	out.UnclassifiedNodes = s.groupByOpponentMove(unclassified, materializedBases)

	prunings, err := s.repo.ListPrunings(ctx, p.SelfCharacterID, p.OpponentCharacterID)
	if err != nil {
		return nil, fmt.Errorf("list prunings: %w", err)
	}
	for _, pr := range prunings {
		out.HiddenPrunings = append(out.HiddenPrunings, HiddenPruning{
			OpponentMoveID:          pr.OpponentMoveID,
			Code:                    pr.OpponentMoveCode,
			NameJa:                  pr.OpponentMoveNameJa,
			OpponentCharacterID:     pr.OpponentCharacterID,
			OpponentCharacterNameJa: pr.OpponentCharacterNameJa,
			Note:                    pr.Note,
		})
	}

	curations, err := s.repo.ListCurations(ctx, p.SelfCharacterID, p.OpponentCharacterID)
	if err != nil {
		return nil, fmt.Errorf("list curations: %w", err)
	}
	for _, cu := range curations {
		out.HiddenCurations = append(out.HiddenCurations, HiddenCuration{
			ComboID:                 cu.ComboID,
			OpponentMoveID:          cu.OpponentMoveID,
			Code:                    cu.OpponentMoveCode,
			NameJa:                  cu.OpponentMoveNameJa,
			OpponentCharacterID:     cu.OpponentCharacterID,
			OpponentCharacterNameJa: cu.OpponentCharacterNameJa,
			StarterMoveCode:         cu.StarterMoveCode,
			StarterMoveNameJa:       cu.StarterMoveNameJa,
			Note:                    cu.Note,
		})
	}

	return out, nil
}

// groupByOpponentMove は表示用投影を相手技でグルーピングして 2 階層に組む。
// entries はリポジトリ側で (相手キャラ, 相手技, コンボ) 順に整列済みのため、順序をそのまま保つ。
func (s *service) groupByOpponentMove(entries []punish.PunishEntry, materializedBases map[int64]bool) []MoveNode {
	nodes := make([]MoveNode, 0)
	idx := make(map[int64]int, len(entries))
	for _, e := range entries {
		i, ok := idx[e.OpponentMoveID]
		if !ok {
			nodes = append(nodes, MoveNode{
				MoveID:                  e.OpponentMoveID,
				Code:                    e.OpponentMoveCode,
				NameJa:                  e.OpponentMoveNameJa,
				OpponentCharacterID:     e.OpponentCharacterID,
				OpponentCharacterNameJa: e.OpponentCharacterNameJa,
				Combos:                  []ComboNode{},
			})
			i = len(nodes) - 1
			idx[e.OpponentMoveID] = i
		}
		nodes[i].Combos = append(nodes[i].Combos, ComboNode{
			ComboID:                 e.ComboID,
			Damage:                  e.Damage,
			StepCount:               e.StepCount,
			HitType:                 e.HitType,
			StarterMoveID:           e.StarterMoveID,
			StarterMoveCode:         e.StarterMoveCode,
			StarterMoveNameJa:       e.StarterMoveNameJa,
			Note:                    e.Note,
			MaterializedFromComboID: e.MaterializedFromComboID,
			HasMaterializedVersion:  materializedBases[e.ComboID],
			Recipe:                  s.defaultRecipe(e.RecipeCache),
		})
	}
	return nodes
}

func (s *service) AddCuration(ctx context.Context, comboID, opponentMoveID int64, note *string) error {
	return s.repo.AddCuration(ctx, comboID, opponentMoveID, note)
}

func (s *service) RemoveCuration(ctx context.Context, comboID, opponentMoveID int64) error {
	return s.repo.RemoveCuration(ctx, comboID, opponentMoveID)
}

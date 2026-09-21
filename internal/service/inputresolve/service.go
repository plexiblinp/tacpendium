// Package inputresolve は段階2(単方向+ボタン)のコマンド解決サービスである(M17-02 G-k)。
//
// 方式は案C=「BE が畳んだ解決表を配る」(CHANGE-069 §2.3-k・§1.5-2)。キャラ 1 体分の
// token_key → move_code が 1 対 1 に畳まれたマップを返し、FE(M17-03)は引くだけで
// 規則(正規化・特殊技優先・タイブレーク)を持たない。
//
// 死守 3 契約(command-resolution-request §1.1):
//   - 公式表記のみ解決(汚い入力・曖昧モーションは扱わない=決定論ルックアップに徹する)。
//   - モーション解析をしない(方向トークンの列パターンマッチ・時間依存を実装しない)。
//   - 出口は必ずキャラ別 move_code。
//
// 段階1(しゃがみ/ジャンプ攻撃の構造引き=FE 実装・M15)は不変。「解決表に無ければ段階1 へ」の
// 一様フォールバック(§1.5-3)は消費者(FE)の分岐であり、本サービスはフォールバックを持たない。
// recipe_cache 非波及: 本サービスは読取のみで RecomputeComboCache・combos 同一性に関与しない。
package inputresolve

import (
	"context"
	"errors"
	"fmt"
	"regexp"

	"github.com/plexiblinp/tacpendium/internal/model"
	"github.com/plexiblinp/tacpendium/internal/repository/movecommand"
)

// ErrInvalidCharacterID は characterID が正の整数でない場合に返す。
var ErrInvalidCharacterID = errors.New("characterID must be a positive integer")

// stage2KeyPattern は段階2 解決表に載せる token_key の形状=「単一方向(テンキー数字)+強度付き
// ボタン」または「強度付きボタンのみ」。溜め [X]・一回転 360・or(/)・chain(>)・hold・複数方向・
// 複数ボタン(+)・強度なし P/K は本形状に合致せず自動的に対象外(=直接指定へ。CHANGE-069 §2.2-h)。
//
// この形状文字列が FE(M17-03)のクエリキー構築契約でもある: 方向ゾーンのテンキー数字
// (1-9。ニュートラルは数字なし)+ボタン名(LP/MP/HP/LK/MK/HK)を連結して引く。
var stage2KeyPattern = regexp.MustCompile(`^[1-9]?(LP|MP|HP|LK|MK|HK)$`)

// resolvableCategories は解決表の候補になり得る category(CHANGE-069 §2.2-j の「意味的に
// 決めきれない/スコープ外は載せない」の具体化)。throw/super_art/target_combo/system/
// drive_impact/critical_art 等は実データでは形状フィルタで全て落ちるが、防御として明文化する。
var resolvableCategories = map[string]bool{
	model.MoveCategoryNormal:  true,
	model.MoveCategoryUnique:  true,
	model.MoveCategorySpecial: true,
}

// specialPriorityCategories は特殊技優先(request §1.2)で通常技より優先される category。
var specialPriorityCategories = map[string]bool{
	model.MoveCategoryUnique:  true,
	model.MoveCategorySpecial: true,
}

// MotionCommand は索引 1 行の素通し形(M21-06 §4.6)。
//
// ★段階2 の解決表(CommandIndex)とは別物である。畳まず・絞らず、そのまま返す。
type MotionCommand struct {
	TokenKey string
	MoveCode string
}

// Service は段階2 解決表の提供 IF。
type Service interface {
	// CommandIndex はキャラ 1 体分の畳み済み解決表(token_key → move_code)を返す。
	// 未 seed キャラ・存在しないキャラは空マップ(=FE では段階1 だけが動く・壊れない)。
	CommandIndex(ctx context.Context, characterID int64) (map[string]string, error)

	// MotionCommands はキャラ 1 体分の索引を畳まず素通しで返す(M21-06 §4.6)。
	// 未 seed キャラ・存在しないキャラは空スライス(=FE ではモードに入れないだけ・壊れない)。
	MotionCommands(ctx context.Context, characterID int64) ([]MotionCommand, error)
}

type service struct {
	repo movecommand.Repository
}

// New はサービスを構築する。
func New(repo movecommand.Repository) Service {
	return &service{repo: repo}
}

// CommandIndex は Service.CommandIndex を実装する。畳み込みの規則(すべてここ=Go に一元化):
//  1. moves.is_aerial = true を除外(空中特殊技=段階2 スコープ外。§1.5-4)。
//  2. category が normal/unique/special 以外を除外。
//  3. token_key が段階2 形状(stage2KeyPattern)以外を除外。
//  4. 特殊技優先: 同一 token_key に unique/special と normal が該当したら unique/special を採る。
//  5. なお複数残る場合は moves.id 最小を採る(決定論タイブレーク。実 moves.id を使用)。
//
// 派生技(is_derived=true)の再チェックは不要=索引は構築時点で非派生のみ
// (seed 時フィルタ・ユーザー生成行は move_commands に入らない)。
func (s *service) CommandIndex(ctx context.Context, characterID int64) (map[string]string, error) {
	if characterID <= 0 {
		return nil, ErrInvalidCharacterID
	}

	rows, err := s.repo.ListByCharacter(ctx, characterID)
	if err != nil {
		return nil, fmt.Errorf("list move commands: %w", err)
	}

	// token_key ごとの候補へ分配(規則 1〜3 のスコープ絞り込み)。
	byToken := map[string][]movecommand.Row{}
	for _, r := range rows {
		if r.IsAerial || !resolvableCategories[r.Category] || !stage2KeyPattern.MatchString(r.TokenKey) {
			continue
		}
		byToken[r.TokenKey] = append(byToken[r.TokenKey], r)
	}

	// 規則 4〜5 で 1 対 1 に畳む。
	entries := make(map[string]string, len(byToken))
	for token, candidates := range byToken {
		var specials, normals []movecommand.Row
		for _, c := range candidates {
			if specialPriorityCategories[c.Category] {
				specials = append(specials, c)
			} else {
				normals = append(normals, c)
			}
		}
		pool := normals
		if len(specials) > 0 {
			pool = specials // 特殊技優先(request §1.2)
		}
		winner := pool[0]
		for _, c := range pool[1:] {
			if c.MoveID < winner.MoveID {
				winner = c // moves.id 最小タイブレーク
			}
		}
		entries[token] = winner.MoveCode
	}
	return entries, nil
}

// MotionCommands は Service.MotionCommands を実装する(M21-06 §4.6)。
//
// ★本メソッドは CommandIndex の絞り込みを一切通さない。理由は 2 つある。
//
//  1. CommandIndex の形状フィルタ(stage2KeyPattern)は「単一方向+強度ボタン」だけを残すため、
//     236LP・623HP・236236P のような多方向コマンドが全て落ちる。物理モーション入力
//     (M21-06)が突き合わせたいのはまさにその落ちる側である。
//  2. ★だからといって CommandIndex 側を広げてはならない(§4.6-1)。同表は DES-004 §2.4.4 の
//     形状フィルタそのものであり、DES-005 §6.4 の一様フォールバック(解決表 → 段階1 の
//     構造引き)の入力である。広げると仮想コントローラの解決が静かに変わる。
//     ⇒ 「狭すぎる」のではなく「別目的で正しい」。別経路にするのが正しい形である。
//
// ★畳まない(1 対 1 にしない)。同一 token_key に複数の move が載る組は実データに 49 件あり
// (CA と SA3 が同一コマンドである組が 13 キャラ等)、畳むと「同じ長さで複数残るなら解決しない」
// (M21-06 §4.2-4・DES-004 §5 の逆引きと同じ流儀)が実装できなくなる。
//
// ★前方一致・最長一致は行わない(§4.6-5)。本メソッドは表を返すだけで、解決規則は FE が持つ
// (段階1 の縮約を FE が持っているのと同じ位置づけ)。
//
// ★読取専用である(契約 F-3)。move_commands / internal/moveindex は書かない・形を変えない。
func (s *service) MotionCommands(ctx context.Context, characterID int64) ([]MotionCommand, error) {
	if characterID <= 0 {
		return nil, ErrInvalidCharacterID
	}

	rows, err := s.repo.ListByCharacter(ctx, characterID)
	if err != nil {
		return nil, fmt.Errorf("list move commands: %w", err)
	}

	// ListByCharacter は move_id・token_key 昇順で返すため、出力順は決定的である。
	out := make([]MotionCommand, 0, len(rows))
	for _, r := range rows {
		out = append(out, MotionCommand{TokenKey: r.TokenKey, MoveCode: r.MoveCode})
	}
	return out, nil
}

package intake

import (
	"context"
	"fmt"
	"log/slog"
	"slices"

	"github.com/plexiblinp/tacpendium/internal/aliasindex"
	"github.com/plexiblinp/tacpendium/internal/model"
	"github.com/plexiblinp/tacpendium/internal/moveindex"
)

// indexLoader は move_commands から moveindex.Index を構築する依存(movecommand.Repository が満たす)。
// 索引 IF は段階2 と共通の基盤だが、取込側はフォールバックを持たない別の消費者として使う
// (段階2 の解決サービス inputresolve を流用しない=M17-04 §9.3)。
type indexLoader interface {
	LoadIndex(ctx context.Context) (*moveindex.Index, error)
}

// aliasEntryLoader は当該キャラの逆引き辞書(全プリセット横断)を返す依存
// (preset.Repository が満たす)。M20-07 で FindMoveCodesByAlias から置き換えた。
//
// ★1 表記ずつ SQL で引く形をやめた理由——逆引きの前段に NFKC 正規化を置くことになったが
// (D-307)、SQLite は NFKC を持たないため辞書側へ正規化を掛けられない。⇒ 辞書を丸ごと受け取り、
// 投入時と照会時の両方へ同じ正規化を掛ける索引(internal/aliasindex)を Go 側で組む。
type aliasEntryLoader interface {
	ListAliasEntriesByCharacter(ctx context.Context, charCode string) ([]model.AliasEntry, error)
}

// Service は他から引っ越しの ② 照合サービス。
type Service struct {
	index indexLoader
	alias aliasEntryLoader
}

// New は Service を構築する。
func New(index indexLoader, alias aliasEntryLoader) *Service {
	return &Service{index: index, alias: alias}
}

// Resolve は ① プロンプトの出力(TSV テキスト)を受け、各ステップのトークン列を move マスタへ
// 厳密照合して move_code を確定する。確定できない行は未解決のまま返す(フォールバックしない・
// エラーにしない=人レビュー動線で解決する。M17-04 §4.2/§4.3)。
//
// キャラは characterCode(characters.code)で明示的に受ける(AI に推測させない=別キャラの技を
// 引く事故の防止。M17-04 §4.5)。未投入キャラ・キャラ不明は全行未解決になるだけで壊れない。
//
// 索引は 2 つとも Resolve の冒頭で 1 回だけ構築する(ステップごとに引き直さない)。
func (s *Service) Resolve(ctx context.Context, characterCode, text string) (*ResolveResult, error) {
	ix, err := s.index.LoadIndex(ctx)
	if err != nil {
		return nil, fmt.Errorf("load move index: %w", err)
	}
	ax := s.loadAliasIndex(ctx, characterCode)

	result := &ResolveResult{
		CharacterCode:  characterCode,
		MovesAvailable: charKeyPresent(ix, characterCode),
	}

	// # ごとにコンボへまとめる(入力の出現順を保つ)。
	byCombo := make(map[int]int) // ComboIndex → result.Combos の添字
	for _, step := range ParseInput(text) {
		rs := s.resolveStep(ix, ax, characterCode, step)

		result.Summary.TotalSteps++
		if rs.Resolved {
			result.Summary.Resolved++
		} else {
			result.Summary.Unresolved++
		}

		idx, ok := byCombo[step.ComboIndex]
		if !ok {
			result.Combos = append(result.Combos, ResolvedCombo{ComboIndex: step.ComboIndex})
			idx = len(result.Combos) - 1
			byCombo[step.ComboIndex] = idx
		}
		result.Combos[idx].Steps = append(result.Combos[idx].Steps, rs)
	}

	return result, nil
}

// loadAliasIndex は当該キャラの逆引き索引を構築する。
//
// ★辞書の取得に失敗しても照合全体は落とさない(M17-04 以来の方針=別名照合が引けない行は
// 未解決として人レビューへ回せる)。ただし黙って無効化しない——空の索引で進んだことを
// WARN で残す。残さないと、利用者からは「急に別名で解決しなくなった」としか見えない。
func (s *Service) loadAliasIndex(ctx context.Context, characterCode string) *aliasindex.Index {
	entries, err := s.alias.ListAliasEntriesByCharacter(ctx, characterCode)
	if err != nil {
		slog.WarnContext(ctx, "intake resolve: 別名辞書を読めなかったため別名照合を行わない",
			slog.String("characterCode", characterCode),
			slog.String("err", err.Error()))
		return aliasindex.Build(nil)
	}
	return aliasindex.Build(entries)
}

// resolveStep は 1 ステップを照合する。順序: ① トークン列照合 → ② 別名照合 → ③ 未解決。
//
// ★決定論の骨格は M17-04 から不変である——確定するのは当たりが 1 件のときだけで、
// 0 件・複数件は未解決のまま返す。曖昧一致・編集距離・タイブレークは行わない。
func (s *Service) resolveStep(ix *moveindex.Index, ax *aliasindex.Index, charKey string, step Step) ResolvedStep {
	rs := ResolvedStep{Step: step}

	hasTokens := step.Tokens != "" && step.Tokens != unknownMark
	hasName := step.NameCandidate != "" && step.NameCandidate != unknownMark

	// ① トークン列照合(索引 IF の消費。Lookup が正規化を一元管理するため呼び出し側で再正規化しない)。
	if hasTokens {
		if code, ok := ix.Lookup(charKey, step.Tokens); ok {
			rs.MoveCode = code
			rs.Resolved = true
			rs.ResolvedVia = viaToken
		}
	}

	// ② 別名照合(正規化キーで一致・当たりが 1 件のときだけ確定)。
	// 索引が正規化を一元管理するため、ここでも呼び出し側で再正規化しない。
	var aliasCandidates []string
	if !rs.Resolved && hasName {
		codes := ax.Lookup(step.NameCandidate)
		if len(codes) == 1 {
			rs.MoveCode = codes[0]
			rs.Resolved = true
			rs.ResolvedVia = viaAlias
		} else {
			// ★複数件は候補として残す。M17-04 では捨てていたため、画面上で
			// 「候補が複数あって決められなかった」と「1 つも当たらなかった」が
			// 同じ顔になっていた(E-84)。
			aliasCandidates = append(aliasCandidates, codes...)
		}
	}

	// ②' 多候補ハッジの分割(G-14b)。丸ごとの照合が確定しなかったときだけ行う。
	// ★分割の結果は候補であって確定ではない——どれが正しいかはメモの書き手しか知らない
	// (指示書 §4.3-2)。したがって 1 件に解けても Resolved は立てない。
	if !rs.Resolved && hasName {
		for _, part := range SplitHedge(step.NameCandidate) {
			aliasCandidates = append(aliasCandidates, ax.Lookup(part)...)
		}
	}

	// ③ 候補一覧(人レビュー用)。未解決の再検討材料、および複数候補時の上書き候補として提示する。
	if hasTokens {
		rs.Candidates = ix.LookupAll(charKey, step.Tokens)
	}
	rs.Candidates = appendUnique(rs.Candidates, aliasCandidates)

	return rs
}

// appendUnique は既出でない code だけを順序を保って足す。
// 出どころ(トークン索引 / 別名)は問わず 1 つの候補列にまとめる。
func appendUnique(dst []string, src []string) []string {
	for _, code := range src {
		if code != "" && !slices.Contains(dst, code) {
			dst = append(dst, code)
		}
	}
	return dst
}

// charKeyPresent は当該キャラが索引に存在するか(= moves seed 済みか)を返す。
func charKeyPresent(ix *moveindex.Index, charKey string) bool {
	return slices.Contains(ix.CharKeys(), charKey)
}

package notation

import (
	"context"
	"fmt"
	"strings"

	"github.com/plexiblinp/tacpendium/internal/model"
)

const connector = " > "

// nonMoveTypeText は非技ステップ(modifiers.type)の表示テキスト。
// dash は M16-04 で system move へ一本化・撤去済み(移行後は resolveMoveStep が
// official_ja_move alias「前ダッシュ/後ろダッシュ」を解決する。DES-004 §2.1)。
var nonMoveTypeText = map[string]string{
	model.ModifierTypeParryDriveRush:  "生ラッシュ",
	model.ModifierTypeCancelDriveRush: "キャンセルラッシュ",
}

// flagText は modifiers.flags の表示語。★DES-004 §2.3 の「短縮表記」が正である。
//
// ★★★本表に埋め忘れた値は applyFlags のフォールバックで `{` + 内部識別子 + `}` に
// なり、利用者の画面へ英数字の内部コードがそのまま出る —— M37-RESEARCH-01 §3.2 の
// 実測では 10 値中 6 値がその状態だった(`{od_lm}` `{first_hit_cancel}` 等)。
// ★破壊確認は flagtext_internal_test.go にある(flagText が非公開のため、外部テスト
// パッケージの resolver_test.go には置けない)。
//
// ★★★【M37-06】本表は「選択肢」ではなく「表示語の引き当て表」である。⇒ 2 つの数が違う:
//
//	選択肢 = 14 値 … 編集 UI が出す値(フロントの MODIFIER_FLAGS_COMMON + OD 3 値)
//	本表   = 17 件 … 上記 14 値 ＋ 選択肢から外した 3 値(just / neutral_jump /
//	                 forward_jump)。★★外した 3 値の表示語は**残す**。
//
// ★★★3 値の表示語を消してはならない(指示書 §4.1 / §2.3-1)。消すと、その flag を
// 既に持っている既存行が再び `{just}` のような内部識別子むき出しで表示され、
// M37-02(B04)が消したフォールバックが戻る。⇒ 選択肢から外すことと、表示語を消すことは別である。
//
// ★値の集合の正本は DES-004 §2.3 であり、フロント側の写しは
// web/src/features/combo/labels.ts の MODIFIER_FLAGS_COMMON /
// MODIFIER_OD_VARIANT_FLAGS / MODIFIER_FLAGS_RETIRED。
// ⇒ flag を増やすときは 3 か所すべてを同時に直すこと。
//
// ★★★【M37-06 で状況が変わった】本表 ⇄ フロントの一致は
// web/src/features/combo/modifier-flag-labels.sync.test.ts が機械検査する
// (両向き＝コードの集合と表示語の両方を突き合わせる)。
// ⇒ 旧記述「機械検査は無い」は失効した。★ただし DES-004 §2.3(3 か所目)は
// 依然として検査の外であり、そこだけは人が読む以外に経路が無い。
// ★check-enum-sync.sh が flags を見ていないことは今も事実である —— フロント側の
// 定義が web/src/constants/ ではなく features/combo/labels.ts に在るためであり、
// 上記の同期テストはその穴を「照合」で塞いだだけで、定数の置き場は動かしていない
// (followup `modifier-flag-labels-triplicated-without-check`)。
var flagText = map[string]string{
	// --- タイミング系 ---
	"delay": "{ディレイ}",
	// ★link は*難易度*の注記である(「特定のタイミングでぴったり押す」)。接続が
	//   キャンセルでないことは no_cancel が表す。⇒ 別物であり統合しない(指示書 §0.3)。
	"link": "{目押し}",
	// --- キャンセル系 ---
	// ★キャンセルの既定は「キャンセルである」(指示書 §0.4)。何も付いていない
	//   ステップはキャンセルで繋いだと読む。⇒ 「キャンセルした」を表す flag は作らない。
	"first_hit_cancel": "{一段目キャンセル}",
	"no_cancel":        "{ノーキャン}",
	"late_cancel":      "{遅らせキャンセル}",
	// --- 空中・浮かせ系 ---
	// ★M37-06: 表示語を「低ジャンプ」→「低空」へ。★コードは不変(CHANGE-057)。
	"low_jump":    "{低空}",
	"juggle_high": "{高め当て}",
	"juggle_low":  "{低め当て}",
	// --- 当て方・位置系 ---
	"whiff":       "{空振り}",
	"meaty":       "{持続当て}",
	"cross_under": "{裏回り}",
	// --- OD ボタン組 ---
	"od_lm": "{OD(弱中)}",
	"od_mh": "{OD(中強)}",
	"od_lh": "{OD(弱強)}",

	// --- ★★★選択肢から外した 3 値(表示語のみ保持・M37-06) ---
	// ★既存行が持っているため消さない(上記の注記)。新規には選べない。
	"just":         "{ジャスト}",
	"neutral_jump": "{垂直ジャンプ中}",
	"forward_jump": "{前ジャンプ中}",
}

// resolverCtx はレシピ変換中に使い回すコンテキスト。
// official_ja_move のプリセット ID を 1 回だけ lookup してキャッシュする。
type resolverCtx struct {
	presetID       int64
	officialJaID   int64
	officialJaInit bool
}

func (s *service) resolveRecipe(ctx context.Context, steps []model.ComboStep, presetID int64) (string, error) {
	rc := &resolverCtx{presetID: presetID}

	parts := make([]string, 0, len(steps))
	for _, step := range steps {
		text, err := s.resolveStep(ctx, step, rc)
		if err != nil {
			return "", fmt.Errorf("resolve step %d: %w", step.StepOrder, err)
		}
		parts = append(parts, text)
	}
	return strings.Join(parts, connector), nil
}

func (s *service) resolveStep(ctx context.Context, step model.ComboStep, rc *resolverCtx) (string, error) {
	var base string

	if step.MoveID == nil {
		base = s.resolveNonMoveStep(step)
	} else {
		var err error
		base, err = s.resolveMoveStep(ctx, step, rc)
		if err != nil {
			return "", err
		}
	}

	return applyFlags(base, step.Modifiers), nil
}

func (s *service) resolveNonMoveStep(step model.ComboStep) string {
	if step.Modifiers != nil && step.Modifiers.Type != "" {
		if text, ok := nonMoveTypeText[step.Modifiers.Type]; ok {
			return text
		}
		return step.Modifiers.Type
	}
	return "?"
}

func (s *service) resolveMoveStep(ctx context.Context, step model.ComboStep, rc *resolverCtx) (string, error) {
	moveID := *step.MoveID

	// 1. 当該プリセットのエイリアスを探す
	alias, err := s.presetRepo.FindAlias(ctx, rc.presetID, moveID)
	if err != nil {
		return "", fmt.Errorf("find alias: %w", err)
	}
	if alias != nil {
		return alias.AliasText, nil
	}

	// 2. base_preset_code があればそのプリセットで探す（Phase1 では全て NULL）
	preset, err := s.presetRepo.FindPresetByID(ctx, rc.presetID)
	if err != nil {
		return "", fmt.Errorf("find preset: %w", err)
	}
	if preset.BasePresetCode != nil {
		basePreset, err := s.presetRepo.FindPresetByCode(ctx, *preset.BasePresetCode)
		if err == nil {
			alias, err = s.presetRepo.FindAlias(ctx, basePreset.ID, moveID)
			if err != nil {
				return "", fmt.Errorf("find base alias: %w", err)
			}
			if alias != nil {
				return alias.AliasText, nil
			}
		}
	}

	// 3. official_ja_move プリセットのエイリアスで探す
	officialID, err := s.getOfficialJaID(ctx, rc)
	if err != nil {
		return "", err
	}
	if officialID != rc.presetID {
		alias, err = s.presetRepo.FindAlias(ctx, officialID, moveID)
		if err != nil {
			return "", fmt.Errorf("find official alias: %w", err)
		}
		if alias != nil {
			return alias.AliasText, nil
		}
	}

	// 4. moves.code をそのまま使用
	if step.MoveCode != nil {
		return *step.MoveCode, nil
	}
	return fmt.Sprintf("move:%d", moveID), nil
}

func (s *service) getOfficialJaID(ctx context.Context, rc *resolverCtx) (int64, error) {
	if rc.officialJaInit {
		return rc.officialJaID, nil
	}
	p, err := s.presetRepo.FindPresetByCode(ctx, model.PresetCodeOfficialJaMove)
	if err != nil {
		return 0, fmt.Errorf("find official_ja_move preset: %w", err)
	}
	rc.officialJaID = p.ID
	rc.officialJaInit = true
	return rc.officialJaID, nil
}

func applyFlags(base string, mods *model.Modifiers) string {
	if mods == nil || (len(mods.Flags) == 0 && mods.Notes == "") {
		return base
	}
	result := base
	if len(mods.Flags) > 0 {
		parts := make([]string, 0, len(mods.Flags))
		for _, flag := range mods.Flags {
			if text, ok := flagText[flag]; ok {
				parts = append(parts, text)
			} else {
				parts = append(parts, "{"+flag+"}")
			}
		}
		result += " " + strings.Join(parts, " ")
	}
	if mods.Notes != "" {
		result += " (" + mods.Notes + ")"
	}
	return result
}

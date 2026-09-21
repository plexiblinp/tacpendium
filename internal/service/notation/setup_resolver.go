package notation

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"strconv"

	"github.com/plexiblinp/tacpendium/internal/model"
)

// setupStepsToComboSteps は SetupStep を ComboStep に変換する。
// resolveRecipe / RenderSteps が []model.ComboStep を要求するため、型変換が必要。
// 構造は同一(MoveID, StepOrder, MoveCode, Modifiers)。
func setupStepsToComboSteps(steps []model.SetupStep) []model.ComboStep {
	out := make([]model.ComboStep, len(steps))
	for i, s := range steps {
		out[i] = model.ComboStep{
			ID:        s.ID,
			StepOrder: s.StepOrder,
			MoveID:    s.MoveID,
			MoveCode:  s.MoveCode,
			Modifiers: s.Modifiers,
		}
	}
	return out
}

func (s *service) ResolveSetupRecipe(ctx context.Context, setupID, presetID int64) (string, error) {
	cacheJSON, err := s.setupRepo.GetRecipeCache(ctx, setupID)
	if err != nil {
		return "", fmt.Errorf("get setup recipe cache: %w", err)
	}

	cache := map[string]string{}
	if cacheJSON != nil && *cacheJSON != "" {
		if err := json.Unmarshal([]byte(*cacheJSON), &cache); err != nil {
			slog.Warn("invalid setup recipe_cache JSON, recomputing",
				slog.Int64("setup_id", setupID), slog.String("err", err.Error()))
		} else {
			key := strconv.FormatInt(presetID, 10)
			if text, ok := cache[key]; ok {
				return text, nil
			}
		}
	}

	text, err := s.ComputeSingleSetupCache(ctx, setupID, presetID)
	if err != nil {
		return "", err
	}

	cache[strconv.FormatInt(presetID, 10)] = text
	newJSON, err := json.Marshal(cache)
	if err == nil {
		if err := s.setupRepo.UpdateRecipeCache(ctx, setupID, string(newJSON)); err != nil {
			slog.Warn("failed to update setup recipe_cache",
				slog.Int64("setup_id", setupID), slog.String("err", err.Error()))
		}
	}

	return text, nil
}

// ResolveDeletedSetupRecipes は論理削除済みセットプレイのレシピ文字列をまとめて解決する
// (M23-06 §4.3-3)。ゴミ箱の名無しセットプレイを識別できるようにするための読み取り経路である。
//
// ★★ResolveSetupRecipe を使わないのは意図である(M23-06 実査 #1)。同メソッドは最初に
// setupRepo.GetRecipeCache を引くが、その SQL は `WHERE id = ? AND deleted_at IS NULL` で
// あり、M23-03 §4.2 が「combos 側と 2 つで 1 組」として意図的に塞いだ。
// ⇒ 削除済み行では ErrNotFound になり、キャッシュ経由では解決できない。
// ★塞ぎには触らない。代わりに setup_steps から直接組み立てる——setup_steps は論理削除で
// 消えていないため、レシピ文字列は構造的に再現できる。
//
// ★★recipe_cache へ書き戻さない。削除済み行の recipe_cache は NULL のままにする
// (論理削除の副作用は DES-002 §4.2 の契約であり、M23-03 が as-built で固定したばかりである)。
// ⇒ 本メソッドは DB へ 1 バイトも書かない。
//
// ★ステップ取得は setupRepo.FindStepsBySetupIDs で 1 クエリに畳む(N+1 回避)。
// エイリアス解決は既存 resolveRecipe の作法どおりステップ単位で引く(既存経路と同じ)。
func (s *service) ResolveDeletedSetupRecipes(ctx context.Context, setupIDs []int64, presetID int64) (map[int64]string, error) {
	result := make(map[int64]string, len(setupIDs))
	if len(setupIDs) == 0 {
		return result, nil
	}

	stepsMap, err := s.setupRepo.FindStepsBySetupIDs(ctx, setupIDs)
	if err != nil {
		return nil, fmt.Errorf("find steps for setups: %w", err)
	}

	for _, setupID := range setupIDs {
		steps := stepsMap[setupID]
		if len(steps) == 0 {
			// ★ステップが 0 件のセットプレイは在りうる。空文字を返して行を壊さない。
			result[setupID] = ""
			continue
		}
		text, err := s.resolveRecipe(ctx, setupStepsToComboSteps(steps), presetID)
		if err != nil {
			// ★★1 件の解決失敗で一覧全体を落とさない。
			//   ゴミ箱が開けないと復元も完全削除もできなくなる——本メソッドの動機
			//   (「識別手段がゼロだと取り違える」)に照らして、それが最悪の縮退である。
			//   ⇒ 当該行だけ空文字にして、画面は「(名称未設定)」へ落とす。行は出る。
			// ★黙って落とさない。既定プリセットが失われている等の環境異常は
			//   ログに残さないと原因に辿り着けない。
			slog.WarnContext(ctx, "resolve deleted setup recipe failed; falling back to empty",
				slog.Int64("setupId", setupID),
				slog.Int64("presetId", presetID),
				slog.String("err", err.Error()))
			result[setupID] = ""
			continue
		}
		result[setupID] = text
	}
	return result, nil
}

func (s *service) RecomputeSetupCache(ctx context.Context, tx *sql.Tx, setupID int64) error {
	presets, err := s.presetRepo.ListAllPresets(ctx)
	if err != nil {
		return fmt.Errorf("list presets: %w", err)
	}

	steps, err := s.setupRepo.FindStepsBySetupIDTx(ctx, tx, setupID)
	if err != nil {
		return fmt.Errorf("find setup steps: %w", err)
	}

	comboSteps := setupStepsToComboSteps(steps)
	cache := make(map[string]string, len(presets))
	for _, p := range presets {
		text, err := s.resolveRecipe(ctx, comboSteps, p.ID)
		if err != nil {
			return fmt.Errorf("resolve setup recipe preset=%d: %w", p.ID, err)
		}
		cache[strconv.FormatInt(p.ID, 10)] = text
	}

	newJSON, err := json.Marshal(cache)
	if err != nil {
		return fmt.Errorf("marshal setup recipe_cache: %w", err)
	}

	return s.setupRepo.UpdateRecipeCacheTx(ctx, tx, setupID, string(newJSON))
}

func (s *service) DeleteSetupCache(ctx context.Context, tx *sql.Tx, setupID int64) error {
	return s.setupRepo.SetRecipeCacheNullTx(ctx, tx, setupID)
}

func (s *service) ComputeSingleSetupCache(ctx context.Context, setupID, presetID int64) (string, error) {
	steps, err := s.setupRepo.FindStepsBySetupID(ctx, setupID)
	if err != nil {
		return "", fmt.Errorf("find setup steps: %w", err)
	}
	comboSteps := setupStepsToComboSteps(steps)
	return s.resolveRecipe(ctx, comboSteps, presetID)
}

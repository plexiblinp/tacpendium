package notation

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"strconv"

	"github.com/plexiblinp/tacpendium/internal/model"
	presetrepo "github.com/plexiblinp/tacpendium/internal/repository/preset"
)

func (s *service) ResolveComboRecipe(ctx context.Context, comboID, presetID int64) (string, error) {
	// プリセット存在検証を先に行う。キャッシュヒット経路でもプリセット不在を
	// ErrPresetNotFound で返し、存在しないプリセットのエントリがキャッシュに
	// 書き込まれるのを防ぐ（B8: 不在 preset_id が 500 になっていた是正）。
	if _, err := s.presetRepo.FindPresetByID(ctx, presetID); err != nil {
		if errors.Is(err, presetrepo.ErrNotFound) {
			return "", ErrPresetNotFound
		}
		return "", fmt.Errorf("find preset: %w", err)
	}

	cacheJSON, err := s.comboRepo.GetRecipeCache(ctx, comboID)
	if err != nil {
		return "", fmt.Errorf("get recipe cache: %w", err)
	}

	cache := map[string]string{}
	if cacheJSON != nil && *cacheJSON != "" {
		if err := json.Unmarshal([]byte(*cacheJSON), &cache); err != nil {
			slog.Warn("invalid recipe_cache JSON, recomputing",
				slog.Int64("combo_id", comboID), slog.String("err", err.Error()))
		} else {
			key := strconv.FormatInt(presetID, 10)
			if text, ok := cache[key]; ok {
				return text, nil
			}
		}
	}

	text, err := s.ComputeSingleCache(ctx, comboID, presetID)
	if err != nil {
		return "", err
	}

	cache[strconv.FormatInt(presetID, 10)] = text
	newJSON, err := json.Marshal(cache)
	if err == nil {
		if err := s.comboRepo.UpdateRecipeCache(ctx, comboID, string(newJSON)); err != nil {
			slog.Warn("failed to update recipe_cache",
				slog.Int64("combo_id", comboID), slog.String("err", err.Error()))
		}
	}

	return text, nil
}

func (s *service) RecomputeComboCache(ctx context.Context, tx *sql.Tx, comboID int64) error {
	presets, err := s.presetRepo.ListAllPresets(ctx)
	if err != nil {
		return fmt.Errorf("list presets: %w", err)
	}

	steps, err := s.comboRepo.FindStepsByComboIDTx(ctx, tx, comboID)
	if err != nil {
		return fmt.Errorf("find steps: %w", err)
	}

	cache := make(map[string]string, len(presets))
	for _, p := range presets {
		text, err := s.resolveRecipe(ctx, steps, p.ID)
		if err != nil {
			return fmt.Errorf("resolve recipe preset=%d: %w", p.ID, err)
		}
		cache[strconv.FormatInt(p.ID, 10)] = text
	}

	newJSON, err := json.Marshal(cache)
	if err != nil {
		return fmt.Errorf("marshal recipe_cache: %w", err)
	}

	return s.comboRepo.UpdateRecipeCacheTx(ctx, tx, comboID, string(newJSON))
}

func (s *service) DeleteComboCache(ctx context.Context, tx *sql.Tx, comboID int64) error {
	return s.comboRepo.SetRecipeCacheNullTx(ctx, tx, comboID)
}

// RecomputePresetCache は当該プリセット分の recipe_cache を再計算する。
//
// ★呼び出し規約は Service インタフェースの宣言を見ること(M20-05 §4.4-3・D-360)。
// 要点だけ再掲する——書き込みトランザクションの「外」で、コミット後に呼ぶ。
// 内側で呼ぶとコミット前のエイリアスが見えず、古い表記を silent に書き込む。
//
// 境界は本メソッドが自分で持つ。ループ全体を 1 トランザクションで囲むため、途中で
// 失敗したら 1 行も書き換わらない(§4.4-1。M20-05 以前は 53 行の部分更新が起きえた＝D-303)。
//
// ★この境界は「書き」についてのものである。計算に使う読み(エイリアス解決・steps 取得)は
// 従来どおり DB ハンドル直読みのままで、本メソッドの tx を通らない。呼び出し規約が
// 「コミット後に呼ぶ」であるため、読むべきものは常にコミット済みであり問題にならない。
func (s *service) RecomputePresetCache(ctx context.Context, presetID int64) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	combos, err := s.comboRepo.ListAllActiveCombosTx(ctx, tx)
	if err != nil {
		return fmt.Errorf("list active combos: %w", err)
	}

	key := strconv.FormatInt(presetID, 10)
	for _, c := range combos {
		cache := decodeRecipeCache(c.RecipeCache, "combo", c.ID)

		text, err := s.ComputeSingleCache(ctx, c.ID, presetID)
		if err != nil {
			return fmt.Errorf("compute cache combo=%d preset=%d: %w", c.ID, presetID, err)
		}
		cache[key] = text

		newJSON, err := json.Marshal(cache)
		if err != nil {
			return fmt.Errorf("marshal recipe_cache: %w", err)
		}
		if err := s.comboRepo.UpdateRecipeCacheTx(ctx, tx, c.ID, string(newJSON)); err != nil {
			return fmt.Errorf("update recipe cache combo=%d: %w", c.ID, err)
		}
	}

	// M4-01: セットプレイ側も再計算（SUPP-001 §7.1 注記、§7.5.5）
	setups, err := s.setupRepo.ListAllActiveSetupsTx(ctx, tx)
	if err != nil {
		return fmt.Errorf("list active setups: %w", err)
	}
	for _, setup := range setups {
		cache := decodeRecipeCache(setup.RecipeCache, "setup", setup.ID)

		text, err := s.ComputeSingleSetupCache(ctx, setup.ID, presetID)
		if err != nil {
			return fmt.Errorf("compute setup cache setup=%d preset=%d: %w", setup.ID, presetID, err)
		}
		cache[key] = text

		newJSON, err := json.Marshal(cache)
		if err != nil {
			return fmt.Errorf("marshal setup recipe_cache: %w", err)
		}
		if err := s.setupRepo.UpdateRecipeCacheTx(ctx, tx, setup.ID, string(newJSON)); err != nil {
			return fmt.Errorf("update setup recipe cache setup=%d: %w", setup.ID, err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit: %w", err)
	}
	return nil
}

// decodeRecipeCache は recipe_cache JSON を map へ復号する。
//
// ★壊れた JSON は空 map を返す。復号できないと他プリセットのエントリが落ちるが、
// ここで復旧はしない——本サブは再計算の中身を変えない(M20-05 §4.1-2)。
// ★厳密には旧実装と 1 点だけ違う: 旧は Unmarshal の戻り値を捨てていたため、
// 部分的にデコードできたエントリは残っていた。新は失敗時に空 map を返すため全部落ちる。
// 壊れた JSON という前提でのみ差が出る話であり、新のほうが挙動が一貫している。
// ただし黙って落とさず警告を残す(`E-84`＝「起きなかった」と「失敗した」を同じ顔で出さない)。
// 従来は戻り値を捨てており、エントリが消えても痕跡が残らなかった。
func decodeRecipeCache(raw *string, kind string, id int64) map[string]string {
	cache := map[string]string{}
	if raw == nil || *raw == "" {
		return cache
	}
	if err := json.Unmarshal([]byte(*raw), &cache); err != nil {
		slog.Warn("invalid recipe_cache JSON; other preset entries will be dropped on rewrite",
			slog.String("kind", kind), slog.Int64("id", id), slog.String("err", err.Error()))
		return map[string]string{}
	}
	return cache
}

func (s *service) DeletePresetCache(ctx context.Context, tx *sql.Tx, presetID int64) error {
	combos, err := s.comboRepo.ListAllActiveCombosTx(ctx, tx)
	if err != nil {
		return fmt.Errorf("list active combos: %w", err)
	}

	key := strconv.FormatInt(presetID, 10)
	for _, c := range combos {
		if c.RecipeCache == nil || *c.RecipeCache == "" {
			continue
		}
		cache := map[string]string{}
		if err := json.Unmarshal([]byte(*c.RecipeCache), &cache); err != nil {
			continue
		}
		if _, ok := cache[key]; !ok {
			continue
		}
		delete(cache, key)

		newJSON, err := json.Marshal(cache)
		if err != nil {
			return fmt.Errorf("marshal recipe_cache: %w", err)
		}
		if err := s.comboRepo.UpdateRecipeCacheTx(ctx, tx, c.ID, string(newJSON)); err != nil {
			return fmt.Errorf("update recipe cache combo=%d: %w", c.ID, err)
		}
	}

	// M4-01: セットプレイ側からも preset key を削除（SUPP-001 §7.5.5）
	setups, err := s.setupRepo.ListAllActiveSetupsTx(ctx, tx)
	if err != nil {
		return fmt.Errorf("list active setups: %w", err)
	}
	for _, setup := range setups {
		if setup.RecipeCache == nil || *setup.RecipeCache == "" {
			continue
		}
		cache := map[string]string{}
		if err := json.Unmarshal([]byte(*setup.RecipeCache), &cache); err != nil {
			continue
		}
		if _, ok := cache[key]; !ok {
			continue
		}
		delete(cache, key)

		newJSON, err := json.Marshal(cache)
		if err != nil {
			return fmt.Errorf("marshal setup recipe_cache: %w", err)
		}
		if err := s.setupRepo.UpdateRecipeCacheTx(ctx, tx, setup.ID, string(newJSON)); err != nil {
			return fmt.Errorf("update setup recipe cache setup=%d: %w", setup.ID, err)
		}
	}

	return nil
}

func (s *service) ComputeSingleCache(ctx context.Context, comboID, presetID int64) (string, error) {
	stepsMap, err := s.comboRepo.FindStepsForCombos(ctx, []int64{comboID})
	if err != nil {
		return "", fmt.Errorf("find steps: %w", err)
	}
	steps := stepsMap[comboID]
	return s.resolveRecipe(ctx, steps, presetID)
}

func (s *service) RenderSteps(ctx context.Context, presetID int64, steps []model.ComboStep) (string, error) {
	return s.resolveRecipe(ctx, steps, presetID)
}

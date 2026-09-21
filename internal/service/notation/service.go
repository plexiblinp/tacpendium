package notation

import (
	"context"
	"database/sql"
	"errors"

	"github.com/plexiblinp/tacpendium/internal/model"
	comborepo "github.com/plexiblinp/tacpendium/internal/repository/combo"
	presetrepo "github.com/plexiblinp/tacpendium/internal/repository/preset"
	setuprepo "github.com/plexiblinp/tacpendium/internal/repository/setup"
)

// ErrPresetNotFound は指定されたプリセットが存在しない場合のセンチネル。
// ハンドラ層はこれを 404 に振り分ける。
var ErrPresetNotFound = errors.New("notation: preset not found")

// Service はエイリアス解決・recipe_cache 計算の公開インタフェース（SUPP-001 §7.1）。
type Service interface {
	// ResolveComboRecipe は UI 表示時に recipe_cache から取得し、未生成なら計算して更新する。
	ResolveComboRecipe(ctx context.Context, comboID, presetID int64) (string, error)

	// RecomputeComboCache は全プリセット分の recipe_cache JSON を計算して更新する。
	// コンボ作成・キー変更編集・復元時に tx 内で呼ばれる。
	RecomputeComboCache(ctx context.Context, tx *sql.Tx, comboID int64) error

	// DeleteComboCache は recipe_cache を NULL に設定する。論理削除時に tx 内で呼ばれる。
	DeleteComboCache(ctx context.Context, tx *sql.Tx, comboID int64) error

	// RecomputePresetCache は全コンボ・全セットプレイの recipe_cache のうち当該プリセットの
	// 値を再計算する。プリセットの作成・エイリアス更新・既定プリセットの切替から呼ばれる。
	//
	// ★★ 呼び出し規約(M20-05 §4.4-3・D-360)★★
	// 本メソッドは書き込みトランザクションの「外」で、コミット後に呼ぶこと。tx を引数に
	// 取らないのはそのためである(§4.4-4＝「tx を取るのに読みは見ない」形を作らない)。
	// エイリアスの解決は presetRepo を DB ハンドル直読みで引くため、書き込み tx の内側で
	// 呼ぶとコミット前のエイリアスが見えず「古い表記」を書き込む。エラーにはならない。
	//
	// 境界は本メソッドが自分で持つ。内部で 1 トランザクションを開き、全対象の更新を
	// その中で行う——途中で失敗したら 1 行も書き換わらない(§4.4-1)。
	RecomputePresetCache(ctx context.Context, presetID int64) error

	// DeletePresetCache は全コンボ・全セットプレイの recipe_cache から当該プリセットの
	// キーを削除する。プリセット削除時に、削除本体と同一 tx 内で呼ばれる(§4.4-7)。
	//
	// ★読みも書きも渡された tx を通す(§4.4-4)。combos / setups しか触らないため、
	// presets を消す tx の内側から呼んでも read-your-own-write の問題は起きない。
	DeletePresetCache(ctx context.Context, tx *sql.Tx, presetID int64) error

	// ComputeSingleCache は単一エントリ (comboID, presetID) の計算を行う。
	ComputeSingleCache(ctx context.Context, comboID, presetID int64) (string, error)

	// RenderSteps は任意のステップ列を指定プリセットでテキスト化する（DB 書込なし）。
	RenderSteps(ctx context.Context, presetID int64, steps []model.ComboStep) (string, error)

	// --- M4-01: セットプレイ用 recipe_cache 関数（SUPP-001 §7.1 / §7.5） ---

	// ResolveSetupRecipe は UI 表示時に setup の recipe_cache から取得し、未生成なら計算して更新する。
	//
	// ★★論理削除済みのセットプレイには使えない。内部で引く setupRepo.GetRecipeCache が
	// `deleted_at IS NULL` で塞がれており(M23-03 §4.2)、ErrNotFound になる。
	// 削除済み行のレシピ文字列が要る場合は ResolveDeletedSetupRecipes を使うこと。
	ResolveSetupRecipe(ctx context.Context, setupID, presetID int64) (string, error)

	// ResolveDeletedSetupRecipes は論理削除済みセットプレイのレシピ文字列をまとめて解決する
	// (M23-06 §4.3-3)。setup_steps から直接組み立て、DB へは書き込まない。
	ResolveDeletedSetupRecipes(ctx context.Context, setupIDs []int64, presetID int64) (map[int64]string, error)

	// RecomputeSetupCache は全プリセット分の setup recipe_cache JSON を計算して更新する。
	RecomputeSetupCache(ctx context.Context, tx *sql.Tx, setupID int64) error

	// DeleteSetupCache は setup の recipe_cache を NULL に設定する。論理削除時に呼ぶ。
	DeleteSetupCache(ctx context.Context, tx *sql.Tx, setupID int64) error

	// ComputeSingleSetupCache は単一エントリ (setupID, presetID) の計算を行う。
	ComputeSingleSetupCache(ctx context.Context, setupID, presetID int64) (string, error)
}

type service struct {
	// db は RecomputePresetCache が自前でトランザクション境界を持つために要る
	// (M20-05 §4.4・D-360)。他のメソッドは呼び出し側の tx を受け取るため使わない。
	db         *sql.DB
	presetRepo presetrepo.Repository
	comboRepo  comborepo.Repository
	setupRepo  setuprepo.Repository
}

// New は Service 実装を構築する。
//
// db は RecomputePresetCache の境界のためだけに使う(M20-05 §4.4)。
func New(db *sql.DB, presetRepo presetrepo.Repository, comboRepo comborepo.Repository, setupRepo setuprepo.Repository) Service {
	return &service{
		db:         db,
		presetRepo: presetRepo,
		comboRepo:  comboRepo,
		setupRepo:  setupRepo,
	}
}

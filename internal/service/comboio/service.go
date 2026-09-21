package comboio

import (
	"context"
	"database/sql"

	"github.com/plexiblinp/tacpendium/internal/model"
	moverepo "github.com/plexiblinp/tacpendium/internal/repository/move"
	combosvc "github.com/plexiblinp/tacpendium/internal/service/combo"
	setupsvc "github.com/plexiblinp/tacpendium/internal/service/setup"
	"github.com/plexiblinp/tacpendium/internal/service/validation"
)

// ── 依存インターフェース(既存の concrete 型がそのまま満たす。テストでモック可)──

// ComboService はコンボの作成・重複判定・一覧取得(combosvc.Service の部分集合)。
type ComboService interface {
	Create(ctx context.Context, input combosvc.CreateInput) (*model.Combo, validation.ValidationResult, error)
	Get(ctx context.Context, id, userID int64) (*model.Combo, error)
	List(ctx context.Context, filter combosvc.ListFilter) ([]*model.Combo, error)
	// Count は絞り込みに一致する総数(上限を掛けない数)。
	// ★書出が上限で切り捨てたかを判定するために要る(M29-02 §2.1)。
	Count(ctx context.Context, filter combosvc.ListFilter) (int, error)
	CheckDuplicate(ctx context.Context, input combosvc.CheckDuplicateInput) (*combosvc.CheckDuplicateResult, error)
}

// SetupService はセットプレイの作成・一覧取得(setupsvc.Service の部分集合)。
type SetupService interface {
	CreateSetup(ctx context.Context, parentComboID int64, input setupsvc.CreateSetupInput) (*setupsvc.SetupResponse, validation.ValidationResult, error)
	GetSetup(ctx context.Context, setupID int64) (*setupsvc.SetupResponse, error)
	ListSetupsByComboIDs(ctx context.Context, comboIDs []int64) (map[int64][]*setupsvc.SetupResponse, error)
}

// TagService はタグの一覧取得・作成(tagsvc.Service の部分集合)。
type TagService interface {
	ListTags(ctx context.Context, userID int64, category string, includeUsage bool, characterID *int64) ([]model.Tag, error)
	CreateTag(ctx context.Context, userID int64, input model.CreateTagInput) (*model.Tag, error)
}

// ComboRepo はコンボの steps バルク取得(comborepo.Repository の部分集合)。
type ComboRepo interface {
	FindStepsForCombos(ctx context.Context, comboIDs []int64) (map[int64][]model.ComboStep, error)
}

// CharRepo はキャラマスタ参照(charrepo.Repository の部分集合)。
type CharRepo interface {
	GameIDByCode(ctx context.Context, code string) (int64, error)
	ListByGame(ctx context.Context, gameID int64) ([]model.Character, error)
}

// MoveRepo は技マスタ参照(moverepo.Repository の部分集合)。
type MoveRepo interface {
	ListByCharacter(ctx context.Context, characterID int64) ([]moverepo.MoveListItem, error)
}

// Service は comboio のビジネスロジック(export / import preview / import commit)。
type Service interface {
	// ExportCSV は対象コンボ + 紐づくセットプレイを 2 CSV(zip 同梱・in-memory)で返す。
	ExportCSV(ctx context.Context, query ExportQuery) (*ExportResult, error)
	// ParsePreview はコンボ CSV(+任意セットプレイ CSV)を検証・無害化し、行ごとの結果を返す(DB 書込なし)。
	ParsePreview(ctx context.Context, comboCSV, setupCSV string) (*PreviewResult, error)
	// Commit は選択 local_id のコンボ(+紐づくセットプレイ)を取り込み、行単位レポートを返す。
	Commit(ctx context.Context, comboCSV, setupCSV string, selected []string, action DupAction, userID int64) (*CommitResult, error)
}

type service struct {
	db        *sql.DB
	comboRepo ComboRepo
	charRepo  CharRepo
	moveRepo  MoveRepo
	comboSvc  ComboService
	setupSvc  SetupService
	tagSvc    TagService
}

// New は comboio Service を構築する。
func New(
	db *sql.DB,
	comboRepo ComboRepo,
	charRepo CharRepo,
	moveRepo MoveRepo,
	comboSvc ComboService,
	setupSvc SetupService,
	tagSvc TagService,
) Service {
	return &service{
		db:        db,
		comboRepo: comboRepo,
		charRepo:  charRepo,
		moveRepo:  moveRepo,
		comboSvc:  comboSvc,
		setupSvc:  setupSvc,
		tagSvc:    tagSvc,
	}
}

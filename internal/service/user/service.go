package user

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"github.com/plexiblinp/tacpendium/internal/model"
	tagrepo "github.com/plexiblinp/tacpendium/internal/repository/tag"
	userrepo "github.com/plexiblinp/tacpendium/internal/repository/user"
)

// センチネル。
var (
	// ErrNameEmpty は利用者名が空の場合。
	ErrNameEmpty = errors.New("user: name is empty")
	// ErrNameDuplicate は同名の利用者が既に居る場合。
	ErrNameDuplicate = errors.New("user: name duplicate")
	// ErrNotFound は対象の利用者が居ない場合。
	ErrNotFound = userrepo.ErrNotFound
)

// maxNameLength は利用者名の上限。★画面の表示崩れを避けるための実務的な上限であり、
// 認証の強度とは無関係である(FR501 は「簡易的なログイン」)。
const maxNameLength = 50

// Service はユーザー管理のビジネスロジック。
type Service interface {
	// List は全ユーザーを id 昇順で返す。
	List(ctx context.Context) ([]model.User, error)
	// Create は利用者を作り、既定タグ(mycombo_status の 3 件)を同時に生成する。
	Create(ctx context.Context, name string) (*model.User, error)
	// Rename は利用者名を変更する。
	Rename(ctx context.Context, id int64, name string) (*model.User, error)
	// DefaultUserID は「選ばれていないとき」に使う既定の利用者 ID を返す。
	DefaultUserID(ctx context.Context) (int64, error)
}

type service struct {
	db      *sql.DB
	repo    userrepo.Repository
	tagRepo tagrepo.Repository
}

// New はサービスを構築する。
func New(db *sql.DB, repo userrepo.Repository, tagRepo tagrepo.Repository) Service {
	return &service{db: db, repo: repo, tagRepo: tagRepo}
}

func (s *service) List(ctx context.Context) ([]model.User, error) {
	return s.repo.List(ctx)
}

// DefaultUserID は最小の users.id を返す。
//
// ★利用者が 1 人なら選択画面を出さない(FR502)。また X-User-Id を送らない
// 呼び出し元(既存の E2E・curl 等)も居る。そのときに何を使うかを 1 か所で決める。
// ⇒ 既存環境では常に 1 になり、いままでの挙動と 1 バイトも変わらない
// (users の初期行は migrations/000009 が入れる id=1 の 'default' のみ)。
func (s *service) DefaultUserID(ctx context.Context) (int64, error) {
	return s.repo.MinID(ctx)
}

func normalizeName(name string) string {
	return strings.TrimSpace(name)
}

func (s *service) validateName(ctx context.Context, name string) (string, error) {
	trimmed := normalizeName(name)
	if trimmed == "" {
		return "", ErrNameEmpty
	}
	if len([]rune(trimmed)) > maxNameLength {
		return "", fmt.Errorf("%w: over %d characters", ErrNameEmpty, maxNameLength)
	}
	exists, err := s.repo.ExistsByName(ctx, trimmed)
	if err != nil {
		return "", err
	}
	if exists {
		return "", ErrNameDuplicate
	}
	return trimmed, nil
}

// Create は利用者と既定タグを 1 つのトランザクションで作る。
//
// ★既定タグを同時に作るのは、タグが利用者ごとに閉じているためである(D-402)。
// migrations/000009 は user_id = 1 にしか投入しておらず、旧 000007(M33-02 が 9 群へ
// 潰す前の同等マイグレ)のヘッダ自身が「M6 着手時にウィザード経由生成へ切り替える」と
// 宣言していた(SUPP-001 §3.6)。
// ⇒ 生成しないと 2 人目はマイコンボのステータスを 1 件も引けない。
// ★user_id = 1 の既存 3 行には触れない。
func (s *service) Create(ctx context.Context, name string) (*model.User, error) {
	trimmed, err := s.validateName(ctx, name)
	if err != nil {
		return nil, err
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("user create begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	id, err := s.repo.CreateTx(ctx, tx, trimmed)
	if err != nil {
		return nil, err
	}

	for _, def := range model.DefaultMyComboStatusTags {
		category := model.TagCategoryMyComboStatus
		color := def.Color
		if err := s.tagRepo.CreateTx(ctx, tx, id, model.CreateTagInput{
			Name:     def.Name,
			Category: &category,
			Color:    &color,
		}); err != nil {
			return nil, fmt.Errorf("create default tag %q: %w", def.Name, err)
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("user create commit: %w", err)
	}
	return s.repo.GetByID(ctx, id)
}

func (s *service) Rename(ctx context.Context, id int64, name string) (*model.User, error) {
	trimmed, err := s.validateName(ctx, name)
	if err != nil {
		return nil, err
	}
	if err := s.repo.UpdateName(ctx, id, trimmed); err != nil {
		return nil, err
	}
	return s.repo.GetByID(ctx, id)
}

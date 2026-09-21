// Package tag はタグのビジネスロジックを提供する。M3 で実装。
package tag

import (
	"context"
	"errors"
	"strings"

	"github.com/plexiblinp/tacpendium/internal/model"
	tagrepo "github.com/plexiblinp/tacpendium/internal/repository/tag"
)

// Service はタグ CRUD のビジネスロジックを提供する。
type Service interface {
	// ListTags はユーザーのタグ一覧を返す。
	// category が空文字でない場合、その category で絞り込む。
	// includeUsage が true の場合、Tag.UsageCount を combo_tags との JOIN で算出する。
	// characterID が非 nil の場合、UsageCount を当該キャラのコンボのみで集計する(E-3)。
	ListTags(ctx context.Context, userID int64, category string, includeUsage bool, characterID *int64) ([]model.Tag, error)

	// GetTag は単一タグを返す。存在しない場合は ErrNotFound。
	GetTag(ctx context.Context, userID, tagID int64) (*model.Tag, error)

	// CreateTag は新規タグを作成する。VAL-T01 / VAL-T02 を検証する。
	CreateTag(ctx context.Context, userID int64, input model.CreateTagInput) (*model.Tag, error)

	// UpdateTag は既存タグを部分更新する。VAL-T01 / VAL-T02 を検証する。
	UpdateTag(ctx context.Context, userID, tagID int64, input model.UpdateTagInput) (*model.Tag, error)

	// DeleteTag はタグを削除する。force=false かつ使用中の場合 ErrTagInUse を返す。
	DeleteTag(ctx context.Context, userID, tagID int64, force bool) error
}

type service struct {
	repo tagrepo.Repository
}

// New はサービスを構築する。
func New(repo tagrepo.Repository) Service {
	return &service{repo: repo}
}

// ListTags はユーザーのタグ一覧を返す。
func (s *service) ListTags(ctx context.Context, userID int64, category string, includeUsage bool, characterID *int64) ([]model.Tag, error) {
	tags, err := s.repo.List(ctx, userID, category, includeUsage, characterID)
	if err != nil {
		return nil, err
	}
	if tags == nil {
		tags = []model.Tag{}
	}
	return tags, nil
}

// GetTag は単一タグを返す。
func (s *service) GetTag(ctx context.Context, userID, tagID int64) (*model.Tag, error) {
	tag, err := s.repo.Get(ctx, userID, tagID)
	if errors.Is(err, tagrepo.ErrNotFound) {
		return nil, ErrNotFound
	}
	return tag, err
}

// CreateTag は新規タグを作成する。
func (s *service) CreateTag(ctx context.Context, userID int64, input model.CreateTagInput) (*model.Tag, error) {
	if err := validateName(input.Name); err != nil {
		return nil, err
	}
	existing, err := s.repo.List(ctx, userID, "", false, nil)
	if err != nil {
		return nil, err
	}
	for _, t := range existing {
		if t.Name == input.Name {
			return nil, ErrTagNameDuplicate
		}
	}
	return s.repo.Create(ctx, userID, input)
}

// UpdateTag は既存タグを部分更新する。
func (s *service) UpdateTag(ctx context.Context, userID, tagID int64, input model.UpdateTagInput) (*model.Tag, error) {
	if input.Name != nil {
		if err := validateName(*input.Name); err != nil {
			return nil, err
		}
		existing, err := s.repo.List(ctx, userID, "", false, nil)
		if err != nil {
			return nil, err
		}
		for _, t := range existing {
			if t.Name == *input.Name && t.ID != tagID {
				return nil, ErrTagNameDuplicate
			}
		}
	}
	tag, err := s.repo.Update(ctx, userID, tagID, input)
	if errors.Is(err, tagrepo.ErrNotFound) {
		return nil, ErrNotFound
	}
	return tag, err
}

// DeleteTag はタグを削除する。force=false かつ使用中の場合 ErrTagInUse を返す。
func (s *service) DeleteTag(ctx context.Context, userID, tagID int64, force bool) error {
	if _, err := s.repo.Get(ctx, userID, tagID); err != nil {
		if errors.Is(err, tagrepo.ErrNotFound) {
			return ErrNotFound
		}
		return err
	}
	if !force {
		count, err := s.repo.CountUsage(ctx, tagID)
		if err != nil {
			return err
		}
		if count > 0 {
			return &TagInUseError{UsageCount: count}
		}
	}
	err := s.repo.Delete(ctx, userID, tagID)
	if errors.Is(err, tagrepo.ErrNotFound) {
		return ErrNotFound
	}
	return err
}

// validateName は VAL-T02(タグ名が空でないか)を検証する。
func validateName(name string) error {
	if strings.TrimSpace(name) == "" {
		return ErrTagNameEmpty
	}
	return nil
}

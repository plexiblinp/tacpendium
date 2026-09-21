// Package character はキャラクターマスタのビジネスロジックを提供する。
package character

import (
	"context"
	"errors"
	"fmt"

	"github.com/plexiblinp/tacpendium/internal/model"
	charrepo "github.com/plexiblinp/tacpendium/internal/repository/character"
)

// ErrInvalidGameID は gameID が不正(0 以下)の場合に返される。
var ErrInvalidGameID = errors.New("invalid game id")

// Service はキャラクターマスタのビジネスロジックを提供する。
type Service interface {
	// ListByGame は指定ゲームの全キャラクターを返す。
	ListByGame(ctx context.Context, gameID int64) ([]model.Character, error)
}

type service struct {
	repo charrepo.Repository
}

// New はサービスを構築する。
func New(repo charrepo.Repository) Service {
	return &service{repo: repo}
}

// ListByGame は指定ゲームの全キャラクターを返す。
func (s *service) ListByGame(ctx context.Context, gameID int64) ([]model.Character, error) {
	if gameID <= 0 {
		return nil, fmt.Errorf("%w: %d", ErrInvalidGameID, gameID)
	}
	chars, err := s.repo.ListByGame(ctx, gameID)
	if err != nil {
		return nil, err
	}
	if chars == nil {
		chars = []model.Character{}
	}
	return chars, nil
}

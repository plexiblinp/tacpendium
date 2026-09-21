// Package move は技マスタ(moves)の編集・派生生成のビジネスロジックを提供する(M9-03、FR703)。
//
// 取込済み moves の手動補正(PATCH /api/moves/:id)とラッシュ版生成
// (POST /api/moves/:id/rush-variant)を担う。取込パイプライン(M9-02)とは独立。
package move

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/plexiblinp/tacpendium/internal/model"
	moverepo "github.com/plexiblinp/tacpendium/internal/repository/move"
)

// ErrNotFound は対象 move が存在しない場合に返す(→ 404)。
var ErrNotFound = errors.New("move not found")

// RushConflictError は同一 original_move_id の rush_variant が既存の場合に返す(→ 409)。
// ExistingID に既存 rush_variant の id を載せ、UI が既存行へ誘導できるようにする(CHANGE-032)。
type RushConflictError struct {
	ExistingID int64
}

func (e *RushConflictError) Error() string {
	return fmt.Sprintf("rush variant already exists (id=%d)", e.ExistingID)
}

// ValidationError は編集値の型・制約違反(DES-006、§4.7)。→ 400。
//
// 要確認状態(total NULL 等)のまま保存することは許容するが、enum 値域・JSON 整形式
// 違反は拒否する。
type ValidationError struct {
	Field   string
	Message string
}

func (e *ValidationError) Error() string {
	return fmt.Sprintf("validation error (%s): %s", e.Field, e.Message)
}

// RushTargetError はラッシュ版生成の対象規則違反(category/is_aerial)。→ 400。
type RushTargetError struct {
	Message string
}

func (e *RushTargetError) Error() string { return e.Message }

// Service は技マスタの編集・派生生成サービス。
type Service struct {
	repo moverepo.Repository
}

// New は Service を構築する。
func New(repo moverepo.Repository) *Service {
	return &Service{repo: repo}
}

// GetMove は編集グリッド用に move 1 行をフル取得する(GET /api/moves/:id)。
func (s *Service) GetMove(ctx context.Context, id int64) (*moverepo.MoveDetail, error) {
	m, err := s.repo.GetByID(ctx, id)
	if errors.Is(err, moverepo.ErrNotFound) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get move: %w", err)
	}
	return m, nil
}

// UpdateMove は move を部分更新し、更新後の move を返す(PATCH /api/moves/:id)。
func (s *Service) UpdateMove(ctx context.Context, id int64, f moverepo.UpdateMoveFields) (*moverepo.MoveDetail, error) {
	if err := validateFields(f); err != nil {
		return nil, err
	}
	if err := s.repo.UpdateFields(ctx, id, f); err != nil {
		if errors.Is(err, moverepo.ErrNotFound) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("update move: %w", err)
	}
	return s.GetMove(ctx, id)
}

// GenerateRushVariant は対象 move からラッシュ版を派生生成し、生成した move を返す
// (POST /api/moves/:id/rush-variant)。
//
// 規則(サーバ強制、DES-003 §3.3 L279/L287): category ∈ {normal, unique} かつ is_aerial = false。
// 重複時は既存 id を載せた RushConflictError を返す(CHANGE-032)。
func (s *Service) GenerateRushVariant(ctx context.Context, id int64) (*moverepo.MoveDetail, error) {
	src, err := s.GetMove(ctx, id)
	if err != nil {
		return nil, err
	}
	if !rushEligible(src.Category, src.IsAerial) {
		return nil, &RushTargetError{
			Message: "ラッシュ版を生成できるのは通常技・特殊技(category=normal/unique)かつ非空中技(is_aerial=false)のみです",
		}
	}
	newID, err := s.repo.InsertRushVariant(ctx, &src.Move)
	if errors.Is(err, moverepo.ErrConflict) {
		// repo は既存 rush_variant の id を newID に載せて ErrConflict を返す。
		return nil, &RushConflictError{ExistingID: newID}
	}
	if err != nil {
		return nil, fmt.Errorf("generate rush variant: %w", err)
	}
	return s.GetMove(ctx, newID)
}

// rushEligible はラッシュ版生成対象か判定する(category ∈ {normal, unique} ∧ !is_aerial)。
func rushEligible(category string, isAerial bool) bool {
	if isAerial {
		return false
	}
	return category == model.MoveCategoryNormal || category == model.MoveCategoryUnique
}

// validateFields は編集値の型・制約を検証する(DES-006、§4.7 寛容方針)。
//
// raw_data は JSON オブジェクト整形式チェックのみ(キーの将来追加に寛容)。total・各フレーム・recovery は
// 型のみ(bind 済み)で範囲強制なし。M14-01 で properties / combo_scaling 列を削除したため両者の値域・
// 整形式検証を撤去し、消費者を失った properties ホワイトリスト IsKnownProperty も M14-02 の取込削除で除去した。
func validateFields(f moverepo.UpdateMoveFields) error {
	if f.RawData != nil && *f.RawData != "" {
		if !isJSONObject(*f.RawData) {
			return &ValidationError{Field: "rawData", Message: "JSON オブジェクトとして整形式ではありません"}
		}
	}
	return nil
}

// isJSONObject は文字列が JSON オブジェクトとしてパースできるか判定する。
func isJSONObject(s string) bool {
	var obj map[string]json.RawMessage
	return json.Unmarshal([]byte(s), &obj) == nil
}

package preset

import "github.com/plexiblinp/tacpendium/internal/model"

// PresetResponse は GET /api/presets、GET /api/presets/:id のレスポンス。
//
// ★M20-04 で書き込み API を足したが、本 DTO は 1 バイトも変えていない
// (既存の読み取り 2 本の契約は不変＝指示書 §5 (j))。POST / PUT の応答にも
// 同じ形を使う。
type PresetResponse struct {
	ID             int64   `json:"id"`
	Code           string  `json:"code"`
	Name           string  `json:"name"`
	BasePresetCode *string `json:"basePresetCode,omitempty"`
	IsBuiltin      bool    `json:"isBuiltin"`
	UserID         *int64  `json:"userId,omitempty"`
}

func toPresetResponse(p *model.Preset) PresetResponse {
	return PresetResponse{
		ID:             p.ID,
		Code:           p.Code,
		Name:           p.Name,
		BasePresetCode: p.BasePresetCode,
		IsBuiltin:      p.IsBuiltin,
		UserID:         p.UserID,
	}
}

// CreatePresetRequest は POST /api/presets のリクエストボディ。
//
// コピー元は code で指定する(id ではない)。code が canonical な識別子であり
// (DES-004 §3.1)、id は投入順の産物にすぎない。
type CreatePresetRequest struct {
	BasePresetCode string `json:"basePresetCode"`
	Name           string `json:"name"`
}

// UpdatePresetRequest は PUT /api/presets/:id のリクエストボディ。
//
// 部分更新である。Name が nil なら名前を変えず、Aliases が空なら
// エイリアスを変えない。
//
// ★編集できるのは名前とエイリアス表記だけである(DES-004 §6.2)。連結子・
// ベースプリセット名・フォールバック挙動・技の追加削除は編集対象にしない。
// ★alias_text_en も編集対象にしない(生成規則が入れる列であり、編集すると
// 次の seed 波の再適用で消える。DES-004 §5.4)。
type UpdatePresetRequest struct {
	Name    *string              `json:"name,omitempty"`
	Aliases []AliasUpdateRequest `json:"aliases,omitempty"`
}

// AliasUpdateRequest は 1 件のエイリアス更新。
type AliasUpdateRequest struct {
	MoveID    int64  `json:"moveId"`
	AliasText string `json:"aliasText"`
}

// AliasResponse は GET /api/presets/:id/aliases のレスポンス要素。
type AliasResponse struct {
	MoveID            int64   `json:"moveId"`
	MoveCode          string  `json:"moveCode"`
	MoveCategory      string  `json:"moveCategory"`
	CharacterID       int64   `json:"characterId"`
	AliasText         string  `json:"aliasText"`
	AliasTextEn       *string `json:"aliasTextEn,omitempty"`
	OfficialAliasText *string `json:"officialAliasText,omitempty"`
}

func toAliasResponse(d model.PresetAliasDetail) AliasResponse {
	return AliasResponse{
		MoveID:            d.MoveID,
		MoveCode:          d.MoveCode,
		MoveCategory:      d.MoveCategory,
		CharacterID:       d.CharacterID,
		AliasText:         d.AliasText,
		AliasTextEn:       d.AliasTextEn,
		OfficialAliasText: d.OfficialAliasText,
	}
}

// RecipeCacheRebuildResponse は POST /api/presets/:id/recipe-cache/rebuild の応答。
//
// ★新しい見せ方を作らない。どのプリセットを作り直したかだけを返す
// 件数を返さないのは、notation 側が対象件数を返す形になっていないためである
// (返すようにするには service/notation の契約変更が要り、本サブの射程外＝契約 F-1)。
type RecipeCacheRebuildResponse struct {
	PresetID int64 `json:"presetId"`
}

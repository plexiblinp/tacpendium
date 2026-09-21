package move

import (
	moverepo "github.com/plexiblinp/tacpendium/internal/repository/move"
	"github.com/plexiblinp/tacpendium/internal/service/movewarning"
)

// MoveResponse は GET /api/moves のレスポンスアイテム。
//
// フロントエンドの技セレクタが必要とする最小フィールドのみ。
// 表示名(NameJa)は official_ja_move プリセットの alias_text、未登録なら nil。
type MoveResponse struct {
	ID             int64  `json:"id"`
	CharacterID    int64  `json:"characterId"`
	Code           string `json:"code"`
	Category       string `json:"category"`
	OriginalMoveID *int64 `json:"originalMoveId,omitempty"`
	Startup        *int   `json:"startup,omitempty"`  // 発生フレーム（NULL 可、CHANGE-022/025）
	Active         *int   `json:"active,omitempty"`   // 持続フレーム数（NULL 可）
	Total          *int   `json:"total,omitempty"`    // 全体硬直（NULL 可、取込時算出）
	OnHit          *int   `json:"onHit,omitempty"`    // 硬直差ヒット（NULL 可、符号付き）
	OnBlock        *int   `json:"onBlock,omitempty"`  // 硬直差ガード（NULL 可、符号付き）
	Recovery       *int   `json:"recovery,omitempty"` // 硬直フレーム（手入力、NULL 可、M14-01）
	IsAerial       bool   `json:"isAerial"`           // 空中判定（NOT NULL DEFAULT false）
	SetupOnly      bool   `json:"setupOnly"`          // セットプレイ専用フラグ（NOT NULL DEFAULT false）
	// IsDerived は派生技フラグ（M30-04 で追加。NOT NULL DEFAULT false）。
	//
	// ★omitempty を付けない —— false 行でキーが消えると、受け側が「未定義」と
	//   「false」を区別できなくなる（isAerial / setupOnly と同じ扱い）。
	// ★★「単独入力が不可能」ではない（DES-003 §3.3 errata③）。フロントは
	//   必殺技ファミリー行の並び順にのみ使い、入力面の可否判定には使わない（D-807）。
	IsDerived bool    `json:"isDerived"`
	NameJa    *string `json:"nameJa,omitempty"`

	// Warnings は取込プレビュー(§5.17)と同じ WarningCode を保存済みデータから再導出したもの
	// (M9-04、§4.1)。後方互換の追加で既存 consumer は無視可。空でも常に [] を返す
	// (recovery_word は再導出不可で total_null に吸収)。算出はハンドラの List で行う。
	Warnings []movewarning.WarningCode `json:"warnings"`
}

// ListResponse は GET /api/moves のレスポンス全体。
type ListResponse struct {
	Items []MoveResponse `json:"items"`
}

func toMoveResponse(m moverepo.MoveListItem) MoveResponse {
	return MoveResponse{
		ID:             m.ID,
		CharacterID:    m.CharacterID,
		Code:           m.Code,
		Category:       m.Category,
		OriginalMoveID: m.OriginalMoveID,
		Startup:        m.Startup,
		Active:         m.Active,
		Total:          m.Total,
		OnHit:          m.OnHit,
		OnBlock:        m.OnBlock,
		Recovery:       m.Recovery,
		IsAerial:       m.IsAerial,
		SetupOnly:      m.SetupOnly,
		IsDerived:      m.IsDerived,
		NameJa:         m.NameJa,
	}
}

// MoveDetailResponse は GET /api/moves/:id・PATCH・rush 生成のレスポンス(M9-03、編集グリッド用)。
//
// GET /api/moves(MoveResponse)が返さないフル項目(damage / raw_data)を含む。
// MoveResponse 契約とは別物(§2.3、契約不変)。
// ★逆に isDerived は本 DTO には出さない —— M30-04 が足したのはリスト側だけである
//
//	(必殺技ファミリー行の並び順に使う。編集グリッドは本列を読まない)。
//
// M14-01 で観測不能6列(combo_scaling / drive_gauge_increase / drive_gauge_decrease_guard /
// drive_gauge_decrease_punish / super_art_gauge_increase / properties)を削除し、
// 観測可能な手入力硬直 recovery を追加した。
type MoveDetailResponse struct {
	ID             int64   `json:"id"`
	CharacterID    int64   `json:"characterId"`
	Code           string  `json:"code"`
	Category       string  `json:"category"`
	OriginalMoveID *int64  `json:"originalMoveId,omitempty"`
	Startup        *int    `json:"startup,omitempty"`
	Active         *int    `json:"active,omitempty"`
	Total          *int    `json:"total,omitempty"`
	OnHit          *int    `json:"onHit,omitempty"`
	OnBlock        *int    `json:"onBlock,omitempty"`
	Damage         *int    `json:"damage,omitempty"`
	Recovery       *int    `json:"recovery,omitempty"`
	IsAerial       bool    `json:"isAerial"`
	SetupOnly      bool    `json:"setupOnly"`
	RawData        *string `json:"rawData,omitempty"`
	NameJa         *string `json:"nameJa,omitempty"` // official_ja_move エイリアス(表示のみ、CHANGE-032)
}

func toMoveDetailResponse(d *moverepo.MoveDetail) MoveDetailResponse {
	return MoveDetailResponse{
		ID:             d.ID,
		CharacterID:    d.CharacterID,
		Code:           d.Code,
		Category:       d.Category,
		OriginalMoveID: d.OriginalMoveID,
		Startup:        d.Startup,
		Active:         d.Active,
		Total:          d.Total,
		OnHit:          d.OnHit,
		OnBlock:        d.OnBlock,
		Damage:         d.Damage,
		Recovery:       d.Recovery,
		IsAerial:       d.IsAerial,
		SetupOnly:      d.SetupOnly,
		RawData:        d.RawData,
		NameJa:         d.NameJa,
	}
}

// UpdateMoveRequest は PATCH /api/moves/:id の入力(M9-03、§4.1)。
//
// 各フィールドは nil なら「更新しない」(PATCH /api/combos/:id と同方式)。category / code /
// original_move_id は編集対象外(rush 生成でのみ設定)。version は moves に存在しないため持たない。
type UpdateMoveRequest struct {
	Total    *int    `json:"total,omitempty"`
	Startup  *int    `json:"startup,omitempty"`
	Active   *int    `json:"active,omitempty"`
	OnHit    *int    `json:"onHit,omitempty"`
	OnBlock  *int    `json:"onBlock,omitempty"`
	Damage   *int    `json:"damage,omitempty"`
	Recovery *int    `json:"recovery,omitempty"` // 硬直フレーム（手入力、NULL 可、M14-01）
	IsAerial *bool   `json:"isAerial,omitempty"`
	RawData  *string `json:"rawData,omitempty"`
}

func toUpdateMoveFields(r UpdateMoveRequest) moverepo.UpdateMoveFields {
	return moverepo.UpdateMoveFields{
		Total:    r.Total,
		Startup:  r.Startup,
		Active:   r.Active,
		OnHit:    r.OnHit,
		OnBlock:  r.OnBlock,
		Damage:   r.Damage,
		Recovery: r.Recovery,
		IsAerial: r.IsAerial,
		RawData:  r.RawData,
	}
}

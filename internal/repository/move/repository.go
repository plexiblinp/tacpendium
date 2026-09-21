package move

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/plexiblinp/tacpendium/internal/model"
)

// ErrNotFound は対象の move が存在しない場合に返す(M9-03)。
var ErrNotFound = errors.New("move not found")

// ErrConflict はラッシュ版生成時に同一 original_move_id の rush_variant が既存の場合に返す(M9-03)。
var ErrConflict = errors.New("rush variant already exists")

// MoveListItem は ListByCharacter が返す技の表示用情報。
//
// 注: MoveListItem は GET /api/moves の意図的投影(共有 15 列 + 結合由来の NameJa)であり、
// model.Move(moves 全列の正準フル行型)とは別構造体。両者の共有フィールド集合の一致は
// divergence_test.go(§4.8 乖離検出ガード)で検証している。moves 列を追加する際は
// model.Move と本構造体の両方を同期すること(M8-A4 / M9-overview §3.9)。
//
// ★★【2026-09-11 追記・M30-04 2 巡目レビュー 中-4】**guard の検証は片方向である。**
// divergence_test.go は MoveListItem のフィールドだけを走査し、それが model.Move に
// 同名・同型で在ることを見る。⇒ **model.Move(および getByIDSQL)へ足して本構造体を
// 忘れる向きは、コンパイルも guard も通る。**
// ★実例が現に残っている —— model.Move.LastChangedGameVersion は getByIDSQL が
// SELECT しておらず、MoveDetail では常に nil である(followup へ回付済み)。
// ★片方向であること自体は、本構造体が「意図的投影」である以上、設計として正しい。
// 直すなら「意図的に載せない列」の台帳が要る(followup
// `move-divergence-guard-is-one-directional`)。**⇒ 「両方向に強制される」と読まないこと。**
//
// 表示用に preset_aliases から取得した NameJa を含む。
// M1-06 のフロントエンド技セレクタが必要とする最小フィールドのみ持つ。
type MoveListItem struct {
	ID             int64
	CharacterID    int64
	Code           string
	Category       string
	OriginalMoveID *int64
	Startup        *int // 発生フレーム（NULL 可、CHANGE-022/025）
	Active         *int // 持続フレーム数（NULL 可）
	Total          *int // 全体硬直（NULL 可、取込時算出）
	OnHit          *int // 硬直差ヒット（NULL 可、符号付き）
	OnBlock        *int // 硬直差ガード（NULL 可、符号付き）
	Recovery       *int // 硬直フレーム（手入力、NULL 可、M14-01）
	IsAerial       bool // 空中判定（NOT NULL DEFAULT false）
	SetupOnly      bool // セットプレイ専用フラグ（NOT NULL DEFAULT false）
	// IsDerived は派生技フラグ（NOT NULL DEFAULT false、M30-04 で追加）。
	// ★「単独入力が不可能」ではない（DES-003 §3.3 errata③）。消費側は並び順にのみ使う。
	IsDerived bool
	NameJa    *string // official_ja_move プリセットからの表示名、未登録なら nil
}

// MoveDetail は GetByID が返す編集グリッド用のフル行(M9-03、CHANGE-032)。
//
// model.Move(moves 全列)を埋め込み、表示用の NameJa(official_ja_move エイリアス、結合由来)を
// 追加する。NameJa は moves 列ではないため model.Move には持たせない(DES-004 §1.2 の設計に従う)。
type MoveDetail struct {
	model.Move
	NameJa *string // official_ja_move プリセットの alias_text、未登録なら nil
}

// UpdateMoveFields は UpdateFields の部分更新入力(M9-03、FR703)。
//
// 各フィールドは nil なら「更新しない」を意味する(PATCH /api/combos/:id と同方式)。
// category / code / original_move_id は本編集 API の対象外(rush 生成でのみ設定)。
type UpdateMoveFields struct {
	Total    *int
	Startup  *int
	Active   *int
	OnHit    *int
	OnBlock  *int
	Damage   *int
	Recovery *int // 硬直フレーム（手入力、NULL 可、M14-01）
	IsAerial *bool
	RawData  *string // JSON(notes 付記)
}

// Repository は技マスタへのアクセスを提供する。
//
// 読み取り(ListByCharacter)は GET /api/moves で従来どおり使用する(契約不変)。
// 編集・派生生成(GetByID / UpdateFields / InsertRushVariant)は FR703 技編集で使用する。
type Repository interface {
	// ListByCharacter は指定キャラクターの全技を ID 昇順で返す。
	// 各技に official_ja_move プリセットの alias_text を NameJa として付与する(DES-004 §1.2)。
	ListByCharacter(ctx context.Context, characterID int64) ([]MoveListItem, error)

	// GetByID は指定 id の move 1 行をフル取得する(M9-03、編集グリッド用 GET /api/moves/:id)。
	// model.Move 全列 + 表示用 NameJa(official_ja_move エイリアス)を返す(CHANGE-032)。
	// 存在しない場合は ErrNotFound を返す。
	GetByID(ctx context.Context, id int64) (*MoveDetail, error)

	// UpdateFields は指定 id の move を部分更新する(M9-03、PATCH /api/moves/:id)。
	// nil フィールドは更新しない。対象が存在しない場合は ErrNotFound を返す。
	UpdateFields(ctx context.Context, id int64, f UpdateMoveFields) error

	// InsertRushVariant は src からラッシュ版 move を派生生成する(M9-03、POST /api/moves/:id/rush-variant)。
	// code=rush_<src.Code>・category=rush_variant・original_move_id=src.ID、フレーム/補正値は src からコピー。
	// 同一 original_move_id の rush_variant が既存の場合は ErrConflict を返す。生成した move の id を返す。
	InsertRushVariant(ctx context.Context, src *model.Move) (int64, error)
}

type repository struct {
	db *sql.DB
}

// New は Repository を構築する。
func New(db *sql.DB) Repository {
	return &repository{db: db}
}

func (r *repository) ListByCharacter(ctx context.Context, characterID int64) ([]MoveListItem, error) {
	rows, err := r.db.QueryContext(ctx, listByCharacterSQL, characterID)
	if err != nil {
		return nil, fmt.Errorf("list moves by character: %w", err)
	}
	defer rows.Close()

	items := make([]MoveListItem, 0)
	for rows.Next() {
		var (
			item     MoveListItem
			origID   sql.NullInt64
			startup  sql.NullInt64
			active   sql.NullInt64
			total    sql.NullInt64
			onHit    sql.NullInt64
			onBlock  sql.NullInt64
			recovery sql.NullInt64
			nameJa   sql.NullString
		)
		if err := rows.Scan(
			&item.ID,
			&item.CharacterID,
			&item.Code,
			&item.Category,
			&origID,
			&startup,
			&active,
			&total,
			&onHit,
			&onBlock,
			&recovery,
			&item.IsAerial,
			&item.SetupOnly,
			&item.IsDerived,
			&nameJa,
		); err != nil {
			return nil, fmt.Errorf("scan move: %w", err)
		}
		if origID.Valid {
			v := origID.Int64
			item.OriginalMoveID = &v
		}
		item.Startup = nullInt64ToIntPtr(startup)
		item.Active = nullInt64ToIntPtr(active)
		item.Total = nullInt64ToIntPtr(total)
		item.OnHit = nullInt64ToIntPtr(onHit)
		item.OnBlock = nullInt64ToIntPtr(onBlock)
		item.Recovery = nullInt64ToIntPtr(recovery)
		if nameJa.Valid {
			v := nameJa.String
			item.NameJa = &v
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows: %w", err)
	}
	return items, nil
}

// nullInt64ToIntPtr は sql.NullInt64 を *int へ変換する。NULL なら nil を返す。
func nullInt64ToIntPtr(n sql.NullInt64) *int {
	if !n.Valid {
		return nil
	}
	v := int(n.Int64)
	return &v
}

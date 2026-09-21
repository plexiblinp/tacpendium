// Package punish は確定反撃サーチ(M18-02)のデータアクセスを提供する。
//
// 走査用の read(相手技/自技の投影・移動 total・pruning・始動技 verdict・採用コンボ)と、
// 検証状態の書き込み(combo_punish_starters / combo_punishes / combo_punish_prunings の CRUD)を
// 担う。走査規則(フレーム判定・レーン分け)はサービス層(service/punishfinder)に一元化し、
// 本リポジトリは SQL 取得と最小の投影に徹する(move リポジトリと同型)。
package punish

import (
	"context"
	"database/sql"
)

// ScanMove は走査で使う moves の投影(相手技・自技共通)。
//
// move リポジトリの MoveListItem は damage / is_projectile を SELECT していないため
// 走査には流用できず、本専用投影を持つ。
// ★★【2026-09-10 更新・M30-04】旧記述の「model.Move は変更しない=divergence_test の同期負担回避」は、
// 本投影が扱う damage / is_projectile については引き続き有効である。ただし model.Move
// そのものが不変という意味ではない —— M30-04 が IsDerived を足した(並び順のためのリスト DTO 露出)。
type ScanMove struct {
	ID           int64
	CharacterID  int64
	Code         string
	Category     string
	Startup      *int
	Damage       *int
	OnBlock      *int
	Recovery     *int
	Total        *int
	IsProjectile bool
	IsAerial     bool
	// StartupBasis は Startup の由来(model.MoveStartupBasis*)。DB では NOT NULL・既定 unknown。
	StartupBasis string
	// IsDerived は派生技フラグ。DB では NOT NULL・既定 0。
	//
	// ★★単体で「単独入力が不可能」を意味しない(DES-003 §3.3 errata③)。本投影での用途は
	//   category / startup_basis と組にして「startup が初段の値とは限らない行」を見分けること
	//   だけであり、入力可能性の代理には使わない。
	IsDerived bool
	// FirstHitStartup はその技の初段が当たるまでのフレーム(M37-04・列は 000114)。
	//
	// ★NULL の意味は「不明」で統一する。⇒ 対象行(実測 106 行)で NULL なら、判定する
	//   材料が無いので候補にしない(D-857)。対象外の行は Startup をそのまま使う。
	//   (★M39-01 で 110 -> 106。D-187 の是正でフレームを持たない空中限定 4 行が unknown へ移った)
	FirstHitStartup *int
	NameJa          *string
}

// MovementTotals は自キャラの移動 system move の全体フレーム(NULL 可)。
// 判定に使うのは「キャラのジャンプ全体」= jump_forward.total であり、空中技自身の total ではない。
type MovementTotals struct {
	DashForward *int // NULL(未 backfill/未 seed キャラ)ならダッシュ経由レーンをスキップ
	JumpForward *int // NULL ならジャンプ経由レーンをスキップ
}

// StarterVerdict は combo_punish_starters の 1 行(始動技レベルの検証結果)。
type StarterVerdict struct {
	OpponentMoveID int64
	StarterMoveID  int64
	Verdict        string
	Note           *string
}

// ComboPunishKey は採用済み確定反撃(combo_punishes)の複合キー(孫コンボの adopted 判定用)。
type ComboPunishKey struct {
	ComboID        int64
	OpponentMoveID int64
}

// PunishEntry は採用済み確定反撃 1 件の表示用投影(M18-03a)。
//
// ComboPunishKey が「採用済みか」の真偽判定に使うキー投影であるのに対し、本型は画面に出す
// 表示項目まで含む。マイリスト(service/punishlist)と、探す画面の「自動判定できない相手技」
// 配下の既登録表示(service/punishfinder §4.5)の双方が本投影を共用する。
//
// 技名は listMovesForScanSQL と同じ official_ja_move プリセット経由で解決する
// (名前解決を二度実装しない)。
type PunishEntry struct {
	ComboID        int64
	OpponentMoveID int64
	Note           *string // combo_punishes.note(採用理由)

	OpponentMoveCode        string
	OpponentMoveNameJa      *string
	OpponentCharacterID     int64
	OpponentCharacterNameJa string

	Damage            *int
	StepCount         int
	HitType           *string // combos.hit_type(NULL 可)。タブ振り分けはサービス層で行う
	StarterMoveID     *int64
	StarterMoveCode   *string
	StarterMoveNameJa *string
	// RecipeCache は combos.recipe_cache の生 JSON({presetId: displayString})。
	// 既定レシピの取り出しは model.ExtractDefaultRecipe でサービス層が行う
	// (リポジトリは投影に徹し、表示文字列の解釈をしない)。
	RecipeCache *string
	// MaterializedFromComboID は combos.materialized_from_combo_id(出自)。生成元バッジ用(M18-03b)。
	// 非 NULL なら materialize 生成物(基底コンボの id)。
	MaterializedFromComboID *int64
}

// PunishEntryFilter は ListPunishEntries の絞り込み条件。
//
// hit_type では絞らない(タブ内/タブ外の振り分けはサービス層が 1 回の取得結果から行うため。
// SQL を 2 回引くと「どちらのタブにも出ない採用」を数え漏らす)。
type PunishEntryFilter struct {
	SelfCharacterID     int64
	OpponentCharacterID *int64 // nil = 全相手キャラ
	ExcludeCurated      bool   // true = curation 済みの組を除外(マイリストの表示制御)
}

// CurationEntry は「使わない反撃」(combo_punish_curations)1 件の表示用投影。
// 粒度はコンボ × 相手技(pruning と非対称)。
type CurationEntry struct {
	ComboID        int64
	OpponentMoveID int64
	Note           *string

	OpponentMoveCode        string
	OpponentMoveNameJa      *string
	OpponentCharacterID     int64
	OpponentCharacterNameJa string

	StarterMoveCode   *string
	StarterMoveNameJa *string
}

// PruningEntry は「確定反撃のない技」(combo_punish_prunings)1 件の表示用投影。
// 粒度は自キャラ × 相手技でコンボ非依存(curation と非対称)。
type PruningEntry struct {
	OpponentMoveID int64
	Note           *string

	OpponentMoveCode        string
	OpponentMoveNameJa      *string
	OpponentCharacterID     int64
	OpponentCharacterNameJa string
}

// Repository は確定反撃サーチのデータアクセスを提供する。
type Repository interface {
	// ListMovesForScan は指定キャラの moves を走査用投影で ID 昇順に返す(相手技/自技共通)。
	ListMovesForScan(ctx context.Context, characterID int64) ([]ScanMove, error)
	// GetMovementTotals は自キャラの dash_forward / jump_forward の total を返す(NULL 可)。
	GetMovementTotals(ctx context.Context, characterID int64) (MovementTotals, error)
	// ListPrunedMoveIDs は自キャラで pruning 済みの相手技 id 集合を返す(§4.3.2-g)。
	ListPrunedMoveIDs(ctx context.Context, selfCharacterID int64) (map[int64]bool, error)
	// ListStarterVerdicts は自キャラの始動技検証結果を返す。
	ListStarterVerdicts(ctx context.Context, selfCharacterID int64) ([]StarterVerdict, error)
	// ListAdoptedComboPunishes は自キャラの採用済み確定反撃(combo, 相手技)を返す。
	// 論理削除済みコンボに紐づく組は含めない(M23-03 §4.3。ListPunishEntries と同じ扱い)。
	ListAdoptedComboPunishes(ctx context.Context, selfCharacterID int64) ([]ComboPunishKey, error)
	// ListMaterializedBaseComboIDs は有効な materialize 生成物を持つ基底コンボ id 集合を返す。
	// 相手技と is_draft は判定に含めず、論理削除済みは基底・生成物の両側を除外する
	// (M23-03 §4.4。以前は生成物だけを除外していた)。
	ListMaterializedBaseComboIDs(ctx context.Context, selfCharacterID int64) (map[int64]bool, error)
	// ListPunishEntries は自キャラの採用済み確定反撃を表示用投影で返す(M18-03a)。
	// 論理削除済みコンボ(combos.deleted_at IS NOT NULL)は含めない。
	ListPunishEntries(ctx context.Context, f PunishEntryFilter) ([]PunishEntry, error)
	// ListCurations は自キャラの curation(使わない反撃)を表示用投影で返す。
	ListCurations(ctx context.Context, selfCharacterID int64, opponentCharacterID *int64) ([]CurationEntry, error)
	// ListPrunings は自キャラの pruning(確定反撃のない技)を表示用投影で返す。
	ListPrunings(ctx context.Context, selfCharacterID int64, opponentCharacterID *int64) ([]PruningEntry, error)

	// UpsertStarter は始動技の検証結果を登録/更新する(UNIQUE 衝突時は verdict/note を更新)。
	UpsertStarter(ctx context.Context, selfCharacterID, opponentMoveID, starterMoveID int64, verdict string, note *string) error
	// DeleteStarter は始動技の検証結果を解除する。
	DeleteStarter(ctx context.Context, selfCharacterID, opponentMoveID, starterMoveID int64) error
	// AddPunish はコンボ採用(keep)を登録する(UNIQUE 衝突時は note を更新)。
	AddPunish(ctx context.Context, comboID, opponentMoveID int64, note *string) error
	// RemovePunish はコンボ採用を解除する。
	//
	// 同一キー(combo_id, opponent_move_id)の curation も同一トランザクションで削除する
	// (curation は「combo_punishes にある組を隠す」指定であり、採用が消えた組に curation
	// だけが残る状態は意味を持たないため＝指示書 §4.1)。
	RemovePunish(ctx context.Context, comboID, opponentMoveID int64) error
	// AddPruning は相手技の pruning を登録する(UNIQUE 衝突時は note を更新)。
	AddPruning(ctx context.Context, selfCharacterID, opponentMoveID int64, note *string) error
	// RemovePruning は相手技の pruning を解除する。
	RemovePruning(ctx context.Context, selfCharacterID, opponentMoveID int64) error
	// AddCuration は「使わない反撃」を登録する(UNIQUE 衝突時は note を更新)。
	AddCuration(ctx context.Context, comboID, opponentMoveID int64, note *string) error
	// RemoveCuration は「使わない反撃」を解除する。
	RemoveCuration(ctx context.Context, comboID, opponentMoveID int64) error
}

type repository struct {
	db *sql.DB
}

// New は Repository を構築する。
func New(db *sql.DB) Repository {
	return &repository{db: db}
}

// nullInt64ToIntPtr は sql.NullInt64 を *int へ変換する。NULL なら nil を返す(move リポジトリと同型)。
func nullInt64ToIntPtr(n sql.NullInt64) *int {
	if !n.Valid {
		return nil
	}
	v := int(n.Int64)
	return &v
}

// nullInt64ToPtr は sql.NullInt64 を *int64 へ変換する(id 列用。値の意味を int へ潰さない)。
func nullInt64ToPtr(n sql.NullInt64) *int64 {
	if !n.Valid {
		return nil
	}
	v := n.Int64
	return &v
}

func nullStringToPtr(s sql.NullString) *string {
	if !s.Valid {
		return nil
	}
	v := s.String
	return &v
}

// noteArg は *string を INSERT 用の引数へ変換する(nil→NULL)。
func noteArg(note *string) any {
	if note == nil {
		return nil
	}
	return *note
}

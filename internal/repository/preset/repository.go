package preset

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/plexiblinp/tacpendium/internal/model"
)

// ErrNotFound はプリセットが見つからない場合のセンチネル。
var ErrNotFound = errors.New("preset: not found")

// Repository はプリセット・エイリアスデータへのアクセスを提供する。
type Repository interface {
	// ListAllPresets は全プリセットを ID 昇順で返す。
	ListAllPresets(ctx context.Context) ([]*model.Preset, error)

	// FindPresetByID は指定 ID のプリセットを返す。見つからない場合は ErrNotFound。
	FindPresetByID(ctx context.Context, id int64) (*model.Preset, error)

	// FindPresetByCode は code でプリセットを検索する（CHANGE-007: code UNIQUE）。
	// 見つからない場合は ErrNotFound。
	FindPresetByCode(ctx context.Context, code string) (*model.Preset, error)

	// FindAlias は (preset_id, move_id) ペアのエイリアスを返す。
	// 未定義の場合は (nil, nil) を返���（エイリアス不在は正常）。
	FindAlias(ctx context.Context, presetID, moveID int64) (*model.PresetAlias, error)

	// ListAliasesByPreset は指定プリセットの全エイリアスを返す。
	ListAliasesByPreset(ctx context.Context, presetID int64) ([]*model.PresetAlias, error)

	// ListAliasEntriesByCharacter は当該キャラの逆引き辞書(表記 → move.code)を
	// 全プリセット横断で返す(M20-07 他から引っ越しの ② エイリアス照合の材料)。
	//
	// ★M17-04 の FindMoveCodesByAlias(1 表記ずつ SQL で完全一致)を置き換えたものである。
	// 逆引きの前段に NFKC 正規化を置くことになったが(D-307)、SQLite は NFKC を持たないため
	// 辞書側へ正規化を掛けられない。⇒ 照合そのものを Go 側(internal/aliasindex)へ移した。
	// 本メソッドは材料を返すだけで、正規化も照合も行わない。
	//
	// ★1:N は依然として起こり得る。M20-03 が UNIQUE(preset_id, character_id, alias_text) を
	// 張ったため「同一プリセット・同一キャラで 2 つの異なる技が同表記」は DB が禁じるように
	// なったが、逆引きは ★全プリセット横断である。プリセットを跨いだ 1:N は制約の対象外で
	// あり成立する(例 numeric と srk が同じ必殺技に同じ '236LP' を持つ = 実測 714 件)。
	// ⇒ 「一意制約があるから 1 件になる」と短絡しないこと。決定論を支えているのは
	// 「返り値が 1 件のときだけ確定する」という規則そのものである(M17-04 §3.3-4)。
	//
	// キャラが実在しない・未投入でも空スライスを返すだけで壊れない。
	ListAliasEntriesByCharacter(ctx context.Context, charCode string) ([]model.AliasEntry, error)

	// ------------------------------------------------------------------
	// M20-04: 書き込み経路。★preset_aliases へ書く本番コードは本サブが最初である
	// (DES-004 §5.7 の投入経路の規約が初めて適用される箇所)。
	// ------------------------------------------------------------------

	// CountPresets は presets の全行数を返す(VAL-P05 の上限検査用)。
	// tx が非 nil ならトランザクション上で数える(上限検査と INSERT を同じ
	// トランザクションに閉じ込め、同時作成で 9 件目が通るのを防ぐため)。
	CountPresets(ctx context.Context, tx *sql.Tx) (int, error)

	// FindPresetByCodeTx は FindPresetByCode をトランザクション上で実行する。
	// 作成時の各検査(件数・名前・code 採番)と同じ断面でベースを解決するために使う。
	FindPresetByCodeTx(ctx context.Context, tx *sql.Tx, code string) (*model.Preset, error)

	// CountPresetsByName は同一ユーザー内の同名プリセット数を返す(VAL-P03)。
	// excludeID に 0 以外を渡すと、その id を数から除く(更新時に自分自身を除外する)。
	CountPresetsByName(ctx context.Context, tx *sql.Tx, userID int64, name string, excludeID int64) (int, error)

	// ListCustomPresetCodes は組み込みでないプリセットの code を返す(code 採番用)。
	ListCustomPresetCodes(ctx context.Context, tx *sql.Tx) ([]string, error)

	// CreatePresetTx はカスタムプリセットを 1 行 INSERT し、採番された id を返す。
	// ★id は AUTOINCREMENT に任せる(欠番を詰めない)。
	CreatePresetTx(ctx context.Context, tx *sql.Tx, userID int64, code, name, basePresetCode string) (int64, error)

	// CopyAliasesTx は srcPresetID の全エイリアスを dstPresetID の行として複製し、
	// 複製した行数を返す。★character_id と alias_text_en も複製する(DES-004 §5.7-1)。
	CopyAliasesTx(ctx context.Context, tx *sql.Tx, srcPresetID, dstPresetID int64) (int64, error)

	// CountAliasesByPreset は指定プリセットのエイリアス行数を返す。
	CountAliasesByPreset(ctx context.Context, presetID int64) (int, error)

	// CountAliasesWithNullCharacter は character_id が NULL のエイリアス行数を返す。
	// ★コピー実装の健全性を主張する唯一の手段である(指示書 §5 (b))。
	CountAliasesWithNullCharacter(ctx context.Context, presetID int64) (int, error)

	// CountOrphanAliases は親プリセットが実在しない preset_aliases の行数を返す。
	// ★削除実装の健全性検査に使う。M23-10 以前は CASCADE の発火が接続次第で
	// あり(P-04)、明示削除が唯一の担保だった。現在は CASCADE も発火するが、
	// 明示削除を二重の保険として残しているため本検査は今も有効である。
	CountOrphanAliases(ctx context.Context) (int, error)

	// ListAliasDetails は編集画面向けに、指定プリセット・指定キャラのエイリアスを
	// 技の識別情報付きで返す(DES-005 §5.11)。
	ListAliasDetails(ctx context.Context, presetID, characterID int64) ([]model.PresetAliasDetail, error)

	// UpdateAliasTextTx は 1 件のエイリアス表記を更新し、更新行数を返す。
	// ★alias_text のみを更新する(character_id / alias_text_en は触らない)。
	UpdateAliasTextTx(ctx context.Context, tx *sql.Tx, presetID, moveID int64, aliasText string) (int64, error)

	// FindCrossingAliasEn は aliasText が同一プリセット・同一キャラの
	// 別の技の alias_text_en と衝突していないかを調べ、衝突していれば
	// その move_id を返す(見つからなければ 0)。
	//
	// ★この条件は UNIQUE では表現できない(列を跨ぐため。D-317)。
	// DB もサービス層も見なければ、静かに交差した行ができる。
	FindCrossingAliasEn(ctx context.Context, tx *sql.Tx, presetID, moveID int64, aliasText string) (int64, error)

	// UpdatePresetNameTx はプリセット名を更新する。
	UpdatePresetNameTx(ctx context.Context, tx *sql.Tx, id int64, name string) error

	// DeleteAliasesByPresetTx は指定プリセットの子行を明示的に削除し、削除行数を返す。
	// ★CASCADE に頼らない。M23-10 以前は CASCADE の発火が接続次第だった(P-04)。
	// M23-10 で全接続が FK=ON になり CASCADE も効くようになったが、本実装は
	// そのときも正しいままであり、二重の保険として残す。
	DeleteAliasesByPresetTx(ctx context.Context, tx *sql.Tx, presetID int64) (int64, error)

	// DeletePresetTx はプリセット行を削除する。子行の削除は呼出側の責務である。
	DeletePresetTx(ctx context.Context, tx *sql.Tx, id int64) error
}

type repository struct {
	db *sql.DB
}

// New は Repository を構築する。
func New(db *sql.DB) Repository {
	return &repository{db: db}
}

func (r *repository) ListAllPresets(ctx context.Context) ([]*model.Preset, error) {
	rows, err := r.db.QueryContext(ctx, listAllPresetsSQL)
	if err != nil {
		return nil, fmt.Errorf("list all presets: %w", err)
	}
	defer rows.Close()

	presets := make([]*model.Preset, 0)
	for rows.Next() {
		p, err := scanPreset(rows)
		if err != nil {
			return nil, err
		}
		presets = append(presets, p)
	}
	return presets, rows.Err()
}

func (r *repository) FindPresetByID(ctx context.Context, id int64) (*model.Preset, error) {
	return scanPreset(r.db.QueryRowContext(ctx, findPresetByIDSQL, id))
}

func (r *repository) FindPresetByCode(ctx context.Context, code string) (*model.Preset, error) {
	return scanPreset(r.db.QueryRowContext(ctx, findPresetByCodeSQL, code))
}

func (r *repository) FindAlias(ctx context.Context, presetID, moveID int64) (*model.PresetAlias, error) {
	a := &model.PresetAlias{}
	err := r.db.QueryRowContext(ctx, findAliasSQL, presetID, moveID).
		Scan(&a.ID, &a.PresetID, &a.MoveID, &a.AliasText)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("find alias: %w", err)
	}
	return a, nil
}

func (r *repository) ListAliasesByPreset(ctx context.Context, presetID int64) ([]*model.PresetAlias, error) {
	rows, err := r.db.QueryContext(ctx, listAliasesByPresetSQL, presetID)
	if err != nil {
		return nil, fmt.Errorf("list aliases by preset: %w", err)
	}
	defer rows.Close()

	aliases := make([]*model.PresetAlias, 0)
	for rows.Next() {
		a := &model.PresetAlias{}
		if err := rows.Scan(&a.ID, &a.PresetID, &a.MoveID, &a.AliasText); err != nil {
			return nil, fmt.Errorf("scan alias: %w", err)
		}
		aliases = append(aliases, a)
	}
	return aliases, rows.Err()
}

func (r *repository) ListAliasEntriesByCharacter(ctx context.Context, charCode string) ([]model.AliasEntry, error) {
	rows, err := r.db.QueryContext(ctx, listAliasEntriesByCharacterSQL, charCode)
	if err != nil {
		return nil, fmt.Errorf("list alias entries by character: %w", err)
	}
	defer rows.Close()

	entries := make([]model.AliasEntry, 0)
	for rows.Next() {
		var e model.AliasEntry
		if err := rows.Scan(&e.MoveCode, &e.AliasText, &e.AliasTextEn); err != nil {
			return nil, fmt.Errorf("scan alias entry: %w", err)
		}
		entries = append(entries, e)
	}
	return entries, rows.Err()
}

// ===========================================================================
// M20-04: 書き込み経路
// ===========================================================================

func (r *repository) CountPresets(ctx context.Context, tx *sql.Tx) (int, error) {
	var n int
	if err := queryRow(ctx, r.db, tx, countPresetsSQL).Scan(&n); err != nil {
		return 0, fmt.Errorf("count presets: %w", err)
	}
	return n, nil
}

func (r *repository) FindPresetByCodeTx(ctx context.Context, tx *sql.Tx, code string) (*model.Preset, error) {
	return scanPreset(queryRow(ctx, r.db, tx, findPresetByCodeSQL, code))
}

func (r *repository) CountPresetsByName(ctx context.Context, tx *sql.Tx, userID int64, name string, excludeID int64) (int, error) {
	var n int
	err := queryRow(ctx, r.db, tx, countPresetsByNameSQL, userID, name, excludeID).Scan(&n)
	if err != nil {
		return 0, fmt.Errorf("count presets by name: %w", err)
	}
	return n, nil
}

func (r *repository) ListCustomPresetCodes(ctx context.Context, tx *sql.Tx) ([]string, error) {
	rows, err := query(ctx, r.db, tx, listCustomPresetCodesSQL)
	if err != nil {
		return nil, fmt.Errorf("list custom preset codes: %w", err)
	}
	defer rows.Close()

	codes := make([]string, 0)
	for rows.Next() {
		var code string
		if err := rows.Scan(&code); err != nil {
			return nil, fmt.Errorf("scan preset code: %w", err)
		}
		codes = append(codes, code)
	}
	return codes, rows.Err()
}

func (r *repository) CreatePresetTx(ctx context.Context, tx *sql.Tx, userID int64, code, name, basePresetCode string) (int64, error) {
	res, err := tx.ExecContext(ctx, createPresetSQL, userID, code, name, basePresetCode)
	if err != nil {
		return 0, fmt.Errorf("create preset: %w", err)
	}
	id, err := res.LastInsertId()
	if err != nil {
		return 0, fmt.Errorf("create preset last insert id: %w", err)
	}
	return id, nil
}

func (r *repository) CopyAliasesTx(ctx context.Context, tx *sql.Tx, srcPresetID, dstPresetID int64) (int64, error) {
	res, err := tx.ExecContext(ctx, copyAliasesSQL, dstPresetID, srcPresetID)
	if err != nil {
		return 0, fmt.Errorf("copy aliases: %w", err)
	}
	n, err := res.RowsAffected()
	if err != nil {
		return 0, fmt.Errorf("copy aliases rows affected: %w", err)
	}
	return n, nil
}

func (r *repository) CountAliasesByPreset(ctx context.Context, presetID int64) (int, error) {
	var n int
	if err := r.db.QueryRowContext(ctx, countAliasesByPresetSQL, presetID).Scan(&n); err != nil {
		return 0, fmt.Errorf("count aliases by preset: %w", err)
	}
	return n, nil
}

func (r *repository) CountAliasesWithNullCharacter(ctx context.Context, presetID int64) (int, error) {
	var n int
	if err := r.db.QueryRowContext(ctx, countAliasesWithNullCharacterSQL, presetID).Scan(&n); err != nil {
		return 0, fmt.Errorf("count aliases with null character: %w", err)
	}
	return n, nil
}

func (r *repository) CountOrphanAliases(ctx context.Context) (int, error) {
	var n int
	if err := r.db.QueryRowContext(ctx, countOrphanAliasesSQL).Scan(&n); err != nil {
		return 0, fmt.Errorf("count orphan aliases: %w", err)
	}
	return n, nil
}

func (r *repository) ListAliasDetails(ctx context.Context, presetID, characterID int64) ([]model.PresetAliasDetail, error) {
	rows, err := r.db.QueryContext(ctx, listAliasDetailsSQL, model.PresetCodeOfficialJaMove, presetID, characterID)
	if err != nil {
		return nil, fmt.Errorf("list alias details: %w", err)
	}
	defer rows.Close()

	details := make([]model.PresetAliasDetail, 0)
	for rows.Next() {
		var d model.PresetAliasDetail
		var charID sql.NullInt64
		var aliasEn, officialAlias sql.NullString
		if err := rows.Scan(&d.MoveID, &d.MoveCode, &d.MoveCategory, &charID,
			&d.AliasText, &aliasEn, &officialAlias); err != nil {
			return nil, fmt.Errorf("scan alias detail: %w", err)
		}
		// character_id は nullable(000001_init_schema:106。旧 000074 の as-built)。実データでは NULL 0 件だが、
		// 型としては NULL を取りうるため NullInt64 で受ける。
		d.CharacterID = charID.Int64
		if aliasEn.Valid {
			v := aliasEn.String
			d.AliasTextEn = &v
		}
		if officialAlias.Valid {
			v := officialAlias.String
			d.OfficialAliasText = &v
		}
		details = append(details, d)
	}
	return details, rows.Err()
}

func (r *repository) UpdateAliasTextTx(ctx context.Context, tx *sql.Tx, presetID, moveID int64, aliasText string) (int64, error) {
	res, err := tx.ExecContext(ctx, updateAliasTextSQL, aliasText, presetID, moveID)
	if err != nil {
		return 0, fmt.Errorf("update alias text: %w", err)
	}
	n, err := res.RowsAffected()
	if err != nil {
		return 0, fmt.Errorf("update alias text rows affected: %w", err)
	}
	return n, nil
}

func (r *repository) FindCrossingAliasEn(ctx context.Context, tx *sql.Tx, presetID, moveID int64, aliasText string) (int64, error) {
	var otherMoveID int64
	err := queryRow(ctx, r.db, tx, findCrossingAliasEnSQL, presetID, moveID, moveID, aliasText).
		Scan(&otherMoveID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return 0, nil
		}
		return 0, fmt.Errorf("find crossing alias_text_en: %w", err)
	}
	return otherMoveID, nil
}

func (r *repository) UpdatePresetNameTx(ctx context.Context, tx *sql.Tx, id int64, name string) error {
	if _, err := tx.ExecContext(ctx, updatePresetNameSQL, name, id); err != nil {
		return fmt.Errorf("update preset name: %w", err)
	}
	return nil
}

func (r *repository) DeleteAliasesByPresetTx(ctx context.Context, tx *sql.Tx, presetID int64) (int64, error) {
	res, err := tx.ExecContext(ctx, deleteAliasesByPresetSQL, presetID)
	if err != nil {
		return 0, fmt.Errorf("delete aliases by preset: %w", err)
	}
	n, err := res.RowsAffected()
	if err != nil {
		return 0, fmt.Errorf("delete aliases rows affected: %w", err)
	}
	return n, nil
}

func (r *repository) DeletePresetTx(ctx context.Context, tx *sql.Tx, id int64) error {
	if _, err := tx.ExecContext(ctx, deletePresetSQL, id); err != nil {
		return fmt.Errorf("delete preset: %w", err)
	}
	return nil
}

// queryRow / query は tx が非 nil ならトランザクション上で、nil なら通常接続で実行する。
// 検査系メソッドをトランザクションの内外どちらからも呼べるようにするためのヘルパ。
func queryRow(ctx context.Context, db *sql.DB, tx *sql.Tx, q string, args ...any) *sql.Row {
	if tx != nil {
		return tx.QueryRowContext(ctx, q, args...)
	}
	return db.QueryRowContext(ctx, q, args...)
}

func query(ctx context.Context, db *sql.DB, tx *sql.Tx, q string, args ...any) (*sql.Rows, error) {
	if tx != nil {
		return tx.QueryContext(ctx, q, args...)
	}
	return db.QueryContext(ctx, q, args...)
}

type scannerRow interface {
	Scan(dest ...any) error
}

func scanPreset(row scannerRow) (*model.Preset, error) {
	p := &model.Preset{}
	err := row.Scan(&p.ID, &p.UserID, &p.Code, &p.Name, &p.BasePresetCode, &p.IsBuiltin)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("scan preset: %w", err)
	}
	return p, nil
}

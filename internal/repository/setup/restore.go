package setup

// セットプレイのゴミ箱まわり(復元・完全削除・削除済み一覧)のリポジトリ実装。
// M23-02 で新設。コンボ側(internal/repository/combo)の同名メソッドに形を揃えてある。

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/plexiblinp/tacpendium/internal/model"
)

// selectSetupByIDAllowDeletedSQL は論理削除済みの行も返す。
// ★deleted_at 述語を持たないのは意図である(完全削除の前チェック専用)。
// 関数名 FindByIDAllowDeleted に意図を出してあるのはコンボ側と同じ流儀。
const selectSetupByIDAllowDeletedSQL = `
SELECT id, character_id, name, description, step_count, recipe_cache,
       version, created_at, updated_at, deleted_at
FROM setups
WHERE id = ?`

// FindByIDAllowDeleted は論理削除済みを含めてセットプレイを 1 件返す。
// 完全削除の前チェック(ゴミ箱に居るかどうかの判定)にのみ使う。
func (r *repository) FindByIDAllowDeleted(ctx context.Context, tx *sql.Tx, setupID int64) (*model.Setup, error) {
	return r.scanSetup(r.runner(tx).QueryRowContext(ctx, selectSetupByIDAllowDeletedSQL, setupID))
}

// Restore は論理削除を解除する(M23-02 §4.2)。
//
// ★version に触れない。コンボ側の Restore と揃えてある(M22-overview §4.2.1 (iii))。
// 論理削除中は編集経路が deleted_at IS NULL で締め出されており version が動く経路が
// 無いため、据え置きでも復元が楽観排他をすり抜けることはない。
//
// 既に生きている行(deleted_at IS NULL)に対しては RowsAffected()==0 となり
// ErrNotFound を返す。これもコンボ側と同じ挙動である。
func (r *repository) Restore(ctx context.Context, tx *sql.Tx, setupID int64) error {
	res, err := r.runner(tx).ExecContext(ctx,
		`UPDATE setups SET deleted_at = NULL, updated_at = datetime('now')
		  WHERE id = ? AND deleted_at IS NOT NULL`, setupID)
	if err != nil {
		return fmt.Errorf("restore setup: %w", err)
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("rows affected: %w", err)
	}
	if rows == 0 {
		return ErrNotFound
	}
	return nil
}

// FindLiveReferencingCombos は当該セットプレイを参照している「生きたコンボ」を返す
// (M23-02 §4.4-1 / §4.4-2)。完全削除の前チェックに使う。
//
// ★述語は 2 つだけである——cs.setup_id が対象であることと、結合先の
// combos.deleted_at が NULL であること。ゴミ箱に居るコンボからの参照は
// 拒否の理由にしない(D-486・開発者承認)。述語を足さないこと。
//
// ★combo_setups の件数だけを数えてはいけない。結合を挟まないとゴミ箱に居る
// コンボからの参照まで数えてしまい、利用者が完全削除できなくなる。
func (r *repository) FindLiveReferencingCombos(ctx context.Context, tx *sql.Tx, setupID int64) ([]model.ComboRef, error) {
	rows, err := r.runner(tx).QueryContext(ctx,
		`SELECT c.id, c.memo
		   FROM combo_setups cs
		   JOIN combos c ON c.id = cs.combo_id
		  WHERE cs.setup_id = ? AND c.deleted_at IS NULL
		  ORDER BY c.id`, setupID)
	if err != nil {
		return nil, fmt.Errorf("find live referencing combos: %w", err)
	}
	defer rows.Close()

	refs := make([]model.ComboRef, 0)
	for rows.Next() {
		var (
			id   int64
			memo sql.NullString
		)
		if err := rows.Scan(&id, &memo); err != nil {
			return nil, fmt.Errorf("scan combo ref: %w", err)
		}
		ref := model.ComboRef{ID: id}
		if memo.Valid {
			ref.Memo = &memo.String
		}
		refs = append(refs, ref)
	}
	return refs, rows.Err()
}

// FindReferencingCombosAllowDeletedTx は、指定セットプレイを参照しているコンボを
// 論理削除済みも含めて返す(M23-04 §4.7・VAL-R02 用)。
//
// ★述語が無いのは意図である。VAL-R02 の母集団は「復元されうるものも含む」必要が
// あり、ここを絞ると親が全部削除済みのときに母集団まで 0 件になって「すべて削除済み」
// の判定が永久に成立しなくなる(M23-03 §4.5 が FindComboIDsBySetupID を割った理由と
// 同じ構図)。★対になる生存側は FindLiveReferencingCombos。
//
// ★id だけを返す FindComboIDsBySetupIDAllowDeletedTx と併存させているのは、
// 用途が違うためである——あちらは件数・集合演算に使い、こちらは警告の details へ
// 「どれが問題か」を載せるために memo が要る(§4.3-3)。
func (r *repository) FindReferencingCombosAllowDeletedTx(ctx context.Context, tx *sql.Tx, setupID int64) ([]model.ComboRef, error) {
	rows, err := r.runner(tx).QueryContext(ctx,
		`SELECT c.id, c.memo
		   FROM combo_setups cs
		   JOIN combos c ON c.id = cs.combo_id
		  WHERE cs.setup_id = ?
		  ORDER BY c.id`, setupID)
	if err != nil {
		return nil, fmt.Errorf("find referencing combos (allow deleted): %w", err)
	}
	defer rows.Close()

	refs := make([]model.ComboRef, 0)
	for rows.Next() {
		var (
			id   int64
			memo sql.NullString
		)
		if err := rows.Scan(&id, &memo); err != nil {
			return nil, fmt.Errorf("scan combo ref: %w", err)
		}
		ref := model.ComboRef{ID: id}
		if memo.Valid {
			ref.Memo = &memo.String
		}
		refs = append(refs, ref)
	}
	return refs, rows.Err()
}

// FindDeletedSetupRefsByComboID は、指定コンボに紐付いているセットプレイのうち
// 論理削除済みのものを返す(M23-04 §4.7・VAL-R01 用)。
//
// ★M23-03 が FindComboIDsBySetupID を表示用と検証用に分けたのと同じ理由で、
// 表示用の ListSetupsByComboID(AND s.deleted_at IS NULL)とは別の関数にしてある。
// 表示は「いま見えているものだけ」、こちらは「見えなくなっているものだけ」を求めており、
// 求める集合が正反対である。述語を差し替えて 1 本にまとめないこと。
func (r *repository) FindDeletedSetupRefsByComboID(ctx context.Context, tx *sql.Tx, comboID int64) ([]model.SetupRef, error) {
	rows, err := r.runner(tx).QueryContext(ctx,
		`SELECT s.id, s.name
		   FROM combo_setups cs
		   JOIN setups s ON s.id = cs.setup_id
		  WHERE cs.combo_id = ? AND s.deleted_at IS NOT NULL
		  ORDER BY s.id`, comboID)
	if err != nil {
		return nil, fmt.Errorf("find deleted setup refs: %w", err)
	}
	defer rows.Close()

	refs := make([]model.SetupRef, 0)
	for rows.Next() {
		var (
			id   int64
			name sql.NullString
		)
		if err := rows.Scan(&id, &name); err != nil {
			return nil, fmt.Errorf("scan setup ref: %w", err)
		}
		ref := model.SetupRef{ID: id}
		if name.Valid {
			ref.Name = &name.String
		}
		refs = append(refs, ref)
	}
	return refs, rows.Err()
}

// HardDelete はセットプレイを物理削除する(M23-02 §4.3-2)。
//
// ★明示削除で書く。CASCADE に委ねない。コンボ側の HardDelete が既に同型。
//
// M23-02 当時は P-04 により PRAGMA foreign_keys がプール中の 1 接続にしか適用されて
// おらず、ON DELETE CASCADE の発火が保証されなかった。★M23-10 で全接続が FK=ON に
// なり CASCADE も発火するようになったが、明示削除は撤去せず二重の保険として残す。
//
// 順序は combo_setup_results → combo_setups → setup_steps → setups。
// 前 2 段は DeleteComboSetupsBySetupID が既にその順序を持つため再利用する。
func (r *repository) HardDelete(ctx context.Context, tx *sql.Tx, setupID int64) error {
	if err := r.DeleteComboSetupsBySetupID(ctx, tx, setupID); err != nil {
		return fmt.Errorf("hard delete links: %w", err)
	}
	exec := r.runner(tx)
	if _, err := exec.ExecContext(ctx,
		`DELETE FROM setup_steps WHERE setup_id = ?`, setupID); err != nil {
		return fmt.Errorf("hard delete setup_steps: %w", err)
	}
	if _, err := exec.ExecContext(ctx,
		`DELETE FROM setups WHERE id = ?`, setupID); err != nil {
		return fmt.Errorf("hard delete setup: %w", err)
	}
	return nil
}

// ListDeletedByCharacterID は論理削除済みのセットプレイを返す(M23-02 §4.2-8)。
//
// ★既存の ListByCharacterID の SQL も署名も変えず、別メソッドとして足してある。
// 並びは削除日時の新しい順(ゴミ箱は直近に消したものから探す)。
//
// ★characterID == nil の分岐は本番からは到達しない——ハンドラが characterId を
// 必須にしているため。既存の ListByCharacterID と署名を揃えるために残してあり、
// テストからは全件取得として使う。
func (r *repository) ListDeletedByCharacterID(ctx context.Context, characterID *int64) ([]*model.Setup, error) {
	const baseSQL = `
SELECT id, character_id, name, description, step_count, recipe_cache,
       version, created_at, updated_at, deleted_at
FROM setups
WHERE deleted_at IS NOT NULL`

	var (
		rows *sql.Rows
		err  error
	)
	if characterID != nil {
		rows, err = r.db.QueryContext(ctx,
			baseSQL+` AND character_id = ? ORDER BY deleted_at DESC, id DESC`, *characterID)
	} else {
		rows, err = r.db.QueryContext(ctx, baseSQL+` ORDER BY deleted_at DESC, id DESC`)
	}
	if err != nil {
		return nil, fmt.Errorf("list deleted setups by character: %w", err)
	}
	defer rows.Close()

	setups := make([]*model.Setup, 0)
	for rows.Next() {
		s, err := r.scanSetup(rows)
		if err != nil {
			return nil, err
		}
		setups = append(setups, s)
	}
	return setups, rows.Err()
}

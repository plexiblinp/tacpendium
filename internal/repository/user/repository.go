package user

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/plexiblinp/tacpendium/internal/model"
)

// ErrNotFound はユーザーが見つからない場合のセンチネル。
var ErrNotFound = errors.New("user: not found")

// Repository はユーザー参照・作成・改名の SQL 操作インターフェース。
//
// ★削除は提供しない。tags / presets が ON DELETE CASCADE で紐づいており、
// 利用者を消すとその人のタグ・プリセットが一括で消える(M22-02 §9.2-4 の判断)。
type Repository interface {
	// List は全ユーザーを id 昇順で返す。
	List(ctx context.Context) ([]model.User, error)
	// GetByID は単一ユーザーを返す。存在しない場合は ErrNotFound。
	GetByID(ctx context.Context, id int64) (*model.User, error)
	// MinID は最小の users.id を返す。1 行も無い場合は ErrNotFound。
	MinID(ctx context.Context) (int64, error)
	// ExistsByName は同名のユーザーが居るかを返す。
	ExistsByName(ctx context.Context, name string) (bool, error)
	// CreateTx はトランザクション内でユーザーを作成し、採番された id を返す。
	// ★既定タグの生成と同じトランザクションに載せるため tx を受け取る。
	CreateTx(ctx context.Context, tx *sql.Tx, name string) (int64, error)
	// UpdateName はユーザー名を変更する。存在しない場合は ErrNotFound。
	UpdateName(ctx context.Context, id int64, name string) error
}

type repository struct {
	db *sql.DB
}

// New はリポジトリを構築する。
func New(db *sql.DB) Repository {
	return &repository{db: db}
}

const selectUserColumns = `id, name, main_character_id, created_at`

func scanUser(row interface{ Scan(...any) error }) (*model.User, error) {
	var u model.User
	if err := row.Scan(&u.ID, &u.Name, &u.MainCharacterID, &u.CreatedAt); err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *repository) List(ctx context.Context) ([]model.User, error) {
	q := `SELECT ` + selectUserColumns + ` FROM users ORDER BY id`
	rows, err := r.db.QueryContext(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("user list: %w", err)
	}
	defer rows.Close()

	users := make([]model.User, 0)
	for rows.Next() {
		u, err := scanUser(rows)
		if err != nil {
			return nil, fmt.Errorf("user list scan: %w", err)
		}
		users = append(users, *u)
	}
	return users, rows.Err()
}

func (r *repository) GetByID(ctx context.Context, id int64) (*model.User, error) {
	q := `SELECT ` + selectUserColumns + ` FROM users WHERE id = ?`
	u, err := scanUser(r.db.QueryRowContext(ctx, q, id))
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("user get: %w", err)
	}
	return u, nil
}

func (r *repository) MinID(ctx context.Context) (int64, error) {
	// ★MIN(id) は行が無いと NULL を返すため、NULL 可で受けてから判定する。
	var id sql.NullInt64
	if err := r.db.QueryRowContext(ctx, `SELECT MIN(id) FROM users`).Scan(&id); err != nil {
		return 0, fmt.Errorf("user min id: %w", err)
	}
	if !id.Valid {
		return 0, ErrNotFound
	}
	return id.Int64, nil
}

func (r *repository) ExistsByName(ctx context.Context, name string) (bool, error) {
	var exists int
	err := r.db.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE name = ?)`, name).
		Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("user exists by name: %w", err)
	}
	return exists == 1, nil
}

func (r *repository) CreateTx(ctx context.Context, tx *sql.Tx, name string) (int64, error) {
	// ★password_hash は書かない(未使用列。DES-003 §3.10 / 指示書 §2.2-4)。
	res, err := tx.ExecContext(ctx, `INSERT INTO users (name) VALUES (?)`, name)
	if err != nil {
		return 0, fmt.Errorf("user create: %w", err)
	}
	id, err := res.LastInsertId()
	if err != nil {
		return 0, fmt.Errorf("user create last insert id: %w", err)
	}
	return id, nil
}

func (r *repository) UpdateName(ctx context.Context, id int64, name string) error {
	res, err := r.db.ExecContext(ctx, `UPDATE users SET name = ? WHERE id = ?`, name, id)
	if err != nil {
		return fmt.Errorf("user update name: %w", err)
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("user update name rows affected: %w", err)
	}
	if affected == 0 {
		return ErrNotFound
	}
	return nil
}

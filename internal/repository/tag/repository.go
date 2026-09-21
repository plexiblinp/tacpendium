// Package tag はタグに関する SQL クエリを集約する。M3 で実装。
package tag

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"github.com/plexiblinp/tacpendium/internal/model"
)

// ErrNotFound はタグが見つからない場合のセンチネル。
var ErrNotFound = errors.New("tag: not found")

// Repository はタグ CRUD の SQL 操作インターフェース。
type Repository interface {
	List(ctx context.Context, userID int64, category string, includeUsage bool, characterID *int64) ([]model.Tag, error)
	Get(ctx context.Context, userID, tagID int64) (*model.Tag, error)
	Create(ctx context.Context, userID int64, input model.CreateTagInput) (*model.Tag, error)
	CreateTx(ctx context.Context, tx *sql.Tx, userID int64, input model.CreateTagInput) error
	Update(ctx context.Context, userID, tagID int64, input model.UpdateTagInput) (*model.Tag, error)
	Delete(ctx context.Context, userID, tagID int64) error
	CountUsage(ctx context.Context, tagID int64) (int, error)
}

type repository struct {
	db *sql.DB
}

// New はリポジトリを構築する。
func New(db *sql.DB) Repository {
	return &repository{db: db}
}

// List はユーザーのタグ一覧を返す。
// category が空文字でない場合はそのカテゴリで絞り込む。
// includeUsage が true の場合、combo_tags との LEFT JOIN で usage_count を算出する。
// characterID が非 nil の場合、usage_count を当該キャラのコンボのみで集計する(E-3:
// マイコンボのステータス件数を選択キャラに追従させる)。includeUsage=false 時は無視する。
func (r *repository) List(ctx context.Context, userID int64, category string, includeUsage bool, characterID *int64) ([]model.Tag, error) {
	if includeUsage {
		return r.listWithUsage(ctx, userID, category, characterID)
	}
	return r.listSimple(ctx, userID, category)
}

func (r *repository) listSimple(ctx context.Context, userID int64, category string) ([]model.Tag, error) {
	q := `
		SELECT id, user_id, name, category, color
		FROM tags
		WHERE user_id = ?
		  AND (? = '' OR category = ?)
		ORDER BY CASE WHEN category IS NULL THEN 1 ELSE 0 END, category, name
	`
	rows, err := r.db.QueryContext(ctx, q, userID, category, category)
	if err != nil {
		return nil, fmt.Errorf("tag list: %w", err)
	}
	defer rows.Close()

	var tags []model.Tag
	for rows.Next() {
		var t model.Tag
		if err := rows.Scan(&t.ID, &t.UserID, &t.Name, &t.Category, &t.Color); err != nil {
			return nil, fmt.Errorf("tag list scan: %w", err)
		}
		tags = append(tags, t)
	}
	return tags, rows.Err()
}

func (r *repository) listWithUsage(ctx context.Context, userID int64, category string, characterID *int64) ([]model.Tag, error) {
	// characterID のフィルタは LEFT JOIN の ON 句に置く(WHERE に置くと、当該キャラの
	// コンボを持たないタグが結果から消えてしまうため)。COUNT は ON 句で絞り込まれた
	// combos のみを数える COUNT(c.id) を使う。characterID が NULL の場合は全キャラ集計。
	// 論理削除(ゴミ箱内)のコンボは数えない: usage_count の表示先(マイコンボ件数バッジ・
	// タグ管理一覧)は削除済みコンボを表示しないため、集計を可視コンボに揃える(改善レーン B2)。
	// 削除ガード側の CountUsage は復元時のタグ保護のためゴミ箱を含む(意図的な非対称)。
	q := `
		SELECT
		  t.id, t.user_id, t.name, t.category, t.color,
		  COUNT(c.id) AS usage_count
		FROM tags t
		LEFT JOIN combo_tags ct ON ct.tag_id = t.id
		LEFT JOIN combos c ON c.id = ct.combo_id
		  AND c.deleted_at IS NULL
		  AND (? IS NULL OR c.character_id = ?)
		WHERE t.user_id = ?
		  AND (? = '' OR t.category = ?)
		GROUP BY t.id
		ORDER BY CASE WHEN t.category IS NULL THEN 1 ELSE 0 END, t.category, t.name
	`
	rows, err := r.db.QueryContext(ctx, q, characterID, characterID, userID, category, category)
	if err != nil {
		return nil, fmt.Errorf("tag list with usage: %w", err)
	}
	defer rows.Close()

	var tags []model.Tag
	for rows.Next() {
		var t model.Tag
		var usageCount int
		if err := rows.Scan(&t.ID, &t.UserID, &t.Name, &t.Category, &t.Color, &usageCount); err != nil {
			return nil, fmt.Errorf("tag list with usage scan: %w", err)
		}
		t.UsageCount = &usageCount
		tags = append(tags, t)
	}
	return tags, rows.Err()
}

// Get は単一タグを返す。存在しない場合は ErrNotFound。
func (r *repository) Get(ctx context.Context, userID, tagID int64) (*model.Tag, error) {
	q := `SELECT id, user_id, name, category, color FROM tags WHERE id = ? AND user_id = ?`
	var t model.Tag
	err := r.db.QueryRowContext(ctx, q, tagID, userID).Scan(
		&t.ID, &t.UserID, &t.Name, &t.Category, &t.Color,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("tag get: %w", err)
	}
	return &t, nil
}

// CreateTx はトランザクション内で新規タグを挿入する(挿入結果は返さない)。
//
// ★利用者の作成と既定タグの生成を 1 つのトランザクションに載せるために在る
// (M22-02 §4.5-6)。片方だけが残ると、2 人目がステータスを引けない利用者になる。
func (r *repository) CreateTx(ctx context.Context, tx *sql.Tx, userID int64, input model.CreateTagInput) error {
	q := `INSERT INTO tags (user_id, name, category, color) VALUES (?, ?, ?, ?)`
	if _, err := tx.ExecContext(ctx, q, userID, input.Name, input.Category, input.Color); err != nil {
		return fmt.Errorf("tag create tx: %w", err)
	}
	return nil
}

// Create は新規タグを挿入し、挿入結果を返す。
func (r *repository) Create(ctx context.Context, userID int64, input model.CreateTagInput) (*model.Tag, error) {
	q := `INSERT INTO tags (user_id, name, category, color) VALUES (?, ?, ?, ?)`
	res, err := r.db.ExecContext(ctx, q, userID, input.Name, input.Category, input.Color)
	if err != nil {
		return nil, fmt.Errorf("tag create: %w", err)
	}
	id, err := res.LastInsertId()
	if err != nil {
		return nil, fmt.Errorf("tag create last insert id: %w", err)
	}
	return r.Get(ctx, userID, id)
}

// Update はタグを部分更新し、更新後のタグを返す。存在しない場合は ErrNotFound。
func (r *repository) Update(ctx context.Context, userID, tagID int64, input model.UpdateTagInput) (*model.Tag, error) {
	setClauses := make([]string, 0, 3)
	args := make([]any, 0, 5)

	if input.Name != nil {
		setClauses = append(setClauses, "name = ?")
		args = append(args, *input.Name)
	}
	if input.Category != nil {
		setClauses = append(setClauses, "category = ?")
		args = append(args, *input.Category)
	}
	if input.Color != nil {
		setClauses = append(setClauses, "color = ?")
		args = append(args, *input.Color)
	}

	if len(setClauses) == 0 {
		return r.Get(ctx, userID, tagID)
	}

	args = append(args, tagID, userID)
	q := fmt.Sprintf("UPDATE tags SET %s WHERE id = ? AND user_id = ?", strings.Join(setClauses, ", "))
	res, err := r.db.ExecContext(ctx, q, args...)
	if err != nil {
		return nil, fmt.Errorf("tag update: %w", err)
	}
	n, err := res.RowsAffected()
	if err != nil {
		return nil, fmt.Errorf("tag update rows affected: %w", err)
	}
	if n == 0 {
		return nil, ErrNotFound
	}
	return r.Get(ctx, userID, tagID)
}

// Delete はタグを削除する。存在しない場合は ErrNotFound。
//
// combo_tags は ON DELETE CASCADE で自動削除される(migrations/000001)。
//
// ★M23-10 以前、この記述は成り立っていなかった —— PRAGMA foreign_keys はプール中の
// 1 接続にしか届いておらず(ボード P-04)、CASCADE が発火するかは引いた接続次第だった。
// 実 DB に残る combo_tags の孤児行はその帰結である。M23-10 で db.Open 経由の接続は
// すべて FK=ON になり、現在は記述どおり自動削除される
// (挙動は TestForeignKeys_CascadeActuallyFires が固定している)。
//
// ★本メソッドは子行の明示削除を持たない。実行時に親を消す 4 経路のうち CASCADE に
// 委ねているのはここだけだが、揃えることは M23-10 の射程外である(同 §1.5-1)。
func (r *repository) Delete(ctx context.Context, userID, tagID int64) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM tags WHERE id = ? AND user_id = ?`, tagID, userID)
	if err != nil {
		return fmt.Errorf("tag delete: %w", err)
	}
	n, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("tag delete rows affected: %w", err)
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

// CountUsage は combo_tags に登録されているタグの使用件数を返す(VAL-T03 用)。
func (r *repository) CountUsage(ctx context.Context, tagID int64) (int, error) {
	var count int
	err := r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM combo_tags WHERE tag_id = ?`, tagID).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("tag count usage: %w", err)
	}
	return count, nil
}

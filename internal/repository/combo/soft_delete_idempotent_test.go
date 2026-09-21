package combo_test

// ★M23-08 §4.4 / §5.1-5・§5.1-6: 論理削除は 2 度目も成功するが、削除日時は動かない。
//
// この 2 つは分けて主張する必要がある。
//   - 「2 度目も成功する」は DES-002 §4.2 が固定した契約である(CHANGE-123・M23-03)。
//     404 を返すようにすると「消したいのに消せない」経路が生まれる。
//   - 「削除日時が動かない」は M23-08 が足す主張である。動くと利用者から見て
//     「消した日が後ろへずれる」。
//
// ★★deleted_at を過去の固定値に書いてから 2 度目を呼ぶこと。
//   datetime('now') は秒精度であり、同じ秒に 2 回呼ぶと修正前の実装でも値が一致して
//   しまう。それでは「上書きしていないこと」を主張できない(偽陽性)。

import (
	"context"
	"database/sql"
	"errors"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
	comborepo "github.com/plexiblinp/tacpendium/internal/repository/combo"
	"github.com/plexiblinp/tacpendium/internal/testutil/dbtest"
)

// 過去の固定値。「今」と明確に違う値であれば何でもよい。
const m2308FixedDeletedAt = "2020-01-01 00:00:00"

func insertPlainCombo(t *testing.T, db *sql.DB, repo comborepo.Repository) int64 {
	t.Helper()
	ctx := context.Background()
	move1 := lookupMoveID(t, db, 1, "standing_light_punch")

	var comboID int64
	withTx(t, db, func(tx *sql.Tx) {
		var err error
		comboID, err = repo.InsertCombo(ctx, tx, &model.Combo{
			CharacterID:   1,
			StarterMoveID: ptrInt64(move1),
			Version:       1,
		})
		if err != nil {
			t.Fatalf("InsertCombo: %v", err)
		}
	})
	return comboID
}

func readDeletedAt(t *testing.T, db *sql.DB, comboID int64) sql.NullString {
	t.Helper()
	var got sql.NullString
	if err := db.QueryRow(`SELECT deleted_at FROM combos WHERE id = ?`, comboID).Scan(&got); err != nil {
		t.Fatalf("read deleted_at: %v", err)
	}
	return got
}

// §5.1-5: 2 度目の論理削除も成功する(契約の回帰ガード)。
func TestSoftDelete_SecondCallStillSucceeds(t *testing.T) {
	db := dbtest.Setup(t)
	repo := comborepo.New(db)
	ctx := context.Background()

	comboID := insertPlainCombo(t, db, repo)

	withTx(t, db, func(tx *sql.Tx) {
		if err := repo.SoftDelete(ctx, tx, comboID); err != nil {
			t.Fatalf("1 度目の SoftDelete: %v", err)
		}
	})
	withTx(t, db, func(tx *sql.Tx) {
		if err := repo.SoftDelete(ctx, tx, comboID); err != nil {
			t.Fatalf("2 度目の SoftDelete がエラーになった: %v。"+
				"論理削除は冪等に成功する契約である(DES-002 §4.2)", err)
		}
	})
}

// §5.1-6: 2 度目の論理削除で deleted_at が変わらない(M23-08 が足す主張)。
func TestSoftDelete_SecondCallDoesNotOverwriteDeletedAt(t *testing.T) {
	db := dbtest.Setup(t)
	repo := comborepo.New(db)
	ctx := context.Background()

	comboID := insertPlainCombo(t, db, repo)

	// ★「今」と明確に違う過去の値を置く。同じ秒に 2 回呼ぶ形では、修正前の実装でも
	//   値が一致してしまい主張が成立しない。
	if _, err := db.Exec(`UPDATE combos SET deleted_at = ? WHERE id = ?`,
		m2308FixedDeletedAt, comboID); err != nil {
		t.Fatalf("seed deleted_at: %v", err)
	}
	// ★比較は「同じ読み取り経路で読んだ前後の値」で行う。DATETIME 列はドライバが
	//   RFC3339 へ正規化して返すため、投入した文字列そのものとは一致しない。
	before := readDeletedAt(t, db, comboID)
	if !before.Valid {
		t.Fatal("seed した deleted_at が読めない")
	}

	withTx(t, db, func(tx *sql.Tx) {
		if err := repo.SoftDelete(ctx, tx, comboID); err != nil {
			t.Fatalf("削除済み行への SoftDelete: %v(成功を返す契約である)", err)
		}
	})

	after := readDeletedAt(t, db, comboID)
	if !after.Valid {
		t.Fatal("deleted_at が NULL に戻っている")
	}
	if after.String != before.String {
		t.Errorf("deleted_at が %q → %q へ変わった(上書きされている＝消した日が後ろへずれる)",
			before.String, after.String)
	}
}

// 存在しない行への論理削除は従来どおり ErrNotFound。
// ★述語を足したことで RowsAffected だけでは「存在しない」と「既に削除済み」を
// 区別できなくなったため、その分岐を明示的に守る。
func TestSoftDelete_MissingRowStillReturnsNotFound(t *testing.T) {
	db := dbtest.Setup(t)
	repo := comborepo.New(db)
	ctx := context.Background()

	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		t.Fatalf("begin tx: %v", err)
	}
	defer func() { _ = tx.Rollback() }()

	if err := repo.SoftDelete(ctx, tx, 999999); !errors.Is(err, comborepo.ErrNotFound) {
		t.Errorf("SoftDelete(存在しない id) = %v, want ErrNotFound", err)
	}
}

// 生きた行の 1 度目は、これまでどおり deleted_at が現在時刻で埋まる。
func TestSoftDelete_FirstCallStampsDeletedAt(t *testing.T) {
	db := dbtest.Setup(t)
	repo := comborepo.New(db)
	ctx := context.Background()

	comboID := insertPlainCombo(t, db, repo)
	withTx(t, db, func(tx *sql.Tx) {
		if err := repo.SoftDelete(ctx, tx, comboID); err != nil {
			t.Fatalf("SoftDelete: %v", err)
		}
	})

	got := readDeletedAt(t, db, comboID)
	if !got.Valid || got.String == "" {
		t.Fatalf("deleted_at = %v, want 非 NULL", got)
	}
	if got.String == m2308FixedDeletedAt {
		t.Errorf("deleted_at が固定値のまま(=%q)。1 度目で打刻されていない", got.String)
	}
}

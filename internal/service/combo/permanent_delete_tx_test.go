package combo_test

// ★M23-08 §4.3 / §5.1-4: 完全削除の前チェックがトランザクションの内側にあること。
//
// 以前は BeginTx の前に FindByIDAllowDeleted(tx を取らない版)を呼んでおり、判定してから
// Tx を張るまでの間に他の利用者がその行を復元しうる TOCTOU の窓があった
// (M23-RESEARCH-01 §D-6)。復元されたコンボが完全削除されるため、データの消失である。
//
// ★同時実行のテストは書いていない。SQLite は書き込みを直列化するため、2 つの接続で
// 「判定と削除の間に復元を割り込ませる」瞬間を決定的に作れない(タイミング依存の
// テストになり、緑でも赤でも何も証明しない)。指示書 §5.1-4 の但し書きに従い、
// **前チェックが Tx 内で呼ばれていることを構造で主張する**。
// ⇒ リポジトリを包んだ spy で、どちらの読み取り経路が使われたかを記録する。

import (
	"context"
	"database/sql"
	"errors"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/model"
	comborepo "github.com/plexiblinp/tacpendium/internal/repository/combo"
	presetrepo "github.com/plexiblinp/tacpendium/internal/repository/preset"
	setuprepo "github.com/plexiblinp/tacpendium/internal/repository/setup"
	combosvc "github.com/plexiblinp/tacpendium/internal/service/combo"
	"github.com/plexiblinp/tacpendium/internal/service/notation"
	"github.com/plexiblinp/tacpendium/internal/service/validation"
	"github.com/plexiblinp/tacpendium/internal/testutil/dbtest"
)

// precheckSpyRepo は本物のリポジトリを包み、完全削除の前チェックがどちらの経路で
// 読まれたかだけを記録する。埋め込みなので、上書きした 2 本以外は本物へ委譲される。
type precheckSpyRepo struct {
	comborepo.Repository

	nonTxReads int
	txReads    int
	txWasNil   bool
}

func (r *precheckSpyRepo) FindByIDAllowDeleted(ctx context.Context, id int64) (*model.Combo, error) {
	r.nonTxReads++
	return r.Repository.FindByIDAllowDeleted(ctx, id)
}

func (r *precheckSpyRepo) FindByIDAllowDeletedTx(ctx context.Context, tx *sql.Tx, id int64) (*model.Combo, error) {
	r.txReads++
	if tx == nil {
		r.txWasNil = true
	}
	return r.Repository.FindByIDAllowDeletedTx(ctx, tx, id)
}

// newSvcWithPrecheckSpy は newSvc と同じ配線のまま、リポジトリだけ spy で包んだ
// サービスを返す。
func newSvcWithPrecheckSpy(t *testing.T) (*sql.DB, combosvc.Service, *precheckSpyRepo) {
	t.Helper()
	db := dbtest.Setup(t)
	spy := &precheckSpyRepo{Repository: comborepo.New(db)}
	deps := validation.Dependencies{
		CharacterRepo: &combosvc.CharacterAdapter{DB: db},
		MoveRepo:      &combosvc.MoveAdapter{DB: db},
		ComboRepo:     &combosvc.ComboDuplicateAdapter{Repo: spy},
	}
	pRepo := presetrepo.New(db)
	sRepo := setuprepo.New(db)
	notationSvc := notation.New(db, pRepo, spy, sRepo)
	svc := combosvc.New(db, spy, deps, notationSvc, nil, func() int64 { return 1 })
	return db, svc, spy
}

// 完全削除の前チェックが Tx 版の読み取りで行われること(構造による主張)。
func TestPermanentDelete_PrechecksInsideTransaction(t *testing.T) {
	db, svc, spy := newSvcWithPrecheckSpy(t)
	ctx := context.Background()

	created, _, err := svc.Create(ctx, validRyuInput(t, db))
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if err := svc.Delete(ctx, created.ID); err != nil {
		t.Fatalf("delete: %v", err)
	}

	spy.nonTxReads, spy.txReads, spy.txWasNil = 0, 0, false
	if err := svc.PermanentDelete(ctx, created.ID); err != nil {
		t.Fatalf("permanent delete: %v", err)
	}

	if spy.txReads == 0 {
		t.Error("前チェックが Tx 版(FindByIDAllowDeletedTx)で読まれていない")
	}
	if spy.txWasNil {
		t.Error("FindByIDAllowDeletedTx が tx=nil で呼ばれている(Tx の外で読んでいる)")
	}
	if spy.nonTxReads != 0 {
		t.Errorf("Tx を取らない FindByIDAllowDeleted が %d 回呼ばれている。"+
			"判定と削除の間に復元が割り込める TOCTOU の窓が残っている", spy.nonTxReads)
	}
}

// 応答が変わっていないこと。存在しない → ErrNotFound / ゴミ箱に無い → ErrComboNotInTrash。
// ★前チェックを Tx の内側へ移したときに、センチネルを名前付き err へ代入し忘れると
// ロールバックが走らないまま抜ける。ここはその配線も一緒に踏んでいる。
func TestPermanentDelete_ResponseContractUnchanged(t *testing.T) {
	db, svc, _ := newSvcWithPrecheckSpy(t)
	ctx := context.Background()

	if err := svc.PermanentDelete(ctx, 999999); !errors.Is(err, combosvc.ErrNotFound) {
		t.Errorf("PermanentDelete(存在しない id) = %v, want ErrNotFound", err)
	}

	created, _, err := svc.Create(ctx, validRyuInput(t, db))
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if err := svc.PermanentDelete(ctx, created.ID); !errors.Is(err, combosvc.ErrComboNotInTrash) {
		t.Errorf("PermanentDelete(ゴミ箱に無い行) = %v, want ErrComboNotInTrash", err)
	}
	// ★拒否された行が消えていないこと(ロールバックの確認を兼ねる)。
	var n int
	if err := db.QueryRow(`SELECT COUNT(*) FROM combos WHERE id = ?`, created.ID).Scan(&n); err != nil {
		t.Fatalf("count combos: %v", err)
	}
	if n != 1 {
		t.Errorf("409 で拒否したはずのコンボが %d 行(消えている)", n)
	}
}

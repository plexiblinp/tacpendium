package migration_test

// 確定反撃サーチ(punishfinder)の判定値を全キャラ総当たりで書き出す canary 測定ハーネス。
//
// ★用途: 契約 m18-m19-contract.md §2 の F-1(確定反撃サーチの走査列 is_projectile /
//
//	is_aerial / on_block / recovery の意味・値・使われ方を変えない)に触れる変更を入れるとき、
//	「候補集合が静かに変わっていないか」を変更の前後で突き合わせるために使う。
//	M19-04c(既存データの是正)の §0.2 条件 2 で初めて必要になり、同じ物差しで再測定できるよう
//	コミットして残した。
//
// ★既定ではスキップする。CI を重くしないため、環境変数 CANARY_OUT を与えたときだけ走る。
//
//	go test ./internal/infra/migration/ -run TestCanary_PunishScanProjection \
//	  -v   (CANARY_OUT=/path/to/canary-before.txt を付けて実行)
//
//	是正の前後で 2 回実行し、出力を突き合わせる。差分が出た場合は「その変更で説明できること」を
//	行単位で示す必要がある(F-1 の担保)。
//
// ★出力の読み方(1 行 = 1 判定):
//
//	ACC  <自キャラ> <相手キャラ> <ガード種> <相手技code> adv=<有利F> <始動技code:レーン,...>
//	MR   <自キャラ> <相手キャラ> <ガード種> <手動確認レーンの 相手技code:理由,...>
//
// ★本ファイルを internal/service/punishfinder/ 配下に置かないこと。
//
//	M19-04c の契約 F-2 解除条件 3 が「punishfinder / setplay の diff が 0」を要求しており、
//	同型の是正サブでも同じ条件が課され得る。測定側をマイグレーションテスト側に置けば、
//	走査ロジックのパッケージに触れずに測定できる。

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"

	tacpendium "github.com/plexiblinp/tacpendium"
	"github.com/plexiblinp/tacpendium/internal/infra/migration"
	"github.com/plexiblinp/tacpendium/internal/model"
	punishrepo "github.com/plexiblinp/tacpendium/internal/repository/punish"
	combosvc "github.com/plexiblinp/tacpendium/internal/service/combo"
	"github.com/plexiblinp/tacpendium/internal/service/punishfinder"
)

// canaryEmptyLister は登録済みコンボを空で返す ComboLister。
// 測定対象は「走査の判定(相手技の採否・有利フレーム・始動技)」であり、
// 孫コンボの取得(pass 2)は判定に影響しないため空で足りる。
// seed 直後の DB にはユーザーコンボが 1 件も無いので、実データ上も空である。
type canaryEmptyLister struct{}

func (canaryEmptyLister) List(ctx context.Context, f combosvc.ListFilter) ([]*model.Combo, error) {
	return nil, nil
}

// TestCanary_PunishScanProjection は seed 済み DB に対して全キャラ総当たりの Scan を実行し、
// 判定値を CANARY_OUT へ書き出す。CANARY_OUT 未指定ならスキップする。
func TestCanary_PunishScanProjection(t *testing.T) {
	out := os.Getenv("CANARY_OUT")
	if out == "" {
		t.Skip("CANARY_OUT 未指定のためスキップ(F-1 canary の測定時のみ実行する)")
	}
	dbPath := filepath.Join(t.TempDir(), "canary.db")
	if err := migration.Run(context.Background(), dbPath, tacpendium.MigrationsFS); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	defer db.Close()

	type ch struct {
		id   int64
		code string
	}
	var chars []ch
	rows, err := db.Query(`SELECT id, code FROM characters ORDER BY code`)
	if err != nil {
		t.Fatalf("characters: %v", err)
	}
	for rows.Next() {
		var c ch
		if err := rows.Scan(&c.id, &c.code); err != nil {
			rows.Close()
			t.Fatalf("scan: %v", err)
		}
		chars = append(chars, c)
	}
	rows.Close()

	svc := punishfinder.New(punishrepo.New(db), canaryEmptyLister{}, func() int64 { return 1 })
	var b strings.Builder
	ctx := context.Background()
	// ★キャラ順・ガード種順を固定する。決定論的な出力でないと前後比較が成立しない。
	for _, self := range chars {
		for _, opp := range chars {
			for _, guard := range []string{model.PunishGuardTypeBlock, model.PunishGuardTypeJustParry} {
				tree, err := svc.Scan(ctx, punishfinder.ScanParams{
					SelfCharacterID:     self.id,
					OpponentCharacterID: opp.id,
					GuardType:           guard,
				})
				if err != nil {
					t.Fatalf("scan %s/%s/%s: %v", self.code, opp.code, guard, err)
				}
				for _, n := range tree.Nodes {
					starters := make([]string, 0, len(n.Starters))
					for _, s := range n.Starters {
						starters = append(starters, fmt.Sprintf("%s:%s", s.Code, s.Lane))
					}
					sort.Strings(starters)
					fmt.Fprintf(&b, "ACC\t%s\t%s\t%s\t%s\tadv=%d\t%s\n",
						self.code, opp.code, guard, n.Code, n.Advantage, strings.Join(starters, ","))
				}
				manual := make([]string, 0, len(tree.ManualReviewNodes))
				for _, n := range tree.ManualReviewNodes {
					manual = append(manual, n.Code+":"+n.ReasonCode)
				}
				sort.Strings(manual)
				fmt.Fprintf(&b, "MR\t%s\t%s\t%s\t%s\n", self.code, opp.code, guard, strings.Join(manual, ","))
			}
		}
	}
	if err := os.WriteFile(out, []byte(b.String()), 0o644); err != nil {
		t.Fatalf("write %s: %v", out, err)
	}
	t.Logf("canary を書き出した: %s (%d bytes)", out, b.Len())
}

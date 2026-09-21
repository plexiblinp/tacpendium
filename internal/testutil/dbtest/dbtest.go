// Package dbtest はテスト用の SQLite データベース初期化ヘルパを提供する。
//
// 各テスト関数で `db := dbtest.Setup(t)` を呼ぶことで、マイグレーション適用済み
// (リュウマスタ + 組み込みプリセット 3 種 + official_ja_move エイリアス全件 seed 済み)の
// 一時 DB ファイルを得られる。t.TempDir で確保されたディレクトリ配下のファイルを使うため、
// テスト終了時に自動的に削除される。
//
// ★★M24-09d 以降、DB の作り方が変わった(CHANGE-145)———————————————————
// テストバイナリ(= パッケージ)ごとに 1 回だけマイグレーションを流して
// 「テンプレート」を作り、各テストはそのバイト列を書き出すだけになった。
// ★マイグレーションの適用コストは本数に比例して積み上がり、テストごとに流すと
// それがテスト数だけ掛かる。★実測値をここへ書かないこと —— 本数は増え続け、
// 秒数は測定環境で変わる。数字の正本は M24-09d 完了報告である(D-602 と同じ理由)。
//
// ★★この方式は「壊れると落ちる」ではなく「壊れると何も検証しないまま緑になる」形を
// とりうる —— テンプレートのコピーに失敗して空の DB でテストが走っても、
// 「その行は存在しない」を確かめているテストは緑のままであり、しかも速くなる。
// ⇒ 正しさの根拠を速度に置いてはならない。template_test.go が「テンプレート由来の DB と
// マイグレーションを流した DB が、スキーマと行数の全数で一致すること」を固定している。
// ★そのテストを消さないこと。
package dbtest

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"slices"
	"strings"
	"sync"
	"sync/atomic"
	"testing"

	tacpendium "github.com/plexiblinp/tacpendium"
	"github.com/plexiblinp/tacpendium/internal/infra/db"
	"github.com/plexiblinp/tacpendium/internal/infra/migration"

	_ "modernc.org/sqlite" // テンプレートを閉じるための素の接続で使う
)

var (
	// templateOnce はテンプレートの構築を、テストバイナリごとに 1 回へ畳む。
	templateOnce sync.Once
	// templateBytes はマイグレーション適用済み DB ファイルの中身そのものである。
	//
	// ★★ファイルではなくバイト列で持つのは意図である。Go にはプロセス終了時に走る
	// 後片付けの経路が無く、ファイルで持つと「テストバイナリ 1 本につき 1 個の DB が
	// /tmp に残る」形になる(本リポジトリはディスク増加の課題を抱えている)。
	// バイト列なら -wal / -shm が混入する経路も構造的に消える。
	templateBytes []byte
	// templateErr は構築に失敗した理由を保持する。sync.Once は 1 回しか走らないため、
	// 失敗したときは以後のすべての Setup が同じ理由で落ちる(黙って素通りさせない)。
	templateErr error

	// templateDisabled はテンプレート方式を使わないことを表す。
	// ★TestMain から DisableTemplate() で立てる。最初の Setup より前に立つ必要がある。
	templateDisabled atomic.Bool

	// migrationRuns は本プロセスで dbtest がマイグレーションを実行した回数である。
	// ★★これが「除外が効いていること」を速度以外で観測する唯一の指標である(§5.3-2)。
	migrationRuns atomic.Int64
)

// DisableTemplate はテンプレート方式を止め、Setup がテストごとにマイグレーションを
// 流す形へ戻す。
//
// ★★呼ぶべきなのは「マイグレーションの適用過程そのものを検証しているパッケージ」だけである。
// そこではマイグレーションが再生されること自体が目的であり、出来上がった DB を配ると
// テストが検証しないまま緑になる。現時点の該当は internal/infra/migration の 1 パッケージ
// のみ(M24-09d §3.3-6 で 9 本の走査軸により全数を確認した)。
//
// ★最初の Setup が走る前に呼ぶこと。TestMain から呼ぶのが唯一の正しい位置である
// (テンプレートは sync.Once で構築され、一度構築されると本フラグは効かない)。
func DisableTemplate() {
	// ★★逆向きの事故に検出器を置く。テンプレート方式は「除外し忘れ」だけでなく
	// 「除外しすぎ」でも壊れるが、後者は **テストが全部緑のまま遅くなるだけ** であり、
	// 誰も気づかない(本サブが言う「速度は根拠にならない」の裏返しである)。
	// ⇒ 許可した 1 パッケージ以外から呼ばれたら、その場で止める。
	//
	// ★除外を増やすときは本一覧へ足すこと。**足す前に M24-09d §3.3-6 の 9 本の
	// 走査軸で全数を数え直すこと**(「マイグレーションやスキーマの生成過程を
	// 検証しているテストか」が判定基準であり、「遅いから」ではない)。
	if pkg := callerPackage(2); !slices.Contains(templateExemptPackages, pkg) {
		panic(fmt.Sprintf(
			"dbtest.DisableTemplate: パッケージ %q からは呼べない。\n"+
				"  除外してよいのはマイグレーションの適用過程そのものを検証するパッケージだけである。\n"+
				"  許可一覧: %v\n"+
				"  増やす場合は internal/testutil/dbtest/dbtest.go の templateExemptPackages へ足すこと。",
			pkg, templateExemptPackages))
	}
	templateDisabled.Store(true)
}

// templateExemptPackages はテンプレート方式の除外を許可されたパッケージの全数である。
//
// ★M24-09d §3.3-6 の実査(9 本の走査軸)で、該当はこの 1 本だけであることを確認した。
var templateExemptPackages = []string{
	"github.com/plexiblinp/tacpendium/internal/infra/migration",
}

// callerPackage は呼び出し元のパッケージパスを返す。外部テストパッケージ
// (`..._test`)は元のパッケージへ丸めるため、`migration_test` は `migration` になる。
func callerPackage(skip int) string {
	pc, _, _, ok := runtime.Caller(skip)
	if !ok {
		return ""
	}
	fn := runtime.FuncForPC(pc)
	if fn == nil {
		return ""
	}
	// 例: github.com/plexiblinp/tacpendium/internal/infra/migration_test.TestMain
	full := fn.Name()
	slash := strings.LastIndex(full, "/")
	dot := strings.Index(full[slash+1:], ".")
	if dot < 0 {
		return full
	}
	return strings.TrimSuffix(full[:slash+1+dot], "_test")
}

// MigrationRunCount は本プロセスで dbtest がマイグレーションを実行した回数を返す。
//
// テンプレート方式が効いていれば、パッケージ内で Setup を何回呼んでも 1 のままである。
// DisableTemplate() を呼んだパッケージでは Setup の回数だけ増える。
//
// ★★「速くなったから効いている」で済ませないための観測点である。速度は根拠にならない
// —— 除外し忘れても速くなり、コピーに失敗しても速くなる。
func MigrationRunCount() int { return int(migrationRuns.Load()) }

// Setup は一時 DB ファイル上にマイグレーション + seed を適用した *sql.DB を返す。
//
// PRAGMA(journal_mode=WAL、foreign_keys=ON、busy_timeout、synchronous=NORMAL)も適用済み。
// ★M23-10 以降、これらはプール中の「すべての」接続に効く(db.Open が接続文字列で
// 指定するため)。FK=OFF の接続を意図的に必要とするテストは、本ヘルパを使わず
// 生の sql.Open を自前に開くこと。
// テスト終了時に t.Cleanup で *sql.DB.Close() が呼ばれる。
//
// ★署名は M24-09d でも変えていない。呼び出し元が 200 か所を超えるためである。
func Setup(t *testing.T) *sql.DB {
	t.Helper()
	conn, _ := setup(t, "dbtest.Setup")
	return conn
}

// SetupWithPath は Setup と同等の処理に加え、DB ファイルのパスも返す。
// マイグレーション差分検証など、ファイルパスが必要なテスト向け。
func SetupWithPath(t *testing.T) (*sql.DB, string) {
	t.Helper()
	return setup(t, "dbtest.SetupWithPath")
}

func setup(t *testing.T, who string) (*sql.DB, string) {
	t.Helper()

	dbPath := filepath.Join(t.TempDir(), "test.db")
	if err := provision(dbPath); err != nil {
		t.Fatalf("%s: %v", who, err)
	}

	conn, err := db.Open(dbPath)
	if err != nil {
		t.Fatalf("%s: open: %v", who, err)
	}
	t.Cleanup(func() {
		_ = conn.Close()
	})
	return conn, dbPath
}

// provision は dbPath にマイグレーション適用済みの DB ファイルを用意する。
func provision(dbPath string) error {
	if templateDisabled.Load() {
		if err := runMigrations(dbPath); err != nil {
			return fmt.Errorf("migration: %w", err)
		}
		return nil
	}

	templateOnce.Do(buildTemplate)
	if templateErr != nil {
		return templateErr
	}
	// ★0o644 は SQLite が自分で作るときの既定と揃えている(umask 適用前)。
	if err := os.WriteFile(dbPath, templateBytes, 0o644); err != nil {
		return fmt.Errorf("write template copy: %w", err)
	}
	return nil
}

// runMigrations は migration.Run を呼び、実行回数を記録する。
// ★dbtest 経由の実行だけを数える。テストが自前で migration.Run を呼ぶ分は数えない。
func runMigrations(dbPath string) error {
	migrationRuns.Add(1)
	return migration.Run(context.Background(), dbPath, tacpendium.MigrationsFS)
}

// buildTemplate はテンプレートを 1 回だけ構築する。失敗は templateErr へ残す。
func buildTemplate() {
	dir, err := os.MkdirTemp("", "tacpendium-dbtest-template-")
	if err != nil {
		templateErr = fmt.Errorf("dbtest: テンプレート用の一時ディレクトリを作れない: %w", err)
		return
	}
	// ★構築が終わったらディレクトリごと消す。残すのはメモリ上のバイト列だけである。
	defer func() { _ = os.RemoveAll(dir) }()

	tmplPath := filepath.Join(dir, "template.db")
	if err := runMigrations(tmplPath); err != nil {
		templateErr = fmt.Errorf("dbtest: テンプレートのマイグレーションに失敗: %w", err)
		return
	}

	if err := checkpointAndClose(tmplPath); err != nil {
		templateErr = err
		return
	}

	// ★★サイドカーが残った状態のファイルをコピーすると、コピー先は「WAL に未反映の
	// 変更がある DB」になり、中身が欠ける。⇒ ここで止める。黙って進めない。
	//
	// ★実測では migration.Run が素の sql.Open を使い PRAGMA を一切載せないため、
	// テンプレートは journal_mode=delete のままでありサイドカーは元から生じない
	// (WAL 化するのは後段の db.Open である)。本検査はその前提が将来崩れたときに
	// 気づくための番人であり、崩れていない今も 0 コストで置いておける。
	// ★-journal も見る。現在の journal_mode は delete であり、そちらが残る形の
	// ほうが実は近い(M24-09d レビュー 低-3)。
	for _, suffix := range []string{"-wal", "-shm", "-journal"} {
		if _, err := os.Stat(tmplPath + suffix); err == nil {
			templateErr = fmt.Errorf(
				"dbtest: テンプレートに %s が残っている。この状態でコピーすると中身が欠ける",
				filepath.Base(tmplPath+suffix))
			return
		}
	}

	b, err := os.ReadFile(tmplPath)
	if err != nil {
		templateErr = fmt.Errorf("dbtest: テンプレートを読めない: %w", err)
		return
	}
	if len(b) == 0 {
		templateErr = fmt.Errorf("dbtest: テンプレートが 0 バイトである")
		return
	}
	templateBytes = b
}

// checkpointAndClose は WAL の内容を本体ファイルへ畳んでから接続を閉じる。
//
// ★db.Open を使わないこと。db.Open は接続文字列で journal_mode=WAL を指定するため、
// 「WAL を持ち込まない」という本関数の目的と正面から衝突する。
func checkpointAndClose(dbPath string) error {
	conn, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return fmt.Errorf("dbtest: テンプレートを開けない: %w", err)
	}
	conn.SetMaxOpenConns(1)

	// journal_mode が WAL でないときも本 PRAGMA はエラーにならず (0, -1, -1) を返す。
	rows, err := conn.Query("PRAGMA wal_checkpoint(TRUNCATE)")
	if err != nil {
		_ = conn.Close()
		return fmt.Errorf("dbtest: wal_checkpoint: %w", err)
	}
	if err := rows.Close(); err != nil {
		_ = conn.Close()
		return fmt.Errorf("dbtest: wal_checkpoint の結果を閉じられない: %w", err)
	}

	if err := conn.Close(); err != nil {
		return fmt.Errorf("dbtest: テンプレートを閉じられない: %w", err)
	}
	return nil
}

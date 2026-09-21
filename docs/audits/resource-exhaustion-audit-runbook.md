# リソース枯渇監査 実施手順書(ランブック)

- **作成日**: 2026-08-04
- **位置づけ**: `20260804-resource-exhaustion-audit.md`(初回フル監査。以下「初回レポート」)の**手法を再現可能な形に落とした手順書**。今後の機能追加分に対する**差分監査**を、初回と同じ物差しで回すためのもの
- **想定実行者**: Claude Code(Opus / Sonnet を含む)。判断力への依存を減らすため、可能な限り「固定コマンド + ベースライン表との突合」に落としてある。**曖昧な箇所は判断せず「要確認」と書いて申し送ること**
- **鉄則**: 監査は調査のみ。**アプリコード・設定・依存を一切変更しない**。成果物は `docs/audits/YYYYMMDD-resource-exhaustion-audit.md`(差分監査なら `-delta` を付ける)1 本のみ

---

## 0. 今回(初回監査)で実際に行った作業の記録

再現手順の根拠として、初回監査の実作業を時系列で記す。

| # | 作業 | 使ったもの | 結果の行き先 |
|---|------|-----------|-------------|
| 1 | CLAUDE.md・SUPP-001 §5.6(ログ戦略)・followup-backlog を読み、既知指摘(fk-enforcement-per-connection 等)を把握 | Read/Grep | レポート R-1 の既知/新規の切り分け |
| 2 | 基盤コードの精読: `internal/infra/log/log.go`、`internal/infra/db/db.go`、`internal/config/config.go`、`cmd/tacpendium/main.go`、`internal/infra/migration/migrate.go`、`internal/api/middleware/`、`internal/api/static/handler.go` | Read | 観点 A(ログ・WAL・一時ファイル)の確認 |
| 3 | 横断 grep(§2 の固定コマンド集の原型): goroutine / Ticker / TempDir / SetMaxOpenConns / BodyLimit / タイムアウト / LIMIT / ReadAll 等 | Grep/Bash | ベースライン表(§3)の数値 |
| 4 | 静的解析: `go vet ./...` + golangci-lint(errcheck・rowserrcheck・bodyclose・sqlclosecheck・noctx・staticcheck)。**配布版 2.5.0 は Go 1.26 非対応で失敗 → `GOTOOLCHAIN=go1.26.4 go install` で再ビルドして解決** | Bash | レポート §4・§5-E |
| 5 | **PRAGMA 実効値の実証テスト**: `db.Open` と同一手順をスクラッチ領域の独立モジュールに再現し、プールから 4 接続を同時取得して PRAGMA を観測(`internal/` は外部 import 不可のため複製が必須) | Bash(scratchpad) | R-1 の実測根拠 |
| 6 | フロントエンド監査をサブエージェント(Explore)に委任: §2-F の調査項目リストをそのままプロンプトにした | Agent | レポート §5-C、M-4、L-6〜L-8 |
| 7 | 既知指摘 2 件(`FindDuplicateInCombo` / `RecomputePresetCache`)の実装確認と、同型パターンの横断探索(Unmarshal 握りつぶしは errcheck 出力を全件レビューして 2 件のみと確定) | Read/Grep | M-2・M-3 |
| 8 | 呼び出し元の逆引き(`RecomputePresetCache` は本番呼び出し元ゼロ=潜在、setups は物理削除なし等) | Grep | 重大度の調整 |
| 9 | レポート執筆(引用する行番号は執筆直前に再 grep で確定)→ commit → push | Write/Bash | 初回レポート |

**Fable 固有だった箇所と Opus/Sonnet 向けの代替**:
- 手順 5(実証テスト)は自力設計だった → 本書 §4 に**完成済みテストコード**を収録した。コピーして実行するだけでよい。
- 手順 7 の「同型パターンの横断探索」は判断を要した → errcheck の出力全件を機械的にレビューする形(§2-D)に固定した。
- 重大度判定は §6 の基準表に従う。迷ったら**低い方に倒して「要確認」を付記**する(過大評価より申し送りが安全)。

---

## 1. 監査の起動

**推奨**: カスタムコマンド `/audit_resource_delta [比較基点コミット]` を使う(2026-08-10 機構化。
§2/§4/§5 の機械チェックは `scripts/audit-resource-scan.sh` に一括実装済みで、コマンドが
実行〜突合〜レポート生成まで本書に従って行う)。

コマンドが使えない環境では、新しいセッションに以下をそのまま貼る:

> `docs/audits/resource-exhaustion-audit-runbook.md` に従い、リソース枯渇リスクの**差分監査**を実施してください。比較基点は <前回監査のコミット or タグ>、対象は現在の HEAD です。調査のみでコード変更は禁止。手順書の §2〜§5 を順に実行し、§3 のベースライン表と突合して、§7 の様式でレポートを `docs/audits/YYYYMMDD-resource-exhaustion-audit-delta.md` に作成し、`claude/` ブランチにコミット・push してください。判断に迷う項目は「要確認」として申し送ること。

### 差分範囲の確定(最初に必ず実行)

```bash
# 前回監査時点のコミットは、前回レポート冒頭に記載されている(なければ git log で docs/audits/ の最終更新を探す)
git diff --stat <前回監査コミット>..HEAD -- '*.go' 'web/src' 'migrations' | tail -20
git diff --name-only <前回監査コミット>..HEAD -- '*.go' 'web/src/**/*.ts' 'web/src/**/*.tsx' 'migrations' > /tmp/audit-changed-files.txt
wc -l /tmp/audit-changed-files.txt
```

- 変更ファイル一覧が**差分監査の精読対象**。§2 の grep はコストが低いので**常に全体に対して実行**し、結果をベースライン表(§3)と突合する(増分だけ精読すればよい)。
- `docs/` のみの変更しかない場合は「監査対象の変更なし」とだけ報告して終了してよい。

---

## 2. 機械チェック(固定コマンド集)

> **機構化済み(2026-08-10)**: 本節・§4・§5 の全コマンドは `scripts/audit-resource-scan.sh` が
> 一括実行し、末尾に突合用の COUNTS ブロックを出力する。**スクリプトがある環境では手打ちせず
> スクリプトを使うこと**(打ち間違いによる偽陰性の防止)。本節の個別コマンドは、スクリプトが
> 使えない環境での代替、およびスクリプト保守時の正本として残す。

各コマンドを**そのまま**実行し、結果を §3 のベースライン表と比較する。**件数が増えていたら、増えた箇所を精読して指摘化 or 「問題なし(理由)」を明記**する。件数が同じでも、差分ファイルに該当パターンが含まれるなら中身を確認する。

### 2-A. ディスク膨張(観点 A)

```bash
# 一時ファイル(ベースライン: 本番コード 0 件)
grep -rn "os.TempDir\|os.CreateTemp\|os.MkdirTemp\|ioutil.Temp" --include='*.go' . | grep -v _test.go

# ファイル書き込みの新設(ベースライン: config 書き戻し2実装 + cmd/seedgen のみ)
# os.Create は「os.Create(」で照合する(os.CreateTemp を上の一時ファイル検査と二重計上しないため)
grep -rn "os.WriteFile\|os.Create(\|os.OpenFile" --include='*.go' internal cmd | grep -v _test

# ログ設定の変更有無(lumberjack 設定が消えていないか)
grep -n "MaxSize\|MaxBackups\|MaxAge" internal/infra/log/log.go internal/config/config.go

# SQLite チェックポイント/VACUUM の新設(ベースライン: 0 件。新設されたら実行タイミングを精査)
# --include='*.sql' が必須(migrations/ は SQL のみのため、*.go だけだと 1 ファイルも検査されない)
grep -rn "wal_checkpoint\|VACUUM\|auto_vacuum" --include='*.go' --include='*.sql' internal cmd migrations | grep -v _test
```

**判定規則**: ディスクへ書くコードが新設されていたら、「何が上限を決めるか」(ローテーション・失効・件数上限・ユーザー操作起点)をコードから特定する。特定できなければ**それが指摘**(中以上)。

### 2-B. リーク(観点 B)

```bash
# goroutine(ベースライン: 1 件 = cmd/tacpendium/main.go の browser 起動)
grep -rn "go func" --include='*.go' internal cmd | grep -v _test.go

# タイマー・定期処理(ベースライン: 0 件)
grep -rn "time.NewTicker\|time.NewTimer\|time.After\|time.Sleep\|time.Tick" --include='*.go' internal cmd | grep -v _test.go

# 全件ロード系 API の新設(ベースライン: ListAll 系 3 つ。新設されたら呼び出し元の件数上限を確認)
grep -rn "func.*ListAll" --include='*.go' internal/repository | grep -v _test

# 一覧クエリの LIMIT 有無(新規一覧クエリに LIMIT が無ければ指摘)
grep -rn "LIMIT" --include='*.go' internal/repository | grep -v _test | grep -c LIMIT
```

**判定規則**: goroutine が増えていたら、(1) 停止経路(context / 一回性)があるか、(2) ループ内で defer を積んでいないか、を精読。Ticker 新設は §6 の基準で自動的に「中」以上(ゲーム同時起動前提)。

### 2-C. 資源競合(観点 C)

```bash
# DB 接続プール設定(ベースライン: 本番 0 件 = 既知 R-1。是正されたら §4 の実証テストで再確認)
grep -rn "SetMaxOpenConns\|SetMaxIdleConns\|SetConnMaxLifetime" --include='*.go' internal cmd | grep -v _test

# PRAGMA の適用経路(DSN 化されたかどうか)
grep -n "PRAGMA\|_pragma" internal/infra/db/db.go

# HTTP サーバ設定(ベースライン: タイムアウト・BodyLimit とも 0 件 = 既知 M-1)
grep -rn "ReadTimeout\|ReadHeaderTimeout\|WriteTimeout\|IdleTimeout\|BodyLimit" --include='*.go' internal cmd | grep -v _test

# rows 反復中の入れ子クエリ(既知 M-2 の同型探索。rows.Next ループ内で r.Find/r.List 呼び出しがないか)
# 既知の限界: レシーバ名 r 固定・-A 12 行の射程内のみ検出(差分精読側でカバーする)
grep -rn -A 12 "for rows.Next()" --include='*.go' internal/repository | grep -E "r\.(Find|List|Get|Count)" | grep -v _test 
```

**判定規則**: 最後の grep がヒットしたら該当関数を精読し、外側 rows が開いたまま同一 `*sql.DB` へクエリしていれば指摘(中)。`SetMaxOpenConns(1)` が導入済みの場合は**重大**(自己デッドロック)。

### 2-D. エラー握りつぶし(観点 D)

静的解析(§5)の errcheck 出力を使う。**本番コード(`_test.go` 以外)の全行を目視レビュー**し、次の分類で仕分ける:

1. データ経路(DB 更新・キャッシュ・ファイル書き込み・Unmarshal)→ **指摘**(中以上)
2. クリーンアップ・ログ・stdout 案内 → 軽微 or 問題なし(理由を書く)

ベースライン(初回時点の本番コード 16 件)からの**増分だけ**を判定すればよい。

### 2-E. フロントエンド(観点 B/C)

```bash
cd web
# タイマー(ベースライン: setInterval 0 件 / setTimeout 系 4 件・全て cleanup 済み)
grep -rn "setInterval\|setTimeout\|requestAnimationFrame" src --include='*.ts' --include='*.tsx' | grep -v test

# ポーリング(ベースライン: 0 件。新設は自動的に「中」以上)
grep -rn "refetchInterval" src

# リスナ(ベースライン: addEventListener 2 件・全て remove 対応済み。add と remove の件数差が出たら精読)
grep -rn "addEventListener\|removeEventListener" src --include='*.ts' --include='*.tsx' | grep -v test

# ストレージ書き込み(新キーは CLAUDE.md §10.X の表と突合。表に無いキーは指摘)
grep -rn "localStorage\|sessionStorage\|createLocalStorageHelper\|createSessionStorageHelper" src --include='*.ts' --include='*.tsx' | grep -v test | grep -v browser-storage.ts

# 常駐通信(ベースライン: 0 件)
grep -rn "WebSocket\|EventSource\|new Worker\|BroadcastChannel" src --include='*.ts' --include='*.tsx' | grep -v test

# QueryClient 設定(ベースライン: main.tsx で無設定 = 既知 M-4。defaultOptions が入ったら解消として記録)
grep -n -A 8 "new QueryClient" src/main.tsx
```

**判定規則(useEffect)**: 差分ファイルに含まれる `useEffect` は全て開き、(1) タイマー/リスナ/購読を作る effect に cleanup(return)があるか、(2) 依存配列があるか、を確認。eslint(react-hooks)が導入済みならその実行結果で代替してよい。

### 2-F. サブエージェント委任(任意)

フロントエンドの調査量が多い場合は、初回監査と同様に read-only サブエージェントへ §2-E+useEffect 精読を委任してよい。プロンプトには**本書 §2-E のコマンドと判定規則をそのまま貼り**、「事実のみ file:line 付きで報告。該当なしも明示」と指示する。

---

## 3. ベースライン表(初回監査 2026-08-04、コミット `1a5abcc` 時点)

差分監査ではこの表と突合し、**乖離のあった行だけ**精読・判定する。監査完了時は本表を最新値に更新する(この手順書で唯一の書き換え対象)。

| 項目 | ベースライン値 | 備考 |
|------|---------------|------|
| `go func`(本番) | **1**(main.go:326 ブラウザ起動・一回性) | |
| time.Ticker/Timer/Sleep(本番) | **0** | |
| os.TempDir/CreateTemp 系(本番) | **0** | |
| SetMaxOpenConns 等(本番) | **0** | 既知 R-1(未是正) |
| HTTP タイムアウト/BodyLimit | **0** | 既知 M-1(未是正) |
| rows 反復中の入れ子クエリ | **1**(setup/repository.go FindDuplicateInCombo) | 既知 M-2(未是正) |
| wal_checkpoint/VACUUM | **0** | 方針なし(M-5) |
| `go vet ./...` | **0 件** | |
| errcheck(本番コードのみ) | **61 件**(切り捨て上限を無効化した全量: rows.Close 系 37・Fprintln 系 11・os.Remove 系 8 ほか。うちデータ経路は notation/cache.go:104,130 の 2 件のみ=M-3。初回レポートの「16 件」は golangci-lint 既定の切り捨て下の測定値であり不正確。2026-08-10 再採取) | |
| rowserrcheck / bodyclose / sqlclosecheck(本番) | **0 件** | |
| staticcheck(本番) | **2 件**(setplay.go:265, validation/combo.go:220) | |
| FE setInterval / refetchInterval | **0 / 0** | |
| FE addEventListener | **2**(全て remove 対応) | |
| FE WebSocket/Worker 等 | **0** | |
| ストレージキー | localStorage 4 + sessionStorage 2 | CLAUDE.md §10.X の表と一致 |
| QueryClient defaultOptions | **無設定** | 既知 M-4(未是正) |
| eslint / CI | **どちらも不在** | 導入提案済み |
| PRAGMA 実効値(§4 実測) | conn[0] のみ FK=1/busy=5000/sync=NORMAL、**他は FK=0/busy=0/sync=FULL** | 既知 R-1 |

### COUNTS ベースライン(`scripts/audit-resource-scan.sh` の出力と機械突合する正本)

2026-08-10 再採取(クリーンルームレビューによるスクリプト是正後。lint の切り捨て無効化・
vacuum の *.sql 対象化・limit_lines 追加を反映)の実測値。差分監査ではスクリプト末尾の
COUNTS ブロックとこの値を突合し、乖離した行だけ精読する。`-1` は未実行/スキップ/実行失敗
の意味(0 との区別は必須)。`lint_prod` は本番コード指摘の合算(内訳: errcheck 61 +
noctx 3 + staticcheck 2 = 66)。同一コミットへの複数回実行で同値になることを確認済み。

```
tempfiles=0  file_writes=5  log_rotation_cfg=13  vacuum=0
go_func=1  timers=0  list_all=3  limit_lines=3
pool_cfg=0  pragma_route=6  http_limits=0  nested_query=1
fe_interval=0  fe_timers=6  fe_polling=0
fe_listener_add=2  fe_listener_remove=2  fe_storage=17  fe_realtime=0
go_vet=0  lint_prod=66  pragma_fk_off=3
```

注: `fe_timers` / `fe_storage` は grep 行数ベースであり、初回レポート本文の「実装箇所数」
(setTimeout 系 4 箇所等)とは数え方が異なる。突合はこの COUNTS 値に対して行うこと。

---

## 4. PRAGMA 実証テスト(R-1 の再検査。是正 PR のレビュー時にも使う)

`internal/` パッケージは外部モジュールから import できないため、**scratchpad に独立モジュールを作り、`internal/infra/db/db.go` の Open と同一手順を複製**して検査する。`db.go` の PRAGMA リストが変わっていたら、下のテスト内のリストも同じ内容に合わせること(DSN 化されていたら `sql.Open` の第 2 引数も合わせる)。

```bash
mkdir -p "$SCRATCHPAD/pragmacheck" && cd "$SCRATCHPAD/pragmacheck"
printf 'module pragmacheck\n\ngo 1.26.2\n' > go.mod
# main_test.go を下記内容で作成
go mod tidy && go test -v -run TestPragmaPerConnection .
```

```go
package pragmacheck

import (
	"database/sql"
	"fmt"
	"testing"

	_ "modernc.org/sqlite"
)

// internal/infra/db/db.go の Open と同一手順を再現し、プール各接続の PRAGMA 実効値を観測する。
// 【重要】db.go の接続方法・PRAGMA 適用方法が変わったら、ここも同じ内容に更新して実行すること。
func TestPragmaPerConnection(t *testing.T) {
	path := t.TempDir() + "/x.db"
	conn, err := sql.Open("sqlite", path) // db.go が DSN パラメータ付きに変わったら同じ DSN にする
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()
	for _, p := range []string{ // db.go の pragmas スライスと同一に保つ
		"PRAGMA journal_mode = WAL",
		"PRAGMA foreign_keys = ON",
		"PRAGMA busy_timeout = 5000",
		"PRAGMA synchronous = NORMAL",
	} {
		if _, err := conn.Exec(p); err != nil {
			t.Fatal(err)
		}
	}
	const n = 4
	conns := make([]*sql.Conn, n)
	for i := range conns {
		c, err := conn.Conn(t.Context())
		if err != nil {
			t.Fatal(err)
		}
		conns[i] = c
	}
	for i, c := range conns {
		var fk, busy, sync, ac int
		var jm string
		for q, dst := range map[string]any{
			"PRAGMA foreign_keys": &fk, "PRAGMA busy_timeout": &busy,
			"PRAGMA synchronous": &sync, "PRAGMA wal_autocheckpoint": &ac,
			"PRAGMA journal_mode": &jm,
		} {
			if err := c.QueryRowContext(t.Context(), q).Scan(dst); err != nil {
				t.Fatal(err)
			}
		}
		fmt.Printf("conn[%d]: foreign_keys=%d busy_timeout=%d synchronous=%d journal_mode=%s wal_autocheckpoint=%d\n",
			i, fk, busy, sync, jm, ac)
	}
	for _, c := range conns {
		c.Close()
	}
}
```

**読み方**: 全接続で `foreign_keys=1 busy_timeout=5000 synchronous=1` になっていれば R-1 解消。1 本でも `foreign_keys=0` があれば未解消(ベースライン表の値を更新)。

---

## 5. 静的解析の実行

```bash
go vet ./...   # ベースライン: 0 件

# golangci-lint。【落とし穴】バイナリのビルド Go バージョンが go.mod の go ディレクティブ以上である必要がある。
# "the Go language version used to build golangci-lint is lower than the targeted Go version" が出たら:
#   GOTOOLCHAIN=go$(go env GOVERSION | tr -d 'go') go install github.com/golangci/golangci-lint/v2/cmd/golangci-lint@latest
# で再ビルドし ~/go/bin/golangci-lint を使う。
# --max-issues-per-linter 0 / --max-same-issues 0 は必須。既定(同一メッセージ 3 件で
# 頭打ち)のままだと指摘の大半が切り捨てられ、どの指摘が残るかも非決定的になる
# (初回監査の「errcheck 16 件」はこの切り捨て下の測定値だった。2026-08-10 是正)
golangci-lint run --no-config --default=none \
  -E errcheck,rowserrcheck,bodyclose,sqlclosecheck,noctx,staticcheck \
  --max-issues-per-linter 0 --max-same-issues 0 \
  --timeout 10m ./... > /tmp/lint.txt 2>&1
grep -E '^[a-z].*\.go:' /tmp/lint.txt | grep -v _test.go   # 本番コードのみ抽出 → §2-D の仕分けへ
```

- `.golangci.yml` が導入済みになっていたら `--no-config --default=none -E ...` を外し、設定ファイルどおりに実行して差分だけ見る。
- フロントは eslint 導入済みなら `cd web && pnpm lint`。未導入なら §2-E の grep が代替。

---

## 6. 重大度の判定基準(初回レポートと同一。変更しない)

| 重大度 | 基準 |
|--------|------|
| **重大** | ユーザーの PC を不安定にする(フリーズ・スワップ・ディスク飽和)/ データを失う・壊す。アプリ自身の永久ハング(ゲーム中に再起動困難)も含む |
| **中** | 長期稼働・ゲーム同時起動で問題になる。単調増加するが年単位でしか効かないものもここ |
| **軽微・様式** | 実害はないが規律として直したいもの(リンタ指摘・慣用からの逸脱) |

**機械的な格上げ規則**(判断に迷ったらこれに従う):
- 定期実行(Ticker / setInterval / refetchInterval)の新設 → 最低「中」。停止経路がなければ「重大」
- 上限を決めるものが特定できないディスク書き込みの新設 → 最低「中」
- データ経路のエラー握りつぶしの新設 → 最低「中」
- 上記に該当するが確信が持てない → 重大度を 1 段下げて**「要確認」を必ず付記**

---

## 7. レポート様式(初回レポートと同一構成)

`docs/audits/YYYYMMDD-resource-exhaustion-audit-delta.md` に以下の構成で書く:

1. **要約**: 冒頭に「比較基点コミット → 対象コミット」を明記。重大度別件数と最重要 3 件(3 件未満ならある分だけ)
2. **重大** / 3. **中** / 4. **軽微・様式**: 各指摘に 根拠(パス:行)・影響・再現条件・修正の方向性。**既知指摘(初回レポート・followup-backlog 記載)は再掲せず「未是正のまま」「解消済み」だけ状態を書く**
5. **確認済みで問題なかった領域**: §2 の各コマンドについて「実行した・ベースラインと一致 or 差分の内容」を表で申告(カバレッジ申告。これが無いレポートは価値半減)
6. **ベースライン表の更新**: 本手順書 §3 の表を最新値に更新した旨(更新も監査タスクの一部)
7. **定量見積り**: 新設された書き込み・処理があれば増加速度を見積る。根拠が無ければ「見積り不能」と明記

**禁止事項**(初回と同じ): コード修正・リファクタ・依存追加は行わない。設計に関わる直し方は「設計判断事項」として申し送る。確認できないことは断定せず「要確認」。

## 8. 運用メモ(環境の落とし穴)

- **push**: このリポジトリのフックは `git push origin claude/<ブランチ名>` の**単一形のみ**許可(`-u` フラグ・複合コマンド不可)。コミットは Conventional Commits(`docs(audit): ...`)。
- **golangci-lint のバージョン問題**: §5 のコメント参照。apt/配布版が古いと Go 1.26+ を解析できない。
- **`internal/` の import 制約**: 実証テストは必ず §4 の方式(複製)で。リポジトリ内にテストを一時追加してはならない(調査のみの原則に反する)。
- **scratchpad**: 一時ファイルはセッションの scratchpad ディレクトリへ。リポジトリ直下・`/tmp` 直下に作らない。
- **awk 等の自作ヒューリスティックで件数を数えない**: 初回監査で rows.Err の有無を awk で数えたところ誤検出した。**リンタ(rowserrcheck 等)の出力を正とする**。
- **golangci-lint は必ず切り捨て上限を無効化する**(`--max-issues-per-linter 0 --max-same-issues 0`)。既定は同一メッセージ 3 件で頭打ちのうえ、どの指摘が残るかが非決定的で、件数突合が成立しない(2026-08-10 クリーンルームレビューで発覚。初回監査の errcheck 件数はこの罠に落ちていた)。
- **pipefail 下で `printf 大出力 | grep -q` を書かない**: grep の早期終了で printf 側が SIGPIPE になり、パイプライン全体が偽の失敗判定になる。文字列有無の判定は bash の `[[ ... == *"..."* ]]` を使う(スクリプト是正時に踏んだ罠)。

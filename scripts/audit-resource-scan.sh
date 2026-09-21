#!/usr/bin/env bash
# リソース枯渇監査(観点A〜E)の機械チェック部を一括実行する監査スクリプト。
# docs/audits/resource-exhaustion-audit-runbook.md §2(固定コマンド集)・§4(PRAGMA 実証
# テスト)・§5(静的解析)の機構化。/audit_resource_delta コマンドから呼ばれる。
#
# 抽出は grep / go vet / golangci-lint のみ(新規依存なし。golangci-lint 不在時はスキップ案内)。
# アプリコード・設計書は一切変更しない(read-only 監査)。書き込み先は mktemp 領域と、
# go / golangci-lint が使う各キャッシュ(~/.cache/go-build、モジュールキャッシュ、
# ~/.cache/golangci-lint)のみ(いずれもリポジトリ外)。
#
# 使い方: bash scripts/audit-resource-scan.sh [<比較基点コミット>]
#   引数を与えると冒頭に差分ファイル一覧(ランブック §1 の差分範囲確定)も出力する。
#   環境変数 AUDIT_SKIP_PRAGMA=1 で PRAGMA 実証テスト(要 go toolchain・約30秒)を省略。
#   終了コード: 常に 0(情報提供目的。判定はレポート本文と COUNTS ブロックで行う)
#
# 出力の読み方:
#   各節に生ヒットを列挙し、末尾の「== COUNTS ==」ブロックに突合用の件数を出す。
#   件数はランブック §3 ベースライン表と突合すること(比較・判定はコマンド側の仕事)。
#   COUNTS の -1 は「未実行/スキップ/実行失敗」を意味する(レポートに理由を申告すること。
#   0 と -1 は必ず区別する: 0=検査してヒットなし、-1=検査できていない)。
set -euo pipefail

# bash 4+ 必須(連想配列)。macOS 標準 /bin/bash は 3.2 のため明示ガードする。
if [ -z "${BASH_VERSINFO:-}" ] || [ "${BASH_VERSINFO[0]}" -lt 4 ]; then
  echo "ERROR: bash 4 以上が必要です(macOS 標準 bash 3.2 は不可。brew install bash 等で導入し、そちらで実行してください)" >&2
  exit 1
fi

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

BASE="${1:-}"
declare -A COUNTS

HAVE_GO=1
command -v go >/dev/null 2>&1 || HAVE_GO=0

ERRF="$(mktemp)"
TMPDIR_PRAGMA=""
cleanup() {
  rm -f "$ERRF"
  if [ -n "$TMPDIR_PRAGMA" ]; then rm -rf "$TMPDIR_PRAGMA"; fi
}
trap cleanup EXIT

section() { printf '\n== %s ==\n' "$1"; }

# scan <key> <説明> <bash -c で実行するパイプライン>
# ヒット行を表示し COUNTS[key] に件数を記録する。
# 内側 bash に pipefail を課し、grep の終了コードで 3 状態を区別する:
#   0 = ヒットあり / 1 = ヒットなし(正常。COUNTS=件数 or 0)/ 2 以上 = 実行失敗(COUNTS=-1)。
# 「スキャン自体の故障」が「クリーン(0 件)」に化ける偽陰性を防ぐため、
# stderr は握りつぶさず失敗時に表示する。
scan() {
  local key="$1" desc="$2" cmd="$3" out rc=0
  section "$desc [$key]"
  out="$(bash -c "set -o pipefail; $cmd" 2>"$ERRF")" || rc=$?
  if [ "$rc" -ge 2 ]; then
    echo "ERROR: スキャン実行に失敗しました(COUNTS=-1。パス・パターンを確認すること)"
    sed 's/^/  stderr: /' "$ERRF" || true
    COUNTS[$key]="-1"
    return 0
  fi
  if [ -n "$out" ]; then printf '%s\n' "$out"; else echo "(該当なし)"; fi
  COUNTS[$key]="$(printf '%s' "$out" | grep -c . || true)"
}

# ---------------------------------------------------------------------------
# §0 差分範囲(引数があるときのみ)
# ---------------------------------------------------------------------------
if [ -n "$BASE" ]; then
  section "差分ファイル一覧(${BASE}..HEAD)"
  git diff --name-only "$BASE"..HEAD -- '*.go' 'web/src' 'migrations' || true
fi

# ---------------------------------------------------------------------------
# §A ディスク膨張
# ---------------------------------------------------------------------------
# 注: grep は ERE(-E)で統一する(BRE の \| 交替は GNU 拡張で、BSD grep で
#     パターン後半が丸ごと取りこぼされる偽陰性になり得るため)。
scan tempfiles "一時ファイル書き込み(本番)" \
  "grep -rnE 'os.TempDir|os.CreateTemp|os.MkdirTemp|ioutil.Temp' --include='*.go' . | grep -v _test.go"
# os.Create は「os.Create(」で照合する(os.CreateTemp を tempfiles と二重計上しないため。
# ランブック §2-A も同表記に同期済み)。
scan file_writes "ファイル書き込み(本番。config 書き戻し2実装+seedgen が既知)" \
  "grep -rnE 'os.WriteFile|os.Create\(|os.OpenFile' --include='*.go' internal cmd | grep -v _test"
scan log_rotation_cfg "ログローテーション設定の存在(0 になったら異常)" \
  "grep -nE 'MaxSize|MaxBackups|MaxAge' internal/infra/log/log.go internal/config/config.go"
# migrations/ は SQL のため *.sql も対象に含める(*.go だけだと 1 ファイルも検査されない)。
scan vacuum "checkpoint/VACUUM の新設(migrations の SQL 含む)" \
  "grep -rnE 'wal_checkpoint|VACUUM|auto_vacuum' --include='*.go' --include='*.sql' internal cmd migrations | grep -v _test"

# ---------------------------------------------------------------------------
# §B リーク
# ---------------------------------------------------------------------------
# 注: 'go func' は無名関数起動のみ検出する。'go namedFunc()' 形式は取りこぼす
#     (ランブック §2-B の既知の限界。差分精読側でカバーする)。
scan go_func "goroutine(本番)" \
  "grep -rn 'go func' --include='*.go' internal cmd | grep -v _test.go"
scan timers "タイマー・定期処理(本番)" \
  "grep -rnE 'time.NewTicker|time.NewTimer|time.After|time.Sleep|time.Tick' --include='*.go' internal cmd | grep -v _test.go"
scan list_all "全件ロード系 API(repository)" \
  "grep -rn 'func.*ListAll' --include='*.go' internal/repository | grep -v _test"
scan limit_lines "一覧クエリの LIMIT 行数(減少=無制限一覧クエリ新設の疑い)" \
  "grep -rn 'LIMIT' --include='*.go' internal/repository | grep -v _test"

# ---------------------------------------------------------------------------
# §C 資源競合
# ---------------------------------------------------------------------------
scan pool_cfg "DB 接続プール設定(本番。0 = R-1 未是正)" \
  "grep -rnE 'SetMaxOpenConns|SetMaxIdleConns|SetConnMaxLifetime' --include='*.go' internal cmd | grep -v _test"
scan pragma_route "PRAGMA 適用経路(db.go。DSN 化されたか)" \
  "grep -nE 'PRAGMA|_pragma' internal/infra/db/db.go"
scan http_limits "HTTP タイムアウト/BodyLimit(0 = M-1 未是正)" \
  "grep -rnE 'ReadTimeout|ReadHeaderTimeout|WriteTimeout|IdleTimeout|BodyLimit' --include='*.go' internal cmd | grep -v _test"
# 注: レシーバ名 r 固定・-A 12 行の射程はランブック §2-C 由来の既知の限界。
scan nested_query "rows 反復中の入れ子クエリ疑い(1 = M-2 既知)" \
  "grep -rn -A 12 'for rows.Next()' --include='*.go' internal/repository | grep -E 'r\.(Find|List|Get|Count)' | grep -v _test"

# ---------------------------------------------------------------------------
# §E フロントエンド
# ---------------------------------------------------------------------------
FE_EXCL='\.test\.|__tests__'
scan fe_interval "setInterval(0 以外は即指摘)" \
  "grep -rn 'setInterval' web/src --include='*.ts' --include='*.tsx' | grep -vE '$FE_EXCL'"
scan fe_timers "setTimeout / rAF(cleanup 有無はコマンド側で精読)" \
  "grep -rnE 'setTimeout|requestAnimationFrame' web/src --include='*.ts' --include='*.tsx' | grep -vE '$FE_EXCL'"
scan fe_polling "refetchInterval(0 以外は即指摘)" \
  "grep -rn 'refetchInterval' web/src"
scan fe_listener_add "addEventListener" \
  "grep -rn 'addEventListener' web/src --include='*.ts' --include='*.tsx' | grep -vE '$FE_EXCL'"
scan fe_listener_remove "removeEventListener" \
  "grep -rn 'removeEventListener' web/src --include='*.ts' --include='*.tsx' | grep -vE '$FE_EXCL'"
scan fe_storage "ストレージ書き込み(browser-storage.ts 以外。新キーは CLAUDE.md §10.X と突合)" \
  "grep -rnE 'localStorage|sessionStorage|createLocalStorageHelper|createSessionStorageHelper' web/src --include='*.ts' --include='*.tsx' | grep -vE '$FE_EXCL' | grep -v browser-storage.ts"
scan fe_realtime "常時通信(WebSocket 等)" \
  "grep -rnE 'WebSocket|EventSource|new Worker|BroadcastChannel' web/src --include='*.ts' --include='*.tsx' | grep -vE '$FE_EXCL'"
section "QueryClient 設定(defaultOptions が入ったら M-4 解消)"
grep -n -A 8 "new QueryClient" web/src/main.tsx || echo "(new QueryClient が見つからない)"

# ---------------------------------------------------------------------------
# §5 静的解析
# ---------------------------------------------------------------------------
section "go vet"
if [ "$HAVE_GO" -eq 0 ]; then
  echo "SKIP: go コマンドが見つかりません(COUNTS=-1)"
  COUNTS[go_vet]="-1"
else
  VET_RC=0
  VET_OUT="$(go vet ./... 2>&1)" || VET_RC=$?
  if [ -n "$VET_OUT" ]; then printf '%s\n' "$VET_OUT"; else echo "(指摘なし)"; fi
  VET_HITS="$(printf '%s' "$VET_OUT" | grep -c '\.go:' || true)"
  if [ "$VET_RC" -ne 0 ] && [ "$VET_HITS" -eq 0 ]; then
    # 失敗したのに指摘行が無い = vet 自体が走れていない(コンパイル不能・環境不備等)。
    echo "ERROR: go vet が正常終了せず指摘行も無いため、未実行として扱います(COUNTS=-1)"
    COUNTS[go_vet]="-1"
  else
    COUNTS[go_vet]="$VET_HITS"
  fi
fi

section "golangci-lint(errcheck/rowserrcheck/bodyclose/sqlclosecheck/noctx/staticcheck)"
GCL=""
[ -x "$HOME/go/bin/golangci-lint" ] && GCL="$HOME/go/bin/golangci-lint"
[ -z "$GCL" ] && command -v golangci-lint >/dev/null 2>&1 && GCL="$(command -v golangci-lint)"
if [ -z "$GCL" ]; then
  echo "SKIP: golangci-lint が見つかりません(COUNTS=-1)。導入手順(ランブック §5):"
  echo "  GOTOOLCHAIN=go\$(go env GOVERSION | tr -d 'go') go install github.com/golangci/golangci-lint/v2/cmd/golangci-lint@latest"
  COUNTS[lint_prod]="-1"
else
  # --max-issues-per-linter 0 / --max-same-issues 0 は必須。既定(同一メッセージ 3 件・
  # リンタあたり 50 件)のままだと指摘の大半が切り捨てられ、しかもどの指摘が残るかが
  # 非決定的で COUNTS が実行毎に揺れる(クリーンルームレビュー 高-1)。
  LINT_RC=0
  LINT_OUT="$("$GCL" run --no-config --default=none \
    -E errcheck,rowserrcheck,bodyclose,sqlclosecheck,noctx,staticcheck \
    --max-issues-per-linter 0 --max-same-issues 0 \
    --timeout 10m ./... 2>&1)" || LINT_RC=$?
  # 判定は bash のパターンマッチで行う(printf | grep -q は pipefail 下で grep の
  # 早期終了→printf 側 SIGPIPE により偽陽性の失敗判定になるため使わない)。
  if [[ "$LINT_OUT" == *"lower than the targeted Go version"* ]]; then
    echo "SKIP: golangci-lint のビルド Go バージョンが古く実行不能(COUNTS=-1)。ランブック §5 の手順で再ビルドが必要:"
    echo "  GOTOOLCHAIN=go\$(go env GOVERSION | tr -d 'go') go install github.com/golangci/golangci-lint/v2/cmd/golangci-lint@latest"
    COUNTS[lint_prod]="-1"
  elif [ "$LINT_RC" -ne 0 ] && [[ "$LINT_OUT" != *".go:"* ]]; then
    # 指摘検出時の正常な非 0 終了(rc=1・指摘行あり)ではなく、実行自体の失敗。
    echo "ERROR: golangci-lint が実行失敗しました(COUNTS=-1)。生出力:"
    printf '%s\n' "$LINT_OUT" | sed 's/^/  /'
    COUNTS[lint_prod]="-1"
  else
    LINT_PROD="$(printf '%s\n' "$LINT_OUT" | grep -E '^[a-z].*\.go:' | grep -v _test.go || true)"
    if [ -n "$LINT_PROD" ]; then printf '%s\n' "$LINT_PROD"; else echo "(本番コードへの指摘なし)"; fi
    COUNTS[lint_prod]="$(printf '%s' "$LINT_PROD" | grep -c . || true)"
  fi
fi

# ---------------------------------------------------------------------------
# §4 PRAGMA 実証テスト(AUDIT_SKIP_PRAGMA=1 で省略)
# ---------------------------------------------------------------------------
section "PRAGMA 実証テスト(プール接続の実効値)"
if [ "${AUDIT_SKIP_PRAGMA:-0}" = "1" ]; then
  echo "SKIP: AUDIT_SKIP_PRAGMA=1"
  COUNTS[pragma_fk_off]="-1"
elif [ "$HAVE_GO" -eq 0 ]; then
  echo "SKIP: go コマンドが見つかりません(COUNTS=-1)"
  COUNTS[pragma_fk_off]="-1"
else
  TMPDIR_PRAGMA="$(mktemp -d)"
  SQLITE_VER="$(go list -m -f '{{.Version}}' modernc.org/sqlite 2>/dev/null || true)"
  cat > "$TMPDIR_PRAGMA/main_test.go" <<'EOF'
package pragmacheck

import (
	"database/sql"
	"fmt"
	"testing"

	_ "modernc.org/sqlite"
)

// internal/infra/db/db.go の Open と同一手順を再現し、プール各接続の PRAGMA 実効値を観測する。
// 【重要】db.go の接続方法・PRAGMA 適用方法が変わったら、本スクリプト内のこの複製も更新すること
// (本スクリプト冒頭の pragma_route 節の出力と見比べて乖離していないか確認する)。
func TestPragmaPerConnection(t *testing.T) {
	path := t.TempDir() + "/x.db"
	conn, err := sql.Open("sqlite", path)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()
	for _, p := range []string{
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
EOF
  PRAGMA_OUT=""
  if (
    cd "$TMPDIR_PRAGMA" &&
    go mod init pragmacheck >/dev/null 2>&1 &&
    { [ -z "$SQLITE_VER" ] || go mod edit -require="modernc.org/sqlite@$SQLITE_VER"; } &&
    go mod tidy >/dev/null 2>&1
  ); then
    PRAGMA_OUT="$(cd "$TMPDIR_PRAGMA" && go test -run TestPragmaPerConnection -v . 2>&1 | grep '^conn\[' || true)"
  fi
  if [ -n "$PRAGMA_OUT" ]; then
    printf '%s\n' "$PRAGMA_OUT"
    COUNTS[pragma_fk_off]="$(printf '%s\n' "$PRAGMA_OUT" | grep -c 'foreign_keys=0' || true)"
  else
    echo "SKIP: 実行できませんでした(go toolchain / モジュール解決を確認。手動手順はランブック §4)(COUNTS=-1)"
    COUNTS[pragma_fk_off]="-1"
  fi
fi

# ---------------------------------------------------------------------------
# COUNTS(ランブック §3 ベースライン表との突合用。-1 = 未実行/スキップ/実行失敗)
# ---------------------------------------------------------------------------
section "COUNTS(ベースライン突合用)"
for key in tempfiles file_writes log_rotation_cfg vacuum go_func timers list_all limit_lines \
           pool_cfg pragma_route http_limits nested_query \
           fe_interval fe_timers fe_polling fe_listener_add fe_listener_remove \
           fe_storage fe_realtime go_vet lint_prod pragma_fk_off; do
  echo "${key}=${COUNTS[$key]:-?}"
done

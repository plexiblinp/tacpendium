#!/usr/bin/env bash
# =============================================================================
# アプリビルド前 サプライチェーン安全確認(ローカル・AI不要)
#
# アプリ(Go バックエンド + フロントエンド)をビルドする前に、同梱される依存
# パッケージの「整合性」と「既知の脆弱性(CVE)」をローカルで検査し、
# SAFE / CAUTION / WAIT の総合判定を返す。トークンは消費しない。
#
# 既存の scripts/devcontainer-supplychain-prompt.sh は「devContainer の開発
# ツールチェーン」を対象に AI(Perplexity)で *速報的* な侵害を調べるもの。
# 本スクリプトはそれと対をなし、「アプリ自身の依存(go.mod / pnpm-lock)」を
# 対象に *既知 CVE と改ざん* を *決定論的に* 検査する。両者は補完関係にある。
#   - 本スクリプトが見ない領域: 公開直後でまだ脆弱性 DB 未登録の悪性パッケージ
#     (= 速報的侵害)。そこまで確認したい場合は AI プロンプト版を併用すること。
#
# 使い方:
#   bash scripts/app-build-supplychain-check.sh
#
# オプション(環境変数):
#   APP_CHECK_FAIL_LEVEL  WAIT に落とす最低深刻度。high(既定)|critical|moderate
#   APP_CHECK_GO_VULN=1   Go の CVE 検査(govulncheck)を実行する。
#                         未インストール時は `go run ...@latest` で取得実行する。
#                         ※ govulncheck は vuln.go.dev へ接続するため、devContainer
#                           の init-firewall.sh の許可ドメインに "vuln.go.dev" の
#                           追加が必要(未追加だと SKIP 扱いになる)。
#
# 終了コード:
#   0 = SAFE または CAUTION(ビルド続行可。CAUTION は警告付き)
#   2 = WAIT(ビルド前に対応を推奨)
#   1 = 実行エラー(前提コマンド欠如・リポジトリ外 等)
# =============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

FAIL_LEVEL="${APP_CHECK_FAIL_LEVEL:-high}"

# --- 判定レベル管理(最も重い結果を保持) --------------------------------------
# 0=SAFE 1=CAUTION 2=WAIT
WORST=0
escalate() { # $1: 目標レベル
    (( $1 > WORST )) && WORST=$1
    return 0
}

section() { printf '\n=== %s ===\n' "$1"; }
note()    { printf '  %s\n' "$1"; }

# fail_level を数値化(critical=2 相当 / high=2 / moderate=1)。WAIT 閾値の判定に使う。
case "${FAIL_LEVEL}" in
    critical) FAIL_HIGH=0; FAIL_CRIT=1; FAIL_MOD=0 ;;  # critical のみ WAIT
    moderate) FAIL_HIGH=1; FAIL_CRIT=1; FAIL_MOD=1 ;;  # moderate 以上 WAIT
    high|*)   FAIL_HIGH=1; FAIL_CRIT=1; FAIL_MOD=0 ;;  # high 以上 WAIT(既定)
esac

printf 'アプリビルド前 サプライチェーン安全確認  (%s)\n' "$(date +%Y-%m-%d\ %H:%M)"
note "WAIT 閾値: ${FAIL_LEVEL} 以上"

# =============================================================================
# 1. Go 依存の整合性(オフライン・改ざん検知)
# =============================================================================
section "1. Go 依存の整合性 (go mod verify)"
if [[ ! -f go.mod ]]; then
    note "go.mod が見つかりません。リポジトリルートで実行してください。" >&2
    exit 1
fi
if verify_out="$(go mod verify 2>&1)"; then
    note "OK: ${verify_out}"
else
    note "失敗: モジュールキャッシュが go.sum と一致しません(改ざん/破損の疑い)"
    printf '%s\n' "${verify_out}" | sed 's/^/    /'
    escalate 2
fi

# =============================================================================
# 2. Go 既知脆弱性(govulncheck・既定 SKIP / オプトイン)
# =============================================================================
section "2. Go 既知脆弱性 (govulncheck)"
run_govuln() {
    local out rc
    out="$("$@" ./... 2>&1)"; rc=$?
    printf '%s\n' "${out}" | sed 's/^/    /' | tail -25
    if grep -q "No vulnerabilities found" <<<"${out}"; then
        note "OK: 既知脆弱性なし"
    elif (( rc == 0 )); then
        note "OK(脆弱性の報告なし)"
    elif grep -qE "Vulnerability #|=== Symbol Results" <<<"${out}"; then
        note "脆弱性を検出しました。上記を確認してください。"
        escalate 2
    else
        note "実行エラー(ネットワーク/FW で vuln.go.dev に到達できない可能性)→ SKIP"
        escalate 1
    fi
}
if command -v govulncheck >/dev/null 2>&1; then
    run_govuln govulncheck
elif [[ "${APP_CHECK_GO_VULN:-0}" == "1" ]]; then
    note "govulncheck 未インストール → go run で取得実行します(時間がかかります)"
    run_govuln go run golang.org/x/vuln/cmd/govulncheck@latest
else
    note "SKIP: govulncheck 未インストール。Go の CVE 検査は実行していません。"
    note "有効化するには: APP_CHECK_GO_VULN=1 を付けて再実行(要 vuln.go.dev の FW 許可)。"
    note "  例) APP_CHECK_GO_VULN=1 bash scripts/app-build-supplychain-check.sh"
    escalate 1
fi

# =============================================================================
# 3. フロント依存 既知脆弱性(pnpm audit)
# =============================================================================
section "3. フロント依存 既知脆弱性 (pnpm audit)"
if [[ ! -f web/package.json ]]; then
    note "SKIP: web/package.json が見つかりません。"
    escalate 1
elif ! command -v pnpm >/dev/null 2>&1; then
    note "SKIP: pnpm が見つかりません。"
    escalate 1
else
    audit_out="$(cd web && pnpm audit 2>&1)"
    if grep -qiE "No known vulnerabilities found" <<<"${audit_out}"; then
        note "OK: 既知脆弱性なし"
    else
        sev_line="$(grep -iE '^Severity:' <<<"${audit_out}" | tail -1)"
        extract() { grep -oiE "[0-9]+ $1" <<<"${sev_line}" | grep -oE '^[0-9]+' || echo 0; }
        low="$(extract low)";       low="${low:-0}"
        mod="$(extract moderate)";  mod="${mod:-0}"
        high="$(extract high)";     high="${high:-0}"
        crit="$(extract critical)"; crit="${crit:-0}"
        note "検出: critical=${crit} high=${high} moderate=${mod} low=${low}"
        note "詳細は: (cd web && pnpm audit) / 個別調査は pnpm why <pkg>"

        if (( crit > 0 )) && (( FAIL_CRIT == 1 )); then escalate 2
        elif (( high > 0 )) && (( FAIL_HIGH == 1 )); then escalate 2
        elif (( mod > 0 )) && (( FAIL_MOD == 1 )); then escalate 2
        elif (( crit > 0 || high > 0 || mod > 0 )); then escalate 1
        elif (( low > 0 )); then escalate 1
        fi
    fi
fi

# =============================================================================
# 総合判定
# =============================================================================
section "総合判定"
case "${WORST}" in
    0) verdict="SAFE";    msg="既知の問題は検出されませんでした。ビルドして問題ありません。" ;;
    1) verdict="CAUTION"; msg="軽微な指摘またはスキップした検査があります。内容を確認の上で判断してください。" ;;
    2) verdict="WAIT";    msg="閾値(${FAIL_LEVEL})以上の脆弱性または整合性の問題があります。ビルド前の対応を推奨します。" ;;
esac
printf '%s\n' "${verdict}"
note "${msg}"
note "※ 本チェックは「既知 CVE + 整合性」の確認です。公開直後の速報的な侵害までは"
note "  カバーしません。必要なら AI プロンプト版の併用を検討してください。"

case "${WORST}" in
    2) exit 2 ;;
    *) exit 0 ;;
esac

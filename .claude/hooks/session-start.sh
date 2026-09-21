#!/usr/bin/env bash
# session-start.sh — SessionStart フック(IMPROVE-01・2026-08-19 新設)
#
# 目的: クリーンなクローン直後でも、人手の前準備なしに検査とテストが回る状態を作る。
#   1. markdown-it-py  … scripts/check-md-emphasis.sh の前提。無いと check-artifact-integrity.sh が 1 本目で赤
#   2. govulncheck     … /app_build_check の Go CVE 検査
#   3. web/node_modules … make e2e / pnpm test / post-edit-check.sh の tsc / stop-test.sh
#
# ★直すのは環境であって検査ではない。検査スクリプトは 1 行も緩めていない(IMPROVE-01 §1.3)。
#
# ★★本スクリプトは絶対にセッションを止めないこと(IMPROVE-01 §4.2-2)。
#   - `set -e` は使わない。1 つの失敗で残りのステップが飛ぶのを防ぐため。
#   - 各ステップの失敗は警告 1 行に留め、末尾で無条件に exit 0 する。
#   - 環境整備が転けたせいで作業ができなくなるのが最悪である。
#
# ★冪等であること(同 §4.2-1)。既に入っているものは触らない ⇒ 2 回目以降は無音で即終了する。
#
# ★出力はすべて stderr へ出す(同 §4.2-3)。SessionStart の stdout は Claude の文脈へ注入されるため、
#   毎セッション数行が積まれると本当に見るべき出力が埋もれる。何もしなければ 1 バイトも出さない。
#
# ★設計卓の武装セッション対策: scripts/design-desk-arm.sh は sparse-checkout で
#   ALLOWED_ROOTS=(docs .claude scripts) 以外を作業ツリーから物理排除する。⇒ web/ が存在しない。
#   3 番目は web/package.json の存在を先に見るため、武装中は丸ごと no-op になる。
#
# 復旧: 本フックを止めるには .claude/settings.json の "SessionStart" ブロックを削除する。
#       それでも直らなければ本ファイルごと削除する。詳細は docs/progress/improve-01-completion-report.md。
#
# 自己検査は不要: check-artifact-integrity.sh の走査対象は scripts/check-*.sh と名指しの 3 本のみで、
#   本ファイルは含まれない(同 :259-265)。

set -uo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"

warn() { printf 'session-start: %s\n' "$*" >&2; }

# 各ステップの上限。1 ステップのハングが他のステップを巻き添えにしないため。
#
# ★配分は settings.json の hook timeout と整合させること(2026-08-19 レビュー指摘 低-3)。
#   3 ステップの上限の合計 120 + 240 + 240 = 600 秒 ＜ hook timeout 660 秒。
#   ⇒ **最悪ケースでも、ハーネスに強制終了される前に自前の上限で打ち切って exit 0 できる。**
#   (実測の cold path は 31 秒。上限は病的なケースの保険であって想定値ではない)
run_capped() {
  local secs="$1"; shift
  if command -v timeout >/dev/null 2>&1; then
    timeout "$secs" "$@"
  else
    "$@"
  fi
}

# ---------------------------------------------------------------------------
# 1. markdown-it-py
#
# ★版を固定していない理由(2026-08-19 レビュー指摘 中-3)。
#   govulncheck は版を固定し(v1.1.4)、pnpm は --frozen-lockfile を使うのに、ここだけ非対称である。
#   固定しないのは **devContainer 側と揃えるため**——あちらは apt の python3-markdown-it
#   (`.devcontainer/Dockerfile:58`)であり、**apt も版を指定していない**。
#   ここで pip 側だけ固定すると、かえって両環境で版がずれる。
#   ⇒ 揃えるべき相手が「固定していない」ので、こちらも固定しない。
#   なお用途は CommonMark の描画結果を読むだけで、markdown-it-py の API 依存は最小である
#   (`scripts/check-md-emphasis.sh:89-95` の `MarkdownIt("commonmark")` と token 走査のみ)。
# ---------------------------------------------------------------------------
ensure_markdown_it() {
  command -v python3 >/dev/null 2>&1 || return 0
  python3 -c 'import markdown_it' >/dev/null 2>&1 && return 0

  local out
  if out="$(run_capped 120 python3 -m pip install --user --quiet --disable-pip-version-check \
              markdown-it-py 2>&1)"; then
    warn "installed markdown-it-py (scripts/check-md-emphasis.sh の前提)"
  else
    warn "WARN: markdown-it-py を導入できませんでした。check-md-emphasis.sh は「未実行」を返します。"
    warn "      Debian 系(PEP 668)では apt の python3-markdown-it を使ってください。"
    printf '%s\n' "$out" | tail -3 >&2
  fi
}

# ---------------------------------------------------------------------------
# 2. govulncheck
#    ★devContainer(.devcontainer/Dockerfile:129-135)と同じ版に固定する。
# ---------------------------------------------------------------------------
GOVULNCHECK_VERSION="v1.1.4"

# 入れても PATH に無ければ command -v が拾えない ⇒ PATH 上の候補を優先して選ぶ。
#
# ★GOPATH が空のときに "/bin" を返さないこと(2026-08-19 レビュー指摘 中-1)。
#   素朴に "$(go env GOPATH)/bin" と書くと、GOPATH が空文字のとき **/bin** になる。
#   本フックは root で走ることがあり(クラウド実行環境)、その場合 GOBIN=/bin で
#   `go install` が**成功してしまう**。${gopath:+…} で空のときは候補ごと落とす。
pick_go_bindir() {
  local d gopath
  gopath="$(go env GOPATH 2>/dev/null)"
  for d in "${GOBIN:-}" "$HOME/.local/bin" "${gopath:+$gopath/bin}"; do
    [ -n "$d" ] || continue
    case ":${PATH}:" in *":$d:"*) printf '%s' "$d"; return 0 ;; esac
  done
  # PATH 上に候補が無い場合は Go の既定へ入れ、セッションの PATH へ足す。
  # GOPATH も取れないなら何も返さない(呼び出し側が空で return する)。
  [ -n "$gopath" ] && printf '%s' "$gopath/bin"
}

ensure_govulncheck() {
  command -v go >/dev/null 2>&1 || return 0
  command -v govulncheck >/dev/null 2>&1 && return 0

  local bindir out
  bindir="$(pick_go_bindir)"
  [ -n "$bindir" ] || return 0

  # ★★GOTOOLCHAIN をプロジェクトの Go 版へ固定する(2026-08-19 実測で判明・IMPROVE-01)。
  #   `go install pkg@version` は **govulncheck 自身の go.mod** からツールチェーンを決めるため、
  #   素の go が古い環境では古いツールチェーンで govulncheck がビルドされる。
  #   すると解析時に型検査が本体コードを読めず、こう落ちる:
  #     internal/api/user/doc.go:9:1: package requires newer Go version go1.26 (application built with go1.24)
  #   ★これは app-build-supplychain-check.sh:92 の分岐で
  #   「実行エラー(ネットワーク/FW で vuln.go.dev に到達できない可能性)→ SKIP」と表示される。
  #   ⇒ **ネットワークのせいに見えるが実体はビルド版ずれである。** 実測: クラウド実行環境の素の go は
  #   go1.24.7 で、go1.26.4 は go.mod 由来の toolchain 自動取得でのみ現れる。
  #   devContainer は素の go が 1.26.x のため従来から正しくビルドされており、本指定は無害
  #   (同じ版が選ばれるだけ)。
  local gotc
  gotc="$(cd "$ROOT" 2>/dev/null && go env GOVERSION 2>/dev/null)"
  if out="$(run_capped 240 env GOTOOLCHAIN="${gotc:-auto}" GOBIN="$bindir" \
              go install "golang.org/x/vuln/cmd/govulncheck@${GOVULNCHECK_VERSION}" 2>&1)"; then
    warn "installed govulncheck ${GOVULNCHECK_VERSION} -> ${bindir}"
    # ★PATH へ載せられなかったときは黙らないこと(2026-08-19 レビュー指摘 中-2)。
    #   export は本プロセス限りで、CLAUDE_ENV_FILE が無ければセッションへ引き継がれない。
    #   その場合「installed」と出たのに command -v が拾えず、**毎セッション入れ直す**
    #   (＝冪等性が破れる)。沈黙した失敗になるため警告を出す。
    case ":${PATH}:" in
      *":$bindir:"*) ;;
      *)
        export PATH="$bindir:$PATH"
        if [ -n "${CLAUDE_ENV_FILE:-}" ] \
           && printf 'export PATH="%s:$PATH"\n' "$bindir" >>"$CLAUDE_ENV_FILE" 2>/dev/null; then
          :
        else
          warn "WARN: ${bindir} が PATH にありません。このセッション以外では govulncheck が"
          warn "      見つからず、毎回入れ直しになります。PATH へ ${bindir} を追加してください。"
        fi
        ;;
    esac
  else
    warn "WARN: govulncheck を導入できませんでした。/app_build_check の CVE 検査は SKIP されます。"
    printf '%s\n' "$out" | tail -3 >&2
  fi
}

# ---------------------------------------------------------------------------
# 3. web/node_modules
#    ★--frozen-lockfile: pnpm-lock.yaml に差分を出さない(IMPROVE-01 §2.2-4)。
# ---------------------------------------------------------------------------
ensure_node_modules() {
  # ★武装中の設計卓には web/ が無い。ここで抜けるので pnpm は呼ばれない。
  [ -f "$ROOT/web/package.json" ] || return 0
  [ -d "$ROOT/web/node_modules" ] && return 0
  command -v pnpm >/dev/null 2>&1 || { warn "WARN: pnpm が見つかりません。web/node_modules を用意できません。"; return 0; }

  # ★--reporter=silent は付けない。出力は変数に capture しており成功時は 1 バイトも出さないため、
  #   静かさは既に担保されている。silent にすると失敗時のエラー本文まで消えて診断できなくなる。
  local out
  if out="$(cd "$ROOT/web" && run_capped 240 pnpm install --frozen-lockfile 2>&1)"; then
    warn "installed web/node_modules (make e2e / pnpm test の前提)"
  else
    warn "WARN: pnpm install に失敗しました。make e2e / pnpm test は回りません。"
    printf '%s\n' "$out" | tail -5 >&2
  fi
}

ensure_markdown_it
ensure_govulncheck
ensure_node_modules

# ★何があっても 0 で返す。ここを非ゼロにするとセッションが起動しなくなる。
exit 0

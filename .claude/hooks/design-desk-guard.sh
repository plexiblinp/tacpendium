#!/usr/bin/env bash
# design-desk-guard.sh — PreToolUse(Bash) フック: 設計卓の武装中に実装ソースへの回り込みを塞ぐ
#
# 前提: `scripts/design-desk-arm.sh` が sparse-checkout で実装ソースを作業ツリーから
#   物理排除している。その状態では cat / sed / head / tail / grep / rg / find / awk は
#   実装パスに対して**空振りする**(ファイルが存在しないため)。
#   **残る漏れ経路は git のオブジェクト読み出しだけ**であり、それは有限の閉じた集合である。
#   本フックはその集合を塞ぐ。
#
# なぜ「ブロックする verb を列挙」ではなく「安全な verb を許可」なのか:
#   列挙方式は必ず取りこぼす(show / log -p / diff <rev> / grep / blame / cat-file /
#   archive / format-patch / bundle / read-tree / checkout-index ...)。
#   **許可リスト方式なら集合が閉じる。** 過剰ブロックは可視で直せるが、取りこぼしは silent である。
#
# なぜ ask に頼らないのか: Claude Code on the web では**ask が実質機能しない**
#   (2026-07-20 V-2 実測。`.claude/settings.json` の _hooks_comment と
#   `docs/process/remote-ops.md` §6)。クラウドで効くのは deny と本フックだけである。
#   `pre-push-guard.sh` が同じ理由で存在しており、本フックはその第 2 実装にあたる。
#
# 発火条件: `tmp/.design-desk-armed` が存在するときのみ。**通常の製造・レビュー・改善
#   セッションには一切影響しない**(マーカーが無いので即 exit 0)。
#
# 正本: docs/progress/20260811-design-desk-surface-study.md §3.6
set -uo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
MARKER="$ROOT/tmp/.design-desk-armed"
MARKER_NAME=".design-desk-armed"

# 設計卓が読み書きしてよい領域(design-desk-arm.sh の ALLOWED_ROOTS と一致させる)
SCOPE_RE='(docs|\.claude|scripts)'

block() {
  echo "design-desk-guard: ブロックしました。" >&2
  echo "  理由: $1" >&2
  echo "" >&2
  echo "  設計卓は武装中です(scripts/design-desk-arm.sh)。実装ソースは作業ツリーに存在せず、" >&2
  echo "  git のオブジェクト経由での読み出しも塞いでいます。" >&2
  echo "  実装の事実が要るときは docs/handover/code-facts.md を引くか、Explore サブエージェントへ" >&2
  echo "  問うて蒸留された答えだけを受け取ってください(parallel-ops §00「親は蒸留された結論だけを読む」)。" >&2
  echo "  docs/ .claude/ scripts/ を対象にした git 操作は pathspec を付ければ通ります" >&2
  echo "  (例: git log -p -- docs/handover/ ／ git show HEAD:docs/design/03-data-model.md)。" >&2
  exit 2
}

# 与えられたコマンド文字列を判定する。通してよければ return 0、駄目なら block する。
decide() {
  local cmd="$1"

  # (0) 武装マーカーへの干渉
  if printf '%s' "$cmd" | grep -qF "$MARKER_NAME"; then
    block "武装マーカー($MARKER_NAME)に触れようとしています。解除は開発者が自分の端末で行います"
  fi

  # (1) git を含まないコマンドは対象外(物理排除が効いているため)
  if ! printf '%s' "$cmd" | grep -qE '(^|[;&|(`[:space:]])git([[:space:]]|$)'; then
    return 0
  fi

  # pathspec / rev:path のどちらかで許可領域に限定されているか
  local scoped=1
  if printf '%s' "$cmd" | grep -qE "(:|--[[:space:]]+\.?/?)$SCOPE_RE(/|[[:space:]]|$)"; then
    scoped=0
  fi

  # コマンド中に現れる git サブコマンドを全て検査する(複合コマンド対策)
  local verb
  while read -r verb; do
    [ -z "$verb" ] && continue
    case "$verb" in
      # --- 内容を出さない: 無条件で通す ---
      status|add|commit|branch|remote|rev-parse|ls-files|ls-tree|shortlog|describe|push|init)
        continue ;;

      # --- パッチ指定があるときだけ内容が出る ---
      log)
        if printf '%s' "$cmd" | grep -qE '(^|[[:space:]])(-p|--patch|-U[0-9]+|--unified|-W|--function-context)([[:space:]]|$)'; then
          [ "$scoped" -eq 0 ] || block "git log のパッチ出力が許可領域に限定されていません(-- docs/ 等の pathspec を付けてください)"
        fi
        continue ;;

      # --- リビジョンを指すときだけツリー間 diff になる(作業ツリー diff は sparse で空になる) ---
      diff)
        if printf '%s' "$cmd" | grep -qE '(^|[[:space:]])(HEAD|@|[0-9a-f]{7,40}|origin/[A-Za-z0-9._/-]+|main|master)([~^][0-9^~]*)?([[:space:]]|$)' \
           || printf '%s' "$cmd" | grep -qE '\.\.'; then
          [ "$scoped" -eq 0 ] || block "git diff がリビジョンを参照しており、許可領域に限定されていません(-- docs/ 等の pathspec を付けてください)"
        fi
        continue ;;

      # --- 常に内容を出す: 許可領域への限定が必須 ---
      show|blame|grep)
        [ "$scoped" -eq 0 ] || block "git $verb は内容を出すため、許可領域への限定が必要です(git show HEAD:docs/… ／ git grep … -- docs/)"
        continue ;;

      # --- それ以外の git サブコマンドは全てブロック(許可リスト方式) ---
      *)
        block "武装中に許可されていない git サブコマンドです: git $verb" ;;
    esac
  done < <(printf '%s' "$cmd" | grep -oE '(^|[;&|(`[:space:]])git[[:space:]]+[a-z][a-z-]*' | sed -E 's/.*git[[:space:]]+//')

  return 0
}

self_test() {
  local fail=0
  echo "# design-desk-guard.sh 自己検査"
  echo

  run_case() { # $1=期待(allow|block) $2=コマンド
    local want="$1" cmd="$2" got
    if ( decide "$cmd" ) >/dev/null 2>&1; then got=allow; else got=block; fi
    if [ "$got" = "$want" ]; then
      printf 'OK  %-6s %s\n' "$want" "$cmd"
    else
      printf 'NG  期待=%-6s 実際=%-6s %s\n' "$want" "$got" "$cmd"; fail=1
    fi
  }

  # 通すべきもの(設計卓の通常作業)
  run_case allow 'git status'
  run_case allow 'git add docs/handover/followup-backlog.md'
  run_case allow 'git commit -m "docs: 更新"'
  run_case allow 'git log --oneline -5'
  run_case allow 'git log -p -- docs/handover/'
  run_case allow 'git show HEAD:docs/design/03-data-model.md'
  run_case allow 'git diff'
  run_case allow 'git diff --staged'
  run_case allow 'git diff HEAD~1 HEAD -- docs/'
  run_case allow 'git grep -n "FR-701" -- docs/'
  run_case allow 'cat docs/handover/code-facts.md'
  run_case allow 'bash scripts/check-doc-refs.sh'

  # 塞ぐべきもの(実装ソースへの回り込み)
  run_case block 'git show HEAD:internal/model/combo.go'
  run_case block 'git show HEAD'
  run_case block 'git log -p'
  run_case block 'git diff HEAD~1 HEAD'
  run_case block 'git grep -n "func List"'
  run_case block 'git blame internal/service/combo.go'
  run_case block 'git cat-file -p HEAD'
  run_case block 'git archive HEAD'
  run_case block 'git format-patch -1'
  run_case block 'git bundle create out.bundle HEAD'
  run_case block 'git checkout-index -a'
  run_case block 'git read-tree HEAD'
  run_case block 'git worktree add ../full'
  run_case block 'git sparse-checkout disable'
  run_case block 'git sparse-checkout set docs internal'
  run_case block 'rm tmp/.design-desk-armed'
  run_case block 'git status && git show HEAD:internal/api/routes.go'

  echo
  if [ "$fail" -eq 0 ]; then
    echo "自己検査: 合格(通すべき 12 件・塞ぐべき 17 件の判定が期待どおり)"
  else
    echo "自己検査: **不合格**"
  fi
  return "$fail"
}

if [ "${1:-}" = "--self-test" ]; then
  self_test
  exit $?
fi

# --- 通常経路(PreToolUse から stdin で呼ばれる) ---

# 武装していなければ何もしない
[ -f "$MARKER" ] || exit 0

# 武装しているのに実装ソースが作業ツリーにある = 前提が崩れている
if [ -d "$ROOT/internal" ] || [ -d "$ROOT/web/src" ]; then
  echo "design-desk-guard: 武装マーカーがあるのに実装ソースが作業ツリーに存在します。" >&2
  echo "  物理排除の前提が崩れています。開発者へ報告し、再武装するまで作業を止めてください" >&2
  echo "  (bash scripts/design-desk-arm.sh --status で確認できます)。" >&2
  exit 2
fi

input="$(cat)"
cmd=""
if command -v jq >/dev/null 2>&1; then
  cmd="$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null || true)"
fi
if [ -z "$cmd" ] && command -v python3 >/dev/null 2>&1; then
  cmd="$(printf '%s' "$input" | python3 -c 'import json,sys
try:
    print(json.load(sys.stdin).get("tool_input",{}).get("command",""))
except Exception:
    pass' 2>/dev/null || true)"
fi
# 解析不能時は安全側: 生入力全体を判定対象にする
if [ -z "$cmd" ]; then cmd="$input"; fi

decide "$cmd"
exit 0

#!/usr/bin/env bash
# pre-push-guard.sh — PreToolUse(Bash) フック: git push の実行前ゲート(2026-07-20 追加)
#
# 目的: push を「git push origin claude/<branch>」の単一形のみに機械的に制限する。
#   settings.json の allow/deny はプレフィックス一致のため、refspec 形(HEAD:main)・フラグ並べ替え・
#   複合コマンドで漏れうる。また Claude Code on the web ではパーミッションの都度確認(ask)が
#   実質機能せず、プラットフォームのブランチ制限も「デフォルトブランチ保護」止まりで
#   任意ブランチ(testperm/* 等)への push が通ることを実測済み(2026-07-20 V-2)。
#   本フックはリポジトリからコミット配布されるため devContainer・クラウドの両方で発火する。
# 判定: コマンドに git push を含まなければ許可(exit 0)。含む場合、
#   「git push origin claude/<branch>」(単一ブランチ名・refspec/フラグ/複合コマンドなし)に
#   完全一致するときのみ許可。それ以外は exit 2 でブロック。
# 正本: docs/process/remote-ops.md §6 / CLAUDE.md §7・§10
set -euo pipefail

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

# git push を含まないコマンドは対象外
if ! printf '%s' "$cmd" | grep -qE '(^|[;&|[:space:]])git[[:space:]]+push([[:space:]]|$)'; then
  exit 0
fi

# 許可される唯一の形: git push origin claude/<branch>(前後空白のみ許容)
if printf '%s' "$cmd" | grep -qE '^[[:space:]]*git[[:space:]]+push[[:space:]]+origin[[:space:]]+claude/[A-Za-z0-9._-][A-Za-z0-9._/-]*[[:space:]]*$'; then
  exit 0
fi

echo "pre-push-guard: ブロックしました。許可される push は「git push origin claude/<ブランチ名>」の単一形のみです(refspec 形〔HEAD:xxx〕・フラグ・複合コマンド・claude/ 以外の宛先は不可)。それ以外のリモート反映は開発者が行います(CLAUDE.md §7/§10、docs/process/remote-ops.md §6)。" >&2
exit 2

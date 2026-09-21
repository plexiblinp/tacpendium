#!/usr/bin/env bash
# PostToolUse(Write|Edit|MultiEdit): 変更ファイルへの高速チェック(非ブロック)。
# .go → gofmt -l(非書き換え)+ go vet。 .ts/.tsx → tsc --noEmit(全体型チェック)。
# 指摘があれば additionalContext で Claude に通知。常に exit 0。
# 注: フックはパーミッション層をバイパスして実行される。本スクリプトは読み取り系の
#     検査のみで構成し、ソース改変・git 書込・ネットワークアクセスを行わない
#     (CLAUDE.md §10 の趣旨に整合)。
set -uo pipefail
ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
input="$(cat)"
file="$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')"
[ -z "$file" ] && exit 0
[ ! -f "$file" ] && exit 0

rel="${file#"$ROOT"/}"
findings=""

case "$file" in
  *.go)
    fmt_out="$(gofmt -l "$file" 2>&1)"
    [ -n "$fmt_out" ] && findings+="gofmt: 未フォーマット ($rel)。\`gofmt -w\` 相当の整形が必要。"$'\n'
    pkg="$(dirname "$rel")"
    vet_out="$(cd "$ROOT" && go vet "./$pkg" 2>&1)"
    [ $? -ne 0 ] && findings+="go vet (./$pkg):"$'\n'"$vet_out"$'\n'
    ;;
  */web/*.ts|*/web/*.tsx)
    tsc_out="$(cd "$ROOT/web" && pnpm -s exec tsc --noEmit 2>&1)"
    [ $? -ne 0 ] && findings+="tsc --noEmit(型エラー):"$'\n'"$tsc_out"$'\n'
    ;;
  *)
    exit 0
    ;;
esac

if [ -n "$findings" ]; then
  jq -n --arg ctx "[品質フック] $rel の編集後チェックで指摘:"$'\n'"$findings" \
    '{hookSpecificOutput: {hookEventName: "PostToolUse", additionalContext: $ctx}}'
fi
exit 0

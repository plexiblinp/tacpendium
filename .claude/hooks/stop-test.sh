#!/usr/bin/env bash
# Stop(応答完了時): 差分ゲート付きテスト(非ブロック)。
# 作業ツリーに *.go / web の .ts(x) / migrations の .sql 変更があればその側のスイートを実行。
# migrations 変更で test-go を回すのは、dbtest.Setup が全マイグレを適用するため
# go テストがマイグレーションの実質的な回帰テストになっているから(M9-1/M12-02 教訓)。
# 失敗しても exit 0。失敗時は systemMessage で開発者に警告。
# 注: フックはパーミッション層をバイパスして実行される。本スクリプトは git の読み取り
#     (diff/ls-files)とテスト実行のみで構成し、ソース改変・git 書込・ネットワーク
#     アクセスを行わない(CLAUDE.md §10 の趣旨に整合)。
set -uo pipefail
ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
input="$(cat)"
[ "$(printf '%s' "$input" | jq -r '.stop_hook_active // false')" = "true" ] && exit 0
cd "$ROOT" || exit 0

changed="$( { git diff --name-only HEAD; git ls-files --others --exclude-standard; } 2>/dev/null )"
[ -z "$changed" ] && exit 0

go_changed=0; web_changed=0
printf '%s\n' "$changed" | grep -Eq '\.go$' && go_changed=1
printf '%s\n' "$changed" | grep -Eq '^migrations/.*\.sql$' && go_changed=1
printf '%s\n' "$changed" | grep -Eq '^web/.*\.(ts|tsx)$' && web_changed=1

summary=""
if [ "$go_changed" = 1 ]; then
  out="$(make test-go 2>&1)"; [ $? -ne 0 ] && summary+="go test 失敗:"$'\n'"$(printf '%s' "$out" | tail -n 30)"$'\n'
fi
if [ "$web_changed" = 1 ]; then
  out="$(make test-web 2>&1)"; [ $? -ne 0 ] && summary+="pnpm test 失敗:"$'\n'"$(printf '%s' "$out" | tail -n 30)"$'\n'
fi

if [ -n "$summary" ]; then
  printf '%s\n' "$summary" >&2
  jq -n --arg m "[品質フック] テスト失敗を検知(非ブロック)。詳細はトランスクリプト参照。" \
    '{systemMessage: $m}'
fi
exit 0

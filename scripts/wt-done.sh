#!/usr/bin/env bash
# 注意: 本スクリプトは git 操作を含む。Claude Code ではなく開発者が実行すること。
#
# リポジトリ直下 wt-<name>/ の worktree を除去する。未コミット変更があれば中断する
# (--force で強制除去)。ブランチは安全のため自動削除しない。
#
# 使い方: scripts/wt-done.sh <name> [--force]
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

NAME="${1:-}"
FORCE=""
[[ "${2:-}" == "--force" ]] && FORCE="--force"

if [[ -z "$NAME" ]]; then
  echo "使い方: scripts/wt-done.sh <name> [--force]" >&2
  exit 1
fi

WT="wt-$NAME"
BRANCH="wt/$NAME"

if [[ ! -d "$WT" ]]; then
  echo "エラー: worktree が見つかりません: $WT" >&2
  exit 1
fi

# 安全性の要: $WT が git に「登録済みの worktree」であることを検証する。
# これにより internal / automation-project 等の非 worktree フォルダは
# (たとえ --force や打ち間違いでも)絶対に削除されない。
if ! git worktree list --porcelain | grep -Fxq "worktree $ROOT/$WT"; then
  echo "エラー: $WT は git worktree として登録されていません。安全のため中断します。" >&2
  echo "登録済み worktree 一覧:" >&2
  git worktree list >&2
  exit 1
fi

# 未コミット変更チェック(--force 指定時はスキップ)
if [[ -z "$FORCE" ]] && [[ -n "$(git -C "$WT" status --porcelain)" ]]; then
  echo "エラー: $WT に未コミットの変更があります。確認後に再実行するか、--force を付けてください。" >&2
  git -C "$WT" status --short >&2
  exit 1
fi

git worktree remove $FORCE "$WT"
echo "✅ worktree を除去しました: $WT"
echo "ブランチを削除する場合(マージ済みを確認の上): git branch -d $BRANCH"

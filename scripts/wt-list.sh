#!/usr/bin/env bash
# 注意: 本スクリプトは git 操作を含む。Claude Code ではなく開発者が実行すること。
#
# git worktree 一覧と、各 worktree に割り当てたバックエンドポートを表示する。
#
# 使い方: scripts/wt-list.sh
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

git worktree list

shopt -s nullglob
for cfg in wt-*/config.toml; do
  port="$(awk -F= '/^[[:space:]]*port[[:space:]]*=/{v=$2; gsub(/[^0-9]/,"",v); print v; exit}' "$cfg")"
  echo "  $(dirname "$cfg")  -> backend port ${port:-?}"
done

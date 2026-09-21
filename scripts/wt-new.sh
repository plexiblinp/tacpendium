#!/usr/bin/env bash
# 注意: 本スクリプトは git 操作を含む。Claude Code ではなく開発者が実行すること。
#
# git worktree をリポジトリ直下 wt-<name>/ に作成し、並列作業用に
#   - ユニークなバックエンドポート
#   - worktree ローカルの DB パス
# を設定した config.toml を用意し、フロント依存をインストールする。
#
# 使い方: scripts/wt-new.sh <name> [base-branch]
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

NAME="${1:-}"
BASE="${2:-main}"

if [[ -z "$NAME" ]]; then
  echo "使い方: scripts/wt-new.sh <name> [base-branch]" >&2
  exit 1
fi
if [[ ! "$NAME" =~ ^[A-Za-z0-9._-]+$ ]]; then
  echo "エラー: <name> に使えるのは英数字 . _ - のみです: $NAME" >&2
  exit 1
fi

WT="wt-$NAME"
BRANCH="wt/$NAME"

# 多層防御: 生成先 $WT が既存エントリと衝突するなら拒否(誤上書き防止)。
# worktree は必ず wt- 接頭辞の予約名前空間に置くため、保護フォルダ
# (automation-project 等)やプロジェクト実体(cmd/internal/web 等)とは
# 物理的に衝突しないが、念のため既存の何かと同名なら中断する。
if [[ -e "$WT" ]]; then
  echo "エラー: 既に存在します: $WT" >&2
  exit 1
fi

# worktree 作成(同名ブランチが既存なら再利用、無ければ base から新規作成)
if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  echo "既存ブランチ $BRANCH を worktree に割り当てます"
  git worktree add "$WT" "$BRANCH"
else
  echo "ブランチ $BRANCH を $BASE から作成して worktree を追加します"
  git worktree add "$WT" -b "$BRANCH" "$BASE"
fi

# ポート割当: 既存 worktree の config.toml と重複しない値を 47330 から探索
shopt -s nullglob
cfgs=(wt-*/config.toml)
shopt -u nullglob
USED=""
if (( ${#cfgs[@]} )); then
  USED="$(awk -F= '/^[[:space:]]*port[[:space:]]*=/{v=$2; gsub(/[^0-9]/,"",v); if(v!="") print v}' "${cfgs[@]}")"
fi
PORT=47330
while printf '%s\n' "$USED" | grep -qx "$PORT"; do
  PORT=$((PORT + 1))
done
VITEPORT=$((5174 + PORT - 47330))

# config.toml 生成: ルート config.toml(無ければ example)をコピーし port と database.path を上書き
SRC="config.toml"
[[ -f "$SRC" ]] || SRC="config.toml.example"
cp "$SRC" "$WT/config.toml"
# [server].port を差し替え(config.toml で port= を持つのは [server] のみ)
sed -i -E "s|^([[:space:]]*)port[[:space:]]*=.*|\1port = $PORT|" "$WT/config.toml"
# [database].path を worktree ローカル相対パスに(path= を持つのは [database] のみ。logging は file=)
sed -i -E "s|^([[:space:]]*)path[[:space:]]*=.*|\1path = \"./tacpendium-dev.db\"|" "$WT/config.toml"

# フロント依存をインストール
echo "pnpm install (web) ..."
( cd "$WT/web" && pnpm install )

cat <<EOF

✅ worktree を作成しました: $WT  (branch: $BRANCH)
   backend port: $PORT   vite port: $VITEPORT   DB: $WT/tacpendium-dev.db

次の手順:
  cd $WT && claude
  # バックエンド: make run-server                       (ポート $PORT)
  # フロント:     cd web && pnpm dev --port $VITEPORT   (proxy は config.toml の $PORT を自動追従)
EOF

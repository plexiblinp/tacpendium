#!/usr/bin/env bash
# 使い捨て(スクラッチ)DB で dev バックエンド (go run ./cmd/tacpendium) を起動する。
#
# 背景: 並列ブランチが別々に migration を追加すると、共有 dev DB
#   (~/.local/share/tacpendium/tacpendium.db) の schema_migrations が別ブランチの
#   バージョンまでスタンプされ、こちらのブランチで起動すると
#   "no migration found for version NN" で abort する(ブランチ跨ぎの DB 状態競合)。
#   本スクリプトは TACPENDIUM_DB_PATH でリポジトリ直下の使い捨て DB を指定して起動し、
#   このブランチの migration だけを新規適用する。実 dev DB には一切触れない。
#
# 特徴:
#   - 使い捨て DB 名はブランチ名由来(scratch-<branch>.db)。*.db は .gitignore 済み
#     なのでブランチを汚さない。ブランチ毎に別ファイルなので使い回しても競合しない。
#   - ポートは既定のまま(TACPENDIUM_PORT は設定しない)。バックエンドが採用ポートを
#     config.toml に書き、Vite dev proxy がそれを読んで自動追従するため。
#
# 使い方:
#   scripts/dev-throwaway-db.sh [db-file] [--fresh]
#     db-file : 使い捨て DB のファイル名(既定: scratch-<sanitized-branch>.db)。
#               リポジトリ直下・*.db のみ(ValidateDataPath と gitignore を満たすため)。
#     --fresh : 起動前に既存の使い捨て DB(-wal/-shm 含む)を削除して作り直す。
#
# 別ターミナルでフロント: cd web && pnpm run dev  → http://localhost:5173/
# 後片付け: rm -f <db-file> <db-file>-wal <db-file>-shm
#
# 注: git 操作は行わない。長時間稼働するサーバのため通常は開発者がターミナルで
#     直接実行する(Claude Code に実行させる必然性は無い)。
set -euo pipefail

usage() {
  cat >&2 <<'EOF'
使い方: scripts/dev-throwaway-db.sh [db-file] [--fresh]
  db-file : 使い捨て DB のファイル名(既定: scratch-<branch>.db)。リポジトリ直下・*.db のみ。
  --fresh : 起動前に既存の使い捨て DB(-wal/-shm 含む)を削除して作り直す。
EOF
}

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

DB_FILE=""
FRESH=0
for arg in "$@"; do
  case "$arg" in
    --fresh|-f) FRESH=1 ;;
    -h|--help)  usage; exit 0 ;;
    -*)         echo "エラー: 不明なオプション: $arg" >&2; usage; exit 1 ;;
    *)
      if [[ -n "$DB_FILE" ]]; then
        echo "エラー: 位置引数は db-file の1つのみです: $arg" >&2; exit 1
      fi
      DB_FILE="$arg" ;;
  esac
done

# 既定の使い捨て DB 名: ブランチ名を安全な文字へサニタイズして scratch-<branch>.db。
if [[ -z "$DB_FILE" ]]; then
  BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo detached)"
  SAFE_BRANCH="$(printf '%s' "$BRANCH" | tr -c 'A-Za-z0-9._-' '-')"
  DB_FILE="scratch-${SAFE_BRANCH}.db"
fi

# 検証: リポジトリ直下の単純なファイル名のみ(パス区切り/.. を禁止)。
# ValidateDataPath(cwd 配下・.. 不可)と *.db の gitignore を確実に満たすため。
if [[ "$DB_FILE" == */* || "$DB_FILE" == *".."* ]]; then
  echo "エラー: db-file はリポジトリ直下のファイル名のみ(パス区切り不可): $DB_FILE" >&2; exit 1
fi
if [[ "$DB_FILE" != *.db ]]; then
  echo "エラー: db-file は .db 拡張子にしてください(.gitignore 対象): $DB_FILE" >&2; exit 1
fi

if [[ "$FRESH" -eq 1 ]]; then
  rm -f -- "$DB_FILE" "$DB_FILE-wal" "$DB_FILE-shm"
  echo "[dev-throwaway-db] 使い捨て DB を初期化しました: $DB_FILE"
fi

echo "[dev-throwaway-db] TACPENDIUM_DB_PATH=$DB_FILE で起動(実 dev DB には触れません)"
echo "[dev-throwaway-db] フロントは別ターミナルで: cd web && pnpm run dev  → http://localhost:5173/"
echo "[dev-throwaway-db] 停止は Ctrl-C。後片付け: rm -f $DB_FILE $DB_FILE-wal $DB_FILE-shm"

exec env TACPENDIUM_DB_PATH="$DB_FILE" go run ./cmd/tacpendium

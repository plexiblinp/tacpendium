#!/usr/bin/env bash
# =============================================================================
# devContainer リビルド前 サプライチェーン調査プロンプト生成
#
# devContainer のリビルドが必要になったとき、リビルド前に Perplexity 等で
# 「現在進行中のサプライチェーン攻撃・重大脆弱性が無いか」を調べるための
# 調査プロンプトを生成して標準出力に出す。生成物はそのままコピペして使う。
#
# 使い方:
#   bash scripts/devcontainer-supplychain-prompt.sh
#
# 安全設計（機密を公開サービスへ送らないための制約）:
#   - .devcontainer/Dockerfile から FROM / ARG *_VERSION / npm install -g の
#     whitelist 行のみを抽出する。ファイル全文はダンプしない。
#   - 抽出対象はイメージ名と版情報のみで、APIキー等の機密は構造的に含まれない。
#   - 出力には固有のファイル名・パスを書かない（Perplexity は知らないため）。
#
# 出力言語は日本語。英語に切り替えたい場合は末尾ヒアドキュメントを差し替える。
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCKERFILE="${ROOT}/.devcontainer/Dockerfile"
TODAY="$(date +%Y-%m-%d)"

if [[ ! -f "${DOCKERFILE}" ]]; then
    echo "エラー: Dockerfile が見つかりません: ${DOCKERFILE}" >&2
    exit 1
fi

# --- whitelist 抽出（全文ダンプはしない） ---

# ベースイメージ（FROM の最初の1行）
base_image="$(grep -m1 -E '^FROM ' "${DOCKERFILE}" | awk '{print $2}')"

# ARG *_VERSION=値 → "- NAME = 値"（バージョン変更に自動追従）
versions="$(grep -E '^ARG +[A-Za-z_]+_VERSION=' "${DOCKERFILE}" \
    | sed -E 's/^ARG +([A-Za-z_]+_VERSION)=([^ ]+).*/- \1 = \2/')"

# グローバル npm パッケージ（npm install -g の後ろ）
npm_globals="$(grep -E 'npm +install +-g' "${DOCKERFILE}" \
    | sed -E 's/.*npm +install +-g +//; s/ *\\$//' \
    | sed -E 's/^/- /' || true)"

# --- Perplexity 調査プロンプト生成（コピペ用） ---
cat <<EOF
あなたはシニアなソフトウェアサプライチェーンセキュリティエンジニアです。
私はこれから開発用コンテナをリビルドします。リビルドして安全かどうかを、実行前に確認したいです。

${TODAY} 時点の最新情報で、下記の依存関係について次の3点を調べてください。
1. 最近、悪意のあるバージョンの公開やサプライチェーン侵害が報告されていないか（あれば版番号と日付）
2. 未修正、または実際に悪用されている重大な脆弱性（CVE）がないか
3. 上記の根拠となる情報源（URL）と、その日付

【調査対象の依存スタック】
- ベースOS: Debian 12 (bookworm)
- ベースイメージ: ${base_image}
- Node.js: 22.x (LTS)
${versions}
${npm_globals} (バージョンは latest 指定でインストール)
- golangci-lint は公式インストールスクリプト（curl でダウンロードしてシェル実行）で導入
- その他: Debian bookworm の標準ビルドツール群と、Chromium / Playwright の実行時共有ライブラリ群

【回答のしかた】
- 各項目を簡潔に、箇条書きで答えてください。
- 情報が見つからない項目は「報告なし」と明記してください（推測で埋めないこと）。
- 最後に、リビルドして安全かどうかの総合判定を必ず次のいずれか1語で示し、1行で理由を添えてください。
  SAFE / CAUTION / WAIT
EOF

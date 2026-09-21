#!/usr/bin/env bash
# measure-disk-usage.sh — ディスク使用量の平常時計測(devContainer 内・read-only)
#
# 背景: `environment-reliability-plan.md` §3「ディスク増大」。
#   ディスク使用率 100% 張り付きが一度発生したが、**再現すると固まるため障害時の計測はできない。**
#   §3 が求めているのは障害の再現ではなく **平常時の値と増加速度**である——
#   §3.1 が「**15% という警告値には普遍的根拠がない。残り GB・増加速度・復旧に必要な作業領域を
#   合わせて決める**」と旧案を訂正しており、**閾値を決めるために増加速度が要る**という順序になっている。
#
# 本スクリプトは **devContainer から見える分だけ**を測る。**ホスト側(Windows ドライブ残量・
# Docker disk image・`docker system df`)はコンテナ内から見えない**ため、別途ホストで測る必要がある
# (手順は `docs/process/disk-growth-baseline.md`)。
#
# 使い方:
#   bash scripts/measure-disk-usage.sh            # 人が読む形式
#   bash scripts/measure-disk-usage.sh --tsv      # 追記用の TSV(日付つき・1 行 1 項目)
#
# 2 回以上まわして差分を取ることで「1 日あたりの増加量」が出る。**1 点だけでは閾値を決められない。**
#
# 終了コード: 0=正常 / 2=実行エラー
#
# 限界:
#   - `du -sb` は **GNU 拡張**。BSD/macOS の du には無いため、devContainer 外では
#     バイト数が 0 になる(人が読む側の `-sh` は動く)。CLAUDE.md はホスト OS での流用も
#     想定しているため明記しておく。
set -uo pipefail

MODE="human"
case "${1:-}" in
  --tsv) MODE="tsv" ;;
  "")    ;;
  *) echo "ERROR: 不明な引数: $1" >&2; exit 2 ;;
esac

TODAY="$(date '+%Y-%m-%d')"

# du が失敗しても空文字ではなく "-" を返す(欠測と 0 を区別する)。
#
# ★2026-08-11 クリーンルームレビュー 中 15 の是正。
#   `du` は読めないサブディレクトリがあっても **合計を stdout に出しつつ exit 1** する。
#   `set -o pipefail` 下ではパイプライン全体が 1 になるため、旧実装の `… | cut -f1 || echo "-"` は
#   **値と "-" の 2 行**を返し、表と TSV が壊れた。**出力の有無で判定する**形へ変える。
size_of() {
  local p="${1:-}" out
  [ -n "$p" ] && [ -e "$p" ] || { echo "-"; return; }
  out="$(du -sh "$p" 2>/dev/null | cut -f1 | head -1)"
  [ -n "$out" ] && printf '%s\n' "$out" || echo "-"
}
bytes_of() {
  local p="${1:-}" out
  [ -n "$p" ] && [ -e "$p" ] || { echo "0"; return; }
  out="$(du -sb "$p" 2>/dev/null | cut -f1 | head -1)"
  [ -n "$out" ] && printf '%s\n' "$out" || echo "0"
}

GOMOD="$(go env GOMODCACHE 2>/dev/null || true)"
GOCACHE="$(go env GOCACHE 2>/dev/null || true)"

# 「表示名<TAB>パス」。パスが無い環境ではその行が "-" になる
TARGETS=(
  "go-module-cache	$GOMOD"
  "go-build-cache	$GOCACHE"
  "pnpm-store	$HOME/.local/share/pnpm"
  "pnpm-cache	$HOME/.cache/pnpm"
  "playwright	$HOME/.cache/ms-playwright"
  "npm-cache	$HOME/.npm"
  "agent-session	$HOME/.claude"
  "workspaces	/workspaces"
)

if [ "$MODE" = "tsv" ]; then
  # 追記用。列: 日付 / 項目 / 人が読むサイズ / バイト数
  # $4 は KB。バイトは大きくなるので %.0f で指数表記を避ける
  df -P / 2>/dev/null | awk -v d="$TODAY" 'NR==2{printf "%s\tfs-avail\t%dK\t%.0f\n", d, $4, $4*1024}'
  for t in "${TARGETS[@]}"; do
    name="${t%%	*}"; path="${t#*	}"
    printf '%s\t%s\t%s\t%s\n' "$TODAY" "$name" "$(size_of "$path")" "$(bytes_of "$path")"
  done
  exit 0
fi

echo "# ディスク使用量の計測（devContainer 内）"
echo
echo "計測日: **$TODAY** / commit \`$(git rev-parse --short HEAD 2>/dev/null || echo unknown)\`"
echo
echo "> **ホスト側は測れません。** Windows ドライブ残量・Docker disk image・\`docker system df\` は"
echo "> コンテナ内から見えないため、\`docs/process/disk-growth-baseline.md\` の手順でホスト側を別途測ること。"
echo

echo "## ファイルシステム"
echo
df -h / 2>/dev/null | awk 'NR==1{printf "| %s | %s | %s | %s |\n|---|---|---|---|\n", $2, $3, $4, $5} NR==2{printf "| %s | %s | %s | %s |\n", $2, $3, $4, $5}'
echo
echo "> この値は **WSL VHD の内側**から見た残量である。**Windows ドライブが逼迫していても"
echo "> ここは余裕に見えることがある**（VHD は使った分だけ膨らみ、自動では縮まないため）。"
echo

echo "## キャッシュ・作業領域"
echo
printf '| 項目 | サイズ | パス |\n|---|---|---|\n'
for t in "${TARGETS[@]}"; do
  name="${t%%	*}"; path="${t#*	}"
  printf '| %s | **%s** | `%s` |\n' "$name" "$(size_of "$path")" "${path:-（未検出）}"
done
echo
echo "## 次にやること"
echo
echo "- **1 点だけでは閾値を決められない。** 数日あけてもう一度実行し、差分から **1 日あたりの増加量**を出す。"
echo "- 追記用の TSV は \`bash scripts/measure-disk-usage.sh --tsv\` で出る。"
echo "- 2 点そろったら \`docs/process/disk-growth-baseline.md\` へ記録し、**残り GB と増加速度から警告閾値を置く**"
echo "  （§3.1: 15% のような割合固定の値には普遍的根拠がない）。"
exit 0

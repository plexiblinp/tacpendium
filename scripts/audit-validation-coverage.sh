#!/usr/bin/env bash
# DES-006(docs/design/06-validation.md)の VAL コード × 実装/テスト言及の突合
# マトリクスを機械生成する監査スクリプト。
#
# 背景: 改善レーン第一弾の最重要バグ B1(PATCH で VAL-C04/C05/C13 が素通り)は、
#   「VAL コード × API 経路(Create/PATCH/PUT) × テスト有無」のマトリクスを機械的に
#   引ければ設計段階で発見できた種類のもの。retrospective パターンD
#   「テストはケース数で語る」の機構化(改善レーン報告書 §5-2-1)。
#
# 抽出は grep/awk/sed のみ(新規依存なし・AI 不要・generate-code-facts.sh と同系統)。
# アプリコード・設計書は一切変更しない(read-only 監査・stdout 出力のみ)。
#
# 使い方: bash scripts/audit-validation-coverage.sh
#   終了コード: 常に 0(情報提供目的。警告の有無はレポート本文で判断する)
#
# 本監査の限界(読む際の注意):
#   - 文字列 grep のため、定数経由の間接参照(validation.CodeC04DriveRange 等)は
#     定数定義ファイルの言及として数える。コメント内の言及も言及に数える(過剰側に倒す)。
#   - 「テスト言及あり」=そのコードがテストファイル内に文字列として現れること。
#     ケースの十分性(境界値・異常系の網羅)までは保証しない。
#   - 経路別セクション(§3)は service 層の関数本体に現れる validation.* 呼出の列挙で、
#     呼出条件(if 分岐でスキップされる等)までは追わない。非対称の「気づき」用。
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

DES="docs/design/06-validation.md"
[ -f "$DES" ] || { echo "ERROR: $DES が見つかりません" >&2; exit 1; }

GEN_DATE="$(date '+%Y-%m-%d')"
GEN_COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"

echo "# バリデーション網羅監査(VAL コード × 実装/テスト言及)"
echo
echo "生成: ${GEN_DATE} / commit \`${GEN_COMMIT}\` / \`scripts/audit-validation-coverage.sh\`"
echo
echo "> 一次情報: \`${DES}\`。本レポートは文字列 grep による機械突合であり、"
echo "> テストケースの十分性(境界値・異常系網羅)までは保証しない。冒頭コメントの「限界」参照。"
echo

# ---------------------------------------------------------------------------
# §1 マトリクス: VAL コードごとの言及数
#   Go実装 = internal/**/*.go (テスト除く) / Goテスト = internal/**/*_test.go
#   FE     = web/src/**      / E2E = web/e2e/**
# ---------------------------------------------------------------------------
codes="$(grep -oE 'VAL-[A-Z][0-9]+' "$DES" | sort -u)"

echo "## 1. マトリクス(言及ファイル数)"
echo
echo "| VAL コード | DES-006 概要(先頭60字) | Go実装 | Goテスト | FE(src) | E2E |"
echo "|---|---|---|---|---|---|"

warn_no_impl=""
warn_no_test=""

for code in $codes; do
  # DES-006 のテーブル行(| VAL-XXX | 説明 | ...)から説明セルを取得(最初の一致のみ)。
  # grep は不一致で exit 1 を返すため、set -e 対策として || true を添える。
  # 60文字で切り詰め(sed はロケール依存でマルチバイト対応。cut -c はバイト単位で文字化けするため不使用)
  desc="$( { grep -m1 -E "^\| *${code} *\|" "$DES" || true; } | awk -F'|' '{print $3}' | sed 's/^ *//; s/ *$//' | sed -E 's/^(.{60}).*$/\1…/')"
  [ -z "$desc" ] && desc="(表行なし=本文/欠番/廃止記述のみ)"

  go_impl="$( { grep -rl --include='*.go' --exclude='*_test.go' -F "$code" internal/ 2>/dev/null || true; } | wc -l | tr -d ' ')"
  go_test="$( { grep -rl --include='*_test.go' -F "$code" internal/ 2>/dev/null || true; } | wc -l | tr -d ' ')"
  fe_src="$( { grep -rl -F "$code" web/src 2>/dev/null || true; } | wc -l | tr -d ' ')"
  e2e="$( { grep -rl -F "$code" web/e2e 2>/dev/null || true; } | wc -l | tr -d ' ')"

  echo "| $code | $desc | $go_impl | $go_test | $fe_src | $e2e |"

  if [ "$go_impl" = "0" ] && [ "$fe_src" = "0" ]; then
    warn_no_impl="${warn_no_impl}${code} "
  elif [ "$go_test" = "0" ]; then
    warn_no_test="${warn_no_test}${code} "
  fi
done
echo

# ---------------------------------------------------------------------------
# §2 警告
# ---------------------------------------------------------------------------
echo "## 2. 警告(機械判定・要人間確認)"
echo
if [ -n "$warn_no_impl" ]; then
  echo "- **実装言及ゼロ(Go/FE とも)**: ${warn_no_impl}"
  echo "  - 未実装・実装予定(フェーズ送り)・定数名のみで文字列が現れない、のいずれか。DES-006 と突合すること。"
else
  echo "- 実装言及ゼロのコード: なし"
fi
if [ -n "$warn_no_test" ]; then
  echo "- **Go 実装言及ありだが Go テスト言及ゼロ**: ${warn_no_test}"
  echo "  - テストの穴の候補。FE 側検証のみで足りるか、テスト追加が要るかを判断すること。"
else
  echo "- 実装ありでテスト言及ゼロのコード: なし"
fi
echo

# ---------------------------------------------------------------------------
# §3 経路別: service 層の各関数が呼ぶ validation.* エントリポイント
#   B1 型の非対称(Create にはあるが PATCH に無い等)を可視化する。
# ---------------------------------------------------------------------------
echo "## 3. 経路別(service 層関数 → validation.* 呼出)"
echo
echo "> Create/PATCH(UpdateMetadata)/PUT(UpdateWithKeyChange)/import 等の経路間で"
echo "> 検証エントリポイントが非対称になっていないかの確認用。"
echo
echo '| ファイル | 関数 | validation.* 呼出 |'
echo '|---|---|---|'
find internal/service internal/api -name '*.go' ! -name '*_test.go' | sort | while read -r f; do
  awk -v file="$f" '
    /^func / {
      fname=$0
      sub(/^func +(\([^)]*\) +)?/,"",fname)
      sub(/\(.*/,"",fname)
    }
    /validation\.(Validate|Sanitize)[A-Za-z]+\(/ {
      call=$0
      # 行内の validation.Xxx( 部分だけを抽出
      while (match(call, /validation\.(Validate|Sanitize)[A-Za-z]+\(/)) {
        found=substr(call, RSTART, RLENGTH-1)
        if (fname != "" ) print "| " file " | " fname " | `" found "` |"
        call=substr(call, RSTART+RLENGTH)
      }
    }
  ' "$f"
done
echo
echo "---"
echo "*以上。本レポートは stdout 出力のみで、リポジトリ内のファイルは変更していない。*"

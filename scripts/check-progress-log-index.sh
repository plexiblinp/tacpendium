#!/usr/bin/env bash
# check-progress-log-index.sh — progress-log 索引行の機構チェック(決定論・read-only)
#
# 背景: `docs/progress/progress-log.md` への追記が落ちる事故が繰り返し起きた。
#   原因は構造にあった——追記の要求が **指示書テンプレートの記入指針(D-191)にしか無く**、
#   製造 CLI 側には 1 箇所も無かった。指示書著者が毎回書き忘れないことに依存していたため、
#   M19-04b / M19-04c / M19-04d で実際に落ちた。
#   2026-08-11 開発者裁定④により製造 CLI 3 本へ手順を二重化したが、
#   **本文に手順があること自体は「守られたか」を保証しない**。本検査がその穴を埋める。
#
# 本スクリプトが検査すること:
#   (1) 製造 CLI 3 本が索引行マーカーを持つ(ルールが黙って消えていないこと)
#   (2) 各完了報告に対応する作業 ID が progress-log.md の **見出し行**に現れる
#       (追記が落ちていないこと)。既知の歴史的欠落は ALLOW 表で除外する(`--list-allow` で一覧)
#
# 使い方:
#   bash scripts/check-progress-log-index.sh              # リポジトリを検査
#   bash scripts/check-progress-log-index.sh --list-allow # ALLOW 表(既知の欠落)を一覧
#   bash scripts/check-progress-log-index.sh --self-test  # 陽性対照・陰性対照でこのスクリプト自身を検査
#
# 終了コード: 0=違反なし / 1=違反あり / 2=検査対象が見つからない等の実行エラー
#
# 限界(重要・過信しないこと):
#   - **本検査は床であって証明ではない。** 見出し行の**存在**しか見ない。
#     見出しが在れば中身が空でも緑になる。**内容の妥当性は人間が読む。**
#   - **★見出しが作業 ID で始まりさえすれば、それが索引行でなくても緑になる。**
#     例: `### M19-07 レビュー取り込み` のような後日の追補見出しでも通る
#     (2026-09-01 クリーンルームレビュー C)。**「索引行が在る」ではなく
#     「その ID で始まる見出しが 1 つ以上ある」を見ている。**
#   - 見出しの階層(`##` か `###` か)は問わない。progress-log の実態が M14 期以降で
#     揺れており(`## M19-03:` と `### M19-07 ` が混在)、揃えることを本検査の目的にしない。
#   - 対象は `*completion-report*.md` のみ。日本語ファイル名の報告
#     (例 `M19-03-完了報告-一次受け.md`)は対象外。
#   - レビュー報告(`*-review.md`)は対象にしない(索引行は完了時に書くため)。
#
# 2026-09-01 の是正(改善レーン 第 2 束・`M23-04` 教訓 1 / `D-510`):
#   **旧実装は `grep -qiF -- "$id"` の単純部分一致であり、偽陰性を返していた。**
#   `M23-04` は索引行を 1 行も書いていない状態で本検査が「違反なし」を返した
#   ——本文に「`M23-05` はこの器へ載る」が含まれていたためである。
#   **⇒ 照合を「見出し行が作業 ID で始まる」ことに限定した。**
#   **★是正して初めて 7 件の実在する欠落が見えた**(m14-03b / m14-03d / m14-03e /
#   m17-03 / m18-02 / m19-04b / m19-phase2)。**いずれも 2026-08-11 の機構化より前の
#   ものであり、ALLOW 表へ移した。★とくに m19-04b は `CLAUDE.md` §8 と
#   `implement_plan.md` が「実際に落ちた」と名指ししている件であり、
#   ALLOW 表に無かったこと自体が旧実装の偽陰性の証拠である。**
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "ERROR: git リポジトリ内で実行してください" >&2
  exit 2
}
cd "$ROOT"

PROGRESS_LOG="docs/progress/progress-log.md"
INDEX_MARKER='<!-- PROGRESS-LOG-INDEX -->'

# 索引行の手順を明記すべき製造 CLI(各1節)
CLI_FILES=(
  ".claude/commands/implement_plan.md"
  ".claude/commands/implement_plan_full.md"
  ".claude/commands/incorporate_plan.md"
)

# ---------------------------------------------------------------------------
# ALLOW 表: 2026-08-11 の機構化より前から存在する既知の欠落。
#   「作業ID :: 除外の理由」。**新しい行を安易に足さないこと**——
#   ここへ足すことは「追記しないで済ませた」という記録が残ることを意味する。
# ---------------------------------------------------------------------------
ALLOW=(
  "20260803-reflection-lane :: 反映レーンの報告であり製造サブではない(progress-log へは横断的な事項のみ記録する運用)"
  "20260807-reflection-lane :: 同上"
  "20260807-reflection-lane-part3 :: 同上"
  "m15-03 :: M15 期の未転記(M15-02 / 05 / 06 は記録済み。当時の運用漏れ)"
  "m15-04 :: 同上"
  "m17-05a :: M17 期の未転記。m18-startup-kit #18 が既知の欠落として明記している"
  "m17-05c :: 同上"
  "m17-05c-fix :: 同上"
  "m19-04c :: D-191 が追記漏れの実例として名指ししている件。2026-08-11 の機構化の直接の動機"
  "m19-04d :: 同上"
  # --- 2026-09-01 追加(改善レーン 第 2 束)。**旧実装の偽陰性で見えていなかった 7 件。** ---
  #   ★これは「追記しないで済ませた」ための追加ではない。**検査が壊れていたため
  #     検出されず、ALLOW 表へ載せる機会が無かった**歴史的欠落である。
  #     いずれも 2026-08-11 の機構化より前(M14 / M17 / M18 / M19 期)であり、
  #     既存 10 件とまったく同じ性格を持つ。**完了済みマイルストーンの記録は
  #     当時のまま残す**(D-535)ため、索引行を後から捏造しない。
  "m19-04b :: D-191 / CLAUDE.md §8 / implement_plan.md が「実際に追記が落ちた」と名指ししている件。旧実装の偽陰性で ALLOW 表から漏れていた"
  "m14-03b :: M14 期の未転記。本文に言及はあるが索引見出しが無い(旧実装はこれを緑にしていた)"
  "m14-03d :: 同上"
  "m14-03e :: 同上"
  "m17-03 :: M17 期の未転記。同上"
  "m18-02 :: M18 期の未転記。同上"
  "m19-phase2 :: M19-PHASE2(手入力フレーム)の未転記。同上"
)

VIOLATIONS=0

note() { printf '  %s\n' "$*"; }
fail() { printf 'NG  %s\n' "$*"; VIOLATIONS=$((VIOLATIONS + 1)); }
ok()   { printf 'OK  %s\n' "$*"; }

# ---------------------------------------------------------------------------
# 完了報告のファイル名から作業 ID を取り出す(小文字化)
# ---------------------------------------------------------------------------
extract_id() {
  basename "$1" \
    | sed -E 's/-?completion-report.*\.md$//I' \
    | tr 'A-Z' 'a-z'
}

is_allowed() {
  local id="$1" entry
  for entry in "${ALLOW[@]}"; do
    [ "${entry%% :: *}" = "$id" ] && return 0
  done
  return 1
}

# ---------------------------------------------------------------------------
# 検査の単位(自己検査から再利用するため関数に切る)
# ---------------------------------------------------------------------------

# 索引行マーカーを持つか。0=持つ / 1=持たない
marker_check_one() {
  local file="$1"
  [ -f "$file" ] || return 1
  grep -qF "$INDEX_MARKER" "$file"
}

# ERE のメタ文字を打ち消す(作業 ID をそのままパターンへ埋めるため)
escape_ere() {
  printf '%s' "$1" | sed -e 's/[.[\*^$()+?{}|]/\\&/g'
}

# 作業 ID が progress-log の **見出し行の先頭**に現れるか。0=現れる / 1=現れない
#
# ★単純部分一致ではない。「本文で言及しているだけ」は索引行ではない。
#   許容する形(progress-log の実態に合わせた。揃えることは本検査の目的ではない):
#     ## M19-03: セットプレイ成立条件の記録（2026-07-28）
#     ### M19-07 コンボ新規登録時の…               ← コロン無し
#     ### **M24-08**: …                             ← 強調つき
#   許容しない形:
#     ### alias 実査結果(M14-03b seed 契約への申し送り)   ← 見出しの途中に出るだけ
coverage_check_one() {
  local id="$1" logfile="$2" pat
  [ -f "$logfile" ] || return 1
  pat="^#{2,6} +\**$(escape_ere "$id")\**([:：]| |$)"
  grep -qiE -- "$pat" "$logfile"
}

# ---------------------------------------------------------------------------
# 自己検査(陽性対照・陰性対照)
# ---------------------------------------------------------------------------
self_test() {
  local tmp
  tmp="$(mktemp -d)" || { echo "ERROR: mktemp 失敗" >&2; exit 2; }
  # shellcheck disable=SC2064
  trap "rm -rf '$tmp'" EXIT

  local st_fail=0

  echo "## 自己検査(陽性対照・陰性対照)"
  echo

  # --- マーカー検査 ---
  printf '%s\n' "手順の節。$INDEX_MARKER を含む。" > "$tmp/with-marker.md"
  printf '%s\n' "手順の節。マーカーが無い。" > "$tmp/without-marker.md"

  if marker_check_one "$tmp/with-marker.md"; then
    ok "陰性対照(マーカーあり) → 緑"
  else
    printf 'NG  陰性対照(マーカーあり)が赤になった(誤検出)\n'; st_fail=1
  fi
  if marker_check_one "$tmp/without-marker.md"; then
    printf 'NG  陽性対照(マーカーなし)が緑になった(検出漏れ)\n'; st_fail=1
  else
    ok "陽性対照(マーカーなし) → 赤"
  fi

  # --- カバレッジ検査 ---
  cat > "$tmp/log-hit.md" <<'EOF'
# 進捗ログ
### M19-99: 何かのサブ（2026-08-11）
- **結果**: green
EOF
  cat > "$tmp/log-miss.md" <<'EOF'
# 進捗ログ
### M19-98: 別のサブ（2026-08-11）
- **結果**: green
EOF

  if coverage_check_one "m19-99" "$tmp/log-hit.md"; then
    ok "陰性対照(索引行あり) → 緑"
  else
    printf 'NG  陰性対照(索引行あり)が赤になった(誤検出)\n'; st_fail=1
  fi
  if coverage_check_one "m19-99" "$tmp/log-miss.md"; then
    printf 'NG  陽性対照(索引行なし)が緑になった(検出漏れ)\n'; st_fail=1
  else
    ok "陽性対照(索引行なし) → 赤"
  fi
  if coverage_check_one "m19-99" "$tmp/does-not-exist.md"; then
    printf 'NG  陽性対照(ログ不在)が緑になった(検出漏れ)\n'; st_fail=1
  else
    ok "陽性対照(progress-log 不在) → 赤"
  fi

  # --- ★2026-09-01 追加: 旧実装の偽陰性そのものの対照(M23-04 教訓 1) ---
  #   「ID が本文には現れるが、見出し行としては現れない」形。
  #   旧実装(grep -qiF)はこれを緑にしていた。**この 1 件が本是正の核心である。**
  cat > "$tmp/log-mention-only.md" <<'EOF'
# 進捗ログ
### M19-98: 別のサブ（2026-08-11）
- **結果**: green。**M19-99 はこの器へ載る**（本文で言及しているだけ）
### 実査結果(M19-99 seed 契約への申し送り)
- 見出しの途中に ID が出るだけの形。索引行ではない。
EOF
  if coverage_check_one "m19-99" "$tmp/log-mention-only.md"; then
    printf 'NG  陽性対照(本文と見出し途中に言及のみ)が緑になった(旧実装の偽陰性が再発)\n'; st_fail=1
  else
    ok "陽性対照(本文で言及しているだけ・見出し途中の出現) → 赤"
  fi

  # --- 見出しの実態の揺れを緑にできること(誤検出の対照) ---
  cat > "$tmp/log-variants.md" <<'EOF'
# 進捗ログ
## M19-97: コロンあり・## レベル（2026-07-28）
### M19-96 コロン無し・### レベル 2026-08-09
### **M19-95**: 強調つき（2026-08-30）
EOF
  for v in m19-97 m19-96 m19-95; do
    if coverage_check_one "$v" "$tmp/log-variants.md"; then
      ok "陰性対照(見出しの実態の揺れ: $v) → 緑"
    else
      printf 'NG  陰性対照(見出しの揺れ: %s)が赤になった(誤検出)\n' "$v"; st_fail=1
    fi
  done

  # --- ALLOW 表 ---
  if is_allowed "m19-04c"; then
    ok "ALLOW 表の既知欠落(m19-04c)を除外できる"
  else
    printf 'NG  ALLOW 表が引けていない\n'; st_fail=1
  fi
  if is_allowed "m19-07"; then
    printf 'NG  ALLOW 表に無い ID(m19-07)を除外してしまった\n'; st_fail=1
  else
    ok "ALLOW 表に無い ID は除外しない"
  fi

  echo
  if [ "$st_fail" -eq 0 ]; then
    echo "自己検査: 合格(陽性は赤・陰性は緑)"
    return 0
  fi
  echo "自己検査: 不合格"
  return 1
}

# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------
if [ "${1:-}" = "--self-test" ]; then
  self_test
  exit $?
fi

if [ "${1:-}" = "--list-allow" ]; then
  echo "# ALLOW 表(2026-08-11 の機構化より前から存在する既知の欠落)"
  echo
  echo "| 作業ID | 除外の理由 |"
  echo "|---|---|"
  for entry in "${ALLOW[@]}"; do
    printf '| `%s` | %s |\n' "${entry%% :: *}" "${entry#* :: }"
  done
  exit 0
fi

echo "# progress-log 索引行チェック"
echo
echo "対象 commit: \`$(git rev-parse --short HEAD 2>/dev/null || echo unknown)\`"
echo

echo "## 1. 製造 CLI の索引行手順(ルールが消えていないか)"
echo

for f in "${CLI_FILES[@]}"; do
  if [ ! -f "$f" ]; then
    fail "$f が存在しない"
  elif marker_check_one "$f"; then
    ok "$f に索引行の節がある"
  else
    fail "$f に索引行の節がない(マーカー $INDEX_MARKER を含む節を追加すること)"
  fi
done

echo
echo "## 2. 完了報告 → progress-log の追記カバレッジ"
echo

if [ ! -f "$PROGRESS_LOG" ]; then
  fail "$PROGRESS_LOG が存在しない"
else
  checked=0
  allowed=0
  missing=0

  # 対象の完了報告を列挙(phase ディレクトリを含む)
  while IFS= read -r report; do
    [ -n "$report" ] || continue
    id="$(extract_id "$report")"
    [ -n "$id" ] || continue

    if is_allowed "$id"; then
      allowed=$((allowed + 1))
      continue
    fi

    checked=$((checked + 1))
    if ! coverage_check_one "$id" "$PROGRESS_LOG"; then
      fail "作業 ID \`$id\` が $PROGRESS_LOG に現れない(完了報告: $report)"
      note "索引行の形式は .claude/commands/implement_plan.md §「完了時」を参照"
      missing=$((missing + 1))
    fi
  done < <(find docs/progress -name '*completion-report*.md' -type f 2>/dev/null | sort)

  if [ "$checked" -eq 0 ]; then
    fail "完了報告が 1 件も見つからない(検査が空回りしている可能性)"
  elif [ "$missing" -eq 0 ]; then
    ok "検査した $checked 件すべてが progress-log に現れる(ALLOW 除外 $allowed 件)"
  fi
fi

echo
if [ "$VIOLATIONS" -eq 0 ]; then
  echo "結果: 違反なし"
  exit 0
fi
echo "結果: 違反 $VIOLATIONS 件"
echo
echo "追記が落ちた場合の直し方: progress-log.md の末尾へ索引行を追記する。"
echo "既知の歴史的欠落として除外したい場合は本スクリプトの ALLOW 表へ理由つきで追加する"
echo "(ただし ALLOW への追加は「追記しないで済ませた」という記録が残ることを意味する)。"
exit 1

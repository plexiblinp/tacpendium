#!/usr/bin/env bash
# check-stop-discipline.sh — 停止規律の機構チェック(決定論・read-only)
#
# 背景: 「これが最後」と指示しても資料を完璧にするまで止まらない事例が複数あった。
#   完璧主義による停止不能を、文章の宣言ではなく機械検査で防ぐ。
#   上限(再レビュー往復上限2回 / タイムボックス / 開発者の終了指示)に達したら、
#   未解消項目を followup-backlog の §J へ記録して直ちに停止する——これが正規の完了形式である。
#
# 本スクリプトが検査すること:
#   (1) followup-backlog.md に §J 停止時記録の節が存在し、節マーカーを持つ
#   (2) §J の各エントリが必須5フィールド(ID / 発生元 / 未解消の理由 / 再開に必要な条件 / 記録日・状態)を
#       すべて埋めている(空欄・欠落は赤)
#   (3) 停止規律を明記すべき4ファイルが規律マーカーを持つ
#
# 使い方:
#   bash scripts/check-stop-discipline.sh              # リポジトリを検査
#   bash scripts/check-stop-discipline.sh --self-test  # 陽性対照・陰性対照でこのスクリプト自身を検査
#
# 終了コード: 0=違反なし / 1=違反あり / 2=検査対象が見つからない等の実行エラー
#
# 限界:
#   - フィールドが「埋まっているか」は検査できるが、内容の妥当性は判定しない(人間が読む)。
#   - 表セル内に `|` を含む記法は使わない前提(Markdown 表の一般的制約)。
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "ERROR: git リポジトリ内で実行してください" >&2
  exit 2
}
cd "$ROOT"

BACKLOG="docs/handover/followup-backlog.md"
SECTION_HEADING_RE='^## J\. 停止時記録'
SECTION_MARKER='<!-- STOP-DISCIPLINE-SECTION: followup-backlog -->'
TEMPLATE_MARKER='<!-- STOP-DISCIPLINE -->'
REQUIRED_FIELDS=5

# 停止規律を明記すべきファイル(各1節)
TEMPLATE_FILES=(
  "CLAUDE.md"
  ".claude/commands/review_plan.md"
  ".claude/commands/incorporate_plan.md"
  ".claude/commands/implement_plan_full.md"
)

VIOLATIONS=0

note()  { printf '  %s\n' "$*"; }
fail()  { printf 'NG  %s\n' "$*"; VIOLATIONS=$((VIOLATIONS + 1)); }
ok()    { printf 'OK  %s\n' "$*"; }

# ---------------------------------------------------------------------------
# §J 節の抽出(次の `## ` 見出し または EOF まで)
# ---------------------------------------------------------------------------
extract_section() {
  awk -v re="$SECTION_HEADING_RE" '
    $0 ~ re { inside = 1; next }
    inside && /^## / { inside = 0 }
    inside { print }
  ' "$1"
}

# ---------------------------------------------------------------------------
# 表のデータ行を検査する。ヘッダ行・区切り行・引用行は対象外。
#   戻り値: 違反があれば 1
# ---------------------------------------------------------------------------
validate_rows() {
  local section_file="$1" label="$2"
  local rownum=0 rowerr=0 found=0

  while IFS= read -r line; do
    # 表のデータ行だけを対象にする
    [[ "$line" == \|* ]] || continue
    # 区切り行 (|---|---|) を除外
    [[ "$line" =~ ^\|[[:space:]:|-]*\|[[:space:]]*$ ]] && continue
    # ヘッダ行を除外
    [[ "$line" == *"ID（スラッグ）"* ]] && continue

    rownum=$((rownum + 1))
    found=1

    # 前後の | を落として分解する
    local body="${line#|}"
    body="${body%|}"
    body="${body%"${body##*[![:space:]]}"}"
    body="${body%|}"

    # ★2026-08-11 playbook 全面監査の是正。
    #   GFM はセル内の `\|` を **エスケープとして解釈し、セルを分割しない**。
    #   playbook §16.4.1 も「`\|` とエスケープする」を対処法として指示している。
    #   ところが本検査は **raw の `|` で分割していた**ため、
    #   **§16.4.1 に従って書いた行が赤になる**（本日 2 回再発）。
    #   規則と機構が食い違っていたのは機構側の誤りである——エスケープを尊重する。
    local -a cells=()
    local esc_body="${body//\\|/$'\x01'}"   # \| を一時退避してから分割する
    local IFS='|'
    read -ra cells <<< "$esc_body"
    unset IFS
    local ci
    for ci in "${!cells[@]}"; do
      cells[$ci]="${cells[$ci]//$'\x01'/\\|}"
    done

    local id_cell="${cells[0]:-}"
    id_cell="$(printf '%s' "$id_cell" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
    local id_label="${id_cell:-(ID 欄が空)}"

    if [ "${#cells[@]}" -ne "$REQUIRED_FIELDS" ]; then
      fail "$label 行 $rownum [$id_label]: 必須 $REQUIRED_FIELDS フィールドに対し ${#cells[@]} 列しかない"
      note "必須: ID（スラッグ） / 発生元 / 未解消の理由 / 再開に必要な条件 / 記録日・状態"
      rowerr=1
      continue
    fi

    local i name empty=0
    local -a names=("ID（スラッグ）" "発生元" "未解消の理由" "再開に必要な条件" "記録日・状態")
    for i in 0 1 2 3 4; do
      local cell="${cells[$i]}"
      cell="$(printf '%s' "$cell" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
      # 空欄・ハイフンのみ・TBD 相当は未記入とみなす
      if [[ -z "$cell" || "$cell" == "-" || "$cell" == "—" || "$cell" == "TBD" || "$cell" == "未記入" ]]; then
        name="${names[$i]}"
        fail "$label 行 $rownum [$id_label]: 必須フィールド「$name」が未記入"
        empty=1
      fi
    done
    [ "$empty" -eq 1 ] && rowerr=1
  done < "$section_file"

  if [ "$found" -eq 0 ]; then
    fail "$label: §J にエントリ行が 1 件もない(記入例の行は削除しないこと)"
    rowerr=1
  fi

  return "$rowerr"
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

  # 陰性対照: 5 フィールドすべて埋まっている(緑であるべき)
  cat > "$tmp/negative.md" <<'EOF'
| ID（スラッグ） | 発生元 | 未解消の理由 | 再開に必要な条件 | 記録日・状態 |
|---|---|---|---|---|
| **good-entry** | M19-07 ／ docs/progress/m19-07-review.md | 契約変更の可否を判断できなかった | 開発者裁定 | 2026-08-10 ／ `据え置き` |
EOF

  # 陰性対照 B: セル内に **エスケープ済みパイプ** を含む(緑であるべき)
  #   playbook §16.4.1 が指示する書き方。GFM はここでセルを割らないので 5 列である。
  #   ★旧実装は raw の `|` で割って 6 列と数え、**§16.4.1 に従った行を赤にしていた**。
  cat > "$tmp/negative-escaped-pipe.md" <<'EOF'
| ID（スラッグ） | 発生元 | 未解消の理由 | 再開に必要な条件 | 記録日・状態 |
|---|---|---|---|---|
| **escaped-pipe** | M19-07 ／ docs/progress/m19-07-review.md | `curl \| bash` を禁止する規則の書き方が未確定 | 開発者裁定 | 2026-08-10 ／ `据え置き` |
EOF

  # 陽性対照 A: 必須フィールドが空欄(赤であるべき)
  cat > "$tmp/positive-empty.md" <<'EOF'
| ID（スラッグ） | 発生元 | 未解消の理由 | 再開に必要な条件 | 記録日・状態 |
|---|---|---|---|---|
| **missing-condition** | M19-07 ／ docs/progress/m19-07-review.md | 時間切れ |  | 2026-08-10 ／ `据え置き` |
EOF

  # 陽性対照 B: 列が足りない(赤であるべき)
  cat > "$tmp/positive-short.md" <<'EOF'
| ID（スラッグ） | 発生元 | 未解消の理由 | 再開に必要な条件 | 記録日・状態 |
|---|---|---|---|---|
| **too-few-columns** | M19-07 | 時間切れ |
EOF

  # 陽性対照 C: エントリ行が 1 件もない(赤であるべき)
  cat > "$tmp/positive-empty-section.md" <<'EOF'
| ID（スラッグ） | 発生元 | 未解消の理由 | 再開に必要な条件 | 記録日・状態 |
|---|---|---|---|---|
EOF

  echo "## 自己検査(陽性対照・陰性対照)"
  echo

  local saved="$VIOLATIONS"

  # 陰性対照
  VIOLATIONS=0
  if validate_rows "$tmp/negative.md" "[陰性対照 完全なエントリ]" >/dev/null 2>&1; then
    ok "陰性対照(完全なエントリ) → 緑"
  else
    printf 'NG  陰性対照(完全なエントリ)が赤になった(誤検出)\n'
    st_fail=1
  fi

  VIOLATIONS=0
  if validate_rows "$tmp/negative-escaped-pipe.md" "[陰性対照 エスケープ済みパイプ]" >/dev/null 2>&1; then
    ok "陰性対照(セル内 \\| = playbook §16.4.1 の書き方) → 緑"
  else
    printf 'NG  陰性対照(セル内 \\|)が赤になった——§16.4.1 に従った行を弾いている\n'
    st_fail=1
  fi

  # 陽性対照
  local ctl
  for ctl in "positive-empty:必須フィールド空欄" \
             "positive-short:列不足" \
             "positive-empty-section:エントリ 0 件"; do
    local file="${ctl%%:*}" desc="${ctl#*:}"
    VIOLATIONS=0
    if validate_rows "$tmp/$file.md" "[陽性対照 $desc]" >/dev/null 2>&1; then
      printf 'NG  陽性対照(%s)が緑になった(検出漏れ)\n' "$desc"
      st_fail=1
    else
      ok "陽性対照($desc) → 赤"
    fi
  done

  VIOLATIONS="$saved"

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

echo "# 停止規律チェック"
echo
echo "対象 commit: \`$(git rev-parse --short HEAD 2>/dev/null || echo unknown)\`"
echo

echo "## 1. 停止時記録の受け皿(§J)"
echo

if [ ! -f "$BACKLOG" ]; then
  fail "$BACKLOG が存在しない"
elif ! grep -qF "$SECTION_MARKER" "$BACKLOG"; then
  fail "$BACKLOG に節マーカーがない: $SECTION_MARKER"
elif ! grep -qE "$SECTION_HEADING_RE" "$BACKLOG"; then
  fail "$BACKLOG に §J 停止時記録の見出しがない"
else
  ok "$BACKLOG §J が存在する"
  SECTION_TMP="$(mktemp)"
  trap 'rm -f "$SECTION_TMP"' EXIT
  extract_section "$BACKLOG" > "$SECTION_TMP"
  if validate_rows "$SECTION_TMP" "$BACKLOG §J"; then
    ok "§J の全エントリが必須 $REQUIRED_FIELDS フィールドを満たす"
  fi
fi

echo
echo "## 2. 停止規律の明記(テンプレート・フロー)"
echo

for f in "${TEMPLATE_FILES[@]}"; do
  if [ ! -f "$f" ]; then
    fail "$f が存在しない"
  elif grep -qF "$TEMPLATE_MARKER" "$f"; then
    ok "$f に停止規律の節がある"
  else
    fail "$f に停止規律の節がない(マーカー $TEMPLATE_MARKER を含む節を追加すること)"
  fi
done

echo
if [ "$VIOLATIONS" -eq 0 ]; then
  echo "結果: 違反なし"
  exit 0
fi
echo "結果: 違反 $VIOLATIONS 件"
echo
echo "停止規律の要点: 上限に達したら §J へ記録して停止する。記録して止まることは失敗ではなく正規の完了形式である。"
exit 1

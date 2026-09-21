#!/usr/bin/env bash
# check-completion-report-md-emphasis.sh — 完了報告の閉じない強調チェック手順の存在検査
#   (決定論・read-only)
#
# 背景: `docs/progress/` は `check-md-emphasis.sh` の常時走査の対象外である(`D-775`)。
#   外した理由は「見なくてよくなった」ではない——常時走査は「増やした本人が直す」を
#   前提とするが、完了報告・レビュー報告は歴史記録として書き換えない(`D-274` (3))。
#   2 つの規則が食い違い、誰も直さないまま床だけが上がっていた。
#   ⇒ **書いた本人が、その手番で自分の新規ファイルだけをファイル引数モードで見る**
#      という運用へ切り替え、その手順を製造 CLI と指示書テンプレートへ置いた。
#
#   ところが **その手順そのものには機械検査が無かった**(`followup` の
#   `completion-report-md-emphasis-marker-unchecked`)。同じ体系の 2 つは検査を持つ——
#   `<!-- PROGRESS-LOG-INDEX -->` は `check-progress-log-index.sh` が、
#   `<!-- STOP-DISCIPLINE -->` は `check-stop-discipline.sh` が、それぞれ存在を見る。
#   **新マーカーだけが素手であり、手順が黙って消えても誰も気づかない状態だった。**
#   本検査がその穴を埋める。**運用ルールは、消えたことを検出する仕組みを持たないと
#   静かに失われる**(先例＝`M24-08` が 27 ファイルを規約外にしたとき何も鳴らなかった)。
#
# 本スクリプトが検査すること:
#   (1) 製造 CLI 4 本が手順マーカー `<!-- COMPLETION-REPORT-MD-EMPHASIS -->` を持つ
#   (2) 指示書テンプレート §7.4 が同じ手順を **本文として** 持つ(下記「★対象は 4 + 1 である」)
#
# 使い方:
#   bash scripts/check-completion-report-md-emphasis.sh            # リポジトリを検査
#   bash scripts/check-completion-report-md-emphasis.sh --self-test # 陽性/陰性対照で自己検査
#
# 終了コード: 0=違反なし / 1=違反あり / 2=検査対象が見つからない等の実行エラー
#
# ---------------------------------------------------------------------------
# ★★対象は「5 本」ではなく「4 本 ＋ テンプレート 1 本(別判定)」である
# ---------------------------------------------------------------------------
#   `followup-backlog.md` の `completion-report-md-emphasis-marker-unchecked` は
#   **「対象は 5 本である〔製造 CLI 4 本 ＋ 指示書テンプレート §7.4〕」** と書いており、
#   C1〜C3 完了報告も設計伝達レポートも、テンプレートの行に **「マーカーを置いた(○)」**
#   と書いていた。**⇒ この記述は誤りである。**
#
#   実測(2026-09-08 改善レーン D1):
#     - `grep -rn "COMPLETION-REPORT-MD-EMPHASIS"` の実装ファイル該当は **製造 CLI 4 本のみ**
#     - `git log -S 'COMPLETION-REPORT-MD-EMPHASIS' -- <テンプレート>` は **1 件も返さない**
#       ⇒ テンプレートへは **一度もマーカーが入っていない**。消えたのではなく、最初から無い
#     - テンプレート §7.4 に入っているのは **手順の本文と記入指針コメント**だけである
#
#   **⇒ 本検査はマーカーを足さない。** 投入プロンプトの「やらないこと」が
#   **「マーカーそのものを増減させること」** を禁じているためである(本手番は検査を足すだけ)。
#   代わりに **テンプレートは本文パターンで見る**。**★これは新しい流儀ではない**——
#   `check-stop-discipline.sh` が既に **ファイル種別ごとに別パターン**を持つ
#   (`SECTION_MARKER` は followup-backlog、`TEMPLATE_MARKER` は CLI 4 本)。
#
# ---------------------------------------------------------------------------
# 限界(重要・過信しないこと)
# ---------------------------------------------------------------------------
#   - **本検査は床であって証明ではない。** マーカー／本文の **存在**しか見ない。
#     マーカーが在れば、その節の手順が空でも・誤っていても緑になる。**内容は人間が読む。**
#   - 手順が **実際に実行されたか** は見ない。それは完了報告の記述で担保する。
#   - `_wt` 版 4 本は基底コマンドを読む薄いラッパであり本文を複製しないため、対象外
#     (C1〜C3 で実物確認済み)。**ラッパが本文を複製する形へ変わったら対象へ足すこと。**
#   - テンプレート側の本文パターンは **文言に依存する**。§7.4 を書き換えるときは
#     `TEMPLATE_RULE_PATTERN` も一緒に見直すこと(赤くなったら「消えた」か「言い換えた」かを
#     人間が判定する)。マーカーに比べて壊れやすい点は、上記の経緯ゆえに受け入れている。
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "ERROR: git リポジトリ内で実行してください" >&2
  exit 2
}
cd "$ROOT"

MARKER='<!-- COMPLETION-REPORT-MD-EMPHASIS -->'

# 手順マーカーを持つべき製造 CLI(各1節)。
#   ★`review_plan.md` が入るのが `check-progress-log-index.sh` の CLI_FILES との違い
#     ——レビュー報告書も `docs/progress/` へ新規ファイルを作る経路であり、
#     実測の先例もここである(`M28-02c` のレビュー報告書が床を 495 → 496 にした)。
CLI_FILES=(
  ".claude/commands/implement_plan.md"
  ".claude/commands/implement_plan_full.md"
  ".claude/commands/incorporate_plan.md"
  ".claude/commands/review_plan.md"
)

# 指示書テンプレート(マーカーではなく本文で見る。理由は冒頭の「★★対象は…」を参照)
TEMPLATE_FILE='docs/instructions/templates/M{N}-{NN}-{slug}.template.md'
TEMPLATE_RULE_PATTERN='scripts/check-md-emphasis.sh <path>'

VIOLATIONS=0

note() { printf '  %s\n' "$*"; }
fail() { printf 'NG  %s\n' "$*"; VIOLATIONS=$((VIOLATIONS + 1)); }
ok()   { printf 'OK  %s\n' "$*"; }

# ---------------------------------------------------------------------------
# 検査の単位(自己検査から再利用するため関数に切る)
# ---------------------------------------------------------------------------

# 手順マーカーを持つか。0=持つ / 1=持たない(ファイル不在を含む)
marker_check_one() {
  local file="$1"
  [ -f "$file" ] || return 1
  grep -qF -- "$MARKER" "$file"
}

# 手順の本文を持つか。0=持つ / 1=持たない(ファイル不在を含む)
rule_check_one() {
  local file="$1" pattern="$2"
  [ -f "$file" ] || return 1
  grep -qF -- "$pattern" "$file"
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

  # --- マーカー検査(製造 CLI) ---
  printf '%s\n%s\n' "### 完了時" "$MARKER" > "$tmp/with-marker.md"
  printf '%s\n%s\n' "### 完了時" "手順の節はあるがマーカーが無い。" > "$tmp/without-marker.md"

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
  if marker_check_one "$tmp/does-not-exist.md"; then
    printf 'NG  陽性対照(ファイル不在)が緑になった(検出漏れ)\n'; st_fail=1
  else
    ok "陽性対照(ファイル不在) → 赤"
  fi

  # --- ★紛らわしい陽性対照: 似た名前の別マーカーでは緑にならないこと ---
  #   `<!-- PROGRESS-LOG-INDEX -->` / `<!-- STOP-DISCIPLINE -->` は同じ節の近くに置かれる。
  #   それらだけが在る状態を緑にすると、本検査は「隣のマーカーを数えているだけ」になる。
  cat > "$tmp/sibling-markers-only.md" <<'EOF'
### 完了時
<!-- PROGRESS-LOG-INDEX -->
<!-- STOP-DISCIPLINE -->
EOF
  if marker_check_one "$tmp/sibling-markers-only.md"; then
    printf 'NG  陽性対照(同体系の別マーカーのみ)が緑になった(検出漏れ)\n'; st_fail=1
  else
    ok "陽性対照(PROGRESS-LOG-INDEX / STOP-DISCIPLINE だけが在る) → 赤"
  fi

  # --- 本文検査(指示書テンプレート) ---
  cat > "$tmp/tpl-with-rule.md" <<'EOF'
### 7.4 ドキュメント
- **本サブで `docs/progress/` へ新規に作った報告書を `bash scripts/check-md-emphasis.sh <path>...` へ渡し、非ゼロなら自分で直してから完了とする**
EOF
  cat > "$tmp/tpl-without-rule.md" <<'EOF'
### 7.4 ドキュメント
- **`docs/progress/progress-log.md` への追記**（製造担当が行う）。
EOF
  # 紛らわしい陽性対照: スクリプト名だけが別文脈で出てくる形(手順ではない)
  cat > "$tmp/tpl-name-only.md" <<'EOF'
### 7.4 ドキュメント
- ベースラインの現行値は `scripts/check-md-emphasis.sh` が持つ。この行の数字を写さないこと。
EOF

  if rule_check_one "$tmp/tpl-with-rule.md" "$TEMPLATE_RULE_PATTERN"; then
    ok "陰性対照(テンプレートに手順あり) → 緑"
  else
    printf 'NG  陰性対照(テンプレートに手順あり)が赤になった(誤検出)\n'; st_fail=1
  fi
  if rule_check_one "$tmp/tpl-without-rule.md" "$TEMPLATE_RULE_PATTERN"; then
    printf 'NG  陽性対照(テンプレートに手順なし)が緑になった(検出漏れ)\n'; st_fail=1
  else
    ok "陽性対照(テンプレートに手順なし) → 赤"
  fi
  if rule_check_one "$tmp/tpl-name-only.md" "$TEMPLATE_RULE_PATTERN"; then
    printf 'NG  陽性対照(スクリプト名だけが別文脈で出る)が緑になった(検出漏れ)\n'; st_fail=1
  else
    ok "陽性対照(スクリプト名だけが別文脈で出る) → 赤"
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

echo "# 完了報告の閉じない強調チェック手順の存在検査"
echo
echo "対象 commit: \`$(git rev-parse --short HEAD 2>/dev/null || echo unknown)\`"
echo
echo '> **前提**: `docs/progress/` は `check-md-emphasis.sh` の常時走査の対象外である(`D-775`)。'
echo '> ⇒ 書いた本人がファイル引数モードで見るしかない。**その手順が消えたら誰も見なくなる。**'
echo

echo "## 1. 製造 CLI の手順マーカー(ルールが消えていないか)"
echo

for f in "${CLI_FILES[@]}"; do
  if [ ! -f "$f" ]; then
    fail "$f が存在しない"
  elif marker_check_one "$f"; then
    ok "$f に完了報告 md-emphasis の節がある"
  else
    fail "$f に完了報告 md-emphasis の節がない(マーカー $MARKER を含む節を追加すること)"
    note "手順の内容は .claude/commands/implement_plan.md の同マーカー節を参照"
  fi
done

echo
echo "## 2. 指示書テンプレート §7.4 の手順(本文で判定)"
echo
echo "> **★テンプレートにはマーカーが無い**(実測 2026-09-08。\`git log -S\` の結果、**一度も入っていない**)。"
echo "> ⇒ 本文パターン \`$TEMPLATE_RULE_PATTERN\` で見る。マーカーの増減は本検査の射程外である。"
echo

if [ ! -f "$TEMPLATE_FILE" ]; then
  fail "$TEMPLATE_FILE が存在しない"
elif rule_check_one "$TEMPLATE_FILE" "$TEMPLATE_RULE_PATTERN"; then
  ok "$TEMPLATE_FILE §7.4 に手順の本文がある"
else
  fail "$TEMPLATE_FILE §7.4 から手順の本文が消えた"
  note "期待するパターン: $TEMPLATE_RULE_PATTERN"
  note "言い換えただけなら本スクリプトの TEMPLATE_RULE_PATTERN を追随させること"
fi

echo
if [ "$VIOLATIONS" -eq 0 ]; then
  echo "結果: 違反なし"
  exit 0
fi
echo "結果: 違反 $VIOLATIONS 件"
echo
echo "手順が落ちた場合の直し方: 該当ファイルへ「新規に作った報告書を"
echo "\`bash scripts/check-md-emphasis.sh <path>...\` へ渡し、非ゼロなら直してから完了とする」"
echo "旨の節を戻す(製造 CLI 4 本はマーカー $MARKER つきで)。"
echo "★継続更新ファイル(progress-log.md 等)は渡さない——歴史記録の既存検出行は直さない(\`D-274\` (3))。"
exit 1

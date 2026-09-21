#!/usr/bin/env bash
# check-doc-refs.sh — 常時読込されるルール面の dead file reference 検査(決定論・read-only)
#
# 背景: CLAUDE.md と .claude/commands/*.md は「毎回読まれる」ルール面である。
#   ここに存在しないパスが残っていると、全作業が誤った資料を探しに行く。
#   実例: CLAUDE.md §12 の HANDOVER-001 が `docs/handover/archive/handover_1.md` を
#   指していたが、当該ディレクトリごと存在しなかった(実体は docs/handover/phase1/)。
#
# 検査対象(狭く保つ): CLAUDE.md / web/CLAUDE.md / .claude/rules/*.md と .claude/commands/*.md。
#   web/CLAUDE.md は 2026-08-10 に root から移設した web 固有ルールの置き場、
#   .claude/rules/ は同日に導入した path-scoped rule の置き場で、
#   いずれも root と同じくルール面であるため対象に含める。
#   docs/ 配下全体への拡大は誤検出の母数が大きいため、別途 followup とする。
#
# 使い方:
#   bash scripts/check-doc-refs.sh              # リポジトリを検査
#   bash scripts/check-doc-refs.sh --self-test  # 陽性対照・陰性対照でこのスクリプト自身を検査
#   bash scripts/check-doc-refs.sh --list-allow # 例示として除外しているパスの一覧と理由
#
# 終了コード: 0=dead reference なし / 1=あり / 2=実行エラー
#
# 設計卓の武装中の扱い(2026-08-12 追加・開発者裁定):
#   scripts/design-desk-arm.sh は sparse-checkout で web/ internal/ cmd/ migrations/ を
#   作業ツリーから物理排除する。武装中はそれらが「無い」ように見えるため、
#   本検査は web/CLAUDE.md 等を dead reference と誤検出していた(実測 6 件)。
#   **ALLOW 表へ入れない。** 恒久免除にすると、本当に消えたときに気づけなくなる。
#   代わりに「武装中 かつ 参照先のトップ階層ディレクトリが作業ツリーに無い」ものだけを
#   SKIP(未検査)として分離し、NG に数えない。**未検査は件数を明示して報告する**
#   (「0 件」と「検査していない」を同じ顔で出さない = 教訓 E-84)。
#   武装していないセッション(製造・改善レーン)では従来どおり NG になる。
#
# 限界:
#   - 拡張子付きのファイルパスのみを対象とする。ディレクトリ参照(例 `web/prototypes/`)や
#     `M{N}-{NN}-{slug}.template.md` のようなプレースホルダ記法は検出しない。
#   - 例示・プレースホルダは ALLOW 表で明示的に除外する(陰性対照)。除外は理由付きで書くこと。
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "ERROR: git リポジトリ内で実行してください" >&2
  exit 2
}
cd "$ROOT"

# 検査対象のパス表記(リポジトリルート相対)を拾う正規表現
PATH_RE='(docs|internal|web|scripts|migrations|cmd)/[A-Za-z0-9_./-]+\.(md|sh|go|ts|tsx|json|sql|yaml|yml|html|txt|csv)'

# ---------------------------------------------------------------------------
# 陰性対照: 実在しなくてよいパス(例示・プレースホルダ)。「パス :: 理由」
#   ここへ足すときは、それが本当に例示であることを確認すること。
#   実在すべきパスを黙らせるために使わない。
# ---------------------------------------------------------------------------
ALLOW=(
  "docs/instructions/M1-03-combo-crud-api.md :: 引数バリデーション手順の記述例(M1-03)"
  "docs/instructions/reviews/M1-03-review-checklist.md :: 同上・パス導出の記述例"
  "docs/progress/m1-03-review.md :: 同上・出力先の記述例"
  "docs/instructions/M7-RESEARCH-04-...md :: research_plan のプレースホルダ表記"
  "docs/instructions/M7-RESEARCH-04-report.md :: research_plan の記述例"
  "docs/audits/YYYYMMDD-resource-exhaustion-audit-delta.md :: 日付プレースホルダ"
  "docs/handover/phase2-kickoff-handover.md :: next_phase_kit の入力例(フェーズ2 は既にアーカイブ済み)"
  "web/src/constants/tag.ts :: CLAUDE.md §4 の定数同期の記述例(実在する必要はない)"
)

allow_reason() {
  local target="$1" entry
  for entry in "${ALLOW[@]}"; do
    [ "${entry%% :: *}" = "$target" ] && { printf '%s' "${entry#* :: }"; return 0; }
  done
  return 1
}

# ---------------------------------------------------------------------------
# 1 ファイルを検査する。dead reference を "file<TAB>path" で出力する。
#   BASE_DIR を指定すると、そのディレクトリを実在判定の基準にする(自己検査用)。
# ---------------------------------------------------------------------------
scan_file() {
  local f="$1" base="${2:-.}"
  local p
  grep -ohE "$PATH_RE" "$f" 2>/dev/null | sort -u | while IFS= read -r p; do
    [ -e "$base/$p" ] && continue
    allow_reason "$p" >/dev/null && continue
    printf '%s\t%s\n' "$f" "$p"
  done
}

# ---------------------------------------------------------------------------
# 武装中に判定不能なパスか。
#   armed=1 かつ 参照先のトップ階層ディレクトリが base 配下に無いときだけ真。
#   武装していない(armed=0)なら常に偽 = 従来どおり NG になる。
# ---------------------------------------------------------------------------
is_unjudgeable() {
  local path="$1" armed="$2" base="${3:-.}"
  [ "$armed" -eq 1 ] || return 1
  local top="${path%%/*}"
  [ -n "$top" ] || return 1
  [ -d "$base/$top" ] && return 1
  return 0
}

# ---------------------------------------------------------------------------
# 自己検査(陽性対照・陰性対照)
# ---------------------------------------------------------------------------
self_test() {
  local tmp st_fail=0
  tmp="$(mktemp -d)" || { echo "ERROR: mktemp 失敗" >&2; exit 2; }
  # shellcheck disable=SC2064
  trap "rm -rf '$tmp'" EXIT

  mkdir -p "$tmp/docs/handover" "$tmp/fixtures"
  printf 'placeholder\n' > "$tmp/docs/handover/real.md"

  # 陰性対照 A: 実在するパスだけを参照する
  printf 'see docs/handover/real.md for details\n' > "$tmp/fixtures/negative-real.md"
  # 陰性対照 B: 実在しないが ALLOW 表にある例示パス
  printf 'example: docs/progress/m1-03-review.md\n' > "$tmp/fixtures/negative-allowed.md"
  # 陽性対照: 実在せず ALLOW にもないパス
  printf 'broken: docs/handover/archive/gone_forever.md\n' > "$tmp/fixtures/positive-dead.md"

  echo "## 自己検査(陽性対照・陰性対照)"
  echo

  local n
  n=$(scan_file "$tmp/fixtures/negative-real.md" "$tmp" | wc -l)
  if [ "$n" -eq 0 ]; then echo "OK  陰性対照(実在パス) → 緑"
  else echo "NG  陰性対照(実在パス)を dead と誤検出した"; st_fail=1; fi

  n=$(scan_file "$tmp/fixtures/negative-allowed.md" "$tmp" | wc -l)
  if [ "$n" -eq 0 ]; then echo "OK  陰性対照(ALLOW 表の例示パス) → 緑"
  else echo "NG  陰性対照(例示パス)を dead と誤検出した"; st_fail=1; fi

  n=$(scan_file "$tmp/fixtures/positive-dead.md" "$tmp" | wc -l)
  if [ "$n" -eq 1 ]; then echo "OK  陽性対照(実在しないパス) → 赤"
  else echo "NG  陽性対照(実在しないパス)を検出できなかった"; st_fail=1; fi

  # 武装時の SKIP 判定(陽性対照・陰性対照)。base 配下に web/ を作らない状態で判定する。
  if is_unjudgeable "web/CLAUDE.md" 1 "$tmp"; then echo "OK  陽性対照(武装中・web/ 不在) → SKIP と判定"
  else echo "NG  武装中に web/ 配下を SKIP と判定できなかった"; st_fail=1; fi

  if is_unjudgeable "web/CLAUDE.md" 0 "$tmp"; then echo "NG  非武装なのに SKIP と判定した"; st_fail=1
  else echo "OK  陰性対照(非武装) → SKIP にしない"; fi

  if is_unjudgeable "docs/handover/gone.md" 1 "$tmp"; then echo "NG  武装中でも実在するトップ階層を SKIP と判定した"; st_fail=1
  else echo "OK  陰性対照(武装中・docs/ は実在) → SKIP にしない"; fi

  echo
  if [ "$st_fail" -eq 0 ]; then echo "自己検査: 合格(陽性は赤・陰性は緑)"; return 0; fi
  echo "自己検査: 不合格"; return 1
}

# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------
case "${1:-}" in
  --self-test)
    self_test
    exit $?
    ;;
  --list-allow)
    echo "# 例示として除外しているパス(陰性対照)"
    echo
    printf '%s\n' "${ALLOW[@]}"
    exit 0
    ;;
esac

TARGETS=(CLAUDE.md)
[ -f web/CLAUDE.md ] && TARGETS+=(web/CLAUDE.md)
while IFS= read -r f; do TARGETS+=("$f"); done < <(find .claude/rules -name '*.md' 2>/dev/null | sort)
while IFS= read -r f; do TARGETS+=("$f"); done < <(find .claude/commands -name '*.md' | sort)

echo "# dead file reference 検査"
echo
echo "対象 commit: \`$(git rev-parse --short HEAD 2>/dev/null || echo unknown)\` / 対象 ${#TARGETS[@]} ファイル"
echo "対象範囲: CLAUDE.md ／ web/CLAUDE.md ／ .claude/rules/*.md ＋ .claude/commands/*.md(ルール面)"
echo

ARMED=0
[ -f tmp/.design-desk-armed ] && ARMED=1
if [ "$ARMED" -eq 1 ]; then
  echo "★設計卓の武装を検出した。作業ツリーに無いトップ階層への参照は SKIP(未検査)にする。"
  echo
fi

FOUND=0
SKIPPED=0
for f in "${TARGETS[@]}"; do
  while IFS=$'\t' read -r src path; do
    [ -z "${path:-}" ] && continue
    if is_unjudgeable "$path" "$ARMED"; then
      printf 'SKIP %s → %s (武装中: %s/ が作業ツリーに無く判定できない)\n' "$src" "$path" "${path%%/*}"
      SKIPPED=$((SKIPPED + 1))
      continue
    fi
    printf 'NG  %s → %s (存在しない)\n' "$src" "$path"
    FOUND=$((FOUND + 1))
  done < <(scan_file "$f")
done

echo
if [ "$SKIPPED" -gt 0 ]; then
  echo "未検査: $SKIPPED 件(武装中のため判定できない参照)。武装していないセッションで再実行すること。"
  echo
fi
if [ "$FOUND" -eq 0 ]; then
  echo "結果: dead reference なし(例示 ${#ALLOW[@]} 件は ALLOW 表で除外。--list-allow で一覧)"
  exit 0
fi
echo "結果: dead reference $FOUND 件"
echo
echo "対処: 実パスへ修正するか、例示・プレースホルダであれば本スクリプトの ALLOW 表へ理由付きで追加する。"
exit 1

#!/usr/bin/env bash
# check-artifact-integrity.sh — 成果物と検査機構の健全性チェック(決定論・read-only)
#
# 背景: `environment-reliability-plan.md` §4「AI ツールの偽成功・出力破損」の実装
#   (2026-08-11 開発者裁定 21)。同 §4.1 の原則はこうである——
#   **ツールの成功メッセージ、AI の「変更した」という文章、画面上の完了表示は証拠ではない。**
#
#   本検査を書く過程で、その原則の実例が出た。引き継ぎ書は「常設の検査機構は
#   **すべて --self-test を持つ**」と書いていたが、**実際に走らせたら 1 本は持っていなかった**
#   (`check-enum-sync.sh`。本コミットで追加した)。資料の記述は証拠ではない。
#
# 本スクリプトが検査すること:
#   (1) 検査機構の自己検査 — `scripts/check-*.sh` が `--self-test` を持ち、それが通ること
#       「検査が緑」は「検査が機能している」ことの証拠にならないため、対照で確かめる
#   (2) 生成物の健全性 — 派生資料が実在し、非空で、行数がベースラインから激減していないこと
#       生成器が exit 0 でも中身が壊れていることがある(§4.2「生成処理 → 生成物」)
#
# 使い方:
#   bash scripts/check-artifact-integrity.sh              # リポジトリを検査
#   bash scripts/check-artifact-integrity.sh --list-allow # ALLOW 表(自己検査を免除する検査)
#   bash scripts/check-artifact-integrity.sh --self-test  # 陽性対照・陰性対照でこのスクリプト自身を検査
#
# 終了コード: 0=違反なし / 1=違反あり / 2=実行エラー
#
# 限界:
#   - **床であって証明ではない。** 行数の激減は捕まえるが、内容が意味的に壊れている
#     (例: 全行が同じ文字列)ことは検出しない。
#   - ベースラインは「現状値」であり目標値ではない。派生資料は源泉が増えれば増える。
#     **下方向にしか判定しない**(増加は正常)。
#   - §4.2 のうち **DB 変更の件数・不変条件** と **テストの失敗件数** は本検査の対象外
#     (実行のたびに変わる値で、静的な read-only 検査に載らない)。それらは製造 CLI 側の
#     手順で担保する。
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "ERROR: git リポジトリ内で実行してください" >&2
  exit 2
}
cd "$ROOT"

# ---------------------------------------------------------------------------
# ALLOW 表: 自己検査を持たなくてよい検査と、その理由
# ---------------------------------------------------------------------------
SELFTEST_ALLOW=(
  "check-derived-docs.sh :: 判定が git のコミット時刻の大小比較のみで、対照を作っても比較演算子を確かめるだけになる。誤りは出力の突合で気づける"
)

# ---------------------------------------------------------------------------
# 生成物のベースライン: 「パス :: 最低行数 :: 必須マーカー(空なら不問)」
#   最低行数は 2026-08-11 実測値のおよそ半分。**激減だけを捕まえる**ための値であり、
#   目標値ではない。実測値が恒常的に下回るようになったら本表を更新する。
# ---------------------------------------------------------------------------
ARTIFACTS=(
  "docs/handover/code-facts.md :: 560 :: 生成:"
  "docs/handover/docs-map.md :: 135 :: 生成:"
  "docs/handover/retrospective-digest.md :: 170 :: "
  "docs/human-notes/custom-commands.md :: 68 :: "
)

VIOLATIONS=0

note() { printf '  %s\n' "$*"; }
fail() { printf 'NG  %s\n' "$*"; VIOLATIONS=$((VIOLATIONS + 1)); }
ok()   { printf 'OK  %s\n' "$*"; }

is_selftest_allowed() {
  local base="$1" entry
  for entry in "${SELFTEST_ALLOW[@]}"; do
    [ "${entry%% :: *}" = "$base" ] && return 0
  done
  return 1
}

# ---------------------------------------------------------------------------
# 検査の単位(自己検査から再利用するため関数に切る)
# ---------------------------------------------------------------------------

# スクリプトが --self-test を宣言しているか。0=宣言あり / 1=なし
declares_selftest() {
  grep -q -- '--self-test' "$1" 2>/dev/null
}

# 実際に走らせて、**対照が実行された証拠**(合格マーカー)が出るか。0=出る / 1=出ない
#
# ★2026-08-11 クリーンルームレビュー 高 1 の是正。
#   旧実装は「`--self-test` の**文字列が出現する**」＋「その引数で **exit 0**」しか見ておらず、
#   **冒頭コメントに使い方を書いただけで引数を無視して正常終了するスクリプトが緑になった**。
#   これは本検査が生まれた原因(`check-enum-sync.sh` が self-test を持たなかった)と同じ形の再発だった。
#   ⇒ **出力に対照の結果マーカーを要求する。** 宣言だけでは通らない。
SELFTEST_MARKER='自己検査: 合格'

selftest_passes() {
  bash "$1" --self-test 2>/dev/null | grep -qF -- "$SELFTEST_MARKER"
}

# 生成物が健全か。0=健全 / 1=不健全(理由を stdout へ)
artifact_ok() {
  local path="$1" min="$2" marker="$3" lines
  if [ ! -f "$path" ]; then echo "存在しない"; return 1; fi
  if [ ! -s "$path" ]; then echo "空ファイル"; return 1; fi
  lines="$(wc -l < "$path")"
  if [ "$lines" -lt "$min" ]; then
    echo "行数 $lines がベースライン下限 $min を下回る(生成が途中で壊れた可能性)"
    return 1
  fi
  if [ -n "$marker" ] && ! grep -qF -- "$marker" "$path"; then
    echo "必須マーカー '$marker' が無い(生成ヘッダが欠落している)"
    return 1
  fi
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

  echo "## 自己検査(陽性対照・陰性対照)"
  echo

  # --- (1) 自己検査の宣言 ---
  printf '%s\n' '案内: --self-test を持つ' > "$tmp/with.sh"
  # ★実装のあるスクリプト / 宣言だけのスクリプト(レビュー 高 1 の陽性対照)
  printf '#!/usr/bin/env bash\necho "自己検査: 合格"\n' > "$tmp/real.sh"
  printf '#!/usr/bin/env bash\n# 使い方: bash x.sh --self-test\necho "検査しました"\nexit 0\n' > "$tmp/bogus.sh"
  printf '%s\n' '案内: 対照を持たない' > "$tmp/without.sh"

  if declares_selftest "$tmp/with.sh"; then
    ok "陰性対照(--self-test あり) → 緑"
  else
    echo "NG  陰性対照(--self-test あり)が赤になった(誤検出)"; st_fail=1
  fi
  if declares_selftest "$tmp/without.sh"; then
    echo "NG  陽性対照(--self-test なし)が緑になった(検出漏れ)"; st_fail=1
  else
    ok "陽性対照(--self-test なし) → 赤"
  fi

  # ★宣言だけで実装が無いものを弾けるか(レビュー 高 1)
  if selftest_passes "$tmp/real.sh"; then
    ok "陰性対照(合格マーカーを出す) → 緑"
  else
    echo "NG  陰性対照(合格マーカーを出す)が赤になった(誤検出)"; st_fail=1
  fi
  if selftest_passes "$tmp/bogus.sh"; then
    echo "NG  陽性対照(宣言だけで実装なし)が緑になった(検出漏れ)"; st_fail=1
  else
    ok "陽性対照(宣言だけで実装なし) → 赤"
  fi

  # --- (2) 生成物の健全性 ---
  seq 1 200 > "$tmp/healthy.md"
  printf '生成: 2026-08-11\n' >> "$tmp/healthy.md"
  seq 1 10 > "$tmp/truncated.md"
  : > "$tmp/empty.md"
  seq 1 200 > "$tmp/nomarker.md"

  if artifact_ok "$tmp/healthy.md" 100 "生成:" >/dev/null; then
    ok "陰性対照(健全な生成物) → 緑"
  else
    echo "NG  陰性対照(健全な生成物)が赤になった(誤検出)"; st_fail=1
  fi

  local ctl
  for ctl in "truncated:行数の激減" "empty:空ファイル" "nomarker:必須マーカー欠落"; do
    local f="${ctl%%:*}" desc="${ctl#*:}"
    if artifact_ok "$tmp/$f.md" 100 "生成:" >/dev/null; then
      printf 'NG  陽性対照(%s)が緑になった(検出漏れ)\n' "$desc"; st_fail=1
    else
      ok "陽性対照($desc) → 赤"
    fi
  done

  if artifact_ok "$tmp/does-not-exist.md" 100 "" >/dev/null; then
    echo "NG  陽性対照(存在しない)が緑になった(検出漏れ)"; st_fail=1
  else
    ok "陽性対照(存在しない) → 赤"
  fi

  # --- (3) ALLOW 表 ---
  if is_selftest_allowed "check-derived-docs.sh"; then
    ok "ALLOW 表の免除対象を除外できる"
  else
    echo "NG  ALLOW 表が引けていない"; st_fail=1
  fi
  if is_selftest_allowed "check-doc-refs.sh"; then
    echo "NG  ALLOW 表に無い検査を免除してしまった"; st_fail=1
  else
    ok "ALLOW 表に無い検査は免除しない"
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
  echo "# ALLOW 表(自己検査を持たなくてよい検査)"
  echo
  echo "| スクリプト | 免除の理由 |"
  echo "|---|---|"
  for entry in "${SELFTEST_ALLOW[@]}"; do
    printf '| `%s` | %s |\n' "${entry%% :: *}" "${entry#* :: }"
  done
  exit 0
fi

echo "# 成果物・検査機構の健全性チェック"
echo
echo "対象 commit: \`$(git rev-parse --short HEAD 2>/dev/null || echo unknown)\`"
echo
echo '> **前提**: ツールの成功表示・資料の記述は証拠ではない。独立に走らせて確かめる'
echo '> (`environment-reliability-plan.md` §4.1)。'
echo

echo "## 1. 検査機構の自己検査"
echo

checked=0
allowed=0
while IFS= read -r script; do
  [ -n "$script" ] || continue
  base="$(basename "$script")"
  [ "$base" = "check-artifact-integrity.sh" ] && continue  # 自分自身は下で扱う

  if is_selftest_allowed "$base"; then
    allowed=$((allowed + 1))
    continue
  fi

  checked=$((checked + 1))
  if ! declares_selftest "$script"; then
    fail "$script が --self-test を宣言していない"
    note "対照が無い検査は、壊れても緑を返し続ける(本検査が生まれた理由)"
    continue
  fi
  if selftest_passes "$script"; then
    ok "$base の自己検査が通る"
  else
    fail "$base の --self-test が「$SELFTEST_MARKER」を出力しない"
    note "宣言だけで実装が無い／対照が落ちている可能性。再現: bash $script --self-test"
  fi
done < <({ find scripts -maxdepth 1 -name 'check-*.sh' -type f 2>/dev/null
           # 検査ではないが living document を書き換えるため、自己検査を必須にする
           ls scripts/archive-resolved.sh 2>/dev/null
           # 設計卓の武装機構(2026-08-11 新設)。作業ツリーを削る／ツール実行を止めるため、
           # 壊れていると「守れていないのに守れているように見える」。対を成す 2 本まとめて対象にする。
           ls scripts/design-desk-arm.sh 2>/dev/null
           ls .claude/hooks/design-desk-guard.sh 2>/dev/null
           # ★リリース本文の生成器(M36-02・射程 6)。名前が check-* でないため
           #   上の find では拾われない。⇒ **対照を 6 件持っているのに誰も回さない**
           #   状態になっていた(M36-02 レビュー 高-2)。⇒ 明示して走査対象へ入れる。
           #   ★同スクリプトが空振りすると「検証手順の無いリリースページ」が出る。
           ls scripts/generate-release-notes.sh 2>/dev/null; } | sort -u)

if [ "$checked" -eq 0 ]; then
  fail "検査対象のスクリプトが 1 件も見つからない(本検査が空回りしている可能性)"
else
  note "検査 $checked 件 / ALLOW 除外 $allowed 件"
fi

echo
echo "## 2. 生成物の健全性"
echo

for entry in "${ARTIFACTS[@]}"; do
  path="${entry%% :: *}"
  rest="${entry#* :: }"
  min="${rest%% :: *}"
  marker="${rest#* :: }"

  if reason="$(artifact_ok "$path" "$min" "$marker")"; then
    ok "$path"
  else
    fail "$path: $reason"
  fi
done

echo
if [ "$VIOLATIONS" -eq 0 ]; then
  echo "結果: 違反なし"
  exit 0
fi
echo "結果: 違反 $VIOLATIONS 件"
echo
echo "§4.1 の原則: 成功表示は証拠ではない。生成器が exit 0 でも生成物が壊れていることがある。"
echo "生成物が縮んだ場合は、まず再生成してから本検査を回し直すこと(それでも赤なら源泉側の問題)。"
exit 1

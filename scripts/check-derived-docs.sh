#!/usr/bin/env bash
# 派生資料の鮮度監査: 「源泉の最終コミットが派生物の最終コミットより新しければ警告」。
#
# 背景: code-facts / docs-map / retrospective-digest / custom-commands はいずれも
#   「源泉から生成・蒸留される派生物」だが、再生成は人の記憶頼みだった。
#   CLAUDE.md の約1年の陳腐化や followup-backlog の M 番号未同期は、この
#   「派生物の鮮度を機械監視する層」の欠如が根因(改善レーン報告書 §5-2-5)。
#
# 判定は git log の最終コミット時刻の比較(read-only。git 書込は行わない)。
# 使い方: bash scripts/check-derived-docs.sh
#   終了コード: 常に 0(情報提供目的。陳腐化の有無はレポート本文で判断する)
#
# 限界:
#   - コミット時刻ベースのため、未コミットの作業ツリー変更は見えない(§2 で補助表示)。
#   - 「源泉が変わった=派生物の内容が必ず変わる」ではない(空振り警告がありうる。
#     再生成して差分ゼロならそれで陳腐化解消とみなす)。
set -uo pipefail

# ★2026-08-11 playbook 全面監査の是正。
#   本検査は **自己検査を持たない**（`check-artifact-integrity.sh` の ALLOW 表に
#   理由つきで登録してある: 判定が git のコミット時刻の大小比較のみのため）。
#   ところが旧実装は **引数を一切見ておらず、`--self-test` を渡すと通常レポートを
#   exit 0 で返していた**——**自己検査が通ったように見えるが、何も検査していない。**
#   本セッションで 2 度出た「緑は見えていないだけ」型なので、明示的に拒否する。
case "${1:-}" in
  "") ;;
  --self-test)
    echo "本検査は自己検査を持たない（意図的な免除）。" >&2
    echo "理由: bash scripts/check-artifact-integrity.sh --list-allow" >&2
    exit 2 ;;
  *)
    echo "ERROR: 不明な引数: $1（本検査は引数を取らない）" >&2
    exit 2 ;;
esac

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

# ---------------------------------------------------------------------------
# 監査対象の定義: 「派生物パス :: 源泉 pathspec(空白区切り)」
#   pathspec には除外(:!)を使える。新しい派生資料を追加したらここに1行足す。
# ---------------------------------------------------------------------------
PAIRS=(
  "docs/handover/code-facts.md :: internal web/src migrations scripts/generate-code-facts.sh"
  "docs/handover/docs-map.md :: docs :!docs/handover/code-facts.md :!docs/handover/docs-map.md scripts/generate-docs-map.sh"
  "docs/handover/retrospective-digest.md :: docs/handover/retrospective-log.md"
  "docs/human-notes/custom-commands.md :: .claude/commands"
)

# 再生成手段の案内(派生物パス → 手段)
regen_hint() {
  case "$1" in
    docs/handover/code-facts.md)             echo "/regen_code_facts" ;;
    docs/handover/docs-map.md)               echo "/regen_docs_map" ;;
    docs/handover/retrospective-digest.md)   echo "/retrospective-digest-update" ;;
    docs/human-notes/custom-commands.md)     echo "/sync_command_catalog" ;;
    *)                                       echo "(手動)" ;;
  esac
}

# ---------------------------------------------------------------------------
# 掲載差分による判定(2026-09-13 追加・D-856)
#
# 背景: custom-commands.md は **手書きのカタログ**であり、写しているのは
#   「コマンド名と 1 行説明」だけである。ところが源泉 .claude/commands/ の
#   **本文**を直すだけでもコミット時刻は動くため、カタログの内容が正しいまま
#   ⚠ が出続けていた(実測 13/34 件・38%、掲載漏れ 0 件・実体消失 0 件)。
#
# ⇒ 警報が鳴りっぱなしになると、読む側は「例のやつ」と読み飛ばす習慣がつき、
#   **本当に掲載漏れが起きた日にも読み飛ばす**。時刻ではなく掲載差分で判定する。
#
# ★逆方向の見逃しも消える: 旧実装は、掲載漏れが起きていても同じ手番でカタログを
#   触っていれば ✅ を返した。
#
# コマンド名 = .claude/commands/ からの相対パスの .md を除いたもの。`/` は `:` へ
#   (Claude Code の名前空間。例 old/resume_milestone_kit → old:resume_milestone_kit)。
# ---------------------------------------------------------------------------
catalog_gap() {
  # 出力: "<未掲載件数> <実体消失件数> <実体総数>"
  local catalog="$1" dir=".claude/commands"
  local entity listed missing_entry missing_file total
  entity="$(find "$dir" -name '*.md' 2>/dev/null | sed "s|^$dir/||; s|\.md$||; s|/|:|g" | LC_ALL=C sort)"
  listed="$(grep -o '^`/[A-Za-z0-9_:-]*' "$catalog" 2>/dev/null | sed 's|^`/||' | LC_ALL=C sort -u)"
  missing_entry="$(comm -23 <(printf '%s\n' "$entity") <(printf '%s\n' "$listed") | grep -c . || true)"
  missing_file="$(comm -13 <(printf '%s\n' "$entity") <(printf '%s\n' "$listed") | grep -c . || true)"
  total="$(printf '%s\n' "$entity" | grep -c . || true)"
  echo "${missing_entry:-0} ${missing_file:-0} ${total:-0}"
}

echo "# 派生資料 鮮度監査"
echo
echo "生成: $(date '+%Y-%m-%d') / commit \`$(git rev-parse --short HEAD 2>/dev/null || echo unknown)\` / \`scripts/check-derived-docs.sh\`"
echo
echo "## 1. 判定(源泉の最終コミット vs 派生物の最終コミット)"
echo
echo "| 派生物 | 派生物の最終コミット | 源泉の最終コミット | **源泉の変化量** | 判定 | 再生成手段 |"
echo "|---|---|---|---|---|---|"

stale=0
for pair in "${PAIRS[@]}"; do
  derived="${pair%% :: *}"
  src_spec="${pair#* :: }"

  if [ ! -e "$derived" ]; then
    echo "| $derived | (ファイルなし) | - | - | ⚠ 派生物が存在しない | $(regen_hint "$derived") |"
    stale=1
    continue
  fi

  d_ct="$(git log -1 --format='%ct' -- "$derived" 2>/dev/null || echo 0)"
  d_info="$(git log -1 --format='%h %ad' --date=short -- "$derived" 2>/dev/null || echo '-')"
  d_sha="$(git log -1 --format='%H' -- "$derived" 2>/dev/null || echo '')"

  # shellcheck disable=SC2086  # pathspec は意図的に単語分割する
  s_ct="$(git log -1 --format='%ct' -- $src_spec 2>/dev/null || echo 0)"
  # shellcheck disable=SC2086
  s_info="$(git log -1 --format='%h %ad' --date=short -- $src_spec 2>/dev/null || echo '-')"

  # --- 変化量(2026-08-11 追加) ---
  # 「古い」と「使えない」は別である。生成日しか見えないと、読む側は安全側に倒して
  # **資料を丸ごと無視する**しかない。実際にそれが起きた(並列期に派生資料のメンテが
  # 止まり、設計卓が「完全に陳腐化した」と誤解して使わなくなった)。
  # ⇒ 源泉のうち何件が変わったかを出し、**部分的な古さと全面的な無効を区別できるようにする**。
  changed="-"; total="-"
  if [ -n "$d_sha" ]; then
    # shellcheck disable=SC2086
    changed="$(git diff --name-only "$d_sha" HEAD -- $src_spec 2>/dev/null | wc -l | tr -d ' ')"
    # shellcheck disable=SC2086
    total="$(git ls-files -- $src_spec 2>/dev/null | wc -l | tr -d ' ')"
  fi

  # ★掲載差分で判定する派生物(D-856)。時刻ではなく中身の差で見る。
  if [ "$derived" = "docs/human-notes/custom-commands.md" ]; then
    read -r gap_entry gap_file gap_total <<<"$(catalog_gap "$derived")"
    if [ "${gap_entry:-0}" -eq 0 ] && [ "${gap_file:-0}" -eq 0 ]; then
      echo "| $derived | $d_info | $s_info | **掲載差分 0**(実体 ${gap_total} 件) | ✅ 最新(**★掲載差分で判定**) | - |"
    else
      echo "| $derived | $d_info | $s_info | **未掲載 ${gap_entry} 件 / 実体消失 ${gap_file} 件**(実体 ${gap_total} 件) | ⚠ **掲載差分あり** | $(regen_hint "$derived") |"
      stale=1
    fi
    continue
  fi

  if [ "${s_ct:-0}" -gt "${d_ct:-0}" ]; then
    if [ "$changed" != "-" ] && [ "$total" != "-" ] && [ "${total:-0}" -gt 0 ]; then
      pct="$(awk "BEGIN{printf \"%.0f\", ($changed/$total)*100}")"
      delta="**${changed}** / ${total} 件(${pct}%)"
    else
      delta="(算出不可)"
    fi
    echo "| $derived | $d_info | $s_info | $delta | ⚠ **陳腐化疑い**(源泉が新しい) | $(regen_hint "$derived") |"
    stale=1
  else
    echo "| $derived | $d_info | $s_info | 0 / ${total} 件 | ✅ 最新 | - |"
  fi
done
echo
echo "> **★変化量の読み方(全否定を避けるため)。** 「源泉が新しい」は**資料が丸ごと無効という意味ではない**。"
echo "> 変化量が小さければ、**変わった領域だけ実物で確認し、他の節はそのまま使ってよい**。"
echo '> 生成日だけを見て資料を捨てると、`code-facts` を引かずに想定で書く状態へ逆戻りする'
echo "> (retrospective-log §1 パターン A/C「実コード確認の省略」＝最頻出ミス)。"
echo "> **最終的な正は常に実物**であり、それは陳腐化していないときも同じである。"
echo
echo '> **★`custom-commands.md` だけは判定軸が違う(2026-09-13・`D-856`)。** 同書は**手書きのカタログ**であり、'
echo "> 写しているのは**コマンド名と 1 行説明**だけである。⇒ 源泉の**本文**を直してもカタログは古くならない。"
echo "> **そこで時刻ではなく掲載差分**(未掲載 / 実体消失)**で判定する。**"
echo ">"
echo "> **★これは逆方向の見逃しも消す**——旧実装は、掲載漏れが起きていても同じ手番でカタログを触っていれば ✅ を返した。"
echo

# ---------------------------------------------------------------------------
# §2 補助: 未コミットの源泉変更(コミット時刻比較では見えないため参考表示)
# ---------------------------------------------------------------------------
echo "## 2. 補助: 未コミットの作業ツリー変更(参考)"
echo
uncommitted="$(git status --porcelain -- internal web/src migrations docs .claude/commands 2>/dev/null | head -20)"
if [ -n "$uncommitted" ]; then
  echo '```'
  printf '%s\n' "$uncommitted"
  echo '```'
  echo "未コミット変更は §1 の判定に反映されない。コミット後に再実行すること。"
else
  echo "なし。"
fi
echo
if [ "$stale" = 1 ]; then
  echo "> ⚠ 陳腐化疑いあり。該当の再生成手段を実行し、差分ゼロなら陳腐化解消とみなしてよい。"
else
  echo "> すべて最新。"
fi
echo
echo "---"
echo "*以上。本レポートは stdout 出力のみで、リポジトリ内のファイルは変更していない。*"

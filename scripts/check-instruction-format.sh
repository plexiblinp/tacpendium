#!/usr/bin/env bash
# check-instruction-format.sh — 指示書の書式検査(決定論・read-only)
#
# 背景: `prompt-quality-improvement-plan.md` §5.1「blocking にできる検査」の未実装分。
#   同節は 6 つの検査を挙げるが、2026-08-11 の実測では 2.5 本しか実装されていなかった。
#   本スクリプトはそのうち 2 つを実装する。
#
# 検査:
#   (1) 版数不一致 — 冒頭メタ表の `| バージョン | X.Y.Z |` と 末尾の `… vX.Y.Z。` の照合
#   (2) 禁則表現   — playbook §4.1 のリストに載る曖昧語の使用
#   (3) チェックリストの「対象指示書」欄の版数 ⇄ 指示書本体の版数の照合
#       (2026-08-30 追加。**M24-05 / D-604 / 計測点 M-95** が動機)
#
# **★(3) を足した理由**(2026-08-30)
#   M24-05 で、設計卓が指示書を v1.1.0 へ改版したのにチェックリストを v1.0.0 のまま残した。
#   チェックリストは「実査 12 件」「E2E 4 ケース」「破壊確認 5 件」と書き続け、
#   指示書 v1.1.0 の実態(9 件 / 3 ケース / 3 件)と食い違ったまま実装が走った。
#   **本検査は当時 (1) しか持たず、「指示書の中で版数が揃っているか」しか見ていなかったため
#   この版ずれを緑のまま通した。** 製造からの提案で (3) を足した。
#   **★実害は出なかった**(製造は指示書 v1.1.0 を正として作業し、レビューも同じ突合に到達した)。
#   **⇒ 次は運任せにしない、というだけの理由で足している。**
#
# **★実装しなかった 1 つ: 「CHANGE 参照版の不一致」**
#   実測(2026-08-11)——CHANGE の参照は `CHANGE-086` のような **番号のみ**で、
#   `docs/change-notes/` 側にもバージョン欄が無い。**版で参照する運用そのものが存在しない**ため、
#   検査が成立しない。監査タスク B の「タスク B の想定は本プロジェクトに当てはまらなかった」と同じ構造。
#
# 使い方:
#   bash scripts/check-instruction-format.sh
#   bash scripts/check-instruction-format.sh --list-allow  版数不一致の ALLOW 表
#   bash scripts/check-instruction-format.sh --list        禁則表現の内訳(ベースライン更新時に使う)
#   bash scripts/check-instruction-format.sh --self-test
#
# 終了コード: 0=違反なし / 1=違反あり / 2=実行エラー
#
# 限界:
#   - **禁則表現はベースライン固定型**。「あれば」は「〜であれば」等の正常な用法にも一致するため
#     **件数そのものは誤検出を含む**。**ベースラインから増えたかだけを見る**
#   - **★判定はコーパス全体の総数差分である**(2026-08-11 レビュー 中 10 で明示化)。
#     新規指示書で 2 件増えても、同じ回に別ファイルで 2 件減れば **相殺されて緑になる**。
#     語別の内訳は `--list` で見られるので、**差分が 0 でも新規ファイルは目視すること**。
#     (`check-enum-sync.sh` と同じ流儀。裁定 21＝「単なる warn 出力は採らない。実効性があるのは
#     ベースライン固定型か完了報告テンプレの必須欄」)。
#   - 版数は「冒頭メタ表」と「末尾の締め文」の 2 か所に書く運用が前提。
#     どちらかが無いファイルは対象外(overview / RESEARCH の一部)。
#   - **★対象は `docs/instructions/` の直下だけである**(2026-08-11 レビュー 高 4 で明示化)。
#     `phase1/` `phase2/` `phase3/` はアーカイブで、**すべて完了済み＝D-274 (3) により本文を
#     書き換えない**ため見ない。実測では対象外領域に版数を両方持つファイルが 155 件あり、
#     **うち 51 件が不一致**だが、いずれも是正しない。
#     `reviews/` も同様に完了済みサブのチェックリストなので版数検査からは外す
#     (**禁則表現の検査には含める**——こちらは playbook §4.1 が明示的に対象としているため)。
#     **「見ない」ことと ALLOW で「理由つきで免除する」ことは別である。**
#     ALLOW 表(`--list-allow`)に載るのは**直下の 9 件だけ**で、アーカイブの 51 件は含まない。
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "ERROR: git リポジトリ内で実行してください" >&2
  exit 2
}
cd "$ROOT"

INSTR_DIR="docs/instructions"
REVIEW_DIR="docs/instructions/reviews"

# ---------------------------------------------------------------------------
# (1) 版数不一致の ALLOW 表
#
# **完了済みサブの指示書は本文を書き換えない**(裁定 **D-274 (3)**——当時どう指示したかの
# 記録であり、実装指示としてはもう読まれないが検索には当たる)。
# したがって既存の不一致は**是正せず ALLOW へ入れる**。
# **新規に書かれる指示書で不一致が出たら赤**にするのが本検査の目的である。
# ---------------------------------------------------------------------------
VERSION_ALLOW=(
  "M19-04b-chain-cancel-and-derivations.md :: 完了済み(冒頭 1.1.1 / 末尾 1.1.0)。D-274 (3) により本文を書き換えない"
  "M19-04c-data-corrections.md :: 完了済み(冒頭 1.4.2 / 末尾 1.2.0)。同上"
  "M19-04d-integration-catchup.md :: 完了済み(冒頭 1.1.1 / 末尾 1.1.0)。同上"
  "M19-04-frame-cost-columns.md :: 完了済み(冒頭 1.2.0 / 末尾 1.0.0)。同上"
  "M14-02-import-pipeline-staged-removal.md :: 完了済み(冒頭 1.0.1 / 末尾 1.0.0)。同上"
  "M14-03a-e2e-recovery-backfill.md :: 完了済み(冒頭 1.0.1 / 末尾 1.0.0)。同上"
  "M14-03b-distribution-seed.md :: 完了済み(冒頭 2.3.0 / 末尾 2.2.0)。同上"
  "M14-03-distribution-seed.md :: 完了済み(冒頭 1.1.0 / 末尾 1.0.0)。同上"
  "M14-03d-second-wave-manon.md :: 完了済み(冒頭 1.0.2 / 末尾 1.0.0)。同上"
)

# ---------------------------------------------------------------------------
# (2) 禁則表現。playbook §4.1「禁則表現リスト」の写し。
#     ★ここを増やすときは playbook §4.1 を正本として同期すること。
# ---------------------------------------------------------------------------
FORBIDDEN=(
  "あれば"
  "必要に応じて"
  "実装時に決定"
  "任意で"
  "適切に"
  "していれば不要"
  "動作するはず"
  "副次効果として"
  "自動的に"
)

# 2026-08-11 実測のベースライン。**誤検出を含む既知件数であり目標値ではない。**
# 「新たに増えた分」を見えるようにするためだけに置く。減ったら本値を下げること。
#
# 2026-08-12: 73 -> 74。増分 1 件は M21-RESEARCH-01 §C の 1 行で、
#   REQ-001 §3.1 FR107 の本文「適切に読み取る」を **逐語引用** したもの。
#   同行は直後に「逐語引用。本指示書が『適切に』と指示しているのではない」と明記している。
#   要件本文の引用を書き換えると引用でなくなるため、言い換えではなくベースライン更新で処理した。
#   **増加方向の更新はこの型(引用・固有名詞)に限る。** 指示文そのものの曖昧語は言い換えること。
#
# 2026-08-23: 74 -> 75。増分 1 件は M23-09 §1.1 の 1 行で、
#   開発者の要望を **逐語引用** したもの(「登録時に同一のレシピであれば、いったんダイアログを…」)。
#   同行の直後に「上記は開発者の逐語引用である。本指示書が『あれば』という曖昧語で
#   指示しているのではない」と明記してある。
#   要望の引用を書き換えると引用でなくなるため、上記の型に従いベースライン更新で処理した。
#
# 2026-08-25: 75 -> 76。増分 1 件は M24-overview §1.5 の 1 行で、
#   開発者の要請を **逐語引用** したもの(「…M24 は画面修正が多く、外出先で指示を出すことも
#   多いので、要請があればこの方針でいきたい。」)。
#   同節は直後に運用の規則を 6 点の表で確定させており、
#   本書が「あれば」という曖昧語で指示しているのではない。
#   要請の引用を書き換えると引用でなくなるため、上記の型に従いベースライン更新で処理した。
# 2026-08-27: 76 -> 78。増分 2 件は M24-04 指示書(§4.3 と更新履歴)の 1 つの
#   **開発者の逐語引用**が 2 箇所に現れたもの
#   (「20もあれば特殊なコンボを対象にする場合も足りるはずですが、20の根拠が薄いため、
#     ラベルが違和感を出しているのだと気づきました。」)。
#   同節は直後に「上限をラベルに書くのは根拠が説明できるときだけ」という規則を
#   確定させており、本書が「あれば」という曖昧語で指示しているのではない。
#   ★引用の一部を削ると引用でなくなる(M-82 = 要約列が原文を切っていた型と同じ)。
#   ⇒ 2026-08-25 の 75 -> 76 と同じ型に従い、ベースライン更新で処理した。
# 2026-08-29: 78 -> 79 -> 78(同日中に戻した)。
#   一度 79 へ上げた増分 1 件は M24-06 指示書 v1.0.0 §4.3 の memo 逐語引用
#   (「キャラ指定も任意で可能としたい」)だったが、同日の v1.1.0 で §4.3 を
#   「エクスポート画面の廃止(第2段)」へ書き直した際に当該行ごと差し替わり、
#   引用が本文から消えた(D-591 / 計測点 M-93)。
#   ⇒ 増分の原因が無くなったのでベースラインを 78 へ戻した。
#   ★教訓: 引用を理由にベースラインを上げたら、その引用が残っているかを
#     指示書の改訂のたびに確かめること。上げっぱなしにすると床が下がる。
BASELINE_FORBIDDEN=78

# ---------------------------------------------------------------------------
# (3) チェックリストの版ずれ。2026-08-30 実測のベースライン。
#
# **★これもベースライン固定型である。** 完了済みサブのチェックリストは本文を書き換えない
# (**D-274 (3)**)ため、既存の不一致は是正しない。実測 16 件はすべて完了済みサブであり、
# ほとんどが「指示書だけ後から errata で patch 版を上げた」形である。
#
# **★本検査の値打ちは「進行中のサブで版ずれが起きたら赤にする」ことだけにある。**
# 過去の 16 件を直しても何も守られない。
# ---------------------------------------------------------------------------
# 2026-08-30 実測 = 14 件。判定不能 1 件(`M14-03-review-checklist.md` の対象指示書欄が
#   `M14-03b-distribution-seed-data.md` を指しているが、実体は `M14-03b-distribution-seed.md`
#   である。完了済みサブなので是正しない)。
#   **★「対象指示書」欄そのものを持たないチェックリストが 13 件ある**(M20 / M21 期に多い。
#   古い書式)。**それらは検査できない。⇒ 欄を持たせる運用にするかは開発者の手番へ回した。**
BASELINE_CHECKLIST_MISMATCH=14

VIOLATIONS=0
note() { printf '  %s\n' "$*"; }
fail() { printf 'NG  %s\n' "$*"; VIOLATIONS=$((VIOLATIONS + 1)); }
ok()   { printf 'OK  %s\n' "$*"; }

is_version_allowed() {
  local base="$1" e
  for e in "${VERSION_ALLOW[@]}"; do
    [ "${e%% :: *}" = "$base" ] && return 0
  done
  return 1
}

# ---------------------------------------------------------------------------
# 検査の単位(自己検査から再利用する)
# ---------------------------------------------------------------------------

# 冒頭メタ表の版数。無ければ空
head_version() {
  grep -m1 -oE '^\| *バージョン *\| *\**[0-9]+\.[0-9]+\.[0-9]+' "$1" 2>/dev/null \
    | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1
}

# 末尾の締め文の版数。無ければ空
tail_version() {
  tail -5 "$1" 2>/dev/null | grep -oE 'v[0-9]+\.[0-9]+\.[0-9]+' | head -1 | tr -d 'v'
}

# チェックリストの「対象指示書」欄が指す指示書のパス。無ければ空
#
# **★バッククォートの位置がずれている行がありうる**(実測＝`M24-12-review-checklist.md` の
#   `` `docs/instructions/`M24-12-editor-rebuild.md` ``)。**パスは行全体から拾う。**
checklist_target_path() {
  grep -m1 '^| *対象指示書 *|' "$1" 2>/dev/null | tr -d '`' \
    | grep -oE 'docs/instructions/[A-Za-z0-9._-]+\.md' | head -1
}

# チェックリストの「対象指示書」欄に書かれた版数。無ければ空
checklist_target_version() {
  grep -m1 '^| *対象指示書 *|' "$1" 2>/dev/null | tr -d '`' \
    | grep -oE 'v[0-9]+\.[0-9]+\.[0-9]+' | head -1 | tr -d 'v'
}

# 版数検査の対象外か。0=対象外
#
# **★overview は対象外にする**(2026-08-11・本検査を初回実行して判明)。
#   overview の末尾は「**最後に承認された版**」を書く運用で、冒頭メタ表の現行版
#   (自由改訂・errata を含む)と**意図的に食い違う**。実例＝`phase3-overview.md` は
#   冒頭 1.1.4(自由改訂 2026-08-07 まで) / 末尾「v1.1.0(**承認済み**・2026-07-02)」。
#   **これは不一致ではなく別の意味の 2 つの版**であり、揃えると承認の記録が消える。
is_out_of_scope() {
  case "$(basename "$1")" in
    *overview*.md) return 0 ;;
    *) return 1 ;;
  esac
}

# 版数が一致するか。0=一致 or 判定不能 / 1=不一致
version_ok() {
  local f="$1" h t
  is_out_of_scope "$f" && return 0
  h="$(head_version "$f")"; t="$(tail_version "$f")"
  [ -z "$h" ] || [ -z "$t" ] && return 0   # どちらか欠けていれば対象外
  [ "$h" = "$t" ]
}

# 1 語の出現数。-H を付ける: 単一ファイルだと `grep -rc` は "count" だけを返し "file:count" にならない
count_one() {
  local w="$1"; shift
  grep -rHc -- "$w" "$@" 2>/dev/null | awk -F: '{s+=$NF} END{print s+0}'
}

# 禁則表現の総出現数
count_forbidden() {
  local total=0 w
  for w in "${FORBIDDEN[@]}"; do
    total=$((total + $(count_one "$w" "$@")))
  done
  echo "$total"
}

# ---------------------------------------------------------------------------
# 自己検査
# ---------------------------------------------------------------------------
self_test() {
  local tmp st=0
  tmp="$(mktemp -d)" || { echo "ERROR: mktemp 失敗" >&2; exit 2; }
  # shellcheck disable=SC2064
  trap "rm -rf '$tmp'" EXIT

  printf '| バージョン | 1.2.0 |\n\n本文\n\n*以上、M9-01 製造指示書 v1.2.0。*\n' > "$tmp/match.md"
  printf '| バージョン | 1.2.0 |\n\n本文\n\n*以上、M9-01 製造指示書 v1.0.0。*\n' > "$tmp/mismatch.md"
  printf '| バージョン | **1.2.0** |\n\n本文\n\n*以上、M9-01 製造指示書 v1.2.0。*\n' > "$tmp/bold.md"
  printf '本文だけ\n' > "$tmp/noversion.md"
  printf '通常の文章です。\n' > "$tmp/clean.md"
  printf '必要に応じて適切に対応してください。\n' > "$tmp/dirty.md"

  echo "## 自己検査(陽性対照・陰性対照)"
  echo

  # --- 版数 ---
  if version_ok "$tmp/match.md"; then ok "陰性対照(版数一致) → 緑"; else echo "NG  陰性対照(版数一致)が赤"; st=1; fi
  if version_ok "$tmp/bold.md"; then ok "陰性対照(太字の版数) → 緑"; else echo "NG  陰性対照(太字の版数)が赤"; st=1; fi
  if version_ok "$tmp/noversion.md"; then ok "陰性対照(版数なし=対象外) → 緑"; else echo "NG  陰性対照(版数なし)が赤"; st=1; fi
  if version_ok "$tmp/mismatch.md"; then echo "NG  陽性対照(版数不一致)が緑になった(検出漏れ)"; st=1; else ok "陽性対照(版数不一致) → 赤"; fi

  # --- 禁則表現 ---
  local c_clean c_dirty
  c_clean="$(count_forbidden "$tmp/clean.md")"
  c_dirty="$(count_forbidden "$tmp/dirty.md")"
  if [ "$c_clean" -eq 0 ]; then ok "陰性対照(禁則表現なし) → 0 件"; else echo "NG  陰性対照が $c_clean 件"; st=1; fi
  if [ "$c_dirty" -ge 2 ]; then ok "陽性対照(禁則表現 2 件) → 検出できる"; else echo "NG  陽性対照が $c_dirty 件"; st=1; fi

  # --- ALLOW 表 ---
  if is_version_allowed "M19-04b-chain-cancel-and-derivations.md"; then
    ok "ALLOW 表の既知不一致を除外できる"
  else echo "NG  ALLOW 表が引けていない"; st=1; fi
  if is_version_allowed "M19-07-bundled-setup-verified-conditions.md"; then
    echo "NG  ALLOW 表に無いファイルを除外してしまった"; st=1
  else ok "ALLOW 表に無いファイルは除外しない"; fi

  # --- チェックリストの対象指示書欄 ---
  printf '| 対象指示書 | `docs/instructions/M9-01-foo.md` **v1.2.0** |\n' > "$tmp/cl-ok.md"
  printf '| 対象指示書 | `docs/instructions/`M9-01-foo.md` **v1.2.0** |\n' > "$tmp/cl-stray.md"
  printf '| 推奨モデル | 高精度レビュー |\n' > "$tmp/cl-none.md"
  if [ "$(checklist_target_path "$tmp/cl-ok.md")" = "docs/instructions/M9-01-foo.md" ]; then
    ok "陰性対照(対象指示書欄) → パスを拾える"
  else echo "NG  対象指示書欄のパスを拾えない"; st=1; fi
  if [ "$(checklist_target_version "$tmp/cl-ok.md")" = "1.2.0" ]; then
    ok "陰性対照(対象指示書欄) → 版数を拾える"
  else echo "NG  対象指示書欄の版数を拾えない"; st=1; fi
  if [ "$(checklist_target_path "$tmp/cl-stray.md")" = "docs/instructions/M9-01-foo.md" ]; then
    ok "陽性対照(バッククォートのずれ) → それでもパスを拾える"
  else echo "NG  バッククォートがずれた行でパスを拾えない"; st=1; fi
  if [ -z "$(checklist_target_path "$tmp/cl-none.md")" ]; then
    ok "陰性対照(対象指示書欄なし) → 空を返す"
  else echo "NG  対象指示書欄が無いのに拾ってしまった"; st=1; fi

  echo
  if [ "$st" -eq 0 ]; then echo "自己検査: 合格(陽性は赤・陰性は緑)"; return 0; fi
  echo "自己検査: 不合格"; return 1
}

# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------
case "${1:-}" in
  --self-test) self_test; exit $? ;;
  --list-allow)
    echo "# 版数不一致の ALLOW 表(完了済み指示書。D-274 (3) により本文を書き換えない)"
    echo
    echo "| ファイル | 除外の理由 |"
    echo "|---|---|"
    for e in "${VERSION_ALLOW[@]}"; do printf '| `%s` | %s |\n' "${e%% :: *}" "${e#* :: }"; done
    exit 0 ;;
  --list)
    echo "# 禁則表現の内訳(ベースライン更新時に使う)"
    echo
    printf '| 語 | 件数 |\n|---|---|\n'
    for w in "${FORBIDDEN[@]}"; do
      # ★語ごとに数える(旧実装は count_forbidden=全語合計 を毎回呼んでいて内訳になっていなかった)
      printf '| %s | %s |\n' "$w" "$(count_one "$w" "$INSTR_DIR"/*.md "$REVIEW_DIR"/*.md)"
    done 2>/dev/null
    exit 0 ;;
  "") ;;
  *) echo "ERROR: 不明な引数: $1" >&2; exit 2 ;;
esac

echo "# 指示書の書式検査"
echo
echo "対象 commit: \`$(git rev-parse --short HEAD 2>/dev/null || echo unknown)\`"
echo

echo "## 1. 版数の一致(冒頭メタ表 ⇄ 末尾の締め文)"
echo

checked=0; allowed=0
for f in "$INSTR_DIR"/*.md; do
  [ -f "$f" ] || continue
  base="$(basename "$f")"
  is_out_of_scope "$f" && continue
  if is_version_allowed "$base"; then allowed=$((allowed + 1)); continue; fi
  # 版数を両方持つものだけが対象
  [ -n "$(head_version "$f")" ] && [ -n "$(tail_version "$f")" ] || continue
  checked=$((checked + 1))
  if ! version_ok "$f"; then
    fail "版数が一致しない: $base (冒頭 $(head_version "$f") / 末尾 $(tail_version "$f"))"
    note "どちらかが改訂時に取り残されている。両方を揃えること"
  fi
done
if [ "$checked" -eq 0 ]; then
  # ★空回りガード(2026-08-11 レビュー 高 4)。0 件でも緑を返していた
  fail "版数を検査できるファイルが 1 件も無い(検査が空回りしている可能性)"
elif [ "$VIOLATIONS" -eq 0 ]; then
  ok "検査した $checked 件すべてで版数が一致(ALLOW 除外 $allowed 件)"
fi

echo
echo "## 2. 禁則表現(playbook §4.1)"
echo

CUR="$(count_forbidden "$INSTR_DIR"/*.md "$REVIEW_DIR"/*.md)"
DELTA=$((CUR - BASELINE_FORBIDDEN))

printf '現在 %s 件 / ベースライン %s 件\n' "$CUR" "$BASELINE_FORBIDDEN"
echo
echo "注: 本検査は誤検出を含む。「あれば」は「〜であれば」等の正常な用法にも一致する。"
echo "    件数そのものではなく **ベースラインから増えたか** を見ること(内訳は --list)。"
echo

if [ "$DELTA" -gt 0 ]; then
  fail "ベースラインから $DELTA 件増加。新規に禁則表現が入った可能性がある"
  note "言い換えは playbook §4.2「言い換えパターン」を参照"
elif [ "$DELTA" -lt 0 ]; then
  ok "ベースラインから $((-DELTA)) 件減少。本スクリプトの BASELINE_FORBIDDEN を $CUR へ更新してよい"
else
  ok "ベースラインどおり(増加なし)"
fi

echo
echo "## 3. チェックリストの「対象指示書」欄 ⇄ 指示書本体の版数"
echo

cl_mismatch=0; cl_checked=0; cl_unresolved=0
cl_detail=""
for f in "$REVIEW_DIR"/*.md; do
  [ -f "$f" ] || continue
  tpath="$(checklist_target_path "$f")"
  tver="$(checklist_target_version "$f")"
  # 欄そのものが無いチェックリストは対象外(古い書式。M20 / M21 期に多い)
  [ -n "$tpath" ] && [ -n "$tver" ] || continue
  if [ ! -f "$tpath" ]; then
    cl_unresolved=$((cl_unresolved + 1))
    cl_detail="${cl_detail}  判定不能: $(basename "$f") → $tpath が存在しない"$'\n'
    continue
  fi
  hv="$(head_version "$tpath")"
  [ -n "$hv" ] || { cl_unresolved=$((cl_unresolved + 1)); continue; }
  cl_checked=$((cl_checked + 1))
  if [ "$tver" != "$hv" ]; then
    cl_mismatch=$((cl_mismatch + 1))
    cl_detail="${cl_detail}  不一致: $(basename "$f") (チェックリストの対象指示書欄 $tver / 指示書本体 $hv)"$'\n'
  fi
done

CL_DELTA=$((cl_mismatch - BASELINE_CHECKLIST_MISMATCH))
printf '現在 %s 件 / ベースライン %s 件(検査 %s 件・判定不能 %s 件)\n' \
  "$cl_mismatch" "$BASELINE_CHECKLIST_MISMATCH" "$cl_checked" "$cl_unresolved"
echo
echo "注: **ベースライン固定型**。既存の不一致はすべて完了済みサブであり是正しない(D-274 (3))。"
echo "    本検査の値打ちは **進行中のサブで版ずれが起きたら赤にする** ことだけにある。"
echo

if [ "$cl_checked" -eq 0 ]; then
  fail "対象指示書欄を検査できるチェックリストが 1 件も無い(検査が空回りしている可能性)"
elif [ "$CL_DELTA" -gt 0 ]; then
  fail "ベースラインから $CL_DELTA 件増加。指示書を改版してチェックリストを取り残した可能性がある"
  printf '%s' "$cl_detail"
  note "チェックリストの「対象指示書」欄と本文の該当箇所を、指示書の現行版へ揃えること"
elif [ "$CL_DELTA" -lt 0 ]; then
  ok "ベースラインから $((-CL_DELTA)) 件減少。本スクリプトの BASELINE_CHECKLIST_MISMATCH を $cl_mismatch へ更新してよい"
else
  ok "ベースラインどおり(増加なし)"
fi

echo
if [ "$VIOLATIONS" -eq 0 ]; then echo "結果: 違反なし"; exit 0; fi
echo "結果: 違反 $VIOLATIONS 件"
exit 1

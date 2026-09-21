#!/usr/bin/env bash
# check-md-emphasis.sh — Markdown の「閉じない強調」検査(実レンダラで判定・read-only)
#
# 何を見るか:
#   `**…**` の閉じ側が CommonMark の right-flanking 条件を満たさないと、その `**` は
#   閉じ記号として認められず、**強調が閉じずに後続へ太字が漏れる**。
#   典型は「閉じ `**` の直前が全角の約物で、直後が文字」の形。
#     壊れる: `**D-1〜D-259（256 行）**は …`   ← `）` の直後に `**`、その後ろが `は`
#     正しい: `**D-1〜D-259**（256 行）は …`
#
# なぜ既存の検査では足りないか:
#   本リポジトリは D-258 / D-266 / D-287 で「変更した行の `**` の個数が偶数か」という
#   近似検査を積み上げてきたが、**この型は個数が偶数のまま壊れる**。
#   実際、2026-08-12 に設計卓が自作した近似検査は parallel-board を「22 件」と誤報し、
#   実レンダラで数え直すと 7 行だった(コードスパン内の `**` と、全角コロン・全角スラッシュ・
#   長音記号を約物と誤判定した分を含んでいた)。**確実に見るには実レンダラに通すしかない。**
#
# 判定方法:
#   対象 md を 1 行ずつ CommonMark 実装(markdown-it-py)でレンダリングし、
#   出力 HTML からコードスパン(`<code>…</code>`)を除いたうえで、
#   リテラルの `**` が残る行を「閉じない強調」として報告する。
#   表の行はパイプを外して段落として描画する(セルは 1 行が独立した文脈のため)。
#
# 使い方:
#   bash scripts/check-md-emphasis.sh                 # 既定の対象範囲を検査
#   bash scripts/check-md-emphasis.sh <file>...       # ファイルを指定して検査(★書き込み時モード)
#     ★ファイル引数モードは **docs/progress/ の書き込み時検査を担う**(2026-09-07・D-761 案 A)。
#       ベースラインと比較せず、渡したファイルに閉じない強調が 1 行でもあれば非ゼロで終わる。
#       常時走査から外した docs/progress/ は、**完了報告・レビュー報告を書いた本人がこのモードで見る**。
#       手順は .claude/commands/{implement_plan,implement_plan_full,incorporate_plan,review_plan}.md の
#       <!-- COMPLETION-REPORT-MD-EMPHASIS --> 節にある。
#   bash scripts/check-md-emphasis.sh --list          # 検出行を全件表示(ベースライン更新時に使う)
#   bash scripts/check-md-emphasis.sh --self-test     # 陽性対照・陰性対照でこのスクリプト自身を検査
#
# 終了コード: 0=ベースラインから増えていない / 1=増えた・自己検査に不合格 / 2=実行できなかった
#
# 依存:
#   python3 と markdown-it-py(CommonMark 実装)。**未導入なら exit 2 で「未実行」を返す。**
#   緑を返さないのは、検査していないことを「問題なし」と同じ顔で出さないため(教訓 E-84)。
#     導入: pip install markdown-it-py
#
# 対象範囲(狭く保つ): docs/process ／ docs/handover ／ docs/instructions ／ docs/design ／
#   docs/change-notes の *.md。
#   **除外は archive/ と phase<数字>/ だけ**(いずれもアーカイブ済みの歴史記録であり書き換えない)。
#
#   2026-08-15(改善レーン 第 1 束)に 2 点変えた:
#     (1) **docs/progress/ を対象へ入れた。** 旧版は「完了報告は当時の記録」として除外していたが、
#         同ディレクトリは製造の正本を置く場所であり、**読めない行が残ると次の担当が事実を取り違える**。
#         実際 M20-07 と M21-06 が独立に「完了報告の閉じない強調が一度も捕まっていない」と申し送った。
#     (2) **除外を `/phase[0-9]+/` の形へ一般化した。** 旧版は `/phase1/` `/phase2/` の**名指し**で、
#         **`docs/*/phase3/` が漏れていた**。除外したいのは「アーカイブ済みの歴史記録」であって
#         「phase1 と phase2」ではない。**形で書いたための漏れ**であり、同型の誤りはボード
#         M-61 / M-65 / M-66 として 3 度記録されている。
#
#   2026-09-07(改善レーン C1〜C3・D-761 案 A)に **docs/progress/ を常時走査から外した。**
#     ★上の (1) を取り消したのではない。**当時の理由**(読めない行が残ると次の担当が事実を取り違える)
#       **は今も生きている。⇒ 変わったのは検査の時点だけである。**
#     ★なぜ外したか: 本検査の床は「増やした本人が自分の追加分を直す」を前提にしている。ところが
#       docs/progress/ の主部は完了報告・レビュー報告であり、**これらは歴史記録として書き換えない**
#       (D-274 (3) と同じ流儀)。**2 つの規則が正面から食い違い、誰も直さないまま床だけが上がっていた。**
#       実測でも、旧範囲 496 行のうち **増分のほぼ全量が docs/progress/ にあった**
#       (2026-08-15 の 186 行 → 249 行 ＝ +63。残り 5 ディレクトリ側は 250 → 247 で −3)。
#     ★外して終わりにしていない: docs/progress/ は **ファイル引数モード**(上の「使い方」)で
#       **書いた本人がその手番で見る。⇒ (2) を落とすと本変更は「検査を弱めただけ」に化ける。**
#
# ベースライン固定型:
#   既存の汚れが多いため、**件数そのものではなく「ベースラインから増えたか」を見る**。
#   減ったら BASELINE_BROKEN を下げること。増える方向の更新はしない
#   (増えたぶんは、その回に書いた本人が直せる)。
set -uo pipefail

# 実測のベースライン。**目標値ではなく既知の残存件数。**
#   2026-08-12 の一括是正で parallel-board と change-number-registry は 0 行にしてある。
#   残りは他ファイルの既存分で、書いた本人が触るときに直していく想定。
#   経緯: 377 -> 375（2026-08-12・followup-backlog の G-11・G-14b のついで）-> 373 -> 372。
#
#   2026-08-15(改善レーン 第 1 束・`ebcd5dd` 実測): **372 -> 438 へ取り直した。**
#   **走査対象を変えたことによる取り直しであり、赤いから動かしたのではない。** 内訳は両方向:
#     旧対象 373 行 - phase3 の除外 121 行(handover 20 ／ instructions 101)
#                   + docs/progress の取り込み 186 行 = 438 行
#   **docs/progress の既存 186 行は本束では直していない**(直すと差分が巨大化して本束の効果が
#   測れなくなるため。開発者判断 2026-08-14)。書いた本人が触るときに直していく。
#
# ★本定数は「作業ツリー全体の総数」である。**レーン(worktree / ブランチ)ごとに測って下げてはならない。**
#   2026-08-14 に実際に外れた: `734cd9b`(M21-05 レーン)が自分のツリーで 372 を実測して定数を下げたが、
#   同じ時刻に並走していた M20-05 レーンの `7ea1877` が閉じない強調を 1 行持つ
#   `docs/handover/design-reports/20260814-m20-05-design-exceptions.md` を足しており、
#   **両レーンが main で出会った時点で 373 になった**(両者の merge-base は `6d86e56`。
#   どちらのレーンも相手のファイルを見ていない)。**⇒ 部分的なツリーで測った値を全体の事実として
#   書き込むと、マージした瞬間にずれる。** 下げるのは、並走が解けている手番に限ること。
#
#   2026-08-15(同日・追補): **438 -> 436。** `generate-code-facts.sh` が複数行 JSDoc を
#   フィールド列へ流し込んでおり、本文の `**` がそのまま生成物へ出ていた(2 行)。
#   **生成器を直したので、既存の汚れが消えたぶんを下げる。**
#   ★本追補は「走査対象を広げたら、生成物が壊れた markdown を出していることが分かった」
#     という経路で見つかった。**生成物も検査対象である。**
#
#   2026-09-07(改善レーン C1〜C3・D-761 案 A・commit `2468099` で実測): **436 -> 247 へ取り直した。**
#   **走査対象を変えたことによる取り直しであり、赤いから動かしたのではない**(2026-08-15 と同じ経路)。
#     旧範囲(6 ディレクトリ・778 ファイル)の実測 496 行 ★床 436 に対し +60 が未反映で既に赤だった
#       - docs/progress の除外 249 行 = **新範囲(5 ディレクトリ・563 ファイル)の実測 247 行**
#   ★**「増える方向の更新はしない」という上の注記に反しない**——436 -> 247 は下げ方向である。
#   ★**部分的なツリーで測っていない**(2026-08-14 の M21-05 の事故と違う点)。3 本(M28-02c / M29-02 /
#     M28-05)のマージ後、次の M31 の投入前で、**並列が 0 本の全部入りツリーで測った**(D-335 の窓)。
#   ★測定環境: markdown-it-py 4.2.0 / Python 3.11.15。**★床の値はレンダラの版に依存する**——
#     開発者が 2026-09-06 に測った 1,052 行は本環境で再現しない(本環境の旧範囲は 496 行)。
#     いっぽうリポジトリ側の記録値とは完全一致する(M28-04 の 494 -> M28-02c の 495 -> 496 ／
#     retrospective-digest 41 ／ M21-RESEARCH-01-report 40 ／ M26-02-completion-report 40)。
#     **⇒ 別の版で測ると値がずれる。床を動かすときは測定環境も併記すること。**
#   ★新しい床 247 行の内訳を一度数えた(followup `md-emphasis-check-fenced-block-false-positive` の求め):
#     **フェンス内の偽陽性は 0 件**である。同偽陽性は docs/progress 側に集中していた(249 行中 68 行)。
#     **⇒ 案 A は偽陽性の主部を常時走査から外す副次効果を持つ。**
BASELINE_BROKEN=247

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "ERROR: git リポジトリ内で実行してください" >&2
  exit 2
}
cd "$ROOT"

PY_CHECK='
import re, sys
try:
    from markdown_it import MarkdownIt
except Exception:
    sys.exit(9)
MD = MarkdownIt("commonmark")
CODE = re.compile(r"<code>.*?</code>", re.S)
bad = 0
for path in sys.argv[1:]:
    try:
        lines = open(path, encoding="utf-8").read().split("\n")
    except OSError:
        continue
    for i, line in enumerate(lines, 1):
        if "**" not in line:
            continue
        body = line
        if body.lstrip().startswith("|"):
            body = " ".join(c for c in body.strip().strip("|").split("|"))
        if "**" in CODE.sub("", MD.render(body)):
            bad += 1
            print(f"{path}:{i}")
print(f"__COUNT__{bad}")
'

collect_targets() {
  # ★除外はフェーズ番号を名指ししないこと。`/phase1/` `/phase2/` と書いたために
  #   phase3 が増えた時点で漏れた(2026-08-15 是正)。`/phase[0-9]+/` の形で書く。
  #
  # ★`phase[0-9]+/` を除外してよいのは、**稼働中の文書が各ディレクトリの直下にあり、
  #   `phaseN/` は仕分け済みのアーカイブ置き場である**という運用が続く限りである
  #   (CLAUDE.md §10.Y が同ディレクトリを「仕分け済みの置き場」として挙げている。
  #   実際 phase3 は現行フェーズだが、M19〜M21 の稼働中の指示書は docs/instructions/ 直下にあり、
  #   docs/instructions/phase3/ には M18 以前しか入っていない)。
  #   **運用が変わって稼働中の文書を phaseN/ へ置くようになると、無検査の領域が静かに生まれる。**
  # ★docs/progress は 2026-09-07(D-761 案 A)に常時走査から外した。**外して終わりではない**——
  #   同ディレクトリは書いた本人がファイル引数モードで見る(冒頭の「使い方」)。
  find docs/process docs/handover docs/instructions docs/design docs/change-notes \
    -name '*.md' -type f 2>/dev/null \
    | grep -v '/archive/' | grep -Ev '/phase[0-9]+/' | sort
}

run_check() {
  local rc
  if [ "${MD_EMPHASIS_FORCE_NO_DEP:-0}" = "1" ]; then
    # 自己検査用: 依存欠落の経路だけを強制的に踏ませる(検査を緩める方向には働かない)
    rc=9
  else
    python3 -c "$PY_CHECK" "$@"
    rc=$?
  fi
  if [ "$rc" -eq 9 ]; then
    echo "ERROR: markdown-it-py が見つかりません。検査を実行できませんでした(未実行)。" >&2
    echo "  導入: pip install markdown-it-py" >&2
    # ★ここは $(...) の中で呼ばれるためサブシェルである。exit ではプロセスは終わらない。
    #   呼び出し側が終了ステータスを見て伝播させること(下の RC 判定)。
    return 2
  fi
  return "$rc"
}

self_test() {
  local tmp st_fail=0 out
  tmp="$(mktemp -d)" || { echo "ERROR: mktemp 失敗" >&2; exit 2; }
  # shellcheck disable=SC2064
  trap "rm -rf '$tmp'" EXIT

  # 陽性対照: 閉じ ** の直前が全角約物・直後が文字
  printf '**D-1〜D-259（256 行）**は退避した。\n' > "$tmp/positive.md"
  # 陰性対照 A: 約物を強調の外へ出した正しい形
  printf '**D-1〜D-259**（256 行）は退避した。\n' > "$tmp/negative-ok.md"
  # 陰性対照 B: コードスパン内のリテラル ** (誤検出しないこと)
  printf '`**` の個数を数える検査は足りない。\n' > "$tmp/negative-code.md"

  echo "## 自己検査(陽性対照・陰性対照)"
  echo

  out=$(run_check "$tmp/positive.md")
  if [ "$(printf '%s' "$out" | sed -n 's/^__COUNT__//p')" = "1" ]; then
    echo "OK  陽性対照(閉じない強調) → 赤"
  else echo "NG  陽性対照を検出できなかった"; st_fail=1; fi

  out=$(run_check "$tmp/negative-ok.md")
  if [ "$(printf '%s' "$out" | sed -n 's/^__COUNT__//p')" = "0" ]; then
    echo "OK  陰性対照(正しい形) → 緑"
  else echo "NG  陰性対照(正しい形)を誤検出した"; st_fail=1; fi

  out=$(run_check "$tmp/negative-code.md")
  if [ "$(printf '%s' "$out" | sed -n 's/^__COUNT__//p')" = "0" ]; then
    echo "OK  陰性対照(コードスパン内の **) → 緑"
  else echo "NG  コードスパン内の ** を誤検出した"; st_fail=1; fi

  # 陽性対照 2: 依存欠落(未実行)の経路。**緑を返さないこと**が主張である
  #   2026-08-13 実在した欠陥の回帰検査。run_check の exit 2 が $(...) のサブシェルで
  #   死に、親は CUR=0 のまま「ベースラインから 375 行減少・違反なし」を exit 0 で返していた。
  #   BASELINE_BROKEN を 0 へ下げるよう勧める出力まで出しており、従うと基準が消えていた。
  out=$(MD_EMPHASIS_FORCE_NO_DEP=1 bash "$0" 2>&1); rc=$?
  if [ "$rc" -ne 0 ] && ! printf '%s' "$out" | grep -q '結果: 違反なし'; then
    echo "OK  陽性対照(依存欠落) → 未実行として非ゼロ終了・緑を返さない"
  else
    echo "NG  依存欠落でも緑を返した(rc=$rc)。未実行と 0 件が同じ顔になっている"; st_fail=1
  fi

  echo
  if [ "$st_fail" -eq 0 ]; then echo "自己検査: 合格(陽性は赤・陰性は緑)"; return 0; fi
  echo "自己検査: 不合格"; return 1
}

LIST=0
case "${1:-}" in
  --self-test) self_test; exit $? ;;
  --list) LIST=1; shift ;;
esac

TARGETS=()
if [ "$#" -gt 0 ]; then
  TARGETS=("$@")
else
  while IFS= read -r f; do TARGETS+=("$f"); done < <(collect_targets)
fi

if [ "${#TARGETS[@]}" -eq 0 ]; then
  echo "ERROR: 検査対象が 0 件です" >&2
  exit 2
fi

echo "# Markdown の閉じない強調の検査"
echo
echo "対象 commit: \`$(git rev-parse --short HEAD 2>/dev/null || echo unknown)\` / 対象 ${#TARGETS[@]} ファイル"
echo "判定: CommonMark 実装で 1 行ずつ描画し、コードスパンを除いた出力にリテラルの \`**\` が残る行"
echo

OUT=$(run_check "${TARGETS[@]}")
RC=$?
if [ "$RC" -ne 0 ]; then
  echo "結果: 未実行(検査していない。緑ではない)" >&2
  exit "$RC"
fi
CUR=$(printf '%s' "$OUT" | sed -n 's/^__COUNT__//p')
# ★ __COUNT__ が出ていないのは「0 行」ではなく「数えられていない」。
#   ${CUR:-0} で 0 に落とすと、未実行が「ベースラインから全件減少」に化ける。
if [ -z "$CUR" ]; then
  echo "ERROR: 件数行(__COUNT__)が得られませんでした。検査を実行できていません(未実行)。" >&2
  echo "結果: 未実行(検査していない。緑ではない)" >&2
  exit 2
fi

if [ "$LIST" -eq 1 ] || [ "$#" -gt 0 ]; then
  printf '%s\n' "$OUT" | grep -v '^__COUNT__' || true
  echo
fi

if [ "$#" -gt 0 ]; then
  echo "検出: $CUR 行(ファイル指定のためベースライン比較を行わない)"
  [ "$CUR" -eq 0 ] && exit 0
  exit 1
fi

printf '現在 %s 行 / ベースライン %s 行\n' "$CUR" "$BASELINE_BROKEN"
echo
DELTA=$((CUR - BASELINE_BROKEN))
if [ "$DELTA" -gt 0 ]; then
  echo "NG  ベースラインから $DELTA 行増加。今回書いた行に閉じない強調がある可能性が高い。"
  echo "  内訳は --list。直しかたは「閉じ \`**\` の直前の約物を強調の外へ出す」"
  echo "  (例: \`**A（B）**は\` → \`**A**（B）は\`)。"
  echo
  echo "結果: 違反 1 件"
  exit 1
fi
if [ "$DELTA" -lt 0 ]; then
  echo "OK  ベースラインから $((-DELTA)) 行減少。本スクリプトの BASELINE_BROKEN を $CUR へ更新してよい。"
else
  echo "OK  ベースラインどおり(増加なし)"
fi
echo
echo "結果: 違反なし"
exit 0

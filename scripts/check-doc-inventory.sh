#!/usr/bin/env bash
# check-doc-inventory.sh — 既存運用の型に無い恒久ファイルの新設を検出する(決定論・read-only)
#
# 背景(2026-08-13 開発者要求): 長期稼働で docs が汚染される。観測された 2 つの型は
#   (1) 終わった記述が残る (2) 各担当が作業用に作ったファイルが永続化する、である。
#   実例＝`docs/handover/` 直下に M18/M19 期の作業ファイルが 6 本(108 KB)残っていた。
#   `m19-desk-status.md` は §0 で「寿命は M19 クローズまで」と自ら宣言し、ボード P-24 が
#   「削除の前提は満たされた」と記録してなお存在していた。
#   **規則が足りないのではなく、「消す」が D-196 境界条件 3 で開発者手番のまま忘れられる。**
#
#   ⇒ 開発者の要求は「**既存運用から外れるファイルの新作成を制御し、承認を通す**」。
#      本検査はその検出側である。ルール本体は CLAUDE.md §10 と playbook §4.25。
#
# ★orphan(参照ゼロ)検出は採らなかった。試作で確認済み:
#   滞留していた 6 本はいずれも 1〜9 か所から参照されており、参照元が「これは消す予定」
#   という行だった。**参照されている ≠ 生きている。** 逆に `m14-*-review.md` のような
#   正当な記録を誤検出する。⇒ 見るのは「既存運用の型に合っているか」である。
#
# 検査対象(狭く保つ): docs/{handover,process,progress,instructions} の **直下のみ**。
#   phase1〜phase3 / archive / reviews / templates / design-reports / session-prompts は
#   仕分け済みの置き場なので対象外。human-notes / postmortem は開発者の持ち物で対象外。
#
# 使い方:
#   bash scripts/check-doc-inventory.sh              # リポジトリを検査
#   bash scripts/check-doc-inventory.sh --self-test  # 陽性対照・陰性対照でこのスクリプト自身を検査
#   bash scripts/check-doc-inventory.sh --list-allow # 型の一覧と、既知の例外(ベースライン)
#
# 終了コード: **常に 0(情報提供型)**。実行エラーのみ 2。
#   ★ブロックしない理由: 削除・移設は開発者手番であり、Claude が止まっても解消できない。
#     赤にすると「緑にするために消す」圧力がかかり、D-196 を破る方向へ働く。
#     `check-derived-docs.sh` と同じ扱いにしてある。
#
# 限界:
#   - 型に合っていることは「置いてよい」の証明ではない。**新種を見つけるための床**である。
#   - 中身は見ない。型に合った名前の空ファイルも緑になる。
#   - 例外表は「現状追認のベースライン」であり、正しさの表明ではない。
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "ERROR: git リポジトリ内で実行してください" >&2
  exit 2
}
cd "$ROOT"

SCAN_DIRS=(docs/handover docs/process docs/progress docs/instructions)

# ---------------------------------------------------------------------------
# 既存運用の型: 「ディレクトリ :: 正規表現(basename) :: 何の型か」
#   ここへ足すのは「運用として定着した型」だけにすること。
#   1 回きりの資料を通すために足すと、本検査は何も検出しなくなる。
# ---------------------------------------------------------------------------
TYPES=(
  "docs/handover :: ^m[0-9]+-to-m[0-9]+-handover\.md$ :: マイルストーン間 引き継ぎ書"
  "docs/handover :: ^phase[0-9]+-to-phase[0-9]+-handover\.md$ :: フェーズ間 引き継ぎ書"
  "docs/handover :: ^[Mm][0-9]+-close-report\.md$ :: マイルストーン クローズ報告"
  "docs/handover :: ^M[0-9]+-DESIGN-[0-9]+-[a-z0-9-]+\.md$ :: 設計卓の設計方針書"
  "docs/handover :: ^m[0-9]+(-[0-9a-z]+)*-design-session-handover\.md$ :: 設計セッション継承資料"

  "docs/process :: ^m[0-9]+(-m[0-9]+)?-contract\.md$ :: マイルストーン契約ファイル"

  # サブ ID にハイフンを含む形がある(m19-phase2-addendum-review.md)ためハイフンを許す
  # 末尾の -N は再レビューの巡目(m24-12-review-2.md)。CLAUDE.md §9 停止規律が
  # 再レビュー往復を上限 2 回まで明示的に認めているため、2 巡目は例外ではなく正規の運用である
  # (2026-08-31 昇格＝D-624)
  "docs/progress :: ^[Mm][0-9]+-[0-9a-z-]+-review(-[0-9]+)?\.md$ :: レビュー報告(末尾 -N は再レビューの巡目)"
  "docs/progress :: ^[Mm][0-9]+-[0-9a-z-]+-completion-report\.md$ :: 完了報告"
  "docs/progress :: ^M[0-9]+-RESEARCH-[0-9]+-report(-[a-z0-9-]+)?\.md$ :: RESEARCH レポート"
  "docs/progress :: ^M[0-9]+-[0-9]+-report\.md$ :: サブ単位のレポート"
  "docs/progress :: ^[0-9]{8}-[A-Za-z0-9._-]+\.md$ :: 日付つきの単発 調査・監査・報告"
  "docs/progress :: ^progress-(log|summary)\.md$ :: 継続更新ファイル"

  "docs/instructions :: ^M[0-9]+-[0-9A-Za-z]+-[a-z0-9-]+\.md$ :: 指示書"
  "docs/instructions :: ^M[0-9]+-RESEARCH-[0-9]+-[a-z0-9-]+\.md$ :: RESEARCH 指示書"
  "docs/instructions :: ^([Mm][0-9]+|phase[0-9]+)-overview\.md$ :: マイルストーン/フェーズ全体像"

  # 改善レーン(マイルストーンに属さない、プロセス・基盤の改善サブ)。
  # マイルストーン番号を持たないため M{NN}-{NN} の型に当たらない。
  # 2026-08-31 昇格＝D-624。フェーズ境界ごとに改善担当を挟む運用が定着したため
  "docs/instructions :: ^IMPROVE-[0-9]+-[a-z0-9-]+\.md$ :: 改善レーン 指示書"
  "docs/progress :: ^improve-[0-9]+-review(-[0-9]+)?\.md$ :: 改善レーン レビュー報告"
  "docs/progress :: ^improve-[0-9]+-completion-report\.md$ :: 改善レーン 完了報告"
)

# ---------------------------------------------------------------------------
# 既知の例外(ベースライン): 「パス :: 理由」
#   2026-08-13 時点の現状を追認したものであり、目標値ではない。
#   ★足すときは開発者の承認を得たことを理由欄に書くこと。
#     「検査を黙らせるため」に足すと、本検査は存在しないのと同じになる。
# ---------------------------------------------------------------------------
EXCEPT=(
  # --- 恒久資料(常時読まれるルール面・台帳) ---
  "docs/handover/design-instruction-playbook.md :: 恒久・設計担当の正本"
  "docs/handover/followup-backlog.md :: 恒久・未解決事項の台帳"
  "docs/handover/roles-and-routing.md :: 恒久・役割と宛先の正本"
  "docs/handover/change-number-registry.md :: 恒久・採番台帳"
  "docs/handover/architecture-patterns.md :: 恒久・実装パターン集"
  "docs/handover/retrospective-log.md :: 恒久・教訓の源泉"
  "docs/handover/retrospective-digest.md :: 恒久・派生(生成物)"
  "docs/handover/docs-map.md :: 恒久・派生(生成物)"
  "docs/handover/code-facts.md :: 恒久・派生(生成物)"
  "docs/process/parallel-board.md :: 恒久・並列運用の正本"
  "docs/process/parallel-ops-decisions.md :: 恒久・並列運用の裁定集"
  "docs/process/remote-ops.md :: 恒久・リモート運用の正本"
  "docs/process/deny-rules-inventory.md :: 恒久・deny ルールの台帳"
  "docs/process/model-upgrade-ops.md :: 恒久・モデル更改の手順"
  "docs/process/disk-growth-baseline.md :: 恒久・ディスク増大のベースライン"
  "docs/process/dependency-pin-ops.md :: 依存の版固定と、その解除の手順。2026-09-06 開発者要求により新設(設計卓の裁定 D-764)。★例外表への追加は開発者承認済み(D-764 / D-766)。★TYPES へは昇格させていない——1 本のファイルであり、まだ「型」ではない"
  "docs/process/public-release-runbook.md :: 公開リポジトリへの公開とリリースを打つ手順の正本。2026-09-20 開発者承認により新設(設計卓の裁定 D-917)。★恒久である理由=リリースは 1 回きりではない(公開後に SF6 の大型アップデートが来る)。★TYPES へは昇格させていない——1 本のファイルであり、まだ「型」ではない"
  "docs/handover/SF6セットプレイ-ドメイン知識集成.md :: 恒久・ドメイン知識集成"

  # --- 型から外れるが、意図的に残しているもの ---
  "docs/handover/20260909-claude-feature-autonomy-report.md :: 1 回きりの調査レポート(Claude 最新機能キャッチアップ)。2026-09-09 開発者依頼により handover へ作成(依頼自体が承認)。§ヘッダで寿命宣言済み——候補が畳まれたら phase3/ へ移設し本行も外す"
  "docs/handover/cleanup-assistant-prompt.md :: cleanup_docs.md §K が「本コマンドの祖先(履歴資料)」として編集禁止に指定。置き場が archive/ でないのは別途 followup"
  "docs/handover/m19-desk-status.md :: §0 が寿命を「M19 クローズまで」と宣言済み。廃止は m20-startup-kit §7(a) で M20 設計卓の手番"
  "docs/process/remote-ops-proposal.md :: remote-ops.md の前段検討資料(2026-07-20 時点)"

  # --- 命名が型から外れたまま定着したもの(是正は followup 側) ---
  "docs/progress/cleanup-report-20260607.md :: 日付が接尾辞。現行の型は日付プレフィクス"
  "docs/progress/cleanup-report-20260627.md :: 同上"
  "docs/progress/transport-audit-20260725.md :: 同上"
  "docs/progress/M19-audit-20260725.md :: 同上(指示書 ID を持たない独立監査レポート)"
  "docs/progress/M19-03-完了報告-一次受け.md :: 日本語名の完了報告 一次受け。followup overview-section7-inventory-cleanup が扱い保留中"
  "docs/process/m18-19-midstream-migration.md :: 小文字・ハイフン区切りの M18/M19 横断移行メモ"
  "docs/progress/m14-03a-design-handoff.md :: 製造 → 設計の受け渡しメモ(design-reports/ 新設前の形)"
  "docs/progress/M19-04-manual-input-list.md :: 人手判断が必要な行の一覧(M19-04 の製造成果物)。2 件しか無いため型に昇格させていない——3 件目が出たら本検査が鳴るので、そこで TYPES へ上げるか判断する"
  "docs/progress/M19-04b-manual-input-list-thirdwave.md :: 同上(第三波)"
)

# ★2026-08-13 の実績(この形が本検査の想定どおりの終わり方である)
#   本検査は初回実行で `docs/progress/M19-RESEARCH-03-is-derived-semantics.md` が
#   `docs/instructions/` 側と**同一内容で重複**している(9,301 B・diff なし)のを検出した。
#   一旦「開発者の削除待ち」として例外表へ載せ、**開発者が削除した時点で行を外した**。
#
#   **★例外表の行は、実体を消したら必ず外すこと。** 残したままにすると
#   「例外表にあるから静か」なのか「実体が無いから静か」なのか区別できなくなり、
#   例外表そのものが次の陳腐化の源になる。

# ---------------------------------------------------------------------------
# 判定ヘルパ
# ---------------------------------------------------------------------------

# $1=ディレクトリ $2=basename → 0=型に合う / 1=合わない
matches_type() {
  local dir="$1" base="$2" entry d re
  for entry in "${TYPES[@]}"; do
    d="${entry%% :: *}"
    [ "$d" = "$dir" ] || continue
    re="${entry#* :: }"; re="${re%% :: *}"
    [[ "$base" =~ $re ]] && return 0
  done
  return 1
}

# $1=リポジトリ相対パス → 0=例外表にある(理由を stdout) / 1=無い
except_reason() {
  local target="$1" entry
  for entry in "${EXCEPT[@]}"; do
    if [ "${entry%% :: *}" = "$target" ]; then
      printf '%s' "${entry#* :: }"
      return 0
    fi
  done
  return 1
}

# ---------------------------------------------------------------------------
# 走査本体。型にも例外にも当たらないパスを 1 行 1 件で出力する。
#   BASE を指定するとそのディレクトリを基準に走る(自己検査用)。
#
# ★`find` を使い `git ls-files` を使わない理由が 2 つある。
#   (1) git のインデックスではなく**作業ツリーの現物**を見たい。新規作成された直後
#       (まだ add していない)ファイルこそが、本検査が捕まえたい対象である。
#   (2) `git ls-files` は非 ASCII 名を `"docs/handover/M19-\345\274\225..."` と
#       エスケープして返す。試作時に日本語名 4 本が全部「型なし」へ誤判定された。
#       (回避するなら `-z` か `-c core.quotePath=false` が要る)
# ---------------------------------------------------------------------------
scan() {
  local base="${1:-.}" dir d full b
  for dir in "${SCAN_DIRS[@]}"; do
    d="$base/$dir"
    [ -d "$d" ] || continue
    while IFS= read -r full; do
      b="$(basename "$full")"
      matches_type "$dir" "$b" && continue
      except_reason "$dir/$b" >/dev/null && continue
      printf '%s/%s\n' "$dir" "$b"
    done < <(find "$d" -maxdepth 1 -type f -name '*.md' | sort)
  done
}

# ---------------------------------------------------------------------------
# 自己検査(陽性対照・陰性対照)
# ---------------------------------------------------------------------------
self_test() {
  local tmp st_fail=0 out n
  tmp="$(mktemp -d)" || { echo "ERROR: mktemp 失敗" >&2; exit 2; }
  # shellcheck disable=SC2064
  trap "rm -rf '$tmp'" EXIT

  mkdir -p "$tmp/docs/handover/phase3" "$tmp/docs/progress" "$tmp/docs/instructions" "$tmp/docs/process"

  # 陰性対照 1: 型に合う名前(各ディレクトリ 1 本ずつ)
  : > "$tmp/docs/handover/m19-to-m20-handover.md"
  : > "$tmp/docs/progress/m19-04b-review.md"
  : > "$tmp/docs/progress/20260813-something-audit.md"
  : > "$tmp/docs/instructions/M20-01-initial-presets-three.md"
  : > "$tmp/docs/process/m21-contract.md"
  # 陰性対照 2: 例外表に載っている恒久資料
  : > "$tmp/docs/handover/design-instruction-playbook.md"
  # 陰性対照 3: 対象外のサブディレクトリ(仕分け済みの置き場は見ない)
  : > "$tmp/docs/handover/phase3/M18-M19-CENTRAL-SESSION-HANDOFF.md"
  # 陰性対照 4: 非 ASCII だが例外表にあるもの(試作で踏んだエスケープの罠の対照)
  : > "$tmp/docs/progress/M19-03-完了報告-一次受け.md"
  # 陽性対照 1: 型にも例外にも無い新種ファイル
  : > "$tmp/docs/handover/M20-引き継ぎキット.md"
  # 陽性対照 2: 型はあるが**ディレクトリが違う**(指示書の型を progress へ置いた)
  : > "$tmp/docs/progress/M20-02-some-instruction-slug.md"

  echo "## 自己検査(陽性対照・陰性対照)"
  echo

  out="$(scan "$tmp")"

  n=$(printf '%s\n' "$out" | grep -c '^docs/handover/m19-to-m20-handover\.md$' || true)
  if [ "$n" -eq 0 ]; then echo "OK  陰性対照(型に合う handover) → 検出しない"
  else echo "NG  陰性対照(型に合う handover)を誤検出した"; st_fail=1; fi

  n=$(printf '%s\n' "$out" | grep -cE '^docs/(progress/(m19-04b-review|20260813-something-audit)|instructions/M20-01-initial-presets-three|process/m21-contract)\.md$' || true)
  if [ "$n" -eq 0 ]; then echo "OK  陰性対照(型に合う review / 日付つき / 指示書 / 契約) → 検出しない"
  else echo "NG  陰性対照(型に合う 4 種)のうち $n 件を誤検出した"; st_fail=1; fi

  n=$(printf '%s\n' "$out" | grep -c '^docs/handover/design-instruction-playbook\.md$' || true)
  if [ "$n" -eq 0 ]; then echo "OK  陰性対照(例外表の恒久資料) → 検出しない"
  else echo "NG  陰性対照(例外表の恒久資料)を誤検出した"; st_fail=1; fi

  n=$(printf '%s\n' "$out" | grep -c 'phase3/' || true)
  if [ "$n" -eq 0 ]; then echo "OK  陰性対照(仕分け済みサブディレクトリ) → 走査しない"
  else echo "NG  陰性対照(phase3/ 配下)を走査してしまった"; st_fail=1; fi

  n=$(printf '%s\n' "$out" | grep -c '完了報告-一次受け' || true)
  if [ "$n" -eq 0 ]; then echo "OK  陰性対照(非 ASCII 名の例外) → 検出しない(エスケープの罠を踏んでいない)"
  else echo "NG  陰性対照(非 ASCII 名の例外)を誤検出した"; st_fail=1; fi

  n=$(printf '%s\n' "$out" | grep -c '^docs/handover/M20-引き継ぎキット\.md$' || true)
  if [ "$n" -eq 1 ]; then echo "OK  陽性対照(型に無い新種ファイル) → 検出した"
  else echo "NG  陽性対照(型に無い新種ファイル)を検出できなかった"; st_fail=1; fi

  n=$(printf '%s\n' "$out" | grep -c '^docs/progress/M20-02-some-instruction-slug\.md$' || true)
  if [ "$n" -eq 1 ]; then echo "OK  陽性対照(型はあるが置き場が違う) → 検出した"
  else echo "NG  陽性対照(置き場違い)を検出できなかった"; st_fail=1; fi

  echo
  if [ "$st_fail" -eq 0 ]; then echo "自己検査: 合格(陽性は検出・陰性は不検出)"; return 0; fi
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
    echo "# 既存運用の型(ディレクトリ :: 正規表現 :: 何の型か)"
    echo
    printf '%s\n' "${TYPES[@]}"
    echo
    echo "# 既知の例外(ベースライン。パス :: 理由)"
    echo
    printf '%s\n' "${EXCEPT[@]}"
    exit 0
    ;;
esac

echo "# 既存運用の型に無いファイルの検査"
echo
echo "対象 commit: \`$(git rev-parse --short HEAD 2>/dev/null || echo unknown)\`"
echo "対象範囲: ${SCAN_DIRS[*]} の **直下のみ**(phase*/ archive/ reviews/ templates/ design-reports/ session-prompts/ は対象外)"
echo "型 ${#TYPES[@]} 件 ／ 既知の例外 ${#EXCEPT[@]} 件(--list-allow で一覧)"
echo

FOUND=0
while IFS= read -r p; do
  [ -z "$p" ] && continue
  printf '?   %s\n' "$p"
  FOUND=$((FOUND + 1))
done < <(scan)

echo
if [ "$FOUND" -eq 0 ]; then
  echo "結果: 型に無いファイルなし"
  exit 0
fi

cat <<EOS
結果: 型に無いファイル $FOUND 件

**これは違反の宣言ではない。** 新種のファイルが増えたことの通知である。
次のどれかを行うこと(CLAUDE.md §10 ／ playbook §4.25):

  1. 継続更新ファイルに **行として**足せなかったかを再検討する
     (followup-backlog.md §J ／ progress-log.md ／ parallel-board.md)
  2. 運用として定着した型なら、本スクリプトの TYPES 表へ足す
  3. 1 回きりの資料なら、**開発者の承認を得て** EXCEPT 表へ理由付きで足す
  4. 役目を終えているなら、仕分け済みの置き場へ移す
     (docs/handover/phase{N}/ ／ docs/*/archive/)
EOS
exit 0

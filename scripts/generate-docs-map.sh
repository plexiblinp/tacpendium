#!/usr/bin/env bash
# 設計担当(Web 版 Claude、ファイル構成閲覧不可)向けに、docs 配下の「文書ID ⇄ 実パス」と
# 「ディレクトリ別の役割マップ」を決定論的に抽出して docs/handover/docs-map.md を生成する。
#
# 背景: 本プロジェクトは Web 版=設計/指示書担当、Claude Code=実装担当。Web 版は実際の docs
#   構成を知らないため、指示書の前提条件などで docs/design/02-architecture.md を「DES-002」の
#   ように文書ID で参照しがち。Claude Code は探索すればたどり着けるが、無駄な処理になり、最悪
#   「読まずに着手」して品質が落ちる。文書ID→実パスを引ける資料を恒久提供してこれを是正する。
#
# 抽出は grep/awk/sed のみ(新規依存なし、AST 不使用)。各ファイルの「役割」は先頭の `# ` 見出し
#   (タイトル)を採用する。フォルダの役割文と粒度方針(どのフォルダをファイル単位/フォルダ単位で
#   出すか)は本スクリプト内の config として保持する(下記 §2 の各 emit 関数)。
#
# 使い方: bash scripts/generate-docs-map.sh
#   出力先: docs/handover/docs-map.md(上書き)。git 操作は行わない。
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

OUT="docs/handover/docs-map.md"
# 時刻は含めず日付のみ(同日の再生成を冪等にし、不要な diff を避けるため)。
GEN_DATE="$(date '+%Y-%m-%d')"
GEN_COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"

# ---------------------------------------------------------------------------
# 抽出ヘルパ(決定論)
#   doc_title: 最初の `# ` 見出し(無ければ "(タイトルなし)")
#   doc_id   : 最初の `| 文書ID | XXX |` 行の値(無ければ空)
#   doc_ver  : 最初の `| バージョン | X.Y.Z |` 行の値(無ければ空)
# 表セル破壊を防ぐため `|` は呼び出し側で出さない(本マップの表は ID 表のみ)。
# ---------------------------------------------------------------------------
doc_title() {
  grep -m1 '^# ' "$1" 2>/dev/null | sed -E 's/^#[[:space:]]+//' | sed -E 's/[[:space:]]+$//' || true
}
doc_id() {
  grep -m1 '^|[[:space:]]*文書ID[[:space:]]*|' "$1" 2>/dev/null \
    | sed -E 's/^\|[^|]*\|[[:space:]]*//; s/[[:space:]]*\|.*$//' || true
}
#   doc_ver は「現行版がどれか」だけを返す(改訂履歴は取り込まない)。
#
#   背景: 源泉側は版セルへ改訂履歴を継ぎ足す運用になっており、最大 13,082 字に達していた
#   (M19-overview / parallel-board / m19-desk-status 等)。丸ごと転記すると本マップの
#   1 行が 25,365 字になり、逆引き表としても索引としても読めなくなる
#   (10 行で全体の約 65% を占めていた)。本マップの用途は「文書ID → 実パス」の解決であり、
#   版は現行版の識別で足りる。改訂履歴は源泉のメタ表を直接見ること。
#   → followup `meta-version-cell-accumulates-history`(源泉側の是正は別途)。
#
#   切り出し規則(決定論):
#     1. 最初の 全角/半角括弧・〔・【 の手前までを版トークンとする
#     2. その括弧が日付で始まっていれば `（YYYY-MM-DD）` だけを添える
#     3. 切り出しで `**` が奇数になったら閉じる(源泉が `**1.0.0（最終版）**` の形のとき)
#     4. 40 字を超えたら切り詰める(将来、括弧を使わない長い版セルが現れた場合の安全弁)
doc_ver() {
  local raw head date out
  raw="$(grep -m1 '^|[[:space:]]*バージョン[[:space:]]*|' "$1" 2>/dev/null \
    | sed -E 's/^\|[^|]*\|[[:space:]]*//; s/[[:space:]]*\|.*$//' || true)"
  [ -z "$raw" ] && return 0

  head="$(printf '%s' "$raw" | sed -E 's/[（(〔【].*$//; s/[[:space:]]+$//')"
  [ -z "$head" ] && head="$raw"

  date="$(printf '%s' "$raw" \
    | sed -nE 's/^[^（(]*[（(][[:space:]]*([0-9]{4}-[0-9]{2}-[0-9]{2}).*/\1/p')"
  if [ -n "$date" ]; then out="${head}（${date}）"; else out="$head"; fi

  # `**` の対応を回復する(奇数個なら閉じる)
  if [ $(( $(printf '%s' "$out" | grep -o '\*\*' | wc -l) % 2 )) -ne 0 ]; then
    out="${out}**"
  fi

  # 安全弁: それでも長い場合は切り詰める
  if [ "$(printf '%s' "$out" | wc -m)" -gt 40 ]; then
    out="$(printf '%s' "$out" | sed -E 's/^(.{0,37}).*/\1…/')"
  fi

  printf '%s' "$out"
}

# ---------------------------------------------------------------------------
# §1 文書ID → パス 逆引き表(常に全 ID 網羅)
#   `| 文書ID |` 行を持つ全 .md を対象に「文書ID / Ver / タイトル / パス」を ID 昇順で表化。
#   Web 版が指示書で使う ID(REQ-001 / DES-00X / SUPP-001 / HANDOVER-001 等)→ 実パスの解決元。
# ---------------------------------------------------------------------------
emit_id_index() {
  echo '## 1. 文書ID → 実パス 逆引き表'
  echo
  echo '> Web 版設計担当が指示書で `DES-002` 等の **文書ID で参照** したものを実パスへ解決する表。'
  echo '> ID は各文書のメタデータ表(`| 文書ID |`)から抽出。タイトルは先頭見出し、Ver は `| バージョン |`。'
  echo
  echo '| 文書ID | バージョン | タイトル | 実パス |'
  echo '|---|---|---|---|'
  {
    # §1 は「文書ID → 実パス」の逆引き表である。templates/ はプレースホルダ ID
    # (M{{N}}-{{NN}} 等)を持つため ID が重複し、逆引きが成立しない。
    # テンプレートは実パスで開くものなので §1 の対象外とする(設計卓裁定 2026-08-08・3-6 案 B)。
    # §2 のフォルダ役割マップには残す。
    grep -rl '^|[[:space:]]*文書ID[[:space:]]*|' docs --include='*.md' 2>/dev/null \
      | grep -v '^docs/instructions/templates/' | while read -r f; do
      id="$(doc_id "$f")"
      [ -z "$id" ] && continue
      ver="$(doc_ver "$f")"; [ -z "$ver" ] && ver='—'
      title="$(doc_title "$f")"; [ -z "$title" ] && title='(タイトルなし)'
      # 表セル破壊回避
      title="${title//|/\\|}"
      printf '%s\t%s\t%s\t%s\n' "$id" "$ver" "$title" "$f"
    done
  } | sort -f | awk -F'\t' '{ print "| `" $1 "` | " $2 " | " $3 " | `" $4 "` |" }'
  echo
}

# ---------------------------------------------------------------------------
# §2 ディレクトリ別 役割マップ(混合粒度)
#   ファイル単位で出すフォルダ(design / handover 直下)と、フォルダ単位の役割だけ出すフォルダ
#   (change-notes / instructions / progress 等)を使い分ける。粒度方針は本関数群の config。
# ---------------------------------------------------------------------------

# ファイル単位列挙(maxdepth 1)。各 .md を「ファイル名 — タイトル (文書ID vVer)」で出す。
emit_files_in() {
  local dir="$1"
  find "$dir" -maxdepth 1 -name '*.md' 2>/dev/null | sort | while read -r f; do
    local base title id ver tag
    base="$(basename "$f")"
    title="$(doc_title "$f")"; [ -z "$title" ] && title='(タイトルなし)'
    id="$(doc_id "$f")"
    ver="$(doc_ver "$f")"
    tag=''
    if [ -n "$id" ]; then
      if [ -n "$ver" ]; then tag=" ($id v$ver)"; else tag=" ($id)"; fi
    fi
    echo "- \`$base\` — ${title}${tag}"
  done
}

# フォルダ内 .md 件数(maxdepth 1)
count_md() { find "$1" -maxdepth 1 -name '*.md' 2>/dev/null | wc -l | tr -d ' '; }
# フォルダ内 .md 件数(再帰)
count_md_r() { find "$1" -name '*.md' 2>/dev/null | wc -l | tr -d ' '; }

# 指定フォルダ直下の `phase*/` アーカイブを各々件数付きで列挙(昇順、空フォルダは省略)。
#   phase1 / phase2 / … を動的に拾うため、フェーズが進んでもスクリプト更新が不要。
emit_phase_archive_lines() {
  local parent="$1" label="${2:-アーカイブ}" d pname n
  find "$parent" -maxdepth 1 -type d -name 'phase*' 2>/dev/null | sort | while read -r d; do
    n="$(count_md_r "$d")"
    [ "$n" = "0" ] && continue
    pname="$(basename "$d")"
    echo "- (archive) \`$d/\` — ${pname} の${label}(${n} 件)"
  done
}

emit_dir_map() {
  echo '## 2. ディレクトリ別 役割マップ'
  echo
  echo '> フォルダによって粒度が異なる: **design / handover はファイル単位**で役割(タイトル)を示し、'
  echo '> change-notes / instructions / progress 等は **フォルダの役割**のみ示す。各バックアップ'
  echo '> (`archive/` `phase{N}/`)は軽く件数のみ触れる。役割はタイトル準拠で、手書き概要は持たない。'
  echo

  echo '### `docs/design/` — 設計書本体(プロジェクト恒久・真の情報源)'
  echo
  emit_files_in docs/design
  echo

  echo '### `docs/handover/` — 引き継ぎ・恒久運用資料(設計担当の参照元)'
  echo
  emit_files_in docs/handover
  echo
  if [ -d docs/handover/archive ] && [ "$(count_md docs/handover/archive)" != 0 ]; then
    echo "- (archive) \`docs/handover/archive/\` — 過去マイルストーンの引き継ぎ書アーカイブ($(count_md docs/handover/archive) 件)"
  fi
  emit_phase_archive_lines docs/handover "引き継ぎ書アーカイブ"
  echo

  echo '### `docs/change-notes/` — 設計変更の通知・レポート置き場'
  echo
  echo '- 設計変更通知書 `CHANGE-{番号}-{サブマイルストーン番号}-{概要}.md` と'
  echo '  完了レポート `change-report-{番号}.md` の置き場。'
  echo "  直下 $(count_md docs/change-notes) 件。"
  emit_phase_archive_lines docs/change-notes "変更通知書・レポートのアーカイブ"
  echo

  echo '### `docs/instructions/` — 指示書置き場'
  echo
  echo '- マイルストーン指示書 / 調査指示書(`*-RESEARCH-*`) / `*-overview.md` の置き場。'
  echo "  直下 $(count_md docs/instructions) 件。"
  echo "- \`docs/instructions/reviews/\` — レビューチェックリストの置き場($(count_md docs/instructions/reviews) 件)。"
  # §1 から除外した分、所在は §2 で引けるようにする(設計卓裁定 2026-08-08・3-6 案 B)。
  echo "- \`docs/instructions/templates/\` — 指示書・チェックリスト・通知書のテンプレート置き場($(count_md docs/instructions/templates) 件)。**プレースホルダ ID を持つため §1 の逆引き表には出さない。実パスで開くこと。**"
  emit_phase_archive_lines docs/instructions "指示書・レビューのアーカイブ"
  echo

  echo '### `docs/progress/` — 進捗・レビュー・調査結果置き場'
  echo
  echo '- `progress-log.md` / `progress-summary.md`、各マイルストーンのレビュー結果、`*-RESEARCH-*-report.md`(調査結果)の置き場。'
  echo "  直下 $(count_md docs/progress) 件。"
  emit_phase_archive_lines docs/progress "進捗・レビュー・調査のアーカイブ"
  echo

  echo '### `docs/human-notes/` — 開発者向け運用ノート(設計担当の参照対象はほぼ無し)'
  echo
  echo '- 大半は開発者向けのため本マップでは省略(起動キット類・ガイド類・archive を含む)。'
  if [ -f docs/human-notes/model-allocation.md ]; then
    echo "- 例外(設計担当も参照): \`model-allocation.md\` — $(doc_title docs/human-notes/model-allocation.md)"
  fi
  echo
}

# ---------------------------------------------------------------------------
# 組み立て + 抽出破損ガード
#   主要セクションが空(リファクタで抽出パターンが壊れた可能性)なら stderr に報告して exit 1。
#   OUT は更新しない。
# ---------------------------------------------------------------------------
sec1="$(emit_id_index)"
sec2="$(emit_dir_map)"

fail=0
need() {  # ラベル, セクション内容, 「1 件以上あれば一致する」ERE パターン
  # `grep -q` は使わない。本スクリプトは `set -o pipefail` で走るため、-q が最初の一致で
  # 早期終了すると上流の printf が SIGPIPE(141)で落ち、pipefail がそれを拾って
  # 「一致したのに不一致」と判定する。セクションがパイプバッファ(64KiB)を超えた時点で
  # 顕在化する(2026-08-10 に §1 が 94KB へ育って恒常再現。それ以前は間欠だった)。
  # grep から -q を外すと入力を最後まで読み切るため SIGPIPE が起きない。
  if ! printf '%s\n' "$2" | grep -E "$3" >/dev/null; then
    echo "❌ 抽出破損の疑い: $1 が見つかりません(抽出パターンが壊れた可能性。手編集で取り繕わず原因を調査してください)" >&2
    fail=1
  fi
}
need "§1 文書ID逆引き(DES-002)"   "$sec1" '\| `DES-002` \|'
need "§1 文書ID逆引き(REQ-001)"   "$sec1" '\| `REQ-001` \|'
need "§2 design ファイル単位"      "$sec2" '`02-architecture\.md`'
if [ "$fail" -ne 0 ]; then
  echo "生成を中止しました($OUT は更新していません)。" >&2
  exit 1
fi

{
  cat <<EOF
# docs-map.md(自動生成 — **手編集禁止**)

生成: ${GEN_DATE} / commit \`${GEN_COMMIT}\` / \`scripts/generate-docs-map.sh\`

本資料は設計担当(Web 版 Claude、リポジトリのファイル構成を直接見られない)向けの
**文書ID ⇄ 実パス対応** と **docs 配下の役割マップ** です。指示書で \`DES-002\` のように
**文書ID で参照** した資料の実パスをここで確認できます(実装担当 Claude Code の無駄な探索や
「読まずに着手」を防ぐ目的)。

## 本資料の限界

- **静的 grep/awk 抽出** のため、以下は取りこぼし・不正確になりうる:
  - 文書ID/バージョンは各文書 **冒頭メタデータ表**(\`| 文書ID |\` / \`| バージョン |\`)の
    最初の行から取る。表が無い文書は §1 に出ない(§2 では出る)
  - 各ファイルの「役割」は **先頭 \`# \` 見出し(タイトル)** を採用する。手書きの概要説明は
    持たない(決定論にならないため)。タイトルが説明的でないファイルは役割が読み取りにくい
  - §2 は **フォルダごとに粒度が異なる**(design / handover はファイル単位、その他はフォルダ役割)。
    粒度方針とフォルダ役割文は本スクリプト内の config。フォルダ構成が変わったらスクリプトを更新する
  - \`archive/\` \`phase{N}/\`(phase1 / phase2 / …)等のバックアップは件数のみで中身は列挙しない
  - **\`docs/instructions/templates/\` 配下は §1 の対象外**(プレースホルダ ID のため逆引きが
    成立しない)。**テンプレートは実パスで開くものである。§2 のフォルダ役割マップには残る**
- 最終的な正は常にリポジトリの実ファイル。疑わしい場合は本資料ではなく実パスを確認すること。

---

EOF
  printf '%s\n\n---\n\n' "$sec1"
  printf '%s\n' "$sec2"
} > "$OUT"

echo "✅ 生成しました: $OUT (${GEN_DATE}, commit ${GEN_COMMIT})"

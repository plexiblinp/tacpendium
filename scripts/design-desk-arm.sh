#!/usr/bin/env bash
# design-desk-arm.sh — 設計卓セッションの武装(実装ソースを作業ツリーから物理排除する)
#
# 背景: 設計卓を Claude Code へ移すと、これまで「全ソース不可視」が物理的に担保していた
#   設計と実装の分離が外れる(2026-08-11 開発者懸念「ソースコードも読めてしまう事から、
#   仕様駆動が崩れるのは問題」)。
#
#   **フックによる Read 遮断では足りない。** `.claude/settings.json` の allow は
#   `Bash(cat:*)` `Bash(sed:*)` `Bash(head:*)` `Bash(tail:*)` `Bash(grep:*)` `Bash(rg:*)`
#   `Bash(find:*)` `Bash(awk:*)` をパス制限なしで事前承認しており、Read ツールだけを
#   塞いでも `sed -n '1,200p' internal/service/x.go` が**承認プロンプトすら出さずに通る**。
#   「チャネル別のガードはチャネルを跨がれる」——settings.json が MCP を一括 deny した
#   理由(「Bash と別ツール面の API 実行のため Bash の deny が効かず」)と同じ型である。
#
#   **本スクリプトは物理排除で解く。** sparse-checkout で実装ファイルを作業ツリーから
#   消すと、上記のテキストツール群は**まとめて空振りする**(ファイルが存在しないため)。
#   残る漏れ経路は git のオブジェクト読み出しだけになり、有限の閉じた集合へ縮む。
#   その集合は `.claude/hooks/design-desk-guard.sh` が塞ぐ。
#
# 別リポジトリ化を採らない理由: 2 つ目の disk を作ると「どちらが正本か」「本当に着地したか」
#   が再び曖昧になる。それは playbook §21.3「現行版の正本は repo に置く」が是正した
#   E-33／G-5(中央が repo を見られないまま「反映済」と宣言し独立監査が 2 度走った)の再演である。
#
# 使い方:
#   bash scripts/design-desk-arm.sh              # 武装(既定)
#   bash scripts/design-desk-arm.sh --status     # 現在の状態を表示
#   bash scripts/design-desk-arm.sh --self-test  # 自己検査
#
# **解除モードは意図的に持たない。** 解除は開発者が自分の端末で行う(HTML 説明書 §5)。
#   セッション内から解除できると自己武装の意味が消えるため。
#
# 正本: docs/progress/20260811-design-desk-surface-study.md §3
set -euo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
MARKER="$ROOT/tmp/.design-desk-armed"

# 設計卓に残す領域。ここ以外の追跡ファイルは作業ツリーから消える。
# cone モードの仕様上、リポジトリ直下のファイル(CLAUDE.md / go.mod / embed_*.go 等)は常に残る。
ALLOWED_ROOTS=(docs .claude scripts)

usage() { sed -n '2,32p' "$0" | sed 's/^# \{0,1\}//'; }

status() {
  echo "# 設計卓の武装状態"
  echo
  if [ -f "$MARKER" ]; then
    echo "武装: **あり**"
    echo "マーカー: $MARKER"
    sed 's/^/  /' "$MARKER"
  else
    echo "武装: なし(通常セッション)"
  fi
  echo
  echo "sparse-checkout:"
  if git -C "$ROOT" sparse-checkout list >/dev/null 2>&1; then
    git -C "$ROOT" sparse-checkout list 2>/dev/null | sed 's/^/  /'
  else
    echo "  (未設定 = 全ファイルが作業ツリーにある)"
  fi
  echo
  echo "作業ツリーのトップレベル:"
  (cd "$ROOT" && ls -d */ 2>/dev/null | sed 's/^/  /')
}

arm() {
  if [ ! -d "$ROOT/.git" ] && [ ! -f "$ROOT/.git" ]; then
    echo "design-desk-arm: git リポジトリではありません: $ROOT" >&2
    exit 1
  fi

  # 排除対象に未コミットの変更があると sparse-checkout が壊す。先に止める。
  local dirty
  dirty="$(git -C "$ROOT" status --porcelain 2>/dev/null \
    | awk '{ print $NF }' \
    | grep -vE "^($(IFS='|'; echo "${ALLOWED_ROOTS[*]}"))/" \
    | grep -vE '^[^/]+$' || true)"
  if [ -n "$dirty" ]; then
    echo "design-desk-arm: 排除対象に未コミットの変更があります。先にコミットするか開発者へ回してください:" >&2
    printf '%s\n' "$dirty" | sed 's/^/  /' >&2
    exit 1
  fi

  git -C "$ROOT" sparse-checkout set "${ALLOWED_ROOTS[@]}"

  mkdir -p "$ROOT/tmp"
  {
    echo "armed_at_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "allowed_roots=${ALLOWED_ROOTS[*]}"
    echo "commit=$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)"
  } > "$MARKER"

  echo "# 設計卓を武装しました"
  echo
  echo "作業ツリーに残した領域: ${ALLOWED_ROOTS[*]}(＋リポジトリ直下のファイル)"
  echo "実装ソース(internal/ web/src/ cmd/ migrations/ 等)は**作業ツリーに存在しません**。"
  echo
  echo "この状態では次が有効です:"
  echo "  - cat / sed / grep / rg / find 等は実装パスに対して空振りします"
  echo "  - git のオブジェクト読み出し(show / log -p / diff <rev> / grep / cat-file 等)は"
  echo "    .claude/hooks/design-desk-guard.sh がブロックします"
  echo "  - 解除はセッション内からはできません(開発者が自分の端末で行います)"
  echo
  echo "実装の事実が必要になったら docs/handover/code-facts.md を引くか、"
  echo "Explore サブエージェントに問い、**蒸留された答えだけ**を受け取ってください。"
}

self_test() {
  local fail=0
  echo "# design-desk-arm.sh 自己検査"
  echo

  # (1) ALLOWED_ROOTS が実在する
  for r in "${ALLOWED_ROOTS[@]}"; do
    if [ -d "$ROOT/$r" ]; then echo "OK  ALLOWED_ROOTS: $r が実在する"
    else echo "NG  ALLOWED_ROOTS: $r が無い"; fail=1; fi
  done

  # (2) 対になるガードが存在し、マーカーのパスが一致している
  local guard="$ROOT/.claude/hooks/design-desk-guard.sh"
  if [ -f "$guard" ]; then
    echo "OK  対のガード $guard が存在する"
    if grep -q 'tmp/.design-desk-armed' "$guard"; then
      echo "OK  ガードのマーカーパスが本スクリプトと一致する"
    else
      echo "NG  ガードのマーカーパスが一致しない(本スクリプト: tmp/.design-desk-armed)"; fail=1
    fi
  else
    echo "NG  対のガード $guard が無い(武装しても解除経路が塞がれない)"; fail=1
  fi

  # (3) 解除モードを持たないこと(自己武装の前提)
  if grep -qE '^\s*--disarm\)' "$0"; then
    echo "NG  --disarm を持っている(セッション内から解除できてはならない)"; fail=1
  else
    echo "OK  解除モードを持たない"
  fi

  # (4) マーカーが Git 管理外であること
  if grep -qE '^/tmp/' "$ROOT/.gitignore" 2>/dev/null; then
    echo "OK  マーカー置き場 tmp/ は .gitignore 済み"
  else
    echo "NG  tmp/ が .gitignore されていない(マーカーが誤ってコミットされうる)"; fail=1
  fi

  echo
  if [ "$fail" -eq 0 ]; then
    echo "自己検査: 合格(武装の前提と、対を成すガードの存在を確かめた)"
  else
    echo "自己検査: **不合格**"
  fi
  return "$fail"
}

case "${1:---arm}" in
  --arm)       arm ;;
  --status)    status ;;
  --self-test) self_test ;;
  -h|--help)   usage ;;
  *) echo "design-desk-arm: 未知の引数: $1(--arm / --status / --self-test)" >&2; exit 2 ;;
esac

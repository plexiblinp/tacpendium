#!/usr/bin/env bash
# check-manual-images.sh — 配布する操作説明書の図が**全数実在するか**を見る門(M36-02・射程 1)
#
# 背景: D-890 の裁定 ——「**組める**」ことは「**配布してよい**」ことではない。
#   M36-01 で `make release-archives` は通るようになったが、そのとき
#   `docs/usermanual/` の図が 1 枚も撮られていなくても**検査は全緑のまま**であった
#   (check-release-archive.sh の RELEASE_REQUIRED_DIRS は
#    `manual/images` を**ディレクトリとして在るか**しか見ない＝版ゲート 3b / D-886)。
#   ⇒ `img` がリンク切れの説明書を同梱した配布物が、そのまま組み上がる。
#   本スクリプトはその状態を**リリースを打つ経路で**止めるためにある。
#
# ★★置き場の判断(指示書 §2.2-5 は実装判断と定める。理由をここに残す):
#   **check-release-archive.sh へ足さなかった。** 同検査は
#   build-release-archives.sh の末尾が**必ず呼ぶ**ため、そこへ門を足すと
#   `make release-archives` そのものが塞がる。⇒ **開発中に組めなくなる**
#   (指示書 §3-2 が명示的に禁じている)。
#   ⇒ 独立した検査にし、**リリースを打つ経路(.github/workflows/release.yml)からだけ呼ぶ。**
#
# ★★★「PNG が 0 枚でないか」では弱い —— 1 枚でも在れば通ってしまう(D-890 の逐語)。
#   ⇒ 本検査は**参照 1 件ごとに実体を見る**。
#
# ★走査対象は説明書ディレクトリ直下の **`*.html` 全数**である。名前を列挙しない(D-886)。
#   ⇒ クイックスタート(M32-03)のように説明書が増えても、ここを直さずに母集団へ入る。
#   (レビューチェックリスト B-5 = 本編だけ見ていないか)
#
# 使い方:
#   bash scripts/check-manual-images.sh              # 検査(既定)
#   bash scripts/check-manual-images.sh <dir>        # 別のディレクトリを見る(自己検査用)
#   bash scripts/check-manual-images.sh --self-test  # 陽性対照・陰性対照で自身を検査
#
# 終了コード: 0=違反なし / 1=違反あり / 2=実行エラー
#
# 限界:
#   - **図が「在る」ことしか見ない。** 中身が正しい画面かどうか・古くないかは見ない。
#     それは人が読む以外に経路が無い(SCREENSHOT-RULES.md の撮影ルールが受け持つ)。
#   - **`src` 属性が二重引用符であることを前提にする。** ⇒ 前提が崩れたことは
#     `<img` の個数と抽出件数の突合で検出する(黙って見逃さない)。
#   - 外部 URL(`http:` / `https:` / `//` / `data:`)は**実在を見ない**。
#     手元から到達性を確かめる検査ではないため。
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "ERROR: git リポジトリ内で実行してください" >&2
  exit 2
}
cd "$ROOT"

# shellcheck source=scripts/release-targets.sh
. scripts/release-targets.sh || { echo "ERROR: scripts/release-targets.sh を読めません" >&2; exit 2; }

VIOLATIONS=0
fail() { printf 'NG  %s\n' "$*"; VIOLATIONS=$((VIOLATIONS + 1)); }
ok()   { printf 'OK  %s\n' "$*"; }
note() { printf '    %s\n' "$*"; }

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || { echo "ERROR: '$1' コマンドが見つかりません" >&2; exit 2; }
}

# ★一時領域は「スクリプトに 1 つ」持ち、EXIT / INT / TERM で片づける
#   (check-release-archive.sh / check-dist-readme.sh と同じ流儀)。
WORKDIR=""
cleanup() { [ -n "$WORKDIR" ] && [ -d "$WORKDIR" ] && rm -rf "$WORKDIR"; }
trap cleanup EXIT INT TERM

# ---------------------------------------------------------------------------
# 説明書 1 本を見る。0=違反なし / 1=違反あり
#   第 2 引数は相対参照の解決起点(= 説明書の在るディレクトリ)。
# ---------------------------------------------------------------------------
LOCAL_REFS_SEEN=0   # ★ディレクトリ全体で数える。0 件なら「抜けていない」ではなく「抜けなくなった」

check_html() {
  local html="$1" base="$2"
  local label bad=0
  label="$(basename "$html")"

  local img_tags src_attrs src_count
  # ★★src の抽出は **img タグの中に限る**(M36-02 レビュー 中-5)。
  #   ⇒ 文書全体から `src="` を拾うと、`<script src=...>` や `<iframe src=...>` が
  #     混ざり、下の突合が**誤って赤になる**。★いまは 0 件だが、そうなる前に閉じる。
  #   ★img タグが複数行にまたがる場合は抽出件数が減り、下の突合が赤になる
  #     (＝黙って見逃さない側に倒れる)。
  img_tags="$(grep -oF '<img' "$html" 2>/dev/null | wc -l)"
  src_attrs="$(grep -oE '<img[^>]*>' "$html" 2>/dev/null \
                 | grep -oE 'src="[^"]*"' \
                 | sed -e 's/^src="//' -e 's/"$//')"
  if [ -z "$src_attrs" ]; then
    src_count=0
  else
    src_count="$(printf '%s\n' "$src_attrs" | wc -l)"
  fi

  # ★(1) `<img` の個数と抽出件数が合わないなら、**抽出そのものが漏れている。**
  #   例: `<img src='...'>` (単引用符)。⇒ 黙って「参照が少ない」状態にしない。
  if [ "$img_tags" -ne "$src_count" ]; then
    fail "$label: img タグ $img_tags 件に対し src=\"...\" が $src_count 件しか読めません"
    note "★src 属性が二重引用符でない img があります。抽出が漏れるため実在確認ができません。"
    bad=1
  fi

  # ★(2) 参照 1 件ごとに実体を見る。**枚数では見ない。**
  local ref
  while IFS= read -r ref; do
    [ -n "$ref" ] || continue
    case "$ref" in
      http://*|https://*|//*|data:*)
        note "$label: 外部参照のため実在は見ません: $ref"
        continue
        ;;
      /*)
        fail "$label: 絶対パスの参照はアーカイブ内で解決できません: $ref"
        bad=1
        continue
        ;;
      *..*)
        fail "$label: 説明書ディレクトリの外へ出る参照です: $ref"
        bad=1
        continue
        ;;
    esac

    LOCAL_REFS_SEEN=$((LOCAL_REFS_SEEN + 1))
    if [ -f "$base/$ref" ]; then
      if [ -s "$base/$ref" ]; then
        ok "$label: $ref"
      else
        fail "$label: 参照先が空ファイルです: $ref"
        bad=1
      fi
    else
      fail "$label: 参照先が在りません: $ref"
      bad=1
    fi
  done <<< "$src_attrs"

  return "$bad"
}

# ---------------------------------------------------------------------------
# 説明書ディレクトリを見る。0=違反なし / 1=違反あり
# ---------------------------------------------------------------------------
check_manual_dir() {
  local dir="$1"
  local bad=0 html_count=0

  if [ ! -d "$dir" ]; then
    echo "ERROR: 説明書ディレクトリが在りません: $dir" >&2
    return 2
  fi

  LOCAL_REFS_SEEN=0

  local html
  for html in "$dir"/*.html; do
    [ -f "$html" ] || continue
    html_count=$((html_count + 1))
    check_html "$html" "$dir" || bad=1
  done

  # ★(3) 説明書が 1 本も無い。⇒ 走査対象を取り違えている。
  if [ "$html_count" -eq 0 ]; then
    fail "$dir に説明書(*.html)が 1 本も在りません"
    return 1
  fi

  # ★★(4) **空集合の罠。** 参照が 1 件も無いのは「リンク切れが無い」ではなく
  #   「**抜けなくなった**」状態でありうる(HTML の書き方が変わった等)。
  #   ⇒ 緑で通さない。
  if [ "$LOCAL_REFS_SEEN" -eq 0 ]; then
    fail "$dir: 説明書 $html_count 本から図の参照を 1 件も読めませんでした"
    note "★「リンク切れが無い」ではなく「参照を抽出できていない」可能性があります。"
    return 1
  fi

  note "説明書 $html_count 本 / 図の参照 $LOCAL_REFS_SEEN 件を見ました"
  return "$bad"
}

# ---------------------------------------------------------------------------
# --self-test: 陽性対照・陰性対照
#   ★★陽性が赤・陰性が緑であることを機械で示す。「在る」と「効く」は別である。
# ---------------------------------------------------------------------------
self_test() {
  local failures=0
  need_cmd grep; need_cmd sed

  WORKDIR="$(mktemp -d)" || { echo "ERROR: mktemp -d に失敗しました" >&2; return 2; }

  # 説明書 1 本を作る。$3 以降は「参照する図の名前」。実体は _png で別途作る。
  _html() {
    local path="$1"; shift
    local ref
    { echo '<html><body>'
      for ref in "$@"; do printf '<figure><img src="%s" alt="x"></figure>\n' "$ref"; done
      echo '</body></html>'
    } > "$path"
  }
  _png() { mkdir -p "$(dirname "$1")"; printf 'PNG-dummy\n' > "$1"; }

  _expect() {
    local label="$1" want="$2" dir="$3" got
    local saved="$VIOLATIONS"
    VIOLATIONS=0
    check_manual_dir "$dir" >/dev/null 2>&1
    got=$?
    VIOLATIONS="$saved"
    if [ "$got" -eq "$want" ]; then
      printf 'OK  self-test: %s (期待 %s / 実際 %s)\n' "$label" "$want" "$got"
    else
      printf 'NG  self-test: %s (期待 %s / 実際 %s)\n' "$label" "$want" "$got"
      failures=$((failures + 1))
    fi
  }

  # --- 陰性対照 A: 参照と実体が揃っていれば緑 --------------------------------
  local a="$WORKDIR/a"
  mkdir -p "$a"
  _html "$a/main.html" "images/ch01-x.png" "images/ch02-y.png"
  _png "$a/images/ch01-x.png"; _png "$a/images/ch02-y.png"
  _expect "陰性対照 A = 参照と実体が揃っている" 0 "$a"

  # --- 陰性対照 B: 外部 URL が混ざっていても緑(実在を見ないだけで赤にしない) ---
  local b="$WORKDIR/b"
  mkdir -p "$b"
  _html "$b/main.html" "https://example.com/remote.png" "images/ch01-x.png"
  _png "$b/images/ch01-x.png"
  _expect "陰性対照 B = 外部 URL 混在(★実在は見ないが赤にしない)" 0 "$b"

  # --- 陰性対照 C: 参照されていない図が余分に在っても緑 ----------------------
  #   ★「*あるべきものが在るか*で見て、*それしか無いか*では見ない」(D-886 / P-1)。
  local c="$WORKDIR/c"
  mkdir -p "$c"
  _html "$c/main.html" "images/ch01-x.png"
  _png "$c/images/ch01-x.png"; _png "$c/images/unused-1.png"; _png "$c/images/unused-2.png"
  _expect "陰性対照 C = 参照されない図が余分に 2 枚(★枚数で固定していない証拠)" 0 "$c"

  # --- 陽性対照 1: 図を 1 枚どけると赤(★門の本体) ---------------------------
  local p1="$WORKDIR/p1"
  mkdir -p "$p1"
  _html "$p1/main.html" "images/ch01-x.png" "images/ch02-y.png"
  _png "$p1/images/ch01-x.png"          # ★ch02-y.png を作らない
  _expect "陽性対照 = 図を 1 枚どけた" 1 "$p1"

  # --- 陽性対照 2: 図が 1 枚も参照されていない(★空集合の罠) -----------------
  local p2="$WORKDIR/p2"
  mkdir -p "$p2"
  _html "$p2/main.html"
  _png "$p2/images/ch01-x.png"
  _expect "陽性対照 = 参照 0 件(★「PNG が在る」だけでは通さない)" 1 "$p2"

  # --- 陽性対照 3: src が単引用符で抽出漏れ(★静かな見逃しの検出) -------------
  local p3="$WORKDIR/p3"
  mkdir -p "$p3"
  printf '<html><body><img src=%s></body></html>\n' "'images/ch01-x.png'" > "$p3/main.html"
  _png "$p3/images/ch01-x.png"
  _expect "陽性対照 = src が単引用符(★img の個数と突合して検出)" 1 "$p3"

  # --- 陽性対照 4: 絶対パス参照(アーカイブ内で解決できない) ------------------
  local p4="$WORKDIR/p4"
  mkdir -p "$p4"
  _html "$p4/main.html" "/images/ch01-x.png"
  _png "$p4/images/ch01-x.png"
  _expect "陽性対照 = 絶対パス参照" 1 "$p4"

  # --- 陽性対照 5: ★2 本目の説明書だけが壊れている ---------------------------
  #   ★本編だけ見て終わっていないことの証明(レビューチェックリスト B-5)。
  local p5="$WORKDIR/p5"
  mkdir -p "$p5"
  _html "$p5/main.html"      "images/ch01-x.png"
  _html "$p5/quickstart.html" "images/qs-1.png"
  _png "$p5/images/ch01-x.png"          # ★qs-1.png を作らない
  _expect "陽性対照 = 2 本目の説明書だけ壊れている(★本編だけ見ていない証拠)" 1 "$p5"

  # --- 陽性対照 6: 空ファイルの図(「在る」は成立してしまう) ------------------
  local p6="$WORKDIR/p6"
  mkdir -p "$p6/images"
  _html "$p6/main.html" "images/ch01-x.png"
  : > "$p6/images/ch01-x.png"
  _expect "陽性対照 = 図が空ファイル" 1 "$p6"

  if [ "$failures" -eq 0 ]; then
    # ★文言 "自己検査: 合格" は check-artifact-integrity.sh が拾うマーカーである。変えないこと。
    echo "自己検査: 合格(陽性は赤・陰性は緑。陰性 3 / 陽性 6)"
    return 0
  fi
  echo "自己検査: 不合格 — $failures 件の対照が期待と違いました"
  return 1
}

# ---------------------------------------------------------------------------
main() {
  case "${1:-}" in
    --self-test) self_test; exit $? ;;
    -h|--help)   sed -n '1,45p' "$0"; exit 0 ;;
  esac

  need_cmd grep; need_cmd sed

  local dir="${1:-$RELEASE_MANUAL_SRC}"
  local rc
  check_manual_dir "$dir"
  rc=$?
  [ "$rc" -eq 2 ] && exit 2

  echo
  if [ "$VIOLATIONS" -eq 0 ]; then
    echo "違反なし(説明書の図はすべて実在します: $dir)"
    exit 0
  fi
  echo "違反 $VIOLATIONS 件"
  echo "★配布してよい状態ではありません。図を撮る／参照を直してから再実行してください。"
  exit 1
}

main "$@"

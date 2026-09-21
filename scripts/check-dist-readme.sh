#!/usr/bin/env bash
# check-dist-readme.sh — 配布版 README.txt の生成と照合(決定論)
#
# 背景: `README.txt` は配布 zip の必須成果物である。3 つの独立した根拠がそう定めている——
#   (a) `docs/design/02-architecture.md` §11.2 がアーカイブの中身に列挙している
#   (b) `.github/workflows/nightly-crossbuild.yml` が「同梱すべき README.txt こそが
#       LAN の FW/AV トラブルシューティングの本体である」と書いている
#   (c) `cmd/tacpendium/main.go` の LAN 起動バナーが「詳細は README.txt を参照して
#       ください」と実行時に印字する
#   ⇒ ルートから動かせない。一方で「リポジトリ上の正本」は操作説明書と同じ場所にあるべき
#   である(D-743)。そこで正本を docs/usermanual/ 配下に置き、ルートの README.txt は
#   そこから生成した成果物とし、生成物もコミットする(生成方式 (b) = D-755)。
#
#   ★正本と生成物が 2 つある以上、放っておけば必ずずれる。本スクリプトはそのずれを
#   終了コードで検出するためにある。
#
# 使い方:
#   bash scripts/check-dist-readme.sh              # 照合(既定)。書き込まない
#   bash scripts/check-dist-readme.sh --write      # 正本から README.txt を生成する
#   bash scripts/check-dist-readme.sh --self-test  # 陽性対照・陰性対照でこのスクリプト自身を検査
#
#   ★既定を照合にしてあるのは、呼び出し側を選ばないようにするためである(D-766)。
#     `combomgr` 側は CLAUDE.md §8 の常設検査の表ないし手動起動の CI、`tacpendium` 側は
#     自動毎回を想定しており、どちらも引数なしの 1 コマンドで回せる。
#     ★あわせて、既定が書き込みでないため、うっかり実行しても正本・生成物のどちらも壊れない。
#
# 終了コード: 0=一致(または生成成功) / 1=差分あり / 2=実行エラー
#
# 生成規則: 生成物 = 正本の全文 + 末尾の生成注記ブロック。
#   ★注記に日付・コミットハッシュを入れてはならない。入れると照合が回すたびに赤になり、
#   「赤いのが普通」になって実際のドリフトを検出できなくなる
#   (cmd/seedgen/main.go が -check について同じ落とし穴を明記している)。
#
# 限界:
#   - 本検査が見るのは (a)「正本と生成物が一致しているか」と
#     (b)「**アーカイブ名**が構成の正本 RELEASE_TARGETS と一致しているか」の 2 つである。
#     ★★(b) は 2026-09-19(M36-02・射程 7)に足した。**それ以前は「正本の内容が正しいかは
#     見ない」と宣言しており、M38-03 の改名が実際にその穴を踏んだ。**
#   - **それ以外の意味の検査はしない。** ⇒ 起動方法の節に写されている**実行ファイル名**
#     (RELEASE_TARGETS の 2 列目)は**まだ機械で結ばれていない。** 同じ型の写しであり、
#     次に実行ファイル名を動かすと本検査は気づかない(★射程 7 の範囲外。申し送り済み)。
#   - 文面が利用者にとって正しいか・手順が実際に通るかは見ない。人が読む以外に経路が無い。
#   - 改行コードは .gitattributes の `* text=auto eol=lf` に従い LF 前提である。
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "ERROR: git リポジトリ内で実行してください" >&2
  exit 2
}
cd "$ROOT"

SRC="docs/usermanual/dist-readme.txt"
OUT="README.txt"

# ★★配布物の構成の正本(アーカイブ名 / 中の実行ファイル名 / 形式)。
#   ⇒ 射程 7(M36-02)でアーカイブ名の照合に使う。名前をここへ写さない(E-76)。
# shellcheck source=scripts/release-targets.sh
. scripts/release-targets.sh || { echo "ERROR: scripts/release-targets.sh を読めません" >&2; exit 2; }

# ---------------------------------------------------------------------------
# 一時領域は「スクリプトに 1 つ」持ち、EXIT / INT / TERM で片づける。
#   ★`$(mktemp).diff` のような派生名は共有 TMPDIR で先回りされうる予測可能名になる。
#   ★関数ローカルの RETURN trap は set -u と噛み合わない(片づけが後から走り、
#     変数が未定義になっている)。⇒ トラップは 1 つだけ、最上位に置く。
# ---------------------------------------------------------------------------
#   ★WORKDIR は「最上位で先に作る」。scratch を `$(scratch …)` で呼ぶと
#     コマンド置換のサブシェルになり、(a) そこでの WORKDIR 代入は親へ戻らず
#     (b) サブシェルでは trap が既定へ戻るため、作った一時ディレクトリが
#     誰にも片づけられずに残る。⇒ 作るのは 1 回、トラップの効く場所で行う。
WORKDIR="$(mktemp -d)" || { echo "ERROR: mktemp -d に失敗しました" >&2; exit 2; }
cleanup() { [ -n "${WORKDIR:-}" ] && rm -rf "$WORKDIR"; }
trap cleanup EXIT INT TERM

# scratch <名前> — WORKDIR の下の副ディレクトリを作り、そのパスを返す
#   ★名前は固定でよい。用途ごとに分かれており、同じ用途の中では使い捨てである。
scratch() {
  local d="$WORKDIR/$1"
  mkdir -p "$d" || return 2
  printf '%s' "$d"
}

NOTICE_HEAD="--------------------------------------------------"
# ★注記の宛先を 1 行目で名乗らせる。README.txt は配布 zip の同梱物であり、
#   読み手は利用者である。宛先を書かないと、利用者がリポジトリ相対パスと
#   実行できないコマンドを読まされる(レビュー 中-2)。
NOTICE_BODY="※ ここから下はリポジトリを扱う人向けの注記です(利用者の方は読み飛ばしてください)。
  本ファイルは docs/usermanual/dist-readme.txt から生成されています。
  修正はそちら(正本)を直し、bash scripts/check-dist-readme.sh --write で作り直して
  ください。本ファイルを直接編集すると、次の生成で巻き戻ります。"

# ---------------------------------------------------------------------------
# render <正本パス> — 生成物の中身を標準出力へ出す(書き込みはしない)
# ---------------------------------------------------------------------------
render() {
  local src="$1"
  cat "$src"
  printf '\n%s\n%s\n' "$NOTICE_HEAD" "$NOTICE_BODY"
}

# ---------------------------------------------------------------------------
# compare <正本パス> <生成物パス> — 一致なら 0、差分なら 1、実行エラーなら 2
# ---------------------------------------------------------------------------
compare() {
  local src="$1" out="$2" d rc
  [ -f "$src" ] || { echo "ERROR: 正本がありません: $src" >&2; return 2; }
  [ -f "$out" ] || { echo "ERROR: 生成物がありません: $out" >&2; return 2; }
  d="$(scratch compare)" || { echo "ERROR: 一時領域を作れませんでした" >&2; return 2; }
  render "$src" > "$d/gen" || { echo "ERROR: 生成に失敗しました" >&2; return 2; }
  diff -u "$out" "$d/gen" > "$d/diff" 2>/dev/null
  rc=$?
  # ★diff の終了コードは 0=一致 / 1=差分 / 2以上=diff 自身のエラー。
  #   2 以上を「差分あり」に潰すと、道具が壊れた状態を「検出した」と読んでしまう。
  if [ "$rc" -ge 2 ]; then
    echo "ERROR: diff の実行に失敗しました(終了コード $rc)" >&2
    return 2
  fi
  if [ "$rc" -eq 1 ]; then
    echo "❌ 差分あり: $out は $src から生成した内容と一致しません"
    echo ""
    echo "  --- $out (コミット済み) / +++ 正本から生成し直した内容 ---"
    sed -n '3,$p' "$d/diff" | sed 's/^/  /'
    echo ""
    echo "  正本を直したのなら: bash scripts/check-dist-readme.sh --write"
    echo "  ★生成物を直接編集していたのなら、その変更は正本へ入れ直すこと(そのまま --write すると消える)"
  else
    echo "✅ 一致: $out は $src から生成した内容と同一です"
  fi
  return "$rc"
}

# ---------------------------------------------------------------------------
# check_archive_names <対象ファイル> — 射程 7(M36-02 / followup dist-readme-archive-name-unlinked)
#
# ★★配布 README の SHA-256 の案内は、アーカイブ名を**写している 2 か所目**であり、
#   scripts/release-targets.sh と機械で結ばれていなかった。
#   ⇒ M38-03 の改名(macos → darwin)で実際に手直しが要り、写しが在ることの**証拠**になった。
#
# ★★★なぜ本スクリプトへ置いたか(指示書 §2.7a-2 は置き場を実装判断と定める):
#   本スクリプトは自らの限界として「**正本の内容が正しいかは見ない**。起動方法の
#   実行ファイル名が Makefile の出力と一致しているか、といった意味の検査は人が読む
#   以外に経路が無い」と宣言していた。**射程 7 はまさにその穴である。**
#   ⇒ かつ正本 dist-readme.txt を所有しているのは本スクリプトである。
#   一方 check-release-archive.sh は「README の文面が実態と合うかは見ない」と
#   自ら宣言しており、そちらへ足すと宣言と矛盾する。
#
# 0=全数現れる / 1=欠けている / 2=実行エラー
# ---------------------------------------------------------------------------
check_archive_names() {
  local target="$1" missing=0 entry name
  [ -f "$target" ] || { echo "ERROR: 対象ファイルがありません: $target" >&2; return 2; }

  # ★正本の配列が空なら、照合は「全数現れた」ではなく「何も見ていない」である。
  #   ⇒ 空集合を緑で通さない。
  if [ "${#RELEASE_TARGETS[@]}" -eq 0 ]; then
    echo "ERROR: RELEASE_TARGETS が空です(構成の正本を読めていません)" >&2
    return 2
  fi

  for entry in "${RELEASE_TARGETS[@]}"; do
    name="$(printf '%s' "$entry" | awk -F' :: ' '{print $1}')"
    [ -n "$name" ] || { echo "ERROR: RELEASE_TARGETS の行を解釈できません: $entry" >&2; return 2; }
    if grep -qF -- "$name" "$target"; then
      echo "  ✅ アーカイブ名: $name"
    else
      echo "  ❌ アーカイブ名が $target に現れません: $name"
      missing=$((missing + 1))
    fi
  done

  if [ "$missing" -ne 0 ]; then
    echo ""
    echo "  ★構成の正本は scripts/release-targets.sh です。アーカイブ名を変えたのなら、"
    echo "    正本 $SRC の案内も追随させ、bash scripts/check-dist-readme.sh --write で"
    echo "    生成し直してください(★直すのは正本であって $OUT ではありません)。"
    return 1
  fi
  return 0
}

# ---------------------------------------------------------------------------
# 自己検査: 陽性対照(正本を 1 行変えたら差分として出るか)と
#           陰性対照(無改変なら一致と出るか)を一時ディレクトリで確かめる
#
# ★「回したら緑だった」は機構が生きている証拠にならない。対照で確かめる
#   (environment-reliability-plan §4.1 / check-artifact-integrity.sh と同じ考え方)。
# ---------------------------------------------------------------------------
self_test() {
  local tmpd fail=0 rc
  tmpd="$(scratch selftest)" || { echo "ERROR: 一時領域を作れませんでした" >&2; return 2; }

  # 陰性対照: 正本 → 生成 → 照合 が一致になること
  cp "$SRC" "$tmpd/src.txt" || return 2
  render "$tmpd/src.txt" > "$tmpd/out.txt"
  # ★合否は終了コードの値で見る。真偽だけで見ると 1(差分)と 2(実行エラー)が
  #   同じ顔になり、道具が壊れた状態を対照が「期待どおり」と読む(レビュー 中-1)。
  compare "$tmpd/src.txt" "$tmpd/out.txt" > /dev/null 2>&1
  rc=$?
  if [ "$rc" -eq 0 ]; then
    echo "  ✅ 陰性対照: 無改変なら一致と判定した"
  elif [ "$rc" -eq 1 ]; then
    echo "  ❌ 陰性対照: 無改変なのに差分と判定した(検査が壊れている)"
    fail=1
  else
    echo "  ❌ 陰性対照: 照合が実行エラーで終わった(終了コード $rc)"
    fail=1
  fi

  # 陽性対照: 正本を 1 行だけ変えたら差分として出ること
  #   ★対象を名指しする。任意の 1 行でよいとすると、偽の証拠を作れてしまう
  #     (SUPP-001 §5.5.4 (10))。ここでは起動方法の節の実行ファイル名の行を使う。
  local target='     - Windows : tacpendium-windows-amd64.exe   (公式サポート)'
  # ★存在確認は、下の書き換えとまったく同じ述語(行全体の一致)で行う。
  #   grep -F の部分一致で確かめると、行末が変わったときに「見つかった」まま
  #   書き換えだけが空振りし、陽性対照が黙って無効になる(実際に一度そうなった)。
  if [ "$(awk -v t="$target" '$0 == t { n++ } END { print n + 0 }' "$tmpd/src.txt")" -eq 0 ]; then
    echo "  ❌ 陽性対照: 対照に使う行が正本に見つかりません: $target"
    echo "     (正本の起動方法の節が変わったのなら、本スクリプトの target も直すこと)"
    return 1
  fi
  # 生成物は元のまま、正本だけを変える = 「正本を直して生成し忘れた」状態
  # ★sed -i は GNU 依存である(BSD/macOS は拡張子引数を要求して落ちる)。
  #   tacpendium 側の CI 構成が未決であるため awk + リダイレクトにしてある(レビュー 低-2)。
  awk -v t="$target" '{ if ($0 == t) print "     - Windows : SELFTEST-BROKEN.exe"; else print }' \
    "$tmpd/src.txt" > "$tmpd/src.broken" && mv "$tmpd/src.broken" "$tmpd/src.txt"
  compare "$tmpd/src.txt" "$tmpd/out.txt" > /dev/null 2>&1
  rc=$?
  # ★合格にしてよいのは 1(差分を検出した)だけである。2(実行エラー)を合格に含めると、
  #   照合が壊れている状態で「自己検査: 合格」を出す = false green になる(レビュー 中-1)。
  if [ "$rc" -eq 1 ]; then
    echo "  ✅ 陽性対照: 正本を 1 行変えたら差分として検出した"
  elif [ "$rc" -eq 0 ]; then
    echo "  ❌ 陽性対照: 正本を 1 行変えたのに一致と判定した(検査が何も検出していない)"
    fail=1
  else
    echo "  ❌ 陽性対照: 差分ではなく実行エラーで終わった(終了コード $rc)。対照が壊れている"
    fail=1
  fi

  # ---------------------------------------------------------------------------
  # 射程 7 の対照(M36-02) — アーカイブ名が正本(RELEASE_TARGETS)と機械で結ばれているか
  # ---------------------------------------------------------------------------
  # 陰性対照: 実際の生成物には 3 本のアーカイブ名が全数現れること
  check_archive_names "$OUT" > /dev/null 2>&1
  rc=$?
  if [ "$rc" -eq 0 ]; then
    echo "  ✅ 陰性対照(射程7): アーカイブ名が $OUT に全数現れた"
  elif [ "$rc" -eq 1 ]; then
    echo "  ❌ 陰性対照(射程7): 実際の $OUT でアーカイブ名が欠けていると判定した"
    fail=1
  else
    echo "  ❌ 陰性対照(射程7): 照合が実行エラーで終わった(終了コード $rc)"
    fail=1
  fi

  # 陽性対照: アーカイブ名を 1 つ書き換えたら赤になること
  #   ★対象を名指しする。★既存の陽性対照は起動方法の節(実行ファイル名)の行を使うため、
  #     衝突を避けて **SHA-256 の節のアーカイブ名の行**を使う。
  local victim victim_hits
  victim="$(printf '%s' "${RELEASE_TARGETS[0]}" | awk -F' :: ' '{print $1}')"
  cp "$OUT" "$tmpd/names.txt" || return 2
  # ★存在確認は書き換えとまったく同じ述語(部分一致 grep -F)で行う。
  #   確認と書き換えで述語がずれると、書き換えだけが空振りして対照が黙って無効になる。
  if ! grep -qF -- "$victim" "$tmpd/names.txt"; then
    echo "  ❌ 陽性対照(射程7): 対照に使うアーカイブ名が $OUT に見つかりません: $victim"
    return 1
  fi
  victim_hits="$(grep -cF -- "$victim" "$tmpd/names.txt")"
  # ★sed -i は GNU 依存。既存の流儀に合わせ awk + リダイレクトで書き換える。
  awk -v v="$victim" '{ gsub(v, "SELFTEST-RENAMED-ARCHIVE"); print }' \
    "$tmpd/names.txt" > "$tmpd/names.broken" && mv "$tmpd/names.broken" "$tmpd/names.txt"
  check_archive_names "$tmpd/names.txt" > /dev/null 2>&1
  rc=$?
  if [ "$rc" -eq 1 ]; then
    echo "  ✅ 陽性対照(射程7): アーカイブ名を 1 つ書き換えたら検出した($victim / $victim_hits 箇所)"
  elif [ "$rc" -eq 0 ]; then
    echo "  ❌ 陽性対照(射程7): 書き換えたのに「全数現れた」と判定した(検査が何も見ていない)"
    fail=1
  else
    echo "  ❌ 陽性対照(射程7): 欠落ではなく実行エラーで終わった(終了コード $rc)"
    fail=1
  fi

  if [ "$fail" -ne 0 ]; then
    echo "❌ 自己検査に失敗しました"
    return 1
  fi
  # ★文言 "自己検査: 合格" は check-artifact-integrity.sh が拾うマーカーである。変えないこと。
  echo "自己検査: 合格(陽性は赤・陰性は緑)"
  return 0
}

case "${1:-}" in
  "")
    # ★2 つを**両方**回す。片方が赤でも、もう片方の結果を隠さない
    #   (1 度に全部見えないと、直して回して直して、の往復が増える)。
    compare "$SRC" "$OUT"
    rc_cmp=$?
    [ "$rc_cmp" -ge 2 ] && exit 2

    echo ""
    echo "--- アーカイブ名の照合(構成の正本 scripts/release-targets.sh と突合) ---"
    check_archive_names "$OUT"
    rc_names=$?
    [ "$rc_names" -ge 2 ] && exit 2

    if [ "$rc_cmp" -eq 0 ] && [ "$rc_names" -eq 0 ]; then
      exit 0
    fi
    exit 1
    ;;
  --write)
    [ -f "$SRC" ] || { echo "ERROR: 正本がありません: $SRC" >&2; exit 2; }
    wd="$(scratch write)" || { echo "ERROR: 一時領域を作れませんでした" >&2; exit 2; }
    render "$SRC" > "$wd/gen" || { echo "ERROR: 生成に失敗しました" >&2; exit 2; }
    cat "$wd/gen" > "$OUT" || { echo "ERROR: 書き込みに失敗しました: $OUT" >&2; exit 2; }
    echo "✅ 生成しました: $OUT ($(wc -l < "$OUT") 行、正本 $SRC)"
    exit 0
    ;;
  --self-test)
    self_test
    exit $?
    ;;
  *)
    echo "ERROR: 不明な引数: $1" >&2
    echo "  使い方: bash scripts/check-dist-readme.sh [--write|--self-test]" >&2
    exit 2
    ;;
esac

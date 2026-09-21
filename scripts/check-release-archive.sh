#!/usr/bin/env bash
# check-release-archive.sh — 配布アーカイブの**中身**の検査(決定論・read-only)
#
# 背景: **zip ができることと、中身が正しいことは別である**(M36-01 指示書 §4.1)。
#   manual/ が空でも、README.txt が古くても、zip は問題なくできる。
#   ⇒ 「組めた」で閉じると、組めたことしか分かっていない。
#
# ★本検査の値打ちは --self-test にある —— **中身を 1 つ抜くと落ちること**を、陽性対照で
#   毎回機械的に示す。落ちないなら、その検査は何も見ていない(指示書 §5-3 / チェックリスト
#   A-1・A-2)。scripts/check-artifact-integrity.sh が scripts/check-*.sh に --self-test を
#   機械強制しているため、この破壊確認は一過性のデモではなく常設になる。
#
# ★★検査の方針: **あるべきものが在るか**で見る。**それしか無いか**では見ない(D-886)。
#   ⇒ ファイル数・ファイル名の一覧で固定しない。M32-03 が説明書へクイックスタートを
#     1 本足すため、固定していると着地で赤になる。説明書は今後も章が増減する。
#   ⇒ images/ は**ディレクトリが在れば足りる**。画像の枚数は見ない(版ゲート 3b)。
#     撮影は開発者の手番であり M36-01 の後である。
#
# 使い方:
#   bash scripts/check-release-archive.sh              # dist/release/ の全アーカイブを検査
#   bash scripts/check-release-archive.sh <archive>    # 1 本だけ検査
#   bash scripts/check-release-archive.sh --self-test  # 陽性対照・陰性対照で自身を検査
#
# 終了コード: 0=違反なし / 1=違反あり / 2=実行エラー
#
# 限界:
#   - **中身の「在る / 無い」しか見ない。** exe が本当に動くか、README.txt の文面が実態と
#     合っているか、説明書の中身が正しいかは見ない。⇒ それらは人が読む以外に経路が無い。
#   - 来歴(このバイナリがこのコミットから作られたか)は射程外である(M36-02)。
#     SHA-256 が見るのは「壊れていないこと」だけであり、「正しい出所であること」ではない。
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "ERROR: git リポジトリ内で実行してください" >&2
  exit 2
}
cd "$ROOT"

# shellcheck source=scripts/release-targets.sh
. scripts/release-targets.sh || { echo "ERROR: scripts/release-targets.sh を読めません" >&2; exit 2; }

# ---------------------------------------------------------------------------
# 一時領域はスクリプトに 1 つ持ち、EXIT / INT / TERM で片づける。
#   ★`$(mktemp).x` のような派生名は共有 TMPDIR で先回りされうる予測可能名になる。
#   ★作るのは最上位で 1 回。コマンド置換のサブシェルで作ると trap が既定へ戻り、
#     誰にも片づけられずに残る(check-dist-readme.sh と同じ流儀)。
# ---------------------------------------------------------------------------
WORKDIR=""
cleanup() { [ -n "$WORKDIR" ] && [ -d "$WORKDIR" ] && rm -rf "$WORKDIR"; }
trap cleanup EXIT INT TERM

VIOLATIONS=0
fail() { printf 'NG  %s\n' "$*"; VIOLATIONS=$((VIOLATIONS + 1)); }
ok()   { printf 'OK  %s\n' "$*"; }
note() { printf '    %s\n' "$*"; }

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || { echo "ERROR: '$1' コマンドが見つかりません" >&2; exit 2; }
}

# ---------------------------------------------------------------------------
# エントリ一覧を取り出し、先頭の "./" を落として正規化する。
#   ★zip -r . と tar -C dir -cf - . はどちらも "./" 付きのエントリを作る。
#     正規化しないと、組み方を変えた瞬間に検査が意味を失う。
# ---------------------------------------------------------------------------
list_entries() {
  local archive="$1" kind="$2"
  case "$kind" in
    zip)   zipinfo -1 "$archive" 2>/dev/null ;;
    targz) tar -tzf "$archive" 2>/dev/null ;;
    *)     return 1 ;;
  esac | sed -e 's#^\./##' -e '/^$/d'
}

# エントリ一覧(改行区切り)に、指定の**ファイル**が在るか。
has_file() {
  local entries="$1" path="$2"
  printf '%s\n' "$entries" | grep -qxF "$path"
}

# エントリ一覧に、指定の**ディレクトリ**が在るか。
#   ★ディレクトリエントリ("manual/images/")そのものと、その配下のエントリの
#     どちらでも「在る」と見なす。⇒ 中身が空でも、中身が増えても、どちらでも緑。
#     これが版ゲート 3b(画像 0 枚を不合格にしない)と P-1(件数で固定しない)の実装である。
#   ★★`.gitkeep` の存在に依存していない。zip -r / tar -c はどちらも**空ディレクトリ**を
#     ディレクトリエントリとして格納するため、`.gitkeep` が将来消えて画像に置き換わっても、
#     逆に画像も `.gitkeep` も無くなっても、判定は変わらない。
#     ⇒ 自己検査の陰性対照 E がこれを機械で示す(レビュー 低-12)。
has_dir() {
  local entries="$1" path="$2"
  printf '%s\n' "$entries" | grep -qE "^${path}/"
}

# ---------------------------------------------------------------------------
# アーカイブ 1 本を検査する。0=合格 / 1=不合格
# ---------------------------------------------------------------------------
check_archive() {
  local archive="$1"
  local base entry name binary kind entries bad=0

  base="$(basename "$archive")"

  # 構成の正本(release-targets.sh)から、このアーカイブの定義を引く。
  name=""; binary=""; kind=""
  for entry in "${RELEASE_TARGETS[@]}"; do
    name="$(printf '%s' "$entry"   | awk -F' :: ' '{print $1}')"
    if [ "$name" = "$base" ]; then
      binary="$(printf '%s' "$entry" | awk -F' :: ' '{print $2}')"
      kind="$(printf '%s' "$entry"   | awk -F' :: ' '{print $3}')"
      break
    fi
    name=""
  done

  if [ -z "$name" ]; then
    fail "$base: 構成の正本(scripts/release-targets.sh)に定義が無いアーカイブです"
    return 1
  fi
  if [ ! -f "$archive" ]; then
    fail "$base: アーカイブが在りません: $archive"
    return 1
  fi

  entries="$(list_entries "$archive" "$kind")"
  if [ -z "$entries" ]; then
    fail "$base: エントリを 1 件も読めませんでした(壊れているか、形式が違います)"
    return 1
  fi

  # (1) 中の実行ファイル。★名前は Makefile の出力のまま。勝手に改名しない(D-887)。
  if has_file "$entries" "$binary"; then
    ok "$base: 実行ファイル $binary"
  else
    fail "$base: 実行ファイルが在りません: $binary"
    bad=1
  fi

  # (2) README.txt。★LAN の FW/AV トラブルシューティングの本体であり、欠けると
  #     利用者が最初につまずく箇所の説明が丸ごと消える(DES-002 §11.2)。
  if has_file "$entries" "$RELEASE_README"; then
    ok "$base: $RELEASE_README"
  else
    fail "$base: $RELEASE_README が在りません"
    bad=1
  fi

  # (3) あるべきファイル(説明書の本文)。★サイズ非 0 まで見る ——
  #     空の html を入れても「在る」は成立してしまう(指示書 §4.1 / A-3)。
  local req sz
  for req in "${RELEASE_REQUIRED_FILES[@]}"; do
    if ! has_file "$entries" "$req"; then
      fail "$base: $req が在りません"
      bad=1
      continue
    fi
    sz="$(entry_size "$archive" "$kind" "$req")"
    if [ -z "$sz" ] || [ "$sz" -le 0 ] 2>/dev/null; then
      fail "$base: $req が空です(サイズ ${sz:-不明})"
      bad=1
    else
      ok "$base: $req (${sz} バイト)"
    fi
  done

  # (4) あるべきディレクトリ。★在ることだけを見る。中身の枚数は見ない(版ゲート 3b)。
  for req in "${RELEASE_REQUIRED_DIRS[@]}"; do
    if has_dir "$entries" "$req"; then
      ok "$base: $req/ (ディレクトリ。★枚数は見ない)"
    else
      fail "$base: $req/ がディレクトリとして在りません"
      bad=1
    fi
  done

  # (4b) 追加同梱物。★★配列が空でないときだけ見る(既定は空＝ライセンス関係は同梱しない)。
  #     ⇒ 同梱すると決めて release-targets.sh へ 1 行足した瞬間に、検査が付いてくる形にする。
  #     ★これが無いと、組み立て側の cp が失敗しても(ファイル名変更・移動・タイポ)検査は
  #       緑のままになる。⇒ 「zip ができること」と「中身が正しいこと」は別である、という
  #       本検査の看板が、追加同梱物にだけ効かない状態になる(レビュー 中-5)。
  local extra
  for extra in ${RELEASE_EXTRA_FILES[@]+"${RELEASE_EXTRA_FILES[@]}"}; do
    # ★組み立て側はリポジトリ相対パスを**そのまま保つ**(平坦化しない)。
    #   ⇒ 検査も同じ形で探す。両者がずれると検査が意味を失う。
    #   ★LICENSES/ のディレクトリ名まで一致を見るのは、NOTICE が
    #     「LICENSES/ 配下」と書いているためである(release-targets.sh の注記)。
    if has_file "$entries" "$extra"; then
      ok "$base: 追加同梱物 $extra"
    else
      fail "$base: 追加同梱物が在りません: $extra (正本 RELEASE_EXTRA_FILES)"
      bad=1
    fi
  done

  # (5) チェックサム。★在れば検証する。無いことは violation にしない ——
  #     組み立てが必ず作るが、単体のアーカイブを手で検査する経路もあるため。
  if [ -f "${archive}.sha256" ]; then
    if ( cd "$(dirname "$archive")" && sha256sum -c --status "${base}.sha256" ); then
      ok "$base: SHA-256 照合"
    else
      fail "$base: SHA-256 が一致しません(壊れているか、作り直しが必要です)"
      bad=1
    fi
  else
    note "$base: ${base}.sha256 が無いためチェックサム照合はしていません"
  fi

  return "$bad"
}

# アーカイブ内エントリのサイズを取り出す(バイト)。取れなければ空を返す。
entry_size() {
  local archive="$1" kind="$2" path="$3"
  case "$kind" in
    zip)
      # zipinfo の詳細行から uncompressed size を取る。パスは完全一致で絞る。
      unzip -l "$archive" 2>/dev/null \
        | awk -v p="$path" '{ sub(/^\.\//, "", $NF); if ($NF == p) { print $1; exit } }'
      ;;
    targz)
      tar -tzvf "$archive" 2>/dev/null \
        | awk -v p="$path" '{ n=$NF; sub(/^\.\//, "", n); if (n == p) { print $3; exit } }'
      ;;
  esac
}

# ---------------------------------------------------------------------------
# --self-test: 陽性対照・陰性対照
#
# ★★★これが M36-01 指示書 §5-3 の「破壊確認」の実体である。
#   中身を 1 つ抜くと落ちること**を、3 点(exe / README.txt / manual/)それぞれで見る。
#
# ★★抜くのは「あるべきもの」である(P-2)。**数を 1 つ減らして落ちる形にはしていない** ——
#   件数で判定すると M32-03 がクイックスタートを足した瞬間に赤くなる。
#
# ★★★陰性対照 C が P-1 の証明である —— manual/ に**余分なファイルを足しても緑のまま**で
#   あることを機械で示す。⇒ 本検査が「それしか無いか」を見ていないことの証拠。
# ---------------------------------------------------------------------------
self_test() {
  need_cmd zip; need_cmd unzip; need_cmd zipinfo; need_cmd tar; need_cmd sha256sum

  WORKDIR="$(mktemp -d)" || { echo "ERROR: mktemp -d に失敗しました" >&2; exit 2; }
  local failures=0

  # 合成のステージング木を作る。中身は本物でなくてよい(本検査は在る / 無いしか見ない)。
  _stage() {
    local dir="$1" binary="$2" extra
    mkdir -p "$dir/manual/images"
    printf 'dummy binary\n'   > "$dir/$binary"
    printf 'dummy readme\n'   > "$dir/$RELEASE_README"
    printf '<html>x</html>\n' > "$dir/manual/tacpendium-readme.html"
    printf 'placeholder\n'    > "$dir/manual/images/.gitkeep"
    # ★追加同梱物も配列どおりに作る(パスを保つ)。⇒ 配列が空なら何も作らない。
    #   これにより、配列を変えても自己検査がそのまま追随する。
    for extra in ${RELEASE_EXTRA_FILES[@]+"${RELEASE_EXTRA_FILES[@]}"}; do
      mkdir -p "$dir/$(dirname "$extra")"
      printf 'dummy license\n' > "$dir/$extra"
    done
  }
  _pack_zip()   { ( cd "$1" && zip -X -q -r "$2" . ); }
  _pack_targz() { tar --sort=name --owner=0 --group=0 --numeric-owner --mtime="@0" \
                      -C "$1" -cf - . | gzip -n -9 > "$2"; }

  # 期待どおりか判定する。want=0(緑であるべき) / want=1(赤であるべき)
  _expect() {
    local label="$1" want="$2" archive="$3" got
    local saved="$VIOLATIONS"
    VIOLATIONS=0
    check_archive "$archive" >/dev/null 2>&1
    got=$?
    VIOLATIONS="$saved"
    if [ "$got" -eq "$want" ]; then
      printf 'OK  self-test: %s (期待 %s / 実際 %s)\n' "$label" "$want" "$got"
    else
      printf 'NG  self-test: %s (期待 %s / 実際 %s)\n' "$label" "$want" "$got"
      failures=$((failures + 1))
    fi
  }

  # 対照に使う名前は**正本(release-targets.sh)から引く**。ここへ写すと改名のたびに
  # ずれる(E-76)。★M38-03 で macOS のアーカイブ名を darwin へ寄せたとき、ここに
  # 写してあった旧名が陰性対照 B を赤にした。⇒ 形式(zip / targz)ごとに先頭の定義を使う。
  _first_target_field() {  # <形式> <列番号: 1=アーカイブ名 2=中の実行ファイル名>
    local kind="$1" col="$2" entry
    for entry in "${RELEASE_TARGETS[@]}"; do
      if [ "$(printf '%s' "$entry" | awk -F' :: ' '{print $3}')" = "$kind" ]; then
        printf '%s' "$entry" | awk -F' :: ' -v c="$col" '{print $c}'
        return 0
      fi
    done
    return 1
  }
  local wz wb mt mb
  wz="$(_first_target_field zip 1)"   && wb="$(_first_target_field zip 2)"   || { echo "ERROR: zip の定義が正本に無い" >&2; return 2; }
  mt="$(_first_target_field targz 1)" && mb="$(_first_target_field targz 2)" || { echo "ERROR: targz の定義が正本に無い" >&2; return 2; }

  # --- 陰性対照 A: 完全な zip は緑 --------------------------------------------
  _stage "$WORKDIR/a" "$wb"; _pack_zip "$WORKDIR/a" "$WORKDIR/$wz"
  _expect "陰性対照 A = 完全な zip($wz)" 0 "$WORKDIR/$wz"

  # --- 陰性対照 B: 完全な tar.gz は緑 -----------------------------------------
  _stage "$WORKDIR/b" "$mb"; _pack_targz "$WORKDIR/b" "$WORKDIR/$mt"
  _expect "陰性対照 B = 完全な tar.gz($mt。中は $mb)" 0 "$WORKDIR/$mt"

  # --- 陰性対照 C: manual/ に余分が在っても緑(★P-1 の証明) ---------------------
  _stage "$WORKDIR/c" "$wb"
  printf '<html>quickstart</html>\n' > "$WORKDIR/c/manual/tacpendium-quickstart.html"
  printf 'x\n' > "$WORKDIR/c/manual/images/ch01-home-1.png"
  rm -f "$WORKDIR/extra-$wz"; _pack_zip "$WORKDIR/c" "$WORKDIR/extra-$wz"
  mv "$WORKDIR/extra-$wz" "$WORKDIR/c.zip"; mkdir -p "$WORKDIR/cdir"
  mv "$WORKDIR/c.zip" "$WORKDIR/cdir/$wz"
  _expect "陰性対照 C = manual/ に余分 2 本(★件数で固定していない証拠)" 0 "$WORKDIR/cdir/$wz"

  # --- 陽性対照 1〜4: あるべきものを 1 つ抜くと赤 ------------------------------
  local d
  for d in exe readme manualbody manualimages; do
    rm -rf "$WORKDIR/p-$d" "$WORKDIR/pdir-$d"; mkdir -p "$WORKDIR/pdir-$d"
    _stage "$WORKDIR/p-$d" "$wb"
    case "$d" in
      exe)          rm -f  "$WORKDIR/p-$d/$wb" ;;
      readme)       rm -f  "$WORKDIR/p-$d/$RELEASE_README" ;;
      manualbody)   rm -f  "$WORKDIR/p-$d/manual/tacpendium-readme.html" ;;
      manualimages) rm -rf "$WORKDIR/p-$d/manual/images" ;;
    esac
    _pack_zip "$WORKDIR/p-$d" "$WORKDIR/pdir-$d/$wz"
    _expect "陽性対照 = $d を抜いた zip" 1 "$WORKDIR/pdir-$d/$wz"
  done

  # --- 陽性対照 5: 追加同梱物を 1 本抜くと赤(★配列が空でないときだけ意味を持つ) ---
  #   ★「選べる形」を作っただけで終えないための対照である ——
  #     同梱すると決めて配列へ足しても、検査が見ていなければ cp の失敗が緑をすり抜ける。
  if [ "${#RELEASE_EXTRA_FILES[@]}" -gt 0 ]; then
    local victim="${RELEASE_EXTRA_FILES[0]}"
    rm -rf "$WORKDIR/p-extra" "$WORKDIR/pdir-extra"; mkdir -p "$WORKDIR/pdir-extra"
    _stage "$WORKDIR/p-extra" "$wb"
    rm -f "$WORKDIR/p-extra/$victim"
    _pack_zip "$WORKDIR/p-extra" "$WORKDIR/pdir-extra/$wz"
    _expect "陽性対照 = 追加同梱物 $victim を抜いた zip" 1 "$WORKDIR/pdir-extra/$wz"
  else
    printf 'OK  self-test: 追加同梱物の対照は省略(RELEASE_EXTRA_FILES が空)\n'
  fi

  # --- 陰性対照 E: `.gitkeep` すら無い真に空の images/ でも緑(★3b が .gitkeep に依存しない) ---
  rm -rf "$WORKDIR/e" "$WORKDIR/edir"; mkdir -p "$WORKDIR/edir"
  _stage "$WORKDIR/e" "$wb"
  rm -f "$WORKDIR/e/manual/images/.gitkeep"      # ディレクトリは残し、中身を 0 件にする
  _pack_zip "$WORKDIR/e" "$WORKDIR/edir/$wz"
  _expect "陰性対照 E = 真に空の images/(★.gitkeep に依存していない証拠)" 0 "$WORKDIR/edir/$wz"

  # --- 陽性対照 5: 中身は揃っているが SHA-256 が合わない ------------------------
  rm -rf "$WORKDIR/pdir-sum"; mkdir -p "$WORKDIR/pdir-sum"
  _stage "$WORKDIR/p-sum" "$wb"; _pack_zip "$WORKDIR/p-sum" "$WORKDIR/pdir-sum/$wz"
  ( cd "$WORKDIR/pdir-sum" && sha256sum "$wz" > "$wz.sha256" )
  printf 'tamper\n' >> "$WORKDIR/pdir-sum/$wz"   # 生成後に改変する
  _expect "陽性対照 = チェックサム不一致" 1 "$WORKDIR/pdir-sum/$wz"

  # --- 陰性対照 D: 改変前ならチェックサムは通る -------------------------------
  rm -rf "$WORKDIR/ndir-sum"; mkdir -p "$WORKDIR/ndir-sum"
  _stage "$WORKDIR/n-sum" "$wb"; _pack_zip "$WORKDIR/n-sum" "$WORKDIR/ndir-sum/$wz"
  ( cd "$WORKDIR/ndir-sum" && sha256sum "$wz" > "$wz.sha256" )
  _expect "陰性対照 D = チェックサム一致" 0 "$WORKDIR/ndir-sum/$wz"

  echo
  if [ "$failures" -eq 0 ]; then
    # ★文言 "自己検査: 合格" は check-artifact-integrity.sh が拾うマーカーである。変えないこと。
    #   ⇒ 同検査は scripts/check-*.sh が --self-test を持ち、それが通ることを機械強制する。
    #     本スクリプトの破壊確認(指示書 §5-3)は、これで一過性のデモではなく常設になる。
    echo "自己検査: 合格(陽性は赤・陰性は緑。陰性 5 / 陽性 6)"
    return 0
  fi
  echo "自己検査: 不合格 — $failures 件の対照が期待と違いました"
  return 1
}

# ---------------------------------------------------------------------------
main() {
  case "${1:-}" in
    --self-test) self_test; exit $? ;;
    -h|--help)   sed -n '1,35p' "$0"; exit 0 ;;
  esac

  need_cmd unzip; need_cmd zipinfo; need_cmd tar; need_cmd sha256sum

  local archives=()
  if [ -n "${1:-}" ]; then
    archives=("$1")
  else
    local entry name
    for entry in "${RELEASE_TARGETS[@]}"; do
      name="$(printf '%s' "$entry" | awk -F' :: ' '{print $1}')"
      archives+=("$RELEASE_OUT_DIR/$name")
    done
    if [ ! -d "$RELEASE_OUT_DIR" ]; then
      echo "ERROR: $RELEASE_OUT_DIR が在りません。先に 'make release-archives' を実行してください" >&2
      exit 2
    fi
  fi

  local a
  for a in "${archives[@]}"; do
    check_archive "$a"
  done

  echo
  if [ "$VIOLATIONS" -eq 0 ]; then
    echo "違反なし(検査したアーカイブ: ${#archives[@]} 本)"
    exit 0
  fi
  echo "違反 $VIOLATIONS 件"
  exit 1
}

main "$@"

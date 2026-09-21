#!/usr/bin/env bash
# build-release-archives.sh — 配布アーカイブ(zip / tar.gz)と SHA-256 を組む
#
# 背景: DES-002 §11.2 は配布物の構成を定めるが、**それを組む仕組みは 1 つも存在しなかった**
#   (2026-09-12 開発者回答・D-851)。設計と as-built の乖離であり、公開の前に必ず要る。
#   本スクリプトがその最初の 1 本である(M36-01・射程 1 + 2)。
#
# ★構成の正本は scripts/release-targets.sh である。**本ファイルへ名前を書き足さないこと**
#   —— 検査(check-release-archive.sh)と 2 か所に持つと必ずドリフトする(E-76)。
#
# ★★nightly の artifact を配布物へ格上げするものではない(CHANGE-129)。契機が違う
#   (nightly = 定時 / リリース = タグ)。**本スクリプトは .github/ を 1 バイトも触らない。**
#   CI からリリースを打つのは M36-02 の射程である。
#
# 使い方:
#   make release-archives                        # ★推奨。クロスビルドから通しで行う
#   bash scripts/build-release-archives.sh       # dist/ の既存バイナリから組む
#
#   ★M36-02 が CI から呼ぶため、引数なしの 1 コマンドで完結する形にしてある。
#
# 終了コード: 0=成功 / 1=検査で違反 / 2=前提不足・実行エラー
#
# 限界:
#   - **成果物の来歴は保証しない。** SHA-256 が示すのは「壊れていないこと」だけであり、
#     「このバイナリがこのコミットから作られたこと」ではない(= artifact attestation。M36-02)。
#   - tar 側は決定論に寄せてあるが(--sort / --mtime / gzip -n)、**バイト単位の再現性は
#     主張しない。** zip は Info-ZIP の格納順・属性に依存が残る。
#   - **GNU coreutils / GNU tar / Info-ZIP を前提にする**(`stat -c %s` ／ `sha256sum` ／
#     `tar --sort`)。⇒ devContainer と CI の Linux ランナーが想定であり、macOS の
#     BSD 系ツールでは動かない。★不足時は need_cmd が exit 2 で止まるため黙って壊れはしない。
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "ERROR: git リポジトリ内で実行してください" >&2
  exit 2
}
cd "$ROOT"

# shellcheck source=scripts/release-targets.sh
. scripts/release-targets.sh

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || { echo "ERROR: '$1' コマンドが見つかりません" >&2; exit 2; }
}
need_cmd zip; need_cmd tar; need_cmd gzip; need_cmd sha256sum

# ---------------------------------------------------------------------------
# 段 0: 前提の確認
# ---------------------------------------------------------------------------
missing=0
for entry in "${RELEASE_TARGETS[@]}"; do
  src="$(printf '%s' "$entry" | awk -F' :: ' '{print $4}')"
  if [ ! -f "$src" ]; then
    echo "ERROR: ビルド成果物が在りません: $src" >&2
    missing=1
  fi
done
if [ "$missing" -ne 0 ]; then
  echo "       先に 'make build-all' を実行してください(3 OS ぶんのクロスビルド)。" >&2
  exit 2
fi

# ★README.txt は生成物である(CHANGE-191)。正本 docs/usermanual/dist-readme.txt との
#   ずれを抱えたまま同梱すると、**配布物だけが古い文面を持つ**ことになる。
#   ⇒ 組む前に照合する。ここで止めれば、ドリフトしたものは 1 度も配布物へ入らない。
if ! bash scripts/check-dist-readme.sh >/dev/null 2>&1; then
  echo "ERROR: README.txt が正本(docs/usermanual/dist-readme.txt)とずれています。" >&2
  echo "       'bash scripts/check-dist-readme.sh' で差分を確認し、" >&2
  echo "       正本を直したうえで 'bash scripts/check-dist-readme.sh --write' を実行してください。" >&2
  echo "       ★直すのは正本であって README.txt ではありません。" >&2
  exit 2
fi

[ -f "$RELEASE_README" ]                      || { echo "ERROR: $RELEASE_README が在りません" >&2; exit 2; }
[ -d "$RELEASE_MANUAL_SRC" ]                  || { echo "ERROR: $RELEASE_MANUAL_SRC が在りません" >&2; exit 2; }
[ -s "$RELEASE_MANUAL_SRC/tacpendium-readme.html" ] \
  || { echo "ERROR: 操作説明書の本文が在りません(空の manual/ を同梱しても意味がありません)" >&2; exit 2; }
# ★images/ は**ディレクトリが在れば足りる**(版ゲート 3b)。画像の枚数は見ない ——
#   撮影は開発者の手番であり、本サブの後である。
[ -d "$RELEASE_MANUAL_SRC/images" ]           || { echo "ERROR: $RELEASE_MANUAL_SRC/images/ が在りません" >&2; exit 2; }

# ---------------------------------------------------------------------------
# 段 1: 出力先を作り直す
#   ★出力先は 1 か所に決め、.gitignore の `/dist/` でカバーする(成果物をコミットしない)。
# ---------------------------------------------------------------------------
# ★rm -rf の対象になるため、出力先が想定の下に在ることを確かめてから消す。
case "$RELEASE_OUT_DIR" in
  dist/*) : ;;
  *) echo "ERROR: 出力先が dist/ の下にありません: $RELEASE_OUT_DIR" >&2; exit 2 ;;
esac

STAGE_ROOT="$RELEASE_OUT_DIR/.stage"
rm -rf "$RELEASE_OUT_DIR"
mkdir -p "$RELEASE_OUT_DIR" "$STAGE_ROOT"

echo "配布アーカイブを組みます → $RELEASE_OUT_DIR/"
echo

# ---------------------------------------------------------------------------
# 段 2: 3 OS ぶんをステージングして組む
# ---------------------------------------------------------------------------
for entry in "${RELEASE_TARGETS[@]}"; do
  name="$(printf '%s'   "$entry" | awk -F' :: ' '{print $1}')"
  binary="$(printf '%s' "$entry" | awk -F' :: ' '{print $2}')"
  kind="$(printf '%s'   "$entry" | awk -F' :: ' '{print $3}')"
  src="$(printf '%s'    "$entry" | awk -F' :: ' '{print $4}')"

  stage="$STAGE_ROOT/$name"
  rm -rf "$stage"; mkdir -p "$stage"

  # (a) 実行ファイル。★名前は Makefile の出力のまま(D-887。★アーカイブ名も M38-03 で
  #     darwin 側へ寄せたため、3 つとも GOOS 名で揃っている＝D-893)。
  cp -p "$src" "$stage/$binary"
  chmod +x "$stage/$binary"

  # (b) README.txt(生成物)。
  cp -p "$RELEASE_README" "$stage/$RELEASE_README"

  # (c) 操作説明書。★**ディレクトリごと**入れる。ファイルを 1 つずつ列挙しない(D-886)。
  #     ⇒ M32-03 がクイックスタートを足しても、ここを直さずに同梱される。
  cp -R "$RELEASE_MANUAL_SRC/." "$stage/$RELEASE_MANUAL_DEST/"
  #     ★正本(dist-readme.txt)だけは落とす —— 説明書の中身ではなく README.txt の生成元であり、
  #       生成物のほうを (b) で入れているため二重になる。
  for ex in "${RELEASE_MANUAL_EXCLUDE[@]}"; do
    rm -f "$stage/$RELEASE_MANUAL_DEST/$ex"
  done

  # (d) 追加同梱物(ライセンス関係。release-targets.sh の RELEASE_EXTRA_FILES が正本)。
  #
  #     ★★★リポジトリ相対パスを**そのまま保つ**。⇒ basename で平坦化しない。
  #       理由は NOTICE:4-6 の逐語である ——「ライセンス本文は LICENSE … と
  #       **LICENSES/ 配下**、パス単位の割当は REUSE.toml を参照すること」。
  #       ⇒ 平坦化すると LICENSES/MIT.txt が MIT.txt として直下に落ち、
  #         同梱した NOTICE の参照先がアーカイブ内に存在しなくなる。
  #       ★2026-09-16 開発者判断で「全 7 件・パス保持」と決まった(それ以前は既定で空)。
  for extra in ${RELEASE_EXTRA_FILES[@]+"${RELEASE_EXTRA_FILES[@]}"}; do
    # ★リポジトリ内のファイルを指す前提である。外へ出る指定は事故なので止める。
    case "$extra" in
      /*|*..*) echo "ERROR: RELEASE_EXTRA_FILES は repo 相対パスで指定してください: $extra" >&2; exit 2 ;;
    esac
    [ -f "$extra" ] || { echo "ERROR: RELEASE_EXTRA_FILES に在らないパス: $extra" >&2; exit 2; }

    extra_dest="$stage/$extra"
    # ★パスを保つので basename の衝突は起きない。⇒ 残っている衝突は
    #   「同じパスを配列へ 2 回書いた」場合だけであり、それは指定の誤りである。
    if [ -e "$extra_dest" ]; then
      echo "ERROR: 追加同梱物のパスが重複しています: $extra" >&2
      echo "       ⇒ RELEASE_EXTRA_FILES に同じパスが 2 回書かれていないか見てください。" >&2
      exit 2
    fi
    mkdir -p "$(dirname "$extra_dest")"
    cp -p "$extra" "$extra_dest"
  done

  out="$RELEASE_OUT_DIR/$name"
  case "$kind" in
    zip)
      # -X: uid/gid 等の追加属性を落として環境差を減らす(generate-template-zip.sh と同じ流儀)。
      ( cd "$stage" && zip -X -q -r "$ROOT/$out" . )
      ;;
    targz)
      # 決定論に寄せる: 名前順・所有者を固定・mtime を固定し、gzip はヘッダに時刻を書かない。
      tar --sort=name --owner=0 --group=0 --numeric-owner --mtime="@0" \
          -C "$stage" -cf - . | gzip -n -9 > "$out"
      ;;
    *)
      echo "ERROR: 未知の形式: $kind" >&2; exit 2 ;;
  esac

  # (e) SHA-256。★basename で書く —— そのディレクトリで `sha256sum -c` がそのまま通る形。
  ( cd "$RELEASE_OUT_DIR" && sha256sum "$name" > "$name.sha256" )

  printf '  %-32s %8s バイト\n' "$name" "$(stat -c %s "$out")"
done

rm -rf "$STAGE_ROOT"

echo
echo "SHA-256:"
sed 's/^/  /' "$RELEASE_OUT_DIR"/*.sha256

# ---------------------------------------------------------------------------
# 段 3: 組んだものを必ず検査する
#   ★★「組めた」と「中身が正しい」は別である(指示書 §4.1)。
#     ⇒ 組み立ての最後に検査を呼ぶことで、「組めた」が常に「中身を検査した」を含む形にする。
# ---------------------------------------------------------------------------
echo
echo "--- 中身の検査 ---"
bash scripts/check-release-archive.sh

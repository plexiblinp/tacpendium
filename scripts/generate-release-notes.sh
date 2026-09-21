#!/usr/bin/env bash
# generate-release-notes.sh — リリースページ本文を組む(M36-02・射程 6)
#
# 背景: followup `sha256-verify-steps-unreadable-at-verify-time` ——
#   SHA-256 の検証手順は README.txt に在るが、**その README.txt はアーカイブの*中*に
#   ある。** ⇒ ダウンロード直後に照合したい利用者は、まだ展開していない。
#   ⇒ 同じ手順が**リリースページ側にも**要る。
#
# ★★★正本を 1 つに保つ(E-76)。**手で 2 か所に書かない。**
#   - SHA-256 の手順 → **docs/usermanual/dist-readme.txt から*抽出*する。写さない。**
#   - アーカイブ名   → **scripts/release-targets.sh から引く。写さない。**
#   - attestation の手順 → **本スクリプトが唯一の源泉**(README.txt 側には無いため)。
#
# ★docs/usermanual/ は 1 バイトも編集しない(指示書 §3-8。M38-03 の成果である)。
#   ⇒ 読み取りのみ。
#
# ★★抽出が空振りしたら**黙って短い本文を出さず exit 2 で止まる。**
#   ⇒ 見出しが変わったとき、検証手順の無いリリースページが出るのが最悪である。
#
# 使い方:
#   bash scripts/generate-release-notes.sh <タグ>      # 本文を標準出力へ
#   bash scripts/generate-release-notes.sh --self-test # 陽性対照・陰性対照
#
#   リポジトリ名は環境変数 GITHUB_REPOSITORY(CI が自動で入れる)を使う。
#   手元で試すときは origin の URL から引く。
#
# 終了コード: 0=成功 / 1=内容の不足 / 2=実行エラー・抽出失敗
#
# 限界:
#   - **手順が実際に通るかは見ない。** 文面を組むだけである。
#     ⇒ attestation の検証が通ったことは、実際に `gh attestation verify` を
#       走らせた出力でしか示せない(指示書 §4.1)。
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "ERROR: git リポジトリ内で実行してください" >&2
  exit 2
}
cd "$ROOT"

# shellcheck source=scripts/release-targets.sh
. scripts/release-targets.sh || { echo "ERROR: scripts/release-targets.sh を読めません" >&2; exit 2; }

SRC="docs/usermanual/dist-readme.txt"

# ★抽出の起点となる見出し。**正本の見出しと 1 文字でも違えば exit 2 で落ちる。**
SHA_SECTION_HEAD='■ ダウンロードしたファイルの破損確認(SHA-256)'

# ---------------------------------------------------------------------------
# extract_section <正本> <見出し> — 見出しの行から次の `■` の直前までを出す
#   ★見つからなければ**何も出さずに 1 を返す**(呼び出し側が exit 2 にする)。
#
#   ★★終端は `^■ `(空白つき)ではなく **`^■`** で見る(M36-02 レビュー 中-5)。
#     ⇒ 正本には **`■方法 A(推奨): …` / `■方法 B: …`**(★■ の直後に空白が無い)が
#       実在する(109 / 116 行)。空白を要求すると、そういう見出しで終端できず
#       **黙って文書末尾まで走る。** ★いまは当該見出しが SHA-256 の節より後ろに
#       在るため無害だが、節の順が変われば静かに壊れる。
# ---------------------------------------------------------------------------
extract_section() {
  local src="$1" head="$2" out
  [ -f "$src" ] || { echo "ERROR: 正本がありません: $src" >&2; return 2; }

  out="$(awk -v h="$head" '
    $0 == h { inside = 1 }
    inside && /^■/ && $0 != h { exit }
    inside { print }
  ' "$src")"

  [ -n "$out" ] || return 1
  printf '%s\n' "$out"
}

# ---------------------------------------------------------------------------
# repo_slug — owner/repo を返す
# ---------------------------------------------------------------------------
repo_slug() {
  if [ -n "${GITHUB_REPOSITORY:-}" ]; then
    printf '%s' "$GITHUB_REPOSITORY"
    return 0
  fi
  local url
  url="$(git config --get remote.origin.url 2>/dev/null)" || return 1
  [ -n "$url" ] || return 1
  printf '%s' "$url" | sed -e 's#^.*github\.com[:/]##' -e 's#\.git$##'
}

# ---------------------------------------------------------------------------
# generate <タグ> — リリース本文を標準出力へ
# ---------------------------------------------------------------------------
generate() {
  local tag="${1:-}" slug sha_section entry name rc

  slug="$(repo_slug)" || { echo "ERROR: リポジトリ名を特定できません(GITHUB_REPOSITORY も origin も無い)" >&2; return 2; }
  [ -n "$slug" ] || { echo "ERROR: リポジトリ名が空です" >&2; return 2; }

  sha_section="$(extract_section "$SRC" "$SHA_SECTION_HEAD")"
  rc=$?
  if [ "$rc" -ne 0 ]; then
    echo "ERROR: 正本から SHA-256 の節を抽出できませんでした: $SRC" >&2
    echo "       探した見出し: $SHA_SECTION_HEAD" >&2
    echo "       ★正本の見出しが変わったのなら、本スクリプトの SHA_SECTION_HEAD も直すこと。" >&2
    echo "       ★検証手順の無いリリースページを出さないため、ここで止めます。" >&2
    return 2
  fi

  # ★★抽出した節に**アーカイブ名が全数現れる**ことを確かめる。
  #   ⇒ 節は取れたが中身が別物、という状態を通さない。
  local missing=0
  for entry in "${RELEASE_TARGETS[@]}"; do
    name="$(printf '%s' "$entry" | awk -F' :: ' '{print $1}')"
    printf '%s\n' "$sha_section" | grep -qF -- "$name" || {
      echo "ERROR: 抽出した SHA-256 の節にアーカイブ名が現れません: $name" >&2
      missing=1
    }
  done
  [ "$missing" -eq 0 ] || {
    echo "       ★正本 $SRC の案内が構成の正本(scripts/release-targets.sh)と食い違っています。" >&2
    echo "       ⇒ bash scripts/check-dist-readme.sh で差分を確認してください。" >&2
    return 1
  }

  # -------------------------------------------------------------------------
  cat <<MD
## 配布物

| OS | アーカイブ | 位置づけ |
|---|---|---|
MD
  for entry in "${RELEASE_TARGETS[@]}"; do
    name="$(printf '%s' "$entry" | awk -F' :: ' '{print $1}')"
    case "$name" in
      *windows*) printf '| Windows | `%s` | 公式サポート |\n' "$name" ;;
      *darwin*)  printf '| macOS (Apple Silicon) | `%s` | 非公式・動作保証なし |\n' "$name" ;;
      *linux*)   printf '| Linux | `%s` | 非公式・動作保証なし |\n' "$name" ;;
      *)         printf '| — | `%s` | — |\n' "$name" ;;
    esac
  done

  cat <<MD

各アーカイブの隣に \`.sha256\` を置いています。展開すると \`README.txt\` と操作説明書 (\`manual/\`) が入っています。

---

## 1. 壊れていないことの確認 (SHA-256)

> 同じ手順はアーカイブ内の \`README.txt\` にも入っています。**ただし展開前に照合したい場合はこちらを使ってください。**

\`\`\`text
$sha_section
\`\`\`

---

## 2. 出どころの確認 (ビルド来歴 / artifact attestation)

SHA-256 が示すのは「**ファイルが壊れていないこと**」だけで、「**そのファイルが正しい出どころから来たこと**」は示しません。
こちらは配布物が **このリポジトリのこのコミット から GitHub Actions 上で作られたこと** を確認します。

[GitHub CLI](https://cli.github.com/) が要ります。

\`\`\`bash
gh attestation verify <ダウンロードしたアーカイブ> --repo $slug
\`\`\`

例:

\`\`\`bash
MD
  for entry in "${RELEASE_TARGETS[@]}"; do
    name="$(printf '%s' "$entry" | awk -F' :: ' '{print $1}')"
    printf 'gh attestation verify %s --repo %s\n' "$name" "$slug"
  done

  cat <<MD
\`\`\`

このリリースに添付した **SBOM**(\`.spdx.json\`)にも同じ来歴の署名が付いています。中身の部品表を確認したい場合に使ってください。

---

## このリリースが証明すること・しないこと

| | |
|---|---|
| ✅ ファイルが壊れていない | SHA-256 |
| ✅ このリポジトリのこのコミット から CI で作られた | attestation |
| ✅ 何が入っているか | SBOM |
| ❌ **コード署名 (Authenticode) は付いていません** | Windows で SmartScreen の警告が出ます。上の 2 つで出どころを確認してください |
MD

  if [ -n "$tag" ]; then
    printf '\n---\n\nタグ: `%s`\n' "$tag"
  fi
  return 0
}

# ---------------------------------------------------------------------------
self_test() {
  local failures=0 wd rc out
  wd="$(mktemp -d)" || { echo "ERROR: mktemp -d に失敗しました" >&2; return 2; }
  # shellcheck disable=SC2064
  trap "rm -rf '$wd'" RETURN

  # --- 陰性対照 A: 実際の正本から節が取れること ------------------------------
  out="$(extract_section "$SRC" "$SHA_SECTION_HEAD")"
  rc=$?
  if [ "$rc" -eq 0 ] && [ -n "$out" ]; then
    printf 'OK  self-test: 陰性対照 A = 正本から SHA-256 の節を抽出できた (%s 行)\n' "$(printf '%s\n' "$out" | wc -l)"
  else
    printf 'NG  self-test: 陰性対照 A = 節を抽出できなかった (rc=%s)\n' "$rc"
    failures=$((failures + 1))
  fi

  # --- 陰性対照 B: 抽出した節が次の節を巻き込んでいないこと -------------------
  if printf '%s\n' "$out" | grep -qF '■ 常駐と終了'; then
    printf 'NG  self-test: 陰性対照 B = 次の節まで巻き込んでいる\n'
    failures=$((failures + 1))
  else
    printf 'OK  self-test: 陰性対照 B = 次の節を巻き込んでいない\n'
  fi

  # --- 陰性対照 C: 抽出した節にアーカイブ名が全数在ること ---------------------
  local entry name c_missing=0
  for entry in "${RELEASE_TARGETS[@]}"; do
    name="$(printf '%s' "$entry" | awk -F' :: ' '{print $1}')"
    printf '%s\n' "$out" | grep -qF -- "$name" || c_missing=$((c_missing + 1))
  done
  if [ "$c_missing" -eq 0 ]; then
    printf 'OK  self-test: 陰性対照 C = 抽出した節にアーカイブ名が全数在る\n'
  else
    printf 'NG  self-test: 陰性対照 C = アーカイブ名が %s 件欠けている\n' "$c_missing"
    failures=$((failures + 1))
  fi

  # --- 陽性対照 1: 見出しが変わったら**黙って空を返さず**失敗すること ---------
  #   ★ここが本スクリプトで最も壊れやすい箇所である。
  cp "$SRC" "$wd/src.txt" || return 2
  awk -v h="$SHA_SECTION_HEAD" '{ if ($0 == h) print "■ 見出しを変えた(SELFTEST)"; else print }' \
    "$wd/src.txt" > "$wd/src.broken" && mv "$wd/src.broken" "$wd/src.txt"
  extract_section "$wd/src.txt" "$SHA_SECTION_HEAD" >/dev/null 2>&1
  rc=$?
  if [ "$rc" -eq 1 ]; then
    printf 'OK  self-test: 陽性対照 = 見出しを変えたら抽出失敗として返した (rc=1)\n'
  else
    printf 'NG  self-test: 陽性対照 = 見出しを変えたのに rc=%s で返した(黙って通る恐れ)\n' "$rc"
    failures=$((failures + 1))
  fi

  # --- 陽性対照 2: 正本が無ければ実行エラー(2)で返すこと ---------------------
  extract_section "$wd/does-not-exist.txt" "$SHA_SECTION_HEAD" >/dev/null 2>&1
  rc=$?
  if [ "$rc" -eq 2 ]; then
    printf 'OK  self-test: 陽性対照 = 正本が無ければ実行エラー(rc=2)\n'
  else
    printf 'NG  self-test: 陽性対照 = 正本が無いのに rc=%s\n' "$rc"
    failures=$((failures + 1))
  fi

  # --- 陰性対照 D: 本文の生成が通ること --------------------------------------
  if generate "v0.0.0-selftest" >/dev/null 2>&1; then
    printf 'OK  self-test: 陰性対照 D = 本文の生成が通った\n'
  else
    printf 'NG  self-test: 陰性対照 D = 本文の生成が失敗した\n'
    failures=$((failures + 1))
  fi

  if [ "$failures" -eq 0 ]; then
    # ★文言 "自己検査: 合格" は check-artifact-integrity.sh が拾うマーカーである。変えないこと。
    echo "自己検査: 合格(陽性は赤・陰性は緑。陰性 4 / 陽性 2)"
    return 0
  fi
  echo "自己検査: 不合格 — $failures 件の対照が期待と違いました"
  return 1
}

# ---------------------------------------------------------------------------
main() {
  case "${1:-}" in
    --self-test) self_test; exit $? ;;
    -h|--help)   sed -n '1,32p' "$0"; exit 0 ;;
  esac
  generate "${1:-}"
  exit $?
}

main "$@"

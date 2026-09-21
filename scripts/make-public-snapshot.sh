#!/usr/bin/env bash
# make-public-snapshot.sh — 公開スナップショットをローカルへ生成する(決定論)
#
# 背景:
#   ボード D-637(2026-09-02・開発者判断)。公開の形は一方向生成である——
#     公開リポ = f(開発リポの tag, 許可リスト)
#   タグを打つ → 展開 → 許可リスト適用 → 検査 → 公開リポへ 1 コミット。
#   ★公開リポは状態を持たないのでドリフトしない。⇒ 二重リポジトリ特有の同期問題が構造的に消える。
#
# ★★本スクリプトがやるのは「展開 → 許可リスト適用 → 検査」までである。
#   **公開リポジトリへ落とすことはしない。** リモートに触れる git 操作を一切行わない
#   (push / remote / fetch / clone のいずれも使わない)。実施はフェーズ5 冒頭
#   (M26-02 指示書 §0.1 / §4-1)。
#
# 使い方:
#   bash scripts/make-public-snapshot.sh [--ref <ref>] [--out <dir>] [--force]
#     --ref    既定 HEAD。リリース時は打ったタグを渡す
#     --out    既定 tmp/public-snapshot(.gitignore 済み)
#     --force  出力先が空でないときに中身を消してから作る
#
# 終了コード: 0=生成して検査も通った / 1=検査が赤 / 2=実行エラー
#
# 選別の向き(★重要):
#   選別は**許可リスト**で行う——`scripts/public-snapshot-manifest.txt` の ALLOW に当たり、
#   かつ DENY に当たらないものだけを残す。判定器は `check-public-snapshot.sh` の 1 本だけで
#   あり、本スクリプトはそれを呼ぶ(同じ規則が生成と検査の両方で使われる)。
#   生成後に `--verify-output` を回し、**生成物の側から**「許可されたものだけが在ること」と
#   「DENY に当たるものが 1 件も無いこと」を確かめる。
#   ★これが無いと、除外規則が 1 件も当たっていなくても検査は緑を返す(E-84)。

set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "ERROR: git リポジトリ内で実行してください" >&2
  exit 2
}
cd "$ROOT" || exit 2

REF="HEAD"
OUT="tmp/public-snapshot"
FORCE=0

while [ $# -gt 0 ]; do
  case "$1" in
    --ref)   REF="${2:-}"; shift 2 || exit 2 ;;
    --out)   OUT="${2:-}"; shift 2 || exit 2 ;;
    --force) FORCE=1; shift ;;
    *) echo "ERROR: 不明な引数: $1" >&2; exit 2 ;;
  esac
done

[ -n "$REF" ] && [ -n "$OUT" ] || { echo "ERROR: --ref / --out が空" >&2; exit 2; }
git rev-parse --verify --quiet "$REF^{commit}" >/dev/null || {
  echo "ERROR: 解決できない ref: $REF" >&2; exit 2; }
[ -f scripts/public-snapshot-manifest.txt ] || {
  echo "ERROR: scripts/public-snapshot-manifest.txt が無い" >&2; exit 2; }

# ★出力先の安全確認。作業ツリーそのものや追跡下のディレクトリを潰さない。
case "$OUT" in
  /|.|..|"$ROOT") echo "ERROR: 出力先が危険: $OUT" >&2; exit 2 ;;
esac
if git -c core.quotePath=false ls-files --error-unmatch "$OUT" >/dev/null 2>&1 \
   || [ -n "$(git -c core.quotePath=false ls-files -- "$OUT" 2>/dev/null)" ]; then
  echo "ERROR: 出力先が追跡下にある: $OUT (.gitignore 済みの場所を使ってください)" >&2
  exit 2
fi
if [ -d "$OUT" ] && [ -n "$(ls -A "$OUT" 2>/dev/null)" ]; then
  if [ "$FORCE" -ne 1 ]; then
    echo "ERROR: 出力先が空ではない: $OUT (--force で作り直せます)" >&2; exit 2
  fi
  rm -rf -- "${OUT:?}"/* "${OUT:?}"/.[!.]* 2>/dev/null
fi
mkdir -p "$OUT" || exit 2

echo "# 公開スナップショットの生成"
echo
echo "ref:  $REF ($(git rev-parse --short "$REF"))"
echo "out:  $OUT"
echo

# --- 1. tag の内容を展開する(★追跡ファイルだけが入る。未追跡・ignore 済みは入らない) ---
git archive --format=tar "$REF" | tar -x -C "$OUT" || {
  echo "ERROR: git archive の展開に失敗" >&2; exit 2; }
extracted="$(find "$OUT" \( -type f -o -type l \) | wc -l)"
echo "1. 展開: ${extracted} 件"

# --- 2. 許可リストを適用する(★ALLOW に当たり DENY に当たらないものだけを残す) ---
KEEP="$(mktemp)" || exit 2
HAVE="$(mktemp)" || exit 2
trap 'rm -f "$KEEP" "$HAVE"' EXIT

bash scripts/check-public-snapshot.sh --list "$OUT" | LC_ALL=C sort > "$KEEP" || {
  echo "ERROR: 公開集合の算出に失敗" >&2; exit 2; }
# ★シンボリックリンクも母数に入れる(レビュー 低-2)。検査側の dir_list と揃える。
( cd "$OUT" && find . \( -type f -o -type l \) -printf '%P\n' ) | LC_ALL=C sort > "$HAVE"

removed=0
while IFS= read -r rel; do
  [ -n "$rel" ] || continue
  rm -f -- "$OUT/$rel"
  removed=$((removed + 1))
done < <(LC_ALL=C comm -23 "$HAVE" "$KEEP")

find "$OUT" -mindepth 1 -type d -empty -delete
kept="$(find "$OUT" \( -type f -o -type l \) | wc -l)"
echo "2. 許可リスト適用: 残 ${kept} 件 / 落とした ${removed} 件"

# --- 3. ★生成物の側から検査する(除外規則が実際に効いたことを確かめる唯一の経路) ---
echo
bash scripts/check-public-snapshot.sh --verify-output "$OUT"
rc=$?
echo
if [ "$rc" -ne 0 ]; then
  echo "結果: ★生成物の検査が通らなかった。公開しないこと。"
  exit "$rc"
fi

echo "結果: 生成と検査を通過した。"
echo
echo "次にやること(★本スクリプトはここから先をやらない):"
echo "  - 生成物を目視で確かめる:  bash scripts/check-public-snapshot.sh --list-excluded"
echo "  - 秘匿情報の走査を回す(gitleaks 等。checklist A9 / M26-04)"
echo "  - 公開リポジトリへの反映は開発者の手番(CLAUDE.md §7。push は Claude Code が行わない)"
echo "  - 公開側のコミットメッセージの雛形: \"Release <public-version>\""
echo "    (非公開 combomgr の commit SHA は公開側の履歴へ書かず、対応関係は非公開側で保持する)"
exit 0

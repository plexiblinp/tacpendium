#!/usr/bin/env bash
# 設計担当(Web 版 Claude)へ「過去成果物の書式・粒度の手本」として渡すテンプレート集を
# 単一の zip(docs/instructions/templates/design-templates.zip)に固める。
#
# 背景: 本プロジェクトは Web 版=設計/指示書担当、Claude Code=実装担当。従来は過去の実物
#   ファイル(M{N}-overview 実物・直近指示書・review-checklist 等)を個別に設計チャットへ
#   アップロードしていたが、コンテキスト肥大と多数ファイルの一部未着リスクがあった。テンプレ集を
#   1 zip に集約して渡すことでこれを是正する。テンプレ本体は docs/instructions/templates/ に
#   commit し、zip は本スクリプトで都度生成する(zip 自体は .gitignore 済み)。
#
# 位置づけ(2026-07-20 直読切替後): Web 版は GitHub ナレッジで docs/instructions/templates/ を
#   ディレクトリごと直読するのが既定となり、本 zip は「手動添付フォールバック」(直読不能時・
#   PC 手動投入)専用の後方互換となった。通常運用では実行不要。
#
# 使い方: bash scripts/generate-template-zip.sh
#   出力先: docs/instructions/templates/design-templates.zip(上書き)。git 操作は行わない。
#   next_milestone_kit / next_phase_kit の Step 3-0e(添付フォールバック時のみ)でも本スクリプトを実行する。
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

SRC_DIR="docs/instructions/templates"
OUT="$SRC_DIR/design-templates.zip"

if ! command -v zip >/dev/null 2>&1; then
  echo "error: 'zip' コマンドが見つかりません(Info-ZIP を導入してください)。" >&2
  exit 1
fi

# 収録対象: 各種別テンプレ(*.template.md) + README.md。決定論のためソート順で固定列挙する。
mapfile -t FILES < <(cd "$SRC_DIR" && ls -1 *.template.md README.md 2>/dev/null | LC_ALL=C sort)

if [[ ${#FILES[@]} -eq 0 ]]; then
  echo "error: $SRC_DIR に収録対象(*.template.md / README.md)が見つかりません。" >&2
  exit 1
fi

# 既存 zip を消してから再生成(古いエントリの残留を防ぐ)。
rm -f "$OUT"

# -X: 追加ファイル属性(uid/gid 等)を除外して環境差を減らす。パスは templates/ 相対で格納。
( cd "$SRC_DIR" && zip -X -q "design-templates.zip" "${FILES[@]}" )

echo "生成: $OUT"
echo "収録 ${#FILES[@]} 件:"
for f in "${FILES[@]}"; do
  echo "  - $f"
done

#!/usr/bin/env bash
# check-enum-sync.sh — バックエンド列挙定数とフロント定数の同期検査(決定論・read-only)
#
# 背景: CLAUDE.md §4 は同期の欠落を 3 本の grep で確認せよと書いていたが、
#   記載パターン `model\.[A-Z]...` は 0 件ヒットで壊れていた(2026-08-10 実測)。
#   実際の定義は `internal/model/` の const ブロック内(`HitTypeNormal = "normal"`)と
#   単独 const 宣言(`const TagCategoryMyComboStatus = "mycombo_status"`)の 2 形式がある。
#   手順を散文で持たせると壊れても気づけないため、手順そのものを本スクリプトへ移した。
#
# 検査:
#   (1) バックエンド列挙定数の洗い出し(2 形式に対応)
#   (2) 各値が web/src/constants/ 配下に存在するか
#   (3) 各値が web/src/constants/ の外に生リテラルで散在していないか
#
# **既定は warning(exit 0)。** (3) は現時点で 26 件当たり、その多くは
#   `normal` / `system` / `throw` / `block` / `special` / `unique` のような汎用英単語による
#   誤検出である(CSS 値・i18n キー・無関係な比較)。誤検出率を測る前に blocking にはしない
#   (改善計画 Stage 4「当初 warning にする検査」)。
#   --strict はベースライン超過分だけを違反として扱う。
#
# 使い方:
#   bash scripts/check-enum-sync.sh            warning(常に exit 0)
#   bash scripts/check-enum-sync.sh --strict   ベースライン超過があれば exit 1
#   bash scripts/check-enum-sync.sh --list     列挙定数と対応状況の一覧
#   bash scripts/check-enum-sync.sh --self-test 陽性対照・陰性対照でこのスクリプト自身を検査
#
# 終了コード: 0=OK(既定は常に 0) / 1=--strict でベースライン超過 / 2=実行エラー
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "ERROR: git リポジトリ内で実行してください" >&2
  exit 2
}
cd "$ROOT"

MODEL_DIR="internal/model"
CONST_DIR="web/src/constants"
SRC_DIR="web/src"

# 2026-08-10 実測のベースライン。誤検出を含む既知件数であり、目標値ではない。
# 「新たに増えた分」を見えるようにするためだけに置く。減ったら本値を下げること。
#
# 2026-09-02 に 24 → 28 へ更新(M27-01)。理由＝hit_type へ 4 値を足したため。
#   drive_impact_wall_splat_hit / drive_impact_wall_splat_block /
#   drive_impact_punish_counter / stun の 4 値が各 1 ファイルで当たる。
#   当たり先はいずれも web/src/features/combo/labels.ts であり、これは
#   **エディタ専用のラベル表**である(同ファイル冒頭の逐語＝「本ファイルは
#   『エディタだけが読む』定義である…同じ値の呼び名を持つマップが 2 本ある状態」)。
#   ★既存 4 値もまったく同じ形で当たっている(counter=1 / punish_counter=2 /
#     just_parry_punish_counter=1)。⇒ 新しい同期漏れではなく、既知の 2 本立て構造が
#     値の数だけ増えたものである。
#   ★2 本のマップの統合は横断リファクタであり M27-01 の射程外(labels.ts が自ら明記)。
#
# ★★opponent_size は本検査に映らない。抽出パターン(下の extract_enums)は接尾辞が
#   Category|Status|Type|Code のものにしか一致せず、model.OpponentSize* を拾わない。
#   ⇒ 「本検査が緑」は相手サイズの同期の担保にならない。相手サイズの値域とキーの
#     対応は web/src/constants/label-keys.test.ts の KEY_MAPS が見ている(M27-01 で登録)。
BASELINE_SCATTER=28

STRICT=0
MODE="check"
case "${1:-}" in
  --strict)    STRICT=1 ;;
  --list)      MODE="list" ;;
  --self-test) MODE="self-test" ;;
  "")          ;;
  *) echo "ERROR: 不明な引数: $1" >&2; exit 2 ;;
esac

# ---------------------------------------------------------------------------
# (1) バックエンド列挙定数の抽出(const ブロック内 / 単独 const 宣言の 2 形式)
#     出力: "定数名<TAB>値"
# ---------------------------------------------------------------------------
extract_enums() {
  local dir="${1:-$MODEL_DIR}"
  grep -rhoE '(^|[[:space:]])(const[[:space:]]+)?[A-Z][A-Za-z0-9]*(Category|Status|Type|Code)[A-Za-z0-9]*[[:space:]]*=[[:space:]]*"[^"]+"' \
    "$dir"/*.go 2>/dev/null \
    | sed -E 's/^[[:space:]]*//; s/^const[[:space:]]+//' \
    | sed -E 's/[[:space:]]*=[[:space:]]*"/\t/; s/"$//' \
    | sort -u
}

# ---------------------------------------------------------------------------
# 自己検査(陽性対照・陰性対照)
#
# 検査するのは **抽出パターン** である。本スクリプトが生まれた原因が
# 「抽出パターンが実装と合わず 0 件ヒットで壊れていたのに気づけなかった」
# ことなので、そこに対照を置く。
# ---------------------------------------------------------------------------
self_test() {
  local tmp st_fail=0
  tmp="$(mktemp -d)" || { echo "ERROR: mktemp 失敗" >&2; exit 2; }
  # shellcheck disable=SC2064
  trap "rm -rf '$tmp'" EXIT

  mkdir -p "$tmp/model" "$tmp/empty"
  cat > "$tmp/model/enums.go" <<'EOF'
package model

const (
	HitTypeNormal = "normal"
	HitTypeCounter = "counter"
)

const TagCategoryMyComboStatus = "mycombo_status"

// 命名規則(Category|Status|Type|Code)に合わないため抽出されないべき
const SomeLabel = "should_not_match"

// 数値定数も抽出されないべき
const MaxTypeLimit = 10
EOF

  echo "## 自己検査(陽性対照・陰性対照)"
  echo

  local got
  got="$(extract_enums "$tmp/model")"

  # 陰性対照 A: const ブロック内の形式
  if printf '%s\n' "$got" | grep -q '^HitTypeNormal	normal$'; then
    echo "OK  陰性対照(const ブロック形式) → 抽出できる"
  else
    echo "NG  陰性対照(const ブロック形式)を抽出できなかった"; st_fail=1
  fi

  # 陰性対照 B: 単独 const 宣言の形式
  if printf '%s\n' "$got" | grep -q '^TagCategoryMyComboStatus	mycombo_status$'; then
    echo "OK  陰性対照(単独 const 宣言形式) → 抽出できる"
  else
    echo "NG  陰性対照(単独 const 宣言形式)を抽出できなかった"; st_fail=1
  fi

  # 陽性対照 C: 命名規則に合わないものは拾わない
  if printf '%s\n' "$got" | grep -q 'should_not_match'; then
    echo "NG  陽性対照(命名規則外)を誤って抽出した"; st_fail=1
  else
    echo "OK  陽性対照(命名規則外) → 抽出しない"
  fi

  # 陽性対照 D: 数値定数は拾わない
  if printf '%s\n' "$got" | grep -q '^MaxTypeLimit'; then
    echo "NG  陽性対照(数値定数)を誤って抽出した"; st_fail=1
  else
    echo "OK  陽性対照(数値定数) → 抽出しない"
  fi

  # 陽性対照 E: 抽出 0 件を検出できる(本スクリプトが壊れた実績のある状態)
  if [ -z "$(extract_enums "$tmp/empty")" ]; then
    echo "OK  陽性対照(抽出 0 件) → 空を返し、本体の ERROR 経路へ進む"
  else
    echo "NG  陽性対照(抽出 0 件)が空にならなかった"; st_fail=1
  fi

  echo
  if [ "$st_fail" -eq 0 ]; then
    echo "自己検査: 合格(陽性は赤・陰性は緑)"
    return 0
  fi
  echo "自己検査: 不合格"
  return 1
}

if [ "$MODE" = "self-test" ]; then
  self_test
  exit $?
fi

# フロント本番コード(constants/ と テストを除く)で生リテラルとして使われるファイル数
scatter_hits() {
  local v="$1"
  find "$SRC_DIR" -type f \( -name '*.ts' -o -name '*.tsx' \) \
    ! -name '*.test.ts' ! -name '*.test.tsx' ! -path "$CONST_DIR/*" \
    -exec grep -l "\"$v\"" {} + 2>/dev/null | wc -l
}

# constants/ 配下に値が存在するか
in_constants() {
  grep -rq "\"$1\"" "$CONST_DIR" 2>/dev/null && echo yes || echo no
}

if [ ! -d "$MODEL_DIR" ]; then
  echo "ERROR: $MODEL_DIR が無い" >&2; exit 2
fi

ENUMS="$(extract_enums)"
ENUM_COUNT=$(printf '%s\n' "$ENUMS" | grep -c . || true)

if [ "$ENUM_COUNT" -eq 0 ]; then
  echo "ERROR: 列挙定数を 1 件も抽出できなかった。抽出パターンが実装と合っていない可能性がある" >&2
  echo "       (この検査は 2026-08-10 に、まさにこの理由で壊れていた)" >&2
  exit 2
fi

if [ "$MODE" = "list" ]; then
  echo "# 列挙定数の同期状況"
  echo
  printf '%-38s %-28s %-10s %s\n' "定数名" "値" "constants/" "散在(ファイル数)"
  while IFS=$'\t' read -r name val; do
    [ -z "$name" ] && continue
    printf '%-38s %-28s %-10s %s\n' "$name" "$val" "$(in_constants "$val")" "$(scatter_hits "$val")"
  done <<< "$ENUMS"
  exit 0
fi

echo "# 列挙定数の同期検査"
echo
echo "対象: \`$MODEL_DIR\` → \`$CONST_DIR\` / commit \`$(git rev-parse --short HEAD 2>/dev/null || echo unknown)\`"
echo "列挙定数 $ENUM_COUNT 件"
echo

MISSING=0
SCATTER=0
SCATTER_LIST=""

while IFS=$'\t' read -r name val; do
  [ -z "$name" ] && continue
  if [ "$(in_constants "$val")" = "no" ]; then
    MISSING=$((MISSING + 1))
    printf 'INFO  %s = "%s" は %s に無い(バックエンド専用なら正常)\n' "$name" "$val" "$CONST_DIR"
  fi
done <<< "$ENUMS"

# (3) は「値」単位で数える。同じ値を複数の定数名が持つことがあるため
# (実測: `normal` は HitTypeNormal と MoveCategoryNormal の 2 つが持つ)、
# 定数単位で数えると同じリテラルを二重計上してしまう。
while IFS= read -r val; do
  [ -z "$val" ] && continue
  hits=$(scatter_hits "$val")
  if [ "$hits" -gt 0 ]; then
    SCATTER=$((SCATTER + 1))
    SCATTER_LIST="${SCATTER_LIST}      \"${val}\" (${hits} ファイル)"$'\n'
  fi
done <<< "$(printf '%s\n' "$ENUMS" | cut -f2 | sort -u)"

echo
echo "## (3) constants/ 外の生リテラル散在"
echo
printf 'WARN  %s 件(ベースライン %s 件)\n' "$SCATTER" "$BASELINE_SCATTER"
printf '%s' "$SCATTER_LIST"
echo
echo "注: 本検査は誤検出を含む。\`normal\` \`system\` \`throw\` \`block\` \`special\` \`unique\` 等の"
echo "    汎用英単語は、CSS 値・i18n キー・無関係な比較にも一致する。"
echo "    件数そのものではなく **ベースラインから増えたか** を見ること。"
echo

DELTA=$((SCATTER - BASELINE_SCATTER))
if [ "$DELTA" -gt 0 ]; then
  printf '結果: ベースラインから %s 件増加。新規に追加した列挙値が %s を経由していない可能性がある。\n' "$DELTA" "$CONST_DIR"
  [ "$STRICT" -eq 1 ] && exit 1
elif [ "$DELTA" -lt 0 ]; then
  printf '結果: ベースラインから %s 件減少。本スクリプトの BASELINE_SCATTER を %s へ更新してよい。\n' "$((-DELTA))" "$SCATTER"
else
  echo "結果: ベースラインどおり(増加なし)"
fi

exit 0

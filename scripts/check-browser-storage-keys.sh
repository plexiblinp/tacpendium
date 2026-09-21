#!/usr/bin/env bash
# check-browser-storage-keys.sh — ブラウザストレージ台帳と実装の突合(決定論・read-only)
#
# 背景: 許容キーの台帳は長らく CLAUDE.md §10.X の散文だった。読ませることに依存していたため、
#   2026-07-26 の実装実査(搬送段監査 H-4)で 4 キーが台帳に未記載のまま運用されていた。
#   2026-08-10 に台帳を web/CLAUDE.md §1 へ移し、本スクリプトで機械検査する形へ変えた。
#   Codex は web/CLAUDE.md を自動読込しないため、prose ではなく本検査がガードレールになる。
#
# 検査:
#   (a) 台帳に無いキーを本番コードが使っていないか  ← 規則本体
#   (a2) ヘルパ外からストレージ API を直接呼んでいないか  ← 突合の回避を防ぐ(2026-08-11 追加)
#   (b) 台帳「実装済」なのに本番コードに 0 ヒットでないか  ← 台帳の鮮度
#   (c) 台帳「未実装」なのに本番コードに出ていないか      ← 台帳の鮮度
#
# 使い方:
#   bash scripts/check-browser-storage-keys.sh
#   bash scripts/check-browser-storage-keys.sh --self-test
#   bash scripts/check-browser-storage-keys.sh --list      台帳と実装の対応を一覧表示
#
# 終了コード: 0=違反なし / 1=違反あり / 2=実行エラー
#
# 限界:
#   - **変数で組み立てたキーは検出できない**(リテラルのみ)。ただし **(a2) が
#     `localStorage` / `sessionStorage` / `indexedDB` の **識別子の出現そのもの** を見る
#     (2026-08-11 是正)ため、**ヘルパ外でストレージに触れば必ず赤になる**。
#     変数キーを使いたければヘルパ経由になり、少なくとも「どこで使われているか」は追える。
#   - **2026-08-11 まで、キーは `-v<数字>` 形式である前提だった**。そのため `myKey` /
#     `MY_KEY_V1` / `combomgr.foo.v1` のような**規約外の名前が素通りしていた**
#     (followup `browser-storage-key-naming-blindspot`)。**現在はヘルパ呼び出しの第 1 引数も見るため
#     命名規約に依存しない。** 実地検証済み——`createLocalStorageHelper<string>("myKey")` で赤になる。
#   - localStorage / sessionStorage のどちらを実際に使っているかまでは判定しない
#     (呼び出しヘルパの追跡が要るため。台帳の「ストレージ」列は人が維持する)。
#   - テストファイル(*.test.ts / *.test.tsx)は使い捨てキーを使うため対象外。
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "ERROR: git リポジトリ内で実行してください" >&2
  exit 2
}
cd "$ROOT"

LEDGER="web/CLAUDE.md"
SRC_DIR="web/src"
KEY_RE='[a-z0-9-]+-v[0-9]+'

VIOLATIONS=0
fail() { printf 'NG  %s\n' "$*"; VIOLATIONS=$((VIOLATIONS + 1)); }
ok()   { printf 'OK  %s\n' "$*"; }

# ---------------------------------------------------------------------------
# 台帳の抽出: "key<TAB>状態" を出力する。
#   §1 の表の行から、バックティックで囲われた -v<N> キーと、最終セル(状態)を採る。
#   ~~key~~ の取り消し線は剥がす(未実装キーの表記)。
# ---------------------------------------------------------------------------
read_ledger() {
  local f="${1:-$LEDGER}"
  awk -v keyre="$KEY_RE" '
    /^\|/ {
      line = $0
      # 最終セル(状態)を取る: 末尾の | を落としてから最後のフィールド
      sub(/\|[[:space:]]*$/, "", line)
      n = split(line, cells, "|")
      status = cells[n]
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", status)
      gsub(/\*/, "", status)
      # キーを取る: 最初のバックティック括りで keyre に合うもの
      if (match($0, "`~?~?" keyre "~?~?`")) {
        key = substr($0, RSTART, RLENGTH)
        gsub(/[`~]/, "", key)
        if (key != "" && status != "") print key "\t" status
      }
    }
  ' "$f"
}

# ---------------------------------------------------------------------------
# 本番コードのキー抽出(テストファイル除外)
#
# **2 経路の和集合を採る。**
#   (1) 命名規約による抽出($KEY_RE)     — 従来経路。後方互換のため残す
#   (2) ヘルパ呼び出しの第 1 引数        — **命名規約に依存しない**
#
# (2) を足した理由: (1) だけだと **規約外の名前のキーが素通りする**
#   (`myKey` / `MY_KEY_V1` / `combomgr.foo.v1` 等)。
#   `CLAUDE.md` §10.X の規則は「**何を保存するか**」(機密情報・DB 永続化対象データの禁止)に
#   ついてであって命名についてではないため、**規約外の名前で機密情報を保存しても検出されない**
#   という穴があった(2026-08-11 実証。followup `browser-storage-key-naming-blindspot`)。
#
#   ストレージへ触る経路が下記 3 種に限定されている(実測)ため、引数を見れば命名に依存せず拾える。
# ---------------------------------------------------------------------------
HELPER_RE='(createLocalStorageHelper|createSessionStorageHelper|useSessionStorage)'

read_prod_keys() {
  local dir="${1:-$SRC_DIR}"
  {
    # (1) 命名規約による抽出
    find "$dir" -type f \( -name '*.ts' -o -name '*.tsx' \) ! -name '*.test.ts' ! -name '*.test.tsx' \
      -exec grep -ohE "\"$KEY_RE\"" {} + 2>/dev/null | tr -d '"'
    # (2) ヘルパ呼び出しの第 1 引数(型引数 <T> は挟まれうる)。命名規約に依存しない
    find "$dir" -type f \( -name '*.ts' -o -name '*.tsx' \) ! -name '*.test.ts' ! -name '*.test.tsx' \
      -exec grep -ohE "$HELPER_RE(<[^>]*>)?\([\"'][^\"']+[\"']" {} + 2>/dev/null \
      | sed -E "s/.*\([\"']//; s/[\"']$//"
  } | sed '/^$/d' | sort -u
}

# ---------------------------------------------------------------------------
# ヘルパ外からの直接呼び出しの検出
#
# ストレージ API を直接叩いてよいのはヘルパの実装本体 1 本だけである。
# それ以外から直接呼ぶと、**キーが引数として現れず台帳の突合を回避できてしまう**。
# ---------------------------------------------------------------------------
DIRECT_ALLOW=(
  'web/src/lib/browser-storage.ts :: ヘルパの実装本体。`getStorage = () => localStorage` の形で識別子を参照する(メソッド呼び出しとは隣接しない)'
)
# ★2026-09-20(M40-02)に `web/src/hooks/useSessionStorage.ts` のエントリを外した。
#   同フックは `createSessionStorageHelper` 経由へ是正され、ストレージ API を直接呼ばなくなった
#   (台帳 §1 脚注「#7 の非整合」の解消)。⇒ ALLOW に残すと「直接呼んでよい箇所」という
#   **失効した記述**が居座る。★実装が戻ったときは、ここへ足すのではなくヘルパ経由へ直すこと。

is_direct_allowed() {
  local f="$1" e
  for e in "${DIRECT_ALLOW[@]}"; do
    [ "${e%% :: *}" = "$f" ] && return 0
  done
  return 1
}

# **識別子の出現そのもの**を見る(メソッド呼び出しとの字句隣接を要求しない)。
#
# ★2026-08-11 クリーンルームレビュー 高 2 の是正。旧実装は
#   `(localStorage|sessionStorage)\.(get|set|remove)Item` のように **隣接**を求めていたため、
#   1 段はさむだけで素通りした——`const s: Storage = localStorage; s.setItem(k, v)`。
#   **決定的だったのは、ヘルパ本体 `browser-storage.ts` 自身がその形**
#   (`getStorage().setItem(...)`、`getStorage = () => localStorage`)で、
#   **旧実装ではヒット 0 件＝ALLOW エントリが一度も働いていなかった**こと。
#
# **識別子が「式として使われている」形**で判定する。コメント中の言及は拾わない。
#   拾う: `localStorage.setItem` / `localStorage[k]` / `= localStorage` / `=> localStorage`
#         / `f(localStorage` / `: Storage = localStorage`
#   拾わない: `// localStorage から復元する` / `{/* localStorage に保存 */}`
#     (日本語のコメントでは識別子の直後に助詞が来るため、式の形とは区別できる)
#   ★コメントの除去(sed で `//` 以降を落とす)では **JSX の `{/* … */}` が残る**ため、
#     除去ではなく「式の形」で判定する。
STORAGE_ID='(localStorage|sessionStorage|indexedDB)'

find_direct_calls() {
  local dir="${1:-$SRC_DIR}"
  find "$dir" -type f \( -name '*.ts' -o -name '*.tsx' \) ! -name '*.test.ts' ! -name '*.test.tsx' \
    -exec grep -lE "${STORAGE_ID}[[:space:]]*[.[]|[=>(,:][[:space:]]*${STORAGE_ID}\b" {} + 2>/dev/null | sort -u
}

# ---------------------------------------------------------------------------
# 突合本体。戻り値: 違反があれば 1
# ---------------------------------------------------------------------------
compare() {
  local ledger_file="$1" src_dir="$2" quiet="${3:-}"
  local err=0
  local ledger prod key status hits

  ledger="$(read_ledger "$ledger_file")"
  prod="$(read_prod_keys "$src_dir")"

  if [ -z "$ledger" ]; then
    [ -z "$quiet" ] && fail "台帳からキーを 1 件も読めなかった: $ledger_file §1"
    return 1
  fi

  # (a) 台帳に無いキーの使用
  while IFS= read -r key; do
    [ -z "$key" ] && continue
    if ! printf '%s\n' "$ledger" | cut -f1 | grep -qx "$key"; then
      [ -z "$quiet" ] && fail "台帳に未記載のキーを本番コードが使用: \`$key\`"
      [ -z "$quiet" ] && printf '      → CHANGE 通知書(または addendum)経由で %s §1 の台帳へ追記すること\n' "$ledger_file"
      err=1
    fi
  done <<< "$prod"

  # (a2) ヘルパ外からの直接呼び出し
  #      キーが引数として現れないため、これを許すと台帳の突合を回避できてしまう
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    if ! is_direct_allowed "$f"; then
      [ -z "$quiet" ] && fail "ヘルパ外からストレージ API を直接呼んでいる: $f"
      [ -z "$quiet" ] && printf '      → web/src/lib/browser-storage.ts のヘルパ経由にすること(直接呼びはキーが台帳と突合されない)\n'
      err=1
    fi
  done <<< "$(find_direct_calls "$src_dir")"

  # (b)(c) 台帳の状態と実装の突合
  while IFS=$'\t' read -r key status; do
    [ -z "$key" ] && continue
    hits=$(printf '%s\n' "$prod" | grep -cx "$key" || true)
    case "$status" in
      実装済)
        if [ "$hits" -eq 0 ]; then
          [ -z "$quiet" ] && fail "台帳は「実装済」だが本番コードに 0 ヒット: \`$key\`(台帳が古い可能性)"
          err=1
        fi
        ;;
      未実装)
        if [ "$hits" -gt 0 ]; then
          [ -z "$quiet" ] && fail "台帳は「未実装」だが本番コードに出現: \`$key\`(台帳の更新漏れ)"
          err=1
        fi
        ;;
      *)
        [ -z "$quiet" ] && fail "台帳の状態列が「実装済」「未実装」以外: \`$key\` = \"$status\""
        err=1
        ;;
    esac
  done <<< "$ledger"

  return "$err"
}

# ---------------------------------------------------------------------------
# 自己検査
# ---------------------------------------------------------------------------
self_test() {
  local tmp st=0
  tmp="$(mktemp -d)" || { echo "ERROR: mktemp 失敗" >&2; exit 2; }
  # shellcheck disable=SC2064
  trap "rm -rf '$tmp'" EXIT

  mk_ledger() {
    cat > "$1" <<'EOF'
| # | キー名 | ストレージ | 用途 | 設計書根拠 | 実装 | 状態 |
|---|--------|-----------|------|-----------|------|------|
| 1 | `good-key-v1` | localStorage | 用途 | DES-005 §5.4 | M3-03 | 実装済 |
| 2 | ~~`never-built-v1`~~ | localStorage | 用途 | DES-005 §6.4.1 | ~~M7~~ | 未実装 |
EOF
  }

  mkdir -p "$tmp/neg/src" "$tmp/pos-unlisted/src" "$tmp/pos-stale/src" "$tmp/pos-ghost/src" \
           "$tmp/pos-offconv/src" "$tmp/pos-direct/src"

  # 陰性対照: 台帳どおり(実装済キーを使い、未実装キーは使わない)
  mk_ledger "$tmp/neg/CLAUDE.md"
  printf 'const K = "good-key-v1";\n' > "$tmp/neg/src/a.ts"
  printf 'const T = "throwaway-v1";\n' > "$tmp/neg/src/a.test.ts"   # テストは対象外

  # 陽性対照 A: 台帳に無いキーを使用
  mk_ledger "$tmp/pos-unlisted/CLAUDE.md"
  printf 'const K = "good-key-v1";\nconst U = "undocumented-v1";\n' > "$tmp/pos-unlisted/src/a.ts"

  # 陽性対照 B: 台帳「実装済」なのに 0 ヒット
  mk_ledger "$tmp/pos-stale/CLAUDE.md"
  printf 'const X = 1;\n' > "$tmp/pos-stale/src/a.ts"

  # 陽性対照 C: 台帳「未実装」なのに出現
  mk_ledger "$tmp/pos-ghost/CLAUDE.md"
  printf 'const K = "good-key-v1";\nconst G = "never-built-v1";\n' > "$tmp/pos-ghost/src/a.ts"

  # 陽性対照 D: **命名規約に沿わないキー**をヘルパへ渡している(旧実装の盲点)
  mk_ledger "$tmp/pos-offconv/CLAUDE.md"
  printf 'const K = "good-key-v1";\nconst H = createLocalStorageHelper<string>("myKey");\n' > "$tmp/pos-offconv/src/a.ts"

  # 陽性対照 E: **ヘルパ外からストレージ API を直接呼んでいる**(キーが引数に現れず突合を回避できる)
  mk_ledger "$tmp/pos-direct/CLAUDE.md"
  printf 'const K = "good-key-v1";\nlocalStorage.setItem(SOME_VAR, "x");\n' > "$tmp/pos-direct/src/a.ts"

  # 陽性対照 F: **間接参照**(2026-08-11 レビュー 高 2)。旧実装はこれを素通りさせた
  mkdir -p "$tmp/pos-indirect/src"
  mk_ledger "$tmp/pos-indirect/CLAUDE.md"
  printf 'const K = "good-key-v1";\nconst s: Storage = localStorage;\ns.setItem(V, "x");\n' > "$tmp/pos-indirect/src/a.ts"

  # 陰性対照 G: **コメント中の言及**は拾わない(行コメント / JSX ブロックコメント)
  mkdir -p "$tmp/neg-comment/src"
  mk_ledger "$tmp/neg-comment/CLAUDE.md"
  printf 'const K = "good-key-v1";\n// localStorage から初期復元する\nconst x = 1; /* localStorage に保存 */\n' > "$tmp/neg-comment/src/a.ts"

  echo "## 自己検査(陽性対照・陰性対照)"
  echo

  if compare "$tmp/neg/CLAUDE.md" "$tmp/neg/src" quiet; then
    ok "陰性対照(台帳どおり・テストキーは無視) → 緑"
  else
    printf 'NG  陰性対照が赤になった(誤検出)\n'; st=1
  fi

  if compare "$tmp/neg-comment/CLAUDE.md" "$tmp/neg-comment/src" quiet; then
    ok "陰性対照(コメント中の言及は拾わない) → 緑"
  else
    printf 'NG  陰性対照(コメント中の言及)が赤になった(誤検出)\n'; st=1
  fi

  local c
  for c in "pos-unlisted:台帳未記載キーの使用" \
           "pos-stale:実装済なのに 0 ヒット" \
           "pos-ghost:未実装なのに出現" \
           "pos-offconv:命名規約外のキーをヘルパへ渡す" \
           "pos-direct:ヘルパ外からの直接呼び出し" \
           "pos-indirect:間接参照(Storage 型の変数へ代入)"; do
    local d="${c%%:*}" desc="${c#*:}"
    if compare "$tmp/$d/CLAUDE.md" "$tmp/$d/src" quiet; then
      printf 'NG  陽性対照(%s)が緑になった(検出漏れ)\n' "$desc"; st=1
    else
      ok "陽性対照($desc) → 赤"
    fi
  done

  echo
  if [ "$st" -eq 0 ]; then echo "自己検査: 合格(陽性は赤・陰性は緑)"; return 0; fi
  echo "自己検査: 不合格"; return 1
}

# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------
case "${1:-}" in
  --self-test) self_test; exit $? ;;
  --list)
    echo "# 台帳と実装の対応"
    echo
    printf '%-34s %-8s %s\n' "キー" "状態" "本番ヒット"
    prod="$(read_prod_keys)"
    while IFS=$'\t' read -r key status; do
      [ -z "$key" ] && continue
      hits=$(printf '%s\n' "$prod" | grep -cx "$key" || true)
      printf '%-34s %-8s %s\n' "$key" "$status" "$hits"
    done <<< "$(read_ledger)"
    exit 0
    ;;
esac

echo "# ブラウザストレージ台帳の突合"
echo
echo "台帳: \`$LEDGER\` §1 / 対象: \`$SRC_DIR\`(テストファイル除く) / commit \`$(git rev-parse --short HEAD 2>/dev/null || echo unknown)\`"
echo

if [ ! -f "$LEDGER" ]; then
  fail "$LEDGER が存在しない(台帳の移設先)"
else
  ledger_count=$(read_ledger | wc -l)
  prod_count=$(read_prod_keys | wc -l)
  echo "台帳 $ledger_count 件 / 本番コード $prod_count 件"
  echo
  if compare "$LEDGER" "$SRC_DIR"; then
    ok "台帳と実装が一致(未記載キーの使用なし・状態のズレなし)"
  fi
fi

echo
if [ "$VIOLATIONS" -eq 0 ]; then
  echo "結果: 違反なし"
  exit 0
fi
echo "結果: 違反 $VIOLATIONS 件"
exit 1

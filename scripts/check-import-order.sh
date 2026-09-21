#!/usr/bin/env bash
# check-import-order.sh — フロントエンドの import 順の検査(決定論・read-only)
#
# 何を見るか:
#   `CLAUDE.md` §4 TypeScript が定める import の並び順
#     **React → サードパーティ → エイリアスパス(`@/`) → 相対パス**
#   から**後退している**箇所を数える。後退とは、より後ろの区分が現れたあとに
#   より前の区分が現れることを指す(例: 相対パスの後ろに `@/`)。
#
# なぜ要るか(実際に踏んだ):
#   本規約は 2026-09-01 まで**機械検査を 1 つも持たなかった**。
#   `web/package.json` の `lint` は `tsc --noEmit` だけであり、import の順序は
#   型検査の関心事ではない。
#   **`M24-08` が `queryKeys` の import を「最後の import 行の直後」へ自動挿入した結果、
#   27 ファイルが静かに規約外になった**。型検査もテストも E2E も何も言わず、
#   **レビューで人が読んで初めて分かった**(followup `import-order-unchecked`)。
#
# なぜ ESLint ではないか(2026-09-01・改善レーン 第 2 束の実測にもとづく開発者判断):
#   `CLAUDE.md` §4 / §10 のコード規約を全数実測したところ、ESLint の射程に入る規約のうち
#   **import 順以外の実違反は合計 1 件**だった
#     (any=1 / console.log 本番残置=0 / class コンポーネント=0 / eslint-disable=1 /
#      fmt.Println 本番残置=0 / nolint=0)。
#   **依存 4〜5 個(eslint / パーサ / plugin / plugin-import / import-resolver-typescript)を
#   増やす利得が無い**ため、既存の自作検査 10 本と同じ型で自作した。
#   ★この判断は「ESLint は要らない」ではない。**型情報が要るルール
#   (`react-hooks/exhaustive-deps` 等)が §4 / §10 へ入ったら再考する。**
#
# 使い方:
#   bash scripts/check-import-order.sh              # 既定の対象範囲を検査
#   bash scripts/check-import-order.sh --list       # 違反を全件表示(ベースライン更新時に使う)
#   bash scripts/check-import-order.sh --self-test  # 陽性対照・陰性対照でこのスクリプト自身を検査
#
# 終了コード: 0=ベースラインから増えていない / 1=増えた・自己検査に不合格 / 2=実行できなかった
#
# 対象範囲: `web/src/` 配下の `*.ts` / `*.tsx`。
#   **テストファイルも含める**——`CLAUDE.md` §4 は import 順にテストの例外を設けていない。
#   ★`web/e2e/` は対象外(`web/tsconfig.json` の `include` に入っておらず、
#     どの経路でも型検査されない別系統である＝`web/CLAUDE.md` §3)。
#
# 依存: python3 のみ(標準ライブラリ)。**未導入なら exit 2 で「未実行」を返す。**
#   緑を返さないのは、検査していないことを「問題なし」と同じ顔で出さないため(教訓 `E-84`)。
#
# ベースライン固定型:
#   既存の違反が多いため、**件数そのものではなく「ベースラインから増えたか」を見る**。
#   ★既存分を機械的に並べ替えない。副作用 import(`import "./x.css"`)の順序を動かすと
#     評価順が変わり、**静かに壊れうる**。書いた本人が触るときに直していく。
#   減ったら BASELINE を下げること。増える方向の更新はしない。
#
# 限界(重要・過信しないこと):
#   - **区分の後退しか見ない。** 区分内の並び(アルファベット順など)は `CLAUDE.md` §4 が
#     定めていないため見ない。**ブロック間の空行も見ない**(同じく規定が無い)。
#   - **`import` 文だけを見る。** `require()` / 動的 `import()` は対象外。
#   - `@/` 以外のエイリアスは想定していない(`web/tsconfig.json` の `paths` は `@/*` のみ)。
#   - **床であって証明ではない。** 順序が規約どおりでも、その import が要るかは見ていない。
#   - **★★違反を「ファイル単位」で数える。⇒ 既にベースラインに入っているファイルの中へ
#     新しい違反を足しても検出されない**(2026-09-01 クリーンルームレビュー B-3 で実証。
#     `App.test.tsx` へ注入しても 101 のまま緑)。**本検査の動機である `M24-08` 型の
#     一括挿入も、既存 101 ファイルへ及んだぶんは見えない。** 件数を違反数へ変えると
#     ベースラインの取り直しが要るため、現状は「新しく規約外になったファイル」を捕まえる床である。
#   - ブロックコメント内の `import` は数えない(B-1 で是正済み)。**行コメント `//` は未対応。**
#   - `import.meta` / `importFoo` は import 文の起点にしない(B-2 で是正済み)。
set -uo pipefail

# 実測のベースライン。**目標値ではなく既知の残存件数。**
#   2026-09-20 実測(M40-02): **98 ファイル**。内訳は **本番 14 / テスト 84**。
#   ★初出は 2026-09-01(改善レーン 第 2 束・commit 74506cc)の 545 ファイル中 101 ファイル
#     (本番 16 / テスト 85)。その後 101 → 99(`5133be3`) → 98(M40-02)と下がっている。
#   ★★この実測コメントは BASELINE を下げるたびに一緒に直すこと。**数字が 2 か所に在る。**
#     (M40-02 のレビュー 高-4＝BASELINE だけ下げてこのコメントを据え置いた結果、
#      同一ブロック内に矛盾する数字が並んだ状態が `5133be3` から持ち越されていた)
#   ★本定数は「作業ツリー全体の総数」である。**レーン(worktree / ブランチ)ごとに測って
#     下げてはならない**——並走レーンが足したぶんが見えず、マージした瞬間にずれる
#     (`check-md-emphasis.sh` が 2026-08-14 に実際に踏んだ型)。
BASELINE=98  # 2026-09-20(M40-02): useRecentCombos.test.ts の import 順を是正して 99 → 98

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "ERROR: git リポジトリ内で実行してください" >&2
  exit 2
}
cd "$ROOT"

command -v python3 >/dev/null 2>&1 || {
  echo "ERROR: python3 が見つからないため検査できませんでした(未実行。緑ではありません)" >&2
  exit 2
}

PY_CHECK='
import re, sys, os

IMPORT_START = re.compile(r"^import(?=[\s\"\x27{*])")  # ★`import.meta` / `importFoo` を起点にしない(B-2)
FROM_SPEC    = re.compile(r"\bfrom\s+[\"\x27]([^\"\x27]+)[\"\x27]")
BARE_SPEC    = re.compile(r"^import\s+[\"\x27]([^\"\x27]+)[\"\x27]")

NAMES = {0: "React", 1: "サードパーティ", 2: "@/ エイリアス", 3: "相対パス"}

def strip_block_comments(text):
    """ブロックコメントを、行数を保ったまま取り除く(B-1)。
    ★コメントアウトされた import を実在の import として数えないため。
      行数を保つのは、報告する行番号を実ファイルと一致させるためである。"""
    out, i, n, depth = [], 0, len(text), 0
    while i < n:
        if depth == 0 and text.startswith("/*", i):
            depth, i = 1, i + 2
        elif depth == 1 and text.startswith("*/", i):
            depth, i = 0, i + 2
        else:
            out.append(text[i] if (depth == 0 or text[i] == "\n") else " ")
            i += 1
    return "".join(out)

def statements(text):
    """(行番号, モジュール指定子) を出現順に返す。多行 import に対応する。"""
    lines = strip_block_comments(text).split("\n")
    out, i, n = [], 0, len(lines)
    while i < n:
        if not IMPORT_START.match(lines[i]):
            i += 1
            continue
        start, buf = i, lines[i]
        m = BARE_SPEC.match(buf) or FROM_SPEC.search(buf)
        while m is None and i + 1 < n:
            i += 1
            buf += "\n" + lines[i]
            m = FROM_SPEC.search(buf)
        if m:
            out.append((start + 1, m.group(1)))
        i += 1
    return out

def category(mod):
    if mod in ("react", "react-dom") or mod.startswith(("react/", "react-dom/")):
        return 0
    if mod.startswith("@/"):
        return 2
    if mod.startswith("."):
        return 3
    return 1

def violations(text):
    st = statements(text)
    return [(a, b) for a, b in zip(st, st[1:]) if category(a[1]) > category(b[1])]

want_list = "--list" in sys.argv[1:]
paths = [p for p in sys.argv[1:] if p != "--list"]

bad_prod = bad_test = 0
rows = []
for path in sorted(paths):
    try:
        text = open(path, encoding="utf-8").read()
    except OSError:
        continue
    v = violations(text)
    if not v:
        continue
    if ".test." in os.path.basename(path):
        bad_test += 1
    else:
        bad_prod += 1
    if want_list:
        for a, b in v:
            rows.append("  %s:%d  %s -> %s  (%s -> %s)"
                        % (path, b[0], NAMES[category(a[1])], NAMES[category(b[1])], a[1], b[1]))

if want_list:
    for r in rows:
        print(r)
    print("")
print("%d %d" % (bad_prod, bad_test))
'

collect_files() {
  # git 管理下のものだけを見る(生成物・node_modules を拾わないため)
  git ls-files -z -- 'web/src/**/*.ts' 'web/src/**/*.tsx' 'web/src/*.ts' 'web/src/*.tsx'
}

# ---------------------------------------------------------------------------
# 自己検査(陽性対照・陰性対照)
# ---------------------------------------------------------------------------
self_test() {
  local tmp st_fail=0
  tmp="$(mktemp -d)" || { echo "ERROR: mktemp 失敗" >&2; exit 2; }
  # shellcheck disable=SC2064
  trap "rm -rf '$tmp'" EXIT

  echo "## 自己検査(陽性対照・陰性対照)"
  echo

  # 判定 1 本ぶんを走らせて「本番違反数 テスト違反数」を返す
  count_of() { python3 -c "$PY_CHECK" "$@" | tail -1; }

  # --- 陰性対照: 規約どおりの並び ---
  cat > "$tmp/ok.tsx" <<'EOF'
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { helper } from "./helper";
EOF
  [ "$(count_of "$tmp/ok.tsx")" = "0 0" ] \
    && ok "陰性対照(規約どおりの並び) → 緑" \
    || { printf 'NG  陰性対照(規約どおり)が赤になった(誤検出)\n'; st_fail=1; }

  # --- 陽性対照 1: 相対パスの後ろに @/ ---
  cat > "$tmp/ng-alias-after-relative.tsx" <<'EOF'
import { useState } from "react";
import { helper } from "./helper";
import { cn } from "@/lib/utils";
EOF
  [ "$(count_of "$tmp/ng-alias-after-relative.tsx")" = "1 0" ] \
    && ok "陽性対照(相対パスの後ろに @/) → 赤" \
    || { printf 'NG  陽性対照(相対 → @/)が緑になった(検出漏れ)\n'; st_fail=1; }

  # --- 陽性対照 2: サードパーティの後ろに React(M24-08 と同型の後退) ---
  cat > "$tmp/ng-react-late.ts" <<'EOF'
import { render } from "@testing-library/react";
import { createElement } from "react";
EOF
  [ "$(count_of "$tmp/ng-react-late.ts")" = "1 0" ] \
    && ok "陽性対照(サードパーティの後ろに React) → 赤" \
    || { printf 'NG  陽性対照(3rd → React)が緑になった(検出漏れ)\n'; st_fail=1; }

  # --- 陽性対照 3: 多行 import をまたぐ後退 ---
  #   ★1 行 import しか読めない実装だと、この形は静かに素通りする。
  cat > "$tmp/ng-multiline.tsx" <<'EOF'
import { useState } from "react";
import {
  aaa,
  bbb,
} from "./local";
import { cn } from "@/lib/utils";
EOF
  [ "$(count_of "$tmp/ng-multiline.tsx")" = "1 0" ] \
    && ok "陽性対照(多行 import をまたぐ後退) → 赤" \
    || { printf 'NG  陽性対照(多行 import)が緑になった(検出漏れ)\n'; st_fail=1; }

  # --- 陰性対照 2: 副作用 import と type import を含む正しい並び ---
  cat > "$tmp/ok-sideeffect.tsx" <<'EOF'
import React from "react";
import "@tanstack/react-query";
import type { Foo } from "@/types/foo";
import "@/index.css";
import "./local.css";
EOF
  [ "$(count_of "$tmp/ok-sideeffect.tsx")" = "0 0" ] \
    && ok "陰性対照(副作用 import・type import を含む正しい並び) → 緑" \
    || { printf 'NG  陰性対照(副作用/type import)が赤になった(誤検出)\n'; st_fail=1; }

  # --- 本番 / テストの弁別 ---
  cp "$tmp/ng-alias-after-relative.tsx" "$tmp/thing.test.tsx"
  [ "$(count_of "$tmp/thing.test.tsx")" = "0 1" ] \
    && ok "テストファイルを本番と別に数える" \
    || { printf 'NG  テストファイルの弁別ができていない\n'; st_fail=1; }

  echo
  if [ "$st_fail" -eq 0 ]; then
    echo "自己検査: 合格(陽性は赤・陰性は緑)"
    return 0
  fi
  echo "自己検査: 不合格"
  return 1
}

ok() { printf 'OK  %s\n' "$*"; }

# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------
if [ "${1:-}" = "--self-test" ]; then
  self_test
  exit $?
fi

echo "# import 順チェック(CLAUDE.md §4: React → サードパーティ → @/ → 相対)"
echo
echo "対象 commit: \`$(git rev-parse --short HEAD 2>/dev/null || echo unknown)\`"
echo "対象範囲: \`web/src/\` 配下の *.ts / *.tsx(テストを含む)"
echo

FILES_COUNT=$(collect_files | tr -d '\0' | grep -c '' || true)
if [ "${FILES_COUNT:-0}" -eq 0 ]; then
  echo "ERROR: 対象ファイルが 1 件も見つかりません(検査が空回りしている可能性)" >&2
  exit 2
fi

if [ "${1:-}" = "--list" ]; then
  echo "## 違反の全件"
  echo
  RESULT=$(collect_files | xargs -0 python3 -c "$PY_CHECK" --list) || {
    echo "ERROR: 判定に失敗しました" >&2; exit 2; }
  echo "$RESULT"
else
  RESULT=$(collect_files | xargs -0 python3 -c "$PY_CHECK") || {
    echo "ERROR: 判定に失敗しました" >&2; exit 2; }
fi

COUNTS=$(printf '%s\n' "$RESULT" | tail -1)
PROD=${COUNTS%% *}
TEST=${COUNTS##* }
TOTAL=$((PROD + TEST))

echo "現在 $TOTAL ファイル / ベースライン $BASELINE ファイル(本番 $PROD ／ テスト $TEST)"
echo

if [ "$TOTAL" -gt "$BASELINE" ]; then
  echo "NG  ベースラインから $((TOTAL - BASELINE)) ファイル増えた"
  echo
  echo "結果: 違反あり"
  echo
  echo "直し方: 増えたファイルの import を CLAUDE.md §4 の順へ並べ替える"
  echo "        (React → サードパーティ → エイリアスパス @/ → 相対パス)。"
  echo "全件を見る: bash scripts/check-import-order.sh --list"
  exit 1
fi

if [ "$TOTAL" -lt "$BASELINE" ]; then
  echo "OK  ベースラインより $((BASELINE - TOTAL)) ファイル少ない"
  echo "    → 本スクリプトの BASELINE を $TOTAL へ下げること"
else
  echo "OK  ベースラインどおり(増加なし)"
fi
echo
echo "結果: 違反なし"
exit 0

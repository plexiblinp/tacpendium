#!/usr/bin/env bash
# check-public-snapshot.sh — 公開スナップショットの許可リストを検査する(決定論・read-only)
#
# 背景 / なぜ要るか(実際に踏んだ):
#   ボード D-637(2026-09-02・開発者判断)。公開の形は `公開リポ = f(tag, 許可リスト)` である。
#   ★★核心は検査であり、しかも**陽性対照**が要る(教訓 E-84)——
#     「除外した」を「除外リストに書いた」で済ませると、**規則が 1 件も当たっていなくても
#     検査は緑を返す。⇒ 陽性対照が無い検査は、存在しないのと同じである。**
#   ★★許可リスト方式にすること。除外リスト(denylist)にしない——denylist は新規追加が
#     黙って通る。先例＝check-doc-inventory.sh の「型 ＋ 例外表」／ pre-push-guard.sh ／
#     design-desk-guard.sh。同スクリプトの逐語＝「列挙方式は必ず取りこぼす。許可リスト方式なら
#     集合が閉じる。過剰ブロックは可視で直せるが、取りこぼしは silent である」。
#
# 何を見るか:
#   (1) 網羅 —— `git ls-files` の全数が manifest の ALLOW か DENY のどちらかに当たること。
#       ★どちらにも当たらないものは「未判定」として赤。⇒ 新種のディレクトリが黙って通らない。
#   (2) 生成物 —— (--verify-output) 生成したスナップショットの中身が、
#       (a) すべて ALLOW に当たり、(b) DENY に当たるものを 1 件も含まないこと。
#       ★これが「除外規則が実際に効いたこと」を生成物の側から確かめる唯一の経路である。
#
# 使い方:
#   bash scripts/check-public-snapshot.sh                    … 許可リストの網羅を検査する
#   bash scripts/check-public-snapshot.sh --verify-output DIR … 生成物を検査する
#   bash scripts/check-public-snapshot.sh --list [DIR]       … 公開されるパスを全数出す
#   bash scripts/check-public-snapshot.sh --list-excluded [DIR] … 除外されるパスと理由を出す
#     ★DIR を渡すとその中身を母数にする(渡さなければ `git ls-files`)。
#       make-public-snapshot.sh はこれを使って選別する。⇒ 判定器は 1 つしか無い。
#   bash scripts/check-public-snapshot.sh --self-test        … 陽性対照・陰性対照を走らせる
#
# 終了コード: 0=違反なし / 1=違反あり(または自己検査 不合格) / 2=実行エラー(未実行。緑ではない)
#
# 依存: python3。**未導入なら exit 2 で「未実行」を返す。**
#
# 対象範囲: `scripts/public-snapshot-manifest.txt` と `git ls-files` の突合のみ。
#   ★中身は見ない。「このファイルを公開してよいか」の判断は manifest の理由列が持つ。
#
# 限界(重要・過信しないこと):
#   - **母数は追跡ファイルである。** 未追跡かつ未 ignore のファイルは `git archive` に
#     入らないので公開物には出ないが、`git add -A` 1 回で追跡に入る。⇒ 参考として
#     `?` 行で通知するが、**これは検査ではない**(赤にしない。作業中の一時ファイルで
#     日常的に鳴るとゲートとして機能しなくなるため)。
#   - **秘匿情報の走査ではない。** gitleaks 等は別工程(checklist A9 / M26-04)。
#   - manifest の理由列の妥当性は機械では見られない。人が読むこと。

set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "ERROR: git リポジトリ内で実行してください" >&2
  exit 2
}
cd "$ROOT" || exit 2

command -v python3 >/dev/null 2>&1 || {
  echo "ERROR: python3 が見つからないため検査できませんでした(未実行。緑ではありません)" >&2
  exit 2
}

MANIFEST="scripts/public-snapshot-manifest.txt"

# ---------------------------------------------------------------------------
# 検出器(★自己検査と本番の両方がこれを呼ぶ。片方だけの経路を作らない)
# ---------------------------------------------------------------------------
read -r -d '' PY_CHECK <<'PY'
import os, re, sys

MODE, MANIFEST_PATH, LIST_PATH = sys.argv[1:4]

def glob_to_re(pat):
    """`*` は `/` を跨がない / `**` は跨ぐ(REUSE 仕様 3.3 と同じ規則)。"""
    out, i = [], 0
    while i < len(pat):
        c = pat[i]
        if c == "*":
            if pat[i:i + 3] == "**/":
                out.append("(?:.*/)?"); i += 3; continue
            if pat[i:i + 2] == "**":
                out.append(".*"); i += 2; continue
            out.append("[^/]*"); i += 1; continue
        out.append(re.escape(c)); i += 1
    return re.compile("^" + "".join(out) + "$")

def load_manifest(path):
    allow, deny, bad = [], [], []
    for lineno, raw in enumerate(open(path, encoding="utf-8"), 1):
        line = raw.rstrip("\n")
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        parts = line.split("\t")
        if len(parts) < 3 or parts[0] not in ("ALLOW", "DENY") or not parts[1].strip() \
           or not parts[2].strip():
            bad.append((lineno, line))
            continue
        entry = (parts[1].strip(), parts[2].strip(), glob_to_re(parts[1].strip()), lineno)
        (allow if parts[0] == "ALLOW" else deny).append(entry)
    return allow, deny, bad

def first_hit(rules, path):
    for pat, reason, rx, lineno in rules:
        if rx.match(path):
            return (pat, reason, lineno)
    return None

allow, deny, bad = load_manifest(MANIFEST_PATH)
violations = []
for lineno, line in bad:
    violations.append("manifest の書式が壊れている(%s:%d): %s" % (MANIFEST_PATH, lineno, line))
if not allow:
    print("ERROR: manifest に ALLOW が 1 件も無い(検査が空回りしている可能性)", file=sys.stderr)
    raise SystemExit(2)

with open(LIST_PATH, "rb") as fh:
    blob = fh.read()
paths = [p.decode("utf-8", "surrogateescape") for p in blob.split(b"\0") if p]
if not paths:
    print("ERROR: 対象ファイルが 1 件も見つかりません(検査が空回りしている可能性)", file=sys.stderr)
    raise SystemExit(2)

published, excluded, undecided = [], [], []
for p in sorted(paths):
    d = first_hit(deny, p)
    if d:
        excluded.append((p, d))
        continue
    a = first_hit(allow, p)
    if a:
        published.append((p, a))
    else:
        undecided.append(p)

if MODE == "manifest":
    for p in undecided:
        violations.append("未判定: %s (ALLOW にも DENY にも当たらない。"
                          "★許可リスト方式なので、公開するなら ALLOW を、出さないなら DENY を manifest へ書くこと)" % p)
elif MODE == "output":
    for p, (pat, reason, lineno) in excluded:
        violations.append("★★生成物に除外対象が残っている: %s (DENY `%s` に当たる — %s)" % (p, pat, reason))
    for p in undecided:
        violations.append("★生成物に許可されていないファイルが在る: %s (ALLOW のどれにも当たらない)" % p)
elif MODE == "list":
    for p, _ in published:
        print(p)
elif MODE == "list-excluded":
    for p, (pat, reason, lineno) in excluded:
        print("%s\t[%s:%d %s]\t%s" % (p, os.path.basename(MANIFEST_PATH), lineno, pat, reason))
else:
    print("ERROR: 不明なモード: %s" % MODE, file=sys.stderr)
    raise SystemExit(2)

for v in violations:
    print("NG  %s" % v)
print("__STATS__%d\t%d\t%d\t%d" % (len(paths), len(published), len(excluded), len(violations)))
raise SystemExit(1 if violations else 0)
PY

run_check() {  # $1=mode  $2=manifest  $3=list file(NUL 区切り)
  python3 -c "$PY_CHECK" "$1" "$2" "$3"
}

tracked_list() {  # $1 = 出力先
  git -c core.quotePath=false ls-files -z > "$1"
}

dir_list() {  # $1 = 対象ディレクトリ  $2 = 出力先
  # ★シンボリックリンクも数える(2026-09-06 レビュー 低-2 の是正)。
  #   `git archive` はシンボリックリンクをそのまま出すが、`-type f` は拾わない。
  #   ⇒ 選別で削除されず、検査の母数にも入らない = 静かに抜ける。
  #   現在の追跡シンボリックリンクは 0 件(実測)であり、将来 1 本入ったときの穴を塞ぐもの。
  ( cd "$1" && find . \( -type f -o -type l \) -not -path './.git/*' -printf '%P\0' ) > "$2"
}

ok()   { printf 'OK  %s\n' "$*"; }

# ---------------------------------------------------------------------------
# 自己検査(陽性対照・陰性対照)
# ---------------------------------------------------------------------------
self_test() {
  local tmp st_fail=0 out rc
  tmp="$(mktemp -d)" || { echo "ERROR: mktemp 失敗" >&2; exit 2; }
  # shellcheck disable=SC2064
  trap "rm -rf '$tmp'" EXIT

  echo "## 自己検査(陽性対照・陰性対照)"
  echo

  printf 'ALLOW\tdocs/**\t説明用\nALLOW\tREADME.md\t説明用\nDENY\tdocs/secret/**\t説明用の除外\nDENY\tnever-exists/**\t★0 件でも緑であることの対照\n' \
    > "$tmp/manifest.txt"

  mk_list() { printf '%s\0' "$@" > "$tmp/list.bin"; }

  # --- 陰性対照 1: 素の状態(網羅) -> 緑 ---
  mk_list "README.md" "docs/a.md" "docs/b/c.md"
  out="$(run_check manifest "$tmp/manifest.txt" "$tmp/list.bin" 2>&1)"; rc=$?
  if [ "$rc" -eq 0 ]; then
    ok "陰性対照(素の状態・網羅) → 緑"
  else
    printf 'NG  陰性対照(素の状態・網羅)が赤になった\n%s\n' "$out"; st_fail=1
  fi

  # --- 陰性対照 2: DENY グロブが 0 件に当たる -> 緑 ---
  #     ★「存在しても出さない」形(D-656)が壊れていないことの対照。
  #       manifest の `never-exists/**` は 1 件も当たらないが、それで赤になってはならない。
  if [ "$rc" -eq 0 ] && ! printf '%s' "$out" | grep -q 'never-exists'; then
    ok "陰性対照(DENY グロブが 0 件に当たる) → 緑"
  else
    printf 'NG  陰性対照(0 件に当たる DENY)が赤になった(「存在しても出さない」形が書けない)\n'; st_fail=1
  fi

  # --- 陽性対照 1(★最重要): 生成物に除外対象が 1 件だけ残っている -> 赤 ---
  mk_list "README.md" "docs/a.md" "docs/secret/leak.md"
  out="$(run_check output "$tmp/manifest.txt" "$tmp/list.bin" 2>&1)"; rc=$?
  if [ "$rc" -ne 0 ] && printf '%s' "$out" | grep -q '生成物に除外対象が残っている'; then
    ok "陽性対照(生成物に除外対象を 1 件だけ残す) → 赤"
  else
    printf 'NG  ★★陽性対照(生成物に除外対象 1 件)が緑になった(除外規則が空振りしても気づけない)\n'; st_fail=1
  fi

  # --- 陽性対照 2: 網羅 —— ALLOW にも DENY にも当たらないファイル -> 赤 ---
  mk_list "README.md" "docs/a.md" "brand-new-dir/x.md"
  out="$(run_check manifest "$tmp/manifest.txt" "$tmp/list.bin" 2>&1)"; rc=$?
  if [ "$rc" -ne 0 ] && printf '%s' "$out" | grep -q '未判定'; then
    ok "陽性対照(ALLOW にも DENY にも当たらない新種) → 赤"
  else
    printf 'NG  陽性対照(未判定のファイル)が緑になった(denylist 的に動いている)\n'; st_fail=1
  fi

  # --- 陽性対照 3: 生成物に許可されていないファイルが在る -> 赤 ---
  out="$(run_check output "$tmp/manifest.txt" "$tmp/list.bin" 2>&1)"; rc=$?
  if [ "$rc" -ne 0 ] && printf '%s' "$out" | grep -q '許可されていないファイル'; then
    ok "陽性対照(生成物に ALLOW 外のファイル) → 赤"
  else
    printf 'NG  陽性対照(生成物に ALLOW 外のファイル)が緑になった\n'; st_fail=1
  fi

  # --- 陽性対照 4: manifest の書式が壊れている -> 赤 ---
  printf 'ALLOW\tdocs/**\n' > "$tmp/broken.txt"
  printf 'ALLOW\tREADME.md\t説明用\n' >> "$tmp/broken.txt"
  mk_list "README.md"
  out="$(run_check manifest "$tmp/broken.txt" "$tmp/list.bin" 2>&1)"; rc=$?
  if [ "$rc" -ne 0 ] && printf '%s' "$out" | grep -q '書式が壊れている'; then
    ok "陽性対照(manifest の理由列が無い行) → 赤"
  else
    printf 'NG  陽性対照(壊れた manifest)が緑になった\n'; st_fail=1
  fi

  # --- 陽性対照 5: DENY は ALLOW より強い ---
  #     docs/** は ALLOW だが docs/secret/** は DENY。⇒ 公開集合に出てはならない。
  mk_list "docs/a.md" "docs/secret/leak.md"
  out="$(run_check list "$tmp/manifest.txt" "$tmp/list.bin" 2>&1)"
  if printf '%s' "$out" | grep -q 'docs/a.md' && ! printf '%s' "$out" | grep -q 'docs/secret/leak.md'; then
    ok "陽性対照(DENY が ALLOW より強い) → 公開集合から落ちる"
  else
    printf 'NG  陽性対照(DENY が ALLOW より強い)が成立しなかった\n%s\n' "$out"; st_fail=1
  fi

  echo
  if [ "$st_fail" -eq 0 ]; then
    echo "自己検査: 合格(陽性は赤・陰性は緑)"
    return 0
  fi
  echo "自己検査: 不合格"
  return 1
}

# ---------------------------------------------------------------------------
# 入口
# ---------------------------------------------------------------------------
MODE="manifest"
OUTDIR=""
case "${1:-}" in
  --self-test)     self_test; exit $? ;;
  --list)          MODE="list";          OUTDIR="${2:-}" ;;
  --list-excluded) MODE="list-excluded"; OUTDIR="${2:-}" ;;
  --verify-output)
      MODE="output"
      OUTDIR="${2:-}"
      [ -n "$OUTDIR" ] || { echo "ERROR: --verify-output にはディレクトリを渡してください" >&2; exit 2; }
      ;;
  "")              ;;
  *)               echo "ERROR: 不明な引数: $1" >&2; exit 2 ;;
esac

# ★DIR を渡したときは、その中身を母数にする(生成物に対して同じ判定器を使うため)。
#   渡さなければ `git ls-files` を母数にする。⇒ 判定器は 1 つしか無い。
if [ -n "$OUTDIR" ] && [ ! -d "$OUTDIR" ]; then
  echo "ERROR: ディレクトリが無い: $OUTDIR" >&2; exit 2
fi

[ -f "$MANIFEST" ] || { echo "ERROR: $MANIFEST が無い" >&2; exit 2; }

LIST_TMP="$(mktemp)" || exit 2
trap 'rm -f "$LIST_TMP"' EXIT

if [ -n "$OUTDIR" ]; then
  dir_list "$OUTDIR" "$LIST_TMP" || exit 2
else
  tracked_list "$LIST_TMP" || exit 2
fi

if [ "$MODE" = "list" ] || [ "$MODE" = "list-excluded" ]; then
  # ★実行エラー(exit 2)を握り潰さないこと(2026-09-06 レビュー 中-3 の是正)。
  #   旧実装は無条件に exit 0 を返しており、判定器が「manifest に ALLOW が 0 件」等で
  #   落ちても呼び出し側(make-public-snapshot.sh)の `|| { ... }` が発火しなかった。
  #   ⇒ 公開集合が空のまま「全ファイルが削除対象」になる入口になっていた。
  #   ★違反あり(1)は一覧としては正常なので 0 に畳み、実行エラー(2)だけを伝播させる。
  run_check "$MODE" "$MANIFEST" "$LIST_TMP" | grep -v '^__STATS__'
  rc=${PIPESTATUS[0]}
  [ "$rc" -eq 2 ] && exit 2
  exit 0
fi

echo "# 公開スナップショット 許可リストの検査"
echo
echo "対象 commit: \`$(git rev-parse --short HEAD 2>/dev/null || echo unknown)\`"
if [ "$MODE" = "output" ]; then
  echo "対象範囲: 生成物 \`$OUTDIR\` の中身"
else
  echo "対象範囲: \`git ls-files\`(追跡ファイル) と \`$MANIFEST\` の突合"
fi
echo

out="$(run_check "$MODE" "$MANIFEST" "$LIST_TMP" 2>&1)"
rc=$?
stats="$(printf '%s' "$out" | sed -n 's/^__STATS__//p' | tail -1)"
printf '%s\n' "$out" | grep -v '^__STATS__'

total="$(printf '%s' "$stats" | cut -f1)"
pub="$(printf '%s' "$stats" | cut -f2)"
exc="$(printf '%s' "$stats" | cut -f3)"
cnt="$(printf '%s' "$stats" | cut -f4)"

echo "母数 ${total:-?} 件 / 公開 ${pub:-?} 件 / 除外 ${exc:-?} 件"

if [ "$MODE" = "manifest" ]; then
  # ★参考情報(赤にしない)。未追跡かつ未 ignore のファイルは git archive に入らないが、
  #   `git add -A` 1 回で追跡に入る。⇒ 気づけるようにだけしておく。
  untracked="$(git -c core.quotePath=false ls-files --others --exclude-standard -z 2>/dev/null \
               | tr '\0' '\n' | sed '/^$/d')"
  if [ -n "$untracked" ]; then
    echo
    echo "?   未追跡かつ未 ignore のファイルが在る(★検査ではない・参考)。"
    echo "    公開物には出ないが、\`git add -A\` 1 回で追跡に入る:"
    printf '%s\n' "$untracked" | sed 's/^/      /'
  fi
fi

echo
if [ "$rc" -eq 2 ]; then
  echo "結果: 実行エラー(未実行。緑ではありません)"
  exit 2
fi
if [ "${cnt:-0}" -eq 0 ]; then
  echo "結果: 違反なし"
  exit 0
fi
echo "結果: 違反 ${cnt} 件"
echo "直し方: 公開するなら ALLOW を、出さないなら DENY を $MANIFEST へ理由つきで足す。"
echo "        ★「とりあえず ALLOW」で黙らせないこと。許可リストが機能しなくなる。"
exit 1

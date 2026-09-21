#!/usr/bin/env bash
# check-third-party-attribution.sh — 来歴の軸(第三者が著作権者であるもの)の宣言の検査
#                                     (決定論・read-only)
#
# 背景(2026-09-20・M40-01):
#   三層(A=AGPL / B=CC-BY-SA / C=MIT)は「何の内容か」で切る軸であり、「誰の著作物か」では
#   切っていない。⇒ vendored な第三者素材は **どの層へ落ちても著作権者の宣言が偽になる**。
#   そこで REUSE.toml へ三層と直交する「来歴の軸」(6) を足した。本検査はそれを守る。
#
#   ★★★塞ぎたい穴は D-777 の一般形である——
#     「グロブで解決する宣言は、ファイルを動かした瞬間に黙って外れる。
#       ⇒ そして外れた先が既定なので、検査は緑のままである」。
#     CHANGE-226(M33-03)で実際に起きた。
#
#   ★★★初版(2026-09-20)は *宣言ブロックを丸ごと消しても緑* であった(M40-01 レビュー 高-2 の実測)。
#     ⇒ 「来歴ブロックが 1 つ以上ある」ことしか見ておらず、T2 が残っていれば T1 を消しても通った。
#       ★これは本検査が防ぐはずだった当の事故である。⇒ R8(必須被覆)を足して塞いだ。
#
# 検査すること:
#   R1 REUSE.toml が読め、version = 1 であること
#   R2 来歴ブロックが 1 つ以上あること
#      (来歴ブロック = SPDX-FileCopyrightText に plexiblinp 以外の権利者を含む [[annotations]])
#   R3 来歴ブロックの各グロブが **1 件以上の追跡ファイルに当たる** こと  ← D-777
#   R4 既定ブロック(path = "**")が在り、来歴ブロックがそれより **後ろ** に在ること
#      (REUSE 3.3 = 同一ファイル内では最後に一致した表だけが使われる。
#       前へ動かすと既定の層 A へ静かに戻る)
#   R5 SPDX-License-Identifier が LicenseRef- で始まるなら
#      LICENSES/<識別子>.txt が在り非空であること
#   R6 配布される来歴ブロックについて、NOTICE に **非 plexiblinp の権利者の逐語** が在ること
#      (人が読む帰属。機械可読な REUSE だけでは配布物の読者に届かない)
#   R7 NOTICE が述べる件数と実測が一致すること(NOTICE_COUNT_RULES)
#      ← 「web/src/components/ui/ に新しいファイルが増えたのに NOTICE が古いまま」を捕まえる
#   R8 **必須被覆**: REQUIRED_PROVENANCE_PATHS の各グロブに当たる追跡ファイルが、
#      REUSE の「最後に一致した表が勝つ」解決で **来歴ブロックへ解決する** こと
#      ← ★宣言ブロックを消す/名前を変える/順序を崩す、のいずれでも赤くなる
#   R9 LicenseRef-(=配布しない範囲)の各グロブが、公開スナップショットの **DENY にも在る** こと
#      ← 「宣言と DENY が同じことを言う」を機械で結ぶ(片方だけ外れたら赤)
#
# 使い方:
#   bash scripts/check-third-party-attribution.sh              # リポジトリを検査
#   bash scripts/check-third-party-attribution.sh --list       # 来歴ブロックの一覧
#   bash scripts/check-third-party-attribution.sh --self-test  # 陽性対照・陰性対照
#
# 終了コード: 0=違反なし / 1=違反あり / 2=実行エラー
#
# 限界:
#   - **床であって証明ではない。** 「宣言された範囲が実態と合っているか」は見るが、
#     **宣言されていない第三者素材が新しく持ち込まれたこと** は検出できない。
#     ⇒ そこに oracle は無い。人が見るか、SCANOSS のような外部スキャンに頼る。
#   - ライセンス条件そのものの妥当性は見ない(CLAUDE.md §10＝法務の自己判断禁止)。
#   - グロブの規則は REUSE 3.3 と同じ実装を使う(`*` は `/` を跨がない / `**` は跨ぐ)。
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "ERROR: git リポジトリ内で実行してください" >&2
  exit 2
}
cd "$ROOT"

command -v python3 >/dev/null 2>&1 || {
  echo "ERROR: python3 が見つかりません。⇒ 未実行です。緑ではありません" >&2
  exit 2
}
python3 -c 'import tomllib' 2>/dev/null || {
  echo "ERROR: python3 に tomllib がありません(3.11 以上が要ります)。⇒ 未実行です" >&2
  exit 2
}

# ---------------------------------------------------------------------------
# 本 repo の著作権者を表す語。これ *以外* の権利者を含むブロックを来歴ブロックとする。
# ---------------------------------------------------------------------------
OWN_HOLDER_PATTERN="plexiblinp"

# ---------------------------------------------------------------------------
# R8 の必須被覆表: 「来歴ブロックへ解決していなければならないグロブ :: 何であるか」
#   ★★★ここに在るグロブは、宣言を消しても・動かしても・順序を崩しても赤くなる。
#   ★足すときは REUSE.toml の (6) と対で足すこと。
# ---------------------------------------------------------------------------
REQUIRED_PROVENANCE_PATHS=(
  'web/src/components/ui/** :: shadcn/ui 由来の vendored source(M40-01)'
  'web/src/lib/utils.ts :: shadcn/ui 由来の cn() ヘルパ(M40-01)'
  'docs/seed-data/** :: 第三者素材を含み配布しない範囲(M26-03 の再判定 / M40-01)'
)

# ---------------------------------------------------------------------------
# R7 の対照表: 「グロブ :: NOTICE 内の正規表現(数値を 1 つ捕獲する)」
#   ★NOTICE に書いた件数が実測とずれたら赤にする。
#   ★足すときは、NOTICE 側の文面と対で足すこと。
# ---------------------------------------------------------------------------
NOTICE_COUNT_RULES=(
  'web/src/components/ui/** :: `web/src/components/ui/` 配下の ([0-9]+) ファイル'
)

# R9 が読む公開スナップショットの許可リスト
MANIFEST_PATH="scripts/public-snapshot-manifest.txt"

run_check() {
  local root="$1"
  TPA_OWN="$OWN_HOLDER_PATTERN" \
  TPA_MANIFEST="$MANIFEST_PATH" \
  TPA_COUNT_RULES="$(printf '%s\n' ${NOTICE_COUNT_RULES[@]+"${NOTICE_COUNT_RULES[@]}"})" \
  TPA_REQUIRED="$(printf '%s\n' ${REQUIRED_PROVENANCE_PATHS[@]+"${REQUIRED_PROVENANCE_PATHS[@]}"})" \
  python3 - "$root" <<'PY'
import os, re, subprocess, sys, tomllib

root = sys.argv[1]
own = os.environ["TPA_OWN"]
manifest_path = os.environ["TPA_MANIFEST"]
count_rules = [l for l in os.environ.get("TPA_COUNT_RULES", "").split("\n") if l.strip()]
required    = [l for l in os.environ.get("TPA_REQUIRED", "").split("\n") if l.strip()]
os.chdir(root)

violations = []
def fail(msg): violations.append(msg); print("NG  " + msg)
def ok(msg):   print("OK  " + msg)

def glob_to_re(glob):
    """REUSE 3.3 のグロブ規則。`*` は / を跨がない。`**` は跨ぐ。"""
    out, i = [], 0
    while i < len(glob):
        if glob.startswith("**/", i):
            out.append("(?:.*/)?"); i += 3
        elif glob.startswith("**", i):
            out.append(".*"); i += 2
        elif glob[i] == "*":
            out.append("[^/]*"); i += 1
        else:
            out.append(re.escape(glob[i])); i += 1
    return re.compile("^" + "".join(out) + "$")

# --- 母数: 追跡ファイル ------------------------------------------------------
try:
    raw = subprocess.run(["git", "-c", "core.quotePath=false", "ls-files", "-z"],
                         capture_output=True, check=True).stdout
except Exception as e:
    print("ERROR: git ls-files に失敗しました: %s" % e, file=sys.stderr); sys.exit(2)
tracked = [p for p in raw.decode("utf-8").split("\0") if p]

# --- R1 REUSE.toml ----------------------------------------------------------
if not os.path.exists("REUSE.toml"):
    print("ERROR: REUSE.toml が在りません", file=sys.stderr); sys.exit(2)
with open("REUSE.toml", "rb") as fh:
    doc = tomllib.load(fh)
if doc.get("version") != 1:
    fail("R1: REUSE.toml の version が 1 ではありません: %r" % doc.get("version"))
tables = doc.get("annotations", [])
if not tables:
    print("ERROR: REUSE.toml に [[annotations]] が在りません", file=sys.stderr); sys.exit(2)
ok("R1: REUSE.toml を読めた(version=%r / 表 %d 個)" % (doc.get("version"), len(tables)))

def as_list(v):
    if v is None: return []
    return [v] if isinstance(v, str) else list(v)

# --- 表の正規化と来歴ブロックの抽出 -----------------------------------------
norm = []   # (idx, [(glob, regex)], holders, foreign, license)
default_idx = None
for idx, t in enumerate(tables):
    paths = as_list(t.get("path"))
    holders = as_list(t.get("SPDX-FileCopyrightText"))
    lic = t.get("SPDX-License-Identifier", "")
    if paths == ["**"]:
        default_idx = idx
    norm.append((idx, [(g, glob_to_re(g)) for g in paths], holders,
                 [h for h in holders if own not in h], lic))

provenance = [n for n in norm if n[3]]
prov_idx = {n[0] for n in provenance}

# --- R2 ---------------------------------------------------------------------
if not provenance:
    fail("R2: 来歴ブロックが 1 つも在りません(SPDX-FileCopyrightText がすべて %r 系です)。"
         "⇒ 第三者が著作権者であるものを宣言する場所が無い状態に戻っています" % own)
else:
    ok("R2: 来歴ブロック %d 個を検出" % len(provenance))

# --- R3 ---------------------------------------------------------------------
for idx, globs, holders, foreign, lic in provenance:
    for g, rx in globs:
        hits = [p for p in tracked if rx.match(p)]
        if not hits:
            fail("R3: 来歴ブロック(表 %d)のグロブが 1 件も当たりません: %s\n"
                 "    ⇒ D-777 の形です。ファイルを動かしたなら宣言も動かしてください。"
                 "外れた先は既定(層 A)であり、他の検査は緑のままです" % (idx + 1, g))
        else:
            ok("R3: グロブ %s → 追跡ファイル %d 件" % (g, len(hits)))

# --- R4 ---------------------------------------------------------------------
if default_idx is None:
    fail("R4: 既定ブロック(path = \"**\")が在りません。⇒ 宣言されていないファイルの層が決まりません")
else:
    bad = [i + 1 for i in sorted(prov_idx) if i < default_idx]
    if bad:
        fail("R4: 来歴ブロック(表 %s)が既定ブロック(表 %d・path=\"**\")より前に在ります。"
             "⇒ REUSE 3.3 は最後に一致した表だけを使うため、宣言が既定に負けます"
             % (", ".join(map(str, bad)), default_idx + 1))
    else:
        ok("R4: 既定ブロックは表 %d で、来歴ブロックはすべてその後ろに在る" % (default_idx + 1))

# --- R5 LicenseRef の本文 ----------------------------------------------------
for idx, globs, holders, foreign, lic in provenance:
    if isinstance(lic, str) and lic.startswith("LicenseRef-"):
        path = os.path.join("LICENSES", lic + ".txt")
        if not os.path.exists(path):
            fail("R5: %s の本文が在りません: %s" % (lic, path))
        elif os.path.getsize(path) == 0:
            fail("R5: %s の本文が空です: %s" % (lic, path))
        else:
            ok("R5: %s の本文が在る(%s)" % (lic, path))

# --- R6 NOTICE の人が読む帰属 ------------------------------------------------
if not os.path.exists("NOTICE"):
    fail("R6: NOTICE が在りません")
    notice = ""
else:
    notice = open("NOTICE", encoding="utf-8").read()

for idx, globs, holders, foreign, lic in provenance:
    if isinstance(lic, str) and lic.startswith("LicenseRef-"):
        continue  # 配布しない範囲は NOTICE の対象外
    for h in foreign:
        if h not in notice:
            fail("R6: NOTICE に権利者の逐語が在りません: %r (REUSE.toml の表 %d)\n"
                 "    ⇒ 機械可読な宣言だけでは、配布物を受け取った人に帰属が届きません"
                 % (h, idx + 1))
        else:
            ok("R6: NOTICE に権利者の逐語が在る: %r" % h)

# --- R7 NOTICE の件数と実測 --------------------------------------------------
for rule in count_rules:
    g, _, pattern = rule.partition(" :: ")
    rx = glob_to_re(g)
    actual = len([p for p in tracked if rx.match(p)])
    m = re.search(pattern, notice)
    if not m:
        fail("R7: NOTICE に件数の記述が見つかりません: /%s/ (対象 %s)\n"
             "    ⇒ 文面を変えたなら NOTICE_COUNT_RULES も対で変えてください" % (pattern, g))
        continue
    stated = int(m.group(1))
    if stated != actual:
        fail("R7: NOTICE の件数が実測とずれています: %s は NOTICE が %d 件、実測は %d 件\n"
             "    ⇒ ファイルが増減したのに帰属の記述が追随していません" % (g, stated, actual))
    else:
        ok("R7: NOTICE の件数が実測と一致(%s = %d 件)" % (g, actual))

# --- R8 必須被覆(★宣言ブロックを消しても赤くなる) ----------------------------
def resolve(relpath):
    """REUSE 3.3: 同一ファイル内では最後に一致した表だけが使われる。"""
    hit = None
    for idx, globs, holders, foreign, lic in norm:
        if any(rx.match(relpath) for _, rx in globs):
            hit = idx
    return hit

for rule in required:
    g, _, what = rule.partition(" :: ")
    rx = glob_to_re(g)
    hits = [p for p in tracked if rx.match(p)]
    if not hits:
        fail("R8: 必須被覆のグロブに当たる追跡ファイルが 0 件です: %s (%s)\n"
             "    ⇒ ファイルが消えたか動いたなら、本表と REUSE.toml を対で直してください" % (g, what))
        continue
    stray = [p for p in hits if resolve(p) not in prov_idx]
    if stray:
        fail("R8: 来歴ブロックへ解決していないファイルが %d 件あります: %s (%s)\n"
             "    例: %s → 表 %s\n"
             "    ⇒ 宣言を消した・名前を変えた・順序を崩した、のいずれかです。"
             "外れた先は既定(層 A＝© %s / AGPL)であり、他の検査は緑のままです"
             % (len(stray), g, what, stray[0],
                (resolve(stray[0]) + 1) if resolve(stray[0]) is not None else "なし", own))
    else:
        ok("R8: %s の %d 件はすべて来歴ブロックへ解決する" % (g, len(hits)))

# --- R9 LicenseRef と公開スナップショットの DENY を結ぶ ----------------------
manifest = ""
if os.path.exists(manifest_path):
    manifest = open(manifest_path, encoding="utf-8").read()
deny_globs = set()
for line in manifest.split("\n"):
    if line.startswith("DENY\t"):
        parts = line.split("\t")
        if len(parts) >= 2:
            deny_globs.add(parts[1])

for idx, globs, holders, foreign, lic in provenance:
    if not (isinstance(lic, str) and lic.startswith("LicenseRef-")):
        continue
    for g, _rx in globs:
        if g not in deny_globs:
            fail("R9: 配布しない範囲の宣言に対応する DENY が %s に在りません: %s\n"
                 "    ⇒ 宣言(REUSE.toml)と実装(公開スナップショットの許可リスト)が"
                 "同じことを言っていません" % (manifest_path, g))
        else:
            ok("R9: %s は REUSE の %s と DENY の双方で宣言されている" % (g, lic))

print()
if violations:
    print("結果: 違反 %d 件" % len(violations)); sys.exit(1)
print("結果: 違反なし"); sys.exit(0)
PY
}

list_blocks() {
  python3 - "$ROOT" "$OWN_HOLDER_PATTERN" <<'PY'
import os, sys, tomllib
os.chdir(sys.argv[1]); own = sys.argv[2]
doc = tomllib.load(open("REUSE.toml", "rb"))
def as_list(v): return [] if v is None else ([v] if isinstance(v, str) else list(v))
print("# 来歴ブロック(SPDX-FileCopyrightText に %r 以外の権利者を含む表)\n" % own)
for i, t in enumerate(doc.get("annotations", []), 1):
    holders = as_list(t.get("SPDX-FileCopyrightText"))
    foreign = [h for h in holders if own not in h]
    if not foreign: continue
    print("表 %d: %s" % (i, t.get("SPDX-License-Identifier")))
    for p in as_list(t.get("path")): print("    path    : %s" % p)
    for h in foreign:                print("    第三者  : %s" % h)
    print()
PY
}

# ---------------------------------------------------------------------------
# 自己検査: 陰性対照 2 / 陽性対照 8
#
#   ★★★陽性対照は **どの規則が鳴ったか** まで照合する(2026-09-20・レビュー 高-3 の是正)。
#     ⇒ 初版は終了コードだけを見ていたため、対照 1 が R3 と R7 で同時に赤くなり、
#       **R3 を壊した変異版でも「合格」を返した**。★対照が規則を隔離していなかった。
#     ⇒ 期待するメッセージの接頭辞(R1〜R9)を照合すれば、他の規則が同時に鳴っても隔離できる。
# ---------------------------------------------------------------------------
self_test() {
  local tmp st_fail=0
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' RETURN

  build() {   # build <dir> — 最小の擬似リポジトリを作る
    local d="$1"
    mkdir -p "$d/LICENSES" "$d/vendor/ui" "$d/secret" "$d/scripts"
    printf 'stub\n' > "$d/vendor/ui/button.tsx"
    printf 'stub\n' > "$d/vendor/ui/card.tsx"
    printf 'stub\n' > "$d/secret/raw.md"
    printf 'not for distribution\n' > "$d/LICENSES/LicenseRef-SelfTest.txt"
    printf 'DENY\tsecret/**\t自己検査用\n' > "$d/scripts/public-snapshot-manifest.txt"
    cat > "$d/NOTICE" <<'N'
Stub NOTICE
Copyright (c) 2023 upstream-author
対象: `vendor/ui/` 配下の 2 ファイル
N
    cat > "$d/REUSE.toml" <<'T'
version = 1

[[annotations]]
path = "**"
precedence = "override"
SPDX-FileCopyrightText = "2026 plexiblinp"
SPDX-License-Identifier = "AGPL-3.0-or-later"

[[annotations]]
path = "vendor/ui/**"
precedence = "override"
SPDX-FileCopyrightText = ["2023 upstream-author", "2026 plexiblinp"]
SPDX-License-Identifier = "MIT"

[[annotations]]
path = "secret/**"
precedence = "override"
SPDX-FileCopyrightText = ["2026 plexiblinp", "third parties"]
SPDX-License-Identifier = "LicenseRef-SelfTest"
T
    ( cd "$d" && git init -q . && git add -A \
        && git -c user.name=t -c user.email=t@e commit -qm init ) >/dev/null 2>&1
  }

  commit_all() { ( cd "$1" && git add -A \
      && git -c user.name=t -c user.email=t@e commit -qm fixture ) >/dev/null 2>&1; }

  # probe <名前> <期待 exit> <dir> [期待する規則の接頭辞]
  probe() {
    local name="$1" want="$2" d="$3" want_rule="${4-}" got out
    out="$(
      NOTICE_COUNT_RULES=('vendor/ui/** :: `vendor/ui/` 配下の ([0-9]+) ファイル')
      REQUIRED_PROVENANCE_PATHS=('vendor/ui/** :: 自己検査用の vendored source'
                                 'secret/** :: 自己検査用の配布しない範囲')
      run_check "$d" 2>&1
    )"; got=$?
    local kind; kind="$( [ "$want" -eq 0 ] && echo 陰性 || echo 陽性 )"
    if [ "$got" -ne "$want" ]; then
      printf 'NG  %s対照(%s) の終了コードが期待どおりでない(期待 %d / 実際 %d)\n' \
             "$kind" "$name" "$want" "$got"; st_fail=1; return
    fi
    if [ -n "$want_rule" ] && ! printf '%s' "$out" | grep -q "^NG  ${want_rule}:"; then
      printf 'NG  %s対照(%s) は赤くなったが %s が鳴っていない(別の規則で赤くなった)\n' \
             "$kind" "$name" "$want_rule"; st_fail=1; return
    fi
    printf 'OK  %s対照(%s) → %s%s\n' "$kind" "$name" \
           "$( [ "$want" -eq 0 ] && echo 緑 || echo 赤 )" \
           "$( [ -n "$want_rule" ] && printf '(%s)' "$want_rule" )"
  }

  # --- 陰性 -----------------------------------------------------------------
  build "$tmp/neg1"; probe "宣言と実態が合っている" 0 "$tmp/neg1"

  build "$tmp/neg2"
  printf 'stub\n' > "$tmp/neg2/vendor/ui/input.tsx"
  sed -i 's/配下の 2 ファイル/配下の 3 ファイル/' "$tmp/neg2/NOTICE"
  commit_all "$tmp/neg2"
  probe "ファイルが増え NOTICE も追随" 0 "$tmp/neg2"

  # --- 陽性 -----------------------------------------------------------------
  build "$tmp/p1"; sed -i 's/^version = 1$/version = 2/' "$tmp/p1/REUSE.toml"
  commit_all "$tmp/p1"; probe "version が 1 でない" 1 "$tmp/p1" R1

  # R2: 来歴ブロックを 1 つも持たない(第三者の権利者を全部消す)
  build "$tmp/p2"
  sed -i 's/\["2023 upstream-author", "2026 plexiblinp"\]/"2026 plexiblinp"/' "$tmp/p2/REUSE.toml"
  sed -i 's/\["2026 plexiblinp", "third parties"\]/"2026 plexiblinp"/' "$tmp/p2/REUSE.toml"
  commit_all "$tmp/p2"; probe "来歴ブロックが 1 つも無い" 1 "$tmp/p2" R2

  # R3: グロブが空振りする(D-777 の形)
  build "$tmp/p3"
  ( cd "$tmp/p3" && mkdir -p components && git mv vendor/ui/button.tsx components/ \
      && git mv vendor/ui/card.tsx components/ \
      && git -c user.name=t -c user.email=t@e commit -qm move ) >/dev/null 2>&1
  probe "グロブが 0 件に当たる" 1 "$tmp/p3" R3

  # R4: 来歴ブロックが既定より前に在る(順序が崩れた)
  build "$tmp/p4"
  python3 - "$tmp/p4/REUSE.toml" <<'PY'
import io,sys
p=sys.argv[1]; s=io.open(p,encoding='utf-8').read()
head,_,rest = s.partition('\n\n'); blocks = rest.split('\n\n')
io.open(p,'w',encoding='utf-8').write(head+'\n\n'+'\n\n'.join(blocks[1:]+[blocks[0]]))
PY
  commit_all "$tmp/p4"; probe "来歴ブロックが既定より前" 1 "$tmp/p4" R4

  # R5: LicenseRef の本文が無い
  build "$tmp/p5"
  ( cd "$tmp/p5" && git rm -q LICENSES/LicenseRef-SelfTest.txt \
      && git -c user.name=t -c user.email=t@e commit -qm rm ) >/dev/null 2>&1
  probe "LicenseRef の本文が無い" 1 "$tmp/p5" R5

  # R6: NOTICE に権利者の逐語が無い
  build "$tmp/p6"
  sed -i 's/Copyright (c) 2023 upstream-author//' "$tmp/p6/NOTICE"
  commit_all "$tmp/p6"; probe "NOTICE に権利者の逐語が無い" 1 "$tmp/p6" R6

  # R7: ファイルが増えたが NOTICE が古い
  build "$tmp/p7"
  printf 'stub\n' > "$tmp/p7/vendor/ui/input.tsx"
  commit_all "$tmp/p7"; probe "ファイルが増えたが NOTICE が古い" 1 "$tmp/p7" R7

  # R8: ★宣言ブロックを丸ごと消す(初版が素通りした当の事故)
  build "$tmp/p8"
  python3 - "$tmp/p8/REUSE.toml" <<'PY'
import io,sys
p=sys.argv[1]; s=io.open(p,encoding='utf-8').read()
old='''[[annotations]]
path = "vendor/ui/**"
precedence = "override"
SPDX-FileCopyrightText = ["2023 upstream-author", "2026 plexiblinp"]
SPDX-License-Identifier = "MIT"
'''
assert old in s
io.open(p,'w',encoding='utf-8').write(s.replace(old,'',1))
PY
  commit_all "$tmp/p8"; probe "来歴ブロックを丸ごと消した" 1 "$tmp/p8" R8

  # R9: DENY が無い
  build "$tmp/p9"
  printf '# DENY を消した\n' > "$tmp/p9/scripts/public-snapshot-manifest.txt"
  commit_all "$tmp/p9"; probe "配布しない範囲に対応する DENY が無い" 1 "$tmp/p9" R9

  echo
  if [ "$st_fail" -eq 0 ]; then
    echo "自己検査: 合格(陽性は赤・陰性は緑。★陽性はどの規則が鳴ったかまで照合した)"; return 0
  fi
  echo "自己検査: 不合格"; return 1
}

case "${1-}" in
  --self-test) self_test; exit $? ;;
  --list)      list_blocks; exit 0 ;;
  "")          ;;
  *)           echo "usage: $0 [--list|--self-test]" >&2; exit 2 ;;
esac

echo "# 来歴の軸(第三者が著作権者であるもの)の宣言の検査"
echo
echo "対象 commit: \`$(git rev-parse --short HEAD 2>/dev/null || echo '-')\`"
echo "対象範囲: REUSE.toml の来歴ブロック ／ NOTICE ／ LICENSES/ ／ $MANIFEST_PATH ／ 追跡ファイル"
echo
run_check "$ROOT"

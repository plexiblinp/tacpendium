#!/usr/bin/env bash
# check-migration-license.sh — migrations/ のライセンス宣言の漏れを検出する(決定論・read-only)
#
# 背景 / なぜ要るか(実際に踏んだ):
#   ボード D-705(2026-09-05・開発者承認)。「ゲーム由来のデータは migrations でも CC BY-SA に
#   したい」という要求に対し、**フォルダ分割は採れない**ことが分かった——
#   `//go:embed migrations/*.sql` は直下の `.sql` しか埋め込まず(`*` はパス区切りを跨がない)、
#   `iofs.New(fs, "migrations")` も指定パス直下だけを読む(非再帰)。
#   ⇒ サブフォルダへ置いたマイグレは **エラーを出さずに適用されない**。起動は成功し、
#     マイグレも「全部適用済み」として正常終了し、列だけが無い DB ができる
#     (M27-02b 教訓 3 が実際に踏んだ形＝`no such column` が「重複判定の失敗」として現れた)。
#   採用した解は「ファイルを動かさず、命名規約 ＋ 機械検査」。本スクリプトがその機械検査である。
#
#   ★止めたい事故は「静かな漏れ」である——新しいゲームデータ seed が `_data_` を付け忘れて
#     既定(層 A = AGPL)へ落ちること。**テストも lint も型検査も何も言わない。**
#     ライセンスの割当は戻しにくい向きがある(開発者逐語＝「一度 AGPL 化してから
#     CC BY SA に戻すのは難しい認識」)。⇒ 人が読む以外に見つける経路が無い。
#
# 何を見るか:
#   (1) 健全性 —— `migrations/` 直下より深い場所に `.sql` が無いこと(在ると黙って未適用になる)
#   (2) 完全性 —— `migrations/*.sql` の全数が REUSE.toml でちょうど 1 つの層に解決すること
#   (3) 凍結表との一致 —— 凍結済みの解決結果が、本スクリプトが持つ凍結表と 1 対 1 であること
#   (4) 内容整合 —— 次のどちらかを満たすこと
#       ★★【2026-09-19・M33-03】**凍結分にも (4) を評価する**ようにした。
#         着手時点は `if num in frozen: (3) else: (4)` であり、M33-02 が新系列 9 本を
#         *全数*凍結表へ入れたため **(4) が 1 本も評価されない空回りだった**
#         (--list の実測で 18/18 が「凍結」)。⇒ 規則 (4) を守る唯一の経路が
#         --self-test の陽性対照だけになっていた。★検査が在ることと効くことは別である。
#       ★凍結表は残した。⇒ (3) は層の *値* を固定する力を持ち、(4) には無い
#         (REUSE.toml を書き換えて層を入れ替えても (4) だけでは検出できない)。
#         (a) 名前に `_data_` を持ち、層 B(CC-BY-SA-4.0)に解決する(例 NNNNNN_data_seed_moves_xxx.up.sql)
#         (b) `_data_` を持たず、層 A(AGPL-3.0-or-later)に解決し、かつ
#             ゲームデータ表(characters / moves / move_commands / move_derivations /
#             preset_aliases / custom_states)へ**書かない**
#       ⇒ ゲームデータ表へ書くのに `_data_` を持たないマイグレを赤にする。これが本検査の本体。
#       ★★【2026-09-19・M33-03】(a) 側にも書き込み先の検査を足した。
#         着手時点の (a) は **層だけを見て書き込み先を一切見ていなかった**。
#         ⇒ `_data_` を付けて層 A の表(games / presets / users / tags)へ書くファイルが
#           *違反 0 件のまま* CC-BY-SA-4.0 へ解決した(M33-02 が一時ファイル
#           `000010_data_seed_probe_users.up.sql` で EXIT=0 を実測している)。
#         ★followup `migration-license-check-blind-to-write-target-when-data-named` の是正。
#   (5) 凍結 golden の層 —— `internal/seedgen/testdata/*.sql` が層 B に解決すること
#       ★★【2026-09-19・M33-03】走査範囲を migrations/ の外へ広げた *唯一* の規則である。
#         理由＝M33-03 が golden の比較先を migrations/ から同ディレクトリへ移した結果、
#         `migrations/*_data_*.sql` のグロブから外れ、既定の層 A へ *静かに* 解決していた。
#         ⇒ D-777 の一般形「グロブで解決する宣言はファイルを動かした瞬間に黙って外れ、
#           外れた先が既定なので検査は緑のまま」。★本規則がその経路を塞ぐ。
#
# 使い方:
#   bash scripts/check-migration-license.sh              … 検査する
#   bash scripts/check-migration-license.sh --self-test  … 陽性対照・陰性対照を走らせる
#   bash scripts/check-migration-license.sh --list       … 全マイグレの解決結果を出す
#
# 終了コード: 0=違反なし / 1=違反あり(または自己検査 不合格) / 2=実行エラー(未実行。緑ではない)
#
# 依存: python3 3.11 以上(標準ライブラリ `tomllib` を使う)。**未導入なら exit 2 で「未実行」を返す。**
#
# 対象範囲: `migrations/` ＋ `internal/seedgen/testdata/`(規則 (5)) と `REUSE.toml`。
#   ライセンスの妥当性そのものは見ない。
#
# 限界(重要・過信しないこと):
#   - 本検査は **REUSE の解決規則を自前で実装している**(`reuse` コマンドは新規依存になるため
#     入れていない＝CLAUDE.md §6)。⇒ 公式ツールとの一致は保証しない。床であって証明ではない。
#   - (4)(b) の「ゲームデータ表へ書くか」は SQL の字句走査である。**動的 SQL(文字列連結で
#     組み立てる形)・トリガ経由の書き込み・`CREATE TABLE ... AS SELECT` は見ない。**
#     ★2026-09-06 レビュー(高-2)の是正で、`INSERT OR <句> INTO` / `REPLACE INTO` /
#       スキーマ修飾(`main.moves`) / 引用符つき表名 / `UPDATE OR <句>` は拾うようにし、
#       6 形すべてを self-test の陽性対照へ入れた。**「1 形だけ試して緑」を対照と呼ばない。**
#   - 凍結表は M33-02(2026-09-19)で新系列 9 本へ差し替えた(層 A 4 本 / 層 B 5 本)。
#     ★旧表(2026-09-06 実測・層 A 30 本 / 層 B 72 本)が指すファイルは現存しない。
#     出所は本文の凍結表ブロックのコメントに置いた。

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
python3 -c 'import tomllib' 2>/dev/null || {
  echo "ERROR: python3 の tomllib が使えないため検査できませんでした(3.11 以上が要る。未実行。緑ではありません)" >&2
  exit 2
}

# ---------------------------------------------------------------------------
# 凍結表(★適用済みマイグレは凍結されている＝D-535。⇒ この表は以後変わらない)
#   ★例外が 1 度だけ在った——2026-09-19 の M33-02。旧系列そのものを 9 群へ潰したため、
#     凍結の対象だったファイルが 1 本も現存しなくなった。⇒ 「適用済みだから変わらない」の
#     前提が崩れる唯一の形である。★通常の改番・改名では動かさないこと(D-535 は生きている)。
#   ★★【2026-09-19・M33-03】凍結表は *残す* と決めた(開発者裁定「両方やる」の実装)。
#     ⇒ 設計卓の推し(D-902)は「9 本を凍結表から外して規則 (4) の判定へ委ねる」であり、
#       実査でも外しても 9 本すべて (4) を通る(緑)ことを確かめた。★それでも残したのは、
#       規則 (3) が持つ力が (4) に無いためである——(3) は層の *値* を固定するので、
#       REUSE.toml を書き換えて層を入れ替えたときに赤くなる。(4) は命名と中身しか見ない。
#     ⇒ かわりに「凍結分にも規則 (4) を評価する」ようにした。★これで「空回り」は消え、
#       (3) の力も残る。⇒ 外す案より厳密に強い形である。
#     ★整合の確認(指示書 §2.4-3)＝SUPP-001 §2.7 の現行記述(9 本・欠番 0 件・次は 000010 /
#       REUSE.toml の連番グロブ表は撤去)と、上の例外 3 行は矛盾しない。
#       片方は「例外が 1 度あった」経緯、片方は結果の記述である。
#
# ★★★【2026-09-19・M33-02 で差し替え・開発者裁定】旧 102 番号 -> 新系列 9 番号。
#   M33 が旧系列 115 本(000001〜000117)を 9 群へ潰したため、旧凍結表が指す番号のうち
#   9 本ぶんを除く全てに対応するファイルが現存しなくなった(規則 (3)-b が 93 件の
#   「凍結表に在るがファイルが無い」を出す)。
#   ★★同時に、旧凍結表は新系列と 3 件で食い違っていた——000005 / 000008 は層 A のはずが
#     層 B へ、そして 000009(users / tags＝層 A)は凍結表も層 B だったため
#     *違反を出さずに* CC-BY-SA-4.0 へ解決していた(REUSE.toml の連番グロブと合わせ技)。
#   ⇒ 新系列の実際の層で置き直す。★規則 (1)〜(4) のロジックは 1 行も変えていない。
#   出所(歴史記録): 旧表は docs/progress/20260905-migration-license-assignment.md §1 / §2
#     ＋ M26-02 の実査(開発者承認 2026-09-06)。新表は M33-02 の 9 群定義
#     (M33-overview §0.5.3 v2.7.0 / 指示書 M33-02 §0.4)。
#
#   新系列の割当:
#     000001 S01  最終スキーマ        A   (ゲームデータ表へ 1 行も書かない＝DDL のみ)
#     000002 S02a games               A   (games は GAME_TABLES に無い＝アプリの設計物)
#     000003 S02b characters          B
#     000004 S03  moves               B
#     000005 S04  move_commands       B
#     000006 S05  move_derivations    B
#     000007 S06a presets             A   (presets は GAME_TABLES に無い)
#     000008 S06b preset_aliases      B
#     000009 S07  初期 users・tags    A   (users / tags は GAME_TABLES に無い)
# ---------------------------------------------------------------------------
FROZEN_A="000001 000002 000007 000009"

FROZEN_B="000003 000004 000005 000006 000008"

write_frozen() {  # $1 = 出力先
  {
    for n in $FROZEN_A; do echo "$n A"; done
    for n in $FROZEN_B; do echo "$n B"; done
  } > "$1"
}

# ---------------------------------------------------------------------------
# 検出器(★自己検査と本番の両方がこれを呼ぶ。片方だけの経路を作らない)
# ---------------------------------------------------------------------------
read -r -d '' PY_CHECK <<'PY'
import os, re, sys, tomllib

MIG_DIR, REUSE_PATH, FROZEN_PATH, MODE, GOLDEN_DIR, GOLDEN_REL = sys.argv[1:7]

LAYER_OF = {"AGPL-3.0-or-later": "A", "CC-BY-SA-4.0": "B", "MIT": "C"}
GAME_TABLES = ("characters", "moves", "move_commands", "move_derivations",
               "preset_aliases", "custom_states")
# ★層 A の表＝アプリの設計物であり SF6 の事実ではない。⇒ ここへ書くファイルは層 A でなければ
#   ならない。`_data_` を付けて CC-BY-SA へ寄せてはいけない(規則 (4)(a) の追加検査)。
APP_TABLES = ("games", "presets", "users", "tags")
# ★表名として捕獲されうる SQL の予約語。⇒ `REFERENCES x(id) ON UPDATE CASCADE` の
#   `CASCADE` が _WRITE_RE の UPDATE 枝で group(1) に入る(実測: 000001 の 3 箇所)。
#   着手時点は GAME_TABLES 照合で落ちるため無害だったが、APP_TABLES を足す以上ここで潰す。
NOT_TABLE_WORDS = frozenset(("cascade", "restrict", "action", "set", "no", "default"))

def glob_to_re(pat):
    """REUSE 仕様 3.3 のグロブ規則: `*` は `/` を跨がない / `**` は跨ぐ。"""
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

def load_tables(path):
    with open(path, "rb") as fh:
        doc = tomllib.load(fh)
    if doc.get("version") != 1:
        raise SystemExit("REUSE.toml の version が 1 ではない: %r" % doc.get("version"))
    tables = []
    for t in doc.get("annotations", []):
        paths = t["path"]
        if isinstance(paths, str):
            paths = [paths]
        lic = t.get("SPDX-License-Identifier")
        tables.append(([glob_to_re(p) for p in paths], lic))
    return tables

def resolve(tables, relpath):
    """★同一 REUSE.toml 内では「最後に一致した表」だけが使われる(仕様 §REUSE.toml)。"""
    hit = None
    for regexes, lic in tables:
        if any(rx.match(relpath) for rx in regexes):
            hit = lic
    return hit

# ★書き込みの検出。2026-09-06 レビュー(高-2)で「`INSERT OR IGNORE INTO` を見逃す」ことが
#   実測で示されたため拡張した。★仮定の形ではない——migrations/000007 が実際にこの形を使う。
#   拾う形: INSERT INTO / INSERT OR <競合解決句> INTO / REPLACE INTO /
#           UPDATE / UPDATE OR <句> / DELETE FROM
#   表名側: 省略可能なスキーマ修飾(`main.moves`)と、引用符(`"x"` / `` `x` `` / `[x]`)を許す。
_WRITE_RE = re.compile(
    r"\b(?:INSERT(?:\s+OR\s+[A-Za-z]+)?\s+INTO"
    r"|REPLACE\s+INTO"
    r"|UPDATE(?:\s+OR\s+[A-Za-z]+)?"
    r"|DELETE\s+FROM)\s+"
    r"(?:[`\"\[]?[A-Za-z_][A-Za-z0-9_]*[`\"\]]?\s*\.\s*)?"
    r"[`\"\[]?([A-Za-z_][A-Za-z0-9_]*)[`\"\]]?",
    re.IGNORECASE)

def written_tables(sql_path):
    """SQL が書き込む表名の集合(小文字)。★予約語の誤捕獲は捨てる。"""
    try:
        body = open(sql_path, encoding="utf-8", errors="replace").read()
    except OSError:
        return set()
    body = re.sub(r"--[^\n]*", "", body)
    found = set()
    for m in _WRITE_RE.finditer(body):
        t = m.group(1).lower()
        if t in NOT_TABLE_WORDS:
            continue
        found.add(t)
    return found


def writes_game_table(sql_path):
    return sorted(written_tables(sql_path) & set(GAME_TABLES))


def writes_app_table(sql_path):
    return sorted(written_tables(sql_path) & set(APP_TABLES))

frozen = {}
for line in open(FROZEN_PATH, encoding="utf-8"):
    line = line.strip()
    if line:
        num, layer = line.split()
        frozen[num] = layer

tables = load_tables(REUSE_PATH)
violations = []
rows = []

# (1) 健全性: migrations/ 直下より深い .sql は黙って未適用になる
deep = []
for dirpath, _dirnames, filenames in os.walk(MIG_DIR):
    if os.path.abspath(dirpath) == os.path.abspath(MIG_DIR):
        continue
    for fn in filenames:
        if fn.endswith(".sql"):
            deep.append(os.path.relpath(os.path.join(dirpath, fn), MIG_DIR))
for d in sorted(deep):
    violations.append("migrations/ の下位ディレクトリに .sql が在る: %s "
                      "(//go:embed migrations/*.sql は直下しか埋め込まない。★黙って未適用になる＝D-705)" % d)

names = sorted(fn for fn in os.listdir(MIG_DIR)
               if fn.endswith(".sql") and os.path.isfile(os.path.join(MIG_DIR, fn)))
if not names:
    print("ERROR: migrations/ に .sql が 1 件も見つからない(検査が空回りしている可能性)", file=sys.stderr)
    raise SystemExit(2)

seen_numbers = {}
for fn in names:
    rel = "migrations/" + fn
    lic = resolve(tables, rel)
    layer = LAYER_OF.get(lic)
    m = re.match(r"^(\d{6})_", fn)
    num = m.group(1) if m else None
    rows.append((fn, num, lic, layer))

    # (2) 完全性
    if lic is None:
        violations.append("宣言に当たらない: %s (REUSE.toml のどの [[annotations]] にも一致しない)" % rel)
        continue
    if layer is None:
        violations.append("未知のライセンスに解決した: %s -> %s" % (rel, lic))
        continue
    if num is None:
        violations.append("連番の形をしていない: %s" % rel)
        continue

    # (3) 凍結表との一致(凍結分のみ)
    if num in frozen:
        want = frozen[num]
        if layer != want:
            violations.append("規則(3) 凍結表と食い違う: %s は層 %s のはずだが層 %s(%s)に解決した" % (rel, want, layer, lic))
        seen_numbers.setdefault(num, set()).add(layer)

    # (4) 内容整合。★★凍結分にも評価する(M33-03)。
    #   ⇒ 着手時点は else 枝であり、9 本を全数凍結表へ入れた時点で 1 本も評価されなくなった。
    has_data = "_data_" in fn
    path = os.path.join(MIG_DIR, fn)
    if has_data:
        if layer != "B":
            violations.append("規則(4a) 命名規約と宣言が食い違う: %s は `_data_` を持つのに層 %s(%s)に解決した"
                              % (rel, layer, lic))
        # ★★書き込み先の検査(M33-03 で追加)。`_data_` を付けて層 A の表へ書くのを止める。
        app = writes_app_table(path)
        if app:
            violations.append("規則(4a) ★静かな漏れ: %s は層 A の表(%s)へ書くのに `_data_` を持ち層 B(CC-BY-SA)へ"
                              "解決している。⇒ `_data_` を外して層 A へ寄せること"
                              % (rel, ", ".join(app)))
    else:
        if layer != "A":
            violations.append("規則(4b) 命名規約と宣言が食い違う: %s は `_data_` を持たないのに層 %s(%s)に解決した"
                              % (rel, layer, lic))
        game = writes_game_table(path)
        if game:
            violations.append("規則(4b) ★静かな漏れ: %s はゲームデータ表(%s)へ書くのに `_data_` を持たず層 A(AGPL)へ落ちている。"
                              "⇒ 層 B なら `%s` へ改名すること"
                              % (rel, ", ".join(game), re.sub(r"^(\d{6})_", r"\1_data_", fn)))

# (3-b) 凍結表にあるのにファイルが無い(欠番と、消し忘れの取り違えを防ぐ)
for num in sorted(frozen):
    if num not in seen_numbers:
        violations.append("規則(3b) 凍結表に在るがファイルが無い: %s (欠番にしたなら凍結表からも外すこと)" % num)

# (5) 凍結 golden の層(★走査範囲を migrations/ の外へ広げる唯一の規則)
if GOLDEN_DIR and os.path.isdir(GOLDEN_DIR):
    gnames = sorted(fn for fn in os.listdir(GOLDEN_DIR)
                    if fn.endswith(".sql") and os.path.isfile(os.path.join(GOLDEN_DIR, fn)))
    if not gnames:
        print("ERROR: %s に .sql が 1 件も無い(規則 (5) が空回りしている可能性)" % GOLDEN_DIR,
              file=sys.stderr)
        raise SystemExit(2)
    for fn in gnames:
        rel = GOLDEN_REL + "/" + fn
        lic = resolve(tables, rel)
        layer = LAYER_OF.get(lic)
        rows.append((rel, None, lic, layer))
        if layer != "B":
            violations.append("規則(5) ★静かな漏れ: %s は層 B(CC-BY-SA)のはずだが層 %s(%s)に解決した。"
                              "⇒ character_data/*.csv 由来の生成物であり SF6 の事実を含む。"
                              "REUSE.toml の層 B へ本ディレクトリを足すこと"
                              % (rel, layer or "?", lic or "(未解決)"))

if MODE == "list":
    for fn, num, lic, layer in rows:
        if num is None:
            origin = "golden"
        elif num in frozen:
            origin = "凍結"
        else:
            origin = "新規"
        print("  %-6s %-8s %-20s %s" % (layer or "?", origin, lic or "(未解決)", fn))

for v in violations:
    print("NG  %s" % v)

print("__COUNT__%d" % len(violations))
raise SystemExit(1 if violations else 0)
PY

run_check() {  # $1=migrations dir  $2=REUSE.toml  $3=frozen file  $4=mode(check|list)
               # $5=golden dir(空可)  $6=golden の REUSE 解決用の相対パス
  python3 -c "$PY_CHECK" "$1" "$2" "$3" "$4" "${5:-}" "${6:-}"
}

# ---------------------------------------------------------------------------
# 自己検査(陽性対照・陰性対照)
# ---------------------------------------------------------------------------
self_test() {
  local tmp st_fail=0 out
  tmp="$(mktemp -d)" || { echo "ERROR: mktemp 失敗" >&2; exit 2; }
  # shellcheck disable=SC2064
  trap "rm -rf '$tmp'" EXIT

  echo "## 自己検査(陽性対照・陰性対照)"
  echo

  mkdir -p "$tmp/migrations"
  cat > "$tmp/frozen.txt" <<'EOF'
000001 A
000002 B
EOF
  # 凍結分の実体
  printf -- '-- ddl\nALTER TABLE combos ADD COLUMN x INTEGER;\n' > "$tmp/migrations/000001_add_x.up.sql"
  printf -- '-- seed\nINSERT INTO moves (code) VALUES (%s);\n' "'a'" > "$tmp/migrations/000002_data_seed_moves_a.up.sql"

  local BASE_TOML="$tmp/REUSE.toml"
  cat > "$BASE_TOML" <<'EOF'
version = 1
[[annotations]]
path = "**"
SPDX-License-Identifier = "AGPL-3.0-or-later"
[[annotations]]
path = ["migrations/*_data_*.sql", "migrations/000002_*.sql", "goldendir/**"]
SPDX-License-Identifier = "CC-BY-SA-4.0"
EOF

  # --- 陰性対照 1: 素の状態 -> 緑 ---
  if out="$(run_check "$tmp/migrations" "$BASE_TOML" "$tmp/frozen.txt" check 2>&1)"; then
    ok "陰性対照(素の状態) → 緑"
  else
    printf 'NG  陰性対照(素の状態)が赤になった\n%s\n' "$out"; st_fail=1
  fi

  # --- 陽性対照 1: ゲームデータ表へ書くのに `_data_` を持たない新規マイグレ -> 赤 ---
  #     ★書き方を 5 形すべて試す(2026-09-06 レビュー 高-2 の是正)。
  #       旧実装は `INSERT INTO` の 1 形しか試しておらず、`INSERT OR IGNORE INTO` を見逃していた。
  #       ★仮定の形ではない——migrations/000007 が実際に `INSERT OR IGNORE INTO` を使う。
  local form
  while IFS='|' read -r label stmt; do
    [ -n "$label" ] || continue
    printf -- '-- seed\n%s\n' "$stmt" > "$tmp/migrations/000003_seed_moves_b.up.sql"
    out="$(run_check "$tmp/migrations" "$BASE_TOML" "$tmp/frozen.txt" check 2>&1)"
    if [ $? -ne 0 ] && printf '%s' "$out" | grep -q '静かな漏れ'; then
      ok "陽性対照(\`_data_\` 無し・${label}) → 赤"
    else
      printf 'NG  陽性対照(`_data_` 無し・%s)が緑になった(検出漏れ)\n' "$label"; st_fail=1
    fi
    rm -f "$tmp/migrations/000003_seed_moves_b.up.sql"
  done <<'FORMS'
INSERT INTO|INSERT INTO moves (code) VALUES ('b');
INSERT OR IGNORE INTO|INSERT OR IGNORE INTO moves (code) VALUES ('b');
INSERT OR REPLACE INTO|INSERT OR REPLACE INTO moves (code) VALUES ('b');
REPLACE INTO|REPLACE INTO moves (code) VALUES ('b');
スキーマ修飾つき|INSERT INTO main.moves (code) VALUES ('b');
UPDATE|UPDATE moves SET code = 'b' WHERE id = 1;
FORMS

  # --- 陽性対照 2: 宣言に当たらないマイグレ(下位ディレクトリ配置) -> 赤 ---
  mkdir -p "$tmp/migrations/sub"
  printf -- '-- ddl\nALTER TABLE combos ADD COLUMN y INTEGER;\n' > "$tmp/migrations/sub/000004_add_y.up.sql"
  out="$(run_check "$tmp/migrations" "$BASE_TOML" "$tmp/frozen.txt" check 2>&1)"
  if [ $? -ne 0 ] && printf '%s' "$out" | grep -q '下位ディレクトリ'; then
    ok "陽性対照(migrations/ の下位ディレクトリに .sql) → 赤"
  else
    printf 'NG  陽性対照(下位ディレクトリの .sql)が緑になった(検出漏れ)\n'; st_fail=1
  fi
  rm -rf "$tmp/migrations/sub"

  # --- 陽性対照 3: 凍結表と宣言がずれた状態 -> 赤 ---
  cat > "$tmp/drift.toml" <<'EOF'
version = 1
[[annotations]]
path = "**"
SPDX-License-Identifier = "AGPL-3.0-or-later"
EOF
  out="$(run_check "$tmp/migrations" "$tmp/drift.toml" "$tmp/frozen.txt" check 2>&1)"
  if [ $? -ne 0 ] && printf '%s' "$out" | grep -q '凍結表と食い違う'; then
    ok "陽性対照(凍結表と宣言のずれ) → 赤"
  else
    printf 'NG  陽性対照(凍結表と宣言のずれ)が緑になった(検出漏れ)\n'; st_fail=1
  fi

  # --- 陽性対照 4: 凍結表に在るのにファイルが無い -> 赤 ---
  mv "$tmp/migrations/000002_data_seed_moves_a.up.sql" "$tmp/held.sql"
  out="$(run_check "$tmp/migrations" "$BASE_TOML" "$tmp/frozen.txt" check 2>&1)"
  if [ $? -ne 0 ] && printf '%s' "$out" | grep -q 'ファイルが無い'; then
    ok "陽性対照(凍結表に在るがファイルが無い) → 赤"
  else
    printf 'NG  陽性対照(凍結表に在るがファイルが無い)が緑になった(検出漏れ)\n'; st_fail=1
  fi
  mv "$tmp/held.sql" "$tmp/migrations/000002_data_seed_moves_a.up.sql"

  # --- 陽性対照 5: ★`_data_` を持つのに層 A の表へ書く -> 赤(M33-03 で塞いだ穴) ---
  #     ★★これが followup `migration-license-check-blind-to-write-target-when-data-named`
  #       そのものである。塞ぐ前は *違反 0 件のまま* 層 B へ解決していた
  #       (M33-02 が一時ファイル 000010_data_seed_probe_users.up.sql で EXIT=0 を実測)。
  printf -- '-- seed\nINSERT INTO users (id, name) VALUES (9, %s);\n' "'probe'" \
    > "$tmp/migrations/000004_data_seed_probe_users.up.sql"
  out="$(run_check "$tmp/migrations" "$BASE_TOML" "$tmp/frozen.txt" check 2>&1)"
  if [ $? -ne 0 ] && printf '%s' "$out" | grep -q '規則(4a) ★静かな漏れ'; then
    ok "陽性対照(\`_data_\` 持ちで層 A の表へ書く) → 赤・規則(4a)が赤くした"
  else
    printf 'NG  陽性対照(`_data_` 持ちで層 A の表へ書く)が緑になった(検出漏れ)\n%s\n' "$out"; st_fail=1
  fi
  rm -f "$tmp/migrations/000004_data_seed_probe_users.up.sql"

  # --- 陽性対照 6: ★凍結分にも規則 (4) が効くこと -> 赤(M33-03 の変更点) ---
  #     ★凍結の層 A 分(000001_add_x・`_data_` 無し)を、ゲームデータ表へ書く形へ差し替える。
  #       ⇒ 着手時点は `if num in frozen: (3) else: (4)` であり (4) へ入らず *緑* だった。
  #       ★これが「9 本を全数凍結表へ入れたら規則 (4) が空回りする」の対照そのものである。
  printf -- '-- ddl\nALTER TABLE combos ADD COLUMN x INTEGER;\nINSERT INTO moves (code) VALUES (%s);\n' "'x'" \
    > "$tmp/migrations/000001_add_x.up.sql"
  out="$(run_check "$tmp/migrations" "$BASE_TOML" "$tmp/frozen.txt" check 2>&1)"
  if [ $? -ne 0 ] && printf '%s' "$out" | grep -q '規則(4b) ★静かな漏れ'; then
    ok "陽性対照(凍結分がゲームデータ表へ書く) → 赤・規則(4b)が赤くした"
  else
    printf 'NG  陽性対照(凍結分への規則(4)評価)が効いていない\n%s\n' "$out"; st_fail=1
  fi
  printf -- '-- ddl\nALTER TABLE combos ADD COLUMN x INTEGER;\n' > "$tmp/migrations/000001_add_x.up.sql"

  # --- 陽性対照 7: ★凍結 golden が層 B へ解決しない -> 赤(規則 (5)) ---
  mkdir -p "$tmp/golden"
  printf -- '-- golden\nINSERT INTO moves (code) VALUES (%s);\n' "'y'" \
    > "$tmp/golden/000026_seed_moves_first_wave.up.sql"
  out="$(run_check "$tmp/migrations" "$BASE_TOML" "$tmp/frozen.txt" check "$tmp/golden" "not/declared/anywhere" 2>&1)"
  if [ $? -ne 0 ] && printf '%s' "$out" | grep -q '規則(5) ★静かな漏れ'; then
    ok "陽性対照(凍結 golden が層 A へ落ちる) → 赤・規則(5)が赤くした"
  else
    printf 'NG  陽性対照(規則(5))が緑になった(検出漏れ)\n%s\n' "$out"; st_fail=1
  fi

  # --- 陰性対照 3: ★凍結 golden が層 B へ解決する -> 緑 ---
  if out="$(run_check "$tmp/migrations" "$BASE_TOML" "$tmp/frozen.txt" check "$tmp/golden" "goldendir" 2>&1)"; then
    ok "陰性対照(凍結 golden が層 B へ解決) → 緑"
  else
    printf 'NG  陰性対照(規則(5))が赤になった\n%s\n' "$out"; st_fail=1
  fi
  rm -rf "$tmp/golden"

  # --- 陰性対照 2: 命名規約どおりの新規ゲームデータ seed -> 緑 ---
  printf -- '-- seed\nINSERT INTO moves (code) VALUES (%s);\n' "'c'" \
    > "$tmp/migrations/000005_data_seed_moves_c.up.sql"
  if out="$(run_check "$tmp/migrations" "$BASE_TOML" "$tmp/frozen.txt" check 2>&1)"; then
    ok "陰性対照(命名規約どおりの新規層 B) → 緑"
  else
    printf 'NG  陰性対照(命名規約どおりの新規層 B)が赤になった\n%s\n' "$out"; st_fail=1
  fi
  rm -f "$tmp/migrations/000005_data_seed_moves_c.up.sql"

  echo
  if [ "$st_fail" -eq 0 ]; then
    echo "自己検査: 合格(陽性は赤・陰性は緑)"
    return 0
  fi
  echo "自己検査: 不合格"
  return 1
}

ok()   { printf 'OK  %s\n' "$*"; }

# ---------------------------------------------------------------------------
# 入口
# ---------------------------------------------------------------------------
MODE="check"
case "${1:-}" in
  --self-test) self_test; exit $? ;;
  --list)      MODE="list" ;;
  "")          ;;
  *)           echo "ERROR: 不明な引数: $1" >&2; exit 2 ;;
esac

FROZEN_TMP="$(mktemp)" || exit 2
trap 'rm -f "$FROZEN_TMP"' EXIT
write_frozen "$FROZEN_TMP"

echo "# migrations/ ライセンス宣言の検査"
echo
echo "対象 commit: \`$(git rev-parse --short HEAD 2>/dev/null || echo unknown)\`"
echo "対象範囲: migrations/*.sql と REUSE.toml"
echo "凍結表: 層 A $(echo $FROZEN_A | wc -w) 本 / 層 B $(echo $FROZEN_B | wc -w) 本"
echo

out="$(run_check migrations REUSE.toml "$FROZEN_TMP" "$MODE" \
        internal/seedgen/testdata internal/seedgen/testdata 2>&1)"
rc=$?
count="$(printf '%s' "$out" | sed -n 's/^__COUNT__//p' | tail -1)"
printf '%s\n' "$out" | grep -v '^__COUNT__'

echo
if [ "$rc" -eq 2 ]; then
  echo "結果: 実行エラー(未実行。緑ではありません)"
  exit 2
fi
if [ "${count:-0}" -eq 0 ]; then
  echo "結果: 違反なし"
  exit 0
fi
echo "結果: 違反 ${count} 件"
echo "直し方: 層 B(ゲームデータ)なら連番の直後へ \`data_\` を挿入して改名する(例 NNNNNN_data_seed_moves_xxx.up.sql)。"
echo "        既存の凍結分を動かしてはならない(D-535)。全件の解決結果は --list で出る。"
exit 1

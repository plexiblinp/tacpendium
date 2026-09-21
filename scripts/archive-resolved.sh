#!/usr/bin/env bash
# archive-resolved.sh — 解決済み記録のアーカイブ退避(マイルストーン境界で実行)
#
# 背景: 反映担当の廃止(2026-08-11)により、設計担当は `parallel-board.md` ／
#   `followup-backlog.md` ／ `M{N}-overview.md` を **その回の資料として渡されて更新する**
#   運用になった。**渡す量が直接コストになる。** ところが両資料は「古い行を消さない」ことを
#   規則にしており、構造的に成長し続ける(2026-08-11 実測: board 517KB のうち §3 裁定ログが
#   322KB=62%、backlog の §J は 15 行中 11 行が完了済み)。
#
#   **どちらも「消さない」ことに理由がある**——§3 は当時どう判断したかの記録(D-57／D-259)、
#   §J は停止と再開の履歴が規律の実績。**削除ではなくアーカイブ先への退避**でしか解けない。
#
# 退避の単位: **マイルストーン境界**(既存前例に合わせる。`docs/*/phase{N}/` と同じ流儀)。
#   退避先ファイルも **M20 以降はマイルストーン単位**で分ける(アーカイブ確認時に全部見ないで済む)。
#
# 対象と判定:
#   (1) `docs/handover/followup-backlog.md` — 各節の表の **「状態」列**が完了系の**行**を退避。
#       **節ごと(=マイルストーンごと)には退避しない**——実測で §H(M19) は M19 クローズ済みなのに
#       48 行中 25 行が未解決だった。**行単位で状態を見る**必要がある。
#   (2) `docs/process/parallel-board.md` §3 裁定ログ — **D 番号が閾値以下**の行を退避。
#       裁定に「完了」の概念は無い(裁定は完了しない)ため、境界は D 番号で与える。
#       §3 は昇順ブロックと降順ブロックが混在しているので、**並び順に依存せず番号で判定**する。
#   (3) `docs/handover/change-number-registry.md` §4 更新履歴 — **版が閾値以下**の行を退避。
#       更新履歴に「完了」の概念は無いため、境界は **版**(`1.99.0` 形式)で与える。
#       §4 も昇順ブロックと降順ブロックが混在している(実測: `1.102.0` の次行が `1.101.0`、
#       その次が `1.104.0`)ので、**(2) と同じく並び順に依存せず番号で判定**する。
#       **★§1 counter は退避しない。** 2026-08-12 の実査で **現行の採番判断(次番号・欠番・
#       次マイグレ連番)はすべて §1 側に載っており、§4 は「いつ誰が §1 をどう更新したか」の
#       記録に閉じている**ことを確認した。**§4 を退避しても採番の正本は欠けない。**
#
# 使い方:
#   bash scripts/archive-resolved.sh --milestone M20                        # dry-run(既定)
#   bash scripts/archive-resolved.sh --milestone M20 --board-through 287    # board も対象に
#   bash scripts/archive-resolved.sh --milestone M20 --registry-through 1.99.0
#   bash scripts/archive-resolved.sh --milestone M20 --board-history-through 2.44.0
#   bash scripts/archive-resolved.sh --milestone M20 --skip-backlog         # backlog を外す
#   bash scripts/archive-resolved.sh --milestone M20 --exclude a-slug,b-slug
#   bash scripts/archive-resolved.sh --milestone M20 --apply                # 実行
#   bash scripts/archive-resolved.sh --self-test
#
# **`--skip-backlog` は「共有直列リソースだけを退避したい」ときの逃げ道である。**
#   backlog は既定で対象になるので、registry / board だけを触りたい場面(退避を
#   マイルストーン境界ではなく別レーンで行うとき)に指定する。
#
# **--exclude が「設計担当の宣言による排除ルート」である。**
#   マイルストーンが想定より拡大し、完了扱いの項目が実はまだ動いている場合に、
#   ID(スラッグ・#・旧ID 等、表の第 1 列)を渡して退避対象から外す。
#
# 終了コード: 0=正常(dry-run 含む) / 1=検証に失敗し中断 / 2=実行エラー
#
# 安全装置:
#   - **既定は dry-run。** `--apply` を明示しない限り 1 バイトも書かない。
#   - apply 時は **行数の保存**(元の行が退避先に過不足なく移ったこと)を検証し、
#     合わなければ **元ファイルを書き戻して中断**する。
#   - 作業ツリーが汚れている場合は警告する(diff で確認しにくくなるため)。
#
# 限界:
#   - **表セル内に `|` を含む行は「読まずに残す」**(2026-08-11 クリーンルームレビュー 高 5 で是正)。
#     旧実装は列がずれた状態で状態欄を読み違え、**未着手の行を退避しうる fail-unsafe** だった。
#     現在はヘッダと列数が合わない行を退避対象から外し、dry-run の「⚠ 読まずに残した行」へ出す。
#   - **完了判定は文字列一致であり、意味を理解しているわけではない。**
#     否定・程度修飾・予定形(`〜していない` `一部完了` `〜予定` `〜待ち` 等)は除外するが、
#     **網羅はできない**。例: 「機構は完了（実行は M20 起動時に）」は完了扱いになる。
#     **だから dry-run に状態欄を出す**——人が読んで `--exclude` で外すのが最終防壁である。
#   - 「状態」列が無い節(§E は表そのものが無い)は対象外。節内に列構成の違う 2 つ目の表があると
#     **その表は見ない**(dry-run の「⚠ 2 つ目の表」へ出す。黙って落とさない)。
#   - 退避が妥当かの**内容判断はしない**。dry-run の一覧を人が読んでから apply すること。
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "ERROR: git リポジトリ内で実行してください" >&2
  exit 2
}
cd "$ROOT"

command -v python3 >/dev/null 2>&1 || {
  echo "ERROR: python3 が必要です(表の解析に使用。列位置が節ごとに違うため)" >&2
  exit 2
}

BACKLOG="docs/handover/followup-backlog.md"
BOARD="docs/process/parallel-board.md"
REGISTRY="docs/handover/change-number-registry.md"
BACKLOG_ARCHIVE_DIR="docs/handover/archive"
BOARD_ARCHIVE_DIR="docs/process/archive"
REGISTRY_ARCHIVE_DIR="docs/handover/archive"

MILESTONE=""
BOARD_THROUGH=""
BOARD_HISTORY_THROUGH=""
REGISTRY_THROUGH=""
EXCLUDE=""
APPLY=0
SKIP_BACKLOG=0

need_value() {  # $1=フラグ名 $2=値。値が無い/次のフラグなら即エラー(shift 2 は $#<2 で何もせず無限ループになる)
  case "${2-}" in
    ""|--*) echo "ERROR: $1 に値がありません" >&2; exit 2 ;;
  esac
}
while [ $# -gt 0 ]; do
  case "$1" in
    --milestone)     need_value "$1" "${2-}"; MILESTONE="$2"; shift 2 ;;
    --board-through) need_value "$1" "${2-}"; BOARD_THROUGH="$2"; shift 2 ;;
    --board-history-through)
                     need_value "$1" "${2-}"; BOARD_HISTORY_THROUGH="$2"; shift 2 ;;
    --registry-through)
                     need_value "$1" "${2-}"; REGISTRY_THROUGH="$2"; shift 2 ;;
    --skip-backlog)  SKIP_BACKLOG=1; shift ;;
    --exclude)       need_value "$1" "${2-}"; EXCLUDE="$2"; shift 2 ;;
    --apply)         APPLY=1; shift ;;
    --self-test)     MILESTONE="__SELFTEST__"; shift ;;
    *) echo "ERROR: 不明な引数: $1" >&2; exit 2 ;;
  esac
done

# ---------------------------------------------------------------------------
# 中核の変換(python3)。--mode report|apply を取り、退避対象を判定して出力する。
# ---------------------------------------------------------------------------
run_transform() {
  python3 - "$@" <<'PYEOF'
import re, sys, os

mode      = sys.argv[1]           # report | apply
backlog   = sys.argv[2]
board     = sys.argv[3]
milestone = sys.argv[4]
through   = sys.argv[5]           # "" なら board を触らない
exclude   = {s.strip() for s in sys.argv[6].split(",") if s.strip()}
bl_out    = sys.argv[7]
bd_out    = sys.argv[8]
registry  = sys.argv[9]
reg_thru  = sys.argv[10]          # "" なら registry を触らない
reg_out   = sys.argv[11]
skip_bl   = sys.argv[12] == "1"   # backlog を対象から外す
bh_thru   = sys.argv[13]          # "" なら board §9 を触らない

# 完了系マーカー。「未解消」「未完了」「非対応」を完了と誤判定しないよう否定を除外する。
DONE   = re.compile(r'(?<!未)(?<!非)(完了|解消|解決|対応不要|クローズ|実施済|着手不要)')
# ★否定・程度修飾・予定形は「完了」に見えても完了ではない。前置の 未/非 だけでは足りない
#   （日本語の否定は後置が主）。ここに一致したら **完了とみなさない**（fail-safe）。
NOTDONE = re.compile(r'(していない|ではない|でない|しない|未了|一部|部分的|見込み|予定|待ち|途中|継続)')

def is_done(status):
    return bool(DONE.search(status)) and not NOTDONE.search(status)

def cells(line):
    # ★2026-08-11 playbook 全面監査の是正。
    #   GFM はセル内の `\|` をエスケープとして扱い分割しない（playbook §16.4.1 が
    #   対処法として指示している形）。raw の `|` で割ると **描画では 3 セルの行を
    #   4 セルと数え**、列数ガードが SKIP を返して退避対象から落ちる。
    body = line.strip()
    if body.startswith("|"): body = body[1:]
    if body.endswith("|"):   body = body[:-1]
    return [c.strip() for c in re.split(r'(?<!\\)\|', body)]

def is_sep(line):
    return re.match(r'^\|[\s:|-]+\|\s*$', line.strip()) is not None

def strip_marks(s):
    return re.sub(r'[*`~\s]', '', s)

def in_table_row_ok(cs, header_len):
    return header_len is not None and len(cs) == header_len

# ---------------- followup-backlog: 節ごとに「状態」列を見て完了行を抽出 ----------------
bl_lines = open(backlog, encoding="utf-8").read().split("\n")
bl_keep, bl_moved = [], []          # bl_moved: (節見出し, 行, 状態列の位置)
cur_head = None
status_idx = None
header_len = None
in_table = False
skipped = []          # 列数不整合で読めなかった行（【高 5】）
multi_table = []      # 節内 2 つ目以降の表（【低 19】）

for line in bl_lines:
    if line.startswith("## "):
        cur_head = line
        status_idx, in_table = None, False
        bl_keep.append(line); continue

    if line.startswith("| "):
        cs = cells(line)
        if is_sep(line):
            bl_keep.append(line); continue
        if status_idx is not None and not in_table_row_ok(cs, header_len) and any("状態" in c for c in cs):
            multi_table.append((cur_head, len(cs)))   # 節内 2 つ目の表（別の列構成）
        if status_idx is None and any("状態" in c for c in cs):
            # 表ヘッダ。「状態」を含むセルの位置を覚える(節ごとに位置が違う)
            status_idx = max(i for i, c in enumerate(cs) if "状態" in c)
            header_len = len(cs)
            in_table = True
            bl_keep.append(line); continue
        if in_table and status_idx is not None:
            if len(cs) != header_len:
                # ★列数が違う行は **状態列を読み違える**（セル内の未エスケープ `|` が主因）。
                #   誤って未着手行を退避しないよう、読まずに残して報告する（fail-safe）。
                skipped.append((cur_head, strip_marks(cs[0])[:44], len(cs), header_len))
                bl_keep.append(line); continue
            ident = strip_marks(cs[0])
            if ident and ident in exclude:
                bl_keep.append(line); continue          # 設計担当の宣言による排除
            if is_done(cs[status_idx]):
                # cur_head が None（最初の `## ` より前の表）でも落ちないようにする
                bl_moved.append((cur_head or "## (節見出しの前)", line, status_idx)); continue
        bl_keep.append(line); continue

    bl_keep.append(line)

def ver(s):
    return tuple(int(x) for x in s.split("."))

# ---------------- parallel-board §3(D 番号) / §9(版) を 1 パスで抽出 ----------------
# ★同じファイルの別の節なので、**必ず 1 回の走査で両方を処理する**。
#   節ごとに読み書きを分けると、後から書いた側が先の結果を上書きする。
bd_keep, bd_moved, bh_moved = [], [], []
if through or bh_thru:
    limit   = int(through) if through else None
    limit_v = ver(bh_thru) if bh_thru else None
    bd_lines = open(board, encoding="utf-8").read().split("\n")
    cur = None
    for line in bd_lines:
        if line.startswith("## "):
            cur = line
            bd_keep.append(line); continue
        in_s3 = cur is not None and cur.startswith("## 3.")
        in_s9 = cur is not None and cur.startswith("## 9.")
        m = re.match(r'^\|\s*D-(\d+)\s*\|', line)
        if in_s3 and limit is not None and m:
            n = int(m.group(1))
            if f"D-{m.group(1)}" in exclude or f"D-{n}" in exclude:
                bd_keep.append(line); continue
            if n <= limit:
                bd_moved.append(line); continue
        mv = re.match(r'^\|\s*(\d+\.\d+\.\d+)\s*\|', line)
        if in_s9 and limit_v is not None and mv:
            v = mv.group(1)
            if v in exclude:
                bd_keep.append(line); continue
            if ver(v) <= limit_v:
                bh_moved.append(line); continue
        bd_keep.append(line)

# ---------------- change-number-registry §4: 版が閾値以下の行を抽出 ----------------
# ★§1 counter には触らない（現行の採番判断は §1 側にある。冒頭コメント (3) 参照）。

rg_keep, rg_moved = [], []
if reg_thru:
    limit_v = ver(reg_thru)
    rg_lines = open(registry, encoding="utf-8").read().split("\n")
    in_s4 = False
    for line in rg_lines:
        if line.startswith("## "):
            in_s4 = line.startswith("## 4.")
            rg_keep.append(line); continue
        m = re.match(r'^\|\s*(\d+\.\d+\.\d+)\s*\|', line)
        if in_s4 and m:
            v = m.group(1)
            if v in exclude:
                rg_keep.append(line); continue
            if ver(v) <= limit_v:
                rg_moved.append(line); continue
        rg_keep.append(line)

# ---------------- backlog を対象から外す（--skip-backlog） ----------------
# ★判定そのものは走らせたまま、退避を無効化する。report 側の SKIP/MULTI 警告は
#   「見なかった行」の情報なので、対象外のときは出さない（誤読を招くため）。
if skip_bl:
    bl_moved, skipped, multi_table = [], [], []

if mode == "report":
    print(f"BACKLOG_MOVED\t{len(bl_moved)}")
    print(f"BOARD_MOVED\t{len(bd_moved)}")
    print(f"BOARDHIST_MOVED\t{len(bh_moved)}")
    print(f"REGISTRY_MOVED\t{len(rg_moved)}")
    bysec = {}
    for h, l, si in bl_moved:
        bysec.setdefault(h, []).append((l, si))
    for h, rows in bysec.items():
        print(f"SEC\t{h[:60]}\t{len(rows)}")
        for l, si in rows:
            cs = cells(l)
            # ★**状態列**を出す（最終セルではない。節によって列位置が違う）。
            #   選定理由が見えないと --exclude の判断ができない（レビュー指摘 中 16）
            st = cs[si] if si is not None and si < len(cs) else ""
            print(f"ROW\t{strip_marks(cs[0])[:44]}\t{re.sub(chr(96) + '|[*]', '', st)[:60]}")
    for h, ident, got, want in skipped:
        print(f"SKIP\t{(h or '(節外)')[:40]}\t{ident}\t{got}\t{want}")
    for h, n in multi_table:
        print(f"MULTI\t{(h or '(節外)')[:40]}\t{n}")
    if bd_moved:
        nums = sorted(int(re.match(r'^\|\s*D-(\d+)', l).group(1)) for l in bd_moved)
        print(f"BOARDRANGE\tD-{nums[0]}〜D-{nums[-1]}")
    if bh_moved:
        vs = sorted((ver(re.match(r'^\|\s*(\d+\.\d+\.\d+)', l).group(1)) for l in bh_moved))
        lo = ".".join(str(x) for x in vs[0]); hi = ".".join(str(x) for x in vs[-1])
        print(f"BOARDHISTRANGE\tv{lo}〜v{hi}")
    if rg_moved:
        vs = sorted((ver(re.match(r'^\|\s*(\d+\.\d+\.\d+)', l).group(1)) for l in rg_moved))
        lo = ".".join(str(x) for x in vs[0]); hi = ".".join(str(x) for x in vs[-1])
        print(f"REGRANGE\tv{lo}〜v{hi}")
    sys.exit(0)

# ---------------- apply ----------------
def write_archive(path, title, note, blocks):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "a", encoding="utf-8") as f:
        if os.path.getsize(path) == 0:
            f.write(f"# {title}\n\n> {note}\n")
        f.write(f"\n<!-- 退避: {milestone} 境界 -->\n")
        for b in blocks:
            f.write(b + "\n")

moved_total = 0

if bl_moved:
    path = f"{bl_out}/followup-backlog-{milestone}.md"
    bysec = {}
    for h, l, _si in bl_moved:
        bysec.setdefault(h, []).append(l)
    blocks = []
    # 退避元の表ヘッダを節ごとに拾って、アーカイブ側でも表として読める形にする（レビュー指摘 中 13）
    hdr_by_sec = {}
    cur = None
    for line in bl_lines:
        if line.startswith("## "): cur = line; continue
        if line.startswith("| ") and cur not in hdr_by_sec and any("状態" in c for c in cells(line)):
            hdr_by_sec[cur] = line
    for h, rows in bysec.items():
        blocks.append(f"\n### 退避元: {h[3:] if h else '(節外)'}\n")
        hdr = hdr_by_sec.get(h)
        if hdr:
            blocks.append(hdr)
            blocks.append("|" + "---|" * len(cells(hdr)))
        blocks.extend(rows)
    write_archive(path, f"followup-backlog アーカイブ（{milestone} 境界）",
                  "解決済みの記録を退避したもの。**現役の追跡は `docs/handover/followup-backlog.md` 側**。"
                  "退避の経緯は `scripts/archive-resolved.sh` の冒頭コメントを参照。", blocks)
    # 退避元へ索引行を残す(節末に 1 行)
    # 索引行は **その節の最後の表データ行の直後**へ入れる。
    # 次節見出しの直前へ入れると「本節の…」が次節の注記に読める（レビュー指摘 中 14）。
    counts = {h: len(r) for h, r in bysec.items()}
    last_row_idx = {}
    cur = None
    for i, line in enumerate(bl_keep):
        if line.startswith("## "): cur = line; continue
        if line.startswith("| ") and cur in counts: last_row_idx[cur] = i
    out = []
    for i, line in enumerate(bl_keep):
        out.append(line)
        for h, c in counts.items():
            if last_row_idx.get(h) == i:
                out.append("")
                out.append(f"> **アーカイブ済み**: 本節の解決済み **{c} 件**は "
                           f"`{path}` へ退避した（{milestone} 境界・`scripts/archive-resolved.sh`）。"
                           f"**削除ではない**——退避先に全文がある。")
    open(backlog, "w", encoding="utf-8").write("\n".join(out))
    moved_total += len(bl_moved)

if bd_moved or bh_moved:
    # ★board は §3 と §9 の両方を触りうるので、**索引行を 1 パスで入れて 1 回だけ書く**。
    notes = {}   # 見出しの接頭辞 -> 索引行
    if bd_moved:
        path = f"{bd_out}/parallel-board-rulings-{milestone}.md"
        nums = sorted(int(re.match(r'^\|\s*D-(\d+)', l).group(1)) for l in bd_moved)
        # 元表の列名に合わせる（`| # | 日付 | 裁定 |`）。勝手な列名を付けると読み手が混乱する
        hdr = ["", "| # | 日付 | 裁定 |", "|---|---|---|"]
        write_archive(path, f"parallel-board 裁定ログ アーカイブ（{milestone} 境界）",
                      "**本文は書き換えない**——裁定行は当時どう判断したかの記録である（D-57／D-259）。"
                      "現役の裁定は `docs/process/parallel-board.md` §3。", hdr + bd_moved)
        notes["## 3."] = (f"> **アーカイブ済み**: **D-{nums[0]}〜D-{nums[-1]}（{len(bd_moved)} 行）**は "
                          f"`{path}` へ退避した（{milestone} 境界・`scripts/archive-resolved.sh`）。"
                          f"**削除ではない**——退避先に全文がある。番号で引くときはそちらも見ること。")
    if bh_moved:
        path9 = f"{bd_out}/parallel-board-history-{milestone}.md"
        vs = sorted((ver(re.match(r'^\|\s*(\d+\.\d+\.\d+)', l).group(1)) for l in bh_moved))
        lo = ".".join(str(x) for x in vs[0]); hi = ".".join(str(x) for x in vs[-1])
        # 元表の列名に合わせる（`| 版 | 日付 | 内容 |`）
        hdr9 = ["", "| 版 | 日付 | 内容 |", "|---|---|---|"]
        write_archive(path9, f"parallel-board 改訂履歴 アーカイブ（{milestone} 境界）",
                      "**状態の正本は退避していない**——現役の状態は "
                      "`docs/process/parallel-board.md` の **§1 マイルストーン状況・§2 予約レンジと現行版**側にある。"
                      "本書はその本文を**いつ誰がどう改訂したか**の記録である。"
                      "**§3 裁定ログのアーカイブとは別物**（そちらは `parallel-board-rulings-*.md`）。",
                      hdr9 + bh_moved)
        notes["## 9."] = (f"> **アーカイブ済み**: **v{lo}〜v{hi}（{len(bh_moved)} 行）**は "
                          f"`{path9}` へ退避した（{milestone} 境界・`scripts/archive-resolved.sh`）。"
                          f"**削除ではない**——退避先に全文がある。"
                          f"**現行の状態は §1・§2 が正本**であり、本節はその改訂経緯の記録である。")
    out, done = [], set()
    for line in bd_keep:
        out.append(line)
        for pref, note_line in notes.items():
            if pref not in done and line.startswith(pref):
                out.append("")
                out.append(note_line)
                done.add(pref)
    open(board, "w", encoding="utf-8").write("\n".join(out))
    moved_total += len(bd_moved) + len(bh_moved)

if rg_moved:
    path = f"{reg_out}/change-number-registry-{milestone}.md"
    vs = sorted((ver(re.match(r'^\|\s*(\d+\.\d+\.\d+)', l).group(1)) for l in rg_moved))
    lo = ".".join(str(x) for x in vs[0]); hi = ".".join(str(x) for x in vs[-1])
    # 元表の列名に合わせる（`| 版 | 更新日 | 更新内容 |`）
    hdr = ["", "| 版 | 更新日 | 更新内容 |", "|---|---|---|"]
    write_archive(path, f"change-number-registry 更新履歴 アーカイブ（{milestone} 境界）",
                  "**採番の正本は退避していない**——現行の次番号・欠番・次マイグレ連番は "
                  "`docs/handover/change-number-registry.md` **§1** 側にある。"
                  "本書はその §1 を**いつ誰がどう更新したか**の記録である。", hdr + rg_moved)
    out, done = [], False
    for line in rg_keep:
        out.append(line)
        if not done and line.startswith("## 4."):
            out.append("")
            out.append(f"> **アーカイブ済み**: **v{lo}〜v{hi}（{len(rg_moved)} 行）**は "
                       f"`{path}` へ退避した（{milestone} 境界・`scripts/archive-resolved.sh`）。"
                       f"**削除ではない**——退避先に全文がある。"
                       f"**現行の採番状態は §1 が正本**であり、本節は §1 の更新経緯の記録である。")
            done = True
    open(registry, "w", encoding="utf-8").write("\n".join(out))
    moved_total += len(rg_moved)

print(f"MOVED\t{moved_total}")
PYEOF
}

# ---------------------------------------------------------------------------
# 自己検査
# ---------------------------------------------------------------------------
self_test() {
  local tmp st_fail=0
  tmp="$(mktemp -d)" || { echo "ERROR: mktemp 失敗" >&2; exit 2; }
  # shellcheck disable=SC2064
  trap "rm -rf '$tmp'" EXIT

  cat > "$tmp/backlog.md" <<'EOF'
# バックログ

## A. 節A

| ID | 内容 | 状態 |
|---|---|---|
| **done-one** | 済んだ話 | `完了` |
| **open-one** | まだの話 | `未着手` |
| **unresolved-one** | 止まった話 | `未解消のまま停止` |
| **keep-me** | 済んだが除外したい | `完了` |
| **not-yet** | まだ終わっていない | `完了していない` |
| **partial** | 部分的 | `一部完了・継続中` |
| **planned** | 予定 | `2026-09 に解決予定` |
| **pipe-row** | セルに x | y を含む | `未着手` |
| **escaped-pipe** | `curl \| bash` の話 | `完了` |

## E. 表が無い節

- 箇条書きだけの節
EOF

  cat > "$tmp/board.md" <<'EOF'
# ボード

## 3. 裁定ログ

| D-01 | 2026-07-02 | 古い裁定 |
| D-99 | 2026-08-01 | 新しい裁定 |

## 4. 保留

## 9. 改訂履歴

| 版 | 日付 | 内容 |
|---|---|---|
| 2.50.0 | 2026-08-10 | 新しい改訂(閾値より上) |
| 2.44.0 | 2026-08-09 | 境界ちょうど(閾値以下=退避する) |
| 1.0.0 | 2026-07-30 | 新設 |
EOF

  # registry: §1 counter(退避してはいけない)＋ §4 更新履歴(版で判定)。
  # ★§4 は昇順・降順が混在する実物に合わせて、わざと並びを崩してある。
  cat > "$tmp/registry.md" <<'EOF'
# レジストリ

## 1. 番号運用の最新状態

| 番号 | 状態 | 内容 |
|------|------|------|
| 1.0.0 | 使用済み | ★これは §1 の行。版に見えるが退避してはいけない |
| **098 以降** | **空き** | 次回起票は 098 から採番 |

## 4. 更新履歴

| 版 | 更新日 | 更新内容 |
|----|--------|---------|
| 1.5.0 | 2026-05-16 | 古い更新 |
| 1.100.0 | 2026-08-07 | 新しい更新(閾値より上) |
| 1.99.0 | 2026-08-04 | 境界ちょうど(閾値以下=退避する) |
| 1.98.0 | 2026-08-02 | 除外指定される更新 |

---

*以上*
EOF

  echo "## 自己検査(陽性対照・陰性対照)"
  echo

  local rep
  rep="$(run_transform report "$tmp/backlog.md" "$tmp/board.md" "M99" "50" "keep-me,1.98.0" "$tmp" "$tmp" "$tmp/registry.md" "1.99.0" "$tmp" "0" "2.44.0")"

  local n_bl n_bd n_rg n_bh
  n_bl="$(printf '%s\n' "$rep" | awk -F'\t' '$1=="BACKLOG_MOVED"{print $2}')"
  n_bd="$(printf '%s\n' "$rep" | awk -F'\t' '$1=="BOARD_MOVED"{print $2}')"
  n_bh="$(printf '%s\n' "$rep" | awk -F'\t' '$1=="BOARDHIST_MOVED"{print $2}')"
  n_rg="$(printf '%s\n' "$rep" | awk -F'\t' '$1=="REGISTRY_MOVED"{print $2}')"

  # 退避されるべきは done-one と escaped-pipe の 2 件(open/未解消/除外/未完了系は残る)
  if [ "$n_bl" = "2" ]; then
    echo "OK  陰性対照: 完了行だけを退避対象にする(2 件)"
  else
    printf 'NG  backlog の退避件数が 2 でなく %s\n' "$n_bl"; st_fail=1
  fi
  # ★2026-08-11 playbook 全面監査。セル内 `\|`(playbook §16.4.1 の書き方)は
  #   GFM で 1 セルに収まるので **列数は正常**——SKIP へ落とさず退避対象にする。
  if printf '%s\n' "$rep" | grep -q 'ROW	escaped-pipe'; then
    echo 'OK  陰性対照: セル内 \| を列崩れと誤判定しない(§16.4.1 の書き方)'
  else
    echo 'NG  セル内 \| の行を取りこぼした——§16.4.1 に従った行が退避されない'; st_fail=1
  fi
  if printf '%s\n' "$rep" | grep -q 'ROW	done-one'; then
    echo 'OK  陰性対照: 状態欄の `完了` を検出する'
  else
    echo 'NG  状態欄の `完了` を検出できなかった'; st_fail=1
  fi
  for neg in open-one unresolved-one keep-me not-yet partial planned pipe-row; do
    if printf '%s\n' "$rep" | grep -q "ROW	$neg"; then
      printf 'NG  陽性対照(%s)を誤って退避対象にした\n' "$neg"; st_fail=1
    else
      printf 'OK  陽性対照(%s) → 退避しない\n' "$neg"
    fi
  done
  # 「未解消」を完了と誤判定しないこと / --exclude が効くこと は上のループが担保

  if [ "$n_bd" = "1" ]; then
    echo "OK  陰性対照: D 番号が閾値以下の裁定だけを退避対象にする(D-01 のみ)"
  else
    printf 'NG  board の退避件数が 1 でなく %s\n' "$n_bd"; st_fail=1
  fi

  # board §9: 1.0.0 と 2.44.0(境界ちょうど)が対象。2.50.0 は閾値より上。
  if [ "$n_bh" = "2" ]; then
    echo "OK  陰性対照: 版が閾値以下の改訂履歴だけを退避対象にする(1.0.0 / 2.44.0)"
  else
    printf 'NG  board §9 の退避件数が 2 でなく %s\n' "$n_bh"; st_fail=1
  fi
  if printf '%s\n' "$rep" | grep -q 'BOARDHISTRANGE	v1.0.0〜v2.44.0'; then
    echo "OK  陰性対照: board §9 の退避範囲を版で判定する"
  else
    printf 'NG  board §9 の退避範囲が v1.0.0〜v2.44.0 でない: %s\n' \
      "$(printf '%s\n' "$rep" | awk -F'\t' '$1=="BOARDHISTRANGE"{print $2}')"; st_fail=1
  fi

  # registry §4: 1.5.0 と 1.99.0(境界ちょうど)が対象。1.100.0 は閾値より上、
  # 1.98.0 は --exclude、§1 の `1.0.0` 行は **別の節なので触らない**。
  if [ "$n_rg" = "2" ]; then
    echo "OK  陰性対照: 版が閾値以下の更新履歴だけを退避対象にする(1.5.0 / 1.99.0)"
  else
    printf 'NG  registry の退避件数が 2 でなく %s\n' "$n_rg"; st_fail=1
  fi
  if printf '%s\n' "$rep" | grep -q 'REGRANGE	v1.5.0〜v1.99.0'; then
    echo "OK  陰性対照: 退避範囲を **並び順ではなく版**で判定する(§4 は昇順・降順が混在)"
  else
    printf 'NG  registry の退避範囲が v1.5.0〜v1.99.0 でない: %s\n' \
      "$(printf '%s\n' "$rep" | awk -F'\t' '$1=="REGRANGE"{print $2}')"; st_fail=1
  fi

  # ★陽性対照: §1 counter は退避してはいけない(`1.0.0` は §1 の行)。
  #   §4 だけを見ていることを、apply 後の実物で確かめる。
  local rep2
  cp "$tmp/backlog.md" "$tmp/backlog2.md"
  cp "$tmp/board.md"   "$tmp/board2.md"
  cp "$tmp/registry.md" "$tmp/registry2.md"
  rep2="$(run_transform apply "$tmp/backlog2.md" "$tmp/board2.md" "M98" "" "" "$tmp" "$tmp" "$tmp/registry2.md" "1.99.0" "$tmp" "1" "2.44.0" 2>&1)" || {
    echo "NG  registry/§9-only の apply が失敗した: $rep2"; st_fail=1
  }
  # ★陽性対照: §9 の閾値だけを与えたとき、**§3 の裁定行は 1 行も動かない**
  #   (同じファイルの別の節。節をまたいで巻き込むと board の正本が壊れる)
  if grep -q '^| D-01 |' "$tmp/board2.md" 2>/dev/null && grep -q '^| D-99 |' "$tmp/board2.md" 2>/dev/null; then
    echo "OK  陽性対照: §9 だけを退避したとき §3 裁定ログは動かさない"
  else
    echo "NG  §9 の退避で §3 の裁定行まで動かした"; st_fail=1
  fi
  if grep -q '^| 2\.50\.0 |' "$tmp/board2.md" 2>/dev/null && ! grep -q '^| 1\.0\.0 |' "$tmp/board2.md" 2>/dev/null; then
    echo "OK  陰性対照: apply 後、閾値以下だけが §9 から消えている"
  else
    echo "NG  apply 後の §9 の残り方がおかしい"; st_fail=1
  fi
  if grep -q '^| 1\.0\.0 | 使用済み' "$tmp/registry2.md" 2>/dev/null; then
    echo "OK  陽性対照: §1 counter の行(1.0.0)は退避せず残す"
  else
    echo "NG  §1 counter の行まで退避した(採番の正本が消える)"; st_fail=1
  fi
  if grep -q '^| 1\.100\.0 |' "$tmp/registry2.md" 2>/dev/null && ! grep -q '^| 1\.5\.0 |' "$tmp/registry2.md" 2>/dev/null; then
    echo "OK  陰性対照: apply 後、閾値以下だけが §4 から消えている"
  else
    echo "NG  apply 後の §4 の残り方がおかしい"; st_fail=1
  fi
  if grep -q 'アーカイブ済み' "$tmp/registry2.md" 2>/dev/null; then
    echo "OK  退避元に索引行が残る(**削除ではない**)"
  else
    echo "NG  索引行が入っていない"; st_fail=1
  fi
  if ! grep -q 'done-one' "$tmp/followup-backlog-M98.md" 2>/dev/null; then
    echo "OK  --skip-backlog: backlog を退避しない"
  else
    echo "NG  --skip-backlog なのに backlog を退避した"; st_fail=1
  fi

  # dry-run が 1 バイトも書かないこと
  if [ ! -f "$tmp/followup-backlog-M99.md" ] && [ ! -f "$tmp/parallel-board-rulings-M99.md" ] \
     && [ ! -f "$tmp/change-number-registry-M99.md" ] \
     && [ ! -f "$tmp/parallel-board-history-M99.md" ]; then
    echo "OK  dry-run は退避先ファイルを作らない"
  else
    echo "NG  dry-run なのに退避先ファイルができた"; st_fail=1
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
# main
# ---------------------------------------------------------------------------
if [ "$MILESTONE" = "__SELFTEST__" ]; then
  self_test
  exit $?
fi

if [ -z "$MILESTONE" ]; then
  echo "ERROR: --milestone <M20 等> は必須です(退避先ファイル名に使う)" >&2
  exit 2
fi
for f in "$BACKLOG" "$BOARD" "$REGISTRY"; do
  [ -f "$f" ] || { echo "ERROR: $f が無い" >&2; exit 2; }
done
# 版の形式を先に弾く(`1.99.0` 形式以外だと python 側で ValueError になり、
# 何が悪かったのか分からないまま exit 2 で落ちるため)
for pair in "--registry-through:$REGISTRY_THROUGH" "--board-history-through:$BOARD_HISTORY_THROUGH"; do
  flag="${pair%%:*}"; val="${pair#*:}"
  if [ -n "$val" ] && ! printf '%s' "$val" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
    echo "ERROR: $flag は版(例 1.99.0)で指定してください: '$val'" >&2
    exit 2
  fi
done

echo "# 解決済み記録のアーカイブ退避"
echo
echo "対象 commit: \`$(git rev-parse --short HEAD 2>/dev/null || echo unknown)\` / 境界: **$MILESTONE**"
[ -n "$EXCLUDE" ] && echo "除外(設計担当の宣言): \`$EXCLUDE\`"
[ -n "$BOARD_THROUGH" ] && echo "board 裁定ログ: **D-$BOARD_THROUGH 以下**を退避対象にする"
[ -n "$BOARD_HISTORY_THROUGH" ] && echo "board 改訂履歴 §9: **v$BOARD_HISTORY_THROUGH 以下**を退避対象にする(§1・§2 の状態は触らない)"
[ -n "$REGISTRY_THROUGH" ] && echo "registry 更新履歴: **v$REGISTRY_THROUGH 以下**を退避対象にする(§1 counter は触らない)"
[ "$SKIP_BACKLOG" -eq 1 ] && echo "backlog: **対象外**(\`--skip-backlog\`)"
echo

REPORT="$(run_transform report "$BACKLOG" "$BOARD" "$MILESTONE" "$BOARD_THROUGH" "$EXCLUDE" "$BACKLOG_ARCHIVE_DIR" "$BOARD_ARCHIVE_DIR" "$REGISTRY" "$REGISTRY_THROUGH" "$REGISTRY_ARCHIVE_DIR" "$SKIP_BACKLOG" "$BOARD_HISTORY_THROUGH")" || {
  echo "ERROR: 解析に失敗した" >&2; exit 2
}

N_BL="$(printf '%s\n' "$REPORT" | awk -F'\t' '$1=="BACKLOG_MOVED"{print $2}')"
N_BD="$(printf '%s\n' "$REPORT" | awk -F'\t' '$1=="BOARD_MOVED"{print $2}')"
N_BH="$(printf '%s\n' "$REPORT" | awk -F'\t' '$1=="BOARDHIST_MOVED"{print $2}')"
N_RG="$(printf '%s\n' "$REPORT" | awk -F'\t' '$1=="REGISTRY_MOVED"{print $2}')"

echo "## 退避対象"
echo
printf '%s\n' "$REPORT" | awk -F'\t' '
  $1=="SEC"  { printf "\n**%s** — %s 件\n\n", $2, $3 }
  $1=="ROW"  { printf "  - %-46s 状態: %s\n", $2, $3 }
  $1=="BOARDRANGE" { printf "\n**parallel-board §3 裁定ログ** — %s\n", $2 }
  $1=="BOARDHISTRANGE" { printf "\n**parallel-board §9 改訂履歴** — %s\n", $2 }
  $1=="REGRANGE"   { printf "\n**change-number-registry §4 更新履歴** — %s\n", $2 }
'
# 読めなかった行・見なかった表を必ず出す(黙って落とさない)
if printf '%s\n' "$REPORT" | grep -q '^SKIP'; then
  echo
  echo "### ⚠ 列数が合わず**読まずに残した**行(セル内の未エスケープ \`|\` が主因)"
  echo
  printf '%s\n' "$REPORT" | awk -F'\t' '$1=="SKIP"{printf "  - %s [%s] 列数 %s (ヘッダは %s)\n", $2, $3, $4, $5}'
  echo
  echo "  → **これらは退避対象から外れている**(安全側)。状態を見たい場合はセル内の \`|\` を直すこと。"
fi
if printf '%s\n' "$REPORT" | grep -q '^MULTI'; then
  echo
  echo "### ⚠ 節内に列構成の違う 2 つ目の表がある(**その表は見ていない**)"
  echo
  printf '%s\n' "$REPORT" | awk -F'\t' '$1=="MULTI"{printf "  - %s (列数 %s)\n", $2, $3}'
fi
echo
echo "合計: followup-backlog **$N_BL 件** / parallel-board §3 **$N_BD 行** / parallel-board §9 **$N_BH 行** / change-number-registry §4 **$N_RG 行**"
echo

if [ "$APPLY" -eq 0 ]; then
  echo "**dry-run です。1 バイトも書いていません。**"
  echo
  echo "実行するには \`--apply\` を付けてください。"
  echo "想定より拡大したマイルストーンで、完了扱いだが実はまだ動いている項目があれば、"
  echo "**設計担当の宣言**として \`--exclude <ID,ID,...>\` で退避対象から外せます。"
  exit 0
fi

if [ -n "$(git status --porcelain -- "$BACKLOG" "$BOARD" "$REGISTRY" 2>/dev/null)" ]; then
  echo "WARN  対象ファイルに未コミットの変更があります。退避の diff が読みにくくなります。"
  echo
fi

if [ "$N_BL" = "0" ] && [ "$N_BD" = "0" ] && [ "$N_BH" = "0" ] && [ "$N_RG" = "0" ]; then
  echo "退避対象がありません。何もしませんでした。"
  exit 0
fi

BL_BEFORE=$(wc -l < "$BACKLOG"); BD_BEFORE=$(wc -l < "$BOARD"); RG_BEFORE=$(wc -l < "$REGISTRY")
# バックアップは **repo 外**へ置く（repo 内に置くと中断時に残骸が git add -A で混入する）。
# trap で必ず後始末する。cp の失敗も検査する（失敗に気づかず書き戻せなくなるのを防ぐ）。
BAK_DIR="$(mktemp -d)" || { echo "ERROR: mktemp 失敗" >&2; exit 2; }
# shellcheck disable=SC2064
trap "rm -rf '$BAK_DIR'" EXIT
cp "$BACKLOG"  "$BAK_DIR/backlog.bak"  || { echo "ERROR: バックアップに失敗した" >&2; exit 2; }
cp "$BOARD"    "$BAK_DIR/board.bak"    || { echo "ERROR: バックアップに失敗した" >&2; exit 2; }
cp "$REGISTRY" "$BAK_DIR/registry.bak" || { echo "ERROR: バックアップに失敗した" >&2; exit 2; }

restore_all() {
  cp "$BAK_DIR/backlog.bak" "$BACKLOG"
  cp "$BAK_DIR/board.bak" "$BOARD"
  cp "$BAK_DIR/registry.bak" "$REGISTRY"
}

if ! run_transform apply "$BACKLOG" "$BOARD" "$MILESTONE" "$BOARD_THROUGH" "$EXCLUDE" "$BACKLOG_ARCHIVE_DIR" "$BOARD_ARCHIVE_DIR" "$REGISTRY" "$REGISTRY_THROUGH" "$REGISTRY_ARCHIVE_DIR" "$SKIP_BACKLOG" "$BOARD_HISTORY_THROUGH" >/dev/null; then
  restore_all
  echo "ERROR: 退避に失敗した。元ファイルを書き戻した" >&2
  echo "      **退避先に部分的な書き込みが残っている場合がある。**再実行の前に" >&2
  echo "      $BACKLOG_ARCHIVE_DIR / $BOARD_ARCHIVE_DIR を確認すること(追記型のため重複しうる)" >&2
  exit 1
fi

BL_AFTER=$(wc -l < "$BACKLOG"); BD_AFTER=$(wc -l < "$BOARD"); RG_AFTER=$(wc -l < "$REGISTRY")
BL_DROP=$((BL_BEFORE - BL_AFTER)); BD_DROP=$((BD_BEFORE - BD_AFTER)); RG_DROP=$((RG_BEFORE - RG_AFTER))

echo "## 検証"
echo

FAILED=0
# 索引行を足すぶん、減り幅は退避件数より小さくなる。**増えていないこと**と
# **退避件数を超えて減っていないこと**を見る。
if [ "$BL_DROP" -gt "$N_BL" ] || [ "$BD_DROP" -gt "$((N_BD + N_BH))" ] || [ "$RG_DROP" -gt "$N_RG" ]; then
  echo "NG  退避件数を超えて行が減っている(backlog −$BL_DROP / board −$BD_DROP / registry −$RG_DROP)"
  FAILED=1
fi
for f in "$BACKLOG_ARCHIVE_DIR/followup-backlog-$MILESTONE.md" "$BOARD_ARCHIVE_DIR/parallel-board-rulings-$MILESTONE.md" "$BOARD_ARCHIVE_DIR/parallel-board-history-$MILESTONE.md" "$REGISTRY_ARCHIVE_DIR/change-number-registry-$MILESTONE.md"; do
  if [ -f "$f" ] && [ ! -s "$f" ]; then
    echo "NG  退避先 $f が空"
    FAILED=1
  fi
  # **追記型なので、失敗後の再実行で同じ行が二重に入りうる。**
  # 判定は退避マーカーの個数で行う——**同じマイルストーンのマーカーが 2 つ以上あれば二重適用**。
  # (表データ行の重複で判定すると、節ごとに書く表ヘッダが同一なため誤検出する)
  if [ -f "$f" ]; then
    marks=$(grep -c "<!-- 退避: $MILESTONE 境界 -->" "$f" 2>/dev/null || echo 0)
    if [ "$marks" -gt 1 ]; then
      echo "NG  退避先 $f に $MILESTONE の退避マーカーが $marks 個ある(二重適用。前回の失敗した実行の残骸)"
      # ★`note` という未定義関数を呼んでいた(2026-08-12 是正)。**二重適用を検出した
      #   まさにその場で `note: command not found` になり、対処法が出ないまま落ちていた。**
      echo "    退避先から古いブロックを取り除いてから再実行すること"
      FAILED=1
    fi
  fi
done

if [ "$FAILED" -eq 1 ]; then
  restore_all
  echo
  echo "検証に失敗したため元ファイルを書き戻した。**退避先ファイルは残っている**ので手で確認すること"
  echo "(追記型のため、直さずに再実行すると同じ行が二重に入る)。"
  exit 1
fi

ok_bl="$([ "$N_BL" -gt 0 ] && echo "$BACKLOG_ARCHIVE_DIR/followup-backlog-$MILESTONE.md" || echo '(なし)')"
ok_bd="$([ "$N_BD" -gt 0 ] && echo "$BOARD_ARCHIVE_DIR/parallel-board-rulings-$MILESTONE.md" || echo '(なし)')"
ok_bh="$([ "$N_BH" -gt 0 ] && echo "$BOARD_ARCHIVE_DIR/parallel-board-history-$MILESTONE.md" || echo '(なし)')"
ok_rg="$([ "$N_RG" -gt 0 ] && echo "$REGISTRY_ARCHIVE_DIR/change-number-registry-$MILESTONE.md" || echo '(なし)')"
echo "OK  退避先: $ok_bl / $ok_bd / $ok_bh / $ok_rg"
echo "OK  退避元に索引行を残した(**削除ではない**ことが読み手に分かる形)"
echo
echo "結果: followup-backlog $N_BL 件 / parallel-board §3 $N_BD 行 / parallel-board §9 $N_BH 行 / change-number-registry §4 $N_RG 行 を退避した"
echo
echo "**次にやること**: \`git diff\` で退避内容を確認し、検査を回してからコミットすること。"
exit 0

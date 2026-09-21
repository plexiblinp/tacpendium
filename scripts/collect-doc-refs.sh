#!/usr/bin/env bash
# collect-doc-refs.sh — /docs_to_html の前処理(決定論パート)
#
# 指定トークン(フルパス / 相対パス / ファイル名 / 文書ID / ディレクトリ)を実パスへ解決し、
#   (1) スコープ判定(docs 配下の .md/.html と ルートの CLAUDE.md/README.md/AGENTS.md のみ許可)
#   (2) 対象ファイルが直接参照している資料(1 階層のみ)の抽出と実パス解決
#   (3) サイズ計測(HTML はタグ・style/script を除いた本文推定バイト数)
# を行い、TSV で stdout に出力する。
#
# read-only。ファイルは一切書き換えない。AI 不要・決定論。
# 判断(どれを採用するか・どう要約するか)は呼び出し側 /docs_to_html が行う。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DOCS_MAP="docs/handover/docs-map.md"

usage() {
  cat <<'USAGE'
使い方: bash scripts/collect-doc-refs.sh [--include-txt] <token> [<token> ...]

  token:
    /abs/path/to/file.md      絶対パス(そのまま使う)
    docs/design/06-*.md       リポジトリルートからの相対パス
    M18-close-report.md       ファイル名のみ(docs-map §1 → 全 docs 索引 の順で解決)
    DES-005 / CHANGE-090      文書ID(docs-map §1 → ファイル名前方一致 の順で解決)
    M18-03c / M19-RESEARCH-01 マイルストーンID
    docs/design               ディレクトリ(展開せず DIR として報告するだけ)

  --include-txt  docs 配下の .txt(Memo_Someday.txt 等)もスコープに含める(既定は対象外)

出力: ## TARGETS / ## REFS / ## TOTALS の 3 セクション(TSV)

  KIND        md / html / html-js。**html-js は本文が <script> 内のデータ配列に入っている
              HTML**(例: combmgr-release-checklist.html の const TASKS = [...])。
              要約時は script ブロックまで読まないと中身が取れない。
  TEXT_BYTES  タグ・CSS を除いた本文の推定バイト数(html-js は script 分を含む)。
              予算判定にはこちらを使う(raw BYTES は CSS/JS 込みで過大)。
  MENTIONS    言及の厚みを示す目安スコア。厳密な出現回数ではない
              (パス表記と文書ID表記の両方で言及された資料は合算される)。
USAGE
}

INCLUDE_TXT=0
TOKENS=()
for a in "$@"; do
  case "$a" in
    --include-txt) INCLUDE_TXT=1 ;;
    -h|--help) usage; exit 0 ;;
    *) TOKENS+=("$a") ;;
  esac
done

if [ "${#TOKENS[@]}" -eq 0 ]; then
  usage >&2
  exit 2
fi

# ---- docs 配下のドキュメント索引(ファイル名・ID のフォールバック解決に使う) ----
INDEX="$(mktemp)"
trap 'rm -f "$INDEX"' EXIT
find docs -type f \( -name '*.md' -o -name '*.html' -o -name '*.txt' \) 2>/dev/null | sort > "$INDEX"
for f in CLAUDE.md README.md AGENTS.md; do
  [ -f "$f" ] && echo "$f" >> "$INDEX"
done

# 正規表現メタ文字のエスケープ(ファイル名の . を literal 化する等)
esc_re() { printf '%s' "$1" | sed -e 's/[.[\*^$()+?{}|\\]/\\&/g'; }

# ---- スコープ判定: "OK" または "REJECT<TAB>理由" を返す ----
scope_of() {
  local p="$1"
  case "$p" in
    CLAUDE.md|README.md|AGENTS.md) echo "OK"; return ;;
  esac
  case "$p" in
    docs/*)
      case "$p" in
        *.md|*.html) echo "OK"; return ;;
        *.txt)
          if [ "$INCLUDE_TXT" -eq 1 ]; then echo "OK"
          else printf 'REJECT\tdocs 配下の .txt は既定スコープ外(--include-txt / 明示指示で追加可)\n'; fi
          return ;;
        *) printf 'REJECT\tdocs 配下だがドキュメント形式ではない(.%s)\n' "${p##*.}"; return ;;
      esac ;;
  esac
  case "$p" in
    *.go|*.ts|*.tsx|*.js|*.jsx|*.sql|*.csv|*.json|*.sh|*.yaml|*.yml|*.toml|*.mod|*.sum)
      printf 'REJECT\tドキュメントではないためスコープ外(コード/データ: .%s)\n' "${p##*.}"; return ;;
  esac
  printf 'REJECT\tdocs/ 配下ではないためスコープ外\n'
}

# ---- HTML の本文バイト数と script ブロックのバイト数を同時に測る ----
# LC_ALL=C で length() を「文字数」ではなく「バイト数」にする。
html_split() {
  LC_ALL=C awk '
    {
      l = tolower($0)
      if (mode == "style")  { if (l ~ /<\/style>/)  mode = ""; next }
      if (mode == "script") { if (l ~ /<\/script>/) mode = ""; else s += length($0) + 1; next }
      if (l ~ /<style/)  { mode = "style";  next }
      if (l ~ /<script/) { mode = "script"; next }
      line = $0; gsub(/<[^>]*>/, "", line); b += length(line) + 1
    }
    END { print (b + 0) "\t" (s + 0) }
  ' "$1"
}

# ---- 本文バイト数 ----
# HTML は style/script とタグを除いた推定値。ただし script の方が大きい場合は
# 「本文が JS のデータ配列に入っている HTML」(例: combmgr-release-checklist.html の
# const TASKS = [...])とみなし、script 分も本文として数える。
text_bytes() {
  local p="$1" b s
  case "$p" in
    *.html)
      IFS=$'\t' read -r b s < <(html_split "$p")
      if [ "$s" -gt "$b" ]; then echo $(( b + s )); else echo "$b"; fi
      ;;
    *) wc -c < "$p" ;;
  esac
}

# ---- 種別(html / html-js): html-js は「本文が script 内に入っている」印 ----
# 呼び出し側はこの印を見て、要約時に script ブロックまで読む必要があると判断する。
kind_of() {
  local p="$1" b s
  case "$p" in
    *.html)
      IFS=$'\t' read -r b s < <(html_split "$p")
      if [ "$s" -gt "$b" ]; then echo "html-js"; else echo "html"; fi ;;
    *) echo "${p##*.}" ;;
  esac
}

# ---- docs-map §1(文書ID 逆引き表)から ID を解決 ----
# 表形式: | `ID` | バージョン | タイトル | `実パス` |
# EXACT(完全一致)を優先し、無ければ PREFIX(ID の直後が英数字・ハイフン以外＝装飾付き)を使う。
resolve_via_map_id() {
  local id="$1" hits
  hits="$(awk -F'|' -v id="$id" '
    /^\| `/ {
      key = $2; gsub(/^[ \t]+|[ \t]+$/, "", key); gsub(/`/, "", key)
      path = $(NF-1); gsub(/[ \t`]/, "", path)
      if (path == "" || path !~ /\.(md|html)$/) next
      if (key == id) { print "EXACT\t" path; next }
      if (index(key, id) == 1) {
        rest = substr(key, length(id) + 1)
        if (rest !~ /^[A-Za-z0-9-]/) print "PREFIX\t" path
      }
    }' "$DOCS_MAP" 2>/dev/null || true)"
  [ -z "$hits" ] && return 0
  local exact
  exact="$(printf '%s\n' "$hits" | awk -F'\t' '$1=="EXACT"{print $2}' | sort -u)"
  if [ -n "$exact" ]; then printf '%s\n' "$exact"
  else printf '%s\n' "$hits" | awk -F'\t' '{print $2}' | sort -u; fi
}

# ---- docs-map §1 のパス列からファイル名を解決 ----
resolve_via_map_name() {
  local name esc
  name="$1"; esc="$(esc_re "$name")"
  awk -F'|' -v pat="/${esc}$" '
    /^\| `/ {
      path = $(NF-1); gsub(/[ \t`]/, "", path)
      if (path != "" && path ~ pat) print path
    }' "$DOCS_MAP" 2>/dev/null | sort -u || true
}

# ---- トークン → 実パス候補(0..n 行) ----
# 呼び出し側は 0 件=未解決 / 1 件=確定 / 2 件以上=AMBIG として扱う。
resolve_token() {
  local t="$1" esc

  # 絶対パス: リポジトリ内ならルート相対へ畳む
  case "$t" in
    /*)
      case "$t" in
        "$ROOT"/*) printf '%s\n' "${t#"$ROOT"/}" ;;
        *) printf '%s\n' "$t" ;;
      esac
      return ;;
  esac

  # パス形(スラッシュを含む): ルート相対として扱う
  case "$t" in
    */*) printf '%s\n' "${t#./}"; return ;;
  esac

  # ファイル名のみ: docs-map §1 →(無ければ)全 docs 索引
  case "$t" in
    *.md|*.html|*.txt)
      local viamap
      viamap="$(resolve_via_map_name "$t")"
      if [ -n "$viamap" ]; then printf '%s\n' "$viamap"; return; fi
      esc="$(esc_re "$t")"
      grep -E "(^|/)${esc}$" "$INDEX" | sort -u || true
      return ;;
  esac

  # 文書ID / マイルストーンID: docs-map §1 →(無ければ)ファイル名前方一致
  case "$t" in
    [A-Za-z]*-*)
      local viamap
      viamap="$(resolve_via_map_id "$t")"
      if [ -n "$viamap" ]; then printf '%s\n' "$viamap"; return; fi
      esc="$(esc_re "$t")"
      grep -E "/${esc}(-[^/]*)?\.(md|html)$" "$INDEX" | sort -u || true
      return ;;
  esac

  # それ以外(自然言語など)は解決しない
  return 0
}

# ---- 参照抽出(1 階層のみ): "生の参照文字列<TAB>出現回数" ----
# MENTIONS は「どれだけ厚く言及されているか」の目安スコアであり厳密な出現回数ではない
# (パス表記と文書ID表記の両方で言及された資料は合算される)。
extract_refs() {
  local f="$1"
  {
    # 1) 明示パス
    grep -oE '(\.\./)*docs/[A-Za-z0-9_.-]+(/[A-Za-z0-9_.-]+)*\.(md|html)' "$f" 2>/dev/null || true
    # 2) markdown リンク
    grep -oE '\]\([^)]+\.(md|html)(#[^)]*)?\)' "$f" 2>/dev/null | sed -E 's/^\]\(//; s/\)$//; s/#.*$//' || true
    # 3) HTML の href
    grep -oE 'href="[^"]+\.(md|html)(#[^"]*)?"' "$f" 2>/dev/null | sed -E 's/^href="//; s/"$//; s/#.*$//' || true
    # 4) 裸のファイル名(INDEX.md のようにリンク記法を使わない資料に効く)
    grep -oE '[A-Za-z0-9_][A-Za-z0-9_.-]*\.(md|html)' "$f" 2>/dev/null || true
    # 5) 文書ID
    grep -oE '\b(REQ|DES|SUPP|PROC|CHANGE)-[0-9]{3}\b' "$f" 2>/dev/null || true
    # 6) マイルストーンID
    grep -oE '\bM[0-9]{1,2}-RESEARCH-[0-9]{2}\b' "$f" 2>/dev/null || true
    grep -oE '\bM[0-9]{1,2}-[0-9]{2}[a-c]?\b' "$f" 2>/dev/null || true
  } | grep -vE '[*{}]' | sort | uniq -c \
    | awk '{ c = $1; $1 = ""; sub(/^ /, ""); print $0 "\t" c }'
}

# ---- 参照文字列の実パス解決(参照元ファイルからの相対も解く) ----
resolve_ref() {
  local ref="$1" from="$2" dir cand
  dir="$(dirname "$from")"
  case "$ref" in
    docs/*|/*) resolve_token "$ref"; return ;;
    */*|../*)
      cand="$(realpath -m --relative-to="$ROOT" "$dir/$ref" 2>/dev/null || true)"
      [ -n "$cand" ] && printf '%s\n' "$cand"
      return ;;
  esac
  # 裸のファイル名は「同じディレクトリ」を最優先(go-react-learning-guide/index.html 等)
  case "$ref" in
    *.md|*.html|*.txt)
      if [ -f "$dir/$ref" ]; then printf '%s\n' "${dir#./}/$ref"; return; fi ;;
  esac
  resolve_token "$ref"
}

# =====================================================================
# ## TARGETS
# =====================================================================
TARGET_LIST="$(mktemp)"; trap 'rm -f "$INDEX" "$TARGET_LIST"' EXIT

echo "## TARGETS"
printf '#STATUS\tKIND\tTOKEN\tPATH\tBYTES\tTEXT_BYTES\tLINES\n'

for t in "${TOKENS[@]}"; do
  # ディレクトリは展開しない(トークン多消費のため、呼び出し側が問い返す)
  if [ -d "$t" ] || { [ -d "${t%/}" ] && [ -n "${t%/}" ]; }; then
    d="${t%/}"
    cnt="$(find "$d" -type f \( -name '*.md' -o -name '*.html' \) 2>/dev/null | wc -l)"
    sz="$(find "$d" -type f \( -name '*.md' -o -name '*.html' \) -printf '%s\n' 2>/dev/null | awk '{s+=$1} END {print s+0}')"
    printf 'DIR\tdir\t%s\t%s\t%s\t%s\t%s\n' "$t" "$d" "$sz" "$sz" "${cnt} files"
    continue
  fi

  mapfile -t cands < <(resolve_token "$t")

  if [ "${#cands[@]}" -eq 0 ]; then
    case "$t" in
      *.md|*.html|*.txt|[A-Za-z]*-[0-9A-Za-z]*)
        printf 'UNRESOLVED\t-\t%s\t-\t-\t-\t-\n' "$t" ;;
      *)
        printf 'FREETEXT\t-\t%s\t-\t-\t-\t-\n' "$t" ;;
    esac
    continue
  fi

  status_prefix="OK"
  [ "${#cands[@]}" -gt 1 ] && status_prefix="AMBIG"

  for p in "${cands[@]}"; do
    sc="$(scope_of "$p")"
    if [ "${sc%%$'\t'*}" = "REJECT" ]; then
      printf 'REJECT\t-\t%s\t%s\t-\t-\t%s\n' "$t" "$p" "${sc#*$'\t'}"
      continue
    fi
    if [ ! -f "$p" ]; then
      printf 'MISSING\t-\t%s\t%s\t-\t-\t実ファイルが存在しない\n' "$t" "$p"
      continue
    fi
    b="$(wc -c < "$p")"; tb="$(text_bytes "$p")"; ln="$(wc -l < "$p")"
    printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$status_prefix" "$(kind_of "$p")" "$t" "$p" "$b" "$tb" "$ln"
    echo "$p" >> "$TARGET_LIST"
  done
done

sort -u -o "$TARGET_LIST" "$TARGET_LIST" 2>/dev/null || true

# =====================================================================
# ## REFS (depth 1)
# =====================================================================
echo
echo "## REFS"
printf '#STATUS\tKIND\tREF\tPATH\tBYTES\tTEXT_BYTES\tMENTIONS\tFROM\n'

REFS_RAW="$(mktemp)"; trap 'rm -f "$INDEX" "$TARGET_LIST" "$REFS_RAW"' EXIT
: > "$REFS_RAW"

if [ -s "$TARGET_LIST" ]; then
  while IFS= read -r tgt; do
    while IFS=$'\t' read -r ref cnt; do
      [ -z "$ref" ] && continue
      mapfile -t rcands < <(resolve_ref "$ref" "$tgt")
      if [ "${#rcands[@]}" -eq 0 ]; then
        printf 'UNRESOLVED\t-\t%s\t-\t0\t0\t%s\t%s\n' "$ref" "$cnt" "$tgt" >> "$REFS_RAW"
        continue
      fi
      for rp in "${rcands[@]}"; do
        # 対象自身・対象として既に読む資料は参照から除く
        grep -qxF "$rp" "$TARGET_LIST" && continue
        sc="$(scope_of "$rp")"
        [ "${sc%%$'\t'*}" = "REJECT" ] && continue
        [ -f "$rp" ] || continue
        b="$(wc -c < "$rp")"; tb="$(text_bytes "$rp")"
        printf 'OK\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$(kind_of "$rp")" "$ref" "$rp" "$b" "$tb" "$cnt" "$tgt" >> "$REFS_RAW"
      done
    done < <(extract_refs "$tgt")
  done < "$TARGET_LIST"
fi

# 同一パスへ解決された参照を集約(MENTIONS 合算・参照元と参照表記を連結)
awk -F'\t' '
  $1 == "OK" {
    key = $4
    if (!(key in seen)) { seen[key] = 1; kind[key] = $2; bytes[key] = $5; tbytes[key] = $6 }
    mentions[key] += $7
    if (index(refs[key], $3) == 0) refs[key] = (refs[key] == "" ? $3 : refs[key] "," $3)
    if (index(from[key], $8) == 0) from[key] = (from[key] == "" ? $8 : from[key] "," $8)
    next
  }
  { unres[$3] += $7; unfrom[$3] = $8 }
  END {
    for (k in seen)
      printf "OK\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n", kind[k], refs[k], k, bytes[k], tbytes[k], mentions[k], from[k]
    for (u in unres)
      printf "UNRESOLVED\t-\t%s\t-\t0\t0\t%s\t%s\n", u, unres[u], unfrom[u]
  }
' "$REFS_RAW" | sort -t$'\t' -k1,1 -k7,7nr -k6,6n

# =====================================================================
# ## TOTALS
# =====================================================================
T_FILES="$(wc -l < "$TARGET_LIST" 2>/dev/null || echo 0)"
T_BYTES="$(if [ -s "$TARGET_LIST" ]; then while IFS= read -r p; do text_bytes "$p"; done < "$TARGET_LIST"; fi | awk '{s+=$1} END {print s+0}')"

R_AGG="$(awk -F'\t' '$1=="OK"{ if(!(($4) in s)){s[$4]=$6} } END { n=0; t=0; for(k in s){n++; t+=s[k]} print n"\t"t }' "$REFS_RAW")"
R_FILES="$(printf '%s' "$R_AGG" | cut -f1)"
R_BYTES="$(printf '%s' "$R_AGG" | cut -f2)"
R_UNRES="$(awk -F'\t' '$1=="UNRESOLVED"{print $3}' "$REFS_RAW" | sort -u | paste -sd, -)"
R_UNRES_N="$(awk -F'\t' '$1=="UNRESOLVED"{print $3}' "$REFS_RAW" | sort -u | wc -l)"

GRAND=$(( T_BYTES + R_BYTES ))

echo
echo "## TOTALS"
printf 'targets_files\t%s\n' "$T_FILES"
printf 'targets_text_bytes\t%s\n' "$T_BYTES"
printf 'refs_resolved_files\t%s\n' "$R_FILES"
printf 'refs_resolved_text_bytes\t%s\n' "$R_BYTES"
printf 'refs_unresolved\t%s\t%s\n' "$R_UNRES_N" "${R_UNRES:--}"
printf 'grand_total_text_bytes\t%s\n' "$GRAND"
printf 'approx_tokens\t%s\t(本文バイト数/3 の目安。日本語主体の md/HTML 前提)\n' "$(( GRAND / 3 ))"

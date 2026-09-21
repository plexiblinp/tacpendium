#!/usr/bin/env bash
# 設計担当(Web 版 Claude、コード閲覧不可)向けに、コードベースの「機械的事実」を
# 決定論的に抽出して docs/handover/code-facts.md を生成する。
#
# 背景: retrospective-log.md §1 パターン A/C「実コード確認の省略」が最頻出ミス。
#   設計担当が Props 名・queryKey 形・ルート・ハンドラ・config フィールド・ナビリンク・
#   DB スキーマ(migrations)を想定で書いてしまうのを防ぐため、これらを実コードから抽出して提示する。
#
# 抽出は grep/awk/sed のみ(新規依存なし、AST パーサ不使用)。静的抽出の限界は
# 生成物冒頭「本資料の限界」節に明記する。
#
# 使い方: bash scripts/generate-code-facts.sh
#   出力先: docs/handover/code-facts.md(上書き)。git 操作は行わない。
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

# ---------------------------------------------------------------------------
# 源泉不在ガード(2026-08-11 追加)
#
# 設計卓が Claude Code へ移り、`scripts/design-desk-arm.sh` が sparse-checkout で
# 実装ソースを作業ツリーから物理排除するようになった。**武装中に本スクリプトを回すと
# `find web/src` / `internal` が何も見つけられず、空のテーブルで code-facts.md を
# 上書きして正常終了する。** 設計卓が鮮度に気づいて再生成しようとした瞬間に、
# 自分の事実源を壊すという筋の悪い事故になる。
# (`check-artifact-integrity.sh` は「行数の激減」で検出するが、そのときには上書き済み。)
#
# ⇒ 源泉が無いなら **書き込まずに停止する**。docs-map は docs/ だけを読むので影響なし。
# ---------------------------------------------------------------------------
missing=""
for d in web/src internal migrations; do
  [ -d "$d" ] || missing="$missing $d"
done
if [ -n "$missing" ]; then
  echo "generate-code-facts: 源泉が作業ツリーにありません:$missing" >&2
  echo "" >&2
  if [ -f "tmp/.design-desk-armed" ]; then
    echo "  設計卓の武装中です(scripts/design-desk-arm.sh)。**武装中は再生成できません。**" >&2
    echo "  code-facts.md は実装ソースから抽出するため、源泉が見えるセッションで回す必要があります。" >&2
    echo "  → 製造・改善セッション、または開発者の端末で実行してください。" >&2
  else
    echo "  sparse-checkout や部分クローンで源泉が除外されている可能性があります。" >&2
    echo "  → bash scripts/design-desk-arm.sh --status で作業ツリーの範囲を確認してください。" >&2
  fi
  echo "" >&2
  echo "  **code-facts.md は上書きしていません**(空の内容で正本を壊さないため)。" >&2
  exit 2
fi

OUT="docs/handover/code-facts.md"
# 時刻は含めず日付のみ(同日の再生成を冪等にし、不要な diff を避けるため)。
GEN_DATE="$(date '+%Y-%m-%d')"
GEN_COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"

# ---------------------------------------------------------------------------
# §1 React コンポーネント Props
#   対象: web/src/**/*.tsx
#   `interface XxxProps {` / `interface Props {` 〜 行頭 `}` を捕捉しフィールド列挙。
#   表セル破壊を防ぐため union 型等の `|` は `\|` にエスケープする。
# ---------------------------------------------------------------------------
emit_components() {
  echo '## 1. コンポーネント Props(source: `web/src/**/*.tsx`)'
  echo
  echo '| コンポーネント | ファイル | Props(interface 名)| フィールド |'
  echo '|---|---|---|---|'
  find web/src -name '*.tsx' ! -name '*.test.tsx' ! -name '*.spec.tsx' | sort | while read -r f; do
    awk -v file="$f" '
      /^[[:space:]]*(export[[:space:]]+)?interface[[:space:]]+([A-Za-z0-9_]*Props|Props)[[:space:]]*\{/ {
        name=$0
        sub(/^[[:space:]]*(export[[:space:]]+)?interface[[:space:]]+/,"",name)
        sub(/[[:space:]]*\{.*/,"",name)
        capture=1; fields=""; inblock=0; next
      }
      capture==1 {
        if ($0 ~ /^\}/) {
          n=split(file,parts,"/"); comp=parts[n]; sub(/\.tsx$/,"",comp)
          if (fields=="") fields="(フィールドなし)"
          gsub(/\|/,"\\|",fields)
          print "| " comp " | " file " | " name " | " fields " |"
          capture=0; inblock=0; next
        }
        line=$0
        # ★複数行 JSDoc(/** … */)の継続行は閉じるまで捨てる。
        #   旧実装は単一行コメントしか外せず、JSDoc の本文がフィールド列へ流れ込んでいた。
        #   本文に `**` が含まれると、生成物が「閉じない強調」になる
        #   (2026-08-15 実測: check-md-emphasis の走査対象へ docs/progress を足した際に
        #    code-facts.md の 2 行 → 8 行へ増えて発覚。生成器が壊れた markdown を出していた)。
        if (inblock==1) {
          if (match(line, /\*\//)) { line=substr(line, RSTART+2); inblock=0 }
          else { next }
        }
        sub(/[[:space:]]*\/\/.*/,"",line)          # 行末 // コメント除去
        # /* … */ を先頭から順に外す。閉じが同一行に無ければブロック継続へ移る。
        while (match(line, /\/\*/)) {
          pre=substr(line, 1, RSTART-1); rest=substr(line, RSTART+2)
          if (match(rest, /\*\//)) { line=pre " " substr(rest, RSTART+2) }
          else { line=pre; inblock=1; break }
        }
        gsub(/^[[:space:]]+/,"",line); gsub(/[[:space:]]+$/,"",line)
        if (line != "") { fields = (fields=="" ? line : fields " " line) }
      }
    ' "$f"
  done
  echo
}

# ---------------------------------------------------------------------------
# §2 カスタムフック一覧 + queryKey リテラル
#   フック: export function/const useXxx
#   queryKey: `queryKey: [ ... ]`(複数行対応)+ const _KEY = [ ... ]
# ---------------------------------------------------------------------------
emit_hooks_querykeys() {
  echo '## 2. カスタムフック / queryKey(source: `web/src/**/*.ts(x)`)'
  echo
  echo '### 2-1. カスタムフック一覧'
  echo
  echo '| フック | ファイル |'
  echo '|---|---|'
  grep -rnE 'export[[:space:]]+(function|const)[[:space:]]+use[A-Z][A-Za-z0-9_]*' \
    web/src --include='*.ts' --include='*.tsx' \
    --exclude='*.test.*' --exclude='*.spec.*' 2>/dev/null \
    | sed -E 's#^([^:]+):[0-9]+:.*(export[[:space:]]+(function|const)[[:space:]]+)(use[A-Za-z0-9_]+).*#\4\t\1#' \
    | sort -u \
    | awk -F'\t' '{ print "| `" $1 "` | " $2 " |" }' || true
  echo
  echo '### 2-2. queryKey(正本 = `web/src/lib/query-keys.ts` の `queryKeys` ファクトリ)'
  echo
  echo '> **★正本はファクトリである**(`M24-08` / `CO-009` / `CHANGE-148`)。'
  echo '> 画面・フックの側で配列リテラルを書かない。検査は `query-keys.convention.test.ts`。'
  echo '> 下表の「返り値」は `as const` の配列そのもの。**前方一致で当たる範囲を読むこと**'
  echo '> (TanStack の既定は前方一致であり、当たらなくなっても例外は出ず画面が更新されないだけ)。'
  echo
  echo '| キー | 引数 | 返り値 |'
  echo '|---|---|---|'
  # ファクトリ定義を決定論的に抽出する。
  #   形: `  domain: {` … `    member: (args) => [ ... ] as const,`
  awk '
    # ドメイン(インデント 2)の開始・終了
    /^  [A-Za-z0-9_]+: \{/ { domain=$1; sub(/:.*/,"",domain); next }
    /^  \},?$/             { domain=""; next }
    # ★queryKeys 直下のトップレベル定義(インデント 2・`{` を開かない)
    #   例: `commandIndex: (id) => [...] as const,` / `config: () => ["config"] as const,`
    #   ★2026-09-01 追加。旧実装はドメイン配下(インデント 4)しか見ておらず、
    #     commandIndex / motionCommands / config / users の 4 件を静かに落としていた。
    #     ★とくに config / users は M24-08 が削除した CONFIG_KEY / USERS_KEY の後継であり、
    #       落とすと投入プロンプトが名指しした情報が派生資料から純減する。
    domain == "" && /^  [A-Za-z0-9_]+:/ && $0 !~ /\{$/ {
      line=$0
      while (line !~ /as const/ && (getline nxt) > 0) { line = line " " nxt }
      gsub(/[[:space:]]+/," ",line); sub(/^ /,"",line)
      if (match(line, /^[A-Za-z0-9_]+:/)) {
        member=substr(line,RSTART,RLENGTH-1)
        rest=substr(line,RSTART+RLENGTH)
        args=""
        if (match(rest,/\([^)]*\)/)) args=substr(rest,RSTART+1,RLENGTH-2)
        gsub(/^ | $/,"",args); sub(/,$/,"",args)
        ret=""
        if (match(rest,/\[.*\] as const/)) { ret=substr(rest,RSTART,RLENGTH); sub(/ as const$/,"",ret) }
        gsub(/\|/,"\\|",args); gsub(/\|/,"\\|",ret)
        if (ret != "") { print "| `queryKeys." member "` | `" args "` | `" ret "` |"; n++ }
      }
      next
    }
    # メンバー(インデント 4)の開始。★`=>` が同じ行に無い多行定義も拾う
    #   (旧実装は /=>/ で始動していたため `recipe: (` の形を 4 件取りこぼしていた。
    #    ★破損ガードは「1 件でも在れば緑」であり、部分的な取りこぼしは検出できない)
    domain != "" && /^    [A-Za-z0-9_]+:/ && $0 !~ /\{$/ {
      line=$0
      while (line !~ /as const/ && (getline nxt) > 0) { line = line " " nxt }
      gsub(/[[:space:]]+/," ",line); sub(/^ /,"",line)
      if (match(line, /^[A-Za-z0-9_]+:/)) {
        member=substr(line,RSTART,RLENGTH-1)
        rest=substr(line,RSTART+RLENGTH)
        args=""
        if (match(rest,/\([^)]*\)/)) args=substr(rest,RSTART+1,RLENGTH-2)
        gsub(/^ | $/,"",args); sub(/,$/,"",args)
        ret=""
        if (match(rest,/\[.*\] as const/)) { ret=substr(rest,RSTART,RLENGTH); sub(/ as const$/,"",ret) }
        gsub(/\|/,"\\|",args); gsub(/\|/,"\\|",ret)
        if (ret != "") { print "| `queryKeys." domain "." member "` | `" args "` | `" ret "` |"; n++ }
      }
      next
    }
    END { if (n < 36) print "| **★抽出が " n " 件しかない。query-keys.ts の形が変わった可能性がある** | | |" }
  ' web/src/lib/query-keys.ts
  echo
  echo '### 2-3. ★正本の外に残っている queryKey 配列リテラル(あってはならない)'
  echo
  echo '> **0 件が正常。** 1 件でも出たら `web/CLAUDE.md` §1.5 の規約違反であり、'
  echo '> `query-keys.convention.test.ts` が赤になっているはずである。'
  echo '> 用途列: `query(定義)` = useQuery/useMutation のキー定義、`invalidate` = mutation 成功時に'
  echo '> 無効化するキー、`invalidate(削除)` = removeQueries。'
  echo '> ★`const(定義)`(共有キー定数)は `M24-08` の集約で消滅した。出たら残存である。'
  echo
  echo '| ファイル | 用途 | queryKey |'
  echo '|---|---|---|'
  {
    # inline queryKey: [...](テストファイルは除外、閉じ ] で切り詰め)
    # 用途分類: invalidate 系呼び出し(invalidateQueries 等)は同一行に queryKey を置くため
    #   同一行キーワードで判定。多行 invalidate(SetupCandidateList)は pending で次の
    #   queryKey へ繰越。それ以外(useQuery/useMutation 定義)は別行のため既定 query(定義)。
    find web/src \( -name '*.ts' -o -name '*.tsx' \) \
      ! -name '*.test.*' ! -name '*.spec.*' ! -path 'web/src/lib/query-keys.ts' \
      | sort | while read -r f; do
      awk -v file="$f" '
        function flush(buf, usage,   s,idx) {
          s=buf
          gsub(/[[:space:]]+/," ",s); gsub(/^[[:space:]]+/,"",s)
          idx=index(s,"]"); if (idx>0) s=substr(s,1,idx)   # 閉じ ] までで切る
          gsub(/\|/,"\\|",s)
          print "| " file " | " usage " | `" s "` |"
        }
        {
          kw=""
          if ($0 ~ /removeQueries/) kw="invalidate(削除)"
          else if ($0 ~ /(invalidateQueries|cancelQueries|refetchQueries|resetQueries|setQueryData|prefetchQuery|fetchQuery|ensureQueryData)/) kw="invalidate"
        }
        cap==1 {
          buf=buf " " $0
          if ($0 ~ /\]/) { flush(buf, savedusage); cap=0 }
          next
        }
        /queryKey:[[:space:]]*\[/ {
          usage=(kw!="" ? kw : (pending!="" ? pending : "query(定義)"))
          pending=""
          start=index($0,"["); s=substr($0,start)
          if (s ~ /\]/) { flush(s, usage) } else { buf=s; cap=1; savedusage=usage }
          next
        }
        kw!="" { pending=kw }
      ' "$f"
    done
    # const NAME_KEY = [...](共有キー定数)
    grep -rnE 'const[[:space:]]+[A-Za-z0-9_]+_KEY[[:space:]]*=[[:space:]]*\[' \
      web/src --include='*.ts' --include='*.tsx' \
      --exclude='*.test.*' --exclude='*.spec.*' 2>/dev/null \
      | sed -E 's#^([^:]+):[0-9]+:[[:space:]]*(const[[:space:]]+[A-Za-z0-9_]+_KEY[[:space:]]*=[[:space:]]*\[[^]]*\]).*#\1\t\2#' \
      | awk -F'\t' '{ k=$2; gsub(/\|/,"\\|",k); print "| " $1 " | const(定義) | `" k "` |" }'
  } | sort -u || true
  echo
}

# ---------------------------------------------------------------------------
# §3 react-router ルート(単一ファイル web/src/router.tsx)
# ---------------------------------------------------------------------------
emit_routes() {
  echo '## 3. ルート(source: `web/src/router.tsx`)'
  echo
  echo '| path | element |'
  echo '|---|---|'
  awk -F'"' '
    /<Route[[:space:]]+path=/ {
      path=$2
      comp=""
      if (match($0,/element=\{<[A-Za-z0-9_]+/)) {
        comp=substr($0,RSTART,RLENGTH); sub(/element=\{</,"",comp)
      }
      note=(path=="*") ? " ※catch-all" : ""
      print "| `" path "` | " comp note " |"
    }
  ' web/src/router.tsx
  echo
  echo '> 上表に無い path は **router.tsx に未定義**(例: `/presets` は Header にリンクがあるが未実装)。'
  echo
}

# ---------------------------------------------------------------------------
# §4 Go ルート ↔ ハンドラ
#   対象: internal/api/*/routes.go(g.METHOD)+ cmd/tacpendium/main.go(e.METHOD 直登録)
#   各ドメインの handler.go と突き合わせ、未登録の公開ハンドラを併記。
# ---------------------------------------------------------------------------
emit_go_routes() {
  echo '## 4. Go ルート ↔ ハンドラ(source: `internal/api/*/routes.go`, `cmd/tacpendium/main.go`)'
  echo
  echo '| METHOD `/api`+path | ハンドラ | ドメイン |'
  echo '|---|---|---|'
  for rf in internal/api/*/routes.go; do
    [ -e "$rf" ] || continue
    domain="$(basename "$(dirname "$rf")")"
    sed -nE 's#.*[[:space:]]g\.(GET|POST|PUT|PATCH|DELETE)\("([^"]+)",[[:space:]]*h\.([A-Za-z0-9_]+)\).*#\1\t\2\t\3#p' "$rf" \
      | awk -F'\t' -v d="$domain" '{ print "| " $1 " /api" $2 " | `" d ".Handler." $3 "` | " d " |" }'
  done
  # main.go 直登録(health 等)
  sed -nE 's#.*[[:space:]]e\.(GET|POST|PUT|PATCH|DELETE)\("([^"]+)",[[:space:]]*([A-Za-z0-9_.]+)\).*#\1\t\2\t\3#p' \
    cmd/tacpendium/main.go 2>/dev/null \
    | awk -F'\t' '{ print "| " $1 " " $2 " | `" $3 "` | (main.go 直登録) |" }' || true
  echo
  echo '### 4-1. ルート未登録の公開ハンドラ(レイヤ確認用)'
  echo
  echo '> バグ修正時「症状のレイヤ ≠ 真因のレイヤ」(M7-16/18)。ハンドラの実在を確認すること。'
  echo
  local found=0
  for hdir in internal/api/*/; do
    rf="${hdir}routes.go"
    [ -e "$rf" ] || continue
    domain="$(basename "$hdir")"
    registered="$(sed -nE 's#.*h\.([A-Za-z0-9_]+)\).*#\1#p' "$rf" | sort -u)"
    defined="$(grep -hoE 'func \(h \*Handler\) [A-Za-z0-9_]+\(c echo\.Context\)' "$hdir"*.go 2>/dev/null \
      | sed -E 's/.*\) ([A-Za-z0-9_]+)\(.*/\1/' | sort -u || true)"
    while read -r m; do
      [ -z "$m" ] && continue
      if ! printf '%s\n' "$registered" | grep -qx "$m"; then
        echo "- \`${domain}.Handler.${m}\`(routes.go に未登録)"
        found=1
      fi
    done <<< "$defined"
  done
  [ "$found" -eq 0 ] && echo '- (なし — すべての公開ハンドラがルート登録済み)'
  echo
}

# ---------------------------------------------------------------------------
# §5 config 構造体(internal/config/config.go)
#   全 *Config struct のフィールドを収集し、トップ Config のネスト(=TOML セクション)で表示。
# ---------------------------------------------------------------------------
emit_config() {
  echo '## 5. config 構造体(source: `internal/config/config.go`)'
  echo
  echo '> TOML セクション = ネスト構造体。設定画面の項目はここに無いフィールドを前提にしないこと(M6-4)。'
  echo
  awk '
    /^type[[:space:]]+[A-Za-z0-9_]*Config[[:space:]]+struct[[:space:]]*\{/ {
      sname=$2; capture=1; next
    }
    capture==1 && /^\}/ { capture=0; next }
    capture==1 {
      line=$0
      if (line ~ /^[[:space:]]*\/\//) next          # コメント行スキップ
      gsub(/^[[:space:]]+/,"",line); gsub(/[[:space:]]+$/,"",line)
      if (line=="") next
      m=split(line,toks,/[[:space:]]+/)
      if (m<2) next
      fname=toks[1]; ftype=toks[2]
      tag=""
      if (match(line,/toml:"[^"]*"/)) { tag=substr(line,RSTART,RLENGTH); sub(/toml:"/,"",tag); sub(/"$/,"",tag) }
      # Config はセクション定義、それ以外はフィールド定義として蓄積
      if (sname=="Config") {
        sec_order[++nsec]=tag; sec_type[tag]=ftype
      } else {
        fields[sname] = (fields[sname]=="" ? "" : fields[sname] "; ") fname " " ftype " `" tag "`"
      }
    }
    END {
      for (i=1;i<=nsec;i++) {
        t=sec_order[i]; st=sec_type[t]
        body=(st in fields)?fields[st]:"(フィールドなし)"
        printf "- **[%s]** (`%s`): %s\n", t, st, body
      }
    }
  ' internal/config/config.go
  echo
}

# ---------------------------------------------------------------------------
# §7 バックエンド Response 構造体(internal/api/**/*.go)
#   `type *Response struct` を捕捉し、JSON タグ名・型を構造体ごとに列挙。
#   フロントが受け取る JSON の形 = DTO フィールドの実体(M4-17 対策)。
# ---------------------------------------------------------------------------
emit_responses() {
  echo '## 7. バックエンド Response 構造体(source: `internal/api/**/*.go`)'
  echo
  echo '> これは **API レスポンスの形(フロントが受け取る JSON)**。画面項目の有無ではなく'
  echo '> DTO フィールドの有無を示す(M4-17)。各エントリは `JSONタグ名 \`Go型\`` 形式。'
  echo '> `omitempty` 付きはタグ名に含めて表示(値が無いとキー自体が省略されうる)。'
  echo
  find internal/api -name '*.go' ! -name '*_test.go' | sort | while read -r f; do
    awk -v file="$f" '
      /^type[[:space:]]+[A-Za-z0-9_]*Response[[:space:]]+struct[[:space:]]*\{/ {
        sname=$2; capture=1; fields=""; next
      }
      capture==1 && /^\}/ {
        if (fields=="") fields="(フィールドなし)"
        gsub(/\|/,"\\|",fields)
        print "- **" sname "** (`" file "`): " fields
        capture=0; next
      }
      capture==1 {
        line=$0
        if (line ~ /^[[:space:]]*\/\//) next           # コメント行スキップ
        sub(/[[:space:]]*\/\/.*/,"",line)              # 行末 // コメント除去
        gsub(/^[[:space:]]+/,"",line); gsub(/[[:space:]]+$/,"",line)
        if (line=="") next
        m=split(line,toks,/[[:space:]]+/)
        if (m<2) next
        fname=toks[1]; ftype=toks[2]
        jtag=""
        if (match(line,/json:"[^"]*"/)) { jtag=substr(line,RSTART,RLENGTH); sub(/json:"/,"",jtag); sub(/"$/,"",jtag) }
        if (jtag=="" || jtag=="-") next                # json タグ無し(埋め込み等)/ 除外フィールドはスキップ
        entry=jtag " `" ftype "`"
        fields=(fields=="" ? entry : fields " / " entry)
      }
    ' "$f"
  done
  echo
}

# ---------------------------------------------------------------------------
# §7-2 API リクエスト/入力 DTO(internal/api/**/*.go)
#   §7(Response)の裏面 = API が `c.Bind` で受け取る入力の形(フロント→BE 契約)。
#   7-2-1: c.Bind バインド先マップ。`var X Type` → `c.Bind(&X)` を追跡し
#          「domain.Handler.Func → 入力型」を出力(コードベースが一貫してこの形)。
#   7-2-2: リクエスト/入力 DTO 構造体(§7 同形式)。名前(大小文字無視)に
#          request/input/params/payload を含む or body 終端の struct。**lowercase も
#          含む**(§9 の lowercase 除外は本節非適用)。埋め込みは (embeds X) 表示。
# ---------------------------------------------------------------------------
emit_request_dtos() {
  echo '## 7-2. API リクエスト/入力 DTO(source: `internal/api/**/*.go`)'
  echo
  echo '> **API が `c.Bind` で受け取る入力の形**(フロント→BE 契約)。§7(Response)の裏面。'
  echo '> 各エントリは `JSONタグ名 \`Go型\`` 形式。`omitempty` はタグ名に含めて表示。'
  echo '> 埋め込み(embedded struct)は展開せず `(embeds X)` と表示(フィールドは X 側を参照)。'
  echo
  echo '### 7-2-1. `c.Bind` バインド先(ハンドラ ↔ 入力型)'
  echo
  echo '> `var req Type` → `c.Bind(&req)` の宣言追跡で解決。型が `internal/api` 外'
  echo '> (例 `model.CreateTagInput`)の場合、定義は §8 を参照。'
  echo
  echo '| ハンドラ | バインド先型 |'
  echo '|---|---|'
  for hf in internal/api/*/*.go; do
    [ -e "$hf" ] || continue
    case "$hf" in *_test.go) continue;; esac
    domain="$(basename "$(dirname "$hf")")"
    awk -v d="$domain" '
      /^func \(h \*Handler\) [A-Za-z0-9_]+\(/ {
        fn=$0; sub(/^func \(h \*Handler\) /,"",fn); sub(/\(.*/,"",fn)
      }
      /^[[:space:]]*var [A-Za-z0-9_]+ [A-Za-z]/ {
        line=$0; gsub(/^[[:space:]]+/,"",line)
        n=split(line,t,/[[:space:]]+/)         # t[1]=var t[2]=name t[3]=type
        if (n>=3) vt[t[2]]=t[3]
      }
      /c\.Bind\(&[A-Za-z0-9_]+\)/ {
        v=$0; sub(/.*c\.Bind\(&/,"",v); sub(/\).*/,"",v)
        ty=(v in vt)?vt[v]:"(型不明)"
        print "| `" d ".Handler." fn "` | `" ty "` |"
      }
    ' "$hf"
  done
  echo
  echo '### 7-2-2. リクエスト/入力 DTO 構造体'
  echo
  echo '> 選別: 名前(大小文字無視)に `request`/`input`/`params`/`payload` を含む、または'
  echo '> `body` 終端の struct。`*Response`(§7)と `Handler`(依存保持)は除外。lowercase も含む。'
  echo
  find internal/api -name '*.go' ! -name '*_test.go' | sort | while read -r f; do
    awk -v file="$f" '
      /^type[[:space:]]+[A-Za-z0-9_]+[[:space:]]+struct[[:space:]]*\{/ {
        sname=$2; lname=tolower(sname)
        if (sname ~ /Response$/ || sname=="Handler" || sname=="handler") { capture=0; next }
        if (lname ~ /request|input|params|payload/ || lname ~ /body$/) {
          capture=1; fields=""; next
        }
        capture=0; next
      }
      capture==1 && /^\}/ {
        if (fields=="") fields="(フィールドなし)"
        gsub(/\|/,"\\|",fields)
        print "- **" sname "** (`" file "`): " fields
        capture=0; next
      }
      capture==1 {
        line=$0
        if (line ~ /^[[:space:]]*\/\//) next           # コメント行スキップ
        sub(/[[:space:]]*\/\/.*/,"",line)              # 行末 // コメント除去
        gsub(/^[[:space:]]+/,"",line); gsub(/[[:space:]]+$/,"",line)
        if (line=="") next
        m=split(line,toks,/[[:space:]]+/)
        # 埋め込み(単一トークンの大文字始まり型名)→ (embeds X)
        if (m==1 && toks[1] ~ /^[A-Z][A-Za-z0-9_]*$/) {
          entry="(embeds " toks[1] ")"
          fields=(fields=="" ? entry : fields " / " entry); next
        }
        if (m<2) next
        ftype=toks[2]
        jtag=""
        if (match(line,/json:"[^"]*"/)) { jtag=substr(line,RSTART,RLENGTH); sub(/json:"/,"",jtag); sub(/"$/,"",jtag) }
        if (jtag=="" || jtag=="-") next                # json タグ無し(埋め込み済/サービス注入)/ 除外はスキップ
        entry=jtag " `" ftype "`"
        fields=(fields=="" ? entry : fields " / " entry)
      }
    ' "$f"
  done
  echo
}

# ---------------------------------------------------------------------------
# §8 model ドメイン構造体(internal/model/*.go)
#   `type Xxx struct` を捕捉し、各フィールドを `名前 `Go型` (db:…, json:…)` 形式で列挙。
#   db タグ = DB 列、json タグ = API 投影。`db:"-"` は DB マップ対象外(JOIN 取得・
#   サービス層注入・計算フィールド)であり、GET ハンドラ/サービスの投影の実体を示す。
#   タグ無しフィールドも欠落させない(db:— / json:— と表示)。
# ---------------------------------------------------------------------------
emit_model_structs() {
  echo '## 8. model 構造体(source: `internal/model/*.go`)'
  echo
  echo '> ドメインモデルの実体。**`db` タグ = DB 列、`json` タグ = API 投影**。'
  echo '> **`db:-` は DB マップ対象外**(JOIN 取得・サービス層注入・計算フィールド)で、'
  echo '> repository の scan や GET ハンドラ/サービスの投影の実体を示す(推測投影の防止)。'
  echo '> 各エントリは `名前 \`Go型\` (db:…, json:…)` 形式。タグ無しは `—`。'
  echo
  find internal/model -name '*.go' ! -name '*_test.go' | sort | while read -r f; do
    awk -v file="$f" '
      /^type[[:space:]]+[A-Za-z0-9_]+[[:space:]]+struct[[:space:]]*\{/ {
        sname=$2; capture=1; fields=""; next
      }
      capture==1 && /^\}/ {
        if (fields=="") fields="(フィールドなし)"
        gsub(/\|/,"\\|",fields)
        print "- **" sname "** (`" file "`): " fields
        capture=0; next
      }
      capture==1 {
        line=$0
        if (line ~ /^[[:space:]]*\/\//) next           # コメント行スキップ
        sub(/[[:space:]]*\/\/.*/,"",line)              # 行末 // コメント除去
        gsub(/^[[:space:]]+/,"",line); gsub(/[[:space:]]+$/,"",line)
        if (line=="") next
        m=split(line,toks,/[[:space:]]+/)
        if (m<2) next
        fname=toks[1]; ftype=toks[2]
        db=""; js=""
        if (match(line,/db:"[^"]*"/))   { db=substr(line,RSTART,RLENGTH); sub(/db:"/,"",db); sub(/"$/,"",db) }
        if (match(line,/json:"[^"]*"/)) { js=substr(line,RSTART,RLENGTH); sub(/json:"/,"",js); sub(/"$/,"",js) }
        tagpart=""
        if (db!="" || js!="") tagpart=" (db:" (db==""?"—":db) ", json:" (js==""?"—":js) ")"
        entry=fname " `" ftype "`" tagpart
        fields=(fields=="" ? entry : fields " / " entry)
      }
    ' "$f"
  done
  echo
}

# ---------------------------------------------------------------------------
# §9 repository 構造体(internal/repository/**/*.go)
#   scan 先 / フィルタ / 入力の **公開構造体のみ**(`type [A-Z]…struct`)を捕捉。
#   lowercase `repository struct { db *sql.DB }` と interface は自動除外される。
#   タグを持たないため `名前 `Go型`` 形式で列挙。repository の scan が読む列の実体を示す。
# ---------------------------------------------------------------------------
emit_repo_structs() {
  echo '## 9. repository 構造体(source: `internal/repository/**/*.go`)'
  echo
  echo '> scan 先 / フィルタ / 入力の **公開構造体**。例: `MoveListItem`(scan 先の列)、'
  echo '> `ListFilter`(絞り込み)、`UpdateMetadataInput`(更新入力)。'
  echo '> lowercase の `repository`(`*sql.DB` 保持)と interface は除外。'
  echo '> repository の scan 実装が読む列の実体を示す(推測 scan の防止)。'
  echo
  find internal/repository -name '*.go' ! -name '*_test.go' | sort | while read -r f; do
    awk -v file="$f" '
      /^type[[:space:]]+[A-Z][A-Za-z0-9_]*[[:space:]]+struct[[:space:]]*\{/ {
        sname=$2; capture=1; fields=""; next
      }
      capture==1 && /^\}/ {
        if (fields=="") fields="(フィールドなし)"
        gsub(/\|/,"\\|",fields)
        print "- **" sname "** (`" file "`): " fields
        capture=0; next
      }
      capture==1 {
        line=$0
        if (line ~ /^[[:space:]]*\/\//) next           # コメント行スキップ
        sub(/[[:space:]]*\/\/.*/,"",line)              # 行末 // コメント除去
        gsub(/^[[:space:]]+/,"",line); gsub(/[[:space:]]+$/,"",line)
        if (line=="") next
        m=split(line,toks,/[[:space:]]+/)
        if (m<2) next
        entry=toks[1] " `" toks[2] "`"
        fields=(fields=="" ? entry : fields " / " entry)
      }
    ' "$f"
  done
  echo
}

# ---------------------------------------------------------------------------
# §10 マイグレーション(migrations/*.up.sql)
#   DB スキーマの一次情報。model(§8)/repository(§9)の Go 型では SQL の列型・
#   NOT NULL・DEFAULT・FK・INDEX が分からないため、up マイグレーションの DDL を抽出する。
#   10-1: 連番一覧 + up/down 対応(次の連番・命名規則の確認用)。
#   10-2: 各 up の DDL 操作(CREATE/ALTER/DROP TABLE・CREATE/DROP INDEX・RENAME)。
#         CREATE TABLE は列定義を SQL のまま列挙。データ投入/更新/削除
#         (INSERT/UPDATE/DELETE)はテーブル単位で 1 行に要約(seed 行は展開しない)。
# ---------------------------------------------------------------------------
emit_migrations() {
  echo '## 10. マイグレーション(source: `migrations/*.sql`)'
  echo
  echo '> **DB スキーマの一次情報**。SQL の列型・NOT NULL・DEFAULT・FK・INDEX は model 構造体'
  echo '> (§8)/repository 構造体(§9)の Go 型では分からないため、ここを参照すること。'
  echo '> 新規マイグレーションの **次の連番・命名規則** も 10-1 で確認する。'
  echo
  echo '### 10-1. マイグレーション一覧(連番・up/down 対応)'
  echo
  echo '| 連番 | 名前 | up | down |'
  echo '|---|---|---|---|'
  for up in migrations/*.up.sql; do
    [ -e "$up" ] || continue
    base="$(basename "$up" .up.sql)"
    seq="${base%%_*}"
    name="${base#*_}"
    dmark='—'; [ -e "migrations/${base}.down.sql" ] && dmark='✓'
    echo "| ${seq} | ${name} | ✓ | ${dmark} |"
  done
  echo
  echo '### 10-2. 各 up マイグレーションの DDL 操作'
  echo
  echo '> スキーマ変更文(CREATE/ALTER/DROP TABLE・CREATE/DROP INDEX・RENAME)を抽出。'
  echo '> `CREATE TABLE` は列定義を SQL のまま列挙する(これが列型・制約の一次情報)。'
  echo '> データ投入/更新/削除(INSERT/UPDATE/DELETE)はテーブル単位で 1 行に要約(seed 行は展開しない)。'
  echo '> テーブル再構築(C-11 等)は `CREATE TABLE new_xxx` → `INSERT` → `DROP TABLE` → `RENAME TO` が'
  echo '> 並ぶ。**ある列の最新の定義は、その列を最後に触った連番のマイグレーションを見ること。**'
  echo
  for up in migrations/*.up.sql; do
    [ -e "$up" ] || continue
    base="$(basename "$up" .up.sql)"
    echo "- **${base}**"
    awk '
      function clean(s) {
        sub(/[[:space:]]*--.*/,"",s)                # 行コメント除去
        gsub(/^[[:space:]]+/,"",s); gsub(/[[:space:]]+$/,"",s)
        return s
      }
      { line=clean($0); if (line=="") next }
      # CREATE TABLE 本体の列キャプチャ中(他の文判定より先に処理)
      capture==1 {
        if (line ~ /^\)/) { capture=0; next }        # 閉じ括弧で終了
        col=line; sub(/,[[:space:]]*$/,"",col); gsub(/[[:space:]]+/," ",col)
        gsub(/\|/,"\\|",col)
        if (col!="") print "    - `" col "`"
        next
      }
      line ~ /^CREATE TABLE/ {
        t=line; sub(/^CREATE TABLE[[:space:]]+/,"",t); sub(/[[:space:]]*\(.*/,"",t)
        print "  - CREATE TABLE `" t "`:"
        capture=1; next
      }
      line ~ /^ALTER TABLE/ {
        a=line; sub(/;[[:space:]]*$/,"",a); gsub(/[[:space:]]+/," ",a); gsub(/\|/,"\\|",a)
        print "  - " a; next
      }
      line ~ /^DROP TABLE/ {
        d=line; sub(/;[[:space:]]*$/,"",d); gsub(/[[:space:]]+/," ",d)
        print "  - " d; next
      }
      line ~ /^CREATE([[:space:]]+UNIQUE)?[[:space:]]+INDEX/ {
        i=line; sub(/;[[:space:]]*$/,"",i); gsub(/[[:space:]]+/," ",i); gsub(/\|/,"\\|",i)
        print "  - " i; next
      }
      line ~ /^DROP[[:space:]]+INDEX/ {
        i=line; sub(/;[[:space:]]*$/,"",i); gsub(/[[:space:]]+/," ",i)
        print "  - " i; next
      }
      # データ操作はテーブル単位で 1 行に要約(seed 行は展開しない)
      line ~ /^INSERT([[:space:]]+OR[[:space:]]+(IGNORE|REPLACE))?[[:space:]]+INTO/ {
        v=line; sub(/^INSERT([[:space:]]+OR[[:space:]]+(IGNORE|REPLACE))?[[:space:]]+INTO[[:space:]]+/,"",v)
        sub(/[[:space:]].*/,"",v); sub(/\(.*/,"",v)
        if (!(("I" v) in seen)) { seen["I" v]=1; print "  - INSERT INTO `" v "`(データ投入)" }
        next
      }
      line ~ /^UPDATE[[:space:]]/ {
        v=line; sub(/^UPDATE[[:space:]]+/,"",v); sub(/[[:space:]].*/,"",v)
        if (!(("U" v) in seen)) { seen["U" v]=1; print "  - UPDATE `" v "`(データ更新)" }
        next
      }
      line ~ /^DELETE[[:space:]]+FROM/ {
        v=line; sub(/^DELETE[[:space:]]+FROM[[:space:]]+/,"",v); sub(/[[:space:]].*/,"",v); sub(/;.*/,"",v)
        if (!(("D" v) in seen)) { seen["D" v]=1; print "  - DELETE FROM `" v "`(データ削除)" }
        next
      }
    ' "$up"
  done
  echo
}

# ---------------------------------------------------------------------------
# §6 共通 UI ナビリンク(Header.tsx, Footer.tsx)
# ---------------------------------------------------------------------------
emit_nav() {
  echo '## 6. 共通ナビリンク(source: `web/src/components/Header.tsx`, `Footer.tsx`)'
  echo
  echo '> 画面追加時はナビへのリンク追加漏れに注意(M6-6)。`disabled` は未実装リンク。'
  echo
  echo '| 配置 | to | label / 抜粋 | 状態 |'
  echo '|---|---|---|---|'
  for nf in web/src/components/Header.tsx web/src/components/Footer.tsx; do
    [ -e "$nf" ] || continue
    place="$(basename "$nf" .tsx)"
    awk -v place="$place" '
      /\{[[:space:]]*(to|label):.*to:[[:space:]]*"/ || /\{[[:space:]]*to:[[:space:]]*"/ {
        if (match($0,/to:[[:space:]]*"[^"]+"/)) {
          to=substr($0,RSTART,RLENGTH); sub(/to:[[:space:]]*"/,"",to); sub(/"$/,"",to)
        } else next
        lbl=""
        if (match($0,/label:[[:space:]]*[^,}]+/)) { lbl=substr($0,RSTART,RLENGTH); sub(/label:[[:space:]]*/,"",lbl) }
        gsub(/[[:space:]]+$/,"",lbl); gsub(/\|/,"\\|",lbl)
        state=($0 ~ /disabled:[[:space:]]*true/) ? "disabled" : "active"
        print "| " place " | `" to "` | " lbl " | " state " |"
      }
    ' "$nf"
  done
  echo
  echo '### 6-1. その他の `<Link to="...">` リテラル(ブランドロゴ等)'
  echo
  grep -rhoE 'to="[^"]+"' web/src/components/Header.tsx web/src/components/Footer.tsx 2>/dev/null \
    | sort -u | sed -E 's/^/- `/; s/$/`/' || true
  echo
}

# ---------------------------------------------------------------------------
# 組み立て + 抽出破損ガード
#   各セクションを変数へ集約し、主要セクションが 0 件なら(リファクタで抽出パターンが
#   壊れた可能性)stderr に報告して exit 1。OUT は更新しない。
# ---------------------------------------------------------------------------
sec1="$(emit_components)"
sec2="$(emit_hooks_querykeys)"
sec3="$(emit_routes)"
sec4="$(emit_go_routes)"
sec5="$(emit_config)"
sec7="$(emit_responses)"
sec7b="$(emit_request_dtos)"
sec6="$(emit_nav)"
sec8="$(emit_model_structs)"
sec9="$(emit_repo_structs)"
sec10="$(emit_migrations)"

fail=0
need() {  # ラベル, セクション内容, 「1 件以上あれば一致する」ERE パターン
  if ! printf '%s\n' "$2" | grep -qE "$3"; then
    echo "❌ 抽出破損の疑い: $1 が 0 件です(抽出パターンが壊れた可能性。手編集で取り繕わず原因を調査してください)" >&2
    fail=1
  fi
}
need "§1 コンポーネント Props"   "$sec1" 'web/src/.*\.tsx'
need "§2-1 カスタムフック"        "$sec2" '\| `use[A-Z]'
need "§2-2 queryKeys ファクトリ"   "$sec2" '\| `queryKeys\.'
need "§3 ルート"                  "$sec3" '\| `/'
need "§4 Go ルート↔ハンドラ"      "$sec4" '^\| (GET|POST|PUT|PATCH|DELETE) '
need "§5 config 構造体"           "$sec5" '^- \*\*\['
need "§7 Response 構造体"         "$sec7" '^- \*\*'
need "§7-2 c.Bind マップ"         "$sec7b" '\| `combo\.Handler\.Create`'
need "§7-2 入力 DTO 構造体"        "$sec7b" '^- \*\*CreateRequest\*\*'
need "§8 model 構造体"            "$sec8" '^- \*\*'
need "§9 repository 構造体"        "$sec9" '^- \*\*'
need "§10-1 マイグレーション一覧"  "$sec10" '^\| 000001 '
need "§10-2 マイグレーション DDL"   "$sec10" 'CREATE TABLE `combos`'
if [ "$fail" -ne 0 ]; then
  echo "生成を中止しました($OUT は更新していません)。" >&2
  exit 1
fi

{
  cat <<EOF
# code-facts.md(自動生成 — **手編集禁止**)

生成: ${GEN_DATE} / commit \`${GEN_COMMIT}\` / \`scripts/generate-code-facts.sh\`

本資料は設計担当(Web 版 Claude)が指示書を書く際の **機械的事実の参照元** です。
retrospective-log.md §1 パターン A/C「実コード確認の省略」を防ぐため、Props・queryKey・
ルート・ハンドラ・config・ナビリンク・Response DTO・リクエスト/入力 DTO・model 構造体(db↔json)・
repository 構造体(scan/filter/input)・マイグレーション(DB スキーマの DDL)を実コードから
決定論的に抽出しています。

## 本資料の限界

- **静的 grep/awk 抽出** のため、以下は取りこぼし・不正確になりうる:
  - コメントアウトされた定義、\`// TODO\` 等で無効化されたコード
  - 動的生成(map/ループで組むルートや queryKey、スプレッド展開)
  - 型エイリアス・継承(\`interface X extends Y\`)経由の **間接的な** Props
  - queryKey の**呼び出し側**(どのフックが \`queryKeys.combo.detail(id)\` を呼ぶか)。§2-2 は
    正本の定義だけを写す。★呼び出し側の当たり判定は \`query-keys.invalidation.test.ts\` が表で固定している
  - 複数行にわたる複雑な型注釈(関数型の引数等は簡略化されることがある)
  - §2-2 は(ファイル, 用途, キー)が同一の行を重複排除する。同一ファイル内の複数 mutation が
    同じキーを invalidate していても 1 行に集約され、どの mutation かまでは区別しない
  - §7 は型継承を辿らない。Go の埋め込み(embedded struct)フィールドは展開されない
  - §7-2(リクエスト/入力 DTO)の抽出方式と取りこぼし:
    - 7-2-2 は **struct 名のパターン**(\`request\`/\`input\`/\`params\`/\`payload\` を含む、
      または \`body\` 終端。大小文字無視)で選別する。\`c.Bind\` 実引数の型は **追跡しない**
      (struct 定義ベース)。一方 7-2-1 は \`var X Type\` → \`c.Bind(&X)\` の宣言追跡で
      ハンドラ↔入力型を解決する(コードベースが一貫して \`var req Type\` 形のため成立)
    - バインド先型が \`internal/api\` 外で定義される場合(例 \`model.CreateTagInput\` /
      \`model.UpdateTagInput\`)は 7-2-1 マップには現れるが、**構造体定義は §8 を参照**
    - 名前パターンに合致しない入力サブ構造体(例 config の \`*UpdateDTO\`)は 7-2-2 に
      現れない。トップレベル(\`UpdateConfigRequest\`)経由で型名は判別可
    - 埋め込み(embedded struct)は展開せず \`(embeds X)\` 表示(§7 同様)。
      例: \`PutRequest\` = \`version\` + \`(embeds CreateRequest)\`
  - §8 / §9(model / repository 構造体)も同様に Go の埋め込み(embedded struct)は展開しない。
    §9 は **公開構造体のみ**で、lowercase \`repository\`(\`*sql.DB\` 保持)と interface は対象外
  - §10(マイグレーション)は \`*.up.sql\` のみを対象とし、**累積適用後の「現在のスキーマ」は再構成しない**
    (各連番の DDL を時系列で列挙するのみ)。ある列の最新定義は、その列を最後に触った連番を辿ること。
    \`CREATE TABLE\` の列定義は **\`(\` が文頭行の末尾にある前提**で抽出する(列が同一行に続く形は非対応)。
    INSERT/UPDATE/DELETE はテーブル単位で要約し、投入される **seed 行の中身は展開しない**。
    SQL 関数呼び出しや CHECK 制約等は行内に現れる範囲でそのまま列に含む(構文解析はしない)
- 本資料は **「コードに存在する事実」のみ** を列挙する。設計意図・あるべき姿・
  「実装すべきか」は判定しない。事実と設計判断は設計担当が突き合わせること。
- 最終的な正は常に実コード。疑わしい場合は本資料ではなくソースを確認すること。

---

EOF
  printf '%s\n\n---\n\n' "$sec1"
  printf '%s\n\n---\n\n' "$sec2"
  printf '%s\n\n---\n\n' "$sec3"
  printf '%s\n\n---\n\n' "$sec4"
  printf '%s\n\n---\n\n' "$sec5"
  printf '%s\n\n---\n\n' "$sec6"
  printf '%s\n\n---\n\n' "$sec7"
  printf '%s\n\n---\n\n' "$sec7b"
  printf '%s\n\n---\n\n' "$sec8"
  printf '%s\n\n---\n\n' "$sec9"
  printf '%s\n' "$sec10"
} > "$OUT"

echo "✅ 生成しました: $OUT (${GEN_DATE}, commit ${GEN_COMMIT})"

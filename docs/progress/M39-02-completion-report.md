# M39-02 完了報告: ラッシュ版の生成経路が実行時に `D-187` を破る穴を塞ぐ

| 項目 | 内容 |
|------|------|
| 作業ID | `M39-02` |
| 指示書 | `docs/instructions/M39-02-rush-variant-invariant-fix.md` **v1.0.0** |
| チェックリスト | `docs/instructions/reviews/M39-02-review-checklist.md` **v1.0.0** |
| 上位 | `docs/instructions/M39-overview.md` **v1.3.0** |
| 実施日 | 2026-09-19 |
| 枝元コミット（着手基点） | **`0e50b76`** |
| マイグレ消費 | **0 本**（`migrations/` の差分は **0 行**。`*.up.sql` は 9 本のまま） |
| CHANGE 消費 | **0 本**（自採番しない＝`D-293`。原稿 1 本を設計伝達レポート §1 / §6 へ回す） |

---

## 0. 結論（先に 3 行）

1. **是正 *前* に壊れることを実 API で再現した**——`startup` が NULL の元技からラッシュ版を作ると `startup NULL` ＋ `startup_basis='through'` の行ができ、不変条件の違反が **0 → 1** に増えた。
2. **その状態で `M39-01` のガードは緑のまま素通りした**（`EXIT=0`）。⇒ これが「この穴は実行時であり、HEAD ガードでは捕まらない」の立証である。
3. **案 (a) で是正し、同じ操作で違反が 0 のままになった。** 元技が `startup` を持つ場合の挙動は 1 ビットも変わっていない（対照で確認）。

---

## 1. 着手前の版ゲート（§0.6・6 点）

| # | 確かめたこと | 結果 |
|---|---|---|
| 1 | チェックリストの存在 | **OK**。`docs/instructions/reviews/M39-02-review-checklist.md` v1.0.0 が実在 |
| 2 | `M39-01` の着地 | **OK**。`ls migrations/*.up.sql \| wc -l` = **9** ／ 新規構築 DB の違反件数 = **0**（下記 1.1） |
| 3 | `go test ./...` が緑 | **OK**。`EXIT=0` ／ `^--- FAIL` の件数 **0** ／ `ok` パッケージ **60** |
| 4 | 3 件の元技を `code` で引き直す | **OK**。**3 件**（下記 1.2）。★`1364` / `2145` / `2555` は引き写しではなく実測で一致した |
| 5 | `M39-overview.md` が v1.3.0 | **OK**（ヘッダ実査） |
| 6 | 枝元のコミット | **`0e50b76`** |

### 1.1 ゲート 2・3 の出力

```
$ go test ./... > gotest-before.txt 2>&1; echo "EXIT=$?"
EXIT=0
$ grep -cE "^--- FAIL" gotest-before.txt
0
$ grep -cE "^ok" gotest-before.txt
60

--- SQL: SELECT count(*) AS d187_violations FROM moves WHERE startup IS NULL AND startup_basis <> 'unknown'
d187_violations
0
(1 rows)

--- SQL: SELECT count(*) AS null_startup_rows FROM moves WHERE startup IS NULL
null_startup_rows
362
(1 rows)
```

★母数（`startup IS NULL` の行）が **362 行**あるうえでの違反 0 である。⇒ 空振りではない。

### 1.2 ゲート 4 の出力（**★`move_code` で引き直した**）

```
--- SQL: SELECT c.code AS chara, m.id, m.code AS move_code, m.category, m.is_aerial, m.startup, m.startup_basis
           FROM moves m JOIN characters c ON c.id=m.character_id
          WHERE m.category IN ('normal','unique') AND m.is_aerial=0 AND m.startup IS NULL
          ORDER BY c.code, m.code
chara | id | move_code | category | is_aerial | startup | startup_basis
alex | 2145 | prowler_stance | unique | 0 | NULL | unknown
dee_jay | 2555 | speedy_maracas | unique | 0 | NULL | unknown
rashid | 1364 | run | unique | 0 | NULL | unknown
(3 rows)
```

**件数は 3 であり、指示書 §0.2 の記載と一致した。**（母集団は動いていない。★述語で引いた結果として一致したのであって、id を引き写してはいない。）

---

## 2. 段 1 — 再現（**是正 *前* ・実 API**）

**実サーバ ＋ `curl`** で行った。`internal/config` の一時上書き（`TACPENDIUM_DB_PATH` / `TACPENDIUM_CONFIG_PATH` / `TACPENDIUM_PORT`）を使い、**使い捨て DB `tmp/m39-02/repro.db` ＋ 専用ポート 47399 ＋ スクラッチ config** で起動した。⇒ dev DB・dev サーバ・E2E スタックのいずれにも触れていない。

### 2.1 再現前の状態

```
--- SQL: SELECT count(*) AS d187_violations FROM moves WHERE startup IS NULL AND startup_basis <> 'unknown'
d187_violations
0
--- SQL: ... WHERE m.id=1364
chara | id | code | category | is_aerial | startup
rashid | 1364 | run | unique | 0 | NULL
--- SQL: SELECT count(*) AS rush_run_already_exists ... c.code='rashid' AND m.code='rush_run'
rush_run_already_exists
0
```

### 2.2 実 API を叩く（§2.1-1）

```
$ curl -i -X POST http://127.0.0.1:47399/api/moves/1364/rush-variant
HTTP/1.1 201 Created
Content-Type: application/json
X-Request-Id: 8b871847c955e8b206bf3fd4ad5579b1
Content-Length: 141

{"id":3237,"characterId":18,"code":"rush_run","category":"rush_variant","originalMoveId":1364,"damage":0,"isAerial":false,"setupOnly":false}
```

### 2.3 できた行と不変条件（§2.1-2）

```
--- SQL: SELECT c.code, m.id, m.code, m.category, m.original_move_id, m.startup, m.startup_basis, m.is_derived ...
chara | id | code | category | original_move_id | startup | startup_basis | is_derived
rashid | 3237 | rush_run | rush_variant | 1364 | NULL | through | 1
(1 rows)

--- SQL: SELECT count(*) AS d187_violations_AFTER FROM moves WHERE startup IS NULL AND startup_basis <> 'unknown'
d187_violations_AFTER
1
(1 rows)

--- SQL: SELECT m.id, m.code, m.category, m.startup, m.startup_basis FROM moves m WHERE m.startup IS NULL AND m.startup_basis <> 'unknown'
id | code | category | startup | startup_basis
3237 | rush_run | rush_variant | NULL | through
(1 rows)
```

**⇒ `startup NULL` ＋ `startup_basis='through'` の行ができ、違反が 0 → 1 に増えた。再現できた。**

### 2.4 ★★★立証 — 同じ状況で `M39-01` のガードは緑のまま（§2.1-3 / §0.1）

```
$ go test ./internal/infra/migration/ -run 'TestRun_HEAD_StartupBasis' -v -count=1
=== RUN   TestRun_HEAD_StartupBasisUnknownWhenStartupNull
--- PASS: TestRun_HEAD_StartupBasisUnknownWhenStartupNull (0.08s)
=== RUN   TestRun_HEAD_StartupBasisInvariantDetectorBites
    head_seed_invariants_test.go:323: 破壊確認: 違反件数 0 -> 1(1 行を 'standalone' へ戻した)
--- PASS: TestRun_HEAD_StartupBasisInvariantDetectorBites (0.07s)
=== RUN   TestRun_HEAD_StartupBasisPartitionsAllMoves
--- PASS: TestRun_HEAD_StartupBasisPartitionsAllMoves (0.07s)
PASS
ok  	github.com/plexiblinp/tacpendium/internal/infra/migration	0.225s
EXIT=0
```

**⇒ 実 DB が違反を 1 件抱えている *その時に*、ガードは `EXIT=0` で緑である。**

**★なぜ緑なのか（機構）**——`TestRun_HEAD_*` は `newMigrator(t)`（`internal/infra/migration/helpers_test.go:32`）が `t.TempDir()` に作る **別のまっさらな DB** を見る。⇒ 利用者が操作して汚した DB を 1 行も読まない。**「ガードが在るから大丈夫」は本経路には効かない。**

### 2.5 対照（§2.1-4）— `startup` を持つ元技

```
$ curl -i -X POST http://127.0.0.1:47399/api/moves/741/rush-variant   # juri/death_crest_2hits (startup=12)
HTTP/1.1 201 Created
{"id":3238,"characterId":13,"code":"rush_death_crest_2hits","category":"rush_variant","originalMoveId":741,"startup":12,"active":3,"total":34,"onBlock":-3,"damage":1100,"recovery":20,"isAerial":false,"setupOnly":false}

chara | id | code | category | startup | total | startup_basis
juri | 741 | death_crest_2hits | unique | 12 | 34 | standalone
juri | 3238 | rush_death_crest_2hits | rush_variant | 12 | 34 | through
```

**⇒ 是正 *前* の基準線。この行は `'through'` が正しい**（通し値の元が在る）。**是正後にここが変わっていないことが §4.3 で示される。**

---

## 3. 段 2 — 是正

### 3.1 採った案 = **(a)**（完了条件 6 / B-1）

**元技の `startup` が `NULL` なら `startup_basis` に `'unknown'` を入れる。**

| 採否 | 案 | 理由 |
|---|---|---|
| **採用** | **(a)** | 設計卓の推し。**提供する技の集合が変わらない**（ボタンが消えない＝UX 不変）。`DES-003` §3.3 (i)「本列は *格納されている startup の由来* を表すのであって、値が無い行に由来は無い」の述語そのものである |
| 不採用 | (b) `rushEligible` で弾く | **UX が変わる**（3 キャラでボタンが消える）ため開発者承認が要る（§7-1）。(a) で不変条件を満たせる以上、承認を要する変更を選ぶ理由が無い。⇒ **`rushEligible` は 1 行も触っていない** |

### 3.2 置き場 = **Go 側で値を決めて渡す**（完了条件 6 / B-4）

`insertRushVariantSQL` の `VALUES` 末尾を `..., 1, 'through')` → `..., 1, ?)` にし、値は新設の `rushStartupBasis(srcStartup *int) string` が決める。

```go
func rushStartupBasis(srcStartup *int) string {
	if srcStartup == nil {
		return model.MoveStartupBasisUnknown
	}
	return model.MoveStartupBasisThrough
}
```

**SQL の `CASE` ではなく Go 側にした理由（4 点）**:

| # | 理由 |
|---|---|
| 1 | **`CLAUDE.md` §4「列挙的文字列定数はパッケージ定数として定義」へ戻せる。** `model.MoveStartupBasisThrough` / `...Unknown`（`internal/model/move.go:49-51`）は既に在り、**SQL リテラルだけがその外に居た** |
| 2 | **`CASE WHEN ? IS NULL THEN 'unknown' ELSE 'through' END` は `src.Startup` を 2 回バインドすることになる。** `startup` は同じ `VALUES` 行の中から参照できないためである。⇒ 既に 14 個ある `?` の対応がさらに読みにくくなる |
| 3 | **述語に名前が付き、godoc から `DES-003` §3.3 (i) / `D-187` へ辿れる。** 値を決める規則が 1 か所に集まる |
| 4 | **`M19-04` §4.5 の実質は保たれる。** 同節の懸念は「**列挙しないと DDL の DEFAULT で静かに `unknown` が入る**」であり、本是正でも **列は明示列挙のまま・値は常に明示的に与える**。DEFAULT へ委ねていない |

### 3.3 射程の自己確認（§3・B-2 / B-3 / B-5）

| # | やらなかったこと | 確認 |
|---|---|---|
| 1 | `'through'` を*一般に*外していない | **元技が `startup` を持つ場合の返り値は `'through'`**。対照テスト（§4.3）が歯止め |
| 2 | `startup` を持つ元技の挙動を変えていない | §4.3 の出力が是正前（§2.5）と**値まで一致**（`startup=12` / `total=34` / `'through'`） |
| 3 | `migrations/` を触っていない | `git diff 0e50b76 -- migrations/ \| wc -l` = **0** |
| 4 | 件数のハードガードを置いていない | 差分中に `RAISE(ABORT)` 等 **0 件** |
| 5 | `rushEligible` を変えていない | `internal/service/move/service.go` は**差分 0**（変更ファイル一覧に無い） |
| 6 | `startup` 以外の列に触れていない | 変更は `startup_basis` の値決定 1 か所のみ。`total` / `active` / `recovery` / `damage` のバインドは不変 |
| 7 | `docs/design/` 本体・`followup-backlog.md` を編集していない | 合計**差分 0 行** |

### 3.4 失効記述の追随（**★レビューが「高」に置く型**）

**走査は `--include` で絞らず**、Go・TypeScript・Markdown・JSON をまとめて見た。**出力はファイルへ全量落として `wc -l` で数えた**（`D-881`）。

```
$ git grep -nE "startup_basis|StartupBasis|startupBasis|'through'|\"through\"" \
    -- . ':!docs/' ':!migrations/' ':!character_data/' ':!internal/seedgen/testdata/' ':!web/dist/' \
    > grep-concept-code.txt
$ wc -l < grep-concept-code.txt
177          # 31 ファイル
$ grep -icE "rush" grep-concept-code.txt
14
```

**14 件のうち、是正で失効するのは 2 ファイルだけであった。**

| ファイル | 扱い |
|---|---|
| `internal/repository/move/rush.go:19-25` | **直した。** 旧記述「`startup_basis` は常に `'through'`」「`is_derived` と同じくバインドせずリテラルで書く＝どちらも rush 行では**定数**であり、呼び出し側に選ばせる余地が無い」は**失効**（定数ではなかった）。失効した旨を明記して残した |
| `internal/repository/move/rush_test.go:11-19, 66-70` | **直した。** 同テストが対照でもあることを追記し、エラーメッセージに M39-02 由来の失敗の可能性を足した |
| `.claude/commands/precheck_seed_data.md:111`（`category='rush_variant'` → `startup_basis='through'` か） | **直さない。** 同記述は **CSV/seed データ**の precheck であり、実行時の経路の話ではない。⇒ **seed 済み rush 行 514 件は全件 `startup` が非 NULL** である（実測。下記）ため、seed に対しては引き続き `'through'` が正しい |
| `internal/model/move.go:39-52` | **直さない。** 三値の一般的な定義のみで、rush への言及が無い |
| `docs/design/03-data-model.md:352` | **編集しない**（`CLAUDE.md` §8）。⇒ **CHANGE 原稿**として設計伝達レポート §1 / §6 へ（§6） |

`precheck_seed_data.md` を据え置いた根拠（実測）:

```
--- SQL: SELECT startup_basis, (startup IS NULL) AS startup_is_null, count(*) FROM moves WHERE category='rush_variant' GROUP BY 1,2
startup_basis | startup_is_null | count(*)
through | 0 | 515      ← うち 514 が seed 由来、1 は本再現で生成した対照行
through | 1 | 1         ← 本再現で生成した違反行(id 3237)のみ
```

**⇒ seed 由来の rush 行に `startup IS NULL` の行は 1 行も無い。**

### 3.5 値が変わったことの消費者側への影響（**レビュー 中-3 を受けて追記**）

**★§3.4 の走査は `grep -icE "rush"` で絞っており、`rush` という語を含まない消費者が母集団から落ちていた。** ⇒ 「値が変わる行を*読む*側」を述語で当たり直した。**結論は影響 0 であり、その根拠は以下である。**

値が変わるのは **`category='rush_variant'` ∧ `startup IS NULL`** の行だけである（`'through'` → `'unknown'`）。`startup_basis` を読んで分岐する箇所は 4 つ:

| # | 箇所 | 述語 | 本件の行への影響 |
|---|---|---|---|
| 1 | `internal/service/setplay/service.go:220` `isSoloUnavailable` | `standalone \|\| unknown` ∧ 親参照あり | **無し。** 実行時生成の rush 行に `move_derivations` の親参照は付かない（`InsertRushVariant` は `moves` 行しか書かない）。⇒ `∧ 親参照あり` が成立しない |
| 2 | `internal/service/setplay/service.go:664` target ゲート | `m.IsDerived && m.StartupBasis != through` | **無し。** 同行は **`if !isRushTargetType(ttype)` の内側**に在る（実測 `:654`）。⇒ rush 行はこのブロックに入らない |
| 3 | `internal/service/setplay/service.go:739` `newParentResolver` | `basis != through` → `nil` | **無し。** `through` を通っても直後に `chosen[m.ID]` を引く（親参照由来）。⇒ 1 と同じ理由で引けず、どちらの値でも `nil` になる |
| 4 | `internal/service/punishfinder/service.go:373` `usesFirstHitStartup` | `category == target_combo` ∧ … ∧ `standalone` | **無し。** 第 1 条件が `target_combo` であり、`rush_variant` は通らない |

**★さらに、該当 3 件から作られる rush 行は `damage=0` である**（実 API の応答で確認＝§2.2 の `"damage":0`）。⇒ setplay の target 列挙は既定で `damage>0` を要求するため（`:667`）、**そもそも候補に入らない**。

**★フロントは 1 件も分岐していない。** `startup_basis` は `GET /api/moves` に露出しておらず（`internal/model/move.go:46-47`）、TypeScript 側の該当は `web/src/locales/{ja,en}.json:862` の相互参照マーカー文字列 2 件だけである。**同文面（`M19-LIMITATION-NOTICE`）の更新も不要**——同notice が同期を求めているのは *target 列挙規則* であり、本サブは規則を 1 つも変えていない（変わったのは特定行の値だけである）。

**★`docs/design/` 側で本件に当たる記述は 1 か所だけである**（実測）:

```
$ git grep -nE "insertRushVariantSQL|rush 生成経路|rush_variant.*through|through.*rush_variant" -- 'docs/design/*' | wc -l
1        # docs/design/03-data-model.md:352
```

---

## 4. 段 3 — テスト

### 4.1 置いたもの

| テスト | 置き場 | 役目 |
|---|---|---|
| `TestInsertRushVariant_StartupNullSourceKeepsInvariant` | `internal/repository/move/rush_runtime_invariant_test.go`（**新規**） | **実行時の経路のガード**（C-1） |
| `TestInsertRushVariant_RuntimeInvariantDetectorBites` | 同上 | **破壊確認（常設）**（C-2） |
| `TestInsertRushVariant_FrameCostColumnDefaults` | `internal/repository/move/rush_test.go`（既存を強化） | **対照**（C-3） |
| `TestHandler_RushVariant_201_then_409` | `internal/api/move/handler_test.go`（既存へ主張を追加） | **HTTP 経路まで通しても同じ値**であること |

**置き場の理由（C-5）**: `SUPP-001` §5.5 規約 **(24)-3** が形を決めている——**HEAD ガードは「新規 DB の最終状態」しか見ない**ので、`TestRun_HEAD_*` をもう 1 本足しても本件は捕まらない。⇒ 是正した経路が居るパッケージに、`dbtest.Setup(t)` で実 DB を使う形で置いた（既存 `rush_test.go` と同じ形）。

**性格の違いは、ファイル名（`rush_runtime_invariant_test.go`）と冒頭コメントの両方から読める。** 冒頭に HEAD ガードとの対比表を置き、「この違反を HEAD ガードは緑のまま素通りする」ことを明記した。

**★環境変数でゲートしていない**（C-4 / `M39-01` §7-2）。**★元技は述語で選び、`id` も `code` も直書きしていない**（§4.5）。**★母数 0 のときは `t.Fatalf` で落ちる**（空回り検出）。

**★不変条件クエリの式を 2 か所に持つことにした**: 正本は `internal/infra/migration/head_seed_invariants_test.go` の `startupBasisInvariantSQL`、複製は新ファイルの `d187InvariantSQL` である。**相互参照コメント（「式を変えるときは両方」）を双方向に置いた。**

**★★これは「共有できない」のではなく「共有しないことを*選んだ*」である**（レビュー 中-2 を受けて訂正）。正本が package `migration_test` に属するため *そのままでは* import できないのは事実だが、**両パッケージが既に import している `internal/testutil/dbtest` へ述語を移せば共有できた**（循環もしない。実測＝`internal/infra/migration/migrate_m1801_test.go` ほかと `internal/repository/move/rush_test.go` ほかの双方が同 helper を import 済み）。**採らなかった理由**は、同 helper が **DB を用意する道具**であり、不変条件の述語を置く場所ではないと判断したためである。⇒ **代償は「2 か所を同時に直す必要がある」こと**であり、相互参照コメントがその歯止めである。

> **★旧記述の訂正**（レビュー 高-1）——本節は当初「相互参照コメントを双方向に置いた」と書いたが、**取り込み前の時点では複製側にしか無かった**（正本側を `grep` すると `rush_runtime_invariant_test` も `M39-02` も **0 件**）。**⇒ 参照が欠けていたのが*正本側*であったことが危険である**——式を変える人は正本を触り、複製の存在を知らないまま去る。取り込みで正本側へ相互参照を足し、**記述を事実に合わせた。**

### 4.2 是正後に緑であること

```
$ go test ./internal/repository/move/ -run 'TestInsertRushVariant' -v -count=1
=== RUN   TestInsertRushVariant_StartupNullSourceKeepsInvariant
--- PASS: TestInsertRushVariant_StartupNullSourceKeepsInvariant (0.11s)
=== RUN   TestInsertRushVariant_RuntimeInvariantDetectorBites
    rush_runtime_invariant_test.go:186: 破壊確認: 違反件数 0 -> 1(rush 行 id=3237 を是正前の 'through' へ戻した。元技 = "run")
--- PASS: TestInsertRushVariant_RuntimeInvariantDetectorBites (0.01s)
=== RUN   TestInsertRushVariant_FrameCostColumnDefaults
--- PASS: TestInsertRushVariant_FrameCostColumnDefaults (0.01s)
PASS
ok  	github.com/plexiblinp/tacpendium/internal/repository/move	0.131s
EXIT=0
```

**★常設の破壊確認は実際に噛んでいる**（`違反件数 0 -> 1`）。

### 4.3 ★★★破壊確認 — 是正を外すと赤くなること（完了条件 4 / C-2）

`rushStartupBasis` を**常に `'through'` を返す形**へ一時的に倒した（= `M39-02` 以前の挙動）。**この状態はコミットしていない。**

```
$ go test ./internal/repository/move/ ./internal/api/move/ -run 'TestInsertRushVariant|TestHandler_RushVariant' -v -count=1
=== RUN   TestInsertRushVariant_StartupNullSourceKeepsInvariant
    rush_runtime_invariant_test.go:119: startup が NULL の元技 "run" から作った rush 行の startup_basis = "through", want "unknown"(DES-003 §3.3 (i)＝値が無い行に由来は無い。D-187 / M39-02)
    rush_runtime_invariant_test.go:128: ラッシュ版生成後の D-187 違反 = 1, want 0(実行時にこの経路で不変条件が破れている。元技 = "run" / 生成 id = 3237)
--- FAIL: TestInsertRushVariant_StartupNullSourceKeepsInvariant (0.12s)
=== RUN   TestInsertRushVariant_RuntimeInvariantDetectorBites
    rush_runtime_invariant_test.go:165: 破壊前の違反 = 1, want 0(是正が効いておらず、対照にならない)
--- FAIL: TestInsertRushVariant_RuntimeInvariantDetectorBites (0.01s)
=== RUN   TestInsertRushVariant_FrameCostColumnDefaults
--- PASS: TestInsertRushVariant_FrameCostColumnDefaults (0.01s)
FAIL
FAIL	github.com/plexiblinp/tacpendium/internal/repository/move	0.140s
=== RUN   TestHandler_RushVariant_201_then_409
    handler_test.go:480: startup が NULL の元技から作った rush variant の startup_basis = "through", want "unknown"(D-187 / DES-003 §3.3 (i)・M39-02)
--- FAIL: TestHandler_RushVariant_201_then_409 (0.12s)
=== RUN   TestHandler_RushVariant_400_Ineligible
--- PASS: TestHandler_RushVariant_400_Ineligible (0.01s)
=== RUN   TestHandler_RushVariant_409_CodeCollision
--- PASS: TestHandler_RushVariant_409_CodeCollision (0.01s)
FAIL
FAIL	github.com/plexiblinp/tacpendium/internal/api/move	0.140s
FAIL
EXIT=1
```

**⇒ 3 本が赤くなる。★同時に、対照 `TestInsertRushVariant_FrameCostColumnDefaults` は PASS のままである**——これが「是正は `startup` を持つ元技の挙動に触れていない」ことの裏づけでもある。

**復元の確認**（スクラッチに取っておいた是正済みの版を書き戻し、コミットとの差分が 0 であることを見た）:

```
$ git diff --stat
              # 空 = コミット 210fe7a と一致
$ go test ./internal/repository/move/ ./internal/api/move/ -run 'TestInsertRushVariant|TestHandler_RushVariant' -count=1
ok  	github.com/plexiblinp/tacpendium/internal/repository/move	0.127s
ok  	github.com/plexiblinp/tacpendium/internal/api/move	0.118s
```

### 4.4 是正後に同じ操作を実 API でやり直す（完了条件 3）

**是正後のバイナリで新規構築した使い捨て DB `tmp/m39-02/fixed.db`**（違反 0 で開始）に対し、**3 件すべて**叩いた。

```
$ curl -i -X POST http://127.0.0.1:47399/api/moves/1364/rush-variant
HTTP/1.1 201 Created
{"id":3237,"characterId":18,"code":"rush_run","category":"rush_variant","originalMoveId":1364,"damage":0,"isAerial":false,"setupOnly":false}

$ curl ... -X POST .../api/moves/2145/rush-variant -> 201
$ curl ... -X POST .../api/moves/2555/rush-variant -> 201

chara | id | code | category | startup | startup_basis
rashid | 3237 | rush_run | rush_variant | NULL | unknown
alex | 3238 | rush_prowler_stance | rush_variant | NULL | unknown
dee_jay | 3239 | rush_speedy_maracas | rush_variant | NULL | unknown
(3 rows)

--- SQL: SELECT count(*) AS d187_violations_AFTER_FIX FROM moves WHERE startup IS NULL AND startup_basis <> 'unknown'
d187_violations_AFTER_FIX
0
(1 rows)
```

**★対照（是正後）**——§2.5 と**値まで一致**した:

```
$ curl -i -X POST http://127.0.0.1:47399/api/moves/741/rush-variant
HTTP/1.1 201 Created
{"id":3240,...,"originalMoveId":741,"startup":12,"active":3,"total":34,"onBlock":-3,"damage":1100,"recovery":20,...}

chara | id | code | category | startup | total | startup_basis
juri | 741 | death_crest_2hits | unique | 12 | 34 | standalone
juri | 3240 | rush_death_crest_2hits | rush_variant | 12 | 34 | through
```

**⇒ `startup_basis='through'` ／ `startup=12` ／ `total=34`。是正前（§2.5）と 1 ビットも変わっていない。**

---

## 5. 段 4 — 既存の違反行の数え方（**★走らせるのは開発者**）

### 5.1 置き場

**`scripts/migrate-userdata-prompt.md` へ節として追記した**（`M39-01` が足した節の隣・`+77 行`）。**新規ファイルは作っていない**（`CLAUDE.md` §10.Y / D-4）。見出し・構成は `M39-01` 節にそろえた（日付＋サブ名の見出し → 上の節との違いを述べる引用 → なぜ要るか → 番号付きの「数える / 当てる / 確かめる」 → 乾式の証跡 → 次回への注意）。

**★`M39-01` 節との違いを冒頭に明記した**——あちらは**マイグレの中身を書き換えた**ことで検証 DB が取り残される話、こちらは**アプリを操作して作った行**が不変条件を破っている話である。**⇒ `M39-01` の手順を当てた *後* でも残りうる。**

### 5.2 ★乾式検証（D-3。**開発者の検証 DB は触っていない**）

製造が自分で作った使い捨て DB `tmp/m39-02/repro.db`（段 1 で**是正前のバイナリ**に実 API を叩いて違反を 1 件作ったもの）へ、手順 2 → 3 → 4 をそのまま流した。

```
--- 手順 2: 数える ---
--- SQL: SELECT count(*) AS violations FROM moves WHERE startup IS NULL AND startup_basis <> 'unknown'
violations
1
--- SQL: SELECT category, startup_basis, count(*) AS n FROM moves WHERE startup IS NULL AND startup_basis <> 'unknown' GROUP BY 1,2
category | startup_basis | n
rush_variant | through | 1

--- 手順 3: 当てる ---
--- SQL: UPDATE moves SET startup_basis = 'unknown' WHERE startup IS NULL AND startup_basis <> 'unknown'
(rows affected: 1)

--- 手順 4: 確かめる ---
--- SQL: SELECT count(*) AS violations_after FROM moves WHERE startup IS NULL AND startup_basis <> 'unknown'
violations_after
0
--- SQL: PRAGMA foreign_key_check
table | rowid | parent | fkid
(0 rows)
--- SQL: SELECT c.code, m.id, m.code, m.category, m.startup, m.startup_basis ... WHERE m.code='rush_run'
chara | id | code | category | startup | startup_basis
rashid | 3237 | rush_run | rush_variant | NULL | unknown
```

**⇒ 1 件を検出 → `UPDATE` が 1 行に当たる → 0 件・FK 違反 0 行。**
**★直した結果は、是正後のバイナリで新規に作った行（§4.4 の id 3237）と同じ状態である。**

**★内訳クエリ（`category` 別）を足したのは `M39-01` 節との差別化のためである**——`category='rush_variant'` が出れば本経路由来、それ以外が出れば `M39-01` の手順が未適用、と切り分けられる。

### 5.3 ★★★開発者による実環境での実行（**2026-09-20**）

**★★製造の乾式（§5.2）と、開発者の実環境での実行は*別の観測*である。取り違えないこと。**

| 観測 | 対象 | 結果 |
|---|---|---|
| **製造の乾式**（§5.2） | 製造が作った使い捨て DB `tmp/m39-02/repro.db`（**是正前のバイナリで故意に違反行を 1 件作ったもの**） | 違反 **1 件**を検出 → `UPDATE` が **1 行**に当たる → **0 件**・FK 違反 0 行。**⇒ 手順が動くことの立証** |
| **★開発者の実環境** | **開発者の検証 DB** | **違反 0 件・`UPDATE` 不要。** バックアップ作成済み ／ `foreign_key_check` **0 件** ／ 整合性検査 **OK** ／ **全テーブルのデータ変更なし** |

**⇒ 実環境には本経路由来の違反行が 1 行も無かった。** 是正前のバイナリで画面18 からラッシュ版を作った履歴が無かったということである（画面18 は `FR703` の開発者向けの面であり、`M38-02` で導線が除去されている＝§10.3）。

**★★これにより、設計伝達レポート §4-2 が「★残る前提」として挙げていた唯一の未確定事項が消えた。⇒ followup の対 2 行**〔`d187-startup-basis-invariant-violated-at-head` ／ `rush-variant-can-violate-d187-at-runtime`〕**は無条件で閉じられる**（**閉じるのは設計卓の手番**）**。**

**★手順そのものは残す。** 実環境が 0 件であったことは、**手順が不要だったという意味ではない**——数えて 0 を確かめたからこそ 0 と言える。**⇒ `scripts/migrate-userdata-prompt.md` の `M39-02` 節は今後も有効である**（是正前のバイナリを使う別環境があれば同じ手順で数える）。

### 5.4 やらなかったこと

- **マイグレを書いていない**（§2.4-4）。
- **件数のハードガードを置いていない**（規約 (24)-4。**置くとその経路を 1 回通った利用者のアプリが起動しなくなる**）。
- **`startup` 側は直していない**（`unknown` が正しい状態であり「埋めるべき穴」ではない＝`M39-overview` §4.1）。

---

## 6. 段 5 — 設計書の原稿（**本体は編集していない**）

**★CHANGE 原稿は設計伝達レポートの §1 と §6 へ書く（§4 ではない＝計測点 `M-183`）。★自採番しない（`D-293`）。**

**見込み 1 本。** `docs/design/03-data-model.md` §3.3 `startup_basis` 欄の次の記述が**そのままでは失効する**:

> **rush 生成経路（`insertRushVariantSQL`）は `'through'` を明示して INSERT する**

⇒ 「**ラッシュ版の `startup_basis` は元技の `startup` の有無で決まる**（持てば `'through'`、持たなければ `'unknown'`。後者は同節 **機械付与の 3 規約 (i)** の帰結である）」を足す原稿を書く。

**★三値の述語そのものは変わらない。★機械付与の (ii)「`through` と `standalone` が重なったら `through` が勝つ」にも触れない**（本件は `standalone` との衝突ではなく、`startup` の不在の話である）。

---

## 7. 変更したファイル

**★Phase C（レビュー取り込み）まで含めた実測**（レビュー 低-5 を受けて更新。旧版は Phase A 時点の値であり、以後のコミットを含んでいなかった）:

```
$ git diff --numstat 0e50b76
.claude/commands/precheck_seed_data.md                         +1 -1
docs/progress/M39-02-completion-report.md                      +N -0
docs/progress/m39-02-review.md                                 +N -0
docs/progress/progress-log.md                                  +N -0
internal/api/move/handler_test.go                              +23 -3
internal/infra/migration/head_seed_invariants_test.go          +17 -0
internal/repository/move/rush.go                               +35 -9
internal/repository/move/rush_runtime_invariant_test.go        +198 -0
internal/repository/move/rush_test.go                          +31 -7
scripts/migrate-userdata-prompt.md                             +77 -0
```

**★実装面（`internal/` ＋ `scripts/`）の Phase A 時点の値**（破壊確認・射程確認はこの母集団で読んだ）:

```
internal/api/move/handler_test.go                            +23 -3
internal/repository/move/rush.go                             +35 -9
internal/repository/move/rush_runtime_invariant_test.go      +191 -0
internal/repository/move/rush_test.go                        +31 -7
scripts/migrate-userdata-prompt.md                           +77 -0
 5 files changed, 357 insertions(+), 19 deletions(-)
```

**★`E-225` の観点で読んだ**——**新規ファイル `rush_runtime_invariant_test.go` の deletions は `-0` である。** ⇒ 新規のつもりのファイルが既存を上書きしてはいない（Write の前に `ls` / `find` で同名の不在も確認した）。他 4 ファイルの deletions は既存行の**置換**（コメント更新・述語の強化・`SELECT` 列の追加）であり、消したテストは 1 本も無い。

コミット:

| コミット | 内容 |
|---|---|
| `210fe7a` | `fix(M39-02/move)`: 是正 ＋ テスト 3 種 |
| `339f083` | `docs(M39-02)`: 移行ランブックへ数え方・直し方を追記 |
| `2ce3bf2` | `style(M39-02)`: 追記節の閉じない強調を直す |

---

## 8. 全数テスト（**★パイプを挟まずに判定した**）

| # | 対象 | 結果 |
|---|---|---|
| 1 | `go test ./... -count=1` | **`EXIT=0`** ／ `grep -cE "^--- FAIL"` = **0** ／ `ok` パッケージ **60** |
| 2 | `cd web && pnpm test -- --run` | **`EXIT=0`** ／ **Test Files 234 passed (234)** ／ **Tests 2974 passed (2974)** |
| 3 | `make e2e` | **`EXIT=0`** ／ **362 passed (6.0m)** ／ **2 flaky** |

**★`pnpm test` へオプションを渡すには `--` が要る**（`M39-01` §7-5。`pnpm test --run` は `Unknown option: 'run'` で `EXIT=1` になる）。**★出力は 3 本とも全量をファイルへ落とした**（`head` / `tail` で切っていない。`D-881`）。

### 8.1 E2E の 2 flaky の内訳（**★集計行だけで済ませない**）

```
  2 flaky
    [chromium] › e2e/m31-02-tag-field-drag.spec.ts:49:5 › M31-02 追補: タグ欄で始めたドラッグの文字選択 › 右へ枠外までドラッグしても文字選択が消えない
    [chromium] › e2e/m31-02-tag-field-drag.spec.ts:49:5 › M31-02 追補: タグ欄で始めたドラッグの文字選択 › 下へ枠外までドラッグしても文字選択が消えない
  362 passed (6.0m)
```

**いずれもタグ欄の文字選択ドラッグであり、本サブの射程（`startup_basis` / ラッシュ版生成）と交点が無い。** リトライで緑（`EXIT=0`）。

**★本サブの影響面を直接通る spec が緑であることを個別行で示す**（`D-881`。全体の結果だけを根拠にしない）:

```
$ grep -inE "rush|ラッシュ" e2e.txt      # 2 件
  ✓  262 [chromium] › e2e/m30-01-controller-surfacing.spec.ts:170:3 › M30-01 仮想コントローラの出し分け › ★共通技タブに 13 種の共通技と生ラッシュが並ぶ(常設行からの移設) (616ms)
  ✓  366 [chromium] › e2e/moves-edit.spec.ts:30:3 › moves 編集グリッド(FR703) › 既存 seed 技を編集(recovery/total 手入力)→ 保存 → GET 反映 → ラッシュ版生成 (1.1s)
```

---

## 9. 検査

| 検査 | 結果 |
|---|---|
| `bash scripts/check-artifact-integrity.sh`（**1 本目**） | **`EXIT=0`** ／ 検査 17 件・ALLOW 除外 1 件 ／ 生成物 4 件すべて OK ／ 「結果: 違反なし」 |
| `bash scripts/check-doc-refs.sh` | **`EXIT=0`** ／ 「dead reference なし」 |
| `bash scripts/check-md-emphasis.sh scripts/migrate-userdata-prompt.md` | **初回 `EXIT=1`（4 行検出）→ 自分で直して `EXIT=0`**（下記 9.1） |
| `bash scripts/check-doc-inventory.sh` | **`EXIT=0`**（情報提供型） |
| `bash scripts/check-stop-discipline.sh` | **`EXIT=0`** |
| `bash scripts/check-enum-sync.sh` | **`EXIT=0`** |
| `bash scripts/check-import-order.sh` | **`EXIT=0`** |
| `bash scripts/check-progress-log-index.sh` | **★本報告を書いた *後* に回し直す**（§11） |

### 9.1 ★閉じない強調を自分で直した（`D-775`）

追記節の 4 行が検出された（`215` / `216` / `275` / `276`）。**いずれも本手番で書いた行である。** 原因は `**...**` が**行またぎ**になっていたこと（検査は 1 行ずつ描画するため、開きと閉じが別行だと両方が「閉じない」に見える）。⇒ **各スパンを 1 行に収めた**（文言は変えていない）。コミット `2ce3bf2`。

**★`docs/progress/` の継続更新ファイル（`progress-log.md`）は渡していない**（歴史記録としての既存検出行を持つため＝`D-274` (3)）。

---

## 10. レビューと取り込み（**Phase C で記入した**）

| 欄 | 内容 |
|---|---|
| レビュー報告書 | **`docs/progress/m39-02-review.md`**（メイン会話の文脈を継承しない fresh subagent が作成。`fork` は使っていない） |
| 指摘件数 | **7 件**＝**高 1 ／ 中 3 ／ 低 3** |
| 採否 | **7 件すべて採用。不採用 0 件。** |
| **「高」指摘の不採用** | **0 件。⇒ 安全弁（開発者エスカレーション）は発動していない** |
| 再レビュー往復の回数 | **0 回**（上限 2 回に対して未使用） |
| チェックリスト評価 | A 再現 ◎ ／ B 是正 ◎ ／ C テスト ◎ ／ D 既存違反行 ◎ ／ E 射程 ◎ ／ F 報告 ○（F-1 は設計伝達レポート作成前のため判定不能だった） |

**★レビューは結論を鵜呑みにせず自分で回していた**（`M39-01` §7-4 の求めるところ）——`go test ./...` をパイプ無しで自走（`EXIT=0` / `FAIL` 0 / `ok` 60）、検査 10 本を自走（全て `EXIT=0`）、`make e2e` を自走（`EXIT=0` / 363 passed / 1 flaky＝合計 364 で本報告の 362+2 と一致。**同一 spec の揺れ**）、射程 5 点を自分のコマンドで追認、さらに **`migrations/000004` を `VALUES` タプル単位で静的解析**して本報告の実測値（3057 タプル ／ rush 514 行・`startup NULL` 0 行 ／ seed の違反 0 ／ `startup IS NULL` 362 行 ／ 該当元技ちょうど 3 件）を独立に追認した。

### 10.1 採否と理由（**全件採用**）

| # | 優先度 | 指摘 | 採否 | 対応 |
|---|---|---|---|---|
| **高-1** | 高 | **「相互参照コメントを双方向に置いた」が事実と異なる。** 正本側 `head_seed_invariants_test.go` に `rush_runtime_invariant_test` も `M39-02` も **0 件**。参照が欠けているのが**正本側**であることが危険（式を変える人は正本を触り、複製を知らない） | **採用** | **自分で `grep` して 0 件を確認**（レビューの結論が正しかった）。⇒ **正本側へ相互参照を追加**し、記述を事実に合わせた。あわせて完了報告 §4.1 に訂正の注記を残した。**★「体裁」ではなく失効記述である**——テスト・lint・型検査では永久に検出されず、2 つの文書に誤った事実として記録されていた |
| **中-2** | 中 | 「package `migration_test` に属し import できない」は**置き場に限った事実**であって「共有できない」の証明ではない。`internal/testutil/dbtest` は両パッケージが import 済みで循環もしない | **採用** | **自分で両側の import を確認**（`migration` 側・`move` 側とも `testutil/dbtest` を import 済み）。⇒ 「**共有しないことを選んだ**」へ言い換え、**採らなかった理由**（同 helper は DB を用意する道具であり述語の置き場ではない）と**代償**を、コード側と報告側の両方へ明記した |
| **中-3** | 中 | **値が変わったことの消費者側への影響の調査が報告に無い。** §3.4 の走査が `grep -icE "rush"` で絞られ、`rush` の語を含まない消費者が母集団から落ちている | **採用** | **レビューの結論（影響 0）を鵜呑みにせず、4 箇所の述語を自分で読み直した。** とくに `setplay/service.go:664` が **`if !isRushTargetType(ttype)` の内側**に在ることを実物で確認した（`:654`）。⇒ **§3.5 として根拠を表で追記**。あわせて「該当 rush 行は `damage=0` なので既定の target 列挙にそもそも入らない」という独立の根拠も足した |
| **中-4** | 中 | **`migrations/000004` の `dee_jay/speedy_maracas` の `notes_tool` に「空中技ではないが、ラッシュ版はない。」という入力担当の手書きが在る。** ⇒ 案 (a) を採った結果、**実機に無いラッシュ版を利用者が作れる状態が残る**。案 (b) の判断材料が実データに在るのに報告へ上がっていない | **採用** | **自分で `migrations/000004` を引いて逐語を確認した**（下記 10.2 に全文）。⇒ **`rushEligible` は `roles-and-routing` のハード列（ユーザー体験に影響）に当たり、製造の自己判断で変えてよい事項ではない。★本サブでは `rushEligible` を触らない**（指示書 §3-5）。**設計伝達レポート §4 へ「§J 行の原稿」として上げる** |
| 低-5 | 低 | 完了報告 §7 の `--numstat` / `--stat` が docs コミット 2 本を含まない古い値 | **採用** | Phase C まで含めた実測へ更新し、Phase A 時点の実装面の値は「破壊確認・射程確認を読んだ母集団」として別掲した |
| 低-6 | 低 | `precheck_seed_data.md:111` の据え置きは妥当だが「`startup` が在る場合」の一句を足すと安い | **採用** | 同行へ括弧書きを 1 つ足した（**seed 済み rush 行 514 件は全件 `startup` を持つため現状の判定は変わらない**。将来 `startup` を持たない rush 行が seed に入ったときの誤検出を防ぐ） |
| 低-7 | 低 | テスト期待値がリテラル（`"unknown"` / `"through"`）。既存慣行でもあるため方針決めのみ | **採用（記録のみ・コード変更なし）** | **本サブでは変えない。** 理由 2 つ——(a) 既存の `rush_test.go:67` が同じ形であり、**本サブだけ変えると同一ファイル内で書き方が割れる**。(b) テストが**定数の値そのもの**を固定する意図がある場合、定数を参照すると「定数を書き換えたらテストも一緒に動く」ため主張が弱まる。⇒ **リポジトリ全体の方針として決める話**であり、設計伝達レポート §4 へ候補として残す |

### 10.2 中-4 の逐語（**★設計卓・開発者の判断が要る**）

```
$ grep -o "speedy_maracas[^)]\{0,400\}" migrations/000004_data_seed_moves.up.sql
speedy_maracas', 'unique', NULL, 0, '{"notes_tool":"ボタンホールド時間で全体が自由に変わる技なのでフレームは省略。空中技ではないが、ラッシュ版はない。"}', NULL, ...
```

**⇒ 入力担当が「ラッシュ版はない」と明記している技に対して、本サブの是正後も「ラッシュ版を作る」ボタンは出る。**

**★これは本サブの不具合ではない。** 是正前も同じだったし、**不変条件の観点では `'unknown'` が入るので正しい**。**問題は「提供する技の集合」の側にある**——案 (b)（`rushEligible` で `startup IS NULL` を弾く）を採れば同時に解決したが、**UX が変わるため開発者の承認が要る**（指示書 §7-1 / §3-5）。

**★★製造の判断**: 指示書は案 (a) を推し、案 (b) には承認が要ると明記している。⇒ **承認の無い状態で `rushEligible` を触ることはしない。事実だけを設計伝達レポート §4 へ上げ、判断を開発者へ返す。**

### 10.3 ★★★【2026-09-20 追記】開発者裁定と、製造の事実誤認の訂正

**★★★上の §10.2 が書いた「利用者が実際に叩く」「提供する技の集合」という見立ては*誤っていた*。** 開発者の指摘を受けて実査した結果:

| # | 誤っていた前提 | 実際 |
|---|---|---|
| **1** | ラッシュ版生成を**利用者の面**として扱った | **★画面18 の導線は 2026-09-17 に除去済み**（`CHANGE-214` / `M38-02` / `D-892`）。`web/src/components/Header.tsx:39` が明記し、**フロント全体で `/moves/edit` への導線は 0 件**。**⇒ URL 直打ちでしか到達できない** |
| **2** | 同画面を一般機能とみなした | **`FR703`＝「公式データに不備があった場合、*少なくとも開発者が*手動で修正できる」。⇒ 開発者向けの逃げ道である** |
| **3** | ラッシュ版の**著者責任**に触れなかった | **`FR704`**——公式データの CSV 化は**別ツール（`FR701` / `moves-input-tool`）の責務**。**⇒ 外部ツールが `character_data/*.csv` に rush 行を直接著者している**（実測＝CSV の `rush_*` 出現 **1034 箇所** ／ seed の rush 行 **514**） |

**★生成機構は二重ではない**（開発者の問い）——`InsertRushVariant` の呼び出し経路は**リポジトリ全体で 1 本だけ**である（`MoveEditGrid.tsx` → `useGenerateRushVariant` → `POST /api/moves/:id/rush-variant` → `Service.GenerateRushVariant` → `repository.InsertRushVariant`）。**`seedgen` は rush 行を導出せず**（`original_move_id` の解決とエイリアス合成のみ）、**仮想コントローラのラッシュ版トグルも行を作らない**（`rush_<code>` を引くだけ）。

**★★★開発者裁定（逐語）**:

> 生成ボタンが出ても問題はない。このような空中技ではないがラッシュ版を省いた技はいくつか存在する。
> 莫大なキャラクターがいる訳でも、この例外が大量にある訳でもないので、手動削除対応する形で今後も問題はない。
> （…）Combomgr の上で Rush 版を自動で作る機構が二重であるか？ ないならここでの修正対象ではない

**⇒ 案 (b) は不採用。`rushEligible` は現状維持。followup への新規登録も行わない。**

**★レビュー 中-4 の指摘した*事実*（`notes_tool` の逐語）は正しい。誤っていたのは製造が付けた*帰結*である。**

**★補助事実**（実査 2026-09-20）: `dee_jay/rush_speedy_maracas` は **seed・CSV とも 0 件**（開発者の認識どおり） ／ ラッシュ版を省いた eligible 技は seed 上 **31 件**（eligible 母数 545・rush 行を持つ 514） ／ **`notes_tool` に「ラッシュ版はない」の明言が在るのは 31 件中 1 件だけ**である。

**★本サブの実装は訂正を要しない。** 不変条件の是正（`startup` が NULL なら `'unknown'`）は、誰がどの面から作った行であっても正しい。

---

## 11. 報告作成後に回し直す検査（**★完了条件 14・出力まで貼る**）

> **★★★`M39-01` §7-1（`D-890`）が名指しで警告している型である**——**検査を回した時点と報告を書いた時点がずれると「緑」が偽になる。** 完了報告そのものが検査の**入力**だからである。
> **⇒ 本節は完了報告と `progress-log` の索引行を書き終えた *後* に埋める。**

| 検査 | 出力 |
|---|---|
| `bash scripts/check-progress-log-index.sh` | **§11.1 に貼る** |
| `bash scripts/check-completion-report-md-emphasis.sh` | **§11.1 に貼る** |
| `bash scripts/check-doc-inventory.sh` | **§11.1 に貼る** |
| `bash scripts/check-md-emphasis.sh docs/progress/M39-02-completion-report.md` | **§11.1 に貼る** |

### 11.1 回し直した出力

**回した時点**: 本完了報告（`docs/progress/M39-02-completion-report.md`）と `docs/progress/progress-log.md` の索引行を**書き終えた後**。

```
$ bash scripts/check-progress-log-index.sh
EXIT=0
OK  .claude/commands/implement_plan.md に索引行の節がある
OK  .claude/commands/implement_plan_full.md に索引行の節がある
OK  .claude/commands/incorporate_plan.md に索引行の節がある

## 2. 完了報告 → progress-log の追記カバレッジ

OK  検査した 121 件すべてが progress-log に現れる(ALLOW 除外 17 件)

結果: 違反なし
```

**★ここが `M39-01` §7-1 が落ちた箇所である。** 同サブは本検査を報告を書く *前* に回して `EXIT=0` を得、その値を表へ書いた。⇒ **その後に完了報告を作ったことで「対応する索引行が無い」が成立し、検査は赤へ変わっていた。** 本サブは**索引行を書いた後**に回しており、検査が見ている 121 件には**本サブの完了報告も含まれている**。

```
$ bash scripts/check-completion-report-md-emphasis.sh
EXIT=0
## 2. 指示書テンプレート §7.4 の手順(本文で判定)
OK  docs/instructions/templates/M{N}-{NN}-{slug}.template.md §7.4 に手順の本文がある

結果: 違反なし
```

```
$ bash scripts/check-doc-inventory.sh
EXIT=0
対象 commit: `2ce3bf2`
型 18 件 ／ 既知の例外 30 件(--list-allow で一覧)

結果: 型に無いファイルなし
```

⇒ 本サブが `docs/` へ足したのは `docs/progress/M39-02-completion-report.md` の 1 件であり、**既存の型（完了報告）に収まっている**。新種は作っていない（`CLAUDE.md` §10.Y）。

```
$ bash scripts/check-md-emphasis.sh docs/progress/M39-02-completion-report.md
EXIT=0
検出: 0 行(ファイル指定のためベースライン比較を行わない)
```

**★`docs/progress/progress-log.md` は渡していない**（継続更新ファイルであり、歴史記録としての既存検出行を持つため＝`D-274` (3)）。

### 11.2 ★Phase C（レビュー取り込み）の後に**もう一度**回し直した

**§10 / §3.5 / §4.1 / §7 への追記、レビュー報告書の作成、設計伝達レポートの作成、`progress-log` の横断課題の追記——いずれも「報告を入力に取る検査」の入力を変える。** ⇒ **すべて書き終えた後に回し直した。**

```
$ bash scripts/check-progress-log-index.sh                      EXIT=0
$ bash scripts/check-completion-report-md-emphasis.sh           EXIT=0
$ bash scripts/check-doc-inventory.sh                           EXIT=0
$ bash scripts/check-doc-refs.sh                                EXIT=0
$ bash scripts/check-stop-discipline.sh                         EXIT=0
$ bash scripts/check-artifact-integrity.sh                      EXIT=0

$ bash scripts/check-md-emphasis.sh docs/progress/M39-02-completion-report.md                        EXIT=0
$ bash scripts/check-md-emphasis.sh docs/progress/m39-02-review.md                                   EXIT=0
$ bash scripts/check-md-emphasis.sh docs/handover/design-reports/20260919-m39-02-design-exceptions.md EXIT=0
```

**★Phase C で足したコードに対する全数も回し直した**（正本側テストファイルへ相互参照コメントを足したため）:

```
$ go test ./... -count=1 > gotest-after-triage.txt 2>&1; echo "EXIT=$?"
EXIT=0
$ grep -cE "^--- FAIL" gotest-after-triage.txt
0
$ grep -cE "^ok" gotest-after-triage.txt
60
```

**★この 11.2 が完了条件 14 の本体である。** §11.1 は Phase A 完了時点の回し直しであり、**Phase C の追記を含んでいない**。⇒ **「一度回したから緑」ではなく、「最後に書き足した後の緑」を貼ることに意味がある**（`D-890` / `M39-01` §7-1）。

### 11.3 ★★★2026-09-20 ラウンド（**引き渡し前の仕上げ**）の回し直し

**★§11.2 は Phase C 時点までしか覆っていない。** その後に **(a) `d981405`（§4-1 の事実誤認の訂正・§10.3 の追加） (b) 本手番の §5.3 / §14 / 設計伝達レポート §4-2 / `progress-log` の追記 (c) `code-facts.md` の再生成**が入った。**⇒ 同じ理屈で、これらを書き終えた後にもう一度回した。**

```
$ bash scripts/check-artifact-integrity.sh            EXIT=0   # ★1 本目
$ bash scripts/check-progress-log-index.sh            EXIT=0
$ bash scripts/check-completion-report-md-emphasis.sh EXIT=0
$ bash scripts/check-doc-inventory.sh                 EXIT=0
$ bash scripts/check-doc-refs.sh                      EXIT=0
$ bash scripts/check-stop-discipline.sh               EXIT=0

$ bash scripts/check-md-emphasis.sh docs/progress/M39-02-completion-report.md                         EXIT=0
$ bash scripts/check-md-emphasis.sh docs/handover/design-reports/20260919-m39-02-design-exceptions.md EXIT=0
```

**★本番コードが動いていないことの確認**（本手番は文書と派生資料だけを触っている）:

```
$ go test ./... -count=1 > r3-gotest.txt 2>&1; echo "EXIT=$?"
EXIT=0
$ grep -cE "^--- FAIL" r3-gotest.txt
0
$ grep -cE "^ok" r3-gotest.txt
60
```

**★`make e2e` は回し直していない。理由を明示する**——`make e2e` を実行した時点（`210fe7a`）以降に動いた `internal/` / `web/` / `migrations/` の差分は **`*_test.go` 2 本のコメントだけ**であり、**`internal/repository/move/rush.go` を含む本番コードは 1 行も動いていない**（実測＝`git diff 210fe7a..HEAD --numstat -- internal/ web/ migrations/`）。**⇒ §8 の e2e の結果（`EXIT=0` / 362 passed / 2 flaky）は有効である。**

**★`docs/progress/progress-log.md` は `check-md-emphasis` へ渡していない**（継続更新ファイルであり、歴史記録としての既存検出行を持つため＝`D-274` (3)）。

---

## 12. ■ 併せて更新が要るもの

| # | 項目 | 状態 |
|---|---|---|
| 1 | **消費した CHANGE 番号の登録** | **なし。** 本サブは CHANGE を**自採番していない**（`D-293`）。⇒ `docs/handover/change-number-registry.md` §1 への登録は**発生しない**。原稿は設計伝達レポート §1 / §6 へ回し、採番は設計卓の手番 |
| 2 | **「次の番号」の写し先（実査 4 か所）** | **不要。** 番号を消費していないため 1 か所も動かない |
| 3 | **消費したマイグレ連番** | **なし。** `ls migrations/*.up.sql` = **9 本**のまま。**次に払い出す番号は `000010` で不変**（ボード §2.2 と一致） |
| 4 | **版を上げた文書の参照元** | **なし。** 本サブは設計書・指示書の版を 1 つも上げていない |
| 5 | **`followup-backlog.md`** | **1 文字も編集していない**（`D-838`）。⇒ 対の 2 行（`d187-startup-basis-invariant-violated-at-head` ／ `rush-variant-can-violate-d187-at-runtime`）を閉じるのは**設計卓の手番**である。本サブの成果をもって**対で閉じられる**（指示書 §8-2） |
| 6 | **`docs/handover/docs-map.md` に `M39` が載っていない** | **本サブでも再生成していない**（`M39-01` §4-4 の申し送りのまま）。⇒ `docs/` をまとめて触る手番で回すのが筋 |

---

## 13. 使い捨て DB の後始末（**★申し送り**）

再現・乾式検証に使った DB が `tmp/m39-02/` に 2 つ残っている（`repro.db` / `fixed.db`。`tmp/` も `*.db` も `.gitignore` 済みであり、コミットには 1 バイトも入っていない）。

**★製造は削除していない**——`CLAUDE.md` §10 が**データベースファイル（`*.db`）の直接削除**を禁じている（機械強制）ため。**⇒ 消すのは開発者の手番である**（消さなくても害は無い。合計 3MB 程度）。

---

## 14. 開発者への確認事項

| # | 事項 | 状態 |
|---|---|---|
| §7-1 | 案 (b)（`rushEligible` で弾く）を採りたい場合 | **★2026-09-20 裁定済み＝不採用。** `rushEligible` は現状維持であり、本サブでも 1 行も触っていない。**⇒ あわせて製造の事実誤認を §10.3 で訂正した**（画面18 は `FR703` の開発者向けの面であり `M38-02` で導線が除去されている。ラッシュ版の著者は外部ツール＝`FR701`） |
| §7-2 | 開発者の検証 DB に既存の違反行が在った場合の処遇 | **★2026-09-20 実行済み＝違反 0 件・更新不要。⇒ 本確認事項は閉じた。** 内訳＝バックアップ作成済み ／ `foreign_key_check` 0 件 ／ 整合性検査 OK ／ 全テーブルのデータ変更なし（§5.3）。**⇒ 設計伝達レポート §4-2 の「残る前提」も解消した** |
| §7-3 | 段 1 で再現できなかった場合 | **発動しない。** 再現できた（§2） |

---

*以上、M39-02 完了報告。* **★§2.4 が本サブの核である**——**実 DB が違反を抱えているその時に、`M39-01` のガードは `EXIT=0` で緑であった。** ⇒ 「緑であること」は「見ていること」の証明ではない。

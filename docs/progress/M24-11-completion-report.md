# M24-11 完了報告: `VAL-C02` の check-then-act 競合を閉じる

| 項目 | 内容 |
|------|------|
| 指示書 | `docs/instructions/M24-11-val-c02-check-then-act-race.md` **v1.1.0** |
| チェックリスト | `docs/instructions/reviews/M24-11-review-checklist.md` **v1.1.0** |
| 実施日 | 2026-08-27 |
| ブランチ | `claude/m24-11-m24-09c-plan-m2c993`（着手基点 **`36b41f4`**＝`M24-09c` のマージコミット） |
| CHANGE | **`CHANGE-136`**（設計卓が起票済み。**製造は番号を消費していない**） |
| マイグレ | **0 本消費。`migrations/` の差分 0 バイト**（§7.1-9） |
| 新規依存 | **0 件** |

---

## 1. やったこと

**`VAL-C02`（同一キャラ・同一レシピ・同一状況のコンボの重複登録）の判定と登録を、割り込まれない 1 つの操作にした。**

| # | 変更 | 面 |
|---|---|---|
| 1 | **書き込みトランザクションを `BEGIN IMMEDIATE` で開始する** | DSN へ `_txlock=immediate` |
| 2 | **判定を登録と同じトランザクションの内側で、`*sql.Tx` を使って行う** | `POST` / `PUT` / `materialize` の 3 経路 |
| 3 | **`SQLITE_BUSY` を 503 `database_busy` へ翻訳する** | 重複（400）とも版不一致（409）とも別の第 3 の区別 |
| 4 | **既存データの重複を数える手を用意した**（**★消していない**） | 環境変数で実 DB を指したときだけ走る監査 |

**★判定ロジックは 1 文字も変えていない。** 6 項識別キー ＋ `recipe_hash` ／ `deleted_at IS NULL` ／ `is_draft = 0` ／ NULL 同士は一致 ／ `Flags` の `sort.Strings` 正規化——すべて不変である。**変えたのは「いつ・どのハンドルで判定するか」だけである。**

### 1.1 ★★適用面は 3 経路ではなく **4 経路** だった（**2026-08-28・レビュー指摘 高-1**）

**`CHANGE-136` §2.3 と指示書 §4.2 は適用面を「`POST` / `PUT` / `materialize` の 3 経路」と書いている。** **実装の適用面は 4 経路である。**

| # | 経路 | 入口 | 着手基点 | 現在 |
|---|---|---|---|---|
| 1 | `Create` | `POST /api/combos` | tx の外 | **tx の内側** |
| 2 | **`UpdateMetadata` の仮登録→本登録昇格** | **`PATCH /api/combos/:id`** | **tx の外**（`BeginTx` の 33 行前） | **tx の内側** |
| 3 | `UpdateWithKeyChange` | `PUT /api/combos/:id` | tx の外 | **tx の内側** |
| 4 | `Materialize` の探索 | `POST /api/combos/:id/materialize` | tx の外 | **tx の内側** |

**★昇格は INSERT ではないが、`is_draft` を 0 にする＝重複判定の母集団（`is_draft = 0 AND deleted_at IS NULL`）へ行を持ち込む操作である。** ⇒ 同一識別キーの仮登録 2 件を同時に昇格させる、または昇格と `POST` を同時に走らせると、双方が「重複なし」を見て双方が本登録になりうる。**§1.1.3 が挙げた害の形にそのまま到達する。**

**★★これは初回提出時に落としていた。** レビューが独立に発見した（`ValidateComboForCreate` の呼出元を全数走査した結果）。**⇒ 実在を破壊確認 4 で確かめたうえで塞いだ**（§5.4）。

**★設計卓への申し送り**（設計伝達レポート §1 へ）——**`CHANGE-136` を「適用面 3 経路で閉じた」として `DES-006` §2.3 へ反映しないこと。as-built は 4 経路である。** 設計卓は実装ソースを読めないため、この種の食い違いは製造が実査で見つけて報告する定めである（指示書 §1.1.4 ／ 計測点 `M-77`）。

**★あわせて `internal/service/validation/combo.go` の godoc を是正した**——旧記述は「`POST /api/combos` と `PUT /api/combos/:id`（キー変更編集）で共通に使用する」と 2 経路しか挙げておらず、**昇格経路が落ちていた。これが今回の欠落を招いた一因である。** 現在は 4 経路すべてと「新しい呼出元を足すときも tx の内側で判定すること」を明記している。

---

## 2. 実査 14 件（§3.3）

> **★指示書 §1.1.4 は「設計卓は実装ソースを読めない。上記を断定形として扱わないこと」と定めている。1 件ずつ裏を取り、食い違ったものを ⚠ で示す。**

| # | 確かめたこと | 結果 |
|---|---|---|
| **1** | 再現手順が現在の main で赤くなるか | **⚠ 一次源は決定論的ではなかった。** §4-1 の逐語は「**繰り返す**。**10 回中 1 回**の頻度で」＝確率的である。**⇒ 真に決定論的な Go テストへ翻訳した**（§4）。**あわせて一次源そのものを同一セッションで背中合わせに回した——着手基点で 10 回中 7 回バグ再現 / 修正後 10 回中 0 回**（§5.2） |
| **2** | 検証と `BeginTx` の順序 | **検証が前**。着手基点 `internal/service/combo/service.go:260`（`ValidateComboForCreate`）→ `:266`（`BeginTx`）。**裏取り完了**（§4-1 の記述どおり） |
| **3** | 書き込み tx の開始点の**全数** | **母数 24**（production・`_test.go` 除く）。**共通ヘルパは無く、24 か所すべてが `s.db.BeginTx(ctx, nil)` をインラインで呼ぶ。** 内訳＝サービス層 22 ／ リポジトリ層 2（`repository/move/rush.go:49`・`repository/punish/crud.go:35`）／ `cmd/` 0 |
| **4** | 検証の層と渡されるもの | **サービス層**（`internal/service/validation/combo.go:157` `validateC02Duplicate`）。**`*sql.DB` も `*sql.Tx` も渡していなかった**——`ComboDuplicateChecker` の署名が `(ctx, key)` のみで **tx を通す継ぎ目が無い**。最終的に `repository.FindActiveByDuplicateKey` が `r.db.QueryContext` を直に叩いていた |
| **5** | `BEGIN IMMEDIATE` の発行方法 | **⚠ 設計卓が想定した衝突は、このドライバでは起きない。** `modernc.org/sqlite v1.50.0` は `_txlock` を解し（`sqlite.go:195-201`）、`tx.go:22-25` が **`opts.ReadOnly` を見て `beginMode` を外す**。⇒「`_txlock` は全 tx に効くため §4.1.2 と衝突する」という前提は**成り立たない**。**開発者が DSN 方式を選択**（2026-08-27） |
| **6** | `busy_timeout` の実値 | **5000（ミリ秒）**。`internal/infra/db/db.go:38`。**⇒ `SUPP-001` §7.1.1 の「5 秒」は現在も正しい** |
| **7** | 書き込み tx の内側から非 tx を撃つ箇所の**全数** | **母数 40**（**2026-08-28 訂正**。旧記載「39（… 非テスト関数 **15 本**）」は数え方が復元できず、レビューで再現不能と指摘された＝中-7。**⇒ §3.0 にコマンドを併記して数え直した**）。**うち非 tx ハンドルでクエリを撃つのは 6 本**。§3 に全数を掲げる |
| **8** | `RecomputeComboCache` の tx 読み非対称 | **今も在る**（`notation/cache.go:63` `ListAllPresets` と `:75` `resolveRecipe` 内 6 か所が非 tx。steps 読みと cache 書きだけが tx）。**呼び出しは 4 か所すべてコミット前。** **⇒ 本サブで前提は動かない**（§3 の判定） |
| **9** | 他の check-then-act 候補 | §6 に一覧（**守られる 1 件 ／ 手当てが要る 3 種**） |
| **10** | 既存 DB の重複 | **⚠ 本実行環境に dev DB が無い**（`find . -name '*.db'` が 0 件＝クラウドのクリーンな clone）。**⇒ 数える手を用意し、実行は開発者の手番へ回す**（§7） |
| **11** | 保存ボタンの二度押し | **守られている。直す必要は無かった。** `web/src/features/combo/components/ComboEditor.tsx:884` が `disabled={isMutating}`、さらに `:203` に `saveInFlightRef` の再入ガードがある。**★同ガードは `M23-09` §4.6-3 が「ダイアログを挟むと `disabled` だけでは窓が閉じない」として入れたものである。** ⇒ `M24-04` へ渡す課題は無い |
| **12** | `SQLITE_BUSY` の現在の扱い | **扱いが 0 件だった。** `internal/` に検査・retry・backoff・独自 `HTTPErrorHandler` のいずれも無く、**各ハンドラの落穂として 500 `internal_error`** になっていた（着手基点 `api/combo/handler.go:58-59`）。緩和は DSN の `busy_timeout(5000)` のみ |
| **13** | `DES-006` に「保証」と読める書き方があるか | **`VAL-C02` の判定そのものを「保証」と書いた箇所は無い**（§8） |
| **14** | followup `e2e-flaky-combo-post-500` との関係 | **本サブの競合では説明が付かない。隣接機序の候補が 1 つある**（§9） |

**あわせて独立に確認したこと**（設計卓の記述の裏取り）:

- `migrations/` に `combos` の識別キーへの UNIQUE 制約は**無い**（`CREATE UNIQUE INDEX` は `000075` の `preset_aliases` 2 本のみ）。**⇒ `M24-09c` §4-1 の「レビュー担当が独立に全走査して確認」と一致する。**
- `SetMaxOpenConns` はプロダクションで**未設定**（`db.go:74-75` が意図として明記）。**触っていない**（§1.3-8）。
- **読み取り専用トランザクションはリポジトリ全体で 0 件**（`TxOptions` / `ReadOnly` の出現が 0）。

---

## 3. §4.3 の最大リスク——**顕在化しなかった**（母数つき全数）

**指示書 §4.3 は「`BEGIN IMMEDIATE` にすると潜在的な自己デッドロックが確実に踏まれるようになる」を本サブ最大のリスクとして挙げていた。**

### 3.0 ★母数の数え方（**2026-08-28 追記・レビュー指摘 中-7 の是正**）

**旧記載の「39（`BeginTx` 24 ＋ `tx *sql.Tx` を受け取る非テスト関数 15 本）」は、15 本に到達する数え方が本文から復元できなかった。** **⇒ その場で叩いたコマンドを併記する**（チェックリスト 7-4）。

```
# (a) production の BeginTx = 24
$ grep -rn "BeginTx(" internal/ cmd/ --include=*.go | grep -v "_test.go" | wc -l
24

# (b) tx *sql.Tx を受け取る関数(非テスト・全層) = 82
$ grep -rn "^func .*tx \*sql\.Tx" internal/ --include=*.go | grep -v "_test.go" | wc -l
82
#   内訳: internal/service/ = 16 ／ internal/repository/ = 66

# (c) サービス層が *sql.DB を直に叩く箇所 = 1
$ grep -rn "s\.db\.\(Query\|Exec\)" internal/service/ --include=*.go | grep -v "_test.go"
internal/service/combo/service.go:1580   getMaterializeStarter が moves を読む
```

**★本節が数えるべき母数は「トランザクション境界を決める単位」である。** ⇒ **(a) 24 ＋ (b) のうちサービス層 16 = 40**。**リポジトリ層の 66 本は除く**——同層は tx を*受け取って* `runner(tx)` で使うだけで境界を決めないため、「内側から非 tx を撃つ」判断の主体にならない。**★この除外理由を書かなかったことが、旧記載が再現できなかった原因である。**

**★(c) が 1 件であることはレビュー担当も独立に再現しており**（`getMaterializeStarter` のみ）、**下表の実質（非 tx ハンドルを撃つのは 6 本）と矛盾しない。** 残る 5 本はリポジトリ／アダプタ経由の非 tx 読みである。

**母数 40 のうち、非 tx ハンドルでクエリを撃つのは 6 本。**

| # | 箇所 | 非 tx で何を撃つか | 呼ばれる位置 |
|---|---|---|---|
| 1 | `notation.RecomputeComboCache`（`cache.go:62`） | `:63` `ListAllPresets` ／ `:75` `resolveRecipe` 内のエイリアス読み 6 か所 | **コミット前**（呼び出し 4 か所） |
| 2 | `notation.RecomputeSetupCache`（`setup_resolver.go:121`） | `:122` `ListAllPresets` ／ `:135` `resolveRecipe` | **コミット前**（呼び出し 4 か所） |
| 3 | `notation.RecomputePresetCache`（`cache.go:106`） | `:122` / `:145`（自前で tx を開く） | **コミット後**（規約どおり＝`SUPP-001` §7.1.1） |
| 4 | `setup.CreateSetupInTx` → `ValidateSetupCreate`（`service.go:288`） | `validate.go:92` / `:112` / **`:135`（VAL-S04）** | **コミット前** |
| 5 | `combo.validateRestoredCombo` → `ValidateMoveExistence`（`service.go:1108`） | `validation/combo.go:293`（VAL-C08） | **コミット前** |
| 6 | `setup.validateRestoredSetup` → `ValidateSetupMoveExistence`（`restore.go:122`） | `validate.go:92`（VAL-S03） | **コミット前** |

### 3.1 ★★6 本ともすべて「読み」であり、「非 tx の UPDATE」は 0 件だった

**`SUPP-001` §7.1.1-3 が名指ししたのは「開いている書き込み tx の内側から非 tx の UPDATE を撃つ」形である。** **WAL では読みは writer と競合しない。** ⇒ 顕在化しない。

**★これを推測のままにせず実測で固定した**——`TestValidationReadsInsideWriteTx`（`internal/service/combo/val_c02_race_test.go`）。**本テストが赤くなったら「読みも競合する」ということであり、上記 6 本が軒並み危うくなる。**

**★実測**: `_txlock=immediate` を入れた直後に `go test ./... -count=1` を回し、**55 パッケージすべて緑・所要も変わらず**（`internal/service/combo` は 97.850s → 96.937s。新規テスト 2 本を含んだうえで）。**⇒ 既存の振る舞いに退行が無いことは確かめられた。**

**★★ただしこれは「並行度への影響」を観測していない**（**2026-08-28 訂正・レビュー指摘 中-4**）。**`go test` は直列に走る**（本リポジトリに `t.Parallel()` は 0 件であることは §4.2 で自ら書いている）。**⇒ 上の所要時間は並行度を一切測っていない。**

**「並行度への影響は実質変わらない」（指示書 §4.1.2）は、実測ではなく設計上の論証である**——**SQLite は WAL でも writer を元来 1 本に直列化しており、`BEGIN IMMEDIATE` が変えるのはロックを取る時刻だけである。** ⇒ 主張自体は正しいと考えるが、**根拠の層が違うものを「実測で裏づけた」と書いてはならない**（`M-78` / playbook §4.32 の型にそのまま当たる）。

**★あわせて as-built として記録する**（**レビュー指摘 低-3**）——**本サブにより `Create` / `UpdateWithKeyChange` / `UpdateMetadata` は、バリデーション（VAL-C01 / VAL-C08 / VAL-C12 のマスタ読みを含む）の全区間で write lock を保持するようになった。400 で終わる要求も lock を消費する。** 1 人〜数人利用（`NFR203` の想定）では実害は小さいが、**`busy_timeout` 5 秒の余裕を削る方向の変化である。** **★判定を「DB を見ない検査」と「DB を見る検査」へ分割する緩和は採らない**——`DES-006` §2.1 が戒める「2 つの『同じ』が並ぶ」形を招くためである。

### 3.2 ただし 1 件だけ、実際に踏む形が在り、直した

**`materialize` の「既存 id を返す」経路が `drainBasePunish` を呼ぶ。同関数は自前で書き込みトランザクションを開く**（`service.go` の `drainBasePunish`）。判定を tx の内側へ入れると、**自分が write lock を握ったまま内側で 2 本目の書き込み tx を開く**形になり、`busy_timeout` ぶん待たされたうえで `SQLITE_BUSY` になる。

**⇒ `drainBasePunish` を呼ぶ前に自分の tx を閉じる形にした**（ここまで 1 行も書いていないためロールバックでよい）。**★これは「本サブが壊した」のではなく、判定を内側へ入れたことで初めて到達した形である。**

### 3.2.1 ★★本サブの変更が、新たに「tx の内側」へ入れた非 tx の読み（**3 件。母数に足す**）

**上表の 6 本は着手基点の状態で数えたものである。** **判定をトランザクションの内側へ移した結果、それまで `BeginTx` の前に在った読みが tx の内側へ入った。** **⇒ 隠さずに数え直す。**

| # | 箇所 | 何を読むか | 判定 |
|---|---|---|---|
| 1 | **`PUT` の M4-03 検査**（`service.go` の `UpdateWithKeyChange`） | `s.repo.FindByID`（`combos`）／ `s.repo.CountComboSetupsByComboID`（`combo_setups`） | **読み。かつ読む対象はコミット済みの旧行である**（この tx はまだ何も書いていない）。⇒ 非 tx のままで判定は成立する |
| 2 | **`materialize` のダメージ計算**（`getMaterializeStarter`） | `s.db.QueryRowContext` で `moves` を読む | **読み。`moves` はコンボの書き込み tx が 1 行も書かないマスタである。** ⇒ 同上 |
| 3 | **`CharacterRepo` / `MoveRepo` によるバリデーション**（VAL-C01 / VAL-C08 / VAL-C12） | `characters` / `moves` | **読み。同上**（§10-7 で `D-360` の「使わないなら取らない」に沿う形とした） |

**⇒ 本サブ完了時点の全数 = 6（着手基点）＋ 3（本サブが内側へ入れたもの）= 9 本。すべて「読み」であり、「非 tx の UPDATE 文」は依然 0 件である。**

**★★ただし「書きに行く形」は 1 件あった**（§3.2）。**`SUPP-001` §7.1.1-3 が名指しした害（内側から別コネクションで書きにいって `SQLITE_BUSY`）に該当するのはその 1 件である。** **⇒ 「書きは 0 件」と読まないこと**（レビュー指摘 高-2。同趣旨のコード内コメントも是正した）。

**★`TestValidationReadsInsideWriteTx` が固定しているのは、この 9 本すべてに共通する性質（WAL では読みは writer と競合しない）である。**

### 3.3 §3.3-8（`RecomputeComboCache` の tx 読み非対称）の判定

**本サブで前提は動かない。** 非対称なのは**読み**であり、write lock と競合しない。**⇒ followup `notation-recompute-combo-cache-tx-read-asymmetry` は本サブでは閉じない**（据え置き）。

---

## 4. 恒久の再現テスト（§5.1）——**決定論へ翻訳した**

### 4.1 一次源が確率的だったこと

`M24-09c` 設計伝達レポート §4-1 の逐語:

> **再現条件** — `web/playwright.config.ts` の `workers: 1` を外し、`pnpm e2e … --workers=2 --retries=0` を**繰り返す**。**10 回中 1 回の頻度で**、両方の `POST /api/combos` が 201 を返し、双方が `duplicates` を 2 件観測する

**⇒ そのままでは「直った」を示せない**（指示書 §5.1「★回数で証明しない」）。

### 4.2 据えた形

`internal/service/combo/val_c02_race_test.go` の **`TestService_Create_VAL_C02_ConcurrentDoesNotDoubleInsert`**。

**テスト自身が「先行する書き込み tx」を演じる**——tx1 が同一識別キーの行を作って `raceHoldFor`（400ms）保持し、その間に `svc.Create` を走らせて commit する。**後続がその保持区間に入ることは `startedC` チャネルで同期しており、確率ではなく構造で保証される。**

| | 着手基点 | 修正後 |
|---|---|---|
| 判定の位置 | `*sql.DB` で tx1 の未コミット行が見えず「重複なし」 | `BeginTx` が tx1 の write lock で待ち、commit 後に tx 経由で読む |
| 結果 | **行が 2 件・VAL-C02 なし** | **VAL-C02 で停止・行は 1 件** |
| **実測** | **`-count=3` で 3/3 赤** | **`-count=3` で 3/3 緑** |

**★「2 本目が 1 本目の commit を待った」ことを観測している**（判定 3。所要時間が保持時間を下回らないこと）。**⇒ 主張は「N 回緑だった」ではなく「待ちが起きた」である。**

**★本リポジトリで DB を並行に触る Go テストは本件が最初である**（`t.Parallel()` は 0 件、既存の `go func` は DB を使わない 1 件のみ）。相乗りできる先例が無いため、待ちの観測方法も含めて書き下している。

---

## 5. 自己テスト結果（§7.2）

**★基準値は変更を入れる前に、パイプで切り詰めずに採った**（`M24-02` §7-2 の教訓）。

### 5.1 テスト

| 対象 | 着手前（`36b41f4`） | 完了後 |
|---|---|---|
| `go test ./... -count=1` | **55 パッケージ ok / FAIL 0**（`no test files` 8） | **55 パッケージ ok / FAIL 0** |
| `cd web && pnpm test` | **187 files / 1952 tests 全 pass** | **187 files / 1952 tests 全 pass**（**★フロントは触っていないことの対照**） |
| `cd web && pnpm exec tsc --noEmit` | — | **エラー 0** |
| `make e2e` | （着手前は未採取） | **184 passed / 0 failed / 0 flaky（exit 0・3.2m・`Running 184 tests using 1 worker`）**。**★レビュー取り込み後に再実行して同じ結果**（2026-08-28・3.1m・exit 0）——**高-1 の修正が `PATCH /api/combos/:id` という日常経路に触れるため、対照を取り直した** |

**★`make e2e` の実行直前のポート確認**（`D-548`）:

```
$ (ss -ltn || netstat -ltn) | grep -E "47390|5273" || echo "47390 / 5273 ともに空き"
47390 / 5273 ともに空き
```

**★`make e2e` はこの実行環境（クラウド）で完走した。** 既知の followup `cloud-e2e-browser-mismatch` は `Makefile:122` の `PW_EXECUTABLE_PATH` 既定で回避されており、**開発者の手番へ回す必要は無かった。**

### 5.1.1 ★開発者の実機確認（**2026-08-28 に取得**）

**★本サブで最もリスクが高いのは `PATCH /api/combos/:id` である**——高-1 の修正で `BeginTx` を `UpdateMetadata` の関数先頭へ動かしており、**同経路はメタデータ編集のたびに叩かれる日常経路**だからである。**⇒ 自動テストとは別に、開発者の実機で 3 つの操作を確認した。**

| # | 操作 | 結果 |
|---|---|---|
| 1 | **仮登録 → 本登録の昇格** | **成功**（4 経路目。高-1 で塞いだ経路そのもの） |
| 2 | **メタデータのみの編集** | **成功**（昇格しない `PATCH`。`BeginTx` を前へ動かした影響を受ける） |
| 3 | **タグのみの変更** | **成功**（`ReplaceTagAssociations` を含む tx 本体が不変であることの対照） |

**★あわせて `main` が進んでいないことを開発者が確認した**（着手基点 `36b41f4` のまま）。**⇒ マージ時の衝突は無い見込みである**（`docs/progress/progress-log.md` が唯一の候補だった）。

### 5.2 ★★一次源そのものの背中合わせ比較（**同一セッション・同一環境**）

**指示書 §3.3-1 が求めた「一次源が現在の main で赤くなるか」への回答である。**

着手基点の実装（`internal/infra/db/db.go` ／ `internal/repository/combo/repository.go` ／ `internal/service/combo/service.go` ／ `internal/api/combo/handler.go` ／ `internal/api/combo/materialize_handler.go` の 5 ファイルを `git show 36b41f4:` で一時的に戻したもの）と、修正後とで、**同じ手順を 10 回ずつ回した**。

```
$ pnpm e2e e2e/aa-interference-probe-a.spec.ts e2e/aa-interference-probe-b.spec.ts --workers=2 --retries=0
```

| | バグ再現（両方 201・`duplicates` 2 件） | `VAL-C02` で正しく拒否 |
|---|---:|---:|
| **着手基点（`36b41f4` 相当）** | **7 / 10** | 3 / 10 |
| **修正後** | **0 / 10** | **10 / 10** |

**★`--workers=2` では probe が赤くなること自体は正しい**——同 spec は「並列で走っていること」の検出器であり、`workers >= 2` で必ず赤になるよう作られている。**変わったのは赤の理由である**: 「両方が入り込んだ」から「2 本目が正しく拒否された」へ。

**★一次源の報告（10 回中 1 回）より高い頻度で出た**（7 / 10）。環境によって出方が変わることの実例であり、**「出なくなった」を「直った」と読んではならない**という指示書 §9.3 の警告を裏づける。

**★`web/e2e/aa-interference-probe-{a,b}.spec.ts` と `web/e2e/support/interference-probe.ts` は 1 文字も編集していない**（同ファイルが「開発者のファイルであり編集しない」と自ら宣言している）。

### 5.3 変更統計（着手基点からの全差分）

```
$ git diff --stat 36b41f4
 internal/api/combo/database_busy_handler_test.go   | 120 +++++++
 internal/api/combo/handler.go                      |  12 +
 internal/api/combo/materialize_handler.go          |   6 +
 internal/infra/db/busy.go                          |  40 +++
 internal/infra/db/check_then_act_test.go           | 129 +++++++
 internal/infra/db/db.go                            |  39 +-
 internal/infra/db/dsn_test.go                      |   6 +-
 internal/infra/db/txlock_test.go                   | 114 ++++++
 internal/model/api_error.go                        |  17 +
 internal/repository/combo/repository.go            |   9 +-
 internal/repository/combo/repository_test.go       |   8 +-
 .../combo/existing_duplicates_audit_test.go        | 273 ++++++++++++++
 internal/service/combo/service.go                  | 211 +++++++++--
 internal/service/combo/txscope_internal_test.go    |  49 +++
 internal/service/combo/val_c02_race_test.go        | 395 +++++++++++++++++++++
 web/src/constants/api-error.ts                     |  15 +
 16 files changed, 1396 insertions(+), 47 deletions(-)
```

**★新規ファイル 7 本の deletions がすべて 0 であることを確認した**（教訓 `E-225`。**deletions のある新規ファイルは、それ自体が矛盾している**）:

```
internal/api/combo/database_busy_handler_test.go             +120 -0 OK
internal/infra/db/busy.go                                    +40 -0 OK
internal/infra/db/check_then_act_test.go                     +129 -0 OK
internal/infra/db/txlock_test.go                             +114 -0 OK
internal/service/combo/existing_duplicates_audit_test.go     +273 -0 OK
internal/service/combo/txscope_internal_test.go              +49 -0 OK
internal/service/combo/val_c02_race_test.go                  +395 -0 OK
```

**`migrations/` の差分**:

```
$ git diff --stat 36b41f4 -- migrations/
（出力なし＝0 バイト）
```

### 5.4 破壊確認 3 件（§5.4）——**3 件とも観測が動いた**

**★書く前に (a) 壊す対象が実在するか (b) その壊し方で観測が動くか を確かめた**（計測点 `M-78` ／ playbook §4.32）。

| # | 壊したもの | 実施コマンド | 結果 | 出力の逐語 |
|---|---|---|---|---|
| **1** | `db.go:99` の `buildDSN` から `dsnTxLockParam + "&"` を削る（DEFERRED へ戻す） | `go test ./internal/service/combo/ -run 'ConcurrentDoesNotDoubleInsert' -count=1`<br>`go test ./internal/infra/db/ -run 'WriteTxUsesBeginImmediate' -count=1` | **★赤（2 経路）** | 再現: `insert combo: database is locked (5) (SQLITE_BUSY)` ／ infra: `2 本目の BeginTx が待たされていない(所要 576.543µs < 保持 400ms)` |
| **2** | `Create` の検証を `BeginTx` の手前へ戻し、`s.validDeps` で実行する | `go test ./internal/service/combo/ -run 'ConcurrentDoesNotDoubleInsert' -count=1` | **★赤** | `同一識別キーの生きた本登録コンボが 2 件ある(期待 1 件)` ＋ `後続の Create が VAL-C02 で止まらなかった` |
| **3** | `txScopedDeps` の本体を `return s.validDeps` にする（tx を束ねない） | `go test ./internal/service/combo/ -run 'TxScopedDeps_Replaces' -count=1` | **★赤（配線テスト）** | `txScopedDeps が tx を束ねていない。判定が *sql.DB 直読みのままになる` |
| **4** | **昇格経路（`UpdateMetadata`）の `BeginTx` を昇格ブロックの後ろへ戻す**（着手基点の形） | `go test ./internal/service/combo/ -run 'PromotionDoesNotDoubleInsert' -count=1` | **★赤** | `同一識別キーの生きた本登録コンボが 2 件ある(期待 1 件)。昇格経路の VAL-C02 が判定と登録の間に割り込まれている` ＋ `昇格が VAL-C02 で止まらなかった` |

**赤くなった経路 = 4 / 4。** **★破壊確認 4 は 2026-08-28 にレビュー指摘 高-1 を受けて追加したものであり、「4 経路目が実在の欠陥だった」ことの証明である**（着手基点の形では行が 2 件・`VAL-C02` なし → 修正後は 1 件・`VAL-C02` で停止）。

**★破壊確認 4 でも「tx を束ねないだけ」では赤くならなかった**（破壊確認 3 と同じ非対称。`BEGIN IMMEDIATE` の直列化により commit 済みの行が見えるため）。**⇒ 赤くするには「判定を `BeginTx` の前へ戻す」必要がある。この非対称は 4 経路すべてに共通する。**

#### ★★破壊確認 1 で分かったこと（**設計の裏づけ**）

**`_txlock` を外すと、再現テストは「行が 2 件」ではなく `SQLITE_BUSY` で落ちた。** 機序は次のとおり——検証を tx の内側へ入れた状態で `BEGIN`（DEFERRED）にすると、tx2 は先に**読み**を行ってから**書き**へ昇格しようとする。**WAL では、既に読んだトランザクションの write への昇格は待てない**（待つとデッドロックしうるため SQLite が即座に `SQLITE_BUSY` を返す）。**⇒ `busy_timeout` は効かない。**

**★これは「`BEGIN IMMEDIATE` でなければならない」ことの独立した裏づけである**——検証を内側へ移すだけでは足りず（破壊確認 2 が示す）、内側へ移したうえで DEFERRED のままにすると今度は `SQLITE_BUSY` になる（破壊確認 1 が示す）。**2 つを同時に満たす形は `BEGIN IMMEDIATE` ＋ 内側検証だけである。**

#### ★破壊確認 3 について（**当初は空振りしていた。是正した**）

**指示書 §5.4-3 は「赤くならないなら、その形が守られていないということである。その旨を報告すること」と定めている。** 実際、**最初に置いたテスト（`TxScopedDeps_BindsTxToDuplicateChecker`）では赤くならなかった**——同テストはアダプタを自分で組み立てて `WithTx` を呼ぶため、配線（`txScopedDeps`）を壊しても通ってしまう。

**⇒ 配線そのものを通る内部テスト（`TxScopedDeps_ReplacesComboRepoWithTxBoundAdapter`）を足して是正した。** 現在は赤くなる。

**★★あわせて報告すべき事実**: **破壊確認 3 では、再現テスト自体は緑のままである。** 理由は `BEGIN IMMEDIATE` の直列化にある——**2 本目が判定する時点で 1 本目は既に commit しているため、`*sql.DB` で読んでも重複が見える。**

**⇒ 正直に言えば、`*sql.Tx` の束ねは `VAL-C02` の正しさにとって今日は必須ではない。** 束ねが守っているのは **`D-360` の規約**（「署名が `*sql.Tx` を取るなら、その tx を読みにも使うこと」）と、**将来「判定より前に同じ tx が書く」形が生まれたときの防御**である。**この非対称を隠さずに書いておく。**

---

## 6. 他の check-then-act の一覧（§4.4）——**一覧を作るところまで**

**§3.3-9 の実査結果。母数 = 24 の書き込み tx 開始点と、その前後の検査を走査した。**

### 6.1 ★一律の手でそのまま守られるもの（**手当て不要**）

| 対象 | 根拠 |
|---|---|
| **`VAL-P05`（プリセット上限 8 件）** | `internal/service/preset/service.go:166` の **`CountPresets(ctx, tx)` が INSERT（`:204`）と同じ tx の内側**にある。VAL-P04（`:176`）・VAL-P03（`:188`）・コード採番（`:196`）も同じ tx。**⇒ `BEGIN IMMEDIATE` によってそのまま守られる** |

**★その成立をテストで固定した**（チェックリスト 4-3）。**ただし `internal/service/preset/` は契約 F-1 の凍結パッケージであり、テストであってもファイルを足せば差分になる**（チェックリスト 2-7 は差分を「重大」と判定する）。**⇒ 実装は読んで確かめるに留め、根拠となる「機構」の側を `internal/infra/db/check_then_act_test.go` で固定した**——`TestCheckThenActInsideTxIsSerialized`（tx の内側なら上限を越えない）と `TestCheckThenActOutsideTxOverruns`（外へ出すと越えうる）の対照である。**本テストが赤くなったら `VAL-P05` の判定も同時に崩れる。**

### 6.2 ★手当てが要るもの（**★本サブでは直さない。報告する**）

| # | 対象 | 実測 |
|---|---|---|
| **1** | **`VAL-S04`（セットプレイの重複）** | **3 経路すべてで検査が tx の外**。`CreateSetup:210`（`BeginTx:223` の前）／ `UpdateSetup:447`（`BeginTx:453` の前）／ **`CreateSetupInTx:288`（呼出元の開いた tx の内側から非 tx ハンドルで）**。**★3 番目は §3 の 6 本のうち 4 番と同一件であり、二重の形になっている**（tx の内側なのに tx を見ない＝read-your-own-write が効かない）。**★`migrations/` にセットプレイのレシピキーへの UNIQUE も無い** |
| **2** | **タグの重複** | `tag/service.go:69` の `List` と `:78` の `Create` が**そもそも tx を持たない**。**★ただし DB 側に `UNIQUE (user_id, name)`（`migrations/000001_init_schema.up.sql:114`）が在るため重複行は生まれない。** 生じるのは**生の制約違反が `ErrTagNameDuplicate` へ翻訳されず 500 になる**ことである（`repository/tag/repository.go:143-146`）。**⇒ 害の形が `VAL-S04` とは違う** |
| **3** | **その他 4 件の tx 外検査** | `user.Create` の `ExistsByName`（`user/service.go:101` の前）／ `combo.Update` の前段読み（`service.go:561-571`）／ `combo.UpdateWithKeyChange` の前段読み（`:653-663`。**★M4-03 の KA 検査。本サブで tx の後ろへ移したが、依然として非 tx である**）／ `setup.CreateSetupLink` の存在確認（`service.go:346-364`） |

**★直さなかった理由**: `VAL-S04` の面（`internal/service/setup/`）は契約 F-1 の凍結対象ではないが、**指示書 §4.4 が「一覧を作るところまで」「★★本サブでは直さない。報告する」と明示している**。射程が広がるため本サブへ持ち込まない。

**★あわせて、`internal/service/combo/service.go:1017` が同型の警告を既に持っている**（「2 つの『同じ』が並ぶと、片方だけ直されて静かにずれる」）。

---

## 7. 既存データの重複（§4.5）——**検出だけ行い、消していない**

### 7.0 ★★実測結果（**2026-08-28・開発者が実行**）

**開発者のローカル DB（devcontainer）に対して監査を実行し、結果を得た。** **⇒ DoD §7.1-7 は閉じた。**

```
$ cp ~/.local/share/combomgr/combomgr.db /tmp/combomgr-audit.db
$ COMBOMGR_AUDIT_DB=/tmp/combomgr-audit.db go test ./internal/service/combo/ -run TestAuditExistingDuplicates -count=1 -v
=== RUN   TestAuditExistingDuplicates
    existing_duplicates_audit_test.go:103: 母数(本登録・未削除のコンボ) = 61 件
    existing_duplicates_audit_test.go:104: 識別キー + recipe_hash が一致する組 = 0 組 / 該当行 = 0 件
    existing_duplicates_audit_test.go:107: 重複なし
--- PASS: TestAuditExistingDuplicates (0.00s)
ok      github.com/plexiblinp/combomgr/internal/service/combo   0.005s
```

| 項目 | 値 |
|---|---|
| **母数**（本登録・未削除のコンボ） | **61 件** |
| **同一識別キー ＋ `recipe_hash` が一致する組** | **0 組 / 該当行 0 件** |
| **消したもの** | **なし**（監査は `DELETE` / `UPDATE` を 1 文も持たない） |

**⇒ 掃除の手番は発生しない。** 開発者の手番へ回す項目は無くなった。

**★★ただし「重複は存在しない」と読まないこと。** **本結果は「開発者のローカル DB の、実行時点での状態」である。** 他の利用者の DB や、今後 LAN 共有で複数端末から編集される DB について何も言っていない。**本サブが閉じたのは「これ以上増えない」ことであり、過去に入り込んだ分が 0 だったのはこの DB についての事実である。**

**★監査そのものが働くことは `TestAuditGroups_DetectsPlantedDuplicate` が固定している**（§7.1）。**⇒ 「0 件」が「本当に 0 件」であって「監査が何も見ていない」ではないことは、この対照が担保している。**

### 7.1 監査の手（**製造が用意した**）

**★着手時点では本実行環境に dev DB が無く、製造の手では数えられなかった**（`find . -name '*.db' -not -path './web/node_modules/*'` が **0 件**。クラウドのクリーンな clone であるため）。**⇒ 数えられなかった。数える手を用意し、開発者の手番へ回す。**

**用意した手**: `internal/service/combo/existing_duplicates_audit_test.go` の `TestAuditExistingDuplicates`。

```bash
COMBOMGR_AUDIT_DB=/path/to/combomgr.db \
    go test ./internal/service/combo/ -run TestAuditExistingDuplicates -count=1 -v
```

- **母数（本登録・未削除のコンボ件数）を必ず出す。** 「重複 3 組」は母数が 10 件か 10,000 件かで意味が違う（`D-551`）。
- **識別キー 6 項 ＋ `recipe_hash` で組にする。** **★SQL の `GROUP BY` ではなく Go を通す**——`recipe_hash` は列ではなくサービス層の計算値であり、`Modifiers.Flags` の `sort.Strings` 正規化を SQL で再現できないため。**本番と同じ `recipehash` の実装を通している。**
- **★`DELETE` も `UPDATE` も 1 文も書かない**（`CLAUDE.md` §10＝データの不可逆な破壊の防止）。**どちらを残すかは利用者の判断である。**
- **★失敗にしない**（`t.Logf` のみ）。赤くすると「消して緑にする」動機が生まれる。
- **★環境変数が未指定なら `t.Skip`。** 通常の `go test ./...` と CI では走らない。

**★監査そのものの有効性を固定した**——`TestAuditGroups_DetectsPlantedDuplicate`。**これが無いと、実 DB へ向けて「重複 0 件」と出たときに「本当に 0 件」なのか「監査が何も見ていない」のか区別が付かない**（計測点 `M-78`）。仕込んだ重複を検出できること、**かつ別キーを重複と数えないこと**（対照）の両方を見ている。

---

## 8. §3.3-13: `DES-006` の「保証」と読める書き方——**該当なし**

**`M24-09c` の申し送り**（「`DES-006` の `VAL-C02` の記述。判定を『保証』と読める書き方があるなら、並行要求下では保証されないことになる」）への回答である。

**`docs/design/06-validation.md` を走査した結果、「保証」の語は 1 か所のみ**（`:80`）。逐語:

> **materialize はレシピを編集できない**ため（CHANGE-089 §3.1 のスコープ境界）、**生成物のレシピは常に基底と同一＝`recipe_hash` の一致が構造的に保証される**。

**⇒ これは materialize の生成物のレシピが基底と一致することについての記述であり、「重複判定が成立すること」を保証する記述ではない。** §2.3 の判定条件の記述（`:71`「以下の条件すべてを満たす場合とする」）も、条件の定義であって成立の保証ではない。

**★該当なしと判定する。`DES-006` は 1 文字も編集していない**（チェックリスト 4-6）。

**★ただし設計卓の判断材料として 1 点添える**: §2.3 は「重複の場合は **ERROR** として登録を中止する」と書いており、**並行要求下では「重複であっても中止されない」場合があった**（本サブが閉じたもの）。**⇒ トランザクション境界に触れる記述を `CHANGE-136` の射程で足すかどうかは設計卓の手番である。**

---

## 9. §3.3-14: followup `e2e-flaky-combo-post-500` との関係

**結論を 3 点に分けて報告する**（指示書 §3.3-14「★無理に結び付けないこと」）。

### 9.1 ★本サブの競合では説明が付かない

**`VAL-C02` の check-then-act の帰結は「両方が 201 を返す」である**（§5.2 の実測でも 7/10 がその形だった）。**500 にはならない。** ⇒ **同じ経路の別の事象である。**

### 9.2 ★隣接機序の候補が 1 つある（**断定はしない**）

| 段 | 事実 |
|---|---|
| 1 | 当時（`M21-03` 期＝2026-08 前半）、**`busy_timeout` は 16 接続中 15 本で失効していた**（`DES-002` §4.2 の `M23-10` 実測表。**失効時の値は `0`＝即座にビジーを返す**） |
| 2 | **`SQLITE_BUSY` の扱いは `internal/` に 0 件だった**（§3.3-12 の実査）。**⇒ 生のエラーが各ハンドラの落穂へ落ち、500 `internal_error` になる** |
| 3 | 当該 flake は**並列ワーカーの E2E で `POST /api/combos` が 500**（`internal_error`）を返したもの |

**⇒ 段 1 と段 2 が揃えば、並列書き込みで 500 `internal_error` が出る経路は実在する。観測された症状と一致する。**

**★断定はしない**——**サーバ側ログが採取されていない**（followup 自身が「原因は未断定」と記録しており、その姿勢は正しい＝`E-84`）。**同じ症状を出しうる経路は他にもありうる。**

### 9.3 ★次に出たときは区別が付くようになった

**本サブの §4.3.1 により、`SQLITE_BUSY` は 500 `internal_error` ではなく 503 `database_busy` として出る。** **⇒ 再発時に「混雑だったのか、別の内部エラーだったのか」がログ無しで分かる。**

**★あわせて `busy_timeout` は `M23-10` で全接続に効くようになっている**（`DES-002` §4.2）。**⇒ 段 1 の前提は既に解消済みである。**

**⇒ followup を畳めるとは言わない。** **「本サブでは説明が付かないこと」「隣接機序の候補があること」「次回は区別が付くこと」の 3 点を添えて `M24-CLOSE` へ回す。**

---

## 10. 製造判断（§9.2 が推測を許容した範囲。**★選んだ理由を書く**）

| # | 論点 | 決めたこと・理由 |
|---|---|---|
| **1** | **`BEGIN IMMEDIATE` の発行方法** | **DSN の `_txlock=immediate`。★開発者が決着**（2026-08-27）。**設計卓は「DSN 方式は読み取り専用 tx と衝突する」として書き込み用ヘルパを推していたが、実査でその前提が成り立たないと分かった**（§2 の #5）。**⇒ (a) 24 か所へ呼び出し側無改造で効き「次に足す経路が忘れる」形が構造的に起きない ／ (b) ドライバが `opts.ReadOnly` で除外する ／ (c) 読み取り専用 tx は現時点で 0 件。** **★弱点は「なぜ IMMEDIATE なのかがコードから見えにくい」ことであり、`db.go` のコメントと infra テスト 2 本で埋めた** |
| **2** | **★§4.1.3（24 か所を共通ヘルパへ寄せる）を発動させなかった** | **DSN 方式では `BEGIN IMMEDIATE` の達成に不要である。** 24 ファイルに跨る差分を本サブへ持ち込むと、かえって「どちらが原因で壊れたか」が見えなくなる（§4.1.3 の趣旨そのもの）。**⇒ 寄せる作業は行っていないため、コミット分割の条件（チェックリスト 1-8）も発動していない** |
| **3** | **`SQLITE_BUSY` の応答** | **503 ＋ `database_busy`。★開発者が決着**（2026-08-27）。**409 へ寄せなかったのは `DES-006` §11.2 が「409 は 2 種類あり見分けはエラーコードで行う」と定めており、そこへ 3 種目を積むとステータスで分岐している読み手をさらに誤らせるためである。** 性質としても衝突ではなく一時的な混雑である |
| **4** | **`SQLITE_BUSY` 翻訳の適用範囲** | **`combo` の VAL-C02 経路に限った**（**2026-08-28 訂正・レビュー指摘 中-1**）。`BEGIN IMMEDIATE` の write lock を取るのがこの経路であり、`CHANGE-136` §2.4 が名指しするのも同経路であるため。**★覆ったのは `Create` / `UpdateWithKeyChange` / `Materialize`（2 本の `BeginTx` 両方）／ `UpdateMetadata` の 4 経路である。** **★★旧記載「他の `api` パッケージは据え置き」は不正確だった**——**同じ `internal/service/combo` の中にも `Delete` / `Restore` / `PermanentDelete` の 3 本が未翻訳で残る**（`UpdateMetadata` と `drainBasePunish` は本取り込みで覆った）。他パッケージの `internal_error` は実測 51 か所 / 17 ファイルで据え置き。**★これは退行ではない**（DEFERRED でも最初の書き込み文で `SQLITE_BUSY` は出ていた）。**⇒ §11 の followup 候補へ** |
| **5** | **★`FindActiveByDuplicateKey` を `duplicateKeySelectSQL` / `duplicateKeyPredicates` へ寄せなかった** | **同ファイル（`repository.go:1325-1328`）が「⇒ 本定数を `FindActiveByDuplicateKey` へ後から適用しないこと」と名指しで戒めている。** 当初プランでは寄せる予定だったが、**明示的な禁止が現物に書かれていたため取り下げた。** ⇒ 変えたのはハンドル 1 行（`r.db` → `r.runner(tx)`）だけであり、**述語の組み立てと NULL 一致の意味論には触れていない。** **★結果として `addNullable` の重複（同 `:1352-1353` が自認）は残る**——§11 の followup 候補へ |
| **6** | **★`validation` パッケージを DB 非依存のまま保った** | 同パッケージは `database/sql` を import していない（`Dependencies` がインタフェースだけで組まれている）。**tx を通すために署名を変えると、その層が `database/sql` へ結び付く。** ⇒ **tx はアダプタ（`ComboDuplicateAdapter.Tx`）が握る形にした。** **★`D-360` には抵触しない**——同規約が戒めるのは「tx を受け取りながら読みに使わない」形であり、本フィールドは候補抽出と steps 取得の両方に使われる |
| **7** | **★`CharacterRepo` / `MoveRepo` を tx 経由にしなかった** | **VAL-C01（characters）と VAL-C08 / VAL-C12（moves）が読むのはマスタであり、コンボの書き込み tx はこれらを 1 行も書かない。** ⇒ 未コミット行を見る必要が無く、非 tx のままで判定は成立する。**`D-360` の「使わないなら取らない」に沿う形である** |
| **8** | **★`PUT` の M4-03 検査を `BeginTx` の後ろへ移した** | 検証を tx の内側へ入れた結果、**エラーの優先順位（バリデーション → M4-03）を保つには M4-03 を検証の後ろに置く必要があった。** ⇒ tx の内側になったが、**読むのはコミット済みの旧行であり非 tx のままで成立する**（§6.2 の 3 に記録） |
| **9** | **再現テストの所在と形** | `internal/service/combo/val_c02_race_test.go`（Go・サービス層）。**E2E では 2 本のトランザクションを決定論的に並べられない**ため（指示書 §5.1）。**★形は §4.2 のとおり「テスト自身が先行 tx を演じる」ものにした**——一次源の「2 つの spec が奪い合う」形をそのまま Go へ持ち込むと確率的なままになるため |

---

## 11. ★併せて更新が要るもの

| # | 項目 | 状態 |
|---|---|---|
| 1 | **消費した CHANGE 番号の登録** | **なし。** `CHANGE-136` は**設計卓が起票済み**であり、**製造は番号を消費していない**。⇒ `docs/handover/change-number-registry.md` §1 への登録は発生しない |
| 2 | **「次の番号」の写し先** | **なし**（上記のとおり番号を消費していないため） |
| 3 | **消費したマイグレ連番** | **なし。** `ls migrations/` の最新は **`000079_fix_character_display_names`**。**次に払い出す番号は `000080` のまま**であり、ボード §2.2 とずれていない |
| 4 | **版を上げた文書の参照元** | **なし**（設計書を 1 つも編集していない） |
| 5 | **`web/CLAUDE.md` §1 のブラウザストレージ台帳** | **追記不要。** ブラウザストレージを使っていない（`check-browser-storage-keys.sh` 緑） |
| 6 | **列挙定数の同期** | **実施済み。** `model.ErrorCodeDatabaseBusy` ⇄ `web/src/constants/api-error.ts` の `API_ERROR_CODE_DATABASE_BUSY`（`.claude/rules/enum-sync.md`）。`check-enum-sync.sh` は**ベースラインどおり（増加なし）** |

### 11.1 followup 候補（**設計伝達レポート §4 へ回す。畳むのは設計卓**＝`D-382`）

| # | 候補 | 要旨 |
|---|---|---|
| 1 | **`VAL-S04` の check-then-act** | 3 経路すべてで検査が tx の外。うち `CreateSetupInTx` は**開いた tx の内側から非 tx ハンドルで読む**二重の形（§6.2-1） |
| 2 | **タグ重複の 500** | DB の `UNIQUE (user_id, name)` が重複行は防ぐが、制約違反が `ErrTagNameDuplicate` へ翻訳されず 500 になる（§6.2-2） |
| 3 | **その他 4 件の tx 外検査** | `user.Create` ／ `combo.Update` ／ `combo.UpdateWithKeyChange` の前段読み ／ `CreateSetupLink`（§6.2-3） |
| 4 | **`SQLITE_BUSY` 翻訳の他パッケージへの展開** | 実測 51 か所 / 17 ファイルの `internal_error` は据え置き（§10-4） |
| 5 | **`addNullable` の重複** | `FindActiveByDuplicateKey` 内のローカルクロージャと `duplicateKeyPredicates` が同じ意味論を 2 か所に持つ。**コード自身が「片方だけ直さないこと」と自認している**（§10-5） |
| 6 | **`notation-recompute-combo-cache-tx-read-asymmetry`** | **本サブでは閉じない**（§3.3 の判定を添えて据え置き） |
| 7 | **`e2e-flaky-combo-post-500`** | §9 の 3 点を添えて `M24-CLOSE` へ |
| 8 | ~~**既存データの重複**~~ | **★完了**（2026-08-28。母数 61 件・重複 0 組＝§7.0）。**⇒ followup へ回す必要は無くなった** |

**★`M24-04` へ渡す課題は無い**（§3.3-11 の保存ボタンは既に守られていた）。

---

## 12. CHANGE 要否の判定（§7.4.1・8 条件を 1 件ずつ）

| # | 条件 | 判定 |
|---|---|---|
| **1** | `DES-002` §4.2 の経路表に載る API の応答が変わったか | **★該当する。** `POST /api/combos` ／ `PUT /api/combos/{id}` ／ materialize に **503 `database_busy`** が加わった。**⇒ `CHANGE-136` の射程内**（同 §2.4 が「as-built で確定」としている）。**as-built を §10-3 / §10-4 に報告した** |
| **2** | `DES-002` §6.4 の同時実行制御の記述が変わるか | **★該当する（主対象）。** 「書き込みトランザクションは `BEGIN IMMEDIATE` で開く」「適用範囲は書き込み tx 全部」「読み取り専用は含めない（ドライバが `ReadOnly` で除外）」。**⇒ `CHANGE-136` §2.2 の射程内** |
| **3** | `DES-003` のスキーマに触れたか | **★触れていない。** `migrations/` の差分 0 バイト |
| **4** | `DES-006` の VAL の判定結果が変わったか | **★変わっていない。** 判定条件は 1 文字も変えていない。**変わったのは「並行要求下で判定をすり抜けなくなった」ことであり、判定そのものの結果ではない。** ⇒ `CHANGE-136` §2.3 の射程内（判定のトランザクション境界） |
| **5** | `REQ-001` の `NFR203` の実現方式が変わるか | **★該当する。** 「検査してから書く形は、検査と書き込みを同じ書き込みトランザクションの内側に置き、そのトランザクションを直列化することで守る」が加わる。**⇒ `CHANGE-136` §2.1 の射程内。★楽観排他は撤回していない**（UPDATE を守る手として不変） |
| **6** | `SUPP-001` §5.2 のパッケージ構成に増減があるか | **★増減なし。** 新規パッケージ 0。追加したファイルはすべて既存パッケージ内である |
| **7** | `SUPP-001` §7.1.1 の呼び出し規約が変わるか | **★変わらない。** `RecomputePresetCache` を「コミット後に呼ぶ」規約は不変であり、本サブは同関数を触っていない。**★ただし §7.1.1-3 の逐語（「開いている書き込み tx の内側から非 tx の UPDATE を撃つと `SQLITE_BUSY`」）について、本サブの実測で 1 点補足がある**——**非 tx の「読み」は WAL では競合しない**（§3.1）。**⇒ 記述を「UPDATE」に限定しておく価値がある。設計卓の判断へ回す**（`SUPP-001` の契約を持つ節は CHANGE を要する＝`D-564`） |
| **8** | マイグレーションを消費したか | **★0 本。** 案 (b) は成立した |

---

## 13. 完了条件（§7.1）の充足

| # | 条件 | 状態 |
|---|---|---|
| 1 | 実査 14 件が実施され報告されている（母数つき） | **✅** §2（母数＝#3 は 24 / #7 は 39 中 6 / #9 は §6 / #10 は §7） |
| 2 | 再現手順が恒久テストになり、直す前に赤・直した後に緑 | **✅** §4（Go テスト 3/3 赤 → 3/3 緑）／ §5.2（一次源 7/10 → 0/10） |
| 3 | `BEGIN IMMEDIATE` が書き込み tx 全部に効き、読み取り専用には効いていない | **✅** §10-1 ／ infra テスト 2 本 |
| 4 | 検証が tx の内側で `*sql.Tx` を使って行われている | **✅** §10-6 ／ 配線テスト ＋ 束ねの観測テスト |
| 5 | 「tx の内側から非 tx」が全数洗い出され、直した／報告したが分かれている | **✅** §3（母数 40 中 6 本 → 完了時 9 本。**直したのは materialize の 1 件、他は報告**） |
| 6 | 他の check-then-act の一覧が「守られる／手当てが要る」に分かれている | **✅** §6 |
| 7 | 既存データの重複が数えられている（消していない） | **✅**（**2026-08-28 に閉じた**）。**開発者のローカル DB で実測＝母数 61 件・重複 0 組**（§7.0）。**消していない** |
| 8 | `SQLITE_BUSY` の応答が重複とも版不一致とも区別されている | **✅** §10-3 ／ ハンドラテスト（3 つを 1 経路で並べる） |
| 9 | `migrations/` の差分が 0 バイト | **✅** §5.3 |

---

## 14. コミット

| # | hash | 内容 |
|---|---|---|
| 1 | `88d59fc` | `feat(M24-11/infra)`: 書き込み tx を `BEGIN IMMEDIATE` で開始する |
| 2 | `599195b` | `fix(M24-11/combo)`: `VAL-C02` の判定を登録と同じトランザクションの内側で行う |
| 3 | `7a75df7` | `feat(M24-11/api)`: `SQLITE_BUSY` を 503 `database_busy` へ翻訳する |
| 4 | `2855afa` | `test(M24-11)`: 既存データの重複監査と、配線そのものの検査を足す |

---

## 15. 品質チェック（§7.3）

| 検査 | 結果 |
|---|---|
| `bash scripts/check-artifact-integrity.sh`（**★1 本目**） | **exit 0 / 違反なし**（検査 11 件の自己検査 ＋ 生成物 4 件） |
| `bash scripts/check-md-emphasis.sh` | exit 0 |
| `bash scripts/check-doc-refs.sh` | exit 0 |
| `bash scripts/check-enum-sync.sh` | exit 0（**ベースラインどおり・増加なし**） |
| `bash scripts/check-browser-storage-keys.sh` | exit 0 |
| `bash scripts/check-stop-discipline.sh` | exit 0 |
| `bash scripts/check-progress-log-index.sh` | **§16 の追記後に実行し、緑を確認したうえで索引行を目視した**（followup §AH＝**同検査は偽の緑を返しうる**） |

---

## 16. 停止規律

**上限（再レビュー往復 2 回 ／ タイムボックス ／ 終了指示）には達していない。** `followup-backlog.md` §J への停止時記録は**発生していない**。

---

*以上、M24-11 完了報告。*

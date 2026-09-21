# M24-11 設計伝達レポート（例外レポート）

| 項目 | 内容 |
|------|------|
| **対象** | **親チャット（設計卓）** |
| 発信 | 製造担当 Claude Code / 2026-08-28 |
| 指示書 | `docs/instructions/M24-11-val-c02-check-then-act-race.md` **v1.1.0** |
| 実装コミット | ブランチ `claude/m24-11-m24-09c-plan-m2c993` ／ **8 コミット**（`88d59fc` 〜 **`124ebb7`**。着手基点 `36b41f4`）。**`claude/` 名前空間のため push 済み**（main への反映は開発者のマージ） |
| 関連 | 完了報告 `docs/progress/M24-11-completion-report.md` ／ レビュー `docs/progress/m24-11-review.md`（**重大 0 / 高 2 / 中 8 / 低 3・13 件すべて採用・往復 1 回**） |
| **★開発者が実施した確認** | **2026-08-28 に取得済み**（下記 3 件）。**① 既存データの重複＝母数 61 件・重複 0 組**（§4-8） ／ **② 実機での `PATCH /api/combos/:id` 3 操作＝すべて成功**〔仮登録→本登録の昇格 ／ メタデータのみ編集 ／ タグのみ変更〕**——本サブで最もリスクが高い経路である**（高-1 の修正で `BeginTx` を関数先頭へ動かした日常経路） ／ **③ `main` は進んでいない**（着手基点 `36b41f4` のまま＝マージ時の衝突は無い見込み） |
| CHANGE | **`CHANGE-136` を消費**（設計卓が起票済み。**製造は番号を採番していない**） ／ **マイグレ消費 0 本** ／ **新規依存 0 件** |

本レポートは **①独自確定仕様 ②契約違反の独自判断 ③製造判断 ④残課題** に絞る。指示書どおりの部分は割愛する。

> **★★最重要は §2-1 である。** **`CHANGE-136` §2.3 が定めた適用面「3 経路」は、実装の実態と違っていた（4 経路）。** **⇒ そのまま `DES-006` §2.3 へ反映すると「閉じた」という誤った状態が正典化される。受理／却下の裁定を要する。**
>
> **★§1-3 は `DES-002` §4.2 の経路表に載る API の応答変更である。** 逐語を本文へ埋めてある。

---

## §1 製造が独自に確定した実装仕様（DES 反映が要るもの）

### §1-1 ★★`VAL-C02` の適用面は **4 経路**である（`DES-006` §2.3 の射程）

**`CHANGE-136` §2.3 と指示書 §4.2 は「`POST` / `PUT` / `materialize` の 3 経路」と書いている。実装の適用面は 4 経路である。**

| # | 経路 | 入口 | 実装 |
|---|---|---|---|
| 1 | `Create` | `POST /api/combos` | `internal/service/combo/service.go:326` |
| 2 | **`UpdateMetadata` の仮登録→本登録昇格** | **`PATCH /api/combos/:id`** | **`internal/service/combo/service.go:625`** |
| 3 | `UpdateWithKeyChange` | `PUT /api/combos/:id` | `internal/service/combo/service.go:737`（判定は `:759`） |
| 4 | `Materialize` の探索 | `POST /api/combos/:id/materialize` | `internal/service/combo/service.go:1416`（`ValidateComboForCreate` を通さず直接探索＝`CHANGE-089`） |

**★4 経路とも、判定を書き込みトランザクションの内側で `*sql.Tx` を使って行う形にした。**

**⇒ `DES-006` §2.3 へ「`VAL-C02` の判定は登録と同じ書き込みトランザクションの内側で行う。適用面は上記 4 経路」を明文化してほしい。** **★「3 経路」と書かないこと。**

**★根拠**: `internal/service/validation/combo.go` の `ValidateComboForCreate` の呼出元は production に 3 か所（`service.go:326` / `:625` / `:759`）、加えて materialize が同等の探索を直接行う（`:1416`）。**レビュー担当が独立に全数走査して検出した**（レビュー報告 高-1）。

**★昇格が適用面である理由**——**`is_draft` を 0 にする操作は、重複判定の母集団（`is_draft = 0 AND deleted_at IS NULL`）へ行を持ち込む。** INSERT ではないが害の形は同じである。

### §1-2 ★`BEGIN IMMEDIATE` の発行方法を DSN で確定した（`DES-002` §6.4 の as-built）

**`internal/infra/db/db.go:78` に `dsnTxLockParam = "_txlock=immediate"` を新設し、`buildDSN`（`:99`）で `_pragma` 4 種と連結する。**

as-built の DSN:

```
file:<パーセントエンコードしたパス>?_txlock=immediate&_pragma=busy_timeout(5000)&_pragma=foreign_keys(1)&_pragma=journal_mode(WAL)&_pragma=synchronous(NORMAL)
```

| 項目 | 確定値 | 根拠 |
|---|---|---|
| 適用範囲 | **書き込みトランザクション全部（24 か所）**。呼び出し側は 1 行も変えていない | `grep -rn "BeginTx(" internal/ cmd/ --include=*.go \| grep -v "_test.go" \| wc -l` = 24 |
| 読み取り専用 tx | **除外される**。ドライバが `opts.ReadOnly` を見て `beginMode` を外す | `modernc.org/sqlite@v1.50.0/tx.go:22-25` |
| マイグレーション接続 | **及ばない**（意図どおり） | `internal/infra/migration/migrate.go:55` は生パスで `sql.Open` し `buildDSN` を通らない |
| `_pragma` 4 種・`file:` 形式 | **1 文字も変えていない**（`M23-10` / `CHANGE-142` の根治は不変） | `internal/infra/db/db.go:38-41` |

**⇒ `DES-002` §6.4 へ「書き込みトランザクションは `BEGIN IMMEDIATE` で開く。発行は接続文字列の `_txlock=immediate` による。読み取り専用は `sql.TxOptions{ReadOnly: true}` で除外される」を明文化してほしい。**

**★★`M23-10` の型と混同しないこと**——**`_pragma` は「接続を作るとき 1 回」効く接続単位の設定、`_txlock` は `BeginTx` のたびに参照される既定の begin モードでトランザクション単位である。** 同じ DSN に載るが粒度が違う（`db.go:57-70` に書き分けてある）。

### §1-3 ★★`SQLITE_BUSY` の応答を確定した（**`DES-002` §4.2 の経路表に載る API の応答変更**）

**状況**: `BEGIN IMMEDIATE` は開始時点で write lock を取りにいき、`busy_timeout`（5000ms）待っても取れなければ `SQLITE_BUSY` を返す。**着手基点では `SQLITE_BUSY` の扱いが `internal/` に 0 件で、各ハンドラの落穂として 500 `internal_error` になっていた。**

**確定した応答**: **`503 Service Unavailable` ＋ エラーコード `database_busy`**。

**実 DTO（逐語。`json.MarshalIndent` の出力）:**

```json
{
  "error": {
    "code": "database_busy",
    "message": "データベースが混み合っています。少し時間をおいて再度お試しください"
  }
}
```

**エラー契約の全行（`VAL-C02` の適用面 4 経路に共通）:**

| 状況 | ステータス | コード |
|---|---|---|
| 入力が不正（**`VAL-C02` の重複を含む**） | **400** | `validation_failed`（`details.validations` に `issues[]`） |
| 対象が無い | 404 | `not_found` |
| 版が古い（楽観排他） | 409 | `version_conflict` |
| 存在しないタグ ID | 400 | `invalid_tag_id` |
| KA 変更時にセットプレイ引き継ぎ指定が無い | 400 | `missing_setup_carry_options` |
| **write lock を取れなかった** | **503** | **`database_busy`** |
| 上記以外のサーバ側エラー | 500 | `internal_error` |

**★持たせなかった分岐**（読む側が誤読しないために書く）:

- **`Retry-After` ヘッダは付けていない。** 待つべき時間を算出する根拠が無く、付けると「その時間待てば通る」と読まれるため。
- **サーバ側の自動リトライは実装していない。** `busy_timeout`（5 秒）が既にドライバ層の待ちであり、その上に積むと応答が最大 10 秒級になる。
- **画面の専用分岐は作っていない。** `web/src/features/combo/saveError.ts` は 503 を `kind: "other"` へ落とし、サーバの日本語文言をそのまま出す（指示書 §4.3.1「汎用のエラー表示に載るところまででよい」）。**⇒ `web/src/constants/api-error.ts` の `API_ERROR_CODE_DATABASE_BUSY` は現時点で未参照である。列挙同期規約（`.claude/rules/enum-sync.md`）に基づく定義であり、意図的に分岐していない旨を `saveError.ts` へ明記した。**

**★翻訳の適用範囲**: `VAL-C02` の適用面 4 経路 ＋ `drainBasePunish`（materialize の 2 本目の `BeginTx`）の **計 5 か所**。**★同じ `internal/service/combo` の `Delete` / `Restore` / `PermanentDelete` は未翻訳（500 のまま）であり、他パッケージも据え置きである**（§4-4）。

**⇒ `DES-002` §4.2 へ上記のエラー契約を反映してほしい。**

---

## §2 契約・設計に反する独自判断（★受理／却下の裁定を要する）

### §2-1 ★★`CHANGE-136` が定めた適用面「3 経路」を超えて、4 経路目を塞いだ

| 項目 | 内容 |
|---|---|
| **何に反したか** | **`CHANGE-136` §2.3「★適用面＝`POST /api/combos` ／ `PUT /api/combos/{id}` ／ materialize の 3 経路」** ／ 指示書 §4.2 の同旨 |
| **実装がどうなっているか** | **4 経路目（`UpdateMetadata` の仮登録→本登録昇格）も同じ形にした**（`internal/service/combo/service.go:610` で `BeginTx`、`:625` で `s.txScopedDeps(tx)` を渡して判定） |
| **なぜそう判断したか** | **(a) 実在の欠陥だった**——破壊確認 4 で確認（着手基点の形では**同一識別キーの本登録が 2 件生存し `VAL-C02` は発火しない**、修正後は 1 件・`VAL-C02` で停止）。**(b) 本サブの目的（指示書 §1.2＝`VAL-C02` の判定と登録を割り込まれない 1 つの操作にする）と DoD §7.1-4 は、4 経路目が開いたままでは満たされない。** **(c) 指示書 §4.4 の「一覧を作るところまで」は `VAL-P05` / `VAL-S04` / タグ等の**別 VAL**を指しており、`VAL-C02` 自身には掛からないと読んだ。** **(d) 修正は既存 3 経路と機械的に同形であり、射程の拡大が小さい** |
| **レビューの見解との差** | **レビューは「直すか否かは射程外でよい。問題は一覧に無いことだ」としていた**（レビュー報告 高-1）。**製造は上記 (b)(c) により「塞ぐことが正しい結末」と判断した。⇒ この判断自体が §2 の対象である** |
| **★設計卓へのお願い** | **`CHANGE-136` の適用面を 4 経路へ改めたうえで `DES-006` §2.3 へ反映してほしい。** **★「3 経路で閉じた」として反映しないこと。** 却下（＝昇格経路は別サブへ戻す）とする場合は、**その旨を指示いただければ当該コミット部分を切り離す。** |

**★あわせて**: `internal/service/validation/combo.go` の `ValidateComboForCreate` の godoc が **「`POST /api/combos` と `PUT /api/combos/:id`（キー変更編集）で共通に使用する」と 2 経路しか挙げておらず、昇格経路が落ちていた。** **これが今回の欠落を招いた一因である。** 4 経路すべてと「新しい呼出元を足すときも tx の内側で判定すること」を明記する形へ是正した（本サブ以前からの記述であり、`DES` 側の記述ではない）。

### §2-2 ★指示書 §4.1.2 が「筋である」とした発行方法を採らなかった

| 項目 | 内容 |
|---|---|
| **何に反したか** | 指示書 §4.1.2「★発行方法」の逐語＝「(i) DSN の `_txlock=immediate` は全トランザクションに効くため §4.1.2 の『読み取り専用は含めない』と衝突する。⇒ 採るなら理由を報告すること ／ (ii) 書き込み用のヘルパ 1 本で `BEGIN IMMEDIATE` を発行する形が筋である」。**★指示書は (ii) を「筋である」としていた** |
| **実装がどうなっているか** | **(i) の DSN 方式を採った**（`internal/infra/db/db.go:78` / `:99`）。**§4.1.3 の「24 か所を共通ヘルパへ寄せる」作業は発動させていない** |
| **なぜそう判断したか** | **★前提が成り立たなかった。** `modernc.org/sqlite v1.50.0` の `tx.go:22-25` は `if !opts.ReadOnly && c.beginMode != ""` であり、**ドライバ自身が読み取り専用 tx を除外する。** 加えて**本リポジトリに読み取り専用 tx は 0 件**（`TxOptions` / `ReadOnly` の出現が 0）。**⇒ 衝突の 2 本足が両方折れた。** そのうえで DSN 方式は 24 か所へ呼び出し側無改造で効き、**指示書 §4.1.2 自身の理由（「経路ごとに選ぶと次に足す経路が忘れる」）を最も強く満たす** |
| **★開発者の裁定** | **2026-08-27 に開発者が DSN 方式を選択済み**（本サブの Plan Mode で 3 択を提示し決着）。**⇒ 受理済みと理解しているが、`CHANGE-136` §2.2 の「★発行方法は as-built で決まる」の埋め方として設計卓の確認を仰ぐ** |

---

## §3 製造の判断

### §3-1 開発者へ確認して確定した点

| # | 論点 | 決着（2026-08-27） |
|---|---|---|
| 1 | `BEGIN IMMEDIATE` の発行方法 | **DSN の `_txlock=immediate`**（§2-2） |
| 2 | `SQLITE_BUSY` の応答 | **503 ＋ `database_busy`**（§1-3） |
| 3 | `make e2e` がクラウドで走らない場合の扱い | **開発者の手番として報告する**。★結果として**クラウドで完走したため発動しなかった**（184 passed / exit 0） |

### §3-2 推測で進めた点（指示書 §9.2 が推測を許容している範囲）

| # | 事項 | 判断と理由 |
|---|---|---|
| 1 | **`FindActiveByDuplicateKey` を共通述語へ寄せなかった** | 当初プランでは `duplicateKeySelectSQL` / `duplicateKeyPredicates` へ寄せる予定だったが、**`internal/repository/combo/repository.go:1325-1328` が「⇒ 本定数を `FindActiveByDuplicateKey` へ後から適用しないこと」と名指しで戒めていた**ため取り下げた。**⇒ 変えたのはハンドル 1 行（`r.db` → `r.runner(tx)`）と署名のみ。述語と NULL 一致の意味論には触れていない。** **★副作用として `addNullable` の重複（同 `:1352-1353` が自認）は残る**（§4-5） |
| 2 | **`validation` パッケージを DB 非依存のまま保った** | 同パッケージは `database/sql` を import していない。tx を通すために署名を変えると層が `database/sql` へ結び付く。**⇒ tx はアダプタ（`ComboDuplicateAdapter.Tx`）が握る形にした。** **★`D-360` には抵触しない**——同規約が戒めるのは「tx を受け取りながら読みに使わない」形であり、本フィールドは候補抽出と steps 取得の両方に使われる |
| 3 | **`CharacterRepo` / `MoveRepo` を tx 経由にしなかった** | VAL-C01（`characters`）と VAL-C08 / VAL-C12（`moves`）が読むのはマスタであり、コンボの書き込み tx はこれらを 1 行も書かない。**⇒ 未コミット行を見る必要が無く、`D-360` の「使わないなら取らない」に沿う** |
| 4 | **既存データの重複を「数える手」を Go テストとして置いた** | `recipe_hash` は列ではなく計算値であり、SQL の `GROUP BY` では `Modifiers.Flags` の `sort.Strings` 正規化を再現できない。**⇒ 本番と同じ `recipehash` を通す形にした**（`internal/service/combo/existing_duplicates_audit_test.go`。環境変数未指定なら `t.Skip`） |

---

## §4 設計担当が未把握の残課題・申し送り

> **★`followup-backlog.md` の本表は製造が編集しない**（`D-382`）。**設計卓が迷わず追加できる形で書く。**

### §4-1 ★★【既存行の更新】`val-c02-check-then-act-race-on-combo-create` を「解消」へ

| 項目 | 内容 |
|---|---|
| **スラッグ** | `val-c02-check-then-act-race-on-combo-create`（`followup-backlog.md:830`） |
| **更新の別** | **既存行の更新**（新規登録ではない） |
| **更新後の状態** | **解消**（2026-08-28・`M24-11`）。現在は「**起票済・投入可能**」のまま取り残されている |
| **根拠** | 決定論テスト `TestService_Create_VAL_C02_ConcurrentDoesNotDoubleInsert`（修正前 3/3 赤 → 修正後 3/3 緑）／ 一次源の背中合わせ（着手基点 **7/10 再現** → 修正後 **0/10**・同一セッション同一環境）／ 破壊確認 4/4 |
| **★注意** | **同行の内容列は「UNIQUE 制約の追加」「`DES-003` への射程」を前提に書かれているが、開発者は案 (b) を選択済み（`D-568`）でスキーマ変更 0 である。** 畳むときに内容列の前提と食い違わないようにされたい |

### §4-2 ★【新規登録】`VAL-S04` の check-then-act（**3 経路すべて tx の外**）

| 項目 | 内容 |
|---|---|
| **スラッグ候補** | `setup-val-s04-check-then-act-race` |
| **何が起きるか** | **同一コンボに同一レシピのセットプレイが 2 件紐付きうる。** `VAL-S04`（「同一レシピのセットプレイが既にこのコンボに紐付いています」）が防ぐはずの状態 |
| **根拠（ファイルパス:行）** | 検査は `internal/service/setup/validate.go:135`（`FindDuplicateInCombo`）。**3 経路すべてで tx の外**——`CreateSetup`（`internal/service/setup/service.go:210` 検査 → `:223` `BeginTx`）／ `UpdateSetup`（`:447` 検査 → `:453` `BeginTx`）／ **`CreateSetupInTx`（`:288`。呼出元の開いた tx の内側から非 tx ハンドルで読む＝二重の形）**。**`migrations/` にセットプレイのレシピキーへの UNIQUE も無い** |
| **割付の候補と理由** | **独立サブ**。**`M24-11` と同型であり、同じ手（`BEGIN IMMEDIATE` は既に全 tx へ効いているので、判定を tx の内側へ移して `*sql.Tx` で読む）で閉じる見込み。** **★`CreateSetupInTx` は read-your-own-write が効かない形でもあるため、そこだけ扱いが違う** |
| **★本サブで直さなかった理由** | 指示書 §4.4 が「一覧を作るところまで」と定めている |

### §4-3 ★【新規登録】タグ重複が 500 になる

| 項目 | 内容 |
|---|---|
| **スラッグ候補** | `tag-duplicate-constraint-not-translated` |
| **何が起きるか** | **重複行は生まれない**（DB の `UNIQUE (user_id, name)` が防ぐ）**が、制約違反が `ErrTagNameDuplicate` へ翻訳されず 500 `internal_error` になる。** 利用者には「サーバーエラー」としか見えない |
| **根拠** | 検査 `internal/service/tag/service.go:69`（`List`）と書き込み `:78`（`Create`）が**そもそも tx を持たない**。`internal/repository/tag/repository.go:143-146` が生の制約違反をラップして返す。UNIQUE は `migrations/000001_init_schema.up.sql:114`。ハンドラの 409 は `internal/api/tag/handler.go:95` |
| **割付の候補と理由** | **改善レーン**。**害の形が `VAL-S04` と違う**（データは壊れず、応答だけが誤る）ため、同じサブへ束ねないほうがよい |

### §4-4 ★【新規登録】`SQLITE_BUSY` 翻訳の残余

| 項目 | 内容 |
|---|---|
| **スラッグ候補** | `sqlite-busy-translation-remaining-paths` |
| **何が起きるか** | 書き込み経路で `SQLITE_BUSY` が出たとき、**翻訳済みの 5 か所以外は 500 `internal_error`** のまま。同じ「混雑」が経路によって 503 と 500 に割れる |
| **根拠** | 翻訳済み＝`internal/service/combo/service.go` の `:326` / `:610` / `:737` / `:1406` / `:1559`。**未翻訳＝同パッケージの `Delete` / `Restore` / `PermanentDelete`**、および他 16 パッケージ（`grep -rn 'internal_error' internal/api/ --include=*.go \| grep -v _test.go \| wc -l` = 51 か所 / 17 ファイル） |
| **割付の候補と理由** | **改善レーン**。**★退行ではない**（DEFERRED でも最初の書き込み文で `SQLITE_BUSY` は出ていた）。**★機械的に広げられる**——`busyOr` と `errors.Is` の 1 分岐で済み、`internal_error` を主張しているテストは 0 件である |

### §4-5 ★【新規登録】`addNullable` の重複（`CO-006` 系）

| 項目 | 内容 |
|---|---|
| **スラッグ候補** | `combo-duplicate-key-predicates-duplicated` |
| **何が起きるか** | 重複判定キーの NULL 一致の意味論が **2 か所に並んでいる**。片方だけ直されると静かにずれる |
| **根拠** | `internal/repository/combo/repository.go:1269-1277`（`FindActiveByDuplicateKey` 内のローカルクロージャ）と `:1354-1373`（`duplicateKeyPredicates`）。**コード自身が `:1352-1353` で「同じ意味論である。片方だけ直さないこと」と自認している** |
| **割付の候補と理由** | **改善レーン**。**★本サブでは寄せなかった**——同ファイル `:1325-1328` が「本定数を `FindActiveByDuplicateKey` へ後から適用しないこと」と戒めており、**その禁止が `M23-05` 期の射程限定なのか恒久なのかを設計卓に判断いただきたい** |

### §4-6 ★【既存行の更新】`e2e-flaky-combo-post-500` — **本サブでは説明が付かない**

| 項目 | 内容 |
|---|---|
| **スラッグ** | `e2e-flaky-combo-post-500`（`followup-backlog.md:354`。割付の正本は `e2e-flake-seven-records-have-no-bundle-target`＝`:801`） |
| **更新の別** | **既存行の更新**（`M24-11` で調べた結果を追記） |
| **調べた結果** | **(1) 本サブの競合では説明が付かない**——競合の帰結は「両方が 201」であって 500 ではない（§5.2 の実測でも 7/10 がその形）。**(2) 隣接機序の候補が 1 つある**——当時 `busy_timeout` は 16 接続中 15 本で失効（実効 0＝即座にビジー）しており、かつ `SQLITE_BUSY` の扱いが `internal/` に 0 件で 500 `internal_error` に落ちていた。**症状と一致する。(3) 断定はしない**——サーバ側ログが未採取（`E-84`）。**(4) 次回は区別が付く**——本サブにより 503 として出る |
| **更新後の状態** | **未着手のまま**（`M24-CLOSE` で行き先を確認）。**★「`M24-11` で解消」としないこと** |

### §4-7 ★【既存行の更新】`notation-recompute-combo-cache-tx-read-asymmetry` — **本サブで前提は動かない**

| 項目 | 内容 |
|---|---|
| **スラッグ** | `notation-recompute-combo-cache-tx-read-asymmetry`（`followup-backlog.md:330`） |
| **更新の別** | **既存行の更新**（判定結果の追記。**状態は未着手のまま**） |
| **判定** | **非対称は今も在る**（`internal/service/notation/cache.go:63` `ListAllPresets` と `:75` `resolveRecipe` 内 6 か所が非 tx。呼び出しは 4 か所すべてコミット前）。**★しかし本サブで前提は動かない**——非対称なのは**読み**であり、WAL では読みは writer と競合しない。**⇒ `BEGIN IMMEDIATE` にしても `SQLITE_BUSY` にはならない**（`TestValidationReadsInsideWriteTx` が実測で固定） |

### §4-8 ★【解決済み・手番なし】既存データの重複を数えた（**DoD §7.1-7 は閉じた**）

**2026-08-28 に開発者がローカル DB（devcontainer）に対して実行し、結果を得た。** **⇒ 本項に残る手番は無い。**

| 項目 | 値 |
|---|---|
| **母数**（本登録・未削除のコンボ） | **61 件** |
| **同一識別キー ＋ `recipe_hash` が一致する組** | **0 組 / 該当行 0 件** |
| **消したもの** | **なし** |

**⇒ 掃除のサブを起こす必要は無い。** 逐語は完了報告 §7.0 にある。

**★★ただし「重複は存在しない」と読まないこと。** **本結果は「開発者のローカル DB の、実行時点での状態」である。** 他の利用者の DB について何も言っていない。**本サブが閉じたのは「これ以上増えない」ことである。**

**★「0 件」が「監査が何も見ていない」ではないことは、`TestAuditGroups_DetectsPlantedDuplicate`（仕込んだ重複を検出できること ＋ 別キーを重複と数えないことの両側）が担保している**（計測点 `M-78`）。

### §4-9 ★【`SUPP-001` の契約節・`D-564` 該当】§7.1.1-3 の記述を「UPDATE」に限定したい

**現行の逐語**（`SUPP-001` §7.1.1 の表 3 行目）:

> **接続プールが無制限・`busy_timeout` 5 秒 ⇒ 開いている書き込み tx の内側から非 tx の UPDATE を撃つと別コネクションになり `SQLITE_BUSY`**

**本サブの実測**: 開いた書き込み tx の内側から走る非 tx の呼び出しは**完了時 9 本、すべて「読み」**であり、**`BEGIN IMMEDIATE` 下でも `SQLITE_BUSY` にならない**（`TestValidationReadsInsideWriteTx`）。**WAL では読みは writer と競合しないためである。**

**⇒ 記述の対象を「非 tx の UPDATE」から「非 tx の書き込み」へ広げてほしい**（別コネクションで書きにいく形。自前で `BeginTx` する関数の呼び出しを含む）。**あわせて「読みは競合しない」を明記してほしい。** **★`SUPP-001` の契約を持つ節であるため CHANGE を要する**（`D-564`）。

**★実例**: `Materialize` の「既存 id を返す」経路が `drainBasePunish`（自前で `BeginTx`）を呼んでおり、**これが唯一「実際に踏む形」だった**（`internal/service/combo/service.go:1391-1400` で自分の tx を閉じてから呼ぶ形へ直した）。**非 tx の `UPDATE` 文ではないが、§7.1.1-3 が言う害には該当する。**

### §4-10 ★【`M24-04` へ】保存ボタンの二度押し — **課題なし**

**指示書 §3.3-11 の実査結果**: **既に守られている。** `web/src/features/combo/components/ComboEditor.tsx:884` が `disabled={isMutating}`、加えて `:203` に `saveInFlightRef` の再入ガードがある（**`M23-09` §4.6-3 が「ダイアログを挟むと `disabled` だけでは窓が閉じない」として入れたもの**）。**⇒ `M24-04` へ渡す課題は無い。**

---

## §5 参考（触れていない＝不変の証跡）

- `migrations/`: `git diff --stat 36b41f4 -- migrations/` が空（**0 バイト・マイグレ消費 0**）。次に払い出す番号は `000080` のまま
- 凍結パッケージ: `internal/service/notation/` ／ `internal/service/preset/` は `git diff --name-only 36b41f4` に 1 本も出ない
- `DES-006` 本体: `docs/design/` に差分なし（**製造は設計書を編集していない**）
- DSN の `_pragma` 4 種・`file:` 形式: `internal/infra/db/db.go:38-41` 不変。`TestOpen_AllPooledConnectionsHaveAppPragmas` 緑
- 判定条件: `repository.go` の差分はハンドル 1 行と署名のみ。`whereParts` / `addNullable` に変更なし
- `deleted_at IS NULL` / `is_draft = 0`: 不変。`TestService_UpdateWithKeyChange_StillSucceeds` / `_SameKeyStillCollides` が両側を固定
- 楽観排他: 対象・粒度とも差分なし。`TestService_UpdateMetadata_NonPromotingPatchStillWorks` が版の加算を固定
- `SetMaxOpenConns`: 追加なし（`db.go:111-112` の意図注記も不変）
- `scripts/`: 差分なし（`check-*.sh` の判定ロジックを緩めていない）
- 既存データ: `DELETE` / `UPDATE` を 1 文も書いていない（監査は検出のみ）
- `web/`: 差分は `constants/api-error.ts`（+15 -0）と `saveError.ts`（コメント 6 行）のみ
- E2E spec: `web/e2e/aa-interference-probe-{a,b}.spec.ts` / `support/interference-probe.ts` は 1 文字も編集していない

---

## §6 CHANGE 起票のたたき台（設計担当向けチェックリスト）

**★`CHANGE-136` は起票済みであり、製造は番号を採番していない。** 以下は**反映時の確認項目**である。

| # | 反映先 | 内容 | 状態 |
|---|---|---|---|
| 1 | **`REQ-001` `NFR203`** | 「検査してから書く形は、検査と書き込みを同じ書き込みトランザクションの内側に置き、そのトランザクションを直列化することで守る」を足す。**★楽観排他は撤回しない**（UPDATE を守る手として不変） | `CHANGE-136` §2.1 の射程内 |
| 2 | **`DES-002` §6.4** | §1-2 の as-built（`BEGIN IMMEDIATE` / DSN `_txlock` / 読み取り専用の除外） | `CHANGE-136` §2.2 の射程内 |
| 3 | **`DES-002` §4.2** | §1-3 のエラー契約（**503 `database_busy`**。実 DTO と全行を本レポートに逐語で載せた） | `CHANGE-136` §2.4 の射程内 |
| 4 | **`DES-006` §2.3** | 「判定は登録と同じ書き込みトランザクションの内側で `*sql.Tx` を使って行う。**適用面は 4 経路**」 | **★§2-1 の裁定が要る**（`CHANGE-136` §2.3 は 3 経路と書いている） |
| 5 | **`SUPP-001` §7.1.1** | §4-9（「UPDATE」を「非 tx の書き込み」へ広げ、「読みは競合しない」を明記） | **★新規。`D-564` により CHANGE を要する** |

**★マイグレーションは新規作成していない**（消費 0 本）。**⇒ 連番の払い出しは発生していない。** 次は `000080` のままである。

**★製造が消費した CHANGE 番号は 0 件である。** `change-number-registry.md` §1 への登録は発生しない。

---

## §7 教訓（`retrospective-log` 行き）

> **★親チャット（設計卓）は本節を読まなくてよい。** 宛先は `retrospective-log` へのバッチ反映であり、実施者は設計担当である。

1. **★★「適用面」を設計書が列挙している場合、その列挙自体を実査の対象にすること。** 本サブは `CHANGE-136` §2.3 の「3 経路」を所与として扱い、**4 経路目を落とした。** 設計卓は実装ソースを読めないため（指示書 §1.1.4 が自ら書いている）、**列挙は「予見できた範囲」であって全数ではない。** **⇒ 一般化＝「N 個ある」と書かれていたら、その N を数え直す実査項目を立てる。**
2. **★★母数の切り口を誤ると、取りこぼしは母数の外に落ちる。** 本サブは §4.3 の母数を「`BeginTx` する関数」＋「`tx` を受け取る関数」で取った。**この切り口では `BeginTx` の“前”で走る判定は視野に入らない**——4 経路目はまさにそこに居た。**⇒ 「境界の内側」を数えるときは「境界の外側で、境界に依存して動くもの」も同時に数えること。**
3. **★★母数を書くときは、除外したものと除外理由を書くこと。** 「39（`BeginTx` 24 ＋ 非テスト関数 15 本）」はレビューが再現できなかった。**リポジトリ層 66 本を除いた理由（tx を受け取るだけで境界を決めない）を書かなかったためである。** **⇒ 母数は「数」ではなく「数え方」を書く。コマンドを併記すれば自動的にそうなる。**
4. **★★「今日は必須でない」防御は、外れても誰も気づかない。** `*sql.Tx` の束ねは `BEGIN IMMEDIATE` の直列化により今日は結果を変えない。**⇒ 破壊確認 3 が空振りした。** 配線テストを足して観測可能にしたが、**一般形＝「将来の防御として置くものには、外れたことを検出する仕掛けまでが一組である」。**
5. **★テストの緑が意味を持つかを、テストを書いた直後に問うこと。** 本サブは 3 件の空振り緑をレビューで指摘された（成立しえない assertion ／ goroutine のエラー黙殺 ／ 発火しない対照）。**いずれも「書いた時点では正しく見えた」ものである。** **⇒ `M-78` / playbook §4.32 の「その壊し方で観測が動くか」は、破壊確認だけでなく通常のテストにも掛けること。**
6. **★コードと文書の数え直しは同じ手番で行うこと。** §4.3 の母数を 6 → 9 本へ数え直したとき、**docs 側のコミットだけで済ませ、コード内コメント（`val_c02_race_test.go`）を 5 本のまま残した。** **⇒ 数を書いた場所を `grep` で全数拾ってから直す**（教訓 `E-118` と同型）。
7. **★確率的な再現手順を「決定論的」と呼ばないこと。** `M24-09c` §4-1 の手順は「10 回中 1 回」であり、指示書 §5.1 と `CHANGE-136` はそれを「決定論的な再現手順」と呼んでいた。**決定論的だったのは probe spec の「並列なら必ず赤」の側であって、`VAL-C02` の競合の出方ではない。** **⇒ 用語が一段ずれたまま次工程へ渡ると、再現できないことの原因究明に時間が溶ける。**
8. **★環境が変われば再現率は変わる。** 一次源は「10 回中 1 回」だったが、本環境では **7/10** で再現した。**⇒ 「出なくなった」を「直った」と読まないという指示書 §9.3 の警告は、逆方向（「出やすくなった」＝環境差）にも効く。** 背中合わせ比較を同一セッション・同一環境で採ることが要る。

---

*以上、M24-11 設計伝達レポート。*

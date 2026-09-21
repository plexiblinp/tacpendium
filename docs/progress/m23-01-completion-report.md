# M23-01 完了報告: ゴミ箱の実態を仕様へ揃える（`PUT` が積む旧行を既定で隠す ＋ 残日数表示の撤回）

| 項目 | 内容 |
|------|------|
| 作業ID | M23-01 |
| 対象指示書 | `docs/instructions/M23-01-trash-as-built-and-superseded-rows.md` **v1.0.0** |
| チェックリスト | `docs/instructions/reviews/M23-01-review-checklist.md` v1.0.0 |
| CHANGE | `CHANGE-121`（2026-08-20 起票済み＝**D-479**。スキーマ変更は**開発者承認済み**） |
| ブランチ | `claude/m23-01-implementation-plan-6yasg6` |
| 基点コミット | `3aaf3e5` |
| 実施日 | 2026-08-20 |
| 消費マイグレーション | **1 本＝`000078`**（`migrations/000078_add_combos_superseded_by.{up,down}.sql`） |
| 消費 CHANGE 番号 | **なし**（既存 `CHANGE-121` に紐づく。起票時に registry へ登録済み） |
| 並列相手 | **`M24-09` のみ**（**D-477**）。**★`M24-09` は 2026-08-20 に `09a` / `09b` へ分割され、`09b` は本サブの後へ回された**（**D-481**。理由＝本サブがテスト資産へ同時に足すため）。**⇒ 実質的に本サブと同時に走った相手は無い。** |

---

## 1. §3.3 着手前の実査（8 件）の結果

### 1-1. マイグレーションの disk 末尾が `000077` であること

**実査値: `000077_m20_seed_aliases_p34_srk`**（`migrations/` は 154 ファイル ＝ 77 組）。
**⇒ `000078` は空いており、再請求は発生していない**（**D-293** の条件に当たらなかった）。自採番も番号飛ばしもしていない。

### 1-2. `DES-002` §4.2 に載っていないゴミ箱系 4 経路の as-built

**★§10 に独立節として置いた**（設計卓が `CHANGE-121` §2 へ写す材料）。**実装は 1 行も変えていない。**

### 1-3. ゴミ箱の絞り込み箇所と、変更前の述語の逐語

**実パス: `internal/repository/combo/repository.go`（変更前 `:685-689`）。**

```go
if filter.OnlyDeleted {
    whereParts = append(whereParts, "deleted_at IS NOT NULL")
} else if !filter.IncludeDeleted {
    whereParts = append(whereParts, "deleted_at IS NULL")
}
```

**★一覧用のクエリはこの 1 か所だけである。件数専用のクエリは存在しない**——`GET /api/combos` の `count` は `internal/api/combo/handler.go` が `len(items)` として返す。**⇒ 述語を 1 か所足せば、一覧・件数の両方が同時に揃う**（§4.3-4 の要求は自動的に満たされる）。

**一括操作も別クエリを通っていない。** `TrashBulkActions.tsx` は画面に出ている行から選ばれた id に対して `POST /api/combos/:id/restore` ／ `DELETE /api/combos/:id/permanent` を `Promise.allSettled` で並べるだけであり、対象集合は一覧の結果と同一である（§4.3-3 の「両方に足す」は該当なし）。

### 1-4. 旧行の論理削除と新行 id 確定の順序

`internal/service/combo/service.go` の `UpdateWithKeyChange`:

| 位置（変更前） | 内容 |
|---|---|
| `:586` | `BeginTx` |
| `:597-599` | 旧行を `UPDATE combos SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND version = ? AND deleted_at IS NULL`（**楽観排他と論理削除を 1 文で行っている**） |
| `:628` | `InsertCombo`（新行） |
| `:633` | `combo.ID = newID` |
| `:728` | `Commit` |

**⇒ 論理削除の時点では新行 id がまだ確定していない。** したがって §4.2-2 が許した「1 文にまとめる」形は取れず、**id 確定後の 2 文目**として書いた。**両方とも同一トランザクションの中にある**（§4.2-1・§4.2-5 を満たす）。

### 1-5. `TRASH_RETENTION_DAYS` の参照箇所の全数（1 か所ずつ）

| # | 場所（変更前） | 内容 | 対応 |
|---|---|---|---|
| 1 | `web/src/features/combo/components/TrashListRow.tsx:12` | `const TRASH_RETENTION_DAYS = 90;` | 撤去 |
| 2 | 同 `:14-22` | `calculateRemainingDays()` | 撤去 |
| 3 | 同 `:45` | `const remainingDays = deletedAt ? calculateRemainingDays(deletedAt) : null;` | 撤去 |
| 4 | 同 `:97-107` | 列 7 のセル（「あと N 日」／「期限切れ」／`-`） | 撤去 |
| 5 | 同 `:129` | `colSpan={8}`（行内エラー表示） | **`{7}` へ追随**（列削減の巻き添え。★見落としやすい） |
| 6 | `web/src/features/combo/components/TrashList.tsx:58` | ヘッダ `<TableHead>残日数</TableHead>` | 撤去（8 列 → 7 列） |
| 7 | `web/src/pages/TrashPage.tsx:31` | 本文告知「削除したコンボは 90 日後に自動的に完全削除されます。」 | 撤去。**代わりの告知は足していない**（§4.4-5） |
| 8 | `web/src/features/combo/components/TrashList.test.tsx:71-81` | テスト 2 本（`あと 60 日` ／ `期限切れ`） | **否定形テスト 4 本へ差し替え**（§12） |
| 9 | **i18n キー** | **該当なし。** `web/src/lib/i18n.ts` は 18 行の init のみで、`web/src/locales/{ja,en}.json` に `trash` / `残日数` / `90` は **0 件**。ゴミ箱画面は生の日本語文字列で書かれている | **対象なし**（§4.4-4 は「ja / en の両方から消す」を求めるが、**両方とも最初から持っていない**。★片側だけ消えている状態は発生しえない） |
| 10 | **E2E** | **該当なし。** `web/e2e/` にゴミ箱の spec は **0 件**だった | 新規追加（§12） |
| 11 | **Go 側** | **0 件**（`retention` / 自動完全削除の実行経路は存在しない） | 対象なし |

### 1-6. `setups` に「キー項目を変える編集で採番し直す」経路が無いこと

**無い。** `internal/service/setup/service.go:357 UpdateSetup` は `FindByID` → 同一行を `UPDATE` するのみで、**新規 INSERT ＋ 旧行の論理削除という組み合わせは存在しない**（`InsertSetup` 相当の呼び出しが同関数内に無い）。API 側も `PATCH /api/setups/:id` の 1 本だけである。
**⇒ 積まれる旧行がそもそも生じないため、`setups` には列を足していない**（§4.1-4）。**★「無い」と断ぜず 1 回だけ確認した**という指示書の指定どおり、実物に当てて確認した結果である。

### 1-7. ★後継のコンボを完全削除したとき、旧行の `superseded_by_combo_id` がどうなるか（**実測**）

**列が存在しない状態では測れないため、マイグレ適用後に専用テストで測った**（`internal/infra/migration/migrate_m2301_test.go`）。**2 つの系で測った結果は割れる。**

| 系 | 接続の作り方 | 実測結果 | ゴミ箱での見え方 |
|---|---|---|---|
| **FK=ON** | `db.Open`（`PRAGMA foreign_keys = ON`）＋ `SetMaxOpenConns(1)` | **`ON DELETE SET NULL` が発火し、旧行の印は `NULL` になる** | **旧行がゴミ箱へ再び現れる** |
| **FK=OFF** | `sql.Open` の素の接続（PRAGMA を当てない） | **連鎖しない。存在しない id を指したまま印が残る** | **旧行は隠れたまま** |

- **★設計卓の暫定（§4.1-3「現れてよい」）は FK=ON の系と一致した。** **⇒ 実装は変えていない**（指示書 §11 の指定どおり、食い違いがあっても実装は変えず報告する方針だったが、そもそも食い違わなかった）。
- **★FK=OFF の系でもデータは壊れない。** 旧行は物理削除されず（`FR601` の対象として残る）、指す先を失った id を持ったまま「隠れたまま」になるだけである。テストでこの実測値も固定した（`TestRun_M2301_SuccessorHardDelete_FKOff`）。
- **⇒ 結論: どちらの系でも「壊れない」。ただし見え方が接続依存で割れる**という事実は `P-04` の症例として残る。恒久の解決は `P-04` の根治側（本サブのスコープ外＝§1.3-6）。

### 1-8. ゴミ箱の行クリックが 404 になる件（`trash-row-click-404`）との交差

**交差する。ただし直していない**（§1.3-7 の指定どおり、交差の有無だけを報告する）。

- 経路: `TrashListRow.tsx` の行クリック（`onClick={() => navigate('/combos/' + combo.id)}`）と、始動状況セルの `<Link to={'/combos/' + combo.id}>` の 2 つ。
- 404 の原因: `GET /api/combos/:id` が `FindByID`（`internal/repository/combo/repository.go` の `selectComboByIDSQL` ＝ `WHERE id = ? AND deleted_at IS NULL`）を通るため、**論理削除済みの行は詳細取得できない**。
- **本サブの影響**: 旧行が既定で隠れる分だけ **404 の発生源は減る**が、**手動削除の行の 404 は残る**。したがって followup `trash-row-click-404` は**閉じない**。

---

## 2. 変更の全体（as-built）

### 2-1. マイグレーション `000078`

```sql
ALTER TABLE combos ADD COLUMN superseded_by_combo_id INTEGER REFERENCES combos(id) ON DELETE SET NULL;
```

- **`ADD COLUMN` のみ。テーブル再構築をしていない**（§4.1-2）。既定値なし（NULL）。
- **down は `DROP COLUMN`**（`000038` と同じ流儀。SQLite 3.35+ の実績あり）。
- **既存行は埋めていない**（§4.1-5）。**★これは仕様である**——旧行と新行の対応は `PUT` を処理している瞬間にしか分からないため遡れない。利用者に見える形は **「M23-01 以降に積まれた分から隠れる」** であり、この非対称を `DES-005` §5.15 へ書く必要がある（設計卓が `CHANGE-121` で反映）。

### 2-2. 書き込み（`PUT /api/combos/:id`）

`internal/service/combo/service.go`・`combo.ID = newID` の直後、`InsertSteps` の前。

```go
if _, supErr := tx.ExecContext(ctx,
    `UPDATE combos SET superseded_by_combo_id = ? WHERE id = ?`, newID, oldID); supErr != nil {
```

- **同一トランザクション内**（`BeginTx` と `Commit` の間）。新行の作成が失敗すれば本書き込みも巻き戻る（テストで固定＝§12 の `TestSuperseded_NotWrittenOnRollback`）。
- **`version` を動かしていない**（§4.2-3）。**`updated_at` にも触っていない**——直前の論理削除が同時に更新済みであり、本サブで新しい規則を作らない（§4.2-4）。
- **`PATCH /api/combos/:id` では書いていない**（§4.2-6。同経路は行を積まない）。
- **`materialized_from_combo_id` には触れていない**（§2.2-1）。`materialize` の生成元バッジは無傷（`internal/service/combo/materialize_test.go` を含む既存テストが全数 green）。

### 2-3. 読み取り（ゴミ箱の絞り込み）

```go
whereParts = append(whereParts, "deleted_at IS NOT NULL", "superseded_by_combo_id IS NULL")
```

- **`else if !filter.IncludeDeleted` 側（通常一覧）には足していない。** 通常一覧は `deleted_at IS NULL` で既に旧行を除外しており、足すと同じ事実を 2 か所で判定することになる。
- **切り替えの導線は作っていない**（§4.3-2）。**⇒ 本サブの完了時点で、`PUT` が積んだ旧行はどの画面からも到達できない。これは意図である**（§1.3-1・`D-460`）。

### 2-4. 撤去（残日数）

`TrashListRow.tsx` / `TrashList.tsx` / `TrashPage.tsx` の 3 ファイル。**8 列 → 7 列。**
**★列を残して文言だけ変える形は取っていない**（§4.4-2）。**★代わりの告知も足していない**（§4.4-5）。
跡地のレイアウト: 明示的な幅指定はチェックボックス列の `w-10` だけで、他は自動幅。**列の削除だけで崩れない**（E2E で 7 列を実測）。

---

## 3. ★`superseded_by_combo_id` を DTO へ出すか（§9.2-2・製造判断）

**出す側を採った。** `ComboResponse` へ `SupersededByComboID *int64 \`json:"supersededByComboId,omitempty"\`` を足し、`toComboResponse` でマップした。フロント側は `ComboSummary`（`ComboDetail` は継承）と `Combo` の **2 interface** へ `supersededByComboId?: number | null` を足した。

**理由**: 指示書 §2.1 が**フロント型 3 分岐への追加を成果物に挙げている**。バックエンドが返さない値をフロント型が持つと、**型が実態と食い違う**——それは本サブが畳もうとしている食い違いと同じ型の負債になる。

**★出したうえで、読む画面は作っていない**（§1.3-1）。**本番コードで本列を読むのは、ゴミ箱の絞り込みの述語 1 か所だけである**（チェックリスト §0.3 N-3 が「重大でないもの」として明示している状態にあたる）。`omitempty` のため、印を持たない行では JSON キー自体が出ない（既存クライアントへの影響なし）。

**★コード内にも `// 推測: 〜と仮定した` の形で理由を残した**（`internal/api/combo/dto.go`。`CLAUDE.md` §9-3）。

---

## 4. 推測で進めた箇所（全 3 件）

| # | 事項 | 採った形 | 明示場所 |
|---|---|---|---|
| 1 | DTO へ出すか否か | **出す**（§3 に理由） | `internal/api/combo/dto.go` のコメント |
| 2 | マイグレファイル名 | `000078_add_combos_superseded_by`（`000038_add_combos_materialized_from` に倣う） | 本報告（**§9.2-1 が「細部は既存の流儀に合わせる」を許している**） |
| 3 | 撤去した列の跡地のレイアウト | 幅の再指定をせず、自動幅に任せた | 本報告（同上・§9.2-3） |

**★§9.1 の「推測で進めてはいけない 4 件」には 1 つも触れていない**——マイグレ連番は実査で `000078` を確認（再請求不要）／`setups` へ列を足していない／`DES-002` §4.2 の表に合わせて実装を変えていない／スコープ外 8 件へ踏み込んでいない。

---

## 5. 自己テスト結果（§7.2。★コマンド自身の出力を転記＝**E-125**）

### 5-1. `go test ./...`

```
53 packages ok / FAIL 0 件
```

**★終了コードだけを根拠にしていない**——`ok` 行を数えて 53、`FAIL` および `---` で始まる失敗行の数を数えて 0 であることを確認した。主なパッケージの実測時間は `internal/service/combo 83.837s` / `internal/repository/combo 42.973s` / `internal/infra/migration 53.638s`。

**本サブで追加した 14 本の内訳（`-v` 出力）:**

```
--- PASS: TestSuperseded_PutWritesSuccessorID (0.60s)
--- PASS: TestSuperseded_NotWrittenOnRollback (0.66s)
--- PASS: TestSuperseded_ManualDelete_StaysVisible (0.66s)
--- PASS: TestSuperseded_TrashHidesOldRowButKeepsManualDelete (0.59s)
--- PASS: TestSuperseded_BulkRestoreMatchesVisibleSet (0.61s)
--- PASS: TestSuperseded_BulkPermanentDeleteMatchesVisibleSet (0.58s)
ok  	github.com/plexiblinp/combomgr/internal/service/combo	3.698s

--- PASS: TestRepository_ListOnlyDeleted_ExcludesSupersededRows (0.59s)
--- PASS: TestRepository_ListOnlyDeleted_CountFollowsFilter (0.60s)
--- PASS: TestRepository_ListOnlyDeleted_KeepsCharacterFilter (0.57s)
--- PASS: TestRepository_Restore_LeavesSupersededMarkUntouched (0.58s)
--- PASS: TestRepository_SupersededByComboID_RoundTrip (0.61s)
ok  	github.com/plexiblinp/combomgr/internal/repository/combo	2.955s

--- PASS: TestRun_M2301_SchemaUpDown (0.54s)
--- PASS: TestRun_M2301_SuccessorHardDelete_FKOn (0.52s)
--- PASS: TestRun_M2301_SuccessorHardDelete_FKOff (0.58s)
ok  	github.com/plexiblinp/combomgr/internal/infra/migration	1.650s
```

### 5-2. `cd web && pnpm test`

```
 Test Files  170 passed (170)
      Tests  1676 passed (1676)
   Duration  75.21s
```

**★件数を転記した**（`vitest: not found` が exit 0 で通る経路があるため＝M20-06 の先例）。ゴミ箱まわりの内訳:

```
 ✓ src/features/combo/components/TrashList.test.tsx (10 tests) 370ms
 ✓ src/features/combo/components/TrashListRow.test.tsx (5 tests) 397ms
```

### 5-3. `make e2e`

**全走を 3 回行った。最終走は完全 green である。**

| 走行 | 実施時点 | 結果 |
|---|---|---|
| 1 回目 | Phase A 完了時 | `1 flaky` ／ `154 passed (3.1m)` |
| 2 回目 | Phase C 取り込み後 | `2 flaky` ／ `153 passed (3.0m)` |
| **3 回目（最終）** | 同上・再走 | **`155 passed (3.0m)` ／ flaky 0** |

**★spec 総数は 155 で 3 回とも同じ**（flaky は「リトライで通った」の意であり、passed の計上から外れる）。

本サブの新規 spec は毎回 green:

```
  ✓  151 [chromium] › e2e/m23-01-trash-superseded.spec.ts:65:3 › キー変更編集の旧行は出ない / 手動削除の行は出る(対で確認) (1.5s)
  ✓  153 [chromium] › e2e/m23-01-trash-superseded.spec.ts:119:3 › 残日数の列・90 日の告知が画面から消えている(§4.4 の否定形) (1.6s)
```

**★flaky について（隠さず書く）。** 1 回目は `m19-03-setup-results.spec.ts` の F、2 回目は `m18-03a-punish-mylist.spec.ts` の C と `m18-03b-materialize.spec.ts` の C。**3 件とも失敗箇所は同じで、fixture 作成の `POST /api/combos` が 500 を返している**（`m18-03b` は `:226` の `expect(createRes.ok(), ...)`。**キー変更編集そのもの＝`PUT` のアサーションには到達していない**）。

**本サブ起因ではないと判断した根拠 4 点**:

1. **3 件とも単独走では green**——`m19-03` は `8 passed (16.4s)`、`m18-03a` + `m18-03b` は `7 passed (12.6s)`（**`PUT` を使う `m18-03b` の C を含む**）。
2. **失敗しているのは `POST /api/combos`** ＝ コンボ作成であり、本サブが触った経路（`PUT` の後段・ゴミ箱の絞り込み・ゴミ箱画面）を 1 つも通らない。
3. **本サブが `POST` 経路へ足したのは INSERT の列 1 つだけ**で、新しい文・新しいロック・新しいトランザクションを 1 つも足していない。
4. **落ちる spec が毎回違い、3 回目は 0 件だった**——特定のロジックではなく、並列ワーカ下の競合の性質を示す。

**★「flake」と断定はしない**（`E-84` の型を避ける）。**★本サブが E2E の書き込み量を増やしたこと自体は事実である**——新規 spec 2 本と、その後片付け（`afterEach` の論理削除＋完全削除）が加わっている。**⇒ 競合を悪化させた可能性を否定はできない。事象として記録に残し、followup 候補へ回す**（設計伝達レポート §4-5）。

### 5-4. マイグレの up / down 往復

`TestRun_M2301_SchemaUpDown` が **up(→v78) → down(-1) → 再 up(→v78)** を実際に流し、各段で `pragma_table_info('combos')` を検算した。

| 段 | `superseded_by_combo_id` | `materialized_from_combo_id` |
|---|---|---|
| up | **存在する**（既定値 NULL・self-FK `ON DELETE SET NULL` を `pragma_foreign_key_list` で確認） | 存在する（巻き添えなし） |
| down | **消える** | **存在する**（一緒に落ちていない） |
| 再 up | **復元される** | 存在する |

**あわせて `setups` に本列が無いことも同テストで検算した**（§4.1-4 の否定形）。

---

## 6. 品質チェック（§7.3）

| 検査 | 結果 |
|---|---|
| `bash scripts/check-artifact-integrity.sh` | **違反なし**（検査 11 件の自己検査 OK ／ 派生資料 4 件 OK）。★1 本目に回した |
| `bash scripts/check-enum-sync.sh` | **ベースラインどおり（増加なし）**。本サブは列挙的文字列定数を 1 つも足していない |
| `bash scripts/check-browser-storage-keys.sh` | **違反なし**（台帳 9 件 / 本番コード 8 件で一致）。**★本サブはブラウザストレージへ何も足していない。「足していないこと」の確認である** |
| `CLAUDE.md` §4 JSON タグ camelCase | **`supersededByComboId`**。DB 列は `superseded_by_combo_id`（`db` タグで分離） |
| `console.log` / `fmt.Println` | **0 件**（本サブの diff 対象ファイル全数） |
| `gofmt -l internal/` | **0 件** |
| `pnpm exec tsc --noEmit -p e2e/tsconfig.json` | エラーなし |

---

## 7. §4.9 否定形確認——撤回した仕様の残骸の全文走査（**3 系統**）

**★本番コードだけを見て「直っている」と報告していない。** 3 系統すべてを走査した。

### 7-1. 系統①: 本番コード（`web/src` ／ `internal` ／ `cmd` ／ `migrations`）

走査キーワード: `TRASH_RETENTION_DAYS` ／ `残日数` ／ `期限切れ` ／ `retention` ／ `expire` ／ 「あと N 日」

**残骸 0 件。** ヒットしたのは以下の**無関係な既存実装のみ**であり、90 日の保持期限とは別概念である。

| ヒット | 実体 |
|---|---|
| `web/src/locales/{ja,en}.json:32-33` の `expiredTitle` / `expiredDescription` | **M22 のログインセッション切れの文言**（パスワードの再入力）。ゴミ箱の保持期限とは無関係 |
| `web/src/features/auth/{LoginScreen,AuthGate}.tsx` の `expired` | 同上（同じセッション切れの props） |
| `internal/api/auth/handler_test.go:204` の `expire the cookie` | ログアウト時の Cookie 失効。無関係 |

### 7-2. 系統②: テスト資産（`web/e2e` ／ `*_test.go` ／ `*.test.ts` / `*.test.tsx`）

**旧仕様に依存した記述 0 件。** ヒットするのは**本サブが新設した否定形テストのコメント・テスト名だけ**である（`TrashList.test.tsx` の 4 本 ／ `m23-01-trash-superseded.spec.ts` の 1 本）。**★これらは「残日数が出ないこと」を確認する側であり、残骸ではない。**

**★`PUT` の後にゴミ箱の件数を数えているテスト**（§4.9-3）の実査:

| ファイル | 内容 | 期待値の変化 |
|---|---|---|
| `internal/api/combo/handler_test.go` | `TestHandler_List_OnlyDeleted` ほか。**モックに渡る `filter.OnlyDeleted` が true か**だけを見ており、件数を数えていない | **なし** |
| `internal/service/combo/service_test.go` | `TestService_List_OnlyDeleted`。**手動削除した 1 件が含まれるか**を id で見ており、絶対件数を数えていない。**手動削除は隠れないため素通り** | **なし** |
| `web/src/features/combo/hooks/useTrashCombos.test.ts` | fetch をモックした URL 組み立ての確認 | **なし** |
| `web/e2e/*.spec.ts` | **ゴミ箱の件数を絶対値で数える spec は 0 件**（そもそも trash の spec が無かった） | **なし** |

**⇒ 期待値を書き換えたテストは 1 本も無い。** 差し替えたのは `TrashList.test.tsx` の残日数 2 本のみで、これは §4.4 の撤去に伴うものである。

### 7-3. 系統③: 設計文書・指示書・overview（**★製造は編集しない。報告のみ**）

**残骸 2 件。いずれも設計卓の手番である**（`CLAUDE.md` §8 ／ 指示書 §4.5・§7.4）。

| # | 場所 | 逐語 | 扱い |
|---|---|---|---|
| 1 | **`docs/design/05-screen-design.md:738`**（§5.15） | 「論理削除されたコンボ・セットプレイ一覧（削除日時、**自動完全削除までの残日数**）」 | **`CHANGE-121` §2 の想定どおり。** 設計卓が撤回する |
| 2 | **★`docs/design/03-data-model.md:946`（§5 論理削除と復元）** | 「物理削除は以下のタイミングで実施する。… **ゴミ箱に90日以上保持されたレコード（設定で変更可能）**」 | **★`CHANGE-121` の起票時に挙がっていない 2 件目の残骸である**（起票文が挙げているのは `DES-003` **§3.4**＝列追加のみ）。**同じ「90 日で自動完全削除」の仕様であり、機構は存在しない。** **⇒ `DES-005` §5.15 だけを直すと、こちらが生き残って次の担当の前提になる** |

> **★#2 は指示書の走査指定（§4.9-1「`90` と保持・期限が同居する行」）が拾わせた発見である。** 本番コードだけを見ていれば見つからなかった。**設計卓は `CHANGE-121` の反映範囲へ `DES-003` §5 を足す必要がある**（詳細は §13 と設計伝達レポート §4）。

**指示書・overview（`M23-overview.md` ／ `M23-01-*.md`）のヒットは、撤回を指示している当の文書であり残骸ではない。**

---

## 8. 変更ファイル一覧

| 種別 | ファイル | 内容 |
|---|---|---|
| 新規 | `migrations/000078_add_combos_superseded_by.up.sql` / `.down.sql` | 列追加 / DROP |
| 変更 | `internal/model/combo.go` | `SupersededByComboID *int64` |
| 変更 | `internal/repository/combo/repository.go` | INSERT 1 ＋ SELECT 5 ＋ `scanCombo` ＋ `OnlyDeleted` の述語 |
| 変更 | `internal/service/combo/service.go` | `UpdateWithKeyChange` に旧行への書き込み 1 文 |
| 変更 | `internal/api/combo/dto.go` | `ComboResponse` ＋ `toComboResponse` |
| 変更 | `web/src/features/combo/types.ts` | `ComboSummary` / `Combo` の 2 interface |
| 変更 | `web/src/features/combo/components/TrashListRow.tsx` | 残日数の撤去 ＋ `colSpan` 追随 |
| 変更 | `web/src/features/combo/components/TrashList.tsx` | ヘッダ「残日数」の撤去 |
| 変更 | `web/src/pages/TrashPage.tsx` | 本文告知の撤去 |
| 新規 | `internal/service/combo/superseded_test.go` | 6 本 |
| 新規 | `internal/repository/combo/superseded_test.go` | 5 本 |
| 新規 | `internal/infra/migration/migrate_m2301_test.go` | 3 本 |
| 変更 | `web/src/features/combo/components/TrashList.test.tsx` | 残日数 2 本 → 否定形 4 本 |
| 新規 | `web/e2e/m23-01-trash-superseded.spec.ts` | 2 本 |

**★`SELECT` は 5 か所すべてに足した**（`FindByID` / `FindByIDAllowDeleted` / `List` / `FindActiveByDuplicateKey` / `ListAllActiveCombosTx`）。**`scanCombo` が共通のため、1 か所でも漏らすと全経路の scan がずれる**——`TestRepository_SupersededByComboID_RoundTrip` で既存列（`hit_type`）の健全性も併せて見ている。

**★§2.1 に無いファイルへ手を入れた件（§2.3 例外条項）**: **`internal/api/combo/dto.go`**。§2.1 は「`web/src/types/`（コンボ型 3 分岐）」を挙げているが、**フロント型へ足すなら DTO にも足さないと値が届かない**（§3 の判断の帰結）。ほかに §2.1 の外へ出たファイルは無い。

---

## 9. `M23-03` / `M23-06` の担当範囲へ踏み込みたくなった箇所（§2.3）

| # | 箇所 | 踏み込まなかった理由 |
|---|---|---|
| 1 | **`GET /api/combos/:id` が削除済み行を返さないため、ゴミ箱の行クリックが 404 になる** | followup `trash-row-click-404`（§1.3-7）。**交差の報告のみ**が本サブの要求である |
| 2 | **`POST /api/combos/:id/restore` は印を持った旧行でも復元できる**（id を直接叩けば通る） | **§2.2-3 が「復元の契約を変えない」を固定**。画面から到達できない以上、利用者操作では起こらない。判断は `M23-04`（復元時のバリデーション） |
| 3 | **`DELETE /api/combos/:id` が楽観排他を持たない** | §2.2-4。判断は `M23-03` |
| 4 | **完全削除の CASCADE 依存** | §1.3-5。`M23-06` |

---

## 10. ★ゴミ箱まわり API 契約の as-built（§3.3-2・§4.5。**設計卓が `CHANGE-121` §2 へ写す**）

**`DES-002` §4.2 の経路表にこの 4 経路は 1 本も載っていない**（2026-08-20 に設計卓が実査）。**以下は実装の実態であり、実装側は 1 行も変えていない。**

登録は `internal/api/combo/routes.go` の `RegisterRoutes`（`echo.Group("/api")` 配下）。

### 10-1. `PUT /api/combos/{id}` — キー変更編集

| 項目 | 実態 |
|---|---|
| ハンドラ | `Handler.UpdateWithKeyChange` |
| クエリ引数 | **なし** |
| 入力 | `PutRequest` ＝ `{ version: int }` ＋ `CreateRequest` の全項目（body に `version` 必須） |
| 成功応答 | **`201 Created`** ＋ `ComboResponse`。**★返る `id` は新しく採番された id である**（旧 id ではない） |
| 異常応答 | `400 invalid_id` ／ `400 invalid_request` ／ **`400 validation_failed`**（`details.validations` に VAL 結果）／ `404 not_found` ／ **`409 version_conflict`** ／ `400 invalid_tag_id` ／ `400 invalid_setup_carry_mode` ／ `400 missing_setup_carry_options` ／ `500 internal_error` |
| 副作用（as-built） | 旧行を論理削除 ／ 新 id で行を作り直す ／ `combo_setups` を `setupCarryOptions` に従って付け替え ／ `combo_setup_results` を追従 ／ `combo_punishes`・`combo_punish_curations` を付け替え ／ 旧行の `recipe_cache` を削除し新行のを再計算 ／ **★本サブで追加: 旧行へ `superseded_by_combo_id = 新 id` を書く** |

### 10-2. `POST /api/combos/{id}/restore` — ゴミ箱から復元

| 項目 | 実態 |
|---|---|
| ハンドラ | `Handler.Restore` |
| クエリ引数・入力 | **なし**（body 不要。**★楽観排他を持たない**） |
| 成功応答 | **`200 OK`** ＋ `ComboResponse`（復元後に `Get` で再取得した内容） |
| 異常応答 | `400 invalid_id` ／ `404 not_found`（**削除済みでない行に対しても `ErrNotFound`**——リポジトリの `UPDATE ... WHERE id = ? AND deleted_at IS NOT NULL` が 0 行になるため）／ `500 internal_error` |
| 副作用 | `deleted_at = NULL` ／ `updated_at` 更新 ／ `recipe_cache` の再計算。**★子（`combo_setups` 等）には何もしない**（`M23-RESEARCH-01` の実測どおり）。**★`superseded_by_combo_id` にも触れない**（本サブで変えていない＝§12 の `TestRepository_Restore_LeavesSupersededMarkUntouched` が現状を固定） |

### 10-3. `DELETE /api/combos/{id}/permanent` — 完全削除

| 項目 | 実態 |
|---|---|
| ハンドラ | `Handler.PermanentDelete`（`internal/api/combo/permanent_delete_handler.go`） |
| クエリ引数・入力 | **なし**（**★楽観排他を持たない**） |
| 成功応答 | **`204 No Content`** |
| 異常応答 | `400 invalid_id` ／ `404 not_found` ／ **`409`（`ErrComboNotInTrash` ＝ ゴミ箱に無い行への完全削除）** ／ `500 internal_error` |
| 副作用 | `combo_setup_results` → `combo_setups` を**明示削除**したうえで `combos` の行を物理削除（FK=OFF の接続でも CASCADE に頼らない形。M19-03 の措置） |

### 10-4. ゴミ箱一覧 ＝ `GET /api/combos?only_deleted=true`

| 項目 | 実態 |
|---|---|
| ハンドラ | `Handler.List`（**専用の経路は存在しない。一覧 API のクエリ引数で切り替える**） |
| クエリ引数 | `only_deleted=true`（**★`include_deleted` より優先される**——`only_deleted` が true のときは `include_deleted` を読まない）／ `character_id` ／ `is_draft` ／ `tag_ids` ／ `position` ／ `hit_type` ／ `opponent_stance` ／ `setup_result` ／ `setup_tech_type` ／ `setup_in_corner` ／ `sort` ／ `order` ／ `limit`（既定 100・上限 1000）／ `offset` |
| 成功応答 | `200 OK` ＋ `{ items: ComboResponse[], count: number }`。**★`count` は総件数ではなく `len(items)`** ＝ ページング後の件数である |
| 実際に画面が使う形 | `GET /api/combos?character_id=1&only_deleted=true`（`useTrashCombos.ts`。**★`character_id` は `TrashPage.tsx` の `DEFAULT_CHARACTER_ID = 1` で固定**） |
| 絞り込み（as-built・本サブ適用後） | `deleted_at IS NOT NULL` **AND `superseded_by_combo_id IS NULL`** ＋ 上記引数 |
| **★`include_deleted=true` を単独で指定した場合** | **`deleted_at` の絞り込み自体が掛からないため、`PUT` が積んだ旧行も返る。** 本サブが述語を足したのは `OnlyDeleted` の分岐だけであり（指示書 §4.3-1 の指定範囲）、`include_deleted` 経路は変えていない。**⇒ `CHANGE-121` §2 へ写す際に落とさないこと** |

---

## 11. 既知の制約（**いずれも意図であり、埋めない**）

| # | 制約 | 根拠 |
|---|---|---|
| 1 | **`PUT` が積んだ旧行は、本サブの完了時点でどの画面からも到達できない** | §1.3-1・**D-460**。変更履歴ビューは作らない。**★欠陥ではない** |
| 2 | **マイグレ適用前に積まれていた旧行は `NULL` のままで、ゴミ箱に出続ける** | §4.1-5。遡って埋められない。**利用者に見える形は「M23-01 以降に積まれた分から隠れる」** |
| 3 | **後継を完全削除したときの旧行の見え方が接続依存で割れる** | §1-7 の実測。`P-04` の症例。**どちらの系でもデータは壊れない** |
| 4 | **ゴミ箱の行クリックは手動削除の行では 404 のまま** | §1-8。followup `trash-row-click-404` |
| 5 | **`superseded_by_combo_id` を読む本番コードは絞り込みの述語 1 か所だけ** | §1.3-1 の帰結。チェックリスト §0.3 N-3 |

---

## 12. テストケース数（§5 の 7 件との対応）

| 指示書 §5 | 実装したテスト | 本数 |
|---|---|---|
| 5-1 リポジトリ層（**実 DB**） | `TestRepository_ListOnlyDeleted_ExcludesSupersededRows`（**手動削除が返ることも対で確認**）／ `_CountFollowsFilter` ／ `_KeepsCharacterFilter` | 3 |
| 5-2 サービス層（後継 id ／ 巻き戻り） | `TestSuperseded_PutWritesSuccessorID`（**version 不変も検算**）／ `TestSuperseded_NotWrittenOnRollback` | 2 |
| 5-3 サービス層（**最重要ゲート**） | `TestSuperseded_ManualDelete_StaysVisible` ／ `TestSuperseded_TrashHidesOldRowButKeepsManualDelete` | 2 |
| 5-4 サービス層（一括操作の集合一致） | `TestSuperseded_BulkRestoreMatchesVisibleSet` ／ `TestSuperseded_BulkPermanentDeleteMatchesVisibleSet` | 2 |
| 5-5 リポジトリ層（復元の現状固定） | `TestRepository_Restore_LeavesSupersededMarkUntouched` | 1 |
| 5-6 フロント（Vitest・**否定形**） | 「行が 7 列である」／「ヘッダに『残日数』が無い」／「30 日前でも『あと N 日』を表示しない」／「91 日前でも『期限切れ』を表示しない」 | 4 |
| 5-7 E2E（**対で確認**） | `キー変更編集の旧行は出ない / 手動削除の行は出る(対で確認)` ／ `残日数の列・90 日の告知が画面から消えている` | 2 |
| （追加） | マイグレ up/down 往復 ／ **§3.3-7 の実測 2 系** ／ round-trip | 4 |
| **合計** | | **20** |

**★E2E は件数を絶対値で数えていない**（作成した id の在・不在だけを見る）。**既存 spec にゴミ箱の件数を絶対値で数えるものは 0 件**であり、衝突しない。

---

## 13. ■ 併せて更新が要るもの

| # | 対象 | 内容 |
|---|---|---|
| 1 | **CHANGE 番号の registry 登録** | **★追加登録は不要。** `CHANGE-121` は **2026-08-20 の起票時に `change-number-registry.md` §1 へ登録済み**（同 §1 の `121` 行 ／ 版履歴 `1.168.0`）。**本サブは新規 CHANGE を採番していない。** |
| 2 | **★「次の番号」の写し先の実査** | **★実在したのは 3 か所であり、4 か所ではない。**「4 か所」は契約ファイルを持つレーンの数字である。**M23 には `docs/process/m23-contract.md` が存在しない**（`docs/process/` にあるのは m18-m19 / m20 / m21 / m22 の 4 本）。**⇒ 写し先＝(a) `change-number-registry.md` §1 ／ (b) ボード §2.1 ／ (c) ボード §2.4。3 か所とも「次に採番する CHANGE ＝ `122`」で一致しており、ズレは無い。** |
| 3 | **★★消費したマイグレ連番——ボード §2.2 がズレている** | **実査値: disk 末尾 ＝ `000078`（本サブが消費）⇒ 次に払い出すのは `000079`。** ところが **`docs/process/parallel-board.md` §2.2「次に払い出す番号」は `000078` のまま**、**「disk 末尾」欄も `000077` のまま**である（いずれも 2026-08-14・M20-06 時点の値）。**★ボード §2.1 の該当行は既に `000079` へ更新されている**（`D-479`）——**同じ数字の写し先が 2 か所あり、片方だけが直っている状態である**（`E-114` の同型）。**⇒ `parallel-board` は共有直列リソースであり製造ブランチでは触れないため、設計卓が §2.2 を `000079` ／ disk 末尾 `000078` へ戻すこと。** |
| 4 | **版を上げた文書の参照元** | **無し。** 製造は設計書・恒久資料を 1 つも編集しておらず、版を上げていない。⇒ 版を写している箇所の追随は不要。 |
| 5 | **★`CHANGE-121` の反映範囲へ `DES-003` §5 を足す** | **§7-3 の #2。** 起票文は `DES-003` **§3.4**（列追加）しか挙げていないが、**`DES-003` §5「論理削除と復元」にも「ゴミ箱に90日以上保持されたレコード（設定で変更可能）」が残っている。** **`DES-005` §5.15 だけを撤回すると、こちらが生き残って次の担当の前提になる**（**D-458** は保持を無期限で確定させている）。**★製造は設計書本体を編集していない。** |
| 6 | **`DES-005` §5.15 へ書く非対称** | **§4.1-5 の「マイグレ適用前に積まれた旧行は隠れない」**。設計卓が `CHANGE-121` で反映する（指示書が明示的に求めている）。 |
| 7 | **`DES-002` §4.2 の経路表** | **§10 の 4 経路の as-built**。設計卓が `CHANGE-121` §2 へ写す。 |
| 8 | **`docs/handover/followup-backlog.md`** | **★製造は編集していない**（**D-382**。§J 以外は設計卓の手番）。**新規 followup 候補 1 件**（`m19-03-e2e-flaky-under-parallel`）と **既存 followup の状態更新 1 件**（`trash-row-click-404` ＝ 本サブと交差するが閉じない）は**設計伝達レポート §4 へ回した**。 |
| 9 | **`web/CLAUDE.md` §1 の台帳** | **更新不要。** ブラウザストレージの新規キーは 0 件（`check-browser-storage-keys.sh` で確認）。 |
| 10 | **`DES-005` §6.8 の test-id 台帳** | **新規 test-id 0 件。** 撤去した列に test-id は付いていなかったため、**台帳から消える行も無い**（§2.2-7 の想定した「撤去のほうが起きる」は実際には発生しなかった）。 |
| 11 | **`docs/handover/code-facts.md` §10（`combos` の列一覧）** | **`superseded_by_combo_id` が未収載**（2026-08-19 生成）。**★再生成は製造ブランチでも可能**だが、本サブでは回していない（派生資料の再生成は独立した手番。`check-derived-docs.sh` が変化量を出す）。設計卓・改善レーンの判断へ回す。 |

---

## 14. progress-log への索引行（Phase D）

`docs/progress/progress-log.md` の末尾へ索引行を追記した（`CLAUDE.md` §8）。**★横断課題 2 件**（完了報告に閉じないもの）:

1. **ボード §2.2 のマイグレ連番がズレている**（§13-3）。**次のサブが `000078` を再払い出しして衝突しうる**（`D-120` の型）。
2. **`CHANGE-121` の反映範囲に `DES-003` §5 の残骸が入っていない**（§13-5）。

**★優先度「高」の指摘を不採用にした件は無い**（レビュー報告 `docs/progress/m23-01-review.md` の「高」2 件はいずれも採用・修正済み。トリアージの全結果は同報告書末尾の「## 取り込み結果（自動トリアージ）」節）。

---

## 15. レビュー指摘の取り込みで加えた変更（Phase C）

| 指摘 | 採否 | 加えた変更 |
|---|---|---|
| **H-1** progress-log の索引行が無い | **採用** | 索引行を追記（§14）。**本節が指摘した「存在しない成果物を済みと書いた」記述も事実へ直した** |
| **H-2** `dto.go` の godoc が `PATCH/PUT 200` のまま | **採用** | `(POST 201、GET 200、PATCH 200、PUT 201)` へ是正し、`PUT` が 201 を返す理由（新 id で採番し直す）を添えた |
| **M-1** `types.ts` 冒頭コメントが「両方に」のまま | **採用** | `web/CLAUDE.md` §2 の指定文面へ揃え、`ComboDetail` の継承関係と「2 つと覚えない」注意を足した |
| **M-2** §14 がレビュー前に結果を断定 | **採用** | §14 を実施後の事実へ書き直した |
| **M-3** E2E に後片付けが無い | **採用** | `test.afterEach` で作成行（**`PUT` が採番した後継 id を含む**）を論理削除 → 完全削除で落とす。冒頭コメントの根拠も実査どおりに書き直した |
| **L-1** `include_deleted=true` 単独時の as-built が欠落 | **採用** | §10-4 へ 1 行追加（実装変更なし） |
| **L-2** `TrashListRow.test.tsx:70` のアサーションが無効 | **不採用（見送り）** | **本サブの差分外**。かつ `toBeDefined()` を呼ぶだけでは直らない——`element.onclick` は未設定時 `null` であり `null !== undefined` で通るため、**「直したように見えて何も検証しない」状態が残る**。意図（tr の onClick が stopPropagation で発火しない）を実際に検証するには `useNavigate` のモック化が要り、テストの作り替えになる。**⇒ 同ファイルを触る `M23-06` へ回す**（設計伝達レポート §4-6 の followup 候補へ登録） |
| **L-3** コード内の `DES-003` §3.4 が前方参照 | **不採用（対応不要）** | **`CHANGE-121` 反映で自然解消する。** レビュー自身も「実装の修正は不要」としており、設計伝達レポート §4-7 に反映項目として載っている |
| **L-4** 印を持つ旧行は API 直叩きで復元できる | **不採用（対応不要）** | **§2.2-3 が復元の契約を変えないことを固定**しており、判断は `M23-04`。`TestRepository_Restore_LeavesSupersededMarkUntouched` が現状挙動を固定済み。レビュー自身が「記録済みであることの確認にとどまる」としている |

**★「高」の指摘を不採用にしたものは 1 件も無い**（Phase C 安全弁のエスカレーションは発生していない）。

### 15-1. 取り込み後の再検証

| コマンド | 結果 |
|---|---|
| `go build ./...` / `gofmt -l internal/` | 成功 / 0 件 |
| `go test ./internal/api/combo/` | `ok github.com/plexiblinp/combomgr/internal/api/combo 1.135s` |
| `pnpm vitest run src/features/combo` | `Test Files 49 passed (49) / Tests 536 passed (536)` |
| `pnpm exec tsc --noEmit -p e2e/tsconfig.json` | エラーなし |
| `playwright test e2e/m23-01-trash-superseded.spec.ts` | `2 passed (9.7s)`（**後片付け追加後に再実行**） |

---

*以上、M23-01 完了報告。`PUT` が積む旧行を判別する列を新設して既定で隠し、存在しない 90 日の残日数を画面から消した。設計書本体は 1 文字も編集していない。*

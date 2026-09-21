# M23-08 完了報告: 削除・完全削除のサーバ側の是正

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/M23-08-delete-server-side-corrections.md` v1.0.0 |
| チェックリスト | `docs/instructions/reviews/M23-08-review-checklist.md` v1.0.0 |
| 実施日 | 2026-08-23 |
| ブランチ | `claude/m23-08-implementation-plan-qw3ppw` |
| 起点 commit | `cdfcf0c` |
| 消費マイグレーション | **0 本**（`ls migrations/*.up.sql` = 78 本のまま。次に払い出す番号は `000079` で不変） |
| 消費 CHANGE 番号 | **0 件**（`CHANGE-126` は設計卓が起票する） |

---

## 1. やったこと（5 件 ＋ 開発者裁定 1 件）

| # | 項目 | 実装場所 |
|---|---|---|
| (1) | **CASCADE 依存 5 表を明示削除へ** | `internal/repository/combo/repository.go` `HardDelete` |
| (2) | **self-FK を明示的に NULL 化** | 同上 |
| (3) | **完全削除の前チェックを Tx 内へ** | `internal/service/combo/service.go` `PermanentDelete` |
| (4) | **論理削除が削除日時を上書きしない**（成功は保つ） | `internal/repository/combo/repository.go` `SoftDelete` |
| (5) | **引き継ぎオプションが削除済みセットプレイの紐付けを落とさない** | `repository.go` `DeleteComboSetupsByComboID` / `...Excluding` ＋ `service.go` `UpdateWithKeyChange` |
| ★ | **`superseded_by_combo_id` も明示 NULL 化**（開発者裁定・2026-08-23。**指示書 §4.2 への追加 1 件**） | `repository.go` `HardDelete` |

### 変更統計

**★レビュー取り込み後の実出力**（レビュー 中-2 で是正。初版は上書き事故を是正する前の値を貼っており、`docs/` の 2 行も欠落していた。**本報告は `CHANGE-126` の逐語源であるため、実際の出力へ差し替えた**）。

```
$ git diff --stat cdfcf0c
 docs/handover/followup-backlog.md                          |   2 +
 docs/progress/m23-08-completion-report.md                  | 480 +++++++++++++++
 docs/progress/m23-08-review.md                             | 256 ++++++++
 internal/api/combo/handler_test.go                         |  11 +-
 internal/repository/combo/hard_delete_children_test.go     | 485 ++++++++++++++++
 internal/repository/combo/repository.go                    | 148 ++++++-
 internal/repository/combo/soft_delete_idempotent_test.go   | 155 ++++++
 internal/service/combo/permanent_delete_tx_test.go         | 128 ++++++
 internal/service/combo/service.go                          |  46 +-
 internal/service/combo/setup_carry_trashed_link_test.go    | 321 ++++++++++
 10 files changed, 2011 insertions(+), 21 deletions(-)
```

**★`setup_carry_trashed_test.go`（M23-02 の既存ファイル）が一覧に無いことが、上書き事故を完全に是正できていることの証跡である**（§7.5）。

---

## 2. §3.3 着手前の実査 8 件（走査コマンドと件数付き）

### #1 ★★CASCADE が実際に発火しているか

**⇒ 発火するかどうかは接続で決まる。両方が実在することを実測した。**

**静的な走査**

```bash
$ grep -rn "SetMaxOpenConns\|SetMaxIdleConns" --include=*.go internal/ cmd/ | grep -v _test.go
# → 0 件
$ grep -rn "_pragma" --include=*.go internal/ cmd/
# → 0 件
```

`PRAGMA foreign_keys = ON` は `internal/infra/db/db.go:42` の `conn.Exec` 1 か所のみ（DSN パラメータではない）。**本体コードに実測の記録が既にある**——`internal/repository/combo/repository.go:1295-1303`「実測で FK=OFF の接続が混在する(M19-03 実装時 **16 接続中 7 本**)」。

**動的な実測**（実装前の probe。`hard_delete_children_test.go` を先に書き、**現状のコードに対して**走らせた）

```
$ go test ./internal/repository/combo/ -run 'TestHardDelete_' -count=1 -v
=== RUN   TestHardDelete_RemovesAllCascadeChildren/fk_on
    列挙した CASCADE 子表 = 6 件: [combo_oki_options.combo_id combo_punish_curations.combo_id
      combo_punishes.combo_id combo_setups.combo_id combo_steps.combo_id combo_tags.combo_id]
--- PASS: TestHardDelete_RemovesAllCascadeChildren/fk_on (0.81s)

=== RUN   TestHardDelete_RemovesAllCascadeChildren/fk_off
    combo_oki_options.combo_id に 1 行残っている(明示削除の書き漏れ)
    combo_punish_curations.combo_id に 1 行残っている(明示削除の書き漏れ)
    combo_punishes.combo_id に 1 行残っている(明示削除の書き漏れ)
    combo_steps.combo_id に 2 行残っている(明示削除の書き漏れ)
    combo_tags.combo_id に 1 行残っている(明示削除の書き漏れ)
--- FAIL: TestHardDelete_RemovesAllCascadeChildren/fk_off (0.46s)
```

- **FK=ON の接続では CASCADE が発火し、5 表とも 0 件になる。**
- **FK=OFF の接続では 5 表すべてが残る**（`combo_setups` は既に明示削除だったため 0 件）。
- **⇒ 「発火しないことがありうる」は「実際にどちらも起こる」だった。** どちらを引くかは実行時まで分からない。

**★★既存データの orphan は実 DB に 19 件実在した**（**開発者が 2026-08-23 に実 DB を読み取り専用で開いて計測**。内訳と全量は §4）。

**⇒ `P-04` の位置づけが変わる。** 静的走査と probe が示したのは「接続によって発火したりしなかったりする」までだったが、**実データに残骸が 19 件あるということは、本番で実際に発火していなかった時期がある証拠である。** 推論ではなく物証である。

**★本サブは掃除していない**（§4.6・§5-4。データを消す変更は開発者の判断）。

### #2 ★self-FK を持つ子がある基底コンボの完全削除で何が起きるか

**⇒ FK=ON なら完全削除そのものが失敗し、FK=OFF なら dangling が残る。両方を実測した。**

```
$ go test ./internal/repository/combo/ -run 'TestHardDelete_NullsMaterializedFrom' -count=1 -v   # 実装前
--- FAIL: .../fk_on   HardDelete(base): hard delete: constraint failed: FOREIGN KEY constraint failed (787)
--- FAIL: .../fk_off  materialized_from_combo_id = 1(dangling)。NULL 化されていない
```

`materialized_from_combo_id` は `ON DELETE` 句を持たない（`migrations/000038_add_combos_materialized_from.up.sql:6`。既定の `NO ACTION`）。**⇒ FK=ON では 787 で落ち、FK=OFF では存在しない id を指したまま残る。** §4.2 の対処（明示的な NULL 化）はどちらにも効く。

**★あわせて 2 本目の self-FK も実測した**（下記 §3 の drift 1 件目）。

```
$ go test ./internal/repository/combo/ -run 'TestHardDelete_NullsSupersededBy' -count=1 -v   # 実装前
--- PASS: .../fk_on                                        ← 宣言どおり SET NULL が発火する
--- FAIL: .../fk_off  superseded_by_combo_id = 2(dangling)  ← 発火しない
```

### #3 `HardDelete` の明示削除の順序と Tx 内か

**見立てどおり。報告のみ。** `internal/repository/combo/repository.go:1042-1061`（実装前）。順序は **`combo_setup_results` → `combo_setups` → `combos`**。**Tx 内**——`tx *sql.Tx` を受け `r.runner(tx)` 経由で実行し、Tx 自体は `service.PermanentDelete`（`service.go:1056`）が張る。

### #4 `PermanentDelete` の前チェックが実際に Tx の外にあるか

**★外にあった。** `internal/service/combo/service.go:1048`（`FindByIDAllowDeleted`）が `:1056` の `BeginTx` より前。見立てどおり。

**★朗報が 1 件**——tx 版 `FindByIDAllowDeletedTx` が **`M23-04` で既に存在していた**（`repository.go:499-505`／IF は `:143-145`）。**新しいリポジトリメソッドを足す必要は無かった。**

### #5 `SoftDelete` に `deleted_at IS NULL` が無いこと／「2 度目も成功」を期待する既存テストの所在

**述語は無かった**（`repository.go:1010-1011` の `WHERE id = ?` のみ）。IF godoc（`:155-156`）も「既に削除済みでも冪等(deleted_at を上書き)」と明記していた。

**既存テストは 1 本だけ**——`internal/api/combo/handler_test.go:1073` `TestHandler_Delete_204_OnAlreadyDeleted`。**★ただし mock service を使っており実 DB を見ていない。**

```bash
$ grep -rn "2度目" internal/
# → 0 件
```

**⇒ 実 DB で 2 度目の `SoftDelete` を主張するテストは 0 件だった。** 本サブが §5.1-5 として新設した（`soft_delete_idempotent_test.go`）。

### #6 引き継ぎオプションの母集団に `s.deleted_at IS NULL` が入っている箇所の数

**★実測＝ 3 か所。**

| # | 場所 | 役割 |
|---|---|---|
| 1 | `internal/repository/combo/repository.go:1405-1408` `CountComboSetupsByComboID` | 引き継ぎモーダルの発火ゲート（**M23-02・D-491 が意図して足した**） |
| 2 | `internal/repository/setup/repository.go:786-792` `ListSetupsByComboID` | モーダルの選択肢を供給する |
| 3 | `internal/repository/setup/repository.go:828-834` `ListSetupsByComboIDs` | 同バッチ版 |

**★書き込み側には述語が 1 つも無かった**——`DeleteComboSetupsByComboID`（`:1352`）／`DeleteComboSetupsByComboIDExcluding`（`:1369`）はいずれも `combo_setups` の全行を対象にしていた。

**⇒ 落ちる機序は「読みが除外している」ではなく「読みが除外しているものを、書きが除外せずに消している」だった。** 設計卓の見立て「入っている」は当たっているが、**直す先は読み側ではない**（§6 の裁定 1）。

### #7 `combos` を `ON DELETE CASCADE` で参照する子表の実測一覧

**★実測＝ 6 表。指示書の記述（6 表・うち `combo_setups` は明示削除済み ⇒ CASCADE 依存 5 表）と一致した。食い違い無し。**

スキーマからの機械列挙（テストが毎回実行する。ハードコードした一覧ではない）:

```
列挙した CASCADE 子表 = 6 件: [combo_oki_options.combo_id combo_punish_curations.combo_id
  combo_punishes.combo_id combo_setups.combo_id combo_steps.combo_id combo_tags.combo_id]
```

マイグレーション上の定義（`grep -n "REFERENCES combos(id)" migrations/*.up.sql`）:

| 子表 | 定義 | 完全削除での扱い（実装前） |
|---|---|---|
| `combo_steps` | `000001_init_schema.up.sql:98` | CASCADE 依存 |
| `combo_tags` | `000001_init_schema.up.sql:121` | CASCADE 依存 |
| `combo_setups` | `000001_init_schema.up.sql:194` | **明示削除済み** |
| `combo_oki_options` | `000021_normalize_combo_oki_options.up.sql:33` | CASCADE 依存 |
| `combo_punishes` | `000036_create_combo_punishes.up.sql:8` | CASCADE 依存 |
| `combo_punish_curations` | `000037_create_combo_punish_prunings_and_curations.up.sql:20` | CASCADE 依存 |

**★`combos` は 000016 / 000019 で 2 回作り直されているが、子表は 1 つも作り直されていない**（`grep` で `RENAME TO` / `DROP TABLE` / `CREATE TABLE` を全数走査。作り直されたのは `combos` のみ）。**⇒ 上記の定義が現行である。**

**★`combo_setup_results` は `combos` の直接の子ではない**——FK は `combo_setups` への複合キー（`000042_create_combo_setup_results.up.sql:30-32`）であり、**孫**である。機械列挙には出てこないため、テストでは別に 1 行主張している。

### #8 ★`combo_tags` の orphan がタグ一覧の `usage_count` に影響するか

**⇒ 一覧には影響しない。★ただし別の場所に「今日の実害」があった。**

**影響しない側**——`internal/repository/tag/repository.go:81-94` `listWithUsage`:

```sql
LEFT JOIN combo_tags ct ON ct.tag_id = t.id
LEFT JOIN combos c ON c.id = ct.combo_id AND c.deleted_at IS NULL ...
COUNT(c.id) AS usage_count
```

`combos` へ結合しており、数えているのは `COUNT(*)` ではなく **`COUNT(c.id)`**。orphan 行は `c.id = NULL` になり `COUNT` が無視するため **0 に落ちる。**

**★影響する側（今日の実害）**——タグ削除ガードの `CountUsage`（`tag/repository.go:212-219`）:

```sql
SELECT COUNT(*) FROM combo_tags WHERE tag_id = ?
```

**結合も述語も無い。⇒ orphan の `combo_tags` 行がタグを「使用中」に見せ続ける。**

**★実際の詰み方**（画面と API で答えが割れているのが本体である）:

| # | 起きること | 根拠 |
|---|---|---|
| 1 | タグ管理画面が **「使用 0 件」** と表示する | 一覧は `listWithUsage` 由来（orphan を数えない） |
| 2 | 削除の確認ダイアログも警告を出さない | `TagDeleteConfirmDialog.tsx:29` `isInUse = usageCount > 0` = false |
| 3 | **`force` が false のまま送られる** | `TagManagementPage.tsx:60-62` の `force: usageCount > 0`。**画面の表示値から決めている** |
| 4 | サーバが **409 `tag_in_use`** を返す | `CountUsage` = 1（orphan を数える） |
| 5 | 何度押しても 1 に戻る | 表示値が変わらないため `force` も変わらない |

**⇒ UI からは抜け道が無い。★ただし「絶対に不可能」ではない**——`DELETE /api/tags/{id}?force=true` を直接叩けば消せる（`internal/api/tag/handler.go:144`）。**「利用者の手には届かない」が正確な表現である。**

**★本サブは `CountUsage` を直していない。** 射程は `combos` の完全削除だけであり（指示書 §1.5-2 / §9.1-2）、しかも `tag/repository.go:80` は「ゴミ箱のコンボも数える」ことを意図として明記している——orphan と「ゴミ箱に居る親」を区別する変更は、その意図に触れる判断を伴う。**§J へ登録した**（`tag-count-usage-inflated-by-orphan-combo-tags`）。

**★orphan の供給源は 2 つある**（レビュー 低-5 で是正。**初版は「本サブの明示削除により、これ以降 orphan は増えない」と書いたが、これは不正確だった**）。

| 供給源 | 本サブの扱い |
|---|---|
| **コンボの完全削除**（`combos` → `combo_tags`） | **塞いだ**（§1 の (1)） |
| **タグの削除**（`tags` → `combo_tags`） | **塞いでいない**——`internal/repository/tag/repository.go:194-196` の `Delete` は `DELETE FROM tags` のみで、godoc も「`combo_tags` は `ON DELETE CASCADE` で自動削除される」と断言している。**本サブが `combos` 側で撤回したのと同型の記述である。** **★`tags` 側は射程外なので直していない**（§9.1-2「報告する。直さない」） |

**⇒ 「これ以降 orphan が増えない」のはコンボ経由の分だけである。** §J の当該行へも同じ内容を追記した。

**★★実測で実害が確定した**（2026-08-23）——**`combo_tags` の orphan は実 DB に 1 件実在する**（§4）。**⇒ タグ 1 件が `CountUsage` で「使用中」に見え、利用者が消せない状態が今この瞬間に存在する。** 仮定ではない。

---

## 3. 指示書より後に増えていた事実（★報告事項・§9.1-6）

### drift 1: `combos.superseded_by_combo_id` という 2 本目の self-FK

指示書 §1.3 と `M23-RESEARCH-01` 軸 F は **2026-08-20 の実測**であり、**`migrations/000078_add_combos_superseded_by.up.sql`（M23-01／`CHANGE-121`）を含んでいない。**

```sql
ALTER TABLE combos ADD COLUMN superseded_by_combo_id INTEGER REFERENCES combos(id) ON DELETE SET NULL;
```

**★同マイグレーションのコメント自身が答えを持っていた**（`000078:7-9`）:

> `ON DELETE SET NULL` は意図の記録として置くが、`PRAGMA foreign_keys` が接続単位である(ボード `P-04`)ため連鎖動作は保証されない。**実装は「後継が完全削除された旧行がゴミ箱へ再び現れうる」前提で成立させてある。**

**⇒ FK=OFF の接続では印が残り、その旧行は `only_deleted` の条件（`repository.go:764` = `deleted_at IS NOT NULL AND superseded_by_combo_id IS NULL`）に落ちてゴミ箱に現れず、`VAL-C14` の母集団（`:1252`）からも外れる。どの画面からも触れない行になる。**

**⇒ 開発者裁定（2026-08-23）により、`materialized_from_combo_id` と同じ手番で明示 NULL 化した。新しい仕様を作るのではなく、`M23-01` が宣言した挙動を接続に依存させないだけである。**

### drift 2: 失効した godoc が 1 件あった

`repository.go:164`（実装前）:

```go
// HardDelete は combos を物理削除する。tx 内で実行すること。
// 呼び出し前に deleted_at IS NOT NULL であることをサービス層で確認すること。
// combo_steps は ON DELETE CASCADE で自動削除される。   ← ★失効
```

**同じ関数の実装コメント（`:1044-1047`）が「FK=OFF の接続では発火しない」と正反対を書いていた。** 本サブで是正した。**動作は正しいままなのでテストも lint も型検査も緑になり、人が読む以外に見つける経路が無い型である。**

---

## 4. orphan の件数（§4.6 / §7.5-2）

**★★実測できた。19 件だった。掃除はしていない。**

**計測者・条件**: 開発者が **2026-08-23** に実 DB を**読み取り専用モードで開いて**実行。**データ変更・ファイル変更なし。**

| 対象 | 件数 |
|---|---:|
| `combo_oki_options` | **12** |
| `combo_steps` | **6** |
| `combo_tags` | **1** |
| `combo_punishes` | 0 |
| `combo_punish_curations` | 0 |
| `combo_setups` | 0 |
| `combo_setup_results` | 0 |
| `dangling_materialized` | **0** |
| `dangling_superseded` | **0** |
| **合計（孤立行）** | **19** |

**★★これは `P-04` の位置づけを変える実測である。**

- **静的走査と probe が示せたのは「接続によって発火したりしなかったりする」までだった。** それは可能性の話である。
- **実データに残骸が 19 件あるということは、本番で実際に発火していなかった時期があるということである。** **⇒ 推論ではなく物証がある。**
- **⇒ `P-04` の根治サブを起こすかどうかの判断材料が、仮定ではなく実測として揃った**（`M23` のスコープ外である点は変わらない＝§5-1）。

**★self-FK 側は 0 件だった**（`dangling_materialized` / `dangling_superseded` とも）。**⇒ §4.2 の NULL 化は、既に出ている実害を消すためではなく、これから出る実害を防ぐための変更である**（実装前の probe では FK=ON の接続で完全削除そのものが 787 で落ちていた——**落ちていたから dangling が残らなかった**、という読み方もできる）。

**★掃除はしていない**（指示書 §4.6・§5-4）。**データを消す変更であり開発者の判断である**（`CLAUDE.md` §10）。**§J の `combos-orphan-child-rows-count-unmeasured` を「計測済み・掃除の要否が未決」へ更新した。**

**★`combo_tags` の 1 件には今日の実害がある**——実査 #8 の `CountUsage` により、**タグ 1 件が「使用 0 件」と表示されたまま画面からは削除できない状態が実在する**（詳細な詰み方は実査 #8）。

**計測に使った SQL**（読み取りのみ。何も消さない。再現手順として残す）:

```sql
SELECT 'combo_steps'            AS t, COUNT(*) FROM combo_steps            WHERE combo_id NOT IN (SELECT id FROM combos)
UNION ALL SELECT 'combo_tags',            COUNT(*) FROM combo_tags            WHERE combo_id NOT IN (SELECT id FROM combos)
UNION ALL SELECT 'combo_oki_options',     COUNT(*) FROM combo_oki_options     WHERE combo_id NOT IN (SELECT id FROM combos)
UNION ALL SELECT 'combo_punishes',        COUNT(*) FROM combo_punishes        WHERE combo_id NOT IN (SELECT id FROM combos)
UNION ALL SELECT 'combo_punish_curations',COUNT(*) FROM combo_punish_curations WHERE combo_id NOT IN (SELECT id FROM combos)
UNION ALL SELECT 'combo_setups',          COUNT(*) FROM combo_setups          WHERE combo_id NOT IN (SELECT id FROM combos)
UNION ALL SELECT 'combo_setup_results',   COUNT(*) FROM combo_setup_results   WHERE combo_id NOT IN (SELECT id FROM combos)
UNION ALL SELECT 'dangling_materialized', COUNT(*) FROM combos WHERE materialized_from_combo_id IS NOT NULL
      AND materialized_from_combo_id NOT IN (SELECT id FROM combos)
UNION ALL SELECT 'dangling_superseded',   COUNT(*) FROM combos WHERE superseded_by_combo_id IS NOT NULL
      AND superseded_by_combo_id NOT IN (SELECT id FROM combos);
```

**★あわせて開発者が実機で任意確認を 1 件実施した**（2026-08-23）——**materialize 生成物を持つ基底コンボの完全削除で、生成物を巻き込まないこと。** `TestHardDelete_NullsMaterializedFromInsteadOfDeletingChild` と同じ主張が、実データ上でも成立することを確認済み。

### 4.1 掃除 SQL（★製造は実行しない。開発者が判断・実行する）

**★製造の推奨は「19 行すべて消す」である。** 理由:

1. **残しても情報価値がゼロである。** 親が無いので、そのステップ・起き攻めオプションが**どのコンボのものだったかすら復元できない。**
2. **`combo_tags` の 1 件は、消すだけで実害が解消する。** `CountUsage` のコードに触らずに直る（実査 #8）。
3. **今が掃除のタイミングとして良い。** `M23-08` でコンボ経由の供給は止まった。**増え続ける状態での掃除は無意味だが、止まった後の掃除は効く。**
4. **部分的に消すと、次に同じ調査をやり直すことになる。** 19 行は一度で片付く量である。

**★マイグレーション化はしない。** データを消すマイグレは全環境で走るうえ、`M23-08` はマイグレ消費 0 本で確定している。**必要なら別サブとして設計卓の判断。**

```sql
-- ★実行前に DB のバックアップを取ること。
-- ★親のいない子行だけを消す。生きたコンボの子行・ゴミ箱のコンボの子行には一切当たらない
--   (WHERE 句が combos に実在しない combo_id だけを対象にしているため)。
BEGIN;

-- 実行前の件数（19 になるはず）
SELECT 'before' AS phase, (
    (SELECT COUNT(*) FROM combo_steps            WHERE combo_id NOT IN (SELECT id FROM combos))
  + (SELECT COUNT(*) FROM combo_tags             WHERE combo_id NOT IN (SELECT id FROM combos))
  + (SELECT COUNT(*) FROM combo_oki_options      WHERE combo_id NOT IN (SELECT id FROM combos))
  + (SELECT COUNT(*) FROM combo_punishes         WHERE combo_id NOT IN (SELECT id FROM combos))
  + (SELECT COUNT(*) FROM combo_punish_curations WHERE combo_id NOT IN (SELECT id FROM combos))
  + (SELECT COUNT(*) FROM combo_setups           WHERE combo_id NOT IN (SELECT id FROM combos))
  + (SELECT COUNT(*) FROM combo_setup_results    WHERE combo_id NOT IN (SELECT id FROM combos))
) AS orphan_rows;

DELETE FROM combo_setup_results    WHERE combo_id NOT IN (SELECT id FROM combos);
DELETE FROM combo_setups           WHERE combo_id NOT IN (SELECT id FROM combos);
DELETE FROM combo_steps            WHERE combo_id NOT IN (SELECT id FROM combos);
DELETE FROM combo_tags             WHERE combo_id NOT IN (SELECT id FROM combos);
DELETE FROM combo_oki_options      WHERE combo_id NOT IN (SELECT id FROM combos);
DELETE FROM combo_punishes         WHERE combo_id NOT IN (SELECT id FROM combos);
DELETE FROM combo_punish_curations WHERE combo_id NOT IN (SELECT id FROM combos);

-- self-FK の dangling（実測 0 件だが、念のため同じ手番で外す）
UPDATE combos SET materialized_from_combo_id = NULL
  WHERE materialized_from_combo_id IS NOT NULL
    AND materialized_from_combo_id NOT IN (SELECT id FROM combos);
UPDATE combos SET superseded_by_combo_id = NULL
  WHERE superseded_by_combo_id IS NOT NULL
    AND superseded_by_combo_id NOT IN (SELECT id FROM combos);

-- 実行後の件数（0 になるはず）。0 でなければ ROLLBACK すること。
SELECT 'after' AS phase, (
    (SELECT COUNT(*) FROM combo_steps            WHERE combo_id NOT IN (SELECT id FROM combos))
  + (SELECT COUNT(*) FROM combo_tags             WHERE combo_id NOT IN (SELECT id FROM combos))
  + (SELECT COUNT(*) FROM combo_oki_options      WHERE combo_id NOT IN (SELECT id FROM combos))
  + (SELECT COUNT(*) FROM combo_punishes         WHERE combo_id NOT IN (SELECT id FROM combos))
  + (SELECT COUNT(*) FROM combo_punish_curations WHERE combo_id NOT IN (SELECT id FROM combos))
  + (SELECT COUNT(*) FROM combo_setups           WHERE combo_id NOT IN (SELECT id FROM combos))
  + (SELECT COUNT(*) FROM combo_setup_results    WHERE combo_id NOT IN (SELECT id FROM combos))
) AS orphan_rows;

COMMIT;   -- after が 0 であることを見てから
```

**★削除順序は `combo_setup_results` → `combo_setups` を先に置いてある**（前者の FK 親が後者であるため。FK=ON の接続で実行しても順序違反にならない）。

**★掃除しても `tags` 削除経由の供給は残る**（実査 #8）。**再発を完全に止めるには `tag.Delete` 側の是正が要り、それは `M23-08` の射程外である。**

---

## 5. §4.9 否定形確認（4 件）

| # | やらなかったこと | 証跡 |
|---|---|---|
| 1 | **`P-04` の根治**（`PRAGMA` の DSN 化・`SetMaxOpenConns` の追加） | `git diff cdfcf0c..HEAD -- internal/infra/` = **空**。`grep -rn "SetMaxOpenConns" --include=*.go internal/ cmd/ \| grep -v _test.go` = 依然 **0 件** |
| 2 | **セットプレイ側の論理削除の挙動の変更** | `git diff cdfcf0c..HEAD -- internal/repository/setup/ internal/service/setup/` = **空**。非対称（2 度目が「見つからない」）は意図的に残した |
| 3 | **FK 句のマイグレーションによる変更** | `git diff cdfcf0c..HEAD -- migrations/` = **空**。`ls migrations/*.up.sql \| wc -l` = **78**（起点と同じ）。次の番号は `000079` で不変 |
| 4 | **orphan の掃除** | 本体コードに `DELETE` の追加は `HardDelete` 内の 5 文のみ。既存データを触る処理は 1 つも書いていない（§4） |

---

## 6. 開発者裁定 2 件（Plan Mode で確認・2026-08-23）

### 裁定 1: §4.5 は「書き側を生きた紐付けに限定する」で実装する

指示書 §4.5 は「引き継ぎオプションが**読む**紐付けの母集団に削除済みセットプレイを含めよ」と書くが、実測した機序は §2 の #6 のとおり逆だった。読み側（`ListSetupsByComboID` / `CountComboSetupsByComboID`）を緩めるとゴミ箱のセットプレイがコンボ詳細画面に出てしまい、`M23-02` / `M23-03` が意図して入れた除外と §4.7 に反する。

**⇒ `DeleteComboSetupsByComboID` / `...Excluding` の DELETE に `AND setup_id IN (SELECT id FROM setups WHERE deleted_at IS NULL)` を足し、解除の対象を「利用者が実際に選べた紐付け」に限定した。** 画面・API・スキーマは 1 バイトも変えていない。

**★呼び出し元は引き継ぎの 4 か所だけ**（`service.go:545` / `:549` / `:683` / `:688`）。他機能への波及は無い。

**★あわせて PUT の `unlink_all` に `UpdateSetupReferences` を足した。** これは任意の追加ではなく**必須**である——実測で確かめた:

```
$ go test ./internal/service/combo/ -run 'TestUpdateWithKeyChange_UnlinkAll_Moves' -count=1   # 再ポイントを外した状態
--- FAIL: TestUpdateWithKeyChange_UnlinkAll_MovesTrashedSetupLinkToNewCombo
    UpdateWithKeyChange: move setup result references: constraint failed: FOREIGN KEY constraint failed (787)
```

**⇒ 再ポイントが無いと、削除済みセットプレイの紐付けを持つコンボの `unlink_all` が、FK=ON の接続でキー変更編集そのものを落とす**（`MoveSetupResultReferences` が存在しない `(新 combo_id, setup_id)` の組へ結果行を移そうとするため）。**2 つの変更は同時に入れる必要がある。**

### 裁定 2: `superseded_by_combo_id` も明示 NULL 化する（**指示書 §4.2 への追加 1 件**）

根拠は §3 の drift 1。**設計伝達レポートへも申し送る。**

---

## 7. テスト（§5）

### 7.1 §5.1 の 9 件

| # | 何を守るか | テスト |
|---|---|---|
| **1** | **スキーマから参照列を列挙し、完全削除の後に「消えた id を指す行」が 1 つも無い。列挙が 1 件以上あることを先に主張** | `hard_delete_children_test.go` `TestHardDelete_RemovesAllCascadeChildren`（fk_on / fk_off の 2 ケース） |
| 2 | materialize 生成物が残り `materialized_from_combo_id` が NULL になっている | 同 `TestHardDelete_NullsMaterializedFromInsteadOfDeletingChild` |
| 3 | **生成物が削除されていないこと**（NULL 化との取り違え検出） | 同上（`combos` の行数 ＋ 生成物の `combo_steps` の残存を独立に主張） |
| 4 | 前チェックが Tx 内にある | `permanent_delete_tx_test.go` `TestPermanentDelete_PrechecksInsideTransaction` |
| 5 | 2 度目の論理削除が成功する | `soft_delete_idempotent_test.go` `TestSoftDelete_SecondCallStillSucceeds` |
| 6 | **2 度目の論理削除で `deleted_at` が変わらない** | 同 `TestSoftDelete_SecondCallDoesNotOverwriteDeletedAt` |
| 7 | `individual` で削除済みセットプレイの紐付けが落ちない | `setup_carry_trashed_link_test.go` `TestUpdateMetadata_Individual_KeepsTrashedSetupLink` ／ `TestUpdateWithKeyChange_Individual_MovesTrashedSetupLinkToNewCombo` |
| 8 | `unlink_all` でも落ちない | 同 `TestUpdateMetadata_UnlinkAll_KeepsTrashedSetupLink` ／ `TestUpdateWithKeyChange_UnlinkAll_MovesTrashedSetupLinkToNewCombo` |
| 9 | **生きたセットプレイの挙動が変わっていない**（退行の防止） | 同 `TestUpdateMetadata_Individual_StillUnlinksLiveSetup` ／ `TestUpdateMetadata_CarryAll_KeepsBoth` ＋ 上記各テスト内の対照主張 |

**追加で置いたもの**: `TestHardDelete_NullsSupersededByOnRemainingRows`（裁定 2）／`TestSoftDelete_MissingRowStillReturnsNotFound`（述語追加で `RowsAffected` だけでは分けられなくなった分岐）／`TestSoftDelete_FirstCallStampsDeletedAt`／`TestPermanentDelete_ResponseContractUnchanged`（404 / 409 とロールバック）。

### 7.1-b ★列挙の射程（レビュー 中-1 / 低-2 の取り込み）

**初版は `ON DELETE CASCADE` の子表だけを列挙していた**（6 件）。**それでは「`combos` を参照するが CASCADE 句を持たない新しい表」が、列挙にも明示削除にもテストにも出てこない。★これは本サブ §4.2 が扱った `materialized_from_combo_id`（`ON DELETE` 句なし）とまったく同じ型の穴である。**

**⇒ 列挙を「完全削除の後に、消えたコンボの id を指していてはいけない列」へ広げた**（**9 件**）。

| 種別 | 件数 | 内訳 |
|---|---|---|
| 直接の子（`combos` を参照する表） | 6 | `combo_steps` / `combo_tags` / `combo_setups` / `combo_oki_options` / `combo_punishes` / `combo_punish_curations` |
| **self-FK**（`combos` 自身の列） | 2 | `materialized_from_combo_id` / `superseded_by_combo_id` |
| **孫**（直接の子を同名の列で参照する表） | 1 | `combo_setup_results.combo_id` |

- **`on_delete` の値で分岐していない。** CASCADE（行が消える）でも SET NULL・明示 NULL 化（値が NULL になる）でも、**「消えた id を指す行が残っていない」という一つの主張で足りる**ため。**参照の仕方が何であれ検出できる**のが広げた狙いである。
- **★NULL 化と削除の取り違えは本主張では区別できない**（どちらでも 0 件になる）。**それは `TestHardDelete_NullsMaterializedFromInsteadOfDeletingChild` が「生成物の行が残っていること」を独立に主張して守っている。** 2 段構えである。
- **孫を 1 段だけ辿る**ことで、初版でハードコードしていた `combo_setup_results` の主張も機械列挙に載った（低-2）。
- **3 本目の self-FK・新しい子表・新しい孫のいずれが増えても、fixture の未対応が「削除前に 1 行以上ある」の主張で落ちる。**

### 7.2 ★§5.1-4 は構造による主張である（指示書の但し書きに従った）

**同時実行のテストは書いていない。** SQLite は書き込みを直列化するため、「判定と削除の間に復元を割り込ませる」瞬間を 2 接続で決定的に作れない（タイミング依存になり、緑でも赤でも何も証明しない）。

**⇒ `comborepo.Repository` を埋め込みで包んだ spy で、どちらの読み取り経路が使われたかを記録する形にした。** `FindByIDAllowDeletedTx` が `tx != nil` で呼ばれること／`FindByIDAllowDeleted`（Tx を取らない版）が **0 回**であることを主張する。

### 7.3 ★★§5.2 破壊確認 2 件

**★レビュー取り込みで列挙を広げたため（中-1 / 低-2）、破壊確認は取り込み後の実装・テストに対して回し直した。** 以下は再実施の出力である。列挙は **6 件 → 9 件**（直接の子 6 ＋ self-FK 2 ＋ 孫 1）になっている。

#### 破壊確認 1: `HardDelete` から 1 表分の明示削除を消す

```
# internal/repository/combo/repository.go から combo_tags の DELETE ブロックを削除
$ go test ./internal/repository/combo/ -run 'TestHardDelete_RemovesAllCascadeChildren' -count=1
--- FAIL: TestHardDelete_RemovesAllCascadeChildren (0.99s)
    --- FAIL: TestHardDelete_RemovesAllCascadeChildren/fk_off (0.48s)
        列挙した combos 参照列 = 9 件: [combo_oki_options.combo_id combo_punish_curations.combo_id
          combo_punishes.combo_id combo_setups.combo_id combo_steps.combo_id combo_tags.combo_id
          combos.superseded_by_combo_id combos.materialized_from_combo_id combo_setup_results.combo_id]
        combo_tags.combo_id に 1 行残っている(明示削除／NULL 化の書き漏れ)
FAIL
```

#### 破壊確認 1b: self-FK の NULL 化を消す（★広げた列挙が拾うことの確認）

```
# HardDelete から superseded_by_combo_id の NULL 化を削除
$ go test ./internal/repository/combo/ -run 'TestHardDelete_RemovesAllCascadeChildren' -count=1
--- FAIL: .../fk_off
        combos.superseded_by_combo_id に 1 行残っている(明示削除／NULL 化の書き漏れ)
FAIL
```

**⇒ 広げた列挙は self-FK の書き漏れも拾う。** 取り込み前の列挙（`ON DELETE CASCADE` 限定）ではここは緑のまま通っていた。

**★★ここで最も重要な観測**——**`fk_on` は PASS したままだった。** FK=ON の接続では CASCADE が代わりに `combo_tags` を消すためである。

**⇒ FK=ON だけで回すテストでは、明示削除を消しても緑のまま通る。** それでは本テストは何も守らない。**`fk_off` の枝が本命であり、この破壊確認はその必要性そのものを実証している。**

#### 破壊確認 2: 列挙 SQL を空にする

```
# 列挙 SQL に AND 1 = 0 を足す
$ go test ./internal/repository/combo/ -run 'TestHardDelete_RemovesAllCascadeChildren' -count=1
--- FAIL: TestHardDelete_RemovesAllCascadeChildren (0.99s)
    --- FAIL: .../fk_on (0.50s)
        combos を指す参照列が 1 件も列挙できていない。列挙そのものが壊れており、以降の主張は無意味である
    --- FAIL: .../fk_off (0.49s)
        combos を指す参照列が 1 件も列挙できていない。列挙そのものが壊れており、以降の主張は無意味である
FAIL
```

**両ケースとも赤。** 0 件の一覧に対する「すべて空である」は常に真であるため、列挙が壊れたことを先に検出する主張が要る。

**★破壊確認のあと、いずれも元へ戻して `git status --porcelain` が空であることを確認済み。**

#### 参考: §4.5 の変更が意味を持つことの確認

破壊確認の必須 2 件とは別に、引き継ぎ側の 4 テストが修正前なら赤くなることも実測した（`liveSetupScope` を空文字にして走らせた）:

```
--- FAIL: TestUpdateMetadata_Individual_KeepsTrashedSetupLink        削除済みセットプレイの紐付けが落ちている
--- FAIL: TestUpdateMetadata_UnlinkAll_KeepsTrashedSetupLink         削除済みセットプレイの紐付けが落ちている / 結果行 = 0 行, want 1
--- FAIL: TestUpdateWithKeyChange_UnlinkAll_MovesTrashedSetupLinkToNewCombo
--- FAIL: TestUpdateWithKeyChange_Individual_MovesTrashedSetupLinkToNewCombo
```

### 7.4 自己テスト結果（件数付き）

```
$ go test ./... -count=1
53 パッケージ ok ／ FAIL 0
$ go test ./... -count=1 -v
--- PASS: 1291 本 ／ --- FAIL: 0 本

$ cd web && pnpm test
Test Files  175 passed (175)
     Tests  1752 passed (1752)

$ make e2e
168 passed (3.1m) ／ FAIL 0
```

**★`pnpm test` と `make e2e` の件数は `M23-06` 完了時点と同一である**（175 files / 1752 tests ／ 168 passed）。**本サブが画面側へ 1 件もテストを足していないこと・退行させていないことの傍証。**

### 7.5 §5.3 既存テストの温存

**★1 件の事故と是正を記録する。**

`internal/service/combo/setup_carry_trashed_test.go` を新規ファイルのつもりで作成したが、**同名のファイルが既に存在した**（`M23-02`・commit `fee2859`・`D-491` の回帰テスト）。上書きにより次の 3 本を一度消していた:

- `TestUpdateMetadata_AllowsKAChangeWhenLinkedSetupsAreTrashed`
- `TestUpdateMetadata_StillRequiresCarryOptionsWhenSetupIsAlive`
- `TestUpdateWithKeyChange_AllowsKAChangeWhenLinkedSetupsAreTrashed`

**⇒ 変更統計の `deletions` を読んで気づき、元の内容へ完全に戻したうえで、本サブの新規テストを `setup_carry_trashed_link_test.go` へ分けた**（commit `75ccb35`）。

```bash
$ git diff --stat cdfcf0c -- internal/service/combo/setup_carry_trashed_test.go
# → 空（1 バイトも変わっていない）
$ go test ./internal/service/combo/ -run 'AllowsKAChangeWhenLinkedSetupsAreTrashed|StillRequiresCarryOptionsWhenSetupIsAlive' -count=1 -v
--- PASS: TestUpdateMetadata_AllowsKAChangeWhenLinkedSetupsAreTrashed (0.45s)
--- PASS: TestUpdateMetadata_StillRequiresCarryOptionsWhenSetupIsAlive (0.45s)
--- PASS: TestUpdateWithKeyChange_AllowsKAChangeWhenLinkedSetupsAreTrashed (0.46s)
```

**★教訓**——**「新規ファイルを作る」ときも、作る前に同名の存在を確かめること。** 上書きは `go test` を緑のまま通す（消えたテストは走らないだけである）。**気づけたのは `git diff --stat` の deletions を読んだからであり、テスト結果からは検出できなかった。**

`M23-01`〜`M23-05` の他のテストは全て緑（§7.4 の 53 パッケージに含まれる）。**`M23-03` が固定した削除・復元の契約テスト**（`m23_03_reference_exclusion_test.go` 系・`restore_validation_test.go`）も緑。

---

## 8. §4.7 画面を触っていないこと（§7.1-7）

```bash
$ git diff --stat cdfcf0c..HEAD -- web/
# → 空
```

**`web/` 配下の変更は 0 バイトである。** `web/src/` はもちろん `web/e2e/` にも 1 バイトの差分も無い。

**⇒ `M23-overview` §4.8 の「開発者の手動確認は不要」という判定の前提は崩れていない**（`D-493` の教訓）。

---

## 9. 品質チェック（§7.3）

```
$ bash scripts/check-artifact-integrity.sh          # ★1 本目に回す(CLAUDE.md §8)
  検査 11 件 / ALLOW 除外 1 件 —— すべて自己検査 OK
  生成物 4 件(code-facts / docs-map / retrospective-digest / custom-commands)とも OK
結果: 違反なし

$ bash scripts/check-progress-log-index.sh
結果: 違反なし

$ bash scripts/check-enum-sync.sh
結果: ベースラインどおり(増加なし)

$ bash scripts/check-browser-storage-keys.sh
台帳 9 件 / 本番コード 8 件
OK  台帳と実装が一致(未記載キーの使用なし・状態のズレなし)
結果: 違反なし

$ bash scripts/check-stop-discipline.sh
OK  §J の全エントリが必須 5 フィールドを満たす
結果: 違反なし

$ gofmt -l internal/ cmd/
# → 空

$ go vet ./internal/...
# → 空
```

---

## 10. §7.5-6 契約違反の独自判断（全件）

**★1 件。**

| # | 何を | なぜ |
|---|---|---|
| 1 | **指示書 §4.5「読む紐付けの母集団に削除済みを含める」を、書き側の限定として実装した** | §6 の裁定 1。**開発者に Plan Mode で確認し、承認を得ている。** 文言どおりに読み側へ手を入れると、ゴミ箱のセットプレイがコンボ詳細画面に出て §4.7 と `M23-02`/`M23-03` の既存判断に反する |

**★指示書の指定を超えた追加が 1 件**（契約違反ではないが同じ欄で申し送る）: **`superseded_by_combo_id` の明示 NULL 化**（§6 の裁定 2）。**開発者の承認済み。**

**★§9.2「推測で進めてよい事項」で推測したもの**:

- **推測: 明示削除は既存 2 表と同じインライン形で書き、ヘルパへ畳まないと仮定した**（チェックリスト §1「新しい書き方を作っていない」を優先）。
- **推測: §4.1-3 のテストの列挙は、`sqlite_master` で表名を取り、表ごとに `pragma_foreign_key_list(?)` を引く 2 段で書くと仮定した**（相関副問い合わせ形より移植性が高い。先例＝`migrate_m2301_test.go:39`）。
- **推測: 列挙から `combos` 自身を除外すると仮定した**（self-FK は「行を消す」対象ではなく「参照を NULL へ戻す」対象であり、別テストが見ている）。
- **推測: `SoftDelete` の 0 行時は、行の存在を数え直して「存在しない」と「既に削除済み」を分けると仮定した**（述語を足すと `RowsAffected` だけでは分けられなくなるため。応答 204 を保つ最小の形）。

---

## 11. §7.5-7 `followup-backlog.md` §J へ書いた項目

**★2 件。§J 以外の節は 1 バイトも触っていない**（`D-382`）。

| ID | 内容 |
|---|---|
| **`tag-count-usage-inflated-by-orphan-combo-tags`** | 実査 #8 の「今日の実害」。`CountUsage` が orphan の `combo_tags` 行を数え、**画面は 0 件と表示するのに削除が 409 で拒否される**（`force` は表示値から決まるため送られない）。**本サブの射程外**（`combos` の完全削除だけが射程）。**明示削除により今後 orphan は増えないため、残るのは既存分だけである** |
| **`combos-orphan-child-rows-count-unmeasured`** | **★2026-08-23 に計測済みへ更新。実測 19 件**（`combo_oki_options` 12 ／ `combo_steps` 6 ／ `combo_tags` 1 ／ self-FK の dangling は 0）。**⇒ 残る未決は「掃除するか否か」だけになった**（データを消す変更＝開発者の判断）。**スラッグは動かさない**ため名前は `-unmeasured` のまま |

---

## 12. 次サブへの申し送り

1. **★`P-04` の根治は M23 の外に残る。** 本サブは影響を消しただけで根治していない。**実査 #1 / #2 の実測（FK=ON と FK=OFF で挙動が割れることを、コードではなく実行で確かめた）が、独立サブを起こすかどうかの材料になる。**
2. **★`combos` の子表を新設するときは `HardDelete` と `hard_delete_children_test.go` の両方を直すこと。** 明示削除は「忘れられる形」であり、テストがその忘れを検出する設計になっている。**片方だけ直すとテストが落ちる（それが狙いである）。**
3. **★`setups` など他の表の CASCADE 依存は手つかずである**（射程外＝§1.5-2）。同型の作業が要るなら、本サブのテストがそのまま雛形になる。
4. **★`CHANGE-126` の逐語は本報告 §2 / §6 を源泉にすること。** とくに **実査 #6 の「機序は読み側ではなく書き側だった」** と **drift 1（2 本目の self-FK）** は、`DES-002` §4.2 の削除・復元の契約表と `DES-003` §3.4 の FK 記述の両方に効く。
5. **★`DES-002` §4.2 の契約表の更新項目は 3 件ある**（3 件目はレビュー 中-3 で追加）。
   - **非対称 2 件が両方とも解消した**——「削除日時の上書き」と「前チェックの位置」。現行の記述（「削除日時が上書きされ、後ろへずれる」「トランザクションの外」）は失効している。
   - **★`setupCarryOptions.unlink_all` の値域が変わった**——**「全部外す」ではなく「利用者に見えている（＝生きた）紐付けを全部外す」になった。** 削除済みセットプレイの紐付けはどのモードでも解除されず、`PUT` では新コンボへ引き継がれる。**上の 2 件と同格の契約変更であり、落とすと `DES-002` §4.2 の `setupCarryOptions` の記述が旧のまま確定する。**

   **★設計卓への問いが 1 件同時に発生している**——**現状、利用者が「削除済みセットプレイとの紐付け」を解除する手段は、どの画面にも API にも無い。** 本サブはそれを意図的に選んだ（見えないものを黙って落とさないため）が、**「解除する導線を将来作るか」は画面の判断であり設計卓の手番である。**

---

*以上、M23-08 完了報告。5 つの DELETE 文より、`fk_off` の枝を持つテストのほうが価値がある——破壊確認 1 で `fk_on` が緑のまま通ったことが、それを実証した。*

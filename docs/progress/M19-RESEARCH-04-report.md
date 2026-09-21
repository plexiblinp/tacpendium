# M19-RESEARCH-04 調査報告: 新列（M19-04）の CSV → DB 流通経路と backfill 母数の実態

| 項目 | 内容 |
|------|------|
| 文書ID | M19-RESEARCH-04-report |
| バージョン | 1.0.0 |
| 指示書 | `docs/instructions/M19-RESEARCH-04-csv-new-column-distribution.md` v1.0.0 |
| 調査日 | 2026-07-31 |
| 調査基準 | リポジトリ commit `06c9175`（**実測時の HEAD**・2026-07-31 時点、ブランチ `claude/m19-04-csv-backfill-research-nf4xwt`＝main 同等。本レポート自体の commit は含まない） |
| 使用 DB | **`<scratchpad>/dbtool/research.db`**（クラウド調査環境に既存 DB が無いため、`migrations/000001`〜`000042` の up SQL を連番順に新規 SQLite へ直接適用して構築した使い捨て DB。golang-migrate 経由ではないため `schema_migrations` 表は無いが、データ内容は clean 配布 DB と同一系譜。**`~/.local/share/combomgr/combomgr.db`（開発者 dev DB）・`m19-verify.db` は本環境に存在せず未参照**） |
| seed 済みキャラ（実測） | **攻撃技 seed 済み＝10 キャラ**: terry / guile / lily / ingrid / kimberly / juri / ken / mai / zangief（以上 9＝マイグレ 000026）＋ ryu（000030）。characters の残り 2 行＝**c_viper / dhalsim は移動 system move（000025）のみの仮登録**で攻撃技 0 行（D-3） |
| read-only | 遵守（リポジトリへの書き込みは本レポートと指示書配置のみ。コード・マイグレ・seed・CSV・テスト変更ゼロ） |

> 集計値の単位・基準時点: 特記なき限り「上記スクラッチ DB（マイグレ 000001〜000042 適用後）の行数」「commit `06c9175` のファイル内容」を数えた値である。開発者 dev DB のランタイム操作履歴（画面18 編集・旧 FR704 取込等）は本 DB に含まれない。

---

## 結論サマリ（先に答え）

1. **D-4: `M19-DESIGN-07` §4-1 の母数 640 / 156 / 約148 は実測と完全一致**（`is_derived=0`＝**640**・`rush_variant`＝**156**・残り＝**148**。moves 全 944 行）。
2. **D-3 / D-5: c_viper / dhalsim は moves 0 行ではない。各 9 行（計 18 行）持ち、全て 000025 由来の移動 system move（フレーム全 NULL）**。手入力 CSV 由来の攻撃技は 0 行。**この 18 行は D-4 の非派生 640 行に含まれる**（rush 156 / 残り148 には 0 行）。
3. **D-7: 「10 / 12 / 15」の食い違いは解消**——**12**＝`characters` 全行数（`jump_*` 行は 000025 が全キャラへ投入するため 12 キャラ全員が持つ）、**10**＝攻撃技 seed 済みキャラ数（＝`jump_*` の `total` が非 NULL のキャラ数、000041 の backfill 対象）、**15**＝DB のどの実値とも一致しない（repo 内 CSV ファイル数 15 とは一致する）。
4. **C-2: 既存 DB への「CSV 再取込（upsert）」という機構は現行コードに存在しない**。CSV の値が DB に届く経路は「コミット済みマイグレの新規 DB への初回適用」と「新連番マイグレの追加」の 2 形態のみ（ランタイム取込ゼロ・seedgen は SQL ファイル生成のみで DB 非接触）。
5. **A: seedgen の moves INSERT は 12 列固定**。新列を出力すると golden（000026/000030 の byte-identical）と単体テスト 2 本が壊れ、かつ**生成物マイグレが新列 DDL より前の連番で実行されて `no such column` になる**——M18-01 v0.2.0 の撤回理由 3 点が一次記録として現存し、**同じ壁は今回もそのまま存在する**（000026/000030/000034/000035 は 000043 以降より前に実行される）。
6. **E: 手入力 CSV は 15 ファイル全てが同一の 20 列ヘッダで、`internal/seedgen/model.go` の `csvColumns` と完全一致**。パーサは**列数固定＋ヘッダ名・順序の厳密一致**のため、**列を 1 本でも足すと `csvColumns` を更新しない限り全ファイルのパースが即 fail する**（同時に golden 4 stem のテストも入力読取り段階で fail する）。

---

## A. seedgen と golden の固定範囲

### A-1. moves INSERT の出力列（全数）

**実態**: 生成関数は `writeMovesInsert`（`internal/seedgen/generate.go:191-219`、呼出元 `GenerateWithHeader` 同 `:78`）。INSERT 対象は以下の **12 列**（`generate.go:192` の実 SQL より）:

```
character_id, code, category, damage, startup, active, total, on_hit, on_block, recovery, is_aerial, raw_data
```

- `original_move_code` は INSERT 列ではなく、別文 `writeOriginalMoveIDUpdate`（`generate.go:231-252`）が `UPDATE moves SET original_move_id = ...` で code から解決して投入する。
- `name_ja` は moves でなく `preset_aliases` へ（`writeAliasInsert`、`generate.go:254-277`）。
- `notes` / `notes_tool` は `raw_data` JSON へ合成（`rawDataSQL`、`generate.go:333-343`）。

**CSV に存在するが INSERT に出していない列**（5 列）と理由コメント（原文）:

| 列 | 理由コメント（`internal/seedgen/model.go`） |
|---|---|
| `is_projectile` | `:59`「保全のみ・SQL 非投入。列は 000039 で追加済・初期値は同マイグレの backfill で投入(M18-01 G-b)」 |
| `is_derived` | `:60`「索引フィルタ用・SQL 非投入(恒久配置は M17-02 G-k)」 |
| `command` | `:64`「索引源・SQL 非投入」 |
| `condition_ja` | `:65`「保全のみ・SQL 非投入」 |
| `condition_en` | `:66`「保全のみ・SQL 非投入」 |

パッケージコメント（`model.go:9-11`）にも「`raw_data` は notes/notes_tool のみ(空→NULL)。command/condition_* は列が無く投入しない(CSV 原本で保全)。is_projectile は列 000039 で追加済だが seedgen は SQL 非投入のまま＝初期値は 000039 の backfill で投入(is_derived と同型・M18-01 §4.4)」とある。

### A-2. golden が byte-identical で固定している生成物（全数）

| テスト | ファイル | 対象マイグレ | 再生成コマンド |
|---|---|---|---|
| `TestGolden_CommittedMigrationMatchesRegeneration` | `internal/seedgen/generate_test.go:162-190` | **000026** up/down | `go run ./cmd/seedgen` |
| `TestGolden_RyuMigrationMatchesRegeneration` | `generate_test.go:199-222` | **000030** up/down | `go run ./cmd/seedgen -chars ryu -out 000030_seed_moves_ryu -note "<ryuMigrationNote>"` |
| `TestGolden_DerivedBackfillMatchesRegeneration` | `internal/seedgen/generate_m1702_test.go:142-149` | **000034** up/down | `go run ./cmd/seedgen -mode derived-backfill -chars terry,guile,lily,ingrid,kimberly,juri,ken,mai,zangief,ryu -out 000034_backfill_moves_is_derived -note "<backfillMigrationNote>"` |
| `TestGolden_MoveCommandsMatchesRegeneration` | `generate_m1702_test.go:156-163` | **000035** up/down | `go run ./cmd/seedgen -mode move-commands -chars（同上 10 キャラ）-out 000035_seed_move_commands -note "<moveCommandsMigrationNote>"` |

補助ゲート: `cmd/seedgen -check`（`cmd/seedgen/main.go:117-131`、生成物と disk の差分検査）。golden ではないが出力形を固定するテストが 2 本ある——`TestGenerate_RemapAndRawData`（`generate_test.go:31`、INSERT 列並びの**完全文字列一致**を断定）と `TestGenerate_IsProjectileNotEmitted`（`generate_test.go:52-69`、up/down に `is_projectile` が**現れないこと**を断定）。

**契約・正典との差**: 前提事実 2 は「000026 が byte-identical」とするが、実態は **000026 / 000030 / 000034 / 000035 の 4 stem（up/down 計 8 ファイル）**が固定されている。

### A-3. 新列を出力させた場合に壊れる golden

コード読解による特定（実際には壊していない）:

- **moves INSERT へ新列を足す**（`writeMovesInsert` 変更）→ **000026・000030 の golden が両方壊れる**（いずれも `Generate`/`GenerateWithHeader` → `writeMovesInsert` を通るため）。加えて `TestGenerate_RemapAndRawData`（列並びの完全一致断定）が壊れる。000034 / 000035 の golden は `writeMovesInsert` を通らないため**この変更だけでは壊れない**。
- **CSV に列を足す**（E-3 参照）→ `csvColumns`（20 列固定）とヘッダ厳密一致検査により `ReadFile` が fail し、**4 stem 全ての golden テストが入力読取り段階で fail する**（`character_data/*.csv` を実読して再生成するため）。`csvColumns` へ新列を追記して読めるようにした場合、**出力を変えない限り生成物は不変**＝golden は green のまま（読取りと出力が分離されているため）。
- **壊れないケースは無いか**: 「CSV へ列追加＋`csvColumns` 追記＋SQL 非出力（保全のみ）」の組合せであれば、**壊れる golden は無い**（is_projectile / is_derived / command / condition_* が現にこの形で共存している）。

**テスト以外の制約（テスト読解で判明した実行時制約）**: golden を再生成して新列入り 000026/000030 を作った場合でも、**000026/000030 は新列 DDL（000043 以降）より前の連番で実行されるため、新規 DB への適用が `no such column` で失敗する**（`generate_test.go:48-51` コメント・A-4 の一次記録どおり）。これはテストでなくマイグレ実行順序の制約である。

### A-4. is_projectile を seedgen 出力にしなかった判断の一次記録

**見つかった。最も明確な一次記録は指示書の改訂註記**——`docs/instructions/phase3/M18-01-schema-foundation.md:23`（v0.2.0・2026-07-19）原文:

> 「**設計是正（製造 Plan Mode 実査 §4.4 エスカレーション）**＝is_projectile 投入を **backfill 専用（Option A・is_derived と完全同型）** に確定し、v0.1.3 の「seedgen を is_projectile 出力へ変更」要件を**撤回**（golden byte-identical 比較の失敗／既存マイグレ改変抵触／000026・000030 が 000039 より前に実行され `no such column` で実行不能、の 3 点により成立しない）」

設計側の理解（「golden の byte 比較とマイグレ実行順序」）は**裏取りできた**。ただし一次記録の理由は 2 点でなく **3 点**（「既存マイグレ改変抵触」を含む）。同旨の記録が以下にも現存する:

- コード内コメント: `internal/seedgen/generate_test.go:48-51`「seed INSERT に is_projectile が現れると 000026/000030 は列追加前に実行され no such column で壊れる」
- マイグレヘッダ: `migrations/000039_add_moves_is_projectile.up.sql:5-6`「投入方式は is_derived(000032 ADD + 000034 backfill)と完全同型＝backfill 専用。seedgen の生成 SQL(000026/000030 の moves INSERT)は不変のまま」
- DES-003 §3.3（`docs/design/03-data-model.md:306`）「**初期値は backfill 専用マイグレで投入し `internal/seedgen` は非改変**（seedgen は CSV の is_projectile を保全するのみで INSERT に出力しない＝golden テストで非出力を固定）」
- `docs/handover/followup-backlog.md:131`（`M14-03-is-projectile-backfill`）「**初期値は backfill 専用で `internal/seedgen` は非改変**（#3-rev・2026-07-22 中央確定…）」「**将来の inline 出力（seedgen 版数＋golden 版数対応）は M14-03d/e 着手時の判断**」

**git コミットメッセージは一次記録にならない**: リポジトリ履歴が squash マージ形（例: 000039 の追加は merge commit `4cba725` にのみ現れる）で、`--grep="is_projectile"` / `--grep="M18-01"` とも該当コミット 0 件。

**後続スコープへの含意**: 「seedgen へ新列を出力する」案が M18-01 で当たった壁（golden・既存マイグレ非改変・実行順序）は**3 点とも現存し、今回の 3 新列にそのまま適用される**。他方、「CSV に列を持たせるが SQL 非出力（保全のみ）」は前例 5 列（is_projectile ほか）と同型で golden 無傷。

**推奨（併記・決定しない）**:
- 案 1: is_projectile 前例と同型＝CSV に新 3 列を追加し seedgen は**保全のみ**（SQL 非出力）、DB 値は backfill マイグレで投入。golden 4 stem は `csvColumns` 追記のみで green 維持。
- 案 2: 将来 seed 波（M14-03d/e 以降）用に**新 stem の生成物のみ**新列を inline 出力する新モードを追加（既定 000026/000030 は不変のまま）。followup-backlog:131 の「将来の inline 出力は M14-03d/e 着手時の判断」と接続する。
- 案 3: seedgen 全面版数対応（000026/000030 golden の再固定を含む）。M18-01 が撤回した経路であり、実行順序問題（000026 が新列 DDL より前）の解決策が別途要る。

---

## B. CSV → DB へ値が入る経路の全数

### B-1. moves へ書き込む経路（全数列挙）

非テストコードの `INSERT INTO moves` / `UPDATE moves` / `DELETE FROM moves` は grep 全数で以下のみ（`internal/` `cmd/` 全域、`*_test.go` 除外）:

| # | 経路 | 実体 | 生死 | 根拠 |
|---|---|---|---|---|
| 1 | **マイグレーション** | moves に触れる up マイグレ＝000001(DDL)/000004/000010/000013(DDL)/000016(型)/000017/000018/000019(型)/000022/000025/000026/000028/000029/000030/000032(DDL)/000034/000039(DDL+backfill)/000041 | **生**（ただし適用は「新規 DB への初回適用」または「未適用連番の追加適用」のみ。適用済み連番は再実行されない＝C-2） | `internal/infra/migration/migrate.go:94` `m.Up()`。起動時自動適用 |
| 2 | **seedgen 生成物**（dev/build 専用） | `cmd/seedgen` が `character_data/*.csv` → `migrations/*.sql` を**ファイル生成**（`cmd/seedgen/main.go:133-138` の `os.WriteFile`） | **生**（ただし **DB には一切接続しない**。DB へ届くのは経路 1 を介した間接のみ） | `cmd/seedgen/main.go:1-5`「本体ランタイムからは呼ばれない(取込 FR704 の復活禁止・M14-03b 指示書 §4.1)」 |
| 3 | **ランタイム API: 部分更新** | `PATCH /api/moves/:id` → `UpdateFields`（`internal/repository/move/edit.go:79-142`） | **生** | ルート登録 `internal/api/move/routes.go:15` |
| 4 | **ランタイム API: rush 派生生成** | `POST /api/moves/:id/rush-variant` → `InsertRushVariant`（`internal/repository/move/rush.go:41-78`） | **生** | ルート登録 `routes.go:16` |
| 5 | **ランタイム取込（FR704）** | 存在しない | **塞（消滅）** | B-2 参照。DES-002 §7.5 冒頭「本体は取込画面・取込エンドポイント・取込時正規化…を**持たない**」（CHANGE-055 降格） |
| 6 | **管理用コマンド** | 存在しない（`cmd/` は `combomgr` と `seedgen` の 2 つのみ。debug API は `GET /debug/tables`・`GET /debug/dump/:table` の読取り専用＝`internal/api/debug/routes.go:9-10`） | — | grep 0 件 |
| 7 | **テストヘルパ**（テスト専用） | `internal/api/move/handler_test.go:32,136,138`／`internal/infra/migration/migrate_test.go:744,749` ほか `migrate_m1403c_test.go`・`internal/service/combo/materialize_test.go`・seedgen テスト | テスト実行時のみ（使い捨て DB） | grep 実測 |

補足: コンボ CSV import（`POST /api/import/csv`・`/api/import/csv/preview`、`internal/api/comboio/routes.go:13-14`）は **combos/setups 専用**で moves には書かない（moveir 系 SQL への言及なし）。

### B-2. `/api/import/moves`・`/api/import/moves/preview`

**登録されていない。存在もしない。** `grep -rn "import/moves" internal/ cmd/ web/src/` ＝ **0 件**。したがって upsert 挙動の実コードも存在しない（過去実装は CHANGE-055 の降格で除去済み＝DES-002 §7.5 冒頭注記）。

### B-3. 画面18（moves 編集）経路の対象列と新列の扱い

- DTO: `UpdateMoveRequest`（`internal/api/move/dto.go:109-119`）＝ `total` / `startup` / `active` / `onHit` / `onBlock` / `damage` / `recovery` / `isAerial` / `rawData` の **9 フィールド**（全て pointer、`nil`＝更新しない）。`category` / `code` / `original_move_id` は編集対象外（同 `:107-108` コメント）。
- repository: `UpdateFields`（`edit.go:79-142`）は**指定されたフィールドだけを列挙して SET 句を組み立てる**ホワイトリスト方式。`edit.go:77-78` 原文「**COALESCE は使わず、明示的に指定された列のみ UPDATE する**(combo.UpdateMetadata と同方式)」。
- **新列を足したときの挙動**: 新 3 列は DTO・`UpdateMoveFields`（`internal/repository/move/repository.go:57`）・SET 句ホワイトリストのいずれにも現れないため、**この経路は新列に一切触れない**（素通しでも NULL 潰しでもなく「不干渉」。コード変更しない限り画面18 から新列は読めも書けもしない）。
- **rush 生成経路の挙動**: `insertRushVariantSQL`（`rush.go:19-25`）は **15 列を明示列挙して INSERT** する。新列は列挙されないため **DDL の DEFAULT 値で入る**（元技からのコピーは起きない）。新列に NOT NULL DEFAULT を持たせる案（DESIGN-07 §3: `startup_basis` NOT NULL・`fastest_unreachable` NOT NULL DEFAULT false）なら INSERT 自体は壊れない。`chain_cancel_total`（NULL 可）も NULL で入る。**rush 生成された行に新列の値をどう与えるかは現行コードに規定が無い**（事実指摘）。

**後続スコープへの含意**: 「CSV にも値を持つ」決定（D-36）後も、**ランタイムで CSV が DB に流れ込む経路はゼロ**のまま。新列の DB 投入はマイグレ経由のみで、画面18/rush 生成経路の改修要否は M19-04/05 のスコープ判断に属する。

---

## C. 「CSV 側が空」を上書きにしないための規則の置き場所

### C-1. 「値がある行だけ更新し、空の行は既存値を残す」パターンの実在例（全数）

`COALESCE` / `NULLIF` は moves 系マイグレ・repository に**存在しない**（全 grep: ヒットは `migrations/000022_unify_dash_to_system_move.down.sql:22,36` の `COALESCE(combo_steps.modifiers, '{}')` 等 combos 系のみ。Go 側は「COALESCE は使わず」のコメント 2 箇所＝`edit.go:78`・`internal/repository/combo/repository.go:670`）。既存パターンは次の 3 型:

1. **「値を持つ code だけを列挙して UPDATE」型**（is_derived / is_projectile / movement total の 3 backfill が全てこれ）。`internal/seedgen/generate_m1702.go:24-25`（`BackfillHeader` の生成ヘッダ原文）:
   > 「CSV で is_derived=true の code のみ UPDATE する(触れない行は既定値 false のまま正しく振る舞う＝ユーザー生成行〔画面18 追加・rush-variant 生成〕に触れない。CHANGE-069 §2.1-d/-e)」

   実 SQL 例（`migrations/000039_add_moves_is_projectile.up.sql`）:
   ```sql
   UPDATE moves SET is_projectile = 1
   WHERE character_id IN (SELECT c.id FROM characters c WHERE c.code = 'terry' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6'))
     AND code IN ('power_wave_light', 'power_wave_medium', 'power_wave_od', 'sa2_power_geyser');
   ```
2. **`WHERE ... IS NOT NULL` 条件付き UPDATE 型**（`migrations/000018_cleanup_moves_unobservable_columns.up.sql:41-57`）:
   ```sql
   UPDATE moves SET raw_data = json_remove(raw_data, '$.command', ...)
   WHERE raw_data IS NOT NULL;
   ```
3. **`NOT EXISTS` ガード付き INSERT（冪等）型**（`migrations/000025` ヘッダ「冪等性: NOT EXISTS ガードで既存行はスキップする」）。

Go ランタイム側は「**nil フィールドは SET 句に載せない**」ホワイトリスト型（`edit.go`）が唯一の部分更新実装。

**含意**: 「CSV 空欄→既存値保全」を実現する規則の置き場所として、実在する前例は (a) 生成器側で「値のある行だけを UPDATE 文に列挙する」（seedgen backfill 3 例）、(b) SQL 側の `WHERE ... IS NOT NULL`、の 2 箇所。COALESCE マージの前例は無い。

**推奨（併記）**: 案 1＝backfill 3 例と同型（生成器が非空行のみ列挙）。案 2＝SQL 側条件（`WHERE` / `COALESCE`）で防御。案 3＝両方（生成器列挙＋SQL 防御の二重化）。

### C-2. 「CSV 再取込」が既存 DB に対して起こるか（★契約 F-4 の前提）

**起こらない（現行機構には存在しない）。** 根拠:

1. ランタイムのマイグレ適用は `m.Up()` のみ（`internal/infra/migration/migrate.go:94`。「既に最新まで適用済みなら no-op として正常終了する(migrate.ErrNoChange を吸収)」＝同 `:26-27` コメント）。golang-migrate は `schema_migrations` のバージョン番号で管理するため、**適用済み連番のファイル内容を後から書き換えても既存 DB では再実行されない**。
2. ランタイムに moves 取込エンドポイントは無い（B-2＝0 件）。
3. `cmd/seedgen` は SQL **ファイル**を書くだけで DB に接続しない（`main.go` に DB 接続コードなし）。
4. 全マイグレ適用（＝CSV 由来 seed の全量投入）が起こるのは**新規 DB**のみ: 利用者の初回起動・`dbtest.Setup`（`internal/testutil/dbtest/dbtest.go:29` が `migration.Run` を呼ぶ）・E2E の使い捨て DB（CLAUDE.md §5）。
5. 運用文書も同前提: `character_data/seed-progress.md`「**既配布の保護**: `seed_imported=済` のキャラを修正対象に含める場合、コマンドは警告して停止する(**既配布 CSV の変更は後続 UPDATE マイグレ扱いになる**ため)」。

**したがって「CSV 再取込が人手付与値を上書きする」シナリオは、既存 DB に対しては経路自体が無い。** CSV の変更が既存 DB に届く唯一の方法は「**新連番マイグレを新たに書く（生成する）**」ことであり、上書き防止規則はその**新規生成物の側**にしか置き場所が無い（C-1）。

**付随する事実（想定外の発見・矛盾ではないが F-4 議論に直結）**: golden テストは「コミット済み 000026/000030/000034/000035 ＝ 現行 CSV からの再生成」を要求するため、**seed 済みキャラの CSV を編集すると golden が fail し、適用済みマイグレファイルの再生成（書き換え）を強いる**。書き換えても既存 DB には反映されない（上記 1）ため、**「既存 DB」と「その後に作られる新規 DB」の間で seed 値が食い違う状態**が生じ得る。新列の値を CSV に持たせた場合、この分岐が新列にも及ぶ（事実指摘。扱いは要決定事項 #4）。

---

## D. backfill 母数の実測

> 数えた対象＝スクラッチ DB（冒頭表参照）。基準時点＝commit `06c9175`（migrations 000001〜000042）。

### D-1. characters 全行

**12 行**。`id` / `code`: 1 ryu／5 ken／6 ingrid／**7 c_viper**／**8 dhalsim**／9 terry／10 guile／11 lily／12 kimberly／13 juri／14 mai／15 zangief。（id 2〜4 は欠番＝000009 で追加された aki/jamie/guile 系が 000017 で削除された痕跡。guile は 000024 で id 10 として再投入。）

### D-2. キャラごとの moves 行数（moves 全 944 行）

攻撃技 seed 済みは以下の **10 キャラ**（terry / guile / lily / ingrid / kimberly / juri / ken / mai / zangief ＝000026、ryu＝000030）。c_viper / dhalsim の 2 キャラは移動 system move のみ（D-3）。

| code | 行数 | 内訳（category: 行数） |
|---|---|---|
| ryu | 93 | normal 18 / special 27 / unique 5 / super_art 9 / critical_art 1 / throw 2 / system 10 / target_combo 3 / rush_variant 17 / drive_impact 1 |
| ken | 89 | normal 19 / special 34 / unique 4 / super_art 3 / critical_art 1 / throw 2 / system 10 / target_combo 3 / rush_variant 12 / drive_impact 1 |
| ingrid | 100 | normal 18 / special 37 / unique 4 / super_art 7 / critical_art 1 / throw 2 / system 10 / target_combo 4 / rush_variant 16 / drive_impact 1 |
| **c_viper** | **9** | **system 9（移動 9 種のみ）** |
| **dhalsim** | **9** | **system 9（移動 9 種のみ）** |
| terry | 79 | normal 18 / special 21 / unique 1 / super_art 5 / critical_art 1 / throw 2 / system 10 / target_combo 7 / rush_variant 13 / drive_impact 1 |
| guile | 97 | normal 18 / special 29 / unique 7 / super_art 4 / critical_art 1 / throw 4 / system 10 / target_combo 4 / rush_variant 19 / drive_impact 1 |
| lily | 90 | normal 18 / special 30 / unique 4 / super_art 6 / critical_art 1 / throw 2 / system 10 / target_combo 3 / rush_variant 15 / drive_impact 1 |
| kimberly | 104 | normal 18 / special 38 / unique 7 / super_art 5 / critical_art 1 / throw 2 / system 10 / target_combo 7 / rush_variant 15 / drive_impact 1 |
| juri | 82 | normal 19 / special 21 / unique 5 / super_art 5 / critical_art 1 / throw 3 / system 10 / target_combo 1 / rush_variant 16 / drive_impact 1 |
| mai | 105 | normal 18 / special 46 / unique 2 / super_art 7 / critical_art 1 / throw 3 / system 10 / target_combo 3 / rush_variant 14 / drive_impact 1 |
| zangief | 87 | normal 20 / special 13 / unique 8 / super_art 5 / critical_art 1 / throw 6 / system 10 / target_combo 4 / rush_variant 19 / drive_impact 1 |

（seed 済み 10 キャラの system は 10 行＝移動 9 種〔000025〕＋ `drive_parry`〔CSV 経由〕。c_viper/dhalsim は移動 9 種のみで drive_parry すら持たない。）

### D-3. c_viper / dhalsim の実態（前提事実 7 の検証）

- **moves は 0 行ではない**。各 **9 行**（計 18 行）。全行 `category='system'`・code は移動 9 種（`forward`/`back`/`micro_forward`/`micro_back`/`dash_forward`/`dash_back`/`jump_neutral`/`jump_forward`/`jump_back`）・**startup/active/recovery/total 等フレーム列は全て NULL**・`is_derived=0`・`is_projectile=0`。
- **投入マイグレの特定**: characters 行は **000014**（classic5。ヘッダ原文「取込ツール(FR701)の実 CSV は classic 5 体(ryu / ken / ingrid / c_viper / dhalsim)」）。moves 9 行は **000025**（移動 system move を「characters 全行」へ CROSS JOIN 投入）。**手入力 CSV 由来ではない**（`character_data/` に c_viper.csv / dhalsim.csv は存在しない）。000041 は両キャラを明示的に対象外にしている（ヘッダ「c_viper / dhalsim は対象外（仮登録キャラ・攻撃技 0 件で候補生成に寄与しない）＝total は NULL のまま」）。
- **攻撃技を投入・削除したマイグレは存在しない**（migrations 全 grep で c_viper/dhalsim への moves 投入は 000025 のみ）。開発者の記憶「moves は全部削除された状態に見える」は、**マイグレ由来 DB では「攻撃技は一度も入っていない」が正**。旧 FR704 ランタイム取込が dev DB (`~/.local/share/combomgr/combomgr.db`) に残した行の有無は本環境から**未確認**（dev DB 非所持）。

### D-4. `M19-DESIGN-07` §4-1 母数の取り直し

| 母数 | 設計文書 | 実測 | 一致 |
|---|---|---|---|
| `is_derived = false` | 640 | **640** | **一致** |
| `category = 'rush_variant'` | 156 | **156** | **一致** |
| それ以外（`is_derived=1` かつ非 rush） | 約 148 | **148** | **一致** |
| （合計） | — | 944 | — |

キャラ別内訳（非派生 / rush / 残り）: ryu 65/17/11・ken 59/12/18・ingrid 80/16/4・**c_viper 9/0/0**・**dhalsim 9/0/0**・terry 57/13/9・guile 57/19/21・lily 58/15/17・kimberly 64/15/25・juri 57/16/9・mai 59/14/32・zangief 66/19/2。

参考: 非派生 640 の category 内訳＝special 206 / normal 184 / **system 118** / unique 40 / super_art 40 / throw 28 / drive_impact 10 / critical_art 10 / target_combo 4。

### D-5. 各母数への c_viper / dhalsim の混入

- `is_derived=false` 640 行のうち **18 行**（c_viper 9・dhalsim 9。全て移動 system move・フレーム NULL）。
- `rush_variant` 156 行のうち **0 行**。
- 残り 148 行のうち **0 行**。

→ **`startup_basis` の機械付与母数 640 に仮登録キャラの 18 行が含まれる**（事実。DESIGN-07 §4-1 は 640 行を機械で `standalone` にするとしており、この 18 行も含まれる計算になる）。フレームメーター**実測**が要る人手母数（148 行・チェーン系）には **0 行**＝実測作業の無駄は生じない。

### D-6. `jumping_` を含む行数（`fastest_unreachable` C 型の母数）

- **前方一致 `jumping_%`: 63 行**（非派生 61・派生 2〔terry `jumping_lariat` / `jumping_knee`＝target_combo〕）。
- **部分一致 `%jumping_%`: 65 行**＝上記 63 ＋ **`neutral_jumping_heavy_kick` 2 行（juri / ken・normal・非派生）**。この 2 行はボード D-13 の「案C 採用＝増分 2 件（juri / ken）」と一致する。
- キャラ別（部分一致）: ryu 6 / ken 7 / ingrid 6 / terry 8 / guile 6 / lily 6 / kimberly 6 / juri 7 / mai 6 / zangief 7。c_viper / dhalsim は 0。
- DES-004 §2.1 正典の**接頭辞**基準（DESIGN-07 §4-3「code 接頭辞 `jumping_`」）だと 63 行、D-13 案C（neutral_jumping 含む）だと 65 行。**どちらを機械付与の母数とするかで 2 行ずれる**（事実指摘・要決定事項 #6）。

### D-7. `jump_neutral` / `jump_forward` / `jump_back` の total を持つキャラ数（10・12・15 の解消）

実測:

- `jump_*` 3 code の**行を持つ**キャラ: **12**（characters 全行。000025 が全キャラへ投入するため）。
- `jump_*` の **total が非 NULL** のキャラ: **10**（000041 の backfill 対象 10 キャラ。c_viper / dhalsim は NULL）。
- total の実値: 43（ryu/ken/ingrid/terry/guile/kimberly/juri/mai の 8 キャラ）・**44（zangief）・45（lily）**。**キャラ内では 3 方向とも同値**（12 キャラ全数。c_viper/dhalsim は 3 方向とも NULL）。

3 つの数の正体（数えた対象・単位・基準時点つき）:

| 数 | 出所 | 実測との対応 |
|---|---|---|
| **10** | 開発者申告「seed 済み 10」（2026-07-31） | **一致**＝攻撃技 seed 済みキャラ数＝jump total 非 NULL キャラ数＝000041 対象数（基準: 本 DB） |
| **12** | ボード D-13（2026-07-27）「`jump_*` の `total` は 12 キャラ全数一致」 | 「12」は characters 全行数と一致。ただし文言の解釈で成否が分かれる——「**キャラ内で 3 方向の値が一致**」の意なら 12 キャラ全数で成立（NULL 含む）。「**12 キャラ横断で同じ値**」の意なら**不成立**（43/44/45/NULL が混在）。なお followup-backlog:132 の 2026-07-26 是正が「『12 キャラ』の記述はもう正しくない。実体は 10 キャラ × 移動 5 code＝50 行〔c_viper／dhalsim は対象外〕」と既に記録している |
| **15** | `M19-DESIGN-07` §4-2「seed 済み 15 キャラ」（chain_cancel_total 見積りの前提） | **DB のどの実値とも一致しない**（seed 済みは 10）。一致するのは **repo 内 `character_data/*.csv` のファイル数 15**（E-1）のみ。§4-2 の見積り「2〜4 技 × 15 キャラ ≒ 40〜60 件」は、seed 済み 10 で計算し直すと 20〜40 件（事実としての再計算。採否は設計側判断） |

**開発者申告「CSV 作成済み 17」との差**: repo 内 CSV は **15 ファイル**（10 seed 済み＋jamie/luke/m_bison/manon/rashid の 5）。残り 2 の所在は**未確認**（手入力ツール側〔調査対象外〕にある可能性はあるが本調査では確認しない）。

---

## E. 手入力 CSV の列契約

### E-1. ヘッダ実読（全 15 ファイル）

`character_data/*.csv` は **15 ファイル**（guile / ingrid / jamie / juri / ken / kimberly / lily / luke / m_bison / mai / manon / rashid / ryu / terry / zangief）。**全ファイルのヘッダが完全同一**で、順序どおり:

```
character_code, move_code, category, name_ja, startup, active, recovery, total,
on_hit, on_block, damage, is_aerial, is_projectile, is_derived,
notes, notes_tool, original_move_code, command, condition_ja, condition_en
```

**20 列。前提事実 5「20 列」と一致**。ファイル間差分は無い。（なお M14-03b 指示書 §4.1 は執筆当時「**19 列** seed CSV」と記載しており現行 20 列と 1 列ずれる——当時と現在の差分列の特定は文書からは**未確認**。）

### E-2. 列定義の正典

- **コード上の正典は `internal/seedgen/model.go:20-27` の `csvColumns`**（20 列・「CSV 列順(20 列・character_data/*.csv の現行契約)」コメント付き）。`csv.go:30` が列数を、`checkHeader`（`csv.go:60-70`）が**列名・順序の厳密一致**を強制するため、実ファイルと `csvColumns` は機械的に一致が保証される（E-1 で実測一致を確認済み）。
- **DES-002 §7.5 は手入力 CSV の正典ではない**。§7.5 は降格済み FR704（取込ツール `combomgr-importer` / `moves-input-tool` の出力契約）の参照用で、列集合が別物——§7.5 契約は `total` を持たず（「CSVは公式の発生・持続・硬直を保持する（total は持たない）」）、`drive_gauge_increase` 等 4 列・`combo_scaling`・`properties`・`setup_only` を含み、`is_projectile` / `is_derived` / `notes_tool` / `original_move_code` / `condition_ja` / `condition_en` を含まない。**手入力 20 列 CSV の列定義を記した設計書本体（DES）は存在しない**（M14-03b 指示書 §4.1 が「レポート 20260709 §2.2 の現行契約」を参照するのみ）。
- **突合結果**: 「DES-002 §7.5 と seedgen 構造体の両方に正典がある」状況では**ない**。正典はコード側（`csvColumns`）単独で、DES-002 §7.5 は**別契約**（食い違いではなく対象が別）。

### E-3. 列を末尾追加したときのパーサ挙動

**壊れる（即 fail）。列数固定チェック＋ヘッダ名・順序の厳密一致であり、ヘッダ名解決ではない。**

- `csv.go:30` `cr.FieldsPerRecord = len(csvColumns)`＝データ行の列数を 20 に固定（21 列目があると `encoding/csv` が `ErrFieldCount`）。
- `csv.go:61-62`＝ヘッダ列数不一致で `"header has %d columns, want %d"`。
- `csv.go:64-68`＝各位置の列名が `csvColumns` と 1 つでも違えば `"header column %d = %q, want %q"`。
- 各値の参照も**位置番号直書き**（`parseRow` の `g(0)`〜`g(19)`、`csv.go:72-140`）。

したがって CSV へ新列を足す変更は、**`csvColumns`・`parseRow`・`MoveRow` の三点更新が必須**で、更新するまで golden 4 stem のテスト（CSV 実読）も全て fail する（A-3）。逆に三点更新＋SQL 非出力なら golden は不変（A-3）。

### E-4. 複数親（`move_derivations` 相当)の既存表現

**無い。** 親表現を持つ既存列は `original_move_code`（単一値・rush_variant の元技 1 件のみを指す。`isRush()`＝`model.go:76-78`、DB 側は `original_move_id` 単一 FK）だけであり、**1 技が複数の親を持つ関係を表現できる列は CSV に存在しない**。

---

## 想定外の発見・矛盾の事実指摘（§0.3 の記録義務分）

1. **c_viper / dhalsim は moves 0 行ではなく各 9 行**（前提事実 7 の「moves は全部削除された状態」はマイグレ由来 DB では不成立＝攻撃技は一度も入っていない）。この 18 行は `startup_basis` 機械付与の母数 640 に含まれる。
2. **「seed 済み 15 キャラ」（DESIGN-07 §4-2）は実測 10 と不一致**。15 は repo 内 CSV ファイル数とのみ一致。§4-2 の 40〜60 件見積りは前提数が過大。
3. **開発者申告「CSV 作成済み 17」に対し repo 内は 15 ファイル**（差 2 の所在未確認）。
4. **D-13 の「12 キャラ全数一致」は解釈依存**——キャラ内 3 方向一致なら成立、キャラ横断の同値なら不成立（43/44/45/NULL 混在）。followup-backlog:132 は既に「12 キャラ」表記を is-not-correct と是正済み。
5. **golden の固定対象は 000026 だけでなく 4 stem**（000026/000030/000034/000035 の up/down 計 8 ファイル）。
6. **M14-03b §4.1 の「19 列」表記は現行 20 列と不一致**（歴史的記述）。
7. **git コミット履歴は squash されており、M18-01 判断の一次記録はコミットメッセージに存在しない**（指示書改訂註記・コード内コメント・マイグレヘッダ・DES-003 §3.3 が現存する一次記録）。
8. **seed 済みキャラの CSV を編集すると golden fail → 適用済みマイグレの再生成を強いる構造**があり、再生成しても既存 DB には反映されない（既存 DB と新規 DB の seed 値分岐が起き得る。C-2 付随事実）。

---

## M19-04 スコープ確定のための要決定事項

1. **新列の CSV / seedgen での扱い方式**（A-4 推奨の案 1〜3 併記参照）: (a) CSV 追加＋seedgen 保全のみ（is_projectile 同型・golden 無傷）、(b) 保全＋将来 seed 波の新 stem のみ inline 出力、(c) seedgen 全面版数対応（M18-01 撤回経路の再挑戦・実行順序問題の解決込み）。**CSV に「値を持つ」だけなら (a) で成立し、DB への反映は backfill マイグレが担う**——「CSV に持つ」の実装上の意味の確定が必要。
2. **CSV へ列を足す場合の三点更新**（`csvColumns` / `parseRow` / `MoveRow`）と、それに伴う **M14-03c §4.3.1 の 3 条件（I/O 境界のみ）の解釈**——列定義変更は「変換規則」に触るか否かの裁定（E-3・A-3）。
3. **契約 F-4 の書き換え内容**（D-36 帰結「upsert の列単位マージ規則の設計」）: C-2 実測により**既存 DB への CSV 再取込機構は存在しない**ため、マージ規則の置き場所は「将来書かれる新連番 UPDATE マイグレの生成規則」（C-1 の 3 型のいずれか）に限定される。F-4 を「経路が無いことの維持」とするか「将来の再取込マイグレ生成規則」とするかの確定。
4. **CSV 編集⇔golden⇔適用済みマイグレ再生成の運用規則**（発見 8）: seed 済みキャラの CSV に新列値を書き込むと golden が fail する。000026/000030/000034/000035 を再生成して受け入れるか（既存 DB と新規 DB の分岐を許容）、CSV 側の新列充填を seed 済みキャラでは行わないか、golden の要求を変えるか。
5. **`startup_basis` 機械付与母数 640 に含まれる c_viper / dhalsim の 18 行（移動 system move・フレーム NULL）の扱い**: 機械 `standalone` に含めるか、仮登録キャラとして除外するか（000041 は明示除外の前例）。
6. **`fastest_unreachable` C 型の母数の基準**: 接頭辞 `jumping_%`（63 行・うち派生 2）か、D-13 案C の部分一致（65 行＝`neutral_jumping_heavy_kick` 2 行を含む）か。派生 2 行（terry の target_combo）を含めるかも併せて要確定。
7. **`chain_cancel_total` の人手実測の対象キャラ数**: §4-2 の「15 キャラ」前提は実測 10 と不一致。10 で再見積る（≒20〜40 件）か、未 seed 波を先行込みで計画するか。
8. **rush 生成経路（`insertRushVariantSQL`）の新列の扱い**: 列挙 INSERT のため新列は DEFAULT で入る。rush 生成時に親から `startup_basis`/`chain_cancel_total` 等を引き継ぐ要否は現行コードに規定なし（B-3）。
9. **c_viper / dhalsim の CSV 所在**（開発者申告 17 と repo 15 の差 2）: 手入力ツール側にあるなら、今後の seed 波計画（母数・backfill 申し送り）に影響する。所在確認は本調査スコープ外のため未確認のまま残す。

---

*以上、M19-RESEARCH-04 調査報告 v1.0.0。read-only・judgement-free（推奨欄は複数案併記のみ・決定なし）。*

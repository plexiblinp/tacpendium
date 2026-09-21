# M1-02 レビュー報告書

| 項目 | 内容 |
|------|------|
| レビュー対象 | M1-02(マイグレーション基盤・seed SQL) |
| 対象指示書 | `docs/instructions/M1-02-migrations-and-seed.md` v1.2.0 |
| レビューチェックリスト | `docs/instructions/reviews/M1-02-review-checklist.md` v1.0.0 |
| レビュー日 | 2026-04-30 |
| レビュー担当 | 品質レビュー Claude(Sonnet 4.6) |
| 対象コミット範囲 | feature/m1-core-foundation 上の作業ツリー(未コミット差分含む) |

---

## 総評

M1-02 の成果物は全13テーブルの DDL・インデックス・seed・down.sql・Go インフラ層・モデル・テストを概ね高品質で実装している。CHANGE-001/CHANGE-003/CHANGE-006 の反映が DDL・モデル・テストにわたって一貫しており、特に CHANGE-006 (`counter_type → hit_type`) の徹底ぶりは評価に値する。embed.FS をプロジェクトルートに置いた判断も Go の仕様制約に沿った正しい選択。一方、`migrate.go` の defer 順序に由来する「source の二重 Close」リスク、指示書 §4.4 が要求する `preset_aliases(preset_id, alias_text)` インデックスの未実装、および DES-003 §3.3 に記載のない `moves.name_ja / name_en` カラム追加(指示書が要求しているため機能的に正しいが設計書との齟齬)の3点が主な指摘事項。いずれも M1-03 の CRUD API 実装に直接の支障はないが、defer バグは本番で稀に握り潰しエラーを生む可能性があるため優先度を高とする。

---

## 設計準拠性レビュー結果

| チェック項目 | 結果 | 詳細 |
|-------------|------|------|
| DES-003 §3.1〜§3.13 全13テーブル作成 | ◎ | games / characters / moves / combos / combo_steps / tags / combo_tags / presets / preset_aliases / users / setups / setup_steps / combo_setups の全13テーブルが `000001_init_schema.up.sql` に存在する。 |
| DES-003 §3.4 combos 起き攻め BOOLEAN 6カラム(CHANGE-001) | ◎ | `oki_meaty_neutral_tech_throw` / `oki_meaty_neutral_tech_throw_dr` / `oki_meaty_back_tech_throw` / `oki_meaty_back_tech_throw_dr` / `oki_shimmy_neutral_tech` / `oki_shimmy_back_tech` の正確に 6 カラム。DDL コメントに「CHANGE-001 反映、7 ではなく 6」と明記。 |
| DES-003 §3.4 combos `opponent_stance` に `any` 含む(CHANGE-003) | ◎ | DDL コメントに `-- standing/crouching/airborne/any (CHANGE-003)` と明記。`model/combo.go` でも `OpponentStanceAny = "any"` を定数化。 |
| DES-003 §3.4 combos に `version` / `is_draft` / `deleted_at` / `recipe_cache` | ◎ | 全4カラム存在。`version INTEGER NOT NULL DEFAULT 1`、`is_draft INTEGER NOT NULL DEFAULT 0`、`deleted_at DATETIME`(NULL可)、`recipe_cache TEXT`(JSON)。DES-003 の設計意図に沿った実装。 |
| DES-003 §3.5 combo_steps の `modifiers` が JSON 文字列カラム | ◎ | `modifiers TEXT -- JSON: {flags:[],type:"",notes:""}` で TEXT 型。`model/combo.go` の `Modifiers` 構造体とリポジトリ層での json.Marshal/Unmarshal 変換方針も適切。 |
| DES-003 §4 インデックス | △ | DES-003 §4 に定義されたインデックスは全て実装済み。ただし指示書 §4.4 が追加要求している `preset_aliases(preset_id, alias_text)` インデックスが未実装(詳細は「推奨修正・中」参照)。 |
| SUPP-001 §2.7 `golang-migrate v4` + `iofs` + `embed.FS` | ◎ | `go.mod` に `github.com/golang-migrate/migrate/v4 v4.19.1` 追加済み。`embed_migrations.go`(ルート) + `internal/infra/migration/migrate.go` が `iofs.New(fs, "migrations")` + `migrate.NewWithSourceInstance("iofs", ...)` で実装。パス制約(`..` 不可)への対処としてルートに embed ファイルを置く判断は正しく、ファイルの godoc でも理由を明記している。 |
| SUPP-001 §3.1 リュウ1キャラのみ投入 | ◎ | `000003_seed_characters.up.sql` で `code = 'ryu'` 1件のみ。他キャラの混入なし。 |
| SUPP-001 §3.4 プリセット5種レコード作成・`official_ja_move` のみエイリアス投入 | ◎ | `000005_seed_presets.up.sql` で5種すべて `is_builtin=1`・`user_id=NULL` で投入。`000006_seed_aliases_official_ja_move.up.sql` で `official_ja_move` のみエイリアスを `moves.name_ja` で投入。他4プリセットのエイリアスは空(SUPP-001 §3.4 設計通り)。 |
| DES-004 §2.1 技 code 命名規則 | ◎ | 確認した全技 code がスネークケース英数小文字。`stand_light_punch`(通常技)、`hadoken_light`(必殺技)、`rush_stand_medium_punch`(ラッシュ版)、`sa1_shinku_hadoken`(SA)など全て `DES-004 §2.1` の `<技名>_<強度>` / `rush_<元技code>` / `sa<番号>_<バリエーション>` パターンに沿う。`l`/`m`/`h` 短縮形の不使用も遵守。 |

---

## マイグレーション品質レビュー結果

| チェック項目 | 結果 | 詳細 |
|-------------|------|------|
| up/down ペアの往復整合性 | ◎ | 000001〜000006 の全 12 ファイルが揃っている。down.sql は逆順 DROP TABLE(`IF EXISTS` 付き)、seed の down は `DELETE FROM ... WHERE code = '<code>'` または `WHERE is_builtin = 1 AND code IN (...)` で対象行のみ削除。FK 依存関係(combo_setups→setups→characters→games の逆順)も正しい。 |
| 外部キー制約 | ○ | 全テーブルの FK が正しく宣言されている。`combo_steps / setup_steps` の ON DELETE CASCADE、`combo_tags / combo_setups` のカスケードも適切。**ただし** `tags` テーブルは `users` より前に定義されており、`tags.user_id REFERENCES users(id)` が forward reference になる(SQLite では機能するが、他 DB への移植やレビュー時に混乱を招く。低優先の改善余地)。 |
| WAL / foreign_keys / busy_timeout の DB 接続時設定 | ◎ | `internal/infra/db/db.go::Open()` が PRAGMA journal_mode=WAL / foreign_keys=ON / busy_timeout=5000 / synchronous=NORMAL を順に適用。エラー時はコネクションを Close してエラーを返す。 |
| マイグレーションエラーの slog 記録 | △ | `migrate.go::Run()` 内の進捗は `slog.InfoContext` で出力されるが、`Run()` がエラーを返した場合、`main.go` は `fmt.Errorf("migration: %w", err)` → `run()` のエラーとして `fmt.Fprintf(os.Stderr, "fatal: %v\n", err)` で標準エラー出力のみに書く。指示書 §4.1.2 が示す「slog.Error("migration failed", ...)」のパターンに沿わず、ロガーが開始している段階でもログファイルに migration 失敗が記録されない。 |

### defer 二重 Close リスク(高優先)

`migrate.go` の defer 登録順序に問題がある。

```go
source, err := iofs.New(fs, "migrations")
defer source.Close()          // defer A: 先に登録

m, err := migrate.NewWithSourceInstance(...)
defer func() {               // defer B: 後に登録
    _, dbErr := m.Close()    // golang-migrate が source と database を両方 Close する
}()
```

Go の defer は LIFO のため、**B(m.Close)が先に実行**され source を Close した後、**A(source.Close)が再び実行**される。`m.Close()` は内部で source driver の Close を呼ぶため、source.Close が二重呼出しになる可能性がある。

コードのコメントに「Source 側の Close は上で既に行っているため」とあるが、実際は逆順で実行されるため記述が誤り。`iofs` の Close が冪等なら実害はないが、明示的に二重 Close を発生させる設計は危険。

**修正案**: `defer source.Close()` を削除し、`m.Close()` に一本化する(または defer の登録順序を意図的に逆にして source → m の順で Close する)。

---

## Go コード品質レビュー結果

| チェック項目 | 結果 | 詳細 |
|-------------|------|------|
| エラーラップ `fmt.Errorf("...: %w", err)` | ◎ | `db.go`、`migrate.go`、`main.go` の全エラーパスで `%w` 形式のラップを徹底。 |
| `context.Context` を引数に受ける | ◎ | `migration.Run(ctx context.Context, ...)` ✓。`slog.InfoContext(ctx, ...)` での文脈付きログも適切。 |
| 公開型の godoc コメント | ◎ | `Open`、`ResolveDBPath`、`Run`、全 model 構造体(`Game`/`Character`/`Move`/`Combo` 等)に godoc 記載あり。`Combo` の godoc は CHANGE-001/CHANGE-006 への言及まで含む。 |
| `panic` の不使用 | ◎ | 実装ファイル全体で `panic` 呼出しなし。 |

### モデル品質の追加所見

- `user.go` の `PasswordHash *string` が `json:"-"` で確実に API 応答から除外されている。セキュリティ上重要。
- `Modifiers` 構造体 (`model/combo.go`) が型安全な struct として定義され、DB の生 JSON ↔ Go struct 変換をリポジトリ層で行う「案 B」方針が `doc.go` に明記。後続 M1-03 での実装指針が明確。
- `Setup.Steps []SetupStep` と `Combo.Steps []ComboStep` の nil = 未ロード規約が `doc.go` と各 godoc に記載され、一覧 API と詳細 API で挙動を変える設計が表現されている。

---

## 完成度レビュー結果

| チェック項目 | 結果 | 詳細 |
|-------------|------|------|
| `make run-server` 起動時に自動マイグレーション | ○ | `main.go` の起動シーケンスで `migration.Run()` が DB Open より前に呼ばれ、未適用分のみ適用される構造。コードレビュー上は起動可能と判断。実機検証は別途。 |
| 2回目起動で no-op | ◎ | `migrate.go::Run()` が `errors.Is(err, migrate.ErrNoChange)` を吸収し正常終了する実装。 |
| DB ファイルパスの OS 別解決 | ◎ | `ResolveDBPath` が Windows(`%APPDATA%`)・macOS(`~/Library/Application Support`)・Linux(`$XDG_DATA_HOME` または `~/.local/share`)を個別に実装。`os.UserConfigDir()` が Linux で `~/.config` を返す問題を回避している旨もコメントで説明。 |
| `make test` 全通過の可否 | ○ | コードレビュー上は通過可能と判断。実機での `go test ./...` 実行結果は別途確認が必要。 |

---

## 禁止事項違反の有無

| チェック項目 | 結果 | 詳細 |
|-------------|------|------|
| DB 破壊的操作(DOWN SQL 以外) | ◎ | down.sql は全て `DROP TABLE IF EXISTS` または `DELETE FROM ... WHERE` で限定削除。up.sql に `DROP TABLE` や `TRUNCATE` なし。 |
| localStorage 等のフロント禁止 API | ◎ | 本指示書は Go 側中心。フロント変更なし。 |

---

## テスト網羅性

| チェック項目 | 結果 | 詳細 |
|-------------|------|------|
| `db_test.go` WAL / foreign_keys 確認 | ◎ | `TestOpen_AppliesPragmas` で WAL・foreign_keys=1・busy_timeout=5000・synchronous=1(NORMAL) を PRAGMA 問合せで確認。親ディレクトリ自動作成(`TestOpen_CreatesParentDir`)・空パスエラー(`TestOpen_EmptyPath`)も検証。 |
| `migrate_test.go` 冪等性確認 | ◎ | `TestRun_FirstAndIdempotent` で初回 Run + 二回目 Run をともに error nil で確認。 |
| `migrate_test.go` テーブル存在確認 | ◎ | `TestRun_AllTablesExist` で全13テーブルを `sqlite_master` で確認。 |
| `migrate_test.go` seed データ確認 | ◎ | `TestRun_SeedRowCounts` で games(1)・characters(ryu 1)・moves(>=30)・SA3(=3)・presets(5, is_builtin=5)・preset_aliases(>=30, official_ja_move のみ)・numeric_ja エイリアス=0 を検証。 |
| `migrate_test.go` CHANGE-006 hit_type 確認 | ◎ | `TestRun_HitTypeColumnExists` で `hit_type` の存在と `counter_type` の不存在を PRAGMA table_info で確認。CHANGE-006 への対処に専用テストケースが存在するのは好印象。 |
| `migrate_test.go` rush_variant original_move_id | ◎ | `TestRun_RushVariantOriginalMoveID` で `rush_stand_medium_punch` の `original_move_id` が `stand_medium_punch` を参照していることを JOIN クエリで確認。 |

---

## 設計準拠性以外の指摘事項

### moves テーブルに DES-003 非掲載の name_ja / name_en カラムが追加されている

DES-003 §3.3 の `moves` テーブル定義に `name_ja` / `name_en` は記載されていない。しかし指示書 §4.6.3 の seed SQL サンプルと §4.6.5 の `m.name_ja` 参照により、指示書として暗黙的に追加が要求されており、実装もその通り。

**機能的には正しいが、DES-003 と実装スキーマの齟齬として CHANGE-XXX 設計変更通知書の発行が必要**。後続指示書(M1-03 以降)のモデル参照時の混乱を防ぐため、DES-003 §3.3 に `name_ja TEXT NOT NULL` / `name_en TEXT NOT NULL` を追記してもらう必要がある。

### tags テーブル定義 order の forward reference

`tags` テーブルが `users` テーブルより先に定義されているため、`REFERENCES users(id)` が forward reference になる。SQLite は CREATE TABLE 時に参照先テーブルの存在を検証しないため実害はないが、

1. `PRAGMA foreign_keys = ON` + INSERT/UPDATE 時はランタイムで解決されるため問題なし
2. ただし PostgreSQL や MySQL へ移植した場合は DDL 実行エラーになる
3. 可読性・保守性の観点で create 順を論理的な依存順にするのが慣習

`users` テーブルは `tags`、`presets`、`combos(未直接参照)` から参照されるため、`users` を他テーブルより前(または少なくとも `tags` より前)に移動する修正を将来検討。

---

## 推奨修正(優先度別)

### 高(M1-03 着手前に修正必須)

1. **`migrate.go` の defer 二重 Close バグを修正する**
   - `defer source.Close()` を削除し `m.Close()` のみに一本化する(golang-migrate の `Close()` が source と database の両方を閉じるため)。
   - または `defer source.Close()` を `defer m.Close()` の後に登録することで意図した LIFO 順(source→m)を実現する。
   - 修正後、`slogLogger` のコメント「Source 側の Close は上で既に行っている」も削除または訂正。

### 中(M1-03 着手と並行可)

2. **`preset_aliases(preset_id, alias_text)` インデックスの追加**
   - 指示書 §4.4 が要求するインデックス `CREATE INDEX idx_preset_aliases_preset_alias_text ON preset_aliases(preset_id, alias_text)` が未実装。
   - `000001_init_schema.up.sql` の末尾に追加する。down.sql への追記は不要(DROP TABLE で消えるため)。

3. **migration 失敗時のエラーを slog で記録する**
   - 現在の `main.go` は migration 失敗を `fmt.Fprintf(os.Stderr, ...)` で出力するのみで、ロガー初期化後もログファイルに記録されない。
   - 指示書 §4.1.2 のサンプル通り `slog.ErrorContext(ctx, "migration failed", "err", err)` + `os.Exit(1)` に変更するか、`run()` 内でエラーを `slog.Error` してから return する。

4. **DES-003 §3.3 への設計変更通知書発行(Claude Code の作業外、開発者へ報告)**
   - `moves` に `name_ja`/`name_en` カラムが追加されているが DES-003 未反映。
   - `docs/change-notes/CHANGE-XXX-moves-add-name-columns.md` の作成を開発者に依頼する。

### 低(将来対応)

5. **SQL テーブル定義順序の整理(tags を users 後に移動)**
   - 依存関係の論理的な順序: games → characters → users → moves → presets → tags → combos → ...
   - マイグレーション SQL の可読性向上のため次のスキーマ変更機会に整理。

---

## 良かった点

1. **CHANGE-006 の徹底した一貫適用**: SQL DDL(`hit_type TEXT` + index名)・model(`HitType *string db:"hit_type"` + 定数)・test(`TestRun_HitTypeColumnExists` で旧名の不存在まで検証)の全レイヤーで矛盾なく反映。変更管理の手本。

2. **embed.FS をルートに置いた正しい判断と説明**: Go の `//go:embed` が `..` を含むパスを拒否する仕様制約を正確に把握し、`embed_migrations.go` をリポジトリルートに配置。ファイルの godoc でその理由も明記しており、後続の開発者が混乱しない。

3. **ラッシュ版技の original_move_id を SQL で動的設定**: `000004_seed_moves_ryu.up.sql` の rush_variant INSERT が、先行 INSERT 済みの通常技を `JOIN moves ... WHERE base.code IN (...)` でサブクエリ参照することで original_move_id を自動設定。ハードコードを避けた堅牢な実装。

4. **migrate_test が豊富かつ具体的**: テーブル存在確認・seed 件数・CHANGE-006・rush variant の foreign key 参照まで網羅。特に numeric_ja エイリアスが 0 件であることを検証するケースは「設計通り空のままであること」を担保しており細やか。

5. **ResolveDBPath が XDG_DATA_HOME を尊重**: Linux の `XDG_DATA_HOME` 環境変数に対応し、`~/.local/share` へのフォールバックも持つ。`os.UserConfigDir()` が `~/.config` を返す問題をコメントで説明した上で手動実装。

6. **PasswordHash の API 露出ゼロ保証**: `user.go` で `json:"-"` タグにより確実に API 応答から除外。誤って JSON 化されるリスクを型レベルで封じている。

7. **Modifiers 型付き struct の設計方針明記**: `doc.go` でリポジトリ層が json.Marshal/Unmarshal を担当する「案 B」を明示し、後続 M1-03 実装者への引き継ぎ情報として機能している。

---

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。`make run-server` 実機起動・マイグレーション完走・`go test ./...` 実行結果は別途実機検証が必要。
- リュウの技マスタの「正確な技構成」(SF6 現行バージョンにおけるリュウの全技の網羅性)は指示書 §9「推測で進めてよい事項」として明示されているため本レビューの対象外とした。技 code の命名形式(DES-004 §2.1)のみ確認した。

---

*以上*

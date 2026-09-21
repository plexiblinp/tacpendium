# 指示書 M1-02: マイグレーション基盤・seed SQL(リュウマスタ)

| 項目 | 内容 |
|------|------|
| 指示書ID | M1-02 |
| バージョン | 1.4.1 |
| 対象マイルストーン | M1(コア基盤) |
| 推奨モデル | **Opus 4.7** |
| Plan Mode | **必須** |
| 機械レビュー | **必須**(別チェックリスト: `docs/instructions/reviews/M1-02-review-checklist.md`) |
| 並列性 | **単独**(M1-03 が依存) |
| 依存指示書 | M1-01 |
| 想定所要時間 | 60〜90分 |
| 作成者 | 詳細設計・製造準備担当Claude |
| 作成日 | 2026-04-29 |

## 更新履歴

| バージョン | 更新日 | 更新内容 |
|-----------|--------|----------|
| 1.0.0 | 2026-04-29 | 初版作成 |
| 1.1.0 | 2026-04-29 | 開発者レビュー反映: §6 のレビュー観点を別ファイル(`docs/instructions/reviews/M1-02-review-checklist.md`)に分離。§3 前提条件に `M1-overview.md` 必読を追加。§9 「リュウの技マスタの正確なリスト」を「推測してはいけない事項」から「推測してよい事項」に変更(SF6現行版に依存し、フェーズ3のパーサーで補正される前提のため)。§9 「不明事項発見時の対応」から「リュウの技構成不明 → 開発者確認」を削除 |
| 1.2.0 | 2026-04-30 | CHANGE-006 反映: §4.7 Combo 構造体例の `counter_type` カラムと `CounterType` フィールド名を `hit_type` / `HitType` にリネーム。マイグレーション SQL の DDL でも `hit_type` カラムとして実装すること(DES-003 §3.4 の CHANGE-006 反映後を参照)。取り得る値は当面 `normal`/`counter`/`punish_counter` の3種維持 |
| 1.3.0 | 2026-04-30 | M1-02 レビュー指摘反映: 指示書に DES-003 にないカラム/インデックスが含まれていた問題を修正。§4.4 インデックスを DES-003 §4 通りに(`(preset_id, alias_text)` 削除、`(starter_move_id)`、`(position, opponent_stance, hit_type)`、`(combo_steps の combo_id, step_order)`、`combo_setups` などを正確に列挙)。§4.6.1 games から `created_at`/`updated_at` 削除(DES-003 §3.1 にカラムなし)。§4.6.2 characters から同上削除(DES-003 §3.2)。§4.6.3 moves から `name_ja`/`name_en` 列を全削除(DES-003 §3.3 で技名はエイリアス機構で管理する設計、DES-004 §1.2)。§4.6.4 presets から `code`/`name_ja`/`name_en` 削除し、DES-003 §3.8 通りの `name`/`base_preset_code`/`is_builtin`/`user_id` 構造に修正、DES-004 のプリセットコード参照は `name` 文字列ベースで運用する旨を注記。§4.6.5 エイリアス投入を CASE 式または個別 INSERT 方式に変更(`m.name_ja` 参照不可のため) |
| 1.4.0 | 2026-04-30 | CHANGE-007 反映: presets テーブルに `code`(TEXT UNIQUE NOT NULL)カラム追加に伴う修正。§4.6.4 presets seed の INSERT 文に `code` カラムの値(`official_ja_move`、`official_ja_command`、`numeric_ja`、`numeric_en`、`srk`)を追加。§4.6.5 preset_aliases seed の WHERE 条件で `name` 参照を `code` 参照(`p.code = 'official_ja_move'`)に変更。マイグレーション 000001 の presets テーブル DDL に `code TEXT UNIQUE NOT NULL` カラムを追加すること(DES-003 §3.8 の CHANGE-007 反映後を参照) |
| 1.4.1 | 2026-04-30 | M1-03 実装中の製造担当質問対応で発覚した指示書ミスの修正: §4.7 Combo 構造体例から `Name *string` フィールド削除(DES-003 §3.4 に combos.name カラムが存在しないため)。コンボ識別はキャラ+レシピ+状況で行う設計、ニックネーム用途は memo で代用する旨を注記 |

---

## 1. 背景と目的

### 背景

M1-01 でプロジェクト骨格・基盤が構築された。M1-02 では DB スキーマとマイグレーション基盤を構築し、リュウのキャラ・技マスタを seed SQL として投入する。これにより M1-03(コンボCRUD API) で実装可能なデータ基盤が整う。

### 目的

- DES-003 の全テーブル(13個)のマイグレーション SQL を作成
- `golang-migrate/migrate v4` を `iofs` ドライバで `embed.FS` から読み込む基盤を実装
- アプリ起動時に自動でマイグレーション適用する仕組みを実装
- 初期データ(games、characters、moves、presets、preset_aliases)の seed SQL を作成
- リュウ1キャラのキャラクター・技マスタを完全投入(SUPP-001 §3.1)
- 組み込みプリセット5種をレコードとして投入、`official_ja_move` のみエイリアス完全投入(SUPP-001 §3.4)

### このマイルストーンで作らないもの

- リポジトリ層・サービス層のロジック(M1-03)
- ユーザー・タグ等の動的データ生成(M3、M6)
- recipe_cache の計算ロジック(M1-04)

---

## 2. 成果物

### 2.1 作成するファイル

```
combomgr/
├── migrations/                                                # 新規ディレクトリ
│   ├── 000001_init_schema.up.sql                             # 全13テーブル作成
│   ├── 000001_init_schema.down.sql                           # 全テーブルDROP
│   ├── 000002_seed_games.up.sql                              # games 投入(sf6)
│   ├── 000002_seed_games.down.sql
│   ├── 000003_seed_characters.up.sql                         # characters 投入(リュウのみ)
│   ├── 000003_seed_characters.down.sql
│   ├── 000004_seed_moves_ryu.up.sql                          # リュウの技マスタ
│   ├── 000004_seed_moves_ryu.down.sql
│   ├── 000005_seed_presets.up.sql                            # 組み込みプリセット5種
│   ├── 000005_seed_presets.down.sql
│   ├── 000006_seed_aliases_official_ja_move.up.sql           # official_ja_move エイリアス全投入
│   └── 000006_seed_aliases_official_ja_move.down.sql
├── internal/
│   ├── infra/
│   │   ├── db/
│   │   │   ├── db.go                                         # SQLite接続(WALモード)
│   │   │   └── db_test.go
│   │   └── migration/
│   │       ├── migrate.go                                    # golang-migrate実行
│   │       ├── migrate_test.go
│   │       └── embed.go                                      # embed.FS定義
│   └── model/
│       ├── game.go                                           # Game 構造体
│       ├── character.go                                      # Character 構造体
│       ├── move.go                                           # Move 構造体
│       ├── combo.go                                          # Combo 構造体(combo_stepsを含む構造)
│       ├── tag.go                                            # Tag 構造体
│       ├── preset.go                                         # Preset、PresetAlias 構造体
│       ├── user.go                                           # User 構造体
│       ├── setup.go                                          # Setup、SetupStep、ComboSetup 構造体
│       └── doc.go                                            # パッケージドキュメント
└── cmd/combomgr/
    └── main.go                                               # M1-01から修正(マイグレ起動を組み込み)
```

### 2.2 修正するファイル

- `go.mod` / `go.sum`: `github.com/golang-migrate/migrate/v4` 追加
- `cmd/combomgr/main.go`: 起動フローにマイグレーション実行を組み込む(M1-01 に追記)

### 2.3 変更しないもの

- M1-01 で作成した他のファイル群(設定読込、ロギング、netutil 等)は変更しない

---

## 3. 前提条件

### 必読ドキュメント

- `CLAUDE.md`
- `docs/instructions/M1-overview.md`(M1サブマイルストーン全体マップ、依存関係)
- `docs/design/03-data-model.md` の以下節:
  - **§2** 設計方針
  - **§3.1〜§3.13** 全テーブル定義(13個)
  - **§4** インデックス方針
  - **§5** ER図(参考)
  - **§6** 実装時協同事項(本指示書での仮置き対応)
- `docs/design/supp-001-detailed-design.md` の以下節:
  - **§2.7** マイグレーションツール確定(`golang-migrate/migrate v4`、`iofs`、`embed.FS`)
  - **§3.1** フェーズ1キャラスコープ(リュウのみ)
  - **§3.2** 状況コード値マスタ(初期仮置き、`opponent_stance` に `any` 含む)
  - **§3.3** flagsと非技typeの初期仮置き
  - **§3.4** プリセット初期エイリアス戦略
  - **§3.6** 初期データ投入方式(seed SQL)
- `docs/design/04-notation-spec.md` の以下節:
  - **§2.1** 技のcode命名規則(リュウの技code を生成する根拠)
  - **§5** プリセット定義(組み込み5種)

### 任意参照

- `docs/design/02-architecture.md` §6.2(マイグレーション運用方針)

### 参照不要

- DES-005、DES-006(本指示書では触れない)

---

## 4. 詳細仕様

### 4.1 マイグレーション基盤の実装

#### 4.1.1 `internal/infra/migration/embed.go`

```go
package migration

import "embed"

//go:embed all:../../../migrations/*.sql
var MigrationsFS embed.FS
```

注: 相対パスは Go の `embed.FS` の制約で `migration` パッケージ配下にコピーまたはシンボリックリンクが必要な場合がある。実装時に最適な方法を選ぶ(プロジェクトルートの `migrations/` を直接 embed する方が望ましいので、`internal/infra/migration/` 配下に置くのではなく**プロジェクトルートの `migrations/` を embed する方法**を検討する)。

**推奨実装パターン:**

```go
// プロジェクトルートに migrations.go を置き、cmd/combomgr/main.go から渡す
// または internal/infra/migration/embed.go で相対パスを工夫する
// SUPP-001 §2.7 の例示コードを踏襲する
```

#### 4.1.2 `internal/infra/migration/migrate.go`

```go
// Run はマイグレーションを実行する
// 既に最新なら何もしない
func Run(ctx context.Context, dbPath string, fs embed.FS) error { ... }
```

- `golang-migrate/migrate/v4` の `iofs` ドライバを使用
- DB ドライバは `sqlite`(modernc.org/sqlite に対応)
- ロガー実装(`logger.Logger` インタフェース)で slog にブリッジ

#### 4.1.3 `internal/infra/db/db.go`

```go
// Open は SQLite データベースを開く
// WALモード設定、外部キー有効化、busy_timeout設定を行う
func Open(dbPath string) (*sql.DB, error) { ... }
```

設定する PRAGMA:
- `journal_mode = WAL`
- `foreign_keys = ON`
- `busy_timeout = 5000`(5秒)
- `synchronous = NORMAL`(WAL推奨)

DB ファイルパスのデフォルト解決:
- `cfg.Database.Path` が空文字なら、OS別アプリデータディレクトリを使用
  - Windows: `%APPDATA%/combomgr/combomgr.db`
  - macOS: `~/Library/Application Support/combomgr/combomgr.db`
  - Linux: `~/.local/share/combomgr/combomgr.db`
- 親ディレクトリが存在しなければ作成
- `os.UserConfigDir()` を使うのが楽

### 4.2 main.go の修正

M1-01 で実装した main.go の起動フローに、以下を追加する。

```go
func main() {
    // 1. config.toml 読込(M1-01から)
    // 2. ロギング初期化(M1-01から)

    // 3. DB ファイルパス解決
    dbPath := resolveDBPath(cfg.Database.Path)

    // 4. マイグレーション実行 ← 新規
    if err := migration.Run(context.Background(), dbPath, migration.MigrationsFS); err != nil {
        slog.Error("migration failed", "err", err)
        os.Exit(1)
    }

    // 5. DB 接続オープン ← 新規
    db, err := dbinfra.Open(dbPath)
    if err != nil { /* fatal */ }
    defer db.Close()

    // 6. バインドアドレス決定(M1-01から)
    // 7. CORS許可Origin構築(M1-01から)
    // 8. Echo サーバー初期化(M1-01から)
    // 9. ルート登録(M1-01から、health のみ)
    // 10. 起動(M1-01から)
}
```

### 4.3 全13テーブルのマイグレーション(`000001_init_schema.up.sql`)

DES-003 §3.1〜§3.13 に従って全13テーブルを作成する。

#### テーブル一覧

| # | テーブル名 | DES-003 節 | 主な役割 |
|---|----------|----------|---------|
| 1 | games | §3.1 | ゲームマスタ |
| 2 | characters | §3.2 | キャラクターマスタ |
| 3 | moves | §3.3 | 技マスタ |
| 4 | combos | §3.4 | コンボ |
| 5 | combo_steps | §3.5 | コンボのステップ |
| 6 | tags | §3.6 | タグマスタ |
| 7 | combo_tags | §3.7 | コンボとタグの関連 |
| 8 | presets | §3.8 | 表記プリセット |
| 9 | preset_aliases | §3.9 | プリセット内のエイリアス |
| 10 | users | §3.10 | ユーザー |
| 11 | setups | §3.11 | セットプレイ |
| 12 | setup_steps | §3.12 | セットプレイのステップ |
| 13 | combo_setups | §3.13 | コンボとセットプレイの関連 |

#### 重要な設計準拠項目

- **DES-003 §3.4 combos テーブル**:
  - `opponent_stance` の許容値に `any` を含める(CHANGE-003 反映)
  - 起き攻めBOOLEAN は **6カラム**(CHANGE-001 反映、7カラムではない)
  - `version` カラム(楽観的排他制御)
  - `is_draft`(仮登録フラグ)
  - `deleted_at`(論理削除)
- **DES-003 §3.5 combo_steps テーブル**:
  - `modifiers` は JSON 文字列で保持
- **DES-003 §3.4 recipe_cache カラム**:
  - **本指示書の段階では recipe_cache カラムだけ作る**(計算ロジックはM1-04)
- **DES-003 §3.8 presets テーブル**:
  - `is_builtin` フラグ
  - 全体10件上限(組み込み5+カスタム5、SUPP-001で確定)

### 4.4 インデックスの追加

DES-003 §4 に従って以下を追加(`000001_init_schema.up.sql` 内に含める):

- `combos`: `(character_id, deleted_at)`、`(updated_at)`、`(starter_move_id)`、`(position, opponent_stance, hit_type)`
- `combo_steps`: `(combo_id, step_order)`
- `combo_tags`: `(tag_id)`
- `combo_setups`: `(setup_id)`
- `setups`: `(character_id)`
- `setup_steps`: `(setup_id, step_order)`
- `moves`: `(character_id, category)`
- `preset_aliases`: `(preset_id, move_id)`(UNIQUE制約は DES-003 §3.9 通り)
- 他のテーブルは外部キーがあれば自動インデックスで足りる

DES-003 §4 のインデックス方針を厳密に踏襲する。CHANGE-006 反映後の状況別フィルタは `(position, opponent_stance, hit_type)` の複合インデックスとする。

### 4.5 down.sql の方針

- `000001_init_schema.down.sql`: 全13テーブルを依存関係の逆順で `DROP TABLE`
- seed の down.sql: `DELETE FROM <table> WHERE ...` で対応する行のみ削除

### 4.6 seed SQL 仕様

#### 4.6.1 `000002_seed_games.up.sql`

```sql
INSERT INTO games (code, name_ja, name_en)
VALUES ('sf6', 'ストリートファイター6', 'Street Fighter 6');
```

DES-003 §3.1 通り、4カラム(`id` は AUTOINCREMENT で除外、`code`、`name_ja`、`name_en`)。タイムスタンプカラムは存在しない。

#### 4.6.2 `000003_seed_characters.up.sql`

リュウ1件のみ投入。

```sql
INSERT INTO characters (game_id, code, name_ja, name_en, custom_states)
SELECT id, 'ryu', 'リュウ', 'Ryu', '{}'
FROM games WHERE code = 'sf6';
```

DES-003 §3.2 通り、6カラム(`id` は AUTOINCREMENT で除外)。タイムスタンプカラムは存在しない。`custom_states` は JSON で `{}`(空オブジェクト)。

#### 4.6.3 `000004_seed_moves_ryu.up.sql`(本指示書の中核)

リュウの技を全部 INSERT する。SUPP-001 §3.1 と DES-004 §2.1 を踏まえて以下のカテゴリを網羅する。

**重要: moves テーブルのカラム構成**

DES-003 §3.3 に従い、moves テーブルには `name_ja`/`name_en` カラムは**存在しない**。技の表示名はエイリアス機構(`preset_aliases.alias_text`)で管理する設計(DES-004 §1.2 の方針)。本 seed では:

- moves テーブルへは `code`、`character_id`、`category`、`original_move_id`(ラッシュ版のみ)、`damage`(NULL)、その他フレームデータ系(NULL)を投入
- 日本語表示名(例: 立ち弱P)は **`000006_seed_aliases_official_ja_move.up.sql`(§4.6.5)で `preset_aliases.alias_text` に投入する**
- 英語表示名は本指示書段階では**投入不要**(英語プリセットのエイリアスは空のまま、フェーズ2以降に整備)

**通常技(全18種、code のみ列挙):**

| code | category | 補足(後で alias_text として投入する日本語表示名) |
|------|----------|---------------------------------|
| stand_light_punch | normal | 立ち弱P |
| stand_medium_punch | normal | 立ち中P |
| stand_heavy_punch | normal | 立ち強P |
| stand_light_kick | normal | 立ち弱K |
| stand_medium_kick | normal | 立ち中K |
| stand_heavy_kick | normal | 立ち強K |
| crouch_light_punch | normal | しゃがみ弱P |
| crouch_medium_punch | normal | しゃがみ中P |
| crouch_heavy_punch | normal | しゃがみ強P |
| crouch_light_kick | normal | しゃがみ弱K |
| crouch_medium_kick | normal | しゃがみ中K |
| crouch_heavy_kick | normal | しゃがみ強K |
| jump_light_punch | normal | ジャンプ弱P |
| jump_medium_punch | normal | ジャンプ中P |
| jump_heavy_punch | normal | ジャンプ強P |
| jump_light_kick | normal | ジャンプ弱K |
| jump_medium_kick | normal | ジャンプ中K |
| jump_heavy_kick | normal | ジャンプ強K |

**特殊技(unique カテゴリ):**

- `collar_bone_breaker` (鎖骨割り)
- `solar_plexus_strike` (鳩尾砕き)
- 他、リュウが現在持つ特殊技を Claude Code の知識で妥当な範囲で追加(推測 OK、技 code 命名は DES-004 §2.1 厳守)

**必殺技(special カテゴリ):**

| code | 補足(日本語表示名、後で alias_text 投入) |
|------|------------------|
| hadoken_light | 弱波動拳 |
| hadoken_medium | 中波動拳 |
| hadoken_heavy | 強波動拳 |
| hadoken_od | OD波動拳 |
| shoryuken_light | 弱昇龍拳 |
| shoryuken_medium | 中昇龍拳 |
| shoryuken_heavy | 強昇龍拳 |
| shoryuken_od | OD昇龍拳 |
| tatsumaki_light | 弱竜巻旋風脚 |
| tatsumaki_medium | 中竜巻旋風脚 |
| tatsumaki_heavy | 強竜巻旋風脚 |
| tatsumaki_od | OD竜巻旋風脚 |
| denjin_charge | 電刃練気 |

**SA(super_art カテゴリ):**

| code | 補足(日本語表示名) |
|------|------------------|
| sa1_shinku_hadoken | SA1: 真空波動拳 |
| sa2_shin_shoryuken | SA2: 心・昇龍拳 |
| sa3_denjin_hadoken | SA3: 電刃風神脚(CA) |

**システム技(throw / system / drive_impact カテゴリ):**

| code | category | 補足(日本語表示名) |
|------|----------|------------------|
| forward_throw | throw | 前投げ |
| back_throw | throw | 後ろ投げ |
| drive_impact | drive_impact | ドライブインパクト |
| drive_parry | system | ドライブパリィ |
| dash_forward | system | 前ダッシュ |
| dash_back | system | 後ろダッシュ |
| jump_neutral | system | 垂直ジャンプ |
| jump_forward | system | 前ジャンプ |
| jump_back | system | 後ろジャンプ |
| micro_forward | system | 微歩き(前) |
| micro_back | system | 微歩き(後) |

注: `category` の列挙値は DES-003 §3.3 に従う(`normal`, `special`, `unique`, `super_art`, `throw`, `system`, `target_combo`, `rush_variant`, `drive_impact`)。

**ラッシュ版技(rush_variant カテゴリ、`original_move_id` で対応する通常技を参照):**

| code | original_move_code | 補足(日本語表示名) |
|------|-------------------|------------------|
| rush_stand_medium_punch | stand_medium_punch | ラッシュ立ち中P |
| rush_stand_medium_kick | stand_medium_kick | ラッシュ立ち中K |
| rush_crouch_medium_punch | crouch_medium_punch | ラッシュしゃがみ中P |
| rush_crouch_medium_kick | crouch_medium_kick | ラッシュしゃがみ中K |
| rush_stand_heavy_punch | stand_heavy_punch | ラッシュ立ち強P |
| rush_crouch_heavy_kick | crouch_heavy_kick | ラッシュしゃがみ強K |

`original_move_id` は INSERT 時に当該通常技の id を `(SELECT id FROM moves WHERE character_id = ? AND code = ?)` のサブクエリで解決する。

**INSERT SQL の例(リュウの通常技1件):**

```sql
INSERT INTO moves (character_id, code, category, original_move_id, damage, combo_scaling, drive_gauge_increase, drive_gauge_decrease_punish, super_art_gauge_increase, properties, raw_data)
SELECT
    c.id,
    'stand_light_punch',
    'normal',
    NULL,           -- 通常技なので original_move_id は NULL
    NULL,           -- damage はフェーズ3のパーサーで埋める
    NULL,           -- combo_scaling
    NULL,           -- drive_gauge_increase
    NULL,           -- drive_gauge_decrease_punish
    NULL,           -- super_art_gauge_increase
    NULL,           -- properties
    NULL            -- raw_data
FROM characters c WHERE c.code = 'ryu';
```

**技マスタの正確性について:**

- リュウの技構成は SF6 の現行バージョンによって変動するため、本表の例示は参考値である
- 本プロジェクトでは**フェーズ3のパーサー導入時に技マスタの正確性が補正される前提**(DES-002 §7)
- M1-02 では「動く構造を整えること」が目的のため、Claude Code の知識で妥当な範囲で例示を**追加・調整してよい**(推測 OK)
- ただし、技 code の命名形式(snake_case、DES-004 §2.1)は厳守すること

#### 4.6.4 `000005_seed_presets.up.sql`

組み込みプリセット5種をレコードのみ投入。

**presets テーブルのカラム構成(CHANGE-007 反映後)**

DES-003 §3.8(CHANGE-007 反映後)に従い、presets テーブルは以下のカラム構成:

- `id`(INTEGER PK AUTOINCREMENT)
- `user_id`(INTEGER FK NULL可)
- `code`(TEXT UNIQUE NOT NULL) — **CHANGE-007 で追加**
- `name`(TEXT NOT NULL)
- `base_preset_code`(TEXT NULL可)
- `is_builtin`(BOOLEAN NOT NULL DEFAULT false)

`code` は機械可読な識別子(DES-004 §3.1 で定義された値、`official_ja_move` 等)。`name` は表示用の人間可読な名前。両方を投入する。

```sql
INSERT INTO presets (user_id, code, name, base_preset_code, is_builtin) VALUES
(NULL, 'official_ja_move',    '公式表記(日本語・技名表示)改善版',     NULL, 1),
(NULL, 'official_ja_command', '公式表記(日本語・コマンド表示)改善版', NULL, 1),
(NULL, 'numeric_ja',          'ナンバリング記法(日本語版)',           NULL, 1),
(NULL, 'numeric_en',          'ナンバリング記法(英語版)',             NULL, 1),
(NULL, 'srk',                 'SRK記法',                              NULL, 1);
```

`user_id = NULL` は組み込みプリセットを表す(DES-003 §3.8)。`base_preset_code` は組み込みプリセットでは NULL(カスタムプリセットの作成元参照用カラムのため、組み込みでは使わない)。

#### 4.6.5 `000006_seed_aliases_official_ja_move.up.sql`

`official_ja_move` プリセットに対して、リュウの全技分のエイリアスを投入する。エイリアステキストは技 code に対応する日本語表示名(§4.6.3 の表で明示)を使う。

**実装方針:**

リュウの各技の `code` と日本語表示名のマッピングを SQL 内に直接埋め込み、INSERT する。プリセットは `code = 'official_ja_move'` で参照する(CHANGE-007 反映、`name` 文字列直書きより頑健):

```sql
-- 技ごとに個別 INSERT(可読性優先、製造担当の判断で CASE 式に統合してもよい)
INSERT INTO preset_aliases (preset_id, move_id, alias_text)
SELECT p.id, m.id, '立ち弱P'
FROM presets p, moves m, characters c
WHERE p.code = 'official_ja_move'
  AND m.character_id = c.id AND c.code = 'ryu' AND m.code = 'stand_light_punch';

INSERT INTO preset_aliases (preset_id, move_id, alias_text)
SELECT p.id, m.id, '立ち中P'
FROM presets p, moves m, characters c
WHERE p.code = 'official_ja_move'
  AND m.character_id = c.id AND c.code = 'ryu' AND m.code = 'stand_medium_punch';

-- ... 全技分繰り返し
```

または、CASE 式で1つの INSERT に統合:

```sql
INSERT INTO preset_aliases (preset_id, move_id, alias_text)
SELECT
    p.id,
    m.id,
    CASE m.code
        WHEN 'stand_light_punch'   THEN '立ち弱P'
        WHEN 'stand_medium_punch'  THEN '立ち中P'
        -- ... 全技分を列挙(§4.6.3 の表に対応)
        WHEN 'hadoken_light'       THEN '弱波動拳'
        -- ... 必殺技、SA、システム技、ラッシュ版すべて
        ELSE NULL
    END AS alias_text
FROM presets p
CROSS JOIN moves m
JOIN characters c ON m.character_id = c.id
WHERE p.code = 'official_ja_move'
  AND c.code = 'ryu'
  AND CASE m.code
      WHEN 'stand_light_punch' THEN 1
      WHEN 'stand_medium_punch' THEN 1
      -- ... CASE でマッチした技のみ INSERT
      ELSE 0
  END = 1;
```

実装方法は製造担当の判断で選択してよい(可読性優先)。Plan Mode でアプローチを提示すること。

他4プリセット(`official_ja_command`、`numeric_ja`、`numeric_en`、`srk`)は**エイリアス空のまま**(SUPP-001 §3.4)。フェーズ2以降で順次整備する。

### 4.7 モデル構造体(Go)

`internal/model/` 配下に各テーブルに対応する構造体を定義。フィールド型・タグの方針:

- DB の各カラム型に合致する Go 型(`int64`、`string`、`*string`、`time.Time`、`bool` 等)
- `db:"column_name"` タグ(後続でリポジトリ層が `sqlx` 使用時の準備、M1-02では未使用)
- `json:"camelCase"` タグ(API レスポンス用、後続のハンドラ層が使用)
- NULL 許容カラムは `*T` または `sql.NullX` を使用

例: `internal/model/combo.go`:

```go
type Combo struct {
    ID                int64       `db:"id"                 json:"id"`
    CharacterID       int64       `db:"character_id"       json:"characterId"`
    Damage            *int        `db:"damage"             json:"damage,omitempty"`
    Position          string      `db:"position"           json:"position"`
    OpponentStance    string      `db:"opponent_stance"    json:"opponentStance"`
    HitType           string      `db:"hit_type"           json:"hitType"`
    OpponentSize      string      `db:"opponent_size"      json:"opponentSize"`
    StarterMoveID     *int64      `db:"starter_move_id"    json:"starterMoveId,omitempty"`
    // ... 起き攻めBOOLEAN 6カラム
    DriveAvailableAtStart  *int   `db:"drive_available_at_start"  json:"driveAvailableAtStart,omitempty"`
    SAAvailableAtStart     *int   `db:"sa_available_at_start"     json:"saAvailableAtStart,omitempty"`
    KnockdownAdvantage     *int   `db:"knockdown_advantage"       json:"knockdownAdvantage,omitempty"`
    Memo                   *string `db:"memo"                     json:"memo,omitempty"`
    IsDraft                bool   `db:"is_draft"                  json:"isDraft"`
    Version                int    `db:"version"                   json:"version"`
    DeletedAt              *time.Time `db:"deleted_at"             json:"-"`
    CreatedAt              time.Time `db:"created_at"              json:"createdAt"`
    UpdatedAt              time.Time `db:"updated_at"              json:"updatedAt"`
    RecipeCache            *string `db:"recipe_cache"             json:"-"`  // JSON文字列、M1-04 で扱う
}
```

**注意: combos テーブルに `name` カラムは存在しない**(DES-003 §3.4)。コンボの識別はキャラ + レシピ + 状況で行う設計のため、ニックネーム用途は `memo` で代用する(setups と粒度が違うため設計上分かれている)。

**全13テーブル分の構造体を作る。**ただし`combo_setups`、`combo_tags`等の関連テーブルは構造体不要、または最小限の構造体でよい(リポジトリ層で扱いやすい形に)。

### 4.8 起動時マイグレーションの動作確認

`make run-server` で起動時に以下が起きることを確認する:

1. ロギング初期化
2. DBファイルパス解決(初回はDBファイルが存在しない)
3. **マイグレーション実行**:
   - 初回はテーブル作成 + 全 seed が走る
   - 2回目以降は何もしない(既に最新)
4. DB接続オープン
5. Echoサーバー起動

ログ出力例(slog):

```
INFO migration starting from=0
INFO migration applied version=1 dirty=false
INFO migration applied version=2 dirty=false
...
INFO migration completed up_to_date=true
```

---

## 5. テスト要件

### 必須テスト

#### `internal/infra/db/db_test.go`

- `Open()` の正常系(一時DBファイル作成→PRAGMA確認)
- `journal_mode = WAL` が設定されているか確認
- `foreign_keys = ON` が設定されているか確認

#### `internal/infra/migration/migrate_test.go`

- 初回マイグレーションが成功すること(空のDBに対して全マイグレーション適用)
- 2回目のマイグレーションが冪等であること(no-op)
- マイグレーション適用後、各テーブルが存在すること(`information_schema` 相当のSQLite方言で確認、または `sqlite_master` を参照)
- リュウのキャラクターレコードが投入されていること
- リュウの技が投入されていること(件数 > 30 程度を確認)
- `official_ja_move` プリセットのエイリアスが全技分入っていること

### モデル構造体のテスト

- 構造体の存在と最小限のフィールド構成のみ確認(コンパイル通れば実質OK)
- 別途テストファイル不要、既存の他テストでimport することで検証

---

## 6. レビュー観点(別ファイル参照)

製造担当 Claude は本節を読む必要はない(本節はレビュー担当 Claude が使用するチェックリストへのポインタ)。

レビュー観点は以下の別ファイルに分離されている:

- **`docs/instructions/reviews/M1-02-review-checklist.md`**

レビュー担当 Claude(別ターミナル)は、本指示書(製造担当向け)と上記レビューチェックリストの両方を読み、独立レビューを実施する。製造担当 Claude は本指示書の §1〜§5、§7〜§10 のみを読めば足りる。

---

## 7. 完了条件(Definition of Done)

- [ ] §2 のファイル一覧がすべて作成されている
- [ ] `make run-server` 初回起動時にマイグレーションが完走する
- [ ] 2回目起動時にマイグレーションが no-op で完了する
- [ ] DB に games(1件)、characters(1件 リュウ)、moves(リュウの技、30件以上)、presets(5件)、preset_aliases(リュウの技分、`official_ja_move` のみ)が投入されている
- [ ] `/api/health` が引き続き正常動作する(M1-01の機能を壊していない)
- [ ] `make test` が全通過する
- [ ] §6 のレビュー観点に該当する重大な問題がない
- [ ] Plan Mode で計画提示し、開発者承認後に実装着手した
- [ ] 実装完了後、開発者に「M1-02が完了しました」と報告

---

## 8. 参照ドキュメント

| ID | パス | 参照箇所 |
|----|------|----------|
| CLAUDE.md | `CLAUDE.md` | 全体方針 |
| DES-003 | `docs/design/03-data-model.md` | §2、§3.1〜§3.13、§4、§5、§6 |
| DES-004 | `docs/design/04-notation-spec.md` | §2.1(技code命名)、§5(プリセット定義) |
| SUPP-001 | `docs/design/supp-001-detailed-design.md` | §2.7、§3.1、§3.2、§3.3、§3.4、§3.6 |
| DES-002 | `docs/design/02-architecture.md` | 任意参照: §6.2 |

---

## 9. 注意事項・判断に迷ったら

### 推測で進めてはいけない事項

- 起き攻めBOOLEANの具体的な6カラム名(DES-003 §3.4 を厳密に参照、推測で命名しない)
- カラムのNOT NULL/NULL許容(DES-003 の各テーブル定義を厳密に参照)
- 外部キーのON DELETE/ON UPDATE 動作(DES-003 §3 の各 §で指定があればそれに従う)
- **技 code の命名規則**(DES-004 §2.1 に厳密に従う、snake_case、適切なプレフィックス)

### 推測で進めてよい事項(その旨を明示)

- **リュウの技マスタの正確な技構成**(リュウが現在持つ特殊技・必殺技・SAの網羅性): §4.6.3 の例示を出発点として、Claude Code の知識で妥当な範囲で追加・調整してよい。SF6 の正確な技リストはバージョン依存であり、本プロジェクトでは**フェーズ3のパーサー導入時に補正される前提**(DES-002 §7)。M1-02 の目的は動く構造を整えることであり、技データの正確性は M1-02 では問わない。
  - ただし、技 code の命名形式は DES-004 §2.1 厳守(これは推測しない、上記)
- リュウの技の `description` カラム(あれば)の中身(空文字でよい、後でツール経由で取得)
- ダメージ値・フレームデータ等の詳細(M1-02では`null`で投入、後で公式取り込みツールで埋める)
- インデックス名の命名(`idx_<table>_<columns>` 形式で統一)

### 不明事項発見時の対応

1. テーブル定義の解釈に迷う → DES-003 を再読、それでも不明なら開発者確認
2. マイグレーション失敗の原因不明 → 開発者にエラーメッセージと共に報告
3. 技 code の命名規則で迷う → DES-004 §2.1 を再読、それでも不明なら開発者確認

### Plan Mode で計画提示時に含めるべき項目

- マイグレーション SQL の作成順序
- 全13テーブルそれぞれの主要カラム(リスト形式で簡潔に)
- リュウの技マスタの**カテゴリ別概数**(通常技18、必殺技約13、SA3、システム技約11、ラッシュ版6 等の構造把握、個別技名の全列挙は不要)
- 投入する preset_aliases の件数見込み
- embed.FS のパス指定方針

---

## 10. 完了後の次ステップ

M1-02 完了後、M1-03(コンボCRUD APIとサービス層)に進める。M1-02 のレビューと並行して M1-03 の実装着手も可能(製造+レビュー並列運用)。

---

*以上*

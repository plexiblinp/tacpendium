# 指示書 M8-01: moves フレームデータ列追加マイグレーション(8列)+ model / DTO / GET エンドポイント反映

| 項目 | 内容 |
|------|------|
| 指示書ID | M8-01 |
| バージョン | 1.2.1 |
| 推奨モデル | Sonnet 4.6(加算的マイグレーション + DTO 追従が中心。`total` 算出・properties 正規化は本指示書スコープ外のため複雑度は限定的) |
| Plan Mode | 必須(§3.4 着手前確認 = マイグレーション番号・down.sql 方式・既存 DTO 方式。確認項目 2 件以上のため §8.4 質問書ファイル方式) |
| 機械レビュー | 必須(別チェックリスト: `M8-01-review-checklist.md`) |
| 並列性 | 単独(M8 ゲート。後続 M9 / M10 が本スキーマに依存)。M8-RESEARCH-01(read-only)とは並行可 |
| 依存指示書 | なし(フェーズ2 の最初の製造指示書) |
| 想定所要時間 | 90〜150 分 |
| 作成者・作成日 | 設計担当 Claude(フェーズ2 継続担当)、2026-06-10 |

## 更新履歴

| バージョン | 更新日 | 更新内容 |
|-----------|--------|----------|
| 1.0.0 | 2026-06-10 | 初版作成。CHANGE-022 v0.3.0 で確定した moves 8列追加を製造指示書化 |
| 1.1.0 | 2026-06-11 | CHANGE-025 反映: startup/total の NULL 可化 + seed 再生成前提化により、移行戦略を「8 列とも単純 nullable ADD COLUMN・一時 DEFAULT / backfill 廃止」へ簡素化。SQLite NOT NULL 制約の論点が解消 |
| 1.2.0 | 2026-06-12 | M8-01 投入後の Plan Mode 回答を反映: 真偽 2 列(is_aerial / setup_only)を `INTEGER NOT NULL DEFAULT 0` で宣言(既存 is_draft / is_builtin / oki_* の物理慣習に統一。SQLite に真偽型は無く BOOLEAN/INTEGER は 0/1 で等価)。Go モデルは bool のまま |
| 1.2.1 | 2026-06-12 | A-1 検収申し送り反映: エンドポイント表記を実装整合の `GET /api/moves?character_id={id}` へ訂正(旧 `/api/characters/{id}/moves` は DES-002 §4.2 の表記誤り、§4.2 も errata 修正 v1.12.1)。記録整合のための指示書改訂(M8-01 は検収完了済み) |

---

## 1. 背景と目的

### 1.1 背景

- フェーズ1(M0〜M7)は完了。現行 moves テーブル(DES-003 §3.3、L258-337)は damage / combo_scaling / ゲージ増減 / properties / raw_data 等を持つが、**発生・持続・全体硬直・硬直差といったフレームデータ列を持たない**。先行リリースで実データ(クラシック5体)を扱うにはこれらの列が必須(CHANGE-022 §2)。
- CHANGE-022 v0.3.0 §3.1 で moves へ追加する8列が確定・DES-003 v1.17.0 §3.3 へ反映済み。本指示書はそのスキーマ移行を製造工程へ落とす。M8 はフェーズ2 のゲートであり、後続(M9 取込パイプライン / M10 複数キャラ登録 UI)はすべて本スキーマに依存する(phase2-overview §3)。

### 1.2 目的

完了時に達成される状態:

- moves テーブルへ8列(`startup` / `active` / `total` / `on_hit` / `on_block` / `drive_gauge_decrease_guard` / `is_aerial` / `setup_only`)が加算的に追加されている(DES-003 §3.3、L267-280)。
- 8 列はすべて加算的に追加され、既存 seed 行は新列が NULL(bool 2 列は false)で問題なく存続する(§4.1。startup/total は NULL 可化済み = CHANGE-025)。
- moves の Go モデル・DTO・`GET /api/moves?character_id={id}`(DES-002 §4.2、L135)のレスポンスへ8フィールドが反映されている。
- フロントエンドの Move 型が8フィールドを保持する(表示の追加は本指示書のスコープ外、型の追従のみ)。
- 既存のコンボ一覧 / 詳細 / 編集等、moves を参照する既存挙動が非破壊で動作する。

### 1.3 このマイルストーンで作らないもの(スコープ外)

製造担当は以下を**実装しない**。いずれも後続マイルストーンの責務:

| 項目 | 責務 |
|------|------|
| `total` の算出ロジック(発生 + 持続 − 1 + 硬直 + 備考補正) | M9-02(FR704 取込時に算出)。本指示書では列を追加するのみで値は入れない(既存 seed 行は NULL)。算出式は §1.4 に背景として記載 |
| `properties` の公式属性 → コード値正規化 | M9-02(取込時)。`properties` 列自体は既存・本指示書で変更しない |
| CSV 取込(`POST /api/import/moves`)・取込プレビュー | M9-02 |
| ラッシュ版(`rush_variant`)生成・`is_aerial` の手動トグル UI | M9-03(FR703) |
| 耐久 seed(migration 000012、AKI 36件)の除去 | M12-02 |
| リュウ等の公式実データ投入 | M9(取込パイプライン) |
| moves 表示項目の画面追加(フレームデータの画面表示) | フェーズ2 後続 / フェーズ3(本指示書は型・API の器を用意するのみ) |

### 1.4 `total` 算出式(背景・本指示書では実装しない)

開発者定義(2026-06-10):

> `total`(自動算出分) = 発生 + 持続 − 1 + 硬直
> + 備考欄「空振り時の増加 F」(備考は抽出困難のため FR703 で手動補正)

- `−1` は、発生の最終フレームと持続の初フレームが重複するための補正(例: 発生4フレーム目と持続4フレーム目の重複)。
- 「持続」は公式の範囲表記(`4-6`)を本数(`3`)へ正規化した `active` を用いる(DES-003 §3.3、L268 / L331)。
- 本式は **M9-02 の取込時算出ロジック** の前提である。**M8-01 では実装しない**(既存 seed 行は新列が NULL のまま。既存 seed は M9 でクリア + ツール再生成され、実データは取込時に本式算出値で投入される = CHANGE-025)。算出に必要な値が空欄の行は total = NULL(CHANGE-025、DES-003 §3.3)。
- 本式の DES-003 §3.3 への正式記載(現行注記 L332「算出式は開発者が定義する(着手前確認事項)」の具体化)は、設計担当が CHANGE 通知書で別途対応する(本指示書のスコープ外、製造担当の作業ではない)。

---

## 2. 成果物

### 2.1 作成するファイル

| ファイル | 内容 |
|---------|------|
| `migrations/0000NN_add_moves_frame_columns.up.sql` | moves へ8列を追加(§4.1)。`0000NN` は §3.4.1 で確定 |
| `migrations/0000NN_add_moves_frame_columns.down.sql` | 上記のロールバック(§4.1) |

### 2.2 修正するファイル

| ファイル(概略・実パスは §3.4 で確認) | 修正内容 |
|------|----------|
| moves の Go モデル(`internal/model/` 配下) | 8フィールド追加(§4.2) |
| moves の DTO / API レスポンス型 | 8フィールド追加(§4.3) |
| moves のリポジトリ層 SELECT | 8列を取得対象へ追加(§4.4) |
| フロントエンドの Move 型(`web/src/` 配下の型定義) | 8フィールド追加、camelCase(§4.5) |

> 上記の実ファイルパス・既存構造・Props/フィールド契約は §3.4 着手前確認で view 確認する(playbook §4.9 3点セット確認の精神。設計担当はリポジトリ未確認のため概略で記載)。

### 2.3 変更しないもの(原則)

- moves の既存列(`id` / `character_id` / `code` / `category` / `original_move_id` / `damage` / `combo_scaling` / `drive_gauge_increase` / `drive_gauge_decrease_punish` / `super_art_gauge_increase` / `properties` / `raw_data`)。**特に `properties` は本指示書で変更しない**(コード値正規化は M9-02 取込時の挙動であり、列定義は不変)。
- 既存 API の振る舞い(レスポンスは8フィールドの**追加のみ**。既存フィールドの削除・改名・型変更を行わない)。
- combos / combo_steps / recipe_cache 等、moves を参照する他テーブル・キャッシュ(列追加は加算的で影響なし、CHANGE-022 §5)。
- 耐久 seed(000012)・既存 seed マイグレーション(000003〜000006 等)。本指示書は新規マイグレーション1組を追加するのみで、既存マイグレーションファイルを書き換えない。

### 2.4 例外条項

該当なし。本指示書はスキーマ・バックエンド中心であり、フロントエンドは Move 型の追従のみ。バックエンドへの追加変更は §2.1 / §2.2 に列挙したものに限り、それ以外のバックエンド変更(新規エンドポイント・既存サービスの振る舞い変更等)は本指示書のスコープ外とする。実装中にこれらが必要と判断した場合、Plan Mode で停止して開発者に相談すること。

---

## 3. 前提条件

### 3.1 必読ドキュメント

- DES-003 v1.17.0 §3.3 moves(L258-337):8列の型・制約・注記。特に列定義表(L267-280)とフレームデータの取込・算出・要確認の前提注記(L329-337)。
- DES-003 §7 マイグレーション方針(L634-):golang-migrate、`NNNNNN_description.up.sql` / `.down.sql`、embed 同梱・起動時自動適用。
- DES-002 v1.11.0 §4.2 主要エンドポイント(L135):`GET /api/moves?character_id={id}`。
- CHANGE-022 v0.3.0 §3.1(列定義)/ §5(移行影響)。
- SUPP-001 v1.20.0 §2.7(マイグレーションツール `golang-migrate/migrate/v4`、embed.FS、`migrations/`)・§3.6(seed 投入方式・down.sql 整備方針)。

### 3.2 任意参照

- 本指示書 §1.4(`total` 算出式の背景。M8-01 では実装しないが、列の位置づけ理解に有用)。

### 3.3 参照不要

- DES-005(画面設計):本指示書は画面表示を追加しない。
- DES-006(バリデーション):本指示書はバリデーションを追加しない。
- DES-004(内部表現):技名正規化は取込時(M9)の挙動で、本スキーマ移行には影響しない。

### 3.4 着手前の確認(Plan Mode で開発者へ報告)

製造担当 Claude Code は §4 の実装に着手する前に以下を確認し、**結果を Plan Mode で開発者に報告すること**。確認項目が2件以上のため、報告は playbook §8.4 の質問書ファイル方式(`docs/instructions/M8-01-plan-mode-questions.md` 等、命名・フォーマットは製造担当判断)を用いる。

#### 3.4.1 次マイグレーション番号

`migrations/` ディレクトリを `ls` で確認:

- [ ] 現在の最新マイグレーション番号(progress-summary §7 では M7 期間に 000008〜000012 を追加、000012 = 耐久 seed の記録。実体を view で確定する)。
- [ ] 本指示書で追加するマイグレーションの番号 = 最新 + 1。番号が想定(000013)と異なる場合は Plan Mode で報告。

#### 3.4.2 既存 moves スキーマの確認

`migrations/000001_init_schema.up.sql`(または現行スキーマ)と moves モデルを view:

- [ ] moves に8列(`startup` / `active` / `total` / `on_hit` / `on_block` / `drive_gauge_decrease_guard` / `is_aerial` / `setup_only`)が**未追加**であること。
- [ ] 既存列の構成が DES-003 §3.3(L262-281)と一致すること。差異が存在する場合は Plan Mode で報告。

#### 3.4.3 既存 seed 行の確認

- [ ] フレーム列を持たない既存 seed 行(リュウの技 = `000004_seed_moves_ryu`、耐久 seed = 000012 等)が、nullable 列の追加後に新列 NULL(bool 2 列 false)で存続することを確認(backfill は不要 = CHANGE-025。既存 seed は M9 でクリア + 再生成予定で、本指示書では削除しない)。

#### 3.4.4 既存 MoveDTO / フロントエンド Move 型の確認(playbook §4.9 3点確認)

- [ ] 既存の moves DTO 構造体・フロントエンド Move 型を view し、NULL 可フィールドの表現方式(Go: ポインタ `*int` か `sql.NullInt64` か / TS: `number | null`)と JSON タグの camelCase 規約(CLAUDE.md §4)を確認。新規8フィールドは既存パターンに揃える。

#### 3.4.5 SQLite の DROP COLUMN 対応の確認

- [ ] down.sql で `DROP COLUMN` を使えるか(SQLite 3.35.0 以降が必要)。使えない環境の場合はテーブル再構築方式を Plan Mode で提案。
- [ ] 8 列はすべて nullable または `INTEGER NOT NULL DEFAULT 0`(真偽 2 列)のため、既存行ありでも単純 ADD COLUMN が成立する(NOT NULL かつ DEFAULT なしの列追加は本指示書には無い)。

実装が確認できなかった場合・想定と異なる場合は、独断で対応せず Plan Mode で停止して開発者に状況報告すること。

---

## 4. 詳細仕様

### 4.1 マイグレーション(up.sql / down.sql)

8 列はすべて**加算的に追加**する。CHANGE-025 で `startup` / `total` が NULL 可化されたため、一時 DEFAULT・backfill は不要(既存 seed 行は新列が NULL で存続する。既存 seed は M9 でクリア + ツール再生成される)。

**up.sql**(8列追加。各列の定義は DES-003 §3.3 に従う):

| 列 | 型 | 制約 |
|----|-----|------|
| `startup` | INTEGER | NULL 可(CHANGE-025) |
| `active` | INTEGER | NULL 可 |
| `total` | INTEGER | NULL 可(CHANGE-025) |
| `on_hit` | INTEGER | NULL 可 |
| `on_block` | INTEGER | NULL 可 |
| `drive_gauge_decrease_guard` | INTEGER | NULL 可 |
| `is_aerial` | INTEGER | NOT NULL, DEFAULT 0(真偽フラグ。既存行を 0 補完。既存慣習に統一） |
| `setup_only` | INTEGER | NOT NULL, DEFAULT 0(真偽フラグ。既存行を 0 補完。既存慣習に統一） |

- NULL 可 6 列は DEFAULT なしの単純 ADD COLUMN(既存行は NULL)。真偽 2 列は `INTEGER NOT NULL DEFAULT 0`(既存行は 0 で自動補完)。**SQLite に真偽型は無く `BOOLEAN`/`INTEGER` は 0/1 で等価**なため、既存の真偽列(is_draft / is_builtin / oki_*)と同じ `INTEGER DEFAULT 0` に統一する。DES-003 の `BOOLEAN` 表記は論理型(Go bool / JSON boolean)で、物理は INTEGER 0/1。**NOT NULL かつ DEFAULT なしの列追加は無い**ため SQLite の既存行制約に抵触しない。
- 一時 DEFAULT・番兵値・backfill は用いない(CHANGE-025 で seed 再生成前提に確定)。実データは M9 取込時に投入され、算出不能行の `total` は NULL のまま(§1.4)。

**down.sql**:

- 追加8列を `DROP COLUMN` で除去(SQLite 3.35.0 以降。§3.4.5 で確認)。`DROP COLUMN` が使えない場合はテーブル再構築方式(新表作成 → 旧データコピー → 旧表 DROP → リネーム)を Plan Mode で提案。
- ロールバック後に既存挙動(8列追加前の状態)へ戻ること。

> 各列の意味・公式対応は DES-003 §3.3 列定義表(L267-280)を引用する。`total` は「本体が取込時に発生・持続・硬直から算出して格納する正準値」(L269)、`is_aerial` は「ラッシュ可否判定に用いる空中判定」(L279)、`setup_only` は「セットプレイ自動提案の予約列、本フェーズはフラグ保持のみ」(L280)。

### 4.2 Go モデルへの8フィールド追加

moves モデル構造体へ8フィールドを追加する。NULL 可列(`startup` / `active` / `total` / `on_hit` / `on_block` / `drive_gauge_decrease_guard`。startup / total は CHANGE-025 で NULL 可化)は §3.4.4 で確認した既存の NULL 表現方式に揃える(ポインタ `*int` または `sql.NullInt64`)。`is_aerial` / `setup_only` は `bool`。

JSON タグは camelCase(CLAUDE.md §4、SUPP-001 の DTO camelCase 統一)。対応は次のとおり(DB 列 snake_case → JSON camelCase):

| DB 列 | JSON タグ(camelCase) | Go 型(目安、§3.4.4 で既存方式に整合) |
|-------|----------------------|------------------------------------|
| `startup` | `startup` | `*int`(NULL 可、CHANGE-025) |
| `active` | `active` | `*int`(NULL 可) |
| `total` | `total` | `*int`(NULL 可、CHANGE-025) |
| `on_hit` | `onHit` | `*int`(NULL 可) |
| `on_block` | `onBlock` | `*int`(NULL 可) |
| `drive_gauge_decrease_guard` | `driveGaugeDecreaseGuard` | `*int`(NULL 可) |
| `is_aerial` | `isAerial` | `bool` |
| `setup_only` | `setupOnly` | `bool` |

### 4.3 DTO / API レスポンスへの反映

- `GET /api/moves?character_id={id}`(DES-002 §4.2 L135)のレスポンスに上記8フィールドを追加する。
- レスポンスは8フィールドの**追加のみ**。既存フィールドの削除・改名・型変更を行わない(§2.3)。
- DTO がモデルと別型の場合、両方に8フィールドを反映し、変換処理(モデル → DTO)へ8フィールドのマッピングを追加する。

### 4.4 リポジトリ層 SELECT への反映

- moves を取得する SELECT 文(リスト取得・単体取得)に8列を追加する。
- NULL 可列のスキャン先は §3.4.4 で確認した方式に揃える。

### 4.5 フロントエンド Move 型への反映

- `web/src` 配下の Move 型定義に8フィールドを追加(camelCase、§4.2 の JSON タグと一致)。NULL 可は `number | null`、boolean は `boolean`。
- **表示の追加は行わない**(本指示書は型・API の器のみ。フレームデータの画面表示はフェーズ2 後続 / フェーズ3)。型追加により既存のコンボ一覧・詳細・編集等のコンパイルが通り、既存表示が変化しないことを確認する。

---

## 5. テスト要件

### 5.1 必須テスト(Go test / Vitest)

バックエンド(Go test):

- [ ] マイグレーション up が適用でき、moves に8列が追加されること。
- [ ] 既存 seed 行が up 適用後に存続すること(NULL 可 6 列が NULL、`is_aerial` / `setup_only` が 0 で補完されること)。
- [ ] マイグレーション down が適用でき、8列が除去されて元のスキーマへ戻ること。
- [ ] `GET /api/moves?character_id={id}` が8フィールドを含むレスポンスを返すこと(既存フィールドが欠落・改名していないこと)。

フロントエンド(Vitest):

- [ ] Move 型の追加により既存コンポーネントの型・テストが壊れないこと(既存テストが通過)。

### 5.2 E2E シナリオ(開発者の実機確認)

本指示書はスキーマ・型・API の器の追加で、画面表示を変更しない。専用 E2E シナリオは設けず、**既存挙動の非破壊性を実機で確認**する:

- シナリオA(既存非破壊): アプリ起動 → コンボ一覧表示 → 任意のコンボ詳細表示 → コンボ編集画面表示。いずれも従来どおり表示・操作でき、moves を参照する箇所(技選択・レシピ表示等)が壊れていないこと。

> ブラウザでの実機動作確認・スクリーンショット取得は開発者の責任範囲(playbook §14)。

---

## 6. レビュー観点(別ファイル参照)

レビューは別チェックリスト `M8-01-review-checklist.md` に基づく(設計担当が本指示書とあわせて作成)。

---

## 7. 完了条件(Definition of Done)

### 7.1 機能要件

- moves に8列が加算的に追加され、既存 seed 行が補完されている。
- model / DTO / `GET /api/moves?character_id={id}` / リポジトリ SELECT / フロント Move 型に8フィールドが反映されている。
- 既存挙動(コンボ一覧・詳細・編集)が非破壊。

### 7.2 自己テスト結果(製造担当の責任範囲)

- §5.1 のバックエンド・フロントエンドテストが通過。
- マイグレーション up / down の往復が成功。

### 7.3 品質チェック

- 既存フィールドの削除・改名・型変更がないこと(§2.3)。
- `properties` を変更していないこと(§2.3)。
- 一時 DEFAULT・backfill を用いていないこと(CHANGE-025、§4.1)。

### 7.4 ドキュメント

- `docs/progress/progress-log.md` に M8-01 完了報告(実装サマリ・§5.2 実機確認結果・§3.4 Plan Mode 確認結果・既知の制限事項が存在する場合は記載)を追記(playbook §11)。

### 7.5 完了報告

- Plan Mode 質問書(§3.4)への開発者回答内容と、それを受けた実装判断(down.sql 方式・DTO の NULL 表現)を完了報告に含める。

---

## 8. 参照ドキュメント

| 文書 | 箇所 | 用途 |
|------|------|------|
| DES-003 v1.17.0 | §3.3(L258-337)、§7(L634-) | moves スキーマ8列・マイグレーション方針 |
| DES-002 v1.11.0 | §4.2(L135)、§4.3 | GET エンドポイント・エラー型 |
| CHANGE-022 v0.3.0 | §3.1 / §5 | 列定義・移行影響 |
| SUPP-001 v1.20.0 | §2.7 / §3.6 | マイグレーションツール・seed 方式 |
| 本指示書 | §1.4 | `total` 算出式(背景、M9-02 で実装) |

---

## 9. 注意事項・判断に迷ったら

### 9.1 推測で進めてはいけない事項

- 次マイグレーション番号 → §3.4.1 で view 確認。
- down.sql の DROP COLUMN 可否 → §3.4.5 で確認、不可ならテーブル再構築方式を Plan Mode で提案。
- NULL 可列の Go / TS 表現方式 → §3.4.4 で既存方式を view 確認。
- `total` 算出ロジック・`properties` 正規化・CSV 取込 → **本指示書では実装しない**(§1.3、M9-02 スコープ)。実装したくなった場合は Plan Mode で停止。

### 9.2 推測で進めてよい事項(その旨を明示)

- 本指示書には推測で進めてよい固有事項は特にない(スキーマ追加は CHANGE-025 で確定済み)。

### 9.3 不明事項発見時の対応

- §3.4 で想定と異なる実態(列が既に一部追加済み・マイグレーション番号の不連続・既存 DTO 方式の不明確等)を発見した場合、独断で対応せず Plan Mode で停止して開発者へ報告する。

### 9.4 Plan Mode で計画提示時に含めるべき項目

- §3.4.1〜3.4.5 の着手前確認結果。
- down.sql 方式(DROP COLUMN / テーブル再構築)の提案。
- model / DTO の NULL 可フィールド表現方式(既存パターンへの整合)。

---

## 10. 完了後の次ステップ

- M8-01 完了承認後、M9(公式データ取込パイプライン)へ。M9-02(FR704 アプリ取込)で §1.4 の `total` 算出式を実装し、`properties` のコード値正規化を行う。M9-01(FR701 取込ツール)は別チャットの設計担当へ委任済み(本体側 CSV 取込との契約整合のみ留意)。
- 設計担当は別途、`total` 算出式の DES-003 §3.3 への正式記載(CHANGE 通知書)を扱う。

---

*以上、M8-01 指示書 v1.2.1*

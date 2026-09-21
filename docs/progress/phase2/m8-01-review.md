# M8-01 レビュー報告書

| 項目 | 内容 |
|------|------|
| 対象指示書 | M8-01 v1.1.0(moves フレームデータ列追加マイグレーション + model / DTO / GET 反映) |
| チェックリスト | `docs/instructions/reviews/M8-01-review-checklist.md` v1.0.0 |
| レビュー対象コミット | `39f2cd0`(feat M8/moves) |
| 判定 | **合格**(§9 重大指摘 0 件) |
| レビュー日 | 2026-06-12 |

## 総評

加算的スキーマ移行として極めて健全な実装。8 列の型・制約は DES-003 §3.3 第21版(CHANGE-025)に厳密一致し、レスポンスは追加のみで既存フィールドの削除・改名・型変更がない。スコープ規律も良好で、`total` 算出・`properties` 正規化・CSV 取込・画面表示といった M9 以降の責務は一切先取りしていない(型・API の器のみを用意)。進捗ログの記録粒度が高く、Plan Mode 確認結果・開発者回答・実装判断・エンドポイント差異まで追跡可能。重大な逸脱は見当たらず、指摘は down ロールバックの恒久テスト欠落と GET レスポンスのフィールド未アサートという軽微なテスト網羅の話に限られる。

**重要な前提注記**: チェックリスト v1.0.0 は CHANGE-025 適用前の版で、§1.1 / §4.1 が `startup` / `total` を **NOT NULL** と記載しているが、これは指示書 v1.1.0(CHANGE-025)で **NULL 可** に撤回済み。本実装は新しい指示書・DES-003 第21版に正しく従っており、チェックリストの当該項目は陳腐化している。チェックリスト記載をもって「型不一致」と判定してはならない(後述)。

## 設計準拠性レビュー結果

### §1.1 moves 8列の定義(DES-003 §3.3 L267-280)— ◎

`migrations/000013_add_moves_frame_columns.up.sql` の各列が DES-003 第21版と一致(grep で L267-280 を確認):

| 列 | DES-003 第21版 | up.sql 実装 | 判定 |
|----|---------------|------------|------|
| `startup` | INTEGER NULL可 | `INTEGER`(DEFAULT なし) | ◎ |
| `active` | INTEGER NULL可 | `INTEGER` | ◎ |
| `total` | INTEGER NULL可 | `INTEGER` | ◎ |
| `on_hit` | INTEGER NULL可 | `INTEGER` | ◎ |
| `on_block` | INTEGER NULL可 | `INTEGER` | ◎ |
| `drive_gauge_decrease_guard` | INTEGER NULL可 | `INTEGER` | ◎ |
| `is_aerial` | BOOLEAN NOT NULL DEFAULT false | `INTEGER NOT NULL DEFAULT 0 -- BOOLEAN` | ◎ |
| `setup_only` | BOOLEAN NOT NULL DEFAULT false | `INTEGER NOT NULL DEFAULT 0 -- BOOLEAN` | ◎ |

- BOOLEAN を `INTEGER(0/1)` で物理宣言する判断は開発者が承認済み(進捗ログ §開発者への確認)。既存 `combos.is_draft` / `presets.is_builtin` / 000001 init_schema の慣習と一貫し、SQLite では機能的に等価。妥当。
- 8 列以外の列追加・変更なし(§1.1 末尾チェック)。`properties` 含む既存列は不変。◎

> 注: チェックリスト §1.1 は `startup` / `total` を NOT NULL と要求するが、CHANGE-025 で NULL 可へ撤回済み(DES-003 L267「CHANGE-025でNOT NULLを撤回。発生空欄の行が実在＝約100件・26キャラ」)。実装の NULL 可は **正**。

### §1.2 マイグレーション方針(DES-003 §7 / SUPP-001 §2.7・§3.6)— ◎

- ファイル名 `000013_add_moves_frame_columns.{up,down}.sql`、番号 = 既存最新 `000012` + 1。`ls migrations/` で連番確認。◎
- up / down が対。down は `DROP COLUMN`(追加と逆順)で 8 列除去。SQLite 3.35+ は migration 000008(CHANGE-019)で実績あり。◎
- 既存マイグレーション(000001〜000012)の書き換えなし(diff stat で確認)。◎

### §1.3 エンドポイント(DES-002 §4.2 L135)— ○(指示書側の記載不正確を実装側で正しく解消)

- 指示書は `GET /api/characters/{id}/moves` と記すが、実体は `GET /api/moves?character_id=N`(`internal/api/move/routes.go:10`、`handler.go:23`)。実装はこの実エンドポイントのレスポンスへ 8 フィールドを反映。論理的に同一の「キャラ別技一覧」であり、製造担当は推測で進めず進捗ログ §エンドポイントの差異 に明記している。対応は適切。
- **設計担当への申し送り**: 指示書 §1.2 / §3.3 / §4.3 / §8 の `GET /api/characters/{id}/moves` 表記は実装と乖離。DES-002 §4.2 L135 の該当エンドポイント表記の実態確認を推奨(本実装の欠陥ではない)。

## 設計準拠性以外の指摘事項

### API 整合性(§2)— ◎

- `MoveResponse` は 8 フィールドの**追加のみ**。`toMoveResponse` のマッピングも既存フィールドを保持(`dto.go`)。HEAD~1 との diff で既存フィールド削除・改名・型変更なしを確認。◎
- JSON タグ camelCase 完全準拠: `startup` / `active` / `total` / `onHit` / `onBlock` / `driveGaugeDecreaseGuard` / `isAerial` / `setupOnly`(CLAUDE.md §4)。◎
- 独自エラー型の新設なし(本指示書はエラー経路を追加しない)。◎

### フロントエンド(§3)— ◎

- `web/src/features/moves/types.ts` の `Move` interface に 8 フィールド追加。NULL 可は `?: number | null`、bool は必須 `boolean`。バックエンド JSON タグと一致。◎
- フレームデータの画面表示追加なし(型の器のみ)。◎
- 既存テストフィクスチャ 3 件(`DuplicateRealtimeWarning` / `ModifiersEditor` / `VirtualController`)に `isAerial: false, setupOnly: false` を追加。必須 boolean 化に伴う型整合の追従で挙動変更なし。進捗ログによれば `tsc --noEmit` クリーン・Vitest 439 テスト全パス。◎

### コード品質・規約(§6)— ◎

- NULL 可列の Go 表現はモデル・DTO・リポジトリすべて `*int`、リポジトリのスキャンは `sql.NullInt64` → `nullInt64ToIntPtr` ヘルパで `*int` 変換。既存 `OriginalMoveID` / `Properties` の NULL 表現方式に整合。bool は NOT NULL のため直接 `&item.IsAerial` でスキャン(modernc が 0/1 INTEGER→bool 変換)。妥当。◎
- `listByCharacterSQL` の SELECT に 8 列追加、スキャン順序と一致。◎
- コメントが既存コードの粒度・日本語規約に沿う。マジック値なし。◎

### スコープ規律(§5、設計意図)— ◎

- `total` 算出ロジック未実装(既存 seed 行は NULL のまま、暫定値で埋めていない)。◎
- `properties` 正規化未実装、列定義不変。◎
- CSV 取込・取込プレビュー・ラッシュ版生成・`is_aerial` 手動トグル UI いずれも未実装。◎
- 一時 DEFAULT・番兵値・backfill を用いていない(CHANGE-025)。up.sql に DEFAULT が付くのは bool 2 列の `DEFAULT 0` のみで、これは NOT NULL 列の既存行補完であり「取込で上書きされる暫定値」ではない。誤用なし。◎
- `model.Move` は現状スキャン/構築箇所がないが、指示書 §4.2 の明示要求に従い追加(進捗ログに明記)。指示書準拠として妥当。

### 非破壊性(§7)— ◎

- combos / combo_steps / recipe_cache 等への影響なし(列追加は加算的、CHANGE-022 §5)。
- 既存 seed(000003〜000006、耐久 seed 000012)の除去・改変なし。
- `TestRun_SeedRowCounts` / `TestRun_RushVariantOriginalMoveID` 等の既存マイグレーションテストが維持され、進捗ログによれば `go test ./...` 全パス。

## 推奨修正(優先度別)

### 高(M8 完了前に修正必須)
- **なし**。§9 重大指摘 0 件。

### 中(M9 着手と並行可)
- **[軽微・テスト網羅] down ロールバックの恒久テストが無い**(`internal/infra/migration/migrate_test.go`)。指示書 §5.1 / チェックリスト §4.1 は「down 適用で 8 列が除去され元のスキーマへ戻ること」の検証を必須としている。進捗ログ §自己テスト結果 によれば up/down 往復は一時テスト(`Steps(-1)`→`Steps(1)`)で確認後に**削除**された。検証自体は実施済みだが回帰テストとして残っていないため、将来 down.sql が破損しても CI で検知できない。`TestRun_MovesFrameColumnsExist` と同様の恒久テスト(down 後に 8 列が消えることを `PRAGMA table_info` で確認)の追加を推奨。
- **[軽微・テスト網羅] GET ハンドラテストが新 8 フィールドをアサートしていない**(`handler_test.go: TestHandler_List_200`)。`ListResponse` へデコードはするが、検証は `NameJa` のみ。NULL 可列は seed 行が全 NULL + `omitempty` のため JSON に現れず、bool 2 列(`isAerial`/`setupOnly`)のみが常時出力される。チェックリスト §4.1「GET が 8 フィールドを含み、既存フィールドが欠落・改名していないこと」を JSON レベルで明示アサートしていない。最低限 `isAerial`/`setupOnly` の存在と、既存フィールド(`code`/`category` 等)の非欠落を確認するアサーションの追加を推奨。

### 低(将来対応)
- **[申し送り] チェックリスト v1.0.0 の陳腐化**: §1.1 / §4.1 の `startup` / `total` = NOT NULL、§5 の「一時 DEFAULT で埋まっている」前提は CHANGE-025 で撤回済み。設計担当はチェックリストを CHANGE-025 反映版へ更新するのが望ましい(今回の実装判定には影響しない)。
- **[申し送り] 指示書のエンドポイント表記**(上述 §1.3)。`GET /api/characters/{id}/moves` → 実体 `GET /api/moves?character_id=N`。
- **[軽微] Plan Mode 質問書ファイルの非永続化**: 指示書 §3.4 は質問書ファイル方式(`docs/instructions/M8-01-plan-mode-questions.md` 等)を求めるが、当該ファイルは存在しない。ただし §7.5 が要求する「開発者回答内容と実装判断」は progress-log §開発者への確認・§3.4 Plan Mode 着手前確認 に過不足なく記録されており、完了報告としての要件は満たす。質問書ファイルは計画段階の一時成果物であり、内容が完了報告へ統合されているため実害なし。

## 良かった点

(Claude Code へのフィードバック)
- **スコープ規律が模範的**。M9 の責務(算出・正規化・取込・表示)を一切先取りせず、「器のみ」の設計意図に忠実。
- **進捗ログの追跡性が高い**。Plan Mode 確認 5 項目・開発者回答・BOOLEAN 物理宣言の判断根拠・down.sql 方式・エンドポイント差異まで明記され、レビューに必要な文脈が完備。
- **エンドポイント差異を独断で済ませず記録**。指示書と実装の乖離を推測で埋めず、実エンドポイントへ反映した旨を完了報告に残した判断は §9 協同方針に合致。
- **NULL 表現を既存パターンに整合**(`*int` + `omitempty`、`sql.NullInt64` 変換ヘルパ)。新規の表現方式を持ち込まず一貫性を保った。
- **既存テストフィクスチャの追従を最小差分で実施**。必須 boolean 化に伴う 3 ファイルの修正をスコープ内に収め、挙動変更を伴わない型整合に限定。

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機テスト(§5.2 シナリオA = 一覧 → 詳細 → 編集の非破壊性)は開発者の実機確認が別途必要(進捗ログでも開発者の最終確認に委ねられている)。
- `go test ./...` 全パス・Vitest 439 テスト・`tsc --noEmit` クリーンは進捗ログの自己申告に基づく。レビュー担当はテストを再実行していない。

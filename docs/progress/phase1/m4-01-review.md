# M4-01 レビュー報告書

## 総評

M4-01 のセットプレイバックエンド基盤は全体的に高品質な実装で、最重要要件である VAL-S05 (CHANGE-012) のサービス層引数レベル適用、recipe_cache 案 R2 採用、エラーコード小文字スネーク統一、`model.APIErrorResponse` 直接呼び出しはいずれも正確に実装されている。トランザクション境界は SUPP-001 §7.5.4 に完全準拠し、notation 拡張 4 関数も仕様通り動作する。

一方、指示書 §5.1.4 および §5.2 C で仕様化された VAL-S04 の HTTP ステータス (`409 + duplicate_setup`) が実装では `400 + validation_failed` として返却されており、API コントラクトの相違が確認された。フロント未実装の段階のため修正コストは低い。

---

## 設計準拠性レビュー結果

### §1: 指示書本体との照合

| 項目 | 評価 | 備考 |
|------|------|------|
| 成果物ファイル一覧（§2.1 新規作成 9 ファイル） | ◎ | 全ファイル確認済み |
| 成果物ファイル一覧（§2.2 修正 5 ファイル） | ◎ | 全ファイル確認済み |
| スコープ外変更なし（マイグレーション追加・フロント変更なし） | ◎ | 変更なし確認済み |
| §3.4 着手前確認結果の進捗ログ記録 | △ | `docs/progress/progress-log.md` の M4-01 セクションに §3.4 確認結果の明示的な記録が見当たらない。実装品質から確認済みと推定されるが、完了条件 §7 の明文要件。 |

### §2: setup モデル定義（DES-003 整合性）

| 項目 | 評価 | 備考 |
|------|------|------|
| Setup 構造体フィールド（DES-003 §3.11 準拠） | ◎ | camelCase JSON タグ、`RecipeCache json:"-"` |
| Setup.DeletedAt JSON タグ | △ | 実装 `json:"-"`、指示書 §4.1.1 は `json:"deletedAt,omitempty"`。DTO 経由のため API 動作に影響なし |
| SetupStep 構造体（DES-003 §3.12 準拠） | ◎ | MoveCode 追加はコンボ側との対称性向上で妥当 |
| SetupStep.SetupID JSON タグ | △ | 実装 `json:"-"`、指示書 §4.1.2 は `json:"setupId"`。DTO 経由のため API 動作に影響なし |
| ComboSetup 構造体（DES-003 §3.13 準拠） | ◎ | |

### §3: API エンドポイント設計

| 項目 | 評価 | 備考 |
|------|------|------|
| 7 エンドポイント網羅（routes.go 確認） | ◎ | |
| POST/DELETE 分離方針遵守 | ◎ | 新規作成・紐付け追加・紐付け解除が別エンドポイント |
| HTTP ステータスコード（200/204） | ◎ | CreateSetup: 200、CreateSetupLink: 200、DeleteSetupLink: 204、DeleteSetup: 204（指示書 §4.2.1/§4.2.2 と整合） |
| VAL-S04 の HTTP ステータス | × | 指示書 §5.2 C および §5.1.4 は `409 + duplicate_setup` を仕様化しているが、実装は `400 + validation_failed` を返す |
| CreateSetup レスポンスの parentComboId | △ | 指示書 §4.2.1 は `parentComboId: int64`（単数）を仕様化、実装は `parentComboIds: []int64`（配列）。§4.2.4 との統一としては合理的だが仕様との齟齬 |

### §4: サービス層実装

| 項目 | 評価 | 備考 |
|------|------|------|
| 7 メソッドシグネチャ | ◎ | 実装は `(*SetupResponse, validation.ValidationResult, error)` の 3 値返却。指示書 §4.3.1 の 2 値 `(*SetupResponse, error)` より改善 |
| VAL-S05 適用：サービス層関数引数レベル | ◎ | `ValidateSetupCreate(ctx, parentComboID=0, ...)` で `CodeS05ParentRequired` エラー確認 |
| トランザクション境界（SUPP-001 §7.5.4 準拠） | ◎ | CreateSetup: INSERT 3 件 + RecomputeSetupCache → Commit。UpdateSetup/DeleteSetup も正確 |
| ErrNotFound / ErrConflict センチネル | ◎ | `setuprepo.ErrNotFound` を expose してサービス層が再 export |
| CreateSetup でのコンボ存在確認 | ◎ | `ComboExists` を明示的に確認（E2E 発見後追加、進捗ログに記録済み） |
| GetSetupCandidates スタブ | ◎ | 空配列を返す M4-03 向けスタブ |

### §5: バリデーション層（VAL-S01〜S05）

| 項目 | 評価 | 備考 |
|------|------|------|
| VAL-S01: キャラ存在確認（ERROR） | ◎ | CharacterID=0 と存在しないキャラ両方を判定 |
| VAL-S02: レシピ空チェック（ERROR） | ◎ | |
| VAL-S03: 技存在確認（WARNING） | ◎ | `result.AddWarning` で WARNING レベルを正確に使用 |
| VAL-S04: 同一コンボ内重複チェック（ERROR） | ◎ | SHA-256 ハッシュで重複判定 |
| VAL-S05: 親コンボ ID 必須（ERROR） | ◎ | 最初にチェックされ、CODE `VAL-S05` で記録 |
| UpdateSetup 時の部分バリデーション（Steps nil 時はスキップ） | ◎ | |

### §6: notation 拡張

| 項目 | 評価 | 備考 |
|------|------|------|
| ResolveSetupRecipe（cache hit/miss） | ◎ | JSON map パース・更新ロジック正確 |
| RecomputeSetupCache（全プリセット） | ◎ | トランザクション内で UpdateRecipeCacheTx 呼び出し |
| DeleteSetupCache（NULL 設定） | ◎ | `SetRecipeCacheNullTx` 呼び出し |
| ComputeSingleSetupCache（内部計算） | ◎ | `setupStepsToComboSteps` 変換を経由して `resolveRecipe` 使用 |
| RecomputePresetCache 拡張（setup 側ループ追加） | ◎ | cache.go に `ListAllActiveSetups` ループ追加 |
| DeletePresetCache 拡張（setup 側ループ追加） | ◎ | cache.go に `ListAllActiveSetups` + key delete ループ追加 |
| 案 R2 採用（setups.recipe_cache JSON カラム使用） | ◎ | |

### §7: コンボ作成 API の DTO 前方互換予約

| 項目 | 評価 | 備考 |
|------|------|------|
| `Setups json.RawMessage \`json:"setups,omitempty"\`` フィールド追加 | ◎ | combo/dto.go line 45 |
| 存在時 slog.Warn 出力（エラーにしない） | ◎ | `len(req.Setups) > 0` 判定 |
| combo→setup の import なし（循環 import 回避） | ◎ | `json.RawMessage` で完全回避 |
| 3 パターン受信テスト（指示書 §5.2 F） | ◎ | E2E シナリオ F で確認済み |

### §8: ハンドラ層

| 項目 | 評価 | 備考 |
|------|------|------|
| `model.APIErrorResponse` 直接呼び出し | ◎ | `errResp` ヘルパも `model.APIErrorResponse` を返す |
| エラーコード小文字スネーク統一 | ◎ | `invalid_combo_id`、`validation_failed`、`not_found`、`version_conflict`、`internal_error` |
| CreateSetup の 400 バリデーションエラー返却 | ◎ | |
| 独自エラー型・独自ヘルパなし | ◎ | |
| DI 配線（main.go） | ◎ | setupRepo → setupService → setupHandler の配線確認 |

### §9: テストの妥当性

| 項目 | 評価 | 備考 |
|------|------|------|
| validate_test.go（VAL-S01〜S05 全件） | ◎ | 5 ルール + ValidateSetupUpdate テストを含む |
| service_test.go（CRUD + VAL 異常系 + version conflict） | ◎ | 実 DB テスト（dbtest.Setup 使用） |
| repository_test.go（FindDuplicateInCombo、FindByID + steps） | ◎ | |
| setup_resolver_test.go（4 関数 + PresetCache 拡張） | ◎ | |
| handler_test.go（全エンドポイント + camelCase JSON 確認） | ○ | 正常系・主要異常系を網羅。ただし VAL-S04 の `409 + duplicate_setup` テストケースが欠落 |

### §10: E2E シナリオ

| シナリオ | 結果 | 備考 |
|----------|------|------|
| A（CRUD ライフサイクル） | ✅ | |
| B（VAL-S05） | ✅ | URL パス `comboId=0` → 400 `invalid_combo_id`（URL パーサでの前段フィルタ） |
| C（VAL-S04 重複） | △ | 400 `validation_failed` として通過（指示書は 409 `duplicate_setup` を期待） |
| D（リンク操作） | ✅ | |
| E（notation 連動） | ✅ | |
| F（M3 回帰） | ✅ | |

### §11: コード品質・規約遵守

| 項目 | 評価 | 備考 |
|------|------|------|
| JSON タグ camelCase 統一（CLAUDE.md §4） | ◎ | 全 DTO で camelCase 確認済み |
| 3 層分離維持（architecture-patterns.md §2） | ◎ | |
| `fmt.Errorf("...: %w", err)` でのエラー wrap | ◎ | 全サービス層・リポジトリ層で確認 |
| `console.log` / `fmt.Println` 本番コードへの混入なし | ◎ | |
| パニック使用なし | ◎ | |
| 不要な `nolint` コメントなし | ◎ | |
| Context 第一引数 | ◎ | 全サービス層メソッド |

### §12: ドキュメント・進捗ログ

| 項目 | 評価 | 備考 |
|------|------|------|
| 進捗ログへの M4-01 セクション追加 | ◎ | `docs/progress/progress-log.md` line 1067 |
| 設計判断の記録 | ◎ | combo_setups 論理削除案 P1・recipe_cache 案 R2 等 |

---

## 設計準拠性以外の指摘事項

### コーディング規約

- **指摘なし**: camelCase JSON タグ、godoc コメント（公開 API）、Context 引数、エラー wrap すべて正確

### 設計上の注意

- `buildResponse` 内で `FindByID` が 2 回呼ばれる可能性（CreateSetup の後も `buildResponse` で再取得）。現状の規模では問題ないが、N+1 の種になりうる。

---

## 推奨修正（優先度別）

### 高（M4 完了前に修正必須）

1. **VAL-S04 の HTTP ステータスコード修正（指示書 §5.2 C・§5.1.4 への準拠）**
   - 現状: `400 + validation_failed`
   - 期待: `409 + duplicate_setup`
   - 対処: `ValidationResult` に VAL-S04 が含まれる場合、ハンドラが 409 を返すように分岐を追加。または `service.CreateSetup` から `ErrDuplicate` センチネルを返しハンドラで判定。
   - 影響: `handler_test.go` に 409 テストケース追加も必要

### 中（M5 着手と並行可）

2. **CreateSetup レスポンスの `parentComboIds` vs `parentComboId` 統一確認**
   - 指示書 §4.2.1 が `parentComboId`（単数）を仕様化している一方、§4.2.4 が `parentComboIds`（配列）を仕様化
   - 現実装は配列で統一（SetupResponse DTO 共通化）— M4-02 フロント実装前に設計担当へ確認し、仕様 §4.2.1 を改訂するか実装を分岐するか決定すること

3. **§3.4 着手前確認結果の進捗ログへの明示的記録**
   - 完了条件 §7 に「§3.4 着手前確認結果を報告に含める」とある
   - 実装品質から確認は実施済みと推定されるが、進捗ログへの追記が望ましい

### 低（将来対応）

4. **model.Setup.DeletedAt / model.SetupStep.SetupID の JSON タグ**
   - 現在 `json:"-"` だが指示書は `json:"deletedAt,omitempty"` / `json:"setupId"` を仕様化
   - DTO 経由のため API 動作への影響なし。ただしモデル層を直接シリアライズするコードが増えた場合に問題化しうる。指示書への適合か明示的な設計変更として記録するかを判断すること

---

## 良かった点

- **VAL-S05 の実装精度**: CHANGE-012 のサービス層引数レベル適用が正確。`ValidateSetupCreate(ctx, 0, ...)` が `CodeS05ParentRequired` を返すことを validate_test.go で実証している
- **トランザクション境界の正確さ**: CreateSetup・UpdateSetup・DeleteSetup いずれも SUPP-001 §7.5.4 のトランザクション境界に完全準拠
- **notation 4 関数の対称性**: `ResolveSetupRecipe`・`RecomputeSetupCache`・`DeleteSetupCache` がコンボ側の対応関数と完全対称に実装されており、コードの一貫性が高い
- **json.RawMessage の採用**: 循環 import 回避の設計判断が製造工程で発見され、指示書 v1.0.1 に反映。実装も正確に追随している
- **サービス層の 3 値返却**: 指示書仕様の 2 値（`*SetupResponse, error`）を 3 値（`*SetupResponse, validation.ValidationResult, error`）に拡張し、警告を含む正常応答を返せるようにした設計改善

---

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機テストは別途実施が必要。
- `go test ./...` の実際の通過確認は製造担当の報告（進捗ログ記載）に基づく。

---

## 完了判定

| 判定基準 | 結果 |
|---------|------|
| 重大な問題（§13 基準）の有無 | **なし** |
| 軽微な問題の有無 | **あり**（VAL-S04 ステータスコード、model JSON タグ、§3.4 記録） |
| 最重要確認事項（VAL-S05・案 R2・エラーコード統一・共通型直接呼び出し） | **全通過** |
| M4 完了前修正推奨事項 | 1 件（VAL-S04 HTTP ステータス） |

**総合判定: 条件付き承認** — M4 完了前に VAL-S04 の HTTP ステータス修正（`400 → 409 + duplicate_setup`）を推奨。他の指摘事項は M5 以降対応可。

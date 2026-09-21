# M6-01 機械レビューチェックリスト

| 項目 | 内容 |
|------|------|
| 対応指示書 | M6-01: 設定 API 基盤(`GET /api/config` / `PUT /api/config` + サービス層 + ハンドラ層新設) |
| バージョン | 1.0.0 |
| 推奨モデル | Sonnet 4.6(機械レビュー) |
| 役割 | M6-01 の実装が指示書通りか、構造的問題がないかを機械的に検査する。**実機テストは別途実施が必要**(playbook §14、M4-02 E2E 由来運用知見: レビュー完了承認 ≠ サブマイルストーン完了承認) |
| 作成日 | 2026-05-23 |

## 更新履歴

| バージョン | 更新日 | 更新内容 |
|-----------|--------|----------|
| 1.0.0 | 2026-05-23 | 初版作成。M6-01 指示書 v1.0.0 に対応 |

---

## 0. レビュー実施前の確認

- [ ] M6-01 指示書 v1.0.0 を読了している
- [ ] M6-RESEARCH-01 調査レポート(2026-05-23)を読了している
- [ ] M6-overview v1.0.0 §4.2 を読了している
- [ ] DES-002 v1.8.0 §4.1〜§4.4 を確認している
- [ ] SUPP-001 v1.13.0 §4.2 / §5.8 / §5.9 を確認している
- [ ] architecture-patterns.md v1.0.3 §2 / §3 を確認している
- [ ] retrospective-log.md v1.0.17 の構造的アンチパターン §1(A 既存実装の確認漏れ / C 既存パターンとの整合確認漏れ / D 指示書の必須項目が完了報告で消化されない)を確認している
- [ ] M4-1〜M4-15 反省踏襲(特に M4-9 / M4-13 ドメイン横断確認 / 実コード確認の省略防止)を踏まえる

---

## 1. ファイル一覧チェック(指示書 §2.1 / §2.2)

### 1.1 新規作成ファイル(BE、§2.1)

- [ ] `internal/api/config/handler.go`(新規)が作成されている
- [ ] `internal/api/config/routes.go`(新規)が作成されている
- [ ] `internal/service/config/service.go`(新規)が作成されている
- [ ] DTO の配置(`internal/api/config/dto.go` 別ファイル分離 or `handler.go` 同居)が `§3.4.3 既存パターン確認結果` と整合している(完了報告で実態 + 採用根拠が明示されている)

### 1.2 新規作成ファイル(テスト、§2.1)

- [ ] `internal/api/config/handler_test.go`(新規)が作成されている
- [ ] `internal/service/config/service_test.go`(新規)が作成されている

### 1.3 修正ファイル(§2.2)

- [ ] `cmd/combomgr/main.go` に `confighandler.RegisterRoutes(apiGroup, configHandler)` の 1 行が追加されている
- [ ] `cmd/combomgr/main.go` に `configService := configsvc.NewService(cfg, configPath)` + `configHandler := confighandler.NewHandler(configService)` の DI 配線が追加されている
- [ ] DI 配線の位置が既存ルーター登録群(combohandler / presethandler / movehandler / taghandler / charhandler / setuphandler / debughandler)の慣例に揃っている

### 1.4 スコープ外への変更がないこと(§2.3、最重要)

- [ ] `internal/config/config.go` が変更されていない(`Default()` / `Load()` / `validate()` / Config 構造体定義すべて変更なし、`git diff` で 0 行差分確認)
- [ ] `internal/config/config_test.go` の既存 7 テストケースが変更されていない
- [ ] `cmd/combomgr/main.go` の `determineBindAddr()`(行 176-185 想定)が変更されていない
- [ ] `cmd/combomgr/main.go` の `buildAllowedOrigins()` が変更されていない
- [ ] `cmd/combomgr/main.go` の `e.Start(bindAddr)`(行 170 想定)が変更されていない
- [ ] `cmd/combomgr/main.go` の既存ルーター登録 7 行(combohandler / presethandler / movehandler / taghandler / charhandler / setuphandler / debughandler)が変更されていない
- [ ] 設計書本体(REQ-001 / DES-001〜DES-006)が変更されていない
- [ ] SUPP-001 / playbook / architecture-patterns.md / handover が変更されていない
- [ ] 他ドメイン(combo / preset / move / tag / character / setup / debug)のハンドラ・サービス・リポジトリが変更されていない
- [ ] DB マイグレーションが新規追加されていない
- [ ] **新機能の追加実装が含まれていない**(本指示書 §1.3 規定、最重要)
- [ ] **認証ロジックが実装されていない**(SUPP-001 §4.2 / CLAUDE.md §10 フェーズ 2 送り、本指示書 §1.3)
- [ ] **ポート競合フォールバック実装が含まれていない**(M6-RESEARCH-01 §4.5 (1) で持ち越し L-04 確定)
- [ ] **CHANGE 通知書が新規起票されていない**(M6-overview §9 既定通り、M6-01 期間中の起票は未想定)

### 1.5 例外条項適用箇所のチェック(§2.4)

- [ ] (a) `internal/api/config/doc.go` のコメント更新がある場合、`package config` 宣言行は変更されていない
- [ ] (b) DTO フィールド設計の細部(JSON タグ命名、ポインタ型適用)が指示書 §4.2 / §4.3 の方針に沿っている、または逸脱理由が完了報告に明記されている
- [ ] (c) 新規エラーコード文字列が **小文字スネークケース**(`invalid_request` / `validation_failed` / `config_write_failed` / `config_read_failed` 等)で統一されている

---

## 2. 着手前確認結果のチェック(§3.4、retrospective-log §1 パターン A 防止)

製造担当の Plan Mode 計画提示に以下の確認結果が **すべて含まれている** こと:

- [ ] §3.4.1 既存 `internal/config/config.go` 全体の view 確認結果(関数シグネチャ + Config 構造体フィールド + JSON タグ実態)
- [ ] §3.4.2 既存 `cmd/combomgr/main.go` ルーター登録周辺の view 確認結果(150〜168 行付近のパターン + DI 配線実態 + 既存 confighandler import 有無)
- [ ] §3.4.3 既存 BE ハンドラの DTO ファイル配置パターン確認結果(`handler.go` 同居 vs `dto.go` 分離の実態)
- [ ] §3.4.4 共通エラー型 `model.APIError` / `model.APIErrorResponse` の現状確認結果
- [ ] §3.4.5 既存テスト命名規則の確認結果(`Test<Function>_<Scenario>` 形式の実態)
- [ ] §3.4.6 SUPP-001 §5.9 PATCH 系省略可能フィールド送信ポリシー確認

---

## 3. Plan Mode 必須項目の確認(§3.4.7、retrospective-log §1 パターン D 防止)

製造担当の完了報告に以下 6 項目の **開発者承認結果が明示** されていること:

- [ ] **必須項目 1**: `isInitialized` フィールドの判定ロジック実装位置(サービス層 vs ハンドラ層)— 開発者承認方針 + 実装位置の明記
- [ ] **必須項目 2**: `PUT /api/config` のバリデーション失敗時の挙動(全件失敗 + 422 + `details.validations.issues` 構造採用 or 別案)— 開発者承認方針の明記
- [ ] **必須項目 3**: `config.toml` 書き戻しのアトミック性(一時ファイル + `os.Rename` 採用 or 別案)— 開発者承認方針の明記
- [ ] **必須項目 4**: メモリ上 `*config.Config` の DI 方針(サービス層に状態保持 + sync.Mutex or 別案)— 開発者承認方針の明記
- [ ] **必須項目 5**: `PUT /api/config` のスタイル(部分 PUT、SUPP-001 §5.9 ポリシー or 全件 PUT)— 開発者承認方針の明記
- [ ] **必須項目 6**: `restart_required: bool` フィールドのレスポンス DTO 包含可否 + 判定ロジック — 開発者承認方針の明記

---

## 4. API エンドポイント設計のチェック(§4.2)

### 4.1 `GET /api/config`(§4.2.1)

- [ ] レスポンス DTO に `server` / `database` / `logging` / `security` の 4 サブ構造体 + `isInitialized: bool` が含まれている
- [ ] JSON タグが **camelCase** で統一されている(`maxSizeMb` / `maxBackups` / `maxAgeDays` / `passwordEnabled` / `isInitialized` 等)
- [ ] **将来追加される機微情報フィールド除外規約**(JSON タグ `-`)が `dto.go` または `handler.go` の冒頭コメントに明記されている
- [ ] `isInitialized` の判定が **§3.4.7 必須項目 1 の開発者承認方針** に従っている(設計担当推奨はサービス層 `os.Stat(configPath)`)
- [ ] エラー時のレスポンスが `model.APIErrorResponse` 共通型である
- [ ] 成功時のステータスコードが 200 OK
- [ ] **`isInitialized` フィールドが Read-only**(`PUT` リクエストでは受け付けない)

### 4.2 `PUT /api/config`(§4.2.2)

- [ ] リクエスト DTO `UpdateConfigRequest` が **部分更新可能なポインタ型**(`*T`)で受け取っている(§3.4.7 必須項目 5 設計担当推奨)
- [ ] バリデーション失敗時に **422 Unprocessable Entity** + `code: "validation_failed"` + `details.validations.issues` 配列を返す(architecture-patterns.md §3 / DES-002 §4.3.1)
- [ ] 不正な JSON ボディに **400 Bad Request** + `code: "invalid_request"` を返す
- [ ] 書き込みエラーに **500 Internal Server Error** + `code: "config_write_failed"` を返す
- [ ] 成功時に **200 OK** + 更新後の `ConfigResponse` を返す
- [ ] レスポンスに `restartRequired: bool` が含まれている(§3.4.7 必須項目 6 設計担当推奨 = 含める方針採用時)
- [ ] mode 変更時のみ `restartRequired: true` になっている(他フィールド変更では false)

---

## 5. サービス層実装のチェック(§4.3)

### 5.1 関数シグネチャ(§4.3.1)

- [ ] `NewService(cfg *config.Config, configPath string) *Service` のコンストラクタが存在する
- [ ] `Get() (cfg, isInitialized, err)` のメソッドが存在し、値コピーを返す(ハンドラ層での不整合保護)
- [ ] `Update(req)` のメソッドが存在し、`updated`, `validationErrs`, `restartRequired`, `err` を返す(設計担当推奨シグネチャ、製造担当の実装裁量で命名は変わる可能性)
- [ ] `sync.Mutex` で並行アクセス保護されている(§3.4.7 必須項目 4 設計担当推奨方針)

### 5.2 アトミック書き戻し(§4.3.2)

- [ ] **一時ファイル `config.toml.tmp` への書き込み** → `os.Rename(tmpPath, path)` でアトミックに置換するパターンになっている
- [ ] `os.Create` の失敗時、TOML エンコード失敗時、`fsync` 失敗時、`os.Rename` 失敗時すべてで **一時ファイルが残らない**(`os.Remove(tmpPath)` 呼出)
- [ ] エラー時の `fmt.Errorf("...: %w", err)` ラップが適切

### 5.3 バリデーション(§4.3.3)

- [ ] `validateConfig` 等の **独立した同等バリデーションロジック** がサービス層に書かれている(`internal/config/config.go:validate()` を呼び出していない、エクスポート化していない)
- [ ] バリデーション内容が `internal/config/config.go:validate()` と **同等**(`Server.Mode` の `"local"` / `"lan"` 制限、`Server.Port` の範囲制限)
- [ ] バリデーション失敗時の `ValidationIssue.Field` フィールドパス文字列(`server.mode` / `server.port` 等)が DES-002 §4.3.1 / architecture-patterns.md §3 形式と整合

### 5.4 メモリ更新の原子性

- [ ] バリデーション失敗時に `config.toml` 書き戻しが行われない(検証 → 書き戻し → メモリ更新の順序、原子性確保)
- [ ] 書き戻し失敗時にメモリ上 `*config.Config` が更新されない(書き戻し成功後のみメモリ更新)

---

## 6. ハンドラ層実装のチェック(§4.4)

### 6.1 共通方針遵守(§4.4.1、architecture-patterns.md §3)

- [ ] エラーレスポンスがすべて `model.APIErrorResponse` 共通型を使用している(独自エラー型の新設なし)
- [ ] `echo.Context.JSON(http.Status..., model.APIErrorResponse{Error: model.APIError{...}})` の直接呼出パターン(ハンドラ独自ヘルパなし、handover §4.2 L-03 整合)
- [ ] バリデーションエラーが `Details: map[string]any{"validations": map[string]any{"issues": [...]}}` 形式(DES-002 §4.3.1)

### 6.2 ハンドラ関数(§4.4.2)

- [ ] `Get(c echo.Context) error` メソッドが存在する
- [ ] `Update(c echo.Context) error` メソッドが存在する
- [ ] サービス層のエラー / バリデーションエラー / 不正リクエストの 3 種類が **HTTP ステータスコード(500 / 422 / 400)と `code` フィールド** で分岐されている
- [ ] HTTP ステータスコードが指示書 §4.2 と一致(200 / 400 / 422 / 500)
- [ ] エラーコード文字列が **小文字スネークケース**(M4-01 setup 系統一済み、handover §4.1 L-02 関連)

### 6.3 ルーター登録(§4.4.3)

- [ ] `RegisterRoutes(g *echo.Group, h *Handler)` 関数が `routes.go` に存在する
- [ ] `g.GET("/config", h.Get)` + `g.PUT("/config", h.Update)` の 2 ルートが登録されている

---

## 7. テスト要件のチェック(§5.1)

### 7.1 サービス層テスト(§5.1.1、必須 7 件)

- [ ] **TestService_Get_Initialized**: 実装あり、テスト通過
- [ ] **TestService_Get_NotInitialized**: 実装あり、テスト通過(`t.TempDir()` 等で `config.toml` 不在状態を再現)
- [ ] **TestService_Update_Success**: 実装あり、テスト通過(メモリ + ファイル両方の更新確認)
- [ ] **TestService_Update_ValidationFailure**: 実装あり、テスト通過(失敗時に `config.toml` が変更されていない原子性確認)
- [ ] **TestService_Update_RestartRequired**: 実装あり、テスト通過(mode 変更検知)
- [ ] **TestService_Update_AtomicWrite**: 実装あり、テスト通過(`.tmp` ファイルが残っていない確認)
- [ ] **TestService_Update_PartialUpdate**: 実装あり、テスト通過(SUPP-001 §5.9 部分更新ポリシー確認)

### 7.2 ハンドラ層テスト(§5.1.2、必須 6 件、httptest 使用)

- [ ] **TestHandler_Get_Success**: 実装あり、テスト通過(200 OK + JSON 構造確認)
- [ ] **TestHandler_Get_InternalError**: 実装あり、テスト通過(500 + `model.APIErrorResponse` 構造)
- [ ] **TestHandler_Update_Success**: 実装あり、テスト通過(200 OK + 更新後レスポンス)
- [ ] **TestHandler_Update_InvalidJSON**: 実装あり、テスト通過(400 + `code: "invalid_request"`)
- [ ] **TestHandler_Update_ValidationFailure**: 実装あり、テスト通過(422 + `code: "validation_failed"` + `details.validations.issues`)
- [ ] **TestHandler_Update_WriteFailure**: 実装あり、テスト通過(500 + `code: "config_write_failed"`)

### 7.3 既存テスト回帰なし(§5.1.3)

- [ ] `internal/config/config_test.go` 既存 7 ケース全通過
- [ ] `internal/api/setup/handler_test.go` 等の他ドメインテスト全通過
- [ ] `go test ./...` 全件通過

### 7.4 ビルド・型チェック(§5.1.4)

- [ ] `go build ./...` 成功
- [ ] `go vet ./...` でエラーなし
- [ ] `gofmt -l .` で未整形ファイルなし

---

## 8. E2E シナリオ実行結果のチェック(§5.2)

製造担当の完了報告に以下の curl 実行結果が **すべて含まれている** こと(実機検証は開発者の責任範囲):

- [ ] **シナリオ A**: `config.toml` 不在状態での `GET /api/config` → `isInitialized: false` + デフォルト値
- [ ] **シナリオ B**: `PUT /api/config` 部分更新(`logging.level: debug`)→ 200 OK + `config.toml` 新規作成 + 他フィールド不変
- [ ] **シナリオ C**: バリデーション失敗(`mode: "invalid"`)→ 422 + `details.validations.issues[].field: "server.mode"`
- [ ] **シナリオ D**: 不正 JSON → 400 + `code: "invalid_request"`
- [ ] **シナリオ E**: mode 変更(`local` → `lan`)→ 200 OK + `restartRequired: true` + `config.toml` 書き換え確認
- [ ] **シナリオ F**: アトミック性確認(`.tmp` 残らない、開発者の任意確認項目)
- [ ] **シナリオ G**: 既存機能の回帰確認(`/api/characters`、`/api/combos`、`/api/setups` 既存応答が正常)

---

## 9. コード品質・規約遵守

- [ ] CLAUDE.md §4 規約(JSON タグ camelCase、TOML タグ snake_case、Go フィールド PascalCase)遵守
- [ ] CLAUDE.md §5 テスト規約遵守
- [ ] CLAUDE.md §10 禁止事項に抵触なし(セキュリティ自己判断なし、機微情報のログ出力なし等)
- [ ] **architecture-patterns.md §2 3 層パターン遵守**(handler / service / 既存 config の責務分離)
- [ ] **architecture-patterns.md §3 エラーレスポンス共通型遵守**(独自エラー型なし、`model.APIErrorResponse` 直接使用、ハンドラ独自ヘルパなし)
- [ ] **shadcn/ui を使用していない**(本 M6-01 はバックエンドのみ、フロントエンドファイルが新規追加されていないため該当事象は発生しないが念のため)
- [ ] **設計書本体への影響なし**(M4-15 反省踏襲、CHANGE 通知書起票不要の根拠が完了報告に明記されている)

---

## 10. ドキュメント・進捗ログ(§7.4)

- [ ] `docs/progress/progress-log.md` に M6-01 完了報告が追記されている
- [ ] §3.4 着手前確認結果(§3.4.1〜§3.4.6 全 6 項目)が完了報告に含まれている
- [ ] §3.4.7 Plan Mode 必須項目の開発者承認結果(全 6 項目)が完了報告に含まれている
- [ ] §4.5 設計判断事項表との整合確認結果が明記されている
- [ ] §5.2 E2E シナリオ A〜G の curl 実行結果が明記されている
- [ ] 例外条項適用箇所(§2.4 (a) (b) (c))の明示
- [ ] M5-RESEARCH-01 / M6-RESEARCH-01 で確立した「製造担当からの実装完了後連絡事項」(handover §6.2)が含まれている、または「乖離なし」が明記されている

---

## 11. 重大な問題の判定基準

以下のいずれかに該当する場合、**重大な問題** と判定し M6-01 完了承認を保留する:

- §1.1 / §1.2 新規ファイルが指示書 §2.1 と乖離(handler.go / routes.go / service.go / テスト 2 件のいずれかが欠落)
- §1.3 修正ファイル `cmd/combomgr/main.go` への DI 配線が未追加または不整合
- **§1.4 スコープ外への変更が含まれている**(`internal/config/config.go` 変更、`determineBindAddr` 変更、設計書本体変更、新機能追加、認証ロジック実装、ポート競合フォールバック実装、新規 CHANGE 起票、DB マイグレーション追加、shadcn/ui 導入等、最重要)
- §2 着手前確認結果が完了報告に含まれていない(retrospective-log §1 パターン A 防止の最重要観点)
- §3 Plan Mode 必須項目(6 件)の開発者承認結果が完了報告に含まれていない(retrospective-log §1 パターン D 防止の最重要観点)
- §4.1 / §4.2 API エンドポイント設計が指示書 §4.2 と乖離(エラーコード文字列の命名規約違反、HTTP ステータスコード違反、`isInitialized` / `restartRequired` フィールド欠落)
- §5.2 / §5.3 サービス層実装がアトミック書き戻し or 原子性確保を満たしていない(`config.toml.tmp` 残存可能性、バリデーション失敗時の書き戻し可能性等)
- §6 ハンドラ層実装が `model.APIErrorResponse` 共通型を使っていない(独自エラー型新設、handover §4.2 L-03 違反)
- §7.1 / §7.2 必須テスト(サービス層 7 件 + ハンドラ層 6 件)のいずれかが未実装または失敗
- §7.3 既存テスト回帰(`internal/config/config_test.go` 7 ケース or 他ドメインテストのいずれかが失敗)
- §7.4 ビルド・型チェック失敗
- §8 E2E シナリオ A〜G のいずれかが完了報告に含まれていない(または失敗結果のまま)
- §9 architecture-patterns.md §2 / §3 違反
- §10 progress-log.md 完了報告に必須項目が含まれていない

---

## 12. 軽微な問題の判定基準(完了承認可、改善推奨)

以下は軽微な問題で、完了承認は可だが次回マイルストーン以降の改善対象として記録する:

- §1.5 例外条項適用箇所の理由明記が不十分(逸脱理由の説明が薄い)
- §4 DTO の細部(コメント文言、ヘルパ関数の命名)が既存パターンと微妙に異なる(機能には影響なし)
- §5 サービス層の独立バリデーションロジックが `internal/config/config.go:validate()` と微妙に異なる文言(`"invalid server.mode"` vs `"server.mode is invalid"` 等、機能等価)
- §6 ハンドラのエラーログ出力レベル(slog レベル選定)が他ハンドラと微妙に異なる
- §7 テストヘルパ関数の重複(setup と config で似た `t.TempDir()` 利用パターンが共通化されていない、YAGNI 観点で許容)
- ドキュメント記述の細部不整合(完了報告の節構成、文体等、機能には影響なし)

---

## 13. レビュー報告書フォーマット

機械レビュー完了時に以下を含む報告書を `docs/progress/m6-01-review.md` として出力:

```markdown
# M6-01 機械レビュー報告書

## 1. レビュー実施日
2026-XX-XX

## 2. レビュー結果サマリ
- ✅ / ⚠️ / ❌ §1 ファイル一覧チェック
- ✅ / ⚠️ / ❌ §2 着手前確認結果(retrospective-log §1 パターン A 防止)
- ✅ / ⚠️ / ❌ §3 Plan Mode 必須項目(retrospective-log §1 パターン D 防止、最重要)
- ✅ / ⚠️ / ❌ §4 API エンドポイント設計
- ✅ / ⚠️ / ❌ §5 サービス層実装
- ✅ / ⚠️ / ❌ §6 ハンドラ層実装
- ✅ / ⚠️ / ❌ §7 テスト要件
- ✅ / ⚠️ / ❌ §8 E2E シナリオ実行結果
- ✅ / ⚠️ / ❌ §9 コード品質・規約遵守
- ✅ / ⚠️ / ❌ §10 ドキュメント

## 3. Plan Mode 必須項目 6 件の開発者承認結果確認(最重要)
- 必須項目 1(`isInitialized` 判定位置): 承認方針 = ...、実装 = ...
- 必須項目 2(バリデーション失敗時挙動): 承認方針 = ...、実装 = ...
- 必須項目 3(アトミック書き戻し): 承認方針 = ...、実装 = ...
- 必須項目 4(メモリ DI 方針): 承認方針 = ...、実装 = ...
- 必須項目 5(部分 PUT or 全件 PUT): 承認方針 = ...、実装 = ...
- 必須項目 6(`restart_required` フィールド): 承認方針 = ...、実装 = ...

## 4. 検出した問題
### 4.1 重大な問題(完了承認保留)
(該当する場合、§11 判定基準のどれに該当するか明記)

### 4.2 軽微な問題(完了承認可、改善推奨)
(該当する場合、§12 判定基準のどれに該当するか明記)

### 4.3 改善提案(次回マイルストーン以降)
(該当する場合)

## 5. 制約事項
- 本レビューは静的コードレビュー。**実機テスト(ブラウザでの動作確認、E2E シナリオ A〜G の curl 実行、`config.toml` 書き戻しの実際の確認)は別途実施が必要**(playbook §14)
- 動作確認シナリオの手動確認は開発者の責任範囲

## 6. 完了承認判定
- ✅ 完了承認可 / ⚠️ 条件付き承認(改善後) / ❌ 完了承認保留(重大な問題あり)
```

---

*以上*

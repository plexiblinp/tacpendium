# M6-01 レビュー報告書

## 1. レビュー実施日
2026-05-23

## 2. レビュー結果サマリ

- ⚠️ §1 ファイル一覧チェック — 実装ファイルはすべて揃っているが §1.3 の位置確認に補足あり
- ❌ §2 着手前確認結果（retrospective-log §1 パターン A 防止）— 完了報告に §3.4.1〜§3.4.6 の view 確認サマリが未記載
- ✅ §3 Plan Mode 必須項目（retrospective-log §1 パターン D 防止、最重要）— 6 件全項目の承認結果が明示されている
- ✅ §4 API エンドポイント設計 — 指示書 §4.2 に準拠
- ✅ §5 サービス層実装 — アトミック書き戻し・部分更新・バリデーション・Mutex 保護すべて適切
- ✅ §6 ハンドラ層実装 — `model.APIErrorResponse` 共通型、HTTP ステータスコード、エラーコード命名すべて適切
- ✅ §7 テスト要件 — 必須 13 件すべて実装・通過、既存テスト回帰なし
- ⚠️ §8 E2E シナリオ実行結果 — A〜E + G の 6 件は完了報告に記載あり。シナリオ F（任意）は省略（仕様上は許容）
- ✅ §9 コード品質・規約遵守 — CLAUDE.md §4 / architecture-patterns.md §2 / §3 準拠
- ⚠️ §10 ドキュメント — §3.4.1〜§3.4.6 着手前確認結果の記載が欠落

---

## 3. Plan Mode 必須項目 6 件の開発者承認結果確認（最重要）

完了報告（progress-log.md §M6-01）に以下が明示されている。

| 必須項目 | 承認方針 | 実装確認 |
|--------|---------|---------|
| 1. `isInitialized` 判定位置 | サービス層（`os.Stat(configPath)`） | `service.go:fileExists()` ✅ |
| 2. バリデーション失敗時挙動 | 全件失敗 + 422 + `details.validations.issues` | `handler.go:Update()` / `service.go:validateConfig()` ✅ |
| 3. アトミック書き戻し | `.tmp` → fsync → `os.Rename` | `service.go:writeAtomic()` ✅ |
| 4. メモリ DI 方針 | サービス層に `sync.Mutex`（非公開 `service` 構造体） | `service.go:type service struct` ✅ |
| 5. 部分 PUT or 全件 PUT | 部分更新（SUPP-001 §5.9、`*T` ポインタ型） | `dto.go:UpdateConfigRequest` + `service.go:Update()` ✅ |
| 6. `restart_required` フィールド | レスポンス DTO に含める（mode 変更時のみ true） | `dto.go:ConfigResponse.RestartRequired` + `service.go:restart` 検知 ✅ |

---

## 4. 検出した問題

### 4.1 重大な問題（完了承認保留）

**[C-01] 完了報告に §3.4.1〜§3.4.6 の着手前確認結果（view 確認サマリ）が含まれていない**

チェックリスト §2（着手前確認結果）および §10（ドキュメント）の必須項目、ならびに §11 重大問題判定基準「§2 着手前確認結果が完了報告に含まれていない」に該当。

`docs/progress/progress-log.md` の M6-01 完了報告（行 1783 以降）に以下 6 点の記載がない:

| 確認項目 | 完了報告記載 |
|--------|-----------|
| §3.4.1 `internal/config/config.go` 全体 view 確認結果（JSON タグ実態 / validate() 内容） | 未記載 |
| §3.4.2 `cmd/combomgr/main.go` ルーター登録周辺 view 確認結果（DI 配線実態 / 未 import 確認） | 未記載 |
| §3.4.3 既存 BE ハンドラの DTO ファイル配置パターン確認結果（`dto.go` 分離 vs 同居の実態） | 未記載 |
| §3.4.4 `model.APIError` / `model.APIErrorResponse` 型定義の確認結果 | 未記載 |
| §3.4.5 既存テスト命名規則の確認結果（`Test<Function>_<Scenario>` 形式の実態） | 未記載 |
| §3.4.6 SUPP-001 §5.9 PATCH 系省略可能フィールド送信ポリシーの確認 | 未記載 |

**補足**: 実装コード自体は各確認を実施した結果を正しく反映しており（DTO フィールドが既存 Config 構造体と完全一致、命名規則が既存パターンと整合等）、確認作業は行われた可能性が高い。しかし retrospective-log §1 パターン A「実コード確認の省略」の再発防止のため、完了報告への明示記載が義務付けられており（指示書 §3.4.8 / §9.4）、この記載漏れを重大な問題として判定する。

---

### 4.2 軽微な問題（完了承認可、改善推奨）

**[M-01] `fileExists` の非 ErrNotExist エラーへの対応が完了報告で未明示**

`service.go:fileExists()` は `os.Stat` が返す任意のエラー（権限エラー等）に対して `false` を返す実装になっている。指示書 §4.2.1 ではこの挙動（`false` 返却 vs エラー伝搬）を Plan Mode で確定するよう指示されていたが、完了報告の Plan Mode 項目 1 の記述は「サービス層（`os.Stat(configPath)`）」のみで、非 ErrNotExist エラー時の挙動を明記していない。

実装として `false` 返却は合理的な選択であり機能上の問題はないが、設計判断の明示が不足している。

**[M-02] `TestService_Get_Initialized` のポート確認アサーションが実質デフォルト値確認になっている**

```go
svc := NewService(defaultCfg(), configPath)  // defaultCfg() でポート 47318 を注入
...
if cfg.Server.Port != 47318 {               // ファイル内容ではなくメモリ上の値を確認
```

`NewService` に渡す `*config.Config` が `defaultCfg()`（Port=47318）のため、このアサーションは config.toml ファイルの読み込み結果ではなくデフォルト値を検証している。テストの意図（`isInitialized: true` の確認）は正しく達成されているが、ポートのアサーションが冗長かつやや誤解を招く。機能上の問題はなく、テストは正しく通過する。

---

### 4.3 改善提案（次回マイルストーン以降）

**[I-01] `fileExists` のエラーハンドリング強化（M7 以降）**

現状の `fileExists(path string) bool` は権限エラー等を `false` として扱う。将来的には `os.IsNotExist(err)` で「ファイル不在」と「その他エラー」を区別し、後者はエラーとして上位に伝搬することでオペレーション障害を早期検知しやすくなる。M6-01 範囲での変更は不要だが、M7 設計時に検討推奨。

---

## 5. 良かった点

1. **Service インターフェース定義による高いテスト容易性**: `service.go` に `Service` インターフェースを定義し、具体実装を非公開 `service` 構造体とするパターンを採用。`NewHandler(svc configsvc.Service)` がインターフェース受取にしたため、`handler_test.go` でモックを差し込める設計になっている（`setupsvc.Service` 慣例と一致）。

2. **`writeAtomic` の実装が指示書サンプルより堅牢**: `defer f.Close()` を使わず encode / sync / close を順次実行し各段階でエラーチェックと一時ファイル削除を行う実装。`defer` だと encode 失敗後も Close が無条件に走る問題を回避しており、リソース管理がより明示的。

3. **スコープ厳守**: `internal/config/config.go`・`determineBindAddr`・`buildAllowedOrigins`・`e.Start(bindAddr)` のすべてが無変更。指示書 §2.3「変更しないもの」を完全遵守している。

4. **機微情報除外規約の明文化**: `dto.go` 冒頭コメントに将来追加される `PasswordHash` 等の機微情報フィールドを `json:"-"` で除外する規約を明記。現状は機微情報フィールドが存在しないが、将来の実装者への伝達が適切になされている。

5. **既存テスト回帰なし + 新規テスト 13 件網羅**: `go test ./...` 全件通過。サービス層 7 件・ハンドラ層 6 件の必須テストがすべて実装されており、部分更新（SUPP-001 §5.9）・アトミック性・restartRequired 検知等の設計意図が検証されている。

6. **camelCase / snake_case タグ分離の徹底**: DTO フィールドが Go PascalCase、JSON タグ camelCase（`maxSizeMb` / `maxBackups` / `maxAgeDays` / `passwordEnabled` / `isInitialized` / `restartRequired`）で統一。TOML タグは既存 Config 構造体の snake_case を変更せず、指示書 §4.2 の JSON タグ命名規約と整合。

---

## 6. 制約事項

- 本レビューは静的コードレビュー。**実機テスト（ブラウザでの動作確認、E2E シナリオ A〜G の curl 実行、`config.toml` 書き戻しの実際の確認）は別途実施が必要**（playbook §14）
- 動作確認シナリオの手動確認は開発者の責任範囲

---

## 7. 完了承認判定

**❌ 完了承認保留（重大な問題あり）**

重大な問題 [C-01]（完了報告への §3.4.1〜§3.4.6 着手前確認結果の記載漏れ）が解消されるまで保留。

**解消手順**: `docs/progress/progress-log.md` の M6-01 完了報告に §3.4.1〜§3.4.6 の着手前確認サマリ（6 項目）を追記すること。内容は実際に view 確認した結果の要点（例: 「§3.4.1: Config 構造体に JSON タグ未付与を確認 → dto.go で別途定義」等）で可。

---

*本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機テストは別途実施が必要。*

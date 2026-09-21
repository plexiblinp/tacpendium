# M1-03 レビュー報告書

| 項目 | 内容 |
|------|------|
| レビュー対象 | M1-03(コンボ CRUD API とサービス層) |
| 対象指示書 | `docs/instructions/M1-03-combo-crud-api.md` v1.3.0 |
| レビューチェックリスト | `docs/instructions/reviews/M1-03-review-checklist.md` v1.0.0 |
| レビュー日 | 2026-04-30 |
| レビュー担当 | 品質レビュー Claude(Sonnet 4.6) |
| 対象コミット範囲 | feature/m1-core-foundation 上の作業ツリー(未コミット差分含む) |

---

## 総評

M1-03 の成果物は、7 エンドポイント・VAL-C01〜C12 全件・楽観的排他・PUT キー変更編集(旧削除＋setup 引き継ぎ)・N+1 防止・recipe_cache の M1-04 向け TODO 明示など、指示書の主要要件をほぼ漏れなく実装している。テスト網羅性も高く、`go test ./...` は全通過。特に CalcRecipeHash の determinism・Flags ソート正規化・各 VAL の本登録/仮登録分岐・setup 引き継ぎの統合テストは堅牢。M1-02 レビューで指摘した migration 失敗時の slog 記録も本 M1-03 で対処済みの形跡が確認された。

一方で **重大度「高」の問題が 1 件**ある。`internal/repository/combo` パッケージが `internal/service/validation` を import しており、リポジトリ層からサービス層への上向き依存 (逆依存) が生じている。Go のコンパイルは通るが、クリーンアーキテクチャに反し、将来の循環依存リスクの起点となる。加えて、ハンドラの内部エラーログが `slog` ではなく Echo 独自ロガー経由になっており、ログファイルへの出力が欠落する点が「中」優先度として指摘する。

---

## 設計準拠性レビュー結果

| チェック項目 | 結果 | 詳細 |
|-------------|------|------|
| DES-006 §2 の VAL-C01〜VAL-C12 が全て実装 | ◎ | `internal/service/validation/combo.go` に `validateC01CharacterExists` 〜 `validateC12RushVariantOriginal` を確認。VAL-ID 定数(`CodeC01CharacterExists`〜`CodeC12RushVariantOriginal`)も全件定義。 |
| SUPP-001 §2.1 仮登録の NULL 許容ルール(VAL-C09 スキップ等) | ◎ | `if !isDraft { validateC09RecipeNotEmpty(...) }` ✓。VAL-C06/C07 も同様に `if !isDraft {}` でスキップ。VAL-C04/C05 は NULL なら `return`(NULL 許容)。VAL-C02 は `if !isDraft {}` で完全スキップ(SUPP-001 §2.3・DES-006 §2.3 に従い仮登録は重複判定しない) ✓。 |
| SUPP-001 §2.2 重複判定がリスト定数で定義、modifiers 含む完全一致 | ◎ | `DuplicateCheckFields = []string{"character_id","recipe_hash","starter_move_id","position","opponent_stance","hit_type","opponent_size"}` と定義。`CalcRecipeHash` は step_order ソート＋Flags ソートで決定論的 JSON ハッシュを生成。CHANGE-006(hit_type) 反映済み。 |
| HANDOVER-001 §3.1 編集方式分離(PATCH/PUT) | ◎ | PATCH → `UpdateMetadata`(メタデータ直接更新)、PUT → `UpdateWithKeyChange`(旧削除→新作成)の 2 方式を分離実装。指示書 §4.1 に沿ってクライアント側に明示的に分担させる方式を採用(HANDOVER-001 §3.1 の「バックエンド自動判定」からの設計変更は指示書で明文化済み)。 |
| PUT 時に旧コンボ論理削除 + 新作成 + セットプレイ引き継ぎ | ◎ | `UpdateWithKeyChange` でトランザクション内: 旧コンボに `WHERE id=? AND version=? AND deleted_at IS NULL` で楽観排他＋論理削除 → 新 INSERT → `UpdateSetupReferences(old, new)` で combo_setups 付け替え → Commit。`TestService_UpdateWithKeyChange_PreservesSetupLink` で引き継ぎ確認済み。 |
| NFR203 楽観的排他制御(version カラム + RowsAffected) | ◎ | `UpdateMetadata`: `WHERE id=? AND version=? AND deleted_at IS NULL`。`UpdateWithKeyChange`: 同条件。RowsAffected=0 時に `ErrConflict` → ハンドラが 409 を返す。両メソッドのバージョン衝突テスト実装済み。 |
| SUPP-001 §5.1 APIレスポンスに `move_id` と `move_code` 両方 | ◎ | `StepResponse` に `MoveID *int64` と `MoveCode *string` を保持。リポジトリ `findStepsByComboID` が `LEFT JOIN moves m ON cs.move_id = m.id` で `m.code AS move_code` を取得。`TestRepository_InsertAndFindByID` でスキャンを確認。 |
| SUPP-001 §2.3 recipe_cache は M1-04 への TODO として明示 | ◎ | `service.go` に `// TODO(M1-04): notation.Service.RecalcRecipeCache(...)` が Create/UpdateWithKeyChange/Delete/Restore の各箇所に明示。recipe_cache カラムは NULL のまま。 |
| 起き攻め BOOLEAN が 6 カラム(CHANGE-001) | ◎ | DTO(CreateRequest/UpdateMetadataRequest/ComboResponse)・CreateInput・UpdateMetadataInput・InsertCombo SQL・FindByID SQL・UpdateMetadata SET 句の全レイヤーで正確に 6 カラム一致。 |
| opponent_stance に `any` が許容値に含まれているか(CHANGE-003) | ◎ | `model/combo.go` に `OpponentStanceAny = "any"` 定数あり。バリデーションは値の列挙チェックをしないが、これは DES-006 §1.1 の方針(「フロントエンドが固定選択式で第一防衛線」)に従った設計。 |

---

## コード品質レビュー結果

| チェック項目 | 結果 | 詳細 |
|-------------|------|------|
| エラーラップ `fmt.Errorf("...: %w", err)` | ◎ | service.go・repository.go・main.go の全エラーパスで徹底。 |
| `context.Context` がサービス層・リポジトリ層の全公開メソッドに存在 | ◎ | Service・Repository の全メソッドシグネチャに `ctx context.Context` を確認。 |
| 公開関数に godoc コメント | ◎ | `Service`・`Repository` インタフェースの全メソッド、`New`・`RegisterRoutes`・`ValidateComboForCreate`・`CalcRecipeHash` 等すべてに godoc あり。Steps nil/非 nil 規約も `FindByID` と `List` の godoc に明記。 |
| ハンドラ層がビジネスロジックを持たず、サービス層に委譲 | ◎ | handler.go はリクエスト Bind → サービス呼出 → レスポンス変換のみ。バリデーション・重複判定・楽観排他はすべてサービス/バリデーション層に委譲。 |
| リポジトリ層が SQL のみを扱い、ビジネスロジックを持っていない | △ | SQL クエリの集約はできているが、`FindActiveByDuplicateKey(ctx context.Context, key validation.DuplicateKey)` の引数型として `service/validation.DuplicateKey` を使用しており、リポジトリ層がサービス層のパッケージを import している(詳細は「高」優先指摘参照)。 |
| DTO ↔ モデル変換が適切に分離 | ◎ | `dto.go` に `toServiceCreateInput`・`toServiceUpdateMetadataInput`・`toComboResponse` の変換ヘルパを集約。ハンドラから直接モデルを扱わない。 |
| SQL Injection 対策(全クエリでプレースホルダ `?` 使用) | ◎ | `List` の動的クエリ: `sortCol` はハードコード switch 文で制限、`order` は `"asc"` 判定のみ→`"ASC"`/`"DESC"` の 2 値のみ出力。ユーザー入力が直接 SQL 文字列に混入しない。`FindActiveByDuplicateKey` も同様。 |

### 追加所見

#### ハンドラの内部エラーログが slog を使っていない(中優先)

`handler.go` のエラーログが Echo 独自の `c.Logger().Errorf(...)` を使用している。

```go
c.Logger().Errorf("create combo: %v", err)
```

Echo のデフォルトロガーは標準出力に出力し、M1-01 で設定した `slog + lumberjack`(ファイル書き込み)のルートロガーには流れない。500 エラーがログファイルに記録されず、本番環境でのデバッグが困難になる。

**修正案**: `slog.ErrorContext(c.Request().Context(), "create combo", slog.String("err", err.Error()))` に変更する。

#### UpdateWithKeyChange のバリデーション タイミング(情報提供)

`UpdateWithKeyChange` は旧コンボ論理削除「前」に VAL-C02 を実行するため、PUT のキーが旧コンボと完全に同一の場合(= PATCH で扱うべき操作を誤って PUT で呼んだ場合)、旧コンボが候補にヒットして VAL-C02 が false positive を返す可能性がある。service.go にコメントとして認識済みであり、M1-03 の curl シナリオ(= 必ずキーを変える)では実害は出ない。M1-05/M1-06 でフロント実装時に留意すること。

---

## テスト網羅性

| チェック項目 | 結果 | 詳細 |
|-------------|------|------|
| サービス層テストが SUPP-001 §5.5 の「必須」レベルを満たすか | ◎ | Create 正常系(本登録・仮登録両方)・VAL-C01/C02 発火・仮登録での C02 スキップ・UpdateMetadata 正常系＋衝突・UpdateWithKeyChange 正常系＋衝突＋setup 引き継ぎ・Delete 正常系＋NotFound・Restore 正常系＋NotFound・List フィルタを網羅。 |
| VAL-C01〜C12 全てに対応するテストケースがあるか | ○ | `combo_test.go`(バリデーション層)で C01〜C12 の全 VAL-ID に正常系・異常系各 1 件以上を確認。C07 の仮登録スキップテストが明示的にない(詳細は「低」指摘参照)。 |
| 重複判定の決定性・Flags キー順不変・異レシピ異ハッシュのテスト | ◎ | `duplicate_keys_test.go` に `TestCalcRecipeHash_Deterministic`・`TestCalcRecipeHash_StepOrderInvariant`・`TestCalcRecipeHash_FlagsOrderInvariant`・`TestCalcRecipeHash_DifferentRecipes_DifferentHashes`・`TestCalcRecipeHash_NullMoveID`・`TestCalcRecipeHash_EmptyRecipe` を確認。指示書要求をすべてカバー。 |
| テストが他のテストに影響を与えないか(各テストで独立 DB) | ◎ | `dbtest.Setup(t)` が `t.TempDir()` 配下のファイルを使うため各テスト関数で独立した DB ファイルが生成される。テスト終了時に `t.Cleanup` で Close。 |
| 楽観的排他衝突テストがあるか | ◎ | `TestService_UpdateMetadata_VersionConflict`・`TestService_UpdateWithKeyChange_VersionConflict`・`TestRepository_UpdateMetadata_VersionConflict` を確認。 |
| PUT 旧コンボ論理削除+新作成+setup 引き継ぎが確認されているか | ◎ | `TestService_UpdateWithKeyChange_OK`(旧 ID が ErrNotFound になること)と `TestService_UpdateWithKeyChange_PreservesSetupLink`(combo_setups.combo_id が新 ID に付け替わること)で両方確認。 |

---

## API 設計準拠

| チェック項目 | 結果 | 詳細 |
|-------------|------|------|
| 7 エンドポイント全て実装されているか | ◎ | `routes.go` に POST/GET/GET-list/PATCH/PUT/DELETE/POST-restore の 7 ルートを確認。`TestHandler_*` でハンドラテストも全エンドポイントカバー。 |
| エラーレスポンス形式が統一されているか(`error`・`message`・`validations` キー) | ◎ | `ErrorResponse` struct で `Error`・`Message`・`Validations` フィールドを統一。`ComboResponse` にも `Validations *validation.ValidationResult` が含まれる(WARNING がある場合のみ)。 |
| HTTPステータスコードが妥当か | ◎ | POST 201・GET 200・PATCH 200・PUT 201(新リソース作成)・DELETE 204・400/404/409/500 すべて正しい。`TestHandler_*` でステータス検証済み。 |

---

## 禁止事項違反の有無

| チェック項目 | 結果 | 詳細 |
|-------------|------|------|
| `localStorage` 等のフロント禁止項目に触れていないか | ◎ | 本指示書は Go 側中心。フロント変更なし。 |
| `console.log` / `fmt.Println` の本番コード残存がないか | ◎ | grep で全対象ファイルを確認。本番コードに `fmt.Println` / `fmt.Print` 等の残存なし。 |
| Git 操作の Bash 実行がないか | ◎ | 確認。 |

---

## 設計準拠性以外の指摘事項

### repository 層が service 層を import している(高優先・詳細)

`internal/repository/combo/repository.go` が `internal/service/validation` を import し、`validation.DuplicateKey` 型を `FindActiveByDuplicateKey` の引数型として使用している。

```go
// repository.go — 問題箇所
import "github.com/plexiblinp/combomgr/internal/service/validation"

func (r *repository) FindActiveByDuplicateKey(ctx context.Context, key validation.DuplicateKey) ([]model.Combo, error) {
```

依存方向のあるべき姿:
```
model  ←  repository  ←  service/validation
                      ←  service/combo
```

現状の依存:
```
repository/combo → service/validation  ← 逆向き依存（違反）
service/combo    → service/validation
service/combo    → repository/combo
```

Go コンパイラは通るが(循環なし)、将来 `service/validation` が `repository/combo` を参照するようになると循環依存になる。

**修正案**: `DuplicateKey` と `DuplicateCandidate` を `internal/repository/combo/` パッケージに移動し、`service/validation` のインタフェース `ComboDuplicateChecker` の `FindActivePublishedDuplicates` の引数型も `comborepo.DuplicateKey` に変更する。または `internal/model/` に `DuplicateKey` を置く(model は全層から参照可能)。

---

## 推奨修正(優先度別)

### 高(M1-04 着手前に修正必須)

1. **`repository/combo` から `service/validation` への逆依存を解消する**
   - `internal/service/validation/combo.go` に定義されている `DuplicateKey`・`DuplicateCandidate` を `internal/repository/combo/` パッケージに移動する。
   - `ComboDuplicateChecker` インタフェースの `FindActivePublishedDuplicates` の引数型を `comborepo.DuplicateKey` に変更する。
   - `service/combo` の `ComboDuplicateAdapter.FindActivePublishedDuplicates` もそれに合わせる。
   - この修正により `repository/combo` は `service/validation` を import しなくなる。

### 中(M1-04 着手と並行可)

2. **ハンドラの内部エラーログを `c.Logger()` から `slog.ErrorContext` に変更する**
   - handler.go の全 `c.Logger().Errorf(...)` を `slog.ErrorContext(c.Request().Context(), ...)` に変更。
   - Echo の logger は slog handler に接続されていないため、500 エラーがログファイルに記録されない。

### 低(将来対応)

3. **VAL-C07 の仮登録スキップテストを追加する**
   - `combo_test.go` に `TestC07_SAConsumption_DraftSkipped` を追加して、C06 と同様に仮登録時はスキップされることを明示的に保証する。

4. **VAL-C03 の冗長な先頭条件を整理する**
   - `validateC03StarterMatchesStep1` 内の 1 番目の `if isDraft && combo.StarterMoveID == nil { return }` は 2 番目の `if combo.StarterMoveID == nil { return }` に包含されるため冗長。機能上の問題はないが、可読性向上のために削除可能。

5. **論理削除済みコンボへの Delete が冪等(204)かつ SoftDelete コメントが「冪等」と明記されているが、ハンドラテストに "already deleted → 204" のケースが存在しない**
   - 現状の実装は `WHERE id = ?`(deleted_at 不問)で UPDATE するため deleted_at を上書きし RowsAffected=1 を返す。これにより「再削除は 204」が正しい動作だが、明示的なテストケースがない。挙動を仕様として保証するテストを追加することが望ましい。

---

## 良かった点

1. **VAL-C01〜C12 の本登録/仮登録分岐が正確**: `ValidateComboForCreate` の `isDraft` フラグによる分岐が DES-006 §2.2・SUPP-001 §2.1 と完全一致。特に C02 の「仮登録は試案のため完全スキップ」を Q3 確定事項として godoc に明記している点が良い。

2. **CalcRecipeHash の実装品質**: 入力スライスを破壊しないコピー後ソート・Flags の sorted copy・`emptyRecipeHash` の precompute など防御的実装が徹底されており、テストで decision-theoretic 性質(決定論性・Flags 順序不変・空スライス vs nil 同一視)が網羅されている。

3. **setup 引き継ぎの統合テスト**: `TestService_UpdateWithKeyChange_PreservesSetupLink` が setup レコードを直接 INSERT してから PUT を実行し、`combo_setups.combo_id` の付け替えを DB レベルで確認している。副作用まで検証するレベルの高いテスト。

4. **dbtest.Setup によるテスト分離**: `t.TempDir()` を使ったファイル DB で各テストが完全に独立しており、シード済み技マスタを含む現実に近いフィクスチャが全テストで利用できる。テストの信頼性が高い。

5. **N+1 防止規約が godoc に明記**: `FindByID`(Steps をロードして返す)と `List`(Steps=nil を返す)の godoc に「N+1 防止、§4.11」への参照が明記され、実装者の意図が後続に伝わる。

6. **DI 配線が main.go に集約**: `comborepo.New` → `combosvc.CharacterAdapter`/`MoveAdapter`/`ComboDuplicateAdapter` の DI が `main.go` の `run()` に集約されており、テスト時は `service_test.go` で独立した依存を組み立てられる設計になっている。

7. **M1-02 レビュー指摘「migration 失敗時の slog 記録なし」を M1-03 で対処**: `main.go` に `slog.ErrorContext(ctx, "migration failed", ...)` が追加されており、M1-02 レビューの中優先指摘が次のマイルストーンで反映された。

---

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の API 動作確認・パフォーマンス・実機テストは別途実施が必要。
- `go test ./...` は全通過を確認(キャッシュ経由)。実行環境の差異による可能性は排除できない。

---

*以上*

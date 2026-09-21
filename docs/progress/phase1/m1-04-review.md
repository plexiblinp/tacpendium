# M1-04 レビュー報告書

| 項目 | 内容 |
|------|------|
| レビュー日 | 2026-05-01 |
| 対象指示書 | `docs/instructions/M1-04-presets-and-recipe-cache.md` v1.2.0 |
| レビュー担当 | 品質レビュー担当 Claude (claude-sonnet-4-6) |

---

## 総評

M1-04 の成果物全体として、設計準拠性は高く、主要な機能は正しく実装されている。コンボサービスへの notation サービス DI、recipe_cache の JSON 管理、エイリアス変換フォールバック（DES-004 §5.3）はいずれも適切に実装されている。一方で **テスト品質に 2 件の重大な欠陥** が確認された。`TestRecomputePresetCache` がアサーションを行っていない(t.Logf のみ)点と、`ResolveComboRecipe` のキャッシュ未生成パスのテストが欠如している点は、指示書の必須テスト要件を満たしておらず、M1 完了前に修正が必要である。また、`notation.service` 構造体の `db *sql.DB` フィールドが未使用のデッドコードになっている点も軽微だが指摘する。

---

## 設計準拠性レビュー結果

| チェック項目 | 結果 | 詳細 |
|-------------|------|------|
| DES-004 §5 エイリアス変換アルゴリズムの実装 | ◎ | `resolver.go` に正しく実装。通常 move・非技ステップ・flags すべて対応 |
| DES-004 §5.3 フォールバック順（base_preset_code → official_ja_move → moves.code） | ◎ | DES-004 §5.3 の 3 段フォールバックを正確に実装。指示書 §4.2.1 の簡略記述より正確 |
| SUPP-001 §7.1 公開関数の実装 | ◎ | `ResolveComboRecipe`, `RecomputeComboCache`, `DeleteComboCache`, `RecomputePresetCache`, `DeletePresetCache`, `ComputeSingleCache`, `RenderSteps` 全実装済み |
| SUPP-001 §7.2 呼出元責務（combo サービス） | ◎ | Create → RecomputeComboCache, UpdateWithKeyChange → DeleteComboCache + RecomputeComboCache, Delete → DeleteComboCache, Restore → RecomputeComboCache が全て正しく実装済み |
| UpdateMetadata(メタデータ編集)での notation 呼出なし | ◎ | `service.go` の `UpdateMetadata` に notation 呼出なし（レシピ変更なしのため正しい） |
| M1-03 の TODO 箇所の完全な置換 | ◎ | combo service.go の Create/UpdateWithKeyChange/Delete/Restore の各 TODO が置換済み |
| 連結子の定数化・仮実装明示 | ◎ | `const connector = " > "` として定数化、コメントで仮実装明記済み |
| recipe_cache が combos テーブルの TEXT カラムとして実装（案 A） | ◎ | 別テーブル化なし、JSON 文字列として combos.recipe_cache に保存 |
| JSON キーが preset_id の文字列化整数 | ◎ | `strconv.FormatInt(presetID, 10)` で統一 |
| RecomputeComboCache が JSON 全体を組み立てて UPDATE | ◎ | `cache := make(map[string]string, len(presets))` で全プリセット分組み立て後 UPDATE |
| DeleteComboCache が recipe_cache = NULL への UPDATE | ◎ | `SetRecipeCacheNullTx` → `UPDATE combos SET recipe_cache = NULL WHERE id = ?` |
| recipe_cache 更新で version をインクリメントしない | ◎ | `UpdateRecipeCache` / `UpdateRecipeCacheTx` に `version = version + 1` なし |
| cmd/combomgr/main.go DI が正しく更新 | ◎ | presetRepo, notationSvc を構築し comboService に渡す DI 配線が完成 |
| preset ルートが `/api/presets` で登録 | ◎ | `presethandler.RegisterRoutes(apiGroup, presetHandler)` で登録済み |

---

## コード品質レビュー結果

| チェック項目 | 結果 | 詳細 |
|-------------|------|------|
| エラーラップ `fmt.Errorf("...: %w", err)` 形式 | ◎ | 全箇所で準拠 |
| `context.Context` が全公開メソッドの第一引数 | ◎ | service/repository 層で全て確認済み |
| 公開関数に godoc コメント | ◎ | `Service` インタフェース・`Repository` インタフェース・`New` 関数に全て記載 |
| サービス層がリポジトリ層を介して DB 操作 | ◎ | `s.comboRepo` / `s.presetRepo` 経由のみ |
| DTO ↔ モデル変換が適切 | ◎ | `toPresetResponse` 関数で変換、DTO に `BasePresetCode` を含める設計も適切 |
| notation サービスの tx 境界が明確 | ◎ | combo サービスから渡される `tx` を使い、notation サービス自身が tx を開始しない |
| `fmt.Println` / `console.log` の本番コード残存 | ◎ | 不在を確認 |
| `notation.service.db *sql.DB` フィールドの未使用 | △ | `service.go` で `db *sql.DB` を保持しているが、`cache.go`/`resolver.go` のどのメソッドでも `s.db` が直接使用されていない。デッドコード |
| `DeletePresetCache` の read-outside-tx パターン | △ | `ListAllActiveCombos` は非トランザクション読み取り、`UpdateRecipeCacheTx` は tx 書き込み。M1 シングルユーザー前提では実害なし |

---

## テスト網羅性

| チェック項目 | 結果 | 詳細 |
|-------------|------|------|
| resolver: 通常 move エイリアス変換 | ◎ | `TestRenderSteps_OfficialJaMove` |
| resolver: フォールバック1（当該プリセットなし → official_ja_move） | ◎ | `TestRenderSteps_FallbackToOfficialJaMove` |
| resolver: フォールバック2（どちらもなし → moves.code） | ◎ | `TestRenderSteps_FallbackToMoveCode` |
| resolver: 非技ステップ変換 | ◎ | `TestRenderSteps_NonMoveStep` |
| resolver: flags 付きステップ変換 | ◎ | `TestRenderSteps_WithFlags` |
| resolver: 連結子での結合 | ◎ | `TestRenderSteps_Connector` |
| cache: ResolveComboRecipe キャッシュあり時取得 | ○ | `TestResolveComboRecipe_CacheHit` — テキスト内容の検証が空チェックのみ（弱い） |
| **cache: ResolveComboRecipe キャッシュなし時の計算+挿入** | **×** | **テストケースが存在しない。指示書 §5 の必須テスト要件に明示されているが欠如** |
| cache: RecomputeComboCache 全プリセット分再計算 | ◎ | `TestRecomputeComboCache_PopulatesAllPresets` (5 件確認) |
| cache: DeleteComboCache NULL 化確認 | ◎ | `TestDeleteComboCache_NullifiesCache` |
| **cache: RecomputePresetCache 全コンボ分再計算** | **×** | **`TestRecomputePresetCache` の assert が `t.Logf` のみ（アサーションなし）、実質パス判定不能** |
| combo サービス連携: Create 後の cache 確認 | ◎ | `TestRecomputeComboCache_PopulatesAllPresets` (createTestCombo 経由) |
| combo サービス連携: Delete 後の cache NULL 確認 | ◎ | `TestDeleteComboCache_NullifiesCache` |
| combo サービス連携: Restore 後の cache 再計算 | ◎ | `TestRestoreCombo_RecomputesCache` |
| repo: GetRecipeCache 正常系 | ◎ | `TestRepository_GetRecipeCache_NullDefault` |
| repo: UpdateRecipeCache 正常系 | ◎ | `TestRepository_UpdateRecipeCache` |
| repo: UpdateRecipeCacheTx 正常系 | ◎ | `TestRepository_UpdateRecipeCacheTx` |
| repo: SetRecipeCacheNullTx 正常系 | ◎ | `TestRepository_SetRecipeCacheNullTx` |
| repo: ListAllActiveCombos 削除済み除外 | ◎ | `TestRepository_ListAllActiveCombos` |
| ハンドラ: GET /api/presets 正常系(5件) | ◎ | `TestHandler_List_200` |
| ハンドラ: GET /api/presets/:id 正常系 | ◎ | `TestHandler_Get_200` |
| ハンドラ: GET /api/presets/:id 404 | ◎ | `TestHandler_Get_404` |
| M1-03 既存テストへの影響（combo サービス修正） | ○ | combo service_test.go の既存テストは notationSvc を受け取る形に更新済み。影響なし |

---

## パフォーマンス考慮

| チェック項目 | 結果 | 詳細 |
|-------------|------|------|
| RecomputePresetCache の同期処理 | ◎ | M1 段階（コンボ数想定数件〜数百件）では同期処理で問題ない |
| combos.recipe_cache の SELECT が主キー検索 | ◎ | `WHERE id = ?` で主キーアクセス、追加インデックス不要 |
| recipe_cache JSON パース失敗時のコンボ取得継続 | ◎ | `slog.Warn` ログのみ出力し、計算を継続して返す |

---

## 禁止事項違反の有無

| チェック項目 | 結果 | 詳細 |
|-------------|------|------|
| localStorage 等フロント禁止項目 | ◎ | 対象外（バックエンドのみの実装） |
| `fmt.Println` / `console.log` の本番コード残存 | ◎ | なし |
| Git 操作の Bash 実行 | ◎ | なし |
| 設計書に記載のない機能の追加 | ◎ | なし（ハンドラ BadRequest テストの追加は指示書外だが禁止ではなく品質向上） |

---

## 統合確認（M1-03 連携）

| チェック項目 | 結果 | 詳細 |
|-------------|------|------|
| `cmd/combomgr/main.go` DI の更新 | ◎ | `notation.New(sqlDB, presetRepo, repo)` → `combosvc.New(sqlDB, repo, validDeps, notationSvc)` の順で正しく配線 |
| preset ルート登録 `/api/presets` | ◎ | `presethandler.RegisterRoutes(apiGroup, presetHandler)` で登録済み |
| M1-03 の combo リポジトリ拡張 | ◎ | 既存メソッドを変更せず末尾に追記する形で互換性維持 |
| combo service_test.go の既存テストへの影響 | ◎ | `newSvc` ヘルパが `notationSvc` を含む形に更新済み |

---

## 推奨修正（優先度別）

### 高（M1 完了前に修正必須）

1. **`TestRecomputePresetCache` のアサーション修正** (`internal/service/notation/cache_test.go` 188〜191 行目)

   現状:
   ```go
   if _, ok := cache[key]; !ok {
       t.Logf("cache keys: %v", cache)  // アサーションになっていない
   }
   ```

   修正方針: `t.Logf` → `t.Errorf` または `t.Fatalf` に変更し、且つ `key := "3"` のハードコードを `strconv.FormatInt(numericJaID, 10)` に変更する。また、`db := dbtest.Setup(t)` で作成した別 DB から ID を取得するのではなく、`createTestCombo` が返す DB インスタンスから取得するよう修正する（下記 2 と併せて対処）。

2. **`ResolveComboRecipe` キャッシュ未生成時テストの追加** (`internal/service/notation/cache_test.go`)

   指示書 §5 必須テスト「ResolveComboRecipe: キャッシュなし時の計算+挿入」が欠如。以下のシナリオをテスト:
   - コンボ作成後に `SetRecipeCacheNullTx` で recipe_cache を NULL に戻す
   - `ResolveComboRecipe` を呼び出し、テキストが返り、かつ recipe_cache に挿入されていることを確認

### 中（M2 着手と並行可）

3. **複数テストでの 2 つの DB インスタンス混在の修正**

   以下の 4 テスト関数が `createTestCombo(t)` と `dbtest.Setup(t)` で異なる DB から preset ID を取得している:
   - `TestComputeSingleCache` (`service_test.go` 20〜21 行目)
   - `TestResolveComboRecipe_CacheHit` (`cache_test.go` 155〜157 行目)
   - `TestRecomputePresetCache` (`cache_test.go` 169〜172 行目)
   - `TestRecomputeComboCache_OfficialJaContent` (`cache_test.go` 91〜93 行目)

   seed データが同一のため現在は動作するが、seed 変更時に壊れるリスクがある。`createTestCombo` が返す `db` インスタンスを使うか、`newNotationSvc` ヘルパに統一する。

4. **`TestRecomputeComboCache_OfficialJaContent` の未使用変数削除** (`cache_test.go` 92〜93 行目)

   ```go
   officialID := lookupPresetIDByCode(t, db, "official_ja_move")
   _ = officialID  // 取得しているが使用していない
   ```

   このコードは削除するか、preset ID をキーとした値検証に活用すべき。

5. **`notation.service` の未使用 `db *sql.DB` フィールド削除** (`service.go` 39 行目)

   `service` 構造体の `db *sql.DB` フィールドは現在どのメソッドでも使用されていない。不要なフィールドを削除して構造体をシンプルにする。`New` コンストラクタの引数も同様に削除できる（ただし、将来的に notation サービス自身がトランザクションを開始する場合は保持する選択もある）。

### 低（将来対応）

6. **DES-004 §5.3 の base_preset_code フォールバックのテストケース追加**

   実装は DES-004 §5.3 を正確に実装しているが、`base_preset_code` が設定されたカスタムプリセット経由のフォールバックをテストするケースがない。フェーズ1ではカスタムプリセットが作成できないため動作確認機会がなく、M3 実装前に追加しておくべき。

7. **`TestResolveComboRecipe_CacheHit` の検証強化**

   現在はテキストが空でないことしか確認していない。`"立ち弱P > 弱波動拳"` 等の具体的な期待値と比較すべき。

---

## 良かった点

1. **DES-004 §5.3 の正確な実装**: 指示書 §4.2.1 が base_preset_code ステップを省略した簡略記述になっていたが、実装は設計書 DES-004 §5.3 の通り base_preset_code フォールバックを正しく実装している。設計書優先の判断が適切。

2. **`connector` 定数化と将来変更への配慮**: `const connector = " > "` として定数化し、コメントで仮実装であることを明記。M3 でのプリセット別連結子実装時の変更箇所が明確。

3. **model パッケージへの定数定義**: `PresetCodeOfficialJaMove` 等をモデル層に集約しマジックストリングを排除。`nonMoveTypeText` と `flagText` の定数マップも拡張しやすい構造。

4. **`FindStepsByComboIDTx` によるトランザクション内 steps 読み取り**: `RecomputeComboCache` が未コミット steps を正しく参照できるよう `FindStepsByComboIDTx` を使用している。これにより INSERT → cache 計算 → COMMIT のアトミック性が担保されている。

5. **version インクリメントなし**: `UpdateRecipeCache` / `UpdateRecipeCacheTx` で `version = version + 1` を行っていない。recipe_cache はキャッシュであり楽観的排他の対象外であることが正しく実装されている。

6. **エラーハンドリングの一貫性**: 全箇所で `fmt.Errorf("...: %w", err)` による wrap が徹底されており、エラーの追跡が可能。

7. **ハンドラテストの充実**: 指示書要求の正常系・404 に加え、不正な ID（BadRequest）のテストケースを追加している。

8. **`resolverCtx` による official_ja_move プリセット ID のキャッシュ**: レシピ変換中に `official_ja_move` プリセット ID を 1 度だけ lookup してキャッシュする構造により、1 レシピ内での重複クエリを回避。

---

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際のパフォーマンス測定（`make test` 実行・動作確認）は別途実施が必要。
- 並列実装中の他指示書（M1-05/M1-06/M1-07）のコードは対象外。

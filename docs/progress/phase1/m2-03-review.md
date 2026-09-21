# M2-03 レビュー報告書

| 項目 | 内容 |
|------|------|
| レビュー対象 | M2-03 ゴミ箱画面(v1.0.0) |
| チェックリスト | `docs/instructions/reviews/M2-03-review-checklist.md`(v1.0.0) |
| レビュー日 | 2026-05-09 |
| レビュー担当 | 品質レビュー担当 Claude(Sonnet 4.6) |

---

## 総評

バックエンドのコアロジック（完全削除の安全策、`only_deleted` 優先順位、`Restore` + `RecomputeComboCache` 連動、`combo_steps` の ON DELETE CASCADE 活用）はすべて指示書・設計書の意図に正確に沿って実装されている。フロントエンドも `Promise.allSettled` による一括操作、アクセシビリティ属性、残日数計算ロジックなど、細部まで丁寧に実装されている。

一方、**テストカバレッジに構造的な欠落がある**。サービス層の `PermanentDelete` 単体テスト、フロントの `TrashList.test.tsx`・`TrashBulkActions.test.tsx` の計 3 件が未作成であり、チェックリスト §4.1 / §4.2 の必須要件を満たしていない。また、「行クリック → 詳細画面遷移」が始動技セルのみのリンクにとどまり、DES-005 §5.15 の要件を部分的にしか満たしていない点も確認された。

重大な問題は 0 件。修正必須の問題が 3 件（テスト欠落）、確認・修正推奨の問題が 2〜3 件の結果となった。

---

## 設計準拠性レビュー結果

### §1.1 ゴミ箱画面の表示要件（DES-005 §5.15 との照合）

| チェック項目 | 判定 | 備考 |
|-------------|------|------|
| 削除日時の表示 | ◎ | `TrashListRow.tsx:79` でローカル時刻フォーマット済み |
| 自動完全削除までの残日数表示 | ◎ | `calculateRemainingDays`（削除日時 + 90日 - 現在）、定数 `TRASH_RETENTION_DAYS = 90` |
| 期限切れ表示（赤色強調） | ◎ | `remainingDays <= 0` → `<span className="font-medium text-red-600">期限切れ</span>` |
| 一括復元・一括完全削除ボタン | ◎ | `TrashBulkActions.tsx` に両ボタン実装済み |
| **行クリック → 詳細表示遷移** | △ | 始動技セルのみ `<Link to="/combos/:id">` あり。他セル（ダメージ・残日数等）はクリック不可。DES-005 §5.15 の「行クリック」要件を部分的にしか満たさない |
| 復元ボタン → 論理削除解除 | ◎ | `TrashListRow.tsx:43-46` で `useRestoreCombo.mutateAsync` 呼出 |
| 完全削除ボタン → 確認ダイアログ後物理削除 | ◎ | `PermanentDeleteConfirm` → `usePermanentDelete.mutateAsync` |
| セットプレイ用将来拡張可能な構造 | ○ | 構造的に拡張を妨げないが、TODO コメントが未配置（§1.1 の推奨確認事項） |

### §1.2 サービス層責務の整合（SUPP-001 §7.1 / §7.2 との照合）

| チェック項目 | 判定 | 備考 |
|-------------|------|------|
| `PermanentDelete` 内に recipe_cache の追加処理なし | ◎ | `service.go:432-458` で DB 物理削除のみ。論理削除時に既に NULL 化済みのため正しい |
| Restore で `RecomputeComboCache` が呼ばれている | ◎ | `service.go:418` に既存実装あり。§3.4.1 でこれを確認し §4.6 をスキップする判断が正しい |
| M1-03 既存実装を確認した根拠が記録されている | ◎ | `progress-log.md` §3.4 確認結果テーブルに明記 |
| M1-04 `RecomputeComboCache` メソッド本体が変更されていない | ◎ | 呼び出すのみ、本体変更なし |

### §1.3 完全削除 API 仕様の整合（指示書 §4.1）

| チェック項目 | 判定 | 備考 |
|-------------|------|------|
| `DELETE /api/combos/:id/permanent` | ◎ | `routes.go`・`permanent_delete_handler.go` |
| 正常系 204 No Content | ◎ | `handler.go:37` で `c.NoContent(http.StatusNoContent)` |
| 404（コンボ不存在） | ◎ | `ErrNotFound` → 404 |
| **409 error キーの形式** | △ | `{"error":"not_found"}` を返すが、チェックリスト §2.1 期待値は `{"error":"combo not found"}`。プロジェクト内では既存パターン（`Get` ハンドラ等も `"not_found"`）と統一されており、内部一貫性は保たれている。設計書との乖離か既存パターンの踏襲かは**要確認** |
| 409（通常コンボへの完全削除拒否） | ◎ | `service.go:437-439` で `combo.DeletedAt == nil` → `ErrComboNotInTrash`、ハンドラで 409 マッピング |
| 400（不正な ID） | ◎ | `parseIDParam` でバリデーション |

### §1.4 only_deleted フィルタの整合（指示書 §4.3）

| チェック項目 | 判定 | 備考 |
|-------------|------|------|
| `only_deleted=true` → 論理削除済みのみ返す | ◎ | `repository.go:351-355` で `deleted_at IS NOT NULL` |
| `only_deleted` + `include_deleted` → `only_deleted` 優先 | ◎ | `handler.go:114-117` で else if 構造。`repository.go` でも同様の分岐 |
| `only_deleted=false`/省略 → 既存挙動維持 | ◎ | `handler_test.go` 既存テストが全通過（自己申告 `go test ./...` 通過） |
| M1-03 既存パラメータが引き続き動作 | ◎ | `character_id`・`is_draft`・`sort`・`order`・`limit`・`offset` の解析ロジックは変更なし |

### §1.5 残日数計算（指示書 §4.5.3）

◎ `TRASH_RETENTION_DAYS = 90` 定数、`calculateRemainingDays` が正確に実装。

### §1.6 一括操作の方針整合（指示書 §4.2 / §4.7）

| チェック項目 | 判定 | 備考 |
|-------------|------|------|
| 専用一括 API の新設なし | ◎ | フロント側 `Promise.allSettled` で個別呼出 |
| 一括完全削除に確認ダイアログ | ◎ | `TrashBulkActions.tsx:76-81` → `setConfirmOpen(true)` |
| 一部失敗時の失敗 ID リスト表示 | ◎ | `TrashBulkActions.tsx:32-38` で失敗 ID を収集、`role="alert"` で表示 |
| 処理中はボタン disabled | ◎ | `disabled={isProcessing}` |

---

## 設計準拠性以外の指摘事項

### コーディング規約（CLAUDE.md §4）

| 項目 | 判定 | 備考 |
|------|------|------|
| `localStorage` 使用なし | ◎ | 選択状態は React state のみ |
| `console.log` 残存なし | ◎ | 確認の範囲内ではなし |
| TypeScript `any` 型 | ◎ | 未使用（`PromiseRejectedResult` のキャストは already-typed な操作） |
| `context.Context` 第一引数 | ◎ | 全サービス・リポジトリメソッドで準拠 |
| エラーは `fmt.Errorf("...: %w", err)` でラップ | ◎ | 全箇所で準拠 |
| JSX `key` prop | ◎ | `TrashList.tsx:60` で `key={combo.id}` |

### フック設計

- `useRestoreCombo.ts` のエラー処理が `body.error` のみ参照（`body.message` を含まない）。`usePermanentDelete.ts` が `body.message ?? body.error` と両フィールドを参照するのと非対称。実害は少ないが、将来 restore API がメッセージ付きエラーを返す場合に表示できない。**低優先度の改善候補**。

### テストカバレッジ

チェックリスト §4.1 / §4.2 で必須とされているテストの欠落：

| 必須テスト | 存在 | 内容 |
|-----------|------|------|
| `permanent_delete_handler_test.go` | ✅ | 正常系 204、404、409、400 の 4 ケース |
| `handler_test.go`（only_deleted 追記） | ✅ | `TestHandler_List_OnlyDeleted`、`TestHandler_List_OnlyDeleted_OverridesIncludeDeleted` |
| **サービス層 `PermanentDelete` 単体テスト** | ❌ | `service_test.go` に記述なし、専用ファイルも不存在 |
| `useTrashCombos.test.ts` | ✅ | URL 含有確認・正常系・HTTP エラー |
| `usePermanentDelete.test.ts` | ✅ | DELETE リクエスト・404・409 エラー |
| **`TrashList.test.tsx`** | ❌ | ファイル不存在 |
| **`TrashBulkActions.test.tsx`** | ❌ | ファイル不存在 |
| `PermanentDeleteConfirm.test.tsx` | ✅ | 文言切替・ボタン動作・ESC・背景クリック |

---

## 推奨修正（優先度別）

### 高（M2 完了前に修正必須）

1. **サービス層 `PermanentDelete` 単体テストの追加**
   - 追加場所: `internal/service/combo/service_test.go` または新規 `permanent_delete_test.go`
   - 必要ケース: ① 論理削除済みコンボの完全削除（正常系）、② 存在しないコンボへの要求（`ErrNotFound`）、③ 論理削除されていない通常コンボへの要求（`ErrComboNotInTrash`）
   - モックリポジトリを使用した単体テスト（`mockRepo` パターンで既存テストと揃える）

2. **`TrashList.test.tsx` の追加**
   - 必要ケース: ①ゴミ箱コンボの表示、②削除日時・残日数表示（残あり / 期限切れ）、③チェックボックス選択、④復元ボタンクリック、⑤完全削除ボタンクリック → 確認ダイアログ表示

3. **`TrashBulkActions.test.tsx` の追加**
   - 必要ケース: ① `selectedIds.length === 0` でコンポーネント非表示、②一括復元で N 件 API が呼ばれる、③一括完全削除で確認ダイアログ → 確認後 N 件 API が呼ばれる、④一部失敗時のエラー表示

### 中（M3 着手と並行可）

4. **TrashListRow: 行全体クリックで詳細遷移の実装**
   - DES-005 §5.15 の「行クリック → 詳細表示」を完全に満たすため、`<tr>` 要素に `onClick` ハンドラを追加（チェックボックス・ボタンへのクリックは `e.stopPropagation()` で除外）

5. **404 エラーレスポンスの error キー統一（要確認）**
   - `permanent_delete_handler.go:26` の `ErrorResponse{Error: "not_found"}` は既存パターンと一致するが、チェックリスト §2.1 が `"combo not found"` を期待している
   - **開発者への質問**: 既存ハンドラの `"not_found"` パターンとチェックリストの期待値のどちらを正とするか確認が必要

### 低（将来対応）

6. **TrashList: セットプレイ用 TODO コメントの追加**
   - チェックリスト §1.1 の推奨事項。`TrashList.tsx` にセットプレイ行追加予定箇所の `// TODO(M4): setplay rows` を配置

7. **`useRestoreCombo.ts` のエラー処理を `usePermanentDelete.ts` と統一**
   - `body.message ?? body.error` に揃える

---

## 質問・確認事項

### 質問: 404 error キーの期待値について

**状況**: `permanent_delete_handler.go:26` は `ErrorResponse{Error: "not_found"}` を返す（JSON: `{"error":"not_found"}`）。チェックリスト §2.1 は `{"error":"combo not found"}` を期待している。なお、既存の `handler.go` の `Get`・`Restore` ハンドラも `"not_found"` を使っており、プロジェクト内部では統一されている。

**判断に迷った理由**: チェックリスト記述と既存コードの実態が異なる。チェックリスト記述が指示書の誤記なのか、それとも統一すべき issue として指摘する必要があるのか判断できない。

**想定される選択肢**:
- 案A: 既存パターン `"not_found"` を維持する（現実装を正とする）
- 案B: `"combo not found"` に修正し、フロントのテストも更新する

**推奨**: 案A（プロジェクト内の一貫性を優先し、チェックリスト記述を誤記として処理）。ただし開発者確認を推奨。

---

## 良かった点

- **条件付きスコープの判断が正確**: `Restore` への `RecomputeComboCache` 呼出が M1-03 で既に実装済みであることを正しく確認し、§4.6 の追加実装をスキップした。この判断の根拠が `progress-log.md` に明記されており、検証可能な形で記録されている。

- **`Promise.allSettled` による一括操作の実装品質が高い**: 失敗 ID の収集（`result.status === "rejected"` の filter）、`role="alert"` による通知、処理完了後の `onComplete` コールバック呼出と選択リセットのフローが指示書 §4.2 / §4.7 の方針を忠実に実装している。

- **アクセシビリティの配慮**: `PermanentDeleteConfirm` の `role="dialog"`, `aria-modal`, `aria-labelledby` の実装、各チェックボックスへの `aria-label` の付与など、指示書の要求を超えた細かい配慮が見られる。

- **エラーパスの型安全な処理**: `usePermanentDelete.ts` の `res.json().catch(() => ({})) as { error?: string; message?: string }` のように、parse 失敗を catch しつつ optional 型でアクセスする堅牢な実装。

- **リポジトリコメントの充実**: `HardDelete` の「combo_steps は ON DELETE CASCADE で自動削除される」、`FindByIDAllowDeleted` の「完全削除(PermanentDelete)の前チェック用」など、コードの意図が明確に記録されている。

---

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。以下は開発者による別途確認が必要:
  - E2E シナリオ A〜F のブラウザ動作確認（progress-log.md に手順書掲載済み）
  - `go test ./...` / `pnpm test` の実際の全通過確認（progress-log.md に自己申告あり）
  - `combo_steps` の物理削除確認（ON DELETE CASCADE の実機検証）
  - `combo_steps` 削除後に当該コンボの `GET` が 404 を返すことの curl 確認

---

## レビュー結果サマリ

```
## レビュー結果

- 重大な問題: 0件
- 修正必須（高）: 3件（テスト欠落 3件）
- 修正推奨（中）: 2件（行クリック遷移、404 error キー確認）
- 軽微な問題（低）: 2件

## 詳細

### 修正必須（M2 完了前）

- (なし: ファイル)サービス層 `PermanentDelete` 単体テストが未作成
  → `internal/service/combo/service_test.go` への追加が必要
  → 必要ケース: 正常系 / ErrNotFound / ErrComboNotInTrash の 3 ケース
- (なし: ファイル)`TrashList.test.tsx` が未作成
  → チェックリスト §4.2 必須要件
- (なし: ファイル)`TrashBulkActions.test.tsx` が未作成
  → チェックリスト §4.2 必須要件

### 修正推奨（M3 並行可）

- (TrashListRow.tsx:66) 始動技セルのみ <Link>。行全体クリックで詳細遷移する仕様(DES-005 §5.15)を完全には満たさない
- (permanent_delete_handler.go:26) 404 error キーが "not_found"。チェックリストは "combo not found" を期待。要開発者確認

### 設計意図との整合（良かった点）

- §4.6 条件判断（Restore + RecomputeComboCache の既存実装確認とスキップ）が正確
- Promise.allSettled 一括操作の実装品質が高い
- PermanentDeleteConfirm のアクセシビリティ配慮が丁寧
- リポジトリ層のコメント（CASCADE、前チェック用途）が充実
```

---

*以上*

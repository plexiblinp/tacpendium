# M4-03 機械レビュー報告書

## 1. レビュー実施日

2026-05-19

## 2. レビュー結果サマリ

- ❌ ファイル一覧: フロントエンドテスト 5 件未作成 → §15 重大判定(3 件以上の未充足)
- ✅ CHANGE-013 (DES-005 §5.7) 整合性: モーダル発火条件は (a)(b) 両保存方式で対応
- ⚠️ §11.1 確認モーダルの発火条件: 実装は正しいが §11.2 (a) 方式の topMessage 通知未実装
- ✅ §4.2 SetupSummary 軽量型の利用: `SetupCandidateSummary` を新設し createdAt/updatedAt/steps を除外
- ❌ §5.2 / §5.3 エラーコード: `invalid_setup_carry_mode` / `missing_setup_carry_options` が 400 ではなく 500 で返る
- ❌ §4.3 GetSetupCandidates エラーコード: `"invalid_combo_id"` ではなく `"invalid_param"`
- ❌ §14 進捗ログ / E2E 手順書: M4-03 完了報告が progress-log.md に未記載
- ✅ N+1 問題なし: `FindComboIDsBySetupIDs` 一括取得、候補抽出は JOIN で実装
- ✅ queryKey flat tuple 規約準拠
- ✅ トースト系ライブラリ未追加

---

## 3. 検出した問題

### 3.1 重大な問題（完了承認保留）

#### 問題 A: フロントエンドテストファイル 5 件未作成 (§1.2 / §12.2 / §15)

チェックリスト §1.2 で要求されるテストファイルが全て未作成。テスト数は M4-02 完了時と同じ 46 ファイル / 256 テストのまま。

- `web/src/features/setup/hooks/useSetupCandidates.test.ts` — MISSING
- `web/src/features/setup/components/SetupCandidateList.test.tsx` — MISSING
- `web/src/features/combo/components/KnockdownAdvantageChangeModal.test.tsx` — MISSING
- `web/src/pages/ComboDetailPage.test.tsx`(§5.6 item 9 セクション追加分) — MISSING
- `web/src/pages/ComboEditorPage.test.tsx`(モーダル分岐ロジック分) — MISSING

→ §15 の「3 件以上の未充足」基準を超過。**完了承認保留**。

#### 問題 B: `invalid_setup_carry_mode` / `missing_setup_carry_options` が 500 返却 (§5.2 / §5.3 / §15)

**`invalid_setup_carry_mode`**

`service/combo/service.go` の `UpdateMetadata` / `UpdateWithKeyChange` 両メソッドで、不正モード時に `fmt.Errorf("invalid setup carry mode: %s", ...)` を返している。ハンドラは `ErrNotFound` / `ErrConflict` / `ErrInvalidTagID` のみ判別し、それ以外を `internal_error` (500) として返す。仕様 (§5.2) は 400 + `invalid_setup_carry_mode` を要求。

```go
// service.go UpdateMetadata (line ~320) — 問題箇所
default:
    err = fmt.Errorf("invalid setup carry mode: %s", input.SetupCarryOptions.Mode)
    return nil, result, err
// ↑ handler が認識する sentinel error ではないため 500 が返される
```

**`missing_setup_carry_options`**

KA 変更 + `setupCarryOptions = nil` + 紐付き setup ≥ 1 件のケースに対するサーバーサイド防御 (`missing_setup_carry_options` バリデーション) が**実装なし**。フロント側のモーダルで制御しているが、API 直接呼び出し時の防御がない。

→ §15 エラーコード未統一基準に該当。**完了承認保留**。

#### 問題 C: `GetSetupCandidates` ハンドラのエラーコード不正 (§4.3 / §15)

```go
// internal/api/setup/handler.go line 248
return c.JSON(http.StatusBadRequest, errResp("invalid_param", "コンボ ID が不正です"))
//                                           ^^^^^^^^^^^^^ 仕様は "invalid_combo_id"
```

チェックリスト §4.3「`comboId` 不正値で 400 + `invalid_combo_id`」に違反。
→ §15「エラーコードが小文字スネークで統一されていない」基準に該当。**完了承認保留**。

#### 問題 D: バックエンドテスト大幅不足 (§1.1 / §12.1 / §15)

チェックリスト §12.1 で要求されるテストが複数欠如。

**service/setup/service_test.go — `GetSetupCandidates` テスト**

`TestService_GetSetupCandidates_Stub` が残っており、本実装に対応したテストが追加されていない。チェックリストが要求する以下シナリオが全て欠如:
- 同一キャラ + 同一 knockdown_advantage で候補が返る
- 親コンボ自身を除外
- 論理削除済み setup を除外
- knockdown_advantage NULL で候補 0 件
- 親コンボが存在しないとき `ErrComboNotFound`
- 候補 0 件で空配列

**repository/setup/repository_test.go — `FindCandidateSetups` テスト**

テストが全て欠如している。

**service/combo/service_test.go — SetupCarryOptions テスト**

`carry_all` / `unlink_all` / `individual` / 無効モード / `missing_setup_carry_options` のテストが全て欠如。

**repository/combo/repository_test.go — M4-03 追加メソッドのテスト**

`DeleteComboSetupsByComboID` / `DeleteComboSetupsByComboIDExcluding` / `CountComboSetupsByComboID` のテストが欠如。

→ §15「3 件以上の未充足」基準を大幅に超過。**完了承認保留**。

#### 問題 E: progress-log.md に M4-03 完了報告・E2E 手順書が未記載 (§14 / §12.4)

- `docs/progress/progress-log.md` の末尾は M4-02 完了対応の記録で終わっており、M4-03 のエントリが存在しない
- §14 が要求する「§4.11 設計判断事項表の実装状況」「E2E シナリオ A〜I の実機確認結果」が未記載
- チェックリスト §12.4「レビュー完了承認 ≠ M4-03 完了承認」の明示も欠如

---

### 3.2 軽微な問題（完了承認可、改善推奨）

#### 問題 F: `GetSetupCandidates` のエラーハンドリング粗粒度 (§4.1)

`service/combo/service.go` の `GetSetupCandidates` で、`comboReader.FindByID` が返す**あらゆるエラー**を `ErrComboNotFound` でラップしている (line 395-398)。DB 接続障害等のインフラ障害も 404 として返される。

```go
combo, err := s.comboReader.FindByID(ctx, comboID)
if err != nil {
    return nil, ErrComboNotFound  // DB 障害も "not found" 扱いになる
}
```

`comborepo.ErrNotFound` を `errors.Is` で確認し、他エラーは別センチネルで返すべき。

#### 問題 G: CHANGE-013 §11.2 (a) 方式 topMessage 未実装 (§10.2 / §11.2)

PUT (キー変更編集) + KA 変更なし + 紐付き setup ≥ 1 件のとき、`handleSaveSuccess` は汎用の「保存しました。」を表示するのみで、DES-005 §5.7 規定の「紐づくセットプレイ N 件を引き継ぎました。必要に応じて内容を確認してください」を表示しない。機能的欠陥ではないが CHANGE-013 仕様に対する実装漏れ。

#### 問題 H: `KnockdownAdvantageChangeModal` の Props 型乖離 (§8.1)

```typescript
// 実装
interface Props {
  linkedSetups: SetupSummary[];  // ← 仕様は SetupResponse[]
  ...
}
```

チェックリスト §8.1 は `SetupResponse[]` を要求するが、実装は `SetupSummary[]`。
UI で必要なフィールド(id, name, stepCount)は `SetupSummary` に全て揃っており機能的問題はない。Props 最小化観点から `SetupSummary` の方が適切とも言えるが、仕様との乖離は記録する。

---

### 3.3 改善提案（次回マイルストーン以降）

1. `SetupCandidateList` の `handleLink` で `queryClient.invalidateQueries({ queryKey: ["setupCandidates", parentComboId] })` を手動追加しているが、`useCreateSetupLink` が既に `["combo", comboId]` を無効化するため、`setupCandidates` キャッシュも combo キャッシュ無効化の副作用で更新される可能性がある。二重無効化の整理を検討(M5)。

2. `SetupAccordionItem` と `SetupCandidateList` のリスト行 UI が類似しているため、M5 以降でのリファクタ候補として記録(指示書 §1.3 通り)。

3. `TestService_GetSetupCandidates_Stub` の関数名とコメントを本実装テストに合わせて更新すること(スタブコメントが残っている)。

---

## 4. 制約事項

- 本レビューは静的コードレビュー。**実機テスト(ブラウザでの動作確認、E2E シナリオの実行)は別途実施が必要**(playbook §14、M4-02 E2E 由来運用知見)。
- E2E シナリオ A〜I の手動確認は開発者の責任範囲。

---

## 5. 完了承認判定

**❌ 完了承認保留（重大な問題あり）**

以下を修正後、再レビューを実施すること:

| 優先 | 修正内容 |
|------|---------|
| 高 | フロントエンドテスト 5 ファイル作成(useSetupCandidates / SetupCandidateList / KnockdownAdvantageChangeModal / ComboDetailPage / ComboEditorPage) |
| 高 | バックエンドテスト追加(setup service GetSetupCandidates 本実装、setup repo FindCandidateSetups、combo service SetupCarryOptions 各モード、combo repo DeleteComboSetupsByComboID 系) |
| 高 | `invalid_setup_carry_mode` エラーをサービス層で sentinel error または ValidationError 化し、ハンドラで 400 返却に対応 |
| 高 | `missing_setup_carry_options` バリデーションをサービス層 / ハンドラに実装(KA 変更 + setups ≥ 1 + carryOptions = nil → 400) |
| 高 | `GetSetupCandidates` ハンドラの `"invalid_param"` → `"invalid_combo_id"` 修正 |
| 高 | `docs/progress/progress-log.md` に M4-03 完了報告・E2E シナリオ A〜I 手順書・実施結果を追記 |
| 中 | `GetSetupCandidates` の `comboReader.FindByID` エラーを `ErrNotFound` と他エラーで分岐 |
| 中 | CHANGE-013 §11.2 (a) 方式 PUT + KA 変更なし + setups ≥ 1 の topMessage 実装 |

---

## 6. 良かった点

1. **N+1 問題なし**: `GetSetupCandidates` のサービス層で `FindComboIDsBySetupIDs` による一括取得を採用。`FindCandidateSetups` も JOIN で候補を一括抽出しており、architecture-patterns.md §4.5 の水準を満たしている。
2. **CHANGE-013 §11.1 両保存方式モーダル**: `onSave` で KA 変更検知 → `KnockdownAdvantageChangeModal` → `proceedSave` (PATCH/PUT 分岐) の構造により、(a)(b) 両保存フローでモーダルが発火する。
3. **queryKey flat tuple 規約準拠**: `["setupCandidates", comboId]` が architecture-patterns.md v1.0.2 の flat tuple 規約に準拠。
4. **SetupCandidateSummary が適切な軽量型**: createdAt / updatedAt / steps を除外し、フロント `SetupSummary` と整合。
5. **knockdown_advantage NULL の早期リターン**: `FindCandidateSetups` でリポジトリ層が `knockdownAdvantage == nil` を早期リターン処理、SQL の = NULL 比較の罠を回避。
6. **combo_setups 操作がトランザクション内**: `UpdateMetadata` / `UpdateWithKeyChange` いずれも `SetupCarryOptions` 処理をトランザクション内で実行し原子性を確保。
7. **トースト系ライブラリ未追加**: v1.0.1 で確定したスコープ外条項を遵守。`package.json` に react-hot-toast / sonner 等の追加なし。
8. **shadcn/ui 不使用**: モーダル 2 件(LinkExistingSetupModal パターン踏襲)とも標準 HTML + Tailwind で実装。
9. **SetupAccordionItem との共通化なし**: §1.3 スコープ通り、M5 以降のリファクタ候補として適切に分離。
10. **`go build` / `go vet` / `pnpm build` / `tsc --noEmit` 全通過**: ビルドおよび型チェックは正常。

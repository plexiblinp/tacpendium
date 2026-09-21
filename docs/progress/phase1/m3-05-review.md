# M3-05 レビュー報告書

## レビュー結果サマリ

- 重大な問題: **2件**
- 中程度の問題（M4 着手前修正推奨）: **2件**
- 軽微な問題: **4件**
- 質問・確認事項: **1件**

## 重大な問題詳細

### P-01: RecipeBuilder の console.warn 実装漏れ + テスト3ケース未追加（M3-05 §4.4）

**対象ファイル**: `web/src/features/combo/components/RecipeBuilder.tsx` / `RecipeBuilder.test.tsx`

**現状**:
- `RecipeBuilder.tsx` に `console.warn` の呼び出しが一切存在しない
- `RecipeBuilder.test.tsx` には M2-04 の4テストケースのみ。M3-05 §4.4.2 で要求された3ケース（ケース1: 50文字以下で console.warn 未発火、ケース2: 51文字以上で console.warn 1回発火・文言確認、ケース3: 超過→減少時の過剰発火なし）が一切追加されていない

**背景との乖離**:
M3-05 §4.4.1 は「M2-04 §4.2 で console.warn を発火する警告ロジックを実装した」と前提するが、現在の `RecipeBuilder.tsx` には `console.warn` がなく、UI の視覚的警告（赤ボーダー + テキスト表示）のみ実装されている。M3-05 は
- `RecipeBuilder.tsx` に `console.warn` を追加する
- `RecipeBuilder.test.tsx` に `vi.spyOn(console, 'warn')` で3テストケースを追加する

の両方を実施する必要があったが、いずれも未実施。

**判定基準**: チェックリスト §9「RecipeBuilder console.warn テスト 3 ケースが追加されていない、または失敗する」→ **重大な問題**

**修正提案**:
1. `RecipeBuilder.tsx` の `notesOver` 変化タイミング（`useEffect` 等）で `console.warn("draftNotes が 50文字を超えています: N文字")` を発火するロジックを追加
2. `RecipeBuilder.test.tsx` に `vi.spyOn(console, 'warn')` で3テストケースを追加

---

### P-02: progress-log.md に M3-05 完了報告なし（DoD §7.4 / §7.5）

**対象ファイル**: `docs/progress/progress-log.md`

**現状**:
`progress-log.md` の最後は M3-04 完了報告で終わっており、M3-05 の完了報告セクションが存在しない。具体的に記録されていない事項：
- CHANGE-010 取り込み完了の事実
- M1-05 暫定処理1・3（レシピ表示改善・始動技 ID 解消）の解消事実
- M2-04 持ち越し課題（RecipeBuilder console.warn テスト）の解消事実
- M3-03 持ち越し課題（空状態メッセージ改善）の解消事実
- combo ハンドラの後方非互換変更（フラット→ネスト）の周知
- §3.4 着手前確認（5項目）の結果
- M3 全体サマリ（M3-01〜M3-05 の達成事項）

**判定基準**: DoD §7.4 / §7.5 必須要件未達成。チェックリスト §9「CHANGE-010 で予告された後方非互換変更の周知漏れ(progress-log.md に記録なし)」→ **重大な問題**

---

## 中程度の問題詳細（M4 着手前修正推奨）

### M-01: defaultRecipe / starterMoveCode のバックエンドテスト不足（§5.1.3）

**対象ファイル**: `internal/service/combo/service_test.go` / `internal/repository/combo/repository_test.go` / `internal/api/combo/handler_test.go`

**現状**:
指示書 §5.1.3「必須テスト」として列挙された以下のテストが存在しない:
- `default_recipe` フィールドが期待形式（`" > "` 区切り等）で返ることのテスト
- `starter_move_code` フィールドが期待値で返ることのテスト
- `starter_move_id` が NULL のコンボで `starter_move_code` が空文字で返ることのテスト

`handler_test.go` の `TestHandler_List_200` は件数のみ確認しており、DTO の新規フィールドを検証していない。`service_test.go` / `repository_test.go` でも同フィールドへの言及なし。

**影響**: 実装自体は正しく見えるが、リグレッション検知能力がない。M4 で共通型を再利用する際にエラーになった場合の検知が困難。

---

### M-02: `Combo` TypeScript インタフェースに `defaultRecipe` / `starterMoveCode` 欠落

**対象ファイル**: `web/src/features/combo/types.ts` L109-135

**現状**:
`ComboSummary`（L36-68）には `defaultRecipe?: string` / `starterMoveCode?: string` が追加済みだが、`Combo` インタフェース（L109-135）には両フィールドが存在しない。バックエンドの `toComboResponse()` は全エンドポイント（POST/GET/PATCH/PUT）で `DefaultRecipe` / `StarterMoveCode` を返すため、`useCreateCombo` / `useUpdateComboMetadata` 等のレスポンス型として使われる `Combo` インタフェースとの不一致がある。

**影響**: `Combo` 型を使う将来のコードでこれらフィールドを参照しようとすると TypeScript コンパイルエラーになる。現状は参照箇所がないため動作上の問題はない。

---

## 軽微な問題詳細

### L-01: `ComboSummary` の `defaultRecipe` / `starterMoveCode` がオプショナル型

**対象ファイル**: `web/src/features/combo/types.ts` L61-62

バックエンドは常に `string`（非オプショナル）を返すが、フロント型は `string | undefined`。`ComboTableRow.tsx` で `combo.defaultRecipe || "-"` と安全に扱われているため動作問題はない。型定義の精度向上として将来対応推奨。

---

### L-02: エラーコード文字列の大文字/小文字混在

**対象ファイル**: 各 handler ファイル

- tag ハンドラ: `"internal_error"`, `"invalid_id"` (小文字) と `"TAG_NAME_EMPTY"`, `"TAG_IN_USE"` (大文字) の混在
- combo ハンドラ: `"not_found"`, `"conflict"` (小文字) と `"INVALID_TAG_ID"`, `"INVALID_QUERY_PARAM"` (大文字) の混在

指示書 CHANGE-010 §3.4「既存エラーコード文字列を変更しない」の制約内での既存不一致であり、本マイルストーンスコープ外。M4 以降での統一が望ましい。

---

### L-03: ローカルヘルパ関数の命名不統一

tag: `errResp()` / `errRespDetail()`、character: `charErrResp()`、combo: `comboErrResp()` / `comboErrCode()` と各ハンドラでヘルパの命名が異なる。CHANGE-010 §5.3「ヘルパ関数の必須化しない」の判断範囲内で許容されるが、将来的な統一が望ましい。

---

### L-04: `comboErrCode()` の Message フィールドが空

**対象ファイル**: `internal/api/combo/handler.go` L37-39

```go
func comboErrCode(code string) model.APIErrorResponse {
    return model.APIErrorResponse{Error: model.APIError{Code: code}}
}
```

`not_found`、`internal_error` 等のコードで Message が空文字になる。DES-002 §4.3 の JSON フォーマット例では `message` フィールドが人間可読文字列を持つことが想定されており、デバッグ時の可読性が下がる。機能動作には影響しない。

---

## 質問・確認事項

### Q-01: RecipeBuilder の console.warn 実装有無（M2-04 との乖離確認）

**観点**: §4.4.1 前提条件の確認  
**対象ファイル**: `web/src/features/combo/components/RecipeBuilder.tsx`  
**現状**: M3-05 §4.4.1 は「M2-04 §4.2 で console.warn を発火するロジックを実装した」と記述するが、現在のファイルに `console.warn` が存在しない  
**疑問点**: M2-04 の実際の実装で console.warn が追加されたか、それとも視覚的 UI 警告のみで console.warn は実装されなかったか  
**確認したい相手**: 開発者（M2-04 製造履歴の確認）  

P-01 の修正対応では、この確認結果に基づいて「console.warn の追加→テスト追加」か「テストのみ追加（実装は既存の視覚的警告のみ認める）」かを決定する必要がある。

---

## 良かった点

- **CHANGE-010 共通型の実装品質**: `model.APIError` / `model.APIErrorResponse` が指示書と完全一致。`Details` の `omitempty` 設計も正確。`api_error_test.go` の3テストケースも適切
- **旧独自エラー型の完全削除**: `tagErrorResponse` / `charErrorResponse` の grep ゼロ件を確認。playbook §4.7 全ハンドラ列挙原則を遵守
- **フロント側エラーパース対応**: `ComboErrorResponse` 型で `data.error.code` / `data.error.message` のネスト形式に正しく対応済み。後方非互換変更が UI 破綻なく追従されている
- **`starterMoveCode` のバッチ取得**: N+1 を回避するバッチ取得実装（`findMoveCodesByIDs`）が丁寧
- **空状態メッセージ改善**: `ComboTable` の `hasActiveFilters` / `onClearFilters` 対応と、`MyComboPage` の `emptyMessage` 利用が適切に分離
- **shadcn/ui 不使用**: playbook §4.6 を遵守し、標準 HTML + Tailwind で実装
- **型安全テスト**: `handler_test.go` でエラー系テストに `model.APIErrorResponse` 型でアンマーシャルする形式を採用（推奨方式）

---

## レビュー判定

- [x] 重大な問題あり → **製造担当に修正依頼（P-01、P-02）**

重大な問題2件を解消後、再レビューをもって M3-05 承認・M3 期間完了判定とする。

中程度の問題（M-01、M-02）は M4 着手前の早い段階での修正を推奨する。軽微な問題（L-01〜L-04）は後続マイルストーンでの対応を許容する。

---

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認（ブラウザ実機テスト、curl による API 確認）・パフォーマンス・M3 統合 E2E シナリオ A〜I の実機通過確認は別途開発者が実施が必要。
- `go test ./...` / `pnpm test` の実際の通過確認は本レビューでは実施していない。

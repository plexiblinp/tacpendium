# M3-05 実装報告書

対象マイルストーン: M3-05 コンボ一覧仕上げ + エラーレスポンス共通化  
作成日: 2026-05-15  
対象読者: 設計担当・指示書作成担当・開発者

---

## 1. 実装概要

M3 最終サブマイルストーンとして 5 スコープを実装した。

| スコープ | 概要 | 状態 |
|---------|------|------|
| CHANGE-010 エラー共通化 | 5 ハンドラを `model.APIErrorResponse` に統一 | ✅ 完了 |
| defaultRecipe | コンボ一覧の「ルート」列に実値を表示 | ✅ 完了 |
| starterMoveCode | 始動技列に技コードを表示（ID 表示を解消） | ✅ 完了 |
| 空状態メッセージ改善 | フィルタ適用中・ステータスタブ別の専用メッセージ | ✅ 完了 |
| RecipeBuilder テスト | console.warn テスト追加 | ⚠️ 後述（§3 P-01） |

---

## 2. 開発者と決めた実装判断

### 2-A. defaultRecipe の取得方式

**決定内容**: `recipe_cache` 活用方式を採用。サービス層 `List()` が `recipe_cache` JSON をパースしてプリセット ID=1 のレシピ文字列を `DefaultRecipe` にセットする。

**判断理由**: 指示書の「案Y（steps バッチロード）」では既存の steps 未ロード前提（N+1 回避設計）を壊すため、追加クエリ不要の `recipe_cache` 活用が低リスクと判断。

**設計担当への伝達**: `recipe_cache` の「デフォルトプリセットは ID=1」という暗黙前提を `extractDefaultRecipe()` で持っている（`internal/service/combo/service.go` の `defaultPresetID = "1"`）。プリセット ID 体系が変わった場合はここの更新が必要。

---

### 2-B. Validations の格納方法

**決定内容**: バリデーションエラーを `APIError.Details` に `map[string]any{"validations": result}` として格納する。

```json
{
  "error": {
    "code": "validation_failed",
    "message": "バリデーションエラーがあります",
    "details": { "validations": { "issues": [...] } }
  }
}
```

**判断理由**: `Details` を `map[string]any` 型で定義した共通型に、型安全でない形で格納する点はトレードオフ。将来 `Validations *validation.ValidationResult` を `APIError` に直接持たせる選択肢もあるが、現状は汎用 `Details` で許容。

**設計担当への伝達**: DES-002 §4.3 の JSON フォーマット例に `details.validations` の構造を追記すること。

---

### 2-C. 5 ハンドラ全統一（指示書スコープ外の preset / move を追加）

**決定内容**: 指示書が示した 3 ハンドラ（tag / character / combo）に加え、preset / move の 2 ハンドラも同一方針で統一した。

**判断理由**: `map[string]string{"error": "..."}` という前世代形式が 2 ハンドラに残存しており、中途半端な統一は将来の混乱を招くと判断。

**設計担当への伝達**: 全 5 ハンドラが `model.APIErrorResponse` 形式に統一済みであることを DES-002 または SUPP-001 に反映してほしい。

---

### 2-D. RecipeBuilder の実装方針

**決定内容**: 指示書 M3-05 §4.4 で要求された `console.warn` 追加およびテスト3ケースは「現時点では取り込まない」とした。M2-04 の実際の実装が視覚的 UI 警告のみであったため、既存テスト4件で代替完了とする。

**未解決扱い**: §3 P-01 参照。

---

## 3. 未解決課題

### P-01: RecipeBuilder console.warn 未実装（重要度: 中）

**内容**: 指示書 M3-05 §4.4 は `console.warn` 追加 + `vi.spyOn(console, 'warn')` による3テストケース追加を要求しているが、実装されていない。M2-04 の実際の実装が `console.warn` でなく視覚的警告だったことが原因。

**影響範囲**: `web/src/features/combo/components/RecipeBuilder.tsx` / `RecipeBuilder.test.tsx`

**対処希望**: **他のマイルストーン課題**（M4 または M5 着手前）として扱ってほしい。作業内容は以下の2点:
1. `RecipeBuilder.tsx` に `useEffect` で `console.warn("draftNotes が 50文字を超えています: N文字")` を追加
2. `RecipeBuilder.test.tsx` に3テストケースを追加（50文字以下で未発火 / 51文字以上で発火・文言確認 / 超過→減少時の過剰発火なし）

---

### M-01: defaultRecipe / starterMoveCode のバックエンドテスト不足（重要度: 中）

**内容**: 指示書 §5.1.3「必須テスト」として列挙されたテストが未実装:
- `service_test.go`: `extractDefaultRecipe` の正常系・NULL・パース失敗ケース
- `repository_test.go`: `starterMoveCode` が期待値で返ること / `StarterMoveID` が NULL のとき空文字
- `handler_test.go` の `TestHandler_List_200`: 件数のみ確認、`defaultRecipe` / `starterMoveCode` フィールド値を未検証

**対処希望**: **このターンで解決可能**（実装は既に動いており、テスト追加のみ）。ただし M4 着手前でも許容できる。開発者の意向に従う。

---

### L-02: エラーコード文字列の大文字/小文字混在（重要度: 低）

**内容**: tag / combo ハンドラで、インフラ系エラーは小文字（`not_found`, `internal_error`）、ドメイン固有エラーは大文字（`TAG_IN_USE`, `INVALID_TAG_ID`）が混在している。CHANGE-010 §3.4「既存コードを変更しない」制約下での既存不一致。

**対処希望**: **他のマイルストーン課題**（M4 以降）。統一するなら小文字 snake_case に揃えることを推奨。フロント側の `error.code` 比較箇所も合わせて修正が必要。

---

### L-03: ハンドラごとのエラーヘルパ命名不統一（重要度: 低）

**内容**:
- tag: `errResp()` / `errRespDetail()`  
- character: `charErrResp()`  
- combo: `comboErrResp()` / `comboErrCode()`

CHANGE-010 §5.3「ヘルパ関数は必須化しない」の範囲内ではあるが、将来 `model` パッケージに共通ヘルパとして切り出す余地がある。

**対処希望**: **他のマイルストーン課題**（優先度低）。

---

## 4. 設計・指示書担当への伝達事項

### 4-A. CHANGE-010 の指示書への反映（重要）

combo ハンドラのエラーレスポンスが **後方非互換変更** になっている:

| | 旧形式（M3-04 まで） | 新形式（M3-05 以降） |
|-|---------------------|---------------------|
| JSON | `{"error": "not_found", "message": "..."}` | `{"error": {"code": "not_found", "message": "..."}}` |

tag / character / preset / move は元から `{"error": {"code": "...", "message": "..."}}` 形式だったので影響なし。combo のフロント側は対応済み。**他のクライアントが combo API のエラーを直接パースしている箇所があれば要注意。**

DES-002 §4.3 のエラーレスポンス仕様に統一済みの形式を正規仕様として明記することを推奨。

---

### 4-B. 指示書 M3-05 §4.4.1 の前提の誤り（重要）

指示書 M3-05 §4.4.1 に「M2-04 §4.2 で `console.warn` を発火する警告ロジックを実装した」という前提記述があるが、**M2-04 の実装は視覚的 UI 警告（赤ボーダー + 文字数メッセージ）のみであり、`console.warn` は実装されなかった。**

後続マイルストーンの指示書・設計書でこの前提を引用しないよう注意が必要。P-01 の対応指示書を起こす際は「RecipeBuilder.tsx に console.warn を追加してから〜」と前提をゼロから書くこと。

---

### 4-C. defaultRecipe の仕様の明示を推奨

現在の実装では `recipe_cache` の `"1"` キー（プリセット ID=1）を defaultRecipe として抽出している。この「デフォルトプリセット = ID 1」という仕様が設計書（DES-004 §5 など）に明記されていない場合、SUPP-001 または DES-004 に追記することを推奨する。

---

### 4-D. M-01 の必須テストを M4 指示書に記載すること

指示書 M3-05 §5.1.3「必須テスト」として以下が列挙されたが未実装:

- `extractDefaultRecipe`: NULL / 空文字 / パース失敗 / 正常ケース
- `starterMoveCode`: 正常取得 / StarterMoveID が NULL のとき空文字返却
- `TestHandler_List_200`: `defaultRecipe` / `starterMoveCode` フィールド値の確認

次マイルストーン（M4）の DoD または準備タスクにこれらを明記してほしい。

---

### 4-E. `ComboSummary` と `Combo` の型分岐について

フロントエンドで `ComboSummary`（一覧用）と `Combo`（詳細用）が別 interface として定義されており、今回 `defaultRecipe` / `starterMoveCode` を両方に追加した。バックエンドの `ComboResponse` は一覧・詳細で同一型のため、今後フィールドを追加する際は**両 interface への追加が必要**なことをフロント型定義のコメントに明記しておくことを推奨する。

---

## 5. 既知の技術的負債

| ID | 内容 | 推奨対応時期 |
|----|------|------------|
| P-01 | RecipeBuilder console.warn + テスト3件未実装 | M4 または M5 着手前 |
| M-01 | defaultRecipe / starterMoveCode バックエンドテスト未追加 | M4 着手前（このターンで対応も可） |
| L-02 | エラーコード大文字/小文字混在 | M4 以降 |
| L-03 | ハンドラヘルパ命名不統一 | 優先度低 |

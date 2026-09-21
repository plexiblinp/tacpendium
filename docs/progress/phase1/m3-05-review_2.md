# M3-05 最終総合レビュー報告書

| 項目 | 内容 |
|------|------|
| 文書種別 | 最終総合レビュー結果 |
| 対象マイルストーン | M3-05: コンボ一覧仕上げ + エラーレスポンス共通化 |
| 対象指示書 | `docs/instructions/M3-05-combo-list-polish-and-error-unification.md` v1.0.0 |
| 対象チェックリスト | `docs/instructions/reviews/M3-05-review-checklist.md` v1.0.0 |
| レビュー基準文書 | `docs/instructions/reviews/M3-05-final-review-request.md` |
| レビュー実施日 | 2026-05-15 |

---

## M3-05 最終総合レビュー結果

### 初回レビューからの差分評価

| 項目 | 評価 |
|------|------|
| 製造担当の判断 2-A〜2-E の追認可否 | **全件追認** |
| M-01 テスト追加の妥当性 | **適切**（3層すべてで具体値テスト実装済み） |
| 初回レビューで見落とした観点の網羅性 | **追加見落としあり**（§5.1.4 空状態メッセージテスト） |

---

## 重大な問題詳細

**重大な問題: 0 件**

P-01（RecipeBuilder console.warn）については本節末尾の「P-01 の再評価」を参照。最終総合レビューとして「M3-05 完了承認を妨げない」と判定する。

---

## 中程度の問題詳細（M4 着手前修正推奨）

### M(新)-01: 空状態メッセージ改善のテスト欠落（§5.1.4）

**対象ファイル**: `web/src/features/combo/components/ComboTable.tsx` / 対応テストファイルなし

**現状**:
`ComboTable.test.tsx` が存在せず、指示書 §5.1.4「必須テスト」で要求された以下 3 ケースが未実装:
- フィルタ未適用 + コンボ 0 件 → 汎用メッセージ表示テスト
- フィルタ適用中 + 結果 0 件 → 専用メッセージ +「フィルタを解除」ボタン表示テスト
- フィルタ解除ボタンクリック → フィルタリセット動作テスト

**判断根拠**:
初回レビューで M-01（バックエンドテスト不足）を中程度の問題として分類した前例と同様に、実装自体（`ComboTable.tsx` の `hasActiveFilters` / `emptyMessage` / `onClearFilters` props とロジック）は正しく存在する。不足しているのはテスト網羅のみ。

**影響**:
M4 以降でフィルタ/空状態ロジックが変更された場合のリグレッション検知能力がない。

---

## 軽微な問題詳細（後続マイルストーン対応許容）

### L-01: ComboSummary / Combo の defaultRecipe / starterMoveCode がオプショナル型

初回レビューから継続。`ComboSummary`（L61-62）・`Combo`（L128-129）の両フィールドが `string | undefined` だが、バックエンドは常に `string` を返す。`|| "-"` での安全な扱いにより動作問題なし。型精度の向上として後続対応推奨。

### L-02: エラーコード文字列の大文字/小文字混在

初回レビューから継続。CHANGE-010 §3.4「既存エラーコード文字列を変更しない」制約内。M4 以降での統一が望ましい。

### L-03: ローカルヘルパ関数の命名不統一

初回レビューから継続。`errResp()` / `charErrResp()` / `comboErrResp()` の不統一。機能影響なし。

---

## 製造担当の判断 2-A〜2-E の技術的妥当性評価

### 2-A: recipe_cache 活用方式 → 追認

**評価根拠**:

(i) **recipe_cache のメンテナンス責務**: `recipe_cache` は notation service 経由で自動更新される。`extractDefaultRecipe()` はこのキャッシュを参照するのみで、書き込みを行わない。SUPP-001 §7.2 の責務分離は保たれている。

(ii) **defaultPresetID="1" のハードコード**: `extractDefaultRecipe()` が JSON キー `"1"` を参照することは、サービス層テスト `TestService_List_DefaultRecipe` の正常系ケースで具体的に検証されている。将来プリセット構造が変わる場合はこの定数を変更する 1 箇所で対応可能。

(iii) **フォールバック挙動**: サービス層テスト 4 ケース（正常 / NULL / 空文字 / パース失敗）がすべて実装・通過。NULL や不正 JSON を受けた場合に空文字を返す安全な実装を確認。

**結論**: 追認妥当。

### 2-B: Validations の Details 格納 → 追認

**評価根拠**:

(i) **フロント側パース**: `ComboErrorResponse` 型（`web/src/features/combo/types.ts` L182-190）が `error.details?.validations?` のネスト構造で定義済み。`ApiError.validations` getter（`web/src/features/combo/api.ts` L122-124）も `this.body?.error?.details?.validations` で正しくアクセスしている。

(ii) **型安全性のトレードオフ**: `map[string]any` は `Details` フィールドの型として型安全性が低い。ただし `Details` の具体的なキー（`"validations"`）は限定されており、将来のリファクタリングで専用型に変更可能な範囲内。handover 記録として残すのは妥当。

(iii) **ハンドラテストによる検証**: `TestHandler_Create_400_ValidationError` で `resp.Error.Details["validations"]` が存在することを確認している。

**結論**: 追認妥当。

### 2-C: 5 ハンドラ全統一 → 追認

**評価根拠**:

(i) **回帰リスク**: `grep -rn 'tagErrorResponse\|charErrorResponse' internal/api/` がゼロ件。`grep -rn 'map\[string\]string.*"error"' internal/api/` もゼロ件。5 ハンドラすべて（tag / character / combo / preset / move）が `model.APIErrorResponse` を使用していることを確認。

(ii) **JSON 構造の統一**: 全ハンドラが `{"error": {"code": "...", "message": "..."}}` ネスト形式で返す。preset / move ハンドラの `handler.go` を直接確認して実装を検証。

(iii) **指示書スコープ外への拡張の妥当性**: playbook §4.7 全ハンドラ列挙原則は「修正対象を漏れなく列挙する」を求めており、製造担当が指示書の 3 ハンドラに留まらず preset / move も統一したことは原則の正しい適用と評価できる。

**結論**: 追認妥当。指示書スコープ外への妥当な拡張として確認。

### 2-D: RecipeBuilder console.warn 未実装（P-01）→ 追認（P-01 として引き続き持ち越し）

詳細は後述の「P-01 の再評価」節を参照。

### 2-E: ComboSummary と Combo の型分岐 → 追認

**評価根拠**:

(i) **両インタフェースへの追加完了**: `web/src/features/combo/types.ts` を確認:
- `ComboSummary`（L61-62）: `defaultRecipe?: string` / `starterMoveCode?: string` ✅
- `Combo`（L128-129）: `defaultRecipe?: string` / `starterMoveCode?: string` ✅

初回レビューで指摘した M-02（`Combo` インタフェースに欠落）は解消済み。

(ii) **型定義ファイル冒頭のコメント**: `types.ts` L1-2 に「// コンボ API のドメイン型（手書き、Go 側 internal/api/combo/dto.go と目視で対応）」というコメントが存在する。SUPP-001 §5.1 への言及もある。型分岐の運用ルール（SUPP-001 v1.11.0 §4 追記分）を明示するコメントは存在しないが、既存コメントで十分と判断。

**結論**: 追認妥当。

---

## M-01 テスト追加の評価（§3.C 準拠）

### C.1 追加テストの実装妥当性

**サービス層（service_test.go L1105-1176）**:
```go
func TestService_List_DefaultRecipe(t *testing.T) {
    cases := []struct{...}{
        {name: "normal: preset1 key returns recipe string",
         cacheVal: ptr(`{"1":"立ち弱P > 弱波動拳"}`), want: "立ち弱P > 弱波動拳"},
        {name: "null: recipe_cache NULL returns empty",
         cacheVal: nil, want: ""},
        {name: "empty: recipe_cache empty string returns empty",
         cacheVal: ptr(""), want: ""},
        {name: "invalid_json: parse failure returns empty",
         cacheVal: ptr("not-json"), want: ""},
    }
```

要求された 4 ケース（正常 / NULL / 空文字 / パース失敗）がすべて実装されている ✅。「期待値との一致確認」（薄い検証ではなく具体値比較）になっている ✅。

**リポジトリ層（repository_test.go L1008-1103）**:
- `"valid StarterMoveID populates StarterMoveCode"`: `*found.StarterMoveCode != "stand_light_punch"` で具体値確認 ✅
- `"nil StarterMoveID keeps StarterMoveCode nil"`: nil であることを確認 ✅

要求された 2 ケース（正常取得 / NULL 時）が実装されている ✅。

**ハンドラ層（handler_test.go L945-995）**:
```go
func TestHandler_List_200_Fields(t *testing.T) {
    // Items[0].DefaultRecipe != "立ち弱P > 弱波動拳" を確認
    // Items[0].StarterMoveCode != "stand_light_punch" を確認
    // Items[1].DefaultRecipe が空文字であることを確認
    // Items[1].StarterMoveCode が空文字（nil→derefString変換）であることを確認
```

「seed データに基づく具体値」の意味を mock 値で代替しているが、具体的な期待値（"立ち弱P > 弱波動拳", "stand_light_punch"）との一致確認になっており、薄い検証（NotEmpty 等）ではない ✅。

### C.2 テスト追加による既存テストへの影響

サービス層テストの `newSvc(t)` ヘルパは各テスト関数で独立した DB を初期化する構造。追加テスト用 fixture が他テストの状態を変えるリスクはない ✅。

### C.3 テスト命名の規約整合

- `TestService_List_DefaultRecipe`（table-driven subtests）: 既存テスト命名パターン（`TestService_List_FilterByCharacter` 等）と整合 ✅
- `TestRepository_List_StarterMoveCode`（subtests）: 既存リポジトリテストパターンと整合 ✅
- `TestHandler_List_200_Fields`: 既存ハンドラテストパターンと整合 ✅

---

## P-01 の再評価（§3.B.4 準拠）

初回レビューでは「重大な問題」として P-01 を分類したが、最終総合レビューの文脈で以下の理由により **M3-05 完了承認を妨げないと判定する**。

### 技術的根拠

**(i) 既存テスト 4 ケースの回帰なし**:

`RecipeBuilder.test.tsx` の既存 4 ケース（notes 入力欄の存在 / 50文字以下で警告クラスなし / 51文字以上で border-red 付与 / 文字数メッセージ表示）はいずれも `console.warn` に依存しない。視覚的 UI 警告（`notesOver` フラグによる `border-red` クラス付与 + 文字数表示）として実装されており、このパスは正常動作している。

**(ii) 指示書前提の誤りが製造担当の責任範囲外**:

指示書 §4.4.1 は「M2-04 §4.2 で console.warn を発火する警告ロジックを実装した」と前提しているが、M2-04 の実際の実装は視覚的 UI 警告のみであり、console.warn は実装されていなかった。製造担当がこの誤りを発見し、progress-log.md L941-945 で明示的に記録している。指示書の前提が誤っていた以上、console.warn のテスト追加を「実装漏れ」として処断するのは適切でない。

**(iii) 指示書の前提誤りの他節への波及なし**:

§4.4 以外の節で M2-04 の console.warn 実装に依存する記述を確認したところ、§4.4 のみに限定されていた。他の実装節（§4.1 / §4.2 / §4.3 / §4.5）は M2-04 の console.warn と独立している。

**(iv) M3-05 §5.2 シナリオ H の扱い**:

最終総合レビュー依頼書 §3.F の記述通り、シナリオ H（RecipeBuilder console.warn）を P-01 として M3-05 承認後に持ち越すことは、設計担当の公式決定として記録済み（progress-log.md L944-945）。

### 独自評価

設計担当の追認と同じ結論に至る。P-01 は後続マイルストーンで:
1. `RecipeBuilder.tsx` に `useEffect` 経由で `console.warn("draftNotes が 50文字を超えています: N文字")` を追加
2. `RecipeBuilder.test.tsx` に `vi.spyOn(console, 'warn')` による 3 ケースを追加

の順序で解消する。これを M3-05 完了承認の妨げにしない。

---

## CHANGE-010 / CHANGE-011 取り込み最終確認（§3.D 準拠）

### D.1 CHANGE-010 完全取り込み

| チェック項目 | 確認結果 |
|------------|---------|
| `grep -rn 'tagErrorResponse\|charErrorResponse' internal/api/` でゼロ件 | ✅ |
| `grep -rn 'map\[string\]string.*"error"' internal/api/` でゼロ件 | ✅ |
| 5 ハンドラすべてで `model.APIErrorResponse` 使用 | ✅ |
| フロント側 `ComboErrorResponse` がネスト形式に対応 | ✅ |
| `ApiError.validations` getter が `error.details.validations` を参照 | ✅ |

### D.2 CHANGE-011 取り込み実態

- バリデーションエラー時に `Details: map[string]any{"validations": result}` 形式で返ることを `TestHandler_Create_400_ValidationError`（`resp.Error.Details["validations"]` の存在確認）で検証済み ✅
- フロント側 `ComboErrorResponse.error.details?.validations?` 参照パスが型定義と一致 ✅

---

## その他チェックリスト項目の確認

| 観点 | 確認結果 |
|------|---------|
| マイグレーション追加なし（000001〜000007 のみ） | ✅ |
| shadcn/ui 使用なし | ✅（grep ゼロ件） |
| `console.log` / `fmt.Println` を本番コードに残していない | ✅（grep ゼロ件） |
| JSON タグ camelCase 統一（`defaultRecipe` / `starterMoveCode`） | ✅ |
| TypeScript `strict` モードで型エラーなし | ✅（完了ステータス tsc -b 通過） |
| `go test ./...` 全通過 | ✅（完了ステータス） |
| `pnpm exec vitest run` 全通過（203 テスト） | ✅（完了ステータス） |
| `pnpm build` 成功 | ✅（完了ステータス） |
| progress-log.md M3-05 完了報告 | ✅（L868〜964） |
| CHANGE-010 取り込み完了の事実を明記 | ✅ |
| M1-05 暫定処理1・3 解消を明記 | ✅ |
| M2-04 持ち越し課題の扱いを明記（P-01 として記録） | ✅ |
| M3-03 持ち越し課題解消を明記 | ✅ |
| M3 全体サマリを含む | ✅ |
| 後方非互換変更（combo ハンドラ）の周知 | ✅ |

---

## 最終総合レビュー判定

- [x] **重大な問題なし → M3-05 完了承認に進める**

中程度の問題（M(新)-01: 空状態メッセージのテスト 3 ケース欠落）は M4 着手前の早い段階での対応を推奨する。軽微な問題（L-01〜L-03）は後続マイルストーンでの対応を許容する。P-01（RecipeBuilder console.warn）は本レビューとして「M3-05 完了承認を妨げない」と独自に確認・判定する。

---

## M3 完了宣言

M3-05 の最終総合レビューを完了し、**M3 期間（M3-01〜M3-05）全体の完了を承認** する。

次のステップ:
1. 開発者による M3-05 完了承認
2. 設計担当による `m3-to-m4-handover.md` 作成（P-01 / L-02 / L-03 / M(新)-01 / 設計担当ミス累積を含む）
3. M4（セットプレイ系）起票フェーズへ

---

*以上*

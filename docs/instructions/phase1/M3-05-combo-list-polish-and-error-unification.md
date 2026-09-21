# 指示書 M3-05: コンボ一覧仕上げ + エラーレスポンス共通化 + M3 統合 E2E

| 項目 | 内容 |
|------|------|
| 指示書ID | M3-05 |
| バージョン | 1.0.0 |
| 対象マイルストーン | M3(マイコンボ系)の最終サブマイルストーン |
| 推奨モデル | **Opus 4.6** |
| Plan Mode | **任意**(複数の独立した小スコープを束ねる構成のため、実装着手前の計画提示は推奨) |
| 機械レビュー | **必須**(別チェックリスト: `docs/instructions/reviews/M3-05-review-checklist.md`) |
| 並列性 | **単独**(M3 は完全直列、M3-04 完了承認が前提) |
| 依存指示書 | M3-01〜M3-04(M3 全機能の統合 E2E を実施するため) |
| 関連通知書 | **CHANGE-010**(DES-002 §4.3 エラーレスポンス共通 Go 型の明示、本指示書の §4.5 で実装) |
| 想定所要時間 | 180〜270 分(5 つの独立スコープを束ねる構成) |
| 作成者 | 詳細設計・製造準備担当Claude(M3 期間担当) |
| 作成日 | 2026-05-10 |
| 更新日 | 2026-05-10 |

## 更新履歴

| バージョン | 更新日 | 更新内容 |
|-----------|--------|----------|
| 1.0.0 | 2026-05-10 | 初版作成 |

---

## 1. 背景と目的

### 1.1 背景

M3-01〜M3-04 でマイコンボ系の主要機能(タグ機能・コンボへのタグ付与・フィルタ/ソート/表示列カスタマイズ・マイコンボ画面・ステータス変更 UI)が完成した。本マイルストーンは M3 期間の **最終サブマイルストーン** として、以下を扱う:

1. M1-05 暫定処理1・3 の解消(レシピ表示改善 + 始動技 ID 表示の解消)
2. M2-04 持ち越し課題(`RecipeBuilder` の `draftNotes` 50文字超警告の console.warn テスト追加)
3. M3-03 / M3-04 由来の持ち越し課題(フィルタ適用時の空状態メッセージ改善)
4. **CHANGE-010 取り込み**: エラーレスポンス共通化(M3-04 完了報告で製造担当から指摘された設計改善、3 ハンドラの不統一を `model.APIErrorResponse` 共通型に統一)
5. M3 全体の統合 E2E 確認(M3-01〜M3-04 + 本マイルストーンの全機能が統合動作することの確認)

### 1.2 目的

- M1-05 で暫定処理として残置されていた **レシピ表示改善**(始動技コード経由の表示)と **始動技 ID 表示**(`starter_move_id` がそのまま画面に出てしまう問題)を、コンボ一覧 API の DTO 拡張(`default_recipe` + `starter_move_code` フィールド追加)で正式解消する(M3-overview v1.0.1 §3.5 確定の案 A)
- M2-04 持ち越し課題: `RecipeBuilder.tsx` の `draftNotes` 50文字超警告 (M2-04 §4.2 実装) の console.warn テストを追加する
- M3-03 完成時の持ち越し課題: フィルタ適用時の空状態メッセージを「フィルタ条件にマッチするコンボがありません」のような意味のある表示に改善する
- **CHANGE-010 取り込み**: `internal/model/api_error.go` に共通型 `APIError` / `APIErrorResponse` を新設、既存 3 ハンドラ(tag / character / combo)の独自定義を共通型に置き換える
- M3 全体の E2E 確認: M3-01 タグ管理 → M3-02 タグ付与 → M3-03 フィルタ・ソート・表示列カスタマイズ → M3-04 マイコンボ画面・ステータス変更 → 本マイルストーンの改善内容まで、すべてが統合動作することを実機ブラウザで確認する

### 1.3 このマイルストーンで作らないもの

- 複数キャラクターの seed データ追加 — M7 仕上げで対応(M3 ではリュウのみ継続)
- マイコンボ画面のスマホボトムシート対応 — M7 で対応
- セットプレイ関連 — M4 で実装
- 下書き自動保存(FR603) — M6 で実装
- 仮想コントローラの複数レイアウト + 選択保持 — M7 で実装
- 物理コントローラ入力 / モダン操作 / 公式データ取り込み — フェーズ2 / フェーズ3 で実装
- **共通エラー型のヘルパ関数(`NewAPIError()` 等)** — CHANGE-010 §5.3 で「製造担当判断、強制しない」と明記済み。本指示書でも強制しない
- **既存エラーコード文字列の変更**(`INVALID_GAME_ID` / `VALIDATION_ERROR` 等) — CHANGE-010 §3.4 で「既存値を維持、後方互換」と明記、本指示書でも変更しない

---

## 2. 成果物

### 2.1 作成するファイル

```
internal/
└── model/
    ├── api_error.go                                # 共通エラー型(CHANGE-010、§4.5)
    └── api_error_test.go                           # 共通型の JSON 直列化テスト
```

### 2.2 修正するファイル

#### バックエンド

| ファイル | 修正内容 |
|---------|---------|
| `internal/api/tag/handler.go`(または相当) | `tagErrorResponse` 構造体を削除、`model.APIErrorResponse` 共通型に置き換え(§4.5) |
| `internal/api/character/handler.go`(または相当) | `charErrorResponse` 構造体を削除、`model.APIErrorResponse` 共通型に置き換え(§4.5) |
| `internal/api/combo/handler.go`(または相当) | `map[string]string` フラット形式を `model.APIErrorResponse` 共通型に置き換え(§4.5)、**フラット → ネストの後方非互換変更あり、§4.5.4 参照** |
| `internal/api/combo/handler.go` 等のコンボ一覧 API ハンドラ | `GET /api/combos` のレスポンス DTO に `default_recipe` フィールドを追加(§4.1) |
| `internal/api/combo/handler.go` 等のコンボ一覧 API ハンドラ | `GET /api/combos` のレスポンス DTO に `starter_move_code` フィールドを追加(§4.2) |
| `internal/service/combo/service.go`(または相当) | レスポンス組み立て時に `default_recipe` / `starter_move_code` を生成するロジック追加(§4.1 / §4.2) |
| `internal/repository/combo/repository.go`(または相当) | `default_recipe` / `starter_move_code` 生成に必要なクエリ拡張(JOIN 等) |
| 各ハンドラ・サービス・リポジトリのテストファイル | エラーレスポンス形式変更に伴うテスト期待値修正(§4.5.5)、DTO 拡張に伴うテスト追加(§4.1 / §4.2) |

#### フロントエンド

| ファイル | 修正内容 |
|---------|---------|
| `web/src/features/combo/components/ComboTableRow.tsx`(または一覧テーブルの行を描画している箇所) | `default_recipe` を表示するレシピ列の修正(M1-05 暫定処理1の解消、§4.1.4) |
| `web/src/features/combo/components/ComboTableRow.tsx` 等 | `starter_move_code` を表示する始動技列の修正(M1-05 暫定処理3の解消、§4.2.4) |
| `web/src/features/combo/types.ts` / `web/src/features/combo/api/comboApi.ts`(または相当) | コンボ一覧 DTO 型定義に `default_recipe: string` / `starter_move_code: string` を追加 |
| `web/src/features/combo/components/ComboListPage.tsx`(または一覧画面の空状態表示) | フィルタ適用時の空状態メッセージ改善(§4.3) |
| `web/src/features/combo/components/RecipeBuilder.test.tsx`(M2-04 で新規 4 ケース、本指示書で console.warn テスト追加) | console.warn 警告動作のテストを追加(§4.4) |
| **フロント側 combo API エラーレスポンスのパース箇所**(該当する場合) | combo ハンドラのエラーレスポンス形式変更(フラット → ネスト)に伴う修正、§4.5.4 |

### 2.3 変更しないもの(原則)

- M3-01 で整備したタグ CRUD API・タグ管理画面の動作
- M3-02 で整備したコンボへのタグ付与 UI・コンボ DTO の tags フィールド
- M3-03 で整備した共通ヘルパ `browser-storage.ts`、`useComboListFilters` / `useColumnVisibility` フック、フィルタ・ソート・表示列カスタマイズ
- M3-04 で整備した character API・useCharacters フック・マイコンボ画面・MyComboStatusSelect + useUpdateMyComboStatus
- 既存のコンボ編集2方式分離・楽観的排他制御
- マイグレーション(本マイルストーンは DB 変更なし)
- HTTP ステータスコードの選択(エラー共通化でも既存実装を踏襲、CHANGE-010 §3.4)
- エラーコード文字列(`INVALID_GAME_ID` / `VALIDATION_ERROR` 等の既存値を維持、CHANGE-010 §3.4)

### 2.4 例外: 設計書本体への影響

**CHANGE-010** で DES-002 §4.3 にエラーレスポンス共通 Go 型(`model.APIError` / `model.APIErrorResponse`)を追記する変更を起票済み。本指示書はその実装担当として §4.5 で正式取り込みを行う。

---

## 3. 前提条件

### 3.1 必読ドキュメント

- `CLAUDE.md`(全体方針、特に **§4 JSON タグ camelCase / 列挙定数同期ルール**、§10 禁止事項)
- `docs/instructions/M3-overview.md` v1.0.2(M3 全体像、**§3.5 M3-05 詳細**)
- `docs/instructions/M3-01〜M3-04` の各指示書(統合 E2E のため全機能の前提を把握)
- **`docs/change-notifications/CHANGE-010-api-error-common-type.md` v1.0.0**(本指示書の §4.5 の根拠)
- `docs/design/02-architecture.md` v1.5.0:
  - **§4.3 エラーハンドリング**(CHANGE-010 で追記予定、§4.5 で実装)
  - §4.2 主要エンドポイント
- `docs/design/05-screen-design.md`:
  - **§5.4 コンボ一覧**(L183-236): レシピ列・始動技列の表示要件
- `docs/design/supp-001-detailed-design.md` v1.10.0:
  - §5.4 / §5.5 テスト規約
  - §6.4 列挙定数同期ルール
- `docs/handover/design-instruction-playbook.md` v1.5.0:
  - **§4.5 フローの素直さ原則**
  - **§4.6 UI ライブラリ実態確認原則**(shadcn/ui は M7 まで未導入)
  - **§4.7 全ハンドラ列挙原則**(本指示書のエラー共通化で適用)
  - **§4.8 列挙定数即時同期原則**

### 3.2 任意参照(必要時のみ参照)

- M1-05 / M1-06 指示書: コンボ一覧画面・コンボ編集画面の既存実装
- M2-04 指示書: `RecipeBuilder` の `draftNotes` 50文字超警告の実装経緯
- `docs/progress/progress-log.md`: M3-04 完了報告の製造担当指摘 2 件目(エラー共通化の出処)

### 3.3 参照不要

- DES-004 内部表現仕様書(プリセット系、本指示書のスコープ外)
- M4 以降の指示書(後続マイルストーンのため)

### 3.4 着手前の確認

製造担当 Claude Code は §4 詳細仕様の実装に着手する前に、以下を確認する。

#### 3.4.1 既存エラーレスポンス形式の grep 確認

```bash
# 既存のエラー型・レスポンス形式を全件洗い出す
grep -rn 'tagErrorResponse\|charErrorResponse\|errorResponse\|ErrorResponse' internal/api/
grep -rn 'map\[string\]string.*"error"' internal/api/
grep -rn 'c\.JSON.*"error"' internal/api/ | head -30
```

期待される確認事項:
- tag ハンドラの `tagErrorResponse`(details フィールドあり)の使用箇所をリストアップ
- character ハンドラの `charErrorResponse`(details なし)の使用箇所をリストアップ
- combo ハンドラの `map[string]string{"error": "...", "message": "..."}` のフラット形式の使用箇所をリストアップ
- 各形式の修正対象を完全に列挙(playbook §4.7 全ハンドラ列挙原則)

#### 3.4.2 既存コンボ一覧 API の DTO 確認

```bash
# 既存のコンボ一覧レスポンス構造を確認
grep -n 'json:"' internal/model/combo.go internal/api/combo/*.go | head -30
curl http://localhost:47318/api/combos | head -c 500
```

期待される確認事項:
- 現状の `Combo` モデル / レスポンス DTO の JSON フィールド一覧
- `default_recipe` / `starter_move_code` がまだ存在しないことの確認

#### 3.4.3 既存テストの確認

```bash
# 既存のエラー系テストの期待値を洗い出す
grep -rn '"error"' internal/api/*_test.go | head -20
grep -rn 'StatusBadRequest\|StatusConflict\|StatusInternalServerError' internal/api/*_test.go | head -20
```

期待される確認事項:
- 既存テストで `"error"` キーを期待値としているテストケース数(combo 系で複数あるはず)
- HTTP ステータスコードと期待値 JSON 構造の対応関係

#### 3.4.4 RecipeBuilder の console.warn 実装確認

```bash
grep -n 'console.warn\|draftNotes' web/src/features/combo/components/RecipeBuilder.tsx
cat web/src/features/combo/components/RecipeBuilder.test.tsx | head -50
```

期待される確認事項:
- `console.warn` が `draftNotes` 50文字超で発火することの確認(M2-04 §4.2 で実装済み)
- 既存テストファイル `RecipeBuilder.test.tsx` の構造(4 ケース、M2-04 で新規追加)
- 本指示書で追加する console.warn テストの統合方針

#### 3.4.5 フロント側の combo API エラーパース箇所の確認

```bash
# combo API エラーレスポンスをパースしている箇所
grep -rn 'response.json\(\).*error\|error.message\|error.code' web/src/features/combo/ | head -10
```

期待される確認事項:
- combo API のエラーレスポンスを参照している箇所のリストアップ
- 現状 `error` がトップレベル(フラット形式)か `error.code` / `error.message`(ネスト形式)かの確認
- CHANGE-010 §4.2 でフラット → ネストの後方非互換変更があるため、修正対象を網羅

#### 3.4.6 確認結果の報告

製造担当 Claude Code は §3.4.1〜§3.4.5 の確認コマンド出力を実装完了報告に含める。

#### 3.4.7 §4 着手の前提条件

§3.4.1〜§3.4.5 の全確認結果が期待通りであることを確認してから、§4 詳細仕様の実装に着手する。万一現状が想定と乖離する場合は Plan Mode で停止して開発者に報告する。

---

## 4. 詳細仕様

### 4.1 レシピ表示改善(M1-05 暫定処理1の解消、案 A 採用)

#### 4.1.1 背景

M1-05 でコンボ一覧画面のレシピ列を実装した際、本来は「始動技コードを起点として技の組み合わせを文字列化したレシピ」を表示すべきだったが、当時の暫定実装ではレシピ文字列の生成ロジックが間に合わず、コンボ一覧 API には含まれていなかった。そのためフロント側は「(暫定: ID のみ表示)」や類似の暫定表示で凌いでいた。

M3-overview v1.0.1 §3.5 で **案 A**(コンボ一覧 API レスポンス DTO に `default_recipe` フィールドを追加し、バックエンドでレシピ文字列を生成して返す)を採用すると確定した。

#### 4.1.2 バックエンド実装

`GET /api/combos` のレスポンス DTO に `default_recipe: string` フィールドを追加する。

- Go 側のフィールド命名: `DefaultRecipe`(PascalCase)、JSON タグ `defaultRecipe`(camelCase、CLAUDE.md §4)
- レシピ文字列の生成ロジック: サービス層またはリポジトリ層で、コンボの `steps` 配列を順に文字列化して結合
- 結合形式: 既存のフロント側レシピ文字列化ロジック(M1-05 暫定で実装されている)を参考に、同じ形式で生成
  - 例: `"波動拳 > 中P > 弱K"` のような区切り文字 `" > "` で結合
  - 詳細は §3.4.2 着手前確認で現状のフロント実装を確認した上で確定する
- 始動状況(`starterSituation`)に応じたレシピ表現の分岐は本指示書では実装しない(現状の暫定実装と同等の表示)

#### 4.1.3 リポジトリ層

`Combo` 構造体の生成時に必要な情報(`steps` 配列の各ステップに対応する技名)を取得する。既存のコンボ一覧クエリで `combo_steps` を JOIN して取得しているはずなので、技名解決のクエリが不足する場合は追加する。

実装方針:
- 案 X: リポジトリ層でレシピ文字列まで生成(SQL 中で文字列結合)
- 案 Y: リポジトリ層は `Combo` 構造体に `Steps []ComboStep` を含めて返し、サービス層で文字列化
- 案 Z: 別途レシピ生成ヘルパを `internal/util/recipe/` に作成

推奨は **案 Y**(サービス層で生成)。理由: SQL 中の文字列結合は SQLite 方言依存リスクが高く、Go 側で書く方がメンテナンスしやすい。製造担当のレイアウト判断で別案も許容する。

#### 4.1.4 フロントエンド実装

`ComboTableRow.tsx`(または相当)のレシピ列で、現状の暫定表示を `default_recipe` フィールドの直接表示に置き換える。

- 型定義拡張: `Combo` 型に `defaultRecipe: string` フィールドを追加
- 既存のレシピ文字列化フロント側ロジック(M1-05 暫定で実装したもの)は **削除またはアーカイブ**。完全削除すると将来の検索性が下がるため、ファイル冒頭にコメントを残して空のエクスポートにする選択肢もある(製造担当判断)
- 空文字列の場合の表示: 「(レシピなし)」のような placeholder で表示(製造担当判断)

#### 4.1.5 設計判断事項

- DTO フィールド名: `defaultRecipe`(camelCase 統一)
- レシピ生成タイミング: サービス層(案 Y 推奨)
- 区切り文字: `" > "`(§3.4.2 で現状フロント実装を確認した上で確定)

### 4.2 始動技 ID 表示の解消(M1-05 暫定処理3)

#### 4.2.1 背景

M1-05 でコンボ一覧画面の始動技列を実装した際、`starter_move_id`(数値 ID)がそのまま画面に表示されてしまう暫定実装が残っていた。本来は技コード(`move_code`、人間可読な文字列識別子)を表示すべき。

M3-overview v1.0.1 §3.5 で **`starter_move_code` フィールドをコンボ一覧 API DTO に追加** すると確定。

#### 4.2.2 バックエンド実装

`GET /api/combos` のレスポンス DTO に `starter_move_code: string` フィールドを追加する。

- Go 側: `StarterMoveCode string` / JSON タグ `starterMoveCode`
- 生成ロジック: コンボの `starter_move_id` を引いて `moves` テーブルの `code` フィールドを取得
- リポジトリ層で `moves` テーブルを LEFT JOIN し、`starter_move_code` を取得

#### 4.2.3 始動技が設定されていない場合の挙動

- コンボに `starter_move_id` が設定されていない(NULL)場合、`starter_move_code` は空文字 `""` を返す
- フロント側は空文字の場合に「-」または「(未設定)」のような placeholder で表示(製造担当判断)

#### 4.2.4 フロントエンド実装

`ComboTableRow.tsx`(または相当)の始動技列で、`starter_move_id` 表示を `starter_move_code` 表示に置き換え。

- 型定義拡張: `Combo` 型に `starterMoveCode: string` フィールドを追加
- 既存の `starter_move_id` 表示ロジックを `starterMoveCode` に差し替え

### 4.3 フィルタ適用時の空状態メッセージ改善(M3-03 持ち越し課題、M3-04 §1.3 で明示)

#### 4.3.1 背景

M3-03 でフィルタ・ソート・表示列カスタマイズを実装した際、フィルタ条件にマッチするコンボが 0 件の場合の表示が「コンボがありません」のような一般的なメッセージのみで、ユーザーが「フィルタを解除すれば見えるかも」と気づきにくい状態だった。M3-04 §1.3 で持ち越し課題として明示済み。

#### 4.3.2 改善方針

コンボ一覧画面・マイコンボ画面の両方で、以下の分岐表示を実装:

| 状況 | 表示 |
|------|------|
| コンボが 1 件もない(フィルタ未適用) | 「コンボがまだ登録されていません」+ 新規登録ボタンへのリンク |
| フィルタ適用中だが結果が 0 件 | **「フィルタ条件にマッチするコンボがありません」+ フィルタ解除ボタン**(本指示書の新規実装) |
| ローディング中 | ローディング表示(既存) |

#### 4.3.3 実装方針

- フィルタが適用されているかの判定: `useComboListFilters` の現在の filter state を確認、`tagIds.length > 0 || starterSituation !== '' || hitType !== ''` 等の条件(M3-03 のフィルタ構造に依存、§3.4 着手前確認で確定)
- フィルタ解除ボタン: 既存の `useComboListFilters.clearAll()` または同等のメソッドを呼ぶ(M3-03 で実装済みのはず、未実装なら本指示書で追加)
- スタイリング: 既存の空状態表示と同じトーン、Tailwind で実装(playbook §4.6)

#### 4.3.4 マイコンボ画面への適用

マイコンボ画面でも、ステータスタブ選択時に該当コンボが 0 件の場合、「『使用中』タグのコンボがありません」のような状況固有のメッセージを表示する。詳細は製造担当判断(本指示書では「フィルタ適用時の空状態メッセージ」の概念を統一的に適用するという原則のみ確定、個別文言は製造担当のレイアウト判断)。

### 4.4 RecipeBuilder console.warn テスト追加(M2-04 持ち越し課題)

#### 4.4.1 背景

M2-04 §4.2 で `RecipeBuilder.tsx` に `draftNotes` 50文字超で `console.warn` を発火する警告ロジックを実装した(ModifiersEditor と同パターン)。同時に `RecipeBuilder.test.tsx` を新規 4 ケースで作成したが、**console.warn の発火自体をテストするケースは M3 以降に持ち越し** とされた(progress-log.md L536)。

本マイルストーンでこの持ち越し課題を解消する。

#### 4.4.2 追加するテストケース

`web/src/features/combo/components/RecipeBuilder.test.tsx` に以下を追加:

- ケース1: `draftNotes` に 50 文字以下を入力 → `console.warn` が発火しない
- ケース2: `draftNotes` に 51 文字以上を入力 → `console.warn` が 1 回発火、警告メッセージに「50文字を超えています」等の文言が含まれる
- ケース3: 50 文字超を 50 文字以下に減らす → `console.warn` の追加発火がない(状態変化での過剰発火がないことの確認)

#### 4.4.3 実装方針

- `vi.spyOn(console, 'warn')` または同等の Vitest API で `console.warn` をスパイ
- 既存テストで `console.warn` をモックしている場合は、その方式を踏襲(§3.4.4 で確認済み)
- `beforeEach` / `afterEach` でスパイのリセット

### 4.5 エラーレスポンス共通化(CHANGE-010 取り込み)

#### 4.5.1 背景

M3-04 完了報告で製造担当から、エラーレスポンス形式がプロジェクト全体で不統一(tag / character / combo の 3 形式が混在)である事実が指摘された。CHANGE-010 で DES-002 §4.3 に Go 共通型を追記する変更を起票済み。本節で実装する。

#### 4.5.2 共通型の新規作成

新規ファイル: `internal/model/api_error.go`

```go
package model

// APIError は API エラーレスポンスのエラー詳細部分の共通型。
// DES-002 §4.3 の JSON フォーマット例の "error" フィールドに対応する。
type APIError struct {
    Code    string         `json:"code"`
    Message string         `json:"message"`
    Details map[string]any `json:"details,omitempty"`
}

// APIErrorResponse は APIError をラップした共通レスポンス型。
// DES-002 §4.3 の JSON フォーマット例のトップレベルに対応する。
type APIErrorResponse struct {
    Error APIError `json:"error"`
}
```

#### 4.5.3 既存ハンドラの統一

3 ハンドラそれぞれで独自定義の構造体・型エイリアスを **完全削除** し、`model.APIErrorResponse` 共通型に置き換える。

##### tag ハンドラ

対象: `internal/api/tag/handler.go`(または相当)

- `tagErrorResponse` 構造体定義を削除
- 各エラーレスポンス送信箇所(`c.JSON(...)`)を以下のパターンに置き換え:

```go
// 修正前
return c.JSON(http.StatusBadRequest, tagErrorResponse{
    Code: "INVALID_TAG_ID",
    Message: "tag_id must be a positive integer",
})

// 修正後
return c.JSON(http.StatusBadRequest, model.APIErrorResponse{
    Error: model.APIError{
        Code:    "INVALID_TAG_ID",
        Message: "tag_id must be a positive integer",
    },
})
```

`details` フィールドを使う箇所(M3-01 で実装済みなら)は `Details: map[string]any{...}` で同等に表現。

##### character ハンドラ

対象: `internal/api/character/handler.go`(M3-04 §4.0 で新設)

- `charErrorResponse` 構造体定義を削除
- 各エラーレスポンス送信箇所を共通型に置き換え(tag ハンドラと同パターン)
- `details` フィールドは現状未使用、空のまま(`omitempty` で省略される)

##### combo ハンドラ

対象: `internal/api/combo/handler.go`(または相当)

- `map[string]string{"error": "...", "message": "..."}` のフラット形式を **完全に廃止** し、共通型に置き換え
- **後方非互換変更**: 現行のフラット形式から共通型のネスト形式への移行で JSON 構造が変わる(§4.5.4 参照)

```go
// 修正前
return c.JSON(http.StatusBadRequest, map[string]string{
    "error": "VALIDATION_ERROR",
    "message": "コンボ名は必須です",
})

// 修正後
return c.JSON(http.StatusBadRequest, model.APIErrorResponse{
    Error: model.APIError{
        Code:    "VALIDATION_ERROR",
        Message: "コンボ名は必須です",
    },
})
```

##### 全ハンドラ列挙(playbook §4.7)

§3.4.1 着手前確認で grep した結果から、修正対象を漏れなく列挙する。製造担当 Claude Code は実装完了報告に「修正したエラーレスポンス送信箇所の完全リスト」を含める(playbook §4.7 全ハンドラ列挙原則)。

#### 4.5.4 後方非互換変更箇所(combo ハンドラ)とフロント側の修正

combo ハンドラのフラット形式から共通型(ネスト形式)への移行は **JSON 構造が変わる** ため、フロント側で combo API のエラーレスポンスをパースしている箇所の修正が必要。

##### 修正対象の特定

§3.4.5 で実施した grep の結果を元に、フロント側で以下のいずれかのパターンを使っている箇所を抽出:

```typescript
// 旧フォーマット(フラット)を期待しているコード
const data = await response.json();
if (data.error) { /* error は文字列 */ }
// または
const errorMessage = data.message;

// 新フォーマット(ネスト)に対応するコード
const data = await response.json();
if (data.error?.code) { /* error.code は文字列 */ }
const errorMessage = data.error?.message;
```

##### 修正方針

- 全箇所を `data.error.code` / `data.error.message` のネスト参照に統一
- `details` フィールドを参照する箇所がある場合(現状はない見込み)は、`data.error.details?.<key>` の形式
- 修正対象ファイル数は §3.4.5 着手前確認の結果次第(想定 1〜3 ファイル程度)

#### 4.5.5 テスト修正

各ハンドラのエラー系テストで、レスポンス JSON の期待値を新形式に統一する。

例:

```go
// 修正前(combo ハンドラのテスト)
assert.Equal(t, "VALIDATION_ERROR", body["error"])
assert.Equal(t, "コンボ名は必須です", body["message"])

// 修正後
assert.Equal(t, "VALIDATION_ERROR", body["error"].(map[string]any)["code"])
assert.Equal(t, "コンボ名は必須です", body["error"].(map[string]any)["message"])
```

または、共通型でアンマーシャルする方法:

```go
var resp model.APIErrorResponse
err := json.NewDecoder(rec.Body).Decode(&resp)
assert.NoError(t, err)
assert.Equal(t, "VALIDATION_ERROR", resp.Error.Code)
assert.Equal(t, "コンボ名は必須です", resp.Error.Message)
```

後者の方が型安全で推奨。製造担当判断。

#### 4.5.6 api_error_test.go の新設

`internal/model/api_error_test.go` で共通型の JSON 直列化動作をテスト:

- `APIErrorResponse{Error: APIError{Code: "X", Message: "Y"}}` の JSON 出力が `{"error":{"code":"X","message":"Y"}}` であること
- `Details` が空の場合に `details` フィールドが省略されること(`omitempty` の動作確認)
- `Details: map[string]any{"id": 42}` の場合に `{"error":{"code":"...","message":"...","details":{"id":42}}}` であること

#### 4.5.7 設計判断事項

- 共通型の配置: `internal/model/api_error.go`(CHANGE-010 §5.4)
- ヘルパ関数: 製造担当判断、強制しない(CHANGE-010 §5.3)
- HTTP ステータスコード: 既存実装を踏襲(CHANGE-010 §3.4)
- エラーコード文字列: 既存値を維持(CHANGE-010 §3.4)
- combo ハンドラの後方非互換変更: フロント側の修正を本マイルストーンで完結(§4.5.4)

### 4.6 設計判断事項(本指示書で確定済み)

以下は本指示書で確定済みの設計判断。製造担当 Claude Code は推測で別案を選ばない。

| 項目 | 確定内容 | 根拠 |
|------|---------|------|
| **エラーレスポンス共通型** | `internal/model/api_error.go` に `APIError` / `APIErrorResponse` を定義、全ハンドラで使用 | CHANGE-010、§4.5 |
| `Details` の型 | `map[string]any`(任意のキー・値型を許容) | CHANGE-010 §5.1 |
| `omitempty` の付与 | `Details` フィールドに付与(空時に省略) | CHANGE-010 §5.2 |
| combo ハンドラの後方非互換変更 | フラット形式から共通型(ネスト形式)に変更、フロント側を本マイルストーンで修正 | §4.5.4 |
| エラーコード文字列の変更 | しない(既存値を維持) | CHANGE-010 §3.4 |
| ヘルパ関数の必須化 | しない(製造担当判断、強制しない) | CHANGE-010 §5.3 |
| **DTO フィールド `defaultRecipe`** | コンボ一覧 API レスポンス DTO に追加、サービス層で生成(案 Y 推奨) | §4.1、M3-overview v1.0.1 §3.5 案 A |
| **DTO フィールド `starterMoveCode`** | コンボ一覧 API レスポンス DTO に追加、リポジトリ層で moves テーブル LEFT JOIN | §4.2、M3-overview v1.0.1 §3.5 |
| JSON タグ命名 | camelCase 統一(`defaultRecipe` / `starterMoveCode`) | CLAUDE.md §4 |
| **空状態メッセージ改善** | フィルタ適用時の 0 件状態に「フィルタ条件にマッチするコンボがありません」+ フィルタ解除ボタン | §4.3 |
| **RecipeBuilder console.warn テスト** | 3 ケース追加(50文字以下・51文字以上・減少時の過剰発火なし) | §4.4 |
| shadcn/ui 使用 | 不使用、標準 HTML + Tailwind 自作 | playbook §4.6 |

---

## 5. テスト要件

### 5.1 必須テスト

#### 5.1.1 共通エラー型のテスト(§4.5.6)

`internal/model/api_error_test.go`:
- JSON 直列化の正常動作(`Code` + `Message` のみ)
- `Details` 空時の `omitempty` 省略動作
- `Details` 含む時の出力動作

#### 5.1.2 既存ハンドラのエラー系テスト修正(§4.5.5)

- tag ハンドラのエラー系テストすべて: 期待値を新形式に修正
- character ハンドラのエラー系テストすべて: 同上
- combo ハンドラのエラー系テストすべて: フラット → ネスト形式に修正、後方非互換変更の動作確認
- 全 HTTP ステータスコード(400 / 404 / 409 / 500 等)で新形式が返ることを確認

#### 5.1.3 コンボ一覧 API の DTO 拡張テスト(§4.1 / §4.2)

- `default_recipe` フィールドが期待形式(`" > "` 区切り)で返ることのテスト
- `starter_move_code` フィールドが期待値で返ることのテスト
- `starter_move_id` が NULL のコンボで `starter_move_code` が空文字で返ることのテスト

#### 5.1.4 空状態メッセージ改善のテスト(§4.3)

- フィルタ未適用 + コンボ 0 件 → 「コンボがまだ登録されていません」のテスト
- フィルタ適用中 + 結果 0 件 → 「フィルタ条件にマッチするコンボがありません」+ フィルタ解除ボタン表示のテスト
- フィルタ解除ボタンクリック → フィルタがリセットされる動作テスト

#### 5.1.5 RecipeBuilder console.warn テスト(§4.4)

3 ケースの追加(§4.4.2)。

#### 5.1.6 既存テストの回帰確認

- M3-01〜M3-04 で実装した既存テストすべてが通過する
- combo ハンドラのエラーレスポンス形式変更で **既存の動作テスト**(エラー系以外)に影響がないこと

#### 5.1.7 ビルド・型チェック

- `make test` または `go test ./...` 全通過
- `cd web && pnpm test` 全通過
- `cd web && pnpm build` 成功
- TypeScript 型エラーなし

### 5.2 E2E シナリオ(M3 統合 E2E)

開発者が実機ブラウザで以下を順に実行し、すべて通ることを確認する。

```
## M3 統合 E2E シナリオ(M3-01〜M3-05 のすべての機能を統合確認)

### A. M3-01: タグ管理
1. /tags/manage を開く
2. 初期 3 タグ(使用中・練習中・頻度低下)が seed で表示される
3. 新規タグ「実戦投入中」を作成、保存
4. usage_count が 0 として表示される

### B. M3-02: コンボへのタグ付与
5. /combos/new で新規コンボ A を作成、TagSelector で「実戦投入中」タグを付与、保存
   → コンボ編集画面の TagSelector に mycombo_status カテゴリは出てこない(M3-02 責務分離維持)
6. /combos でコンボ A の行を見る → TagBadgeList に「実戦投入中」が表示される
   → TagBadgeList に mycombo_status タグは表示されない(M3-02 責務分離維持)

### C. M3-03: フィルタ・ソート・表示列カスタマイズ
7. /combos でフィルタ UI を開き、タグフィルタで「実戦投入中」を選択
8. コンボ A のみが表示される
9. ソート: ダメージ降順 → 並び順変更
10. 表示列カスタマイズ: 「ルート」列を非表示にする
11. リロード → 設定が localStorage で永続化されている

### D. M3-04: マイコンボ画面 + 3 経路のステータス変更
12. 主要ナビゲーションの「マイコンボ」リンクをクリック → /mycombo に遷移
13. キャラクター情報バー + 件数ダッシュボード + マイコンボステータス切替タブが表示される
14. /combos/new で新規コンボ B を作成、編集画面のマイコンボステータス選択(MyComboStatusSelect)で「練習中」を選択、保存
    → 経路 1(コンボ編集画面)からの初回登録
15. /mycombo の「練習中」タブに コンボ B が現れる
16. /combos でコンボ B の行のマイコンボステータスプルダウンを見る → 「練習中」が選択中
17. プルダウンで「使用中」に変更 → 経路 2(コンボ一覧画面)からのステータス変更
18. /mycombo の「使用中」タブにコンボ B が移動、件数ダッシュボードも連動更新
19. マイコンボ画面のプルダウンで「マイコンボから外す」を選択 → 経路 3(マイコンボ画面)からの解除
20. 全タブから消える、件数ダッシュボードがすべて 0 に

### E. M3-05: レシピ表示改善
21. /combos でコンボ A・B の行を見る → レシピ列に default_recipe(技名で `波動拳 > 中P > 弱K` のような形式)が表示される
    → 「(暫定: ID のみ表示)」のような暫定表示が消えている
22. 始動技列に starter_move_code(技コード)が表示される
    → starter_move_id(数値)がそのまま表示されない

### F. M3-05: 空状態メッセージ改善
23. /combos でタグフィルタを「存在しない組み合わせ」に変更 → 0 件表示
24. 「フィルタ条件にマッチするコンボがありません」+ フィルタ解除ボタンが表示される
25. フィルタ解除ボタンをクリック → 全コンボが再表示される

### G. M3-05: エラーレスポンス共通化(動作確認)
26. /combos/new で空の名前で保存しようとする → エラー表示
    → エラーメッセージが正しく表示される(combo ハンドラの後方非互換変更が UI 側で破綻していないことの確認)
27. /tags/manage でタグの不正な操作(重複名等) → エラー表示
    → エラーメッセージが正しく表示される(tag ハンドラの動作確認)
28. ブラウザの DevTools Network タブで上記エラーレスポンスを確認 → JSON 構造が `{"error":{"code":"...","message":"..."}}` のネスト形式で統一されている

### H. M3-05: RecipeBuilder console.warn(動作確認)
29. /combos/new でレシピ追加時、ModifiersEditor を開き、notes に 51 文字以上を入力
30. ブラウザの DevTools Console に `console.warn` が表示される(50文字超警告)

### I. 横断確認
31. M3-01〜M3-04 の全機能が回帰なく動作している
32. localStorage の `combo-list-columns-v1` が両画面(/combos と /mycombo)で共有されている(M3-04 §4.4)
33. M3-02 責務分離: mycombo_status カテゴリはコンボ編集画面 TagSelector・コンボ一覧 TagBadgeList のいずれにも出ない、専用 UI(MyComboStatusSelect)のみ
```

これが全て通過するまで M3 完了 DoD 不達成。

---

## 6. レビュー観点(別ファイル参照)

レビュー観点は以下のチェックリストに記載する: `docs/instructions/reviews/M3-05-review-checklist.md`

製造担当 Claude Code は本ファイルを読む必要はない。本指示書本体に集中する。

---

## 7. 完了条件(Definition of Done)

### 7.1 機能要件

- [ ] §2.1 のファイル一覧が全て作成されている
- [ ] §2.2 のファイル修正が実施されている
- [ ] **エラーレスポンス共通型 `model.APIError` / `model.APIErrorResponse` が動作する**(`internal/model/api_error.go` 新設、3 ハンドラすべてで使用)
- [ ] **既存ハンドラの独自定義(`tagErrorResponse` / `charErrorResponse` / `map[string]string`)が完全削除されている**(`grep -rn 'tagErrorResponse\|charErrorResponse' internal/api/` でゼロ件)
- [ ] **コンボ一覧 API の `defaultRecipe` フィールドが動作する**(技名で結合された文字列が返る)
- [ ] **コンボ一覧 API の `starterMoveCode` フィールドが動作する**(技コードが返る、NULL 時は空文字)
- [ ] **コンボ一覧画面・マイコンボ画面の空状態メッセージ改善が動作する**(フィルタ適用時の専用メッセージ + 解除ボタン)
- [ ] **RecipeBuilder console.warn テストが追加され通過する**(3 ケース)
- [ ] §5.2 M3 統合 E2E シナリオ A〜I がすべて通過する

### 7.2 自己テスト結果(製造担当の責任範囲)

**バックエンド側**:

- [ ] `make test` または `go test ./...` が全通過する(共通型・3 ハンドラの修正テスト・既存テストすべて)
- [ ] 主要 API を `curl` で叩き、レスポンスを報告書に貼付する:
  - `curl http://localhost:47318/api/combos` → 200 + `default_recipe` / `starter_move_code` が含まれる
  - `curl -X POST http://localhost:47318/api/combos -d '{}'` → 400 + `{"error":{"code":"...","message":"..."}}` 形式
  - `curl http://localhost:47318/api/games/abc/characters` → 400 + 同形式
  - `curl http://localhost:47318/api/tags/abc` → 400 + 同形式
- [ ] §3.4.1〜§3.4.5 着手前確認の出力を含める

**フロントエンド側**:

- [ ] `cd web && pnpm test` が全通過する
- [ ] `cd web && pnpm build` が成功する
- [ ] TypeScript の型エラーが残っていない
- [ ] 開発者向けの「動作確認手順書」を実装完了報告に含める

ブラウザでの実機動作確認・スクリーンショット取得は **開発者の責任範囲**。

### 7.3 品質チェック

- [ ] CLAUDE.md の禁止事項に抵触していない
- [ ] **JSON タグ・API DTO 型が camelCase で統一されている**(`defaultRecipe` / `starterMoveCode`)
- [ ] **エラーレスポンスの JSON 構造が `{"error":{"code":"...","message":"..."}}` 形式で全ハンドラ統一**
- [ ] **combo ハンドラの後方非互換変更でフロント側が破綻していない**(エラーパース箇所すべて新形式対応)
- [ ] **`grep -rn 'tagErrorResponse\|charErrorResponse' internal/api/` でゼロ件**(独自定義の完全削除確認)
- [ ] `console.log` / `fmt.Println` を本番コードに残していない
- [ ] 設計書本体(DES-002 §4.3 + CHANGE-010、DES-005 §5.4)と実装が一致している
- [ ] **playbook §4.5 / §4.6 / §4.7 / §4.8 の4ルールに抵触していない**
- [ ] **shadcn/ui を使用していない**(標準 HTML + Tailwind 自作、playbook §4.6)
- [ ] CHANGE-010 §3 の実装計画に沿った実装になっている

### 7.4 ドキュメント

- [ ] `docs/progress/progress-log.md` に M3-05 完了報告を追記する
- [ ] **CHANGE-010 取り込み完了の事実** を明記
- [ ] M1-05 暫定処理1・3 の解消事実を明記
- [ ] M2-04 持ち越し課題(`RecipeBuilder` console.warn テスト)の解消事実を明記
- [ ] M3-03 持ち越し課題(空状態メッセージ改善)の解消事実を明記
- [ ] §3.4 着手前確認結果を含める

### 7.5 完了報告

- [ ] 開発者に「M3-05 が完了しました、M3 期間全体が完了です」と報告
- [ ] §7.1〜§7.4 の自己テスト結果を報告書に含める
- [ ] M3 全体のサマリ(M3-01〜M3-05 の達成事項)を含める

---

## 8. 参照ドキュメント

| ID | パス | 関連節 |
|----|------|-------|
| CLAUDE.md | `CLAUDE.md` | **§4 JSON タグ camelCase / 列挙定数同期**、§10 禁止事項 |
| M3-overview v1.0.2 | `docs/instructions/M3-overview.md` | **§3.5 M3-05 詳細** |
| **CHANGE-010** v1.0.0 | `docs/change-notifications/CHANGE-010-api-error-common-type.md` | **本指示書の §4.5 の根拠** |
| M3-01〜M3-04 指示書 | `docs/instructions/M3-{01-04}-*.md` | 統合 E2E のため全機能の前提を把握 |
| M2-04 指示書 | `docs/instructions/M2-04-*.md` | RecipeBuilder console.warn の実装経緯 |
| DES-002 v1.5.0 | `docs/design/02-architecture.md` | **§4.3 エラーハンドリング**(CHANGE-010 で v1.6.0 に更新予定) |
| DES-005 | `docs/design/05-screen-design.md` | §5.4 コンボ一覧(レシピ列・始動技列の表示要件) |
| SUPP-001 v1.10.0 | `docs/design/supp-001-detailed-design.md` | §5.4 / §5.5 テスト規約 |
| playbook v1.5.0 | `docs/handover/design-instruction-playbook.md` | **§4.5 / §4.6 / §4.7 / §4.8 全ルール** |
| progress-log.md | `docs/progress/progress-log.md` | M3-04 完了報告(エラー共通化の出処) |

---

## 9. 注意事項・判断に迷ったら

### 9.1 推測で進めてはいけない事項

以下は推測で進めず、Plan Mode で開発者に確認する:

- §3.4.1 で grep した結果、独自エラー型・形式が想定外の場所(M0 / M1 由来の古いハンドラ等)に存在する場合
- §3.4.2 で既存コンボ一覧 API DTO の構造が想定と異なる場合
- §3.4.5 でフロント側の combo API エラーパース箇所が複数ファイル(5 以上)に散在している場合
- レシピ生成ロジック(§4.1.2)の区切り文字・始動状況分岐の解釈にずれがある場合
- combo ハンドラの後方非互換変更でフロント側の修正対象が想定より広い場合(Plan Mode で範囲を協議)
- M3 統合 E2E シナリオ実行時に M3-01〜M3-04 のいずれかで回帰が発見された場合

### 9.2 推測で進めてよい事項(その旨を明示)

以下は推測で進めてよいが、実装時に「推測:〜と仮定した」とコード内コメントまたは PR 説明に明示する:

- 空状態メッセージの具体文言(「フィルタ条件にマッチするコンボがありません」等、製造担当判断で文言調整可)
- フィルタ解除ボタンの配置・スタイリング
- レシピ生成時の区切り文字(`" > "` 推奨だが、フロント実装次第で調整可)
- `starter_move_code` が空文字の場合の placeholder 表示(「-」「(未設定)」等)
- レシピ生成の実装方針(案 X / Y / Z のうち案 Y 推奨だが製造担当判断)

### 9.3 不明事項発見時の対応

- 設計書本体(DES-002 §4.3、DES-005 §5.4)+ CHANGE-010 と本指示書の記述が乖離している場合 → 実装を止めて開発者に報告し、対応方針を協議する
- 本指示書の §4 詳細仕様で具体化されていない実装判断が必要になった場合 → §9.2 の範囲なら推測で進めて明示、それ以外は Plan Mode で開発者確認

### 9.4 Plan Mode で計画提示時に含めるべき項目

Plan Mode を使う場合(本マイルストーンは推奨)、以下を計画に含める:

- §3.4 着手前確認の結果(全 5 項目: §3.4.1〜§3.4.5)
- 実装全体の順序(共通型新設 → 3 ハンドラ統一 → テスト修正 → DTO 拡張 → 空状態改善 → console.warn テスト → M3 統合 E2E)
- combo ハンドラの後方非互換変更でフロント側修正対象のリスト
- レシピ生成ロジックの実装方針(案 X / Y / Z の選択)
- 想定リスク(M3-01〜M3-04 の回帰、フロント側 combo API エラーパース箇所の網羅)

---

## 10. 完了後の次ステップ

M3-05 完了後、開発者の動作確認・承認を経て **M3 期間全体が完了** する。設計担当は m3-to-m4-handover.md を作成し、以下を集中記録する:

- M3 期間中の設計担当ミス累計記録(M3-01 mycombo_status 散在 + M3-02 多発 + M3-04 1 ケース 5 回スコープ拡張等)
- playbook §4.5〜§4.8 で確立した運用ルールの体系化
- M4(セットプレイ系)着手前の留意点
- M3 期間で確立した分離アーキテクチャパターン(プレゼンテーション層/ロジック層分離、`MyComboStatusSelect` + `useUpdateMyComboStatus` の経路)を M4 で踏襲する原則

M4 セットプレイ系では、本マイルストーンで導入した共通エラー型を最初から使用し、独自定義を増やさない方針が継続される。

---

*以上*

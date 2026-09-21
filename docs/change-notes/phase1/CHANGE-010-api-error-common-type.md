# CHANGE-010: DES-002 §4.3 エラーレスポンス共通 Go 型の明示

| 項目 | 内容 |
|------|------|
| 通知書ID | CHANGE-010 |
| バージョン | 1.0.0 |
| 起票日 | 2026-05-10 |
| 起票者 | 詳細設計・製造準備担当 Claude(M3 期間担当) |
| 種別 | 設計書本体の追記(後方互換) |
| 対象設計書 | DES-002 アーキテクチャ設計書 §4.3 エラーハンドリング |
| 影響範囲 | バックエンド全ハンドラ(エラーレスポンス共通型の導入) |
| 関連マイルストーン | M3-05(本通知書の取り込み・実装担当) |
| ステータス | ドラフト |

---

## 1. 背景

M3-04 完了報告で製造担当から、エラーレスポンス形式がプロジェクト全体で不統一である事実が指摘された。

### 1.1 現状の不統一

| ハンドラ | レスポンス形式 |
|---------|--------------|
| tag ハンドラ | `tagErrorResponse` 構造体(`details` フィールドあり) |
| character ハンドラ | `charErrorResponse` 構造体(`details` フィールドなし) |
| combo ハンドラ | `map[string]string{"error": "...", "message": "..."}` のフラット形式 |

3 種の形式が混在しており、フロント側のエラーハンドリングも整合が取れていない状態。

### 1.2 設計書本体側の現状

DES-002 §4.3 では JSON フォーマット例のみが規定されている:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "コンボに同一レシピが既に登録されています",
    "details": { "existing_combo_id": 42 }
  }
}
```

しかし、**この形式に対応する Go の共通型は明示されておらず**、各ハンドラが独自に定義する状態を許してしまっていた。設計書本体に Go 型レベルの規定がないことが、不統一発生の構造的原因である。

### 1.3 緊急性

M4(セットプレイ系・プリセット系)以降で新規ハンドラが増えるため、本通知書で共通型を明示し、M3-05 で既存ハンドラ3種を共通型に統一する。M4 着手前の解消が望ましい。

---

## 2. 変更内容

### 2.1 DES-002 §4.3 エラーハンドリングへの追記

現行の §4.3 末尾に **「2.1.1 共通 Go 型」** という小見出しを追加し、以下を明示する。

#### 追記内容(案)

> #### 共通 Go 型
>
> §4.3 で定義した JSON フォーマットに対応する Go 共通型を `internal/model/api_error.go` に定義する。全 HTTP ハンドラはこの共通型を使用し、ハンドラ独自のエラーレスポンス型を定義しない。
>
> ```go
> package model
>
> // APIError は API エラーレスポンスのエラー詳細部分の共通型。
> // §4.3 の JSON フォーマット例の "error" フィールドに対応する。
> type APIError struct {
>     Code    string         `json:"code"`
>     Message string         `json:"message"`
>     Details map[string]any `json:"details,omitempty"`
> }
>
> // APIErrorResponse は APIError をラップした共通レスポンス型。
> // §4.3 の JSON フォーマット例のトップレベルに対応する。
> type APIErrorResponse struct {
>     Error APIError `json:"error"`
> }
> ```
>
> `Details` は `map[string]any` で任意のキー・値を許容し、ハンドラごとの追加情報(`existing_combo_id` 等)を柔軟に表現できる。`Details` が空の場合は JSON 出力時に省略される(`omitempty`)。
>
> 全ハンドラはエラーレスポンス送信時に以下のパターンを使う:
>
> ```go
> return c.JSON(http.StatusBadRequest, model.APIErrorResponse{
>     Error: model.APIError{
>         Code:    "INVALID_GAME_ID",
>         Message: "game_id must be a positive integer",
>     },
> })
> ```
>
> `details` を含める場合:
>
> ```go
> return c.JSON(http.StatusConflict, model.APIErrorResponse{
>     Error: model.APIError{
>         Code:    "DUPLICATE_COMBO",
>         Message: "同一レシピのコンボが既に存在します",
>         Details: map[string]any{"existing_combo_id": 42},
>     },
> })
> ```

### 2.2 DES-002 バージョン bump

DES-002 v1.5.0 → v1.6.0(後方互換の追記、Minor bump)

### 2.3 関連設計書への影響

| 設計書 | 影響 | 対応 |
|--------|------|------|
| DES-001 技術スタック選定書 | なし | 不要 |
| DES-003 データモデル設計書 | なし | 不要 |
| DES-004 内部表現仕様書 | なし | 不要 |
| DES-005 画面・UI 設計書 | なし | 不要 |
| DES-006 状況コード値仕様書 | なし | 不要 |
| SUPP-001 詳細設計補足書 | **影響あり**:§6.x にエラー応答パターンの記載が存在する場合は追記同期 | M3-05 着手時に確認、該当箇所が存在すれば SUPP-001 のバージョンを bump |

SUPP-001 への波及は M3-05 起票時に再確認する。

---

## 3. 実装計画

### 3.1 実装担当

M3-05 サブマイルストーンで実装。本通知書を起点とする。

### 3.2 実装範囲

1. **新規ファイル作成**: `internal/model/api_error.go`
   - `APIError` 型定義
   - `APIErrorResponse` 型定義
   - godoc コメント
   - 共通型を使うヘルパ関数(任意、製造担当判断)
2. **既存ハンドラの統一**:
   - `internal/api/tag/handler.go`: `tagErrorResponse` 構造体を削除、`model.APIErrorResponse` に置き換え
   - `internal/api/character/handler.go`: `charErrorResponse` 構造体を削除、`model.APIErrorResponse` に置き換え
   - `internal/api/combo/handler.go`(または相当): `map[string]string` 形式を `model.APIErrorResponse` に置き換え
3. **テスト修正**:
   - 各ハンドラのエラー系テストで、レスポンス JSON の期待値を `model.APIErrorResponse` 形式に統一
   - JSON フォーマット例(`{"error": {"code": "...", "message": "..."}}`)が一貫していることを確認
4. **フロント側への影響確認**:
   - フロントのエラー受信ロジックで `error.code` / `error.message` を参照している箇所の動作確認
   - `details` フィールドの取扱が変わる場合(現行は欠落 or 文字列、新形式は構造化オブジェクト)、フロント側の修正要否を確認

### 3.3 想定所要時間

エラー共通化のみで 60〜90 分。M3-05 全体では 180〜270 分。

### 3.4 実装の指針(M3-05 指示書 §4.x で詳述予定)

- 既存ハンドラ独自定義の構造体・型エイリアス(`tagErrorResponse` / `charErrorResponse` 等)は **完全削除**(後方互換のための残置は不要、JSON 出力形式が同等なため)
- HTTP ステータスコードの選択は既存実装を踏襲(変更しない、後方互換)
- エラーコード文字列(`INVALID_GAME_ID` / `VALIDATION_ERROR` 等)は既存値を維持(変更しない、後方互換)

---

## 4. 後方互換性

### 4.1 API レスポンス JSON の後方互換

| 項目 | 現状 | 新形式 | 互換性 |
|------|------|--------|--------|
| tag ハンドラ | `{"error": {"code": "...", "message": "...", "details": {...}}}` | 同左 | **完全互換**(構造体名のみ変更、JSON 出力は同等) |
| character ハンドラ | `{"error": {"code": "...", "message": "..."}}` | `{"error": {"code": "...", "message": "..."}}`(`details` は省略) | **完全互換** |
| combo ハンドラ | `{"error": "...", "message": "..."}`(**フラット**) | `{"error": {"code": "...", "message": "..."}}`(**ネスト**) | **破壊的変更あり** |

### 4.2 破壊的変更箇所(combo ハンドラ)

`combo ハンドラ` のフラット形式から共通型(ネスト形式)への移行は **後方非互換** となる。フロント側で combo API のエラーレスポンスをパースしている箇所の修正が必要。M3-05 実装時に以下を確認:

- `error.code` を参照しているか(現状はトップレベルの `error` 文字列を参照している可能性)
- `error.message` を参照しているか(現状は `message` を参照している可能性)
- パース箇所の修正範囲を実装時に grep で網羅

修正範囲は M3-05 指示書執筆時に確定する。

### 4.3 既存テストへの影響

各ハンドラのエラー系テストで、レスポンス JSON の期待値を新形式に修正する必要がある。テストファイル数は 3 ハンドラ分(最大 10〜15 ケース程度の修正)と見込まれる。

---

## 5. 設計判断の根拠

### 5.1 `Details` を `map[string]any` にした理由

- DES-002 §4.3 の JSON 例で `{"existing_combo_id": 42}` のような **任意のキー・任意の値型** が示されている
- ハンドラごとに異なる追加情報を返したい場合に柔軟に対応できる
- Go 1.18+ の `any`(`interface{}`)で任意型を許容、JSON エンコード時に正しく直列化される

### 5.2 `omitempty` を付けた理由

- `Details` が空の場合に JSON 出力に含めないことで、レスポンスサイズを最小化
- character ハンドラの現行形式(`details` なし)と整合

### 5.3 ヘルパ関数を必須としなかった理由

- 製造担当の実装判断を尊重(ヘルパ化したい場合はしてよい、しなくてもよい)
- ヘルパ化することでテストカバレッジが複雑化する場合があるため、強制しない
- 既存パターン(`echo.Context.JSON()` への直接渡し)で十分動作する

### 5.4 共通型を `internal/model/` に置いた理由

- `internal/api/` 配下に置くと、各ハンドラパッケージ間の循環参照リスクがある
- `internal/model/` は全パッケージから参照可能な共通領域
- `Character` / `Tag` / `Combo` 等のドメインモデルと同じ階層で、共通型として概念整合

---

## 6. 関連文書

| ID | パス | 関連 |
|----|------|------|
| DES-002 v1.5.0 | `docs/design/02-architecture.md` | **改訂対象**(§4.3 への追記) |
| M3-05 指示書(後続起票) | `docs/instructions/M3-05-*.md` | 本通知書の実装担当 |
| progress-log.md M3-04 完了報告 | `docs/progress/progress-log.md` | 製造担当からの指摘の出処 |
| CHANGE-007 までの過去通知書 | `docs/change-notifications/` | 通知書フォーマット参考 |

---

## 7. 開発者承認

| 項目 | 内容 |
|------|------|
| 承認日 | 2026-05-10 |
| 承認方法 | 設計担当・開発者協議(2026-05-10 セッション) |
| 承認条件 | M3-05 サブマイルストーンの正式スコープとして取り込み、本通知書を起点として実装 |
| 承認結果 | **承認**(M3-04 完了報告の製造担当指摘 2 件目への対処として確定) |

---

## 8. 改訂履歴

| バージョン | 改訂日 | 改訂内容 |
|-----------|--------|----------|
| 1.0.0 | 2026-05-10 | 初版作成。M3-04 完了報告で製造担当から指摘されたエラーレスポンス形式不統一への対策。DES-002 §4.3 に Go 共通型 `model.APIError` / `model.APIErrorResponse` を追記する変更を起票。**当初 CHANGE-008 として起票したが、諸事情により同日内に CHANGE-010 に再採番。CHANGE-008 は欠番、CHANGE-009 は従来通り廃案扱い。本変更による設計内容への影響なし(番号のみの変更)** |

---

*以上*

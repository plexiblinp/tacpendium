# M4-01 レビューチェックリスト

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/M4-01-setup-backend-foundation.md` v1.0.0 |
| バージョン | 1.0.2 |
| 推奨レビューモデル | Sonnet 4.6 |
| 作成者 | 詳細設計・製造準備担当 Claude(M4 期間担当) |
| 作成日 | 2026-05-16 |

## 更新履歴

| バージョン | 更新日 | 更新内容 |
|-----------|--------|----------|
| 1.0.0 | 2026-05-16 | 初版作成 |
| 1.0.1 | 2026-05-16 | M4-01 指示書 v1.0.1 改訂(§4.6 を `Setups json.RawMessage` に変更)に追随して §7「コンボ作成 API の DTO 前方互換予約」の確認項目を更新。型を `json.RawMessage` で検査、`slog.Warn` 出力ロジックの検査項目を追加、§10.6 シナリオ F の確認項目を 3 パターン受信に拡張 |
| 1.0.2 | 2026-05-16 | M4-01 指示書 v1.0.2 改訂(SetupResponse DTO 統一・JSON タグ整合)に追随。§2.1 Setup の `DeletedAt` チェック項目を `json:"-"` で検査、§2.2 SetupStep の `SetupID` チェック項目を `json:"-"` で検査、§3.3 レスポンス DTO 構造を `SetupResponse` 共通化 + `ParentComboIDs []int64` 配列統一で検査。M4-01 完了承認済みのため本改訂は事後整合修正(M4-02 着手前の前提整理)|

---

## 0. レビュー担当への前置き

### 0.1 レビュー前の準備

レビュー担当 Claude Code は以下を読んでからレビューに着手する:

- M4-01 指示書本体(`docs/instructions/M4-01-setup-backend-foundation.md`)
- 本チェックリスト(全節)
- CLAUDE.md(§4 コーディング規約、§5 テスト規約、§10 禁止事項)
- **SUPP-001 v1.13.0 §7.1 / §7.2 / §7.5**(setup recipe_cache 責務、最重要)
- DES-002 v1.7.0 §4.3(エラーレスポンス共通 Go 型)
- DES-003 §3.11〜§3.13(setup 系テーブル)
- **DES-006 v1.9.0 §3**(VAL-S01〜S05、CHANGE-012 反映)
- CHANGE-012 通知書(VAL-S05 追加経緯、§6.2 R-2 対策の根拠)
- architecture-patterns.md v1.0.0(§2 3 層パターン、§3 共通エラー型)
- 製造担当の実装完了報告(`docs/progress/progress-log.md` 末尾、curl 実行結果含む)
- 関連既存ファイル(新規作成された setup 3 層、修正された combo dto.go、preset_resolver.go)

### 0.2 レビューの基本姿勢

本指示書は **M4 期間の本格的バックエンド基盤構築**。setup ドメインを 3 層で新設し、CHANGE-012 / VAL-S05 を初めてサービス層で実装し、notation サービス層を setup 側に拡張し、コンボ作成 API の DTO に前方互換予約を入れる、という複合作業。以下を意識する:

- **設計書節への一致**: DES-002 v1.7.0 §4.3、DES-003 §3.11〜§3.13、DES-006 v1.9.0 §3、SUPP-001 §7.1 / §7.2 / §7.5 の各節と実装が一致しているか機械的に確認
- **VAL-S05 のサービス層適用**(CHANGE-012、本指示書の最重要設計判断):リクエスト DTO 直下に `parent_combo_id` を入れず、サービス層関数の引数で受ける構造になっているか確認
- **エンドポイント分離方針**: 新規作成 / 紐付け追加 / 紐付け解除が別エンドポイントで分離されているか
- **エラーコード小文字スネーク統一**: setup 系で先行統一(handover §4.3 L-02)、tag / character / combo / preset / move ハンドラの大小混在(L-02)を引きずっていないか
- **`model.APIErrorResponse` 直接呼び出し**: 独自エラー型・独自ヘルパを作っていないか(architecture-patterns.md §3、L-03)
- **M3 完了状態の回帰なし**: コンボ作成 API の `Setups` フィールド形予約が M3 までの呼び出しに影響していないか(§5.2 シナリオ F)
- **3 層分離の正しさ**: handler / service / repository の責務が混ざっていないか(architecture-patterns.md §2)

### 0.3 レビュー結果の報告フォーマット

レビュー結果は以下のフォーマットで開発者に報告する:

```
## M4-01 レビュー結果

### 重大な問題(検出された場合、§13 判定基準)
- (なし / 列挙)

### 軽微な問題(検出された場合、§14 判定基準)
- (なし / 列挙)

### 機械的チェック通過状況
- §1〜§11 各節の通過項目数 / 全項目数

### 設計意図整合確認
- §6(VAL-S05 サービス層適用)で問題なし / 問題あり
- §7(recipe_cache 案 R2 + notation 連動)で問題なし / 問題あり
- §8(エラーコード統一・共通型直接呼び出し)で問題なし / 問題あり

### 完了判定
- §15 通り「重大な問題なし → 完了承認待ち」/「重大な問題あり → 修正要求」
```

---

## 1. 指示書本体との照合(retro R-01 対応、最重要観点)

### 1.1 §2.1 / §2.2 ファイル一覧との一致

#### 新規作成ファイル

- [ ] `internal/api/setup/handler.go` が存在する
- [ ] `internal/api/setup/handler_test.go` が存在する
- [ ] `internal/api/setup/dto.go` が存在する
- [ ] `internal/service/setup/service.go` が存在する
- [ ] `internal/service/setup/service_test.go` が存在する
- [ ] `internal/service/setup/validate.go` が存在する
- [ ] `internal/service/setup/validate_test.go` が存在する
- [ ] `internal/repository/setup/repository.go` が存在する
- [ ] `internal/repository/setup/repository_test.go` が存在する(複雑クエリ部分のみ、CLAUDE.md §5)
- [ ] `internal/service/notation/setup_resolver.go` が存在する
- [ ] `internal/service/notation/setup_resolver_test.go` が存在する
- [ ] `internal/model/setup.go` が存在する

#### 修正ファイル

- [ ] `internal/api/combo/dto.go` の `CreateComboRequest` に `Setups []CreateSetupInput \`json:"setups,omitempty"\`` フィールドが追加されている(§4.6)
- [ ] `internal/api/router.go`(または相当) に setup ハンドラのルート登録が追加されている
- [ ] `internal/service/notation/preset_resolver.go`(または相当) で `RecomputePresetCache` / `DeletePresetCache` がセットプレイ側も対象に拡張されている

#### スコープ外への変更がないこと(§2.3 / §2.4)

- [ ] DB マイグレーションが新規追加されていない(本指示書はスコープ外)
- [ ] コンボ系 API の本体ロジックに変更が入っていない(M3 完了状態維持)
- [ ] M4-00 / M4-00b で実装した RecipeBuilder / ModifiersEditor のフロント側ファイルに変更が入っていない
- [ ] フロントエンドの新規ファイル・変更が **含まれていない**(本指示書はバックエンドのみ)
- [ ] 既存 notation サービス層関数のシグネチャが不変(`ResolveComboRecipe` 等の既存関数のシグネチャ変更なし、`RecomputePresetCache` は処理内容の拡張のみでシグネチャ不変)
- [ ] `internal/model/combo.go` 等の既存モデル定義が不変(`CreateComboRequest` の Setups 追加は dto.go 側のみ)

### 1.2 §3.4 着手前確認の報告

- [ ] §3.4.1 setup 系テーブル DDL の確認結果が報告に含まれている
- [ ] §3.4.2 既存 notation サービス層の確認結果が報告に含まれている
- [ ] §3.4.3 既存 combo ハンドラ DTO 構造の確認結果が報告に含まれている
- [ ] §3.4.4 共通エラー型(`APIError` / `APIErrorResponse`)の確認結果が報告に含まれている
- [ ] §3.4.5 既存リポジトリ層のトランザクション扱いの確認結果が報告に含まれている
- [ ] §3.4.6 SUPP-001 §7.1 / §7.2 / §7.5 の読了確認が明示されている

---

## 2. setup モデル定義(§4.1)

### 2.1 Setup 構造体(§4.1.1、v1.0.2 で JSON タグ修正)

- [ ] `ID` / `CharacterID` / `Name *string` / `Description *string` / `StepCount` / `RecipeCache *string` / `Version` / `CreatedAt` / `UpdatedAt` / `DeletedAt *time.Time` の全フィールドが定義されている
- [ ] JSON タグが camelCase(`characterId`、`stepCount`、`createdAt`、`updatedAt`)
- [ ] **`RecipeCache` に `json:"-"` が設定されている**(API 開示禁止、M3-05 確立方針)
- [ ] **`DeletedAt` に `json:"-"` が設定されている**(v1.0.2 で確定、combo 側既存パターン踏襲、論理削除済み setup は GET で 404 を返すため API レスポンスに露出させる意味がない)
- [ ] `Name` / `Description` / `DeletedAt` が `*` ポインタ型または `omitempty` で NULL 許容を表現

### 2.2 SetupStep 構造体(§4.1.2、v1.0.2 で JSON タグ修正)

- [ ] `ID` / `SetupID` / `StepOrder` / `MoveID *int64` / `Modifiers` の全フィールドが定義されている
- [ ] JSON タグが camelCase(`stepOrder`、`moveId`)
- [ ] **`SetupID` に `json:"-"` が設定されている**(v1.0.2 で確定、combo 側既存パターン踏襲、`SetupResponse` の階層構造で親子関係が明白なためステップレベルで露出させない)
- [ ] `MoveID` が `*int64` で NULL 許容を表現(SUPP-001 §3.3.3 非技ステップ対応)
- [ ] `Modifiers` 型が **既存 `internal/model/modifiers.go` の型を再利用**(setup 専用の Modifiers を作っていない、SUPP-001 §3.3.0)

### 2.3 ComboSetup 構造体(§4.1.3)

- [ ] `ComboID` / `SetupID` の 2 フィールドが定義されている
- [ ] JSON タグが camelCase(`comboId`、`setupId`)

### 2.4 DES-003 §3.11〜§3.13 との整合

- [ ] Setup 構造体のフィールドが DES-003 §3.11 setups テーブルカラムと 1 対 1 対応
- [ ] SetupStep 構造体のフィールドが DES-003 §3.12 setup_steps テーブルカラムと 1 対 1 対応
- [ ] ComboSetup 構造体のフィールドが DES-003 §3.13 combo_setups テーブルカラムと 1 対 1 対応

---

## 3. API エンドポイント設計(§4.2)

### 3.1 エンドポイント一覧の網羅性

- [ ] `POST /api/combos/{comboId}/setups`(新規作成)が実装されている
- [ ] `POST /api/combos/{comboId}/setup-links`(紐付け追加)が実装されている
- [ ] `DELETE /api/combos/{comboId}/setup-links/{setupId}`(紐付け解除)が実装されている
- [ ] `GET /api/setups/{id}`(詳細取得)が実装されている
- [ ] `PATCH /api/setups/{id}`(編集)が実装されている
- [ ] `DELETE /api/setups/{id}`(論理削除)が実装されている
- [ ] `GET /api/combos/{comboId}/setup-candidates`(候補取得、スタブ)が実装されている

### 3.2 エンドポイント分離方針の遵守(§4.2.2)

- [ ] **新規作成と紐付け追加が別エンドポイント** に分離されている(`CreateSetup` と `CreateSetupLink` のサービス層関数も分離)
- [ ] 紐付け解除が **setup 本体を削除しない**(combo_setups からの 1 件 DELETE のみ、§4.2.3)
- [ ] `DELETE /api/setups/{id}` のみが setup 本体の論理削除を行う

### 3.3 レスポンス DTO 構造(§4.2.1 / §4.2.4 / §4.2.5、v1.0.2 で DTO 統一)

- [ ] **`SetupResponse` を新規作成・詳細取得・更新の 3 エンドポイント共通で返している**(v1.0.2 で確定、3 エンドポイントで型分岐していない)
- [ ] `SetupResponse` に `Setup` 埋め込み + `Steps []SetupStep` + `DefaultRecipe string` + `ParentComboIDs []int64` が含まれる
- [ ] **新規作成・詳細取得・更新すべてのレスポンスで `ParentComboIDs []int64`(配列)を返す**(v1.0.2 で確定、当初 v1.0.1 では新規作成時 `ParentComboID int64` 単数だったが配列に統一)
- [ ] 新規作成直後のレスポンスでは `ParentComboIDs: [親コンボ ID]`(単一要素配列)で返る
- [ ] 詳細取得時のレスポンスでは `ParentComboIDs` に setup が紐付いているすべての combo_id が列挙される
- [ ] `DefaultRecipe` の値が `ResolveSetupRecipe(setupID, 1)` の結果(SUPP-001 §7.4.1 の `defaultPresetID = 1` 暗黙前提)

### 3.4 PATCH 送信ポリシー(§4.2.5、SUPP-001 §5.9)

- [ ] `UpdateSetupInput.Name` / `Description` が `*string` で 3 状態区別(nil: 変更なし、`&""`: 空文字上書き、`&"値"`: 値設定)
- [ ] `UpdateSetupInput.Steps` が `*[]SetupStepInput` で 3 状態区別(nil: レシピ変更なし、`&[]`: 全削除、`&[step...]`: 置換)
- [ ] `UpdateSetupInput.Version` が必須(楽観的排他、DES-003 §3.11)
- [ ] `Steps == nil` の場合は `RecomputeSetupCache` を呼ばない(SUPP-001 §7.2 の「メタデータ編集」相当)

### 3.5 候補取得エンドポイントのスタブ確認(§4.2.7)

- [ ] `GET /api/combos/{comboId}/setup-candidates` が登録されている
- [ ] レスポンスが `{"items": []}` の空配列スタブ(M4-03 で本実装)
- [ ] サービス層 `GetSetupCandidates` 関数のシグネチャが定義されている(空配列を返すスタブ実装)

---

## 4. サービス層実装(§4.3)

### 4.1 関数シグネチャ(§4.3.1)

- [ ] `CreateSetup(ctx, parentComboID, input)` で **parentComboID が独立引数**(リクエスト DTO 直下に含まれない、CHANGE-012 §6.2 R-2 対策)
- [ ] `CreateSetupLink(ctx, parentComboID, setupID)` が分離されている
- [ ] `DeleteSetupLink(ctx, parentComboID, setupID)` が分離されている
- [ ] `GetSetup` / `UpdateSetup` / `DeleteSetup` / `GetSetupCandidates` が定義されている

### 4.2 VAL-S05 適用ロジック(§4.3.2、CHANGE-012、最重要)

- [ ] `CreateSetup` 冒頭で `parentComboID == 0` をチェックしている
- [ ] チェック失敗時に `validation_failed` エラーコードを返す
- [ ] エラーメッセージに「親コンボ ID は必須」相当の文言が含まれる
- [ ] バリデーション構造体(`ValidationResult` / `ValidationIssue`、DES-002 v1.7.0 §4.3 / CHANGE-011)を利用している
- [ ] ハンドラ層では URL パスから `comboId` を取得してサービス層に渡している(URL パス→サービス層の流れ、DTO 直下に `parent_combo_id` を含めない)

### 4.3 トランザクション境界(§4.3.3、SUPP-001 §7.5.4)

#### CreateSetup のトランザクション

- [ ] 単一トランザクション内で VAL-S01〜S04 実行 → setups INSERT → setup_steps INSERT → combo_setups INSERT → `RecomputeSetupCache` を順序実行
- [ ] エラー発生時に全体ロールバック

#### UpdateSetup のトランザクション(レシピ変更時)

- [ ] バージョン取得 → 楽観的排他チェック → VAL-S02〜S04 → setups UPDATE → setup_steps DELETE + 再 INSERT → `RecomputeSetupCache` を順序実行
- [ ] メタデータのみ変更時は VAL-S02〜S04 と `RecomputeSetupCache` を呼ばない
- [ ] バージョン不一致時は 409 + `version_conflict` エラー

#### DeleteSetup のトランザクション

- [ ] setups.deleted_at 設定(論理削除) → combo_setups 物理削除(案 P1) → `DeleteSetupCache` を順序実行
- [ ] Plan Mode で開発者と確認した方針(案 P1 採用、§4.2.6 / §3.4.1 で確認結果報告)に従っている

### 4.4 既存トランザクションパターンの踏襲

- [ ] M1-03 / M3 で確立された combo 系のトランザクション境界パターン(サービス層が `*sql.Tx` または `database/sql` 標準を扱う)に従っている
- [ ] 独自のトランザクション管理パターンを新設していない(既存パターンを踏襲、§3.4.5 で確認済み)

---

## 5. バリデーション層(§4.4)

### 5.1 VAL-S01〜S05 全件カバー

- [ ] `ValidateSetupCreate` 関数で VAL-S01〜S05 すべてが実行される
- [ ] `ValidateSetupUpdate` 関数で VAL-S02 / S03 / S04 が実行される(VAL-S01 は character_id 不変前提で不要、VAL-S05 は新規作成のみ)

### 5.2 各 VAL の実装内容

#### VAL-S01

- [ ] エラーコード: `invalid_character_id`
- [ ] 種類: ERROR
- [ ] 該当フィールド: `characterId`

#### VAL-S02

- [ ] エラーコード: `recipe_required`
- [ ] 種類: ERROR
- [ ] 該当フィールド: `steps`
- [ ] チェック内容: Steps の要素数 > 0

#### VAL-S03

- [ ] エラーコード: `unknown_move_id`
- [ ] 種類: **WARNING**(ERROR ではない、DES-006 §3 定義)
- [ ] 該当フィールド: `steps[N].moveId`
- [ ] ValidationResult の Severity フィールドで WARNING と区別

#### VAL-S04

- [ ] エラーコード: `duplicate_setup`
- [ ] 種類: ERROR
- [ ] チェック内容: 同一コンボ + 同一キャラ + 同一レシピのセットプレイが既存
- [ ] **内部表現(setup_steps の move_id + modifiers)で判定**(SUPP-001 §7.5.2、recipe_cache 表示文字列で判定していない)
- [ ] `combo_setups` を JOIN した SQL クエリで判定

#### VAL-S05

- [ ] エラーコード: `validation_failed`
- [ ] 種類: ERROR
- [ ] 該当フィールド: `parentComboId`
- [ ] チェック内容: `parentComboID == 0` で発火
- [ ] **サービス層関数の引数レベルで適用**(CHANGE-012 §6.2 R-2 対策、リクエスト DTO 直下に含まれない)

---

## 6. notation サービス層拡張(§4.5、SUPP-001 §7.1 / §7.2 / §7.5)

### 6.1 新規 setup 系関数(§4.5.1)

- [ ] `ResolveSetupRecipe(ctx, setupID, presetID) (string, error)` が実装されている
- [ ] `RecomputeSetupCache(ctx, setupID) error` が実装されている
- [ ] `DeleteSetupCache(ctx, setupID) error` が実装されている
- [ ] `ComputeSingleSetupCache(ctx, setupID, presetID) (string, error)` が実装されている(内部利用)

### 6.2 案 R2(`setups.recipe_cache JSON` カラム活用)の採用(§4.5.3)

- [ ] setup 用 cache は `setups.recipe_cache` カラム(DES-003 §3.11 既定義)に格納されている
- [ ] JSON マップ形式 `{"1": "立ち弱P > ...", "2": ...}` でプリセット ID → 表示文字列を保存
- [ ] 別テーブル `setup_recipe_cache` 等を新設していない
- [ ] コンボ側の既存 `recipe_cache` テーブル構造を変更していない
- [ ] Plan Mode で開発者と案 R2 採用を確認した報告が含まれている

### 6.3 `RecomputePresetCache` / `DeletePresetCache` 拡張(§4.5.2)

- [ ] `RecomputePresetCache(presetID)` がコンボ + セットプレイ両方を対象に再計算する
- [ ] `DeletePresetCache(presetID)` がコンボ + セットプレイ両方の recipe_cache を削除する
- [ ] 既存のコンボ recipe_cache 処理ループの後ろに setup 処理ループが追加されている(両方が同一トランザクション内、SUPP-001 §7.5.4)
- [ ] 関数シグネチャは不変(処理内容のみ拡張)

### 6.4 SUPP-001 §7.5.5 組み込みプリセット保護のセットプレイ側波及

- [ ] 組み込みプリセット(`is_builtin = true`)の削除を試みた場合、サービス層で 403 応答が返される
- [ ] 組み込みプリセットのエイリアス編集時、コンボ + セットプレイ両方の recipe_cache が再計算される

### 6.5 SUPP-001 §7.5.6 削除時の挙動

- [ ] `DeleteSetupCache` は論理削除ではなく **物理削除**(`setups.recipe_cache` を NULL に UPDATE、または setup 物理削除時はレコードごと消える)
- [ ] setup 復元時(将来 M4 以降)は `RecomputeSetupCache` で再生成される旨が実装に反映されている

---

## 7. コンボ作成 API の DTO 前方互換予約(§4.6、M4-04 用、v1.0.1 で json.RawMessage 採用)

### 7.1 形だけ予約(v1.0.1 で型変更)

- [ ] `CreateComboRequest`(または相当)に **`Setups json.RawMessage \`json:"setups,omitempty"\``** フィールドが追加されている(指示書 v1.0.0 で誤って `[]CreateSetupInput` と書かれていたが、v1.0.1 で循環 import 回避のため `json.RawMessage` に変更済み)
- [ ] `encoding/json` パッケージから `json.RawMessage` を import している
- [ ] `omitempty` タグが付いている(M3 までの既存呼び出しが影響を受けないため)
- [ ] フィールドにコメントで「M4-04 で実装予定、本指示書では中身パースせず・存在時 `slog.Warn` 出力」が明記されている
- [ ] **combo パッケージから setup パッケージへの import が含まれていない**(循環 import 回避の確認、本変更の本来目的)

### 7.2 受信時の挙動(v1.0.1 で詳細化)

- [ ] `setups` フィールドが含まれていても **エラー応答にしない**
- [ ] サービス層またはハンドラ層で `setups` の中身を **パースしていない**(`json.RawMessage` のまま、構造体への展開なし)
- [ ] 存在判定が `len(req.Setups) > 0` で行われている(`nil` 比較ではない)
- [ ] 存在時に `slog.Warn` が出力される(指示書 §4.6 実装例参照、`endpoint` / `setups_bytes` キー含む)
- [ ] `log/slog` パッケージから `slog.Warn` を呼び出している(古い `log.Warn` ではない)
- [ ] **同一リクエストで `slog.Warn` が複数回発火していない**(1 リクエストにつき 1 回、ハンドラ層またはサービス層のいずれか 1 箇所のみ)

### 7.3 前方互換性(§5.2 シナリオ F、v1.0.1 で 3 パターン拡張)

- [ ] M3 までの既存コンボ作成 API 呼び出し(setups 未指定)が影響を受けない
- [ ] setups 未指定時に `slog.Warn` 出力なし
- [ ] `make test` で既存 combo 系テストが全通過する

### 7.4 M4-04 引き継ぎ事項の明示

- [ ] フィールドコメントに「M4-04 で `[]setup.CreateSetupInput`(または相当の型)への置換」が記載されている
- [ ] combo パッケージから setup パッケージへの片方向 import を採用する旨が明記されている(setup パッケージは combo パッケージを import しない設計の維持)

---

## 8. ハンドラ層実装(§4.7)

### 8.1 共通エラー型の直接呼び出し(architecture-patterns.md §3、L-03)

- [ ] **`model.APIErrorResponse` を直接呼び出している**(独自ヘルパを作っていない)
- [ ] 独自エラー型(`SetupError` 等)を新設していない
- [ ] バリデーションエラーは `Details: map[string]any{"validations": result}` 形式(DES-002 v1.7.0 §4.3 / CHANGE-011)

### 8.2 エラーコード小文字スネーク統一(handover §4.3 L-02)

- [ ] `validation_failed`(小文字スネーク、setup 系で先行統一)
- [ ] `duplicate_setup`(小文字スネーク)
- [ ] `version_conflict`(小文字スネーク)
- [ ] `invalid_character_id`(小文字スネーク)
- [ ] `recipe_required`(小文字スネーク)
- [ ] `unknown_move_id`(小文字スネーク)
- [ ] **大文字スネーク(`VALIDATION_FAILED` 等)が混在していない**

### 8.3 HTTP ステータスコード

- [ ] 新規作成成功: 200 OK
- [ ] 紐付け解除成功: 204 No Content
- [ ] 論理削除成功: 204 No Content
- [ ] VAL-S05(parent_combo_id 不正): 400 Bad Request + `validation_failed`
- [ ] VAL-S04(重複): 409 Conflict + `duplicate_setup`
- [ ] バージョン不一致: 409 Conflict + `version_conflict`
- [ ] 存在しない setup_id / combo_id: 404 Not Found

---

## 9. テストの妥当性(§5.1)

### 9.1 サービス層テスト(必須、CLAUDE.md §5)

- [ ] `CreateSetup` 正常系
- [ ] `CreateSetup` VAL-S01 違反(invalid_character_id)
- [ ] `CreateSetup` VAL-S02 違反(recipe_required)
- [ ] `CreateSetup` VAL-S04 違反(duplicate_setup)
- [ ] **`CreateSetup` VAL-S05 違反(parentComboID == 0、`validation_failed`)** ← 最重要
- [ ] `CreateSetupLink` で別コンボに紐付け成功
- [ ] `DeleteSetupLink` で setup 本体が残ること
- [ ] `GetSetup` で `parentComboIds` 配列が複数紐付け時に正しく返る
- [ ] `UpdateSetup` メタデータのみ変更(recipe_cache 不変)
- [ ] `UpdateSetup` レシピ変更(`RecomputeSetupCache` 呼び出し)
- [ ] `UpdateSetup` バージョン不一致で 409
- [ ] `DeleteSetup` 論理削除 + combo_setups 物理削除 + recipe_cache 削除
- [ ] `GetSetupCandidates` スタブで空配列

### 9.2 バリデーション層テスト(必須)

- [ ] VAL-S01 テスト
- [ ] VAL-S02 テスト
- [ ] VAL-S03 テスト(WARNING であることを確認)
- [ ] VAL-S04 テスト
- [ ] **VAL-S05 テスト**(最重要)

### 9.3 notation サービス層テスト(必須)

- [ ] `ResolveSetupRecipe` cache ヒット時の値返却
- [ ] `ResolveSetupRecipe` cache ミス時の計算・カラム更新
- [ ] `RecomputeSetupCache` 全プリセット分の JSON マップ生成・UPDATE
- [ ] `DeleteSetupCache` カラム NULL 化
- [ ] `RecomputePresetCache` 拡張: コンボ + セットプレイ両方が再計算される
- [ ] `DeletePresetCache` 拡張: コンボ + セットプレイ両方が削除される

### 9.4 ハンドラ層テスト

- [ ] 各エンドポイント正常系
- [ ] VAL-S05 / VAL-S04 / 404 / 409 の主要異常系
- [ ] レスポンス JSON フィールド名が camelCase

### 9.5 リポジトリ層テスト(複雑クエリのみ、CLAUDE.md §5)

- [ ] VAL-S04 重複判定クエリ
- [ ] `GetSetup` の詳細取得クエリ
- [ ] 単純な CRUD はテスト不要(CLAUDE.md §5)

### 9.6 ビルド・型チェック

- [ ] `make test` または `go test ./...` 全通過
- [ ] `go build ./...` 成功
- [ ] `go vet ./...` エラーなし

---

## 10. E2E シナリオ(§5.2、curl 実行結果)

製造担当の完了報告に以下の curl 実行結果が含まれていることを確認:

### 10.1 シナリオ A(正常系: 作成・取得・更新・削除)

- [ ] コンボ作成 → 200
- [ ] `POST /api/combos/{comboId}/setups` → 200 + setup + defaultRecipe + parentComboId
- [ ] `GET /api/setups/{setupId}` → 200 + setup + steps + parentComboIds 配列
- [ ] `PATCH /api/setups/{setupId}` name 更新(Steps nil)→ 200、recipe_cache 不変
- [ ] `PATCH /api/setups/{setupId}` Steps 変更 → 200、recipe_cache 更新
- [ ] `DELETE /api/setups/{setupId}` → 204
- [ ] `GET /api/setups/{setupId}` → 404

### 10.2 シナリオ B(VAL-S05 違反)

- [ ] サービス層を直接叩くテストコードで `parentComboID == 0` で呼び出し → `validation_failed` エラー

### 10.3 シナリオ C(VAL-S04 違反: 重複)

- [ ] 親コンボ A に setup X 作成 → 200
- [ ] 同一コンボ A に同一レシピ setup Y 作成 → 409 + `duplicate_setup`
- [ ] 別コンボ B に同一レシピ setup 作成 → 200(VAL-S04 は同一コンボ内のみ判定)

### 10.4 シナリオ D(紐付け操作)

- [ ] 親コンボ A に setup X 作成 → 200
- [ ] `POST /api/combos/{B}/setup-links` で setup X を別コンボ B に紐付け → 200
- [ ] `GET /api/setups/{X}` → `parentComboIds: [A, B]`
- [ ] `DELETE /api/combos/{B}/setup-links/{X}` → 204
- [ ] `GET /api/setups/{X}` → `parentComboIds: [A]`

### 10.5 シナリオ E(notation 連動)

- [ ] setup X 作成 → recipe_cache に JSON マップ生成
- [ ] プリセット 1 のエイリアス編集 → setup X の recipe_cache が再計算
- [ ] プリセット 2 のエイリアス新規追加 → setup X の recipe_cache に preset 2 エントリ追加

### 10.6 シナリオ F(M3 まで API の回帰確認、最重要、v1.0.1 で 3 パターン拡張)

- [ ] `POST /api/combos`(setups 未指定)→ 200 + `slog.Warn` 出力なし(M3 までの完全互換)
- [ ] `POST /api/combos`(`"setups": []` 空配列)→ 200 + `slog.Warn` 1 回(setups は無視、コンボのみ作成)
- [ ] `POST /api/combos`(`"setups": [{...}]` 1 件以上)→ 200 + `slog.Warn` 1 回(setups は無視、コンボのみ作成)
- [ ] 上記 3 パターンとも、レスポンス JSON 形式・コンボ作成成功状態が M3 完了時と完全に同一
- [ ] M3-05 統合 E2E シナリオの再実行で全通過

---

## 11. コード品質・規約遵守

- [ ] CLAUDE.md §4 コーディング規約に準拠(camelCase JSON タグ、列挙定数同期は本指示書では新規定数なし)
- [ ] CLAUDE.md §5 テスト規約に準拠(サービス層・バリデーション層・notation 層が必須カバー、複雑なリポジトリ層のみテスト)
- [ ] CLAUDE.md §10 禁止事項に抵触していない(`console.log` / `fmt.Println` を本番コードに残していない、`log.Warn` / `log/slog` は許容)
- [ ] **playbook §4.5 フローの素直さ原則に抵触していない**(VAL-S04 重複判定が「エラー駆動再試行」になっていない、サービス層内一度の SQL JOIN で判定完結)
- [ ] **playbook §4.7 全ハンドラ列挙原則**: 新規エラー型(`duplicate_setup` 等)は setup ハンドラ内に閉じている、外部ハンドラへの波及がない
- [ ] **shadcn/ui 関連の変更が含まれていない**(本指示書はバックエンドのみ、playbook §4.6)
- [ ] バックエンド 3 層(handler / service / repository)が正しく分離されている(architecture-patterns.md §2、handler に SQL がない、service に HTTP がない、repository にビジネスロジックがない)

---

## 12. ドキュメント・進捗ログ

- [ ] `docs/progress/progress-log.md` に M4-01 完了報告が追記されている
- [ ] **CHANGE-012 / VAL-S05 のサービス層適用** が完了した事実が明記されている
- [ ] **SUPP-001 §7.5 setup 向け recipe_cache 責務がコードに反映された** ことが明記されている
- [ ] §3.4 着手前確認結果(全 6 項目)が含まれている
- [ ] 設計判断事項表(指示書 §4.8)の各項目が指示書通りに実装された旨が明記されている

---

## 13. 重大な問題の判定基準

以下のいずれかに該当する場合、**重大な問題** と判定し M4-01 完了承認を保留する:

- §1.1 ファイル一覧チェックで 2 件以上の未充足(新規作成 / 修正対象の漏れ)
- §1.1 スコープ外への変更が含まれている(DB マイグレーション追加、M4-00 / M4-00b ファイルへの変更、フロント変更等)
- **§4.2 VAL-S05 がサービス層関数の引数レベルで適用されていない**(CHANGE-012 §6.2 R-2 違反、最重要)
- **§4.3 トランザクション境界が SUPP-001 §7.5.4 に反する**(setup INSERT と recipe_cache 更新が別トランザクション、ロールバック時の整合性破壊)
- §5.2 VAL-S05 違反テストが存在しない、または通過していない
- §6.2 案 R2 以外の方式(別テーブル新設等)が採用され、Plan Mode 報告がない
- §7.1 `CreateComboRequest` への `Setups` フィールドが **`json.RawMessage` 型でない**(`[]CreateSetupInput` 等の構造体型で循環 import を発生させている)、または **`omitempty` なし**、または `setups` 受信時にエラー応答している(M3 まで API 互換性破壊)
- §7.1 combo パッケージから setup パッケージへの import が発生している(循環 import 回避違反、v1.0.1 で本変更を行った本来目的の違反)
- §8.2 エラーコードに大文字スネーク混在(`VALIDATION_FAILED` 等)
- §8.1 独自エラー型・独自ヘルパを新設している(architecture-patterns.md §3 違反)
- §10.6 M3 まで API の回帰テストが通っていない
- §11 3 層分離が崩れている(handler に SQL、service に HTTP、repository にビジネスロジック)

---

## 14. 軽微な問題の判定基準

以下に該当する場合、**軽微な問題** と判定し M4-01 完了承認は許容するが、記録として残す:

- エラーメッセージの細部文言が指示書例と多少異なる(意味が一致していれば許容、§9.2 推測 OK 範囲)
- ログ出力のフォーマットが指示書と異なる
- テストケース名の細部
- リポジトリ層内部のヘルパ関数名
- E2E シナリオの curl 出力が冗長(セキュリティ上問題ない範囲で省略可)

---

## 15. 質問・確認事項のフォーマット

レビュー中に判断が分かれる事項を発見した場合、以下のフォーマットで開発者に質問する:

```
## 質問: M4-01 §X.Y についての判断確認

### 状況
(発見した事象、該当ファイル・行)

### 案 1: 製造担当の実装通り承認
(理由・リスク)

### 案 2: 修正を要求
(修正方針・理由)

### レビュー担当の推奨
(案 1 または案 2、理由)
```

---

## 16. レビュー完了の判定

すべて以下を満たす場合、レビュー完了として開発者に「重大な問題なし」と報告する:

- §1〜§12 の機械的チェック項目がすべて通過
- §13 重大な問題に該当する項目がゼロ
- §14 軽微な問題が存在する場合は記録されている
- 設計意図整合確認(VAL-S05 サービス層適用、案 R2 採用、エラーコード統一、共通型直接呼び出し、3 層分離、M3 API 回帰なし)がすべて確認されている

不通過の場合は §13 / §14 のどちらに該当するかを明示し、§15 フォーマットで開発者に質問または修正要求を行う。

---

*以上*

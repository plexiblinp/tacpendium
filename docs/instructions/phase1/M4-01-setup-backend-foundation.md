# 指示書 M4-01: セットプレイ ドメイン バックエンド基盤(CRUD API + recipe_cache 連動 + VAL-S01〜S05)

| 項目 | 内容 |
|------|------|
| 指示書ID | M4-01 |
| バージョン | 1.0.2 |
| 対象マイルストーン | M4(セットプレイ系) |
| 推奨モデル | **Opus 4.6** |
| Plan Mode | **必須** |
| 機械レビュー | **必須**(別チェックリスト: `docs/instructions/reviews/M4-01-review-checklist.md`) |
| 並列性 | **単独**(M4 は完全直列、M4-00 / M4-00b 完了承認済みが前提) |
| 依存指示書 | M1-02(マイグレーション基盤・seed)、M1-03(コンボ系 3 層パターン)、M3-05(CHANGE-010 / CHANGE-011 共通エラー型)、M4-00 / M4-00b(完了承認済み、本指示書とは独立) |
| 想定所要時間 | 150〜180 分 |
| 作成者 | 詳細設計・製造準備担当 Claude(M4 期間担当) |
| 作成日 | 2026-05-16 |

## 更新履歴

| バージョン | 更新日 | 更新内容 |
|-----------|--------|----------|
| 1.0.0 | 2026-05-16 | 初版作成。M4-overview v1.1.2 §3.2 / SUPP-001 v1.13.0 §7.5 / CHANGE-012 反映の DES-006 v1.9.0 を踏まえて起票 |
| 1.0.1 | 2026-05-16 | 製造担当からの指摘(循環 import 懸念)を受けて §4.6 を修正。`Setups []CreateSetupInput` から `Setups json.RawMessage` へ型変更(combo パッケージから setup パッケージへの import 回避)。修正に伴い §5.2 シナリオ F に setups 受信時の挙動テスト 3 ケースを追加、§4.6 末尾に M4-04 引き継ぎ事項を追記。本件は設計担当(M4 期間担当)の指示書執筆ミスとして retrospective-log v1.0.2 §5.1 M4-2 に記録 |
| 1.0.2 | 2026-05-16 | M4-01 完了承認後の事後実態整合修正(M4-02 着手前の前提整理)。(1) §4.2.1 `ParentComboID int64`(単数)を `ParentComboIDs []int64`(配列)に統一。レビュー担当の中優先指摘により、新規作成・詳細取得両方で配列レスポンスとする方が DTO 共通化(`SetupResponse` 1 型運用)に整合的。(2) §4.1.1 `Setup.DeletedAt` の JSON タグを `json:"deletedAt,omitempty"` から `json:"-"` に変更、§4.1.2 `SetupStep.SetupID` の JSON タグを `json:"setupId"` から `json:"-"` に変更。permanence model はクライアントに直接出さず DTO 経由で返す M3 までの確立運用に整合。combo 側既存パターンの踏襲。本件は設計担当(M4 期間担当)の指示書執筆ミス(retrospective-log §1 パターン C「既存パターンとの整合確認漏れ」)として retrospective-log v1.0.3 §5.1 M4-3 に合算記録 |

---

## 1. 背景と目的

### 1.1 背景

M3 完了時点では、セットプレイ系(`setups` / `setup_steps` / `combo_setups` テーブル、DES-003 §3.11〜§3.13)は **テーブル DDL のみ存在し API・サービス層は未実装**。M4 の主要スコープとしてセットプレイ機能を実装するにあたり、本指示書ではバックエンドの 3 層パターン(architecture-patterns.md §2)に従って setup ドメインを新設する。

M4 着手前に以下が整備済み:

- **DES-006 v1.9.0(CHANGE-012 反映)**: VAL-S05「セットプレイ作成 API リクエストに親コンボ ID 必須」が追加された(2026-05-16)
- **SUPP-001 v1.13.0**: §7.1 / §7.2 にセットプレイ用 recipe_cache 整理関数(`ResolveSetupRecipe / RecomputeSetupCache / DeleteSetupCache`)を追記、§7.5 でセットプレイ用 recipe_cache 責務を新設(採用方針 案 X、トランザクション境界、組み込みプリセット保護のセットプレイ側波及、削除時挙動を明文化)
- **M3-05 で確立した共通エラー型**: `model.APIError` / `model.APIErrorResponse`(DES-002 v1.7.0 §4.3、CHANGE-010 / CHANGE-011)

本指示書は M4-02 以降(フロント実装、転用支援、同時登録)の前提となるバックエンド基盤を完成させる。

### 1.2 目的

- **setup ドメインのバックエンド 3 層を新設**: `internal/api/setup/`、`internal/service/setup/`、`internal/repository/setup/`(architecture-patterns.md §2 踏襲)
- **setup CRUD API 群を実装**(本指示書 §4.2 で具体エンドポイント確定)
- **VAL-S01〜S05 のバリデーション層を実装**: 特に VAL-S05(CHANGE-012)は **サービス層関数の引数レベル** で適用(SUPP-001 §7.5.3、CHANGE-012 §6.2 R-2 対策)
- **notation サービス層拡張**(SUPP-001 §7.1 / §7.2 追記、案 X 採用): `ResolveSetupRecipe / RecomputeSetupCache / DeleteSetupCache / ComputeSingleSetupCache` 4 関数を新設、`RecomputePresetCache` / `DeletePresetCache` をセットプレイ側も対象に拡張
- **コンボ作成 API の DTO 前方互換予約**: `POST /api/combos` リクエスト DTO に `Setups json.RawMessage \`json:"setups,omitempty"\`` を **形だけ予約**(本指示書では中身をパースせず無視、M4-04 で本実装。型選定の根拠は §4.6 参照、v1.0.1 で循環 import 回避のため `json.RawMessage` 採用)
- **エラーレスポンス**: `model.APIErrorResponse` を最初から使用(architecture-patterns.md §3、独自エラー型を作らない)

### 1.3 このマイルストーンで作らないもの

- **FR011 転用候補抽出ロジックの実装** — M4-03 で実装。本指示書では `GET /api/combos/{id}/setup-candidates` エンドポイントの **API 形のみ確定**(空配列を返すスタブ実装または未公開)
- **フロント側 UI 全般**(セットプレイ登録画面、コンボ詳細でのセットプレイ展開、紐付け操作 UI) — M4-02 で実装
- **コンボ作成 API の setups 束受領の本実装** — M4-04 で実装(本指示書は DTO 形予約のみ)
- **knockdown_advantage 変更時のセットプレイ引き継ぎロジック** — M4-03 で実装
- **セットプレイのゴミ箱・復元 UI** — M4 期間内では論理削除 + 物理削除 API までを実装、ゴミ箱画面は M5 以降または M7 で判断(現状コンボのゴミ箱は M2-03 で実装済み、セットプレイは M4 で論理削除 API のみ)
- **持ち越し L-02 / L-03**(handover §4.3 / §4.4) — M4 では対応しない、M5 以降または M7

---

## 2. 成果物

### 2.1 作成するファイル

#### バックエンド(setup ドメイン 3 層、新設)

| ファイル | 内容 |
|---------|------|
| `internal/api/setup/handler.go` | HTTP ハンドラ層。リクエスト/レスポンス JSON 変換、エラー応答(`model.APIErrorResponse` 直接呼び出し、architecture-patterns.md §3) |
| `internal/api/setup/handler_test.go` | ハンドラ層テスト(`httptest` 使用、正常系 + 主要異常系) |
| `internal/api/setup/dto.go` | リクエスト/レスポンス DTO 定義(camelCase JSON タグ、CLAUDE.md §4) |
| `internal/service/setup/service.go` | サービス層。ビジネスロジック、トランザクション境界、recipe_cache 連動 |
| `internal/service/setup/service_test.go` | サービス層テスト(必須、CLAUDE.md §5) |
| `internal/service/setup/validate.go` | バリデーション関数群(VAL-S01〜S05) |
| `internal/service/setup/validate_test.go` | バリデーション層テスト(必須、VAL-S01〜S05 全件カバー) |
| `internal/repository/setup/repository.go` | リポジトリ層。SQL クエリ集約 |
| `internal/repository/setup/repository_test.go` | リポジトリ層テスト(複雑なクエリのみ、CLAUDE.md §5)|

#### notation サービス層拡張(既存パッケージへの追加)

| ファイル | 内容 |
|---------|------|
| `internal/service/notation/setup_resolver.go` | セットプレイ用 recipe_cache 関数 4 種実装(`ResolveSetupRecipe / RecomputeSetupCache / DeleteSetupCache / ComputeSingleSetupCache`、SUPP-001 §7.1 / §7.5) |
| `internal/service/notation/setup_resolver_test.go` | 上記関数のテスト |

#### モデル定義(既存パッケージへの追加)

| ファイル | 内容 |
|---------|------|
| `internal/model/setup.go` | Setup / SetupStep / ComboSetup モデル(DES-003 §3.11〜§3.13 準拠、JSON タグ camelCase) |

### 2.2 修正するファイル

#### バックエンド(既存ファイル)

| ファイル | 修正内容 |
|---------|---------|
| `internal/api/combo/dto.go` | `CreateComboRequest`(または相当の DTO) に `Setups json.RawMessage \`json:"setups,omitempty"\`` フィールドを **形だけ追加**(M4-04 で本実装、本指示書では中身パースせず存在時 `slog.Warn` を出力。型選定の根拠は §4.6 参照) |
| `internal/api/router.go`(または相当のルーティング登録箇所) | setup ハンドラのルート登録 |
| `internal/service/notation/preset_resolver.go`(または相当) | `RecomputePresetCache` / `DeletePresetCache` をセットプレイ側も対象に拡張(SUPP-001 §7.1 注記、§7.5.5) |

### 2.3 変更しないもの(原則)

- DB マイグレーション(`setups` / `setup_steps` / `combo_setups` の DDL は M1-02 で整備済み想定、本指示書では DDL を変更しない。§3.4 で確認)
- コンボ系 API の本体ロジック(M3 完了状態を維持、M3-05 で確立した DTO 構造は不変)
- M4-00 / M4-00b で実装した RecipeBuilder / ModifiersEditor の console.warn(完了承認済み、回帰しない)
- フロントエンド全般(本指示書はバックエンドのみ、フロント変更は M4-02 以降)

### 2.4 例外: バックエンドへの追加実装が許容される箇所

本指示書はバックエンドの新規追加を中核とするため、§2.1 / §2.2 で列挙した変更がすべてスコープに含まれる。**スコープ外の変更は禁止**:

- 既存コンボ系ハンドラの振る舞い変更(M3 までの API 互換を破壊しない)
- 既存 notation サービス層関数のシグネチャ変更(`ResolveComboRecipe` 等は既存通り、`RecomputePresetCache` の処理内容のみ拡張)
- DB マイグレーション新規追加
- `internal/model/combo.go` 等の既存モデル定義の変更(`CreateComboRequest` の `Setups` フィールド追加は **dto.go 側**、model.go 側は変更しない想定。詳細は §4.6 で確定)

万一実装中にこれらの変更が必要と判断した場合、Plan Mode で停止して開発者に相談すること。

---

## 3. 前提条件

### 3.1 必読ドキュメント

製造担当 Claude Code は実装着手前に以下を読む:

| ID / ファイル | 関連節 |
|--------------|--------|
| 本指示書 | 全体 |
| CLAUDE.md | §4 コーディング規約(JSON タグ camelCase、列挙定数同期)、§5 テスト規約、§10 禁止事項 |
| **SUPP-001 v1.13.0** | **§7.1 公開関数表(setup 系 4 関数の役割)、§7.2 呼出元の責務、§7.5 セットプレイ用 recipe_cache の責務(§7.5.1〜§7.5.6 全節)** |
| DES-003 | §3.11 setups、§3.12 setup_steps、§3.13 combo_setups テーブル定義 |
| DES-002 v1.7.0 | §4.3 エラーレスポンス共通 Go 型・`details.validations` 構造 |
| **DES-006 v1.9.0** | **§3 セットプレイ登録時バリデーション表(VAL-S01〜S05)、特に VAL-S05 補足段落** |
| architecture-patterns.md v1.0.0 | §1 フロント分離パターン(本指示書はバックエンドのみのため参考)、**§2 バックエンド 3 層パターン**、**§3 エラーレスポンス共通型**、§4 列挙定数同期(本指示書では新規列挙定数なし) |

### 3.2 任意参照(必要時のみ)

| ID / ファイル | 参照タイミング |
|--------------|--------------|
| M1-03 指示書 | コンボ系 3 層パターンの実装例参照時(setup 3 層を作る際の構造踏襲先) |
| M3-05 指示書 §4.5 | `model.APIError` / `model.APIErrorResponse` 共通型の使い方(本指示書で新規ハンドラから使用) |
| SUPP-001 §3.3.0 | Modifiers 構造体(`setup_steps.modifiers` でも同構造を再利用) |
| SUPP-001 §5.9 | PATCH 系省略可能フィールドの送信ポリシー(`PATCH /api/setups/{id}` で適用) |
| SUPP-001 §2.7 | マイグレーションツール(本指示書では DDL 変更なしのため参考のみ) |
| playbook v1.6.0 | §4.5 フローの素直さ原則、§4.7 全ハンドラ列挙原則(参考)、§5 設計書節への行レベル参照 |

### 3.3 参照不要

- DES-005 §5.6 / §5.7 / §5.9 — フロント設計、M4-02 以降で参照
- M3-04 指示書のフック分離パターン — フロント設計、M4-02 以降で参照
- セットプレイ転用支援 FR011 関連節 — M4-03 で参照(本指示書では `GET /api/combos/{id}/setup-candidates` の API 形のみ確定)

### 3.4 着手前の確認

製造担当 Claude Code は §4 詳細仕様の実装に着手する前に、以下を確認する。**結果を Plan Mode で開発者に報告すること**(Plan Mode 必須、playbook §8.1)。

#### 3.4.1 setup 系テーブル DDL の現状確認

```bash
sqlite3 data/combomgr.db ".schema setups"
sqlite3 data/combomgr.db ".schema setup_steps"
sqlite3 data/combomgr.db ".schema combo_setups"
```

期待される確認事項:

- 3 テーブルが M1-02 で整備済み(setups / setup_steps / combo_setups の DDL が存在)
- カラム構成が DES-003 §3.11〜§3.13 と整合(`character_id`、`name`、`description`、`step_count`、`recipe_cache`、`version`、`created_at`、`updated_at`、`deleted_at` 等)
- インデックス: `combo_setups(setup_id)`、`setups(character_id)`、`setup_steps(setup_id, step_order)` が設定されている(DES-003 §4)
- ON DELETE CASCADE などの制約状況の把握(setup 物理削除時の `setup_steps` / `combo_setups` の連動挙動、§4.4 で活用)

**3 テーブルのいずれかが存在しない場合、または DDL が想定と大きく異なる場合は Plan Mode で停止し開発者に報告**(マイグレーション追加の要否を協議する。本指示書 §2.4 ではマイグレーション新規追加は禁止のため、CHANGE 通知書相当の判断が必要)。

#### 3.4.2 既存 notation サービス層の構造確認

```bash
ls internal/service/notation/
cat internal/service/notation/preset_resolver.go | head -40
grep -n 'RecomputePresetCache\|DeletePresetCache' internal/service/notation/
```

期待される確認事項:

- `internal/service/notation/` 配下に `combo_resolver.go`(または相当)、`preset_resolver.go`(または相当)が存在(M1-04 で実装済み想定)
- `RecomputePresetCache(presetID) error` / `DeletePresetCache(presetID) error` 関数が定義済み
- 関数シグネチャと現行の実装内容(コンボ side のみを対象としている既存ロジック)

ファイル名・関数名が想定と異なる場合は Plan Mode で停止し報告。本指示書 §4.5 でセットプレイ側を追加する際の正確なファイル/関数を確定してから着手する。

#### 3.4.3 既存 combo ハンドラの DTO 構造確認

```bash
grep -n 'CreateComboRequest\|CreateComboInput' internal/api/combo/dto.go internal/service/combo/
cat internal/api/combo/dto.go | head -60
```

期待される確認事項:

- `POST /api/combos` のリクエスト DTO 名(`CreateComboRequest` / `CreateComboInput` 等、実装時の命名を確定)
- 現行のフィールド構成(`character_id`、`starter_move_id`、`steps`、`modifiers` 等)
- `Setups json.RawMessage` フィールドの追加先位置(DTO の末尾フィールドとして追加が望ましい、JSON 互換性維持。型選定の根拠は §4.6 参照)

#### 3.4.4 共通エラー型(CHANGE-010 / CHANGE-011)の現状確認

```bash
grep -n 'APIError\|APIErrorResponse' internal/model/api_error.go
cat internal/model/api_error.go
```

期待される確認事項:

- `internal/model/api_error.go` が存在し、`APIError` 構造体(`Code`、`Message`、`Details map[string]any`)と `APIErrorResponse` 構造体が定義されている(DES-002 v1.7.0 §4.3)
- M3-05 で 5 ハンドラ統一済み(tag / character / combo / preset / move)

本指示書で新設する setup ハンドラは **本構造体を直接利用** し、独自エラー型・独自ヘルパを作らない(architecture-patterns.md §3 / handover §4.4 L-03)。

#### 3.4.5 既存リポジトリ層のトランザクション扱いの確認

```bash
grep -rn 'BeginTx\|sql\.Tx\|Transaction' internal/repository/combo/ internal/service/combo/
```

期待される確認事項:

- M1〜M3 で確立されたトランザクション境界の扱い方(リポジトリ層は `*sql.Tx` または `database/sql` の標準インターフェースを受け取る等)
- サービス層がトランザクションを開始し、リポジトリ層に渡すパターンの確認

本指示書 §4.3 サービス層実装で setup 作成・更新・削除時のトランザクション境界(SUPP-001 §7.5.4)を組む際に、既存パターンを踏襲する。

#### 3.4.6 SUPP-001 §7.1 / §7.2 / §7.5 の読了確認

製造担当は **SUPP-001 §7.1 公開関数表 / §7.2 呼出元の責務 / §7.5 セットプレイ用 recipe_cache の責務(全 6 サブセクション)** を読了済みであることを Plan Mode 報告で明示する。本指示書 §4.5 / §4.3 の設計判断はこの SUPP-001 §7 を根拠とする。

#### 3.4.7 確認結果の報告

製造担当 Claude Code は §3.4.1〜§3.4.5 の確認コマンド出力 + §3.4.6 読了確認を Plan Mode で開発者に報告する。

#### 3.4.8 §4 着手の前提条件

§3.4.1〜§3.4.6 のすべての確認結果が期待通りであることを確認してから、§4 詳細仕様の実装に着手する。万一現状が想定と乖離する場合は Plan Mode で停止して開発者に報告する。

---

## 4. 詳細仕様

### 4.1 setup モデル定義

`internal/model/setup.go` を新設し、DES-003 §3.11〜§3.13 のテーブル定義に対応する構造体を定義する。

#### 4.1.1 Setup 構造体

```go
// Setup はセットプレイ本体を表す。DES-003 §3.11 setups テーブルに対応。
type Setup struct {
    ID          int64      `json:"id" db:"id"`
    CharacterID int64      `json:"characterId" db:"character_id"`
    Name        *string    `json:"name,omitempty" db:"name"`               // NULL 許容、DES-003 §3.11
    Description *string    `json:"description,omitempty" db:"description"` // NULL 許容、DES-003 §3.11
    StepCount   int        `json:"stepCount" db:"step_count"`              // DES-003 §3.11
    RecipeCache *string    `json:"-" db:"recipe_cache"`                    // 内部キャッシュ、API 開示しない(M3-05 で確立した方針、ComboResponse と対称)
    Version     int        `json:"version" db:"version"`                   // 楽観的排他用、DES-003 §3.11
    CreatedAt   time.Time  `json:"createdAt" db:"created_at"`
    UpdatedAt   time.Time  `json:"updatedAt" db:"updated_at"`
    DeletedAt   *time.Time `json:"-" db:"deleted_at"`                      // 論理削除日時、API 開示しない(combo 側既存パターン踏襲、M3 までの確立運用)
}
```

**JSON タグ命名**: CLAUDE.md §4 / SUPP-001 §6.4 に従い camelCase で統一(`characterId`、`stepCount`、`createdAt` 等)。

**`RecipeCache` / `DeletedAt` の API 開示禁止**: いずれも `json:"-"` で API レスポンスから除外(M3-05 確立方針、コンボ側 `Combo.RecipeCache` / `Combo.DeletedAt` と対称)。論理削除済みの setup は GET で 404 を返すため、`DeletedAt` をレスポンスに露出させる意味がない。setup の表示用 recipe は `ResolveSetupRecipe` で取得して別 DTO フィールド(後述 §4.2.4 `defaultRecipe`)として返す。

#### 4.1.2 SetupStep 構造体

```go
// SetupStep はセットプレイのステップを表す。DES-003 §3.12 setup_steps テーブルに対応。
type SetupStep struct {
    ID        int64     `json:"id" db:"id"`
    SetupID   int64     `json:"-" db:"setup_id"`                     // 親 setup ID、API 開示しない(combo 側既存パターン踏襲、SetupResponse の階層構造で親子関係明白なため)
    StepOrder int       `json:"stepOrder" db:"step_order"`           // 1 始まり、DES-003 §3.12
    MoveID    *int64    `json:"moveId,omitempty" db:"move_id"`       // NULL 許容、非技ステップは NULL(SUPP-001 §3.3.3)
    Modifiers Modifiers `json:"modifiers" db:"modifiers"`            // SUPP-001 §3.3.0 と同型、combo_steps と共有
}
```

**Modifiers の再利用**: `internal/model/modifiers.go`(または相当、M1-02 で確立済み想定)で定義済みの `Modifiers` 型をそのまま使う(SUPP-001 §3.3.0)。setup_steps 専用の Modifiers を作らない。

**`SetupID` の API 開示禁止**: `json:"-"` で API レスポンスから除外(combo 側既存パターン踏襲、コンボ側 `ComboStep.ComboID` と対称)。`SetupResponse` の階層構造(setup 本体 + `steps []SetupStep`)で親子関係が明白なため、ステップレベルで `setupId` を露出させる必要がない。

#### 4.1.3 ComboSetup 構造体

```go
// ComboSetup はコンボとセットプレイの多対多関連を表す。DES-003 §3.13 combo_setups テーブルに対応。
type ComboSetup struct {
    ComboID int64 `json:"comboId" db:"combo_id"`
    SetupID int64 `json:"setupId" db:"setup_id"`
}
```

主キー: `(combo_id, setup_id)` の複合キー(DES-003 §3.13)。

### 4.2 setup API エンドポイント設計

本指示書で実装する API エンドポイント一覧。HTTP メソッド・パス・主要レスポンスを確定する。

| メソッド | パス | 用途 | VAL 適用 |
|----------|------|------|---------|
| `POST` | `/api/combos/{comboId}/setups` | 親コンボ ID 経由でセットプレイ新規作成 | VAL-S01〜S05 |
| `POST` | `/api/combos/{comboId}/setup-links` | 既存セットプレイの紐付け追加(`combo_setups` への INSERT のみ) | — |
| `DELETE` | `/api/combos/{comboId}/setup-links/{setupId}` | 紐付け解除(`combo_setups` からの DELETE のみ、setup 本体は残す) | — |
| `GET` | `/api/setups/{id}` | セットプレイ詳細取得(レシピ展開 + 紐付き combo_setups 含む) | — |
| `PATCH` | `/api/setups/{id}` | セットプレイのメタデータ・レシピ編集 | VAL-S02 / S03 / S04(レシピ変更時) |
| `DELETE` | `/api/setups/{id}` | セットプレイ論理削除(deleted_at 設定) | — |
| `GET` | `/api/combos/{comboId}/setup-candidates` | **転用候補取得(FR011、M4-03 で挙動仕上げ。本指示書では空配列を返すスタブ実装)** | — |

#### 4.2.1 `POST /api/combos/{comboId}/setups`(新規作成、VAL-S05 適用)

リクエスト DTO(`CreateSetupInput`):

```go
type CreateSetupInput struct {
    CharacterID int64    `json:"characterId"`
    Name        *string  `json:"name,omitempty"`
    Description *string  `json:"description,omitempty"`
    Steps       []SetupStepInput `json:"steps"`
}

type SetupStepInput struct {
    MoveID    *int64    `json:"moveId,omitempty"`
    Modifiers Modifiers `json:"modifiers"`
}
```

**注**: リクエスト DTO 直下に `parent_combo_id` は含めない(URL パスから取得、SUPP-001 §7.5.3 / CHANGE-012 §6.2 R-2 対策)。サービス層で `parentComboID = 0` チェックを行う(§4.3.2)。

レスポンス: 200 OK + 作成された Setup 本体 + 紐付け済み combo_setups 情報。

```go
// SetupResponse は setup の全 API レスポンスで共通の DTO 型(v1.0.2 で統一)。
// 新規作成 §4.2.1 / 詳細取得 §4.2.4 / 更新 §4.2.5 のすべてで本型を返す。
type SetupResponse struct {
    Setup
    Steps          []SetupStep `json:"steps"`
    DefaultRecipe  string      `json:"defaultRecipe"`   // ResolveSetupRecipe(setupID, defaultPresetID=1) の結果、SUPP-001 §7.4.1 と対称
    ParentComboIDs []int64     `json:"parentComboIds"`  // この setup が紐付いている全コンボ ID(combo_setups から取得)。新規作成直後は単一要素 [親コンボ ID]、詳細取得時は全紐付け
}
```

**設計判断(v1.0.2 で確定)**: 新規作成・詳細取得・更新のレスポンス DTO を **単一の `SetupResponse` 型に統一** し、`ParentComboIDs []int64`(配列)を全レスポンスで返す。当初指示書 v1.0.1 では新規作成時 `ParentComboID int64`(単数)、詳細取得時 `ParentComboIDs []int64`(配列)と分離していたが、レビュー担当の中優先指摘および M4-01 製造担当の実装判断により、以下の理由で配列統一に変更:

- DTO 共通化が成立し、フロント(M4-02 以降)の型定義が単純になる
- 新規作成直後でも「作成された setup が紐付いている全コンボ ID」を返すという意味で配列が自然
- 将来 M4-04(コンボ + setup 同時登録)で複数コンボに同時紐付けされる可能性も考慮可能

#### 4.2.2 `POST /api/combos/{comboId}/setup-links`(既存セットプレイの紐付け追加)

リクエスト DTO:

```go
type CreateSetupLinkInput struct {
    SetupID int64 `json:"setupId"`
}
```

レスポンス: 200 OK + 紐付け済みの combo_setups エントリ。

**設計判断**: 既存セットプレイの紐付け追加は **新規セットプレイ作成と別エンドポイント** で分離する(M4-overview §3.2 設計判断、`CreateSetup` と `CreateSetupLink` のサービス層関数も分離)。理由: 操作の意味が異なる(新規作成は setup レコード + setup_steps + combo_setups の 3 件 INSERT、紐付け追加は combo_setups の 1 件 INSERT のみ)。

#### 4.2.3 `DELETE /api/combos/{comboId}/setup-links/{setupId}`(紐付け解除)

レスポンス: 204 No Content。

**注意**: 紐付け解除は **setup 本体を削除しない**。combo_setups からの 1 件 DELETE のみ。setup 本体は他のコンボにも紐付いている可能性があり、setup 本体削除を伴うのは別エンドポイント `DELETE /api/setups/{id}` のみ。

#### 4.2.4 `GET /api/setups/{id}`(詳細取得)

レスポンス: 200 OK + `SetupResponse`(§4.2.1 で定義した共通 DTO 型、v1.0.2 で統一)。`ParentComboIDs []int64` には setup が紐付いているすべての combo_setups エントリの combo_id が列挙される。

**設計判断(v1.0.2 で統一)**: 当初指示書 v1.0.1 では新規作成時 §4.2.1 で `ParentComboID int64` 単数、詳細取得時 §4.2.4 で `ParentComboIDs []int64` 配列と分離する構造だったが、レビュー担当の中優先指摘および M4-01 製造担当の実装判断により **§4.2.1 / §4.2.4 / §4.2.5 すべて共通の `SetupResponse` 型で `ParentComboIDs []int64`(配列)に統一**(配列統一の根拠は §4.2.1 参照、DES-003 §3.13 / FR011 転用支援との整合)。

#### 4.2.5 `PATCH /api/setups/{id}`(編集、SUPP-001 §5.9 適用)

リクエスト DTO(SUPP-001 §5.9 PATCH 送信ポリシー準拠、`*T` ポインタ型で 3 状態区別):

```go
type UpdateSetupInput struct {
    Name        *string           `json:"name,omitempty"`        // nil: 変更なし、&"": 空文字で上書き
    Description *string           `json:"description,omitempty"` // 同上
    Steps       *[]SetupStepInput `json:"steps,omitempty"`       // nil: レシピ変更なし、&[]: 全削除、&[step1...]: 置換
    Version     int               `json:"version"`               // 楽観的排他用、必須
}
```

レスポンス: 200 OK + 更新後の `SetupResponse`。

**設計判断**:

- `Steps` が `nil` の場合(レシピ変更なし)は `RecomputeSetupCache` を呼ばない(SUPP-001 §7.2、`internal/service/setup/update.go` 注記)
- `Steps` が変更あり(`&[]` 含む)の場合は `RecomputeSetupCache` を呼ぶ + VAL-S02 / S03 / S04 を再評価
- バージョン不一致は 409 Conflict、エラーコード `version_conflict`

#### 4.2.6 `DELETE /api/setups/{id}`(論理削除)

レスポンス: 204 No Content。

**実装**:

- `setups.deleted_at` に現在時刻を設定(論理削除)
- `DeleteSetupCache` を呼び出して recipe_cache を物理削除(SUPP-001 §7.5.6)
- `combo_setups` の関連エントリは **物理削除する**(setup が論理削除中の場合、紐付け表示の意味がないため。M4-02 のフロント側でも論理削除中の setup は表示しない方針)
- 設計判断の根拠: コンボ側 `DELETE /api/combos/{id}`(M2-03 実装)でも `combo_tags` は論理削除と連動して扱われる方針が確立されている(progress-log 確認)

ただし、`combo_setups` の物理削除には実装の選択肢がある:

- **案 P1(推奨)**: setup 論理削除時にサービス層で `combo_setups` の関連エントリを明示的に DELETE する
- **案 P2**: DB の ON DELETE CASCADE で連動削除(ただし `combo_setups` の親は setup の物理削除であり、論理削除では CASCADE が効かない)

**Plan Mode で開発者に方針確認すること**(本指示書では案 P1 を推奨とするが、§3.4.1 で `combo_setups` の ON DELETE CASCADE 状況を確認したうえで決定)。

#### 4.2.7 `GET /api/combos/{comboId}/setup-candidates`(FR011 候補取得、本指示書ではスタブ)

レスポンス: 200 OK + 空配列(本指示書ではスタブ実装)。

```json
{
  "items": []
}
```

**本指示書のスコープ**: エンドポイント定義・ルーティング・ハンドラ層の枠組みのみ実装。サービス層・リポジトリ層の候補抽出ロジックは M4-03 で実装。

**M4-03 着手時に補完される内容**: 同一キャラ + 同一 `knockdown_advantage` を持つ他コンボに紐付いている setup を候補として返す(DES-005 §5.6 item 9、FR011)。

### 4.3 サービス層実装

`internal/service/setup/service.go` および `internal/service/setup/validate.go` を新設。

#### 4.3.1 サービス層関数シグネチャ

```go
// CreateSetup は新規セットプレイを作成し、親コンボへの紐付けを行う。
// parentComboID == 0 の場合 VAL-S05 エラー(CHANGE-012、SUPP-001 §7.5.3)。
func CreateSetup(ctx context.Context, parentComboID int64, input CreateSetupInput) (*SetupResponse, error)

// CreateSetupLink は既存セットプレイをコンボに紐付ける。
func CreateSetupLink(ctx context.Context, parentComboID int64, setupID int64) error

// DeleteSetupLink は紐付けを解除する(setup 本体は残す)。
func DeleteSetupLink(ctx context.Context, parentComboID int64, setupID int64) error

// GetSetup は setup 詳細を取得する。
func GetSetup(ctx context.Context, setupID int64) (*SetupResponse, error)

// UpdateSetup は setup を編集する。Steps 変更時は RecomputeSetupCache を呼ぶ。
func UpdateSetup(ctx context.Context, setupID int64, input UpdateSetupInput) (*SetupResponse, error)

// DeleteSetup は setup を論理削除し、combo_setups エントリと recipe_cache を整理する。
func DeleteSetup(ctx context.Context, setupID int64) error

// GetSetupCandidates は FR011 転用候補を取得する(本指示書ではスタブ、M4-03 で本実装)。
func GetSetupCandidates(ctx context.Context, parentComboID int64) ([]Setup, error)
```

#### 4.3.2 VAL-S05 適用ロジック(CHANGE-012)

`CreateSetup` 関数冒頭で:

```go
if parentComboID == 0 {
    return nil, &model.ValidationError{
        Code:    "validation_failed",
        Message: "バリデーションエラーがあります",
        Issues: []model.ValidationIssue{
            {Field: "parentComboId", Message: "親コンボ ID は必須です(セットプレイは親コンボに紐付く形でのみ作成可能)"},
        },
    }
}
```

**実装注記**: エラー型は M3-05 で確立した `internal/validation/` パッケージの `ValidationResult` 型を利用する(DES-002 v1.7.0 §4.3 / CHANGE-011)。具体的な型構造は §3.4.4 で確認した既存実装に合わせて適合する。

**ハンドラ層での扱い**: ハンドラ層は URL パスから `comboId` を取得してサービス層に渡す。`comboId == 0` または不正な値の場合はハンドラ層で 400 を返す(VAL-S05 の前段でハンドラ層フィルタ、サービス層は念のための防御)。

#### 4.3.3 トランザクション境界(SUPP-001 §7.5.4)

`CreateSetup` のトランザクション境界:

1. トランザクション開始
2. VAL-S01〜S04 を実行(`validate.go` の関数群を呼ぶ)
3. `setups` テーブルへの INSERT
4. `setup_steps` テーブルへの INSERT(複数行、トランザクション内)
5. `combo_setups` テーブルへの INSERT(親コンボとの紐付け)
6. `RecomputeSetupCache(setupID)` を呼ぶ(notation サービス層、トランザクション内)
7. コミット

エラー発生時は全体ロールバック(SUPP-001 §7.5.4)。

`UpdateSetup` のトランザクション境界(レシピ変更時):

1. トランザクション開始
2. バージョン取得・楽観的排他チェック
3. VAL-S02 / S03 / S04 を実行(レシピ変更時のみ)
4. `setups` テーブルの UPDATE(name / description / version)
5. `setup_steps` の DELETE + 再 INSERT(レシピ変更時のみ)
6. `RecomputeSetupCache(setupID)` を呼ぶ(レシピ変更時のみ)
7. コミット

`DeleteSetup` のトランザクション境界:

1. トランザクション開始
2. `setups.deleted_at` を現在時刻に設定(論理削除)
3. `combo_setups` の関連エントリを物理削除(案 P1、§4.2.6 で確定)
4. `DeleteSetupCache(setupID)` を呼ぶ(SUPP-001 §7.5.6)
5. コミット

### 4.4 バリデーション層実装(VAL-S01〜S05)

`internal/service/setup/validate.go` に VAL-S01〜S05 のバリデーション関数を実装。

#### 4.4.1 関数シグネチャ

```go
// ValidateSetupCreate は新規作成時のバリデーションを実行する。
// VAL-S01〜S05 を網羅的にチェックする。
func ValidateSetupCreate(ctx context.Context, parentComboID int64, input CreateSetupInput) *model.ValidationResult

// ValidateSetupUpdate は更新時のバリデーションを実行する。
// VAL-S02 / S03 / S04 を実行(レシピ変更時のみ)。VAL-S01(character_id)は不変前提のため不要、VAL-S05 は新規作成のみ。
func ValidateSetupUpdate(ctx context.Context, setupID int64, input UpdateSetupInput) *model.ValidationResult
```

#### 4.4.2 VAL-S01〜S05 の実装内容

| VAL-ID | 検証内容 | 種類 | エラーコード | フィールド |
|--------|---------|------|-------------|----------|
| VAL-S01 | `characterId` が存在するキャラクターか | ERROR | `invalid_character_id` | `characterId` |
| VAL-S02 | レシピが空でないか(`Steps` の要素数 > 0) | ERROR | `recipe_required` | `steps` |
| VAL-S03 | レシピ中の `moveId` が該当キャラに存在する技か(各ステップで検証) | **WARNING** | `unknown_move_id` | `steps[N].moveId` |
| VAL-S04 | 同一キャラの同じ親コンボに、同一レシピのセットプレイが既に紐付いていないか(SUPP-001 §7.5.2、`combo_setups` を JOIN した SQL クエリ) | ERROR | `duplicate_setup` | (フィールド非依存、メッセージで明示) |
| VAL-S05 | parentComboID が 0 でないこと(CHANGE-012、SUPP-001 §7.5.3) | ERROR | `validation_failed`(他と同じくバリデーションエラー扱い) | `parentComboId` |

**注**: VAL-S03 は **WARNING**(DES-006 §3 で WARNING と定義)。実装では `ValidationResult.Issues` に追加するが、Severity フィールドで WARNING と区別する(M3-05 で確立した `ValidationResult` 構造に従う)。

#### 4.4.3 VAL-S04 重複判定の SQL クエリ(参考)

```sql
-- 同一キャラ + 同じ親コンボ + 同一レシピのセットプレイが存在するかチェック
SELECT s.id
FROM setups s
JOIN combo_setups cs ON cs.setup_id = s.id
WHERE cs.combo_id = ?  -- 親コンボ ID
  AND s.character_id = ?
  AND s.deleted_at IS NULL
  AND <レシピのハッシュまたは内部表現が一致>;
```

レシピ一致判定の実装は `combo` 側の重複判定(SUPP-001 §2.2)を参考にする。**内部表現(`setup_steps` の move_id + modifiers 列)で判定**(SUPP-001 §7.5.2)、recipe_cache の表示文字列は判定に使わない。

実装の詳細(レシピハッシュの計算方式、JOIN クエリの最適化等)は製造担当が `internal/service/combo/duplicate_keys.go` 等の既存実装を参考に判断する。

### 4.5 notation サービス層拡張(SUPP-001 §7.1 / §7.2 / §7.5、案 X)

`internal/service/notation/setup_resolver.go` を新設。

#### 4.5.1 新規関数 4 つ

```go
// ResolveSetupRecipe は指定 setup × プリセットの表示文字列を返す。
// recipe_cache に該当エントリが存在する場合はそれを返し、存在しない場合は計算・挿入して返す(SUPP-001 §7.1)。
func ResolveSetupRecipe(ctx context.Context, setupID int64, presetID int64) (string, error)

// RecomputeSetupCache は当該 setup の recipe_cache を全プリセット分 delete → insert する。
// セットプレイ新規登録・レシピ変更時に呼ぶ(SUPP-001 §7.2)。
func RecomputeSetupCache(ctx context.Context, setupID int64) error

// DeleteSetupCache は当該 setup の recipe_cache エントリを物理削除する。
// セットプレイ論理削除時に呼ぶ(SUPP-001 §7.5.6、コンボ側 DeleteComboCache と対称)。
func DeleteSetupCache(ctx context.Context, setupID int64) error

// ComputeSingleSetupCache は単一 setup × プリセットの計算ロジック(内部利用)。
func ComputeSingleSetupCache(ctx context.Context, setupID int64, presetID int64) (string, error)
```

#### 4.5.2 既存関数の拡張(`RecomputePresetCache` / `DeletePresetCache`)

`internal/service/notation/preset_resolver.go`(または相当)の既存関数を **コンボ + セットプレイ両方を対象に拡張**(SUPP-001 §7.1 注記、§7.5.5):

- `RecomputePresetCache(presetID)`: コンボ recipe_cache + セットプレイ recipe_cache の両方を再計算
- `DeletePresetCache(presetID)`: コンボ + セットプレイ両方の recipe_cache を削除

**実装方針**: 既存のコンボ recipe_cache 処理ループの後に、setup recipe_cache 処理ループを追加する(同一トランザクション内、SUPP-001 §7.5.4)。

#### 4.5.3 recipe_cache のテーブル構造との関係

現状の `recipe_cache` テーブル(M0-01 / M1-04 で実装済み想定)は `combo_id, preset_id, content_json` 構造と仮定。setup 用の cache をどう持つかは以下の選択肢:

- **案 R1(推奨)**: 既存 `recipe_cache` テーブルに `target_type ENUM('combo', 'setup')` カラムを追加 + `target_id INTEGER` で combo_id / setup_id を共有
- **案 R2**: `setups.recipe_cache JSON` カラム(DES-003 §3.11 既定義)に直接 JSON マップ形式で保存(`{"1": "立ち弱P > 弱波動拳", "2": ...}`)
- **案 R3**: 別テーブル `setup_recipe_cache(setup_id, preset_id, content_json)` を新設

DES-003 §3.11 で `setups.recipe_cache JSON` カラムが定義されている事実から、**案 R2 が設計書本体と最も整合する**(setup 自身のカラムにキャッシュを持つ)。本指示書は **案 R2 を採用** する。

**実装(案 R2)**:

- `RecomputeSetupCache(setupID)`: 全プリセット分の表示文字列を計算 → JSON マップ `{"1": "立ち弱P > ...", "2": ...}` を生成 → `setups.recipe_cache` カラムを UPDATE
- `ResolveSetupRecipe(setupID, presetID)`: `setups.recipe_cache` JSON をパース → 該当 presetID のエントリを返す。存在しない場合は `ComputeSingleSetupCache` で計算・JSON マップに追加 → カラム UPDATE
- `DeleteSetupCache(setupID)`: `setups.recipe_cache` を NULL に UPDATE(または setup 物理削除時はレコードごと消える)

**注**: コンボ側の `recipe_cache` テーブル構造は現行通り変更しない。setup 側は `setups.recipe_cache` カラム単独で完結する(案 R2)。

**Plan Mode で開発者に方針確認すること**: §3.4.1 で `setups.recipe_cache` カラムの存在を確認したうえで案 R2 を確定。`recipe_cache` テーブル構造が想定と異なる場合は Plan Mode で停止し開発者に報告。

### 4.6 コンボ作成 API の DTO 前方互換予約(M4-04 用)

`internal/api/combo/dto.go` の既存 `CreateComboRequest`(または相当の DTO)に以下のフィールドを **形だけ追加** する:

```go
import "encoding/json"

type CreateComboRequest struct {
    // ... 既存フィールド ...
    
    // Setups は M4-04 で実装予定のコンボ + セットプレイ同時登録用フィールド。
    // 本指示書(M4-01)では json.RawMessage で受信のみ・パースせず、存在時に slog.Warn を出力する。
    // M4-04 で `[]setup.CreateSetupInput` 相当の型に置換予定(M4-04 起票時に combo パッケージから
    // setup パッケージへの片方向 import を確定)。
    // 詳細は M4-overview v1.1.2 §3.5、本指示書 §4.6 を参照。
    Setups json.RawMessage `json:"setups,omitempty"`
}
```

**型選定の根拠(v1.0.1 で確定)**: 製造担当からの指摘(2026-05-16)で、当初案 `Setups []CreateSetupInput` は combo パッケージから setup パッケージを import する形となり循環 import の懸念が生じることが判明。3 案(`json.RawMessage` / 独立 struct 定義 / 共通 types パッケージ)から **`json.RawMessage` 案を採用** した:

- 「本指示書では一切処理しない」という設計意図と型表現が完全一致(playbook §4.5 フローの素直さ原則と整合)
- 標準ライブラリ完結で循環 import の余地なし
- M4-04 での型置換時の影響範囲が CreateComboRequest の 1 フィールド型変更のみ
- 独立 struct 案(combo/dto.go 内に CreateSetupInput を別定義)は M4-04 で 2 箇所統合のリファクタが必要、共通 types パッケージ案は 3 層分離(architecture-patterns.md §2)に反する

**実装の挙動(M4-01 時点)**:

- リクエストに `setups` フィールドが含まれていても、サービス層では **中身をパースせず無視する**(JSON マーシャリング自体は `json.RawMessage` で完了するが、内容を構造体として展開しない)
- 存在判定は `len(req.Setups) > 0` で行う(`nil` 比較ではない、JSON で `"setups": []` を送られた場合も「存在」扱いになる)
- 存在時に `slog.Warn` で警告ログを出力(下記実装例)、ただしエラー応答にはしない(`omitempty` 互換性維持)
- M3 までの既存フロント呼び出し(`setups` 未指定)は影響なし、`slog.Warn` も出力されない
- M4-04 着手時にサービス層でこのフィールドを処理する実装が追加される

**実装例**:

```go
import (
    "encoding/json"
    "log/slog"
)

// ハンドラ層またはサービス層の冒頭で:
if len(req.Setups) > 0 {
    slog.Warn("setups field received but not implemented yet (M4-04 scope)",
        "endpoint", "POST /api/combos",
        "setups_bytes", len(req.Setups))
}
// 以降の処理では req.Setups を一切参照しない
```

**ハンドラ層・サービス層の変更**: `internal/api/combo/handler.go` または `internal/service/combo/create.go`(または相当)のいずれかで上記の存在判定 + `slog.Warn` を 1 箇所だけ配置する。具体的な配置位置は Plan Mode で開発者に確認。同一リクエストで複数回 Warn が発火しないこと(1 リクエストにつき 1 回)。

**M4-04 引き継ぎ事項**: M4-04 担当の設計担当 Claude は、本ターン時点では「`json.RawMessage` から `[]setup.CreateSetupInput`(または相当の型)への型変更が必要」を起票時の必須事項として認識する。combo パッケージから setup パッケージへの片方向 import を確認・採用する(setup パッケージは combo パッケージを import しない設計を維持)。

### 4.7 ハンドラ層実装

`internal/api/setup/handler.go` を新設。各エンドポイント(§4.2)に対応するハンドラを実装する。

#### 4.7.1 ハンドラ層の共通方針(architecture-patterns.md §3)

- `model.APIErrorResponse` を **直接** 呼び出す(独自ヘルパを作らない、handover §4.4 L-03 / architecture-patterns.md §3)
- バリデーションエラーは `Details: map[string]any{"validations": result}` 形式(DES-002 v1.7.0 §4.3 / CHANGE-011)
- エラーコードは setup 系で **小文字スネークケース** に統一(handover §4.3 L-02 の方針、tag 系の混在を踏襲せず、setup 系で先に統一する)

#### 4.7.2 エラーレスポンス例

VAL-S05 違反時(`comboId` が URL パスに含まれない、または 0):

```go
return c.JSON(http.StatusBadRequest, model.APIErrorResponse{
    Error: model.APIError{
        Code:    "validation_failed",
        Message: "バリデーションエラーがあります",
        Details: map[string]any{
            "validations": map[string]any{
                "issues": []map[string]any{
                    {"field": "parentComboId", "message": "親コンボ ID は必須です(セットプレイは親コンボに紐付く形でのみ作成可能)"},
                },
            },
        },
    },
})
```

VAL-S04 違反時(重複):

```go
return c.JSON(http.StatusConflict, model.APIErrorResponse{
    Error: model.APIError{
        Code:    "duplicate_setup",
        Message: "同一レシピのセットプレイが既にこのコンボに紐付いています",
        Details: map[string]any{"existing_setup_id": existingID},
    },
})
```

バージョン不一致(`PATCH /api/setups/{id}`):

```go
return c.JSON(http.StatusConflict, model.APIErrorResponse{
    Error: model.APIError{
        Code:    "version_conflict",
        Message: "セットプレイが他で更新されています。最新版を取得してから再実行してください",
        Details: map[string]any{"current_version": currentVersion, "your_version": requestVersion},
    },
})
```

### 4.8 設計判断事項(本指示書で確定済み)

| 項目 | 確定内容 | 根拠 |
|------|---------|------|
| エンドポイント分離 | 新規作成 / 紐付け追加 / 紐付け解除を **別エンドポイント** で分離 | §4.2 設計判断、操作の意味的分離 |
| VAL-S05 適用層 | サービス層関数の引数レベル | SUPP-001 §7.5.3、CHANGE-012 §6.2 R-2 対策 |
| エラーコード命名 | setup 系は **小文字スネークケース** で統一 | handover §4.3 L-02 で M5 以降の統一方針予定、setup 系で先行 |
| 共通エラー型の使用 | `model.APIErrorResponse` を **直接** 呼び出し、独自ヘルパなし | architecture-patterns.md §3、handover §4.4 L-03 |
| setup recipe_cache 配置 | `setups.recipe_cache JSON` カラム(DES-003 §3.11 既定義、案 R2) | §4.5.3 設計判断 |
| 論理削除時の combo_setups | 案 P1: サービス層で明示的に物理削除 | §4.2.6 設計判断(Plan Mode で再確認) |
| `PATCH /api/setups/{id}` の Steps | `*[]SetupStepInput` で 3 状態区別 | SUPP-001 §5.9 PATCH 送信ポリシー |
| 楽観的排他 | `version` フィールド必須、不一致時 409 + `version_conflict` | DES-003 §3.11 |
| `GET /api/combos/{id}/setup-candidates` | 本指示書ではスタブ(空配列)、M4-03 で本実装 | M4-overview §3.4 |
| コンボ作成 API DTO 拡張 | `Setups json.RawMessage \`json:"setups,omitempty"\`` を形だけ予約、M4-01 では中身パースせず存在時 `slog.Warn` を出力 | §4.6(v1.0.1 で型を `[]CreateSetupInput` から `json.RawMessage` に変更、循環 import 回避)/ M4-overview §3.2 例外条項 |
| **SetupResponse の DTO 統一**(v1.0.2 で確定) | **新規作成・詳細取得・更新すべての setup レスポンスで共通の `SetupResponse` 型を使用、`ParentComboIDs []int64`(配列)を全レスポンスで返す** | §4.2.1 / §4.2.4(レビュー担当の中優先指摘 + M4-01 製造担当判断、DTO 共通化のため統一)|
| **`DeletedAt` / `SetupID` の API 非開示**(v1.0.2 で確定) | **`Setup.DeletedAt` および `SetupStep.SetupID` の JSON タグを `json:"-"` に統一**(combo 側既存パターン踏襲) | §4.1.1 / §4.1.2(レビュー担当指摘、永続化モデルは API レスポンスに直接出さない M3 までの確立運用)|

---

## 5. テスト要件

### 5.1 必須テスト

#### 5.1.1 サービス層テスト(必須、CLAUDE.md §5)

`internal/service/setup/service_test.go` に以下を含める:

- `CreateSetup`: 正常系(VAL すべて通過、setup + setup_steps + combo_setups の 3 件作成、recipe_cache 計算)
- `CreateSetup`: VAL-S01 違反(存在しない character_id)
- `CreateSetup`: VAL-S02 違反(Steps 空)
- `CreateSetup`: VAL-S04 違反(同一コンボに同一レシピ既存)
- **`CreateSetup`: VAL-S05 違反(parentComboID == 0)、`validation_failed` エラー応答確認**(CHANGE-012、最重要)
- `CreateSetupLink`: 既存 setup を別コンボに紐付け成功
- `DeleteSetupLink`: 紐付け解除後も setup 本体が残る
- `GetSetup`: 詳細取得(`parentComboIds` 配列で複数紐付け確認)
- `UpdateSetup`: メタデータのみ変更(Steps `nil` で recipe_cache 不変)
- `UpdateSetup`: レシピ変更(`RecomputeSetupCache` 呼び出し確認)
- `UpdateSetup`: バージョン不一致で 409
- `DeleteSetup`: 論理削除 + combo_setups 物理削除 + recipe_cache 削除
- `GetSetupCandidates`: スタブで空配列を返す

#### 5.1.2 バリデーション層テスト(必須)

`internal/service/setup/validate_test.go` に **VAL-S01〜S05 すべて** のテストケースを含める:

- VAL-S01: 存在しない character_id でエラー
- VAL-S02: Steps 空でエラー
- VAL-S03: 存在しない move_id で WARNING(エラーではない)
- VAL-S04: 同一コンボ + 同一レシピで ERROR
- **VAL-S05: parentComboID == 0 で ERROR**(CHANGE-012、最重要)

#### 5.1.3 notation サービス層テスト(必須)

`internal/service/notation/setup_resolver_test.go` に以下を含める:

- `ResolveSetupRecipe`: cache ヒット時の値返却
- `ResolveSetupRecipe`: cache ミス時の計算・カラム更新
- `RecomputeSetupCache`: 全プリセット分の JSON マップ生成・UPDATE
- `DeleteSetupCache`: recipe_cache カラムを NULL に
- `RecomputePresetCache` 拡張: コンボ + セットプレイ両方が再計算される
- `DeletePresetCache` 拡張: コンボ + セットプレイ両方が削除される

#### 5.1.4 ハンドラ層テスト(`httptest` 使用、CLAUDE.md §5)

`internal/api/setup/handler_test.go` に以下を含める:

- 各エンドポイント(§4.2)の正常系
- 主要異常系: VAL-S05(400 + `validation_failed`)、VAL-S04(409 + `duplicate_setup`)、404(存在しない setup_id / combo_id)、409(version_conflict)
- レスポンス DTO の JSON フィールド名が camelCase(`setupId`、`parentComboId` 等、CLAUDE.md §4)

#### 5.1.5 リポジトリ層テスト(複雑なクエリのみ、CLAUDE.md §5)

`internal/repository/setup/repository_test.go` に以下を含める:

- VAL-S04 重複判定クエリ(`combo_setups` を JOIN した SQL の正確性)
- `GetSetup` の詳細取得クエリ(setup + steps + combo_setups の同時取得)
- 複雑なフィルタ・JOIN がない単純な CRUD クエリはテスト不要(CLAUDE.md §5)

#### 5.1.6 ビルド・型チェック

- [ ] `make test` または `go test ./...` が全通過する
- [ ] `go build ./...` が成功する
- [ ] `go vet ./...` でエラーなし

### 5.2 E2E シナリオ(curl 検証、開発者の責任範囲)

製造担当 Claude Code は以下の curl コマンドを実装完了報告に貼付する(playbook §11、ターミナル環境のため curl は実行可能):

#### A. 正常系: セットプレイの作成・取得・更新・削除

1. コンボ作成(既存 API、M1-03 / M3-05)で親コンボ ID を取得
2. `POST /api/combos/{comboId}/setups` で setup 作成 → 200 + 作成された setup + defaultRecipe + `parentComboIds: [親コンボ ID]`(単一要素配列、v1.0.2 で統一)
3. `GET /api/setups/{setupId}` で詳細取得 → 200 + setup + steps + parentComboIds 配列
4. `PATCH /api/setups/{setupId}` で name 更新(Steps `nil`) → 200 + recipe_cache 不変確認
5. `PATCH /api/setups/{setupId}` で Steps 変更 → 200 + recipe_cache 更新確認
6. `DELETE /api/setups/{setupId}` で論理削除 → 204
7. `GET /api/setups/{setupId}` → 404(論理削除済み)

#### B. 異常系: VAL-S05 違反

1. URL パスに `comboId` を含めずに setup 作成を試みる(直接サービス層を叩く想定、テストコードで再現)→ `validation_failed` エラー

#### C. 異常系: VAL-S04 違反(重複)

1. 親コンボ A に setup X を作成
2. 同じ親コンボ A に同一レシピの setup Y を作成 → 409 + `duplicate_setup`
3. 別の親コンボ B に同一レシピの setup を作成 → 200(VAL-S04 は同一コンボ内のみ判定、FR011 転用支援の前提)

#### D. 紐付け操作

1. 親コンボ A に setup X を作成
2. `POST /api/combos/{B}/setup-links` で setup X を別コンボ B にも紐付け → 200
3. `GET /api/setups/{X}` → `parentComboIds: [A, B]`
4. `DELETE /api/combos/{B}/setup-links/{X}` → 204
5. `GET /api/setups/{X}` → `parentComboIds: [A]`

#### E. notation 連動

1. setup X を作成 → recipe_cache が `{"1": "立ち弱P > ..."}` 形式で生成
2. プリセット 1 のエイリアスを編集(既存 API、M1-04)→ setup X の recipe_cache が再計算される
3. プリセット 2 のエイリアスを新規追加 → setup X の recipe_cache に preset 2 のエントリが追加

#### F. M3 まで API の回帰確認(setups 形予約の前方互換確認、v1.0.1 で詳細化)

setups フィールドの 3 パターン受信テスト(`json.RawMessage` 採用版、§4.6):

1. **`POST /api/combos`(setups フィールド未指定)** → 200(M3 までの完全互換、`slog.Warn` 出力なし)
2. **`POST /api/combos`(`"setups": []` 空配列指定)** → 200(setups は無視されコンボのみ作成、`slog.Warn` 1 回出力、`setups_bytes` は空配列の JSON バイト数)
3. **`POST /api/combos`(`"setups": [{...}]` 1 件以上指定)** → 200(setups は無視されコンボのみ作成、`slog.Warn` 1 回出力、`setups_bytes` は配列全体の JSON バイト数)
4. 上記 3 パターンとも、レスポンスの形・コンボ作成の成功状態が M3 完了時と完全に同一であることを確認
5. M3-05 統合 E2E シナリオを再度通して回帰なし確認

---

## 6. レビュー観点(別ファイル参照)

機械レビューは別ファイル `docs/instructions/reviews/M4-01-review-checklist.md` に従う。製造担当 Claude Code は本ファイルを読む必要はない。

---

## 7. 完了条件(Definition of Done)

### 7.1 機能要件

- [ ] §2.1 のファイル一覧がすべて作成されている(setup 3 層 + notation setup_resolver + model/setup.go)
- [ ] §2.2 のファイル修正が実施されている(combo dto.go の Setups 形予約、router、preset_resolver 拡張)
- [ ] §3.4 着手前確認の結果(特に §3.4.1 / §3.4.5)が実装完了報告に含まれている
- [ ] §4.2 の 7 エンドポイントすべてが動作する(`GET /api/combos/{id}/setup-candidates` はスタブで空配列)
- [ ] **VAL-S05 がサービス層関数の引数レベルで適用されている**(CHANGE-012 / SUPP-001 §7.5.3、最重要)
- [ ] notation サービス層のセットプレイ向け 4 関数(`ResolveSetupRecipe / RecomputeSetupCache / DeleteSetupCache / ComputeSingleSetupCache`)が動作する
- [ ] `RecomputePresetCache` / `DeletePresetCache` がコンボ + セットプレイ両方を対象に拡張されている
- [ ] §4.6 コンボ作成 API DTO に `Setups` フィールドが形だけ追加されている(本実装は M4-04)
- [ ] §5.2 E2E シナリオ A〜F がすべて通過する

### 7.2 自己テスト結果(製造担当の責任範囲)

**バックエンド側**:

- [ ] `make test` または `go test ./...` が全通過する(setup 系の新規テスト含む、既存テストも回帰なし、特に M3 完了状態のテストが全通過)
- [ ] 主要 API を `curl` で叩き、レスポンスを報告書に貼付する(§5.2 E2E シナリオ A〜F の curl 出力)
- [ ] エラーケース(400 / 404 / 409)を `curl` で再現し、レスポンスを報告書に貼付する(VAL-S05、VAL-S04、version_conflict)
- [ ] **§5.2 シナリオ F(M3 まで API 回帰確認)を必ず実施**(コンボ作成 API の前方互換が壊れていないこと)
- [ ] データ整合性: setup 作成後に `GET /api/setups/{id}` で取り直し、入力と一致することを確認
- [ ] §3.4.1〜§3.4.5 着手前確認の出力を含める

**フロントエンド側**:

- 該当なし(本指示書はバックエンドのみ)

ブラウザでの実機動作確認は **開発者の責任範囲**(playbook §14)、本指示書はバックエンド API までを完成させる。

### 7.3 品質チェック

- [ ] CLAUDE.md の禁止事項に抵触していない(§10、設計書に記載のない機能を追加していない)
- [ ] **JSON タグ・API DTO 型が camelCase で統一されている**(CLAUDE.md §4、`setupId` / `stepOrder` / `parentComboIds` 等、リクエスト DTO の VAL-S05 フィールド名 `parentComboId` 単数も camelCase)
- [ ] **エラーコードが小文字スネークケースで統一されている**(handover §4.3 L-02 方針、`duplicate_setup` / `version_conflict` / `validation_failed` / `unknown_move_id`)
- [ ] **`model.APIErrorResponse` を直接呼び出している**(独自ヘルパを作らない、architecture-patterns.md §3)
- [ ] **VAL-S05 がサービス層関数の引数レベルで適用されている**(CHANGE-012、最重要)
- [ ] `console.log` / `fmt.Println` を本番コードに残していない(CLAUDE.md §10、`log.Warn` / `log/slog` の使用は許容)
- [ ] 設計書本体(DES-002 v1.7.0 §4.3、DES-003 §3.11〜§3.13、DES-006 v1.9.0 §3、SUPP-001 §7.1 / §7.2 / §7.5)と実装が一致している
- [ ] **playbook §4.5 フローの素直さ原則に抵触していない**(VAL-S04 重複判定が「エラー駆動再試行」になっていない、サービス層内で一度の SQL JOIN で判定)
- [ ] **playbook §4.7 全ハンドラ列挙原則の確認**: 新規エラー型(`duplicate_setup`、`version_conflict` 等)を導入したが、これらは setup 系内部のみで発火するため、全ハンドラ列挙の対象は setup ハンドラ内に閉じる
- [ ] **shadcn/ui を使用していない**(本指示書はバックエンドのみで対象外、playbook §4.6)
- [ ] バックエンド 3 層(handler / service / repository)が正しく分離されている(architecture-patterns.md §2)

### 7.4 ドキュメント

- [ ] `docs/progress/progress-log.md` に M4-01 完了報告を追記する
- [ ] **CHANGE-012 / VAL-S05 のサービス層適用** が完了した事実を明記(設計担当の指示書設計が CHANGE-012 §6.2 R-2 対策どおりに実装された確認)
- [ ] **SUPP-001 §7.5 の setup 向け recipe_cache 責務がコードに反映された** ことを明記
- [ ] §3.4 着手前確認結果を含める(全 6 項目、特に §3.4.1 DDL 確認 / §3.4.5 トランザクション扱い確認)
- [ ] 設計判断事項表(§4.8)の各項目が指示書通りに実装された旨を明記

### 7.5 完了報告

- [ ] 開発者に「M4-01 が完了しました」と報告
- [ ] §7.1〜§7.4 の自己テスト結果を報告書に含める
- [ ] M4-02 着手の前提条件が整ったことを宣言(setup API が動作する状態でフロント実装に進める)

---

## 8. 参照ドキュメント

| ID / ファイル | 関連節 |
|--------------|--------|
| CLAUDE.md | §4 コーディング規約、§5 テスト規約、§10 禁止事項 |
| **SUPP-001 v1.13.0** | **§7.1 公開関数表(setup 系 4 関数)、§7.2 呼出元の責務、§7.5(全節)セットプレイ用 recipe_cache の責務** |
| DES-002 v1.7.0 | §4.3 エラーレスポンス共通 Go 型、`details.validations` 構造 |
| DES-003 | §3.11 setups、§3.12 setup_steps、§3.13 combo_setups、§4 インデックス |
| **DES-006 v1.9.0** | **§3 VAL-S01〜S05(CHANGE-012 反映)** |
| architecture-patterns.md v1.0.0 | §2 バックエンド 3 層パターン、§3 エラーレスポンス共通型 |
| M4-overview v1.1.2 | §3.2 M4-01 詳細、§4 実行順序、§7 モデル配分 |
| CHANGE-012 通知書 | VAL-S05 追加、§6.2 R-2 対策(本指示書 §4.3.2 の根拠) |
| M1-03 指示書 | コンボ系 3 層パターンの実装例(参考) |
| M3-05 指示書 §4.5 | `model.APIError` / `APIErrorResponse` 共通型(参考) |
| playbook v1.6.0 | §4.5 フローの素直さ原則、§4.7 全ハンドラ列挙、§5 設計書節への行レベル参照 |

---

## 9. 注意事項・判断に迷ったら

### 9.1 推測で進めてはいけない事項

以下は推測で進めず、Plan Mode で開発者に確認する:

- §3.4.1 で setups / setup_steps / combo_setups テーブル DDL が想定と大きく異なる場合(マイグレーション追加の要否、本指示書はマイグレーション新規追加禁止のため CHANGE 通知書相当の判断が必要)
- §3.4.2 で notation サービス層の既存関数シグネチャが想定と大きく異なる場合
- §4.2.6 で `combo_setups` の ON DELETE CASCADE 挙動が想定と異なる場合(案 P1 / P2 の選択)
- §4.5.3 で `recipe_cache` テーブル構造が案 R1 / R2 / R3 のいずれとも一致しない場合
- §4.6 でコンボ作成 API の既存 DTO 構造が想定と大きく異なる場合(`Setups` フィールド追加位置の判断)
- VAL-S04 重複判定の SQL クエリで M2-02 確立の `DuplicateCheckKeys` パターン(SUPP-001 §2.2)を setup 側に適用する具体方法(レシピハッシュの計算方式の選択)

### 9.2 推測で進めてよい事項(その旨を明示)

以下は推測で進めてよいが、実装時に「推測:〜と仮定した」とコード内コメントまたは完了報告に明示する:

- エラーメッセージの細部文言(「親コンボ ID は必須です」等の和文表現)
- ログ出力のフォーマット(`log.Warn` の引数構造)
- テストケース名の細部
- リポジトリ層内部のヘルパ関数名

### 9.3 不明事項発見時の対応

- 設計書本体(DES-002 v1.7.0、DES-003、DES-006 v1.9.0)と本指示書の記述が乖離している場合 → 実装を止めて開発者に報告し、CHANGE 通知書起票要否を協議する
- SUPP-001 §7.5 と本指示書の記述が乖離している場合 → 同じく Plan Mode で報告(SUPP-001 改訂は CHANGE 通知書不要、本指示書側を修正する)
- 本指示書の §4 詳細仕様で具体化されていない実装判断が必要になった場合 → §9.2 の範囲なら推測で進めて明示、それ以外は Plan Mode で開発者確認

### 9.4 Plan Mode で計画提示時に含めるべき項目

Plan Mode 必須(playbook §8.1)、以下を計画に含める:

- §3.4 着手前確認の結果(全 6 項目)
- §4.2 エンドポイント設計の最終確認(特に紐付け追加・解除を別エンドポイントにする方針)
- §4.5.3 案 R2(`setups.recipe_cache` カラム活用)の確認結果
- §4.2.6 案 P1(combo_setups の論理削除時物理削除)の確認結果
- VAL-S05 サービス層引数レベル適用の実装方針(CHANGE-012 §6.2 R-2 対策)
- §4.6 コンボ作成 API DTO の `Setups` フィールド追加位置と無視ロジック
- ファイル分割方針(setup 3 層の各ファイルサイズ、テストファイルの分割)
- 既存ロジック再利用範囲(notation サービス層、`model.APIErrorResponse`)
- E2E シナリオの実行可能性(`§5.2 シナリオ A〜F` のうち事前 seed が必要な箇所)

---

## 10. 完了後の次ステップ

M4-01 完了後、開発者が動作確認・承認したら **M4-02(セットプレイ単体 UI + コンボ詳細展開 + 紐付け操作 UI)** に進む。

M4-02 着手時の前提条件:

- setup CRUD API が動作している(本指示書で実装)
- `GET /api/combos/{id}/setup-candidates` の API 形が確定している(M4-03 で挙動仕上げ予定)
- コンボ作成 API の DTO に `Setups` フィールドが予約済み(M4-04 で本実装)
- VAL-S05 がサービス層で守られているため、フロント側は安心して `POST /api/combos/{comboId}/setups` を呼べる(親コンボ ID 必須が API 仕様で担保)

---

*以上*

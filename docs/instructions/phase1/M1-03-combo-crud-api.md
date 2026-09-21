# 指示書 M1-03: コンボCRUD APIとサービス層

| 項目 | 内容 |
|------|------|
| 指示書ID | M1-03 |
| バージョン | 1.4.0 |
| 対象マイルストーン | M1(コア基盤) |
| 推奨モデル | **Opus 4.7** |
| Plan Mode | **必須** |
| 機械レビュー | **必須**(別チェックリスト: `docs/instructions/reviews/M1-03-review-checklist.md`) |
| 並列性 | **単独**(M1-04〜M1-07が依存) |
| 依存指示書 | M1-01、M1-02 |
| 想定所要時間 | 120〜150分 |
| 作成者 | 詳細設計・製造準備担当Claude |
| 作成日 | 2026-04-29 |

## 更新履歴

| バージョン | 更新日 | 更新内容 |
|-----------|--------|----------|
| 1.0.0 | 2026-04-29 | 初版作成 |
| 1.1.0 | 2026-04-29 | 開発者レビュー反映: §6 のレビュー観点を別ファイル(`docs/instructions/reviews/M1-03-review-checklist.md`)に分離。§3 前提条件に `M1-overview.md` 必読を追加 |
| 1.2.0 | 2026-04-30 | M1-02 製造担当との設計判断確認結果を反映。§4.3 recipe_hash アルゴリズムで「Modifiers が型付き struct のため map のキー順非保証問題は発生しない、Flags のソートのみ必要」と明確化。§4.7 DTO で `Modifiers map[string]interface{}` を `*model.Modifiers` 型に統一、起き攻めBOOLEAN6カラムを M1-02 確定済みの正確なカラム名で全列挙(NULL許容のため `*bool`)。§4.11 を新設して集約モデル運用規約(N+1防止策、Steps の nil=未ロード規約、godoc 明記、Modifiers DB読み書き2案)を明文化 |
| 1.3.0 | 2026-04-30 | CHANGE-006 反映: §4.1 PUT 説明、§4.3 DuplicateCheckFields リスト、§4.7 DTO の `counter_type`/`CounterType`/`counterType` を `hit_type`/`HitType`/`hitType` にリネーム。取り得る値は当面 `normal`/`counter`/`punish_counter` の3種維持 |
| 1.4.0 | 2026-04-30 | M1-03 実装中の製造担当質問への回答3件を反映。(1) §4.2 バリデーション表を全面修正: DES-006 §2.1(VAL-C)と §2.2(VAL-D)の分離設計に整合、本登録時は VAL-C01〜VAL-C12 全適用、仮登録時は VAL-D01〜VAL-D03 のみ適用(VAL-C シリーズは原則すべてスキップ)。VAL-C02 重複判定の対象を `is_draft=false AND deleted_at IS NULL` の本登録コンボのみに明示。(2) §4.3.1 を新設: recipe_hash は DB に保存せず on-the-fly 計算とする方針を明記、SUPP-001 §2.2 解釈と整合。(3) §4.7 DTO から `Name *string` フィールド削除: DES-003 §3.4 に combos.name カラムが存在しない事実を反映、コンボ識別はキャラ+レシピ+状況、ニックネーム用途は memo で代用と明記。§5 テスト要件も VAL-C/VAL-D 分離前提に更新 |

---

## 1. 背景と目的

### 背景

M1-02 で DB スキーマと初期データが整った。M1-03 では**コンボの CRUD API とサービス層・リポジトリ層**を実装する。これは M1 の中核実装で、後続全指示書(M1-04 プリセット解決、M1-05 一覧画面、M1-06 登録画面)が依存する。

### 目的

- **コンボのCRUD APIエンドポイント**(POST/GET/GET-list/PATCH/PUT/DELETE)を実装
- **サービス層**でビジネスロジック(重複判定、編集方式分離、論理削除、楽観的排他)を集約
- **リポジトリ層**でSQLクエリを集約
- **バリデーション**(VAL-C01〜VAL-C12)をサービス層で実装
- **本登録/仮登録の分岐ロジック**(SUPP-001 §2.1)を実装

### このマイルストーンで作らないもの

- recipe_cache の計算(M1-04でnotation サービスとして実装)
- セットプレイ関連API(M4)
- タグ関連API(M3)
- ユーザー関連API(M6)
- フロント実装(M1-05、M1-06)

---

## 2. 成果物

### 2.1 作成するファイル

```
combomgr/
├── internal/
│   ├── api/
│   │   └── combo/
│   │       ├── handler.go                # ハンドラ実装
│   │       ├── handler_test.go           # httptest によるテスト
│   │       ├── dto.go                    # API リクエスト・レスポンス DTO
│   │       └── routes.go                 # ルート登録ヘルパ
│   ├── service/
│   │   ├── combo/
│   │   │   ├── service.go                # サービスインタフェースと実装
│   │   │   ├── service_test.go           # サービス層テスト(必須、網羅的)
│   │   │   ├── duplicate_keys.go         # 重複判定キー定義(SUPP-001 §2.2)
│   │   │   └── edit_split.go             # 編集方式分離ロジック
│   │   └── validation/
│   │       ├── combo.go                  # VAL-C01〜VAL-C12 実装
│   │       ├── combo_test.go             # バリデーションテスト
│   │       ├── result.go                 # ValidationResult 型
│   │       └── doc.go
│   └── repository/
│       └── combo/
│           ├── repository.go             # リポジトリ実装
│           ├── repository_test.go        # 主要クエリのテスト
│           └── queries.go                # 複雑なクエリの定数定義
└── cmd/combomgr/
    └── main.go                           # M1-02から修正(コンボルート登録、DI)
```

### 2.2 修正するファイル

- `cmd/combomgr/main.go`: 各レイヤーのDI(Dependency Injection)、コンボルート登録

### 2.3 変更しないもの

- M1-01、M1-02 で作成したファイル(設定読込、ロギング、netutil、マイグレーション、モデル等)

---

## 3. 前提条件

### 必読ドキュメント

- `CLAUDE.md`
- `docs/instructions/M1-overview.md`(M1サブマイルストーン全体マップ、依存関係)
- `docs/design/03-data-model.md`
  - **§3.4** combos テーブル(全カラム)
  - **§3.5** combo_steps テーブル
  - **§3.13** combo_setups テーブル(セットプレイ引き継ぎロジックで参照)
- `docs/design/06-validation.md`
  - **§1** 方針
  - **§2** コンボ登録時のバリデーション(全VAL-C01〜VAL-C12)
  - **§11** エラー・警告の表示方針
- `docs/design/supp-001-detailed-design.md`
  - **§2.1** 仮登録のNULL許容ルール(本指示書の中核)
  - **§2.2** 重複判定の完全一致ルール(本指示書の中核)
  - **§2.3** recipe_cacheサービス層責務(M1-04との境界明示)
  - **§5.1** moves参照方式
  - **§5.5** テスト最低ライン
- `docs/handover/handover_1.md` の **§3.1 コンボの編集方式**(編集方式分離の根拠)

### 任意参照

- `docs/design/02-architecture.md` §4(API設計方針)、§6.4(同時実行制御)

### 参照不要

- DES-004(M1-04で扱う)、DES-005(M1-05、M1-06で扱う)

---

## 4. 詳細仕様

### 4.1 API エンドポイント

| メソッド | パス | 用途 | バリデーション |
|---------|------|------|---------------|
| POST   | `/api/combos` | 新規コンボ登録 | VAL-C01〜VAL-C12 |
| GET    | `/api/combos/:id` | コンボ取得 | 存在チェックのみ |
| GET    | `/api/combos` | コンボ一覧 | フィルタクエリパラメータ |
| PATCH  | `/api/combos/:id` | メタデータ編集 | 軽量バリデーション |
| PUT    | `/api/combos/:id` | キー変更編集(旧削除→新作成) | VAL-C01〜VAL-C12 |
| DELETE | `/api/combos/:id` | 論理削除 | 存在チェック |
| POST   | `/api/combos/:id/restore` | ゴミ箱から復元 | 存在チェック |

**重要設計判断: PATCH と PUT の使い分け**

SUPP-001 §3.1 および HANDOVER-001 §3.1 に基づき、編集を2方式に分離する:

- **PATCH**(メタデータ編集): タグ、メモ、ダメージ等を直接更新
- **PUT**(キー変更編集): レシピ・始動技・position・opponent_stance・hit_type・opponent_size 変更時。**旧コンボを論理削除→新コンボを登録**(トランザクション内で実行)、紐付くセットプレイは新コンボに自動引き継ぎ

**サービス層が「何が変更されたか」を判定して自動で適切な方式を選ぶ実装は、M1-03ではPATCH/PUTでクライアント側に明示的に分担させる方式とする**(API としては明確になり、後続のフロントが扱いやすい)。

### 4.2 バリデーション実装(`internal/service/validation/combo.go`)

DES-006 §2 のバリデーション仕様を実装。**本登録(VAL-C シリーズ)と仮登録(VAL-D シリーズ)を明確に分離した実装が必須**。

#### 4.2.1 本登録時(is_draft=false)のバリデーション

DES-006 §2.1 の VAL-C01〜VAL-C12 を全適用する:

| ID | 内容 | 結果種別 |
|----|------|---------|
| VAL-C01 | character_id が存在 | ERROR |
| VAL-C02 | 重複判定(同一キャラ・同一レシピ・同一状況の本登録コンボが既存) | ERROR |
| VAL-C03 | starter_move_id がレシピ1ステップ目と一致 | WARNING |
| VAL-C04 | drive_available_at_start が 0〜6 | ERROR |
| VAL-C05 | sa_available_at_start が 0〜3 | ERROR |
| VAL-C06 | ドライブゲージ消費合計 vs drive_available_at_start | WARNING |
| VAL-C07 | SAゲージ消費合計 vs sa_available_at_start | WARNING |
| VAL-C08 | 各ステップの move_id がキャラに存在 | WARNING |
| VAL-C09 | レシピが空でない | ERROR |
| VAL-C10 | knockdown_advantage が -600〜+600 | WARNING |
| VAL-C11 | 起き攻めBOOLEANの整合性 | WARNING |
| VAL-C12 | ラッシュ版moveの original_move_id 検証 | ERROR |

VAL-C02(重複判定)の対象範囲: `is_draft = false AND deleted_at IS NULL` の既存コンボのみ(DES-006 §2.3)。仮登録コンボ・論理削除済みコンボとは重複判定しない。

#### 4.2.2 仮登録時(is_draft=true)のバリデーション

DES-006 §2.2 の VAL-D01〜VAL-D03 のみ適用する。**VAL-C シリーズは原則すべてスキップ**(VAL-C09 等の個別スキップではなく、「VAL-C は仮登録時に走らない」が正しい設計)。

| ID | 内容 | 結果種別 |
|----|------|---------|
| VAL-D01 | character_id が存在するキャラクターか | ERROR |
| VAL-D02 | レシピ中の move_id は指定されていれば存在検証、未指定(NULL)は許容 | WARNING |
| VAL-D03 | drive_available_at_start / sa_available_at_start は範囲チェックのみ(未入力NULLは許容) | ERROR |

仮登録は「うろ覚えや机上アイデア」の記録が目的のため(FR009、FR305)、本登録の厳格なバリデーションは適用しない。**重複判定もスキップ**(DES-006 §2.3、「仮登録は試案、本登録と被っても問題ない」)。

#### 4.2.3 実装上の注意

サービス層では `isDraft` フラグで分岐する:

```go
func ValidateCombo(ctx context.Context, combo *model.Combo, isDraft bool, deps Dependencies) ValidationResult {
    if isDraft {
        return validateDraft(ctx, combo, deps)  // VAL-D01〜D03 のみ
    }
    return validatePublished(ctx, combo, deps)  // VAL-C01〜C12 全適用
}
```

**重複判定(VAL-C02)は本登録時のみ呼ばれる**ため、仮登録 Create 時は recipe_hash 計算も発生しない(パフォーマンス上の利点)。

#### ValidationResult 型(`internal/service/validation/result.go`)

```go
type Severity string

const (
    SeverityError   Severity = "error"
    SeverityWarning Severity = "warning"
)

type ValidationIssue struct {
    Code     string   `json:"code"`     // "VAL-C01" / "VAL-D01" など
    Severity Severity `json:"severity"` // "error" or "warning"
    Field    string   `json:"field"`    // 該当フィールド名(任意)
    Message  string   `json:"message"`  // 表示メッセージ
}

type ValidationResult struct {
    Issues []ValidationIssue `json:"issues"`
}

func (r *ValidationResult) HasError() bool { /* Severity==error が1つでもあれば true */ }
func (r *ValidationResult) HasWarning() bool { /* Severity==warning が1つでもあれば true */ }
func (r *ValidationResult) Add(issue ValidationIssue) { /* ... */ }
```

#### バリデーション関数

```go
// ValidateComboForCreate は本登録/仮登録両方のバリデーションを実施
// isDraft フラグで挙動を切り替える(DES-006 §2.1 / §2.2)
//   - isDraft=false: VAL-C01〜VAL-C12 全適用(§4.2.1)
//   - isDraft=true:  VAL-D01〜VAL-D03 のみ(§4.2.2)
func ValidateComboForCreate(ctx context.Context, combo *model.Combo, steps []model.ComboStep, isDraft bool, deps Dependencies) ValidationResult { ... }

type Dependencies struct {
    CharacterRepo  CharacterRepository  // VAL-C01 / VAL-D01 用
    MoveRepo       MoveRepository       // VAL-C08 / VAL-C12 / VAL-D02 用
    ComboRepo      ComboRepository      // VAL-C02 用(本登録時のみ)
}
```

### 4.3 重複判定ロジック(`internal/service/combo/duplicate_keys.go`)

**SUPP-001 §2.2 に従って、重複判定キーをリスト定数として定義する。** 将来「modifiers を比較から外す」等の変更が1箇所の修正で済むようにする。

```go
package combo

// DuplicateCheckFields は重複判定で比較するフィールド一覧
// 将来的にこのリストを変更することで、判定ロジック全体を切り替え可能
var DuplicateCheckFields = []string{
    "character_id",
    "recipe_hash",       // combo_steps の (move_id, modifiers) シーケンスから計算
    "starter_move_id",
    "position",
    "opponent_stance",
    "hit_type",
    "opponent_size",
}

// CalcRecipeHash は combo_steps のレシピを正規化してハッシュ化する
// modifiers (型付き Modifiers struct) も含めた完全一致判定用(SUPP-001 §2.2、§3.3.0)
// SHA-256 のhex文字列を返す
func CalcRecipeHash(steps []model.ComboStep) string { ... }
```

**recipe_hash のアルゴリズム:**
1. ステップを step_order 昇順にソート
2. 各ステップを `<move_id_or_null>:<canonical_modifiers_json>` の形式に文字列化
3. それらを `\n` で連結
4. SHA-256 ハッシュを計算してhex文字列を返す

**canonical_modifiers_json の生成:** `Modifiers` は型付き struct(SUPP-001 §3.3.0)で、Go の `encoding/json` がフィールド宣言順で出力するため、**`json.Marshal(modifiers)` をそのまま使えば決定論的**な JSON が得られる。`map[string]interface{}` のキー順非保証問題は発生しないため、追加の正規化(キーソート等)は不要。

**ただし** `Flags []string` の中身については順序が出力に影響するため、ハッシュ計算前に `sort.Strings(modifiers.Flags)` で正規化すること。

#### 4.3.1 recipe_hash の保存方式

**recipe_hash は DB に保存せず、重複判定時に都度計算する(on-the-fly 計算)。**

- SUPP-001 §2.2 で「サービス層のランタイム計算値」と明記済み(M1-02 製造担当 Q4 確認・承認済み)
- combos テーブルに `recipe_hash` カラムは**存在しない**(DES-003 §3.4)
- 重複判定の都度、入力 steps から `CalcRecipeHash()` で計算し、既存コンボの steps からも計算してハッシュ比較する

**重複判定の実装フロー:**

1. リポジトリ層 `FindByDuplicateKeys` で `character_id`、`starter_move_id`、`position`、`opponent_stance`、`hit_type`、`opponent_size` の一致条件で**候補コンボを絞り込み**(combos テーブル単独 SELECT)
2. 候補ごとに `combo_steps` をロードして `CalcRecipeHash()` でハッシュ計算
3. 入力の hash と各候補の hash を Go 側で比較し、一致するものを「重複」と判定

**パフォーマンス上の考慮:** SF6 のキャラ別+同一状況のコンボ数は通常数十件以下のため、候補絞り込み後のハッシュ比較は十分高速。M1 規模(数百〜数千コンボ)では問題なし。将来的に大規模化(数万件規模)した場合に、`recipe_hash` カラム追加(CHANGE 起票)による高速化を検討する余地はあるが、フェーズ1では不要。

**recipe_cache(combos.recipe_cache カラム)との混同注意:** recipe_hash は重複判定用、recipe_cache はプリセット別表示文字列用。別の責務であり、recipe_cache JSON に recipe_hash を埋め込むような設計は採用しない(責務混在のため)。

### 4.4 サービス層 (`internal/service/combo/service.go`)

```go
type Service interface {
    Create(ctx context.Context, input CreateInput) (*model.Combo, ValidationResult, error)
    Get(ctx context.Context, id int64) (*model.Combo, error)
    List(ctx context.Context, filter ListFilter) ([]*model.Combo, error)
    UpdateMetadata(ctx context.Context, id int64, input UpdateMetadataInput) (*model.Combo, ValidationResult, error)
    UpdateWithKeyChange(ctx context.Context, id int64, input CreateInput) (*model.Combo, ValidationResult, error)
    Delete(ctx context.Context, id int64) error
    Restore(ctx context.Context, id int64) error
}
```

#### Create の実装方針

```go
func (s *service) Create(ctx context.Context, input CreateInput) (*model.Combo, ValidationResult, error) {
    // 1. バリデーション実行
    result := validation.ValidateComboForCreate(ctx, &combo, steps, input.IsDraft, deps)
    if result.HasError() {
        return nil, result, nil  // エラーありでも error は返さない(API応答で 400 を返すため)
    }

    // 2. トランザクション開始
    tx, err := s.db.BeginTx(ctx, nil)
    defer tx.Rollback()

    // 3. recipe_hash 計算
    hash := CalcRecipeHash(steps)

    // 4. INSERT INTO combos
    // 5. INSERT INTO combo_steps
    // 6. recipe_hash を combos に保存(別カラムを追加するか、recipe_cache JSONに含めるかは実装判断)

    // 7. コミット
    return combo, result, nil
}
```

#### UpdateWithKeyChange(キー変更編集)の実装方針

HANDOVER-001 §3.1 のとおり「旧コンボを論理削除→新コンボを登録、紐付くセットプレイは自動引き継ぎ」。

```go
func (s *service) UpdateWithKeyChange(ctx context.Context, id int64, input CreateInput) (*model.Combo, ValidationResult, error) {
    // トランザクション内で以下を実施:
    // 1. 既存コンボの version をチェック(楽観的排他、後述4.5)
    // 2. 既存コンボを論理削除(deleted_at = now())
    // 3. 新コンボを INSERT
    // 4. combo_setups テーブルで旧コンボIDを新コンボIDに付け替え
    //    (旧コンボに紐付いていたセットプレイを新コンボに引き継ぎ)
    // 5. recipe_cache の旧コンボ分削除、新コンボ分は M1-04 のサービスを呼ぶ(M1-03ではTODO)

    // recipe_cache 再計算は M1-04 で実装される notation サービスを呼ぶ
    // M1-03 段階では TODO コメントを付けて、recipe_cache 関連の処理を空実装にしておく
}
```

**M1-04 との境界:**
- M1-03 では recipe_cache の **計算・更新ロジックは実装しない**
- ただし「呼び出し箇所」は明示的に TODO コメントで残す
- M1-04 で notation サービスが完成次第、TODO 箇所を埋める

### 4.5 楽観的排他制御

DES-002 NFR203 と DES-003 §3.4 の `version` カラムを使用。

```go
// UPDATE 時に version を比較して、不一致ならエラー
UPDATE combos
   SET ..., version = version + 1, updated_at = datetime('now')
 WHERE id = ?
   AND version = ?  -- クライアントが持っているバージョン
```

UPDATE の RowsAffected が 0 の場合、`ErrConflict`(409 Conflict 相当)を返す。

### 4.6 リポジトリ層(`internal/repository/combo/repository.go`)

```go
type Repository interface {
    InsertCombo(ctx context.Context, tx *sql.Tx, combo *model.Combo) (int64, error)
    InsertSteps(ctx context.Context, tx *sql.Tx, comboID int64, steps []model.ComboStep) error

    FindByID(ctx context.Context, id int64) (*model.Combo, []*model.ComboStep, error)
    List(ctx context.Context, filter ListFilter) ([]*model.Combo, error)

    UpdateMetadata(ctx context.Context, tx *sql.Tx, id int64, version int, input UpdateMetadataInput) error
    SoftDelete(ctx context.Context, tx *sql.Tx, id int64) error
    Restore(ctx context.Context, tx *sql.Tx, id int64) error

    // 重複判定用クエリ
    FindByDuplicateKeys(ctx context.Context, characterID int64, recipeHash string, position string, ...) (*model.Combo, error)

    // セットプレイ引き継ぎ用
    UpdateSetupReferences(ctx context.Context, tx *sql.Tx, oldComboID, newComboID int64) error
}
```

実装は `database/sql` の標準ライブラリで書く(`sqlx` 等は使わない、SUPP-001 §5.7 に依存ライブラリ追加ポリシーあり)。

### 4.7 ハンドラ層(`internal/api/combo/handler.go`)

#### リクエスト DTO(`dto.go`)

```go
type CreateRequest struct {
    CharacterID         int64           `json:"characterId"`
    Damage              *int            `json:"damage,omitempty"`
    Position            string          `json:"position"`
    OpponentStance      string          `json:"opponentStance"`
    HitType             string          `json:"hitType"`
    OpponentSize        string          `json:"opponentSize"`
    StarterMoveID       *int64          `json:"starterMoveId,omitempty"`
    DriveAvailableAtStart  *int         `json:"driveAvailableAtStart,omitempty"`
    SAAvailableAtStart     *int         `json:"saAvailableAtStart,omitempty"`
    KnockdownAdvantage     *int         `json:"knockdownAdvantage,omitempty"`
    Memo                   *string      `json:"memo,omitempty"`
    IsDraft                bool         `json:"isDraft"`
    Steps                  []StepRequest `json:"steps"`
    // 起き攻めBOOLEAN 6カラム(CHANGE-001、DES-003 §3.4 確定済み、M1-02 で実装済み)
    OkiMeatyNeutralTechThrow    *bool `json:"okiMeatyNeutralTechThrow,omitempty"`
    OkiMeatyNeutralTechThrowDr  *bool `json:"okiMeatyNeutralTechThrowDr,omitempty"`
    OkiMeatyBackTechThrow       *bool `json:"okiMeatyBackTechThrow,omitempty"`
    OkiMeatyBackTechThrowDr     *bool `json:"okiMeatyBackTechThrowDr,omitempty"`
    OkiShimmyNeutralTech        *bool `json:"okiShimmyNeutralTech,omitempty"`
    OkiShimmyBackTech           *bool `json:"okiShimmyBackTech,omitempty"`
}

type StepRequest struct {
    MoveID    *int64           `json:"moveId,omitempty"`
    Modifiers *model.Modifiers `json:"modifiers,omitempty"`  // SUPP-001 §3.3.0 型付き構造体
}
```

**起き攻めBOOLEAN6カラム名(M1-02 で確定):** 上記の通り `oki_meaty_neutral_tech_throw` / `oki_meaty_neutral_tech_throw_dr` / `oki_meaty_back_tech_throw` / `oki_meaty_back_tech_throw_dr` / `oki_shimmy_neutral_tech` / `oki_shimmy_back_tech` の6種。NULL 許容なので Go 側は `*bool`、JSON は `omitempty` で「未設定」と「false」を区別。

**コンボ名(name)フィールドは存在しない:** DES-003 §3.4 の combos テーブルに `name` カラムは存在しない(setups テーブルとは設計上の粒度が異なる)。コンボの識別は「キャラ + レシピ + 状況」で行う設計のため、ニックネーム的な用途は `memo` フィールドで代用する。将来コンボ名が必要だと判明したら CHANGE 起票で対応。

#### レスポンス DTO

```go
type ComboResponse struct {
    ID             int64                 `json:"id"`
    CharacterID    int64                 `json:"characterId"`
    // ... 全フィールド ...
    Steps          []StepResponse        `json:"steps,omitempty"`  // 一覧APIでは未ロード(nil)、詳細APIでロード(N+1防止策、§4.10参照)
    Validations    *ValidationResultDTO  `json:"validations,omitempty"`  // WARNINGがある場合のみ
}

type StepResponse struct {
    ID         int64            `json:"id"`
    StepOrder  int              `json:"stepOrder"`
    MoveID     *int64           `json:"moveId,omitempty"`
    MoveCode   *string          `json:"moveCode,omitempty"`  // SUPP-001 §5.1: API応答にcode含める、JOINで取得
    Modifiers  *model.Modifiers `json:"modifiers,omitempty"`  // SUPP-001 §3.3.0 型付き構造体
}
```

#### ハンドラ実装方針

```go
func (h *Handler) Create(c echo.Context) error {
    var req CreateRequest
    if err := c.Bind(&req); err != nil {
        return c.JSON(400, map[string]string{"error": "invalid request body"})
    }

    combo, validResult, err := h.service.Create(c.Request().Context(), toServiceInput(req))
    if err != nil {
        slog.Error("create combo failed", "err", err)
        return c.JSON(500, map[string]string{"error": "internal error"})
    }
    if validResult.HasError() {
        return c.JSON(400, map[string]interface{}{
            "error": "validation failed",
            "validations": validResult,
        })
    }

    return c.JSON(201, toResponse(combo, validResult))
}
```

### 4.8 エラーハンドリング(DES-002 §4.3 準拠)

| HTTP ステータス | 用途 |
|---------------|------|
| 200 | 取得・更新・復元成功 |
| 201 | 新規作成成功 |
| 204 | 削除成功 |
| 400 | バリデーションエラー、リクエスト形式エラー |
| 404 | コンボが存在しない |
| 409 | 楽観的排他で衝突 |
| 500 | サーバー内部エラー |

統一エラーレスポンス形式:

```json
{
  "error": "短いエラー識別子",
  "message": "ユーザー向けメッセージ(任意)",
  "validations": { /* ValidationResult、バリデーションエラー時のみ */ }
}
```

### 4.9 ルート登録

`internal/api/combo/routes.go`:

```go
func RegisterRoutes(g *echo.Group, h *Handler) {
    g.POST("/combos", h.Create)
    g.GET("/combos", h.List)
    g.GET("/combos/:id", h.Get)
    g.PATCH("/combos/:id", h.UpdateMetadata)
    g.PUT("/combos/:id", h.UpdateWithKeyChange)
    g.DELETE("/combos/:id", h.Delete)
    g.POST("/combos/:id/restore", h.Restore)
}
```

`cmd/combomgr/main.go` で:

```go
api := e.Group("/api")
combo.RegisterRoutes(api, comboHandler)
```

### 4.10 リスト API のフィルタとソート

クエリパラメータ:

- `character_id`: 必須(キャラ別表示)
- `is_draft`: `true` / `false` / 省略時は全件
- `include_deleted`: `true` でゴミ箱含む(M1-03段階では実装、M2でゴミ箱画面が使う)
- `sort`: `updated_at` / `damage` / `step_count` (デフォルト `updated_at`)
- `order`: `asc` / `desc` (デフォルト `desc`)
- `limit`: 最大件数(デフォルト100、上限1000)
- `offset`: ページング用(デフォルト0)

**M1-03段階では最小限のフィルタのみ実装、複雑なフィルタ(タグ・状況絞り込み)はM3で追加する。**

### 4.11 集約モデル運用規約(N+1 防止策)

`Combo` 構造体は `Steps []ComboStep` フィールドを持つ集約モデル(M1-02 確定、SUPP-001 §3.3.0、製造担当・設計担当合意済み)。N+1 クエリを避けるため、リポジトリ層で以下の規約を厳守する。

#### 4.11.1 Steps の取得方針

**一覧 API(`GET /api/combos`):**

- combos テーブルのみ SELECT、`Combo.Steps = nil` のまま返す
- 一覧で各コンボのレシピ表示が必要な場合は、`combos.recipe_cache` カラムの JSON を使う(M1-04 で実装される、表示済みプリセットは事前計算済み)
- API レスポンスでは `Steps` フィールドを `omitempty` で省略

**詳細 API(`GET /api/combos/:id`):**

- combos を SELECT、続いて `SELECT * FROM combo_steps WHERE combo_id = ? ORDER BY step_order` で当該コンボの steps を取得
- リポジトリ層で `Combo.Steps = ...` を組み立てて返す

**バルク取得が必要な場面(将来の拡張用):**

- 複数コンボの Steps を一気に取得したい場合は、`SELECT * FROM combo_steps WHERE combo_id IN (?, ?, ...) ORDER BY combo_id, step_order` を実行し、Go 側で `map[int64][]ComboStep` にバケット化してから各 `Combo.Steps` に割り当てる
- `IN(?)` のプレースホルダ生成は Go 側でループ処理(`database/sql` の制約)

#### 4.11.2 Steps の状態規約

- **`Combo.Steps == nil`**: 「未ロード」状態。リポジトリ層が明示的にロードしていない
- **`Combo.Steps == []ComboStep{}`**: 「ロード済みで 0 件」状態(本来発生しないが、構文上の区別)

ビジネスルール上、本登録コンボは最低 1 step を持つ(VAL-C09)、仮登録コンボでも 0 step は実装上の例外的ケース。**「nil = 未ロード」のシンプル規約**で運用する。

#### 4.11.3 godoc に明記

リポジトリ層の以下メソッドの godoc コメントに、Steps の状態を明示すること:

```go
// FindByID は指定IDのコンボを取得する。
// Steps もロードして集約モデルとして返す(combo_steps を別クエリで取得)。
// 戻り値の Combo.Steps は必ず非 nil(空スライスの場合を含む)。
func (r *repository) FindByID(ctx context.Context, id int64) (*model.Combo, error) { ... }

// List はフィルタ条件に合うコンボ一覧を取得する。
// Steps はロードしない(N+1 防止、§4.11.1)。
// 戻り値の各 Combo.Steps は nil(未ロード状態)。
// レシピ表示が必要な場合は別途 combo_steps を取得するか、recipe_cache カラムを使うこと。
func (r *repository) List(ctx context.Context, filter ListFilter) ([]*model.Combo, error) { ... }
```

#### 4.11.4 Modifiers の DB 読み書き(M1-03 着手時に決定)

`combo_steps.modifiers` カラム(JSON 文字列)を Go の `*model.Modifiers` 型に変換する方式は、製造担当判断で以下のいずれかで進める:

- **案 A**: `ComboStep` に `ModifiersRaw *string db:"modifiers" json:"-"` を隠しフィールドとして持たせ、リポジトリ層で読み書き、サービス層で `ModifiersRaw ↔ Modifiers` 変換
- **案 B**: リポジトリ層が SELECT 時に直接 `&step.Modifiers` へ json.Unmarshal、INSERT 時に `json.Marshal(step.Modifiers)` で SQL バインド

製造担当推奨は **案 B**(構造体が綺麗)。Plan Mode で方針を提示し、開発者承認を得てから着手すること。

---

## 5. テスト要件

### 必須テスト(SUPP-001 §5.5)

#### サービス層(`internal/service/combo/service_test.go`)— **網羅的に**

- Create: 本登録の正常系
- Create: 仮登録の正常系
- Create: 本登録時の重複コンボでエラー(VAL-C02)
- Create: 仮登録時に既存本登録と重複していてもエラーにならない(DES-006 §2.3)
- Create(本登録): VAL-C01〜VAL-C12 がそれぞれ発火するケース(各1ケース以上)
- Create(仮登録): VAL-D01〜VAL-D03 がそれぞれ発火するケース(各1ケース以上)
- Create(仮登録): VAL-C シリーズが**走らない**こと(レシピ空でも作成成功する等)
- UpdateMetadata: 正常系、楽観的排他衝突
- UpdateWithKeyChange: 旧コンボ論理削除 + 新コンボ作成 + setup引き継ぎ確認
- Delete: 正常系、既に削除済み
- Restore: 正常系
- List: フィルタ、ソート

#### バリデーション(`internal/service/validation/combo_test.go`)

- 各 VAL-C01〜VAL-C12 の正常系・異常系それぞれ最低1ケース(本登録の挙動)
- 各 VAL-D01〜VAL-D03 の正常系・異常系それぞれ最低1ケース(仮登録の挙動)
- isDraft フラグによる分岐が正しく動作すること(VAL-C と VAL-D が混在しないこと)

#### 重複判定(`duplicate_keys_test.go` または service_test.go 内)

- `CalcRecipeHash` の決定性(同じ入力で同じハッシュ)
- modifiers のキー順違いでも同じハッシュになること(canonical化)
- 異なるレシピで異なるハッシュ
- 重複判定の対象範囲: `is_draft = false AND deleted_at IS NULL` の本登録コンボのみ
- 仮登録コンボとの重複判定が走らないこと

#### リポジトリ層(`internal/repository/combo/repository_test.go`)

- 重複判定クエリ `FindByDuplicateKeys` の動作確認
- フィルタクエリ `List` の動作確認
- 楽観的排他での `UpdateMetadata` の RowsAffected 確認

#### ハンドラ層(`internal/api/combo/handler_test.go`)

- 各エンドポイントの正常系
- 主要異常系(400 バリデーションエラー、404、409 楽観的排他)
- httptest を使う

### テスト用フィクスチャ

- インメモリ SQLite(`:memory:`)を使う
- マイグレーション + リュウのキャラ・技マスタを自動投入する `setupTestDB(t)` ヘルパを作る

---

## 6. レビュー観点(別ファイル参照)

製造担当 Claude は本節を読む必要はない(本節はレビュー担当 Claude が使用するチェックリストへのポインタ)。

レビュー観点は以下の別ファイルに分離されている:

- **`docs/instructions/reviews/M1-03-review-checklist.md`**

レビュー担当 Claude(別ターミナル)は、本指示書(製造担当向け)と上記レビューチェックリストの両方を読み、独立レビューを実施する。製造担当 Claude は本指示書の §1〜§5、§7〜§10 のみを読めば足りる。

---

## 7. 完了条件(Definition of Done)

- [ ] §2 のファイル一覧が全て作成されている
- [ ] `make run-server` で起動し、curl でコンボ作成→取得→一覧→更新→削除→復元→キー変更編集の全シナリオが動作する
- [ ] `make test` が全通過する
- [ ] サービス層のテストカバレッジが主要パスを網羅している(VAL-C01〜VAL-C12、編集方式分離、楽観的排他)
- [ ] §6 のレビュー観点に該当する重大な問題がない
- [ ] Plan Mode で計画提示し、開発者承認後に実装着手した
- [ ] 実装完了後、開発者に「M1-03 が完了しました」と報告

---

## 8. 参照ドキュメント

| ID | パス | 参照箇所 |
|----|------|----------|
| CLAUDE.md | `CLAUDE.md` | 全体方針 |
| DES-003 | `docs/design/03-data-model.md` | §3.4(combos)、§3.5(combo_steps)、§3.13(combo_setups) |
| DES-006 | `docs/design/06-validation.md` | §1、§2、§11 |
| SUPP-001 | `docs/design/supp-001-detailed-design.md` | §2.1、§2.2、§2.3、§5.1、§5.5 |
| HANDOVER-001 | `docs/handover/handover_1.md` | §3.1(編集方式分離) |
| DES-002 | `docs/design/02-architecture.md` | 任意参照: §4、§6.4 |

---

## 9. 注意事項・判断に迷ったら

### 推測で進めてはいけない事項

- **VAL-C01〜VAL-C12 の詳細仕様**(DES-006 §2 を厳密に参照、推測しない)
- **起き攻めBOOLEAN の6カラム名**(DES-003 §3.4 厳守、CHANGE-001 反映済み)
- **編集方式分離の判定ロジック**(SUPP-001 §2.1、HANDOVER-001 §3.1 厳守)
- **重複判定の比較フィールド**(SUPP-001 §2.2 リスト定数で定義、推測しない)
- **API パスとHTTPメソッド対応**(本指示書 §4.1 厳守)

### 推測で進めてよい事項(その旨を明示)

- 細かなインタフェース命名(ServiceImpl、Service、Manager 等)
- DTO の細かなフィールド名(camelCase 統一、API応答のJSON形)
- 内部関数の分割粒度
- エラーメッセージの文言

### 不明事項発見時の対応

1. DES-006 のVAL-IDで判定基準が曖昧 → DES-006 を再読、それでも不明なら開発者確認
2. 起き攻めBOOLEAN のカラム名 → DES-003 §3.4 を厳密に参照
3. PATCH と PUT の境界が曖昧なケース → 開発者に質問

### Plan Mode で計画提示時に含めるべき項目

- レイヤーごとの実装順序(リポジトリ → サービス → バリデーション → ハンドラ、または逆)
- VAL-C01〜VAL-C12 のうち実装が複雑なもの(C02 重複判定、C12 ラッシュ版検証)の方針
- 編集方式分離(PATCH/PUT)の実装方針
- recipe_cache 関連のTODO箇所の列挙(M1-04との境界)
- テストデータ(インメモリDB + リュウマスタ)のセットアップ方針

---

## 10. 完了後の次ステップ

M1-03 完了後、以下が並列で進行可能になる(製造+レビュー並列運用):

- 機械レビュー(別ターミナル)
- M1-04(プリセット解決・recipe_cache)
- M1-05(コンボ一覧・詳細画面)
- M1-06(コンボ登録・編集画面)
- M1-07(debug API)

これらは独立性高く、開発者の判断で順次または並列に投入可能。

---

*以上*

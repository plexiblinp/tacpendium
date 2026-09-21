# 指示書 M1-04: プリセット解決・recipe_cache 計算

| 項目 | 内容 |
|------|------|
| 指示書ID | M1-04 |
| バージョン | 1.2.2 |
| 対象マイルストーン | M1(コア基盤) |
| 推奨モデル | **Opus 4.6** |
| Plan Mode | **必須** |
| 機械レビュー | **必須**(別チェックリスト: `docs/instructions/reviews/M1-04-review-checklist.md`) |
| 並列性 | M1-03 完了後、M1-05/M1-06/M1-07 と並列実行可能 |
| 依存指示書 | M1-01、M1-02、M1-03 |
| 想定所要時間 | 90〜120分 |
| 作成者 | 詳細設計・製造準備担当Claude |
| 作成日 | 2026-04-29 |

## 更新履歴

| バージョン | 更新日 | 更新内容 |
|-----------|--------|----------|
| 1.0.0 | 2026-04-29 | 初版作成 |
| 1.1.0 | 2026-04-30 | M1-02 の製造担当回答(recipe_cache は combos.recipe_cache カラム JSON、DES-003 §3.4 案A確定)を反映: §2.1 ファイル構成で combo リポジトリ拡張を明示、§2.2 修正ファイル一覧に combo リポジトリ追加、§4.1 サービスインタフェースのコメントを案A前提に、§4.3 cache.go の実装方針を JSON操作ベースに全面書き換え、§4.6 リポジトリ層の責務を「preset リポジトリ + combo リポジトリ拡張」に分離、§5 テスト要件を JSON操作前提に、§7 完了条件のSQL例も `combos.recipe_cache` カラム参照に、§9 注意事項を確定状態に更新 |
| 1.2.0 | 2026-04-30 | CHANGE-007 反映: §4.5.1 GET /api/presets レスポンス例を `name` 単一フィールド + `code` の構成に修正(`nameJa`/`nameEn` 削除)。§4.6.1 リポジトリインタフェースに CHANGE-007 反映の説明追加、`FindPresetByCode` が `SELECT * FROM presets WHERE code = ?` で実装可能になったことを明記 |
| 1.2.1 | 2026-04-30 | M1-04 実装中の製造担当質問対応: §4.5.3 のレシピ専用取得エンドポイント `GET /api/combos/:id/recipe?preset_id=X` を「任意実装」から「M1-04 では実装しない」に明示変更。`GET /api/combos/:id` のレスポンスに `recipe_cache` カラムの JSON を展開して含める方式で M1-05 のフロント実装が成立する設計を明記。§10 に M1-05 着手時の判断材料(専用エンドポイントの追加判断基準)を追記 |
| 1.2.2 | 2026-04-30 | M1-05 実装中の製造担当質問で発覚した M1-04/M1-05 指示書間の矛盾を解消: §4.5.3 に後日注記を追加し、当初想定の「ComboResponse に recipe_cache を展開」が M1-04 実装に反映されなかった事実、および専用エンドポイントを M1-05 のスコープで追加する運用に切り替えた旨を明記。M1-04 では本エンドポイントの実装は引き続き不要、ComboResponse の構造も `json:"-"` のままで問題ない |

---

## 1. 背景と目的

### 背景

M1-03 でコンボの CRUD API は完成したが、**recipe_cache の計算ロジックは TODO のまま**。M1-04 で notation サービスを実装し、recipe_cache を計算可能にする。これにより、コンボ詳細画面でプリセット切替表示が動くようになる(M1-05、M1-06 が利用)。

### 目的

- DES-004 §5 のエイリアス変換ロジックを `internal/service/notation/` に実装
- recipe_cache の遅延計算・更新・無効化ロジックを SUPP-001 §2.3 に基づいて実装
- プリセット読み出し・エイリアス取得 API(GET 系)を実装
- M1-03 で TODO になっていた箇所(コンボ作成・更新・削除時の recipe_cache 連携)を埋める

### このマイルストーンで作らないもの

- プリセットの編集・作成 API(M3 でカスタムプリセット機能として実装)
- プリセット表記の入力 UI(M2 以降)
- カスタムプリセットの作成機能(フェーズ1B)

---

## 2. 成果物

### 2.1 作成するファイル

```
combomgr/
├── internal/
│   ├── api/
│   │   └── preset/
│   │       ├── handler.go              # GET /api/presets, GET /api/presets/:id
│   │       ├── handler_test.go
│   │       ├── dto.go
│   │       └── routes.go
│   ├── service/
│   │   └── notation/
│   │       ├── service.go              # 公開インタフェース(SUPP-001 §7.1)
│   │       ├── service_test.go         # 必須テスト
│   │       ├── resolver.go             # エイリアス変換ロジック
│   │       ├── resolver_test.go
│   │       ├── cache.go                # combos.recipe_cache カラム(JSON)の操作ロジック
│   │       └── cache_test.go
│   └── repository/
│       ├── preset/
│       │   ├── repository.go           # presets, preset_aliases(M1-04 で新規)
│       │   ├── repository_test.go
│       │   └── queries.go
│       └── combo/                      # M1-03 で実装済み、本指示書で recipe_cache メソッドを追記
│           ├── repository.go           # ※ 既存ファイルに recipe_cache カラム操作メソッドを追加
│           └── repository_test.go      # ※ 既存ファイルにテスト追加
└── cmd/combomgr/
    └── main.go                         # M1-03から修正(notation サービス DI、preset ルート登録)
```

### 2.2 修正するファイル

- `cmd/combomgr/main.go`: notation サービスを combo サービスに DI、preset ルート登録
- `internal/service/combo/service.go`: M1-03 で TODO になっていた recipe_cache 連携箇所を notation サービス呼出に置換
- `internal/repository/combo/repository.go`: recipe_cache カラム操作メソッド(GetRecipeCache、UpdateRecipeCache 等)を追加(§4.6.2 参照)
- `internal/repository/combo/repository_test.go`: 上記メソッドのテスト追加

### 2.3 変更しないもの

- M1-01〜M1-03 のその他のファイル

---

## 3. 前提条件

### 必読ドキュメント

- `CLAUDE.md`
- `docs/instructions/M1-overview.md`
- `docs/design/04-notation-spec.md`
  - **§1** 目的と方針
  - **§2.1** 技の内部識別子(move.code)
  - **§2.2** レシピの内部表現
  - **§2.3** 修飾情報とステップ種別のコード
  - **§3** プリセットの設計(全節)
  - **§4** 連結子
  - **§5** エイリアス変換の仕組み(全節、本指示書の中核)
- `docs/design/supp-001-detailed-design.md`
  - **§2.3** recipe_cache再計算とサービス層責務(本指示書の中核)
  - **§3.3** flagsと非技typeの初期仮置き(エイリアス変換時の参照)
  - **§3.4** プリセット初期エイリアス戦略
  - **§7** サービス層の責務一覧(本指示書の中核、関数シグネチャ・呼出元責務)

### 任意参照

- `docs/design/03-data-model.md` §3.8(presets)、§3.9(preset_aliases)、§3.4 の `recipe_cache` カラム

### 参照不要

- DES-005、DES-006

---

## 4. 詳細仕様

### 4.1 notation サービスのインタフェース

SUPP-001 §7.1 に基づく公開関数を実装する。

**前提:** recipe_cache は **`combos` テーブルの `recipe_cache` カラム(TEXT、JSON 文字列)** として保持される(DES-003 §3.4 確定済み、別テーブルではない)。JSON 構造は以下:

```json
{
  "1": "立ち弱P > 立ち中P > 中波動拳",
  "2": "弱P > 中P > 中・波動拳",
  "3": "LP > MP > 236MP",
  ...
}
```

キーは `preset_id` の文字列化整数、値はそのプリセットでのレシピ表示文字列。NULL の場合は「キャッシュ未生成」を表す。

```go
package notation

type Service interface {
    // ResolveComboRecipe: UI表示時に combos.recipe_cache JSON から取得、未生成なら計算して JSON を更新
    ResolveComboRecipe(ctx context.Context, comboID, presetID int64) (string, error)

    // RecomputeComboCache: 当該コンボの combos.recipe_cache を全プリセット分計算した JSON で UPDATE
    // tx を受け取り、コンボ作成/編集トランザクションの一部として呼ばれる
    RecomputeComboCache(ctx context.Context, tx *sql.Tx, comboID int64) error

    // DeleteComboCache: 当該コンボの combos.recipe_cache を NULL に UPDATE
    // 論理削除時に呼ばれる(物理的にはコンボ行は残るが、recipe_cache だけ NULL 化)
    DeleteComboCache(ctx context.Context, tx *sql.Tx, comboID int64) error

    // RecomputePresetCache: 全 combos の recipe_cache JSON のうち、当該プリセットの値を再計算して更新
    // フェーズ2のプリセット編集機能等で使用、M1-04 では実装するが M1 内では呼出側なし
    RecomputePresetCache(ctx context.Context, presetID int64) error

    // DeletePresetCache: 全 combos の recipe_cache JSON から当該プリセットのキーを削除
    // フェーズ2のプリセット削除等で使用、M1-04 では実装するが M1 内では呼出側なし
    DeletePresetCache(ctx context.Context, tx *sql.Tx, presetID int64) error

    // ComputeSingleCache: 内部利用、単一エントリ(comboID, presetID)の計算ロジック
    // 結果は文字列で返す(JSON への組み込みは呼出側の責務)
    ComputeSingleCache(ctx context.Context, comboID, presetID int64) (string, error)

    // (補助) 単発の変換: 任意のステップ列を指定プリセットでテキスト化
    // フロントが「現在編集中のレシピ」を一時表示するためなど、DB 書込なし
    RenderSteps(ctx context.Context, presetID int64, steps []model.ComboStep) (string, error)
}
```

### 4.2 エイリアス変換アルゴリズム(`resolver.go`)

DES-004 §5.1 の流れを実装する。

#### 4.2.1 単一ステップの変換

```go
// resolveStep: 1ステップを指定プリセットでテキスト化
// 1. 通常step(move_idあり) の場合:
//    a. preset_aliases[preset_id, move_id] が存在する → エイリアステキスト使用
//    b. 存在しない → フォールバック(§5.3)
//        i. official_ja_move のエイリアスがあればそれを使う
//        ii. なければ moves.code をそのまま使う
// 2. 非技step(move_id NULL、modifiers.type で識別) の場合:
//    - SUPP-001 §3.3.3 の type に応じた固定テキストを返す
//      例: parry_drive_rush → "パリィDR" (preset別の表記は将来対応、M1-04では仮置きOK)
// 3. modifiers.flags がある場合:
//    - 各flagを { } 等で囲んで付加
//      例: low_jump → "{最低空}", just → "{ジャスト}" 等
//    - flag のテキスト表現は SUPP-001 §3.3.1 を参照
func resolveStep(ctx context.Context, step model.ComboStep, presetID int64, deps Deps) (string, error)
```

**フォールバックの実装(SUPP-001 で再確認):**

DES-004 §5.3 のフォールバック順:
1. 当該プリセットの当該moveのエイリアス
2. なければ `official_ja_move` プリセットの当該moveのエイリアス
3. それもなければ `moves.code` をそのまま表示

#### 4.2.2 連結子の扱い

DES-004 §4 に基づき、ステップ間の連結子は**プリセットごとに固定値**を持つ。

ただし、**本指示書段階では「プリセットごとに連結子を持つカラム」は実装しない**(プリセットテーブルに `connector` カラムが DES-003 にあるか不明のため)。**M1-04 では全プリセットで「 > 」(半角スペース付き不等号)を連結子として使用**する仮実装で進める。

連結子の柔軟化(プリセット別連結子)は、必要があれば M3(プリセット編集機能)で実装する。

#### 4.2.3 完全なレシピ変換

```go
// resolveRecipe: コンボ全体を指定プリセットでテキスト化
func resolveRecipe(ctx context.Context, comboID, presetID int64, deps Deps) (string, error) {
    // 1. combo_steps を step_order 昇順で取得
    // 2. 各ステップを resolveStep で変換
    // 3. 連結子(" > ")で連結
    // 4. 結合した文字列を返す
}
```

### 4.3 recipe_cache の管理(`cache.go`)

SUPP-001 §7.2 の責務一覧通りに実装する。**実装方針: combos.recipe_cache カラム(JSON 文字列)を読み書きする。**

JSON のキーは `preset_id` の文字列化整数(`"1"`, `"2"`, ...)、値はそのプリセットでのレシピ表示文字列。

#### 4.3.1 ResolveComboRecipe(遅延計算、UI表示時)

```go
func (s *service) ResolveComboRecipe(ctx context.Context, comboID, presetID int64) (string, error) {
    // 1. combos.recipe_cache を取得
    cacheJSON, err := s.repo.GetRecipeCache(ctx, comboID)
    if err != nil { return "", err }

    // 2. JSON をパース、preset_id のキーがあればそれを返す
    cache := map[string]string{}
    if cacheJSON != nil && *cacheJSON != "" {
        if err := json.Unmarshal([]byte(*cacheJSON), &cache); err != nil {
            slog.Warn("invalid recipe_cache JSON", "combo_id", comboID, "err", err)
            // パース失敗 → キャッシュ全体を再計算する方が安全
        } else {
            key := strconv.FormatInt(presetID, 10)
            if text, ok := cache[key]; ok {
                return text, nil
            }
        }
    }

    // 3. キャッシュ不在 or パース失敗 → 計算
    text, err := s.ComputeSingleCache(ctx, comboID, presetID)
    if err != nil {
        return "", err
    }

    // 4. JSON を更新(失敗してもテキストは返す、書込失敗でユーザー操作を妨げない)
    cache[strconv.FormatInt(presetID, 10)] = text
    newJSON, err := json.Marshal(cache)
    if err == nil {
        if err := s.repo.UpdateRecipeCache(ctx, comboID, string(newJSON)); err != nil {
            slog.Warn("failed to update recipe_cache", "combo_id", comboID, "err", err)
        }
    }

    return text, nil
}
```

#### 4.3.2 RecomputeComboCache(コンボ作成・キー変更編集時の再計算)

```go
func (s *service) RecomputeComboCache(ctx context.Context, tx *sql.Tx, comboID int64) error {
    // 1. 全プリセットを取得
    presets, err := s.repo.ListAllPresets(ctx)
    if err != nil { return err }

    // 2. 各プリセットで計算して JSON を組み立て
    cache := map[string]string{}
    for _, p := range presets {
        text, err := s.computeSingleCacheTx(ctx, tx, comboID, p.ID)
        if err != nil { return err }
        cache[strconv.FormatInt(p.ID, 10)] = text
    }

    // 3. JSON を組み立て
    newJSON, err := json.Marshal(cache)
    if err != nil { return fmt.Errorf("marshal recipe_cache: %w", err) }

    // 4. combos.recipe_cache を UPDATE(同じトランザクション内で実行)
    return s.repo.UpdateRecipeCacheTx(ctx, tx, comboID, string(newJSON))
}
```

#### 4.3.3 DeleteComboCache(論理削除時)

```go
func (s *service) DeleteComboCache(ctx context.Context, tx *sql.Tx, comboID int64) error {
    // combos.recipe_cache を NULL に更新する(行は残す、論理削除と整合)
    return s.repo.SetRecipeCacheNullTx(ctx, tx, comboID)
}
```

#### 4.3.4 RecomputePresetCache(全コンボの recipe_cache JSON のうち、当該プリセットのキーを更新)

```go
func (s *service) RecomputePresetCache(ctx context.Context, presetID int64) error {
    // 1. 全コンボ(削除済みを除く)を取得
    combos, err := s.repo.ListAllActiveCombos(ctx)
    if err != nil { return err }

    // 2. 各コンボについて、JSON を読み込み → 当該プリセットのキーだけ再計算 → JSON 更新
    for _, c := range combos {
        // 既存 JSON を取得・パース
        cacheJSON, err := s.repo.GetRecipeCache(ctx, c.ID)
        if err != nil { return err }

        cache := map[string]string{}
        if cacheJSON != nil && *cacheJSON != "" {
            json.Unmarshal([]byte(*cacheJSON), &cache) // パース失敗は許容、空 map から始める
        }

        // 当該プリセットのキーを再計算
        text, err := s.ComputeSingleCache(ctx, c.ID, presetID)
        if err != nil { return err }
        cache[strconv.FormatInt(presetID, 10)] = text

        // JSON を更新
        newJSON, err := json.Marshal(cache)
        if err != nil { return fmt.Errorf("marshal recipe_cache: %w", err) }
        if err := s.repo.UpdateRecipeCache(ctx, c.ID, string(newJSON)); err != nil { return err }
    }

    return nil
}
```

**注意:** RecomputePresetCache はトランザクションを取らない(1コンボごとの更新で十分、全件まとめての一貫性は不要)。実装フェーズで N+1 問題が顕著なら、バッチ UPDATE に最適化することも検討するが、フェーズ1のコンボ数想定(数十〜数百件)では同期処理で問題ない。

#### 4.3.5 DeletePresetCache(全コンボの recipe_cache JSON から当該プリセットのキーを削除)

```go
func (s *service) DeletePresetCache(ctx context.Context, tx *sql.Tx, presetID int64) error {
    // 1. 全コンボ(削除済みを除く)を取得
    // 2. 各コンボの recipe_cache JSON から当該 preset_id のキーを delete
    // 3. 残った JSON を UPDATE
    // (フェーズ1では呼出側なし、実装はするがM1段階では未使用)
}
```

#### 4.3.6 組み込みプリセット保護

`is_builtin = true` のプリセットは、`DeletePresetCache` を呼ぶ前に「**プリセット自体の削除を拒否**」する判断が必要だが、これは **preset サービス側(本指示書では実装しない、フェーズ1B または M3)** の責務とする。M1-04 では `DeletePresetCache` 自体は組み込みプリセットでも動作させる(キャッシュ削除は安全な操作のため)。

### 4.4 M1-03 の TODO 箇所の埋め合わせ

`internal/service/combo/service.go` で M1-03 が TODO で残していた箇所を、notation サービス呼出に置換する。

```go
// M1-03 の Create 内
func (s *service) Create(ctx context.Context, input CreateInput) (...) {
    // ... INSERT 処理 ...

    // recipe_cache 再計算 (M1-04 で埋める箇所)
    if err := s.notationSvc.RecomputeComboCache(ctx, tx, combo.ID); err != nil {
        return nil, result, fmt.Errorf("recompute cache: %w", err)
    }

    // ... コミット ...
}

// M1-03 の UpdateWithKeyChange 内
func (s *service) UpdateWithKeyChange(ctx context.Context, ...) (...) {
    // 旧コンボ論理削除
    // 旧コンボの recipe_cache 削除
    if err := s.notationSvc.DeleteComboCache(ctx, tx, oldComboID); err != nil { ... }

    // 新コンボ INSERT
    // 新コンボの recipe_cache 計算
    if err := s.notationSvc.RecomputeComboCache(ctx, tx, newComboID); err != nil { ... }
}

// M1-03 の Delete 内(論理削除)
func (s *service) Delete(ctx context.Context, id int64) error {
    // 論理削除
    // recipe_cache を物理削除
    return s.notationSvc.DeleteComboCache(ctx, tx, id)
}
```

**注意:** `combo` サービスのコンストラクタに `notationSvc` パラメータを追加する必要がある。`cmd/combomgr/main.go` の DI 部分も合わせて修正する。

### 4.5 プリセット API

#### 4.5.1 GET /api/presets

組み込みプリセット5種を全て返す。`user_id` でフィルタする(将来カスタムプリセットが入っても対応できる構造)。

```json
[
  {
    "id": 1,
    "code": "official_ja_move",
    "name": "公式表記(日本語・技名表示)改善版",
    "isBuiltin": true,
    "userId": null
  },
  ...
]
```

注: presets テーブルには `name` 単一カラムのみ(DES-003 §3.8、CHANGE-007)。`nameJa`/`nameEn` 等の多言語フィールドは持たない。`code` は機械可読識別子(DES-004 §3.1)。

#### 4.5.2 GET /api/presets/:id

単一プリセットの詳細を返す。フロント側で「このプリセットは編集可能か」を判定するため、`isBuiltin` を含める。

#### 4.5.3 GET /api/combos/:id/recipe?preset_id=X(**M1-05 で追加実装される**)

> **後日注記(2026-04-30、v1.2.2 で追加):**
> 当初本節は「M1-04 では実装しない、`GET /api/combos/:id` のレスポンスに `recipe_cache` を展開して含める方針」と書いていた(下記「当初の記述」参照)。しかし M1-04 実装上は `ComboResponse.recipe_cache` が `json:"-"` のままで API 出力されない状態となった(指示書記述が「既に返している実装ならOK」という曖昧表現だったため)。
>
> このため、M1-05 実装中に**専用エンドポイント `GET /api/combos/:id/recipe?preset_id=X` を M1-05 のスコープで追加する**運用に変更した(M1-05 v1.4.0 §2.4、§4.2.2 参照)。
>
> **M1-04 では本エンドポイントの実装は引き続き不要**(M1-05 で追加されるため、ComboResponse の構造も変更不要、`json:"-"` のままで問題ない)。

##### 当初の記述(参考、現在は無効)

レシピ専用取得エンドポイント(コンボ詳細画面用に「指定プリセットでのレシピテキスト」を返す)については、**M1-04 では実装しない**。

理由:

- M1-04 の中核責務(notation サービス、recipe_cache 管理、preset API)が既に十分大きい
- `GET /api/combos/:id` のレスポンスで `recipe_cache` カラムの JSON を展開して含めれば、フロント側でプリセット別レシピ表示が可能(専用APIなしで動く設計)
- M1-05 のフロント実装中に「専用APIが本当に必要か」が判明する。必要なら M1-05 のスコープ内で追加実装すればよく、サービス層(`notationSvc.ResolveComboRecipe`)は既に呼び出し可能

(M1-04 当初の対応案: `GET /api/combos/:id` のレスポンスに `recipe_cache` JSON を展開して含める形 → 実装に反映されず、M1-05 で専用エンドポイント追加に切り替え)

### 4.6 リポジトリ層(`internal/repository/preset/repository.go` および `internal/repository/combo/repository.go`)

#### 4.6.1 preset リポジトリ(presets / preset_aliases)

```go
// internal/repository/preset/repository.go
type Repository interface {
    // presets
    ListAllPresets(ctx context.Context) ([]*model.Preset, error)
    FindPresetByID(ctx context.Context, id int64) (*model.Preset, error)
    FindPresetByCode(ctx context.Context, code string) (*model.Preset, error)  // CHANGE-007 で presets.code カラム追加、SELECT * FROM presets WHERE code = ? で実装

    // preset_aliases
    FindAlias(ctx context.Context, presetID, moveID int64) (*model.PresetAlias, error)
    ListAliasesByPreset(ctx context.Context, presetID int64) ([]*model.PresetAlias, error)
}
```

**CHANGE-007 反映:** `presets` テーブルに `code` カラム(TEXT UNIQUE NOT NULL)が追加されたため、`FindPresetByCode` は `SELECT * FROM presets WHERE code = ?` で実装可能。サービス層では `'official_ja_move'` 等の機械可読キーでプリセット参照する(DES-004 §3.1 のプリセットコード)。フォールバックロジック(§4.2.1 のエイリアス変換)で `official_ja_move` プリセットを参照する箇所もこのメソッドを使用する。

#### 4.6.2 combo リポジトリの拡張(recipe_cache カラム操作)

recipe_cache は **`combos` テーブルのカラム**(JSON 文字列、TEXT)として保存されるため、新規リポジトリではなく **M1-03 で作成済みの `internal/repository/combo/repository.go` を拡張する**形で実装する。

```go
// internal/repository/combo/repository.go に追加するメソッド
type Repository interface {
    // ... M1-03 で実装済みのメソッド ...

    // recipe_cache カラム操作(M1-04 で追加)
    GetRecipeCache(ctx context.Context, comboID int64) (*string, error)
    UpdateRecipeCache(ctx context.Context, comboID int64, cacheJSON string) error
    UpdateRecipeCacheTx(ctx context.Context, tx *sql.Tx, comboID int64, cacheJSON string) error
    SetRecipeCacheNullTx(ctx context.Context, tx *sql.Tx, comboID int64) error

    // 全アクティブコンボ取得(RecomputePresetCache 用)
    ListAllActiveCombos(ctx context.Context) ([]*model.Combo, error)
}
```

**実装方針:**

- `GetRecipeCache`: `SELECT recipe_cache FROM combos WHERE id = ?`、NULL の可能性があるため `*string` を返す
- `UpdateRecipeCache`: `UPDATE combos SET recipe_cache = ?, updated_at = datetime('now') WHERE id = ?`
- `UpdateRecipeCacheTx`: 上記をトランザクション内で実行する版(コンボ作成時等)
- `SetRecipeCacheNullTx`: `UPDATE combos SET recipe_cache = NULL WHERE id = ?` を tx 内で実行
- `ListAllActiveCombos`: `SELECT * FROM combos WHERE deleted_at IS NULL`(削除済み除く)

**注意:** `UpdateRecipeCache` 系では `version` カラムをインクリメントしない(recipe_cache はキャッシュであり、コンボの実体的変更ではないため、楽観的排他の対象外とする)。

`recipe_cache` の DB 上の実体は **`combos.recipe_cache` カラム(TEXT、JSON 文字列)**(DES-003 §3.4 確定済み、別テーブルではない)。

---

## 5. テスト要件

### 必須テスト

#### サービス層(`service_test.go`、`resolver_test.go`、`cache_test.go`)

- resolver:
  - 通常 move のエイリアス変換(`official_ja_move` で投入済みの技で確認)
  - フォールバック1: 当該プリセットにエイリアスなし、`official_ja_move` にあり → official_ja_move を使用
  - フォールバック2: どちらにもなし → `moves.code` 使用
  - 非技ステップ(`parry_drive_rush` 等)の変換
  - flags 付きステップの変換(`low_jump`、`just` 等)
  - 連結子(" > ")での結合

- cache:
  - ResolveComboRecipe: キャッシュなし時の計算+挿入、キャッシュあり時の取得
  - RecomputeComboCache: 全プリセット分の再計算
  - DeleteComboCache: エントリ削除確認
  - RecomputePresetCache: 全コンボ分の再計算

#### combo サービス連携テスト

- Create コンボ後、combos.recipe_cache カラムが全プリセット分の JSON で更新されること
- UpdateWithKeyChange 後、旧コンボの recipe_cache が NULL 化され、新コンボの recipe_cache が JSON で更新されること
- Delete コンボ後、combos.recipe_cache が NULL になること(行は残る、論理削除と整合)

### リポジトリ層

- GetRecipeCache、UpdateRecipeCache、UpdateRecipeCacheTx、SetRecipeCacheNullTx の正常系
- ListAllActiveCombos の正常系(削除済みは除外されること)

### ハンドラ層

- GET /api/presets の正常系(5件返ること)
- GET /api/presets/:id の正常系・404

---

## 6. レビュー観点(別ファイル参照)

製造担当 Claude は本節を読む必要はない。

レビュー観点は以下の別ファイルに分離されている:

- **`docs/instructions/reviews/M1-04-review-checklist.md`**

レビュー担当 Claude(別ターミナル)は、本指示書(製造担当向け)と上記レビューチェックリストの両方を読み、独立レビューを実施する。製造担当 Claude は本指示書の §1〜§5、§7〜§10 のみを読めば足りる。

---

## 7. 完了条件(Definition of Done)

- [ ] §2 のファイル一覧が全て作成されている
- [ ] M1-03 の TODO 箇所が notation サービス呼出に置換されている
- [ ] `make run-server` で起動し、コンボ作成→詳細取得→GET /api/presets が動作する
- [ ] curl 等でコンボ作成後、combos.recipe_cache カラムに JSON が入っていることが確認できる(例: `SELECT id, recipe_cache FROM combos;`)
- [ ] `make test` が全通過する
- [ ] サービス層の必須テストが網羅されている
- [ ] Plan Mode で計画提示し、開発者承認後に実装着手した
- [ ] 実装完了後、開発者に「M1-04 が完了しました」と報告

---

## 8. 参照ドキュメント

| ID | パス | 参照箇所 |
|----|------|----------|
| CLAUDE.md | `CLAUDE.md` | 全体方針 |
| DES-004 | `docs/design/04-notation-spec.md` | §1、§2、§3、§4、§5(中核) |
| SUPP-001 | `docs/design/supp-001-detailed-design.md` | §2.3、§3.3、§3.4、§7(中核) |
| DES-003 | `docs/design/03-data-model.md` | §3.4(recipe_cache)、§3.8(presets)、§3.9(preset_aliases) |

---

## 9. 注意事項・判断に迷ったら

### 推測で進めてはいけない事項

- DES-004 §5 のエイリアス変換アルゴリズムの細部(フォールバック順序、優先順位)
- SUPP-001 §7.1 の関数シグネチャ(関数名、引数構成)
- recipe_cache JSON のキー型(`preset_id` の文字列化整数で固定、本指示書 §4.3 厳守)

### 推測で進めてよい事項(その旨を明示)

- 連結子の文字列(" > " で固定する仮実装でOK)
- 非技ステップ(parry_drive_rush 等)の表示テキスト(Claude Code の知識で妥当な表現を選ぶ、後で開発者が調整)
- flag の表示装飾(`{just}`、`{最低空}` など、可読性重視で選ぶ)
- 内部ヘルパ関数の命名・分割粒度
- recipe_cache JSON のパース失敗時の挙動(空 map から始めて再計算する形で安全側に倒す等、本指示書 §4.3.1 のコメント参照)

### recipe_cache の DB 上の実体(確定済み)

**`combos` テーブルの `recipe_cache` カラム(TEXT、JSON 文字列)** で確定(DES-003 §3.4、製造担当・設計担当合意済み)。別テーブルではない。詳細は本指示書 §4.3 参照。

### 不明事項発見時の対応

1. M1-03 のコードに加える修正の影響範囲が大きい → Plan Mode で開発者に提示・承認を得てから着手
2. プリセットの連結子が DES-004 §4 で複雑な場合 → 仮実装(`" > "` 固定)で進めて開発者にエスカレーション
3. recipe_cache JSON の構造で迷う → 本指示書 §4.3 を再読、それでも不明なら開発者確認

### Plan Mode で計画提示時に含めるべき項目

- notation サービスの公開関数一覧と、各関数の実装方針
- M1-03 で TODO になっている箇所の修正方針(combo サービスへの DI 含む)
- combo リポジトリへの recipe_cache カラム操作メソッド追加の影響範囲
- 連結子の仮実装方針("> "固定にするかどうか)
- フォールバックの実装方針(DES-004 §5.3 をどう解釈したか)
- recipe_cache JSON のパース失敗時の挙動(リカバリーポリシー)

---

## 10. 完了後の次ステップ

M1-04 完了後、M1-05(コンボ一覧・詳細画面)が `GET /api/presets`、`GET /api/combos/:id`(`recipe_cache` 展開済み)を活用できる状態になる。

### M1-05 着手時の判断事項

M1-04 で実装しなかった `GET /api/combos/:id/recipe?preset_id=X` 専用エンドポイントについて、M1-05 のフロント実装中に以下を判断する:

- **不要なケース**: `GET /api/combos/:id` のレスポンスに含まれる `recipeCache` JSON から、フロントで該当プリセットのレシピを取り出すだけで足りる場合 → 専用エンドポイント不要
- **必要なケース**: 何らかの理由でフロントから個別プリセットのレシピのみを再取得したい場面が発生した場合 → M1-05 のスコープ内で `GET /api/combos/:id/recipe?preset_id=X` を追加実装

追加実装する場合、M1-04 で実装済みの `notationSvc.ResolveComboRecipe(ctx, comboID, presetID)` を呼ぶハンドラを `internal/api/combo/handler.go` に追加するだけで済む(数十行)。

### 並列実行

並列実行中の他の指示書(M1-05、M1-06、M1-07)があれば、各々のレビューと統合を進める。

---

*以上*

# 指示書 M2-02: 編集系 UX 改善(コピー、重複検知、本登録昇格、PUT 確認)

| 項目 | 内容 |
|------|------|
| 指示書ID | M2-02 |
| バージョン | 1.1.0 |
| 対象マイルストーン | M2(編集系の本格化) |
| 推奨モデル | **Opus 4.6** |
| Plan Mode | **必須**(複数機能の関心が絡むため、計画提示で開発者と認識合わせ) |
| 機械レビュー | **必須**(別チェックリスト: `docs/instructions/reviews/M2-02-review-checklist.md`) |
| 並列性 | **単独**(M2 は完全直列、M2-01 完了が前提) |
| 依存指示書 | M2-01(仮想コントローラ・modifiers 編集 UI が動作している前提)、M1-03(コンボ CRUD API)、M1-05(コンボ一覧・詳細画面)、M1-06(コンボ登録・編集画面) |
| 想定所要時間 | 120〜150 分 |
| 作成者 | 詳細設計・製造準備担当Claude(M2 期間担当) |
| 作成日 | 2026-05-07 |
| 更新日 | 2026-05-07 |

## 更新履歴

| バージョン | 更新日 | 更新内容 |
|-----------|--------|----------|
| 1.0.0 | 2026-05-07 | 初版作成 |
| 1.1.0 | 2026-05-07 | 製造担当からの2件の質問に対する開発者判断を反映。(Q1) §2.4 例外条項を拡張: `UpdateMetadataInput` への `IsDraft *bool` 追加(後方互換変更)を許容。§4.5.2 にサービス層 `UpdateMetadata` 内での is_draft 切替時バリデーション挙動の確認手順を追記。(Q2) §4.1.3 / §4.1.4 のレスポンス形式を `label` 単一文字列から構造化フィールド(`{ id, characterId, starterMoveId, position, opponentStance, hitType, opponentSize, stepCount }`)に変更。§4.2.5 にフロント側で表示文字列を合成する方針を追記。§9.2 の「label の生成形式」項目を削除し、「表示フォーマットの微調整(M1-05 と揃える)」に置換。これらは指示書設計時の不備を是正したもので、開発者・設計担当・製造担当間で確定済み |

---

## 1. 背景と目的

### 1.1 背景

M1-06 でコンボ登録・編集画面(`ComboEditor.tsx`)を実装し、編集2方式分離(PATCH/PUT、`hasKeyChanges` 判定)・重複警告モーダル(`DuplicateWarning.tsx`)・PUT 時の確認ダイアログまで動作している。M2-01 で仮想コントローラと modifiers 編集 UI が完成し、コンボの新規登録・編集の基本動線は揃った。

しかし以下の UX 機能は M1 でスコープ外として持ち越されている:

- **コピー機能(FR012)**: 既存コンボを元に新規登録する動線が未実装
- **リアルタイム重複検知**(DES-005 §5.7): フォーム入力中に重複を検知して画面上部で警告する機能が未実装。現状は POST 時の重複判定のみ
- **仮登録 → 本登録の昇格 UI**(FR010): バックエンドは PATCH で is_draft 切替が動作するが、フロントに専用 UI がない
- **PUT 確認ダイアログの UX 改善**: M1-06 で動作はしているが、文言・コピーモード時の挙動の整理が必要

### 1.2 目的

- コンボ一覧・コンボ詳細から「コピー」操作で新規登録モードに遷移し、コピー元の全情報を初期値投入する動線を実装する
- 重複検知専用の API エンドポイント(`POST /api/combos/check-duplicate`)を新設し、フロントから300msデバウンスで叩いて画面上部に警告表示する
- コンボ詳細または編集画面から「本登録に昇格」ボタンで仮登録→本登録への切替を実装する(FR010)
- PUT 確認ダイアログの文言を整理し、コピーモード時には表示しないことを保証する

### 1.3 このマイルストーンで作らないもの

- **本登録 → 仮登録の降格機能**: FR010 の要件は仮登録→本登録の一方向のみ。逆方向は実装しない(開発者判断で確定済み)
- **knockdown_advantage 変更時のセットプレイ引き継ぎ確認モーダル**(DES-005 §5.7): セットプレイは M4 で実装するため M2 では実装しない。差し込みポイントとして TODO コメントを残す
- **セットプレイ同時登録**(DES-005 §5.7 item 10): M4 で実装
- **タグ新規作成 UI**: M3 で実装。M2 では既存タグから選択するのみ(M1-06 方針継承)
- **modifiers.notes の画面表示処理**: M2-04 で実装(本指示書のスコープ外)
- **下書き自動保存**(FR603): M6 で実装
- **重複検知 API 単体の高速化(recipe_hash カラム追加)**: M1-03 §4.3.1 の議論にあるとおり、フェーズ1規模では不要。フェーズ2以降で性能問題が顕在化した場合に CHANGE 起票で再検討

---

## 2. 成果物

### 2.1 作成するファイル

#### バックエンド

```
internal/api/combo/
├── check_duplicate_handler.go        # 重複検知エンドポイントのハンドラ
└── check_duplicate_handler_test.go   # ハンドラのテスト

internal/service/combo/
└── service.go(修正): CheckDuplicate メソッド追加
```

#### フロントエンド

```
web/src/features/combo/
├── components/
│   ├── DuplicateRealtimeWarning.tsx       # 画面上部の動的警告バナー
│   ├── PromoteToFinalButton.tsx           # 「本登録に昇格」ボタンとフロー
│   └── PutConfirmDialog.tsx               # PUT 確認ダイアログ(M1-06 から分離・整理)
└── hooks/
    └── useCheckDuplicate.ts               # 重複検知 API 呼び出しフック(デバウンス付き)
```

### 2.2 修正するファイル

#### バックエンド

| ファイル | 修正内容 |
|---------|---------|
| `cmd/combomgr/main.go` | 重複検知エンドポイントのルート登録追加 |
| `internal/api/combo/routes.go`(または同等のルート登録ファイル) | `POST /api/combos/check-duplicate` のルート登録追加 |

#### フロントエンド

| ファイル | 修正内容 |
|---------|---------|
| `web/src/features/combo/api.ts` | `useCheckDuplicate` フックの追加(独立ファイル `useCheckDuplicate.ts` に分離するか `api.ts` に統合するかは Plan Mode で開発者と決定する) |
| `web/src/features/combo/components/ComboEditor.tsx` | コピーモードの状態管理、リアルタイム重複検知の組込、本登録昇格ボタンの組込、PUT 確認ダイアログの組込 |
| `web/src/features/combo/components/ComboList.tsx`(M1-05 で実装済み)| 各行に「コピー」ボタンを追加。クリックで `/combos/new?copyFrom={id}` へ遷移 |
| `web/src/features/combo/components/ComboDetail.tsx`(M1-05 で実装済み)| 「コピー」ボタンを追加(`/combos/new?copyFrom={id}` へ遷移)、仮登録の場合「本登録に昇格」ボタンを追加 |
| `web/src/pages/ComboEditorPage.tsx` | URL クエリパラメータ `copyFrom` の解釈、コピー元コンボの読み込み、`ComboEditor.tsx` への初期値投入 |
| `web/src/features/combo/utils.ts`(M1-06 で実装済み)| コピーモード時に `hasKeyChanges` を呼び出さない動線を ComboEditor 側で実装する。`utils.ts` 自体の修正は原則不要で、ComboEditor 側で `mode === "copy"` 分岐により `hasKeyChanges` 呼出を回避する。`utils.ts` への手入れが発生する場合は Plan Mode で開発者に相談 |

### 2.3 変更しないもの(原則)

- M1-03 で実装済みの既存 CRUD API(`POST /api/combos`、`GET /api/combos/:id`、`GET /api/combos`、`PATCH /api/combos/:id`、`PUT /api/combos/:id`、`DELETE /api/combos/:id`、`POST /api/combos/:id/restore`)
- M1-03 の `internal/service/combo/duplicate_keys.go`(`DuplicateCheckFields`、`CalcRecipeHash`)— 既存ロジックを再利用するのみで変更なし
- 既存マイグレーション(本指示書では DB スキーマ変更は不要)
- M1-05 のコンボ一覧・詳細画面の主要レイアウト(コピーボタン追加のみで他は触らない)
- M1-06 の `ComboEditorBasicFields.tsx`、`RecipeBuilder.tsx`、`StepRow.tsx`、`ValidationDisplay.tsx`、`DuplicateWarning.tsx`、`hasKeyChanges` のコアロジック
- M2-01 の `VirtualController/`、`ModifiersEditor.tsx`

### 2.4 例外: バックエンドへの最小限の追加が許容される箇所

本指示書のスコープに以下の2件の最小限のバックエンド変更を含む。これら以外のバックエンド変更は禁止する。

#### 2.4.1 重複検知エンドポイントの新設

§1.2 / §4.1 のとおり、`POST /api/combos/check-duplicate` を新設する。サービス層への `CheckDuplicate` メソッド追加も含む。

#### 2.4.2 UpdateMetadataInput への IsDraft フィールド追加(後方互換変更)

§4.5 で実装する仮登録 → 本登録の昇格機能のため、リポジトリ層の `UpdateMetadataInput` 構造体に `IsDraft *bool` フィールドを追加する。`*bool` 型のため:

- 既存の PATCH 呼出で `IsDraft` が指定されない場合は nil となり、is_draft カラムは更新されない(後方互換)
- 明示的に `*bool` で指定された場合のみ、is_draft カラムが更新される

ハンドラ層の PATCH リクエストボディ Bind にも `is_draft` フィールドを受け付ける形で対応する。サービス層 `UpdateMetadata` 内で「is_draft が true → false に切り替わる場合に本登録時のバリデーション(VAL-C01〜VAL-C12)を走らせる」分岐を追加する(M1-03 の現状実装で既に存在する場合は、そのロジックを利用してフィールド受け渡しのみ追加する)。詳細は §4.5.2 参照。

#### 2.4.3 それ以外の変更禁止

既存 API の振る舞い変更、リポジトリ層のインターフェース変更(上記2.4.2の構造体フィールド追加を除く)、既存マイグレーションへの変更は本指示書のスコープ外。万一実装中にこれらの変更が必要と判断した場合、Plan Mode で停止して開発者に相談すること。

---

## 3. 前提条件

### 3.1 必読ドキュメント

- `CLAUDE.md`(全体方針、§8 矛盾検出時の停止ルール)
- `docs/instructions/M2-overview.md`(M2 全体像、§6 運用ルール)
- `docs/design/05-screen-design.md`(画面設計書):
  - **§5.4** コンボ一覧(コピーボタン追加位置の文脈)
  - **§5.6** コンボ詳細(コピー・本登録昇格ボタン追加位置の文脈)
  - **§5.7** コンボ登録・編集(本指示書の中核、特にコピーモードの動作・リアルタイム重複検知)
- `docs/design/06-validation.md`(バリデーション設計書):
  - **§2.1** VAL-C01〜VAL-C12(本登録時の検証、特に **VAL-C02 重複判定**)
  - **§2.3** 重複判定のロジック(本指示書の重複検知 API の中核)
- `docs/design/supp-001-detailed-design.md`(設計補足):
  - **§2.2** 重複判定の完全一致ルールと `DuplicateCheckFields` の責務
  - **§3.1** 編集2方式分離(PATCH/PUT)の設計判断
- `docs/design/requirements.md`:
  - **FR010** 仮登録→本登録の昇格(本指示書では一方向のみ実装、開発者判断確定済み)
  - **FR012** コピー機能
  - **FR301** 重複登録防止(VAL-C02 で実装済み、本指示書ではリアルタイム検知に拡張)
  - **FR305** バリデーション結果の非ブロッキング表示
- `docs/instructions/M1-03-combo-crud-api.md`:
  - **§4.1** 既存 API エンドポイント一覧(本指示書はこれに `check-duplicate` を追加)
  - **§4.3** 重複判定ロジックと `DuplicateCheckFields`(再利用する既存ロジック)
  - **§4.3.1** recipe_hash の保存方式(on-the-fly 計算、本指示書も同方式)
- `docs/instructions/M1-06-combo-editor-page.md`:
  - **§4.4** 編集の2方式分離(PATCH/PUT 判定、`hasKeyChanges`)
  - **§4.4.3** 確認ダイアログ(本指示書で文言整理・コピーモード時の挙動確認)
  - **§4.5.1** 重複警告(`DuplicateWarning.tsx` の既存実装、本指示書で並存させる別コンポーネント `DuplicateRealtimeWarning.tsx` を作る)

### 3.2 任意参照(必要時のみ参照)

- `docs/design/02-architecture.md` §4.x(API 仕様の文脈、エラーコード設計の参考)
- `docs/design/03-data-model.md` §3.4 combos テーブル定義(重複判定キーの DB 構造確認用)
- `docs/instructions/M1-05-combo-list-detail-pages.md`(コンボ一覧・詳細画面の現状実装の参考)

### 3.3 参照不要

- DES-004 内部表現仕様書(本指示書では code 命名規則は新規追加しない)
- M1-01、M1-02、M1-04、M1-07、M2-01 指示書(本指示書のスコープと直接関わらない)

### 3.4 着手前の確認

製造担当 Claude Code は本指示書 §4 の実装に着手する前に、以下を確認する:

- M2-01 が完了し、`VirtualController/` および `ModifiersEditor.tsx` が動作する状態であること(`pnpm dev` で起動して確認)
- M1-03 の `internal/service/combo/duplicate_keys.go` に `DuplicateCheckFields` と `CalcRecipeHash` が実装済みであること(`grep -r "DuplicateCheckFields" internal/service/` で存在確認)
- M1-06 の `web/src/features/combo/utils.ts` に `hasKeyChanges` が実装済みであること

これらが満たされていない場合、Plan Mode で停止して開発者に状況報告すること。

---

## 4. 詳細仕様

### 4.1 重複検知 API(`POST /api/combos/check-duplicate`)

#### 4.1.1 エンドポイント仕様

| 項目 | 内容 |
|------|------|
| メソッド | POST |
| パス | `/api/combos/check-duplicate` |
| 認証 | なし(本プロジェクトはローカル/LAN 運用、M1 のままの方針) |
| 役割 | コンボ保存前に、入力内容が既存の本登録コンボと重複するかを判定して返す。**保存は行わない**。VAL-C02 と同じ判定ロジックを再利用するが、登録動作はしない |

#### 4.1.2 リクエストボディ

```json
{
  "characterId": 1,
  "starterMoveId": 12,
  "position": "midscreen",
  "opponentStance": "standing",
  "hitType": "normal",
  "opponentSize": "medium",
  "steps": [
    { "moveId": 12, "modifiers": { "flags": [], "type": "", "notes": "" } },
    { "moveId": 18, "modifiers": { "flags": ["link"], "type": "", "notes": "" } }
  ],
  "excludeComboId": 42
}
```

各フィールドの仕様:

- `characterId`、`starterMoveId`、`position`、`opponentStance`、`hitType`、`opponentSize`: 既存の重複判定キー(DES-006 §2.3、SUPP-001 §2.2、M1-03 §4.3 の `DuplicateCheckFields` と整合)
- `steps`: `combo_steps` 相当の配列。`moveId` と `modifiers`(SUPP-001 §3.3.0 の Modifiers 構造体)。`step_order` はクライアントから配列順で渡される
- `excludeComboId`: **編集モード時に自分自身のコンボIDを指定すると、重複判定対象から除外する**。新規登録時は省略または null。コピーモード時も省略(コピー元は別コンボとして扱う、自分自身ではないため)

#### 4.1.3 レスポンス

**重複なしの場合(200 OK)**:

```json
{
  "duplicates": []
}
```

**重複ありの場合(200 OK)**:

```json
{
  "duplicates": [
    {
      "id": 17,
      "characterId": 1,
      "starterMoveId": 12,
      "position": "midscreen",
      "opponentStance": "standing",
      "hitType": "normal",
      "opponentSize": "medium",
      "stepCount": 5
    }
  ]
}
```

各フィールドの仕様:

- `id`: 重複コンボの ID(コンボ詳細画面へのリンク先として使用)
- `characterId`: コンボのキャラクター ID(フロントで `useCharacters` フックを使ってキャラ名 `name_ja` を解決する)
- `starterMoveId`: 始動技 move ID(フロントで `useMovesByCharacter` フックを使って技名 `name_ja` を解決する)
- `position`、`opponentStance`、`hitType`、`opponentSize`: 状況コード値(フロントで状況コード値 → 表示ラベル変換関数を使って日本語表示にする。M1-05 / M1-06 で同じ変換を使っているはずなので再利用する)
- `stepCount`: combo_steps の件数

**重要**: `name_ja` などの表示文字列は **API レスポンスに含めない**。これは i18n への配慮および M1-05 のコンボ一覧画面と同じ責務分離(バックエンドは ID とコード値のみ返却、フロントで表示文字列を組み立てる)に従うため。

**バリデーションエラー(400 Bad Request)**:

リクエスト形式が不正な場合(必須フィールド欠落、型不一致など):

```json
{
  "error": "invalid request",
  "details": "characterId is required"
}
```

#### 4.1.4 サービス層の実装方針

`internal/service/combo/service.go` に以下のメソッドを追加:

```go
type Service interface {
    // ... 既存メソッド
    CheckDuplicate(ctx context.Context, input CheckDuplicateInput) (*CheckDuplicateResult, error)
}

type CheckDuplicateInput struct {
    CharacterID    int64
    StarterMoveID  int64
    Position       string
    OpponentStance string
    HitType        string
    OpponentSize   string
    Steps          []model.ComboStep
    ExcludeComboID *int64  // nil の場合は除外なし
}

type CheckDuplicateResult struct {
    Duplicates []DuplicateInfo
}

type DuplicateInfo struct {
    ID             int64
    CharacterID    int64
    StarterMoveID  int64
    Position       string
    OpponentStance string
    HitType        string
    OpponentSize   string
    StepCount      int
}
```

実装フローは M1-03 §4.3 の重複判定フローを再利用する:

1. 入力 `Steps` から `CalcRecipeHash()` で recipe_hash を計算
2. リポジトリ層の `FindByDuplicateKeys`(M1-03 で実装済み)で `character_id`、`starter_move_id`、`position`、`opponent_stance`、`hit_type`、`opponent_size` の一致条件で候補コンボを絞り込み(`is_draft = false AND deleted_at IS NULL` のみ対象、DES-006 §2.3)
3. 候補ごとに `combo_steps` をロードして `CalcRecipeHash()` でハッシュ計算
4. 入力 hash と各候補 hash を比較し、一致するコンボを `Duplicates` に追加
5. `Duplicates` の各要素には、コンボ ID と状況コード値、および combo_steps の件数(StepCount)を詰める。`name_ja` などの表示文字列は含めない(フロントで解決するため)
6. `ExcludeComboID` が指定されている場合、該当 ID のコンボは結果から除外

**重要**: 既存の `Create` / `UpdateWithKeyChange` の重複判定ロジックと**完全に同じ判定基準**を使うこと。コードの重複が気になる場合、内部ヘルパー関数として共通化してもよい(SUPP-001 §2.2 の方針通り「重複判定キーの変更は1箇所の修正で済むように」)。

**StepCount の取得**: `FindByDuplicateKeys` の戻り値が Combo 集約モデル(Steps 込み)を返す実装になっている場合は `len(combo.Steps)` で取得できる。Combo メタデータのみで Steps が空の場合は別途 combo_steps テーブルを引く必要がある。製造担当は M1-03 の現状実装を確認した上で選択する。

#### 4.1.5 ハンドラ層の実装方針

`internal/api/combo/check_duplicate_handler.go` に以下のハンドラを実装:

```go
func (h *Handler) CheckDuplicate(c echo.Context) error {
    var req CheckDuplicateRequest
    if err := c.Bind(&req); err != nil {
        return c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid request"})
    }

    // バリデーション(必須フィールドチェック)
    // ...

    input := combo.CheckDuplicateInput{ ... }
    result, err := h.service.CheckDuplicate(c.Request().Context(), input)
    if err != nil {
        return c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "internal error"})
    }

    return c.JSON(http.StatusOK, result)
}
```

エラーレスポンス形式は M1-03 §4.x の既存パターンに合わせること。

#### 4.1.6 ルート登録

`cmd/combomgr/main.go` または既存のルート登録ファイルで以下を追加:

```go
api.POST("/combos/check-duplicate", comboHandler.CheckDuplicate)
```

既存の `/combos` ルート群と並列で登録する。順序は問わない。

#### 4.1.7 パフォーマンス上の考慮

DES-005 §5.7 で「重複判定キーにはインデックスがあるため処理速度に影響は出ない」と記載されているとおり、`FindByDuplicateKeys` の SQL は M1-02 で確立されたインデックス(`combos(character_id, starter_move_id, position, opponent_stance, hit_type, opponent_size)` 等)を使用するため十分高速。デバウンス(300ms、§4.2.3)と組み合わせれば、過剰な API コールも防げる。

### 4.2 リアルタイム重複検知(フロント側)

#### 4.2.1 useCheckDuplicate フック

`web/src/features/combo/hooks/useCheckDuplicate.ts` に以下のフックを実装する:

```typescript
import { useEffect, useState } from "react";

export interface CheckDuplicateInput {
  characterId: number;
  starterMoveId: number | null;
  position: string;
  opponentStance: string;
  hitType: string;
  opponentSize: string;
  steps: ComboStepInput[];
  excludeComboId?: number;
}

export interface DuplicateInfo {
  id: number;
  characterId: number;
  starterMoveId: number;
  position: string;
  opponentStance: string;
  hitType: string;
  opponentSize: string;
  stepCount: number;
}

export function useCheckDuplicate(
  input: CheckDuplicateInput | null,
  options?: { debounceMs?: number; enabled?: boolean }
): {
  duplicates: DuplicateInfo[];
  isLoading: boolean;
  error: Error | null;
} {
  // 実装方針:
  // 1. input が null または enabled = false の場合は何もしない
  // 2. input 変更を 300ms デバウンス(options.debounceMs で上書き可)
  // 3. デバウンス完了後に POST /api/combos/check-duplicate を呼ぶ
  // 4. レスポンスを duplicates state に格納
  // 5. 連続呼出時、新しい呼出が走る前に古い呼出のレスポンスは破棄(競合状態回避、AbortController 利用)
}
```

#### 4.2.2 フックの使用箇所

`ComboEditor.tsx` で以下のように使用:

```typescript
const checkInput = isFormReadyForDuplicateCheck(formState)
  ? buildCheckDuplicateInput(formState, mode === "edit" ? combo.id : undefined)
  : null;

const { duplicates, isLoading } = useCheckDuplicate(checkInput, {
  debounceMs: 300,
  enabled: !isFormStateInvalid(formState),
});
```

`isFormReadyForDuplicateCheck` は「重複判定に必要な最小フィールドが揃っているか」を判定する小ユーティリティ(製造担当が `utils.ts` に追加する)。最低限以下が揃っていれば判定可能:

- `characterId` が選択済み
- `starterMoveId` が選択済み
- `steps` が1件以上ある
- `position`、`opponentStance`、`hitType`、`opponentSize` がすべて指定済み

これらが揃っていない場合は API 呼出をスキップする(無駄な 400 を発生させない)。

#### 4.2.3 デバウンス挙動

useCheckDuplicate 内部で 300ms のデバウンスを実装する。実装方法は製造担当が以下から選択:

- `setTimeout` + `clearTimeout` を `useEffect` で組み合わせる(標準的)
- `lodash.debounce` を使う(npm 追加が必要、可能なら避ける)
- カスタムフック `useDebounce(value, delay)` を内部で使う(自前実装でも数行)

**製造担当推奨**: 標準的な `useEffect` + `setTimeout` パターン(外部依存なし、テストしやすい)。

#### 4.2.4 競合状態の回避

input が連続して変化する間に古い API 呼出のレスポンスが後から返ってきて、新しい状態を上書きしてしまう問題を防ぐ:

- `AbortController` を使って、新しい呼出開始時に古い呼出をキャンセルする
- または、各呼出にシーケンス番号を持たせ、最新シーケンス以外のレスポンスは破棄する

**製造担当推奨**: `AbortController` パターン(fetch API 標準で対応)。

#### 4.2.5 DuplicateRealtimeWarning コンポーネント

`web/src/features/combo/components/DuplicateRealtimeWarning.tsx` に以下を実装:

```tsx
import type { DuplicateInfo } from "../hooks/useCheckDuplicate";

interface Props {
  duplicates: DuplicateInfo[];
  isLoading: boolean;
}

export function DuplicateRealtimeWarning({ duplicates, isLoading }: Props) {
  if (duplicates.length === 0) return null;

  // 表示文字列を合成
  const labelText = buildDuplicateLabel(duplicates[0]);

  return (
    <div role="alert" className="bg-yellow-100 border border-yellow-400 ...">
      <p>現在の入力内容は既存コンボ「{labelText}」と同一です。</p>
      <p>何かを変更して保存してください。</p>
      <a href={`/combos/${duplicates[0].id}`}>既存コンボの詳細を見る</a>
    </div>
  );
}
```

`buildDuplicateLabel` は表示文字列を合成するヘルパー関数。以下の情報源を使う:

- **キャラ名**: `useCharacters` フック(M1-05 / M1-06 で実装済み)を使って `characterId` から `name_ja` を解決
- **始動技名**: `useMovesByCharacter` フック(M1-06 で実装済み)を使って `starterMoveId` から `name_ja` を解決
- **状況コード値の日本語ラベル**: M1-05 / M1-06 で状況コード値(position / opponent_stance / hit_type / opponent_size)を日本語表示する変換関数が `web/src/features/combo/utils.ts` などに実装されているはず。これを再利用する(存在しない場合は新規作成、その場合は M1-05 / M1-06 のコンボ表示も同じ関数を使うようにリファクタリングを提案、ただしこれは Plan Mode で開発者と相談してから)

**表示フォーマット例**:

```
リュウ・中P / 画面中央 / 立ちガード / 通常ヒット / Mid (5ステップ)
```

正確な区切り文字や順序は M1-05 のコンボ一覧画面の表示パターンに揃える(製造担当が M1-05 の実装を確認してから揃える)。揃えるのが難しい場合(M1-05 が表で表示しており単一文字列形式と不整合など)は、バナー独自フォーマットで構わない(実装完了報告で採用フォーマットを明示)。

設置位置: `ComboEditor.tsx` のフォーム最上部(基本情報入力エリアの上)。DES-005 §5.7 の「画面上部に動的に警告表示」記述と整合。

`isLoading` 中の表示はオプション(製造担当の判断で「判定中...」と表示してもよいし、何も表示しなくてもよい。判定が頻繁に走るためチラつき防止のために何も表示しない方が UX 上望ましい場合もある)。

#### 4.2.6 既存の DuplicateWarning との関係

M1-06 §4.5.1 で実装済みの `DuplicateWarning.tsx` は **POST 時の重複エラー(VAL-C02)を受けた後の警告モーダル**であり、本指示書で実装する `DuplicateRealtimeWarning.tsx` とは役割が異なる:

| コンポーネント | 役割 | 表示タイミング |
|-------------|------|------------|
| `DuplicateWarning.tsx`(既存) | POST 時の VAL-C02 エラーを受けて表示するモーダル | 保存ボタン押下後 |
| `DuplicateRealtimeWarning.tsx`(新規) | 入力中のリアルタイム警告バナー | フォーム入力中、デバウンス後 |

両者は並存し、ユーザーが警告バナーを無視して保存ボタンを押した場合、POST API が VAL-C02 で 409 を返し、既存のモーダルが表示される。これは2段階のセーフティネットとして機能する。

### 4.3 コピー機能(FR012)

#### 4.3.1 動線の全体像

```
[コンボ一覧 / コンボ詳細]
   ↓ コピーボタンクリック
[/combos/new?copyFrom={id} へ遷移]
   ↓ ComboEditorPage が copyFrom を解釈
[コピー元コンボを GET /api/combos/{id} で取得]
   ↓ ComboEditor へ初期値投入(コピーモード)
[ユーザーが差分編集]
   ↓ 保存ボタン
[POST /api/combos で新規登録]
```

#### 4.3.2 ComboList.tsx / ComboDetail.tsx の修正

**ComboList.tsx**: 各行のアクション列に「コピー」ボタンを追加。クリックで `useNavigate` を使って `/combos/new?copyFrom={id}` へ遷移する。既存の編集ボタン・削除ボタンと並ぶ位置に配置。

**ComboDetail.tsx**: 画面上部のアクション領域に「コピー」ボタンを追加。クリックで同じく `/combos/new?copyFrom={id}` へ遷移する。

ボタンのテキストは「コピー」または「複製」(製造担当が UI 文脈で自然な方を選択、Tailwind のスタイルは既存の編集ボタン等に揃える)。

#### 4.3.3 ComboEditorPage.tsx の修正

URL クエリパラメータ `copyFrom` を解釈する:

```tsx
function ComboEditorPage() {
  const params = useParams();      // { id?: string }
  const [searchParams] = useSearchParams();
  const copyFromId = searchParams.get("copyFrom");

  // モード判定
  let mode: "new" | "edit" | "copy";
  let initialCombo: Combo | null = null;
  let isLoading = false;

  if (params.id) {
    mode = "edit";
    // 既存 GET /api/combos/:id で取得
  } else if (copyFromId) {
    mode = "copy";
    // GET /api/combos/{copyFromId} で取得 → initialCombo に投入
  } else {
    mode = "new";
  }

  return <ComboEditor mode={mode} initialCombo={initialCombo} ... />;
}
```

`mode = "copy"` 時の挙動:
- コピー元コンボの全情報をフォームに初期値として投入
- ID やタイムスタンプは投入せず、新規登録扱いとする
- 保存時は POST /api/combos で新規登録(編集2方式判定は走らない、`hasKeyChanges` 判定を回避)
- 仮登録/本登録のフラグはコピー元から引き継ぐ(ユーザーがフォーム上で is_draft トグルを操作することで切替可能)
- セットプレイは引き継がない(DES-005 §5.7「セットプレイは引き継がず、ユーザーが新規に追加する形」)。M2-02 ではセットプレイ自体が UI に存在しないためこの記述は将来の M4 への参考まで

#### 4.3.4 ComboEditor.tsx の修正

`mode` プロパティを `"new" | "edit" | "copy"` に拡張する。M1-06 では `"new" | "edit"` のみだったため、`"copy"` を追加する。

```tsx
interface ComboEditorProps {
  mode: "new" | "edit" | "copy";
  initialCombo?: Combo;
  ...
}

export function ComboEditor({ mode, initialCombo, ... }: ComboEditorProps) {
  // 初期化: mode === "copy" の場合、initialCombo の全情報をフォーム初期値に投入
  // 保存処理:
  //   - mode === "new" || mode === "copy" → POST /api/combos
  //   - mode === "edit" → hasKeyChanges 判定で PATCH/PUT 切替(M1-06 §4.4 と同じ)
  // ...
}
```

タイトル表示: コピーモード時は DES-005 §5.7 の「新規登録(コピー元:◯◯)」表記に従う。

#### 4.3.5 コピーモードでの PUT 確認ダイアログの抑止

§4.4 で定義する PUT 確認ダイアログは、コピーモードでは表示しない。なぜならコピーモードは新規登録扱いであり、PUT(キー変更編集)が発生しないため。`mode === "copy"` の場合は `hasKeyChanges` 判定をスキップして直接 POST へ進む。

### 4.4 PUT 確認ダイアログの整理(`PutConfirmDialog.tsx`)

#### 4.4.1 現状(M1-06 §4.4.3)

M1-06 では `ComboEditor.tsx` 内に直接実装され、PUT 時に「**この編集はコンボの再登録となります(古いコンボはゴミ箱へ移動)。続行しますか?**」と表示される。

#### 4.4.2 M2-02 での整理内容

- **コンポーネント分離**: `PutConfirmDialog.tsx` として独立したコンポーネントに分離する(ComboEditor.tsx の中の長いコードを整理する目的)
- **コピーモード時の抑止**: §4.3.5 のとおり、`mode === "copy"` の場合は表示されないことを保証する
- **文言の最終化**: M1-06 の文言をそのまま維持する(変更不要、開発者から特段の改善要望なし)

#### 4.4.3 表示条件の整理

| mode | hasKeyChanges | 確認ダイアログ |
|------|--------------|--------------|
| "new" | (該当なし、新規登録は常に POST) | 表示しない |
| "edit" | true(キー変更あり) | **表示する** |
| "edit" | false(メタデータのみ変更) | 表示しない(PATCH で直接更新) |
| "copy" | (該当なし、新規登録扱い) | 表示しない |

#### 4.4.4 注: knockdown_advantage 変更時の追加モーダル

DES-005 §5.7 に「knockdown_advantage が変わるためセットプレイ N件が成立しなくなる可能性があります。引き継ぎますか?」モーダルが定義されている。これは M4(セットプレイ実装後)で対応する。M2-02 では実装しない。

`ComboEditor.tsx` または `PutConfirmDialog.tsx` の該当箇所に以下のような TODO コメントを残す:

```tsx
// TODO: M4 でセットプレイ実装後、knockdown_advantage 変更時のセットプレイ引き継ぎ確認モーダルを追加
//       DES-005 §5.7「knockdown_advantage が変わるとセットプレイの成立条件が変わる」を実装する
```

### 4.5 仮登録 → 本登録の昇格 UI

#### 4.5.1 PromoteToFinalButton コンポーネント

`web/src/features/combo/components/PromoteToFinalButton.tsx` に以下を実装:

```tsx
interface Props {
  combo: Combo;
  onPromoted?: (updatedCombo: Combo) => void;
}

export function PromoteToFinalButton({ combo, onPromoted }: Props) {
  if (!combo.isDraft) return null;  // 本登録には表示しない

  const handlePromote = async () => {
    // 1. 確認ダイアログ「このコンボを本登録に昇格しますか? 本登録時のバリデーションが走ります」
    // 2. 確認後、PATCH /api/combos/:id で is_draft: false に更新
    // 3. レスポンスに validations.errors が含まれている場合、エラー表示(VAL-C02 重複等)
    //    → 昇格失敗、ユーザーは編集画面で内容を修正してから再昇格を試みる
    // 4. 成功時、onPromoted コールバックを呼び出す(コンボ詳細画面で表示更新等)
  };

  return <button onClick={handlePromote}>本登録に昇格</button>;
}
```

#### 4.5.2 昇格 API の挙動と着手前確認

##### バックエンド側の前提準備

§2.4.2 のとおり、本指示書のスコープで `UpdateMetadataInput` に `IsDraft *bool` を追加する。これに伴い以下の作業を行う:

1. **リポジトリ層の修正**:
   - `internal/repository/combo/repository.go` の `UpdateMetadataInput` 構造体に `IsDraft *bool` を追加
   - UPDATE SQL の組み立てロジックで「`IsDraft` が nil でない場合のみ is_draft カラムを更新する」分岐を追加
   - 既存テストへの影響なし(nil の場合の挙動は変わらない)

2. **ハンドラ層の修正**:
   - PATCH /api/combos/:id のリクエストボディ Bind 構造体に `is_draft *bool` を追加
   - フィールドの省略時は nil として扱う(JSON でフィールドが存在しない場合)

3. **サービス層の確認**:
   - 製造担当は実装着手前に M1-03 の `internal/service/combo/service.go` の `UpdateMetadata` メソッドを確認する
   - 確認内容: 「`is_draft = true → false` 切替時に本登録時のバリデーション(VAL-C01〜VAL-C12)を走らせる」分岐が既に実装されているか
   - **既に実装されている場合**: フィールド受け渡しの追加のみで完了
   - **未実装の場合**: 本指示書のスコープでこの分岐を追加する。サービス層に「PATCH 入力に `IsDraft = &false` が含まれていて、かつ現状コンボの is_draft が true の場合、本登録時のバリデーションを走らせる」ロジックを追加。バリデーションが失敗した場合(特に VAL-C02 重複)はエラーを返し、is_draft の更新を行わない
   - 確認結果と対応方針を Plan Mode で開発者に報告すること

##### フロント側の挙動

PATCH /api/combos/:id で `is_draft: false` を送信する。レスポンス想定:

- **成功(200)**: 本登録に昇格、レスポンスに更新後の Combo を含む
- **バリデーションエラー(400 または同等)**: validations にエラーが含まれる。VAL-C02(重複)が発生する可能性あり、その場合は既存の `DuplicateWarning.tsx` パターンで表示する。コンボは仮登録のまま残る

#### 4.5.3 設置場所

- **コンボ詳細画面(`ComboDetail.tsx`)**: 仮登録の場合、画面上部のアクション領域に「本登録に昇格」ボタンを表示
- **コンボ編集画面(`ComboEditor.tsx`)**: 仮登録のコンボを編集中の場合、フォーム下部の「保存」ボタンの近くに「本登録に昇格」ボタンを表示

#### 4.5.4 一方向の制約

FR010 は「仮登録を本登録に昇格できる」とあり、逆方向(本登録 → 仮登録への降格)は実装しない(開発者判断確定済み、§1.3 参照)。`PromoteToFinalButton` は本登録のコンボには表示されない仕様(`if (!combo.isDraft) return null`)で、「降格」ボタンは作らない。

万一ユーザーが本登録から仮登録に戻したいケースが発生した場合、現状は「一旦削除して、仮登録で再登録する」運用で代替する(運用上のワークアラウンド、UI で誘導しない)。

---

## 5. テスト要件

### 5.1 必須テスト

#### 5.1.1 バックエンド(Go test)

`internal/api/combo/check_duplicate_handler_test.go` に以下を実装:

- 正常系: 重複なしの入力 → 200 OK、`duplicates: []`
- 正常系: 重複ありの入力 → 200 OK、`duplicates: [{ id, label }]`
- 正常系: `excludeComboId` 指定 → 該当 ID は結果から除外される
- 正常系: 仮登録のコンボとは重複判定しない(DES-006 §2.3「`is_draft = false AND deleted_at IS NULL` のみ対象」)
- 正常系: 論理削除済みコンボとは重複判定しない
- 異常系: 必須フィールド欠落 → 400 Bad Request

`internal/service/combo/service_test.go` に以下を追加(または新規ファイル):

- `CheckDuplicate` メソッドの単体テスト(モックリポジトリで `FindByDuplicateKeys` の挙動を制御)
- recipe_hash 計算結果の一致判定が正しく動く(M1-03 の既存テストと同じ判定基準)

#### 5.1.2 フロントエンド(Vitest + React Testing Library)

`web/src/features/combo/hooks/useCheckDuplicate.test.ts`:

- 正常系: 入力に対して300ms後にAPIが呼ばれ、レスポンスが state に反映される
- デバウンス: 300ms 以内の連続入力では1回しか呼ばれない
- 競合回避: 連続呼出時、古いレスポンスは破棄される(モックで遅延レスポンスを再現)
- enabled = false: API は呼ばれない
- input = null: API は呼ばれない

`web/src/features/combo/components/DuplicateRealtimeWarning.test.tsx`:

- 重複なし: 何も表示されない(`null` 返却)
- 重複あり: 警告バナーが表示される(`role="alert"`、コンボ名、リンク)

`web/src/features/combo/components/PromoteToFinalButton.test.tsx`:

- 仮登録コンボ: ボタンが表示される
- 本登録コンボ: ボタンが表示されない(`null` 返却)
- クリック → 確認ダイアログ → 確認で PATCH 呼出 → 成功時 onPromoted コールバック発火
- VAL-C02 エラー時: エラー表示

`web/src/features/combo/components/PutConfirmDialog.test.tsx`:

- 表示条件マトリクス(§4.4.3)を網羅:
  - mode="new" → 表示しない
  - mode="edit" + hasKeyChanges=true → 表示する
  - mode="edit" + hasKeyChanges=false → 表示しない
  - mode="copy" → 表示しない

`web/src/pages/ComboEditorPage.test.tsx`(または既存テスト):

- `?copyFrom=42` を含む URL でアクセス時、GET /api/combos/42 が呼ばれ、`mode="copy"` で `ComboEditor` が初期化される

### 5.2 E2E シナリオ(開発者がブラウザで手動実行)

製造担当 Claude Code は **動作確認手順書** として以下を実装完了報告に含める。開発者がブラウザで以下を実行して動作確認する。

```
## E2E シナリオ A: コピー機能(FR012)

1. 既存の本登録コンボがある状態で、コンボ一覧画面を開く
2. 任意のコンボの「コピー」ボタンをクリック
3. URL が `/combos/new?copyFrom={id}` に変わる
4. コンボ登録画面が開き、コピー元の全情報がフォームに初期値として入っている
5. タイトル表示が「新規登録(コピー元:◯◯)」になっている
6. 何も変更せずに「保存」ボタンを押す → リアルタイム重複警告が表示されているはず(シナリオ B で確認)
7. 何かを変更(例: メモを編集)してから「保存」 → 新規コンボとして登録される
8. コンボ一覧に戻り、コピー元と新規コンボの両方が存在することを確認
9. コンボ詳細画面でも「コピー」ボタンが動作することを確認

## E2E シナリオ B: リアルタイム重複検知

1. コンボ登録画面を開く(新規登録モード)
2. 既存コンボと同じキャラ・始動技・状況・レシピを入力していく
3. 必要なフィールドが揃った時点で、画面上部に「現在の入力内容は既存コンボ『◯◯』と同一です。何かを変更して保存してください」と警告バナーが表示される
4. 警告バナーから「既存コンボの詳細を見る」リンクをクリック → 該当コンボ詳細画面に遷移する
5. 戻って、何か1項目変更(例: position を変える) → 警告バナーが消える(300ms 程度の遅延あり)
6. 編集モードでも動作確認: 既存コンボの編集画面を開き、別の既存コンボと同じ内容に変えていくと警告バナーが表示される
7. 編集モード時、自分自身のコンボ ID は除外されている(自分と一致しても警告は出ない)ことを確認

## E2E シナリオ C: 仮登録 → 本登録の昇格(FR010)

1. 仮登録のコンボを作成する(is_draft = true で保存)
2. コンボ詳細画面を開く → 「本登録に昇格」ボタンが表示されている
3. ボタンをクリック → 確認ダイアログ表示
4. 確認 → PATCH 呼出 → 成功 → 詳細画面が本登録表示に更新される(「本登録に昇格」ボタンが消える)
5. 本登録に昇格できないケース(VAL-C02 重複)を試す:
   a. 同じ内容の本登録コンボを別途用意
   b. 仮登録のコンボから「本登録に昇格」をクリック → 重複エラー表示
   c. 仮登録のままで残ることを確認
6. 編集画面でも「本登録に昇格」ボタンが動作することを確認(仮登録の編集画面を開いた状態で)

## E2E シナリオ D: PUT 確認ダイアログの整理

1. 既存の本登録コンボを編集モードで開く
2. メタデータのみ変更(例: メモのみ変更) → 保存 → 確認ダイアログは表示されない、PATCH で直接更新される
3. キー変更(例: レシピ変更) → 保存 → 確認ダイアログ「この編集はコンボの再登録となります...」が表示される
4. 「続行する」 → PUT 呼出 → 旧コンボがゴミ箱に、新コンボが登録される
5. コピーモード(`?copyFrom={id}`)で開いた画面で、何か変更して保存 → 確認ダイアログは表示されない(新規登録扱い)
```

開発者は上記4シナリオを実行して動作確認する。製造担当が実装完了報告に「動作確認手順書」として上記シナリオを再掲する。

---

## 6. レビュー観点(別ファイル参照)

製造担当 Claude は本節を読む必要はない。

レビュー観点は以下の別ファイルに分離されている:

- **`docs/instructions/reviews/M2-02-review-checklist.md`**

(本チェックリストファイルは M2-02 指示書とセットで設計担当が別途作成する)

---

## 7. 完了条件(Definition of Done)

### 7.1 機能要件

- [ ] §2.1 のファイルが全て作成されている(バックエンド2ファイル + フロントエンド4ファイル)
- [ ] §2.2 の修正ファイルが修正されている
- [ ] §5.1 の必須テスト(Go test、Vitest)が全通過する
- [ ] §5.2 の E2E シナリオ A〜D が動作する(動作確認手順書として実装完了報告に再掲)

### 7.2 自己テスト結果(製造担当の責任範囲)

製造担当 Claude Code は以下を実施し、結果を実装完了報告に貼付する。

#### バックエンド側

- [ ] `make test` または `go test ./...` が全通過する
- [ ] `POST /api/combos/check-duplicate` を `curl` で叩き、以下のレスポンスを実装完了報告に貼付:
  - 正常系(重複なし): リクエスト・レスポンス
  - 正常系(重複あり): リクエスト・レスポンス
  - 異常系(400): リクエスト・レスポンス
- [ ] `excludeComboId` 指定時の挙動を `curl` で確認、レスポンスを貼付
- [ ] 仮登録コンボとの重複判定がスキップされることを `curl` で確認

#### フロントエンド側

- [ ] `pnpm test`(Vitest)が全通過する
- [ ] `pnpm build` が成功する
- [ ] TypeScript の型エラーが残っていない(`pnpm tsc --noEmit` で確認)
- [ ] 開発サーバー起動時にコンソール警告が新規発生していない(製造担当が `pnpm dev` の出力ログで判断)
- [ ] §5.2 の動作確認手順書を実装完了報告に再掲

ブラウザでの実機動作確認・スクリーンショット取得は **開発者の責任範囲** であり、製造担当は実行しない(M2-overview §6.5.2)。

### 7.3 品質チェック

- [ ] CLAUDE.md の禁止事項に抵触していない(localStorage 使用なし、git 操作なし 等)
- [ ] `console.log` を本番コードに残していない
- [ ] 設計書本体(DES-005 §5.7、DES-006 §2.1 / §2.3、SUPP-001 §2.2 / §3.1)と実装が一致している。差異がある場合は CHANGE 起票を提案する
- [ ] M1-03 の既存サービス層メソッド(`Create`、`UpdateMetadata`、`UpdateWithKeyChange`)を破壊していない
- [ ] M1-06 の `hasKeyChanges`、`DuplicateWarning.tsx` の挙動を破壊していない(リグレッションなし)
- [ ] M2-01 の `VirtualController/`、`ModifiersEditor.tsx` の挙動を破壊していない(リグレッションなし)
- [ ] M1-03 §4.3 の `DuplicateCheckFields` と本指示書の重複判定キーが完全一致している(SUPP-001 §2.2 の責務に従う)

### 7.4 ドキュメント

- [ ] `docs/progress/progress-log.md` の M2-02 完了セクションに以下を追記:
  - 実装内容のサマリ
  - §5.2 の E2E シナリオ実行結果(製造担当が確認可能な範囲)
  - 既知の制限事項: M2-02 期間担当の方針として、`m1-known-limitations.md` 等の独立ファイルは作成せず、`progress-log.md` への統合記載で運用継続する。M2-02 で発生した既知の制限事項が存在する場合のみ、`progress-log.md` に新しいセクション見出し「## M2-02 完了時点の既知の制限事項」を追加して記載する(M1 完了時点の制限事項セクションと区別する)。発生しない場合はセクション追加自体を行わない(空セクションを作らない)

### 7.5 完了報告

- [ ] 開発者に「M2-02 が完了しました」と報告する
- [ ] §7.2 の自己テスト結果と §5.2 の動作確認手順書を報告に含める
- [ ] レビュー担当(別 Claude Code セッション)へ §6 のチェックリストファイルを案内する(レビュー担当の起動は開発者が実施)

---

## 8. 参照ドキュメント

| ID | パス | 参照箇所 |
|----|------|----------|
| CLAUDE.md | `CLAUDE.md` | 全体方針、§8 矛盾検出時の停止ルール |
| M2-overview | `docs/instructions/M2-overview.md` | M2 全体像、§6 運用ルール |
| DES-005 | `docs/design/05-screen-design.md` | §5.4 / §5.6 / §5.7(中核、特に §5.7 のコピーモード・リアルタイム重複検知) |
| DES-006 | `docs/design/06-validation.md` | §2.1 VAL-C02、§2.3 重複判定ロジック(中核) |
| SUPP-001 | `docs/design/supp-001-detailed-design.md` | §2.2 重複判定の責務、§3.1 編集2方式分離 |
| REQ-001 | `docs/design/requirements.md` | FR010 / FR012 / FR301 / FR305 |
| M1-03 | `docs/instructions/M1-03-combo-crud-api.md` | §4.1 既存 API、§4.3 重複判定ロジック、§4.3.1 recipe_hash |
| M1-06 | `docs/instructions/M1-06-combo-editor-page.md` | §4.4 編集2方式、§4.4.3 確認ダイアログ、§4.5.1 重複警告 |
| HANDOVER-001 | `docs/handover/handover_1.md` | §3.1 編集方式分離の経緯 |

---

## 9. 注意事項・判断に迷ったら

### 9.1 推測で進めてはいけない事項

- 重複判定キー(`DuplicateCheckFields`、SUPP-001 §2.2)を厳守する。本指示書では既存定義を再利用するのみで、追加・削除しない
- recipe_hash アルゴリズム(M1-03 §4.3、SHA-256、modifiers 含む)を厳守する。新規実装で別アルゴリズムを使わない
- 編集2方式分離(M1-06 §4.4 の `hasKeyChanges`)のロジックを破壊しない
- バックエンド既存 API の振る舞いを変更しない(本指示書のスコープ外、変更必要時は Plan Mode で停止)
- 本登録 → 仮登録の降格機能を実装しない(FR010 範囲外、開発者確定済み)

### 9.2 推測で進めてよい事項(その旨を明示)

以下は本指示書で詳細を確定していない領域。製造担当が実装し、判断の根拠を実装完了報告で明示すること。「推測した内容」を明記する。

- `DuplicateRealtimeWarning` の表示文字列フォーマット(§4.2.5 参照)。M1-05 のコンボ一覧画面の表示パターンに揃えるのが望ましいが、揃えるのが難しい場合は警告バナー独自フォーマットで構わない。採用したフォーマットを実装完了報告で明示
- 状況コード値 → 表示ラベル変換関数の置き場所(M1-05 / M1-06 で既存のものを再利用、存在しない場合は `web/src/features/combo/utils.ts` に追加)
- `DuplicateRealtimeWarning` のスタイル詳細(警告色は黄色系、Tailwind デフォルトで構わない)
- コピーボタンのテキスト(「コピー」「複製」のいずれでも可)、配置位置(既存ボタン群と並ぶ位置で自然に)
- `PromoteToFinalButton` の確認ダイアログ文言(指示書 §4.5.1 の例文をベースに微調整可)
- `PutConfirmDialog` のスタイル(M1-06 の既存実装を踏襲)
- デバウンス実装手法(`setTimeout` か `useDebounce` カスタムフックか、製造担当推奨)
- 競合回避手法(`AbortController` か シーケンス番号方式か、製造担当推奨)

### 9.3 不明事項発見時の対応

1. **設計書本体との矛盾を発見した場合**: CLAUDE.md §8 に従い、Plan Mode で停止して開発者に確認する。CHANGE 起票が必要な場合は設計担当の対応となるため、開発者経由で連絡する
2. **M1-03 / M1-06 / M2-01 既存実装と本指示書の矛盾を発見した場合**: 同上、Plan Mode で停止して開発者に確認する
3. **M1-03 のサービス層メソッド・型定義が想定と異なる場合**(例: `FindByDuplicateKeys` のシグネチャが §4.1.4 で前提としたものと異なる): Plan Mode で停止し、現状の M1-03 実装を踏まえた本指示書の差分案を提示して開発者と確定する

### 9.4 Plan Mode で計画提示時に含めるべき項目(必須)

本指示書は Plan Mode 必須(複数機能の関心が絡むため)。以下を Plan Mode で開発者に提示すること:

- §3.4 の着手前確認結果(M2-01 動作確認、`DuplicateCheckFields` 存在確認、`hasKeyChanges` 存在確認)
- §4.5.2 の M1-03 サービス層 `UpdateMetadata` 確認結果(is_draft 切替時のバリデーション分岐の有無、対応方針)
- バックエンド側のファイル構成方針(`check_duplicate_handler.go` を独立させるか、既存の `handler.go` に追加するか)
- サービス層 `CheckDuplicate` メソッドの内部実装(既存ロジックの再利用範囲、共通化するヘルパーの有無)
- `UpdateMetadataInput` への `IsDraft *bool` 追加の実装方針(リポジトリ層 UPDATE SQL の動的構築方法)
- フロントエンド側のフック構成(`useCheckDuplicate` を独立ファイルにするか、`api.ts` に統合するか)
- `DuplicateRealtimeWarning` の表示文字列フォーマット案(M1-05 と揃える方針か、独自フォーマットか)
- 状況コード値 → 表示ラベル変換関数の所在(既存利用 or 新規作成)
- デバウンス実装手法(製造担当推奨)
- 競合回避手法(製造担当推奨)
- §4.5 昇格 UI のエラーハンドリング方針(VAL-C02 重複時の UI 動作)
- E2E シナリオ A〜D の実行可能性(M2-01 までの実装で前提条件が満たされているか)

---

## 10. 完了後の次ステップ

M2-02 完了後、開発者の承認を得て M2-03(ゴミ箱画面)に進む。

M2-03 着手時には、本指示書で実装したコピー機能・リアルタイム重複検知・本登録昇格・PUT 確認ダイアログが安定動作していることが前提となる。M2-02 で発見されたバグや改善点が発生した場合、M2-03 着手前に開発者と協議して対応方針を決める(その場で修正する、CHANGE 起票する、後続マイルストーンに送る等)。

---

*以上*

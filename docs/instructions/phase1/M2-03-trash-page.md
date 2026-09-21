# 指示書 M2-03: ゴミ箱画面

| 項目 | 内容 |
|------|------|
| 指示書ID | M2-03 |
| バージョン | 1.0.0 |
| 対象マイルストーン | M2(編集系の本格化) |
| 推奨モデル | **Sonnet 4.6** |
| Plan Mode | **任意**(Plan Mode で計画提示すると安全だが、必須ではない) |
| 機械レビュー | **必須**(別チェックリスト: `docs/instructions/reviews/M2-03-review-checklist.md`) |
| 並列性 | **単独**(M2 は完全直列、M2-02 完了が前提) |
| 依存指示書 | M1-03(コンボ CRUD API、`Restore` 実装の確認)、M1-04(`RecomputeComboCache` / `DeleteComboCache`)、M1-05(コンボ一覧・詳細画面、UI 流用元)、M2-02(編集系 UX 改善、特に `is_draft` トグルや構造化フィールド表示の参考) |
| 想定所要時間 | 90〜120 分 |
| 作成者 | 詳細設計・製造準備担当Claude(M2 期間担当) |
| 作成日 | 2026-05-07 |

## 更新履歴

| バージョン | 更新日 | 更新内容 |
|-----------|--------|----------|
| 1.0.0 | 2026-05-07 | 初版作成 |

---

## 1. 背景と目的

### 1.1 背景

M1 期間でコンボの論理削除(`DELETE /api/combos/:id`)・復元(`POST /api/combos/:id/restore`)の API は実装済み。しかし、ゴミ箱を閲覧・操作する画面 UI は未実装で、「論理削除はされるが画面でその状態を見られない」状態になっている。M1-03 期間担当が先回りで `GET /api/combos?include_deleted=true` を実装してくれているが、ゴミ箱画面がそれを使っていない。

加えて、論理削除済みコンボを **完全削除(物理削除)** する API は M1 期間で未実装。設計書 DES-005 §5.15 では「完全削除ボタン → 確認ダイアログ後、物理削除」が要件として明記されている。

SUPP-001 §7.2 のサービス層責務一覧では「`restore.go`(ゴミ箱からの復元)→ `RecomputeComboCache`」が指定されている。M1-03 の `Restore` メソッドが既にこの呼出を組み込んでいるかは未確認。

### 1.2 目的

- `/trash` ページを新設し、論理削除済みコンボの一覧表示・詳細表示・復元・完全削除が UI から行えるようにする(DES-005 §5.15)
- 完全削除 API(`DELETE /api/combos/:id/permanent`)を新設し、完全削除 UI を支える
- 既存 `GET /api/combos` に `only_deleted=true` クエリパラメータを追加し、ゴミ箱画面が論理削除済みコンボのみを取得できるようにする
- M1-03 `Restore` の現状確認結果に応じて `RecomputeComboCache` 連動を追加し、復元後のコンボがコンボ一覧で正しくレシピ表示される状態を保証する(§3.4.1 / §4.6 参照)
- 一括復元・一括完全削除 UI を実装する(DES-005 §5.15)

### 1.3 このマイルストーンで作らないもの

- **セットプレイのゴミ箱表示**: DES-005 §5.15 では「コンボ・セットプレイ一覧」と記載があるが、セットプレイは M4 で実装。M2-03 ではコンボのみ扱う。セットプレイ用の領域は将来追加できる構造で残しておく(完全実装は不要)
- **自動物理削除(90日超過分の cron 的バックグラウンド処理)**: フェーズ2以降で実装。M2-03 では「自動完全削除までの残日数」表示のみ行う(計算ロジックは UI 側で実装、バックエンドの cron は未実装)
- **タグフィルタ・状況フィルタ**: コンボ一覧(DES-005 §5.4)では実装される予定だが、M2-03 のゴミ箱画面ではキャラ別表示のみで足りる(M3 でゴミ箱画面にも拡張可能)
- **表示列のカスタマイズ**(DES-005 §5.4 で言及): コンボ一覧画面の機能であり、ゴミ箱画面では実装しない
- **削除日時のタイムゾーン整理**: 表示は素朴にローカル時刻で行う(国際化は M7)

---

## 2. 成果物

### 2.1 作成するファイル

#### バックエンド

```
internal/api/combo/
├── permanent_delete_handler.go        # 完全削除エンドポイントのハンドラ(独立ファイル化するか handler.go に追加するかは Plan Mode で決定)
└── permanent_delete_handler_test.go   # ハンドラのテスト
```

`permanent_delete_handler.go` を独立ファイルにするか、既存 `handler.go` に追加するかは Plan Mode で開発者と相談して決めること。M2-02 の `check_duplicate_handler.go` と同じ判断軸で選択する。

#### フロントエンド

```
web/src/pages/
└── TrashPage.tsx                      # /trash ページの本体

web/src/features/combo/
├── components/
│   ├── TrashList.tsx                  # ゴミ箱コンボ一覧テーブル
│   ├── TrashListRow.tsx               # ゴミ箱コンボ一覧の各行(削除日時・残日数表示・復元/完全削除ボタン)
│   ├── TrashBulkActions.tsx           # 一括復元・一括完全削除のツールバー
│   └── PermanentDeleteConfirm.tsx     # 完全削除の確認ダイアログ
└── hooks/
    ├── useTrashCombos.ts              # ゴミ箱コンボ取得フック(GET /api/combos?only_deleted=true 利用)
    └── usePermanentDelete.ts          # 完全削除 API 呼出フック
```

各ファイルの責務は §4 で詳述する。

### 2.2 修正するファイル

#### バックエンド

| ファイル | 修正内容 |
|---------|---------|
| `cmd/combomgr/main.go`(または既存のルート登録ファイル) | `DELETE /api/combos/:id/permanent` のルート登録追加 |
| `internal/repository/combo/repository.go`(または同等) | `FindCombos`(または同等の一覧取得関数)に `OnlyDeleted bool` パラメータを追加。WHERE 句に `deleted_at IS NOT NULL` 条件を含める分岐を実装 |
| `internal/api/combo/handler.go`(または一覧ハンドラ) | クエリパラメータ Bind に `only_deleted` を追加し、リポジトリ層に渡す |
| `internal/service/combo/service.go`(または `restore.go`) | M1-03 の `Restore` 実装で `RecomputeComboCache` 呼出が**未実装の場合のみ**、追加実装(§4.6 参照) |
| `internal/api/combo/handler.go` または `permanent_delete_handler.go` | ハンドラに `PermanentDelete` メソッド追加 |
| `internal/service/combo/service.go` または専用ファイル | サービス層に `PermanentDelete` メソッド追加 |
| `internal/repository/combo/repository.go` | リポジトリ層に物理削除メソッド追加(`HardDelete` 等) |

#### フロントエンド

| ファイル | 修正内容 |
|---------|---------|
| `web/src/App.tsx` または `web/src/router.tsx`(M1 期間で確立されたルーティング設定ファイル) | `/trash` ルートの追加(`<Route path="/trash" element={<TrashPage />} />`) |
| `web/src/components/Header.tsx`(または共通ヘッダ) | ゴミ箱画面へのナビゲーションリンク追加 |
| `web/src/features/combo/api.ts` | `useTrashCombos` および `usePermanentDelete` フックの追加(独立ファイルに分離するか `api.ts` に統合するかは M2-02 と同じ判断軸で選択) |

### 2.3 変更しないもの(原則)

- M1-03 の既存 API(POST、GET、PATCH、PUT、DELETE、restore)の振る舞い(`GET /api/combos` への `only_deleted` パラメータ追加は §2.4 例外条項で許容、それ以外は変更しない)
- M1-04 の `RecomputeComboCache` / `DeleteComboCache` のメソッド実装(呼び出すのみで、メソッド自体は変更しない)
- M1-05 のコンボ一覧・詳細画面(ゴミ箱画面はこれを参考にするが、コンボ一覧画面そのものは変更しない)
- M1-06 のコンボ編集画面、M2-01 の仮想コントローラ、M2-02 のコピー/重複検知/昇格機能(本指示書のスコープ外)
- 既存マイグレーション(combos テーブルへのカラム追加は不要)

### 2.4 例外: バックエンドへの最小限の追加が許容される箇所

本指示書のスコープに以下の3件の最小限のバックエンド変更を含む。これら以外のバックエンド変更は禁止する。

#### 2.4.1 完全削除エンドポイントの新設

`DELETE /api/combos/:id/permanent` を新設する。サービス層への `PermanentDelete` メソッド追加、リポジトリ層への物理削除メソッド追加も含む。

#### 2.4.2 GET /api/combos への only_deleted パラメータ追加(後方互換変更)

§4.3 のとおり、既存 `GET /api/combos` のクエリパラメータに `only_deleted` を追加する。仕様:

- `only_deleted=true`: 論理削除済みコンボのみ返却(`WHERE deleted_at IS NOT NULL`)
- `only_deleted=false` または省略: 既存挙動を維持(`only_deleted` を考慮しない)
- 既存の `include_deleted=true` パラメータと併用された場合: `only_deleted=true` が優先する(論理削除のみが返る)

これは **既存 PATCH 呼出やコンボ一覧画面の挙動を一切変えない後方互換変更** であり、リポジトリ層の WHERE 句に1分岐を追加するだけで済む。

#### 2.4.3 Restore サービス層での RecomputeComboCache 連動(条件付き)

§4.6 のとおり、M1-03 の `Restore` メソッド実装で `RecomputeComboCache` 呼出が **未実装の場合のみ** 追加する。**既に実装されている場合は変更不要**。製造担当は着手前に M1-03 の `internal/service/combo/restore.go`(または同等)を確認し、現状を Plan Mode で報告すること(§3.4 参照)。

#### 2.4.4 それ以外の変更禁止

既存 API の振る舞い変更(上記 2.4.2 以外)、リポジトリ層のインターフェース変更(上記 2.4.1〜2.4.3 以外)、既存マイグレーションへの変更は本指示書のスコープ外。万一実装中にこれらの変更が必要と判断した場合、Plan Mode で停止して開発者に相談すること。

---

## 3. 前提条件

### 3.1 必読ドキュメント

- `CLAUDE.md`(全体方針、§8 矛盾検出時の停止ルール)
- `docs/instructions/M2-overview.md`(M2 全体像、§6 運用ルール)
- `docs/design/05-screen-design.md`(画面設計書):
  - **§5.4** コンボ一覧(UI 流用元、§5.15 ゴミ箱はこれの読み取り専用版に近い)
  - **§5.15** ゴミ箱(本指示書の中核)
- `docs/design/03-data-model.md`(データモデル設計書):
  - **§3.4** combos テーブル定義(`deleted_at` カラム、論理削除の前提)
- `docs/design/supp-001-detailed-design.md`(設計補足):
  - **§7.1** サービス層責務一覧(`RecomputeComboCache` / `DeleteComboCache` の責務)
  - **§7.2** 呼出元の責務(特に「`restore.go`(ゴミ箱からの復元)→ `RecomputeComboCache`」の対応関係、本指示書 §4.6 で確認する)
- `docs/design/requirements.md`:
  - **FR014**(または同等)論理削除と復元の要件
- `docs/instructions/M1-03-combo-crud-api.md`:
  - **§4.1** 既存 API エンドポイント一覧(本指示書はこれに `permanent` を追加)
  - **§4.10** リスト API のフィルタとソート(本指示書はこれに `only_deleted` を追加)
  - **§4.11** 集約モデル運用規約(N+1 防止策、ゴミ箱一覧でも遵守)
  - **Restore メソッド実装**: `internal/service/combo/restore.go` の現状確認のため(§3.4 参照)
- `docs/instructions/M1-04-presets-and-recipe-cache.md`:
  - **§4.3.2** `RecomputeComboCache`(復元時に呼ぶ可能性あり、§4.6 参照)
  - **§4.3.3** `DeleteComboCache`(論理削除時に呼ばれる、本指示書では呼び出し側ではない)

### 3.2 任意参照(必要時のみ参照)

- `docs/instructions/M1-05-combo-list-detail-pages.md`(コンボ一覧・詳細画面の現状実装、UI 流用パターンの参考)
- `docs/instructions/M2-02-edit-ux-improvements.md`(編集系 UX 改善で実装したコピーボタンや本登録昇格 UI のパターンを参考にする場合)

### 3.3 参照不要

- DES-004 内部表現仕様書(本指示書では code 命名規則は新規追加しない)
- DES-006 バリデーション設計書(本指示書ではバリデーションロジックの追加なし。完全削除前のバリデーションは「論理削除済みであること」のみで足りる)
- M1-01、M1-02、M1-07、M2-01 指示書(本指示書のスコープと直接関わらない)

### 3.4 着手前の確認

製造担当 Claude Code は本指示書 §4 の実装に着手する前に、以下を確認する。**結果を Plan Mode で開発者に報告すること**。

#### 3.4.1 M1-03 の Restore 実装の現状確認

`internal/service/combo/restore.go`(または同等のファイル)を確認:

- [ ] `Restore(ctx, id)` メソッドの実装内容を読む
- [ ] `RecomputeComboCache` 呼出が含まれているかを確認
- [ ] **含まれている場合**: §4.6 のスコープは不要、本指示書では Restore に手を入れない
- [ ] **含まれていない場合**: §4.6 のとおり追加実装する。Plan Mode で「Restore に RecomputeComboCache 呼出を追加する」と報告

#### 3.4.2 M2-02 の状態確認

- [ ] M2-02 が完了し、コピー・重複検知・本登録昇格・PUT 確認ダイアログが動作する状態であること(`pnpm dev` で起動して動作確認)
- [ ] `M2-02-edit-ux-improvements.md` v1.1.0 の §2.4.2 で追加された `UpdateMetadataInput.IsDraft *bool` が動作していること

#### 3.4.3 M1-04 の RecomputeComboCache の存在確認

- [ ] `internal/service/notation/`(または同等)に `RecomputeComboCache` メソッドが実装されていること(`grep -r "func.*RecomputeComboCache" internal/service/`)

#### 3.4.4 combo_steps の物理削除挙動確認

- [ ] `combo_steps` テーブルの `combo_id` 外部キー制約が `ON DELETE CASCADE` 設定されていること(`grep -r "FOREIGN KEY.*combo_id" internal/db/migrations/`)
- [ ] **設定されている場合**: §4.5 完全削除実装で combos の DELETE のみで combo_steps が連動削除される
- [ ] **設定されていない場合**: Plan Mode で報告し、リポジトリ層 `HardDelete` で combo_steps の DELETE も行うかを開発者と確認(本指示書では `ON DELETE CASCADE` 前提で記述、異なる場合は Plan Mode で対応方針確定)

これらが満たされていない場合、Plan Mode で停止して開発者に状況報告すること。

---

## 4. 詳細仕様

### 4.1 完全削除 API(`DELETE /api/combos/:id/permanent`)

#### 4.1.1 エンドポイント仕様

| 項目 | 内容 |
|------|------|
| メソッド | DELETE |
| パス | `/api/combos/:id/permanent` |
| 認証 | なし(本プロジェクトはローカル/LAN 運用、M1 のままの方針) |
| 役割 | 論理削除済みコンボを物理削除する(combos テーブルから DELETE)。recipe_cache は既に NULL のため、追加処理は不要(combo_steps は外部キー CASCADE で連動削除) |

#### 4.1.2 リクエスト

リクエストボディなし。URL パスパラメータのみ:

- `:id`: 削除対象コンボの ID

#### 4.1.3 レスポンス

**成功(204 No Content)**:

レスポンスボディなし。

**コンボが見つからない(404 Not Found)**:

```json
{
  "error": "combo not found"
}
```

**コンボがゴミ箱にない(409 Conflict)**:

```json
{
  "error": "combo is not in trash",
  "details": "permanent delete requires the combo to be soft-deleted first"
}
```

`deleted_at IS NULL`(論理削除されていない通常コンボ)に対する完全削除は許可しない。これは「ゴミ箱経由でしか完全削除できない」という安全策(誤操作防止)。

#### 4.1.4 サービス層の実装方針

`internal/service/combo/service.go`(または `permanent_delete.go` を新設)に以下を追加:

```go
type Service interface {
    // ... 既存メソッド
    PermanentDelete(ctx context.Context, id int64) error
}

func (s *service) PermanentDelete(ctx context.Context, id int64) error {
    // 1. コンボ取得(ID で)
    // 2. 存在チェック → 404
    // 3. 論理削除済みチェック(deleted_at IS NOT NULL)→ 違う場合 409
    // 4. リポジトリ層の HardDelete を呼ぶ(トランザクション内、combo_steps は CASCADE で連動)
    // 5. recipe_cache の整理は不要(既に NULL)
}
```

#### 4.1.5 リポジトリ層の実装方針

`internal/repository/combo/repository.go` に以下を追加:

```go
type Repository interface {
    // ... 既存メソッド
    HardDelete(ctx context.Context, tx *sql.Tx, id int64) error
}

func (r *repository) HardDelete(ctx context.Context, tx *sql.Tx, id int64) error {
    _, err := tx.ExecContext(ctx, "DELETE FROM combos WHERE id = ?", id)
    return err
}
```

`combo_steps` テーブルの外部キー制約が `ON DELETE CASCADE` 前提(§3.4.4 で確認済み)。

#### 4.1.6 ハンドラ層

`PermanentDelete` ハンドラを追加:

```go
func (h *Handler) PermanentDelete(c echo.Context) error {
    id, err := strconv.ParseInt(c.Param("id"), 10, 64)
    if err != nil {
        return c.JSON(http.StatusBadRequest, ErrorResponse{Error: "invalid id"})
    }

    err = h.service.PermanentDelete(c.Request().Context(), id)
    if err != nil {
        switch {
        case errors.Is(err, ErrComboNotFound):
            return c.JSON(http.StatusNotFound, ErrorResponse{Error: "combo not found"})
        case errors.Is(err, ErrComboNotInTrash):
            return c.JSON(http.StatusConflict, ErrorResponse{
                Error:   "combo is not in trash",
                Details: "permanent delete requires the combo to be soft-deleted first",
            })
        default:
            return c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "internal error"})
        }
    }

    return c.NoContent(http.StatusNoContent)
}
```

エラー定数 `ErrComboNotFound`、`ErrComboNotInTrash` はサービス層で定義する(M1-03 の既存パターンに合わせる)。`ErrComboNotFound` が M1-03 で既に定義されている場合は再利用する(製造担当が `grep -r "ErrComboNotFound" internal/` で確認)。

#### 4.1.7 ルート登録

```go
api.DELETE("/combos/:id/permanent", comboHandler.PermanentDelete)
```

既存の `/combos/:id` ルート群と並列で登録する。

### 4.2 一括完全削除 API について(設計判断: 個別 API の繰り返し呼出)

DES-005 §5.15 で「一括復元・一括完全削除ボタン」が要件として明記されているが、**専用の一括 API は新設しない**。フロント側で複数選択された各コンボに対して `DELETE /api/combos/:id/permanent` を順次呼び出す方式とする。

理由:
- M1-03 の既存復元 API も単体操作 (`POST /api/combos/:id/restore`) のみで、一括復元 API は未実装
- 件数が多くないシナリオ(ゴミ箱は通常数十件以内)では、N 回の API 呼出でも体感性能に問題なし
- 専用 API を新設すると本指示書のスコープが拡大し、M2-03 の Sonnet 4.6 での実装適性から外れる
- 将来「ゴミ箱が数百件以上で性能問題」が顕在化した場合に CHANGE 起票で再検討する

フロント実装の方針:
- 複数選択 → 一括ボタン押下 → 各 ID に対して順次 API 呼出(`Promise.all` で並列化可能)
- 進捗表示は最小限(「N件処理中...」のスピナー程度)
- 一部失敗時の挙動: 失敗した ID をリストアップして表示、成功した分は反映済み(部分完了を許容)

### 4.3 GET /api/combos への only_deleted パラメータ追加

#### 4.3.1 仕様

既存の `GET /api/combos` クエリパラメータに `only_deleted` を追加:

| パラメータ | 値 | 動作 |
|----------|-----|------|
| `only_deleted=true` | true | `WHERE deleted_at IS NOT NULL` で論理削除済みコンボのみ返却 |
| `only_deleted=false` または省略 | false / 不在 | 既存挙動を維持(`only_deleted` を考慮しない) |

`include_deleted` との関係:

- `only_deleted=true` が指定されている場合: `only_deleted=true` が優先(論理削除済みのみ)
- `only_deleted=false` または省略の場合: `include_deleted` の既存挙動に従う(`include_deleted=true` なら論理削除済みも含む、省略なら通常コンボのみ)

#### 4.3.2 リポジトリ層の実装

`FindCombos`(または同等)のパラメータ構造体に `OnlyDeleted bool` を追加:

```go
type FindCombosInput struct {
    CharacterID    int64
    IsDraft        *bool
    IncludeDeleted bool
    OnlyDeleted    bool   // 新規追加
    Sort           string
    Order          string
    Limit          int
    Offset         int
}
```

WHERE 句の組み立て:

```go
where := []string{"character_id = ?"}
args := []interface{}{input.CharacterID}

if input.OnlyDeleted {
    where = append(where, "deleted_at IS NOT NULL")
} else if !input.IncludeDeleted {
    where = append(where, "deleted_at IS NULL")
}
// is_draft フィルタなど既存の WHERE 条件は維持
```

#### 4.3.3 ハンドラ層

クエリパラメータ Bind に `only_deleted` を追加し、リポジトリ層に渡す。M1-03 の既存パターンに合わせて `c.QueryParam("only_deleted") == "true"` でブール変換する。

#### 4.3.4 既存テストへの影響

既存の `GET /api/combos` テスト(M1-03 で実装済み)は `only_deleted` を指定しないため、挙動は変わらない(後方互換)。新規テストとして `only_deleted=true` 指定時の挙動を追加する。

### 4.4 ゴミ箱画面(TrashPage.tsx)

#### 4.4.1 ページ構造

`web/src/pages/TrashPage.tsx` に以下を実装:

```tsx
export function TrashPage() {
  const [characterId, setCharacterId] = useState<number>(/* デフォルトキャラ */);
  const { data: combos, isLoading, error, refetch } = useTrashCombos(characterId);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  return (
    <div>
      <h1>ゴミ箱</h1>
      <CharacterSelector value={characterId} onChange={setCharacterId} />
      <TrashBulkActions
        selectedIds={selectedIds}
        onComplete={() => { setSelectedIds([]); refetch(); }}
      />
      <TrashList
        combos={combos ?? []}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onComboChanged={refetch}
      />
    </div>
  );
}
```

`CharacterSelector` は M1-05 / M1-06 で実装済みのコンポーネントを再利用する(M2-02 の `useCharacters` フック実装時に差し替え予定の TODO 対象、M2-02 持ち越し課題で記録済み)。

#### 4.4.2 ルーティング

`web/src/App.tsx` または `web/src/router.tsx`(M1 期間の構成に従う)に追加:

```tsx
<Route path="/trash" element={<TrashPage />} />
```

#### 4.4.3 ナビゲーション導線

`Header.tsx`(または共通ヘッダ)に「ゴミ箱」リンクを追加。配置位置は M1 期間で確立されたヘッダのナビゲーション群に並ぶ自然な位置。

### 4.5 ゴミ箱コンボ一覧(TrashList.tsx, TrashListRow.tsx)

#### 4.5.1 表示項目

DES-005 §5.15 に従い、以下を表示する:

| 列 | 内容 |
|----|------|
| チェックボックス | 一括操作用 |
| 始動状況 | 始動技 + ヒット種別 + ポジション(M1-05 のコンボ一覧と同じ表示形式) |
| ダメージ | M1-05 と同じ |
| ルート | recipe_cache から取得(ただし論理削除時に NULL になっている可能性あり、§4.5.4 参照) |
| タグ | M1-05 と同じ |
| 削除日時 | combos.deleted_at の値、ユーザーローカル時刻で表示(例: "2026-05-01 14:30") |
| 残日数 | 自動完全削除までの残日数(削除日時 + 90日 - 現在 = 残日数)。「期限切れ」「あとN日」のように表示 |
| アクション | 復元ボタン、完全削除ボタン |

#### 4.5.2 各行のアクション

- **行クリック(チェックボックスとボタン以外の領域)**: コンボ詳細画面(読み取り専用、M1-05 の `ComboDetail.tsx` を流用)を開く。URL は `/combos/:id` のまま(コンボ詳細画面が論理削除状態を表示できるなら、それで足りる)
  - 詳細画面で論理削除状態を表示する処理が M1-05 で未実装の場合、ゴミ箱から開いた詳細画面では「これはゴミ箱内のコンボです」等の表示が望ましいが、本指示書のスコープ外として TODO コメントで残す
- **復元ボタン**: 確認ダイアログなしで `POST /api/combos/:id/restore` を呼ぶ(M1-03 既存)。成功後、当該行をリストから消す(refetch)
- **完全削除ボタン**: `PermanentDeleteConfirm` ダイアログを表示 → 確認 → `DELETE /api/combos/:id/permanent` を呼ぶ → 当該行をリストから消す(refetch)

#### 4.5.3 残日数の計算

```typescript
function calculateRemainingDays(deletedAt: string): number {
  const deletedDate = new Date(deletedAt);
  const expirationDate = new Date(deletedDate.getTime() + 90 * 24 * 60 * 60 * 1000);
  const now = new Date();
  const remainingMs = expirationDate.getTime() - now.getTime();
  return Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
}
```

表示:
- `remainingDays > 0`: 「あと N 日」
- `remainingDays <= 0`: 「期限切れ」(赤色強調)

90日の数値は固定値とする(設定変更は本指示書のスコープ外、M7 で設定画面実装時に検討)。

#### 4.5.4 ルート列の表示

論理削除されたコンボの `recipe_cache` は `DeleteComboCache` により NULL になっている(M1-04 §4.3.3、SUPP-001 §7.2)。そのため、ゴミ箱画面でルート列を表示しようとすると空欄になる。

対応方針:
- ルート列は **読み取り専用の簡素表示** とする
- recipe_cache が NULL の場合は「(レシピ表示なし)」または始動技名のみ表示する素朴な実装で構わない
- 復元時には §4.6 の `RecomputeComboCache` 呼出により recipe_cache が再生成されるため、コンボ一覧画面では正しく表示される

完全な詳細レシピを見たい場合は、行クリックでコンボ詳細画面(combo_steps から動的にレシピ生成)を開くことで対応する。

#### 4.5.5 チェックボックスによる複数選択

- 各行先頭のチェックボックスで個別選択
- リストヘッダの「全選択」チェックボックスで全選択/全解除
- 選択された ID は `selectedIds` state に保持
- 選択状態はページ離脱でリセット(永続化しない、M2 のスコープ)

### 4.6 Restore サービス層での RecomputeComboCache 連動(条件付き)

#### 4.6.1 確認すべき現状(§3.4.1 と連動)

製造担当が §3.4.1 で確認した M1-03 の `Restore` 実装に基づき、本セクションの作業要否を判断する:

- **§3.4.1 で `RecomputeComboCache` 呼出が存在することが確認できた場合**: 本セクション(§4.6)はスキップ。指示書 §2 の成果物リストから「`internal/service/combo/restore.go` の修正」を除外する
- **§3.4.1 で未実装が確認できた場合**: 本セクションのとおり追加実装する

#### 4.6.2 追加実装が必要な場合の方針

`internal/service/combo/restore.go`(または `service.go` 内の `Restore` メソッド)を修正:

```go
func (s *service) Restore(ctx context.Context, id int64) error {
    return s.repo.WithTx(ctx, func(tx *sql.Tx) error {
        // 既存: combos.deleted_at = NULL に UPDATE
        if err := s.repo.RestoreTx(ctx, tx, id); err != nil {
            return err
        }

        // 追加: recipe_cache を再計算
        if err := s.notationSvc.RecomputeComboCache(ctx, tx, id); err != nil {
            return err
        }

        return nil
    })
}
```

ポイント:
- 同一トランザクション内で復元と recipe_cache 再計算を行う(SUPP-001 §7.2 の整合性原則)
- `notationSvc` は M1-04 で実装済みの `RecomputeComboCache` を持つサービス。コンボサービスの構造体フィールドとして注入されているはず(`grep -r "notationSvc\|notation\." internal/service/combo/` で確認)
- 注入されていない場合、サービス層 `service` 構造体への DI 追加が必要。これは Plan Mode で開発者に報告のうえ進める

#### 4.6.3 既存テストへの影響

`Restore` メソッドのテストが M1-03 で実装されている場合、`RecomputeComboCache` のモック呼出が追加されることに伴いテストの修正が発生する。製造担当は既存テストを確認し、修正が発生する場合は本指示書のスコープで実施する。

### 4.7 一括復元・一括完全削除(TrashBulkActions.tsx)

#### 4.7.1 コンポーネント構造

```tsx
interface Props {
  selectedIds: number[];
  onComplete: () => void;
}

export function TrashBulkActions({ selectedIds, onComplete }: Props) {
  const restoreApi = useRestoreCombo();           // M1-05 / M1-06 で実装済みのフック想定、なければ新規
  const permanentDeleteApi = usePermanentDelete(); // 本指示書で新設
  const [isProcessing, setIsProcessing] = useState(false);
  const [errors, setErrors] = useState<{ id: number; error: string }[]>([]);

  const handleBulkRestore = async () => {
    setIsProcessing(true);
    const results = await Promise.allSettled(
      selectedIds.map(id => restoreApi.mutateAsync(id))
    );
    // 失敗した ID をエラーリストに追加
    const failedResults = results
      .map((r, i) => ({ result: r, id: selectedIds[i] }))
      .filter(({ result }) => result.status === "rejected");
    setErrors(failedResults.map(({ id, result }) => ({
      id,
      error: (result as PromiseRejectedResult).reason?.message ?? "unknown",
    })));
    setIsProcessing(false);
    onComplete();
  };

  const handleBulkPermanentDelete = async () => {
    // PermanentDeleteConfirm ダイアログ表示 → 確認 → 同様に並列実行
  };

  if (selectedIds.length === 0) return null;

  return (
    <div>
      <span>{selectedIds.length} 件選択中</span>
      <button onClick={handleBulkRestore} disabled={isProcessing}>選択を復元</button>
      <button onClick={handleBulkPermanentDelete} disabled={isProcessing}>選択を完全削除</button>
      {isProcessing && <span>処理中...</span>}
      {errors.length > 0 && (
        <div role="alert">
          {errors.length} 件失敗しました: {errors.map(e => `ID ${e.id}`).join(", ")}
        </div>
      )}
    </div>
  );
}
```

#### 4.7.2 一括完全削除の確認ダイアログ

完全削除は復元不能な操作のため、必ず確認ダイアログを表示:

「選択した N 件のコンボを完全削除します。この操作は取り消せません。続行しますか?」

確認後に並列実行する。

#### 4.7.3 既存の単体復元 API フック

M1-05 / M1-06 で `POST /api/combos/:id/restore` を呼ぶフック(例: `useRestoreCombo`)が既に実装されているはず。製造担当は実装を確認し、再利用する。実装されていない場合は本指示書のスコープで新規実装する(`web/src/features/combo/hooks/useRestoreCombo.ts`)。

### 4.8 PermanentDeleteConfirm.tsx(完全削除確認ダイアログ)

#### 4.8.1 コンポーネント仕様

```tsx
interface Props {
  isOpen: boolean;
  count: number;       // 1 件か N 件かで文言を変える
  onConfirm: () => void;
  onCancel: () => void;
}

export function PermanentDeleteConfirm({ isOpen, count, onConfirm, onCancel }: Props) {
  if (!isOpen) return null;

  const message = count === 1
    ? "このコンボを完全削除します。この操作は取り消せません。続行しますか?"
    : `選択した ${count} 件のコンボを完全削除します。この操作は取り消せません。続行しますか?`;

  return (
    <div role="dialog" aria-labelledby="permanent-delete-title">
      <h2 id="permanent-delete-title">完全削除の確認</h2>
      <p>{message}</p>
      <button onClick={onCancel}>キャンセル</button>
      <button onClick={onConfirm}>完全削除する</button>
    </div>
  );
}
```

スタイル(モーダルの背景、ボタン色など)は M1-06 / M2-02 の `PutConfirmDialog` などのスタイルに合わせる。

#### 4.8.2 アクセシビリティ

- `role="dialog"` および `aria-labelledby` で関連付け
- ESC キーでキャンセル
- 背景クリックでキャンセル

### 4.9 useTrashCombos / usePermanentDelete フック

#### 4.9.1 useTrashCombos

```typescript
export function useTrashCombos(characterId: number) {
  return useQuery({
    queryKey: ["combos", "trash", characterId],
    queryFn: async () => {
      const res = await fetch(
        `/api/combos?character_id=${characterId}&only_deleted=true`
      );
      if (!res.ok) throw new Error("Failed to fetch trash combos");
      return res.json();
    },
  });
}
```

M1 / M2 期間で確立された fetch + React Query パターン(または同等のパターン)に従う。

#### 4.9.2 usePermanentDelete

```typescript
export function usePermanentDelete() {
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/combos/${id}/permanent`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        throw new Error(errorBody.error ?? "Failed to permanently delete");
      }
    },
  });
}
```

---

## 5. テスト要件

### 5.1 必須テスト

#### 5.1.1 バックエンド(Go test)

`internal/api/combo/permanent_delete_handler_test.go`:

- 正常系: 論理削除済みコンボの完全削除 → 204 No Content、DB から削除されている
- 異常系: 存在しないコンボの完全削除 → 404
- 異常系: 論理削除されていない通常コンボの完全削除 → 409
- 異常系: 不正な ID(数値以外)→ 400
- combo_steps が外部キー CASCADE で連動削除されることの確認

`internal/service/combo/permanent_delete_test.go`(または `service_test.go` 内):

- `PermanentDelete` の単体テスト(モックリポジトリで挙動を制御)

`internal/api/combo/handler_test.go`(既存ファイルへの追記):

- `GET /api/combos?only_deleted=true` で論理削除済みコンボのみ返ることの確認
- `only_deleted=true` と `include_deleted=true` の併用で `only_deleted` が優先することの確認
- `only_deleted=false` または省略時は既存挙動を維持することの確認

`internal/service/combo/restore_test.go`(§4.6 の追加実装が必要だった場合):

- `Restore` 後に `RecomputeComboCache` が呼ばれることをモック検証
- トランザクション内で実行されることの確認

#### 5.1.2 フロントエンド(Vitest + React Testing Library)

`web/src/features/combo/hooks/useTrashCombos.test.ts`:

- 正常系: 指定キャラの論理削除済みコンボのみ取得
- リクエスト URL に `only_deleted=true` が含まれること

`web/src/features/combo/hooks/usePermanentDelete.test.ts`:

- 正常系: DELETE リクエストが `/api/combos/{id}/permanent` に送信される
- 404 / 409 エラー時のエラーハンドリング

`web/src/features/combo/components/TrashList.test.tsx`:

- ゴミ箱コンボが正しく表示される
- 削除日時・残日数が正しく表示される(残日数 > 0 と <= 0 の両ケース)
- 復元ボタンクリック → API 呼出 → リストから消える
- 完全削除ボタンクリック → 確認ダイアログ → 確認後 API 呼出 → リストから消える
- チェックボックス選択動作

`web/src/features/combo/components/TrashBulkActions.test.tsx`:

- 一括復元: 選択された N 件すべてに API が呼ばれる
- 一括完全削除: 確認ダイアログ → 確認後、N 件に API が呼ばれる
- 一部失敗時: エラー表示が動作する

`web/src/features/combo/components/PermanentDeleteConfirm.test.tsx`:

- 1件 / N件 の文言切替
- キャンセル/確認動作
- ESC キー / 背景クリックでキャンセル

`web/src/pages/TrashPage.test.tsx`:

- ページ全体のレンダリング
- キャラ切替動作

### 5.2 E2E シナリオ(開発者がブラウザで手動実行)

製造担当 Claude Code は **動作確認手順書** として以下を実装完了報告に含める。開発者がブラウザで以下を実行して動作確認する。

```
## E2E シナリオ A: 論理削除 → ゴミ箱表示

1. 既存の本登録コンボ(リュウ)を1件、コンボ一覧画面で「削除」アイコンをクリックして論理削除
2. ヘッダの「ゴミ箱」リンクをクリック → /trash 画面に遷移
3. 削除したコンボがゴミ箱一覧に表示されている
4. 削除日時、残日数(あと89〜90日)が表示されている

## E2E シナリオ B: 単体復元

1. ゴミ箱画面で1件選び、「復元」ボタンをクリック
2. 当該コンボがゴミ箱から消える
3. コンボ一覧画面に戻り、復元したコンボが本登録コンボとして表示されている
4. コンボ一覧でレシピ列(ルート)が正しく表示されている(recipe_cache が再計算されている、§4.6 の効果確認)

## E2E シナリオ C: 単体完全削除

1. ゴミ箱画面で1件選び、「完全削除」ボタンをクリック
2. 確認ダイアログ「このコンボを完全削除します。この操作は取り消せません。続行しますか?」が表示
3. 「完全削除する」をクリック
4. 当該コンボがゴミ箱から消える
5. ターミナルで以下を実行し、DB から物理削除されていることを確認:
   curl 'http://localhost:47318/api/combos/<削除した ID>'  → 404 が返る
6. コンボ一覧画面に戻り、当該コンボが表示されないことを確認(復元できない)

## E2E シナリオ D: 一括復元

1. ゴミ箱に複数コンボを溜める(2〜3件論理削除)
2. ゴミ箱画面でチェックボックスで全選択
3. 「選択を復元」ボタンをクリック
4. 全件が復元され、ゴミ箱が空になる
5. コンボ一覧で全件が表示される

## E2E シナリオ E: 一括完全削除

1. ゴミ箱に複数コンボを溜める(2〜3件論理削除)
2. ゴミ箱画面でチェックボックスで全選択
3. 「選択を完全削除」ボタンをクリック
4. 確認ダイアログで件数表示「選択した N 件のコンボを完全削除します。この操作は取り消せません。続行しますか?」
5. 確認後、全件が完全削除される
6. ターミナルで `curl 'http://localhost:47318/api/combos?character_id=1&only_deleted=true'` → `duplicates: []` が返る

## E2E シナリオ F: 完全削除の安全策(誤操作防止)

1. ターミナルで以下を実行(通常コンボに対する完全削除):
   curl -X DELETE 'http://localhost:47318/api/combos/<通常コンボの ID>/permanent'
2. 409 Conflict が返り、メッセージ「permanent delete requires the combo to be soft-deleted first」が表示される
3. DB を確認し、当該コンボが残っていることを確認
```

開発者は上記6シナリオを実行して動作確認する。製造担当が実装完了報告に「動作確認手順書」として上記シナリオを再掲する。

---

## 6. レビュー観点(別ファイル参照)

製造担当 Claude は本節を読む必要はない。

レビュー観点は以下の別ファイルに分離されている:

- **`docs/instructions/reviews/M2-03-review-checklist.md`**

(本チェックリストファイルは M2-03 指示書とセットで設計担当が別途作成する)

---

## 7. 完了条件(Definition of Done)

### 7.1 機能要件

- [ ] §3.4.1 の M1-03 `Restore` 実装の現状確認結果が Plan Mode で報告されている
- [ ] §3.4.4 の `combo_steps` 外部キー CASCADE 確認結果が Plan Mode で報告されている
- [ ] §2.1 のファイルが全て作成されている(バックエンド2ファイル + フロントエンド7ファイル)
- [ ] §2.2 の修正ファイルが修正されている
- [ ] §5.1 の必須テスト(Go test、Vitest)が全通過する
- [ ] §5.2 の E2E シナリオ A〜F が動作する(動作確認手順書として実装完了報告に再掲)

### 7.2 自己テスト結果(製造担当の責任範囲)

#### バックエンド側

- [ ] `make test` または `go test ./...` が全通過する
- [ ] `DELETE /api/combos/:id/permanent` を `curl` で叩き、以下のレスポンスを実装完了報告に貼付:
  - 正常系(204): リクエスト・レスポンス
  - 404 / 409 / 400 の各エラーケース
- [ ] `GET /api/combos?character_id=1&only_deleted=true` を `curl` で叩き、レスポンスを貼付
- [ ] `GET /api/combos?character_id=1&only_deleted=true&include_deleted=true` で `only_deleted` が優先することを確認
- [ ] 完全削除後に `curl 'http://localhost:47318/api/combos/<削除した ID>'` で 404 が返ることを確認

#### フロントエンド側

- [ ] `pnpm test`(Vitest)が全通過する
- [ ] `pnpm build` が成功する
- [ ] TypeScript の型エラーが残っていない(`pnpm tsc --noEmit` で確認)
- [ ] 開発サーバー起動時にコンソール警告が新規発生していない
- [ ] §5.2 の動作確認手順書を実装完了報告に再掲

ブラウザでの実機動作確認・スクリーンショット取得は **開発者の責任範囲** であり、製造担当は実行しない(M2-overview §6.5.2)。

### 7.3 品質チェック

- [ ] CLAUDE.md の禁止事項に抵触していない
- [ ] `console.log` を本番コードに残していない
- [ ] 設計書本体(DES-005 §5.15、SUPP-001 §7.2、DES-003 §3.4)と実装が一致している。差異がある場合は CHANGE 起票を提案する
- [ ] M1-03 の既存サービス層メソッド・既存テストが破壊されていない(リグレッションなし)
- [ ] M1-04 の `RecomputeComboCache` / `DeleteComboCache` メソッド実装は変更していない(呼び出すのみ)
- [ ] M1-05 / M1-06 / M2-01 / M2-02 の既存挙動が破壊されていない
- [ ] §4.6 の Restore への RecomputeComboCache 連動が実装された場合、SUPP-001 §7.2 のサービス層責務一覧と整合している

### 7.4 ドキュメント

- [ ] `docs/progress/progress-log.md`(または同等のログ)に M2-03 完了報告を追記
  - 実装内容のサマリ
  - §5.2 の E2E シナリオ実行結果
  - §3.4 の確認結果(M1-03 `Restore` の現状、`combo_steps` CASCADE 設定の現状)
  - 既知の制限事項: 存在する場合のみ「## M2-03 完了時点の既知の制限事項」セクション見出しで記載(独立ファイル化しない、空セクションを作らない、M2-02 と同じ運用方針)

### 7.5 完了報告

- [ ] 開発者に「M2-03 が完了しました」と報告する
- [ ] §7.2 の自己テスト結果と §5.2 の動作確認手順書を報告に含める
- [ ] レビュー担当(別 Claude Code セッション)へ §6 のチェックリストファイルを案内する

---

## 8. 参照ドキュメント

| ID | パス | 参照箇所 |
|----|------|----------|
| CLAUDE.md | `CLAUDE.md` | 全体方針、§8 矛盾検出時の停止ルール |
| M2-overview | `docs/instructions/M2-overview.md` | M2 全体像、§6 運用ルール |
| DES-005 | `docs/design/05-screen-design.md` | §5.4 / §5.15(中核) |
| DES-003 | `docs/design/03-data-model.md` | §3.4 combos テーブル(deleted_at カラム) |
| SUPP-001 | `docs/design/supp-001-detailed-design.md` | §7.1 / §7.2 サービス層責務(中核) |
| REQ-001 | `docs/design/requirements.md` | 論理削除と復元の要件 |
| M1-03 | `docs/instructions/M1-03-combo-crud-api.md` | §4.1 既存 API、§4.10 リスト API、Restore 実装の現状確認 |
| M1-04 | `docs/instructions/M1-04-presets-and-recipe-cache.md` | §4.3.2 / §4.3.3 RecomputeComboCache / DeleteComboCache |
| M1-05 | `docs/instructions/M1-05-combo-list-detail-pages.md` | UI 流用の参考(任意) |
| M2-02 | `docs/instructions/M2-02-edit-ux-improvements.md` | §2.4 例外条項のパターン参考(任意) |

---

## 9. 注意事項・判断に迷ったら

### 9.1 推測で進めてはいけない事項

- 既存 API の振る舞いを変更しない(`only_deleted` パラメータ追加は §2.4.2 の例外として許容、それ以外は禁止)
- `RecomputeComboCache` / `DeleteComboCache` メソッド実装そのものを変更しない(呼び出すのみ)
- マイグレーション・DB スキーマの変更は行わない
- 完全削除を「論理削除されていない通常コンボ」に対して許可しない(409 Conflict で拒否、誤操作防止)
- セットプレイ関連の処理を実装しない(M4 で実装、本指示書では構造のみ残す)

### 9.2 推測で進めてよい事項(その旨を明示)

以下は本指示書で詳細を確定していない領域。製造担当が実装し、判断の根拠を実装完了報告で明示すること。

- 残日数表示のフォーマット詳細(「あと N 日」「期限切れ」の文言・色)
- ゴミ箱画面のレイアウトの細部(列の幅、ボタン配置、Tailwind デフォルトで構わない)
- 一括操作の進捗表示の詳細(スピナー有無、件数表示の形式)
- `PermanentDeleteConfirm` のダイアログスタイル(M1-06 / M2-02 の既存ダイアログを踏襲)
- ヘッダのゴミ箱リンクの配置位置・テキスト(「ゴミ箱」または「Trash」、M1 のヘッダ命名パターンに合わせる)
- ルート列が NULL の場合の表示文言(「(レシピ表示なし)」または始動技名のみ)

### 9.3 不明事項発見時の対応

1. **設計書本体との矛盾を発見した場合**: CLAUDE.md §8 に従い、Plan Mode で停止して開発者に確認する
2. **M1-03 / M1-04 / M1-05 既存実装と本指示書の矛盾を発見した場合**: 同上、Plan Mode で停止して開発者に確認する
3. **§3.4.4 の `combo_steps` 外部キー CASCADE が未設定の場合**: Plan Mode で停止して開発者と対応方針を確定する(本指示書では CASCADE 前提で記述している)
4. **§3.4.1 の `Restore` 実装で `RecomputeComboCache` が未実装の場合**: §4.6 のとおり追加実装する旨を Plan Mode で報告

### 9.4 Plan Mode で計画提示時に含めるべき項目(任意推奨)

Plan Mode は本指示書では任意だが、以下の項目を計画提示すると安全:

- §3.4.1 M1-03 `Restore` 実装の現状(必須報告)
- §3.4.3 / §3.4.4 の確認結果(必須報告)
- §4.6 Restore 修正の要否
- 完全削除サービス層・ハンドラ層のファイル構成方針(独立ファイル or 既存ファイル追加)
- 一括操作の並列度(`Promise.all` か順次 await か、件数次第)

---

## 10. 完了後の次ステップ

M2-03 完了後、開発者の承認を得て M2-04(統合・仕上げ、modifiers.notes 表示)に進む。

M2-04 着手時には、本指示書で実装したゴミ箱画面・完全削除機能・only_deleted フィルタが安定動作していることが前提となる。M2-03 で発見されたバグや改善点が発生した場合、M2-04 着手前に開発者と協議して対応方針を決める。

M2-04 では M1 期間からの持ち越し課題(modifiers.notes の表示処理)、および M2-01 / M2-02 / M2-03 期間で発生した持ち越し課題のうち M2-04 スコープに該当するものを統合的に処理する。

---

*以上*

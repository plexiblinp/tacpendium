# M5-RESEARCH-01 調査レポート

| 項目 | 内容 |
|------|------|
| 調査者 | 製造担当 Claude Code(M5-RESEARCH-01 担当、Sonnet 4.6) |
| 調査日 | 2026-05-22 |
| 使用ツール | Read / bash(grep / cat / ls / find / sed 等の参照系のみ) |
| 書き込み系操作 | 一切なし(read-only 厳守) |
| 出力パス補足 | `/mnt/user-data/outputs/` が devContainer 内に存在しないため、開発者の依頼により `docs/instructions/` に出力 |

---

## 4.1 GET /api/combos/{id} レスポンス DTO の実態

### (a) レスポンス型名

- Go 側: `combo.ComboResponse`(ファイル: `internal/api/combo/dto.go`)
- フロント側(一覧用): `ComboSummary`(ファイル: `web/src/features/combo/types.ts`)
- フロント側(詳細用): `ComboDetail extends ComboSummary`(同上。`steps?` / `validations?` / `setups?` を追加)
- フロント側(編集用): `Combo`(同上。`| null` を許容)

### (b) ComboResponse の全フィールド一覧

| フィールド名(Go) | 型(Go) | JSON タグ | フィールド名(TS) | 型(TS) |
|------------------|---------|----------|------------------|---------|
| ID | int64 | `"id"` | id | number |
| CharacterID | int64 | `"characterId"` | characterId | number |
| IsDraft | bool | `"isDraft"` | isDraft | boolean |
| Damage | *int | `"damage,omitempty"` | damage | number? |
| StarterMoveID | *int64 | `"starterMoveId,omitempty"` | starterMoveId | number? |
| Position | *string | `"position,omitempty"` | position | string? |
| OpponentStance | *string | `"opponentStance,omitempty"` | opponentStance | string? |
| HitType | *string | `"hitType,omitempty"` | hitType | string? |
| OpponentSize | *string | `"opponentSize,omitempty"` | opponentSize | string? |
| DriveAvailableAtStart | *int | `"driveAvailableAtStart,omitempty"` | driveAvailableAtStart | number? |
| SAAvailableAtStart | *int | `"saAvailableAtStart,omitempty"` | saAvailableAtStart | number? |
| DriveDamage | *int | `"driveDamage,omitempty"` | driveDamage | number? |
| KnockdownAdvantage | *int | `"knockdownAdvantage,omitempty"` | knockdownAdvantage | number? |
| Memo | *string | `"memo,omitempty"` | memo | string? |
| Situation | *string | `"situation,omitempty"` | situation | string? |
| OkiMeatyNeutralTechThrow | *bool | `"okiMeatyNeutralTechThrow,omitempty"` | okiMeatyNeutralTechThrow | boolean? |
| OkiMeatyNeutralTechThrowDr | *bool | `"okiMeatyNeutralTechThrowDr,omitempty"` | okiMeatyNeutralTechThrowDr | boolean? |
| OkiMeatyBackTechThrow | *bool | `"okiMeatyBackTechThrow,omitempty"` | okiMeatyBackTechThrow | boolean? |
| OkiMeatyBackTechThrowDr | *bool | `"okiMeatyBackTechThrowDr,omitempty"` | okiMeatyBackTechThrowDr | boolean? |
| OkiShimmyNeutralTech | *bool | `"okiShimmyNeutralTech,omitempty"` | okiShimmyNeutralTech | boolean? |
| OkiShimmyBackTech | *bool | `"okiShimmyBackTech,omitempty"` | okiShimmyBackTech | boolean? |
| StepCount | int | `"stepCount"` | stepCount | number |
| DriveGaugeConsumedTotal | *float64 | `"driveGaugeConsumedTotal,omitempty"` | driveGaugeConsumedTotal | number? |
| SAGaugeConsumedTotal | *int | `"saGaugeConsumedTotal,omitempty"` | saGaugeConsumedTotal | number? |
| DefaultRecipe | string | `"defaultRecipe"` | defaultRecipe | string |
| StarterMoveCode | string | `"starterMoveCode"` | starterMoveCode | string |
| Version | int | `"version"` | version | number |
| CreatedAt | time.Time | `"createdAt"` | createdAt | string |
| UpdatedAt | time.Time | `"updatedAt"` | updatedAt | string |
| DeletedAt | *time.Time | `"deletedAt,omitempty"` | deletedAt | string \| null? |
| Steps | []StepResponse | `"steps,omitempty"` | steps | ComboStep[]? |
| Tags | []model.Tag | `"tags"` | tags | Tag[] |
| Validations | *validation.ValidationResult | `"validations,omitempty"` | validations | ValidationResult? |
| Setups | []SetupSummary | `"setups"` | setups | SetupSummary[]? |

### (c) 比較画面 11 項目の存在確認

| 比較画面項目(DES-005 §5.8 想定) | 対応フィールド | 含まれるか |
|-------------------------------|--------------|----------|
| 始動状況 - starterMoveId | `StarterMoveID *int64 json:"starterMoveId,omitempty"` | yes |
| 始動状況 - starterMoveCode | `StarterMoveCode string json:"starterMoveCode"` | yes |
| 始動状況 - position | `Position *string json:"position,omitempty"` | yes |
| 始動状況 - opponentStance | `OpponentStance *string json:"opponentStance,omitempty"` | yes |
| 始動状況 - hitType | `HitType *string json:"hitType,omitempty"` | yes |
| 始動状況 - opponentSize | `OpponentSize *string json:"opponentSize,omitempty"` | yes |
| ダメージ系 - damage | `Damage *int json:"damage,omitempty"` | yes |
| ダメージ系 - driveAvailableAtStart | `DriveAvailableAtStart *int json:"driveAvailableAtStart,omitempty"` | yes |
| ダメージ系 - saAvailableAtStart | `SAAvailableAtStart *int json:"saAvailableAtStart,omitempty"` | yes |
| ダメージ系 - driveDamage | `DriveDamage *int json:"driveDamage,omitempty"` | yes |
| ダメージ系 - driveGaugeConsumedTotal | `DriveGaugeConsumedTotal *float64 json:"driveGaugeConsumedTotal,omitempty"` | yes |
| ダメージ系 - saGaugeConsumedTotal | `SAGaugeConsumedTotal *int json:"saGaugeConsumedTotal,omitempty"` | yes |
| レシピ系 - steps | `Steps []StepResponse json:"steps,omitempty"` | yes(詳細 API のみ、一覧 API では nil) |
| レシピ系 - defaultRecipe | `DefaultRecipe string json:"defaultRecipe"` | yes |
| レシピ系 - recipeCache | ComboResponse に含まれない。model.Combo の RecipeCache は `json:"-"` で除外。 | **no** |
| 起き攻め系 - okiMeatyNeutralTechThrow | `OkiMeatyNeutralTechThrow *bool json:"okiMeatyNeutralTechThrow,omitempty"` | yes |
| 起き攻め系 - okiMeatyNeutralTechThrowDr | `OkiMeatyNeutralTechThrowDr *bool json:"okiMeatyNeutralTechThrowDr,omitempty"` | yes |
| 起き攻め系 - okiMeatyBackTechThrow | `OkiMeatyBackTechThrow *bool json:"okiMeatyBackTechThrow,omitempty"` | yes |
| 起き攻め系 - okiMeatyBackTechThrowDr | `OkiMeatyBackTechThrowDr *bool json:"okiMeatyBackTechThrowDr,omitempty"` | yes |
| 起き攻め系 - okiShimmyNeutralTech | `OkiShimmyNeutralTech *bool json:"okiShimmyNeutralTech,omitempty"` | yes |
| 起き攻め系 - okiShimmyBackTech | `OkiShimmyBackTech *bool json:"okiShimmyBackTech,omitempty"` | yes |
| 起き攻め系 - knockdownAdvantage | `KnockdownAdvantage *int json:"knockdownAdvantage,omitempty"` | yes |
| 関連系 - tags | `Tags []model.Tag json:"tags"` (常に非 nil、空なら空配列) | yes |
| 関連系 - setups | `Setups []SetupSummary json:"setups"` | yes(詳細取得時のみ埋め込み) |
| 関連系 - memo | `Memo *string json:"memo,omitempty"` | yes |

### (d) setups フィールドの構造

配列要素の型: `SetupSummary`(定義: `internal/api/combo/dto.go`)

| フィールド名(Go) | 型(Go) | JSON タグ |
|-----------------|---------|----------|
| ID | int64 | `"id"` |
| CharacterID | int64 | `"characterId"` |
| Name | *string | `"name,omitempty"` |
| Description | *string | `"description,omitempty"` |
| StepCount | int | `"stepCount"` |
| Version | int | `"version"` |
| DefaultRecipe | string | `"defaultRecipe"` |
| ParentComboIds | []int64 | `"parentComboIds"` |

SetupSummary に実際のステップリスト(`steps`)は含まれていない。StepCount のみ。

フロント側の `SetupSummary` 型の実体は `web/src/features/setup/types.ts` に定義されており、`web/src/features/combo/types.ts` からインポートしている。

---

## 4.2 TanStack Query 既存フックの構成

### (a) 全フックファイルパス一覧

```
web/src/features/character/hooks/useCharacters.ts
web/src/features/combo/hooks/useCheckDuplicate.ts       ← TanStack Query 未使用(fetch + useEffect 実装)
web/src/features/combo/hooks/useColumnVisibility.ts     ← localStorage 操作(TanStack Query 未使用)
web/src/features/combo/hooks/useComboListFilters.ts     ← URL SearchParams 操作(TanStack Query 未使用)
web/src/features/combo/hooks/usePermanentDelete.ts
web/src/features/combo/hooks/useRestoreCombo.ts
web/src/features/combo/hooks/useTrashCombos.ts
web/src/features/mycombo/hooks/useMyComboStatusCounts.ts
web/src/features/mycombo/hooks/useMyComboStatusTags.ts
web/src/features/mycombo/hooks/useUpdateMyComboStatus.ts
web/src/features/setup/hooks/useCharacterSetups.ts
web/src/features/setup/hooks/useCreateSetup.ts
web/src/features/setup/hooks/useDeleteSetup.ts
web/src/features/setup/hooks/useSetupCandidates.ts
web/src/features/setup/hooks/useSetupLinks.ts
web/src/features/setup/hooks/useSetup.ts
web/src/features/setup/hooks/useUpdateSetup.ts
web/src/features/tag/hooks/useTagManagement.ts
web/src/features/tag/hooks/useTagsForSelector.ts
```

また、`web/src/features/combo/api.ts` に `useCombos` / `useCombo` / `useComboRecipe` / `useDeleteCombo` / `useCreateCombo` / `useUpdateComboMetadata` / `useUpdateComboWithKeyChange` が定義されている。

### (b) フック名 + queryKey 形式

| フック名 | 定義ファイル | queryKey | 形式 | ID 型 |
|---------|------------|---------|------|-------|
| useCombos | `web/src/features/combo/api.ts` | `["combos", filter]` | flat + object | N/A(filter は object) |
| useCombo | `web/src/features/combo/api.ts` | `["combo", numId]` | flat tuple | number |
| useComboRecipe | `web/src/features/combo/api.ts` | `["combo", comboId, "recipe", presetId]` | flat tuple | number |
| useTrashCombos | `web/src/features/combo/hooks/useTrashCombos.ts` | `["combos", "trash", characterId]` | flat tuple | number |
| useCharacters | `web/src/features/character/hooks/useCharacters.ts` | `["characters", { gameId }]` | flat + object | number |
| useCharacterSetups | `web/src/features/setup/hooks/useCharacterSetups.ts` | `["setups", { characterId }]` | flat + object | number |
| useSetup | `web/src/features/setup/hooks/useSetup.ts` | `["setup", { id: setupId }]` | flat + object | number |
| useSetupCandidates | `web/src/features/setup/hooks/useSetupCandidates.ts` | `["setupCandidates", comboId]` | flat tuple | number |
| useTagsForSelector | `web/src/features/tag/hooks/useTagsForSelector.ts` | `["tags", { include_usage: false }]` | flat + object | N/A |
| useMyComboStatusCounts | `web/src/features/mycombo/hooks/useMyComboStatusCounts.ts` | `["tags", { include_usage: true, category: TAG_CATEGORY_MYCOMBO_STATUS }]` | flat + object | N/A |
| useMyComboStatusTags | `web/src/features/mycombo/hooks/useMyComboStatusTags.ts` | `["tags", { include_usage: false, category: TAG_CATEGORY_MYCOMBO_STATUS }]` | flat + object | N/A |

**パターンの整理**:
- combo 系(`useCombo`): flat tuple `["combo", id]` — ID は number をそのまま置く
- combos 系(`useCombos`): flat + object `["combos", filterObject]`
- setup 系(`useSetup`): flat + object `["setup", { id }]` — combo と異なり object 形式
- setups 系(`useCharacterSetups`): flat + object `["setups", { characterId }]`
- tag 系: flat + object `["tags", { ... }]`
- character 系: flat + object `["characters", { gameId }]`

### (c) invalidate パターンの実態

| ミューテーション | 定義ファイル | onSuccess で invalidate する queryKey |
|---------------|------------|--------------------------------------|
| useDeleteCombo | `web/src/features/combo/api.ts` | `["combos"]` |
| useCreateCombo | `web/src/features/combo/api.ts` | `["combos"]`、setups あり時は追加で `["setups"]`、`["setupCandidates"]` |
| useUpdateComboMetadata | `web/src/features/combo/api.ts` | `["combos"]`、`["combo", id]` |
| useUpdateComboWithKeyChange(PUT) | `web/src/features/combo/api.ts` | `["combos"]`、`["combo", id]` |
| useRestoreCombo | `web/src/features/combo/hooks/useRestoreCombo.ts` | `["combos"]` |
| usePermanentDelete | `web/src/features/combo/hooks/usePermanentDelete.ts` | `["combos"]` |
| useUpdateMyComboStatus | `web/src/features/mycombo/hooks/useUpdateMyComboStatus.ts` | `["combos"]`、`["tags", { include_usage: true, category: TAG_CATEGORY_MYCOMBO_STATUS }]` |
| useCreateSetup | `web/src/features/setup/hooks/useCreateSetup.ts` | `setQueryData(["setup", { id }])` で直接セット、`invalidate(["combo", comboId])` |
| useUpdateSetup | `web/src/features/setup/hooks/useUpdateSetup.ts` | `setQueryData(["setup", { id }])` で直接セット、`invalidate(["combo", parentComboId])` を各 parentComboId に |
| useDeleteSetup | `web/src/features/setup/hooks/useDeleteSetup.ts` | `removeQueries(["setup", { id }])`、`invalidate(["combo", parentComboId])` を各 parentComboId に |
| useCreateSetupLink | `web/src/features/setup/hooks/useSetupLinks.ts` | `["combo", comboId]`、`["setup", { id: setupId }]`、`["setupCandidates", comboId]` |
| useDeleteSetupLink | `web/src/features/setup/hooks/useSetupLinks.ts` | `["combo", comboId]`、`["setup", { id: setupId }]`、`["setupCandidates", comboId]` |

---

## 4.3 useQueries の利用前例

**利用なし**

`grep -rn 'useQueries' web/src/` の結果: 0 件。

---

## 4.4 フロント側のルーティング定義

### (a) ルーティング定義ファイルのパス

`web/src/router.tsx`

### (b) 既存ルート全件のパス一覧

| パス | 遷移先コンポーネント |
|-----|------------------|
| `/` | ComboListPage |
| `/combos` | ComboListPage |
| `/combos/new` | ComboEditorPage |
| `/combos/:id/edit` | ComboEditorPage |
| `/combos/:comboId/setups/new` | SetupEditorPage |
| `/combos/:id` | ComboDetailPage |
| `/setups/:setupId` | SetupEditorPage |
| `/trash` | TrashPage |
| `/tags/manage` | TagManagementPageRoute |
| `/mycombo` | MyComboPageRoute |
| `/health` | HealthCheckPage |
| `*` | Navigate to "/" |

### (c) /compare 系ルートの予約状況

**no** — `compare` を含むルートは存在しない。

---

## 4.5 コンボ一覧画面・マイコンボ画面の選択モード実装状態

### (a)(b) コンボ一覧画面

- ファイルパス: `web/src/pages/ComboListPage.tsx`
- コンポーネント名: `ComboListPage`
- 選択モード実装: **no**
  - `isSelectMode`、`selectedIds`、チェックボックス列、「比較」ボタン等の実装は一切存在しない
  - 画面は ComboTable にコンボ一覧を渡すのみ。選択状態管理なし。

### (c)(d) マイコンボ画面

- ファイルパス(ルートコンポーネント): `web/src/pages/MyComboPageRoute.tsx` → 実体: `web/src/features/mycombo/components/MyComboPage.tsx`
- コンポーネント名: `MyComboPage`
- 選択モード実装: **no**
  - `isSelectMode`、選択用 `selectedIds`、チェックボックス列、「比較」ボタン等の実装は一切存在しない
  - マイコンボステータスのタブ切り替え、ソート、列表示切替の実装はある。選択機能はない。

### (e) grep 結果

| キーワード | 件数 | 該当ファイル |
|-----------|-----|------------|
| `compare` | 0件 | 該当なし |
| `isSelectMode` | 0件 | 該当なし |
| `selectedIds` | 約18件 | `TrashBulkActions.tsx`、`TrashList.tsx`、`TrashPage.tsx` およびそれぞれのテストファイルのみ |

`selectedIds` の実装はゴミ箱画面(`TrashPage`)の一括復元・永久削除操作専用であり、比較目的の選択モードとは別機能。

---

## 4.6 web/src/constants/ の既存定数ファイル一覧と命名規則

### (a) 全ファイルパス一覧

```
web/src/constants/combo-list.ts
web/src/constants/mycombo.ts
```

計 2 ファイル。

### (b) 各ファイルの代表的な定数名

| ファイル | 代表的な定数名 |
|---------|--------------|
| combo-list.ts | `SORT_FIELD_VALUES`、`POSITION_VALUES`、`HIT_TYPE_VALUES`、`DEFAULT_COLUMN_VISIBILITY`、`COLUMN_DEFINITIONS`、`SORT_FIELD_LABELS`、`POSITION_LABELS` |
| mycombo.ts | `TAG_CATEGORY_MYCOMBO_STATUS`、`MYCOMBO_STATUS_VALUES`、`MYCOMBO_STATUS_IN_USE`、`DEFAULT_MYCOMBO_STATUS`、`MYCOMBO_STATUS_LABELS` |

命名規則: 定数名はすべて SCREAMING_SNAKE_CASE。型エイリアスは PascalCase(`SortField`、`HitType`、`MyComboStatus` 等)。

### (c) MAX_* 系定数の既存例

**no** — `MAX_*` または上限値系の定数の既存例は確認されなかった。

---

## 4.7 shadcn/ui の導入状態

### (a) package.json の確認結果

**no** — `@radix-ui/*` および `shadcn-ui` 系パッケージは `web/package.json` に含まれていない。

### (b) web/src/components/ui/ ディレクトリ

**no** — ディレクトリが存在しない。

### (c) web/src/components.json

**no** — ファイルが存在しない。

### (d) 総合判定

**shadcn/ui 未導入** — (a)(b)(c) すべて no。

---

## 特記事項

1. **`recipeCache` フィールドは API レスポンスに含まれない**: `model.Combo.RecipeCache` は `json:"-"` タグにより API 応答から除外されている。比較画面で各プリセット解決済みレシピを表示する場合は `defaultRecipe`(既定プリセット解決済み文字列)で代替するか、`GET /api/combos/:id/recipe?preset_id=X` エンドポイントを使う必要がある。

2. **combo 系と setup 系で queryKey の object 形式が混在している**: `useCombo` は flat tuple `["combo", numId]`(ID は number)、`useSetup` は flat + object `["setup", { id: setupId }]`。両者が共存している。

3. **`useCheckDuplicate` は TanStack Query を使っていない**: `fetch + useEffect + AbortController` による独自実装(デバウンス付き)。TanStack Query の queryKey 体系とは独立した実装。

4. **`SetupSummary` のフロント側型の所在**: `web/src/features/combo/types.ts` では `import type { ... SetupSummary } from "@/features/setup/types"` でインポートしている。`SetupSummary` の実体は `web/src/features/setup/types.ts` に定義されている。

---

## 調査担当からの完了宣言

本指示書 §0.2 read-only 厳守を遵守し、Read / bash 参照系コマンドのみで調査を完了した。書き込み系操作(ファイル新規作成・編集・削除、git 操作、ビルド・テスト実行、マイグレーション)は一切行っていない。

`/mnt/user-data/outputs/` ディレクトリが devContainer 内に存在しないため、開発者の依頼により `docs/instructions/M5-RESEARCH-01-report.md` に出力した。

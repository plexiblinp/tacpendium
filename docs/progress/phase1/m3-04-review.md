# M3-04 レビュー報告書

| 項目 | 内容 |
|------|------|
| タスクID | M3-04 |
| 対象指示書 | `docs/instructions/M3-04-mycombo-page-and-use-characters.md` v1.0.4 |
| レビュー日(初回) | 2026-05-12 |
| レビュー日(第2回) | 2026-05-13 |
| レビュー担当 | レビュー担当 Claude(Sonnet 4.6) |

## 第2回レビューの背景

初回レビュー(2026-05-12)で指摘した **H-1: リテラル文字列散在**(`useMyComboStatusCounts.ts` / `MyComboPage.tsx` / `CharacterInfoBar.tsx` の3ファイル)が製造担当により修正されたため、第2回レビューを実施した。また、初回レビュー後に追加スコープとして実装された v1.0.3/v1.0.4 相当のファイル群(`MyComboStatusSelect.tsx`、`useUpdateMyComboStatus.ts`、`useMyComboStatusTags.ts`、`ComboTableRow.tsx`、`ComboEditorBasicFields.tsx`、`ComboTable.tsx`、各ページ修正等)に対して新規チェックを実施した。

---

## 総評(第2回)

初回指摘の H-1(リテラル文字列散在)は `MYCOMBO_STATUS_IN_USE` / `MYCOMBO_STATUS_PRACTICING` / `MYCOMBO_STATUS_REDUCED` 定数に置換され解消を確認。チェックリスト §9 の重大判定基準はいずれも抵触しない状態となった。

一方、v1.0.3/v1.0.4 スコープ拡張(ステータス変更 UI 3経路)で追加が必要なテストファイル4件が未作成であること、`MyComboStatusSelector` コンポーネントの設計仕様(`mode` props)が指示書と乖離していること、character ハンドラのエラーレスポンス形式がプロジェクト規約外であること の3点が新規に指摘事項として浮上した。いずれも機能動作への影響はなく、M3-04 の主要機能は達成されている。

---

## 第2回レビュー: 設計準拠性レビュー結果(新規チェック分)

### §1.0 character API ハンドラ

| 観点 | 評価 | 備考 |
|------|------|------|
| 3層実装(handler/service/repository/model) | ◎ | 各ファイル完備、M1-03 パターン踏襲 |
| JSON タグ camelCase | ◎ | `gameId` / `nameJa` / `nameEn` / `customStates` 全 camelCase |
| レスポンス形式 `{"items": [...]}` | ◎ | `CharacterListResponse{Items: items}` |
| game_id 不正時 400 返却 | ○ | 400 は返るが形式に問題あり(後述 H-1) |
| 存在しない game_id → 200 + 空配列 | ◎ | service 層で `nil → []` 変換済み |
| handler_test.go / service_test.go | ◎ | 4ケース + 4ケース、dbtest.Setup 統合テスト有 |

### §1.15 マイコンボステータス変更 UI

| 観点 | 評価 | 備考 |
|------|------|------|
| 3経路で共通コンポーネント利用 | ○ | `MyComboStatusSelect` が全経路で使用、コンポーネント分散なし |
| shadcn/ui 不使用 | ◎ | 標準 `<select>` |
| 4選択肢表示 | ◎ | 使用中/練習中/頻度低下/マイコンボから外す |
| `MYCOMBO_STATUS_LABELS` 定数経由 | ◎ | リテラル使用なし |
| **`mode: 'immediate' \| 'deferred'` props** | **△** | 未実装(後述 H-2)。機能動作はする |
| version フィールド PATCH 送信 | ◎ | `combo.version` 同時送信確認 |
| invalidateQueries(['combos'] / ['tags',...]) | ◎ | onSuccess で両クエリを無効化 |
| ステータス列が ColumnVisibility 対象外 | ◎ | `onStatusChange` props の有無で制御 |
| 楽観的更新の見送り | ◎ | キャッシュ無効化のみ |

### §1.16/§1.17 コンボ編集・一覧画面への経路追加

| 観点 | 評価 | 備考 |
|------|------|------|
| 編集画面に MyComboStatusSelect 配置 | ◎ | `ComboEditorBasicFields.tsx` の「マイコンボ」fieldset |
| TagSelector の mycombo_status 除外維持 | ◎ | `excludeCategories=[TAG_CATEGORY_MYCOMBO_STATUS]` 変更なし |
| 一覧画面各行に MyComboStatusSelect 配置 | ◎ | `ComboTableRow.tsx` の `MyComboStatusCell` 経由 |
| TagBadgeList の mycombo_status 除外維持 | ◎ | `excludeCategories=[TAG_CATEGORY_MYCOMBO_STATUS]` 変更なし |
| 3経路間状態同期 | ◎ | invalidateQueries(['combos']) により全経路の表示が連動更新 |

---

## 第2回レビュー: 新規指摘事項

### H-1: character ハンドラのエラーレスポンス形式がプロジェクト規約外

**対象**: `internal/api/character/handler.go:34`

```go
return c.JSON(http.StatusBadRequest, map[string]string{
    "message": "gameId must be a positive integer",
})
```

プロジェクト内の既存パターンと不一致:
- combo ハンドラ: `{"error": "...", "message": "..."}` 形式
- tag ハンドラ: `{"error": {"code": "...", "message": "..."}}` 形式(DES-002 §4.3 最近似)
- character ハンドラ(今回): `{"message": "..."}` のみ ← `INVALID_GAME_ID` コード欠落

チェックリスト §1.0.5・§2.3 が要求する `INVALID_GAME_ID` エラーコードが応答に含まれていない。現時点でフロントエンドがエラーコードを参照していないため動作影響はないが、3種目の形式追加になり将来の保守コストが増加する。tag ハンドラの `tagErrorResponse{Error:{Code:"INVALID_GAME_ID", Message:"..."}}` 形式に統一することを推奨。

### H-2: `MyComboStatusSelector` の設計仕様との乖離

**対象**: `web/src/features/mycombo/components/MyComboStatusSelect.tsx`

指示書 §4.9.2 では `mode: 'immediate' | 'deferred'` props を持つ `MyComboStatusSelector` を単一コンポーネントとして実装し、immediate モードでは内部で `useUpdateMyComboStatus` を呼ぶ設計を指定している。

実装の実態:
- ファイル名: `MyComboStatusSelect.tsx`(指示書は `MyComboStatusSelector.tsx`)
- `mode` props: 未実装
- `comboId` / `comboVersion` / `currentTags` props: 未実装
- immediate モードの mutation: 親コンポーネント(`MyComboPage.handleStatusChange` / `ComboListPage.handleStatusChange`)に委譲
- `MyComboStatusCell`(ComboTableRow.tsx L160-186): 非公開ヘルパとして `currentStatus` 逆引きと `onStatusChange` ラップを担当

**機能的には全3経路が動作している**。`MyComboStatusSelect` は全経路で共通利用されており、チェックリスト §9 の「コンポーネント分散」重大判定基準には抵触しない(別ファイル分割なし)。ただしチェックリスト §1.15.1 の複数チェック項目(`mode` props / `comboId` / `comboVersion` / `currentTags` 必須)が未達成であり、テストファイルも欠落している。

### H-3: テストファイル複数欠落

以下4件のテストファイルが未作成:

| ファイル | 根拠 | 優先度 |
|---------|------|--------|
| `web/src/features/mycombo/hooks/useUpdateMyComboStatus.test.ts` | フックのテストは SUPP-001 §5.5 で必須。tagIds 構築ロジック・version 送信・invalidateQueries が自動テストで担保されていない | 高 |
| `web/src/features/mycombo/components/MyComboStatusSelect.test.tsx` | 主要ロジックを持つコンポーネントのテスト。チェックリスト §4.2 明示要件 | 高 |
| `web/src/features/combo/components/ComboEditorBasicFields.test.tsx` | v1.0.4 スコープ拡張(経路 1)のテスト。チェックリスト §4.2 明示要件 | 中 |
| `web/src/features/combo/components/ComboTableRow.test.tsx` | v1.0.4 スコープ拡張(経路 2)のテスト。チェックリスト §4.2 明示要件 | 中 |

### M-1: SetupTreeRow の colSpan 計算誤差

**対象**: `web/src/features/combo/components/ComboTable.tsx:93`

```tsx
colSpan={2 + Object.values(visibility).filter(Boolean).length}
```

`onStatusChange` が present の場合(マイコンボ画面・コンボ一覧画面)にステータス列が追加されるが、colSpan が +1 されていない。展開行(SetupTreeRow)が全幅をカバーせず右端に余白が生じる可能性がある。

修正案:
```tsx
colSpan={2 + Object.values(visibility).filter(Boolean).length + (onStatusChange ? 1 : 0)}
```

---

## 第2回レビュー: 推奨修正(優先度別)

- **高(M3 完了前に修正必須)**:
  1. `useUpdateMyComboStatus.test.ts` 新規作成(tagIds 構築・空文字時・version 送信・invalidateQueries・エラー時の各ケース)
  2. `MyComboStatusSelect.test.tsx` 新規作成(4選択肢表示・MYCOMBO_STATUS_LABELS 経由・onChange 発火・currentStatus 初期値)
  3. `internal/api/character/handler.go` のエラーレスポンスを tag ハンドラの `{"error": {"code": "INVALID_GAME_ID", ...}}` 形式に修正

- **中(M4 着手と並行可)**:
  1. `ComboEditorBasicFields.test.tsx` 新規作成(経路 1: tagIds 構築、初期値、TagSelector 責務分離)
  2. `ComboTableRow.test.tsx` 新規作成(経路 2: currentStatus 逆引き、ColumnVisibility 非対象)
  3. `ComboTable.tsx:93` の colSpan を `+ (onStatusChange ? 1 : 0)` 修正

- **低(将来対応)**:
  1. `MyComboStatusSelect.tsx` → `MyComboStatusSelector.tsx` リネームと `mode` props 実装(機能動作への影響なし、指示書仕様との整合のため)

---

## 第2回レビュー: レビュー結果サマリ

| 区分 | 件数 |
|------|------|
| 重大な問題 | **0件** |
| 高優先度(M3 完了前に修正推奨) | **3件**(H-1 エラー形式 / H-2 mode props 欠落 + テスト欠落 2件 / H-3 テスト欠落) |
| 中優先度(M4 並行可) | 3件(テスト2件 + colSpan 修正) |
| 軽微 | 1件(MyComboStatusSelect リネーム・mode props) |

## 第2回レビュー判定

- [x] 重大な問題なし

チェックリスト §9 の重大判定基準はいずれも満たされており **条件付き承認**。高優先度3件(テストファイル2件・エラーレスポンス形式)を修正後、開発者確認のみで M3-04 完了とすることを推奨する。

---

## 設計準拠性レビュー結果

### §1.1 マイコンボ画面の独立画面化 ◎

- `/mycombo` の独立ルートで実装されている ✅
- `MyComboPageRoute.tsx` が `router.tsx` に正しく登録 ✅
- DES-005 §3 画面遷移図と整合 ✅

### §1.2 マイコンボ画面の必須表示項目 ◎

- キャラクター情報バー: `CharacterInfoBar.tsx` で実装 ✅
- マイコンボステータス切替タブ: `MyComboStatusTabs.tsx` で実装 ✅
- キャラクター切替プルダウン: `CharacterSelector.tsx` で実装 ✅
- ソート対象: `SORT_FIELD_VALUES` を再利用 ✅
- アクション: タブ切替でタグフィルタ一括適用 ✅
- レスポンシブ: タブは `overflow-x-auto` でスマホ横スクロール ✅

### §1.3 useCharacters フック ◎

- API パス `/api/games/${gameId}/characters` で正確に実装 ✅
- `DEFAULT_GAME_ID = 1` 定義あり ✅
- queryKey `["characters", { gameId }]` ✅
- `Character` 型に `id`/`nameJa`/`nameEn`/`code` 等が含まれ camelCase ✅
- `useCharacterName(characterId)` ヘルパ実装済み ✅
- null/undefined/存在しない ID → 空文字返却 ✅

### §1.4 characterApi クライアント関数 ◎

- `characterApi.list(gameId)` → `/api/games/${gameId}/characters` を呼び出し ✅
- レスポンス構造: `{items: [...]}` ラッパー形式を正しくハンドリング（`fetchJSON<CharacterListResponse>` → `res.items`）✅
- エラーハンドリング: `fetchJSON` 共通クライアント経由で実装済み ✅

### §1.5 CHARACTER_NAMES 定数の全差し替え ◎

- `grep -rn 'CHARACTER_NAMES' web/src/` → **0件** ✅
- `DuplicateRealtimeWarning.tsx`: `useCharacterName` フックに正しく差し替え済み ✅
- `buildDuplicateLabel` が非コンポーネント関数のため `characterName: string` を引数追加して外出し — 適切な判断 ✅

### §1.6 マイコンボ画面のルーティング ◎

- `/mycombo` ルートが `router.tsx` に追加されている ✅
- `MyComboPageRoute` がマウントされる ✅

### §1.7 主要ナビゲーションへの「マイコンボ」リンク追加 ○

- `ComboListPage.tsx`: 「マイコンボ」リンク `/mycombo` 追加 ✅
- `TrashPage.tsx`: 追加済み(progress-log 記録) ✅
- `TagManagementPageRoute.tsx`: 追加済み(progress-log 記録) ✅
- **軽微な指摘**: `MyComboPage.tsx` の「コンボ一覧」リンクの遷移先が `/`（ルート）になっており、正規 URL の `/combos` ではない。機能的には同じだが一貫性上の問題。

### §1.8 MyComboPage の構造 ◎

- `<CharacterInfoBar>` / `<MyComboStatusTabs>` / `<CharacterSelector>` の3コンポーネント組込み ✅
- `ComboTable` (M3-03実装) を再利用 ✅
- `useMyComboStatusCounts` で件数取得、タグ ID ルックアップで `useCombos({ tagIds: [...] })` フィルタ ✅

### §1.9 URL クエリ設計 ◎

- `?status=in_use` 等で選択中タブを表現 ✅
- 未指定時は `"in_use"`(使用中)が既定 ✅
- URL クエリ値が `MYCOMBO_STATUS_VALUES` で表現 ✅ (**ただし後述の§1.13 リテラル問題が存在する**)

### §1.10 CharacterInfoBar(上振れ要素1) ◎

- キャラクター名: `useCharacterName(characterId)` で取得、頭文字円形バッジ表示 ✅
- 件数ダッシュボード: 3統計値カード形式、grid 3列 ✅
- Props: `characterId` + `statusCounts` ✅
- 件数 0 時: 3件数がすべて 0 のとき案内文を表示 ✅
- shadcn/ui 未使用 ✅

### §1.11 MyComboStatusTabs(上振れ要素2) ◎

- 3タブ(使用中・練習中・頻度低下)、横並び ✅
- 選択中タブのハイライト(クラス付与) ✅
- 各タブに件数バッジ `(N)` 形式 ✅
- クリックで `onSelect` 発火 ✅
- スマホ `overflow-x-auto` ✅
- shadcn/ui 未使用 ✅

### §1.12 CharacterSelector(上振れ要素3) ◎

- 標準 HTML `<select>` ✅
- `useCharacters` フックの結果を選択肢として動的生成 ✅
- 1キャラのみ (`isSingleCharacter || isLoading`) → disabled ✅
- M7 拡張可能な配列ベース構造 ✅
- Props: `selectedCharacterId` / `onChange` ✅

### §1.13 MyComboStatus 列挙定数同期 ○

**バックエンド側** (`internal/model/tag.go`):

- `MyComboStatusInUse = "in_use"` 等の Go 定数 ✅
- `MyComboStatusTagNames` マッピング定義 ✅
- フロント `MYCOMBO_STATUS_VALUES` との値完全一致 ✅

**フロントエンド側** (`web/src/constants/mycombo.ts`):

- `MYCOMBO_STATUS_VALUES` 配列、`MyComboStatus` 型、`MYCOMBO_STATUS_LABELS`、`MYCOMBO_STATUS_TAG_NAMES` Record — すべて定義 ✅

**同期性**: バックエンド定数値(`"in_use"` / `"practicing"` / `"reduced"`)とフロント定数が完全一致 ✅

**ただし後述の重大問題: リテラル文字列散在 (§3.1 違反)**

### §1.14 useMyComboStatusCounts フック ◎

- `GET /api/tags?include_usage=true&category=mycombo_status` を呼び出し ✅
- queryKey が `["tags", { include_usage: true, category: "mycombo_status" }]` — M3-01 の queryKey と適切に分離 ✅
- 戻り値 `MyComboStatusCounts`(`inUse` / `practicing` / `reduced`) ✅
- タグデータが見つからない場合 0 件 ✅

---

## 設計準拠性以外の指摘事項

### P-1: Character API バックエンド新規実装のプロセス(中)

**観点**: チェックリスト §9 / 指示書 §2.4

progress-log には「指示書 v1.0.1 で Character API が未実装であることが判明し、本マイルストーン内で実装した」と記録されているが:

1. 実際の指示書ファイルは v1.0.0 のまま(「指示書 v1.0.1」への言及が宙に浮いている)
2. Plan Mode での開発者確認記録が progress-log に存在しない
3. チェックリスト §9 が「新規 API が追加されている」を重大問題として明示

実装内容自体は DES-002 §4.2 で定義済みのエンドポイントであり、設計的に正しい。ただし指示書 §2.4 が「Plan Mode で停止して開発者に相談すること」と明記しているため、事後確認が必要。

**推奨**: 開発者への事後報告(設計書との整合は問題なし、プロセスの記録が不完全)。

### P-2: Go 定数 godoc コメント形式不備(軽微)

**対象**: `internal/model/tag.go`

```go
// タグ予約カテゴリ(DES-003 §3.6)。マイコンボ管理用。
const TagCategoryMyComboStatus = "mycombo_status"
```

godoc コメントは宣言名で始める必要がある: `// TagCategoryMyComboStatus はタグ予約カテゴリ...`

`MyComboStatusInUse`/`MyComboStatusPracticing`/`MyComboStatusReduced` も公開定数だが個別 godoc がない(ブロックの前コメントはあり)。

CLAUDE.md §4 Go 規約「公開 API(大文字始まり)には godoc コメントを必ず付ける」に対する軽微な逸脱。

### P-3: タグデータ未ロード中の全コンボ一時表示(軽微)

**対象**: `MyComboPage.tsx` L98-114

`mycomboTagsQuery.data` が未ロードの間 `tagId` が `undefined` になり、`apiFilter` に `tagIds` が含まれない。この状態で `useCombos(apiFilter)` が呼ばれると、全コンボが表示される瞬間がある(ローディング完了後にフィルタ結果に切り替わるフリッカー)。

実用上は影響が小さいが、UX 上の改善余地あり。`mycomboTagsQuery.isLoading` のときはコンボクエリを suspend するか、スケルトン表示する等の対策が考えられる。

### P-4: 「コンボ一覧」リンクの遷移先(軽微)

**対象**: `MyComboPage.tsx` L132

```tsx
<Link to="/" className="text-sm text-slate-500 hover:text-blue-600">
  コンボ一覧
</Link>
```

ルートエイリアス `/` と正規 URL `/combos` は同じ画面を表示するが、他ページでは `/combos` 以外の表記は見当たらない。`to="/combos"` に統一することを推奨。

---

## 推奨修正(優先度別) — 第2回更新版

> 初回指摘の H-1(リテラル文字列散在)は 2026-05-13 の製造担当修正にて解消済み。以下は第2回レビューで新規に発見された事項。

### 高(M3完了前に修正必須)

**H-1(解消済み)**: リテラル文字列散在 → `MYCOMBO_STATUS_IN_USE` 等の定数に置換済みを確認 ✅

**H-2(新規)**: テストファイル2件の新規作成
- `web/src/features/mycombo/hooks/useUpdateMyComboStatus.test.ts`: tagIds 構築・空文字時・version 送信・invalidateQueries・エラー時の各ケース
- `web/src/features/mycombo/components/MyComboStatusSelect.test.tsx`: 4選択肢表示・MYCOMBO_STATUS_LABELS 経由・onChange 発火・currentStatus 初期値

**H-3(新規)**: `internal/api/character/handler.go` のエラーレスポンスを tag ハンドラ形式 `{"error": {"code": "INVALID_GAME_ID", "message": "..."}}` に統一

### 中(M4着手と並行可)

**M-1(初回継続)**: Go godoc コメントを godoc 形式(`// TagCategoryMyComboStatus は...` 形式)に修正。

**M-2(新規)**: `ComboEditorBasicFields.test.tsx` 新規作成(経路 1: tagIds 構築、初期値、TagSelector 責務分離)。

**M-3(新規)**: `ComboTableRow.test.tsx` 新規作成(経路 2: currentStatus 逆引き、ColumnVisibility 非対象)。

**M-4(新規)**: `ComboTable.tsx:93` の colSpan を `+ (onStatusChange ? 1 : 0)` 修正。

### 低(将来対応)

**L-1(初回継続)**: タグデータ未ロード中の全コンボ表示フリッカー対策(`mycomboTagsQuery.isLoading` 中のスケルトン表示等)。

**L-2(初回継続)**: `MyComboPage.tsx` の「コンボ一覧」リンク遷移先を `"/"` から `"/combos"` に統一。

**L-3(新規)**: `MyComboStatusSelect.tsx` → `MyComboStatusSelector.tsx` リネームと `mode` props 実装(機能動作への影響なし)。

---

## 良かった点

- **CHARACTER_NAMES 完全削除**: `grep -rn 'CHARACTER_NAMES' web/src/` が 0 件で、差し替えの徹底ぶりが高品質
- **useCharacters フックの実装**: 指示書 §4.1.2 の構造例に忠実で、`useCharacterName` ヘルパも適切に実装されている
- **DuplicateRealtimeWarning の差し替え**: 非コンポーネント関数 `buildDuplicateLabel` の `characterName` 引数外出しという素直な解決策
- **バックエンド・フロント列挙定数の値完全一致**: `"in_use"` / `"practicing"` / `"reduced"` が両側で一致、同期ルールを遵守
- **useColumnVisibility の共用**: 別キーを導入せず `combo-list-columns-v1` を共用し、指示書 §4.4 の確定方針通り
- **CharacterSelector の disabled 設計**: `isSingleCharacter || isLoading` で1キャラ時は常に disabled、M7 拡張基盤として配列ベース実装
- **useUpdateMyComboStatus の tagIds ロジック**: mycombo_status カテゴリフィルタ・新ステータス追加・空文字時除外・version 同時送信がすべて正確
- **shadcn/ui 完全不使用**: 標準 HTML `<select>` / `<button>` + Tailwind 自作で playbook §4.6 を遵守
- **character API バックエンドの3層実装品質**: M1-03 パターン踏襲、godoc コメント完備、統合テスト充実
- **上振れ要素3項目すべて実装**: 件数ダッシュボード(CharacterInfoBar)・カウントバッジ(MyComboStatusTabs)・キャラ切替プルダウン基盤(CharacterSelector)
- **初回レビュー指摘への迅速な対応**: H-1 のリテラル散在3ファイルを MYCOMBO_STATUS_IN_USE 等の定数に置換して完全解消

---

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機テスト(E2E シナリオ A〜L)は別途開発者による実機確認が必要。
- テストの通過確認は progress-log の記録ベース(190件全通過)。レビュー担当 Claude は `pnpm exec vitest run` を直接実行していない。

---

## レビュー結果サマリ

| 区分 | 件数 | 主な内容 |
|------|------|---------|
| 重大な問題 | **0件** | — |
| 高優先度(M3 完了前に修正必須) | **3件** | テスト欠落2件・エラー形式1件 |
| 中優先度(M4 並行可) | 4件 | テスト欠落2件・godoc 1件・colSpan 1件 |
| 軽微 | 3件 | リネーム・フリッカー・リンク |

## レビュー判定

- [x] **重大な問題なし → 条件付き承認**

チェックリスト §9 の重大判定基準はいずれも満たされている。高優先度3件(H-2 テスト2件・H-3 エラーレスポンス形式)を修正後、開発者確認のみで M3-04 完了とすることを推奨する。

---

*以上*

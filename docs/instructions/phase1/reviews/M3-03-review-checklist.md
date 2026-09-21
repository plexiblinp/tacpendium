# M3-03 レビューチェックリスト

| 項目 | 内容 |
|------|------|
| チェックリストID | M3-03-REVIEW |
| バージョン | 1.0.1 |
| 対象指示書 | `docs/instructions/M3-03-filter-sort-column-customize.md` v1.0.2 |
| 対象マイルストーン | M3-03: コンボ一覧のフィルタ・ソート・表示列カスタマイズ + browser-storage ヘルパ新設 |
| 推奨レビューモデル | **Sonnet 4.6**(model-allocation.md v1.2.0 準拠、Opus 4.6 実装の1段下) |
| 作成者 | 詳細設計・製造準備担当Claude(M3 期間担当) |
| 作成日 | 2026-05-10 |
| 更新日 | 2026-05-10 |

## 更新履歴

| バージョン | 更新日 | 更新内容 |
|-----------|--------|----------|
| 1.0.0 | 2026-05-10 | 初版作成 |
| 1.0.1 | 2026-05-10 | 対象指示書 v1.0.1 → v1.0.2 追従。§1.10 ソート種別ホワイトリスト確認のソート種別名を「`drive_gauge_consumed` / `sa_gauge_consumed`」から「`drive_gauge_consumed_total` / `sa_gauge_consumed_total`」(末尾 `_total` 付き)に修正。DES-003 §3.4 (L341-342) との行レベル照合の精度向上 |

---

## 0. レビュー担当への前置き

### 0.1 レビュー前の準備

レビュー開始前に以下を必ず読む:

1. `CLAUDE.md`(全体方針、特に **§4 JSON タグ camelCase / 列挙定数同期ルール**、§10 禁止事項、**§10.X ブラウザストレージ運用ルール**)
2. `docs/instructions/M3-03-filter-sort-column-customize.md` v1.0.1(本チェックリストの対象指示書)
3. `docs/instructions/M3-overview.md` v1.0.1(M3 全体運用ルール、特に §6.6 / §6.9)
4. `docs/instructions/M3-01-tag-feature-and-management.md` / `M3-02-tag-assignment-ui.md`(タグ API、コンボ DTO の tags フィールド、`useTagsForSelector`)
5. `docs/instructions/M2-03-trash-page.md`(only_deleted クエリパラメータ追加先例、本マイルストーンが踏襲する実装パターン)
6. `docs/design/05-screen-design.md` §5.4 コンボ一覧(L183-236)
7. `docs/design/03-data-model.md` §3.4 combos テーブル定義、§4 インデックス方針、§6 OPEN-001
8. `docs/design/02-architecture.md` §4.2 GET /api/combos、§4.3 エラーハンドリング
9. `docs/design/supp-001-detailed-design.md` v1.9.0(§5.4 / §5.5 テスト規約、**§5.9 PATCH 送信ポリシー**、**§6.4 列挙定数同期ルール**)
10. `docs/handover/design-instruction-playbook.md` v1.4.0(**§4.5 フローの素直さ原則、§4.6 UI ライブラリ実態確認原則、§4.7 全ハンドラ列挙原則**)
11. 製造担当の実装完了報告書(本リスト適用前に受領済み)

### 0.2 レビューの基本姿勢

- **設計書本体との行レベル照合を最優先**(playbook §5、retro R-01)
- **localStorage 使用範囲を厳格にチェック**(CLAUDE.md §10.X 許容範囲内のみ + 共通ヘルパ経由 + キーバージョニング遵守):本マイルストーンは初の本格 localStorage 利用
- **共通ヘルパ `browser-storage.ts` の品質を厳格にチェック**:M6 / M7 で再利用される共有資産のため、try-catch・JSON シリアライズ・容量超過処理の堅牢性が重要
- **SQL injection 対策を厳格にチェック**:フィルタ値はプレースホルダ、ソートはホワイトリスト
- **playbook §4.5 / §4.6 / §4.7 の3ルール全てを遵守しているか確認**(M2-04 / M3-01 / M3-02 各反省の累積)
- **JSON タグ・API DTO 型・列挙定数の camelCase 統一とバックエンド/フロント同期を厳格にチェック**(CLAUDE.md §4)
- **「副次効果として〜される」「自動的に〜される」表現が紛れ込んでいないか確認**(playbook §4.1)
- 機械的チェックリスト確認に加え、設計意図との整合を読み取る(playbook §9.3)
- 重大な問題と軽微な問題を区別する(§9 / §10 参照)

### 0.3 レビュー結果の報告フォーマット

レビュー完了時に以下のフォーマットで報告する:

```
## レビュー結果サマリ

- 重大な問題: {件数}件
- 軽微な問題: {件数}件
- 質問・確認事項: {件数}件

## 重大な問題詳細
(各問題の節番号、対象ファイル、内容、修正提案を記載)

## 軽微な問題詳細
(同上)

## 質問・確認事項
(設計担当 Claude または開発者への確認事項)

## レビュー判定
- [ ] 重大な問題なし → 承認
- [ ] 重大な問題あり → 製造担当に修正依頼
```

---

## 1. 設計書本体との照合(retro R-01 対応、最重要観点)

### 1.1 共通ヘルパ `browser-storage.ts`(M3-03 §4.1、CLAUDE.md §10.X §3.3)

実装ファイル: `web/src/lib/browser-storage.ts`

- [ ] `createLocalStorageHelper<T>(key: string): StorageHelper<T>` のシグネチャで実装されている
- [ ] `StorageHelper<T>` インターフェースが指示書 §4.1.2 と一致(`save(value): boolean` / `load(): T | null` / `remove(): void`)
- [ ] `save` 内で `localStorage.setItem` が try-catch で囲まれている
- [ ] `save` 失敗時に `console.warn` でログを出し、`return false` する
- [ ] `load` 内で `localStorage.getItem` と `JSON.parse` が try-catch で囲まれている
- [ ] `load` 未保存時・parse 失敗時に `null` を返す
- [ ] `remove` が `localStorage.removeItem` を try-catch で囲み、失敗してもアプリが落ちない
- [ ] **キー名にバージョン suffix(`-v1` 等)が必須** であることがコメントで明示されている(指示書 §4.1.2)
- [ ] SSR 対応コードが入っていない(本アプリは SPA、指示書 §4.1.3 で明示的に不要としている)

### 1.2 useColumnVisibility フック(M3-03 §4.4.2、CLAUDE.md §10.X §3.1.1)

実装ファイル: `web/src/features/combo/hooks/useColumnVisibility.ts`

- [ ] **キー名が `combo-list-columns-v1` で固定**(CLAUDE.md §10.X §3.1.1 で確定済み、別名を採用していない)
- [ ] `createLocalStorageHelper<ColumnVisibility>(STORAGE_KEY)` 経由で読み書きしている(直接 `localStorage` を呼んでいない)
- [ ] `DEFAULT_VISIBILITY` 定数で6列の既定値(全 `true`)が定義されている
- [ ] 初期 mount 時に `storage.load() ?? DEFAULT_VISIBILITY` で復元している
- [ ] `updateVisibility` で `setVisibility` + `storage.save` の両方を実行している
- [ ] `resetVisibility` で `setVisibility(DEFAULT_VISIBILITY)` + `storage.remove` の両方を実行している
- [ ] **互換性マージ処理**: load 後に `{ ...DEFAULT_VISIBILITY, ...stored }` でマージし、新カラムが追加されていれば既定値で埋まる(指示書 §4.4.2 互換性の考慮)

### 1.3 ColumnVisibility 型定義(M3-03 §4.4.1)

- [ ] 6列(`starterSituation` / `damage` / `recipe` / `tags` / `draftStatus` / `memo`)が `boolean` 型で定義されている
- [ ] DES-005 §5.4 の表示列定義と整合している(M3-03 §1.3 で除外した「展開アイコン」「コピー/編集/削除アイコン」が含まれていない)

### 1.4 ColumnVisibilityMenu コンポーネント(M3-03 §4.4.1)

実装ファイル: `web/src/features/combo/components/ColumnVisibilityMenu.tsx`

- [ ] Props 設計が指示書 §4.4.1 の `ColumnVisibilityMenuProps` と一致(`visibility` / `onChange` / `onReset`)
- [ ] 各列のチェックボックス切替で `onChange` が発火、新しい visibility オブジェクトが渡される
- [ ] 「リセット」ボタンで `onReset` が発火する
- [ ] **shadcn/ui 不使用**(playbook §4.6、標準 HTML + Tailwind 自作)
- [ ] ポップオーバーの外側クリック検知が M2-02 `DuplicateRealtimeWarning.tsx` パターンの再利用、または同等の実装になっている

### 1.5 ComboTableRow への visibility 反映(M3-03 §4.4.3)

実装ファイル: `web/src/features/combo/components/ComboTableRow.tsx`(または相当)

- [ ] `visibility` を props で受け取り、各 `<td>` を `{visibility.xxx && <td>...</td>}` で条件付き描画している
- [ ] ヘッダ行 `<thead>` の `<th>` も同じ条件で制御されている(列表示と整合)
- [ ] 非表示列があっても layout が崩れない(行ごとの `<td>` 数は visibility の状態に依存して一貫している)

### 1.6 GET /api/combos クエリパラメータ拡張(M3-03 §4.2.1)

実装ファイル: `internal/api/combo/handler.go` の List ハンドラ

- [ ] 8 種のクエリパラメータが受け取れる: `character_id` / `tag_ids` / `position` / `hit_type` / `opponent_stance` / `is_draft` / `sort` / `order`
- [ ] 既存の `only_deleted` クエリパラメータが温存されている(M2-03 で導入済み、回帰なし)
- [ ] 各パラメータが空文字または未指定の場合に「絞り込みなし」として扱われる
- [ ] `tag_ids` のカンマ区切りパースが動作する(`?tag_ids=1,2,3` → `[]int64{1, 2, 3}`)
- [ ] `tag_ids` の不正値(数値変換失敗)で 400 + `INVALID_QUERY_PARAM` を返す
- [ ] `is_draft` / `only_deleted` の bool パースが `strconv.ParseBool` で行われている

### 1.7 ListFilter / ListSort 構造体(M3-03 §4.2.2)

実装ファイル: `internal/service/combo/service.go`(または model)

- [ ] `ListFilter` 構造体に7フィールド(`CharacterID *int64` / `TagIDs []int64` / `Position *string` / `HitType *string` / `OpponentStance *string` / `IsDraft *bool` / `OnlyDeleted bool`)が定義されている
- [ ] ポインタ型が「未指定」を表現する用途で使われている(指示書 §4.2.2)
- [ ] `ListSort` 構造体に `Field string` と `Order string` が定義されている
- [ ] `OnlyDeleted` のみポインタ型でない(M2-03 既存実装の互換維持、bool 既定値 false が「論理削除なし側を取得」を意味する)

### 1.8 サービス層 List 関数のシグネチャ(M3-03 §4.2.2)

実装ファイル: `internal/service/combo/service.go`

- [ ] シグネチャが指示書 §4.2.2 と一致: `func (s *Service) List(ctx context.Context, userID int64, filter ListFilter, sort ListSort) ([]model.ComboListItem, error)`
- [ ] 第一引数が `context.Context`(CLAUDE.md §4 Go 規約)

### 1.9 リポジトリ層の SQL 動的生成(M3-03 §4.2.3)

実装ファイル: `internal/repository/combo/repository.go`

- [ ] WHERE 句の動的生成が指示書 §4.2.3 と一致(7 種の AND 句、各フィルタが nil/空でない場合のみ追加)
- [ ] `tag_ids` の OR 条件が `AND id IN (SELECT combo_id FROM combo_tags WHERE tag_id IN (?, ?, ...))` で実装されている
- [ ] **フィルタ値はプレースホルダ `?` で渡されている**(`Position` / `HitType` / `OpponentStance` 等の文字列値が SQL に直接埋め込まれていない、SQL injection 対策)
- [ ] 既存の `OnlyDeleted` ロジック(`AND deleted_at IS NOT NULL` / `AND deleted_at IS NULL`)が温存されている

### 1.10 ソート種別ホワイトリスト(M3-03 §4.2.4)

- [ ] `sortFieldWhitelist` map または同等のホワイトリストが実装されている
- [ ] 6 種のソート種別(`default` / `updated_at` / `damage` / `starter_move_id` / `drive_gauge_consumed_total` / `sa_gauge_consumed_total`)がすべて含まれている
- [ ] **ホワイトリスト外の `sort` 値で `default` にフォールバック** する
- [ ] **`order` が `asc` / `desc` 以外で `desc` にフォールバック** する
- [ ] `default` ソートが複合ソート(`starter_move_id ASC, position ASC, hit_type ASC, opponent_stance ASC, opponent_size ASC`)で実装されている
- [ ] **SQL カラム名が DES-003 §3.4 combos テーブル定義と完全一致** している(製造担当が §3.4.3 着手前確認で確認した結果を確認)
- [ ] **ソート種別と方向以外、ユーザー入力が SQL に直接埋め込まれていない**(SQL injection 対策、ホワイトリスト経由のみ)

### 1.11 ComboListFilters コンポーネント(M3-03 §4.3.1、DES-005 §5.4 表示項目3)

実装ファイル: `web/src/features/combo/components/ComboListFilters.tsx`

- [ ] DES-005 §5.4 の表示項目3「フィルタ・ソート領域」を網羅:
  - キャラクター選択プルダウン
  - タグフィルタ(複数選択可、`useTagsForSelector` 経由、`excludeCategories=["mycombo_status"]`)
  - 状況フィルタ(position / hit_type / opponent_stance のプルダウン、初期値「全て」)
  - 仮登録表示トグル(全て / 本登録のみ / 仮登録のみ)
  - ソート種別選択プルダウン(6 種)
  - 昇降ラベル(項目に応じた自然な表現、§4.3.4)
  - 表示列カスタマイズメニュー(`<ColumnVisibilityMenu>` を組み込み)
- [ ] Props が指示書 §4.3.1 の `ComboListFiltersProps` と一致
- [ ] **shadcn/ui 不使用**、標準 HTML(`<select>` / `<input type="checkbox">` / `<button>`)+ Tailwind で実装されている
- [ ] レスポンシブ対応(PC 横並び / スマホ縦積み、Tailwind クラス)

### 1.12 useComboListFilters フック(M3-03 §4.3.2)

実装ファイル: `web/src/features/combo/hooks/useComboListFilters.ts`

- [ ] React Router の `useSearchParams` で URL クエリパラメータと連動している
- [ ] `filters` が `useMemo` で `searchParams` から復元される
- [ ] `updateFilters` で URL クエリパラメータを更新する
- [ ] **既定値はクエリに含まれない**(URL を短く保つ、指示書 §4.3.2)
- [ ] `null` 値・空配列もクエリに含まれない
- [ ] `parseIntOrNull` / `parseTagIds` / `parseBoolOrNull` のヘルパが実装されている、または同等のパース処理がある

### 1.13 useCombos との連携(M3-03 §4.3.2)

実装ファイル: `web/src/features/combo/hooks/useCombos.ts`(または相当)

- [ ] queryKey にフィルタ・ソート条件が含まれている(`['combos', 'list', filtersKey]` 形式)
- [ ] フィルタ変更時に TanStack Query が再取得をトリガーする(queryKey 変化を契機としたキャッシュ分離)

### 1.14 状況コード値マスタ(M3-03 §4.3.3、CLAUDE.md §4 列挙定数同期ルール)

実装ファイル: `internal/model/combo.go` および `web/src/constants/combo-list.ts`

- [ ] **バックエンド側に Go 定数が定義されている**: `PositionAny / Center / Corner` 等の定数群
- [ ] **フロントエンド側に TypeScript 定数が定義されている**: `POSITION_VALUES` / `POSITION_LABELS` / `Position` 型 等
- [ ] **両側で値が完全一致**(typo・表記揺れなし)
- [ ] フィルタ UI(ComboListFilters)で **リテラル文字列(`"corner"` 等)が直接使われていない**、すべて定数経由
- [ ] 「全て」表示の場合の値処理(空文字または `null` で表現)が一貫している
- [ ] §3.4(着手前確認)で取得した既存 seed の `SELECT DISTINCT` 結果が **すべて定数に含まれている**(製造担当が報告した結果を確認)

### 1.15 昇降ラベル(M3-03 §4.3.4、DES-005 §5.4)

実装ファイル: `web/src/constants/combo-list.ts`

- [ ] `SORT_FIELD_LABELS` または同等のオブジェクトに 6 種ソートの asc / desc ラベルが定義されている
- [ ] ラベル文言が指示書 §4.3.4 と一致(更新日時:昔/最近、ダメージ:小さい順/大きい順 等)
- [ ] ComboListFilters の昇降表示で `SORT_FIELD_LABELS` から動的にラベルを取得している(リテラル文字列を使っていない)

### 1.16 ComboList.tsx への統合(M3-03 §2.2)

実装ファイル: `web/src/features/combo/components/ComboList.tsx`

- [ ] `<ComboListFilters>` が組み込まれている
- [ ] `<ColumnVisibilityMenu>` が組み込まれている(ComboListFilters 内 or 隣接)
- [ ] `useComboListFilters` フックが利用されている
- [ ] `useColumnVisibility` フックが利用されている
- [ ] フィルタ・ソート結果がコンボ一覧テーブルに反映される
- [ ] 表示列の visibility がテーブル行・ヘッダに反映される

---

## 2. API 整合性(retro R-08)

### 2.1 リクエスト/レスポンス DTO の整合

- [ ] バックエンドのクエリパラメータ名(`character_id` / `tag_ids` 等)とフロントの `comboApi.list()` 関数の引数名が対応している
- [ ] `useComboListFilters` の戻り値型 `ComboListFilters` が camelCase で定義されている(CLAUDE.md §4)
- [ ] URL クエリパラメータ名は snake_case(`character_id`)、フロント TypeScript の型は camelCase(`characterId`)で分離されている
- [ ] レスポンス DTO は M3-02 で確定済みの `ComboListItem`(tags フィールド含む)を変更していない

### 2.2 エラーレスポンス共通フォーマット(DES-002 §4.3)

- [ ] エラーレスポンスが `{error: {code, message, details?}}` 構造に従っている
- [ ] HTTP ステータスとエラーコードの対応:
  - 400 + `INVALID_QUERY_PARAM`(`tag_ids` のパース失敗、details に詳細情報)

### 2.3 各エンドポイントの動作確認

製造担当の curl 結果報告を確認:

- [ ] `?character_id=1` → リュウのコンボのみ
- [ ] `?tag_ids=1,2` → タグ ID 1 か 2 を持つコンボ(OR 条件)
- [ ] `?sort=damage&order=desc` → ダメージ降順
- [ ] `?sort=damage&order=asc` → ダメージ昇順
- [ ] `?sort=default` → 始動状況複合ソート
- [ ] `?character_id=1&tag_ids=1&is_draft=true` → 複合フィルタ AND 動作
- [ ] `?tag_ids=abc` → 400 + INVALID_QUERY_PARAM
- [ ] `?sort=unknown_field` → 200(default フォールバック)
- [ ] `?order=invalid` → 200(desc フォールバック)
- [ ] `?only_deleted=true` → 200(M2-03 回帰)

### 2.4 JSON 命名規則の統一(CLAUDE.md §4)

- [ ] フロント側の DTO 型(`ComboListFilters`、関連型)が camelCase で定義されている
- [ ] `grep -rn '\\bxxx_xxx\\b' web/src/features/combo/` で snake_case が混入していないか確認(ただし URL クエリパラメータ名は snake_case で正、これは API 仕様)
- [ ] URL クエリパラメータの送信時、フロント側の camelCase フィールド名がバックエンドの snake_case パラメータ名に正しく変換されている

---

## 3. localStorage 使用範囲のチェック(M3-03 固有最重要観点)

### 3.1 共通ヘルパ経由の徹底(CLAUDE.md §10.X §3.3)

- [ ] `grep -rn 'localStorage\|sessionStorage\|IndexedDB' web/src/` で検出される使用箇所が **すべて `web/src/lib/browser-storage.ts` 内のみ** であること
- [ ] 各機能(`useColumnVisibility` 等)から **直接 `localStorage.setItem` / `getItem` / `removeItem` を呼んでいない**
- [ ] ヘルパ経由しないアクセスが検出された場合は **重大な問題**

### 3.2 許容範囲外の使用がないこと(CLAUDE.md §10.X §3.1)

CLAUDE.md §10.X で許容された3用途のみ使用可:
1. コンボ一覧の表示列カスタマイズ(本マイルストーンで初実装)
2. 仮想コントローラの種類選択保持(M7 で実装予定、本マイルストーンでは未実装)
3. コンボ登録・編集画面の下書き自動保存(M6 で実装予定、本マイルストーンでは未実装)

- [ ] 本マイルストーンで使用されている localStorage キーは **`combo-list-columns-v1` のみ**
- [ ] 他の用途で localStorage が使われていないか確認(`grep -rn 'localStorage' web/src/` の結果が `browser-storage.ts` 内 + `useColumnVisibility` の `STORAGE_KEY = 'combo-list-columns-v1'` 定義のみ)

### 3.3 キーバージョニング遵守(CLAUDE.md §10.X §3.3)

- [ ] `combo-list-columns-v1` のキー名末尾に `-v1` suffix が付いている
- [ ] 他のキーが導入されていないが、もし導入されている場合は同様に `-v1` suffix が付いている

### 3.4 try-catch・容量超過対応の堅牢性(M3-03 §4.1.3)

- [ ] `save` の try-catch 内で `console.warn` がログを出している
- [ ] `save` 失敗時に `return false` で UI 側に成功/失敗を通知できる
- [ ] `load` の try-catch 内で `JSON.parse` 失敗を吸収している
- [ ] `remove` の try-catch が失敗してもアプリが落ちない
- [ ] プライベートブラウジングや容量超過のシミュレーションテスト(§5.1.1)が実施されている

### 3.5 互換性マージ処理(M3-03 §4.4.2 互換性の考慮)

- [ ] `useColumnVisibility` の load 後に `{ ...DEFAULT_VISIBILITY, ...stored }` でマージしている
- [ ] 既存の保存値に新カラムが含まれていない場合、新カラムが既定値(true)で埋まる
- [ ] 古い保存値の不要キーがあっても無視される(マージで上書きされる)

---

## 4. SQL injection 対策のチェック(M3-03 固有重要観点)

### 4.1 フィルタ値のプレースホルダ化(M3-03 §4.2.3)

実装ファイル: `internal/repository/combo/repository.go`

- [ ] `filter.Position` / `filter.HitType` / `filter.OpponentStance` 等の文字列値が **すべてプレースホルダ `?` 経由** で SQL に渡されている
- [ ] `filter.CharacterID` / `filter.TagIDs` 等の数値・配列値もプレースホルダ経由
- [ ] **`fmt.Sprintf` や文字列結合で値を SQL に直接埋め込んでいない**(SQL injection 対策の基本)
- [ ] `tag_ids` の IN 句では `?, ?, ?` のプレースホルダ展開が動的生成されている

### 4.2 ソート種別ホワイトリスト(M3-03 §4.2.4)

- [ ] `sort.Field` がホワイトリスト(`sortFieldWhitelist` map)経由でのみ SQL に埋め込まれる
- [ ] ホワイトリスト外の値は `default` にフォールバック
- [ ] `sort.Order` が `asc` / `desc` の正規化を経てから SQL に埋め込まれる
- [ ] 不正値で `desc` にフォールバック
- [ ] **ホワイトリスト経由以外でユーザー入力が SQL に埋め込まれていない**

### 4.3 SQL 動的生成のテスト(M3-03 §5.1.2)

- [ ] リポジトリ層テストに不正値(`sort=DROP TABLE combos`等)で SQL injection が発火しないことの動作確認テストが含まれているか、または **ホワイトリストフォールバックが機能することのテスト** が含まれている
- [ ] 不正な `sort` / `order` 値で 200 レスポンスを返し、フォールバックが効いていることが確認できる

---

## 5. テストの妥当性

### 5.1 共通ヘルパテスト(M3-03 §5.1.1)

実装ファイル: `web/src/lib/browser-storage.test.ts`

- [ ] save → load の往復(プリミティブ型・オブジェクト・配列)
- [ ] 未保存キーの load が null
- [ ] 不正な JSON 保存時の load が null(壊れたキャッシュからの自動回復)
- [ ] save 容量超過時の `return false` + console.warn(`localStorage.setItem` モックで QuotaExceededError)
- [ ] remove 後の load が null
- [ ] 複数キー併存時の独立性
- [ ] テスト全通過

### 5.2 バックエンドテスト

#### 5.2.1 サービス層テスト(M3-03 §5.1.2)

`internal/service/combo/service_test.go` で **追加** されているか:

- [ ] List with no filter(既存全件取得回帰)
- [ ] List with character_id
- [ ] List with tag_ids(OR 条件)
- [ ] List with position / hit_type / opponent_stance
- [ ] List with is_draft=true / false
- [ ] List with combined filters(AND 動作)
- [ ] List with sort=damage order=desc / asc
- [ ] List with sort=default(複合ソート)
- [ ] List with invalid sort(default フォールバック)
- [ ] List with only_deleted=true(M2-03 回帰)
- [ ] 既存テストが温存されている(回帰なし)
- [ ] テスト全通過(`make test`)

#### 5.2.2 ハンドラ層テスト(M3-03 §5.1.3)

`internal/api/combo/handler_test.go` で追加されているか:

- [ ] 各クエリパラメータの正常系
- [ ] `tag_ids=1,2,3` のカンマ区切りパース
- [ ] `tag_ids=abc` の不正値 → 400 + INVALID_QUERY_PARAM
- [ ] 複数クエリパラメータの組合せ
- [ ] 既存テスト(`only_deleted` 等)の回帰

### 5.3 フロントエンドテスト(M3-03 §5.1.4)

- [ ] `ComboListFilters.test.tsx`:
  - 各フィルタ UI の onChange 発火
  - ソート種別変更で onChange 発火
  - 昇降ラベルが選択中ソートに応じて表示される
- [ ] `ColumnVisibilityMenu.test.tsx`:
  - 各列のチェックボックス切替で onChange 発火
  - リセットボタンで onReset 発火
- [ ] `useComboListFilters.test.ts`:
  - URL クエリパラメータからの復元が正しい
  - updateFilters で URL が更新される
  - 既定値はクエリに含まれない
- [ ] `useColumnVisibility.test.ts`:
  - 初期 mount 時に localStorage から復元
  - updateVisibility で localStorage に保存
  - resetVisibility で localStorage 削除
  - 古い構造の保存値が既定値とマージされる
- [ ] `pnpm test` 全通過
- [ ] `pnpm build` 成功
- [ ] TypeScript 型エラーなし

### 5.4 E2E シナリオ動作確認手順書(M3-03 §5.2)

- [ ] 製造担当が「動作確認手順書」を実装完了報告に含めているか
- [ ] §5.2 シナリオ A〜F が手順書に網羅されているか:
  - シナリオ A: フィルタ動作(8 ステップ、URL 連動・戻るボタン・URL シェア確認)
  - シナリオ B: ソート動作(3 ステップ)
  - シナリオ C: 表示列カスタマイズ(6 ステップ、リロード後復元・別タブ同期・リセット)
  - シナリオ D: 容量超過時の挙動(任意確認)
  - シナリオ E: 不正なクエリパラメータ
  - シナリオ F: 既存機能の回帰(M2-03 ゴミ箱、M3-02 タグ列)

開発者がブラウザで手動実行して全シナリオが通ることが M3-03 完了の前提条件。

---

## 6. 設計意図との整合(機械的チェックを超えた観点)

### 6.1 共通ヘルパの M6 / M7 再利用可能性(M3-03 §4.1.5)

- [ ] `browser-storage.ts` のインターフェースが汎用的(タグ・ソート・色などコンボ一覧固有の概念に依存しない)
- [ ] `createLocalStorageHelper<T>` がジェネリック型 T を取り、任意の構造を扱える
- [ ] M6 下書き自動保存(動的キー)・M7 仮想コントローラレイアウト(固定キー)の両ケースで再利用可能な設計か
- [ ] ヘルパに「コンボ一覧専用」の機能・依存が混入していないか

### 6.2 URL クエリパラメータ連動の意図(M3-03 §4.3.2)

- [ ] フィルタ・ソート状態がブラウザの戻る/進むボタンで遷移する
- [ ] URL を直接コピーして別タブで開いた場合、同じフィルタ状態で表示される
- [ ] 既定値はクエリに含まれず、URL が短く保たれる
- [ ] フィルタ・ソート状態が **localStorage に保存されていない**(URL とは別管理、設計判断 §4.5)

### 6.3 表示列カスタマイズと URL クエリの責務分離(M3-03 §4.5)

- [ ] 表示列カスタマイズは **localStorage** で管理(ユーザー嗜好、ブラウザごとに固定)
- [ ] フィルタ・ソートは **URL クエリ** で管理(セッション状態、URL シェア可能)
- [ ] 両者が混在していない(表示列カスタマイズが URL クエリに含まれない、フィルタが localStorage に保存されない)

### 6.4 タグフィルタの OR 条件(M3-03 §4.5)

- [ ] 複数タグ指定時、**指定タグのいずれかを持つコンボ** が返される(OR 条件)
- [ ] AND 条件(全タグを持つコンボ)を実装していない(将来 CHANGE で対応の方針、§4.5 確定)
- [ ] テスト(§5.2.1)で OR 動作の確認ケースがある

### 6.5 playbook §4.5 フローの素直さ原則の遵守

- [ ] フィルタ条件の **事前検証(キャラ存在チェック等)が実装されていない**(指示書 §4.2.6)
- [ ] 不正値(存在しないキャラ ID 等)は空配列を返すのみ(エラーにしない)
- [ ] エラー駆動の再試行フローを書いていない
- [ ] 「副次効果として〜される」「自動的に〜される」という表現が指示書本文・実装コード・PR 説明に紛れていない

### 6.6 playbook §4.6 UI ライブラリ実態確認原則の遵守

- [ ] **shadcn/ui を使用していない**(`grep -rn '@/components/ui\|shadcn' web/src/features/combo/` で検出されない)
- [ ] `<select>` / `<input type="checkbox">` / `<button>` 等の標準 HTML が使われている
- [ ] Tailwind クラスでスタイリング
- [ ] M2-02 `DuplicateRealtimeWarning.tsx` のパターン(外側クリック検知)を再利用、または同等の実装

### 6.7 playbook §4.7 全ハンドラ列挙原則の遵守(M3-03 §9.5)

- [ ] 新エラー型 `INVALID_QUERY_PARAM` の発火経路が **List ハンドラのみ** に限定されている
- [ ] `grep -rn 'INVALID_QUERY_PARAM' internal/` で List ハンドラ以外の発火経路がないことを確認
- [ ] 他のクエリパラメータを持つハンドラ(M2-03 only_deleted 等)で同種のエラーが発生していないことを確認

### 6.8 列挙定数同期ルールの遵守(CLAUDE.md §4 / SUPP-001 §6.4)

- [ ] バックエンドの状況コード値定数(`PositionAny / Center / Corner` 等)とフロントの定数(`POSITION_VALUES` 等)が **完全一致** している
- [ ] フロントエンドのコンポーネント・フックで `mycombo_status` などのリテラル文字列が直接書かれていない、定数経由
- [ ] `grep -rn '"corner"\|"center"\|"counter"\|"punish_counter"' web/src/features/combo/` で検出される使用がすべて定数定義箇所のみ

---

## 7. コード品質・規約遵守

### 7.1 Go 規約(CLAUDE.md §4)

- [ ] エラーが `fmt.Errorf("...: %w", err)` で wrap されている
- [ ] サービス層メソッドの第一引数が `context.Context`
- [ ] 公開 API(大文字始まり)に godoc コメントが付いている
- [ ] パッケージ名が短く小文字、型名が PascalCase、関数が CamelCase
- [ ] **JSON タグが camelCase で統一**(本マイルストーンでは新規 DTO はないため、URL クエリパラメータ名は snake_case で正)
- [ ] **列挙的文字列定数がパッケージ定数として定義** されている(CLAUDE.md §4 / SUPP-001 §6.4)

### 7.2 TypeScript 規約(CLAUDE.md §4)

- [ ] `strict` モードで型エラーなし
- [ ] `any` が原則使われていない
- [ ] 関数コンポーネント + Hooks のみ
- [ ] コンポーネントが PascalCase、フックが `useXxx`、定数が SCREAMING_SNAKE_CASE
- [ ] import 順が React → サードパーティ → エイリアスパス → 相対パス
- [ ] **API DTO 型・列挙定数が camelCase で統一**(CLAUDE.md §4)
- [ ] **バックエンド列挙定数との同期** がされている(`web/src/constants/combo-list.ts` がバックエンド `internal/model/combo.go` と一致)

### 7.3 ブラウザストレージ使用範囲の確認(M3-03 で初の本格利用)

- [ ] §3 のチェック項目をすべて確認済み
- [ ] localStorage 使用が CLAUDE.md §10.X 許容範囲内のみ
- [ ] 共通ヘルパ経由のアクセスのみ
- [ ] キーバージョニング遵守

### 7.4 共通(CLAUDE.md §4)

- [ ] マジックナンバー・マジックストリングが定数化されている(状況コード値、ソート種別、キー名等)
- [ ] TODO コメントが `// TODO(<対応予定>): <内容>` 形式
- [ ] 不要なコメントアウトコードが削除されている
- [ ] `console.log` / `fmt.Println` が本番コードに残っていない(`browser-storage.ts` の `console.warn` は意図的な実装、許容)

---

## 8. 既存挙動の温存(過去マイルストーンへの非破壊性)

### 8.1 既存 API への影響

- [ ] `GET /api/combos` のレスポンス DTO 構造が変更されていない(`tags` フィールド等は M3-02 で追加済みのまま)
- [ ] `GET /api/combos?only_deleted=true` が従来通り動作(M2-03 回帰)
- [ ] `GET /api/combos/:id` 詳細 API が動作を変えていない
- [ ] `POST/PATCH/PUT /api/combos` 系が動作を変えていない
- [ ] M3-01 のタグ CRUD API、M3-02 のタグ付与系拡張が動作を変えていない

### 8.2 既存フロント画面への影響

- [ ] M1-05 のコンボ一覧画面の基本表示が温存されている(フィルタ・ソート・表示列カスタマイズの追加機能のみ)
- [ ] M2-03 のゴミ箱画面が動作を変えていない(`only_deleted=true` クエリの内部利用)
- [ ] M3-02 のコンボ一覧タグ列が引き続き実データ表示
- [ ] M1-06 / M2-02 のコンボ編集画面が動作を変えていない
- [ ] M3-01 のタグ管理画面が動作を変えていない

### 8.3 マイグレーションへの影響

- [ ] マイグレーションが追加されていない(本マイルストーンは DB 変更なし)
- [ ] 既存マイグレーション 000001〜000007 が変更されていない

### 8.4 楽観的排他制御への影響

- [ ] M2-02 で確立した楽観的排他制御(combos.version の PATCH チェック)が引き続き動作している
- [ ] M3-02 で実装したタグ更新のトランザクション整合性が維持されている

---

## 9. ドキュメント・進捗ログ

### 9.1 progress-log.md への記録(M3-03 §7.4)

- [ ] `docs/progress/progress-log.md` に M3-03 完了報告が追記されている
- [ ] 記録テンプレート(SUPP-001 §6.7)に従っている
- [ ] **共通ヘルパ `browser-storage.ts` の新設事実、M6 / M7 で再利用される共有資産であることが明記** されている
- [ ] §3.4 着手前確認結果を含めている
- [ ] §4.3.3 着手前確認(状況コード値の DISTINCT 取得結果)を含めている
- [ ] 製造担当が新たに発見した制限事項・既知問題が記録されているか(発見ゼロの場合はその旨を明記)

### 9.2 設計担当への連絡事項

- [ ] 製造担当が M3-01 / M3-02 完了時のように設計担当へ連絡したい改善点が報告書に明記されているか(連絡事項ゼロの場合はその旨を明記)

---

## 10. 重大な問題の判定基準

以下のいずれかに該当する場合、**重大な問題** として M3-03 完了承認を妨げる:

- 設計書本体(DES-002 §4.2、DES-003 §3.4 §4、DES-005 §5.4、DES-006)と実装が乖離している
- **localStorage が CLAUDE.md §10.X 許容範囲外で使用されている**(`combo-list-columns-v1` 以外のキーが本マイルストーンで導入されている、または許容3用途以外に使われている)
- **localStorage に直接アクセス**(`localStorage.setItem` / `getItem` 等)が本指示書で新設した `browser-storage.ts` 以外で行われている
- **キーバージョニング(`-v1` suffix)が遵守されていない**
- **共通ヘルパの try-catch・容量超過処理が実装されていない**(プライベートブラウジングや容量超過でアプリが落ちる)
- **SQL injection 対策の不備**(プレースホルダ未使用、ホワイトリスト未実装、ホワイトリスト外の値が SQL に直接埋め込まれる)
- **`fmt.Sprintf` や文字列結合でユーザー入力を SQL に埋め込んでいる**
- ソート種別ホワイトリストが未実装または不完全(6 種ソートのいずれかが欠落)
- **状況コード値定数のバックエンド・フロント不一致**(typo・表記揺れ・片方だけ存在 等)
- **状況コード値リテラル文字列がフロント/バックエンド側で散在**(`"corner"` 等が定数化されずに直接書かれている)
- E2E シナリオ A〜F のうち1つでも通らない
- 既存挙動が壊れている(M1 / M2 / M3-01 / M3-02 で動作していた API・画面が動作しなくなった)
- バックエンド3層(リポジトリ / サービス / ハンドラ)のいずれかでフィルタ・ソート関連実装が欠落
- 共通ヘルパ単体テスト(§5.1.1)、サービス層テスト(§5.1.2)、フロント主要テスト(§5.1.4)のいずれかが欠落または失敗
- TypeScript / Go の型エラー、またはビルド失敗
- **playbook §4.5 / §4.6 / §4.7 のいずれかに違反**
- **JSON タグ / API DTO 型 / 列挙定数の camelCase 統一 + バックエンド・フロント同期** が崩れている
- **新規 API が追加されている**(M3-03 §2.4 で「既存パスのみ拡張、新規 API 追加なし」と明記)
- 表示列カスタマイズの localStorage 永続化が動作しない(リロード後に復元されない)
- URL クエリパラメータ連動が動作しない(戻るボタン・URL シェアが効かない)

---

## 11. 軽微な問題の判定基準

以下は **軽微な問題** として記録するが、M3-03 完了承認は妨げない(M4 以降への持ち越しを許容):

- godoc コメントの書き漏れ(主要公開関数以外)
- マジックストリングの定数化漏れ(機能動作に影響しないもの)
- フィルタ UI の見た目細部(プルダウン幅、配置、Tailwind クラス調整)
- ColumnVisibilityMenu のポップオーバー位置の微調整
- 昇降ラベルの色・アイコン装飾
- localStorage 容量超過時の console.warn メッセージ文言
- リポジトリ層テストの単純クエリ部分のテスト追加
- スマホ対応のボトムシート表示(M7 仕上げ予定、M3-03 では基本のレスポンシブのみで可)
- TODO コメントの形式逸脱

これらは進捗ログに「軽微な持ち越し課題」として記録し、後続マイルストーンで対応判断する。

---

## 12. 質問・確認事項のフォーマット

レビュー中に判断不能・設計担当 Claude または開発者の確認が必要な事項が発生した場合、以下のフォーマットで記録する:

```
### Q-{連番}: {タイトル}

**観点**: §{節番号}
**対象ファイル**: {ファイルパス}:{行番号}
**現状**: (実装または指示書の記述)
**疑問点**: (なぜ判断不能か)
**自分の見立て**: (案 X か案 Y か等、レビュー担当の暫定判断)
**確認したい相手**: 設計担当 Claude / 開発者
```

レビュー報告書の「質問・確認事項」節にまとめて記載する。

---

## 13. レビュー完了の判定

以下を全て満たした時点でレビュー完了とする:

- [ ] §1〜§9 の各チェック項目を全て確認した
- [ ] §10 重大な問題が0件、または製造担当に修正依頼を出した
- [ ] §11 軽微な問題は記録済み
- [ ] §12 質問・確認事項は設計担当 Claude / 開発者に転送する形でまとめた
- [ ] §0.3 のレポートフォーマットに従ってレビュー結果を作成した

レビュー判定:

- **承認**: 重大な問題なし、軽微な問題は許容、製造担当の実装が指示書通り完了している
- **修正依頼**: 重大な問題あり、製造担当に修正を依頼する(修正後に再レビュー)
- **保留**: 質問・確認事項に対する設計担当 Claude / 開発者の回答待ち

レビュー完了後、開発者に結果を報告する。

---

*以上*

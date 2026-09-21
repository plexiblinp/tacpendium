# M3-04 レビューチェックリスト

| 項目 | 内容 |
|------|------|
| チェックリストID | M3-04-REVIEW |
| バージョン | 1.0.3 |
| 対象指示書 | `docs/instructions/M3-04-mycombo-page-and-use-characters.md` v1.0.4 |
| 対象マイルストーン | M3-04: useCharacters フック化 + マイコンボ画面追加(別画面方式) |
| 推奨レビューモデル | **Sonnet 4.6**(model-allocation.md v1.2.0 準拠) |
| 作成者 | 詳細設計・製造準備担当Claude(M3 期間担当) |
| 作成日 | 2026-05-10 |
| 更新日 | 2026-05-10 |

## 更新履歴

| バージョン | 更新日 | 更新内容 |
|-----------|--------|----------|
| 1.0.0 | 2026-05-10 | 初版作成 |
| 1.0.1 | 2026-05-10 | 対象指示書 v1.0.0 → v1.0.1 追従。character API ハンドラ新規実装のスコープ拡張を反映: (1) §1 に §1.0「character API ハンドラの実装確認」を新設(3 層実装・JSON タグ camelCase・ルート登録・`{"items": [...]}` レスポンス形式の確認項目)。(2) §2.2 バックエンド変更ゼロの確認を「character API 追加のみ許容、その他変更なし」に修正。(3) §2.3 動作確認に character API の curl コマンド3種を追加。(4) §4 テストに §4.0「character API バックエンドテスト(3 層別)」を新設。(5) §9 重大判定の「新規 API 追加禁止」を「character API ハンドラ追加を許容、その他は禁止」に修正。(6) §1.3〜§1.7 等の内部参照番号(§3.4.x)を新指示書の節構成に整合修正 |
| 1.0.2 | 2026-05-10 | 対象指示書 v1.0.1 → v1.0.3 追従。マイコンボステータス変更 UI の新規実装スコープ拡張を反映: (1) §1 に §1.15「マイコンボステータス変更 UI の実装確認」を新設(`MyComboStatusSelector` コンポーネント・`useUpdateMyComboStatus` フック・PATCH 動作・キャッシュ無効化の確認項目)。(2) §2 既存 API 温存確認に「M3-02 の `PATCH /api/combos/:id` が変更されていない(ステータス変更経由でも既存ハンドラに到達)」を追加。(3) §4 テストに §4.1-A「useUpdateMyComboStatus フックのテスト」と §4.2 MyComboStatusSelector テストを追加。(4) §5 設計意図整合に「ステータス変更 UI の責務分離(M3-02 コンボ編集除外と整合)」を追加。(5) §9 重大判定に「マイコンボステータス変更 UI 欠落」「楽観的排他制御の version 同時送信欠落」を追加。M3-04 指示書 v1.0.3 §4.9 / §5.2 シナリオ H / §4.10 設計判断事項表に対応 |
| 1.0.3 | 2026-05-10 | 対象指示書 v1.0.3 → v1.0.4 追従。マイコンボへの初回登録経路を 3 経路で実装する案 Z のスコープ拡張を反映: (1) §1.15 を「MyComboStatusSelector 3 経路共通利用 + モード切替 props」に拡張、§1.16「コンボ編集画面のステータス付与 UI 確認」と §1.17「コンボ一覧画面のステータス列確認」を新設。(2) §4 テストに `MyComboStatusSelector` モード別テスト + `ComboEditorBasicFields.test.tsx` + `ComboTableRow.test.tsx` の確認項目を追加。(3) §4.5 E2E シナリオに I/J/K/L(初回登録経路 2 種・ステータス変更経路 2 種・三者間状態同期)を追加。(4) §5.8 責務分離確認に「編集画面 TagSelector・一覧画面 TagBadgeList の `mycombo_status` 除外維持」を追加。(5) §9 重大判定に「初回登録経路の欠落」「3 経路間状態同期破壊」「TagSelector / TagBadgeList の責務分離破壊」「`MyComboStatusSelector` のモード混同(immediate と deferred の取り違え)」を追加。M3-04 指示書 v1.0.4 §4.10 / §4.11 / §5.2 シナリオ I-L / §4.12 設計判断事項表に対応 |

---

## 0. レビュー担当への前置き

### 0.1 レビュー前の準備

レビュー開始前に以下を必ず読む:

1. `CLAUDE.md`(全体方針、特に **§4 JSON タグ camelCase / 列挙定数同期ルール**、§10 禁止事項)
2. `docs/instructions/M3-04-mycombo-page-and-use-characters.md` v1.0.0(本チェックリストの対象指示書)
3. `docs/instructions/M3-overview.md` v1.0.2(**§3.4 M3-04 詳細(別画面方式)**)
4. `docs/instructions/M3-01-tag-feature-and-management.md` / `M3-02-tag-assignment-ui.md` / `M3-03-filter-sort-column-customize.md` v1.0.2
5. `docs/instructions/M2-02-edit-ux-improvements.md`(`CHARACTER_NAMES` 導入経緯)
6. `docs/design/05-screen-design.md`:
   - **§3 画面遷移図(L56)**
   - **§4.2.1 主要ナビゲーション(L99)**
   - **§5.5 マイコンボ(L238-251)**
7. `docs/design/02-architecture.md` §4.2 主要エンドポイント(L133 `GET /api/games/{id}/characters`)
8. `docs/design/supp-001-detailed-design.md` v1.9.0 §5.4 / §5.5 / **§6.4 列挙定数同期ルール**
9. `docs/handover/design-instruction-playbook.md` v1.4.0 **§4.5 / §4.6 / §4.7**
10. 製造担当の実装完了報告書

### 0.2 レビューの基本姿勢

- **設計書本体との行レベル照合を最優先**(playbook §5、retro R-01)
- **DES-005 §5.5(L238-251)のマイコンボ画面表示項目が全て実装されているか厳格にチェック**
- **MyComboStatus 列挙定数のバックエンド・フロント同期 + リテラル文字列散在の検出**(CLAUDE.md §4 / SUPP-001 §6.4)
- **CHARACTER_NAMES 定数の全参照差し替えと完全削除の確認**
- **playbook §4.6 UI ライブラリ実態確認原則の遵守**(shadcn/ui 不使用)
- **API パスの正確性確認**(`/api/games/{id}/characters` であって `/api/characters` ではない)
- **上振れ要素3項目(件数ダッシュボード・カウントバッジ・キャラ切替プルダウン)の実装確認**
- 機械的チェックに加え、設計意図との整合を読み取る(playbook §9.3)
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

## 1. 設計書本体との照合(retro R-01、最重要観点)

### 1.0 character API ハンドラの新規実装(M3-04 §4.0、v1.0.1 で追加スコープ)

実装ファイル: `internal/api/character/handler.go` / `internal/service/character/service.go` / `internal/repository/character/repository.go` / `internal/model/character.go`(または相当)

#### 1.0.1 3 層実装の存在確認

- [ ] `internal/api/character/handler.go` が新規作成されている
- [ ] `internal/service/character/service.go` が新規作成されている
- [ ] `internal/repository/character/repository.go` が新規作成されている
- [ ] `internal/model/character.go`(または既存 model パッケージ内)に `Character` 構造体が定義されている
- [ ] それぞれにテストファイル(`_test.go`)が存在(リポジトリ層は複雑クエリのみ、SUPP-001 §5.4)

#### 1.0.2 M1-03 コンボ系3層パターンの踏襲

- [ ] handler / service / repository の責務分離が M1-03 コンボ系の構造と整合
- [ ] サービス層の第一引数が `context.Context`(CLAUDE.md §4 Go 規約)
- [ ] エラーが `fmt.Errorf("...: %w", err)` で wrap されている
- [ ] 公開関数(`List` 等)に godoc コメントが付いている

#### 1.0.3 Character モデルの JSON タグ camelCase(CLAUDE.md §4)

- [ ] `Character.ID` の JSON タグが `"id"`
- [ ] `Character.GameID` の JSON タグが `"gameId"`(camelCase)
- [ ] `Character.Name` の JSON タグが `"name"`
- [ ] DB タグは snake_case(`db:"game_id"` 等)で JSON タグと分離されている

#### 1.0.4 ルート登録(M3-04 §4.0.5)

- [ ] `cmd/combomgr/main.go`(または相当)に `e.GET("/api/games/:id/characters", characterHandler.List)` が登録されている
- [ ] 既存のコンボ・タグ系ハンドラ登録と同じパターンで書かれている

#### 1.0.5 レスポンス形式(M3-04 §4.0.4)

- [ ] レスポンスが `{"items": [...]}` ラッパー付き形式(progress-log.md M2-01 完了報告 L41、`/api/combos` と整合)
- [ ] 200 OK で正常な配列を返す
- [ ] game_id パースエラー時に 400 + `INVALID_GAME_ID` を返す(DES-002 §4.3 共通フォーマット準拠)
- [ ] 存在しない game_id でも 200 + 空配列(エラーにしない、playbook §4.5 フローの素直さ原則)

### 1.1 マイコンボ画面の独立画面化(DES-005 §5.5、M3-overview v1.0.2 §3.4)

- [ ] マイコンボ画面が独立ルート(`/mycombo`)で実装されている(タブ切替方式ではない)
- [ ] DES-005 §3 画面遷移図(L56)の `Home --> MyCombo` 想定と整合している
- [ ] DES-005 §4.2.1(L99)主要ナビゲーション3つ(コンボ一覧・マイコンボ・設定)が共通 Layout で実装されている

### 1.2 マイコンボ画面の必須表示項目(DES-005 §5.5 L242-245)

- [ ] **キャラクター情報バー**: キャラクターアイコン + 名前が目立つ形で表示されている
- [ ] **マイコンボステータス切替タブ**: 上部に3タブ(使用中・練習中・頻度低下)が表示されている
- [ ] **キャラクター切替プルダウン**: 複数キャラ利用者向けの基盤として実装されている(M3 はリュウのみで disabled)
- [ ] **ソート対象**: コンボ一覧と同様の6種(始動状況・更新日時・ダメージ・starter_move_id・drive_gauge_consumed_total・sa_gauge_consumed_total、DES-005 §5.5 L247)
- [ ] **アクション**: コンボ一覧と同様、加えてステータス切替タブでタグフィルタを一括適用(DES-005 §5.5 L249)
- [ ] **レスポンシブ**: コンボ一覧と同様、タブはスマホでスクロール可能な横並び(DES-005 §5.5 L251、本マイルストーンでは基本実装のみで M7 ボトムシート対応は除外)

### 1.3 useCharacters フック(M3-04 §4.1、DES-002 §4.2 L133)

実装ファイル: `web/src/features/character/hooks/useCharacters.ts`

- [ ] API パスが `/api/games/{id}/characters` で実装されている(**`/api/characters` ではない**)
- [ ] `DEFAULT_GAME_ID = 1`(SF6 の game_id)
- [ ] `useQuery` で queryKey `['characters', { gameId }]` を使っている
- [ ] `Character` 型に `id` / `name` フィールドがあり、camelCase で定義されている
- [ ] `useCharacterName(characterId)` ヘルパが実装されている
- [ ] `useCharacterName(null)` / `useCharacterName(存在しないid)` で空文字を返す

### 1.4 characterApi クライアント関数(M3-04 §4.1.3)

実装ファイル: `web/src/features/character/api/characterApi.ts`

- [ ] `characterApi.list(gameId)` が `/api/games/${gameId}/characters` を呼び出す
- [ ] レスポンス構造が `{items: [...]}` ラッパー付き形式(指示書 §4.0.4 で確定、§3.4.1 着手前確認の結果と整合)
- [ ] エラーハンドリングが存在(レスポンスが ok でない場合に throw する)

### 1.5 CHARACTER_NAMES 定数の全差し替え(M3-04 §4.1.4 / §4.1.5)

- [ ] **`grep -rn 'CHARACTER_NAMES' web/src/` で参照ゼロ**(製造担当が報告書で確認結果を含めているか確認)
- [ ] 差し替え前に存在した参照箇所(`DuplicateRealtimeWarning.tsx`、その他)が全て `useCharacterName` に置換されている
- [ ] `web/src/constants/character-names.ts`(または相当の定義箇所)が削除されている(または空のエクスポートになっている)
- [ ] 既存テスト(M2-02 の `DuplicateRealtimeWarning.test.tsx` 等)が差し替え後も通る

### 1.6 マイコンボ画面のルーティング(M3-04 §4.2.1)

実装ファイル: `web/src/App.tsx`(または相当)

- [ ] 新規ルート `/mycombo` が `App.tsx` のルート定義に追加されている
- [ ] `MyComboPageRoute` または相当のページコンポーネントがマウントされる

### 1.7 主要ナビゲーションへの「マイコンボ」リンク追加(M3-04 §2.2、DES-005 §4.2.1)

実装ファイル: `web/src/components/layouts/Layout.tsx`(または相当のヘッダ/サイドバー)

- [ ] 主要ナビゲーションに「マイコンボ」リンクが追加されている
- [ ] クリックで `/mycombo` に遷移する
- [ ] 他の主要ナビゲーション項目(コンボ一覧・タグ管理・ゴミ箱等)の配置が壊れていない

### 1.8 MyComboPage の構造(M3-04 §4.2.2 / §4.2.3)

実装ファイル: `web/src/features/mycombo/components/MyComboPage.tsx`

- [ ] `<CharacterInfoBar>` / `<MyComboStatusTabs>` / `<CharacterSelector>` の3コンポーネントを組み込んでいる
- [ ] コンボ一覧テーブルは M3-03 で実装した既存のテーブルコンポーネントを再利用している(または同等の責務分離)
- [ ] `useTagsForSelector` または `useMyComboStatusCounts` で `mycombo_status` カテゴリのタグを取得している
- [ ] 選択中タブのタグ ID で `useCombos` を呼んでフィルタ結果を取得している

### 1.9 URL クエリ設計(M3-04 §4.2.4)

- [ ] 選択中タブが URL クエリ `?status=in_use` 等で表現されている
- [ ] 未指定時は `in_use`(使用中)が既定
- [ ] URL クエリの値が `MYCOMBO_STATUS_VALUES`(`in_use` / `practicing` / `reduced`)で表現されている

### 1.10 CharacterInfoBar(上振れ要素1: 件数ダッシュボード)

実装ファイル: `web/src/features/mycombo/components/CharacterInfoBar.tsx`

- [ ] キャラクター名・アイコン(または簡易表現)が目立つ形で表示されている
- [ ] 件数ダッシュボード(使用中・練習中・頻度低下の件数)が表示されている
- [ ] Props が `characterId` + `statusCounts` で受け取る設計になっている
- [ ] 件数 0 時の表示分岐が実装されている(`(0)` 表示と案内文)
- [ ] **shadcn/ui 不使用、標準 HTML + Tailwind**(playbook §4.6)

### 1.11 MyComboStatusTabs(上振れ要素2: カウントバッジ)

実装ファイル: `web/src/features/mycombo/components/MyComboStatusTabs.tsx`

- [ ] 3つのタブ(使用中・練習中・頻度低下)が上部に横並び表示
- [ ] 選択中タブのハイライト動作
- [ ] **各タブに件数バッジ `(N)` 形式で表示**(0 件でも `(0)`)
- [ ] クリックで `onSelect` が発火、`MyComboStatus` 値が引数として渡される
- [ ] スマホでスクロール可能な横並び(基本的なレスポンシブ対応)
- [ ] **shadcn/ui 不使用、標準 HTML + Tailwind**

### 1.12 CharacterSelector(上振れ要素3: キャラ切替プルダウン基盤)

実装ファイル: `web/src/features/mycombo/components/CharacterSelector.tsx`

- [ ] 標準 HTML `<select>` で実装されている(playbook §4.6)
- [ ] `useCharacters` フックの結果をプルダウン選択肢として表示
- [ ] M3 リュウのみのため disabled 状態で「リュウ」と表示
- [ ] M7 拡張時に複数キャラ表示できる構造(配列ベースで選択肢を動的生成)
- [ ] `selectedCharacterId` / `onChange` の Props 設計

### 1.13 MyComboStatus 列挙定数のバックエンド・フロント同期(M3-04 §4.6、CLAUDE.md §4)

**バックエンド側**: `internal/model/tag.go`

- [ ] `MyComboStatusInUse = "in_use"` 等の Go 定数が定義されている
- [ ] `MyComboStatusTagNames` map がタグ名(日本語)とのマッピングを定義している

**フロントエンド側**: `web/src/constants/mycombo.ts`

- [ ] `MYCOMBO_STATUS_VALUES` 配列(`['in_use', 'practicing', 'reduced']` as const)
- [ ] `MyComboStatus` 型(`typeof MYCOMBO_STATUS_VALUES[number]`)
- [ ] `MYCOMBO_STATUS_LABELS` Record(表示用ラベル)
- [ ] `MYCOMBO_STATUS_TAG_NAMES` Record(タグ name とのマッピング)

**同期性**:

- [ ] バックエンド `MyComboStatusInUse = "in_use"` と フロント `MYCOMBO_STATUS_VALUES` の `'in_use'` が完全一致
- [ ] 全 3 値(in_use / practicing / reduced)で同期している
- [ ] タグ name(`使用中` / `練習中` / `頻度低下`)の文字列が両側で一致

### 1.14 useMyComboStatusCounts フック(M3-04 §4.7)

実装ファイル: `web/src/features/mycombo/hooks/useMyComboStatusCounts.ts`

- [ ] `GET /api/tags?include_usage=true&category=mycombo_status` を呼び出している
- [ ] queryKey が M3-01 の `useTagManagement` と分離されている(別カテゴリ・別パラメータ)
- [ ] 戻り値が `MyComboStatusCounts`(`inUse` / `practicing` / `reduced`)
- [ ] タグデータが見つからない場合 0 件を返す

### 1.15 マイコンボステータス変更 UI(M3-04 §4.9、v1.0.3 で追加スコープ)

#### 1.15.1 MyComboStatusSelector コンポーネント

実装ファイル: `web/src/features/mycombo/components/MyComboStatusSelector.tsx`

- [ ] **3 経路で共通利用** されている(マイコンボ画面 §1.15、コンボ編集画面 §1.16、コンボ一覧画面 §1.17 のすべてで同一コンポーネントが使われている)
- [ ] **shadcn/ui 不使用、標準 HTML `<select>`**(playbook §4.6)
- [ ] 4選択肢を提供している:
  - `使用中`(値 `in_use`)
  - `練習中`(値 `practicing`)
  - `頻度低下`(値 `reduced`)
  - `マイコンボから外す`(値 空文字 `""`)
- [ ] ラベル文字列が **`MYCOMBO_STATUS_LABELS` 定数経由** で表示されている(リテラル禁止)
- [ ] **`mode: 'immediate' | 'deferred'` props を受け取り、モード別に挙動が分岐している**(v1.0.3 で追加)
- [ ] **`mode='immediate'`(マイコンボ画面・コンボ一覧画面)**: `comboId` / `comboVersion` / `currentTags` が必須、選択変更で `useUpdateMyComboStatus` の mutation が発火
- [ ] **`mode='deferred'`(コンボ編集画面)**: `onChange` が必須、選択変更で `onChange` コールバックが発火、API 呼び出しは行われない
- [ ] `currentStatus` props が初期選択値として正しく表示される
- [ ] 初期選択値の判定は親側で行われ、当該コンボの `mycombo_status` カテゴリのタグから逆引きされる(複数付いている場合は最初の1つを採用)
- [ ] Props が指示書 §4.9.2 と一致(`currentStatus` / `mycomboStatusTags` / `mode` / 必須・任意プロパティの分岐含む)
- [ ] マイコンボ画面のコンボ一覧テーブル各行に配置されている(`mode='immediate'`)

#### 1.15.2 useUpdateMyComboStatus フック

実装ファイル: `web/src/features/mycombo/hooks/useUpdateMyComboStatus.ts`

- [ ] `useMutation` で実装されている
- [ ] 新ステータス指定時、現タグから `mycombo_status` カテゴリのタグを除外して新規ステータスのタグ ID を追加した `tagIds` 配列を構築している
- [ ] `TAG_CATEGORY_MYCOMBO_STATUS` 定数経由でカテゴリ判定している(リテラル禁止)
- [ ] 「マイコンボから外す」(空文字)指定時、`mycombo_status` カテゴリのタグを除外した tagIds で PATCH を呼ぶ
- [ ] `MYCOMBO_STATUS_TAG_NAMES` 定数経由でタグ name を解決している
- [ ] `PATCH /api/combos/:id` に `{ tagIds, version }` を送信(楽観的排他制御の version 同時送信)
- [ ] `onSuccess` で `queryClient.invalidateQueries({ queryKey: ['combos'] })` と `queryClient.invalidateQueries({ queryKey: ['tags'] })` が呼ばれている(件数ダッシュボード・カウントバッジ連動更新のため)
- [ ] レスポンスが ok でない場合に throw する

#### 1.15.3 PATCH 動作の検証

- [ ] ステータス変更プルダウン操作で `PATCH /api/combos/:id` が飛ぶ(Network タブで確認)
- [ ] バックエンドは M3-02 で実装済みの既存ハンドラに到達し、新規 API は追加されていない
- [ ] 楽観的排他制御の `version` フィールドが PATCH ペイロードに含まれる
- [ ] PATCH 成功後、コンボ一覧テーブルとマイコンボステータス切替タブの件数バッジ・件数ダッシュボードが連動更新される

#### 1.15.4 表示列カスタマイズ対象外の確認

- [ ] ステータス変更プルダウン列が `useColumnVisibility` の表示列カスタマイズ対象に **含まれていない**(マイコンボ画面でのみ常時表示する固定列、M3-04 §4.9.5)
- [ ] M3-03 で確定した `ColumnVisibility` 型の6フィールド(starterSituation / damage / recipe / tags / draftStatus / memo)に変更が加わっていない

#### 1.15.5 楽観的更新の見送り確認

- [ ] 楽観的更新(PATCH 完了前に UI 上の選択値を即座に反映)は **実装されていない**(M3-04 §4.9.4 で見送り確定)
- [ ] PATCH レスポンス受領後のキャッシュ無効化 → 再レンダリングの単純フローで動作する

### 1.16 コンボ編集画面へのマイコンボステータス付与 UI(M3-04 §4.10、v1.0.4 で追加スコープ、経路 1)

#### 1.16.1 配置とコンポーネント

実装ファイル: `web/src/features/combo/components/ComboEditorBasicFields.tsx`(または相当)

- [ ] コンボ編集画面に `<MyComboStatusSelector mode="deferred" ... />` が配置されている
- [ ] 配置位置が TagSelector の **直前** を推奨(製造担当のレイアウト判断で隣接位置の調整も許容、ただし TagSelector と離れすぎていないこと)
- [ ] ラベルが「マイコンボステータス」または同等の固定文言(製造担当判断、文言は微調整可)

#### 1.16.2 フォーム状態の拡張

- [ ] フォーム状態に `mycomboStatus: MyComboStatus | ''` フィールドが追加されている
- [ ] 新規登録時の初期値が空文字 `''`(未登録)
- [ ] 編集時の初期値が既存コンボの `tags` から `mycombo_status` カテゴリのタグを探して内部コード値に逆変換した値
- [ ] `mycombo_status` カテゴリのタグが付いていない既存コンボの編集時は初期値 `''`
- [ ] `MyComboStatusSelector` の `onChange` で `mycomboStatus` フィールドが更新される

#### 1.16.3 保存時の tagIds 構築ロジック

- [ ] 保存ボタン押下時(POST 新規登録 or PATCH 編集)に `tagIds` 配列が以下のロジックで構築される:
  - ベース: フォーム上の `selectedTagIds`(TagSelector の選択結果、通常タグ)
  - `mycomboStatus !== ''` なら `MYCOMBO_STATUS_TAG_NAMES[mycomboStatus]` でタグ name を引き、`mycomboStatusTags` から id を解決して追加
  - `mycomboStatus === ''` なら追加なし(= マイコンボから外す)
- [ ] 編集時、既存タグの `mycombo_status` カテゴリ以外のタグが保持される(TagSelector の選択結果がそのまま反映される)
- [ ] `MYCOMBO_STATUS_TAG_NAMES` / `TAG_CATEGORY_MYCOMBO_STATUS` 定数経由(リテラル禁止)

#### 1.16.4 既存 TagSelector の動作温存(M3-02 責務分離維持)

- [ ] `<TagSelector excludeCategories={[TAG_CATEGORY_MYCOMBO_STATUS]} />` の指定が変更されていない
- [ ] コンボ編集画面の TagSelector の選択肢に `mycombo_status` カテゴリのタグが出てこない
- [ ] 通常タグの選択は TagSelector のみ、マイコンボステータスの選択は `MyComboStatusSelector` のみで完結する 2 系統の入力 UI 構造になっている

#### 1.16.5 編集時の useEffect 同期

- [ ] 編集モードで既存コンボのデータがロードされた際、フォーム状態の `mycomboStatus` が既存タグから初期化される(`useEffect` で同期)
- [ ] 既存パターン(`useEffect(() => { if (combo) setForm(...) }, [combo])`)を拡張する形で実装されている

### 1.17 コンボ一覧画面へのマイコンボステータス列追加(M3-04 §4.11、v1.0.4 で追加スコープ、経路 2)

#### 1.17.1 配置とコンポーネント

実装ファイル: `web/src/features/combo/components/ComboTableRow.tsx`(または相当)

- [ ] コンボ一覧テーブルの各行に **マイコンボステータス列** が追加されている
- [ ] 配置位置がタグ列の直後・アクション列の直前を推奨(製造担当判断で他の位置も許容)
- [ ] 各行に `<MyComboStatusSelector mode="immediate" comboId={...} comboVersion={...} currentTags={...} ... />` が配置されている
- [ ] `currentStatus` props が当該コンボの `tags` から正しく逆引きされる(複数付いている場合は最初の1つ、`MYCOMBO_STATUS_TAG_NAMES` 逆引きヘルパが使われる)

#### 1.17.2 表示列カスタマイズ対象外の確認

- [ ] 本列が `useColumnVisibility` の表示列カスタマイズ対象に **含まれていない**(M3-04 §4.11.3、固定列)
- [ ] M3-03 で確定した `ColumnVisibility` 型の6フィールド(starterSituation / damage / recipe / tags / draftStatus / memo)に変更が加わっていない
- [ ] `combo-list-columns-v1` localStorage キーの値に本列のキーが含まれていない

#### 1.17.3 選択肢の表示

- [ ] プルダウンに「マイコンボから外す」を含む 4 選択肢が表示される(マイコンボ画面と同じ)
- [ ] マイコンボに登録されていないコンボでも、「マイコンボから外す」または「未登録」を初期選択値として表示される

#### 1.17.4 「マイコンボから外す」のラベル調整(任意確認)

- [ ] 「マイコンボから外す」の選択中状態のラベル処理が製造担当判断で確定されている(マイコンボ画面と同じ文言が推奨、文言差異は §10 軽微の範囲で許容)

#### 1.17.5 TagBadgeList の責務分離維持(M3-02 確定方針)

- [ ] コンボ一覧画面の通常タグ列(`TagBadgeList`)に `excludeCategories={[TAG_CATEGORY_MYCOMBO_STATUS]}` が指定されたままで、`mycombo_status` カテゴリのタグが表示されていない
- [ ] マイコンボステータスは新規追加の専用列(`MyComboStatusSelector`)経由でのみ表示・操作される

---

## 2. API 整合性

### 2.1 既存 API の温存確認

- [ ] `GET /api/combos?tag_ids=...`(M3-03 で実装済み)が変更されていない
- [ ] `GET /api/tags?include_usage=true&category=mycombo_status`(M3-01 で実装済み)が変更されていない
- [ ] **`PATCH /api/combos/:id`(M3-02 で実装済み)が変更されていない**(ステータス変更 UI 経由のリクエストも既存ハンドラに到達、新規 API 追加なし、v1.0.2 で追加確認項目)
- [ ] その他既存 API(コンボ CRUD・タグ CRUD・ゴミ箱系等)のシグネチャが変更されていない

### 2.2 バックエンド変更スコープの確認(M3-04 §2.4、v1.0.1 で character API 追加)

許容される追加:

- [ ] `internal/api/character/` 配下に新規 handler.go が追加されている(本マイルストーンの正式スコープ)
- [ ] `internal/service/character/` 配下に新規 service.go が追加されている
- [ ] `internal/repository/character/` 配下に新規 repository.go が追加されている
- [ ] `internal/model/character.go`(または既存 model 内)に Character モデルが追加されている
- [ ] `cmd/combomgr/main.go`(または相当)にルート登録のみ追加
- [ ] `internal/model/tag.go`(または相当)に MyComboStatus 系の Go 定数が追加されている

許容されない変更:

- [ ] **上記以外のハンドラ・サービス・リポジトリに新規追加がない**(character 系・MyComboStatus 定数以外)
- [ ] マイグレーション 000001〜000007 が変更されていない、新規マイグレーション追加なし
- [ ] characters テーブル DDL が変更されていない(M1-02 で整備済みのまま)

### 2.3 各 API 動作確認(製造担当の curl 結果)

character API(新規実装):

- [ ] `curl http://localhost:47318/api/games/1/characters` → 200 + `{"items": [リュウを含むキャラ一覧]}`
- [ ] `curl http://localhost:47318/api/games/abc/characters` → 400 + `INVALID_GAME_ID`(game_id パース失敗)
- [ ] `curl http://localhost:47318/api/games/999/characters` → 200 + `{"items": []}`(存在しない game_id、空配列、エラーにしない)

既存 API(回帰):

- [ ] `curl 'http://localhost:47318/api/tags?include_usage=true&category=mycombo_status'` → 200、3 タグ + usage_count
- [ ] `curl 'http://localhost:47318/api/combos?tag_ids=<使用中タグID>'` → 200、該当タグを持つコンボ
- [ ] **`curl -X PATCH http://localhost:47318/api/combos/<id> -H 'Content-Type: application/json' -d '{"tagIds":[<使用中タグID>],"version":<現version>}'` → 200**(M3-02 で実装済みハンドラがマイコンボステータス変更経由でも動作することの確認、v1.0.2 で追加)

---

## 3. フロントエンドの動作仕様

### 3.1 リテラル文字列散在の検出(M3-04 §4.6.3、CLAUDE.md §4)

- [ ] `grep -rn '"in_use"\|"practicing"\|"reduced"' web/src/features/mycombo/ web/src/constants/mycombo.ts` で検出される箇所が **定数定義箇所のみ**
- [ ] `grep -rn '"使用中"\|"練習中"\|"頻度低下"' web/src/` で検出される箇所が定数定義箇所(`MYCOMBO_STATUS_TAG_NAMES` 等)とユーザー向け固定表示文(タイトル等)のみ
- [ ] マイコンボ画面のコンポーネント・フックで上記リテラルが直接書かれていない

### 3.2 useColumnVisibility の共用(M3-04 §4.4)

- [ ] マイコンボ画面で `useColumnVisibility` を呼んでおり、新規キーを導入していない
- [ ] localStorage キーが `combo-list-columns-v1`(M3-03 で確定)を共用している
- [ ] コンボ一覧画面とマイコンボ画面で列表示が同期する(片方で変更すると他方にも反映)

### 3.3 既存コンポーネントの非破壊性

- [ ] M2-02 の `DuplicateRealtimeWarning.tsx` が動作している(`useCharacterName` 差し替え後の回帰なし)
- [ ] M1-05 / M1-06 の `ComboEditor` 関連コンポーネントが動作している(CHARACTER_NAMES 参照の差し替え反映)
- [ ] M3-01 のタグ管理画面が動作している
- [ ] M3-02 のタグ付与 UI が動作している
- [ ] M3-03 のフィルタ・ソート・表示列カスタマイズが動作している

---

## 4. テストの妥当性

### 4.0 character API バックエンドテスト(M3-04 §5.1.0、v1.0.1 で追加)

**サービス層テスト**: `internal/service/character/service_test.go`

- [ ] `List` で game_id=1 でリュウを含むキャラクター配列が返るテスト
- [ ] `List` で存在しない game_id で空配列が返るテスト(エラーにしない)
- [ ] リポジトリ層エラー時にラップされたエラーが返るテスト

**リポジトリ層テスト**: `internal/repository/character/repository_test.go`

- [ ] `List` で game_id フィルタが効くテスト(複雑クエリ部分のみ、SUPP-001 §5.4)

**ハンドラ層テスト**: `internal/api/character/handler_test.go`

- [ ] `GET /api/games/1/characters` → 200 + `{"items": [...]}` 構造の確認テスト
- [ ] `GET /api/games/abc/characters` → 400 + `INVALID_GAME_ID` のテスト
- [ ] `GET /api/games/999/characters` → 200 + `{"items": []}`(空配列)のテスト

**全テスト通過確認**:

- [ ] `make test` または `go test ./...` で全 character 系テストが通過する
- [ ] 既存テスト(コンボ・タグ系等)に回帰がない

### 4.1 フックテスト(M3-04 §5.1.1 / §5.1.2 / §5.1.2-A)

- [ ] `useCharacters.test.ts`:
  - クエリキー検証
  - API レスポンス成功時のキャラクター配列返却
  - API レスポンス失敗時のエラーハンドリング
  - `useCharacterName(id)` で正しい名前が返る
  - `useCharacterName(null)` で空文字
  - `useCharacterName(存在しないid)` で空文字
- [ ] `useMyComboStatusCounts.test.ts`:
  - 3つのタグから件数を集計
  - タグデータが存在しない場合 0 件
  - 一部タグのみ存在する場合の動作
- [ ] **`useUpdateMyComboStatus.test.ts`(v1.0.2 で追加、M3-04 §5.1.2-A)**:
  - 新ステータス指定時、現タグから `mycombo_status` カテゴリを除外し新規ステータスのタグ ID を追加した tagIds で PATCH を呼ぶ
  - 「マイコンボから外す」(空文字)指定時、`mycombo_status` カテゴリを除外した tagIds で PATCH を呼ぶ
  - PATCH 成功時、`['combos']` と `['tags']` の queryKey で invalidateQueries が呼ばれる
  - API レスポンス失敗時のエラーハンドリング
  - 楽観的排他制御失敗(409)時のエラーハンドリング

### 4.2 コンポーネントテスト(M3-04 §5.1.3)

- [ ] `CharacterInfoBar.test.tsx`: キャラ名・件数ダッシュボードの表示、件数 0 時の表示分岐
- [ ] `MyComboStatusTabs.test.tsx`: タブ切替で onSelect 発火、選択中ハイライト、件数バッジ
- [ ] `CharacterSelector.test.tsx`: プルダウン表示、1キャラのみ時の disabled、onChange 発火
- [ ] **`MyComboStatusSelector.test.tsx`(v1.0.2 で追加、v1.0.3 でモード別テストに拡張)**:
  - 4選択肢(使用中・練習中・頻度低下・マイコンボから外す)が表示される
  - `currentStatus` props が初期選択値として正しく表示される
  - ラベル文字列が `MYCOMBO_STATUS_LABELS` 定数経由で取得されている(リテラルチェック)
  - **`mode='immediate'` のテスト**: 選択変更で `useUpdateMyComboStatus` の mutation が発火、`comboId` / `comboVersion` / `currentTags` 必須
  - **`mode='deferred'` のテスト**: 選択変更で `onChange` コールバックが発火、API 呼び出しはされない
- [ ] `MyComboPage.test.tsx`: 統合動作、URL クエリ反映、ステータス変更後のテーブル再レンダリング
- [ ] **`ComboEditorBasicFields.test.tsx` または同等(v1.0.3 で追加、M3-04 §4.10)**:
  - TagSelector の直前(または隣接位置)に `MyComboStatusSelector` が `mode='deferred'` でマウントされている
  - フォーム状態 `mycomboStatus` の初期値が、新規時は空文字、編集時は既存タグから判定される
  - 選択変更でフォーム状態 `mycomboStatus` が更新される
  - 保存時の tagIds ペイロード構築で、`mycomboStatus !== ''` ならマイコンボステータスタグ ID が含まれ、`mycomboStatus === ''` なら含まれない
  - 編集時、既存タグの `mycombo_status` カテゴリ以外は保持される
- [ ] **`ComboTableRow.test.tsx` または同等(v1.0.3 で追加、M3-04 §4.11)**:
  - 各行に `MyComboStatusSelector` が `mode='immediate'` でマウントされている
  - `currentStatus` props が当該コンボの `tags` から正しく逆引きされる
  - ステータス列が表示列カスタマイズ(`useColumnVisibility`)の対象に含まれない(非表示にできないことのテスト)

### 4.3 既存テスト回帰(M3-04 §5.1.4)

- [ ] `DuplicateRealtimeWarning.test.tsx` が `useCharacterName` 差し替え後も通る
- [ ] その他 `CHARACTER_NAMES` 参照箇所のテストすべて通る
- [ ] **M3-02 のタグ付与テスト(`PATCH /api/combos/:id` 関連)が、ステータス変更 UI 3 経路すべて経由の PATCH でも回帰しない**(既存ハンドラに到達する確認、v1.0.3 で 3 経路に拡張)
- [ ] **M3-02 で確定した「TagSelector / TagBadgeList が `mycombo_status` カテゴリを除外」する責務分離が v1.0.3 でも壊れていないことのテスト**(コンボ編集画面 TagSelector・コンボ一覧画面 TagBadgeList の両方)

### 4.4 ビルド・型チェック(M3-04 §5.1.5)

- [ ] `pnpm test` 全通過
- [ ] `pnpm build` 成功
- [ ] TypeScript 型エラーなし
- [ ] `grep -rn 'CHARACTER_NAMES' web/src/` で参照ゼロ

### 4.5 E2E シナリオ動作確認手順書(M3-04 §5.2)

- [ ] 製造担当が動作確認手順書を含めているか
- [ ] §5.2 シナリオ A〜L が網羅されているか:
  - A: マイコンボ画面への遷移(4 ステップ)
  - B: マイコンボステータス切替タブ(5 ステップ)
  - C: URL シェア・ブラウザ戻る(2 ステップ)
  - D: ソート・表示列カスタマイズ(3 ステップ)
  - E: 件数連動(1 ステップ)
  - F: 既存機能の回帰(3 ステップ)
  - G: 主要ナビゲーション(2 ステップ)
  - **H: マイコンボステータス変更 UI(8 ステップ、v1.0.2 で追加、事前準備手段の明記必須)**
  - **I: コンボ編集画面からの初回登録(7 ステップ、v1.0.3 で追加)**
  - **J: コンボ編集画面からのステータス変更(4 ステップ、v1.0.3 で追加)**
  - **K: コンボ一覧画面からのステータス変更(4 ステップ、v1.0.3 で追加)**
  - **L: コンボ一覧画面からの初回登録(4 ステップ、v1.0.3 で追加)**
  - **複数経路の整合性(2 ステップ、v1.0.3 で追加): 3 経路間状態同期 + M3-02 責務分離維持確認**

---

## 5. 設計意図との整合(機械的チェックを超えた観点)

### 5.1 別画面方式の整合性

- [ ] マイコンボ画面がコンボ一覧画面とは独立した画面として動作している(タブ切替ではない)
- [ ] DES-005 §5.5 が定める「主戦場画面」としての位置づけが反映されている(キャラクター情報バーが画面の主軸として配置)
- [ ] M3-overview v1.0.2 の方針(タブ切替方式からの回帰)が実装に反映されている

### 5.2 上振れ要素3項目の実装意図

- [ ] **件数ダッシュボード**: 単なるヘッダ装飾を超えて、ユーザーが「練習状況をひと目で把握」できる情報密度になっている
- [ ] **カウントバッジ**: タブ選択前から各ステータスの件数が見える(ユーザーが空のタブを選ぶ手間を削減)
- [ ] **キャラ切替プルダウン**: M7 で複数キャラを追加した時に、コードを大きく改修せずに対応可能な構造になっている(disabled だが配列ベースで実装)

### 5.3 内部コード値と DB タグ name の責務分離

- [ ] 内部コード値(`in_use` 等)が URL クエリとフロント・バックエンド内部識別子として使われている
- [ ] DB の tags テーブルには引き続き日本語の name(`使用中` 等)が格納されている
- [ ] 両者のマッピングが `MYCOMBO_STATUS_TAG_NAMES` 定数で明示的に行われている
- [ ] 「副次効果として〜される」「自動的に〜される」表現が実装・PR 説明に紛れていない

### 5.4 playbook §4.5 フローの素直さ原則

- [ ] 件数取得が M3-01 の既存 `usage_count` API を素直に使っている(独自エンドポイント新設なし)
- [ ] タグ ID 解決のフローが事前判定型(リテラル文字列直接指定ではなく、フックの結果から ID を引く)
- [ ] エラー駆動の再試行フローを書いていない

### 5.5 playbook §4.6 UI ライブラリ実態確認原則

- [ ] `grep -rn '@/components/ui\|shadcn' web/src/features/mycombo/ web/src/features/character/` で shadcn/ui が検出されない
- [ ] 標準 HTML(`<select>` / `<button>` / `<div>`)+ Tailwind で実装されている

### 5.6 playbook §4.7 全ハンドラ列挙原則

- [ ] 本マイルストーンでは新エラー型を導入していないため §4.7 は直接適用されない
- [ ] バックエンド変更が原則ゼロのため、ハンドラ列挙の必要なし

### 5.7 列挙定数同期ルール(CLAUDE.md §4 / SUPP-001 §6.4)

- [ ] §1.13 のチェック項目が全て満たされている
- [ ] フロント・バックエンド両側の定数が完全一致している
- [ ] リテラル文字列散在の検出結果(§3.1)が許容範囲内

### 5.8 マイコンボステータス変更 UI の責務分離(M3-04 §4.9 / §4.10 / §4.11、v1.0.2 で追加、v1.0.3 で 3 経路化)

- [ ] **M3-02 で確定した責務分離が維持されている**:
  - コンボ編集画面の `TagSelector`(通常タグ選択 UI)では `mycombo_status` カテゴリを除外(`excludeCategories={[TAG_CATEGORY_MYCOMBO_STATUS]}`)
  - コンボ一覧画面の `TagBadgeList`(通常タグ表示列)でも `mycombo_status` カテゴリを除外
- [ ] **マイコンボステータスタグの付与・表示は 3 経路すべてで専用 UI(`MyComboStatusSelector`)経由でのみ行われる**:
  - 経路 1: コンボ編集画面 TagSelector 直前(`mode='deferred'`)
  - 経路 2: コンボ一覧画面の専用列(`mode='immediate'`)
  - 経路 3: マイコンボ画面の各行(`mode='immediate'`)
- [ ] **TagSelector / TagBadgeList と `MyComboStatusSelector` の 2 系統の入力 UI 構造** が両画面(編集・一覧)で維持されている(混在していない)
- [ ] 3 経路すべてで同じコンポーネント `MyComboStatusSelector` が使われており、コンポーネント分散が起きていない
- [ ] DES-005 §5.4 / §5.5 / §5.6 アクション解釈の範囲内で実装されている
- [ ] **3 経路間の状態同期**: 任意のコンボに対し、いずれか 1 つの経路でステータスを変更すると、他の 2 経路のプルダウンを見たとき同じステータスが選択中で表示される(E2E シナリオの「複数経路の整合性」で確認済み)

---

## 6. コード品質・規約遵守

### 6.1 Go 規約(CLAUDE.md §4)

- [ ] 新規定数 `MyComboStatusXxx` の命名が PascalCase
- [ ] godoc コメントが付いている
- [ ] **列挙的文字列定数がパッケージ定数として定義** されている(CLAUDE.md §4)

### 6.2 TypeScript 規約(CLAUDE.md §4)

- [ ] `strict` モードで型エラーなし
- [ ] `any` が原則使われていない
- [ ] 関数コンポーネント + Hooks のみ
- [ ] コンポーネントが PascalCase、フックが `useXxx`、定数が SCREAMING_SNAKE_CASE
- [ ] **API DTO 型・列挙定数が camelCase で統一**
- [ ] **バックエンド列挙定数との同期**(`web/src/constants/mycombo.ts` がバックエンド `internal/model/tag.go` と一致)

### 6.3 共通(CLAUDE.md §4)

- [ ] マジックナンバー・マジックストリングが定数化されている
- [ ] TODO コメントが `// TODO(<対応予定>): <内容>` 形式
- [ ] 不要なコメントアウトコードが削除されている
- [ ] `console.log` が本番コードに残っていない
- [ ] **CHARACTER_NAMES 完全削除**(`grep -rn 'CHARACTER_NAMES' web/src/` でゼロ件)

---

## 7. 既存挙動の温存(過去マイルストーンへの非破壊性)

### 7.1 既存テーブル・API への影響

- [ ] tags / combos / combo_tags / users / characters / games テーブルの DDL が変更されていない
- [ ] 既存 API のレスポンス構造が変更されていない
- [ ] M3-01 タグ管理画面、M3-02 タグ付与 UI、M3-03 フィルタ・ソート・表示列カスタマイズが動作変更なし

### 7.2 既存フロント画面への影響

- [ ] M1-05 コンボ一覧、M1-06 コンボ編集、M1-07 コンボ詳細(または相当)が動作している
- [ ] M2-01 仮想コントローラ、M2-02 編集 UX、M2-03 ゴミ箱、M2-04 memo が動作している
- [ ] M3-01〜M3-03 が動作している

### 7.3 useColumnVisibility 共用の影響

- [ ] コンボ一覧画面で列表示を変更 → マイコンボ画面でも反映される(共用キー `combo-list-columns-v1`)
- [ ] マイコンボ画面で列表示を変更 → コンボ一覧画面でも反映される
- [ ] 共用が混乱を生まない(両画面で同じ列構成が好まれる前提、§4.4 の判断と整合)

### 7.4 マイグレーション

- [ ] マイグレーション追加なし(本マイルストーンは DB 変更なし)
- [ ] 既存マイグレーション 000001〜000007 が変更されていない

---

## 8. ドキュメント・進捗ログ

### 8.1 progress-log.md への記録(M3-04 §7.4)

- [ ] `docs/progress/progress-log.md` に M3-04 完了報告が追記されている
- [ ] **M2-02 持ち越し課題1(`CHARACTER_NAMES` → `useCharacters`)の解消事実** が明記
- [ ] 上振れ要素3項目の実装事実が明記
- [ ] §3.4 着手前確認結果が含まれている
- [ ] 新たに発見した制限事項・既知問題が記録されているか(発見ゼロの場合はその旨を明記)

### 8.2 設計担当への連絡事項

- [ ] 製造担当が設計担当へ連絡したい改善点が報告書に明記されているか(連絡事項ゼロの場合はその旨を明記)

---

## 9. 重大な問題の判定基準

以下のいずれかに該当する場合、**重大な問題** として M3-04 完了承認を妨げる:

- 設計書本体(DES-002 §4.2、DES-005 §3 / §4.2.1 / §5.5)と実装が乖離している
- **マイコンボ画面が独立画面として実装されていない**(タブ切替方式で実装されている等)
- **API パスが誤っている**(`/api/characters` を使っている、`/api/games/{id}/characters` でない)
- **MyComboStatus 列挙定数のバックエンド・フロント不一致**(typo・表記揺れ・片方だけ存在 等)
- **`in_use` / `practicing` / `reduced` のリテラル文字列がコンポーネント内で散在**(定数化されずに直接書かれている)
- **CHARACTER_NAMES 定数の参照が残っている**(`grep -rn 'CHARACTER_NAMES' web/src/` が非ゼロ)
- 上振れ要素3項目(件数ダッシュボード・カウントバッジ・キャラ切替プルダウン)のうち実装欠落がある
- 主要ナビゲーションに「マイコンボ」リンクが追加されていない
- E2E シナリオ A〜G のうち1つでも通らない
- 既存挙動が壊れている(M1 / M2 / M3-01 / M3-02 / M3-03 で動作していた API・画面が動作しなくなった)
- 既存テスト(M2-02 DuplicateRealtimeWarning 等)が回帰する
- TypeScript / Go の型エラー、またはビルド失敗
- **playbook §4.5 / §4.6 のいずれかに違反**
- **JSON タグ / API DTO 型 / 列挙定数の camelCase 統一 + バックエンド・フロント同期** が崩れている
- **shadcn/ui を使用している**(playbook §4.6 違反)
- **character API ハンドラ以外の新規 API が追加されている**(M3-04 §2.4 で「character API ハンドラ新規実装に限定」と明記、それ以外は禁止)
- **character API の 3 層実装が不完全**(handler / service / repository / model のいずれかが欠落、テスト欠落、ルート登録漏れ等)
- **character API ハンドラのレスポンス形式が `{"items": [...]}` ラッパー付きでない**(progress-log.md M2-01 完了報告 L41、`/api/combos` と整合する形式)
- **Character モデルの JSON タグが camelCase でない**(`game_id` 等のスネークケース混入)
- localStorage の追加キー導入(`combo-list-columns-v1` 以外、M3-04 では追加しない方針)
- **マイコンボステータス変更 UI(`MyComboStatusSelector` + `useUpdateMyComboStatus`)が欠落している、または動作しない**(v1.0.2 で追加。マイコンボ画面の主要操作経路のため必須)
- **`useUpdateMyComboStatus` の PATCH ペイロードに `version` フィールドが含まれていない**(楽観的排他制御の規約違反、M2-02 で確立した既存パターンからの逸脱)
- **ステータス変更プルダウンのラベルがリテラル文字列で書かれている**(`MYCOMBO_STATUS_LABELS` 定数経由でない、CLAUDE.md §4 列挙定数同期違反)
- **ステータス変更後にコンボ一覧・件数ダッシュボード・カウントバッジが更新されない**(`invalidateQueries` の対象 queryKey 漏れ)
- **コンボ編集画面の TagSelector で `mycombo_status` カテゴリが選択肢に出る**(M3-02 で確定した責務分離が M3-04 で壊れている、§5.8 違反)
- **コンボ一覧画面の通常タグ列(`TagBadgeList`)に `mycombo_status` タグが表示される**(M3-02 責務分離違反、v1.0.3 で確認項目追加)
- **初回登録経路の欠落(v1.0.3 で追加)**: コンボ編集画面または コンボ一覧画面のいずれにも初回登録 UI(`MyComboStatusSelector mode='deferred'` or `mode='immediate'`)が存在しない、または動作しない
- **3 経路間の状態同期破壊(v1.0.3 で追加)**: ある経路でステータスを変更しても、他経路のプルダウンに反映されない(キャッシュ無効化漏れ・コンポーネント状態管理ミス等)
- **`MyComboStatusSelector` のモード混同(v1.0.3 で追加)**: 編集画面で `mode='immediate'` を渡してしまい誤って即時 PATCH が走る、あるいは一覧画面で `mode='deferred'` を渡してしまい操作が反映されない等の取り違え
- **コンポーネント分散(v1.0.3 で追加)**: `MyComboStatusSelector` を 3 経路で共通利用せず、編集画面用・一覧画面用に別コンポーネントを新設してしまっている(本指示書では共通化が確定方針、§4.10 設計判断事項表)

---

## 10. 軽微な問題の判定基準

以下は **軽微な問題** として記録するが、M3-04 完了承認は妨げない:

- godoc コメントの書き漏れ(主要公開関数以外)
- マジックストリングの定数化漏れ(機能動作に影響しないもの)
- キャラクター情報バーの見た目細部(アイコン色・サイズ・配置)
- マイコンボステータス切替タブのデザイン細部
- キャラクター切替プルダウンの disabled 表示スタイル
- レスポンシブ対応の breakpoints 調整
- フックのテストカバレッジの軽微な抜け
- M7 ボトムシート対応の未実装(本マイルストーンの除外項目、軽微の範疇でもない、対応不要)
- TODO コメントの形式逸脱

これらは進捗ログに「軽微な持ち越し課題」として記録し、後続マイルストーンで対応判断する。

---

## 11. 質問・確認事項のフォーマット

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

## 12. レビュー完了の判定

以下を全て満たした時点でレビュー完了とする:

- [ ] §1〜§8 の各チェック項目を全て確認した
- [ ] §9 重大な問題が0件、または製造担当に修正依頼を出した
- [ ] §10 軽微な問題は記録済み
- [ ] §11 質問・確認事項は設計担当 Claude / 開発者に転送する形でまとめた
- [ ] §0.3 のレポートフォーマットに従ってレビュー結果を作成した

レビュー判定:

- **承認**: 重大な問題なし、軽微な問題は許容、製造担当の実装が指示書通り完了している
- **修正依頼**: 重大な問題あり、製造担当に修正を依頼する(修正後に再レビュー)
- **保留**: 質問・確認事項に対する設計担当 Claude / 開発者の回答待ち

レビュー完了後、開発者に結果を報告する。

---

*以上*

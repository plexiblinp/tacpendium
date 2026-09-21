# 指示書 M3-02: コンボへのタグ付け UI(編集画面のタグ選択 + 一覧/詳細のタグ表示)

| 項目 | 内容 |
|------|------|
| 指示書ID | M3-02 |
| バージョン | 1.0.2 |
| 対象マイルストーン | M3(マイコンボ系) |
| 推奨モデル | **Sonnet 4.6** |
| Plan Mode | **任意**(Plan Mode で計画提示すると安全だが、必須ではない) |
| 機械レビュー | **必須**(別チェックリスト: `docs/instructions/reviews/M3-02-review-checklist.md`) |
| 並列性 | **単独**(M3 は完全直列、M3-01 完了が前提) |
| 依存指示書 | M3-01(タグ機能のバックエンド + 管理 UI、`useTagManagement` フック)、M1-06 / M2-02(コンボ編集画面の既存実装、`UpdateMetadataInput` の構造) |
| 想定所要時間 | 90〜120 分 |
| 作成者 | 詳細設計・製造準備担当Claude(M3 期間担当) |
| 作成日 | 2026-05-10 |
| 更新日 | 2026-05-10 |

## 更新履歴

| バージョン | 更新日 | 更新内容 |
|-----------|--------|----------|
| 1.0.0 | 2026-05-10 | 初版作成 |
| 1.0.1 | 2026-05-10 | M3-02 製造担当からの問い合わせ(shadcn/ui Popover + Command 未導入)に対応。§4.1.3 の TagSelector 内部実装方針を「shadcn/ui の Popover + Command 想定」から「**標準 HTML + Tailwind での自作**(M1-06 / M2-02 で確立した自作ラッパー方針を踏襲)」に変更。§4.1.4 の新規タグ作成失敗時のエラー表示も同様に自作実装に変更。§9.1 の shadcn/ui 関連の停止条件を削除し、外側クリック検知パターンの確認に置換。**設計担当の指示書執筆ミス**: 設計書本体(DES-001 §2、DES-002)で shadcn/ui 採用が明記されていることに依拠したが、playbook §17.2「shadcn/ui は M1 では未導入」の状態が M2 / M3-01 を通じて継続中だった事実を見落とした。M7 仕上げで shadcn/ui 統一導入されるまで標準 HTML 自作で運用する方針を本指示書に反映 |
| 1.0.2 | 2026-05-10 | **retrospective 記録のみ、本文は変更なし**。M3-02 製造・レビュー・取り込み完了後に、製造担当から連絡された以下3件の指示書欠陥を本書の歴史記録として残す。(1) **`UpdateWithKeyChange` ハンドラでのエラーハンドリング漏れ(Critical バグ)**: §4.3.4 で `ErrInvalidTagID` の発火経路を `Create` / `UpdateMetadata` の2つに限定して列挙したが、実態として存在する `UpdateWithKeyChange`(編集2方式分離の PUT 経由サービス関数)を見落とした。製造担当が指示書通り素直に実装した結果、`UpdateWithKeyChange` での該当エラー変換が漏れて Critical バグになった。playbook v1.4.0 §4.7「新エラー型導入時の全ハンドラ列挙原則」で再発防止。(2) **PATCH ペイロード「変更時のみ送信」方針の未明示**: §4.3.1 でバックエンド側の `*T` ポインタ3状態区別は明示したが、フロントエンド側の送信ポリシーを未明示。結果として `tagIds` 常時送信になり毎 PATCH で `combo_tags` の DELETE + INSERT が走る中優先度問題が発生。SUPP-001 v1.9.0 §5.9「PATCH 系省略可能フィールドの送信ポリシー」で再発防止。(3) **`mycombo_status` 文字列リテラルの散在**: §4.7 設計判断事項・§5.2 E2E シナリオ等で `mycombo_status` をリテラル参照したまま、フロントエンド側定数化の方針を未明示。バックエンドには `model.TagCategoryMyComboStatus` 定数があったが、フロント側に対応定数がなく散在状態。CLAUDE.md §4 / SUPP-001 v1.9.0 §6.4「バックエンド列挙定数とフロントエンド定数の同期ルール」で再発防止。**重要**: 本書の §4 / §5 本文は意図的に修正しない。製造担当・レビュー担当が見ていた v1.0.1 と乖離させずトレーサビリティを維持するため。詳細は m3-to-m4-handover.md(M3 完了時に作成予定)に記録 |

---

## 1. 背景と目的

### 1.1 背景

M3-01 でタグ管理機能(タグ自体の CRUD と管理画面)が完成した。本指示書では、その次のステップとして **コンボにタグを付ける** ための UI と、コンボ系画面でのタグ表示を整備する。

M1-05 完了時点でコンボ一覧のタグ列が「`-` 固定表示」となっており(progress-log.md M1-05 暫定処理2)、M3-01 完了時点でも未解消のままである。本指示書でこの暫定処理を解消する。

DES-005 §5.7「コンボ登録・編集画面」の表示項目11番に「タグ選択(既存タグから複数選択、新規作成も可能)」が明記されている。これがフロント側の中核要素となる。

### 1.2 目的

- コンボ登録・編集画面に **タグ選択 UI** を追加する(複数選択可、新規作成可、DES-005 §5.7 表示項目11)
- コンボ保存時に `combo_tags` 中間テーブルへの登録・更新ロジックを整備する(POST / PATCH 両方)
- コンボ一覧のタグ列を実データ表示に切り替える(M1-05 暫定処理2 の解消)
- コンボ詳細画面のタグ表示を実装する(DES-005 §5.6 で挙げられる表示項目)
- タグ別フィルタは含まない(M3-03 で実装、本指示書のスコープ外)

### 1.3 このマイルストーンで作らないもの

- タグ別フィルタ機能(コンボ一覧のフィルタ条件にタグを含める) — M3-03 で実装
- マイコンボタブ機能(タグ `mycombo_status` 系での絞り込み表示) — M3-04 で実装
- 表示列カスタマイズ(タグ列の表示/非表示切替) — M3-03 で実装
- タグ管理画面そのものの拡張(M3-01 で完成済み)
- セットプレイのタグ機能 — DES-003 にセットプレイ用タグの定義がない、M3 のスコープ外

---

## 2. 成果物

### 2.1 作成するファイル

```
web/src/
├── features/
│   └── tag/
│       ├── components/
│       │   ├── TagSelector.tsx                  # タグ複数選択 UI(コンボ編集画面で使う)
│       │   ├── TagSelector.test.tsx             # コンポーネントテスト
│       │   ├── TagBadgeList.tsx                 # タグバッジ群表示(一覧・詳細画面で使う)
│       │   └── TagBadgeList.test.tsx            # コンポーネントテスト
│       └── hooks/
│           └── useTagsForSelector.ts            # セレクタ用タグ取得フック(usage_count なし、軽量)
```

各ファイルの責務は §4 で詳述する。

### 2.2 修正するファイル

#### バックエンド

| ファイル | 修正内容 |
|---------|---------|
| `internal/model/combo.go`(または既存の DTO 定義場所) | `CreateComboInput` と `UpdateMetadataInput` に `TagIDs` フィールドを追加(§4.3.1)。M2-02 の `IsDraft *bool` 追加と同じパターン |
| `internal/service/combo/service.go` | `CreateCombo` と `UpdateMetadata` で受け取った `TagIDs` を元に、サービス層トランザクション内で `combo_tags` への INSERT / 既存削除を実施(§4.3.2) |
| `internal/api/combo/handler.go` | リクエストボディの `tagIds` を `Input.TagIDs` にマッピングする処理を追加(JSON タグだけで自動デコードされる、追加実装は不要だが動作確認は必要) |
| `internal/api/combo/handler_test.go` | `tagIds` を含むリクエストの正常系・異常系テストを追加(§5.1.3) |
| `internal/repository/combo/repository.go`(または `combo_tag` 補助関数の置き場所) | `combo_tags` 操作の補助関数(`ReplaceTagAssociations(tx, comboID, tagIDs) error` 等)を追加(§4.3.3) |
| `internal/repository/combo/repository.go` の List 系クエリ | コンボ一覧 API のレスポンス DTO に `tags` フィールドを含めるため、tags との別クエリ取得を追加(§4.4) |
| `internal/repository/combo/repository.go` の Get 系クエリ | コンボ詳細 API のレスポンス DTO に `tags` フィールドを含めるため、tags との JOIN を追加(§4.4) |

#### フロントエンド

| ファイル | 修正内容 |
|---------|---------|
| `web/src/features/combo/components/ComboEditor.tsx` | 既存のタグ選択箇所(プレースホルダーまたは未実装)に `TagSelector` を組み込む。`tagIds` state を追加し、保存時のリクエストボディに含める |
| `web/src/features/combo/api/comboApi.ts`(または同等の API client) | `CreateComboInput` / `UpdateMetadataInput` の TypeScript 型に `tagIds?: number[]` を追加 |
| `web/src/features/combo/hooks/*` の型定義 | TanStack Query の mutation 引数型を更新 |
| `web/src/features/combo/components/ComboTableRow.tsx`(または相当のコンボ一覧行コンポーネント) | タグ列を「`-` 固定表示」から `TagBadgeList` 経由の実データ表示に切り替える(M1-05 暫定処理2 解消) |
| `web/src/features/combo/components/ComboDetailPage.tsx`(または相当のコンボ詳細画面コンポーネント) | タグ表示部に `TagBadgeList` を組み込む(DES-005 §5.6 のタグ一覧項目) |
| `web/src/types/combo.ts`(または同等のコンボ DTO 型定義) | コンボ DTO に `tags?: Tag[]` フィールドを追加(API レスポンスにタグ配列が含まれるため) |

### 2.3 変更しないもの(原則)

- M3-01 で整備したタグ CRUD API(`/api/tags` 系)は変更しない
- M3-01 で整備した `tags` テーブル DDL、マイグレーション 000007 は変更しない
- `combo_tags` テーブル DDL(M1-02 で整備済み)は変更しない
- 楽観的排他制御(combos.version)の動作は変更しない。タグ更新もメタデータ編集の一部として、PATCH 経由のときは version チェックが通常通り効く
- presets / preset_aliases 系のテーブル・API・ロジック
- 既存のコンボ重複判定ロジック(VAL-C01 等)
- 既存のコンボ編集2方式分離(重複判定キー変更編集 vs メタデータ編集)の振り分けロジック

### 2.4 例外: バックエンドへの最小限の追加が許容される箇所

本指示書はフロント主体だが、コンボ保存系 API への `tagIds` フィールド追加 + 一覧/詳細レスポンスへの `tags` フィールド追加 という形でバックエンド側の拡張を含む:

- **`CreateComboInput` への `TagIDs []int64` 追加**: M2-02 の `IsDraft *bool` 追加と同等の最小拡張
- **`UpdateMetadataInput` への `TagIDs *[]int64` 追加**: ポインタ型でゼロ値("変更なし")と空配列("タグ全解除")を区別する(§4.3.1 で詳述)
- **コンボ保存系 API のサービス層拡張**: `combo_tags` への INSERT / 既存タグ関連削除をトランザクション内で実施
- **コンボ一覧/詳細レスポンス DTO への `tags []Tag` 追加**: M1-05 / M1-06 で実装済みの一覧/詳細 API のレスポンスに新フィールドを追加。M1-05 暫定処理2 を解消するため
- **リポジトリ層の補助関数追加**: `combo_tags` の置き換え操作、tags との JOIN

これらの拡張は M3-overview §3.2「例外条項」で予告済み。新規 API は追加しない(`/api/combos/*` の既存パスのみ拡張)。

実装中にこれら以外のバックエンド変更が必要と判断した場合、Plan Mode で停止して開発者に相談すること。

---

## 3. 前提条件

### 3.1 必読ドキュメント

- `CLAUDE.md`(全体方針、特に **§4「JSON タグは camelCase で統一」「API DTO 型は camelCase で統一」**、§10 禁止事項、§10.X ブラウザストレージ運用ルール)
- `docs/instructions/M3-overview.md`(M3 全体像、§3.2 M3-02 スコープ、§6 運用ルール、特に §6.6 レビューチェックリスト強化、§6.9「副次効果」表現禁止)
- `docs/instructions/M3-01-tag-feature-and-management.md`(M3-01 で整備済みのタグ API・型定義の前提知識)
- `docs/design/03-data-model.md`(データモデル設計書):
  - **§3.4 combos テーブル定義**(L329 付近): `version` カラムによる楽観的排他制御
  - **§3.6 tags テーブル定義**(L446-458): タグ DTO の整合性確認
  - **§3.7 combo_tags テーブル定義**(L460-467): 中間テーブル構造、PK `(combo_id, tag_id)`
- `docs/design/05-screen-design.md`(画面設計書):
  - **§5.4 コンボ一覧**(L184-218): タグ列の表示位置(L207、L213, L216 の「タグ」列)
  - **§5.6 コンボ詳細**(L259 付近): タグ表示位置
  - **§5.7 コンボ登録・編集**(L329): 表示項目11「タグ選択(既存タグから複数選択、新規作成も可能)」
- `docs/design/02-architecture.md`(アーキテクチャ設計書):
  - **§4.2 主要エンドポイント**(L138): PATCH /api/combos/{id} の説明に「タグ」がメタデータ編集対象として明記されている
  - **§4.3 エラーハンドリング**(L149-163): エラーレスポンス共通フォーマット
- `docs/design/06-validation.md`(バリデーション設計書):
  - VAL-C01〜C12(コンボ保存時のバリデーション、タグ追加時の追加バリデーションは想定されていないが、tagIds に存在しないタグ ID が指定された場合のエラー処理は本指示書 §4.3.4 で扱う)
- `docs/design/supp-001-detailed-design.md`:
  - **§3.4「コンボ編集の2方式分離」**: メタデータ編集(PATCH)と重複判定キー変更編集(POST、論理削除+新規)の境界
  - **§5.4 / §5.5 テスト規約**

### 3.2 任意参照(必要時のみ参照)

- `docs/design/requirements.md`: FR004 編集方式分離、FR009 タグ管理関連
- `docs/instructions/M2-02-edit-ux-improvements.md`: `UpdateMetadataInput` への `IsDraft *bool` 追加の実装パターン(§4.3.1 のテンプレートとして参考になる)
- `docs/instructions/M1-05-*.md` / `M1-06-*.md`: 一覧 API・コンボ編集画面の既存実装

### 3.3 参照不要

- DES-004 内部表現仕様書(プリセット・エイリアス系、本指示書のスコープ外)
- M2-01(仮想コントローラ)、M2-03(ゴミ箱)、M2-04(統合・仕上げ)指示書
- M3-03 / M3-04 / M3-05 指示書(後続マイルストーンのため)

### 3.4 着手前の確認

製造担当 Claude Code は §4 詳細仕様の実装に着手する前に、以下を確認する。

#### 3.4.1 M3-01 で整備されたタグ API の動作確認

```bash
# サーバーが起動していない場合は make run-server-debug などで起動
curl http://localhost:47318/api/tags
curl http://localhost:47318/api/tags?category=mycombo_status
```

期待される結果(M3-01 実装後): 200 OK、初期 3 タグ(使用中・練習中・頻度低下)を含む配列レスポンス。本指示書はこの API を `useTagsForSelector` フック経由で利用する。

#### 3.4.2 既存のコンボ編集画面構造の確認

```bash
ls web/src/features/combo/components/
cat web/src/features/combo/components/ComboEditor.tsx | head -50
```

期待される確認事項:
- `ComboEditor.tsx`(または相当ファイル)が存在する
- M2-02 完了時点の構造(`mode` prop、`PutConfirmDialog` 抽出済み)が確認できる
- 既存のタグ選択箇所が「未実装」「プレースホルダー」「TODO」のいずれかになっていることを確認する(M1-06 / M2-02 の実装範囲外だったため)

#### 3.4.3 `UpdateMetadataInput` 構造体の現状確認

```bash
grep -rn 'UpdateMetadataInput' internal/
```

期待される確認事項:
- M2-02 で `IsDraft *bool` フィールドが追加された構造体が存在する
- 本指示書ではここに `TagIDs *[]int64` を追加する

#### 3.4.4 コンボ一覧/詳細 API の現状レスポンス構造確認

```bash
# default ユーザーで何かコンボを 1 件作成済みの状態で
curl http://localhost:47318/api/combos | head -50
curl http://localhost:47318/api/combos/1
```

期待される確認事項:
- 一覧レスポンスに現状 `tags` フィールドが含まれていない、または `null` / 空配列で返ってくる
- 詳細レスポンスも同様
- 本指示書ではこれらに `tags: Tag[]` を埋めるよう DTO を拡張する

#### 3.4.5 combo_tags テーブルの ON DELETE CASCADE 確認

```bash
sqlite3 data/combomgr.db ".schema combo_tags"
```

期待される確認事項:
- `combo_tags` の外部キー制約に `ON DELETE CASCADE` が **設定されているか** を確認する
- **設定されている場合**: 既存実装のままで OK(combos の論理削除/物理削除で combo_tags が連動削除される)
- **設定されていない場合**: 設計書本体(DES-003 §3.7)に CASCADE が明記されておらず、設計ギャップに該当する。Plan Mode で停止して開発者に報告し、CHANGE 通知書起票要否を協議する

#### 3.4.6 確認結果の報告

製造担当 Claude Code は §3.4.1〜§3.4.5 の確認コマンド出力を実装完了報告に含める。

#### 3.4.7 §4 着手の前提条件

§3.4.1〜§3.4.5 の全確認結果が期待通りであることを確認してから、§4 詳細仕様の実装に着手する。万一現状が想定と乖離する場合(例: タグ API が動かない、`UpdateMetadataInput` の構造が想定と違う、`combo_tags` の CASCADE が未設定)は Plan Mode で停止して開発者に報告する。

---

## 4. 詳細仕様

### 4.1 タグ選択 UI(`TagSelector.tsx`)

#### 4.1.1 機能要件

- 既存タグの **複数選択**(チェックボックス的な動作)
- フォーカス時に検索可能なタグ一覧(数十件規模で快適に動く想定、当面は ScrollArea 程度で十分)
- 選択中タグはバッジとして UI 上部に表示される(色付き)
- バッジ右の × ボタンで個別解除
- **新規タグ作成**: タグ一覧の検索ボックスに新名称を入力すると「『xxx』を新規作成」のオプションが現れる。これをクリックでタグ作成 → 自動選択

#### 4.1.2 Props 設計

```typescript
interface TagSelectorProps {
  selectedTagIds: number[];                    // 親が管理する選択状態
  onChange: (tagIds: number[]) => void;        // 選択変更コールバック
  // 新規タグ作成は内部で M3-01 の useTagManagement 経由で行う(本コンポーネント自身は親に作成完了を伝えるだけ)
  excludeCategories?: string[];                // 除外するカテゴリ(例: コンボ編集画面では mycombo_status 系を除外したい場合に使う、未指定なら全て表示)
  disabled?: boolean;                          // 編集モードによる disable
}
```

`excludeCategories` の用途について: コンボ編集画面では「mycombo_status 系のタグはマイコンボタブ操作で付ける概念」と整理している(DES-005 §5.5、SUPP-001 §3.5)。本指示書 §4.7 の方針確定では **excludeCategories を `["mycombo_status"]` で渡す** ことを推奨する。

#### 4.1.3 内部実装

- `useTagsForSelector()` フック(本指示書 §4.2 で新設)でタグ一覧を取得
- 標準 HTML + Tailwind での自作実装(shadcn/ui は M7 まで未導入のため、playbook §17.2 / §4.6)。M1-06 / M2-02 で確立した「自作ラッパー方針」を踏襲する
- 構造: `<div class="relative">` をルートに、テキスト入力欄(`<input type="text">`)+ 選択中バッジ群 + 候補ポップオーバー(`<div class="absolute z-10">` で疑似ポップオーバー)
- ポップオーバー開閉: `useState<boolean>` で管理。入力欄フォーカスで開く、外側クリック(useEffect でドキュメント全体の click イベントを購読、コンテナ外クリックで閉じる)で閉じる。M2-02 の `DuplicateRealtimeWarning.tsx` で確立した「外側クリック検知パターン」を参照
- 検索フィルタ: 入力中の文字列(state)で `filteredTags` を `filter()` する。デバウンスは不要(タグ件数は数十件規模のため、毎回の filter で問題ないパフォーマンス)
- 候補リスト: `<ul>` + `<li>` + クリックで選択トグル(`onChange` 発火)。`<li>` には Tailwind の hover/focus 表示を付ける
- 選択中バッジ: `<TagBadgeList>` を再利用するか、`<span>` ベースで個別実装。各バッジ右に × ボタン(`<button aria-label="解除">`)
- キーボード操作: 当面は不要(マウス/タップ操作のみ対応で MVP として十分、playbook §17.1 個人開発の規模感)。M7 仕上げで shadcn/ui 統一導入時に Command コンポーネント由来のキーボード操作を獲得する想定
- 内部状態: 検索文字列(string)、ポップオーバー開閉(boolean)
- 選択は親 component が `selectedTagIds` で管理(本コンポーネントは presentational + 編集 UI に専念)

#### 4.1.4 新規タグ作成フロー

1. ユーザーが検索ボックスに既存タグ名と一致しない名称を入力
2. 検索結果の末尾に「『{入力中の文字列}』を新規作成」項目が表示される
3. クリックで M3-01 の `useTagManagement().createMutation` を発火
4. 作成成功 → `selectedTagIds` に新しいタグ ID を追加して `onChange` 発火
5. 失敗(VAL-T01 重複等) → エラーメッセージ表示(`alert()` または入力欄下に `<p class="text-red-600">` で表示。shadcn/ui Toast は M7 まで未導入のため使用しない。M1-06 / M2-02 のエラー表示パターンを踏襲)。M3-01 で `useTagManagement().createMutation` のエラーハンドリングは整備済みのため、ここではエラーオブジェクトを受けて表示するだけで足りる

新規タグ作成時の category と color はデフォルト値(category 未指定 = NULL、color 未指定 = NULL)で作成する。色やカテゴリ設定が必要な場合はタグ管理画面(M3-01 の `/tags/manage`)で別途編集してもらう。

### 4.2 タグセレクタ用フック(`useTagsForSelector.ts`)

#### 4.2.1 機能要件

- M3-01 の API `GET /api/tags`(`include_usage` 不指定 = `false`)を呼ぶ軽量フック
- 結果は `Tag[]`(usage_count なし)
- TanStack Query でキャッシュ(queryKey は `['tags', { include_usage: false }]`)
- M3-01 の `useTagManagement` とキャッシュキーが重ならないよう注意(あちらは `['tags', { include_usage: true }]`)

#### 4.2.2 構造例

```typescript
export function useTagsForSelector(options?: { excludeCategories?: string[] }) {
  const tagsQuery = useQuery({
    queryKey: ['tags', { include_usage: false }],
    queryFn: () => tagApi.list({ includeUsage: false }),
  });

  const filteredTags = useMemo(() => {
    if (!tagsQuery.data) return [];
    if (!options?.excludeCategories) return tagsQuery.data;
    return tagsQuery.data.filter(t => !options.excludeCategories!.includes(t.category ?? ''));
  }, [tagsQuery.data, options?.excludeCategories]);

  return { tagsQuery, filteredTags };
}
```

### 4.3 バックエンド: コンボ保存系 API への `tagIds` 追加

#### 4.3.1 DTO の拡張

**`CreateComboInput`(POST /api/combos のリクエスト)**:

```go
type CreateComboInput struct {
    // ... 既存フィールド ...
    TagIDs []int64 `json:"tagIds,omitempty"` // M3-02 で追加
}
```

POST は新規作成のため、`TagIDs` の意味は「作成と同時に紐付けるタグ ID 配列」。`nil` または空配列の場合はタグ未紐付けで作成。

**`UpdateMetadataInput`(PATCH /api/combos/:id のリクエスト)**:

```go
type UpdateMetadataInput struct {
    // ... 既存フィールド(IsDraft *bool 等) ...
    TagIDs *[]int64 `json:"tagIds,omitempty"` // M3-02 で追加、ポインタ型に注意
}
```

PATCH の場合、ポインタ型 `*[]int64` で **3 つの状態を区別** する:

| 値 | 意味 |
|----|------|
| `nil` (フィールド未送信) | タグ関連を変更しない |
| `&[]int64{}` (空配列送信) | タグを全解除 |
| `&[]int64{1, 2, 3}` (値あり) | 指定タグ ID で置き換え |

これは M2-02 で `IsDraft *bool` に対して採用したパターン(`nil`=変更なし、`&true`/`&false`=明示変更)と同じ思想。

JSON タグは CLAUDE.md §4 / SUPP-001 §6.4 の規則に従い camelCase(`tagIds`)で統一する。

#### 4.3.2 サービス層の処理

`internal/service/combo/service.go` の `CreateCombo` と `UpdateMetadata` を修正する。

**CreateCombo の追加処理**:

```
combos.Insert で new combo 作成 (既存処理)
↓
input.TagIDs が len() > 0 のとき:
  combo_tags への INSERT を tx 内で実行
  (リポジトリ層補助関数 ReplaceTagAssociations を使う、§4.3.3)
↓
コミット
```

**UpdateMetadata の追加処理**:

```
combos.UpdateXxx で metadata 更新 (既存処理、version チェック含む)
↓
input.TagIDs != nil のとき:
  combo_tags の既存関連を全削除
  input.TagIDs の内容で再 INSERT
  (リポジトリ層補助関数 ReplaceTagAssociations を使う、§4.3.3)
↓
コミット
```

**重要**: 全て同一トランザクション内で行う。combos.UpdateXxx の version チェックが失敗した場合は combo_tags の操作も行われない(トランザクションロールバック)。

#### 4.3.3 リポジトリ層補助関数 `ReplaceTagAssociations`

```go
// ReplaceTagAssociations は指定 combo_id に紐付く combo_tags を tagIDs で置き換える。
// tagIDs が空配列の場合、既存関連を全て削除する。
// tx は呼び出し側のトランザクションを受け取る(独立トランザクションは作らない)。
func (r *Repository) ReplaceTagAssociations(ctx context.Context, tx *sql.Tx, comboID int64, tagIDs []int64) error
```

実装方針:

1. `DELETE FROM combo_tags WHERE combo_id = ?` で既存削除
2. `tagIDs` が空でなければ `INSERT INTO combo_tags (combo_id, tag_id) VALUES (?, ?), ...` で一括 INSERT
3. INSERT 失敗時は呼び出し側でトランザクションロールバック

この関数は `combo` リポジトリ内に置く(combo_tags は combo の一部関連と見なすため)。`tag` リポジトリ側には置かない(M3-01 完了済みの責務分離を維持)。

#### 4.3.4 タグ ID 検証

`tagIDs` に **存在しない** または **他ユーザーの** タグ ID が指定された場合の挙動を確定する:

- **存在しないタグ ID**: combo_tags への INSERT 時に FK 制約違反でエラー → サービス層で検出して `ErrInvalidTagID`(HTTP 400 + `{error: {code: "INVALID_TAG_ID", details: {invalid_ids: [...]}}}`)を返す
- **他ユーザーのタグ ID**: 認証スキップ運用(SUPP-001 §2.5)で実質単一ユーザーのため、現時点では意識する必要なし。`Tag.UserID == 1` のみ存在する前提で動作する

実装の素直さを優先し、**事前の SELECT による存在チェックは実装しない**(playbook §4.5「フローの素直さ原則」)。FK 違反エラーをサービス層でキャッチして変換する形で十分。

#### 4.3.5 コンボ編集2方式分離との関係

SUPP-001 §3.4「コンボ編集の2方式分離」に従い、コンボの編集は以下の2方式に分かれる:

- **重複判定キー変更編集**(レシピ・始動技・position・opponent_stance・hit_type・opponent_size 変更): 旧コンボを論理削除し、新コンボを POST で新規作成する
- **メタデータ編集**(ダメージ・タグ・メモ等): PATCH で直接更新する

タグの追加・削除は **後者(メタデータ編集)に該当** する。本指示書では:

- PATCH /api/combos/:id での tag 編集 → `UpdateMetadataInput.TagIDs` 経由で完結(§4.3.2)
- 重複判定キー変更編集の場合 → 旧コンボの combo_tags は CASCADE で自動削除(§3.4.5 で確認済み)、新規 POST 時に `CreateComboInput.TagIDs` で再付与する

重複判定キー変更編集時のタグ引き継ぎは、フロント側 `ComboEditor` が「保存前の編集状態の `tagIds`」を保持し、POST リクエストの `CreateComboInput.TagIDs` に渡す形で実装する。これは M2-02 で確立した copy モード時のフィールド引き継ぎロジックと同様のパターン。

### 4.4 コンボ一覧/詳細 API レスポンスへの `tags` フィールド追加

#### 4.4.1 一覧 API の DTO 拡張

`GET /api/combos` のレスポンス DTO(各コンボ要素)に以下を追加:

```go
type ComboListItem struct {
    // ... 既存フィールド ...
    Tags []Tag `json:"tags"`                    // M3-02 で追加、空でも nil ではなく空配列で返す
}
```

JSON シリアライズで `null` ではなく `[]` を返すよう、サービス層で `tags == nil` の場合に `[]Tag{}` で初期化する。フロント側の `tags?.map(...)` のような optional chaining を不要にしてバグを減らす。

#### 4.4.2 一覧 API のクエリ実装(2クエリ + IN 句)

リポジトリ層で以下の方針で取得する:

**Step 1**: コンボ本体を既存クエリで取得

```sql
SELECT * FROM combos WHERE ...
```

**Step 2**: 取得した combo_id 群でタグを一括取得

```sql
SELECT ct.combo_id, t.id, t.user_id, t.name, t.category, t.color
FROM combo_tags ct
INNER JOIN tags t ON t.id = ct.tag_id
WHERE ct.combo_id IN (?, ?, ...)
```

**Step 3**: サービス層で 2 クエリの結果を combo_id でマージ

`map[int64][]Tag` の中間構造を作り、各 combo の Tags フィールドに割り当てる。

**この方式を選ぶ理由**:
- N+1 ではない(combo_ids を IN 句で一括取得するため、クエリ回数は常に 2 回)
- パフォーマンス: 一覧 API のレスポンスタイムは現実的(数百コンボでも問題なし、本アプリは数千件規模想定)
- コードの素直さ: GROUP_CONCAT のセパレータ衝突リスクや文字列パース処理が不要

製造担当はこの方式で実装する。GROUP_CONCAT 等の代替案を採用したい根拠が見つかった場合のみ Plan Mode で開発者に相談する。

#### 4.4.3 詳細 API の DTO 拡張

`GET /api/combos/:id` のレスポンス DTO に同じ `tags []Tag` フィールドを追加。実装は単一コンボ + そのタグ取得なので、シンプルに以下:

```sql
SELECT t.* FROM combo_tags ct INNER JOIN tags t ON t.id = ct.tag_id WHERE ct.combo_id = ?
```

#### 4.4.4 一覧 API の暫定処理2(タグ列ハイフン)解消

M1-05 暫定処理2「コンボ一覧のタグ列が `-` 固定表示」を本指示書で解消する。

フロント側 `ComboTableRow.tsx`(または相当)を以下のように修正:

- 修正前: `<td>-</td>`(または相当)
- 修正後: `<td><TagBadgeList tags={combo.tags} excludeCategories={["mycombo_status"]} /></td>`

`TagBadgeList` の実装は §4.5 を参照。

### 4.5 タグ表示コンポーネント `TagBadgeList.tsx`

#### 4.5.1 機能要件

- `tags: Tag[]` を受け取り、各タグを色付きバッジとして横並び表示
- タグが空(または excludeCategories で全件除外された)の場合は何も表示しない(以前のような「-」表示にしない、空セルでよい)
- カテゴリによる **excludeCategories** フィルタを受け取る(コンボ一覧では `["mycombo_status"]` を渡す想定。マイコンボステータスはマイコンボタブ M3-04 でアイコン的に表示する別概念のため、一覧の通常タグ列では除外する)

#### 4.5.2 Props 設計

```typescript
interface TagBadgeListProps {
  tags: Tag[];
  excludeCategories?: string[];        // 除外するカテゴリ(コンボ一覧では ["mycombo_status"])
  maxVisible?: number;                 // 最大表示数。超えた場合は「+N」で省略表示
  size?: 'sm' | 'md';                  // バッジサイズ
}
```

#### 4.5.3 表示仕様

- 各タグは `tag.color` を背景色に、白または黒の文字色を自動選択(`color` の輝度に基づく)
- `color` が NULL の場合は中立的なデフォルト色(例: `#9CA3AF` Tailwind gray-400 相当)
- maxVisible を超えた分は `+N` バッジで省略表示
- カテゴリ別の表示順は意識しない(配列順、サーバー側のソート順に従う)

### 4.6 コンボ詳細画面のタグ表示

`ComboDetailPage.tsx`(または相当)に `TagBadgeList` を組み込む。配置位置は DES-005 §5.6 を参照(タグは詳細画面の項目として明記されている)。

excludeCategories は **指定しない**(全タグを表示する。詳細画面ではマイコンボステータスも合わせて見えた方が親切)。

### 4.7 設計判断事項(本指示書で確定済み)

以下は本指示書で確定済みの設計判断。製造担当 Claude Code は推測で別案を選ばない。

| 項目 | 確定内容 | 根拠 |
|------|---------|------|
| `tagIds` の JSON タグ命名 | camelCase(`tagIds`) | CLAUDE.md §4(M3-01 完了報告で明文化) |
| `UpdateMetadataInput.TagIDs` の型 | `*[]int64`(ポインタ型) | nil/空配列/値ありの3状態区別、M2-02 IsDraft と同パターン |
| 一覧 API でのタグ取得方式 | 2クエリ + IN 句一括取得 | §4.4.2 の理由(N+1 回避 + コードの素直さ) |
| タグ ID 検証方式 | FK 違反エラーのキャッチ + 変換 | playbook §4.5 フローの素直さ原則(事前 SELECT は冗長) |
| `combo_tags` の置き換え方式 | DELETE 全件 + INSERT 一括 | サービス層トランザクション内、シンプルな置き換え |
| TagSelector の excludeCategories | コンボ編集画面では `["mycombo_status"]` | マイコンボ操作とコンボ編集の責務分離 |
| TagBadgeList の excludeCategories | コンボ一覧では `["mycombo_status"]`、詳細画面では未指定 | 一覧は通常タグ表示、詳細は全タグ表示 |
| 新規タグ作成時の category/color | NULL(未指定)で作成、後でタグ管理画面で編集 | コンボ編集の流れを軽量に保つ |
| 楽観的排他制御 | combos.version は通常通り PATCH で機能、tag 操作は同一トランザクション | DES-003 §3.4、SUPP-001 §3.4 の編集2方式分離 |
| API パス | 既存パスのみ拡張、新規 API 追加なし | M3-overview §3.2 例外条項 |
| 重複判定キー変更編集時のタグ引き継ぎ | フロント側 ComboEditor が tagIds を保持し、POST 時に CreateComboInput.TagIDs に渡す | M2-02 copy モードのフィールド引き継ぎパターン踏襲 |

---

## 5. テスト要件

### 5.1 必須テスト

#### 5.1.1 バックエンド: サービス層テスト(必須)

`internal/service/combo/service_test.go` で以下のケースを **追加** する(既存テストは温存):

- **CreateCombo with empty TagIDs**: タグなしで正常作成、combo_tags にレコードなし
- **CreateCombo with valid TagIDs**: 複数タグ ID を渡して正常作成、combo_tags に対応レコード
- **CreateCombo with invalid TagID**: 存在しないタグ ID を含めて作成試行 → ErrInvalidTagID(FK 違反のキャッチ + 変換)、コンボも作成されていないこと(トランザクションロールバック確認)
- **UpdateMetadata with TagIDs nil**: タグ関連が変更されないことを確認(combo_tags の差分なし)
- **UpdateMetadata with TagIDs empty array**: 既存タグが全解除されることを確認(combo_tags 該当 combo_id のレコード 0 件)
- **UpdateMetadata with TagIDs values**: 既存タグが置き換えられることを確認(古いタグ関連削除、新タグ関連 INSERT)
- **UpdateMetadata version conflict + TagIDs**: 楽観的排他制御で version が古い場合、tag 操作も行われないことを確認(トランザクションロールバック)

#### 5.1.2 バックエンド: リポジトリ層テスト(複雑クエリのみ)

`internal/repository/combo/repository_test.go` で以下を追加:

- **List クエリの tags 取得**: 2クエリ方式で、複数コンボ + 各コンボに 0〜N 個のタグが付いた状態で正しく取得できることを確認
- **ReplaceTagAssociations**: tagIDs 空配列 / 値あり の両ケースで動作確認

#### 5.1.3 バックエンド: ハンドラ層テスト

`internal/api/combo/handler_test.go` で以下を追加:

- **POST /api/combos with tagIds**: リクエストボディの `"tagIds": [1, 2]` が正しく Input.TagIDs に到達し、保存成功
- **PATCH /api/combos/:id with tagIds**: 同上、PATCH で tagIds の置き換え動作
- **PATCH /api/combos/:id without tagIds field**: tagIds フィールドを送信しない場合、tag 関連が変更されないことを確認(リクエストボディ全体で `tagIds` キー自体を含めない)
- **PATCH /api/combos/:id with tagIds: []**: 空配列送信で全解除動作
- **POST with invalid tagIds**: 存在しないタグ ID を含むリクエスト → 400 + INVALID_TAG_ID

#### 5.1.4 フロントエンド: コンポーネントテスト

- `TagSelector.test.tsx`:
  - `selectedTagIds` の表示状態が正しい(選択中バッジの表示)
  - 選択追加で `onChange` 発火、引数が正しい
  - 選択解除で `onChange` 発火、引数が正しい
  - 検索フィルタ動作(検索文字列に基づきタグ一覧が絞り込まれる)
  - 新規タグ作成オプションの表示条件(検索文字列が既存タグ名と一致しない時)
  - `excludeCategories` 指定時のフィルタ動作
- `TagBadgeList.test.tsx`:
  - 0件、1件、N件、N+1 件の表示分岐(maxVisible 動作)
  - excludeCategories の動作
  - color NULL 時のデフォルト色表示
- `ComboEditor` の既存テストに **追加**:
  - `tagIds` を含む保存リクエストが正しく組み立てられること

### 5.2 E2E シナリオ

開発者が実機ブラウザで以下を順に実行し、すべて通ることを確認する。

```
## E2E シナリオ

### A. 新規コンボにタグ付与
1. /tags/manage で「使用中」「練習中」「頻度低下」が初期 3 タグとして表示されていることを確認
2. /combos/new でコンボ新規登録画面を開く
3. 必須項目を入力(キャラ、始動技、レシピ、ダメージ等)
4. タグ選択 UI で検索ボックスに「初心者向け」と入力 → 「『初心者向け』を新規作成」オプションが現れる
5. クリック → 新規タグ作成成功、自動選択される(バッジ表示)
6. 保存 → コンボ一覧に戻る
7. 一覧で作成したコンボの行に「初心者向け」のタグバッジが表示される(M1-05 暫定処理2 解消の確認)
8. 行をクリックしてコンボ詳細画面へ → タグ表示エリアに「初心者向け」のバッジ

### B. 既存コンボのタグ編集(メタデータ編集)
9. コンボ一覧から既存コンボの編集画面を開く
10. タグ選択 UI で既存タグを変更(追加・削除)
11. 保存 → PATCH /api/combos/:id で tagIds が送信される
12. 一覧で変更後のタグが表示される(再描画されている)
13. タグを全解除して保存 → 一覧でタグ列が空になる(セルが空、ハイフン表示にならない)
14. (任意検証) ブラウザの DevTools の Network タブで PATCH リクエストボディに `"tagIds": []` が含まれることを確認

### C. 重複判定キー変更編集との連携
15. ダメージのみ変更 → PATCH 経由のメタデータ編集 → 既存タグが温存される
16. レシピを変更 → 重複判定キー変更編集 → 旧コンボ論理削除、新コンボが POST で作成される
17. 新コンボにも編集前のタグが引き継がれて表示される(POST 時の CreateComboInput.TagIDs に旧タグ ID が渡されている)

### D. mycombo_status カテゴリ除外
18. /tags/manage で「使用中」(category=mycombo_status)を確認
19. /combos/new でタグ選択 UI を開く → 「使用中」「練習中」「頻度低下」が **表示されない**(excludeCategories="mycombo_status" によるフィルタ)
20. ただし手動で別ユーザーから付与済みのコンボがある場合(または DB を直接編集して mycombo_status タグを付与した場合)、コンボ詳細画面では mycombo_status タグが表示される(excludeCategories 未指定)

### E. バリデーション
21. 不正な tagIds(存在しないタグ ID)を含む POST/PATCH を curl で送信 → 400 + INVALID_TAG_ID エラー
22. PATCH で楽観的排他制御エラー(version 古い)+ tagIds 含む → 409 エラー、combo_tags も変更されていないこと(DB を直接 SELECT で確認)
```

これが見えるまで DoD 不達成。

---

## 6. レビュー観点(別ファイル参照)

レビュー観点は以下のチェックリストに記載する: `docs/instructions/reviews/M3-02-review-checklist.md`

製造担当 Claude Code は本ファイルを読む必要はない。本指示書本体に集中する。

---

## 7. 完了条件(Definition of Done)

### 7.1 機能要件

- [ ] §2.1 のファイル一覧が全て作成されている
- [ ] §2.2 のファイル修正が実施されている
- [ ] コンボ登録・編集画面でタグの選択・新規作成・解除が動作する
- [ ] コンボ保存時に combo_tags への INSERT/UPDATE がトランザクション内で実行される
- [ ] コンボ一覧のタグ列が実データ表示になっている(M1-05 暫定処理2 解消)
- [ ] コンボ詳細画面でタグが表示される
- [ ] §5.2 E2E シナリオ A〜E が全て通過する

### 7.2 自己テスト結果(製造担当の責任範囲)

**バックエンド側**:

- [ ] `make test` または `go test ./...` が全通過する
- [ ] 主要 API を `curl` で叩き、レスポンスを報告書に貼付する:
  - `curl -X POST http://localhost:47318/api/combos -d '{"...省略..., "tagIds": [1,2]}'` → 201、レスポンスに `tags` 配列
  - `curl http://localhost:47318/api/combos` → 200、各コンボに `tags` フィールド
  - `curl http://localhost:47318/api/combos/1` → 200、`tags` フィールド
  - `curl -X PATCH http://localhost:47318/api/combos/1 -d '{"tagIds": []}'` → 200、空配列で全解除
  - `curl -X PATCH http://localhost:47318/api/combos/1 -d '{"damage": 1500}'` → 200、tags は変更されない(レスポンスで確認)
  - `curl -X POST http://localhost:47318/api/combos -d '{"...省略..., "tagIds": [9999]}'` → 400 + INVALID_TAG_ID
- [ ] §3.4.6 着手前確認の出力を含める

**フロントエンド側**:

- [ ] `cd web && pnpm test` が全通過する
- [ ] `cd web && pnpm build` が成功する
- [ ] TypeScript の型エラーが残っていない
- [ ] 開発サーバー起動時にコンソール警告が新規発生していない
- [ ] 開発者向けの「動作確認手順書」を実装完了報告に含める(§5.2 E2E シナリオの実行手順を含む)

ブラウザでの実機動作確認・スクリーンショット取得は **開発者の責任範囲**。

### 7.3 品質チェック

- [ ] CLAUDE.md の禁止事項(§10 本ルールの目的を踏まえて判断)に抵触していない
- [ ] **JSON タグ・API DTO 型が camelCase で統一されている**(CLAUDE.md §4)。`tagIds`、`tags`、`tagId` などスネークケースの混入なし
- [ ] ブラウザストレージ未使用(M3-02 では使用機会なし、CLAUDE.md §10.X 許容範囲外の使用がないことを確認)
- [ ] `console.log` / `fmt.Println` を本番コードに残していない
- [ ] 設計書本体(DES-003 §3.6 / §3.7、DES-005 §5.4 / §5.6 / §5.7、DES-002 §4.2 PATCH 説明)と実装が一致している
- [ ] **playbook §4.5「フローの素直さ原則」に抵触していない**(エラー駆動の再試行フロー、不要な往復通信、副次効果前提の記述がないこと)

### 7.4 ドキュメント

- [ ] `docs/progress/progress-log.md` に M3-02 完了報告を追記する
- [ ] M1-05 暫定処理2(タグ列ハイフン固定表示)の解消事実を progress-log に明記する
- [ ] 暫定処理3(始動技 ID 表示)については引き続き M3-05 で対応予定の旨を明記する

### 7.5 完了報告

- [ ] 開発者に「M3-02 が完了しました」と報告
- [ ] §7.1〜§7.4 の自己テスト結果を報告書に含める

---

## 8. 参照ドキュメント

| ID | パス | 関連節 |
|----|------|-------|
| CLAUDE.md | `CLAUDE.md` | **§4 JSON タグ・API DTO 型 camelCase 統一**、§10 禁止事項、§10.X ブラウザストレージ運用ルール |
| M3-overview | `docs/instructions/M3-overview.md` | §3.2 M3-02 スコープ、§6 運用ルール |
| M3-01 指示書 | `docs/instructions/M3-01-tag-feature-and-management.md` | タグ API・型定義の前提 |
| DES-002 | `docs/design/02-architecture.md` | §4.2 PATCH /api/combos の説明(L138)、§4.3 エラーハンドリング |
| DES-003 | `docs/design/03-data-model.md` | **§3.4 combos テーブル + version カラム**、**§3.6 tags**、**§3.7 combo_tags** |
| DES-005 | `docs/design/05-screen-design.md` | **§5.4 コンボ一覧 タグ列(L207)**、**§5.6 コンボ詳細**、**§5.7 コンボ編集 タグ選択(L329)** |
| DES-006 | `docs/design/06-validation.md` | VAL-C01〜C12(タグ追加分は本指示書独自で INVALID_TAG_ID を扱う) |
| SUPP-001 | `docs/design/supp-001-detailed-design.md` | §3.4 編集2方式分離、§5.4 / §5.5 テスト規約、§6.4 JSON 命名規則、§6.7 進捗管理 |
| M2-02 指示書 | `docs/instructions/M2-02-edit-ux-improvements.md` | `UpdateMetadataInput` への IsDraft 追加パターン(本指示書 §4.3.1 のテンプレート参考) |
| M1-05 / M1-06 | `docs/instructions/M1-05-*.md`, `M1-06-*.md` | 一覧 API・コンボ編集画面の既存実装 |
| playbook | `docs/handover/design-instruction-playbook.md` | **§4.5 フローの素直さ原則**、§5 設計書節照合ルール、§9 レビューチェックリスト構造 |

---

## 9. 注意事項・判断に迷ったら

### 9.1 推測で進めてはいけない事項

以下は推測で進めず、Plan Mode で開発者に確認する:

- §3.4.1 で M3-01 のタグ API が動作しない場合
- §3.4.2 で既存の ComboEditor.tsx 構造が想定と乖離している場合
- §3.4.3 で `UpdateMetadataInput` 構造体が想定と異なる(IsDraft フィールドがない、別名になっている等)場合
- §3.4.5 で `combo_tags` の `ON DELETE CASCADE` が **設定されていない** ことが判明した場合
- 既存の M2-02 `DuplicateRealtimeWarning.tsx` の「外側クリック検知パターン」が想定と異なる構造で実装されている場合(TagSelector のポップオーバー外側クリック処理で再利用するため)
- E2E シナリオ C(重複判定キー変更編集後のタグ引き継ぎ)で、既存ロジックがどこに実装されているか不明な場合

### 9.2 推測で進めてよい事項(その旨を明示)

以下は推測で進めてよいが、実装時に「推測:〜と仮定した」とコード内コメントまたは PR 説明に明示する:

- TagSelector の UX 細部(検索のデバウンス時間、ポップオーバーの開閉アニメーション等)
- TagBadgeList のデフォルト色値(`#9CA3AF` 相当)
- 文字色の自動選択ロジック(輝度判定の閾値)
- maxVisible のデフォルト値(コンボ一覧で 3〜5 個程度を想定)

### 9.3 不明事項発見時の対応

- 設計書本体(DES-002 / DES-003 / DES-005 / DES-006)と本指示書の記述が乖離している場合 → 実装を止めて開発者に報告し、CHANGE 通知書起票要否を協議する
- M3-01 で実装済みのはずのタグ API が想定と違う動作をする場合 → M3-01 の修正で対応すべきか、本指示書で対応すべきかを Plan Mode で開発者に確認する
- 本指示書の §4 詳細仕様で具体化されていない実装判断が必要になった場合 → §9.2 の範囲なら推測で進めて明示、それ以外は Plan Mode で開発者確認

### 9.4 Plan Mode で計画提示時に含めるべき項目

Plan Mode を使う場合(任意)、以下を計画に含めると安全:

- §3.4 着手前確認の結果(タグ API 動作、既存 ComboEditor 構造、UpdateMetadataInput 構造、現状レスポンス DTO、CASCADE 設定)
- 実装順序(BE: DTO 拡張 → サービス層 → リポジトリ層 → ハンドラテスト → FE: TagSelector → useTagsForSelector → ComboEditor 統合 → TagBadgeList → 一覧/詳細統合)
- テスト戦略(各層のどこにテストを書くか、トランザクションロールバック確認方法)
- E2E シナリオ §5.2 A〜E の各ステップを通すための前提データ準備手順

---

## 10. 完了後の次ステップ

M3-02 完了後、開発者の動作確認・承認を経て M3-03(フィルタ・ソート・表示列カスタマイズ)に進む。M3-03 では本指示書で完成したタグ付与機能と一覧 API を使い、コンボ一覧の機能を DES-005 §5.4 のレベルまで完成させる。あわせて表示列カスタマイズの localStorage 永続化(CLAUDE.md §10.X)を実装し、共通ヘルパ `web/src/lib/browser-storage.ts` を新設する。

---

*以上*

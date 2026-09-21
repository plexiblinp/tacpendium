# 指示書 M3-03: コンボ一覧のフィルタ・ソート・表示列カスタマイズ + browser-storage ヘルパ新設

| 項目 | 内容 |
|------|------|
| 指示書ID | M3-03 |
| バージョン | 1.0.2 |
| 対象マイルストーン | M3(マイコンボ系) |
| 推奨モデル | **Opus 4.6** |
| Plan Mode | **必須**(複数の関心が絡み、共通ヘルパ新設を含む。実装着手前に Plan Mode で計画提示し開発者承認を得ること) |
| 機械レビュー | **必須**(別チェックリスト: `docs/instructions/reviews/M3-03-review-checklist.md`) |
| 並列性 | **単独**(M3 は完全直列、M3-02 完了が前提) |
| 依存指示書 | M3-01(タグ機能・タグ API)、M3-02(コンボへのタグ付け UI、一覧 API レスポンスの tags フィールド)、M1-05(コンボ一覧画面の既存実装)、M2-03(`GET /api/combos` のクエリパラメータ追加先例 = `only_deleted=true`) |
| 想定所要時間 | 120〜150 分 |
| 作成者 | 詳細設計・製造準備担当Claude(M3 期間担当) |
| 作成日 | 2026-05-10 |
| 更新日 | 2026-05-10 |

## 更新履歴

| バージョン | 更新日 | 更新内容 |
|-----------|--------|----------|
| 1.0.0 | 2026-05-10 | 初版作成 |
| 1.0.1 | 2026-05-10 | 開発者確認(2026-05-10)で §4.3.3 状況コード値マスタの取扱を「定数ハードコード方式」で確定。Plan Mode 協議事項から確定方針へ格上げ。バックエンド(`internal/model/combo.go`)+ フロント(`web/src/constants/combo-list.ts`)の同期定数定義の具体例を §4.3.3 に追加。§4.5 設計判断事項表、§9.1 Plan Mode 必須項目、§9.3 不明事項対応、§9.4 計画提示項目を整合修正 |
| 1.0.2 | 2026-05-10 | M3-03 製造担当からのソートカラム名指摘(2026-05-10)を反映。指示書 v1.0.1 で「`drive_gauge_consumed` / `sa_gauge_consumed`」と書いていたカラム名 13 箇所を、DES-003 §3.4 (L341-342) および DB マイグレーション実装と一致する「`drive_gauge_consumed_total` / `sa_gauge_consumed_total`」(末尾 `_total` 付き)に修正。修正箇所: §4.2.2 ListSort.Field コメント、§4.2.4 ホワイトリスト表 2 行 + 重要注記文、Go 実装例の map キー/値 2 行、§4.3.1 ComboListFilters 型コメント、§4.3.2 SortField 型定義、§4.3.4 昇降ラベル表 2 行 + SORT_FIELD_LABELS 定数 2 行、§4.5 設計判断事項表 1 行。**設計担当の指示書執筆時に DES-003 §3.4 を再確認せず、推測で `_total` を剥がしてしまったミス**。設計書本体・DB 実装は元から `_total` 付きで一致しており、CHANGE 通知書は不要。playbook §5 設計書節への行レベル参照ルールが効いていれば防げたケース。M3-03 レビューチェックリストも v1.0.1 として同期修正 |

---

## 1. 背景と目的

### 1.1 背景

M1-05 でコンボ一覧画面の最小実装(更新日時ソートのみ・フィルタなし・タグ列ハイフン固定)を完成させた後、M3-01 / M3-02 でタグ機能の整備とコンボへのタグ付与 UI が完成した。本指示書では DES-005 §5.4「コンボ一覧」で定義された **フィルタ・ソート・表示列カスタマイズ** の本格実装を行う。

加えて、表示列カスタマイズの永続化に **localStorage を使用** する(CLAUDE.md §10.X で許容された3用途のうちの1つ)。本マイルストーンで初めて localStorage を使うため、**共通ヘルパ `web/src/lib/browser-storage.ts` を新設** し、後続の M6(下書き自動保存)・M7(仮想コントローラ選択保持)で再利用される共有資産とする。

### 1.2 目的

- コンボ一覧のフィルタ機能を DES-005 §5.4 の要求レベルまで完成させる(キャラ・タグ・状況・仮登録の4種)
- コンボ一覧のソート機能を DES-005 §5.4 の要求レベルまで完成させる(6種ソート + 昇降ラベル)
- 表示列カスタマイズ機能を実装し、localStorage に永続化する(CLAUDE.md §10.X)
- **共通ヘルパ `web/src/lib/browser-storage.ts` を新設**し、try-catch・JSON シリアライズ・キーバージョニングを集約する
- バックエンド `GET /api/combos` のクエリパラメータを拡張(フィルタ・ソート対応)
- マイコンボタブ機能のためのフィルタ機構基盤を整備する(マイコンボタブ自体は M3-04)

### 1.3 このマイルストーンで作らないもの

- マイコンボタブ機能(`mycombo_status` カテゴリ系での絞り込み表示) — M3-04 で実装(本指示書のフィルタ機構を再利用する)
- レシピ表示改善(M1-05 暫定処理1、コンボ一覧ルート列ハイフン) — M3-05 で実装
- セットプレイのツリー展開表示 — M4 セットプレイ系で実装。本指示書では一覧の各行を1コンボ1行のフラット表示で扱う(DES-005 §5.4 の「展開アイコン」「セットプレイ展開時の表示」は M3-03 では実装しない)
- コピーアイコン・編集アイコン・削除アイコンの新規実装 — 既存実装(M1-05 / M2-02 / M2-03)を流用、本指示書での修正なし
- 比較選択モード(複数選択 → 比較画面) — M5 比較系で実装
- エクスポート導線 — フェーズ2 で実装
- 仮想コントローラ選択保持の localStorage 利用 — M7 で実装(本指示書で新設するヘルパを再利用)
- 下書き自動保存の localStorage 利用 — M6 で実装(同上)
- マイコンボ画面用の独自ソート — M3-04 で必要なら追加

---

## 2. 成果物

### 2.1 作成するファイル

```
web/src/
├── lib/
│   ├── browser-storage.ts                          # 共通ヘルパ(本指示書で新設、M6 / M7 で再利用)
│   └── browser-storage.test.ts                     # ユニットテスト
├── features/
│   └── combo/
│       ├── components/
│       │   ├── ComboListFilters.tsx                # フィルタ・ソート UI(キャラ選択・タグフィルタ・状況フィルタ・仮登録トグル・ソート選択)
│       │   ├── ComboListFilters.test.tsx           # コンポーネントテスト
│       │   ├── ColumnVisibilityMenu.tsx            # 表示列カスタマイズ UI(各列の表示/非表示切替メニュー)
│       │   └── ColumnVisibilityMenu.test.tsx       # コンポーネントテスト
│       └── hooks/
│           ├── useComboListFilters.ts              # フィルタ・ソート状態管理フック(URL クエリパラメータと連動)
│           └── useColumnVisibility.ts              # 表示列カスタマイズ状態管理フック(localStorage 永続化)
└── constants/
    └── combo-list.ts                               # コンボ一覧の列定義・ソート種別定数(SCREAMING_SNAKE_CASE)
```

各ファイルの責務は §4 で詳述する。

### 2.2 修正するファイル

#### バックエンド

| ファイル | 修正内容 |
|---------|---------|
| `internal/api/combo/handler.go` の List ハンドラ | クエリパラメータの解析を拡張(§4.2.1)。M2-03 で追加された `only_deleted` と同パターンで `character_id` / `tag_ids` / `position` / `hit_type` / `opponent_stance` / `is_draft` / `sort` / `order` を受け取る |
| `internal/service/combo/service.go` の List 関数 | フィルタ・ソート条件を引数で受け取る(§4.2.2) |
| `internal/repository/combo/repository.go` の List 系クエリ | WHERE 句・ORDER BY 句の動的生成を追加(§4.2.3) |
| `internal/api/combo/handler_test.go` | クエリパラメータ拡張のテスト追加(§5.1.3) |

#### フロントエンド

| ファイル | 修正内容 |
|---------|---------|
| `web/src/features/combo/components/ComboList.tsx`(または相当) | `<ComboListFilters>` と `<ColumnVisibilityMenu>` を組み込み、`useComboListFilters` と `useColumnVisibility` フックを利用する形に修正 |
| `web/src/features/combo/components/ComboTableRow.tsx`(または相当) | `useColumnVisibility` の結果を参照し、非表示列を描画しない |
| `web/src/features/combo/api/comboApi.ts`(または相当) | List API クライアント関数の引数に filter / sort を追加 |
| `web/src/features/combo/hooks/useCombos.ts`(または相当) | TanStack Query の queryKey にフィルタ・ソート条件を含める |

### 2.3 変更しないもの(原則)

- M3-01 / M3-02 で整備したタグ API・タグ関連コンポーネントは変更しない
- M1-05 / M1-06 / M2-02 / M2-03 / M2-04 で整備したコンボ編集・詳細・ゴミ箱・memo 関連の実装は変更しない
- マイコンボタブの実装(M3-04 で実装予定)
- レシピ表示の暫定処理(M3-05 で実装予定)
- セットプレイ関連
- バックエンドの DTO 構造体(本指示書では既存 ComboListItem / Tag DTO の追加変更なし、ただしレスポンスのソート順だけ変わる)
- 楽観的排他制御(combos.version)の動作

### 2.4 例外: バックエンドへの最小限の追加が許容される箇所

本指示書はフロント主体だが、`GET /api/combos` のクエリパラメータ拡張という形でバックエンドの拡張を含む:

- **クエリパラメータ追加**: `character_id` / `tag_ids` / `position` / `hit_type` / `opponent_stance` / `is_draft` / `sort` / `order` の8種(§4.2.1)
- **サービス層・リポジトリ層の WHERE / ORDER BY 動的生成**: SQL injection 対策として、フィールド名・ソート種別はホワイトリストで検証(§4.2.3)
- **DTO の変更なし**: 既存レスポンス DTO はそのまま、フィルタ・ソートでの絞り込みと並び替えのみ

これらの拡張は M3-overview §3.3「例外条項」で予告済み。新規 API は追加しない(`/api/combos` 既存パスのみ拡張)。M2-03 の `only_deleted=true` 追加と同じスタンスで、CHANGE 通知書の起票は不要。

実装中にこれら以外のバックエンド変更が必要と判断した場合、Plan Mode で停止して開発者に相談すること。

---

## 3. 前提条件

### 3.1 必読ドキュメント

- `CLAUDE.md`(全体方針、特に **§4 JSON タグ・API DTO 型 camelCase 統一**、**§4 列挙的文字列定数の同期ルール**、**§10 本ルールの目的**、**§10.X ブラウザストレージ運用ルール**)
- `docs/instructions/M3-overview.md` v1.0.1(M3 全体像、§3.3 M3-03 スコープ、§6 運用ルール、特に §6.6 レビューチェックリスト強化、§6.9「副次効果」表現禁止)
- `docs/instructions/M3-01-tag-feature-and-management.md`(タグ API・型定義)
- `docs/instructions/M3-02-tag-assignment-ui.md`(コンボ DTO の `tags` フィールド、`useTagsForSelector` フック)
- `docs/design/05-screen-design.md`:
  - **§5.4 コンボ一覧**(L183-236): フィルタ・ソート・表示列カスタマイズの全要求仕様
- `docs/design/03-data-model.md`:
  - **§3.4 combos テーブル定義**(L329 付近): フィルタ対象カラム(character_id、starter_move_id、position、hit_type、opponent_stance、is_draft 等)、ソート対象カラム
  - **§4 インデックス方針**: 重複判定キーのインデックスがフィルタ・ソートに使えること
- `docs/design/02-architecture.md`:
  - **§4.2 主要エンドポイント**(L135): GET /api/combos のクエリパラメータ説明
  - **§4.3 エラーハンドリング**(L149-163)
- `docs/design/supp-001-detailed-design.md` v1.9.0:
  - **§5.4 / §5.5 テスト規約**
  - **§5.9 PATCH 系省略可能フィールドの送信ポリシー**(本指示書はクエリパラメータベースのため §5.9 は直接適用されないが、状態管理の参考情報)
  - **§6.4 列挙定数同期ルール**(本指示書のソート種別・状況コード値定数で適用)
  - **§6.7 進捗管理**
- `docs/handover/design-instruction-playbook.md` v1.4.0:
  - **§4.5 フローの素直さ原則**
  - **§4.6 UI ライブラリの実態確認原則**(shadcn/ui は M7 まで未導入、本指示書は標準 HTML + Tailwind 自作)
  - **§4.7 新エラー型導入時の全ハンドラ列挙原則**(本指示書は新エラー型を導入しない、ただし方針確認用)

### 3.2 任意参照(必要時のみ参照)

- `docs/instructions/M2-03-trash-page.md`: `GET /api/combos` への `only_deleted=true` クエリパラメータ追加の先例(本指示書の §4.2.1 のテンプレート)
- `docs/design/06-validation.md`: VAL-C シリーズはフィルタ機能では発火しないが、フィルタ条件の不正値(存在しないキャラ ID 等)に対する扱いの参考
- `docs/instructions/M1-05-*.md`: コンボ一覧画面の既存実装の確認用

### 3.3 参照不要

- DES-004 内部表現仕様書(プリセット・エイリアス系、本指示書のスコープ外)
- M2-01(仮想コントローラ)、M2-04(memo 関連)指示書
- M3-04 / M3-05 指示書(後続マイルストーンのため)

### 3.4 着手前の確認

製造担当 Claude Code は §4 詳細仕様の実装に着手する前に、以下を確認する。

#### 3.4.1 M3-02 で整備された一覧 API レスポンス確認

```bash
# サーバーが起動していない場合は make run-server-debug などで起動
curl http://localhost:47318/api/combos | head -50
```

期待される確認事項:
- レスポンス形式が `{"items": [...]}` ラッパー付きであること(progress-log.md M2-01 完了報告 L41 参照)。本指示書はこの形式を維持する
- 各コンボに `tags` フィールドが含まれている(M3-02 で追加済み)
- 既存 `only_deleted=true` クエリパラメータが動作する(M2-03 で追加済み)

#### 3.4.2 既存ハンドラの実装パターン確認

```bash
# M2-03 で `only_deleted` クエリパラメータを追加した実装を確認
grep -rn 'only_deleted\|OnlyDeleted' internal/api/combo/ internal/service/combo/ internal/repository/combo/
```

期待される確認事項:
- ハンドラ層・サービス層・リポジトリ層のクエリパラメータ処理パターンが確認できる
- 本指示書の §4.2 で同じパターンを横展開する

#### 3.4.3 フィルタ対象カラムのインデックス確認

```bash
sqlite3 data/combomgr.db ".schema combos" | grep -i index
sqlite3 data/combomgr.db "SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='combos';"
```

期待される確認事項:
- DES-003 §4 インデックス方針で定義された重複判定キー複合インデックスが存在する(`character_id` / `starter_move_id` / `position` / `hit_type` / `opponent_stance` / `opponent_size` を含むインデックス)
- フィルタが想定するカラムにインデックスが効いている。**インデックスが想定と異なる場合は Plan Mode で停止して開発者に報告**

#### 3.4.4 既存のコンボ一覧画面構造の確認

```bash
ls web/src/features/combo/components/
cat web/src/features/combo/components/ComboList.tsx | head -80
```

期待される確認事項:
- `ComboList.tsx`(または相当ファイル)が存在する
- M1-05 / M2-03 完了時点の構造が確認できる
- フィルタ・ソート UI のプレースホルダーが存在するか、または未実装であることを確認する

#### 3.4.5 既存の TanStack Query フック構造確認

```bash
grep -rn 'useCombos\|queryKey.*combos' web/src/features/combo/hooks/
```

期待される確認事項:
- `useCombos` フック(または相当)が既存実装されている
- queryKey の現状構造を確認(本指示書ではフィルタ・ソート条件を queryKey に追加する)

#### 3.4.6 確認結果の報告

製造担当 Claude Code は §3.4.1〜§3.4.5 の確認コマンド出力を実装完了報告に含める。

#### 3.4.7 §4 着手の前提条件

§3.4.1〜§3.4.5 の全確認結果が期待通りであることを確認してから、§4 詳細仕様の実装に着手する。万一現状が想定と乖離する場合は Plan Mode で停止して開発者に報告する。

---

## 4. 詳細仕様

### 4.1 共通ヘルパ `browser-storage.ts` の新設

#### 4.1.1 設計思想

CLAUDE.md §10.X で許容された3用途(表示列カスタマイズ・仮想コントローラ選択保持・下書き自動保存)で共通利用される薄いヘルパ。**直接 `localStorage` を呼ぶことを禁じ、本ヘルパ経由に統一** する。これにより:

- try-catch・容量超過・プライベートブラウジング等の例外処理を一箇所に集約
- キーバージョニング(`-v1` suffix)を必須化
- JSON シリアライズ/デシリアライズの共通化
- 将来サーバー永続化に切り替える場合(フェーズ2 以降の認証本格化時)、ヘルパ実装の差し替えだけで対応可能

#### 4.1.2 ファイル構成

ファイル: `web/src/lib/browser-storage.ts`

```typescript
/**
 * ブラウザストレージ共通ヘルパ。
 *
 * CLAUDE.md §10.X で許容された3用途で利用する。直接 localStorage 等を
 * 呼ばず、本ヘルパ経由で読み書きする。
 *
 * - try-catch で容量超過・プライベートブラウジング等の例外を吸収
 * - JSON シリアライズ/デシリアライズを内蔵
 * - キーバージョニング(-v1 suffix)を必須化
 * - parse 失敗時は未保存扱い
 */

export interface StorageHelper<T> {
  /** 保存。容量超過等で失敗した場合は false を返し、エラーを console.warn する */
  save(value: T): boolean;
  /** 読込。未保存または parse 失敗の場合は null を返す */
  load(): T | null;
  /** 削除。失敗しても例外を投げない */
  remove(): void;
}

/**
 * localStorage 用のヘルパインスタンスを生成する。
 *
 * @param key キー名(必ず `-v1` 等の suffix を付与すること)
 */
export function createLocalStorageHelper<T>(key: string): StorageHelper<T>;

// 内部実装は §4.1.3 を参照
```

#### 4.1.3 実装方針

- `save`: `localStorage.setItem(key, JSON.stringify(value))` を try-catch で囲む。失敗時は `console.warn` でログ + `return false`
- `load`: `localStorage.getItem(key)` の結果を try-catch で `JSON.parse` する。getItem の null、parse 失敗のいずれも `return null`
- `remove`: `localStorage.removeItem(key)` を try-catch で囲む(失敗時は `console.warn` のみ)
- キー名の `-v1` 必須化はランタイムチェック不要(規約による拘束、レビュー観点でカバー)
- SSR 対応は不要(本アプリは SPA、`window` が常に存在する前提)

#### 4.1.4 テスト要件

`web/src/lib/browser-storage.test.ts` で以下をカバー:

- save → load の往復で値が一致
- 未保存キーの load が null を返す
- 不正な JSON が保存されている場合の load が null を返す(壊れたキャッシュからの自動回復)
- save が容量超過で失敗した場合(モック)、`return false` で console.warn が呼ばれる
- remove 後の load が null を返す

#### 4.1.5 利用例(参考、後続マイルストーン用)

```typescript
// M3-03 で使う例(表示列カスタマイズ)
const columnVisibilityStorage = createLocalStorageHelper<ColumnVisibilityState>('combo-list-columns-v1');

// M7 で使う例(仮想コントローラ選択保持)
const layoutStorage = createLocalStorageHelper<ControllerLayout>('virtual-controller-layout-v1');

// M6 で使う例(下書き自動保存、key は動的)
const draftStorage = createLocalStorageHelper<ComboFormState>(`combo-draft-${comboId ?? 'new'}-v1`);
```

### 4.2 バックエンド: `GET /api/combos` クエリパラメータ拡張

#### 4.2.1 クエリパラメータ一覧

| パラメータ | 型 | 用途 | 例 |
|----------|----|----|-----|
| `character_id` | int64 | キャラクター絞り込み | `?character_id=1` |
| `tag_ids` | int64[](カンマ区切り) | タグ絞り込み(指定タグの **いずれかを持つ** コンボ、OR 条件) | `?tag_ids=1,2,3` |
| `position` | string | ポジション絞り込み | `?position=corner` |
| `hit_type` | string | ヒット種別絞り込み | `?hit_type=counter` |
| `opponent_stance` | string | 相手姿勢絞り込み | `?opponent_stance=standing` |
| `is_draft` | bool | 仮登録フィルタ(true=仮登録のみ、false=本登録のみ、未指定=両方) | `?is_draft=true` |
| `sort` | string | ソート種別(§4.2.4 のホワイトリスト) | `?sort=damage` |
| `order` | string | ソート方向(`asc` / `desc`、未指定=`desc`) | `?order=asc` |
| `only_deleted` | bool | M2-03 で追加済み、本指示書では変更しない | `?only_deleted=true` |

複数指定可: 例 `?character_id=1&tag_ids=2,3&sort=damage&order=desc`

未指定の場合の既定値:
- フィルタ系全て: 絞り込みなし
- `sort`: `default`(始動状況ソート、§4.2.4)
- `order`: `desc`(降順)

#### 4.2.2 サービス層関数の引数拡張

`internal/service/combo/service.go` の List 関数を以下のように拡張する:

```go
type ListFilter struct {
    CharacterID    *int64       // nil=絞り込みなし
    TagIDs         []int64      // 空=絞り込みなし、要素あり=OR 条件
    Position       *string      // nil=絞り込みなし
    HitType        *string
    OpponentStance *string
    IsDraft        *bool
    OnlyDeleted    bool         // M2-03 既存、互換維持
}

type ListSort struct {
    Field string // "default" / "updated_at" / "damage" / "starter_move_id" / "drive_gauge_consumed_total" / "sa_gauge_consumed_total"
    Order string // "asc" / "desc"
}

func (s *Service) List(ctx context.Context, userID int64, filter ListFilter, sort ListSort) ([]model.ComboListItem, error)
```

ポインタ型(`*int64`、`*string`、`*bool`)は「未指定」を表現するために使用(SUPP-001 §5.9 と同じ思想だが、ここはクエリパラメータの解析時点で未指定を判定するため、フロント側の「変更時のみ送信」ポリシーは適用されない)。

#### 4.2.3 リポジトリ層の SQL 動的生成

`internal/repository/combo/repository.go` の List クエリで WHERE 句と ORDER BY 句を動的生成する。

**WHERE 句**:

- `filter.CharacterID != nil` → `AND character_id = ?` を追加
- `len(filter.TagIDs) > 0` → `AND id IN (SELECT combo_id FROM combo_tags WHERE tag_id IN (?, ?, ...))` を追加(OR 条件として複数タグのいずれかを持つコンボを取得)
- `filter.Position != nil` → `AND position = ?` を追加
- `filter.HitType != nil` → `AND hit_type = ?` を追加
- `filter.OpponentStance != nil` → `AND opponent_stance = ?` を追加
- `filter.IsDraft != nil` → `AND is_draft = ?` を追加
- 既存の `filter.OnlyDeleted` ロジックは温存(`AND deleted_at IS NOT NULL` または `AND deleted_at IS NULL`)

**ORDER BY 句(§4.2.4 のホワイトリスト適用後)**:

- `sort.Field` の値からホワイトリストにマッピングし、対応する SQL カラム名を取得
- `sort.Order` を `asc` / `desc` に正規化(その他は `desc` 既定)
- `ORDER BY <カラム名> <方向>` を追加。デフォルト sort(`default` 始動状況ソート)は `ORDER BY starter_move_id ASC, position ASC, hit_type ASC, opponent_stance ASC, opponent_size ASC, damage DESC` のような複数カラム複合ソートになる(具体は §4.2.4 で確定)

**SQL injection 対策**:

- `filter.Position` 等の文字列値は **必ずプレースホルダ `?` で渡す**(直接 SQL に埋め込まない)
- `sort.Field` と `sort.Order` は **ホワイトリスト経由でのみ SQL に埋め込む**(プレースホルダで渡せないため)。ホワイトリスト外の値は `default` / `desc` にフォールバック

#### 4.2.4 ソート種別ホワイトリスト

DES-005 §5.4 に従い、以下の6種をサポートする:

| sort 値 | DES-005 表記 | SQL 表現 | 備考 |
|--------|------------|---------|------|
| `default` | 始動状況(デフォルト) | `ORDER BY starter_move_id ASC, position ASC, hit_type ASC, opponent_stance ASC, opponent_size ASC` | 重複判定キーの主要部に沿った複合ソート。`order` パラメータは無視(常に複合ソート) |
| `updated_at` | 更新日時 | `ORDER BY updated_at <ASC|DESC>` | 「最近/昔」ラベル |
| `damage` | ダメージ | `ORDER BY damage <ASC|DESC>` | 「大きい順/小さい順」ラベル |
| `starter_move_id` | 始動技別 | `ORDER BY starter_move_id <ASC|DESC>` | move_code 表示用キー、§4.2.4 内では ID ベースでソート |
| `drive_gauge_consumed_total` | ドライブゲージ消費 | `ORDER BY drive_gauge_consumed_total <ASC|DESC>` | DES-003 §3.4 (L341) カラム名と完全一致(`_total` suffix は累計値の意。combo_steps から集計したキャッシュ、一覧ソート専用) |
| `sa_gauge_consumed_total` | SAゲージ消費 | `ORDER BY sa_gauge_consumed_total <ASC|DESC>` | DES-003 §3.4 (L342) カラム名と完全一致 |

**重要**: 上記 SQL カラム名は DES-003 §3.4 (L341-342) の combos テーブル定義と完全一致している(`drive_gauge_consumed_total` / `sa_gauge_consumed_total`、末尾 `_total` 付き)。製造担当は §3.4.3 着手前確認時に `sqlite3 .schema combos` で実カラム名を確認すること。万一カラム名が異なる場合(`_total` suffix の有無の取り違え等)は Plan Mode で停止して開発者に報告する。

ホワイトリスト実装(Go):

```go
var sortFieldWhitelist = map[string]string{
    "default":              "starter_move_id ASC, position ASC, hit_type ASC, opponent_stance ASC, opponent_size ASC",
    "updated_at":           "updated_at",
    "damage":               "damage",
    "starter_move_id":      "starter_move_id",
    "drive_gauge_consumed_total": "drive_gauge_consumed_total",
    "sa_gauge_consumed_total":    "sa_gauge_consumed_total",
}

func resolveSortClause(field, order string) string {
    sql, ok := sortFieldWhitelist[field]
    if !ok {
        return sortFieldWhitelist["default"]
    }
    if field == "default" {
        return sql // 複合ソート、order 無視
    }
    if order != "asc" && order != "desc" {
        order = "desc"
    }
    return sql + " " + strings.ToUpper(order)
}
```

#### 4.2.5 ハンドラ層の実装

`internal/api/combo/handler.go` の List ハンドラを以下のように拡張:

- クエリパラメータを Echo の `c.QueryParam("xxx")` で取得
- 空文字列の場合はポインタを `nil` のまま、値ありの場合はパース結果のポインタをセット
- `tag_ids` はカンマ区切り文字列を `strings.Split(",")` でパースし `[]int64` に変換(変換失敗のエラー値は無視せず、HTTP 400 で `INVALID_QUERY_PARAM` エラーを返す)
- `is_draft` / `only_deleted` の bool パースは `strconv.ParseBool` を使用
- パースした値で `ListFilter` / `ListSort` を組み立て、サービス層を呼ぶ

#### 4.2.6 不正値の扱い

- **存在しないキャラ ID**: フィルタ結果が空配列で返るのみ(エラーにしない)
- **存在しないタグ ID**: 同上(JOIN で結果が空)
- **存在しない `position` / `hit_type` / `opponent_stance` 値**: 同上
- **不正な `sort` 値**: ホワイトリスト外なら `default` にフォールバック(§4.2.4)
- **不正な `order` 値**: `desc` にフォールバック
- **`tag_ids` のパース失敗**(数値変換失敗): HTTP 400 + `INVALID_QUERY_PARAM`

playbook §4.5 フローの素直さ原則に従い、フィルタ条件の事前検証は実装しない(存在チェック等)。

### 4.3 フロントエンド: フィルタ・ソート UI

#### 4.3.1 ComboListFilters コンポーネント

実装ファイル: `web/src/features/combo/components/ComboListFilters.tsx`

##### 構造

DES-005 §5.4 の表示項目3「フィルタ・ソート領域」に基づき、以下の UI を1コンポーネントに集約:

- キャラクター選択プルダウン(リュウ固定 + 将来の拡張余地、M3-04 で useCharacters フックに差し替え予定だが M3-03 では `useCharacters` または既存 `CHARACTER_NAMES` 定数マップのいずれか現存方式を採用、M3-02 完了時点の状態に従う)
- タグフィルタ(複数選択可、`useTagsForSelector` フックを再利用、`excludeCategories=["mycombo_status"]` で渡す)
- 状況フィルタ(position・hit_type・opponent_stance のプルダウン、初期値は「全て」)
- 仮登録表示トグル(全て/本登録のみ/仮登録のみ の3値)
- ソート種別選択プルダウン(§4.2.4 の6種)
- 昇降ラベル(項目に応じた自然な表現、§4.3.4)
- 表示列カスタマイズメニュー(`<ColumnVisibilityMenu>` を §4.4 で実装、本コンポーネントから呼ぶ)

##### Props 設計

```typescript
interface ComboListFiltersProps {
  filters: ComboListFilters;                    // 現在のフィルタ・ソート状態(useComboListFilters の戻り値)
  onChange: (next: ComboListFilters) => void;   // 状態変更コールバック
  availableTags: Tag[];                         // useTagsForSelector の結果(mycombo_status 除外済み)
}

interface ComboListFilters {
  characterId: number | null;
  tagIds: number[];
  position: string | null;
  hitType: string | null;
  opponentStance: string | null;
  isDraft: boolean | null;                       // null=両方、true=仮登録のみ、false=本登録のみ
  sort: SortField;                               // 'default' | 'updated_at' | 'damage' | 'starter_move_id' | 'drive_gauge_consumed_total' | 'sa_gauge_consumed_total'
  order: SortOrder;                              // 'asc' | 'desc'
}

type SortField = 'default' | 'updated_at' | 'damage' | 'starter_move_id' | 'drive_gauge_consumed_total' | 'sa_gauge_consumed_total';
type SortOrder = 'asc' | 'desc';
```

##### 実装方針

- shadcn/ui は M7 まで未導入(playbook §4.6)。標準 HTML(`<select>` / `<input type="checkbox">` / `<button>`)+ Tailwind で実装する
- タグフィルタは `useTagsForSelector` の結果を `<input type="checkbox">` 群でレンダリング(本指示書ではドロップダウン式の凝った UI は不要、シンプルなチェックボックス群で十分)
- レスポンシブ: PC では横並び、スマホでは縦積み(Tailwind の `flex-col md:flex-row` 等)。スマホのボトムシート表示は M7 仕上げで対応

#### 4.3.2 useComboListFilters フック

実装ファイル: `web/src/features/combo/hooks/useComboListFilters.ts`

##### 機能要件

- フィルタ・ソート状態を **URL クエリパラメータと連動** させる(ブラウザの戻る/進むボタンで状態が遷移、URL シェアでフィルタ状態を共有可能)
- React Router の `useSearchParams` を使う(M1-05 で React Router 導入済みと仮定。未導入なら Plan Mode で確認)
- 初期値は URL クエリ → 何も指定なしの場合は既定値(全フィルタなし、sort=default、order=desc)

##### 構造例

```typescript
export function useComboListFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo<ComboListFilters>(() => {
    return {
      characterId: parseIntOrNull(searchParams.get('character_id')),
      tagIds: parseTagIds(searchParams.get('tag_ids')),
      position: searchParams.get('position'),
      hitType: searchParams.get('hit_type'),
      opponentStance: searchParams.get('opponent_stance'),
      isDraft: parseBoolOrNull(searchParams.get('is_draft')),
      sort: (searchParams.get('sort') as SortField) ?? 'default',
      order: (searchParams.get('order') as SortOrder) ?? 'desc',
    };
  }, [searchParams]);

  const updateFilters = useCallback((next: Partial<ComboListFilters>) => {
    const merged = { ...filters, ...next };
    const params = new URLSearchParams();
    if (merged.characterId !== null) params.set('character_id', String(merged.characterId));
    if (merged.tagIds.length > 0) params.set('tag_ids', merged.tagIds.join(','));
    if (merged.position !== null) params.set('position', merged.position);
    if (merged.hitType !== null) params.set('hit_type', merged.hitType);
    if (merged.opponentStance !== null) params.set('opponent_stance', merged.opponentStance);
    if (merged.isDraft !== null) params.set('is_draft', String(merged.isDraft));
    if (merged.sort !== 'default') params.set('sort', merged.sort);
    if (merged.order !== 'desc') params.set('order', merged.order);
    setSearchParams(params);
  }, [filters, setSearchParams]);

  return { filters, updateFilters };
}
```

`null` 値・空配列・既定値はクエリパラメータに含めない(URL を短く保つ)。

##### useCombos との連携

`useCombos` フック(または相当)の queryKey にフィルタ・ソート条件を含める:

```typescript
const filtersKey = useMemo(() => ({
  character_id: filters.characterId,
  tag_ids: filters.tagIds,
  position: filters.position,
  hit_type: filters.hitType,
  opponent_stance: filters.opponentStance,
  is_draft: filters.isDraft,
  sort: filters.sort,
  order: filters.order,
}), [filters]);

const combosQuery = useQuery({
  queryKey: ['combos', 'list', filtersKey],
  queryFn: () => comboApi.list(filtersKey),
});
```

#### 4.3.3 状況コード値マスタの取り扱い(定数ハードコード確定)

DES-005 §5.4 のフィルタは `position` / `hit_type` / `opponent_stance` の3種を扱う。これらの取り得る値は OPEN-001(DES-003 §6)で「実装時に協同決定」と保留されていたが、本指示書で **定数ハードコード方式で確定**(2026-05-10 開発者確定)。

##### 確定理由

- 状況コード値はゲーム仕様で決まっており動的取得(`SELECT DISTINCT ...`)は過剰
- フロント側で「全て」「画面端」「中央」のような表示ラベル付けが必要(DB 値だけでは UI に出せない)
- 定数化することで M3-04 マイコンボタブ・M5 比較系でも再利用可能
- CLAUDE.md §4 / SUPP-001 §6.4 の列挙定数同期ルールに従い、バックエンド・フロント両側に対応する定数を定義する

##### 実装方針

**バックエンド側**(Go 定数):

`internal/model/combo.go`(または既存の combo モデル定義場所)に以下を追加:

```go
// Position は対戦位置の取り得る値。DES-003 §6 OPEN-001 の確定値として M3-03 で導入。
const (
    PositionAny     = "any"     // 位置不問
    PositionCenter  = "center"  // 中央
    PositionCorner  = "corner"  // 画面端
    // 追加候補(midscreen 等)。§4.3.3 着手前確認で既存 seed の DISTINCT 値を取得し、本リストに含まれない値が検出された場合は Plan Mode で追加判断する
)

const (
    HitTypeNormal         = "normal"          // 通常ヒット
    HitTypeCounter        = "counter"         // カウンターヒット
    HitTypePunishCounter  = "punish_counter"  // パニッシュカウンター
    // 将来 CHANGE-006 が予告したガード破壊系(guard_break / crush_counter)が確定したら追加
)

const (
    OpponentStanceAny      = "any"       // スタンス不問
    OpponentStanceStanding = "standing"  // 立ち
    OpponentStanceCrouching = "crouching" // しゃがみ
    OpponentStanceJumping  = "jumping"   // ジャンプ中
    // 追加候補(airborne 等)。追加判断は §4.3.3 着手前確認の DISTINCT 値結果を参照
)
```

**フロントエンド側**(TypeScript 定数):

`web/src/constants/combo-list.ts` に対応する定数を定義し、フィルタ UI で参照する:

```typescript
export const POSITION_VALUES = ['any', 'center', 'corner'] as const;
export type Position = typeof POSITION_VALUES[number];

export const POSITION_LABELS: Record<Position, string> = {
  any: '位置不問',
  center: '中央',
  corner: '画面端',
};

export const HIT_TYPE_VALUES = ['normal', 'counter', 'punish_counter'] as const;
export type HitType = typeof HIT_TYPE_VALUES[number];

export const HIT_TYPE_LABELS: Record<HitType, string> = {
  normal: '通常ヒット',
  counter: 'カウンターヒット',
  punish_counter: 'パニッシュカウンター',
};

export const OPPONENT_STANCE_VALUES = ['any', 'standing', 'crouching', 'jumping'] as const;
export type OpponentStance = typeof OPPONENT_STANCE_VALUES[number];

export const OPPONENT_STANCE_LABELS: Record<OpponentStance, string> = {
  any: 'スタンス不問',
  standing: '立ち',
  crouching: 'しゃがみ',
  jumping: 'ジャンプ中',
};
```

##### 着手前確認の追加項目

製造担当は §3.4 着手前確認に加えて、既存 seed データに含まれる状況コード値を確認する:

```bash
sqlite3 data/combomgr.db "SELECT DISTINCT position FROM combos WHERE deleted_at IS NULL;"
sqlite3 data/combomgr.db "SELECT DISTINCT hit_type FROM combos WHERE deleted_at IS NULL;"
sqlite3 data/combomgr.db "SELECT DISTINCT opponent_stance FROM combos WHERE deleted_at IS NULL;"
```

期待動作:

- 上記コマンドで取得された値が、§4.3.3 で定義した定数の `xxx_VALUES` 配列に **すべて含まれている** こと
- 含まれていない値が seed に存在する場合、Plan Mode で停止して開発者に報告し、定数追加 or seed 修正を協議する
- seed に値が存在しない(空)場合は §4.3.3 の定数定義をそのまま使う

##### フィルタ UI での表示

`ComboListFilters.tsx`(§4.3.1)の状況フィルタ部分は、上記 LABELS を使って `<select>` のオプションを生成:

```tsx
<select value={filters.position ?? ''} onChange={(e) => updateFilters({ position: e.target.value || null })}>
  <option value="">全て</option>
  {POSITION_VALUES.map((v) => (
    <option key={v} value={v}>{POSITION_LABELS[v]}</option>
  ))}
</select>
```

##### マイコンボタブ・比較系での再利用

M3-04 マイコンボタブ・M5 比較系で同じ定数を `import` して再利用すること。これにより表示ラベルの統一が保たれる。

#### 4.3.4 昇降ラベルの表現

DES-005 §5.4 で「昇降ラベルは項目に応じた自然な表現」と指示されている。本指示書では以下の対応表で実装する:

| sort | asc ラベル | desc ラベル |
|------|-----------|------------|
| `default` | (ラベル不要、複合ソート) | (同) |
| `updated_at` | 昔 | 最近 |
| `damage` | 小さい順 | 大きい順 |
| `starter_move_id` | 始動技 ID 小 | 始動技 ID 大 |
| `drive_gauge_consumed_total` | 消費少 | 消費多 |
| `sa_gauge_consumed_total` | 消費少 | 消費多 |

これらは `web/src/constants/combo-list.ts` で定数化する(SCREAMING_SNAKE_CASE は不要、オブジェクトリテラル):

```typescript
export const SORT_FIELD_LABELS: Record<SortField, { asc: string; desc: string; default?: string }> = {
  default: { asc: '', desc: '', default: '始動状況順' },
  updated_at: { asc: '昔', desc: '最近' },
  damage: { asc: '小さい順', desc: '大きい順' },
  starter_move_id: { asc: '始動技 ID 小', desc: '始動技 ID 大' },
  drive_gauge_consumed_total: { asc: '消費少', desc: '消費多' },
  sa_gauge_consumed_total: { asc: '消費少', desc: '消費多' },
};
```

### 4.4 フロントエンド: 表示列カスタマイズ UI

#### 4.4.1 ColumnVisibilityMenu コンポーネント

実装ファイル: `web/src/features/combo/components/ColumnVisibilityMenu.tsx`

##### 機能要件

- 一覧画面の各列(始動状況・ダメージ・ルート・タグ・登録状態・備考)に対して表示/非表示を切り替えるメニュー
- メニューは ComboListFilters 領域のどこかに配置(歯車アイコン → ポップオーバー、または「表示列」ボタン → ドロップダウン)
- 設定変更は即座に一覧表示に反映(状態を親が `useColumnVisibility` で管理、本コンポーネントは presentational)
- 「リセット」ボタンで全列表示の既定状態に戻す

##### Props 設計

```typescript
interface ColumnVisibilityMenuProps {
  visibility: ColumnVisibility;
  onChange: (next: ColumnVisibility) => void;
  onReset: () => void;
}

interface ColumnVisibility {
  starterSituation: boolean;   // 始動状況
  damage: boolean;
  recipe: boolean;             // ルート(レシピ)
  tags: boolean;
  draftStatus: boolean;        // 登録状態
  memo: boolean;               // 備考
}
```

DES-005 §5.4 に挙げられた表示項目から、本指示書 §1.3 で除外した「展開アイコン(セットプレイ用)」「コピーアイコン」「編集アイコン」「削除アイコン」を除いた6列をカスタマイズ対象とする。

##### 実装方針

- shadcn/ui は使わない(playbook §4.6)。標準 HTML の `<input type="checkbox">` + Tailwind の `<details>` または `<button>` + 自作ポップオーバーで実装
- ポップオーバーの外側クリックで閉じる挙動は M2-02 `DuplicateRealtimeWarning.tsx` のパターンを再利用、または `react-aria` 等の最小ライブラリ。新規依存追加が必要な場合は Plan Mode で開発者確認

#### 4.4.2 useColumnVisibility フック

実装ファイル: `web/src/features/combo/hooks/useColumnVisibility.ts`

##### 機能要件

- 表示列の表示/非表示状態を **localStorage に永続化**(CLAUDE.md §10.X 許容用途1)
- 共通ヘルパ `browser-storage.ts`(§4.1)経由で読み書き
- キー名: `combo-list-columns-v1`(CLAUDE.md §10.X §3.1.1 で確定済み)

##### 構造

```typescript
import { createLocalStorageHelper } from '@/lib/browser-storage';

const STORAGE_KEY = 'combo-list-columns-v1';

const DEFAULT_VISIBILITY: ColumnVisibility = {
  starterSituation: true,
  damage: true,
  recipe: true,
  tags: true,
  draftStatus: true,
  memo: true,
};

const storage = createLocalStorageHelper<ColumnVisibility>(STORAGE_KEY);

export function useColumnVisibility() {
  const [visibility, setVisibility] = useState<ColumnVisibility>(() => {
    return storage.load() ?? DEFAULT_VISIBILITY;
  });

  const updateVisibility = useCallback((next: ColumnVisibility) => {
    setVisibility(next);
    storage.save(next);
  }, []);

  const resetVisibility = useCallback(() => {
    setVisibility(DEFAULT_VISIBILITY);
    storage.remove();
  }, []);

  return { visibility, updateVisibility, resetVisibility };
}
```

##### 互換性の考慮

- localStorage に保存された値が古い構造(将来カラム追加で構造変更)の場合、parse は成功するが新カラムが undefined になる可能性がある
- 対策: load 後に `{ ...DEFAULT_VISIBILITY, ...stored }` でマージし、新カラムが追加されていれば既定値で埋める

```typescript
const loaded = storage.load();
const merged = loaded ? { ...DEFAULT_VISIBILITY, ...loaded } : DEFAULT_VISIBILITY;
```

将来カラム削除時は `-v2` のように suffix を更新して新キーで保存し直す(旧キーは無視されて自然消滅)。

#### 4.4.3 ComboTableRow への反映

実装ファイル: `web/src/features/combo/components/ComboTableRow.tsx`(または相当)

`useColumnVisibility` の結果を受け取り、各列を `visibility.xxx === true` のときのみ描画する。

```typescript
// 親コンポーネント(ComboList.tsx)で
const { visibility } = useColumnVisibility();

// ComboTableRow に props で渡す
<ComboTableRow combo={combo} visibility={visibility} />

// ComboTableRow 内で
{visibility.starterSituation && <td>...</td>}
{visibility.damage && <td>{combo.damage}</td>}
// ...
```

ヘッダ行 `<thead>` の `<th>` も同様に visibility で制御する(列表示と整合させる)。

### 4.5 設計判断事項(本指示書で確定済み)

以下は本指示書で確定済みの設計判断。製造担当 Claude Code は推測で別案を選ばない。

| 項目 | 確定内容 | 根拠 |
|------|---------|------|
| 共通ヘルパの新設 | `web/src/lib/browser-storage.ts` を新設 | CLAUDE.md §10.X、M3-overview §3.3 |
| キー命名 | `combo-list-columns-v1` | CLAUDE.md §10.X §3.1.1 |
| フィルタ・ソート状態の永続化 | URL クエリパラメータ(localStorage 不使用) | URL シェア・ブラウザ履歴連携の利点、表示列カスタマイズ(localStorage)とは別の関心 |
| 表示列カスタマイズの永続化 | localStorage(`browser-storage.ts` 経由) | CLAUDE.md §10.X 許容用途1 |
| クエリパラメータ拡張 | 既存 `GET /api/combos` を拡張、新規 API 追加なし | M3-overview §3.3、M2-03 only_deleted と同パターン |
| SQL injection 対策 | フィルタ値はプレースホルダ、ソートはホワイトリスト | §4.2.3 / §4.2.4 |
| ソート種別 | DES-005 §5.4 の6種(default/updated_at/damage/starter_move_id/drive_gauge_consumed_total/sa_gauge_consumed_total) | DES-005 §5.4、DES-003 §3.4 (L341-342) |
| 昇降ラベル | §4.3.4 の対応表 | DES-005 §5.4「項目に応じた自然な表現」 |
| 状況コード値マスタの取扱 | **定数ハードコード確定**(2026-05-10 開発者確定)。バックエンド `internal/model/combo.go` + フロント `web/src/constants/combo-list.ts` で同期定義。§4.3.3 参照 | OPEN-001、CLAUDE.md §4 列挙定数同期ルール |
| タグフィルタの組合せ | OR(指定タグのいずれかを持つコンボ) | DES-005 §5.4「タグフィルタ(複数選択可)」、AND は将来要件で別 CHANGE 通知書で対応 |
| キャラ選択 UI | M3-03 着手時点の現存実装(`useCharacters` または `CHARACTER_NAMES` 定数マップ)に従う | M3-04 で useCharacters フック化が予定されているため、本指示書ではどちらでも可 |
| shadcn/ui の使用 | 不使用、標準 HTML + Tailwind 自作 | playbook §4.6、M7 統一導入予定 |
| 表示列カスタマイズ対象 | 6列(始動状況・ダメージ・ルート・タグ・登録状態・備考) | DES-005 §5.4、§1.3 で除外した列を除く |

---

## 5. テスト要件

### 5.1 必須テスト

#### 5.1.1 共通ヘルパテスト(必須)

`web/src/lib/browser-storage.test.ts` で以下を網羅:

- save → load の往復で値が一致(プリミティブ型・オブジェクト・配列)
- 未保存キーの load が null を返す
- 不正な JSON が保存されている場合の load が null を返す
- save が容量超過で失敗(`localStorage.setItem` をモックして QuotaExceededError を投げる)→ `return false` + console.warn 確認
- remove 後の load が null を返す
- save が成功した値の前後で他のキーに影響しない(複数キー併存の確認)

#### 5.1.2 バックエンド: サービス層テスト(必須)

`internal/service/combo/service_test.go` で以下を **追加**:

- **List with no filter**: 既存全件取得が動作(回帰)
- **List with character_id**: 指定キャラのコンボのみ
- **List with tag_ids**: 指定タグ(OR 条件)を持つコンボのみ
- **List with position / hit_type / opponent_stance**: 各状況コード値で絞り込み
- **List with is_draft=true**: 仮登録のみ
- **List with is_draft=false**: 本登録のみ
- **List with combined filters**: 複数フィルタの AND 動作
- **List with sort=damage order=desc**: 降順ソート
- **List with sort=damage order=asc**: 昇順ソート
- **List with sort=default**: 複合ソート(始動状況)
- **List with invalid sort**: ホワイトリスト外なら default にフォールバック
- **List with only_deleted=true (M2-03 既存)**: 回帰確認

#### 5.1.3 バックエンド: ハンドラ層テスト

`internal/api/combo/handler_test.go` で以下を追加:

- 各クエリパラメータの正常系(各1件以上)
- `tag_ids=1,2,3` のカンマ区切りパース動作
- `tag_ids=abc` の不正値 → 400 + INVALID_QUERY_PARAM
- 複数クエリパラメータの組合せ
- 既存テスト(`only_deleted` 等)の回帰

#### 5.1.4 フロントエンド: コンポーネントテスト

- `ComboListFilters.test.tsx`:
  - 各フィルタ UI(キャラ・タグ・状況・仮登録)の onChange が正しい引数で発火
  - ソート種別変更で onChange 発火
  - 昇降ラベルが選択中ソート種別に応じて表示される
- `ColumnVisibilityMenu.test.tsx`:
  - 各列のチェックボックス切替で onChange 発火
  - リセットボタンで onReset 発火
- `useComboListFilters.test.ts`(または同等):
  - URL クエリパラメータからの復元が正しい
  - updateFilters で URL が更新される
  - 既定値はクエリに含まれない
- `useColumnVisibility.test.ts`:
  - 初期 mount 時に localStorage から復元
  - updateVisibility で localStorage に保存される
  - resetVisibility で localStorage が削除される
  - 古い構造の保存値が既定値とマージされる

### 5.2 E2E シナリオ

開発者が実機ブラウザで以下を順に実行し、すべて通ることを確認する。

```
## E2E シナリオ

### A. フィルタ動作
1. /combos でコンボ一覧を開く(複数のキャラ・タグ・状況のコンボが登録済みの状態)
2. キャラクター選択プルダウンで「リュウ」を選択 → リュウのコンボのみ表示される
3. タグフィルタで「初心者向け」を選択 → リュウかつ「初心者向け」タグのコンボのみ表示
4. 仮登録トグルで「仮登録のみ」 → リュウかつ「初心者向け」かつ仮登録のコンボのみ表示
5. 状況フィルタで position を選択 → さらに絞り込み
6. URL に `?character_id=...&tag_ids=...&position=...&is_draft=true` が反映されている
7. ブラウザの戻るボタンで前のフィルタ状態に戻る
8. URL を直接コピーして別タブで開く → 同じフィルタ状態で表示される

### B. ソート動作
9. ソート種別を「ダメージ」「大きい順」に変更 → ダメージ降順で並び替え
10. ソート種別を「更新日時」「最近」に変更 → 最近更新されたコンボが上に
11. ソート種別を「始動状況(デフォルト)」に戻す → 複合ソートで表示

### C. 表示列カスタマイズ
12. 「表示列」メニューを開く → 6列のチェックボックス
13. 「ルート」のチェックを外す → 一覧からルート列が消える、ヘッダの「ルート」も消える
14. 「タグ」「備考」のチェックを外す → さらに列が消える
15. ページをリロード → 列の表示状態が復元される(localStorage 永続化確認)
16. 別タブで /combos を開く → 同じ列状態で表示される(同一ブラウザ内同期)
17. 「リセット」ボタン → 全列表示の既定状態に戻る、localStorage がクリアされる

### D. 容量超過時の挙動(任意確認)
18. ブラウザ DevTools で localStorage を強制的に容量超過状態にする(モック困難な場合スキップ可)
19. 列表示を切り替え → コンソールに warning が出るが、UI の動作自体は維持される(セッション内では切替後の状態を維持、リロード後は既定値に戻る)

### E. 不正なクエリパラメータ
20. URL に `?tag_ids=abc` を直接入力 → API は 400 を返す、フロントは適切なエラー表示
21. URL に `?sort=unknown_field` を直接入力 → ホワイトリスト外なら API は default にフォールバックして結果を返す

### F. 既存機能の回帰
22. M2-03 のゴミ箱画面が正常動作(`?only_deleted=true` クエリが従来通り効く)
23. M3-02 のタグ列が実データ表示されている(回帰確認)
```

これが見えるまで DoD 不達成。

---

## 6. レビュー観点(別ファイル参照)

レビュー観点は以下のチェックリストに記載する: `docs/instructions/reviews/M3-03-review-checklist.md`

製造担当 Claude Code は本ファイルを読む必要はない。本指示書本体に集中する。

---

## 7. 完了条件(Definition of Done)

### 7.1 機能要件

- [ ] §2.1 のファイル一覧が全て作成されている
- [ ] §2.2 のファイル修正が実施されている
- [ ] 共通ヘルパ `browser-storage.ts` が新設され、try-catch・JSON シリアライズ・キーバージョニングが集約されている
- [ ] フィルタ4種(キャラ・タグ・状況・仮登録)が動作する
- [ ] ソート6種が動作する
- [ ] 表示列カスタマイズ6列が動作し、localStorage に永続化される
- [ ] URL クエリパラメータ連動でブラウザ戻る/進む・URL シェアが動作する
- [ ] §5.2 E2E シナリオ A〜F が全て通過する

### 7.2 自己テスト結果(製造担当の責任範囲)

**バックエンド側**:

- [ ] `make test` または `go test ./...` が全通過する
- [ ] 主要 API を `curl` で叩き、レスポンスを報告書に貼付する:
  - `curl 'http://localhost:47318/api/combos?character_id=1'` → リュウのコンボ
  - `curl 'http://localhost:47318/api/combos?tag_ids=1,2'` → タグ ID 1 か 2 を持つコンボ
  - `curl 'http://localhost:47318/api/combos?sort=damage&order=desc'` → ダメージ降順
  - `curl 'http://localhost:47318/api/combos?sort=default'` → 始動状況複合ソート
  - `curl 'http://localhost:47318/api/combos?character_id=1&tag_ids=1&is_draft=true'` → 複合フィルタ
  - `curl 'http://localhost:47318/api/combos?tag_ids=abc'` → 400 + INVALID_QUERY_PARAM
  - `curl 'http://localhost:47318/api/combos?sort=unknown'` → 200(default フォールバック)
  - `curl 'http://localhost:47318/api/combos?only_deleted=true'` → 200(M2-03 回帰)
- [ ] §3.4.6 着手前確認の出力を含める

**フロントエンド側**:

- [ ] `cd web && pnpm test` が全通過する
- [ ] `cd web && pnpm build` が成功する
- [ ] TypeScript の型エラーが残っていない
- [ ] 開発サーバー起動時にコンソール警告が新規発生していない
- [ ] 開発者向けの「動作確認手順書」を実装完了報告に含める

ブラウザでの実機動作確認・スクリーンショット取得は **開発者の責任範囲**。

### 7.3 品質チェック

- [ ] CLAUDE.md の禁止事項(§10 本ルールの目的を踏まえて判断)に抵触していない
- [ ] **JSON タグ・API DTO 型が camelCase で統一されている**(CLAUDE.md §4)
- [ ] **localStorage 使用が CLAUDE.md §10.X 許容範囲内**(`combo-list-columns-v1` のみ、それ以外の用途で使用していない)
- [ ] **localStorage への直接アクセスが本指示書で新設した `browser-storage.ts` ヘルパ経由のみ**(各機能から `localStorage.setItem`/`getItem` を直接呼んでいない)
- [ ] **キーバージョニング(`-v1` suffix)が遵守されている**
- [ ] **列挙的文字列定数(ソート種別、状況コード値等)がフロント側で定数化** されている(リテラル文字列の散在なし)。バックエンド側にも対応定数があるか確認(CLAUDE.md §4 / SUPP-001 §6.4)
- [ ] `console.log` / `fmt.Println` を本番コードに残していない(`browser-storage.ts` の `console.warn` は意図的な実装、許容)
- [ ] 設計書本体(DES-005 §5.4、DES-003 §3.4 / §4)と実装が一致している
- [ ] **playbook §4.5「フローの素直さ原則」に抵触していない**
- [ ] **playbook §4.6「UI ライブラリの実態確認原則」に従い、shadcn/ui を使用していない**
- [ ] SQL injection 対策(プレースホルダ + ホワイトリスト)が §4.2.3 / §4.2.4 通り実装されている

### 7.4 ドキュメント

- [ ] `docs/progress/progress-log.md` に M3-03 完了報告を追記する
- [ ] 共通ヘルパ `browser-storage.ts` の新設事実、M6 / M7 で再利用される共有資産であることを明記
- [ ] §3.4 着手前確認結果を含める

### 7.5 完了報告

- [ ] 開発者に「M3-03 が完了しました」と報告
- [ ] §7.1〜§7.4 の自己テスト結果を報告書に含める

---

## 8. 参照ドキュメント

| ID | パス | 関連節 |
|----|------|-------|
| CLAUDE.md | `CLAUDE.md` | **§4 JSON タグ camelCase / 列挙定数同期**、§10 禁止事項、**§10.X ブラウザストレージ運用ルール** |
| M3-overview | `docs/instructions/M3-overview.md` | §3.3 M3-03 スコープ、§6 運用ルール |
| M3-01 指示書 | `docs/instructions/M3-01-tag-feature-and-management.md` | タグ API |
| M3-02 指示書 | `docs/instructions/M3-02-tag-assignment-ui.md` | コンボ DTO の tags フィールド |
| M2-03 指示書 | `docs/instructions/M2-03-trash-page.md` | only_deleted クエリパラメータ追加先例 |
| DES-002 | `docs/design/02-architecture.md` | §4.2 GET /api/combos、§4.3 エラーハンドリング |
| DES-003 | `docs/design/03-data-model.md` | **§3.4 combos テーブル定義**、**§4 インデックス方針** |
| DES-005 | `docs/design/05-screen-design.md` | **§5.4 コンボ一覧 フィルタ・ソート・表示列カスタマイズ(L183-236)** |
| DES-006 | `docs/design/06-validation.md` | フィルタ機能では VAL 系発火しない、参考のみ |
| SUPP-001 v1.9.0 | `docs/design/supp-001-detailed-design.md` | §5.4 / §5.5 テスト規約、§5.9 PATCH 送信ポリシー(参考)、**§6.4 列挙定数同期ルール**、§6.7 進捗管理 |
| playbook v1.4.0 | `docs/handover/design-instruction-playbook.md` | **§4.5 素直さ原則**、**§4.6 UI ライブラリ実態確認**、§4.7 全ハンドラ列挙原則(参考) |

---

## 9. 注意事項・判断に迷ったら

### 9.1 推測で進めてはいけない事項(Plan Mode 必須項目)

本指示書は **Plan Mode 必須**(複数の関心が絡み、共通ヘルパを新設するため)。Plan Mode で以下を必ず開発者に提示する:

- §3.4.1〜§3.4.5 の着手前確認結果
- §4.3.3 着手前確認(既存 seed の状況コード値が定数定義に含まれているか)の結果
- §4.3.1 キャラ選択 UI の現存実装(`useCharacters` か `CHARACTER_NAMES` か)の確認結果
- §3.4.3 で fixtures カラム名が DES-003 と一致しなかった場合の対処
- §3.4.4 で React Router 未導入の場合の対処(URL クエリパラメータ連動の代替)
- ColumnVisibilityMenu の外側クリック検知パターン(M2-02 既存パターン再利用 vs 新規実装)
- 実装順序(BE: ハンドラ → サービス → リポジトリ → テスト → FE: browser-storage → useColumnVisibility → useComboListFilters → ComboListFilters → ColumnVisibilityMenu → ComboList 統合)

### 9.2 推測で進めてよい事項(その旨を明示)

以下は推測で進めてよいが、実装時に「推測:〜と仮定した」とコード内コメントまたは PR 説明に明示する:

- フィルタ UI のレイアウト細部(プルダウンの幅、配置、Tailwind クラス)
- 昇降ラベルの色・アイコン(矢印 ▲/▼ 等の装飾)
- ColumnVisibilityMenu のポップオーバー位置(ボタンの直下/直上等)
- localStorage 容量超過時の console.warn メッセージ文言

### 9.3 不明事項発見時の対応

- 設計書本体(DES-002 §4.2 / DES-003 §3.4 §4 / DES-005 §5.4)と本指示書の記述が乖離している場合 → 実装を止めて開発者に報告し、CHANGE 通知書起票要否を協議する
- §4.3.3 着手前確認で既存 seed に未定義の状況コード値が見つかった場合 → Plan Mode で開発者と協議し、定数追加 or seed 修正のいずれかを決定する
- 本指示書の §4 詳細仕様で具体化されていない実装判断が必要になった場合 → §9.2 の範囲なら推測で進めて明示、それ以外は Plan Mode で開発者確認

### 9.4 Plan Mode で計画提示時に含めるべき項目

Plan Mode 必須(§9.1)。計画には以下を含める:

- §3.4 着手前確認の結果(全5項目)
- §4.3.3 着手前確認(既存 seed の状況コード値確認)の結果
- 実装順序(BE → FE、特に共通ヘルパを早期に新設して useColumnVisibility が利用可能な状態を作る)
- テスト戦略(共通ヘルパ単体テスト + 各層のテスト + E2E シナリオ)
- §5.2 E2E シナリオ A〜F の各ステップを通すための前提データ準備手順

### 9.5 新エラー型を導入する場合の確認(playbook §4.7)

本指示書では新エラー型 `INVALID_QUERY_PARAM`(HTTP 400)の **新設** を含む。playbook §4.7 に従い、このエラーが発火する全ハンドラを以下に列挙:

- `internal/api/combo/handler.go` の List ハンドラ(本指示書で扱う唯一のハンドラ)

他の API ハンドラ(POST/PATCH/DELETE 等)では発火しない。本エラーはクエリパラメータパース失敗時のみ。

製造担当は実装時、`grep -rn 'INVALID_QUERY_PARAM' internal/` で確認し、List ハンドラ以外で発火する経路がないことを確認する。

---

## 10. 完了後の次ステップ

M3-03 完了後、開発者の動作確認・承認を経て M3-04(useCharacters フック化 + マイコンボタブ追加)に進む。M3-04 では本指示書で完成したフィルタ機構を再利用し、`mycombo_status` カテゴリ系での絞り込みビュー(マイコンボタブ)を追加する。あわせて持ち越し課題1(`CHARACTER_NAMES` 定数マップ → useCharacters フック差し替え)を解消する。

本指示書で新設した `browser-storage.ts` 共通ヘルパは M6(下書き自動保存)・M7(仮想コントローラ選択保持)で再利用される。後続マイルストーン担当者は CLAUDE.md §10.X §3.3 の共通実装ガイドラインに従って利用すること。

---

*以上*

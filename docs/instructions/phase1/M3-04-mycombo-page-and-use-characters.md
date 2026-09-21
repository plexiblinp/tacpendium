# 指示書 M3-04: useCharacters フック化 + マイコンボ画面追加(別画面方式)

| 項目 | 内容 |
|------|------|
| 指示書ID | M3-04 |
| バージョン | 1.0.4 |
| 対象マイルストーン | M3(マイコンボ系) |
| 推奨モデル | **Sonnet 4.6** |
| Plan Mode | **任意**(マイコンボ画面の上振れ要素 §4.5 の組込判断は Plan Mode で開発者協議すると安全) |
| 機械レビュー | **必須**(別チェックリスト: `docs/instructions/reviews/M3-04-review-checklist.md`) |
| 並列性 | **単独**(M3 は完全直列、M3-03 完了が前提) |
| 依存指示書 | M3-01(タグ機能 + usage_count API)、M3-02(コンボへのタグ付与・コンボ DTO の tags フィールド)、M3-03(共通ヘルパ browser-storage.ts、useComboListFilters、列挙定数同期パターン) |
| 想定所要時間 | 210〜300 分(character API + マイコンボ画面 + 3 経路のステータス変更 UI + 上振れ要素を含む) |
| 作成者 | 詳細設計・製造準備担当Claude(M3 期間担当) |
| 作成日 | 2026-05-10 |
| 更新日 | 2026-05-10 |

## 更新履歴

| バージョン | 更新日 | 更新内容 |
|-----------|--------|----------|
| 1.0.0 | 2026-05-10 | 初版作成 |
| 1.0.1 | 2026-05-10 | M3-04 製造担当からの指摘(2026-05-10)を反映。**character API ハンドラの新規実装を本マイルストーンのスコープに追加**。指示書 v1.0.0 で「M1-02 で実装済み」と記述していた `GET /api/games/{id}/characters` ハンドラが実態として未実装であったため(DES-002 §4.2 L133 でエンドポイント定義はあるが実装が伴っていなかった、M2-02 で `CHARACTER_NAMES` 定数マップが導入された経緯からも未実装が裏付けられる)、本マイルストーン内で M1-03 コンボ系3層パターンを踏襲した新規実装を追加。修正箇所: §1.2 目的、§2.1 / §2.2 / §2.3 / §2.4 成果物、§3.4 着手前確認(API パス・テーブル DDL・seed 確認)、§4 詳細仕様に §4.0 character API ハンドラ実装節を新設、§4.9 設計判断事項表、§5.1 テスト要件、§7.1 / §7.2 / §7.3 完了条件、§9.1 推測で進めてはいけない事項、想定所要時間(90〜120 分 → 120〜165 分)。設計書本体・DB マイグレーションは変更なし、CHANGE 通知書不要(DES-002 §4.2 L133 で既定の API を正式実装するのみ)。**設計担当の指示書執筆ミス**: 「設計書本体に書かれている = 実装済み」という思い込みで実態確認を怠ったもの。playbook §4.6「UI ライブラリ実態確認原則」が新エラー型・新画面・新エンドポイントにも応用されるべき場面で、適用できていなかった。m3-to-m4-handover で類似反省パターンとして集中記録する |
| 1.0.2 | 2026-05-10 | **retrospective 記録のみ、本文は変更なし**。M3-04 製造・レビュー・取り込み完了後に、製造担当から連絡された設計担当の指示書執筆ミス事項を本書の歴史記録として残す。**`mycombo_status` リテラル文字列の散在範囲が指示書の想定より広かった**: M3-04 指示書 §4.6 では `in_use` / `practicing` / `reduced` の3値の定数化のみに焦点を当てていたが、より上位のカテゴリ値 `"mycombo_status"` 自体が M3-01 で導入された `model.TagCategoryMyComboStatus` 定数に対応するフロント定数として未作成のままだった。レビューで H-1(リテラル散在)として指摘され、製造担当が `TAG_CATEGORY_MYCOMBO_STATUS` 定数を `web/src/constants/mycombo.ts` に追加し、6 ファイル(`useMyComboStatusCounts.ts` / `MyComboPage.tsx`(M3-04 新規)、`ComboListPage.tsx` / `ComboTableRow.tsx`(M3-03 由来)、`ComboEditorBasicFields.tsx`(M3-02 由来))のリテラル参照を置換した。**根本原因**: CLAUDE.md §4 / SUPP-001 §6.4 に列挙定数同期ルールは明文化されていたが、指示書執筆時のセルフチェック手順が不足していたため、M3-01 で `model.TagCategoryMyComboStatus` を導入した時点でフロント側定数作成指示を組み込めていなかった。**再発防止**: playbook v1.5.0 §4.8「列挙定数の即時同期原則」を新設(指示書執筆時の機械的 grep チェック手順、遡及定数化の判断基準、対象典型例の体系化)、CLAUDE.md §4 / SUPP-001 §6.4 v1.10.0 に grep コマンド例を追加。M3-01 指示書 v1.0.1 にも retrospective 記録を追加(根本原因の所在地として)。**重要**: 本書の §4 / §5 本文は意図的に修正しない。製造担当・レビュー担当が見ていた v1.0.1 と乖離させずトレーサビリティを維持するため(M3-02 v1.0.2 / M3-03 v1.0.2 と同じ retrospective 方式)。詳細は m3-to-m4-handover.md(M3 完了時に作成予定)に記録 |
| 1.0.3 | 2026-05-10 | M3-04 E2E 実施中に製造担当からの指摘(2026-05-10)を反映。**マイコンボ画面ステータス変更 UI の新規実装を本マイルストーンのスコープに追加**。指示書 v1.0.0〜v1.0.2 で §1.3「マイコンボ画面内でのコンボ編集・新規登録の特殊フローは作らない、既存のコンボ編集画面への遷移で完結」と書いたが、これは設計担当の判断ミス。M3-02 で「コンボ編集画面の TagSelector では `mycombo_status` カテゴリを除外する」と確定したのに、それを付与する経路を M3-04 で実装する責務を明示しなかった結果、マイコンボ画面が機能不全(コンボにマイコンボステータスを付与する UI が存在せず E2E 実施不可)になった。**追加実装内容**: マイコンボ画面のコンボ一覧テーブル各行末尾にステータス変更プルダウン(`<select>`)を追加。選択肢は「使用中 / 練習中 / 頻度低下 / マイコンボから外す」の4種。バックエンドは M3-02 で実装済みの `PATCH /api/combos/:id` を流用、新規 API 追加なし。修正箇所: §1.2 目的、§1.3「作らないもの」(マイコンボステータス変更 UI 除外を削除)、§2.1 作成ファイル(MyComboStatusSelector.tsx 等)、§4 詳細仕様に §4.10 マイコンボステータス変更 UI 仕様を新設、§4.9 設計判断事項表、§5.1 テスト要件、§5.2 E2E シナリオ H 追加、§7.1 / §7.2 完了条件、想定所要時間(120〜165 分 → 150〜210 分)。**設計担当の判断ミス記録**: §1.3 で「特殊フロー」と書いて除外したのは「新しいコンボエディタを作るような大規模 UI を作らない」意図だったが、マイコンボステータスタグ付与 UI そのもの(M3-04 マイコンボ画面の主要機能)まで含めて除外する誤った文言になっていた。m3-to-m4-handover で集中記録する。設計書本体 DES-005 §5.5「アクション: コンボ一覧と同様。加えてステータス切替タブでタグフィルタを一括適用」の解釈範囲内のため CHANGE 通知書は不要 |
| 1.0.4 | 2026-05-10 | M3-04 v1.0.3 実装中に製造担当からの第二指摘(2026-05-10)を反映。**マイコンボへの初回登録経路がマイコンボ画面以外に存在しなかった問題への対応**。v1.0.3 のマイコンボ画面ステータス変更プルダウンは「既にマイコンボに登録済みのコンボ」にしか到達できず、新規コンボや未登録のコンボをマイコンボに初めて登録する経路が完全に欠落していた。**追加実装内容(案 Z)**: (1) **経路 1**: コンボ編集画面の TagSelector 直前に専用ステータスドロップダウンを追加(新規登録時・編集時の主要経路、保存遅延モード)。(2) **経路 2**: コンボ一覧画面の各行にマイコンボステータス列を追加(既存コンボの素早い変更経路、即時 PATCH モード)。経路 3 のマイコンボ画面プルダウンと合わせて 3 経路で `MyComboStatusSelector` を共通利用、`mode: 'immediate' | 'deferred'` の props で切り替え。修正箇所: §1.2 目的、§1.3「作らないもの」(コンボ一覧画面除外を削除)、§2.2 修正ファイル(ComboEditorBasicFields.tsx / ComboTableRow.tsx を追加)、§4.9 MyComboStatusSelector のモード切替 props 拡張、§4.10 新設「コンボ編集画面のステータス付与 UI」、§4.11 新設「コンボ一覧画面のステータス列追加」、§4.12 設計判断事項表(旧 §4.10 から番号変更、設計判断事項を末尾に再配置)、§5.1 テスト要件、§5.2 E2E シナリオ I/J/K/L 追加(20 ステップ)、§7.1 / §7.2 完了条件、想定所要時間(150〜210 分 → 210〜300 分)。**設計担当の判断ミス記録(M3-04 で4回目のスコープ拡張)**: v1.0.3 修正時に「初回登録経路をマイコンボ画面のみに限定する」という設計判断ミスを犯した。マイコンボ画面のプルダウンは登録済みコンボにしか到達できないため、初回登録経路は別画面に必要だった。「案 C-1(マイコンボ画面のみ実装、コンボ一覧画面は将来要件)で初回登録経路は確保できる」と私が誤って提示したのが根本原因。m3-to-m4-handover で M3-04 1 ケースで 4 回スコープ拡張した反省を主題化、設計担当が「ユーザーが何を持っていて何をしたいか」を考えずに「画面ごとの UI」を考えてしまうアンチパターンとして体系化する。設計書本体 DES-005 §5.4 / §5.5 / §5.6 アクション解釈の範囲内のため CHANGE 通知書は不要 |

---

## 1. 背景と目的

### 1.1 背景

M2-02 で `DuplicateRealtimeWarning` 実装時に `CHARACTER_NAMES` 定数マップが導入された(progress-log.md L351)。これは M2 期間でキャラクター名を取得する手段が API 経由になっておらず、暫定でフロント側に定数化していたもの。M2-02 完了報告で「useCharacters フック実装時の差し替え(TODO 残置)」として持ち越し課題1に記録されている。

加えて、DES-005 §5.5(L238-251)で定義された **マイコンボ画面** が未実装である。マイコンボ画面はタグ `mycombo_status` 系(使用中・練習中・頻度低下)で絞り込まれたコンボの専用ビューで、ユーザーが「練習中のコンボ」「実戦投入中のコンボ」を頻繁に参照する主戦場となる画面。DES-005 §3 画面遷移図(L56)でも `Home --> MyCombo[マイコンボ]` として主要遷移に位置づけられている。

M3-overview v1.0.0 起票時は「タブ切替方式」と私が記録したが、v1.0.2(2026-05-10 開発者・設計担当協議)で **当初想定の別画面方式に回帰** することが確定した。設計書本体(DES-005 §5.5)と一致するため CHANGE 通知書は不要。

### 1.2 目的

- **character API ハンドラの新規実装**: `GET /api/games/{id}/characters` ハンドラ(DES-002 §4.2 L133 で既定、実態未実装)を M1-03 コンボ系3層パターンを踏襲して新規実装する(§4.0)。useCharacters フックの動作前提として必須
- `useCharacters` フックを実装し、既存の `CHARACTER_NAMES` 定数マップ参照箇所を全て差し替える(M2-02 持ち越し課題1の解消)
- マイコンボ画面を独立画面として新設し、DES-005 §5.5 の表示項目を全て実装する
- **マイコンボステータス変更 UI の実装(3 経路)**(v1.0.3 で初版追加、v1.0.4 で 3 経路に拡張): コンボにマイコンボステータスタグを付与・変更・解除する UI を以下の 3 経路で実装する:
  1. **マイコンボ画面の各コンボ行**(マイコンボ管理の主要経路、§4.9 / 即時 PATCH モード)
  2. **コンボ編集画面 TagSelector の直前**(新規登録時・編集時の主要経路、§4.10 / 保存遅延モード)
  3. **コンボ一覧画面の各行**(既存コンボの素早い変更経路、§4.11 / 即時 PATCH モード)
  3 経路で同じ `MyComboStatusSelector` コンポーネントを `mode: 'immediate' | 'deferred'` で切り替えて共通利用。M3-02 で確立した「TagSelector / TagBadgeList では `mycombo_status` カテゴリを除外、専用 UI で扱う」責務分離方針を維持
- マイコンボ画面の利点を活かす **上振れ要素3項目** を組み込む(§4.5):
  1. キャラクター情報バーへの件数ダッシュボード組込み(M3-01 `usage_count` API 活用)
  2. マイコンボステータス切替タブのカウントバッジ
  3. キャラクター切替プルダウン基盤(M3 はリュウのみだが M7 複数キャラ展開に拡張可能な構造)

### 1.3 このマイルストーンで作らないもの

- 複数キャラクターの seed データ追加 — M3 ではリュウのみ継続(M2 と同じ運用)
- マイコンボ画面のスマホボトムシート対応 — M7 仕上げで対応(本マイルストーンは基本のレスポンシブのみ)
- マイコンボステータスタグの **コンボ編集画面 `TagSelector` および コンボ一覧画面 `TagBadgeList` からの直接付与・直接表示** — M3-02 で「TagSelector / TagBadgeList は `mycombo_status` カテゴリを除外」する責務分離方針が確定済み、専用 UI(`MyComboStatusSelector`、§4.9 / §4.10 / §4.11)経由でのみ操作する
- セットプレイ関連
- マイコンボ画面の表示列カスタマイズの独立永続化 — 本指示書では M3-03 の `combo-list-columns-v1` を共用するか別キーで分離するかを §4.4 で確定
- フィルタ適用時の空状態メッセージ改善(持ち越し課題、M3-05 で対応)
- レシピ表示改善(M1-05 暫定処理1)— M3-05 で対応
- 始動技 ID 表示の解消(M1-05 暫定処理3)— M3-05 で対応

---

## 2. 成果物

### 2.1 作成するファイル

```
internal/
├── api/
│   └── character/
│       ├── handler.go                              # GET /api/games/{id}/characters ハンドラ(本指示書で新設、§4.0)
│       └── handler_test.go
├── service/
│   └── character/
│       ├── service.go                              # List 関数(本指示書で新設、§4.0)
│       └── service_test.go
└── repository/
    └── character/
        ├── repository.go                           # List 関数(本指示書で新設、§4.0)
        └── repository_test.go                      # 複雑クエリのみ(SUPP-001 §5.4)

web/src/
├── features/
│   ├── character/
│   │   ├── hooks/
│   │   │   ├── useCharacters.ts                   # キャラクター一覧取得フック(本指示書で新設)
│   │   │   └── useCharacters.test.ts              # フックテスト
│   │   └── api/
│   │       └── characterApi.ts                    # GET /api/games/{id}/characters クライアント関数
│   └── mycombo/
│       ├── components/
│       │   ├── MyComboPage.tsx                    # マイコンボ画面ページコンポーネント(新規ルート)
│       │   ├── MyComboPage.test.tsx
│       │   ├── CharacterInfoBar.tsx               # キャラクター情報バー + 件数ダッシュボード
│       │   ├── CharacterInfoBar.test.tsx
│       │   ├── MyComboStatusTabs.tsx              # ステータス切替タブ(使用中/練習中/頻度低下) + カウントバッジ
│       │   ├── MyComboStatusTabs.test.tsx
│       │   ├── CharacterSelector.tsx              # キャラクター切替プルダウン
│       │   ├── CharacterSelector.test.tsx
│       │   ├── MyComboStatusSelector.tsx          # 各コンボ行/編集画面のステータス変更プルダウン(v1.0.3 追加 + v1.0.4 でモード切替拡張、§4.9.2)
│       │   └── MyComboStatusSelector.test.tsx
│       └── hooks/
│           ├── useMyComboStatusCounts.ts          # mycombo_status タグごとの件数を取得するフック(usage_count 経由)
│           └── useUpdateMyComboStatus.ts          # マイコンボステータス変更の mutation フック(v1.0.3 追加、§4.9.3)
└── pages/
    └── MyComboPageRoute.tsx                       # ルーティング統合用ラッパ(既存のルート定義方式に合わせる)
```

各ファイルの責務は §4 で詳述する。

### 2.2 修正するファイル

#### フロントエンド

| ファイル | 修正内容 |
|---------|---------|
| `web/src/features/combo/components/DuplicateRealtimeWarning.tsx`(M2-02 実装) | `CHARACTER_NAMES` 定数マップ参照を `useCharacters` フック経由に差し替え |
| `web/src/features/combo/components/ComboEditor.tsx` 等、`CHARACTER_NAMES` を参照している他の箇所 | 同上 |
| `web/src/constants/character-names.ts`(または `CHARACTER_NAMES` 定義箇所) | 削除またはアーカイブ(差し替え完了後)。完全削除すると将来の検索性が下がるため、ファイル冒頭に「M3-04 で useCharacters フックに移行、本ファイルは未使用」のコメントを残して空のエクスポートにする選択肢もある。最終判断は §4.7 設計判断事項参照 |
| `web/src/App.tsx`(または相当のルーティング定義) | マイコンボ画面の新規ルート(`/mycombo`)を登録 |
| `web/src/components/layouts/Layout.tsx`(または相当のヘッダ/サイドバー) | 主要ナビゲーションに「マイコンボ」リンクを追加(DES-005 §4.2.1 主要ナビゲーション3つ:コンボ一覧・マイコンボ・設定) |
| `web/src/features/combo/components/ComboEditorBasicFields.tsx`(または相当、v1.0.4 で追加) | TagSelector の直前に `<MyComboStatusSelector mode="deferred" ... />` を配置、フォーム状態に `mycomboStatus: MyComboStatus \| ''` を追加、保存時の tagIds 構築ロジックで `mycombo_status` 系タグ ID を統合(§4.10) |
| `web/src/features/combo/components/ComboTableRow.tsx`(または相当、v1.0.4 で追加) | 各行に **マイコンボステータス列** を追加、`<MyComboStatusSelector mode="immediate" ... />` を配置、`ColumnVisibility` 型本体は M3-03 確定のまま変更しない(本列は表示列カスタマイズ対象外の固定列、§4.11) |
| `web/src/features/mycombo/components/MyComboStatusSelector.tsx`(v1.0.3 で新規、v1.0.4 で props 拡張) | `mode: 'immediate' \| 'deferred'` props を追加、保存遅延モードでは `onChange` コールバックで親のフォーム状態を更新するロジックを実装(§4.9) |

#### バックエンド

| ファイル | 修正内容 |
|---------|---------|
| `cmd/combomgr/main.go`(または相当のルート登録ファイル) | `GET /api/games/{id}/characters` を新規エンドポイントとして登録(コンボハンドラ登録と同パターン、§4.0) |
| `internal/model/character.go`(または相当) | `Character` モデル構造体を新規定義(既存なら拡張のみ、§4.0) |

実装規模は M1-03 のコンボ系3層パターン(handler / service / repository)を踏襲するだけのため、新規設計判断は不要。詳細は §4.0 を参照。

実装中にこれら以外のバックエンド変更が必要と判断した場合、Plan Mode で停止して開発者に相談する。

### 2.3 変更しないもの(原則)

- M3-01 で整備したタグ CRUD API・タグ管理画面
- M3-02 で整備したコンボへのタグ付与 UI・コンボ DTO の tags フィールド
- M3-03 で整備した共通ヘルパ `browser-storage.ts`、`useComboListFilters` / `useColumnVisibility` フック、ComboListFilters / ColumnVisibilityMenu コンポーネント、コンボ一覧 API のクエリパラメータ拡張
- 既存のコンボ編集2方式分離・楽観的排他制御
- 既存のコンボ API・タグ API のシグネチャ
- characters テーブルの DDL(M1-02 で整備済み、本マイルストーンでは変更しない、§3.4.2 で実態確認)
- マイグレーション(本マイルストーンは DB 変更なし)

### 2.4 例外: バックエンドへの追加実装が許容される箇所

本マイルストーンでは以下のバックエンド追加実装を **正式スコープ** として許容する:

- **character API ハンドラの新規実装**(§2.2 / §4.0): `GET /api/games/{id}/characters` ハンドラ + サービス層 + リポジトリ層を M1-03 コンボ系3層パターンを踏襲して実装。DES-002 §4.2 L133 で既定された API を実装する正式作業のため、CHANGE 通知書は不要

以下のケースは Plan Mode 確認の上で許容される:

- マイコンボ画面で件数ダッシュボードを実装する際、`GET /api/tags?include_usage=true&category=mycombo_status` の応答性能が悪い場合に専用エンドポイントを検討(本ケースは原則発生しない見込み)

実装中にこれら以外のバックエンド変更が必要と判断した場合、Plan Mode で停止して開発者に相談する。

---

## 3. 前提条件

### 3.1 必読ドキュメント

- `CLAUDE.md`(全体方針、特に **§4 JSON タグ camelCase / 列挙定数同期ルール**、§10 禁止事項)
- `docs/instructions/M3-overview.md` v1.0.2(M3 全体像、**§3.4 M3-04 詳細(別画面方式)**、§6 運用ルール、特に §6.6 / §6.9)
- `docs/instructions/M3-01-tag-feature-and-management.md`(タグ API、`useTagManagement`、`usage_count` API)
- `docs/instructions/M3-02-tag-assignment-ui.md`(コンボ DTO の tags フィールド、`useTagsForSelector`)
- `docs/instructions/M3-03-filter-sort-column-customize.md` v1.0.2(共通ヘルパ `browser-storage.ts`、`useComboListFilters`、`useColumnVisibility`、列挙定数同期パターン)
- `docs/design/05-screen-design.md`:
  - **§3 画面遷移図**(L56): `Home --> MyCombo[マイコンボ]` の主要遷移
  - **§4.2.1 主要ナビゲーション**(L99): コンボ一覧・マイコンボ・プリセット・設定
  - **§5.5 マイコンボ**(L238-251): 表示項目・追加項目・ソート・アクション・レスポンシブの全要求仕様
  - **§5.4 コンボ一覧**(L183-236): ソート・表示列カスタマイズの再利用元
- `docs/design/02-architecture.md`:
  - **§4.2 主要エンドポイント**(L133): `GET /api/games/{id}/characters` のパス確認(`/api/characters` ではない)
- `docs/design/03-data-model.md`:
  - **§3.6 tags テーブル定義**(L446-458): `category` カラム
  - **§3.7 combo_tags テーブル定義**(L460-467): 中間テーブル
- `docs/design/supp-001-detailed-design.md` v1.9.0:
  - **§5.4 / §5.5 テスト規約**
  - **§6.4 列挙定数同期ルール**(本指示書のマイコンボステータス値で適用)
- `docs/handover/design-instruction-playbook.md` v1.4.0:
  - **§4.5 フローの素直さ原則**
  - **§4.6 UI ライブラリの実態確認原則**(shadcn/ui は M7 まで未導入)
  - **§4.7 新エラー型導入時の全ハンドラ列挙原則**(本指示書は新エラー型を導入しない)

### 3.2 任意参照(必要時のみ参照)

- `docs/instructions/M2-02-edit-ux-improvements.md`: `CHARACTER_NAMES` 定数マップ導入の経緯(API 未実装だったための暫定対応)
- `docs/instructions/M1-05-*.md`: コンボ一覧画面の既存実装(マイコンボ画面で再利用するパターン)
- `docs/instructions/M1-03-*.md`(または相当): コンボ系3層パターン(handler / service / repository)の参考、character API 新規実装で踏襲する

### 3.3 参照不要

- DES-004 内部表現仕様書(プリセット系、本指示書のスコープ外)
- M2-01(仮想コントローラ)、M2-04(memo 関連)指示書
- M3-05 指示書(後続マイルストーンのため)

### 3.4 着手前の確認

製造担当 Claude Code は §4 詳細仕様の実装に着手する前に、以下を確認する。

#### 3.4.1 character API の現状確認(未実装の確認)

```bash
# サーバーが起動していない場合は make run-server-debug などで起動
# Street Fighter 6 の game_id は 1 と想定
curl -i http://localhost:47318/api/games/1/characters
```

期待される結果(v1.0.1 時点): **404 Not Found**(ハンドラ未実装)。本マイルストーンで §4.0 に従って新規実装することで、200 OK でキャラクター一覧の配列を返すようにする。

万一既に 200 OK で動作する場合(本マイルストーン着手前に他の手段で実装された場合)は Plan Mode で停止し、既存実装の現状を開発者に報告すること。

#### 3.4.2 characters テーブル DDL の確認

```bash
sqlite3 data/combomgr.db ".schema characters"
```

期待される確認事項:
- characters テーブルが M1-02 で整備済み
- カラム: `id` / `game_id` / `name` / その他(`code` 等が存在する場合あり)
- DES-003 の characters テーブル定義(該当節を参照、L80 付近の ER 図)と整合
- **本マイルストーンではテーブル DDL を変更しない**(§2.3)

万一テーブルが存在しない場合は Plan Mode で停止し、開発者に報告する。

#### 3.4.3 seed データの確認(リュウの存在確認)

```bash
sqlite3 data/combomgr.db "SELECT id, name FROM games;"
sqlite3 data/combomgr.db "SELECT id, name FROM characters WHERE game_id=1;"
```

期待される結果:
- games テーブル: `1 | Street Fighter 6` 1 件のみ
- characters テーブル: リュウを含むレコードが存在(M1-02 で seed 済み)

万一リュウが seed されていない場合は Plan Mode で停止し、開発者に報告する。

#### 3.4.4 既存の CHARACTER_NAMES 参照箇所の確認

```bash
grep -rn 'CHARACTER_NAMES' web/src/
```

期待される確認事項:
- 定義箇所: `web/src/constants/character-names.ts`(または相当)
- 参照箇所: `DuplicateRealtimeWarning.tsx`、ComboEditor 関連等(複数箇所)
- 全参照箇所をリストアップして報告書に含める

#### 3.4.5 M3-01 タグ API の usage_count 動作確認

```bash
curl 'http://localhost:47318/api/tags?include_usage=true&category=mycombo_status'
```

期待される結果: 200 OK、初期 3 タグ(使用中・練習中・頻度低下)それぞれに `usage_count` フィールドを含むレスポンス。本指示書では件数ダッシュボード(§4.5)で利用する。

#### 3.4.6 M3-03 のフックの再利用可能性確認

```bash
ls web/src/features/combo/hooks/
cat web/src/features/combo/hooks/useComboListFilters.ts | head -30
```

期待される確認事項:
- `useComboListFilters` フックがマイコンボ画面でも再利用可能な設計か(URL クエリ連動が画面間で独立に動くか)
- `useColumnVisibility` フックが汎用的に使えるか(キー名を引数で受け取れる構造か、または固定キー `combo-list-columns-v1` のみ対応か)

`useColumnVisibility` のキー名が固定の場合、マイコンボ画面でも同じキーを共用するか、新規キー(`mycombo-columns-v1` 等)を導入するかを §4.4 で確定する。

#### 3.4.7 既存ルーティング構造の確認

```bash
cat web/src/App.tsx
# または相当のルーティング定義ファイル
```

期待される確認事項:
- React Router によるルート定義の現状(`/combos`、`/combos/new`、`/combos/:id`、`/tags/manage`、`/trash` 等)
- 新規ルート `/mycombo` を追加する際のファイル構造・命名規則
- 主要ナビゲーション(Layout.tsx 等)へのリンク追加箇所

#### 3.4.8 確認結果の報告

製造担当 Claude Code は §3.4.1〜§3.4.7 の確認コマンド出力を実装完了報告に含める。

#### 3.4.9 §4 着手の前提条件

§3.4.1〜§3.4.7 の全確認結果が期待通りであることを確認してから、§4 詳細仕様の実装に着手する。万一現状が想定と乖離する場合は Plan Mode で停止して開発者に報告する。

---

## 4. 詳細仕様

### 4.0 character API ハンドラの新規実装(M1-03 コンボ系3層パターン踏襲)

#### 4.0.1 概要

`GET /api/games/{id}/characters` ハンドラを M1-03 コンボ系3層パターン(handler / service / repository)を踏襲して新規実装する。本マイルストーンで完結する追加スコープ(v1.0.1 で正式化)。

実装規模は小さく、新しい設計判断は不要。M1-03 の `internal/api/combo/` / `internal/service/combo/` / `internal/repository/combo/` を参考に、`character` パッケージとして並列展開する。

#### 4.0.2 リポジトリ層

実装ファイル: `internal/repository/character/repository.go`

```go
package character

import (
    "context"
    "database/sql"
    "fmt"
)

type Repository struct {
    db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
    return &Repository{db: db}
}

// List は指定 game_id に紐づくキャラクターを id 昇順で全件取得する。
func (r *Repository) List(ctx context.Context, gameID int64) ([]model.Character, error)
```

実装方針:

- `SELECT id, game_id, name FROM characters WHERE game_id = ? ORDER BY id ASC`(`code` 等の追加カラムが存在する場合は §3.4.2 着手前確認で確認した上で SELECT に含める)
- 結果が 0 件でも空配列を返す(エラーにしない)

#### 4.0.3 サービス層

実装ファイル: `internal/service/character/service.go`

```go
package character

import (
    "context"
    "fmt"
)

type Service struct {
    repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
    return &Service{repo: repo}
}

// List は指定 game_id のキャラクター一覧を返す。
func (s *Service) List(ctx context.Context, gameID int64) ([]model.Character, error)
```

実装方針:

- `s.repo.List(ctx, gameID)` を呼ぶだけのシンプルな委譲
- エラーは `fmt.Errorf("character service: list: %w", err)` で wrap(CLAUDE.md §4 Go 規約)
- 認証スキップ運用(SUPP-001 §2.5)のため userID チェックは不要

#### 4.0.4 ハンドラ層

実装ファイル: `internal/api/character/handler.go`

```go
package character

import (
    "net/http"
    "strconv"

    "github.com/labstack/echo/v4"
)

type Handler struct {
    svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
    return &Handler{svc: svc}
}

// List は GET /api/games/:id/characters のハンドラ。
func (h *Handler) List(c echo.Context) error {
    gameIDStr := c.Param("id")
    gameID, err := strconv.ParseInt(gameIDStr, 10, 64)
    if err != nil {
        return c.JSON(http.StatusBadRequest, map[string]any{
            "error": map[string]any{
                "code":    "INVALID_GAME_ID",
                "message": "game_id must be a positive integer",
            },
        })
    }

    characters, err := h.svc.List(c.Request().Context(), gameID)
    if err != nil {
        return c.JSON(http.StatusInternalServerError, map[string]any{
            "error": map[string]any{
                "code":    "INTERNAL_ERROR",
                "message": err.Error(),
            },
        })
    }

    return c.JSON(http.StatusOK, map[string]any{
        "items": characters,
    })
}
```

実装方針:

- レスポンス形式は `{"items": [...]}` ラッパー付き(progress-log.md M2-01 完了報告 L41、`/api/combos` と整合)
- パスパラメータ `:id` を `int64` にパース、不正値で 400 + `INVALID_GAME_ID`
- DES-002 §4.3 エラーレスポンス共通フォーマットに従う

#### 4.0.5 ルート登録

実装ファイル: `cmd/combomgr/main.go`(または相当のルート登録ファイル)

既存のコンボ・タグ系ハンドラ登録と同じパターンで以下を追加:

```go
characterRepo := characterrepo.NewRepository(db)
characterSvc := characterservice.NewService(characterRepo)
characterHandler := characterapi.NewHandler(characterSvc)

e.GET("/api/games/:id/characters", characterHandler.List)
```

import パスは既存ファイルの命名規則に合わせる(M1-03 コンボ系の構造を確認して同じ流儀で書く)。

#### 4.0.6 Character モデル

実装ファイル: `internal/model/character.go`(または既存の model パッケージ内)

```go
package model

// Character は characters テーブルのレコードに対応するモデル。
// JSON タグは CLAUDE.md §4 / SUPP-001 §6.4 に従い camelCase。
type Character struct {
    ID     int64  `json:"id" db:"id"`
    GameID int64  `json:"gameId" db:"game_id"`
    Name   string `json:"name" db:"name"`
    // Code 等の追加フィールドは §3.4.2 着手前確認で実態を確認した上で追加する
}
```

DB カラム名は snake_case(`game_id`)、JSON タグは camelCase(`gameId`)で分離(CLAUDE.md §4)。

#### 4.0.7 JSON 命名規則(CLAUDE.md §4)

- バックエンド JSON タグ: `id` / `gameId` / `name` 等を camelCase で統一
- フロントエンド `Character` 型(`web/src/features/character/hooks/useCharacters.ts`)も同じ camelCase で定義
- バックエンド・フロント両側で表記揺れが発生しないこと

### 4.1 useCharacters フック

実装ファイル: `web/src/features/character/hooks/useCharacters.ts`

#### 4.1.1 機能要件

- `GET /api/games/{id}/characters` を呼び出し、キャラクター一覧を取得
- TanStack Query でキャッシュ(`queryKey: ['characters', { gameId }]`)
- 結果は `Character[]`(`id` / `name` / 必要なら `code` 等を含む)
- ローディング・エラー状態を扱える

#### 4.1.2 構造例

```typescript
import { useQuery } from '@tanstack/react-query';
import { characterApi } from '../api/characterApi';

export const DEFAULT_GAME_ID = 1; // SF6 の game_id、§3.4.3 で確認済み

export interface Character {
  id: number;
  gameId: number;                                  // §4.0.6 と整合(camelCase)
  name: string;
  // 他フィールド候補(code、iconUrl 等)。実 API レスポンスを §3.4.1 / §3.4.2 着手前確認で取得し、含まれるフィールドを追加する
}

export function useCharacters(gameId: number = DEFAULT_GAME_ID) {
  return useQuery({
    queryKey: ['characters', { gameId }],
    queryFn: () => characterApi.list(gameId),
  });
}

/**
 * キャラクター名を ID から引く便利ヘルパ。
 * useCharacters を内部で呼ぶため、コンポーネント内で使う。
 * M2-02 の CHARACTER_NAMES 定数マップを置き換える役割。
 */
export function useCharacterName(characterId: number | null | undefined): string {
  const { data: characters } = useCharacters();
  if (!characterId || !characters) return '';
  return characters.find((c) => c.id === characterId)?.name ?? '';
}
```

#### 4.1.3 characterApi クライアント関数

実装ファイル: `web/src/features/character/api/characterApi.ts`

```typescript
import type { Character } from '../hooks/useCharacters';

export const characterApi = {
  list: async (gameId: number): Promise<Character[]> => {
    const response = await fetch(`/api/games/${gameId}/characters`);
    if (!response.ok) {
      throw new Error(`Failed to fetch characters: ${response.status}`);
    }
    const data = await response.json();
    // §4.0.4 で `{items: [...]}` ラッパー形式に確定
    return data.items;
  },
};
```

レスポンス形式は §4.0.4 で `{items: [...]}` ラッパー形式に確定(progress-log.md M2-01 完了報告 L41、`/api/combos` と整合)。

#### 4.1.4 既存 CHARACTER_NAMES 参照箇所の差し替え

§3.4.4 で列挙した全参照箇所を `useCharacterName` フック呼び出しに置換する。

例: `DuplicateRealtimeWarning.tsx`

```typescript
// 修正前
import { CHARACTER_NAMES } from '@/constants/character-names';
const characterName = CHARACTER_NAMES[characterId] ?? '';

// 修正後
import { useCharacterName } from '@/features/character/hooks/useCharacters';
const characterName = useCharacterName(characterId);
```

#### 4.1.5 CHARACTER_NAMES 定数マップの取扱

§4.7 設計判断事項で「**完全削除**」を確定する。理由:

- 差し替え完了後は参照ゼロになるため残置の意味がない
- アーカイブとして残すと将来のコード検索でノイズになる
- Git 履歴で復元可能
- 削除前に `grep -rn 'CHARACTER_NAMES' web/src/` で参照ゼロを確認すること

### 4.2 マイコンボ画面の構造

実装ファイル: `web/src/features/mycombo/components/MyComboPage.tsx`

#### 4.2.1 ルート定義

新規ルート: `/mycombo`

実装ファイル: `web/src/App.tsx`(または相当)

```typescript
<Route path="/mycombo" element={<MyComboPageRoute />} />
```

#### 4.2.2 画面レイアウト

DES-005 §5.5 に従い、以下の構造で実装:

```
┌─────────────────────────────────────────────┐
│ ヘッダ(主要ナビゲーション、共通 Layout)     │
├─────────────────────────────────────────────┤
│ キャラクター情報バー                          │
│ ┌─────────┐                                  │
│ │ アイコン │ リュウ                            │
│ └─────────┘                                  │
│ 使用中: 5  練習中: 3  頻度低下: 1            │ ← 上振れ要素1: 件数ダッシュボード
│ [キャラクター切替プルダウン ▼]               │ ← 上振れ要素3: キャラ切替基盤
├─────────────────────────────────────────────┤
│ マイコンボステータス切替タブ                  │
│ [ 使用中 (5) ][ 練習中 (3) ][ 頻度低下 (1) ] │ ← 上振れ要素2: カウントバッジ
├─────────────────────────────────────────────┤
│ コンボ一覧テーブル(M3-03 の構造を再利用)   │
│ - ソート(useComboListFilters 再利用)         │
│ - 表示列カスタマイズ(useColumnVisibility)    │
│ - 個別タグ表示(TagBadgeList)                │
└─────────────────────────────────────────────┘
```

#### 4.2.3 MyComboPage の責務

- マイコンボステータス切替タブの選択状態を管理(state または URL クエリ)
- `useTagsForSelector` で `mycombo_status` カテゴリのタグ3件を取得
- 選択中タブのタグ ID で `useCombos` フックを呼んでコンボ一覧を取得
- `<CharacterInfoBar>` / `<MyComboStatusTabs>` / `<CharacterSelector>` を組み込む
- コンボ一覧テーブルは M3-03 で実装した既存のテーブルコンポーネントを再利用する

#### 4.2.4 URL クエリ設計

選択中タブの状態は **URL クエリパラメータ** で管理(M3-03 のフィルタ・ソート連動と同じ思想):

- `/mycombo?status=in_use`(使用中)
- `/mycombo?status=practicing`(練習中)
- `/mycombo?status=reduced`(頻度低下)
- `/mycombo`(未指定時は「使用中」が既定)

URL クエリの値は **マイコンボステータスの内部コード** を使う(後述の §4.6 列挙定数同期で確定)。

選択中キャラクターも将来 URL クエリに含めて多キャラ対応するが、M3 期間ではリュウのみのため初期は URL クエリ化しない。

### 4.3 CharacterInfoBar コンポーネント(上振れ要素1: 件数ダッシュボード組込み)

実装ファイル: `web/src/features/mycombo/components/CharacterInfoBar.tsx`

#### 4.3.1 機能要件

- 現在選択中のキャラクター名・アイコンを目立つ形で表示(DES-005 §5.5)
- **上振れ要素**: 件数ダッシュボード(使用中・練習中・頻度低下の件数)を組み込み

#### 4.3.2 Props 設計

```typescript
interface CharacterInfoBarProps {
  characterId: number;
  statusCounts: MyComboStatusCounts;     // §4.5 で確定、各ステータスの件数
}

interface MyComboStatusCounts {
  inUse: number;       // 使用中
  practicing: number;  // 練習中
  reduced: number;     // 頻度低下
}
```

#### 4.3.3 実装方針

- キャラクター名は `useCharacterName(characterId)` で取得
- アイコン表示は M3 段階では「キャラ頭文字を円形バッジで表示」等の簡易実装で可(本格的なキャラアイコン画像対応は M7 仕上げ。本指示書 §1.3 で M7 移管を明示)
- 件数ダッシュボードは3つの統計値カード形式で表示(Tailwind の grid または flex で横並び、スマホでは縦積み)
- shadcn/ui 不使用、標準 HTML + Tailwind 自作(playbook §4.6)

#### 4.3.4 件数ゼロ時の表示

3つの件数がすべて0の場合(マイコンボデータがまだ何も登録されていない状態):

- 件数ダッシュボードは「使用中: 0  練習中: 0  頻度低下: 0」と表示
- 「マイコンボに登録されたコンボがまだありません」のような案内文を画面下部に追加表示(M3-05 で扱う空状態メッセージ改善とは別観点、本画面はステータスタブが必須前提のため案内のみ)

### 4.4 useColumnVisibility のキー戦略

#### 4.4.1 確定方針

マイコンボ画面とコンボ一覧画面で **同じ localStorage キー `combo-list-columns-v1` を共用** する。

理由:

- 表示列構成はユーザーの嗜好であり、画面ごとに変える必然性が低い
- 別キーにすると2画面で別々に設定する手間が発生する
- DES-005 §5.5 で「マイコンボの表示項目はコンボ一覧と同様」と書かれており、列構成も同じ前提
- 将来分離する必要が出れば、別キー `mycombo-columns-v1` への移行は容易(共通ヘルパ経由のため変更コスト小)

#### 4.4.2 useColumnVisibility フックの利用

M3-03 で実装した `useColumnVisibility` を **そのまま再利用** する。新規フックを作成しない。

### 4.5 MyComboStatusTabs コンポーネント(上振れ要素2: カウントバッジ)

実装ファイル: `web/src/features/mycombo/components/MyComboStatusTabs.tsx`

#### 4.5.1 機能要件

- 3つのタブ(使用中・練習中・頻度低下)を上部に横並び表示
- 選択中タブのハイライト
- **上振れ要素**: 各タブに件数バッジを表示(例: 「使用中 (5)」)
- クリックで親に選択変更を通知

#### 4.5.2 Props 設計

```typescript
interface MyComboStatusTabsProps {
  selected: MyComboStatus;
  onSelect: (status: MyComboStatus) => void;
  counts: MyComboStatusCounts;
}

// MyComboStatus 型は §4.6 で定義
```

#### 4.5.3 実装方針

- 各タブは `<button>` で実装、選択中はクラス付与でハイライト
- カウントは丸括弧付きで表示(`使用中 (5)`)、件数 0 のときも `(0)` で表示
- 標準 HTML + Tailwind 自作(playbook §4.6)
- レスポンシブ: スマホではスクロール可能な横並び(DES-005 §5.5)

### 4.6 MyComboStatus 列挙定数(バックエンド・フロント同期)

#### 4.6.1 列挙定数の定義

CLAUDE.md §4 / SUPP-001 §6.4 列挙定数同期ルールに従い、バックエンド・フロント両側に対応する定数を定義する。

**バックエンド側**(Go 定数):

`internal/model/tag.go`(または既存のタグモデル定義場所)に以下を追加:

```go
// MyComboStatus はマイコンボステータスタグの内部コード値。
// DES-005 §5.5、SUPP-001 §3.5 で定義された3種のステータス。
const (
    MyComboStatusInUse      = "in_use"      // 使用中
    MyComboStatusPracticing = "practicing"  // 練習中
    MyComboStatusReduced    = "reduced"     // 頻度低下
)

// MyComboStatusTagNames はマイコンボステータスタグの名前(seed と一致)。
// 内部コード → タグ名のマッピング。
var MyComboStatusTagNames = map[string]string{
    MyComboStatusInUse:      "使用中",
    MyComboStatusPracticing: "練習中",
    MyComboStatusReduced:    "頻度低下",
}
```

**重要**: 上記コード値(`in_use` / `practicing` / `reduced`)は **本指示書で新規確定** するもので、既存実装には存在しない。M3-01 で投入された tags テーブルの seed(マイグレーション 000007)では `name` カラムに日本語の「使用中」「練習中」「頻度低下」が直接入っており、内部コード値の概念がなかった。

フロント側で URL クエリ・タブ識別に使う内部コード値として本マイルストーンで初導入する。タグ名(日本語)とは別概念。タグ name はそのまま DB 内に保持され、内部コード値はあくまでフロント・バックエンド間で扱う識別子。

**フロントエンド側**(TypeScript 定数):

`web/src/constants/mycombo.ts` に対応する定数を定義:

```typescript
export const MYCOMBO_STATUS_VALUES = ['in_use', 'practicing', 'reduced'] as const;
export type MyComboStatus = typeof MYCOMBO_STATUS_VALUES[number];

export const MYCOMBO_STATUS_LABELS: Record<MyComboStatus, string> = {
  in_use: '使用中',
  practicing: '練習中',
  reduced: '頻度低下',
};

export const MYCOMBO_STATUS_TAG_NAMES: Record<MyComboStatus, string> = {
  in_use: '使用中',
  practicing: '練習中',
  reduced: '頻度低下',
};
```

#### 4.6.2 タグ ID へのマッピング

マイコンボ画面でタブ選択 → API フィルタ条件への変換は以下のフローで行う:

1. ユーザーがタブを選択 → `MyComboStatus` 内部コード値が確定
2. `MYCOMBO_STATUS_TAG_NAMES[status]` でタグ名(日本語)を取得
3. `useTagsForSelector` 等で取得した `mycombo_status` カテゴリの全タグから、上記タグ名と一致するタグの `id` を引く
4. 取得したタグ ID で `useCombos({ tagIds: [...] })` を呼び出してフィルタ結果を取得

この変換ロジックは `useMyComboStatusTagIds()` のようなヘルパフックに切り出すか、`MyComboPage` 内のローカル `useMemo` で処理する(指示書本文では強制しない、製造担当の判断)。

#### 4.6.3 リテラル文字列の禁止

マイコンボ画面の実装で `"in_use"` / `"practicing"` / `"reduced"` / `"使用中"` / `"練習中"` / `"頻度低下"` のリテラル文字列を直接書かない。**必ず定数経由** で参照する(CLAUDE.md §4 列挙定数同期ルール)。

### 4.7 useMyComboStatusCounts フック(件数ダッシュボード用)

実装ファイル: `web/src/features/mycombo/hooks/useMyComboStatusCounts.ts`

#### 4.7.1 機能要件

- マイコンボ画面のキャラクター情報バー + ステータスタブで表示する件数を取得
- 戻り値: `MyComboStatusCounts`(`inUse` / `practicing` / `reduced` の3件数)

#### 4.7.2 実装方針

M3-01 で実装済みの `GET /api/tags?include_usage=true&category=mycombo_status` を活用する。

```typescript
import { useQuery } from '@tanstack/react-query';
import { tagApi } from '@/features/tag/api/tagApi';
import { MYCOMBO_STATUS_TAG_NAMES, type MyComboStatus } from '@/constants/mycombo';

export interface MyComboStatusCounts {
  inUse: number;
  practicing: number;
  reduced: number;
}

export function useMyComboStatusCounts(): { data: MyComboStatusCounts | undefined; isLoading: boolean } {
  const tagsQuery = useQuery({
    queryKey: ['tags', { include_usage: true, category: 'mycombo_status' }],
    queryFn: () => tagApi.list({ includeUsage: true, category: 'mycombo_status' }),
  });

  const counts: MyComboStatusCounts | undefined = tagsQuery.data
    ? {
        inUse: tagsQuery.data.find((t) => t.name === MYCOMBO_STATUS_TAG_NAMES.in_use)?.usage_count ?? 0,
        practicing: tagsQuery.data.find((t) => t.name === MYCOMBO_STATUS_TAG_NAMES.practicing)?.usage_count ?? 0,
        reduced: tagsQuery.data.find((t) => t.name === MYCOMBO_STATUS_TAG_NAMES.reduced)?.usage_count ?? 0,
      }
    : undefined;

  return { data: counts, isLoading: tagsQuery.isLoading };
}
```

#### 4.7.3 キャラクター別の件数(M7 拡張準備)

M3-04 ではリュウのみのため、`usage_count` は全コンボ件数を返す(これがリュウの件数と等しい)。M7 で複数キャラ展開時には、キャラ別件数取得 API またはフィルタ機構の拡張が必要になる。本指示書ではキャラ別件数取得は実装しない(M3-04 §1.3 で除外明示)。

### 4.8 CharacterSelector コンポーネント(上振れ要素3: キャラクター切替プルダウン基盤)

実装ファイル: `web/src/features/mycombo/components/CharacterSelector.tsx`

#### 4.8.1 機能要件

- `useCharacters` フックの結果をプルダウン選択肢として表示
- 現在 M3 段階ではリュウ1件のみだが、複数キャラ展開(M7)に拡張可能な構造
- 選択変更で親に通知

#### 4.8.2 Props 設計

```typescript
interface CharacterSelectorProps {
  selectedCharacterId: number;
  onChange: (characterId: number) => void;
}
```

#### 4.8.3 実装方針

- 標準 HTML `<select>` + Tailwind で実装(playbook §4.6)
- 1キャラのみの場合は disabled にして表示(選択不能、ただし「リュウ」と表示される)
- 将来の URL クエリ化(`/mycombo?character=ryu` 等)を見越して、`selectedCharacterId` を URL クエリと連動できる設計にしておく(本指示書では URL 連動の実装は不要、props 受け取りで完結)

### 4.9 マイコンボステータス変更 UI(v1.0.3 で追加)

#### 4.9.1 設計背景

M3-02 で「コンボ編集画面の TagSelector では `mycombo_status` カテゴリを除外」する責務分離方針が確定したが、それを付与する経路の指示が M3-04 指示書 v1.0.0〜v1.0.2 で欠落していた(設計担当の判断ミス)。本節 v1.0.3 で「マイコンボ画面のコンボ一覧テーブル各行にステータス変更プルダウンを置く」方針を確定する。

DES-005 §5.5「アクション: コンボ一覧と同様。加えてステータス切替タブでタグフィルタを一括適用」の解釈範囲内で、マイコンボ画面の主要操作経路として実装する。

#### 4.9.2 MyComboStatusSelector コンポーネント(3 経路共通利用、v1.0.4 でモード切替拡張)

実装ファイル: `web/src/features/mycombo/components/MyComboStatusSelector.tsx`

##### 機能要件

- **3 経路で共通利用** される(マイコンボ画面 §4.9 / コンボ編集画面 §4.10 / コンボ一覧画面 §4.11)
- `mode` props で **即時 PATCH モード / 保存遅延モード** を切り替える
- 標準 HTML `<select>` で実装(playbook §4.6、shadcn/ui 不使用)
- 4つの選択肢を提供:
  - `使用中`(値: `in_use`)
  - `練習中`(値: `practicing`)
  - `頻度低下`(値: `reduced`)
  - `マイコンボから外す`(値: 空文字 `""`)
- ラベル文字列は `MYCOMBO_STATUS_LABELS` 定数経由で表示(リテラル禁止、CLAUDE.md §4)
- 「マイコンボから外す」のラベル表示は親側の文脈に応じて切り替え可(編集画面では「未登録」と表示する選択肢もある、§4.10 / §4.11 で記載)

##### モード仕様

**即時 PATCH モード(`mode='immediate'`)**: マイコンボ画面・コンボ一覧画面で使用。選択変更でその場で `useUpdateMyComboStatus` フックの mutation を発火、PATCH 実行 → キャッシュ無効化 → 再レンダリングで反映。

**保存遅延モード(`mode='deferred'`)**: コンボ編集画面で使用。選択変更時は `onChange` コールバックで親のフォーム状態に伝達するのみ、API 呼び出しはしない。親コンポーネントが保存ボタン押下時に POST / PATCH の tagIds 配列を構築する際に `mycombo_status` カテゴリのタグ ID を含める/除外する処理を行う。

両モードで以下は共通:
- 選択肢・ラベル・初期選択値の表示ロジック
- `MYCOMBO_STATUS_TAG_NAMES` / `MYCOMBO_STATUS_LABELS` 定数経由の参照
- 標準 HTML `<select>` + Tailwind 自作

##### Props 設計

```typescript
interface MyComboStatusSelectorProps {
  currentStatus: MyComboStatus | '';            // 現在のステータス(初期選択値)
  mycomboStatusTags: Tag[];                     // mycombo_status カテゴリのタグ一覧
  mode: 'immediate' | 'deferred';               // 即時 PATCH / 保存遅延

  // mode='immediate' のときに必須
  comboId?: number;
  comboVersion?: number;                         // 楽観的排他制御のため
  currentTags?: Tag[];                           // PATCH ペイロード構築用(現在のタグ全件)

  // mode='deferred' のときに必須
  onChange?: (newStatus: MyComboStatus | '') => void;  // 親のフォーム状態を更新

  onUpdated?: () => void;                       // 即時モードの更新成功コールバック(任意)
}
```

`mode='immediate'` で `comboId` / `comboVersion` / `currentTags` のいずれかが未指定の場合、TypeScript 型レベルでは optional だが実行時に必須。製造担当の判断で型分岐(Discriminated Union 等)を使ってより厳密に表現してよいが、本指示書では上記の単純な型で示し、実装時にチェックを追加する形を許容する。

##### 初期選択値の判定ロジック(両モード共通)

`currentStatus` props は親が判定して渡す:
- 即時モード(マイコンボ画面・コンボ一覧画面): 当該コンボの `currentTags` から `mycombo_status` カテゴリのタグを探し、最初の 1 つの name を内部コード値に逆変換
- 保存遅延モード(コンボ編集画面): 親のフォーム状態の `mycomboStatus` フィールドを直接渡す

複数の `mycombo_status` タグが付いていた場合は最初の 1 つを採用(通常は 1 つ前提、堅牢性として複数対応)。

##### 配置位置

各経路で配置位置が異なる:
- マイコンボ画面(§4.9): コンボ一覧テーブルの各行(既存のアクション列付近、製造担当判断)
- コンボ編集画面(§4.10): TagSelector の直前(製造担当判断で隣接位置の調整可)
- コンボ一覧画面(§4.11): タグ列の直後・アクション列の直前を推奨(製造担当判断で他の位置でも可)

#### 4.9.3 useUpdateMyComboStatus フック

実装ファイル: `web/src/features/mycombo/hooks/useUpdateMyComboStatus.ts`

##### 機能要件

- `PATCH /api/combos/:id` を呼び出す mutation フック
- M2-02 / M3-02 で確立した既存パターン(`UpdateMetadataInput.TagIDs` フィールドへの値渡し、`version` 同時送信)を踏襲
- バックエンド変更ゼロ(新規 API 追加なし、既存 API を流用)
- **即時モードの `MyComboStatusSelector` から利用される**(マイコンボ画面・コンボ一覧画面)。保存遅延モード(コンボ編集画面)では本フックは使われず、親の保存処理(既存の POST / PATCH ロジック)が tagIds 構築を担当する

##### 構造例

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Tag } from '@/features/tag/hooks/useTagsForSelector';
import { MYCOMBO_STATUS_TAG_NAMES, type MyComboStatus } from '@/constants/mycombo';
import { TAG_CATEGORY_MYCOMBO_STATUS } from '@/constants/mycombo';

interface UpdateMyComboStatusInput {
  comboId: number;
  comboVersion: number;
  currentTags: Tag[];
  mycomboStatusTags: Tag[];
  newStatus: MyComboStatus | '';   // 空文字は「マイコンボから外す」
}

export function useUpdateMyComboStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateMyComboStatusInput) => {
      // 1. 現タグから mycombo_status カテゴリのタグ ID を除外
      const baseTagIds = input.currentTags
        .filter((t) => t.category !== TAG_CATEGORY_MYCOMBO_STATUS)
        .map((t) => t.id);

      // 2. 新ステータスが指定されていれば対応するタグ ID を追加
      let newTagIds = baseTagIds;
      if (input.newStatus !== '') {
        const targetTagName = MYCOMBO_STATUS_TAG_NAMES[input.newStatus];
        const targetTag = input.mycomboStatusTags.find((t) => t.name === targetTagName);
        if (targetTag) {
          newTagIds = [...baseTagIds, targetTag.id];
        }
      }

      // 3. PATCH を呼ぶ
      const response = await fetch(`/api/combos/${input.comboId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tagIds: newTagIds,
          version: input.comboVersion,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update mycombo status: ${response.status}`);
      }

      return response.json();
    },
    onSuccess: () => {
      // 4. コンボ一覧と件数ダッシュボードのキャッシュを無効化
      queryClient.invalidateQueries({ queryKey: ['combos'] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });  // usage_count 再取得のため
    },
  });
}
```

##### エラーハンドリング

- 409(楽観的排他制御失敗): M2-02 で確立した既存パターンに従う(再取得を促すメッセージ表示等、本指示書では既存挙動を踏襲)
- その他のエラー: `console.error` + アラート表示(M1-06 / M2-02 のエラー表示パターン踏襲)

#### 4.9.4 楽観的更新の見送り(M3-04 では実装しない)

PATCH 完了前に UI 上の選択値を即座に反映する楽観的更新は **本指示書では実装しない**。理由:

- 実装複雑度の割に効果が限定的(マイコンボ画面の主要操作だが頻発するわけではない)
- PATCH レスポンス受領後にキャッシュ無効化 → 再レンダリングで反映する単純フローで十分(数百 ms 程度の遅延は許容範囲)
- 将来 M7 仕上げで UX 改善が必要になったら別途検討

#### 4.9.5 既存実装(M3-03 / M3-04 §4.2)との統合

- マイコンボ画面のコンボ一覧テーブルは M3-03 のテーブルコンポーネント(または M3-04 §4.2 で再利用したもの)を継承
- 「ステータス変更プルダウン」列を新規追加する形(既存列を変更しない、playbook §5 既存挙動の温存原則)
- `useColumnVisibility` の表示列カスタマイズ対象には **含めない**(本列はマイコンボ画面でのみ常時表示する固定列)。これにより M3-03 で確定した `ColumnVisibility` 型の6フィールド(starterSituation / damage / recipe / tags / draftStatus / memo)に影響を与えない

### 4.10 コンボ編集画面へのマイコンボステータス付与 UI(経路 1、v1.0.4 で新設)

#### 4.10.1 設計背景

v1.0.3 ではマイコンボ画面のステータス変更プルダウンのみで実装したが、**マイコンボへの初回登録経路** が完全に欠落していた(マイコンボ画面のプルダウンは既にマイコンボに登録済みのコンボにしか到達できないため、新規コンボや未登録コンボをマイコンボに初めて登録する手段がなかった)。

本節 v1.0.4 で、新規登録時・編集時にコンボ編集画面から直接マイコンボステータスを設定できる経路を追加する。M3-02 で「コンボ編集画面の `TagSelector` では `mycombo_status` カテゴリを除外」する責務分離方針を維持しつつ、**TagSelector とは別の専用 UI** としてマイコンボステータスドロップダウンを追加する。

#### 4.10.2 配置と UI

対象ファイル: `web/src/features/combo/components/ComboEditorBasicFields.tsx`(または相当のコンボ編集画面の基本フィールドを表示しているコンポーネント)

配置: **TagSelector の直前**(マイコンボステータスを設定 → 通常のタグを設定、という入力順序が自然)。ただし製造担当のレイアウト判断を尊重し、隣接位置(TagSelector の直後・別セクション内)も許容する。

UI 構造例:

```
[コンボ名入力]
[ダメージ入力]
...その他の基本フィールド...
ラベル「マイコンボステータス」:
  <MyComboStatusSelector mode="deferred" currentStatus={form.mycomboStatus} onChange={(s) => setForm({...form, mycomboStatus: s})} ... />
ラベル「タグ」:
  <TagSelector excludeCategories={[TAG_CATEGORY_MYCOMBO_STATUS]} ... />
```

ラベル文字列は **「マイコンボステータス」** を推奨(`MYCOMBO_STATUS_LABELS` 定数とは別の固定ラベル、製造担当が文言を微調整してよい)。

#### 4.10.3 フォーム状態の拡張

コンボ編集画面のフォーム状態に以下のフィールドを追加:

```typescript
interface ComboEditorFormState {
  // 既存フィールド
  name: string;
  damage: number;
  // ... 他の基本フィールド
  selectedTagIds: number[];         // 既存: 通常タグの選択

  // v1.0.4 で追加
  mycomboStatus: MyComboStatus | '';   // マイコンボステータス(空文字 = 未登録)
}
```

初期値の判定:

- **新規登録時** (`/combos/new`): `mycomboStatus: ''`(未登録)
- **編集時** (`/combos/:id/edit`): 既存コンボの `tags` から `mycombo_status` カテゴリのタグを探し、最初の 1 つの name を内部コード値に逆変換して設定。`mycombo_status` カテゴリのタグが付いていない場合は `''`

逆変換ロジック: `MYCOMBO_STATUS_TAG_NAMES` の `Record<MyComboStatus, string>` を逆引きする(`Object.entries(MYCOMBO_STATUS_TAG_NAMES).find(([_, name]) => name === foundTag.name)?.[0]`)。

#### 4.10.4 保存時の tagIds 構築ロジック

保存ボタン押下時(POST 新規登録 or PATCH 編集)、フォーム状態から API に送信する `tagIds` 配列を構築する処理を以下のとおり拡張:

```typescript
function buildTagIdsForSubmit(
  form: ComboEditorFormState,
  mycomboStatusTags: Tag[],
  existingTags?: Tag[],   // 編集時のみ、PATCH ベース構築用
): number[] {
  // 1. ベース: フォーム上で選択された通常タグの ID 一覧(TagSelector の選択結果)
  let tagIds = [...form.selectedTagIds];

  // 2. 編集時、既存タグの中に通常タグで TagSelector に出てこないものは保持(本ケースは TagSelector の選択結果 selectedTagIds に含まれるため、追加処理は不要)
  //    (excludeCategories=[mycombo_status] により TagSelector に出なかったタグは、ここでは
  //    対象外。selectedTagIds に既に含まれているか、もしくは mycombo_status のいずれか)
  //    実装としては、selectedTagIds がそのまま通常タグの正しい状態を表すため追加処理不要

  // 3. マイコンボステータスを反映
  if (form.mycomboStatus !== '') {
    const targetTagName = MYCOMBO_STATUS_TAG_NAMES[form.mycomboStatus];
    const targetTag = mycomboStatusTags.find((t) => t.name === targetTagName);
    if (targetTag) {
      tagIds.push(targetTag.id);
    }
  }
  // form.mycomboStatus === '' なら追加なし(= マイコンボから外す扱い)

  return tagIds;
}
```

POST 時は新規作成リクエストの tagIds に、PATCH 時はメタデータ更新リクエストの tagIds に上記結果を渡す。

#### 4.10.5 既存 TagSelector の動作温存

`<TagSelector excludeCategories={[TAG_CATEGORY_MYCOMBO_STATUS]} />` の指定は **変更しない**(M3-02 で確定した責務分離をそのまま維持)。

結果として、通常タグの選択は TagSelector のみ、マイコンボステータスの選択は `MyComboStatusSelector` のみで行う 2 系統の入力 UI 構造になる。

#### 4.10.6 useEffect での同期(編集時)

編集モードで既存コンボのデータがロードされた際、フォーム状態の `mycomboStatus` を既存タグから初期化する `useEffect` を追加する。`useEffect(() => { if (combo) setForm(...) }, [combo])` のような既存パターンを拡張する形で実装。

### 4.11 コンボ一覧画面へのマイコンボステータス列追加(経路 2、v1.0.4 で新設)

#### 4.11.1 設計背景

経路 1(コンボ編集画面)で初回登録経路は確保されるが、既存コンボ多数に対して「あのコンボを練習中に変える」のような素早い操作には、一覧から直接ステータスを変更できる経路があると UX が向上する。本節 v1.0.4 で、コンボ一覧画面の各行にマイコンボステータス列を追加する。

#### 4.11.2 配置と UI

対象ファイル: `web/src/features/combo/components/ComboTableRow.tsx`(または相当のコンボ一覧テーブルの行を描画しているコンポーネント)

配置: **タグ列(tags)の直後、アクション列(コピー / 編集 / 削除アイコン群)の直前** を推奨(タグ概念と近接させる)。製造担当のレイアウト判断で他の位置も許容する。

UI 構造例:

```
[始動状況][ダメージ][ルート][タグ][マイコンボステータス ▼][仮登録][メモ][アクション]
```

実装方針:

- 各行に `<MyComboStatusSelector mode="immediate" comboId={combo.id} comboVersion={combo.version} currentTags={combo.tags} mycomboStatusTags={mycomboStatusTags} currentStatus={resolveStatus(combo.tags)} />` を配置
- マイコンボ画面と同じ `useUpdateMyComboStatus` フックを内部で利用(`mode='immediate'`)
- `resolveStatus` は既存タグから `mycombo_status` カテゴリのタグを探して内部コード値に逆変換するヘルパ(§4.10.3 と同じロジックを共通ヘルパ化することを推奨)

#### 4.11.3 表示列カスタマイズ対象外

本列は `useColumnVisibility` の表示列カスタマイズ対象に **含めない**(マイコンボ画面のステータス列と同じ扱い、固定列)。理由:

- マイコンボステータス管理は M3-04 で確立した主要操作経路の一部、非表示にする意義が薄い
- M3-03 で確定した `ColumnVisibility` 型の6フィールドに影響を与えない(M3-03 設計を歪めない)

#### 4.11.4 「マイコンボから外す」選択肢の表示

コンボ一覧画面のプルダウンには「マイコンボから外す」も含まれる(マイコンボ画面と同じ 4 選択肢)。これにより、コンボ一覧画面から既存コンボをマイコンボから除外する操作も可能。

#### 4.11.5 ラベル表示の調整(任意)

「マイコンボから外す」(値: 空文字)の選択中状態を一覧でどう見せるかは製造担当判断:

- 案 A: プルダウンの選択肢欄に「マイコンボから外す」と表示
- 案 B: プルダウンの選択肢欄に「未登録」「-」「(なし)」のような表示
- 案 C: プルダウン自体を選択中項目に応じて色変え

本指示書では明示せず、製造担当の UX 判断に委ねる。マイコンボ画面のプルダウンと同じ文言にする方が一貫性は高い(案 A 推奨)。

### 4.12 設計判断事項(本指示書で確定済み)

以下は本指示書で確定済みの設計判断。製造担当 Claude Code は推測で別案を選ばない。

| 項目 | 確定内容 | 根拠 |
|------|---------|------|
| **character API ハンドラ** | **本マイルストーンで新規実装**(`internal/api/character/handler.go` + service / repository、M1-03 コンボ系3層パターン踏襲、§4.0) | DES-002 §4.2 L133、v1.0.1 でスコープ拡張 |
| **character API レスポンス形式** | `{"items": [...]}` ラッパー付き | progress-log.md M2-01 完了報告 L41、`/api/combos` と整合 |
| 画面方式 | **別画面方式**(独立ルート `/mycombo`) | DES-005 §5.5、M3-overview v1.0.2 |
| キャラクター API パス | `GET /api/games/{id}/characters`(`/api/characters` ではない) | DES-002 §4.2 L133 |
| DEFAULT_GAME_ID | `1`(SF6 の game_id、§3.4.3 で確認) | M1-02 seed |
| Character 型の JSON タグ | camelCase(`id` / `gameId` / `name` 等) | CLAUDE.md §4 |
| 列挙定数 MyComboStatus | バックエンド `internal/model/tag.go` + フロント `web/src/constants/mycombo.ts` で同期定義(`in_use` / `practicing` / `reduced`) | CLAUDE.md §4 列挙定数同期ルール |
| 列挙定数とタグ名のマッピング | 内部コード値(`in_use` 等)とタグ name(`使用中` 等)を別概念として管理、マッピング定数を提供 | 内部実装と DB seed の責務分離 |
| URL クエリ設計 | `?status=in_use` 等で選択中タブを表現、未指定時は `in_use`(使用中)が既定 | M3-03 の URL クエリ連動と同じ思想 |
| 表示列カスタマイズ | M3-03 の `useColumnVisibility` をそのまま再利用、キーは `combo-list-columns-v1` を共用 | §4.4 確定 |
| キャラ切替プルダウン | M3 はリュウのみで disabled 表示、M7 拡張基盤として実装 | 上振れ要素3 |
| 件数ダッシュボード | M3-01 `GET /api/tags?include_usage=true&category=mycombo_status` を活用 | 上振れ要素1 |
| カウントバッジ | 各タブに `(N)` 形式で件数表示、0 件でも `(0)` | 上振れ要素2 |
| CHARACTER_NAMES 定数 | 完全削除(全参照差し替え後) | §4.1.5 |
| shadcn/ui 使用 | 不使用、標準 HTML + Tailwind 自作 | playbook §4.6 |
| **バックエンド変更スコープ** | character API ハンドラ新規実装に限定、その他は変更なし | §2.4(v1.0.1 で character API を正式スコープに含める) |
| **マイコンボステータス変更 UI** | **3 経路で実装**: マイコンボ画面(§4.9) / コンボ編集画面(§4.10、保存遅延モード) / コンボ一覧画面(§4.11、即時 PATCH モード)。全経路で `MyComboStatusSelector` を `mode` props で共通利用 | DES-005 §5.4 / §5.5 / §5.6 アクション解釈、v1.0.4 で 3 経路に拡張 |
| **ステータス変更プルダウンの選択肢** | 4種: 使用中 / 練習中 / 頻度低下 / マイコンボから外す(空文字)。3 経路すべて同一 | §4.9.2 / §4.10 / §4.11 |
| **MyComboStatusSelector の経路間共通化** | `mode: 'immediate' \| 'deferred'` props でモード切り替え、コンポーネント分散を防ぐ | §4.9.2、v1.0.4 で導入 |
| **コンボ編集画面の専用ドロップダウン配置** | TagSelector の **直前** を推奨。製造担当のレイアウト判断で隣接位置(直後・別セクション)も許容 | §4.10.2 |
| **コンボ一覧画面のステータス列の位置** | タグ列の直後・アクション列の直前を推奨。製造担当のレイアウト判断で他の位置も許容 | §4.11.2 |
| **TagSelector / TagBadgeList の責務分離維持** | コンボ編集画面 `TagSelector` および コンボ一覧画面 `TagBadgeList` は M3-02 で確定した `excludeCategories={[TAG_CATEGORY_MYCOMBO_STATUS]}` を維持。マイコンボステータスは専用 UI(`MyComboStatusSelector`)経由でのみ操作 | M3-02 §4.7、v1.0.4 で再確認 |
| **楽観的更新** | M3-04 では実装しない(PATCH レスポンス受領後のキャッシュ無効化のみで十分) | §4.9.4、UX 改善は将来要件 |
| **ステータス変更プルダウン列の表示列カスタマイズ対象** | 含めない(マイコンボ画面でのみ常時表示する固定列) | §4.9.5、`ColumnVisibility` 型に影響を与えない |

---

## 5. テスト要件

### 5.1 必須テスト

#### 5.1.0 character API バックエンドテスト(M3-04 §4.0 新規実装の検証)

**サービス層テスト**: `internal/service/character/service_test.go`

- `List` で game_id=1 を渡すとリュウを含むキャラクター配列が返る
- `List` で存在しない game_id を渡すと空配列が返る(エラーにしない)
- リポジトリ層エラー時にラップされたエラーが返る

**リポジトリ層テスト**: `internal/repository/character/repository_test.go`(複雑クエリのみ、SUPP-001 §5.4)

- `List` で game_id フィルタが効くこと(他ゲームのキャラを返さない、ただし M3 段階では SF6 のみ seed のため簡易確認)

**ハンドラ層テスト**: `internal/api/character/handler_test.go`

- `GET /api/games/1/characters` → 200 + `{"items": [...]}` 構造
- `GET /api/games/abc/characters`(不正な game_id) → 400 + INVALID_GAME_ID
- `GET /api/games/999/characters`(存在しない game_id) → 200 + `{"items": []}`(空配列)

#### 5.1.1 useCharacters フックのテスト

`web/src/features/character/hooks/useCharacters.test.ts`:

- `useCharacters()` のクエリキー検証
- API レスポンス成功時のキャラクター配列返却
- API レスポンス失敗時のエラーハンドリング
- `useCharacterName(id)` で正しい名前が返る
- `useCharacterName(null)` で空文字が返る
- `useCharacterName(存在しないid)` で空文字が返る

#### 5.1.2 useMyComboStatusCounts フックのテスト

`web/src/features/mycombo/hooks/useMyComboStatusCounts.test.ts`:

- 3つのタグそれぞれの `usage_count` から正しい件数を集計
- タグデータが存在しない場合は 0 件
- 一部タグのみ存在する場合、欠けているタグは 0 件

#### 5.1.2-A useUpdateMyComboStatus フックのテスト(v1.0.3 で追加)

`web/src/features/mycombo/hooks/useUpdateMyComboStatus.test.ts`:

- 新ステータス指定時、現タグから mycombo_status カテゴリのタグを除外し、新規ステータスのタグ ID を追加した tagIds で PATCH を呼ぶ
- 「マイコンボから外す」(空文字)指定時、現タグから mycombo_status カテゴリのタグを除外した tagIds で PATCH を呼ぶ
- PATCH 成功時、`['combos']` と `['tags']` の queryKey に対して invalidateQueries が呼ばれる
- API レスポンス失敗時のエラーハンドリング
- 楽観的排他制御失敗(409)時のエラーハンドリング

#### 5.1.3 コンポーネントテスト

- `CharacterInfoBar.test.tsx`: キャラ名・件数ダッシュボードの表示確認、件数 0 時の表示分岐
- `MyComboStatusTabs.test.tsx`: タブ切替で onSelect 発火、選択中タブのハイライト、件数バッジ表示
- `CharacterSelector.test.tsx`: プルダウン表示、1キャラのみ時の disabled、onChange 発火
- **`MyComboStatusSelector.test.tsx`(v1.0.3 で追加、v1.0.4 でモード別テストに拡張)**:
  - 共通: 4選択肢の表示、`currentStatus` props が初期選択値として反映、ラベル文字列が `MYCOMBO_STATUS_LABELS` 定数経由(リテラルチェック)
  - **`mode='immediate'`**: 選択変更で `useUpdateMyComboStatus` の mutation が発火、`comboId` / `comboVersion` / `currentTags` 必須
  - **`mode='deferred'`**: 選択変更で `onChange` コールバックが発火、API 呼び出しはされない
- `MyComboPage.test.tsx`: 統合動作(各サブコンポーネントの組合せ、URL クエリ反映、ステータス変更後のテーブル再レンダリング)
- **`ComboEditorBasicFields.test.tsx` または同等(v1.0.4 で追加、§4.10)**:
  - TagSelector の直前(または隣接位置)に `MyComboStatusSelector` が `mode='deferred'` でマウントされている
  - フォーム状態 `mycomboStatus` の初期値: 新規時は空文字、編集時は既存タグから判定
  - 選択変更でフォーム状態 `mycomboStatus` が更新される
  - 保存時の tagIds ペイロード構築で、`mycomboStatus !== ''` ならマイコンボステータスタグ ID が含まれ、`mycomboStatus === ''` なら含まれない
  - 編集時、既存タグの `mycombo_status` カテゴリ以外は保持される
- **`ComboTableRow.test.tsx` または同等(v1.0.4 で追加、§4.11)**:
  - 各行に `MyComboStatusSelector` が `mode='immediate'` でマウントされている
  - `currentStatus` props が当該コンボの `tags` から正しく逆引きされる
  - ステータス列が表示列カスタマイズ(`useColumnVisibility`)の対象に含まれない(非表示にできないことのテスト)

#### 5.1.4 既存テストの回帰確認

- `DuplicateRealtimeWarning.test.tsx`(M2-02 で実装): `CHARACTER_NAMES` → `useCharacterName` 差し替え後も既存テストが通る
- その他 `CHARACTER_NAMES` 参照箇所のテストすべて
- M3-02 のタグ付与テスト(`PATCH /api/combos/:id` 関連): ステータス変更 UI(3 経路すべて)経由の PATCH も既存ハンドラに到達する確認
- M3-02 で確定した「TagSelector / TagBadgeList が `mycombo_status` カテゴリを除外」する責務分離が v1.0.4 でも壊れていないことの確認テスト

#### 5.1.5 ビルド・型チェック

- `cd web && pnpm test` 全通過
- `cd web && pnpm build` 成功
- TypeScript 型エラーなし
- `grep -rn 'CHARACTER_NAMES' web/src/` で参照ゼロ(定数削除完了確認)

### 5.2 E2E シナリオ

開発者が実機ブラウザで以下を順に実行し、すべて通ることを確認する。

```
## E2E シナリオ

### A. マイコンボ画面への遷移
1. /combos でコンボ一覧を開く(複数のコンボにマイコンボステータスタグが付いた状態を事前準備)
2. 主要ナビゲーションの「マイコンボ」リンクをクリック → /mycombo に遷移
3. 画面上部にキャラクター情報バーが表示される(リュウ・件数ダッシュボード:使用中 X / 練習中 Y / 頻度低下 Z)
4. キャラクター切替プルダウンが表示され、「リュウ」が選択中、選択肢が1件のみで disabled

### B. マイコンボステータス切替タブ
5. 「使用中」「練習中」「頻度低下」の3タブが表示され、各タブに件数バッジ「(N)」が表示される
6. 既定で「使用中」タブが選択されている、URL は `/mycombo?status=in_use`
7. 該当するコンボ一覧が表示される(「使用中」タグを持つコンボのみ)
8. 「練習中」タブをクリック → URL が `/mycombo?status=practicing` に変わる、コンボ一覧が「練習中」のものに切り替わる
9. 「頻度低下」タブも同様に動作

### C. URL シェア・ブラウザ戻る
10. `/mycombo?status=practicing` の URL を直接コピーして別タブで開く → 同じ状態(練習中タブ選択中)で表示される
11. ブラウザの戻るボタンで前のタブ状態に戻る

### D. コンボ一覧と同じソート・表示列カスタマイズ
12. ソート種別を「ダメージ」「大きい順」に変更 → マイコンボ画面でもダメージ降順で並び替え
13. 表示列カスタマイズで「ルート」のチェックを外す → ルート列が消える
14. /combos に戻る → コンボ一覧画面でも「ルート」が消えている(localStorage 共用の確認)

### E. キャラクター情報バーの件数連動
15. マイコンボ画面でコンボにタグを追加・削除すると、件数ダッシュボードとカウントバッジが更新される(タグ更新後にページリロードで反映でも可、リアルタイム反映の場合は TanStack Query 再取得で動作)

### F. 既存機能の回帰
16. DuplicateRealtimeWarning(M2-02、コンボ編集中の重複警告)でキャラクター名が正しく表示される(useCharacters 差し替え後の動作確認)
17. CHARACTER_NAMES 定数を直接参照していた他の箇所(ComboEditor 等)でもキャラクター名が正しく表示される
18. M3-01 タグ管理画面、M3-02 タグ付与、M3-03 コンボ一覧フィルタ・ソート・表示列カスタマイズが回帰なく動作する

### G. 主要ナビゲーション
19. ヘッダ/サイドバーの主要ナビゲーションに「マイコンボ」リンクが追加されている(DES-005 §4.2.1)
20. 各画面(コンボ一覧・タグ管理・ゴミ箱・マイコンボ・設定)から相互遷移できる

### H. マイコンボステータス変更 UI(v1.0.3 で追加)
事前準備: マイコンボ画面に **既に「使用中」タグが付いたコンボが少なくとも1件ある状態** を作る(以下のいずれか):
- 案 1: `sqlite3 data/combomgr.db "INSERT INTO combo_tags (combo_id, tag_id) VALUES (<コンボID>, <使用中タグID>);"`(直接 SQL)
- 案 2: タグ管理画面(M3-01)から「使用中」タグの ID を確認の上、別経路で `combo_tags` に挿入
- 案 3: バックエンド開発時の手作業 seed

21. /mycombo の「使用中」タブを開く → 該当コンボが表示される、ステータス変更プルダウンが「使用中」を選択中
22. プルダウンで「練習中」を選択 → PATCH リクエストが飛ぶ(ブラウザの DevTools Network タブで確認)
23. 「使用中」タブから該当コンボが消える、件数バッジが `使用中 (1)` → `使用中 (0)` に更新
24. 「練習中」タブに切り替え → 該当コンボが表示される、件数バッジが `練習中 (0)` → `練習中 (1)` に更新
25. プルダウンで「頻度低下」を選択 → 「練習中」タブから消え、「頻度低下」タブに移動、件数ダッシュボードも連動更新
26. プルダウンで「マイコンボから外す」を選択 → 全タブから消える、件数ダッシュボードがすべて 0 に
27. タグ管理画面(/tags/manage)で該当コンボの tags を確認 → `mycombo_status` カテゴリのタグが付いていない状態
28. コンボ一覧画面(/combos)で該当コンボを開く → コンボ編集画面の TagSelector に `mycombo_status` カテゴリの選択肢が出ない(M3-02 で確定した責務分離が維持されていることを確認)

### I. コンボ編集画面からの初回登録(v1.0.4 で追加)
29. /combos/new で新規コンボを開く
30. コンボ名・ダメージ等を入力
31. 「マイコンボステータス」ドロップダウンで「練習中」を選択(TagSelector の直前に配置されていることを確認)
32. 保存 → コンボ一覧へのリダイレクトまたは保存完了表示
33. /mycombo の「練習中」タブに遷移 → 作成したコンボが表示される
34. 件数バッジとダッシュボードの「練習中」件数が +1 されている
35. /tags/manage で該当コンボの tags を確認 → `mycombo_status: 練習中` タグが付与されている

### J. コンボ編集画面からのステータス変更(v1.0.4 で追加)
36. シナリオ I で作成したコンボを編集画面で開く(/combos/:id/edit)
37. 「マイコンボステータス」ドロップダウンが「練習中」を選択中で表示される
38. 「使用中」に変更 → 保存
39. /mycombo の「使用中」タブに該当コンボが現れ、「練習中」タブから消える

### K. コンボ一覧画面からのステータス変更(v1.0.4 で追加)
40. /combos のコンボ一覧で該当コンボの行を見る → ステータスプルダウンが「使用中」を選択中で表示される
41. プルダウンで「頻度低下」を選択 → PATCH が飛ぶ(DevTools Network タブで確認)
42. /mycombo の「頻度低下」タブに該当コンボが現れる
43. コンボ一覧画面で該当コンボの行に戻る → プルダウンが「頻度低下」を選択中で表示

### L. コンボ一覧画面からの初回登録(v1.0.4 で追加)
44. /combos/new で **マイコンボステータスを未設定のまま** コンボを保存(ドロップダウンを「マイコンボから外す」または空状態のまま)
45. /combos で該当コンボの行を見る → ステータスプルダウンが「マイコンボから外す」(または空状態)
46. プルダウンで「練習中」を選択 → PATCH が飛ぶ
47. /mycombo の「練習中」タブで該当コンボが表示される

### 複数経路の整合性(v1.0.4 で追加)
48. 任意のコンボに対し、**3 経路のうちどれか 1 つでステータスを設定** → 他の 2 経路のプルダウンを見て同じステータスが選択中で表示される(三者間の状態同期確認)
49. M3-02 で確定した責務分離の維持確認: コンボ編集画面の `TagSelector` に `mycombo_status` カテゴリのタグが出てこない、コンボ一覧画面のタグ列(`TagBadgeList`)に `mycombo_status` タグが表示されない
```

これが見えるまで DoD 不達成。

---

## 6. レビュー観点(別ファイル参照)

レビュー観点は以下のチェックリストに記載する: `docs/instructions/reviews/M3-04-review-checklist.md`

製造担当 Claude Code は本ファイルを読む必要はない。本指示書本体に集中する。

---

## 7. 完了条件(Definition of Done)

### 7.1 機能要件

- [ ] §2.1 のファイル一覧が全て作成されている(バックエンド character 3層 + フロント mycombo / character 系)
- [ ] §2.2 のファイル修正が実施されている
- [ ] **character API ハンドラ(`GET /api/games/{id}/characters`)が動作する**(`curl` で 200 + `{"items": [...]}` 確認)
- [ ] useCharacters フックが動作し、CHARACTER_NAMES 定数参照が全て差し替えられている(参照ゼロ確認)
- [ ] マイコンボ画面が独立画面として動作する(`/mycombo` ルート)
- [ ] キャラクター情報バー + 件数ダッシュボードが動作する
- [ ] マイコンボステータス切替タブ + カウントバッジが動作する
- [ ] キャラクター切替プルダウンが基盤として実装されている(M3 はリュウのみで disabled)
- [ ] 主要ナビゲーションに「マイコンボ」リンクが追加されている
- [ ] **マイコンボステータス変更 UI が 3 経路すべてで動作する**(マイコンボ画面 / コンボ編集画面 / コンボ一覧画面、各経路でプルダウンが表示・選択でき、状態が三者間で同期する)
- [ ] §5.2 E2E シナリオ A〜L が全て通過する

### 7.2 自己テスト結果(製造担当の責任範囲)

**バックエンド側**:

- [ ] `make test` または `go test ./...` が全通過する(character 系の新規テスト含む、既存テストも回帰なし、M3-02 タグ付与 PATCH の回帰確認も含む)
- [ ] 主要 API を `curl` で叩き、レスポンスを報告書に貼付する:
  - `curl http://localhost:47318/api/games/1/characters` → 200 + `{"items": [リュウを含むキャラ一覧]}`
  - `curl http://localhost:47318/api/games/abc/characters` → 400 + INVALID_GAME_ID
  - `curl http://localhost:47318/api/games/999/characters` → 200 + `{"items": []}`
  - **マイコンボステータス変更動作の確認**: 任意のコンボ ID に対して `PATCH /api/combos/<id>` で `{"tagIds": [<使用中タグID>], "version": <現version>}` を送り、200 が返ることを確認(M3-02 で実装済みハンドラの回帰確認、新規 API なし)
- [ ] §3.4.1 / §3.4.2 / §3.4.3 / §3.4.5 着手前確認の出力を含める

**フロントエンド側**:

- [ ] `cd web && pnpm test` が全通過する
- [ ] `cd web && pnpm build` が成功する
- [ ] TypeScript の型エラーが残っていない
- [ ] 開発サーバー起動時にコンソール警告が新規発生していない
- [ ] `grep -rn 'CHARACTER_NAMES' web/src/` で参照ゼロを確認
- [ ] 開発者向けの「動作確認手順書」を実装完了報告に含める

ブラウザでの実機動作確認・スクリーンショット取得は **開発者の責任範囲**。

### 7.3 品質チェック

- [ ] CLAUDE.md の禁止事項に抵触していない
- [ ] **JSON タグ・API DTO 型が camelCase で統一されている**(CLAUDE.md §4)
- [ ] **MyComboStatus 列挙定数がバックエンド・フロントで同期**(CLAUDE.md §4 / SUPP-001 §6.4)
- [ ] **リテラル文字列が散在していない**(`"in_use"` / `"practicing"` / `"reduced"` / `"使用中"` 等が定数経由で参照)
- [ ] ブラウザストレージ未使用(M3-04 では useColumnVisibility 経由のみ、既存のキー `combo-list-columns-v1` を共用)
- [ ] `console.log` / `fmt.Println` を本番コードに残していない
- [ ] 設計書本体(DES-005 §3 / §4.2.1 / §5.5、DES-002 §4.2)と実装が一致している
- [ ] **playbook §4.5 / §4.6 / §4.7 の3ルールに抵触していない**
- [ ] **shadcn/ui を使用していない**(標準 HTML + Tailwind 自作、playbook §4.6)
- [ ] **character API ハンドラ実装が M1-03 コンボ系3層パターンに整合**(handler / service / repository の責務分離、godoc コメント、エラー wrap、`{"items": [...]}` レスポンス形式)
- [ ] **Character モデルの JSON タグが camelCase**(`json:"id"` / `json:"gameId"` / `json:"name"`、DB の snake_case と分離)
- [ ] character API ハンドラのテストが3層それぞれに追加されている(§5.1.0)

### 7.4 ドキュメント

- [ ] `docs/progress/progress-log.md` に M3-04 完了報告を追記する
- [ ] **character API ハンドラ新規実装の事実**(本マイルストーンでのスコープ拡張、設計担当の指示書執筆ミスを踏まえた追加対応)を明記
- [ ] M2-02 持ち越し課題1(`CHARACTER_NAMES` → `useCharacters`)の解消事実を明記
- [ ] 上振れ要素3項目の実装事実を明記
- [ ] §3.4 着手前確認結果を含める(全7項目)

### 7.5 完了報告

- [ ] 開発者に「M3-04 が完了しました」と報告
- [ ] §7.1〜§7.4 の自己テスト結果を報告書に含める

---

## 8. 参照ドキュメント

| ID | パス | 関連節 |
|----|------|-------|
| CLAUDE.md | `CLAUDE.md` | **§4 JSON タグ camelCase / 列挙定数同期**、§10 禁止事項 |
| M3-overview v1.0.2 | `docs/instructions/M3-overview.md` | **§3.4 M3-04 詳細(別画面方式)**、§6 運用ルール |
| M3-01 指示書 | `docs/instructions/M3-01-tag-feature-and-management.md` | タグ API、usage_count |
| M3-02 指示書 | `docs/instructions/M3-02-tag-assignment-ui.md` | コンボ DTO の tags フィールド |
| M3-03 指示書 v1.0.2 | `docs/instructions/M3-03-filter-sort-column-customize.md` | 共通ヘルパ・useComboListFilters・useColumnVisibility |
| M2-02 指示書 | `docs/instructions/M2-02-edit-ux-improvements.md` | CHARACTER_NAMES 導入経緯 |
| DES-002 | `docs/design/02-architecture.md` | **§4.2 GET /api/games/{id}/characters(L133)** |
| DES-003 | `docs/design/03-data-model.md` | §3.6 tags、§3.7 combo_tags |
| DES-005 | `docs/design/05-screen-design.md` | **§3 画面遷移図(L56)**、**§4.2.1 主要ナビゲーション(L99)**、**§5.5 マイコンボ(L238-251)**、§5.4 コンボ一覧 |
| SUPP-001 v1.9.0 | `docs/design/supp-001-detailed-design.md` | §5.4 / §5.5 テスト規約、**§6.4 列挙定数同期ルール** |
| playbook v1.4.0 | `docs/handover/design-instruction-playbook.md` | **§4.5 素直さ原則**、**§4.6 UI ライブラリ実態確認**、§4.7 全ハンドラ列挙(参考) |

---

## 9. 注意事項・判断に迷ったら

### 9.1 推測で進めてはいけない事項

以下は推測で進めず、Plan Mode で開発者に確認する:

- §3.4.1 で `GET /api/games/1/characters` が **404 ではなく既に動作している** 場合(本マイルストーン着手前に他経路で実装されていた可能性、状況確認のため停止)
- §3.4.2 で characters テーブルの DDL が想定と異なる場合(`code` カラムの有無、外部キー制約等)、または characters テーブル自体が存在しない場合
- §3.4.3 で SF6 の game_id=1 または characters テーブルにリュウが seed されていない場合
- §3.4.4 で `CHARACTER_NAMES` 参照箇所が想定外の場所(テストヘルパ・ストーリブック等)に存在する場合
- §3.4.5 で M3-01 タグ API の `usage_count` フィールドが想定と異なる場合
- §3.4.6 で `useComboListFilters` / `useColumnVisibility` が想定と異なる構造の場合
- §3.4.7 でルーティング構造が想定と異なる場合
- §4.0 character API ハンドラ実装で、既存のコンボ系 3 層パターン(M1-03)の import パスや構造が大きく変わっている場合
- マイコンボ画面でコンボ一覧テーブル(M3-03 で実装)を再利用しようとして、テーブルコンポーネントが画面固有の依存(`/combos` 専用の遷移ロジック等)を持っている場合
- 上振れ要素(件数ダッシュボード・カウントバッジ・キャラ切替)が実装難易度的に困難と判明した場合(基本実装に絞るか、Plan Mode で開発者と協議)

### 9.2 推測で進めてよい事項(その旨を明示)

以下は推測で進めてよいが、実装時に「推測:〜と仮定した」とコード内コメントまたは PR 説明に明示する:

- キャラクター情報バーのレイアウト細部(アイコン円の直径、件数表示のフォントサイズ等)
- マイコンボステータス切替タブのデザイン細部(選択中のハイライト色、ホバー時の挙動)
- キャラクター切替プルダウンの disabled 表示スタイル
- レスポンシブ対応の breakpoints(Tailwind の `md:` / `lg:` 等)

### 9.3 不明事項発見時の対応

- 設計書本体(DES-002 §4.2 / DES-005 §3 / §4.2.1 / §5.5)と本指示書の記述が乖離している場合 → 実装を止めて開発者に報告し、CHANGE 通知書起票要否を協議する
- 本指示書の §4 詳細仕様で具体化されていない実装判断が必要になった場合 → §9.2 の範囲なら推測で進めて明示、それ以外は Plan Mode で開発者確認

### 9.4 Plan Mode で計画提示時に含めるべき項目

Plan Mode を使う場合(本マイルストーンはスコープ拡張のため Plan Mode 推奨)、以下を計画に含める:

- §3.4 着手前確認の結果(全7項目: §3.4.1〜§3.4.7)
- **character API 3 層実装の順序**(repository → service → handler → ルート登録 → テスト、§4.0)
- 実装全体の順序(BE character 3 層 → FE useCharacters → FE CHARACTER_NAMES 差し替え → FE マイコンボ画面の基本実装 → 上振れ要素3項目)
- 既存 `CHARACTER_NAMES` 参照箇所のリストと差し替え方針
- マイコンボステータスタブとコンボ一覧テーブルの統合方針(コンボ一覧テーブルを再利用するか、専用テーブルとして新規実装するか)
- character API レスポンスの `Character` モデルに含めるフィールド(`code` 等の追加カラムの有無を §3.4.2 確認結果に基づき決定)

---

## 10. 完了後の次ステップ

M3-04 完了後、開発者の動作確認・承認を経て M3-05(コンボ一覧仕上げ:レシピ表示改善 + 始動技表示改善 + M3 統合)に進む。M3-05 では本指示書で完成したマイコンボ画面と、M3-03 で完成したフィルタ・ソート・表示列カスタマイズを統合した E2E 動作確認を行い、M1-05 暫定処理1・3(レシピ表示・始動技 ID 表示)、M2-04 持ち越し課題4(useControllerInput console.warn テスト追加)、本マイルストーン経由で確定した持ち越し課題「フィルタ適用時の空状態メッセージ改善」を解消する。

---

*以上*

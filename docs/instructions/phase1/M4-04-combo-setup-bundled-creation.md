# 指示書 M4-04: コンボ + セットプレイ同時登録(API DTO 拡張 + 同時登録 UI + useCreateCombo 拡張)

| 項目 | 内容 |
|------|------|
| 指示書ID | M4-04 |
| バージョン | 1.0.2 |
| 対象マイルストーン | M4(セットプレイ系) |
| 推奨モデル | **Opus 4.6** |
| Plan Mode | **必須**(コンボ作成 API のトランザクション設計、UI と API の境界、前方互換確認が絡む) |
| 機械レビュー | **必須**(別チェックリスト: `docs/instructions/reviews/M4-04-review-checklist.md`) |
| 並列性 | **単独**(M4 は完全直列、M4-03 完了承認済みが前提) |
| 依存指示書 | M4-01(setup CRUD API + DTO 予約)、M4-02(setup フロントエンド基盤)、M4-03(FR011 + knockdown モーダル)、M2-02(編集 2 方式分離) |
| 想定所要時間 | 120〜150 分 |
| 作成者 | 詳細設計・製造準備担当 Claude(M4 期間担当) |
| 作成日 | 2026-05-19 |

## 更新履歴

| バージョン | 更新日 | 更新内容 |
|-----------|--------|----------|
| 1.0.0 | 2026-05-19 | 初版作成。M4-overview v1.1.3 §3.5(分割後の M4-04 スコープ)/ DES-005 §5.7 item 10「セットプレイ登録セクション」を踏まえて起票。M4-01 §4.2.7 で予約された `Setups json.RawMessage` 形を `[]CreateSetupInput` に置換する本実装、フロント側コンボ登録/編集画面の同時登録セクション UI、useCreateCombo の setups 引数対応を含む。M4 統合 E2E + L-01 解消は M4-05 で分離(M4-overview v1.1.3 で確定)。M4-1〜M4-10 反省踏襲:既存実装の確認(M4-1)、パッケージ依存確認(M4-2)、DTO 構造の既存パターン整合(M4-3)、UI 動線からの API 網羅性(M4-4)、Props 最小化 + SetupSummary 軽量型再利用(M4-5)、設計書 §5.x ペア読み(M4-6)、規定なしも明示(M4-7)、既存 UI 基盤の実態確認(M4-8)、queryKey flat tuple 規約(M4-9)、トランザクション SQL 境界値網羅検証 + E2E 不具合診断時のリロード後確認(M4-10) |
| 1.0.1 | 2026-05-20 | 製造担当 Plan Mode 中の連絡事項 2 件を受けた指示書改訂。(1) **仮想コントローラの取り扱い: 個別 VC 採用(案 1)**: v1.0.0 §4.7.3 の「共用 VC + フォーカス管理で切替」は既存 `SetupRecipeEditor`(VC 内蔵型)の構造を確認せずに書いた誤り。各 `SetupInputRow` が `SetupRecipeEditor` を個別レンダリングする方式に修正(`RecipeBuilder` 変更なし、M4-04 スコープ内で完結、M5+ で共用化検討)。本件は M4-1 / M4-3 / M4-8 / M4-9 / M4-10 と同根の「実コード確認の省略」として retrospective-log v1.0.13 §5.1 M4-11 に独立記録。(2) **copy モードでも同時登録セクションを表示(案 1 + 選択肢 c)**: v1.0.0 §1.4 は新規登録モードを `/combos/new` 等と曖昧に記述していたが、DES-005 §5.6「コピーボタン → コンボ登録画面(新規登録モード)」との整合性から、`POST /api/combos` でコンボを新規作成するフロー全般(`new` および `copy`)で同時登録セクションを表示するよう明確化。copy モードでのコピー元 setups の扱いは「引き継がない、空表示」を確定(M4-04 スコープ最小化、FR012 本来意図との整合)。本件は指示書執筆時の規定明示漏れだが、製造担当 Plan Mode で発覚 + v1.0.1 明文化で完結する性質(M4-7 と同パターン、retrospective-log への独立記録対象ではない)。改訂対象節: §1.4 / §4.7.3 / §4.9.1 / §4.10 |
| 1.0.2 | 2026-05-20 | M4-04 実装完了後のレビュー指摘 + 製造担当の調査結果を受けた指示書改訂。v1.0.0〜v1.0.1 §4.8 / §3.4.4 で「`LinkExistingSetupModal` をそのまま再利用」と規定していたが、製造担当が実態確認した結果、`LinkExistingSetupModal` は **mutation 実行付き**(`useCreateSetupLink` を内部で呼び出す)であり、新規登録モード(コンボ未作成)では再利用不可能であることが判明。製造担当が `SetupSelectorModal`(選択のみのピッカー)を新規実装する判断を下し、レビュー指摘との整合を本指示書 v1.0.2 改訂で正式化。設計担当(私)が `LinkExistingSetupModal` の責務(mutation 実行付き)を確認せずに「再利用」と規定したのが根本原因 = M4-1 / M4-3 / M4-8 / M4-9 / M4-10 / M4-11 と同根の **「実コード確認の省略」が 7 件目** として retrospective-log v1.0.14 §5.1 M4-12 に独立記録。改訂対象節: §2.1 ファイル一覧(SetupSelectorModal 追加)、§3.4.4 着手前確認(LinkExistingSetupModal 責務確認を必須化)、§4.8 全面改訂(SetupSelectorModal 新設)、§4.10 設計判断事項表(該当行を SetupSelectorModal 新設に変更)。**注**: 本改訂は当初 CHANGE-014 通知書とともに進めたが、開発者指摘で設計書本体(REQ-001 / DES-001〜DES-006)の変更を伴わない指示書 + レビューチェックリスト + retrospective-log のみの改訂 = playbook §16 規定の CHANGE 通知書起票基準に該当しないと判明、CHANGE-014 を欠番化(retrospective-log v1.0.15 §5.1 M4-15 参照)|

---

## 1. 背景と目的

### 1.1 背景

M4-01 で setup ドメインのバックエンド CRUD API が完成し、コンボ作成 API リクエスト DTO に `Setups json.RawMessage \`json:"setups,omitempty"\`` が **形のみ予約** された状態(本実装は M4-04 で行う約束)。M4-02 でセットプレイ単体 UI + 紐付け操作 UI、M4-03 で FR011 転用支援 + knockdown_advantage 確認モーダルが完成済み。

本指示書では DES-005 §5.7 item 10「セットプレイ登録セクション」(コンボ登録・編集画面内に複数セットプレイをまとめて登録できるセクション)を実装し、コンボ作成 API を **setups 束受領** に対応させる。これによりユーザーは「コンボを登録する流れの中で、そのコンボに紐付くセットプレイも一括で登録」できるようになる(FR004 系の同時登録、DES-005 §5.7)。

M4-04 完了後、M4-05 で M4 統合 E2E + L-01 オプショナル型解消に進む(M4-overview v1.1.3 §3.6)。

### 1.2 目的

- **コンボ作成 API の setups 束受領拡張**:
  - `POST /api/combos` リクエスト DTO の `Setups json.RawMessage`(M4-01 予約済み)を `Setups []CreateSetupInput` に本実装
  - サービス層でトランザクションスコープ: コンボ作成 → 親コンボ ID 取得 → セットプレイ作成 + combo_setups 紐付けを **順序実行 + 原子性確保**
  - VAL-S05 は **サービス層関数の引数レベル** で適用(CHANGE-012 §6.2 R-2 対策、リクエスト DTO 直下では parent_combo_id を要求しない)
- **フロント側コンボ登録・編集画面の同時登録セクション UI**(DES-005 §5.7 item 10):
  - 「このコンボに紐づくセットプレイをまとめて登録できる」見出し
  - 追加ボタンで入力行を増やせる(複数セットプレイ対応)
  - 各入力行: セットプレイ名、説明、レシピ入力(仮想コントローラ共用)
  - 既存セットプレイを紐付けるボタン(既登録セットプレイ選択モーダル、v1.0.2 で `SetupSelectorModal` を新規実装)
- **フロント側 useCreateCombo の setups 引数対応**:
  - 既存 `useCreateCombo` を拡張し、`setups: CreateSetupInput[]` 引数を受け取る
  - API クライアントとの整合(リクエスト JSON の `setups` フィールド)

### 1.3 このマイルストーンで作らないもの

- **M4 統合 E2E シナリオ** — **M4-05 で実施**(M4-overview v1.1.3 §3.6)
- **L-01 オプショナル型解消**(`ComboSummary` / `Combo` の `defaultRecipe?` / `starterMoveCode?` を必須型に変更)— **M4-05 で実施**
- **下書き保存仕様**(DES-005 §5.7 L343「ブラウザストレージ定期自動保存 + 復元ダイアログ」) — M5 以降、CHANGE 通知書必要
- **コンボ編集画面側の同時登録セクション**(編集モードでの新規セットプレイ追加機能) — **本指示書では新規登録モードのみ実装**。編集モードでの同時登録は M5 以降の判断(DES-005 §5.7 item 10 は新規登録フローを主に想定、編集モードの仕様は明確化されていないため)
- **セットプレイの並び替え UI**(同時登録セクション内のセットプレイ行の順序入れ替え) — DES-005 §5.7 item 10 に並び替え仕様の明示がないため、本指示書では実装しない(M5 以降の判断)
- **持ち越し L-02 / L-03 解消** — M5 以降または M7

### 1.4 新規登録モード / 編集モードでの動作(明示、v1.0.1 で改訂)

本指示書のスコープを明確化するため、各モードでの本機能の動作を明示する:

- **新規登録モード**: 同時登録セクションが **表示される**(本指示書のスコープ)
  - 対象: `POST /api/combos` でコンボを新規作成するフロー全般
  - 具体的には: `/combos/new`(新規作成)+ `/combos/:id/copy`(コピー作成、DES-005 §5.6 「コピーボタン → コンボ登録画面(新規登録モード)」FR012 対応)
  - **copy モードでの動作**(v1.0.1 で確定、案 1 + 選択肢 c): コンボ本体のレシピ・メタデータはコピー元から初期値投入(FR012、既存挙動)、**同時登録セクションは空の状態で表示**(コピー元の setups は引き継がない、ユーザーが必要なら手動で追加・紐付け)
- **編集モード**: 同時登録セクションは **表示されない**(本指示書のスコープ外)
  - 対象: `/combos/:id/edit` 等
  - 代わりに、編集モードでは既存の「セットプレイ追加ボタン」(DES-005 §5.6 コンボ詳細画面のアクションから M4-02 で実装済み)からセットプレイ紐付け済み状態のセットプレイ登録画面に遷移する従来動線を維持

**新規登録モード(new + copy)で同時登録セクションを表示する根拠**:

- DES-005 §5.6 アクション節「コピーボタン → コンボ登録画面(**新規登録モード**、このコンボの内容を初期値として投入、タイトルは「新規登録(コピー元:◯◯)」。FR012対応)」と整合
- copy も `POST /api/combos` でコンボを新規作成するため、`setups` 引数を受け取る API 設計と整合
- ユーザーが「既存コンボをコピーして新規登録」する際でも setups の同時登録ができる UX

**copy モードでコピー元 setups を引き継がない根拠**(v1.0.1 で確定):

- FR012(コンボコピー)は「コンボのレシピ等を初期値として投入」を主眼としており、setups の引き継ぎは仕様外と読める
- 「コピー元の setups を引き継ぐ」仕様(選択肢 a / b)は M4-04 スコープを拡大する追加実装で、playbook §17.1「個人 OSS の規模感、過剰な抽象化・将来対応を避ける」と緊張
- 将来「コピー元 setups の引き継ぎ」仕様が必要になった場合は、DES-005 §5.6 アクション節の明確化 + CHANGE 通知書起票で対応可能(M5 以降)

**編集モードで同時登録セクションを表示しない根拠**:

- DES-005 §5.7 item 10 は新規登録の文脈で「コンボ作成と一緒にセットプレイも作る」フローを想定したものという解釈
- 編集モードでの同時登録仕様が DES-005 で明確化されていないため、M4-04 では対象外
- 将来明確化された段階で M5 以降に拡張可能

---

## 2. 成果物

### 2.1 作成するファイル

#### バックエンド(コンボ作成 API DTO 拡張)

| ファイル | 内容 |
|---------|------|
| `internal/api/combo/dto.go`(または相当、修正) | `CreateComboInput` の `Setups` フィールドを `json.RawMessage` から `[]CreateSetupInput` に置換 |
| `internal/service/combo/create.go`(または相当、修正) | コンボ作成サービスでトランザクション: コンボ作成 → 親コンボ ID 取得 → セットプレイ作成 + combo_setups 紐付け |
| `internal/service/combo/create_test.go`(または相当、修正) | setups 束受領のテスト追加(空配列、1件、複数件、setup 作成失敗時のロールバック等) |
| `internal/api/combo/handler.go`(または相当、修正) | リクエストパース時に `Setups []CreateSetupInput` を受け取る形に対応 |
| `internal/api/combo/handler_test.go`(または相当、修正) | ハンドラのテスト追加 |

#### フロントエンド(同時登録セクション)

| ファイル | 内容 |
|---------|------|
| `web/src/features/combo/components/SetupRegistrationSection.tsx`(新設) | 同時登録セクション本体(見出し + 追加ボタン + 入力行リスト + 既存紐付けボタン) |
| `web/src/features/combo/components/SetupRegistrationSection.test.tsx`(新設) | コンポーネントテスト |
| `web/src/features/combo/components/SetupInputRow.tsx`(新設) | 1 セットプレイ入力行(セットプレイ名 / 説明 / レシピ入力) |
| `web/src/features/combo/components/SetupInputRow.test.tsx`(新設) | 入力行コンポーネントテスト |
| **`web/src/features/setup/components/SetupSelectorModal.tsx`(新設、v1.0.2 で追加)** | **既存セットプレイ選択モーダル(選択のみのピッカー、`onSelect` コールバックで返す、mutation 実行ロジックなし)** |
| **`web/src/features/setup/components/SetupSelectorModal.test.tsx`(新設、v1.0.2 で追加)** | **モーダルコンポーネントテスト** |

#### フロントエンド(useCreateCombo 拡張)

| ファイル | 内容 |
|---------|------|
| `web/src/features/combo/hooks/useCreateCombo.ts`(または相当、修正) | `setups: CreateSetupInput[]` 引数の受け取り対応 |
| `web/src/features/combo/api/comboApi.ts`(または相当、修正) | `createCombo` メソッドの引数に `setups` 追加 |
| `web/src/features/combo/types.ts`(または相当、修正) | `CreateComboInput` 型に `setups?: CreateSetupInput[]` を追加 |

#### 既存ページの修正

| ファイル | 修正内容 |
|---------|---------|
| `web/src/pages/ComboEditorPage.tsx`(または相当、修正) | 新規登録モード(`mode === 'create'`)で `SetupRegistrationSection` を render、編集モードでは render しない。保存時に `useCreateCombo({ ..., setups })` で発火 |
| `web/src/pages/ComboEditorPage.test.tsx`(または相当、修正) | 新規登録モードでのセクション表示・編集モードでの非表示・保存時の setups 引数の確認テスト追加 |

### 2.2 変更しないもの(原則)

- M4-01 で実装した setup CRUD API のシグネチャ・既存エンドポイント(本指示書では新規 setup 作成サービス関数の **呼び出し方** のみ追加、API シグネチャは変更しない)
- M4-02 / M4-03 で実装した setup フロントエンド既存ファイル(v1.0.2 で `LinkExistingSetupModal` は **変更しない**、本指示書では `SetupSelectorModal` を新規実装する形で対応)
- M3 までに確立した combo 作成サービスの基本ロジック(本指示書では setups 引数を受け取った時の追加処理のみ拡張、既存のコンボ作成本体は不変)
- M3 までに確立したフック分離パターン(architecture-patterns.md §1)、TanStack Query queryKey 規約(architecture-patterns.md §1.1 v1.0.2、flat tuple + number 正規化)
- M4-03 で確立した `useUpdateCombo` の挙動(本指示書では `useCreateCombo` を拡張するのみ)
- DES-005 §5.7 (a)(b) 編集 2 方式分離(本指示書では新規登録モードのみ扱い、編集モードの保存方式は不変)

### 2.3 例外: バックエンドへの追加実装が許容される箇所

本指示書は **フロントエンドとバックエンド両方** を含む(コンボ作成 API DTO 拡張は M4-01 で予約された範囲、フロント側は新規 UI 追加)。許容される追加実装の範囲:

- §4.2 コンボ作成 API DTO 拡張(M4-01 §4.2.1 で予約された `Setups json.RawMessage` の本実装)
- §4.3 サービス層トランザクション処理追加

上記 2 件以外のバックエンド変更は禁止。万一実装中にこれら以外のバックエンド変更が必要と判断した場合、Plan Mode で停止して開発者に相談すること。

---

## 3. 前提条件

### 3.1 必読ドキュメント

製造担当 Claude Code は実装着手前に以下を読む:

| ID / ファイル | 関連節 |
|--------------|--------|
| 本指示書 | 全体 |
| CLAUDE.md | §4 TypeScript / Go 規約、§5 テスト規約、§10 禁止事項 |
| **DES-005 v2.8.0** | **§5.7 item 10 セットプレイ登録セクション、§5.7 編集保存の動作(CHANGE-013 反映後、本指示書では (a) 新規登録モードのみ扱う)** |
| DES-006 v1.9.0 | §3 VAL-S01〜S05(setup バリデーション、本指示書では setup 作成時に発火する) |
| **M4-01 指示書 v1.0.2** | **§4.2.1 コンボ作成 API DTO 予約(`Setups json.RawMessage`)、§4.2.7 setup CRUD API、CreateSetupInput 型** |
| **M4-02 指示書 v1.0.4** | **§4.2 setup フロント型定義、§4.4 setup フック群、§4.7 LinkExistingSetupModal(参考、v1.0.2 で本指示書は SetupSelectorModal を新規実装)** |
| **M4-03 指示書 v1.0.2** | **§4.4.2 候補抽出 SQL(参考)、§4.5 SetupCarryOptions(参考、本指示書では使用しない)** |
| architecture-patterns.md v1.0.2 | §1 フック分離パターン、§1.1 TanStack Query queryKey 規約(flat tuple + number 正規化) |
| **REQ-001 FR004** | コンボ + セットプレイ同時登録の要件定義 |
| CHANGE-012 通知書 | §6.2 R-2 対策(VAL-S05 サービス層引数レベル適用) |

### 3.2 任意参照(必要時のみ)

| ID / ファイル | 参照タイミング |
|--------------|--------------|
| M3-05 指示書 | コンボ作成 API の現状実装パターン参照時 |
| M2-02 指示書 | 編集 2 方式分離の参考(本指示書ではスコープ外だが、編集モードの挙動を確認する場合) |
| SUPP-001 §7.4 / §7.5 | recipe_cache 連動(setup 作成時の recipe_cache 計算は M4-01 で実装済み、本指示書では再利用のみ) |
| playbook v1.6.0 | §4.5 フローの素直さ原則、§4.6 UI ライブラリ実態確認原則、§14 完了判定 |
| retrospective-log v1.0.12 | M4-1〜M4-10 反省 + §5.5 持ち越し確認課題(C-1 は M4-05 で解消) |

### 3.3 参照不要

- DES-003 §3.11〜§3.13 永続化テーブル定義(本指示書では既存テーブル構造を変更しない)
- DES-004 内部表現仕様(notation 解決は既存ロジックを再利用)

### 3.4 着手前の確認(M4-02 / M4-03 で確立した運用、案 b 採用)

製造担当 Claude Code は §4 詳細仕様の実装に着手する前に、以下を確認する。**結果を Plan Mode で開発者に報告すること**(本指示書は Plan Mode 必須)。

#### 3.4.1 M4-01 コンボ作成 API DTO 予約の現状確認

```bash
# M4-01 で予約された Setups フィールドの実態確認
grep -rn 'Setups.*json.RawMessage\|setups.*json:"setups' internal/api/combo/
grep -rn 'CreateComboInput\|CreateComboRequest' internal/api/combo/dto.go 2>/dev/null

# サーバーを起動した状態で、現状の POST /api/combos の挙動確認:
# setups フィールドなしのリクエスト(従来)
curl -X POST http://localhost:8080/api/combos -H 'Content-Type: application/json' -d '{...M3 までの正しい形...}'
# 期待: 200 + ComboResponse(従来挙動が保たれている)
```

期待される確認事項:

- M4-01 §4.2.1 で `Setups json.RawMessage \`json:"setups,omitempty"\`` が DTO に予約されている
- 現状はこのフィールドが **使われていない**(本指示書で本実装する)
- 既存のコンボ作成テストが setups フィールド未指定で動作している

#### 3.4.2 コンボ作成サービスの現状実装確認

```bash
# 現状のコンボ作成サービス層・リポジトリ層の実態
ls internal/service/combo/
cat internal/service/combo/create.go 2>/dev/null | head -50
# または相当ファイル名(grep -rn 'CreateCombo\|CreateComboService' internal/service/combo/ で探索)

# トランザクション制御の既存パターン
grep -rn 'BeginTx\|WithTx\|sqlx.Tx\|sql.Tx' internal/service/combo/ internal/repository/combo/ | head -10
```

期待される確認事項:

- 既存のコンボ作成サービス関数のシグネチャ・関数名
- 既存のトランザクション制御パターン(本指示書 §4.3 で setups 作成 + combo_setups 紐付けを同一トランザクション内に組み込むため、既存のパターンに沿う)
- combo_setups 中間テーブルへの挿入は M4-01 / M4-02 のどこに実装されているか(本指示書で再利用)

#### 3.4.3 M4-01 setup 作成サービスの呼び出し方確認

```bash
# setup 作成サービス関数のシグネチャ
grep -rn 'func CreateSetup\|CreateSetupService\|setup.Create' internal/service/setup/ | head -5
cat internal/service/setup/create.go 2>/dev/null | head -30
# または:
grep -rn 'CreateSetupInput' internal/service/setup/ | head -5
```

期待される確認事項:

- M4-01 で実装された setup 作成サービス関数のシグネチャ(`CreateSetup(ctx, input CreateSetupInput, txOpts ...) (*Setup, error)` 等)
- VAL-S05 が引数レベル(`parent_combo_id` が引数で渡される形)で適用されているか確認(CHANGE-012 §6.2 R-2 対策)
- トランザクション制御(本指示書では同時登録時に同一トランザクション内で呼び出す形が必要)

#### 3.4.4 M4-02 / M4-03 setup フロントエンド既存ファイルの確認(v1.0.2 で改訂)

```bash
# CreateSetupInput 型の現状
cat web/src/features/setup/types.ts 2>/dev/null | head -40
grep -rn 'CreateSetupInput' web/src/features/setup/ | head -5

# LinkExistingSetupModal の責務確認(v1.0.2 で確認内容を「責務確認」に明確化)
cat web/src/features/setup/components/LinkExistingSetupModal.tsx 2>/dev/null | head -30
grep -rn 'useCreateSetupLink\|useMutation' web/src/features/setup/components/LinkExistingSetupModal.tsx 2>/dev/null
# または相当ファイル名(M4-02 §4.7 で実装済み)
```

期待される確認事項:

- `CreateSetupInput` 型のフィールド定義(M4-02 で確立済み)
- **`LinkExistingSetupModal` の責務確認**(v1.0.2 で明確化):
  - `LinkExistingSetupModal` は **mutation 実行付き**(`useCreateSetupLink` を内部で呼び出す既存コンボへの紐付け実行モーダル)
  - 新規登録モード(コンボ未作成)では mutation の `comboId` が確定していないため、**再利用不可能**
  - したがって本指示書では `SetupSelectorModal`(選択のみのピッカー、`onSelect` コールバックで返す)を **新規実装** する(§4.8 参照)
  - `LinkExistingSetupModal` 自体は変更しない、編集モード等の既存動作を維持

#### 3.4.5 useCreateCombo の現状実装確認(architecture-patterns.md §1.1 踏襲)

```bash
cat web/src/features/combo/hooks/useCreateCombo.ts 2>/dev/null
grep -rn 'useCreateCombo' web/src/features/combo/ | head -5
# queryKey パターンが flat tuple 形式か確認(architecture-patterns.md v1.0.2 §1.1)
grep -rn 'queryKey:' web/src/features/combo/hooks/ | head -10
```

期待される確認事項:

- 既存の `useCreateCombo` フックの構造(引数・返り値)
- `useCreateCombo` の `onSuccess` で invalidate している queryKey
- queryKey が flat tuple 形式(architecture-patterns.md v1.0.2 §1.1 規約、`['combo', numId]` 等)であること

#### 3.4.6 既存パッケージ依存の確認(M4-2 反省踏襲)

```bash
# combo パッケージから setup パッケージへの参照状況
grep -rn 'import.*setup' internal/api/combo/ internal/service/combo/ | head -10
grep -rn 'import.*combo' internal/api/setup/ internal/service/setup/ | head -10
```

期待される確認事項:

- combo → setup の依存方向(本指示書 §4.3 で setup 作成サービスを combo サービスから呼び出すため、依存方向が正しいことを確認)
- 循環 import が発生していないこと(M4-2 反省踏襲)

#### 3.4.7 確認結果の報告

製造担当 Claude Code は §3.4.1〜§3.4.6 の確認コマンド出力を **Plan Mode で開発者に報告すること**。本指示書は Plan Mode 必須。

特に **§3.4.1 M4-01 コンボ作成 API DTO 予約の現状** + **§3.4.2 コンボ作成サービスのトランザクション制御パターン** + **§3.4.3 M4-01 setup 作成サービスのシグネチャ** は本指示書のコア部分のため、明示的に報告すること。

#### 3.4.8 §4 着手の前提条件

§3.4.1〜§3.4.6 のすべての確認結果が期待通りであることを Plan Mode で開発者と合意してから、§4 詳細仕様の実装に着手する。万一現状が想定と乖離する場合(例: M4-01 の DTO 予約が想定と異なる、setup 作成サービスのシグネチャに引数レベルの parent_combo_id がない等)は Plan Mode で停止して開発者に報告する。

---

## 4. 詳細仕様

### 4.1 全体構造

本指示書は以下の 3 層構造で実装する:

1. **バックエンド層**:
   - コンボ作成 API DTO 拡張(`Setups []CreateSetupInput` への本実装)
   - サービス層トランザクション処理(コンボ作成 → 親コンボ ID 取得 → setup 作成 + 紐付け)
2. **フロントエンド フック・API 層**:
   - `useCreateCombo` の `setups` 引数対応
   - `comboApi.createCombo` のリクエスト JSON に `setups` フィールド追加
   - `CreateComboInput` 型に `setups?: CreateSetupInput[]` 追加
3. **フロントエンド UI 層**:
   - `SetupRegistrationSection` 同時登録セクション(新設、新規登録モードのみ表示)
   - `SetupInputRow` 1 セットプレイ入力行(新設)
   - **`SetupSelectorModal` 既存セットプレイ選択モーダル(新設、v1.0.2)** = `LinkExistingSetupModal`(mutation 実行付き)とは目的が異なるため分離、新規実装
   - `ComboEditorPage` への同時登録セクション組み込み

### 4.2 コンボ作成 API DTO 拡張(M4-01 予約形の本実装)

#### 4.2.1 リクエスト DTO 修正

```go
// M4-01 §4.2.1 で予約された形:
// type CreateComboInput struct {
//     // 既存フィールド ...
//     Setups json.RawMessage `json:"setups,omitempty"`  // M4-01 予約、M4-04 で本実装
// }

// M4-04 で本実装する形:
type CreateComboInput struct {
    // 既存フィールド(M3 までで確立済み、変更しない) ...
    
    // M4-04 で本実装: setups 束受領
    Setups []CreateSetupInput `json:"setups,omitempty"`
}

// CreateSetupInput は setup ドメインのリクエスト DTO(M4-01 で確定済み、再利用)
// - name *string(nullable、文字数制限なし、console.warn なし)
// - description *string(nullable、文字数制限なし、console.warn なし)
// - steps []SetupStepInput(必須、1件以上)
// - parent_combo_id は **引数レベル** で渡すため DTO には含めない(VAL-S05 / CHANGE-012 §6.2 R-2 対策)
```

**設計判断**:

- **`Setups []CreateSetupInput`** = M4-01 §4.2.1 で予約された `json.RawMessage` 形を本実装で置き換える。型を明示することで JSON パースが構造化される
- **`omitempty`** = setups フィールドなしのリクエスト(従来のコンボ作成のみ)が引き続き 200 で受領される前方互換確保
- **`CreateSetupInput.parent_combo_id` は DTO に含めない** = VAL-S05 / CHANGE-012 §6.2 R-2 対策。同時登録時はコンボ作成後の親コンボ ID をサービス層で動的に取得して setup 作成関数の **引数として渡す**

#### 4.2.2 ハンドラ層: setups パース

```go
func CreateCombo(w http.ResponseWriter, r *http.Request) {
    var input CreateComboInput
    if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
        writeError(w, http.StatusBadRequest, "invalid_request_body", "リクエストボディが不正です")
        return
    }
    
    // 既存のバリデーション(M3 まで)
    // ...
    
    // M4-04 で追加: setups の事前バリデーション(空配列・nil は許容、各要素の必須フィールドはサービス層でチェック)
    // 注: 個々の setup の VAL-S01〜S04 バリデーションはサービス層で発火、ここでは型チェックのみ
    
    combo, err := service.combo.Create(r.Context(), input)
    if err != nil {
        // model.ValidationError / model.APIErrorResponse で返す
        writeError(...)
        return
    }
    
    writeJSON(w, http.StatusCreated, combo)
}
```

#### 4.2.3 レスポンス形式

レスポンスは既存の `ComboResponse` を再利用する(本指示書では拡張しない)。`ComboResponse.setups` フィールド(M4-02 で確立)は引き続き紐付き setup を返す。

```json
{
  "id": 123,
  "characterId": 1,
  // ... 既存フィールド
  "setups": [
    {"id": 456, "characterId": 1, "name": "...", ... }
  ]
}
```

**設計判断**: 同時登録した setups は `combo.setups` フィールドに含まれて返ってくる(M4-02 で確立した形)。フロント側は新規登録後に setup ID を取得できる。

### 4.3 サービス層トランザクション処理

#### 4.3.1 コンボ作成サービスの修正

```go
// 既存のコンボ作成サービス関数を修正(関数名は §3.4.2 で実態確認)
func CreateCombo(ctx context.Context, input CreateComboInput) (*ComboResponse, error) {
    // トランザクション開始(既存パターン踏襲、§3.4.2 で確認)
    tx, err := db.BeginTx(ctx, nil)
    if err != nil {
        return nil, err
    }
    defer tx.Rollback()  // 既存パターン
    
    // 1. コンボ作成(M3 までの既存処理、変更しない)
    combo, err := repository.combo.Create(ctx, tx, input)
    if err != nil {
        return nil, err
    }
    
    // 2. M4-04 で追加: setups が指定されていれば、トランザクション内で順序処理
    if len(input.Setups) > 0 {
        for _, setupInput := range input.Setups {
            // 2.1 setup 作成(サービス層関数を呼び出し、親コンボ ID を引数として渡す)
            // VAL-S05 / CHANGE-012 §6.2 R-2 対策: parent_combo_id は引数として明示的に渡す
            setup, err := setupService.Create(ctx, tx, setupInput, combo.ID)
            if err != nil {
                // ValidationError(VAL-S01〜S05 由来)はそのままラップして返す
                return nil, err
            }
            
            // 2.2 combo_setups 紐付け(既存パターン踏襲、§3.4.2 で確認)
            err = repository.comboSetup.Create(ctx, tx, combo.ID, setup.ID)
            if err != nil {
                return nil, err
            }
        }
    }
    
    // 3. トランザクションコミット
    if err := tx.Commit(); err != nil {
        return nil, err
    }
    
    // 4. 完成形(combo.setups を含む)を取得して返す
    return service.combo.Get(ctx, combo.ID)
}
```

**設計判断**:

- **トランザクション原子性**: コンボ作成 + setups 作成 + 紐付けはすべて **同一トランザクション内** で実行。setup 作成中のいずれかが失敗した場合、コンボ作成も含めてロールバックされる(playbook §4.5 フローの素直さ原則、原子性確保)
- **VAL-S05 引数レベル適用**(CHANGE-012 §6.2 R-2 対策): setup 作成サービスの引数に `combo.ID` を明示的に渡す。リクエスト DTO の `CreateSetupInput` には `parent_combo_id` が含まれていない(混入できない)構造を維持
- **setups 空配列 / nil の場合**: 既存のコンボ作成と同じ動作(setups 関連処理がスキップされる)。`len(input.Setups) > 0` の早期 false で if 文を抜ける
- **setups エラー時のエラーメッセージ**: VAL-S01〜S05 のいずれかが失敗した場合、エラーメッセージに「何件目の setup で何が問題か」を明示する(例: `setups[1].steps must not be empty`)

#### 4.3.2 setup 作成サービスの呼び出し方(M4-01 既存シグネチャ確認)

§3.4.3 で確認した M4-01 setup 作成サービスのシグネチャに合わせて呼び出す。想定されるシグネチャ:

```go
// M4-01 §4.2.1 で確立済み(想定):
func (s *SetupService) Create(
    ctx context.Context,
    tx *sql.Tx,  // または相当の Tx 型(§3.4.2 既存パターンに合わせる)
    input CreateSetupInput,
    parentComboID int64,  // VAL-S05 引数レベル適用(CHANGE-012 §6.2 R-2 対策)
) (*Setup, error)
```

**設計判断**: §3.4.3 で実態確認した上で、本指示書 §4.3.1 のコード例を実装する。Tx 引数の型・順序が異なる場合は Plan Mode で停止して開発者に報告。

#### 4.3.3 エラーレスポンス

- 既存のコンボ作成エラー(`invalid_request_body` / 各種バリデーションエラー)はそのまま流用
- setup 作成由来のバリデーションエラー(VAL-S01〜S05): エラーメッセージに `setups[index]` プレフィックスを付与して位置を明示
- トランザクション失敗時: 500 + `internal_error`(model.APIErrorResponse)

#### 4.3.4 境界値ケースの網羅検証(M4-10 反省踏襲)

サービス層実装時に以下の境界値ケースを **テストで網羅** する:

| ケース | 期待挙動 |
|-------|---------|
| setups 未指定(nil)| 既存のコンボ作成と同じ、setups 関連処理なし |
| setups = [](空配列)| 既存のコンボ作成と同じ、setups 関連処理なし |
| setups = [valid setup 1 件] | コンボ + setup 1 件作成、combo_setups 1 件紐付け |
| setups = [valid setup 複数件] | コンボ + setup 複数件作成、combo_setups 複数件紐付け |
| setups[i] のバリデーションエラー(VAL-S01〜S04)| 全体ロールバック、エラーメッセージに `setups[i]` プレフィックス |
| setups[i] のサービス層エラー(VAL-S05、parent_combo_id 不正)| 通常は発生しないが防御。全体ロールバック |
| コンボ本体作成失敗 | 既存挙動、setups 処理に進まない |
| 同一トランザクション内での setup 作成失敗(DB 整合性違反等)| 全体ロールバック |

### 4.4 フロント側 CreateComboInput 型拡張

`web/src/features/combo/types.ts`(または相当)に以下を追加:

```typescript
// 既存(M3 まで):
export interface CreateComboInput {
  characterId: number;
  starterMoveCode: string;
  // ... その他既存フィールド
}

// M4-04 で追加: setups 引数オプション
export interface CreateComboInput {
  characterId: number;
  starterMoveCode: string;
  // ... その他既存フィールド
  
  setups?: CreateSetupInput[];  // M4-04 で追加(同時登録セットプレイ)
}
```

**設計判断**:

- `setups?: CreateSetupInput[]`(オプショナル)= setups 未指定でも従来通り動作する前方互換確保
- `CreateSetupInput` は `web/src/features/setup/types.ts`(M4-02 で確立)から import して再利用

### 4.5 useCreateCombo フック拡張

`web/src/features/combo/hooks/useCreateCombo.ts` を修正:

```typescript
import type { CreateComboInput, ComboResponse } from '../types';
// CreateComboInput は §4.4 で setups オプションが追加された前提

export function useCreateCombo() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (input: CreateComboInput) => comboApi.createCombo(input),
    onSuccess: (data) => {
      // 既存(M3 まで): combo 一覧・キャラクター別 combo 一覧のキャッシュ無効化
      queryClient.invalidateQueries({ queryKey: ['combos'] });
      queryClient.invalidateQueries({ queryKey: ['combos', data.characterId] });
      
      // M4-04 で追加: setups が含まれて作成された場合、setup 関連キャッシュも無効化
      // 注: data.setups が空配列でも (M4-02 ComboResponse.setups は常に配列で返る前提)、
      //     setup 一覧 / setupCandidates のキャッシュ無効化は安全(空配列でも害なし)
      if (data.setups && data.setups.length > 0) {
        queryClient.invalidateQueries({ queryKey: ['setups', data.characterId] });
        queryClient.invalidateQueries({ queryKey: ['setupCandidates'] });
      }
    },
  });
}
```

**設計判断**:

- **architecture-patterns.md v1.0.2 §1.1 踏襲**: queryKey は flat tuple 形式(`['combos', characterId]` 等)
- **新規 queryKey の invalidate 対象を明示**(M4-03 E2E 由来教訓): 同時登録で setups が作成された場合、`['setups', characterId]`(setup 一覧)と `['setupCandidates']`(候補一覧、別コンボの転用候補に影響しうる)を invalidate
- **`useCreateCombo` の既存呼び出し元** は引数に setups を含めない形のままで動作する(オプショナル引数のため)

### 4.6 SetupRegistrationSection コンポーネント(新設)

#### 4.6.1 Props 設計

```typescript
interface SetupRegistrationSectionProps {
  value: CreateSetupInput[];                          // 現在の入力中 setup 配列
  onChange: (setups: CreateSetupInput[]) => void;     // setups 変更時のコールバック
  characterId: number;                                // 既存セットプレイ紐付け時のフィルタ用
}
```

**Props 最小化(M4-5 反省踏襲)**: setups 配列とコールバックのみ。loading / error 状態は受け取らない(親コンポーネントで管理)。`mode` prop は持たせない(YAGNI 違反回避、新規登録モード専用なので mode 不要)。

#### 4.6.2 表示仕様

- セクション見出し: 「このコンボに紐づくセットプレイ」(DES-005 §5.7 item 10 の「このコンボに紐づくセットプレイをまとめて登録できる」を簡潔化)
- 各 `value[i]` に対して `SetupInputRow` をレンダリング(削除ボタン付き)
- セクション末尾に **「+ セットプレイを追加」ボタン**(新規入力行を追加)
- セクション末尾に **「既存のセットプレイを紐付け」ボタン**(`SetupSelectorModal` を開く、v1.0.2 で `LinkExistingSetupModal` から変更)
- 既存セットプレイを選択した場合、`value` に追加するのではなく、別の管理(既存紐付けキューに追加、コンボ作成成功後に `useCreateSetupLink` で紐付け)

#### 4.6.3 文字数制限・console.warn の仕様(M4-7 反省踏襲、「規定なし」を明示)

- セクション見出し・ボタンラベルの **文字数制限なし、console.warn なし**
- 内部の `SetupInputRow` の入力フィールドの仕様は §4.7 参照

#### 4.6.4 既存セットプレイ紐付けの動線(v1.0.2 で改訂)

DES-005 §5.7 item 10「既存セットプレイを紐付けるボタン」の動線:

1. ユーザーが「既存のセットプレイを紐付け」ボタンクリック
2. **`SetupSelectorModal`(v1.0.2 で新設)を開く**
3. ユーザーが既存セットプレイを選択 → `onSelect(setupId)` コールバックで呼び出し元に返す
4. **コンボ作成 API のリクエストには含めない**(既存セットプレイなので新規作成不要)
5. 別の state(`linkedSetupIds: number[]`)に追加してセクション内に「紐付け予定」として表示
6. コンボ作成成功後、`useCreateSetupLink` を順次呼び出して紐付けを反映(`SetupSelectorModal` 自体は mutation を実行しない、呼び出し元 `SetupRegistrationSection` の責務)

**設計判断**:

- 同時登録セクションでは「新規作成 setup(`value`)」と「既存紐付け setup(`linkedSetupIds`)」を **分離して管理**
- コンボ作成 API のリクエストでは `setups` フィールドに「新規作成 setup」のみが含まれる
- 「既存紐付け setup」は別フロー(`useCreateSetupLink`)で処理する

これにより、API 層の責務(新規作成のみ)とフロント層の責務(既存紐付けの分離)が明確になる。

### 4.7 SetupInputRow コンポーネント(新設)

#### 4.7.1 Props 設計

```typescript
interface SetupInputRowProps {
  value: CreateSetupInput;                            // 1 setup の入力値
  onChange: (value: CreateSetupInput) => void;        // 変更時のコールバック
  onRemove: () => void;                               // 行削除時のコールバック
  characterId: number;                                // notation 解決等で必要
}
```

#### 4.7.2 表示仕様

- セットプレイ名入力フィールド(text input)
- 説明入力フィールド(textarea)
- レシピ入力(仮想コントローラ共用 + ステップ一覧)
- 行削除ボタン

#### 4.7.3 仮想コントローラの取り扱い(v1.0.1 で改訂、案 1: 個別 VC 採用)

DES-005 §5.7 item 10「レシピ入力(仮想コントローラ共用)」の解釈:

**v1.0.1 で確定(案 1: 個別 VC)**: 各 `SetupInputRow` が **個別に `SetupRecipeEditor`(VC 内蔵型)をレンダリング** する方式を採用。`RecipeBuilder` の変更を伴わず、M4-04 スコープ内で完結。

**解釈の根拠**:

- DES-005 §5.7 item 10「仮想コントローラ共用」は **「仮想コントローラ機能を全入力行で使える」という機能要件** であり、「同一の VC インスタンスを物理的に共用する」とは限定していない(retrospective-log v1.0.13 §5.3 教訓「DES-005 等の UI 仕様表現は実装手段ではなく機能要件として読む」と整合)
- 既存 `SetupRecipeEditor` が **VC 内蔵型** で実装されているため、各入力行でこれをレンダリングすれば機能要件は満たせる
- 共用 VC 方式(v1.0.0 §4.7.3 の元案)は `RecipeBuilder` の大幅変更を伴う共用化リファクタが必要で、M4-04 スコープを超える(playbook §17.1 個人 OSS の規模感と緊張)

**実装方針**:

- `SetupInputRow` 内で `<SetupRecipeEditor>` を直接レンダリング
- 各 `SetupInputRow` インスタンスは独立した VC を内蔵する
- フォーカス管理ロジック(`editingSetupIndex` 状態、VC 入力ルーティング等)は **不要**

**v1.0.0 元案(共用 VC)からの変更経緯**:

- v1.0.0 §4.7.3 では「コンボ本体のレシピ入力で使う仮想コントローラを setup の入力時にも共用する、フォーカス管理で切替」と書いたが、これは設計担当が既存 `SetupRecipeEditor` の構造(VC 内蔵型)を確認せずに書いた誤り
- M4-04 製造担当 Plan Mode 中の連絡事項(2026-05-20)で、個別 VC レンダリング方式が既存実装構造に整合する旨が指摘され、開発者判断で案 1 採用
- 本件は retrospective-log v1.0.13 §5.1 M4-11 に独立記録(M4-1 / M4-3 / M4-8 / M4-9 / M4-10 と同根の「実コード確認の省略」)

**M5+ での共用化検討の余地**:

- 複数 VC が同時表示されることによる画面縦長化・キーボードショートカット競合等の UX 上の課題は M5 以降で再評価
- 将来必要な場合、CHANGE 通知書を起票して `RecipeBuilder` / `SetupRecipeEditor` の共用化リファクタを実施
- 推奨タイミング: M7 仕上げ(shadcn/ui 導入と同時に UI 層リファクタ)、または M6 スマホ UI 対応時、またはフェーズ 2(モバイル本格対応 / 物理コントローラ対応)
- retrospective-log v1.0.13 §5.5 持ち越し確認課題 C-2 として「M4-04 個別 VC 採用後の UX 違和感評価」を記録、M5-M7 期間のいずれかで再評価する

#### 4.7.4 文字数制限・console.warn の仕様(M4-7 反省踏襲)

- セットプレイ名: 文字数制限なし、console.warn なし(M4-02 / M4-03 で確立した方針と整合)
- 説明: 文字数制限なし、console.warn なし(同上)
- レシピステップ: M4-01 / M4-02 で確立した notation バリデーションを適用(VAL-S01〜S04)

### 4.8 SetupSelectorModal の新設(v1.0.2 で全面改訂)

v1.0.0〜v1.0.1 では「`LinkExistingSetupModal` をそのまま再利用」と規定していたが、製造担当の実態調査で **`LinkExistingSetupModal` は mutation 実行付き**(`useCreateSetupLink` を内部で呼び出す既存コンボへの紐付け実行モーダル)であることが判明。新規登録モードではコンボ未作成で mutation を発火できないため再利用不可能。

v1.0.2 で **`SetupSelectorModal`(選択のみのピッカー)を新規実装** する方針に確定。

#### 4.8.1 SetupSelectorModal の責務

- **既存セットプレイの一覧表示と選択**: 同一キャラの既存 setup を表示、ユーザーが 1 件を選択
- **`onSelect` コールバックで呼び出し元に通知**: 選択された setupId を呼び出し元(`SetupRegistrationSection`)に返す
- **mutation を実行しない**: 紐付けの mutation(`useCreateSetupLink`)は呼び出し元の責務、本モーダルは選択のみ

#### 4.8.2 Props 設計(Props 最小化、M4-5 反省踏襲)

```typescript
interface SetupSelectorModalProps {
  isOpen: boolean;                              // 開閉制御
  onClose: () => void;                          // 閉じる時のコールバック
  onSelect: (setupId: number) => void;          // setup 選択時のコールバック(mutation なし)
  characterId: number;                          // 同一キャラの setup でフィルタ
  excludeSetupIds?: number[];                   // 既に紐付け予定の setup を除外(任意、UX 改善のため)
}
```

**設計判断**:

- mutation 実行関連の Props(`parentComboId`、`onLinkSuccess` 等)は **持たない**(`LinkExistingSetupModal` との明確な責務分離)
- `onSelect` のみで呼び出し元に通知、呼び出し元側で `linkedSetupIds` 状態に追加する
- `excludeSetupIds` は UX 改善のため任意(既に紐付け予定の setup が選択肢に表示されないようにする)

#### 4.8.3 表示仕様

- モーダルウィンドウ(標準 HTML + Tailwind、shadcn/ui 不使用、playbook §4.6 踏襲)
- 同一キャラの既存 setup 一覧(`useListSetupsByCharacter` 等の M4-02 フックを再利用)
- 各 setup 行: setup 名、説明(短縮)、`parentComboIds` 数(参考表示)
- 行クリック → `onSelect(setupId)` 発火 + モーダル閉じる
- 閉じるボタンで `onClose` 発火
- `excludeSetupIds` に含まれる setup は一覧から除外(UX 改善)

#### 4.8.4 LinkExistingSetupModal との関係(整理)

| 観点 | `LinkExistingSetupModal`(M4-02 §4.7 実装済み) | `SetupSelectorModal`(v1.0.2 で新設) |
|------|---------------------------------------|------------------------------|
| 目的 | 既存コンボに対する紐付け実行(mutation あり) | setup の選択のみ(mutation なし) |
| 内部の mutation | `useCreateSetupLink` を内部で呼ぶ | 呼ばない |
| 必要な前提 | コンボが既に存在(`comboId` 確定済み) | コンボの存在を前提としない |
| 使用箇所 | 編集モード等、既存コンボに対する紐付け | 新規登録モード(コンボ作成前の選択)|
| Props 主要 | `comboId: number`(mutation 実行に必要)| `onSelect: (setupId) => void`(コールバック)|
| 本指示書での扱い | 変更なし、既存動作を維持 | 新規実装 |

**単一責任原則**: 2 つのモーダルは目的が本質的に異なる(mutation 実行 vs 選択のみ)ため、分離して維持する。Props 拡張で統合(`parentComboId` nullable 化等)は M4-5 反省「mode prop YAGNI 違反」と同質の構造を生むため行わない。

#### 4.8.5 将来の整理(M5-M7 期間で検討)

2 つのモーダルで重複する UI(setup 一覧の表示・フィルタ等)が顕在化した場合、共通基底コンポーネントへの抽出を M5-M7 期間で検討する(必須ではない、必要時のみ実施)。retrospective-log v1.0.14 §5.5 持ち越し確認課題 C-2 と類似の運用。

### 4.9 ComboEditorPage への同時登録セクション組み込み

#### 4.9.1 追加するセクション(v1.0.1 で改訂)

`web/src/pages/ComboEditorPage.tsx`(または相当)に以下を追加:

- **新規登録モード**(`POST /api/combos` でコンボを新規作成するフロー全般、**`/combos/new` および `/combos/:id/copy`**)でのみ `SetupRegistrationSection` を render(v1.0.1 で copy モードを明示的に含める形に改訂)
- 編集モード(`mode === 'edit'` 相当)では render しない(§1.4 で明示済み)
- copy モードでは同時登録セクションは **空の状態で表示**(コピー元の setups を初期値として投入しない、§1.4 規定)
- セクション位置: DES-005 §5.7 表示項目順(10. セットプレイ登録セクション = タグ選択の **前**、コンボ後情報の **後**)

```typescript
// ComboEditorPage 内の追加部分(概略)
const [setupsToCreate, setSetupsToCreate] = useState<CreateSetupInput[]>([]);
const [linkedSetupIds, setLinkedSetupIds] = useState<number[]>([]);

const createComboMutation = useCreateCombo();
const createSetupLinkMutation = useCreateSetupLink();  // M4-02 で実装済み

// モード判定(§3.4.2 で実態確認した既存パターンに準拠)
// 新規登録モード = mode === 'create' || mode === 'copy'(POST API でコンボを新規作成するフロー)
// 編集モード = mode === 'edit'(PATCH / PUT API でコンボを更新するフロー)
const isCreateMode = mode === 'create' || mode === 'copy';

const handleSave = async () => {
  // 1. コンボ作成(setupsToCreate を含む)
  const combo = await createComboMutation.mutateAsync({
    /* 既存フィールド */,
    setups: setupsToCreate,  // M4-04 で追加
  });
  
  // 2. 既存セットプレイ紐付け(linkedSetupIds を順次)
  for (const setupId of linkedSetupIds) {
    await createSetupLinkMutation.mutateAsync({ comboId: combo.id, setupId });
  }
  
  // 3. コンボ詳細画面に遷移(既存フロー)
  navigate(`/combos/${combo.id}`);
};

// レンダリング部分(新規登録モード: new + copy 両方):
{isCreateMode && (
  <SetupRegistrationSection
    value={setupsToCreate}
    onChange={setSetupsToCreate}
    characterId={characterId}
  />
)}
```

**copy モードでの初期値投入の取り扱い**:

- コンボ本体(キャラクター・始動技・レシピ・ダメージ・タグ・メモ等): コピー元から初期値投入(FR012、既存挙動を踏襲)
- 同時登録セクションの `setupsToCreate` / `linkedSetupIds` 初期値: **空配列**(コピー元の setups を引き継がない、§1.4 規定)
- ユーザーが同時登録セクションから新規 setup 追加 / 既存 setup 紐付けを行う

#### 4.9.2 既存登録機能の回帰なし

- setupsToCreate / linkedSetupIds がともに空の場合、既存のコンボ作成挙動と完全に同一
- 編集モードでは本機能が完全に非表示(既存の編集機能に影響なし)

### 4.10 設計判断事項(本指示書で確定済み)

| 項目 | 確定内容 | 根拠 |
|------|---------|------|
| コンボ作成 API DTO の Setups フィールド型 | `[]CreateSetupInput`(M4-01 予約の `json.RawMessage` を本実装で置換) | M4-01 §4.2.1 で予約済み |
| Setups の前方互換 | `omitempty` で setups 未指定リクエストも引き続き 200 で動作 | playbook §4.5 フローの素直さ |
| VAL-S05 適用方法 | サービス層関数の引数レベル(`setupService.Create(ctx, tx, input, parentComboID)`)| CHANGE-012 §6.2 R-2 対策 |
| トランザクション原子性 | コンボ作成 + setups 作成 + combo_setups 紐付けが同一トランザクション、いずれかの失敗で全体ロールバック | playbook §4.5 |
| setups エラー時のエラーメッセージ | `setups[i]` プレフィックスで位置明示 | UX 観点 |
| 編集モードでの同時登録セクション表示 | **非表示**(本指示書スコープ外、M5 以降の判断)。新規登録モード(new + copy 両方)では表示 | §1.4 明示、v1.0.1 で copy 言及追加 |
| **copy モードでの同時登録セクション表示**(v1.0.1 で追加) | **表示する**(案 1)。copy も POST でコンボ新規作成のため、新規登録モードの一種として扱う | DES-005 §5.6「コピーボタン → コンボ登録画面(新規登録モード)」との整合 |
| **copy モードでのコピー元 setups の扱い**(v1.0.1 で追加) | **引き継がない、空表示**(選択肢 c)。コンボ本体のみコピー元から初期値投入、setups はユーザーが手動で追加・紐付け | FR012 本来意図との整合、M4-04 スコープ最小化 |
| セットプレイの並び替え UI | 実装しない(M5 以降の判断) | DES-005 §5.7 item 10 に並び替え仕様の明示なし |
| 下書き保存仕様 | 実装しない(M5 以降、CHANGE 通知書必要) | DES-005 §5.7 L343 規定だが本指示書スコープ外 |
| 同時登録セクションの新規 setup と既存紐付け setup の管理 | 分離(`setupsToCreate` + `linkedSetupIds`)| API 層責務の明確化 |
| **既存セットプレイ選択モーダル**(v1.0.2 で改訂) | **`SetupSelectorModal` を新規実装**(選択のみのピッカー、mutation 実行ロジックなし)。`LinkExistingSetupModal`(mutation 実行付き)とは目的が異なるため分離 | §4.8、retrospective-log v1.0.14 §5.1 M4-12、単一責任原則 + M4-5 反省踏襲 |
| **仮想コントローラの取り扱い**(v1.0.1 で改訂) | **個別 VC レンダリング**(各 `SetupInputRow` が `SetupRecipeEditor`(VC 内蔵型)を個別レンダリング)。RecipeBuilder 変更なし、フォーカス管理ロジック不要。M5+ で共用化検討 | §4.7.3、M4-11 反省踏襲、retrospective-log v1.0.13 §5.5 C-2 |
| Setup 名 / 説明の文字数制限 | 制限なし、console.warn なし | M4-02 §4.6.2 / M4-03 §4.7.3 と整合、M4-7 反省踏襲 |
| useCreateCombo の queryKey 形式 | flat tuple(architecture-patterns.md v1.0.2 §1.1) | M4-9 反省踏襲、architecture-patterns.md v1.0.2 規約 |
| useCreateCombo の onSuccess で invalidate する queryKey | `['combos']`、`['combos', characterId]`、`['setups', characterId]`(setups 作成時)、`['setupCandidates']`(setups 作成時) | M4-03 E2E 由来教訓(新規 queryKey の invalidate 漏れ防止) |
| エラーコード | 既存パターン踏襲、setup 系は小文字スネーク | M4-01 規約踏襲 |
| 共通エラー型 | `model.APIErrorResponse` 直接呼び出し | architecture-patterns.md §3、独自ヘルパなし |

---

## 5. テスト要件

### 5.1 必須テスト

#### 5.1.1 バックエンドテスト

**コンボ作成 API DTO 拡張テスト**:

- [ ] setups 未指定(nil)で 200、既存コンボ作成と同一挙動
- [ ] setups = [](空配列)で 200、既存コンボ作成と同一挙動
- [ ] setups = [valid setup 1 件] で 201、コンボ + setup 作成、combo_setups 1 件紐付け、レスポンスに setups が含まれる
- [ ] setups = [valid setup 複数件] で 201、コンボ + setup 複数件作成、combo_setups 複数件紐付け
- [ ] setups[i] のバリデーションエラー(VAL-S01〜S04)で 400 + エラーメッセージに `setups[i]` プレフィックス
- [ ] setups[i] のサービス層エラー(VAL-S05 防御)で 400 + 適切なエラーメッセージ
- [ ] コンボ本体作成失敗時、setups 処理に進まない(既存挙動)
- [ ] DB 整合性違反等の予期せぬエラー時、全体ロールバック(コンボも setup も作成されない、combo_setups も作成されない)

**サービス層トランザクションテスト**:

- [ ] トランザクション開始 → コンボ作成 → setups ループ(setup 作成 + combo_setups 紐付け)→ コミットの順序
- [ ] setups ループ中のいずれかの失敗で全体ロールバック
- [ ] setups が空配列 / nil の場合、setups 関連処理がスキップされる(既存挙動)

#### 5.1.2 フロントエンドテスト(フック層)

- [ ] `useCreateCombo({ ..., setups: [valid setup] })` で API 呼び出し成功、レスポンスに setups が含まれる
- [ ] `useCreateCombo({ ..., setups: undefined })` で API 呼び出し成功、既存挙動(setups なし)
- [ ] `useCreateCombo` の `onSuccess` で `['combos']`、`['combos', characterId]` が invalidate される
- [ ] setups が含まれて作成された場合、`['setups', characterId]`、`['setupCandidates']` も invalidate される

#### 5.1.3 フロントエンドテスト(コンポーネント)

- [ ] `SetupRegistrationSection`: 初期状態で「+ セットプレイを追加」ボタンと「既存のセットプレイを紐付け」ボタンが表示される
- [ ] `SetupRegistrationSection`: 「+ セットプレイを追加」クリックで入力行が増える
- [ ] `SetupRegistrationSection`: 入力行の削除ボタンクリックで該当行が消える
- [ ] `SetupRegistrationSection`: 「既存のセットプレイを紐付け」クリックで `LinkExistingSetupModal` が開く
- [ ] `SetupRegistrationSection`: 既存セットプレイ選択で `linkedSetupIds` に追加される
- [ ] `SetupInputRow`: セットプレイ名・説明・レシピ入力の動作
- [ ] `SetupInputRow`: 削除ボタンクリックで onRemove が呼ばれる

#### 5.1.4 ページコンポーネントテスト

- [ ] `ComboEditorPage`(新規登録モード): `SetupRegistrationSection` が表示される
- [ ] `ComboEditorPage`(編集モード): `SetupRegistrationSection` が **表示されない**
- [ ] `ComboEditorPage`(新規登録モード): 保存ボタン押下で `useCreateCombo` が `setups` 引数付きで発火
- [ ] `ComboEditorPage`(新規登録モード): コンボ作成成功後、`linkedSetupIds` がある場合に `useCreateSetupLink` が順次発火
- [ ] `ComboEditorPage`(新規登録モード): 保存成功後にコンボ詳細画面へ遷移
- [ ] `ComboEditorPage`(編集モード): M4-03 完了状態の編集機能が変わらない(回帰なし)

#### 5.1.5 ビルド・型チェック

- [ ] `cd web && pnpm test` が全通過する(新規テスト含む、既存テスト回帰なし)
- [ ] `cd web && pnpm build` が成功する
- [ ] TypeScript の型エラーが残っていない
- [ ] `make test` または `go test ./...` が全通過する(combo / setup 系の新規 + 既存テスト回帰なし)
- [ ] `go build ./...` が成功する
- [ ] `go vet ./...` でエラーなし

### 5.2 動作確認シナリオ(本指示書では E2E シナリオではなく動作確認手順、E2E は M4-05 でまとめて実施)

製造担当 Claude Code は以下の動作確認シナリオを実装完了報告に手順書として記載する。**統合 E2E は M4-05 で実施するため、本指示書では本機能の動作確認のみ**。

#### A. 新規登録モードで setup を 1 件同時登録

1. コンボ新規登録画面を開く
2. キャラクター・始動技・状況・レシピ等を入力
3. 同時登録セクションが表示されることを確認
4. 「+ セットプレイを追加」ボタンを押下、入力行が 1 つ追加される
5. setup 名・説明・レシピを入力
6. 保存ボタン押下 → コンボ + setup 1 件が作成される
7. コンボ詳細画面に遷移、§5.6 item 8 にセットプレイ A が表示される

#### B. 新規登録モードで setup を複数件同時登録

1. シナリオ A と同様、ただし「+ セットプレイを追加」ボタンを 2-3 回押下
2. 各入力行に異なる setup を入力
3. 保存ボタン押下 → コンボ + 複数 setup が作成される
4. コンボ詳細画面で全 setup が表示される

#### C. 新規登録モードで setup なし(従来通り)

1. コンボ新規登録画面を開く
2. setup を追加せず保存(従来動線)
3. 保存成功、コンボのみ作成される(既存挙動の回帰なし)

#### D. 新規登録モードで既存セットプレイを紐付け

1. コンボ新規登録画面を開く
2. 「既存のセットプレイを紐付け」ボタンを押下、`LinkExistingSetupModal` が開く
3. 既存セットプレイを選択して紐付け予定リストに追加
4. 保存ボタン押下 → コンボ作成 → 既存セットプレイ紐付け実行
5. コンボ詳細画面で既存セットプレイが紐付き済みとして表示される

#### E. 新規登録モードで新規 setup + 既存紐付けの併用

1. シナリオ A + D を組み合わせ: 新規 setup を 1 件入力 + 既存セットプレイを 1 件紐付け
2. 保存ボタン押下 → コンボ + 新規 setup 1 件 + 既存紐付け 1 件
3. コンボ詳細画面で両方が表示される

#### F. setup 入力中のバリデーションエラー

1. コンボ新規登録画面で setup を 1 件追加、レシピを空のまま保存
2. 期待: バリデーションエラー(VAL-S01〜S04 由来)、エラーメッセージに `setups[0]` プレフィックス
3. **トランザクションロールバック**: コンボも作成されていない(setup 作成失敗で全体ロールバック)

#### G. 編集モードで本機能が非表示

1. 既存コンボの編集画面を開く
2. 同時登録セクションが **表示されない** ことを確認
3. 既存の編集機能(コンボメタデータ編集、保存)が正常動作する

#### H. 既存機能の回帰

1. M4-03 完了状態のコンボ詳細・コンボ編集・マイコンボ画面が動作する
2. M3-05 統合 E2E シナリオが引き続き通過する
3. M4-02 setup 単体 UI / M4-03 FR011 候補表示 + 確認モーダルが引き続き動作する

---

## 6. レビュー観点(別ファイル参照)

機械レビューは別ファイル `docs/instructions/reviews/M4-04-review-checklist.md` に従う。製造担当 Claude Code は本ファイルを読む必要はない。

---

## 7. 完了条件(Definition of Done)

### 7.1 機能要件

- [ ] §2.1 のファイル一覧がすべて作成または修正されている(バックエンド新設・修正 + フロントエンド新設・修正)
- [ ] §3.4 着手前確認の結果(全 6 項目、特に §3.4.1 M4-01 予約形・§3.4.2 既存トランザクション・§3.4.3 setup 作成サービスのシグネチャ)が実装完了報告に含まれている
- [ ] §4.2 コンボ作成 API DTO 拡張が動作する(M4-01 予約の `json.RawMessage` → `[]CreateSetupInput` 置換完了)
- [ ] §4.3 サービス層トランザクション処理が動作する(原子性確保)
- [ ] §4.4 フロント `CreateComboInput` 型に `setups?: CreateSetupInput[]` が追加されている
- [ ] §4.5 `useCreateCombo` の `setups` 引数対応 + onSuccess での invalidate が動作する
- [ ] §4.6 `SetupRegistrationSection` が動作する(新規登録モードのみ)
- [ ] §4.7 `SetupInputRow` が動作する(セットプレイ名 / 説明 / レシピ入力 / 削除)
- [ ] §4.8 `LinkExistingSetupModal` の再利用が動作する
- [ ] §4.9 `ComboEditorPage` の新規登録モードのみで同時登録セクションが表示される
- [ ] §5.2 動作確認シナリオ A〜H がすべて通過する
- [ ] **VAL-S05 がサービス層関数の引数レベルで適用されている**(CHANGE-012 §6.2 R-2 対策、最重要)
- [ ] M3-05 統合 E2E シナリオが回帰しない

### 7.2 自己テスト結果(製造担当の責任範囲)

**フロントエンド側**:

- [ ] `cd web && pnpm test` が全通過する
- [ ] `cd web && pnpm build` が成功する
- [ ] TypeScript の型エラーが残っていない
- [ ] §3.4.1〜§3.4.6 着手前確認の出力を含める
- [ ] 開発者向けの「動作確認手順書」(§5.2 動作確認シナリオ A〜H の手順を含む)を実装完了報告に含める
- [ ] 開発サーバー起動時にコンソール警告(React の key 警告等)が新規発生していない

**バックエンド側**:

- [ ] `make test` または `go test ./...` が全通過する(新規テスト + 既存テスト回帰なし)
- [ ] 主要 API を `curl` で叩き、レスポンスを報告書に貼付(`POST /api/combos` を setups あり・なし両方で)
- [ ] エラーケース(`setups[i]` バリデーションエラー)を `curl` で再現
- [ ] **M3-05 統合 E2E シナリオを必ず再実施**(`POST /api/combos` 既存挙動の回帰確認、M4-02 E2E 由来知見)
- [ ] **境界値ケース全網羅**(§4.3.4 表のケース): setups 未指定 / 空配列 / 1 件 / 複数件 / バリデーション失敗 / ロールバック動作(M4-10 反省踏襲)
- [ ] `go build ./...` が成功する
- [ ] `go vet ./...` でエラーなし

**開発者の責任範囲**:

- 動作確認シナリオ A〜H の実機確認(M4-05 で M4 統合 E2E にて補強)

### 7.3 品質チェック

- [ ] CLAUDE.md §4 TypeScript / Go 規約に準拠
- [ ] CLAUDE.md §5 テスト規約に準拠(フック層・コンポーネント層・ページ層・サービス層・リポジトリ層・ハンドラ層が必須カバー)
- [ ] CLAUDE.md §10 禁止事項に抵触していない
- [ ] **architecture-patterns.md v1.0.2 §1 フック分離パターン**に準拠
- [ ] **architecture-patterns.md v1.0.2 §1.1 TanStack Query queryKey 規約(flat tuple + number 正規化)**に準拠
- [ ] **shadcn/ui を使用していない**(playbook §4.6、標準 HTML + Tailwind 自作)
- [ ] **M4-02 で確定した `CreateSetupInput` 型を再利用**(新規型定義しない)
- [ ] **M4-02 で実装した `LinkExistingSetupModal` を再利用**(新規モーダル実装しない)
- [ ] **VAL-S05 がサービス層関数の引数レベルで適用されている**(CHANGE-012 §6.2 R-2 対策、最重要)
- [ ] **トランザクション原子性が確保されている**(setups 作成中の失敗で全体ロールバック)
- [ ] **playbook §4.5 フローの素直さ原則**に抵触していない(エラー駆動再試行禁止、N+1 回避、原子性確保)
- [ ] setup 系のエラーコードが **小文字スネーク** で統一されている
- [ ] **共通エラー型 `model.APIErrorResponse`** を直接呼び出している(architecture-patterns.md §3、独自ヘルパなし)
- [ ] **編集モードでは同時登録セクションが非表示**(本指示書 §1.4 / §4.9 規定)

### 7.4 ドキュメント

- [ ] `docs/progress/progress-log.md` に M4-04 完了報告を追記する
- [ ] §3.4 着手前確認結果を含める(全 6 項目)
- [ ] 設計判断事項表(§4.10)の各項目が指示書通りに実装された旨を明記
- [ ] **§5.2 動作確認シナリオ A〜H の実機確認結果**を明記
- [ ] **M3-05 統合 E2E シナリオの再実行結果**(回帰なし)を明記
- [ ] **境界値ケース全網羅の検証結果**(§4.3.4 表)を明記

### 7.5 完了報告

- [ ] 開発者に「M4-04 が完了しました」と報告
- [ ] §7.1〜§7.4 の自己テスト結果を報告書に含める
- [ ] M4-05 着手の前提条件が整ったことを宣言(M4 統合 E2E + L-01 解消は M4-05 で着手可能)

---

## 8. 参照ドキュメント

| ID / ファイル | 関連節 |
|--------------|--------|
| CLAUDE.md | §4 規約、§5 テスト規約、§10 禁止事項 |
| **DES-005 v2.8.0** | **§5.7 item 10 セットプレイ登録セクション、§5.7 編集保存の動作(CHANGE-013 反映後)** |
| DES-006 v1.9.0 | §3 VAL-S01〜S05 |
| **M4-01 指示書 v1.0.2** | **§4.2.1 コンボ作成 API DTO 予約、§4.2.7 setup CRUD API、CreateSetupInput 型** |
| **M4-02 指示書 v1.0.4** | **§4.2 setup フロント型定義、§4.4 setup フック、§4.7 LinkExistingSetupModal** |
| **M4-03 指示書 v1.0.2** | **参考(本指示書では使用しない)** |
| M4-overview v1.1.3 | §3.5 M4-04 詳細、§3.6 M4-05 詳細、§5 M4 で扱わないもの |
| architecture-patterns.md v1.0.2 | §1 フック分離パターン、§1.1 queryKey 規約(flat tuple) |
| **CHANGE-012 通知書** | §6.2 R-2 対策(VAL-S05 サービス層引数レベル適用) |
| REQ-001 FR004 | コンボ + セットプレイ同時登録 |
| M3-05 指示書 | コンボ作成 API の現状実装パターン(参考、§3.4.2 で実態確認) |
| SUPP-001 §7 | setup 関連サービス層(M4-01 で実装済み、本指示書では再利用) |
| playbook v1.6.0 | §4.5 / §4.6 / §14 |
| retrospective-log v1.0.12 | M4-1〜M4-10 反省 + §5.5 持ち越し確認課題(C-1 は M4-05) |

---

## 9. 注意事項・判断に迷ったら

### 9.1 推測で進めてはいけない事項

以下は推測で進めず、Plan Mode で開発者に確認する:

- §3.4.1 M4-01 予約形(`Setups json.RawMessage`)が想定と異なる場合
- §3.4.2 既存のコンボ作成サービスのトランザクション制御パターンが想定と大きく異なる場合
- §3.4.3 M4-01 setup 作成サービスのシグネチャに `parent_combo_id` 引数がない場合(CHANGE-012 §6.2 R-2 対策の前提が崩れる)
- §3.4.4 `LinkExistingSetupModal` が新規登録モード(コンボ未作成)で再利用できない構造の場合
- §3.4.5 `useCreateCombo` の queryKey が flat tuple 形式でない場合(architecture-patterns.md v1.0.2 §1.1 違反)
- §3.4.6 combo → setup の依存方向が循環していたり、想定と異なる場合
- §4.7.3 仮想コントローラの共用実装で、既存のコンボ本体レシピ入力との競合が見つかった場合
- 既存テストの回帰が発生した場合

### 9.2 推測で進めてよい事項(その旨を明示)

以下は推測で進めてよいが、実装時に「推測:〜と仮定した」とコード内コメントまたは完了報告に明示する:

- 表示文言の細部(「このコンボに紐づくセットプレイ」「+ セットプレイを追加」「既存のセットプレイを紐付け」等の和文表現の調整)
- Tailwind クラスの細部(色・余白・タイポグラフィ)
- 同時登録セクションのレイアウト細部(入力行のインデント、削除ボタンの位置等)
- 仮想コントローラのフォーカス管理 UI の見栄え(現在編集中の setup を視覚的に示す方法)

### 9.3 不明事項発見時の対応

- 設計書本体(DES-005 §5.7 item 10)と本指示書の記述が乖離している場合 → 実装を止めて開発者に報告し、CHANGE 通知書起票要否を協議
- 本指示書の §4 詳細仕様で具体化されていない実装判断が必要になった場合 → §9.2 の範囲なら推測で進めて明示、それ以外は Plan Mode で開発者確認
- M4-01 / M4-02 / M4-03 で実装済みの API / 型に変更が必要と判断した場合 → 実装を止めて開発者に報告(本指示書 §2.3 「変更しないもの」原則に抵触)

### 9.4 Plan Mode で計画提示時に含めるべき項目

Plan Mode 必須:

- §3.4 着手前確認の結果(全 6 項目)
- 特に §3.4.1 M4-01 予約形・§3.4.2 トランザクション・§3.4.3 setup 作成サービスのシグネチャ
- §3.4.4 `LinkExistingSetupModal` の Props 構造(新規登録モードで再利用可能か)
- §3.4.5 useCreateCombo queryKey の flat tuple 形式 + 既存 invalidate 対象
- §3.4.6 combo → setup のパッケージ依存方向
- §4.3 サービス層トランザクションの境界値ケース(§4.3.4 表)の網羅テスト方針
- 既存ロジック再利用範囲(M4-01 setup 作成サービス、M4-02 LinkExistingSetupModal、CreateSetupInput 型等)

---

## 10. 完了後の次ステップ

M4-04 完了後、開発者が動作確認・承認したら **M4-05(M4 統合 E2E + L-01 オプショナル型解消)** に進む。

M4-05 着手時の前提条件:

- M4-04 同時登録機能が動作している(本指示書で実装)
- L-01 オプショナル型解消は M4-05 で対応
- C-1 持ち越し確認課題(retrospective-log v1.0.12 §5.5、M4-03 PUT/PATCH 両パス implicitCarry 判定 vs DES-005 §5.7 (b) 規定の整合性)は M4-05 統合 E2E シナリオの一部として確認

---

*以上*
